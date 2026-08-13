import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import type { AuthService, AuthUser } from "../auth/service.js";
import type { RewardsService } from "./service.js";

export function rewardRoutes(
  service: RewardsService,
  auth: AuthService,
  config: AppConfig,
): FastifyPluginAsync {
  const current = (request: FastifyRequest) =>
    auth.authenticate(request.cookies[config.COOKIE_NAME]);
  const csrf = (request: FastifyRequest) => {
    const cookie = request.cookies[`${config.COOKIE_NAME}_csrf`] ?? "";
    const header =
      typeof request.headers["x-csrf-token"] === "string" ? request.headers["x-csrf-token"] : "";
    const left = Buffer.from(cookie);
    const right = Buffer.from(header);
    if (!cookie || left.length !== right.length || !timingSafeEqual(left, right))
      throw new AppError(403, "CSRF_INVALID", "CSRF validation failed");
  };
  const staff = (user: AuthUser) => {
    if (!user.roles.some((role) => ["MODERATOR", "ADMIN", "SUPER_ADMIN"].includes(role)))
      throw new AppError(403, "STAFF_REQUIRED", "Staff access required");
  };
  return async (app) => {
    app.get("/rewards/lists/:listId", async (request) => {
      const user = await current(request);
      const { listId } = z.object({ listId: z.string().uuid() }).parse(request.params);
      return service.getListRewards(user.id, listId);
    });
    app.get("/rewards/offers", async (request) => {
      await current(request);
      return service.listOffers();
    });
    app.post("/rewards/lists/:listId/redemptions", async (request) => {
      csrf(request);
      const user = await current(request);
      const { listId } = z.object({ listId: z.string().uuid() }).parse(request.params);
      const { offerId } = z
        .object({ offerId: z.string().max(64).optional() })
        .parse(request.body ?? {});
      return service.requestRedemption(user.id, listId, offerId);
    });
    app.get("/rewards/referral", async (request) =>
      service.getReferral((await current(request)).id),
    );
    app.post(
      "/rewards/referral/register",
      { config: { rateLimit: { max: 10, timeWindow: 3_600_000 } } },
      async (request) => {
        csrf(request);
        const user = await current(request);
        const { code } = z.object({ code: z.string().trim().min(4).max(16) }).parse(request.body);
        return service.registerReferral(user.id, code);
      },
    );
    app.post("/rewards/referral/refresh", async (request) => {
      csrf(request);
      return service.refreshReferrals((await current(request)).id);
    });
    app.get("/admin/rewards/analytics", async (request) => {
      const user = await current(request);
      staff(user);
      return service.adminAnalytics();
    });
    app.get("/admin/rewards/review-queue", async (request) => {
      const user = await current(request);
      staff(user);
      return service.adminReviewQueue();
    });
    app.post("/admin/rewards/adjustments", async (request) => {
      csrf(request);
      const user = await current(request);
      staff(user);
      const input = z
        .object({
          listId: z.string().uuid(),
          amountCents: z
            .number()
            .int()
            .min(-1_000_000)
            .max(1_000_000)
            .refine((v) => v !== 0),
          reason: z.string().trim().min(3).max(500),
        })
        .parse(request.body);
      const transaction = await service.adminAdjustment(
        user.id,
        input.listId,
        input.amountCents,
        input.reason,
        request.id,
      );
      return { transaction: { id: transaction.id } };
    });
    app.post("/admin/rewards/grants", async (request) => {
      csrf(request);
      const user = await current(request);
      staff(user);
      const input = z
        .object({
          listId: z.string().uuid(),
          type: z.enum(["PREMIUM_PURCHASE", "PARTNER_BONUS", "PROMOTIONAL_BONUS"]),
          amountCents: z.number().int().positive().max(1_000_000),
          sourceId: z.string().trim().min(1).max(255),
          reason: z.string().trim().min(3).max(500),
        })
        .parse(request.body);
      const transaction = await service.adminGrant(
        user.id,
        input.listId,
        input.type,
        input.amountCents,
        input.sourceId,
        input.reason,
        request.id,
      );
      return { transaction: { id: transaction.id } };
    });
    app.post("/admin/rewards/referrals/:referralId/review", async (request) => {
      csrf(request);
      const user = await current(request);
      staff(user);
      const { referralId } = z.object({ referralId: z.string().uuid() }).parse(request.params);
      const input = z
        .object({ approve: z.boolean(), reason: z.string().trim().min(3).max(500) })
        .parse(request.body);
      return service.reviewReferral(user.id, referralId, input.approve, input.reason, request.id);
    });
    app.post("/admin/rewards/redemptions/:redemptionId/review", async (request) => {
      csrf(request);
      const user = await current(request);
      staff(user);
      const { redemptionId } = z.object({ redemptionId: z.string().uuid() }).parse(request.params);
      const input = z
        .object({ approve: z.boolean(), reason: z.string().trim().min(3).max(500) })
        .parse(request.body);
      return service.reviewRedemption(
        user.id,
        redemptionId,
        input.approve,
        input.reason,
        request.id,
      );
    });
  };
}
