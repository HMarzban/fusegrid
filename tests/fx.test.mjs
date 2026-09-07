import { CFG } from "../src/core/config.js";
import {
  comboOf,
  comboLabel,
  nearMissOf,
  feedFx,
  getCallout,
  getNearMiss,
  drawFxOverlay,
  initFx,
  syncFx,
  onEvent,
  updateFx,
  getShake,
  getFx,
  setFxOpts,
} from "../src/render/fx.js";
import { createRenderer } from "../src/render/renderer.js";
import { createRenderer3D } from "../src/render/three/wrapper.js";
import { createWorld, loadLevel, step, newIntent } from "../src/core/sim.js";
import { readFileSync } from "node:fs";

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

/* Tile centres are (t + 0.5) * TILE, so tile 5 centres at 220px. Every dmin
   below is a Chebyshev distance from the player point to a blade tile CENTRE,
   which is the same geometry sim.js:342's aabb call tests. */
const ctr = (t) => (t + 0.5) * CFG.TILE;
const blade = (...tiles) => ({ tiles: tiles.map(([tx, ty]) => ({ tx, ty })) });
const mkW = (px, py, blades, events, over) => ({
  state: "PLAY",
  seed: 1,
  level: 1,
  players: [Object.assign({ alive: true, iFrames: 0, x: px, y: py }, over || {})],
  blades: blades || [],
  events: events || [],
});

// ---- 1. comboOf: the boom gate is the discriminator ----
{
  const kills = Object.freeze([
    Object.freeze({ t: "kill" }),
    Object.freeze({ t: "kill" }),
    Object.freeze({ t: "kill" }),
  ]);
  check(
    "comboOf: a boom-free batch is blade attrition, scores 0",
    comboOf(kills) === 0,
    comboOf(kills),
  );
  const chain = Object.freeze(kills.concat([Object.freeze({ t: "boom" })]));
  check(
    "comboOf: 3 kills that arrive with a boom are a 3-combo",
    comboOf(chain) === 3,
    comboOf(chain),
  );
  check(
    "comboOf: a boom with no kills is 0",
    comboOf([{ t: "boom" }]) === 0 && comboOf([{ t: "boom" }, { t: "brick" }]) === 0,
  );
  check(
    "comboOf: deep-frozen input, no throw and no mutation",
    kills.length === 3 && chain.length === 4 && comboOf(kills) === 0,
  );
  check(
    "comboOf: junk input is 0, never a throw",
    comboOf(null) === 0 && comboOf(undefined) === 0 && comboOf([]) === 0,
  );
}

// ---- 2. comboLabel: the locked tier copy ----
{
  const want = [
    [0, ""],
    [1, ""],
    [2, "DOUBLE"],
    [3, "TRIPLE"],
    [4, "QUAD"],
    [5, "CHAIN ×5"],
    [11, "CHAIN ×11"],
  ];
  const bad = want.filter(([n, s]) => comboLabel(n) !== s);
  check(
    "comboLabel: 1 silent, 2 DOUBLE, 3 TRIPLE, 4 QUAD, >=5 CHAIN ×n",
    !bad.length,
    JSON.stringify(bad.map(([n]) => [n, comboLabel(n)])),
  );
}

