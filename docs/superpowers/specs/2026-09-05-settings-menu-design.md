# Settings / menu — design (2026-09-05)

The menu is a nine-row flat list where two rows are toggles. That reads as a
jam build. Shipped arcade games have PLAY, one OPTIONS page, and a pause menu
that owns the run-time verbs. Fusegrid gets all three, and the HTML chrome
that was standing in for them goes away.

One authoritative home per setting. No mirrored toggles, no restart-required
flow, no free orbit, no second light recipe. `step()` is untouched: every
value here is app/render layer, none of it reaches the sim.

## Locked decisions

### 1. Menu IA

`ITEMS` becomes 8 entries, frozen, in this order:

| # | Row | Confirm | Note |
|---|---|---|---|
| 0 | `PLAY` | `startRun()` | renamed from START GAME; keeps the `\|`+`heatToken` value |
| 1 | `LEVEL SELECT` | `_push(LEVEL)` | unchanged, keeps its heat token |
| 2 | `OPTIONS` | `_push(SETTINGS)` | new; absorbs RENDER + SOUND |
| 3 | `HOW TO PLAY` | `_push(HOWTO)` | unchanged |
| 4 | `ITEMS` | `_push(ITEMS)` | unchanged |
| 5 | `ENEMIES` | `_push(ENEMIES)` | unchanged |
| 6 | `HIGH SCORES` | `_push(SCORES)` | unchanged |
| 7 | `SOURCE` | `onSource()` | unchanged (pinned Learned Preference) |

`SCREEN.SETTINGS = 10`, appended after `ENEMIES:9` — never inserted, or every
frozen value after it shifts.

**RENDER folds, it does not stay as a quick toggle.** A mirrored control is two
write paths for one persisted value, which is the exact jam-prototype tell this
pass exists to remove; the hook is sold by the og card, the INTRO flyover and
OPTIONS' first row, not by a duplicate menu entry.

**No HELP hub.** Folding HOW TO / ITEMS / ENEMIES under a parent would add a
`SCREEN`, a draw fn and a back-stack to shorten a list that is already inside
norms at 8. Refused.

`togT` (the 120ms toggle-flash stamp) stops being a MENU concept and becomes a
SETTINGS concept — stamped on every knob change, read by `drawSettings`.
`drawMenu` drops `ui.togT` entirely rather than being passed a dead `-1`.

`shellview.js`'s inline items array loses its RENDER/SOUND value-token rows and
becomes `ITEMS[0..1]` + heat token, then `ITEMS[2..7]` verbatim.

New cursor-literal test pins (`tests/menuapp.test.mjs:281-390`, rewritten — the
old `2→RENDER / 3→SOUND / 4→HOWTO / … / 8→SOURCE` block is testing today's
layout, so it is the correct place to break):

| `a.cursor` | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| confirm → | `startRun` | `LEVEL` | `SETTINGS` | `HOWTO` | `ITEMS` | `ENEMIES` | `SCORES` | `onSource` |

Shape pins move with it: `ITEMS.length===8`, `ITEMS[0]==="PLAY"`,
`ITEMS[2]==="OPTIONS"`, `ITEMS[7]==="SOURCE"`. The label→screen `want` map
(`:1077-1121`) is order-independent — it only loses its RENDER/SOUND rows and
gains `OPTIONS → SCREEN.SETTINGS`.

### 2. OPTIONS screen (`SCREEN.SETTINGS`)

A shell SCREEN following the HOWTO/ITEMS scaffold (`shell` → `head` → body →
`foot`, `drawDim(0.72)`, `_push` transition reset, Esc/Backspace back) with
LEVEL-style live knobs — LEVEL is the only precedent for in-subscreen
adjustment, and this copies its `move(dir,axis)` shape, not HOWTO's
read-and-back-out.

**Rows never hide or reflow.** 3D-only rows render at alpha 0.45 with value `—`
and reject adjust while `render3d === false`.

