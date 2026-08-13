import { createApp } from "./app.js";
import { createDatabase } from "./common/database/client.js";
import { loadConfig } from "./config/env.js";

const config = loadConfig();
const database = createDatabase(config);
const app = await createApp({ config, database });

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
  app.log.fatal({ err: error }, "Unable to start Mila API");
  process.exit(1);
}
