import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { AuthService } from "../auth/service.js";

const merchantInput = z.object({
  name: z.string().trim().min(1).max(180),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(120),
  logoKey: z.string().max(512).nullable().optional(),
  active: z.boolean(),
  domains: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9.-]+$/),
    )
    .max(100),
  affiliationEnabled: z.boolean(),
  affiliateNetwork: z.string().max(120).nullable().optional(),
  affiliateIdentifier: z.string().max(255).nullable().optional(),
  affiliateLinkTemplate: z.string().max(2048).nullable().optional(),
  affiliateRules: z
    .object({ trackingHosts: z.array(z.string().regex(/^[a-z0-9.-]+$/)).max(20) })
    .nullable()
    .optional(),
  rewardEnabled: z.boolean().default(false),
  rewardShareRateBps: z.number().int().min(0).max(10_000).nullable().optional(),
  connectorType: z.string().max(64).default("MANUAL"),
  automationTrustLevel: z.number().int().min(0).max(4).default(0),
  offerTrustScore: z.number().int().min(0).max(100).default(50),
  refreshMinMinutes: z.number().int().min(60).max(10_080).default(1_440),
  connectorConfig: z.record(z.unknown()).nullable().optional(),
});
const mediaPolicyInput = z.object({
  allowMetadata: z.boolean().default(true),
  allowRemoteDisplay: z.boolean().default(false),
  allowCaching: z.boolean().default(false),
  allowLocalStorage: z.boolean().default(false),
  allowTransformation: z.boolean().default(false),
  allowCommercialUse: z.boolean().default(false),
  attributionRequired: z.boolean().default(false),
  attributionTemplate: z.string().trim().max(500).nullable().optional(),
  licenseSourceUrl: z.string().url().max(2048).nullable().optional(),
  termsSourceUrl: z.string().url().max(2048).nullable().optional(),
  reviewAfter: z.coerce.date().nullable().optional(),
  status: z.enum(["REVIEW_REQUIRED", "VERIFIED", "SUSPENDED"]),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export function merchantRoutes(
  prisma: PrismaClient,
  auth: AuthService,
  config: AppConfig,
): FastifyPluginAsync {
  const staff = async (request: FastifyRequest) => {
    const user = await auth.authenticate(request.cookies[config.COOKIE_NAME]);
    if (!user.roles.some((role) => ["MODERATOR", "ADMIN", "SUPER_ADMIN"].includes(role)))
      throw new AppError(403, "STAFF_REQUIRED", "Staff access required");
    return user;
  };
  const administrator = async (request: FastifyRequest) => {
    const user = await staff(request);
    if (!user.roles.some((role) => ["ADMIN", "SUPER_ADMIN"].includes(role)))
      throw new AppError(403, "ADMIN_REQUIRED", "Administrator access required");
    return user;
  };
  const csrf = (request: FastifyRequest) => {
    const cookie = request.cookies[`${config.COOKIE_NAME}_csrf`] ?? "";
    const header =
      typeof request.headers["x-csrf-token"] === "string" ? request.headers["x-csrf-token"] : "";
    const left = Buffer.from(cookie);
    const right = Buffer.from(header);
    if (!cookie || left.length !== right.length || !timingSafeEqual(left, right))
      throw new AppError(403, "CSRF_INVALID", "CSRF validation failed");
  };
  return async (app) => {
    app.get("/merchants", async () => ({
      merchants: await prisma.merchant.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          slug: true,
          logoKey: true,
          domains: { select: { domain: true } },
        },
        orderBy: { name: "asc" },
      }),
    }));
    app.get("/admin/merchants", async (request) => {
      await staff(request);
      return {
        merchants: await prisma.merchant.findMany({
          include: { domains: true, mediaPolicy: true },
          orderBy: { name: "asc" },
        }),
      };
    });
    app.put("/admin/merchants/:merchantId", async (request) => {
      csrf(request);
      const actor = await administrator(request);
      const { merchantId } = z.object({ merchantId: z.string().uuid() }).parse(request.params);
      const value = merchantInput.parse(request.body);
      const { domains, affiliateRules, connectorConfig, ...scalar } = value;
      const data = {
        ...scalar,
        ...(affiliateRules !== undefined && affiliateRules !== null
          ? { affiliateRules: affiliateRules as Prisma.InputJsonValue }
          : {}),
        ...(connectorConfig !== undefined && connectorConfig !== null
          ? { connectorConfig: connectorConfig as Prisma.InputJsonValue }
          : {}),
      };
      const nested = {
        createMany: { data: domains.map((domain) => ({ domain })) },
      };
      return prisma.$transaction(async (transaction) => {
        const before = await transaction.merchant.findUnique({
          where: { id: merchantId },
          include: { domains: true },
        });
        const merchant = await transaction.merchant.upsert({
          where: { id: merchantId },
          create: { id: merchantId, ...data, domains: nested },
          update: { ...data, domains: { deleteMany: {}, ...nested } },
          include: { domains: true },
        });
        await transaction.adminAuditLog.create({
          data: {
            actorId: actor.id,
            action: before ? "merchant.update" : "merchant.create",
            targetType: "merchant",
            targetId: merchant.id,
            reason: "Configuration marchand confirmée depuis l’administration",
            before: before ? JSON.parse(JSON.stringify(before)) : undefined,
            after: JSON.parse(JSON.stringify(merchant)),
            requestId: request.id,
          },
        });
        return { merchant };
      });
    });
    app.put("/admin/merchants/:merchantId/media-policy", async (request) => {
      csrf(request);
      const actor = await administrator(request);
      const { merchantId } = z.object({ merchantId: z.string().uuid() }).parse(request.params);
      const input = mediaPolicyInput.parse(request.body);
      if (input.status === "VERIFIED" && !input.licenseSourceUrl && !input.termsSourceUrl) {
        throw new AppError(
          400,
          "MEDIA_RIGHTS_EVIDENCE_REQUIRED",
          "Verified rights require a licence or terms URL",
        );
      }
      if (input.allowCaching && !input.allowLocalStorage) {
        throw new AppError(
          400,
          "MEDIA_POLICY_INVALID",
          "Caching requires local storage permission",
        );
      }
      return prisma.$transaction(async (transaction) => {
        const before = await transaction.merchantMediaPolicy.findUnique({ where: { merchantId } });
        const policy = await transaction.merchantMediaPolicy.upsert({
          where: { merchantId },
          create: {
            merchantId,
            ...input,
            verifiedAt: input.status === "VERIFIED" ? new Date() : null,
            verifiedBy: actor.id,
          },
          update: {
            ...input,
            verifiedAt: input.status === "VERIFIED" ? new Date() : null,
            verifiedBy: actor.id,
          },
        });
        await transaction.adminAuditLog.create({
          data: {
            actorId: actor.id,
            action: "merchant.media_policy.update",
            targetType: "merchant",
            targetId: merchantId,
            reason: "Politique média vérifiée depuis l’administration",
            before: before ? JSON.parse(JSON.stringify(before)) : undefined,
            after: JSON.parse(JSON.stringify(policy)),
            requestId: request.id,
          },
        });
        return { policy };
      });
    });
    app.get("/admin/media", async (request) => {
      await staff(request);
      return {
        media: await prisma.productMedia.findMany({
          take: 200,
          orderBy: { createdAt: "desc" },
          include: {
            gift: { select: { title: true, listId: true } },
            merchant: { select: { name: true } },
            claims: true,
          },
        }),
      };
    });
    app.post("/admin/media/:mediaId/block", async (request) => {
      csrf(request);
      const actor = await staff(request);
      const { mediaId } = z.object({ mediaId: z.string().uuid() }).parse(request.params);
      const { reason } = z
        .object({ reason: z.string().trim().min(3).max(1000) })
        .parse(request.body);
      return prisma.$transaction(async (transaction) => {
        const media = await transaction.productMedia.update({
          where: { id: mediaId },
          data: { status: "BLOCKED", usageStatus: "BLOCKED", sourceType: "BLOCKED" },
        });
        await transaction.adminAuditLog.create({
          data: {
            actorId: actor.id,
            action: "media.block",
            targetType: "product_media",
            targetId: mediaId,
            reason,
            requestId: request.id,
          },
        });
        return { media };
      });
    });
    app.post("/admin/media/:mediaId/claims", async (request, reply) => {
      csrf(request);
      await staff(request);
      const { mediaId } = z.object({ mediaId: z.string().uuid() }).parse(request.params);
      const input = z
        .object({
          claimant: z.string().trim().min(2).max(180),
          contact: z.string().trim().min(3).max(255),
          reason: z.string().trim().min(3).max(2000),
        })
        .parse(request.body);
      const claim = await prisma.$transaction(async (transaction) => {
        const created = await transaction.mediaClaim.create({ data: { mediaId, ...input } });
        await transaction.productMedia.update({
          where: { id: mediaId },
          data: { status: "BLOCKED", usageStatus: "BLOCKED", sourceType: "BLOCKED" },
        });
        return created;
      });
      return reply.status(201).send({ claim });
    });
  };
}