| # | Row | Control | Range / steps | Default | Blob key | Apply |
|---|---|---|---|---|---|---|
| 0 | `MUSIC` | slider | 0–100, step 10 (11 stops) | `100` | `mus` | live |
| 1 | `SFX` | slider | 0–100, step 10 (11 stops) | `100` | `sfx` | live, next voice |
| 2 | `SOUND` | toggle | `ON` / `OFF` | `ON` | `snd` | live (`audio.toggle()`) |
| 3 | `RENDER` | toggle | `CLASSIC 2D` / `REAL 3D` | `CLASSIC 2D` | `r3d` | live (renderer cache swap) |
| 4 | `CAMERA` | enum | `STANDARD` / `WIDE` / `FAR` | `STANDARD` | `cam` | live, 3D only |
| 5 | `BRIGHTNESS` | slider | 70–130, step 10 (7 stops) | `100` | `bri` | live, 3D only |
| 6 | `SCREEN SHAKE` | toggle | `ON` / `OFF` | `ON` | `shk` | live |
| 7 | `REDUCE FLASH` | toggle | `OFF` / `ON` | `OFF` | `flx` | live |
| 8 | `RESET DEFAULTS` | action | — | — | — | live |

Input: `↑/↓` row (wraps, same `REP_FIRST 0.35` / `REP_NEXT 0.11` repeat as every
other screen). `←/→` decrement/increment, clamped, no wrap. `Enter` cycles the
row forward one stop **wrapping** (`100 → 0` on a slider, flip on a toggle,
apply on `RESET DEFAULTS`) — this is what gives touch full control, since a tap
maps to Enter on the row it hits. `Escape`/`Backspace` back. Every change stamps
`togT = subT`. SETTINGS joins `back()`'s poppable list but **not** the
`confirm()`-is-back group that HOWTO / ITEMS / ENEMIES / SCORES share — Enter is
consumed by the row under the cursor.

Touch: `settingsHit(x, y, L)` (pure, exported beside `drawSettings`, taking the
same `layout()` the page was drawn with and deriving the plate through the same
`shellBox(L, 520)`) returns the row index for a tap inside the row band, `-1`
outside. Tap a row = Enter on it; tap outside the band = back. Foot copy states
both.

Foot: `↑↓ ROW · ←→ ADJUST · ENTER CYCLE · ESC BACK`

Two note lines above the foot, always drawn (not device-gated):

- `noteY` (9px muted): `MOVE WASD/ARROWS · BOMB SPACE · THROW SHIFT+SPACE · REMOTE Q · KICK K+MOVE · PAUSE P`
- `noteY+14` (10px accent): `TOUCH · LEFT PAD MOVES · RIGHT BUTTON BOMBS · TAP PAUSE PILL`

That is the CONTROLS section: **display-only bindings plus the touch note.**
No remap (see Refuse). HOW TO PLAY keeps the long form with icons.

Version line is the head kicker, not a row: `head(c, S, "OPTIONS", "BUILD " + rev)`
where `rev` is `CACHE_NAME` minus the `fusegrid-shell-` prefix (`v41` at spec time).
`shellview.js` imports `CACHE_NAME` from `../pwa/shell.js` and passes it —
`CACHE_NAME` is the only build identifier in the repo and the PWA rule already
forces it to change whenever shipped bytes do. This is the SCORES precedent
(a screen fed from outside `app`/`world`) and gets the same source-regex pin.

**Layout budget** — `shell(c, L, 520)`, rows top-aligned at `y0 = headY + 22`,
`rowH = Math.min(30, (noteY - 10 - y0) / 9)`, `noteY = footY - 30`:

| Metric | H=352 (projected box) | H=520 (classic box) |
|---|---|---|
| plate `y` / `h` | 46.32 / 277.68 | 73.20 / 418.80 |
| `headY` | 72.32 | 99.20 |
| rows `y0` | 94.32 | 121.20 |
| `rowH` | 19.30 | 30.00 (capped) |
| rows block ends | 268.02 | 391.20 |
| `noteY` / note 2 | 278 / 292 | 446 / 460 |
| inner `footY` | 308 | 476 |

19.30px rows at H=352 is exactly the density HIGH SCORES already ships
(`layout().rowH = H*0.055 = 19.36`), so the §13c chrome-fit block has a shipped
precedent to measure against, not a new one.

