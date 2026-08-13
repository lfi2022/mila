import { describe, expect, it } from "vitest";

import { deriveBalance } from "../src/modules/rewards/service.js";

describe("reward ledger balances", () => {
  it("derives balances from immutable signed entries", () => {
    expect(
      deriveBalance([
        { type: "AFFILIATE_COMMISSION", status: "CONFIRMED", amountMinor: 500n },
        { type: "REFERRAL", status: "PENDING", amountMinor: 300n },
        { type: "REDEMPTION", status: "CONFIRMED", amountMinor: -200n },
        { type: "ADJUSTMENT", status: "CONFIRMED", amountMinor: -50n },
        { type: "ADJUSTMENT", status: "CANCELLED", amountMinor: 999n },
      ]),
    ).toEqual({ available: 250, pending: 300, lifetimeEarned: 500, lifetimeUsed: 200 });
  });

  it("counts a compensating entry without mutating the original credit", () => {
    const original = { type: "AFFILIATE_COMMISSION", status: "CONFIRMED", amountMinor: 400n };
    const before = deriveBalance([original]);
    const after = deriveBalance([
      original,
      { type: "ADJUSTMENT", status: "CONFIRMED", amountMinor: -400n },
    ]);
    expect(before.available).toBe(400);
    expect(after.available).toBe(0);
    expect(original).toEqual({
      type: "AFFILIATE_COMMISSION",
      status: "CONFIRMED",
      amountMinor: 400n,
    });
  });
});
