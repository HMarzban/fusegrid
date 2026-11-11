# UI upgrade v202: menu performance baseline

Date: 2026-11-10 (runs on 2026-11-11). Task 0.3 of the UI upgrade plan. These numbers come from the
build that ships today, before any new menu lands, so later releases have a fixed baseline to
measure against.

## What was measured

- **Code:** commit `c4e7598` (the frozen delivery head, shell v201 code), with only
  `tools/perf/frames.mjs` extended for this task. The game files are the ones at `c4e7598`.
- **Machine, as the tool reports it:** Apple M5 Max (CPU model), GPU "ANGLE Metal Renderer: Apple
  M5 Max", Chrome for Testing 156.0.8078.4, headed, real GPU (2D canvas, WebGL and raster all
  `enabled`), page visible and focused in both runs, viewport 1450x757 at dpr 2.
- **Display:** the window sat on a **60 Hz** display (measured rAF period 16.7 ms, 59.88 Hz).
  Menus and PAUSE are idle screens, so the frame gate draws them at 30 fps (`fps` 29–31 in the
  JSON). GAME PLAY draws at 60. A later run on a 120 Hz display will not compare one to one.
  Use `--at X,Y` to put the window on the same display.
- **Settings:** each run uses one fresh Chrome profile, and every page in the run shares its
  storage. Each new page is seeded with GRAPHICS AUTO (FRAME RATE 60, RESOLUTION AUTO, SHADOWS
  SOFT, ANTI-ALIAS ON, EFFECTS HIGH, DEMO SHORT). It is also seeded with `nb.pact.v1` = `"1"`, the
  store the first CLEAR writes, so rooms 6–8 are open. Nothing else is seeded.
- **Record stores carry over within a run:** GAME OVER is a real run end, so main writes its high
  score, stats and bests. Only the first pages (CLASSIC 2D desk title, MENU and RECORDS) run on
  empty stores. Every later MENU and RECORDS window, in phone, in hitch and in the other looks,
  draws the runs that the earlier GAME OVER windows wrote. The order is fixed, so a later build run
  through the same tool sees the same history at the same points.

## Commands

```
node tools/perf/frames.mjs --only desk,phone,hitch --looks 2d,px,3d
node tools/perf/frames.mjs --only desk,phone,hitch --looks 2d,px,3d --throttle 4
```

Run 1 took 13 minutes and run 2 took 17, with the window in the foreground. Both runs reported no errors:
every screen check passed, and LEVEL SELECT cycling reached all eight levels in every window. Raw
JSON is in the git-ignored `.superpowers/sdd/perf/`:
`frames-desk-phone-hitch-2dpx3d-60hz-fps1.json` and `…-fps1-x4.json`.

## The menu windows (new in the tool for this task)

All four are reached the way a player reaches them. The tool picks the MENU row by its label (it
reads menuapp `ITEMS` in the page), presses Enter, and then checks `__GAME__.state()` before it
records anything. A wrong screen is an error, and no window is recorded for it.

- **title:** the settled title (INTRO stage 0, after the logo fade-in), before the press. At
  `c4e7598` the title has no spark, so this window is the title as it ships today.
- **LEVEL SELECT cycling:** arrow keys walk the levels 1 → 8 → 1, one press every 250 ms
  (`CYCLE_MS`), and never press past either end. The keys are window `KeyboardEvent`s fired from a
  timer inside the page, so no CDP traffic falls inside the window.
- **RECORDS:** the page the RECORDS row opens. At `c4e7598` that row is HIGH SCORES (SCREEN
  SCORES), the same screen v202's RECORDS opens first. The page sits idle.
- **GAME OVER:** a gen-3 room 1, lives set to 1, then the sim's own `hurtPlayer`. That gives the
  LOSE overlay at a run end, with main's real run-end write.

The desk and phone blocks now run: title, MENU, LEVEL SELECT cycling, RECORDS, then the existing
room windows and PAUSE, then GAME OVER. Each new page records how long its open took
(the "Open / load" column: the longest frame in the 0.8–1 s after the key). The hitch block now
starts on MENU and records these steps one by one: open LEVEL SELECT, each room change 2..8, back
to MENU, open RECORDS, back to MENU. Its existing room steps follow, and it ends with the GAME
OVER edge.

## How to read the tables

- **Work p50 / p90:** milliseconds of JS inside the game's own rAF callback, over the frames
  that drew (frames the gate skipped are left out). Canvas raster and GPU time are not included.
