import { randomBytes } from "node:crypto";

import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { ListsService } from "../lists/service.js";

export class ContributionsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: AppConfig,
    private readonly lists: ListsService,
  ) {}

  async publicStatus(giftToken: string) {
    const gift = await this.prisma.gift.findFirst({
      where: {
        publicToken: giftToken,
        kind: "CONTRIBUTION",
        deletedAt: null,
        list: { status: "ACTIVE", deletedAt: null },
      },
      select: {
        id: true,
        title: true,
        listId: true,
        contributionTargetMinor: true,
        currency: true,
      },
    });
    if (!gift) throw new AppError(404, "GIFT_NOT_FOUND", "Gift not found");
    const totals = await this.prisma.contribution.aggregate({
      where: { giftId: gift.id, status: { in: ["PENDING", "CONFIRMED"] } },
      _sum: { amountMinor: true },
    });
    const committed = totals._sum.amountMinor ?? 0n;
    const target = gift.contributionTargetMinor;
    return {
      enabled: this.config.FEATURE_CONTRIBUTIONS,
      bankTransferEnabled: this.config.FEATURE_BANK_TRANSFERS,
      gift: { id: gift.id, title: gift.title },
      targetCents: target === null ? null : safeNumber(target),
      committedCents: safeNumber(committed),
      remainingCents:
        target === null ? null : safeNumber(target > committed ? target - committed : 0n),
      closed: target !== null && committed >= target,
      currency: gift.currency,
      minimumCents: this.config.CONTRIBUTION_MIN_MINOR,
      feeRateBps: this.config.CONTRIBUTION_FEE_RATE_BPS,
      platformShareRateBps: this.config.CONTRIBUTION_PLATFORM_SHARE_RATE_BPS,
    };
  }

  async createBankTransfer(input: {
    giftToken: string;
    amountCents: number;
    contributorName?: string;
    contributorEmail?: string;
    anonymous: boolean;
    message?: string;
    idempotencyKey: string;
  }) {
    if (!this.config.FEATURE_CONTRIBUTIONS || !this.config.FEATURE_BANK_TRANSFERS)
      throw new AppError(404, "CONTRIBUTIONS_DISABLED", "Contributions are disabled");
    if (!this.config.BANK_TRANSFER_BENEFICIARY || !this.config.BANK_TRANSFER_IBAN)
      throw new AppError(503, "BANK_TRANSFER_NOT_CONFIGURED", "Bank transfer is not configured");
    const amount = BigInt(input.amountCents);
    if (amount < BigInt(this.config.CONTRIBUTION_MIN_MINOR))
      throw new AppError(400, "CONTRIBUTION_TOO_SMALL", "Contribution is below the minimum");
    const gift = await this.prisma.gift.findFirst({
      where: {
        publicToken: input.giftToken,
        kind: "CONTRIBUTION",
        deletedAt: null,
        list: { status: "ACTIVE", deletedAt: null },
      },
      select: { id: true, listId: true, currency: true, contributionTargetMinor: true },
    });
    if (!gift) throw new AppError(404, "GIFT_NOT_FOUND", "Gift not found");
    const key = `contribution:${input.idempotencyKey}`;
    const existing = await this.prisma.bankTransfer.findFirst({
      where: { contribution: { idempotencyKey: key } },
      include: { instruction: true, contribution: true },
    });
    if (existing?.instruction) {
      if (
        existing.contribution?.giftId !== gift.id ||
        existing.contribution.amountMinor !== amount ||
        existing.contribution.currency !== gift.currency
      )
        throw new AppError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "Idempotency key was already used for another contribution",
        );
      return this.serializeInstruction(existing, existing.instruction);
    }

    return this.prisma.$transaction(
      async (tx) => {
        const total = await tx.contribution.aggregate({
          where: { giftId: gift.id, status: { in: ["PENDING", "CONFIRMED"] } },
          _sum: { amountMinor: true },
        });
        const committed = total._sum.amountMinor ?? 0n;
        if (
          gift.contributionTargetMinor !== null &&
          committed + amount > gift.contributionTargetMinor
        )
          throw new AppError(
            409,
            "CONTRIBUTION_TARGET_EXCEEDED",
            "Contribution exceeds the remaining target",
          );
        const { fee, share, net } = calculateContributionSplit(
          amount,
          this.config.CONTRIBUTION_FEE_RATE_BPS,
          this.config.CONTRIBUTION_PLATFORM_SHARE_RATE_BPS,
        );
        const contribution = await tx.contribution.create({
          data: {
            listId: gift.listId,
            giftId: gift.id,
            contributorName: input.contributorName?.trim() || null,
            contributorEmail: input.contributorEmail?.trim().toLowerCase() || null,
            anonymous: input.anonymous,
            message: input.message?.trim() || null,
            amountMinor: amount,
            idempotencyKey: key,
            feeMinor: fee,
            platformShareMinor: share,
            currency: gift.currency,
            metadata: { idempotencyKey: key },
          },
        });
        const reference = `MILA-${randomBytes(6).toString("hex").toUpperCase()}`;
        const transfer = await tx.bankTransfer.create({
          data: {
            listId: gift.listId,
            contributionId: contribution.id,
            reference,
            expectedAmountMinor: amount,
            currency: gift.currency,
            instruction: {
              create: {
                beneficiary: this.config.BANK_TRANSFER_BENEFICIARY,
                ibanMasked:
                  this.config.BANK_TRANSFER_IBAN_MASKED || maskIban(this.config.BANK_TRANSFER_IBAN),
                reference,
                amountMinor: amount,
                currency: gift.currency,
                expiresAt: new Date(Date.now() + 14 * 86_400_000),
              },
            },
          },
          include: { instruction: true, contribution: true },
        });
        await tx.fundsLedgerEntry.create({
          data: {
            listId: gift.listId,
            contributionId: contribution.id,
            type: "CONTRIBUTION_PENDING",
            status: "PENDING",
            amountMinor: net,
            currency: gift.currency,
            idempotencyKey: `contribution-pending:${contribution.id}`,
            sourceType: "bank_transfer",
            sourceId: transfer.id,
            metadata: {
              grossMinor: amount.toString(),
              feeMinor: fee.toString(),
              platformShareMinor: share.toString(),
            },
          },
        });
        return this.serializeInstruction(transfer, transfer.instruction!);
      },
      { isolationLevel: "Serializable" },
    );
  }

  async listForManager(userId: string, listId: string) {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    const [rows, ledger] = await Promise.all([
      this.prisma.contribution.findMany({
        where: { listId },
        include: { bankTransfer: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.fundsLedgerEntry.findMany({ where: { listId }, orderBy: { createdAt: "desc" } }),
    ]);
    return {
      contributions: rows.map((row) => ({
        id: row.id,
        giftId: row.giftId,
        contributorName: row.anonymous ? null : row.contributorName,
        anonymous: row.anonymous,
        message: row.message,
        amountCents: safeNumber(row.amountMinor),
        feeCents: safeNumber(row.feeMinor),
        platformShareCents: safeNumber(row.platformShareMinor),
        netToParentsCents: safeNumber(row.amountMinor - row.feeMinor - row.platformShareMinor),
        currency: row.currency,
        status: row.status,
        transferStatus: row.bankTransfer?.status ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      heldCents: safeNumber(
        ledger
          .filter((row) => row.status === "CONFIRMED")
          .reduce((sum, row) => sum + row.amountMinor, 0n),
      ),
      payoutEnabled: this.config.FEATURE_PARENT_PAYOUTS && this.config.FEATURE_MOLLIE_CONNECT,
    };
  }

  async reconcileTransfer(
    actorId: string,
    reference: string,
    receivedCents: number,
    payerName: string,
    approve: boolean,
    requestId: string,
  ) {
    const transfer = await this.prisma.bankTransfer.findUnique({
      where: { reference },
      include: { contribution: true },
    });
    if (!transfer?.contribution)
      throw new AppError(404, "TRANSFER_NOT_FOUND", "Transfer not found");
    const contribution = transfer.contribution;
    const received = BigInt(receivedCents);
    if (transfer.status === "MATCHED") {
      if (transfer.receivedAmountMinor === received) return { status: "MATCHED" as const };
      throw new AppError(
        409,
        "TRANSFER_ALREADY_MATCHED",
        "Matched transfer cannot be reconciled with another amount",
      );
    }
    if (transfer.status === "REFUNDED")
      throw new AppError(409, "TRANSFER_REFUNDED", "Refunded transfer cannot be reconciled");
    const exact = received === transfer.expectedAmountMinor;
    const status = approve && exact ? "MATCHED" : "MANUAL_REVIEW";
    await this.prisma.$transaction(async (tx) => {
      await tx.bankTransfer.update({
        where: { id: transfer.id },
        data: {
          receivedAmountMinor: received,
          payerName,
          receivedAt: new Date(),
          status,
          matchedAt: status === "MATCHED" ? new Date() : null,
        },
      });
      if (status === "MATCHED") {
        await tx.contribution.update({
          where: { id: contribution.id },
          data: { status: "CONFIRMED", confirmedAt: new Date() },
        });
        await tx.fundsLedgerEntry.updateMany({
          where: { contributionId: contribution.id, status: "PENDING" },
          data: { status: "EXPIRED" },
        });
        await tx.fundsLedgerEntry.create({
          data: {
            listId: transfer.listId,
            contributionId: contribution.id,
            type: "CONTRIBUTION_CONFIRMED",
            status: "CONFIRMED",
            amountMinor:
              contribution.amountMinor - contribution.feeMinor - contribution.platformShareMinor,
            currency: transfer.currency,
            idempotencyKey: `contribution-confirmed:${contribution.id}`,
            sourceType: "bank_transfer",
            sourceId: transfer.id,
            settledAt: new Date(),
          },
        });
      }
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: "bank_transfer_reconciled",
          targetType: "bank_transfer",
          targetId: transfer.id,
          reason: exact ? "Exact reference and amount" : "Amount mismatch requires manual review",
          after: { status, receivedMinor: received.toString(), payerName },
          requestId,
        },
      });
    });
    return { status };
  }

  async importBankTransfers(
    actorId: string,
    rows: Array<{ reference: string; receivedCents: number; payerName: string }>,
    requestId: string,
  ) {
    const results = [];
    for (const [index, row] of rows.entries()) {
      try {
        const result = await this.reconcileTransfer(
          actorId,
          row.reference,
          row.receivedCents,
          row.payerName,
          true,
          `${requestId}:${index}`,
        );
        results.push({ reference: row.reference, status: result.status });
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        results.push({ reference: row.reference, status: "REJECTED", code: error.code });
      }
    }
    return {
      imported: results.length,
      matched: results.filter((row) => row.status === "MATCHED").length,
      manualReview: results.filter((row) => row.status === "MANUAL_REVIEW").length,
      rejected: results.filter((row) => row.status === "REJECTED").length,
      results,
    };
  }

  async refundContribution(
    actorId: string,
    contributionId: string,
    reason: string,
    requestId: string,
  ) {
    const contribution = await this.prisma.contribution.findUnique({
      where: { id: contributionId },
      include: { bankTransfer: true },
    });
    if (!contribution || contribution.status !== "CONFIRMED")
      throw new AppError(409, "CONTRIBUTION_NOT_REFUNDABLE", "Contribution is not refundable");
    await this.prisma.$transaction(async (tx) => {
      await tx.contribution.update({
        where: { id: contribution.id },
        data: { status: "REFUNDED" },
      });
      if (contribution.bankTransfer)
        await tx.bankTransfer.update({
          where: { id: contribution.bankTransfer.id },
          data: { status: "REFUNDED" },
        });
      await tx.fundsLedgerEntry.create({
        data: {
          listId: contribution.listId,
          contributionId: contribution.id,
          type: "CONTRIBUTION_REFUND",
          status: "CONFIRMED",
          amountMinor: -(
            contribution.amountMinor -
            contribution.feeMinor -
            contribution.platformShareMinor
          ),
          currency: contribution.currency,
          idempotencyKey: `contribution-refund:${contribution.id}`,
          sourceType: "manual_bank_refund",
          sourceId: contribution.bankTransfer?.id,
          settledAt: new Date(),
          metadata: { reason },
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: "contribution_refund_confirmed",
          targetType: "contribution",
          targetId: contribution.id,
          reason,
          before: { status: contribution.status },
          after: { status: "REFUNDED" },
          requestId,
        },
      });
    });
    return { status: "REFUNDED" };
  }

  private serializeInstruction(
    transfer: { id: string; reference: string; expectedAmountMinor: bigint; currency: string },
    instruction: { beneficiary: string; ibanMasked: string; expiresAt: Date },
  ) {
    return {
      contributionId:
        "contribution" in transfer &&
        transfer.contribution &&
        typeof transfer.contribution === "object"
          ? (transfer.contribution as { id: string }).id
          : undefined,
      transferId: transfer.id,
      beneficiary: instruction.beneficiary,
      iban: this.config.BANK_TRANSFER_IBAN,
      ibanMasked: instruction.ibanMasked,
      reference: transfer.reference,
      amountCents: safeNumber(transfer.expectedAmountMinor),
      currency: transfer.currency,
      expiresAt: instruction.expiresAt.toISOString(),
    };
  }
}

function safeNumber(value: bigint) {
  const number = Number(value);
  if (!Number.isSafeInteger(number))
    throw new AppError(500, "MONEY_RANGE_EXCEEDED", "Money value exceeds API range");
  return number;
}

export function calculateContributionSplit(
  amount: bigint,
  feeRateBps: number,
  shareRateBps: number,
) {
  const fee = (amount * BigInt(feeRateBps)) / 10_000n;
  const share = (amount * BigInt(shareRateBps)) / 10_000n;
  if (fee + share >= amount)
    throw new AppError(500, "CONTRIBUTION_POLICY_INVALID", "Contribution cost policy is invalid");
  return { fee, share, net: amount - fee - share };
}

function maskIban(value: string) {
  const compact = value.replace(/\s/g, "");
  return compact.length > 8 ? `${compact.slice(0, 4)}••••••${compact.slice(-4)}` : "CONFIGURED";
}
