import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { ReservationsService } from "./service.js";

const tokenBody = z.object({ token: z.string().min(32).max(256) });

export function reservationRoutes(service: ReservationsService): FastifyPluginAsync {
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
  };
}
