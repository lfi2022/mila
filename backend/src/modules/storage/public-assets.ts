import type { FastifyPluginAsync } from "fastify";
import type { Readable } from "node:stream";
import { z } from "zod";

import { AppError } from "../../common/errors/app-error.js";
import type { StorageService, UploadPurpose } from "../../common/storage/service.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

export function publicAssetRoutes(
  storage: StorageService,
  prisma: PrismaClient,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/:purpose/*", async (request, reply) => {
      const params = z
        .object({ purpose: z.enum(["list-cover", "product-image"]), "*": z.string().min(10) })
        .parse(request.params);
      const key = params["*"];
      if (key.includes("..")) throw new AppError(400, "ASSET_KEY_INVALID", "Asset key is invalid");
      const visible = await isVisible(prisma, params.purpose, key);
      if (!visible) throw new AppError(404, "ASSET_NOT_FOUND", "Asset not found");
      const object = await storage.readObject(params.purpose as UploadPurpose, key, true);
      reply.header("cache-control", "public, max-age=3600, stale-while-revalidate=86400");
      if (object.ContentType) reply.type(object.ContentType);
      if (object.ETag) reply.header("etag", object.ETag);
      return reply.send(object.Body as Readable);
    });
  };
}

async function isVisible(
  prisma: PrismaClient,
  purpose: "list-cover" | "product-image",
  key: string,
) {
  if (purpose === "list-cover") {
    return Boolean(
      await prisma.giftList.findFirst({
        where: {
          coverMediaKey: key,
          deletedAt: null,
          status: "ACTIVE",
          visibility: { in: ["PUBLIC", "UNLISTED"] },
        },
        select: { id: true },
      }),
    );
  }
  return Boolean(
    await prisma.productMedia.findFirst({
      where: {
        storedObjectKey: key,
        usageStatus: { in: ["AUTHORIZED", "AUTHORIZED_CACHE", "USER_DECLARED"] },
        status: "ACTIVE",
        gift: {
          deletedAt: null,
          list: {
            deletedAt: null,
            status: "ACTIVE",
            visibility: { in: ["PUBLIC", "UNLISTED"] },
          },
        },
      },
      select: { id: true },
    }),
  );
}
