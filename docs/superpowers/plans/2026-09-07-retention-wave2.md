# Retention Wave 2 Program — INDEX

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five retention items land on the shipped arcade loop without touching
the sim: a truthful run summary with per-heat bests and a delta that is
computed from persisted numbers or not shown (**R1**), an opt-in STATS screen
over `nb.stats.v1` with a four-line COPY MY STATS payload (**R5**), an
honour-system single-device daily seeded challenge (**R3**), a score-free
challenge code that carries a board and never a claim (**R8**), and three
first-use coach tips composed from copy the game already ships (**R10**).

**Architecture:** Five sub-plans, strictly ordered. **R1** adds `src/app/bests.js`
(`nb.bests.v1`, keyed heat/pact/pace), the `newTally`/`feedTally` event tap that
runs at the one non-destructive `world.events` read `main.js` already performs,
a **run-start** `bestRun` snapshot (never a per-write capture — §Resolved 1), a
**split** of R7's reset block so `roomT`/`bestPrev` keep resetting on both
WIN→PLAY and LOSE→PLAY while `tally`/`runT`/`bestRun`/`runEnded` reset on
LOSE→PLAY only, an idempotent `endRun()` latch called from both sim edges **and**
from inside `persistScore()`, and a 9th optional `drawOverlay` argument — absent
⇒ byte-identical to today. **R5** adds `src/app/stats.js` (aggregates always, the
200-entry ring only after the player opens STATS once), extends `feedTally` in
place rather than adding a second pass, appends `SCREEN.STATS = 12`, and paints
`drawStats` on the `drawScores` scaffold with rows handed in through
`shellview.js`'s existing getter seam. **R3** adds `src/app/daily.js` — a pure
FNV-1a `dailySeed(dateStr)`, `nb.daily.v1`, a MENU row that starts the run
immediately through `_playCore`, and a run-end line that replaces the delta line
on a daily run. **R8** adds `src/app/code.js` — a 12-character `F1` codec with a
checksum, `KeyB` on WIN/LOSE, and `?code=` entry through `flags.js`. **R10**
extends `src/app/coach.js` with `nb.coach.v2` and `coachTip(kind)` composed from
`POWER[].help`, plus one new `drawCoach2` panel wired at **both** draw sites.
`src/core/sim.js` and `src/core/world.js` are untouched everywhere: R3 reaches
the sim only through `world.seed`, which `createWorld`/`loadLevel` already read
(`world.js:15,74-75`).

**Tech Stack:** Pure ES modules, `node --test` / `tests/*.test.mjs`, Canvas 2D
plus vendored three.js r160. Zero npm runtime deps. `src/core` stays DOM-free;
`src/render/` may not import `src/app/` (only `shellview.js` may, for screen
constants); `src/app/` is DOM-free and `Date`-free by construction.

**Spec:** `docs/superpowers/specs/2026-09-07-retention-wave2-design.md` — its
locked values are binding on all five sub-plans. Where a sub-plan and the spec
disagree, the spec wins; where this INDEX's **Shared interfaces** block and a
sub-plan disagree, this block wins.

**Wave-1 interfaces reused, not re-derived:**
`docs/superpowers/plans/2026-09-06-retention-wave1.md` (+ `combo-callouts.md`,
`stopwatch-modes.md`) — the `feedFx` event tap inside `consumeEvents`, the
main-owned PLAY-only `roomT` accumulator, `nb.times.v1` and `timeKey`.

## Global Constraints

Verbatim from the spec (§0, §1, §8), binding on all five sub-plans:

- **Any edit to `src/core/sim.js` or `src/core/world.js`** is refused. R1/R5/R8/
  R10 are app+render layers; R3 reaches the sim only through `world.seed`, which
  `createWorld`/`loadLevel` already read (`world.js:15,74-75`). Replay baseline
  v6 stays untouched.
- **Any scoring change** (combo, time or daily bonuses) is refused. `killEnemy`'s
  table (`sim.js:402-412`) and `CFG.LEVEL_BONUS` are frozen for this wave.
- **Continue-credit / any softening of the LOSE reset** is refused. **D1 = Option
  A** (controller): keep the arcade reset (`startGame` → `loadLevel(world,1,false)`,
  `sim.js:107-111`) and ship R1.
- **Any server, beacon, analytics or account** is refused. Stats leave the device
  **only** through an explicit player keypress.
- **Streak banners, "at risk" copy, welcome-back nags, notifications** are
  refused. This wave ships **no** consecutive-day read.
- **Enforcing one attempt per day** is refused — `localStorage` is the only
  persistence (`store.js:1-7`) and a private window bypasses it.
- **The word `leaderboard`** in shipped code, UI copy, tests or commit messages is
  refused. R8 makes this an executable pin over `src/` and `tests/`; `docs/`
  is deliberately exempt because the report and the spec name the term only to
  refuse it.
- **A score field in the challenge code** is refused — unverifiable without a
  server. Share a challenge, not a claim.
- **Widening `PLAQUE`'s `&15` or `PACT`'s `(p|0)&15`** is refused
  (`plaques.js:5,24`, pinned `mask===15` at `tests/plaques.test.mjs:49-57`;
  `pact.js:1,5` is load-bearing in `highscores.js:33`).
- **`Date` / DOM / `Math.random` anywhere under `src/core`, and `Date` anywhere
  under `src/app`.** Every date in this wave is a **string computed in
  `main.js`** and passed in — the `flags.js:1-3` "pure over a search string"
  template.
- **A fabricated delta** is refused: the delta is computed from persisted numbers
  or it is not shown. That is a rule about the **source** and about the
  **moment** — `isRunEnd` is the one predicate for both.
- **A `window.prompt` / DOM paste box for R8** is refused: `src/app/` is DOM-free
  by construction and `main.js`'s seams must stay out of `main.js`.
- **No duplicate stores.** R7's `nb.times.v1` (`times.js:6`) stays the one best-
  TIMES store; score/progress bests get `nb.bests.v1`, and **STATS reads both
  rather than copying either**.
- **Wave 2 adds exactly four `nb.*` keys** (`nb.bests.v1`, `nb.stats.v1`,
  `nb.daily.v1`, `nb.coach.v2`) and exactly four `src/app/*.js` modules
  (`bests.js`, `stats.js`, `daily.js`, `code.js`).
- **`src/pwa/shell.js`'s `SRC` entry is mandatory, not optional**, for every new
  `src/app/*.js`: `tests/pwa.test.mjs:98-103` walks `src/` and requires every
  `.js` to be in `PRECACHE`, so the suite fails until `shell.js` lists it.
- PWA: bump `CACHE_NAME` (`src/pwa/shell.js:1`) and `REV` (`sw.js:3`)
  **together**, `current vN → vN+1`, in **every commit that changes precached
  bytes**. **Read the current value first — never assume.** It is
  `fusegrid-shell-v116` as this INDEX is written; **v117 is a floor, not a
  target**. Test-only and docs-only commits bump nothing.
- **`tests/headless.test.mjs:909`'s `main.js` line pin gets one bump per plan**,
  in that plan's **first** `main.js`-touching task, to that plan's cap
  (R1 → 760, R5 → 776, R3 → 788, R8 → 798, R10 → 808; re-based +5 on 2026-09-07 after the R1 fix wave landed the pin at 760), each with the file's own
  one-line reason comment appended (`:890-908` convention). **Rule: a plan that
  would exceed its cap moves the excess into its `src/app/*` module, never into
  a higher pin.** Measured today: 732 by `wc -l`. **The pin measures `split("\n").length`, which is `wc -l` + 1 for this trailing-newline file; every cap in this INDEX and in the five plans is in that measure (R1 landed the pin at 760).**
