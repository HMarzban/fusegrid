# R5 — Opt-in STATS screen over `nb.stats.v1` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A **STATS** row under HIGH SCORES opens a real plate — nine lifetime
counters and per-heat bests, two note lines, and `C COPY MY STATS` writing four
plain-text lines to the clipboard. Aggregates are recorded from the first run,
unconditionally; the 200-entry event ring fills only after the player has opened
STATS once. Nothing leaves the device except through that one keypress.

**Architecture:** One new module (`src/app/stats.js`, key `nb.stats.v1`) holding
**only what no other key holds** — counters, session dates and the ring. Bests
come from `loadBests()` (R1) and best times from `loadTimes()` (R7): STATS
**reads** the other stores and never copies them, because a second copy of a
best is a second thing to keep in sync and a second thing that can disagree with
the overlay. The tap is R1's `feedTally`, **extended in place** with three maps
filled in the loop it already runs, so R5 adds **zero** new per-frame passes over
`world.events`. `stat(ev, data, today, store)` is the single edge function — one
read-modify-write of one key, the same shape `saveTimes(recordTime(loadTimes(), …))`
already performs on every room WIN. The screen is `SCREEN.STATS = 12`,
**appended** after `GUIDE: 11` (`menuapp.js:27`'s own rule), drawn by
`drawStats` on the `drawScores` scaffold, fed through `app.stats` so
`drawShell`'s argument list does not move.

**This plan owns stage 1 of the menu-cursor renegotiation.** `STATS` is inserted
**directly before `SOURCE`**, so `ITEMS[0..4]` do not move and
`tests/headless.test.mjs`'s five index-driven MENU confirms stay green with no
edit. R3 owns stage 2, where `DAILY` at `[2]` does move them.

**Tech Stack:** Pure ES modules, `node --test` / `tests/*.test.mjs`, Canvas 2D
plus vendored three.js r160. Zero npm runtime deps. `menudraw.js` must not
import from `src/app/`; `shellview.js` is the only render module that may.

**Spec:** `docs/superpowers/specs/2026-09-07-retention-wave2-design.md` §1.4, §3

**Index:** `docs/superpowers/plans/2026-09-07-retention-wave2.md` — its
**Shared interfaces** block is authoritative for every signature below.

**Depends on:** R1 (`docs/superpowers/plans/2026-09-07-run-summary.md`). R5
extends `newTally`/`feedTally` **in place** and reads `bestOfRun`/`loadBests`,
so R1's module must exist first. **Consequence: R1 has already moved
`src/main.js` past 732 lines and the `main.js` line pin past 733 — read both
before editing, and locate `main.js` edits by string, never by line number.**

## Global Constraints

- **Aggregates are recorded from the first run, unconditionally. The event ring
  fills only after the player opens STATS once.** This is an argument, not a
  preference: `nb.highscores.v1`, `nb.times.v1`, `nb.plaques.v1`, `nb.pact.v1`
  and `nb.cabinet.v1` all record unconditionally today, all are local, and none
  ever leaves the device on its own — a counter that asked permission while
  those five did not would be theatre. And **every retention signal the report
  names is an aggregate**. The ring is the fine-grained, ordered record — the
  only part that *reads* like telemetry — and it exists to answer "what did I
  do", a question only a player who has opened STATS has asked.
- **The single export channel stays explicit**: `C` on the STATS screen, once,
  per press. No auto-send, no beacon, no accumulation of an "unsent" buffer.
- **No duplicate stores.** `nb.stats.v1` holds counters, session dates and the
  ring. Bests-per-heat come from `loadBests()`, best times from `loadTimes()`.
- **`feedTally` is extended, not duplicated.** `newTally()` gains `kt`/`pk`/`dr`
  and `feedTally` fills them **in the loop it already runs**. A second pass over
  `world.events` is refused.
- **Every date in the blob is a string, never epoch ms.** `main.js` computes a
  date anyway, a ms field needs a formatter to be read, and the promise that the
  player sees the same local data the team would reason from is only literally
  true if the blob is readable in DevTools.
- **`score_set` is gated on the already-shipped `qualifies`**
  (`highscores.js:99-101`). `recordScore` slices to 10 (`:68-77`), so "a score
  was persisted" is **not** "a row landed", and an ungated event would
  over-report by exactly the runs that fell off the list.
- **`savePlaques(unlockPlaques(loadPlaques(), world))` stays byte-identical.**
  `tests/menudraw.test.mjs:830-836` regexes that exact literal inside the
  finale block and pins `unlockPlaques(` to **one** occurrence. The
  `plaque_unlock` events are derived by reading the mask before and after that
  untouched call — never by restructuring it.
- **`SCREEN.STATS = 12` is appended, never inserted.** `menuapp.js:27` says so
  in its own words and `tests/menuapp.test.mjs:67-74` pins the appended values.
- **`drawShell`'s argument list does not change.** The rows and notes ride
  `app.stats`, a snapshot `main.js` writes in `onStats` — STATS is a static
  screen and nothing changes while the player looks at it.
- **`menudraw.js` must not import from `src/app/`.** `drawStats(c, L, t, ui)`
  receives `{rows, notes}` already computed, the same getter discipline scores
  and plaques already use.
- **No JSON anywhere on screen.** The named failure mode for this feature is
  "under-designed, it reads as a debug tool"; the mitigations are structural — a
  real plate, right-aligned values, the lifetime/bests rule.
- **`coach_shown` / `coach_dismissed` are in `EVENTS` and handled by `stat()`,
  but `main.js` does not emit them until R10.** The store's contract is ten
  kinds and is pinned as ten; the two coach emit sites live in R10's task 3,
  beside the latch that knows when a tip opened and why it closed.
- **`main.js`'s line pin rises to 776 exactly once**, in **Task 2** — this
  plan's first `main.js`-touching task. Additions total **+16** over R1's 760.
  If your implementation lands above 776, move the excess into
  `src/app/stats.js` — **never raise the pin**.
- **`src/pwa/shell.js`'s `SRC` entry for `src/app/stats.js` is mandatory.**
- PWA: bump `CACHE_NAME` + `sw.js:3` `REV` **together**, `current vN → vN+1`, in
  **every** commit here. **Read the current value first** — R1 has already moved
  it past `v116`.
- **Locate every edit by string, never by line number.** R1 has already moved
  `src/main.js` and `tests/headless.test.mjs`, and `tests/menudraw.test.mjs`
  settled only in `93bb836` — re-read both before editing.
- Comments only where the file already uses them.
- Never write the private reference game's name, or the word `leaderboard`, into
  any committed file.

---

### Task 1: `src/app/stats.js` — the store, the ten edges, and the extended tap

**Files:**
- Create: `src/app/stats.js`
- Create: `tests/stats.test.mjs`
- Modify: `src/app/bests.js` — `newTally` gains `kt`/`pk`/`dr`; `feedTally`
  fills them in the loop it already runs
- Modify: `tests/bests.test.mjs` — the `newTally` shape pin gains the three maps
- Modify: `src/pwa/shell.js` — `SRC` gains `"src/app/stats.js"` (after
  `"src/app/settings.js"`), and `:1` `CACHE_NAME`
- Modify: `sw.js:3`

**Interfaces:**
- Consumes: `FOES`, `POWER` (`core/entities.js`), `defaultStore`
  (`app/store.js`)
- Produces: `STATS_KEY`, `RING_MAX`, `EVENTS`, `clampStats`, `loadStats`,
  `saveStats`, `stat`, `setStatsOn`, `statPlaques`, `fmtLong`

- [ ] **Step 1: Write the failing tests** — create `tests/stats.test.mjs`

```js
import {
  STATS_KEY,
  RING_MAX,
  EVENTS,
  clampStats,
  loadStats,
  saveStats,
  stat,
  setStatsOn,
  fmtLong,
} from "../src/app/stats.js";
import { newTally, feedTally } from "../src/app/bests.js";

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
const TODAY = "2026-09-07";

// ---- 1. clampStats: the whitelist gate on every load and every save ----
{
  check("STATS_KEY is nb.stats.v1", STATS_KEY === "nb.stats.v1", STATS_KEY);
  check("RING_MAX is 200", RING_MAX === 200, RING_MAX);
  /* run_end is the TENTH kind and the one the report's own list does not carry:
     the arcade reset makes the RUN the unit every aggregate counts, and a run
     can end without a death (pause -> QUIT TO MENU / RESTART). */
  check(
    "EVENTS is ten kinds and includes run_end",
    EVENTS.length === 10 && EVENTS.includes("run_end"),
    EVENTS.join(","),
  );
  const c = clampStats({
    on: 3,
    a: { runs: 5, rooms: 2.5, deaths: "9", kills: 40, first: "nope", last: TODAY },
    d: { 3: 2, 9: 7, x: 1 },
    k: { walker: 4, nosuchfoe: 9 },
    p: { kick: 2, nosuchpower: 9 },
    e: [{ t: "death", y: TODAY }, { t: "not_a_kind", y: TODAY }],
  });
  check("clampStats forces on through the bit() shape", c.on === 1, c.on);
  check(
    "clampStats keeps the finite integers and zeroes the rest",
    c.a.runs === 5 && c.a.rooms === 0 && c.a.deaths === 0 && c.a.kills === 40,
    JSON.stringify(c.a),
  );
  check(
    "clampStats drops a malformed date and keeps a well-formed one",
    c.a.first === "" && c.a.last === TODAY,
    c.a.first + " / " + c.a.last,
  );
  check(
    "clampStats whitelists d by room, k by FOES.t and p by POWER.t",
    JSON.stringify(c.d) === '{"3":2}' &&
      JSON.stringify(c.k) === '{"walker":4}' &&
      JSON.stringify(c.p) === '{"kick":2}',
    JSON.stringify([c.d, c.k, c.p]),
  );
  check(
    "clampStats drops a ring entry whose kind is not in EVENTS",
    c.e.length === 1 && c.e[0].t === "death",
    JSON.stringify(c.e),
  );
  check(
    "clampStats: junk in, a fresh empty shape out, never a throw",
    clampStats(null).a.runs === 0 &&
      clampStats(7).e.length === 0 &&
      clampStats({ a: 5, e: 5 }).on === 0,
  );
}

// ---- 2. session_start ----
{
  const st = mapStore();
  stat("session_start", null, TODAY, st);
  let v = loadStats(st);
  check(
    "session_start counts a session and seeds first/last",
    v.a.sessions === 1 && v.a.first === TODAY && v.a.last === TODAY,
    JSON.stringify(v.a),
  );
  stat("session_start", null, "2026-09-09", st);
  v = loadStats(st);
  check(
    "a later session moves last and leaves first alone",
    v.a.sessions === 2 && v.a.first === TODAY && v.a.last === "2026-09-09",
    JSON.stringify(v.a),
  );
}

// ---- 3. run_end sums and merges; death bumps the per-room map ----
{
  const st = mapStore();
  stat("run_end", { r: 4, s: 1840, k: 27, p: 9, b: 61, secs: 761,
    kt: { walker: 20, fast: 7 }, pk: { kick: 3, fire: 6 } }, TODAY, st);
  stat("run_end", { r: 2, s: 300, k: 3, p: 1, b: 5, secs: 90,
    kt: { walker: 3 }, pk: { fire: 1 } }, TODAY, st);
  const v = loadStats(st);
  check(
    "run_end sums runs/kills/picks/bricks/secs",
    v.a.runs === 2 && v.a.kills === 30 && v.a.picks === 10 &&
      v.a.bricks === 66 && v.a.secs === 851,
    JSON.stringify(v.a),
  );
  check(
    "run_end merges the per-type maps rather than replacing them",
    v.k.walker === 23 && v.k.fast === 7 && v.p.kick === 3 && v.p.fire === 7,
    JSON.stringify([v.k, v.p]),
  );
  stat("death", { r: 3 }, TODAY, st);
  stat("death", { r: 3 }, TODAY, st);
  stat("death", { r: 1 }, TODAY, st);
  const w = loadStats(st);
  check(
    "death bumps deaths and d[room]",
    w.a.deaths === 3 && w.d["3"] === 2 && w.d["1"] === 1,
    JSON.stringify([w.a.deaths, w.d]),
  );
  stat("room_clear", { r: 2 }, TODAY, st);
  check("room_clear bumps rooms", loadStats(st).a.rooms === 1);
}

// ---- 4. the opt-in split: aggregates ALWAYS, the ring only after STATS opens ----
{
  const st = mapStore();
  for (let i = 0; i < 10; i++) stat("death", { r: 2 }, TODAY, st);
  let v = loadStats(st);
  check(
    "with on:0 every aggregate moves and the ring stays empty",
    v.a.deaths === 10 && v.d["2"] === 10 && v.e.length === 0 && v.on === 0,
    JSON.stringify({ deaths: v.a.deaths, e: v.e.length, on: v.on }),
  );
  setStatsOn(st);
  check("setStatsOn flips on to 1 and nothing else", loadStats(st).on === 1);
  stat("death", { r: 2 }, TODAY, st);
  v = loadStats(st);
  check(
    "the next event appends exactly one ring entry",
    v.e.length === 1 && v.e[0].t === "death" && v.e[0].y === TODAY && v.e[0].r === 2,
    JSON.stringify(v.e),
  );
  check(
    "no ring entry carries a clock-shaped value — dates are strings, never epoch ms",
    Object.values(v.e[0]).every((x) => typeof x !== "number" || x < 100000),
    JSON.stringify(v.e[0]),
  );
}

// ---- 5. the ring caps at 200, newest last ----
{
  const st = mapStore();
  setStatsOn(st);
  for (let i = 0; i < 250; i++) stat("room_clear", { r: 1 + (i % 8) }, TODAY, st);
  const v = loadStats(st);
  check(
    "250 appends leave exactly 200 entries",
    v.e.length === RING_MAX,
    String(v.e.length),
  );
  check(
    "the NEWEST entry is last — the oldest is what gets dropped",
    v.e[v.e.length - 1].r === 1 + (249 % 8),
    JSON.stringify(v.e[v.e.length - 1]),
  );
  check("and every aggregate still counted all 250", v.a.rooms === 250, v.a.rooms);
}

// ---- 6. fmtLong: the lifetime range, disjoint from fmtSpan and fmtTime ----
{
  const want = [
    [0, "0h 00m"],
    [3599, "0h 59m"],
    [3600, "1h 00m"],
    [50820, "14h 07m"],
    [1e9, "999h 59m"],
    [-5, "0h 00m"],
  ];
  const bad = want.filter(([n, s]) => fmtLong(n) !== s);
  check(
    "fmtLong: hours + zero-padded minutes, clamped to 999h 59m",
    !bad.length,
    JSON.stringify(bad.map(([n]) => [n, fmtLong(n)])),
  );
  check("fmtLong never throws", fmtLong(undefined) === "0h 00m" && fmtLong(NaN) === "0h 00m");
}

// ---- 7. load/save round-trip and a hostile store ----
{
  const st = mapStore();
  saveStats({ on: 1, a: { runs: 3 }, d: {}, k: {}, p: {}, e: [] }, st);
  check("loadStats/saveStats round-trip", loadStats(st).a.runs === 3);
  const bad = mapStore();
  bad.setItem(STATS_KEY, "{not json");
  check("a corrupt blob degrades to the default, never throws", loadStats(bad).a.runs === 0);
  let threw = false;
  try {
    const hostile = { getItem() { throw new Error("nope"); }, setItem() { throw new Error("nope"); } };
    loadStats(hostile);
    saveStats({}, hostile);
    stat("death", { r: 1 }, TODAY, hostile);
    setStatsOn(hostile);
  } catch (_) {
    threw = true;
  }
  check("nothing in stats.js throws on a hostile store", !threw);
  check(
    "an unknown event kind is a silent no-op, never a write of garbage",
    (() => {
      const s = mapStore();
      stat("not_a_kind", { r: 1 }, TODAY, s);
      return loadStats(s).a.runs === 0 && loadStats(s).e.length === 0;
    })(),
  );
}

// ---- 8. feedTally is EXTENDED, not duplicated: R5 adds no second pass ----
{
  const t = newTally();
  check(
    "newTally now carries kt/pk/dr beside R1's seven fields",
    Object.keys(t).sort().join(",") === "b,d,dNew,dr,k,kt,lv,p,pk,r",
    JSON.stringify(Object.keys(t)),
  );
  const w = {
    lives: 3,
    level: 4,
    events: [
      { t: "kill", type: "walker" },
      { t: "kill", type: "walker" },
      { t: "kill", type: "rocket" },
      { t: "power", kind: "kick" },
      { t: "power", kind: "fire" },
    ],
  };
  feedTally(t, w);
  check(
    "kills and pickups are bucketed by type in the SAME loop that counts them",
    t.k === 3 && t.kt.walker === 2 && t.kt.rocket === 1 &&
      t.p === 2 && t.pk.kick === 1 && t.pk.fire === 1,
    JSON.stringify([t.kt, t.pk]),
  );
  w.events = [];
  w.lives = 2;
  feedTally(t, w);
  check(
    "a death is bucketed by the room it happened in",
    t.d === 1 && t.dr["4"] === 1,
    JSON.stringify(t.dr),
  );
  const src = readFileSync("src/app/bests.js", "utf8");
  check(
    "feedTally still runs exactly ONE loop over world.events",
    (src.match(/for \(let i = 0; i < ev\.length; i\+\+\)/g) || []).length === 1,
    String((src.match(/ev\.length/g) || []).length),
  );
}

console.log("\n  STATS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
```

Add `import { readFileSync } from "node:fs";` to the file's imports (block 8
reads `bests.js`).

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/stats.test.mjs tests/pwa.test.mjs
```

Expected: FAIL — `stats.test.mjs` reports
`Cannot find module '.../src/app/stats.js'`.

- [ ] **Step 3: Implement**

**3a — extend the tap in `src/app/bests.js`.** `newTally` gains three maps and
`feedTally` fills them inside the loop it already runs:

```js
/* R5 extends this shape in place — kt/pk/dr are filled in the SAME loop, so the
   stats screen adds zero new passes over world.events. */
