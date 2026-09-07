# R3 — Daily seeded challenge (honest, single-device) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A **DAILY** row under LEVEL SELECT starts a CORE room-1 run on a board
derived from today's date, marked `NEW` or `PLAYED`. The run-end overlay reads
`DAILY 2026-09-07 · NORM · TRY 3 · YOUR BEST 1840`, `C` copies
`DAILY 2026-09-07 · L3 · 1840 · https://hmarzban.github.io/fusegrid/`, and STATS
note 1 carries the standing record with the words `YOUR OWN ATTEMPTS ONLY`. The
claim is that your own attempts are comparable to each other — never a race, and
enforcement of one-attempt-per-day is refused, not attempted.

**Architecture:** `dailySeed(dateStr)` is a pure FNV-1a 32-bit hash plus the
standard avalanche, so one calendar day's worth of input change scatters the
whole word — `world.js:15` seeds the rng with `seed ^ level*40503`, so a weak
low-bit hash would give consecutive days near-identical room-1 boards. The seed
reaches the sim the only way this wave allows: `world.seed`, which
`createWorld`/`loadLevel` already read (`world.js:15,74-75`). `src/core` is not
touched. `src/app/daily.js` never calls `Date`: every function takes the string,
the `flags.js:1-3` template, and `main.js` owns a **local**-date helper beside
the shipped UTC `dateStr`, because a challenge day that flips at 5 p.m. local is
precisely the confusion this feature exists to avoid.

**This plan owns stage 2 of the menu-cursor renegotiation.** `DAILY` is inserted
at `ITEMS[2]`, which moves OPTIONS `2→3` and GUIDE `3→4` — so unlike R5's stage
1, **`tests/headless.test.mjs`'s five index-driven MENU confirms must be
renegotiated in this plan's Task 2** or the suite lands red.

**Tech Stack:** Pure ES modules, `node --test` / `tests/*.test.mjs`, Canvas 2D
plus vendored three.js r160. Zero npm runtime deps. `src/app/` is DOM-free and
`Date`-free; `src/core` is untouched.

**Spec:** `docs/superpowers/specs/2026-09-07-retention-wave2-design.md` §4

**Index:** `docs/superpowers/plans/2026-09-07-retention-wave2.md` — its
**Shared interfaces** block is authoritative for every signature below.

**Depends on:** R1 (`2026-09-07-run-summary.md`) for `endRun` and slot 3 of the
summary stack, and R5 (`2026-09-07-stats-screen.md`) for STATS note 1 and for
cursor stage 1. **Consequence: every `main.js`, `menuapp.js`, `shellview.js` and
`tests/headless.test.mjs` line number cited in the spec is stale by the time this
plan runs — locate every edit by string.**

## Global Constraints

- **The daily is honour-system and single-device.** Enforcement of one attempt
  per day is refused: `localStorage` is the only persistence (`store.js:1-7`) and
  a private window bypasses it. The honesty copy lives in exactly two places,
  neither of them a nag — STATS note 1's `· YOUR OWN ATTEMPTS ONLY`, and the word
  `YOUR` in the run-end line. **No banner, no streak, no "come back tomorrow".**
- **The run config is pinned, not inherited:**
  `{level: 1, heat: 0 (CORE), pact: 0, pace: 0 (NORM), seed: dailySeed(today)}`.
  Heat changes the roster (`heat.js:102-113`), pact changes the item count and
  therefore the rng draw order (`pact.js:23` → `world.js:129-133`), and pace
  scales player speed without touching the seed (`sim.js:124`). Attract is
  pinned to CORE/pact 0 for the same reason (`menuapp.js:576-579`).
- **The pinned NORM pace is an accessibility cost, and it is shown, not
  swallowed.** `bootFromIntro` and `playFromAttract` both pass `this.pace`; the
  daily does not, so a player who chose EASY plays the daily at NORM — and the
  run-end line prints the pace token so the ignored setting is never a silent
  surprise. `nb.daily.v1` also **stamps** the pace it ran at, so a record made
  under a future different pin is refused rather than silently compared.
- **`dateStr()` (`main.js:58`) stays UTC and is not touched.** It stamps the
  high-score `d` column (`highscores.js:86`); changing it would re-interpret
  every already-persisted row. The daily gets its own three-line local helper
  beside it. **Disclosed:** two players in different time zones can be on
  different daily boards for part of a day; the date is printed on the run-end
  line and in the share stamp, so a mismatch is visible.
- **`dailyDate` deliberately survives a LOSE retry.** `startGame` →
  `loadLevel(world,1,false)` never touches `world.seed`, so a retry replays the
  same board — it is another attempt at the same challenge and `tries` counts up.
  R1's `startRunState()` must **not** clear it.
- **`app.dailyTag` is written at boot and at every run end, not per frame.**
  Disclosed: a session left open across local midnight shows a stale tag until
  the next run or a reload. **The seed is always computed fresh at run start**,
  so what you play is never wrong — only the label can lag.
- **There is no DAILY screen.** The controller granted one appended `SCREEN`
  (STATS = 12) and R3 does not need a second: confirming DAILY starts the run
  immediately, as PLAY does, the standing record lives on STATS note 1, and the
  day's verdict lives on the run-end overlay.
- **DAILY is a MENU row, not a LEVEL SELECT control**, on three checkable
  grounds: LEVEL SELECT's unlocked foot is already 61 chars ≈ 366 px against an
  inner width of 368 (`menudraw.js:434`); its MODES gloss already sits at
  `py + 30` = 279 against `S.footY` 308 at the compact 608×352 size; and a return
  hook must be on the screen a returning player lands on — `bootFromIntro` goes
  to MENU (`menuapp.js:344-346`), and LEVEL SELECT is one hop deeper.
