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
| Shell | INTRO (title → show) → MENU ⇄ LEVEL/RECORDS (SCORES ⇄ STATS ⇄ TROPHIES tabs)/SETTINGS(→GRAPHICS)/GUIDE(→HOWTO/ITEMS/ENEMIES/FLOOR) → GAME; idle → ATTRACT | `src/app/menuapp.js` |
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
main's `let show`, never `demo`), plays under the title and the show and is
dropped for good at GAME / ATTRACT; MENU covers the board (the room look opaque
from its first frame, the plate, logo and foot fading in over 0.25 s), so no
blast is seen under it. In 3D the title paints an opaque veil until three
settles (`app.boardReady`, set on resolve or reject). The first load (v209,
`index.html` `#loadst`) draws the title being made where the title paints, so
the hand-off is its spark arriving at the tip: when it was on screen
(`__load.lit()`: 150 ms with the boot job alive, latched at its end) shellview
`settledTitle` hands `drawIntroChrome` `settled` and the logo starts at rest
(no fade, slide or pop; the prompt keeps its fade from 0.6 s). A cached visit
that never saw it, and a deep link, keep the reveal.

The wordmark is logo B (LIT FUSE), drawn by ONE painter, `src/render/logo/draw2d.js`
`drawLogo2d` (UI upgrade Task 7.2), from `glyphs.js` / `worlds.js` `plan()` alone,
in the world of `app.level`, in the look on screen (Task 7.3): `shellview.drawShell`
calls `setLogoLook(kind)` once a frame (`curKind`, so a look still loading paints
CLASSIC) and each lazy tree calls `registerLogo(kind, f)` when it loads; `f` swaps only
the world-layer fill, the spark sprite, the tip and the face colours, while placement,
plate (`paintPlate`), memo, cache and the spark clock stay `drawLogo2d`'s, the look and a
registry epoch in the memo and the look in every layer key. PIXEL is
`src/render/pixel/logo.js` over the palette-slot grids in `pixel/art/logo.js` (the
appendix 8.6 / 8.7 hand grids; the 24 cap sampled from the vector glyphs at pixel
centres with `inGlyph`, never a pixel read; title 24 art px a cap, MENU 12 in the
cream `eye` build; drawn NEAREST at ceil(u x dpr) device px an art px, then scaled
smoothed, R20; at true scale, u = cap / A: its envelope is taller and wider than
CLASSIC's, so the look's `grow` widens the layer round it, the title inside its plate's
bed, MENU by the box's width, its taller envelope standing into the plate header above
and below `G.lbox`), imported by `pixel/renderer.js`: 9,148 B inside its 9 KB
sub-budget of the px tree (lead ruling; `tests/logo-looks.test.mjs` holds it at 9,216 B),
written dense (no spaces round operators, `three/wrapper.js`'s style). REAL 3D
is `src/render/logo/draw3d.js` (Canvas 2D only: no `vendor/` or `render/three`
import), loaded beside `wrapper.js` by `three/load.js` (precached with the 3D look,
in its loading bar's files and fetch-first list: `loadbar.test` walks both);
`three/wrapper.js` never imports `logo/`. Its side is the built 70 / 30 lip / world mix
(`SIDE.variant` "mix"; "lip" is the spec's, the owner's veto option, its own layer key);
its blurred shadows are stacked offset fills (no filter). Under the probe the logo
records its look (`logo px` / `logo 3d` / `logo 2d`), the title plate and each face
against bare bed as a locked info pair (`logoProbe()`, after the page); the title
records `begin("title")` and its prompt, so `gates.mjs` judges the title (its row
exempts chosen, band, ring, locked, touch and gap). The
title (`menudraw.drawIntroChrome`, `titleLogoBox`) is the full-colour build on the
kit plate, line on `d` / `l`, stacked on `p`, CENTRED on the board (Task 9.11, owner: "the fuse grid must be in
center of board not in top"): a box centred on H / 2 inside a 12 px margin of `#c`, as tall as leaves the prompt's
backing room to hang 10 px under the plate (`titleLogoBox` `py`; the contact sheet's pick over the prompt at the board's
foot), so the plate's outer extent is centred on H / 2 whatever its build: the geometry's FITTED title (`worlds.js` `titleFit`, `plan({fit})`,
`PLATE.title.fitted`: the mock's plate scaled as one piece, pad, ring and bed tile
x cap / 88 or 76, the kit plate's fixed reach outside, tier title whatever the
cap; cap 67.93 at 600x520, 103.69 stacked). The reveal fades, slides and pops the
whole logo (0.92 -> 1 over 0.45 s, the old GRID letters' pop; none under `o.settled`). The title waits lit,
the spark flickering at the tip, and keeps it there through the show's 0.3 s exit:
`TITLE_RUNUP` (false, lead ruling; one constant the owner may flip) would run it
up the cord instead; the run-up stays reachable as the painter's `o.run`. MENU's
is the cream build, no plate, cap 36 design px in the MENU page's plate header
(`pages/menu.js` `G.lbox` at scale `G.lk` = max(u, 20 / 36): under a 20-unit cap the
plan has no MENU build; Task 3.1): apart from the spark the logo paints no `#ffd447`
on MENU. Static parts are `kit/cache.js` layers:
one world-independent `logo.mask` atlas per build, version, cap and dpr, one tinted
layer per world, one `logo.spark` sprite of frames A / B / reduced whose cell is the
spark parts' own reach. A steady frame is a memo check, one `getTransform` and two
blits: the placement, plan and both layer canvases are kept per place until an
input changes or the cache frees one (0x0, asked for again, never drawn); it
`touch()`es the two layers it blits, so the cache's LRU takes a stale layer first. The spark
is `floor(t * SPARK.hz) & 1` on the page clock, frozen on the reduced frame under
prefers-reduced-motion or REDUCE FLASH. CSS minimums take `o.css` (CSS px per box
unit, default 1; `shellview` has no stage scale at hand, so it passes none). Masks
never read a pixel or blur (path dilation, whole-px sweeps, octagon closings by
doubling). No canvas source (Node) draws nothing; `_dbg` records only while
`_dbg.on`.

Heat grades CORE / PLUS / MAX live on LEVEL SELECT (its DIFFICULTY row; see LEVEL SELECT below). CORE is replay baseline v6. Attract is always CORE + pact=0. After a first FUSE/GRID CLEAR, LEVEL SELECT also offers Pact toggles (`1–4`). Knobs live on `world`, not frozen `CFG`. Score × heat is persist-only (CORE ×1 / PLUS ×2 / MAX ×3); live HUD stays raw.

MENU is seven rows in this order: `PLAY, LEVEL SELECT, DAILY, RECORDS, SETTINGS,
GUIDE, SOURCE` (UI upgrade v202 Task 2.2, design record §4). `confirm()` dispatches by **label**, so an insert
moves no runtime index — but `tests/headless.test.mjs`'s index-driven MENU
confirms and `tests/menuapp.test.mjs`'s literals must be renegotiated with any
reorder.

RECORDS (ruling R7) is no SCREEN: its row opens SCORES, and SCORES · STATS ·
MEDALS (`SCREEN.SCORES` / `STATS` / `TROPHIES`, menuapp `RECORD_SCREENS` /
`isRecords`) share one tab strip (the kit tabs of `src/render/pages/records.js`, bricks in a wall trough under the RECORDS
title, one `recordsGeom` for draw and tap, Tasks 4.1 / 4.2; menudraw `recTabHit` delegates). `app.recFocus` 0 is the tab
row, the top of each page's ↑↓ walk, where every arrival lands; 1 is the body
(SCORES' difficulty filter, STATS' foot actions; MEDALS has none). Tab steps
go through `app.recTab(d)` (←/→ on the tab row, `Q` / `E` anywhere on the
three pages, a tab tap, STATS' `T`): clamped, one `uiMove`; every arrival at
STATS calls `onStats` (the event ring's opt-in), at MEDALS `onMedals` (its
rows only). Any `recTab` call disarms an armed STATS reset, a tap on the tab
already shown included; R arms and any input that is not the second plain R cancels it: any other key in main's `onUiKey`,
a chorded R (Ctrl / Cmd / Alt / Shift, `controlswire` guard: never arms or erases), Y / N answering the consent card and its
taps, its body and Privacy link included (`analytics.js`), the update card's LATER and backdrop taps (`update.js`), the inline
load-failure card's Enter / Escape, RETRY / USE CLASSIC 2D taps and a controller's SOUTH / EAST (`reset.js` `guardLoadCard`, wired by main:
a document capture listener for a target in `#load` and the two buttons' `onclick` wrapped; it keys off the ids `loadretry` / `loadkeep`, which index.html keeps), any controller press or fresh direction in
`padroute.route`, a swallowed first press after a connect and a card's answer included, and any tap but AGAIN ERASES (a
touch C disarms at its pointerdown, so a cancelled C still cancels). Armed, the confirm plate is modal: a tab tap only
cancels. A desk foot zone answers only in the armed state it was painted in (`footHit`), so a second click before the armed frame
paints is never the second R. On those pages `Q` / `E` never also confirm. Esc, Backspace, Enter, EAST and START from any of them:
MENU on RECORDS, except close-first (R1 cohesion ruling): on an armed STATS, Esc / Backspace / EAST cancel the reset only, as a tap does, and a
second press leaves (`back()`; main's `onUiKey` and `padroute` leave the arm for it).
RECORDS page (UI upgrade v202 Task 4.1; `src/render/pages/records.js`, LAZY: one `pages/lazy.js` entry `records`, loaded in the first idle
after MENU's first frame; until it lands menudraw paints THE LOADING plate (`loadingPage`, see Lazy pages) and every RECORDS hit is -2, inert,
so a tap never backs out of a page still loading (DID NOT LOAD: a tap off the plate backs out); tests `want` / `_set` it). The room of `app.level` opaque under it (MENU's own room layer
at MENU's room dpr (`kit/room.js` `pageRoomDpr`, MENU's rule (`pages/menu.js` `roomRule`) with `rev`, capped by the page's own fit; R1 train: the one rule of MENU, LEVEL SELECT, SETTINGS, GUIDE and RECORDS, no logo reserve; with no canvas source the kit answers 1), whatever MENU last painted: no re-raster on a MENU <-> RECORDS trip; `shellCovers` SCORES, STATS and TROPHIES). `recordsGeom(F)`
(F = MENU's frame: W, H, touch, shell, css, ts; the pointer hands RECORDS `layout(cw, ch, lg, css)`) is one plate for every tab: desk
(keyboard boxes; the S7-pages frame, plate 980 wide, 1080 at 125 %, kicker MENU over the RECORDS title, tabs 150 x 36 over an 11 px trough,
the pane as tall as the tallest body, the foot under the plate, label first, keycaps last; a shorter window gives way before it scales, fix
round 1: `SHORT` steps 1 margins, 2 pads and gaps, 3 tighter bodies, then 4 STATS' course, 5 the MENU kicker and LIFETIME pitch, 6 one-line
bests, 4-6 only where they make it fit at `FIT_U` 0.995; the plate narrows by up to `PW_GIVE` 40 first; 1366x657, 1280x650 and 1024x600 keep
every floor at 100 %; #c's 600x520 and the iso guard scale at step 3, every word kept; the foot plaque is inert, its BACK backs out), phone (a
touch-portrait shell box, CSS px: BACK key and title, three equal 44 px tabs, the pane to the plate's foot; no foot), the touch-desk form (R1
cohesion 3: any other touch shell box, a landscape tablet, while its scale holds `TOUCH_U`, as MENU, LEVEL SELECT, SETTINGS and GUIDE: the desk with
the tabs and the DIFFICULTY bank floored to 44 CSS px, STATS' COPY STATS / RESET keys under its body, the touch confirm plate, and in tap mode the
foot `REC_WORDS.TAP`, armed `TAP ANYWHERE ELSE TO CANCEL`; `tests/landscape.test.mjs` sweeps the five pages' arrangement on a tablet) and compact
(any other touch box, the landscape phones' #c and a short tablet window: BACK, the title where it fits, the tabs in one header row; the plate at
most 980 wide). On phone and compact a controller (`hints().dev === "pad"`) adds a cue line at the plate's foot under the pane (R1 cohesion 2, lane
lesson 6; `cueItems`): `TAB [D-PAD] · BACK [EAST]`, STATS first `COPY [WEST] · MEDALS [NORTH]`, label first, parts dropped whole from the front. SCORES: the DIFFICULTY bank (the R7 filter;
its keys stay 44 CSS px on touch), BADGES (the four plaques, bits CLEAR / PLUS / MAX / CROWN as words.js `BADGE_NAMES`: earned = an ink word
in the medal-colour outline (a stroke: the medal colour is never a fill), not yet a lock tag; two lines on a narrow table, dropped first where a short touch box would shrink the table under `BADGE_K` 0.8),
the ten-row table RANK · SCORE · LEVEL · MODIFIERS (a count by `modsCount`, R10; no modifier glyph exists) · DATE, stepped down to a bare
count, then the month and day; under 520 design px wide each row stacks its modifiers (NO MODIFIERS for none) and full date under the score.
The rows arrive with `highscores.isPlaceholder` rows dropped (main's getter), so a fresh profile reads NO NORMAL DIFFICULTY RUNS YET. MEDALS:
eight sunk tiles (earned: the medal outline and its centre ring, both strokes; a goal: the outline in t2 with a small lock), each goal whole (wrapped, never cut), `n/8 EARNED`. A body taller
than its pane on a touch box pages (R1 landscape: on a touch `#c` one row / tile a page is enough, the frame's margins and pads close (`LAND`), SCORES
splits where not one row fits beside the badges: the bank and badges first, the table after under a kicker naming the difficulty (`diffTag`), the
bank answering on page 1 only (`scoresHit` / `statsHit` take the page shown); STATS pages by parts (a kicker with its first line, every ledger line,
the tiles) with COPY STATS / RESET as the last page's foot); it scales only on a 568 x 320 phone (the named exemption, `tests/landscape.test.mjs`). Cached: one page layer per tab
and data (plate, header, trough, tabs at rest, pane, body at rest), one foot layer per focus, the room; live: the open tab (lit brick), the
focus (bare bomb + 3 px ring on the open tab, or on the chosen difficulty in the body; never in tap mode, as LEVEL SELECT; the bomb is never
dropped: a legend that will not fit beside it steps down to its 100 % size, then, on the landscape phones' #c only, to what fits), the chosen
difficulty and SCORES' rows. A focus move or a
filter step misses nothing; a tab step paints its page and foot once. STATS (Task 4.2): app/stats.js `statsView` (the numbers:
runs, secs, medals, the lifetime counters, the hero = the saved best with the highest score and its difficulty / modifiers / speed
from its key, `far` = the highest level any bucket saved, the three plain-bucket bests), worded on the page: the hero (BEST SCORE,
its qualifier on up to two lines, the score in brick digits; then, apart, the 8-level course lit to the furthest level only, 6–8 wall
cells while locked, flags on 5 and 8, and FURTHEST LEVEL n · WORLD: lead ruling, fix round 1, `nb.bests.v1` keeps a bucket's score and
level as separate maxima, so the page never pairs them as one run; NO RUNS YET with none), three sunk stat tiles (RUNS, PLAY TIME as `3h12m`, MEDALS n/8), the LIFETIME
ledger, BEST BY DIFFICULTY · NO MODIFIERS · NORMAL SPEED (its kicker breaks once wherever one line at 0.648 em would pass its column,
100 % included; the plan draws one line only where it measures inside; two-line rows, each empty best a —, the level under the difficulty, the best one's pip a
brick), the cabinet notes (desk only; on the phone they drop, their facts ride the copy payload and MENU's DAILY teaser). A touch body too short steps down (`statsBody` tight: gaps 10, the level course drops, LIFETIME pitch 27, the stat tiles tighten (`TILE.t`), then one-line bests only where that makes it fit), then PAGES instead of scaling (fix round 1b, lead ruling; SETTINGS' paging is the reference): whole sections per page (hero, tiles, LIFETIME, BEST BY DIFFICULTY, at tight 1), a `PAGER` strip of PAGE n OF m and ▲ / ▼ keys (the kit pager's, 46 CSS px, 10 apart) above COPY STATS / RESET. SCORES (whole table rows, the header and badges on each page, `MIN_ROWS` 3; its page count follows the rows drawn: `recPages(F, "scores", rows)`, an empty table is one page with no pager) and MEDALS (whole tiles, one column, `MIN_TILES` 2) page the same way on a touch body too short for them. ↓ / ↑ in the body (keys, a controller's D-PAD; MEDALS on its tab row) walk the pages and ↑ on the first page leaves for the tabs (menuapp `recPage`, `_recFocus`, clamped to `recPages(screen)` main hands from shellview `recPagesOf`), a tap on ▲ / ▼ is `recPageStep` (pointer through menudraw `recPageHit`), tap mode keeps the keys, every tab arrival and every entry through the MENU RECORDS row opens page 0, menuapp `update` clamps `recPage` when a resize shortens or unpages the body, and the armed confirm plate stays one page (it starts in the pane, never over the tabs; below AGAIN ERASES, which stays above the idle COPY STATS / RESET keys, it may run on over the dimmed keys, so a short phone keeps the sentence at its floor). 360 x 780, 375 x 667 and 393 x 852 hold the floors unscaled on all three tabs at 1 and 1.25 (STATS 2 / 3 / 1 pages at 100 %); only a section, row set or tile taller than a page (the landscape phones' #c) still scales. The armed sentence names every group in either list (`resetSentence` throws on a group with no words, `RESET_WORDED`). RESET
is quiet at rest (the foot on a keyboard, `COPY STATS` / `RESET` keys under the pane on touch). Armed: the page dims under a
confirm plate (ERASE ALL RECORDS?, one sentence = words.js `resetSentence(CLEAR_KEYS, KEEP_KEYS)`, the lists main hands in as
`app.stats.wipe`; `RESET_GROUP` names each store key and words.test pins it equal to reset.js's lists), AGAIN ERASES focused (the
band face, cream label, the R keycap last) beside COPY MY STATS; its foot `ERASE R · COPY C · ANY OTHER KEY CANCELS` (ERASE is no
tap target: only AGAIN ERASES erases, so a double tap on RESET never does; on a touch box AGAIN ERASES never touches the COPY STATS /
RESET keys for the same reason). A landscape phone's #c (compact, R1 release ruling): armed, the confirm plate IS the page's plate, the head
and tabs hidden under it, with words.js `resetShort` (every group still named, `RESET_SHORT`), the title, sentence and cancel line above the
keys, AGAIN ERASES >= 8 from the idle COPY STATS / RESET keys (at the plate's foot under them, else above them), lines counted with the real
measure (records.js `gctx`, test seam `_measureWith`); the words keep their size, else shrink to the phone floors, then (667 x 375 only,
where the keys stack: a named exemption in `tests/landscape.test.mjs`) to a 9 px cap, never under. `statsHit` returns KeyC / KeyR / KeyT (a foot label
from the painted foot's zones, or a touch key), "back", "plate" (inert) or, armed, "cancel". COPIED / COPY FAILED is a tag at the
right end of the title row.

Names (UI upgrade v202, Task 2.1; owner: "we must use the name that users know
about"; design record §3). Players read SETTINGS (was OPTIONS: MENU row, page
title, PAUSE row), LEVEL (ROOM, LV, L3), DIFFICULTY NORMAL / HARD / EXPERT (heat
CORE / PLUS / MAX), GAME SPEED SLOW / NORMAL / FAST (pace EASY / NORM / HARD),
MODIFIERS ONE LIFE / NO FLOOR ITEMS / FEWER ITEMS / SHRINK + TIME TRIAL (MODES
IRON / BARE / THIN / SHRINK + TIME), POWER BOMB (the POWER pickup, in
`POWER[].name`, still the one source), ART STYLE (RENDER), POWER-UPS (PICKS,
ITEMS, CUBES, PICKUPS). A difficulty or speed value is printed with its setting's
name wherever nothing beside it names the setting (`EXPERT DIFFICULTY`,
`FAST SPEED`), on its own line or row, because NORMAL is both; DEFAULT RULES
is the plain run (NORMAL difficulty and speed, no modifiers). `src/render/words.js`
is the one table (`DIFF`, `SPEED`, `MOD` by PACT bit, `TIME_TRIAL`, `LABEL`, `PAUSE_WORDS`, the run ends' `END_WORDS`,
`DEFAULT_RULES`, `tagFor`, `runWords`, `runParts` the one non-default filter,
`modsCount` and `levelsOf` the one singular / plural); src/app may not import
it, so its few player strings (`ITEMS`, `OPT_ROWS`, `PAUSE_ITEMS`, `GUIDE_ROWS`
labels, stats rows and payload, the daily share line, medal rule copy, `gfx.js`
LOCK_3D, the consent card) are literals that
`tests/words.test.mjs` pins equal to it, with a render sweep and a source grep
for the old words and for a level shorthand built at runtime (`" · L" + n`). Display only: stores keep their keys, bits and indices
(`nb.pact.v1`, heat 0..2, pace -1..1, medal bits), analytics event names and
params are byte-identical, identifiers keep the old names (`heat`, `pace`,
`pact`, `SCREEN.ITEMS`, `OPT_ROWS`), and core keeps `HEAT_NAME` / `PACE_NAME` /
`PACT_NAME` / `pactLabel`. The HUD reads LEVEL and, off NORMAL, the difficulty
word (R9, UI upgrade Task 8.2; `words.js` `HUD_CHIPS`). Medal proper names stay (IRON CROWN).
The paragraphs below use the internal names (heat, pace, pact, room) for code.

Menu look (owner pick 2026-10-19, direction A "CONSOLE PANEL", since replaced page by page): every plated page is on the world kit (MENU,
LEVEL SELECT, SETTINGS / GRAPHICS, GUIDE's pages, RECORDS, the PAUSE list and, since Task 6.3, CONTROLS: the owner's "I think you forgot to work on
the cntroller side ha?" reversed the 2026-11-02 ruling that kept it a CONSOLE PANEL page); values, tags and hints are sans, keycaps mono. The
CONSOLE PANEL kit in `menudraw.js` (`plate`, `head`, `foot`, `paintRow`, `listGeom` / `listHit`, `pageBox`, `segs`, the ellipsis `clip` / `wrap`)
is gone with its last page; menudraw keeps only the fonts and colours the controller drawings' glyphs read (`TEXT`, `MUTED`, `sans`). MENU is on
the world kit since UI upgrade Task 3.1 (MENU page, below). Build tag (owner 2026-10-21: "a game version in some where in
the display or menue"): `v219` (today) = `CACHE_NAME` minus `fusegrid-shell-`,
derived ONLY in `shellview.js` (`REV`, handed to `drawMenu` / `drawSettings`
as `rev`) and `update.js` (the card's "You are on v219", the running build,
never a guessed next one) — never a second literal. The desk MENU's foot ends
`| v219`; the phone column carries it as SOURCE's teaser (the round 7 frame);
SETTINGS keeps its `BUILD v219` kicker. Never on the HUD.
PAUSE is on the world kit since UI upgrade Task 5.1 (`src/render/pages/pause.js`, boot; `scenes.js` re-exports `PAUSE_ROWS`, `PAUSE_SHAPE`,
`PAUSE_ROW_H` / `_D`, `pauseGeom`, `pauseHit`, `pauseKick`, `pauseKickers` / `pauseKicker`; the round 7 S7-pages 10-pause frame). It sits over
`#c`'s frozen board in all three looks, drawn on the stage (`#sh` over `#c` at device px, Task 9.12; on a portrait phone on `#sh`'s over box under the HUD plate, Task 9.8: see SHELL BOX), through the one painter `drawPause` that `drawOverlay`'s PAUSE branch calls (view 0 only; views 1-3
keep their own painters and the old 0.72 veil), in the tokens of the room being PLAYED (`world.level`), under the kit veil (`#0b0609` at .6).
Top to bottom on the kit plate: a centred kicker `LEVEL n · WORLD` (` · DAILY` on a daily; a controller note replaces it, the look tail rides it
through `pauseKick`), `PAUSED` (display 34 desk / 26 touch), a tag row from words.js `runParts` (only non-default rules, each naming its setting,
TIME TRIAL when timed; at most 3 then `+N`, EXPERT bare where that shows more; none for a default run), 30 px clear (34 at 125 %, 24 / 26
touch), RESUME (the one yellow key; the back key's cap at its end on a keyboard layout), SETTINGS (door), the wall-course divider at `pauseGeom`'s
`div`, RESTART and QUIT TO MENU (coral at rest, cream on the focus band; QUIT's `M` cap on a keyboard layout, a back glyph on touch or a
controller), the foot `MOVE ↑↓ · CONFIRM ENTER` (a controller `MOVE D-PAD · CONFIRM SOUTH`, touch `TAP A ROW`). Focus: RESUME the bare bomb +
the 3 px cream ring, a row the band + the bare bomb. `pauseGeom(B, touch, {css, world, time})` / `pauseHit(x, y, B, touch, o)`: css = #c's stage
scale (`canvas.css`, fit.js; main hands it in `opts.pause.css`, the painter reads no canvas), world + time decide the tag row; `pointer.js` hands
the same. A tap on a seam (a list midpoint, the grid's divider) is the row above's; the grid's middle seam is the left tile's. The plate keeps the HUD band (y < 42) and the ability
bar (>= 482 of 520) clear. Keyboard: the S7 metrics in box units (`PAUSE_ROW_D` 44 / hero 54 / width 340, 420 at 125 %), scaled as one piece in a
short box (pitches are caps; a run with a tag row scales 600 x 520 to ~0.96). Touch: design px are CSS px (u = 1 / css), rows floored at 45 CSS (44 + #c's border)
px, never closer than 8 CSS px to another row (a touch list's RESTART / QUIT gap is 9; the keyboard list keeps the mock's 2), and grown toward the
`PAUSE_ROW_H` 70 / hero 76 box caps (width 380 box); the first arrangement that fits wins (`TRIES`): one list with the foot;
the 2 x 2 grid (RESUME | SETTINGS, divider, RESTART | QUIT TO MENU) with the foot; without it; the tag row folded into the kicker; `TIGHT` clear
space; past that it scales and the floors give way (no listed phone reaches it). A 393 px phone and every landscape phone get the grid. The
shape is derived from the labels once (`PAUSE_SHAPE` over `PAUSE_ROWS`, which `words.test` pins equal to `PAUSE_ITEMS`) and every reader
dispatches by label. Measuring never touches `#c` (the page's own 1 x 1 context, `setMeasure` the tests' seam), so the first PAUSE frame makes
the calls every later one does; the plate is a `kit/cache.js` layer, the veil and the focused row paint live. `tools/ui` captures `pause` (a
default run) and `pausetags` (every rule seeded through the debug hook before PAUSE: the tag row).
Touch rule: a tap on a row = Enter on it; keyboard PAUSE bands span
the full width of the stage (a touch grid tile owns its half); a MENU row owns its key and half of each gap round it, out to the plate's bed edge (the next-run card's slot, the logo
and off the plate are no row);
off the rows a root list (MENU, PAUSE list) does nothing; on a page
(SETTINGS, GRAPHICS, GUIDE, LEVEL SELECT, SCORES) a miss ON the plate is inert
(hit -2) and only a tap OFF the plate (or on a phone page's BACK key) backs out (-1; LEVEL SELECT's phone and compact plates also carry a BACK key). `guideHit`, `enemiesHit`,
`levelHit` / `levelGeom`, `scoresHit` and `recTabHit` (SCORES / MEDALS: pages/records.js `recordsGeom`) share the geometry their pages
draw. Hints follow `data-lay` (keys vs taps; LEVEL SELECT's touch foot is
`LEVEL_TAP` on the touch desk, the landscape tablets; its phone and compact plates have no foot, a BACK key, and a controller's cue line). SHELL BOX (owner GO 2026-10-19, shell v181, touch portrait; every
layout since UI upgrade Task 1.0, owner pick "Full window"): MENU and every plated page
(`isShellScreen`, shellview) draw on `#sh`, a fixed canvas over the whole
viewport (`fit.js` `shellGeo(W,H,cw,ch,lay)`). `d` and `l`: the window at scale 1
(`WIN_SHELL {min [600,520], dpr 2}`; a smaller window keeps the menus on `#c`,
since a page under 600 wide clips its text; every landscape phone is under it,
and a landscape tablet is the desktop form with touch pitches, lead ruling). `p`: the portrait
board stage is width-bound (~0.63 on a 393 px phone), so ~0.9 (`PORT_SHELL {s 0.9, w [400,600],
logo 0.27}`; a tablet keeps 600 wide and only grows taller; < 520 box units
tall = no shell box). INTRO, ATTRACT and PLAY stay on `#c`
with `#sh` hidden. On `d` and `l` (Task 9.12, owner: "why that menu … is blury?") PAUSE (the list and its views 1-3), every WIN and GAME OVER
are `shellMode` 2, THE STAGE: `fit.shell(2)` lays `#sh` exactly on `#c`'s content box at device density (`pxBox` / `snapOff`, the `#px` rule:
whole device px, origin on a whole 1/64 CSS px; every layout, a landscape phone with no shell box and a portrait phone with no over box
included), click-through, cleared every frame, and hands back `{ctx, box: #c}` under a `#c` units -> device px transform; main hands the
renderer `{over}` and `drawShell` draws the overlay there in `#c`'s own box, so the layout, the hits and the taps are `#c`'s as before
while `deviceScale(c)` sizes the pages' cached layers at device px (they were drawn into `#c`'s 600 x 520 backing, which CSS upscales
~2.3x at 1366 x 768 @2: soft in every look, glaring beside PIXEL's `#px` and REAL 3D's `#gl`). The run-end particles (CLASSIC `drawFx`,
PIXEL's blocks) still land over the plate: each 2D renderer's non-enumerable `over(c, world)`, which main calls after `drawShell` on the
canvas the overlay went to (`#c` on `p`, under the veil). `fit.box()` is null on the stage; a page or the over box puts the shell box back. On `p` (Task 9.8, lead ruling 2026-11-12) PAUSE (the list and
its views 1-3), every WIN (LEVEL CLEAR and the finale) and GAME OVER are `shellMode` 3: `#sh` takes taps and draws them on its OVER BOX
(`fit.over()`, fit.js `overGeo`): #sh's width and scale from `PORT_GAME.top` (the HUD plate's foot, the board's top in a run) to the
viewport's bottom safe area (`env(safe-area-inset-bottom)` read as body's `scroll-padding-bottom`), box (0, 0) at #sh's (0, top), its rect
that band; main hands the renderer `{over}` so no look draws the overlay on `#c`, and `drawShell` (its `ro` argument) draws it there:
`drawOverlay` on `overlayBox(kind, box)` (`free`: no HUD band or ability-bar clearance in pause.js `solve` or settings'
`pauseBand`), the page's css the box's. The frozen board stays in its place under the veil; the HUD (under #sh) and its PAUSE / RESUME key
(`#touchpad`, over #sh) stay live; a tap over the HUD band or the safe area is inert. `endHitAt` / `endPagesAt` take the box (main hands
`fit.over()`), shellview `pauseLayout` is the PAUSE views' frame (view 3 through `ctlFrame`, the box handed to pages/controls.js), the probe records `el` "sh" with the band (`probe.place`: `oy`, `fw`,
`fh`; gatelib's mapper offsets it). A phone with no shell box takes the stage (Task 9.12).
`#c` / `#gl` / `#px` never see the box, so no renderer changes. `#sh` sits over `#c`, under `#touchpad` and the DOM cards.
`fit.shell(on)` shows + clears `#sh` (device-density backing, cap 3 on `p` / 2 on `d` and `l`,
smoothing off) and returns `{ctx, box}`; `box` is the logical canvas
stand-in (`width/height/logo`, its rect) that `drawShell` measures and the
one pointer handler (bound on `#c` and `#sh`) maps through, so a tap lands
where it is drawn. `layout(W,H,lg,css,play)`: `play` (Task 9.6: box units per board unit in a run on this layout, fit.js `shellGeo`'s `play` =
`fitBox(…, hud true).s / s` on the #sh stand-in, handed through `dims` and `frameOf` as `F.play`; none on `#c`, whose box is the board) is the
room's scale behind every page. `W`, `H`, `shell` (an `lg` was handed: #sh's box) and `css` (CSS px per box unit, which
shellview `dims` hands on every touch layout, none on a keyboard one: fit.js writes it as the box's own `css`, shellGeo's `s` on the #sh
stand-in and, on `#c`, the scale of its CONTENT box (`stageCss`: the stage it applied minus `#c`'s 1 px border, the tighter axis), so paint and tap read one number and no frame measures a rect; MENU's touch floors, phone
column and compact tiles are laid out in CSS px). The touch size rule (R1 landscape): every touch target is sized in CSS px through that one
number, so a 44 CSS px target measures 44 inside `#c`'s border, never 43.77; `tests/landscape.test.mjs` judges every R1 page on the landscape
phones with `tools/ui/gates.mjs`'s own `evaluate()` against `#c`'s content box (the border pinned against index.html); `lg` = the centred board's 0.27 logo
line in box units,
`tall` / `narrow` (< 560) flags; narrow re-flows: none of the world-kit pages (MEDALS and SCORES re-flow on their own frame, pages/records.js; the GUIDE
pages re-flow by their own measured widths and page instead: see GUIDE pages below); STATS is centred (not floor-pinned) in a tall box. LEVEL SELECT / SCORES (RECORDS) chip
taps are ONE call through the cued key path (`app.move` with a delta on the row the tap
focused, `app.adjustPace`), so a change plays one `uiMove` and the chip already set is
silent; `[ ]` pace keys cue too.

Menu pages (owner pick 2026-10-19 round 2, direction B "ATLAS", over the
CONSOLE PANEL skin; owner: "why all buttons are soo fat", "make the select
lever more intractive", "put hooks … to see what we deliver"): pick on the
left, see it on the right. Centred (Task 9.6, owner: "the menu is not in center of screen"): every plated page on `#sh` (MENU, LEVEL SELECT, SETTINGS / GRAPHICS, GUIDE and its pages, RECORDS, the LOADING plate) centres its plate + foot block in a box taller than it needs; each old top margin is the minimum, the short-window give-way order unchanged; a phone column that fills the height stays anchored (`tests/centre-room.test.mjs`). Every plate HUGS its content through its page's own geometry (`pages/*.js` `*Geom`; the menudraw `pageBox` / `bandOf` / `listGeom` band and
its list 26 / 52 pitches went with the CONSOLE PANEL kit in Task 6.3; `shellBox` is gone, no page divides its band by a row count). LEVEL SELECT: see the LEVEL SELECT page below (UI upgrade v202 Task 3.3, on the world kit). No start-on-miss: a tap starts only on
START (keys and controller: LEVEL SELECT rows, below). MENU: see MENU page below; ↑↓ stays the linear walk. One vocabulary: MODIFIERS
(never MODES or PACT) on screens and in copy; pact.js and `nb.pact.v1` keep their
names. Hooks never lie: a score teaser reads only played runs
(`highscores.isPlaceholder` drops the seeded table; main hands `getCab().top`),
and DAILY says YOUR TRIES TODAY. LEVEL SELECT rows (v202 Task 2.3): menuapp `LEVEL_ROWS` LEVEL,
DIFFICULTY, GAME SPEED, MODIFIERS (only once offered), START; `app.levelRow` is the focused one, LEVEL on every
entry. `↑↓` walk the rows (clamped); `←→` change LEVEL, DIFFICULTY or GAME SPEED and do nothing on MODIFIERS or
START; `→` past the last open level only flashes CLEAR LEVEL 5 TO OPEN (deny, once a press or hold). Enter /
the BOMB alias / SOUTH start the run, except on MODIFIERS: there they open the inline list (`app.modOpen`, no
SCREEN; `modeCur` its cursor, always from ONE LIFE: `↑↓` pick, confirm toggles through the entry's digit with a
`uiTog`; Esc / Backspace / EAST close it first, then leave for MENU). A controller's START always starts. `[ ]`, the shoulders, `1–5`
and TRIGGER / NORTH (T14) work from any row and move no focus (no cap names them: the approved frame has none). A tap focuses its row (`levelFocus`) and acts as
before; only START starts; the MODIFIERS door opens the list (and closes it, open); off the plate or BACK backs out (an open list closes first). Tap mode
(ruling 4, R1 cohesion 4: ONE predicate for every page, shellview `tapOf`: a touch layout whose `app.lastDev` is `touch`; any key or controller press
leaves it, a tap re-enters it; computed once a frame and handed to every page as its frame's `tap`, the INTRO's skip hint included; menudraw keeps the
mode the last page frame was drawn in for the hits, so a tap meets the geometry on screen; `hintcopy.tapMode` is only the fallback of a page drawn
straight, read through `tapAt`; `tests/tap-mode.test.mjs`) shows no focus on any page (ruling 5: SETTINGS / GRAPHICS rows, GUIDE doors, RECORDS)
but MENU's PLAY (owner decision pending) and ENEMIES' open tooltip; LEVEL SELECT lights START as the page's one action, no ring; otherwise the focused row shows (see the page below), the foot is `levelFoot` (label first, keycap last). Read-only pages (HOW TO / POWER-UPS / ENEMIES /
FLOOR / MEDALS) back out on any tap (MEDALS: off its tabs; HOW TO / POWER-UPS / FLOOR: off their page keys where they page; ENEMIES: off its
points values and page keys, a tap on one opens its tooltip, and with a tooltip open the next tap only closes it); STATS taps its foot labels (touch: its COPY STATS / RESET keys), its pane is inert. PLAY's and START's
tags name what differs from a default run, each setting named (`tagFor`: `EXPERT DIFFICULTY · FAST SPEED`), then a modifier
count, stepped down to the slot; PAUSE's kicker steps down through menudraw `setupVals`. `SCREEN.STATS = 12` is **appended** (the `SCREEN` enum's own rule in
`menuapp.js`: appended, never inserted). `SCREEN.TROPHIES = 13` (the MEDALS page) is
appended too: RECORDS' third tab (STATS' `T` key, a controller's NORTH or a tap on the MEDALS tab is the same
tab step), backs out to MENU on RECORDS, never a MENU row. `SCREEN.GRAPHICS = 14` is appended too: opened by the
SETTINGS `GRAPHICS` door row (`OPT_ROWS` is all twelve rows; the rows on screen are `optRows(r3d)`, CAMERA and BRIGHTNESS
only while ART STYLE is REAL 3D, ten otherwise; ANALYTICS, then the GRAPHICS and CONTROLS doors before RESET DEFAULTS in both),
backs out to SETTINGS on the door. `optRow` indexes the visible list (R11): `app.optRows()` is the one predicate (r3d = the ART
STYLE row's selected value, `app.render3d`, never the live renderer: a REAL 3D pick shows the two rows at once while the look
loads), shellview hands `drawSettings` that list and the focused row's LABEL (`app.optLabel()`), `settingsGeom` / `settingsHit`
size to it, and every reader acts by `optLabel()`. Every ART STYLE write
(a pick, RESET DEFAULTS, `lookFailed` from a failed load or a lost context that cannot be rebuilt) goes through `_setR3d` before
`onSettings`: the cursor keeps its label, or lands on ART STYLE when its row went away. A SAVED look that fails at boot (nothing chosen on
screen yet: rcache `onFail(k, on, boot)`) goes through `_setR3d` too but never reaches `onSettings`: CLASSIC 2D for this session only,
`nb.settings.v1` keeps the pick and the next boot retries; Enter on ART STYLE retries it, and a retry that fails again stays session-only
(menuapp `_bootMiss`, cleared by a pick of another look, whose failure reverts as built; delivery review 3, shell v210). `SCREEN.FLOOR = 15` is appended too
(2026-10-25): the fourth GUIDE door (`GUIDE_ROWS` HOW TO PLAY, POWER-UPS, ENEMIES,
FLOOR; GUIDE is a 2x2 of doors on the desk (a touch desk included) and compact, one column of four on the phone), backs out to
GUIDE. `drawFloorHelp` lists the eight floor tiles at CORE / PLUS / MAX in the
current look (`featdraw.drawSpec`, PIXEL `atlas.feat`), each with its rule line
(`TILE_HELP`). GUIDE pages (UI upgrade v202 Task 3.5) are `src/render/pages/guide.js`, lazy (`pages/lazy.js` `guide`; until it is in a page
paints THE LOADING plate, see Lazy pages, and its hits are -2), on the world kit: the room of `app.level` opaque behind (MENU's own room layer: its dpr
from MENU's rule, `roomDpr`, so a hop never re-rasters the world), the rampart plate, a head (kicker GUIDE / MENU and the display title; a phone
or compact page a BACK key that stays 44 CSS px), the foot under the plate (label first, keycap last: `PICK ▲▼◀▶ · OPEN ENTER · BACK ESC`,
`MOVE … · POINTS ENTER · BACK ESC`, HOW TO `BACK ESC ENTER`; a touch desk `TAP A DOOR · TAP OUTSIDE TO GO BACK`). Desk, phone (one column, CSS
px) and compact (every other touch box) as MENU; the desk plate + foot centred with `TOP` 70 the minimum, a short phone column centred too (Task 9.6). Fix round 1 (lead rulings R1 / R2 / R3): every height is the real measure
(`measureText` on a 1x1 canvas; Node, with no canvas, a 0.66 em estimate), one wrap rule (words break only at their spaces, a slot grows to
hold every line, never an ellipsis, never a drop: the documented step-downs are APPEARS IN LEVELS n to LEVELS n, ENEMIES' help on the phone
and compact at 125 %, a door teaser breaking at its " · ", a HOW TO row's second keycap). A box whose text cannot hold its floors at one page
PAGES the content like SETTINGS (whole rows, `paginate`; the kit pager's ▲ / ▼ keys and `PAGE n OF m` at the body's foot, a touch target on every
layout): desk windows keep u = 1 wherever MENU does (1366 x 768, 1280 x 720, 1024 x 768 and the landscape tablet, 1366 x 657, at 1 and
1.25) and page instead of scaling under 14 / 11 / 17.9 px; a desk plate under 700 wide stacks FLOOR's rows and runs ENEMIES in one column;
compact pages at 1 box unit per CSS px (its margins just clear the ring, pads 8 / 10) and never scales (R1 landscape): a title too wide beside BACK
steps down there while it holds the primary cap floor, then where bands do not page whole ENEMIES drops a foe's help (as at 125 %), then the phone's
one-column body (`one`: POWER-UPS one tile a row), then BACK steps down to its chevron and the page keys ride the head's row (no label there); only a
568 x 320 phone's #c still scales (the named exemption). ENEMIES' compact tooltip (lead ruling) may cover the page head under the BACK row but never
BACK, the page keys or its row; where the full copy fits nowhere it is the one-line points rule (words.js `POINTS_RULE`, no POINTS row), and a box whose
tooltips fit nowhere moves the page keys to the head row; LEVEL SELECT's finale flag is cream on an open level (`FLAG_INK`), >= 4.5 in every world;
SETTINGS' `chosen` is exempt only on a page whose probe records no `two-state` part (screens.mjs `exemptIfNo`). A keyboard `#c` (a window under 600 x 520, the iso guard) still scales as one piece, as MENU does there. The page on screen is the focused door's or foe's; HOW TO,
POWER-UPS and FLOOR keep menuapp `infoPg` (every arrival 0; ↑↓ / ←→ / the controller step it, clamped, through `opts.pageCount`, which main
reads from shellview `guidePageCount`); a page key tap is the kit's `{k: "page", d, to}` (that page's first door or foe; the page itself on a
read-only page), painted with the kit's `paintPager`. FLOOR keeps both rule lines of every tile and its level line on every row (beside the name on all rows or under it on
all). On a phone or compact page a controller adds a cue line under the head (`hints().dev === "pad"`; label first, keycap last: OPEN /
POINTS / PAGE, BACK, HOW TO's `REBIND IN SETTINGS › CONTROLS` signpost where it fits), so a flip re-lays the page once. GUIDE's doors are keys with a quiet teaser and a strip of what is behind them (HOW TO's door: whole label-first
key pairs, `MOVE [WASD] BOMB [SPACE]`); tap mode shows no door focused (ruling 5; the page on screen stays the cursor door's). ENEMIES: a slab per foe (3 x 3 on the desk,
rows on the phone, two columns compact) with the foe on a floor cell of the world it first appears in, its points as brick digits + PTS (`PTS`,
pinned to `sim.js` killEnemy by a real kill per type), level pips and `APPEARS IN LEVELS …`, help from `FOES[].help` without its trailing points;
the focused points value is a key (band, bare bomb, ring; an unfocused key under the name starts at its left edge; at 125 % the desk drops the
kicker and widens the plate to 1300 so the key rides the name's line, the t125 frame) and its tooltip (`tipText`: "What you score each time your
blast takes out a KNIGHT. Saved scores count ×2 on HARD and ×3 on EXPERT.") covers the fewest whole rows its measured words need (desk: two
cards of the rows toward the middle; else the page body above or below the row, full width, the pager's strip included), never the foe it
explains; ENEMIES off the desk pages so every row keeps that room (a landscape phone: one foe a page), and a compact tooltip is the POINTS word
and its words, no digits. ENEMIES' focus is menuapp `foeRow` (every arrival the first foe) and `foeTip`: the arrows walk the foes in one
wrapping line (like GUIDE's doors); on keys the tooltip follows focus, arrival included (R3; a mouse counts as keys); a controller's move
closes it; Enter / SOUTH opens it; Esc / Backspace / EAST close an open one first, a second leaves; a tap on a points value (a touch
layout's whole slot) is `foeTap(i)`, a tap on the open tooltip or anywhere else `foeClose()`, then backs out. HOW TO, POWER-UPS and FLOOR
back out on any tap off their page keys, or Enter. `SCREEN.CONTROLS = 16` is appended too (v201): the SETTINGS `CONTROLS` door row, backs out to
SETTINGS on the door; see the CONTROLS paragraph under `src/`.
The GUIDE pages draw foes, pickups and tiles with the board's own painters (CLASSIC: `drawEnemyBody` / `drawItemBody` / `drawSpec`; PIXEL:
`hudart.js` cells when the atlas is in), baked into the page's layers at a fixed time; only ENEMIES' focused foe animates live (`foeAnim` in
PIXEL, a pure function of the page clock). From PAUSE the same page is
inline `pauseView 2` (0 list / 1 SETTINGS / 2 GRAPHICS / 3 CONTROLS; Esc steps 2 → 1 and 3 → 1, onto
the door, and 1 → 0 onto the SETTINGS row), never a SCREEN. WIN/LOSE run summaries are **not** a SCREEN — they
live in `drawOverlay`. Their routing (v202 Task 5.2, R19): `src/render/pages/endgeom.js` (boot) is the one draw / tap
contract (`endMode` clear / fin / lose, `endFacts` every word and claim, `endGeom` rects by name in `overlayBox`, keys
`main` / `menu` / `copy` / `map`, `endHit`); main hands the run facts as `o.run` (`runInfo`: the tally, the run-start
best, the room's own kills and power-ups `lk` / `lp`, `fixed` for a DAILY / code board, `cap` = `roomCap`, the newly
saved `medals`, the end clock `et`, REDUCE FLASH, `lay` and `css` of `#c`). Esc and the controller's EAST go to MENU
at a run end only: GAME OVER through main's `toMenu` (world state `MENU`; the LOSE edge already saved the run), a
finale WIN through the same fire edge as Enter (main saves the finale on the sim's MENU edge); a mid-run WIN keeps
them inert. A run-end tap is the key under it (`scenes.endHitAt`), acted on its pointerup on the same key; off the
keys it does nothing. A mode whose page is not registered keeps today's summary and its tap is the main key.
WIN is its page since Task 5.3: `src/render/pages/endwin.js` (lazy, `pages/lazy.js` `endwin`, with `endkit.js`, the
end parts: pen, keys label first and keycap last, stat cards, course cells, shelf, ribbon, medal piece, toast tag, the
one cached `frame`); `drawOverlay` paints a LOADING plate until it lands (taps inert), and `shellview` calls
`lazy.idle()` on MENU and GAME. It centres in `#c`'s whole box (since v209: no look draws a HUD band on the board after v206, so the old `HUD_TOP` 42 reserve is gone; a portrait phone: the over box on `#sh`, Task
9.8): a level clear (LEVEL n
CLEAR, three stat cards of this level, at most one time ribbon, NEXT LEVEL) and the finale (FUSE/GRID CLEAR over a
blast cross and warm core, the saved score on bricks with `multTag` (`×2 HARD DIFFICULTY`), the course with check
notches and 6-8 locked until a finale opens them: `endRun` saves the unlock on the run-end edge, the same edge as the bests,
so the finale that first opens them prints LEVELS 6 TO 8 NOW OPEN under the course from a persisted fact (`run.opened`), a later one
never; the run's stats, the shelf: a score record, a time record,
the newly saved medals, `+N MORE` past three; MENU, COPY RESULT, COPY MAP). Motion beats on `run.et`; REDUCE FLASH or
prefers-reduced-motion: the end state with one fade. A touch box lays out the phone's column. Never scaled under the text
and touch floors (u = 1 / css): the plate narrows to the box, a short box closes the gaps, then PAGES the content (whole
sections, the keys on every page, a ▲ / ▼ pager column; ↑ / ↓, the D-PAD and the ▲ / ▼ taps turn it, main holds
`run.page`, `scenes.endPagesAt` clamps it); a phone's medals hang on shelves of their own. Confetti (`fx.js` `win`) falls on a
FUSE/GRID CLEAR only, never under REDUCE FLASH or prefers-reduced-motion (appendix 10.4); a level clear shakes and throws none. The finale
plate is the mock's 840 where the box holds it; a medal's rule reads in sentence case there (`endgeom.ruleSentence`; MEDALS keeps the caps
row). The facts and geometry are kept per run end (`endgeom.endPlan`, keyed by what they read plus the measuring context), not rebuilt each
frame; a steady frame is 0 misses, <= 400 calls, <= 20 measureText. Esc / EAST / a tap on MENU at GAME OVER plays the `back` feel
(`app.leaveRun`, as the PAUSE quit). GAME OVER's motion draws the cord burning down (0.3-0.8 s, `cordK`) and the crack stroking in with a
6-particle `#c9793f` dust puff (0.8-1.0 s, `crackK`); reduced motion: the end state. The old summary helpers (`winHeadline`, `timeLine`,
`deltaLine`, `summaryLines`, `runLine`, overlayCue's WIN / LOSE lines) are gone: `endgeom.endFacts` is the one source of every
run-end claim and key; `overlayCue` is PAUSE's.
GAME OVER is its page since Task 5.4: `src/render/pages/endlose.js` (lazy, `endlose`): a cool grey veil (R18,
`VEIL`), the burnt-out bomb (no spark once out, a charred stub, a soot ring by gradient, live smoke), the engraved
headline, "Reached level n of m." (m the run's finale, 5 or 8), the course (cleared, cracked on the level fallen,
ahead, locked past `roomCap`), SCORE as saved (score × difficulty, `multTag`), then one line: the shortfall saved to
saved against the run-start best of the same bucket, `Matched your …`, a quiet plaque (NEW BEST · bucket, or
FURTHEST LEVEL YET from level 1 only), or the DAILY line; nothing on a first run scoring 0. TRY AGAIN (the one
yellow; `New board · level 1`, or `Same board` on a DAILY / code run), MENU / COPY RESULT / COPY MAP sharing their
row by what label and keycap need (a key too narrow drops its keycap, never its label); on a touch column a label that would not fit its
share with 8 px clear each side stacks the row (Task 9.8): MENU over COPY RESULT | COPY MAP, else one key a row (the finale's
COPY RESULT | COPY MAP halves likewise, a row each); where stacking would scale the box under its floors the row stays one and the widest label breaks once at its space (`G.lines`). A course cell smaller than the device's (a paged column) keeps its number in proportion, never under the secondary cap floor (endkit `cell`), so the lit / well pair keeps its contrast. Two columns while the facts
keep 330 px, else one with the bomb beside the headline. The old WIN / LOSE summary painter is gone; `drawOverlay`
paints only PAUSE itself. Wrapped lines never split a setting's name (`endgeom.tokensOf`).

MENU page (UI upgrade v202 Task 3.1, `src/render/pages/menu.js`; the round 7 S7-menu / L7-logo frames). The world dresses it: the room look of
`app.level` (kit `room.js` `roomLayer`) opaque over the whole canvas from MENU's first frame, the plate in that room's rampart; PLAY the one yellow
key (bare bomb + 3 px cream ring when focused); the doors are keys, a focused one wears the kit `band` + bomb + ring; no cord or spark but the logo's.
Desk (every keyboard box; the 1366 x 768 frame at 1 box unit per CSS px): the logo in the plate's header, a 480 list (PLAY 64,
doors 46, 8 px pitch, 24 px breaks after PLAY and before GUIDE; 125 %: 520, 72, 49) beside the next-run card (Task 3.2, below), the foot under
the plate (`MOVE ▲▼ · START ENTER | v214`, label first, keycap last; the verb follows focus: START on PLAY, OPEN on a door, and with a controller
on SOURCE `NEEDS A CLICK OR ENTER`, no keycap; a touch layout reads `TAP A ROW`; a note leads it, the controller's signpost replaces it in cream).
Phone and compact have no foot: while a controller drives, SOURCE's teaser leads with `NEEDS A CLICK OR ENTER` (step-down `CLICK OR ENTER`, words.js
`SOURCE_PAD_SHORT`; R1 cohesion 11), cream, before the signpost and the build tag.
The plate keeps the mock's size and centres in both axes with its foot (Task 9.6: the 70 px top margin, 56 at 125 %, is the MINIMUM, so 1366 x 768
keeps the mock's y 70 and its 125 % frame centres at 58.32; 1920 x 1080 at 220.32); a narrower window narrows only the card's column, the minimum top margin gives way to a short one,
then the page scales as one piece (#c with no shell box, the iso guard; text floors not held there).
Touch floors (fix round 1, every touch layout): MENU's rows are >= 44 CSS px and >= 8 CSS px apart, never scaled below. A touch box takes the
desk with its rows and gaps floored in CSS px (`TOUCH` 44 / 8) and the page re-solved round them (the largest scale that fits, by bisection),
while that scale keeps `TOUCH_U` 0.8 CSS px per design px (the desk's text at the phone cap floors: 1024x600, 800x600 at 0.814, 1280x650 at
0.948); under it the box goes compact. Compact (every landscape phone, which has no shell box, and a short window such as 600x520): the phone's
grammar across the box in CSS px, the logo then PLAY across the top, the six doors as tiles two wide and three deep in ITEMS order, no card slot
(PLAY's tag carries the run), no foot (SOURCE's tile carries the build tag, a note or the signpost; a label too wide for its tile, LEVEL SELECT on
a 667 px phone, breaks once at its space, and a teaser takes the lines the tile has left); one t steps every size between `COMPACT` max (logo cap
36, PLAY 62, tiles 58, gaps 10) and min (cap 20, PLAY 44, tiles 44, gaps 9) with the height: 852x393 tiles 51.6, 667x375 44.3; at 125 % under min
the `least` step first (R1 landscape: the wordmark steps out of the header, gaps 8, a one-word label too wide for its tile drops to its 100 % size),
so a 667 x 375 phone holds its floors at 125 %. Under min the
arrangement scales as one piece and the floors give way (a 568x320 phone only since R1 landscape: the named exemption), disclosed.
Phone (`p` with a shell box): the 393 x 852 column in CSS px (`css` from `dims`), capped 600 wide: PLAY 62, LEVEL SELECT 50, the card's slot
(the height left), DAILY | RECORDS and SETTINGS | GUIDE tiles (58; 84 at 125 %, a teaser may break once), SOURCE 50 with the build tag (a note
or the signpost rides it instead). Next-run card (Task 3.2, `src/render/pages/card.js`, the one module LEVEL SELECT reuses; fed names and
values: the level and the run PLAY starts, heat and pact, plus an optional kicker and BEST word): the world, the lane (kit `room.js` `lane`: the
representative start corner, MAKO on his spawn FLOOR cell (1,1), at most 14 x 3 cells, never the dealt board), every roster foe on a floor cell
(kit `foeCell`), `×n` beside a foe met more than once and none beside a lone one, as the approved mock (lead ruling, fix round 1; `rosterOf`,
heatRoster deduped: the one roster, menudraw re-exports it), the floor tile (kit `tileCell` labelled FLOOR TILE, `TILE_NAME`, `TILE_HELP` at the
run's heat), on a finale level (`isFinale`) the kit `glyph` flag with FINALE (appendix 7.2 `mark`), LIVES hearts / FUSE `2.5s` / SCORE `×n` (`applyPact(heatProfile)`), words.js
`CARD_WORDS`. Desk: the mock's stack (NEXT RUN · LEVEL n with YOUR FIRST LEVEL / THE LAST FINALE, the world in display type and its flag, the lane
14 across at 2.5 rows, YOU'LL MEET and the names, the foe cells, the floor tile and its help, three stat cells on the bottom); phone: the lane 9
across, LEVEL n · WORLD with YOUR FIRST LEVEL or the flag, the foes, the tile, one LIVES / FUSE / SCORE line; compact: none. It fits by giving way in order: the lane (to 1.85
rows), the foe cells (40 to 26 desk, 28 to 22 phone), the gaps; a quiet line (the mark, the names, the help, SCORE on the phone line) steps down
or drops, never clipped. It paints into the plate layer (the plate's key holds the card's key) and nothing live. Teasers (one quiet `#bcad9a` voice; words.js `MENU_WORDS`): DAILY `NEW · TODAY'S BOARD` or `YOUR TRIES
TODAY · n`, RECORDS `BEST n` (played runs only) or `NO RUNS YET`, SETTINGS the art style, GUIDE `4 PAGES`, SOURCE `GITHUB`; each steps down
or drops, never clipped. PLAY's tag: a default run `LEVEL n · WORLD`, else `tagFor(run)`, its modifier count, EXPERT bare, the level line
last, on one or two lines. Tap mode (shellview `tapOf`) focuses PLAY. Entry (the show's end and a skip alike): the plate, logo and foot fade in over
0.25 s; the slam is gone. The cabinet (`getCab`: played runs, today's tries) is read again on every arrival at MENU from another screen, so a run
started from PLAY or DAILY never leaves a stale teaser. The plate layer is keyed by what it shows (the arrangement, the world, the teasers; the
notes only on phone and compact, where SOURCE's teaser carries them), never by the hint words, tap mode or the run: PLAY's tag and keycap paint
live, so on the desk a key / controller flip, a note or a controller's arrival re-rasters only the feet (each keyed by its own words), and the
room's dpr gives way to a foot reserve sized from the real feet: the three verbs (START, OPEN, the controller's SOURCE line) planned with no note
or sign at the text scale in force, their layer widths summed and rounded up to `FEET_STEP` 256 device px, so key and controller words land on the
same room key (Task 3.2; was three feet as wide as the box); feet wider in all (a note, the signpost, long rebound caps) paint live. 1366 x 768
@2 with the logo (recorder widths): room dpr 1.549 at text scale 1, 1.421 at 1.25, 1920 x 1080 @2 1.102 / 1.011 (Task 9.6 re-measure; was 1.323 / below that; the 125 % plate is 1180 wide, and
1.5 there leaves room for under one foot), the cache <= 23.99 MiB of the 24 MiB `BUDGET` (24 x 1024 x 1024 bytes; every budget figure here is MiB). A zero or non-finite box draws
nothing (`menuHit` -1). `glyph` (chev, ext, up, dn, flag) is a kit part (`kit/paint.js`), `canMake` the kit cache's one copy (the logo painter's too). Page plumbing, for every page task: a page module exports one `*Geom` (rects by name, box units; `G.d` design px)
for draw and hit, a painter fed names and values by shellview (never indices), and its hit; menudraw keeps the entry names and delegates.
The kit (`src/render/kit/`, R1 kit harmonisation): `tokens` (world colours), `type` (faces, `measure`, `measurer` / `measures` (a 0.6 em estimate
for a context that cannot measure), `text`, `CAP_K`), `geom` (`deep`, `R`, `sc`, `okBox`, `inR`, `big`), `paint` (key, cap, plate, band, `plaque` the
foot's sign plaque, `rpath` / `rfill`, glyph, the cell painters), `copy` (`FOOT_TAP`, `LOOK_NAME`, `lookVal`: words two pages paint; menudraw
re-exports them), `pager` (THE pager every page that pages uses: `PAGE_KEY` 46 CSS px square keys `PAGE_GAP` 10 apart (every page, a 667 x 375 phone's #c included since R1 landscape), `keySide` (CSS
px to a page's design px), `paginate` (whole items per page), `pageOfFocus` (the page on screen is the focused item's, so keys and a controller turn
it), `pagerKeys` (the strip, ▲ ▼ at its right end, the label left of them), `pageLabel` (`PAGE n OF m`), `pagerHit`, `pageKeyAt` (THE page-key hit,
R1 cohesion: every page answers a ▲ / ▼ tap with `{k: "page", d, to}`, to = what the page it opens focuses, null at an end; pointer.js maps it in
ONE branch to `app.pageKey(d, to)`, one step, one `move` feel and the one `uiMove` main wraps it with, the same on every page and PAUSE view),
`paintPager`; a page keeps
only what an item is; tap mode keeps the keys), `cache`, `room` (the room look (Task 9.6: `roomLook` paints the world's floor checker centred at
PLAY scale, `F.play`, the cell a run shows on that layout, never COVER (COVER only with no play: `#c`, where it is 1), over the whole box; FLOOR ONLY since
owner veto 1, pick D (2026-11-14): no wall or brick behind any page, so nothing outside the plate competes with PLAY; only the cells the box shows are painted);
`roomKey` is the one key, play in its name), the lane, and the ONE shared room rule: `shareRoom` / `roomDpr` / `pageRoomDpr` /
`roomFit`; `frameOf` in menudraw hands every page the bare box, SETTINGS' delegates add `paused` / `focus`), `parts` (Task 9.10: the meter cell `meterCell`,
`mark`, the wall `course` and the pane's `slab`, moved byte for byte from pages/settings.js; SETTINGS and CONTROLS both paint them, so neither page imports
the other; lazy, in `LATER`, never boot; `slab`'s optional `sub` is the layer maker its wall cell goes through, SETTINGS' collecting one), `probe`. A part two or more pages use lives here; a part one page uses stays in its page.
Static parts are `kit/cache.js` layers keyed by content (`roomLayer` shared by every page of a box, LEVEL SELECT's included, at one room dpr:
MENU's rule (`pages/menu.js` installs it with `kit/room.js` `shareRoom`; every page asks `kit/room.js` `roomDpr`, or `pageRoomDpr` capped at its own
fit, the kit guarding each ask (1 with no canvas source); it throws until installed), its dpr giving way so MENU's plate, its foot reserve and a 3 MiB logo reserve fit `BUDGET`; so a MENU /
LEVEL SELECT switch never refills the room; a page keeps its plate out of the room layer), made at once so a cursor move never misses, `touch()`ed on a steady frame (`cache.touch(key)`: a held layer
goes LRU-recent, so a stale one is freed first); live on top: focus, ring, the logo's spark. `shellview.shellCovers(screen)` (MENU, LEVEL SELECT,
SETTINGS and GRAPHICS, GUIDE with its four pages since Task 3.5, SCORES, STATS and TROPHIES since Tasks 4.1 / 4.2; each page task adds its screen) makes main pass `{covered: true}` to the renderer: no look rasters a board a page covers. `frameloop` frees the kit's
layers (`release`, handed in by main) after `KIT_FREE` 10 s of GAME PLAY on a PLAY-only clock and on `pagehide`; the next shell frame refills.
Under the probe a page records `begin(page, {w, h, dpr, el})`, its rects (touch, set, focus, fill), texts (role, cap height, colour) and
squint pairs outside any layer paint; its `tools/ui/lib/screens.mjs` row exempts what it has none of (MENU: chosen, locked; LEVEL SELECT: ring, locked; SETTINGS: ring, locked, chosen only by
`exemptIfNo` (no two-state part drawn); GRAPHICS: ring, locked, chosen by the same `exemptIfNo` (R1 cohesion 12); GUIDE and ENEMIES: chosen, locked;
HOW TO, POWER-UPS, FLOOR also band, ring and gap, HOW TO and FLOOR info; SCORES, MEDALS: locked; RECORDS' rows `exemptPhone` ring and band, SETTINGS' and
GRAPHICS' band, GUIDE's band and ring (a phone capture is tap mode, which shows no focus: R1 cohesion ruling 5)), and a lazy page's row waits for it (`wait: "records"`). Text under an open tooltip is not recorded. With no canvas
source (Node) it paints straight onto the target over a flat fill; a context with no clip or rect (the headless renderer's) gets the plan only.
Lazy pages (R20): `src/render/pages/lazy.js` is the ONE loader (boot; `LOAD` has one line per page, `want(name)` imports, `get(name)` is the
module or null, `idle()` asks for every page in the first idle after MENU's first frame: shellview calls it on MENU). A lazy page is in
`src/pwa/shell.js` SRC and `LATER`, never BOOT; until it lands its menudraw entry names paint THE LOADING plate (R1 kit: one painter, kit
`room.js` `loadingPlate` through menudraw `loadingPage`: MENU's room at `roomDpr`, none on a PAUSE view, then a 360 x 128 kit plate scaled into
the box with the page's title and one line, LOADING, or DID NOT LOAD while its last import failed; on a touch `#c` its design px is a CSS px where it
fits and never under 0.8 CSS px, the plate narrowing to the box and the title fitting it, so its line holds the phone's floor; it records the probe
as page `loading`). Every LOADING frame asks for the module
again (menudraw `lazyMod`; `lazy.want` keeps one import in flight): a failed import is asked again on the next frame (a blip recovers), then at most
every 3 s, never every frame; `_rec.want` is the test seam for every lazy page. Hits: SETTINGS / GRAPHICS -2 on the plate, -1 off it; GUIDE and
RECORDS -2 everywhere while the import is in flight, and once it failed (the plate says DID NOT LOAD) SETTINGS' rule (menudraw `lazyHit` over
`loadHit`; STATS "plate" / "back"; LEVEL SELECT its own `{k: "none"}` / `{k: "back"}`), so a touch player is never stuck on a failed page (R1 cohesion 1, `tests/lazy-leave.test.mjs`). CONTROLS
follows the same rule (lead ruling, shell v210, `tests/controlslazy.test.mjs`): while its LOADING plate is drawn (its paint or the wire's reducer not
in: the stand-in view says `loading`, `failed`) shellview `controlsHit` answers for that plate (kit `loadBox`), never the full page's geometry: in flight
`{}` everywhere, a viewport click off the canvas inert too; once failed `{off: 1}` off the plate and `{}` on it; PAUSE view 3 alike. Tests import the page or hand it in with `lazy._set`. `src/app` never imports it.

SETTINGS page (UI upgrade v202 Task 3.4, `src/render/pages/settings.js`, lazy; the round 7 S7-menu 04-settings / 04-settings-3d frames): SETTINGS and
GRAPHICS, and PAUSE views 1 / 2 inside `overlayBox` (a paused box: no room, the plate over the board under PAUSE's veil, kept off the HUD strip
(its ring under y 40) and, on keys, off the ability bar (over H - 28); the `PAUSED · LEVEL n` kicker; the room being played, `world.level`,
dresses it, never the menu's `app.level`; a view whose page is not in asks `want("settings")` and shows LOADING on the same tokens). On the
screens the room of `app.level` dresses it, opaque (SETTINGS and GRAPHICS cover). Rows by label (`settingsGeom(F, rows)` over the visible
`optRows`, `graphicsGeom(F)` over `GFX_LABELS`, pinned equal to gfx.js `GFX_ROWS`); `*Hit` is the index into the visible rows (R11), -2 on the
plate, -1 off it or on the phone's BACK, the kit's `{k: "page", d, to}` on a page key. The box the pointer and shellview hand in names the focused row
(`L.focus`, an index) and, in PAUSE, `paused` and #c's CSS scale (`dims(canvas).css`). Each row is label left, one game part right: MUSIC / SFX a
ten-cell meter of bricks (the head lit, the number right, `70`), BRIGHTNESS seven cells (`100%`); SOUND, SCREEN SHAKE, REDUCE FLASH, ANALYTICS and
GRAPHICS' two-way rows (FPS METER) a two-cell rocker; ART STYLE, CAMERA and GRAPHICS' other values a stepper (stepped keys round a well window;
ART STYLE / CAMERA carry position pips; an arrow that cannot move is a well: GRAPHICS reads the place from gfx.js `gfxView` rows' `at` [i, n],
CUSTOM none); GRAPHICS and CONTROLS doors (the word in the quiet voice and the chevron: a trailing ` ›` in a value is the glyph; CONTROLS reads
`VIBRATION <level>` beside its label, or whole on the row's second line where one line does not fit, QA string #8); RESET DEFAULTS coral with the
reset glyph; a GRAPHICS locked row is the wall key reading `—` with the lock. A narrow phone row narrows its rocker cells and meter (never under
the legend) rather than drop a word. Wall courses split audio · look · comfort · privacy · doors · reset (GRAPHICS: preset · rows · meter). Focus
is the band + the bare bomb, no ring (no key takes focus). A changed value flashes 120 ms as a hard cream overlay (no blur); GRAPHICS flashes
every row a preset wrote. The ANALYTICS pad note replaces the rocker, or takes the row's second line where it does not fit. A look being prepared
turns ART STYLE's value into one well window over the value's room with `lookVal`'s first words that fit whole and the fill line at its foot
(no line on a failure, its words coral). TOUCH FLOOR (lead ruling, fix round 1): on every touch layout, SETTINGS, GRAPHICS and their PAUSE views,
rows are >= 44 CSS px and >= 8 apart; where they do not all fit (a 640-tall phone, landscape phones' #c, every touch PAUSE view: since R2 a PAUSE view on a touch #c takes the phone's CSS px column inside the pause band, y 44 .. H - 8, never the scaled column), the list PAGES:
as many whole rows as fit, a strip of `PAGE n OF m` and two page keys ▲ ▼ (the kit pager's: 46 CSS px, 8 CSS px under the rows, 10 apart; a key with no page is a well) under them, and
under those, where a PAUSE column's foot drops, a back-out hint line (`kit/copy.js` `BACK_TAP`, or BACK and its keycap for a controller; R1 kit).
A landscape phone's `#c` (R1 landscape) takes the phone's column in CSS px (`land`), never the scaled column: paged, its foot drops and the BACK key
beside the title keeps the way back (no hint row, so it keeps its rows a page); a label that overruns its row, or a rocker / meter that would run
into it, at 125 % steps down to its 100 % size; a page short of one row closes the margins (`LAND_TIGHT`); only a 568 x 320 phone scales (GRAPHICS);
the page on screen is always the focused row's, so keys and a controller turn the page by moving past its last row, and a page key's tap
focuses the first row of the page it opens (nothing confirmed); no drag scroll. Three arrangements: desk (a keyboard box, or a touch shell box,
holding both columns at u >= 0.8: list 480 (540 at 125 %) beside a 400 (440) pane, rows 38 (36), courses 12, the plate centred 944 wide; the
pane is a slab of floor framed in wall cells: SETTINGS shows ART STYLE `n OF 3`, the three looks as keys (the chosen one lit) and the REAL 3D
rows note; GRAPHICS the focused row's name and help; the foot in the pane, label first, keycap last, `ROW ▲▼ · CHANGE ◀▶ · BACK ESC | vREV`; the
kicker `BUILD vREV` hidden at 125 % on the desk, where the foot carries the tag), col (a keyboard #c, a keyboard PAUSE, the iso guard, a short or narrow window: the
list alone, rows 34 on keys, courses 10, GRAPHICS' two help lines under the rows, the foot at the plate's bottom, or the page keys' strip where
it pages) and phone (a touch-portrait shell box, and a landscape phone's touch #c: the column in CSS px, BACK beside the title, rows 44 8 apart (the mock's 52 pitch), ART STYLE
and CAMERA as door rows, the foot under the plate). Cached: the room (MENU's own `roomLayer` at MENU's room dpr, `kit/room.js` `roomDpr`, MENU's rule, for
the page and its LOADING plate alike, so MENU -> SETTINGS / GRAPHICS -> MENU never refills it; the page's own fit, its full-dpr page layer inside
`BUDGET` with no logo reserve (these pages show no logo; lead ruling, R1 train), is the floor, and every box tested holds MENU's dpr, the touch
tablet 1024 x 768 included; shellview hands both pages `rev`, which MENU's dpr reads), one page layer per page shown (plate, head, its rows at rest, courses, pane, foot or
page keys; keyed by what it shows, so a cursor move on a page never misses and a value change re-rasters once), and two small sub-layers it
blits (a slab wall cell, the locked key), kept recent with it. `screens.mjs` exempts ring (both) and locked (SETTINGS has none; REAL 3D locks no
GRAPHICS row).

LEVEL SELECT page (UI upgrade v202 Task 3.3, `src/render/pages/level.js`; the round 7 S7-menu d-03 / p-03 frames, refmap `level`). LAZY since Task 9.14
(one `pages/lazy.js` entry `level`, in the worker's `LATER` stage with `kit/pager.js`, which only lazy pages import; loaded by MENU's `lazy.idle()`):
until it lands menudraw paints THE LOADING plate titled LEVEL SELECT and `levelHit` answers `{k: "none"}` (inert), once failed `{k: "back"}` off the
plate; `levelGeom` is null and `levelFoot` "" without it; `LEVEL_TAP` / `LEVEL_TAP_LIST` are words.js `LEVEL_WORDS`' own (boot). The keys never need the
page: menuapp walks the rows and START starts the run (`tests/level-lazy.test.mjs`); `pages/card.js` stays boot (MENU's card). Captures `level` wait for
it (`wait: "level"`), `levelloading` holds its import (`block`). Opaque on the
world kit like MENU (`shellCovers`): the room the next run starts in (the selected level's world) and its tokens, so the page changes world as LEVEL
changes. One path: rows LEVEL (8 level keys in one course: chosen lit, the rest wells, a flag on 5 and 8, 6-8 wall keys with a lock until the first
CLEAR; a locked tap or `→` shows a CLEAR LEVEL 5 TO OPEN plaque under the key for 1.8 s), DIFFICULTY and GAME SPEED (banks), MODIFIERS (one door
row once offered; its teaser names what is on, a controller's TRIGGER entry and state with the list shut), then the one next-run card
(`pages/card.js` with BEST: `✓ BEST t` for a saved time, NO TIME YET only once TIME is open, else the level's mark; ALL NINE · ONE OF EACH where the
roster is every foe once, on both pages' cards) and the START hero (its tag `tagFor`, then counts, else DEFAULT RULES; dropped where it cannot fit).
The inline list is five toggle keys (on lit, off well) in a region reserved under MODIFIERS (desk), in the card's place (phone) or over the
LEVEL..GAME SPEED rows (compact); opening it moves nothing. Focus: a row its band and bare bomb, no ring (the d-03 frame); START, the phone /
compact door and a list entry are keys (bomb + 3 px ring). Desk help line: the level's sentence, a list entry's, a controller's TRIGGER / NORTH
how-to (`words.js` `LEVEL_WORDS`). Arrangements as MENU's: desk (plate 1110, list column 640, rows 64 / pitch 74, keys 48 x 44, bank cells 112 x
36, START 74, card slot 360; 125 %: 1220, 700, 58, 50, 140 x 44 (room for the legend: chosen >= 3:1 at every text scale), 84, 400; centred; a narrower window gives way first (the card's column to 360, its slot
then 380, the column gap, the side pads, the list column to 572 / 680), a shorter one the gap over the foot then the MENU kicker, and only then
does the page scale, so 1366 x 657, 1280 x 720 and 1024 x 768 keep the text floors; a touch box floors every target at 44 CSS px while u x css
holds 0.8), phone (the p-03 column in CSS px: BACK + title, labels over their controls, 4 x 2 keys 46, banks 50, door 52, the card the height
left, a reserved cue line, START 66) and compact (any other touch box: the phone's grammar across the box, no card; where the groups do not fit
it PAGES them, whole groups a page, MODIFIERS its own group, the page the one holding the focused row (START: the last), page keys beside START
that focus the first row of the page before or after: the kit pager's keys, 46 CSS px, no label (the cue line names the page)). Phone and compact have no foot: a controller gets a cue line
(`footItems`, stepping down by whole items). `levelGeom(F, {unlocked, open, row})` / `levelHit` take the
list's state from `app.modOpen` and the page from the focused row (pointer.js passes both with the box's lg and css). Layers (kit cache): the room is MENU's
own `roomLayer` at MENU's room dpr (`roomDpr`, one key: 1.549 at 1366 x 768 @2, 1.421 at 125 %, with the build tag in the foot; 0 room refills
MENU -> LEVEL SELECT -> MENU); the plate (rampart and bed) is its own layer at 1 device px per box unit under the rampart's four full-dpr strips; the
head, the rows at rest (one per page), START at rest, the card, the LEVEL row's focus, the list and the desk feet are full-dpr layers of their own
rects, all made at once, within the budget beside MENU's room. Live: the other rows' focus, the door's teaser, the help line, START's tag and keycap, the lock plaque.

The sim ticks only while the shell is GAME. PAUSE/WIN/LOSE are `world.state`,
not shell screens. Do not add them as `SCREEN` values.

- `src/main.js` — **browser entry only**, pinned `<=799` lines
  (`tests/headless.test.mjs`; raised 808→812 once in wave 3 for `ro.ghost`,
  tightened to 799 when C2 moved `fit()` out; 733 by split-length at v178 after
  GRAPHICS moved the frame gate and renderer cache out; 784 at v201; 716 once the pointer router moved out, UI upgrade Task 0.4; 722 with Task 3.1's covered flag and kit release; 727 with R1 cohesion's close-first and page-key cue; Task 8.2's `createHud` adds its wiring). RAF loop, fixed-step
  accumulator, kind switch, and the handler wiring that binds them. Never
  imported by sim or renderer. Its seams live beside it and must stay OUT of
  `main.js`: `src/app/flags.js` (URL/opts, pure over a search string),
  `src/app/attract.js` (demo world + `stepDemo`), `src/app/frameloop.js`
  (`mountFrames`: the rAF owner, frame gate, knob push, the kit layer release), `src/app/rcache.js`
  (`mountRenderers`: per-kind renderer cache, lazy/eager three, release),
  `src/app/audiopower.js` (`mountAudioPower`), `src/app/renderkind.js`
  (`bootRender` / `kindOf` / `renderVal` / `renderBits`),
  `src/app/controlswire.js` (`mountControls`, v201: binds `gamepad.js`, `padroute.js`, `capture.js`, `controlspage.js`, `controls.js`, `hints.js`, `rumble.js` and render's `controlsgeo.js`, `pages/controls.js`, `padart.js`, `hintcopy.js` to main, frameloop and unlock; see the CONTROLS paragraph), `src/app/debughook.js`
  (`window.__GAME__`), `src/app/pointer.js` (`mountPointer`: the ONE tap handler, bound on `#c` and `#sh`; `main.js` hands it the hit functions as `hit` because `src/app` never imports `src/render`, and `kind` / `ctl` as getters), `src/app/endkeys.js` (WIN/LOSE keys: Enter =
  Space through `Input.pulse()`, one fire tick and never a latch; C/B copy; Esc → MENU at a run end, R19.
  Every copy reports COPIED / COPY FAILED through the ONE `app.toast` — on
  the WIN/LOSE overlay, and on STATS as a tag at the right end of the title row;
  `toastTick(toast,world,dt,app)` ages it only there and zeroes it anywhere
  else), `src/net/localpair.js` (`?net=local`),
  `src/render/shellview.js` (`drawShell` + the `kindSize`/`dims` logical box),
  `src/app/update.js` (`mountUpdate`: registers the SW and owns the NEW
  VERSION READY card; `U` (the printed letter, `letterOf`; never a chord) is its key, live only while the card shows),
  `src/app/loadbar.js` + the `#load` plate and inline `#loadjs` script in `index.html` (the honest loading bar, v197: finished files against totals `tests/loadbar.test.mjs` pins to the real graphs, `--write` re-pins; indeterminate when there are no numbers, shown after about 150 ms, a failure card with RETRY / USE CLASSIC 2D (a held run start's FLOOR TILES card: RETRY / BACK TO MENU, `__load.fail`'s drop label, its line naming no ART STYLE fix, shell v210); `rcache.js` paints it before a lazy look's fetch and bake; `#wrap` stays hidden until the title paints; `armUnlock`'s `skip` keeps the card's buttons from pressing the title; since v209 the first load is direction B · RICH: `#loadst`, boot only and beside `#load` (a fixed child would be placed against `#load`'s translate) so the chip and a look's docked card keep `#load`'s own box, draws `#c`'s border box as the stage, its floor (`--k-fl0` / `--k-fl1`) filling cell by cell with the finished files (round(195 n / (files + 1)), whole rows from the bottom), and the title's kit plate and logo B (inline SVG from `glyphs.js`; the stacked build on a portrait phone, re-placed on resize) at the title's rects in `#c`'s content box (fit.js `fitBox` and `portraitGeo`'s top, menudraw `titleLogoBox` and the prompt's backing, draw2d `titleSpot`; `tests/firstload.test.mjs` pins them at 1366x768, 1280x720, 852x393, 393x852 and 375x667); logo B's fuse lights from the collar as the progress (never done), the spark riding the front, so STARTING is the spark at the tip. `#load` is its status box in the title prompt's backing (sans 900 at the prompt's size, floored 20 / 16 px: the 14 / 11 px caps; `SLOW CONNECTION · STILL TRYING` replaces the count) and, on a 30 s stall or a failure, a kit card under the plate, lifted just enough to end 8 px inside the window where it does not fit there (a landscape phone, over the plate's foot) (`#loadsub` the second line; a failure has the coral notch and headline and the fuse goes out). REAL 3D (saved `r3d`, or `?render=3d|iso`) skips the floor, its board being tilted; REDUCE FLASH or reduced motion hold the spark's amber frame; it fades over 180 ms at the hand-off and never shows on a load under 150 ms),
  `src/app/fit.js` (`mountFit`: stage scale per layout reserve `FIT_RES`, and
  `body[data-lay]` = `d` desktop / `p` touch portrait / `l` touch landscape —
  the ONE predicate `index.html`'s touch layout keys off, never a media
  query; re-fits on `resize` and `orientationchange`). HUD reserves (UI
  upgrade Task 8.1, round 5 `09-hud`, CSS px): `HUD_RES`; `d` gives the chip
  plate 106 px above the board and the power-ups bar 57 below
  (`FIT_RES.d` [40, 163], exactly those rows: at the mock's 1366x768 the
  board is 0.84 of the v202 scale, the mock's own HK), carried by `#wrap`'s
  padding (`--ht` / `--hb`); `l` keeps `FIT_RES.l` (the chips stand in the
  side gutters, so a landscape phone keeps its whole board); `p` in GAME
  stacks plate (164), board, a band for the bar and the tile tip, and the
  strip (`FIT_RES.p` [16, 396] is that stack at one bar row and the pad
  floor). Pure `hudGeo(W,H,cw,ch,lay,game)` is the one slot geometry in
  viewport CSS px (d: plate, bar, tip column kept above the analytics card;
  p: plate, band, ctl; l: left / right gutter columns); `#hud` is its canvas
  (fixed, the viewport, click-through, z 3: over the board canvases, under
  `#sh`, `#touchpad` and the cards), backing owned by `fit` (`fit.hud(on)`
  shows it and hands back `{ctx, geo}`), `data-r` its reach that the
  analytics card clears (`analytics.js` `reach`). Portrait (`p`) only:
  pure `portraitGeo(W,H,cw,ch,game)` (`PORT_GEO`) centres the stage in the
  vertical slack (clamped 60 top / 190 bottom) and sizes the controls' band
  (pad 152–176) 24px above the bottom; while `#touchpad` shows (GAME only; a
  `MutationObserver` on its `hidden`), `game` puts the stage at the HUD
  plate's foot (`PORT_GAME.top` 164), pad cap 176, the band under the board
  at least one power-ups row, and `--sd` 0.2s glides that edge only (0s on
  resize / rotation). `stripGeo` lays the round 5 strip in the band (`STRIP`:
  D-PAD box 20 from the viewport's left, three keys 10 apart, never under
  44; a 130 column 16 from its right: BOMB 90/176 of the band at its foot,
  THROW and REMOTE as two fixed halves of one row above it), written as
  `--st/--tp/--tpl/--tpt/--tbw/--tbh/--tbr/--tbt/--taw/--tah/--tthr/--ttht/--trem/--tret`.
  The strip's keys are painted by the HUD on `#hud` (Task 8.3: the D-PAD as
  four kit keys round a well, BOMB the yellow main key and the frame's one
  yellow, THROW / REMOTE keys only while held, all in PLAY only; the PAUSE
  key in the plate's grid on `p`, at the right gutter's head on `l`, reading
  RESUME while paused, painted in PLAY and PAUSE only); on `p` and `l` the
  `#touchpad` children are transparent hit areas over them (`:active` a
  cream wash, their inner icons hidden), and `createHud` docks `#tpause` on
  its painted key (stage-relative CSS, written on a change). `l` keeps its
  gutter controls (`HUD_RES.l`: pad 152 at 8 from the stage, so the D-PAD
  keys stay 44; bomb 72, THROW / REMOTE 52), `hudGeo` mirrors them.
  INTRO/MENU/ATTRACT keep the centred stage.
  `shellGeo` sizes the shell box `#sh` on every layout that has one (see Menu look).
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
    `tests/pixel-render.test.mjs`, now `238a30af:71940`: re-pinned by ruling
    for each 2026-10-21..25 art round, the diff proven to be the intended art,
    and for UI upgrade Task 8.2, whose diff is exactly the old HUD segment
    removed (the board no longer draws a HUD; `9fb48f0a:72431` and
    `97480c1c:22630` are stale). The HUD has its own pin, `tests/hud-kit.test.mjs`
    `HUD_PIN`. Beside it, `classic-perf`
    pins a named tile world through `classicHash`'s `opt` (gen 3, seed 4242,
    room 3 FACTORY CONVEYOR, CORE: `cef5c020:70998`, was `7e57d1aa:71503`, #35 / #18) and checks that
    nulling the tile layer moves it. See the PIXEL paragraph below.
  - kind `"iso"` — legacy dimetric (`r3d/`), pinned by `?render=iso` only.
    `createRenderer({kind:"3d"|"iso"})` is the **dimetric** branch. Real 3D
    never enters that factory. Menu ART STYLE (the RENDER row) cycles CLASSIC 2D → PIXEL → REAL 3D
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
    (`hudart.js`, x1 in chips, x2 on a GUIDE page where the cell is 40 px or more;
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
    `tests/three.test.mjs` §4b first. Those figures are the BOARD BOX's
    (p / l). On `d` (owner pick D, 2026-11-14, veto 2) `#gl` is `GL_WIDE`
    1.12 x the board box across, centred (fit.js `glBox`, `data-gk`; the
    wrapper widens the frame and buffer, `projBoard` maps back into `#c`), so
    the board keeps its pixels and the bezel at STANDARD is `|ndc| 0.9594`,
    on screen (§4b-wide: <= 0.97 every preset). `#gl` wears the frame and
    glow there, and `fit.wash` carries `#c`'s / the stage's veils over the two
    strips (`#wl` / `#wr`). The near-corner taper stays OUT.
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
    Its outer contour is the plain rectangle in every world (Task 9.7, owner:
    "and look when camera is in far, this is wrong and fix"): the 2026-10-25
    near-corner taper (`nearX` / `NEAR_Z`, the near quarter of the E / W edge
    leaning in to stay on the canvas at STANDARD) read as a flared, bent tray
    once the camera pulled back, so it is gone and the near corners bleed at
    STANDARD as documented; `three.test` S4.E pins the four corners.
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
    the only render module that may read `src/app/` — screen constants and the `ITEMS` / `LEVEL_ROWS` label tables only,
    and scores arrive as a getter so `highscores` stays on the app side.
  - Board look modules (2026-10-25, record
    `docs/superpowers/specs/2026-10-25-board-look-depth-ambient-design.md`):
    walls `wallart.js` / `wallvar.js` (`wallHash`, render-side) + PIXEL
    `pixel/art/walls.js`; base floor `floorart.js` (`paintFloor`, 4 variants x
    2 parities); floor tiles `featdraw.js` (`cellSpec`, `drawSpec`, painters in
    `featart/{built,living,geo,kit}.js`), PIXEL `featpx.js` + `featpxcells.js`,
    REAL 3D `three/featmesh.js` (`fragSource(GEO)`); outline `frameart.js`
    (world bezel) + `frame.js` (recessed well; no HUD plate since Task 8.2), REAL 3D
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
  once; STATS shows the lifetime counters incl. `DAYS PLAYED` (`a.days`, one
  per new LOCAL `ld` at `room_enter`, monotonic, self-heals a future `a.day`,
  never a streak), the best run and three bests through `statsView`; `statsRows` stays for the payload's tests) · `daily.js` (`nb.daily.v1`, one board a day from a **date string**,
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
  Touch (T1): `statsHit` maps a tap on the painted foot's COPY MY STATS / RESET
  (a controller's foot: COPY / MEDALS), a touch key, or armed AGAIN ERASES / COPY to
  `KeyC` / `KeyR` / `KeyT` through `input.onUiKey` (the keyboard's own path), so the
  two-press confirm and the COPIED note are the same. A non-mouse C hit copies on its
  `pointerup` (`statsC`, cleared on `pointercancel` / `pointerleave`; the reset is
  disarmed at the pointerdown): a touch `pointerdown` grants no clipboard activation.
  C while armed (key or tap) disarms and copies. Any other tap while armed disarms and
  stays on STATS; no point of the idle RESET or COPY targets is AGAIN ERASES.
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
  locked row shows `—`). Value strings show resolved truth (`AUTO 1.5X`); each `gfxView` row also carries `at` [i, n], its place on its own list (QUALITY: the preset, -1 for CUSTOM), so the page marks the arrow that cannot move.
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
  A rebuild (ANTI-ALIAS or SHADOWS) deferred behind another look's job, or
  cancelled by a RENDER pick, is queued, never dropped (delivery review 5,
  shell v210): rcache `rebuildAgain()` re-arms frameloop, which rebuilds once
  that job ends, or drops the stale cached 3D if the look moved off it.
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
  of a pad, SENSITIVITY or vibration. The reserved `kick` slot stays false. Button ids, binds and the store are positions
  (ids `S E W N SHL SHR TRL TRR SELECT START dU dD dL dR`); what a player reads names the controller in hand (owner ruling R-LABELS, 2026-11-14:
  "our system must be smart and detact true and show the users the right lable", reversing "by position only, no maker's name"): `src/app/padfamily.js`
  `familyOf(id)` reads the vendor id (Chrome `Vendor: 045e`, Firefox `045e-028e-`; `045e` xbox, `054c` playstation, `057e` nintendo, the Switch 2
  bridge included), else the name, else `generic` (Steam Input and DS4Windows present an Xbox pad and read as one; Firefox's unpadded ids, e.g.
  `54c-9cc-`, miss the vendor match: open); the id is matched there only, never printed, stored or sent, and the family goes nowhere near
  analytics (`tests/analytics.test.mjs` holds every event param and user property free of a controller field, v219). `FAMILY_LABEL` (pinned equal to words.js `PAD_FAMILY_WORDS`): Xbox `A B X Y`, `LB RB LT RT`, `VIEW MENU`; PlayStation `CROSS CIRCLE
  SQUARE TRIANGLE` (a painted keycap draws them as kit `glyph` cross / circle / square / triangle, kit/paint.js `PAD_GLYPH`; a painted text run, PAUSE's foot and
  the HUD toast's `BOMB ✕`, draws the glyph inline at its cap height through kit `runText` / `runW`, the fit counting the glyph's width; the live region,
  the probe's text and screen-reader text keep the word; a DOM keycap the characters, `btnCap`; a run with no such word is kit `text`, call for call), `L1 R1 L2 R2`, `CREATE OPTIONS`; Nintendo by position `B A Y X`, `L R ZL ZR`, `− +`
  (said MINUS / PLUS); generic the positions SOUTH EAST WEST NORTH, L/R SHOULDER, L/R TRIGGER, SELECT, START, exactly as before (every pin unchanged).
  The pad snap carries `family`; controlswire hands it only on the standard mapping (a non-standard pad keeps `BUTTON n`), keeps the last pad's until
  another arrives, and re-lays the hints once per switch (`wordsOf(dev, c, names, family)`; a family's pad words also carry `family` and `say`). The
  CONTROLS rows, foot, rule, status, callouts and the drawing's face legends (padart `drawPad` `fam`, the body stays generic), the run ends' and
  RECORDS' WEST / NORTH caps, LEVEL SELECT's NORTH line and the update card follow it. Seams: `src/app/controlswire.js` (the wire), `gamepad.js`
  (poller, above the frame gate; radial deadzone, 4-way; SENSITIVITY `SENS_LEVELS` MIN 60 / LOW 40 / MEDIUM 25 / HIGH 15 / MAX 8, turn 1.40x to 1.10x, release `dead - 0.05`, `- 0.10` at 40 and above, floor 0.03; no response curve; a menu's first engage is vertical unless x > 1.25y), `padroute.js` (pad -> `Input` / shell, the
  swallow rule), `capture.js` (all input up, then 200 ms; later MOVE steps and a retry need only the release;
  no timeout), `controlspage.js` (reducer), `controls.js` (model, rules, store), `hints.js` (device tracker,
  0.75 s dwell, `wordsOf`, `helpOf`), `rumble.js` (one-way from the event drain; player word VIBRATION, internal names stay `rumble`; stored `vib` OFF / LOW / MEDIUM / HIGH, default MEDIUM, owner's call, `rumble` still written for older cached pages; scale 0.4 / 0.75 / 1 gives x, played as x from 0.5 up and as `0.35 + 0.3x` below (`LIMITS.knee`), LOW never past 0.40; independent of REDUCE FLASH; `PATTERNS` lose, hurt, win, shield, chain, close, near, plant, test, and the menu feels launch, enter, hello, deny, confirm, back, move (2026-11-03, owner: "subtle vibration when menu changes"; shell call sites write one ranked slot `app.feel` (`menuapp.js` `FEELS`), `controlswire.js` arms it around the pad poll's routing and plays one feel per press, launch > enter > deny > back > confirm > move; deny only where a refusal is shown; hello on connect off GAME PLAY; weak motor except back, strong .3; none over 250 ms or 0.7; menu cap 900 ms per 10 s on cursor ticks, page feels (enter, back, deny) always play but count, launch and hello outside it; a late frame plays a menu step late, never skips it; gameplay preempts; record's Menu feels section); `LIMITS`: a pattern at most 500 ms and 3 pulses, a pulse at most 300 ms, gaps at least 80 ms, 4 pulses a second or 2 at LOW, about 50 % on-time, hurt and lose exempt, near + plant 900 ms per 10 s; LOW drops plant, near and menu ticks; OFF is zero calls through the one `fire`; a run and menu ticks only while `app.lastDev` is the pad, the row's test pulse is the one exception; menu feels have no separate off, MEDIUM and HIGH only, never a hold repeat or a clamped edge, move and confirm at least 100 ms apart; no actuator shows `NONE` and `NO VIBRATION ON THIS CONTROLLER OR BROWSER`); a held menu direction (`app.repDir`) runs its frame at up to `HELD_FPS` 60 under the FRAME RATE cap, keys too; render side `controlsgeo.js`
  (the model: rows, rules, foot items, lit parts, callout planners), `pages/controls.js` (the page), `padart.js`,
  `hintcopy.js` (the setter that keeps `menudraw.js` free of `src/app/`). The page's paint is lazy since v202:
  `controlspage.js`, `capture.js`, `rumble.js`, `pages/controls.js` (its shared parts come from `kit/parts.js`, so its fetch never pulls
  `pages/settings.js`: `tests/loadbar.test.mjs`), `controlsgeo.js` and `padart.js` load through `shellview.loadControlsArt` / the
  wire's preload, never in the boot graph (`tests/loadbar.test.mjs` LAZY); the rest of the wire is boot. `rumble.js` loads on the first
  controller seen; a failed load retries on the next controller press or when CONTROLS opens with a controller in, never on a quiet poll
  (delivery review 7, shell v210; `tests/controlslazy.test.mjs`). `SCREEN.CONTROLS = 16`; from PAUSE `pauseView 3`. The door
  sits between GRAPHICS and RESET DEFAULTS; SETTINGS is twelve rows in REAL 3D and ten otherwise, at its page's pitches (v202 Task 3.4: see SETTINGS page).
  CONTROLS page (UI upgrade v202 Task 6.3, `src/render/pages/controls.js`; the round 7 C7-controls frames): on the world kit, opaque (`shellCovers`), the
  room of `app.level` behind it (MENU's own room layer at play scale, `roomKey` / `play`), PAUSE view 3 over the board in the played room's tokens inside
  the pause band ([44, H - 8] on #c; [8, H - 8] on a phone's over box, `F.free`, Task 9.10). `controlsGeom(F, view)` is the one geometry for draw and tap (rows by id; `controlsHit` answers `{tab}`, `{row}`, the kit pager's
  `{k: "page", d, to}`, `{off: 1}`, `{}`; while a rebind listens, the plate (or, with no drawing, the capture plate) is inert and off it cancels; the wire
  takes the page key as a focus on the page's first row, nothing confirmed). Top to bottom: kicker SETTINGS (PAUSE: `PAUSED · LEVEL n`) over the display
  title, KEYBOARD | CONTROLLER as kit tab bricks in a wall trough, the rows (MOVE BOMB THROW REMOTE PAUSE, a course, CONFIRM BACK or SENSITIVITY VIBRATION,
  a course, RESET coral with the reset glyph): bound inputs as kit keys (a position glyph and the button's name for the controller in hand: the family's label, a generic pad's the position word; a key's legend; MOVE's four keys; PAUSE's rebindable
  input `+ START` and a FIXED wall plaque; CONFIRM / BACK FIXED), stepping down whole (the words beside glyph keys, then PAUSE's fixed partner, then MOVE's
  set as one key); SENSITIVITY and VIBRATION steppers (◀ a well window with the word and a meter of bricks ▶; a door on the phone); a changed row a cream
  dot and `CHANGED` on its status line; a swap `SWAPPED`; armed RESET `PRESS AGAIN`; focus the band and the bare bomb, the drawing ringing the focused
  row's button (tap mode: none). Desk (any keyboard box, or a touch shell box, holding u >= 0.8): head, tabs, rows and the row's status line in the left
  column (440, 500 at 125 %), the pane the plate's full inner height on the right (a floor slab: the device's name and `PRESS ANY BUTTON TO TEST IT` /
  `ALWAYS ON, ALONGSIDE A CONTROLLER`, the drawing LARGE with its callouts at the kit's row type, the rule `In menus SOUTH or START confirms and EAST goes back.
  Those never change.` / `ENTER confirms and ESC goes back in every menu. Those never change.`, the foot plaque `ROW ▲▼ · TAB ◀▶ · CHANGE ENTER · BACK ESC`,
  label first, keycap last, whole items stepping down); the plate centred in a tall box (the top margin a minimum). Callouts show at 1366 x 768 and
  1280 x 720 at 1 and 1.25; a 1024 wide pane draws the drawing without leaders (the rows name every input): its art box is 420 wide (376 at 125 %)
  and the full callouts need 556 / 548 (600 / 580) for the controller / keyboard, more than any list or margin step frees (Task 9.10, pinned in
  `tests/page-controls.test.mjs`). Col (a keyboard #c, PAUSE on keys): the list
  alone with a compact drawing (no callouts) at the head's right, the status line and the foot, scaled as one piece. Phone (a touch-portrait shell box,
  every touch #c and touch PAUSE view): the column in CSS px, BACK and the title, the tabs, the name line, the drawing over the rows where both fit,
  rows 44 CSS px 8 apart, paged with the kit pager where they do not (a tight page closes the margins, drops the name line and puts the tabs in the
  head row beside a chevron BACK), the status line, a controller's cue line. A rebind listens in place where the page draws its drawing (the prompt
  `PRESS A BUTTON FOR THROW` and `NO TIME LIMIT` over the drawing, only the action's button lit and ringed, the cancel words label first), else on a
  capture plate. Task 9.10 (the -capture frames): on the desk the target carries the one callout (`controlsgeo.js` `capCallouts`: the action over
  `NOW WEST`; a 1024 keyboard keeps none, under `KB_FULL`) and an in-use plaque stands under the drawing in the rule's place (`BUTTON ALREADY IN USE?` /
  `KEY ALREADY IN USE?`, `The two actions swap, and the page says which one moved:`, and `inUseLine`'s example, the swap line `bindBtn` / `bindKey` would
  say for the first other action, e.g. `SOUTH WAS BOMB · BOMB NOW WEST`); the phone puts `IN USE? THEY SWAP:` and the line's two halves beside the
  controller (under a keyboard) and draws no leader. A MOVE set listens with neither. Where the foot will not hold the cancel words (1024 at 125 %)
  the status line carries them, label first. While listening `padFit` (its `floor` flag) also tries the PAD_KEEP floor itself after its 4-unit stride; the static drawing keeps the stride alone. Cached: the room, a base layer at 1 device px a box unit (plate and slab), the column layer at full dpr (head, tabs, courses, rows at
  rest), the drawing's own layers (its VIBRATION twin made with the page) and one small layer per foot keycap, all made with the page so a cursor move
  never misses; a steady frame is about 280 canvas calls and 0 measureText. Probe page `controls`; `tools/ui/lib/screens.mjs` exempts band on phone
  captures (tap mode) and ring / locked only where none is drawn (`exemptIfNo`). ↑↓ rows, ←→ tab (`[` `]` from any row), ←→ on SENSITIVITY or VIBRATION
  adjusts. A controller connected, back or lost while a run PLAYs is a HUD toast (owner 2026-11-12: "I connected the controller and it does not a toast"; controlswire `app.padToast` {k, move, bomb, a}, `TOAST_MS` 3000 fading over its last 400 ms, main hands it as `ro.padToast`, hud.js `toastState` puts it in the tile tip's plate and slots with no leader, over a tile tip while it lasts: over the chip plate on `d` and `p`, filling the plate's height so each chip under it is covered whole and the PAUSE key stays clear (owner veto 3, pick B, 2026-11-14; was beside the board / above the strip), the left gutter on `l` (title `CONTROLLER`, its state leading the lines under it, the title stepping down to the primary cap floor where even that will not fit); words.js `PAD_TOAST`: `CONTROLLER READY` / `CONTROLLER BACK` + `MOVE D-PAD · BOMB SOUTH` (the controller's own binds, a no-break space inside each pair), `CONTROLLER LOST` + `THE KEYS STILL WORK`); a READY or BACK shown in a run is not repeated by the menus' note; off PLAY the note works as before. MENU carries the note `CONTROLLER READY · SETTINGS › CONTROLS`, naming the VIBRATION level where it fits, and the SETTINGS door reads `VIBRATION MEDIUM ›` the same way (the `›` is the door's chevron glyph; on a narrow touch row the words take the row's second line, whole); no SETTINGS or PAUSE row of its own. Tap rule exception: on CONTROLS a tap off the
  plate backs out anywhere in the viewport, not only on the canvas (not while its LOADING plate is in flight: see Lazy pages).
  The controller drawing (UI upgrade Task 6.1, appendix 9.1/9.2, the round 7 C7-controls frames) is `padart.js` `drawPad`: the generic twin-grip body
  (`HALF` / `BUMP` / `PADG`, sizes in body width W, face buttons 0.104 W), top-lit gradient FILLS (the approved exception) and hard offset drops, no
  filter; every bound input (the D-PAD, the live stick, START, each action's button: `controlsgeo.js` `padStates`) in the world's brick
  (`worldTokens` of `app.level`, or the played room's from PAUSE view 3: shellview hands `level`), unbound ones quiet, the focused row's button
  ringed (`padRing`: none on SENSITIVITY / VIBRATION / RESET), VIBRATION lights both grips, no cord or spark anywhere. The static drawing is one
  `kit/cache.js` layer keyed by world, W, dpr and the lit set; ring and press draw live. Callouts (`padCallouts` / `padPlan`, drawn by
  `drawCallouts`): one per bound input by position, ACTION over the button's name for the controller in hand (the family's label; a generic pad's the position word), START with a FIXED tag; plain orthogonal leaders, START /
  SELECT / WEST rise to a lane, the rest run straight out and drop through a gutter knee (the lower leader on the inner knee). `padFit` takes the
  largest W whose plan passes `padCross` (leader vs leader, a leader within r + 2 of another input, a bound shoulder or trigger included) and
  fits the art box, never under `PAD_KEEP` 0.7 of the compact size; under `PAD_FULL` 180 or with no clean plan (a rebind of a trigger or shoulder beside WEST) it draws the compact
  drawing with no leaders, and the rows name the buttons. A desk-sized box (`WIDE` 800 up) widens the plate (`WIDE_W` 1000) and lets the pane
  grow past the list, so callouts show on the desk; the 600x520 box (PAUSE view 3, small windows) is compact. NO CONTROLLER: the locked body
  (rule tone under the wall texture), every input a well, a `NO CONTROLLER` plaque and the appendix line `Connect one and press a button.` (words.js `CONTROLS_WORDS`). Callout FIXED tags are wall plaques (the world's band, the dark outline); an armed reset row says PRESS AGAIN, then AGAIN, and the rule line always does. Capture: the controller in the capture plate, every input
  quiet but the action's own button lit and ringed, the cancel foot, nothing counts down (`CAP_H` 200). Player copy says controller: the pad
  tab's reset row is `RESET CONTROLLER`.
  The keyboard drawing (Task 6.2, appendix 9.3) is `padart.js` `drawKeys`: a tenkeyless board in key units (`KB_ROWS` / `KB_KEYS` / `KB_AT`, KeyboardEvent
  codes, 18.5 x 6.5 u; TAB 1.5, CAPS 1.75, SHIFT 2.25 / 2.75, ENTER 2.25, BACKSPACE 2, SPACE 6.25, ESC 1.5; the arrows an inverted T after a 0.5 u
  gap), keycaps a top face over a darker skirt, the deck top-lit with a hard drop; the bound keys (the MOVE set, BOMB, THROW, REMOTE, PAUSE's second
  key) and the fixed ESC and arrows in the brick (`keyStates`), never J / X; the focused row's key ringed (`keyRing`; ENTER on CONFIRM). Legends
  (`kbPrints`, `kbLegend`) print where they fit the top face at >= 10 px (the F-row all or none, a lit key never blanked); at a phone's or the
  600x520 box's pitch only the arrow glyphs print and the rows name every key. Callouts (`keyCallouts` / `kbPlan` / `kbCross` / `kbFit`): BACK on
  ESC and MOVE on the arrows with FIXED tags, each action on its key; a left-edge key runs straight left, the top rows up through the key gaps
  and the bottom rows down, jogging along a row gap to a clear column line when boxed in; labels tier out so no leader crosses a leader, a
  label or a foreign key, else the board draws no leaders. Store `nb.controls.v1` (KEEP); invalid data
  loads that device's defaults, an off-level SENSITIVITY value snaps to the nearest level, a bad `vib` never touches the binds. Keyboard defaults: BOMB SPACE (J, X silent
  aliases until BOMB moves), **THROW E** (SHIFT + BOMB still throws, never advertised), REMOTE Q, PAUSE P, ESC
  and arrows fixed. Pad defaults: BOMB SOUTH, THROW WEST, REMOTE EAST, PAUSE SELECT, START fixed; menus use the
  fixed layer SOUTH / START confirm, EAST back (on LEVEL SELECT START always starts the run). Pad start rule: one pad press leaves the title and starts the
  show, silently if the ctx will not run, `app.soundNote` then says `NO SOUND YET`. No pad route to
  the consent card (a stray button must not consent; an unanswered SETTINGS ANALYTICS row is inert on a pad and says
  `ANSWER THE CARD · Y OR N KEY`), the STATS wipe or the camera reset, on purpose. Disconnect pauses only with the pad last
  used in GAME PLAY (`CONTROLLER LOST`), never resumes. Pad name `CONTROLLER 1 · STANDARD` (`BUTTONS 0-N` non-standard); the device
  id is never printed or stored. A pad the browser hands over in its own HID order (mapping "") that `gamepad.js` `KNOWN` lists (by id and
  by its button and axis counts, 21 / 6) is put back in the standard order before anything reads it (`asStandard` / `standardPads`, applied once in `controlswire`; the id is matched,
  never printed or stored): today the Switch 2 Pro Controller (057e:2069; D-PAD from its buttons 8-11, Y axes flipped, its 12-bit sticks
  scaled 1.37). Browsers see that pad only after a USB start-up sequence, which the game sends itself (plan
  `docs/superpowers/plans/2026-11-14-every-controller-and-keyboard.md`, shell v219): `src/app/switch2.js` (lazy: SRC / LATER / loadbar LAZY, never
  boot) `wake` claims USB interface 1 and sends ten packets ported from SDL (`src/joystick/hidapi/SDL_hidapi_switch2.c`, zlib licence) and ALTERED
  (report format 09, not SDL's 05: the pad then sends HID report 0x09, which the browser maps to a gamepad), then releases and closes; `usbReach`
  is WebUSB + the page's `usb` policy + macOS (the one measured platform), so the controller wire builds a waker nowhere else. `auto()` runs once at
  the first deferred slot after mount (`deferRegister`, off the title's first paint; idle or not, so a `?play=1` / `?code=` deep link wakes too) and on every USB `connect`: a pad granted before wakes with no prompt, one already playing is skipped. CONTROLS' CONTROLLER tab shows
  the CONNECT row (`SW2_WORDS`: SWITCH 2 CONTROLLER, door CONNECT / CONNECTED whenever a Switch 2 is in the pad list (`seen`) / ALLOW VIBRATION) after
  VIBRATION, only with a waker; its help takes the rule's place in the pane (`sw2Help`: the vibration clause only with WebHID). Enter, a click or a
  touch `pointerup` opens Chrome's chooser (`request()`, inside the press: a touch pointerdown or a controller press has no activation, so a pad
  press says `PRESS ENTER OR CLICK` and the foot reads `CONNECT ENTER` / `ALLOW ENTER`); results CONNECTED, NOT CONNECTED · TRY AGAIN, IN USE BY
  ANOTHER APP, COULD NOT START IT HERE, NOT ALLOWED ON THIS PAGE. The pad gives Chrome no vibration actuator, so ALLOW VIBRATION (WebHID present,
  none allowed, a Switch 2 in the list: `vibOffer`) asks for the HID device (`allow()`; a later visit `restore()`s it through `getDevices()`), and
  `standardPads(get, actuatorFor)` puts the waker's stand-in on the mapped pad where it has none: a `dual-rumble` actuator that streams SDL's HD
  rumble (`rumblePacket`, report 0x02, the encoder of the trial page the owner felt, 2026-11-14) every 12 ms while an effect runs, one zero
  packet at its end, `reset()`, hidden, `pagehide` or a HID disconnect; a real actuator always wins, and `rumble.js` drives it like any other.
  One HID device per waker: two Switch 2 Pros share one buzz (documented, one pad measured). Bluetooth: not seen by the browser. A hat D-PAD (an
  axis) is parked until a captured pad has one (plan Task 5). `tools/pads/probe.html` (dev-only, not in SRC; stores and sends nothing) walks a pad
  and prints its `KNOWN` row; `docs/controllers.md` is the measured matrix (only real captures, everything else `not measured`). Keys print in the
  player's own layout: controlswire `keyNames()` (session only, never stored) fills from `navigator.keyboard.getLayoutMap()` at mount and on every
  window focus, and from each plain keydown, through `controls.js` `layoutName` (one printable ASCII character, a letter upper-cased; a numpad key
  keeps NUM n), read by `wordsOf(dev, c, names, family)`, the CONTROLS rows and the keyboard drawing's legends. THE LETTER RULE: every letter
  shortcut (R C B T Q E M Y N U) answers `controls.js` `letterOf(code, key)`, the printed Latin letter wherever it sits (QWERTZ's Y is the code
  KeyZ; a letter position printing punctuation, AZERTY's M key, is no letter; another script keeps the code's letter); binds and movement stay on
  `code`; `refuseKey` refuses a key that PRINTS a shortcut letter (stored binds are judged by place only, never dropped); a key bound to play (the MOVE
  set, BOMB THROW REMOTE PAUSE: `playKeys`, menuapp `boundKey`) is never one of the refused letters R Y N C B M T U, whatever a layout prints on it
  (`controls.js` `shortcutOf`, read by main, menuapp, analytics, update and the wire's chord guard: Colemak's MOVE DOWN KeyS and Workman's THROW KeyE
  print r and stay a move / a throw; a bound key printing Y never consents); the letter is "", never the raw code (Dvorak may bind KeyR, which prints
  p); only a real keystroke is judged: a tap or a controller press (`onUiKey(code)`, no key) keeps its shortcut on a bound code; Q and E stay RECORDS' tab keys on QWERTY's own REMOTE / THROW, and the silent J / X aliases are not counted (Colemak and Workman print N only on
  KeyJ: NO THANKS keeps a key, as ALLOW does); a chorded press (Ctrl, Cmd, Alt, AltGraph) answers neither the consent nor the update card. Keyboard diagonals stay about 1.41x while a pad is 4-way, disclosed. **The owner has
  played on a real controller (2026-11-02) and reported it works; details not yet reported, so M1-M7 stay open. On 2026-11-03 the owner felt the VIBRATION row's test buzz on a real controller on macOS; the in-run patterns are not yet reported.** No URL flag; `__GAME__.ctl` is the test hook. `keys.test` carries the pad matrix.
- Pickup feedback (owner: "agree with research team, let's work on all of
  them", 2026-10-10). All names/copy come from `POWER[].name` / `.help` —
  never a second source. `fx.js`: one floating label per `power` event showing
  the value AFTER pickup (`FLAME 3`, muted `MAX` at the cap, `SPEED UP`,
  `+1 LIFE`, `LINE BOMB` + a `replaces POWER BOMB` sub-line on a bomb-kind swap);
  same kind merges, near ones stack, max 3, 0.9 s, PLAY-only clock, wiped by
  `clearR2`; suppressed for the live coach v2 kind; pure `labelBox` keeps it
  off the y46 HUD band, the combo callout and the coach panel (REAL 3D
  projects through the live camera). HUD (UI upgrade Task 8.2, round 5
  `09-hud` on the world kit, `src/render/hud.js`): off the board on `#hud`
  (fit.js `hudGeo`) in every look, so no board canvas draws a chip; seven
  labelled chips LIVES BOMBS FLAME LEVEL ENEMIES TIME SCORE (one row in the
  rampart plate above the board on `d`, a three-over-four grid with the PAUSE
  slot on `p`, one-line chips in the side gutters on `l`); LIVES up to five
  hearts, else one heart and the count; LEVEL with HARD / EXPERT beside it off
  NORMAL; TIME the room clock (`o.time.t`) in every run; values in fixed digit
  cells at cap >= 18 desktop / 11 phone, stepping down (hearts, value, label,
  difficulty word, then on `l` an icon chip's label) to fit, never clipped.
  HUD pulse: a 600 ms ring just inside the BOMBS / FLAME / LIVES chip when the
  number changes (fx `getPulse`; the first feed after a wipe only seeds, so a
  room change never pulses). Power-ups bar (the old ability bar): held SHIELD
  / KICK / THROW / PASS / bomb kind / REMOTE / SPD n under the board (`d`,
  widened past the board only when every label would not fit; THROW and
  REMOTE carry their key cap on a keyboard layout), in the band under it
  (`p`), as glyph cells under the left chips or the board (`l`); a chip a hit
  or spent SHIELD removes dims out over 600 ms (a bomb-kind swap is not a
  loss); PLAY / PAUSE only. `createHud()` (one main.js call a frame, GAME
  only; ATTRACT, INTRO and menus hide `#hud`) paints only when what it shows
  changes, so a held PAUSE or a still TIME makes no canvas call; the plate's
  ring is a kit cache layer; the probe records page `hud`. `scenes.js` keeps
  `ABAR` (the strip's fade, dim and the ghost coach's bottom lane) and
  `abilityChips`. Floor-tile tips (coach v2's tile kinds, Task 8.3) are the
  HUD's (the controller toast borrows their plate and slots: see CONTROLS): a kit plate beside the board on a leader (1.5 px t2 over 3.5 px ol,
  a dot on the tile) to the nearest tile of that kind to the player, through
  the live look (REAL 3D's `renderer.proj`, a non-enumerable wrapper field;
  the 2D user camera), on the wider side on a desktop, at the band's foot
  over the controls on a portrait phone, in the left gutter on a landscape
  one, else over the chip plate, never over the board; `scenes.js`
  `boardTip` keeps every other tip on the board. The plate, chip bases,
  strip and glyphs are kit cache layers, so a phone repaint with every part
  live stays under 400 calls (`touch-strip.test`). Touch `#tthrow` / `#tremote`
  (`touch.js`): shown only while the player holds that power, a tap is a
  one-tick `pulseThrow` / `pulseRemote` intent, fixed slots. Every idle
  frame paints nothing new. All three looks (PIXEL uses its own cells for
  the icons, `hudart.js` `pixelArt()`).
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
  yes and a muted no), and only Y / N (the printed letters, `letterOf`; a chorded one passes on) are taken while it shows. It shows on
  MENU and its pages, and in GAME only on a keyboard layout when
  `cardClears` (it sits beside or under the `#c` stage); never INTRO /
  ATTRACT, never a touch run (the bomb button's corner); it waits while NEW
  VERSION READY is up. It stays until answered (no snooze).
  SETTINGS `ANALYTICS` ON/OFF (a rocker) sits after REDUCE FLASH (row 8 of the twelve, 6 of the ten outside REAL 3D); OFF sets `ga-disable-<ID>`, denies
  consent and expires the `_ga*` cookies. Cookies live on the game's own path
  (`cookie_path`, shared `github.io` origin); every ad signal is denied. Events:
  GA's page_view = an open; `run_start` from `startRunState` and `run_end` from
  `endRun` (main's world only, never attract or the show), `mode`
  run/daily/code, `result` win/lose/quit via `isRunEnd`; user properties
  `days_played` (STATS `a.days` bucket at boot) and `look`. `src/app` never
  calls `Date`: main injects `now`. GA reports need the params registered as
  custom definitions (owner step).
- DOM cards on the world kit (UI upgrade v202 Task 3.6): `#upd`, `#ana` and `#load` (plate, chip, failure card) take their colours from `--k-*` custom properties in `index.html`'s `:root`, the static world-1 (JUNGLE) values of `worldTokens(1)` (`pane well key hover band lit frame ink off dk cor`, and for the first load's `#loadst` `fl0 fl1 bedA bedB wallHi ol t2` and logo B's JUNGLE `side`; `fl0` / `fl1` are the board's floors at their luminance under the title's 0.45 veil, `tokens.js` `FLOOR`; `frame` = wall, the flat stand-in), no raw palette hex (the scrim, shadows and glint stay plain rgba); `tests/hidden-css.test.mjs` pins each equal to `src/render/kit/tokens.js`, so they cannot drift, and the boot graph grows by nothing. Keycaps come last (`RELOAD U`, `LATER EAST`, `ALLOW Y`, `NO THANKS N`, `RETRY SOUTH`); ALLOW and NO THANKS are one CSS rule; a look's failure card names ART STYLE. `#updbg`'s blur stays (CSS on a DOM element). A look's own card (`#load` with neither `data-boot` nor `data-dock`, e.g. REAL 3D · PREPARING after the first load's hand-off) is the kit plate (2 px `--k-ol` outline, 6 px hard drop, 4 px lit notch), words `900 var(--fs)` (20 px desk, 16 px touch: the cap floors), no wordmark line, a 10 px outlined well for its bar; the docked chip (a look loading from SETTINGS) speaks at the same size (20 / 16 px words, `width:max-content` up to `min(460px, --chip-w)`, min-height 40 / 34 px, a slow load's SLOW CONNECTION, STILL TRYING on its own line through `white-space:pre-line`, never an ellipsis) over its 3 px bar. Under prefers-reduced-motion `#load` and `#loadst` appear and leave with no fade (`animation-duration:.001s`, the 150 ms delay kept).
- `src/pwa/` — Node-testable app-shell list + SW register. `src/main.js`
  registers `./sw.js` (module, scope `./`). Precache lives in `shell.js`
  (`fusegrid-shell-vN`). Must include `vendor/three.module.js` and the whole
  `src/render/pixel/**` tree (art sheets included), or a look breaks offline. Never cache
  `og.png`. Never imported by `src/core`. Bump `CACHE_NAME` and the REV
  token in `sw.js` together when the file list or shipped bytes change.
  Install caches `BOOT` only; the idle stage (`LOOKS`: the off-boot files, PIXEL, then REAL 3D) fills ONLY inside an event's
  `waitUntil` (delivery review 6, shell v210): the page's `FILL` message (`register.js` posts it to the active worker once
  `ready`, and again on a later visible check) and a navigation; never a bare timer on activate. A pass resumes from what is
  missing and stops writing once its worker is `redundant` or its `CACHE_NAME` is gone (no `caches.open` that would re-create a
  cache a newer shell deleted); `tests/pwa.test.mjs` drives it on a fake worker scope.
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
  store. Updates are re-checked at boot, every 5 min while the page is
  visible and on `visibilitychange` once 1 min has passed (v215, owner 2026-11-14:
  "can you do this update check much faster?", the card kept). HEAL (v215, scoped in v216): a boot
  failure while a worker controls the page unregisters ONLY this game's
  registration (`scope` equal to the page's folder: `hmarzban.github.io` is
  shared with the owner's other Pages projects), deletes the
  `fusegrid-shell-v*` caches and reloads, by itself once a session (`fg-heal` in
  sessionStorage, cleared when the boot ends) and on every boot RETRY; never offline
  (`navigator.onLine` false). The loader's window error listener counts a file
  only under the game's own folder (not a bare origin prefix) and also takes a
  filename-less `SyntaxError`: WebKit reports a module link error with
  no filename, so a mismatched cache once sat on SLOW CONNECTION forever. Bridge: replacing a pre-v179 shell (`PROMPT_FROM 179`) still skips
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
  the three looks (CLASSIC 2D · PIXEL · REAL 3D) + the difficulties in the
  player's words (NORMAL / HARD / EXPERT since 2026-11-12, never Heat CORE / PLUS / MAX
  in copy), not "deterministic". The same words carry the meta description, og /
  twitter descriptions, the JSON-LD description, the manifest and the itch blurb
  (`media/README.md`, pinned by `tests/media.test.mjs`).
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
Held run starts (delivery reviews 1 and 4, shell v210; `src/app/lazyload.js` `createHold`, main's `hold`): a run start whose
gen 3 is not in yet (FLOOR TILES plate), or a deep link (`?play=1`, `?code=`, `?render=3d|px&play=1`, started after the renderers
mount) whose lazy look is not on screen yet (PREPARING plate), holds in GAME with the sim frozen; a held start counts as idle
(`idleNow`), so the look's job runs, and the run starts ONCE (a second ask while held only replaces its args) on the swap, or in
CLASSIC 2D for the session when the saved look fails. P / Escape on a held start cancels it to MENU (`__load.end(k, true)` clears
its card); the FLOOR TILES failure card offers RETRY and BACK TO MENU (Escape, EAST, a tap).

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
  17 bits in all; `z` is the ICE brake, kind `BRAKE`, gated by `glideBrakes`, closing it also sets `g`; copy `feat.js` `tileTip`, 6 s, drawn by the HUD beside the board since UI upgrade Task 8.3, a tip whose room is left closes
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
- Keep POWER-UPS (the GUIDE door once named ITEMS), ENEMIES, and HOW TO as in-menu help so power-ups and foes are explained in the shell, not only as HUD chips.
- Opening (2026-10-09): title, then press, then a ~4 s show (camera sweep, MAKO pop-in, fuse, the blast lands MENU: since v202 Task 3.1 the room look covers the board from MENU's first frame and the plate, logo and foot fade in over 0.25 s), with music from the press. Any key skips the show (the title waits for a press). First visits land on MENU at PLAY, not in a run. The title follows RENDER; the show plays the MENU theme throughout, and the `intro` track is kept unused.
- Difficulty is Heat on LEVEL SELECT (CORE / PLUS / MAX). Global **pace** (EASY / NORM / HARD) is a separate LEVEL SELECT control (`[`/`]`), persisted in `nb.pace.v1`, scaling player/enemy move speed on `world.pace` — not frozen `CFG`. Pact (`1–4`) and rooms 6–8 unlock after the first FUSE/GRID CLEAR. Score × heat is persist-only; the HIGH SCORES (RECORDS' SCORES) modifiers column counts the pact bitmask (`p`, words.js `modsCount`, R10). Music uses WebAudio stereo panning on the oscillator engine (zero npm deps). Mid-run heat, always-on Sudden Death, and internet play stay parked.
- Foes must read as arcade characters (distinct silhouette, face or lens, shading, facing) in CLASSIC 2D, PIXEL and REAL 3D, not flat colored tokens. `enemybody.js` is the 2D five-beat build; 3D matches via merged hulls in the four-mesh slot. Art only — do not retune AI.
- Do not commit `.cursor/` or `e2e-artifacts/` (both gitignored).
- PIXEL (hand-pixelled sprite look) SHIPPED in shell v178 (owner GO 2026-10-10: "work on the sprit version of the game, we have to let the user to chose between the sprit, 2d and then 3d in the menu … finish the job and not ask me anything at all"; supersedes the 2026-10-09 "planning only" ruling U3). It is the third RENDER look, CLASSIC 2D → PIXEL → REAL 3D, never a replacement — CLASSIC 2D stays the default. Judged on laptop AND phone, at today's board size (sharp-bilinear, no integer-snap shrink). Plan + rulings: `docs/superpowers/plans/2026-10-09-pixel-art-spike-plan.md`.
- GRAPHICS: one cohesive settings page (QUALITY preset + FRAME RATE / RESOLUTION / SHADOWS / ANTI-ALIAS / EFFECTS / DEMO / FPS METER) so the player picks look vs FPS/power. Defaults keep today's desktop look; departures from the frozen 3D recipe (SHADOWS SHARP/OFF) exist only as opt-in values.
- When an owner request lists several asks, finish all of them and record each in AGENTS.md, `docs/architecture.md`, `MEMORY.md` and the changelog at the end; housekeeping (servers, headless browsers, scratch) after every round.

## Learned Workspace Facts
- Surviving a hit leaves live bombs and blades in the world.
- Share the play URL with a trailing slash (`https://hmarzban.github.io/fusegrid/`); the no-slash GitHub Pages 301 has no Open Graph tags, so link previews fail. Share card is root `og.png` (1200×630); `og:image` stays the absolute Pages URL. The hero is a REAL capture of the live game, never generated key art, which drifts from the game. Since v214 (owner pick P2, 2026-11-12: "hey can you make another D4 version with pixlated world and design and with custom art design", then "yes p2") it is D4 in PIXEL: the eight worlds' real PIXEL boards (the renderer's native 300 x 260 art buffers, the same hash-checked moments) as stripes on one 600 x 315 art-pixel grid scaled x2 nearest-neighbour, inside a hand-pixelled cabinet frame with the logo's own small bombs in its corners, the game's PIXEL logo B (`pixel/logo.js`, title build, 2 art px a logo px) on a sign hung from two pixel chains, pixel keys NORMAL · HARD · EXPERT and PLAY IN THE BROWSER, and a marquee of each world's brick colour carrying its name; the frame, keys, labels and a 5 x 7 pixel type are custom pixel art in the PIXEL palette only (no new hex). Every card of that day, live and spare, is kept for the marketing team in git-ignored `.superpowers/sdd/marketing/share-cards-2026-11-12/`. Before it, v213 (owner pick D4, 2026-11-12, after rejecting every earlier card: "I do not like the cards at all, let's create more creative and fancy one", then "D4, eight worlds") it is eight vertical stripes of real CLASSIC 2D boards, one per world JUNGLE to CROWN, each a hash-checked demobot moment centred on MAKO, with a CROWN kit plate over the middle carrying logo B (the game's painter in CROWN's colours, its plate layer left out through `_seam.plan`) and the kit keys NORMAL · HARD · EXPERT and the yellow PLAY IN THE BROWSER, the world names along the foot; it names no art style (the one rule it bends: PIXEL and REAL 3D are not shown; the owner picked it knowing). Sources, scripts and the rejected D1-D3, D5: git-ignored `.superpowers/sdd/2026-11-12-share-card/round2/`. Before it, v212 (owner pick C) was the same real room 5 MAX moment (gen 3, seed 570168, bot seed 9432, tick 992, hash `d0908c59`) shown side by side in CLASSIC 2D, PIXEL and REAL 3D, each board only, under logo B's plate (the real title, drawn in ARENA's world: `app.level` 5 set through the `?debug=1` hook while the title waited; polish pass C2, owner: "yes, polish card C"), chips NORMAL · HARD · EXPERT (the in-game words since v203) and the PLAY IN THE BROWSER pill (sources, scripts and the rejected A refresh / B world kit: git-ignored `.superpowers/sdd/2026-11-12-share-card/`); from v201 (owner pick B, 2026-11-02) it was that moment split by a slash into CLASSIC 2D and PIXEL, with the shape-built wordmark (`.superpowers/sdd/2026-11-02-covers/`); the v180 card (owner pick C, 2026-10-19) was the ATLAS LEVEL SELECT page in CLASSIC 2D from a fresh profile, and the 2026-09 card the transparent-clear 3D JUNGLE board. Card sells CLASSIC 2D · PIXEL · REAL 3D plus the three difficulties (NORMAL / HARD / EXPERT since v212; CORE / PLUS / MAX before); the PLAY IN THE BROWSER pill spans that chip row (its left at the first chip's left, its right at the last chip's right) and type keeps a 10% inset. Sources, composer and the rejected A/B: git-ignored `.superpowers/sdd/2026-10-19-storefront/`. Never the reference game's name on the image or tags. Public About/meta copy leads with play-in-browser + the three looks + the difficulties (NORMAL / HARD / EXPERT); "deterministic" stays a contributor word, not the storefront lead.
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
- UI captures (Task 1.5, R14 / R15): `tools/ui/shots.mjs` (on `shot.mjs`'s machinery,
  same guarantees, its own flags; byte-identical CLASSIC PNGs) writes named screens, a dump of
  `__GAME__.ui.snap()` each and a `shots.json` manifest to git-ignored `tools/ui/out/`
  (one run per `--out` dir); `__GAME__.ui` exists on `?debug=1` only
  (`src/render/kit/probe.js`, handed in by main; only `shots.mjs` switches the probe on).
  `gates.mjs <dir>` judges the latest run only: no probe data is `skipped`, never a pass;
  `--strict` fails skips; `tools/ui/lib/screens.mjs` lists each screen's required gates
  (default-deny, a page cannot exempt itself; MENU is the first instrumented screen, Task 3.1; LEVEL SELECT the second, Task 3.3, exempting ring and locked with reasons; an exemption may be scoped to the captures it
  covers, `{why, when: [{phone, world}]}`, and `needFor` holds every other capture of the row to the gate; `winrun` `from1` captures a
  from-start run's finale through the debug hook); a probe fault, a page error or a missing
  capture fails. `compare.mjs` (`refmap.json`; MENU's frames are the L7 ones, logo B in the header), `sheet.html`.
  `scoresfull` / `statsfull` (v202 fix round 1) capture a played-looking cabinet: `__GAME__.seedRecords()` (debughook.js, `?debug=1`
  only) writes ten played rows, badges, medals and bests through the stores' own savers, after the fresh-profile pages. A row's
  `exemptPhone` adds exemptions for the `.phone` captures only (RECORDS: a phone capture is tap mode, which shows no focus). A row's `exemptIfNo` exempts a gate only on a capture whose probe recorded no rect matching its pattern (`needFor`; `statsfull`: locked, only where no `level n locked` cell is drawn). `statspage2`
  captures a paged STATS' second page (the page keys and ↓ / ↑ page SCORES and MEDALS too); `scoresidle` reaches RECORDS through the real `lazy.idle()` load (its wait never calls `want()`). Wrap every
  capture run in a watchdog (kill it by PID past 10 minutes, or when its `--out` dir stops growing for 3 minutes; a REAL 3D run once
  hung 1.5 h).
  CONTROLS has four captures: `controls` (the KEYBOARD tab), `controlsnone`, `controlspad` and `controlscapture` (THROW listening); a recipe's
  `pad` puts a standard controller in slot 0 through `navigator.getGamepads` (headless Chrome has none) and `ctl` calls the page reducer by name. Since Task 6.3 the page records the probe like every page: the four rows need every gate but band on a phone capture (tap mode) and ring / locked where none is drawn (`exemptIfNo`). `gatelib.mjs` still judges a row that exempts every probe gate, with no probe data, on its record alone.
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
  Updated live 2026-11-12 on the owner's word ("update all the SEO"): the About text names
  NORMAL, HARD or EXPERT, eight levels and keyboard, touch or controller; topic
  `deterministic-simulation` swapped for `gamepad` (still 20).
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
      colour. CLASSIC hash `9fb48f0a:72431` then (`238a30af:71940` since UI upgrade Task 8.2); px cap 160 KB (the px tree is a lazy
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
- Release state (2026-11-14): shell **v219** (every controller and keyboard, plan `docs/superpowers/plans/2026-11-14-every-controller-and-keyboard.md`: the Switch 2 Pro Controller in the standard order (`KNOWN`), woken over WebUSB by CONTROLS' CONNECT row (Chrome on macOS only) with its vibration after ALLOW VIBRATION (WebHID, the `dual-rumble` stand-in); button labels by controller family (owner ruling R-LABELS: Xbox, PlayStation glyphs, Nintendo; generic keeps positions); keys printed in the player's layout and letter shortcuts by the printed letter (chords answer no card); `tools/pads/probe.html` and `docs/controllers.md`; the hat D-PAD (Task 5) parked until a captured pad; main's v218 merged in first) is LIVE 2026-11-14 on the owner's "Push it" (`afbde56..c3a8dff`, Pages CI green, live `sw.js` v219), after the owner passed all 19 hardware checks ("Done, all good"). 779 tests (after the final review's fixes: a key bound to play is never a shortcut letter, `shortcutOf`; the Switch 2 `auto()` at the first deferred slot, not the first idle); CONTROLS / pad captures (CLASSIC 2D, worlds 1 and 8, desk and phone, 26 each) under `--strict`: desk 0 fail, 0 skipped; phone 114 pass, 0 fail, 0 skipped since fix C (the capture plate's `·` separators clear 4.5, a line that will not fit drops, and the plate declares its chosen / info pair; before it, 2 fail + 10 skipped on `controlscapture` with a controller as the last device). Open: the owner pushes.
- Release state (2026-11-14): shell **v218** (v217's loose ends closed: world-8 run-end gates no longer skip (endkit declares a won cell's check notch and the crack on the level fallen as info pairs, 16.3:1 and 7.3:1; not-reached cells are named `cell n ahead`; WIN's chosen exemption is "no level left to win"; the stale desk-only lose info exemption goes); tile tips beside REAL 3D's wider stage may take a third line, never shorter than CLASSIC (`stage-wide.test`); the orbit controls listen on `#stage` too, so the wheel and right-drag work over the side strips and survive a released `#gl`; the first load's stage is glBox wide when REAL 3D is saved on a desktop, so the hand-off does not step the frame (`firstload.test` pins it to fit.js `glBox`). 736 tests; v218 REAL 3D desk hud / title / win / lose and win / lose at worlds 1, 5, 8 desk + phone: 0 fail, 0 skipped under `--strict`) is LIVE 2026-11-14 on the owner's "Yes, push v218" (Pages CI green, live `sw.js` v218).
- Release state (2026-11-14): shell **v217** (the owner's three veto picks from the contact sheets, 2026-11-14: veto 1 D, the room behind every menu page is the world's floor only, no wall or brick (`kit/room.js`); veto 3 B, the controller toast sits over the chip plate on `d` and `p`, covering each chip whole, PAUSE clear (`hud.js` tipGeomOf; `screens.mjs` padtoast exempts info where the LIVES chip is under it); veto 2 D, REAL 3D's wider desktop stage (`GL_WIDE` 1.12, see the rig paragraph; built in a worktree, merged). 735 tests; combined v217 captures (REAL 3D desk menu / padtoast / play, CLASSIC 2D phone menu / padtoast) 0 FAIL, 0 skipped under `--strict`. Known: four tile tips show their short line in REAL 3D at 1366 / 1280 (the tip column is ~42 px narrower); a mouse wheel or right-click over the 3D side strips does nothing (listeners on `#c`); a narrow desktop window clamps the widening; a cold first load with REAL 3D saved may jump from the board box to the wider stage; ~12 % more 3D pixel work on desktop) is LIVE 2026-11-14 on the owner's "Yes, push v217" (Pages CI green, live `sw.js` v217).
- Release state (2026-11-14): shell **v215** (the update path, after the owner's Safari showed COULD NOT LOAD THE GAME on live v214 and RETRY only reloaded into the same state; it cleared on its own a little later, so the trigger, most likely a stale offline copy left from v201 or saved during the deploy, was never captured. Fresh WebKit, iOS 27 Safari in the Simulator and the v201 -> v214 upgrade path all boot clean. v215: the boot HEAL and the WebKit link-error catch above, update checks every 5 min while visible; verified by poisoning `src/main.js` in the offline copy in Playwright WebKit and Chromium: one automatic reload, the title on a fresh cache) went LIVE 2026-11-14 on the owner's "Yes, push v215" (Pages CI green). Shell **v216** (same day) scopes it after an automated security review: the heal unregisters only the registration whose scope is the game's folder (v215 unregistered every worker on the shared `hmarzban.github.io` origin, other Pages projects included), the error listener matches the game's folder instead of a bare origin prefix (a look-alike host passed), and a filename-less error must be a `SyntaxError`; re-verified in WebKit and Chromium, 725 tests; LIVE 2026-11-14 on the owner's "Yes, push v216" (Pages CI green, live `sw.js` v216).
- Release state (2026-11-12): shell **v214** (v213 with the share card swapped for the owner's round 3 pick P2, D4 in PIXEL in a pixel cabinet; og.png and its alt text; index.html is precached, so the bump) is LIVE since 2026-11-14: pushed on the owner's word as a fast-forward of `origin/main` (`e3bf4a3..0e47f7b`: v202 delivery, then the UI upgrade v203-v214), Pages CI green, live `sw.js` v214; GitHub release **v2.5.0**, shell v201 → v214 (its tag), its note updated the same day to cover v215 to v218. The owner re-uploaded og.png to the repo's Social preview the same day. Players jump from v201 straight to v214: the v202–v213 lines below were never live on their own. REAL 3D gate run 2026-11-14 (`tools/ui/out/r3d-2026-11-14/`, v216 HEAD export, `--gpu`): title, menu, controls, controlscapture, play, hud, pause, win, lose at worlds 1 and 8, desk and phone, 36 captures, 0 FAIL; 4 SKIPPED (world 8 `win` chosen, phone `win` chosen + info, phone `lose` info: no pair declared), identical in CLASSIC 2D, so an exemption-table gap in `tools/ui/lib/screens.mjs`, not a look fault; open. Open: device checks (U1–U15, M1–M7); the three vetoes were ruled 2026-11-14 and shipped in v217.
- Release state (2026-11-12): shell **v213** (v212 with the share card swapped for the owner's round 2 pick D4, eight worlds; og.png and its alt text; index.html is precached, so the bump) is PREPARED on `feature/ui-upgrade`. Never live on its own: shipped inside v214 (LIVE 2026-11-14).
- Release state (2026-11-12): shell **v212** (v211 plus the share card, owner pick C: og.png and its alt text in index.html and README; index.html is precached, so the bump) is PREPARED on `feature/ui-upgrade`. Never live on its own: shipped inside v214 (LIVE 2026-11-14).
- Release state (2026-11-12): shell **v211** (v210 plus LEVEL SELECT loaded after the title, Task 9.14: the boot graph 122 -> 120 files (level.js and kit/pager.js), 1,252,752 -> 1,192,855 bytes raw, 462,092 -> 440,910 per-file gzip, index.html aside; the delivery branch's c4e7598 (before v202, not live v201) was 101 files, 912,482 raw, 331,873 gzip, so the upgrade's boot growth over it is +280 KB raw / +109 KB gzip, was +340 / +130; against LIVE v201 (`e3bf4a3`: 114 files, 1,065,148 raw, 386,047 gzip, index.html 8,738 gzip) v214 is +128 KB raw / +55 KB gzip, +9 KB gzip in index.html, and the whole precache +309 KB gzip (audit 2026-11-14); v210: the 2026-11-06 delivery review fixes, ported: held run starts, a saved look that fails at boot kept, BACK TO MENU on the FLOOR TILES card, queued AA / SHADOWS rebuilds, the worker's fill inside `waitUntil`, the `rumble.js` retry; v209: the menus centred with the room at play scale, CONTROLS on the world kit with its capture callout, the phone overlays on `#sh`, the first load B · RICH, the title centred, the look card and chip, the REAL 3D straight rim, every overlay sharp at device px, the run ends centred on the board, the controller toast in a run) is PREPARED on `feature/ui-upgrade` on top of R4 (v206; v207 and v208 were local-only bumps, never handed out). Never live on its own: shipped inside v214 (LIVE 2026-11-14). Bumped because the lanes after v206 committed shipped bytes under the v206 name: a browser holding the v206 cache mixed old boot files with new lazy ones, so CONTROLS read DID NOT LOAD (`kit/room.js` has no export `roomKey`) and the pages kept their old top-aligned layout. Any shipped file committed after the last `CACHE_NAME` commit needs the bump before the owner loads it; lanes may skip it, the lead bumps before handing a build to the owner. Rollback: revert and bump `CACHE_NAME` / `REV` again.
- Release state (2026-11-12): shell **v210** (v209 plus the 2026-11-06 delivery review fixes, ported: held run starts, a saved look that fails at boot kept, BACK TO MENU on the FLOOR TILES card, queued AA / SHADOWS rebuilds, the worker's fill inside `waitUntil`, the `rumble.js` retry; v209: the menus centred with the room at play scale, CONTROLS on the world kit with its capture callout, the phone overlays on `#sh`, the first load B · RICH, the title centred, the look card and chip, the REAL 3D straight rim, every overlay sharp at device px, the run ends centred on the board, the controller toast in a run) is PREPARED on `feature/ui-upgrade` on top of R4 (v206; v207 to v209 were local bumps for the owner's own checks, never released). Never live on its own: shipped inside v214 (LIVE 2026-11-14); the owner's device checks (real phone, real controller) and the vetoes (the busier room behind the menus, REAL 3D's near corners off screen at the default zoom, the toast's place) were OPEN then, ruled 2026-11-14 (v217: floor-only room, wider desktop stage, toast over the chip plate). After R4 the lead ran the full capture check the owner asked for (CLASSIC 2D and PIXEL, desk and phone: title, menu, controls, controls capture, pause, win, lose; worlds 1 and 8): 0 fails, 0 errors. Bumped because the lanes after v206 committed shipped bytes under the v206 name: a browser holding the v206 cache mixed old boot files with new lazy ones, so CONTROLS read DID NOT LOAD (`kit/room.js` has no export `roomKey`) and the pages kept their old top-aligned layout. Any shipped file committed after the last `CACHE_NAME` commit needs the bump before the owner loads it; lanes may skip it, the lead bumps before handing a build to the owner. Rollback: revert and bump `CACHE_NAME` / `REV` again.
- Release state (2026-11-12): shell **v206** (UI upgrade release R4: the HUD on the world kit (`src/render/hud.js` on `#hud`, off the board: seven labelled chips and the power-ups bar), the phone touch strip and tile tips; CLASSIC call-log pins re-pinned by ruling to `238a30af:71940` / `cef5c020:70998`, the old log minus its HUD tail only) is PREPARED as a local release commit on `feature/ui-upgrade` on top of R3 (v205). Never live on its own: shipped inside v214 (LIVE 2026-11-14). Owner acceptance U15 OPEN; trimmed gate check (CLASSIC 2D, world 1, desktop and phone: play, hud). `hudart.js` now boots with the HUD (boot graph 122 files, PIXEL tree 28). Rollback: revert the release commit and bump `CACHE_NAME` / `REV` again.
- Release state (2026-11-12): shell **v205** (UI upgrade release R3: CONTROLS art, the controller and keyboard drawings with callouts in the world's brick (`padart.js`, `controlsgeo.js`), and logo B in PIXEL and REAL 3D (`pixel/logo.js`, `logo/draw3d.js`)) is PREPARED as a local release commit on `feature/ui-upgrade` on top of R2 (v204). Never live on its own: shipped inside v214 (LIVE 2026-11-14). Owner acceptance U12–U13 OPEN; trimmed gate check (CLASSIC 2D, world 1, desktop and phone: title, menu, the four CONTROLS captures; CONTROLS records no probe data, so its gates read n/a by its row's exemption). Rollback: revert the release commit and bump `CACHE_NAME` / `REV` again.
- Release state (2026-11-12): shell **v204** (UI upgrade release R2: PAUSE on the world kit (`pages/pause.js`), the run ends WIN / FINALE / GAME OVER as their own lazy pages (`pages/endwin.js`, `endlose.js`, `endgeom.js`, `endkit.js`) through the one LOADING plate, PAUSE views on a touch #c on the phone column) is PREPARED as a local release commit on `feature/ui-upgrade` on top of R1 (v203). Never live on its own: shipped inside v214 (LIVE 2026-11-14). Owner acceptance U8–U11 OPEN; release gate check trimmed (CLASSIC 2D, world 1, desktop and phone, the R2 screens only; the full matrix, perf and headed checks deferred to the owner's device checks). Rollback: revert the release commit and bump `CACHE_NAME` / `REV` again.
- Release state (2026-11-12): shell **v203** (UI upgrade release R1: the world kit menus, MENU's seven rows and next-run card, LEVEL SELECT rows, SETTINGS / GRAPHICS, GUIDE with FLOOR, RECORDS (SCORES · STATS · MEDALS), the cards, the player-word renames, logo B in CLASSIC 2D; plan `docs/superpowers/plans/2026-11-10-ui-upgrade-v202.md`, perf record `docs/superpowers/specs/2026-11-10-ui-upgrade-v202-perf.md` "R1 (v203)") is PREPARED as a local release commit on `feature/ui-upgrade`. Never live on its own: shipped inside v214 (LIVE 2026-11-14); `feature/delivery` is squashed as v202 on local `main` and this branch is rebased onto it (2026-11-12). Owner checks U1–U7, U14, U15 (real phone, real controller) are OPEN. Owner decision before the push: boot growth +222 KB raw (+86 KB gzip) vs the delivery branch's c4e7598 (not live v201) against the plan's +60 KB (option: LEVEL SELECT lazy with idle preload, ~58 KB raw; taken in v211, Task 9.14). Rollback: revert the release commit and bump `CACHE_NAME` / `REV` again.
- Release state (2026-11-12): shell **v202** (delivery and loading: the boot graph preloaded and lighter (gen 3, the ATTRACT bot, iso, `?net=local` and the CONTROLS paint load after the title), the two-stage service worker cache, PIXEL and REAL 3D prepared in slices and swapped in when ready, the RENDER row's progress; record `docs/superpowers/specs/2026-11-06-delivery-loading-design.md`) is PREPARED as one local squash commit of `feature/delivery` on `main`. Never live on its own: shipped inside v214 (LIVE 2026-11-14). Rollback: revert the squash commit and bump `CACHE_NAME` / `REV` again.
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