// ---- 3. nearMissOf: a Chebyshev annulus, 32 < dmin <= 44 ----
{
  check(
    "nearMissOf: dmin 0 (standing in the blast) is not a near miss",
    nearMissOf(mkW(ctr(5), ctr(5), [blade([5, 5])])) === false,
  );
  check(
    "nearMissOf: dmin 32 is a HIT (the aabb envelope), not a near miss",
    nearMissOf(mkW(228, ctr(5), [blade([6, 5])])) === false,
  );
  check(
    "nearMissOf: dmin 40 (one aligned tile away) is a near miss",
    nearMissOf(mkW(ctr(5), ctr(5), [blade([6, 5])])) === true,
  );
  check(
    "nearMissOf: dmin 44 is the outer bound, still a near miss",
    nearMissOf(mkW(216, ctr(5), [blade([6, 5])])) === true,
  );
  check(
    "nearMissOf: dmin 48 is just a blast somewhere, not a near miss",
    nearMissOf(mkW(212, ctr(5), [blade([6, 5])])) === false,
  );
  check(
    "nearMissOf: iFrames > 0 disqualifies",
    nearMissOf(mkW(ctr(5), ctr(5), [blade([6, 5])], [], { iFrames: 0.5 })) === false,
  );
  check(
    "nearMissOf: a dead player disqualifies",
    nearMissOf(mkW(ctr(5), ctr(5), [blade([6, 5])], [], { alive: false })) === false,
  );
  check(
    "nearMissOf: a {t:'hurt'} in the batch disqualifies (the shielded hit)",
    nearMissOf(mkW(ctr(5), ctr(5), [blade([6, 5])], [{ t: "hurt" }])) === false,
  );
  check(
    "nearMissOf: no blades, no near miss",
    nearMissOf(mkW(ctr(5), ctr(5), [])) === false &&
      nearMissOf(mkW(ctr(5), ctr(5), [{ tiles: [] }])) === false,
  );
  /* The MINIMUM over all blades is what stops a player standing inside one
     blast from being congratulated for a second one next door: tile (8,4)
     centres 40 away (dx 20, dy 40) and alone reads as a near miss; tile (8,5)
     centres 20 away and kills it. */
  check(
    "nearMissOf: a single blade at dmin 40 reads as a near miss",
    nearMissOf(mkW(320, ctr(5), [blade([8, 4])])) === true,
  );
  check(
    "nearMissOf: a second blade at dmin 20 takes the minimum and disqualifies",
    nearMissOf(mkW(320, ctr(5), [blade([8, 4]), blade([8, 5])])) === false,
  );
  check(
    "nearMissOf: events defaults to world.events, and the explicit arg wins",
    nearMissOf(mkW(ctr(5), ctr(5), [blade([6, 5])], [{ t: "hurt" }])) === false &&
      nearMissOf(mkW(ctr(5), ctr(5), [blade([6, 5])], [{ t: "hurt" }]), []) === true,
  );
  const w = mkW(ctr(5), ctr(5), [blade([6, 5])]);
  const before = JSON.stringify(w);
  nearMissOf(w);
  check("nearMissOf: pure — the world is not mutated", JSON.stringify(w) === before);
}

/* A PLAY world whose drained batch is n kills plus the boom that produced
   them — the [kills...][boom] group detonate() actually pushes. */
const chainW = (n, px, py, blades) => {
  const ev = [];
  for (let i = 0; i < n; i++) ev.push({ t: "kill", x: 0, y: 0 });
  ev.push({ t: "boom", x: 0, y: 0 });
  return mkW(px === undefined ? ctr(1) : px, py === undefined ? ctr(1) : py,
    blades || [], ev);
};

// ---- 4. REDUCE FLASH suppresses the close-call ENTIRELY, at feed time ----
{
  initFx();
  setFxOpts({ flashK: 0.25 });
  const near = chainW(1, ctr(5), ctr(5), [blade([6, 5])]);
  syncFx(near);
  feedFx(near, CFG.STEP);
  check(
    "REDUCE FLASH: flashK 0.25 means nmT is never even set",
    getNearMiss() === 0,
    getNearMiss(),
  );
  initFx();
  setFxOpts({ flashK: 1 });
  const near2 = chainW(1, ctr(5), ctr(5), [blade([6, 5])]);
  syncFx(near2);
  feedFx(near2, CFG.STEP);
  check(
    "REDUCE FLASH off: the same frame does set nmT",
    getNearMiss() > 0,
    getNearMiss(),
  );
  const first = getNearMiss();
  const near3 = chainW(1, ctr(5), ctr(5), [blade([6, 5])]);
  feedFx(near3, CFG.STEP);
  check(
    "close-call cooldown: a second near-miss frame does not re-arm inside 0.60s",
    getNearMiss() < first,
    getNearMiss() + " vs " + first,
  );
}

// ---- 5. R2 adds NO shake (pinned as an absence, with a live control) ----
{
  setFxOpts({ flashK: 1, shakeK: 1 });
  initFx();
  const w = chainW(5);
  const evs = w.events.slice();
  feedFx(w, CFG.STEP);
  updateFx(CFG.STEP);
  const s1 = getShake();
  check(
    "feedFx contributes no shake on a 5-kill boom batch",
    s1.x === 0 && s1.y === 0,
    JSON.stringify(s1),
  );
  initFx();
  for (const e of evs) onEvent(w, e, 0);
  let moved = false;
  for (let i = 0; i < 8; i++) {
    updateFx(CFG.STEP);
    const s = getShake();
    if (s.x !== 0 || s.y !== 0) moved = true;
  }
  check(
    "control: the existing onEvent path DOES shake, so the pin above is not vacuous",
    moved,
  );
}