- **Dropped / frames:** missed vsyncs at the measured period, out of all rAF intervals in the
  window.
- **Long >= 50 ms:** rAF intervals of 50 ms or more. **LoAF** counts long-animation-frame entries
  (>= 50 ms of main-thread work in one frame), which can appear without a long interval.
- **CPU:** ms of CPU per wall second, per process type, from `SystemInfo.getProcessInfo`.
  "Other" is the network, storage and audio services together. All Chrome processes count, not
  only the game's renderer.
- **Hitch tables:** the longest rAF interval, in ms, in the 1.2 s after one step. LoAF entries, in
  ms, are in brackets. At 60 Hz, 16.7–19 ms means no frame was missed.
- Desk windows are 6 s, phone windows 5 s.

## Desk (1450x757, dpr 2, never throttled)

### Run 1 (`--only desk,phone,hitch`)

| Look | Window | Work p50 | Work p90 | Dropped / frames | Long >= 50 ms | LoAF | CPU browser | CPU renderer | CPU GPU | CPU other | Open / load, longest frame |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CLASSIC 2D | title | 1.1 | 1.7 | 0 / 360 | 0 | 0 | 35 | 104 | 115 | 17 | - |
| CLASSIC 2D | MENU | 0.7 | 1.3 | 0 / 360 | 0 | 0 | 16 | 102 | 90 | 7 | - |
| CLASSIC 2D | LEVEL SELECT cycling | 1.1 | 1.7 | 0 / 360 | 0 | 0 | 30 | 123 | 129 | 5 | 19 |
| CLASSIC 2D | RECORDS | 0.3 | 0.8 | 0 / 361 | 0 | 0 | 20 | 75 | 68 | 5 | 19 |
| CLASSIC 2D | busy gen-2 room 8 | 1 | 1.5 | 0 / 361 | 0 | 0 | 12 | 157 | 189 | 4 | 19 |
| CLASSIC 2D | tile gen-3 room 8 | 0.9 | 1.5 | 0 / 361 | 0 | 0 | 11 | 149 | 195 | 5 | 19 |
| CLASSIC 2D | fat world | 0.9 | 1.6 | 0 / 360 | 0 | 0 | 10 | 140 | 202 | 5 | 19 |
| CLASSIC 2D | PAUSE | 0.6 | 1 | 0 / 360 | 0 | 0 | 27 | 98 | 99 | 21 | - |
| CLASSIC 2D | GAME OVER | 1.2 | 1.7 | 0 / 361 | 0 | 0 | 17 | 111 | 142 | 6 | 19 |
| PIXEL | title | 1.4 | 1.7 | 0 / 360 | 0 | 0 | 16 | 109 | 121 | 2 | - |
| PIXEL | MENU | 0.6 | 0.9 | 0 / 360 | 0 | 0 | 11 | 99 | 70 | 6 | - |
| PIXEL | LEVEL SELECT cycling | 1 | 1.3 | 0 / 361 | 0 | 0 | 11 | 113 | 102 | 5 | 19 |
| PIXEL | RECORDS | 0.3 | 0.5 | 0 / 361 | 0 | 0 | 10 | 68 | 58 | 5 | 19 |
| PIXEL | busy gen-2 room 8 | 1.4 | 1.7 | 0 / 361 | 0 | 0 | 15 | 199 | 222 | 5 | 19 |
| PIXEL | tile gen-3 room 8 | 1.3 | 1.7 | 0 / 360 | 0 | 0 | 15 | 202 | 224 | 5 | 19 |
| PIXEL | fat world | 1.5 | 1.8 | 0 / 360 | 0 | 0 | 14 | 184 | 195 | 6 | 19 |
| PIXEL | PAUSE | 0.4 | 0.7 | 0 / 360 | 0 | 0 | 11 | 80 | 67 | 5 | - |
| PIXEL | GAME OVER | 1.6 | 2 | 0 / 360 | 0 | 0 | 11 | 130 | 130 | 5 | 19 |
| REAL 3D | title | 1.3 | 1.7 | 0 / 360 | 0 | 0 | 19 | 137 | 97 | 3 | - |
| REAL 3D | MENU | 0.7 | 1 | 0 / 360 | 0 | 0 | 13 | 116 | 79 | 6 | - |
| REAL 3D | LEVEL SELECT cycling | 1 | 1.5 | 0 / 360 | 0 | 0 | 14 | 157 | 115 | 5 | 19 |
| REAL 3D | RECORDS | 0.3 | 0.5 | 0 / 360 | 0 | 0 | 14 | 99 | 65 | 5 | 19 |
| REAL 3D | busy gen-2 room 8 | 1.8 | 2.3 | 0 / 360 | 0 | 0 | 17 | 266 | 202 | 5 | 50 |
| REAL 3D | tile gen-3 room 8 | 1.9 | 2.4 | 0 / 360 | 0 | 0 | 18 | 276 | 213 | 5 | 82 |
| REAL 3D | fat world | 1.7 | 2 | 0 / 361 | 0 | 0 | 14 | 221 | 188 | 6 | 18 |
| REAL 3D | PAUSE | 0.5 | 0.7 | 0 / 360 | 0 | 0 | 10 | 86 | 68 | 5 | - |
| REAL 3D | GAME OVER | 1.7 | 2.1 | 0 / 360 | 0 | 0 | 12 | 137 | 106 | 5 | 19 |

