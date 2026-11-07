# AGENTS.md

## Project

Fusegrid ("rollblock") — a modular, deterministic arcade game.
Public GitHub is https://github.com/HMarzban/fusegrid. In-game wordmark is
FUSE/GRID; the local folder stays `rollblock`.
Pure ES modules. **Zero `package.json` runtime dependencies.** The sim is
framework-free so it runs identically under Node (tests) and the browser.

The product path is three RENDER looks, **CLASSIC 2D → PIXEL → REAL 3D**
(shell v178, 2026-10-11; CLASSIC 2D stays the default). Three.js r160 is **vendored**
(`vendor/three.module.js`, MIT, relative import — not an npm dep), loaded only
for REAL 3D, never on the CLASSIC or PIXEL path. The 2026-08-16
"no Three" lock applies to the **sim** only; the render layer reversed it.

This is a **single-player** game. Lockstep is a local two-world **harness**, not
internet play. Do not swap `WebSocketTransport` in and call it multiplayer —
`step()` only consumes `inputs[0]` / `players[0]`.

## Architecture

Single thread, three stages: `input → sim → render`.

Two state machines:

| Layer | States | Owner |
|---|---|---|
| Shell | INTRO (title → show) → MENU ⇄ LEVEL/SCORES/SETTINGS(→GRAPHICS)/GUIDE(→HOWTO/ITEMS/ENEMIES/FLOOR)/STATS(→TROPHIES) → GAME; idle → ATTRACT | `src/app/menuapp.js` |
| Sim | PLAY / WIN / LOSE / PAUSE | `src/core/sim.js` |

