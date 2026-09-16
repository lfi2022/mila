import { describe, expect, it, vi } from "vitest";
import { GiftCheckoutService } from "../src/modules/payments/gift-checkout.js";

const config = {
  FEATURE_MOLLIE_PAYMENTS: true,
  FEATURE_GIFT_MOLLIE_CHECKOUT: true,
  CONTRIBUTION_MIN_MINOR: 100,
  AUTH_SECRET: "test-secret",
  MOLLIE_REDIRECT_URL: "https://mila.example/paiement/retour",
  MOLLIE_WEBHOOK_URL: "https://mila.example/api/v1/webhooks/mollie",
  MOLLIE_MODE: "test",
};

describe("gift cart checkout", () => {
  it("rejects duplicate articles before reserving anything", async () => {
    const prisma = {
      payment: { findUnique: vi.fn().mockResolvedValue(null) },
      gift: { findMany: vi.fn() },
      $transaction: vi.fn(),
    };
    const service = new GiftCheckoutService(prisma as never, config as never, {} as never);
    await expect(
      service.create({
        items: [
          { giftToken: "a", mode: "PURCHASE" },
          { giftToken: "a", mode: "PURCHASE" },
        ],
        guestName: "Alex",
        guestEmail: "alex@example.com",
        idempotencyKey: "request-123",
      }),
    ).rejects.toMatchObject({ code: "CART_INVALID" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates one Mollie payment with two reserved articles", async () => {
    const gifts = ["a", "b"].map((token) => ({
      id: `gift-${token}`,
      title: `Article ${token}`,
      listId: "list-1",
      publicToken: token,
      unitPriceMinor: 1000n,
      contributionTargetMinor: null,
      currency: "EUR",
    }));
    const payment = {
      id: "payment-1",
      listId: "list-1",
      amountMinor: 2000n,
      currency: "EUR",
      redirectUrl: null,
    };
    const createContribution = vi.fn().mockResolvedValue({});
    const createReservation = vi
      .fn()
      .mockResolvedValueOnce({ id: "reservation-a" })
      .mockResolvedValueOnce({ id: "reservation-b" });
    const provider = {
      createPayment: vi.fn().mockResolvedValue({
        mode: "test",
        amount: { currency: "EUR", value: "20.00" },
        metadata: { internalPaymentId: "payment-1" },
        _links: { checkout: { href: "https://www.mollie.com/checkout/test" } },
        id: "tr_123",
      }),
    };
    const prisma = {
      payment: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({
          ...payment,
          redirectUrl: "https://www.mollie.com/checkout/test",
        }),
      },
      gift: { findMany: vi.fn().mockResolvedValue(gifts) },
      $transaction: vi.fn().mockImplementation((callback) =>
        callback({
          $queryRawUnsafe: vi
            .fn()
            .mockResolvedValue([{ status: "AVAILABLE", quantity: 1, reserved_quantity: 0 }]),
          $executeRawUnsafe: vi.fn().mockResolvedValue(1),
          contribution: {
            aggregate: vi.fn().mockResolvedValue({ _sum: { amountMinor: 0n } }),
            create: createContribution,
          },
          reservation: { create: createReservation },
          payment: { create: vi.fn().mockResolvedValue(payment) },
        }),
      ),
    };
    const service = new GiftCheckoutService(prisma as never, config as never, provider as never);
    const result = await service.create({
      items: [
        { giftToken: "a", mode: "PURCHASE" },
        { giftToken: "b", mode: "PURCHASE" },
      ],
      guestName: "Alex",
      guestEmail: "alex@example.com",
      idempotencyKey: "request-123",
    });
    expect(result.paymentId).toBe("payment-1");
    expect(createReservation).toHaveBeenCalledTimes(2);
    expect(createContribution).toHaveBeenCalledTimes(2);
    expect(provider.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinor: 2000n,
        metadata: { clientCode: "list-1" },
      }),
    );
  });
});