- **`startRun()`'s own args are unchanged** — `{level, heat, pact, pace}`.
  `seed` and `daily` are optional additions to `_playCore` only, consumed by
  `main.js`'s `onStart`. **Pinned as an absence.**
- **On a daily run the daily line REPLACES the delta line in slot 3.** The day's
  comparison is the one that matters that day; the `nb.bests.v1` write still
  happens, so nothing is lost from the record.
- **`main.js`'s line pin rises to 782 exactly once**, in **Task 3** — this plan's
  only `main.js`-touching task. Additions total **+12** over R5's 770. If your
  implementation lands above 782, move the excess into `src/app/daily.js` —
  **never raise the pin**.
- **`src/pwa/shell.js`'s `SRC` entry for `src/app/daily.js` is mandatory.**
- PWA: bump `CACHE_NAME` + `sw.js:3` `REV` **together**, `current vN → vN+1`, in
  **every** commit here. **Read the current value first.**
- Comments only where the file already uses them.
- Never write the private reference game's name, or the word `leaderboard`, into
  any committed file.

---

### Task 1: `src/app/daily.js` — the seed, the record, and the stamp

**Files:**
- Create: `src/app/daily.js`
- Create: `tests/daily.test.mjs`
- Modify: `src/pwa/shell.js` — `SRC` gains `"src/app/daily.js"` (after
  `"src/app/debughook.js"`), and `:1` `CACHE_NAME`
- Modify: `sw.js:3`

**Interfaces:**
- Consumes: `clampPace` (`core/pace.js`), `defaultStore` (`app/store.js`)
- Produces: `DAILY_KEY`, `dailySeed`, `clampDaily`, `loadDaily`, `saveDaily`,
  `recordDaily`, `dailyTag`, `dailyStamp`

- [ ] **Step 1: Write the failing tests** — create `tests/daily.test.mjs`

```js
import {
  DAILY_KEY,
  dailySeed,
  clampDaily,
  loadDaily,
  saveDaily,
  recordDaily,
  dailyTag,
  dailyStamp,
} from "../src/app/daily.js";

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

// ---- 1. dailySeed: the four measured values, and purity ----
{
  check("DAILY_KEY is nb.daily.v1", DAILY_KEY === "nb.daily.v1", DAILY_KEY);
  const want = [
    ["2026-09-07", 4119412512],
    ["2026-09-08", 3922720528],
    ["2026-01-01", 750118410],
    ["", 2019044825],
  ];
  const bad = want.filter(([s, n]) => dailySeed(s) !== n);
  check(
    "dailySeed matches the four measured values exactly",
    !bad.length,
    JSON.stringify(bad.map(([s]) => [s, dailySeed(s)])),
  );
  check(
    "dailySeed is pure — same string, same seed, every time",
    dailySeed(TODAY) === dailySeed(TODAY) && dailySeed(null) === dailySeed(""),
    String(dailySeed(TODAY)),
  );
  /* world.js:15 seeds the rng with seed ^ (level*40503), so a hash whose low
     bits barely move between consecutive dates would give near-identical room-1
     boards two days running. The avalanche is what this assertion is really
     testing. */
  const seen = new Set();
  const base = Date.UTC(2026, 0, 1);
  for (let i = 0; i < 3650; i++)
    seen.add(dailySeed(new Date(base + i * 86400000).toISOString().slice(0, 10)));
  check(
    "3650 consecutive dates produce 3650 distinct seeds — zero collisions",
    seen.size === 3650,
    String(seen.size),
  );
  check(
    "consecutive days are not neighbours in the low bits",
    Math.abs(dailySeed("2026-09-07") - dailySeed("2026-09-08")) > 1e6,
    dailySeed("2026-09-07") + " vs " + dailySeed("2026-09-08"),
  );
}

// ---- 2. dailySeed is always a uint32 ----
{
  let ok = true;
  const base = Date.UTC(2026, 0, 1);
  for (let i = 0; i < 3650 && ok; i++) {
    const v = dailySeed(new Date(base + i * 86400000).toISOString().slice(0, 10));
    if ((v >>> 0) !== v || v > 4294967295 || !Number.isInteger(v)) ok = false;
  }
  check("every seed across 3650 dates is a uint32", ok);
  check(
    "dailySeed never calls Date itself",
    !/\bDate\b/.test(
      // eslint-disable-next-line
      dailySeed.toString(),
    ),
    dailySeed.toString().slice(0, 60),
  );
}

// ---- 3. clampDaily / load / save ----
{
  const zero = clampDaily(null);
  check(
    "the zero record is a well-formed day nobody played",
    zero.date === "" && zero.best === 0 && zero.played === 0 &&
      zero.room === 1 && zero.pace === 1,
    JSON.stringify(zero),
  );
  const bad = clampDaily({ date: "07-09-2026", best: -5, played: 9999, room: 0, pace: 7 });
  check(
    "a malformed date drops the whole record to zero",
    bad.date === "" && bad.best === 0 && bad.played === 0,
    JSON.stringify(bad),
  );
  const c = clampDaily({ date: TODAY, best: -5, played: 9999, room: 0, pace: 7 });
  check(
    "with a good date the fields clamp individually",
    c.date === TODAY && c.best === 0 && c.played === 999 && c.room === 1 && c.pace === 2,
    JSON.stringify(c),
  );
  const st = mapStore();
  saveDaily({ date: TODAY, best: 1840, played: 3, room: 4, pace: 1 }, st);
  check(
    "loadDaily/saveDaily round-trip through an injected store",
    loadDaily(st).best === 1840 && loadDaily(st).played === 3,
    JSON.stringify(loadDaily(st)),
  );
  const corrupt = mapStore();
  corrupt.setItem(DAILY_KEY, "{not json");
  check("a corrupt blob degrades to the zero record", loadDaily(corrupt).played === 0);
  let threw = false;
  try {
    const hostile = { getItem() { throw new Error("nope"); }, setItem() { throw new Error("nope"); } };
    loadDaily(hostile);
    saveDaily({ date: TODAY }, hostile);
  } catch (_) {
    threw = true;
  }
  check("loadDaily/saveDaily never throw on a hostile store", !threw);
}

// ---- 4. recordDaily: a fresh day starts over, the same day accumulates ----
{
  const a = recordDaily(clampDaily(null), TODAY, 1200, 3, 0);
  check(
    "a first attempt starts the day at TRY 1",
    a.date === TODAY && a.best === 1200 && a.played === 1 && a.room === 3 && a.pace === 1,
    JSON.stringify(a),
  );
  const b = recordDaily(a, TODAY, 1840, 2, 0);
  check(
    "a second attempt increments tries and takes the MAX of best and room",
    b.played === 2 && b.best === 1840 && b.room === 3,
    JSON.stringify(b),
  );
  const c = recordDaily(b, TODAY, 100, 1, 0);
  check("a worse attempt still counts as a try", c.played === 3 && c.best === 1840);
  check("recordDaily returns a NEW record, never mutating", a.played === 1);
  const d = recordDaily(c, "2026-09-08", 50, 1, 0);
  check(
    "a new day resets played to 1 and takes the new score as the day's best",
    d.date === "2026-09-08" && d.played === 1 && d.best === 50 && d.room === 1,
    JSON.stringify(d),
  );
  const e = recordDaily(clampDaily(null), TODAY, 10, 1, 1);
  check(
    "the pace the run actually ran at is STAMPED, so a future pin change is visible",
    e.pace === 2,
    String(e.pace),
  );
}

// ---- 5. dailyTag ----
{
  check("an empty record is NEW", dailyTag(clampDaily(null), TODAY) === "NEW");
  check(
    "a stale date is NEW",
    dailyTag({ date: "2026-09-01", played: 4 }, TODAY) === "NEW",
  );
  check("played:0 today is NEW", dailyTag({ date: TODAY, played: 0 }, TODAY) === "NEW");
  check(
    "today with at least one try is PLAYED",
    dailyTag({ date: TODAY, played: 1 }, TODAY) === "PLAYED",
  );
  check("dailyTag never throws", dailyTag(null, TODAY) === "NEW" && dailyTag({}, null) === "NEW");
}

// ---- 6. the two locked copy strings ----
{
  check(
    "dailyStamp is the exact share line, URL trailing slash included",
    dailyStamp(TODAY, 3, 1840) ===
      "DAILY 2026-09-07 · L3 · 1840 · https://hmarzban.github.io/fusegrid/",
    dailyStamp(TODAY, 3, 1840),
  );
  check(
    "the stamp carries NO code — the board is derivable from the date, which is the point",
    !/[?&]code=/.test(dailyStamp(TODAY, 3, 1840)),
    dailyStamp(TODAY, 3, 1840),
  );
  check(
    "and it never carries the refused word",
    !/leaderboard/i.test(dailyStamp(TODAY, 3, 1840)),
  );
}

console.log("\n  DAILY RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/daily.test.mjs tests/pwa.test.mjs
```

