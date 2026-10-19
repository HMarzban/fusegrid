# Listing art

> **ATTRACT MODE.** The cover, stills and GIF that sell Fusegrid on itch.io,
> Newgrounds and Game Jolt, plus the recipe for zipping the playable game.

This page owns the listing art, the itch blurb and the upload zip. Everything
else about the game lives in the [docs map](../docs/README.md).

> **PIXEL has a still and a clip now, but no listing slot yet.**
> `still-pixel.png` and `clip-portrait-2x3.mp4` show the PIXEL look.
> Putting PIXEL on the cover, `og.png`, the blurb or the tags is a storefront
> change, so it waits for the owner.

Everything in this folder is a **real capture** from the live game (loopback
`PORT=0 node serve.js`, service worker unregistered and caches cleared first,
then a hard reload) — nothing here is generated key art. Not part of the
shipped app: `media/` is never staged for GitHub Pages and never added to the
PWA precache (`src/pwa/shell.js` / `sw.js`).

"Real capture" means every pixel is the shipped renderer drawing the shipped
meshes/sprites — it does not mean untouched natural play. Each row below says
which moments were staged through `window.__GAME__` (the `?debug=1` hook) or
by writing world state directly, so a shot is reachable in one script instead
of minutes of RNG-dependent play.

Last recaptured **2026-10-19** on shell v178 (precache `fusegrid-shell-v178`),
so the set shows the eight-row MENU and the live REAL 3D rig: the STANDARD
preset (`dist` 1503) through the `CAM_FOV` 24 lens, both read from
`camrig.js` in the page at capture time, never orbited or dollied, with the
near-wall cutaway. MAKO is the hero in every shot.

**How every capture ran.** Each asset got its own session (the three 3D
stills share one): its own
`PORT=0 node serve.js` and its own Playwright `chrome-headless-shell` on
ANGLE Metal (real GPU, not SwiftShader) with a fresh `--user-data-dir`,
driven over CDP with the `tools/pixel/shot.mjs` helpers. Both were stopped
by PID afterwards. The page loaded once. Then every
service worker was unregistered (one was registered each time), every cache
deleted (`fusegrid-shell-v178`), localStorage cleared,
`Network.setBypassServiceWorker` turned on so the re-registered `sw.js`
served nothing, and the page hard-reloaded with `ignoreCache`. The viewport
is 640×568 at DPR 2, so the stage fits at scale 1: 600×520 CSS, `#gl`
backing 1200×1040 with `dpr3d` 2. The stills session read `dpr3d` 2 with
the governor at 2, and a verification run on the same harness (capture
stylesheet on, rooms 1 and 8) measured `#gl` at 1200×1040 behind a 600×520
stage, so no 3D shot is upscaled. A MessageChannel rAF shim keeps the
real game loop running in real time while headless. A capture-only
stylesheet strips the canvas border, radius and drop shadow (page chrome,
not game pixels) so shots run edge to edge. 3D shots come from
`Page.captureScreenshot` clipped to the stage, which composites `#gl` under
the `#c` HUD overlay exactly as the page shows them. (An in-page
`drawImage(#gl)` readback is unsafe since v178: render-on-change can skip
the raster on a still board.) For the 3D sessions `nb.coach.v1` was seeded
as seen, so the first-room ghost-coach panel doesn't cover the board. No
coach v2 tip fired in any shot. Every session logged 0 console errors and 0
exceptions.

## 🖼️ Assets

