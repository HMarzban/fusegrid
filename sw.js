import { CACHE_NAME, PRECACHE, fetchPolicy } from "./src/pwa/shell.js";

const REV = "fusegrid-shell-v185";
if (REV !== CACHE_NAME) throw new Error("PWA REV drift");
const PREFIX = "fusegrid-shell-v";
/* Shells before v179 have no NEW VERSION READY card, so a page they run can
   never prompt: replacing one of those still skips waiting (its page reloads
   once on controllerchange, as it always did). From v179 on, a new worker
   WAITS until the player presses RELOAD (SKIP_WAITING). */
const PROMPT_FROM = 179;
const legacyShell = (keys) =>
  keys.some((k) => k.startsWith(PREFIX) && k !== CACHE_NAME && +k.slice(PREFIX.length) < PROMPT_FROM);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // cache: "reload" — precache the server's bytes, never a stale HTTP-cache copy
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => caches.keys())
      .then((keys) => (legacyShell(keys) ? self.skipWaiting() : undefined)),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          // only this game's old shells: on Pages the origin is shared
          keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k)),
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
