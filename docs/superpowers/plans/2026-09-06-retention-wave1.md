# Retention Wave 1 Program — INDEX

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four retention items land on the shipped loop without touching the
sim: a combo/chain-blast callout plus a close-call flash (**R2**), a per-room
stopwatch with a persisted best and a MODES relabel of the LEVEL SELECT rail
(**R7**), a colourblind audit plus pause-anywhere verification (**R11**), and a
measured sub-90-second first-visit handoff (**R4**).

**Architecture:** Four sub-plans, strictly ordered. **R2** is a `src/render/fx.js`
diff plus two one-line hooks in each renderer — `feedFx(world, dt)` runs inside
`consumeEvents`, between the existing `syncFx(world)` and the
`world.events.length=0` wipe, so it sees byte-identically the batch `main.js`
already reads non-destructively, in the same frame, with **zero `main.js` diff**
and automatic 2D+3D parity. **R7** adds the wave's one new `nb.*` key
(`nb.times.v1`) and its one new module (`src/app/times.js`), a main-owned
PLAY-only `roomT` accumulator that mirrors `coachT` line for line, an optional
third arg on `drawHudChips` and an optional eighth on `drawOverlay` (both
absent ⇒ byte-identical to today), and a **presentation-only** MODES relabel of
the existing LEVEL SELECT Pact rail — no MODES sub-page, no new `SCREEN`.
**R11** is an audit and a verification pass: a throwaway Node script simulates
protan/deutan/tritan over 85 shipped hexes and writes a report doc, with a hard
budget of **≤ 2 hex swaps** for the whole wave, plus seven new pause-anywhere
pins. **R4** is a headed measurement of the shipped whole, with two dormant fix
candidates that land only on a failure. `step()` is untouched everywhere: every
value in this program is app- or render-layer and none of it reaches the sim.

**Tech Stack:** Pure ES modules, `node --test` / `tests/*.test.mjs`, Canvas 2D
plus vendored three.js r160. Zero npm runtime deps. `src/core` stays DOM-free;
`src/render/` may not import `src/app/` (only `shellview.js` may, for screen
constants).

**Spec:** `docs/superpowers/specs/2026-09-06-retention-wave1-design.md` — its
locked values are binding on all four sub-plans. Where a sub-plan and the spec
disagree, the spec wins; where this INDEX's **Shared interfaces** block and a
sub-plan disagree, this block wins.

**Code map:**
`.superpowers/sdd/2026-09-06-taste-revision/research-retention-feasibility.md`
and `research-retention-audit.md` (file:line evidence for every claim below).

## Global Constraints

Verbatim from the spec (§0, §1, §7), binding on all four sub-plans:

- **Any edit to `src/core/sim.js`** is refused. R2 and R7 are feedback and
  scoreboard layers; report §4 R2 "**Zero `sim.js` edits**", R7 "Low **only if
  it stays a scoreboard framing**".
- **Any scoring change** (combo multipliers, time bonuses) is refused —
  appendix "**Reject** as a scoring change".
- **New `PACT` bits** are refused: `clampPact`'s `(p|0)&15` is full
  (`src/core/pact.js:1,5`) and load-bearing in `isRow`
  (`src/app/highscores.js:33`) and the persisted `p` column.
- **Fail-on-timeout for time attack** is refused — a genuine new LOSE branch in
  the locked sim.
- **Any server, beacon or analytics** is refused. AGENTS.md "single-player";
  `src/net/transport.js:49-51`.
- **Streak banners, "at risk" copy, welcome-back nags** are refused.
- **A new `SCREEN` value** is not forbidden outright, but **Q2 (report §7.2) is
  an open owner question** and wave 1 must not pre-decide it.
- **Widening `PLAQUE`'s `&15`** is refused (`src/app/plaques.js:5,24`, pinned at
  `mask===15` by `tests/plaques.test.mjs:51-56`).
- **Re-hueing any foe or the player to fix a CVD collision** is refused.
  AGENTS.md: separation from the cast is "**structure, never a re-hue**";
  `stationary`'s `#c58aff` is disclosed-and-deliberately-not-gated.
- **The stopwatch is not `world.time`.** `step()` bumps `world.time` at its very
  top (`sim.js:42-43`), **before** the `PAUSE` early return (`sim.js:75-77`);
  `main.js`'s fixed-step loop is ungated on `world.state` (`main.js:548-561`);
  and `loadLevel` never resets `time` (`world.js:44-114`). **Lock: a main-owned
  `roomT` accumulator, PLAY-only, reset per room, mirroring `coachT` line for
  line.** `world.time` is not used by R7 at all.
- **R2's event tap is `consumeEvents`, not `main.js`.** `feedFx(world, dt)` is
  called inside `consumeEvents` (`renderer.js:34-41`,
  `three/wrapper.js:104-115`), between `syncFx(world)` and the
  `world.events.length=0` wipe.
