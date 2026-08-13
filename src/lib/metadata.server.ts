import { validateExternalUrl } from "./url-safety";

/**
 * Server-only product metadata extraction.
 * Hardened against SSRF: every hop is re-validated, redirects are followed
 * manually, the body is size-capped and the request is time-limited.
 */

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

export type ProductMetadata = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  siteName: string | null;
  url: string;
  hostname: string;
};

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x?([0-9a-fA-F]+);/g, (_m, code: string) => {
      const num = code.startsWith("x") || code.startsWith("X") ? parseInt(code.slice(1), 16) : parseInt(code, 10);
      return Number.isFinite(num) ? String.fromCodePoint(num) : "";
    })
    .trim();
}

function clean(value: string | null | undefined, max = 400): string | null {
  if (!value) return null;
  const text = decodeEntities(value).replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.slice(0, max);
}

function metaContent(html: string, key: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) return match[1];
  }
  return null;
}

function parsePrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[^\d,.\-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) && num >= 0 && num < 1_000_000 ? num : null;
}

type JsonRecord = Record<string, unknown>;

function collectJsonLd(html: string): JsonRecord[] {
  const results: JsonRecord[] = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null && results.length < 20) {
    const raw = match[1];
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw.trim());
      const queue: unknown[] = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length && results.length < 20) {
        const node = queue.shift();
        if (!node || typeof node !== "object") continue;
        const record = node as JsonRecord;
        results.push(record);
        const graph = record["@graph"];
        if (Array.isArray(graph)) queue.push(...graph);
      }
    } catch {
      // Ignore malformed structured data — extraction stays best-effort.
    }
  }
  return results;
}

function typeIncludes(node: JsonRecord, wanted: string): boolean {
  const type = node["@type"];
  if (typeof type === "string") return type.toLowerCase() === wanted;
  if (Array.isArray(type)) return type.some((t) => typeof t === "string" && t.toLowerCase() === wanted);
  return false;
}

function firstImage(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return firstImage(value[0]);
  if (value && typeof value === "object") {
    const record = value as JsonRecord;
    if (typeof record["url"] === "string") return record["url"];
  }
  return null;
}

async function safeFetch(startUrl: string): Promise<{ html: string; finalUrl: string } | null> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const validated = validateExternalUrl(current);
    if (!validated.ok) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(validated.url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": "MilaBot/1.0 (+https://mila.be) metadata-preview",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "fr,en;q=0.8",
        },
      });
    } catch {
      clearTimeout(timer);
      return null;
    }
    clearTimeout(timer);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      try {
        current = new URL(location, validated.url).toString();
      } catch {
        return null;
      }
      continue;
    }

    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("xml")) return null;

    const reader = response.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.byteLength;
      }
    }
    try {
      await reader.cancel();
    } catch {
      // stream already closed
    }
    const buffer = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk.subarray(0, Math.min(chunk.byteLength, received - offset)), offset);
      offset += chunk.byteLength;
      if (offset >= received) break;
    }
    return { html: new TextDecoder("utf-8").decode(buffer), finalUrl: validated.url };
  }
  return null;
}

export async function extractProductMetadata(rawUrl: string): Promise<ProductMetadata> {
  const validated = validateExternalUrl(rawUrl);
  if (!validated.ok) throw new Error(validated.reason);

  const fetched = await safeFetch(validated.url);
  const base: ProductMetadata = {
    title: null,
    description: null,
    imageUrl: null,
    price: null,
    currency: null,
    siteName: null,
    url: validated.url,
    hostname: validated.hostname,
  };
  if (!fetched) return base;

  const { html, finalUrl } = fetched;

  let title = clean(metaContent(html, "og:title") ?? metaContent(html, "twitter:title"), 180);
  let description = clean(
    metaContent(html, "og:description") ?? metaContent(html, "twitter:description") ?? metaContent(html, "description"),
    500,
  );
  let imageUrl = clean(
    metaContent(html, "og:image:secure_url") ?? metaContent(html, "og:image") ?? metaContent(html, "twitter:image"),
    1000,
  );
  let price = parsePrice(metaContent(html, "product:price:amount") ?? metaContent(html, "og:price:amount"));
  let currency = clean(metaContent(html, "product:price:currency") ?? metaContent(html, "og:price:currency"), 8);
  const siteName = clean(metaContent(html, "og:site_name"), 80);

  for (const node of collectJsonLd(html)) {
    if (!typeIncludes(node, "product")) continue;
    if (!title && typeof node["name"] === "string") title = clean(node["name"], 180);
    if (!description && typeof node["description"] === "string") description = clean(node["description"], 500);
    if (!imageUrl) imageUrl = clean(firstImage(node["image"]), 1000);
    const offers = node["offers"];
    const offerList = Array.isArray(offers) ? offers : offers ? [offers] : [];
    for (const offer of offerList) {
      if (!offer || typeof offer !== "object") continue;
      const record = offer as JsonRecord;
      if (price === null) price = parsePrice(record["price"] ?? record["lowPrice"]);
      if (!currency && typeof record["priceCurrency"] === "string") currency = clean(record["priceCurrency"], 8);
    }
    break;
  }

  if (!title) {
    const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    title = clean(titleTag?.[1], 180);
  }

  if (imageUrl) {
    try {
      const absolute = new URL(imageUrl, finalUrl).toString();
      imageUrl = validateExternalUrl(absolute).ok ? absolute : null;
    } catch {
      imageUrl = null;
    }
  }

  return {
    ...base,
    title,
    description,
    imageUrl,
    price,
    currency: currency ? currency.toUpperCase().slice(0, 3) : null,
    siteName,
  };
}