**Persistence: one key, one module.** `src/app/settings.js`, key
`nb.settings.v1`, one JSON object, following the `store.js` /
`defaultStore()` / try-catch / degrade-to-default scaffold verbatim:

```
{"mus":100,"sfx":100,"snd":1,"r3d":0,"cam":0,"bri":100,"shk":1,"flx":0}
```

Clamp on load and save: `mus`/`sfx` int 0–100 snapped to /10; `bri` int 70–130
snapped to /10; `cam` int 0–2; `snd`/`r3d`/`shk`/`flx` 0|1. Any parse failure,
any missing field, any non-object → that field's default. Never throws.
Stored as whole percent, consumed as a scalar: `musVol = mus/100`,
`sfxVol = sfx/100`, `k = bri/100`.

Per-key would mean six new modules, six new `src/pwa/shell.js` `SRC` entries and
six load/save pairs for one screen's state. `highscores.js` already proves a
structured-value store is house-legal; this is that, with a clamp table.
`RESET DEFAULTS` writes `DEFAULTS` and re-applies every knob live.

`?render=3d|iso` still wins at boot over the persisted `r3d`; precedence is
`urlKind === "3d" || opts.render3d === true`, else the blob. `iso` stays
flag-only.

**SFX volume: scale the value, do not add a node.** `voice()` and `noise()`
each have exactly one peak-amplitude site
(`g.gain.exponentialRampToValueAtTime(vol, t + 0.004)` / `+ 0.003`). Both
become `vol * sfxVol`; `g.connect(c.destination)` is not touched at any of the
~2 dozen call sites. `tests/music.test.mjs:496-529` ("sfx routes
direct-to-destination", `sink(s.g) === ac.destination`) therefore **stays exactly
as written** — no renegotiation. An `sfxGain` node would fail that pin outright
and re-couple `duck()` to SFX; refused.

`sfxVol === 0` early-returns beside `muted` at the top of `voice()`/`noise()` —
`exponentialRampToValueAtTime(0)` throws, and zero volume means no node at all.

Music scales at the three sites that set or ramp `musicGain.gain`: the
`unlock()` init, `duck()`, and `toggle()`'s restore. Targets become
`Math.max(MUS_FLOOR, MUS_BASE * musVol)` and `Math.max(MUS_FLOOR, MUS_DUCK * musVol)`.

**Defaults are 100 / 100, not the 70 / 80 the brief suggested.** The shipped mix
IS the authored mix (`MUS_BASE 0.5` vs the per-cue SFX vols already carry the
music:SFX balance); any other default silently re-mixes the game and breaks the
`0.5 → 0.16` duck-ramp pins at `music.test.mjs:437-493`. At default settings
**every existing audio pin passes byte-identically** — that is the property that
makes this plan reviewable.

**CAMERA presets are persisted starting dolly positions, not new rigs.**
`el`, `az` and `target` never move: one authored 3/4 read, as frozen. `dist` is
already a live player axis — wheel/pinch dolly runs unguarded in GAME+3d,
clamped `DIST_MIN 560` / `DIST_MAX 1400` — so a preset is that same axis, made
discoverable and persisted. `createRig()` still returns exactly
`{az:0, el:0.54, dist:870, target:[0,-48,0]}`, so `three.test.mjs:154-189` never
moves. `main.js:129` already owns the rig object it hands to the wrapper, so the
preset is `rig.dist = CAM_PRESET[cam]` in main — no wrapper surface change (its
keys are pinned exactly) and no `createRig` parameter.

Measured against §4b's own projection (all 8 biomes, playfield corners + wall
tops, bezel at `RIM_W 36` / `RIM_LIP 6`, `PerspectiveCamera(45, W4/D4)`):

