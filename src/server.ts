import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

const SITEMAP_PATHS = [
  "/",
  "/a-propos",
  "/faq",
  "/guides/liste-naissance",
  "/guides/budget-cadeaux",
  "/recompenses",
  "/contact",
  "/conditions",
  "/confidentialite",
  "/cookies",
  "/mentions-legales",
] as const;

function seoConfig() {
  const enabled = process.env["SEO_INDEXING_ENABLED"] === "true";
  try {
    const origin = new URL(process.env["PUBLIC_APP_URL"] || process.env["APP_URL"] || "").origin;
    return { enabled, origin };
  } catch {
    return { enabled: false, origin: "" };
  }
}

export function seoResponse(request: Request): Response | undefined {
  const { pathname } = new URL(request.url);
  if (pathname !== "/robots.txt" && pathname !== "/sitemap.xml") return undefined;

  const { enabled, origin } = seoConfig();
  if (pathname === "/robots.txt") {
    const body = enabled
      ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
      : "User-agent: *\nDisallow: /\n";
    return new Response(body, {
      headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (!enabled)
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  const urls = SITEMAP_PATHS.map((path) => `  <url><loc>${origin}${path}</loc></url>`).join("\n");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    {
      headers: {
        "cache-control": "public, max-age=3600",
        "content-type": "application/xml; charset=utf-8",
      },
    },
  );
}

function withDeliveryHeaders(request: Request, response: Response): Response {
  const pathname = new URL(request.url).pathname;
  const headers = new Headers(response.headers);
  if (pathname.startsWith("/_app/")) {
    headers.set("cache-control", "public, max-age=31536000, immutable");
  } else if (pathname === "/sw.js" || pathname === "/manifest.webmanifest") {
    headers.set("cache-control", "no-cache");
  }
  headers.set("x-content-type-options", "nosniff");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const directResponse = seoResponse(request);
      if (directResponse) return directResponse;
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withDeliveryHeaders(request, await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