export function newTally() {
  return { r: 0, k: 0, p: 0, b: 0, d: 0, dNew: 0, lv: null, kt: {}, pk: {}, dr: {} };
}
```
```js
    if (e.t === "kill") { t.k++; if (e.type) t.kt[e.type] = (t.kt[e.type] | 0) + 1; }
    else if (e.t === "power") { t.p++; if (e.kind) t.pk[e.kind] = (t.pk[e.kind] | 0) + 1; }
```
and, in the death branch:
```js
    t.d += n;
    t.dNew = n;
    const rm = w.level | 0;
    t.dr[rm] = (t.dr[rm] | 0) + n;
```

Update the `newTally` shape pin in `tests/bests.test.mjs` (block 5) to the ten
keys — it is the same assertion, one stage later:

```js
    Object.keys(t).sort().join(",") === "b,d,dNew,dr,k,kt,lv,p,pk,r" &&
```

**3b — create `src/app/stats.js`:**

```js
import { FOES, POWER } from "../core/entities.js";
import { defaultStore } from "./store.js";

export const STATS_KEY = "nb.stats.v1";
export const RING_MAX = 200;
/* run_end is the TENTH kind. The arcade reset makes the RUN the unit every
   aggregate counts, and a run can end without a death (pause -> QUIT TO MENU /
   RESTART), so "deaths" alone would undercount runs by exactly the quits. */