Expected: FAIL — `Cannot find module '.../src/app/daily.js'`.

- [ ] **Step 3: Implement** — create `src/app/daily.js`

```js
import { clampPace } from "../core/pace.js";
import { defaultStore } from "./store.js";

export const DAILY_KEY = "nb.daily.v1";
/* FNV-1a 32-bit plus the standard 32-bit avalanche. The avalanche is not
   decoration: world.js:15 seeds the rng with seed ^ (level*40503), so a hash
   whose low bits barely move between consecutive dates would hand two
   consecutive days near-identical room-1 boards. No Date and no store anywhere
   in this module — every function takes the string, the flags.js template, so
   the whole feature is drivable from Node. */
export function dailySeed(dateStr) {
  const s = String(dateStr || "");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 3266489917) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const cl = (v, lo, hi) => {
  const n = v | 0;
  return n < lo ? lo : n > hi ? hi : n;
};

/* A record with no well-formed date is not a partial record, it is no record:
   without the day, best/played/room mean nothing and comparing them to today
   would be exactly the fabricated number this wave refuses. */
export function clampDaily(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const date = typeof o.date === "string" && DATE_RE.test(o.date) ? o.date : "";
  if (!date) return { date: "", best: 0, played: 0, room: 1, pace: 1 };
  return {
    date,
    best: cl(o.best, 0, 9999999),
    played: cl(o.played, 0, 999),
    room: cl(o.room, 1, 8),
    pace: cl(o.pace, 0, 2),
  };
}

export function loadDaily(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.getItem !== "function") return clampDaily(null);
    const raw = st.getItem(DAILY_KEY);
    if (raw === null) return clampDaily(null);
    return clampDaily(JSON.parse(raw));
  } catch (_) {
    return clampDaily(null);
  }
}

export function saveDaily(v, store) {
  try {
    const st = store || defaultStore();
    if (st && typeof st.setItem === "function")
      st.setItem(DAILY_KEY, JSON.stringify(clampDaily(v)));
  } catch (_) {}
}

/* The pace is STAMPED as well as the config being pinned, so a record made
   under a future different pin is refused rather than silently compared. */
export function recordDaily(v, today, score, room, pace) {
  const cur = clampDaily(v);
  const s = cl(score, 0, 9999999),
    r = cl(room, 1, 8),
    p = clampPace(pace) + 1;
  if (!DATE_RE.test(String(today || ""))) return cur;
  if (cur.date !== today)
    return { date: today, best: s, played: 1, room: r, pace: p };
  return {
    date: today,
    best: s > cur.best ? s : cur.best,
    played: cl(cur.played + 1, 0, 999),
    room: r > cur.room ? r : cur.room,
    pace: p,
  };
}

export function dailyTag(v, today) {
  const c = clampDaily(v);
  return c.date && c.date === today && c.played > 0 ? "PLAYED" : "NEW";
}

/* No code is appended: the board is derivable from the date by anyone who
   presses DAILY that day, which is the whole point. The URL keeps its trailing
   slash — the no-slash Pages 301 drops the OG tags. */
export function dailyStamp(date, level, score) {
  return (
    "DAILY " + date + " · L" + (level | 0) + " · " + (score | 0) +
    " · https://hmarzban.github.io/fusegrid/"
  );
}
```

