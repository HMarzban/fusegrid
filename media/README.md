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

Last recaptured **2026-09-06**, after MAKO (the reef-critter mascot, spec
§2.7) replaced every prior humanoid hero — SIGNAL RUNNER and IONVEST are both
superseded, and 2D and 3D once again share one character (`PLAYER_HULL` ===
`PLAYER_SUIT` === `#c39cff`). The 2026-09-05 pass is still the last time
menu/GUIDE chrome changed (P1–P4 pickups, S1–S3 OPTIONS/pause/chrome-removal,
R2 folding HOW TO PLAY / ITEMS / ENEMIES under GUIDE); this pass only
recaptures pixels to swap the hero, and did not touch layout. Every still
below (plus root `og.png`) shows MAKO, not the earlier gunmetal-hulled hero.

## Assets

| File | Use | Provenance |
|---|---|---|
| `cover-630x500.png` | itch.io game cover (630×500) | Dedicated live capture (not a crop of `og.png`, whose 1200-wide hero has no 630×500 crop that clears its own text without cutting it): real 3D (`?render=3d&debug=1`), JUNGLE room 1. Staged, not natural play: the player was retreated to a diagonal tile clear of the blast arms and a bomb object pushed directly onto `w.bombs` with an already-expired timer so the detonation is reachable in a single `step()` call instead of the real 2.5s fuse; `p.iFrames` forced to 0 each render so spawn/hit invulnerability never blinks the hero out. Caught the instant the blast opens a BRICK. `#gl` + `#c` composited onto an offscreen canvas at native 2×-DPR resolution (1200×1040), then downscaled-only (0.525×, no upscale) to a 630×546 letterbox and cropped to 630×500 (23px trimmed off top and bottom evenly). No HUD chips (the debug hook's render call omits `{hud:true}`), so there is no text at all — nothing to cut off. Shows MAKO (violet body, teal ear-fins, cream eyes) mid-blast. |
| `still-jungle.png` | Screenshot — room 1 JUNGLE | Live 3D capture, natural `loadLevel` roster (enemies/items untouched, spawn position): `#gl` (WebGL board) composited with `#c` (HUD overlay, the in-canvas chip row) onto an offscreen canvas filled with the opaque JUNGLE `bg1` first, read synchronously right after a forced render (`p.iFrames` forced to 0). Full-image alpha scan: 0 pixels below alpha 250 (border opaque `rgb(6,36,22)`). Shows MAKO at spawn next to a WALKER and a revealed pickup. |
| `still-ice.png` | Screenshot — room 2 ICE | Same technique, room 2 (reached via the debug hook's `advance()`), natural roster. Border opaque `rgb(10,32,72)`, 0 pixels below alpha 250. |
| `still-crown.png` | Screenshot — room 8 CROWN | Same technique, room 8 (the finale look, normally gated behind the first FUSE/GRID CLEAR; the debug hook's `advance()` walked level 2→8 directly for capture, not through a save-scummed unlock). Natural roster — nine enemies is what that room actually spawns. Border opaque `rgb(20,8,8)`, 0 pixels below alpha 250. |
| `still-menu.png` | Screenshot — MENU screen | Classic 2D canvas (`#c`) on the MENU screen (page loaded without `?render=3d`, so `#gl` stays hidden), captured after two `requestAnimationFrame` waits so the menu's entrance animation settles onto the full six-row list before the shot (`app.toMenu()` resets `idleT`, but this session's RAF loop kept running in the background the whole time, so any longer real-time wait risks the 10s MENU→ATTRACT idle timeout firing mid-capture). Shows the post-R2 six-row MENU (PLAY / LEVEL SELECT / OPTIONS / GUIDE / HIGH SCORES / SOURCE) over the frozen board, with MAKO visible on it. |
| `play.gif` | Animated preview — a JUNGLE run | Live 3D run (`?render=3d&debug=1`) driven by real held-key intents (`window.__GAME__.setKeys`) through the normal RAF-driven sim loop — not manual `step(n)` teleporting, so the walk cycle is the real animation, not a cued pose. Staged for reliability: a short brick corridor was carved directly in `w.grid` (one BRICK left standing as the target), the level's enemies were relocated (not deleted — emptying `w.enemies` trips the sim's instant-WIN branch) off to one side, and the bomb's fuse was shortened (`w.fuse=0.6`) so the walk/plant/retreat/blast/advance beat fits in ~3.5s. The player retreated a full tile past the blast radius before the fuse ran out — confirmed 3 hearts intact end to end, not a staged near-miss. 42 frames, 12 fps (~3.5s), 630px wide (ffmpeg `palettegen`/`paletteuse` with `dither=bayer`, scaled down from the native 1200×1040 capture, never upscaled). 0.60 MB, under the 3 MB gate. |

`og.png` (project root, 1200×630) was recaptured the same session: a fresh
JUNGLE hero (MAKO, mid-blast, retreated off the blast tiles, `p.iFrames`
forced 0) was rendered with `scene.background=null` and alpha-scrubbed
(measured this session: a clean 0/255 bimodal split plus a thin AA fringe —
no uniform haze this time, unlike the 2026-09-05 P5 note, so the scrub
threshold was set from the actual histogram, not assumed). It replaces only
the board pixels of the locked card: the wordmark, the REAL 3D ⇄ CLASSIC 2D
row, the CORE/PLUS/MAX chips and the PLAY IN THE BROWSER pill are the
original, unmodified pixels (restored per-pixel from the previous `og.png`
inside their row bands after a full repaint, so no trace of the old
humanoid-era board bleeds through the gaps around the text). Card stays
fully opaque (0 pixels below alpha 255).

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
