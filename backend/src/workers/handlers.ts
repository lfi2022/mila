import nodemailer from "nodemailer";

import type { DatabaseService } from "../common/database/client.js";
import type { AppConfig } from "../config/env.js";
import type { NotificationJob } from "../modules/notifications/queue.js";
import type { NotificationQueue } from "../modules/notifications/queue.js";
import { calculateRefreshHours } from "../modules/prices/scheduler.js";
import { rankOffers } from "../modules/prices/service.js";
import type { ProductPreview } from "../modules/products/extractor.js";
import { createProductProviders, selectProductProvider } from "../modules/products/providers.js";
import { decideMediaUsage } from "../modules/product-media/policy.js";
import type { ProductMediaQueue } from "../modules/product-media/queue.js";
import type { StreamJob, StreamProcessor } from "./stream-worker.js";
import { safeFetchImage } from "../common/security/external-url.js";
import type { StorageService } from "../common/storage/service.js";
import { createHash } from "node:crypto";

export function notificationProcessor(
  config: AppConfig,
  database: DatabaseService,
): StreamProcessor {
  const transport =
    config.EMAIL_PROVIDER === "smtp"
      ? nodemailer.createTransport({
          host: config.SMTP_HOST,
          port: config.SMTP_PORT,
          secure: config.SMTP_SECURE,
          auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD },
          tls: { rejectUnauthorized: config.SMTP_TLS_REJECT_UNAUTHORIZED },
        })
      : null;
  return async ({ values }) => {
    if (config.EMAIL_PROVIDER === "disabled") return;
    const job = JSON.parse(required(values, "job")) as NotificationJob;
    const email =
      job.email ??
      (
        await database.client.user.findUnique({
          where: { id: job.userId },
          select: { email: true },
        })
      )?.email;
    if (!email) return;
    const message = renderEmail(config.APP_URL, job);
    if (config.EMAIL_PROVIDER === "console") {
      process.stdout.write(`${JSON.stringify({ event: "email_preview", type: job.type })}\n`);
      return;
    }
    try {
      const result = await transport?.sendMail({ from: config.EMAIL_FROM, to: email, ...message });
      process.stdout.write(
        `${JSON.stringify({ event: "email_sent", type: job.type, messageId: result?.messageId })}\n`,
      );
    } catch (error) {
      const smtpError = error as Error & { code?: string; command?: string; responseCode?: number };
      process.stderr.write(
        `${JSON.stringify({
          event: "email_send_failed",
          type: job.type,
          errorType: smtpError.name,
          code: smtpError.code,
          command: smtpError.command,
          responseCode: smtpError.responseCode,
          message: smtpError.message.slice(0, 300),
        })}\n`,
      );
      throw error;
    }
  };
}