// ---- 6. syncFx clears an open group across a world-identity change ----
{
  initFx();
  const w = chainW(2);
  syncFx(w);
  feedFx(w, CFG.STEP);
  check("group open, nothing emitted yet", getCallout() === "", getCallout());
  const next = Object.assign({}, w, { level: 2, events: [] });
  syncFx(next);
  check(
    "syncFx on a changed seed:level emits nothing",
    getCallout() === "",
    getCallout(),
  );
  feedFx(next, CFG.BLADE_TTL + 0.01);
  check(
    "and the group is gone, not merely paused — the window passes silently",
    getCallout() === "",
    getCallout(),
  );
}

// ---- SELF-REVIEW (closing fix wave, finding 2): a SAME-LEVEL restart must
// also retag, not only a seed:level change. startGame() (sim.js:107-111) and
// pause RESTART (main.js) both call loadLevel(world,1,false) on a room-1
// death/restart — same seed, same level, so the seed:level STRING never
// changes. loadLevel (world.js:74) reassigns `w.rng` to a brand-new object on
// every call regardless (the only `.rng =` in src/), so folding that identity
// into the tag is what makes the restart wipe stale R2 state/particles too. ----
{
  const w = createWorld(1, 1);
  loadLevel(w, 1, false);
  w.state = "PLAY";
  syncFx(w); // first room load: establishes the tag against this exact world

  // Open + resolve a callout, and leave live particles, on THIS world.
  const ev = [];
  for (let i = 0; i < 3; i++) ev.push({ t: "kill", x: 0, y: 0 });
  ev.push({ t: "boom", x: 0, y: 0 });
  w.events = ev;
  feedFx(w, CFG.STEP); // opens the 3-group
  onEvent(w, { t: "boom", x: 40, y: 40 }); // also leaves live particles
  w.events = [];
  feedFx(w, CFG.BLADE_TTL + 0.01); // resolves the group into a callout
  check(
    "setup: a callout is live before the restart",
    getCallout() === "TRIPLE",
    getCallout(),
  );
  check(
    "setup: particles are live before the restart",
    getFx().length > 0,
    getFx().length,
  );

  // LOSE -> a fire press -> the REAL startGame() path through step() itself
  // (sim.js:67-74 -> :107-111): a SAME-LEVEL restart, same seed, only
  // world.rng's object identity actually changes.
  w.state = "LOSE";
  w.fireEdge = false;
  const it = newIntent();
  it.fire = true;
  step(w, CFG.STEP, { 0: it });
  check(
    "control: this really is a same-level restart (seed/level unchanged)",
    w.level === 1 && w.state === "PLAY",
    w.level + "/" + w.state,
  );

  // First PLAY frame of the NEW run: both renderers call syncFx(world) before
  // draining events (renderer.js/wrapper.js), so this is what the player's
  // very first frame actually sees.
  w.events = [];
  syncFx(w);
  check(
    "R2: syncFx wipes the stale callout on a same-level restart",
    getCallout() === "",
    getCallout(),
  );
  check(
    "R2: syncFx wipes stale particles on a same-level restart",
    getFx().length === 0,
    getFx().length,
  );
}

// ---- 8. PLAY-only gate: feedFx owns the decay, and freezes outside PLAY ----
{
  initFx();
  const w = chainW(3);
  syncFx(w);
  feedFx(w, CFG.STEP);
  check("PLAY frame opens a 3-group, emits nothing yet", getCallout() === "");
  feedFx(Object.assign({}, w, { state: "PAUSE", events: [] }), 0.5);
  check(
    "PAUSE freezes the group — a paused clock never closes it",
    getCallout() === "",
    getCallout(),
  );
  feedFx(Object.assign({}, w, { state: "WIN", events: [] }), 0.5);
  check(
    "WIN freezes it too — no callout over the CLEARED veil",
    getCallout() === "",
    getCallout(),
  );
  feedFx(Object.assign({}, w, { events: [] }), CFG.BLADE_TTL);
  check(
    "back on PLAY the group resolves at its ORIGINAL remaining time",
    getCallout() === "TRIPLE",
    getCallout(),
  );
  const held = getCallout();
  updateFx(0.5);
  updateFx(0.5);
  check(
    "updateFx alone never advances the R2 timers — feedFx owns the decay",
    getCallout() === held,
    getCallout(),
  );
  feedFx(Object.assign({}, w, { events: [] }), 1.0);
  check("a PLAY frame past the ttl clears the callout", getCallout() === "");
}