| Preset | `dist` | worst corner | ndc_y span | \|cy\| | **bezel** | verdict |
|---|---|---|---|---|---|---|
| `STANDARD` (default) | 870 | 0.9449 | 1.3786 | 0.0005 | **1.0974** | ≤1.10 ✓ (also clears both fill floors) |
| `WIDE` | 960 | 0.8322 | 1.2389 | 0.0096 | **0.9622** | ≤1.10 ✓ |
| `FAR` | 1040 | 0.7524 | 1.1368 | 0.0150 | **0.8673** | ≤1.10 ✓ |

Two rules, both checkable:

- **No preset dollies in.** Bezel is monotonically increasing as `dist` shrinks
  and 870 already sits at 1.0974 of 1.10 — `dist 860` scores 1.1148 and fails.
  Every preset is `>= 870`.
- **`FAR` stops at 1040** because it is the last 40-unit stop holding the worst
  playfield corner above 0.75 (1040 → 0.7524; 1080 → 0.7180 is a board in a
  void).

The two §4b **floors** (`worst >= 0.90`, `span >= 1.32`) bind the authored
default only, and `STANDARD` is that default. They exist to stop us *shipping* a
floating board; they are not a ceiling on where a player may dolly, which the
always-live wheel already proves (dolly to `DIST_MAX 1400` scores 0.5256 today,
unguarded). No new gate is invented here and none is relaxed.

**BRIGHTNESS is a uniform light multiplier.** `createLights(biome, k)` scales all
four intensities by `k`; `lights.js` exports
`LIGHT_BASE = Object.freeze({hemi:0.72, key:1.26, fill:0.54, amb:0.30})` so the
live path and the rebuild path read one table. Key:fill stays 2.3333:1 at every
`k` because it is a uniform scale. Never per-biome, never
`toneMappingExposure` — `NoToneMapping` is source-pinned at
`three.test.mjs:235-252` and ACES already cost us JUNGLE's red channel once.

Live apply rides the existing additive render opts, not the wrapper surface
(whose keys are pinned exactly): `o.bright = k`; the wrapper rescales the four
lights in place when `k` differs from the last applied value, and stores it for
the next `rebuild(world)`. `k = bri / 100`, so `k = 1.0` at default is a no-op
and the frozen recipe ships unchanged.

BRIGHTNESS is **3D only**. CLASSIC 2D blits the authored hex; a canvas filter
over it would regrade the same palette the 3D pass exists to match.

**REDUCE FLASH damps exactly one thing**, and one more toggle covers motion:

| Toggle | Seam | Effect |
|---|---|---|
| `REDUCE FLASH` ON | `getFlash()` returns `fx.flashT * flashK`, `flashK = 0.25` | the full-canvas `#ffe8a8` wash (`renderer.js:70-75`, `wrapper.js:139-145`) peaks at α `0.07` instead of `0.28` |
| `SCREEN SHAKE` OFF | `getShake()` returns `{x: shakeX*shakeK, y: shakeY*shakeK}`, `shakeK = 0` | 2D `ctx.translate` and the 3D `lookAt` offset both go still |

One new module seam: `setFxOpts({flashK, shakeK})` in `fx.js`, defaults `1`/`1`,
applied **inside the two existing getters** so both render paths and both
call sites are covered without touching either draw site.
`three.test.mjs:186-188` (`applyOrbit` shake) passes an explicit shake object,
so it is untouched.

Scope of the flash damp is exact and complete: `fx.flashT` is set to `1` by the
`boom` event only, decays at `dt*3.5`, and is read at those two sites and
nowhere else. Nothing else in the game paints a full-screen luminance change.
Particles, confetti and boom tints are unaffected — they are not flashes.

### 3. Pause menu

`world.state === "PAUSE"` stays a world state. It never becomes a `SCREEN`.
The shell stays `GAME` throughout, which is what keeps the room's track
playing, the HUD gate open, the touch gate honest and every
`screen === SCREEN.GAME` guard true.

The overlay becomes a real list, navigated with the same keys as every menu:

```
PAUSED
  ▸ RESUME
    RESTART
    OPTIONS
    QUIT TO MENU
  ↑↓ SELECT · ENTER CONFIRM · P RESUME · M QUIT
```

