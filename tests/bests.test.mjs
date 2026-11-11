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
import {
  fmtSpan,
  bestLabel,
  isRunEnd,
  drawOverlay,
  fmtTime,
} from "../src/render/scenes.js";
import { readFileSync } from "node:fs";
import { createGame } from "../src/main.js";
import { PAUSE_ITEMS } from "../src/app/menuapp.js";
import { rec as krec } from "./lib/textrec.mjs";
import * as kprobe from "../src/render/kit/probe.js";
import { endGeom, endFacts } from "../src/render/pages/endgeom.js";
/* v202 Task 5.4: the run-end line is GAME OVER's tail (endgeom.endFacts): the plaque's words, the shortfall or matched sentence, "" for none */
const tailOf = (w, run) => { const t = endFacts({ state: "LOSE", ...w }, run).tail; return !t ? "" : t.kind === "plaque" ? t.text[0] : t.text; };
import * as lazyPages from "../src/render/pages/lazy.js";
import * as endWin from "../src/render/pages/endwin.js";
lazyPages._set("endwin", endWin); // WIN is a lazy page (v202 Task 5.3): handed in as if its import had landed
import * as endLose from "../src/render/pages/endlose.js";
lazyPages._set("endlose", endLose); // GAME OVER is a lazy page (v202 Task 5.4)
import "../src/core/board3.js";

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
    /* clampPact is the &15 bitmask pinned at pact.js:5 (never a saturating
       range clamp), so 999 & 15 === 7 — bestKey must pass junk straight
       through the real, frozen clamp rather than invent its own ceiling. */
    bestKey({ heat: 99, pact: 999, pace: 9 }) === "2:7:2" &&
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
    Object.keys(t).sort().join(",") === "b,d,dNew,dr,k,kt,lv,mn,p,pk,r" &&
      t.r === 0 && t.k === 0 && t.p === 0 && t.b === 0 && t.d === 0 &&
      t.dNew === 0 && t.lv === null && t.mn === 0,
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

// ---- 5b. a HEART in the same batch cannot mask a lost life (R6 review) ----
{
  const heart = { t: "power", kind: "heart" };
  const t = newTally();
  feedTally(t, { lives: 3, level: 1, events: [] });
  feedTally(t, { lives: 3, level: 1, events: [heart, { t: "hurt" }] });
  check("lives level + one heart power is ONE life lost", t.d === 1 && t.dNew === 1 && t.dr[1] === 1, JSON.stringify(t));
  const u = newTally();
  feedTally(u, { lives: 3, level: 1, events: [] });
  feedTally(u, { lives: 4, level: 1, events: [heart] });
  check("one heart with lives+1 is no death", u.d === 0 && u.dNew === 0 && u.lv === 4, JSON.stringify(u));
  const v = newTally();
  feedTally(v, { lives: 3, level: 2, events: [] });
  feedTally(v, { lives: 2, level: 2, events: [{ t: "hurt" }, heart, { t: "hurt" }] });
  check("two hurts and one heart is d += 2", v.d === 2 && v.dNew === 2 && v.dr[2] === 2, JSON.stringify(v));
  const s = newTally();
  feedTally(s, { lives: 3, level: 1, events: [] });
  feedTally(s, { lives: 4, level: 1, events: [heart, { t: "hurt" }] });
  check("a heart with a SHIELDED hurt is no death", s.d === 0 && s.dNew === 0, JSON.stringify(s));
}

/* rows: [text, y] for every fillText/strokeText call, added NON-destructively
   beside texts (Minor-1 fix: the review found dy 20/44/68/92/116 entirely
   unpinned — every existing overlay pin here and elsewhere is string-presence
   only, since fillText's x/y were discarded). Old callers reading .texts are
   unaffected. */
const rec = () => {
  const texts = [];
  const rows = [];
  const noop = () => {};
  const c = {
    save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
    arcTo: noop, bezierCurveTo: noop, quadraticCurveTo: noop, ellipse: noop,
    fill: noop, stroke: noop, fillRect: noop, strokeRect: noop,
    fillText: (s, x, y) => { texts.push(String(s)); rows.push([String(s), y]); },
    strokeText: (s, x, y) => { texts.push(String(s)); rows.push([String(s), y]); },
  };
  return { c, texts, rows };
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
    bestLabel({ heat: 0, pact: 0, pace: 0 }) === "NORMAL DIFFICULTY" &&
      bestLabel({ heat: 1, pact: 3, pace: 1 }) === "HARD DIFFICULTY · FAST SPEED · ONE LIFE · NO FLOOR ITEMS" &&
      bestLabel({ heat: 2, pact: 15, pace: -1 }) === "EXPERT DIFFICULTY · SLOW SPEED · ONE LIFE · NO FLOOR ITEMS · FEWER ITEMS · SHRINK",
    bestLabel({ heat: 1, pact: 3, pace: 1 }),
  );
  const W = { level: 3, score: 1000, heat: 0, pact: 0, pace: 0 };
  // v202 Task 5.4: the five forms are GAME OVER's tail now (endFacts), one quiet plaque for a record, the shortfall saved to saved
  check(
    "form 1: furthest level, no new score -> the FURTHEST LEVEL YET plaque",
    tailOf(W, { best: { s: 2000, r: 2 } }) === "FURTHEST LEVEL YET",
    tailOf(W, { best: { s: 2000, r: 2 } }),
  );
  check(
    "form 2: new score, same depth -> the NEW BEST plaque naming the bucket",
    tailOf(W, { best: { s: 500, r: 3 } }) === "NEW BEST · NORMAL DIFFICULTY",
    tailOf(W, { best: { s: 500, r: 3 } }),
  );
  check(
    "form 3: both, and every first-ever run on a bucket -> one plaque, NEW BEST (never two records merged)",
    tailOf(W, { best: { s: 500, r: 2 } }) === "NEW BEST · NORMAL DIFFICULTY" &&
      tailOf(W, { best: null }) === "NEW BEST · NORMAL DIFFICULTY",
    tailOf(W, { best: null }),
  );
  check(
    "form 4: an exact tie names the bucket and the saved best, never a delta",
    tailOf(W, { best: { s: 1000, r: 3 } }) === "Matched your NORMAL DIFFICULTY best (1,000).",
    tailOf(W, { best: { s: 1000, r: 3 } }),
  );
  check(
    "form 5: short of it -> the gap in saved points, the saved best named",
    tailOf({ ...W, score: 858 }, { best: { s: 1000, r: 5 } }) ===
      "142 points short of your NORMAL DIFFICULTY best (1,000).",
    tailOf({ ...W, score: 858 }, { best: { s: 1000, r: 5 } }),
  );
  check(
    "form 5 is unreachable when forms 1-3 fired: no negative gap can print",
    !/-\d|points short/.test(tailOf(W, { best: { s: 500, r: 2 } })) &&
      !/-\d|points short/.test(tailOf({ ...W, score: 5000 }, { best: { s: 1000, r: 5 } })),
    tailOf({ ...W, score: 5000 }, { best: { s: 1000, r: 5 } }),
  );
}

