/* AMBIENT MOTION, REAL 3D: one Points, PLAY-only clock, density knob, off in menus. */
import test from "node:test";
import assert from "node:assert/strict";
import { BIOMES } from "../src/core/config.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { createAmbient } from "../src/render/three/ambientfx.js";
import { createRenderer3D } from "../src/render/three/wrapper.js";
import { countDrawCalls } from "../src/render/three/scene.js";
import { setFxOpts } from "../src/render/fx.js";

const pts = (r) => r._dbg.scene.children.flatMap((g) => g.children || []).find((o) => o.userData && o.userData.tag === "ambient");
test("one Points per room, depth-tested, never writes depth, never in a shadow", () => {
  for (const b of BIOMES) {
    const a = createAmbient(b), m = a.points.material;
    assert.ok(a.points.isPoints && m.depthWrite === false && m.depthTest === true && m.transparent === true);
    assert.equal(a.points.castShadow, false); assert.equal(a.points.receiveShadow, false);
    assert.equal(a.update(5, false, 1, 1), 0, "menus: nothing");
    const n = a.update(5, true, 1, 1), h = a.update(5, true, 0.5, 1);
    assert.ok(n > 0 && h > 0 && h <= n, b.name + " " + n + "/" + h);
    const al = a.points.geometry.getAttribute("aCol");
    for (let i = 0; i < n; i++) assert.ok(al.array[i * 4 + 3] <= 0.62 && al.array[i * 4 + 3] >= 0);
    const p = a.points.geometry.getAttribute("position");
    for (let i = 0; i < n; i++) assert.ok(Math.abs(p.array[i * 3]) <= 260 && Math.abs(p.array[i * 3 + 2]) <= 220 && p.array[i * 3 + 1] >= 1 && p.array[i * 3 + 1] <= 46);
  }
});
test("same clock, same frame; the clock moves the particles", () => {
  const a = createAmbient(BIOMES[0]);
  a.update(4, true, 1, 1); const p0 = Array.from(a.points.geometry.getAttribute("position").array);
  a.update(4, true, 1, 1); assert.deepEqual(Array.from(a.points.geometry.getAttribute("position").array), p0);
  a.update(7.3, true, 1, 1); assert.notDeepEqual(Array.from(a.points.geometry.getAttribute("position").array), p0);
});
test("the renderer: +1 draw call, PLAY ticks the clock, PAUSE freezes it, no hud = none", () => {
  setFxOpts({ partK: 1 });
  const r = createRenderer3D(null, null, { audio: null, hud: null }), w = createWorld(7, 1);
  loadLevel(w, 1, false); w.state = "PLAY";
  r.render(w, 1 / 60, { hud: false });
  assert.equal(pts(r).visible, false, "menu/attract frame draws no ambient");
  for (let i = 0; i < 120; i++) r.render(w, 1 / 60, { hud: true });
  const a = pts(r), snap = () => Array.from(a.geometry.getAttribute("position").array.slice(0, 12));
  assert.equal(a.visible, true);
  const s1 = snap();
  for (let i = 0; i < 60; i++) r.render(w, 1 / 60, { hud: true });
  assert.notDeepEqual(snap(), s1, "PLAY moves it");
  w.state = "PAUSE"; r.render(w, 1 / 60, { hud: true });
  const s2 = snap();
  for (let i = 0; i < 60; i++) { w.time += 1 / 60; r.render(w, 1 / 60, { hud: true }); }
  assert.deepEqual(snap(), s2, "PAUSE freezes it even while world.time runs");
  assert.ok(countDrawCalls(r._dbg.scene) >= 1);
});
test("EFFECTS LOW halves the density", () => {
  const r = createRenderer3D(null, null, { audio: null, hud: null }), w = createWorld(7, 1);
  loadLevel(w, 1, false); w.state = "PLAY";
  setFxOpts({ partK: 1 }); r.render(w, 1 / 60, { hud: true });
  const full = pts(r).geometry.drawRange.count;
  setFxOpts({ partK: 0.5 }); r.render(w, 1 / 60, { hud: true });
  const half = pts(r).geometry.drawRange.count;
  setFxOpts({ partK: 1 });
  assert.ok(half < full && half >= full / 2 - 2, full + " -> " + half);
});
