# Listing art

> **ATTRACT MODE.** The cover, stills and GIF that sell Fusegrid on itch.io,
> Newgrounds and Game Jolt, plus the recipe for zipping the playable game.

This page owns the listing art, the itch blurb and the upload zip. Everything
else about the game lives in the [docs map](../docs/README.md).

> **PIXEL has a still and a clip now, but no listing slot yet.**
> `still-pixel.png` and `clip-portrait-2x3.mp4` show the PIXEL look.
> `og.png` names all three looks since 2026-10-19 (owner pick C, below).
> Putting PIXEL on the cover, the blurb or the tags is a storefront change,
> so it waits for the owner.

Everything in this folder is a **real capture** from the live game, nothing
here is generated key art. Not part of the shipped app: `media/` is never
staged for GitHub Pages and never added to the PWA precache (`src/pwa/shell.js`
/ `sw.js`).

"Real capture" means every pixel is the shipped renderer drawing the shipped
meshes and sprites. It does not mean a human played: the game's own demobot
holds the keys, and the seed and room are chosen so a good moment is one script
away instead of minutes of luck.

**How this pass ran (2026-11-01, shell v192, checked on v193).** Every board shot shows what
players get today: the v185 board look on a gen-2 board with no floor tiles, at
CORE, checked in the page (`G.gen === 2`, no `G.feat`) before the take. Served
from a clean checkout of the deployed commit, not from unpushed work, with
`serve.js`, one fresh Playwright `chrome-headless-shell` per asset on ANGLE
Metal (real GPU), a fresh profile and the service worker bypassed. Both are
stopped by PID afterwards.

- **Seeded state.** `nb.coach.v1` and `nb.coach.v2` read as seen and
  `nb.analytics.v1` as `"0"`, like a returning player, so no tip or card covers
  the board. Every session logged 0 console errors and 0 exceptions.
- **The demobot plays.** `createDemobot` (`src/app/demobot.js`, seed 20261101)
  supplies the intent for each sim tick in place of `input.intent()`. Nothing
  is staged: no grid carved, no foe moved, no pickup placed, no fuse shortened.
- **Picking the moment.** The same sim and bot run in Node first over seeds
  1..400, and the page replays the chosen seed tick for tick (traced equal
  through tick 1400). Clips use the best 18 s with 3 hearts throughout and no
  life lost for 0.5 s after; stills use a blast at its peak.
- **A virtual clock.** `performance.now()` and rAF only move when the script
  says, in exact 1/60 s steps, so clips play at real speed with no dropped,
  doubled or synthesised frames. Clips are one frame per 2 ticks, JPEG q95,
  then libx264 `-preset slow -crf 20`, full range to TV-range BT.709 yuv420p,
  `+faststart`, no audio track.
- **Checked on v193.** v193 shipped during the pass, so the stills, cover and
  phone screenshot were re-shot on it from the same seeds. The sim landed on the
  same ticks and scores: JUNGLE, PIXEL, cover and phone are pixel-identical,
  ICE and CROWN differ by under 0.1% (66 dB PSNR or better). The clips and GIF
  were not re-shot. MENU was recaptured on v193 for its build tag.
- **Capture stylesheet.** The stage-clipped shots strip the canvas border,
  radius and drop shadow (page chrome, not game pixels). Whole-viewport clips
  and the install screenshots don't use it.

## 🖼️ Assets

| File | Use | Provenance |
|---|---|---|
| `cover-630x500.png` | itch.io game cover (630×500) | REAL 3D, JUNGLE room 1, seed 35, tick 1369: the same blast as `still-jungle.png`, with MAKO just clear of the cross. `#c` hidden, so no HUD and no text. Downscaled only, 1200×1040 → 630×546 (lanczos), then 23 px cropped off the top and bottom. |
| `still-jungle.png` | Screenshot, room 1 JUNGLE | REAL 3D with the HUD, 640×568 at DPR 2, stage clip 1200×1040, `#gl` backing 1200×1040, so nothing is upscaled. Seed 35, tick 1369: a full cross at its peak, score 380, 3 hearts. |
| `still-ice.png` | Screenshot, room 2 ICE | Same method, room 2 entered with `loadLevel(G,2,true)`. Seed 40, tick 830, four foes, score 150. |
| `still-crown.png` | Screenshot, room 8 CROWN | Same method, room 8 entered with `loadLevel(G,8,true)`, which jumps the first-CLEAR gate for the capture. Seed 244, tick 528, seven foes, score 600. |
| `still-menu.png` | Screenshot, MENU | CLASSIC 2D (fresh settings), keyboard layout, 640×568 at DPR 2. One Enter on the title, then the whole opening show ran until its bomb's boom landed MENU, shot 1.2 s later as `#c.toDataURL()` at the native 600×520 backing. The foot reads `v193`, DAILY reads NEW because the profile is fresh, and the backdrop is the kept show world. |
| `play.gif` | Animated preview, a JUNGLE run | REAL 3D, stage clip. Seed 35, ticks 1224–1584, one frame per 5 ticks: 72 frames, 12 fps, 6.0 s, scaled to 630×546 (lanczos), `palettegen=stats_mode=diff` / `paletteuse=dither=bayer:bayer_scale=4`. A cross breaks bricks, foes 3 → 1, then the `BOMB 2` label and chip pulse. 1.8 MB, under the 3 MB gate. |
| `still-pixel.png` | Screenshot, room 3 FACTORY in PIXEL | PIXEL, same frame as the other stills, `#px` backing 1200×1040 (`dprPx` 2), so nothing is upscaled. Room 3 entered with `loadLevel(G,3,true)`. Seed 124, tick 1340: a long blast, four foes, floor pickups, 3 hearts. |
| `clip-landscape.mp4` | Silent clip, 16:9 (CrazyGames landscape) | REAL 3D, 960×540 at DPR 2: the desktop layout at 1920×1080, the stage on the page backdrop. `#gl` backing 1200×1040. JUNGLE, seed 183, ticks 960–2040: 18.0 s, score 100 → 720, foes 3 → 0, 3 hearts throughout. 540 frames, 30 fps, 4.5 MB. |
| `clip-portrait-2x3.mp4` | Silent clip, 2:3 (CrazyGames portrait) | PIXEL, 480×720 at DPR 2.25 with touch emulation: the phone portrait layout at 1080×1620. `#px` backing 696×600, which is what RESOLUTION AUTO gives PIXEL on a phone. JUNGLE, seed 101, ticks 1755–2835: 18.0 s, score 140 → 690, 3 hearts throughout. 3.3 MB. |
| `clip-portrait-9x16.mp4` | Silent clip, 9:16 (Shorts / TikTok / Reels) | REAL 3D, 405×720 at DPR 2.667 with touch emulation: the phone portrait layout at 1080×1920, pause pill, pad and bomb button included. `#gl` backing 900×780 (`dpr3d` 1.5). JUNGLE, seed 35, ticks 510–1590: 18.0 s, score 20 → 670, foes 3 → 0, 3 hearts throughout. 3.0 MB. |

