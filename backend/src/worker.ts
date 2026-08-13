import { randomUUID } from "node:crypto";

import { createDatabase } from "./common/database/client.js";
import { createRedis } from "./common/redis/client.js";
import { loadConfig } from "./config/env.js";
import {
  cleanupProcessor,
  deferredProcessor,
  mediaScanProcessor,
  notificationProcessor,
  productRefreshProcessor,
  productMediaProcessor,
} from "./workers/handlers.js";
import { StreamWorker, type StreamProcessor } from "./workers/stream-worker.js";
import { ProductRefreshQueue } from "./modules/products/refresh-queue.js";
import { NotificationQueue } from "./modules/notifications/queue.js";
import { scheduleDueProductRefreshes } from "./modules/prices/scheduler.js";
import { StorageService } from "./common/storage/service.js";
import { ProductMediaQueue } from "./modules/product-media/queue.js";

const config = loadConfig();
const database = createDatabase(config);
const redis = createRedis(config);
if (redis.client.status === "wait") await redis.client.connect();
const productRefreshQueue = new ProductRefreshQueue(redis);
const notificationQueue = new NotificationQueue(redis);
const storage = new StorageService(config, redis);
const productMediaQueue = new ProductMediaQueue(redis);

const processors: Record<string, StreamProcessor> = {
  notifications: notificationProcessor(config, database),
  email: notificationProcessor(config, database),
  "product-refresh": productRefreshProcessor(
    config,
    database,
    notificationQueue,
    productMediaQueue,
  ),
  prices: productRefreshProcessor(config, database, notificationQueue, productMediaQueue),
  "product-media": productMediaProcessor(config, database, storage),
  cleanup: cleanupProcessor(database),
  "token-cleanup": cleanupProcessor(database),
  expiration: cleanupProcessor(database),
  "media-scan": mediaScanProcessor(storage, database),
};
const queueNames = config.WORKER_QUEUES.split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const assignments = Array.from(
  { length: Math.max(config.WORKER_CONCURRENCY, queueNames.length) },
  (_, index) => queueNames[index % queueNames.length]!,
);
const connections = assignments.map(() => redis.client.duplicate());
await Promise.all(connections.map((connection) => connection.connect()));
const workers = assignments.map((queue, index) => {
  return new StreamWorker(
    connections[index]!,
    `stream:${queue}`,
    `${process.pid}-${randomUUID()}`,
    processors[queue] ?? deferredProcessor(queue),
    5,
  );
});

const requestStop = () => {
  clearInterval(priceScheduler);
  workers.forEach((worker) => worker.stop());
};
const runPriceScheduler = () =>
  scheduleDueProductRefreshes(config, database, productRefreshQueue).catch((error: unknown) => {
    process.stderr.write(
      `${JSON.stringify({
        event: "price_scheduler_failed",
        errorType: error instanceof Error ? error.name : "UnknownError",
      })}\n`,
    );
  });
const priceScheduler = setInterval(runPriceScheduler, config.PRICE_SCHEDULER_INTERVAL_MS);
priceScheduler.unref();
void runPriceScheduler();
process.once("SIGINT", requestStop);
process.once("SIGTERM", requestStop);

await Promise.all(workers.map((worker) => worker.run())).finally(async () => {
  await Promise.all(connections.map((connection) => connection.quit().catch(() => undefined)));
  await Promise.all([database.close(), redis.close(), storage.close()]);
});
