import {
  DAILY_KEY,
  dailySeed,
  clampDaily,
  loadDaily,
  saveDaily,
  recordDaily,
  dailyTag,
  dailyStamp,
  finishDaily,
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
     boards. The avalanche is what this assertion is really testing. */
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

// ---- 4b. Minor-2 (review 2026-09-07, owner ruling): a stamp mismatch is
// ABSENT, refused rather than silently compared ----
{
  const same = recordDaily({ date: TODAY, best: 500, played: 2, room: 2, pace: 1 }, TODAY, 300, 1, 0);
  check(
    "MATCH path: same date, same stamped pace — accumulates normally",
    same.played === 3 && same.best === 500 && same.pace === 1,
    JSON.stringify(same),
  );
  // stamped under a DIFFERENT pin (pace 2 = HARD) than this run just used (0 = NORM)
  const mismatch = recordDaily({ date: TODAY, best: 9999, played: 5, room: 8, pace: 2 }, TODAY, 100, 1, 0);
  check(
    "MISMATCH path: a record stamped under a different pace pin is ABSENT — TRY 1, no cross-pin comparison",
    mismatch.date === TODAY && mismatch.played === 1 && mismatch.pace === 1,
    JSON.stringify(mismatch),
  );
  check(
    "the mismatched run's result REPLACES the record — never silently kept the old (higher) best",
    mismatch.best === 100,
    String(mismatch.best),
  );
}

// ---- 4c. Minor-4 (review 2026-09-07, owner ruling): the record AND the tag
// returned alongside it both belong to the run's START date — never any
// other date. finishDaily is endRun's one write, in daily.js, so this is
// structural (one shared date param), not a convention two call sites could
// drift apart on. ----
{
  const st = mapStore();
  const f = finishDaily("2026-09-06", 1200, 3, 0, st);
  check(
    "the daily record belongs to the run's START date",
    f.rec.date === "2026-09-06" && f.rec.played === 1 && f.rec.best === 1200,
    JSON.stringify(f.rec),
  );
  check(
    "the tag returned alongside it is computed against that SAME start date — PLAYED",
    f.tag === "PLAYED",
    f.tag,
  );
  check(
    "but that record read back against the actual NEW day is NEW — the row is not stuck PLAYED forever",
    dailyTag(f.rec, "2026-09-07") === "NEW",
    dailyTag(f.rec, "2026-09-07"),
  );
  check(
    "finishDaily persists the record through the injected store",
    loadDaily(st).date === "2026-09-06" && loadDaily(st).best === 1200,
    JSON.stringify(loadDaily(st)),
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
    /* R8 deviation: written by concatenation, not as a literal regex — this
       file is scoped by tests/banned-name.test.mjs's new R8 gate, and the
       refused word spelled out in the source text would trip its own scan. */
    "and it never carries the refused word",
    !dailyStamp(TODAY, 3, 1840).toLowerCase().includes("leader" + "board"),
  );
}

import { SCREEN, ITEMS, createMenuApp } from "../src/app/menuapp.js";
import { summaryLines, deltaLine, dailyLine } from "../src/render/scenes.js";
import { readFileSync } from "node:fs";

// ---- 7. slot 3: on a daily run the daily line REPLACES the delta line ----
{
  const W = { state: "LOSE", level: 3, score: 1840, heat: 0, pact: 0, pace: 0 };
  // best.r matches world.level(3) so FURTHEST ROOM YET does not also fire —
  // this block isolates the delta-vs-daily slot-3 swap, not deltaLine's own
  // five-form table (covered by bests.test.mjs).
  const plain = { r: 2, k: 5, p: 1, t: 90, best: { s: 500, r: 3 } };
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

import { createGame } from "../src/main.js";

// ---- 9. main.js: the seed reaches the world, and a retry is another TRY ----
{
  const mem = new Map();
  const ls = { getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)) };
  const wrote = [];
  globalThis.window = { localStorage: ls, addEventListener() {} };
  // Node >=21 ships a getter-only globalThis.navigator; redefine it rather
  // than assign, and restore the original descriptor in the finally below.
  const origNavDesc = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    value: { clipboard: { writeText: (s) => { wrote.push(s); return Promise.resolve(); } } },
    configurable: true,
  });
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
    if (origNavDesc) Object.defineProperty(globalThis, "navigator", origNavDesc);
    else delete globalThis.navigator;
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
    /* Nit-1 (review 2026-09-07): widened {0,600} -> {0,1400} to match
       bests.test.mjs's B2b — the same hazard, so a later wave's onStart
       growth cannot turn this falsely RED the way the review demonstrated. */
    "the seed is applied BEFORE loadLevel, which reads it for both createRng and genBoard",
    (() => {
      const blk = (src.match(/const onStart = \(args\) => \{[\s\S]{0,1400}/) || [""])[0];
      return blk.indexOf("world.seed = args") > 0 &&
        blk.indexOf("world.seed = args") < blk.indexOf("loadLevel(world, args.level");
    })(),
    (src.match(/world\.seed = [^\n]*/) || [])[0],
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
  check(
    "Minor-1 (owner ruling): a seedless run falls back to the REMEMBERED boot seed, not a fresh draw",
    /world\.seed = args && args\.seed != null \? args\.seed >>> 0 : bootSeed;/.test(src),
    (src.match(/world\.seed = args[^\n]*/) || [])[0],
  );
  check(
    "Minor-4 (owner ruling): endRun's write is keyed on dailyDate — the run's START date — never today's date",
    /finishDaily\(\s*dailyDate\s*,/.test(src),
    (src.match(/finishDaily\([^)]*\)/) || [])[0],
  );
}