Then add `"src/app/daily.js"` to `SRC` in `src/pwa/shell.js`, immediately after
`"src/app/debughook.js"`.

- [ ] **Step 4: Run to PASS**

```bash
node --test tests/daily.test.mjs tests/pwa.test.mjs
```

Expected: green, including `PRECACHE has ./src/app/daily.js`.

- [ ] **Step 5: PWA bump + commit**

```bash
git add src/app/daily.js tests/daily.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Add src/app/daily.js: one board a day from a date string, no Date call.

The hash is FNV-1a plus the standard avalanche rather than a plain sum, because
the world seeds its rng with seed xor level*40503 — a hash whose low bits
barely move between consecutive dates would hand two days in a row nearly the
same room-1 board. Every function takes the date string, so the whole feature
is drivable from Node and src/app stays Date-free. A record without a
well-formed date is no record at all: without the day, best and tries mean
nothing. The pace is stamped as well as the config being pinned, so a record
made under a future different pin is refused rather than silently compared.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: the DAILY row — `startDaily`, and cursor renegotiation **stage 2**

**Files:**
- Modify: `src/app/menuapp.js` — `ITEMS` gains `"DAILY"` at index 2; a
  `dailyTag` app field seeded from `o.dailyTag`; `startDaily()`; `confirm()`'s
  MENU switch gains a `DAILY` case; `_playCore` passes `seed`/`daily` through
  untouched
- Modify: `src/render/shellview.js` — the MENU `items:` literal grows to eight,
  with `ITEMS[2] + "|" + app.dailyTag`
- Modify: `tests/menuapp.test.mjs` (**stage 2**: the `ITEMS` literal, the
  dispatch table, the SOURCE cursor)
- Modify: `tests/menudraw.test.mjs` (**re-read first — R5 already rewrote both
  items literals**;
  both items literals to eight)
- Modify: `tests/headless.test.mjs` (**stage 2**: the five index-driven MENU
  confirms)
- Modify: `tests/daily.test.mjs` — append blocks 7 and 8
- Modify: `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `o.dailySeed()` → `{seed, date}` (supplied by `main.js` in Task 3;
  optional, so this task is green without it)
- Produces: `ITEMS[2] === "DAILY"`, `app.dailyTag`, `app.startDaily()`,
  `_playCore` accepting `seed` and `daily`

**Stage 2, stated explicitly.** The new order is `PLAY(0) LEVEL SELECT(1)
DAILY(2) OPTIONS(3) GUIDE(4) HIGH SCORES(5) STATS(6) SOURCE(7)`. Unlike R5's
stage 1, this insert **moves indices 2, 3 and 4**, so every index-driven MENU
confirm must move with it. Find them:

```bash
grep -n 'g\.app\.cursor=' tests/headless.test.mjs
```

**Five drive a MENU confirm and must be renegotiated** (`2` → OPTIONS becomes
`3`; `3` → GUIDE becomes `4`), together with their trailing comments:

| what it drives | today | stage 2 |
|---|---|---|
| `cursor=2; cv.fire("pointerdown"); // OPTIONS` (C1 click block) | 2 | **3** |
| `cursor=3; cv.fire("pointerdown"); // GUIDE` (C1 click block) | 3 | **4** |
| `cursor=2; // OPTIONS` (S2 tap-glue block) | 2 | **3** |
| `screen=SCREEN.MENU; cursor=2;` then `confirm()` (I1 cue block) | 2 | **3** |
| `cursor=3;` then `confirm()` → GUIDE (I1 cue block) | 3 | **4** |

**Three are index-agnostic and must NOT be touched**: the attract block's
`cursor=4` pair, which asserts only that the cursor is *kept* across
ATTRACT, and the `cursor=2` immediately before an `enterAttract()` that never
confirms. Every wrap assertion in `tests/menuapp.test.mjs` is written against
`ITEMS.length` and moves on its own.

- [ ] **Step 1: Write the failing tests**

In `tests/menuapp.test.mjs`, update the three stage-owned literals:

```js
check(
  "ITEMS frozen, 8 entries",
  Object.isFrozen(ITEMS) &&
    ITEMS.length === 8 &&
    ITEMS[0] === "PLAY" &&
    ITEMS[2] === "DAILY" &&
    ITEMS[3] === "OPTIONS" &&
    ITEMS[4] === "GUIDE" &&
    ITEMS[6] === "STATS" &&
    ITEMS[7] === "SOURCE",
  JSON.stringify(ITEMS),
);
```
```js
  for (const [cur, screen] of [
    [1, SCREEN.LEVEL],
    [3, SCREEN.SETTINGS],
    [4, SCREEN.GUIDE],
    [5, SCREEN.SCORES],
    [6, SCREEN.STATS],
  ]) {
```
```js
  s.cursor = 7;
  s.confirm();
  check(
    "cursor 7 SOURCE -> onSource(), screen stays MENU",
    srcHits === 1 && s.screen === SCREEN.MENU,
    srcHits + "/" + s.screen,
  );
```

In `tests/menudraw.test.mjs` (**re-read it first**), both items literals grow to
eight: add `ITEMS[7],` after `ITEMS[6],`, and `"DAILY",` after
`"LEVEL SELECT|CORE",` in the hard-coded literal. `:185`'s three-row literal is
**unmoved**.

