import {
  COACH_DUR,
  loadCoachSeen,
  saveCoachSeen,
  coachOpen,
  COACH2_KEY,
  COACH2_DUR,
  loadCoach2,
  saveCoach2,
  coach2Seen,
  coach2Mark,
  coachTip,
  coach2Tick,
} from "../src/app/coach.js";
import { drawCoach, drawCoach2 } from "../src/render/scenes.js";
import { createGame } from "../src/main.js";
import { SCREEN } from "../src/app/menuapp.js";
import { POWER } from "../src/core/entities.js";
import { readFileSync } from "node:fs";

function fakeCanvasTexts() {
  const texts = [];
  const rec = new Proxy(function () {}, {
    get: (t, p) => {
      if (p === Symbol.toPrimitive) return () => "";
      return (...a) => { if (p === "fillText") texts.push(String(a[0])); return rec; };
    },
    apply: () => rec,
    set: () => true,
  });
  return { texts, canvas: { getContext: () => rec, addEventListener() {}, style: {} } };
}

let pass = 0, fail = 0;
function check(n, c, d) { c ? pass++ : fail++; console.log((c ? "  PASS " : "  FAIL ") + n + (d !== undefined ? " -> " + d : "")); }

const mem = new Map();
const store = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
};

check("unseen store is false", loadCoachSeen(store) === false);
check("open at t=0", coachOpen(false, 0, false) === true);
check("closed after DUR", coachOpen(false, COACH_DUR, false) === false);
check("closed after plant", coachOpen(false, 0.4, true) === false);
check("seen never opens", coachOpen(true, 0, false) === false);
saveCoachSeen(store);
check("round-trip", loadCoachSeen(store) === true);

// ---- Task 2 pin: drawCoach draws the WASD + SPACE ghost only while alpha>0 ----
{
  const texts = [];
  const noop = () => {};
  const c = {
    save: noop, restore: noop, translate: noop, scale: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    arc: noop, arcTo: noop, bezierCurveTo: noop, quadraticCurveTo: noop,
    fill: noop, stroke: noop, fillRect: noop, strokeRect: noop,
    clearRect: noop, ellipse: noop, setTransform: noop,
    fillText: (t) => texts.push(String(t)), strokeText: noop,
  };
  drawCoach(c, 1);
  check("drawCoach open draws a W key", texts.some((t) => t.includes("W")), texts.join(","));
  check("drawCoach open draws a SPACE pill", texts.some((t) => t.includes("SPACE")), texts.join(","));
}
{
  // any method call at all (draw or style set) counts as "not silent"
  const calls = [];
  const rec = new Proxy(function () {}, {
    get: (t, p) => {
      if (p === Symbol.toPrimitive) return () => "";
      return (...a) => { calls.push(p); return rec; };
    },
    apply: () => rec,
    set: (t, p) => { calls.push(p); return true; },
  });
  drawCoach(rec, 0);
  check("drawCoach closed draws nothing", calls.length === 0, calls.join(","));
}

