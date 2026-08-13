import { describe, expect, it } from "vitest";

import {
  applyCaps,
  computeShareCents,
  formatCents,
  parseAmountToCents,
  resolveRewardRateBps,
  rewardCostRatio,
  summariseLedger,
} from "../src/lib/money";

describe("reward computation", () => {
  it("shares 30% of a 5,00 € confirmed commission as 1,50 €", () => {
    expect(computeShareCents(500, 3000)).toBe(150);
  });

  it("never exceeds the revenue actually received", () => {
    expect(computeShareCents(500, 10_000)).toBe(500);
    expect(() => computeShareCents(500, 12_000)).toThrow();
  });

  it("rounds down instead of inventing cents", () => {
    expect(computeShareCents(333, 3000)).toBe(99);
  });

  it("uses no float arithmetic on amounts", () => {
    expect(parseAmountToCents("1,50")).toBe(150);
    expect(parseAmountToCents("0.07")).toBe(7);
    expect(parseAmountToCents(12.1)).toBe(1210);
    expect(() => parseAmountToCents("1,555")).toThrow();
  });
});

describe("rate resolution", () => {
  const base = { globalEnabled: true, affiliateRewardsEnabled: true, globalRateBps: 3000 };

  it("prefers the merchant override", () => {
    expect(resolveRewardRateBps({ ...base, merchant: { rewardEnabled: true, rewardShareRateBps: 4000 } })).toBe(4000);
  });

  it("falls back to the global rate", () => {
    expect(resolveRewardRateBps({ ...base, merchant: { rewardEnabled: true, rewardShareRateBps: null } })).toBe(3000);
  });

  it("gives nothing when the merchant or the program is disabled", () => {
    expect(resolveRewardRateBps({ ...base, merchant: { rewardEnabled: false, rewardShareRateBps: 5000 } })).toBe(0);
    expect(resolveRewardRateBps({ ...base, globalEnabled: false, merchant: null })).toBe(0);
  });
});

describe("caps", () => {
  it("clamps to the strictest configured cap", () => {
    expect(applyCaps(1000, { perTransaction: 500 })).toBe(500);
    expect(applyCaps(1000, { monthlyRemaining: 200 })).toBe(200);
    expect(applyCaps(1000, { lifetimeRemaining: 0 })).toBe(0);
    expect(applyCaps(1000, {})).toBe(1000);
  });
});

describe("ledger is the source of truth", () => {
  it("separates pending from available and tracks redemptions", () => {
    const summary = summariseLedger([
      { amount_cents: 420, status: "PENDING", type: "AFFILIATE_COMMISSION" },
      { amount_cents: 1670, status: "CONFIRMED", type: "AFFILIATE_COMMISSION" },
      { amount_cents: 300, status: "CANCELLED", type: "REFERRAL" },
      { amount_cents: -1000, status: "CONFIRMED", type: "REDEMPTION" },
    ]);
    expect(summary).toEqual({ pending: 420, available: 670, lifetimeEarned: 1670, lifetimeRedeemed: 1000 });
  });

  it("keeps cancelled rewards out of the available balance", () => {
    const summary = summariseLedger([{ amount_cents: 150, status: "CANCELLED", type: "AFFILIATE_COMMISSION" }]);
    expect(summary.available).toBe(0);
    expect(summary.pending).toBe(0);
  });
});

describe("profitability", () => {
  it("reports the reward cost / revenue ratio", () => {
    expect(rewardCostRatio(150, 500)).toBeCloseTo(0.3);
    expect(rewardCostRatio(150, 0)).toBeNull();
  });

  it("formats amounts for humans without touching stored values", () => {
    expect(formatCents(1670).replace(/\u202f|\u00a0/g, " ")).toBe("16,70 €");
  });
});
