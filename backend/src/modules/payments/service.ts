import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { PaymentStatus } from "../../generated/prisma/enums.js";
import type { ListsService } from "../lists/service.js";
import { deriveBalance } from "../rewards/service.js";
import { decimalToMinor, type MolliePayment, type PaymentProviderClient } from "./mollie.js";

const terminalPaymentStatuses = new Set<PaymentStatus>([
  "FAILED",
  "EXPIRED",
  "CANCELLED",
  "REFUNDED",
  "CHARGEDBACK",
]);

export class PaymentsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: AppConfig,
    private readonly lists: ListsService,
    private readonly provider: PaymentProviderClient,
  ) {}

  async methods(_userId: string) {
    if (!this.config.FEATURE_MOLLIE_PAYMENTS)
      return { enabled: false, mode: this.config.MOLLIE_MODE, methods: [] };
    const methods = await this.provider.listMethods(
      BigInt(this.config.PREMIUM_PRICE_MINOR),
      this.config.PREMIUM_CURRENCY,
    );
    return { enabled: true, mode: this.config.MOLLIE_MODE, methods };
  }

  async premiumStatus(userId: string, listId: string) {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    const entitlement = await this.prisma.listEntitlement.findUnique({ where: { listId } });
    return {
      enabled: this.config.FEATURE_PREMIUM,
      mollieEnabled: this.config.FEATURE_MOLLIE_PAYMENTS,
      rewardsEnabled:
        this.config.FEATURE_REWARDS &&
        this.config.FEATURE_PREMIUM_REWARDS &&
        this.config.FEATURE_REWARD_REDEMPTION,
      priceCents: this.config.PREMIUM_PRICE_MINOR,
      currency: this.config.PREMIUM_CURRENCY,
      plan: entitlement?.plan ?? "FREE",
      active:
        entitlement?.plan === "PREMIUM" &&
        (!entitlement.expiresAt || entitlement.expiresAt > new Date()),
    };
  }

  async createPremium(userId: string, listId: string, idempotencyKey: string, useRewards: boolean) {
    if (!this.config.FEATURE_PREMIUM)
      throw new AppError(404, "PREMIUM_DISABLED", "Premium is disabled");
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER"]);
    const internalKey = useRewards
      ? `premium-rewards:${userId}:${idempotencyKey}`
      : `premium:${userId}:${idempotencyKey}`;
    const replay = await this.prisma.payment.findUnique({ where: { idempotencyKey: internalKey } });
    if (replay) {
      if (replay.listId !== listId || !replay.purpose.startsWith("PREMIUM"))
        throw new AppError(409, "IDEMPOTENCY_CONFLICT", "Idempotency key has conflicting data");
      if (replay.provider !== "MOLLIE" || replay.externalId) return serializePayment(replay);
      if (Date.now() - replay.createdAt.valueOf() > 50 * 60_000)
        throw new AppError(
          409,
          "PAYMENT_CREATION_AMBIGUOUS",
          "Payment creation requires manual provider reconciliation before retry",
        );
    }
    if (useRewards) {
      const active = await this.prisma.listEntitlement.findUnique({ where: { listId } });
      if (active?.plan === "PREMIUM" && (!active.expiresAt || active.expiresAt > new Date()))
        throw new AppError(
          409,
          "PREMIUM_ALREADY_ACTIVE",
          "Premium is already active for this list",
        );
      return this.createRewardPremium(userId, listId, idempotencyKey);
    }
    if (!this.config.FEATURE_MOLLIE_PAYMENTS)
      throw new AppError(404, "MOLLIE_DISABLED", "Mollie payments are disabled");

    const payment =
      replay ??
      (await this.prisma.$transaction(
        async (tx) => {
          const entitlement = await tx.listEntitlement.findUnique({ where: { listId } });
          if (entitlement && ["PREMIUM", "PENDING_PREMIUM"].includes(entitlement.plan))
            throw new AppError(
              409,
              "PREMIUM_ALREADY_ACTIVE",
              "Premium is active or awaiting payment for this list",
            );
          const created = await tx.payment.create({
            data: {
              listId,
              provider: "MOLLIE",
              idempotencyKey: internalKey,
              purpose: "PREMIUM",
              amountMinor: BigInt(this.config.PREMIUM_PRICE_MINOR),
              currency: this.config.PREMIUM_CURRENCY,
              description: "Mila Premium",
              metadata: { requestedById: userId },
            },
          });
          await tx.listEntitlement.upsert({
            where: { listId },
            create: {
              listId,
              paymentId: created.id,
              plan: "PENDING_PREMIUM",
              metadata: { source: "MOLLIE" },
            },
            update: {
              paymentId: created.id,
              plan: "PENDING_PREMIUM",
              expiresAt: null,
              metadata: { source: "MOLLIE" },
            },
          });
          return created;
        },
        { isolationLevel: "Serializable" },
      ));
    if (payment.listId !== listId || payment.purpose !== "PREMIUM")
      throw new AppError(409, "IDEMPOTENCY_CONFLICT", "Idempotency key has conflicting data");
    if (payment.externalId && payment.redirectUrl) return serializePayment(payment);

    const remote = await this.provider.createPayment({
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      description: `Mila Premium · ${listId.slice(0, 8)}`,
      redirectUrl: `${this.config.MOLLIE_REDIRECT_URL}${this.config.MOLLIE_REDIRECT_URL.includes("?") ? "&" : "?"}payment=${payment.id}`,
      webhookUrl: this.config.MOLLIE_WEBHOOK_URL,
      internalPaymentId: payment.id,
      idempotencyKey: payment.id,
    });
    this.assertRemoteIdentity(payment, remote);
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        externalId: remote.id,
        status: mapPaymentStatus(remote.status),
        redirectUrl: remote._links.checkout?.href,
        metadata: { requestedById: userId, providerMode: remote.mode },
      },
    });
    return serializePayment(updated);
  }

  async getPayment(userId: string, paymentId: string, reconcile = false) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (!payment.listId) throw new AppError(403, "FORBIDDEN", "Payment is not user-accessible");
    await this.lists.assertRole(userId, payment.listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    if (reconcile && payment.provider === "MOLLIE" && payment.externalId)
      await this.reconcileExternal(payment.externalId);
    const current = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    return serializePayment(current);
  }

  async reconcileExternal(externalId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { provider_externalId: { provider: "MOLLIE", externalId } },
    });
    if (!payment) return { known: false };
    const remote = await this.provider.getPayment(externalId);
    this.assertRemoteIdentity(payment, remote);
    const [refunds, chargebacks] = await Promise.all([
      this.provider.listRefunds(externalId),
      this.provider.listChargebacks(externalId),
    ]);
    await this.prisma.$transaction(async (tx) => {
      for (const refund of refunds) {
        const status = mapRefundStatus(refund.status);
        await tx.refund.upsert({
          where: { paymentId_externalId: { paymentId: payment.id, externalId: refund.id } },
          create: {
            paymentId: payment.id,
            externalId: refund.id,
            idempotencyKey: `mollie-refund:${refund.id}`,
            amountMinor: decimalToMinor(refund.amount.value),
            currency: refund.amount.currency,
            status,
            processedAt: status === "SUCCEEDED" ? new Date() : null,
          },
          update: { status, processedAt: status === "SUCCEEDED" ? new Date() : null },
        });
        if (status === "SUCCEEDED")
          await tx.financialLedgerEntry.upsert({
            where: { idempotencyKey: `refund:${refund.id}` },
            create: {
              listId: payment.listId,
              paymentId: payment.id,
              type: "ADJUSTMENT",
              status: "CONFIRMED",
              amountMinor: -decimalToMinor(refund.amount.value),
              currency: refund.amount.currency,
              idempotencyKey: `refund:${refund.id}`,
              sourceType: "mollie_refund",
              sourceId: refund.id,
              settledAt: new Date(),
            },
            update: {},
          });
      }
      for (const chargeback of chargebacks) {
        await tx.chargeback.upsert({
          where: { paymentId_externalId: { paymentId: payment.id, externalId: chargeback.id } },
          create: {
            paymentId: payment.id,
            externalId: chargeback.id,
            amountMinor: decimalToMinor(chargeback.amount.value),
            currency: chargeback.amount.currency,
            reason: chargeback.reason?.description ?? chargeback.reason?.code,
            occurredAt: new Date(chargeback.createdAt),
            payload: chargeback,
          },
          update: {},
        });
        await tx.financialLedgerEntry.upsert({
          where: { idempotencyKey: `chargeback:${chargeback.id}` },
          create: {
            listId: payment.listId,
            paymentId: payment.id,
            type: "ADJUSTMENT",
            status: "CONFIRMED",
            amountMinor: -decimalToMinor(chargeback.amount.value),
            currency: chargeback.amount.currency,
            idempotencyKey: `chargeback:${chargeback.id}`,
            sourceType: "mollie_chargeback",
            sourceId: chargeback.id,
            settledAt: new Date(chargeback.createdAt),
          },
          update: {},
        });
      }
      const succeededRefunds = refunds
        .filter((refund) => mapRefundStatus(refund.status) === "SUCCEEDED")
        .reduce((total, refund) => total + decimalToMinor(refund.amount.value), 0n);
      const nextStatus: PaymentStatus = chargebacks.length
        ? "CHARGEDBACK"
        : succeededRefunds >= payment.amountMinor
          ? "REFUNDED"
          : succeededRefunds > 0n
            ? "PARTIALLY_REFUNDED"
            : mapPaymentStatus(remote.status);
      const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
      const safeStatus = transitionStatus(current.status, nextStatus);
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: safeStatus,
          webhookLastSeenAt: new Date(),
          paidAt: remote.paidAt ? new Date(remote.paidAt) : current.paidAt,
        },
      });
      if (safeStatus === "PAID") {
        await tx.financialLedgerEntry.upsert({
          where: { idempotencyKey: `payment:${payment.id}` },
          create: {
            listId: payment.listId,
            paymentId: payment.id,
            type: "PREMIUM_REVENUE",
            status: "CONFIRMED",
            amountMinor: payment.amountMinor,
            currency: payment.currency,
            idempotencyKey: `payment:${payment.id}`,
            sourceType: "mollie_payment",
            sourceId: remote.id,
            settledAt: remote.paidAt ? new Date(remote.paidAt) : new Date(),
          },
          update: {},
        });
        if (payment.purpose === "PREMIUM" && payment.listId)
          await tx.listEntitlement.upsert({
            where: { listId: payment.listId },
            create: {
              listId: payment.listId,
              paymentId: payment.id,
              plan: "PREMIUM",
              metadata: { source: "MOLLIE" },
            },
            update: {
              paymentId: payment.id,
              plan: "PREMIUM",
              startsAt: new Date(),
              expiresAt: null,
              metadata: { source: "MOLLIE" },
            },
          });
      }
      if (
        ["REFUNDED", "CHARGEDBACK"].includes(safeStatus) &&
        payment.purpose === "PREMIUM" &&
        payment.listId
      )
        await tx.listEntitlement.updateMany({
          where: { listId: payment.listId, paymentId: payment.id },
          data: {
            plan: "FREE",
            expiresAt: new Date(),
            metadata: { source: "MOLLIE", revokedBy: safeStatus },
          },
        });
      if (
        ["FAILED", "EXPIRED", "CANCELLED"].includes(safeStatus) &&
        payment.purpose === "PREMIUM" &&
        payment.listId
      )
        await tx.listEntitlement.updateMany({
          where: {
            listId: payment.listId,
            paymentId: payment.id,
            plan: "PENDING_PREMIUM",
          },
          data: {
            plan: "FREE",
            expiresAt: new Date(),
            metadata: { source: "MOLLIE", failedBy: safeStatus },
          },
        });
    });
    return { known: true };
  }

  async refund(
    actorId: string,
    paymentId: string,
    amountMinor: bigint,
    reason: string,
    idempotencyKey: string,
  ) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (
      payment.provider !== "MOLLIE" ||
      !payment.externalId ||
      !["PAID", "PARTIALLY_REFUNDED"].includes(payment.status)
    )
      throw new AppError(409, "PAYMENT_NOT_REFUNDABLE", "Payment cannot be refunded");
    const already = await this.prisma.refund.aggregate({
      where: { paymentId, status: { in: ["PENDING", "SUCCEEDED"] } },
      _sum: { amountMinor: true },
    });
    if (amountMinor <= 0n || (already._sum.amountMinor ?? 0n) + amountMinor > payment.amountMinor)
      throw new AppError(409, "REFUND_AMOUNT_INVALID", "Refund amount exceeds refundable balance");
    const key = `refund:${payment.id}:${idempotencyKey}`;
    const refund = await this.prisma.refund.upsert({
      where: { idempotencyKey: key },
      create: { paymentId, idempotencyKey: key, amountMinor, currency: payment.currency, reason },
      update: {},
    });
    if (!refund.externalId) {
      const remote = await this.provider.createRefund({
        paymentId: payment.externalId,
        amountMinor,
        currency: payment.currency,
        description: reason,
        internalRefundId: refund.id,
        idempotencyKey: refund.id,
      });
      await this.prisma.refund.update({
        where: { id: refund.id },
        data: { externalId: remote.id, status: mapRefundStatus(remote.status) },
      });
    }
    await this.prisma.adminAuditLog.create({
      data: {
        actorId,
        action: "payment_refund_requested",
        targetType: "payment",
        targetId: payment.id,
        reason,
        after: { refundId: refund.id, amountMinor: amountMinor.toString() },
      },
    });
    await this.reconcileExternal(payment.externalId);
    return { refundId: refund.id };
  }

  async adminList() {
    const payments = await this.prisma.payment.findMany({
      include: {
        refunds: { select: { id: true, amountMinor: true, status: true } },
        chargebacks: { select: { id: true, amountMinor: true } },
        entitlement: { select: { plan: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return {
      mode: this.config.MOLLIE_MODE,
      payments: payments.map((payment) => ({
        ...serializePayment(payment),
        listId: payment.listId,
        provider: payment.provider,
        externalId: payment.externalId,
        entitlementPlan: payment.entitlement?.plan ?? null,
        refundedCents: Number(
          payment.refunds
            .filter((refund) => refund.status === "SUCCEEDED")
            .reduce((total, refund) => total + refund.amountMinor, 0n),
        ),
        chargebackCents: Number(
          payment.chargebacks.reduce((total, chargeback) => total + chargeback.amountMinor, 0n),
        ),
      })),
    };
  }

  async reconcilePayment(paymentId: string) {
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.provider !== "MOLLIE" || !payment.externalId)
      throw new AppError(409, "PAYMENT_NOT_RECONCILABLE", "Payment has no Mollie resource");
    await this.reconcileExternal(payment.externalId);
    return { reconciled: true };
  }

  private async createRewardPremium(userId: string, listId: string, idempotencyKey: string) {
    if (
      !this.config.FEATURE_REWARDS ||
      !this.config.FEATURE_PREMIUM_REWARDS ||
      !this.config.FEATURE_REWARD_REDEMPTION
    )
      throw new AppError(
        404,
        "PREMIUM_REWARD_REDEMPTION_DISABLED",
        "Premium reward redemption is disabled",
      );
    return this.prisma.$transaction(
      async (tx) => {
        const wallet = await tx.rewardWallet.upsert({
          where: { listId },
          create: { listId },
          update: {},
        });
        const rows = await tx.rewardTransaction.findMany({ where: { walletId: wallet.id } });
        if (deriveBalance(rows).available < this.config.PREMIUM_PRICE_MINOR)
          throw new AppError(409, "REWARD_BALANCE_INSUFFICIENT", "Insufficient reward balance");
        const payment = await tx.payment.upsert({
          where: { idempotencyKey: `premium-rewards:${userId}:${idempotencyKey}` },
          create: {
            listId,
            provider: "MANUAL",
            idempotencyKey: `premium-rewards:${userId}:${idempotencyKey}`,
            purpose: "PREMIUM_REWARD_REDEMPTION",
            status: "PAID",
            amountMinor: 0n,
            currency: this.config.PREMIUM_CURRENCY,
            description: "Mila Premium via récompenses",
            paidAt: new Date(),
            metadata: { rewardCostMinor: this.config.PREMIUM_PRICE_MINOR },
          },
          update: {},
        });
        const redemption = await tx.rewardRedemption.create({
          data: {
            walletId: wallet.id,
            requestedById: userId,
            type: "PREMIUM",
            status: "PROCESSED",
            amountMinor: BigInt(this.config.PREMIUM_PRICE_MINOR),
            processedAt: new Date(),
            metadata: { paymentId: payment.id },
          },
        });
        await tx.rewardTransaction.upsert({
          where: { idempotencyKey: `premium-redemption:${payment.id}` },
          create: {
            walletId: wallet.id,
            type: "REDEMPTION",
            status: "CONFIRMED",
            amountMinor: BigInt(-this.config.PREMIUM_PRICE_MINOR),
            idempotencyKey: `premium-redemption:${payment.id}`,
            sourceType: "premium_redemption",
            sourceId: redemption.id,
            settledAt: new Date(),
            metadata: { description: "Conversion en Mila Premium" },
          },
          update: {},
        });
        await tx.listEntitlement.upsert({
          where: { listId },
          create: {
            listId,
            paymentId: payment.id,
            plan: "PREMIUM",
            metadata: { source: "REWARDS" },
          },
          update: {
            paymentId: payment.id,
            plan: "PREMIUM",
            startsAt: new Date(),
            expiresAt: null,
            metadata: { source: "REWARDS" },
          },
        });
        return serializePayment(payment);
      },
      { isolationLevel: "Serializable" },
    );
  }

  private assertRemoteIdentity(
    payment: { id: string; amountMinor: bigint; currency: string },
    remote: MolliePayment,
  ) {
    const metadata =
      typeof remote.metadata === "string" ? safeJson(remote.metadata) : remote.metadata;
    if (
      remote.mode !== this.config.MOLLIE_MODE ||
      remote.amount.currency !== payment.currency ||
      decimalToMinor(remote.amount.value) !== payment.amountMinor ||
      metadata?.internalPaymentId !== payment.id
    )
      throw new AppError(
        409,
        "PAYMENT_PROVIDER_MISMATCH",
        "Payment provider data does not match internal payment",
      );
  }
}

function mapPaymentStatus(status: MolliePayment["status"]): PaymentStatus {
  return (
    {
      open: "OPEN",
      pending: "PENDING",
      authorized: "AUTHORIZED",
      paid: "PAID",
      failed: "FAILED",
      expired: "EXPIRED",
      canceled: "CANCELLED",
    } as const
  )[status];
}
function mapRefundStatus(
  status: "queued" | "pending" | "processing" | "refunded" | "failed" | "canceled",
) {
  if (status === "refunded") return "SUCCEEDED" as const;
  if (status === "failed") return "FAILED" as const;
  if (status === "canceled") return "CANCELLED" as const;
  return "PENDING" as const;
}
function transitionStatus(current: PaymentStatus, next: PaymentStatus): PaymentStatus {
  if (current === "CHARGEDBACK") return current;
  if (current === "REFUNDED" && next !== "CHARGEDBACK") return current;
  if (current === "PARTIALLY_REFUNDED" && !["REFUNDED", "CHARGEDBACK"].includes(next))
    return current;
  if (
    current === "PAID" &&
    terminalPaymentStatuses.has(next) &&
    !["REFUNDED", "CHARGEDBACK"].includes(next)
  )
    return current;
  return next;
}
function serializePayment(payment: {
  id: string;
  status: PaymentStatus;
  amountMinor: bigint;
  currency: string;
  redirectUrl: string | null;
  purpose: string;
  createdAt: Date;
}) {
  const amountCents = Number(payment.amountMinor);
  if (!Number.isSafeInteger(amountCents))
    throw new AppError(500, "MONEY_RANGE_EXCEEDED", "Money value exceeds API range");
  return {
    id: payment.id,
    status: payment.status,
    amountCents,
    currency: payment.currency,
    checkoutUrl: payment.redirectUrl,
    purpose: payment.purpose,
    createdAt: payment.createdAt.toISOString(),
  };
}
function safeJson(value: string): { internalPaymentId?: string } | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as { internalPaymentId?: string }) : null;
  } catch {
    return null;
  }
}
