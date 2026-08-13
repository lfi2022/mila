import { AppError } from "../../common/errors/app-error.js";
import { normalizeUrl } from "../../common/security/external-url.js";
import type { AppConfig } from "../../config/env.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { ListsService } from "../lists/service.js";

export type RankedOfferInput = {
  id: string;
  priceMinor: bigint;
  deliveryMinor: bigint | null;
  currency: string;
  available: boolean | null;
  deliveryEtaDays: number | null;
  trustScore: number;
  matchConfidence: number;
  checkedAt: Date;
  affiliateEligible: boolean;
};

export function rankOffers(offers: RankedOfferInput[], currency: string, now = new Date()) {
  return offers
    .filter(
      (offer) =>
        offer.currency === currency &&
        offer.matchConfidence >= 80 &&
        now.getTime() - offer.checkedAt.getTime() <= 7 * 86_400_000,
    )
    .map((offer) => {
      const totalMinor = offer.priceMinor + (offer.deliveryMinor ?? 0n);
      const availabilityPenalty = offer.available === false ? 100_000_000n : 0n;
      const trustPenalty = BigInt(Math.max(0, 100 - offer.trustScore)) * 100n;
      const timingPenalty = BigInt(offer.deliveryEtaDays ?? 14) * 50n;
      return {
        ...offer,
        totalMinor,
        userValueScore: totalMinor + availabilityPenalty + trustPenalty + timingPenalty,
      };
    })
    .sort((left, right) =>
      left.userValueScore < right.userValueScore
        ? -1
        : left.userValueScore > right.userValueScore
          ? 1
          : left.id.localeCompare(right.id),
    );
}

