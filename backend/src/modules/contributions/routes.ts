import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import type { AuthService } from "../auth/service.js";
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
    app.post("/lists/:listId/contributions/:contributionId/confirm", async (request) => {
      csrf(request);
      const user = await current(request);
      const { listId, contributionId } = z
        .object({ listId: z.string().uuid(), contributionId: z.string().uuid() })
        .parse(request.params);
      return service.confirmByParent(user.id, listId, contributionId);
    });
    app.post("/lists/:listId/contributions/:contributionId/cancel", async (request) => {
      csrf(request);
      const user = await current(request);
      const { listId, contributionId } = z
        .object({ listId: z.string().uuid(), contributionId: z.string().uuid() })
        .parse(request.params);
      return service.cancelByParent(user.id, listId, contributionId);
    });
  };
}
