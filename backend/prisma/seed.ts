import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../src/generated/prisma/client.js";

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) throw new Error("DATABASE_URL is required to seed Mila");

const client = new PrismaClient({ adapter: new PrismaMariaDb(databaseUrl) });

const flags = [
  ["affiliation", "Affiliate links and commission ingestion"],
  ["contributions", "Guest monetary contributions"],
  ["media_messages", "Audio and video messages"],
  ["mollie_payments", "Mollie payment processing"],
  ["premium", "One-time Premium entitlement"],
  ["price_tracking", "Scheduled product price tracking"],
  ["rewards", "Reward wallet and redemption flows"],
] as const;

try {
  await client.$transaction(
    flags.map(([key, description]) =>
      client.featureFlag.upsert({
        where: { key },
        create: { key, description, enabled: false },
        update: { description },
      }),
    ),
  );
} finally {
  await client.$disconnect();
}
