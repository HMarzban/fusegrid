# Settings / OPTIONS Menu Program — INDEX

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fusegrid gets PLAY, one OPTIONS page and a pause menu that owns the run-time verbs, and the HTML chrome that was standing in for them goes away.

**Architecture:** Three sub-plans, strictly ordered. **S1** builds the value layer with no UI — `src/app/settings.js` (`nb.settings.v1`), live audio volume scaling inside `voice`/`noise`/`musicGain`, `setFxOpts` inside the two fx getters, `LIGHT_BASE` + `createLights(biome, k)` + the `o.bright` live path, and `CAM_PRESET` applied as `rig.dist` in `main.js`. At defaults every knob is a no-op and every existing pin passes byte-identically. **S2** builds the surface — `SCREEN.SETTINGS = 10`, the 8-row `ITEMS`, `drawSettings` + `settingsHit`, shellview routing and the `CACHE_NAME` build kicker. **S3** builds the pause list that hosts that same page inline (`app.pauseView === 1`), then deletes the toolbar and the keyboard legend. One authoritative home per setting: no mirrored toggles, no restart-required flow, no free orbit, no second light recipe. `step()` is untouched — every value here is app/render layer and none of it reaches the sim.

**Tech Stack:** Pure ES modules, `node --test` / `tests/*.test.mjs`, Canvas 2D + vendored three.js r160. Zero npm runtime deps. `src/core` stays DOM-free; `src/render/` may not import `src/app/` (only `shellview.js` may, for screen constants).

**Spec:** `docs/superpowers/specs/2026-09-05-settings-menu-design.md`

## Global Constraints

Verbatim from the spec, binding on all three sub-plans:

- **One authoritative home per setting.** No mirrored toggles, no restart-required flow, no free orbit, no second light recipe. `step()` is untouched: every value here is app/render layer, none of it reaches the sim.
- `SCREEN.SETTINGS = 10`, appended after `ENEMIES:9` — **never inserted**, or every frozen value after it shifts.
- **RENDER folds, it does not stay as a quick toggle.** A mirrored control is two write paths for one persisted value, which is the exact jam-prototype tell this pass exists to remove.
- **No HELP hub.** Folding HOW TO / ITEMS / ENEMIES under a parent would add a `SCREEN`, a draw fn and a back-stack to shorten a list that is already inside norms at 8. Refused.
- **Rows never hide or reflow.** 3D-only rows render at alpha 0.45 with value `—` and reject adjust while `render3d === false`.
- **Persistence: one key, one module.** `src/app/settings.js`, key `nb.settings.v1`, one JSON object, following the `store.js` / `defaultStore()` / try-catch / degrade-to-default scaffold verbatim. Any parse failure, any missing field, any non-object → that field's default. **Never throws.**
- `?render=3d|iso` still wins at boot over the persisted `r3d`; precedence is `urlKind === "3d" || opts.render3d === true`, else the blob. `iso` stays flag-only.
- **SFX volume: scale the value, do not add a node.** `tests/music.test.mjs:496-529` ("sfx routes direct-to-destination") **stays exactly as written** — no renegotiation. An `sfxGain` node would fail that pin outright and re-couple `duck()` to SFX; refused.
- `sfxVol === 0` early-returns beside `muted` at the top of `voice()`/`noise()` — `exponentialRampToValueAtTime(0)` throws, and zero volume means no node at all.
- **Defaults are 100 / 100**, not 70 / 80. The shipped mix IS the authored mix. At default settings **every existing audio pin passes byte-identically** — that is the property that makes this program reviewable.
- **CAMERA presets are persisted starting dolly positions, not new rigs.** `el`, `az` and `target` never move. `createRig()` still returns exactly `{az:0, el:0.54, dist:870, target:[0,-48,0]}`. **No preset dollies in** — every preset is `>= 870`. **`FAR` stops at 1040.**
- **BRIGHTNESS is a uniform light multiplier.** Key:fill stays 2.3333:1 at every `k`. Never per-biome, never `toneMappingExposure` — `NoToneMapping` is source-pinned at `three.test.mjs:235-252`. BRIGHTNESS is **3D only**; CLASSIC 2D blits the authored hex.
- **REDUCE FLASH damps exactly one thing:** the full-canvas `#ffe8a8` wash. Particles, confetti and boom tints are unaffected — they are not flashes.
- `world.state === "PAUSE"` **stays a world state. It never becomes a `SCREEN`.** The shell stays `GAME` throughout.
- **OPTIONS from pause is an inline page, not a screen jump.** `pauseView = 1` swaps the overlay's contents for the same nine settings rows, drawn by the same `drawSettings` body, adjusted by the same knob code. One implementation, two hosts.
- **Hit-test coordinate space is named, not inferred.** Client→box conversion is the `camrig.js:70-73` `ptOf` pattern — CSS `getBoundingClientRect` scale against the overlay canvas, **never** `#gl`'s Retina drawing buffer.
- **Refuse:** keybind remapping · colorblind palette modes · graphics quality tiers · a pending-changes/apply/restart-required flow · free orbit as a setting · per-biome camera or light tables · a second light recipe or a second user multiplier · a master volume above only two children · an `sfxGain` node · `toneMappingExposure` · a CREDITS row separate from SOURCE · a HELP hub screen · moving pace off LEVEL SELECT · any settings value reaching `step()` · portal SDKs, accounts, cloud save.
- No comments unless the file already uses explanatory block comments (its style). Match the compact, no-whitespace-after-key style already in the codebase.
- **Never write the banned grid-bomb franchise name into any committed file.**
- PWA: bump `CACHE_NAME` (`src/pwa/shell.js:1`) and `REV` (`sw.js:3`) **together**, `current vN → vN+1`, in **every** commit in this program — all of them touch precached bytes, `index.html` included. **Read the current value first; never assume.** The P4 art program is bumping the same two lines concurrently.

