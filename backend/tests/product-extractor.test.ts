import { describe, expect, it } from "vitest";

import { extractProductHtml } from "../src/modules/products/extractor.js";

describe("product metadata extraction", () => {
  it("prefers JSON-LD product data and converts money to minor units", () => {
    const preview = extractProductHtml(
      `<html><head><meta property="og:title" content="Fallback"><script type="application/ld+json">${JSON.stringify(
        {
          "@type": "Product",
          name: "Poussette sûre",
          description: "Description",
          image: ["/image.jpg"],
          sku: "SKU-1",
          gtin13: "1234567890123",
          brand: { name: "Mila Test" },
          offers: { price: "129.95", priceCurrency: "eur", availability: "InStock" },
        },
      )}</script></head></html>`,
      "https://shop.example/product",
    );
    expect(preview).toMatchObject({
      title: "Poussette sûre",
      priceMinor: 12_995n,
      currency: "EUR",
      imageUrl: "https://shop.example/image.jpg",
      sku: "SKU-1",
      gtin: "1234567890123",
      source: "JSON_LD",
    });
  });

  it("does not parse ambiguous or malformed prices", () => {
    const preview = extractProductHtml(
      '<meta property="og:title" content="Cadeau"><meta property="product:price:amount" content="1,234.56">',
      "https://shop.example/product",
    );
    expect(preview.priceMinor).toBeNull();
  });
});
