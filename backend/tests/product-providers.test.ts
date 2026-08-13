import { describe, expect, it } from "vitest";
import type { AppConfig } from "../src/config/env.js";
import {
  createProductProviders,
  selectProductProvider,
} from "../src/modules/products/providers.js";

describe("named product providers", () => {
  const providers = createProductProviders({} as AppConfig);

  it.each([
    ["https://amazon.fr/dp/example", "amazon"],
    ["https://www.ikea.com/be/fr/p/example", "ikea"],
    ["https://vertbaudet.be/example", "vertbaudet"],
    ["https://cybex-online.com/example", "cybex"],
    ["https://bol.com/be/fr/p/example", "bol"],
  ])("selects the explicit provider for %s", (url, id) => {
    const provider = selectProductProvider(new URL(url), providers);
    expect(provider?.id).toBe(id);
    expect(provider?.capabilities.images).toBe(false);
    expect(provider?.capabilities.imageCache).toBe(false);
  });

  it("falls back to metadata only for an unknown merchant", () => {
    expect(selectProductProvider(new URL("https://example.com/product"), providers)?.id).toBe(
      "generic-structured-metadata",
    );
  });
});
