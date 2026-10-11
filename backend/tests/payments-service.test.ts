import { describe, expect, it, vi } from "vitest";

import { loadConfig } from "../src/config/env.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { ListsService } from "../src/modules/lists/service.js";
import {
  decimalToMinor,
  minorToDecimal,
  type MolliePayment,
  type PaymentProviderClient,
} from "../src/modules/payments/mollie.js";
import { PaymentsService } from "../src/modules/payments/service.js";

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
  FEATURE_MOLLIE_PAYMENTS: "true",
  FEATURE_PREMIUM: "true",
  MOLLIE_MODE: "test",
  MOLLIE_API_KEY: "test_fake-key-for-unit-tests",
  MOLLIE_WEBHOOK_URL: "https://test.example.com/api/v1/webhooks/mollie",
  MOLLIE_REDIRECT_URL: "https://test.example.com/paiement/retour",
});

const remote = (status: MolliePayment["status"]): MolliePayment => ({
  resource: "payment",
  id: "tr_remote",
  mode: "test",
  status,
  amount: { currency: "EUR", value: "29.99" },
  metadata: { internalPaymentId: "payment-id" },
  _links: {},
});

describe("Mollie money", () => {
  it("converts minor units without floating point arithmetic", () => {
    expect(minorToDecimal(2_999n)).toBe("29.99");
    expect(decimalToMinor("29.99")).toBe(2_999n);
    expect(() => decimalToMinor("29.999")).toThrow();
  });
});

describe("PaymentsService reconciliation", () => {
  it("does not regress a paid payment when a stale provider status is observed", async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = prismaMock(update);
    const provider = providerMock(remote("failed"));
    const service = new PaymentsService(prisma, config, {} as ListsService, provider);
    await service.reconcileExternal("tr_remote");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PAID" }) }),
    );
  });

  it("uses a confirmed full refund to reverse Premium and revenue", async () => {
    const update = vi.fn().mockResolvedValue({});
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = prismaMock(update, updateMany);
    const provider = providerMock(remote("paid"), [
      {
        resource: "refund",
        id: "re_full",
        status: "refunded",
        amount: { currency: "EUR", value: "29.99" },
      },
    ]);
    const service = new PaymentsService(prisma, config, {} as ListsService, provider);
    await service.reconcileExternal("tr_remote");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "REFUNDED" }) }),
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ plan: "FREE" }) }),
    );
  });

  it("activates Premium only from an authenticated paid provider snapshot", async () => {
    const update = vi.fn().mockResolvedValue({});
    const entitlementUpsert = vi.fn().mockResolvedValue({});
    const ledgerUpsert = vi.fn().mockResolvedValue({});
    const prisma = prismaMock(update, vi.fn(), entitlementUpsert, ledgerUpsert);
    const provider = providerMock({ ...remote("paid"), paidAt: new Date().toISOString() });
    const service = new PaymentsService(prisma, config, {} as ListsService, provider);
    await service.reconcileExternal("tr_remote");
    expect(entitlementUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ plan: "PREMIUM" }) }),
    );
    expect(ledgerUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ type: "PREMIUM_REVENUE" }) }),
    );
  });

  it("replays provider reconciliation through stable idempotent upserts", async () => {
    const update = vi.fn().mockResolvedValue({});
    const entitlementUpsert = vi.fn().mockResolvedValue({});
    const ledgerUpsert = vi.fn().mockResolvedValue({});
    const prisma = prismaMock(update, vi.fn(), entitlementUpsert, ledgerUpsert);
    const provider = providerMock({ ...remote("paid"), paidAt: new Date().toISOString() });
    const service = new PaymentsService(prisma, config, {} as ListsService, provider);
    await service.reconcileExternal("tr_remote");
    await service.reconcileExternal("tr_remote");
    expect(ledgerUpsert).toHaveBeenCalledTimes(2);
    const keys = ledgerUpsert.mock.calls.map((call) => call[0].where.idempotencyKey);
    expect(new Set(keys)).toEqual(new Set(["payment:payment-id"]));
  });

  it("notifies every list manager when a gift-card payment is confirmed", async () => {
    const payment = {
      id: "payment-id",
      listId: "list-id",
      provider: "MOLLIE",
      externalId: "tr_remote",
      purpose: "GIFT_CART",
      status: "PENDING",
      amountMinor: 2_999n,
      currency: "EUR",
      paidAt: null,
    };
    const receipt = {
      ...payment,
      status: "PAID",
      metadata: { guestEmail: "giver@example.test", guestName: "Camille" },
      contributions: [
        {
          id: "contribution-id",
          giftId: "gift-id",
          reservationId: "reservation-id",
          listId: "list-id",
          amountMinor: 2_999n,
          currency: "EUR",
          status: "CONFIRMED",
          gift: { title: "Poussette" },
        },
      ],
      list: {
        ownerId: "parent-a",
        title: "Liste de Mila",
        members: [{ userId: "parent-b" }],
      },
    };
    const notificationCreateMany = vi.fn().mockResolvedValue({ count: 2 });
    const enqueue = vi.fn().mockResolvedValue("job-id");
    const paymentUpdate = vi.fn().mockResolvedValue({});
    const tx = {
      refund: { upsert: vi.fn() },
      chargeback: { upsert: vi.fn() },
      payment: { findUniqueOrThrow: vi.fn().mockResolvedValue(payment), update: paymentUpdate },
      contribution: {
        findMany: vi.fn().mockResolvedValue([{ ...receipt.contributions[0], status: "PENDING" }]),
        update: vi.fn().mockResolvedValue({}),
      },
      gift: {
        findUnique: vi.fn().mockResolvedValue({ id: "gift-id", reservedQuantity: 1, status: "RESERVED" }),
        update: vi.fn().mockResolvedValue({}),
      },
      reservation: { findUnique: vi.fn().mockResolvedValue({ id: "reservation-id", status: "RESERVED" }) },
      fundsLedgerEntry: { upsert: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      payment: {
        findUnique: vi.fn(async (args: { where: Record<string, unknown> }) =>
          "provider_externalId" in args.where ? payment : receipt,
        ),
        update: paymentUpdate,
      },
      notificationPreference: { findMany: vi.fn().mockResolvedValue([]) },
      notification: { createMany: notificationCreateMany },
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)),
    } as unknown as PrismaClient;
    const service = new PaymentsService(
      prisma,
      config,
      {} as ListsService,
      providerMock({ ...remote("paid"), paidAt: new Date().toISOString() }),
      { enqueue } as never,
    );

    await service.reconcileExternal("tr_remote");

    expect(notificationCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: "parent-a", type: "GIFT_PAYMENT_CONFIRMED" }),
          expect.objectContaining({ userId: "parent-b", type: "GIFT_PAYMENT_CONFIRMED" }),
        ]),
      }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "parent-a", type: "GIFT_PAYMENT_CONFIRMED" }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "parent-b", type: "GIFT_PAYMENT_CONFIRMED" }),
    );
  });
});

