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
