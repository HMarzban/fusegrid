# Listing art

Everything in this folder is a **real capture** from the live game (loopback
`node serve.js`, service worker unregistered and caches cleared first, then a
hard reload) — nothing here is generated key art. Not part of the shipped
app: `media/` is never staged for GitHub Pages and never added to the PWA
precache (`src/pwa/shell.js` / `sw.js`).

"Real capture" means every pixel is the shipped renderer drawing the shipped
meshes/sprites — it does not mean untouched natural play. RAF is paused while
the capture tab is backgrounded, so every shot here is driven by hand through
`window.__GAME__` (the `?debug=1` hook): forcing a render after `step(n)`,
and, where noted below, staging world state directly (moving the player,
planting a bomb with a shortened fuse, carving a brick corridor, relocating
enemies) so the moment on screen is reachable in one script instead of
minutes of RNG-dependent natural play. Each row below says which of those it
used.

Last recaptured **2026-09-05**, after the full items + player + menu program
landed: P1–P4 (rebuilt pickup glyphs/bodies and the player kite/crown/visor
stack), S1–S3 (OPTIONS screen, pause menu, chrome removal), R1 (player
redesigned mature/armoured — tapered gunmetal hull, mid-value `PLAYER_HULL`,
pointed crest), R2 (HOW TO PLAY / ITEMS / ENEMIES folded into one GUIDE page;
the `#hud` DOM strip deleted for good, replaced by the in-canvas HUD row) and
R3 (soundtrack rewrite — audio only, not pictured here). A prior recapture
attempt was interrupted before R1–R3 landed and is superseded; every still
below shows the current art, not the pre-pass shapes.

## Assets

| File | Use | Provenance |
|---|---|---|
| `cover-630x500.png` | itch.io game cover (630×500) | Dedicated live capture (not a crop of `og.png`, whose 1200-wide hero has no 630×500 crop that clears its own text without cutting it): real 3D (`?render=3d&debug=1`), JUNGLE room 1. Staged, not natural play: player and a bomb object were placed directly via `w.players[0]`/`w.bombs.push(...)` with a shortened timer so the detonation is reachable in a handful of `step()` calls instead of the real 2.5s fuse; `p.iFrames` forced to 0 each render so spawn/hit invulnerability never blinks the hero out. Caught ~50ms after the blast opens a BRICK. `#gl` + `#c` composited onto an offscreen canvas at native 2x-DPR resolution (1200×1040), then downscaled-only (0.525×, no upscale) to a 630×500 cover-fit crop (full width kept, 46px trimmed off top and bottom, split evenly). No HUD chips (the debug hook's render call omits `{hud:true}`), so there is no text at all — nothing to cut off. Shows the R1 hero (armoured kite hull, teal crest) mid-blast. |
| `still-jungle.png` | Screenshot — room 1 JUNGLE | Live 3D capture, natural `loadLevel` roster (enemies/items untouched): `#gl` (WebGL board) composited with `#c` (HUD overlay, the in-canvas chip row) onto an offscreen canvas, read synchronously right after a forced render. Shows the R1 hero next to a WALKER and a revealed pickup. |
| `still-ice.png` | Screenshot — room 2 ICE | Same technique, room 2, natural roster. |
| `still-crown.png` | Screenshot — room 8 CROWN | Same technique, room 8 (the finale look, normally gated behind the first FUSE/GRID CLEAR; `loadLevel(w,8,true)` reaches it directly for capture, not through a save-scummed unlock). Natural roster — nine enemies is what that room actually spawns. |
| `still-menu.png` | Screenshot — MENU screen | Classic 2D canvas (`#c`) on the MENU screen, captured directly (no WebGL layer active in 2D kind). Shows the post-R2 six-row MENU (PLAY / LEVEL SELECT / OPTIONS / GUIDE / HIGH SCORES / SOURCE) — HOW TO PLAY / ITEMS / ENEMIES now live one hop deeper, under GUIDE. |
| `play.gif` | Animated preview — a JUNGLE run | Live 3D run driven by the debug hook's `step(n)`. Staged for reliability: a 9-tile brick corridor was carved directly in `w.grid` so the walk/plant/retreat/blast/advance beat fits in ~3.6s instead of hunting a real corridor; the level's enemies were relocated (not deleted — emptying `w.enemies` trips the sim's instant-WIN branch) off to one side so none wander into the shot; the bomb's fuse was shortened the same way as the cover; `p.iFrames` forced to 0 every frame for the same reason. The blast, the brick breaking and the hero's walk cycle are all the real sim/renderer, just cued instead of waited for. 43 frames, 12 fps (~3.6s), 630px wide (ffmpeg `palettegen`/`paletteuse`, scaled down from the native 1200×1040 capture, never upscaled). |

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
