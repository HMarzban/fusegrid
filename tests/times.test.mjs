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
import { fmtTime, drawOverlay } from "../src/render/scenes.js";
import { endFacts } from "../src/render/pages/endgeom.js";
/* v202 Task 5.3: a level clear's time is its TIME stat card, and only a new best hangs the LEVEL n TIME ribbon (endgeom.endFacts; was timeLine) */
const clearOf = (lv, tm) => { const F = endFacts({ state: "WIN", level: lv }, { r: 1 }, tm); const rib = F.pieces.find((p) => p.kind === "rib"); return F.stats[0][2] + (rib ? " · " + rib.name[0] + " " + rib.value : ""); };
import { drawHud, hudGeom, hudState } from "../src/render/hud.js";
import { hudGeo } from "../src/app/fit.js";
import { worldTokens } from "../src/render/kit/tokens.js";
import { rec as krec } from "./lib/textrec.mjs";
import { readFileSync } from "node:fs";
import { createGame } from "../src/main.js";
import { SCREEN } from "../src/app/menuapp.js";
import "../src/core/board3.js";
import * as lazyPages from "../src/render/pages/lazy.js";
import * as endWin from "../src/render/pages/endwin.js";
lazyPages._set("endwin", endWin); // WIN is a lazy page (v202 Task 5.3): handed in as if its import had landed
import * as endLose from "../src/render/pages/endlose.js";
lazyPages._set("endlose", endLose); // GAME OVER is a lazy page (v202 Task 5.4)

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

// ---- 6. a level clear's time: both forms (was timeLine) ----
{
  check(
    "a slower clear shows its time and hangs no ribbon (the standing best is no record)",
    clearOf(3, { on: true, t: 41.23, best: 38.9 }) === "0:41.2",
    clearOf(3, { on: true, t: 41.23, best: 38.9 }),
  );
  check(
    "no prior best hangs the LEVEL n TIME ribbon",
    clearOf(3, { on: true, t: 41.23, best: null }) === "0:41.2 · LEVEL 3 TIME 0:41.2",
    clearOf(3, { on: true, t: 41.23, best: null }),
  );
  check(
    "beating the standing best hangs the ribbon",
    clearOf(3, { on: true, t: 41.23, best: 45 }) === "0:41.2 · LEVEL 3 TIME 0:41.2",
    clearOf(3, { on: true, t: 41.23, best: 45 }),
  );
}

// ---- 7. the HUD's TIME chip (hud.js, UI upgrade Task 8.2: the round 5 frame shows it in every run) reads fmtTime(o.time.t) ----
{
  const chipTexts = (o) => { const r = krec(), st = hudState(HUD_W, o); drawHud(r.ctx, hudGeom(r.ctx, hudGeo(1366, 768, 600, 520, "d"), st, { w: 1366, h: 768 }), st, worldTokens(1), {}); return r.texts.map((t) => t.s); };
  const a = chipTexts(undefined), d = chipTexts({ time: { on: false, t: 41.23 } }), e = chipTexts({ time: { on: true, t: 41.23 } });
  check(
    "no time handed in reads 0:00.0; TIME TRIAL or not, the chip shows the room clock",
    hudState(HUD_W, undefined).time === "0:00.0" && hudState(HUD_W, { time: { on: false, t: 41.23 } }).time === "0:41.2" && a.includes("TIME") && d.includes("TIME"),
    a.join("|"),
  );
  check(
    "the TIME chip reads fmtTime(tm.t)",
    e.includes("TIME") && hudState(HUD_W, { time: { on: true, t: 41.23 } }).time === fmtTime(41.23),
    e.join("|"),
  );
  check(
    "every chip label is there, LEVEL for the old LV",
    ["LIVES", "BOMBS", "FLAME", "LEVEL", "ENEMIES", "TIME", "SCORE"].every((s) => e.includes(s)) && !e.includes("LV"),
    e.join("|"),
  );
}