// ---- wiring: feedFx sits between syncFx and the length=0 wipe, both paths ----
{
  for (const f of ["src/render/renderer.js", "src/render/three/wrapper.js"]) {
    const src = readFileSync(f, "utf8");
    const i = src.indexOf("syncFx(world);"),
      j = src.indexOf("feedFx(world"),
      k = src.indexOf("world.events.length=0");
    check(
      f + ": feedFx runs after syncFx and BEFORE the events wipe",
      i >= 0 && j > i && k > j,
      JSON.stringify({ i, j, k }),
    );
    check(
      f + ": feedFx is dt-guarded exactly like the updateFx beneath it",
      /feedFx\(world,\s*dt\s*\|\|\s*CFG\.STEP\)/.test(src),
      (src.match(/feedFx\([^)]*\)/) || [])[0],
    );
  }
}

// ---- 7. drawFxOverlay: the callout text and the close-call border ----
{
  const recCtx = () => {
    const texts = [],
      strokes = [],
      rects = [];
    const noop = () => {};
    const c = {
      save: noop,
      restore: noop,
      translate: noop,
      scale: noop,
      beginPath: noop,
      fill: noop,
      stroke: noop,
      fillText: (s) => texts.push(String(s)),
      strokeText: (s) => strokes.push(String(s)),
      fillRect: (x, y, w, h) => rects.push({ x, y, w, h, fill: c.fillStyle }),
    };
    return { c, texts, strokes, rects };
  };

  setFxOpts({ flashK: 1, shakeK: 1 });
  initFx();
  const w = chainW(3);
  syncFx(w);
  feedFx(w, CFG.BLADE_TTL + 0.01);
  const a = recCtx();
  drawFxOverlay(a.c);
  check(
    "drawFxOverlay paints the TRIPLE callout, outlined then filled",
    a.texts.includes("TRIPLE") && a.strokes.includes("TRIPLE"),
    a.texts.join("|"),
  );

  initFx();
  const b = recCtx();
  drawFxOverlay(b.c);
  check(
    "drawFxOverlay paints nothing when no callout and no flash are live",
    b.texts.length === 0 && b.rects.length === 0,
    b.texts.join("|") + " / " + b.rects.length,
  );

  initFx();
  const near = chainW(1, ctr(5), ctr(5), [blade([6, 5])]);
  syncFx(near);
  feedFx(near, CFG.STEP);
  const d = recCtx();
  drawFxOverlay(d.c);
  const band = d.rects.filter((r) => r.fill === "#fff8d8");
  check(
    "close-call paints a 6px inner border of the 600x520 board box in #fff8d8",
    band.length === 4 &&
      band.some((r) => r.w === CFG.COLS * CFG.TILE && r.h === 6) &&
      band.some((r) => r.h === CFG.ROWS * CFG.TILE - 12 && r.w === 6),
    JSON.stringify(band),
  );
}

