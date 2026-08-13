import { describe, expect, it } from "vitest";

import { calculateRefreshHours } from "../src/modules/prices/scheduler.js";
import { rankOffers } from "../src/modules/prices/service.js";

describe("price refresh policy", () => {
  it("refreshes volatile, near-due gifts faster while respecting merchant limits", () => {
    const hours = calculateRefreshHours({
      status: "AVAILABLE",
      dueDate: new Date("2026-08-18T00:00:00Z"),
      volatilityBps: 700,
      merchantMinMinutes: 720,
      failureCount: 0,
      minHours: 6,
      maxHours: 72,
      now: new Date("2026-08-13T00:00:00Z"),
    });
    expect(hours).toBe(12);
  });

  it("backs off failures and deprioritizes fulfilled gifts", () => {
    expect(
      calculateRefreshHours({
        status: "RESERVED",
        dueDate: null,
        volatilityBps: 0,
        merchantMinMinutes: 60,
        failureCount: 2,
        minHours: 6,
        maxHours: 168,
      }),
    ).toBe(168);
  });
});

describe("offer ranking", () => {
  const now = new Date("2026-08-13T00:00:00Z");
  it("uses delivery, availability, trust and timing instead of affiliation", () => {
    const ranked = rankOffers(
      [
        {
          id: "cheap-untrusted",
          priceMinor: 9_000n,
          deliveryMinor: 2_000n,
          currency: "EUR",
          available: true,
          deliveryEtaDays: 14,
          trustScore: 20,
          matchConfidence: 95,
          checkedAt: now,
          affiliateEligible: true,
        },
        {
          id: "best-user-value",
          priceMinor: 10_000n,
          deliveryMinor: 0n,
          currency: "EUR",
          available: true,
          deliveryEtaDays: 2,
          trustScore: 95,
          matchConfidence: 95,
          checkedAt: now,
          affiliateEligible: false,
        },
      ],
      "EUR",
      now,
    );
    expect(ranked[0]?.id).toBe("best-user-value");
  });

  it("excludes stale and weakly matched offers", () => {
    const ranked = rankOffers(
      [
        {
          id: "weak",
          priceMinor: 1n,
          deliveryMinor: null,
          currency: "EUR",
          available: true,
          deliveryEtaDays: 1,
          trustScore: 100,
          matchConfidence: 70,
          checkedAt: now,
          affiliateEligible: false,
        },
      ],
      "EUR",
      now,
    );
    expect(ranked).toEqual([]);
  });
});
