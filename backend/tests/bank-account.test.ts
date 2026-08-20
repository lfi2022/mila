import { describe, expect, it } from "vitest";

import {
  decryptIban,
  encryptIban,
  fingerprintIban,
  maskIban,
  normalizeIban,
} from "../src/common/security/bank-account.js";

const key = Buffer.alloc(32, 42).toString("base64");

describe("parent bank account protection", () => {
  it("validates, encrypts and decrypts an IBAN", () => {
    const iban = normalizeIban("BE68 5390 0754 7034");
    const encrypted = encryptIban(iban, key);
    expect(encrypted).not.toContain(iban);
    expect(decryptIban(encrypted, key)).toBe(iban);
    expect(maskIban(iban)).toBe("BE68 •••• •••• 7034");
  });

  it("uses a deterministic keyed fingerprint and rejects invalid IBANs", () => {
    const iban = normalizeIban("BE68539007547034");
    expect(fingerprintIban(iban, key)).toBe(fingerprintIban(iban, key));
    expect(() => normalizeIban("BE00 0000 0000 0000")).toThrow("IBAN_INVALID");
  });

  it("rejects an authenticated ciphertext that was modified", () => {
    const encrypted = encryptIban("BE68539007547034", key);
    const parts = encrypted.split(".");
    parts[2] = `${parts[2]?.startsWith("A") ? "B" : "A"}${parts[2]?.slice(1)}`;
    expect(() => decryptIban(parts.join("."), key)).toThrow();
  });
});
