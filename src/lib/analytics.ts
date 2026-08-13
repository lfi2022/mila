import { runtimeConfig } from "@/config/runtime";

export type MilaAnalyticsEvent =
  | "homepage_view"
  | "signup_cta_clicked"
  | "demo_clicked"
  | "rewards_learn_more_clicked"
  | "signup_started"
  | "signup_completed"
  | "list_created"
  | "first_gift_added"
  | "list_shared"
  | "first_reservation"
  | "first_eligible_purchase"
  | "first_reward"
  | "premium_checkout_started"
  | "premium_activated"
  | "referral_registered"
  | "web_vital";

const CONSENT_KEY = "mila.analytics-consent";
const VISITOR_KEY = "mila.analytics-visitor";
let sessionId: string | undefined;

export function setAnalyticsConsent(granted: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_KEY, granted ? "granted" : "denied");
  } catch {
    /* unavailable: consent remains unset */
  }
  window.dispatchEvent(new CustomEvent("mila:analytics-consent", { detail: granted }));
}
export function getAnalyticsConsent(): "granted" | "denied" | "unset" {
  if (typeof window === "undefined") return "unset";
  try {
    const consent = JSON.parse(window.localStorage.getItem("mila.cookie-consent") ?? "null") as {
      choices?: { analytics?: boolean };
    } | null;
    if (typeof consent?.choices?.analytics !== "boolean") return "unset";
    return consent.choices.analytics ? "granted" : "denied";
  } catch {
    return "unset";
  }
}
export function track(event: MilaAnalyticsEvent, props: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || getAnalyticsConsent() !== "granted") return;
  const payload = JSON.stringify({
    consent: true,
    visitorId: visitor(),
    sessionId: (sessionId ??= crypto.randomUUID()),
    event,
    path: analyticsPath(window.location.pathname),
    occurredAt: new Date().toISOString(),
    properties: safeProperties(props),
  });
  const endpoint = `${runtimeConfig.apiBaseUrl}/analytics/events`;
  if (
    navigator.sendBeacon &&
    navigator.sendBeacon(endpoint, new Blob([payload], { type: "application/json" }))
  )
    return;
  void fetch(endpoint, {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: payload,
  }).catch(() => undefined);
}
function visitor() {
  try {
    const current = window.localStorage.getItem(VISITOR_KEY);
    if (current && UUID_PATTERN.test(current)) return current;
    const id = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATIC_ANALYTICS_PATHS = new Set([
  "/",
  "/auth",
  "/dashboard",
  "/cookies",
  "/demo",
  "/onboarding",
  "/recompenses",
]);
export function analyticsPath(pathname: string) {
  if (STATIC_ANALYTICS_PATHS.has(pathname)) return pathname;
  if (pathname.startsWith("/dashboard/")) return "/dashboard/:listId";
  if (pathname.startsWith("/l/")) return "/l/:slug";
  if (pathname.startsWith("/premium/")) return "/premium/:listId";
  return "/other";
}
function safeProperties(props: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(props)
      .slice(0, 12)
      .filter(
        (entry): entry is [string, string | number | boolean] =>
          /^[a-zA-Z0-9_]{1,40}$/.test(entry[0]) &&
          (typeof entry[1] === "string" ||
            typeof entry[1] === "number" ||
            typeof entry[1] === "boolean"),
      )
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 120) : value]),
  );
}

export function startWebVitals() {
  if (typeof window === "undefined" || !("PerformanceObserver" in window)) return () => undefined;
  const observers: PerformanceObserver[] = [];
  const observe = (type: string, callback: (entry: PerformanceEntry) => void) => {
    try {
      const observer = new PerformanceObserver((list) => list.getEntries().forEach(callback));
      observer.observe({ type, buffered: true });
      observers.push(observer);
    } catch {
      /* unsupported */
    }
  };
  observe("largest-contentful-paint", (entry) =>
    track("web_vital", { name: "LCP", value: Math.round(entry.startTime) }),
  );
  let cls = 0;
  observe("layout-shift", (entry) => {
    const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
    if (!shift.hadRecentInput) cls += shift.value ?? 0;
  });
  const onHide = () => track("web_vital", { name: "CLS", value: Math.round(cls * 1000) / 1000 });
  document.addEventListener("visibilitychange", onHide);
  return () => {
    observers.forEach((observer) => observer.disconnect());
    document.removeEventListener("visibilitychange", onHide);
  };
}
