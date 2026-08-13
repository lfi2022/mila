import { describe, expect, it } from "vitest";

import { isBlockedAddress, normalizeUrl } from "../src/common/security/external-url.js";

describe("external URL SSRF guard", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "169.254.169.254",
    "172.20.0.1",
    "192.168.1.1",
    "100.64.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("blocks non-public address %s", (address) => expect(isBlockedAddress(address)).toBe(true));

  it("accepts a normal public HTTPS URL and strips fragments", () => {
    expect(normalizeUrl("https://example.com/product#reviews").toString()).toBe(
      "https://example.com/product",
    );
  });

  it.each(["file:///etc/passwd", "http://localhost/", "http://user:pass@example.com/"])(
    "rejects unsafe URL %s",
    (url) => expect(() => normalizeUrl(url)).toThrow(),
  );
});
