import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import { AuthService } from "../auth/service.js";
import { GiftsService } from "./service.js";

const giftInput = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().max(10_000).nullable().optional(),
  kind: z.enum(["LINK", "PRODUCT", "SERVICE", "EXPERIENCE", "FREE_GIFT", "CONTRIBUTION"]),
  status: z
    .enum([
      "AVAILABLE",
      "RESERVED",
      "FUNDED",
      "READY_TO_ORDER",
      "ORDERED",
      "SHIPPED",
      "RECEIVED",
      "CANCELLED",
      "UNAVAILABLE",
    ])
    .optional(),
  url: z.string().max(2048).nullable().optional(),
  canonicalUrl: z.string().max(2048).nullable().optional(),
  sku: z.string().max(120).nullable().optional(),
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/)
    .default("EUR"),
  unitPriceMinor: z.string().regex(/^\d+$/).nullable().optional(),
  quantity: z.number().int().min(1).max(65_535).default(1),
  contributionTargetMinor: z.string().regex(/^\d+$/).nullable().optional(),
  secondHandPolicy: z
    .enum(["NEW_ONLY", "SECOND_HAND_ALLOWED", "SECOND_HAND_PREFERRED"])
    .default("NEW_ONLY"),
  offerPreference: z
    .enum(["FIXED_MERCHANT", "SUGGEST_BEST", "AUTO_BEST"])
    .default("FIXED_MERCHANT"),
  position: z.number().int().min(0).default(0),
  image: z
    .object({
      url: z.string().max(2048),
      source: z.enum(["OFFICIAL_API", "AFFILIATE_FEED", "REMOTE_UNVERIFIED"]),
    })
    .nullable()
    .optional(),
  genericImageCategory: z
    .enum([
      "STROLLER",
      "PLUSH_RABBIT",
      "BABY_BOUNCER",
      "BABY_CRIB",
      "CLOTHING",
      "FEEDING",
      "BATH",
      "TOY",
      "OTHER",
    ])
    .optional(),
  identity: z
    .object({
      gtin: z
        .string()
        .regex(/^\d{8,14}$/)
        .nullable()
        .optional(),
      ean: z
        .string()
        .regex(/^\d{8,14}$/)
        .nullable()
        .optional(),
      mpn: z.string().max(120).nullable().optional(),
      brand: z.string().max(120).nullable().optional(),
      model: z.string().max(180).nullable().optional(),
    })
    .nullable()
    .optional(),
});
const listParams = z.object({ listId: z.string().uuid() });
const giftParams = listParams.extend({ giftId: z.string().uuid() });

export function giftRoutes(
  gifts: GiftsService,
  auth: AuthService,
  config: AppConfig,
): FastifyPluginAsync {
  const user = (request: FastifyRequest) => auth.authenticate(request.cookies[config.COOKIE_NAME]);
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
    app.get("/lists/:listId/gifts", async (request) => {
      const current = await user(request);
      const { listId } = listParams.parse(request.params);
      return jsonSafe({ gifts: await gifts.list(current.id, listId) });
    });
    app.post("/lists/:listId/gifts", async (request, reply) => {
      csrf(request);
      const current = await user(request);
      const { listId } = listParams.parse(request.params);
      return reply
        .status(201)
        .send(
          jsonSafe({ gift: await gifts.create(current.id, listId, giftInput.parse(request.body)) }),
        );
    });
    app.patch("/lists/:listId/gifts/:giftId", async (request) => {
      csrf(request);
      const current = await user(request);
      const { listId, giftId } = giftParams.parse(request.params);
      return jsonSafe({
        gift: await gifts.update(
          current.id,
          listId,
          giftId,
          giftInput.partial().parse(request.body),
        ),
      });
    });
    app.delete("/lists/:listId/gifts/:giftId", async (request, reply) => {
      csrf(request);
      const current = await user(request);
      const { listId, giftId } = giftParams.parse(request.params);
      await gifts.remove(current.id, listId, giftId);
      return reply.status(204).send();
    });
    app.post("/lists/:listId/gifts/:giftId/media", async (request, reply) => {
      csrf(request);
      const current = await user(request);
      const { listId, giftId } = giftParams.parse(request.params);
      const input = z
        .object({ storedObjectKey: z.string().min(10).max(1024), rightsConfirmed: z.literal(true) })
        .parse(request.body);
      return reply.status(201).send({
        media: await gifts.attachUserMedia(
          current.id,
          listId,
          giftId,
          input.storedObjectKey,
          input.rightsConfirmed,
        ),
      });
    });
    app.put("/lists/:listId/gifts/order", async (request, reply) => {
      csrf(request);
      const current = await user(request);
      const { listId } = listParams.parse(request.params);
      const { giftIds } = z
        .object({ giftIds: z.array(z.string().uuid()).max(1_000) })
        .parse(request.body);
      await gifts.reorder(current.id, listId, giftIds);
      return reply.status(204).send();
    });
  };
}

function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)),
  ) as T;
}
