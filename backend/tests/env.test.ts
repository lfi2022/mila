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
});
