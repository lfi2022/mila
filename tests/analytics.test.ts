import { describe, expect, it } from "vitest";

import { analyticsPath } from "../src/lib/analytics";

describe("analytics path minimization", () => {
  it("keeps useful static paths and removes identifiers", () => {
    expect(analyticsPath("/auth")).toBe("/auth");
    expect(analyticsPath("/dashboard/54b203e2-6e4c-40db-9d4a-c9a218e3b6c7")).toBe(
      "/dashboard/:listId",
    );
    expect(analyticsPath("/l/alice-et-louis")).toBe("/l/:slug");
    expect(analyticsPath("/premium/54b203e2-6e4c-40db-9d4a-c9a218e3b6c7")).toBe("/premium/:listId");
    expect(analyticsPath("/invitation/raw-secret-token")).toBe("/other");
  });
});
