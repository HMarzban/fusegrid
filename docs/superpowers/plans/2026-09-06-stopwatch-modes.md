# R7 — Time-attack stopwatch + MODES packaging — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every room clear records its time under a `(room, heat, pact, pace)`
key, whether or not the player asked for it. Switching TIME ATTACK on adds a
stopwatch chip to the HUD row and one line to the CLEARED overlay —
`ROOM 3 · 0:41.2 · BEST 0:38.9`, or `NEW BEST`. The four Pact toggles the player
never found get relabelled as **MODES** on LEVEL SELECT, with TIME ATTACK as a
visually separated fifth chip on `5`.

**Architecture:** The stopwatch is **not** `world.time` — `step()` bumps that at
its very top (`sim.js:42-43`), before the `PAUSE` early return (`:75-77`);
`main.js`'s fixed-step loop is ungated on `world.state` (`:548-561`); and
`loadLevel` never resets it (`world.js:44-114`). It is a run clock, not a room
clock, and it double-counts pause. R7 uses a main-owned `roomT` accumulator,
PLAY-only, reset per room, **mirroring `coachT` line for line** — the same trap
`coachT` exists to dodge, and commit `33668f7` is the precedent. Persistence is
one new module on the `nb.*` template (`src/app/times.js`, key `nb.times.v1`),
written on the WIN edge with the previous best captured **before** the write, so
the overlay can never read back the record it just set. Display is two optional
trailing args — `drawHudChips(c, world, tm)` and `drawOverlay(…, ui, tm)` —
absent ⇒ byte-identical to today, which is what keeps every shipped HUD and
overlay pin unmoved. MODES is a **presentation change on LEVEL SELECT**: no
sub-page, no new `SCREEN`, no new `PACT` bit, and `src/core/pact.js` untouched.

**Tech Stack:** Pure ES modules, `node --test` / `tests/*.test.mjs`, Canvas 2D
plus vendored three.js r160. Zero npm runtime deps. `menudraw.js` must not
import from `src/app/`; `shellview.js` is the only render module that may.

**Spec:** `docs/superpowers/specs/2026-09-06-retention-wave1-design.md` §3

**Index:** `docs/superpowers/plans/2026-09-06-retention-wave1.md` — its
**Shared interfaces** block is authoritative for every signature below.

**Depends on:** R2 (`docs/superpowers/plans/2026-09-06-combo-callouts.md`). R2
lands first so the two one-line insertions into `renderer.js` and
`three/wrapper.js` have one author, not two. **Consequence: the spec's
`renderer.js:78` / `:84` and `wrapper.js:154-155` line citations are stale by
the time this plan runs — locate those edits by string, never by line number.**

## Global Constraints

- **The stopwatch reads `roomT`, never `world.time`.** The HUD chip, the WIN
  overlay line and the persisted best all read `roomT`; `world.time` is not used
  by R7 at all.
- **`bestPrev` is captured BEFORE the WIN-edge write.** The persist runs one
  frame before `drawOverlay` paints, so reading the store at draw time would
  print the time just set and every clear would print its own time as its best.
- **Recording is unconditional.** Every room WIN writes a time whether or not
  TIME ATTACK is on — the clock runs anyway, and it means a player who switches
  the mode on already has bests to beat. **Display** is what the toggle gates.
- **`drawHudChips`'s third arg and `drawOverlay`'s eighth arg are optional, and
  absent ⇒ byte-identical to today.** That is what keeps
  `tests/three.test.mjs` (`drawHudChips(rec, world)`),
  `tests/pickups.test.mjs:465-478` and `tests/heat.test.mjs:326-334` unmoved.
- **LOSE is unchanged.** A room time is only meaningful on a clear.
- **Every recorded time includes the fixed `CFG.WIN_DELAY` 1.6 s tail**
  (`config.js:5`). It is a constant on every clear, so times stay comparable; it
  is **never subtracted**.
- **`nb.times.v1` is the wave's only new key and `src/app/times.js` its only new
  module.** `src/pwa/shell.js`'s `SRC` entry is **mandatory**, not optional:
  `tests/pwa.test.mjs:98-103` walks `src/` and requires every `.js` to be in
  `PRECACHE`, so the suite fails until `shell.js` lists it.
- **MODES adds no `SCREEN` and no `PACT` bit.** `src/core/pact.js` is not
  touched: `PACT_NAME` stays `["LAST","BARE","THIN","SHRINK"]` and `pactLabel`'s
  `L/B/T/S` letters stay, so the HIGH SCORES `p` column and every `pact.js` pin
  hold. `MODE_NAME` is a **render-side** table in `menudraw.js`, the same
  duplication precedent `PLAQUE_NAME` (`menudraw.js:653`) already sets.
- **The fifth chip must not read as a fifth Pact bit.** Two devices enforce it:
  the **16 px double gap** before it, and a colour **outside `PACT_COL`**.
- **The whole rail is gated on `showPact = !!unlocked`.** The pre-unlock LEVEL
  SELECT stays **byte-identical**, which is what `menudraw.test.mjs`'s
  `drawLevelSelect(c, 3, L, 1, 1)` actually renders. Stated tradeoff: R7's
  success metric is only measurable for unlocked players. Bests are still
  recorded from run one.
- **`startRun()`'s args are unchanged** — `{level, heat, pact, pace}`. TIME
  ATTACK never reaches `onStart`, never reaches `world`, and therefore never
  reaches `step()`. **Pinned as an absence.**
- **Never move the right-aligned score column.** If the headed check shows any
  HUD overlap, narrow ENEMIES further — the right-aligned score column is the
  arcade convention the HUD is built on.
- Comments only where the file already uses them: `scenes.js`, `menudraw.js`,
  `menuapp.js`, `shellview.js`, `main.js` and every `src/app/*` store all do.
- Never write the banned grid-bomb franchise name into any committed file.
- PWA: bump `CACHE_NAME` (`src/pwa/shell.js:1`) and `REV` (`sw.js:3`)
  **together**, `current vN → vN+1`, in **every** commit here. **Read the
  current value first** — R2 has already moved it past `v103`, and other
  sessions bump the same two lines.
- **`tests/menudraw.test.mjs` and `tests/three.test.mjs` are dirty in
  `git status`.** Re-read both before editing and locate edits by string.

---

### Task 1: `src/app/times.js` — the one new key

**Files:**
- Create: `src/app/times.js`
- Create: `tests/times.test.mjs`
- Modify: `src/pwa/shell.js` — `SRC` gains `"src/app/times.js"` (after
  `"src/app/store.js"`), and `:1` `CACHE_NAME`
- Modify: `sw.js:3`

**Interfaces:**
- Consumes: `clampHeat` (`core/heat.js`), `clampPact` (`core/pact.js`),
  `clampPace` (`core/pace.js`), `defaultStore` (`app/store.js`)
- Produces: `TIMES_KEY`, `TIMES_MAX`, `timeKey`, `clampTimes`, `loadTimes`,
  `saveTimes`, `bestOf`, `recordTime`

- [ ] **Step 1: Write the failing tests** — create `tests/times.test.mjs`

