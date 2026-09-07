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
  runLine,
  bestLabel,
  deltaLine,
  isRunEnd,
  summaryLines,
  drawOverlay,
  fmtTime,
} from "../src/render/scenes.js";
import { readFileSync } from "node:fs";
import { createGame } from "../src/main.js";

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
  /* best.r matches W.level so the LOSE/finale checks below isolate the score
     comparison alone (a lower best.r would ALSO trip FURTHEST ROOM YET at
     every level>=3 assertion here, since deltaOf compares world.level, not
     whether the room was cleared). */
  const run = { r: 2, k: 5, p: 1, t: 90, best: { s: 500, r: 3 } };
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
    { r: 2, k: 5, p: 1, t: 90, best: { s: 500, r: 3 } });
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
    // LOSE: runStamp, tally, delta, cue — dy 20/44/68/92. LOSE has no
    // timeLine slot (WIN-only, tm.on-gated), so it never reaches dy 116.
    const L = rec();
    drawOverlay(
      L.c,
      { state: "LOSE", level: 3, score: 1000, heat: 0, pact: 0, pace: 0 },
      B.w, B.h, B.cx, B.cy, undefined, undefined, run,
    );
    const lDy = L.rows.filter(([, y]) => y > B.cy).map(([, y]) => y - B.cy);
    check(
      "Minor-1 LOSE @ " + tag + ": dy stack is 20/44/68/92 under runStamp",
      JSON.stringify(lDy) === JSON.stringify([20, 44, 68, 92]),
      JSON.stringify(lDy) + " / " + JSON.stringify(L.rows),
    );
    // finale WIN + TIME ATTACK on: runStamp, tally, delta, timeLine, cue —
    // the one path that reaches all five dy slots (spec §2.4's worst case).
    const F = rec();
    drawOverlay(
      F.c,
      { state: "WIN", level: 5, score: 1000, heat: 0, pact: 0, pace: 0, finale: false },
      B.w, B.h, B.cx, B.cy, undefined, { on: true, t: 59, best: 40 }, run,
    );
    const fDy = F.rows.filter(([, y]) => y > B.cy).map(([, y]) => y - B.cy);
    check(
      "Minor-1 finale WIN @ " + tag + ": dy stack is 20/44/68/92/116 under runStamp",
      JSON.stringify(fDy) === JSON.stringify([20, 44, 68, 92, 116]),
      JSON.stringify(fDy) + " / " + JSON.stringify(F.rows),
    );
  }
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
      measureText: () => ({ width: 0 }),
      fillText: (s) => texts.push(String(s)),
      strokeText: (s) => texts.push(String(s)),
    };
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

console.log("\n  BESTS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
