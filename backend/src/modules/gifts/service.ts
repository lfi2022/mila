import { randomBytes } from "node:crypto";

import { AppError } from "../../common/errors/app-error.js";
import { normalizeUrl } from "../../common/security/external-url.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type {
  GiftKind,
  GiftStatus,
  OfferPreference,
  SecondHandPolicy,
} from "../../generated/prisma/enums.js";
import { ListsService } from "../lists/service.js";
import type { ProductRefreshQueue } from "../products/refresh-queue.js";

export type GiftInput = {
  title: string;
  description?: string | null;
  kind: GiftKind;
  status?: GiftStatus;
  url?: string | null;
  canonicalUrl?: string | null;
  sku?: string | null;
  currency?: string;
  unitPriceMinor?: string | null;
  quantity?: number;
  contributionTargetMinor?: string | null;
  secondHandPolicy?: SecondHandPolicy;
  offerPreference?: OfferPreference;
  position?: number;
  image?: { url: string; source: "OFFICIAL_API" | "AFFILIATE_FEED" | "REMOTE" } | null;
  identity?: {
    gtin?: string | null;
    ean?: string | null;
    mpn?: string | null;
    brand?: string | null;
    model?: string | null;
  } | null;
};

export class GiftsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly lists: ListsService,
    private readonly refreshQueue?: ProductRefreshQueue,
  ) {}

  async list(userId: string, listId: string) {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    return this.prisma.gift.findMany({
      where: { listId, deletedAt: null },
      include: {
        images: { where: { status: "ACTIVE" }, orderBy: { position: "asc" } },
        merchant: true,
        productIdentity: true,
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
  }

  async create(userId: string, listId: string, input: GiftInput) {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    const urls = normalizeUrls(input);
    const merchantId = urls.url ? await this.matchMerchant(new URL(urls.url).hostname) : null;
    const gift = await this.prisma.$transaction(async (transaction) => {
      const identity =
        input.identity && hasIdentity(input.identity)
          ? await controlledIdentity(transaction, input.identity)
          : null;
      return transaction.gift.create({
        data: {
          listId,
          merchantId,
          productIdentityId: identity?.id,
          publicToken: randomBytes(32).toString("hex"),
          ...giftData(input),
          title: input.title.trim(),
          kind: input.kind,
          ...urls,
          priceAtCreationMinor: minor(input.unitPriceMinor),
          images: input.image
            ? {
                create: {
                  merchantId,
                  sourceUrl: normalizeUrl(input.image.url).toString(),
                  sourceType: input.image.source,
                  usagePolicy: usagePolicy(input.image.source),
                  attributionRequired: input.image.source === "REMOTE",
                },
              }
            : undefined,
        },
        include: { images: true, merchant: true, productIdentity: true },
      });
    });
    if (gift.url && this.refreshQueue) {
      await this.refreshQueue.enqueue(
        gift.id,
        ["metadata", "price", "stock", "link", "authorized-image"],
        "gift-created",
      );
    }
    return gift;
  }

  async update(userId: string, listId: string, giftId: string, input: Partial<GiftInput>) {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    await this.requireGift(listId, giftId);
    return this.prisma.gift.update({
      where: { id: giftId },
      data: { ...giftData(input), ...normalizeUrls(input) },
      include: { images: true, merchant: true, productIdentity: true },
    });
  }

  async remove(userId: string, listId: string, giftId: string): Promise<void> {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    await this.requireGift(listId, giftId);
    await this.prisma.gift.update({
      where: { id: giftId },
      data: { deletedAt: new Date(), status: "CANCELLED" },
    });
  }

  async reorder(userId: string, listId: string, giftIds: string[]): Promise<void> {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    const count = await this.prisma.gift.count({
      where: { listId, id: { in: giftIds }, deletedAt: null },
    });
    if (count !== giftIds.length || new Set(giftIds).size !== giftIds.length) {
      throw new AppError(
        400,
        "GIFT_ORDER_INVALID",
        "Gift order contains unknown or duplicate entries",
      );
    }
    await this.prisma.$transaction(
      giftIds.map((id, position) => this.prisma.gift.update({ where: { id }, data: { position } })),
    );
  }

  private async requireGift(listId: string, giftId: string) {
    const gift = await this.prisma.gift.findFirst({
      where: { id: giftId, listId, deletedAt: null },
      select: { id: true },
    });
    if (!gift) throw new AppError(404, "GIFT_NOT_FOUND", "Gift not found");
  }

  private async matchMerchant(hostname: string): Promise<string | null> {
    const parts = hostname
      .toLowerCase()
      .replace(/^www\./, "")
      .split(".");
    const candidates = parts.map((_, index) => parts.slice(index).join("."));
    return (
      (
        await this.prisma.merchantDomain.findFirst({
          where: { domain: { in: candidates }, merchant: { active: true } },
          select: { merchantId: true },
        })
      )?.merchantId ?? null
    );
  }
}

function giftData(input: Partial<GiftInput>) {
  return {
    ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
    ...(input.kind !== undefined ? { kind: input.kind } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.sku !== undefined ? { sku: input.sku?.trim() || null } : {}),
    ...(input.currency !== undefined ? { currency: input.currency.toUpperCase() } : {}),
    ...(input.unitPriceMinor !== undefined ? { unitPriceMinor: minor(input.unitPriceMinor) } : {}),
    ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
    ...(input.contributionTargetMinor !== undefined
      ? { contributionTargetMinor: minor(input.contributionTargetMinor) }
      : {}),
    ...(input.secondHandPolicy !== undefined ? { secondHandPolicy: input.secondHandPolicy } : {}),
    ...(input.offerPreference !== undefined ? { offerPreference: input.offerPreference } : {}),
    ...(input.position !== undefined ? { position: input.position } : {}),
  };
}
function normalizeUrls(input: Partial<GiftInput>) {
  return {
    ...(input.url !== undefined
      ? { url: input.url ? normalizeUrl(input.url).toString() : null }
      : {}),
    ...(input.canonicalUrl !== undefined
      ? { canonicalUrl: input.canonicalUrl ? normalizeUrl(input.canonicalUrl).toString() : null }
      : {}),
  };
}
function minor(value: string | null | undefined): bigint | null {
  return value == null ? null : BigInt(value);
}
function hasIdentity(value: NonNullable<GiftInput["identity"]>) {
  return Object.values(value).some(Boolean);
}
function compactIdentity(value: NonNullable<GiftInput["identity"]>) {
  const compact = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, item?.trim() || null]),
  );
  return { ...compact, identityKey: identityKey(value) };
}
function identityKey(value: NonNullable<GiftInput["identity"]>) {
  const normalize = (item: string | null | undefined) =>
    item
      ?.trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "") || null;
  const gtin = normalize(value.gtin);
  if (gtin) return `GTIN:${gtin}`;
  const ean = normalize(value.ean);
  if (ean) return `EAN:${ean}`;
  const mpn = normalize(value.mpn);
  const brand = normalize(value.brand);
  if (mpn && brand) return `MPN:${brand}:${mpn}`;
  const model = normalize(value.model);
  return brand && model ? `MODEL:${brand}:${model}` : null;
}
async function controlledIdentity(
  transaction: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  value: NonNullable<GiftInput["identity"]>,
) {
  const data = compactIdentity(value);
  if (data.identityKey) {
    const existing = await transaction.productIdentity.findUnique({
      where: { identityKey: data.identityKey },
    });
    if (existing) return existing;
  }
  return transaction.productIdentity.create({ data });
}
function usagePolicy(source: NonNullable<GiftInput["image"]>["source"]) {
  return source === "OFFICIAL_API"
    ? ("OFFICIAL_API" as const)
    : source === "AFFILIATE_FEED"
      ? ("AFFILIATE_FEED" as const)
      : ("MANUAL_REVIEW_REQUIRED" as const);
}