// ---- 9c. Minor-1 (review 2026-09-07, owner ruling): "a run that supplies no
// seed plays the seed the session booted with" — two ordinary runs (and a
// LEVEL SELECT run) bracketing a daily all share ONE seed, and it is the
// boot seed, never the daily's. ----
{
  const mem = new Map();
  const ls = { getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)) };
  globalThis.window = { localStorage: ls, addEventListener() {} };
  const p2 = (n) => (n < 10 ? "0" + n : "" + n);
  const d0 = new Date();
  const local = d0.getFullYear() + "-" + p2(d0.getMonth() + 1) + "-" + p2(d0.getDate());
  try {
    const g = createGame(null, { seed: 777 });
    g.app.cabinetSeen = true;
    g.app.skip();
    const boot = g.world.seed;
    g.app.cursor = ITEMS.indexOf("PLAY");
    g.app.confirm(); // ordinary PLAY, before any daily
    const ordBefore = g.world.seed;
    g.app.toMenu();
    g.app.cursor = ITEMS.indexOf("DAILY");
    g.app.confirm(); // DAILY
    const daily = g.world.seed;
    g.app.toMenu();
    g.app.cursor = ITEMS.indexOf("PLAY");
    g.app.confirm(); // ordinary PLAY, after the daily
    const ordAfter = g.world.seed;
    g.app.toMenu();
    g.app.cursor = ITEMS.indexOf("LEVEL SELECT");
    g.app.confirm(); // -> SCREEN.LEVEL
    g.app.confirm(); // -> startRun()
    const lvlAfter = g.world.seed;
    check(
      "two ordinary runs bracketing a daily share a seed, and it is the boot seed",
      boot === 777 && ordBefore === 777 && daily === dailySeed(local) &&
        ordAfter === 777 && lvlAfter === 777,
      [boot, ordBefore, daily, ordAfter, lvlAfter].join(" -> "),
    );
  } finally {
    delete globalThis.window;
  }
}