First room from MENU (`begin()`), longest frame: CLASSIC 2D 19 ms, PIXEL 18 ms, REAL 3D 117 ms.

### Run 2 (the `--throttle 4` command; desk is not throttled, so this is a second desk sample)

| Look | Window | Work p50 | Work p90 | Dropped / frames | Long >= 50 ms | LoAF | CPU browser | CPU renderer | CPU GPU | CPU other | Open / load, longest frame |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CLASSIC 2D | title | 1.1 | 1.5 | 0 / 361 | 0 | 0 | 32 | 92 | 107 | 17 | - |
| CLASSIC 2D | MENU | 0.7 | 0.9 | 0 / 360 | 0 | 0 | 13 | 78 | 83 | 7 | - |
| CLASSIC 2D | LEVEL SELECT cycling | 1.1 | 1.4 | 0 / 360 | 0 | 0 | 28 | 115 | 127 | 6 | 19 |
| CLASSIC 2D | RECORDS | 0.3 | 0.5 | 0 / 361 | 0 | 0 | 22 | 64 | 68 | 6 | 19 |
| CLASSIC 2D | busy gen-2 room 8 | 0.9 | 1.2 | 0 / 361 | 0 | 0 | 13 | 150 | 222 | 4 | 19 |
| CLASSIC 2D | tile gen-3 room 8 | 0.8 | 1.2 | 0 / 360 | 0 | 0 | 11 | 130 | 219 | 5 | 19 |
| CLASSIC 2D | fat world | 0.9 | 1.4 | 0 / 360 | 0 | 0 | 10 | 137 | 207 | 5 | 19 |
| CLASSIC 2D | PAUSE | 0.5 | 0.7 | 0 / 360 | 0 | 0 | 20 | 69 | 90 | 9 | - |
| CLASSIC 2D | GAME OVER | 1 | 1.4 | 0 / 360 | 0 | 0 | 25 | 87 | 130 | 10 | 19 |
| PIXEL | title | 1 | 1.8 | 0 / 360 | 0 | 0 | 16 | 101 | 112 | 2 | - |
| PIXEL | MENU | 0.6 | 0.8 | 0 / 360 | 0 | 0 | 11 | 98 | 69 | 7 | - |
| PIXEL | LEVEL SELECT cycling | 1 | 1.3 | 0 / 360 | 0 | 0 | 11 | 118 | 100 | 6 | 19 |
| PIXEL | RECORDS | 0.3 | 0.5 | 0 / 361 | 0 | 0 | 11 | 69 | 60 | 6 | 19 |
| PIXEL | busy gen-2 room 8 | 1.3 | 1.6 | 0 / 361 | 0 | 0 | 13 | 180 | 208 | 6 | 19 |
| PIXEL | tile gen-3 room 8 | 1.3 | 1.6 | 0 / 360 | 0 | 0 | 14 | 188 | 213 | 6 | 19 |
| PIXEL | fat world | 1.5 | 2 | 0 / 360 | 0 | 0 | 14 | 179 | 198 | 6 | 19 |
| PIXEL | PAUSE | 0.4 | 0.7 | 0 / 360 | 0 | 0 | 11 | 73 | 60 | 5 | - |
| PIXEL | GAME OVER | 0.7 | 1.6 | 0 / 360 | 0 | 0 | 10 | 83 | 87 | 5 | 19 |
| REAL 3D | title | 1.1 | 1.4 | 0 / 361 | 0 | 2 | 16 | 117 | 88 | 2 | - |
| REAL 3D | MENU | 0.6 | 0.9 | 0 / 361 | 0 | 0 | 10 | 89 | 64 | 5 | - |
| REAL 3D | LEVEL SELECT cycling | 1 | 1.5 | 0 / 360 | 0 | 0 | 11 | 142 | 106 | 5 | 19 |
| REAL 3D | RECORDS | 0.3 | 0.5 | 0 / 360 | 0 | 0 | 10 | 75 | 53 | 5 | 19 |
| REAL 3D | busy gen-2 room 8 | 1.5 | 1.9 | 0 / 360 | 0 | 0 | 14 | 240 | 183 | 5 | 50 |
| REAL 3D | tile gen-3 room 8 | 1.6 | 2.1 | 0 / 360 | 0 | 0 | 14 | 237 | 186 | 7 | 19 |
| REAL 3D | fat world | 1.7 | 2 | 0 / 360 | 0 | 0 | 14 | 220 | 192 | 6 | 19 |
| REAL 3D | PAUSE | 0.5 | 0.7 | 0 / 360 | 0 | 0 | 13 | 85 | 69 | 5 | - |
| REAL 3D | GAME OVER | 1.3 | 1.7 | 0 / 360 | 0 | 0 | 11 | 117 | 95 | 5 | 19 |