// ---- 9. the run's tally (was runLine): the finale's stat cards, never bricks ----
{
  const F = endFacts({ state: "WIN", level: 5, score: 10, heat: 0 }, { r: 4, k: 27, p: 9, b: 99, t: 761 });
  check(
    "the run's tally is the finale's ENEMIES / POWER-UPS / TIME (v202 Task 5.3; was runLine's LEVELS · KILLS · POWER-UPS · time)",
    JSON.stringify(F.stats) === JSON.stringify([["foe", "ENEMIES", "27"], ["item", "POWER-UPS", "9"], ["clock", "TIME", "12:41"]]),
    JSON.stringify(F.stats),
  );
  check(
    "the tally does NOT show bricks: they ride R5's payload",
    !JSON.stringify(F).includes("99"),
    JSON.stringify(F.stats),
  );
}

// ---- 10. the run-end gate (was summaryLines): claims only at a run end ----
{
  const W = { state: "WIN", level: 3, score: 1000, heat: 0, pact: 0, pace: 0 };
  const run = { r: 2, k: 5, p: 1, t: 90, best: { s: 500, r: 3 } };
  const claims = (w, r) => { const F = endFacts(w, r); return [...F.pieces.map((q) => q.kind + ":" + [].concat(q.name)[0]), ...(F.tail ? [F.tail.kind] : []), ...(F.note ? ["note"] : [])]; };
  check("no run (ATTRACT): no claim", claims(W, undefined).length === 0 && claims({ ...W, state: "LOSE" }, undefined).length === 0);
  check(
    "a mid-room WIN claims nothing about the score (a level clear has no score piece)",
    claims(W, run).length === 0,
    JSON.stringify(claims(W, run)),
  );
  check(
    "a LOSE and a finale WIN each claim the record once",
    JSON.stringify(claims({ ...W, state: "LOSE" }, run)) === JSON.stringify(["plaque"]) && JSON.stringify(claims({ ...W, level: 5 }, run)) === JSON.stringify(["rib:SCORE · NORMAL DIFFICULTY"]),
    JSON.stringify([claims({ ...W, state: "LOSE" }, run), claims({ ...W, level: 5 }, run)]),
  );
  check(
    "a record shows only when one actually fell: under the best, GAME OVER prints the shortfall, never the plaque",
    endFacts({ ...W, state: "LOSE", score: 100 }, run).tail.kind === "short",
    JSON.stringify(endFacts({ ...W, state: "LOSE", score: 100 }, run).tail),
  );
  const md = { ...run, medals: [["IRON CROWN", "LEVELS 6-8 IN ONE RUN ON EXPERT DIFFICULTY"]] };
  check(
    "R6: a finale hangs the newly saved medal last, after the score record",
    JSON.stringify(claims({ ...W, level: 8 }, md)) === JSON.stringify(["rib:SCORE · NORMAL DIFFICULTY", "medal:IRON CROWN"]),
    JSON.stringify(claims({ ...W, level: 8 }, md)),
  );
  check(
    "R6: no medals adds no piece, and a mid-room WIN with medals set hangs none",
    JSON.stringify(claims({ ...W, level: 8 }, run)) === JSON.stringify(["rib:SCORE · NORMAL DIFFICULTY"]) && claims(W, md).length === 0,
    JSON.stringify([claims({ ...W, level: 8 }, run), claims(W, md)]),
  );
  check(
    "R6: on a daily finale the day's line replaces the score record and the medal still hangs",
    JSON.stringify(claims({ ...W, level: 5 }, { ...md, daily: "2026-10-08", tries: 1, dbest: 0 })) === JSON.stringify(["medal:IRON CROWN", "note"]) && /^DAILY 2026-10-08 /.test(endFacts({ ...W, level: 5 }, { ...md, daily: "2026-10-08", tries: 1, dbest: 0 }).note),
    JSON.stringify(claims({ ...W, level: 5 }, { ...md, daily: "2026-10-08", tries: 1, dbest: 0 })),
  );
}

