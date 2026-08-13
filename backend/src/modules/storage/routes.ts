import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { AppError } from "../../common/errors/app-error.js";
import { StorageService, type UploadPurpose } from "../../common/storage/service.js";
import type { AppConfig } from "../../config/env.js";
import { AuthService } from "../auth/service.js";
import type { ListsService } from "../lists/service.js";

const upload = z.object({
  purpose: z.enum(["product-image", "list-cover", "user-upload", "media-message", "export"]),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive(),
});

export function storageRoutes(
  storage: StorageService,
  auth: AuthService,
  config: AppConfig,
  lists: ListsService,
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
    app.post("/storage/uploads/presign", async (request) => {
      csrf(request);
      const user = await current(request);
      const input = upload.parse(request.body);
      return {
        upload: await storage.presignUpload(
          user.id,
          input.purpose,
          input.mimeType,
          input.sizeBytes,
        ),
      };
    });
    app.post("/storage/uploads/verify", async (request) => {
      csrf(request);
      const user = await current(request);
      const input = upload
        .extend({ key: z.string().min(10).max(1_024), listId: z.string().uuid().optional() })
        .parse(request.body);
      if (input.listId && input.purpose !== "list-cover") {
        throw new AppError(400, "UPLOAD_ASSOCIATION_INVALID", "List association requires a cover");
      }
      if (input.purpose === "list-cover" && !input.listId) {
        throw new AppError(400, "UPLOAD_ASSOCIATION_REQUIRED", "List cover requires a list ID");
      }
      const verified = await storage.verifyUpload(
        user.id,
        input.purpose,
        input.key,
        input.mimeType,
        input.sizeBytes,
      );
      if (input.listId) await lists.setCover(user.id, input.listId, input.key);
      return {
        upload: verified,
      };
    });
    app.post("/storage/download", async (request) => {
      const user = await current(request);
      const input = z
        .object({ purpose: upload.shape.purpose, key: z.string().min(10).max(1_024) })
        .parse(request.body);
      storage.assertOwnedKey(user.id, input.key);
      return { url: await storage.signedDownload(input.purpose as UploadPurpose, input.key) };
    });
    app.delete("/storage/uploads", async (request, reply) => {
      csrf(request);
      const user = await current(request);
      const input = z
        .object({ purpose: upload.shape.purpose, key: z.string().min(10).max(1_024) })
        .parse(request.body);
      await storage.deleteOwned(user.id, input.purpose, input.key);
      return reply.status(204).send();
    });
  };
}
