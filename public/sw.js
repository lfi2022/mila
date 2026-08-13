const CACHE = "mila-public-v3";
const SAFE_SHELL = [
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.png",
  "/icon-192.png",
  "/mila-logo.png",
];
const PUBLIC_PAGES = new Set([
  "/",
  "/a-propos",
  "/faq",
  "/guides/liste-naissance",
  "/guides/budget-cadeaux",
  "/recompenses",
]);
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SAFE_SHELL))),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      ),
  ),
);
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_app/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok)
              void caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
            return response;
          }),
      ),
    );
    return;
  }
  if (!PUBLIC_PAGES.has(url.pathname)) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === "basic")
          void caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/offline.html"))),
  );
});