In `tests/headless.test.mjs`, apply the five renegotiations from the table above.

In `tests/daily.test.mjs`, extend the imports and append:

```js
import { SCREEN, ITEMS, createMenuApp } from "../src/app/menuapp.js";
import { summaryLines, deltaLine, dailyLine } from "../src/render/scenes.js";
import { readFileSync } from "node:fs";

// ---- 7. slot 3: on a daily run the daily line REPLACES the delta line ----
{
  const W = { state: "LOSE", level: 3, score: 1840, heat: 0, pact: 0, pace: 0 };
  const plain = { r: 2, k: 5, p: 1, t: 90, best: { s: 500, r: 2 } };
  const daily = { ...plain, daily: TODAY, tries: 3, dbest: 1840 };
  check(
    "dailyLine is the exact locked copy, and YOUR is in it",
    dailyLine(W, daily) === "DAILY 2026-09-07 · NORM · TRY 3 · YOUR BEST 1840",
    dailyLine(W, daily),
  );
  check(
    "the pace token is printed, so the daily's pinned NORM is never a silent surprise",
    dailyLine({ ...W, pace: 1 }, daily) ===
      "DAILY 2026-09-07 · HARD · TRY 3 · YOUR BEST 1840",
    dailyLine({ ...W, pace: 1 }, daily),
  );
  const lp = summaryLines(W, plain);
  const ld = summaryLines(W, daily);
  check(
    "a NON-daily LOSE still emits the delta line — R1 is unchanged by this plan",
    lp.length === 2 && lp[1][0] === "NEW BEST",
    JSON.stringify(lp),
  );
  check(
    "a daily LOSE emits the daily line INSTEAD of the delta line",
    ld.length === 2 &&
      ld[1][0] === dailyLine(W, daily) &&
      ld[1][0] !== deltaLine(W, daily),
    JSON.stringify(ld),
  );
  check(
    "a daily MID-ROOM win emits neither — slot 3 is still run-end only",
    summaryLines({ ...W, state: "WIN" }, daily).length === 1,
    JSON.stringify(summaryLines({ ...W, state: "WIN" }, daily)),
  );
}

// ---- 8. the row, the pin, and the untouched startRun contract ----
{
  check("DAILY sits directly under LEVEL SELECT", ITEMS[2] === "DAILY", JSON.stringify(ITEMS));
  /* Written through indexOf so a future insert cannot silently re-point a row
     at the wrong screen — the failure mode stage 2 exists to catch. */
  const map = [["OPTIONS", SCREEN.SETTINGS], ["GUIDE", SCREEN.GUIDE],
    ["HIGH SCORES", SCREEN.SCORES], ["STATS", SCREEN.STATS], ["LEVEL SELECT", SCREEN.LEVEL]];
  const wrong = map.filter(([label, screen]) => {
    const a = createMenuApp();
    a.screen = SCREEN.MENU;
    a.cursor = ITEMS.indexOf(label);
    a.confirm();
    return a.screen !== screen;
  });
  check(
    "every MENU row still reaches its own screen after the stage-2 insert",
    !wrong.length,
    JSON.stringify(wrong.map(([l]) => l)),
  );
  const got = [];
  const a = createMenuApp({
    onStart: (x) => got.push(x),
    dailySeed: () => ({ seed: dailySeed(TODAY), date: TODAY }),
  });
  check("startDaily off MENU is a no-op", a.startDaily() === false, String(a.startDaily()));
  a.screen = SCREEN.MENU;
  a.level = 4;
  a.heat = 2;
  a.pact = 9;
  a.pace = -1;
  a.startDaily();
  check(
    "the daily config is PINNED even when the player's own picks are not default",
    got.length === 1 && got[0].level === 1 && got[0].heat === 0 &&
      got[0].pact === 0 && got[0].pace === 0 &&
      got[0].seed === dailySeed(TODAY) && got[0].daily === TODAY,
    JSON.stringify(got[0]),
  );
  check(
    "and it leaves LEVEL SELECT's own picks untouched for the next normal run",
    a.level === 4 && a.heat === 2 && a.pact === 9 && a.pace === -1,
    [a.level, a.heat, a.pact, a.pace].join(","),
  );
  check("startDaily entered GAME", a.screen === SCREEN.GAME);
  const b = createMenuApp({ onStart: () => {} });
  b.screen = SCREEN.MENU;
  check(
    "without o.dailySeed the row is inert rather than starting a bogus board",
    b.startDaily() === false && b.screen === SCREEN.MENU,
    String(b.screen),
  );
  const c = createMenuApp({ onStart: (x) => got.push(x) });
  c.screen = SCREEN.LEVEL;
  const args = c.startRun();
  check(
    "startRun's own args are UNCHANGED — no seed, no daily reaches a normal run",
    Object.keys(args).sort().join(",") === "heat,level,pace,pact",
    JSON.stringify(args),
  );
  check(
    "the row carries the honour-system marker as its value token",
    createMenuApp().dailyTag === "NEW" &&
      createMenuApp({ dailyTag: "PLAYED" }).dailyTag === "PLAYED",
    createMenuApp().dailyTag,
  );
  const shell = readFileSync("src/render/shellview.js", "utf8");
  check(
    "shellview renders the DAILY row with its tag, the label|value convention",
    /ITEMS\[2\] \+ "\|" \+ app\.dailyTag/.test(shell),
    (shell.match(/ITEMS\[2\][^\n]*/) || [])[0],
  );
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/daily.test.mjs tests/menuapp.test.mjs tests/menudraw.test.mjs tests/headless.test.mjs
```

Expected: FAIL — `daily.test.mjs` reports `a.startDaily is not a function`;
`menuapp.test.mjs` reports `ITEMS frozen, 8 entries` still at seven;
`headless.test.mjs` reports `C1 OPTIONS click pushes SETTINGS once -> 5`
(cursor 3 is GUIDE until `DAILY` lands, which is exactly the stage-2 shift these
five lines encode).

