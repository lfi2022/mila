import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../src/generated/prisma/client.js";
import { loadConfig } from "../src/config/env.js";
import { ListsService } from "../src/modules/lists/service.js";

const config = loadConfig({
  APP_ENV: "test",
  NODE_ENV: "test",
  APP_URL: "https://test.example.com",
  CORS_ALLOWED_ORIGINS: "https://test.example.com",
  DATABASE_HOST: "db.test.invalid",
  DATABASE_NAME: "mila_test",
  DATABASE_USER: "mila_test",
  DATABASE_PASSWORD: "test-only-password",
  DATABASE_URL: "mysql://mila_test:test-only-password@db.test.invalid:3306/mila_test",
  AUTH_SECRET: "test-auth-secret-at-least-32-characters",
  SESSION_SECRET: "test-session-secret-at-least-32-characters",
  REDIS_URL: "redis://cache.test.invalid:6379",
  PRODUCT_FETCH_USER_AGENT: "MilaTest/1.0",
  STORAGE_ENDPOINT: "https://storage.test.invalid",
  STORAGE_PUBLIC_ENDPOINT: "https://uploads.test.invalid",
  EMAIL_FROM: "Mila Test <noreply@test.invalid>",
  STORAGE_ACCESS_KEY: "test-access-key",
  STORAGE_SECRET_KEY: "test-secret-key",
  STORAGE_FORCE_PATH_STYLE: "true",
  STORAGE_BUCKET_PRODUCT_IMAGES: "product-images",
  STORAGE_BUCKET_LIST_COVERS: "list-covers",
  STORAGE_BUCKET_USER_UPLOADS: "user-uploads",
  STORAGE_BUCKET_MEDIA_MESSAGES: "media-messages",
  STORAGE_BUCKET_EXPORTS: "exports",
});

describe("ListsService", () => {
  it("keeps non-launch list types disabled by configuration", async () => {
    const service = new ListsService({} as PrismaClient, config);
    await expect(
      service.create("user-1", {
        title: "Mariage",
        slug: "mariage",
        type: "WEDDING",
        visibility: "UNLISTED",
        status: "DRAFT",
        surpriseMode: false,
        hideReservedGifts: false,
        allowIndexing: false,
        showProgress: true,
        theme: "default",
      }),
    ).rejects.toMatchObject({ code: "LIST_TYPE_DISABLED" });
  });
  it("hashes protected-list access codes", async () => {
    const create = vi.fn().mockImplementation(({ data }) => Promise.resolve(data));
    const service = new ListsService({ giftList: { create } } as unknown as PrismaClient, config);
    await service.create("user-1", {
      title: "Naissance",
      slug: "naissance",
      type: "BIRTH",
      visibility: "PROTECTED",
      status: "ACTIVE",
      accessCode: "secret-code",
      surpriseMode: false,
      hideReservedGifts: false,
      allowIndexing: false,
      showProgress: true,
      theme: "default",
    });
    const saved = create.mock.calls[0]?.[0].data as { accessCodeHash: string };
    expect(saved.accessCodeHash).not.toContain("secret-code");
    expect(saved.accessCodeHash).toMatch(/^\$argon2id\$/);
  });

  it("never exposes an access-code hash from a public response", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "list-1",
      slug: "naissance",
      title: "Naissance",
      visibility: "UNLISTED",
      status: "ACTIVE",
      accessCodeHash: "sensitive-hash",
      gifts: [],
    });
    const service = new ListsService(
      { giftList: { findFirst } } as unknown as PrismaClient,
      config,
    );
    const list = await service.publicList("naissance");
    expect(list).not.toHaveProperty("accessCodeHash");
  });

  it("returns a JSON-safe public gift projection without its merchant URL", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "list-1",
      slug: "naissance",
      title: "Naissance",
      visibility: "PUBLIC",
      status: "ACTIVE",
      accessCodeHash: null,
      hideReservedGifts: false,
      gifts: [
        {
          id: "gift-1",
          publicToken: "a".repeat(64),
          title: "Poussette",
          description: null,
          kind: "LINK",
          status: "AVAILABLE",
          url: "https://merchant.invalid/private-target",
          currency: "EUR",
          unitPriceMinor: 12_345n,
          quantity: 2,
          reservedQuantity: 1,
          fundedAmountMinor: 500n,
          contributionTargetMinor: null,
        },
      ],
    });
    const service = new ListsService(
      { giftList: { findFirst } } as unknown as PrismaClient,
      config,
    );
    const list = await service.publicList("naissance");
    expect(() => JSON.stringify(list)).not.toThrow();
    expect(list.gifts[0]).toMatchObject({
      unitPriceMinor: "12345",
      fundedAmountMinor: "500",
      hasLink: true,
    });
    expect(list.gifts[0]).not.toHaveProperty("url");
  });

  it("rejects member writes without an allowed role", async () => {
    const findFirst = vi.fn().mockResolvedValue({ ownerId: "owner", members: [] });
    const service = new ListsService(
      { giftList: { findFirst } } as unknown as PrismaClient,
      config,
    );
    await expect(service.remove("attacker", "list-1")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