export function productRefreshProcessor(
  config: AppConfig,
  database: DatabaseService,
  notifications?: NotificationQueue,
  mediaQueue?: ProductMediaQueue,
): StreamProcessor {
  return async ({ values }) => {
    const giftId = required(values, "giftId");
    const gift = await database.client.gift.findFirst({
      where: { id: giftId, deletedAt: null, url: { not: null } },
      include: {
        productIdentity: true,
        merchant: { include: { mediaPolicy: true } },
        snapshots: { orderBy: { checkedAt: "desc" }, take: 6 },
        offers: { include: { merchant: true } },
        list: {
          include: { members: { select: { userId: true } } },
        },
      },
    });
    if (!gift?.url || !gift.list.productAutoRefresh) return;
    const kinds = JSON.parse(values["kinds"] ?? "[]") as string[];
    const now = new Date();
    try {
      const target = new URL(gift.url);
      const provider = selectProductProvider(target, createProductProviders(config));
      if (!provider) throw new Error("No product provider supports this URL");
      const product = await provider.preview(target);
      const previous = gift.snapshots[0];
      const volatilityBps = priceVolatilityBps(
        gift.snapshots.flatMap((snapshot) =>
          snapshot.priceMinor !== null && snapshot.currency === product.currency
            ? [snapshot.priceMinor]
            : [],
        ),
      );
      const nextHours = calculateRefreshHours({
        status: gift.status,
        dueDate: gift.list.dueDate,
        volatilityBps,
        merchantMinMinutes: gift.merchant?.refreshMinMinutes ?? 1_440,
        failureCount: 0,
        minHours: config.PRICE_REFRESH_MIN_HOURS,
        maxHours: config.PRICE_REFRESH_MAX_HOURS,
        now,
      });
      if (product.imageUrl) {
        const sourceType = provider.capabilities.images
          ? gift.merchant?.connectorType === "OFFICIAL_API"
            ? ("OFFICIAL_API" as const)
            : ("AFFILIATE_FEED" as const)
          : ("REMOTE_UNVERIFIED" as const);
        const decision = decideMediaUsage(sourceType, gift.merchant?.mediaPolicy ?? null);
        const existing = await database.client.productMedia.findFirst({
          where: { giftId: gift.id, originalUrl: product.imageUrl },
        });
        const media = existing
          ? await database.client.productMedia.update({
              where: { id: existing.id },
              data: { usageStatus: decision.usageStatus, verifiedAt: new Date() },
            })
          : await database.client.productMedia.create({
              data: {
                giftId: gift.id,
                merchantId: gift.merchantId,
                originalUrl: product.imageUrl,
                sourceType,
                usageStatus: decision.usageStatus,
                cacheAllowed: Boolean(gift.merchant?.mediaPolicy?.allowCaching),
                remoteDisplayAllowed: Boolean(gift.merchant?.mediaPolicy?.allowRemoteDisplay),
                transformationAllowed: Boolean(gift.merchant?.mediaPolicy?.allowTransformation),
                commercialUseAllowed: Boolean(gift.merchant?.mediaPolicy?.allowCommercialUse),
                termsUrl: gift.merchant?.mediaPolicy?.termsSourceUrl,
                licenseUrl: gift.merchant?.mediaPolicy?.licenseSourceUrl,
                attributionRequired: Boolean(gift.merchant?.mediaPolicy?.attributionRequired),
                attributionText: gift.merchant?.mediaPolicy?.attributionTemplate,
                verifiedAt: new Date(),
              },
            });
        process.stdout.write(
          `${JSON.stringify({ event: "product_media_detected", mediaId: media.id, provider: provider.id, decision: decision.reason })}\n`,
        );
        if (decision.cache && mediaQueue)
          await mediaQueue.enqueue(media.id, "authorized-product-refresh");
      }
      await database.client.$transaction(async (tx) => {
        await tx.gift.update({
          where: { id: gift.id },
          data: {
            canonicalUrl: product.canonicalUrl,
            unitPriceMinor:
              gift.list.autoUpdatePrice && kinds.includes("price") && product.priceMinor !== null
                ? product.priceMinor
                : undefined,
            currency:
              gift.list.autoUpdatePrice && kinds.includes("price") && product.priceMinor !== null
                ? product.currency
                : undefined,
            sku: product.sku,
            lastAvailability: product.availability,
            lastLinkHealthy: true,
            refreshFailureCount: 0,
            lastRefreshedAt: now,
            nextRefreshAt: new Date(now.getTime() + nextHours * 3_600_000),
          },
        });
        await tx.priceSnapshot.create({
          data: {
            giftId: gift.id,
            merchantId: gift.merchantId,
            priceMinor: product.priceMinor,
            currency: product.currency,
            availability: product.availability,
            linkHealthy: true,
            source: product.source,
            checkedAt: now,
          },
        });
        if (gift.productIdentityId && gift.merchantId && product.priceMinor !== null) {
          const confidence = identityConfidence(gift.productIdentity, product);
          const existing = gift.offers.find(
            (offer) => offer.merchantId === gift.merchantId && offer.url === product.canonicalUrl,
          );
          const data = {
            giftId: gift.id,
            productIdentityId: gift.productIdentityId,
            merchantId: gift.merchantId,
            url: product.canonicalUrl,
            sku: product.sku,
            priceMinor: product.priceMinor,
            currency: product.currency,
            available: availability(product.availability),
            matchConfidence: confidence,
            matchMethod: confidence >= 100 ? "GTIN" : confidence >= 90 ? "SKU" : "SOURCE_URL",
            source: product.source,
            affiliateEligible: gift.merchant?.affiliationEnabled ?? false,
            checkedAt: now,
          };
          if (existing) await tx.merchantOffer.update({ where: { id: existing.id }, data });
          else await tx.merchantOffer.create({ data });
        }
      });
      if (config.FEATURE_PRICE_ALERTS)
        await sendProductAlerts(database, notifications, gift, previous, {
          priceMinor: product.priceMinor,
          currency: product.currency,
          availability: product.availability,
          linkHealthy: true,
        }).catch((error: unknown) => logRefreshSideEffect("price_alert_failed", error));
      await maybeAutoSwitch(database, config, gift.id).catch((error: unknown) =>
        logRefreshSideEffect("price_auto_switch_failed", error),
      );
    } catch {
      const failureCount = Math.min(gift.refreshFailureCount + 1, 65_535);
      const nextHours = calculateRefreshHours({
        status: gift.status,
        dueDate: gift.list.dueDate,
        volatilityBps: 0,
        merchantMinMinutes: gift.merchant?.refreshMinMinutes ?? 1_440,
        failureCount,
        minHours: config.PRICE_REFRESH_MIN_HOURS,
        maxHours: config.PRICE_REFRESH_MAX_HOURS,
        now,
      });
      await database.client.$transaction([
        database.client.gift.update({
          where: { id: gift.id },
          data: {
            lastLinkHealthy: false,
            refreshFailureCount: failureCount,
            lastRefreshedAt: now,
            nextRefreshAt: new Date(now.getTime() + nextHours * 3_600_000),
          },
        }),
        database.client.priceSnapshot.create({
          data: {
            giftId: gift.id,
            merchantId: gift.merchantId,
            priceMinor: null,
            currency: gift.currency,
            availability: gift.lastAvailability,
            linkHealthy: false,
            errorCode: "FETCH_FAILED",
            source: "REFRESH",
            checkedAt: now,
          },
        }),
      ]);
      if (config.FEATURE_PRICE_ALERTS)
        await sendProductAlerts(database, notifications, gift, gift.snapshots[0], {
          priceMinor: null,
          currency: gift.currency,
          availability: gift.lastAvailability,
          linkHealthy: false,
        }).catch((error: unknown) => logRefreshSideEffect("dead_link_alert_failed", error));
    }
  };
}

