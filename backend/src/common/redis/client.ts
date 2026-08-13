import { Redis } from "ioredis";

import type { AppConfig } from "../../config/env.js";

export type RedisService = {
  client: Redis;
  check: () => Promise<"up" | "down">;
  close: () => Promise<void>;
};

export function createRedis(config: AppConfig): RedisService {
  const client = new Redis(config.REDIS_URL, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    keyPrefix: `${config.QUEUE_PREFIX}:`,
    retryStrategy: (attempt: number) => Math.min(attempt * 250, 5_000),
  });
  client.on("error", () => {
    // Connection errors are surfaced by readiness and request-level callers.
  });

  return {
    client,
    async check() {
      try {
        if (client.status === "wait") await client.connect();
        return (await client.ping()) === "PONG" ? "up" : "down";
      } catch {
        return "down";
      }
    },
    async close() {
      if (client.status === "wait" || client.status === "end") return;
      await client.quit().catch(() => client.disconnect());
    },
  };
}
