/*
 * EyeSearch service worker — cache-first for the app shell and static modules,
 * network-first for navigations with an offline fallback.
 *
 * Deliberate boundaries:
 *   - Only same-origin GET requests are handled.
 *   - /v1/* is never touched: search results must always be live.
 *   - Cache-first is safe here because every asset is versioned by CACHE_NAME;
 *     bump it and the old cache is dropped on activate.
 */
const CACHE_NAME = "eyesearch-v2";
const OFFLINE_URL = "./index.html";

const PRECACHE = [
  "./",
  "./index.html",
  "./base.css",
  "./app.js",
  "./manifest.json",
  "./assets/icons/favicon.svg",
  "./config/api-config.js",
  "./home/search-input/search-input.js",
  "./home/search-input/search-input.css",
  "./home/media-tools/mic-handler.js",
  "./home/media-tools/lens-handler.js",
  "./home/quick-links/quick-links.js",
  "./home/feed-cards/weather-card.js",
  "./home/feed-cards/news-card.js",
  "./menu/theme-selector/theme-toggle.js",
  "./menu/language-selector/lang-switcher.js",
  "./profile/account/auth-placeholder.js",
  "./profile/local-history/history-manager.js",
  "./profile/local-history/clear-history.js",
  "./results/nav-tabs/tab-switcher.js",
  "./results/result-cards/web-card.js",
  "./results/result-cards/card-renderer.css",
  "./results/meta-info/latency-badge.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Cache entries individually: one 404 must not fail the whole install.
      await Promise.allSettled(
        PRECACHE.map(async (path) => {
          try {
            const response = await fetch(new Request(path, { cache: "reload" }));
            if (response.ok) await cache.put(path, response);
          } catch (error) {
            /* offline or missing asset: the runtime fetch will retry it */
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Live search must never be answered from cache.
  if (url.pathname.includes("/v1/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put(OFFLINE_URL, fresh.clone()).catch(() => {});
          return fresh;
        } catch (error) {
          const cached = await caches.match(OFFLINE_URL);
          if (cached) return cached;
          return new Response(
            "<!doctype html><meta charset=utf-8><title>Offline</title>" +
              "<body style=\"font:16px system-ui;padding:2rem\">" +
              "<h1>eyesearch is offline</h1><p>Reconnect and reload to search.</p>",
            { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 }
          );
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok && response.type === "basic") {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      } catch (error) {
        const fallback = await caches.match(request, { ignoreSearch: true });
        if (fallback) return fallback;
        return new Response("", { status: 504, statusText: "Gateway offline" });
      }
    })()
  );
});
