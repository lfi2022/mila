import { buildOutgoingUrl, type MerchantConfig } from "./affiliate";
import { validateExternalUrl } from "./url-safety";

/**
 * Affiliate conversion engine.
 *
 * Three configurable modes per merchant (administrable, secrets never leave the server):
 *  - NONE     : the original link is used as-is.
 *  - TEMPLATE : deterministic rewriting from `affiliate_template` (query pairs or full URL).
 *  - API      : the partner network converts the link (deeplink generator API).
 */
export type AffiliateMerchant = MerchantConfig & {
  link_mode?: string | null;
  api_endpoint?: string | null;
  api_key?: string | null;
  api_config?: unknown;
};

export type ResolvedLink = {
  url: string;
  affiliate: boolean;
  /** How the link was produced — useful for the admin dry-run. */
  via: "original" | "template" | "api";
};

const API_TIMEOUT_MS = 4000;
const RESPONSE_KEYS = ["url", "link", "deeplink", "tracking_url", "trackingUrl", "short_url", "shortUrl"];

function pickUrl(payload: unknown): string | null {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  for (const key of RESPONSE_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      const nested = pickUrl(value);
      if (nested) return nested;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        const nested = pickUrl(entry);
        if (nested) return nested;
      }
    }
  }
  return null;
}

async function convertThroughApi(
  safeUrl: string,
  merchant: AffiliateMerchant,
): Promise<ResolvedLink | null> {
  const endpoint = (merchant.api_endpoint ?? "").trim();
  if (!endpoint) return null;
  const endpointCheck = validateExternalUrl(endpoint);
  if (!endpointCheck.ok) return null;

  const extra =
    merchant.api_config && typeof merchant.api_config === "object" && !Array.isArray(merchant.api_config)
      ? (merchant.api_config as Record<string, unknown>)
      : {};

  const headers = new Headers({ "content-type": "application/json", accept: "application/json" });
  const apiKey = (merchant.api_key ?? "").trim();
  if (apiKey) {
    const headerName = typeof extra["header"] === "string" ? (extra["header"] as string) : "Authorization";
    const scheme = typeof extra["scheme"] === "string" ? (extra["scheme"] as string) : "Bearer";
    headers.set(headerName, scheme ? `${scheme} ${apiKey}` : apiKey);
  }

  try {
    const response = await fetch(endpointCheck.url, {
      method: "POST",
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      body: JSON.stringify({
        url: safeUrl,
        destination_url: safeUrl,
        affiliate_id: merchant.affiliate_id ?? null,
        network: merchant.affiliate_network ?? null,
        ...extra,
      }),
    });
    if (!response.ok) return null;
    const raw = await response.text();
    if (raw.length > 100_000) return null;

    let payload: unknown = raw;
    try {
      payload = JSON.parse(raw);
    } catch {
      /* plain-text URL response is accepted below */
    }

    const candidate = pickUrl(payload);
    if (!candidate) return null;
    const validated = validateExternalUrl(candidate.trim());
    if (!validated.ok) return null;
    return { url: validated.url, affiliate: true, via: "api" };
  } catch {
    return null;
  }
}

/**
 * Resolves the outgoing link for a product URL. Never throws: on any failure the
 * visitor is still sent to the original merchant page.
 */
export async function resolveOutgoingUrl(
  originalUrl: string,
  merchant: AffiliateMerchant | null,
): Promise<ResolvedLink> {
  const parsed = validateExternalUrl(originalUrl);
  if (!parsed.ok) return { url: "", affiliate: false, via: "original" };
  const safeUrl = parsed.url;

  if (!merchant || !merchant.enabled || !merchant.affiliate_enabled) {
    return { url: safeUrl, affiliate: false, via: "original" };
  }

  const mode = (merchant.link_mode ?? "TEMPLATE").toUpperCase();
  if (mode === "NONE") return { url: safeUrl, affiliate: false, via: "original" };

  if (mode === "API") {
    const converted = await convertThroughApi(safeUrl, merchant);
    if (converted) return converted;
    // graceful fallback: template, then original link
  }

  const templated = buildOutgoingUrl(safeUrl, merchant);
  return {
    url: templated.url || safeUrl,
    affiliate: templated.affiliate,
    via: templated.affiliate ? "template" : "original",
  };
}
