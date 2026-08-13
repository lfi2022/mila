import { createHmac, randomBytes } from "node:crypto";

import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

export type PartnerInput = {
  slug: string;
  name: string;
  category: string;
  summary?: string | null;
  websiteUrl?: string | null;
  landingTitle?: string | null;
  landingBody?: string | null;
  region?: string | null;
  contractReference?: string | null;
};

export type CampaignInput = {
  partnerId: string;
  code: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  benefit: { title: string; description: string; rewardMinor?: number };
  budgetMinor?: bigint | null;
  currency: string;
  conditions?: Record<string, string | number | boolean> | null;
};

export class PartnersService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: AppConfig,
  ) {}

  async landing(slug: string, campaignCode?: string) {
    const now = new Date();
    const partner = await this.prisma.partner.findFirst({
      where: { slug, status: "ACTIVE", contractReference: { not: null } },
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        summary: true,
        websiteUrl: true,
        landingTitle: true,
        landingBody: true,
        region: true,
        campaigns: {
          where: {
            active: true,
            startsAt: { lte: now },
            endsAt: { gte: now },
            ...(campaignCode ? { code: campaignCode } : {}),
          },
          select: {
            id: true,
            code: true,
            name: true,
            benefit: true,
            budgetMinor: true,
            currency: true,
            endsAt: true,
            ledgerEntries: {
              where: { kind: { in: ["BENEFIT_COST", "REWARD_COST"] } },
              select: { amountMinor: true },
            },
          },
          orderBy: { startsAt: "desc" },
        },
      },
    });
    if (!partner) throw new AppError(404, "PARTNER_NOT_FOUND", "Partner page not found");
    const campaign = partner.campaigns.find((candidate) => {
      if (candidate.budgetMinor === null) return true;
      const spent = candidate.ledgerEntries.reduce((sum, row) => sum + row.amountMinor, 0n);
      return spent < candidate.budgetMinor;
    });
    if (campaignCode && !campaign)
      throw new AppError(404, "CAMPAIGN_NOT_FOUND", "Partner campaign not found");

    return {
      partner: {
        slug: partner.slug,
        name: partner.name,
        category: partner.category,
        summary: partner.summary,
        websiteUrl: partner.websiteUrl,
        landingTitle: partner.landingTitle,
        landingBody: partner.landingBody,
        region: partner.region,
      },
      campaign: campaign
        ? {
            code: campaign.code,
            name: campaign.name,
            benefit: campaign.benefit,
            currency: campaign.currency,
            endsAt: campaign.endsAt,
          }
        : null,
    };
  }

  async startAttribution(slug: string, campaignCode: string | undefined, channel: "LINK" | "QR") {
    const landing = await this.landing(slug, campaignCode);
    const partner = await this.prisma.partner.findUniqueOrThrow({ where: { slug } });
    const campaign = landing.campaign
      ? await this.prisma.partnerCampaign.findUniqueOrThrow({
          where: { code: landing.campaign.code },
        })
      : null;
    const token = randomBytes(32).toString("base64url");
    await this.prisma.partnerAttribution.create({
      data: {
        partnerId: partner.id,
        campaignId: campaign?.id,
        tokenHash: this.hash(token),
        channel,
        expiresAt: new Date(Date.now() + 30 * 86_400_000),
      },
    });
    return token;
  }

  async createPartner(actorId: string, requestId: string, input: PartnerInput, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const partner = await tx.partner.create({ data: input });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: "partner.created",
          targetType: "partner",
          targetId: partner.id,
          reason,
          after: input as Prisma.InputJsonValue,
          requestId,
        },
      });
      return partner;
    });
  }

  async createCampaign(actorId: string, requestId: string, input: CampaignInput, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.partnerCampaign.create({
        data: {
          ...input,
          benefit: input.benefit,
          conditions: input.conditions ?? undefined,
          active: false,
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: "partner_campaign.created",
          targetType: "partner_campaign",
          targetId: campaign.id,
          reason,
          after: {
            code: input.code,
            partnerId: input.partnerId,
            budgetMinor: input.budgetMinor?.toString() ?? null,
          },
          requestId,
        },
      });
      return campaign;
    });
  }

  async setPartnerStatus(
    actorId: string,
    requestId: string,
    partnerId: string,
    status: "ACTIVE" | "INACTIVE",
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.partner.findUnique({ where: { id: partnerId } });
      if (!before) throw new AppError(404, "PARTNER_NOT_FOUND", "Partner not found");
      if (status === "ACTIVE" && !before.contractReference)
        throw new AppError(409, "PARTNER_CONTRACT_REQUIRED", "A contract reference is required");
      const after = await tx.partner.update({ where: { id: partnerId }, data: { status } });
      if (status === "INACTIVE")
        await tx.partnerCampaign.updateMany({ where: { partnerId }, data: { active: false } });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: `partner.${status.toLowerCase()}`,
          targetType: "partner",
          targetId: partnerId,
          reason,
          before: { status: before.status },
          after: { status },
          requestId,
        },
      });
      return after;
    });
  }

  async setCampaignActive(
    actorId: string,
    requestId: string,
    campaignId: string,
    active: boolean,
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.partnerCampaign.findUnique({
        where: { id: campaignId },
        include: { partner: true },
      });
      if (!before) throw new AppError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found");
      if (active && (before.partner.status !== "ACTIVE" || !before.partner.contractReference))
        throw new AppError(
          409,
          "PARTNER_CONTRACT_REQUIRED",
          "An active contracted partner is required",
        );
      if (active && before.endsAt <= new Date())
        throw new AppError(409, "CAMPAIGN_EXPIRED", "An expired campaign cannot be activated");
      const after = await tx.partnerCampaign.update({
        where: { id: campaignId },
        data: { active },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: active ? "partner_campaign.activated" : "partner_campaign.deactivated",
          targetType: "partner_campaign",
          targetId: campaignId,
          reason,
          before: { active: before.active },
          after: { active },
          requestId,
        },
      });
      return after;
    });
  }

  async recordLedger(
    actorId: string,
    requestId: string,
    campaignId: string,
    input: {
      kind: "BENEFIT_COST" | "REWARD_COST" | "REVENUE";
      amountMinor: bigint;
      currency: string;
      idempotencyKey: string;
      attributionId?: string;
      note?: string;
    },
    reason: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const campaign = await tx.partnerCampaign.findUnique({ where: { id: campaignId } });
        if (!campaign) throw new AppError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found");
        if (campaign.currency !== input.currency)
          throw new AppError(409, "CAMPAIGN_CURRENCY_MISMATCH", "Campaign currency mismatch");
        if (input.attributionId) {
          const attribution = await tx.partnerAttribution.findFirst({
            where: { id: input.attributionId, campaignId },
            select: { id: true },
          });
          if (!attribution)
            throw new AppError(
              409,
              "CAMPAIGN_ATTRIBUTION_MISMATCH",
              "Attribution does not belong to campaign",
            );
        }
        if (input.kind !== "REVENUE" && campaign.budgetMinor !== null) {
          const costs = await tx.partnerCampaignLedgerEntry.aggregate({
            where: { campaignId, kind: { in: ["BENEFIT_COST", "REWARD_COST"] } },
            _sum: { amountMinor: true },
          });
          if ((costs._sum.amountMinor ?? 0n) + input.amountMinor > campaign.budgetMinor)
            throw new AppError(409, "CAMPAIGN_BUDGET_EXCEEDED", "Campaign budget exceeded");
        }
        const entry = await tx.partnerCampaignLedgerEntry.create({
          data: { campaignId, ...input },
        });
        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: "partner_campaign.ledger_recorded",
            targetType: "partner_campaign",
            targetId: campaignId,
            reason,
            after: {
              entryId: entry.id,
              kind: input.kind,
              amountMinor: input.amountMinor.toString(),
              currency: input.currency,
            },
            requestId,
          },
        });
        return entry;
      },
      { isolationLevel: "Serializable" },
    );
  }

  hash(value: string) {
    return createHmac("sha256", this.config.AUTH_SECRET).update(value).digest("hex");
  }
}