function priceVolatilityBps(prices: bigint[]) {
  if (prices.length < 2) return 0;
  const minimum = prices.reduce((left, right) => (left < right ? left : right));
  const maximum = prices.reduce((left, right) => (left > right ? left : right));
  if (minimum <= 0n) return 0;
  return Number(((maximum - minimum) * 10_000n) / minimum);
}

function identityConfidence(
  identity: { gtin: string | null; ean: string | null; mpn: string | null } | null,
  product: ProductPreview,
) {
  const normalize = (value: string | null) => value?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
  const extractedGtin = normalize(product.gtin);
  if (
    extractedGtin &&
    [identity?.gtin, identity?.ean].some((value) => normalize(value ?? null) === extractedGtin)
  )
    return 100;
  const extractedSku = normalize(product.sku);
  if (extractedSku && normalize(identity?.mpn ?? null) === extractedSku) return 90;
  return 80;
}

function availability(value: string | null) {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("outofstock") || normalized.includes("discontinued")) return false;
  if (normalized.includes("instock") || normalized.includes("preorder")) return true;
  return null;
}

type AlertGift = {
  id: string;
  listId: string;
  title: string;
  currency: string;
  priceAlertsEnabled: boolean;
  availabilityAlertsEnabled: boolean;
  deadLinkAlertsEnabled: boolean;
  list: { ownerId: string; members: Array<{ userId: string }> };
};