## File map

| File | S1 | S2 | S3 |
|---|---|---|---|
| `src/app/settings.js` | **create** | read | read |
| `src/audio.js` | `setVols` + `musVol`/`sfxVol` scaling | — | — |
| `src/render/fx.js` | `setFxOpts` + both getters | — | — |
| `src/render/three/lights.js` | `LIGHT_BASE`, `createLights(b,k)`, `applyBright` | — | — |
| `src/render/three/scene.js` | `buildScene(world,atlas,bright)` + `scene.lights` | — | — |
| `src/render/three/wrapper.js` | `o.bright` live path | — | — |
| `src/render/three/camrig.js` | `CAM_PRESET`, `CAM_NAME`, `camPreset` | — | — |
| `src/app/menuapp.js` | — | `SCREEN.SETTINGS`, 8-row `ITEMS`, knob nav | pause list + `pauseView` |
| `src/render/menudraw.js` | — | `drawSettings`, `settingsHit`, `settingsGeom`, `settingsRows`; `drawMenu` drops `togT` | — |
| `src/render/shellview.js` | — | SETTINGS route + `REV` kicker | paused-OPTIONS route |
| `src/render/scenes.js` | — | — | `overlayBox`, `pauseHit`, `drawOverlay` `ui` arg, `overlayCue` PAUSE |
| `src/render/renderer.js` | — | — | `overlayBox` call site + `o.pause` |
| `src/main.js` | boot-apply every knob | settings persist wiring | pause wiring, `#hud` gate, toolbar deletion |
| `src/touch.js` | — | — | `#tpause`, `update(inGame, playing)` |
| `index.html` | — | — | `#tpause` + CSS; `#controls` and `.hint` deleted |
| `src/app/toolbar.js` | — | — | **deleted** |
| `src/pwa/shell.js` / `sw.js` | `SRC` += settings.js, bump | bump | `SRC` −= toolbar.js, bump |

Tests: `tests/settings.test.mjs` (**new**, S1) · `music.test.mjs`, `three.test.mjs` (S1 additions) · `menuapp.test.mjs`, `menudraw.test.mjs`, `headless.test.mjs` (S2 rewrites) · `headless.test.mjs`, `heat.test.mjs`, `coach.test.mjs`, `touch.test.mjs`, `three.test.mjs` (S3).

## Shared interfaces

**Every signature below is final. S1/S2/S3 quote these verbatim — if a sub-plan disagrees with this block, this block wins.**

### Settings store — `src/app/settings.js` (S1)

