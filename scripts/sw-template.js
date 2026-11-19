/* ICU 360 service worker. Generated from scripts/sw-template.js by scripts/prebuild.mjs — do not edit public/sw.js. */
const VERSION = "__SW_VERSION__";
const PAGES = `icu360-pages-${VERSION}`;
const STATIC = "icu360-static-v1"; // hashed /_next/static files never change, so this cache survives updates
const ASSETS = `icu360-assets-${VERSION}`;
const CORE = ["/", "/offline", "/manifest.webmanifest", "/search-index.json", "/precache.json", "/brand/logo-dark-256.png", "/brand/logo-light-256.png", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PAGES).then((c) => Promise.allSettled(CORE.map((u) => c.add(new Request(u, { cache: "reload" }))))).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== PAGES && k !== STATIC && k !== ASSETS).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

function isRsc(req, url) {
  return req.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
}

async function networkFirst(req, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = (await cache.match(req, { ignoreSearch: true })) || (await caches.match(req, { ignoreSearch: true }));
    if (hit) return hit;
    if (fallbackUrl) {
      const fb = await caches.match(fallbackUrl);
      if (fb) return fb;
    }
    throw e;
  }
}

async function cacheFirst(req, cacheName) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) (await caches.open(cacheName)).put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req)
    .then((res) => {
      if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit || caches.match(req, { ignoreSearch: true }));
  return hit || (await caches.match(req, { ignoreSearch: true })) || net;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/stats") return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req, PAGES, "/offline"));
    return;
  }
  if (isRsc(req, url)) {
    // Let the router fall back to a full navigation (served from the page cache) when offline.
    event.respondWith(fetch(req).catch(() => Response.error()));
    return;
  }
  event.respondWith(staleWhileRevalidate(req, ASSETS));
});

/* "Download everything for offline": cache every page plus the JS/CSS it needs. */
async function precacheAll(port) {
  const manifest = await (await fetch("/precache.json", { cache: "no-store" })).json();
  const pages = await caches.open(PAGES);
  const statics = await caches.open(STATIC);
  const seen = new Set();
  let done = 0;
  for (const route of manifest.routes) {
    try {
      const res = await fetch(route, { credentials: "same-origin" });
      if (res.ok) {
        const html = await res.clone().text();
        await pages.put(route, res);
        const assets = html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [];
        for (const a of assets) {
          if (seen.has(a)) continue;
          seen.add(a);
          if (!(await statics.match(a))) {
            try {
              const r = await fetch(a);
              if (r.ok) await statics.put(a, r);
            } catch {}
          }
        }
      }
    } catch {}
    done++;
    if (port && (done % 5 === 0 || done === manifest.routes.length)) port.postMessage({ type: "progress", done, total: manifest.routes.length });
  }
  if (port) port.postMessage({ type: "done", version: VERSION, total: manifest.routes.length });
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "precache-all") {
    const port = event.ports && event.ports[0];
    event.waitUntil(precacheAll(port).catch(() => port && port.postMessage({ type: "error" })));
  }
  if (event.data && event.data.type === "version" && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ version: VERSION });
  }
});