// ---- Task 2 wiring: main.js latches the plant/DUR dismiss before the
// renderer's consumeEvents drains world.events, and never draws on ATTRACT
// (whose demo world is state PLAY too). ----
{
  const { texts, canvas } = fakeCanvasTexts();
  const g = createGame(canvas, { autoplay: true, seed: 99 });
  let t = 0;
  g.loop(t);
  check(
    "fresh unseen GAME shows W + SPACE at t=0",
    texts.includes("W") && texts.includes("SPACE"),
    texts.filter((x) => x === "W" || x === "SPACE").join(","),
  );
  while (g.world.time < COACH_DUR) {
    t += 16;
    g.loop(t);
  }
  texts.length = 0;
  for (let i = 0; i < 10; i++) {
    t += 16;
    g.loop(t);
  }
  check(
    "coach fades out once world.time >= COACH_DUR",
    !texts.includes("W") && !texts.includes("SPACE"),
    "time=" + g.world.time.toFixed(2),
  );
}
{
  const { texts, canvas } = fakeCanvasTexts();
  const g = createGame(canvas, { seed: 77 });
  g.app.cabinetSeen = true; // seen cabinet: skip lands on MENU
  g.app.skip(); // INTRO -> MENU
  let t = 1000;
  for (let i = 0; i < 650; i++) { t += 16; g.loop(t); } // cross IDLE_T=10s
  check(
    "idle crosses into ATTRACT with a PLAY-state demo world",
    g.app.screen === SCREEN.ATTRACT && !!g.demo && g.demo.world.state === "PLAY",
    g.app.screen + "/" + (g.demo && g.demo.world.state),
  );
  texts.length = 0;
  for (let i = 0; i < 30; i++) { t += 16; g.loop(t); }
  check(
    "coach never draws on ATTRACT even though the demo world is PLAY",
    !texts.includes("W") && !texts.includes("SPACE"),
    texts.filter((x) => x === "W" || x === "SPACE").join(","),
  );
}
{
  const { texts, canvas } = fakeCanvasTexts();
  const g = createGame(canvas, { autoplay: true, seed: 55 });
  g.loop(0);
  check("coach open before any plant", texts.includes("SPACE"));
  g.world.events.push({ t: "bomb", x: 1, y: 1 }); // simulate a plant this frame
  texts.length = 0;
  g.loop(16);
  check(
    "a plant dismisses the coach even before COACH_DUR elapses",
    !texts.includes("W") && !texts.includes("SPACE"),
    "time=" + g.world.time.toFixed(2),
  );
}
{
  // real persistence round-trip through window.localStorage (highscores.test.mjs
  // precedent): first-ever GAME shows the coach and persists nb.coach.v1 once
  // it closes; a later GAME (fresh createGame) never shows it again.
  const mem2 = new Map();
  const ls = {
    getItem: (k) => (mem2.has(k) ? mem2.get(k) : null),
    setItem: (k, v) => mem2.set(k, String(v)),
  };
  globalThis.window = { localStorage: ls, addEventListener() {} };
  try {
    const { texts, canvas } = fakeCanvasTexts();
    const g1 = createGame(canvas, { autoplay: true, seed: 88 });
    let t = 0;
    g1.loop(t);
    check("first-ever GAME shows the coach", texts.includes("W") && texts.includes("SPACE"));
    while (g1.world.time < COACH_DUR) {
      t += 16;
      g1.loop(t);
    }
    g1.loop((t += 16));
    check("nb.coach.v1 persists once the coach closes", ls.getItem("nb.coach.v1") === "1");

    const { texts: texts2, canvas: canvas2 } = fakeCanvasTexts();
    const g2 = createGame(canvas2, { autoplay: true, seed: 89 });
    g2.loop(0);
    check(
      "a later GAME never shows the coach once seen",
      !texts2.includes("W") && !texts2.includes("SPACE"),
    );
  } finally {
    delete globalThis.window;
  }
}

// ---- CRITICAL 1 regression: a Space held across the moment a run starts
// (INTRO boot / MENU START / ATTRACT all funnel through main.js's onStart,
// the single choke point) must not read as a same-frame bomb plant. Before
// the fix, loadLevel() clears world.fireEdge while the held key leaves
// inp.fire===true, so frame 1's edge check (fire && !fireEdge) fired: a bomb
// landed under spawn AND coachPlanted latched, killing the coach in 2 frames. ----
{
  const { texts, canvas } = fakeCanvasTexts();
  const g = createGame(canvas, { seed: 111 }); // unseen cabinet: boots via INTRO
  g.input._onKey({ code: "Space", preventDefault() {} }); // fire held from INTRO
  g.app.bootFromIntro(); // INTRO -> GAME (onStart), fire still held throughout
  let t = 0;
  g.loop(t);
  t += 20; // t=0 alone never crosses CFG.STEP (no step() runs yet); this is
  g.loop(t); // the first frame that actually advances the sim
  check(
    "held fire across an INTRO-boot run start plants no bomb",
    g.world.bombs.length === 0,
    JSON.stringify(g.world.bombs),
  );
  check(
    "coach still opens at run start despite the held fire",
    texts.includes("W") && texts.includes("SPACE"),
  );
  texts.length = 0;
  while (g.world.time < COACH_DUR) {
    t += 16;
    g.loop(t);
  }
  check(
    "coach survives the full COACH_DUR window (no phantom plant closed it early)",
    g.world.bombs.length === 0 && texts.includes("SPACE"),
  );
}

// ---- IMPORTANT 2 regression: pausing for longer than COACH_DUR of wall
// time must not exhaust the coach window. world.time keeps accumulating
// through PAUSE (sim.js bumps it before the early-return) and loadLevel
// never resets it, so the OLD gate (coachOpen(seen, world.time, planted))
// could read world.time>=COACH_DUR purely from a pause and close the coach
// for the rest of the session. coachT (main.js-owned, PLAY-time only) fixes
// this — pin the pause case. ----
{
  const { texts, canvas } = fakeCanvasTexts();
  const g = createGame(canvas, { autoplay: true, seed: 66 });
  let t = 0;
  g.loop(t);
  check("coach open at run start (pre-pause)", texts.includes("SPACE"));
  g.input.onPause(); // PLAY -> PAUSE
  check("run is paused", g.world.state === "PAUSE");
  let guard = 0;
  while (g.world.time < COACH_DUR + 0.5 && guard < 5000) {
    t += 16;
    g.loop(t);
    guard++;
  }
  check(
    "world.time exceeded COACH_DUR while paused (the bug's precondition)",
    g.world.time >= COACH_DUR,
    "time=" + g.world.time.toFixed(2),
  );
  g.input.onPause(); // PAUSE -> PLAY
  texts.length = 0;
  g.loop((t += 16));
  check(
    "coach still draws after a world.time-exhausting pause (coachT tracked PLAY time only)",
    texts.includes("W") && texts.includes("SPACE"),
  );
}