```js
export const SETTINGS_KEY = "nb.settings.v1";
export const DEFAULTS = Object.freeze({mus:100,sfx:100,snd:1,r3d:0,cam:0,bri:100,shk:1,flx:0});
export function clampSettings(raw)          // any input -> a fresh 8-key object, never throws
export function loadSettings(store)         // -> clamped object; missing/corrupt -> DEFAULTS
export function saveSettings(v, store)      // clamps then writes JSON; silent on failure
```

Clamp table (applied identically on load and on save):

| key | rule |
|---|---|
| `mus`, `sfx` | int, `Math.min(100, Math.max(0, Math.round(n / 10) * 10))` |
| `bri` | int, `Math.min(130, Math.max(70, Math.round(n / 10) * 10))` |
| `cam` | int, `Math.min(2, Math.max(0, n | 0))` |
| `snd`, `r3d`, `shk`, `flx` | `n ? 1 : 0` |

Stored as whole percent, consumed as a scalar: `musVol = mus/100`, `sfxVol = sfx/100`, `k = bri/100`.

### Audio (S1) — `src/audio.js`

```js
setVols({mus, sfx})   // 0..1 scalars, clamped; missing key = unchanged; returns {mus, sfx}
```

Closure state `let musVol = 1, sfxVol = 1;` plus `const musBase = () => Math.max(MUS_FLOOR, MUS_BASE * musVol);` and `const musDuck = () => Math.max(MUS_FLOOR, MUS_DUCK * musVol);`. `voice()`/`noise()` gain `sfxVol <= 0` to their `muted` early-return and multiply their one peak-amplitude ramp by `sfxVol`. `unlock()`, `duck()` and `toggle()` read `musBase()`/`musDuck()`. At `(1, 1)` every value is byte-identical to today.

### FX (S1) — `src/render/fx.js`

```js
export function setFxOpts({flashK, shakeK})   // clamped 0..1, defaults 1/1; returns {flashK, shakeK}
export function getFxOpts()                   // -> {flashK, shakeK}
export function getShake()                    // -> {x: fx.shakeX * shakeK, y: fx.shakeY * shakeK}
export function getFlash()                    // -> fx.flashT * flashK
```

`initFx()` **must not** reset `flashK`/`shakeK` — they are user preference, not fx state, and every renderer construction calls `initFx()`.

### Lights + camera (S1)

```js
// src/render/three/lights.js
export const LIGHT_BASE = Object.freeze({hemi:0.72, key:1.26, fill:0.54, amb:0.30});
export function createLights(biome, k)     // k defaults to 1 -> today's recipe exactly
export function applyBright(L, k)          // rescales the four intensities from LIGHT_BASE; returns L

// src/render/three/scene.js
export function buildScene(world, atlas, bright)   // bright defaults 1; scene object gains `lights`

// src/render/three/wrapper.js
render(world, dt, o)                       // o.bright = k; rescale in place when it differs, store for rebuild

// src/render/three/camrig.js
export const CAM_PRESET = Object.freeze([870, 960, 1040]);
export const CAM_NAME = Object.freeze(["STANDARD", "WIDE", "FAR"]);
export function camPreset(i)               // clamped index -> dist
```

`createRig()` takes no parameter and still returns `{az:0, el:0.54, dist:870, target:[0,-48,0]}`. The preset is applied in `main.js` as `rig.dist = camPreset(S.cam)` — at boot, in `onStart` after `resetOrbit(rig)`, in the `KeyR` handler after `resetOrbit(rig)`, and on a CAMERA knob change.

### Shell (S2) — `src/app/menuapp.js`

```js
export const SCREEN = Object.freeze({BOOT:0, INTRO:1, MENU:2, LEVEL:3, HOWTO:4,
  SCORES:5, GAME:6, ATTRACT:7, ITEMS:8, ENEMIES:9, SETTINGS:10});
export const ITEMS = Object.freeze(["PLAY","LEVEL SELECT","OPTIONS","HOW TO PLAY",
  "ITEMS","ENEMIES","HIGH SCORES","SOURCE"]);
export const OPT_ROWS = Object.freeze(["MUSIC","SFX","SOUND","RENDER","CAMERA",
  "BRIGHTNESS","SCREEN SHAKE","REDUCE FLASH","RESET DEFAULTS"]);
```

