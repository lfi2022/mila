import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";

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

const demoGifts = [
  {
    key: "stroller",
    title: "Poussette confortable",
    description: "Une poussette pratique pour les premières promenades.",
    priceMinor: 34900n,
    category: "STROLLER" as const,
    reserved: false,
  },
  {
    key: "rabbit",
    title: "Doudou lapin",
    description: "Un compagnon tout doux pour les siestes.",
    priceMinor: 2490n,
    category: "PLUSH_RABBIT" as const,
    reserved: true,
  },
  {
    key: "bouncer",
    title: "Transat pour bébé",
    description: "Un petit cocon confortable pour rester près de la famille.",
    priceMinor: 8990n,
    category: "BABY_BOUNCER" as const,
    reserved: false,
  },
  {
    key: "crib",
    title: "Lit à barreaux",
    description: "Un lit sobre et chaleureux pour préparer la chambre.",
    priceMinor: 21900n,
    category: "BABY_CRIB" as const,
    reserved: false,
  },
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
  const demoPasswordHash = await argon2.hash(randomBytes(32).toString("hex"), {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  await client.$transaction(async (transaction) => {
    const owner = await transaction.user.upsert({
      where: { email: "demo-system@invalid.avecmila.be" },
      create: {
        email: "demo-system@invalid.avecmila.be",
        passwordHash: demoPasswordHash,
        displayName: "Démonstration Mila",
        emailVerifiedAt: new Date(),
        onboardingCompleted: true,
      },
      update: { displayName: "Démonstration Mila", deletedAt: null, suspendedAt: null },
    });
    const list = await transaction.giftList.upsert({
      where: { slug: "demo-mila" },
      create: {
        ownerId: owner.id,
        slug: "demo-mila",
        title: "La liste de naissance de Mila",
        description: "Une liste fictive pour découvrir l’expérience proposée à vos proches.",
        welcomeMessage:
          "Bienvenue dans cette démonstration. Parcourez les cadeaux comme si vous aviez reçu le lien d’une vraie liste.",
        type: "BIRTH",
        visibility: "PUBLIC",
        status: "ACTIVE",
        allowIndexing: false,
        showProgress: true,
        theme: "default",
        accentColor: "#E99A8D",
        heroStyle: "soft",
        fontPair: "baloo",
        layout: "grid",
        productAutoRefresh: false,
        autoUpdatePrice: false,
        autoUpdateImage: false,
      },
      update: {
        ownerId: owner.id,
        title: "La liste de naissance de Mila",
        description: "Une liste fictive pour découvrir l’expérience proposée à vos proches.",
        welcomeMessage:
          "Bienvenue dans cette démonstration. Parcourez les cadeaux comme si vous aviez reçu le lien d’une vraie liste.",
        visibility: "PUBLIC",
        status: "ACTIVE",
        deletedAt: null,
        allowIndexing: false,
        productAutoRefresh: false,
        autoUpdatePrice: false,
        autoUpdateImage: false,
      },
    });
    for (const [position, gift] of demoGifts.entries()) {
      const publicToken = createHash("sha256").update(`mila-demo:${gift.key}`).digest("hex");
      await transaction.gift.upsert({
        where: { publicToken },
        create: {
          listId: list.id,
          publicToken,
          title: gift.title,
          description: gift.description,
          kind: "PRODUCT",
          status: gift.reserved ? "RESERVED" : "AVAILABLE",
          currency: "EUR",
          unitPriceMinor: gift.priceMinor,
          priceAtCreationMinor: gift.priceMinor,
          quantity: 1,
          reservedQuantity: gift.reserved ? 1 : 0,
          position,
          genericImageCategory: gift.category,
        },
        update: {
          listId: list.id,
          title: gift.title,
          description: gift.description,
          status: gift.reserved ? "RESERVED" : "AVAILABLE",
          unitPriceMinor: gift.priceMinor,
          priceAtCreationMinor: gift.priceMinor,
          reservedQuantity: gift.reserved ? 1 : 0,
          position,
          genericImageCategory: gift.category,
          deletedAt: null,
          hiddenByModerator: false,
        },
      });
    }
  });
} finally {
  await client.$disconnect();
}
