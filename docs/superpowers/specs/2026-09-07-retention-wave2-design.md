# Fusegrid — retention wave 2, binding design (2026-09-07)

Binding spec for the five wave-2 items of
`docs/superpowers/specs/2026-09-06-retention-report.md` §6, in the controller's
order: **R1** (run summary + per-heat bests + truthful delta-to-best),
**R5** (opt-in STATS screen over `nb.stats.v1`), **R3** (honest single-device
daily seeded challenge), **R8** (score-free challenge code), **R10** (coach v2
contextual tips).

Every value below is quoted from a `file:line` in this tree or is a design pick
stated as one. There are no TBDs. Public copy never names the private reference
game — "the genre classic" throughout (`tests/banned-name.test.mjs` is a
tree-wide gate over `git ls-files`).

**Controller rulings this spec is built on** (binding, not re-argued here):

- **D1 = Option A.** Keep the arcade reset (`startGame` → `loadLevel(world,1,false)`,
  `src/core/sim.js:107-111`) and ship R1. Continue-credit is refused (§0).
- **Appended `SCREEN`s are permitted** (report §3, "the SCREEN question").
  **STATS is `SCREEN.STATS = 12`**, appended after `GUIDE: 11`
  (`src/app/menuapp.js:16-29`). The WIN/LOSE run summary is **not** a SCREEN —
  it draws inside `drawOverlay`'s existing branches (`src/render/scenes.js:139-152`).
- **The daily challenge is honour-system, single-device.** Enforcement of
  one-attempt-per-day is refused (report Appendix, "Reject as described").
- **The challenge code carries seed/heat/pact/pace only** — never a score, never
  the word "leaderboard" (report §4 R8).
- **No duplicate stores.** R7's `nb.times.v1` (`src/app/times.js:6`) stays the
  one best-TIMES store; score/progress bests get their own key
  (`nb.bests.v1`, §2.2) and **STATS reads both rather than copying either** (§3.3).
- **Ship order R1 → R5 → R3 → R8 → R10** (§8).

**Scope.** Five plans, five (or more) commits. Wave 2 adds **four** `nb.*` keys
(`nb.bests.v1`, `nb.stats.v1`, `nb.daily.v1`, `nb.coach.v2`) and **four**
`src/app/*.js` modules (`bests.js`, `stats.js`, `daily.js`, `code.js`) — matching
the report's own wave-2 budget (report §6, "wave 2 adds up to four").

---

## 0. Refusals — hard gates, not preferences

| Refused | Why, sourced |
|---|---|
| Any edit to `src/core/sim.js` or `src/core/world.js` | R1/R5/R8/R10 are app+render layers; R3 reaches the sim only through `world.seed`, which `createWorld`/`loadLevel` already read (`world.js:15,74-75`). Replay baseline v6 stays untouched |
| Any scoring change (combo, time or daily bonuses) | report §4 R2 appendix: "**Reject** as a scoring change"; `killEnemy`'s table (`sim.js:402-412`) and `CFG.LEVEL_BONUS` are frozen for this wave |
| Continue-credit / any softening of the LOSE reset | **D1 = Option A** (controller). `end-screen.md:5` named the decision; report §4 D1 recommends A + R1 |
| Any server, beacon, analytics or account | AGENTS.md "single-player"; `src/net/transport.js:49-51`; report §5F. Stats leave the device **only** through an explicit player keypress (§3.5) |
| Streak banners, "at risk" copy, welcome-back nags, notifications | report §3 "What we refuse"; §4 R12 declines even the MENU banner. R12 is wave 3 and this spec ships **no** consecutive-day read |
| Enforcing one attempt per day | `localStorage` is the only persistence (`src/app/store.js:1-7`); a private window bypasses it. report Appendix marks it infeasible-as-described |
| The word **leaderboard** in shipped code, UI copy, tests or commit messages (this file and the report name the term only to refuse it) | report §4 R8: "Never ship the word 'leaderboard' on this feature" |
| A score field in the challenge code | report §4 R8: unverifiable without a server. "Share a challenge, not a claim" |
| Widening `PLAQUE`'s `&15` or `PACT`'s `(p\|0)&15` | `plaques.js:5,24` (pinned `mask===15`, `tests/plaques.test.mjs:49-57`); `pact.js:1,5` is full and load-bearing in `highscores.js:33` |
| `Date` / DOM / `Math.random` anywhere under `src/core`, and `Date` anywhere under `src/app` | AGENTS.md Conventions. **Every date in this wave is a string computed in `main.js` and passed in** — the `flags.js` "pure over a search string" template (`src/app/flags.js:1-3`) |
| A fabricated delta | report §4 R1: "**the delta is computed from persisted numbers or it is not shown**". §2.4 turns this into a display-time rule as well as a source rule |
| A `window.prompt`/DOM paste box for R8 | `src/app/` is DOM-free by construction and `main.js`'s seams must stay out of `main.js` (AGENTS.md). §5.3 |

---

## 1. Corrections to the brief — six places where the code forced a different lock

Stated up front so a reviewer sees each deviation as a decision, not a slip.

### 1.1 `bestPrev` cannot be "captured before the write" — it is a **run-start snapshot**

R7's `bestPrev` (`src/main.js:135`, written at `main.js:560-564`) works because a
*time* record is per-room: capture, write, draw, reset next room. A *score/room*
record is per-**run** and the overlay is drawn on every room's WIN, so the same
trick would re-snapshot mid-run and the room-4 overlay would compare against a
record the room-3 overlay had already moved.

**Lock: `bestRun` is read once per run** — `bestOfRun(loadBests(), bestKey(world))`
— at run start, and never re-read until the next run starts. It is stable across
every room of the run, and because `nb.bests.v1` is only written at the run-end
edges (§2.3) it can never read back its own write either. `world.heat` /
`world.pact` / `world.pace` are fixed for the whole run (they are set once in
`onStart`, `main.js:165-167`; AGENTS.md keeps mid-run heat parked), so the key is
stable too.

### 1.2 A retry never calls `onStart` — resetting run state there alone is a truthfulness bug

`startGame` runs **inside** `step()` on the LOSE screen's fire edge
(`sim.js:67-74` → `:107-111`). `main.js`'s `onStart` is not involved. Run state
reset only in `onStart` / RESTART therefore goes stale on every retry: run 1
writes best *B* at its LOSE edge, run 2 still holds the pre-run-1 snapshot *A*,
and any run-2 score in `(A, B)` falsely prints `NEW BEST`.

**Lock: the LOSE→PLAY edge is a run start.** R7's existing reset block
(`main.js:565-567`) is **split**, not mirrored: `roomT`/`bestPrev` keep resetting
on **both** WIN→PLAY and LOSE→PLAY (a new room and a new run both restart the
room clock), while `tally` / `runT` / `bestRun` / `runEnded` reset on
**LOSE→PLAY only** — mirroring R7 line-for-line would zero rooms-cleared and run
time at every room transition. Exact code in §2.3.

### 1.3 `fmtTime` cannot format a run — and one new formatter cannot format both a run and a lifetime

`fmtTime` (`scenes.js:61-69`) clamps to `599.9 s` = `9:59.9` by design (its
six-character guarantee is what holds R7's HUD width budget,
`scenes.js:57-60`). A first finale run is "≈4–8 min", a veteran run "≈7–13 min"
(report §2) — so a run total would silently pin at `9:59.9`.

A single wider formatter does not solve it either: STATS' lifetime `PLAY TIME`
crosses `99:59` after 100 minutes and would pin forever. **Lock: two new
formatters with disjoint ranges**, each pinned, neither touching `fmtTime`:

- `fmtSpan(sec)` (`scenes.js`, render-side, used by the run summary) →
  `M:SS`, clamped `[0, 5999]` s, so `99:59` is the pin. Disclosed: a run left
  idling in PLAY past 100 minutes pins there.
- `fmtLong(sec)` (`src/app/stats.js`, app-side, used by STATS) →
  `` `${h}h ${pad2(m)}m` ``, clamped `[0, 3599999]` s, so `999h 59m` is the pin.

### 1.4 The ring buffer records **one edge kind §5A does not list**

Report §5A lists nine event kinds. The arcade reset (D1) makes the **run** the
unit every aggregate counts, and a run can end without a death (pause → QUIT TO
MENU / RESTART, `main.js:230-245`). **Lock: a tenth kind, `run_end`**, and the
aggregate `runs` counter increments there. Nothing else is added to §5A's list.

### 1.5 R10's tip copy is **not new copy**

