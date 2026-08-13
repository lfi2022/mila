import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import type { AuthService, AuthUser } from "../auth/service.js";
import type { ContributionsService } from "./service.js";

export function contributionRoutes(
  service: ContributionsService,
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
    app.get("/public/contributions/:giftToken", async (request) => {
      const { giftToken } = z.object({ giftToken: z.string().length(64) }).parse(request.params);
      return service.publicStatus(giftToken);
    });
    app.post(
      "/public/contributions/:giftToken/bank-transfer",
      { config: { rateLimit: { max: 10, timeWindow: 3_600_000 } } },
      async (request, reply) => {
        const { giftToken } = z.object({ giftToken: z.string().length(64) }).parse(request.params);
        const input = z
          .object({
            amountCents: z.number().int().positive().max(100_000_000),
            contributorName: z.string().trim().max(120).optional(),
            contributorEmail: z.string().email().max(255).optional(),
            anonymous: z.boolean().default(false),
            message: z.string().trim().max(800).optional(),
          })
          .parse(request.body);
        const idempotencyKey = z
          .string()
          .min(8)
          .max(128)
          .parse(request.headers["x-idempotency-key"]);
        return reply
          .status(201)
          .send(await service.createBankTransfer({ giftToken, ...input, idempotencyKey }));
      },
    );
    app.get("/lists/:listId/contributions", async (request) => {
      const user = await current(request);
      const { listId } = z.object({ listId: z.string().uuid() }).parse(request.params);
      return service.listForManager(user.id, listId);
    });
    app.post("/admin/bank-transfers/reconcile", async (request) => {
      csrf(request);
      const user = await current(request);
      staff(user);
      const input = z
        .object({
          reference: z.string().trim().min(8).max(64),
          receivedCents: z.number().int().positive(),
          payerName: z.string().trim().min(1).max(180),
          approve: z.boolean().default(true),
        })
        .parse(request.body);
      return service.reconcileTransfer(
        user.id,
        input.reference,
        input.receivedCents,
        input.payerName,
        input.approve,
        request.id,
      );
    });
    app.post("/admin/bank-transfers/import", async (request) => {
      csrf(request);
      const user = await current(request);
      staff(user);
      const { rows } = z
        .object({
          rows: z
            .array(
              z.object({
                reference: z.string().trim().min(8).max(64),
                receivedCents: z.number().int().positive(),
                payerName: z.string().trim().min(1).max(180),
              }),
            )
            .min(1)
            .max(500),
        })
        .parse(request.body);
      return service.importBankTransfers(user.id, rows, request.id);
    });
    app.post("/admin/contributions/:contributionId/refund", async (request) => {
      csrf(request);
      const user = await current(request);
      staff(user);
      const { contributionId } = z
        .object({ contributionId: z.string().uuid() })
        .parse(request.params);
      const { reason } = z
        .object({ reason: z.string().trim().min(3).max(500) })
        .parse(request.body);
      return service.refundContribution(user.id, contributionId, reason, request.id);
    });
  };
}
