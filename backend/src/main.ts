import { createApp } from "./app.js";
import { createDatabase } from "./common/database/client.js";
import { createRedis } from "./common/redis/client.js";
import { StorageService } from "./common/storage/service.js";
import { loadConfig } from "./config/env.js";

const config = loadConfig();
const database = createDatabase(config);
const redis = createRedis(config);
const storage = new StorageService(config, redis);
const app = await createApp({ config, database, redis, storage });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "Shutting down Mila API");
  await app.close();
  process.exit(0);
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.fatal(
    { event: "api_start_failed", errorType: error instanceof Error ? error.name : "UnknownError" },
    "Unable to start Mila API",
  );
  process.exit(1);
}
