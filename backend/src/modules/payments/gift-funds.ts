import { AppError } from "../../common/errors/app-error.js";
import { decryptIban } from "../../common/security/bank-account.js";
import type { AppConfig } from "../../config/env.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { ListsService } from "../lists/service.js";

const activePayoutStatuses = ["REQUESTED", "APPROVED", "COMPLETED"];

export class GiftFundsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: AppConfig,
    private readonly lists: ListsService,
  ) {}

  async summary(userId: string, listId: string) {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    const [entries, payouts, payments] = await Promise.all([
      this.prisma.fundsLedgerEntry.findMany({
        where: {
          listId,
          status: "CONFIRMED",
          type: { in: ["MOLLIE_GIFT_PAID", "MOLLIE_GIFT_REFUND"] },
        },
        select: { amountMinor: true, currency: true },
      }),
      this.prisma.payout.findMany({
        where: { listId, provider: "MANUAL" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amountMinor: true,
          currency: true,
          status: true,
          createdAt: true,
          processedAt: true,
          externalId: true,
          metadata: true,
        },
      }),
      this.prisma.payment.findMany({
        where: { listId, provider: "MOLLIE", purpose: "GIFT_CART" },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          externalId: true,
          status: true,
          purpose: true,
          amountMinor: true,
          currency: true,
          description: true,
          createdAt: true,
          contributions: {
            select: {
              contributorName: true,
              giftId: true,
              status: true,
              amountMinor: true,
              gift: { select: { title: true } },
            },
          },
        },
      }),
    ]);
    const currency = "EUR";
    const allocated = entries
      .filter((row) => row.currency === currency)
      .reduce((sum, row) => sum + row.amountMinor, 0n);
    const reserved = payouts
      .filter((row) => row.currency === currency && activePayoutStatuses.includes(row.status))
      .reduce((sum, row) => sum + row.amountMinor, 0n);
    return {
      clientCode: listId,
      currency,
      allocatedCents: Number(allocated),
      committedPayoutCents: Number(reserved),
      requestableCents: Number(allocated > reserved ? allocated - reserved : 0n),
      payments: payments.map((row) => ({
        id: row.id,
        mollieId: row.externalId,
        status: row.status,
        purpose: row.purpose,
        amountCents: Number(row.amountMinor),
        currency: row.currency,
        giftTitle: row.description,
        items: row.contributions.map((item) => ({
          giftId: item.giftId,
          giftTitle: item.gift?.title ?? null,
          contributorName: item.contributorName,
          allocationStatus: item.status,
          amountCents: Number(item.amountMinor),
        })),
        createdAt: row.createdAt.toISOString(),
      })),
      payouts: payouts.map((row) => ({
        id: row.id,
        status: row.status,
        amountCents: Number(row.amountMinor),
        currency: row.currency,
        reference: row.externalId,
        createdAt: row.createdAt.toISOString(),
        processedAt: row.processedAt?.toISOString() ?? null,
      })),
    };
  }

  async request(userId: string, listId: string, amountCents: number) {
    if (!this.config.FEATURE_GIFT_MOLLIE_CHECKOUT)
      throw new AppError(404, "GIFT_FUNDS_DISABLED", "Les fonds cadeaux sont indisponibles");
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER"]);
    if (amountCents <= 0 || !Number.isSafeInteger(amountCents))
      throw new AppError(400, "PAYOUT_AMOUNT_INVALID", "Montant invalide");
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRawUnsafe("SELECT id FROM lists WHERE id = ? FOR UPDATE", listId);
        const list = await tx.giftList.findUnique({
          where: { id: listId },
          select: {
            contributionRecipientId: true,
            contributionRecipient: {
              select: {
                bankAccount: {
                  select: {
                    beneficiary: true,
                    ibanMasked: true,
                    ibanEncrypted: true,
                  },
                },
              },
            },
          },
        });
        if (!list?.contributionRecipient.bankAccount)
          throw new AppError(
            409,
            "PARENT_BANK_ACCOUNT_REQUIRED",
            "Ajoutez un compte bancaire pour recevoir le virement",
          );
        const entries = await tx.fundsLedgerEntry.findMany({
          where: {
            listId,
            status: "CONFIRMED",
            currency: "EUR",
            type: { in: ["MOLLIE_GIFT_PAID", "MOLLIE_GIFT_REFUND"] },
          },
          select: { amountMinor: true },
        });
        const payouts = await tx.payout.findMany({
          where: {
            listId,
            provider: "MANUAL",
            status: { in: activePayoutStatuses },
            currency: "EUR",
          },
          select: { amountMinor: true },
        });
        const available =
          entries.reduce((sum, row) => sum + row.amountMinor, 0n) -
          payouts.reduce((sum, row) => sum + row.amountMinor, 0n);
        if (BigInt(amountCents) > available)
          throw new AppError(
            409,
            "PAYOUT_BALANCE_INSUFFICIENT",
            "Le solde attribué à cette liste est insuffisant",
          );
        const account = list.contributionRecipient.bankAccount;
        const payout = await tx.payout.create({
          data: {
            listId,
            requestedById: userId,
            amountMinor: BigInt(amountCents),
            currency: "EUR",
            status: "REQUESTED",
            provider: "MANUAL",
            metadata: {
              recipientUserId: list.contributionRecipientId,
              beneficiary: account.beneficiary,
              ibanMasked: account.ibanMasked,
              ibanEncrypted: account.ibanEncrypted,
            },
          },
        });
        return { id: payout.id, status: payout.status, amountCents };
      },
      { isolationLevel: "Serializable" },
    );
  }

  async adminList() {
    const rows = await this.prisma.payout.findMany({
      where: { provider: "MANUAL" },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        list: {
          select: {
            title: true,
            contributionRecipient: {
              select: {
                bankAccount: {
                  select: { beneficiary: true, ibanMasked: true, ibanEncrypted: true },
                },
              },
            },
          },
        },
      },
    });
    return {
      payouts: rows.map((row) => {
        const snapshot =
          row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
            ? row.metadata
            : {};
        const encrypted = snapshot["ibanEncrypted"];
        return {
          id: row.id,
          listId: row.listId,
          listTitle: row.list.title,
          status: row.status,
          amountCents: Number(row.amountMinor),
          currency: row.currency,
          beneficiary: typeof snapshot["beneficiary"] === "string" ? snapshot["beneficiary"] : null,
          ibanMasked: typeof snapshot["ibanMasked"] === "string" ? snapshot["ibanMasked"] : null,
          iban:
            row.status === "APPROVED" &&
            typeof encrypted === "string" &&
            this.config.BANK_ACCOUNT_ENCRYPTION_KEY
              ? decryptIban(encrypted, this.config.BANK_ACCOUNT_ENCRYPTION_KEY)
              : null,
          reference: row.externalId,
          createdAt: row.createdAt.toISOString(),
        };
      }),
    };
  }

  async decide(payoutId: string, approve: boolean) {
    const changed = await this.prisma.payout.updateMany({
      where: { id: payoutId, provider: "MANUAL", status: "REQUESTED" },
      data: { status: approve ? "APPROVED" : "REJECTED" },
    });
    if (changed.count !== 1)
      throw new AppError(409, "PAYOUT_STATE_INVALID", "Demande déjà traitée");
    return { status: approve ? "APPROVED" : "REJECTED" };
  }

  async complete(payoutId: string, reference: string) {
    const changed = await this.prisma.payout.updateMany({
      where: { id: payoutId, provider: "MANUAL", status: "APPROVED" },
      data: { status: "COMPLETED", externalId: reference.trim(), processedAt: new Date() },
    });
    if (changed.count !== 1)
      throw new AppError(
        409,
        "PAYOUT_STATE_INVALID",
        "Virement non approuvé ou déjà marqué effectué",
      );
    return { status: "COMPLETED" };
  }
}
