# Fusegrid — retention wave 3, binding design (2026-10-08)

Binding spec for wave 3, in the controller's order: **R0** (polish), **R12**
(lifetime DAYS PLAYED), **R6** (medals + trophy page), **R9a** (ghost store,
recorder, CLASSIC 2D ghost), **R9b** (REAL 3D ghost), **Reset** (reset my
cabinet). Each item lands, and is reviewed, before the next one starts.

Every value below is either quoted from a `file:line` in this tree (at
`bcaf1e3`) or stated as a design pick. There are no TBDs. Public copy never
names the private reference game. The word `leaderboard` stays out of `src/`
and `tests/` (`tests/banned-name.test.mjs`).

## Rulings this spec is built on

These are owner-delegated rulings. They are binding and are not re-argued here.

- **Ruling 2026-10-08 (R0, B-NIT-1):** the PAUSE footer hint is keyboard-only
  (`src/render/scenes.js:47`). The fix is STATIC copy in the sibling `SPACE / TAP`
  style, with no touch detection in render code. It is pinned to fit at 600×520
  and at 608×352 (iso).
- **Ruling 2026-10-08 (R0, sitemap):** `sitemap.xml` `<lastmod>` becomes
  `2026-10-08`. It is not in `PRECACHE`, so that change alone bumps no cache.
- **Ruling 2026-10-08 (R12):** STATS shows a LIFETIME `DAYS PLAYED N` line and
  nothing else. It is monotonic and can never be lost. There is no streak, no
  banner, no welcome-back copy and no at-risk copy. `nb.stats.v1` gains a
  last-day string and a days count, clamped like the rest of the store. The
  local date string comes from `main.js`. Existing players start at 1 on their
  first session after the upgrade, with no backfill. A day counts once per local
  date, at one existing run-start edge (§3.2), and never from attract. The count
  is included in the STATS copy text.
- **Ruling 2026-10-08 (R6):** medals use a new key, `nb.medals.v1`, holding one
  int bitmask. `nb.plaques.v1`'s `&15` is never widened and no new PACT bits are
  added. The set is 8–12 genuinely HARD medals, picked from the pool with a
  justification for each. Unlocks are evaluated ONLY at `isRunEnd(world)`, from
  the run tally plus persisted numbers. The run summary announces a medal only
  when it was newly persisted. The trophy page is the appended `SCREEN.TROPHIES = 13`.
  It is opened from STATS by a key and backs out to STATS, and it is not a MENU
  row. Every medal gets one Node pin proving it unlocks and one proving it does not.
- **Ruling 2026-10-08 (R9):** the ghost is a translucent replay of your own
  fastest clear of a room. It is valid only on the exact 5-tuple
  `{seed, level, heat, pact, pace}`. It is a position log sampled at about
  10/s on the PLAY-only clock, read-only from `world`. It is never fed to
  `step()` and emits no events and no SFX. The store is `nb.ghost.v1`, keyed by
  the tuple, version-stamped, capped with LRU, compact, and it survives a
  throwing `localStorage`. The ghost renders in both renderers. In 3D it is
  outside the player slot and has no `castShadow`. There is one ghost per tuple,
  with no "just ahead" selection and no OPTIONS toggle (`OPT_ROWS` stays frozen).
- **Ruling 2026-10-08 (Reset):** STATS gets a two-press confirm. Clearing wipes
  every progress store and keeps a named keep-list of preferences, then calls
  `location.reload()`. One Node test checks every `nb.*` literal in `src/`
  against the two lists.
- **Ruling 2026-10-08 (unchanged, owner calls):** D1 keeps the arcade reset on
  death. H4 also stays: a tap on ATTRACT while DAILY is highlighted starts an
  ordinary run.

**Hard gates for the whole wave:**

- The `src/core` diff stays EMPTY (replay baseline v6).
- `main.js` stays inside the line budget (§8).
- Each commit that changes precached bytes bumps `CACHE_NAME` and the `sw.js`
  REV once, together (§10).
- The demo/attract run never records ghosts, never unlocks medals and never
  counts days. All three hang off GAME-branch call sites the demo world never
  reaches (`main.js:610-686` vs `:695-699`).

---

## 0. Refusals

| Refused | Why |
|---|---|
| Any edit under `src/core` | Every item here is a read of `world`/tally, or app/render state. Ghosts are a position log, never intent replay (report §4 R9) |
| A consecutive-day read, streak, "at risk" or welcome-back copy | AGENTS.md Conventions, and Ruling 2026-10-08 (R12) |
| Widening `PLAQUE` (`plaques.js:5,24`) or `PACT` (`pact.js:5`) | R6 ruling. Medals use their own key |
| A MENU row for trophies, or any change to `ITEMS` | R6 ruling. Menu index pins stay where they are (`menuapp.test.mjs:57-66,323-353`) |
| A ghost OPTIONS toggle, or "just-ahead" ghost selection | R9 ruling. `OPT_ROWS` is frozen (`menuapp.js:46-56`) |
| A per-frame-proxy medal (e.g. "3 kills in one blast") | `feedTally` sees up to 7 sim steps of events per call (`main.js:643-656`), so one frame is not one blast. Such a medal would sometimes lie |
| A medal ring event in `nb.stats.v1` | `EVENTS` stays at ten kinds (`stats.js:11-14`). The medal record is `nb.medals.v1` itself |
| Ghosts in the legacy `?render=iso` path | Iso is a pinned legacy path (AGENTS.md). Only kinds `"2d"` and `"3d"` draw a ghost |

---

## 1. Corrections to the brief (verified against the code)

1. **The report's R12 mechanism is stale.** Report §4 R12 calls for a
   consecutive-day read over `first_seen`/`last_seen`. `stats.js` has neither.
   It has `a.first`/`a.last` (`stats.js:48`), stamped with the **UTC** `dateStr`
   (`main.js:65,341`). A consecutive read is also banned by AGENTS.md. The R12
   ruling replaces it with a lifetime count keyed to a **local** date (§3).
2. **Two of the pool's medal candidates are existing plaques.** "MAX heat finale
   clear" is `PLAQUE.MAX`: `heat>=2` and a finale (`plaques.js:31-32`). "Room 8
   clear" is `PLAQUE.CROWN`: `level>=8` at the finale edge (`plaques.js:35`).
   Both fire on the same edge with the same condition. Both are rejected (§4.1).
3. **KNIGHT kill and 9/9 foes are both just "clear room 8".** The KNIGHT only
   spawns in room 8 (`heat.js:59,111`). Room 8's roster at every heat is the L5
   base (walker, chaser, fast, stationary, boomerang, rocket) plus burrow, shade
   and knight, which is all nine types (`heat.js:22-58,104-113`). A room
   advances only when `w.enemies.length === 0` (`enemies.js:159-166`), so every
   room-8 clear kills all nine types, and that clear already earns
   `PLAQUE.CROWN`. After the first CLEAR, LEVEL SELECT lets a run start straight
   at room 8 (`roomCap(true) === 8`, `config.js:31`; `menuapp.js:82,390`), so
   neither needs rooms 6 and 7. A knight kill on a LOSE would be strictly
   easier than CROWN. Both are rejected (§4.1). **The ruling's seen-foe and
   seen-power mask fields are therefore NOT added.** `nb.medals.v1` stays
   exactly one int.
4. **12/12 powers is not hard.** A CORE 1→5 run spawns about 60 items:
   `buriedAdd+L` buried plus `floorAdd+L` floor, i.e. 35 + 25 (`world.js:129-133,183-189`).
   Each is drawn uniformly from the 12 kinds (`world.js:136,193`). With about 35
   grabs, P(all 12 in ONE run) is roughly 0.54 (inclusion–exclusion), and the
   lifetime version takes about two runs. It is rejected.
5. **`runFromStart` cannot gate finale medals.** It is `level<=1` (`main.js:217`),
   and room 8 is reachable only from a start at room 6, 7 or 8 (`isFinale(5)`
   ends every 1→5 run: `config.js:30`, `sim.js:54-60`). The full-run predicate is
   derived from the tally instead (§4.2). This adds no new run state.
6. **The demobot cannot finish a run.** Measured: 0 of 50 full runs cleared and
   room 1 cleared on only 55 of 400 boards (§4.4). A full-run speed threshold
   cannot come from bot full runs. It is anchored on per-room bot minima instead,
   which are disclosed with their biases.
7. **`countDrawCalls` counts invisible meshes** (`scene.js:159-162` traverses
   without a `.visible` check). An always-built ghost mesh would silently move
   all four fat-world-141 pins. R9b builds the ghost lazily (§6).
8. **`KeyR` never reaches `app.key`.** `onUiKey` returns on `KeyR` on every
   screen (`main.js:375-382`). `KeyC` (`:383-389`) and `KeyM` (`:396-404`) are
   also swallowed before `app.key`. So "any other key disarms" cannot live in
   `menuapp.key` alone (§7.3).