| Row | Action |
|---|---|
| `RESUME` | `world.state = "PLAY"` |
| `RESTART` | today's `#btnRestart` wave — `loadLevel(world,1,false)`, score 0, `state="PLAY"` — **preceded by `persistScore()`**. The toolbar's silent score loss was an accident of the button, not a decision; two adjacent rows must not have different score semantics |
| `OPTIONS` | `app.pauseView = 1` (inline, below) |
| `QUIT TO MENU` | today's `KeyM` wave verbatim: `persistScore()` → `quitToMenu("PAUSE")` → `world.state="PLAY"` |

New app fields: `pauseCursor` (0–3) and `pauseView` (0 list / 1 options), both
reset to 0 on every `PLAY → PAUSE` edge. `update(dt, input)`'s `SCREEN.GAME`
branch stops early-returning unconditionally: when `worldState === "PAUSE"` it
runs the same repeat/cursor machinery against the pause list (or the settings
rows when `pauseView === 1`); when `PLAY` it keeps today's reset-and-return so
menu repeat state can never leak into play.

**OPTIONS from pause is an inline page, not a screen jump.** Jumping to
`SCREEN.SETTINGS` would flip `musicCue(screen, level)` from the room's biome
track to the menu track mid-run, hide the touch pad, close the HUD gate and
falsify every `screen === GAME` guard — for a page the player will close in
four seconds. `pauseView = 1` swaps the overlay's contents for the same nine
settings rows, drawn by the same `drawSettings` body, adjusted by the same knob
code. One implementation, two hosts.

Routing: `drawShell` stops returning early for `SCREEN.GAME` — it now draws the
paused OPTIONS page (`drawDim(0.72)` + `drawSettings`) when
`world.state === "PAUSE" && app.pauseView === 1`, and returns as before
otherwise. That keeps all shell chrome routing in the one module whose job it
is. It measures against `overlayBox(kind)` (below), the same box the pause list
uses — not `dims(canvas, kind)` — so list and page never disagree by a pixel.

`drawOverlay` gains a 7th arg `ui` (`{view, cursor}`, default `{view:0,cursor:0}`),
threaded from `o.pause` by both renderers. `view === 1` paints the veil only and
returns, so the settings plate never lands on top of a live `PAUSED` headline.
The `WIN` and `LOSE` branches are untouched — only `PAUSE` changes.

Pause-list geometry, in `overlayBox` space: `PAUSED` headline at `cy - 70`,
`PAUSE_ROW_H = 26`, row 0 centred at `cy - 30` (so rows sit at `cy - 30`,
`cy - 4`, `cy + 22`, `cy + 48`), cue line at `cy + 86`. That spans `cy - 70` to
`cy + 86` and clears both boxes (`520` tall: 190 → 346; `352` tall: 118 → 274).

`onPause` (`main.js:284`) gains one guard: **when `app.pauseView === 1`, `P` /
`Escape` returns to the pause list and does NOT resume.** `KeyM` keeps working
from either view.

Touch on the pause list: `pauseHit(x, y, box)` — pure, exported from
`scenes.js`, reading the geometry above; hit band `|x - cx| <= 130` and
`|y - rowY| <= 13`, returns `-1` outside. A tap selects and confirms that row. `main.js`'s canvas `pointerdown` stops returning early in
GAME when `world.state === "PAUSE"`.

**Hit-test coordinate space is named, not inferred.** One exported helper
`overlayBox(kind)` in `scenes.js` returns the `{w, h, cx, cy}` that
`drawOverlay` is called with (`600×520` centred for `2d` and real `3d`;
`PROJ.canvasW/H`, `304,188` for `iso`), and it feeds **both** existing
`drawOverlay` call sites and both hit tests. Client→box conversion is the
`camrig.js:70-73` `ptOf` pattern — CSS `getBoundingClientRect` scale against the
overlay canvas, **never** `#gl`'s Retina drawing buffer, which the wrapper owns
and `sizeCanvases` must not read.

`overlayCue(world)` for PAUSE becomes exactly:

```
↑↓ SELECT · ENTER CONFIRM · P RESUME · M QUIT
```

### 4. Chrome removals