First room from MENU (`begin()`), longest frame: CLASSIC 2D 18 ms, PIXEL 19 ms, REAL 3D 34 ms.

### Desk CPU, run to run (browser + renderer + GPU, ms per s)

The two desk blocks ran the same code on the same machine about 13 minutes apart. Treat the change
between them as noise.

| Look | Window | Run 1 | Run 2 | Change | Baseline (higher) |
|---|---|---|---|---|---|
| CLASSIC 2D | title | 254 | 231 | -9 % | 254 |
| CLASSIC 2D | MENU | 208 | 174 | -16 % | 208 |
| CLASSIC 2D | LEVEL SELECT cycling | 282 | 270 | -4 % | 282 |
| CLASSIC 2D | RECORDS | 163 | 154 | -6 % | 163 |
| CLASSIC 2D | busy gen-2 room 8 | 358 | 385 | +8 % | 385 |
| CLASSIC 2D | tile gen-3 room 8 | 355 | 360 | +1 % | 360 |
| CLASSIC 2D | fat world | 352 | 354 | +1 % | 354 |
| CLASSIC 2D | PAUSE | 224 | 179 | -20 % | 224 |
| CLASSIC 2D | GAME OVER | 270 | 242 | -10 % | 270 |
| PIXEL | title | 246 | 229 | -7 % | 246 |
| PIXEL | MENU | 180 | 178 | -1 % | 180 |
| PIXEL | LEVEL SELECT cycling | 226 | 229 | +1 % | 229 |
| PIXEL | RECORDS | 136 | 140 | +3 % | 140 |
| PIXEL | busy gen-2 room 8 | 436 | 401 | -8 % | 436 |
| PIXEL | tile gen-3 room 8 | 441 | 415 | -6 % | 441 |
| PIXEL | fat world | 393 | 391 | -1 % | 393 |
| PIXEL | PAUSE | 158 | 144 | -9 % | 158 |
| PIXEL | GAME OVER | 271 | 180 | -34 % | 271 |
| REAL 3D | title | 253 | 221 | -13 % | 253 |
| REAL 3D | MENU | 208 | 163 | -22 % | 208 |
| REAL 3D | LEVEL SELECT cycling | 286 | 259 | -9 % | 286 |
| REAL 3D | RECORDS | 178 | 138 | -22 % | 178 |
| REAL 3D | busy gen-2 room 8 | 485 | 437 | -10 % | 485 |
| REAL 3D | tile gen-3 room 8 | 507 | 437 | -14 % | 507 |
| REAL 3D | fat world | 423 | 426 | +1 % | 426 |
| REAL 3D | PAUSE | 164 | 167 | +2 % | 167 |
| REAL 3D | GAME OVER | 255 | 223 | -13 % | 255 |

## Phone (393x852 at dpr 3, mobile and touch emulation; an M5 GPU, not a phone)

### Run 1, no throttle