export const EVENTS = Object.freeze([
  "session_start", "room_enter", "room_clear", "death", "win_finale",
  "run_end", "score_set", "plaque_unlock", "coach_shown", "coach_dismissed",
]);
/* Aggregates record unconditionally — five nb.* keys already do, all local,
   none of them leaving the device on its own. The RING is the fine-grained,
   ordered record, and it exists to answer "what did I do" — a question only a
   player who has opened STATS has asked. Nothing here ever leaves the device
   except through the explicit C keypress on the STATS screen.
   Every date is a STRING: main.js computes one anyway, a ms field would need a
   formatter to be read, and the blob has to be readable in DevTools. */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FOE_T = new Set(FOES.map((f) => f.t));
const POW_T = new Set(POWER.map((x) => x.t));
const KIND = new Set(EVENTS);
const A_KEYS = ["runs", "rooms", "deaths", "kills", "picks", "bricks", "secs", "sessions"];

const bit = (v) => {
  if (v === undefined || v === null) return 0;
  if (typeof v === "number") return isFinite(v) && v ? 1 : 0;
  return v ? 1 : 0;
};
const cnt = (v) =>
  typeof v === "number" && isFinite(v) && (v | 0) === v && v >= 0 && v <= 1e9 ? v : 0;
const dat = (v) => (typeof v === "string" && DATE_RE.test(v) ? v : "");
const pad2 = (n) => (n < 10 ? "0" + n : String(n));

function mapOf(src, ok) {
  const out = {};
  if (!src || typeof src !== "object") return out;
  for (const k of Object.keys(src)) if (ok(k) && cnt(src[k])) out[k] = src[k];
  return out;
}

export function clampStats(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const ai = o.a && typeof o.a === "object" ? o.a : {};
  const a = { first: dat(ai.first), last: dat(ai.last) };
  for (const k of A_KEYS) a[k] = cnt(ai[k]);
  const e0 = Array.isArray(o.e) ? o.e.filter((x) => x && KIND.has(x.t)) : [];
  return {
    on: bit(o.on),
    a,
    d: mapOf(o.d, (k) => /^[1-8]$/.test(k)),
    k: mapOf(o.k, (k) => FOE_T.has(k)),
    p: mapOf(o.p, (k) => POW_T.has(k)),
    e: e0.length > RING_MAX ? e0.slice(e0.length - RING_MAX) : e0,
  };
}

export function loadStats(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.getItem !== "function") return clampStats(null);
    const raw = st.getItem(STATS_KEY);
    if (raw === null) return clampStats(null);
    return clampStats(JSON.parse(raw));
  } catch (_) {
    return clampStats(null);
  }
}

export function saveStats(v, store) {
  try {
    const st = store || defaultStore();
    if (st && typeof st.setItem === "function")
      st.setItem(STATS_KEY, JSON.stringify(clampStats(v)));
  } catch (_) {}
}

export function setStatsOn(store) {
  const v = loadStats(store);
  v.on = 1;
  saveStats(v, store);
  return v;
}

const bump = (m, k, n) => {
  if (k === undefined || k === null) return;
  m[k] = (m[k] | 0) + (n | 0);
};

/* One read-modify-write of one key, the same shape saveTimes(recordTime(...))
   already performs on every room WIN. The aggregate effect applies ALWAYS; the
   ring entry is appended only while on===1. */
export function stat(ev, data, today, store) {
  if (!KIND.has(ev)) return null;
  const d = data || {};
  const y = dat(today);
  const v = loadStats(store);
  const a = v.a;
  if (ev === "session_start") {
    a.sessions++;
    if (!a.first) a.first = y;
    a.last = y;
  } else if (ev === "room_enter") {
    a.last = y;
  } else if (ev === "room_clear") {
    a.rooms++;
  } else if (ev === "death") {
    a.deaths++;
    bump(v.d, d.r | 0, 1);
  } else if (ev === "run_end") {
    a.runs++;
    a.kills += cnt(d.k);
    a.picks += cnt(d.p);
    a.bricks += cnt(d.b);
    a.secs += cnt(d.secs);
    a.last = y;
    for (const k of Object.keys(d.kt || {})) bump(v.k, k, d.kt[k]);
    for (const k of Object.keys(d.pk || {})) bump(v.p, k, d.pk[k]);
  }
  if (v.on === 1) {
    const row = { t: ev, y };
    for (const f of ["r", "s", "h", "b", "v", "rn", "pc", "pa"])
      if (d[f] !== undefined) row[f] = d[f];
    v.e.push(row);
  }
  saveStats(v, store);
  return v;
}