// ---- 8. drawOverlay: the eighth arg is optional; LOSE and PAUSE untouched ----
{
  const W = { state: "WIN", level: 3, finale: false, score: 10, heat: 0 };
  const ks = (R) => R.texts.map((t) => t.s);
  const a = krec();
  drawOverlay(a.ctx, W, 600, 520, 300, 260, undefined, undefined);
  check(
    "drawOverlay WIN with no tm: the level clear, no record piece (v202 Task 5.3: the TIME card reads 0:00.0)",
    ks(a).includes("LEVEL 3 CLEAR") && !ks(a).includes("NEW BEST") && !ks(a).includes("LEVEL 3 TIME"),
    ks(a).join("|"),
  );
  const b = krec();
  drawOverlay(b.ctx, W, 600, 520, 300, 260, undefined, { on: true, t: 41.23, best: 38.9 });
  const b2 = krec();
  drawOverlay(b2.ctx, W, 600, 520, 300, 260, undefined, { on: true, t: 37.06, best: 38.9 });
  check(
    "drawOverlay WIN with tm: the room time on the TIME card; a time slower than the saved best hangs no ribbon, a faster one hangs NEW BEST LEVEL 3 TIME",
    ks(b).includes("0:41.2") && !ks(b).includes("NEW BEST") &&
      ks(b2).includes("NEW BEST") && ks(b2).includes("LEVEL 3 TIME") && ks(b2).filter((s) => s === "0:37.0").length === 2,
    ks(b).join("|") + " / " + ks(b2).join("|"),
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
  /* v202 Task 5.1: PAUSE reads tm for one thing, the run's rules. A timed run shows a TIME TRIAL tag (words.js runParts) and nothing else of tm
     (no room time, no best); an untimed one shows no tag. A full recorder (clip and rect) so the page paints, never the plan-only path. */
  const { rec: full } = await import("./lib/textrec.mjs");
  const P = full();
  const Pw = { state: "PAUSE", level: 3, finale: false, score: 10, heat: 0, pace: 0, pact: 0 };
  drawOverlay(P.ctx, Pw, 600, 520, 300, 260, { view: 0, cursor: 0 }, {
    on: true,
    t: 41.23,
    best: null,
  });
  const P2 = full();
  drawOverlay(P2.ctx, Pw, 600, 520, 300, 260, { view: 0, cursor: 0 });
  const ps = P.texts.map((t) => t.s), p2 = P2.texts.map((t) => t.s);
  check(
    "drawOverlay PAUSE reads tm only for the TIME TRIAL tag: timed, the tag and nothing else of tm; untimed, no tag",
    p2.length > 8 && p2.includes("PAUSED") && !p2.includes("TIME TRIAL") && ps.filter((s) => s === "TIME TRIAL").length === 1 &&
      ps.filter((s) => s !== "TIME TRIAL").join("|") === p2.join("|") && !ps.some((s) => /\d:\d\d\.\d/.test(s)),
    ps.join("|"),
  );
}

// ---- wiring: both renderers pass o.time through as tm ----
{
  for (const [f, ov, ch] of [
    ["src/render/renderer.js", "drawOverlay(ctx, world, B.w", "drawOverlay(ctx, world, B.w"],
    ["src/render/three/wrapper.js", "drawOverlay(ovCtx,world,B.w", "drawOverlay(ovCtx,world,B.w"],
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
      f + ": drawOverlay receives o.toast as its tenth arg (copy feedback)",
      /o\s*&&\s*o\.run\s*,\s*o\s*&&\s*o\.toast\s*\)/.test(ovLine),
      ovLine.trim(),
    );
  }
  const main = readFileSync("src/main.js", "utf8"), hl = (main.match(/.*hud\.frame\(.*/) || [""])[0];
  check("main hands the HUD the frame's render options (o.time) in GAME", /hud\.frame\(fit, app\.screen === SCREEN\.GAME \? world : null, ro, curKind, \{ proj: renderer\.proj, cam \}\)/.test(hl) && (/time: \{ on: !!app\.timeAttack, t: roomT/.test(main) || (/timeInfo = \(\) => \(\{ on: !!app\.timeAttack, t: roomT/.test(main) && /time: timeInfo\(\)/.test(main))) /* R2: main builds the frame's time through timeInfo() */, hl.trim());
}

/* ---- SELF-REVIEW PIN A: the stopwatch is roomT, NOT world.time.
   step() bumps world.time at sim.js:42-43, BEFORE the PAUSE early return at
   :75-77, and main's step loop is ungated on world.state — so world.time keeps
   climbing through a pause. This pin fails if anyone ever "simplifies" roomT
   back to world.time, because it asserts the two clocks DISAGREE. ---- */
{
  /* the TIME chip is on #hud (hud.js, UI upgrade Task 8.2): the stamp is the TIME the HUD paints (its own painter on a recorder, fed the
     renderer's render options; the digits sit in fixed cells, one fillText each, inside the TIME chip) */
  const { c: rc } = rec();
  const fake = { getContext: () => rc, addEventListener() {}, style: {} };
  const g = createGame(fake, { autoplay: true, seed: 41 });
  let last = null;
  const r0 = g.renderer, render = r0.render.bind(r0);
  const HG = hudGeo(1366, 768, 600, 520, "d");
  r0.render = (w, dt, o) => {
    if (o && o.hud === true) { const R = krec(), st = hudState(w, o), G = hudGeom(R.ctx, HG, st, { w: 1366, h: 768 }), c = G.chips.time; drawHud(R.ctx, G, st, worldTokens(w.level), {}); last = R.texts.filter((q) => /^800 /.test(q.font) && q.y >= c.y && q.y <= c.y + c.h && q.x >= c.x && q.x <= c.x + c.w).map((q) => q.s).join(""); }
    return render(w, dt, o);
  };
  const loop = (t) => { g.loop(t); };
  /* app.timeAttack is added for real in Task 4; ro.time reads !!app.timeAttack
     dynamically, so setting it here is exactly what the shipped toggle will do
     and this pin survives Task 4 unchanged. */
  g.app.timeAttack = true;
  const stamp = () => (last && /^\d:\d\d\.\d$/.test(last) ? last : null);
  let t = 1000;
  for (let i = 0; i < 40; i++) {
    t += 16;
    loop(t);
  }
  const running = stamp();
  check("A: the TIME chip paints a stopwatch while playing", running !== null, running);
  const wt0 = g.world.time;
  g.input.onPause();
  check("A: onPause reaches world.state", g.world.state === "PAUSE", g.world.state);
  for (let i = 0; i < 60; i++) {
    t += 16;
    loop(t);
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
    loop(t);
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
  const first = clearOf(3, { on: true, t: 41.23, best: bestPrev });
  check(
    "B: the first clear hangs the record ribbon, never reads its own freshly-written time as the bar",
    first === "0:41.2 · LEVEL 3 TIME 0:41.2",
    first,
  );
  check(
    "B: reading the store AFTER the write is what this forbids (it would hang no ribbon)",
    clearOf(3, { on: true, t: 41.23, best: bestOf(v, k) }) === "0:41.2",
    "that result is the bug, and the pin above is what excludes it",
  );
  bestPrev = bestOf(v, k);
  v = recordTime(v, k, 44.0);
  const second = clearOf(3, { on: true, t: 44.0, best: bestPrev });
  check(
    "B: a slower second clear hangs no ribbon and does not overwrite the best",
    second === "0:44.0" && v.b[k] === 412,
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

/* ---- SELF-REVIEW PIN C (closing fix wave, finding 1): the WIN-edge write has
   no behavioral pin on the ACTUAL persisted number — a mutation to
   `roomT*2+7`, or swapping in `world.time`, both leave every check above
   green, because Pin A/B assert TIMING behavior and store round-trips in
   isolation, never the number main.js's WIN edge actually writes.
   This drives a real createGame through PLAY, pauses mid-run (so world.time
   and the PLAY-only roomT clock diverge — Pin A's own control), resumes, and
   independently ACCUMULATES the same PLAY-only clock main.js keeps (sum dt
   only while state===PLAY, from the exact same t sequence driving the real
   loop) to predict the number that must land in an injected store on the
   PLAY->WIN edge — never reading main.js's private `roomT` directly. ---- */
{
  const mem = new Map();
  const store = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
  };
  globalThis.window = { localStorage: store, addEventListener() {} };
  try {
    const g = createGame(null, { autoplay: true, seed: 51 });
    let t = 2000;
    g.loop(t); // establishes main.js's internal `last`; dt=0 this frame
    let expect = 0;
    const advance = (ms) => {
      const prevT = t;
      t += ms;
      const dt = Math.min((t - prevT) / 1000, 0.25); // mirrors main.js's own clamp
      if (g.world.state === "PLAY") expect += dt; // mirrors roomT's PLAY-only add (16 ms frames never hit the step cap, so it is the full dt)
      g.loop(t);
    };
    for (let i = 0; i < 30; i++) advance(16);
    check(
      "PIN C setup: still PLAY before the pause",
      g.world.state === "PLAY",
      g.world.state,
    );
    const wtBeforePause = g.world.time;
    g.input.onPause();
    check("PIN C: paused", g.world.state === "PAUSE", g.world.state);
    for (let i = 0; i < 40; i++) advance(16); // world.time advances; expect (roomT) must not
    check(
      "PIN C control: world.time DID advance while paused (Pin A's own control, reproduced)",
      g.world.time > wtBeforePause,
      wtBeforePause + " -> " + g.world.time,
    );
    g.input.onPause(); // resume
    check("PIN C: resumed", g.world.state === "PLAY", g.world.state);
    for (let i = 0; i < 20; i++) advance(16);

    const k = timeKey(g.world);
    g.world.state = "WIN"; // same technique tests/headless.test.mjs uses for a WIN pin
    advance(16); // this frame's own dt must NOT be added — state is WIN, not PLAY, when roomT is read

    const stored = loadTimes(store).b[k];
    check(
      "PIN C: the WIN edge persists the PLAY-only roomT clock, tenths-floored — not a mutated value",
      stored === Math.floor(expect * 10),
      stored + " vs floor(" + expect + "*10)=" + Math.floor(expect * 10),
    );
    check(
      "PIN C control: the stored value is NOT world.time's tenths — roomT and world.time really do disagree here",
      stored !== Math.floor(g.world.time * 10),
      stored + " vs " + Math.floor(g.world.time * 10),
    );
  } finally {
    delete globalThis.window;
  }
}

/* ---- PIN E (wave-3 audit D1): roomT counts only the PLAY time the capped
   step loop actually simulates. A frame past the 7-step cap drops its
   remainder from the sim; if roomT still adds the full clamped dt, it runs
   ahead of world.time for the rest of the room, and the ghost (sampled on
   roomT) leads a player on the same route. No PAUSE here, so world.time is
   the stepped PLAY clock and the persisted best must match it. ---- */
{
  const mem = new Map();
  const store = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
  };
  globalThis.window = { localStorage: store, addEventListener() {} };
  try {
    const g = createGame(null, { autoplay: true, seed: 53 });
    let t = 3000;
    g.loop(t);
    const wt0 = g.world.time;
    for (let i = 0; i < 20; i++) g.loop((t += 16));
    for (let i = 0; i < 3; i++) g.loop((t += 300));
    for (let i = 0; i < 20; i++) g.loop((t += 16));
    check("PIN E setup: still PLAY after three hitches", g.world.state === "PLAY", g.world.state);
    const sim = g.world.time - wt0;
    const k = timeKey(g.world);
    g.world.state = "WIN";
    g.loop((t += 16));
    const stored = loadTimes(store).b[k];
    check(
      "PIN E: a hitch never pushes roomT past the simulated PLAY time",
      Math.abs(stored / 10 - sim) < 0.1,
      stored / 10 + " vs sim " + sim.toFixed(3),
    );
  } finally {
    delete globalThis.window;
  }
}

/* ---- SELF-REVIEW PIN D (closing fix wave, finding 1): the TIME-ATTACK
   toggle's persist round-trip through the REAL callback chain — createGame's
   `onTimeAttack`/`loadTimes().on` wiring — not the source regexes below,
   which only prove the wiring EXISTS, never that it actually persists. ---- */
{
  const mem = new Map();
  const store = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
  };
  globalThis.window = { localStorage: store, addEventListener() {} };
  try {
    const g = createGame(null, { seed: 61 });
    check(
      "PIN D: a fresh store seeds app.timeAttack false and loadTimes().on 0",
      g.app.timeAttack === false && loadTimes(store).on === 0,
      g.app.timeAttack + " / " + loadTimes(store).on,
    );
    g.app.screen = SCREEN.LEVEL;
    g.app.pactUnlocked = true;
    const ok1 = g.app.toggleTimeAttack();
    check(
      "PIN D: toggleTimeAttack() flips app.timeAttack on and returns true",
      ok1 === true && g.app.timeAttack === true,
      ok1 + " / " + g.app.timeAttack,
    );
    check(
      "PIN D: ...and persists through the REAL onTimeAttack callback to the store",
      loadTimes(store).on === 1,
      JSON.stringify(loadTimes(store)),
    );
    const ok2 = g.app.toggleTimeAttack();
    check(
      "PIN D: toggling again flips app.timeAttack back off",
      ok2 === true && g.app.timeAttack === false,
      ok2 + " / " + g.app.timeAttack,
    );
    check(
      "PIN D: ...and the store round-trips back to 0",
      loadTimes(store).on === 0,
      JSON.stringify(loadTimes(store)),
    );
  } finally {
    delete globalThis.window;
  }
}

// ---- wiring: the toggle is seeded from and persisted to nb.times.v1 ----
{
  const mainSrc = readFileSync("src/main.js", "utf8");
  check(
    "main.js seeds app.timeAttack from loadTimes().on",
    /timeAttack:\s*loadTimes\(\)\.on\s*===\s*1/.test(mainSrc),
    (mainSrc.match(/timeAttack:[^\n]*/) || [])[0],
  );
  check(
    "main.js persists the toggle through onTimeAttack, the onPaceChange shape",
    /onTimeAttack:[^\n]*saveTimes\(/.test(mainSrc),
    (mainSrc.match(/onTimeAttack:[^\n]*/) || [])[0],
  );
  const shellSrc = readFileSync("src/render/shellview.js", "utf8");
  check(
    "shellview passes app.timeAttack as drawLevelSelect's ninth arg",
    /app\.pace,\s*app\.timeAttack,/.test(shellSrc),
    (shellSrc.match(/drawLevelSelect\([^;]*\);/s) || [])[0],
  );
  const mdSrc = readFileSync("src/render/menudraw.js", "utf8");
  const lvSrc = readFileSync("src/render/pages/level.js", "utf8");
  check(
    "LEVEL SELECT (pages/level.js, v202 Task 3.3) keeps the modifier names render-side (words.js MOD by MOD_BITS) and never touches core PACT_NAME; neither does menudraw",
    /ENTRIES = Object\.freeze\(\[\.\.\.MOD_BITS\.map\(\(b\) => MOD\[b\]\), TIME_TRIAL\]\)/.test(lvSrc) && /from "\.\.\/words\.js"/.test(lvSrc) && !/PACT_NAME/.test(lvSrc) && !/PACT_NAME/.test(mdSrc),
    (lvSrc.match(/ENTRIES = [^\n]*/) || [])[0],
  );
  const pactSrc = readFileSync("src/core/pact.js", "utf8");
  check(
    "core/pact.js is untouched — PACT_NAME still LAST, and no fifth bit",
    /PACT_NAME=Object\.freeze\(\["LAST","BARE","THIN","SHRINK"\]\)/.test(
      pactSrc.replace(/\s/g, ""),
    ) && /\(p\|0\)&15/.test(pactSrc.replace(/\s/g, "")),
  );
}

console.log("\n  TIMES RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
