/**
 * URL validation shared by client and server.
 * Never trust the client: the server re-validates with the same helpers.
 */

const ALLOWED_PROTOCOLS = ["http:", "https:"];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "metadata",
  "metadata.google.internal",
  "instance-data",
]);

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = nums as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!h.includes(":")) return false;
  if (h === "::1" || h === "::") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique local
  if (h.startsWith("fe80")) return true; // link-local
  return false;
}

export type SafeUrlResult =
  { ok: true; url: string; hostname: string } | { ok: false; reason: string };

/** Validates a user-provided external URL (anti-SSRF, anti-javascript:/data:). */
export function validateExternalUrl(raw: string): SafeUrlResult {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: false, reason: "Adresse manquante." };
  if (trimmed.length > 2048) return { ok: false, reason: "Adresse trop longue." };

  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) candidate = `https://${candidate}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, reason: "Adresse invalide." };
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return { ok: false, reason: "Seules les adresses http(s) sont acceptées." };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "Adresse non autorisée." };
  }

  const host = parsed.hostname.toLowerCase();
  if (
    !host ||
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return { ok: false, reason: "Ce domaine n'est pas autorisé." };
  }
  if (isPrivateIpv4(host) || isPrivateIpv6(host)) {
    return { ok: false, reason: "Ce domaine n'est pas autorisé." };
  }
  // A bare hostname without a dot is either an internal service or invalid.
  if (!host.includes(".") && !host.includes(":")) {
    return { ok: false, reason: "Ce domaine n'est pas autorisé." };
  }

  parsed.hash = "";
  return { ok: true, url: parsed.toString(), hostname: host };
}

/** Safe href for rendering: returns null when the URL must not be linked. */
export function safeHref(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const result = validateExternalUrl(raw);
  return result.ok ? result.url : null;
}

/** Registrable-ish domain used to match merchants (drops leading www.). */
export function normalizeDomain(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export function domainMatches(hostname: string, domains: string[] | null | undefined): boolean {
  const host = normalizeDomain(hostname);
  return (domains ?? []).some((d) => {
    const domain = normalizeDomain(d.trim());
    if (!domain) return false;
    return host === domain || host.endsWith(`.${domain}`);
  });
}
