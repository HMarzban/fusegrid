# R1 — Run summary, per-heat bests, truthful delta-to-best — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every run that ends — by death, by clearing the finale, or by being
dropped from the pause list — writes its raw score and its furthest room into
`nb.bests.v1` under a `(heat, pact, pace)` key, and the WIN/LOSE overlay gains
two lines: what the run actually did (`ROOMS 4 · KILLS 27 · PICKS 9 · 12:41`) and
how it stands against the record for **that exact bucket**
(`NEW BEST`, `FURTHEST ROOM YET`, `MATCHED YOUR CORE BEST`,
`+142 FROM YOUR CORE BEST`). The delta is computed from persisted numbers or it
is not shown.

**Architecture:** Three seams, none of them the sim. The **store** is one new
module on the `nb.*` template (`src/app/bests.js`), keyed the way `timeKey` is
keyed minus the level — a run spans rooms, so the level cannot be in the key,
while heat / pact / pace all change what the run *is*. The **tap** is
`feedTally(t, world)`, called at the one non-destructive `world.events` read
`main.js` already performs (beside the coach latch, `main.js:594-606`), before
`renderer.render` drains the array — so R1 adds **zero** new passes over
`world.events` and never mutates it. The **display** is a 9th optional
`drawOverlay` argument; absent ⇒ byte-identical to today, which is what keeps
`tests/heat.test.mjs:325-335` and every `drawOverlay(…)` call in
`tests/times.test.mjs` unmoved.

Two corrections to the obvious implementation carry the whole feature's
truthfulness, and both are pinned as regressions rather than described:
**`bestRun` is a run-start snapshot**, not R7's captured-before-the-write (a
score record is per-run and the overlay draws on every room's WIN, so a
per-write capture would have the room-4 overlay compare against a record the
room-3 overlay already moved); and **the LOSE→PLAY edge is a run start**, because
`startGame` runs *inside* `step()` on the LOSE screen's fire edge
(`sim.js:67-74` → `:107-111`) and `onStart` is never involved in a retry. R7's
reset block is **split**, not mirrored — mirroring it would zero rooms-cleared
and run time at every room transition.

**Tech Stack:** Pure ES modules, `node --test` / `tests/*.test.mjs`, Canvas 2D
plus vendored three.js r160. Zero npm runtime deps. `src/app/` is DOM-free and
`Date`-free; `src/render/` may not import `src/app/`.

**Spec:** `docs/superpowers/specs/2026-09-07-retention-wave2-design.md` §1.1,
§1.2, §1.3, §1.6, §2

**Index:** `docs/superpowers/plans/2026-09-07-retention-wave2.md` — its
**Shared interfaces** block is authoritative for every signature below.

**Depends on:** nothing in wave 2. It ships first because `bests.js`,
`feedTally`, the run-state helpers and the 9th `drawOverlay` argument are what
R5, R3, R8 and R10 build on.

## Global Constraints

- **The comparison target is `nb.bests.v1`, never `nb.highscores.v1`.** Three
  reasons from the file: highscores stores `heatScore(world.score, t)`, the
  ×1/×2/×3 **persist-only** multiple (`highscores.js:85`), not the raw run score
  the HUD and `runStamp` show (`scenes.js:52`); it is a **single 10-row list
  across all heats**, sliced to 10 on every write (`:68-77`), so a CORE best can
  be evicted by three MAX runs; and on CORE it ships **pre-seeded down to 250**
  (`DEFAULT_SCORES`, `:6-19`), so "your best" would be a number the player never
  scored — exactly the fabricated delta this wave refuses.
- **`bestRun` is read once per run and never re-read until the next run starts.**
  Because `nb.bests.v1` is only written at the run-end edges it can never read
  back its own write, and `world.heat`/`world.pact`/`world.pace` are fixed for
  the whole run (`main.js:165-167`), so the key is stable too.
- **A retry never calls `onStart`.** The LOSE→PLAY edge must call
  `startRunState()` or run 2 holds run 1's pre-run snapshot and any run-2 score
  between the old snapshot and the record run 1 just wrote falsely prints
  `NEW BEST` — and `runEnded` would never clear, so run 2 would record nothing.
- **The split, not the mirror.** `roomT`/`bestPrev` keep resetting on **both**
  WIN→PLAY and LOSE→PLAY (a new room and a new run both restart the room clock);
  `tally`/`runT`/`bestRun`/`runEnded` reset on **LOSE→PLAY only**.
- **`endRun()` is called from inside `persistScore()`, above its `score > 0`
  guard** — a run that ends by quitting is a run that ended, and `persistScore`
  already runs at all three drop-the-run sites (pause RESTART `:229`, pause QUIT
  `:241`, `KeyM` `:336`). One idempotent latch (`runEnded`) makes the finale
  path — which hits both the WIN edge and `persistScore` via `main.js:607-616` —
  count once. In the pause RESTART branch `startRunState()` goes **after** the
  existing `persistScore()` line, never before: reversing them drops the write.
- **A mid-room WIN is not a persist edge and not a display edge.** The run is
  still alive; its score can still fall (`CFG.DEATH_PENALTY`,
  `entities.js:187`) and its room can still rise. `isRunEnd` is the one
  predicate for both, and it reuses `isFinale` — the same predicate
  `winHeadline` and `overlayCue` use (`scenes.js:34,40`), which AGENTS.md
  requires of anything overlay-facing.
- **`drawOverlay`'s 9th argument is optional, and absent ⇒ byte-identical to
  today.** That is what keeps `tests/heat.test.mjs:325-335` and
  `tests/times.test.mjs`'s 8-arg `drawOverlay` pins unmoved.
- **`fmtTime` is not touched.** `fmtSpan` is a third formatter with a disjoint
  range (`[0, 5999]`, `99:59` pins) and a disjoint consumer.
- **Both `drawOverlay` call sites move in the same commit** —
  `renderer.js:79` and `wrapper.js:154`. Locate them **by string**.
- **Deaths are counted from a strictly decreasing `world.lives`, never from
  `{t:"hurt"}`.** A shielded hit emits `hurt` without losing a life
  (`sim.js:344-348`) while `hurtPlayer` emits the same event when one *is* lost
  (`entities.js:194`).
- **Rooms cleared is counted from `{t:"win"}`, never from `world.level`** — a
  LEVEL SELECT start at room 5 would otherwise report four rooms the player
  never played.
- **`runT` inherits `roomT`'s device-dependence**, disclosed: it accumulates the
  same clamped RAF `dt`, so a machine that trips the `steps > 6` anti-spiral cap
  (`main.js:589-592`) burns wall-clock the sim never sees. R1 adds no new risk;
  it makes the same clock visible.
- **`main.js`'s line pin rises to 754 exactly once**, in Task 3 (this plan's only
  `main.js`-touching task), with its own reason comment appended. Measured today
  is 732 and the additions below total **+22**. If your implementation lands
  above 754, move the excess into `src/app/bests.js` — **never raise the pin**.
- **`src/pwa/shell.js`'s `SRC` entry for `src/app/bests.js` is mandatory**:
  `tests/pwa.test.mjs:98-103` walks `src/` and requires every `.js` in
  `PRECACHE`, so the suite fails until `shell.js` lists it.