```js
import {
  TIMES_KEY,
  TIMES_MAX,
  timeKey,
  clampTimes,
  loadTimes,
  saveTimes,
  bestOf,
  recordTime,
} from "../src/app/times.js";

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

// ---- 1. timeKey: the 5-tuple minus seed, pace shifted +1 ----
{
  check("TIMES_KEY is nb.times.v1", TIMES_KEY === "nb.times.v1", TIMES_KEY);
  check("TIMES_MAX is 96", TIMES_MAX === 96, TIMES_MAX);
  check(
    "timeKey: room:heat:pact:pace+1",
    timeKey({ level: 3, heat: 1, pact: 5, pace: -1 }) === "3:1:5:0",
    timeKey({ level: 3, heat: 1, pact: 5, pace: -1 }),
  );
  check(
    "timeKey: junk heat/pact/pace clamp through the core clamps",
    timeKey({ level: 8, heat: 99, pact: 999, pace: 9 }) === "8:2:15:2" &&
      timeKey({ level: 1, heat: -4, pact: -1, pace: -9 }) === "1:0:15:0",
    timeKey({ level: 8, heat: 99, pact: 999, pace: 9 }) +
      " / " +
      timeKey({ level: 1, heat: -4, pact: -1, pace: -9 }),
  );
  check(
    "timeKey: a missing pace is NORM, not a hole in the key",
    timeKey({ level: 3 }) === "3:0:0:1",
    timeKey({ level: 3 }),
  );
  check(
    "timeKey: pure — reads the world and nothing else, never throws",
    timeKey({}) === "0:0:0:1" && timeKey(null) === "0:0:0:1",
    timeKey(null),
  );
}

// ---- 2. clampTimes: the gate on every load and every save ----
{
  const raw = {
    on: 1,
    b: {
      "3:1:5:0": 412,
      "9:1:5:0": 300, // room out of range
      "3:1:5": 300, // malformed
      "4:0:0:1": 0, // below the floor
      "5:0:0:1": 6000, // above the ceiling
      "6:0:0:1": 41.5, // not an integer
      "7:0:0:1": "412", // not a number
    },
  };
  const c = clampTimes(raw);
  check(
    "clampTimes keeps only the well-formed entry",
    Object.keys(c.b).length === 1 && c.b["3:1:5:0"] === 412,
    JSON.stringify(c.b),
  );
  check("clampTimes keeps on", c.on === 1, c.on);
  check(
    "clampTimes: junk in, a fresh empty shape out, never a throw",
    JSON.stringify(clampTimes(null)) === '{"on":0,"b":{}}' &&
      JSON.stringify(clampTimes(7)) === '{"on":0,"b":{}}' &&
      JSON.stringify(clampTimes({ b: 5 })) === '{"on":0,"b":{}}',
  );
  /* room cycles every 8 and pact every 15, so lcm(8,15) = 120 DISTINCT keys —
     the fixture has to overflow 96 or the cap is never exercised. */
  const big = { on: 0, b: {} };
  for (let i = 0; i < TIMES_MAX + 24; i++)
    big.b[1 + (i % 8) + ":0:" + (i % 15) + ":1"] = 100 + i;
  const keys0 = Object.keys(big.b);
  const capped = clampTimes(big);
  check(
    "the cap fixture really overflows: 120 distinct well-formed keys",
    keys0.length === 120 && keys0.length > TIMES_MAX,
    keys0.length,
  );
  check(
    "clampTimes caps at 96",
    Object.keys(capped.b).length === TIMES_MAX,
    keys0.length + " -> " + Object.keys(capped.b).length,
  );
  check(
    "clampTimes drops the FIRST inserted on overflow, keeping the newest",
    !Object.prototype.hasOwnProperty.call(capped.b, keys0[0]) &&
      Object.prototype.hasOwnProperty.call(capped.b, keys0[keys0.length - 1]),
    keys0[0] + " dropped / " + keys0[keys0.length - 1] + " kept",
  );
}

// ---- 3. recordTime: strictly faster, floored, and a NEW object every time ----
{
  const k = "3:1:5:0";
  const a = clampTimes(null);
  const b = recordTime(a, k, 41.23);
  check("recordTime writes when there is no prior", b.b[k] === 412, b.b[k]);
  check("recordTime returns a new object, never mutating", a.b[k] === undefined);
  const c = recordTime(b, k, 38.9);
  check("recordTime writes a strictly faster time", c.b[k] === 389, c.b[k]);
  const d = recordTime(c, k, 38.9);
  check("recordTime does NOT write an equal time", d.b[k] === 389, d.b[k]);
  const e = recordTime(d, k, 44.0);
  check("recordTime does NOT write a slower time", e.b[k] === 389, e.b[k]);
  check(
    "recordTime FLOORS, so stored and displayed can never disagree by a tenth",
    recordTime(clampTimes(null), k, 41.29).b[k] === 412,
    recordTime(clampTimes(null), k, 41.29).b[k],
  );
  check(
    "recordTime clamps to 1..5999",
    recordTime(clampTimes(null), "1:0:0:1", 0).b["1:0:0:1"] === 1 &&
      recordTime(clampTimes(null), "2:0:0:1", 9999).b["2:0:0:1"] === 5999,
  );
  check(
    "bestOf returns seconds, or null when the key is unseen",
    bestOf(c, k) === 38.9 && bestOf(c, "4:0:0:1") === null && bestOf(null, k) === null,
    bestOf(c, k),
  );
}

// ---- 4. load/save round-trip, and both survive a throwing store ----
{
  const st = mapStore();
  saveTimes({ on: 1, b: { "3:1:5:0": 412 } }, st);
  const back = loadTimes(st);
  check(
    "loadTimes/saveTimes round-trip through an injected store",
    back.on === 1 && back.b["3:1:5:0"] === 412,
    JSON.stringify(back),
  );
  check(
    "loadTimes on an empty store is the default shape",
    JSON.stringify(loadTimes(mapStore())) === '{"on":0,"b":{}}',
  );
  const bad = mapStore();
  bad.setItem(TIMES_KEY, "{not json");
  check(
    "loadTimes degrades a corrupt blob to the default, never throws",
    JSON.stringify(loadTimes(bad)) === '{"on":0,"b":{}}',
  );
  let threw = false;
  try {
    loadTimes(throwStore());
    saveTimes({ on: 1, b: {} }, throwStore());
  } catch (_) {
    threw = true;
  }
  check("loadTimes/saveTimes never throw on a hostile store", !threw);
  check(
    "saveTimes clamps on the way out, so a bad key can never land",
    (() => {
      const s = mapStore();
      saveTimes({ on: 3, b: { "9:9:9:9": 5 } }, s);
      return s.getItem(TIMES_KEY) === '{"on":1,"b":{}}';
    })(),
    mapStore() && "see assertion",
  );
}

console.log("\n  TIMES RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/times.test.mjs tests/pwa.test.mjs
```

Expected: FAIL — `times.test.mjs` reports
`Cannot find module '.../src/app/times.js'`. (`pwa.test.mjs` is still green at
this step; it fails only once the module exists without its `SRC` entry, which
is why both are run together.)

- [ ] **Step 3: Implement** — create `src/app/times.js`

