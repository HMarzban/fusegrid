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

console.log("\n  BESTS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
