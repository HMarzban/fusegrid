import { readFileSync } from "node:fs";
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
import { newTally, feedTally, recordBest } from "../src/app/bests.js";
import { SCREEN, ITEMS, createMenuApp } from "../src/app/menuapp.js";
import { statsRows, statsNotes } from "../src/app/stats.js";
import * as md from "../src/render/menudraw.js";

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
  const src2 = readFileSync("src/render/shellview.js", "utf8");
  check(
    "shellview's MENU items literal renders every shipped row",
    (src2.match(/ITEMS\[\d\]/g) || []).length === ITEMS.length,
    (src2.match(/ITEMS\[\d\]/g) || []).join(","),
  );
}

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

console.log("\n  STATS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