async function sendProductAlerts(
  database: DatabaseService,
  queue: NotificationQueue | undefined,
  gift: AlertGift,
  previous:
    | {
        priceMinor: bigint | null;
        currency: string;
        availability: string | null;
        linkHealthy: boolean;
      }
    | undefined,
  current: {
    priceMinor: bigint | null;
    currency: string;
    availability: string | null;
    linkHealthy: boolean;
  },
) {
  const alerts: Array<{ type: string; title: string; body: string }> = [];
  if (
    gift.priceAlertsEnabled &&
    previous?.priceMinor !== null &&
    previous?.priceMinor !== undefined &&
    current.priceMinor !== null &&
    previous.currency === current.currency &&
    current.priceMinor < previous.priceMinor
  ) {
    const drop = previous.priceMinor - current.priceMinor;
    alerts.push({
      type: "PRICE_DROP",
      title: "Baisse de prix",
      body: `${gift.title} a baissé de ${formatMinor(drop, current.currency)}.`,
    });
  }
  if (
    gift.availabilityAlertsEnabled &&
    availability(previous?.availability ?? null) !== false &&
    availability(current.availability) === false
  )
    alerts.push({
      type: "STOCK_UNAVAILABLE",
      title: "Produit indisponible",
      body: `${gift.title} semble désormais indisponible.`,
    });
  if (gift.deadLinkAlertsEnabled && previous?.linkHealthy !== false && !current.linkHealthy)
    alerts.push({
      type: "DEAD_LINK",
      title: "Lien à vérifier",
      body: `Le lien de ${gift.title} ne répond plus correctement.`,
    });
  if (!alerts.length) return;
  const userIds = [
    ...new Set([gift.list.ownerId, ...gift.list.members.map((member) => member.userId)]),
  ];
  const preferences = await database.client.notificationPreference.findMany({
    where: { userId: { in: userIds }, type: { in: alerts.map((alert) => alert.type) } },
  });
  for (const alert of alerts) {
    for (const userId of userIds) {
      const preference = preferences.find(
        (row) => row.userId === userId && row.type === alert.type,
      );
      if (preference?.inAppEnabled !== false)
        await database.client.notification.create({
          data: {
            userId,
            listId: gift.listId,
            type: alert.type,
            title: alert.title,
            body: alert.body,
            data: { giftId: gift.id },
          },
        });
      if (
        queue &&
        preference?.emailEnabled !== false &&
        (preference?.digest ?? "IMMEDIATE") === "IMMEDIATE"
      )
        await queue.enqueue({
          type: alert.type,
          userId,
          listId: gift.listId,
          payload: { giftId: gift.id, body: alert.body },
        });
    }
  }
}

async function maybeAutoSwitch(database: DatabaseService, config: AppConfig, giftId: string) {
  if (!config.FEATURE_PRICE_COMPARISON) return;
  const gift = await database.client.gift.findUnique({
    where: { id: giftId },
    include: { list: true, offers: { include: { merchant: true } } },
  });
  if (
    !gift ||
    gift.offerPreference !== "AUTO_BEST" ||
    !gift.list.autoSwitchBetterOffer ||
    gift.status !== "AVAILABLE" ||
    gift.unitPriceMinor === null
  )
    return;
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
  if (!best || best.matchConfidence < 90 || best.trustScore < 60 || best.available === false)
    return;
  const savings = gift.unitPriceMinor - best.totalMinor;
  if (
    savings <= 0n ||
    (savings * 10_000n) / gift.unitPriceMinor < BigInt(config.PRICE_AUTO_SWITCH_MIN_SAVINGS_BPS)
  )
    return;
  const offer = gift.offers.find((row) => row.id === best.id)!;
  const fromPriceMinor = gift.unitPriceMinor;
  await database.client.$transaction(
    async (tx) => {
      const current = await tx.gift.findUnique({ where: { id: gift.id } });
      if (!current || current.status !== "AVAILABLE" || current.unitPriceMinor !== fromPriceMinor)
        return;
      await tx.giftOfferSwitch.create({
        data: {
          giftId: gift.id,
          fromMerchantId: gift.merchantId,
          toMerchantId: offer.merchantId,
          offerId: offer.id,
          fromUrl: gift.url,
          toUrl: offer.url,
          fromPriceMinor,
          toTotalMinor: best.totalMinor,
          savingsMinor: savings,
          matchConfidence: best.matchConfidence,
          reason: `user_value_score;min_savings_bps=${config.PRICE_AUTO_SWITCH_MIN_SAVINGS_BPS}`,
        },
      });
      await tx.gift.update({
        where: { id: gift.id },
        data: {
          merchantId: offer.merchantId,
          url: offer.url,
          canonicalUrl: offer.url,
          unitPriceMinor: offer.priceMinor,
        },
      });
    },
    { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 },
  );
}

