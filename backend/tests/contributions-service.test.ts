import { describe, expect, it } from "vitest";

import { calculateContributionSplit } from "../src/modules/contributions/service.js";

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
