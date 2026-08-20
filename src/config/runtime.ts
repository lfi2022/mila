const viteEnv = import.meta.env as Record<string, string | boolean | undefined>;

function serverEnv(name: string): string | undefined {
  return typeof process !== "undefined" ? process.env?.[name] : undefined;
}

function cleanOrigin(value: string | undefined): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return "";
  }
}

const publicOrigin = cleanOrigin(
  String(
    viteEnv["VITE_PUBLIC_APP_URL"] || serverEnv("PUBLIC_APP_URL") || serverEnv("APP_URL") || "",
  ),
);
const apiBaseUrl = String(viteEnv["VITE_API_BASE_URL"] || "/api/v1").replace(/\/$/, "");

export const runtimeConfig = {
  publicOrigin,
  apiBaseUrl,
  apiServerBaseUrl: String(
    serverEnv("API_INTERNAL_URL") || (publicOrigin ? `${publicOrigin}${apiBaseUrl}` : apiBaseUrl),
  ).replace(/\/$/, ""),
  assetBaseUrl: String(viteEnv["VITE_ASSET_BASE_URL"] || "/assets").replace(/\/$/, ""),
  authCookieName: String(viteEnv["VITE_AUTH_COOKIE_NAME"] || "mila_session"),
  seoIndexingEnabled:
    String(viteEnv["VITE_SEO_INDEXING_ENABLED"] || serverEnv("SEO_INDEXING_ENABLED") || "false") ===
    "true",
  rewardsPremiumUiEnabled:
    String(
      viteEnv["VITE_FEATURE_REWARDS_PREMIUM"] ||
        serverEnv("VITE_FEATURE_REWARDS_PREMIUM") ||
        "false",
    ) === "true",
  orderFulfilmentEnabled: String(viteEnv["VITE_FEATURE_ORDER_FULFILMENT"] || "false") === "true",
  secondHandOffersEnabled: String(viteEnv["VITE_FEATURE_SECOND_HAND_OFFERS"] || "false") === "true",
  mediaMessagesEnabled: String(viteEnv["VITE_FEATURE_MEDIA_MESSAGES"] || "false") === "true",
  thankYousEnabled: String(viteEnv["VITE_FEATURE_THANK_YOUS"] || "false") === "true",
  memoryBookEnabled: String(viteEnv["VITE_FEATURE_MEMORY_BOOK"] || "false") === "true",
} as const;

export const memoriesUiEnabled =
  runtimeConfig.secondHandOffersEnabled ||
  runtimeConfig.mediaMessagesEnabled ||
  runtimeConfig.thankYousEnabled ||
  runtimeConfig.memoryBookEnabled;

export function buildPublicUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return runtimeConfig.publicOrigin
    ? new URL(normalizedPath, `${runtimeConfig.publicOrigin}/`).toString()
    : normalizedPath;
}

export function buildAssetUrl(purpose: "list-cover" | "product-image", key: string): string {
  const safeKey = key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${runtimeConfig.assetBaseUrl}/${purpose}/${safeKey}`;
}