// ---- 9d. Minor-3 (review 2026-09-07, owner ruling): ro.run.{tries,dbest}
// reach the LOSE overlay's actual pixels, end to end — the reviewer's own
// recording-canvas prototype, driving a real createGame through a
// fillText-recording canvas proxy (the same pattern as
// tests/headless.test.mjs:112 / :551). Kills M9 (tries: played+1) and M21
// (dbest: 0), both of which survived the whole suite before this. ----
{
  const mem = new Map();
  const ls = { getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)) };
  globalThis.window = { localStorage: ls, addEventListener() {} };
  const p2 = (n) => (n < 10 ? "0" + n : "" + n);
  const d0 = new Date();
  const local = d0.getFullYear() + "-" + p2(d0.getMonth() + 1) + "-" + p2(d0.getDate());
  // pre-seed a standing record so this run's TRY/BEST are a genuine
  // accumulation (3/1840), never a fresh day's 1/score — the numbers a
  // mutated ro.run.tries/dbest (M9/M21) could otherwise fake by accident.
  ls.setItem(DAILY_KEY, JSON.stringify({ date: local, best: 900, played: 2, room: 3, pace: 1 }));
  const texts = [];
  const rec = new Proxy(function () {}, {
    get: (t, p) => {
      if (p === Symbol.toPrimitive) return () => "";
      return (...a) => { if (p === "fillText") texts.push(String(a[0])); return rec; };
    },
    apply: () => rec,
    set: () => true,
  });
  const fake = { getContext: () => rec, addEventListener() {}, style: {} };
  try {
    const g = createGame(fake, { seed: 777 });
    g.app.cabinetSeen = true;
    g.app.skip();
    g.app.cursor = ITEMS.indexOf("DAILY");
    g.app.confirm();
    let t = 1000;
    g.loop(t);
    g.world.score = 1840;
    g.world.state = "LOSE";
    g.loop((t += 16));
    check(
      "ro.run.tries/dbest reach the LOSE overlay pixels exactly — TRY 3, YOUR BEST 1840 (kills M9 and M21)",
      texts.indexOf("DAILY " + local + " · NORM · TRY 3 · YOUR BEST 1840") >= 0,
      JSON.stringify(texts),
    );
  } finally {
    delete globalThis.window;
  }
}

// ---- 9e. Nit-3 (review 2026-09-07): Ruling 4's second half — "the row for
// the new day reads NEW" — pinned end to end through main.js:292's boot
// re-derivation, `app.dailyTag = dailyTag(dailyRec, todayStr())`. No clock
// faked: yesterday/today are computed from the real Date, the same way
// 9/9c/9d compute "local". Paired with a today-dated positive control so
// "NEW" is a real read of the planted record, not a vacuous fresh-cabinet
// default (block 9:393 already covers the no-record case) — the control
// proves a planted store reaches main's dailyRec at boot at all, which makes
// the NEW half load-bearing rather than trivially satisfiable. ----
{
  const p2 = (n) => (n < 10 ? "0" + n : "" + n);
  const d0 = new Date();
  const local = d0.getFullYear() + "-" + p2(d0.getMonth() + 1) + "-" + p2(d0.getDate());
  const y0 = new Date();
  y0.setDate(y0.getDate() - 1);
  const yesterday = y0.getFullYear() + "-" + p2(y0.getMonth() + 1) + "-" + p2(y0.getDate());

  const mem = new Map();
  const ls = { getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)) };
  ls.setItem(DAILY_KEY, JSON.stringify({ date: yesterday, best: 4200, played: 3, room: 5, pace: 1 }));
  globalThis.window = { localStorage: ls, addEventListener() {} };
  try {
    const g = createGame(null, { seed: 777 });
    check(
      "a fresh boot re-derives the row tag against TODAY, not a stale stamped record — NEW",
      g.app.dailyTag === "NEW",
      g.app.dailyTag,
    );
  } finally {
    delete globalThis.window;
  }

  const mem2 = new Map();
  const ls2 = { getItem: (k) => (mem2.has(k) ? mem2.get(k) : null),
    setItem: (k, v) => mem2.set(k, String(v)) };
  ls2.setItem(DAILY_KEY, JSON.stringify({ date: local, best: 4200, played: 3, room: 5, pace: 1 }));
  globalThis.window = { localStorage: ls2, addEventListener() {} };
  try {
    const g2 = createGame(null, { seed: 777 });
    check(
      "positive control: a TODAY-dated planted record does reach dailyRec at boot — PLAYED",
      g2.app.dailyTag === "PLAYED",
      g2.app.dailyTag,
    );
  } finally {
    delete globalThis.window;
  }
}

console.log("\n  DAILY RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
