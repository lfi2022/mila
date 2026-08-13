import "dotenv/config";

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // `generate` and `validate` do not need a database. Commands that connect
  // (migrate/seed) still fail unless the operator supplies DATABASE_URL.
  datasource: process.env.DATABASE_URL ? { url: process.env.DATABASE_URL } : undefined,
});