New app fields: `settings` (the clamped blob, live), `optRow` (0–8, its **own** cursor so the MENU `cursor` survives a round trip). New methods `optMove(dir)`, `optAdjust(dir)`, `optCycle()`. New opt: `o.onSettings(blob, key)`, fired after every successful change, exactly the `o.onPaceChange` shape.

Row table — `optAdjust` clamps and never wraps; `optCycle` wraps:

| row | label | key | kind | step | min | max | 3D-only |
|---|---|---|---|---|---|---|---|
| 0 | `MUSIC` | `mus` | slider | 10 | 0 | 100 | no |
| 1 | `SFX` | `sfx` | slider | 10 | 0 | 100 | no |
| 2 | `SOUND` | `snd` | toggle | — | 0 | 1 | no |
| 3 | `RENDER` | `r3d` | toggle | — | 0 | 1 | no |
| 4 | `CAMERA` | `cam` | enum | 1 | 0 | 2 | **yes** |
| 5 | `BRIGHTNESS` | `bri` | slider | 10 | 70 | 130 | **yes** |
| 6 | `SCREEN SHAKE` | `shk` | toggle | — | 0 | 1 | no |
| 7 | `REDUCE FLASH` | `flx` | toggle | — | 0 | 1 | no |
| 8 | `RESET DEFAULTS` | — | action | — | — | — | no |

Axis convention on SETTINGS is LEVEL's: **axis 1 = ↑/↓ = row**, **axis 0 = ←/→ = adjust**. Every successful change stamps `this.togT = this.subT`. SETTINGS joins `back()`'s poppable list but **not** the `confirm()`-is-back group.

### Draw (S2) — `src/render/menudraw.js`

```js
export function settingsRows(vals, r3d)     // -> 9 display strings
export function settingsGeom(L)             // -> {S, y0, rowH, noteY}
export function settingsHit(x, y, L)        // -> row index 0..8, or -1
export function drawSettings(c, L, t, ui)   // ui = {row, vals, r3d, togT, rev}
export function drawMenu(c, ui, L, t)       // ui = {cursor, items, enterT} — togT DROPPED
```

`settingsGeom` is the single source of the layout budget: `S = shellBox(L, 520)`, `noteY = S.footY - 30`, `y0 = S.headY + 22`, `rowH = Math.min(30, (noteY - 10 - y0) / 9)`.

| Metric | H=352 (projected box) | H=520 (classic box) |
|---|---|---|
| plate `y` / `h` | 46.32 / 277.68 | 73.20 / 418.80 |
| `headY` | 72.32 | 99.20 |
| rows `y0` | 94.32 | 121.20 |
| `rowH` | 19.30 | 30.00 (capped) |
| rows block ends | 268.02 | 391.20 |
| `noteY` / note 2 | 278 / 292 | 446 / 460 |
| inner `footY` | 308 | 476 |

Exact copy, byte-for-byte:

- head: `head(c, S, "OPTIONS", "BUILD " + rev)`
- note 1 (9px muted, at `noteY`): `MOVE WASD/ARROWS · BOMB SPACE · THROW SHIFT+SPACE · REMOTE Q · KICK K+MOVE · PAUSE P`
- note 2 (10px accent, at `noteY + 14`): `TOUCH · LEFT PAD MOVES · RIGHT BUTTON BOMBS · TAP PAUSE PILL`
- foot: `↑↓ ROW · ←→ ADJUST · ENTER CYCLE · ESC BACK`

### Build tag (S2) — `src/render/shellview.js`

```js
import { CACHE_NAME } from "../pwa/shell.js";
const REV = CACHE_NAME.replace("fusegrid-shell-", "");
```

`shellview.js` owns the derivation and passes `rev: REV` inside the `drawSettings` ui object — both on the SETTINGS screen and on the paused OPTIONS page. `drawShell`'s parameter list does not change.

### Pause (S3)

