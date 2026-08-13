import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import type { DatabaseService } from "../src/common/database/client.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { loadConfig } from "../src/config/env.js";

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
