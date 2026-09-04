import { CACHE_NAME, PRECACHE, fetchPolicy } from "./src/pwa/shell.js";

const REV = "fusegrid-shell-v14";
if (REV !== CACHE_NAME) throw new Error("PWA REV drift");

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const policy = fetchPolicy(event.request.url, {
    swOrigin: self.location.origin,
    mode: event.request.mode,
  });
  if (policy === "bypass") return;
  event.respondWith(cacheFirst(event.request, policy));
});

async function cacheFirst(req, policy) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    return await fetch(req);
  } catch (err) {
    if (policy === "cache-first-navigate") {
      const page =
        (await caches.match("./index.html")) || (await caches.match("./"));
      if (page) return page;
    }
    throw err;
  }
}
