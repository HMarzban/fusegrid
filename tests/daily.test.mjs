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

import { SCREEN, ITEMS, createMenuApp } from "../src/app/menuapp.js";
import { readFileSync } from "node:fs";

/* Block 7 (slot-3 dailyLine/summaryLines swap) is deferred to Task 3's append:
   it imports dailyLine from src/render/scenes.js, which Task 3 creates — the
   plan's Files list for Task 3 owns "scenes.js — dailyLine; summaryLines' slot-3
   swap", so the test moves with its implementation owner rather than leaving
   this file (and therefore `npm test`) red for the length of Task 2's commit. */

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

console.log("\n  DAILY RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