- PWA: bump `CACHE_NAME` (`src/pwa/shell.js:1`) and `REV` (`sw.js:3`)
  **together**, `current vN → vN+1`, in **every** commit here. **Read the current
  value first** — it is `fusegrid-shell-v116` as this plan is written and other
  sessions bump the same two lines.
- Comments only where the file already uses them: `scenes.js`, `main.js` and
  every `src/app/*` store all do.
- Never write the private reference game's name into any committed file.

---

### Task 1: `src/app/bests.js` — the store and the event tap

**Files:**
- Create: `src/app/bests.js`
- Create: `tests/bests.test.mjs`
- Modify: `src/pwa/shell.js` — `SRC` gains `"src/app/bests.js"` (immediately
  after `"src/app/attract.js"`, keeping the list alphabetical), and `:1`
  `CACHE_NAME`
- Modify: `sw.js:3`

**Interfaces:**
- Consumes: `clampHeat` (`core/heat.js`), `clampPact` (`core/pact.js`),
  `clampPace` (`core/pace.js`), `defaultStore` (`app/store.js`)
- Produces: `BESTS_KEY`, `BESTS_MAX`, `bestKey`, `clampBests`, `loadBests`,
  `saveBests`, `bestOfRun`, `recordBest`, `newTally`, `feedTally`

- [ ] **Step 1: Write the failing tests** — create `tests/bests.test.mjs`

```js
import {
  BESTS_KEY,
  BESTS_MAX,
  bestKey,
  clampBests,
  loadBests,
  saveBests,
  bestOfRun,
  recordBest,
  newTally,
  feedTally,
} from "../src/app/bests.js";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log(
    (cond ? "  PASS " : "  FAIL ") +
      name +
      (detail !== undefined ? " -> " + detail : ""),
  );
}
function mapStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
}
function throwStore() {
  return {
    getItem() {
      throw new Error("nope");
    },
    setItem() {
      throw new Error("nope");
    },
  };
}

// ---- 1. bestKey: the 5-tuple minus seed AND minus level ----
{
  check("BESTS_KEY is nb.bests.v1", BESTS_KEY === "nb.bests.v1", BESTS_KEY);
  check("BESTS_MAX is 48", BESTS_MAX === 48, BESTS_MAX);
  check(
    "bestKey: heat:pact:pace+1, with NO level segment",
    bestKey({ heat: 1, pact: 5, pace: -1 }) === "1:5:0",
    bestKey({ heat: 1, pact: 5, pace: -1 }),
  );
  check(
    "bestKey ignores level entirely — a run spans rooms",
    bestKey({ level: 1, heat: 0, pact: 0, pace: 0 }) ===
      bestKey({ level: 7, heat: 0, pact: 0, pace: 0 }),
    bestKey({ level: 7, heat: 0, pact: 0, pace: 0 }),
  );
  check(
    "bestKey: junk clamps through the core clamps",
    bestKey({ heat: 99, pact: 999, pace: 9 }) === "2:15:2" &&
      bestKey({ heat: -4, pact: -1, pace: -9 }) === "0:15:0",
    bestKey({ heat: 99, pact: 999, pace: 9 }) +
      " / " +
      bestKey({ heat: -4, pact: -1, pace: -9 }),
  );
  check(
    "bestKey: pure, never throws, a missing world is CORE plain",
    bestKey({}) === "0:0:1" && bestKey(null) === "0:0:1",
    bestKey(null),
  );
}

// ---- 2. clampBests: the gate on every load and every save ----
{
  const raw = {
    b: {
      "0:0:1": { s: 1840, r: 5 },
      "9:0:1": { s: 10, r: 1 }, // heat out of range
      "0:16:1": { s: 10, r: 1 }, // pact out of range
      "0:0": { s: 10, r: 1 }, // malformed
      "1:0:1": { s: 12.5, r: 3 }, // score not an integer
      "2:0:1": { s: 10, r: 0 }, // room below the floor
      "0:1:1": { s: 10, r: 9 }, // room above the ceiling
      "0:2:1": { s: -1, r: 2 }, // negative score
      "0:3:1": { s: "10", r: 2 }, // score not a number
    },
  };
  const c = clampBests(raw);
  check(
    "clampBests keeps only the well-formed entry",
    Object.keys(c.b).length === 1 && c.b["0:0:1"].s === 1840 && c.b["0:0:1"].r === 5,
    JSON.stringify(c.b),
  );
  check(
    "clampBests: junk in, a fresh empty shape out, never a throw",
    JSON.stringify(clampBests(null)) === '{"b":{}}' &&
      JSON.stringify(clampBests(7)) === '{"b":{}}' &&
      JSON.stringify(clampBests({ b: 5 })) === '{"b":{}}',
  );
  check(
    "clampBests carries NO on flag — R1 has no toggle",
    !("on" in clampBests({ on: 1, b: {} })),
    JSON.stringify(clampBests({ on: 1, b: {} })),
  );
  /* 3 heats x 16 pacts x 3 paces = 144 reachable buckets, so the fixture has to
     hold more than 48 or the cap is never exercised. */
  const keys0 = [];
  for (let h = 0; h < 3 && keys0.length < 72; h++)
    for (let p = 0; p < 16 && keys0.length < 72; p++)
      for (let pc = 0; pc < 3 && keys0.length < 72; pc++)
        keys0.push(h + ":" + p + ":" + pc);
  const big = { b: {} };
  keys0.forEach((k, i) => (big.b[k] = { s: 100 + i, r: 1 + (i % 8) }));
  const capped = clampBests(big);
  check(
    "the cap fixture really overflows: 72 distinct well-formed keys",
    keys0.length === 72 && new Set(keys0).size === 72 && keys0.length > BESTS_MAX,
    keys0.length,
  );
  check(
    "clampBests caps at 48",
    Object.keys(capped.b).length === BESTS_MAX,
    keys0.length + " -> " + Object.keys(capped.b).length,
  );
  check(
    "clampBests drops the FIRST inserted on overflow, keeping the newest",
    !Object.prototype.hasOwnProperty.call(capped.b, keys0[0]) &&
      Object.prototype.hasOwnProperty.call(capped.b, keys0[keys0.length - 1]),
    keys0[0] + " dropped / " + keys0[keys0.length - 1] + " kept",
  );
}

// ---- 3. recordBest: s and r move INDEPENDENTLY ----
{
  const k = "0:0:1";
  const a = clampBests(null);
  const b = recordBest(a, k, 1200, 3);
  check(
    "recordBest writes both fields when there is no prior",
    b.b[k].s === 1200 && b.b[k].r === 3,
    JSON.stringify(b.b[k]),
  );
  check("recordBest returns a new object, never mutating", a.b[k] === undefined);
  const c = recordBest(b, k, 1800, 3);
  check(
    "a higher score at the same room raises s alone",
    c.b[k].s === 1800 && c.b[k].r === 3,
    JSON.stringify(c.b[k]),
  );
  const d = recordBest(c, k, 400, 5);
  check(
    "a deeper room at a LOWER score raises r alone — that is a real record too",
    d.b[k].s === 1800 && d.b[k].r === 5,
    JSON.stringify(d.b[k]),
  );
  const e = recordBest(d, k, 1800, 5);
  check(
    "an equal run writes neither",
    e.b[k].s === 1800 && e.b[k].r === 5,
    JSON.stringify(e.b[k]),
  );
  const f = recordBest(e, k, 10, 1);
  check(
    "a worse run writes neither",
    f.b[k].s === 1800 && f.b[k].r === 5,
    JSON.stringify(f.b[k]),
  );
  check(
    "recordBest refuses a malformed key rather than storing one",
    Object.keys(recordBest(clampBests(null), "9:9:9", 100, 1).b).length === 0,
  );
  check(
    "bestOfRun returns {s,r}, or null when the bucket is unseen",
    bestOfRun(f, k).s === 1800 &&
      bestOfRun(f, "1:0:1") === null &&
      bestOfRun(null, k) === null,
    JSON.stringify(bestOfRun(f, k)),
  );
}

// ---- 4. load/save round-trip, and both survive a throwing store ----
{
  const st = mapStore();
  saveBests({ b: { "0:0:1": { s: 1840, r: 5 } } }, st);
  const back = loadBests(st);
  check(
    "loadBests/saveBests round-trip through an injected store",
    back.b["0:0:1"].s === 1840 && back.b["0:0:1"].r === 5,
    JSON.stringify(back),
  );
  check(
    "loadBests on an empty store is the default shape",
    JSON.stringify(loadBests(mapStore())) === '{"b":{}}',
  );
  const bad = mapStore();
  bad.setItem(BESTS_KEY, "{not json");
  check(
    "loadBests degrades a corrupt blob to the default, never throws",
    JSON.stringify(loadBests(bad)) === '{"b":{}}',
  );
  let threw = false;
  try {
    loadBests(throwStore());
    saveBests({ b: {} }, throwStore());
  } catch (_) {
    threw = true;
  }
  check("loadBests/saveBests never throw on a hostile store", !threw);
  check(
    "saveBests clamps on the way out, so a bad bucket can never land",
    (() => {
      const s = mapStore();
      saveBests({ b: { "9:9:9": { s: 5, r: 1 } } }, s);
      return s.getItem(BESTS_KEY) === '{"b":{}}';
    })(),
  );
}

// ---- 5. newTally / feedTally: the tap, read-only over the world ----
{
  const t = newTally();
  check(
    "newTally is the seven-field R1 shape",
    Object.keys(t).sort().join(",") === "b,d,dNew,k,lv,p,r" &&
      t.r === 0 && t.k === 0 && t.p === 0 && t.b === 0 && t.d === 0 &&
      t.dNew === 0 && t.lv === null,
    JSON.stringify(t),
  );
  const w = {
    lives: 3,
    level: 2,
    events: [
      { t: "kill", type: "walker" },
      { t: "kill", type: "walker" },
      { t: "kill", type: "fast" },
      { t: "power", kind: "kick" },
      { t: "power", kind: "fire" },
      { t: "brick" },
      { t: "brick" },
      { t: "brick" },
      { t: "brick" },
      { t: "win" },
      { t: "boom" },
      { t: "reveal" },
    ],
  };
  const n0 = w.events.length;
  feedTally(t, w);
  check(
    "one batch: 3 kills, 2 powers, 4 bricks, 1 win — boom/reveal ignored",
    t.k === 3 && t.p === 2 && t.b === 4 && t.r === 1,
    JSON.stringify(t),
  );
  check(
    "feedTally never mutates world.events — the renderer still drains it",
    w.events.length === n0,
    w.events.length + " vs " + n0,
  );
  check(
    "the first call SEEDS lives and counts no death",
    t.d === 0 && t.dNew === 0 && t.lv === 3,
    JSON.stringify(t),
  );
  w.events = [];
  w.lives = 2;
  feedTally(t, w);
  check("a strictly decreasing lives is a death", t.d === 1 && t.dNew === 1, JSON.stringify(t));
  feedTally(t, w);
  check("dNew is this frame only and resets", t.d === 1 && t.dNew === 0, JSON.stringify(t));
  w.events = [{ t: "hurt", x: 1, y: 1 }];
  feedTally(t, w);
  check(
    "a shield-break hurt with lives unchanged is NOT a death",
    t.d === 1 && t.dNew === 0,
    JSON.stringify(t),
  );
  w.events = [];
  w.lives = 3;
  feedTally(t, w);
  check(
    "the carry.lives jump on a new run is an INCREASE, never a false death",
    t.d === 1 && t.dNew === 0 && t.lv === 3,
    JSON.stringify(t),
  );
  check(
    "feedTally returns the same tally object it was handed",
    feedTally(t, w) === t,
  );
  let threw2 = false;
  try {
    feedTally(newTally(), null);
    feedTally(newTally(), {});
    feedTally(newTally(), { events: 7 });
  } catch (_) {
    threw2 = true;
  }
  check("feedTally never throws on a junk world", !threw2);
}

console.log("\n  BESTS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/bests.test.mjs tests/pwa.test.mjs
```

