import { describe, expect, it, vi } from "vitest";

import type { AppConfig } from "../src/config/env.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { PartnersService } from "../src/modules/partners/service.js";

const config = { AUTH_SECRET: "partner-test-secret-at-least-32-characters" } as AppConfig;

describe("PartnersService", () => {
  it("never renders an unknown or uncontracted partner", async () => {
    const service = new PartnersService(
      { partner: { findFirst: vi.fn().mockResolvedValue(null) } } as unknown as PrismaClient,
      config,
    );
    await expect(service.landing("fictional")).rejects.toMatchObject({
      code: "PARTNER_NOT_FOUND",
    });
  });

  it("returns an eligible real campaign and stores only a hashed attribution token", async () => {
    const create = vi.fn().mockResolvedValue({ id: "attribution-1" });
    const service = new PartnersService(
      {
        partner: {
          findFirst: vi.fn().mockResolvedValue({
            id: "partner-1",
            slug: "sage-femme-locale",
            name: "Cabinet local",
            category: "Sage-femme",
            summary: "Accompagnement local",
            websiteUrl: null,
            landingTitle: null,
            landingBody: null,
            region: "Bruxelles",
            campaigns: [
              {
                id: "campaign-1",
                code: "bienvenue",
                name: "Bienvenue",
                benefit: { title: "Avantage", description: "Description" },
                budgetMinor: 1_000n,
                currency: "EUR",
                endsAt: new Date(Date.now() + 86_400_000),
                ledgerEntries: [{ amountMinor: 100n }],
              },
            ],
          }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "partner-1" }),
        },
        partnerCampaign: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "campaign-1" }),
        },
        partnerAttribution: { create },
      } as unknown as PrismaClient,
      config,
    );
    const landing = await service.landing("sage-femme-locale", "bienvenue");
    expect(landing.campaign?.code).toBe("bienvenue");
    const token = await service.startAttribution("sage-femme-locale", "bienvenue", "QR");
    expect(token.length).toBeGreaterThan(32);
    const saved = create.mock.calls[0]?.[0].data as { tokenHash: string; channel: string };
    expect(saved.channel).toBe("QR");
    expect(saved.tokenHash).toBe(service.hash(token));
    expect(saved.tokenHash).not.toBe(token);
  });

  it("hides a campaign whose cost budget is exhausted", async () => {
    const service = new PartnersService(
      {
        partner: {
          findFirst: vi.fn().mockResolvedValue({
            id: "partner-1",
            slug: "local",
            name: "Local",
            category: "Photo",
            campaigns: [
              {
                id: "campaign-1",
                code: "full",
                budgetMinor: 500n,
                ledgerEntries: [{ amountMinor: 500n }],
              },
            ],
          }),
        },
      } as unknown as PrismaClient,
      config,
    );
    await expect(service.landing("local", "full")).rejects.toMatchObject({
      code: "CAMPAIGN_NOT_FOUND",
    });
  });
});
