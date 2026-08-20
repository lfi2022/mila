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

  it("keeps Mollie test and live credentials explicitly separated", () => {
    const mollie = {
      ...valid,
      FEATURE_MOLLIE_PAYMENTS: "true",
      MOLLIE_WEBHOOK_URL: "https://test.example.com/api/v1/webhooks/mollie",
      MOLLIE_REDIRECT_URL: "https://test.example.com/paiement/retour",
    };
    expect(() =>
      loadConfig({ ...mollie, MOLLIE_MODE: "live", MOLLIE_API_KEY: "test_wrong" }),
    ).toThrow(/live_/);
    expect(
      loadConfig({ ...mollie, MOLLIE_MODE: "test", MOLLIE_API_KEY: "test_valid" }).MOLLIE_MODE,
    ).toBe("test");
    expect(() =>
      loadConfig({
        ...mollie,
        MOLLIE_MODE: "test",
        MOLLIE_API_KEY: "test_valid",
        MOLLIE_API_URL: "https://attacker.invalid/v2",
      }),
    ).toThrow(/official Mollie API origin/);
  });

  it("requires contributions and an encryption key before enabling bank transfers", () => {
    expect(() => loadConfig({ ...valid, FEATURE_BANK_TRANSFERS: "true" })).toThrow(
      /FEATURE_CONTRIBUTIONS/,
    );
    expect(() =>
      loadConfig({ ...valid, FEATURE_BANK_TRANSFERS: "true", FEATURE_CONTRIBUTIONS: "true" }),
    ).toThrow(/encryption key/);
    expect(
      loadConfig({
        ...valid,
        FEATURE_BANK_TRANSFERS: "true",
        FEATURE_CONTRIBUTIONS: "true",
        BANK_ACCOUNT_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      }).FEATURE_BANK_TRANSFERS,
    ).toBe(true);
    expect(() =>
      loadConfig({
        ...valid,
        FEATURE_BANK_TRANSFERS: "true",
        FEATURE_CONTRIBUTIONS: "true",
        BANK_ACCOUNT_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
        CONTRIBUTION_PLATFORM_SHARE_RATE_BPS: "100",
      }),
    ).toThrow(/cannot deduct Mila fees/);
  });

  it("keeps parent payouts disabled without Mollie Connect", () => {
    expect(() => loadConfig({ ...valid, FEATURE_PARENT_PAYOUTS: "true" })).toThrow(
      /Mollie Connect/,
    );
  });

  it("requires tracking for price alerts and validates refresh bounds", () => {
    expect(() => loadConfig({ ...valid, FEATURE_PRICE_ALERTS: "true" })).toThrow(/Price tracking/);
    expect(() =>
      loadConfig({ ...valid, PRICE_REFRESH_MIN_HOURS: "72", PRICE_REFRESH_MAX_HOURS: "24" }),
    ).toThrow(/Minimum price refresh/);
  });

  it("keeps automatic ordering behind the fulfilment flag", () => {
    expect(() => loadConfig({ ...valid, FEATURE_AUTOMATIC_ORDERS: "true" })).toThrow(
      /Order fulfilment/,
    );
  });

  it.each(["https://dev06.lfinfo.be", "https://mila.example.org"])(
    "accepts deployment origin %s without source changes",
    (origin) => {
      const configured = loadConfig({
        ...valid,
        APP_ENV: "production",
        NODE_ENV: "production",
        APP_URL: origin,
        CORS_ALLOWED_ORIGINS: origin,
        COOKIE_SECURE: "true",
        LEGAL_OPERATOR_NAME: "Test Operator",
        LEGAL_BUSINESS_NAME: "Test Business",
        LEGAL_BUSINESS_NUMBER: "BE0000000000",
        LEGAL_REGISTERED_ADDRESS: "Test Address",
        LEGAL_GENERAL_EMAIL: "contact@test.invalid",
        LEGAL_PRIVACY_EMAIL: "privacy@test.invalid",
        LEGAL_SUPPORT_EMAIL: "support@test.invalid",
        LEGAL_REPORT_EMAIL: "legal@test.invalid",
        LEGAL_HOSTING_PROVIDER: "Test Host",
        LEGAL_PUBLICATION_DIRECTOR: "Test Director",
      });
      expect(configured.APP_URL).toBe(origin);
    },
  );

  it("requires a strong token before exposing operational metrics", () => {
    expect(() =>
      loadConfig({ ...valid, OBSERVABILITY_ENABLED: "true", OBSERVABILITY_TOKEN: "short" }),
    ).toThrow(/OBSERVABILITY_TOKEN/);
    expect(
      loadConfig({
        ...valid,
        OBSERVABILITY_ENABLED: "true",
        OBSERVABILITY_TOKEN: "observability-token-at-least-32-characters",
      }).OBSERVABILITY_ENABLED,
    ).toBe(true);
  });
});