// ---- 11. drawOverlay: the 9th arg is optional; absent is byte-identical ----
{
  const W = { state: "WIN", level: 3, finale: false, score: 10, heat: 0 };
  const ks = (R) => R.texts.map((t) => t.s);
  const a = krec();
  drawOverlay(a.ctx, W, 600, 520, 300, 260, undefined, undefined);
  const b = krec();
  drawOverlay(b.ctx, W, 600, 520, 300, 260);
  check(
    "drawOverlay WIN with no run (ATTRACT) draws the level clear and no claim: no NEW BEST, no record piece",
    ks(a).join("|") === ks(b).join("|") &&
      ks(a).includes("LEVEL 3 CLEAR") &&
      !ks(a).includes("NEW BEST"),
    ks(a).join("|"),
  );
  const r = krec();
  drawOverlay(r.ctx, W, 600, 520, 300, 260, undefined, undefined, {
    r: 2, k: 5, p: 1, t: 90, best: null, lk: 3, lp: 1,
  });
  check(
    "drawOverlay WIN with a run shows this level's ENEMIES / POWER-UPS and claims nothing mid-room",
    ks(r).includes("ENEMIES") && ks(r).includes("3") && ks(r).includes("POWER-UPS") && ks(r).includes("1") &&
      !ks(r).includes("NEW BEST"),
    ks(r).join("|"),
  );
  const L = krec();
  drawOverlay(L.ctx, { state: "LOSE", level: 3, score: 1000, heat: 0 },
    600, 520, 300, 260, undefined, undefined,
    { r: 2, k: 5, p: 1, t: 90, best: { s: 500, r: 3 }, css: 1.38 });
  check(
    // v202 Task 5.4: GAME OVER reads "Reached level n of m." (the run's reach) and a record is its quiet plaque
    "drawOverlay LOSE with a run shows how far it reached AND the record it set (the NEW BEST plaque)",
    ks(L).includes("Reached level 3 of 5.") &&
      ks(L).some((s) => s === "NEW BEST · NORMAL DIFFICULTY" || s === "NEW BEST"),
    ks(L).join("|"),
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
  const f = krec();
  drawOverlay(f.ctx, { ...W, level: 5 }, 600, 520, 300, 260, undefined, undefined, { r: 5, k: 5, p: 1, t: 90, best: null, et: 9 });
  check(
    // R8, then v202 Task 5.3: the copy keys are keys now, label first, keycap last
    "the finale's copy keys read COPY RESULT … C and COPY MAP … B",
    ["COPY RESULT", "C", "COPY MAP", "B"].every((q) => ks(f).includes(q)) && ks(f).indexOf("C") > ks(f).indexOf("COPY RESULT") && ks(f).indexOf("B") > ks(f).indexOf("COPY MAP"),
    ks(f).join("|"),
  );
}

// ---- 12. Minor-1 fix (review 2026-09-07): pin the summary block's vertical
// layout. Every overlay pin above is string-presence only (fillText's x/y
// were discarded); this is the first pin that would catch a pitch or offset
// mutation to the dy 20/44/68/92/116 stack. ----
{
  const boxes = [
    { w: 600, h: 520, cx: 300, cy: 260 },
    { w: 608, h: 352, cx: 304, cy: 188 },
  ];
  const run = { r: 2, k: 5, p: 1, t: 90, best: { s: 500, r: 3 } };
  for (const B of boxes) {
    const tag = B.w + "x" + B.h;
    // LOSE (v202 Task 5.4: endgeom's sections, paged on a short box): kicker, headline, reached, score, the plaque, TRY AGAIN, top to bottom
    // across its pages, every text inside the box
    const lat = {}, lin = [];
    for (let page = 0; page < 8; page++) {
      const L = krec(); kprobe.setOn(true);
      drawOverlay(L.ctx, { state: "LOSE", level: 3, score: 1000, heat: 0, pact: 0, pace: 0 }, B.w, B.h, B.cx, B.cy, undefined, undefined, { ...run, page });
      const S = kprobe.snapshot(); kprobe.setOn(false);
      for (const t of S.texts) { if (!(t.s in lat)) lat[t.s] = [page, t.y]; if (!(t.y >= 0 && t.y + t.capH <= B.h && t.x >= 0 && t.x + t.w <= B.w)) lin.push(t.s); }
      const G = endGeom(B, endFacts({ state: "LOSE", level: 3, score: 1000, heat: 0, pact: 0, pace: 0 }, { ...run, page }), { page, m: krec().ctx });
      for (const [sec, q] of [["head", "GAME OVER"], ["reached", "Reached level 3 of 5."], ["score", "SCORE"], ["tail", null]]) {
        const r = G.rects[sec], ts = S.texts.filter((t) => (q ? t.s === q : /^NEW BEST/.test(t.s)));
        if (r && !ts.some((t) => t.y >= r.y - 0.5 && t.y + t.capH <= r.y + r.h + 0.5)) lin.push(sec + " off its section");
      }
      const pg = S.texts.find((t) => / \/ \d+$/.test(t.s));
      if (!pg || +pg.s.split(" / ")[0] === +pg.s.split(" / ")[1]) break;
    }
    const lord = ["GAME OVER", "Reached level 3 of 5.", "SCORE", lat["NEW BEST · NORMAL DIFFICULTY"] ? "NEW BEST · NORMAL DIFFICULTY" : "NEW BEST"].map((q) => lat[q]); // TRY AGAIN rides every page, under its content
    check(
      "Minor-1 LOSE @ " + tag + ": the sections stack top to bottom across its pages, each text inside its endGeom section on its page, every text inside the box",
      lord.every((v, i) => v && (i === 0 || v[0] > lord[i - 1][0] || (v[0] === lord[i - 1][0] && v[1] > lord[i - 1][1]))) && lin.length === 0,
      JSON.stringify(lord) + " " + JSON.stringify(lin),
    );
    // finale WIN, its fullest form (a score record, a time record, a medal): v202 Task 5.3 moved the stack onto endgeom's sections, so the pin
    // is now the order and the box: kicker, headline, score, its multiplier, the stats, the shelf, the keys, top to bottom, all inside the box
    // a short box pages the finale (whole sections a page, v202 Task 5.3): the order holds across its pages, (page, y) top to bottom
    const at = {}, inside = [];
    for (let page = 0; page < 8; page++) {
      const F = krec();
      kprobe.setOn(true);
      drawOverlay(
        F.ctx,
        { state: "WIN", level: 5, score: 1000, heat: 0, pact: 0, pace: 0, finale: false },
        B.w, B.h, B.cx, B.cy, undefined, { on: true, t: 39, best: 40 }, { ...run, r: 5, et: 9, page, medals: [["FLAWLESS", "LEVELS 1-5 IN ONE RUN · NO LIFE LOST"]] },
      );
      const S = kprobe.snapshot(); kprobe.setOn(false);
      for (const t of S.texts) { if (!(t.s in at)) at[t.s] = [page, t.y]; if (!(t.y >= 0 && t.y + t.capH <= B.h && t.x >= 0 && t.x + t.w <= B.w)) inside.push(t.s); }
      const G = endGeom(B, endFacts({ state: "WIN", level: 5, score: 1000, heat: 0, pact: 0, pace: 0, finale: false }, { ...run, r: 5, et: 9, page, medals: [["FLAWLESS", "LEVELS 1-5 IN ONE RUN · NO LIFE LOST"]] }, { on: true, t: 39, best: 40 }), { page, m: krec().ctx });
      for (const [sec, q] of [["band", "FUSE/GRID CLEAR"], ["score", "SCORE · ×1 NORMAL DIFFICULTY"], ["tally", "ENEMIES"], ["shelf", "NEW BEST"]]) {
        const r = G.rects[sec], ts = S.texts.filter((t) => t.s === q);
        if (r && !ts.some((t) => t.y >= r.y - 0.5 && t.y + t.capH <= r.y + r.h + 0.5)) inside.push(sec + " off its section");
      }
      const pg = S.texts.find((t) => / \/ \d+$/.test(t.s));
      if (!pg || +pg.s.split(" / ")[0] === +pg.s.split(" / ")[1]) break;
    }
    const order = ["FUSE/GRID CLEAR", "SCORE · ×1 NORMAL DIFFICULTY", "ENEMIES", "NEW BEST", "FLAWLESS"].map((q) => at[q]);
    check(
      "Minor-1 finale WIN @ " + tag + ": the sections stack top to bottom across its pages, each text inside its endGeom section on its page, every text inside the box",
      order.every((v, i) => v && (i === 0 || v[0] > order[i - 1][0] || (v[0] === order[i - 1][0] && v[1] > order[i - 1][1]))) && inside.length === 0,
      JSON.stringify(order),
    );
  }
}

// ---- 13. Minor-3 (owner ruling 2026-09-07): recordBest treats a 0/absent
// room as "no room info" — it never lowers, and never invents, a stored r.
// A LEVEL SELECT start writes NO room record; its score still records. ----
{
  const seeded = { b: { "0:0:1": { s: 500, r: 4 } } };
  const a = recordBest(seeded, "0:0:1", 900, 0);
  check(
    "recordBest: room 0 raises s but never touches the stored r",
    a.b["0:0:1"].s === 900 && a.b["0:0:1"].r === 4,
    JSON.stringify(a.b["0:0:1"]),
  );
  const bWorse = recordBest(seeded, "0:0:1", 100, 0);
  check(
    "recordBest: room 0 with a WORSE score writes neither field",
    bWorse.b["0:0:1"].s === 500 && bWorse.b["0:0:1"].r === 4,
    JSON.stringify(bWorse.b["0:0:1"]),
  );
  const fresh = recordBest(clampBests(null), "1:0:1", 300, 0);
  check(
    "recordBest: a brand-new bucket with no room info floors r at 1 — the true minimum, never a fabricated deep room",
    fresh.b["1:0:1"].s === 300 && fresh.b["1:0:1"].r === 1,
    JSON.stringify(fresh.b["1:0:1"]),
  );
  const real = recordBest(seeded, "0:0:1", 100, 6);
  check(
    "recordBest: a REAL room argument still raises r exactly as before — the gate is only on 0/absent",
    real.b["0:0:1"].r === 6,
    JSON.stringify(real.b["0:0:1"]),
  );
  const undef = recordBest(seeded, "0:0:1", 900, undefined);
  check(
    "recordBest: an absent room argument (undefined) behaves the same as 0",
    undef.b["0:0:1"].s === 900 && undef.b["0:0:1"].r === 4,
    JSON.stringify(undef.b["0:0:1"]),
  );
}

// ---- 14. Minor-3 (owner ruling 2026-09-07): the record line (GAME OVER's tail, endFacts) gates FURTHEST ROOM
// YET on run.fromStart — a LEVEL SELECT start never claims a room it picked
// rather than earned, not even inside the FURTHEST-ROOM-YET-and-NEW-BEST
// combination (that case degrades to plain NEW BEST). Absent fromStart is
// treated as true — the pre-existing room-1-start behaviour, byte-identical
// for every caller that predates this ruling (§8's fixtures above). ----
{
  const W = { level: 5, score: 900, heat: 0, pact: 0, pace: 0 };
  check(
    "R1M3(a): a LEVEL SELECT run (fromStart:false) never prints FURTHEST LEVEL YET, even as a first-ever record",
    tailOf(W, { best: null, fromStart: false }) === "NEW BEST · NORMAL DIFFICULTY",
    tailOf(W, { best: null, fromStart: false }),
  );
  check(
    "R1M3(a): LEVEL SELECT beating the stored score still just says NEW BEST — never the FURTHEST combo",
    tailOf(W, { best: { s: 500, r: 4 }, fromStart: false }) === "NEW BEST · NORMAL DIFFICULTY",
    tailOf(W, { best: { s: 500, r: 4 }, fromStart: false }),
  );
  check(
    "R1M3(a): LEVEL SELECT short of the score falls through to the ordinary gap form — room ignored entirely",
    tailOf({ ...W, score: 100 }, { best: { s: 500, r: 4 }, fromStart: false }) ===
      "400 points short of your NORMAL DIFFICULTY best (500).",
    tailOf({ ...W, score: 100 }, { best: { s: 500, r: 4 }, fromStart: false }),
  );
  check(
    "R1M3(b): a room-1 start (fromStart:true, or absent — the old default) still fires FURTHEST LEVEL YET as before",
    tailOf({ ...W, score: 100 }, { best: { s: 2000, r: 2 }, fromStart: true }) ===
      "FURTHEST LEVEL YET" &&
      tailOf({ ...W, score: 100 }, { best: { s: 2000, r: 2 } }) === "FURTHEST LEVEL YET",
    tailOf({ ...W, score: 100 }, { best: { s: 2000, r: 2 } }),
  );
}

// ---- 15. Nit-6 (owner ruling 2026-09-07): a first-ever run on a bucket that
// scores exactly 0 prints NO delta line at all — a zero-point run set no
// record worth naming, and "a delta that cannot lie" must not celebrate zero.
// A first-ever run with score > 0 keeps form 3 unchanged; a prior record
// present is unaffected even at score 0. ----
{
  const Z = { state: "LOSE", level: 1, score: 0, heat: 0, pact: 0, pace: 0 };
  check(
    "R10N6(a): a fresh bucket scoring exactly 0 prints no delta line at all",
    tailOf(Z, { best: null }) === "" && endFacts(Z, { best: null }).tail === null,
    JSON.stringify(tailOf(Z, { best: null })),
  );
  check(
    "R10N6(b): GAME OVER omits the section entirely (no tail rect), not an empty line",
    !endGeom({ w: 600, h: 520 }, endFacts(Z, { r: 0, k: 0, p: 0, t: 2, best: null }), { lay: "d", css: 1.38 }).rects.tail,
    JSON.stringify(endFacts(Z, { r: 0, k: 0, p: 0, t: 2, best: null }).tail),
  );
  check(
    "R10N6(c): a fresh bucket scoring 1 keeps form 3 unchanged, from-start",
    tailOf({ ...Z, score: 1 }, { best: null }) === "NEW BEST · NORMAL DIFFICULTY",
    tailOf({ ...Z, score: 1 }, { best: null }),
  );
  check(
    "R10N6(d): a fresh bucket scoring 1, not from-start, still just says NEW BEST",
    tailOf({ ...Z, score: 1 }, { best: null, fromStart: false }) === "NEW BEST · NORMAL DIFFICULTY",
    tailOf({ ...Z, score: 1 }, { best: null, fromStart: false }),
  );
  check(
    "R10N6(e): a prior record present is unaffected by the score-0 clause, even at score 0",
    tailOf(Z, { best: { s: 500, r: 3 } }) === "500 points short of your NORMAL DIFFICULTY best (500).",
    tailOf(Z, { best: { s: 500, r: 3 } }),
  );
  // v202 Task 5.4: the skipped line is GAME OVER's tail section; the plate is shorter by exactly that section and its gap
  const zr = { r: 0, k: 0, p: 0, t: 2, best: null, css: 1.38 }, zG0 = endGeom({ w: 600, h: 520 }, endFacts(Z, zr), { lay: "d", css: 1.38 }), zG1 = endGeom({ w: 600, h: 520 }, endFacts({ ...Z, score: 1 }, zr), { lay: "d", css: 1.38 });
  const zt = zG1.rects.tail, zg = zG1.rects.tail ? zG1.rects.tail.y - (zG1.rects.score.y + zG1.rects.score.h) : 0;
  check(
    "R10N6(f): the tail section is skipped on a first zero run: no tail, the plate shorter by exactly the tail and its gap",
    !zG0.rects.tail && !!zt && zG0.pages === 1 && zG1.pages === 1 && Math.abs(zG1.plate.h - zG0.plate.h - (zt.h + zg)) < 0.01,
    JSON.stringify([zG0.plate.h, zG1.plate.h, zt && zt.h, zg]),
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

/* ---- SELF-REVIEW PIN A (spec §1.2): a retry never calls onStart.
   startGame runs INSIDE step() on the LOSE screen's fire edge (sim.js:67-74 ->
   :107-111), so run state reset only in onStart/RESTART goes stale on every
   retry: run 1 writes best B at its LOSE edge, run 2 still holds the pre-run-1
   snapshot A, and any run-2 score in (A, B) falsely prints NEW BEST. This pin
   drives two real runs through the real loop and asserts the second one tells
   the truth. Ctx stub mirrors tests/times.test.mjs's rec() (the full method
   list a real createGame render pass needs), not a hand-picked subset. ---- */
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
    const rc = {
      save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
      arcTo: noop, bezierCurveTo: noop, quadraticCurveTo: noop, ellipse: noop,
      fill: noop, stroke: noop, fillRect: noop, strokeRect: noop,
      clearRect: noop, setTransform: noop, transform: noop, drawImage: noop,
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      measureText: () => ({ width: 0 }), rect: noop, clip: noop, // v202 Task 5.4: the GAME OVER page clips (the engraved headline)
      fillText: (s) => texts.push(String(s)),
      strokeText: (s) => texts.push(String(s)),
    };
    const fake = { getContext: () => rc, addEventListener() {}, style: {}, css: 1.38 }; // fit.js's stage scale on a 1366 x 768 window: GAME OVER on one page
    const g = createGame(fake, { autoplay: true, seed: 41 });
    fake.css = 1.38; // fit.js wrote its own stage scale at the mount: a 1366 x 768 window's, so GAME OVER is one page
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
      "A: it prints the gap to the record run 1 just wrote, saved to saved",
      texts.join("").includes("200 points short of your NORMAL DIFFICULTY best (500)."),
      texts.join("|"),
    );
    check(
      "A: and the worse retry did not overwrite the record",
      JSON.parse(ls.getItem(BESTS_KEY) || "{}").b["0:0:1"].s === 500,
      ls.getItem(BESTS_KEY),
    );
    check(
      // v202 Task 5.4: GAME OVER says how far the run got ("Reached level n of m.") and its saved score; the run's tally moved to the copy result
      "A: the run's reach and saved score paint on LOSE",
      texts.includes("Reached level 1 of 5.") && texts.includes("SCORE") && texts.includes("300"),
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
      /const startRunState = \(fromStart\) => \{[\s\S]{0,200}bestRun = bestOfRun\(/.test(src),
    (src.match(/bestRun = [^\n]*/g) || []).join(" | "),
  );
  check(
    "B2: the LOSE->PLAY edge is a run start — a retry never reaches onStart, and IS from-start again",
    /if \(prevSt === "LOSE"\) startRunState\(true\);/.test(src),
    (src.match(/startRunState\([\s\S]*?\);[^\n]*/g) || []).join(" | "),
  );
  check(
    "B3: startRunState has exactly three call sites (onStart, pause RESTART, the LOSE->PLAY edge)",
    (src.match(/startRunState\([\s\S]*?\);/g) || []).length === 3,
    String((src.match(/startRunState\([\s\S]*?\);/g) || []).length),
  );
  check(
    /* Minor-3 (owner ruling, review 2026-09-07): a LEVEL SELECT start begins
       above room 1, so only onStart's fromStart argument can ever be false —
       the sim's retry after LOSE and the RESTART command both reload room 1
       (sim.js's startGame), so neither call site can start "from" a deeper
       room. */
    "B2b (Minor-3): onStart passes (args.level|0)<=1; RESTART always starts true",
    /const onStart = \(args\) => \{[\s\S]{0,1400}startRunState\(\(args\.level \| 0\) <= 1\);/.test(src) &&
      /if \(cmd === "RESTART"\)[\s\S]{0,700}startRunState\(true\);/.test(src),
    (src.match(/startRunState\([\s\S]*?\);/g) || []).join(" | "),
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
  const rst = (src.match(/if \(cmd === "RESTART"\)[\s\S]{0,700}/) || [""])[0];
  check(
    "B6: pause RESTART calls persistScore BEFORE startRunState — reversing them drops the write",
    rst.indexOf("persistScore();") >= 0 &&
      rst.indexOf("persistScore();") < rst.indexOf("startRunState(true);"),
    rst.trim().slice(0, 160),
  );
  check(
    /* the bare substring "renderer.render(" also matches the pre-existing
       ghost-coach doc comment ("BEFORE renderer.render() drains…") a few
       lines above feedTally's own call site, so the search targets the real
       call (which passes `attract`) rather than the comment mentioning it. */
    "B7: feedTally reads the batch BEFORE renderer.render drains world.events",
    src.indexOf("feedTally(tally, world);") > 0 &&
      src.indexOf("feedTally(tally, world);") < src.indexOf("renderer.render(attract"),
    String(src.indexOf("feedTally(tally, world);")),
  );
  check(
    "B8: the run clock is PLAY-only, on the same line coachT and roomT already are",
    /if \(world\.state === "PLAY"\) \{ coachT \+= dt; roomT \+= Math\.min\(dt, 7 \* CFG\.STEP - acc\); runT \+= dt; \}/.test(src),
    (src.match(/runT \+= dt[^\n]*/) || [])[0],
  );
  check(
    /* Minor-4 (review 2026-09-07): the old regex only pinned that endRun()
       was the FIRST statement in the branch, so any statement added after it
       (e.g. a stray world.score = 0) survived undetected (mutation M11). Pin
       the WHOLE branch body — endRun() then stat("win_finale", ...) and
       nothing else. */
    "B9 (Minor-4): the finale WIN branch is EXACTLY endRun() + stat(\"win_finale\", ...), nothing else",
    /if \(isFinale\(world\.level\)\) \{ endRun\(\); stat\("win_finale", null, dateStr\(\)\); \}/.test(src) &&
      /import \{ CFG, isFinale, roomCap \} from "\.\/core\/config\.js";/.test(src),
    (src.match(/if \(isFinale\(world\.level\)\)[^\n]*/) || [])[0],
  );
  check(
    /* Minor-3 (owner ruling): endRun withholds the room from recordBest
       unless the run began at room 1 — the score still records either way. */
    "B10 (Minor-3): endRun passes the room to recordBest ONLY when runFromStart",
    /saveBests\(recordBest\(loadBests\(\), bestKey\(world\), world\.score \| 0,\s*runFromStart \? \(world\.level \| 0\) : 0\)\);/.test(src),
    (src.match(/saveBests\(recordBest\([^;]*;/) || [""])[0],
  );
  check(
    /* the review's own M9/M10 class: a wiring pin so a dropped field regresses
       the ruling silently rather than only in a player's overlay. */
    "B11 (Minor-3): the ro.run literal (main's runInfo, v202 Task 5.2) carries fromStart so deltaOf can gate the FURTHEST forms",
    /const runInfo = \(\) => \(\{[^}]*fromStart: runFromStart[^}]*\}\);/.test(src) && /run: runInfo\(\),/.test(src),
    (src.match(/const runInfo = [^\n]*/) || [""])[0],
  );
}

/* ---- SELF-REVIEW PIN C (Minor-3, owner ruling 2026-09-07): a LEVEL SELECT
   start writes NO room record and never prints FURTHEST LEVEL YET; its score
   still records — exactly like HIGH SCORES already does for level-select
   runs. The sim's retry after LOSE always reloads room 1, so it is
   from-start again and FURTHEST fires normally there (pin (a)/(b)/(c) from
   the ruling, end-to-end through the real loop and a real store). ---- */
{
  const mem = new Map();
  const ls = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
  };
  ls.setItem(BESTS_KEY, JSON.stringify({ b: { "0:0:1": { s: 500, r: 4 } } }));
  globalThis.window = { localStorage: ls, addEventListener() {} };
  try {
    const texts = [];
    const noop = () => {};
    const rc = {
      save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
      arcTo: noop, bezierCurveTo: noop, quadraticCurveTo: noop, ellipse: noop,
      fill: noop, stroke: noop, fillRect: noop, strokeRect: noop,
      clearRect: noop, setTransform: noop, transform: noop, drawImage: noop,
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      measureText: () => ({ width: 0 }), rect: noop, clip: noop, // v202 Task 5.4: the GAME OVER page clips (the engraved headline)
      fillText: (s) => texts.push(String(s)),
      strokeText: (s) => texts.push(String(s)),
    };
    const fake = { getContext: () => rc, addEventListener() {}, style: {}, css: 1.38 }; // fit.js's stage scale on a 1366 x 768 window: GAME OVER on one page
    const g = createGame(fake, { seed: 49 });
    fake.css = 1.38; // fit.js wrote its own stage scale at the mount: a 1366 x 768 window's, so GAME OVER is one page
    g.app.level = 5; // LEVEL SELECT depth
    g.app.startRun(); // onStart: (args.level|0)<=1 is false -> runFromStart=false
    check(
      "C: onStart at a LEVEL SELECT depth loads that room",
      g.world.level === 5,
      String(g.world.level),
    );
    g.world.score = 900;
    g.world.state = "LOSE";
    texts.length = 0;
    g.loop(1016); // PLAY -> LOSE: endRun() writes, room withheld (fromStart false)
    check(
      "C(a): the store's r stays put — a LEVEL SELECT death writes NO room record",
      JSON.parse(ls.getItem(BESTS_KEY)).b["0:0:1"].r === 4,
      ls.getItem(BESTS_KEY),
    );
    check(
      "C(a): the score still records, exactly like HIGH SCORES already does for level-select runs",
      JSON.parse(ls.getItem(BESTS_KEY)).b["0:0:1"].s === 900,
      ls.getItem(BESTS_KEY),
    );
    check(
      "C(a): the overlay never prints FURTHEST LEVEL YET on a LEVEL SELECT death — plain NEW BEST",
      texts.includes("NEW BEST · NORMAL DIFFICULTY") && !texts.some((s) => s.indexOf("FURTHEST") >= 0), // v202 Task 5.4: the plaque names its bucket
      texts.join("|"),
    );
    // --- retry after the LEVEL SELECT death: the sim's LOSE fire edge always
    // reloads room 1 (startGame -> loadLevel(world,1,false), sim.js:108, the
    // D1 arcade reset) and IS from-start again. NOTE this pin drives the
    // retry by forcing world.state directly (matching PIN A above), not
    // through the real fire-edge/startGame path — the room-1 reload itself
    // is a source fact (sim.js:107-110), not exercised behaviorally here. ---
    g.world.state = "PLAY";
    g.loop(1032); // LOSE -> PLAY: startRunState(true)
    g.world.level = 6; // forced, standing in for real progression through rooms 1..6
    g.world.score = 50;
    g.world.state = "LOSE";
    texts.length = 0;
    g.loop(1048);
    check(
      "C(b)/(c): a retry is from-start again — FURTHEST LEVEL YET fires normally once it is",
      texts.some((s) => s.indexOf("FURTHEST LEVEL YET") >= 0),
      texts.join("|"),
    );
    check(
      "C(b): the store's r now advances past the level-select run's untouched 4",
      JSON.parse(ls.getItem(BESTS_KEY)).b["0:0:1"].r === 6,
      ls.getItem(BESTS_KEY),
    );
  } finally {
    delete globalThis.window;
  }
}

/* ---- SELF-REVIEW PIN D (review Minor-2 + Nit-1): the quit-run write path is
   BEHAVIORAL, not source-order-only — KeyM/RESTART/QUIT TO MENU each drop a
   live run through persistScore's endRun(), verified by the actual bytes
   landed in nb.bests.v1, not a regex over main.js. Reproduces the reviewer's
   own repro: world.state = "PAUSE" -> one g.loop() frame to refresh
   app.worldState -> the quit call. ---- */
{
  const noop = () => {};
  const mem = {};
  globalThis.window = {
    addEventListener: noop, removeEventListener: noop,
    localStorage: {
      getItem: (k) => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
    },
  };
  try {
    delete mem[BESTS_KEY];
    const g1 = createGame(null, { autoplay: true });
    g1.world.score = 777;
    g1.input.onPause();
    g1.loop(16);
    g1.input.onUiKey("KeyM");
    check(
      "D1: KeyM from PAUSE writes nb.bests.v1 through persistScore's endRun",
      JSON.parse(mem[BESTS_KEY] || "{}").b["0:0:1"].s === 777,
      mem[BESTS_KEY],
    );

    delete mem[BESTS_KEY];
    const g2 = createGame(null, { autoplay: true });
    g2.world.score = 888;
    g2.input.onPause();
    g2.loop(16);
    g2.app.pauseCursor = PAUSE_ITEMS.indexOf("RESTART");
    g2.app.confirm();
    check(
      "D2: pause RESTART writes nb.bests.v1 the same way KeyM does",
      JSON.parse(mem[BESTS_KEY] || "{}").b["0:0:1"].s === 888,
      mem[BESTS_KEY],
    );

    delete mem[BESTS_KEY];
    const g3 = createGame(null, { autoplay: true });
    g3.world.score = 999;
    g3.input.onPause();
    g3.loop(16);
    g3.app.pauseCursor = PAUSE_ITEMS.indexOf("QUIT TO MENU");
    g3.app.confirm();
    check(
      "D3: pause QUIT TO MENU writes nb.bests.v1 the same way KeyM does",
      JSON.parse(mem[BESTS_KEY] || "{}").b["0:0:1"].s === 999,
      mem[BESTS_KEY],
    );

    /* Nit-1: the runEnded latch. LOSE writes once; a following quit call is a
       no-op — not just "does not throw", but a BYTE-IDENTICAL store. The
       score bump to 999999 on the second call is LOAD-BEARING: recordBest is
       monotonic-max, so a duplicate write at the SAME score would move
       nothing whether or not the latch exists, silently resurrecting the
       review's M20 (the mutation that deleted the latch and still passed)
       as green here too. Forcing world.state "PAUSE" straight after "LOSE"
       is synthetic — the review confirmed PAUSE is unreachable from LOSE in
       real play — it exists only to drive persistScore's endRun() a second
       time on the same run; the REACHABLE double-fire is the finale (WIN
       edge -> `world.finale && state==="MENU"` -> persistScore), pinned
       separately as D6/D7 below. */
    delete mem[BESTS_KEY];
    const g4 = createGame(null, { autoplay: true });
    g4.world.score = 500;
    g4.world.state = "LOSE";
    g4.loop(16); // PLAY -> LOSE: endRun() writes once
    const afterLose = mem[BESTS_KEY];
    check(
      "D4: the LOSE edge writes nb.bests.v1",
      JSON.parse(afterLose || "{}").b["0:0:1"].s === 500,
      afterLose,
    );
    g4.world.score = 999999; // load-bearing: see comment above — do not simplify away
    g4.world.state = "PAUSE"; // synthetic: see comment above
    g4.loop(32);
    g4.input.onUiKey("KeyM");
    check(
      "D5: a following KeyM after LOSE is a no-op — the runEnded latch already fired (store byte-identical)",
      mem[BESTS_KEY] === afterLose,
      mem[BESTS_KEY],
    );

    /* D6/D7: the REACHABLE double-fire (Nit-1's actual finding) — the finale
       WIN edge ends the run, then world.finale && state==="MENU" runs
       persistScore() a second time on the same run. */
    delete mem[BESTS_KEY];
    const g5 = createGame(null, { autoplay: true });
    g5.world.level = 5; // a finale room
    g5.world.score = 4242;
    g5.world.state = "WIN";
    g5.loop(16); // PLAY -> WIN at the finale: endRun() writes once
    const afterFinale = mem[BESTS_KEY];
    check(
      "D6: the finale WIN edge writes nb.bests.v1",
      JSON.parse(afterFinale || "{}").b["0:0:1"].s === 4242,
      afterFinale,
    );
    g5.world.score = 9000000; // load-bearing, same reason as D4/D5 — see comment above
    g5.world.finale = true;
    g5.world.state = "MENU";
    g5.loop(32); // world.finale && state==="MENU" -> persistScore() -> endRun() no-op
    check(
      "D7: the finale->MENU persistScore call is a no-op — same latch, the reachable double-fire path",
      mem[BESTS_KEY] === afterFinale,
      mem[BESTS_KEY],
    );
  } finally {
    delete globalThis.window;
  }
}

console.log("\n  BESTS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