export class PricesService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: AppConfig,
    private readonly lists: ListsService,
  ) {}

  async listTracking(userId: string, listId: string) {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    const [list, gifts] = await Promise.all([
      this.prisma.giftList.findUniqueOrThrow({
        where: { id: listId },
        select: {
          productAutoRefresh: true,
          autoUpdatePrice: true,
          autoSuggestBetterOffer: true,
          autoSwitchBetterOffer: true,
        },
      }),
      this.prisma.gift.findMany({
        where: { listId, deletedAt: null, url: { not: null } },
        include: {
          snapshots: { orderBy: { checkedAt: "desc" }, take: 20 },
          offers: { include: { merchant: true }, orderBy: { checkedAt: "desc" } },
          offerSwitches: { orderBy: { createdAt: "desc" }, take: 10 },
          merchant: true,
        },
        orderBy: { position: "asc" },
      }),
    ]);
    return {
      enabled: this.config.FEATURE_PRICE_TRACKING,
      comparisonEnabled: this.config.FEATURE_PRICE_COMPARISON,
      autoSwitchMinSavingsBps: this.config.PRICE_AUTO_SWITCH_MIN_SAVINGS_BPS,
      settings: list,
      gifts: gifts.map((gift) => {
        const latest = gift.snapshots[0];
        const reliable = Boolean(
          latest?.linkHealthy &&
          latest.priceMinor !== null &&
          gift.priceAtCreationMinor !== null &&
          latest.currency === gift.currency,
        );
        const ranked = rankOffers(
          gift.offers.map((offer) => ({
            id: offer.id,
            priceMinor: offer.priceMinor,
            deliveryMinor: offer.deliveryMinor,
            currency: offer.currency,
            available: offer.available,
            deliveryEtaDays: offer.deliveryEtaDays,
            trustScore: offer.merchant.offerTrustScore,
            matchConfidence: offer.matchConfidence,
            checkedAt: offer.checkedAt,
            affiliateEligible: offer.affiliateEligible,
          })),
          gift.currency,
        );
        return {
          id: gift.id,
          title: gift.title,
          currency: gift.currency,
          merchant: gift.merchant?.name ?? null,
          offerPreference: gift.offerPreference,
          priceAtCreationMinor: money(gift.priceAtCreationMinor),
          currentPriceMinor: money(latest?.priceMinor ?? gift.unitPriceMinor),
          differenceMinor:
            reliable && latest?.priceMinor != null && gift.priceAtCreationMinor !== null
              ? money(latest.priceMinor - gift.priceAtCreationMinor!)
              : null,
          comparisonReliable: reliable,
          availability: latest?.availability ?? gift.lastAvailability,
          linkHealthy: latest?.linkHealthy ?? gift.lastLinkHealthy,
          lastCheckedAt: latest?.checkedAt.toISOString() ?? null,
          nextRefreshAt: gift.nextRefreshAt?.toISOString() ?? null,
          priceAlertsEnabled: gift.priceAlertsEnabled,
          availabilityAlertsEnabled: gift.availabilityAlertsEnabled,
          deadLinkAlertsEnabled: gift.deadLinkAlertsEnabled,
          bestOffer:
            gift.offerPreference === "FIXED_MERCHANT" || !ranked[0]
              ? null
              : {
                  id: ranked[0].id,
                  totalMinor: money(ranked[0].totalMinor),
                  available: ranked[0].available,
                  deliveryEtaDays: ranked[0].deliveryEtaDays,
                },
          switchHistory: gift.offerSwitches.map((row) => ({
            id: row.id,
            fromPriceMinor: row.fromPriceMinor.toString(),
            toTotalMinor: row.toTotalMinor.toString(),
            savingsMinor: row.savingsMinor.toString(),
            reason: row.reason,
            createdAt: row.createdAt.toISOString(),
          })),
        };
      }),
    };
  }

  async updateListSettings(
    userId: string,
    listId: string,
    input: {
      productAutoRefresh?: boolean;
      autoUpdatePrice?: boolean;
      autoSuggestBetterOffer?: boolean;
      autoSwitchBetterOffer?: boolean;
    },
  ) {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    if (input.autoSwitchBetterOffer && !this.config.FEATURE_PRICE_COMPARISON)
      throw new AppError(409, "PRICE_COMPARISON_DISABLED", "Price comparison is disabled");
    return this.prisma.giftList.update({ where: { id: listId }, data: input });
  }

  async publicSuggestion(giftToken: string) {
    if (!this.config.FEATURE_PRICE_COMPARISON) return { enabled: false, suggestion: null };
    const gift = await this.prisma.gift.findFirst({
      where: {
        publicToken: giftToken,
        deletedAt: null,
        list: { status: "ACTIVE", deletedAt: null },
      },
      include: {
        list: true,
        snapshots: { orderBy: { checkedAt: "desc" }, take: 1 },
        offers: { include: { merchant: true } },
      },
    });
    if (!gift) throw new AppError(404, "GIFT_NOT_FOUND", "Gift not found");
    if (gift.offerPreference === "FIXED_MERCHANT" || !gift.list.autoSuggestBetterOffer)
      return { enabled: true, suggestion: null };
    const ranked = rankOffers(
      gift.offers.map((offer) => ({
        id: offer.id,
        priceMinor: offer.priceMinor,
        deliveryMinor: offer.deliveryMinor,
        currency: offer.currency,
        available: offer.available,
        deliveryEtaDays: offer.deliveryEtaDays,
        trustScore: offer.merchant.offerTrustScore,
        matchConfidence: offer.matchConfidence,
        checkedAt: offer.checkedAt,
        affiliateEligible: offer.affiliateEligible,
      })),
      gift.currency,
    );
    const best = ranked[0];
    const current = gift.snapshots[0]?.priceMinor ?? gift.unitPriceMinor;
    if (!best || best.available === false || (current !== null && best.totalMinor >= current))
      return { enabled: true, suggestion: null };
    const offer = gift.offers.find((row) => row.id === best.id)!;
    return {
      enabled: true,
      suggestion: {
        merchant: offer.merchant.name,
        totalMinor: best.totalMinor.toString(),
        currency: offer.currency,
        deliveryEtaDays: offer.deliveryEtaDays,
        automatic: gift.offerPreference === "AUTO_BEST" && gift.list.autoSwitchBetterOffer,
      },
    };
  }

  async updatePreferences(
    userId: string,
    listId: string,
    giftId: string,
    input: {
      priceAlertsEnabled?: boolean;
      availabilityAlertsEnabled?: boolean;
      deadLinkAlertsEnabled?: boolean;
      offerPreference?: "FIXED_MERCHANT" | "SUGGEST_BEST" | "AUTO_BEST";
    },
  ) {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    const gift = await this.prisma.gift.findFirst({
      where: { id: giftId, listId, deletedAt: null },
      select: { id: true },
    });
    if (!gift) throw new AppError(404, "GIFT_NOT_FOUND", "Gift not found");
    if (input.offerPreference === "AUTO_BEST" && !this.config.FEATURE_PRICE_COMPARISON)
      throw new AppError(409, "PRICE_COMPARISON_DISABLED", "Price comparison is disabled");
    return this.prisma.gift.update({ where: { id: giftId }, data: input });
  }

  async upsertControlledOffer(input: {
    giftId: string;
    merchantId: string;
    url: string;
    sku?: string;
    priceMinor: string;
    deliveryMinor?: string;
    currency: string;
    available?: boolean;
    deliveryEtaDays?: number;
    matchConfidence: number;
    matchMethod: "GTIN" | "EAN" | "MPN" | "BRAND_MODEL" | "MANUAL_VERIFIED";
    source: "OFFICIAL_API" | "AFFILIATE_FEED" | "MANUAL";
    affiliateEligible: boolean;
  }) {
    const url = normalizeUrl(input.url).toString();
    const gift = await this.prisma.gift.findUnique({
      where: { id: input.giftId },
      select: { id: true, productIdentityId: true },
    });
    if (!gift?.productIdentityId)
      throw new AppError(409, "PRODUCT_IDENTITY_REQUIRED", "Gift has no controlled identity");
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: input.merchantId },
      include: { domains: true },
    });
    if (!merchant?.active) throw new AppError(404, "MERCHANT_NOT_FOUND", "Merchant not found");
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (
      !merchant.domains.some(
        (domain) => hostname === domain.domain || hostname.endsWith(`.${domain.domain}`),
      )
    )
      throw new AppError(400, "MERCHANT_DOMAIN_MISMATCH", "Offer URL is outside merchant domains");
    const existing = await this.prisma.merchantOffer.findFirst({
      where: { productIdentityId: gift.productIdentityId, merchantId: merchant.id, url },
      select: { id: true },
    });
    const data = {
      giftId: gift.id,
      productIdentityId: gift.productIdentityId,
      merchantId: merchant.id,
      url,
      sku: input.sku?.trim() || null,
      priceMinor: BigInt(input.priceMinor),
      deliveryMinor: input.deliveryMinor ? BigInt(input.deliveryMinor) : null,
      currency: input.currency,
      available: input.available,
      deliveryEtaDays: input.deliveryEtaDays,
      matchConfidence: input.matchConfidence,
      matchMethod: input.matchMethod,
      source: input.source,
      affiliateEligible: input.affiliateEligible,
      checkedAt: new Date(),
    };
    return existing
      ? this.prisma.merchantOffer.update({ where: { id: existing.id }, data })
      : this.prisma.merchantOffer.create({ data });
  }
}

function money(value: bigint | null | undefined) {
  return value === null || value === undefined ? null : value.toString();
}
