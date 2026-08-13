import { apiRequest } from "@/services/api/client";
import { setAnalyticsConsent } from "@/lib/analytics";

export const COOKIE_CONSENT_KEY = "mila.cookie-consent";
const ANALYTICS_VISITOR_KEY = "mila.analytics-visitor";

export type CookieChoices = { analytics: boolean; marketing: boolean };
export type CookieConsent = {
  id: string;
  policyVersion: string;
  savedAt: string;
  choices: CookieChoices;
};

export function readCookieConsent(policyVersion?: string): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(COOKIE_CONSENT_KEY) ?? "null",
    ) as CookieConsent | null;
    if (!parsed?.id || !parsed.choices || (policyVersion && parsed.policyVersion !== policyVersion))
      return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveCookieConsent(policyVersion: string, choices: CookieChoices) {
  const previous = readCookieConsent();
  const consent: CookieConsent = {
    id: previous?.id ?? crypto.randomUUID(),
    policyVersion,
    savedAt: new Date().toISOString(),
    choices,
  };
  window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
  setAnalyticsConsent(choices.analytics);
  if (!choices.analytics) window.localStorage.removeItem(ANALYTICS_VISITOR_KEY);
  window.dispatchEvent(new CustomEvent("mila:cookie-consent", { detail: consent }));
  await apiRequest<void>("/privacy/cookie-consents", {
    method: "POST",
    body: JSON.stringify({ consentId: consent.id, policyVersion, choices }),
  }).catch(() => undefined);
  return consent;
}

export function openCookieManager() {
  window.dispatchEvent(new Event("mila:open-cookie-manager"));
}