| Chrome | Verdict | Replacement |
|---|---|---|
| `#hud` strip (`index.html:97-104`) | **keep**, gated | `hudEl.hidden = app.screen !== SCREEN.GAME` once per frame in `loop()`; PAUSE/WIN/LOSE are `world.state` so GAME already covers them. Full opacity, not dimmed — it is DOM outside the canvas, nothing overlays it. Also pass `{hud:false}` for every non-GAME render so `updateHud` stops writing the frozen backdrop's zeros. |
| `#controls` toolbar (`:111-116`) | **remove**, after absorption | `#btnPause` → `P`/`Escape` + the touch pill · `#btnRestart` → pause `RESTART` (its only home anywhere) · `#btnMenu` → pause `QUIT TO MENU` + `KeyM` · `#btnSound` → OPTIONS `SOUND` row, reachable mid-run through pause OPTIONS. The `Source` anchor **stays** as a menu item (`SOURCE`), not as page chrome. `src/app/toolbar.js` and `setBtn` are deleted with it, and the four `setBtn("btnPause",…)` call sites in `main.js` go with them. |
| `.hint` legend (`:118-123`) | **remove** | HOW TO PLAY (identical rows, with icons) + the ghost coach on first run + the OPTIONS CONTROLS note. No test asserts on this markup. |

Audio unlock survives: `main.js:330-337` binds `keydown`/`pointerdown` on
`window` with `{once:true}`, so canvas and `#stage` gestures unlock identically.
The toolbar was never the unlock path — its documented role was only that it
sits *outside* `#stage` so a click there does not exit ATTRACT.

**Touch pause pill**: a third child of `#touchpad`, `#tpause`, 44×44 (the
minimum comfortable target; `#tbomb` is 72, `#tpad` 128), `border-radius:50%`,
`top:10px; right:10px`, same `var(--panel)` styling as its siblings,
`role="button" aria-label="Pause"`, glyph = two 4×14 bars via `::before`/`::after`
(no canvas). It inherits `#touchpad`'s `pointer-events` discipline.

`touch.update(inGame)` becomes `touch.update(inGame, playing)`: the box hides
outside GAME as today, and **`#tpad` + `#tbomb` additionally hide whenever
`world.state !== "PLAY"`** while `#tpause` stays. Otherwise the 128px move pad
and 72px bomb button swallow taps aimed at pause-menu rows in the same corners.

## ABI renegotiation

| Site | Today | New | Plan |
|---|---|---|---|
| `menuapp.js` `SCREEN` | `…ENEMIES:9` | `+ SETTINGS:10` (appended) | S2 |
| `menuapp.js` `ITEMS` | 9 entries | 8 entries, §1 table | S2 |
| `menuapp.test.mjs:54-64` | `length===9`, `ITEMS[0/5/6/7/8]` | `length===8`, `[0]=PLAY`, `[2]=OPTIONS`, `[7]=SOURCE` | S2 |
| `menuapp.test.mjs:281-390` | cursor 1–8 dispatch | §1 cursor 0–7 table | S2 |
| `menuapp.test.mjs:1025-1075` | `togT` at cursor 2/3 on MENU | `togT` on SETTINGS knob change | S2 |
| `menuapp.test.mjs:1077-1121` `want` map | RENDER/SOUND rows | `OPTIONS → SCREEN.SETTINGS` | S2 |
| `menudraw.js` `drawMenu(c, ui, …)` | `ui.togT` flash | arg dropped | S2 |
| `menudraw.test.mjs:135-183` | `drawMenu` toggle-flash | same assertions against `drawSettings` | S2 |
| `menudraw.test.mjs:83-133` | smoke every `draw*` | `+ drawSettings` at 600×520 and 608×352 | S2 |
| `menudraw.test.mjs:185-434` §13c | per-screen chrome fit | `+ drawSettings` vs `plateOf`, both sizes | S2 |
| `menudraw.test.mjs:627-662` | source regex on `shellview`/`main` wiring | `+ CACHE_NAME` kicker wiring | S2 |
| `scenes.js` `drawOverlay(c,world,w,h,cx,cy)` | 6 args | `+ ui` 7th (`{view,cursor}`) | S3 |
| `heat.test.mjs:64-65` | `overlayCue(PAUSE).includes("M / MENU")` | exact match on `↑↓ SELECT · ENTER CONFIRM · P RESUME · M QUIT` | S3 |
| `headless.test.mjs:438-465` | HUD default-writes / `{hud:false}` | `{hud:false}` on every non-GAME screen + `#hud.hidden` gate pin | S3 |
| `headless.test.mjs:467-508` | F3 toolbar GAME-gates | **deleted** with `toolbar.js`; replaced by pause-list dispatch pins | S3 |
| `headless.test.mjs:510-563` | toolbar Menu-button wave | same wave asserted through pause `QUIT TO MENU` | S3 |
| `headless.test.mjs:890-897` | `mountToolbar`/`setBtn` DOM-less no-op | **deleted** | S3 |
| `coach.test.mjs:239-272` | toolbar `Restart` reloads L1, held fire plants no bomb | same two assertions through pause `RESTART` | S3 |
| restart score edge | `#btnRestart` drops the run's score silently | pause `RESTART` calls `persistScore()` first | S3 |
| `touch.test.mjs` | no pause pin | `+ #tpause` mount + `update(inGame, playing)` visibility | S3 |
| `src/pwa/shell.js` `SRC` | — | `+ ./src/app/settings.js` | S1 |
| `CACHE_NAME` / `sw.js` `REV` | `fusegrid-shell-v41` (moves under us; read it, do not assume) | +1 per plan from whatever is current, both files in the same commit | each |

