# Listing art

Everything in this folder is a **real capture** from the live game (loopback
`node serve.js`, service worker unregistered and caches cleared first, then a
hard reload) — nothing here is generated key art. Not part of the shipped
app: `media/` is never staged for GitHub Pages and never added to the PWA
precache (`src/pwa/shell.js` / `sw.js`).

## Assets

| File | Use | Provenance |
|---|---|---|
| `cover-630x500.png` | itch.io game cover (630×500) | Center-crop of the root `og.png` hero (1200×630, itself a real capture of the live 3D board mid-blast) — cropped only, never upscaled. |
| `still-jungle.png` | Screenshot — room 1 JUNGLE | Live 3D capture: `#gl` (WebGL board) composited with `#c` (HUD overlay) onto an offscreen canvas, read synchronously right after a forced render. |
| `still-ice.png` | Screenshot — room 2 ICE | Same technique, room 2. |
| `still-crown.png` | Screenshot — room 8 CROWN | Same technique, room 8 (the finale look, normally gated behind the first FUSE/GRID CLEAR; reached directly via the sim for capture, not through a save-scummed unlock). |
| `still-menu.png` | Screenshot — MENU screen | Classic 2D canvas (`#c`) on the MENU screen, captured directly (no WebGL layer active in 2D kind). |
| `play.gif` | Animated preview — a JUNGLE run | Live 3D run: move, plant a bomb, the fuse ticks down, it detonates and clears a brick, then movement resumes through the new opening. ~4.2s, 12 fps, 630px wide. |

## Rebuilding the zip for itch / Newgrounds / Game Jolt

The shipped game is static files only — no build step. To package a zip for
an itch/NG/GJ HTML5 upload, include exactly the files GitHub Pages serves and
nothing else:

```
zip -r fusegrid.zip \
  index.html \
  src/ \
  vendor/ \
  favicon.svg apple-touch-icon.png icon-192.png icon-512.png \
  sw.js manifest.webmanifest \
  robots.txt sitemap.xml .nojekyll
```

Omit `tests/`, `docs/`, `.git`, `media/`, and `og.png` — none of them are
needed to run the game, and `og.png`/`media/` are listing art, not app
bytes. Set the zip's **index file** to `index.html` and the play URL (when
linking out instead of embedding) to
**`https://hmarzban.github.io/fusegrid/`** — always with the trailing slash,
since the no-slash redirect drops Open Graph tags.

If the host embeds the zip in an iframe, that's fine as shipped:
`registerSW` no-ops inside an iframe (`top !== self`) or behind `?embed=1`,
so an embedded copy never registers a service worker or claims a cache out
from under the canonical Pages origin.

Tags: `arcade`, `singleplayer`, `webgl`, `chiptune`.

## itch blurb

```
Play Fusegrid in the browser — a single-player bomb-grid arcade.
Flip REAL 3D ⇄ CLASSIC 2D. Heat CORE / PLUS / MAX.

WASD / arrows move · Space bomb · P pause
Shift+Space throw · Q remote · K+move kick (need pickups)

https://hmarzban.github.io/fusegrid/
```