These all go stale again when the floor tiles ship, because tiles change how a
room looks. Recapture before the big listings.

`og.png` (project root, 1200×630) was rebuilt on **2026-10-19** for shell
v180 (owner pick C of three candidates; sources, composer and the rejected
A/B live in the git-ignored `.superpowers/sdd/2026-10-19-storefront/`). The
right half is a real capture of the ATLAS LEVEL SELECT page in CLASSIC 2D:
loopback `PORT=0 node serve.js`, chrome-headless-shell with a fresh profile
(no service worker, no stores), 1366×768 at dpr 2, opened with the debug
hook's `app._push` after the INTRO show. Nothing seeded, so it shows the
honest first-visit state: rooms 6–8 locked, NO TIME YET, CORE · NORM. It is
cropped to the plate and downscaled only. The left column (FUSE/GRID
wordmark, the CLASSIC 2D · PIXEL · REAL 3D row, CORE/PLUS/MAX chips and the
PLAY IN THE BROWSER pill spanning them) is card chrome set in SF Mono over
the card's radial background, not game pixels. Card is fully opaque. After
every card change the owner re-uploads it under repo Settings → Social
preview (no API).

Checked 2026-11-01 against v192 and kept: the page on the card still matches the
game, bar one line. The card shows `NO TIME YET`, which a fresh profile no longer
shows, since it now waits for TIME to open. Its composer is gone, so a rebuild
starts from the storefront notes above. Do that when the tiles ship.

## 📲 Install-dialog screenshots

`screenshots/wide.png` and `screenshots/narrow.png` (repo root) are the
`screenshots` in `manifest.webmanifest`, which give Chrome its richer
install dialog. Unlike `media/`, they **are** staged for GitHub Pages (the
manifest points at them), but they are never precached: the dialog fetches
them online, and the service worker never stores a file it didn't
precache. `tests/pwa.test.mjs` pins their sizes, the 2.3:1 limit, one ratio
per form factor, the staging and the precache exclusion. Both come from the
2026-11-01 pass above and show the whole viewport with no capture stylesheet,
so they look exactly like the page:

| File | Provenance |
|---|---|
| `screenshots/wide.png` | REAL 3D, desktop layout, 960×540 at DPR 2 = 1920×1080. JUNGLE, seed 183, tick 1387, the first live blast after tick 960: FLAME 2, one foe left, score 440, 3 hearts. `#gl` backing 1200×1040. |
| `screenshots/narrow.png` | CLASSIC 2D (the default look), phone portrait layout with touch emulation, the stage under the pause pill above the pad and bomb button, 405×720 at DPR 2.667 = 1080×1920. JUNGLE, seed 35, tick 1365: the blast's brightest frame, score 380, 3 hearts. CLASSIC's canvas is a fixed 600×520 at any size, so on a phone it is shown 1.73× larger, as it always is. |

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

To build it from a commit instead of the working tree, run `git archive
--format=zip` with the same file list. Tested 2026-11-01 on v193 (164 entries,
1.5 MB): unzipped under a sub-path and embedded from another origin in a 960×700
iframe, it reached MENU from a click and Enter and started a run, all three looks
loaded (no URL debug flag), with no service worker, no consent card, no request to Google, no 404 and no console
error. The one leftover: OPTIONS still lists ANALYTICS there, where it does
nothing because analytics only runs on the Pages host.

Tags: `arcade`, `singleplayer`, `webgl`, `chiptune` (the core four every
listing carries). The full set for each platform lives in the
[promotion kit](../docs/marketing/README.md#tags-per-platform).

## 📣 itch blurb

```
Play Fusegrid in the browser — a single-player bomb-grid arcade.
Flip REAL 3D ⇄ CLASSIC 2D. Heat CORE / PLUS / MAX.

WASD / arrows move · Space bomb · P pause
Shift+Space throw · Q remote · walk into a bomb to kick (need pickups)

https://hmarzban.github.io/fusegrid/
```
