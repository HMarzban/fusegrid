/* Top corners of the board with the HUD off it (UI upgrade Task 8.2, round 5 09-hud): the chips and the power-ups bar draw on #hud above and
   below the board, so frame.js carves no HUD plate into the top rampart any more and the rampart keeps its own corner pieces in every look.
   Before, hudPlate (CLASSIC + PIXEL) and hudPlate3 (REAL 3D) cut a band into row 0 and re-dressed its corners (end caps, a corner boss at the
   plate's foot); this pins that they are gone and that an in-run frame paints the board exactly as a HUD-less one. */
import test from "node:test";
import assert from "node:assert/strict";
import * as frame from "../src/render/frame.js";
import {createRenderer} from "../src/render/renderer.js";
import {createWorld, loadLevel} from "../src/core/sim.js";
import {initFx} from "../src/render/fx.js";

function rec() {
  const log = [];
  const fmt = (v) => (typeof v === "number" ? v.toFixed(3) : typeof v === "string" ? v : v && typeof v === "object" ? "{o}" : String(v));
  const mk = (tag) => new Proxy({}, {
    get(o, k) {
      if (k in o) return o[k];
      if (k === "canvas") return {width: 600, height: 520};
      return (...a) => { log.push(tag + String(k) + "(" + a.map(fmt).join(",") + ")"); return String(k).startsWith("create") ? mk("g.") : String(k) === "measureText" ? {width: 10} : undefined; };
    },
    set(o, k, v) { log.push(tag + String(k) + "=" + fmt(v)); o[k] = v; return true; },
  });
  return {c: mk(""), log};
}

test("frame.js carves no HUD plate into the top rampart (hudPlate, hudPlate3, CAPS, TOP_BOSS are gone)", () => {
  for (const k of ["hudPlate", "hudPlate3", "CAPS", "TOP_BOSS"]) assert.equal(k in frame, false, k);
  assert.deepEqual(Object.keys(frame).sort(), ["glowOf", "stageBack", "stageGlow", "wellBoard", "wellPx"]);
});

test("an in-run CLASSIC frame (hud:true) paints the board, top rampart corners included, exactly as a HUD-less one", () => {
  for (let level = 1; level <= 8; level++) {
    const frameLog = (o) => {
      initFx();
      const w = createWorld(4242, level);
      loadLevel(w, level);
      w.state = "PLAY";
      const r = rec(), ren = createRenderer({width: 600, height: 520, getContext: () => r.c}, {kind: "2d"});
      ren.render(w, 1 / 60, o);
      return r.log;
    };
    const a = frameLog({hud: true}), b = frameLog({hud: false, amb: true});
    assert.deepEqual(a, b, "level " + level);
  }
});
