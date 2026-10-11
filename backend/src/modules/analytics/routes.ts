import type { FastifyPluginAsync } from "fastify";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { encryptAnalyticsIp } from "../../common/security/analytics-ip.js";
import type { AppConfig } from "../../config/env.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

export const ANALYTICS_EVENTS = [
  "site_visit",
  "page_view",
  "homepage_view",
  "signup_cta_clicked",
  "demo_clicked",
  "rewards_learn_more_clicked",
  "signup_started",
  "signup_completed",
  "list_created",
  "first_gift_added",
  "list_shared",
  "first_reservation",
  "first_eligible_purchase",
  "first_reward",
  "premium_checkout_started",
  "premium_activated",
  "referral_registered",
  "web_vital",
] as const;

export function analyticsRoutes(prisma: PrismaClient, config: AppConfig): FastifyPluginAsync {
  return async (app) => {
    app.post(
      "/analytics/events",
      { config: { rateLimit: { max: 60, timeWindow: 60_000 } } },
      async (request, reply) => {
        const input = z
          .object({
            consent: z.literal(true),
            visitorId: z.string().uuid(),
            sessionId: z.string().uuid(),
            event: z.enum(ANALYTICS_EVENTS),
            path: z.string().startsWith("/").max(255).optional(),
            occurredAt: z.string().datetime(),
            properties: z
              .record(z.union([z.string().max(120), z.number().finite(), z.boolean()]))
              .optional(),
          })
          .parse(request.body);
        const occurredAt = new Date(input.occurredAt);
        if (Math.abs(Date.now() - occurredAt.getTime()) > 86_400_000)
          return reply.status(202).send({ accepted: false });
        const visitorHash = pseudonym(config.AUTH_SECRET, input.visitorId);
        const device = describeDevice(request.headers["user-agent"]);
        // An IP address is encrypted at rest and removed after 30 days. Its hash only identifies
        // a possible shared network and must not be used to merge distinct visitors.
        const ipHash = request.ip ? pseudonym(config.AUTH_SECRET, `ip:${request.ip}`) : undefined;
        const ipEncrypted = request.ip
          ? encryptAnalyticsIp(request.ip, config.AUTH_SECRET)
          : undefined;
        const ipExpiresAt = request.ip ? new Date(Date.now() + 30 * 86_400_000) : undefined;
        const visitIncrement = input.event === "site_visit" ? 1 : 0;
        const pageViewIncrement = input.event === "page_view" ? 1 : 0;
        await prisma.$transaction([
          prisma.productAnalyticsEvent.create({
            data: {
              event: input.event,
              subjectHash: visitorHash,
              sessionHash: pseudonym(config.AUTH_SECRET, input.sessionId),
              path: input.path,
              device,
              ipHash,
              ipEncrypted,
              ipExpiresAt,
              properties: input.properties as Prisma.InputJsonValue | undefined,
              occurredAt,
            },
          }),
          prisma.analyticsVisitor.upsert({
            where: { visitorHash },
            create: {
              visitorHash,
              ipHash,
              ipEncrypted,
              ipExpiresAt,
              firstSeenAt: occurredAt,
              lastSeenAt: occurredAt,
              visitCount: visitIncrement,
              pageViews: pageViewIncrement,
              eventCount: 1,
              firstPath: input.path,
              lastPath: input.path,
              device,
            },
            update: {
              ipHash,
              lastSeenAt: occurredAt,
              visitCount: { increment: visitIncrement },
              pageViews: { increment: pageViewIncrement },
              eventCount: { increment: 1 },
              lastPath: input.path,
              device,
            },
          }),
        ]);
        return reply.status(202).send({ accepted: true });
      },
    );
  };
}

function describeDevice(userAgent: string | undefined): string | undefined {
  if (!userAgent) return undefined;
  const browser = /Edg\//.test(userAgent)
    ? "Microsoft Edge"
    : /Firefox\//.test(userAgent)
      ? "Firefox"
      : /CriOS\//.test(userAgent) || /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Navigateur inconnu";
  const platform = /iPhone|iPad|iPod/.test(userAgent)
    ? "iPhone/iPad"
    : /Android/.test(userAgent)
      ? "Android"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "Système inconnu";
  return `${browser} · ${/Mobi|Android|iPhone|iPad|iPod/.test(userAgent) ? "Mobile" : "Ordinateur"} · ${platform}`;
}
export function pseudonym(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}