| Look | Window | Work p50 | Work p90 | Dropped / frames | Long >= 50 ms | LoAF | CPU browser | CPU renderer | CPU GPU | CPU other | Open / load, longest frame |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CLASSIC 2D | title | 1.5 | 2.1 | 0 / 300 | 0 | 0 | 18 | 110 | 130 | 2 | - |
| CLASSIC 2D | MENU | 0.6 | 0.9 | 0 / 300 | 0 | 0 | 15 | 95 | 82 | 6 | - |
| CLASSIC 2D | LEVEL SELECT cycling | 1.3 | 1.9 | 0 / 301 | 0 | 0 | 14 | 141 | 142 | 4 | 19 |
| CLASSIC 2D | RECORDS | 0.5 | 0.8 | 0 / 301 | 0 | 0 | 14 | 93 | 83 | 5 | 19 |
| CLASSIC 2D | busy gen-2 room 8 | 0.8 | 1.4 | 0 / 301 | 0 | 0 | 12 | 143 | 186 | 4 | 19 |
| CLASSIC 2D | tile gen-3 room 8 | 0.9 | 1.5 | 0 / 300 | 0 | 0 | 13 | 154 | 195 | 4 | 19 |
| CLASSIC 2D | fat world | 0.9 | 1.5 | 0 / 300 | 0 | 0 | 12 | 143 | 201 | 5 | 19 |
| CLASSIC 2D | PAUSE | 0.7 | 1.1 | 0 / 300 | 0 | 0 | 15 | 98 | 102 | 5 | - |
| CLASSIC 2D | GAME OVER | 1.1 | 1.7 | 0 / 300 | 0 | 0 | 12 | 115 | 142 | 4 | 19 |
| PIXEL | title | 1 | 1.5 | 0 / 300 | 0 | 0 | 17 | 98 | 117 | 2 | - |
| PIXEL | MENU | 0.5 | 0.8 | 0 / 300 | 0 | 0 | 16 | 110 | 84 | 5 | - |
| PIXEL | LEVEL SELECT cycling | 1.1 | 1.6 | 0 / 300 | 0 | 0 | 15 | 142 | 119 | 5 | 19 |
| PIXEL | RECORDS | 0.5 | 0.7 | 0 / 301 | 0 | 0 | 15 | 103 | 85 | 5 | 19 |
| PIXEL | busy gen-2 room 8 | 1.2 | 1.6 | 0 / 300 | 0 | 0 | 15 | 171 | 207 | 5 | 18 |
| PIXEL | tile gen-3 room 8 | 1.3 | 1.6 | 0 / 300 | 0 | 0 | 17 | 203 | 225 | 5 | 19 |
| PIXEL | fat world | 1.4 | 1.7 | 0 / 300 | 0 | 0 | 14 | 188 | 214 | 4 | 19 |
| PIXEL | PAUSE | 0.5 | 0.7 | 0 / 301 | 0 | 0 | 13 | 85 | 72 | 6 | - |
| PIXEL | GAME OVER | 1.4 | 1.7 | 0 / 300 | 0 | 0 | 12 | 108 | 120 | 4 | 19 |
| REAL 3D | title | 0.9 | 1.4 | 0 / 300 | 0 | 0 | 16 | 111 | 83 | 3 | - |
| REAL 3D | MENU | 0.4 | 0.7 | 0 / 300 | 0 | 0 | 14 | 116 | 65 | 6 | - |
| REAL 3D | LEVEL SELECT cycling | 0.9 | 1.2 | 0 / 300 | 0 | 0 | 11 | 148 | 111 | 5 | 19 |
| REAL 3D | RECORDS | 0.3 | 0.5 | 0 / 300 | 0 | 0 | 10 | 89 | 57 | 5 | 19 |
| REAL 3D | busy gen-2 room 8 | 1.5 | 1.9 | 0 / 300 | 0 | 0 | 15 | 242 | 195 | 5 | 33 |
| REAL 3D | tile gen-3 room 8 | 1.5 | 2 | 0 / 300 | 0 | 0 | 16 | 240 | 192 | 5 | 18 |
| REAL 3D | fat world | 1.5 | 1.9 | 0 / 300 | 0 | 0 | 14 | 206 | 185 | 7 | 19 |
| REAL 3D | PAUSE | 0.4 | 0.6 | 0 / 300 | 0 | 0 | 10 | 85 | 66 | 6 | - |
| REAL 3D | GAME OVER | 1.6 | 2 | 0 / 300 | 0 | 0 | 11 | 133 | 102 | 5 | 19 |