function prismaMock(
  paymentUpdate: ReturnType<typeof vi.fn>,
  entitlementUpdateMany = vi.fn(),
  entitlementUpsert = vi.fn(),
  ledgerUpsert = vi.fn(),
) {
  const payment = {
    id: "payment-id",
    listId: "list-id",
    provider: "MOLLIE",
    externalId: "tr_remote",
    purpose: "PREMIUM",
    status: "PAID",
    amountMinor: 2_999n,
    currency: "EUR",
    paidAt: new Date(),
  };
  const tx = {
    refund: { upsert: vi.fn() },
    chargeback: { upsert: vi.fn() },
    financialLedgerEntry: { upsert: ledgerUpsert },
    payment: { findUniqueOrThrow: vi.fn().mockResolvedValue(payment), update: paymentUpdate },
    listEntitlement: { upsert: entitlementUpsert, updateMany: entitlementUpdateMany },
  };
  return {
    payment: { findUnique: vi.fn().mockResolvedValue(payment) },
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)),
  } as unknown as PrismaClient;
}

function providerMock(
  payment: MolliePayment,
  refunds: Awaited<ReturnType<PaymentProviderClient["listRefunds"]>> = [],
): PaymentProviderClient {
  return {
    createPayment: vi.fn(),
    getPayment: vi.fn().mockResolvedValue(payment),
    createRefund: vi.fn(),
    listRefunds: vi.fn().mockResolvedValue(refunds),
    listChargebacks: vi.fn().mockResolvedValue([]),
    listMethods: vi.fn().mockResolvedValue([]),
  };
}