/* One plaque_unlock per NEWLY-set bit. Lives here rather than in main.js so the
   shipped savePlaques(unlockPlaques(loadPlaques(), world)) literal — pinned in
   tests/menudraw.test.mjs — is read around, never restructured. */
export function statPlaques(prev, next, today, store) {
  for (let i = 0; i < 4; i++)
    if (!((prev | 0) & (1 << i)) && (next | 0) & (1 << i))
      stat("plaque_unlock", { b: i }, today, store);
}

/* The THIRD formatter of this wave, and the reason there are three: fmtTime
   (scenes.js) pins a run at 9:59.9 because its six-character guarantee holds
   the HUD chip's width budget; fmtSpan pins at 99:59, which a run never
   reaches; a lifetime crosses 99:59 after 100 minutes and would pin forever. */
export function fmtLong(sec) {
  const n = typeof sec === "number" && isFinite(sec) ? sec : 0;
  const s = Math.floor(Math.min(3599999, Math.max(0, n)));
  return Math.floor(s / 3600) + "h " + pad2(Math.floor(s / 60) % 60) + "m";
}
```

Delete the placeholder `MONO` line above before committing — it is not used;
it is listed here only so a reviewer notices its absence is deliberate. **Do not
ship an unused constant.**

Then add `"src/app/stats.js"` to `SRC` in `src/pwa/shell.js`, immediately after
`"src/app/settings.js"`.

`fmtT` below is the payload's one tenths formatter. `src/app/` may not import
`src/render/`, so `fmtTime` cannot be reused; this is the same clamp-and-floor
arithmetic over the integer tenths `times.js` already stores, and block 11's
`0:38.9` assertion is what keeps the two from drifting:

```js
const fmtT = (sec) => {
  const d = Math.round(Math.min(5999, Math.max(0, sec)) * 10);
  return Math.floor(d / 600) + ":" + pad2(Math.floor(d / 10) % 60) + "." + (d % 10);
};
```

- [ ] **Step 4: Run to PASS**

```bash
node --test tests/stats.test.mjs tests/bests.test.mjs tests/pwa.test.mjs
```

Expected: green, including `PRECACHE has ./src/app/stats.js` and R1's own
`bests.test.mjs` with the widened `newTally` shape pin.

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together.

```bash
git add src/app/stats.js src/app/bests.js tests/stats.test.mjs tests/bests.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Add src/app/stats.js: lifetime aggregates always, the event ring on opt-in.

Five nb.* keys already record unconditionally, all local, none of them leaving
the device on its own, so a counter that asked permission while those five did
not would be theatre — and every retention signal worth having is an aggregate.
The ring is the part that reads like telemetry, so it fills only after the
player has opened STATS once. run_end is a tenth event kind because the arcade
reset makes the run the unit, and a run can end by quitting rather than dying.
Every date is a string, so the blob is readable where it lives. feedTally is
extended in place rather than duplicated: the three per-type maps are filled in
the loop that already counts, so the screen costs no new pass over the events.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: the menu IA — `SCREEN.STATS = 12` and cursor renegotiation **stage 1**

**Files:**
- Modify: `src/app/menuapp.js` — `SCREEN` gains `STATS: 12` (appended after
  `GUIDE: 11`, `:28`); `ITEMS` gains `"STATS"` **before** `"SOURCE"` (`:30-37`);
  `confirm()`'s MENU switch gains a `STATS` case (`:277-294`); `confirm()`'s
  back-out list gains `SCREEN.STATS` (`:311-315`); `back()`'s MENU list gains
  `SCREEN.STATS` (`:326-332`)
- Modify: `src/render/shellview.js` — the MENU `items:` literal grows to seven
  (`:80-87`)
- Modify: `src/main.js` — the audio `confirm` wrapper's back-out exclusion list
  gains `SCREEN.STATS` (`:275-282`), so a STATS confirm cues `uiBack` alone
  exactly as a SCORES confirm does
- Modify: `tests/menuapp.test.mjs` (**stage 1**: `:57-66`, `:324-329`, `:347-352`)
- Modify: `tests/menudraw.test.mjs` (**re-read first — locate by string**;
  `:105-121` and `:262-280`, both to seven entries)
- Modify: `tests/headless.test.mjs` — the `main.js` line pin (`:909`) and its
  reason comment
- Modify: `tests/stats.test.mjs` — append block 9
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: nothing new
- Produces: `SCREEN.STATS === 12`, `ITEMS` at seven rows, `o.onStats`

**Stage 1, stated explicitly:** `STATS` goes **directly before `SOURCE`**, so the
new order is `PLAY(0) LEVEL SELECT(1) OPTIONS(2) GUIDE(3) HIGH SCORES(4)
STATS(5) SOURCE(6)`. Indices `[0..4]` do **not** move, which is why
`tests/headless.test.mjs:185,196,212,269,279` — five index-driven MENU confirms
(`cursor=2` → OPTIONS, `cursor=3` → GUIDE) — stay green with **no edit at this
stage**. R3's stage 2 inserts `DAILY` at `[2]` and *does* move them; that
renegotiation belongs to R3 and must not be pre-applied here.

- [ ] **Step 1: Write the failing tests**

In `tests/menuapp.test.mjs`, update the three stage-owned literals (locate by
string):

```js
check(
  "ITEMS frozen, 7 entries",
  Object.isFrozen(ITEMS) &&
    ITEMS.length === 7 &&
    ITEMS[0] === "PLAY" &&
    ITEMS[2] === "OPTIONS" &&
    ITEMS[3] === "GUIDE" &&
    ITEMS[5] === "STATS" &&
    ITEMS[6] === "SOURCE",
  JSON.stringify(ITEMS),
);
check(
  "SETTINGS appended at 10, GUIDE at 11, STATS at 12 — never inserted",
  SCREEN.SETTINGS === 10 &&
    SCREEN.GUIDE === 11 &&
    SCREEN.STATS === 12 &&
    SCREEN.ENEMIES === 9 &&
    SCREEN.ITEMS === 8,
  JSON.stringify(SCREEN),
);
```

the dispatch table gains one row (the four existing rows are **unmoved**):

```js
  for (const [cur, screen] of [
    [1, SCREEN.LEVEL],
    [2, SCREEN.SETTINGS],
    [3, SCREEN.GUIDE],
    [4, SCREEN.SCORES],
    [5, SCREEN.STATS],
  ]) {
```

and the SOURCE row moves from cursor 5 to cursor 6:

```js
  s.cursor = 6;
  s.confirm();
  check(
    "cursor 6 SOURCE -> onSource(), screen stays MENU",
    srcHits === 1 && s.screen === SCREEN.MENU,
    srcHits + "/" + s.screen,
  );
```

In `tests/menudraw.test.mjs` (**re-read it first**), both items literals grow to
seven: add `ITEMS[6],` after `ITEMS[5],` in the `:105-121` block, and `"STATS",`
before `"SOURCE",` in the `:262-280` block. `:185`'s deliberate three-row literal
is **unmoved** — it exists to prove `drawMenu` is generic.

In `tests/stats.test.mjs`, append:

