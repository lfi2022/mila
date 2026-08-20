import { describe, expect, it } from "vitest";

import {
  decideMediaUsage,
  detectGenericImageCategory,
  selectProductImage,
} from "../src/modules/product-media/policy.js";

describe("product media deny-by-default policy", () => {
  it("never displays or caches an unverified remote URL", () => {
    expect(decideMediaUsage("REMOTE_UNVERIFIED")).toEqual({
      usageStatus: "REVIEW_REQUIRED",
      display: false,
      cache: false,
      reason: "remote-source-unverified",
    });
  });

  it("requires current verified merchant evidence", () => {
    const base = {
      allowRemoteDisplay: true,
      allowCaching: true,
      allowLocalStorage: true,
      allowTransformation: false,
      allowCommercialUse: true,
      verifiedAt: new Date("2026-01-01"),
      reviewAfter: null,
      status: "REVIEW_REQUIRED",
    };
    expect(decideMediaUsage("OFFICIAL_API", base).display).toBe(false);
    expect(decideMediaUsage("OFFICIAL_API", { ...base, status: "VERIFIED" })).toMatchObject({
      usageStatus: "AUTHORIZED_CACHE",
      display: true,
      cache: true,
    });
  });

  it("uses a generic fallback instead of forbidden media", () => {
    expect(
      selectProductImage(
        [
          {
            usageStatus: "REVIEW_REQUIRED",
            status: "ACTIVE",
            originalUrl: "https://merchant.test/image.jpg",
            publicUrl: null,
            storedObjectKey: null,
          },
        ],
        "STROLLER",
      ),
    ).toBe("/generic-images/stroller.webp");
  });

  it.each([
    ["Poussette compacte", "STROLLER"],
    ["Doudou lapin", "PLUSH_RABBIT"],
    ["Transat bébé", "BABY_BOUNCER"],
    ["Lit à barreaux", "BABY_CRIB"],
    ["Body bébé en coton", "CLOTHING"],
    ["Assiette et cuillère", "FEEDING"],
    ["Cape de bain", "BATH"],
    ["Jouet d'éveil", "TOY"],
  ])("categorizes %s", (title, expected) => {
    expect(detectGenericImageCategory(title)).toBe(expected);
  });
});
