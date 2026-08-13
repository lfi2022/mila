import argon2 from "argon2";
import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../src/generated/prisma/client.js";
import { loadConfig } from "../src/config/env.js";
import { assertAnyRole, AuthService, type AuthUser } from "../src/modules/auth/service.js";

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

describe("AuthService", () => {
  it("normalizes email and stores only Argon2id password and opaque-token hashes", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        id: "user-1",
        email: data.email,
        displayName: data.displayName,
        emailVerifiedAt: null,
        onboardingCompleted: false,
        suspendedAt: null,
        deletedAt: null,
        passwordHash: data.passwordHash,
        roles: [{ role: "USER" }],
      }),
    );
    const prisma = { user: { findUnique, create } } as unknown as PrismaClient;
    const service = new AuthService(prisma, config);

    const result = await service.signup({
      email: "  Parent@Example.COM ",
      password: "a secure password",
      displayName: "Parent",
    });

    const call = create.mock.calls[0]?.[0] as {
      data: {
        email: string;
        passwordHash: string;
        verificationTokens: { create: { tokenHash: string } };
      };
    };
    expect(call.data.email).toBe("parent@example.com");
    expect(call.data.passwordHash).not.toContain("a secure password");
    expect(await argon2.verify(call.data.passwordHash, "a secure password")).toBe(true);
    expect(call.data.verificationTokens.create.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(call.data.verificationTokens.create.tokenHash).not.toBe(result.verificationToken);
  });

  it("does not reveal whether an email exists during password reset", async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient;
    const service = new AuthService(prisma, config);
    await expect(service.requestPasswordReset("unknown@example.com")).resolves.toBeNull();
  });

  it("enforces backend roles", () => {
    const user: AuthUser = {
      id: "user-1",
      email: "parent@example.com",
      displayName: null,
      emailVerified: true,
      onboardingCompleted: true,
      roles: ["USER"],
    };
    expect(() => assertAnyRole(user, ["ADMIN", "SUPER_ADMIN"])).toThrow(/permission/);
    expect(() => assertAnyRole(user, ["USER"])).not.toThrow();
  });
});