```js
import { SCREEN, ITEMS, createMenuApp } from "../src/app/menuapp.js";

// ---- 9. the screen, the row, and the one-shot opt-in ----
{
  check("SCREEN.STATS is 12, appended after GUIDE", SCREEN.STATS === 12, SCREEN.STATS);
  /* Written structurally rather than as an index literal so it survives R3's
     stage-2 insert: SOURCE is always last because it is the one row that leaves
     the page, and STATS always sits directly above it. */
  check(
    "STATS sits directly above SOURCE, which stays the last row",
    ITEMS[ITEMS.length - 1] === "SOURCE" && ITEMS[ITEMS.length - 2] === "STATS",
    JSON.stringify(ITEMS),
  );
  let opened = 0;
  const a = createMenuApp({ onStats: () => opened++ });
  a.screen = SCREEN.MENU;
  a.cursor = ITEMS.indexOf("STATS");
  check(
    "confirming STATS pushes SCREEN.STATS and fires onStats exactly once",
    a.confirm() === true && a.screen === SCREEN.STATS && opened === 1,
    a.screen + "/" + opened,
  );
  check("Enter on STATS backs out to MENU, exactly as SCORES does",
    a.confirm() === true && a.screen === SCREEN.MENU, String(a.screen));
  a.cursor = ITEMS.indexOf("STATS");
  a.confirm();
  check("Escape on STATS backs out to MENU",
    a.key("Escape") === true && a.screen === SCREEN.MENU, String(a.screen));
  check("onStats is optional — a machine built without it still pushes",
    (() => { const b = createMenuApp(); b.screen = SCREEN.MENU;
      b.cursor = ITEMS.indexOf("STATS"); return b.confirm() === true &&
      b.screen === SCREEN.STATS; })());
  const src = readFileSync("src/render/shellview.js", "utf8");
  check(
    "shellview's MENU items literal renders every shipped row",
    (src.match(/ITEMS\[\d\]/g) || []).length === ITEMS.length,
    (src.match(/ITEMS\[\d\]/g) || []).join(","),
  );
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/menuapp.test.mjs tests/menudraw.test.mjs tests/stats.test.mjs
```

Expected: FAIL — `menuapp.test.mjs` reports `ITEMS frozen, 7 entries -> ["PLAY",…,"SOURCE"]`
(still six) and `cursor 5 (SOURCE) -> screen 12` on the new dispatch row;
`stats.test.mjs` reports `SCREEN.STATS is 12 -> undefined`.

- [ ] **Step 3: Implement**

**3a — `src/app/menuapp.js`.** Append the screen (`:28`), never insert:

```js
  GUIDE: 11, // appended — folds HOW TO PLAY/ITEMS/ENEMIES one hop deeper
  STATS: 12, // appended — the opt-in cabinet counters (R5)
```

`ITEMS` gains one row **before** `SOURCE`, which stays last because it is the one
row that leaves the page:

```js
export const ITEMS = Object.freeze([
  "PLAY",
  "LEVEL SELECT",
  "OPTIONS",
  "GUIDE",
  "HIGH SCORES",
  "STATS",
  "SOURCE",
]);
```

`confirm()`'s MENU switch, after the `"HIGH SCORES"` case (`:289-290`):

```js
            case "STATS":
              if (o.onStats) o.onStats();
              return this._push(SCREEN.STATS);
```

`confirm()`'s back-out list (`:311-315`) and `back()`'s MENU list (`:326-332`)
each gain `SCREEN.STATS`, so Enter and Escape both close it exactly as they close
SCORES.

**3b — `src/render/shellview.js`.** The MENU `items:` literal grows to seven:

```js
          ITEMS[5],
          ITEMS[6],
        ],
```

**3c — `src/main.js`.** The audio `confirm` wrapper's exclusion list gains STATS
so a STATS confirm cues `uiBack` alone, not `uiSel` **and** `uiBack`:

```js
        sB !== SCREEN.ENEMIES &&
        sB !== SCREEN.STATS
```

**3d — the line pin.** In `tests/headless.test.mjs`, append one reason line and
raise the number in **both** the label and the assertion:

```js
  // R5 stats wave: +16 lines (stats.js import; session_start at boot; the
  // copyText helper replacing the inline clipboard pair; KeyC-on-STATS;
  // onStats; the STATS audio exclusion; the room_enter/room_clear/death/
  // run_end/score_set/plaque_unlock edges) — bumped 760->776.
  check("main.js stays a lean browser entry (<=776 lines)",
    L.length<=776,String(L.length));
```

The bump lands here, in this plan's **first** `main.js`-touching task; Task 4
adds the remaining lines under the same ceiling. If your implementation lands
above 776, move the excess into `src/app/stats.js` — **never raise the pin**.

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test
```

Expected: all green. In particular `tests/headless.test.mjs:185,196,212,269,279`
are **unmoved and still green** — inserting at `[5]` leaves `[0..4]` where they
were. If any of them fails, `STATS` was inserted in the wrong place.

- [ ] **Step 5: PWA bump + commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together.

```bash
git add src/app/menuapp.js src/render/shellview.js src/main.js tests/menuapp.test.mjs tests/menudraw.test.mjs tests/stats.test.mjs tests/headless.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Add SCREEN.STATS = 12 and a STATS row directly above SOURCE.

The screen value is appended, never inserted, because menuapp.js's own comment
says so and every frozen value after an insert would shift. The row goes above
SOURCE rather than below it: SOURCE is the one row that leaves the page, and a
data row placed under an external link reads as an afterthought. Inserting at
index five also leaves indices zero through four where they are, which is what
keeps the index-driven MENU confirms in headless green without touching them —
the daily row lands at index two later and does move them, and that
renegotiation belongs to the commit that adds it.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: the plate — `statsRows`, `statsNotes` and `drawStats`

**Files:**
- Modify: `src/app/stats.js` — `statsRows`, `statsNotes`
- Modify: `src/render/menudraw.js` — `drawStats(c, L, t, ui)`, beside
  `drawScores` (`:694-837`)
- Modify: `src/render/shellview.js` — a `SCREEN.STATS` branch on the screen
  router (`:117-139`)
- Modify: `tests/stats.test.mjs` — append block 10
- Modify: `tests/menudraw.test.mjs` — append the drawStats block inside the
  existing `for (const [W, H] of [[600, 520], [608, 352]])` loop
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `bestOfRun` (`app/bests.js`), `fmtLong`
- Produces: `statsRows(v, bests)`, `statsNotes(v, daily, today)`,
  `menudraw.drawStats(c, L, t, ui)` with `ui = {rows, notes}`

- [ ] **Step 1: Write the failing tests**

In `tests/stats.test.mjs`, extend the imports and append:

