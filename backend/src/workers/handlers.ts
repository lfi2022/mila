import nodemailer from "nodemailer";

import type { DatabaseService } from "../common/database/client.js";
import type { AppConfig } from "../config/env.js";
import type { NotificationJob } from "../modules/notifications/queue.js";
import { extractProduct } from "../modules/products/extractor.js";
import type { StreamJob, StreamProcessor } from "./stream-worker.js";

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
    await transport?.sendMail({ from: config.EMAIL_FROM, to: email, ...message });
  };
}

export function productRefreshProcessor(
  config: AppConfig,
  database: DatabaseService,
): StreamProcessor {
  return async ({ values }) => {
    const giftId = required(values, "giftId");
    const gift = await database.client.gift.findFirst({
      where: { id: giftId, deletedAt: null, url: { not: null } },
      select: {
        id: true,
        url: true,
        list: { select: { productAutoRefresh: true, autoUpdatePrice: true } },
      },
    });
    if (!gift?.url || !gift.list.productAutoRefresh) return;
    const kinds = JSON.parse(values["kinds"] ?? "[]") as string[];
    const product = await extractProduct(gift.url, config);
    await database.client.$transaction([
      database.client.gift.update({
        where: { id: gift.id },
        data: {
          canonicalUrl: product.canonicalUrl,
          unitPriceMinor:
            gift.list.autoUpdatePrice && kinds.includes("price") ? product.priceMinor : undefined,
          currency:
            gift.list.autoUpdatePrice && kinds.includes("price") ? product.currency : undefined,
          sku: product.sku,
          lastRefreshedAt: new Date(),
        },
      }),
      ...(product.priceMinor === null
        ? []
        : [
            database.client.priceSnapshot.create({
              data: {
                giftId: gift.id,
                priceMinor: product.priceMinor,
                currency: product.currency,
                availability: product.availability,
                source: product.source,
              },
            }),
          ]),
    ]);
  };
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
      await transaction.session.deleteMany({ where: { expiresAt: { lte: now } } });
      await transaction.emailVerificationToken.deleteMany({ where: { expiresAt: { lte: now } } });
      await transaction.passwordResetToken.deleteMany({ where: { expiresAt: { lte: now } } });
    });
  };
}

export function mediaScanProcessor(): StreamProcessor {
  return async ({ values }) => {
    required(values, "bucket");
    required(values, "key");
    throw new Error("Malware scanner is not configured");
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
      path: "/verify-email",
      text: "Confirmez votre adresse e-mail pour activer votre compte.",
    },
    PASSWORD_RESET: {
      subject: "Réinitialisez votre mot de passe",
      path: "/reset-password",
      text: "Une réinitialisation de mot de passe a été demandée.",
    },
    LIST_INVITATION: {
      subject: "Invitation à rejoindre une liste Mila",
      path: "/invitations/accept",
      text: "Vous avez reçu une invitation Mila.",
    },
  };
  const definition = definitions[job.type] ?? {
    subject: "Nouvelle notification Mila",
    text: "Une nouvelle activité est disponible dans Mila.",
  };
  const link =
    definition.path && token
      ? new URL(`${definition.path}?token=${encodeURIComponent(token)}`, appUrl).toString()
      : appUrl;
  return { subject: definition.subject, text: `${definition.text}\n\n${link}` };
}