```js
import { clampHeat } from "../core/heat.js";
import { clampPact } from "../core/pact.js";
import { clampPace } from "../core/pace.js";
import { defaultStore } from "./store.js";

export const TIMES_KEY = "nb.times.v1";
export const TIMES_MAX = 96;
/* One key, one module — the load*/save*(store) template pactstore / plaques /
   pacestore / cabinetseen / coach / settings all share.
   The key is the report's 5-tuple MINUS the seed: a time is only comparable
   against another time at the same room, heat, pact and pace, because paceMul
   scales player speed inside updatePlayer (sim.js:124) and pace is not folded
   into the world's rng seeding. pace is shifted +1 so the segment is 0..2 and
   the whole key is regex-checkable. Values are integer TENTHS of a second, so
   the stored number and the displayed number are the same number. */
const KEY_RE = /^[1-8]:[0-2]:(?:[0-9]|1[0-5]):[0-2]$/;
const MIN_D = 1,
  MAX_D = 5999;

export function timeKey(world) {
  const w = world || {};
  return (
    (w.level | 0) +
    ":" +
    clampHeat(w.heat) +
    ":" +
    clampPact(w.pact) +
    ":" +
    (clampPace(w.pace) + 1)
  );
}

const bit = (v, d) => {
  if (v === undefined || v === null) return d ? 1 : 0;
  if (typeof v === "number") return isFinite(v) && v ? 1 : 0;
  return v ? 1 : 0;
};
const okD = (v) =>
  typeof v === "number" && isFinite(v) && (v | 0) === v && v >= MIN_D && v <= MAX_D;

/* The key form is non-integer-like, so JS preserves insertion order over `b`
   deterministically — which is what makes "drop the FIRST inserted" a defined
   overflow policy rather than a coin flip. */
export function clampTimes(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const src = o.b && typeof o.b === "object" ? o.b : {};
  const keys = Object.keys(src).filter((k) => KEY_RE.test(k) && okD(src[k]));
  const kept = keys.length > TIMES_MAX ? keys.slice(keys.length - TIMES_MAX) : keys;
  const b = {};
  for (const k of kept) b[k] = src[k];
  return { on: bit(o.on, 0), b };
}

export function loadTimes(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.getItem !== "function") return clampTimes(null);
    const raw = st.getItem(TIMES_KEY);
    if (raw === null) return clampTimes(null);
    return clampTimes(JSON.parse(raw));
  } catch (_) {
    return clampTimes(null);
  }
}

export function saveTimes(v, store) {
  try {
    const st = store || defaultStore();
    if (st && typeof st.setItem === "function")
      st.setItem(TIMES_KEY, JSON.stringify(clampTimes(v)));
  } catch (_) {}
}

export function bestOf(v, key) {
  const b = v && v.b;
  const d = b ? b[key] : undefined;
  return okD(d) ? d / 10 : null;
}

/* FLOOR, not round: a stored 412 must display as 0:41.2 and never as a tenth
   the player did not run. Writes only on no-prior or strictly faster, so a
   re-clear at the same time leaves the record alone. */
export function recordTime(v, key, sec) {
  const cur = clampTimes(v);
  if (!KEY_RE.test(key)) return cur;
  const n = typeof sec === "number" && isFinite(sec) ? sec : 0;
  const d = Math.min(MAX_D, Math.max(MIN_D, Math.floor(n * 10)));
  const prior = cur.b[key];
  if (okD(prior) && prior <= d) return cur;
  const b = Object.assign({}, cur.b);
  b[key] = d;
  return clampTimes({ on: cur.on, b });
}
```

Then add `"src/app/times.js"` to `SRC` in `src/pwa/shell.js`, immediately after
`"src/app/store.js"`.

- [ ] **Step 4: Run to PASS**

```bash
node --test tests/times.test.mjs tests/pwa.test.mjs
```

Expected: green. `pwa.test.mjs` proves the `SRC` entry landed —
`PRECACHE has ./src/app/times.js`.

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together,
`current vN → vN+1`.

