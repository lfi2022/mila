import { describe, expect, it, vi } from "vitest";

import {
  calculateContributionSplit,
  ContributionsService,
} from "../src/modules/contributions/service.js";

describe("contribution split", () => {
  it("keeps every amount in integer minor units", () => {
    expect(calculateContributionSplit(10_001n, 290, 250)).toEqual({
      fee: 290n,
      share: 250n,
      net: 9_461n,
    });
  });

  it("rejects a policy that consumes the contribution", () => {
    expect(() => calculateContributionSplit(100n, 5_000, 5_000)).toThrow(
      "Contribution cost policy is invalid",
    );
  });
});

describe("reserved gift contributions", () => {
  it("closes the public cagnotte and rejects a new transfer after reservation", async () => {
    const gift = {
      id: "gift-id",
      title: "Poussette",
      listId: "list-id",
      status: "RESERVED",
      quantity: 1,
      reservedQuantity: 1,
      contributionTargetMinor: 10000n,
      currency: "EUR",
      list: { contributionRecipient: { bankAccount: { id: "account-id" } } },
    };
    const prisma = {
      gift: { findFirst: vi.fn().mockResolvedValue(gift) },
      contribution: { aggregate: vi.fn().mockResolvedValue({ _sum: { amountMinor: 0n } }) },
      $transaction: vi.fn(),
    };
    const service = new ContributionsService(
      prisma as never,
      {
        FEATURE_CONTRIBUTIONS: true,
        FEATURE_BANK_TRANSFERS: true,
        BANK_ACCOUNT_ENCRYPTION_KEY: "key",
        CONTRIBUTION_MIN_MINOR: 100,
      } as never,
      {} as never,
    );

    await expect(service.publicStatus("token")).resolves.toMatchObject({
      closed: true,
      reserved: true,
    });
    await expect(
      service.createBankTransfer({
        giftToken: "token",
        amountCents: 1000,
        anonymous: false,
        idempotencyKey: "key",
      }),
    ).rejects.toMatchObject({ code: "GIFT_RESERVED", statusCode: 409 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("list contribution recipient", () => {
  it("allows an owner or co-owner with a configured account", async () => {
    const assertRole = vi.fn().mockResolvedValue("CO_OWNER");
    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      giftList: {
        findFirst: vi.fn().mockResolvedValue({
          contributionRecipientId: "owner-id",
        }),
        update,
      },
      parentBankAccount: {
        findUnique: vi.fn().mockResolvedValue({ ibanMasked: "BE•• •••• 1234" }),
      },
    };
    const service = new ContributionsService(prisma as never, {} as never, { assertRole } as never);

    await expect(service.setListRecipient("actor-id", "list-id", "coparent-id")).resolves.toEqual({
      recipientUserId: "coparent-id",
      ibanMasked: "BE•• •••• 1234",
    });
    expect(assertRole).toHaveBeenCalledWith("actor-id", "list-id", ["OWNER", "CO_OWNER"]);
    expect(update).toHaveBeenCalledWith({
      where: { id: "list-id" },
      data: { contributionRecipientId: "coparent-id" },
    });
  });

  it("refuses a parent without a configured account", async () => {
    const prisma = {
      giftList: {
        findFirst: vi.fn().mockResolvedValue({ contributionRecipientId: "owner-id" }),
      },
      parentBankAccount: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const service = new ContributionsService(
      prisma as never,
      {} as never,
      { assertRole: vi.fn().mockResolvedValue("OWNER") } as never,
    );

    await expect(
      service.setListRecipient("owner-id", "list-id", "coparent-id"),
    ).rejects.toMatchObject({ code: "PARENT_BANK_ACCOUNT_REQUIRED", statusCode: 409 });
  });
});
