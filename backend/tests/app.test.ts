import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import type { DatabaseService } from "../src/common/database/client.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { loadConfig } from "../src/config/env.js";
import type { AppConfig } from "../src/config/env.js";

const config = loadConfig({
  APP_ENV: "test",
  NODE_ENV: "test",
  APP_URL: "https://test.example.com",
  API_PUBLIC_URL: "/api/v1",
  CORS_ALLOWED_ORIGINS: "https://test.example.com",
  SEO_INDEXING_ENABLED: "false",
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

describe("Mila API bootstrap", () => {
  it("exposes the versioned API and liveness endpoint", async () => {
    const app = await createApp({ config, logger: false });

    const version = await app.inject({ method: "GET", url: "/api/v1/" });
    expect(version.statusCode).toBe(200);
    expect(version.json()).toMatchObject({ name: "Mila", version: "v1" });

    const live = await app.inject({ method: "GET", url: "/api/v1/health/live" });
    expect(live.statusCode).toBe(200);
    expect(live.json()).toEqual({ status: "ok" });

    await app.close();
  });

  it("reports dependency readiness failures without crashing", async () => {
    const app = await createApp({
      config,
      logger: false,
      readinessProbe: async () => ({ database: "down", redis: "up" }),
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/health/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ status: "unavailable" });

    await app.close();
  });

  it("rejects unknown CORS origins", async () => {
    const app = await createApp({ config, logger: false });
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/v1/",
      headers: { origin: "https://attacker.example", "access-control-request-method": "GET" },
    });
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    await app.close();
  });

  it("keeps operational metrics hidden and never labels raw query or bearer tokens", async () => {
    const observabilityConfig = {
      ...config,
      OBSERVABILITY_ENABLED: true,
      OBSERVABILITY_TOKEN: "metrics-test-token-at-least-32-characters",
    } satisfies AppConfig;
    const app = await createApp({ config: observabilityConfig, logger: false });
    const denied = await app.inject({
      method: "GET",
      url: "/api/v1/health/metrics?secret=must-not-appear",
      headers: { authorization: "Bearer incorrect-token" },
    });
    expect(denied.statusCode).toBe(404);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health/metrics?secret=must-not-appear",
      headers: { authorization: `Bearer ${observabilityConfig.OBSERVABILITY_TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("mila_http_requests_total");
    expect(response.body).not.toContain("must-not-appear");
    expect(response.body).not.toContain(observabilityConfig.OBSERVABILITY_TOKEN);
    await app.close();
  });

  it("rate limits repeated requests at the backend boundary", async () => {
    const app = await createApp({
      config: { ...config, RATE_LIMIT_MAX: 2 } satisfies AppConfig,
      logger: false,
    });
    await app.inject({ method: "GET", url: "/api/v1/health/live" });
    await app.inject({ method: "GET", url: "/api/v1/health/live" });
    const limited = await app.inject({ method: "GET", url: "/api/v1/health/live" });
    expect(limited.statusCode).toBe(429);
    await app.close();
  });

  it("rejects injection-shaped identifiers before database access", async () => {
    const count = vi.fn();
    const database = {
      client: { giftList: { count } } as unknown as PrismaClient,
      check: async () => "up" as const,
      close: async () => undefined,
    } satisfies DatabaseService;
    const app = await createApp({ config, database, logger: false });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/public/reports",
      payload: { targetType: "list", targetId: "' OR 1=1 --", reason: "OTHER" },
    });
    expect(response.statusCode).toBe(400);
    expect(count).not.toHaveBeenCalled();
    await app.close();
  });

  it("does not reflect stored user markup from JSON write responses", async () => {
    const tx = { report: { create: vi.fn().mockResolvedValue({ id: "report-1" }) } };
    const database = {
      client: {
        giftList: { count: vi.fn().mockResolvedValue(1) },
        $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
        ),
      } as unknown as PrismaClient,
      check: async () => "up" as const,
      close: async () => undefined,
    } satisfies DatabaseService;
    const app = await createApp({ config, database, logger: false });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/public/reports",
      payload: {
        targetType: "list",
        targetId: "00000000-0000-4000-8000-000000000001",
        reason: "OTHER",
        details: '<script>alert("xss")</script>',
        elapsedMs: 2_000,
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).not.toContain("<script>");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    await app.close();
  });

  it("exposes autonomous signup without returning raw verification tokens outside development", async () => {
    const prisma = {
      user: {
        findUnique: async () => null,
        create: async ({ data }: { data: { email: string; displayName?: string | null } }) => ({
          id: "user-1",
          email: data.email,
          displayName: data.displayName ?? null,
          emailVerifiedAt: null,
          onboardingCompleted: false,
          suspendedAt: null,
          deletedAt: null,
          passwordHash: "not-returned",
          roles: [{ role: "USER" }],
        }),
      },
    } as unknown as PrismaClient;
    const database = {
      client: prisma,
      check: async () => "up" as const,
      close: async () => undefined,
    } satisfies DatabaseService;
    const app = await createApp({ config, database, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      payload: {
        email: "parent@example.com",
        password: "a secure password",
        displayName: "Parent",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ verificationRequired: true });
    expect(response.json()).not.toHaveProperty("developmentVerificationToken");

    const logoutWithoutCsrf = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
    });
    expect(logoutWithoutCsrf.statusCode).toBe(403);
    expect(logoutWithoutCsrf.json()).toMatchObject({ error: { code: "CSRF_INVALID" } });
    await app.close();
  });
});