```js
import { statsRows, statsNotes } from "../src/app/stats.js";
import { recordBest } from "../src/app/bests.js";
import * as md from "../src/render/menudraw.js";

// ---- 10. the nine rows, the two notes, and the plate ----
{
  const v = clampStats({
    a: { runs: 118, rooms: 214, deaths: 301, kills: 4820, picks: 913,
      bricks: 7702, secs: 50820, sessions: 42, first: "2026-08-30", last: TODAY },
  });
  let bests = recordBest(undefined, "0:0:1", 1840, 5);
  bests = recordBest(bests, "1:0:1", 2210, 4);
  const rows = statsRows(v, bests);
  check("statsRows is exactly nine [label, value] pairs", rows.length === 9, rows.length);
  check(
    "the six lifetime counters read the aggregates",
    rows[0][0] === "RUNS" && rows[0][1] === "118" &&
      rows[1][0] === "ROOMS CLEARED" && rows[2][0] === "DEATHS" &&
      rows[3][0] === "KILLS" && rows[4][0] === "PICKUPS" &&
      rows[5][0] === "PLAY TIME" && rows[5][1] === "14h 07m",
    JSON.stringify(rows.slice(0, 6)),
  );
  check(
    "rows 7-9 read the PLAIN bucket only — an IRON run is not a CORE best",
    rows[6][0] === "CORE BEST" && rows[6][1] === "1840 · R5" &&
      rows[7][0] === "PLUS BEST" && rows[7][1] === "2210 · R4" &&
      rows[8][0] === "MAX BEST" && rows[8][1] === "—",
    JSON.stringify(rows.slice(6)),
  );
  check(
    "an IRON (pact) record never leaks into CORE BEST",
    statsRows(v, recordBest(undefined, "0:1:1", 99999, 8))[6][1] === "—",
    statsRows(v, recordBest(undefined, "0:1:1", 99999, 8))[6][1],
  );
  check(
    "statsRows on an empty cabinet is still nine rows, never a hole",
    statsRows(clampStats(null), undefined).length === 9,
  );
  const n0 = statsNotes(v, null, null);
  check(
    "with no daily record there is ONE note and it is the session line",
    n0.length === 1 &&
      n0[0] === "SINCE 2026-08-30 · LAST 2026-09-07 · 42 SESSIONS · BESTS ARE PER HEAT",
    JSON.stringify(n0),
  );
  const n1 = statsNotes(v, { date: TODAY, best: 1840, played: 3 }, TODAY);
  check(
    "today's daily note carries the honesty clause",
    n1.length === 2 &&
      n1[0] === "DAILY 2026-09-07 · BEST 1840 · 3 TRIES · YOUR OWN ATTEMPTS ONLY",
    JSON.stringify(n1),
  );
  const n2 = statsNotes(v, { date: "2026-09-01", best: 9, played: 1 }, TODAY);
  check(
    "a stale daily record reads NOT PLAYED YET for today",
    n2[0] === "DAILY 2026-09-07 · NOT PLAYED YET",
    n2[0],
  );
  check(
    "note 2 fits the plate: 72 chars at ~6px against an inner width of 448",
    n0[0].length <= 74,
    n0[0].length + " chars",
  );
}
```

In `tests/menudraw.test.mjs` (**re-read it first**), inside the existing
`for (const [W, H] of [[600, 520], [608, 352]])` loop of the plate-fit section,
append:

```js
    {
      const { c, texts, rects } = rec();
      md.drawStats(c, L, 0.4, {
        rows: [
          ["RUNS", "118"], ["ROOMS CLEARED", "214"], ["DEATHS", "301"],
          ["KILLS", "4820"], ["PICKUPS", "913"], ["PLAY TIME", "14h 07m"],
          ["CORE BEST", "1840 · R5"], ["PLUS BEST", "—"], ["MAX BEST", "—"],
        ],
        notes: [
          "DAILY 2026-09-07 · NOT PLAYED YET",
          "SINCE 2026-08-30 · LAST 2026-09-07 · 42 SESSIONS · BESTS ARE PER HEAT",
        ],
      });
      const all = texts.map((t) => t.s);
      const p = plateOf(rects);
      check(
        `stats plate paints all nine labels and the head at ${W}x${H}`,
        ["RUNS", "ROOMS CLEARED", "DEATHS", "KILLS", "PICKUPS", "PLAY TIME",
          "CORE BEST", "PLUS BEST", "MAX BEST", "STATS", "YOUR CABINET"]
          .every((s) => all.includes(s)),
        all.join("|"),
      );
      check(
        `stats plate paints both notes and the copy foot at ${W}x${H}`,
        all.some((s) => s.indexOf("NOT PLAYED YET") >= 0) &&
          all.some((s) => s.indexOf("BESTS ARE PER HEAT") >= 0) &&
          all.includes("C COPY MY STATS · ESC BACK"),
        all.join("|"),
      );
      check(
        `stats plate shows NO json at ${W}x${H} — it is a screen, not a debug dump`,
        !all.some((s) => /[{}\[\]]/.test(s)),
        all.join("|"),
      );
      const last = texts[texts.length - 1];
      check(
        `every stats line stays inside the plate at ${W}x${H}`,
        !!p && texts.every((t) => t.y > p.y && t.y < p.y + p.h),
        JSON.stringify({ py: p && p.y, ph: p && p.h, last }),
      );
    }
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/stats.test.mjs tests/menudraw.test.mjs
```

Expected: FAIL — `stats.test.mjs` reports
`does not provide an export named 'statsRows'`, and `menudraw.test.mjs` reports
`md.drawStats is not a function`.

- [ ] **Step 3: Implement**

**3a — `src/app/stats.js`.** Add, importing `bestOfRun` from `./bests.js`:

```js
/* Rows 7-9 read the PLAIN bucket "<heat>:0:1" — no pact, NORM pace. Folding an
   IRON run into "CORE BEST" would be the same unit error nb.highscores.v1
   makes; note 2 says so on screen. STATS READS nb.bests.v1 and nb.times.v1 and
   copies neither — a second copy of a best is a second thing that can disagree
   with the overlay. */
export function statsRows(v, bests) {
  const s = clampStats(v);
  const best = (h) => {
    const b = bestOfRun(bests, h + ":0:1");
    return b ? b.s + " · R" + b.r : "—";
  };
  return [
    ["RUNS", String(s.a.runs)],
    ["ROOMS CLEARED", String(s.a.rooms)],
    ["DEATHS", String(s.a.deaths)],
    ["KILLS", String(s.a.kills)],
    ["PICKUPS", String(s.a.picks)],
    ["PLAY TIME", fmtLong(s.a.secs)],
    ["CORE BEST", best(0)],
    ["PLUS BEST", best(1)],
    ["MAX BEST", best(2)],
  ];
}
/* `today` is used for one thing only: deciding whether the stored daily record
   is today's. It is therefore the DAILY's day (main.js's local todayStr once R3
   lands), never the UTC dateStr that stamps the aggregates. Before R3, `daily`
   is null and note 1 is omitted entirely rather than faked. */
export function statsNotes(v, daily, today) {
  const s = clampStats(v);
  const out = [];
  if (daily && typeof daily === "object") {
    out.push(
      daily.date && daily.date === today && (daily.played | 0) > 0
        ? "DAILY " + today + " · BEST " + (daily.best | 0) + " · " +
          (daily.played | 0) + " TRIES · YOUR OWN ATTEMPTS ONLY"
        : "DAILY " + today + " · NOT PLAYED YET",
    );
  }
  out.push(
    "SINCE " + (s.a.first || "—") + " · LAST " + (s.a.last || "—") + " · " +
    s.a.sessions + " SESSIONS · BESTS ARE PER HEAT",
  );
  return out;
}
```

**3b — `src/render/menudraw.js`.** Add `drawStats` directly after `drawScores`,
modelled on it line for line:

```js
/* STATS (R5): the drawScores scaffold — one plate, a head, a right-aligned
   value column, a rule, notes and a foot. ui={rows,notes} arrives already
   computed (app/stats.js), the same getter discipline scores and plaques use:
   this file must not import src/app. The rule after row 6 is what separates
   six lifetime counters from three per-heat bests, so the screen reads as a
   cabinet and not as a debug dump — no JSON is ever painted here. */
export function drawStats(c, L, t, ui) {
  const S = shell(c, L, 480);
  head(c, S, "STATS", "YOUR CABINET");
  const rows = (ui && ui.rows) || [];
  const notes = (ui && ui.notes) || [];
  const top = S.headY + 22,
    bot = S.footY - 42,
    rowH = (bot - top) / 9;
  const size = rowH < 18 ? 11 : 13;
  c.textBaseline = "middle";
  for (let i = 0; i < rows.length; i++) {
    const y = top + (i + 0.5) * rowH;
    c.textAlign = "left";
    c.fillStyle = MUTED;
    c.font = font(9, "900");
    c.fillText(String(rows[i][0]), S.ix, y);
    c.textAlign = "right";
    c.fillStyle = TEXT;
    c.font = font(size);
    c.fillText(String(rows[i][1]), S.ix + S.iw, y);
  }
  const ry = top + 6 * rowH;
  c.strokeStyle = LINE;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(S.ix, ry);
  c.lineTo(S.ix + S.iw, ry);
  c.stroke();
  c.fillStyle = MUTED;
  c.font = font(10);
  c.textAlign = "center";
  for (let i = 0; i < notes.length && i < 2; i++)
    c.fillText(String(notes[i]), S.mid, S.footY - (notes.length - i) * 14 - 2);
  foot(c, S, "C COPY MY STATS · ESC BACK");
}
```

