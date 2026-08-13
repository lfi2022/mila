import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import type { AuthService } from "../auth/service.js";
import { MemoriesService } from "./service.js";

const token = z.string().min(32).max(128);
const listParams = z.object({ listId: z.string().uuid() });

export function memoryRoutes(
  service: MemoriesService,
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
    app.post(
      "/public/second-hand-offers",
      { config: { rateLimit: { max: 8, timeWindow: 60_000 } } },
      async (request, reply) => {
        const input = z
          .object({
            giftToken: z.string().length(64),
            proposerName: z.string().trim().min(1).max(120),
            proposerEmail: z.string().email().max(255).nullable().optional(),
            condition: z.enum(["LIKE_NEW", "VERY_GOOD", "GOOD", "FAIR"]),
            comment: z.string().max(2_000).nullable().optional(),
          })
          .parse(request.body);
        return reply.status(201).send(jsonSafe(await service.createSecondHandOffer(input)));
      },
    );
    app.post("/public/second-hand-offers/manage", async (request) => ({
      offer: await service.getSecondHandOffer(z.object({ token }).parse(request.body).token),
    }));
    app.post("/public/second-hand-offers/manage/photo/presign", async (request) => {
      const input = z
        .object({ token, mimeType: z.string().max(120), sizeBytes: z.number().int().positive() })
        .parse(request.body);
      return {
        upload: await service.presignSecondHandPhoto(input.token, input.mimeType, input.sizeBytes),
      };
    });
    app.post("/public/second-hand-offers/manage/photo/verify", async (request) => {
      const input = z
        .object({
          token,
          key: z.string().max(1024),
          mimeType: z.string().max(120),
          sizeBytes: z.number().int().positive(),
        })
        .parse(request.body);
      return jsonSafe({
        offer: await service.verifySecondHandPhoto(
          input.token,
          input.key,
          input.mimeType,
          input.sizeBytes,
        ),
      });
    });
    app.post("/public/second-hand-offers/manage/withdraw", async (request, reply) => {
      await service.withdrawSecondHandOffer(z.object({ token }).parse(request.body).token);
      return reply.status(204).send();
    });
    app.post("/public/reservations/manage/messages", async (request, reply) => {
      const input = z
        .object({ token, text: z.string().max(5_000).nullable().optional() })
        .parse(request.body);
      return reply
        .status(201)
        .send({ message: await service.createReservationMessage(input.token, input.text) });
    });
    app.post("/public/reservations/manage/messages/:messageId/media/presign", async (request) => {
      const { messageId } = z.object({ messageId: z.string().uuid() }).parse(request.params);
      const input = z
        .object({ token, mimeType: z.string().max(120), sizeBytes: z.number().int().positive() })
        .parse(request.body);
      return {
        upload: await service.presignMessageMedia(
          input.token,
          messageId,
          input.mimeType,
          input.sizeBytes,
        ),
      };
    });
    app.post(
      "/public/reservations/manage/messages/:messageId/media/verify",
      async (request, reply) => {
        const { messageId } = z.object({ messageId: z.string().uuid() }).parse(request.params);
        const input = z
          .object({
            token,
            key: z.string().max(1024),
            mimeType: z.string().max(120),
            sizeBytes: z.number().int().positive(),
            durationSeconds: z.number().int().positive().max(300).optional(),
          })
          .parse(request.body);
        return reply.status(201).send(
          jsonSafe({
            media: await service.verifyMessageMedia(
              input.token,
              messageId,
              input.key,
              input.mimeType,
              input.sizeBytes,
              input.durationSeconds,
            ),
          }),
        );
      },
    );

    app.get("/lists/:listId/second-hand-offers", async (request) => {
      const user = await current(request);
      const { listId } = listParams.parse(request.params);
      return jsonSafe({ offers: await service.listSecondHandOffers(user.id, listId) });
    });
    app.post("/lists/:listId/second-hand-offers/:offerId/review", async (request) => {
      csrf(request);
      const user = await current(request);
      const { listId, offerId } = z
        .object({ listId: z.string().uuid(), offerId: z.string().uuid() })
        .parse(request.params);
      const input = z
        .object({ accept: z.boolean(), comment: z.string().max(1_000).optional() })
        .parse(request.body);
      return {
        offer: await service.reviewSecondHandOffer(
          user.id,
          listId,
          offerId,
          input.accept,
          input.comment,
        ),
      };
    });
    app.post("/lists/:listId/second-hand-offers/:offerId/photo", async (request) => {
      const user = await current(request);
      const { listId, offerId } = z
        .object({ listId: z.string().uuid(), offerId: z.string().uuid() })
        .parse(request.params);
      return { url: await service.secondHandPhotoUrl(user.id, listId, offerId) };
    });
    app.get("/lists/:listId/messages", async (request) => {
      const user = await current(request);
      const { listId } = listParams.parse(request.params);
      return jsonSafe({ messages: await service.listMessages(user.id, listId) });
    });
    app.patch("/lists/:listId/messages/:messageId/memory-approval", async (request, reply) => {
      csrf(request);
      const user = await current(request);
      const { listId, messageId } = z
        .object({ listId: z.string().uuid(), messageId: z.string().uuid() })
        .parse(request.params);
      const { approved } = z.object({ approved: z.boolean() }).parse(request.body);
      await service.approveMessage(user.id, listId, messageId, approved);
      return reply.status(204).send();
    });
    app.post("/lists/:listId/media/:assetId/download", async (request) => {
      const user = await current(request);
      const { listId, assetId } = z
        .object({ listId: z.string().uuid(), assetId: z.string().uuid() })
        .parse(request.params);
      return { url: await service.messageMediaUrl(user.id, listId, assetId) };
    });
    app.delete("/lists/:listId/media/:assetId", async (request, reply) => {
      csrf(request);
      const user = await current(request);
      const { listId, assetId } = z
        .object({ listId: z.string().uuid(), assetId: z.string().uuid() })
        .parse(request.params);
      await service.deleteMessageMedia(user.id, listId, assetId);
      return reply.status(204).send();
    });
    app.get("/lists/:listId/thank-yous", async (request) => {
      const user = await current(request);
      const { listId } = listParams.parse(request.params);
      const { unthanked } = z
        .object({ unthanked: z.enum(["true", "false"]).optional() })
        .parse(request.query);
      return jsonSafe({
        reservations: await service.thankYouCenter(user.id, listId, unthanked === "true"),
      });
    });
    app.patch("/lists/:listId/thank-yous/:reservationId", async (request) => {
      csrf(request);
      const user = await current(request);
      const { listId, reservationId } = z
        .object({ listId: z.string().uuid(), reservationId: z.string().uuid() })
        .parse(request.params);
      const input = z
        .object({
          received: z.boolean().optional(),
          thanked: z.boolean().optional(),
          draft: z.string().max(5_000).nullable().optional(),
          approveDraft: z.boolean().optional(),
          cardTheme: z.string().min(1).max(64).optional(),
          cardMessage: z.string().min(1).max(5_000).optional(),
        })
        .parse(request.body);
      return { thankYou: await service.updateThankYou(user.id, listId, reservationId, input) };
    });
    app.get("/lists/:listId/thank-yous/export", async (request, reply) => {
      const user = await current(request);
      const { listId } = listParams.parse(request.params);
      return reply
        .type("text/csv; charset=utf-8")
        .header("content-disposition", `attachment; filename="mila-remerciements-${listId}.csv"`)
        .send(await service.thankYouExport(user.id, listId));
    });
    app.get("/lists/:listId/thank-yous/:reservationId/card", async (request, reply) => {
      const user = await current(request);
      const { listId, reservationId } = z
        .object({ listId: z.string().uuid(), reservationId: z.string().uuid() })
        .parse(request.params);
      return reply
        .type("text/html; charset=utf-8")
        .send(await service.digitalCard(user.id, listId, reservationId));
    });
    app.get("/lists/:listId/memory-book", async (request) => {
      const user = await current(request);
      const { listId } = listParams.parse(request.params);
      return jsonSafe(await service.memoryBook(user.id, listId));
    });
    app.patch("/lists/:listId/memory-book", async (request) => {
      csrf(request);
      const user = await current(request);
      const { listId } = listParams.parse(request.params);
      const input = z
        .object({
          theme: z.string().min(1).max(64).optional(),
          title: z.string().max(180).nullable().optional(),
          introduction: z.string().max(10_000).nullable().optional(),
          retentionMonths: z.number().int().min(1).max(120).optional(),
        })
        .parse(request.body);
      return { book: await service.updateMemoryBook(user.id, listId, input) };
    });
    app.post("/lists/:listId/memory-book/items", async (request, reply) => {
      csrf(request);
      const user = await current(request);
      const { listId } = listParams.parse(request.params);
      const input = z
        .object({
          sourceType: z.enum(["MESSAGE", "GIFT"]),
          sourceId: z.string().uuid(),
          caption: z.string().max(1_000).nullable().optional(),
          position: z.number().int().min(0).max(10_000).optional(),
        })
        .parse(request.body);
      return reply.status(201).send({ item: await service.addMemoryItem(user.id, listId, input) });
    });
    app.delete("/lists/:listId/memory-book/items/:itemId", async (request, reply) => {
      csrf(request);
      const user = await current(request);
      const { listId, itemId } = z
        .object({ listId: z.string().uuid(), itemId: z.string().uuid() })
        .parse(request.params);
      await service.removeMemoryItem(user.id, listId, itemId);
      return reply.status(204).send();
    });
    app.get("/lists/:listId/memory-book/print", async (request, reply) => {
      const user = await current(request);
      const { listId } = listParams.parse(request.params);
      return reply
        .type("text/html; charset=utf-8")
        .header("content-disposition", `attachment; filename="mila-souvenirs-${listId}.html"`)
        .send(await service.printReadyMemoryBook(user.id, listId));
    });
  };
}

function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)),
  ) as T;
}
