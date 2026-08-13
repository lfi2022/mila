import { domainMatches, validateExternalUrl } from "./url-safety";

/**
 * Centralised affiliation logic. Never duplicate this in components:
 * merchants are administrable, so the rules must live in one place.
 */

export type MerchantConfig = {
  id: string;
  name: string;
  domains: string[] | null;
  enabled: boolean;
  affiliate_enabled: boolean;
  affiliate_network: string | null;
  affiliate_id: string | null;
  affiliate_template: string | null;
};

export function findMerchantForUrl<T extends MerchantConfig>(
  url: string,
  merchants: T[],
): T | null {
  const parsed = validateExternalUrl(url);
  if (!parsed.ok) return null;
  return merchants.find((m) => domainMatches(parsed.hostname, m.domains)) ?? null;
}

export type AffiliateResult = { url: string; affiliate: boolean };

/**
 * Builds the outgoing link. Supported template placeholders:
 *   {url}         original URL
 *   {encodedUrl}  original URL, percent-encoded
 *   {affiliateId} merchant affiliate identifier
 * A template without placeholders is treated as a query parameter pair list,
 * e.g. "tag={affiliateId}" appended to the original URL.
 */
export function buildOutgoingUrl(
  originalUrl: string,
  merchant: MerchantConfig | null,
): AffiliateResult {
  const parsed = validateExternalUrl(originalUrl);
  if (!parsed.ok) return { url: "", affiliate: false };
  const safeUrl = parsed.url;

  if (!merchant || !merchant.enabled || !merchant.affiliate_enabled) {
    return { url: safeUrl, affiliate: false };
  }

  const template = (merchant.affiliate_template ?? "").trim();
  const affiliateId = (merchant.affiliate_id ?? "").trim();
  if (!template) {
    if (!affiliateId) return { url: safeUrl, affiliate: false };
    return { url: safeUrl, affiliate: false };
  }

  const filled = template
    .replaceAll("{url}", safeUrl)
    .replaceAll("{encodedUrl}", encodeURIComponent(safeUrl))
    .replaceAll("{affiliateId}", affiliateId);

  // Query-parameter style template: "tag=mila-21&ref=mila"
  if (!/^https?:\/\//i.test(filled)) {
    try {
      const withParams = new URL(safeUrl);
      for (const pair of filled.split("&")) {
        const [key, value] = pair.split("=");
        if (key && value) withParams.searchParams.set(key, value);
      }
      return { url: withParams.toString(), affiliate: true };
    } catch {
      return { url: safeUrl, affiliate: false };
    }
  }

  const validated = validateExternalUrl(filled);
  if (!validated.ok) return { url: safeUrl, affiliate: false };
  return { url: validated.url, affiliate: true };
}
