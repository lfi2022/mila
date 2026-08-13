import { describe, expect, it } from "vitest";
import { reportRiskScore } from "../src/modules/reports/routes.js";

describe("adaptive report defenses", () => {
  it("keeps ordinary detailed reports in the normal queue", () => {
    expect(
      reportRiskScore({ reason: "OTHER", details: "Description détaillée", elapsedMs: 8_000 }),
    ).toBe(0);
  });
  it("forces high-risk automated submissions into the challenge path", () => {
    expect(
      reportRiskScore({
        reason: "PHISHING",
        details: "http://a http://b http://c http://d",
        elapsedMs: 100,
      }),
    ).toBeGreaterThanOrEqual(70);
    expect(reportRiskScore({ reason: "SPAM", website: "bot" })).toBe(100);
  });
});
