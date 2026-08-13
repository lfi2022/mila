import type { AppConfig } from "../../config/env.js";
import { safeFetchHtml } from "../../common/security/external-url.js";

export type ProductPreview = {
  url: string;
  canonicalUrl: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  priceMinor: bigint | null;
  currency: string;
  availability: string | null;
  brand: string | null;
  sku: string | null;
  gtin: string | null;
  source: "JSON_LD" | "OPEN_GRAPH" | "METADATA";
};

export async function extractProduct(rawUrl: string, config: AppConfig): Promise<ProductPreview> {
  const page = await safeFetchHtml(rawUrl, config);
  const jsonLd = extractJsonLd(page.body);
  const meta = extractMeta(page.body);
  const product = findProduct(jsonLd);
  const price = stringValue(product?.["offers"], "price") ?? meta["product:price:amount"];
  const canonical = meta["canonical"] ? new URL(meta["canonical"], page.url).toString() : page.url;
  return {
    url: page.url,
    canonicalUrl: canonical,
    title: clean(stringValue(product, "name") ?? meta["og:title"] ?? meta["title"]),
    description: clean(
      stringValue(product, "description") ?? meta["og:description"] ?? meta["description"],
    ),
    imageUrl: absoluteImage(imageValue(product?.["image"]) ?? meta["og:image"], page.url),
    priceMinor: toMinor(price),
    currency: (
      stringValue(product?.["offers"], "priceCurrency") ??
      meta["product:price:currency"] ??
      "EUR"
    )
      .toUpperCase()
      .slice(0, 3),
    availability: clean(stringValue(product?.["offers"], "availability")),
    brand: clean(stringValue(product?.["brand"], "name") ?? stringValue(product, "brand")),
    sku: clean(stringValue(product, "sku") ?? stringValue(product, "mpn")),
    gtin: clean(
      stringValue(product, "gtin13") ??
        stringValue(product, "gtin") ??
        stringValue(product, "gtin14"),
    ),
    source: product ? "JSON_LD" : meta["og:title"] ? "OPEN_GRAPH" : "METADATA",
  };
}

function extractJsonLd(html: string): unknown[] {
  const values: unknown[] = [];
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed: unknown = JSON.parse(match[1] ?? "");
      values.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch {
      /* malformed publisher metadata is ignored */
    }
  }
  return values;
}

function findProduct(values: unknown[]): Record<string, unknown> | undefined {
  const queue = [...values];
  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== "object") continue;
    const record = value as Record<string, unknown>;
    const type = record["@type"];
    if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) return record;
    const graph = record["@graph"];
    if (Array.isArray(graph)) queue.push(...graph);
  }
  return undefined;
}

function extractMeta(html: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const tag of html.match(/<meta\s+[^>]*>/gi) ?? []) {
    const key = attribute(tag, "property") ?? attribute(tag, "name");
    const content = attribute(tag, "content");
    if (key && content) result[key.toLowerCase()] = decode(content);
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title) result["title"] = decode(title);
  const canonical = (html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*>/i) ?? [])[0];
  if (canonical) result["canonical"] = attribute(canonical, "href") ?? "";
  return result;
}

function attribute(tag: string, name: string) {
  return tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];
}
function decode(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function clean(value: string | null | undefined) {
  return value ? decode(value).slice(0, 10_000) : null;
}
function stringValue(value: unknown, key?: string): string | undefined {
  const selected =
    key && value && typeof value === "object" ? (value as Record<string, unknown>)[key] : value;
  return typeof selected === "string" || typeof selected === "number"
    ? String(selected)
    : undefined;
}
function imageValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return imageValue(value[0]);
  return stringValue(value, "url");
}
function absoluteImage(value: string | undefined, base: string) {
  if (!value) return null;
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}
function toMinor(value: string | undefined): bigint | null {
  if (!value || !/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.replace(",", ".").split(".");
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
}
