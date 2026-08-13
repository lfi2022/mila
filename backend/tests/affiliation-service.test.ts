import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../src/generated/prisma/client.js";
import { loadConfig } from "../src/config/env.js";
import { AffiliationService } from "../src/modules/affiliation/service.js";

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
  STORAGE_ENDPOINT: "https://storage.test.invalid",
  STORAGE_PUBLIC_ENDPOINT: "https://uploads.test.invalid",
  STORAGE_ACCESS_KEY: "test-access-key",
  STORAGE_SECRET_KEY: "test-secret-key",
  STORAGE_BUCKET_PRODUCT_IMAGES: "product-images",
  STORAGE_BUCKET_LIST_COVERS: "list-covers",
  STORAGE_BUCKET_USER_UPLOADS: "user-uploads",
  STORAGE_BUCKET_MEDIA_MESSAGES: "media-messages",
  STORAGE_BUCKET_EXPORTS: "exports",
  EMAIL_FROM: "Mila Test <noreply@test.invalid>",
  FEATURE_AFFILIATION: "true",
  AFFILIATE_WEBHOOK_SECRET: "test-affiliate-webhook-secret-32-characters",
});

describe("AffiliationService", () => {
  it("applies only an allowlisted tracking host and stores the original destination", async () => {
    const create = vi.fn().mockResolvedValue({ token: "click" });
    const prisma = {
      gift: {
        findFirst: vi.fn().mockResolvedValue({
          id: "gift-1",
          listId: "list-1",
          url: "https://shop.example/product/1",
          merchantId: "merchant-1",
          merchant: {
            affiliationEnabled: true,
            affiliateLinkTemplate: "https://track.example/c?u={url}&c={click}",
            affiliateIdentifier: "publisher",
            affiliateRules: { trackingHosts: ["track.example"] },
            domains: [{ domain: "shop.example" }],
          },
        }),
      },
      affiliateClick: { create },
    } as unknown as PrismaClient;
    const result = await new AffiliationService(prisma, config).redirect("a".repeat(64), "1.2.3.4");
    expect(result.url).toMatch(/^https:\/\/track\.example\/c\?/);
    expect(create.mock.calls[0]?.[0].data.destinationUrl).toBe("https://shop.example/product/1");
    expect(create.mock.calls[0]?.[0].data.anonymousReference).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects a tracking host outside merchant rules", async () => {
    const prisma = {
      gift: {
        findFirst: vi.fn().mockResolvedValue({
          id: "gift-1",
          listId: "list-1",
          url: "https://shop.example/product/1",
          merchantId: "merchant-1",
          merchant: {
            affiliationEnabled: true,
            affiliateLinkTemplate: "https://evil.example/?u={url}",
            affiliateIdentifier: null,
            affiliateRules: { trackingHosts: ["track.example"] },
            domains: [{ domain: "shop.example" }],
          },
        }),
      },
    } as unknown as PrismaClient;
    await expect(
      new AffiliationService(prisma, config).redirect("a".repeat(64), "1.2.3.4"),
    ).rejects.toMatchObject({
      code: "AFFILIATE_HOST_REJECTED",
    });
  });

  it("verifies timestamped canonical webhook signatures", () => {
    const service = new AffiliationService({} as PrismaClient, config);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = { network: "test", externalId: "one" };
    const signature = createHmac("sha256", config.AFFILIATE_WEBHOOK_SECRET)
      .update(`${timestamp}.${JSON.stringify(body)}`)
      .digest("hex");
    expect(() => service.verifySignature(timestamp, signature, body)).not.toThrow();
    expect(() => service.verifySignature(timestamp, "0".repeat(64), body)).toThrow();
  });
});
