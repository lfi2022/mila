import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";

import type { AppConfig } from "../../config/env.js";
import { AuthService } from "../auth/service.js";
import { extractProduct } from "./extractor.js";
import { selectConnector, StructuredMetadataConnector } from "./connectors.js";

export function productRoutes(auth: AuthService, config: AppConfig): FastifyPluginAsync {
  return async (app) => {
    app.post(
      "/products/preview",
      { config: { rateLimit: { max: 20, timeWindow: 60_000 } } },
      async (request: FastifyRequest) => {
        await auth.authenticate(request.cookies[config.COOKIE_NAME]);
        const { url } = z.object({ url: z.string().trim().min(8).max(2048) }).parse(request.body);
        const target = new URL(url);
        const connector = selectConnector(target, [new StructuredMetadataConnector(config)]);
        const preview = connector
          ? await connector.preview(target)
          : await extractProduct(url, config);
        return { preview: { ...preview, priceMinor: preview.priceMinor?.toString() ?? null } };
      },
    );
  };
}
