# Fusegrid — retention wave 1, binding design (2026-09-06)

Binding spec for the four wave-1 items of
`docs/superpowers/specs/2026-09-06-retention-report.md` §6: **R2** (combo /
chain-blast callout + close-call flash), **R7** (time-attack stopwatch + MODES
packaging, scoreboard-only), **R11** (colourblind audit + pause-anywhere
verification), **R4** (first-visit Play Now + sub-90s handoff verification).

Every value below is either quoted from a `file:line` in this tree or is a
design pick stated as one. There are no TBDs. Public copy never names the
private reference game — "the genre classic" throughout
(`tests/banned-name.test.mjs` is a tree-wide gate over `git ls-files`).

**Scope.** Four plans, four commits, in the order of §7. Wave 1 adds **one**
new `nb.*` key (`nb.times.v1`) and **one** new `src/app/*.js`
(`src/app/times.js`), matching the report's own wave-1 budget
(retention-report §6, "Wave 1 adds one key").

---

## 0. Refusals — restated as hard gates, not preferences

| Refused | Why, sourced |
|---|---|
| Any edit to `src/core/sim.js` | R2 and R7 are feedback and scoreboard layers; report §4 R2 "**Zero `sim.js` edits**", R7 "Low **only if it stays a scoreboard framing**" |
| Any scoring change (combo multipliers, time bonuses) | report §4 R2: industry #13 is "the weakest evidence grade on the list against a `step()`-touching cost"; appendix "**Reject** as a scoring change" |
| New `PACT` bits | `clampPact`'s `(p\|0)&15` is full (`src/core/pact.js:1,5`) and load-bearing in `isRow` (`src/app/highscores.js:33`) and the persisted `p` column |
| Fail-on-timeout for time attack | a genuine new LOSE branch in the locked sim; feasibility #7 prices it at M 1.5–2d and it needs a determinism-replay test |
| Any server, beacon or analytics | AGENTS.md "single-player"; `src/net/transport.js:49-51`; report §5F |
| Streak banners, "at risk" copy, welcome-back nags | report §3 "What we refuse"; §4 R12 declines even the MENU banner |
| A new `SCREEN` value | not forbidden outright, but **Q2 (report §7.2) is an open owner question** and wave 1 must not pre-decide it — see §3.4 |
| Widening `PLAQUE`'s `&15` | `src/app/plaques.js:5,24`, pinned at `mask===15` by `tests/plaques.test.mjs:51-56` |
| Re-hueing any foe or the player to fix a CVD collision | AGENTS.md: separation from the cast is "**structure, never a re-hue**"; `stationary`'s `#c58aff` is disclosed-and-deliberately-not-gated |

---

## 1. Corrections to the brief — three places where the code forced a different lock

These are stated up front because a reviewer will check the brief's wording
against the spec and must see the deviation as a decision, not a slip.

### 1.1 The stopwatch is **not** `world.time`

The brief (and report §4 R7 "Reuses: `world.time`") says the stopwatch reads
`world.time`. It cannot:

- `step()` bumps `world.time` at its very top (`src/core/sim.js:42-43`),
  **before** the `PAUSE` early return (`sim.js:75-77`);
- `src/main.js`'s fixed-step loop is ungated on `world.state` — it steps
  whenever the shell is GAME (`main.js:548-561`), so a paused run keeps
  accumulating `world.time`;
- `loadLevel` never resets `time` (`src/core/world.js:44-114` writes `events`,
  grid, entities — not `time`), so it is a run clock, not a room clock.

This is the exact trap `coachT` exists to dodge — main.js:120-123 says so in
its own comment, and commit `33668f7` ("Fix … the coach/pause time desync") is
the precedent. **Lock: a main-owned `roomT` accumulator, PLAY-only, reset per
room, mirroring `coachT` line for line.** The HUD chip, the WIN overlay line
and the persisted best all read `roomT`; `world.time` is not used by R7 at all.

### 1.2 R2's event tap is `consumeEvents`, not `main.js`

The brief asks for main.js's existing non-destructive read (`main.js:569-575`).
That tap exists for one reason: the **coach persist is app-layer** and must run
before the renderer drains. R2 persists nothing, and AGENTS.md puts render-layer
fx in `src/render/fx.js` and requires main's seams to stay **out** of `main.js`.

**Lock: `feedFx(world, dt)` is called inside `consumeEvents`**
(`src/render/renderer.js:34-41`, `src/render/three/wrapper.js:104-115`),
between the existing `syncFx(world)` and the `world.events.length=0` wipe. It
sees byte-identically the same batch main's tap sees, in the same frame, with
zero `main.js` diff and automatic 2D+3D parity.

Cost of the alternative, for the record: one `ro.combo` field in main's `ro`
object (`main.js:632-646`), two more main.js lines, and the fx singleton still
has to hold the timers — strictly more surface for the same data.

### 1.3 The close-call envelope is measured against the real hit test

"Player's own tile is not a blast tile" is **not** "survived". `applyBlastHits`
hits via `aabb(w.grid, t.tx, t.ty, p.x, p.y, CFG.TILE*0.3)`
(`src/core/sim.js:339-349`), so the hit envelope reaches `CFG.TILE*0.3` = 12 px
**past** the tile rect. A player 4 px outside their tile with a blade next door
is hit while their own tile is clean — the flash would fire on the frame they
take damage. **Lock: a Chebyshev annulus with both bounds derived from that
call** (§2.3).

---

## 2. R2 — combo / chain-blast callout + close-call flash