Expected: FAIL — `bests.test.mjs` reports
`Cannot find module '.../src/app/bests.js'`. (`pwa.test.mjs` is still green at
this step; it fails only once the module exists without its `SRC` entry, which
is why both are run together.)

- [ ] **Step 3: Implement** — create `src/app/bests.js`

```js
import { clampHeat } from "../core/heat.js";
import { clampPact } from "../core/pact.js";
import { clampPace } from "../core/pace.js";
import { defaultStore } from "./store.js";

export const BESTS_KEY = "nb.bests.v1";
export const BESTS_MAX = 48;
/* One key, one module — the load*/save*(store) template pactstore / plaques /
   pacestore / cabinetseen / coach / settings / times all share.
   The key is timeKey's key MINUS the level: a run spans rooms, so the level
   cannot be in it, while heat changes the roster (heat.js:102-113), pact
   changes the item count and therefore the rng draw order (pact.js:20-26), and
   pace scales player speed without being folded into the seed (sim.js:124,
   world.js:15,74). pace is shifted +1 so the segment is 0..2.
   nb.highscores.v1 cannot be the comparison target: it stores the heat-
   multiplied persist value, it is one 10-row list across all heats, and CORE
   ships pre-seeded to 250 — three ways to print a delta the player never ran. */
const KEY_RE = /^[0-2]:(?:[0-9]|1[0-5]):[0-2]$/;
const MAX_S = 9999999,
  MIN_R = 1,
  MAX_R = 8;

export function bestKey(world) {
  const w = world || {};
  return (
    clampHeat(w.heat) + ":" + clampPact(w.pact) + ":" + (clampPace(w.pace) + 1)
  );
}

const int = (v, lo, hi) =>
  typeof v === "number" && isFinite(v) && (v | 0) === v && v >= lo && v <= hi;
const okRow = (e) =>
  !!e && typeof e === "object" && int(e.s, 0, MAX_S) && int(e.r, MIN_R, MAX_R);

/* The key form is non-integer-like, so JS preserves insertion order over `b`
   deterministically — which is what makes "drop the FIRST inserted" a defined
   overflow policy rather than a coin flip. 48 is a third of the 144 reachable
   buckets and ~16x the set a real player uses; the blob stays under ~2 KB. */
export function clampBests(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const src = o.b && typeof o.b === "object" ? o.b : {};
  const keys = Object.keys(src).filter((k) => KEY_RE.test(k) && okRow(src[k]));
  const kept = keys.length > BESTS_MAX ? keys.slice(keys.length - BESTS_MAX) : keys;
  const b = {};
  for (const k of kept) b[k] = { s: src[k].s, r: src[k].r };
  return { b };
}

export function loadBests(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.getItem !== "function") return clampBests(null);
    const raw = st.getItem(BESTS_KEY);
    if (raw === null) return clampBests(null);
    return clampBests(JSON.parse(raw));
  } catch (_) {
    return clampBests(null);
  }
}

export function saveBests(v, store) {
  try {
    const st = store || defaultStore();
    if (st && typeof st.setItem === "function")
      st.setItem(BESTS_KEY, JSON.stringify(clampBests(v)));
  } catch (_) {}
}

export function bestOfRun(v, key) {
  const b = v && v.b;
  const e = b ? b[key] : undefined;
  return okRow(e) ? { s: e.s, r: e.r } : null;
}

/* s and r are written INDEPENDENTLY: a low-score run that reached a new room is
   a real record, and pinning them together would hide one behind the other. */
export function recordBest(v, key, score, room) {
  const cur = clampBests(v);
  if (!KEY_RE.test(key)) return cur;
  const s = Math.min(MAX_S, Math.max(0, score | 0));
  const r = Math.min(MAX_R, Math.max(MIN_R, room | 0));
  const prior = cur.b[key];
  const next = okRow(prior)
    ? { s: s > prior.s ? s : prior.s, r: r > prior.r ? r : prior.r }
    : { s, r };
  const b = Object.assign({}, cur.b);
  b[key] = next;
  return clampBests({ b });
}

/* The run tally, fed from the batch main.js already reads non-destructively
   beside the coach latch — before renderer.render drains world.events. Rooms
   are counted from {t:"win"}, never inferred from world.level, which a LEVEL
   SELECT start at room 5 would falsify. Deaths are a strictly DECREASING
   world.lives, never {t:"hurt"}: a shielded hit emits hurt without losing a
   life (sim.js:344-348) while hurtPlayer emits the same event when one is
   (entities.js:194). lv seeds itself on the first call, so the carry.lives jump
   on a new run is an increase and never a false death. */
export function newTally() {
  return { r: 0, k: 0, p: 0, b: 0, d: 0, dNew: 0, lv: null };
}

export function feedTally(t, world) {
  const w = world || {};
  t.dNew = 0;
  const ev = Array.isArray(w.events) ? w.events : [];
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i];
    if (!e) continue;
    if (e.t === "kill") t.k++;
    else if (e.t === "power") t.p++;
    else if (e.t === "brick") t.b++;
    else if (e.t === "win") t.r++;
  }
  const lv = w.lives | 0;
  if (t.lv === null) t.lv = lv;
  else if (lv < t.lv) {
    const n = t.lv - lv;
    t.d += n;
    t.dNew = n;
  }
  t.lv = lv;
  return t;
}
```