// ---- parked: pause RESTART has the same loadLevel/fireEdge hole onStart used
// to. A Space held across the confirm must not plant on frame 1. ----
{
  const { canvas } = fakeCanvasTexts();
  const g = createGame(canvas, { autoplay: true, seed: 77 });
  g.input._onKey({ code: "Space", preventDefault() {} });
  let t = 0;
  g.loop(t);
  t += 20;
  g.loop(t);
  check("held fire after autoplay onStart has not planted", g.world.bombs.length === 0);
  g.input.onPause();
  t += 20;
  g.loop(t);
  g.app.pauseCursor = 1;
  g.app.confirm(); // RESTART
  check("pause RESTART reloads L1 PLAY", g.world.level === 1 && g.world.state === "PLAY");
  t += 20;
  g.loop(t);
  t += 20;
  g.loop(t);
  check(
    "held fire across pause RESTART plants no bomb",
    g.world.bombs.length === 0,
    JSON.stringify(g.world.bombs),
  );
}

// ---- R10 pin 1: the copy is DERIVED, and equals the printed strings ----
{
  check(
    "coachTip composes the three locked strings verbatim",
    coachTip("kick") === "KICK · walk into a bomb to slide it" &&
      coachTip("throw") === "THROW · Shift+Space tosses a bomb" &&
      coachTip("remote") === "REMOTE · Q detonates your bombs",
    [coachTip("kick"), coachTip("throw"), coachTip("remote")].join(" | "),
  );
  /* Both halves matter: the strings above are what ships, and this asserts they
     are the SAME strings the ITEMS help screen shows. A future POWER[].help
     edit then reads as the copy change it is, instead of forking one line of
     help into two that quietly disagree. */
  check(
    "and they are literally POWER's own name + help — one source, never two",
    ["kick", "throw", "remote"].every((k) => {
      const d = POWER.find((x) => x.t === k);
      return coachTip(k) === d.name + " · " + d.help;
    }),
  );
  check(
    "coach.js authors no tip copy of its own",
    !/walk into a bomb|Shift\+Space|detonates your bombs/.test(
      readFileSync("src/app/coach.js", "utf8"),
    ),
  );
  check(
    "a verb with no tip is the empty string, never undefined",
    coachTip("fire") === "" && coachTip(undefined) === "" && coachTip(null) === "",
    JSON.stringify(coachTip("fire")),
  );
  /* Deviation from the design doc (2026-09-07-retention-wave2-design.md §6.2),
     which states 34: "KICK · walk into a bomb to slide it".length is actually
     35 (measured here from POWER's own strings) — a one-off miscount in the
     doc's arithmetic, not a code bug. drawCoach2's pill width is derived from
     the live string length, so nothing downstream depended on the wrong figure. */
  check(
    "the longest tip is 35 chars, measured from POWER's own strings",
    Math.max(...["kick", "throw", "remote"].map((k) => coachTip(k).length)) === 35,
    String(Math.max(...["kick", "throw", "remote"].map((k) => coachTip(k).length))),
  );
}

