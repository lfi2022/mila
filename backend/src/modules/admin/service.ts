import { AppError } from "../../common/errors/app-error.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

export class AdminService {
  constructor(private readonly prisma: PrismaClient) {}

  async overview() {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const since7 = new Date(Date.now() - 7 * 86_400_000);
    const [
      users,
      newUsers,
      activeUsers,
      lists,
      gifts,
      reservations,
      clicks,
      recentClicks,
      entitlements,
      reports,
      merchants,
      contributions,
      payments,
      commissions,
      rewards,
      revenueEntries,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: since30 } } }),
      this.prisma.user.count({
        where: {
          OR: [
            { sessions: { some: { lastSeenAt: { gte: since30 } } } },
            { reservations: { some: { createdAt: { gte: since30 } } } },
          ],
        },
      }),
      this.prisma.giftList.groupBy({ by: ["status", "visibility"], _count: true }),
      this.prisma.gift.groupBy({ by: ["status"], _count: true }),
      this.prisma.reservation.count(),
      this.prisma.affiliateClick.findMany({ select: { merchantId: true } }),
      this.prisma.affiliateClick.count({ where: { createdAt: { gte: since7 } } }),
      this.prisma.listEntitlement.count({ where: { plan: { not: "FREE" } } }),
      this.prisma.report.groupBy({ by: ["status"], _count: true }),
      this.prisma.merchant.findMany({ select: { id: true, name: true, affiliationEnabled: true } }),
      this.prisma.contribution.groupBy({ by: ["status"], _count: true }),
      this.prisma.payment.groupBy({ by: ["status"], _count: true }),
      this.prisma.affiliateCommission.aggregate({
        where: { status: "CONFIRMED" },
        _sum: { commissionMinor: true },
      }),
      this.prisma.rewardTransaction.aggregate({
        where: { status: "CONFIRMED", amountMinor: { gt: 0 } },
        _sum: { amountMinor: true },
      }),
      this.prisma.financialLedgerEntry.groupBy({
        by: ["type", "currency"],
        where: { status: "CONFIRMED" },
        _sum: { amountMinor: true },
      }),
    ]);
    const listCount = (status?: string, visibility?: string) =>
      lists
        .filter(
          (row) =>
            (!status || row.status === status) && (!visibility || row.visibility === visibility),
        )
        .reduce((sum, row) => sum + row._count, 0);
    const giftCount = (status?: string) =>
      gifts
        .filter((row) => !status || row.status === status)
        .reduce((sum, row) => sum + row._count, 0);
    const reportCount = (status?: string) =>
      reports
        .filter((row) => !status || row.status === status)
        .reduce((sum, row) => sum + row._count, 0);
    const clicksByMerchant = merchants
      .map((merchant) => ({
        merchant: merchant.name,
        clicks: clicks.filter((row) => row.merchantId === merchant.id).length,
        affiliateClicks: merchant.affiliationEnabled
          ? clicks.filter((row) => row.merchantId === merchant.id).length
          : 0,
      }))
      .filter((row) => row.clicks)
      .sort((a, b) => b.clicks - a.clicks);
    return {
      users: { total: users, newLast30Days: newUsers, activeLast30Days: activeUsers },
      lists: {
        total: listCount(),
        active: listCount("ACTIVE"),
        archived: listCount("ARCHIVED"),
        suspended: listCount("SUSPENDED"),
        public: listCount(undefined, "PUBLIC"),
        private: listCount() - listCount(undefined, "PUBLIC"),
        premium: entitlements,
      },
      gifts: {
        total: giftCount(),
        available: giftCount("AVAILABLE"),
        reserved: giftCount("RESERVED"),
        purchased: giftCount("ORDERED") + giftCount("SHIPPED") + giftCount("RECEIVED"),
      },
      business: {
        merchantClicks: clicks.length,
        affiliateClicks: clicks.filter((click) =>
          merchants.some(
            (merchant) => merchant.id === click.merchantId && merchant.affiliationEnabled,
          ),
        ).length,
        clicksLast7Days: recentClicks,
        clicksByMerchant,
        premiumLists: entitlements,
        premiumRevenue: ledgerByType(revenueEntries, "PREMIUM_REVENUE"),
        confirmedCommissions: money(commissions._sum.commissionMinor),
        rewardCost: money(rewards._sum.amountMinor),
      },
      operations: {
        reservations,
        contributions: Object.fromEntries(contributions.map((row) => [row.status, row._count])),
        payments: Object.fromEntries(payments.map((row) => [row.status, row._count])),
        merchants: merchants.length,
      },
      moderation: {
        openReports: reportCount("OPEN") + reportCount("REVIEWING"),
        totalReports: reportCount(),
      },
    };
  }

  async lists(skip: number, take: number) {
    return this.prisma.giftList.findMany({
      skip,
      take,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        visibility: true,
        createdAt: true,
        _count: { select: { gifts: true, reservations: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }
  async users(skip: number, take: number) {
    return this.prisma.user.findMany({
      skip,
      take,
      select: {
        id: true,
        displayName: true,
        email: true,
        createdAt: true,
        suspendedAt: true,
        deletedAt: true,
        roles: { select: { role: true } },
        _count: { select: { ownedLists: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }
  async reports(skip: number, take: number) {
    return this.prisma.report.findMany({ skip, take, orderBy: { createdAt: "desc" } });
  }
  async audit(skip: number, take: number) {
    return this.prisma.adminAuditLog.findMany({ skip, take, orderBy: { createdAt: "desc" } });
  }
  async risks(skip: number, take: number) {
    return this.prisma.riskReview.findMany({
      skip,
      take,
      orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    });
  }
  async partners(skip: number, take: number) {
    const partners = await this.prisma.partner.findMany({
      skip,
      take,
      include: {
        _count: { select: { attributions: true } },
        campaigns: {
          select: {
            id: true,
            code: true,
            name: true,
            active: true,
            startsAt: true,
            endsAt: true,
            budgetMinor: true,
            currency: true,
            _count: { select: { attributions: true } },
            ledgerEntries: { select: { kind: true, amountMinor: true, currency: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return partners.map((partner) => ({
      ...partner,
      campaigns: partner.campaigns.map((campaign) => ({
        ...campaign,
        costsMinor: campaign.ledgerEntries
          .filter((entry) => ["BENEFIT_COST", "REWARD_COST"].includes(entry.kind))
          .reduce((sum, entry) => sum + entry.amountMinor, 0n),
        revenueMinor: campaign.ledgerEntries
          .filter((entry) => entry.kind === "REVENUE")
          .reduce((sum, entry) => sum + entry.amountMinor, 0n),
        ledgerEntries: undefined,
      })),
    }));
  }
  async productAnalytics(days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const [
      events,
      users,
      lists,
      gifts,
      reservations,
      purchases,
      commissions,
      premium,
      referrals,
      activeFamilies,
    ] = await Promise.all([
      this.prisma.productAnalyticsEvent.groupBy({
        by: ["event"],
        where: { occurredAt: { gte: since } },
        _count: true,
      }),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.giftList.count({ where: { createdAt: { gte: since } } }),
      this.prisma.gift.count({ where: { createdAt: { gte: since } } }),
      this.prisma.reservation.count({
        where: { createdAt: { gte: since }, status: { not: "CANCELLED" } },
      }),
      this.prisma.reservation.count({ where: { purchasedAt: { gte: since } } }),
      this.prisma.affiliateCommission.aggregate({
        where: { status: "CONFIRMED", confirmedAt: { gte: since } },
        _sum: { commissionMinor: true },
      }),
      this.prisma.payment.count({
        where: { status: "PAID", paidAt: { gte: since }, entitlement: { isNot: null } },
      }),
      this.prisma.referral.count({ where: { createdAt: { gte: since } } }),
      this.prisma.giftList.count({
        where: {
          reservations: { some: { createdAt: { gte: since }, status: { not: "CANCELLED" } } },
        },
      }),
    ]);
    const funnel = Object.fromEntries(events.map((row) => [row.event, row._count]));
    const visitors = funnel["homepage_view"] ?? 0;
    const signupStarted = funnel["signup_started"] ?? 0;
    const signupCompleted = funnel["signup_completed"] ?? 0;
    return {
      periodDays: days,
      funnel,
      kpis: {
        consentedVisitors: visitors,
        signupConversionRate: visitors ? signupCompleted / visitors : null,
        signupStartedConversionRate: signupStarted ? signupCompleted / signupStarted : null,
        usersCreated: users,
        listsCreated: lists,
        activationRate: lists ? activeFamilies / lists : null,
        giftsCreated: gifts,
        giftsPerList: lists ? gifts / lists : null,
        reservations,
        purchasedReservations: purchases,
        listsWithReservation: activeFamilies,
        confirmedCommissionMinor: money(commissions._sum.commissionMinor),
        premiumActivations: premium,
        referrals,
        gmvObservableMinor: null,
        revenuePerListMinor: null,
        retentionRate: null,
      },
      notes: {
        gmvObservableMinor:
          "Unavailable until authorized order/purchase values are consistently captured",
        revenuePerListMinor: "Computed only after accounting policy defines eligible revenue",
        retentionRate: "Requires a longer production cohort window",
      },
    };
  }
  async reviewRisk(
    actorId: string,
    requestId: string,
    riskId: string,
    status: "RESOLVED" | "DISMISSED",
    resolution: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.riskReview.findUnique({
        where: { id: riskId },
        select: { status: true, resolution: true },
      });
      if (!before) throw new AppError(404, "RISK_REVIEW_NOT_FOUND", "Risk review not found");
      const after = await tx.riskReview.update({
        where: { id: riskId },
        data: { status, resolution, reviewedById: actorId, reviewedAt: new Date() },
        select: { status: true, resolution: true },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: `risk.${status.toLowerCase()}`,
          targetType: "risk_review",
          targetId: riskId,
          reason: resolution,
          before,
          after,
          requestId,
        },
      });
      return after;
    });
  }

  async moderate(
    actorId: string,
    requestId: string,
    action: string,
    targetId: string,
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      let targetType = "moderation";
      let before: unknown;
      let after: unknown;
      if (["suspend_list", "restore_list"].includes(action)) {
        targetType = "list";
        before = await tx.giftList.findUnique({
          where: { id: targetId },
          select: { status: true },
        });
        if (!before) throw new AppError(404, "LIST_NOT_FOUND", "List not found");
        after = await tx.giftList.update({
          where: { id: targetId },
          data: { status: action === "suspend_list" ? "SUSPENDED" : "ACTIVE" },
          select: { status: true },
        });
      } else if (["hide_item", "show_item"].includes(action)) {
        targetType = "gift";
        before = await tx.gift.findUnique({
          where: { id: targetId },
          select: { hiddenByModerator: true },
        });
        if (!before) throw new AppError(404, "GIFT_NOT_FOUND", "Gift not found");
        after = await tx.gift.update({
          where: { id: targetId },
          data: { hiddenByModerator: action === "hide_item" },
          select: { hiddenByModerator: true },
        });
      } else if (["resolve_report", "dismiss_report", "review_report"].includes(action)) {
        targetType = "report";
        before = await tx.report.findUnique({
          where: { id: targetId },
          select: { status: true, resolution: true },
        });
        if (!before) throw new AppError(404, "REPORT_NOT_FOUND", "Report not found");
        after = await tx.report.update({
          where: { id: targetId },
          data: {
            status:
              action === "resolve_report"
                ? "RESOLVED"
                : action === "dismiss_report"
                  ? "DISMISSED"
                  : "REVIEWING",
            resolution: reason,
          },
          select: { status: true, resolution: true },
        });
      } else if (["suspend_user", "restore_user"].includes(action)) {
        targetType = "user";
        before = await tx.user.findUnique({
          where: { id: targetId },
          select: { suspendedAt: true },
        });
        if (!before) throw new AppError(404, "USER_NOT_FOUND", "User not found");
        after = await tx.user.update({
          where: { id: targetId },
          data: { suspendedAt: action === "suspend_user" ? new Date() : null },
          select: { suspendedAt: true },
        });
        if (action === "suspend_user")
          await tx.session.updateMany({
            where: { userId: targetId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
      } else throw new AppError(400, "MODERATION_ACTION_INVALID", "Unknown moderation action");
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action,
          targetType,
          targetId,
          reason,
          before: before as Prisma.InputJsonValue,
          after: after as Prisma.InputJsonValue,
          requestId,
        },
      });
      return { ok: true };
    });
  }
}

function money(value: bigint | null | undefined) {
  return (value ?? 0n).toString();
}
function ledgerByType(
  rows: Array<{ type: string; currency: string; _sum: { amountMinor: bigint | null } }>,
  type: string,
) {
  return rows
    .filter((row) => row.type === type)
    .map((row) => ({ currency: row.currency, amountMinor: money(row._sum.amountMinor) }));
}