// ---- wiring: drawFxOverlay is gated on o.hud===true, so ATTRACT stays silent ----
{
  for (const [f, chips] of [
    ["src/render/renderer.js", "drawHudChips(ctx, world"],
    ["src/render/three/wrapper.js", "drawHudChips(ovCtx,world"],
  ]) {
    const src = readFileSync(f, "utf8");
    const line = (src.match(/^.*drawFxOverlay\(.*$/m) || [""])[0];
    check(
      f + ": drawFxOverlay is drawn only under o.hud===true",
      /o\s*&&\s*o\.hud\s*===\s*true/.test(line),
      line.trim(),
    );
    check(
      f + ": it sits between the HUD chips and the coach",
      src.indexOf(chips) < src.indexOf("drawFxOverlay(") &&
        src.indexOf("drawFxOverlay(") < src.lastIndexOf("drawCoach("),
      line.trim(),
    );
    check(
      f + ": drawFxOverlay is ALSO gated on world.state===\"PLAY\", so a" +
        " frozen callout (calT>0 while PAUSE/WIN/LOSE holds feedFx's decay)" +
        " never paints over the state veil",
      /o\s*&&\s*o\.hud\s*===\s*true\s*&&\s*world\.state\s*===\s*"PLAY"/.test(
        line,
      ),
      line.trim(),
    );
  }
}

// ---- behavioral: a live callout (calT>0, frozen by feedFx's PLAY-only
//      decay) must not be painted on top of the PAUSED/WIN/LOSE veil, and
//      must resume painting the instant world.state is PLAY again ----
{
  const overlayRecorder = () => {
    const ops = [];
    const grad = { addColorStop: (...a) => ops.push(["addColorStop", a]) };
    const rec = new Proxy(function () {}, {
      get: (t, p) => {
        if (p === Symbol.toPrimitive) return () => "";
        return (...a) => {
          ops.push([String(p), a]);
          return grad;
        };
      },
      set: (t, p, v) => {
        ops.push(["set:" + String(p), v]);
        return true;
      },
    });
    return { rec, ops };
  };
  const hasCallout = (ops) =>
    ops.some((o) => o[0] === "fillText" && String(o[1][0]) === "TRIPLE");

  for (const mk of [
    () => {
      const rec = overlayRecorder();
      const r = createRenderer({ getContext: () => rec.rec }, {
        kind: "2d",
        hud: null,
        audio: null,
      });
      return { name: "renderer.js", r, ops: rec.ops };
    },
    () => {
      const rec = overlayRecorder();
      const r = createRenderer3D(null, { getContext: () => rec.rec }, {
        audio: null,
        hud: null,
      });
      return { name: "wrapper.js", r, ops: rec.ops };
    },
  ]) {
    // Renderer construction FIRST — renderer.js's factory calls initFx()
    // internally, so any callout set up before this point would already be
    // wiped by the time render() runs.
    const { name, r, ops } = mk();

    // Force a live callout into the fx singleton on the EXACT SAME world
    // object the PAUSE render below reuses (closing fix wave, finding 2):
    // syncFx now folds world.rng's object identity into its tag, so two
    // independently-built worlds sharing only a seed:level STRING (the old
    // chainW/mkW fixture vs a real createWorld) no longer count as "the same
    // world" — loadLevel always hands out a fresh `w.rng`. One real world,
    // reused for setup and for both render() probes, keeps the identity the
    // PAUSE render's own syncFx(world) call checks against unchanged.
    setFxOpts({ flashK: 1, shakeK: 1 });
    initFx();
    const pw = createWorld(1, 1);
    loadLevel(pw, 1, false);
    pw.state = "PLAY";
    syncFx(pw);
    const ev = [];
    for (let i = 0; i < 3; i++) ev.push({ t: "kill", x: 0, y: 0 });
    ev.push({ t: "boom", x: 0, y: 0 });
    pw.events = ev;
    feedFx(pw, CFG.STEP); // opens the 3-group
    pw.events = [];
    feedFx(pw, CFG.BLADE_TTL + 0.01); // resolves it into TRIPLE
    check(
      name + ": setup — the callout is live (TRIPLE) before the render probes",
      getCallout() === "TRIPLE",
      getCallout(),
    );

    pw.events = [];
    pw.state = "PAUSE";
    const mark1 = ops.length;
    r.render(pw, 1 / 60, { hud: true });
    const pauseOps = ops.slice(mark1);
    check(
      name + ": a live callout is NOT painted over the PAUSE veil",
      !hasCallout(pauseOps),
      pauseOps
        .filter((o) => o[0] === "fillText")
        .map((o) => o[1][0])
        .join("|"),
    );
    check(
      name + ": the callout survives the PAUSE frame untouched" +
        " (feedFx no-ops outside PLAY)",
      getCallout() === "TRIPLE",
      getCallout(),
    );

    // Same world, same renderer — only the state flips back to PLAY.
    pw.state = "PLAY";
    const mark2 = ops.length;
    r.render(pw, 1 / 60, { hud: true });
    const playOps = ops.slice(mark2);
    check(
      name + ": back on a PLAY frame the callout paints again",
      hasCallout(playOps),
      playOps
        .filter((o) => o[0] === "fillText")
        .map((o) => o[1][0])
        .join("|"),
    );
  }
}

console.log("\n  FX RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