// ---- R10 pin 2: the store, on the shared template ----
{
  check("COACH2_KEY is nb.coach.v2", COACH2_KEY === "nb.coach.v2", COACH2_KEY);
  check(
    "COACH2_DUR equals COACH_DUR — one timing rule, not two",
    COACH2_DUR === COACH_DUR && COACH2_DUR === 3,
    COACH2_DUR + "/" + COACH_DUR,
  );
  const m2 = new Map();
  const st = {
    getItem: (k) => (m2.has(k) ? m2.get(k) : null),
    setItem: (k, v) => m2.set(k, String(v)),
  };
  check(
    "an unseen cabinet is all zeros",
    JSON.stringify(loadCoach2(st)) === '{"k":0,"t":0,"r":0}',
    JSON.stringify(loadCoach2(st)),
  );
  const a = coach2Mark(loadCoach2(st), "throw");
  check("coach2Mark returns a NEW object, never mutating", a.t === 1 && loadCoach2(st).t === 0);
  saveCoach2(a, st);
  check(
    "round-trip through an injected store",
    loadCoach2(st).t === 1 && loadCoach2(st).k === 0,
    JSON.stringify(loadCoach2(st)),
  );
  check(
    "coach2Seen reads the bit for each verb and ignores the rest",
    coach2Seen(loadCoach2(st), "throw") === true &&
      coach2Seen(loadCoach2(st), "kick") === false &&
      coach2Seen(loadCoach2(st), "fire") === false,
  );
  check(
    "coach2Mark on an unknown verb is a no-op rather than a new field",
    JSON.stringify(coach2Mark(loadCoach2(st), "fire")) === JSON.stringify(loadCoach2(st)),
  );
  const junk = new Map();
  const bad = {
    getItem: () => '{"k":"yes","t":5,"r":null,"zzz":1}',
    setItem: (k, v) => junk.set(k, String(v)),
  };
  check(
    "a junk blob clamps to the three-bit shape",
    JSON.stringify(loadCoach2(bad)) === '{"k":1,"t":1,"r":0}',
    JSON.stringify(loadCoach2(bad)),
  );
  let threw = false;
  try {
    const hostile = { getItem() { throw new Error("nope"); }, setItem() { throw new Error("nope"); } };
    loadCoach2(hostile);
    saveCoach2({ k: 1, t: 0, r: 0 }, hostile);
  } catch (_) {
    threw = true;
  }
  check("neither loadCoach2 nor saveCoach2 throws on a hostile store", !threw);
  check(
    "a corrupt blob degrades to zeros",
    JSON.stringify(loadCoach2({ getItem: () => "{not json", setItem() {} })) ===
      '{"k":0,"t":0,"r":0}',
  );
}

// ---- R10 pin 3: silent when closed, and painted at both draw sites ----
{
  const silent = (alpha, text) => {
    const calls = [];
    const rec = new Proxy(function () {}, {
      get: (t, p) => {
        if (p === Symbol.toPrimitive) return () => "";
        return (...a) => { calls.push(p); return rec; };
      },
      apply: () => rec,
      set: (t, p) => { calls.push(p); return true; },
    });
    drawCoach2(rec, alpha, text);
    return calls.length === 0;
  };
  check("drawCoach2 with alpha 0 draws nothing", silent(0, "KICK · x"));
  check("drawCoach2 with an empty tip draws nothing", silent(1, ""));
  check("drawCoach2 with no tip at all draws nothing", silent(1, undefined));
  const texts = [];
  const noop = () => {};
  const c = {
    save: noop, restore: noop, translate: noop, scale: noop, beginPath: noop,
    closePath: noop, moveTo: noop, lineTo: noop, arc: noop, arcTo: noop,
    bezierCurveTo: noop, quadraticCurveTo: noop, ellipse: noop, fill: noop,
    stroke: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
    setTransform: noop,
    fillText: (t) => texts.push(String(t)), strokeText: noop,
  };
  drawCoach2(c, 1, coachTip("kick"));
  check(
    "an open tip paints its finished string, unmodified",
    texts.length === 1 && texts[0] === "KICK · walk into a bomb to slide it",
    texts.join("|"),
  );
  check(
    "scenes.js reuses v1's panel constants rather than declaring a second set",
    (() => {
      const src = readFileSync("src/render/scenes.js", "utf8");
      return (src.match(/const COACH_TEXT =/g) || []).length === 1 &&
        (src.match(/COACH_PANEL/g) || []).length >= 2 &&
        !/COACH2_PANEL|COACH2_TEXT|COACH2_LINE/.test(src);
    })(),
  );
  check(
    "scenes.js never re-derives the tip — main hands the finished string down",
    !/POWER|coachTip/.test(readFileSync("src/render/scenes.js", "utf8")),
  );
  /* Wave-1's own bug class: one draw site updated, one not. Both are asserted
     in the same pin so they cannot land in different commits. */
  for (const [f, needle] of [
    ["src/render/renderer.js", "drawCoach(ctx, (o&&o.coach)||0)"],
    ["src/render/three/wrapper.js", "drawCoach(ovCtx,(o&&o.coach)||0)"],
  ]) {
    const src = readFileSync(f, "utf8");
    check(
      f + ": drawCoach2 is wired under the same o.hud===true gate as drawCoach",
      src.indexOf(needle) > 0 &&
        /if\s*\(\s*o\s*&&\s*o\.hud\s*===\s*true\s*\)\s*drawCoach2\(/.test(src) &&
        src.indexOf("drawCoach2(") > src.indexOf(needle),
      (src.match(/.*drawCoach2\(.*/) || [""])[0].trim(),
    );
  }
}

console.log("\n  COACH RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
