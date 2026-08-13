import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";

import { installErrorHandler } from "./common/http/error-handler.js";
import type { DatabaseService } from "./common/database/client.js";
import type { RedisService } from "./common/redis/client.js";
import { allowedOrigins, loadConfig, type AppConfig } from "./config/env.js";
import { healthRoutes, type ReadinessProbe } from "./modules/health/routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import { AuthService } from "./modules/auth/service.js";
import { MODULE_NAMES } from "./modules/index.js";

export type AppOptions = {
  config?: AppConfig;
  readinessProbe?: ReadinessProbe;
  database?: DatabaseService;
  redis?: RedisService;
  logger?: boolean;
};

export async function createApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const origins = allowedOrigins(config);
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            level: config.LOG_LEVEL,
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "res.headers.set-cookie",
                "password",
                "token",
                "*.password",
                "*.token",
              ],
              censor: "[REDACTED]",
            },
          },
    trustProxy: config.TRUST_PROXY,
    bodyLimit: config.REQUEST_BODY_LIMIT_BYTES,
    genReqId: () => randomUUID(),
  });

  await app.register(helmet, { global: true, contentSecurityPolicy: false });
  await app.register(cookie);
  await app.register(cors, {
    credentials: true,
    origin(origin, callback) {
      if (!origin || origins.has(origin.replace(/\/$/, ""))) return callback(null, true);
      return callback(new Error("Origin not allowed"), false);
    },
  });
  await app.register(rateLimit, {
    global: true,
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    keyGenerator: (request) => request.ip,
    redis: options.redis?.client,
  });
  await app.register(swagger, {
    openapi: {
      info: { title: "Mila API", version: "1.0.0" },
      servers: [{ url: config.API_PUBLIC_URL }],
      tags: MODULE_NAMES.map((name) => ({ name })),
    },
  });
  await app.register(swaggerUi, { routePrefix: "/api/docs" });

  installErrorHandler(app);

  if (options.database) {
    app.addHook("onClose", () => options.database?.close());
  }
  if (options.redis) {
    app.addHook("onClose", () => options.redis?.close());
  }

  await app.register(
    async (api) => {
      api.get("/", { schema: { tags: ["health"] } }, async () => ({
        name: config.APP_NAME,
        version: "v1",
        modules: MODULE_NAMES,
      }));
      await api.register(
        healthRoutes(
          options.readinessProbe ??
            (options.database || options.redis
              ? async () => ({
                  ...(options.database ? { database: await options.database.check() } : {}),
                  ...(options.redis ? { redis: await options.redis.check() } : {}),
                })
              : async () => ({ application: "up" })),
        ),
        { prefix: "/health" },
      );
      if (options.database) {
        await api.register(authRoutes(new AuthService(options.database.client, config), config), {
          prefix: "/auth",
        });
      }
    },
    { prefix: "/api/v1" },
  );

  return app;
}
