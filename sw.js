import { CACHE_NAME, BOOT, LOOKS, fetchPolicy } from "./src/pwa/shell.js";

const REV = "fusegrid-shell-v205";
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
      // cache: "no-cache" — a conditional request: an unchanged file is a 304 from the HTTP cache, never stale; addAll rejects on a non-OK response
      .then((cache) => cache.addAll(BOOT.map((u) => new Request(u, { cache: "no-cache" }))))
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
  // idle stage: not awaited, so it never holds activation; resumed from what is missing
  setTimeout(() => fillLooks().catch(() => {}), 1500);
});

/* The looks (PIXEL tree, then REAL 3D tree) are cached by the worker itself,
   one look at a time, in this CACHE_NAME. A fetch for a look file is the same
   request as the fill (inflight), so nothing is downloaded twice. */
const abs = (u) => new URL(u, self.location.href).href;
const LOOK_URLS = new Set(LOOKS.flat().map(abs));
const inflight = new Map();
let filling = null;
function getLook(url) {
  let p = inflight.get(url);
  if (!p) {
    p = caches
      .open(CACHE_NAME)
      .then((cache) =>
        fetch(new Request(url, { cache: "no-cache" })).then(async (r) => {
          if (r.ok) await cache.put(url, r.clone());
          return r;
        }),
      )
      .finally(() => inflight.delete(url));
    inflight.set(url, p);
  }
  return p;
}
function fillLooks() {
  if (filling) return filling;
  filling = (async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const look of LOOKS)
      for (const u of look) {
        const url = abs(u);
        if (await cache.match(url)) continue;
        try { await getLook(url); } catch { return; } // offline or failed: resume on the next activate or fetch
        await new Promise((r) => setTimeout(r, 20));
      }
  })().finally(() => { filling = null; });
  return filling;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const policy = fetchPolicy(event.request.url, {
    swOrigin: self.location.origin,
    mode: event.request.mode,
  });
  if (policy === "bypass") return;
  event.respondWith(cacheFirst(event.request, policy));
  if (!filling && policy === "cache-first-navigate") event.waitUntil(new Promise((r) => setTimeout(r, 3000)).then(() => fillLooks()).catch(() => {}));
});

async function cacheFirst(req, policy) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    if (LOOK_URLS.has(req.url.split("?")[0])) return (await getLook(req.url.split("?")[0])).clone();
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
