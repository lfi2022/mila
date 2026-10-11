import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const AAD = Buffer.from("mila:analytics-ip:v1");

function keyFromAuthSecret(secret: string) {
  return createHash("sha256").update("mila:analytics-ip:key:v1\0").update(secret).digest();
}

export function encryptAnalyticsIp(ip: string, authSecret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, keyFromAuthSecret(authSecret), iv);
  cipher.setAAD(AAD);
  const encrypted = Buffer.concat([cipher.update(ip, "utf8"), cipher.final()]);
  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptAnalyticsIp(payload: string, authSecret: string): string {
  const [version, ivValue, tagValue, encryptedValue] = payload.split(".");
  if (version !== VERSION || !ivValue || !tagValue || !encryptedValue)
    throw new Error("Invalid encrypted analytics IP payload");
  const decipher = createDecipheriv(
    ALGORITHM,
    keyFromAuthSecret(authSecret),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAAD(AAD);
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