- [ ] **Step 3: Implement**

**3a — `src/app/menuapp.js`.** `ITEMS` gains one row at index 2:

```js
export const ITEMS = Object.freeze([
  "PLAY",
  "LEVEL SELECT",
  "DAILY",
  "OPTIONS",
  "GUIDE",
  "HIGH SCORES",
  "STATS",
  "SOURCE",
]);
```

In the app literal, beside `pace` / `timeAttack`:

```js
    dailyTag: o.dailyTag || "NEW",
```

`confirm()`'s MENU switch, after the `"LEVEL SELECT"` case:

```js
            case "DAILY":
              return this.startDaily();
```

and the method itself, beside `playFromAttract`:

```js
    /* The daily config is PINNED, not inherited: heat changes the roster, pact
       changes the item count and therefore the rng draw order, and pace scales
       player speed — the only claim this feature makes is that YOUR OWN
       attempts are comparable to each other. There is no DAILY screen: the
       standing record lives on STATS and the day's verdict on the run-end
       overlay. Without o.dailySeed the row is inert rather than starting a
       board derived from nothing. */
    startDaily() {
      if (this.screen !== SCREEN.MENU) return false;
      const d = o.dailySeed ? o.dailySeed() : null;
      if (!d) return false;
      return this._playCore({ level: 1, heat: 0, pact: 0, pace: 0,
                              seed: d.seed, daily: d.date });
    },
```

`_playCore` needs **no change** — it hands `args` straight to `onStart`, and
`startRun()` is not touched.

**3b — `src/render/shellview.js`.** The MENU `items:` literal grows to eight,
with the honour-system marker on the DAILY row, the same `label|value`
convention PLAY and LEVEL SELECT already use:

```js
          ITEMS[2] + "|" + app.dailyTag,
          ITEMS[3],
          ITEMS[4],
          ITEMS[5],
          ITEMS[6],
          ITEMS[7],
        ],
```

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test
```

Expected: all green, `tests/headless.test.mjs` included — if any C1 or I1 cue
check still fails, one of the five index drives was missed.

- [ ] **Step 5: PWA bump + commit**

```bash
git add src/app/menuapp.js src/render/shellview.js tests/daily.test.mjs tests/menuapp.test.mjs tests/menudraw.test.mjs tests/headless.test.mjs src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Add a DAILY row under LEVEL SELECT that starts the day's board immediately.

The report suggested LEVEL SELECT and the code refuses it on arithmetic: that
screen's unlocked foot is already 366px against an inner width of 368, its
modes gloss already sits 29px above the foot at the compact size, and a return
hook has to be on the screen a returning player actually lands on. Confirming
DAILY starts the run the way PLAY does — no second appended SCREEN, since the
standing record lives on STATS and the day's verdict on the run-end overlay.
The config is pinned rather than inherited, because the only claim the feature
makes is that a player's own attempts are comparable to each other. Inserting
at index two moves OPTIONS and GUIDE, so the index-driven menu confirms in
headless move with it in this same commit.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: the seed plumbing, the run-end line, and the share stamp

**Files:**
- Modify: `src/render/scenes.js` — `dailyLine`; `summaryLines`' slot-3 swap
- Modify: `src/main.js` — the `daily.js` import; `todayStr`; `dailyDate` /
  `dailyRec`; `app.dailyTag` at boot; `o.dailySeed`; `args.seed` / `args.daily`
  in `onStart`; the `nb.daily.v1` write inside `endRun`; `ro.run`'s three new
  keys; the daily branch of `KeyC`; STATS note 1 in `onStats` (**locate every
  edit by string**)
- Modify: `tests/daily.test.mjs` — append block 9
- Modify: `tests/headless.test.mjs` — the `main.js` line pin and its reason
  comment
- Modify: `MEMORY.md`, `src/pwa/shell.js:1`, `sw.js:3`

**Interfaces:**
- Consumes: `dailySeed`, `loadDaily`, `saveDaily`, `recordDaily`, `dailyTag`,
  `dailyStamp`, `paceToken`
- Produces: `dailyLine(world, run)`; `ro.run` gains `{daily, tries, dbest}`

- [ ] **Step 1: Write the failing tests**

Append to `tests/daily.test.mjs`:

