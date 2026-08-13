import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config/env.js";

const valid = {
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
};

describe("database environment", () => {
  it("refuses to start without remote database configuration", () => {
    const { DATABASE_HOST: _omitted, ...missingHost } = valid;
    expect(() => loadConfig(missingHost)).toThrow(/DATABASE_HOST/);
  });

  it("rejects an invalid pool range", () => {
    expect(() => loadConfig({ ...valid, DATABASE_POOL_MIN: "20", DATABASE_POOL_MAX: "5" })).toThrow(
      /DATABASE_POOL_MIN/,
    );
  });

  it("accepts explicit TLS and pool settings", () => {
    expect(
      loadConfig({
        ...valid,
        DATABASE_SSL_MODE: "required",
        DATABASE_POOL_MIN: "1",
        DATABASE_POOL_MAX: "8",
      }),
    ).toMatchObject({ DATABASE_SSL_MODE: "required", DATABASE_POOL_MIN: 1, DATABASE_POOL_MAX: 8 });
  });

  it("requires distinct authentication and session secrets", () => {
    expect(() => loadConfig({ ...valid, SESSION_SECRET: valid.AUTH_SECRET })).toThrow(
      /SESSION_SECRET/,
    );
  });

  it("requires complete SMTP credentials when SMTP delivery is enabled", () => {
    expect(() => loadConfig({ ...valid, EMAIL_PROVIDER: "smtp" })).toThrow(/SMTP_HOST/);
    expect(
      loadConfig({
        ...valid,
        EMAIL_PROVIDER: "smtp",
        SMTP_HOST: "smtp.test.invalid",
        SMTP_USER: "user",
        SMTP_PASSWORD: "password",
      }).EMAIL_PROVIDER,
    ).toBe("smtp");
  });
});