Measured: at 600×520 `S.headY 99.2`, `S.footY 476` ⇒ top 121.2, bot 434,
`rowH 34.76`; at 608×352 `S.headY 72.32`, `S.footY 308` ⇒ top 94.32, bot 266,
`rowH 19.08`. Both are ≥ 18, so both render values at 13 px.

**3c — `src/render/shellview.js`.** A branch on the screen router, beside
`SCREEN.SCORES`:

```js
  } else if (s === SCREEN.STATS) {
    menudraw.drawDim(c, 0.72, cw, chh);
    menudraw.drawStats(c, L, app.subT, app.stats);
```

`app.stats` is the `{rows, notes}` snapshot `main.js` writes in `onStats`
(Task 4). Until then it is `undefined`, and `drawStats` renders the empty plate
rather than throwing — which is what the `(ui && ui.rows) || []` guard is for.

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test
```

Expected: all green.

- [ ] **Step 5: PWA bump + commit**

```bash
git add src/app/stats.js src/render/menudraw.js src/render/shellview.js tests/stats.test.mjs tests/menudraw.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Paint STATS on the HIGH SCORES scaffold: nine rows, a rule, two notes.

The named failure mode for a screen like this is that it reads as a debug tool,
so the mitigations are structural rather than cosmetic: a real plate, a
right-aligned value column, a rule separating six lifetime counters from three
per-heat bests, and no JSON anywhere on screen. Rows seven through nine read
the plain bucket only — folding a pact run into CORE BEST would be the same
unit error that rules out comparing against nb.highscores.v1. The rows arrive
already computed, so menudraw still imports nothing from src/app.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: the edges and COPY MY STATS

**Files:**
- Modify: `src/app/stats.js` — `statsPayload`
- Modify: `src/main.js` — the `stats.js` import; `qualifies` on the existing
  `highscores.js` import; `session_start` at boot; the `copyText` helper
  factored out of the `KeyC` block; `KeyC`-on-STATS **inside** that block;
  `onStats`; and the `room_enter` / `room_clear` / `death` / `win_finale` /
  `run_end` / `score_set` / `plaque_unlock` edges (**locate every edit by
  string** — R1 has already moved these line numbers)
- Modify: `tests/stats.test.mjs` — append block 11
- Modify: `MEMORY.md`, `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `stat`, `setStatsOn`, `statPlaques`, `statsRows`, `statsNotes`,
  `statsPayload`, `loadBests`, `loadTimes`, `qualifies`
- Produces: `app.stats = {rows, notes}`; the clipboard payload on `KeyC`

- [ ] **Step 1: Write the failing tests**

Append to `tests/stats.test.mjs`:

```js
import { statsPayload } from "../src/app/stats.js";
import { createGame } from "../src/main.js";

// ---- 11. the four-line payload, and the one explicit export channel ----
{
  const v = clampStats({
    a: { runs: 118, rooms: 214, deaths: 301, kills: 4820, picks: 913,
      bricks: 7702, secs: 50820, sessions: 42, first: "2026-08-30", last: TODAY },
  });
  let bests = recordBest(undefined, "0:0:1", 1840, 5);
  bests = recordBest(bests, "1:0:1", 2210, 4);
  const times = { on: 0, b: { "1:0:0:1": 389 } };
  const pay = statsPayload(v, bests, times, TODAY);
  const lines = pay.split("\n");
  check("statsPayload is exactly four lines", lines.length === 4, JSON.stringify(lines));
  check(
    "line 1 is the span and the session count",
    lines[0] === "FUSEGRID STATS · 2026-08-30→2026-09-07 · 42 SESSIONS",
    lines[0],
  );
  check(
    "line 2 is the lifetime counters, bricks included",
    lines[1] ===
      "RUNS 118 · ROOMS 214 · DEATHS 301 · KILLS 4820 · PICKS 913 · BRICKS 7702 · TIME 14h 07m",
    lines[1],
  );
  check(
    "line 3 names R7's store rather than duplicating it",
    lines[2] === "CORE 1840/R5 · PLUS 2210/R4 · MAX — · CORE BEST TIME 0:38.9",
    lines[2],
  );
  check(
    "line 4 is the play URL WITH its trailing slash",
    lines[3] === "https://hmarzban.github.io/fusegrid/",
    lines[3],
  );
  check(
    "the payload is plain text — no JSON, no braces, no brackets",
    !/[{}\[\]]/.test(pay),
    pay,
  );
  check(
    "the payload never carries a clock-shaped value and never the refused word",
    !/\b1[6-9]\d{11}\b/.test(pay) && !/leaderboard/i.test(pay),
    pay,
  );
  check("statsPayload is pure — same inputs, same string, no store read",
    statsPayload(v, bests, times, TODAY) === pay);
}

// ---- 11b. wiring: C on STATS exports, C outside GAME still falls through ----
{
  const mem = new Map();
  const ls = { getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)) };
  const wrote = [];
  globalThis.window = { localStorage: ls, addEventListener() {} };
  globalThis.navigator = { clipboard: { writeText: (s) => { wrote.push(s); return Promise.resolve(); } } };
  try {
    const g = createGame(null, { seed: 31 });
    g.app.cabinetSeen = true;
    g.app.skip();
    check("session_start recorded at boot",
      loadStats(ls).a.sessions >= 1, JSON.stringify(loadStats(ls).a));
    g.app.cursor = ITEMS.indexOf("STATS");
    g.app.confirm();
    check("STATS is open and the opt-in flipped on",
      g.app.screen === SCREEN.STATS && loadStats(ls).on === 1,
      g.app.screen + "/" + loadStats(ls).on);
    check("main built the row snapshot for the plate",
      !!g.app.stats && g.app.stats.rows.length === 9,
      JSON.stringify(g.app.stats && g.app.stats.rows.length));
    g.input.onUiKey("KeyC");
    check("C on STATS writes the four-line payload once",
      wrote.length === 1 && wrote[0].split("\n").length === 4, JSON.stringify(wrote));
    /* main.js:332's documented fall-through: outside GAME, KeyC must still
       reach app.key so it keeps playing. Placing the STATS branch ABOVE the
       KeyC block instead of inside it is what would break this. */
    g.app.enterAttract();
    wrote.length = 0;
    g.input.onUiKey("KeyC");
    check("C on ATTRACT copies nothing and still reaches app.key",
      wrote.length === 0 && g.app.screen === SCREEN.GAME,
      g.app.screen + "/" + wrote.length);
  } finally {
    delete globalThis.window;
    delete globalThis.navigator;
  }
}