9. **The `main.js` headroom is 4 lines, not 5.** The pin measures
   `split("\n").length`, which is `wc -l` + 1: 803 + 1 = 804, against a cap of
   808 (`tests/headless.test.mjs:936-937`). See §8.

---

## 2. R0 — polish

### 2.1 PAUSE footer copy

`overlayCue` PAUSE branch (`scenes.js:46-47`):

```
"↑↓ SELECT · ENTER / TAP CONFIRM · P RESUME · M QUIT"
```

- `ENTER / TAP` is the sibling `SPACE / TAP` form (`scenes.js:41-45`). Tapping
  a row is select-and-confirm in one gesture (`main.js:448-452`).
- **Fit:** 51 chars at 15 px is 459.0 px, using the 0.6 em mono advance this
  repo budgets everywhere (wave-2 §9). It is drawn centred by `sub()` at `cy+86`
  (`scenes.js:282`).
  - 600-wide boxes (2D, and 3D's `overlayBox("3d")`): 70.5 px margin each side.
  - 608-wide iso box: 74.5 px margin each side.

**Pins (tests/heat.test.mjs):**
- `:67` and `:315` change to the new string.
- New pin: `[...cue].length*15*0.6 <= overlayBox(k).w - 48` for `k` in
  `"2d"` and `"iso"`.

### 2.2 sitemap

`sitemap.xml:5` becomes `<lastmod>2026-10-08</lastmod>`. There is no test, since
a date pin would have to move on every refresh; the existence gate
(`headless.test.mjs:852`) stays. Not precached, so no bump.

**Acceptance:**
- The heat.test pins are green.
- Headed: the PAUSE plate at 600×520 and 608×352 shows the full hint on one line.
- **Commit:** `scenes.js` is precached, so this bumps **v146**.

---

## 3. R12 — lifetime DAYS PLAYED

### 3.1 Store change — `nb.stats.v1`

`a` gains two fields, clamped by the existing helpers (`stats.js:34-35`):

| field | type | clamp |
|---|---|---|
| `a.days` | int | `cnt()`, 0..1e9. Joins `A_KEYS` (`stats.js:26`) |
| `a.day` | local date string | `dat()`: `/^\d{4}-\d{2}-\d{2}$/` or `""` |

`stat("room_enter", d, today)` (`stats.js:106-107`) becomes:

```
} else if (ev === "room_enter") {
  a.last = y;
  const ld = dat(d.ld);
  if (ld && ld > a.day) { a.day = ld; a.days++; }
  else if (ld && ld < a.day) a.day = ld;
}
```

- **Monotonic.** The count never decrements. The `>` compare (ISO dates order
  lexicographically) counts each new date once. `"" < any date`, so an upgraded
  player's first room entry counts **1** with no backfill.
- **Self-heal.** A date behind `a.day` re-stamps `a.day` without counting. A
  hostile `day:"9999-12-31"` or one forward clock jump would otherwise freeze
  the count forever.
- **Ruling 2026-10-08 (spec review, finding 12):** the cost of the self-heal is
  that a backward clock or timezone hop that later returns can count one date
  twice. A frozen count is worse than a rare one-day over-count, so the
  self-heal is taken and the trade disclosed.
- `ld` is NOT in the ring whitelist (`stats.js:124-125`). Ring rows keep their
  UTC `y` only, so the blob never mixes two clocks per row.

### 3.2 The edge — `room_enter`, decided

Every run-start path already emits `room_enter`:

- `onStart` (`main.js:219`)
- pause RESTART (`:277`)
- the WIN/LOSE→PLAY edge (`:630`), which is LOSE→PLAY for the retry that never
  calls `onStart` (wave-2 §1.2)

**Lock:** each of the three literals gains `ld: todayStr()`. This is
line-neutral. `todayStr` is the local helper (`main.js:69`).

- `session_start` is rejected as the edge: it would count a visit that only
  watched ATTRACT.
- WIN→PLAY also passes through this edge. That is harmless (idempotent per date),
  and it makes a run crossing local midnight count the new day at its next room,
  a day it really was played on.
- **Deviation, recorded:** the R12 ruling asks for one run-start edge.
  `room_enter` is a superset of the run-start edges; its extra WIN→next-room
  firing is idempotent per local date, so it counts nothing a run start would
  not. Putting `ld` only on the run-start literals would cost a line for no
  behavioural difference.
- The demo world never calls `stat`, so attract never counts.

### 3.3 Screen and copy

`statsRows` becomes **ten** rows. `["DAYS PLAYED", String(a.days)]` is inserted
after `PLAY TIME`, so the lifetime block is 7 rows and the bests stay 3.

`drawStats` (`menudraw.js:845-879`):
- `rowH = (bot - top) / (rows.length || 10)`.
- The rule moves to `top + (rows.length - 3) * rowH`.

**Measured** (`S.headY`, `S.footY` from `shellBox`, `menudraw.js:60-79`):

| plate | top | bot | rowH | value size |
|---|---|---|---|---|
| 600×520 | 121.2 | 434 | 31.28 | 13 px |
| 608×352 | 94.32 | 266 | 17.17 | 11 px (rule `rowH < 18`, `:853`) |

The 9 px labels fit at both.

`statsPayload` line 1 (`stats.js:222-223`) appends
`" · " + n + (n === 1 ? " DAY PLAYED" : " DAYS PLAYED")`, e.g.
`FUSEGRID STATS · 2026-08-30→2026-10-08 · 42 SESSIONS · 12 DAYS PLAYED`. It is
still four lines.

### 3.4 Pins

**`tests/stats.test.mjs`:**
1. `clampStats` keeps a good `days`/`day` and zeroes junk (`-1`, `1.5`,
   `"2026-1-1"`).
2. `room_enter` with `ld:"2026-10-08"` takes `days` from 0 to 1. The same `ld`
   again stays at 1. `"2026-10-09"` gives 2. `"2026-10-07"` stays at 2 and
   re-stamps `day` to `"2026-10-07"`. An absent `ld` changes nothing.
3. An upgraded blob with no `days` field counts 1 on its first `room_enter`.
3b. **Self-heal.** A blob with `day:"9999-12-31", days:5`: `room_enter` with
   `ld:"2026-10-08"` leaves `days` 5 and sets `day` to `"2026-10-08"`. The next
   `ld:"2026-10-09"` gives 6.
4. Ring rows never carry `ld`.
5. `statsRows` returns ten pairs with `[6][0] === "DAYS PLAYED"`. The empty
   cabinet gives ten rows. (This moves the `=== 9` pins at `:329,:352,:488`.)
6. Payload line 1 ends `12 DAYS PLAYED` / `1 DAY PLAYED`. Still four lines.

**`tests/menudraw.test.mjs`:**
- `:626-629` gains `DAYS PLAYED`.
- `daysY < ruleY < coreY` (the rule sits between the 7 lifetime rows and the 3
  bests).

**`tests/headless.test.mjs`:**
- **ATTRACT setup (shared by §3.4, §4.6, §5.5).** A fresh store would run INTRO
  into a first-visit CORE run (`main.js:690`, `menuapp.js:356-361`). These pins
  pre-seed `nb.cabinet.v1 = "1"`, go INTRO→MENU, idle past `IDLE_T`
  (`menuapp.js:69`) into ATTRACT, and only then count their 600 frames,
  asserting `app.screen === SCREEN.ATTRACT` on every one.
- A boot left on ATTRACT for 600 frames leaves `a.days === 0`.
- One PLAY run sets it to 1.
- A LOSE→PLAY retry on the same date leaves it at 1.

**Commit:** bumps **v147**.

---

## 4. R6 — medals and the trophy page

### 4.1 The set — eight medals, bit order frozen and append-only

The full-run predicates are `clear5` and `clear8` (§4.2). `t` is the run tally
and `runT` is `main.js`'s PLAY-only run clock (`main.js:641`).

| bit | name | condition at `isRunEnd` | why it is hard and distinct |
|---|---|---|---|
| 1 | `FLAWLESS` | `clear5 && t.d === 0` | Pool "no-hit". Named for what `t.d` counts: **lives lost**. A shielded hit loses none (`sim.js:344-348`, `bests.js` death rule). No plaque reads lives |
| 2 | `UNSCATHED` | `clear8 && t.d === 0` | The same axis on the 6→8 run (burrow/shade/knight). Pool tiered L5/L8 |
| 4 | `ALL IN` | `clear5 && clampPact(w.pact) === 15` | Pool "all four pacts". LAST+BARE+THIN+SHRINK together over rooms 1-5 |
| 8 | `ALL OUT` | `clear8 && clampPact(w.pact) === 15` | The same axis, 6→8 tier |
| 16 | `OVERDRIVE` | `clear5 && clampPace(w.pace) === 1` | Pool "HARD pace finale" (PACE_MUL 1.15, `pace.js:3`) |
| 32 | `REDLINE` | `clear8 && clampPace(w.pace) === 1` | The same axis, 6→8 tier |
| 64 | `SPRINT` | `clear5 && heat 0 && pact 0 && pace 0 && runT < 180` | Pool "speed clear". Threshold MEASURED (§4.4) |
| 128 | `IRON CROWN` | `clear8 && clampHeat(w.heat) === 2` | MAX heat across rooms 6-8 in ONE run (`clear8`, `t.r === 3`). That goes beyond `PLAQUE.MAX` + `PLAQUE.CROWN`, which a single MAX-heat room-8 start earns together |

**Ruling 2026-10-08 (R6 review, FLAWLESS premise):** `t.d` did not count lives
lost. `feedTally` compares lives once per frame, a frame runs up to 7 sim steps,
and a HEART (`entities.js:41`, the only `lives++`) plus a lost life in one frame
left lives level. `feedTally` now expects `t.lv` plus the batch's `power`
events with `kind === "heart"`, so the FLAWLESS/UNSCATHED rows hold. App layer only.

**Rejected from the pool:**

| candidate | reason |
|---|---|
| MAX-heat finale clear | = `PLAQUE.MAX` (§1.2) |
| room-8 (FUSE/GRID) clear | = `PLAQUE.CROWN` (§1.2) |
| first KNIGHT kill | Every room-8 clear kills a knight and earns `PLAQUE.CROWN`, and a run may start at room 8; a kill on a LOSE is easier than CROWN (§1.3) |
| 9/9 foes | Room 8 holds all nine types and every room-8 clear kills them all, so = `PLAQUE.CROWN` (§1.3). Needs a mask for no extra difficulty |
| 12/12 powers | Not hard (§1.4) |
| a 6→8 speed medal | Room 8 has 2 bot clears in 400 boards (§4.4), which is no basis for a threshold |

**Ruling 2026-10-08 (spec review, findings 1 and 8):** KNIGHTFALL is dropped,
not kept with an honest rewrite (finding 8's first option) and not gated on a
room-6 start (option b). A room-8 start plus one death would unlock it, which is
easier than `PLAQUE.CROWN` and fails the R6 "genuinely HARD" test; the room-6
gate needs two start-room forms and extra pins for a medal that is nearly a
6→8 clear. ALL IN splits into ALL IN (1-5) and ALL OUT (6-8) instead,
mirroring FLAWLESS/UNSCATHED and OVERDRIVE/REDLINE. Every medal now needs a WIN.

**Deviation, recorded:** the pool yields four kept candidates (FLAWLESS,
ALL IN, OVERDRIVE, SPRINT). The other four (UNSCATHED, ALL OUT, REDLINE,
IRON CROWN) are tiers of the same pool axes (L5 vs L8, MAX + rooms 6-8). No new
mechanic is invented to fill the count.

### 4.2 The full-run predicate — derived, no new run state

`tally.r` counts `{t:"win"}` events (`bests.js` `feedTally`) and resets at every
run start (`main.js:162,217,275,629`). At a finale WIN it includes the final
room. The run's start room is therefore `w.level - t.r + 1`:

```
clear5 = w.state === "WIN" && (w.level | 0) === 5 && t.r === 5   // started at 1
clear8 = w.state === "WIN" && (w.level | 0) === 8 && t.r === 3   // started at 6
```

A LEVEL SELECT start at 2..5 or 7..8 is never a full run, and neither is a
debug-hook `advance()` (no win event).

### 4.3 `src/app/medals.js` (new)

```
MEDALS_KEY = "nb.medals.v1"
MEDAL      = Object.freeze({FLAWLESS:1, UNSCATHED:2, ALLIN:4, ALLOUT:8,
                            OVERDRIVE:16, REDLINE:32, SPRINT:64, IRONCROWN:128})
MEDAL_ROWS = Object.freeze([[name, desc], …8])   // index i  <->  bit 1<<i
SPRINT_S   = 180
```

The store follows the `plaques.js` template exactly: `String(int)`, `parseInt`,
non-finite gives 0, `& 255` on load and save, try/catch, injectable `store`.

- `unlockMedals(world, tally, runT)` (pure) returns the bits of §4.1.
- `settleMedals(world, tally, runT, store)`:
  - `prev = loadMedals(store)`
  - if `prev | unlockMedals(…)` differs from `prev`, it saves it
  - returns **`loadMedals(store) & ~prev`**, a read-back

  The return is the bits that are now **persisted** and were not before. If
  `setItem` throws, it returns 0 and nothing is announced ("a delta that cannot
  lie").
- `medalLine(bits)`:
  - 0 → `""`
  - 1 bit → `MEDAL · IRON CROWN`
  - 2–3 bits → `MEDALS · A · B · C`, in bit order
  - ≥4 bits → `N NEW MEDALS` (a plain count; no instruction to visit STATS,
    which a touch player cannot follow)
- `medalRows(mask)` returns eight `[name, desc, on]` for the trophy page. The
  names live **only** here and reach `render/` as finished strings (the
  `coachTip` precedent, wave-2 §1.5).

**Descriptions** (≤ 46 chars):

| name | description |
|---|---|
| FLAWLESS | `ROOMS 1-5 IN ONE RUN · NO LIFE LOST` |
| UNSCATHED | `ROOMS 6-8 IN ONE RUN · NO LIFE LOST` |
| ALL IN | `ROOMS 1-5 IN ONE RUN · ALL FOUR PACTS` |
| ALL OUT | `ROOMS 6-8 IN ONE RUN · ALL FOUR PACTS` |
| OVERDRIVE | `ROOMS 1-5 IN ONE RUN ON HARD PACE` |
| REDLINE | `ROOMS 6-8 IN ONE RUN ON HARD PACE` |
| SPRINT | `ROOMS 1-5 · CORE · NORM · NO PACT · UNDER 3:00` |
| IRON CROWN | `ROOMS 6-8 IN ONE RUN AT MAX HEAT` |

### 4.4 The SPRINT threshold — measured, reproducible from this text

**Method.**
- The attract demobot (`src/app/demobot.js`, its own seed equal to the board
  seed) plays one room fresh. That means no carry and base stats.
- Config is CORE, pact 0, NORM.
- Boards are `seed_i = (i*2654435761)>>>0` for `i = 1..400`.
- Each board runs at `CFG.STEP` until WIN, LOSE or 300 s of sim time.
- Sim time in PLAY equals `roomT`/`runT` with no pause. The full-run variant
  chains rooms exactly as `sim.js:54-60` does, with a 900 s cap.

The whole script, for re-measurement:

```js
import { CFG } from "./src/core/config.js";
import { createWorld, loadLevel, step } from "./src/core/sim.js";
import { createDemobot } from "./src/app/demobot.js";
for (let lv = 1; lv <= 8; lv++) { const ts = []; let lose = 0, cap = 0;
  for (let i = 1; i <= 400; i++) { const seed = (i * 2654435761) >>> 0;
    const w = createWorld(seed, lv); w.heat = 0; w.pact = 0; w.pace = 0;
    loadLevel(w, lv, false); w.state = "PLAY"; const bot = createDemobot(seed);
    let t = 0;
    while (t < 300 && w.state === "PLAY") { step(w, CFG.STEP, { 0: bot.intent(w) }); w.events.length = 0; t += CFG.STEP; }
    if (w.state === "WIN") ts.push(t); else if (w.state === "LOSE") lose++; else cap++; }
  ts.sort((a, b) => a - b); const q = (p) => ts[Math.floor(p * ts.length)];
  console.log(lv, ts.length, lose, cap, ts[0], q(0.1), q(0.5)); }
```

**Results (2026-10-08, tree `bcaf1e3`), seconds:**

| room | win / lose / cap (of 400) | min | p10 | p25 | p50 |
|---|---|---|---|---|---|
| 1 | 55 / 19 / 326 | 37.1 | 45.3 | 53.2 | 72.8 |
| 2 | 26 / 58 / 316 | 28.6 | 54.1 | 63.4 | 84.7 |
| 3 | 11 / 60 / 329 | 43.3 | 44.3 | 47.9 | 64.1 |
| 4 | 33 / 112 / 255 | 29.7 | 36.7 | 52.1 | 72.1 |
| 5 | 19 / 117 / 264 | 43.0 | 59.1 | 96.1 | 131.5 |
| 6 | 10 / 146 / 244 | 81.3 | 84.9 | 89.1 | 130.7 |
| 7 | 7 / 201 / 192 | 83.4 | 83.4 | 103.0 | 154.1 |
| 8 | 2 / 237 / 161 | 155.3 | 155.3 | 155.3 | 158.7 |

The full-run variant (1→5 chained, N=50, cap 900 s) gave **0 clears** (43 cap,
7 lose).

**Threshold.** The sum of the room 1–5 minima is
37.1 + 28.6 + 43.3 + 29.7 + 43.0 = **181.7 s**. `SPRINT_S = 180`, so the rule is
`runT < 180.0`: every room at the bot's single luckiest board of 400.

**Biases, disclosed:**
- **The minima are luckiest boards, but a human's boards are learnable.** Every
  seedless run in a session replays `bootSeed`'s boards (`main.js:74,205`), and
  `?code=` and DAILY let a player pick and repeat a board. The R9 ghost then
  shows the route. SPRINT is attempted on repeatable boards, which is easier.
  `SPRINT_S = 180` stays anchored on the bot measurement (re-run in spec review;
  it reproduced 37.1/28.6/43.3/29.7/43.0, sum 181.7, exactly).
- **There was no carry.** A human with FLAME/BOMB carry is faster, which is
  easier.
- **`runT` errs slow.** It keeps counting through the `steps > 6` anti-spiral
  drop (`main.js:652-655`), so it can only over-state a time and never
  false-award SPRINT.

The medal is pinned to the measured config (CORE, no pact, NORM), the same plain
bucket STATS' bests use (`stats.js:160,217`).

### 4.5 Wiring

**`main.js` (+2 lines, see §8):**
- `import { settleMedals, medalLine, medalRows, loadMedals } from "./app/medals.js";`
- `isRunEnd` is added to the existing `scenes.js` import (`:9`).
- `endRun` gains one line, after the daily write (`:171`):
  `if (isRunEnd(world)) tally.mn = settleMedals(world, tally, runT);`
  - Quits (RESTART / QUIT / KeyM) reach `endRun` in PAUSE, so they never
    evaluate. The ruling says ONLY run ends. Every medal needs a finale WIN, so
    a LOSE evaluates but can never unlock.
  - The `runEnded` latch (`:166`) makes evaluation happen exactly once per run.
- `newTally()` (`bests.js`) gains `mn: 0`, so a new run clears the announcement.
- `ro.run` (`:747`) gains `md: medalLine(tally.mn)`.
- `onStats` (`:263-264`) adds `trophies: medalRows(loadMedals())` to `app.stats`.
  The trophy page is only reachable through STATS, so this is never stale.
- The audio `confirm` wrapper's exclusion (`:329`) gains `&& sB !== SCREEN.TROPHIES`,
  on the same line. This is line-neutral.

**Overlay** (`scenes.js` `summaryLines`, `:161-172`): inside the
`isRunEnd(world)` branch, after the delta/daily line,
`if (run.md) out.push([run.md, "#ffd447"])`.

**Stack** (24 px pitch, `scenes.js:242-258`):

| case | stamp | tally | delta | medal | time | cue |
|---|---|---|---|---|---|---|
| LOSE | 20 | 44 | 68 | 92 | — | 116 |
| finale WIN with TIME ATTACK (worst) | 20 | 44 | 68 | 92 | 116 | 140 |

At `dy` 140 the medal stack reaches y=400 in the 600×520 box (`cy 260`), and
y=328 in iso (`cy 188`, h 352: 16 px clear of the edge after the 7.5 px
half-glyph).

**Widths at 15 px:** the longest reachable form,
`MEDALS · UNSCATHED · REDLINE · IRON CROWN`, is 41 chars = 369 px. The count
form `4 NEW MEDALS` is 12 chars = 108 px. Both are ≤ 552 (600 − 48).

The most medals one run can unlock is 4. A 6→8 run at MAX, HARD, all four pacts
and no life lost unlocks UNSCATHED, ALL OUT, REDLINE and IRON CROWN, so the
count form is reachable. A 1→5 run can unlock at most 3 (FLAWLESS, ALL IN,
OVERDRIVE), because SPRINT needs pact 0 and NORM pace, which excludes ALL IN
and OVERDRIVE.

The line appears one frame after the WIN/LOSE frame, because the edge is
evaluated at the top of the next frame (`main.js:619,613`). It is
indistinguishable on screen and is disclosed, not fixed.

**Trophy screen:**
- `menuapp.js`:
  - `SCREEN.TROPHIES = 13` is appended.
  - `key()` gains `case "KeyT": return this.screen === SCREEN.STATS ? this._push(SCREEN.TROPHIES) : false;`.
  - `back()` maps TROPHIES to `_push(SCREEN.STATS)`.
  - `confirm()`'s back-out list gains TROPHIES, which calls `back()`, returning to STATS.
  - KeyT is not consumed by `onUiKey`, so it reaches `app.key`. It plays no cue
    (the `KeyC`-copy precedent).
- `debughook.js` `SCREEN_NAME` appends `"TROPHIES"`.
- `shellview.js` gains a TROPHIES branch:
  `drawDim(0.72)` + `menudraw.drawTrophies(c, L, app.subT, app.stats && app.stats.trophies)`.
- `menudraw.drawTrophies(c, L, t, rows)`:
  - `shell(c, L, 480)`
  - `head(c, S, "MEDALS", n + "/8")`. Player copy names the page by what it
    holds; `SCREEN.TROPHIES` stays the internal name the ruling uses
  - eight rows, from `top = S.headY+22` to `bot = S.footY-18`
  - each row: name left at `S.ix` in `font(11,"900")`, description right-aligned
    at `S.ix+S.iw` in `font(10)`. Unlocked rows use ACCENT/TEXT; locked rows use
    MUTED at `globalAlpha 0.45`. Locked descriptions are SHOWN: the page is the
    goal list.
  - foot `ENTER / ESC BACK TO STATS`

  **Measured:**
  - 600×520: `rowH` (458−121.2)/8 = 42.1
  - 608×352: (290−94.32)/8 = 24.46
  - Widest row is a 10-char name (66 px) plus a 46-char description (276 px),
    342 of 448 px, leaving a gap of at least 106 px.
- The STATS foot (`menudraw.js:878`) becomes `T MEDALS · C COPY MY STATS · ESC BACK`
  (37 chars = 222 px). Reset extends it in §7.

**Disclosed:** touch players see the run-end medal line but cannot open the
MEDALS page, because the ruling opens it by a key. A tap on STATS stays
confirm = back.

### 4.6 Pins — `tests/medals.test.mjs` (new) + additions

1. Store:
   - `MEDALS_KEY === "nb.medals.v1"`
   - round trip `255`; `"999"` loads as `999 & 255`; junk and absent load as 0
   - a throwing store loads 0 and save does not throw
   - `nb.plaques.v1` is untouched by every medal call
2. **One unlock pin and one no-unlock pin per medal**, on synthetic
   `{world, tally, runT}`:

| medal | unlocks | does not unlock |
|---|---|---|
| FLAWLESS | L5 WIN, r 5, d 0 | same with d 1. Also r 1 (a LEVEL SELECT start at 5) |
| UNSCATHED | L8 WIN, r 3, d 0 | d 1. Also r 1 (a start at 8) |
| ALL IN | L5 WIN, r 5, pact 15 | pact 14. Also LOSE with pact 15. Also L8 WIN, r 3, pact 15 (that is ALL OUT) |
| ALL OUT | L8 WIN, r 3, pact 15 | pact 14. Also L5 WIN, r 5, pact 15 (that is ALL IN). Also r 1 (a start at 8) |
| OVERDRIVE | L5 WIN, r 5, pace 1 | pace 0 |
| REDLINE | L8 WIN, r 3, pace 1 | L5 WIN, r 5, pace 1 (that is OVERDRIVE, not REDLINE) |
| SPRINT | L5 WIN, r 5, h0/p0/pace0, runT 179.9 | runT 180.0. Also heat 1 at 120 |
| IRON CROWN | L8 WIN, r 3, heat 2 | heat 1. Also L5 WIN, r 5, heat 2 (that is `PLAQUE.MAX`). Also L8 WIN, r 1, heat 2 (a room-8 start: `PLAQUE.MAX` + `PLAQUE.CROWN` only) |

Also: a LOSE at L8 with `t.r` 2, `t.d` 0, pact 15, pace 1, heat 2 and
`kt.knight 1` unlocks nothing.

3. `settleMedals`:
   - returns only newly set bits
   - a second identical settle returns 0
   - with a throwing `setItem` it returns 0 (no announcement without persistence)
4. `medalLine` produces all four forms. Each form is ≤ 552 px at 15 px × 0.6 em.
5. `medalRows` returns 8 rows. Names are unique. Descriptions are ≤ 46 chars.

**Additions:**
- `tests/bests.test.mjs:237-239` and `tests/stats.test.mjs:244-245`: key list
  gains `mn`.
- `menuapp.test`:
  - `SCREEN.TROPHIES === 13` (SCREEN pin row `:69-74`)
  - KeyT on STATS pushes TROPHIES; KeyT on MENU does nothing
  - `back()`/`confirm()` on TROPHIES go to STATS
  - `ITEMS` is unchanged (8 rows, same order)
- `menudraw.test`: `drawTrophies` paints the head `MEDALS`, all 8 names and the
  foot inside `S` at both plates. `rows` undefined paints 8 locked placeholders
  without throwing. The STATS foot is `T MEDALS · C COPY MY STATS · ESC BACK`.
- `scenes`: `summaryLines` adds the gold medal line only when `isRunEnd` and
  `run.md` is non-empty. A mid-room WIN with `md` set prints none.
- `headless`:
  - an ATTRACT session of 600 frames (setup in §3.4) leaves `nb.medals.v1`
    absent
  - a staged LOSE writes nothing to `nb.medals.v1`
  - a pause QUIT during a staged 6→8 run writes nothing
  - with `nb.pact.v1 = "1"` pre-seeded (`roomCap(false)` is 5, so a room-6
    start needs the unlock), a staged 6→8 finale WIN at MAX heat, pact 0, NORM,
    one life lost (`t.r` 3, `t.d` 1) writes exactly bit 128 and the overlay text includes
    `MEDAL · IRON CROWN`
  - `state()` names `TROPHIES`

**Commit:** bumps **v148**. SRC gains `src/app/medals.js`.

---

## 5. R9a — ghost store, recorder, CLASSIC 2D ghost

### 5.1 Intended behaviour (written down, per the ruling)

A ghost needs the same `{seed, level, heat, pact, pace}`. It therefore appears
on:
- **DAILY** (same date seed)
- **`?code=`** boards
- **same-session retries and replays** (an ordinary run uses the session's
  remembered `bootSeed`, `main.js:74,205`)

It **never** appears on a fresh boot's first ordinary run, because a new boot
draws a new `bootSeed`. That is by design, not a bug.

### 5.2 `nb.ghost.v1` — `src/app/ghost.js` (new)

```
GHOST_KEY = "nb.ghost.v1"   GHOST_V = 1   GHOST_MAX = 16   GHOST_HZ = 10   GHOST_CAP = 2400
KEY_RE = /^\d{1,10}:[1-8]:[0-2]:(?:[0-9]|1[0-5]):[0-2]$/
```

- **Key** `ghostKey(w)` = `` `${w.seed>>>0}:${w.level|0}:${clampHeat(w.heat)}:${clampPact(w.pact)}:${clampPace(w.pace)+1}` ``.
- **Blob** `{ v: 1, g: { "<key>": { d, s } } }`.
  - `d` is the clear time in integer tenths `1..2400`. It is `floor(roomT*10)`
    at the WIN frame, the same floor `recordTime` uses (`times.js:87`).
  - `s` is the samples string.
- **Sample** = 5 chars, where `b36(n)` is exactly
  `n.toString(36).toUpperCase().padStart(2,"0")` (`toString(36)` alone emits
  lowercase, which `clampGhost` would discard):
  - `b36(round(x/2))`
  - `b36(round(y/2))`
  - one digit `(sign(fx)+1)*3 + (sign(fy)+1)`, range 0..8. `face` may be
    diagonal or idle; `sim.js:119-122` only writes it while moving.
  - The board is at most 600×520 px, so `x/2 ≤ 300 < 36² = 1296`.
- **`clampGhost(raw)`**:
  - `v !== 1` gives `{v:1,g:{}}`. This is the version stamp: a future encoding
    reads an old blob as empty instead of misreading it.
  - It drops keys failing `KEY_RE` and entries whose `d` is not an int in range,
    or whose `s` is not `/^[0-9A-Z]+$/` with `length % 5 === 0` and
    `1 ≤ length/5 ≤ GHOST_CAP`.
  - It keeps the last 16 keys in insertion order (the `times.js:41-50` argument:
    the keys are non-integer-like).
- **LRU.** Insertion order is recency. Both a write and a race-load re-insert
  the key at the end (delete, then set), and overflow drops the first.
- **Size.**
  - Why 16 entries: two full 8-room runs, or a 5-room daily plus a full 1→5
    plus a 6→8 run (13 entries), with headroom. A cap of 8 would evict the
    daily's early rooms within one session.
  - Why 2400 samples (240 s): above every room's bot median (max 158.7 s, §4.4)
    by more than 1.5×.
  - Worst case is 16 × 12 KB = 192 KB. A typical 60 s room is 3 KB, about
    50 KB in all.
- **Throwing / quota.** `load` and `save` are try/catch. A failed `setItem`
  leaves the previous blob intact (it is atomic) and the run continues with no
  ghost saved.

### 5.3 Recorder — read-only, PLAY-only, room detected by `world.grid` identity

`loadLevel` assigns a fresh `w.grid` object on every room load (`world.js:75`):
`onStart`, RESTART, the sim's own retry (`sim.js:107-111`), WIN→next room and
the debug `advance()`. SHRINK and brick breaks mutate it in place. So
`g.grid !== world.grid` is an exact, read-only "a room began" signal. It needs
no new hook at any of the four reset sites.

```
createGhost()                        -> {grid:null, key:"", s:"", n:0, done:true, race:null}
ghostTick(g, world, roomT, store)    // once per GAME frame, BEFORE the step loop (§5.3 frame order)
  1 world.grid !== g.grid -> new room: grid, key=ghostKey(world), s="", n=0, done=false,
                             race = decoded entry for key (LRU-touched) or null
  2 state PLAY && !done   -> want = floor(roomT*10)+1; want > GHOST_CAP -> done=true (too long, never saved);
                             else append current player x/y/face until n === want
  3 state WIN  && !done   -> done=true; d = max(1, floor(roomT*10));
                             save {d, s} iff no stored entry or d < stored.d (re-read at save time)
ghostAt(g, world, roomT)             -> null unless world.grid === g.grid && race && state in {PLAY, PAUSE} && roomT*10 <= k-1
                                        (k = race sample count); else {x, y, fx, fy, t}: x/y lerped between
                                        samples floor(roomT*10) and +1, face from the earlier sample, t = roomT
```

- **PAUSE-proof by construction.** `roomT` only advances in PLAY
  (`main.js:641`), so sample `i` is always room-time `i/10`. A paused ghost
  freezes, because `roomT` freezes.
- **Frame order — why the tick runs BEFORE the step loop.** Two of the four
  room starts happen inside `step()`: the sim's retry (`sim.js:67-74`) and
  WIN→next room (`sim.js:54-60`). Their `roomT = 0` reset lands only at the
  NEXT frame's edge block (`main.js:627-628`).
  - A tick placed after the step loop would see the new grid in PLAY with the
    previous room's final `roomT`. It would append `floor(roomT*10)+1` spawn
    samples, and a later faster clear would save that static trail. A prior
    `roomT` above 240 s would also mark the new room `done` on its first frame.
  - **Lock:** `ghostTick` sits on the line directly after the PLAY-only
    accumulator (`main.js:641`), before `while (acc >= CFG.STEP)`. On all four
    paths this holds:
    1. On frame N (the transition step) the tick still sees the OLD grid in
       WIN/LOSE, so it is a no-op.
    2. On frame N+1 the new grid arrives with `roomT` already reset and
       advanced by exactly one `dt`.
    3. `onStart` and RESTART zero `roomT` synchronously, so they are trivially
       correct.
  - The `world.grid === g.grid` check in `ghostAt` stops frame N from drawing
    the old room's race at a stale time.
  - Samples are the pre-step position at `roomT`, drawn against the post-step
    live player at the same `roomT`, so the ghost trails by a constant one
    frame (~16 ms), below perception.
  - `want` is exactly `floor(roomT*10)+1`, the same floor `times.js:87` uses.
    The recorder never adds an epsilon; the `s.length/5 === d+1` contract
    depends on the two floors agreeing.
- **WIN detection** is one frame after the WIN step, with the same `roomT` R7
  records on that frame, since PLAY accumulation is skipped once the state is
  WIN (`main.js:619-622,641`).
- `ghostTick` only reads `world`. It writes nothing back, emits no events and
  never touches `world.events`. `main.js` never passes it to `step()`.
- **Attract:** `ghostTick` is called only in the GAME branch with the live
  `world`. The demo world is stepped in the non-GAME branch (`main.js:695-699`),
  so attract never records.

### 5.4 Wiring

**`main.js` (+3 lines):**
- `import { createGhost, ghostTick, ghostAt } from "./app/ghost.js";`
- `const ghost = createGhost();` beside `let coach2` (`:138`)
- `ghostTick(ghost, world, roomT);` on its own line directly after the PLAY-only
  accumulator (`:641`), before the step loop (§5.3 frame order). It reads no
  events, so the drain order does not matter to it.
- The GAME `ro` literal gains `ghost: ghostAt(ghost, world, roomT),` on the
  `time:` line (`:746`), which is line-neutral.
- ATTRACT and INTRO `ro` carry no ghost.

**`renderer.js`** 2D branch (`:57-65`): between `drawBlades` and `drawEnemies`,
`if (o && o.ghost) drawGhost(ctx, world, o.ghost);`.
- The ghost goes under foes and the live player, so it never hides a threat.
- The iso branch draws none.

**`sprites.js`** `drawGhost(c, world, g)`:
- `save`, then `globalAlpha = GHOST_A` (0.4), then `translate(g.x, g.y)`
- `drawPlayerBody(c, world, {face:{x:g.fx,y:g.fy}, walk:g.t, iFrames:0, kick:false, shield:false, passing:false})`
- `restore`

**Ruling 2026-10-08 (R9a review, walk clock):** `walk:world.time` contradicted
"PAUSE freezes it". `world.time` advances in PAUSE, so the ghost kept its walk
bob (about ±1.6 px at 2.9 Hz) while its x/y held. `ghostAt` now also returns
`t: roomT`, and `drawGhost` walks on `g.t`, which freezes in PAUSE the way the
live `p.walk` does. The fin flick stays on `world.time`, as it does on the live
player. The ghost still bobs in PLAY while the recorded player stood still,
because faces are recorded and walk is not. That is accepted.

Facts this relies on:
- With those flags `drawPlayerBody` sets no absolute `globalAlpha`
  (`sprites.js:464,575-582` are the only sites, all state-gated), so the whole
  body draws at 0.4.
- `color` is absent, so the fins take the default `#37f0d0` (`sprites.js:458`).
  This is the same character with no re-hue, per AGENTS.md: separation is
  structure, never colour.
- There is no blink, so there is nothing for REDUCE FLASH to gate.

### 5.5 Pins — `tests/ghost.test.mjs` (new) + additions

1. **Codec.**
   - Samples written by the real recorder and saved through the real encoder,
     then reloaded through `loadGhost`/`clampGhost`, survive and round-trip
     x/y within 1 px and every face pair in {-1,0,1}². (A bare decode would
     pass a lowercase encoder that `clampGhost` then discards.)
   - `ghostKey` matches `KEY_RE`. Pace −1/0/1 maps to segment 0/1/2.
2. **`clampGhost`.**
   - Drops `v:2`, a bad key, `d:0`, `d:2401`, an `s` of length 7, lowercase `s`.
   - Keeps 16 of 20 (the last 16).
3. **LRU.** A race-load of the oldest key survives the next insert. An
   un-touched oldest key is evicted.
4. **Faster-only.**
   - `d 412` is stored.
   - `d 500` leaves 412.
   - `d 300` replaces it.
   - `d 412` again leaves it untouched (strict).
5. **PLAY-only sampling.**
   - 3 s of PLAY at dt 1/64 (exactly representable: `roomT` lands on 3.0)
     gives 31 samples. (At dt 1/60, 180 additions give 2.9999999999999942,
     so the count is 30; the recorder must not be "fixed" with an epsilon.)
   - Another 2 s in PAUSE (`roomT` frozen) adds 0.
   - A single dt of 0.25 s pads to the correct count.
6. **Room detection.** A new `grid` object resets the recording and loads the
   tuple's race. The same grid mutated in place does not. `ghostAt` returns null
   while `world.grid !== g.grid`.
6b. **Sim-internal room start (fails if the tick sits after the step loop).**
   Headless, through `main.js`'s real loop:
   - stage a room-1 clear
   - then a LOSE→retry, which is `startGame` inside `step()`
   - then a faster clear

   Assert:
   - the saved entry has `s.length/5 === d + 1`
   - sample 1 is not at the spawn point
   - the retry's first recorded sample was taken at `roomT <= 1/30`

   Repeat the same check across WIN→next room.
7. **Cap.** A room run past 240 s of `roomT` sets `done` and never saves.
8. **Survival.**
   - `getItem` throws: no race.
   - `setItem` throws: no throw, previous blob intact, run continues.
   - A null store is a no-op.
9. **`ghostAt`.**
   - Lerps the midpoint between two samples.
   - Returns null in WIN/LOSE.
   - Returns null past the race's last sample.
   - Returns null with no race.
   - Freezes in PAUSE.
10. **Tuple gate.** A ghost saved at pace 0 is not raced at pace 1, or with a
    different seed, heat or pact.
11. **Read-only.** `world` deep-equals its snapshot after 600 `ghostTick` calls.
    `world.events` length is unchanged.

**Additions:**
- `headless`:
  - ATTRACT for 600 frames (setup in §3.4) leaves `nb.ghost.v1` absent
  - a staged GAME room clear writes exactly one entry under the run's tuple
  - a LOSE→retry of room 1 makes `ro.ghost` non-null on the retry's first PLAY
    frames
  - the `src/core` tree has no import of `src/app/ghost.js`
- `menudraw`/`sprites` recorder:
  - `renderer.render(world, dt, {ghost})` emits `drawPlayerBody` fills at
    `globalAlpha 0.4` before the live player's
  - without `o.ghost` the op stream is byte-identical to today's

**Commit:** bumps **v149**. SRC gains `src/app/ghost.js`. This step takes the
one line-cap raise (§8).

**Headed check (acceptance, required):**
- 2D, room 1 retry: the ghost runs its route and vanishes at its clear time;
  PAUSE freezes it.
- **VOID (room 7) beside a live SHADE: the ghost's two chevron fins must read as
  fins**, with both tips past the body half-width (AGENTS.md MAKO), against
  SHADE's hood. A pass needs that structural read. If it fails, the remedy is
  `GHOST_A` (alpha only, ≤ 0.5), never a re-hue.
  - Also ask: does the ghost read as *you*, not as a foe? Nothing in the shell
    explains it. If it fails, record a follow-up only; no copy in this wave.
- **Beside a `stationary` foe (rooms 1-5):** `stationary`'s `#c58aff` shares
  MAKO's hue (AGENTS.md discloses it as un-clearable). The ghost must still
  separate by structure. If it fails, the remedy is alpha or structure, never a
  re-hue.
- Stage a VOID race by writing a ghost entry for a `?code=` board.
- Unregister the service worker first (AGENTS.md).

---

## 6. R9b — REAL 3D ghost

- **`entities.js` `createPools`** gains a closure `let ghostMesh = null` and a
  returned `ghost(g)`:
  - **g null or absent:** if a mesh exists, set `visible = false`; return.
  - **First g:** build ONE mesh and `group.add` it. The mesh is:
    - geometry `mergeGeos` of **clones** of the five player parts
      (`entities.js:935-972`), pre-transformed:

      ```
      const m = new THREE.Matrix4().makeRotationX(-0.6).setPosition(0, T*0.53, T*0.2);
      const parts = [body.geometry.clone(), fins.geometry.clone(),
        face.geometry.clone().applyMatrix4(m),
        footGeo.clone().translate(-T*0.17, T*0.08, T*0.06),
        footGeo.clone().translate(T*0.17, T*0.08, T*0.06)];
      const geo = mergeGeos(...parts); for (const p of parts) p.dispose();
      ```

      - Never `translate`/`applyMatrix4` the live geometries: they belong to
        the live MAKO, and `footGeo` is ONE shared geometry under both feet.
        Mutating them corrupts the player in place, and the child-order ABI pin
        would not catch it.
      - The face matrix is built explicitly from the literal position and rake
        (the values at `entities.js:962-963`), never read from `face.matrix`,
        which stays identity until `updateMatrix()` or a GL render. Node tests
        have no `gl.render`, so a `face.matrix` read would build an unrotated
        face there and a rotated one in the browser.
    - material `MeshLambertMaterial({color: PLAYER_HULL, transparent: true, opacity: 0.4, depthWrite: false})`
    - `castShadow = receiveShadow = false`, `userData.tag = "ghost"`
  - **Every g:** `visible = true`, position `(g.x - W2, CFG.TILE*0.05, g.y - D2)`,
    `rotation.y = atan2(g.fx, g.fy)` (the player's own facing rule,
    `entities.js:1224-1227`).
  - The ghost is **not** a child of `player`. `player.children` stays the
    five-mesh slot and `SLOT_MESH` is unchanged.
  - It is disposed with the group on a rebuild. A new room's pools start with
    no ghost until the next `o.ghost`.
- **`wrapper.js` `render`**, after the update/rebuild lines (`:120-121`):
  `if (sc) sc.pools.ghost(o && o.ghost);`.
- **Draw calls.** The ghost is built lazily, so a scene that never raced keeps
  **fat-world 141**. All four existing pins are unmoved:
  - `three.test.mjs` S4.E `:1539` and EI.10 `:1772-1774`
  - `pickup-3d.test.mjs:225-226`
  - `enemies-art.test.mjs:462`

  A racing scene is **142** (+1: one merged mesh, one material, one draw),
  well under 500.
- **AGENTS.md**: "fat-world 141" becomes "fat-world 141 (142 while a ghost
  races)", in the same commit as the pin.

**Pins (`tests/three.test.mjs`, new section):**
- The fat world rendered with no `o.ghost` stays at 141.
- The same world rendered with `o.ghost` is 142 and ≤ 500.
- The ghost mesh: `castShadow === false`, `material.transparent`,
  `opacity === 0.4`, `depthWrite === false`, `tag === "ghost"`, and no ancestor
  tagged `player`.
- `pools.player.children.length === 5`, with the child order and geometry types
  unmoved (the `:1050-1060` ABI).
- Every live player child's `geometry.attributes.position.array` is
  byte-identical before and after the first ghost build.
- A render with the ghost and then one without leaves `ghost.visible === false`.
  A level change rebuild leaves no ghost mesh until the next `o.ghost`.

**Commit:** bumps **v150**.

**Headed check:** REAL 3D, room 1 retry, VOID and the `stationary` foe as in
§5.5. The 3D ghost is one `PLAYER_HULL` Lambert with no teal fins, so the
`stationary` check matters more here; a fail is fixed by alpha or structure,
never a re-hue. The plan-view chevron must be legible from the frozen rig
(`el:0.54`), and the ghost must not shadow the board.

---

## 7. Reset my cabinet (last, so it knows every R6/R9 key)

### 7.1 `src/app/reset.js` (new)

The module imports each store's own key constant, so a literal is never retyped:

```
CLEAR_KEYS = [HS_KEY, BESTS_KEY, STATS_KEY, DAILY_KEY, TIMES_KEY, MEDALS_KEY,
              PLAQUES_KEY, GHOST_KEY, PACT_KEY, COACH_KEY, COACH2_KEY, CABINET_KEY]   // 12
KEEP_KEYS  = [SETTINGS_KEY, PACE_KEY]   // nb.settings.v1 (render/volume/brightness/camera/shake/flash), nb.pace.v1
clearCabinet(store) -> removeItem each CLEAR key, each in its own try/catch; never throws
```

**Disclosed effects:**
- **TIME ATTACK resets to off.** Its `on` bit lives in `nb.times.v1`
  (`times.js:51`). It is gated behind the pact unlock (`menuapp.js:543`), which
  is also cleared, so the two stay consistent.
- **Boot behaves as a first visit.** Clearing `nb.cabinet.v1` and `nb.pact.v1`
  makes the next boot a first-visit `bootFromIntro` straight into a CORE run
  (`menuapp.js:356-361`). That is what "a fresh cabinet" means.
  - **Except with a query string.** `location.reload()` keeps it. A cabinet
    opened via `?code=` or `?play=1` re-runs `saveCabinetSeen()` at boot
    (`main.js:345,348`) and starts a run straight away, so the reset lands in a
    run with the cabinet already marked seen. Disclosed; `location.reload()` is
    the ruling's named call and is not swapped for `location.replace` without
    an owner ruling. The headed check runs on a bare URL.
- **HIGH SCORES shows `DEFAULT_SCORES` again** (`highscores.js:6-19`).
- **DAYS PLAYED returns to 0.** Reset is the one explicit way it ends (R12's
  "never lost" is about streak mechanics, not about the player's own erase).

### 7.2 The two-press confirm

**`menuapp.js`:**
- New field `resetArm: false`.
- `_push` clears it, so every screen visit starts disarmed.
- `key()` gains:

```
case "KeyR":
  if (this.screen !== SCREEN.STATS) return false;
  if (this.resetArm) { this.resetArm = false; if (o.onReset) o.onReset(); return true; }
  this.resetArm = true; return true;
```

- OS auto-repeat never reaches here (`input.js:37`). Holding R is one press, so
  one physical hold can never confirm.

### 7.3 Key routing — `main.js`

- **R reaches `app.key` on STATS only.** The `KeyR` intercept (`:375`) becomes
  `if (code === "KeyR" && app.screen !== SCREEN.STATS) {`. This is line-neutral.
  R still resets the camera in GAME and is still swallowed everywhere else; in
  particular it does **not** start a run from ATTRACT. *(Superseded 2026-10-10:
  R and M on ATTRACT now leave like any key into an ordinary CORE run; R still
  never arms reset or resets the camera there.)*
- **Every other key disarms.** A new first line of `onUiKey`:
  `if (code !== "KeyR") app.resetArm = false;` (+1). This also covers the keys
  `onUiKey` consumes before `app.key` (C, M) and those `app.key` ignores.
  - A pointer tap on STATS is `confirm` → `back` → `_push`, so it disarms too.
- **The callback.** `createMenuApp` opts gain
  `onReset: () => { clearCabinet(); if (typeof location !== "undefined") location.reload(); },`
  (+1), plus the `reset.js` import (+1).
- **Why reload.** `bestRun`, `tally`, `dailyRec`, `coachSeen`, `app.pactUnlocked`
  and the cached `settings` live in memory. A later `endRun` / `persistScore`
  would write the erased run back. STATS is outside GAME, so no store write
  happens between `clearCabinet` and the reload.

### 7.4 Copy — `drawStats(c, L, t, ui, arm)` (5th arg from `shellview`: `app.resetArm`)

| state | where | text | fit (10 px) |
|---|---|---|---|
| idle | foot | `T MEDALS · C COPY MY STATS · R RESET · ESC BACK` | 47 ch = 282 px |
| armed | note 1 (#ff5d73) | `ERASES SCORES · BESTS · TIMES · DAILY · MEDALS · PLAQUES · GHOSTS` | 65 ch = 390 px |
| armed | note 2 (#ff5d73) | `ERASES STATS + DAYS PLAYED · RELOCKS ROOMS 6-8 · PACTS · TIME ATTACK` | 68 ch = 408 px |
| armed | foot (#ff5d73) | `R AGAIN ERASES · ANY OTHER KEY CANCELS · KEEPS OPTIONS + PACE · C COPY` (2026-10-10) | 70 ch = 420 px |

- The biggest irreversible loss is named on screen: clearing `nb.pact.v1`
  relocks rooms 6-8, all four pacts and TIME ATTACK, and DAYS PLAYED is named
  beside STATS. Every line is ≤ 74 chars (10 px × 0.6 em against `S.iw` 448).
- Two note slots exist (`menudraw.js:876-877`, `i < 2`); a third note line
  would collide with the last stats row at 608×352, so the keep-list rides in
  the foot.
- The notes and foot draw where they already do, against `S.iw` 448 at both
  plates (`S.footY` 476 / 308). The armed foot has about 11 px of margin each
  side on the estimated advance; the headed check confirms it does not clip.
- The armed lines replace the daily/since notes for the arm's duration. Nothing
  else moves.
- **Keyboard-only, by design and disclosed:** a destructive action with no tap
  path.

### 7.5 Pins — `tests/reset.test.mjs` (new) + additions

1. **The literal sweep.** Every `/["'`](nb\.[^"'`\s]+)["'`]/g` match across
   `src/**/*.js` must be in `CLEAR_KEYS ∪ KEEP_KEYS`. The pattern is
   deliberately loose, so `nb.ghostV2.v1`, `nb.foo_bar.v1` or a bare
   `nb.thing` cannot slip past unclassified. The two lists are disjoint, every
   listed key appears in `src/`, and `KEEP_KEYS` is exactly the settings and
   pace keys. A future store therefore fails here until it is classified.
1b. **No literal storage keys.** No `getItem(` / `setItem(` / `removeItem(`
   call in `src/app/**/*.js` takes a string or template literal as its first
   argument (so `clearCabinet`'s loop variable over `CLEAR_KEYS` passes, and an
   inline `"nb.x"` key cannot dodge the sweep). Today's tree already passes the
   literal sweep.
2. `clearCabinet` on a Map store holding all 14 keys plus `"other.app"` leaves
   exactly the 2 KEEP keys and `"other.app"`. With a throwing `removeItem` it
   does not throw and still removes the rest. A null store is a no-op.
3. **`menuapp`.**
   - KeyR on STATS arms. A second KeyR fires `onReset` once and disarms.
   - KeyR, then `back()`, then STATS again, then KeyR only arms.
   - KeyR on MENU returns false and does not arm.
   - KeyT on STATS disarms (via `_push`).
4. **`headless`.**
   - STATS + R + R: every CLEAR key is gone, both KEEP keys are intact, the
     reload stub was called once.
   - R + C + R: nothing cleared and the arm is up again. C copied as before.
   - R + M + R: nothing cleared.
   - R in GAME still resets the camera and never arms.
   - R on ATTRACT stays swallowed (screen stays ATTRACT). *(Superseded
     2026-10-10: R on ATTRACT starts an ordinary run, never arms or clears.)*
5. **`menudraw`.** The idle foot and the three armed lines paint inside `S` at
   both plates, in `#ff5d73` when armed. Each of the four exact strings in
   §7.4 is ≤ 74 chars, i.e. `[...s].length*10*0.6 <= S.iw` at both plates.

**Commit:** bumps **v151**. SRC gains `src/app/reset.js`.

**Headed check (on a bare URL, no query string, §7.1):** arm, cancel with an
arrow key, arm, confirm. The armed foot does not clip at either plate. The page
reloads into the first-visit boot. OPTIONS values and pace survive.

---

## 8. `main.js` line budget (pin `tests/headless.test.mjs:936-937`, `split("\n").length`)

| step | delta | measured | cap |
|---|---|---|---|
| start (`bcaf1e3`) | — | 804 | 808 |
| R0 | 0 | 804 | 808 |
| R12 | 0 (`ld` on three existing literals) | 804 | 808 |
| R6 | +2 (import; `endRun` medal line) | 806 | 808 |
| R9a | +3 (import; `const ghost`; `ghostTick` line) | 809 | **812** |
| R9b | 0 | 809 | 812 |
| Reset | +3 (import; `onReset`; disarm line) | 812 | 812 |

**Cap ruling (this spec, the wave's one raise): 808 → 812, taken at R9a.**

Reason: `ghostTick` must sit in `createGame`'s GAME branch between the PLAY-only
clock line (`:641`) and the step loop, because `roomT` lives there and the
frame-order argument in §5.3 needs it there. The reset needs
`location.reload()` and the `onUiKey` gate. Neither can live in a seam
module. All logic lives in `medals.js`, `ghost.js` and `reset.js`. `main.js`
gets one import, one state line and one call per feature.

Each step appends its one-line reason to the pin's comment block, in the
`:880-935` convention. If a step comes in under its delta, the cap is tightened
to the measured length so the gate keeps biting.

---

## 9. ABI and pin ledger — what moves, what must not

| Site | Today | New | Plan |
|---|---|---|---|
| `scenes.js:47` PAUSE cue | `↑↓ SELECT · ENTER CONFIRM · P RESUME · M QUIT` | `…· ENTER / TAP CONFIRM ·…` (`heat.test.mjs:67,315`) | R0 |
| `stats.js` `a` | 8 counters + `first`/`last` | + `days`, `day` | R12 |
| `statsRows` / `drawStats` | 9 rows, rule at `6*rowH` | 10 rows, rule at `(n-3)*rowH` (`stats.test:329,352,488`; `menudraw.test:626-629`) | R12 |
| `statsPayload` line 1 | `… · N SESSIONS` | `+ · N DAYS PLAYED` | R12 |
| `bests.js newTally` keys | `b,d,dNew,dr,k,kt,lv,p,pk,r` | `+ mn` (`bests.test:237`, `stats.test:244`) | R6 |
| `SCREEN` | 13 values, `STATS: 12` | **+ `TROPHIES: 13` appended** (`menuapp.test:69-74`) | R6 |
| `ITEMS` / menu indices / `confirm` dispatch table | 8 rows | **unchanged** (`menuapp.test:57-66,323-353`) | — |
| `OPT_ROWS` / `PAUSE_ITEMS` / `GUIDE_ROWS` | frozen | **unchanged** | — |
| `debughook.js SCREEN_NAME` | ends `"STATS"` | `+ "TROPHIES"` | R6 |
| `menudraw` exports | … `drawStats(c,L,t,ui)` | `+ drawTrophies`. `drawStats` gains optional 5th `arm` (absent gives today's draw) | R6, Reset |
| STATS foot | `C COPY MY STATS · ESC BACK` (`menudraw.test:636`) | R6: `T MEDALS · C COPY MY STATS · ESC BACK`. Reset: `+ · R RESET` before `ESC BACK` | R6, Reset |
| `summaryLines` / `ro.run` | stamp, tally, delta/daily | `+ run.md` gold line at run end. `drawOverlay` arity unchanged (9 args) | R6 |
| `renderer.js` 2D draw order | … blades, enemies, player | `+ drawGhost` between blades and enemies, only with `o.ghost` | R9a |
| `sprites.js` exports | … `drawPlayerBody`, `drawPlayer` | `+ drawGhost`, `GHOST_A` | R9a |
| `SLOT_MESH` / player `children` order | `{player:5,enemy:4,bomb:5,item:2}` | **unchanged** | — |
| fat-world draw calls | 141 (4 pins) | **141 unchanged**. New pin: 142 while racing | R9b |
| `createPools` return | `{group, player, …, update}` | `+ ghost(g)` | R9b |
| `wrapper.js render` | — | `+ sc.pools.ghost(o&&o.ghost)` | R9b |
| `main.js` `KeyR` intercept | all screens | all screens except STATS | Reset |
| `main.js` line cap | 808 | 812 (§8) | R9a |
| `src/pwa/shell.js` SRC | — | `+ src/app/ghost.js`, `src/app/medals.js`, `src/app/reset.js` (alphabetised; `pwa.test` walks `src/`) | R6, R9a, Reset |
| `nb.*` keys | 12 | + `nb.medals.v1`, `nb.ghost.v1` = 14, all classified by `reset.test` | R6, R9a |
| `src/core` | — | **no diff** | all |

---

## 10. Ship order, PWA bumps, MEMORY.md

The order is R0 → R12 → R6 → R9a → R9b → Reset. Each step is green under
`node --test`, committed, reviewed, and only then followed by the next.

**PWA rule:** exactly one paired `CACHE_NAME` (`src/pwa/shell.js:1`) + `sw.js:3`
REV bump per commit that changes precached bytes, +1 each. One commit per step
gives **v146, v147, v148, v149, v150, v151**. A step that lands in two commits
takes two bumps, and later numbers slide; always read the current value. The
spec commit, `sitemap.xml`-only commits and test-only commits bump nothing.

Each step appends one dated line to `MEMORY.md` (AGENTS.md standing rule).
AGENTS.md is edited in the step that changes a fact it states:
- R12: the STATS row count
- R6: the `SCREEN.TROPHIES` sentence beside `SCREEN.STATS = 12`, the
  `nb.medals.v1` store line
- R9a/R9b: `nb.ghost.v1`, and "fat-world 141 (142 while a ghost races)"
- Reset: the clear/keep lists

**Headed checks** (AGENTS.md: visual 3D feel is not covered by Node). Unregister
the service worker first.

| step | check |
|---|---|
| R0 | the PAUSE plate at 600×520 and 608×352, hint on one line |
| R12 | STATS at both plates with 10 rows; `C` payload line 1 shows days |
| R6 | a LOSE (no medal line) and a finale WIN carrying a staged medal; `T` → MEDALS page (`SCREEN.TROPHIES`) → `Esc` → STATS at both plates |
| R9a | CLASSIC 2D race on a retry; PAUSE freeze; the **VOID fins-vs-SHADE read** (and reads as you, not a foe); beside a `stationary` foe (rooms 1-5) |
| R9b | REAL 3D race, same four checks |
| Reset | arm / cancel / confirm, reload into the first-visit boot, options and pace kept |

---

## 11. Self-review

**What verification changed versus the brief:**
1. **R12's edge is `room_enter`, not `session_start`.** The latter counts
   attract-only visits.
2. **R12 uses a local day beside the UTC stamps.** The two clocks are never mixed
   in one ring row (§3.1–3.2).
3. **Two pool medals are existing plaques, and three more (KNIGHT kill, 9/9
   foes, 12/12 powers) reduce to a room-8 clear or are not hard.** They are
   rejected with the arithmetic, and the mask fields fall away with them (§1,
   §4.1). Every kept medal needs a finale WIN.
4. **`runFromStart` would have excluded every room-8 medal.** The start room is
   derived from `tally.r` instead (§4.2).
5. **The speed threshold could not come from full runs** (0/50). The per-room
   method, its biases and its script are in the committed text (§4.4).
6. **An always-built 3D ghost would have silently moved four 141 pins.** The
   lazy build keeps them and adds one 142 pin (§6).
7. **R and C/M never reach `app.key`.** Routing and disarm are placed where the
   keys actually flow (§7.3).
8. **The line budget is 4, not 5.** One raise, stated once (§8).
9. **The ghost tick runs BEFORE the step loop.** After it, two of the four room
   starts (the sim's own retry and next-room) would record against the
   previous room's `roomT` and save a static spawn trail (§5.3, pin 6b).
10. **Spec review (2026-10-08) corrections:** a run may start at room 8, so
    KNIGHTFALL is gone (ALL IN tiers instead); the 3D ghost merges CLONES with
    an explicit face matrix; the reset copy names the relock; DAYS PLAYED
    self-heals a future `a.day`; the ghost codec upper-cases base 36.

**Known assumptions:**
- (a) Width budgets assume the 0.6 em mono advance, as waves 1–2 did, and are
  checked headed.
- (b) SPRINT's feasibility rests on bot minima plus carry. A human 1→5 under
  3:00 averages 36 s a room, which the bot beat on four of five rooms at its
  best.
- (c) The 2D ghost composites `drawPlayerBody`'s layered fills at 0.4 each, so
  the internal form shadow reads slightly darker than a flat silhouette. That is
  accepted pending the headed check.
- (d) A ghost is per room, so a room raced via `?code=` on another device never
  shares a ghost. The store is single-device, like every other `nb.*` key.