function formatMinor(value: bigint, currency: string) {
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency }).format(
    Number(value) / 100,
  );
}

function logRefreshSideEffect(event: string, error: unknown) {
  process.stderr.write(
    `${JSON.stringify({
      event,
      errorType: error instanceof Error ? error.name : "UnknownError",
    })}\n`,
  );
}

export function cleanupProcessor(database: DatabaseService): StreamProcessor {
  return async () => {
    const now = new Date();
    await database.client.$transaction(async (transaction) => {
      const expired = await transaction.reservation.findMany({
        where: { status: "RESERVED", tokenExpiresAt: { lte: now } },
        select: { id: true, giftId: true, quantity: true },
        take: 500,
      });
      for (const reservation of expired) {
        await transaction.reservation.update({
          where: { id: reservation.id },
          data: { status: "EXPIRED" },
        });
        await transaction.$executeRawUnsafe(
          "UPDATE gifts SET reserved_quantity = GREATEST(0, reserved_quantity - ?), status = IF(reserved_quantity - ? < quantity, 'AVAILABLE', status) WHERE id = ?",
          reservation.quantity,
          reservation.quantity,
          reservation.giftId,
        );
      }
      const expiredTransfers = await transaction.bankTransfer.findMany({
        where: {
          status: "WAITING_TRANSFER",
          instruction: { expiresAt: { lte: now } },
          contribution: { status: "PENDING" },
        },
        select: { id: true, contributionId: true },
        take: 500,
      });
      for (const transfer of expiredTransfers) {
        await transaction.bankTransfer.update({
          where: { id: transfer.id },
          data: {
            status: "MANUAL_REVIEW",
            metadata: { reason: "transfer_instruction_expired" },
          },
        });
        if (transfer.contributionId) {
          await transaction.contribution.update({
            where: { id: transfer.contributionId },
            data: { status: "CANCELLED" },
          });
          await transaction.fundsLedgerEntry.updateMany({
            where: { contributionId: transfer.contributionId, status: "PENDING" },
            data: { status: "EXPIRED" },
          });
        }
      }
      await transaction.session.deleteMany({ where: { expiresAt: { lte: now } } });
      await transaction.emailVerificationToken.deleteMany({ where: { expiresAt: { lte: now } } });
      await transaction.passwordResetToken.deleteMany({ where: { expiresAt: { lte: now } } });
    });
  };
}

export function mediaScanProcessor(
  storage?: StorageService,
  database?: DatabaseService,
): StreamProcessor {
  return async ({ values }) => {
    const bucket = required(values, "bucket");
    const key = required(values, "key");
    if (!storage) throw new Error("Media scanner is not configured");
    await storage.validateUploadedImage(bucket, key);
    if (database) {
      await database.client.productMedia.updateMany({
        where: { storedObjectKey: key, status: "PENDING" },
        data: { status: "ACTIVE" },
      });
    }
    process.stdout.write(
      `${JSON.stringify({ event: "uploaded_image_validated", bucket, keyHash: createHash("sha256").update(key).digest("hex") })}\n`,
    );
  };
}

