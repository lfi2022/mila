import { afterEach, describe, expect, it } from "vitest";

import { StorageService } from "../src/common/storage/service.js";
import { loadConfig } from "../src/config/env.js";

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
  STORAGE_FORCE_PATH_STYLE: "true",
  STORAGE_BUCKET_PRODUCT_IMAGES: "product-images",
  STORAGE_BUCKET_LIST_COVERS: "list-covers",
  STORAGE_BUCKET_USER_UPLOADS: "user-uploads",
  STORAGE_BUCKET_MEDIA_MESSAGES: "media-messages",
  STORAGE_BUCKET_EXPORTS: "exports",
  EMAIL_FROM: "Mila Test <noreply@test.invalid>",
});

describe("storage policy", () => {
  const services: StorageService[] = [];
  afterEach(async () => Promise.all(services.splice(0).map((service) => service.close())));

  it("generates an opaque owner-scoped signed upload key", async () => {
    const service = new StorageService(config);
    services.push(service);
    const result = await service.presignUpload("user-123", "list-cover", "image/png", 2048);
    expect(result.key).toMatch(/^user-123\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]+\.png$/);
    expect(result.uploadUrl).toContain("X-Amz-Signature=");
    expect(new URL(result.uploadUrl).host).toBe("uploads.test.invalid");
    expect(result.bucket).toBe("list-covers");
  });

  it("rejects unsupported content and cross-account object keys", async () => {
    const service = new StorageService(config);
    services.push(service);
    await expect(
      service.presignUpload("user-123", "list-cover", "image/svg+xml", 2048),
    ).rejects.toMatchObject({
      code: "UPLOAD_POLICY_REJECTED",
    });
    expect(() => service.assertOwnedKey("user-123", "user-456/file.png")).toThrow();
    expect(() => service.assertOwnedKey("user-123", "user-123/../file.png")).toThrow();
  });
});
