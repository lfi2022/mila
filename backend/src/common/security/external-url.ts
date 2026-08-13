import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch } from "undici";

import { AppError } from "../errors/app-error.js";
import type { AppConfig } from "../../config/env.js";

const blockedNames = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "instance-data",
]);

export type SafeFetchResult = { url: string; contentType: string; body: string };

export async function safeFetchHtml(raw: string, config: AppConfig): Promise<SafeFetchResult> {
  let target = normalizeUrl(raw);
  for (let redirects = 0; redirects <= config.PRODUCT_FETCH_MAX_REDIRECTS; redirects += 1) {
    const addresses = await resolvePublicAddresses(target.hostname);
    let cursor = 0;
    const dispatcher = new Agent({
      connect: {
        lookup(_hostname, _options, callback) {
          const entry = addresses[cursor++ % addresses.length]!;
          callback(null, entry.address, entry.family);
        },
      },
    });
    try {
      const response = await fetch(target, {
        dispatcher,
        redirect: "manual",
        signal: AbortSignal.timeout(config.PRODUCT_FETCH_TIMEOUT_MS),
        headers: {
          accept: "text/html,application/xhtml+xml;q=0.9",
          "user-agent": config.PRODUCT_FETCH_USER_AGENT,
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirects === config.PRODUCT_FETCH_MAX_REDIRECTS) {
          throw new AppError(
            422,
            "PRODUCT_REDIRECT_INVALID",
            "Product page redirect limit exceeded",
          );
        }
        target = normalizeUrl(new URL(location, target).toString());
        continue;
      }
      if (!response.ok)
        throw new AppError(422, "PRODUCT_FETCH_FAILED", "Product page could not be read");
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
        throw new AppError(415, "PRODUCT_CONTENT_UNSUPPORTED", "Product URL must return HTML");
      }
      const declared = Number(response.headers.get("content-length"));
      if (declared > config.PRODUCT_FETCH_MAX_BYTES) {
        throw new AppError(413, "PRODUCT_PAGE_TOO_LARGE", "Product page is too large");
      }
      const body = await readLimited(response.body, config.PRODUCT_FETCH_MAX_BYTES);
      return { url: target.toString(), contentType, body };
    } finally {
      await dispatcher.close();
    }
  }
  throw new AppError(422, "PRODUCT_FETCH_FAILED", "Product page could not be read");
}

export function normalizeUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new AppError(400, "URL_INVALID", "Invalid URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new AppError(400, "URL_NOT_ALLOWED", "Only credential-free HTTP(S) URLs are allowed");
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !host ||
    blockedNames.has(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    (!host.includes(".") && !isIP(host))
  ) {
    throw new AppError(400, "URL_NOT_ALLOWED", "URL host is not allowed");
  }
  if (isIP(host) && isBlockedAddress(host))
    throw new AppError(400, "URL_NOT_ALLOWED", "URL address is not allowed");
  parsed.hash = "";
  return parsed;
}

async function resolvePublicAddresses(hostname: string) {
  const results = await lookup(hostname, { all: true, verbatim: true }).catch(() => []);
  if (!results.length || results.some(({ address }) => isBlockedAddress(address))) {
    throw new AppError(400, "URL_NOT_ALLOWED", "URL resolves to a non-public address");
  }
  return results;
}

export function isBlockedAddress(raw: string): boolean {
  const address = raw.toLowerCase().split("%")[0]!;
  if (address.startsWith("::ffff:")) return isBlockedAddress(address.slice(7));
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number) as [number, number, number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (isIP(address) === 6) {
    return (
      address === "::" ||
      address === "::1" ||
      address.startsWith("fc") ||
      address.startsWith("fd") ||
      address.startsWith("fe8") ||
      address.startsWith("fe9") ||
      address.startsWith("fea") ||
      address.startsWith("feb") ||
      address.startsWith("2001:db8")
    );
  }
  return true;
}

async function readLimited(
  stream: ReadableStream<Uint8Array> | null,
  limit: number,
): Promise<string> {
  if (!stream) return "";
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new AppError(413, "PRODUCT_PAGE_TOO_LARGE", "Product page is too large");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
