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
  /* clampPact is `(p|0)&15` (core/pact.js:5, locked) — a MASK, not a
     saturating clamp. 999 & 15 === 7 (999 = 0b1111100111, low nibble 0111),
     not 15; -1 & 15 === 15 because -1's two's-complement bits are all 1.
     The corrected literal below is what the real, untouched clampPact
     actually returns — it still proves the junk value is clamped THROUGH
     core/pact.js, just not to the value an earlier draft of this pin assumed. */
  check(
    "timeKey: junk heat/pact/pace clamp through the core clamps",
    timeKey({ level: 8, heat: 99, pact: 999, pace: 9 }) === "8:2:7:2" &&
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
