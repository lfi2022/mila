import { timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";

import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import type { AuthService, AuthUser } from "../auth/service.js";
import type { PricesService } from "./service.js";

export function priceRoutes(
  service: PricesService,
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
    if (!user.roles.some((role) => ["ADMIN", "SUPER_ADMIN"].includes(role)))
      throw new AppError(403, "ADMIN_REQUIRED", "Administrator access required");
  };
  return async (app) => {
    app.get("/public/prices/:giftToken", async (request) => {
      const { giftToken } = z.object({ giftToken: z.string().length(64) }).parse(request.params);
      return service.publicSuggestion(giftToken);
    });
    app.get("/lists/:listId/price-tracking", async (request) => {
      const user = await current(request);
      const { listId } = z.object({ listId: z.string().uuid() }).parse(request.params);
      return service.listTracking(user.id, listId);
    });
    app.patch("/lists/:listId/price-settings", async (request) => {
      csrf(request);
      const user = await current(request);
      const { listId } = z.object({ listId: z.string().uuid() }).parse(request.params);
      const input = z
        .object({
          productAutoRefresh: z.boolean().optional(),
          autoUpdatePrice: z.boolean().optional(),
          autoSuggestBetterOffer: z.boolean().optional(),
          autoSwitchBetterOffer: z.boolean().optional(),
        })
        .refine((value) => Object.keys(value).length > 0)
        .parse(request.body);
      return { settings: await service.updateListSettings(user.id, listId, input) };
    });
    app.patch("/lists/:listId/gifts/:giftId/price-tracking", async (request) => {
      csrf(request);
      const user = await current(request);
      const { listId, giftId } = z
        .object({ listId: z.string().uuid(), giftId: z.string().uuid() })
        .parse(request.params);
      const input = z
        .object({
          priceAlertsEnabled: z.boolean().optional(),
          availabilityAlertsEnabled: z.boolean().optional(),
          deadLinkAlertsEnabled: z.boolean().optional(),
          offerPreference: z.enum(["FIXED_MERCHANT", "SUGGEST_BEST", "AUTO_BEST"]).optional(),
        })
        .refine((value) => Object.keys(value).length > 0)
        .parse(request.body);
      return { gift: await service.updatePreferences(user.id, listId, giftId, input) };
    });
    app.post("/admin/product-offers", async (request, reply) => {
      csrf(request);
      const user = await current(request);
      staff(user);
      const input = z
        .object({
          giftId: z.string().uuid(),
          merchantId: z.string().uuid(),
          url: z.string().max(2048),
          sku: z.string().max(120).optional(),
          priceMinor: z.string().regex(/^\d+$/).max(18),
          deliveryMinor: z.string().regex(/^\d+$/).max(18).optional(),
          currency: z.string().regex(/^[A-Z]{3}$/),
          available: z.boolean().optional(),
          deliveryEtaDays: z.number().int().min(0).max(365).optional(),
          matchConfidence: z.number().int().min(80).max(100),
          matchMethod: z.enum(["GTIN", "EAN", "MPN", "BRAND_MODEL", "MANUAL_VERIFIED"]),
          source: z.enum(["OFFICIAL_API", "AFFILIATE_FEED", "MANUAL"]),
          affiliateEligible: z.boolean().default(false),
        })
        .parse(request.body);
      return reply.status(201).send({ offer: await service.upsertControlledOffer(input) });
    });
  };
}