INTRO is two phases inside one SCREEN (`app.introStage` 0 title / 1 show),
never a new SCREEN value. The title waits silently for a press; the first
press that leaves the AudioContext running starts the menu track, the
`uiJingle` sting and a 32-step (4.384 s) show; the show bomb's `boom` (not the
clock) lands MENU at cursor 0. Every visit, the first included (ruling
2026-10-09, reverses first-visit Play Now). Deep links and autoplay bypass it.
Gestures go through the gated `skipShow()` (no-op on the title and inside the
0.2 s `SKIP_GUARD`); `skip()` stays the ungated programmatic jump to MENU. The
show world is its own throwaway (`src/app/intro.js` `createShow`/`stepShow`,
main's `let show`, never `demo`), backs MENU after the reveal and is dropped
for good at GAME / ATTRACT. In 3D the title paints an opaque veil until three
settles (`app.boardReady`, set on resolve or reject).

Heat grades CORE / PLUS / MAX live on LEVEL SELECT (`←/→` room, `↑/↓` heat). CORE is replay baseline v6. Attract is always CORE + pact=0. After a first FUSE/GRID CLEAR, LEVEL SELECT also offers Pact toggles (`1–4`). Knobs live on `world`, not frozen `CFG`. Score × heat is persist-only (CORE ×1 / PLUS ×2 / MAX ×3); live HUD stays raw.

MENU is eight rows in this order: `PLAY, LEVEL SELECT, DAILY, OPTIONS, GUIDE,
HIGH SCORES, STATS, SOURCE`. `confirm()` dispatches by **label**, so an insert
moves no runtime index — but `tests/headless.test.mjs`'s index-driven MENU
confirms and `tests/menuapp.test.mjs`'s literals must be renegotiated with any
reorder.

Menu look (owner pick 2026-10-19, direction A "CONSOLE PANEL"): MENU, the
PAUSE list and every plated page share ONE kit in `menudraw.js` — `plate`
(one 0.94 fill, one `#2a3550` border, radius 6, even-px snapped), `head`
(sans title, muted spaced kicker), `foot`, and `paintRow` (selected = 0.12
band + 3px notch + caret; `danger` rows select red). Labels are system-ui
sans (OS-dependent, owner-accepted), values / tags / hints mono. Lists go
through `listGeom` / `listHit` (pitches are caps that scale down in a short
box); MENU has a PLAY hero row whose tag is the run it starts and group gaps
before OPTIONS / HIGH SCORES / SOURCE; the SOURCE URL shows only on its
selected row. Build tag (owner 2026-10-21: "a game version in some where in
the display or menue"): `v201` (today) = `CACHE_NAME` minus `fusegrid-shell-`,
derived ONLY in `shellview.js` (`REV`, handed to `drawMenu` / `drawSettings`
as `rev`) and `update.js` (the card's "You are on v201", the running build,
never a guessed next one) — never a second literal. Keyboard MENU appends
it to the foot hint; the touch hub hangs it under the plate when the box has
>= 10 units below it (`#sh`), else on the SOURCE tile's teaser (landscape on
the board canvas); OPTIONS keeps its `BUILD v201` kicker. Never on the HUD.
PAUSE draws `pauseGeom(overlayBox, touch)`: touch (`touchLay`,
data-lay p/l) caps pitch at `PAUSE_ROW_H` 70 / hero 76 / width 380, a keyboard
screen at the compact `PAUSE_ROW_D` 44 / hero 54 / width 340 (owner: "too
fat"); `pauseHit` takes the same flag. RESUME hero, RESTART/QUIT danger,
kicker = room · biome · heat · pace, cue `ESC · P RESUME · … · M QUIT`.
Touch rule: a tap on a row = Enter on it; keyboard MENU and PAUSE bands span
the full stage width (the touch MENU hub's tiles own half of each gutter);
off the rows a root list (MENU, PAUSE list) does nothing; on a page
(OPTIONS, GRAPHICS, GUIDE, LEVEL SELECT, SCORES) a miss ON the plate is inert
(hit -2) and only a tap OFF the plate backs out (-1). `guideHit`,
`levelHit` / `levelGeom` and `scoresHit` share the geometry their pages
draw. Hints follow `data-lay` (keys vs taps; LEVEL SELECT's touch foot is
`LEVEL_TAP`). Touch-portrait SHELL BOX (owner GO 2026-10-19, shell v181): the board
stage is width-bound (~0.63 on a 393 px phone), so MENU and every plated page
(`isShellScreen`, shellview) draw on `#sh`, a fixed canvas over the whole
viewport at ~0.9 (`fit.js` `shellGeo` / `PORT_SHELL {s 0.9, w [400,600],
logo 0.27}`; a tablet keeps 600 wide and only grows taller; < 520 box units
tall = no shell box). INTRO, ATTRACT and GAME (PAUSE, WIN/LOSE) stay on `#c`,
and `#c` / `#gl` / `#px` never see the box, so no renderer changes.
`fit.shell(on)` shows + clears `#sh` (device-density backing, cap 3,
smoothing off) and returns `{ctx, box}`; `box` is the logical canvas
stand-in (`width/height/logo`, its rect) that `drawShell` measures and the
one pointer handler (bound on `#c` and `#sh`) maps through, so a tap lands
where it is drawn. `layout(W,H,lg)`: `lg` = the centred board's 0.27 logo
line in box units (MENU's logo stays on the board; the hub hangs under it),
`tall` / `narrow` (< 560) flags; narrow re-flows: `levelNarrow` (card under
the grid, HEAT / PACE rows, digit-free touch MODES chips, 2-line help), HOW
TO stacked rules, ENEMIES 2 cols, MEDALS 1 col, SCORES tab width, 11px hub
teasers; STATS is centred (not floor-pinned) in a tall box. LEVEL / HIGH SCORES chip
taps are ONE call through the cued key path (`app.move` with a delta,
`app.adjustPace`), so a change plays one `uiMove` and the chip already set is
silent; `[ ]` pace keys cue too.

Menu pages (owner pick 2026-10-19 round 2, direction B "ATLAS", over the
CONSOLE PANEL skin; owner: "why all buttons are soo fat", "make the select
lever more intractive", "put hooks … to see what we deliver"): pick on the
left, see it on the right. Every plate HUGS its content through `pageBox`
(band keyboard 73..492 / touch 8..512; pitches are caps, scale only in the
iso 608x352 guard; `shellBox` is gone, no page divides its band by a row
count). Pitches: list 26 keyboard / 52 touch, OPTIONS 27 keyboard (37 touch, 34 where 37 does not fit), GRAPHICS 28, hero
40 / 70. LEVEL SELECT (`levelGeom(L, unlocked, touch)` = draw + tap): a 4x2
grid of room tiles (biome schematic, finale pip, ✓ when a time is saved at
this heat/pace/modes; 6–8 dim + locked until the first CLEAR, a locked tap
returns `{k:"lock"}` and only flashes CLEAR ROOM 5 TO OPEN, never sets
`app.level`) beside a ROOM CARD pane (world name, schematic, YOU'LL MEET from
`heatRoster` with FOES names ×n, BEST time (NO TIME YET only once TIME is open, `d.open`; never on DAILY) via the `getCab`
getter, `LIVES · FUSE · SCORE ×n` from `heatProfile`/`applyPact`, pulsing on a
heat change); then HEAT | PACE segments, MODES (IRON BARE THIN SHRINK + TIME,
help says what each does), and a START hero. No start-on-miss: only START or
Enter starts. MENU keyboard: a 272 list beside a preview pane that follows
the cursor (one mini-page per row); MENU touch: a tile HUB in the pinned
reading order (PLAY bar, LEVEL SELECT | DAILY, OPTIONS | GUIDE, HIGH SCORES |
STATS, SOURCE 50 logical = 32 CSS px) — the one MENU idiom whose bands are
tiles, not full-width rows; ↑↓ stays the linear walk. One vocabulary: MODES
(never PACT) on screens and in copy; pact.js and `nb.pact.v1` keep their
names. Hooks never lie: a score teaser reads only played runs
(`highscores.isPlaceholder` drops the seeded table; main hands `getCab().top`),
and DAILY says YOUR TRIES TODAY. Read-only pages (HOW TO / ITEMS / ENEMIES /
FLOOR / MEDALS) back out on any tap; STATS taps its foot labels. PLAY's tag names the
world (`FACTORY · MAX · HARD`), the same words as START. `SCREEN.STATS = 12` is **appended** (the `SCREEN` enum's own rule in
`menuapp.js`: appended, never inserted). `SCREEN.TROPHIES = 13` (the MEDALS page) is
appended too: opened from STATS by `T` or a tap on its `T MEDALS` label, backs out to STATS,
never a MENU row. `SCREEN.GRAPHICS = 14` is appended too: opened by the
OPTIONS `GRAPHICS` door row (`OPT_ROWS` twelve rows, ANALYTICS, then the GRAPHICS and CONTROLS doors
before RESET DEFAULTS), backs out to OPTIONS on the door. `SCREEN.FLOOR = 15` is appended too
(2026-10-25): the fourth GUIDE door (`GUIDE_ROWS` HOW TO PLAY, ITEMS, ENEMIES,
FLOOR; keyboard GUIDE is a 2x2 of doors, touch four stacked rows), backs out to
GUIDE. `drawFloorHelp` lists the eight floor tiles at CORE / PLUS / MAX in the
current look (`featdraw.drawSpec`, PIXEL `atlas.feat`), each with its rule line
(`TILE_HELP`). `SCREEN.CONTROLS = 16` is appended too (v201): the OPTIONS `CONTROLS` door row, backs out to
OPTIONS on the door; see the CONTROLS paragraph under `src/`.
The GUIDE pages and the MENU preview draw the live foe and pickup animation
(CLASSIC: `drawEnemyBody` / `drawItemBody`; PIXEL: `hudart.js` `foeAnim` /
`itemAnim`, a pure function of the page clock). From PAUSE the same page is
inline `pauseView 2` (0 list / 1 OPTIONS / 2 GRAPHICS / 3 CONTROLS; Esc steps 2 → 1 and 3 → 1, onto
the door), never a SCREEN. WIN/LOSE run summaries are **not** a SCREEN — they
live in `drawOverlay`.

The sim ticks only while the shell is GAME. PAUSE/WIN/LOSE are `world.state`,
not shell screens. Do not add them as `SCREEN` values.

- `src/main.js` — **browser entry only**, pinned `<=799` lines
  (`tests/headless.test.mjs`; raised 808→812 once in wave 3 for `ro.ghost`,
  tightened to 799 when C2 moved `fit()` out; 733 by split-length at v178 after
  GRAPHICS moved the frame gate and renderer cache out; 784 at v201). RAF loop, fixed-step
  accumulator, kind switch, and the handler wiring that binds them. Never
  imported by sim or renderer. Its seams live beside it and must stay OUT of
  `main.js`: `src/app/flags.js` (URL/opts, pure over a search string),
  `src/app/attract.js` (demo world + `stepDemo`), `src/app/frameloop.js`
  (`mountFrames`: the rAF owner, frame gate, knob push), `src/app/rcache.js`
  (`mountRenderers`: per-kind renderer cache, lazy/eager three, release),
  `src/app/audiopower.js` (`mountAudioPower`), `src/app/renderkind.js`
  (`bootRender` / `kindOf` / `renderVal` / `renderBits`),
  `src/app/controlswire.js` (`mountControls`, v201: binds `gamepad.js`, `padroute.js`, `capture.js`, `controlspage.js`, `controls.js`, `hints.js`, `rumble.js` and render's `controlsgeo.js`, `controlsdraw.js`, `padart.js`, `hintcopy.js` to main, frameloop and unlock; see the CONTROLS paragraph), `src/app/debughook.js`
  (`window.__GAME__`), `src/app/endkeys.js` (WIN/LOSE keys: Enter =
  Space through `Input.pulse()`, one fire tick and never a latch; C/B copy.
  Every copy reports COPIED / COPY FAILED through the ONE `app.toast` — on
  the WIN/LOSE overlay, and on STATS in place of the `YOUR CABINET` kicker;
  `toastTick(toast,world,dt,app)` ages it only there and zeroes it anywhere
  else), `src/net/localpair.js` (`?net=local`),
  `src/render/shellview.js` (`drawShell` + the `kindSize`/`dims` logical box),
  `src/app/update.js` (`mountUpdate`: registers the SW and owns the NEW
  VERSION READY card; `U` is its key, live only while the card shows),
  `src/app/loadbar.js` + the `#load` plate and inline `#loadjs` script in `index.html` (the honest loading bar, v197: finished files against totals `tests/loadbar.test.mjs` pins to the real graphs, `--write` re-pins; indeterminate when there are no numbers, shown after about 150 ms, a failure card with RETRY / USE CLASSIC 2D; `rcache.js` paints it before a lazy look's fetch and bake; `#wrap` stays hidden until the title paints; `armUnlock`'s `skip` keeps the card's buttons from pressing the title),
  `src/app/fit.js` (`mountFit`: stage scale per layout reserve `FIT_RES`, and
  `body[data-lay]` = `d` desktop / `p` touch portrait / `l` touch landscape —
  the ONE predicate `index.html`'s touch layout keys off, never a media
  query; re-fits on `resize` and `orientationchange`). Portrait (`p`) only:
  pure `portraitGeo(W,H,cw,ch,game)` (`PORT_GEO`) centres the stage in the
  vertical slack (clamped 60 top / 190 bottom) and docks a grown pad
  (128–176) + bomb (9/16 of the pad) 24px above the bottom, written as
  `--st/--tp/--tb/--tpt/--tbt` on `body.style`. While `#touchpad` shows
  (GAME only; a `MutationObserver` on its `hidden`), `game` lifts the stage
  to `min(centred top, PORT_GAME.top 72)` under the pause pill, pad cap 184,
  and `--sd` 0.2s glides that edge only (0s on resize / rotation).
  INTRO/MENU/ATTRACT keep the centred stage; `d` / `l` are untouched.
  `shellGeo` sizes the touch-portrait shell box `#sh` (see Menu look).
- `src/core/` — deterministic simulation, no DOM, no browser globals.
  - `world.js` — `createWorld`, `loadLevel` (re-exported from `sim.js`).
  - `sim.js` — `step(world, dt, intents)`.
  - `config.js` — frozen `CFG`, `T`, `BIOMES` (array frozen; **entries are not**).
    Eight looks: JUNGLE, ICE, FACTORY, WATER, ARENA, then SAND, VOID, CROWN
    (rooms 6–8 after first CLEAR). One chiptune theme per look.
    Room policy: `ROOM_LOCK=5`, `ROOM_MAX=8`, `isFinale`, `roomCap`
    (L5 and L8 finale; L6/L7 advance). Overlay must use the same `isFinale`
    predicate.
  - `heat.js` / `pact.js` — heat tables + bitmask/`applyPact`. Persist is
    `src/app/pactstore.js`, not `src/core`.
  - `board.js`, `entities.js`, `rng.js` — sim support. `rng.js` also owns
    `runSeed(bootSeed, i)` (#10, pure fmix32; run 0 = `bootSeed`).
  - Boards by generation (`world.gen`, set by main, never reset by
    `loadLevel`): **1** = `board.js` `genBoard` (the original lattice; F1
    codes, ATTRACT, the intro show, Node worlds by default), **2** =
    `board2.js` `genBoard2` (the 14 BOLD layouts, #12: every ordinary run and
    the DAILY from v188 to v197, F2 links), **3** = gen 2 + the `world.feat` floor-tile layer
    (`genBoard2(…, {feat:true})`, every ordinary run and the DAILY since v198, owner
    2026-11-02, playtest waived; O2 2026-10-26: an F2 code is always tile-free; gen-3 room 5
    re-rolls the layout on ~8 % of seeds, when it cannot place 3 SHRINK-safe
    traps, #22). Gen 2: a layout
    keyed `(seed, room, attempt)` (template, stamps, flip; CROWN V or 180
    only) and a fill keyed `(seed, room, heat, attempt)` that moves bricks
    only, on a ceiling of the gen-1 brick count minus 17 (JUNGLE minus 6);
    then `fair.js` `validateBoard` gates it: 8 layouts, the first valid one
    gets 8 fills, then the FAIR fallback (`stampStart(genBoard(…))`, sealed,
    counted), never the raw gen-1 board. Templates are the layouts appendix
    byte for byte except CROWN THRONE / COURT (`TPL_EDITS`): the V10
    occlusion probe at rig C failed even with interior E-W walls capped at
    `NEAR_H` (MAKO 89.9%), so their E-W walls were re-authored N-S like VAULT
    (THRONE is now a walled hall; owner accepted it from the contact sheet, 2026-10-26) and
    `EW_CAPPED` is empty. Gen-2 foes: `fair.js` `placeFoes` gives each roster
    entry the first free tile (loadLevel's shuffled list, `SPAWN_CLEAR` kept)
    at walking distance >= 10 with bricks passable, >= 12 for hunters (FAST /
    CHASER / KNIGHT) **and brick-passers** (PHANTOM / ROCKET / SHADE; lead
    ruling 2026-10-26, owner accepted: they walk through the seal bricks).
  - `featchecks.js` — the static tile checks V13–V27 (#18, moved from
    `tools/balance/`, which re-exports it; 48 KB, in the boot graph with `board3.js` (`genBoard3`, registers through `setGen3`) and `featplace.js` (`placeFeat`): `src/main.js` imports `board3.js`, Node code that skips main imports it itself, a gen-3 ask with the seam empty throws). V14 is fixed in
    `loadLevel`, gen 3 only (no item on a tile).
  - `fair.js` — pure `validateBoard(grid, level, heat, opts)` (#11) returning
    failed rule IDs: V1 reach, V2 safe first bomb (reach 1–10, PIERCE, LINE x4,
    slowest pace vs shortest fuse), V3 room fit, V4 foe distance, V5 bricks
    40–90 and >= 3 per buried item, V6 room 1 FLAME + BOMB, V7 4 SHRINK rings,
    V8 dead ends, V9 no (odd, odd) wall, V10 tall E-W walls (`EW_WALL_H_MAX`
    22 = `NEAR_H`, `EW_CAPPED` per biome), V11 re-roll budget / fair
    fallback, V12 finale mirroring, SEAL (the 9-tile spawn pocket leaks no
    EMPTY path; doors (5,1) and (1,5) are BRICK). Gen 1 fails SEAL and V4 by
    design; `tests/fair.test.mjs` pins its rates as golden numbers, never as
    gates. Offline: `tools/levels/fairsweep.mjs` (1000 x 8 x 3 per-rule
    table, variety floors) and `tools/levels/botsweep.mjs` (demobot, rooms 1–8
    x CORE/MAX, gen 1 vs gen 2); output in git-ignored `tools/levels/out/`.
- `src/render/` — reads world; drains `world.events` into fx/audio.
  - kind `"2d"` — classic Canvas (`createRenderer`). Do not statically import
    `vendor/three.module.js` on this path; lazy-load via `src/render/three/load.js`.
  - kind `"3d"` — `createRenderer3D` (`#gl` WebGL under `#c` overlay).
  - kind `"px"` — PIXEL, `createPixelRenderer` (`src/render/pixel/**`), its
    own factory modelled on the 3D wrapper, never a branch of `createRenderer`
    (the CLASSIC call-log hash is pinned in `tests/classic-perf.test.mjs` and
    `tests/pixel-render.test.mjs`, now `9fb48f0a:72431`: re-pinned by ruling
    for each 2026-10-21..25 art round, the diff proven to be the intended art;
    `97480c1c:22630` is the stale pre-round value). Beside it, `classic-perf`
    pins a named tile world through `classicHash`'s `opt` (gen 3, seed 4242,
    room 3 FACTORY CONVEYOR, CORE: `7e57d1aa:71503`, #35 / #18) and checks that
    nulling the tile layer moves it. See the PIXEL paragraph below.
  - kind `"iso"` — legacy dimetric (`r3d/`), pinned by `?render=iso` only.
    `createRenderer({kind:"3d"|"iso"})` is the **dimetric** branch. Real 3D
    never enters that factory. Menu RENDER cycles CLASSIC 2D → PIXEL → REAL 3D
    (row value 0/1/2, `renderkind.js`); iso is never on it.
  - PIXEL (owner GO 2026-10-10 "finish the job and not ask me anything";
    adviser-panel rulings: R17 / R20–R25 logged in the PIXEL plan §7.3, the
    rest (e.g. R16 PAUSE freeze, R19 HUD/GUIDE) in the panel brief;
    direction A BOLD, G0 pick). Persisted as `nb.settings.v1` `px` (with `r3d`: mutually
    exclusive, written together through one `onSettings(…,"render")`);
    boot precedence `?render=3d|px` > persisted `r3d` > `px` (`bootRender`);
    `?render=3d|px` only seed the boot, iso is pinned for the session.
    Art (255 cells since the foe/item round; was 165): manifest cells (`manifest.js`, derived from FOES / POWER /
    BIOMES / bomb kinds, so a new foe, pickup or biome without cells falls back
    visibly and `tests/pixel-art.test.mjs` fails on any silent fallback), all
    authored as palette-SLOT string grids in `art/*.js` (never hex; every hex
    is a verbatim repo hex via `palette.js`). Cells are 20×20 bar a few
    overlays (anchor = foot line), 1 art px = 2 logical px, board native
    300×260. Baked lazily on first px renderer
    creation, never at boot (R24: static import, lazy bake). Scale (R20):
    native → hi NEAREST at `M = clamp(ceil(k·z),1,8)` → `#px` once with
    smoothing on, so the soft edge is ≤1 device px below the cap (softer
    above it, disclosed). Camera/intro reach px through the overlay ctx's
    `getTransform()` (R23), zero main.js lines. `#px` has ONE owner (R25):
    `fit.js` snaps its CSS box and hands the backing over on `data-bw/bh`;
    only the px renderer assigns its backing (the `#gl` stomp lesson).
    Clocks are renderer-owned, PLAY/WIN/LOSE only (`timing.js` is the one
    ms/fps source); PAUSE freezes the board (R16). One-shots (`oneshot.js`,
    fixed pool) cover crumble / stun / corpse / materialize / death / win /
    reveal / slam / kick / throw / pickup sparkle; MAKO's show pop is the 3 materialize
    frames (R17, no stepped zoom). Ghost = MAKO frames at `GHOST_A` 0.4. HUD
    chips and GUIDE ITEMS/ENEMIES/HOW TO/FLOOR show the board's own cells
    (`hudart.js`, x1 in chips, x2 on a GUIDE page only if every cell fits;
    text stays the vector font). px JS cap **160 KB** uncompressed for the
    lazy tree (`tests/pixel-render.test.mjs`; R24's 120, then 122 on
    2026-10-11, 152 for the board look, 160 for the hand-drawn tiles; the tree
    is about 160 KB since the v189 lock-on chevrons; the owner raised the cap
    to 176 KB in shell v190, when 18 bytes were left, then to **192 KB** in v191
    (2026-10-26). The cap is a growth tripwire on the lazy tree: only PIXEL
    pickers download it (gzip ~0.28 of raw, so a full 192 KB is ~56 KB on the
    wire) plus the offline precache; it changes nothing on screen). Floor-tile cells are hand-drawn palette-slot frames in
    `pixel/art/feat.js` (CONVEYOR and STREAM assembled from hand-drawn parts),
    read by `featpx.js`. Since #15 (2026-10-25) the px tree
    is a dynamic import (`src/render/pixel/load.js`, `rcache.js` `load(k)`;
    `hudart.js` lives in `src/render/` and imports nothing), so CLASSIC
    visitors never fetch it; `tests/pixel-lazy.test.mjs` walks the boot
    graph. Never re-hue a hex to separate a sprite; never import
    `vendor/three.module.js` or `render/three` on the px path.
  - Live 3D default rig (polar `el` from +Y, ruling 2026-10-08, the user's
    pick C): `{az:0, el:0.66, dist:1503, target:[0,-17,0]}` through a
    vertical `CAM_FOV` 24 lens (`camrig.js`, the one lens source) — 52.2°
    above horizon, a readable 3/4. X binds the fit at EVERY elevation (always
    the near ICE wall-top corner). At ONE lens vertical fill DECREASES as the
    camera lowers, but fill vs elevation is FOV-conditional: C is lower than
    the old FOV 45 rig and fills MORE (54.2% vs 50.9%), because the narrow
    lens widens the near edge less (keystone far/near 0.807 vs 0.722). The
    lens is also what fixed "too top-down / skewed": FOV 45 put the near
    row's side:top at 0.339, below the rejected `el:0.419` security-cam
    (0.445); C reads 0.970 / 0.794 / 0.617 far to near, and §4b floors near
    side:top >= 0.55 and keystone >= 0.78. The fit basis is the PLAYFIELD
    (`|x|<=300`, `|z|<=260`, `y<=hWall`), NOT the decorative bezel, which
    may bleed about 7.5% past the two bottom corners the way a cabinet well
    runs off screen. Must frame the whole 15×13 board (all four corners + ICE
    tall walls); worst case ICE sits at `|ndc| 0.9397` and the board fills
    54.2% of the canvas. One global rig, never per biome; no follow-cam. A
    wheel/pinch dolly lives for one room: `dist` resets to the selected
    CAMERA preset at every room start, run start and pause RESTART (PAUSE →
    PLAY keeps it). Any text saying `el:0.54` / `dist:870` /
    `target:[0,-48,0]` / FOV 45 / `|ndc| 0.9449` / fill 50.9% / bezel
    `1.0974` / `CAM_PRESET [870,960,1040]` / `DIST 560/1400` / `el:0.62` /
    `dist:960` / `target:[0,-44,0]` / `|ndc| 0.913` / `el:0.419` /
    `dist:1000` / `el:1.152` / `dist:700` / `dist:800` is stale.
    Hazard: STANDARD sits at bezel `|ndc| 1.0746` against the `<=1.10`
    ceiling, and the dolly-in limit is `dist` 1473.54 — no preset may sit
    below 1503. Any camera/rig/lens/`RIM_W` change must re-run
    `tests/three.test.mjs` §4b first.
    Never assign `#gl.width`/`#gl.height` from `sizeCanvases` — wrapper owns
    the Retina drawing buffer (`setPixelRatio` + `setSize`). Stomping it
    crops WebGL to the bottom-left quarter on dpr=2.
  - Blasts (v3, 2026-10-10, `src/render/three/blast.js`): exactly TWO
    instanced draws whatever the blast count — an additive rounded danger
    plate per deadly tile (2D colour ramp, never shrinks, floor 0.25 bright,
    so it stays honest while blades are lethal) and lumpy icosahedron
    fireballs through one unlit ShaderMaterial (white-hot core, orange shell,
    red rim, per-instance `aLife` [age, seed], noise burn-away past `BURN_AT`
    0.55). Geometry and both materials are built once and `_shared` (a room
    rebuild never recompiles); uploads cover only the live instance range.
    At rig C near/E/W end caps stay inside their tile; the far cap (0.253)
    and an E-W arm's balls over the safe row north (0.310) stay < 1/3 tile
    (BL3); only the bomb tile's crown climbs higher. REDUCE FLASH (`flashK`)
    scales the <=3 flash PointLights. Fat-world stays 141. `atlas.fire` is
    gone; never crossed quads again.
  - No program compile on a room change (#36, v197): `three/progpin.js` pins compiled programs for the renderer's life (cap 96, released on a SHADOWS tier change, forgotten on context restore; it writes three's `usedTimes`, so it is tied to vendored r160), per-world values are uniforms, never a program key (`tests/program-share.test.mjs`), ambient and burst share one `_shared` material, world textures are kept per biome (`WORLDS_KEPT` 2) and the WIN overlay prepares the next room's. #36 stays open: no real phone measured.
  - The board border is ONE extruded cabinet rim (`tag:"trim"`, `RIM_W 36` /
    `RIM_LIP 6`) with a hole — never four rails, which crossed at the corners.
  - Walls follow the grid (shell v183, 2026-10-21): `scene.js` keeps a WALL
    mask beside the brick mask and refreshes the ONE wall InstancedMesh when
    the WALL set changes, so SHRINK rings draw in REAL 3D mid-room. Before
    v183 they were invisible while collision still blocked. A new board on
    the same room also redraws. Still one draw call; fat-world stays 141.
  - Near-wall cutaway (ruling 2026-10-09, the user's pick "lower the near
    wall"): the border row nearest the camera (`ROWS-1`, both corner tiles
    included) tops out at `min(hWall, NEAR_H)` with `NEAR_H 22`
    (`scene.js`), by per-instance Y-scale inside the ONE wall InstancedMesh —
    no new draw call, fat-world stays 141. The other three borders keep full
    `hWall`. Why: at rig C the ICE near row (36) left a row-11 actor 58–85%
    of its screen area and clipped eyes; 22 is the tallest height where MAKO
    keeps 100% and every foe keeps its eyes and >=90% of its screen area at
    its worst bob/spin phase (23 drops walker to 89 / shade to 88), and it
    stays above every `hBrick` (max 20). Only ICE / WATER / VOID / CROWN
    change. The rim stays one extrude at `hWall+RIM_LIP` everywhere: it
    occludes nothing in row 11 (rays pass >=27 units over the ICE lip).
    Render only — collision is untouched and CLASSIC 2D / iso have no such
    occlusion. §4b still fits to full `hWall` at the near corners, now a
    conservative bound.
  - Enemy bodies: one `ENEMY_3D[type]` row per foe, each exactly FOUR meshes
    (hull + two ref-swapped details + `eye_<type>` face plane), so
    `SLOT_MESH.enemy` stays 4 and fat-world stays 141. Parts are
    pre-transformed and fused by `mergeGeos` (variadic, and it synthesises an
    index because `ExtrudeGeometry` emits none) — never added as children.
    `lathe(pts,seg,r)` profiles run bottom -> top or normals invert; a radius
    that flares then narrows is a brow / warning band, which is how a
    one-material hull gets a two-tone read. Detail channel order is PER TYPE,
    not global (`stationary` keeps its magenta Basic core on `children[0]`
    because two tests pin it there; `walker` splits into mirrored halves so
    the alternating stomp keeps two transforms). `shade` is the only foe with
    `castShadow=false`; additive accents never cast.
  - Player body — **MAKO, the reef critter (2026-09-06, spec §2.7)**, still the
    LIVE hero. Owner ruling 2026-10-11 resets the hero DIRECTION (see the
    owner-pending note at the end): the next hero has a head, arms and legs, so
    the "no arms" rule below binds only the live MAKO until a new hero is
    built. Every
    humanoid hero was vetoed by the user ("the main character also must not be
    like a human, it must be a creative character"), so SIGNAL RUNNER and
    IONVEST are superseded and **2D and 3D share ONE character again, by
    design**: `PLAYER_HULL` and `PLAYER_SUIT` are the same hex `#c39cff`, both
    exported from `sprites.js`. Do not re-split them without a measured reason
    — the IONVEST split existed only because gunmetal died on FACTORY's wall
    in 2D and was still correct in 3D.
    Head and body are ONE mass: no shoulders, no torso-over-legs, no arms.
    That single rule is what all three previous heroes broke. The hook is two
    swept teal ear-fins whose tips run PAST the body's own half-width, so the
    outline is a CHEVRON — the one shape class no foe has, since every foe is
    a dome or a box. The face is two bulging cream `#f2e6d2` eyes that BREAK
    the crown of the silhouette, over a grin with two BLUNT teeth. Never
    fangs: hero, not monster. `p.color` lives on the fins and nowhere else, in
    both renderers.
    3D is still a FIVE-mesh stack — `SLOT_MESH.player` 5, fat-world 141 — with
    the SAME five geometry types, roles reassigned rather than added to:
    **Lathe = squat body** (`children[0]`, matte Lambert, the `p.passing`
    lerp target), **Buffer = merged ear-fin pair** (the one `p.color` mesh),
    **Extrude = face plate** (the one Phong, raked `-0.6` to face the rig,
    its own OUTLINE carrying the two eye lobes), **2 Box = feet**
    (`children[3]` still flips on `p.kick`). `ExtrudeGeometry`'s UV generator
    writes world x/y into `uv`, so the face plate is passed through `fitUV`
    or the atlas texture clamps to one smeared edge pixel. No sphere, no
    capsule, no cylinder, no antenna. Hold the plan footprint at
    `x/z >= 1.40` (fins 40.4 across, 27.1 deep = 1.49) and the half-span at
    or past the player's own `TILE*0.34` collision radius — at `el:0.66` the
    plan outline is the primary cue and a lathe alone is a circle from up
    there. Separation from foes is that structure, **never a re-hue**.
    The 2D colour gate is per-biome over SEVEN swatches (`wallHi` is opaque
    over 40% of a wall tile, and the brick highlight is the real
    `brickHi`-at-alpha-0.55-over-`brickA` composite): no swatch may collapse
    on value AND hue at once, the body must stay chromatic, and every VOID
    swatch must clear a Lab ΔE floor, because VOID is the one room where hero
    and scenery share a hue by construction and the hue axis says nothing.
    Disclosed, not gated: `stationary`'s `#c58aff` is un-clearable by ANY
    chromatic hex in MAKO's family — the whole violet band was swept.
  - `shellview.js` routes `app.screen` to `menudraw.js` and owns `kindSize` /
    `dims`, the one logical box every screen measures against (a real canvas
    wins, otherwise kind picks the classic box or the projected one). It is
    the only render module that may read `src/app/` — screen constants only,
    and scores arrive as a getter so `highscores` stays on the app side.
  - Board look modules (2026-10-25, record
    `docs/superpowers/specs/2026-10-25-board-look-depth-ambient-design.md`):
    walls `wallart.js` / `wallvar.js` (`wallHash`, render-side) + PIXEL
    `pixel/art/walls.js`; base floor `floorart.js` (`paintFloor`, 4 variants x
    2 parities); floor tiles `featdraw.js` (`cellSpec`, `drawSpec`, painters in
    `featart/{built,living,geo,kit}.js`), PIXEL `featpx.js` + `featpxcells.js`,
    REAL 3D `three/featmesh.js` (`fragSource(GEO)`); outline `frameart.js`
    (world bezel) + `frame.js` (recessed well, HUD plate), REAL 3D
    `three/rimart.js` + `three/wellfx.js`; depth `depth2d.js`,
    `three/groundfx.js`; ambient `ambient.js` (spec) -> `ambient2d.js`,
    `three/ambientfx.js`, `pixel/ambient.js`; foes and items `motion.js`
    (spec) + `entityfx.js` (`fxOf(world, look)`), `itemdraw.js`,
    `enemybody.js`, `three/entityanim.js`, `three/burstfx.js`,
    `pixel/entities.js`, `pixel/foegen.js`. Hunter lock-on tell (#32, owner
    ruling 2026-10-26 "Lock-on tell", shell v189): read-only, NO sim field;
    `src/render/lockon.js` `lockOn(world, e)` is the one rule (an `e.hunt` foe,
    player in its row/column 1..4 tiles away, `sign(e.dir)` down that lane, the
    lane open by `bfsNext`'s own blocking: WALL always, BRICK / live bomb unless
    `e.pass`, the player's tile included); `motion.js` `LOCK` / `lockK` is the
    one ramp (in 0.1 s, out 0.18 s, each look's PLAY-frozen clock). N = 4 leaves
    >= 0.51 s at the fastest hunter (FAST, room 8, MAX, HARD); the tell can start
    up to `chaseCd` late because `e.dir` changes only on a re-plan. Floor
    chevrons down the lane (static, so REDUCE FLASH keeps them) drawn UNDER
    pickups in every look, plus a crouch/lunge: CLASSIC `enemybody.js`
    `laneMarks`, PIXEL `pixel/entities.js` `lane` (foe ramp slots, no new hex),
    REAL 3D `groundfx.js` `LANES` uniforms (`LN_N` 4 lanes, 0 new draws; a fifth
    locked hunter gets the crouch only) + `entityanim.js` crouch. Iso has none;
    ATTRACT shows it. REAL 3D animations run on a
    pause-corrected clock (`three/wrapper.js`; `tests/render3d-pauseclock`).
    Sim side: `core/feat.js` (the `world.feat` layer; codes 1..7 = CONVEYOR, ICE
    PATCH, BOOSTER, TRAP, 8..14 = STREAM, QUICKSAND, PORTAL, GATE, whose rules are
    `core/tilestream.js`, `tilequick.js`, `tileportal.js`, `tilegate.js` behind the
    `tiles2.js` seam) and
    `core/board2.js` (the gen-2 generator; tiles ride it as gen 3). Art gates:
    `tools/tileart/gates.mjs all`, `tools/walls/`. Colour-vision gate (#33,
    shell v189): `gates.mjs cvd|all`, Machado 2009 severity-1.0 protan /
    deutan / tritan in linear sRGB (`gatefns.mjs` `simCVD` / `simRGB`, the one
    CVD source), tile set in `cvdsets.mjs` (14 entries incl. the open GATE and
    run ends); every tile at CORE / PLUS / MAX against the base floor, the
    rendered WALL and BRICK cells and (CLASSIC) the brick hexes, plus heat
    separation on the simulated images. `CVD_PIN` sits ~10 % under the measured
    worst case (a regression floor, not a perceptual proof); `CVD_WAIVE` is empty since v196: the open GATE's jamb posts (1 / 2 / 3)
    lifted CLASSIC's heat separation from 2.14 to 4.43. CLASSIC runs in Chrome via `gates.mjs`;
    under `npm test`, `tests/tile-cvd.test.mjs` runs the PIXEL half live and holds
    CLASSIC through `cvdgold.json`: Chrome numbers stamped with an FNV of the
    painter call stream, tile list and measuring code, so a painter change fails
    and asks for `node tools/tileart/gates.mjs cvd --golden` (it proves today's
    calls were measured, not that CI re-rasterizes). REAL 3D (2026-11-01):
    `cvd3dpage.mjs` measures the real renderer at rig C, dpr 2, offline in
    `gates.mjs` (`CVD_PIN3`, top faces only, a clean lit fixture). All 15
    tile states clear the heat bar of 4 since v197 (`three/featmesh.js` `heatLayer`, static, no re-hue, 3D only; `CVD_HEAT3` regression floors), lowest ICE PATCH 4.23. Fixed in v190: PIXEL SAND's parity-B base floor was raw
    `floor1` `#a07828`, 4.9 ΔE from BRICK-B `#a07020`; `featpxcells.js`
    `floorPxCell` now builds that slab one step down (`floor1.shadow` base,
    16.8 ΔE), the PIXEL twin of CLASSIC's `floorart.js` `BED.SAND`.
- `src/app/` — menu shell, intro beats, demobot, highscores, `pactstore.js`,
  plus the entry seams above (`flags` / `attract` / `frameloop` / `rcache` /
  `audiopower` / `renderkind` / `debughook` / `fit`) and the pure GRAPHICS
  policy `gfx.js` + `perf.js` (gate, governor, limit hint).
  Not read by `step()`.
  Retention stores (wave 2, 2026-09-07), one key per module, all `Date`-free
  and DOM-free: `bests.js` (`nb.bests.v1`, per-run score/room bests keyed
  `<heat>:<pact>:<pace+1>`, cap 48) · `stats.js` (`nb.stats.v1`, lifetime
  aggregates always, a 200-entry event ring only after the player opens STATS
  once; STATS is ten rows — seven lifetime incl. `DAYS PLAYED` (`a.days`, one
  per new LOCAL `ld` at `room_enter`, monotonic, self-heals a future `a.day`,
  never a streak) + three bests) · `daily.js` (`nb.daily.v1`, one board a day from a **date string**,
  pure FNV-1a `dailySeed`; the record is stamped `g`, the board generation:
  `DAILY_GEN` 3 since v198, a record with no `g` is gen 1 and reads ABSENT for
  today's daily, so no PLAYED / YOUR TRIES TODAY / comparison across
  generations) · `code.js` (no store; a 12-char `F1` / `F2` / `F3` challenge code
  with a checksum; the digit is the generation, `?code=F1…` boots gen 1
  forever, older clients refuse a newer digit at `CODE_RE` and boot normally, any other
  prefix fails closed). Every date is a string computed in `main.js` (`todayStr`
  local, `dateStr` UTC) and passed in — `src/app/` never calls `Date`.
  `nb.times.v1` stays the one best-TIMES store; STATS **reads** both and
  copies neither. `medals.js` (`nb.medals.v1`, wave 3, one int `& 255`, never
  `nb.plaques.v1`'s `&15`): eight medals, each needing a finale WIN, evaluated
  ONLY at `isRunEnd` in `endRun` from the run tally (`clear5` = L5 WIN with
  `t.r` 5, `clear8` = L8 WIN with `t.r` 3) plus `runT`; the summary's gold
  medal line prints only bits `settleMedals` read back as newly persisted.
  `ghost.js` (`nb.ghost.v1`, wave 3, version-stamped, LRU 16; `GHOST_V` 2 since
  v188, so v1 data loads empty): one ghost per
  `{seed, level, heat, pact, pace, gen}` room, recorded and raced ONLY on a
  fixed board (DAILY / `?code=`; owner O4 2026-10-26: an ordinary run's board
  never repeats, so it records none and races none) — a 10/s position log on the PLAY-only
  `roomT`, faster clears only, never fed to `step()`. `ghostTick` sits between
  the PLAY clock line and the step loop (a new `world.grid` object is the room
  start, so the sim's own retry/next-room record from roomT ~dt); attract
  never records. CLASSIC 2D draws it under foes at `GHOST_A` 0.4; REAL 3D
  draws one merged `PLAYER_HULL` Lambert (opacity 0.4, no depthWrite, never
  casts) that `pools.ghost` builds lazily outside the player slot; PIXEL blits
  MAKO's own frames at `GHOST_A` 0.4; iso never.
  `reset.js` (no store, wave 3): STATS `R` arms, a second `R` runs
  `clearCabinet` + `location.reload()`, any other key disarms (`_push` too).
  Touch (T1): `statsHit` maps a tap on a painted foot token — idle
  `T MEDALS` / `C COPY MY STATS` / `R RESET`, armed `R AGAIN ERASES` /
  `C COPY` — to `KeyT` / `KeyC` / `KeyR` through `input.onUiKey` (the
  keyboard's own path), so the two-press confirm and the COPIED note are the
  same. A non-mouse C hit copies on its `pointerup` (`statsC`, cleared on
  `pointercancel` / `pointerleave`): a touch `pointerdown` grants no
  clipboard activation. C while armed (key or tap) disarms and copies. An
  off-label tap while armed disarms and stays on STATS; the idle C spot falls
  between R AGAIN (81–183) and C COPY (465–519 at 600×520), so it copies
  nothing.
  CLEAR = highscores, bests, stats, daily, times, medals, plaques, ghost,
  pact, coach v1/v2, cabinet (12); KEEP = `nb.settings.v1`, `nb.pace.v1`,
  `nb.analytics.v1` (the GA consent), `nb.controls.v1` (the binds).
  `nb.cabinet.v1` is still written on the first INTRO exit and no longer
  branches anything (ruling 2026-10-09).
  Lists import each store's own `*_KEY`; `tests/reset.test.mjs` fails on any
  unclassified `nb.*` literal in `src/`, so a new store must join one list.
  Demobot is an intent FSM (plant-and-leave, hunger for combat cubes / corridor
  foes); attract still CORE/pact=0. Highscores use `scoreEntry`; `noteWorldEdge`
  is a boolean edge, not a score writer.
- GRAPHICS + frame pacing (owner: "a cohesive and unify graphic settings …
  graphic and FPS power"; unified spec + lead rulings 2026-10-10, shell v178).
  ONE model: `nb.settings.v1` gains `px fps res shd aa fxq dmo fpm`, each an
  index into its row's cheap → rich list (invalid/missing loads the AUTO
  default, never the nearest edge). Policy is pure `src/app/gfx.js`:
  `resolve(s,dev)` → knobs `K` {fpsCap, idleFps, dpr3d, dprPx, aa, shadow,
  partK, demo, meter, dyn, epoch}. QUALITY is DERIVED (`presetOf`), never
  stored: BATTERY / AUTO / HIGH set the six governed rows (FRAME RATE,
  RESOLUTION, SHADOWS, ANTI-ALIAS, EFFECTS, DEMO), any other mix reads CUSTOM
  (Enter = AUTO); FPS METER is in no preset, default OFF. AUTO = today's
  desktop look: AA ON everywhere, SHADOWS SOFT, RESOLUTION AUTO (3D dpr cap 2
  on `d`, touch `min(1.5, scale·dpr)`; PIXEL backing 2 / 1.5 — density only,
  board size never changes); FULL 3D may reach 3×. Locks: CLASSIC locks
  RESOLUTION/SHADOWS/ANTI-ALIAS, PIXEL locks SHADOWS/ANTI-ALIAS, 3D none (a
  locked row shows `—`). Value strings show resolved truth (`AUTO 1.5X`).
  FRAME RATE 30 / 60 / MAX is a **vsync divisor** (`perf.js` gate: median rAF
  interval snapped to `HZ_SNAP`, render every d-th rAF; 120 Hz → 60, 144 →
  72) — never uneven frame-debt pacing; game speed never changes (fixed-step
  accumulator). Idle = every screen but GAME PLAY and the INTRO show (ATTRACT,
  PAUSE, menus are idle) at `max(IDLE_MIN 20, min(MAX ? 60 : 30, cap))`;
  never below 20 (music-safe); an input pokes the gate. The governor
  (REAL 3D + RESOLUTION AUTO only) walks dpr down top → 1.75 → 1.5 → 1.25 → 1
  over 2 s windows and back up after 10 s clean; `limitHint` names a device
  that holds less than the cap (low power mode). Render-on-change is armed
  ONLY by `setPerf` (an untuned renderer is byte-identical — `classic-perf` /
  `gfx-identity` pin it): a still board skips its raster, forced every 500 ms;
  3D re-renders the shadow map only on a caster change (0/s in menus/PAUSE).
  PAUSE freezes the board in ALL three looks (no fx step, shake or flash;
  lead ruling 9). ANTI-ALIAS applies on LEAVING the page (menu or pause view
  2): one live 3D context rebuild (`rebuild3d`; a failed new context keeps the
  old renderer and reverts the row); other looks just drop the cached 3D.
  `rcache.js`: a look unused for `REL_T` 10 s releases — 3D is disposed +
  `forceContextLoss` (`#gl` replaced), PIXEL `sleep()`s to 1×1 buffers (atlas
  kept), CLASSIC has no `sleep` and is kept; a lost WebGL
  context is `dead` after 3 s and rebuilt. Dynamic GPU buffers upload ranged
  (`three/upload.js` `live`), never a bare `needsUpdate`. EFFECTS LOW halves
  particles; blasts always draw in full. DEMO OFF / SHORT (default: ATTRACT
  ends after `DEMO_T` 60 s and MENU parks until input) / ON. FPS METER tags
  idle-gated screens `· IDLE`. The kept show world stops stepping once its
  script and blast settle (`SETTLE_N`). Audio: a hidden page / `pagehide`
  suspends the ctx (`audio.sleep`), visible + SOUND on wakes it; never arms the
  unlock or fires the jingle/show. Measured (headed Chrome, 120 Hz, AUTO vs
  pre-branch): title/menus/attract −56…−80 % CPU, PAUSE −59…−67 %, PLAY
  −27…−36 %. Keys: ←/→ clamp, Enter cycles; `keys.test` covers GRAPHICS and
  pauseView 2.
- CONTROLS (owner 2026-11-02, shell v201, released 2026-11-07; record
  `docs/superpowers/specs/2026-11-06-controls-built.md`). Gamepad play, rebinding on both devices, one
  page, hints that follow the last-used device. **The sim never sees a pad:** the pad is another writer
  into `Input` with its own held axes and latches, OR-merged with keys; no wire field, no `src/core` read
  of a pad, SENSITIVITY or vibration. The reserved `kick` slot stays false. Button names are by position only (SOUTH EAST WEST NORTH,
  L/R SHOULDER, L/R TRIGGER, SELECT, START, D-PAD, L-STICK, R-STICK; ids `S E W N SHL SHR TRL TRR SELECT
  START dU dD dL dR`); no maker's name anywhere. Seams: `src/app/controlswire.js` (the wire), `gamepad.js`
  (poller, above the frame gate; radial deadzone, 4-way; SENSITIVITY `SENS_LEVELS` MIN 60 / LOW 40 / MEDIUM 25 / HIGH 15 / MAX 8, turn 1.40x to 1.10x, release `dead - 0.05`, `- 0.10` at 40 and above, floor 0.03; no response curve; a menu's first engage is vertical unless x > 1.25y), `padroute.js` (pad -> `Input` / shell, the
  swallow rule), `capture.js` (all input up, then 200 ms; later MOVE steps and a retry need only the release;
  no timeout), `controlspage.js` (reducer), `controls.js` (model, rules, store), `hints.js` (device tracker,
  0.75 s dwell, `wordsOf`, `helpOf`), `rumble.js` (one-way from the event drain; player word VIBRATION, internal names stay `rumble`; stored `vib` OFF / LOW / MEDIUM / HIGH, default MEDIUM, owner's call, `rumble` still written for older cached pages; scale 0.4 / 0.75 / 1 gives x, played as x from 0.5 up and as `0.35 + 0.3x` below (`LIMITS.knee`), LOW never past 0.40; independent of REDUCE FLASH; `PATTERNS` lose, hurt, win, shield, chain, close, near, plant, test, and the menu feels launch, enter, hello, deny, confirm, back, move (2026-11-03, owner: "subtle vibration when menu changes"; shell call sites write one ranked slot `app.feel` (`menuapp.js` `FEELS`), `controlswire.js` arms it around the pad poll's routing and plays one feel per press, launch > enter > deny > back > confirm > move; deny only where a refusal is shown; hello on connect off GAME PLAY; weak motor except back, strong .3; none over 250 ms or 0.7; menu cap 900 ms per 10 s on cursor ticks, page feels (enter, back, deny) always play but count, launch and hello outside it; a late frame plays a menu step late, never skips it; gameplay preempts; record's Menu feels section); `LIMITS`: a pattern at most 500 ms and 3 pulses, a pulse at most 300 ms, gaps at least 80 ms, 4 pulses a second or 2 at LOW, about 50 % on-time, hurt and lose exempt, near + plant 900 ms per 10 s; LOW drops plant, near and menu ticks; OFF is zero calls through the one `fire`; a run and menu ticks only while `app.lastDev` is the pad, the row's test pulse is the one exception; menu feels have no separate off, MEDIUM and HIGH only, never a hold repeat or a clamped edge, move and confirm at least 100 ms apart; no actuator shows `NONE` and `NO VIBRATION ON THIS CONTROLLER OR BROWSER`); a held menu direction (`app.repDir`) runs its frame at up to `HELD_FPS` 60 under the FRAME RATE cap, keys too; render side `controlsgeo.js`
  (the one geometry for draw and tap), `controlsdraw.js`, `padart.js`,
  `hintcopy.js` (the setter that keeps `menudraw.js` free of `src/app/`). All static in the boot graph (111,107
  bytes raw at `ee2a34e`, boot graph +137,052 since `8853efc`; 12 files, on purpose; lazy paint is a later job). `SCREEN.CONTROLS = 16`; from PAUSE `pauseView 3`. The door
  sits between GRAPHICS and RESET DEFAULTS; OPTIONS is twelve rows at keyboard pitch 27 (note line removed), touch 37 or 34.
  **CONTROLS is in the CONSOLE PANEL kit like every other menu (lead ruling 2026-11-02, on the owner's ask for one cohesive menu): list on the left, preview pane on the right, HEAT-style tabs, kit band, notch and caret; ↑↓ rows, ←→ tab, ←→ on SENSITIVITY or VIBRATION adjusts.** The other menus do not change, and the all-menus restyle is not planned for this release. MENU carries the note `CONTROLLER READY · OPTIONS › CONTROLS`, naming the VIBRATION level where it fits, and the OPTIONS door reads `VIBRATION MEDIUM ›` the same way; no OPTIONS or PAUSE row of its own. Tap rule exception: on CONTROLS a tap off the
  plate backs out anywhere in the viewport, not only on the canvas. Store `nb.controls.v1` (KEEP); invalid data
  loads that device's defaults, an off-level SENSITIVITY value snaps to the nearest level, a bad `vib` never touches the binds. Keyboard defaults: BOMB SPACE (J, X silent
  aliases until BOMB moves), **THROW E** (SHIFT + BOMB still throws, never advertised), REMOTE Q, PAUSE P, ESC
  and arrows fixed. Pad defaults: BOMB SOUTH, THROW WEST, REMOTE EAST, PAUSE SELECT, START fixed; menus use the
  fixed layer SOUTH / START confirm, EAST back. Pad start rule: one pad press leaves the title and starts the
  show, silently if the ctx will not run, `app.soundNote` then says `NO SOUND YET`. No pad route to
  the consent card (a stray button must not consent; an unanswered OPTIONS ANALYTICS row is inert on a pad and says
  `ANSWER THE CARD WITH Y OR N`), the STATS wipe or the camera reset, on purpose. Disconnect pauses only with the pad last
  used in GAME PLAY (`CONTROLLER LOST`), never resumes. Pad name `CONTROLLER 1 · STANDARD` (`BUTTONS 0-N` non-standard); the device
  id is never printed or stored. Keyboard diagonals stay about 1.41x while a pad is 4-way, disclosed. **The owner has
  played on a real controller (2026-11-02) and reported it works; details not yet reported, so M1-M7 stay open. On 2026-11-03 the owner felt the VIBRATION row's test buzz on a real controller on macOS; the in-run patterns are not yet reported.** No URL flag; `__GAME__.ctl` is the test hook. `keys.test` carries the pad matrix.
- Pickup feedback (owner: "agree with research team, let's work on all of
  them", 2026-10-10). All names/copy come from `POWER[].name` / `.help` —
  never a second source. `fx.js`: one floating label per `power` event showing
  the value AFTER pickup (`FLAME 3`, muted `MAX` at the cap, `SPEED UP`,
  `+1 LIFE`, `LINE BOMB` + a `replaces POWER` sub-line on a bomb-kind swap);
  same kind merges, near ones stack, max 3, 0.9 s, PLAY-only clock, wiped by
  `clearR2`; suppressed for the live coach v2 kind; pure `labelBox` keeps it
  off the y46 HUD band, the combo callout and the coach panel (REAL 3D
  projects through the live camera). HUD pulse: a 600 ms outline on the
  BOMB/FLAME chip or heart row when the number changes (the first feed after
  a wipe only seeds, so a room change never pulses). Ability bar
  (`drawAbilityBar`, `scenes.js`, y 486–514): held SHIELD / KICK / THROW /
  PASS / bomb kind / REMOTE / SPD n; a chip a hit or spent SHIELD removes dims
  out over 600 ms (a bomb-kind swap is not a loss); PLAY/PAUSE and `hud:true`
  only (ATTRACT and iso draw none). Touch `#tthrow` / `#tremote`
  (`touch.js`): shown only while the player holds that power, a tap is a
  one-tick `pulseThrow` / `pulseRemote` intent, fixed slots. Every idle
  frame paints nothing new, so idle HUD call logs are unchanged. All three
  looks (PIXEL uses its own cells for the icons).
- `src/ai/enemies.js` — enemy AI on sim state.
- `src/net/` — `protocol.js`, `lockstep.js`, `transport.js`.
  Default play uses **no** transport. `?net=local` is a 1P pair proof; its
  mirror follows every run (2026-11-01, `localpair.js`: a new A grid no tick made
  is a run start, B takes A's seed / gen / heat / pact / pace and deals its own
  board; `tests/net-local.test.mjs` pins equal hashes).
  `applySnapshot` was removed (lockstep-only). `makeSnapshot` remains for harness dumps.
- `src/input.js`, `src/touch.js`, `src/audio.js` — input + chiptune. `input.js` reads the live binds and takes the pad as a second writer (v201, CONTROLS).
  Track tables live in `src/audio/tracks.js`. Boom tints live in
  `src/audio/boom.js` (`boomOf`). Pickup grab tints live in
  `src/audio/item.js` (`itemOf` / `sfxOf`); `play("item_"+kind)` from power
  events that carry `kind`. Catalog stays 12; `applyPower` semantics unchanged.
  Pickup glyphs live in `drawIcon`; HOW TO / HUD chips / 2D bombs reuse them.
  3D pickups use one shared geo per kind plus one `InstancedMesh` body
  and ring per POWER.t (`SLOT_MESH.item === 2`); `paintItemFace` stays
  for atlas tests. N FLAME cubes are one draw.
  Foe kill tints live in `src/audio/foe.js` (`foeOf`); `sfxOf` maps
  `kill`+`type` to `foe_<t>`. ENEMIES / arena 2D use `drawEnemyBody`
  (visor grunt / bunker / drone / hunter helm / wraith / missile, plus
  BURROW / SHADE / KNIGHT on rooms 6–8). Hunt is `e.hunt` at spawn; do not
  retune wander / still / chase / phase algorithms.
  `musicCue` uses `biomeOf(level).name`.
  Oscillator SFX stay direct-to-destination (layered voice + noise + filter,
  never musicGain). `voice()` / `noise()` nudge `resume()` on any state but
  `closed` (iOS `interrupted` included), then DROP (never queue) the SFX
  unless `ctx.state === "running"` — resume is async, so a queued SFX would
  start on the frozen clock. `createAudio()` with no injected ctx calls
  `primeDevice()` once: a throwaway AudioContext built and closed at boot
  pays the session's first-ctx device bring-up (~70–115 ms) before the title
  paints, so the press frame no longer hitches; the game's own ctx is still
  born inside the gesture. A harness counting constructed contexts sees one
  extra `closed` one — assert on the game's ctx.
  Music is a track table: `AABB` per track, all nine B
  sections hand-authored (no identity B), one theme per biome. `setTrack` +
  `musicCue(screen,level)` from the shell; GAME/ATTRACT follow the room,
  everything else plays menu, INTRO included (ruling 2026-10-09): the show
  runs on the menu theme and the `intro` track is dormant, kept and pinned.
  `reveal` is a cue.
  Unlock is `src/app/unlock.js` `armUnlock`: keydown / pointerdown / pointerup /
  touchend / click (capture), armed until `ctx.state === "running"` (Escape and
  a touch `pointerdown` carry no activation); a second counted press (a
  `pointerup`, or a non-repeat keydown that is not Escape or a modifier/lock
  key — Chromium's modifier set, incl. AltGraph / Fn / NumLock / ScrollLock),
  with the ctx still not running 250 ms later, calls `onReady` anyway (the
  hatch). `onReady` is one-shot; disarm is not tied to
  it: the listeners keep calling `unlock()` until the ctx runs (or no WebAudio
  / a rejected resume). `unlocked()` means running and gates
  `pump()`; the jingle rides the unlock and never fires on a suspended ctx.
  `onReady` fires the sting and `beginShow()` only on INTRO, so deep links
  never get it. No WebAudio (Node): the first gesture that is not Escape or a
  modifier/lock key, which keeps the Node key matrix equal to the browser's.
- Analytics (owner 2026-10-26: "we need a tracker in order to see how many
  people stay in game or open the game", then "let's work on the Google
  Analytics"; consent pick "ask once, with an OPTIONS switch"). GA4, OPT-IN,
  `src/app/analytics.js`; plan `docs/superpowers/plans/2026-10-26-google-analytics.md`,
  player copy `docs/privacy.md`. Nothing reaches Google before ALLOW: no
  `gtag.js`, no cookie, no event. Live ONLY when `GA_ID` is a real `G-…` (today
  `G-C3MW30HPQ0`; the `G-XXXXXXXXXX` placeholder is inert) AND the host is `hmarzban.github.io`;
  `?debug=1` elsewhere is DRY (`__GAME__.ga.log`, never the network). Consent
  `nb.analytics.v1` (`"1"`/`"0"`, absent = ask; KEEP list) is its own store,
  never a `nb.settings.v1` key, so RESET DEFAULTS leaves it. The card `#ana`
  is a NON-BLOCKING corner card (owner 2026-10-26, v187: "let user to play and
  if they like it they can then answer"): the CONSOLE PANEL plate docked 16px
  bottom-right (touch portrait: across the bottom), no backdrop, never grabs
  the keyboard; ALLOW (`Y`) and NO THANKS (`N`) at EQUAL weight (never a big
  yes and a muted no), and only Y / N are taken while it shows. It shows on
  MENU and its pages, and in GAME only on a keyboard layout when
  `cardClears` (it sits beside or under the `#c` stage); never INTRO /
  ATTRACT, never a touch run (the bomb button's corner); it waits while NEW
  VERSION READY is up. It stays until answered (no snooze).
  OPTIONS `ANALYTICS` ON/OFF sits after REDUCE FLASH (row 8; OPTIONS touch
  pitch 37 or 34 so twelve rows fit unscaled); OFF sets `ga-disable-<ID>`, denies
  consent and expires the `_ga*` cookies. Cookies live on the game's own path
  (`cookie_path`, shared `github.io` origin); every ad signal is denied. Events:
  GA's page_view = an open; `run_start` from `startRunState` and `run_end` from
  `endRun` (main's world only, never attract or the show), `mode`
  run/daily/code, `result` win/lose/quit via `isRunEnd`; user properties
  `days_played` (STATS `a.days` bucket at boot) and `look`. `src/app` never
  calls `Date`: main injects `now`. GA reports need the params registered as
  custom definitions (owner step).
- `src/pwa/` — Node-testable app-shell list + SW register. `src/main.js`
  registers `./sw.js` (module, scope `./`). Precache lives in `shell.js`
  (`fusegrid-shell-vN`). Must include `vendor/three.module.js` and the whole
  `src/render/pixel/**` tree (art sheets included), or a look breaks offline. Never cache
  `og.png`. Never imported by `src/core`. Bump `CACHE_NAME` and the REV
  token in `sw.js` together when the file list or shipped bytes change.
  NEW VERSION READY (owner 2026-10-19, shell v179): a new worker installs
  (precache with `cache:"reload"`, register with `updateViaCache:"none"`) and
  WAITS; `register.js` hands a waiting registration (controller present, never
  a first install) to `src/app/update.js`, a DOM card `#upd` styled as the
  CONSOLE PANEL plate, CENTRED on the screen over a blurred, dimmed backdrop
  `#updbg` on every layout (owner: "must appear in center of the page", "a
  blure background"); a tap on the backdrop is LATER and never reaches the
  canvas. It shows only where a reload costs nothing: MENU, every
  sub-page, and WIN/LOSE when `isRunEnd` (pure `updVisible`); never INTRO,
  ATTRACT, live PLAY, PAUSE or a mid-run WIN. RELOAD (tap, `pointerup`) or `U`
  posts `SKIP_WAITING`; the one `controllerchange` listener reloads once.
  LATER snoozes until the next run returns to the menus or the next boot; no
  store. Updates are re-checked at boot and on `visibilitychange` (<= every
  10 min). Bridge: replacing a pre-v179 shell (`PROMPT_FROM 179`) still skips
  waiting, because those pages cannot prompt; that is their one last silent
  reload. Activate deletes only `fusegrid-shell-v*` keys.

## Commands

- `npm test` / `node --test` — run tests (`tests/*.test.mjs`).
- `npm start` / `node serve.js` — loopback only: `http://127.0.0.1:8080/index.html`.
  `PORT=0 node serve.js` binds an ephemeral port (printed on boot) — what
  every parallel agent uses.
- Public play is **GitHub Pages** (`https://hmarzban.github.io/fusegrid/`).
  Static files only (`.nojekyll`, relative asset hrefs). Do not rebind `serve.js`.
  Social/SEO: keep `og.png` (1200×630), `robots.txt`, and `sitemap.xml` in the
  Pages stage set. `og:image` must stay an absolute Pages URL. GitHub About
  description + topics are live SEO (not in git): lead with play-in-browser +
  the three looks (CLASSIC 2D · PIXEL · REAL 3D) + Heat, not "deterministic".
  Keep topics filled. Repo Settings → Social preview has no API — the owner
  re-uploads `og.png` there by hand every time the card changes (the v180 card
  was uploaded 2026-10-19).
  PWA: also stage `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`,
  and `screenshots/` (the manifest's install-dialog captures: staged, never
  precached; `tests/pwa.test.mjs` pins sizes, ratio and staging).
  `serve.js` MIME includes `.webmanifest`.
- CI: `.github/workflows/pages.yml` runs `npm test` on Node 26 for pull requests
  and as the required gate before every Pages deploy. Human-facing
  architecture/tradeoffs live in `docs/architecture.md`. `docs/README.md` maps
  which doc owns which fact (one owner per fact, others link) and sets the doc
  voice: arcade tone, facts exact; dated `docs/superpowers/` records are never
  rewritten, only indexed there. `docs/diary.md` is the dated story of the
  build (add an entry per release or big turn; CHANGELOG still owns
  per-release changes). Promotion material (pitch copy, tags, launch
  plan, posts, replies and their decisions) is local only, in the git-ignored
  `.superpowers/sdd/marketing/`; never write it into a tracked file or a commit
  message. JSON-LD never carries a rating or review; `playMode` is the
  schema.org enum URL. `sitemap.xml` `lastmod` must be >= the newest
  CHANGELOG release date (`headless.test`), set at every release.
  `/fusegrid/robots.txt` is inert (crawlers read only the host root), so the
  sitemap reaches Google through Search Console.

Flags: `?render=3d|px|iso` (3d/px seed the boot only; iso is pinned), `?play=1`, `?net=local`, `?orbit=1`, `?debug=1`,
`?code=` (12-char challenge, URL-only — no opts fallback). CONTROLS adds no flag. No `?gen=` flag since v198; an old
`?gen=3` link boots like any page.

Node v26, `"type": "module"`. No build step, no bundler.

## Conventions

- **Determinism**: `step()` is pure w.r.t. world + intent. No time/DOM/`Math.random`
  in the sim — use `src/core/rng.js`. Replay/outcome validity: **baseline v6**
  (interior WALL pillars, floor pickups, staged roster, L5 finale; DIRS4
  wander) begins after the 2026-09-02 gameplay pass. v5 was DIRS4-only.
- **No DOM in `src/core`**. Render factories may touch DOM (atlas, WebGL, HUD).
  Node-testable three **math** stays DOM-free.
- Frozen `CFG` — mutate world, not config. `BIOMES` elements are shallow.
- Keep zero **npm** deps. Vendored render libs are OK.
- 3D draw-call budget is `<=500`; fat-world is currently **156** (158 worst
  case, a 160 lane cap in `tests/three.test.mjs`) after the 2026-10-25 board
  look (rim, well, floor tiles, ambient `Points`, foe death ghosts, pickup
  badges, burst `Points`). The "stays 141" lines in dated paragraphs above say
  what that change kept at its time. Child-index
  contracts in `three.test.mjs` are ABI — do not "flex" them in a drive-by.
- No comments unless the file already uses explanatory block comments (its style).
  Match the compact, no-whitespace-after-key style already in the codebase.
- **A delta that cannot lie.** Anything the run summary claims (`NEW BEST`,
  `FURTHEST ROOM YET`, `MATCHED…`, `+N FROM…`) is computed from a **persisted**
  number or it is not shown, and only at a run end — `isRunEnd(world)` is the
  one predicate for both display and persist, and it reuses the same
  `isFinale` the overlay already uses. `bestRun` is a **run-start snapshot**,
  read once per run, never re-read mid-run. A run that began above room 1
  writes no room record and prints no FURTHEST form. A first-ever run on a
  bucket that scores exactly 0 prints **no delta line at all** (Ruling
  2026-09-07, Nit-6) — a zero-point run set no record worth naming.
  Bests and times deliberately span boards and generators (owner ruling 6,
  2026-10-20: "base on the dificulity of game and the level"): `nb.bests.v1`
  and `nb.times.v1` keys carry no seed and no gen.
- **The daily is honour-system and single-device.** No enforcement, no
  consecutive-day read, no streak/at-risk/welcome-back copy, never framed as
  competing with anyone — the only claim is *your own attempts are comparable
  to each other*. STATS `DAYS PLAYED` is a lifetime count and does not
  break this ban: it never reads consecutive days. Its config is pinned `{level:1, heat:0, pact:0, pace:0}`
  **and stamped**: a record whose stamped pace differs from this run's is
  treated as absent, never silently compared; so is one stamped with another
  board generation (`g`, #13). Ordinary run i of a page load plays
  `runSeed(bootSeed, i)` (#10; run 0 = `bootSeed`, so `opts.seed` tests keep
  their first board). Every ordinary start deals the next one: `onStart`
  (PLAY, LEVEL SELECT, ATTRACT), PAUSE RESTART, and the sim's GAME OVER /
  finale restart through `world.nextSeed`, which main arms and `startGame`
  consumes. A daily or code run (`runFixed`) never uses or advances the index,
  and its restarts replay its board. Losing a life keeps the board. This
  supersedes the 2026-09-07 "remembered `bootSeed`" rule.
- **Rulings 2026-10-09 (user).** D1: GAME OVER keeps the arcade restart from
  room 1 — no continue-credit. H4: a tap on ATTRACT starts an ordinary run even
  if the MENU cursor sat on DAILY. REAL 3D near border wall is a cutaway
  (`min(hWall, NEAR_H 22)`), chosen over see-through or leave-it.
  2026-10-10 (lead ruling, owner may veto): every key but Escape/Backspace
  (those return to MENU) leaves ATTRACT into an ordinary CORE run — R and M
  included (R never arms reset or resets the camera there; M has no mute
  binding, so it only leaves).
- **The challenge code carries a board, never a claim.** `?code=` is 12 chars
  (`F1` / `F2` / `F3` + seed + cfg + checksum), seed/heat/pact/pace only — **no score
  field**, and no `window.prompt` / DOM paste box (entry is through
  `flags.js` alone). The word `leaderboard` is refused in `src/` and `tests/`
  and executably gated by `tests/banned-name.test.mjs`; `docs/` is exempt
  because the spec names the term to refuse it.
- A tile may not close your only way out (v199, gen 3 only, every heat, no profile knob): `sim.js` `carryPins` holds a carried bomb, `tilegate.js` `gatePins` holds a gate at its last warning step (`GATE_ROOM` 10). `tests/tile-foe-lane.test.mjs`. `makeSnapshot` adds a `tiles` key only when `world.feat` is set; `determinism.test` replays all eight tile rooms.
- Coach v2 (`nb.coach.v2`) also carries nine tile bits (`b g c x f q y o z`, gen 3 only,
  17 bits in all; `z` is the ICE brake, kind `BRAKE`, gated by `glideBrakes`, closing it also sets `g`; copy `feat.js` `tileTip`, 6 s, a tip whose room is left closes
  `rn:"room"`). It shows **one first-use tip per verb**, once ever,
  for EIGHT verbs (owner ruling 2026-10-10 widened the original three): KICK /
  THROW / REMOTE / PASS / LINE / POWER / PIERCE / SHIELD, one bit each
  (`k t r p l w i s`; a three-bit record from before loads byte-stable with
  the new bits 0). FLAME / BOMB / SPEED / HEART are label-only — the floating
  pickup label says everything. PLAY-only clock that PAUSE cannot burn.
  Its copy is composed from `POWER[].help` — never write a second source for
  those strings (touch layouts swap a leading key chord for "the X button").
  v1's ghost coach wins ties; a new trigger replaces a live tip (dismissed
  `rn:"replace"` first, and the replaced verb is NOT marked seen, so it
  re-queues). A live tip whose power is lost (a hit) closes `rn:"lost"` with
  its bit still 0, never for a tip opened or replaced that frame; SHIELD's
  absorb counts as a use. Shown/dismissed pair exactly once — except an
  abandoned run mid-tip, which leaves that tip's `coach_shown` unpaired by
  design. The latch resets at **every** run-start path.

## Testing

Tests live in `tests/*.test.mjs` and run under `node --test`. `tests/keys.test.mjs`
is the key matrix: every documented key in every shell/world state through the
real `createGame` keydown/keyup listeners — a new key or screen joins it. Keep the sim
importable without a DOM. `tests/browser_integration.html` is manual. Visual 3D and PIXEL
feel is not covered by Node — play-verify in a browser after render changes
(PIXEL: `tools/pixel/shot.mjs`, laptop and phone). Frame-pacing / CPU claims
need headed real-GPU Chrome, never the rAF shim or SwiftShader.

## Memory

- **Durable memory** lives here (`AGENTS.md`): conventions, architecture, "how
  we do things". Edit when a decision changes.
- **Episodic memory** lives in `MEMORY.md`: a dated, append-only log of what each
  session did/decided/left open. Both are auto-loaded via `opencode.json`
  `instructions`.
- **Standing rule:** after any non-trivial change, append a dated entry to
  `MEMORY.md` (newest first; promotion work goes to the local
  `.superpowers/sdd/marketing/LOG.md` instead) so the next session/agent inherits context. Keep it
  to 1–2 lines: what changed, why, or what's left open.

## Learned User Preferences
- Public name and wordmark are Fusegrid / FUSE/GRID; keep the local checkout as `rollblock`. Never write the name of the private reference game (the well-known grid-bomb franchise this project is measured against) into any committed file (specs, comments, commit messages, docs, alt text, tags) — it is a private quality reference only; `docs/` is public.
- This repository is the arcade game only — do not add unrelated demos.
- Promotion and posts: rules, plans and the log live in the git-ignored `.superpowers/sdd/marketing/` (README.md, LOG.md). Never in a tracked file.
- Keep a visible path to the public repo: menu SOURCE opens https://github.com/HMarzban/fusegrid.
- Keep ITEMS, ENEMIES, and HOW TO as in-menu help so pickups and foes are explained in the shell, not only as HUD chips.
- Opening (2026-10-09): title, then press, then a ~4 s show (camera sweep, MAKO pop-in, fuse, blast reveals MENU), with music from the press. Any key skips the show (the title waits for a press). First visits land on MENU at PLAY, not in a run. The title follows RENDER; the show plays the MENU theme throughout, and the `intro` track is kept unused.
- Difficulty is Heat on LEVEL SELECT (CORE / PLUS / MAX). Global **pace** (EASY / NORM / HARD) is a separate LEVEL SELECT control (`[`/`]`), persisted in `nb.pace.v1`, scaling player/enemy move speed on `world.pace` — not frozen `CFG`. Pact (`1–4`) and rooms 6–8 unlock after the first FUSE/GRID CLEAR. Score × heat is persist-only; HIGH SCORES fifth column tags pact bitmask (`p`). Music uses WebAudio stereo panning on the oscillator engine (zero npm deps). Mid-run heat, always-on Sudden Death, and internet play stay parked.
- Foes must read as arcade characters (distinct silhouette, face or lens, shading, facing) in CLASSIC 2D, PIXEL and REAL 3D, not flat colored tokens. `enemybody.js` is the 2D five-beat build; 3D matches via merged hulls in the four-mesh slot. Art only — do not retune AI.
- Do not commit `.cursor/` or `e2e-artifacts/` (both gitignored).
- PIXEL (hand-pixelled sprite look) SHIPPED in shell v178 (owner GO 2026-10-10: "work on the sprit version of the game, we have to let the user to chose between the sprit, 2d and then 3d in the menu … finish the job and not ask me anything at all"; supersedes the 2026-10-09 "planning only" ruling U3). It is the third RENDER look, CLASSIC 2D → PIXEL → REAL 3D, never a replacement — CLASSIC 2D stays the default. Judged on laptop AND phone, at today's board size (sharp-bilinear, no integer-snap shrink). Plan + rulings: `docs/superpowers/plans/2026-10-09-pixel-art-spike-plan.md`.
- GRAPHICS: one cohesive settings page (QUALITY preset + FRAME RATE / RESOLUTION / SHADOWS / ANTI-ALIAS / EFFECTS / DEMO / FPS METER) so the player picks look vs FPS/power. Defaults keep today's desktop look; departures from the frozen 3D recipe (SHADOWS SHARP/OFF) exist only as opt-in values.
- When an owner request lists several asks, finish all of them and record each in AGENTS.md, `docs/architecture.md`, `MEMORY.md` and the changelog at the end; housekeeping (servers, headless browsers, scratch) after every round.

## Learned Workspace Facts
- Surviving a hit leaves live bombs and blades in the world.
- Share the play URL with a trailing slash (`https://hmarzban.github.io/fusegrid/`); the no-slash GitHub Pages 301 has no Open Graph tags, so link previews fail. Share card is root `og.png` (1200×630); `og:image` stays the absolute Pages URL. The hero is a REAL capture of the live game, never generated key art, which drifts from the game. Since v201 (owner pick B, 2026-11-02) it is one real room 5 MAX moment split by a slash into CLASSIC 2D and PIXEL, with the shape-built wordmark (sources and the rejected A: git-ignored `.superpowers/sdd/2026-11-02-covers/`); the v180 card (owner pick C, 2026-10-19) was the ATLAS LEVEL SELECT page in CLASSIC 2D from a fresh profile, and the 2026-09 card the transparent-clear 3D JUNGLE board. Card sells CLASSIC 2D · PIXEL · REAL 3D plus CORE / PLUS / MAX; the PLAY IN THE BROWSER pill spans that chip row (left = CORE left, right = MAX right) and type keeps a 10% inset. Sources, composer and the rejected A/B: git-ignored `.superpowers/sdd/2026-10-19-storefront/`. Never the reference game's name on the image or tags. Public About/meta copy leads with play-in-browser + the three looks + Heat; "deterministic" stays a contributor word, not the storefront lead.
- A just-planted bomb is not solid while the bomber still occupies that tile; after leaving, re-entry is blocked (plant-and-leave / R16).
- KICK is passive: with the KICK power, walking into a bomb slides it. No key kicks. `KeyK` is unbound by default (2026-11-01), and a player may bind it on CONTROLS; INPUT keeps a reserved always-false `kick` wire slot so the lockstep shape never moved. No hint may say K + MOVE (issue #6); `menudraw.test` fails on it, and HOW TO's KICK key reads `WALK INTO BOMB`.
- FLAME is blast length in tiles (starts at 1, caps at 8, persists across death and rooms); BOMB is how many bombs can be live at once.
- Gold WALL never breaks; green BRICK breaks and stops a normal blast.
- Rooms 6–8 use SAND / VOID / CROWN palettes, chiptune cues (`sand` / `void` / `crown`), and boom tints (kick 69 / 40 / 82). Those rooms append exclusive BURROW / SHADE / KNIGHT (`ROOM_EXTRA`); do not replace CORE L1–5 spawn lists. Rooms 1–5 stay JUNGLE–ARENA. Ice/water/arena boom numbers stay. Menu/intro use the default boom.
- Soundtrack Direction v3 (`docs/superpowers/specs/2026-09-05-soundtrack-design.md`), user-approved baseline 2026-09-06: every track sits at its own tempo in the ~96–120 BPM band; leads are `triangle`/`sine`; `sawtooth` is not a music-layer timbre; `square` survives only as a factory hat colour at `v <= 0.035`; per-channel `v` ceilings plus a channel-peak sum `<= 0.20`; no shared motif across tracks; all nine B sections are hand-authored (no identity B); all 19 patterns are pairwise distinct in bass groove and lead contour. Pinned in `tests/music.test.mjs`.
- Live 3D uses one frozen rig `{az:0, el:0.66, dist:1503, target:[0,-17,0]}` at `CAM_FOV` 24 (52.2° 3/4, ruling 2026-10-08) and one frozen light recipe — warm key `#fff4e2` 1.26 with the only shadow, cool fill `#bcd4ff` 0.54 opposite-and-behind (never casts), hemi 0.72, ambient 0.30. Key:fill 2.3333:1; `PCFSoftShadowMap` ignores `shadow.radius`, so softness is the ratio, not blur. The renderer runs `NoToneMapping` and the scene carries NO fog: ACES at exposure 1 mapped linear 0.02→0.007, capped white at 0.763 and zeroed JUNGLE `floor0`'s red channel, while `Fog(bg1,700,1600)` replaced 43% of the far board corners with `bg1` (89% at the `DIST_MAX` dolly clamp). CLASSIC 2D blits the authored hex, so REAL 3D must not regrade the same palette. Do not add a per-biome camera or light table. VOID staying dark is the look, not a bug — its darkness is albedo, not rig, so one global recipe preserves it. Stale: `el:0.54` / `dist:870` / `target y -48` / FOV 45, `el:0.62` / `dist:960` / `target y -44`, key 1.05 / fill 0.45 / hemi 0.55 / ambient 0.18, ACES tone mapping, and any `scene.fog`.
- The 3D board sits in a cabinet well: ONE `ExtrudeGeometry` rim with a hole, tinted `wall`→`bg1` so it recedes. Four rails crossed at the corners and stuck out — never go back. Border is 1 draw call, so fat-world is 141. The near border row alone is cut down to `min(hWall, NEAR_H 22)` so row-11 actors stay readable at rig C (ruling 2026-10-09).
- At `el:0.66` the camera sits 52.2° above the horizon — still past 45°, so it reads more TOP than side. The PLAN-VIEW FOOTPRINT is an enemy's primary cue, and nine distinguishable footprints beat nine distinguishable profiles: three scaled spheres were three circles from up there. Detail below the waist buys grounding and shadow shape, not visibility, and a face plane has to face the RIG (rake it up) rather than the direction of travel.
- A stale service worker serves pre-change bytes and looks exactly like a render change that did not land. Unregister the SW and delete its caches before trusting any headed 3D screenshot.
- CROWN's collision is its `brickA` `#ffd447`, which is `fast`'s identity colour exactly. The three golds separate on value and shape, never hue: `knight` is the only bright-specular Phong **foe** plus an unlit pale nasal bar — the player face plate is the cast's one other Phong surface, `fast` carries dark fins over a straight-edged delta, `burrow` is a duller value with an additive plume. Do not restyle the biome to fix this.
- PWA is a versioned app-shell precache (`fusegrid-shell-vN`). Offline after the first visit; first visit still needs network. Relative `./` scope covers Pages `/fusegrid/` and loopback. New `CACHE_NAME`/REV: `register.update` + one-shot `controllerchange` reload. iOS install is Add to Home Screen; module SW wants 16.4+.
- A hidden browser tab pauses `requestAnimationFrame`, so a headed check on an
  unfocused pane freezes the game loop and every screenshot is stale. For
  STATE checks drive the loop through a `MessageChannel`-backed rAF shim and
  assert on `window.__GAME__` + a `fillText` recorder rather than on pixels.
  For FRAME TIMES never use the shim: measure hitches in headed real-GPU
  Chrome with a plain rAF recorder.
- macOS: a fresh `--user-data-dir` is NOT a cold GPU shader cache — Metal's
  per-app cache lives outside the profile
  (`$(getconf DARWIN_USER_CACHE_DIR)com.google.Chrome.helper/com.apple.metal`).
  SwiftShader / headless stall numbers (e.g. the old 286 ms 2D Graphite stall)
  do not carry to a real GPU.
- A browser session's first `new AudioContext()` blocks ~70–115 ms in its
  constructor (audio device bring-up); `primeDevice` pays it at boot.
- A touch `pointerdown` grants no transient activation. Anything that needs
  one from a tap — a clipboard write, the audio unlock — runs on `pointerup`.
- `localhost:8080` and `127.0.0.1:8080` are separate origins, each with its own
  service worker and caches; clean both before a headed check. The desktop
  Browser pane cannot register a service worker at all, and may not deliver
  key presses to the game (focus / rAF), so PWA install, offline and key-driven
  checks run in a real Chromium driven over CDP.
- Parallel worktree agents: each runs `PORT=0 node serve.js` and stops its own
  server by PID — never `pkill -f "node serve.js"`, which kills other
  sessions' servers. Headed Chrome steals the user's focus; keep runs short.
- Taste calls (camera, layout, blast look): render a labelled contact sheet of
  2–3 candidates, ship the best against stated criteria, and let the owner
  veto.
- Headed audio checks: launch Chromium with
  `--autoplay-policy=document-user-activation-required`. The
  `user-gesture-required` value does nothing for Web Audio, so it cannot
  show whether a press really unlocks the AudioContext.
- Workflow agents launched right after an owner side-question all answered
  that question instead of their task. Always quote the owner's request
  VERBATIM in every workflow/agent context, and name the side question as
  already handled.
- Housekeeping after EVERY round, not only at the end: orphaned headless
  Chrome and `serve.js` processes once ran 1.5 days. Stop your own by PID,
  use a fresh `--user-data-dir` per run, and delete scratch profiles.
  PIXEL captures: `tools/pixel/shot.mjs` wraps CDP over the Playwright
  `chrome-headless-shell` (`--gpu` = ANGLE Metal) against `PORT=0 node serve.js`.
  It finds the newest installed `chromium_headless_shell-*` by itself (`CHROME=`
  only overrides). `--seed --heat --pace --gen` set those `world` fields before
  every room load, room 1 included, and `--pause` adds a PAUSE still per room.
  Time is virtual (held rAF, exact 1/60 s steps) and `Math.random` is seeded,
  so the same flags give byte-identical CLASSIC PNGs. The JSON report records
  the seed / heat / pace / gen read back and wall / brick hashes per shot.
  Every child is stopped by PID, also on a crash or Ctrl-C, and the `fg-px-*`
  profile is deleted after Chrome exits; the header documents every flag
  (`tests/shot-tool.test.mjs`).
- Blender is driven through the blender-mcp add-on socket `127.0.0.1:9876`
  with a small Python client (`.superpowers/sdd/2026-10-11-bible/blender/bl.py`,
  local only); the session `mcp__Blender__` tools time out.
- Fixed 2026-10-19 (v179): `sw.js` activate used to delete EVERY cache key
  `!== CACHE_NAME` (the whole shared `hmarzban.github.io` origin); it now
  filters on the `fusegrid-shell-v` prefix.
- An unbumped `CACHE_NAME` means the worker serves old bytes forever (cache
  first), which looks exactly like a change that did not land. Local headed
  checks after a code change: clear site data, or test in a fresh profile.
- Storefront live 2026-10-19: the About description leads with play-in-browser
  + three looks + Heat, the Social preview carries the v180 card, and the
  repo has 20 topics (GitHub's cap), so adding one means dropping one.
- Dropped by the owner 2026-11-01 for The Descent, kept as history (the old story files are not inputs and are never deleted). Research/design only, 2026-10-11, never built: the 2026-10-11
  menu redesign variants A/B/C (separate from the 2026-10-19 CONSOLE PANEL
  menu that shipped); story mode "FUSE/GRID: LOW TIDE"; naming (keep FUSE/GRID +
  subtitle; FUSEBORN is the only clean rename); game bible v2, COMPLETE as
  design (its fuse-fin shark-walker MAKO is SUPERSEDED as D1 by the hero
  reset below; six worlds W1 Mangrove Coast
  / W2 Dry Bay / W3 Glacier Stair / W4 Salt Waste / W5 Held Sea / W6 QUILL's
  Spire with themed foes and bosses MUDGE / RASP / TUSK / SIFT / HOLDFAST /
  QUILL; NOOK's TIDE LOG narration; story-first cold open; THE CAMP / THE
  CHART menus; 12 owner decisions D1-D12; sources in the git-ignored
  `.superpowers/sdd/2026-10-11-bible/`) — the owner's Claude Design canvas is
  the game bible, and nothing from it is built yet. Touch bugs found by the menu
  research: all three fixed 2026-10-19 with the menu redesign.
- Level variety (owner rulings 2026-10-20; issue HMarzban/fusegrid#8; record
  `docs/superpowers/specs/2026-10-20-level-variety-design.md`). BUILT in shell
  v188 (2026-10-26): #10 random board every run, #11 `fair.js`, #12 gen 2,
  #13 F2 / daily `g` / ghost gen, #29 capture flags (see the `src/core/`
  board paragraph above). Before it, 128 of 195 tiles never changed and one
  session replayed the same board. Measured on v188 (1000 seeds x 8 rooms x 3
  heats): 24 000 / 24 000 gen-2 boards pass `validateBoard` on their first
  layout and fill, 0 fallbacks, 0 rosters cut, 0 pocket leaks, foe minima
  10 / 12; distinct wall layouts per 1000 seeds 211 / 68 / 70 / 555 / 85 /
  999 / 949 / 281 (floors 200 / 60 / 60 / 500 / 80 / 900 / 900 / 250).
  Demobot (n 300, real `step()`): runs hit in the first 5 s fall in every
  cell, pooled 272 -> 142; lose % rises 32 -> 51 (reported, not gated: bold
  rooms are harder by design). Disclosed drift: rooms clear faster (bot
  room 3 CORE 68 -> 43 s), about 17 fewer bricks a room (JUNGLE about 6), so
  less brick score and old score bests get harder to beat.
  - **Random board every run** (`runSeed(bootSeed, i)`, #10), with NO new UI:
    no board code, no NEW/SAME BOARD label, no new key (owner: "just a random
    board"). Every ordinary run start is random, PAUSE RESTART and the GAME
    OVER restart included, which supersedes ruling 3. Losing a life keeps the
    board. DAILY and `?code=` runs keep their board, restarts included.
  - Issues #8–#30 were reviewed and rewritten for cold execution on
    2026-10-21 (HoE rulings H1–H29). Owner decisions O1–O12 are listed on #8.
    The layout templates are in
    `docs/superpowers/specs/2026-10-20-level-variety-layouts.md`.
  - **Local prototypes** (owner 2026-10-21: keep local). They are throwaway
    reference code on the owner's machine: never merge, never push, never
    delete. The worktrees are `git worktree lock`ed. (2026-10-25: the owner merged `tiles-d`, which is built on
    ac4f113e, a9489bfe, a531a182, ab0dfcf6 and a3057d0a, into local main, so
    those five are now in main's history; the rule still binds the other two.) Index:
    `.superpowers/sdd/PROTOTYPES-2026-10.md`.
    - `worktree-agent-ac4f113e8ef46ecff`: the gen-2 bold generator and the
      fair start.
    - `worktree-agent-a9489bfefcc2ae31f`: the wave-1 tiles and the
      tile-aware bot.
    - `worktree-agent-aa5098b8c6fb866ea`: the first tile mockup.
    - `worktree-agent-a2e5be46a8acb12a0`: the dropped board-code screens.

    Build from the committed specs and read the prototypes only for
    reference.
  - **#18 and #22 are MERGED on main (2026-11-01, `?gen=3` only)**: tuned rules,
    specs and the bot-side verdict are in the tiles record's 2026-11-01 addendum.
    #19 / #20 / #21 / #22 / #24 are built too (2026-11-01, later addendum: numbers
    of record). `src/render/relaytell.js` is BOOSTER's and, since v199, TRAP's read-only warning;
    `tileTip` and the FLOOR line teach; `PLATE_TPL` shapes PIT. Tiles went default in v198 with the
    owner waiving the playtest; TRAP's wind-up marks and the foe-in-lane rules came in v199, and the
    human playtest (#30) is still open. Wave 2 / 3 (STREAM, QUICKSAND, GATE,
    PORTAL, V28–V35) were built in v196: rules, numbers and what the bot cannot
    see in `docs/superpowers/specs/2026-11-01-tiles-wave-2-3-design.md`; no new tile reaches
    the MAX target for the bot (v199 re-measured with a bot that sees them), so the playtest decides. Oracle: `tools/balance/oracle.mjs`;
    fork switches `FG_BOTPLANT`, `FG_BOTBRAKE`, `FG_BOTLURE`, `FG_BOTJOY`.
  - Design pass 2 (#28) is DONE (2026-10-26): the dial works for TRAP (MAX
    +5.9), ICE PATCH (+4.6) and CONVEYOR (+5.4), all with 0 static no-escape
    spots; BOOSTER is an assist tile (owner B1). Owner picks O1/O3/O7/O8/O9
    and T1/I1/B1/C1, the per-heat specs and the lead gate rulings are in the
    tiles record's "design pass 2" addendum. Tuned code waits on branches
    (on GitHub, kept for reference) `pass2-trap`, `pass2-ice`, `pass2-conveyor`,
    `pass2-booster`, integrated by #18. Measuring: `tools/balance/`
    (#25 harness: `tilesweep.mjs`, tick-for-tick parity with the stock bot;
    static checks V13–V27 `featchecks.mjs` + `featreport.mjs`), dev-only,
    never imported by `src/`; `w.featProf` is a harness-only knob seam; real-GPU
    frame times `tools/perf/frames.mjs` (#34, takes the owner's focus). Then
    the verdict and human playtest (#30).
  - Bests stay keyed by difficulty + room ("not related to the shuffle board").
  - `world.gen` defaults to 1 (Node worlds). F1 codes, past dailies,
    ATTRACT and the intro show stay on gen 1 forever. Gen-3 boards copy F3
    codes (gen-2 boards F2); the daily switched to gen 2 with v188 and gen 3 with v198; the ghost key carries `gen`.
  - 14 BOLD layouts: one per biome, but 3 each for WATER / ARENA / CROWN.
    Heat changes only bricks.
  - A fairness check gates every board, including a sealed start and a
    walking-distance foe floor.
  - Tiles (2026-10-21, issue #16, tasks #18–#27; record
    `docs/superpowers/specs/2026-10-21-difficulty-tiles-design.md`): eight
    floor tiles on a `world.feat` layer, one per biome: BOOSTER (JUNGLE),
    ICE PATCH (ICE), CONVEYOR (FACTORY), STREAM (WATER), TRAP (ARENA),
    QUICKSAND (SAND), PORTAL (VOID), GATE (CROWN).
    - Owner rename 2026-10-21, "the most common naming": these names replace
      BLOOM / GLIDE / BELT / CURRENT / PLATE / DUNE / RIFT, which survive only
      in dated records, old comments, images and prototype code.
    - Difficulty is written "CORE (easy) / PLUS (normal) / MAX (hard)".
    - The fairness term "tile-forced trap" is now a **no-escape spot**, so it
      never collides with the TRAP tile.
    - HEAT turns each tile's dial: CORE gives joy, MAX gives challenge. Pace
      scales tile speeds only (owner O1, 2026-10-26).
    - A tile never starts damage on its own.
    - Tiles sit in the same places at every heat.
    - Heat is shown by edge, mark count and tip shape, never colour.
    - Wave 1 is CONVEYOR, ICE PATCH, BOOSTER and TRAP.
    - PIXEL tile art waits for #15. GATE waits for the REAL 3D mid-room wall
      redraw.
    - **Direction D (owner ruling 2026-10-25, "Go with D, the A+B mix"):**
      the round-3 emblem-in-a-frame look is superseded. Built worlds (ICE,
      FACTORY, ARENA, VOID, CROWN) get hardware sunk into the floor; JUNGLE,
      WATER and SAND get the ground itself changed. No raised chamfered slab
      on a tile (slabs are WALLS). Record
      `docs/superpowers/specs/2026-10-25-floor-tiles-direction-d-design.md`,
      plan `docs/superpowers/plans/2026-10-25-floor-tiles-direction-d.md`.
      BUILT on branch `tiles-d` and merged into LOCAL `main` 2026-10-25
      (`64662c3`; not pushed, not in the live game): painters
      `src/render/featart/{built,living,geo,kit}.js`, PIXEL `featpx.js`, REAL 3D
      `three/featmesh.js` (`fragSource(GEO)`: the shader reads the painters'
      geometry table, 142 draws). Gates: `tools/tileart/gates.mjs all`
      (heat separation >= 4 at 40 px, busyness <= 1.6x round 3, bed vs BRICK
      dE >= 14, slot hull, VOID dim in 2D/PIXEL/3D, seams, key light); the old
      "marks <= 30 %" gate was replaced because the D painters have no marks-only
      pass. Option sources: `.superpowers/sdd/2026-10-25-tile-art-d/source/`.
    - **Integrated prototype build (owner 2026-10-25: "refactor all with the new
      wall and floor", "A and B together"):** branch `tiles-d` = walls round 3
      + direction D tiles (all 8, PIXEL included) + base floor restyle
      (`src/render/floorart.js`) + PIXEL tree as a lazy import (#15,
      `pixel/load.js`; `hudart.js` lives in `src/render/`) + art-only STREAM /
      QUICKSAND / PORTAL / GATE on gen-2 rooms 4 / 6 / 7 / 8 + board outline
      option A (world bezel, `frameart.js`, `three/rimart.js`; SUPERSEDES ruling
      W6 "plain border") + option B (recessed well, `frame.js`,
      `three/wellfx.js`; 3D stage background is CSS on `#gl`). A real page played
      gen-2 boards by default on the branch; v185 (owner ruling 2026-10-25,
      "Today's boards") makes gen 1 the default everywhere and `?gen=2` the only
      way to the tile boards (`flags.js`; a `?code=` never plays them). v188
      (O2) moves the tile boards to `?gen=3` and makes tile-free gen 2 the
      default for ordinary runs and the daily. (Pins at that step: CLASSIC `6ec1e0a5:65648`, px cap 145 KB; current
      values are below.)
      Option C (stage set) sits unmerged on branch `frame-c`, not to be merged (lead ruling 2026-11-01).
      Depth round (shadows, AO, brick value down, floor detail, 3D relief,
      PIXEL floor, stage fixes) and AMBIENT MOTION (owner 2026-10-25) are in:
      `src/render/ambient.js` is the one deterministic spec (`particleAt`,
      per-world motes / glints / steam / drift) read by `ambient2d.js`,
      `three/ambientfx.js` (one `Points`, +1 draw: 142 / 143 in a tile room /
      144 with a ghost) and `pixel/ambient.js` (stepped 8 Hz). It runs on a
      renderer-owned PLAY-only clock (`ambientClock`; `world.time` keeps ticking in
      PAUSE, so never use it), EFFECTS LOW halves the count,
      prefers-reduced-motion turns it off, nothing cycles faster than 2.4 s.
      Menus and the title draw none; ATTRACT draws it (`main.js` hands
      `{hud:false, amb:true}`, every renderer reads `o.amb`). FOES AND ITEMS (owner 2026-10-25): the shared
      timing spec is `src/render/motion.js` + `entityfx.js` (`fxOf(world, look)` turns
      `kill` / `power` into ghosts and bursts on each look's PLAY-frozen clock);
      REAL 3D fat-world is now 156 draws (158 worst case; budget 160); the 2D foe
      silhouettes are canon for all three looks; pickups never change shape or
      colour. CLASSIC hash `9fb48f0a:72431`; px cap 160 KB (the px tree is a lazy
      import since #15, about 160 KB after the v189 chevrons; cap 192 KB since v191).
- Walls (owner rulings 2026-10-21; built, in the live game since v185 with the board look; issues
  #17 for CLASSIC 2D + REAL 3D and #31 for PIXEL after #15; record
  `docs/superpowers/specs/2026-10-21-wall-art-design.md`).
  - **W1:** ships SOON on today's gen-1 boards; the CLASSIC hash is re-pinned
    by ruling.
  - **W2:** visual only; walls never break.
  - **W3:** direction B, Living world, without cracks: a material family per
    world, every variant built detail, never damage.
  - **W4:** brighter REAL 3D walls via a white per-instance colour; the wall
    colour was applied twice before.
  - **W5:** CROWN gets a gilt frame.
  - **W6:** the border is a plain rampart and SHRINK walls are the base block.
  - The variant pick is a render-side `wallHash(seed, level, x, y)`, never
    `world.rng`, with one accent per room.
  - REAL 3D stays at 141 draws (a per-instance cell index on the one wall
    mesh).
  - Local prototype: `worktree-agent-a531a182f96a26f7e` (locked).
  - Art round 3 (2026-10-23, record addendum) is the art target: a WALL face
    never echoes the BRICK's courses or mortar (shape, checked by
    `tools/walls/gray.mjs`), every mark has a cause, REAL 3D adds relief +
    per-world gloss + contact AO in the one wall material at 141 draws.
    Floor tiles got the same pass (converging QUICKSAND, PORTAL pips, GATE
    whole-side timer, slow PLAY-clock 3D effects at 142 draws). Prototypes:
    `worktree-agent-ab0dfcf6e3434b2c3` (walls) and
    `worktree-agent-a3057d0a51e6a8d96` (floor), both locked.
- Hero direction reset (owner ruling 2026-10-11, concept only, never built; SOLIN was dropped by the owner 2026-11-01 for The Descent's WICK, itself awaiting approval on local branch `descent-design`; MAKO stays the live hero): a
  cartoon with a head, arms and legs, "googooli" (appealing yet dignified,
  smart, stylish), NOT human, space theme — a small being of starlight held in
  a clean flight suit, dark visor with two glowing almond eyes, crown-flame,
  jetpack, a bomb gauntlet on one hand. Gold/ember is its LIGHT, never its
  paint (they are the blast's own FIRE colours; measured). Owner picked
  concept B (light limbs), asked for it cozy, then supplied their own design
  pack: SOLIN v1 is the LOCKED identity (cream pebble helmet with brass ear
  pods, NO head flame, glowing almond eyes + blush, oat scarf, navy quilted
  vest with heart star + left pocket, light limbs with brass cuffs, right
  Forge Mitt, cream boots, copper kettle jetpack; never mirror sides). Use
  the owner's own PNG frames as they are (owner, 2026-10-11: "why you did not
  use the charechter images I just gave you?"); never redraw or "improve"
  them, report art problems instead. Working name SOLIN; story
  fit still deferred; sources in the git-ignored
  `.superpowers/sdd/2026-10-11-hero/` (`solin-v1/`). Before any build, re-target
  the one-chromatic-body 2D hero gate in `tests/items-art.test.mjs`.
- `world.time` keeps ticking in PAUSE (`step()` adds dt before the state check), so
  any "PLAY-only" animation needs its own clock (`ambientClock`, `world.featT`).
  Node test fakes define `globalThis.location` WITHOUT `href`, so "is this a
  real page" means `typeof location.href === "string"` (the branch's gen-2 page
  default depended on it; the tile boards were `?gen=3` only from v188 to v197).
- Release state (2026-11-07): shell **v201** (CONTROLS: controller play, rebinding, the CONTROLS page in the menu kit, VIBRATION levels and patterns with MEDIUM by default, SENSITIVITY levels, hints that follow the device; 578 tests; record `docs/superpowers/specs/2026-11-06-controls-built.md`) is LIVE: pushed to `main` on 2026-11-07 on the owner's word as one squashed commit (`ad2e940`, with the new share card beside it, `334ea8b`; `feature/controls` is never pushed, its history carries local notes), Pages CI green, live `sw.js` v201; GitHub release **v2.4.0**, shell v200 → v201. The owner played it on a real controller and reported it works, details not yet reported, so its human checks M1-M7 ship open, and the VIBRATION test buzz was felt on a real pad on 2026-11-03 (in-run patterns not yet reported). Shell **v200** (loose ends: PASS no longer causes false holds, GATE tips mention the hold, no crash on a hand-made conveyor loop; no board changes; GitHub release **v2.3.1**, shell v198 → v200) is LIVE on the owner's word. 478 tests. Shell **v199** (TRAP warning marks and arm sound, `carryPins` and `gatePins` keep a tile from closing your only way out, faster board building, bot and harness see every tile; BOOSTER flare dropped by the owner; record `docs/superpowers/specs/2026-11-02-tiles-finish-v199.md`) is LIVE on the owner's word. 475 tests. Shell **v198** (GitHub release **v2.3.0**, shell v188 → v198) makes the tile boards what everyone plays: ordinary runs and the DAILY deal gen 3, `?gen=3` is gone, F3 links exist (owner: "Ship without a playtest", waiving #30's playtest; record `docs/superpowers/specs/2026-11-02-tiles-default-v198.md`, with the known risks). Older text below that says `?gen=3` is history. Shell **v197** (loading bar, REAL 3D new-world freeze fix #36, boot graph minus 75 KB raw, and on `?gen=3` BOOSTER marks, ICE brake tip, REAL 3D heat look; rulings and numbers in `docs/superpowers/specs/2026-11-01-loose-ends-v197.md`) is LIVE on the owner's word (2026-11-02). A design on local branch `descent-design` is unmerged and stays unpushed until the owner says.
  Shell **v196** (rules for STREAM, QUICKSAND, GATE, PORTAL, all on
  `?gen=3`; no change in a normal run) is LIVE on the owner's word.
  Shell **v195** (BOOSTER warning, tile tips, FLOOR
  line, PIT placement, all on `?gen=3`; no change in a normal run) and **v194**
  (install screenshot label, listing art in CLASSIC 2D and PIXEL) are LIVE on the
  owner's word. Shell **v193** (tuned tiles on `?gen=3`, `KeyK`
  unbound, `?net=local` follows every run; no change in a normal run) is LIVE on
  the owner's word. **v192** (tiles design pass 2 docs, the
  #25 harness and static checks, the harness-only `w.featProf` seam; no player
  change) is LIVE on the owner's word; v191 raised the PIXEL cap to 192 KB; v190 fixed PIXEL SAND's floor vs bricks and raised the cap
  to 176 KB; v189 added the hunter lock-on tell (#32), the tile colour-vision
  gate (#33) and the #35 tile-world pin.
  Shell **v188** (level variety: a random bold, fair board every run, F2 codes,
  daily on gen 2) is GitHub release **v2.2.0** (shell v178 → v188; v2.1.0
  covered v103 → v177). Shell **v185** (the board look + opt-in GA4) went
  LIVE 2026-10-26; **v187** turns the consent ask into a corner card; **v186** is its hotfix (`#upd[hidden],#ana[hidden]`: an
  author `display:flex` beats the UA `[hidden]` rule, so neither card ever hid;
  `tests/hidden-css.test.mjs` now gates every `#id` display rule). The owner
  pushes, or says "push". Boards: gen 3 (bold mazes with tiles) for
  every ordinary run and the daily since v198, gen 2 for F2 codes, gen 1 for F1 codes / ATTRACT / the intro. Branches `tiles-d`, `frame-a`, `frame-b` are
  deleted (merged); `frame-c` (stage set) stays unmerged. The look is recorded in
  `docs/superpowers/specs/2026-10-25-board-look-depth-ambient-design.md`,
  including the loose ends. Loopback dev server: `PORT=8091 node
  serve.js` in the main checkout (clear site data first, or the old SW serves old bytes). The hash pin, px cap and draw counts live in
  that record, not here.
- Parallel art agents on one worktree work best as one lane per file area with
  the lead committing: agents never commit, never edit the CLASSIC hash pins,
  and report; the lead re-pins once at the end.