```bash
git add src/app/times.js tests/times.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Add src/app/times.js: per-room best times under nb.times.v1.

The key is the report's five-tuple minus the seed — room, heat, pact, pace —
because pace scales player speed inside updatePlayer and is not folded into
the world's rng seeding, so a best recorded at one pace is not a best at
another. Values are integer tenths and recordTime floors rather than rounds,
so the stored number and the displayed number can never disagree. The map caps
at 96 entries, dropping the first inserted.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `fmtTime`, `timeLine`, the HUD chip and the WIN overlay line

**Files:**
- Modify: `src/render/scenes.js` — new `fmtTime` / `timeLine` beside
  `runStamp` (`:47-56`); `drawOverlay`'s signature + WIN branch (`:83-114`);
  `drawHudChips`'s signature + the ENEMIES/TIME chips (`:181-232`)
- Modify: `src/render/renderer.js` — the `drawOverlay` and `drawHudChips` arg
  lists (**locate by the strings `drawOverlay(ctx, world, B.w` and
  `drawHudChips(ctx, world`**)
- Modify: `src/render/three/wrapper.js` — same two arg lists (**locate by
  `drawOverlay(ovCtx,world,B.w` and `drawHudChips(ovCtx,world`**)
- Modify: `tests/times.test.mjs` — append blocks 5–8
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: nothing new
- Produces:
  - `fmtTime(sec)` → string, always ≤ 6 chars
  - `timeLine(world, tm)` → the locked WIN copy
  - `drawHudChips(c, world, tm)` — 3rd arg optional
  - `drawOverlay(c, world, w, h, cx, cy, ui, tm)` — 8th arg optional
  - both renderers pass `o&&o.time` through as `tm`

- [ ] **Step 1: Write the failing tests**

Extend `tests/times.test.mjs`'s imports:

```js
import { fmtTime, timeLine, drawHudChips, drawOverlay } from "../src/render/scenes.js";
import { readFileSync } from "node:fs";
```

Append, before the summary:

```js
const rec = () => {
  const texts = [];
  const noop = () => {};
  const c = {
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
    rotate: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    arcTo: noop,
    bezierCurveTo: noop,
    quadraticCurveTo: noop,
    ellipse: noop,
    fill: noop,
    stroke: noop,
    fillRect: noop,
    strokeRect: noop,
    fillText: (s) => texts.push(String(s)),
    strokeText: (s) => texts.push(String(s)),
  };
  return { c, texts };
};
const HUD_W = {
  lives: 3,
  score: 0,
  heat: 0,
  level: 4,
  enemies: [1, 2],
  players: [{ bombs: 2, range: 3 }],
};

// ---- 5. fmtTime: never longer than six characters ----
{
  const want = [
    [0, "0:00.0"],
    [41.23, "0:41.2"],
    [59.99, "0:59.9"],
    [61, "1:01.0"],
    [9999, "9:59.9"],
    [-5, "0:00.0"],
  ];
  const bad = want.filter(([n, s]) => fmtTime(n) !== s);
  check(
    "fmtTime: clamped, floored, zero-padded",
    !bad.length,
    JSON.stringify(bad.map(([n]) => [n, fmtTime(n)])),
  );
  check(
    "fmtTime: never longer than 6 chars, never a throw",
    want.every(([n]) => fmtTime(n).length <= 6) &&
      fmtTime(undefined) === "0:00.0" &&
      fmtTime(NaN) === "0:00.0",
    fmtTime(undefined),
  );
}

// ---- 6. timeLine: both locked copy forms ----
{
  check(
    "timeLine: a slower clear names the standing best",
    timeLine({ level: 3 }, { on: true, t: 41.23, best: 38.9 }) ===
      "ROOM 3 · 0:41.2 · BEST 0:38.9",
    timeLine({ level: 3 }, { on: true, t: 41.23, best: 38.9 }),
  );
  check(
    "timeLine: no prior best is NEW BEST",
    timeLine({ level: 3 }, { on: true, t: 41.23, best: null }) ===
      "ROOM 3 · 0:41.2 · NEW BEST",
    timeLine({ level: 3 }, { on: true, t: 41.23, best: null }),
  );
  check(
    "timeLine: beating the standing best is NEW BEST",
    timeLine({ level: 3 }, { on: true, t: 41.23, best: 45 }) ===
      "ROOM 3 · 0:41.2 · NEW BEST",
    timeLine({ level: 3 }, { on: true, t: 41.23, best: 45 }),
  );
}

// ---- 7. drawHudChips: the third arg is optional and absent is byte-identical ----
{
  const a = rec();
  drawHudChips(a.c, HUD_W);
  const b = rec();
  drawHudChips(b.c, HUD_W, undefined);
  const d = rec();
  drawHudChips(d.c, HUD_W, { on: false, t: 41.23 });
  check(
    "drawHudChips with no third arg records today's exact fillText list",
    a.texts.join("|") === b.texts.join("|") &&
      a.texts.join("|") === d.texts.join("|") &&
      !a.texts.includes("TIME"),
    a.texts.join("|"),
  );
  const e = rec();
  drawHudChips(e.c, HUD_W, { on: true, t: 41.23 });
  check(
    "drawHudChips with tm.on paints a TIME chip reading fmtTime(tm.t)",
    e.texts.includes("TIME") && e.texts.includes("0:41.2"),
    e.texts.join("|"),
  );
  check(
    "the TIME chip is additive — every existing chip label survives",
    ["BOMB", "FLAME", "LV", "ENEMIES"].every((s) => e.texts.includes(s)),
    e.texts.join("|"),
  );
}

// ---- 8. drawOverlay: the eighth arg is optional; LOSE and PAUSE untouched ----
{
  const W = { state: "WIN", level: 3, finale: false, score: 10, heat: 0 };
  const a = rec();
  drawOverlay(a.c, W, 600, 520, 300, 260, undefined, undefined);
  check(
    "drawOverlay WIN with no tm records today's lines and no ROOM line",
    a.texts.some((s) => s.indexOf("CLEARED") >= 0) &&
      !a.texts.some((s) => s.indexOf("ROOM 3") === 0),
    a.texts.join("|"),
  );
  const b = rec();
  drawOverlay(b.c, W, 600, 520, 300, 260, undefined, {
    on: true,
    t: 41.23,
    best: 38.9,
  });
  check(
    "drawOverlay WIN with tm.on adds exactly the timeLine string",
    b.texts.includes("ROOM 3 · 0:41.2 · BEST 0:38.9") &&
      b.texts.some((s) => s.indexOf("CLEARED") >= 0) &&
      b.texts.length === a.texts.length + 1,
    b.texts.join("|"),
  );
  const L = rec();
  const Lw = { state: "LOSE", level: 3, finale: false, score: 10, heat: 0 };
  drawOverlay(L.c, Lw, 600, 520, 300, 260, undefined, { on: true, t: 41.23, best: null });
  const L2 = rec();
  drawOverlay(L2.c, Lw, 600, 520, 300, 260);
  check(
    "drawOverlay LOSE ignores tm entirely — a room time means nothing on a death",
    L.texts.join("|") === L2.texts.join("|"),
    L.texts.join("|"),
  );
  const P = rec();
  const Pw = { state: "PAUSE", level: 3, finale: false, score: 10, heat: 0 };
  drawOverlay(P.c, Pw, 600, 520, 300, 260, { view: 0, cursor: 0 }, {
    on: true,
    t: 41.23,
    best: null,
  });
  const P2 = rec();
  drawOverlay(P2.c, Pw, 600, 520, 300, 260, { view: 0, cursor: 0 });
  check(
    "drawOverlay PAUSE ignores tm entirely",
    P.texts.join("|") === P2.texts.join("|"),
    P.texts.join("|"),
  );
}

// ---- wiring: both renderers pass o.time through as tm ----
{
  for (const [f, ov, ch] of [
    ["src/render/renderer.js", "drawOverlay(ctx, world, B.w", "drawHudChips(ctx, world"],
    ["src/render/three/wrapper.js", "drawOverlay(ovCtx,world,B.w", "drawHudChips(ovCtx,world"],
  ]) {
    const src = readFileSync(f, "utf8");
    const ovLine = (src.match(new RegExp(".*" + ov.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ".*")) || [""])[0];
    const chLine = (src.match(new RegExp(".*" + ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ".*")) || [""])[0];
    check(
      f + ": drawOverlay receives o.time as its eighth arg",
      /o\s*&&\s*o\.time/.test(ovLine),
      ovLine.trim(),
    );
    check(
      f + ": drawHudChips receives o.time as its third arg",
      /o\s*&&\s*o\.time/.test(chLine),
      chLine.trim(),
    );
  }
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/times.test.mjs
```

Expected: FAIL — `SyntaxError: The requested module
'../src/render/scenes.js' does not provide an export named 'fmtTime'`.

- [ ] **Step 3: Implement**

**3a — `src/render/scenes.js`.** Add after `copyPayload` (`:54-56`):

```js
/* R7 stopwatch formatting. Pure, exported, pinned. Clamped to [0,599.9] and
   FLOORED to tenths so it can never disagree with what times.js stored; a room
   past 9:59.9 pins there, since it is not a time-attack contender. Always six
   characters or fewer, which is what makes the HUD chip's width budget hold. */
export function fmtTime(sec) {
  const n = typeof sec === "number" && isFinite(sec) ? sec : 0;
  const s = Math.min(599.9, Math.max(0, n));
  const d = Math.floor(s * 10);
  const m = Math.floor(d / 10) % 60;
  return (
    Math.floor(d / 600) + ":" + (m < 10 ? "0" + m : String(m)) + "." + (d % 10)
  );
}
/* tm.best is main's bestPrev, captured BEFORE the WIN-edge write — otherwise
   this line would read back the record it just set and every clear would print
   its own time as the best. */
export function timeLine(world, tm) {
  const t = tm || {};
  return (
    "ROOM " +
    ((world && world.level) | 0) +
    " · " +
    fmtTime(t.t) +
    " · " +
    (t.best == null || t.t < t.best ? "NEW BEST" : "BEST " + fmtTime(t.best))
  );
}
```

**3b — `drawOverlay`.** Add an eighth parameter and branch the WIN cue only:

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
) {
```

and in the WIN branch replace the two `sub(...)` calls with:

```js
  if (world.state === "WIN") {
    head(winHeadline(world), "#37f0d0");
    sub(runStamp(world), "#9fb3d8");
    /* R7: one extra line only when TIME ATTACK is on, which pushes the cue from
       dy 44 to dy 68 — cy + 68 = 328, well inside the 520 box. LOSE never gets
       it: a room time is only meaningful on a clear. */
    if (tm && tm.on) {
      sub(timeLine(world, tm), "#9fb3d8", 44);
      sub(overlayCue(world) + " · C copy", "#9fb3d8", 68);
    } else sub(overlayCue(world) + " · C copy", "#9fb3d8", 44);
  } else if (world.state === "LOSE") {
```

**3c — `drawHudChips`.** Add a third parameter and branch the last two chips:

```js
export function drawHudChips(c, world, tm) {
```

replace the `ENEMIES` chip call with:

```js
  /* R7: the ENEMIES chip narrows from 94 to 64 to make room for the stopwatch,
     which ends at 530 against the right-aligned score column's left reach of
     541 at six digits. tm absent or tm.on falsy is byte-identical to before —
     which is what keeps three.test.mjs and pickups.test.mjs unmoved. If a
     headed check ever shows overlap, narrow ENEMIES further; never move the
     right-aligned score column. */
  const ta = !!(tm && tm.on);
  chip(
    386,
    ta ? 64 : 94,
    "ENEMIES",
    Array.isArray(world.enemies) ? world.enemies.length : 0,
    null,
    null,
  );
  if (ta) chip(458, 72, "TIME", fmtTime(tm.t), null, null);
```

**3d — `src/render/renderer.js`.** Locate `drawOverlay(ctx, world, B.w` and
`drawHudChips(ctx, world` and extend both:

```js
      drawOverlay(ctx, world, B.w, B.h, B.cx, B.cy, o&&o.pause, o&&o.time);
```
```js
    if(o&&o.hud===true) drawHudChips(ctx, world, o&&o.time);
```

**3e — `src/render/three/wrapper.js`.** The same two, on its own call sites
(`ovCtx`, and its `drawOverlay(ovCtx,world,B.w,B.h,B.cx,B.cy,o&&o.pause)`).

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test
```

Expected: all green — in particular `tests/heat.test.mjs` (its WIN-branch check
passes an `undefined` eighth arg), `tests/three.test.mjs` and
`tests/pickups.test.mjs` (both call `drawHudChips` with two args) are unmoved.

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together,
`current vN → vN+1`.

```bash
git add src/render/scenes.js src/render/renderer.js src/render/three/wrapper.js tests/times.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Add the stopwatch chip and the CLEARED time line behind an optional arg.

drawHudChips gains an optional third arg and drawOverlay an optional eighth;
absent, both render byte-identically to today, which is what leaves the shipped
HUD and overlay pins in three/pickups/heat unmoved. With TIME ATTACK on, the
ENEMIES chip narrows to make room for a TIME chip that ends clear of the
right-aligned score column, and the WIN overlay gains one line that pushes the
cue down. LOSE and PAUSE ignore the new arg entirely.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `roomT` — the room clock, the WIN-edge write, and `bestPrev`

**Files:**
- Modify: `src/main.js` — the `times.js` import; `roomT` / `bestPrev`
  declarations beside `coachT` (`:124`); `onStart` (`:164`); `onPauseCmd`'s
  RESTART branch (`:220`); the WIN-edge block after the `noteWorldEdge` persist
  and **before** `prevSt = world.state` (`:536-538`); the accumulate line
  (`:547`); `ro.time` in the GAME `ro` branch (`:632-646`)
- Modify: `tests/times.test.mjs` — append the two self-review blocks
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `timeKey`, `loadTimes`, `saveTimes`, `bestOf`, `recordTime`
- Produces: `o.time = {on, t, best}` on the GAME render opts

- [ ] **Step 1: Write the failing tests**

Extend `tests/times.test.mjs`'s imports:

```js
import { createGame } from "../src/main.js";
```

Append, before the summary:

```js
/* ---- SELF-REVIEW PIN A: the stopwatch is roomT, NOT world.time.
   step() bumps world.time at sim.js:42-43, BEFORE the PAUSE early return at
   :75-77, and main's step loop is ungated on world.state — so world.time keeps
   climbing through a pause. This pin fails if anyone ever "simplifies" roomT
   back to world.time, because it asserts the two clocks DISAGREE. ---- */
{
  const texts = [];
  const noop = () => {};
  const rc = {
    fillText: (s) => texts.push(String(s)),
    strokeText: (s) => texts.push(String(s)),
  };
  for (const n of [
    "save", "restore", "translate", "rotate", "scale", "beginPath", "closePath",
    "moveTo", "lineTo", "arc", "arcTo", "bezierCurveTo", "quadraticCurveTo",
    "ellipse", "fill", "stroke", "fillRect", "strokeRect", "clearRect",
    "setTransform", "transform", "drawImage",
  ])
    rc[n] = noop;
  rc.createLinearGradient = () => ({ addColorStop: noop });
  rc.createRadialGradient = () => ({ addColorStop: noop });
  const fake = { getContext: () => rc, addEventListener() {}, style: {} };
  const g = createGame(fake, { autoplay: true, seed: 41 });
  /* app.timeAttack is added for real in Task 4; ro.time reads !!app.timeAttack
     dynamically, so setting it here is exactly what the shipped toggle will do
     and this pin survives Task 4 unchanged. */
  g.app.timeAttack = true;
  const stamp = () => {
    const t = texts.filter((s) => /^\d:\d\d\.\d$/.test(s));
    return t.length ? t[t.length - 1] : null;
  };
  let t = 1000;
  for (let i = 0; i < 40; i++) {
    t += 16;
    texts.length = 0;
    g.loop(t);
  }
  const running = stamp();
  check("A: the TIME chip paints a stopwatch while playing", running !== null, running);
  const wt0 = g.world.time;
  g.input.onPause();
  check("A: onPause reaches world.state", g.world.state === "PAUSE", g.world.state);
  for (let i = 0; i < 60; i++) {
    t += 16;
    texts.length = 0;
    g.loop(t);
  }
  const paused = stamp();
  check(
    "A: roomT does NOT advance while paused — the chip is frozen",
    paused === running,
    running + " -> " + paused,
  );
  check(
    "A: control — world.time DID advance while paused, so the pin is not vacuous",
    g.world.time > wt0,
    wt0 + " -> " + g.world.time,
  );
  g.input.onPause();
  for (let i = 0; i < 40; i++) {
    t += 16;
    texts.length = 0;
    g.loop(t);
  }
  check(
    "A: resuming continues the room, it does not restart it",
    stamp() !== running && stamp() !== "0:00.0",
    running + " -> " + stamp(),
  );
}

/* ---- SELF-REVIEW PIN B: bestPrev is captured BEFORE the write.
   The WIN-edge persist runs one frame before drawOverlay paints, so a BEST read
   back from the store would print the time just set. Pinned twice: once on the
   store semantics, once on the ORDER of the two statements in main.js. ---- */
{
  const k = "3:0:0:1";
  let v = clampTimes(null);
  let bestPrev = bestOf(v, k); // captured BEFORE
  v = recordTime(v, k, 41.23);
  const first = timeLine({ level: 3 }, { on: true, t: 41.23, best: bestPrev });
  check(
    "B: the first clear reads NEW BEST, never its own freshly-written time",
    first === "ROOM 3 · 0:41.2 · NEW BEST",
    first,
  );
  check(
    "B: reading the store AFTER the write is what this forbids",
    timeLine({ level: 3 }, { on: true, t: 41.23, best: bestOf(v, k) }) ===
      "ROOM 3 · 0:41.2 · BEST 0:41.2",
    "that string is the bug, and the pin above is what excludes it",
  );
  bestPrev = bestOf(v, k);
  v = recordTime(v, k, 44.0);
  const second = timeLine({ level: 3 }, { on: true, t: 44.0, best: bestPrev });
  check(
    "B: a slower second clear names the standing best and does not overwrite it",
    second === "ROOM 3 · 0:44.0 · BEST 0:41.2" && v.b[k] === 412,
    second + " / " + v.b[k],
  );
  const mainSrc = readFileSync("src/main.js", "utf8");
  const blk = (mainSrc.match(/prevSt === "PLAY" && world\.state === "WIN"[\s\S]{0,320}/) || [""])[0];
  check(
    "B: main.js captures bestPrev BEFORE it calls saveTimes/recordTime",
    blk.indexOf("bestPrev = bestOf(") >= 0 &&
      blk.indexOf("bestPrev = bestOf(") < blk.indexOf("saveTimes(recordTime("),
    blk.trim().slice(0, 200),
  );
  check(
    "B: PAUSE -> PLAY is deliberately NOT a roomT reset — only WIN/LOSE -> PLAY is",
    /\(prevSt === "WIN" \|\| prevSt === "LOSE"\) && world\.state === "PLAY"/.test(mainSrc) &&
      !/prevSt === "PAUSE"[^\n]*roomT = 0/.test(mainSrc),
    (mainSrc.match(/roomT = 0;[^\n]*/g) || []).join(" | "),
  );
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/times.test.mjs
```

Expected: FAIL — pin A's `"A: the TIME chip paints a stopwatch while playing"`
reports `-> null` (no `ro.time`, so no chip), and pin B's two `main.js` source
checks report an empty match.

- [ ] **Step 3: Implement** — `src/main.js`

**3a — imports.** Add beside the other `src/app` store imports (`:25-26`):

```js
import { timeKey, loadTimes, saveTimes, bestOf, recordTime } from "./app/times.js";
```

**3b — declarations.** Beside `let coachT = 0;` (`:124`):

```js
  /* roomT (R7): the SAME trap coachT dodges. world.time is bumped at the top of
     step() before the PAUSE early return (sim.js:42-43 vs :75-77), main's
     fixed-step loop is ungated on world.state, and loadLevel never resets it —
     so it is a run clock that double-counts pause, not a room clock. roomT is
     main's own PLAY-only per-room clock; the HUD chip, the CLEARED line and the
     persisted best all read it, and world.time is not used by R7 at all.
     bestPrev is the standing record captured BEFORE the WIN-edge write, so the
     overlay can never read back the record it just set. */
  let roomT = 0;
  let bestPrev = null;
```

**3c — `onStart`.** Beside `coachT = 0;` (`:164`):

```js
    roomT = 0;
    bestPrev = null;
```

**3d — `onPauseCmd`'s RESTART branch.** Beside `coachPlanted = false;` (`:220`):

```js
        roomT = 0;
        bestPrev = null;
```

`QUIT TO MENU` is deliberately **not** a reset site: it sets `prevSt = null` and
leaves the shell, the accumulator only runs inside the
`app.screen === SCREEN.GAME` branch, and the next run always passes through
`onStart`, which zeroes both fields.

**3e — the WIN edge.** Between the `noteWorldEdge` persist and
`prevSt = world.state;`:

```js
      if (prevSt === "PLAY" && world.state === "WIN") {
        const k = timeKey(world), v = loadTimes();
        bestPrev = bestOf(v, k);                 // captured BEFORE the write
        saveTimes(recordTime(v, k, roomT));
      }
      if ((prevSt === "WIN" || prevSt === "LOSE") && world.state === "PLAY") {
        roomT = 0; bestPrev = null;              // WIN->next room, LOSE->new run
      }
      prevSt = world.state;
```

Recording is unconditional — it happens on every room WIN whether or not TIME
ATTACK is on. The clock runs anyway, and it means a player who switches the mode
on already has bests to beat. Every recorded time includes the fixed
`CFG.WIN_DELAY` 1.6 s tail; it is a constant on every clear and is never
subtracted.

**3f — the accumulator.** Directly beneath the `coachT` line (`:547`):

```js
      if (world.state === "PLAY") coachT += dt; // PAUSE must not burn the coach window
      if (world.state === "PLAY") roomT += dt;  // ...and must not burn the room clock
```

**3g — `ro.time`.** In the GAME branch of the `ro` literal, beside `pause:`:

```js
              pause: { view: app.pauseView | 0, cursor: app.pauseCursor | 0 },
              time: { on: !!app.timeAttack, t: roomT, best: bestPrev },
```

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test
```

Expected: all green. `app.timeAttack` does not exist yet, so `!!app.timeAttack`
is `false`, `tm.on` is falsy and the HUD and overlay are byte-identical to
today for a real player — recording is live, display is not, which is exactly
the "record unconditionally, gate display" split.

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together,
`current vN → vN+1`.

```bash
git add src/main.js tests/times.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Time each room on a PLAY-only roomT clock and record it on the WIN edge.

world.time cannot be the stopwatch: step() bumps it before the PAUSE early
return, main's step loop is ungated on world.state, and loadLevel never resets
it — so it double-counts pause and never restarts per room. roomT mirrors
coachT, which exists to dodge exactly this. The standing best is captured
before the write, so the CLEARED line can never print the record it just set.
Recording is unconditional; only the display is gated.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: MODES — the relabelled rail, the fifth chip, and `Digit5`

**Files:**
- Modify: `src/render/menudraw.js` — the `pact.js` import (`:12`), new
  `MODE_NAME` + `TIME_COL`, `drawLevelSelect`'s signature (`:300`), head
  subtitle (`:306`), the `showPact` rail (`:375-399`), foot (`:401-406`)
- Modify: `src/app/menuapp.js` — `timeAttack` app field, `toggleTimeAttack()`,
  `Digit5` / `Numpad5` in `key()`, `o.onTimeAttack`
- Modify: `src/render/shellview.js` — `drawLevelSelect`'s 9th arg (`:97-106`)
- Modify: `src/main.js` — `timeAttack` seeding + `onTimeAttack` persist, beside
  `pace` / `onPaceChange` (`:194-196`)
- Modify: `tests/menudraw.test.mjs` (**re-read first — dirty in `git status`**),
  `tests/menu-level.test.mjs`, `tests/times.test.mjs`
- Modify: `MEMORY.md`, `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `loadTimes` / `saveTimes` (Task 1)
- Produces:
  - `drawLevelSelect(c, sel, L, t, heat, pact, unlocked, pace, timeAttack)`
  - `app.timeAttack`, `app.toggleTimeAttack()`, `o.onTimeAttack(on)`

- [ ] **Step 1: Write the failing tests**

In `tests/menu-level.test.mjs`, after the existing `Digit2 stacks BARE` block,
add:

```js
{
  const a = createMenuApp();
  a.screen = SCREEN.LEVEL;
  check(
    "locked Digit5 is a no-op, exactly as Digit1-4 are",
    a.key("Digit5") === false && a.timeAttack === false,
    String(a.timeAttack),
  );
  a.pactUnlocked = true;
  const seen = [];
  const b = createMenuApp({ pactUnlocked: true, onTimeAttack: (v) => seen.push(v) });
  b.screen = SCREEN.LEVEL;
  check(
    "unlocked Digit5 arms TIME ATTACK and reports through onTimeAttack",
    b.key("Digit5") === true && b.timeAttack === true && seen.join() === "true",
    JSON.stringify(seen),
  );
  check(
    "Numpad5 is the same door",
    b.key("Numpad5") === true && b.timeAttack === false && seen.join() === "true,false",
    JSON.stringify(seen),
  );
  const m = createMenuApp({ pactUnlocked: true });
  m.screen = SCREEN.MENU;
  check(
    "Digit5 outside LEVEL is false and changes nothing",
    m.key("Digit5") === false && m.timeAttack === false,
  );
  const got = [];
  const s = createMenuApp({
    pactUnlocked: true,
    timeAttack: true,
    onStart: (x) => got.push(x),
  });
  s.screen = SCREEN.LEVEL;
  const args = s.startRun();
  check(
    "startRun hands onStart NO timeAttack key — it never reaches world or step()",
    got.length === 1 &&
      Object.keys(got[0]).sort().join(",") === "heat,level,pace,pact" &&
      !("timeAttack" in got[0]),
    JSON.stringify(got[0]),
  );
  check(
    "and startRun's returned args agree with what onStart received",
    args === got[0],
    JSON.stringify(args),
  );
}
```

(`startRun()` both fires `onStart(args)` and returns that same object —
`menuapp.js:523-541` — so the spy is the primary assertion, matching the shape
`menu-level.test.mjs:105-118` already uses, and the identity check makes the
duplication explicit rather than assumed.)

In `tests/menudraw.test.mjs`, inside the existing `for (const [W, H] of [[600,
520], [608, 352]])` loop, after the `level select heat chips` block, add:

```js
    {
      const { c, texts } = rec();
      md.drawLevelSelect(c, 3, L, 1, 1);
      const all = texts.map((t) => t.s).join("|");
      check(
        `level select LOCKED stays byte-identical at ${W}x${H} — no MODES rail`,
        !/IRON|TIME|MODES/.test(all),
        all,
      );
    }
    {
      const { c, texts, rects } = rec();
      md.drawLevelSelect(c, 3, L, 1, 1, 0, true, 0, true);
      const all = texts.map((t) => t.s);
      const p = plateOf(rects);
      const gloss = texts.find((t) => t.s.indexOf("TIME ATTACK") >= 0);
      const time = texts.find((t) => t.s === "5 TIME");
      check(
        `level select UNLOCKED shows the five MODES chips at ${W}x${H}`,
        all.includes("1 IRON") &&
          all.includes("2 BARE") &&
          all.includes("3 THIN") &&
          all.includes("4 SHRINK") &&
          all.includes("5 TIME") &&
          !all.includes("1 LAST"),
        all.join("|"),
      );
      check(
        `modes gloss + head + foot copy at ${W}x${H}`,
        !!gloss &&
          gloss.s === "5 TIME ATTACK · stopwatch + per-room best" &&
          all.some((s) => s.indexOf("ROOM + HEAT + PACE + MODES") >= 0) &&
          all.some((s) => s.indexOf("1–5 MODES") >= 0),
        all.join("|"),
      );
      check(
        `modes rail + gloss stay inside the plate at ${W}x${H}`,
        !!p && !!time && !!gloss &&
          time.y > p.y + 8 &&
          gloss.y > time.y &&
          gloss.y < p.y + p.h - 8,
        JSON.stringify({ py: p && p.y, ph: p && p.h, time, gloss }),
      );
    }
```

In `tests/times.test.mjs`, append before the summary:

```js
// ---- wiring: the toggle is seeded from and persisted to nb.times.v1 ----
{
  const mainSrc = readFileSync("src/main.js", "utf8");
  check(
    "main.js seeds app.timeAttack from loadTimes().on",
    /timeAttack:\s*loadTimes\(\)\.on\s*===\s*1/.test(mainSrc),
    (mainSrc.match(/timeAttack:[^\n]*/) || [])[0],
  );
  check(
    "main.js persists the toggle through onTimeAttack, the onPaceChange shape",
    /onTimeAttack:[^\n]*saveTimes\(/.test(mainSrc),
    (mainSrc.match(/onTimeAttack:[^\n]*/) || [])[0],
  );
  const shellSrc = readFileSync("src/render/shellview.js", "utf8");
  check(
    "shellview passes app.timeAttack as drawLevelSelect's ninth arg",
    /app\.pace,\s*\n\s*app\.timeAttack,/.test(shellSrc),
    (shellSrc.match(/drawLevelSelect\([^;]*\);/s) || [])[0],
  );
  const mdSrc = readFileSync("src/render/menudraw.js", "utf8");
  check(
    "menudraw keeps MODE_NAME render-side and never touches core PACT_NAME",
    /MODE_NAME\s*=\s*\[\s*"IRON"/.test(mdSrc) && !/PACT_NAME/.test(mdSrc),
    (mdSrc.match(/MODE_NAME[^\n]*/) || [])[0],
  );
  const pactSrc = readFileSync("src/core/pact.js", "utf8");
  check(
    "core/pact.js is untouched — PACT_NAME still LAST, and no fifth bit",
    /PACT_NAME=Object\.freeze\(\["LAST","BARE","THIN","SHRINK"\]\)/.test(
      pactSrc.replace(/\s/g, ""),
    ) && /\(p\|0\)&15/.test(pactSrc.replace(/\s/g, "")),
  );
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/menu-level.test.mjs tests/menudraw.test.mjs tests/times.test.mjs
```

Expected: FAIL — `menu-level.test.mjs` reports
`locked Digit5 is a no-op -> undefined`; `menudraw.test.mjs` reports the
unlocked rail still rendering `1 LAST` and no `5 TIME`; `times.test.mjs`
reports empty matches for the four wiring checks.

- [ ] **Step 3: Implement**

**3a — `src/render/menudraw.js`.** `PACT_NAME` becomes unused once the rail
relabels, so narrow the import (`:12`):

```js
import { PACT, PACT_COL } from "../core/pact.js";
```

Add beside the other module-local tables (near `PLAQUE_NAME`'s precedent, or
directly above `drawLevelSelect`):

```js
/* MODES is a PRESENTATION relabel of the four Pact bits, so these names live
   here and core/pact.js keeps PACT_NAME ["LAST",...] and pactLabel's L/B/T/S —
   the HIGH SCORES p column and every pact.js pin depend on them. Same
   render-side duplication precedent as PLAQUE_NAME. IRON is a display name for
   PACT.LAST (applyPact sets lives = 1); BARE is PACT.BARE verbatim.
   TIME_COL is deliberately OUTSIDE PACT_COL so the fifth chip cannot read as a
   fifth Pact bit — that plus the 16px double gap are the two devices that
   enforce it. #ff8a3c is already the palette's FLAME colour. */
const MODE_NAME = ["IRON", "BARE", "THIN", "SHRINK"];
const TIME_COL = "#ff8a3c";
```

Signature and head subtitle:

```js
export function drawLevelSelect(c, sel, L, t, heat, pact, unlocked, pace, timeAttack) {
```
```js
  head(c, S, "SELECT LEVEL", showPact ? "ROOM + HEAT + PACE + MODES" : "ROOM + HEAT + PACE");
```

Replace the whole `if (showPact) { … }` rail block with:

```js
  if (showPact) {
    const bits = [PACT.LAST, PACT.BARE, PACT.THIN, PACT.SHRINK];
    const pw = 64,
      pg = 6,
      pgap = 16,
      ptot = 5 * pw + 3 * pg + pgap,
      px0 = S.mid - ptot / 2,
      py = pzy + 34;
    const mask = pact | 0;
    for (let i = 0; i < 4; i++) {
      const x = px0 + i * (pw + pg),
        on = (mask & bits[i]) !== 0,
        col = PACT_COL[i];
      if (on) {
        c.fillStyle = "rgba(55,240,208,0.12)";
        c.fillRect(x, py, pw, 22);
      }
      c.strokeStyle = on ? col : LINE;
      c.lineWidth = on ? 2 : 1;
      c.strokeRect(x + 0.5, py + 0.5, pw - 1, 21);
      c.fillStyle = on ? col : MUTED;
      c.font = font(10, on ? "900" : "");
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(i + 1 + " " + MODE_NAME[i], x + pw / 2, py + 11);
    }
    const tx = px0 + 4 * pw + 3 * pg + pgap,
      ton = !!timeAttack;
    if (ton) {
      c.fillStyle = "rgba(55,240,208,0.12)";
      c.fillRect(tx, py, pw, 22);
    }
    c.strokeStyle = ton ? TIME_COL : LINE;
    c.lineWidth = ton ? 2 : 1;
    c.strokeRect(tx + 0.5, py + 0.5, pw - 1, 21);
    c.fillStyle = ton ? TIME_COL : MUTED;
    c.font = font(10, ton ? "900" : "");
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("5 TIME", tx + pw / 2, py + 11);
    c.fillStyle = MUTED;
    c.font = font(9, "");
    c.fillText("5 TIME ATTACK · stopwatch + per-room best", S.mid, py + 30);
  }
```

The rail is `5*64 + 3*6 + 16 = 354` wide against an inner width of 368 at both
pinned plate sizes. Vertically the rail sits at the existing `py = pzy + 34`
with the gloss at `py + 30`: 347 / 377 against `S.footY` 476 at 600×520, and
249 / 279 against `S.footY` 308 at 608×352.

Foot (`showPact` branch only):

```js
      ? "ENTER START · ←/→ ROOM · ↑/↓ HEAT · [ ] PACE · 1–5 MODES · ESC"
```

**3b — `src/app/menuapp.js`.** In the app literal, beside `pact` / `pace`:

```js
    timeAttack: !!o.timeAttack,
```

Beside `togglePactBit` (`:516-521`), the same shape verbatim:

```js
    /* TIME ATTACK is a DISPLAY toggle: it gates the stopwatch chip and the
       CLEARED time line and nothing else. It is deliberately absent from
       startRun's args — it never reaches onStart, world or step(). */
    toggleTimeAttack() {
      this.idleT = 0;
      if (this.screen !== SCREEN.LEVEL || !this.pactUnlocked) return false;
      this.timeAttack = !this.timeAttack;
      if (o.onTimeAttack) o.onTimeAttack(this.timeAttack);
      return true;
    },
```

In `key()`, directly after the `Digit4` / `Numpad4` case:

```js
        case "Digit5":
        case "Numpad5":
          return this.toggleTimeAttack();
```

`startRun()` is **not** touched.

**3c — `src/render/shellview.js`.** Add the ninth argument to the
`drawLevelSelect` call:

```js
      app.pace,
      app.timeAttack,
    );
```

**3d — `src/main.js`.** In the `createMenuApp` options, beside `pace` /
`onPaceChange` (`:194-196`):

```js
    timeAttack: loadTimes().on === 1,
    onTimeAttack: (on) => saveTimes({ ...loadTimes(), on: on ? 1 : 0 }),
```

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test
```

Expected: all green.

- [ ] **Step 5: Headed play-verify** (AGENTS.md: "Visual 3D feel is not covered
by Node")

Unregister the service worker and delete its caches first. Then on
`http://127.0.0.1:8080/index.html`:

1. **Locked LEVEL SELECT** (fresh profile, before any FUSE/GRID CLEAR): the
   rail is absent and the head/foot read exactly as before.
2. **Unlocked LEVEL SELECT, both plate sizes** (CLASSIC 2D at 600×520 and
   `?render=3d` at 608×352): the five chips fit, the fifth is visibly separated
   by its double gap, `5 TIME` is orange and reads as a mode rather than a
   fifth Pact bit, and the gloss line sits clear of the foot.
3. **`5` toggles**, `1`–`4` still toggle their own bits, and the toggle survives
   a reload.
4. **HUD row with the stopwatch on, at a six-digit score** (the §3.3 overlap
   check): confirm the TIME chip's right edge stays clear of the score column
   in both 2D and REAL 3D. **If it overlaps, narrow ENEMIES further — never
   move the right-aligned score column.**
5. **Clear a room twice.** First clear reads `NEW BEST`; a slower second clear
   reads `BEST <the first time>`, not its own.
6. **TIME ATTACK off:** the HUD row and the CLEARED overlay are exactly as
   before, and a clear still records (turn the toggle back on and re-clear to
   see the best it wrote).

- [ ] **Step 6: PWA bump, MEMORY, commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together,
`current vN → vN+1`. Append to `MEMORY.md` under a new
`## 2026-09-06 — R7 stopwatch + MODES` heading (newest first, 1–2 lines): that
every room clear now records a time under `nb.times.v1` keyed on room/heat/pact/
pace, shown as a HUD stopwatch chip and a `ROOM n · m:ss.t · BEST/NEW BEST` line
when TIME ATTACK is on; and that MODES is a **relabel of the existing LEVEL
SELECT Pact rail** with a separated fifth chip on `5` — no MODES screen, no new
`SCREEN`, no new `PACT` bit, and `core/pact.js` untouched, because report §7.2's
new-`SCREEN` question is still the owner's to answer.

```bash
git add src/render/menudraw.js src/app/menuapp.js src/render/shellview.js src/main.js tests/menudraw.test.mjs tests/menu-level.test.mjs tests/times.test.mjs MEMORY.md src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Relabel the LEVEL SELECT Pact rail as MODES and add TIME ATTACK on 5.

The real gap was discoverability for players who never find the 1-4 toggles, so
MODES is a presentation change on the screen they already opened to pick a
room — not a page one hop deeper, and not a new SCREEN, which would settle an
open owner question on the cheapest item in the wave. core/pact.js is
untouched: IRON is a display name for PACT.LAST. The fifth chip is separated by
a double gap and coloured outside PACT_COL so it cannot read as a fifth Pact
bit, and it never reaches startRun's args.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```
