/* REAL 3D renderer clock (2026-10-25): world.time keeps ticking in PAUSE, so the wrapper hands the scene world.time minus every second spent paused. A death or collect burst that is mid-flight at the pause must play out its REST after the resume, not find itself long over. */
import test from "node:test";
import assert from "node:assert/strict";
import { CFG } from "../src/core/config.js";
import { POWER } from "../src/core/entities.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { createRenderer3D } from "../src/render/three/wrapper.js";
import { MOTION, COLLECT_T } from "../src/render/motion.js";

const T = CFG.TILE, DT = 1 / 60;
const mkE = (type, x, y) => ({ type, x, y, tx: Math.floor(x / T), ty: Math.floor(y / T), dir: { x: 0, y: 1 }, speed: 1, color: "#8affc1", r: T * 0.34, pass: false, dead: false, invuln: false, invulnT: 0, cd: 4, home: { x: 5, y: 5 } });
const rig = () => {
  const r = createRenderer3D(null, null, { audio: null, hud: null });
  const w = createWorld(61, 1); loadLevel(w, 1, false);
  const e = mkE("walker", 200, 200), pd = POWER.find((p) => p.t === "fire");
  const it = { x: 280, y: 200, t: "fire", col: pd.col, taken: false, pdef: pd };
  w.enemies = [e]; w.items = [it]; w.state = "PLAY";
  const pools = () => { let p = null; r._dbg.scene.traverse((o) => { if (o.userData && o.userData.pools) p = o.userData.pools; }); return p; };
  const tick = (n) => { for (let k = 0; k < n; k++) { w.time += DT; r.render(w, DT); } };
  tick(6);
  e.dead = true; w.enemies = []; it.taken = true;
  w.events.push({ t: "kill", x: e.x, y: e.y, color: e.color, type: "walker" }, { t: "power", kind: "fire", x: it.x, y: it.y, col: pd.col });
  return { r, w, pools, tick };
};

const idle = (w, tick, secs, step = 0.25) => { w.state = "PAUSE"; tick(1); for (let k = 0; k < secs / step; k++) { w.time += step - DT; tick(1); } };

test("a PAUSE of 10 s mid-death and mid-burst resumes the REST of both animations", () => {
  const { w, pools, tick } = rig();
  tick(4);
  assert.ok(pools().deadSlots.some((s) => s.visible) && pools().burst.count > 0, "both live before the pause");
  idle(w, tick, 10);
  w.state = "PLAY"; tick(2);
  assert.ok(pools().deadSlots.some((s) => s.visible), "the death body is still there after the pause");
  assert.ok(pools().burst.count > 0, "the burst is still there after the pause");
  tick(Math.ceil(Math.max(MOTION.DEATH_T, COLLECT_T) / DT) + 4);
  assert.ok(pools().deadSlots.every((s) => !s.visible) && pools().burst.count === 0, "and both still end on their own clock");
});

test("the paused board holds still, and a second pause stacks on the first", () => {
  const { w, pools, tick } = rig();
  tick(3);
  idle(w, tick, 5); w.state = "PLAY"; tick(3);
  idle(w, tick, 7); w.state = "PLAY"; tick(2);
  assert.ok(pools().deadSlots.some((s) => s.visible), "two pauses later the death is still on screen (about 0.15 s of 0.35)");
});

test("a fresh world restarts the clock: no skew carries over", () => {
  const { w, r, tick } = rig();
  tick(3); idle(w, tick, 6); w.state = "PLAY"; tick(1);
  const w2 = createWorld(62, 1); loadLevel(w2, 1, false); w2.state = "PLAY";
  const pools = () => { let p = null; r._dbg.scene.traverse((o) => { if (o.userData && o.userData.pools) p = o.userData.pools; }); return p; };
  const e = mkE("walker", 200, 200); w2.enemies = [e];
  for (let k = 0; k < 6; k++) { w2.time += DT; r.render(w2, DT); }
  e.dead = true; w2.enemies = []; w2.events.push({ t: "kill", x: e.x, y: e.y, color: e.color, type: "walker" });
  for (let k = 0; k < 3; k++) { w2.time += DT; r.render(w2, DT); }
  assert.ok(pools().deadSlots.some((s) => s.visible), "a death in the new world shows");
});
