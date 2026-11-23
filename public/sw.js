/*
 * The service worker does one thing: when a page is opened or reloaded with no
 * connection, show "No connection" instead of the browser's error page.
 *
 * It caches nothing else on purpose. The app's data is live — stock, prices,
 * what a customer owes — and a stale copy served from a cache would be worse
 * than an honest "you are offline".
 */
const OFFLINE = "/offline.html";
const CACHE = "mrms-offline-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(new Request(OFFLINE, { cache: "reload" }))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE).then((page) => page || Response.error())));
});
