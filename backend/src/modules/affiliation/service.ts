import { createHmac, randomBytes } from "node:crypto";

import { AppError } from "../../common/errors/app-error.js";
import { normalizeUrl } from "../../common/security/external-url.js";
import type { AppConfig } from "../../config/env.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

export type CommissionInput = {
  network: string;
  externalId: string;
  clickToken?: string;
  orderReference?: string;
  orderAmountMinor?: string;
  commissionMinor: string;
  currency: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  occurredAt: string;
};

export class AffiliationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: AppConfig,
  ) {}

  async redirect(giftToken: string, ip: string, source?: string) {
    const gift = await this.prisma.gift.findFirst({
      where: {
        publicToken: giftToken,
        deletedAt: null,
        hiddenByModerator: false,
        url: { not: null },
        list: { status: "ACTIVE", deletedAt: null },
      },
      select: {
        id: true,
        listId: true,
        url: true,
        merchantId: true,
        merchant: { include: { domains: { select: { domain: true } } } },
      },
    });
    if (!gift?.url) throw new AppError(404, "OUTGOING_LINK_NOT_FOUND", "Link not found");
    const original = normalizeUrl(gift.url);
    if (
      gift.merchant &&
      !matchesDomain(
        original.hostname,
        gift.merchant.domains.map((row) => row.domain),
      )
    ) {
      throw new AppError(
        400,
        "MERCHANT_DESTINATION_REJECTED",
        "Merchant destination is not allowed",
      );
    }
    const clickToken = randomBytes(32).toString("hex");
    const destination = this.outgoing(original, gift.merchant, clickToken);
    const click = await this.prisma.affiliateClick.create({
      data: {
        token: clickToken,
        listId: gift.listId,
        giftId: gift.id,
        merchantId: gift.merchantId,
        source: source?.slice(0, 120),
        anonymousReference: createHmac("sha256", this.config.AUTH_SECRET)
          .update(`${new Date().toISOString().slice(0, 10)}:${ip}`)
          .digest("hex"),
        destinationUrl: original.toString(),
        affiliateApplied: destination.toString() !== original.toString(),
      },
    });
    return { url: destination.toString(), clickToken: click.token };
  }

  async ingest(input: CommissionInput) {
    const occurredAt = new Date(input.occurredAt);
    if (Number.isNaN(occurredAt.valueOf()))
      throw new AppError(400, "EVENT_DATE_INVALID", "Invalid event date");
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.affiliateCommission.findUnique({
        where: { network_externalId: { network: input.network, externalId: input.externalId } },
      });
      if (existing && existing.occurredAt && existing.occurredAt > occurredAt) return existing;
      if (
        existing?.status === "CANCELLED" ||
        (existing?.status === "CONFIRMED" && input.status === "PENDING")
      )
        return existing;
      const click = input.clickToken
        ? await transaction.affiliateClick.findUnique({
            where: { token: input.clickToken },
            select: { id: true, merchantId: true },
          })
        : null;
      const data = {
        clickId: click?.id ?? existing?.clickId,
        merchantId: click?.merchantId ?? existing?.merchantId,
        orderReference: input.orderReference,
        orderAmountMinor: input.orderAmountMinor ? BigInt(input.orderAmountMinor) : null,
        commissionMinor: BigInt(input.commissionMinor),
        currency: input.currency,
        status: input.status,
        occurredAt,
        confirmedAt: input.status === "CONFIRMED" ? occurredAt : existing?.confirmedAt,
        cancelledAt: input.status === "CANCELLED" ? occurredAt : existing?.cancelledAt,
        payload: input,
      } as const;
      return existing
        ? transaction.affiliateCommission.update({ where: { id: existing.id }, data })
        : transaction.affiliateCommission.create({
            data: { network: input.network, externalId: input.externalId, ...data },
          });
    });
  }

  verifySignature(timestamp: string, signature: string, body: unknown): void {
    if (!this.config.FEATURE_AFFILIATION)
      throw new AppError(404, "AFFILIATION_DISABLED", "Affiliation is disabled");
    const seconds = Number.parseInt(timestamp, 10);
    if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) {
      throw new AppError(401, "WEBHOOK_TIMESTAMP_INVALID", "Webhook signature is invalid");
    }
    const expected = createHmac("sha256", this.config.AFFILIATE_WEBHOOK_SECRET)
      .update(`${timestamp}.${JSON.stringify(body)}`)
      .digest("hex");
    if (signature.length !== expected.length || !safeEqual(signature, expected)) {
      throw new AppError(401, "WEBHOOK_SIGNATURE_INVALID", "Webhook signature is invalid");
    }
  }

  private outgoing(
    original: URL,
    merchant: {
      affiliationEnabled: boolean;
      affiliateLinkTemplate: string | null;
      affiliateIdentifier: string | null;
      affiliateRules: unknown;
    } | null,
    clickToken: string,
  ): URL {
    if (
      !this.config.FEATURE_AFFILIATION ||
      !merchant?.affiliationEnabled ||
      !merchant.affiliateLinkTemplate
    )
      return original;
    const rendered = merchant.affiliateLinkTemplate
      .replaceAll("{url}", encodeURIComponent(original.toString()))
      .replaceAll("{click}", encodeURIComponent(clickToken))
      .replaceAll("{affiliateId}", encodeURIComponent(merchant.affiliateIdentifier ?? ""));
    const result = normalizeUrl(rendered);
    const rules = merchant.affiliateRules as { trackingHosts?: string[] } | null;
    if (!matchesDomain(result.hostname, rules?.trackingHosts ?? [])) {
      throw new AppError(400, "AFFILIATE_HOST_REJECTED", "Affiliate tracking host is not allowed");
    }
    return result;
  }
}

function matchesDomain(hostname: string, domains: string[]): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function safeEqual(left: string, right: string): boolean {
  let difference = 0;
  for (let index = 0; index < left.length; index++)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