First room from MENU (`begin()`), longest frame: CLASSIC 2D 19 ms, PIXEL 19 ms, REAL 3D 33 ms.

### Run 2, CPU throttle x4

Under CDP CPU throttling, the renderer reads about 800 ms per s in every window, idle pages
included, so that number does not show the game's own work. Compare the throttled renderer CPU
only with other throttled runs, never with the unthrottled tables. Work times are real JS time at
x4.

| Look | Window | Work p50 | Work p90 | Dropped / frames | Long >= 50 ms | LoAF | CPU browser | CPU renderer | CPU GPU | CPU other | Open / load, longest frame |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CLASSIC 2D | title | 0.9 | 1.4 | 0 / 300 | 0 | 0 | 6 | 795 | 35 | 1 | - |
| CLASSIC 2D | MENU | 0.2 | 1 | 0 / 300 | 0 | 0 | 3 | 792 | 20 | 2 | - |
| CLASSIC 2D | LEVEL SELECT cycling | 1 | 1.5 | 0 / 301 | 0 | 0 | 4 | 807 | 42 | 2 | 19 |
| CLASSIC 2D | RECORDS | 0.1 | 1.1 | 0 / 301 | 0 | 0 | 4 | 790 | 19 | 2 | 19 |
| CLASSIC 2D | busy gen-2 room 8 | 0.9 | 1.2 | 0 / 300 | 0 | 0 | 5 | 821 | 85 | 2 | 19 |
| CLASSIC 2D | tile gen-3 room 8 | 1 | 1.5 | 0 / 300 | 0 | 0 | 5 | 827 | 88 | 2 | 19 |
| CLASSIC 2D | fat world | 1.3 | 1.7 | 0 / 300 | 0 | 0 | 5 | 823 | 91 | 2 | 19 |
| CLASSIC 2D | PAUSE | 0.2 | 1 | 0 / 301 | 0 | 0 | 4 | 789 | 24 | 2 | - |
| CLASSIC 2D | GAME OVER | 0.7 | 1.1 | 0 / 300 | 0 | 0 | 4 | 797 | 45 | 2 | 19 |
| PIXEL | title | 2.2 | 2.7 | 0 / 300 | 0 | 0 | 12 | 835 | 69 | 1 | - |
| PIXEL | MENU | 0.6 | 1.3 | 0 / 300 | 0 | 0 | 7 | 819 | 32 | 4 | - |
| PIXEL | LEVEL SELECT cycling | 1.2 | 1.8 | 0 / 300 | 0 | 0 | 5 | 812 | 41 | 2 | 19 |
| PIXEL | RECORDS | 0.2 | 0.9 | 0 / 300 | 0 | 0 | 4 | 794 | 23 | 2 | 19 |
| PIXEL | busy gen-2 room 8 | 1.6 | 2.1 | 0 / 301 | 0 | 0 | 5 | 835 | 85 | 2 | 19 |
| PIXEL | tile gen-3 room 8 | 1.6 | 2.1 | 0 / 300 | 0 | 0 | 6 | 838 | 84 | 2 | 19 |
| PIXEL | fat world | 2 | 2.2 | 0 / 301 | 0 | 0 | 5 | 839 | 88 | 3 | 19 |
| PIXEL | PAUSE | 0.2 | 1.1 | 0 / 301 | 0 | 0 | 4 | 792 | 18 | 2 | - |
| PIXEL | GAME OVER | 1.1 | 1.8 | 0 / 300 | 0 | 0 | 4 | 802 | 40 | 2 | 19 |
| REAL 3D | title | 0.6 | 1.2 | 0 / 301 | 0 | 0 | 6 | 806 | 23 | 1 | - |
| REAL 3D | MENU | 0.2 | 1.1 | 0 / 300 | 0 | 0 | 4 | 797 | 18 | 2 | - |
| REAL 3D | LEVEL SELECT cycling | 1 | 1.6 | 0 / 300 | 0 | 0 | 4 | 814 | 40 | 2 | 19 |
| REAL 3D | RECORDS | 0.2 | 1 | 0 / 301 | 0 | 0 | 3 | 802 | 17 | 2 | 19 |
| REAL 3D | busy gen-2 room 8 | 1.9 | 2.5 | 0 / 300 | 0 | 0 | 6 | 859 | 74 | 3 | 117 |
| REAL 3D | tile gen-3 room 8 | 1.3 | 2.1 | 0 / 300 | 0 | 0 | 5 | 840 | 59 | 2 | 50 |
| REAL 3D | fat world | 1.2 | 1.7 | 0 / 300 | 0 | 0 | 5 | 828 | 57 | 3 | 33 |
| REAL 3D | PAUSE | 0.2 | 1.2 | 0 / 301 | 0 | 0 | 3 | 795 | 20 | 2 | - |
| REAL 3D | GAME OVER | 1.2 | 2.2 | 0 / 300 | 0 | 0 | 4 | 811 | 33 | 2 | 19 |

