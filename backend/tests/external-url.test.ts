import { describe, expect, it } from "vitest";

import {
  isBlockedAddress,
  normalizeUrl,
  readImageDimensions,
  validateImagePayload,
} from "../src/common/security/external-url.js";

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

  it("rejects non-standard ports for remote images", () => {
    expect(() => normalizeUrl("https://example.com:8443/image.jpg", true)).toThrow();
  });

  it("reads PNG dimensions before decoding", () => {
    const header = Buffer.alloc(24);
    header.writeUInt32BE(6000, 16);
    header.writeUInt32BE(5000, 20);
    expect(readImageDimensions(header, "image/png")).toEqual({ width: 6000, height: 5000 });
  });

  it.each([
    ["<html>not an image</html>", "image/jpeg"],
    ["<svg xmlns='http://www.w3.org/2000/svg'></svg>", "image/svg+xml"],
    ["MZ executable", "image/png"],
  ])("rejects a malicious or spoofed payload declared as %s", async (payload, mime) => {
    await expect(
      validateImagePayload(Buffer.from(payload), mime, new Set([mime]), 25_000_000),
    ).rejects.toThrow();
  });
});