**Does not move.** `three.test.mjs:154-189` (bare `createRig()` still returns
`el 0.54 / dist 870 / target y -48`), `:191-233` (§4b gate, unchanged subject),
`:235-252` (NoToneMapping, no fog), `:320-375` (orbit flag + `KeyR` — `KeyR`
restores the authored rig then re-applies the preset, which at the default
`STANDARD` is 870 exactly), `:1367-1380` (`RIM_W 36`), the wrapper's exact
surface keys, `music.test.mjs:496-529` (SFX direct-to-destination) and
`:437-493` (duck ramps, byte-identical at default volumes),
`menuapp.test.mjs:42-53` (`BOOT..GAME` 0–6) and `:888-897`
(`ATTRACT/ITEMS/ENEMIES` 7/8/9), `pwa.test.mjs:319-332` (index.html manifest /
og:image / no root-absolute hrefs — the removed toolbar and hint touch none of
them).

## Refuse

Keybind remapping (one input scheme, no gamepad — remapping earns its keep when
there are two schemes to reconcile). Colorblind palette modes (foe identity is
already silhouette and value, never hue). Graphics quality tiers (one frozen
recipe, one `<=500` draw budget — there is no ladder to expose). A
pending-changes / apply / restart-required flow (nothing here reinitialises a
device). Free orbit as a setting (`?orbit=1` stays a dev flag). Per-biome camera
or light tables. A second light recipe or a second user multiplier. A master
volume above only two children. An `sfxGain` node. `toneMappingExposure`. A
CREDITS row separate from SOURCE. A HELP hub screen. Moving pace off LEVEL
SELECT — it is a per-run parameter paired with heat and pact, not a preference.
Any settings value reaching `step()`. Portal SDKs, accounts, cloud save.

## Ship order