```js
// src/app/menuapp.js
export const PAUSE_ITEMS = Object.freeze(["RESUME","RESTART","OPTIONS","QUIT TO MENU"]);
// app fields: pauseCursor (0..3), pauseView (0 list / 1 options) — both reset on every PLAY -> PAUSE edge
confirmPause()      // OPTIONS handled inline; RESUME/RESTART/QUIT TO MENU -> o.onPauseCmd(cmd)
pauseBack()         // pauseView 1 -> 0; returns false when already on the list

// src/render/scenes.js
export const PAUSE_ROWS = Object.freeze(["RESUME","RESTART","OPTIONS","QUIT TO MENU"]);
export const PAUSE_ROW_H = 26;
export function overlayBox(kind)                       // -> {w, h, cx, cy}
export function pauseHit(x, y, box)                    // -> row index 0..3, or -1
export function drawOverlay(c, world, w, h, cx, cy, ui)  // ui = {view, cursor}, default {view:0,cursor:0}
export function overlayCue(world)                      // PAUSE -> the exact line below
```

`overlayBox("iso")` → `{w: PROJ.canvasW, h: PROJ.canvasH, cx: 304, cy: 188}`; every other kind → `{w: 600, h: 520, cx: 300, cy: 260}`. It feeds **both** `drawOverlay` call sites and **both** hit tests.

Pause-list geometry, in `overlayBox` space: `PAUSED` headline at `cy - 70`, row `i` centred at `cy - 30 + i * PAUSE_ROW_H` (so `cy-30`, `cy-4`, `cy+22`, `cy+48`), cue line at `cy + 86`. Hit band is `|x - cx| <= 130` and `|y - rowY| <= 13`.

`overlayCue(world)` for PAUSE is exactly:

```
↑↓ SELECT · ENTER CONFIRM · P RESUME · M QUIT
```

```js
// src/touch.js
update(inGame, playing)   // box hides outside GAME; #tpad + #tbomb additionally hide
                          // whenever world.state !== "PLAY"; #tpause stays
```

## Execution order

**S1 → S2 → S3, strictly sequential.** S2 needs S1 (there must be knobs to bind); S3 needs S2 (it hosts that same page inline).

1. `docs/superpowers/plans/2026-09-05-settings-store.md` — **S1**, 4 tasks. Value layer, no UI. At defaults nothing changes on screen or in the mix.
2. `docs/superpowers/plans/2026-09-05-options-screen.md` — **S2**, 3 tasks. `SCREEN.SETTINGS`, the 8-row menu, `drawSettings`, routing.
3. `docs/superpowers/plans/2026-09-05-pause-chrome.md` — **S3**, 3 tasks. Pause list, chrome removal, touch pill, headed pass.

## Program checklist

- [ ] **S1.1** `src/app/settings.js` + `tests/settings.test.mjs` + `SRC` entry
- [ ] **S1.2** `setVols` + `musVol`/`sfxVol` scaling in `src/audio.js` (+ `music.test.mjs` additions; `:496-529` untouched)
- [ ] **S1.3** `setFxOpts` in `fx.js`; `LIGHT_BASE` / `createLights(b,k)` / `applyBright`; `scene.lights`; wrapper `o.bright`
- [ ] **S1.4** `CAM_PRESET` in `camrig.js` + every `rig.dist` application and boot-apply in `main.js`
- [ ] **S2.1** `SCREEN.SETTINGS = 10`, 8-row `ITEMS`, `optRow` / `optMove` / `optAdjust` / `optCycle` / `onSettings` (+ `menuapp.test.mjs` rewrites)
- [ ] **S2.2** `drawSettings` / `settingsHit` / `settingsGeom` / `settingsRows`; `drawMenu` drops `togT` (+ `menudraw.test.mjs`)
- [ ] **S2.3** shellview SETTINGS route + `REV` kicker; `main.js` persist + apply wiring; cue-sheet renegotiation (+ `headless.test.mjs`, `three.test.mjs:309`)
- [ ] **S3.1** Pause list: `pauseCursor` / `pauseView` / `confirmPause` / `pauseBack`, `onPauseCmd`, `onPause` guard, `overlayBox` / `pauseHit` / `drawOverlay` `ui`, `overlayCue` PAUSE
- [ ] **S3.2** Chrome removal: `#controls` + `.hint` out of `index.html`, `toolbar.js` deleted, `setBtn` call sites gone, `#hud` gate, `{hud:false}` everywhere non-GAME
- [ ] **S3.3** `#tpause` pill + `touch.update(inGame, playing)` + the headed acceptance pass