First room from MENU (`begin()`), longest frame: CLASSIC 2D 19 ms, PIXEL 19 ms, REAL 3D 83 ms.

## Hitch (fresh page per look, steps one by one)

### Run 1, no throttle

| Step | CLASSIC 2D | PIXEL | REAL 3D |
|---|---|---|---|
| open LEVEL SELECT | 19 | 18 | 19 |
| LEVEL SELECT room 2 | 18 | 19 | 19 |
| LEVEL SELECT room 3 | 19 | 19 | 18 |
| LEVEL SELECT room 4 | 19 | 19 | 19 |
| LEVEL SELECT room 5 | 18 | 19 | 18 |
| LEVEL SELECT room 6 | 19 | 19 | 19 |
| LEVEL SELECT room 7 | 19 | 19 | 19 |
| LEVEL SELECT room 8 | 19 | 19 | 19 |
| LEVEL SELECT back to MENU | 19 | 18 | 19 |
| open RECORDS | 19 | 19 | 19 |
| RECORDS back to MENU | 19 | 19 | 19 |
| room, no bomb, no lock | 19 | 19 | 49 (LoAF 69) |
| first lock-on | 19 | 19 | 19 |
| first blast | 19 | 19 | 19 |
| second blast | 18 | 19 | 19 |
| first kill | 18 | 19 | 19 |
| second kill | 19 | 19 | 19 |
| third blast | 19 | 19 | 19 |
| room again, no bomb, no lock | 19 | 19 | 19 |
| other biome, no bomb, no lock | 19 | 19 | 19 |
| WIN overlay before world 2 | 19 | 18 | 19 |
| new, after WIN, world 2 | 19 | 19 | 19 |
| WIN overlay before world 3 | 19 | 19 | 19 |
| new, after WIN, world 3 | 19 | 19 | 18 |
| WIN overlay before world 4 | 19 | 19 | 19 |
| new, after WIN, world 4 | 19 | 19 | 18 |
| WIN overlay before world 5 | 18 | 19 | 18 |
| new, after WIN, world 5 | 19 | 19 | 19 |
| WIN overlay before world 6 | 18 | 19 | 19 |
| new, after WIN, world 6 | 18 | 19 | 33 (LoAF 56) |
| new, cold, world 7 | 19 | 19 | 35 (LoAF 57) |
| revisit world 2 | 19 | 19 | 34 (LoAF 53) |
| revisit world 8 | 19 | 19 | 34 (LoAF 51) |
| GAME OVER | 19 | 19 | 18 |

### Run 2, CPU throttle x4

| Step | CLASSIC 2D | PIXEL | REAL 3D |
|---|---|---|---|
| open LEVEL SELECT | 19 | 19 | 19 |
| LEVEL SELECT room 2 | 19 | 19 | 19 |
| LEVEL SELECT room 3 | 19 | 19 | 19 |
| LEVEL SELECT room 4 | 19 | 19 | 19 |
| LEVEL SELECT room 5 | 19 | 19 | 19 |
| LEVEL SELECT room 6 | 19 | 19 | 19 |
| LEVEL SELECT room 7 | 19 | 19 | 19 |
| LEVEL SELECT room 8 | 19 | 19 | 19 |
| LEVEL SELECT back to MENU | 19 | 19 | 19 |
| open RECORDS | 19 | 19 | 19 |
| RECORDS back to MENU | 19 | 19 | 19 |
| room, no bomb, no lock | 19 | 19 | 117 (LoAF 134) |
| first lock-on | 19 | 19 | 19 |
| first blast | 19 | 19 | 19 |
| second blast | 19 | 19 | 19 |
| first kill | 19 | 19 | 19 |
| second kill | 19 | 19 | 19 |
| third blast | 19 | 19 | 19 |
| room again, no bomb, no lock | 19 | 19 | 19 |
| other biome, no bomb, no lock | 19 | 19 | 32 (LoAF 59) |
| WIN overlay before world 2 | 19 | 19 | 52 (LoAF 78) |
| new, after WIN, world 2 | 19 | 19 | 33 (LoAF 60) |
| WIN overlay before world 3 | 19 | 19 | 33 (LoAF 64) |
| new, after WIN, world 3 | 19 | 19 | 35 (LoAF 59) |
| WIN overlay before world 4 | 19 | 19 | 34 (LoAF 56) |
| new, after WIN, world 4 | 19 | 19 | 32 (LoAF 53) |
| WIN overlay before world 5 | 19 | 19 | 33 (LoAF 59) |
| new, after WIN, world 5 | 19 | 19 | 34 (LoAF 52) |
| WIN overlay before world 6 | 19 | 19 | 19 |
| new, after WIN, world 6 | 19 | 19 | 68 (LoAF 88) |
| new, cold, world 7 | 19 | 19 | 84 (LoAF 97) |
| revisit world 2 | 19 | 19 | 83 (LoAF 100) |
| revisit world 8 | 19 | 19 | 67 (LoAF 92) |
| GAME OVER | 19 | 19 | 19 |

