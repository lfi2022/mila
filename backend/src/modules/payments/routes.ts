import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import type { AuthService, AuthUser } from "../auth/service.js";
import type { PaymentsService } from "./service.js";

const idempotency = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9:_-]+$/);

export function paymentRoutes(
  service: PaymentsService,
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
  const key = (request: FastifyRequest) => idempotency.parse(request.headers["x-idempotency-key"]);
  const staff = (user: AuthUser) => {
    if (!user.roles.some((role) => ["ADMIN", "SUPER_ADMIN"].includes(role)))
      throw new AppError(403, "ADMIN_REQUIRED", "Administrator access required");
  };
  return async (app) => {
    app.get("/payments/methods", async (request) => service.methods((await current(request)).id));
    app.get("/payments/premium/:listId", async (request) => {
      const user = await current(request);
      const { listId } = z.object({ listId: z.string().uuid() }).parse(request.params);
      return service.premiumStatus(user.id, listId);
    });
    app.post("/payments/premium/:listId", async (request) => {
      csrf(request);
      const user = await current(request);
      const { listId } = z.object({ listId: z.string().uuid() }).parse(request.params);
      const { useRewards } = z
        .object({ useRewards: z.boolean().default(false) })
        .parse(request.body ?? {});
      return service.createPremium(user.id, listId, key(request), useRewards);
    });
    app.get("/payments/:paymentId", async (request) => {
      const user = await current(request);
      const { paymentId } = z.object({ paymentId: z.string().uuid() }).parse(request.params);
      const { reconcile } = z
        .object({ reconcile: z.coerce.boolean().default(false) })
        .parse(request.query);
      return service.getPayment(user.id, paymentId, reconcile);
    });
    app.post(
      "/webhooks/mollie",
      { config: { rateLimit: { max: 300, timeWindow: 60_000 } } },
      async (request, reply) => {
        const parsed = z
          .object({ id: z.string().regex(/^tr_[A-Za-z0-9]+$/) })
          .safeParse(request.body);
        if (parsed.success) await service.reconcileExternal(parsed.data.id);
        return reply.status(200).send("OK");
      },
    );
    app.post("/admin/payments/:paymentId/refunds", async (request, reply) => {
      csrf(request);
      const user = await current(request);
      staff(user);
      const { paymentId } = z.object({ paymentId: z.string().uuid() }).parse(request.params);
      const input = z
        .object({
          amountCents: z.number().int().positive(),
          reason: z.string().trim().min(3).max(255),
        })
        .parse(request.body);
      const result = await service.refund(
        user.id,
        paymentId,
        BigInt(input.amountCents),
        input.reason,
        key(request),
      );
      return reply.status(202).send(result);
    });
    app.get("/admin/payments", async (request) => {
      const user = await current(request);
      staff(user);
      return service.adminList();
    });
    app.post("/admin/payments/:paymentId/reconcile", async (request) => {
      csrf(request);
      const user = await current(request);
      staff(user);
      const { paymentId } = z.object({ paymentId: z.string().uuid() }).parse(request.params);
      return service.reconcilePayment(paymentId);
    });
  };
}