`POWER` already ships one-line help for exactly the three verbs
(`entities.js:53-105`): `"walk into a bomb to slide it"`, `"Shift+Space tosses a
bomb"`, `"Q detonates your bombs"` — and those strings are already on the ITEMS
help screen (`menudraw.js:510`). Writing three new strings would create a second
source that drifts. **Lock: `coachTip(kind)` in `src/app/coach.js` composes
`name + " · " + help` from `POWER`**, and `main.js` passes the finished string
down exactly as it already passes the coach's fade alpha — `scenes.js:287-296`
states that rule in its own words ("main.js precomputes … this file never
re-derives it"), so the tip must not be derived in `render/`.

### 1.6 `endRun` also fires where `persistScore` already does

A run that ends by quitting is a run that ended. `persistScore()`
(`main.js:309-312`) is already called at all three drop-the-run sites (pause
RESTART `:230`, pause QUIT `:241`, `KeyM` `:336`). **Lock: `endRun()` is called
from inside `persistScore()`, above its `score > 0` guard**, plus the two sim
edges (§2.3). One idempotent latch (`runEnded`) makes the finale path — which
hits both the WIN edge and `persistScore` via `main.js:607-616` — count once.

---

## 2. R1 — run summary, per-heat bests, truthful delta-to-best

**Files:** new `src/app/bests.js`, new `tests/bests.test.mjs`; edits to
`src/render/scenes.js`, `src/render/renderer.js`, `src/render/three/wrapper.js`,
`src/main.js`, `src/pwa/shell.js` + `sw.js`.

### 2.1 What "best" means, and why not `nb.highscores.v1`

`nb.highscores.v1` cannot be the comparison target. Three reasons from the file:

1. It stores `heatScore(world.score, t)` — the **×1/×2/×3 persist-only multiple**
   (`highscores.js:85`), not the raw run score the HUD and `runStamp` show
   (`scenes.js:52`). A delta against it would be arithmetic on two different units.
2. It is a **single 10-row list across all heats**, sliced to 10 on every write
   (`highscores.js:68-77`) and filtered per tab only at draw time
   (`scoresForHeat`, `:93-97`). A player's CORE best can be evicted by three MAX runs.
3. On CORE it ships **pre-seeded down to 250** (`DEFAULT_SCORES`, `:6-19`), so
   "your best" would be a number the player never scored — exactly the fabricated
   delta §0 refuses. This is report §2 G1's own finding.

**Lock: a new `nb.bests.v1`**, keyed the way `timeKey` is keyed minus the level
(`times.js:20-31`) — because a run spans rooms, the level cannot be in the key,
while heat / pact / pace all change what the run **is** (`heatRoster`,
`heat.js:102-113`; `applyPact`, `pact.js:20-26`; `paceMul` inside `updatePlayer`,
`sim.js:124`, and pace is **not** folded into rng seeding, `world.js:15,74`).

### 2.2 `src/app/bests.js`

Built from the `load*/save*(store)` template shared by `pactstore.js` /
`plaques.js` / `pacestore.js` / `cabinetseen.js` / `coach.js` / `settings.js` /
`times.js`: try/catch, injectable `store`, one key.

```
BESTS_KEY = "nb.bests.v1"
BESTS_MAX = 48
KEY_RE    = /^[0-2]:(?:[0-9]|1[0-5]):[0-2]$/
```

- **`bestKey(world)`** (pure, no store) =
  `` `${clampHeat(w.heat)}:${clampPact(w.pact)}:${clampPace(w.pace)+1}` `` —
  `pace` shifted `+1` so the segment is `0..2`, exactly as `timeKey` does
  (`times.js:29`).
- **Shape** `{ b: { "<key>": { s, r } } }` — `s` = best raw run score
  (integer `0..9999999`), `r` = furthest room reached (integer `1..8`).
  No `on` flag: R1 has no toggle.
- **`clampBests(raw)`** keeps only entries whose key matches `KEY_RE` and whose
  `s`/`r` are finite integers in range; caps at **48** entries, dropping the
  **first** in insertion order (the key form is non-integer-like, so JS preserves
  insertion order deterministically — the same argument `times.js:41-43` makes).
  48 is 1/3 of the 144 reachable `{heat,pact,pace}` combinations and ~16× the set
  a real player uses; the whole blob stays under ~2 KB.
- **`bestOfRun(v, key)`** → `{s, r}` or `null`.
- **`recordBest(v, key, score, room)`** → a **new** object. `s` and `r` are
  written **independently**: `s` when there is no prior or `score > prior.s`,
  `r` when there is no prior or `room > prior.r`. Independence is the point — a
  low-score run that reached a new room is a real record, and pinning them
  together would hide one behind the other.
- **`newTally()`** → `{ r:0, k:0, p:0, b:0, d:0, dNew:0, lv:null }`
  (rooms cleared, kills, pickups, bricks, deaths, deaths-this-frame, last-seen lives).
- **`feedTally(t, world)`** → mutates and returns `t`. Pure w.r.t. `world`
  (read-only; it never touches `world.events.length`):
  - `{t:"kill"}` → `t.k++` (carries `type`, `sim.js:412`)
  - `{t:"power"}` → `t.p++` (carries `kind`, `entities.js:178`)
  - `{t:"brick"}` → `t.b++` (`sim.js:387`)
  - `{t:"win"}` → `t.r++` (`sim.js:85` — one per room cleared, so "rooms cleared"
    is counted, never inferred from `world.level`, which a LEVEL SELECT start at
    room 5 would falsify)
  - **death** = `world.lives` strictly **decreasing** since the previous call.
    `{t:"hurt"}` cannot be used: a shielded hit emits `hurt` without losing a life
    (`sim.js:344-348`) while `hurtPlayer` emits the same event when one is lost
    (`entities.js:194`). `t.dNew` is the count for this frame only (reset at the
    top of every call) and `t.lv` seeds itself on the first call, so the
    `carry.lives` jump on a new run (`world.js:117`) is an increase and never a
    false death.

  R5 extends this one function with `kt` / `pk` / `dr` maps (§3.2); R1 ships the
  six counters it displays plus the two bookkeeping fields.

### 2.3 The persist edge and the run-state resets — `src/main.js`, verbatim

`prevSt` is latched at `main.js:568`, **before** the step loop at `:580-593`, so
every edge below is evaluated on the frame after the step that set the state.

```
  /* R1: one idempotent end-of-run write. Called from BOTH sim edges below and
     from persistScore(), which already runs at all three drop-the-run sites
     (pause RESTART / QUIT TO MENU / KeyM) — a quit run is a run that ended. */
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

`onStart` (`main.js:164-181`) gains `startRunState();` after the heat/pact/pace
writes (it reads `bestKey(world)`, so it must run after them) and after
`loadLevel`. The pause RESTART branch (`main.js:227-239`) gains the same call —
**after** its existing `persistScore()` line, never before: `persistScore` carries
`endRun`, and reversing the two would drop the write.

The edge block replaces `main.js:560-567`:

```
      if (prevSt === "PLAY" && world.state === "WIN") {
        const k = timeKey(world), v = loadTimes();
        bestPrev = bestOf(v, k);                 // captured BEFORE the write
        saveTimes(recordTime(v, k, roomT));
        if (isFinale(world.level)) endRun();     // R1: the finale WIN ends the run
      }
      if ((prevSt === "PLAY" || prevSt === "WIN") && world.state === "LOSE") endRun();
      if ((prevSt === "WIN" || prevSt === "LOSE") && world.state === "PLAY") {
        roomT = 0; bestPrev = null;              // WIN->next room, LOSE->new run
        if (prevSt === "LOSE") startRunState();  // R1 §1.2: a retry never calls onStart
      }
```

`isFinale` is added to `main.js:6`'s existing `import { CFG }` — the **same
predicate** `winHeadline` and `overlayCue` use (`scenes.js:34,40`), which
AGENTS.md requires of anything overlay-facing.

**Not a persist edge: a mid-room WIN.** The run is still alive; its score can
still fall (`CFG.DEATH_PENALTY`, `entities.js:187`) and its room can still rise.

The run clock joins the existing PLAY-only line (`main.js:577-578`, two lines
become one):

```
      if (world.state === "PLAY") { coachT += dt; roomT += dt; runT += dt; }
```

The tally is fed at the one non-destructive read `main.js` already performs,
beside the coach latch (`main.js:594-606`) — after the step loop, before
`renderer.render` drains `world.events` (`renderer.js:34-41`):

```
      feedTally(tally, world);
```

`roomT`'s device-dependence disclosure (wave-1 §3.1) applies verbatim to `runT`:
it accumulates the same clamped RAF `dt`, so a machine that trips the
`steps > 6` anti-spiral cap (`main.js:589-592`) burns wall-clock the sim never
sees. R1 adds no new risk, it makes the same clock visible.

### 2.4 The summary block — exact lines, order, format

`drawOverlay` gains a **9th optional argument `run`**; absent ⇒ **byte-identical
to today**, which is what keeps `tests/heat.test.mjs:325-335` (the WIN branch
pin) and every `drawOverlay(…)` call in `tests/times.test.mjs` unmoved. The
argument is `main.js`'s `ro.run`:

```
              run: { r: tally.r, k: tally.k, p: tally.p, t: runT, best: bestRun,
                     daily: dailyDate, tries: dailyRec.played, dbest: dailyRec.best },
```

(`daily` / `tries` / `dbest` are R3's, §4.4; they are `null`/`0` until R3 lands.)

**The stack.** Lines are laid out from `dy 20` in **24 px** steps — R7's shipped
pitch (`scenes.js:146-148`) — and each present line takes the next slot:

| slot | line | shown when |
|---|---|---|
| 1 | `runStamp(world)` | always (unchanged, `scenes.js:48-53`) |
| 2 | **tally line** | always, WIN **and** LOSE, when `run` is present |
| 3 | **delta line** (or R3's daily line) | **run end only**: LOSE, or WIN at the finale |
| 4 | `timeLine(world, tm)` | WIN only, `tm.on` only (R7, unchanged) |
| 5 | cue + copy hints | always |

`dy` = 20 / 44 / 68 / 92 / 116. At the **600×520** box `cy = 260`
(`overlayBox`, `scenes.js:97-103`) → y = 280…376, inside 520. At the **608×352**
iso box `cy = 188` → y = 208…304, inside 352. Worst case (finale WIN with TIME
ATTACK on) is all five lines.

**Why the delta line is run-end only.** Report §4 R1's hard rule is that the
delta comes from persisted numbers; this is that rule applied to the *moment*.
A mid-room `NEW BEST` claims a record that has not been written and that a later
death can still take back, and repeating it on rooms 3, 4 and 5 cheapens the one
line the whole feature exists for. The display edge and the persist edge (§2.3)
are therefore **the same edge** — one predicate, checkable in one place:

```
export function isRunEnd(world) {
  const w = world || {};
  return w.state === "LOSE" ||
    (w.state === "WIN" && (isFinale(w.level) || !!w.finale));
}
```

**New pure exports in `scenes.js`, all pinned:**

```
fmtSpan(sec)                 // §1.3
runLine(run)                 // "ROOMS 4 · KILLS 27 · PICKS 9 · 12:41"
bestLabel(world)             // "CORE" | "PLUS · LB" | "MAX · L · HARD"
deltaLine(world, run)        // the five forms below
isRunEnd(world)
summaryLines(world, run)     // [[text, col], …] — [] when run is absent
```

`bestLabel` names the **exact bucket** the record is kept in, so the sentence can
never be read against the wrong record:
`HEAT_NAME[clampHeat(w.heat)]` (`heat.js`, already imported at `scenes.js:2`)
`+ (clampPact(w.pact) ? " · " + pactLabel(w.pact) : "")`
`+ (clampPace(w.pace) ? " · " + paceToken(w.pace) : "")`.
`pactLabel` (`pact.js:9-18`) and `paceToken` (`pace.js:14-16`) are new imports in
`scenes.js`; both are `src/core`, which `render/` may read.

**`deltaLine` — the locked copy set (five forms):**

```
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
did not fire, i.e. when the run fell short. Worst-case width is form 5 at a full
bucket — `+1234567 FROM YOUR PLUS · LBTS · HARD BEST`, 42 chars at the 15 px
mono `sub()` face (`scenes.js:134-138`, ≈0.6 em ⇒ 9 px/char) = 378 px, inside
both boxes.

**`runLine(run)`** = `"ROOMS " + r + " · KILLS " + k + " · PICKS " + p + " · " + fmtSpan(t)`.
Bricks (`tally.b`) are counted but not shown here — they ride R5's export
payload (§3.5), so no counter is collected and never used.

**Colour.** `summaryLines` returns `[text, col]` pairs so the draw never sniffs
strings: the tally line is `#9fb3d8` (the muted `sub()` default the runStamp
already uses); the delta line is `#37f0d0` (the CLEARED accent, `scenes.js:140`)
for forms 1–3 and `#9fb3d8` for forms 4–5. A record highlights **only when a
record actually fell** — the same honesty rule in pixels.

**The WIN branch becomes** (LOSE identical minus the `timeLine` slot):

```
    head(winHeadline(world), "#37f0d0");
    let dy = 20;
    sub(runStamp(world), "#9fb3d8", dy);
    for (const [s, col] of summaryLines(world, run)) sub(s, col, (dy += 24));
    if (tm && tm.on) sub(timeLine(world, tm), "#9fb3d8", (dy += 24));
    sub(overlayCue(world) + COPY_HINT, "#9fb3d8", (dy += 24));
```

With `run` and `tm` both absent this emits `dy 20` then `dy 44` — today's two
lines, at today's positions, exactly.

`COPY_HINT` is `" · C copy"` until R8 changes it to `" · C copy · B board"`
(§5.4). No test pins that concatenation (`grep -rn "C copy" tests/` is empty);
it is listed in the ABI table as a copy change.

### 2.5 Pins — `tests/bests.test.mjs` (new) + additions

1. `bestKey` over `{heat:1,pact:5,pace:-1}` === `"1:5:0"`; junk heat/pact/pace
   clamp through `clampHeat`/`clampPact`/`clampPace`.
2. `clampBests` drops a bad key, a non-integer `s`, `r:0`, `r:9`, `s:-1`; caps at
   48 dropping the first inserted.
3. `recordBest` writes on no-prior; raises `s` alone on a higher score at the
   same room; raises `r` alone on a deeper room at a lower score; writes neither
   on equal-or-worse.
4. `loadBests`/`saveBests` round-trip through a `mapStore()`
   (`tests/plaques.test.mjs:20-26` helper shape); both survive a throwing store.
5. `newTally`/`feedTally`: a batch of 3 kills + 2 powers + 4 bricks + 1 win over
   a hand-built world gives `{r:1,k:3,p:2,b:4}`; `lives` 3→2 sets `d:1,dNew:1`
   and the next call resets `dNew` to 0; `lives` 1→3 (a new run's carry) adds no
   death; a `{t:"hurt"}` with `lives` unchanged (shield break) adds no death;
   `world.events` is not mutated (length unchanged after the call).
6. `fmtSpan`: `0`→`0:00`, `41.9`→`0:41`, `61`→`1:01`, `761`→`12:41`,
   `99999`→`99:59`, `-5`→`0:00`.
7. `isRunEnd`: LOSE true; WIN at level 3 false; WIN at level 5 and 8 true
   (`isFinale`); WIN with `finale:true` true; PLAY/PAUSE false.
8. `deltaLine` — one assertion per row of the five-form table, plus
   `bestLabel` over `{heat:0,pact:0,pace:0}`→`"CORE"`,
   `{heat:1,pact:3,pace:1}`→`"PLUS · LB · HARD"`.
9. `runLine` === `"ROOMS 4 · KILLS 27 · PICKS 9 · 12:41"` for
   `{r:4,k:27,p:9,t:761}`.
10. `summaryLines(world, undefined)` === `[]`; a mid-room WIN yields exactly one
    pair (the tally line); a LOSE and a finale WIN yield two.
11. `drawOverlay(…, undefined, undefined)` on WIN records today's fillText list;
    with `run` it additionally records `runLine`'s string; the PAUSE branch is
    unaffected.
12. `main.js` wiring, headless: run a game to a LOSE, assert `nb.bests.v1`
    holds `{s,r}` for `"0:0:1"`; retry through the LOSE fire edge and assert
    `bestRun` was re-snapshotted (a second run scoring below the first prints
    form 4 or 5, never `NEW BEST`) — the §1.2 regression.

---

## 3. R5 — opt-in STATS screen over `nb.stats.v1`

**Files:** new `src/app/stats.js`, new `tests/stats.test.mjs`; edits to
`src/app/menuapp.js`, `src/app/bests.js`, `src/render/menudraw.js`,
`src/render/shellview.js`, `src/main.js`, `src/pwa/shell.js` + `sw.js`.

### 3.1 Opt-in semantics — decided

**Aggregates are recorded from the first run, unconditionally. The event ring
fills only after the player opens STATS once.**

The argument, not a preference: `nb.highscores.v1`, `nb.times.v1`,
`nb.plaques.v1`, `nb.pact.v1` and `nb.cabinet.v1` all record unconditionally
today, all are local, and none ever leaves the device on its own — a counter that
asked permission while those five did not would be theatre. And **every signal in
report §5B is an aggregate**: session length (`first`/`last` + `secs`), return
cadence (`first`/`last`), depth (rooms, heat, pact), near-miss base rate (a
counter over §2.4's delta forms), consecutive days (a derived read, R12/wave 3).
The ring is the fine-grained, ordered record — the only part that *reads* like
telemetry — and it exists to answer "what did I do", a question only a player who
has opened STATS has asked.

**The single export channel stays explicit**: `C` on the STATS screen, once,
per press (§3.5). Report §5D, verbatim: "the ask is manual every time".

### 3.2 `src/app/stats.js`

```
STATS_KEY = "nb.stats.v1"
RING_MAX  = 200
EVENTS    = ["session_start","room_enter","room_clear","death","win_finale",
             "run_end","score_set","plaque_unlock","coach_shown","coach_dismissed"]
```

**Shape**

```
{ on: 0|1,
  a: { runs, rooms, deaths, kills, picks, bricks, secs, sessions, first, last },
  d: { "<1..8>": n },            // deaths by room
  k: { "<foe type>": n },        // kills by foe type
  p: { "<power kind>": n },      // pickups by kind
  e: [ { t, y, ... }, … ] }      // ring, ≤200, oldest dropped, only while on===1
```

- `a.first` / `a.last` and every ring entry's `y` are the **date string**
  `main.js` already computes — never epoch ms. There is no clock-shaped value in
  the blob, no formatter is needed to read it, and report §5C's "the player sees
  the same local data the team would reason from" is literally true when the blob
  is opened in DevTools. Session length is kept **in memory** for the session and
  flushed into `a.secs` as whole seconds at each `run_end`.
- `clampStats(raw)` whitelists: every `a.*` is a finite integer clamped
  `0..1e9` except `first`/`last`, which must match `/^\d{4}-\d{2}-\d{2}$/` or
  become `""`; `d` keys must match `/^[1-8]$/`; `k` keys must be in
  `FOES.map(f => f.t)` and `p` keys in `POWER.map(x => x.t)`
  (`entities.js:5-173`, imported — `src/app` may read `src/core`, as
  `highscores.js:1` already does); `e` is truncated to the last 200 entries whose
  `t` is in `EVENTS`. Bound: ≈200 × 48 B ≈ 10 KB plus ~1 KB of aggregates.
- `loadStats(store)` / `saveStats(v, store)` — the shared template.
- **`stat(ev, data, today)`** — the single edge function, a read-modify-write of
  the one key (the same shape `saveTimes(recordTime(loadTimes(), …))` already
  performs on every room WIN, `main.js:560-564`). It applies that event's
  aggregate effect **always** and appends the ring entry **only when `on === 1`**:

  | `ev` | aggregate effect | ring entry |
  |---|---|---|
  | `session_start` | `sessions++`, `first ||= today`, `last = today` | `{t,y}` |
  | `room_enter` | `last = today` | `{t,y,r,h,pc,pa}` |
  | `room_clear` | `rooms++` | `{t,y,r}` |
  | `death` | `deaths++`, `d[room]++` | `{t,y,r}` |
  | `win_finale` | — | `{t,y}` |
  | `run_end` | `runs++`, `kills+=`, `picks+=`, `bricks+=`, `secs+=`, merge `k`/`p`, `last = today` | `{t,y,r,s}` |
  | `score_set` | — | `{t,y,h}` |
  | `plaque_unlock` | — | `{t,y,b}` one per newly-set bit |
  | `coach_shown` | — | `{t,y,v}` (`v` = `"v1"`/`"kick"`/`"throw"`/`"remote"`) |
  | `coach_dismissed` | — | `{t,y,v,rn}` (`rn` = `"plant"`/`"use"`/`"timeout"`) |

- **`setStatsOn()`** — sets `on:1`; called once, from `main.js`'s `onStats`
  callback when STATS is first pushed.
- **`statsRows(v, bests)`** (pure) → the nine `[label, value]` pairs of §3.4.
- **`statsNotes(v, daily, today)`** (pure) → the two note strings of §3.4.
- **`statsPayload(v, bests, today)`** (pure) → §3.5.
- **`fmtLong(sec)`** — §1.3.

**`feedTally` is extended, not duplicated** (report §4 R5: R5 reuses R1's tap):
`newTally()` gains `kt:{}`, `pk:{}`, `dr:{}` and `feedTally` fills them in the
same loop it already runs. R5 therefore adds **zero** new per-frame passes over
`world.events`.

### 3.3 STATS reads the other stores; it never copies them

Per the controller's no-duplicate-store ruling: bests-per-heat come from
`loadBests()` (§2.2) and best times from `loadTimes()` (`times.js:54`).
`nb.stats.v1` holds only what no other key holds — counters, session dates and
the ring. A second copy of a best is a second thing to keep in sync and a second
thing that can disagree with the overlay.

### 3.4 The screen — `SCREEN.STATS = 12`, and where it lives in the menu

**Menu IA, decided: STATS is a MENU row, inserted directly under HIGH SCORES.**
`confirm()` dispatches on the **label** (`menuapp.js:278`,
`switch (ITEMS[this.cursor])`), so there is no runtime index dependency; the only
cost is test literals, enumerated in §7. SOURCE stays last because it is the one
row that leaves the page (`onSource`, `main.js:189-192`) — a data row placed
under an external link reads as an afterthought. `drawMenu` derives its own
pitch from the row count (`menudraw.js:227-237`, `span = min(itemH, max(18, inner/n))`),
so 7 and 8 rows fit at both plate sizes with no layout change.

The wave's final `ITEMS` (8 rows; R5 adds STATS, R3 adds DAILY, §4.3):

```
0 PLAY   1 LEVEL SELECT   2 DAILY   3 OPTIONS
4 GUIDE  5 HIGH SCORES    6 STATS   7 SOURCE
```

`menuapp.js` changes: `SCREEN.STATS = 12` appended (never inserted —
`menuapp.js:27`'s own rule); `ITEMS` gains the row; `confirm()`'s MENU switch
gains `case "STATS": if (o.onStats) o.onStats(); return this._push(SCREEN.STATS);`;
`back()`'s `LEVEL/SCORES/SETTINGS/GUIDE` list (`:326-332`) gains `SCREEN.STATS`;
`confirm()`'s back-out list (`:311-315`) gains `SCREEN.STATS`, so Enter closes it
like SCORES does. `shellview.js` gains a `SCREEN.STATS` branch (`drawDim(0.72)`
then `drawStats`) and the `items:` literal at `:80-87` grows to eight entries.

**`drawStats(c, L, t, ui)` in `menudraw.js`**, modelled line-for-line on
`drawScores` (`menudraw.js:694-837`); `ui = {rows, notes}` — the pure output of
`statsRows`/`statsNotes`, handed in by `shellview.js` through the same getter
seam scores and plaques already use (`shellview.js:34,122-129`), so `menudraw`
still imports nothing from `src/app`.

- `const S = shell(c, L, 480);` `head(c, S, "STATS", "YOUR CABINET");`
- body from `S.headY + 22` to `S.footY - 42`; nine rows; `rowH = (bot-top)/9`;
  label left at `S.ix` in `font(9,"900")` MUTED, value right at `S.ix + S.iw` in
  `font(rowH < 18 ? 11 : 13)` TEXT — `drawScores`' own size rule (`:825`).
  Measured: at 600×520 `S.headY 99.2`, `S.footY 476` ⇒ top 121.2, bot 434,
  `rowH 34.76`; at 608×352 `S.headY 72.32`, `S.footY 308` ⇒ top 94.32, bot 266,
  `rowH 19.08`. Both ≥ 18, so both render at 13 px.
- a 1 px `LINE` rule at `top + 6*rowH`, separating the six lifetime counters from
  the three bests (`drawScores:813-817`'s header rule, reused).
- two MUTED `font(10)` note lines at `S.footY - 30` and `S.footY - 16`.
- `foot(c, S, "C COPY MY STATS · ESC BACK");`

**The nine rows** (`statsRows`), locked:

| # | label | value |
|---|---|---|
| 1 | `RUNS` | `a.runs` |
| 2 | `ROOMS CLEARED` | `a.rooms` |
| 3 | `DEATHS` | `a.deaths` |
| 4 | `KILLS` | `a.kills` |
| 5 | `PICKUPS` | `a.picks` |
| 6 | `PLAY TIME` | `fmtLong(a.secs)` e.g. `14h 07m` |
| 7 | `CORE BEST` | `1840 · R5`, or `—` |
| 8 | `PLUS BEST` | `1840 · R5`, or `—` |
| 9 | `MAX BEST` | `1840 · R5`, or `—` |

Rows 7–9 read `bestOfRun(bests, "<h>:0:1")` — the **plain** bucket (no pact,
NORM pace). Mixing an IRON run into "CORE BEST" would be the same unit error
§2.1 refuses. Note 2 says so on screen.

**The two note lines** (`statsNotes`), locked:

- note 1 — `DAILY 2026-09-07 · BEST 1840 · 3 TRIES · YOUR OWN ATTEMPTS ONLY`, or
  `DAILY 2026-09-07 · NOT PLAYED YET` when `daily.date !== today`, or omitted
  entirely before R3 lands.
- note 2 — `SINCE 2026-08-30 · LAST 2026-09-07 · 42 SESSIONS · BESTS ARE PER HEAT`.
  Width: 72 chars at the 10 px mono face (≈6 px/char) = 432 px against
  `S.iw` 448. Checked at both sizes (`S.iw` is 448 at each).

**Failure mode named by report §4 R5** — "under-designed, it reads as a debug
tool". The mitigations are structural: a real plate, right-aligned values, the
lifetime/bests rule, and **no JSON anywhere on screen**.

### 3.5 "COPY MY STATS"

Reuses the `copyPayload` + `KeyC` seam (`scenes.js:54-56`, `main.js:324-333`).
The clipboard call stays in `main.js` where it already is; the string is pure.

**The branch goes inside the existing `KeyC` block, above its GAME check** —
placing it above the block would break the documented fall-through
(`main.js:332`: "outside GAME … fall through to app.key so KeyC still plays"):

```
    if (code === "KeyC") {
      if (app.screen === SCREEN.STATS) { copyText(statsPayload(loadStats(), loadBests(), dateStr())); return; }
      if (app.screen === SCREEN.GAME) { … unchanged … }
    }
```

`copyText` is the two-line clipboard helper factored out of `main.js:327-329`
(one helper, three call sites after R8) — a net line saving, not a cost.

**Payload (four lines, locked):**

```
FUSEGRID STATS · 2026-08-30→2026-09-07 · 42 SESSIONS
RUNS 118 · ROOMS 214 · DEATHS 301 · KILLS 4820 · PICKS 913 · BRICKS 7702 · TIME 14h 07m
CORE 1840/R5 · PLUS 2210/R4 · MAX — · CORE BEST TIME 0:38.9
https://hmarzban.github.io/fusegrid/
```

Line 3's time reads `bestOf(loadTimes(), "1:0:0:1")` — room 1 CORE plain — so the
payload names R7's store rather than duplicating it. The URL keeps its trailing
slash (AGENTS.md: the no-slash 301 drops the OG tags).

### 3.6 Pins — `tests/stats.test.mjs` (new) + additions

1. `clampStats` drops a junk `d` key, a junk `k` key, a junk `p` kind, a
   non-integer counter, a malformed `first`; truncates `e` to 200 keeping the
   **last** 200; forces `on` through the `bit()` shape (`times.js:33-37`).
2. `stat("session_start", …)` on an empty store sets `sessions:1`,
   `first === last === today`; a second call leaves `first` alone.
3. `stat("run_end", {…tally, secs})` sums `runs/kills/picks/bricks/secs` and
   merges `k`/`p`; `stat("death",{r:3})` bumps `deaths` and `d["3"]`.
4. **Opt-in**: with `on:0`, ten `stat` calls leave `e.length === 0` while every
   aggregate moves; after `setStatsOn()` the next call appends exactly one entry.
5. Ring cap: 250 appends leave `e.length === 200` and the newest entry last.
6. `fmtLong`: `0`→`0h 00m`, `3599`→`0h 59m`, `3600`→`1h 00m`, `50820`→`14h 07m`,
   `1e9`→`999h 59m`.
7. `statsRows` returns nine pairs; rows 7–9 read the plain bucket and render `—`
   when absent. `statsNotes` returns both strings, and note 1's
   `NOT PLAYED YET` form when the date differs.
8. `statsPayload` is four lines, contains no `{`/`[`, ends with the trailing-slash
   URL, and contains neither the word `leaderboard` nor any `Date`-shaped value.
9. `menuapp`: `SCREEN.STATS === 12`; `ITEMS.length === 7` after R5 (8 after R3)
   with `ITEMS[6] === "STATS"` (final) ; MENU confirm on the STATS row pushes
   `SCREEN.STATS` and fires `onStats` exactly once; `back()` and `confirm()` both
   return to MENU.
10. `menudraw.drawStats` records the nine labels, both notes and the foot at both
    plate sizes, and paints inside `S` (no fillText y past `S.footY`).
11. `headless`: `KeyC` on STATS writes the payload to the stub clipboard and
    `KeyC` on ATTRACT still reaches `app.key` (the `main.js:332` fall-through).

---

## 4. R3 — daily seeded challenge (honest, single-device)

**Files:** new `src/app/daily.js`, new `tests/daily.test.mjs`; edits to
`src/app/menuapp.js`, `src/render/shellview.js`, `src/render/scenes.js`,
`src/main.js`, `src/pwa/shell.js` + `sw.js`.

### 4.1 `dailySeed(dateStr)` — the function, spelled out

Pure, no `Date`, no store — FNV-1a 32-bit over the string plus the standard
32-bit avalanche, so one calendar day's worth of input change scatters the whole
word (`world.js:15` seeds the rng with `seed ^ level*40503`, so a weak low-bit
hash would give consecutive days near-identical room 1 boards):

```
export function dailySeed(dateStr) {
  const s = String(dateStr || "");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 3266489917) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
```

Measured on this machine, to be re-pinned by the test:
`dailySeed("2026-09-07") === 4119412512`, `dailySeed("2026-09-08") === 3922720528`,
`dailySeed("2026-01-01") === 750118410`, `dailySeed("") === 2019044825`.
**Zero collisions across 3650 consecutive dates** from 2026-01-01.

### 4.2 The day boundary — local, and why it is not `dateStr()`

`main.js:58` already has `dateStr = () => new Date().toISOString().slice(0,10)`,
which is **UTC**. It stays exactly as it is: it stamps the high-score `d` column
(`highscores.js:86`) and changing it would re-interpret every already-persisted
row. The daily gets its **own** local-date helper beside it, because a challenge
day that flips at 5 p.m. local is precisely the confusion R3 exists to avoid:

```
  const todayStr = () => { const d = new Date(), p = (n) => (n < 10 ? "0" + n : "" + n);
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); };
```

`src/app/daily.js` never calls `Date`: every function takes the string, the
`flags.js:1-3` template.

**Disclosed:** two players in different time zones can be on different daily
boards for part of a day. The date is printed on the run-end line and in the
share stamp, so a mismatch is visible; and the honest claim R3 makes is "your own
attempts", never a race (report §4 R3, risk 2).

### 4.3 The entry point — a MENU row, decided

**DAILY is `ITEMS[2]`, directly under LEVEL SELECT.** The report suggested LEVEL
SELECT; the code refuses it, for three checkable reasons:

1. **The LEVEL SELECT foot line is already full.** Today's unlocked foot
   (`menudraw.js:434`) is `ENTER START · ←/→ ROOM · ↑/↓ HEAT · [ ] PACE · 1–5 MODES · ESC`
   — 61 chars at the 10 px mono foot face (≈6 px/char) = 366 px against
   `S.iw` 368 (`shellBox(L,400)`, `menudraw.js:60-79`). There is no room for
   another key legend.
2. **Vertical space at 608×352 is exhausted.** The MODES rail sits at
   `py = pzy + 34` with its gloss at `py + 30` = 279 against `S.footY` 308
   (wave-1 §3.4's own measurement). A DAILY row does not fit.
3. **A return hook must be on the screen a returning player lands on.** A
   veteran's `bootFromIntro` goes to MENU (`menuapp.js:344-346`); LEVEL SELECT is
   one hop deeper. This is wave-1 §3.4's own discoverability argument, applied
   the other way.

**Confirming DAILY starts the run immediately**, as PLAY does. There is no DAILY
screen — the controller granted one appended SCREEN (STATS = 12) and R3 does not
need a second: the standing daily record lives on STATS note 1 (§3.4) and the
day's verdict on the run-end overlay (§4.4).

**The row's value** is the honour-system marker (report §4 R3, risk 1: "ship it
as an honour-system marker … and say so in the copy"). `shellview.js`'s items
literal renders `ITEMS[2] + "|" + app.dailyTag`, with `dailyTag` ∈ `"NEW"` /
`"PLAYED"` — the same `label|value` convention PLAY and LEVEL SELECT already use
(`shellview.js:81-82`). **Disclosed:** `main.js` writes `app.dailyTag` at boot
and at every run end, not per frame, so a session left open across local midnight
shows a stale tag until the next run or a reload. The **seed is always computed
fresh at run start**, so what you play is never wrong — only the label can lag.

`menuapp.js` gains:

```
    startDaily() {
      if (this.screen !== SCREEN.MENU) return false;
      const d = o.dailySeed ? o.dailySeed() : null;      // main hands over {seed, date}
      if (!d) return false;
      return this._playCore({ level: 1, heat: 0, pact: 0, pace: 0,
                              seed: d.seed, daily: d.date });
    },
```

reusing `_playCore` (`menuapp.js:583-595`) — the same CORE handoff
`bootFromIntro` and `playFromAttract` already share.

### 4.4 The run config — pinned, and stamped

**`{level: 1, heat: 0 (CORE), pact: 0, pace: 0 (NORM), seed: dailySeed(today)}`.**

Pinned rather than inherited because the daily's only claim is that *your own
attempts are comparable to each other*: heat changes the roster
(`heatRoster`, `heat.js:102-113`), pact changes the item count and therefore the
rng draw order (`applyPact`'s `buriedAdd`, `pact.js:23` → `world.js:129-133`), and
pace scales player speed without touching the seed (`sim.js:124`; report §3).
Attract is pinned to CORE/pact 0 for the same reason (`menuapp.js:576-579`).

**Accessibility cost, named:** `bootFromIntro` and `playFromAttract` both pass
`this.pace`; the daily does not, so a player who chose EASY plays the daily at
NORM. That is a deliberate deviation, and the ignored setting is **shown, not
swallowed** — the run-end line prints the pace token (§4.5).

**Stamped as well as pinned**, per the report's 5-tuple gate: `nb.daily.v1`
records the pace it ran at, so a record made under a future different pin is
refused rather than silently compared.

`main.js`'s `onStart` gains one line, before `loadLevel` (which reads `w.seed`
for both `createRng` and `genBoard`, `world.js:74-75`):

```
    if (args && args.seed != null) world.seed = args.seed >>> 0;
    dailyDate = (args && args.daily) || null;
```

A retry from the LOSE screen replays the same `world.seed` (`startGame` →
`loadLevel(world,1,false)` never touches it), so **`dailyDate` deliberately
survives a retry** — it is another attempt at the same board, and `tries` counts
up. §1.2's `startRunState()` does not clear it.

### 4.5 `nb.daily.v1`, the run-end line, and the share stamp

```
{ date: "YYYY-MM-DD", best: 0..9999999, played: 0..999, room: 1..8, pace: 0..2 }
```

`loadDaily(store)` clamps and, when `date` fails `/^\d{4}-\d{2}-\d{2}$/`, returns
the zero record. `recordDaily(v, today, score, room, pace)` returns a **new**
record: when `v.date !== today` it starts a fresh day (`played:1`, `best:score`,
`room`, `pace: pace+1`); otherwise `played++`, `best = max(best, score)`,
`room = max(room, room)`. `dailyTag(v, today)` → `"PLAYED"` when
`v.date === today && v.played > 0`, else `"NEW"`.

The write happens inside `endRun()` (§2.3), guarded by `dailyDate`, and
refreshes both `main.js`'s cached `dailyRec` and `app.dailyTag`.

**Run-end line** — on a daily run the daily line **replaces** the delta line in
slot 3 of §2.4's stack (the day's comparison is the one that matters that day;
the bests write still happens, so nothing is lost from the record):

```
export function dailyLine(world, run) {
  return "DAILY " + run.daily + " · " + paceToken(world.pace) +
         " · TRY " + (run.tries | 0) + " · YOUR BEST " + (run.dbest | 0);
}
```

Locked copy: `DAILY 2026-09-07 · NORM · TRY 3 · YOUR BEST 1840` — 47 chars,
423 px, inside both boxes. "YOUR" is the honesty word and it is free.
`run.tries` / `run.dbest` are read **after** `endRun`'s write, so the line states
the standing record including this run — which is what is true at the moment it
is drawn.

**Share stamp.** On a daily run, `KeyC`'s payload becomes the stamp the brief
locks, instead of `copyPayload(world)`:

```
export function dailyStamp(date, level, score) {
  return "DAILY " + date + " · L" + level + " · " + score +
         " · https://hmarzban.github.io/fusegrid/";
}
```

→ `DAILY 2026-09-07 · L3 · 1840 · https://hmarzban.github.io/fusegrid/`.
No code is appended: the board is derivable from the date by anyone who presses
DAILY that day, which is the whole point.

**Honesty copy, in exactly two places, neither of them a nag:** the STATS note
line (`… · YOUR OWN ATTEMPTS ONLY`, §3.4) and the word `YOUR` in the run-end
line. No banner, no streak, no "come back tomorrow" prompt (§0).

### 4.6 Pins — `tests/daily.test.mjs` (new) + additions

1. `dailySeed` over the four measured strings (§4.1); purity (same input twice,
   same output); 3650 consecutive dates produce 3650 distinct seeds.
2. `dailySeed` never returns a non-uint32: `(v >>> 0) === v` and
   `v <= 4294967295` across those 3650.
3. `loadDaily`/`saveDaily` round-trip through `mapStore()`; a malformed `date`,
   a negative `best`, a `room:0` and a `pace:7` all clamp; a throwing store
   returns the zero record.
4. `recordDaily`: fresh day resets `played` to 1; same day increments and takes
   the max of `best`/`room`; the stamped `pace` is preserved.
5. `dailyTag`: `"NEW"` on an empty record, on a stale date and on
   `played:0`; `"PLAYED"` on today with `played:1`.
6. `dailyLine` === `DAILY 2026-09-07 · NORM · TRY 3 · YOUR BEST 1840`;
   `dailyStamp` === the exact stamp above.
7. `summaryLines` on a daily LOSE emits `dailyLine`, **not** `deltaLine`; on a
   daily mid-room WIN emits neither.
8. `menuapp`: `startDaily()` off MENU returns `false`; on MENU it calls
   `onStart` with `{level:1,heat:0,pact:0,pace:0,seed,daily}` **even when
   `app.heat`/`app.pact`/`app.pace` are non-default** (the pin), and leaves
   `app.level`/`app.heat` untouched for the next normal run.
9. `main.js` headless: a DAILY run sets `world.seed === dailySeed(today)`;
   a LOSE-screen retry keeps that seed and bumps `played` to 2 at the next end;
   `nb.daily.v1` never records a non-daily run.

---

## 5. R8 — challenge code (seed / heat / pact / pace, no score)

**Files:** new `src/app/code.js`, new `tests/code.test.mjs`; edits to
`src/app/flags.js`, `src/app/menuapp.js`, `src/render/scenes.js`,
`src/main.js`, `src/pwa/shell.js` + `sw.js`.

### 5.1 The codec — spelled out and round-tripped

```
CODE_V = "F1"                       // version prefix, 2 chars
cfg    = heat*48 + pact*3 + (pace+1)          // 0..143, one base36 pair
body   = "F1" + b36(seed>>>0).padStart(7,"0") + b36(cfg).padStart(2,"0")
check  = b36(sum(body.charCodeAt(i)) % 36)    // 1 char
code   = body + check                          // 12 chars, uppercase
```

`b36(4294967295) === "1Z141Z3"` (7 chars) so the seed field never overflows;
`b36(143) === "3Z"` so `cfg` never does either. `decodeChallenge` uppercases and
trims, requires `/^F1[0-9A-Z]{10}$/`, re-computes and compares the checksum, then
requires `seed <= 4294967295` and `cfg <= 143`, returning `null` on any failure —
one wrong keystroke in a pasted link is refused, never played as a different board.

Measured round-trips, to be pinned:

| tuple | code |
|---|---|
| `{seed:4119412512, heat:0, pact:0, pace:0}` (today's daily) | `F11W4LB1C01E` |
| `{seed:123456789, heat:2, pact:9, pace:1}` | `F1021I3V93H8` |
| `{seed:0, heat:0, pact:0, pace:-1}` | `F1000000000B` |
| `{seed:4294967295, heat:2, pact:15, pace:1}` | `F11Z141Z33Z6` |

`decodeChallenge("F1AAAAAAAAAA") === null` (checksum).

**No score field, no level field.** The score is refused by the report; the level
is refused because the tuple must be "the full 5-tuple **minus level**" (report
§4 R8) — a challenge is a board, and a board is a seed plus the knobs that change
what generates on it.

### 5.2 Generation — `KeyB` on WIN / LOSE

`KeyC` is taken by the run stamp (`main.js:324-333`). The remaining unbound
letters are few: `input.js:34-49` binds `W A S D Q K P` plus `Space/J/X` as fire,
and `main.js` binds `R`, `C`, `M`; `menuapp.key()` binds Enter, Escape,
Backspace, `M`, arrows/WASD, `Digit1..5`, `[`, `]`.

**Lock: `KeyB` — "board".** It is unbound in both files, and the word is the
honest one for what the code carries: a board, not a claim. The overlay hint
reads `B board`, so the framing §0 requires is in the key legend itself.

`main.js`, inside the existing `KeyC`/GAME shape (one new sibling branch):

```
    if (code === "KeyB" && app.screen === SCREEN.GAME &&
        (world.state === "WIN" || world.state === "LOSE")) {
      copyText("https://hmarzban.github.io/fusegrid/?code=" +
        encodeChallenge({ seed: world.seed, heat: world.heat, pact: world.pact, pace: world.pace }));
      return;
    }
```

**The payload is the bare link — nothing else.** No score, no room, no date, no
stamp. Report §4 R8: "Share a challenge, not a claim."

### 5.3 Entry — `?code=` only, no DOM prompt

A `window.prompt` is refused: `src/app/` is DOM-free by construction, `main.js`'s
seams must stay out of `main.js` (AGENTS.md), and a modal prompt is a blocking
DOM call in an RAF loop. The URL parameter is also the **better** product: the
thing the sender copies **is** a link, so "paste it in the address bar" is the
entire interaction, and it is drivable from Node through `readFlags` with no
`location` (`flags.js:1-3`).

`flags.js` gains one field, matching the existing regex style:

```
  const cm = s.match(/[?&]code=([0-9A-Za-z]{12})\b/);
  …
  code: cm ? cm[1].toUpperCase() : null,
```

`main.js`, beside the existing `if (autoplay)` block (`:292-297`):

```
  const chal = flags.code ? decodeChallenge(flags.code) : null;
  if (chal) { app.playChallenge(chal); saveCabinetSeen(); }
```

`menuapp.playChallenge(t)` is `_playCore({level:1, heat:t.heat, pact:t.pact,
pace:t.pace, seed:t.seed})`. `?code=` wins over `?play=1` when both are present
(it is the more specific instruction), and an undecodable code falls through to
the normal boot — a bad link lands you in the game, never on an error screen.

**Two disclosures, both deliberate:**

1. **A challenge run honours the decoded pact bits even when `pactUnlocked` is
   false**, and never writes `nb.pact.v1`. `startRun` strips pact when locked
   (`menuapp.js:541`) because that gate governs what a player may *choose for
   themselves*; it cannot govern what a shared board *contains*, because pact
   changes the board (`applyPact`'s `buriedAdd` → item count → rng draw order),
   so stripping it would hand the recipient a different board under the same
   code — the one thing R8 exists to prevent.
2. **A locked recipient still stops at room 5.** `roomCap(pactUnlocked)`
   (`config.js:28-31`) is a progression cap, not a board property. Same boards,
   shorter run. One sentence, disclosed, not fixed.

### 5.4 The overlay hint

`COPY_HINT` (§2.4) becomes `" · C copy · B board"`. Worst-case cue line:
`SPACE / TAP · next room · C copy · B board` — 41 chars, 369 px, inside both
boxes. `overlayCue` itself is **not** touched, so `tests/heat.test.mjs:49-69`'s
four exact-string pins are unmoved.

### 5.5 Pins — `tests/code.test.mjs` (new) + additions

1. The four measured round-trips of §5.1, both directions.
2. `decodeChallenge` returns `null` for: a bad checksum, a wrong prefix (`F2…`),
   11 and 13 characters, lowercase-with-bad-checksum, `cfg > 143`, a seed above
   `2^32-1`, `null`/`undefined`/`{}`.
3. Lowercase input with a valid checksum decodes (the reader uppercases first).
4. Fuzz: 10 000 pseudo-random tuples (`createRng`-driven, no `Math.random`)
   round-trip exactly; every code is 12 chars and matches `/^F1[0-9A-Z]{10}$/`.
5. `flags`: `?code=F11W4LB1C01E` parses; `?code=` with 11 chars is `null`;
   the field defaults to `null`; `opts` cannot inject it.
6. `menuapp.playChallenge` passes the decoded pact **through** when
   `pactUnlocked` is false, and does not set `pactUnlocked`.
7. `main.js` headless with `{code:"F1021I3V93H8"}`: world seed/heat/pact/pace
   match the tuple, the shell is GAME, and `nb.pact.v1` is still unset.
8. **Framing pin:** a case-insensitive grep over `src/` and `tests/` finds zero
   occurrences of `leaderboard` — a new assertion inside
   `tests/banned-name.test.mjs`'s existing `git ls-files` walk, scoped to those
   two trees. `docs/` is deliberately exempt: `retention-report.md:429,433,451`
   already names the term in order to refuse it, and so does §0 of this file.
9. `KeyB` on a PLAY frame and on MENU copies nothing; on WIN/LOSE it writes the
   `?code=` link and no score digit appears in the payload.

---

## 6. R10 — coach v2: first-use KICK / THROW / REMOTE tips

**Files:** edits to `src/app/coach.js`, `src/render/scenes.js`,
`src/render/renderer.js`, `src/render/three/wrapper.js`, `src/main.js`,
`src/pwa/shell.js` + `sw.js`; additions to `tests/coach.test.mjs`. **No new
module** — v2 is the same store family and the same panel as v1.

### 6.1 Triggers, store and lifetime

Three verbs, three triggers, one tip each, **once ever**:

| verb | shown on | dismissed early by | note |
|---|---|---|---|
| KICK | `{t:"power", kind:"kick"}` (`entities.js:178`) | `{t:"kick"}` (`sim.js:155`) | kicking is automatic once owned (`sim.js:144-157`); `KeyK` sets an intent the sim never reads |
| THROW | `{t:"power", kind:"throw"}` | `{t:"throw"}` (`sim.js:329`) | needs `inp.shift` (`sim.js:165`) |
| REMOTE | `{t:"power", kind:"remote"}` | `{t:"remote"}` (`sim.js:185`) | `KeyQ` (`input.js:46`) |

All six events already exist and all arrive in the same batch `feedTally` reads —
R10 adds **no** new events and **no** new pass over `world.events`.

```
COACH2_KEY = "nb.coach.v2"
COACH2_DUR = 3                       // = COACH_DUR (coach.js:4); one timing rule
```

Shape `{ k: 0|1, t: 0|1, r: 0|1 }` — one bit per verb, `1` = already shown.
`loadCoach2(store)` / `saveCoach2(v, store)` on the shared template;
`coach2Seen(v, kind)` and `coach2Mark(v, kind)` are pure.

**Lifetime = v1's, exactly** (report §4 R10: "in the shape v1 already proved"):
transient, non-modal, fades over `COACH2_DUR`, dismissed by using the verb,
never blocks input, never pauses. `main.js` owns the clock (`coach2T`, PLAY-only,
beside `coachT` — the `main.js:121-124` trap), computes the alpha, and passes the
finished string and alpha down. The persist write fires once, on the frame the
window closes, exactly as v1's does (`main.js:600-606`).

**One tip at a time:** a new trigger replaces a live tip and marks the replaced
one seen — a player who grabs KICK and THROW in the same blast gets one tip now
and never the other, which is the tip-fatigue rule (report §4 R10, risk) taken
literally. Disclosed.

**v1 wins ties:** while the ghost coach is still open (`coachOpen`, `coach.js:24-26`)
a v2 trigger is deferred to the frame v1 closes, so a first-timer never sees two
panels.

### 6.2 The copy — derived, and printed here verbatim

Per §1.5, `coachTip(kind)` composes from `POWER` (`entities.js:53-105`):

```
export function coachTip(kind) {
  const d = POWER.find((x) => x.t === kind);
  return d ? d.name + " · " + d.help : "";
}
```

The three resulting strings, locked, printed here so a future `help` edit reads
as the copy change it would be:

```
KICK · walk into a bomb to slide it
THROW · Shift+Space tosses a bomb
REMOTE · Q detonates your bombs
```

Longest is 34 chars at the 12 px mono panel face (§6.3) ≈ 245 px.

### 6.3 The draw — `drawCoach2(c, alpha, text)` in `scenes.js`

HUD/overlay space, so 2D and REAL 3D are identical (the same space
`drawHudChips` and `drawCoach` use):

- centred pill at `x = CFG.COLS*CFG.TILE/2` = **300**, `y = **130**` — below R2's
  combo callout at `y = 96` (wave-1 §2.2) and well below the HUD chip row, which
  ends at `y = 40` (`scenes.js:236-239`).
- `rr(c, x - w/2, y - 13, w, 26, 8)` with `w = text.length * 7.2 + 24` (the same
  0.6 em advance the wave-1 HUD budget assumes, at 12 px), `fillStyle`
  `COACH_PANEL`, `strokeStyle` `COACH_LINE`, text `COACH_TEXT` at
  `900 12px ui-monospace,monospace` — v1's own three constants
  (`scenes.js:297-299`), reused, not re-declared.
- `globalAlpha = alpha`; no blink, no scale-pop, no colour cycling, so it needs
  no REDUCE FLASH gate (wave-1 §2.2's reasoning) — the panel is a fade, and
  REDUCE FLASH players get the same panel v1 already gives them.
- `if (!(alpha > 0) || !text) return;` before any ctx call — v1's silent-when-closed
  contract, pinned by `tests/coach.test.mjs:57-70`.

Wiring, at **both** draw sites, immediately after the existing `drawCoach` line
and under the same `o.hud === true` gate — `renderer.js:90` and
`wrapper.js:157`. Wave-1 §9.2 is the precedent for why both must move in the
same commit:

```
    if (o && o.hud === true) drawCoach2(ctx, (o && o.coach2 && o.coach2.a) || 0,
                                        (o && o.coach2 && o.coach2.s) || "");
```

`ro.coach2 = {a, s}` is built in `main.js`'s GAME `ro` beside `coach:`
(`main.js:670-674`), gated on `world.state === "PLAY"` exactly as `coach:` is —
so a tip never paints over the PAUSED, CLEARED or GAME OVER veil.

### 6.4 Pins — additions to `tests/coach.test.mjs`

1. `coachTip("kick"/"throw"/"remote")` === the three strings of §6.2 verbatim;
   `coachTip("fire")` and `coachTip(undefined)` === `""`.
2. `loadCoach2`/`saveCoach2` round-trip through `mapStore()`; junk shapes clamp
   to `{k:0,t:0,r:0}`; a throwing store returns that.
3. `drawCoach2(c, 0, "…")` and `drawCoach2(c, 1, "")` draw **nothing** (the
   recorder-proxy shape of `coach.test.mjs:57-70`); `drawCoach2(c, 1, "KICK · …")`
   records the text.
4. Headless: a `{t:"power",kind:"kick"}` event shows the KICK tip on the next
   frame; a `{t:"kick"}` event dismisses it and writes `nb.coach.v2` with `k:1`;
   a second KICK pickup in a later run shows nothing.
5. Timeout path: no kick for `COACH2_DUR`, the tip fades and `k:1` persists.
6. PAUSE does not advance `coach2T` (the `33668f7` / wave-1 §1.1 trap), pinned
   the way `coach.test.mjs:204-237` pins it for v1.
7. Two verbs picked up in one batch show exactly one tip and mark both seen.
8. While v1's ghost coach is open, a v2 trigger draws no second panel.
9. ATTRACT never draws a v2 tip (`ro.hud === false`, `main.js:660`), pinned the
   way `coach.test.mjs:100-119` pins it for v1.

---

## 7. ABI table — every pin that moves

`site → today → new → plan`

| Site | Today | New | Plan |
|---|---|---|---|
| `src/app/bests.js` | — | **new module**: `BESTS_KEY BESTS_MAX bestKey clampBests loadBests saveBests bestOfRun recordBest newTally feedTally` | R1 |
| `src/app/stats.js` | — | **new module**: `STATS_KEY RING_MAX EVENTS clampStats loadStats saveStats stat setStatsOn statsRows statsNotes statsPayload fmtLong` | R5 |
| `src/app/daily.js` | — | **new module**: `DAILY_KEY dailySeed loadDaily saveDaily recordDaily dailyTag dailyStamp` | R3 |
| `src/app/code.js` | — | **new module**: `CODE_V encodeChallenge decodeChallenge` | R8 |
| `src/pwa/shell.js` `SRC` | 60 entries incl. `src/app/times.js` | **+4**: `src/app/bests.js` (R1), `src/app/stats.js` (R5), `src/app/daily.js` (R3), `src/app/code.js` (R8) — **mandatory**: `tests/pwa.test.mjs:98-103` walks `src/` and requires every `.js` in `PRECACHE` | all |
| `src/pwa/shell.js:1` `CACHE_NAME` + `sw.js:3` `REV` | `fusegrid-shell-v116` | one paired single-step bump **per precache-touching commit**, starting at **v117**. `pwa.test.mjs:79-81` pins the format; `sw.js:4` throws on drift | all |
| `scenes.js` exports | `drawLogo winHeadline overlayCue runStamp copyPayload fmtTime timeLine PAUSE_ROWS PAUSE_ROW_H overlayBox pauseHit drawOverlay updateHud makeHud drawHudChips drawCoach` | **+** `fmtSpan runLine bestLabel deltaLine isRunEnd summaryLines` (R1), `dailyLine` (R3), `drawCoach2` (R10). `runStamp` / `copyPayload` / `fmtTime` / `timeLine` **unchanged** (`heat.test.mjs:71-82`, `times.test.mjs:474-478`, `headless.test.mjs:907-914`) | R1/R3/R10 |
| `scenes.js` imports | `CFG isFinale biomeOf` / `HEAT_*` / `drawIcon` / `rr` / `PROJ` | **+** `pactLabel` (`core/pact.js`), `paceToken` (`core/pace.js`) | R1/R3 |
| `scenes.js drawOverlay(c,world,w,h,cx,cy,ui,tm)` | 8 args | `(…, tm, run)` — 9th optional; absent ⇒ **byte-identical**. WIN/LOSE stack becomes dy 20/44/68/92/116 | R1 |
| `scenes.js` overlay cue concat | `overlayCue(world) + " · C copy"` at `:147,:148,:152` | `+ " · C copy · B board"` (one `COPY_HINT` constant, three sites) | R8 |
| `renderer.js:79` | `drawOverlay(ctx, world, B.w, B.h, B.cx, B.cy, o&&o.pause, o&&o.time)` | `…, o&&o.time, o&&o.run)` | R1 |
| `wrapper.js:154` | `drawOverlay(ovCtx,world,B.w,B.h,B.cx,B.cy,o&&o.pause,o&&o.time)` | `…, o&&o.time, o&&o.run)` — **both sites in the same commit** (wave-1 §9.2) | R1 |
| `renderer.js:90` / `wrapper.js:157` hud block | `drawCoach(ctx, (o&&o.coach)||0)` | **+** a `drawCoach2(ctx, …)` line after it, same `o.hud===true` gate, **both sites** | R10 |
| `menuapp.js SCREEN` | 12 values, `GUIDE: 11` | **+** `STATS: 12`, appended (`menuapp.test.mjs:66-71` gains a row; `:47-53` unmoved) | R5 |
| `menuapp.js ITEMS` | 6 rows, `[2]="OPTIONS" [3]="GUIDE" [5]="SOURCE"` | 8 rows: `PLAY, LEVEL SELECT, DAILY, OPTIONS, GUIDE, HIGH SCORES, STATS, SOURCE`. `confirm()` dispatches by **label** (`menuapp.js:278`), so no runtime index moves | R5 (+STATS), R3 (+DAILY) |
| `tests/menuapp.test.mjs:57-63` | `ITEMS.length===6`, `[2] OPTIONS`, `[3] GUIDE`, `[5] SOURCE` | `length===8`, `[2] DAILY`, `[3] OPTIONS`, `[4] GUIDE`, `[6] STATS`, `[7] SOURCE` | R5, R3 |
| `tests/menuapp.test.mjs:323-338` dispatch table | `[1,LEVEL] [2,SETTINGS] [3,GUIDE] [4,SCORES]` | `[1,LEVEL] [3,SETTINGS] [4,GUIDE] [5,SCORES] [6,STATS]` | R5, R3 |
| `tests/menuapp.test.mjs:339-353` | `cursor 5 SOURCE -> onSource(), screen stays MENU` | `cursor 7` | R5, R3 |
| `menuapp.js confirm()/back()` | MENU switch; back-out list `:311-315`; back list `:326-332` | **+** `STATS` in all three; **+** `DAILY` → `startDaily()` in the MENU switch | R5, R3 |
| `menuapp.js` new methods / options | `toggleTimeAttack`, `o.onTimeAttack` | **+** `startDaily()`, `playChallenge(t)`, `o.onStats`, `o.dailySeed`, `app.dailyTag` | R5/R3/R8 |
| `menuapp.js _playCore` args | `{level, heat, pact, pace}` | **+** optional `seed` and `daily`, consumed by `main.js`'s `onStart` only. `startRun()`'s own args **unchanged** — pinned as an absence | R3 |
| `shellview.js:75-91` MENU `items:` literal | six `ITEMS[i]` entries | eight, with `ITEMS[2] + "|" + app.dailyTag` | R5, R3 |
| `shellview.js` screen router | `LEVEL HOWTO ITEMS ENEMIES GUIDE SCORES SETTINGS` | **+** `SCREEN.STATS` → `drawDim(0.72)` + `menudraw.drawStats(c, L, app.subT, ui)` | R5 |
| `tests/menudraw.test.mjs:112-118` | six-entry `ITEMS[i]` items literal (comment: "real shipped rows") | eight entries, so the comment stays true | R5, R3 |
| `tests/menudraw.test.mjs:262-280` | hard-coded six-string items literal | **still passes** (`drawMenu` is generic) but is updated to eight so it keeps mirroring the shipped rows. `:185`'s deliberate three-row literal is **unmoved** | R5, R3 |
| `menudraw.js` | `drawMenu drawLevelSelect drawHowTo drawItemsHelp drawEnemiesHelp drawGuide drawScores drawSettings drawAttractHint drawDim drawFade layout settingsRows settingsGeom settingsHit` | **+** `drawStats(c, L, t, ui)` | R5 |
| `src/app/flags.js readFlags` | `urlKind autoplay netLocal orbit debug` | **+** `code` | R8 |
| `src/app/coach.js` | `COACH_KEY COACH_DUR loadCoachSeen saveCoachSeen coachOpen` | **+** `COACH2_KEY COACH2_DUR loadCoach2 saveCoach2 coach2Seen coach2Mark coachTip`; imports `POWER` from `core/entities.js` | R10 |
| `main.js` | `coachT roomT bestPrev` | **+** `tally runT bestRun runEnded dailyDate dailyRec coach2T coach2Kind`; `startRunState` / `endRun` / `copyText` helpers; `isFinale` on the `CFG` import; the split edge block (§2.3); `feedTally` line; `ro.run` / `ro.coach2`; `todayStr`; `?code=` boot branch; `KeyB` and `KeyC`-on-STATS branches; four new module imports | all |
| `tests/headless.test.mjs:909` | `main.js stays a lean browser entry (<=733 lines)`, measured 732 | **R1 → 754, R5 → 770, R3 → 782, R8 → 792, R10 → 802**, each with the file's own one-line reason comment appended (`:900-908` convention) so the gate keeps biting. **Rule: a plan that would exceed its cap moves the excess into its `src/app/*` module, never into a higher pin** | all |
| `tests/heat.test.mjs:325-335` (WIN branch) | `texts.some(s => s.indexOf("CLEARED") >= 0)` | **unmoved** — the 9th arg defaults `undefined` ⇒ today's layout | R1 |
| `tests/heat.test.mjs:55-82` | `overlayCue` × 4 and `runStamp` / `copyPayload` exact strings | **unmoved** — R8 changes only `drawOverlay`'s concatenation | R8 |
| `tests/times.test.mjs:8,10` (`timeLine`, `drawOverlay` pins) | 8-arg calls | **unmoved**; the `timeLine` slot moves from dy 44 to dy 68 on a mid-room WIN, and both pins are string-presence pins, not position pins | R1 |
| `tests/three.test.mjs:1408-1420`, `tests/pickups.test.mjs:465-478` | `drawHudChips(rec, world)` | **unmoved** — `drawHudChips` is not touched by wave 2 | — |
| `tests/menudraw.test.mjs:823-827` | regex over `main.js`'s `drawShell(…);` call | **unmoved** — `drawShell`'s arg list does not change (STATS rows ride `app`) | R5 |
| `tests/banned-name.test.mjs` | tree-wide reference-game name gate | **+** a case-insensitive `leaderboard` assertion over the same `git ls-files` walk, **scoped to `src/` and `tests/`** (`docs/` names the term to refuse it) | R8 |
| New test files | — | `tests/bests.test.mjs` (12 pins), `tests/stats.test.mjs` (11), `tests/daily.test.mjs` (9), `tests/code.test.mjs` (9) | R1/R5/R3/R8 |
| `tests/coach.test.mjs` | v1 pins | **+** 9 pins (§6.4) | R10 |
| `MEMORY.md` | — | one dated line per plan (AGENTS.md standing rule) | all |

---

## 8. Ship order, PWA bumps, and what every plan ships with

**R1 → R5 → R3 → R8 → R10**, the controller's order. Each step has a reason:

1. **R1 first.** It creates `bests.js`, `feedTally`, the run-state helpers and the
   9th `drawOverlay` argument that the other four build on. Report §6: "**Ship
   first in this wave — R5 and R6 both get cheaper.**"
2. **R5 second.** It extends `feedTally` in place (§3.2) and settles the menu
   IA (`ITEMS` + `SCREEN.STATS`) that R3's row then slots into. Doing it after R3
   would mean two consecutive rewrites of the same test literals by two authors.
3. **R3 third.** It needs `onStart`'s `args.seed` seam and R1's run-end edge to
   write `nb.daily.v1`, and STATS note 1 to have somewhere to live.
4. **R8 fourth.** Report §6: "Shares R3's seed plumbing — sequence after R3." It
   reuses `args.seed`, `_playCore` and `copyText` verbatim.
5. **R10 last.** It is the only item with no dependency on the others, and
   `tests/coach.test.mjs` — the file it edits — is dirty in `git status` right now
   (report §4 R10: "sequence after that lands").

**PWA rule** (AGENTS.md; wave-1 §9.1's correction applied): **one paired
`CACHE_NAME` + `sw.js` REV bump per precache-touching commit**, single-step, from
**v117**. The count is per commit, not per plan — a plan that lands in three
commits takes three bumps. Test-only and docs-only commits bump nothing.

**Every plan ships with:** `npm test` green **and** a headed play-verify
(AGENTS.md: "Visual 3D feel is not covered by Node"), in both CLASSIC 2D and
REAL 3D:

| plan | headed check |
|---|---|
| R1 | a LOSE and a finale WIN at both plate sizes, reading all five stacked lines; a retry from LOSE that must **not** print `NEW BEST` for a worse run (§1.2) |
| R5 | the STATS plate at 600×520 and 608×352 with a full aggregate and an empty one; `C` writing the four-line payload |
| R3 | a DAILY run from MENU, the row tag flipping `NEW`→`PLAYED`, a second attempt showing `TRY 2`, and `C` copying the stamp |
| R8 | `B` on a WIN, pasting the copied link into a second cold tab, and confirming the two boards are pixel-identical at room 1 |
| R10 | all three tips in one run, each dismissed by using its verb, plus a PAUSE mid-tip |

**MEMORY.md** gets one dated line per plan (AGENTS.md standing rule).

---

## 9. Self-review

Run against this file's own bar: no placeholders, no contradiction with an
AGENTS.md lock or with wave 1's shipped interfaces, every number traced.

**What the review changed:**

1. **`bestPrev` could not be R7's "captured before the write".** A score record
   is per-run and the overlay draws every room, so the snapshot has to be taken
   once at run start or the room-4 overlay compares against a record the room-3
   overlay already moved. Replaced with `bestRun` (§1.1). Stated as a correction
   to the brief, not silently substituted.
2. **A retry never calls `onStart` — the headline feature would have lied.**
   `startGame` runs inside `step()` (`sim.js:67-74`), so run state reset only in
   `onStart`/RESTART goes stale and run 2 falsely prints `NEW BEST` for any score
   between the old snapshot and the record run 1 just wrote; `runEnded` would also
   never clear, so run 2 recorded nothing. R7's reset block is **split**, not
   mirrored — mirroring it would have zeroed rooms-cleared and run time at every
   room transition (§1.2, §2.3).
3. **`fmtTime` would have pinned every run at `9:59.9`, and one replacement
   formatter would have pinned every lifetime at `99:59`.** Two formatters with
   disjoint ranges and disjoint consumers, neither touching `fmtTime`'s six-char
   HUD guarantee (§1.3).
4. **The delta line is run-end only.** The first draft drew it on every WIN, which
   would have claimed an unwritten record on room 3 and repeated it on 4 and 5.
   The display edge is now the same predicate as the persist edge, `isRunEnd`,
   which also reuses the `isFinale` predicate AGENTS.md requires of overlay code
   (§2.4).
5. **`nb.highscores.v1` cannot be the comparison target** — three separate unit
   errors (heat-multiplied values, one 10-row list across all heats, CORE
   pre-seeded to 250), each of which would have produced exactly the fabricated
   delta report §4 R1 forbids (§2.1).
6. **STATS would have duplicated two stores.** The controller's no-duplicate
   ruling applies to bests and times as much as to `nb.times.v1`: STATS now
   **reads** `nb.bests.v1` and `nb.times.v1` and stores only counters, dates and
   the ring (§3.3).
7. **The opt-in split had to be argued, not asserted.** Recording aggregates
   unconditionally is consistent with the five `nb.*` keys that already do so, and
   **every signal in report §5B is an aggregate** — which is what makes gating only
   the ring a real decision rather than a hedge (§3.1).
8. **`score_set` would have over-reported.** `recordScore` slices to 10
   (`highscores.js:68-77`), so "a score was persisted" is not "a row landed".
   Gated on the already-shipped `qualifies` (`highscores.js:99-101`).
9. **Epoch milliseconds became date strings.** `main.js` computes a date anyway,
   a ms field needs a formatter to be read, and report §5C's promise that the
   player sees the same data the team would reason from is only literally true if
   the blob is readable (§3.2).
10. **LEVEL SELECT physically cannot hold the DAILY entry.** Its unlocked foot is
    366 px against `S.iw` 368, and the MODES gloss already sits at 279 against
    `S.footY` 308 at the compact size. Both measured, both in §4.3 — the report's
    suggested placement is refused on arithmetic, not taste.
11. **The daily's pinned NORM pace is an accessibility cost, so it is shown.**
    `bootFromIntro` and `playFromAttract` both pass the player's pace; the daily
    does not, and the run-end line prints the pace token so the ignored setting is
    never a silent surprise (§4.4).
12. **`dailyDate` must survive a LOSE retry.** The retry replays the same seed, so
    it is another attempt at the same board and `tries` counts up — the opposite of
    what a mirrored reset would have done (§4.4).
13. **The daily's date is local, but `dateStr()` stays UTC.** Changing the shipped
    helper would re-interpret every persisted high-score `d` column; a second
    three-line helper beside it costs nothing and stops "today" from flipping at
    5 p.m. local (§4.2).
14. **`KeyX` — the obvious letter for R8 — is a fire key** (`input.js:36,44,58`).
    The whole bound set was enumerated before `KeyB` was picked, and "board" is
    also the framing word that keeps the refused term out of the key legend (§5.2).
15. **A DOM prompt was refused and the URL is the better product**, not just the
    cheaper one: the payload already is a link, so pasting it in the address bar
    *is* the interaction, and `readFlags` makes it drivable from Node (§5.3).
16. **Two challenge-code asymmetries are disclosed rather than fixed:** decoded
    pact bits are honoured even when locked (stripping them would hand the
    recipient a different board — the one thing R8 prevents), and a locked
    recipient still stops at room 5 via `roomCap` (§5.3).
17. **R10's copy is not new copy.** `POWER[].help` already ships all three
    strings and already shows them on the ITEMS screen; a second copy would drift.
    The tip is composed in `src/app/coach.js`, not in `render/`, because
    `scenes.js:287-296` states that rule about its own v1 panel in its own words
    (§1.5, §6.2).
18. **`KeyC`-on-STATS goes inside the existing `KeyC` block**, not above it —
    above it would break the documented "outside GAME, fall through to `app.key`
    so KeyC still plays" path (`main.js:332`) (§3.5).
19. **`{t:"hurt"}` cannot count deaths.** A shielded hit emits it without losing a
    life (`sim.js:344-348`). Deaths are counted from a strictly decreasing
    `world.lives`, which also survives the `carry.lives` jump on a new run
    (§2.2).
20. **Rooms cleared is counted from `{t:"win"}`, not from `world.level`** — a
    LEVEL SELECT start at room 5 would otherwise report four rooms the player
    never played (§2.2).
21. **Both `drawOverlay` call sites and both `drawCoach2` call sites are named
    with their line numbers.** Wave-1 §9.2 was exactly this bug class: one draw
    site updated, one not (§7).
22. **`main.js`'s line pin gets five explicit caps and a governing rule** — excess
    moves into the plan's `src/app/*` module, never into a higher pin — so
    `headless.test.mjs:909` keeps biting instead of trailing slack (§7).

**Known assumptions, disclosed:** (a) every width budget here assumes the 0.6 em
advance typical of `ui-monospace` fallbacks (Menlo is 0.602 em), the same
assumption wave-1 §3.3 made and checked headed; (b) `runT` inherits `roomT`'s
device-dependence — it counts clamped RAF `dt`, including wall-clock the sim's
`steps > 6` cap discards (§2.3); (c) `app.dailyTag` is written at boot and at run
end, so a session open across local midnight shows a stale label while the seed
itself stays correct (§4.3).

**Open owner questions this spec does not answer, deliberately:** report §7.4
(how sparse the R6 medal set should be) and §7.5 (whether the consecutive-day
read ships at all) — both belong to wave 3, and neither is pre-decided here.
