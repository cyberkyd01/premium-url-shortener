/* Service worker: cache-first for static assets, network-first for pages with an offline fallback.
   API calls and short links (any non-dashboard/non-asset path) are never cached. */
const VERSION = "v1";
const STATIC_CACHE = `static-${VERSION}`;
const PAGE_CACHE = `pages-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE).catch(() => undefined)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![STATIC_CACHE, PAGE_CACHE].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/uploads/") || /\.(css|js|woff2?|ttf|png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url.pathname);
}

function isCacheablePage(url) {
  // Only app pages are cached; short links live at the root and must always hit the network.
  return url.pathname === "/" || url.pathname.startsWith("/dashboard") || url.pathname.startsWith("/admin") || url.pathname === OFFLINE_URL || ["/login", "/register", "/features", "/pricing"].includes(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/data/") || url.pathname.startsWith("/_next/image")) return;

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(STATIC_CACHE).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
    return;
  }

  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    if (!isCacheablePage(url)) return; // short links and other public routes: network only
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok && res.type === "basic") { const copy = res.clone(); caches.open(PAGE_CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(async () => (await caches.match(req)) || (await caches.match(OFFLINE_URL)) || Response.error()),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
