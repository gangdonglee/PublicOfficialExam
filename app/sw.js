/* service worker — offline cache for 9급 기출 마스터 */
const CACHE = "gp9-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/store.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./data/index.json",
  "./icons/icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  // network-first for data (fresh content), cache-first for assets
  if (req.url.includes("/data/")) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
  } else {
    e.respondWith(
      caches.match(req).then(c => c || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(cc => cc.put(req, copy));
        return res;
      }))
    );
  }
});