```js
import { createGame } from "../src/main.js";

// ---- 9. main.js: the seed reaches the world, and a retry is another TRY ----
{
  const mem = new Map();
  const ls = { getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)) };
  const wrote = [];
  globalThis.window = { localStorage: ls, addEventListener() {} };
  globalThis.navigator = { clipboard: { writeText: (s) => { wrote.push(s); return Promise.resolve(); } } };
  /* main.js's todayStr is deliberately LOCAL, not the shipped UTC dateStr —
     a challenge day that flips at 5pm local is the confusion this feature
     exists to avoid. Recomputed here the same way, at the same instant. */
  const p2 = (n) => (n < 10 ? "0" + n : "" + n);
  const d0 = new Date();
  const local = d0.getFullYear() + "-" + p2(d0.getMonth() + 1) + "-" + p2(d0.getDate());
  try {
    const g = createGame(null, { seed: 12345 });
    g.app.cabinetSeen = true;
    g.app.skip();
    check("the row tag starts at NEW on a fresh cabinet", g.app.dailyTag === "NEW", g.app.dailyTag);
    g.app.cursor = ITEMS.indexOf("DAILY");
    g.app.confirm();
    check(
      "a DAILY run seeds the world from today's local date",
      g.app.screen === SCREEN.GAME && g.world.seed === dailySeed(local),
      g.world.seed + " vs " + dailySeed(local),
    );
    check(
      "and it runs CORE, pact 0, NORM regardless of the player's picks",
      (g.world.heat | 0) === 0 && (g.world.pact | 0) === 0 && (g.world.pace | 0) === 0,
      [g.world.heat, g.world.pact, g.world.pace].join(","),
    );
    let t = 1000;
    g.loop(t);
    g.world.score = 1200;
    g.world.state = "LOSE";
    g.loop((t += 16));
    check(
      "the LOSE edge writes nb.daily.v1 at TRY 1",
      loadDaily(ls).date === local && loadDaily(ls).played === 1 && loadDaily(ls).best === 1200,
      ls.getItem("nb.daily.v1"),
    );
    check("and the row tag flips to PLAYED", g.app.dailyTag === "PLAYED", g.app.dailyTag);
    const seedBefore = g.world.seed;
    g.world.state = "PLAY";
    g.loop((t += 16)); // LOSE -> PLAY: a retry, NOT a new challenge
    check(
      "a retry replays the SAME board — dailyDate must survive startRunState",
      g.world.seed === seedBefore,
      seedBefore + " -> " + g.world.seed,
    );
    g.world.score = 1840;
    g.world.state = "LOSE";
    g.loop((t += 16));
    check(
      "the retry counts as TRY 2 and raises the day's best",
      loadDaily(ls).played === 2 && loadDaily(ls).best === 1840,
      ls.getItem("nb.daily.v1"),
    );
    wrote.length = 0;
    g.input.onUiKey("KeyC");
    check(
      "C on a daily run copies the stamp, not the ordinary run payload",
      wrote.length === 1 && wrote[0] === dailyStamp(local, g.world.level | 0, 1840),
      JSON.stringify(wrote),
    );
    // a NON-daily run must never touch nb.daily.v1
    const before = ls.getItem("nb.daily.v1");
    g.app.toMenu();
    g.app.cursor = 0;
    g.app.confirm(); // PLAY: an ordinary run
    g.loop((t += 16));
    g.world.score = 9999;
    g.world.state = "LOSE";
    g.loop((t += 16));
    check(
      "an ordinary run never records into nb.daily.v1",
      ls.getItem("nb.daily.v1") === before,
      ls.getItem("nb.daily.v1"),
    );
    check(
      "and STATS note 1 now reads the standing daily record",
      (() => {
        g.app.toMenu();
        g.app.cursor = ITEMS.indexOf("STATS");
        g.app.confirm();
        return g.app.stats.notes.length === 2 &&
          g.app.stats.notes[0].indexOf("YOUR OWN ATTEMPTS ONLY") > 0;
      })(),
      JSON.stringify(g.app.stats && g.app.stats.notes),
    );
  } finally {
    delete globalThis.window;
    delete globalThis.navigator;
  }
}

// ---- 9b. the two seams that must not drift ----
{
  const src = readFileSync("src/main.js", "utf8");
  check(
    "todayStr is LOCAL and the shipped dateStr stays UTC — two helpers, not one",
    /toISOString\(\)\.slice\(0, 10\)/.test(src) && /getFullYear\(\)/.test(src),
    (src.match(/const todayStr[^\n]*/) || [])[0],
  );
  check(
    "the seed is applied BEFORE loadLevel, which reads it for both createRng and genBoard",
    (() => {
      const blk = (src.match(/const onStart = \(args\) => \{[\s\S]{0,600}/) || [""])[0];
      return blk.indexOf("world.seed = args.seed") > 0 &&
        blk.indexOf("world.seed = args.seed") < blk.indexOf("loadLevel(world, args.level");
    })(),
    (src.match(/world\.seed = args\.seed[^\n]*/) || [])[0],
  );
  check(
    "startRunState does NOT clear dailyDate — a retry is another attempt at the same board",
    !/startRunState[\s\S]{0,200}dailyDate = null/.test(src),
    (src.match(/dailyDate = [^\n]*/g) || []).join(" | "),
  );
  check(
    "src/core is untouched: the seed reaches the sim only through world.seed",
    (src.match(/world\.seed = /g) || []).length === 1,
    (src.match(/world\.seed = [^\n]*/g) || []).join(" | "),
  );
}
```

- [ ] **Step 2: Run to see FAIL**

```bash
node --test tests/daily.test.mjs
```

Expected: FAIL — `does not provide an export named 'dailyLine'` (block 7 already
imports it), and block 9 reports `g.app.dailyTag -> NEW` but
`g.world.seed` still the boot seed.

- [ ] **Step 3: Implement**

**3a — `src/render/scenes.js`.** Add after `summaryLines`:

```js
/* On a daily run this REPLACES the delta line in slot 3: the day's comparison
   is the one that matters that day, and the nb.bests.v1 write still happens so
   nothing is lost from the record. The pace token is printed because the daily
   pins NORM and ignores the player's own pace — an ignored setting is shown,
   never swallowed. "YOUR" is the honesty word and it is free. */
export function dailyLine(world, run) {
  const w = world || {}, r = run || {};
  return (
    "DAILY " + r.daily + " · " + paceToken(w.pace) +
    " · TRY " + (r.tries | 0) + " · YOUR BEST " + (r.dbest | 0)
  );
}
```

and swap slot 3 inside `summaryLines`:

```js
  if (isRunEnd(world)) {
    if (run.daily) out.push([dailyLine(world, run), "#9fb3d8"]);
    else {
      const [s, hot] = deltaOf(world || {}, run);
      out.push([s, hot ? "#37f0d0" : "#9fb3d8"]);
    }
  }
```

`dailyLine` must be declared **above** `summaryLines` or hoisted — function
declarations hoist, so either order works; keep it directly after
`summaryLines` for readability.

**3b — `src/main.js`.** Every edit located **by string**.

Import:

```js
import { dailySeed, loadDaily, saveDaily, recordDaily, dailyTag, dailyStamp } from "./app/daily.js";
```