**Files:** `src/render/fx.js` (all new logic), one line each in
`src/render/renderer.js` and `src/render/three/wrapper.js`, one new
`tests/fx.test.mjs`. **No `src/core`, no `src/app`, no `main.js`, no
`scenes.js`, no `menudraw.js`** — which is what keeps R2 clear of the three
test files dirty in `git status` (report §6, "Chosen because none of it touches
the files under live edit").

### 2.1 How `detonate()` batches kills — the fact the definition rests on

`detonate` (`sim.js:353-379`) is synchronous and recursive: per bomb it pushes
`{t:"brick"}` for each broken brick (`sim.js:373` → `breakBrick`, `:387`), then
every `{t:"kill"}` from `applyBlastHits` (`:374` → `:333-351`, `killEnemy`
emits at `:412`), then one `{t:"boom"}` (`:375`), then recurses into every live
bomb whose tile the blast covers (`:376-378`). **One chain therefore lands
entirely inside one `world.events` batch**, as `[kills…][boom]` groups, one
group per bomb in the chain.

Two facts constrain the definition:

1. Kills also arrive with **no** boom: `updateBombs` re-runs `applyBlastHits`
   for every live blade every tick (`sim.js:257-259`), so an enemy walking into
   a lingering blade is killed on a later tick, alone.
2. A drained batch can span **up to 6 sim ticks** — `main.js:548-561`'s
   accumulator runs `while (acc >= CFG.STEP)` with a `steps > 6` cap. At 60 Hz
   vsync it is 1, occasionally 2.

### 2.2 Combo — definition, tiers, draw

**`comboOf(events)` — pure, exported, pinned.**

> Returns `0` unless `events` contains at least one `{t:"boom"}`; otherwise
> returns the number of `{t:"kill"}` entries in `events`.

The boom gate is the discriminator for "from one detonation chain": a batch
with a boom contains a detonation; a boom-free batch is blade attrition and
scores no combo. The function reads the array and nothing else — no world, no
mutation.

**Coalescing window = `CFG.BLADE_TTL` = 0.34 s** (`src/core/config.js:13`).
Sourced, and it means something: kills that land while the same blast is still
on screen are one moment. It cannot over-merge unrelated plants because
`CFG.FUSE` is 2.5 s (`config.js:4`), 7.4× the window.

**Accumulator** (fx singleton, `fx.cmbN` / `fx.cmbT`). **`feedFx` owns the decay
of every R2 timer, and no-ops entirely unless `world.state === "PLAY"`** — see
§2.6, this is not a detail:

```
function feedFx(world, dt) {
  if (!world || world.state !== "PLAY") return;   // PAUSE/WIN/LOSE freeze R2
  const n = comboOf(world.events);
  if (n > 0) { fx.cmbN += n; fx.cmbT = CFG.BLADE_TTL; }
  if (fx.cmbT > 0 && (fx.cmbT -= dt) <= 0) {      // group closes -> callout
    if (fx.cmbN >= 2) { fx.calS = comboLabel(fx.cmbN); fx.calT = 0.90; }
    fx.cmbN = 0; fx.cmbT = 0;
  }
  fx.calT = Math.max(0, fx.calT - dt);
  fx.nmT  = Math.max(0, fx.nmT  - dt);
  fx.nmCd = Math.max(0, fx.nmCd - dt);
  … near-miss feed (§2.3) …
}
```

`updateFx` (`fx.js:89-101`) is **not** touched: shake, flash and particles must
keep running through WIN — the confetti falls on the CLEARED veil (`fx.js:63`,
`renderer.js:79`) — and only the R2 timers freeze.

**Tiers and copy** — `comboLabel(n)`, pure, exported, pinned:

| n | label |
|---|---|
| 2 | `DOUBLE` |
| 3 | `TRIPLE` |
| 4 | `QUAD` |
| ≥5 | `CHAIN ×` + n (e.g. `CHAIN ×7`) |

`n <= 1` emits nothing (`comboLabel` returns `""`, and the accumulator never
calls it below 2).

**Draw** — `drawFxOverlay(c)` in `fx.js`, overlay/HUD space (the same space
`drawHudChips` and `drawCoach` use, so 2D and REAL 3D are identical):

- position: `x = CFG.COLS*CFG.TILE/2` = **300**, `y = **96**` — clear of the
  HUD chip row, which ends at `y=40` (`scenes.js:204`).
- font `900 26px ui-monospace,monospace`, `textAlign "center"`,
  `textBaseline "middle"`, `strokeStyle "#0a0d14"`, `lineWidth 5`,
  `lineJoin "round"`, `fillStyle "#ffd447"` — the `drawOverlay` head recipe
  (`scenes.js:98-105`) at a smaller size.
- ttl **0.90 s**: alpha `1` for the first 0.55 s, then linear to 0 over the
  last **0.35 s** (`alpha = Math.min(1, calT/0.35)`).
- **no blink, no scale-pop, no colour cycling** — a static label that fades. It
  therefore needs no REDUCE FLASH gate: there is nothing to flash.
- a new callout replaces the current one; callouts never stack.

**Shake: R2 adds none.** `feedFx` never writes `fx.shakeT`. The existing per
event shake already scales with a combo — every kill adds `0.08` and every boom
`0.22` (`fx.js:46-48`), all routed through `shakeK`, which SCREEN SHAKE = OFF
sets to `0` (`main.js:189`). A triple already shakes 3× as hard as a single;
adding more is the over-juicing report §4 R2 names as the risk. **Pinned as an
absence** (`tests/fx.test.mjs`).

### 2.3 Close-call — definition, flash, gates

Evaluated **only on frames whose drained batch contains at least one
`{t:"boom"}`** — that is "the frame the blast was born", it reuses the batch
read `comboOf` already does, and it removes a threshold constant. (With the ≤6
step accumulator the geometry read can land a tick or two after ignition;
normally it is the same tick at 60 Hz.)

**`nearMissOf(world)` — pure, exported, pinned.** True iff **all** of:

1. `world.players[0]` exists and `p.alive` and `p.iFrames <= 0`;
2. `world.events` contains **no** `{t:"hurt"}` — a shielded hit emits `hurt`
   and only then sets `iFrames` (`sim.js:344-348`), so the same frame needs the
   event check as well as the `iFrames` check;
3. `dmin`, the minimum Chebyshev pixel distance from `(p.x, p.y)` to the centre
   of any tile of any live blade —
   `d = max(|p.x − (t.tx+0.5)*TILE|, |p.y − (t.ty+0.5)*TILE|)` over
   `world.blades[*].tiles[*]` — satisfies

   `HIT_D < dmin <= NEAR_D`, with
   **`HIT_D = CFG.TILE*0.5 + CFG.TILE*0.3 = 32 px`** (the tile half-extent plus
   the player half-extent that `sim.js:342`'s `aabb` call actually tests) and
   **`NEAR_D = CFG.TILE*1.10 = 44 px`** (design pick: an aligned adjacent tile
   is exactly 40 px, a half-tile-diagonal offset is 44.7 px and does not count —
   so the flash means "the arm stopped one tile short of you", not "a blast
   happened somewhere").

Taking the **minimum over all blades** is what stops a player standing inside
one blast from being congratulated for a second one next door.

**Flash treatment** — deliberately *not* the existing `fx.flashT` full-screen
wash (`fx.js:46`, drawn at `renderer.js:69-74`):

- `fx.nmT = **0.18 s**`, linear decay;
- drawn in `drawFxOverlay` as a **6 px inner border** of the board box
  (`CFG.COLS*CFG.TILE` × `CFG.ROWS*CFG.TILE` = 600×520), `fillStyle "#fff8d8"`,
  `globalAlpha = 0.22 * (nmT/0.18)`, peak **0.22**;
- cooldown `fx.nmCd = **0.60 s**` so a wall of blades cannot strobe.

**Gates:**

- **REDUCE FLASH ⇒ no flash at all.** `main.js:189` maps `flx` to
  `flashK: 0.25` (damped, *not* zero). For a brand-new light source that is not
  good enough, so the close-call is **suppressed entirely** when
  `getFxOpts().flashK < 1` — checked at *feed* time, so `fx.nmT` is never even
  set. One read of state fx.js already owns; no new plumbing, no new setting.
- **SCREEN SHAKE** is untouched because R2 adds no shake (§2.2).

### 2.4 Wiring

```
// renderer.js:34-41 and wrapper.js:104-115, inside consumeEvents
syncFx(world);
feedFx(world, dt);          // NEW — must sit before the length=0 wipe
for (…) onEvent(…)
world.events.length = 0;
updateFx(dt || CFG.STEP);
```

```
// renderer.js:84-88 and wrapper.js:154-155, the o.hud===true block
if (o && o.hud === true) drawHudChips(ctx, world, o && o.time);
if (o && o.hud === true) drawFxOverlay(ctx);      // NEW — between the two
if (o && o.hud === true) drawCoach(ctx, (o && o.coach) || 0);
```

`drawFxOverlay` is **not** folded into `drawFx`, which `renderer.js` calls
twice in a WIN/LOSE frame (`:66` and `:79`) and which the 3D path never calls
at all (wrapper feeds `getFx()` to three particles instead).

Gating the draw on `o.hud === true` means **ATTRACT never shows a callout**
(`main.js:632`, `ro = {hud:false}`) — the demo bot's chains stay silent, which
is what attract is for.

### 2.6 R2 must freeze outside PLAY — the same trap as §1.1

`renderer.render(...)` runs **every** frame regardless of `world.state`
(`main.js:649`), so `consumeEvents` → `feedFx` fires on PAUSE, WIN and LOSE
frames too. Left ungated, a player who pauses mid-chain has the group close on
a paused clock and the callout paint **on top of the PAUSED list** —
`drawOverlay` paints at `renderer.js:78` and the hud block, `drawFxOverlay`
included, at `:84-88`, so a `y=96` label lands over the veil. Same for the WIN
overlay.

**Lock: `feedFx` returns immediately unless `world.state === "PLAY"`, and it —
not `updateFx` — owns the decay of `cmbT`, `calT`, `nmT` and `nmCd`** (§2.2).
That is `main.js:547`'s `if (world.state === "PLAY") coachT += dt` applied to
the fx layer, and it matches how main already gates the coach alpha
(`main.js:638-643`: `world.state === "PLAY" && coachOpen(...)`). A group open
when the player pauses stays open, at the same remaining time, and resolves
when play resumes.

**`syncFx` must clear the new state.** `syncFx` retags on `seed:level`
(`fx.js:37-40`) and already wipes particles; it now also zeroes `cmbN/cmbT/
calT/nmT/nmCd` **without emitting** the open group, so nothing leaks across the
attract ⇄ live world boundary or a room change. `initFx` zeroes the same
fields. Pinned.

### 2.5 Pins — `tests/fx.test.mjs` (new file)

1. `comboOf` purity: deep-frozen `events` array in, same value out, no throw;
   `comboOf` of a boom-free batch with 3 kills === `0`; with a boom === `3`.
2. `comboLabel`: 1→`""`, 2→`DOUBLE`, 3→`TRIPLE`, 4→`QUAD`, 5→`CHAIN ×5`,
   11→`CHAIN ×11`.
3. `nearMissOf` purity over a hand-built world (`players`, `blades`, `events`):
   `dmin === 32` → false (that is a hit), `dmin === 40` → true,
   `dmin === 48` → false, `iFrames > 0` → false, a `{t:"hurt"}` in the batch →
   false, a second blade at `dmin = 20` → false.
4. REDUCE FLASH gate: `setFxOpts({flashK:0.25})`, feed a near-miss frame,
   `getNearMiss() === 0`; restore `flashK:1`, feed again, `> 0`.
5. No-shake pin: feed a 5-kill boom batch, `getShake()` is unchanged from what
   the plain `onEvent` path produces (feedFx contributes nothing).
6. `syncFx` on a changed `seed:level` with an open group emits no callout and
   leaves `getCallout()` empty.
7. `drawFxOverlay` fillText pin, recorder-ctx: after a 3-kill boom batch and
   `feedFx(w, CFG.BLADE_TTL + 0.01)`, the recorded `fillText` texts include
   `TRIPLE`; with `hud` unrendered nothing is drawn.
8. **PLAY-only gate:** open a group on a PLAY frame, then feed
   `{...w, state:"PAUSE"}` with `dt 0.5` — `getCallout()` is still empty, the
   group is still open at its original `cmbT`, and one more PLAY frame past the
   window emits it. Same for `state:"WIN"`.

**Sound is out of scope.** Report §6: "Sound after `src/audio/*` lands".

---

## 3. R7 — time-attack stopwatch + MODES packaging (scoreboard only)

### 3.1 The room clock — `roomT`

Per §1.1. In `src/main.js`, everything mirrors `coachT`:

| site | today | add |
|---|---|---|
| `main.js:124` | `let coachT = 0;` | `let roomT = 0; let bestPrev = null;` |
| `main.js:164` (`onStart`) | `coachT = 0;` | `roomT = 0; bestPrev = null;` |
| `main.js` `onPauseCmd` RESTART branch (beside `coachPlanted = false`) | — | `roomT = 0; bestPrev = null;` |
| `main.js:536-538`, after `noteWorldEdge`, **before** `prevSt = world.state` | — | the WIN-edge write and the room-start reset, below |
| `main.js:547` | `if (world.state === "PLAY") coachT += dt;` | `if (world.state === "PLAY") roomT += dt;` |

```
if (prevSt === "PLAY" && world.state === "WIN") {
  const k = timeKey(world), v = loadTimes();
  bestPrev = bestOf(v, k);                 // captured BEFORE the write
  saveTimes(recordTime(v, k, roomT));
}
if ((prevSt === "WIN" || prevSt === "LOSE") && world.state === "PLAY") {
  roomT = 0; bestPrev = null;              // WIN→next room, LOSE→new run
}
```

`PAUSE → PLAY` is deliberately **not** in that reset list: resuming continues
the room, it does not restart it.

**Every recorded time includes the fixed `CFG.WIN_DELAY` 1.6 s tail**
(`config.js:5`; WIN is set by `updateEnemies` after 1.6 s of an empty board).
It is a constant on every clear, so times stay comparable; it is **never
subtracted** — subtracting would put a `CFG` constant into the app layer for
a cosmetic gain and could go negative on an edge case.

### 3.2 `src/app/times.js` — the one new key

`nb.times.v1`, built from the `load*/save*(store)` template shared by
`pactstore.js` / `plaques.js` / `pacestore.js` / `cabinetseen.js` / `coach.js`
/ `settings.js` (feasibility "Ground truth"): try/catch, injectable `store`,
one key.

**Shape** — `{ on: 0|1, b: { "<key>": <tenths> } }`

- `timeKey(world)` (pure, no store) =
  `` `${world.level|0}:${clampHeat(world.heat)}:${clampPact(world.pact)}:${clampPace(world.pace)+1}` ``
  — the report's 5-tuple minus `seed` (report §3, "The seed contract"). `pace`
  is shifted `+1` so the segment is `0..2` and the whole key matches
  `/^[1-8]:[0-2]:(?:[0-9]|1[0-5]):[0-2]$/`.
- values are **integer tenths of a second, 1..5999** (0.1 s … 599.9 s).
- **`clampTimes(raw)`**: `on` through the same `bit()` shape `settings.js:22-26`
  uses; `b` keeps only entries whose key matches the regex and whose value is a
  finite integer in `1..5999`; the map is capped at **96 entries** — on
  overflow the **first** keys in insertion order are dropped (the key form is
  non-integer-like, so JS preserves insertion order deterministically).
- `bestOf(v, key)` → seconds (`tenths/10`) or `null`.
- `recordTime(v, key, sec)` → a new object; `d = Math.floor(sec*10)` clamped to
  `1..5999`; writes only when there is no prior or `d < prior`. **Floor, not
  round**, so the stored number and the displayed number can never disagree by
  a tenth.

**Recording is unconditional** — it happens on every room WIN whether or not
TIME ATTACK is switched on. The clock is free (`roomT` runs anyway) and it
means a player who switches the mode on already has bests to beat. **Display**
is what the toggle gates.

### 3.3 Display — HUD chip and WIN overlay

Both renderers already carry a per-frame opts object; R7 adds one field,
`o.time = {on, t, best}`, assembled in `main.js`'s GAME `ro` branch
(`main.js:632-646`) as
`{on: !!app.timeAttack, t: roomT, best: bestPrev}`.

**HUD chip** — `drawHudChips(c, world, tm)`, third arg **optional**:

- `tm` absent or `tm.on` falsy → **byte-identical to today**. This is what
  keeps `tests/three.test.mjs:1408-1420` and `tests/pickups.test.mjs:465`
  (both call `drawHudChips(rec, world)`) unmoved.
- `tm.on` true → the ENEMIES chip narrows from `chip(386, **94**, …)` to
  `chip(386, **64**, …)` (ends at 450), and a new
  `chip(**458**, **72**, "TIME", fmtTime(tm.t), null, null)` is painted
  (`scenes.js:222-232` is the chip helper; label 9 px, value `900 13px`).
- **Budget** (assumes the 0.6 em advance typical of `ui-monospace` fallbacks —
  Menlo is 0.602 em): `ENEMIES` at 9 px = 37.9 px + 20 px padding = 57.9 ≤ 64;
  `0:41.2` at 13 px = 46.9 + 20 = 66.9 ≤ 72; the TIME chip ends at **530** and
  the right-aligned score column (`scenes.js:233-241`, right edge 588) reaches
  left to **541** at six digits, **533** at seven. **If the headed check shows
  any overlap, narrow ENEMIES further — never move the right-aligned score
  column**, which is the arcade convention the HUD is built on.
- `fmtTime(sec)` — exported from `scenes.js`, pure, pinned:
  clamp to `[0, 599.9]`; `d = floor(s*10)`; return
  `` `${floor(d/600)}:${pad2(floor(d/10)%60)}.${d%10}` ``. Always ≤ 6
  characters; a room past 9:59.9 pins at `9:59.9` (it is not a time-attack
  contender).

**WIN overlay** — `drawOverlay(c, world, w, h, cx, cy, ui, tm)`, eighth arg
**optional**:

- `tm` absent or `tm.on` falsy → today's three lines exactly, so
  `tests/heat.test.mjs:326-334` is unmoved.
- `tm.on` true **and** `world.state === "WIN"` → one extra `sub()` line at
  `dy 44` and the cue line moves from `dy 44` to `dy 68` (`scenes.js:111-114`).
  `cy + 68` = 328 < 520, well inside the box.
- **LOSE is unchanged** — a room time is only meaningful on a clear.
- `timeLine(world, tm)` — exported from `scenes.js`, pure, pinned:

  ```
  "ROOM " + (world.level|0) + " · " + fmtTime(tm.t) + " · " +
  (tm.best == null || tm.t < tm.best ? "NEW BEST" : "BEST " + fmtTime(tm.best))
  ```

  `tm.best` is `bestPrev`, captured **before** the WIN-edge write (§3.1) —
  otherwise the overlay would read back the record it just set and every clear
  would print its own time as the best.

  Both forms are locked copy: `ROOM 3 · 0:41.2 · BEST 0:38.9` and
  `ROOM 3 · 0:41.2 · NEW BEST`.

### 3.4 MODES — the decision

**MODES is a LEVEL SELECT presentation change. There is no MODES sub-page and
no new `SCREEN` value.** Three reasons, in order of weight:

1. **Q2 is open** (report §7.2). Appending a `SCREEN` would settle a question
   the report explicitly hands to the owner, on the cheapest item in the wave.
   R5 and R6 are where that argument belongs.
2. **Discoverability is the whole point** (report §4 R7: "the real gap is
   discoverability for players who never find LEVEL SELECT's `1-4` toggles").
   A page one hop deeper than the toggles is *less* discoverable than a labelled
   rail on the screen the player already opened to pick a room.
3. Zero `SCREEN` churn: `menuapp.js:16-29` and every frozen value after
   `GUIDE: 11` stay put, and `tests/menuapp.test.mjs` is untouched.

**The rail** (`src/render/menudraw.js`, `drawLevelSelect`, currently
`:375-399`), gated exactly as today on `showPact = !!unlocked`:

| item | today | locked |
|---|---|---|
| chip width / gap | `pw 70`, `pg 8`, 4 chips = 304 | `pw **64**`, `pg **6**` for chips 1–4, then a **16 px** double gap, then chip 5 = **354** (shell inner width `iw` is 368 at both pinned sizes, `shell(c,L,400)` → `w 400`, `iw = w-32`) |
| labels | `` `${i+1} ${PACT_NAME[i]}` `` | `` `${i+1} ${MODE_NAME[i]}` ``, `MODE_NAME = ["IRON","BARE","THIN","SHRINK"]`, a **render-side** table in `menudraw.js` — the same duplication precedent as `PLAQUE_NAME` (`scenes.js:57-59` names it) |
| chip 5 | — | `5 TIME`, colour **`#ff8a3c`** |
| gloss | — | one 9 px MUTED centred line at `py + 30`: `5 TIME ATTACK · stopwatch + per-room best` |
| head subtitle (unlocked) | `ROOM + HEAT + PACE + PACT` | `ROOM + HEAT + PACE + MODES` |
| foot (unlocked) | `ENTER START · ←/→ ROOM · ↑/↓ HEAT · [ ] PACE · 1–4 PACT · ESC` | `ENTER START · ←/→ ROOM · ↑/↓ HEAT · [ ] PACE · 1–5 MODES · ESC` |
| locked state | — | **byte-identical**, head/foot/rail all unchanged |

`src/core/pact.js` is **not** touched: `PACT_NAME` stays `["LAST","BARE","THIN",
"SHRINK"]` and `pactLabel`'s `L/B/T/S` letters stay, so the HIGH SCORES `p`
column and every `pact.js` pin are untouched. IRON is a *display* name for
`PACT.LAST` (`pact.js:1`, `applyPact` sets `lives = 1`, `:22`); BARE is
`PACT.BARE` (`:24`, `p.bare = true`).

**The fifth chip must not read as a fifth Pact bit** — that is the exact thing
the report refuses. Two devices enforce it: the **double gap** before it, and a
colour **outside `PACT_COL`** (`["#ff5d73","#7385ad","#37f0d0","#ffd447"]`,
`pact.js:3`). `#ff8a3c` is already in the palette as FLAME's `col`
(`entities.js:8`) and collides with none of the four.

**Vertical fit**, checked at both sizes `menudraw.test.mjs:255-258` exercises:
the rail sits at the existing `py = pzy + 34`, gloss at `py + 30`. At 600×520
that is 347 / 377 against `S.footY` 476; at 608×352 it is 249 / 279 against
`S.footY` 308.

**The toggle:**

- `app.timeAttack` (boolean), seeded from `loadTimes().on` through a new
  `createMenuApp` option, exactly as `pace` is seeded from `loadPace()`
  (`main.js:194-196`).
- `toggleTimeAttack()` in `menuapp.js`, the `togglePactBit` shape verbatim:
  `if (this.screen !== SCREEN.LEVEL || !this.pactUnlocked) return false;`
- `key()` gains `case "Digit5": case "Numpad5": return this.toggleTimeAttack();`
  next to `Digit1..4` (`menuapp.js:208-219`). No existing pin moves —
  `tests/menu-level.test.mjs:101-116` pins only `Digit1..4 → PACT` bits, and
  `Digit5` returns `false` outside LEVEL exactly as `Digit1..4` do today.
- persist edge: `onTimeAttack: (on) => saveTimes({...loadTimes(), on: on ? 1 : 0})`
  in `main.js`, the `onPaceChange` shape (`main.js:196`).
- **`startRun()`'s args are unchanged** — `{level, heat, pact, pace}`
  (`menuapp.js` `startRun`). TIME ATTACK never reaches `onStart`, never reaches
  `world`, and therefore never reaches `step()`. **Pinned as an absence.**
- `shellview.js:97-106` passes `app.timeAttack` as `drawLevelSelect`'s 9th arg.

**Gated on `showPact`.** The whole rail, TIME chip included, appears only after
the first FUSE/GRID CLEAR. A first-timer has no bests and no use for a
stopwatch, and this keeps the pre-unlock LEVEL SELECT byte-identical — which is
what `menudraw.test.mjs:299` (`drawLevelSelect(c, 3, L, 1, 1)`, `unlocked`
undefined) actually renders. Stated tradeoff: R7's success metric is only
measurable for unlocked players. Bests are still recorded from run one.

### 3.5 Pins — `tests/times.test.mjs` (new) + additions

1. `timeKey` over `{level:3,heat:1,pact:5,pace:-1}` === `"3:1:5:0"`; junk heat /
   pact / pace clamp through `clampHeat` / `clampPact` / `clampPace`.
2. `clampTimes` drops a bad key, a `0` value, a `6000` value, a non-integer;
   keeps `on`; caps at 96 entries dropping the first inserted.
3. `recordTime` writes on no-prior; writes on strictly faster; **does not**
   write on equal or slower; floors (`41.29` → 412).
4. `loadTimes`/`saveTimes` round-trip through a `mapStore()` (the
   `tests/plaques.test.mjs:20-26` helper shape), and both survive a throwing
   store.
5. `fmtTime`: `0` → `0:00.0`, `41.23` → `0:41.2`, `59.99` → `0:59.9`,
   `61` → `1:01.0`, `9999` → `9:59.9`, `-5` → `0:00.0`; never longer than 6
   chars.
6. `timeLine`: `{level:3}` + `{on:true,t:41.23,best:38.9}` →
   `ROOM 3 · 0:41.2 · BEST 0:38.9`; `best:null` → `ROOM 3 · 0:41.2 · NEW BEST`;
   `best:45` → `NEW BEST`.
7. `drawHudChips(rec, world)` with no third arg records the **same** fillText
   list as today (no `TIME`); with `{on:true,t:41.23}` it includes `TIME` and
   `0:41.2`.
8. `drawOverlay(…, undefined, undefined)` on WIN records today's lines; with
   `{on:true,…}` it additionally records the `timeLine` string, and the PAUSE
   and LOSE branches are unaffected.
9. `menuapp`: `Digit5` on MENU / on LEVEL-locked returns `false` and leaves
   `timeAttack` alone; on LEVEL-unlocked flips it and fires `onTimeAttack`;
   `startRun()`'s returned args have **no** `timeAttack` key.
10. `menudraw`: `drawLevelSelect(c,3,L,1,1)` (locked) records **no** `IRON` /
    `TIME` / `MODES` text; unlocked records `1 IRON`, `4 SHRINK`, `5 TIME`,
    the gloss line, and the `1–5 MODES` foot.

---

## 4. R11 — colourblind audit + pause-anywhere verification

Report §4 R11 effort **S, 0.5–1 d**, invariant risk **None**. Report success
metric, quoted: "Design review, not an in-game number. Say so rather than
inventing one."

### 4.1 CVD audit — method

**Deliverable: `docs/superpowers/specs/2026-09-06-cvd-audit.md`**, a new
follow-up doc, plus **at most two** hex swaps (§4.2) if and only if the rule
below fires on an eligible pair. The audit itself is run by a throwaway Node
script in the session scratchpad — **no new file lands in `src/` or `tests/`
for the audit**; the doc carries the matrices, the table and the verdict.

**Colour maths is copied, not re-derived.** `labOf` and `dE` are lifted
verbatim from `tests/items-art.test.mjs:55-72`, cited by line in the audit doc,
so the R11 numbers and the shipped MAKO gate can never fork.

**Simulation:** Viénot–Brettel–Mollon (1999) protanope and deuteranope,
Brettel single-plane tritanope, **severity 1.0**, applied in **linear** RGB
(sRGB EOTF in — `c <= 0.04045 ? c/12.92 : ((c+0.055)/1.055)**2.4` — the 3×3
below, then the inverse EOTF out). The nine coefficients per matrix are printed
here, not deferred, so the method is checkable from this file alone:

```
protan  [ 0.11238,  0.88762,  0.00000 ]   deutan [ 0.29275,  0.70725,  0.00000 ]
        [ 0.11238,  0.88762,  0.00000 ]          [ 0.29275,  0.70725,  0.00000 ]
        [ 0.00401, -0.00401,  1.00000 ]          [-0.02234,  0.02234,  1.00000 ]

tritan  [ 1.00000,  0.14461, -0.14461 ]
        [ 0.00000,  0.85659,  0.14341 ]
        [ 0.00000,  0.85659,  0.14341 ]
```

**Plan step 1, before any colour is simulated:** re-check these 27 coefficients
against the cited papers and transcribe them into the audit doc. If any differs,
the audit doc records the corrected value **and the reason**, and this section
is amended — a wrong coefficient would silently move every ΔE in the table.

**Set under test — 85 colours:**

| group | source | n |
|---|---|---|
| biome swatches, 7 per biome (incl. the `wallHi` opaque band and the real `brickHi`-at-0.55-over-`brickA` composite) | `BIOMES`, `config.js:17-26`; swatch construction per `items-art.test.mjs:694-713` | 56 |
| pickups | `POWER[*].col`, `entities.js:5-105` | 12 |
| foes | `spawnEnemy` spec colours, `entities.js:239-268` | 9 |
| heat chips | `HEAT_COL`, `heat.js:6` | 3 |
| pact chips | `PACT_COL`, `pact.js:3` | 4 |
| TIME chip | `#ff8a3c` (§3.4) | 1 |

**Collision rule.** For each pair drawn adjacent or overlapping *in the same
view*: report a collision when `dE(a, b) >= 14` in true colour **but**
`dE(sim(a), sim(b)) < 14` for at least one of protan / deutan / tritan. The
threshold **14** is not invented — it is the floor already shipped in
`tests/items-art.test.mjs:755` ("every VOID swatch is >= 14 dE away").

### 4.2 CVD audit — fix budget

**≤ 2 hex swaps total for the whole wave**, and a swap is eligible only when
**all three** hold:

1. the pair is drawn adjacent or overlapping in the same view;
2. the pair carries **no** shape, glyph, label or silhouette difference;
3. it meets the collision rule above.

**Excluded by construction, not by judgement:**

- **player-vs-foe and foe-vs-foe pairs.** AGENTS.md: separation from the cast
  is "structure, never a re-hue", and `stationary`'s `#c58aff` is explicitly
  disclosed-and-not-gated ("un-clearable by ANY chromatic hex in MAKO's family
  — the whole violet band was swept"). A CVD swap here is the one change AGENTS
  forbids by name.
- **`POWER[*].col`** — every pickup carries its own `drawIcon` glyph
  (AGENTS.md: "Pickup glyphs live in `drawIcon`"), so shape separates.
- **`HEAT_COL`** (chips carry `HEAT_MARK` `·` / `+` / `×`, `heat.js:5`),
  **`PACT_COL`** and the TIME chip (chips carry `1 IRON` … `5 TIME` text).

In practice that leaves only within-biome swatch pairs eligible. **Any swap
must re-run `tests/items-art.test.mjs`** — the 56-swatch value-AND-hue gate
(`:733`) and both VOID ΔE floors (`:755`, `:760`) are exactly what a well-meant
CVD swap breaks — plus `tests/menudraw.test.mjs` and a headed 2D+3D look.

**Zero eligible collisions is a pass**, and is the expected outcome: report
§4 R11 says "expect to swap 1–2 hex values", and the AGENTS gate has already
swept the hardest case. The doc ships either way.

### 4.3 Pause-anywhere — exact states to pin

`onPause` (`main.js:296-313`) and `input.js:48` (`KeyP` / `Escape`) are the
whole mechanism. This is **verification, not new code**: the expected diff is
`tests/headless.test.mjs` only.

Already pinned, do not re-pin: `headless.test.mjs:328-331` (PLAY ⇄ PAUSE inside
GAME), `:336-338` (outside GAME leaves the world untouched), `:341-342` (KeyP at
MENU routes to the app only).

**New pins:**

| # | state | expected | source |
|---|---|---|---|
| 1 | `world.state === "WIN"` | `onPause()` is **inert** — world stays WIN | `main.js:305-312` has no WIN branch. **Stated decision, not an absence:** the WIN overlay is not time-pressured and already owns SPACE; a pause on a stopped clock is a no-op |
| 2 | `world.state === "LOSE"` | inert, world stays LOSE | same |
| 3 | `app.pauseView === 1` (inline OPTIONS) | `onPause()` backs to the pause **list**, world stays PAUSE | `main.js:300-303` |
| 4 | room-load frame: from WIN, one fire edge → `step` runs `loadLevel(world, level+1, true)` and PLAY (`sim.js:53-65`) | `onPause()` on that same frame pauses | proves there is no blocked window between rooms |
| 5 | new-run frame: from LOSE, one fire edge → `startGame` (`sim.js:67-74`, `:107-111`) | `onPause()` on that same frame pauses | same for the LOSE path |
| 6 | `SCREEN.ATTRACT` | `onPause()` is a no-op, no PAUSE state, demo keeps running | `main.js:297-298`; **attract is deliberately excluded** |
| 7 | PAUSE during the coach window | `coachT` does not advance while paused, so the coach window is not burned | `main.js:547`; this is commit `33668f7`'s fix and R11 is where it gets its pin |

---

## 5. R4 — first-visit Play Now + sub-90 s handoff verification

Report §4 R4: **S-M, 0.5–1 d remaining**, "this is verification and finish work
on shipped code, not new architecture". The shipped path is already in place:
`bootFromIntro` (`menuapp.js:340-346`), `nb.cabinet.v1`
(`src/app/cabinetseen.js`), the 3 s ghost coach (`coach.js:4,24-26`), and
`main.js`'s auto-advance `if (app.screen === SCREEN.INTRO && app.subT >= INTRO_DUR) app.skip();`
with `INTRO_DUR = 5.0` (`src/app/intro.js:1`).

### 5.1 Protocol — one paragraph, then the script

**Cold load with storage wiped; the number of record is a 60 fps screen
recording, from the first painted frame to the frame the first bomb appears on
the board; target ≤ 90 s; the number is logged in the plan and in `MEMORY.md`.**

**Wipe.** DevTools → Application → Clear site data (this unregisters the SW and
deletes its caches — AGENTS.md: "A stale service worker serves pre-change bytes
and looks exactly like a render change that did not land"). Verify
`localStorage.length === 0` and
`navigator.serviceWorker.getRegistrations()` empty **before** loading.

**Target.** Primary run on the live Pages URL with the trailing slash,
`https://hmarzban.github.io/fusegrid/` (AGENTS.md: the no-slash 301 drops the
OG tags; use the slash form for every share and every test). Control run on
`http://127.0.0.1:8080/index.html` (`npm start`), to separate bandwidth from
code path. Log both.

**Clock.** Record at 60 fps. `t0` = first frame with any non-blank page pixel.
`t1` = first frame showing the planted bomb on the board. Elapsed =
`(t1 − t0) / 60` s. No console interaction during the recorded run — a paste
inside the window would inflate the number.

**Cross-check (separate cold load, `?debug=1`).** `mountDebugHook` exposes the
world as `window.__GAME__.G` (`src/app/debughook.js:27-29`). `loadLevel`
**reassigns** `w.events = []` (`world.js:80`), so a plain `push` patch dies on
the first room load — wrap the property instead, installed before any gesture:

```js
const g = window.__GAME__; let T = null;
const wrap = a => { const p = a.push.bind(a);
  a.push = (...xs) => { for (const e of xs)
    if (e && e.t === "bomb" && T == null) T = performance.now();
    return p(...xs); }; return a; };
let _e = wrap(g.G.events);
Object.defineProperty(g.G, "events",
  { get: () => _e, set: v => { _e = wrap(v); }, configurable: true });
window.__ms = () => T -
  performance.getEntriesByName("first-contentful-paint")[0].startTime;
```

Report this number too, and note that it carries the tester's paste latency —
it is a sanity check on the recording, never the number of record.

### 5.2 The scripted first-timer path

Fixed script, no exploration, run twice:

- **Run A (patient)** — no input at all until `main.js`'s auto-skip fires
  `bootFromIntro` at `INTRO_DUR = 5.0 s`. This is the first-visit Play Now
  branch under test.
- **Run B (impatient)** — one Space at t ≈ 2 s, which reaches the same
  `bootFromIntro` through `skip()` (`menuapp.js:337-338`).

Then, identically in both: hold nothing for **1.5 s** (read the ghost coach,
`COACH_DUR = 3`), hold **D** for **0.4 s**, press **Space**. That press is the
first `{t:"bomb"}` (`sim.js:328`).

**The target applies to the slower of the two runs.** Both must also confirm
the veteran branch: after Run A, reload without wiping and check the shell
lands on MENU, not GAME (`bootFromIntro`'s `cabinetSeen || pactUnlocked` guard,
`menuapp.js:343`), and that attract stays CORE / pact = 0
(`playFromAttract`, `menuapp.js:562-565`).

### 5.3 If it fails — dormant, ordered, bounded

Fixes land **only** on a failure, and only in this order:

1. **`INTRO_DUR`** (`src/app/intro.js:1`, 5.0) — lower it, floor **3.5 s**
   (below that the intro's own beats stop reading). Only if Run A dominates the
   number.
2. **Coach prominence** — either `COACH_DUR` (`coach.js:4`, 3) up to a ceiling
   of **4.0 s**, or the panel contrast (`COACH_PANEL` / `COACH_TEXT`,
   `scenes.js:255-257`). Only if the read pause dominates. **No new motion, no
   blink** — the coach is a fade, and REDUCE FLASH players get the same panel.
3. Nothing else.

**Explicitly refused as "fixes":** changing room 1's roster
(`walker, walker, stationary`, `heat.js:23` — the frozen-easy on-ramp is the
thing that works), auto-planting a bomb for the player, or skipping INTRO
entirely.

**Honest limit, quoted from the report** (§4 R4, Risk): "if CORE room 1 is *too*
easy for a genre-savvy portal visitor, the aha may not land inside 90 s even at
zero friction. That needs a real playtest, not a faster load." This protocol
measures time-to-first-bomb. It cannot measure the aha, and the plan must not
claim it does.

---

## 6. ABI table — every pin that moves

`site → today → new → plan`

| Site | Today | New | Plan |
|---|---|---|---|
| `src/render/fx.js` exports | `setFxOpts getFxOpts initFx getShake getFlash getFx syncFx onEvent updateFx drawFx` | **+** `comboOf comboLabel nearMissOf feedFx getCallout getNearMiss drawFxOverlay` | R2 |
| `renderer.js:34-41` / `wrapper.js:104-115` `consumeEvents` | `syncFx` → loop → `length=0` → `updateFx` | **+** `feedFx(world, dt)` after `syncFx` | R2 |
| `renderer.js:84-88` / `wrapper.js:154-155` hud block | chips, coach | **+** `drawFxOverlay(ctx)` between them | R2 |
| `fx.js` `syncFx` / `initFx` | wipe `parts` (and shake/flash) | **+** zero `cmbN cmbT calT nmT nmCd`, emitting nothing | R2 |
| `tests/fx.test.mjs` | — | **new file**, 7 pins (§2.5) | R2 |
| `scenes.js drawHudChips(c, world)` | 2 args | `(c, world, tm)` — 3rd optional, absent ⇒ byte-identical | R7 |
| ENEMIES chip | `chip(386, 94, …)` | `94` when `!tm.on`; `64` when `tm.on`, **+** `chip(458, 72, "TIME", fmtTime(tm.t))` | R7 |
| `scenes.js drawOverlay(c,world,w,h,cx,cy,ui)` | 7 args | `(…, ui, tm)` — 8th optional; WIN cue `dy 44 → 68` only when `tm.on` | R7 |
| `scenes.js` exports | `drawLogo winHeadline overlayCue runStamp copyPayload PAUSE_ROWS PAUSE_ROW_H overlayBox pauseHit drawOverlay updateHud makeHud drawHudChips drawCoach` | **+** `fmtTime timeLine`. `runStamp` / `copyPayload` **unchanged** (`heat.test.mjs:71-82`, `headless.test.mjs:907-914`) | R7 |
| `renderer.js:78` / `wrapper.js:153` | `drawOverlay(…, o&&o.pause)` | `drawOverlay(…, o&&o.pause, o&&o.time)` | R7 |
| `renderer.js:84` / `wrapper.js:154` | `drawHudChips(ctx, world)` | `drawHudChips(ctx, world, o&&o.time)` | R7 |
| `src/app/times.js` | — | **new module**: `TIMES_KEY timeKey clampTimes loadTimes saveTimes bestOf recordTime` | R7 |
| `src/pwa/shell.js` `SRC` | 60 entries | **+** `"src/app/times.js"` — **mandatory**: `tests/pwa.test.mjs:98-103` walks `src/` and requires every `.js` in `PRECACHE` | R7 |
| `menuapp.js SCREEN` | 12 values, `GUIDE: 11` | **unchanged** — no MODES screen (§3.4) | R7 |
| `menuapp.js key()` | `Digit1..4` → `togglePactBit` | **+** `Digit5` / `Numpad5` → `toggleTimeAttack()`. `menu-level.test.mjs:101-116` pins only `Digit1..4`; unmoved | R7 |
| `createMenuApp` app object | `… pace pactUnlocked` | **+** `timeAttack` field, `toggleTimeAttack()`, `o.onTimeAttack` | R7 |
| `menuapp.js startRun()` args | `{level, heat, pact, pace}` | **unchanged** — `timeAttack` never reaches `onStart` / `world` / `step()`. Pinned as an absence | R7 |
| `menudraw.drawLevelSelect(c,sel,L,t,heat,pact,unlocked,pace)` | 8 args | **+** 9th `timeAttack` | R7 |
| LEVEL SELECT modes rail | `pw 70 / pg 8`, 4 chips (304), `` `${i+1} ${PACT_NAME[i]}` `` | `pw 64 / pg 6` ×4, 16 px gap, 5th chip (354); `MODE_NAME` labels; `5 TIME` in `#ff8a3c`; gloss at `py+30` | R7 |
| LEVEL SELECT head sub / foot (unlocked) | `…+ PACT` / `… 1–4 PACT · ESC` | `…+ MODES` / `… 1–5 MODES · ESC` | R7 |
| LEVEL SELECT **locked** state | — | **byte-identical**; `menudraw.test.mjs:299` calls `drawLevelSelect(c,3,L,1,1)` and pins `HEAT` + CORE/PLUS/MAX — unmoved | R7 |
| `shellview.js:97-106` | 8 args | **+** `app.timeAttack` | R7 |
| `main.js` | `coachT` only | **+** `roomT`, `bestPrev`; WIN-edge write at `:536-538`; `roomT += dt` at `:547`; `ro.time` in the GAME `ro` (`:632-646`); `loadTimes`/`saveTimes` imports; `onTimeAttack` wiring | R7 |
| `tests/times.test.mjs` | — | **new file**, 10 pins (§3.5) | R7 |
| `heat.test.mjs:326-334` (WIN branch) | `texts.some(s => s.indexOf("CLEARED") >= 0)` | **unmoved** — 8th arg defaults `undefined` ⇒ today's layout | R7 |
| `three.test.mjs:1408-1420`, `pickups.test.mjs:465-478` | `drawHudChips(rec, world)` | **unmoved** — 3rd arg `undefined` ⇒ today's layout | R7 |
| `docs/…/2026-09-06-cvd-audit.md` | — | **new doc**: matrices, 85-colour table, verdict, swaps (0–2) | R11 |
| `config.js BIOMES` / `entities.js` colours | as shipped | **at most 2 hex values**, and only under §4.2 | R11 |
| `tests/headless.test.mjs` pause block | `:328-342` | **+** 7 pins (§4.3) | R11 |
| `src/pwa/shell.js:1` `CACHE_NAME` + `sw.js` REV | `fusegrid-shell-v103` | **v104** (R2) → **v105** (R7) → **v106** (R11, only if a hex lands) → **v107** (R4, only if a fix lands). `pwa.test.mjs:79-81,318` pins the format and the REV match | all |
| `MEMORY.md` | — | one dated line per plan (AGENTS.md standing rule) | all |

---

## 7. Ship order and PWA bumps

**R2 → R7 → R11 → R4**, as briefed. The justification, since each step has one:

1. **R2 first.** Its whole diff is `fx.js` plus two one-line hooks — it touches
   none of `scenes.js`, `menudraw.js`, `sprites.js`, `src/audio/*`, and none of
   `tests/coach.test.mjs`, `tests/menudraw.test.mjs`, `tests/three.test.mjs`,
   which are dirty in `git status` right now (report §6). Cheapest high-value
   item, smallest collision surface.
2. **R7 second.** It is the only wave-1 item that touches `scenes.js`,
   `menudraw.js`, `menuapp.js` and `main.js`, and the only one that adds a key
   and a module. It goes after R2's small diff has landed so a conflict has one
   author, not two.
3. **R11 third, after R7 — not before.** The audit set includes the TIME chip's
   `#ff8a3c` (§3.4). Auditing before R7 would audit a palette that is about to
   change and force a second pass. The pause pins are order-independent.
4. **R4 last.** It measures the shipped whole. Running it before R2/R7 land
   would measure a build nobody ships, and any R4 fix (INTRO/coach timing) would
   invalidate an earlier number.

**PWA rule** (AGENTS.md: "Bump `CACHE_NAME` and the REV token in `sw.js`
together when the file list or shipped bytes change"): **one paired bump per
precache-touching commit**, not one per wave — R2 → v104, R7 → v105 (which also
adds the `SRC` line), R11 → v106 only if a hex swap lands, R4 → v107 only if a
fix lands. Test-only commits do not bump.

**Every plan ships with:** Node tests green (`npm test`) **and** a headed
play-verify — AGENTS.md: "Visual 3D feel is not covered by Node." R2's headed
check is a chain of ≥3 in both 2D and 3D plus a REDUCE FLASH pass; R7's is the
HUD row at both kinds with a 6-digit score (the overlap check of §3.3) and the
MODES rail at both plate sizes; R11's is the audit doc and any swap in-game;
R4's is the recording itself.

---

## 8. Self-review

Run against this file's own bar: no placeholders, no contradiction with an
AGENTS.md lock, every number traced.

**What the review changed:**

1. **`world.time` → `roomT`.** The brief and report §4 R7 both say the
   stopwatch reads `world.time`. `sim.js:42-43` bumps it before the PAUSE
   return at `:75-77`, main's step loop is ungated on `world.state`
   (`main.js:548-561`), and `loadLevel` never resets it — so it double-counts
   pause and never resets per room. Replaced with a PLAY-only `roomT` mirroring
   `coachT` (§1.1). The HUD chip reads `roomT` too, not `world.time`.
2. **BEST would have read back its own write.** The WIN-edge persist runs one
   frame before `drawOverlay` paints, so `BEST` would have printed the time just
   set. Added `bestPrev`, captured before the write, and locked both copy forms
   including `NEW BEST`, which was an unlocked placeholder (§3.1, §3.3).
3. **Close-call envelope was wrong.** "Own tile is not a blast tile" ignores the
   12 px the `aabb` hit test reaches past the tile rect (`sim.js:342`), so the
   flash could fire on the damage frame. Replaced with a Chebyshev annulus
   whose inner bound `32 px` is that call's own geometry, plus the `{t:"hurt"}`
   batch check that a shielded hit needs (`sim.js:344-348`) (§1.3, §2.3).
4. **Three unsourced numbers removed.** The combo window is now `CFG.BLADE_TTL`
   (`config.js:13`) instead of an invented 0.20 s; the blade-freshness threshold
   is gone entirely, replaced by the boom-in-batch gate the combo already
   computes; the CVD threshold is `14`, the floor already shipped at
   `items-art.test.mjs:755`, instead of an invented 12. R11 also now copies
   `labOf`/`dE` from `items-art.test.mjs:55-72` rather than specifying parallel
   colour maths.
5. **The fix budget would have proposed the one swap AGENTS forbids.** §4.2 now
   excludes player-vs-foe and foe-vs-foe pairs *by construction* (AGENTS.md
   "structure, never a re-hue"; `stationary` `#c58aff` disclosed-and-not-gated)
   and requires `items-art.test.mjs` to be re-run on any swap.
6. **`syncFx` leak.** `feedFx` runs inside `consumeEvents`, which also runs for
   the attract demo world; without clearing, an open combo group would leak
   across the attract ⇄ live boundary. `syncFx`/`initFx` now zero the new state
   without emitting, with a pin (§2.4, §2.5.6).
7. **The fifth chip would have read as a fifth Pact bit** — the exact thing the
   report refuses. Added a 16 px double gap and a colour outside `PACT_COL`
   (§3.4).
8. **`pwa.test.mjs:98-103` makes the `SRC` line mandatory,** not optional:
   it walks `src/` and requires every `.js` to be in `PRECACHE`, so
   `src/app/times.js` fails the suite until `shell.js` lists it. Promoted from
   "tax" to a hard ABI row.
9. **PAUSE-on-WIN/LOSE inertness is now a stated decision with a pin**, not an
   unexamined absence (§4.3 rows 1–2), and §4.3 marks which pins are new so the
   plan does not read as already-done work.
10. **R2 would have fired over the PAUSED and CLEARED veils** — the same
    class of bug as fix 1. `render()` runs every frame regardless of
    `world.state` (`main.js:649`), so the combo timers decayed on paused
    frames and the callout could paint on top of `drawOverlay`. `feedFx` now
    owns the R2 decay and no-ops outside PLAY, while `updateFx` keeps shake /
    flash / confetti running through WIN unchanged (§2.2, §2.6, pin §2.5.8).
11. **The CVD matrices are inlined**, not deferred to a doc that does not
    exist yet — §0 promises no TBDs, and the matrix is the one R11 value a
    reviewer checks (§4.1).

**Known assumption, disclosed:** the HUD width budget (§3.3) assumes the
0.6 em advance typical of `ui-monospace` fallbacks. It is checked in the headed
pass, and the named fallback is to narrow ENEMIES further — never to move the
right-aligned score column.

**Open owner questions this spec does not answer**, and deliberately: Q1
(continue-credit, report §7.1 — blocks nothing here) and Q2 (new-`SCREEN`
policy, §7.2 — §3.4 routes around it rather than settling it).