The run-2 unthrottled hitch pass and both profiled passes are in the JSON. The profiled passes run
under the CPU sampler, which adds LoAF entries of its own, so they name functions and are not
used to count hitches.

## Where the baseline stands against the plan's budgets

- **Menu work p90 <= 2 ms on desk:** the menu pages pass. On desk, title, MENU, LEVEL SELECT
  cycling, RECORDS and PAUSE read 0.5–1.8 ms in both runs. The GAME OVER overlay sits at the line:
  REAL 3D 2.1 ms and PIXEL 2.0 ms in run 1, then 1.7 and 1.6 ms in run 2. Unthrottled phone is
  0.5–1.9 ms, except the CLASSIC 2D title at 2.1 ms.
- **Menu work p90 <= 5 ms at `--throttle 4`:** passes. The highest are the PIXEL title at 2.7 ms and
  REAL 3D GAME OVER at 2.2 ms, both on phone x4. Desk is never throttled by the tool, so the x4 menu numbers come from the phone block
  (393x852 layout) and the hitch x4 pass, not from the desk layout.
- **0 long frames >= 50 ms on any page open:** passes. Every menu open, LEVEL SELECT room change,
  back to MENU and GAME OVER edge is 18–19 ms in all three looks, with and without x4. No menu
  window has a long interval.
- **0 long frames >= 50 ms on a room change:** already fails today in REAL 3D, not in CLASSIC 2D or
  PIXEL. The first room from MENU took 117 ms (desk run 1), 83 ms (phone x4) and 33–34 ms
  elsewhere. A staged room load took up to 82 ms (desk run 1, tile gen-3 room 8) and 117 ms (phone
  x4, busy room). In the hitch x4 pass, new and revisited worlds took 32–117 ms, with LoAF entries
  of 52–134 ms. The menu work does not cause these, but a later release must not be judged
  against 0 for REAL 3D room changes without fixing them first. The first room from MENU was
  117 ms in run 1 and 34 ms in run 2, on the same code. A fresh profile does not empty the
  macOS Metal shader cache, so this number also depends on what that cache holds.
- **Menu CPU within +15 % of this baseline:** the desk run-to-run change on menu windows reaches
  34 %, which is more than the budget. Use the "Baseline (higher)" column, run the new build twice
  with the same commands on the same display, and compare its higher run with it.

## How to compare a later build

1. Check out the build. Close other heavy apps. Run both commands above with the window on a
   60 Hz display (or re-run this baseline on the display you use).
2. Check the JSON's `env` first: `hz`, `gpu`, and `visible` / `focus` true. Also check that
   `errors` is empty, because a screen check or a short LEVEL SELECT cycle is listed there.
3. Menu work p90, per window and look: <= 2 ms desk, <= 5 ms phone x4 and hitch x4.
4. Long frames: 0 `long` in every menu window, and every menu step in the hitch tables under
   50 ms with no LoAF entry. REAL 3D room changes: compare with the numbers above, not with 0.
5. CPU: for each menu window, the new build's higher run against "Baseline (higher)", within
   +15 %.
6. The windows are found by label and state, so this tool runs as it is against the v202 menus,
   whose rows are PLAY, LEVEL SELECT, DAILY, RECORDS, SETTINGS, GUIDE, SOURCE.