// ---- 11c. score_set is gated on the SHIPPED qualifies, and the plaque
// literal the menudraw pin regexes is read around, never restructured ----
{
  const src = readFileSync("src/main.js", "utf8");
  check(
    "score_set fires only when the row actually lands",
    /qualifies\(/.test(src) &&
      /if \(qualifies\([^\n]*\) stat\("score_set"/.test(src),
    (src.match(/stat\("score_set"[^\n]*/) || [])[0],
  );
  check(
    "the shipped savePlaques(unlockPlaques(loadPlaques(), world)) literal is untouched",
    /savePlaques\(unlockPlaques\(loadPlaques\(\), world\)\)/.test(src) &&
      (src.match(/unlockPlaques\(/g) || []).length === 1,
    (src.match(/unlockPlaques\([^\n]*/) || [])[0],
  );
  check(
    "run_end is emitted from inside endRun, so a quit run counts exactly once",
    /const endRun = \(\) => \{[\s\S]{0,400}stat\("run_end"/.test(src),
    (src.match(/stat\("run_end"[^\n]*/) || [])[0],
  );
  check(
    "KeyC-on-STATS sits INSIDE the KeyC block, above its GAME check",
    (() => {
      const blk = (src.match(/if \(code === "KeyC"\) \{[\s\S]{0,420}/) || [""])[0];
      return blk.indexOf("SCREEN.STATS") > 0 &&
        blk.indexOf("SCREEN.STATS") < blk.indexOf("SCREEN.GAME");
    })(),
    (src.match(/if \(code === "KeyC"\)[\s\S]{0,160}/) || [""])[0],
  );
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/stats.test.mjs
```

Expected: FAIL — `does not provide an export named 'statsPayload'`.

- [ ] **Step 3: Implement**

**3a — `src/app/stats.js`.** Add, importing `bestOf` from `./times.js`:

```js
/* Four plain-text lines, pure over four values. Line 3's time reads
   nb.times.v1's room-1 CORE-plain key, so the payload NAMES R7's store instead
   of duplicating it. The URL keeps its trailing slash: the no-slash Pages 301
   drops the OG tags. main.js hands the times blob in rather than this module
   reading a store, because purity is what makes the payload pinnable. */
export function statsPayload(v, bests, times, today) {
  const s = clampStats(v);
  const a = s.a;
  const best = (h) => {
    const b = bestOfRun(bests, h + ":0:1");
    return b ? b.s + "/R" + b.r : "—";
  };
  const t1 = bestOf(times, "1:0:0:1");
  return (
    "FUSEGRID STATS · " + (a.first || "—") + "→" + (a.last || today || "—") +
      " · " + a.sessions + " SESSIONS\n" +
    "RUNS " + a.runs + " · ROOMS " + a.rooms + " · DEATHS " + a.deaths +
      " · KILLS " + a.kills + " · PICKS " + a.picks + " · BRICKS " + a.bricks +
      " · TIME " + fmtLong(a.secs) + "\n" +
    "CORE " + best(0) + " · PLUS " + best(1) + " · MAX " + best(2) +
      " · CORE BEST TIME " + (t1 == null ? "—" : fmtT(t1)) + "\n" +
    "https://hmarzban.github.io/fusegrid/"
  );
}
```

`fmtT` is the module-local helper added in Task 1 Step 3b. `bestOf` returns
seconds recovered from integer tenths, so `389` tenths round-trips to `0:38.9`
exactly — the assertion block 11 makes.

**3b — `src/main.js`.** Every edit is located **by string**.

Imports:

```js
import { loadStats, setStatsOn, stat, statPlaques, statsRows, statsNotes, statsPayload } from "./app/stats.js";
```
and `qualifies` joins the existing `highscores.js` import list.

Boot, beside the existing `if (autoplay)` block:

```js
  stat("session_start", null, dateStr());
```

The clipboard helper, replacing the two inline lines inside the `KeyC` GAME
branch (**one helper, three call sites after R8**):

```js
  const copyText = (s) => { if (typeof navigator !== "undefined" && navigator.clipboard)
    navigator.clipboard.writeText(s).catch(() => {}); };
```

The `KeyC` block becomes — the STATS branch goes **inside** it, above the GAME
check, because putting it above the whole block would break the documented
"outside GAME … fall through to `app.key` so KeyC still plays" path:

```js
    if (code === "KeyC") {
      if (app.screen === SCREEN.STATS) { copyText(statsPayload(loadStats(), loadBests(), loadTimes(), dateStr())); return; }
      if (app.screen === SCREEN.GAME) {
        if (world.state === "WIN" || world.state === "LOSE") copyText(copyPayload(world));
        return;
      }
    }
```

`onStats`, in the `createMenuApp` options beside `onSource`:

```js
    onStats: () => { setStatsOn(); const sv = loadStats();
      app.stats = { rows: statsRows(sv, loadBests()), notes: statsNotes(sv, null, null) }; },
```

The edges, each beside the code that already detects them:

```js
      if (app.noteWorldEdge(prevSt, world.state)) {
        const sc = loadScores(), en = scoreEntry(world, dateStr());
        if (qualifies(en.s, sc)) stat("score_set", { h: world.heat | 0 }, dateStr());
        saveScores(recordScore(sc, en));
      }
```
```js
        if (isFinale(world.level)) { endRun(); stat("win_finale", null, dateStr()); }
        stat("room_clear", { r: world.level | 0 }, dateStr());
```
```js
        if (prevSt === "LOSE") startRunState();  // R1: a retry never calls onStart
        stat("room_enter", { r: world.level | 0, h: world.heat | 0, pc: world.pact | 0, pa: world.pace | 0 }, dateStr());
```
```js
      feedTally(tally, world);
      if (tally.dNew > 0) stat("death", { r: world.level | 0 }, dateStr());
```

inside `endRun`, after the `saveBests` line:

```js
    stat("run_end", { r: world.level | 0, s: world.score | 0, k: tally.k, p: tally.p, b: tally.b, secs: Math.round(runT), kt: tally.kt, pk: tally.pk }, dateStr());
```

in `onStart`, beside `startRunState();`:

```js
    stat("room_enter", { r: world.level | 0, h: world.heat | 0, pc: world.pact | 0, pa: world.pace | 0 }, dateStr());
```

and the plaque edge — the shipped literal is **read around, never
restructured**, because `tests/menudraw.test.mjs` regexes it exactly:

```js
        const pq0 = loadPlaques();
        savePlaques(unlockPlaques(loadPlaques(), world));
        statPlaques(pq0, loadPlaques(), dateStr());
```

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test
```

Expected: all green, `tests/menudraw.test.mjs`'s `unlockPlaques` pin included.

- [ ] **Step 5: Headed play-verify**

Unregister the service worker and delete its caches first. Then on
`http://127.0.0.1:8080/index.html`, in **both** CLASSIC 2D (600×520) and
`?render=3d` (608×352):

1. **A fresh profile.** STATS opens on an empty cabinet: nine rows, zeros, three
   `—` bests, one note line. Nothing overflows the plate and nothing reads as a
   dump.
2. **A full cabinet.** Play a few runs at CORE and PLUS, die, quit one run from
   the pause list, then reopen STATS: `RUNS` counts the quit run too, and the
   two bests rows read `n · Rm`.
3. **`C` on STATS.** Paste into a text editor: four lines, no braces, the URL
   with its trailing slash.
4. **`C` on ATTRACT still plays** rather than copying — the fall-through.
5. **Open DevTools → Application → Local Storage.** `nb.stats.v1` is readable:
   dates as strings, counters as integers, and `e` **empty until the first time
   you open STATS**, then filling from that point.

- [ ] **Step 6: PWA bump, MEMORY, commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together. Append
to `MEMORY.md` under a new `## 2026-09-07 — R5 STATS screen` heading (newest
first, 1–2 lines): that `nb.stats.v1` records lifetime aggregates
unconditionally while its 200-entry event ring fills only after the player opens
`SCREEN.STATS = 12` once; that STATS **reads** `nb.bests.v1` and `nb.times.v1`
rather than copying either; and that stats leave the device only through `C` on
that screen, as four plain-text lines.

```bash
git add src/app/stats.js src/main.js tests/stats.test.mjs MEMORY.md src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Record the ten stat edges and export the cabinet on one keypress.

run_end is emitted from inside endRun, so a run that ends by quitting counts
exactly once and the finale path — which reaches endRun twice — still counts
once. score_set is gated on the shipped qualifies, because recordScore slices
to ten and a persisted score is not a landed row. The plaque events read the
mask before and after the shipped savePlaques call rather than restructuring
it, since that literal is pinned. C on STATS goes inside the existing KeyC
block rather than above it: above it would break the documented fall-through
that keeps C playing outside GAME. The payload is four plain-text lines and
names nb.times.v1 rather than duplicating it.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```
