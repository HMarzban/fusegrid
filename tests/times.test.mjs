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
import { fmtTime, timeLine, drawHudChips, drawOverlay } from "../src/render/scenes.js";
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

/* Shared recorder ctx for the render pins below (and reused by main.js's
   createGame pin in Task 3) — a superset of the canvas 2D methods drawIcon /
   rr / poly / seal touch, so a HUD chip's heart/bomb/fire glyph never throws
   mid-pin. fillText/strokeText are the only calls that record anything. */
function rec() {
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
    clearRect: noop,
    setTransform: noop,
    transform: noop,
    drawImage: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    measureText: () => ({ width: 0 }),
    fillText: (s) => texts.push(String(s)),
    strokeText: (s) => texts.push(String(s)),
  };
  return { c, texts };
}
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

/* ---- SELF-REVIEW PIN A: the stopwatch is roomT, NOT world.time.
   step() bumps world.time at sim.js:42-43, BEFORE the PAUSE early return at
   :75-77, and main's step loop is ungated on world.state — so world.time keeps
   climbing through a pause. This pin fails if anyone ever "simplifies" roomT
   back to world.time, because it asserts the two clocks DISAGREE. ---- */
{
  const { c: rc, texts } = rec();
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

console.log("\n  TIMES RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