**S1 — settings store + live knobs.** `src/app/settings.js` (`nb.settings.v1`,
clamps, defaults), audio volume scaling in `voice`/`noise`/`musicGain`,
`setFxOpts` in `fx.js`, `LIGHT_BASE` + `createLights(biome,k)` + the `o.bright`
live path, `CAM_PRESET` and the `rig.dist` application in `main.js`. No UI. At
defaults nothing changes on screen or in the mix. `SRC` += `settings.js`,
`CACHE_NAME`/`REV` +1 (`v42` from today's `v41`).

**S2 — OPTIONS screen + menu IA.** Needs S1 (there must be knobs to bind).
`SCREEN.SETTINGS`, the 8-row `ITEMS`, `drawSettings` + `settingsHit`, shellview
routing and the `CACHE_NAME` kicker, knob nav on the app, load/save wiring.
`CACHE_NAME`/`REV` +1 (`v43`).

**S3 — pause menu + chrome removal.** Needs S2 (it hosts that same page
inline). Pause list + `pauseView`, `overlayBox`/`pauseHit`, `drawOverlay`'s `ui`
arg, the `onPause` guard, `#hud` gate, toolbar + legend deletion, `toolbar.js`
removal, `#tpause` pill, `touch.update(inGame, playing)`.
`CACHE_NAME`/`REV` +1 (`v44`).

## Tests

`node --test` only, per plan:

- **S1** — `settings.test.mjs`: defaults, every clamp edge, corrupt/partial/
  non-object JSON self-heals, Map-store round-trip. `music.test.mjs` additions:
  `sfxVol 0` creates no node, `sfxVol 0.5` halves the ramp peak, `sink(s.g)`
  still `ac.destination`, music targets scale and floor at `MUS_FLOOR`, and the
  existing duck block passes untouched at defaults. `fx` additions:
  `setFxOpts` defaults are `1`/`1`, `flashK 0.25` quarters `getFlash()`,
  `shakeK 0` zeroes both `getShake()` axes. `three.test.mjs` additions: the §4b
  projection re-run for `WIDE 960` and `FAR 1040` asserting `bezel <= 1.10`, a
  guard that every `CAM_PRESET` value is `>= 870` and inside
  `[DIST_MIN, DIST_MAX]`, bare `createRig()` unchanged, and `createLights(b,k)`
  scaling all four `LIGHT_BASE` intensities with key:fill still 2.3333.
- **S2** — `menuapp.test.mjs` rewrites per the ABI table, plus knob clamp/wrap/
  cycle, `RESET DEFAULTS`, 3D-only rows rejecting adjust in 2D, and
  `settingsHit` row/miss boundaries. `menudraw.test.mjs`: `drawSettings` smoke
  at both sizes, §13c chrome fit against the layout table above, toggle-flash.
- **S3** — pause-list dispatch (each row's wave, including the score-record
  parity `QUIT TO MENU` inherits from `KeyM`), `pauseView` guard on `onPause`,
  `pauseHit` boundaries in both `overlayBox` kinds, `overlayCue(PAUSE)` exact
  copy, `#hud.hidden` gate, `touch.update(inGame, playing)` visibility matrix,
  and `pwa.test.mjs` still green on the shrunken `index.html`.

Visual 3D feel is not covered by Node. One headed pass at the end
(`npm start`, and unregister the service worker + delete its caches first — a
stale SW serves pre-change bytes and looks exactly like a change that did not
land):

1. MENU shows 8 rows, no HUD strip, no toolbar, no keyboard legend under the
   canvas.
2. `OPTIONS` opens; all nine rows visible and readable at both 2D (600×520) and
   REAL 3D (608×352) without the plate clipping.
3. `MUSIC` and `SFX` move the mix live; `SOUND OFF` silences both; `SFX 0`
   throws nothing in the console.
4. `RENDER` flips 2D ⇄ 3D live; reload keeps the choice; `?render=3d` still
   overrides it.
5. `CAMERA` STANDARD → WIDE → FAR visibly pulls back with the whole board and
   the cabinet bezel still on screen at every stop.
6. `BRIGHTNESS` 70 → 130 lifts the 3D board without washing JUNGLE's floor or
   lightening CLASSIC 2D; the rows read `—` and reject adjust in 2D.
7. `REDUCE FLASH` visibly damps the boom wash; `SCREEN SHAKE OFF` stills the
   board in both kinds.
8. `P` mid-run shows the pause list; every row does what it says; `OPTIONS`
   opens inline with the room's music still playing; `Escape` there returns to
   the list, not to play.
9. On a touch device: the pause pill pauses, the move pad and bomb button
   disappear while paused, pause rows and settings rows respond to taps, and a
   tap outside the rows backs out.
10. Reload: every setting persisted, high scores / plaques / pact unlock
    untouched by `RESET DEFAULTS`.