The local-date helper, directly beneath `const dateStr = …`:

```js
  const todayStr = () => { const d = new Date(), p = (n) => (n < 10 ? "0" + n : "" + n);
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); };
```

`dateStr` is **not** touched: it stamps the high-score `d` column and changing
it would re-interpret every persisted row.

Declarations, beside the R1 run-state block:

```js
  let dailyDate = null, dailyRec = loadDaily();
```

`createMenuApp` options, beside `onStats`:

```js
    dailySeed: () => { const d = todayStr(); return { seed: dailySeed(d), date: d }; },
```

and, immediately after `settings = app.settings;`:

```js
  app.dailyTag = dailyTag(dailyRec, todayStr());
```

`onStart`, **before** `loadLevel(world, args.level, false)` — which reads
`w.seed` for both `createRng` and `genBoard` (`world.js:74-75`):

```js
    if (args && args.seed != null) world.seed = args.seed >>> 0;
    dailyDate = (args && args.daily) || null;
```

inside `endRun`, after the `stat("run_end", …)` line:

```js
    if (dailyDate) { dailyRec = recordDaily(loadDaily(), dailyDate, world.score | 0, world.level | 0, world.pace | 0);
      saveDaily(dailyRec); app.dailyTag = dailyTag(dailyRec, dailyDate); }
```

`ro.run` gains the three daily fields:

```js
              run: { r: tally.r, k: tally.k, p: tally.p, t: runT, best: bestRun,
                     daily: dailyDate, tries: dailyRec.played, dbest: dailyRec.best },
```

`tries` and `dbest` are read **after** `endRun`'s write, so the line states the
standing record including this run — which is what is true at the moment it is
drawn.

the `KeyC` GAME branch copies the stamp on a daily run:

```js
        if (world.state === "WIN" || world.state === "LOSE") copyText(dailyDate ? dailyStamp(dailyDate, world.level | 0, world.score | 0) : copyPayload(world));
```

and `onStats` now has a daily record to hand `statsNotes`:

```js
      app.stats = { rows: statsRows(sv, loadBests()), notes: statsNotes(sv, dailyRec, todayStr()) }; },
```

**3c — the line pin.** Append one reason line and raise the number in **both**
the label and the assertion:

```js
  // R3 daily wave: +12 lines (daily.js import; the local todayStr beside the
  // UTC dateStr; dailyDate/dailyRec; app.dailyTag at boot; o.dailySeed; the
  // seed and daily stamp in onStart; the nb.daily.v1 write in endRun; ro.run's
  // three daily fields) — bumped 770->782.
  check("main.js stays a lean browser entry (<=782 lines)",
    L.length<=782,String(L.length));
```

- [ ] **Step 4: Run to PASS — full battery**

```bash
node --test
```

Expected: all green.

- [ ] **Step 5: Headed play-verify**

Unregister the service worker and delete its caches first. Then on
`http://127.0.0.1:8080/index.html`, in **both** CLASSIC 2D and `?render=3d`:

1. **The MENU row** reads `DAILY  NEW` with the value token in accent, exactly
   like `PLAY  CORE`. It fits at both plate sizes with eight rows.
2. **Confirm DAILY.** The run starts immediately at room 1 CORE. Note the board.
3. **Die.** The run-end line reads
   `DAILY <today> · NORM · TRY 1 · YOUR BEST <score>` — and the **delta line is
   not there**; the daily line took its slot.
4. **Retry from the LOSE screen.** The board is **identical** — same brick
   layout, same spawns. The second run-end line reads `TRY 2` and `YOUR BEST` is
   the higher of the two.
5. **Back to MENU:** the row now reads `DAILY  PLAYED`.
6. **`C` on the run-end overlay** copies `DAILY <today> · L<n> · <score> · <url>`
   — paste it to check. No code, no `leaderboard`, no claim.
7. **STATS note 1** reads `DAILY <today> · BEST <n> · 2 TRIES · YOUR OWN
   ATTEMPTS ONLY`.
8. **Set pace to EASY on LEVEL SELECT, then play the daily.** It runs at NORM and
   the run-end line **says** `NORM` — the ignored setting is shown, not
   swallowed.
9. **An ordinary PLAY run** still shows the delta line, not the daily line.

- [ ] **Step 6: PWA bump, MEMORY, commit**

Read `src/pwa/shell.js:1`, bump `CACHE_NAME` + `sw.js:3` `REV` together. Append
to `MEMORY.md` under a new `## 2026-09-07 — R3 daily challenge` heading (newest
first, 1–2 lines): that a `DAILY` MENU row starts a CORE room-1 run seeded by a
pure FNV-1a hash of the **local** date (the shipped UTC `dateStr` is untouched
because it stamps persisted high-score rows), recorded in `nb.daily.v1` with the
pace it ran at; that a LOSE retry deliberately replays the same board and counts
as another try; and that the feature is honour-system and single-device by
decision — enforcement is refused, and the copy says `YOUR OWN ATTEMPTS ONLY`.

```bash
git add src/render/scenes.js src/main.js tests/daily.test.mjs tests/headless.test.mjs MEMORY.md src/pwa/shell.js sw.js
git commit -m "$(cat <<'EOF'
Seed the daily run from the local date and show the day's verdict, not a rank.

The seed reaches the sim the one way this wave allows — world.seed, which
createWorld and loadLevel already read — so src/core is untouched and the
replay baseline holds. The date is local while the shipped dateStr stays UTC:
changing that helper would re-interpret every persisted high-score row, and a
challenge day that flips at 5pm local is exactly the confusion this feature
exists to avoid. A retry from the LOSE screen replays the same board on
purpose, so dailyDate survives the run-state reset and the attempt counts up.
On a daily run the daily line takes slot 3 from the delta line, because the
day's comparison is the one that matters that day, and the bests write still
happens underneath.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```
