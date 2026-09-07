import { CFG } from "../src/core/config.js";
import {
  comboOf,
  comboLabel,
  nearMissOf,
  feedFx,
  getCallout,
  getNearMiss,
  initFx,
  syncFx,
  onEvent,
  updateFx,
  getShake,
  setFxOpts,
} from "../src/render/fx.js";
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

console.log("\n  FX RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
