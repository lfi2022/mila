/**
 * Lightweight, consent-aware conversion analytics.
 *
 * No third-party tracker is loaded. Events are buffered in memory and only
 * forwarded to `window.dataLayer` (for a future consented tag manager) when the
 * visitor has explicitly accepted analytics via `setAnalyticsConsent(true)`.
 */

export type MilaAnalyticsEvent =
  | "homepage_view"
  | "signup_cta_clicked"
  | "demo_clicked"
  | "rewards_learn_more_clicked"
  | "signup_started"
  | "signup_completed"
  | "list_created"
  | "first_gift_added"
  | "list_shared";

const CONSENT_KEY = "mila.analytics-consent";
const buffer: Array<{ event: MilaAnalyticsEvent; props: Record<string, unknown>; at: string }> = [];

function hasConsent() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CONSENT_KEY) === "granted";
  } catch {
    return false;
  }
}

export function setAnalyticsConsent(granted: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_KEY, granted ? "granted" : "denied");
  } catch {
    /* storage unavailable — stay in memory only */
  }
  if (granted) flush();
}

export function getAnalyticsConsent(): "granted" | "denied" | "unset" {
  if (typeof window === "undefined") return "unset";
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : "unset";
  } catch {
    return "unset";
  }
}

function push(entry: { event: MilaAnalyticsEvent; props: Record<string, unknown>; at: string }) {
  const layer = ((window as unknown as { dataLayer?: unknown[] }).dataLayer ??= []);
  layer.push({ event: entry.event, ...entry.props, event_time: entry.at });
}

function flush() {
  if (typeof window === "undefined") return;
  while (buffer.length > 0) push(buffer.shift()!);
}

/** Records a funnel event: visitors → signup → list → first gift → share. */
export function track(event: MilaAnalyticsEvent, props: Record<string, unknown> = {}) {
  const entry = { event, props, at: new Date().toISOString() };
  if (typeof window === "undefined") return;
  if (!hasConsent()) {
    // Keep at most a short buffer so nothing leaves the page without consent.
    if (buffer.length < 50) buffer.push(entry);
    return;
  }
  flush();
  push(entry);
}