export function productMediaProcessor(
  config: AppConfig,
  database: DatabaseService,
  storage: StorageService,
): StreamProcessor {
  return async ({ values }) => {
    const mediaId = required(values, "mediaId");
    const media = await database.client.productMedia.findUnique({ where: { id: mediaId } });
    if (
      !media?.originalUrl ||
      media.status !== "ACTIVE" ||
      media.usageStatus !== "AUTHORIZED_CACHE" ||
      !media.cacheAllowed
    ) {
      process.stdout.write(
        `${JSON.stringify({ event: "product_media_fetch_skipped", mediaId, reason: "not-authorized" })}\n`,
      );
      return;
    }
    try {
      const fetched = await safeFetchImage(media.originalUrl, config);
      const extension =
        fetched.contentType === "image/jpeg" ? "jpg" : fetched.contentType.split("/")[1]!;
      const key = `remote/${createHash("sha256").update(fetched.body).digest("hex")}.${extension}`;
      await storage.storeRemoteProductImage(key, fetched.body, fetched.contentType);
      await database.client.productMedia.update({
        where: { id: mediaId },
        data: {
          storedObjectKey: key,
          fetchedAt: new Date(),
          expiresAt: new Date(Date.now() + config.PRODUCT_MEDIA_CACHE_TTL_SECONDS * 1000),
          etag: fetched.etag,
          lastModified: fetched.lastModified,
        },
      });
      process.stdout.write(
        `${JSON.stringify({ event: "product_media_fetched", mediaId, contentType: fetched.contentType, bytes: fetched.body.length })}\n`,
      );
    } catch (error) {
      process.stderr.write(
        `${JSON.stringify({ event: "product_media_fetch_failed", mediaId, errorType: error instanceof Error ? error.name : "UnknownError" })}\n`,
      );
      throw error;
    }
  };
}

export function deferredProcessor(queue: string): StreamProcessor {
  return async (_job: StreamJob) => {
    throw new Error(`Queue handler ${queue} is disabled until its feature stage is enabled`);
  };
}

function required(values: Record<string, string>, key: string): string {
  const value = values[key];
  if (!value) throw new Error(`Missing job field: ${key}`);
  return value;
}

function renderEmail(appUrl: string, job: NotificationJob) {
  const token = typeof job.payload?.["token"] === "string" ? job.payload["token"] : undefined;
  const definitions: Record<string, { subject: string; path?: string; text: string }> = {
    WELCOME: { subject: "Bienvenue sur Mila", text: "Votre compte Mila est prêt." },
    EMAIL_VERIFICATION: {
      subject: "Confirmez votre adresse e-mail",
      path: "/verification-email",
      text: "Confirmez votre adresse e-mail pour activer votre compte.",
    },
    PASSWORD_RESET: {
      subject: "Réinitialisez votre mot de passe",
      path: "/reinitialiser-mot-de-passe",
      text: "Une réinitialisation de mot de passe a été demandée.",
    },
    LIST_INVITATION: {
      subject: "Invitation à rejoindre une liste Mila",
      path: "/invitation/{token}",
      text: "Vous avez reçu une invitation Mila.",
    },
    PRICE_DROP: { subject: "Un prix a baissé sur Mila", text: "Un cadeau a baissé de prix." },
    STOCK_UNAVAILABLE: {
      subject: "Un cadeau est indisponible",
      text: "Un cadeau de votre liste semble indisponible.",
    },
    DEAD_LINK: {
      subject: "Un lien cadeau est à vérifier",
      text: "Un lien de votre liste ne répond plus correctement.",
    },
  };
  const definition = definitions[job.type] ?? {
    subject: "Nouvelle notification Mila",
    text: "Une nouvelle activité est disponible dans Mila.",
  };
  const link =
    definition.path && token
      ? new URL(
          definition.path.includes("{token}")
            ? definition.path.replace("{token}", encodeURIComponent(token))
            : `${definition.path}?token=${encodeURIComponent(token)}`,
          appUrl,
        ).toString()
      : appUrl;
  const payloadText = typeof job.payload?.["body"] === "string" ? job.payload["body"] : null;
  return { subject: definition.subject, text: `${payloadText ?? definition.text}\n\n${link}` };
}
