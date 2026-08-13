import { timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";

import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import type { AuthService } from "../auth/service.js";
import type { OrdersService } from "./service.js";

const status = z.enum([
  "DRAFT",
  "READY",
  "WAITING_PARENT",
  "SUBMITTED",
  "PARTIALLY_ORDERED",
  "ORDERED",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
]);

export function orderRoutes(
  service: OrdersService,
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
  return async (app) => {
    app.get("/orders", async (request) => service.center((await current(request)).id));
    app.post("/lists/:listId/orders/prepare", async (request, reply) => {
      csrf(request);
      const user = await current(request);
      const { listId } = z.object({ listId: z.string().uuid() }).parse(request.params);
      const input = z
        .object({
          giftIds: z
            .array(z.string().uuid())
            .min(1)
            .max(config.ORDER_PREPARATION_MAX_ITEMS)
            .optional(),
          orderMode: z.enum(["MANUAL_PARENT", "ASSISTED_PARENT", "AUTOMATIC_PLATFORM"]),
          deliveryMode: z.string().trim().max(64).optional(),
          destination: z.record(z.unknown()),
          windowStart: z.coerce.date().optional(),
          windowEnd: z.coerce.date().optional(),
        })
        .parse(request.body);
      return reply.status(201).send(await service.prepare(user.id, listId, input));
    });
    app.patch("/orders/:groupId/items/:itemId", async (request) => {
      csrf(request);
      const user = await current(request);
      const { groupId, itemId } = z
        .object({ groupId: z.string().uuid(), itemId: z.string().uuid() })
        .parse(request.params);
      const input = z
        .object({
          quantity: z.number().int().min(1).max(65_535).optional(),
          selectedVariant: z.record(z.unknown()).nullable().optional(),
          included: z.boolean().optional(),
          deliveryAmountMinor: z.string().regex(/^\d+$/).max(18).optional(),
        })
        .refine((value) => Object.keys(value).length > 0)
        .parse(request.body);
      const { deliveryAmountMinor, ...itemInput } = input;
      return {
        item: await service.updateItem(user.id, groupId, itemId, {
          ...itemInput,
          ...(deliveryAmountMinor !== undefined
            ? { deliveryAmountMinor: BigInt(deliveryAmountMinor) }
            : {}),
        }),
      };
    });
    app.put("/orders/:groupId/items/:itemId/contribution-allocation", async (request) => {
      csrf(request);
      const user = await current(request);
      const { groupId, itemId } = z
        .object({ groupId: z.string().uuid(), itemId: z.string().uuid() })
        .parse(request.params);
      const { amountMinor } = z
        .object({ amountMinor: z.string().regex(/^\d+$/).max(18) })
        .parse(request.body);
      return service.planContribution(user.id, groupId, itemId, BigInt(amountMinor));
    });
    app.post("/orders/:groupId/status", async (request) => {
      csrf(request);
      const user = await current(request);
      const { groupId } = z.object({ groupId: z.string().uuid() }).parse(request.params);
      const input = z
        .object({
          status,
          reason: z.string().trim().min(3).max(500).optional(),
          externalOrderReference: z.string().trim().min(1).max(255).optional(),
          trackingUrl: z.string().url().max(2048).optional(),
        })
        .parse(request.body);
      return service.transition(user.id, groupId, input.status, input);
    });
  };
}