- **`feedFx` returns immediately unless `world.state === "PLAY"`, and it — not
  `updateFx` — owns the decay of `cmbT`, `calT`, `nmT` and `nmCd`.**
  `updateFx` is **not** touched: shake, flash and particles must keep running
  through WIN.
- **Wave 1 adds exactly one new `nb.*` key** (`nb.times.v1`) and exactly one new
  `src/app/*.js` (`src/app/times.js`).
- **Recording is unconditional; display is what the toggle gates.** Every room
  WIN writes a time whether or not TIME ATTACK is on.
- **MODES is a LEVEL SELECT presentation change. There is no MODES sub-page and
  no new `SCREEN` value.** `src/core/pact.js` is **not** touched: `PACT_NAME`
  stays `["LAST","BARE","THIN","SHRINK"]` and `pactLabel`'s `L/B/T/S` letters
  stay.
- **The MODES rail is gated on `showPact`.** The whole rail, TIME chip included,
  appears only after the first FUSE/GRID CLEAR; the pre-unlock LEVEL SELECT
  stays **byte-identical**.
- **`startRun()`'s args are unchanged** — `{level, heat, pact, pace}`. TIME
  ATTACK never reaches `onStart`, never reaches `world`, and therefore never
  reaches `step()`. **Pinned as an absence.**
- **CVD fix budget: ≤ 2 hex swaps total for the whole wave**, and only on pairs
  that are adjacent-or-overlapping in the same view, carry **no** shape / glyph
  / label / silhouette difference, and meet the collision rule. Player-vs-foe,
  foe-vs-foe, `POWER[*].col`, `HEAT_COL`, `PACT_COL` and the TIME chip are
  **excluded by construction, not by judgement**.
- **Zero eligible CVD collisions is a pass**, and is the expected outcome. The
  doc ships either way.
