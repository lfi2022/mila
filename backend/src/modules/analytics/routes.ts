import type { FastifyPluginAsync } from "fastify";
import { createHmac } from "node:crypto";
import { z } from "zod";
import type { AppConfig } from "../../config/env.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

export const ANALYTICS_EVENTS = [
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
        await prisma.productAnalyticsEvent.create({
          data: {
            event: input.event,
            subjectHash: pseudonym(config.AUTH_SECRET, input.visitorId),
            sessionHash: pseudonym(config.AUTH_SECRET, input.sessionId),
            path: input.path,
            properties: input.properties as Prisma.InputJsonValue | undefined,
            occurredAt,
          },
        });
        return reply.status(202).send({ accepted: true });
      },
    );
  };
}
export function pseudonym(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}