| File | Use | Provenance |
|---|---|---|
| `cover-630x500.png` | itch.io game cover (630×500) | Dedicated live capture (not a crop of `og.png`, whose 1200-wide hero has no 630×500 crop that clears its own text without cutting it): REAL 3D (`?render=3d&debug=1`), JUNGLE room 1 on that session's own board. Staged, not natural play: 1.6 s after the run started, MAKO was moved to an open tile three tiles west of the bomb spot, behind a BRICK the blast breaks, and a bomb object was pushed straight onto `w.bombs` with a 0.35 s timer and radius 2 (a FLAME 2 bomb; the player was still FLAME 1) on the open tile whose arms hit the most BRICKs (four). `p.iFrames` held at 0 throughout; `nb.coach.v1` seeded as seen. `#c` hidden (`visibility:hidden`), so there is no HUD and no text at all — nothing to cut off. A 26-shot burst caught the blast; frame 5 (0.4–0.47 s after the push: full cross, danger plates lit, fireballs at their peak, four BRICKs breaking) was picked. Downscaled only, 1200×1040 → 630×546 (lanczos, 0.525×), then 23 px cropped off the top and bottom. 0 pixels below alpha 250; border `rgb(6,36,22)`. Shows MAKO beside the blast. |
| `still-jungle.png` | Screenshot — room 1 JUNGLE | Live REAL 3D capture with the HUD chip row, room 1 straight from `__GAME__.begin()`, natural roster (two WALKERs and a STATIONARY, eight pickups placed by the room's own generator). Shot 1.6 s into real play, so foes have wandered naturally and MAKO is near spawn; `p.iFrames` set to 0 one frame before the shot so the spawn blink can't hide the hero; `nb.coach.v1` seeded as seen. 1200×1040, 0 pixels below alpha 250, border `rgb(6,36,22)`. |
| `still-ice.png` | Screenshot — room 2 ICE | Same session and technique, room 2 entered with `loadLevel(G,2,true)` (carry kept, state set to PLAY) and shot 1.6 s later, `p.iFrames` 0, `nb.coach.v1` seeded as seen. Natural roster (four foes). Shows the near-wall cutaway: ICE's tall border is cut down only on the row nearest the camera. 0 pixels below alpha 250, border `rgb(10,32,72)`. |
| `still-crown.png` | Screenshot — room 8 CROWN | Same session and technique, room 8 entered with `loadLevel(G,8,true)` straight from room 2 (the finale look is normally gated behind the first FUSE/GRID CLEAR; this jumps the gate for capture, not through a save-scummed unlock). Natural roster — nine foes is what that room spawns. `p.iFrames` 0, `nb.coach.v1` seeded as seen. 0 pixels below alpha 250, border `rgb(20,8,8)`. |
| `still-menu.png` | Screenshot — MENU screen | CLASSIC 2D (`?debug=1`, fresh settings, so CLASSIC is the look), reached the way a player does: one Enter on the title, then the whole opening show ran until its bomb's boom landed MENU at PLAY (4.5 s after the press). Shot 1.2 s later (`idleT` 1.3 s, far from the 10 s ATTRACT timeout) as `#c.toDataURL()` at the canvas's native 600×520 backing, so nothing is resampled. Shows all eight rows (PLAY / LEVEL SELECT / DAILY / OPTIONS / GUIDE / HIGH SCORES / STATS / SOURCE); DAILY reads NEW because the profile is fresh. The backdrop is the kept show world, not a room board, with MAKO at its top-left. |
| `play.gif` | Animated preview — a JUNGLE run | Live REAL 3D run (`?render=3d&debug=1`) driven by real held-key intents (`window.__GAME__.setKeys`) through the normal rAF-driven loop, so the walk is the real animation. The route was planned by a BFS over that session's live grid: walk from spawn to the open tile beside a BRICK, plant, retreat straight west along the same row to two tiles from the bomb (in line with the blast, one tile past the end of the FLAME 1 arm), let the blast open the BRICK, walk back and grab the FLAME the room's own generator had buried there. The pickup fires the floating `FLAME 2` label and the HUD FLAME chip pulse. The only world staging is the fuse (`w.fuse=1.2` instead of CORE's 2.5 s) so the beat fits in 6 s; `nb.coach.v1` was seeded as seen. Nothing else was touched: no grid carved, no foe moved (none came within four tiles of the route), no pickup placed. 3 hearts intact end to end. Recorded as a burst of 83 stage-clipped `Page.captureScreenshot` frames at 1200×1040 over 5.9 s with wall-clock timestamps, retimed through an ffmpeg concat list to 12 fps (72 frames, 6.0 s), scaled down to 630×546 (lanczos, never upscaled), `palettegen=stats_mode=diff` / `paletteuse=dither=bayer:bayer_scale=4`. 0.58 MB, under the 3 MB gate. |
| `still-pixel.png` | Screenshot — room 3 FACTORY in PIXEL | PIXEL (`?render=px&debug=1`), second-pass method, 640×568 at DPR 2 with the capture stylesheet, clipped to the stage at 1200×1040, the same frame as the other stills. `#px` backing is 1200×1040 (`dprPx` 2), so nothing is upscaled. Room 3 was entered with `loadLevel(G,3,true)` straight after `begin()`, which jumps the room order for the capture; its roster (four foes) and floor pickups are the room's own. Picked from 22 candidates taken every 0.5 s: 3.5 s into the room, the demobot's first bomb has just gone off (full cross on the open floor), MAKO stands beside its second bomb, and four foes and five floor pickups (a HEART among them) are on the board. 3 hearts. |
| `clip-landscape.mp4` | Silent clip, 16:9 (CrazyGames landscape) | REAL 3D, second-pass method, 960×540 at DPR 2: the desktop layout (`data-lay d`) at 1920×1080. The whole viewport, so the stage sits on the page backdrop the way it does in a 16:9 browser window. `#gl` backing 1200×1040 for a 1135-px stage (no upscale). JUNGLE room 1, 18.0 s cut from 3.9–21.9 s of a 50 s take: five blasts, bricks broken, a POWER BOMB uncovered and grabbed (floating label + ability chip), score 10 → 200, 3 hearts throughout. 540 frames, 30 fps. |
| `clip-portrait-2x3.mp4` | Silent clip, 2:3 (CrazyGames portrait) | PIXEL, second-pass method, 480×720 at DPR 2.25 with touch emulation: the phone portrait layout (`data-lay p`, `#touchpad` shown) at 1080×1620. The whole viewport. `#px` backing 696×600 for a 1048-px stage, which is what RESOLUTION AUTO gives PIXEL on a phone (`dprPx` 1.5). JUNGLE room 1, 18.0 s cut from 20.0–38.0 s of a 90 s take. The window was set by hand, 3 s later than the picker's, so the kill isn't on the last frame: five blasts, a foe caught in one (score 90 → 250, three foes → two), 3 hearts throughout. An earlier 50 s take never reached a foe and was dropped. |
| `clip-portrait-9x16.mp4` | Silent clip, 9:16 (Shorts / TikTok / Reels) | REAL 3D, second-pass method, 405×720 at DPR 2.667 with touch emulation: the phone portrait layout (`data-lay p`, `#touchpad` shown) at 1080×1920. The whole viewport, pause pill, pad and bomb button included. `#gl` backing 900×780 for a 1037-px stage, which is exactly what RESOLUTION AUTO gives a phone (`dpr3d` 1.5). JUNGLE room 1, 18.0 s cut from 1.6–19.6 s of a 50 s take: five blasts, a POWER BOMB grabbed, score 10 → 140, 3 hearts throughout. |

**How the second pass ran (2026-10-19, PIXEL still, clips, install
screenshots).** Same clean start as above: its own `PORT=0 node serve.js`
and Metal headless-shell per asset, fresh profile, page loaded once, every
service worker unregistered (one each time) and every cache deleted
(`fusegrid-shell-v180`), localStorage cleared, SW bypass on, hard reload
with `ignoreCache`, both processes stopped by PID. Every session logged 0
console errors and 0 exceptions. Two things differ from the first pass:

- **The game's own demobot holds the keys.** A normal GAME run starts with
  `__GAME__.begin()`. Then, on every sim tick, the attract demobot
  (`createDemobot` in `src/app/demobot.js`) reads the live world and sets
  its move and fire on the real `Input` object through `setIntent`, right
  before the game's loop builds that tick's intent. Nothing in the world is
  staged: no grid carved, no foe moved, no pickup placed, no fuse
  shortened. The bot plants, walks, breaks bricks and grabs whatever it
  uncovers, and it is not a great player, which is why each clip is a cut
  (below).
- **A virtual clock, not a wall clock.** A 1080p screenshot takes ~75 ms in
  headless, too slow for real-time video. So `performance.now()` (the one
  clock every game loop and renderer reads) is replaced by a clock that
  moves only when the capture script says so. Per video frame it moves
  2 × 1/60 s, running two ordinary rAF frames (the fixed-step sim at its
  normal 60 Hz, the frame gate reading 60 Hz, the RESOLUTION AUTO governor
  holding its top step), then takes one full-viewport `Page.captureScreenshot`
  at device pixels. Every frame is the shipped renderer drawing the live
  world at its true game time, so the clips play at real speed with no
  dropped, doubled or synthesised frames. The first 1.5 s of each run is
  skipped, while the GPU warms up.

Every clip was recorded as one take of 50–90 s of play, then cut to one
contiguous 18 s window. The window is the one with all three hearts intact
(and no life lost for 0.5 s after it) and the most blasts, kills and score.
Frames are JPEG q95 out of CDP, encoded at 30 fps with libx264 (`-preset
slow -crf 20`), full-range to TV-range BT.709 yuv420p, `+faststart`, no
audio track. Nothing is sped up or slowed down. `nb.coach.v1` and
`nb.coach.v2` are seeded as seen, as for a returning player, so no tip
panel covers the board.

`og.png` (project root, 1200×630) was **not** recaptured in this pass, which
was deliberate. It is still the 2026-09-06 card, so its board shows the REAL
3D camera from before shell v163. The share card is storefront art, and
re-cutting it (or putting PIXEL on it) is the owner's call. The card was
built like this: a JUNGLE hero (MAKO, mid-blast, retreated off the blast
tiles, `p.iFrames` forced 0) was rendered with `scene.background=null` and
alpha-scrubbed, with the threshold set from the measured histogram (a clean
0/255 split plus a thin AA fringe). It replaces only the board pixels of the
locked card: the wordmark, the REAL 3D ⇄ CLASSIC 2D row, the CORE/PLUS/MAX
chips and the PLAY IN THE BROWSER pill are the original, unmodified pixels,
restored per-pixel inside their row bands after a full repaint. The card is
fully opaque (0 pixels below alpha 255). Disclosed: the dark background
outside the text glyphs (card chrome, not game pixels) is a calibrated
radial-gradient approximation of the earlier card's background, measured
within ~9 RGB units of it at the corner.

## 📲 Install-dialog screenshots

`screenshots/wide.png` and `screenshots/narrow.png` (repo root) are the
`screenshots` in `manifest.webmanifest`, which give Chrome its richer
install dialog. Unlike `media/`, they **are** staged for GitHub Pages (the
manifest points at them), but they are never precached: the dialog fetches
them online, and the service worker never stores a file it didn't
precache. `tests/pwa.test.mjs` pins their sizes, the 2.3:1 limit, one ratio
per form factor, the staging and the precache exclusion. Both are
second-pass captures of the whole viewport, with no capture stylesheet, so
they look exactly like the page:

| File | Provenance |
|---|---|
| `screenshots/wide.png` | REAL 3D, desktop layout (`data-lay d`), 960×540 at DPR 2 = 1920×1080. JUNGLE room 1, the demobot playing. Picked from 25 candidates (4–16 s, every 0.5 s): 11.5 s in, a blast is live, MAKO stands clear of it, three foes are up, 3 hearts. `#gl` backing 1200×1040 for a 1135-px stage, governor at 2. |
| `screenshots/narrow.png` | CLASSIC 2D (the default look), phone portrait layout (`data-lay p`, touch emulation, `#touchpad` shown, so the stage sits under the pause pill above the pad and bomb button), 405×720 at DPR 2.667 = 1080×1920. JUNGLE room 1, the demobot playing. Picked from 25 candidates: 7.0 s in, one foe is just down (sparks), a bomb is ticking beside MAKO, and three uncovered pickups are on the floor. CLASSIC's canvas is a fixed 600×520 at any size, so on a phone it is shown 1.73× larger, as it always is. |

## 📦 Rebuilding the zip for itch / Newgrounds / Game Jolt

The shipped game is static files only — no build step. To package a zip for
an itch/NG/GJ HTML5 upload, include exactly the files GitHub Pages serves and
nothing else:

```
zip -r fusegrid.zip \
  index.html \
  src/ \
  vendor/ \
  favicon.svg apple-touch-icon.png icon-192.png icon-512.png \
  sw.js manifest.webmanifest screenshots/ \
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

Tags: `arcade`, `singleplayer`, `webgl`, `chiptune` (the core four every
listing carries). The full set for each platform lives in the
[promotion kit](../docs/marketing/README.md#tags-per-platform).

## 📣 itch blurb

```
Play Fusegrid in the browser — a single-player bomb-grid arcade.
Flip REAL 3D ⇄ CLASSIC 2D. Heat CORE / PLUS / MAX.

WASD / arrows move · Space bomb · P pause
Shift+Space throw · Q remote · K+move kick (need pickups)

https://hmarzban.github.io/fusegrid/
```
