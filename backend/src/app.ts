import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import formbody from "@fastify/formbody";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { LogController, type FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";

import { installErrorHandler } from "./common/http/error-handler.js";
import type { DatabaseService } from "./common/database/client.js";
import type { RedisService } from "./common/redis/client.js";
import type { StorageService } from "./common/storage/service.js";
import { allowedOrigins, loadConfig, type AppConfig } from "./config/env.js";
import { healthRoutes, type ReadinessProbe } from "./modules/health/routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import { AuthService } from "./modules/auth/service.js";
import { listRoutes } from "./modules/lists/routes.js";
import { ListsService } from "./modules/lists/service.js";
import { productRoutes } from "./modules/products/routes.js";
import { giftRoutes } from "./modules/gifts/routes.js";
import { GiftsService } from "./modules/gifts/service.js";
import { ProductRefreshQueue } from "./modules/products/refresh-queue.js";
import { NotificationQueue } from "./modules/notifications/queue.js";
import { reservationRoutes } from "./modules/reservations/routes.js";
import { ReservationsService } from "./modules/reservations/service.js";
import { notificationRoutes } from "./modules/notifications/routes.js";
import { storageRoutes } from "./modules/storage/routes.js";
import { publicAssetRoutes } from "./modules/storage/public-assets.js";
import { MODULE_NAMES } from "./modules/index.js";
import { AffiliationService } from "./modules/affiliation/service.js";
import { affiliationRoutes } from "./modules/affiliation/routes.js";
import { merchantRoutes } from "./modules/merchants/routes.js";
import { RewardsService } from "./modules/rewards/service.js";
import { rewardRoutes } from "./modules/rewards/routes.js";
import { MollieClient } from "./modules/payments/mollie.js";
import { PaymentsService } from "./modules/payments/service.js";
import { paymentRoutes } from "./modules/payments/routes.js";
import { ContributionsService } from "./modules/contributions/service.js";
import { contributionRoutes } from "./modules/contributions/routes.js";
import { PricesService } from "./modules/prices/service.js";
import { priceRoutes } from "./modules/prices/routes.js";
import { OrdersService } from "./modules/orders/service.js";
import { orderRoutes } from "./modules/orders/routes.js";
import { MemoriesService } from "./modules/memories/service.js";
import { memoryRoutes } from "./modules/memories/routes.js";
import { AdminService } from "./modules/admin/service.js";
import { adminRoutes } from "./modules/admin/routes.js";
import { reportRoutes } from "./modules/reports/routes.js";
import { analyticsRoutes } from "./modules/analytics/routes.js";
import { partnerRoutes } from "./modules/partners/routes.js";
import { privacyRoutes } from "./modules/privacy/routes.js";
import { PartnersService } from "./modules/partners/service.js";
import {
  installRequestObservability,
  MetricsRegistry,
  OperationalMetrics,
} from "./common/observability/metrics.js";

export type AppOptions = {
  config?: AppConfig;
  readinessProbe?: ReadinessProbe;
  database?: DatabaseService;
  redis?: RedisService;
  storage?: StorageService;
  logger?: boolean;
};

export async function createApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const origins = allowedOrigins(config);
  const metrics = new MetricsRegistry();
  const app = Fastify({
    logController: new LogController({ disableRequestLogging: true }),
    logger:
      options.logger === false
        ? false
        : {
            level: config.LOG_LEVEL,
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "req.headers.x-csrf-token",
                "res.headers.set-cookie",
                "config.OBSERVABILITY_TOKEN",
                "config.MOLLIE_API_KEY",
                "config.SMTP_PASSWORD",
                "config.STORAGE_SECRET_KEY",
                "config.BANK_TRANSFER_IBAN",
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

  installRequestObservability(app, metrics);

  await app.register(helmet, { global: true, contentSecurityPolicy: false });
  await app.register(cookie);
  await app.register(formbody);
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

  installErrorHandler(app, metrics);

  if (options.database) {
    app.addHook("onClose", () => options.database?.close());
  }
  if (options.redis) {
    app.addHook("onClose", () => options.redis?.close());
  }
  if (options.storage) {
    app.addHook("onClose", () => options.storage?.close());
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
                  ...(options.storage ? { storage: await options.storage.check() } : {}),
                })
              : async () => ({ application: "up" })),
          config,
          metrics,
          new OperationalMetrics(config, options.database?.client, options.redis),
        ),
        { prefix: "/health" },
      );
      if (options.database) {
        const notifications = options.redis ? new NotificationQueue(options.redis) : undefined;
        const auth = new AuthService(options.database.client, config, notifications);
        await api.register(privacyRoutes(options.database.client, config));
        await api.register(authRoutes(auth, config), {
          prefix: "/auth",
        });
        const lists = new ListsService(options.database.client, config, notifications);
        const rewards = new RewardsService(options.database.client, config, lists);
        await api.register(listRoutes(lists, auth, config));
        await api.register(
          giftRoutes(
            new GiftsService(
              options.database.client,
              lists,
              options.redis ? new ProductRefreshQueue(options.redis) : undefined,
            ),
            auth,
            config,
          ),
        );
        await api.register(
          priceRoutes(new PricesService(options.database.client, config, lists), auth, config),
        );
        await api.register(
          orderRoutes(new OrdersService(options.database.client, config, lists), auth, config),
        );
        await api.register(
          memoryRoutes(
            new MemoriesService(options.database.client, config, lists, options.storage),
            auth,
            config,
          ),
        );
        await api.register(adminRoutes(new AdminService(options.database.client), auth, config));
        await api.register(reportRoutes(options.database.client, config));
        await api.register(analyticsRoutes(options.database.client, config));
        await api.register(
          partnerRoutes(new PartnersService(options.database.client, config), auth, config),
        );
        await api.register(
          contributionRoutes(
            new ContributionsService(options.database.client, config, lists),
            auth,
            config,
          ),
        );
        await api.register(notificationRoutes(options.database.client, auth, config));
        if (options.storage)
          await api.register(storageRoutes(options.storage, auth, config, lists));
        await api.register(productRoutes(auth, config));
        await api.register(
          affiliationRoutes(
            new AffiliationService(options.database.client, config, (id) =>
              rewards.reconcileCommission(id),
            ),
          ),
        );
        await api.register(rewardRoutes(rewards, auth, config));
        await api.register(
          paymentRoutes(
            new PaymentsService(options.database.client, config, lists, new MollieClient(config)),
            auth,
            config,
          ),
        );
        await api.register(merchantRoutes(options.database.client, auth, config));
        await api.register(
          reservationRoutes(
            new ReservationsService(options.database.client, config, notifications, lists),
            auth,
            config,
          ),
        );
      }
    },
    { prefix: "/api/v1" },
  );

  if (options.database && options.storage) {
    await app.register(publicAssetRoutes(options.storage, options.database.client), {
      prefix: "/assets",
    });
  }

  return app;
}
