import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../src/generated/prisma/client.js";
import { loadConfig } from "../src/config/env.js";
import { ReservationsService } from "../src/modules/reservations/service.js";

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
});

const gift = {
  id: "gift-1",
  listId: "list-1",
  title: "Poussette",
  list: {
    title: "Liste de Mila",
    ownerId: "owner-1",
    surpriseMode: false,
    members: [{ userId: "editor-1" }],
  },
};

describe("ReservationsService", () => {
  it("rejects atomically when the requested quantity was concurrently consumed", async () => {
    const transaction = {
      gift: { findFirst: vi.fn().mockResolvedValue(gift) },
      $executeRawUnsafe: vi.fn().mockResolvedValue(0),
      reservation: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn().mockImplementation((callback) => callback(transaction)),
    } as unknown as PrismaClient;
    const service = new ReservationsService(prisma, config);
    await expect(
      service.create({ giftToken: "a".repeat(64), guestName: "Proche", quantity: 1 }),
    ).rejects.toMatchObject({ code: "GIFT_QUANTITY_UNAVAILABLE" });
    expect(transaction.reservation.create).not.toHaveBeenCalled();
  });

  it("stores only a digest of the guest management token and notifies every list manager", async () => {
    const create = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({
        id: "reservation-1",
        ...data,
        status: "RESERVED",
        purchasedAt: null,
        cancelledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const transaction = {
      gift: { findFirst: vi.fn().mockResolvedValue(gift) },
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
      reservation: { create },
      notificationPreference: { findMany: vi.fn().mockResolvedValue([]) },
      notification: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma = {
      $transaction: vi.fn().mockImplementation((callback) => callback(transaction)),
    } as unknown as PrismaClient;
    const queue = { enqueue: vi.fn().mockResolvedValue("job") };
    const service = new ReservationsService(prisma, config, queue as never);
    const result = await service.create({
      giftToken: "a".repeat(64),
      guestName: "Proche",
      quantity: 1,
    });
    const saved = create.mock.calls[0]?.[0].data;
    expect(saved.managementTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(saved.managementTokenHash).not.toBe(result.managementToken);
    expect(queue.enqueue).toHaveBeenCalledTimes(2);
  });

  it("decrements reserved quantity only after winning the cancellation state transition", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const execute = vi.fn().mockResolvedValue(1);
    const record = {
      id: "reservation-1",
      listId: "list-1",
      giftId: "gift-1",
      guestName: "Proche",
      quantity: 2,
      tokenExpiresAt: new Date(Date.now() + 1000),
      gift: { title: "Gift" },
      list: { title: "List", ownerId: "owner-1", surpriseMode: false, members: [] },
    };
    const prisma = {
      reservation: { findUnique: vi.fn().mockResolvedValue(record) },
      notificationPreference: { findMany: vi.fn().mockResolvedValue([]) },
      notification: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      $transaction: vi
        .fn()
        .mockImplementation((callback) =>
          callback({ reservation: { updateMany }, $executeRawUnsafe: execute }),
        ),
    } as unknown as PrismaClient;
    await new ReservationsService(prisma, config).cancel("opaque-management-token");
    expect(updateMany).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(expect.stringContaining("GREATEST"), 2, "gift-1");
  });
});