Then add `"src/app/bests.js"` to `SRC` in `src/pwa/shell.js`, immediately after
`"src/app/attract.js"`.

- [ ] **Step 4: Run to PASS**

```bash
node --test tests/bests.test.mjs tests/pwa.test.mjs
```

Expected: green. `pwa.test.mjs` proves the `SRC` entry landed —
`PRECACHE has ./src/app/bests.js`.

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together,
`current vN → vN+1`.

```bash
git add src/app/bests.js tests/bests.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Add src/app/bests.js: per-bucket run bests under nb.bests.v1.

The key is heat/pact/pace — timeKey's key minus the level, because a run spans
rooms while heat, pact and pace each change what the run is. nb.highscores.v1
could not be the comparison target: it stores the heat-multiplied persist value
rather than the raw score the HUD shows, it is one ten-row list across all
heats, and CORE ships pre-seeded to 250, so a delta against it would be a
number the player never scored. Score and furthest room are written
independently, because a low-score run that reached a new room is a real
record. feedTally reads the event batch main.js already reads and mutates
nothing on the world; deaths come from a strictly decreasing world.lives, since
a shielded hit emits the same hurt event without losing one.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: the summary block — `fmtSpan`, the five delta forms, and the 9th arg

**Files:**
- Modify: `src/render/scenes.js` — the `pactLabel` / `paceToken` imports; new
  `fmtSpan` / `runLine` / `bestLabel` / `deltaLine` / `isRunEnd` /
  `summaryLines` beside `timeLine` (`:73-83`); the `COPY_HINT` constant
  replacing the three inline `" · C copy"` sites (`:147`, `:148`, `:152`);
  `drawOverlay`'s signature and its WIN and LOSE branches (`:111-152`)
- Modify: `src/render/renderer.js` — the `drawOverlay` arg list (**locate by the
  string `drawOverlay(ctx, world, B.w`**)
- Modify: `src/render/three/wrapper.js` — same arg list (**locate by
  `drawOverlay(ovCtx,world,B.w`**)
- Modify: `tests/bests.test.mjs` — append blocks 6–11
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `pactLabel` (`core/pact.js`), `paceToken` (`core/pace.js`) — both
  `src/core`, which `render/` may read
- Produces: `fmtSpan(sec)`, `runLine(run)`, `bestLabel(world)`,
  `deltaLine(world, run)`, `isRunEnd(world)`, `summaryLines(world, run)`,
  `drawOverlay(c, world, w, h, cx, cy, ui, tm, run)`, and `o.run` threaded
  through both renderers

- [ ] **Step 1: Write the failing tests**

Extend `tests/bests.test.mjs`'s imports:

```js
import {
  fmtSpan,
  runLine,
  bestLabel,
  deltaLine,
  isRunEnd,
  summaryLines,
  drawOverlay,
  fmtTime,
} from "../src/render/scenes.js";
import { readFileSync } from "node:fs";
```

Append, before the summary:

```js
const rec = () => {
  const texts = [];
  const noop = () => {};
  const c = {
    save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
    arcTo: noop, bezierCurveTo: noop, quadraticCurveTo: noop, ellipse: noop,
    fill: noop, stroke: noop, fillRect: noop, strokeRect: noop,
    fillText: (s) => texts.push(String(s)),
    strokeText: (s) => texts.push(String(s)),
  };
  return { c, texts };
};

// ---- 6. fmtSpan: a THIRD formatter, disjoint from fmtTime and fmtLong ----
{
  const want = [
    [0, "0:00"],
    [41.9, "0:41"],
    [61, "1:01"],
    [761, "12:41"],
    [99999, "99:59"],
    [-5, "0:00"],
  ];
  const bad = want.filter(([n, s]) => fmtSpan(n) !== s);
  check(
    "fmtSpan: floored to seconds, zero-padded, clamped to 99:59",
    !bad.length,
    JSON.stringify(bad.map(([n]) => [n, fmtSpan(n)])),
  );
  check(
    "fmtSpan never throws on junk",
    fmtSpan(undefined) === "0:00" && fmtSpan(NaN) === "0:00",
    fmtSpan(undefined),
  );
  /* The reason there are two new formatters and not one: fmtTime's six-char HUD
     guarantee pins a run at 9:59.9, and a run is 4-13 minutes. This assertion
     fails the moment anyone "simplifies" fmtSpan back onto fmtTime. */
  check(
    "fmtSpan and fmtTime disagree past 9:59.9 — that IS the reason fmtSpan exists",
    fmtTime(761) === "9:59.9" && fmtSpan(761) === "12:41",
    fmtTime(761) + " vs " + fmtSpan(761),
  );
}

// ---- 7. isRunEnd: the ONE predicate for the persist edge and the display edge ----
{
  const cases = [
    [{ state: "LOSE", level: 3 }, true],
    [{ state: "WIN", level: 3 }, false],
    [{ state: "WIN", level: 4 }, false],
    [{ state: "WIN", level: 5 }, true],
    [{ state: "WIN", level: 8 }, true],
    [{ state: "WIN", level: 6, finale: true }, true],
    [{ state: "PLAY", level: 5 }, false],
    [{ state: "PAUSE", level: 5 }, false],
  ];
  const bad = cases.filter(([w, want]) => isRunEnd(w) !== want);
  check(
    "isRunEnd: LOSE always; WIN only at the finale; never mid-room, PLAY or PAUSE",
    !bad.length,
    JSON.stringify(bad.map(([w]) => [w.state, w.level, isRunEnd(w)])),
  );
  check("isRunEnd never throws", isRunEnd(null) === false && isRunEnd({}) === false);
}

// ---- 8. bestLabel + the five locked delta forms ----
{
  check(
    "bestLabel names the exact bucket the record lives in",
    bestLabel({ heat: 0, pact: 0, pace: 0 }) === "CORE" &&
      bestLabel({ heat: 1, pact: 3, pace: 1 }) === "PLUS · LB · HARD" &&
      bestLabel({ heat: 2, pact: 15, pace: -1 }) === "MAX · LBTS · EASY",
    bestLabel({ heat: 1, pact: 3, pace: 1 }),
  );
  const W = { level: 3, score: 1000, heat: 0, pact: 0, pace: 0 };
  check(
    "form 1: furthest room, no new score",
    deltaLine(W, { best: { s: 2000, r: 2 } }) === "FURTHEST ROOM YET",
    deltaLine(W, { best: { s: 2000, r: 2 } }),
  );
  check(
    "form 2: new score, same depth",
    deltaLine(W, { best: { s: 500, r: 3 } }) === "NEW BEST",
    deltaLine(W, { best: { s: 500, r: 3 } }),
  );
  check(
    "form 3: both — and every first-ever run on a bucket",
    deltaLine(W, { best: { s: 500, r: 2 } }) === "FURTHEST ROOM YET · NEW BEST" &&
      deltaLine(W, { best: null }) === "FURTHEST ROOM YET · NEW BEST",
    deltaLine(W, { best: null }),
  );
  check(
    "form 4: an exact tie names the bucket, never a delta",
    deltaLine(W, { best: { s: 1000, r: 3 } }) === "MATCHED YOUR CORE BEST",
    deltaLine(W, { best: { s: 1000, r: 3 } }),
  );
  check(
    "form 5: short of it — the + is a GAP, never a surplus",
    deltaLine({ ...W, score: 858 }, { best: { s: 1000, r: 5 } }) ===
      "+142 FROM YOUR CORE BEST",
    deltaLine({ ...W, score: 858 }, { best: { s: 1000, r: 5 } }),
  );
  check(
    "form 5 is unreachable when forms 1-3 fired — no negative gap can print",
    !/\+-/.test(deltaLine(W, { best: { s: 500, r: 2 } })) &&
      !/\+-/.test(deltaLine({ ...W, score: 5000 }, { best: { s: 1000, r: 5 } })),
    deltaLine({ ...W, score: 5000 }, { best: { s: 1000, r: 5 } }),
  );
}

// ---- 9. runLine ----
{
  check(
    "runLine is the locked tally copy",
    runLine({ r: 4, k: 27, p: 9, t: 761 }) === "ROOMS 4 · KILLS 27 · PICKS 9 · 12:41",
    runLine({ r: 4, k: 27, p: 9, t: 761 }),
  );
  check(
    "runLine does NOT show bricks — they ride R5's payload, so nothing is counted and never used",
    runLine({ r: 1, k: 0, p: 0, b: 99, t: 0 }).indexOf("99") < 0,
    runLine({ r: 1, k: 0, p: 0, b: 99, t: 0 }),
  );
}

// ---- 10. summaryLines: [text, col] pairs, and the run-end gate ----
{
  const W = { state: "WIN", level: 3, score: 1000, heat: 0, pact: 0, pace: 0 };
  const run = { r: 2, k: 5, p: 1, t: 90, best: { s: 500, r: 2 } };
  check("summaryLines with no run is empty", summaryLines(W, undefined).length === 0);
  const mid = summaryLines(W, run);
  check(
    "a mid-room WIN yields exactly ONE pair — the tally line, never a delta",
    mid.length === 1 && mid[0][0].indexOf("ROOMS 2") === 0,
    JSON.stringify(mid),
  );
  const lose = summaryLines({ ...W, state: "LOSE" }, run);
  const fin = summaryLines({ ...W, level: 5 }, run);
  check(
    "a LOSE and a finale WIN each yield two pairs",
    lose.length === 2 && fin.length === 2 && lose[1][0] === "NEW BEST",
    JSON.stringify(lose),
  );
  check(
    "the delta highlights ONLY when a record actually fell",
    lose[1][1] === "#37f0d0" &&
      summaryLines({ ...W, state: "LOSE", score: 100 }, run)[1][1] === "#9fb3d8",
    lose[1][1] +
      " / " +
      summaryLines({ ...W, state: "LOSE", score: 100 }, run)[1][1],
  );
  check(
    "the tally line is always the muted sub colour",
    mid[0][1] === "#9fb3d8",
    mid[0][1],
  );
}

// ---- 11. drawOverlay: the 9th arg is optional; absent is byte-identical ----
{
  const W = { state: "WIN", level: 3, finale: false, score: 10, heat: 0 };
  const a = rec();
  drawOverlay(a.c, W, 600, 520, 300, 260, undefined, undefined);
  const b = rec();
  drawOverlay(b.c, W, 600, 520, 300, 260);
  check(
    "drawOverlay WIN with no run records today's exact fillText list",
    a.texts.join("|") === b.texts.join("|") &&
      a.texts.some((s) => s.indexOf("CLEARED") >= 0) &&
      !a.texts.some((s) => s.indexOf("ROOMS ") === 0),
    a.texts.join("|"),
  );
  const r = rec();
  drawOverlay(r.c, W, 600, 520, 300, 260, undefined, undefined, {
    r: 2, k: 5, p: 1, t: 90, best: null,
  });
  check(
    "drawOverlay WIN with a run adds the tally line and nothing else mid-room",
    r.texts.includes("ROOMS 2 · KILLS 5 · PICKS 1 · 1:30") &&
      r.texts.length === a.texts.length + 1,
    r.texts.join("|"),
  );
  const L = rec();
  drawOverlay(L.c, { state: "LOSE", level: 3, score: 1000, heat: 0 },
    600, 520, 300, 260, undefined, undefined,
    { r: 2, k: 5, p: 1, t: 90, best: { s: 500, r: 2 } });
  check(
    "drawOverlay LOSE with a run adds BOTH the tally line and the delta line",
    L.texts.includes("ROOMS 2 · KILLS 5 · PICKS 1 · 1:30") &&
      L.texts.includes("NEW BEST"),
    L.texts.join("|"),
  );
  const P = rec();
  drawOverlay(P.c, { state: "PAUSE" }, 600, 520, 300, 260, { view: 0, cursor: 0 },
    undefined, { r: 9, k: 9, p: 9, t: 9, best: null });
  const P2 = rec();
  drawOverlay(P2.c, { state: "PAUSE" }, 600, 520, 300, 260, { view: 0, cursor: 0 });
  check(
    "drawOverlay PAUSE ignores the run entirely",
    P.texts.join("|") === P2.texts.join("|"),
    P.texts.join("|"),
  );
  check(
    "the copy hint is still exactly ' · C copy' until R8 changes it",
    a.texts.some((s) => s.indexOf(" · C copy") > 0) &&
      !a.texts.some((s) => s.indexOf("B board") >= 0),
    a.texts.join("|"),
  );
}

// ---- wiring: both renderers pass o.run through as the ninth arg ----
{
  for (const [f, ov] of [
    ["src/render/renderer.js", "drawOverlay(ctx, world, B.w"],
    ["src/render/three/wrapper.js", "drawOverlay(ovCtx,world,B.w"],
  ]) {
    const src = readFileSync(f, "utf8");
    const line = (src.match(
      new RegExp(".*" + ov.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ".*"),
    ) || [""])[0];
    check(
      f + ": drawOverlay receives o.run as its ninth arg",
      /o\s*&&\s*o\.run/.test(line),
      line.trim(),
    );
  }
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/bests.test.mjs
```

Expected: FAIL — `SyntaxError: The requested module '../src/render/scenes.js'
does not provide an export named 'fmtSpan'`.

- [ ] **Step 3: Implement**

**3a — `src/render/scenes.js` imports.** Extend the two existing `core` imports
(`:1-2`) with two more lines beside them:

```js
import { pactLabel } from "../core/pact.js";
import { paceToken } from "../core/pace.js";
```

**3b — the pure exports.** Add directly after `timeLine` (`:83`):

```js
/* R1 run formatting. fmtSpan is a THIRD formatter, not a widening of fmtTime:
   fmtTime clamps at 9:59.9 because its six-character guarantee holds the HUD
   chip's width budget, and a run is 4-13 minutes. fmtSpan clamps at 99:59; a
   run left idling in PLAY past 100 minutes pins there, disclosed. STATS'
   lifetime clock is a third range again (fmtLong, src/app/stats.js). */
export function fmtSpan(sec) {
  const n = typeof sec === "number" && isFinite(sec) ? sec : 0;
  const s = Math.floor(Math.min(5999, Math.max(0, n)));
  const m = s % 60;
  return Math.floor(s / 60) + ":" + (m < 10 ? "0" + m : String(m));
}
export function runLine(run) {
  const r = run || {};
  return (
    "ROOMS " + (r.r | 0) + " · KILLS " + (r.k | 0) + " · PICKS " + (r.p | 0) +
    " · " + fmtSpan(r.t)
  );
}
/* bestLabel names the EXACT bucket the record is kept in, so the sentence can
   never be read against the wrong record. pactLabel/paceToken are src/core,
   which render/ may read. */
export function bestLabel(world) {
  const w = world || {};
  return (
    HEAT_NAME[clampHeat(w.heat)] +
    (clampPact(w.pact) ? " · " + pactLabel(w.pact) : "") +
    (clampPace(w.pace) ? " · " + paceToken(w.pace) : "")
  );
}
/* The display edge and the persist edge are the SAME edge. A mid-room NEW BEST
   claims a record that has not been written and that a later death can still
   take back, and repeating it on rooms 3, 4 and 5 cheapens the one line the
   whole feature exists for. isFinale is the same predicate winHeadline and
   overlayCue use, which AGENTS.md requires of overlay code. */
export function isRunEnd(world) {
  const w = world || {};
  return (
    w.state === "LOSE" ||
    (w.state === "WIN" && (isFinale(w.level) || !!w.finale))
  );
}
/* Returns [text, hot] so summaryLines never has to sniff its own string for a
   colour. The + in form 5 is a GAP, never a surplus: it is only reachable when
   forms 1-3 did not fire. */
function deltaOf(world, run) {
  const b = run.best;
  const p = [];
  if (!b || (world.level | 0) > (b.r | 0)) p.push("FURTHEST ROOM YET");
  if (!b || (world.score | 0) > (b.s | 0)) p.push("NEW BEST");
  if (p.length) return [p.join(" · "), true];
  if ((world.score | 0) === (b.s | 0))
    return ["MATCHED YOUR " + bestLabel(world) + " BEST", false];
  return [
    "+" + ((b.s | 0) - (world.score | 0)) + " FROM YOUR " + bestLabel(world) + " BEST",
    false,
  ];
}
export function deltaLine(world, run) {
  return deltaOf(world || {}, run || {})[0];
}
/* [text, col] pairs so the draw never sniffs strings. A record highlights only
   when a record actually fell — the same honesty rule, in pixels. */
export function summaryLines(world, run) {
  if (!run) return [];
  const out = [[runLine(run), "#9fb3d8"]];
  if (isRunEnd(world)) {
    const [s, hot] = deltaOf(world || {}, run);
    out.push([s, hot ? "#37f0d0" : "#9fb3d8"]);
  }
  return out;
}
const COPY_HINT = " · C copy";
```

**3c — `drawOverlay`.** Add a ninth parameter:

```js
export function drawOverlay(
  c,
  world,
  w = CFG.COLS * CFG.TILE,
  h = CFG.ROWS * CFG.TILE,
  cx = w / 2,
  cy = h / 2,
  ui = { view: 0, cursor: 0 },
  tm,
  run,
) {
```

and replace the WIN and LOSE branches (`:139-152`) with:

```js
  if (world.state === "WIN") {
    head(winHeadline(world), "#37f0d0");
    /* R1: one 24px stack (R7's shipped pitch) at dy 20/44/68/92/116 — stamp,
       tally, delta, R7's time line, cue. cy+116 is 376 inside the 600x520 box
       and 304 inside the 608x352 iso box. With run and tm both absent this
       emits dy 20 then dy 44: today's two lines, at today's positions. */
    let dy = 20;
    sub(runStamp(world), "#9fb3d8", dy);
    for (const [s, col] of summaryLines(world, run)) sub(s, col, (dy += 24));
    if (tm && tm.on) sub(timeLine(world, tm), "#9fb3d8", (dy += 24));
    sub(overlayCue(world) + COPY_HINT, "#9fb3d8", (dy += 24));
  } else if (world.state === "LOSE") {
    head("GAME OVER", "#ff5d73");
    let dy = 20;
    sub(runStamp(world), "#9fb3d8", dy);
    for (const [s, col] of summaryLines(world, run)) sub(s, col, (dy += 24));
    sub(overlayCue(world) + COPY_HINT, "#9fb3d8", (dy += 24));
  } else if (world.state === "PAUSE") {
```

**3d — `src/render/renderer.js`.** Locate `drawOverlay(ctx, world, B.w` and
extend it:

```js
      drawOverlay(ctx, world, B.w, B.h, B.cx, B.cy, o&&o.pause, o&&o.time, o&&o.run);
```

**3e — `src/render/three/wrapper.js`.** The same, on its own call site:

```js
        drawOverlay(ovCtx,world,B.w,B.h,B.cx,B.cy,o&&o.pause,o&&o.time,o&&o.run); }
```

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test
```

Expected: all green — in particular `tests/heat.test.mjs` (its WIN-branch check
passes an `undefined` ninth arg) and every 8-arg `drawOverlay(…)` in
`tests/times.test.mjs` are unmoved.

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together,
`current vN → vN+1`.

```bash
git add src/render/scenes.js src/render/renderer.js src/render/three/wrapper.js tests/bests.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Draw the run tally and the delta-to-best behind an optional ninth arg.

drawOverlay gains a ninth optional argument; absent, it renders byte-identically
to today, which is what leaves the shipped overlay pins in heat and times
unmoved. The delta line is run-end only and isRunEnd is the same predicate the
persist edge uses: a mid-room NEW BEST would claim a record that has not been
written and that a later death can still take back. fmtSpan is a third
formatter rather than a widening of fmtTime, whose six-character guarantee
holds the HUD chip's width budget and would pin every run at 9:59.9.
summaryLines returns [text, colour] pairs so the draw never sniffs strings, and
the accent fires only when a record actually fell.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `main.js` — the run-state split, the idempotent write, and `ro.run`

**Files:**
- Modify: `src/main.js` — the `bests.js` import; `isFinale` on the existing
  `import { CFG } from "./core/config.js"` (`:6`); the run-state declarations
  and `startRunState`/`endRun` beside `bestPrev` (`:135`); `onStart` (`:164-181`);
  `persistScore` (`:309-312`); the pause RESTART branch (`:226-239`); the split
  edge block (`:560-567`); the accumulate line (`:577-578`); the `feedTally`
  line beside the coach latch (`:594-606`); `ro.run` in the GAME `ro` literal
  (`:663-677`)
- Modify: `tests/bests.test.mjs` — append the wiring and regression blocks
- Modify: `tests/headless.test.mjs` — the `main.js` line pin (`:909`) and its
  reason comment
- Modify: `MEMORY.md`, `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `bestKey`, `loadBests`, `saveBests`, `bestOfRun`, `recordBest`,
  `newTally`, `feedTally`, `isFinale`
- Produces: `o.run = {r, k, p, t, best}` on the GAME render opts

- [ ] **Step 1: Write the failing tests**

Extend `tests/bests.test.mjs`'s imports:

```js
import { createGame } from "../src/main.js";
```

Append, before the summary:

```js
/* ---- SELF-REVIEW PIN A (spec §1.2): a retry never calls onStart.
   startGame runs INSIDE step() on the LOSE screen's fire edge (sim.js:67-74 ->
   :107-111), so run state reset only in onStart/RESTART goes stale on every
   retry: run 1 writes best B at its LOSE edge, run 2 still holds the pre-run-1
   snapshot A, and any run-2 score in (A, B) falsely prints NEW BEST. This pin
   drives two real runs through the real loop and asserts the second one tells
   the truth. ---- */
{
  const mem = new Map();
  const ls = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
  };
  globalThis.window = { localStorage: ls, addEventListener() {} };
  try {
    const texts = [];
    const noop = () => {};
    const rc = { fillText: (s) => texts.push(String(s)), strokeText: noop };
    for (const n of [
      "save", "restore", "translate", "rotate", "scale", "beginPath",
      "closePath", "moveTo", "lineTo", "arc", "arcTo", "bezierCurveTo",
      "quadraticCurveTo", "ellipse", "fill", "stroke", "fillRect",
      "strokeRect", "clearRect", "setTransform", "transform", "drawImage",
    ])
      rc[n] = noop;
    rc.createLinearGradient = () => ({ addColorStop: noop });
    rc.createRadialGradient = () => ({ addColorStop: noop });
    const fake = { getContext: () => rc, addEventListener() {}, style: {} };
    const g = createGame(fake, { autoplay: true, seed: 41 });
    let t = 1000;
    g.loop(t); // establishes main's `last`; prevSt latches PLAY
    // --- run 1: a 500-point death ---
    g.world.score = 500;
    g.world.state = "LOSE";
    texts.length = 0;
    g.loop((t += 16)); // PLAY -> LOSE edge: endRun() writes
    check(
      "A: the LOSE edge writes nb.bests.v1 for the CORE plain bucket",
      JSON.parse(ls.getItem(BESTS_KEY) || "{}").b["0:0:1"].s === 500,
      ls.getItem(BESTS_KEY),
    );
    check(
      "A: the first run's overlay prints a first-ever record",
      texts.some((s) => s.indexOf("NEW BEST") >= 0),
      texts.join("|"),
    );
    // --- run 2 through the LOSE->PLAY edge, scoring BELOW run 1 ---
    g.world.state = "PLAY";
    g.loop((t += 16)); // LOSE -> PLAY: startRunState() re-snapshots bestRun
    g.world.score = 300;
    g.world.state = "LOSE";
    texts.length = 0;
    g.loop((t += 16));
    check(
      "A: a worse retry NEVER prints NEW BEST — the regression this pin exists for",
      !texts.some((s) => s.indexOf("NEW BEST") >= 0),
      texts.join("|"),
    );
    check(
      "A: it prints the gap to the record run 1 just wrote",
      texts.some((s) => s === "+200 FROM YOUR CORE BEST"),
      texts.join("|"),
    );
    check(
      "A: and the worse retry did not overwrite the record",
      JSON.parse(ls.getItem(BESTS_KEY) || "{}").b["0:0:1"].s === 500,
      ls.getItem(BESTS_KEY),
    );
    check(
      "A: the tally line paints on both WIN and LOSE",
      texts.some((s) => s.indexOf("ROOMS ") === 0),
      texts.join("|"),
    );
  } finally {
    delete globalThis.window;
  }
}

/* ---- SELF-REVIEW PIN B (spec §1.1, §1.2, §1.6): the three orderings that make
   the feature truthful, pinned on main.js's own source so a later refactor that
   reorders them fails here rather than in a player's overlay. ---- */
{
  const src = readFileSync("src/main.js", "utf8");
  check(
    "B1: bestRun is assigned ONLY inside startRunState — never re-read mid-run",
    (src.match(/bestRun = /g) || []).length === 2 &&
      /const startRunState = \(\) => \{[\s\S]{0,200}bestRun = bestOfRun\(/.test(src),
    (src.match(/bestRun = [^\n]*/g) || []).join(" | "),
  );
  check(
    "B2: the LOSE->PLAY edge is a run start — a retry never reaches onStart",
    /if \(prevSt === "LOSE"\) startRunState\(\);/.test(src),
    (src.match(/startRunState\(\);[^\n]*/g) || []).join(" | "),
  );
  check(
    "B3: startRunState has exactly three call sites (onStart, pause RESTART, the LOSE->PLAY edge)",
    (src.match(/startRunState\(\);/g) || []).length === 3,
    String((src.match(/startRunState\(\);/g) || []).length),
  );
  check(
    "B4: the run-state reset is SPLIT, not mirrored — roomT still resets on a WIN->PLAY room change",
    /roomT = 0; bestPrev = null;/.test(src) &&
      /\(prevSt === "WIN" \|\| prevSt === "LOSE"\) && world\.state === "PLAY"/.test(src),
    (src.match(/roomT = 0;[^\n]*/g) || []).join(" | "),
  );
  const ps = (src.match(/const persistScore = \(\) => \{[\s\S]{0,220}/) || [""])[0];
  check(
    "B5: endRun() runs INSIDE persistScore, above its score>0 guard — a quit run is a run that ended",
    ps.indexOf("endRun()") >= 0 &&
      ps.indexOf("endRun()") < ps.indexOf("world.score > 0"),
    ps.trim().slice(0, 160),
  );
  const rst = (src.match(/if \(cmd === "RESTART"\)[\s\S]{0,320}/) || [""])[0];
  check(
    "B6: pause RESTART calls persistScore BEFORE startRunState — reversing them drops the write",
    rst.indexOf("persistScore();") >= 0 &&
      rst.indexOf("persistScore();") < rst.indexOf("startRunState();"),
    rst.trim().slice(0, 160),
  );
  check(
    "B7: feedTally reads the batch BEFORE renderer.render drains world.events",
    src.indexOf("feedTally(tally, world);") > 0 &&
      src.indexOf("feedTally(tally, world);") < src.indexOf("renderer.render("),
    String(src.indexOf("feedTally(tally, world);")),
  );
  check(
    "B8: the run clock is PLAY-only, on the same line coachT and roomT already are",
    /if \(world\.state === "PLAY"\) \{ coachT \+= dt; roomT \+= dt; runT \+= dt; \}/.test(src),
    (src.match(/runT \+= dt[^\n]*/) || [])[0],
  );
  check(
    "B9: the finale WIN ends the run through the SAME isFinale predicate the overlay uses",
    /if \(isFinale\(world\.level\)\) endRun\(\);/.test(src) &&
      /import \{ CFG, isFinale \} from "\.\/core\/config\.js";/.test(src),
    (src.match(/if \(isFinale\(world\.level\)\)[^\n]*/) || [])[0],
  );
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/bests.test.mjs
```

Expected: FAIL — pin A reports `Cannot read properties of undefined (reading 's')`
on the first `nb.bests.v1` read (nothing is written yet), and pins B1–B9 report
empty matches against `main.js`.

- [ ] **Step 3: Implement** — `src/main.js`

**3a — imports.** Extend `:6` and add one line beside the other `src/app` store
imports (`:27`):

```js
import { CFG, isFinale } from "./core/config.js";
```
```js
import { bestKey, loadBests, saveBests, bestOfRun, recordBest, newTally, feedTally } from "./app/bests.js";
```

**3b — declarations.** Directly beneath `let bestPrev = null;` (`:135`), and
**above** `onStart` (`:164`), which calls `startRunState()`:

```js
  /* R1: bestRun is a RUN-START snapshot (a score record is per-run and the
     overlay draws on every room's WIN), and endRun is one idempotent write
     called from BOTH sim edges below AND from persistScore(), which already
     runs at all three drop-the-run sites — a quit run is a run that ended. */
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

**3c — `onStart`.** After the `roomT`/`bestPrev` resets (`:176-177`) — it reads
`bestKey(world)`, so it must run after the heat/pact/pace writes and after
`loadLevel`:

```js
    startRunState();
```

**3d — `persistScore`.** As its first statement, **above** the `score > 0`
guard:

```js
  const persistScore = () => {
    endRun();
    if (!(world.score > 0)) return;
```

**3e — the pause RESTART branch.** Beside `bestPrev = null;` (`:237`), i.e.
**after** the branch's existing `persistScore()` line:

```js
        startRunState();
```

**3f — the split edge block.** Replace `main.js:560-567`:

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

A mid-room WIN is deliberately **not** an edge: the run is still alive, its score
can still fall and its room can still rise.

**3g — the run clock.** The two PLAY-only lines (`:577-578`) become one:

```js
      if (world.state === "PLAY") { coachT += dt; roomT += dt; runT += dt; }
```

**3h — the tally feed.** Directly above the `if (!coachSeen) {` latch (`:600`) —
after the step loop, before `renderer.render` drains `world.events`:

```js
      feedTally(tally, world);
```

**3i — `ro.run`.** In the GAME branch of the `ro` literal, beside `time:`
(`:676`):

```js
              run: { r: tally.r, k: tally.k, p: tally.p, t: runT, best: bestRun },
```

**3j — the line pin.** In `tests/headless.test.mjs`, append one reason line to
the comment block above `:909` and raise the number in **both** the label and
the assertion:

```js
  // R1 run-summary wave: +22 lines (bests.js import; isFinale on the CFG
  // import; the run-state declarations plus startRunState/endRun; startRunState
  // in onStart and pause RESTART; endRun in persistScore; the split edge block;
  // the feedTally line; ro.run) — bumped 733->754.
  check("main.js stays a lean browser entry (<=754 lines)",
    L.length<=754,String(L.length));
```

If your `main.js` measures above 754, move the excess into `src/app/bests.js` —
**never raise the pin**.

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test
```

Expected: all green.

- [ ] **Step 5: Headed play-verify** (AGENTS.md: "Visual 3D feel is not covered
by Node")

Unregister the service worker and delete its caches first — a stale SW serves
pre-change bytes and looks exactly like a render change that did not land. Then
on `http://127.0.0.1:8080/index.html`, in **both** CLASSIC 2D (600×520) and
`?render=3d` (608×352):

1. **A LOSE.** All lines are inside the box: stamp, tally, delta, cue. The delta
   is `FURTHEST ROOM YET · NEW BEST` on a fresh profile, in the teal accent.
2. **A finale WIN** (room 5). Same stack plus the `FUSE/GRID CLEAR` headline; with
   TIME ATTACK on, all five lines stack without touching the box edge.
3. **A mid-room WIN** (room 2 or 3). The tally line is there; **the delta line is
   not**. That absence is the feature.
4. **The retry regression.** Die with a good score, then press fire on the LOSE
   screen and die again with a **worse** one. The second overlay must read
   `+n FROM YOUR CORE BEST`, never `NEW BEST`.
5. **Pause → QUIT TO MENU mid-run**, then start a new run and reach a worse
   score: the quit run's score is already the record to beat.
6. **A PLUS or HARD run.** The delta names the bucket it is comparing against
   (`PLUS · HARD`), so the sentence can never be read against the wrong record.

- [ ] **Step 6: PWA bump, MEMORY, commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together,
`current vN → vN+1`. Append to `MEMORY.md` under a new
`## 2026-09-07 — R1 run summary + per-heat bests` heading (newest first,
1–2 lines): that every run end now writes raw score and furthest room to
`nb.bests.v1` keyed on heat/pact/pace, and the WIN/LOSE overlay shows a tally
line always and a delta line only at a run end; and that the two orderings the
feature rests on — `bestRun` as a run-start snapshot, and the LOSE→PLAY edge as
a run start because `startGame` runs inside `step()` and never reaches
`onStart` — are pinned as regressions in `tests/bests.test.mjs`.

```bash
git add src/main.js tests/bests.test.mjs tests/headless.test.mjs MEMORY.md src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Record every run end in nb.bests.v1 and show a delta that cannot lie.

endRun is one idempotent write reached from three places: the LOSE edge, the
finale WIN, and persistScore, which already runs at all three drop-the-run
sites — a run that ends by quitting is a run that ended, and the runEnded latch
makes the finale path count once even though it hits two of them. bestRun is
snapshotted once at run start, because a score record is per-run while the
overlay draws on every room's clear; re-reading it mid-run would compare
against a record an earlier room's overlay already moved. The LOSE->PLAY edge
is a run start: startGame runs inside step() on the LOSE fire edge, so onStart
is never involved in a retry and run state reset only there goes stale. R7's
reset block is split rather than mirrored, since mirroring it would zero
rooms-cleared and run time at every room transition.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```
