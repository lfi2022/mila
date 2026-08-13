import { randomBytes } from "node:crypto";

import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { ListsService } from "../lists/service.js";

type LedgerRow = {
  status: string;
  amountMinor: bigint;
  type: string;
};

export class RewardsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: AppConfig,
    private readonly lists: ListsService,
  ) {}

  async getListRewards(userId: string, listId: string) {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    const wallet = await this.ensureWallet(listId);
    const transactions = await this.prisma.rewardTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const redemptions = await this.prisma.rewardRedemption.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const balance = deriveBalance(transactions);
    return {
      programEnabled: this.config.FEATURE_REWARDS,
      redemptionEnabled: this.config.FEATURE_REWARDS && this.config.FEATURE_REWARD_REDEMPTION,
      currency: wallet.currency,
      availableCents: balance.available,
      pendingCents: balance.pending,
      lifetimeEarnedCents: balance.lifetimeEarned,
      lifetimeUsedCents: balance.lifetimeUsed,
      minRedemptionCents: this.config.REWARD_MIN_REDEMPTION_MINOR,
      explainerText:
        "Les récompenses proviennent uniquement d’événements validés. Le solde est recalculé depuis un historique immuable et chaque correction reste visible.",
      transactions: transactions.map((row) => ({
        id: row.id,
        type: row.type,
        status: row.status,
        amountCents: safeNumber(row.amountMinor),
        source: row.sourceType,
        description: metadataString(row.metadata, "description"),
        createdAt: row.createdAt.toISOString(),
      })),
      redemptions: redemptions.map((row) => ({
        id: row.id,
        type: row.type,
        status: row.status,
        amountCents: safeNumber(row.amountMinor),
        requestedAt: row.createdAt.toISOString(),
      })),
    };
  }

  listOffers() {
    return {
      offers: this.config.FEATURE_REWARD_MARKETPLACE
        ? [
            {
              id: "mila-credit-10",
              title: "Crédit Mila de 10 €",
              description: "Crédit utilisable sur un service Mila éligible.",
              costCents: 1_000,
              type: "MILA_CREDIT",
            },
          ]
        : [],
    };
  }

  async requestRedemption(userId: string, listId: string, offerId?: string) {
    if (!this.config.FEATURE_REWARDS || !this.config.FEATURE_REWARD_REDEMPTION)
      throw new AppError(404, "REDEMPTION_DISABLED", "Reward redemption is disabled");
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER"]);
    const wallet = await this.ensureWallet(listId);
    const amount = offerId === "mila-credit-10" ? 1_000 : this.config.REWARD_MIN_REDEMPTION_MINOR;
    if (offerId && !this.config.FEATURE_REWARD_MARKETPLACE)
      throw new AppError(404, "REWARD_OFFER_NOT_FOUND", "Reward offer not found");

    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.rewardTransaction.findMany({ where: { walletId: wallet.id } });
        if (deriveBalance(rows).available < amount)
          throw new AppError(409, "REWARD_BALANCE_INSUFFICIENT", "Insufficient reward balance");
        const redemption = await tx.rewardRedemption.create({
          data: {
            walletId: wallet.id,
            requestedById: userId,
            type: offerId ? "MARKETPLACE" : "MILA_CREDIT",
            amountMinor: BigInt(amount),
            metadata: offerId ? { offerId } : undefined,
          },
        });
        await tx.rewardTransaction.create({
          data: {
            walletId: wallet.id,
            type: "REDEMPTION",
            status: "CONFIRMED",
            amountMinor: BigInt(-amount),
            idempotencyKey: `redemption:${redemption.id}`,
            sourceType: "redemption",
            sourceId: redemption.id,
            settledAt: new Date(),
            metadata: { description: "Solde réservé pour une demande de conversion" },
          },
        });
        return {
          id: redemption.id,
          label: offerId ? "Crédit partenaire" : "Crédit Mila",
          amountCents: amount,
          status: redemption.status,
        };
      },
      { isolationLevel: "Serializable" },
    );
  }

  async reconcileCommission(commissionId: string) {
    if (!this.config.FEATURE_REWARDS || !this.config.FEATURE_AFFILIATE_REWARDS) return;
    const commission = await this.prisma.affiliateCommission.findUnique({
      where: { id: commissionId },
      include: {
        click: { select: { listId: true } },
        merchant: { select: { rewardEnabled: true, rewardShareRateBps: true } },
      },
    });
    if (!commission?.click?.listId || !commission.merchant?.rewardEnabled) return;
    const wallet = await this.ensureWallet(commission.click.listId);
    const policy = await this.rewardPolicy();
    const payload = commission.payload as { campaignId?: string } | null;
    const configuredRate =
      (payload?.campaignId ? policy.campaignRates?.[payload.campaignId] : undefined) ??
      commission.merchant.rewardShareRateBps ??
      policy.networkRates?.[commission.network] ??
      this.config.REWARD_DEFAULT_SHARE_RATE_BPS;
    const rate = Math.min(configuredRate, policy.maxShareRateBps ?? 10_000);
    let reward = (commission.commissionMinor * BigInt(rate)) / 10_000n;
    if (policy.maxRewardMinor != null && reward > BigInt(policy.maxRewardMinor))
      reward = BigInt(policy.maxRewardMinor);
    if (reward <= 0n) return;
    if (commission.status === "CONFIRMED") {
      await this.prisma.rewardTransaction.upsert({
        where: { idempotencyKey: `affiliate:${commission.id}` },
        create: {
          walletId: wallet.id,
          commissionId: commission.id,
          type: "AFFILIATE_COMMISSION",
          status: "CONFIRMED",
          amountMinor: reward,
          currency: commission.currency,
          idempotencyKey: `affiliate:${commission.id}`,
          sourceType: "affiliate_commission",
          sourceId: commission.id,
          settledAt: commission.confirmedAt ?? new Date(),
          metadata: { rateBps: rate, description: "Partage de commission marchande" },
        },
        update: {},
      });
    }
    if (commission.status === "CANCELLED") {
      const credit = await this.prisma.rewardTransaction.findUnique({
        where: { idempotencyKey: `affiliate:${commission.id}` },
      });
      if (credit)
        await this.prisma.rewardTransaction.upsert({
          where: { idempotencyKey: `affiliate-reversal:${commission.id}` },
          create: {
            walletId: wallet.id,
            commissionId: commission.id,
            type: "ADJUSTMENT",
            status: "CONFIRMED",
            amountMinor: -credit.amountMinor,
            currency: credit.currency,
            idempotencyKey: `affiliate-reversal:${commission.id}`,
            sourceType: "affiliate_commission_reversal",
            sourceId: commission.id,
            settledAt: new Date(),
            metadata: { description: "Compensation après annulation de la commission" },
          },
          update: {},
        });
    }
  }

  async getReferral(userId: string) {
    const enabled = this.config.FEATURE_REWARDS && this.config.FEATURE_REFERRAL_REWARDS;
    if (!enabled)
      return {
        enabled: false,
        code: null,
        bonusCents: this.config.REFERRAL_REWARD_MINOR,
        referrals: [],
      };
    const code = await this.ensureReferralCode(userId);
    const referrals = await this.prisma.referral.findMany({
      where: { referrerUserId: userId },
      select: { id: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return {
      enabled,
      code,
      bonusCents: this.config.REFERRAL_REWARD_MINOR,
      referrals: referrals.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    };
  }

  async registerReferral(referredUserId: string, codeInput: string) {
    if (!this.config.FEATURE_REWARDS || !this.config.FEATURE_REFERRAL_REWARDS)
      return { ok: false, reason: "disabled" };
    const code = codeInput.trim().toUpperCase();
    const referralCode = await this.prisma.referralCode.findFirst({
      where: { code, active: true },
      include: { user: { select: { email: true } } },
    });
    if (!referralCode) return { ok: false, reason: "invalid_code" };
    if (referralCode.userId === referredUserId) return { ok: false, reason: "self_referral" };
    const [existing, referred, count] = await Promise.all([
      this.prisma.referral.findUnique({ where: { referredUserId } }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: referredUserId },
        select: { email: true, createdAt: true },
      }),
      this.prisma.referral.count({ where: { referrerUserId: referralCode.userId } }),
    ]);
    if (existing) return { ok: false, reason: "already_registered" };
    if (count >= this.config.REFERRAL_MAX_PER_USER) return { ok: false, reason: "cap_reached" };
    const signals: string[] = [];
    if (emailDomain(referralCode.user.email) === emailDomain(referred.email))
      signals.push("same_email_domain");
    if (Date.now() - referred.createdAt.valueOf() < 86_400_000) signals.push("new_account");
    const row = await this.prisma.referral.create({
      data: {
        referrerUserId: referralCode.userId,
        referredUserId,
        code,
        riskMetadata: { signals, manualReview: signals.includes("same_email_domain") },
      },
    });
    await this.evaluateReferral(row.id);
    return { ok: true, reason: signals.length ? "pending_review" : "registered" };
  }

  async refreshReferrals(referrerUserId: string) {
    const rows = await this.prisma.referral.findMany({
      where: { referrerUserId, status: { in: ["PENDING", "QUALIFIED"] } },
      select: { id: true },
    });
    for (const row of rows) await this.evaluateReferral(row.id);
    return { refreshed: rows.length };
  }

  async evaluateReferral(referralId: string, manualApproval = false) {
    const referral = await this.prisma.referral.findUnique({
      where: { id: referralId },
      include: {
        referred: {
          select: {
            emailVerifiedAt: true,
            ownedLists: {
              where: { deletedAt: null },
              select: { id: true, _count: { select: { gifts: true } } },
            },
          },
        },
        referrer: {
          select: {
            ownedLists: {
              where: { deletedAt: null },
              orderBy: { createdAt: "asc" },
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    });
    if (!referral || ["REWARDED", "CANCELLED"].includes(referral.status)) return;
    const risk = referral.riskMetadata as { manualReview?: boolean } | null;
    if (risk?.manualReview && !manualApproval) return;
    if (
      !referral.referred.emailVerifiedAt ||
      !referral.referred.ownedLists.some((list) => list._count.gifts > 0)
    )
      return;
    const listId = referral.referrer.ownedLists[0]?.id;
    if (!listId) return;
    const wallet = await this.ensureWallet(listId);
    if (referral.status === "PENDING")
      await this.prisma.referral.update({
        where: { id: referral.id },
        data: { status: "QUALIFIED", qualifiedAt: new Date(), walletId: wallet.id },
      });
    await this.prisma.$transaction(async (tx) => {
      await tx.rewardTransaction.upsert({
        where: { idempotencyKey: `referral:${referral.id}` },
        create: {
          walletId: wallet.id,
          type: "REFERRAL",
          status: "CONFIRMED",
          amountMinor: BigInt(this.config.REFERRAL_REWARD_MINOR),
          idempotencyKey: `referral:${referral.id}`,
          sourceType: "referral",
          sourceId: referral.id,
          settledAt: new Date(),
          metadata: { description: "Parrainage qualifié" },
        },
        update: {},
      });
      await tx.referral.update({
        where: { id: referral.id },
        data: { status: "REWARDED", rewardedAt: new Date(), walletId: wallet.id },
      });
    });
  }

  async adminAdjustment(
    actorId: string,
    listId: string,
    amount: number,
    reason: string,
    requestId: string,
  ) {
    if (!this.config.FEATURE_REWARDS)
      throw new AppError(404, "REWARDS_DISABLED", "Rewards are disabled");
    const wallet = await this.ensureWallet(listId);
    const transaction = await this.prisma.rewardTransaction.create({
      data: {
        walletId: wallet.id,
        type: "ADJUSTMENT",
        status: "CONFIRMED",
        amountMinor: BigInt(amount),
        idempotencyKey: `admin-adjustment:${requestId}`,
        sourceType: "admin_adjustment",
        sourceId: requestId,
        settledAt: new Date(),
        metadata: { description: reason },
      },
    });
    await this.prisma.adminAuditLog.create({
      data: {
        actorId,
        action: "reward_adjustment_created",
        targetType: "reward_wallet",
        targetId: wallet.id,
        reason,
        after: { transactionId: transaction.id, amountMinor: amount },
        requestId,
      },
    });
    return transaction;
  }

  async adminGrant(
    actorId: string,
    listId: string,
    type: "PREMIUM_PURCHASE" | "PARTNER_BONUS" | "PROMOTIONAL_BONUS",
    amount: number,
    sourceId: string,
    reason: string,
    requestId: string,
  ) {
    if (!this.config.FEATURE_REWARDS)
      throw new AppError(404, "REWARDS_DISABLED", "Rewards are disabled");
    if (type === "PREMIUM_PURCHASE" && !this.config.FEATURE_PREMIUM_REWARDS)
      throw new AppError(404, "PREMIUM_REWARDS_DISABLED", "Premium rewards are disabled");
    if (type === "PARTNER_BONUS" && !this.config.FEATURE_PARTNER_REWARDS)
      throw new AppError(404, "PARTNER_REWARDS_DISABLED", "Partner rewards are disabled");
    const wallet = await this.ensureWallet(listId);
    const transaction = await this.prisma.rewardTransaction.upsert({
      where: { idempotencyKey: `grant:${type}:${sourceId}` },
      create: {
        walletId: wallet.id,
        type,
        status: "CONFIRMED",
        amountMinor: BigInt(amount),
        idempotencyKey: `grant:${type}:${sourceId}`,
        sourceType: type.toLowerCase(),
        sourceId,
        settledAt: new Date(),
        metadata: { description: reason },
      },
      update: {},
    });
    await this.prisma.adminAuditLog.create({
      data: {
        actorId,
        action: "reward_grant_created",
        targetType: "reward_wallet",
        targetId: wallet.id,
        reason,
        after: { transactionId: transaction.id, amountMinor: amount, type, sourceId },
        requestId,
      },
    });
    return transaction;
  }

  async reviewReferral(
    actorId: string,
    referralId: string,
    approve: boolean,
    reason: string,
    requestId: string,
  ) {
    const before = await this.prisma.referral.findUniqueOrThrow({ where: { id: referralId } });
    if (approve) await this.evaluateReferral(referralId, true);
    else
      await this.prisma.referral.update({
        where: { id: referralId },
        data: { status: "CANCELLED" },
      });
    const after = await this.prisma.referral.findUniqueOrThrow({ where: { id: referralId } });
    await this.prisma.adminAuditLog.create({
      data: {
        actorId,
        action: approve ? "referral_approved" : "referral_rejected",
        targetType: "referral",
        targetId: referralId,
        reason,
        before: { status: before.status },
        after: { status: after.status },
        requestId,
      },
    });
    return { status: after.status };
  }

  async reviewRedemption(
    actorId: string,
    redemptionId: string,
    approve: boolean,
    reason: string,
    requestId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const redemption = await tx.rewardRedemption.findUniqueOrThrow({
        where: { id: redemptionId },
      });
      if (redemption.status !== "REQUESTED")
        throw new AppError(
          409,
          "REDEMPTION_ALREADY_REVIEWED",
          "Redemption has already been reviewed",
        );
      const status = approve ? "APPROVED" : "REJECTED";
      await tx.rewardRedemption.update({
        where: { id: redemptionId },
        data: { status, processedAt: new Date() },
      });
      if (!approve)
        await tx.rewardTransaction.create({
          data: {
            walletId: redemption.walletId,
            type: "ADJUSTMENT",
            status: "CONFIRMED",
            amountMinor: redemption.amountMinor,
            currency: redemption.currency,
            idempotencyKey: `redemption-refund:${redemption.id}`,
            sourceType: "redemption_rejection",
            sourceId: redemption.id,
            settledAt: new Date(),
            metadata: { description: "Restitution après refus de conversion" },
          },
        });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: approve ? "redemption_approved" : "redemption_rejected",
          targetType: "reward_redemption",
          targetId: redemptionId,
          reason,
          before: { status: redemption.status },
          after: { status },
          requestId,
        },
      });
      return { status };
    });
  }

  async adminAnalytics() {
    const [commissions, transactions, wallets, referrals, redemptions] = await Promise.all([
      this.prisma.affiliateCommission.findMany({
        where: { status: "CONFIRMED" },
        select: { commissionMinor: true },
      }),
      this.prisma.rewardTransaction.findMany({
        where: { status: "CONFIRMED" },
        select: { amountMinor: true, type: true },
      }),
      this.prisma.rewardWallet.findMany({
        select: {
          flagged: true,
          transactions: { select: { status: true, amountMinor: true, type: true } },
        },
      }),
      this.prisma.referral.findMany({
        where: { status: "PENDING" },
        select: { riskMetadata: true },
      }),
      this.prisma.rewardRedemption.count({ where: { status: "REQUESTED" } }),
    ]);
    const revenue = sum(commissions.map((row) => row.commissionMinor));
    const cost = sum(
      transactions.filter((row) => row.amountMinor > 0n).map((row) => row.amountMinor),
    );
    return {
      confirmedRevenueCents: safeNumber(revenue),
      rewardsGrantedCents: safeNumber(cost),
      netMarginCents: safeNumber(revenue - cost),
      costRatio: revenue > 0n ? Number((cost * 10_000n) / revenue) / 100 : 0,
      flaggedWallets: wallets.filter((wallet) => wallet.flagged).length,
      negativeWallets: wallets.filter((wallet) => deriveBalance(wallet.transactions).available < 0)
        .length,
      referralsToReview: referrals.filter(
        (row) => (row.riskMetadata as { manualReview?: boolean } | null)?.manualReview,
      ).length,
      pendingRedemptions: redemptions,
    };
  }

  async adminReviewQueue() {
    const [referrals, redemptions] = await Promise.all([
      this.prisma.referral.findMany({
        where: { status: "PENDING" },
        select: { id: true, code: true, createdAt: true, riskMetadata: true },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
      this.prisma.rewardRedemption.findMany({
        where: { status: "REQUESTED" },
        select: {
          id: true,
          type: true,
          amountMinor: true,
          currency: true,
          createdAt: true,
          wallet: { select: { listId: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
    ]);
    return {
      referrals: referrals.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
      redemptions: redemptions.map((row) => ({
        id: row.id,
        type: row.type,
        amountCents: safeNumber(row.amountMinor),
        currency: row.currency,
        listId: row.wallet.listId,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  private async ensureWallet(listId: string) {
    return this.prisma.rewardWallet.upsert({
      where: { listId },
      create: { listId },
      update: {},
    });
  }

  private async ensureReferralCode(userId: string) {
    const existing = await this.prisma.referralCode.findUnique({ where: { userId } });
    if (existing) return existing.code;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomBytes(6).toString("base64url").toUpperCase().slice(0, 8);
      try {
        return (await this.prisma.referralCode.create({ data: { userId, code } })).code;
      } catch (error) {
        if (!isUniqueConstraint(error)) throw error;
      }
    }
    throw new AppError(503, "REFERRAL_CODE_UNAVAILABLE", "Could not create referral code");
  }

  private async rewardPolicy(): Promise<{
    networkRates?: Record<string, number>;
    campaignRates?: Record<string, number>;
    maxShareRateBps?: number;
    maxRewardMinor?: number;
  }> {
    const row = await this.prisma.featureFlag.findUnique({
      where: { key: "rewards" },
      select: { config: true },
    });
    if (!row?.config || typeof row.config !== "object" || Array.isArray(row.config)) return {};
    const value = row.config as Record<string, unknown>;
    const networkRates =
      value["networkRates"] &&
      typeof value["networkRates"] === "object" &&
      !Array.isArray(value["networkRates"])
        ? Object.fromEntries(
            Object.entries(value["networkRates"]).filter(
              (entry): entry is [string, number] =>
                Number.isInteger(entry[1]) &&
                (entry[1] as number) >= 0 &&
                (entry[1] as number) <= 10_000,
            ),
          )
        : undefined;
    return {
      networkRates,
      campaignRates: readRates(value, "campaignRates"),
      maxShareRateBps:
        typeof value["maxShareRateBps"] === "number"
          ? Math.max(0, Math.min(10_000, Math.trunc(value["maxShareRateBps"])))
          : undefined,
      maxRewardMinor:
        typeof value["maxRewardMinor"] === "number" && value["maxRewardMinor"] >= 0
          ? Math.trunc(value["maxRewardMinor"])
          : undefined,
    };
  }
}

export function deriveBalance(rows: LedgerRow[]) {
  const confirmed = rows.filter((row) => row.status === "CONFIRMED");
  return {
    available: safeNumber(sum(confirmed.map((row) => row.amountMinor))),
    pending: safeNumber(
      sum(rows.filter((row) => row.status === "PENDING").map((row) => row.amountMinor)),
    ),
    lifetimeEarned: safeNumber(
      sum(confirmed.filter((row) => row.amountMinor > 0n).map((row) => row.amountMinor)),
    ),
    lifetimeUsed: safeNumber(
      -sum(
        confirmed
          .filter((row) => row.type === "REDEMPTION" && row.amountMinor < 0n)
          .map((row) => row.amountMinor),
      ),
    ),
  };
}

function sum(values: bigint[]) {
  return values.reduce((total, value) => total + value, 0n);
}
function safeNumber(value: bigint) {
  const number = Number(value);
  if (!Number.isSafeInteger(number))
    throw new AppError(500, "MONEY_RANGE_EXCEEDED", "Money value exceeds API range");
  return number;
}
function metadataString(value: Prisma.JsonValue | null, key: string) {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value[key] === "string"
    ? value[key]
    : null;
}
function emailDomain(email: string) {
  return email.split("@")[1]?.toLowerCase() ?? "";
}
function readRates(
  value: Record<string, unknown>,
  key: string,
): Record<string, number> | undefined {
  const candidate = value[key];
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return undefined;
  return Object.fromEntries(
    Object.entries(candidate).filter(
      (entry): entry is [string, number] =>
        Number.isInteger(entry[1]) && (entry[1] as number) >= 0 && (entry[1] as number) <= 10_000,
    ),
  );
}
function isUniqueConstraint(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
