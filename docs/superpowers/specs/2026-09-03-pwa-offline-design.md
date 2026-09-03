# PWA offline cabinet (2026-09-03)

Installable Fusegrid that plays offline after the first visit. Public name
Fusegrid / FUSE/GRID. No Bomberman on any surface.

## Strategies

| | Approach | Offline after 1 visit | Updates | Fit |
|---|---|---|---|---|
| **A (pick)** | Precache app-shell, cache-first, versioned cache, update-on-activate | Yes | Bump `CACHE_NAME` + `sw.js` REV together | Known static ES graph, no bundler |
| B | Network-first, cache fallback | Only if previously fetched | Always fresh when online | Flaky nets fail first paint; weaker "install and fly" |
| C | Stale-while-revalidate | Yes if precached | Background refresh | Extra moving parts; canvas game does not need a HTML flash |

**Chosen: A.** The playable set is a frozen relative list. First visit fills
the cache; later visits (and installed standalone) load from it. `og.png` is
network-only so share crawlers never stale-lock the card.

## Shape

- `manifest.webmanifest` — `name` Fusegrid, `short_name` FUSE/GRID,
  `display` standalone, `start_url` / `scope` / `id` all `./`,
  `theme_color` + `background_color` `#070a12`, icons 192 + 512 PNG.
- `src/pwa/shell.js` — Node-testable `CACHE_NAME`, `PRECACHE`, `fetchPolicy`.
  List = `index.html`, `./`, manifest, icons, favicon, apple-touch,
  `vendor/three.module.js`, every `src/**/*.js`. No `og.png`, no tests/docs.
- `sw.js` (module, site root) — `addAll(PRECACHE)` on install, `skipWaiting`;
  activate deletes other caches + `clients.claim`. Fetch: GET + same-origin
  only; `og.png` bypass; cache-first; navigations fall back to `index.html`.
  A REV string in `sw.js` must equal `CACHE_NAME` so a version bump changes
  SW bytes (import-only edits do not wake Chromium).
- `src/pwa/register.js` — `navigator.serviceWorker.register("./sw.js",
  {type:"module", scope:"./"} )`. No-op without `navigator`. Called from
  `src/main.js` only. Never imported by `src/core`.
- `index.html` — relative manifest link + iOS web-app metas. Keep existing
  OG/Twitter/canonical/theme-color. No root-absolute hrefs.

## Pages `/fusegrid/`

SW file lives at the site root, so max scope is `/fusegrid/` on the project
site and `/` on loopback. Relative `./` URLs resolve against that. GitHub
Pages workflow must copy `manifest.webmanifest`, `sw.js`, `icon-192.png`,
and `icon-512.png` into `_site` (today it only stages html/icons/og/src/vendor).
`serve.js` stays 127.0.0.1; add `.webmanifest` MIME.

## Leftover

- First visit still needs network.
- iOS: Add to Home Screen; standalone chrome differs; audio still needs a
  gesture. Module SW wants iOS 16.4+.
- Content edits need a `CACHE_NAME` / REV bump or installed clients keep the
  old shell until `sw.js` bytes change.