- **Both `drawOverlay` call sites and both `drawCoach2` call sites move in the
  same commit** (`renderer.js:79`/`:90`, `wrapper.js:154`/`:157`). Wave-1 §9.2
  was exactly this bug class: one draw site updated, one not.
- No comments unless the file already uses explanatory block comments (its
  style). `scenes.js`, `menudraw.js`, `menuapp.js`, `shellview.js`, `main.js`
  and every `src/app/*` store all do; match the compact,
  no-whitespace-after-key style already in the codebase.
- **Never write the private reference game's name into any committed file.**
  `tests/banned-name.test.mjs` is a tree-wide gate over `git ls-files`. Public
  copy says "the genre classic".
- **Locate every edit by string, never by line number.**
  `tests/menudraw.test.mjs`, `tests/coach.test.mjs` and `tests/three.test.mjs`
  were uncommitted while the spec was written and landed in `93bb836`; more to
  the point, **the plans in this program move each other's line numbers** — R1
  adds ~22 lines to `main.js` before R5 reads it, R5 and R3 both rewrite the
  same `menuapp.test.mjs` literals, and every plan appends to
  `tests/headless.test.mjs`'s comment block above the line pin. Re-read any file
  before editing it and locate by string. This is wave-1 Resolved-ambiguity 8,
  carried forward.
- Every plan ships with `npm test` green **and** a headed play-verify in both
  CLASSIC 2D and REAL 3D (AGENTS.md: "Visual 3D feel is not covered by Node").

## File map

| File | R1 | R5 | R3 | R8 | R10 |
|---|---|---|---|---|---|
| `src/app/bests.js` | **create** | `newTally`/`feedTally` gain `kt`/`pk`/`dr` | — | — | — |
| `src/app/stats.js` | — | **create** | — | — | — |
| `src/app/daily.js` | — | — | **create** | — | — |
| `src/app/code.js` | — | — | — | **create** | — |
| `src/app/coach.js` | — | — | — | — | `COACH2_*`, `loadCoach2`/`saveCoach2`/`coach2Seen`/`coach2Mark`/`coachTip` |
| `src/app/flags.js` | — | — | — | `code` | — |
| `src/app/menuapp.js` | — | `SCREEN.STATS`, `ITEMS` **stage 1**, `confirm`/`back`, `o.onStats` | `ITEMS` **stage 2**, `startDaily`, `_playCore` `seed`/`daily`, `o.dailySeed`, `app.dailyTag` | `playChallenge(t)` | — |
| `src/render/scenes.js` | `fmtSpan` `runLine` `bestLabel` `deltaLine` `isRunEnd` `summaryLines`, `COPY_HINT`, `drawOverlay` 9th arg | — | `dailyLine`, slot-3 swap | `COPY_HINT` value | `drawCoach2` |
| `src/render/renderer.js` | `o.run` onto `drawOverlay` | — | — | — | `drawCoach2` in the hud block |
| `src/render/three/wrapper.js` | same seam | — | — | — | same seam |
| `src/render/menudraw.js` | — | `drawStats` | — | — | — |
| `src/render/shellview.js` | — | `SCREEN.STATS` route, items literal (7) | items literal (8) + `dailyTag` | — | — |
| `src/main.js` | `tally` `runT` `bestRun` `runEnded`, `startRunState`, `endRun`, split edge block, `feedTally`, `ro.run` | `stat()` edges, `onStats`, `copyText`, `KeyC`-on-STATS | `todayStr`, `args.seed`, `dailyDate`/`dailyRec`, daily write | `?code=` boot, `KeyB` | `coach2T`/`coach2Kind`, `ro.coach2` |
| `src/pwa/shell.js` / `sw.js` | `SRC` += `bests.js`, bump | `SRC` += `stats.js`, bump | `SRC` += `daily.js`, bump | `SRC` += `code.js`, bump | bump |
| `MEMORY.md` | final commit | final commit | final commit | final commit | final commit |

