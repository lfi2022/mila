import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

function keyFromBase64(value: string): Buffer {
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("BANK_ACCOUNT_ENCRYPTION_KEY must decode to 32 bytes");
  return key;
}

export function normalizeIban(value: string): string {
  const iban = value.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) throw new Error("IBAN_INVALID");
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  let remainder = 0;
  for (const character of rearranged) {
    const numeric = /\d/.test(character) ? character : String(character.charCodeAt(0) - 55);
    for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  if (remainder !== 1) throw new Error("IBAN_INVALID");
  return iban;
}

export function maskIban(iban: string): string {
  return `${iban.slice(0, 4)} •••• •••• ${iban.slice(-4)}`;
}

export function fingerprintIban(iban: string, keyValue: string): string {
  return createHmac("sha256", keyFromBase64(keyValue))
    .update("mila:bank-account:fingerprint:v1\0")
    .update(iban)
    .digest("hex");
}

export function encryptIban(iban: string, keyValue: string): string {
  const key = keyFromBase64(keyValue);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from("mila:bank-account:v1"));
  const encrypted = Buffer.concat([cipher.update(iban, "utf8"), cipher.final()]);
  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptIban(payload: string, keyValue: string): string {
  const [version, ivValue, tagValue, encryptedValue] = payload.split(".");
  if (version !== VERSION || !ivValue || !tagValue || !encryptedValue)
    throw new Error("Invalid encrypted IBAN payload");
  const decipher = createDecipheriv(
    ALGORITHM,
    keyFromBase64(keyValue),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAAD(Buffer.from("mila:bank-account:v1"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
