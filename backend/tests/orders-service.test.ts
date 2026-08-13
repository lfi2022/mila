import { describe, expect, it } from "vitest";

import {
  buildOrderGroupingKey,
  canTransition,
  isGiftReadyForOrder,
} from "../src/modules/orders/service.js";

describe("order preparation policy", () => {
  it("groups only identical merchant, destination and ordering windows", () => {
    const destination = "a".repeat(64);
    const first = buildOrderGroupingKey(
      "list",
      "merchant",
      destination,
      "EUR",
      new Date("2026-08-14T00:00:00Z"),
      new Date("2026-08-20T00:00:00Z"),
    );
    expect(first).toBe(
      buildOrderGroupingKey(
        "list",
        "merchant",
        destination,
        "EUR",
        new Date("2026-08-14T00:00:00Z"),
        new Date("2026-08-20T00:00:00Z"),
      ),
    );
    expect(first).not.toBe(buildOrderGroupingKey("list", "another", destination, "EUR"));
  });

  it("never treats a reservation as funding", () => {
    expect(isGiftReadyForOrder("RESERVED")).toBe(false);
    expect(isGiftReadyForOrder("FUNDED")).toBe(true);
  });

  it("enforces forward-only fulfilment transitions", () => {
    expect(canTransition("SUBMITTED", "ORDERED")).toBe(true);
    expect(canTransition("ORDERED", "READY")).toBe(false);
    expect(canTransition("COMPLETED", "CANCELLED")).toBe(false);
  });
});