## ABI renegotiation ledger

Every pin this program moves, and which plan moves it. Rows marked **(swept)** are pins the spec's own table missed; they were found by `grep -rn "cursor *= *[0-9]" tests/`, `grep -rln "btnPause\|btnSound\|btnRestart\|btnMenu\|mountToolbar\|setBtn" tests/` and `grep -rln "index.html" tests/`.

| Site | Today | New | Plan |
|---|---|---|---|
| `menuapp.js` `SCREEN` | `…ENEMIES:9` | `+ SETTINGS:10` (appended) | S2 |
| `menuapp.js` `ITEMS` | 9 entries | 8 entries, the §1 table | S2 |
| `menuapp.test.mjs:54-64` | `length===9`, `ITEMS[0/5/6/7/8]` | `length===8`, `[0]=PLAY`, `[2]=OPTIONS`, `[7]=SOURCE` | S2 |
| `menuapp.test.mjs:281-390` | cursor 1–8 dispatch | cursor 0–7 table (`0 startRun · 1 LEVEL · 2 SETTINGS · 3 HOWTO · 4 ITEMS · 5 ENEMIES · 6 SCORES · 7 onSource`) | S2 |
| `menuapp.test.mjs:1025-1075` | `togT` at cursor 2/3 on MENU | `togT` on a SETTINGS knob change | S2 |
| `menuapp.test.mjs:1077-1121` `want` map | RENDER/SOUND rows | `OPTIONS → SCREEN.SETTINGS`, `PLAY → SCREEN.GAME` | S2 |
| `menudraw.js` `drawMenu(c, ui, …)` | reads `ui.togT` | arg dropped | S2 |
| `menudraw.test.mjs:135-183` | `drawMenu` toggle-flash | same assertions against `drawSettings` | S2 |
| `menudraw.test.mjs:83-133` | smoke every `draw*` | `+ drawSettings` at 600×520 and 608×352 | S2 |
| `menudraw.test.mjs:185-434` §13c | per-screen chrome fit | `+ drawSettings` vs `plateOf`, both sizes; the menu block's 9-item array and its `"START GAME"` lookup become the 8-item array and `"PLAY"` **(swept)** | S2 |
| `menudraw.test.mjs:627-662` | source regex on `shellview`/`main` wiring | `+ CACHE_NAME` kicker wiring | S2 |
| `headless.test.mjs:185-190` | `cursor=2` → "C1 RENDER click toggles exactly once" | `cursor=2` pushes SETTINGS; the RENDER flip is asserted through `optRow=3` + `confirm()` **(swept)** | S2 |
| `headless.test.mjs:192-196` | `cursor=4` → HOWTO click lands / does not bounce | `cursor=3` → HOWTO **(swept)** | S2 |
| `headless.test.mjs:215-230` | I1 cue sheet: RENDER/SOUND `uiTog` at cursor 2/3, HOWTO `uiSel` at cursor 4 | `uiTog` on a SETTINGS knob change; MENU cursor 2 → `uiSel` + SETTINGS; HOWTO at cursor 3 **(swept)** | S2 |
| `main.js` confirm cue wrapper | `sB === SCREEN.MENU && (cB === 2 \|\| cB === 3)` → `uiTog` | `sB === SCREEN.SETTINGS` → `uiTog`; every MENU row → `uiSel`; SETTINGS excluded from the confirm-is-back group **(swept)** | S2 |
| `three.test.mjs:309-312` | `g.app.screen=2; g.app.cursor=2; g.app.confirm()` → "RENDER toggle swaps to classic surface" | `g.app.screen=10; g.app.optRow=3; g.app.confirm()` **(swept, in P4's file — re-read before editing)** | S2 |
| `scenes.js` `drawOverlay(c,world,w,h,cx,cy)` | 6 args | `+ ui` 7th (`{view,cursor}`) | S3 |
| `heat.test.mjs:64-65` | `overlayCue(PAUSE).includes("M / MENU")` | exact match on `↑↓ SELECT · ENTER CONFIRM · P RESUME · M QUIT` | S3 |
| `headless.test.mjs:438-465` | HUD default-writes / `{hud:false}` | kept, **plus** `{hud:false}` on every non-GAME screen + a `#hud.hidden` gate pin | S3 |
| `headless.test.mjs:467-508` | F3 toolbar GAME-gates | **deleted** with `toolbar.js`; replaced by pause-list dispatch pins | S3 |
| `headless.test.mjs:510-563` | toolbar Menu-button wave | same wave asserted through pause `QUIT TO MENU` | S3 |
| `headless.test.mjs:890-897` | `mountToolbar`/`setBtn` DOM-less no-op | **deleted** | S3 |
| `coach.test.mjs:239-272` | toolbar `Restart` reloads L1, held fire plants no bomb | same two assertions through pause `RESTART` | S3 |
| restart score edge | `#btnRestart` drops the run's score silently | pause `RESTART` calls `persistScore()` first, then `world.score = 0` | S3 |
| `touch.test.mjs` | no pause pin | `+ #tpause` mount + `update(inGame, playing)` visibility matrix | S3 |
| `main.js` returned surface | exports `setBtn` | `setBtn` removed with `toolbar.js` (unpinned — no test reads `g.setBtn`) **(swept)** | S3 |
| `src/pwa/shell.js` `SRC` | — | `+ "src/app/settings.js"` (S1), `− "src/app/toolbar.js"` (S3) | S1 / S3 |
| `CACHE_NAME` / `sw.js` `REV` | `fusegrid-shell-v41` at spec time — **moves under us; read it, do not assume** | `current vN → vN+1` in every commit, both files together | each |

### Kept pins — do not touch

- `three.test.mjs:154-189` — bare `createRig()` still returns `az 0 / el 0.54 / dist 870 / target y -48`; `EL_MIN`/`EL_MAX`/`DIST_MIN`/`DIST_MAX`/`SHAKE_3D_K` unchanged.
- `three.test.mjs:191-233` — the §4b gate, unchanged subject (the default rig).
- `three.test.mjs:235-252` — `NoToneMapping`, no fog.
- `three.test.mjs:~160-189` **§6 lights block** — a **bare** `createLights(biome)` still returns hemi 0.72 / key 1.26 / fill 0.54 / amb 0.30 with the exact shadow camera. This is why `k` defaults to 1. The spec's "Does not move" list omits it; it is binding all the same.
- `three.test.mjs:254-262` — wrapper surface keys exactly `canvas,consumeEvents,ctx,getShake,overlay,render`. `o.bright` is an additive render opt, never a surface key.
- `three.test.mjs:320-375` — orbit flag + `KeyR`. `KeyR` restores the authored rig then re-applies the preset, which at the default `STANDARD` is 870 exactly.
- `three.test.mjs:1367-1380` — `RIM_W === 36`.
- `music.test.mjs:496-529` — SFX direct-to-destination. **Zero edits.**
- `music.test.mjs:437-493` — duck ramps, byte-identical at default volumes.
- `menuapp.test.mjs:42-53` (`BOOT..GAME` 0–6) and `:888-897` (`ATTRACT/ITEMS/ENEMIES` 7/8/9).
- `menuapp.test.mjs:69-96` — the `surf` member list. Additive only; never rename or remove a listed member.
- `menuapp.test.mjs:913-969` — the ATTRACT round-trip at `cursor = 3`. Still a valid index (HOW TO PLAY); no edit.
- `menu-level.test.mjs:128` — `cursor = 0` is still the run-start row. No edit.
- `pwa.test.mjs:319-332` and `headless.test.mjs:730-745` — `index.html` manifest / favicon / og:image / meta description / no root-absolute hrefs. The removed toolbar and hint touch none of them.
- `touch.test.mjs`'s `#tbomb hosts a bomb canvas` regex and `stampBombIcon` colour pin.
- `menudraw.test.mjs:15-81` — `layout()` field/shape pins.

## Resolved ambiguities

1. **Module path: `src/app/settings.js`, not `settingsstore.js`.** The controller brief names `src/app/settingsstore.js`; the spec locks `src/app/settings.js` twice (the persistence block and the `SRC` ABI row). The spec is the binding source for locked values, and one name has to appear in all four plan files plus the `SRC` array, so `settings.js` it is. If the controller prefers `settingsstore.js`, it is a two-line change: the file name and the `SRC` entry.
2. **`audio.setVols({mus, sfx})` — the spec never names the seam.** `createAudio()` is constructed in `index.html` and handed to `createGame` through `opts.audio`, so the volumes cannot be constructor arguments. `setVols` is a method on the returned object, called from `main.js` at boot and on every MUSIC/SFX knob change — the `o.onPaceChange` → `savePace` shape.
3. **How persisted `snd:0` reaches the audio engine.** `createAudio()` boots unmuted and exposes only `toggle()`. `main.js` calls `audio.toggle()` exactly once at boot when `S.snd === 0`, and passes `sound: S.snd !== 0` into `createMenuApp` so the shell and the engine agree from frame one.
4. **`app.optRow`, not `app.cursor`, for the OPTIONS rows.** Reusing `cursor` would make entering OPTIONS from MENU row 2 land on OPTIONS row 2, and backing out would leave the MENU cursor wherever the knobs left it. `optRow` is a separate field, exactly as `scoreHeat` and `level` are.
5. **`?render=3d` vs. the displayed RENDER row.** The blob's `r3d` is the persisted value; the row displays `app.render3d`, which is the live truth. `createMenuApp` seeds `settings.r3d = render3d ? 1 : 0` **in memory only** after computing precedence, so display and blob never disagree and a URL override is never written to storage.
6. **`main.js` must call `app.update(dt, shellInput)` inside the GAME branch.** The spec says `update()`'s `SCREEN.GAME` branch stops early-returning unconditionally, but today `main.js` never calls `update()` during GAME at all. The call is added **unconditionally** (not gated on PAUSE) and placed immediately after `app.noteWorldEdge(prevSt, world.state)`, so (a) the pause branch reads a fresh `app.worldState`, and (b) `prevConfirm` keeps tracking the fire latch across the PLAY→PAUSE edge — otherwise a player holding Space when they press `P` gets a rising edge on the first paused frame and instantly confirms `RESUME`.
7. **The brightness live path reaches the lights through `scene.lights`, not a traverse.** `scene3.traverse(o => o.isLight)` would also catch S4's pooled flash `PointLight`s, whose intensity is animated per frame. `buildScene` exposes `lights` on its returned object instead; no test pins that object's key set.
8. **PWA bump cadence: per commit, not per plan.** The spec's ship order reads "+1 per plan" and names v42/v43/v44; the house rule (and every recent plan) bumps in every commit that touches precached bytes, and `index.html` counts. Every commit here touches `SRC` bytes, so every commit bumps. The spec's numbers are a floor, not a target — **read `src/pwa/shell.js:1` at commit time**, especially because the P4 art program is bumping the same line concurrently.
9. **`settingsHit`'s band is the full row pitch, not an inset.** The spec fixes the row geometry but not the hit band. A tap inside `[S.ix, S.ix + S.iw]` horizontally and inside `[y0 + i*rowH, y0 + (i+1)*rowH)` vertically returns `i`; anything else returns `-1`. Full-pitch bands leave no dead gutter between adjacent rows, which is what makes 19.30px rows tappable at all.

## Cross-program note (P4 player-3d art)

A second implementer is editing `src/render/three/entities.js`, `src/render/three/textures.js`, `tests/three.test.mjs` and `AGENTS.md` concurrently. **This program touches neither `entities.js` nor `textures.js`.** It does append to `tests/three.test.mjs` (S1 light/camera additions) and edit one block in it (S2's `:309-312` renegotiation), and it bumps `src/pwa/shell.js` / `sw.js`, which P4 also bumps.

Rules, binding on every task here:

- **Never edit `tests/three.test.mjs` by line number.** Re-read the file, then append new blocks immediately before its `console.log(fail? "THREE FAIL":"THREE OK");` summary, and locate the `:309` block by its `"RENDER toggle swaps to classic surface (no overlay key)"` string.
- **Never assume the `CACHE_NAME` value.** Read `src/pwa/shell.js:1`, add one, write both files.
- If P4's commits land first, none of the above changes — these plans only add exports to `lights.js` / `camrig.js` / `scene.js` / `wrapper.js`, and `entities.js`'s `createPools(biome, atlas)` call in `buildScene` is untouched.
