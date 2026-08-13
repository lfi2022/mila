import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { request as httpRequest } from "undici";
import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

export function reportRoutes(prisma: PrismaClient, config: AppConfig): FastifyPluginAsync {
  return async (app) => {
    app.post(
      "/public/reports",
      { config: { rateLimit: { max: 5, timeWindow: 300_000 } } },
      async (request, reply) => {
        const input = z
          .object({
            targetType: z.enum(["list", "gift", "user", "message"]),
            targetId: z.string().uuid(),
            reason: z.enum([
              "PHISHING",
              "MALICIOUS_LINK",
              "SPAM",
              "FRAUD",
              "REFERRAL_ABUSE",
              "ILLEGAL_CONTENT",
              "PRIVACY",
              "OTHER",
            ]),
            details: z.string().trim().max(1_000).optional(),
            captchaToken: z.string().max(4_096).optional(),
            website: z.string().max(0).optional(),
            elapsedMs: z.number().int().min(0).max(86_400_000).optional(),
          })
          .parse(request.body);
        const score = reportRiskScore(input);
        if (score >= 70 && config.FEATURE_ADAPTIVE_CAPTCHA)
          await verifyCaptcha(config, input.captchaToken, request.ip);
        await assertTarget(prisma, input.targetType, input.targetId);
        const result = await prisma.$transaction(async (tx) => {
          const report = await tx.report.create({
            data: {
              targetType: input.targetType,
              targetId: input.targetId,
              reason: input.reason,
              details: input.details || null,
              status: score >= 70 ? "REVIEWING" : "OPEN",
            },
          });
          if (score >= 40)
            await tx.riskReview.create({
              data: {
                targetType: input.targetType,
                targetId: input.targetId,
                category: input.reason,
                score,
                signals: reportRiskSignals(input) as Prisma.InputJsonValue,
                status: score >= 70 ? "MANUAL_REVIEW" : "OPEN",
              },
            });
          return report;
        });
        return reply.status(201).send({ reportId: result.id, manualReview: score >= 40 });
      },
    );
  };
}

export function reportRiskScore(input: {
  website?: string;
  elapsedMs?: number;
  details?: string;
  reason: string;
}) {
  let score = 0;
  if (input.website) score += 100;
  if (input.elapsedMs !== undefined && input.elapsedMs < 1_500) score += 50;
  if (!input.details) score += 10;
  if (["PHISHING", "MALICIOUS_LINK", "FRAUD", "REFERRAL_ABUSE"].includes(input.reason)) score += 30;
  if ((input.details?.match(/https?:\/\//gi)?.length ?? 0) > 3) score += 30;
  return Math.min(score, 100);
}
function reportRiskSignals(input: { website?: string; elapsedMs?: number; details?: string }) {
  return {
    honeypot: Boolean(input.website),
    tooFast: input.elapsedMs !== undefined && input.elapsedMs < 1_500,
    manyLinks: (input.details?.match(/https?:\/\//gi)?.length ?? 0) > 3,
  };
}
async function verifyCaptcha(config: AppConfig, token: string | undefined, remoteIp: string) {
  if (!config.CAPTCHA_VERIFY_URL || !config.CAPTCHA_SECRET)
    throw new AppError(
      503,
      "CAPTCHA_NOT_CONFIGURED",
      "Adaptive challenge is not configured; report queued for manual review",
    );
  if (!token) throw new AppError(403, "CAPTCHA_REQUIRED", "Additional verification is required");
  const origin = new URL(config.CAPTCHA_VERIFY_URL);
  if (origin.protocol !== "https:")
    throw new AppError(503, "CAPTCHA_ORIGIN_INVALID", "Captcha verification must use HTTPS");
  const body = new URLSearchParams({
    secret: config.CAPTCHA_SECRET,
    response: token,
    remoteip: remoteIp,
  }).toString();
  const response = await httpRequest(config.CAPTCHA_VERIFY_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    headersTimeout: 5_000,
    bodyTimeout: 5_000,
  });
  const value = (await response.body.json()) as { success?: boolean };
  if (!value.success) throw new AppError(403, "CAPTCHA_REJECTED", "Verification failed");
}
async function assertTarget(prisma: PrismaClient, type: string, id: string) {
  const exists =
    type === "list"
      ? await prisma.giftList.count({ where: { id, deletedAt: null } })
      : type === "gift"
        ? await prisma.gift.count({ where: { id, deletedAt: null } })
        : type === "user"
          ? await prisma.user.count({ where: { id, deletedAt: null } })
          : await prisma.message.count({ where: { id, hiddenAt: null } });
  if (!exists) throw new AppError(404, "REPORT_TARGET_NOT_FOUND", "Report target not found");
}