Tests: `tests/bests.test.mjs` (**new**, R1) · `tests/stats.test.mjs` (**new**,
R5) · `tests/daily.test.mjs` (**new**, R3) · `tests/code.test.mjs` (**new**, R8) ·
`tests/coach.test.mjs` (R10 additions) · `tests/menuapp.test.mjs`,
`tests/menudraw.test.mjs`, `tests/headless.test.mjs` (the staged cursor
renegotiation, R5 then R3) · `tests/banned-name.test.mjs` (R8's refusal grep) ·
`tests/pwa.test.mjs` (the four `SRC` entries).

## Shared interfaces

**Every signature below is final. R1/R5/R3/R8/R10 quote these verbatim — if a
sub-plan disagrees with this block, this block wins.**

### Bests store and the event tap — `src/app/bests.js` (R1, extended by R5)

```js
export const BESTS_KEY = "nb.bests.v1";
export const BESTS_MAX = 48;
export function bestKey(world)                   // pure, no store -> "<heat>:<pact>:<pace+1>"
export function clampBests(raw)                  // any input -> {b:{}}; never throws
export function loadBests(store)                 // -> clamped object
export function saveBests(v, store)              // clamps then writes JSON; silent on failure
export function bestOfRun(v, key)                // -> {s, r} | null
export function recordBest(v, key, score, room)  // -> a NEW object; s and r written INDEPENDENTLY
export function newTally()                       // -> the tally shape below
export function feedTally(t, world)              // mutates and returns t; READ-ONLY over world
```

**Shape** — `{ b: { "<key>": { s, r } } }`. `s` = best raw run score (integer
`0..9999999`); `r` = furthest room reached (integer `1..8`). **No `on` flag:** R1
has no toggle.

- `bestKey(world)` = `` `${clampHeat(w.heat)}:${clampPact(w.pact)}:${clampPace(w.pace)+1}` ``
  — `timeKey`'s key minus the level, because a run spans rooms. `pace` is shifted
  `+1` so the segment is `0..2`; the whole key matches
  `KEY_RE = /^[0-2]:(?:[0-9]|1[0-5]):[0-2]$/`.
- `clampBests(raw)` keeps only entries whose key matches `KEY_RE` and whose
  `s`/`r` are finite integers in range; caps at **48**, dropping the **first** in
  insertion order (the key form is non-integer-like, so JS preserves insertion
  order deterministically — the same argument `times.js:41-43` makes).
- `recordBest` writes `s` when there is no prior or `score > prior.s`, and `r`
  when there is no prior or `room > prior.r`, **independently**: a low-score run
  that reached a new room is a real record.

**The tally shape** — R1 ships seven fields; R5 adds three maps to the **same**
object and the **same** loop, so R5 adds zero new per-frame passes:

```js
// R1
{ r:0, k:0, p:0, b:0, d:0, dNew:0, lv:null }
// R5 extends newTally() with, and feedTally() fills:
{ …, kt:{}, pk:{}, dr:{} }   // kills by foe type, pickups by kind, deaths by room
```

`feedTally(t, world)` reads `world.events` and `world.lives` and mutates nothing
on the world (it never touches `world.events.length`):

| event | effect | source |
|---|---|---|
| `{t:"kill", type}` | `t.k++`, `t.kt[type]++` (R5) | `sim.js:412` |
| `{t:"power", kind}` | `t.p++`, `t.pk[kind]++` (R5) | `entities.js:178` |
| `{t:"brick"}` | `t.b++` | `sim.js:387` |
| `{t:"win"}` | `t.r++` — rooms **cleared**, never inferred from `world.level` | `sim.js:85` |
| a **strictly decreasing** `world.lives` | `t.d++`, `t.dNew++`, `t.dr[room]++` (R5) | see below |

**Death is `world.lives` strictly decreasing since the previous call, never
`{t:"hurt"}`:** a shielded hit emits `hurt` without losing a life
(`sim.js:344-348`) while `hurtPlayer` emits the same event when one **is** lost
(`entities.js:194`). `t.dNew` is the count for this frame only (reset at the top
of every call) and `t.lv` seeds itself on the first call, so the `carry.lives`
jump on a new run (`world.js:117`) is an **increase** and never a false death.

### Run summary — `src/render/scenes.js` (R1, extended by R3/R8/R10)

```js
export function fmtSpan(sec)                     // R1; "M:SS", clamped [0,5999] -> 99:59 pins
export function runLine(run)                     // R1
export function bestLabel(world)                 // R1
export function deltaLine(world, run)            // R1; the five locked forms
export function isRunEnd(world)                  // R1; the ONE predicate, display AND persist
export function summaryLines(world, run)         // R1; [[text, col], …]; [] when run is absent
export function dailyLine(world, run)            // R3; REPLACES deltaLine in slot 3
export function drawCoach2(c, alpha, text)       // R10
export function drawOverlay(c, world, w, h, cx, cy, ui, tm, run)   // R1: 9th arg OPTIONAL
```

`fmtSpan(sec)`: clamp to `[0, 5999]`; `s = floor(sec)`; return
`` `${floor(s/60)}:${pad2(s%60)}` ``. Disjoint by construction from `fmtTime`
(`scenes.js:61-69`, clamps at `9:59.9`, its six-char guarantee holds the HUD
width budget) and from `fmtLong` (lifetime, `999h 59m` pin). **Three formatters,
three disjoint ranges, three disjoint consumers; `fmtTime` is not touched.**

`runLine(run)` = `"ROOMS " + r + " · KILLS " + k + " · PICKS " + p + " · " + fmtSpan(t)`
→ `ROOMS 4 · KILLS 27 · PICKS 9 · 12:41`. Bricks are counted but not shown here —
they ride R5's export payload, so no counter is collected and never used.

`bestLabel(world)` names the **exact bucket** the record is kept in:
`HEAT_NAME[clampHeat(w.heat)] + (clampPact(w.pact) ? " · " + pactLabel(w.pact) : "") + (clampPace(w.pace) ? " · " + paceToken(w.pace) : "")`
→ `CORE`, `PLUS · LB · HARD`.

```js
export function isRunEnd(world) {
  const w = world || {};
  return w.state === "LOSE" ||
    (w.state === "WIN" && (isFinale(w.level) || !!w.finale));
}
```

`isFinale` is the **same predicate** `winHeadline` and `overlayCue` already use
(`scenes.js:34,40`), which AGENTS.md requires of anything overlay-facing.

`deltaLine(world, run)` — the five locked forms:

```js
const b = run.best;                       // {s, r} | null
const p = [];
if (!b || (world.level|0) > (b.r|0)) p.push("FURTHEST ROOM YET");
if (!b || (world.score|0) > (b.s|0)) p.push("NEW BEST");
if (p.length) return p.join(" · ");
if ((world.score|0) === (b.s|0)) return "MATCHED YOUR " + bestLabel(world) + " BEST";
return "+" + ((b.s|0) - (world.score|0)) + " FROM YOUR " + bestLabel(world) + " BEST";
```

| # | form | example |
|---|---|---|
| 1 | furthest room, no new score | `FURTHEST ROOM YET` |
| 2 | new score, same depth | `NEW BEST` |
| 3 | both (includes every first-ever run on a bucket) | `FURTHEST ROOM YET · NEW BEST` |
| 4 | exact tie | `MATCHED YOUR CORE BEST` |
| 5 | short of it | `+142 FROM YOUR CORE BEST` |

The `+` is a **gap, never a surplus**: form 5 is only reachable when forms 1–3
did not fire.

**The overlay stack**, laid out from `dy 20` in **24 px** steps (R7's shipped
pitch, `scenes.js:146-148`): `dy` = 20 / 44 / 68 / 92 / 116.

| slot | line | shown when |
|---|---|---|
| 1 | `runStamp(world)` | always (unchanged) |
| 2 | tally line (`runLine`) | always, WIN **and** LOSE, when `run` is present |
| 3 | delta line, or R3's `dailyLine` | **run end only** (`isRunEnd`) |
| 4 | `timeLine(world, tm)` | WIN only, `tm.on` only (R7, unchanged) |
| 5 | cue + `COPY_HINT` | always |

At the **600×520** box `cy = 260` → y = 280…376, inside 520. At the **608×352**
iso box `cy = 188` → y = 208…304, inside 352.

**Colour.** `summaryLines` returns `[text, col]` pairs so the draw never sniffs
strings: tally line `#9fb3d8`; delta line `#37f0d0` (the CLEARED accent) for
forms 1–3 and `#9fb3d8` for forms 4–5. A record highlights **only when a record
actually fell**.

`COPY_HINT` is a module-local constant in `scenes.js`, `" · C copy"` at R1 and
`" · C copy · B board"` after R8, used at all three concatenation sites
(`scenes.js:147,148,152`). `overlayCue` itself is **not** touched, so
`tests/heat.test.mjs:49-69`'s four exact-string pins are unmoved.

### The run render opts — `main.js` (R1, extended by R3/R10)

```js
// R1
run: { r: tally.r, k: tally.k, p: tally.p, t: runT, best: bestRun }
// R3 adds, on the same literal:
run: { …, daily: dailyDate, tries: dailyRec.played, dbest: dailyRec.best }
// R10
coach2: { a: <alpha>, s: <finished tip string> }
```

### Run-state helpers — `src/main.js` (R1)

```js
  let tally = newTally(), runT = 0, bestRun = null, runEnded = true;
  const startRunState = () => {
    tally = newTally(); runT = 0; runEnded = false;
    bestRun = bestOfRun(loadBests(), bestKey(world));
  };
  const endRun = () => {
    if (runEnded) return;
    runEnded = true;
    saveBests(recordBest(loadBests(), bestKey(world), world.score | 0, world.level | 0));
  };
```

`bestRun` is read **once per run** and never re-read until the next run starts.
Because `nb.bests.v1` is only written at the run-end edges it can never read back
its own write, and `world.heat`/`world.pact`/`world.pace` are fixed for the whole
run (`onStart`, `main.js:165-167`), so the key is stable too.

**The split edge block** replaces `main.js:560-567`:

```js
      if (prevSt === "PLAY" && world.state === "WIN") {
        const k = timeKey(world), v = loadTimes();
        bestPrev = bestOf(v, k);                 // captured BEFORE the write
        saveTimes(recordTime(v, k, roomT));
        if (isFinale(world.level)) endRun();     // R1: the finale WIN ends the run
      }
      if ((prevSt === "PLAY" || prevSt === "WIN") && world.state === "LOSE") endRun();
      if ((prevSt === "WIN" || prevSt === "LOSE") && world.state === "PLAY") {
        roomT = 0; bestPrev = null;              // WIN->next room, LOSE->new run
        if (prevSt === "LOSE") startRunState();  // R1: a retry never calls onStart
      }
```

`roomT`/`bestPrev` keep resetting on **both** WIN→PLAY and LOSE→PLAY; `tally`,
`runT`, `bestRun` and `runEnded` reset on **LOSE→PLAY only** — mirroring R7
line-for-line would zero rooms-cleared and run time at every room transition.

`endRun()` is also called from **inside `persistScore()`, above its `score > 0`
guard**, which already runs at all three drop-the-run sites (pause RESTART
`:229`, pause QUIT `:241`, `KeyM` `:336`). One idempotent latch makes the finale
path — which hits both the WIN edge and `persistScore` via `main.js:607-616` —
count once.

### Stats store — `src/app/stats.js` (R5)

```js
export const STATS_KEY = "nb.stats.v1";
export const RING_MAX = 200;
export const EVENTS = ["session_start","room_enter","room_clear","death","win_finale",
                       "run_end","score_set","plaque_unlock","coach_shown","coach_dismissed"];
export function clampStats(raw)                       // any input -> the shape below; never throws
export function loadStats(store)
export function saveStats(v, store)
export function stat(ev, data, today, store)          // the ONE edge fn; read-modify-write
export function setStatsOn(store)                     // sets on:1, once
export function statsRows(v, bests)                   // pure -> nine [label, value] pairs
export function statsNotes(v, daily, today)           // pure -> the note strings
export function statsPayload(v, bests, times, today)  // pure -> the four-line payload
export function fmtLong(sec)                          // pure; "Hh MMm", clamped [0,3599999]
```

**Shape**

```js
{ on: 0|1,
  a: { runs, rooms, deaths, kills, picks, bricks, secs, sessions, first, last },
  d: { "<1..8>": n },            // deaths by room
  k: { "<foe type>": n },        // kills by foe type
  p: { "<power kind>": n },      // pickups by kind
  e: [ { t, y, … }, … ] }        // ring, <=200, oldest dropped, only while on===1
```

`a.first` / `a.last` and every ring entry's `y` are the **date string** `main.js`
computes — never epoch ms. There is no clock-shaped value in the blob and no
formatter is needed to read it in DevTools. Session length is kept **in memory**
and flushed into `a.secs` as whole seconds at each `run_end`.

`stat(ev, data, today, store)` applies that event's aggregate effect **always**
and appends the ring entry **only when `on === 1`**:

| `ev` | aggregate effect | ring entry |
|---|---|---|
| `session_start` | `sessions++`, `first \|\|= today`, `last = today` | `{t,y}` |
| `room_enter` | `last = today` | `{t,y,r,h,pc,pa}` |
| `room_clear` | `rooms++` | `{t,y,r}` |
| `death` | `deaths++`, `d[room]++` | `{t,y,r}` |
| `win_finale` | — | `{t,y}` |
| `run_end` | `runs++`, `kills+=`, `picks+=`, `bricks+=`, `secs+=`, merge `k`/`p`, `last = today` | `{t,y,r,s}` |
| `score_set` | — | `{t,y,h}` |
| `plaque_unlock` | — | `{t,y,b}` one per newly-set bit |
| `coach_shown` | — | `{t,y,v}` |
| `coach_dismissed` | — | `{t,y,v,rn}` |

`run_end` is the **tenth** kind and the one report §5A does not list: the arcade
reset makes the **run** the unit every aggregate counts, and a run can end
without a death (pause → QUIT TO MENU / RESTART, `main.js:230-245`).

`fmtLong(sec)`: clamp to `[0, 3599999]`; `` `${floor(s/3600)}h ${pad2(floor(s/60)%60)}m` ``
→ `0h 00m`, `14h 07m`, `999h 59m`.

**The nine rows** (`statsRows(v, bests)`):

| # | label | value |
|---|---|---|
| 1 | `RUNS` | `a.runs` |
| 2 | `ROOMS CLEARED` | `a.rooms` |
| 3 | `DEATHS` | `a.deaths` |
| 4 | `KILLS` | `a.kills` |
| 5 | `PICKUPS` | `a.picks` |
| 6 | `PLAY TIME` | `fmtLong(a.secs)` |
| 7 | `CORE BEST` | `1840 · R5`, or `—` |
| 8 | `PLUS BEST` | `1840 · R5`, or `—` |
| 9 | `MAX BEST` | `1840 · R5`, or `—` |

Rows 7–9 read `bestOfRun(bests, "<h>:0:1")` — the **plain** bucket (no pact, NORM
pace). Mixing an IRON run into "CORE BEST" would be a unit error.

**The two note lines** (`statsNotes(v, daily, today)`):

- note 1 — `DAILY 2026-09-07 · BEST 1840 · 3 TRIES · YOUR OWN ATTEMPTS ONLY`, or
  `DAILY 2026-09-07 · NOT PLAYED YET` when `daily.date !== today`, or **omitted
  entirely** when `daily` is absent (which is what it is until R3 lands).
- note 2 — `SINCE 2026-08-30 · LAST 2026-09-07 · 42 SESSIONS · BESTS ARE PER HEAT`.

**The payload** (`statsPayload`), four lines:

```
FUSEGRID STATS · 2026-08-30→2026-09-07 · 42 SESSIONS
RUNS 118 · ROOMS 214 · DEATHS 301 · KILLS 4820 · PICKS 913 · BRICKS 7702 · TIME 14h 07m
CORE 1840/R5 · PLUS 2210/R4 · MAX — · CORE BEST TIME 0:38.9
https://hmarzban.github.io/fusegrid/
```

Line 3's time is `bestOf(times, "1:0:0:1")` — room 1 CORE plain — so the payload
**names** R7's store rather than duplicating it. The URL keeps its trailing slash
(AGENTS.md: the no-slash 301 drops the OG tags).

### STATS screen — `src/render/menudraw.js` + `src/app/menuapp.js` (R5)

```js
export function drawStats(c, L, t, ui)   // ui = {rows, notes} — pure output, handed in
// menuapp.js
SCREEN.STATS = 12                        // appended after GUIDE: 11, never inserted
// opt: o.onStats()                      — fired once, when STATS is first pushed
```

`drawStats` is modelled line-for-line on `drawScores` (`menudraw.js:694-837`) and
reaches its data through the same getter seam scores and plaques already use
(`shellview.js:34,122-129`), so `menudraw` still imports nothing from `src/app`.

- `const S = shell(c, L, 480);` `head(c, S, "STATS", "YOUR CABINET");`
- body from `S.headY + 22` to `S.footY - 42`; nine rows; `rowH = (bot-top)/9`;
  label left at `S.ix` in `font(9,"900")` MUTED, value right at `S.ix + S.iw` in
  `font(rowH < 18 ? 11 : 13)` TEXT — `drawScores`' own size rule (`:825`).
  Measured: at 600×520 `S.headY 99.2`, `S.footY 476` ⇒ top 121.2, bot 434,
  `rowH 34.76`; at 608×352 `S.headY 72.32`, `S.footY 308` ⇒ top 94.32, bot 266,
  `rowH 19.08`. Both ≥ 18, so both render at 13 px.
- a 1 px `LINE` rule at `top + 6*rowH`, separating the six lifetime counters from
  the three bests.
- two MUTED `font(10)` note lines at `S.footY - 30` and `S.footY - 16`.
- `foot(c, S, "C COPY MY STATS · ESC BACK");`

### Daily — `src/app/daily.js` (R3)

```js
export const DAILY_KEY = "nb.daily.v1";
export function dailySeed(dateStr)                        // pure; no Date, no store -> uint32
export function clampDaily(raw)                           // any input -> the zero record on failure
export function loadDaily(store)
export function saveDaily(v, store)
export function recordDaily(v, today, score, room, pace)  // -> a NEW record
export function dailyTag(v, today)                        // "NEW" | "PLAYED"
export function dailyStamp(date, level, score)            // the share line
export function finishDaily(today, score, room, pace, store)  // -> { rec, tag } — endRun's one write, one date (Minor-4)
// menuapp.js
startDaily()                                              // MENU only; _playCore + {seed, daily}
// opt: o.dailySeed()                                     — main hands over {seed, date}
// app field: dailyTag (string)
```

```js
export function dailySeed(dateStr) {
  const s = String(dateStr || "");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 3266489917) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
```

**Re-measured in this session, and pinned:** `dailySeed("2026-09-07") === 4119412512`,
`dailySeed("2026-09-08") === 3922720528`, `dailySeed("2026-01-01") === 750118410`,
`dailySeed("") === 2019044825`; **zero collisions across 3650 consecutive dates**
from 2026-01-01, all uint32.

**Record** — `{ date: "YYYY-MM-DD", best: 0..9999999, played: 0..999, room: 1..8, pace: 0..2 }`.
`recordDaily` starts a fresh day when `v.date !== today` (`played:1`,
`best:score`, `room`, `pace: pace+1`), otherwise `played++`,
`best = max(best, score)`, `room = max(room, room)`.

**The run config is pinned**: `{level: 1, heat: 0, pact: 0, pace: 0, seed: dailySeed(today)}`.
Heat changes the roster, pact changes the item count and therefore the rng draw
order, and pace scales player speed without touching the seed — the daily's only
claim is that *your own attempts are comparable to each other*. **Stamped as well
as pinned**: `nb.daily.v1` records the pace it ran at.

```js
export function dailyLine(world, run) {          // scenes.js, R3
  return "DAILY " + run.daily + " · " + paceToken(world.pace) +
         " · TRY " + (run.tries | 0) + " · YOUR BEST " + (run.dbest | 0);
}
export function dailyStamp(date, level, score) { // daily.js, R3
  return "DAILY " + date + " · L" + level + " · " + score +
         " · https://hmarzban.github.io/fusegrid/";
}
```

**The local-date helper is `main.js`'s, and `dateStr()` stays UTC:**

```js
  const todayStr = () => { const d = new Date(), p = (n) => (n < 10 ? "0" + n : "" + n);
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); };
```

`dateStr` (`main.js:58`) stamps the high-score `d` column (`highscores.js:86`);
changing it would re-interpret every already-persisted row.

### Challenge code — `src/app/code.js` (R8)

```js
export const CODE_V = "F1";
export function encodeChallenge(t)   // {seed, heat, pact, pace} -> a 12-char uppercase code
export function decodeChallenge(s)   // -> {seed, heat, pact, pace} | null
// flags.js
code: cm ? cm[1].toUpperCase() : null
// menuapp.js
playChallenge(t)                     // _playCore({level:1, heat, pact, pace, seed})
```

```
cfg    = heat*48 + pact*3 + (pace+1)          // 0..143
body   = "F1" + b36(seed>>>0).padStart(7,"0") + b36(cfg).padStart(2,"0")
check  = b36(sum(body.charCodeAt(i)) % 36)    // 1 char
code   = body + check                          // 12 chars, uppercase
```

`b36(4294967295) === "1Z141Z3"` (7 chars) and `b36(143) === "3Z"`, so neither
field overflows. `decodeChallenge` uppercases and trims, requires
`/^F1[0-9A-Z]{10}$/`, re-computes and compares the checksum, then requires
`seed <= 4294967295` and `cfg <= 143`, returning `null` on any failure.

**Round-trips re-measured in this session, and pinned:**

| tuple | code |
|---|---|
| `{seed:4119412512, heat:0, pact:0, pace:0}` | `F11W4LB1C01E` |
| `{seed:123456789, heat:2, pact:9, pace:1}` | `F1021I3V93H8` |
| `{seed:0, heat:0, pact:0, pace:-1}` | `F1000000000B` |
| `{seed:4294967295, heat:2, pact:15, pace:1}` | `F11Z141Z33Z6` |

`decodeChallenge("F1AAAAAAAAAA") === null` (checksum).

### Coach v2 — `src/app/coach.js` + `src/render/scenes.js` (R10)

**2026-09-07 fix-review note (Minor-3 owner ruling):** `coach2Tick` is blessed
as part of this module's ABI — it stays in `coach.js`, not `main.js`, because
the wave's 808-line `main.js` cap leaves no room for the clock/latch/dismiss
logic it carries. The block below is corrected to match: `coach2Tick`'s real
signature is listed, and `coachTip`'s body carries the `TIPS` guard it needs to
pass its own pin (`coachTip("fire") === ""`; see the R10 task report §1).

```js
export const COACH2_KEY = "nb.coach.v2";
export const COACH2_DUR = 3;             // = COACH_DUR (coach.js:4); one timing rule
export function loadCoach2(store)
export function saveCoach2(v, store)
export function coach2Seen(v, kind)      // kind: "kick" | "throw" | "remote"
export function coach2Mark(v, kind)      // -> a NEW object
export function coachTip(kind) {
  if (TIPS.indexOf(kind) < 0) return "";  // TIPS = ["kick","throw","remote"]
  const d = POWER.find((x) => x.t === kind);
  return d ? d.name + " · " + d.help : "";
}
export function coach2Tick(st, world, v1Open, dt, store)
  // st: the {kind, t} latch main.js owns and passes in by reference;
  // returns [[ev, data], ...] stat rows for main.js to emit via stat()
```

Shape `{ k: 0|1, t: 0|1, r: 0|1 }` — one bit per verb, `1` = already shown.

The three composed strings, printed here so a future `POWER[].help` edit reads as
the copy change it would be:

```
KICK · walk into a bomb to slide it
THROW · Shift+Space tosses a bomb
REMOTE · Q detonates your bombs
```

| verb | shown on | dismissed early by |
|---|---|---|
| KICK | `{t:"power", kind:"kick"}` (`entities.js:178`) | `{t:"kick"}` (`sim.js:155`) |
| THROW | `{t:"power", kind:"throw"}` | `{t:"throw"}` (`sim.js:329`) |
| REMOTE | `{t:"power", kind:"remote"}` | `{t:"remote"}` (`sim.js:185`) |

All six events already exist and all arrive in the batch `feedTally` reads — R10
adds **no** new events and **no** new pass over `world.events`.

`drawCoach2(c, alpha, text)`: centred pill at `x = CFG.COLS*CFG.TILE/2` = **300**,
`y = 130`; `rr(c, x - w/2, y - 13, w, 26, 8)` with `w = text.length * 7.2 + 24`;
`COACH_PANEL` / `COACH_LINE` / `COACH_TEXT` reused, not re-declared;
`globalAlpha = alpha`; `if (!(alpha > 0) || !text) return;` before any ctx call.

## Execution order

**R1 → R5 → R3 → R8 → R10, strictly sequential.**

1. `docs/superpowers/plans/2026-09-07-run-summary.md` — **R1**, 3 tasks. It
   creates `bests.js`, `feedTally`, the run-state helpers and the 9th
   `drawOverlay` argument that the other four build on. Report §6: "**Ship first
   in this wave.**"
2. `docs/superpowers/plans/2026-09-07-stats-screen.md` — **R5**, 4 tasks.
   **Depends on R1** for `feedTally` (extended in place) and `bestOfRun`. It
   settles the menu IA (`ITEMS` **stage 1** + `SCREEN.STATS`) that R3's row then
   slots into; doing it after R3 would mean two consecutive rewrites of the same
   test literals by two authors.
3. `docs/superpowers/plans/2026-09-07-daily-seed.md` — **R3**, 3 tasks.
   **Depends on R1** (the run-end edge that writes `nb.daily.v1`, and slot 3 of
   the summary stack) and on **R5** (STATS note 1 has somewhere to live, and the
   cursor literals are already at stage 1). It owns **stage 2**.
4. `docs/superpowers/plans/2026-09-07-challenge-code.md` — **R8**, 3 tasks.
   **Depends on R3**: it reuses `args.seed`, `_playCore` and `copyText` verbatim.
   Report §6: "Shares R3's seed plumbing — sequence after R3."
5. `docs/superpowers/plans/2026-09-07-coach-v2.md` — **R10**, 3 tasks. Last
   because it is the only item with no dependency on the others, and
   `tests/coach.test.mjs` — the file it edits — is the wave's most recently
   settled test file.

**16 tasks, 16 commits**, of which 15 touch precached bytes (R5's task 2 touches
`menuapp.js` and `shellview.js`, both precached, so it bumps too; only a
hypothetical test-only commit would not).

## Program checklist

- [ ] **R1.1** `src/app/bests.js` + `newTally`/`feedTally` + `tests/bests.test.mjs` (pins 1–5) + the `SRC` entry
- [ ] **R1.2** `fmtSpan` / `runLine` / `bestLabel` / `deltaLine` / `isRunEnd` / `summaryLines` / `COPY_HINT` + `drawOverlay`'s 9th arg + **both** renderer seams (pins 6–11)
- [ ] **R1.3** `startRunState` / `endRun` / the split edge block / `feedTally` / `ro.run` in `main.js` (pin 12 + the §1.1/§1.2/§1.6 regressions) + headed pass
- [ ] **R5.1** `src/app/stats.js` + the `feedTally` extension + `tests/stats.test.mjs` (pins 1–8) + the `SRC` entry
- [ ] **R5.2** `SCREEN.STATS = 12`, `ITEMS` **stage 1** (7 rows), `confirm`/`back`, the shellview items literal, and the **stage-1** cursor renegotiation (pin 9)
- [ ] **R5.3** `statsRows` / `statsNotes` / `menudraw.drawStats` + the `SCREEN.STATS` route (pin 10)
- [ ] **R5.4** `stat()` edges, `onStats`, `copyText`, `KeyC`-on-STATS, `statsPayload` (pin 11) + headed pass
- [ ] **R3.1** `src/app/daily.js` + `tests/daily.test.mjs` (pins 1–6) + the `SRC` entry
- [ ] **R3.2** `ITEMS` **stage 2** (8 rows), `startDaily`, `_playCore`'s `seed`/`daily`, `app.dailyTag`, and the **stage-2** cursor renegotiation (pin 8)
- [ ] **R3.3** `todayStr`, `args.seed`, `dailyDate`/`dailyRec`, the daily write inside `endRun`, `dailyLine` in slot 3, the share stamp, STATS note 1 (pins 7, 9) + headed pass
- [ ] **R8.1** `src/app/code.js` + `tests/code.test.mjs` (pins 1–4) + the `leaderboard` refusal grep (pin 8) + the `SRC` entry
- [ ] **R8.2** `flags.code`, `menuapp.playChallenge`, the `?code=` boot branch (pins 5–7)
- [ ] **R8.3** `KeyB` + the `COPY_HINT` value change (pin 9) + headed two-tab board check
- [ ] **R10.1** `nb.coach.v2` + `coachTip` in `src/app/coach.js` (pins 1, 2)
- [ ] **R10.2** `drawCoach2` + **both** hud-block seams (pin 3)
- [ ] **R10.3** `coach2T` / `coach2Kind` / `ro.coach2` in `main.js` (pins 4–9) + headed three-tip pass

## ABI ledger

Every pin this program moves, and **which single stage owns it**. Five sites are
**staged**: they have one owner *per stage*, the stages are named and ordered,
and **every stage is green on its own commit**. No site has two owners at the
same stage.

| Site | Today | New | Owner |
|---|---|---|---|
| `src/app/bests.js` | — | **new module**: `BESTS_KEY BESTS_MAX bestKey clampBests loadBests saveBests bestOfRun recordBest newTally feedTally` | **R1** |
| `newTally` / `feedTally` shape | — | **stage 1 (R1)** `{r,k,p,b,d,dNew,lv}`; **stage 2 (R5)** `+ {kt,pk,dr}` filled in the same loop | **R1**, then **R5** |
| `src/app/stats.js` | — | **new module**: `STATS_KEY RING_MAX EVENTS clampStats loadStats saveStats stat setStatsOn statsRows statsNotes statsPayload fmtLong` | **R5** |
| `src/app/daily.js` | — | **new module**: `DAILY_KEY dailySeed clampDaily loadDaily saveDaily recordDaily dailyTag dailyStamp finishDaily` | **R3** |
| `src/app/code.js` | — | **new module**: `CODE_V encodeChallenge decodeChallenge` | **R8** |
| `src/pwa/shell.js` `SRC` | 60 entries incl. `src/app/times.js` | **+4**: `bests.js` (R1), `stats.js` (R5), `daily.js` (R3), `code.js` (R8) — **mandatory**, `tests/pwa.test.mjs:98-103` | one entry each |
| `src/pwa/shell.js:1` `CACHE_NAME` + `sw.js:3` `REV` | `fusegrid-shell-v116` **at INDEX time — read it, do not assume** | one paired single-step bump **per precache-touching commit**; **v117 is a floor** | **each commit** |
| `scenes.js` exports | `drawLogo winHeadline overlayCue runStamp copyPayload fmtTime timeLine PAUSE_ROWS PAUSE_ROW_H overlayBox pauseHit drawOverlay updateHud makeHud drawHudChips drawCoach` | **+** `fmtSpan runLine bestLabel deltaLine isRunEnd summaryLines` (R1), `dailyLine` (R3), `drawCoach2` (R10). `runStamp` / `copyPayload` / `fmtTime` / `timeLine` **unchanged** | **R1 / R3 / R10** |
| `scenes.js` imports | `CFG isFinale biomeOf` / `HEAT_*` / `drawIcon` / `rr` / `PROJ` | **+** `pactLabel` (`core/pact.js`), `paceToken` (`core/pace.js`) — both `src/core`, which `render/` may read | **R1** (`pactLabel`, `paceToken`) |
| `scenes.js drawOverlay(c,world,w,h,cx,cy,ui,tm)` | 8 args | `(…, tm, run)` — 9th optional; absent ⇒ **byte-identical**. Stack becomes dy 20/44/68/92/116 | **R1** |
| `scenes.js` `COPY_HINT` | three inline `" · C copy"` at `:147,:148,:152` | **stage 1 (R1)** one module-local constant, same value, three sites; **stage 2 (R8)** the value becomes `" · C copy · B board"`. `overlayCue` untouched | **R1**, then **R8** |
| `summaryLines` slot 3 | — | **stage 1 (R1)** `deltaLine` at run end; **stage 2 (R3)** `dailyLine` **replaces** it when `run.daily` is set | **R1**, then **R3** |
| `main.js` `ro.run` | — | **stage 1 (R1)** `{r,k,p,t,best,fromStart}` (`fromStart` added 2026-09-07, review Minor-3 owner ruling — gates the FURTHEST forms on a room-1 start; absent ⇒ `true`, byte-identical for pre-ruling callers); **stage 2 (R3)** `+ {daily,tries,dbest}` | **R1**, then **R3** |
| `renderer.js:79` | `drawOverlay(ctx, world, B.w, B.h, B.cx, B.cy, o&&o.pause, o&&o.time)` | `…, o&&o.time, o&&o.run)` | **R1** |
| `wrapper.js:154` | `drawOverlay(ovCtx,world,B.w,B.h,B.cx,B.cy,o&&o.pause,o&&o.time)` | `…, o&&o.time, o&&o.run)` — **both sites in the same commit** | **R1** |
| `renderer.js:90` / `wrapper.js:157` hud block | `drawCoach(ctx, (o&&o.coach)||0)` | **+** a `drawCoach2(…)` line after it, same `o.hud===true` gate, **both sites** | **R10** |
| `menuapp.js SCREEN` | 12 values, `GUIDE: 11` | **+** `STATS: 12`, appended (`menuapp.test.mjs:67-74` gains a row; `:44-56` unmoved) | **R5** |
| `menuapp.js ITEMS` | 6 rows: `PLAY, LEVEL SELECT, OPTIONS, GUIDE, HIGH SCORES, SOURCE` | **stage 1 (R5)** 7 rows, `STATS` inserted before `SOURCE`; **stage 2 (R3)** 8 rows, `DAILY` inserted at `[2]`. `confirm()` dispatches by **label** (`menuapp.js:278`), so no runtime index moves | **R5**, then **R3** |
| `tests/menuapp.test.mjs:57-66` | `ITEMS.length===6`, `[0] PLAY`, `[2] OPTIONS`, `[3] GUIDE`, `[5] SOURCE` | **stage 1** `length===7`, `[5] STATS`, `[6] SOURCE`; **stage 2** `length===8`, `[2] DAILY`, `[3] OPTIONS`, `[4] GUIDE`, `[6] STATS`, `[7] SOURCE` | **R5**, then **R3** |
| `tests/menuapp.test.mjs:324-329` dispatch table | `[1,LEVEL] [2,SETTINGS] [3,GUIDE] [4,SCORES]` | **stage 1** `+ [5,STATS]`, others unmoved; **stage 2** `[1,LEVEL] [3,SETTINGS] [4,GUIDE] [5,SCORES] [6,STATS]` | **R5**, then **R3** |
| `tests/menuapp.test.mjs:347-352` | `s.cursor = 5` → SOURCE | **stage 1** `cursor 6`; **stage 2** `cursor 7` | **R5**, then **R3** |
| `tests/menuapp.test.mjs:284,295,675,684-685,697-699,728` | wrap assertions written **against `ITEMS.length`** | **unmoved at both stages** — they are computed, not literal | — |
| `tests/headless.test.mjs:185,196,212,269,279` | `g.app.cursor=2` → OPTIONS, `=3` → GUIDE (index-driven MENU confirms) | **stage 1: unmoved** — R5 inserts at `[5]`, so `[0..4]` do not move. **stage 2 (R3): `2→3` and `3→4`**, comments updated with them | **R3** (stage 2 only) |
| `tests/headless.test.mjs:519,530,592` | `g.app.cursor=4` / `=2`, asserted only as "cursor kept" | **unmoved at both stages** — index-agnostic | — |
| `menuapp.js confirm()/back()` | MENU switch; back-out list `:311-315`; back list `:326-332` | **+** `STATS` in all three (R5); **+** `DAILY` → `startDaily()` in the MENU switch (R3) | **R5**, then **R3** |
| `menuapp.js` new methods / options | `toggleTimeAttack`, `o.onTimeAttack` | **+** `o.onStats` (R5); `startDaily()`, `o.dailySeed`, `app.dailyTag` (R3); `playChallenge(t)` (R8) | **R5 / R3 / R8** |
| `menuapp.js _playCore` args | `{level, heat, pact, pace}` | **+** optional `seed` and `daily`, consumed by `main.js`'s `onStart` only. `startRun()`'s own args **unchanged** — pinned as an absence | **R3** |
| `shellview.js:75-91` MENU `items:` literal | six `ITEMS[i]` entries | **stage 1** seven; **stage 2** eight, with `ITEMS[2] + "\|" + app.dailyTag` | **R5**, then **R3** |
| `shellview.js` screen router | `LEVEL HOWTO ITEMS ENEMIES GUIDE SCORES SETTINGS` | **+** `SCREEN.STATS` → `drawDim(0.72)` + `menudraw.drawStats(c, L, app.subT, ui)` | **R5** |
| `tests/menudraw.test.mjs:105-121` | six-entry `ITEMS[i]` items literal (comment: "real shipped rows") | **stage 1** seven; **stage 2** eight, so the comment stays true | **R5**, then **R3** |
| `tests/menudraw.test.mjs:262-280` | hard-coded six-string items literal | **still passes** (`drawMenu` is generic) but updated at each stage so it keeps mirroring the shipped rows. `:185`'s deliberate three-row literal is **unmoved** | **R5**, then **R3** |
| `menudraw.js` exports | `drawMenu drawLevelSelect drawHowTo drawItemsHelp drawEnemiesHelp drawGuide drawScores drawSettings drawAttractHint drawDim drawFade layout settingsRows settingsGeom settingsHit` | **+** `drawStats(c, L, t, ui)` | **R5** |
| `src/app/flags.js readFlags` | `urlKind autoplay netLocal orbit debug` | **+** `code` | **R8** |
| `src/app/coach.js` | `COACH_KEY COACH_DUR loadCoachSeen saveCoachSeen coachOpen` | **+** `COACH2_KEY COACH2_DUR loadCoach2 saveCoach2 coach2Seen coach2Mark coachTip coach2Tick`; imports `POWER` from `core/entities.js`. `coach2Tick` added 2026-09-07 (fix-review Minor-3 owner ruling) — it was landed but missing from this ledger; the whole v1→v2 clock/latch/dismiss transition lives here, blessed, because `main.js`'s 808-line cap has no room for it | **R10** |
| `src/main.js` | `coachT roomT bestPrev` | **+** `tally runT bestRun runEnded runFromStart` (R1); `copyText` (R5); `todayStr dailyDate dailyRec` (R3); `coach2` (R10, one `{kind, t}` object — **not** the two scalars `coach2T`/`coach2Kind` this row originally said; corrected 2026-09-07, fix-review Minor-3 — `main.js` owns the object and calls `coach2Tick(coach2, world, v1Open, dt)` (in `coach.js`; `store` is not threaded through — it defaults to `defaultStore()`) every GAME frame to advance/dismiss/latch it, then reads `coach2.kind`/`coach2.t` to build `ro.coach2`); `startRunState`/`endRun` and the split edge block (R1); `isFinale` on the `CFG` import (R1) | **per plan** |
| `tests/headless.test.mjs:909` | `main.js stays a lean browser entry (<=733 lines)`, measured 732 | **R1 → 760, R5 → 776, R3 → 788, R8 → 798, R10 → 808**, one bump per plan in that plan's **first** `main.js`-touching task, each with its own reason comment | **each plan, once** |
| `tests/heat.test.mjs:325-335` (WIN branch) | `texts.some(s => s.indexOf("CLEARED") >= 0)` | **unmoved** — the 9th arg defaults `undefined` ⇒ today's layout | — |
| `tests/heat.test.mjs:49-82` | `overlayCue` × 4 and `runStamp` / `copyPayload` exact strings | **unmoved** — R8 changes only `drawOverlay`'s concatenation | — |
| `tests/times.test.mjs` `timeLine` / `drawOverlay` pins | 8-arg calls | **unmoved**; the `timeLine` slot moves from dy 44 to dy 68 on a mid-room WIN, and both pins are string-presence pins, not position pins | — |
| `tests/three.test.mjs:1408-1420`, `tests/pickups.test.mjs:465-478` | `drawHudChips(rec, world)` | **unmoved** — `drawHudChips` is not touched by wave 2 | — |
| `tests/menudraw.test.mjs:821-827` | regex over `main.js`'s `drawShell(…)` call | **unmoved** — `drawShell`'s arg list does not change (STATS rows ride `app`) | — |
| `tests/banned-name.test.mjs` | tree-wide reference-game name gate | **+** a case-insensitive `leaderboard` assertion over the same `git ls-files` walk, **scoped to `src/` and `tests/`** | **R8** |
| New test files | — | `tests/bests.test.mjs` (12 pins), `tests/stats.test.mjs` (11), `tests/daily.test.mjs` (9), `tests/code.test.mjs` (9) | **R1 / R5 / R3 / R8** |
| `tests/coach.test.mjs` | v1 pins | **+** 9 pins | **R10** |
| `MEMORY.md` | — | one dated entry per plan, in that plan's final commit | **each** |

### Kept pins — do not touch

- `src/core/sim.js` and `src/core/world.js` in full. `startGame`'s arcade reset
  (`sim.js:107-111`) is **D1 = Option A** and is the thing R1 exists to make
  survivable, not to soften.
- `scenes.js:61-69` `fmtTime` — its six-character guarantee holds R7's HUD width
  budget. Wave 2 adds two formatters beside it and edits none of it.
- `scenes.js:38-47` `overlayCue` — four exact-string pins at
  `tests/heat.test.mjs:49-69`. R8 changes the **concatenation** in `drawOverlay`,
  never the cue.
- `src/core/pact.js` and `src/core/pace.js` in full — `pactLabel` and `paceToken`
  are **read** by `scenes.js`, never edited.
- `tests/plaques.test.mjs:49-57` — `PLAQUE` mask `=== 15` round-trip.
- `menuapp.js:27`'s own rule: `SCREEN` values are **appended, never inserted**.
- `highscores.js:99-101` `qualifies` — R5's `score_set` event is gated on it, not
  on "a score was persisted": `recordScore` slices to 10 (`:68-77`), so a persist
  is not a landed row.
- `heat.js:23` — room 1's roster. Untouched by this wave.

## Resolved ambiguities

1. **`bestRun` is a run-start snapshot, not R7's "captured before the write".**
   R7's `bestPrev` works because a *time* record is per-room: capture, write,
   draw, reset next room. A *score/room* record is per-**run** and the overlay
   draws on every room's WIN, so the same trick would re-snapshot mid-run and the
   room-4 overlay would compare against a record the room-3 overlay had already
   moved. `bestRun = bestOfRun(loadBests(), bestKey(world))` is read **once per
   run**. Pinned as a regression, not described in prose (R1 pin 12).
2. **The LOSE→PLAY edge is a run start, and R7's reset block is split rather than
   mirrored.** `startGame` runs **inside** `step()` on the LOSE screen's fire
   edge (`sim.js:67-74` → `:107-111`); `onStart` is not involved. Run state reset
   only in `onStart`/RESTART goes stale on every retry, and `runEnded` would
   never clear either. Mirroring R7 line-for-line would instead zero
   rooms-cleared and run time at **every room transition** — hence the split, not
   a mirror.
3. **Three formatters, not one.** `fmtTime` pins at `9:59.9` (a run is 4–13
   minutes) and one wider replacement would pin STATS' lifetime `PLAY TIME` at
   `99:59` after 100 minutes. `fmtSpan` (render-side, `[0,5999]`) and `fmtLong`
   (app-side, `[0,3599999]`) have disjoint ranges **and** disjoint consumers, and
   neither touches `fmtTime`.
4. **The delta line is run-end only, and the display edge is the persist edge.**
   A mid-room `NEW BEST` claims a record that has not been written and that a
   later death can still take back. One predicate, `isRunEnd`, checkable in one
   place, reusing the `isFinale` predicate AGENTS.md requires of overlay code.
5. **`ro.run` is staged.** R1 ships `{r, k, p, t, best}` — `dailyDate` and
   `dailyRec` do not exist at R1, and inventing `null`/`0` placeholders for them
   would be exactly the kind of dead field this wave's own tally rule forbids.
   R3 adds `{daily, tries, dbest}` on the same literal. `tests/bests.test.mjs`
   pin 10 is written against the R1 shape and is **not** re-written by R3 —
   `summaryLines` on a non-daily run behaves identically at both stages.
6. **`statsPayload` takes four arguments, not the spec §3.5 snippet's three.**
   Spec §3.2 declares it **pure** and §3.5's line 3 reads
   `bestOf(loadTimes(), "1:0:0:1")`. Those cannot both hold with three arguments:
   a `loadTimes()` inside the function is a store read. Purity is the load-bearing
   property — it is what makes the payload pinnable without a store and what
   every other pure exporter in this wave shares — so `main.js` hands the times
   blob in: `statsPayload(loadStats(), loadBests(), loadTimes(), dateStr())`.
   The arity change is cosmetic; the purity is not.
7. **`stat(ev, data, today, store)` takes a trailing optional `store`.** Spec
   §3.2's signature omits it, but `stat` is a read-modify-write of one key — the
   same shape as `saveTimes(recordTime(loadTimes(), …), store)` — and every store
   function in `src/app/` takes an injectable trailing `store` so the tests can
   drive it through `mapStore()`. Defaults to `defaultStore()`, so `main.js`'s
   call sites read exactly as the spec writes them.
8. **`clampDaily` is exported even though spec §7's module list omits it.** Every
   other store in the family exports its clamp (`clampTimes`, `clampStats`,
   `clampSettings`) and `tests/daily.test.mjs` pin 3 drives it directly. Listed
   in the ledger so the addition is a decision, not a slip.
9. **`COPY_HINT` is module-local in `scenes.js`, not exported.** `render/`'s other
   copy constants (`COACH_PANEL`, `PAUSE_ROWS`' colours) are module-local, and no
   test pins the concatenation today (`grep -rn "C copy" tests/` is empty). It is
   pinned through `drawOverlay`'s recorded `fillText` list instead, which is what
   a player actually sees.
10. **The menu-cursor renegotiation is staged twice, and the two stages are not
    symmetric.** R5 inserts `STATS` **before `SOURCE`**, so indices `[0..4]` do
    not move and `tests/headless.test.mjs`'s five index-driven MENU confirms
    (`:185,:196,:212,:269,:279`) stay green with **no** edit at stage 1. R3
    inserts `DAILY` at `[2]`, which moves OPTIONS `2→3` and GUIDE `3→4`, so those
    five headless lines **must** be renegotiated in R3's stage-2 commit or the
    suite lands red. Every wrap assertion is written against `ITEMS.length` and
    is unmoved at both stages. This is stated here because a single-owner check
    that only looked at `menuapp.test.mjs` would have missed the headless file
    entirely.
11. **`sw.js`'s REV and `CACHE_NAME` are read at commit time, and v117 is a
    floor.** AGENTS.md ties the bump to shipped bytes, which change at 15 of the
    16 commits here; other sessions bump the same two lines.
12. **Commits are per task.** The spec's "five plans, five (or more) commits"
    reads as *five shipped items*; the binding house format gives every task its
    own FAIL → implement → PASS → commit cycle, as every plan in
    `docs/superpowers/plans/` already does.

## Open owner questions this program does not answer

Deliberately: report §7.4 (how sparse the R6 medal set should be) and §7.5
(whether the consecutive-day read ships at all). Both belong to wave 3; this
program ships **no** consecutive-day read and **no** medal.
