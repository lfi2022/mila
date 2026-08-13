import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import type { AuthService } from "../auth/service.js";
import { PartnersService } from "./service.js";

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120);
const reason = z.string().trim().min(3).max(500);

export function partnerRoutes(
  service: PartnersService,
  auth: AuthService,
  config: AppConfig,
): FastifyPluginAsync {
  const staff = async (request: FastifyRequest) => {
    const user = await auth.authenticate(request.cookies[config.COOKIE_NAME]);
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
    app.get(
      "/public/partners/:slug",
      { config: { rateLimit: { max: 30, timeWindow: 60_000 } } },
      async (request) => {
        const params = z.object({ slug }).parse(request.params);
        const query = z
          .object({
            campaign: z.string().trim().max(64).optional(),
          })
          .parse(request.query);
        return service.landing(params.slug, query.campaign);
      },
    );
    app.post(
      "/public/partners/:slug/attributions",
      { config: { rateLimit: { max: 10, timeWindow: 60_000 } } },
      async (request, reply) => {
        const { slug: partnerSlug } = z.object({ slug }).parse(request.params);
        const input = z
          .object({
            campaign: z.string().trim().max(64).optional(),
            channel: z.enum(["LINK", "QR"]).default("LINK"),
            accepted: z.literal(true),
          })
          .parse(request.body);
        const token = await service.startAttribution(partnerSlug, input.campaign, input.channel);
        reply.setCookie("mila_partner_attribution", token, {
          path: "/api/v1",
          httpOnly: true,
          secure: config.COOKIE_SECURE,
          sameSite: "lax",
          maxAge: 30 * 86_400,
        });
        return reply.status(201).send({ attributed: true });
      },
    );
    app.post("/admin/partners", async (request, reply) => {
      csrf(request);
      const user = await staff(request);
      const input = z
        .object({
          slug,
          name: z.string().trim().min(2).max(180),
          category: z.string().trim().min(2).max(120),
          summary: z.string().trim().max(500).nullable().optional(),
          websiteUrl: z.string().url().startsWith("https://").max(2048).nullable().optional(),
          landingTitle: z.string().trim().max(180).nullable().optional(),
          landingBody: z.string().trim().max(10_000).nullable().optional(),
          region: z.string().trim().max(120).nullable().optional(),
          contractReference: z.string().trim().max(255).nullable().optional(),
          reason,
        })
        .parse(request.body);
      const { reason: why, ...data } = input;
      return reply
        .status(201)
        .send({ partner: await service.createPartner(user.id, request.id, data, why) });
    });
    app.post("/admin/partner-campaigns", async (request, reply) => {
      csrf(request);
      const user = await staff(request);
      const input = z
        .object({
          partnerId: z.string().uuid(),
          code: slug.max(64),
          name: z.string().trim().min(2).max(180),
          startsAt: z.string().datetime(),
          endsAt: z.string().datetime(),
          benefit: z.object({
            title: z.string().trim().min(2).max(180),
            description: z.string().trim().min(2).max(1000),
            rewardMinor: z.number().int().nonnegative().optional(),
          }),
          budgetMinor: z
            .string()
            .regex(/^[1-9]\d*$/)
            .optional(),
          currency: z
            .string()
            .regex(/^[A-Z]{3}$/)
            .default("EUR"),
          conditions: z
            .record(z.union([z.string().max(200), z.number().finite(), z.boolean()]))
            .nullable()
            .optional(),
          reason,
        })
        .parse(request.body);
      const { reason: why, startsAt, endsAt, budgetMinor, ...rest } = input;
      const start = new Date(startsAt);
      const end = new Date(endsAt);
      if (start >= end)
        throw new AppError(400, "CAMPAIGN_DATES_INVALID", "Campaign end must follow start");
      return reply.status(201).send(
        jsonSafe({
          campaign: await service.createCampaign(
            user.id,
            request.id,
            {
              ...rest,
              startsAt: start,
              endsAt: end,
              budgetMinor: budgetMinor ? BigInt(budgetMinor) : null,
            },
            why,
          ),
        }),
      );
    });
    app.post("/admin/partners/:partnerId/status", async (request) => {
      csrf(request);
      const user = await staff(request);
      const { partnerId } = z.object({ partnerId: z.string().uuid() }).parse(request.params);
      const input = z
        .object({ status: z.enum(["ACTIVE", "INACTIVE"]), reason })
        .parse(request.body);
      return {
        partner: await service.setPartnerStatus(
          user.id,
          request.id,
          partnerId,
          input.status,
          input.reason,
        ),
      };
    });
    app.post("/admin/partner-campaigns/:campaignId/activation", async (request) => {
      csrf(request);
      const user = await staff(request);
      const { campaignId } = z.object({ campaignId: z.string().uuid() }).parse(request.params);
      const input = z.object({ active: z.boolean(), reason }).parse(request.body);
      return jsonSafe({
        campaign: await service.setCampaignActive(
          user.id,
          request.id,
          campaignId,
          input.active,
          input.reason,
        ),
      });
    });
    app.post("/admin/partner-campaigns/:campaignId/ledger", async (request, reply) => {
      csrf(request);
      const user = await staff(request);
      const { campaignId } = z.object({ campaignId: z.string().uuid() }).parse(request.params);
      const input = z
        .object({
          kind: z.enum(["BENEFIT_COST", "REWARD_COST", "REVENUE"]),
          amountMinor: z.string().regex(/^[1-9]\d*$/),
          currency: z.string().regex(/^[A-Z]{3}$/),
          idempotencyKey: z.string().trim().min(8).max(255),
          attributionId: z.string().uuid().optional(),
          note: z.string().trim().max(500).optional(),
          reason,
        })
        .parse(request.body);
      const { reason: why, amountMinor, ...data } = input;
      return reply.status(201).send(
        jsonSafe({
          entry: await service.recordLedger(
            user.id,
            request.id,
            campaignId,
            { ...data, amountMinor: BigInt(amountMinor) },
            why,
          ),
        }),
      );
    });
  };
}

function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)),
  ) as T;
}
