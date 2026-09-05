import {
  COACH_DUR,
  loadCoachSeen,
  saveCoachSeen,
  coachOpen,
} from "../src/app/coach.js";
import { drawCoach } from "../src/render/scenes.js";
import { createGame } from "../src/main.js";
import { SCREEN } from "../src/app/menuapp.js";

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
  while (g.world.time < COACH_DUR) {
    t += 16;
    g.loop(t);
  }
  check(
    "coach survives the full COACH_DUR window (no phantom plant closed it early)",
    g.world.bombs.length === 0,
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

console.log("\n  COACH RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
