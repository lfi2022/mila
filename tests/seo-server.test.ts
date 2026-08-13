import { afterEach, describe, expect, it } from "vitest";

import { seoResponse } from "../src/server";

const originalSeo = process.env["SEO_INDEXING_ENABLED"];
const originalOrigin = process.env["PUBLIC_APP_URL"];

afterEach(() => {
  if (originalSeo === undefined) delete process.env["SEO_INDEXING_ENABLED"];
  else process.env["SEO_INDEXING_ENABLED"] = originalSeo;
  if (originalOrigin === undefined) delete process.env["PUBLIC_APP_URL"];
  else process.env["PUBLIC_APP_URL"] = originalOrigin;
});

describe("environment-driven SEO documents", () => {
  it("blocks robots and omits the sitemap outside production indexing", async () => {
    process.env["SEO_INDEXING_ENABLED"] = "false";
    process.env["PUBLIC_APP_URL"] = "https://staging.example.test";

    const robots = seoResponse(new Request("https://staging.example.test/robots.txt"));
    const sitemap = seoResponse(new Request("https://staging.example.test/sitemap.xml"));

    expect(await robots?.text()).toBe("User-agent: *\nDisallow: /\n");
    expect(robots?.headers.get("cache-control")).toBe("no-store");
    expect(sitemap?.status).toBe(404);
  });

  it("publishes only canonical public pages when indexing is enabled", async () => {
    process.env["SEO_INDEXING_ENABLED"] = "true";
    process.env["PUBLIC_APP_URL"] = "https://mila.example.test";

    const robots = seoResponse(new Request("https://mila.example.test/robots.txt"));
    const sitemap = seoResponse(new Request("https://mila.example.test/sitemap.xml"));
    const xml = await sitemap?.text();

    expect(await robots?.text()).toContain("Sitemap: https://mila.example.test/sitemap.xml");
    expect(sitemap?.status).toBe(200);
    expect(xml).toContain("https://mila.example.test/guides/liste-naissance");
    expect(xml).not.toContain("/dashboard");
    expect(xml).not.toContain("/l/");
  });

  it("fails closed when the canonical origin is invalid", async () => {
    process.env["SEO_INDEXING_ENABLED"] = "true";
    process.env["PUBLIC_APP_URL"] = "not-a-url";
    const robots = seoResponse(new Request("https://localhost/robots.txt"));
    expect(await robots?.text()).toContain("Disallow: /");
  });
});
