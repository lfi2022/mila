import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { AppError } from "../../common/errors/app-error.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { AppConfig } from "../../config/env.js";
import { AuthService } from "../auth/service.js";

export function notificationRoutes(
  prisma: PrismaClient,
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
    app.get("/notifications", async (request) => {
      const current = await user(request);
      return {
        notifications: await prisma.notification.findMany({
          where: { userId: current.id },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      };
    });
    app.post("/notifications/:notificationId/read", async (request, reply) => {
      csrf(request);
      const current = await user(request);
      const { notificationId } = z
        .object({ notificationId: z.string().uuid() })
        .parse(request.params);
      await prisma.notification.updateMany({
        where: { id: notificationId, userId: current.id },
        data: { readAt: new Date() },
      });
      return reply.status(204).send();
    });
    app.get("/notification-preferences", async (request) => {
      const current = await user(request);
      return {
        preferences: await prisma.notificationPreference.findMany({
          where: { userId: current.id },
          orderBy: { type: "asc" },
        }),
      };
    });
    app.put("/notification-preferences/:type", async (request) => {
      csrf(request);
      const current = await user(request);
      const { type } = z
        .object({ type: z.string().regex(/^[A-Z0-9_]{1,64}$/) })
        .parse(request.params);
      const input = z
        .object({
          inAppEnabled: z.boolean(),
          emailEnabled: z.boolean(),
          digest: z.enum(["IMMEDIATE", "DAILY", "WEEKLY", "NEVER"]),
        })
        .parse(request.body);
      return {
        preference: await prisma.notificationPreference.upsert({
          where: { userId_type: { userId: current.id, type } },
          create: { userId: current.id, type, ...input },
          update: input,
        }),
      };
    });
  };
}
