import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../../generated/prisma/client.js";
import type { AppConfig } from "../../config/env.js";

export type DatabaseService = {
  client: PrismaClient;
  check: () => Promise<"up" | "down">;
  close: () => Promise<void>;
};

export function createDatabase(config: AppConfig): DatabaseService {
  const tls =
    config.DATABASE_SSL_MODE === "disabled"
      ? undefined
      : { rejectUnauthorized: config.DATABASE_SSL_MODE === "required" };
  const adapter = new PrismaMariaDb({
    host: config.DATABASE_HOST,
    port: config.DATABASE_PORT,
    database: config.DATABASE_NAME,
    user: config.DATABASE_USER,
    password: config.DATABASE_PASSWORD,
    connectionLimit: config.DATABASE_POOL_MAX,
    minimumIdle: config.DATABASE_POOL_MIN,
    connectTimeout: config.DATABASE_CONNECT_TIMEOUT_MS,
    ssl: tls,
  });
  const client = new PrismaClient({ adapter });

  return {
    client,
    async check() {
      try {
        await client.$queryRaw`SELECT 1`;
        return "up";
      } catch {
        return "down";
      }
    },
    close: () => client.$disconnect(),
  };
}