- **Sound is out of scope** for R2 (report §6: "Sound after `src/audio/*`
  lands").
- **R4 measures time-to-first-bomb. It cannot measure the aha, and the plan must
  not claim it does.**
- No comments unless the file already uses explanatory block comments (its
  style). `fx.js`, `scenes.js`, `menudraw.js`, `menuapp.js`, `shellview.js` and
  `main.js` all do; match the compact, no-whitespace-after-key style already in
  the codebase.
- **Never write the banned grid-bomb franchise name into any committed file.**
  `tests/banned-name.test.mjs` is a tree-wide gate over `git ls-files`. Public
  copy says "the genre classic".
- PWA: bump `CACHE_NAME` (`src/pwa/shell.js:1`) and `REV` (`sw.js:3`)
  **together**, `current vN → vN+1`, in **every commit that changes precached
  bytes**. **Read the current value first — never assume.** It is
  `fusegrid-shell-v103` as this INDEX is written; the spec's projected
  v104–v107 are a **floor, not a target**.
- Every plan ships with `npm test` green **and** a headed play-verify —
  AGENTS.md: "Visual 3D feel is not covered by Node."

## File map

| File | R2 | R7 | R11 | R4 |
|---|---|---|---|---|
| `src/render/fx.js` | `comboOf`, `comboLabel`, `nearMissOf`, `feedFx`, `getCallout`, `getNearMiss`, `drawFxOverlay`; `syncFx`/`initFx` zeroing | — | — | — |
| `src/render/renderer.js` | `feedFx` in `consumeEvents`; `drawFxOverlay` in the hud block | `o.time` onto `drawOverlay` + `drawHudChips` | — | — |
| `src/render/three/wrapper.js` | same two seams | same two seams | — | — |
| `src/render/scenes.js` | — | `fmtTime`, `timeLine`, `drawHudChips` 3rd arg, `drawOverlay` 8th arg | — | `COACH_PANEL`/`COACH_TEXT` **only if fix 2 fires** |
| `src/app/times.js` | — | **create** | — | — |
| `src/app/menuapp.js` | — | `timeAttack`, `toggleTimeAttack`, `Digit5`/`Numpad5`, `o.onTimeAttack` | — | — |
| `src/render/menudraw.js` | — | `MODE_NAME`, the 5-chip rail, gloss, head sub, foot, 9th arg | — | — |
| `src/render/shellview.js` | — | `app.timeAttack` as the 9th arg | — | — |
| `src/main.js` | — | `roomT`, `bestPrev`, WIN-edge write, `ro.time`, `onTimeAttack` | — | — |
| `src/core/config.js` / `src/core/entities.js` | — | — | **at most 2 hex values**, and only under the fix budget | — |
| `src/app/intro.js` | — | — | — | `INTRO_DUR` **only if fix 1 fires** |
| `src/app/coach.js` | — | — | — | `COACH_DUR` **only if fix 2 fires** |
| `src/pwa/shell.js` / `sw.js` | bump | `SRC` += `src/app/times.js`, bump | bump **only if a hex lands** | bump **only if a fix lands** |
| `MEMORY.md` | final commit | final commit | final commit | final commit |

Tests: `tests/fx.test.mjs` (**new**, R2) · `tests/times.test.mjs` (**new**, R7) ·
`menudraw.test.mjs`, `menuapp.test.mjs`, `menu-level.test.mjs`, `heat.test.mjs`,
`three.test.mjs`, `pickups.test.mjs` (R7 additions and unmoved-pin checks) ·
`headless.test.mjs` (R11 pause pins) · `items-art.test.mjs` (R11, re-run on any
swap).

Docs: `docs/superpowers/specs/2026-09-06-cvd-audit.md` (**new**, R11) ·
`docs/superpowers/plans/2026-09-06-first-play-verify.md` § Results (R4).

## Shared interfaces

**Every signature below is final. R2/R7/R11/R4 quote these verbatim — if a
sub-plan disagrees with this block, this block wins.**

### FX detectors and feed — `src/render/fx.js` (R2)

```js
export function comboOf(events)             // -> int; 0 unless events holds a {t:"boom"}
export function comboLabel(n)               // -> "" | "DOUBLE" | "TRIPLE" | "QUAD" | "CHAIN ×n"
export function nearMissOf(world, events)   // -> boolean; events defaults to world && world.events
export function feedFx(world, dt)           // PLAY-only; owns cmbT/calT/nmT/nmCd decay
export function getCallout()                // -> string; "" when none is live
export function getNearMiss()               // -> number; fx.nmT, 0 when none is live
export function drawFxOverlay(c)            // overlay/HUD space; callout + close-call border
```

`comboOf(events)` returns `0` unless `events` contains at least one
`{t:"boom"}`; otherwise it returns the number of `{t:"kill"}` entries in
`events`. It reads the array and nothing else — no world, no mutation.

`comboLabel(n)`: `2 → DOUBLE`, `3 → TRIPLE`, `4 → QUAD`, `n >= 5 →
"CHAIN ×" + n`, everything else `→ ""`.

`nearMissOf(world, events)` is true iff **all** of: (1) `world.players[0]`
exists and `p.alive` and `p.iFrames <= 0`; (2) `events` contains **no**
`{t:"hurt"}`; (3) `dmin`, the minimum Chebyshev pixel distance from `(p.x, p.y)`
to the centre of any tile of any live blade —
`d = max(|p.x − (t.tx+0.5)*TILE|, |p.y − (t.ty+0.5)*TILE|)` over
`world.blades[*].tiles[*]` — satisfies `HIT_D < dmin <= NEAR_D`, with
`HIT_D = CFG.TILE*0.5 + CFG.TILE*0.3 = 32` and `NEAR_D = CFG.TILE*1.10 = 44`.

Constants, all sourced: coalescing window `CFG.BLADE_TTL` = **0.34 s**
(`config.js:13`); callout ttl **0.90 s** with `alpha = Math.min(1, calT/0.35)`;
close-call `nmT` **0.18 s**, peak alpha **0.22**, cooldown `nmCd` **0.60 s**;
callout at `x = CFG.COLS*CFG.TILE/2` = **300**, `y = 96`, font
`900 26px ui-monospace,monospace`, `strokeStyle "#0a0d14"`, `lineWidth 5`,
`lineJoin "round"`, `fillStyle "#ffd447"`; close-call is a **6 px inner border**
of the 600×520 board box in `#fff8d8`.

**REDUCE FLASH ⇒ no close-call at all**, checked at *feed* time against the
module-local `flashK` (`getFxOpts().flashK < 1` ⇒ suppressed), so `fx.nmT` is
never even set. **R2 adds no shake** — `feedFx` never writes `fx.shakeT`;
pinned as an absence.

### The fx feed shape — the two call seams (R2)

```js
// renderer.js consumeEvents and three/wrapper.js consumeEvents
syncFx(world);
feedFx(world, dt||CFG.STEP);   // NEW — must sit before the length=0 wipe
for(let i=0;i<world.events.length;i++){ … }
world.events.length=0;
updateFx(dt||CFG.STEP);
```

```js
// renderer.js and wrapper.js, the o.hud===true block
if(o&&o.hud===true) drawHudChips(ctx, world, o&&o.time);
if(o&&o.hud===true) drawFxOverlay(ctx);        // NEW — between the two
if(o&&o.hud===true) drawCoach(ctx, (o&&o.coach)||0);
```

`drawFxOverlay` is **not** folded into `drawFx`, which `renderer.js` calls twice
in a WIN/LOSE frame and which the 3D path never calls at all. Gating the draw on
`o.hud === true` means **ATTRACT never shows a callout** (`main.js:632`,
`ro = {hud:false}`).

### The room clock — `roomT` in `src/main.js` (R7)

| site | today | add |
|---|---|---|
| `main.js:124` | `let coachT = 0;` | `let roomT = 0; let bestPrev = null;` |
| `main.js:164` (`onStart`) | `coachT = 0;` | `roomT = 0; bestPrev = null;` |
| `main.js:220` (`onPauseCmd` RESTART, beside `coachPlanted = false`) | — | `roomT = 0; bestPrev = null;` |
| `main.js:537-538`, after the `noteWorldEdge` persist, **before** `prevSt = world.state` | — | the WIN-edge write and the room-start reset, below |
| `main.js:547` | `if (world.state === "PLAY") coachT += dt;` | `if (world.state === "PLAY") roomT += dt;` |

```js
if (prevSt === "PLAY" && world.state === "WIN") {
  const k = timeKey(world), v = loadTimes();
  bestPrev = bestOf(v, k);                 // captured BEFORE the write
  saveTimes(recordTime(v, k, roomT));
}
if ((prevSt === "WIN" || prevSt === "LOSE") && world.state === "PLAY") {
  roomT = 0; bestPrev = null;              // WIN->next room, LOSE->new run
}
```

`PAUSE → PLAY` is deliberately **not** in that reset list: resuming continues
the room, it does not restart it. `onPauseCmd`'s `QUIT TO MENU` branch is
**not** a reset site either — it sets `prevSt = null` and leaves the shell, the
accumulator only runs inside the `app.screen === SCREEN.GAME` branch, and the
next run always passes through `onStart`, which zeroes both fields.

**Every recorded time includes the fixed `CFG.WIN_DELAY` 1.6 s tail**
(`config.js:5`). It is a constant on every clear, so times stay comparable; it
is **never subtracted**.

### Times store — `src/app/times.js` (R7)

```js
export const TIMES_KEY = "nb.times.v1";
export const TIMES_MAX = 96;
export function timeKey(world)              // pure, no store -> the 5-tuple-minus-seed key
export function clampTimes(raw)             // any input -> {on:0|1, b:{}}; never throws
export function loadTimes(store)            // -> clamped object; missing/corrupt -> {on:0,b:{}}
export function saveTimes(v, store)         // clamps then writes JSON; silent on failure
export function bestOf(v, key)              // -> seconds (tenths/10) or null
export function recordTime(v, key, sec)     // -> a NEW object; writes only when strictly faster
```

**Shape** — `{ on: 0|1, b: { "<key>": <tenths> } }`.

- `timeKey(world)` =
  `` `${world.level|0}:${clampHeat(world.heat)}:${clampPact(world.pact)}:${clampPace(world.pace)+1}` ``
  — the report's 5-tuple minus `seed`. `pace` is shifted `+1` so the segment is
  `0..2` and the whole key matches `/^[1-8]:[0-2]:(?:[0-9]|1[0-5]):[0-2]$/`.
  `timeKey` does **not** clamp `level`; `clampTimes` is the gate that drops an
  out-of-range key.
- Values are **integer tenths of a second, 1..5999** (0.1 s … 599.9 s).
- `clampTimes(raw)`: `on` through the same `bit()` shape `settings.js:22-26`
  uses; `b` keeps only entries whose key matches the regex and whose value is a
  finite integer in `1..5999`; the map is capped at **96** entries — on overflow
  the **first** keys in insertion order are dropped.
- `recordTime(v, key, sec)`: `d = Math.floor(sec*10)` clamped to `1..5999`;
  writes only when there is no prior or `d < prior`. **Floor, not round.**

### Display — `src/render/scenes.js` (R7)

```js
export function fmtTime(sec)                                        // pure; always <= 6 chars
export function timeLine(world, tm)                                 // pure; the WIN copy
export function drawHudChips(c, world, tm)                          // 3rd arg OPTIONAL
export function drawOverlay(c, world, w, h, cx, cy, ui, tm)         // 8th arg OPTIONAL
```

`tm = {on, t, best}`, assembled in `main.js`'s GAME `ro` branch
(`main.js:632-646`) as `{on: !!app.timeAttack, t: roomT, best: bestPrev}` and
passed down as `o.time`.

`fmtTime(sec)`: clamp to `[0, 599.9]`; `d = floor(s*10)`; return
`` `${floor(d/600)}:${pad2(floor(d/10)%60)}.${d%10}` ``.

`timeLine(world, tm)` is exactly:

```js
"ROOM " + (world.level | 0) + " · " + fmtTime(tm.t) + " · " +
(tm.best == null || tm.t < tm.best ? "NEW BEST" : "BEST " + fmtTime(tm.best))
```

Both forms are locked copy: `ROOM 3 · 0:41.2 · BEST 0:38.9` and
`ROOM 3 · 0:41.2 · NEW BEST`.

**HUD chip.** `tm` absent or `tm.on` falsy ⇒ **byte-identical to today**.
`tm.on` true ⇒ the ENEMIES chip narrows from `chip(386, 94, …)` to
`chip(386, 64, …)` (ends at 450) and a new
`chip(458, 72, "TIME", fmtTime(tm.t), null, null)` is painted, ending at **530**
against the right-aligned score column's left reach of **541** at six digits.

**WIN overlay.** `tm` absent or `tm.on` falsy ⇒ today's three lines exactly.
`tm.on` true **and** `world.state === "WIN"` ⇒ one extra `sub()` line at
`dy 44` and the cue line moves from `dy 44` to `dy 68`. **LOSE is unchanged.**

### MODES — `src/render/menudraw.js` + `src/app/menuapp.js` (R7)

```js
// menudraw.js — a RENDER-SIDE table, the PLAQUE_NAME duplication precedent
const MODE_NAME = ["IRON", "BARE", "THIN", "SHRINK"];
export function drawLevelSelect(c, sel, L, t, heat, pact, unlocked, pace, timeAttack)

// menuapp.js
toggleTimeAttack()   // the togglePactBit shape verbatim; LEVEL + pactUnlocked only
// app field: timeAttack (boolean, seeded from loadTimes().on)
// opt: o.onTimeAttack(on)   — the o.onPaceChange shape
```

| item | today | locked |
|---|---|---|
| chip width / gap | `pw 70`, `pg 8`, 4 chips = 304 | `pw 64`, `pg 6` for chips 1–4, then a **16 px** double gap, then chip 5 = **354** (inner width `iw` is 368) |
| labels | `` `${i+1} ${PACT_NAME[i]}` `` | `` `${i+1} ${MODE_NAME[i]}` `` |
| chip 5 | — | `5 TIME`, colour **`#ff8a3c`** |
| gloss | — | one 9 px MUTED centred line at `py + 30`: `5 TIME ATTACK · stopwatch + per-room best` |
| head subtitle (unlocked) | `ROOM + HEAT + PACE + PACT` | `ROOM + HEAT + PACE + MODES` |
| foot (unlocked) | `ENTER START · ←/→ ROOM · ↑/↓ HEAT · [ ] PACE · 1–4 PACT · ESC` | `ENTER START · ←/→ ROOM · ↑/↓ HEAT · [ ] PACE · 1–5 MODES · ESC` |
| locked state | — | **byte-identical**, head/foot/rail all unchanged |

`MODE_NAME[0]` is `IRON`, a **display** name for `PACT.LAST` (`pact.js:1`,
`applyPact` sets `lives = 1`). The fifth chip must not read as a fifth Pact bit:
the **16 px double gap** and a colour **outside `PACT_COL`**
(`["#ff5d73","#7385ad","#37f0d0","#ffd447"]`) are the two devices that enforce
it. `#ff8a3c` is already in the palette as FLAME's `col` (`entities.js:8`).

### CVD audit script (R11)

Filename **`cvd-audit.mjs`**, written into the executing session's own
scratchpad directory (the absolute path given in that session's system prompt;
if none is provided, `/tmp/fusegrid-cvd/`). It is **throwaway and never
committed** — no new file lands in `src/` or `tests/` for the audit. Report
target: `docs/superpowers/specs/2026-09-06-cvd-audit.md`.

`labOf` and `dE` are lifted **verbatim** from `tests/items-art.test.mjs:55-72`
and cited by line in the audit doc, so the R11 numbers and the shipped MAKO gate
can never fork. Collision rule: `dE(a, b) >= 14` in true colour **but**
`dE(sim(a), sim(b)) < 14` for at least one of protan / deutan / tritan. The
threshold **14** is the floor already shipped at `items-art.test.mjs:755`.

## Execution order

**R2 → R7 → R11 → R4, strictly sequential.**

1. `docs/superpowers/plans/2026-09-06-combo-callouts.md` — **R2**, 3 tasks.
   Its whole diff is `fx.js` plus two one-line hooks per renderer. It touches
   none of `scenes.js`, `menudraw.js`, `sprites.js`, `src/audio/*`, and none of
   `tests/coach.test.mjs`, `tests/menudraw.test.mjs`, `tests/three.test.mjs`,
   **which are dirty in `git status` right now**. Cheapest high-value item,
   smallest collision surface.
2. `docs/superpowers/plans/2026-09-06-stopwatch-modes.md` — **R7**, 4 tasks.
   The only wave-1 item that touches `scenes.js`, `menudraw.js`, `menuapp.js`
   and `main.js`, and the only one that adds a key and a module. It goes after
   R2's small diff has landed so a conflict has one author, not two.
3. `docs/superpowers/plans/2026-09-06-audits.md` — **R11**, 2 tasks.
   **After R7, not before.** The audit set includes the TIME chip's `#ff8a3c`
   (R7 §MODES). Auditing before R7 would audit a palette that is about to change
   and force a second pass. The pause pins are order-independent.
4. `docs/superpowers/plans/2026-09-06-first-play-verify.md` — **R4**, 2 tasks.
   It measures the shipped whole. Running it before R2/R7 land would measure a
   build nobody ships, and any R4 fix (INTRO/coach timing) would invalidate an
   earlier number.

## Program checklist

- [ ] **R2.1** `comboOf` / `comboLabel` / `nearMissOf` in `fx.js` + `tests/fx.test.mjs` (pins 1–3)
- [ ] **R2.2** `feedFx` accumulator + `syncFx`/`initFx` zeroing + both `consumeEvents` seams (pins 4, 5, 6, 8)
- [ ] **R2.3** `drawFxOverlay` + both hud-block seams (pin 7) + headed 2D/3D chain-of-≥3 and REDUCE FLASH pass
- [ ] **R7.1** `src/app/times.js` + `tests/times.test.mjs` + the `SRC` entry (pins 1–4)
- [ ] **R7.2** `roomT` / `bestPrev` / WIN-edge write / `ro.time` in `main.js` (+ the roomT-vs-`world.time` and bestPrev-ordering pins)
- [ ] **R7.3** `fmtTime` / `timeLine` / `drawHudChips` 3rd arg / `drawOverlay` 8th arg + both renderer seams (pins 5–8)
- [ ] **R7.4** MODES rail, `MODE_NAME`, `Digit5`, `toggleTimeAttack`, `shellview` 9th arg (pins 9–10) + headed HUD-row and both-plate-sizes pass
- [ ] **R11.1** CVD audit script, the 85-colour table, `2026-09-06-cvd-audit.md`, and the ≤2-swap decision
- [ ] **R11.2** Seven pause-anywhere pins in `tests/headless.test.mjs`
- [ ] **R4.1** Site-data wipe, Run A / Run B recordings, `?debug=1` cross-check, the Results table
- [ ] **R4.2** Verdict; the two dormant fixes if and only if the target missed

## ABI ledger

Every pin this program moves, and **which single plan owns it**. No site below
has two owners.

| Site | Today | New | Owner |
|---|---|---|---|
| `src/render/fx.js` exports | `setFxOpts getFxOpts initFx getShake getFlash getFx syncFx onEvent updateFx drawFx` | **+** `comboOf comboLabel nearMissOf feedFx getCallout getNearMiss drawFxOverlay` | **R2** |
| `renderer.js` / `wrapper.js` `consumeEvents` | `syncFx` → loop → `length=0` → `updateFx` | **+** `feedFx(world, dt||CFG.STEP)` after `syncFx` | **R2** |
| `renderer.js` / `wrapper.js` hud block, the `drawFxOverlay` line | chips, coach | **+** `drawFxOverlay(ctx)` between them | **R2** |
| `fx.js` `syncFx` / `initFx` | wipe `parts` (and shake/flash) | **+** zero `cmbN cmbT calS calT nmT nmCd`, emitting nothing | **R2** |
| `tests/fx.test.mjs` | — | **new file**, **8** pins | **R2** |
| `scenes.js drawHudChips(c, world)` | 2 args | `(c, world, tm)` — 3rd optional, absent ⇒ byte-identical | **R7** |
| ENEMIES chip | `chip(386, 94, …)` | `94` when `!tm.on`; `64` when `tm.on`, **+** `chip(458, 72, "TIME", fmtTime(tm.t))` | **R7** |
| `scenes.js drawOverlay(c,world,w,h,cx,cy,ui)` | 7 args | `(…, ui, tm)` — 8th optional; WIN cue `dy 44 → 68` only when `tm.on` | **R7** |
| `scenes.js` exports | `drawLogo winHeadline overlayCue runStamp copyPayload PAUSE_ROWS PAUSE_ROW_H overlayBox pauseHit drawOverlay updateHud makeHud drawHudChips drawCoach` | **+** `fmtTime timeLine`. `runStamp` / `copyPayload` **unchanged** | **R7** |
| `renderer.js` / `wrapper.js`, the `drawOverlay` + `drawHudChips` **arg lists** | `drawOverlay(…, o&&o.pause)`, `drawHudChips(ctx, world)` | `drawOverlay(…, o&&o.pause, o&&o.time)`, `drawHudChips(ctx, world, o&&o.time)` | **R7** |
| `src/app/times.js` | — | **new module**: `TIMES_KEY TIMES_MAX timeKey clampTimes loadTimes saveTimes bestOf recordTime` | **R7** |
| `src/pwa/shell.js` `SRC` | 60 entries | **+** `"src/app/times.js"` — **mandatory**: `tests/pwa.test.mjs:98-103` walks `src/` and requires every `.js` in `PRECACHE` | **R7** |
| `menuapp.js SCREEN` | 12 values, `GUIDE: 11` | **unchanged** — no MODES screen | **R7** |
| `menuapp.js key()` | `Digit1..4` → `togglePactBit` | **+** `Digit5` / `Numpad5` → `toggleTimeAttack()` | **R7** |
| `createMenuApp` app object | `… pace pactUnlocked` | **+** `timeAttack` field, `toggleTimeAttack()`, `o.onTimeAttack` | **R7** |
| `menuapp.js startRun()` args | `{level, heat, pact, pace}` | **unchanged** — pinned as an absence | **R7** |
| `menudraw.drawLevelSelect(…, pace)` | 8 args | **+** 9th `timeAttack` | **R7** |
| LEVEL SELECT modes rail | `pw 70 / pg 8`, 4 chips (304), `PACT_NAME` labels | `pw 64 / pg 6` ×4, 16 px gap, 5th chip (354); `MODE_NAME` labels; `5 TIME` in `#ff8a3c`; gloss at `py+30` | **R7** |
| LEVEL SELECT head sub / foot (unlocked) | `…+ PACT` / `… 1–4 PACT · ESC` | `…+ MODES` / `… 1–5 MODES · ESC` | **R7** |
| LEVEL SELECT **locked** state | — | **byte-identical**; `menudraw.test.mjs:296-305` calls `drawLevelSelect(c,3,L,1,1)` — unmoved | **R7** |
| `shellview.js:97-106` | 8 args | **+** `app.timeAttack` | **R7** |
| `src/main.js` | `coachT` only | **+** `roomT`, `bestPrev`; WIN-edge write at `:537`; `roomT += dt` at `:547`; `ro.time` in the GAME `ro`; `times.js` imports; `onTimeAttack` wiring | **R7** |
| `tests/times.test.mjs` | — | **new file**, 10 pins + 2 self-review pins | **R7** |
| `heat.test.mjs:326-334` (WIN branch) | `texts.some(s => s.indexOf("CLEARED") >= 0)` | **unmoved** — 8th arg defaults `undefined` ⇒ today's layout | **R7** |
| `three.test.mjs:1408-1420`, `pickups.test.mjs:465-478` | `drawHudChips(rec, world)` | **unmoved** — 3rd arg `undefined` ⇒ today's layout | **R7** |
| `docs/…/2026-09-06-cvd-audit.md` | — | **new doc**: matrices, 85-colour table, verdict, swaps (0–2) | **R11** |
| `config.js BIOMES` / `entities.js` colours | as shipped | **at most 2 hex values**, and only under the fix budget | **R11** |
| `tests/headless.test.mjs` pause block | `:325-347` | **+** 7 pins | **R11** |
| `src/app/intro.js:1` `INTRO_DUR` | `5.0` | lowered, floor **3.5** — **only if fix 1 fires** | **R4** |
| `src/app/coach.js:4` `COACH_DUR` / `scenes.js:255-257` panel | `3` / `COACH_PANEL`,`COACH_TEXT` | `COACH_DUR` ceiling **4.0**, or panel contrast — **only if fix 2 fires** | **R4** |
| `src/pwa/shell.js:1` `CACHE_NAME` + `sw.js:3` `REV` | `fusegrid-shell-v103` **at INDEX time — read it, do not assume** | `current vN → vN+1` in every precache-touching commit, both files together | **each** |
| `MEMORY.md` | — | one dated entry per plan, in that plan's final commit | **each** |

### Kept pins — do not touch

- `updateFx` (`fx.js:89-101`) — shake, flash and particles must keep running
  through WIN; the confetti falls on the CLEARED veil. Only the R2 timers freeze.
- `fx.js:15-19` `flashK` / `shakeK` — `initFx()` must **not** reset them.
- `tests/plaques.test.mjs:51-56` — `PLAQUE` mask `=== 15` round-trip.
- `tests/menu-level.test.mjs:101-116` — pins only `Digit1..4 → PACT` bits;
  `Digit5` returns `false` outside LEVEL exactly as `Digit1..4` do today.
- `tests/menuapp.test.mjs` `SCREEN` blocks — `GUIDE: 11` stays the last value.
- `src/core/pact.js` in full — `PACT_NAME`, `PACT_COL`, `pactLabel`,
  `clampPact`. The HIGH SCORES `p` column depends on all of it.
- `tests/items-art.test.mjs:733` (the 56-swatch value-AND-hue gate) and `:755` /
  `:760` (both VOID ΔE floors) — exactly what a well-meant CVD swap breaks. Any
  swap re-runs this file.
- `heat.js:23` — room 1's `walker, walker, stationary` roster. The frozen-easy
  on-ramp is the thing that works; R4 refuses to touch it.

## Resolved ambiguities

1. **`nearMissOf` arity: `nearMissOf(world, events)`, with `events` defaulting
   to `world && world.events`.** The controller brief names the two-arg form;
   spec §2.3's heading names `nearMissOf(world)` while its own condition 2 reads
   `world.events`. The defaulted two-arg form satisfies both call styles
   byte-identically, mirrors `comboOf(events)`, and lets `feedFx` hand **the
   same array** to both detectors in one frame — which is the property the
   "byte-identically the same batch" lock in spec §1.2 actually rests on. Pinned
   in `tests/fx.test.mjs` in both call forms.
2. **`feedFx(world, dt||CFG.STEP)` at both seams, not `feedFx(world, dt)`.**
   Spec §2.4's wiring block writes a bare `dt`, but `consumeEvents(world, dt,
   playSfx)` permits `dt === undefined` — which is exactly why the adjacent
   shipped line reads `updateFx(dt||CFG.STEP)`. A bare `undefined` would make
   `fx.calT -= undefined` produce `NaN` and silently kill every R2 timer for the
   life of the renderer. The guard goes at the call site so the seam reads with
   one convention, matching the line directly beneath it.
3. **The audit script lands in the session scratchpad, not `tools/` and not
   `tests/`.** The brief asks which; spec §4.1 answers it — "a throwaway Node
   script in the session scratchpad — **no new file lands in `src/` or `tests/`
   for the audit**". `tests/*.test.mjs` all run in the `node --test` battery and
   a CVD simulation has no assertion to make (it produces a report), so as a
   test file it is either a permanent no-op or a permanent flake surface.
   `tools/` is committed and is *not* walked by `pwa.test.mjs`'s `src/` walk, so
   it would be permissible — but the spec picked scratchpad and the spec is
   binding. The **doc** is the deliverable; the script is scaffolding.
4. **The R4 report file is this program's own plan, not a new doc.** Spec §5.1:
   "the number is logged in the plan and in `MEMORY.md`". Rather than invent an
   undeclared spec doc, the numbers land in
   `docs/superpowers/plans/2026-09-06-first-play-verify.md` § Results (a table
   the plan ships pre-shaped, filled in and committed by R4 Task 1) plus one
   dated `MEMORY.md` line.
5. **Commits are per task, not four for the wave.** Spec §Scope says "Four
   plans, four commits"; the binding house plan format gives every task its own
   FAIL → implement → PASS → commit cycle, and every recent plan in
   `docs/superpowers/plans/` does exactly that. Read the spec's line as *four
   shipped items*, one per plan. Consequence: **11 commits**, of which 7 always
   touch precached bytes and 2 more do so conditionally.
6. **PWA bump cadence is per commit, and the spec's v104–v107 are a floor.**
   AGENTS.md ties the bump to "the file list or shipped bytes", which changes at
   every one of those 7 commits. Test-only and docs-only commits do **not** bump
   (R11.2, R4.1). **Read `src/pwa/shell.js:1` at commit time** — it is
   `fusegrid-shell-v103` today and other sessions bump the same two lines.
7. **`getCallout()` returns a string, not an object.** Spec pins §2.5.6 and
   §2.5.8 both read "`getCallout()` is still empty" / "leaves `getCallout()`
   empty", which only type-checks against a string. `""` is the no-callout
   value; `getNearMiss()` stays a number (`fx.nmT`).
8. **R7 must locate its `renderer.js` / `wrapper.js` edits by string, never by
   line number.** R2 lands first and inserts two lines into both files, so the
   spec's `:78` / `:84` / `:154-155` citations are stale by the time R7 runs.
   R7 locates `drawOverlay(ctx, world, B.w` and `drawHudChips(ctx, world)` /
   `drawHudChips(ovCtx,world)` by string. The same rule applies to
   `tests/three.test.mjs` and `tests/menudraw.test.mjs`, which are **dirty in
   `git status`** as this program starts — re-read both before editing.
9. **R4's fix candidate 2 and R7 both touch `scenes.js`.** No conflict in
   practice — R4 runs last, and its coach-panel edit is `COACH_PANEL` /
   `COACH_TEXT` only, which R7 never reads. Noted so the ledger's single-owner
   claim is checkable rather than assumed.

## Open owner questions this program does not answer

Deliberately: **Q1** (continue-credit, report §7.1 — blocks nothing here) and
**Q2** (new-`SCREEN` policy, §7.2 — the MODES relabel routes around it rather
than settling it).
