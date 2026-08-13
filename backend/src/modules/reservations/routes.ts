import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { ReservationsService } from "./service.js";
import type { AuthService } from "../auth/service.js";
import type { AppConfig } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";

const tokenBody = z.object({ token: z.string().min(32).max(256) });

export function reservationRoutes(
  service: ReservationsService,
  auth?: AuthService,
  config?: AppConfig,
): FastifyPluginAsync {
  return async (app) => {
    app.post(
      "/public/reservations",
      { config: { rateLimit: { max: 12, timeWindow: 60_000 } } },
      async (request, reply) => {
        const input = z
          .object({
            giftToken: z.string().length(64),
            guestName: z.string().trim().min(1).max(80),
            guestEmail: z.string().email().max(255).nullable().optional(),
            message: z.string().max(800).nullable().optional(),
            quantity: z.number().int().min(1).max(100),
          })
          .parse(request.body);
        return reply.status(201).send(await service.create(input));
      },
    );

    app.post("/public/reservations/manage", async (request) => ({
      reservation: await service.get(tokenBody.parse(request.body).token),
    }));

    app.patch("/public/reservations/manage/message", async (request) => {
      const input = tokenBody
        .extend({ message: z.string().max(800).nullable() })
        .parse(request.body);
      return { reservation: await service.updateMessage(input.token, input.message) };
    });

    app.post("/public/reservations/manage/purchased", async (request, reply) => {
      await service.markPurchased(tokenBody.parse(request.body).token);
      return reply.status(204).send();
    });

    app.post("/public/reservations/manage/cancel", async (request, reply) => {
      await service.cancel(tokenBody.parse(request.body).token);
      return reply.status(204).send();
    });

    if (auth && config) {
      const current = (request: FastifyRequest) =>
        auth.authenticate(request.cookies[config.COOKIE_NAME]);
      const csrf = (request: FastifyRequest) => {
        const cookie = request.cookies[`${config.COOKIE_NAME}_csrf`] ?? "";
        const header = request.headers["x-csrf-token"];
        const left = Buffer.from(cookie);
        const right = Buffer.from(typeof header === "string" ? header : "");
        if (!cookie || left.length !== right.length || !timingSafeEqual(left, right)) {
          throw new AppError(403, "CSRF_INVALID", "CSRF validation failed");
        }
      };
      app.get("/lists/:listId/reservations", async (request) => {
        const user = await current(request);
        const { listId } = z.object({ listId: z.string().uuid() }).parse(request.params);
        return { reservations: await service.listForManager(user.id, listId) };
      });
      app.delete("/lists/:listId/reservations/:reservationId", async (request, reply) => {
        csrf(request);
        const user = await current(request);
        const params = z
          .object({ listId: z.string().uuid(), reservationId: z.string().uuid() })
          .parse(request.params);
        await service.cancelForManager(user.id, params.listId, params.reservationId);
        return reply.status(204).send();
      });
    }
  };
}
