/* #36: a new world compiles nothing, so its first frame does not hitch. Three
   pins: one patched source per program key across all 8 worlds (three reuses a
   surviving program by key alone, so a key that hides a world's literal would
   draw the first room's shader in every room); the pin count stays bounded over
   room walks and its release frees what it held; world textures stay bounded,
   back to baseline on dispose. */
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three.module.js";
import {BIOMES} from "../src/core/config.js";
import {createWorld, loadLevel} from "../src/core/sim.js";
import "../src/core/board3.js";
import {buildScene, disposeGroup, rimTwin} from "../src/render/three/scene.js";
import {FLOOR_FX} from "../src/render/three/groundfx.js";
import {createPins} from "../src/render/three/progpin.js";
import {createRenderer3D, WORLDS_KEPT} from "../src/render/three/wrapper.js";

const tex = () => { const t = new THREE.DataTexture(new Uint8Array(4), 1, 1); t._shared = true; return t; };
const ATLAS = {wallStrip: tex(), wallSurf: tex(), brick: tex(), floor: tex(), rim: tex()};
const LIB = {MeshLambertMaterial: "lambert", MeshPhongMaterial: "phong", MeshBasicMaterial: "basic", MeshStandardMaterial: "standard"};
const worldAt = (room, gen) => { const w = createWorld({seed: 4242 + room}); w.gen = gen; loadLevel(w, room, true); return w; };
/* three's own key source for a material: its customProgramCacheKey, whose default is the closure's text */
const patched = (m) => {
  const lib = THREE.ShaderLib[LIB[m.type]];
  const sh = {vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader, uniforms: {}};
  m.onBeforeCompile(sh, null);
  return {key: m.type + "|" + m.customProgramCacheKey(), src: sh.vertexShader + "\n@@\n" + sh.fragmentShader, sh};
};
const defaultOBC = THREE.Material.prototype.onBeforeCompile;
const eachPatched = (group, f) => group.traverse((o) => {
  for (const m of [].concat(o.material || [])) if (m.onBeforeCompile !== defaultOBC && LIB[m.type]) f(m, o);
});

for (const gen of [2, 3]) test(`gen ${gen}: equal program key means byte-equal shader source across all 8 worlds`, () => {
  const seen = new Map();
  for (let r = 1; r <= BIOMES.length; r++) {
    const sc = buildScene(worldAt(r, gen), ATLAS, 1);
    const twin = rimTwin(sc.rim, sc.biome);
    sc.group.add(twin);
    eachPatched(sc.group, (m) => {
      const {key, src} = patched(m);
      if (seen.has(key)) assert.equal(seen.get(key).src, src, key + " differs between " + seen.get(key).room + " and room " + r);
      else seen.set(key, {src, room: r});
    });
    sc.group.remove(twin);
    disposeGroup(sc.group);
  }
  assert.ok(seen.size >= 5, "floor, wall, brick, both rims at least: " + [...seen.keys()].join());
  const worldKeyed = [...seen.keys()].filter((k) => BIOMES.some((b) => k.includes(b.name)));
  assert.deepEqual(worldKeyed, [], "no program key names a world");
});

test("a ShaderMaterial is one object across rooms: a fresh one is a fresh program key each room, which pins would leak", () => {
  const seen = new Map();
  for (let r = 1; r <= 3; r++) {
    const sc = buildScene(worldAt(r, 2), ATLAS, 1);
    sc.group.traverse((o) => { for (const m of [].concat(o.material || [])) if (m.isShaderMaterial) {
      assert.equal(m._shared, true, (o.userData.tag || o.type) + " is not _shared");
      const k = m.vertexShader + m.fragmentShader;
      if (seen.has(k)) assert.equal(seen.get(k), m);
      seen.set(k, m);
    } });
    disposeGroup(sc.group);
  }
  assert.ok(seen.size >= 3, "ambient, burst, blast fire: " + seen.size);
});

test("the world's numbers reach the shared programs as the same values the literals held", () => {
  const f3 = (v) => +(+v).toFixed(3);
  const f2 = (v) => +(+v).toFixed(2);
  const lift = {SAND: 1.9, ICE: 1.8, ARENA: 1.15, WATER: 1.15};
  BIOMES.forEach((b, i) => {
    const sc = buildScene(worldAt(i + 1, 2), ATLAS, 1);
    let floor = null;
    sc.group.traverse((o) => { if (o.userData.tag === "checker") floor = patched(o.material).sh.uniforms; });
    assert.equal(floor.wellFg.value, f3(FLOOR_FX[b.name].g), b.name + " floor gain");
    assert.equal(floor.wellFc.value, f3(FLOOR_FX[b.name].c), b.name + " floor contrast");
    const rim = patched(sc.rim.material).sh.uniforms;
    assert.equal(rim.wellTop.value, b.hWall + 6, b.name + " rim top");
    assert.equal(rim.wellLg.value, f2(0.55 * (lift[b.name] || 1)), b.name + " rim lip gain");
    disposeGroup(sc.group);
  });
});

test("a pin survives the last material, stays bounded, and release frees what only it held", () => {
  const list = [], pins = createPins();
  let destroyed = 0;
  const prog = () => ({usedTimes: 1, destroy() { destroyed++; }});
  const shared = prog(), mine = prog();
  list.push(shared, mine);
  shared.usedTimes = 2;
  pins.scan(list); pins.scan(list);
  assert.equal(pins.n, 2);
  assert.equal(mine.usedTimes, 2, "one pin however often it scans");
  mine.usedTimes--;
  assert.equal(destroyed, 0);
  pins.release(list);
  assert.equal(destroyed, 1);
  assert.deepEqual(list, [shared]);
  assert.equal(shared.usedTimes, 2);
  assert.equal(pins.n, 0);
  pins.forget();
  const capped = createPins(2), many = [prog(), prog(), prog()];
  capped.scan(many);
  assert.equal(capped.n, 2, "the cap is a backstop on the pin count");
  assert.equal(many[2].usedTimes, 1);
});

/* a stand-in for three's program cache: one program per key, released as three does */
function mkGL() {
  const g = {programs: [], renders: 0, inits: [], shadowMap: {enabled: true, type: 0, autoUpdate: true, needsUpdate: false},
    domElement: {width: 0, height: 0}, toneMapping: 0, ratio: 1,
    setPixelRatio(d) { g.ratio = d; }, setSize(w, h) { g.domElement.width = Math.floor(w * g.ratio); g.domElement.height = Math.floor(h * g.ratio); },
    render() { g.renders++; g.programs.forEach((p) => { p.seen = true; }); if (!g.programs.length) g.programs.push({usedTimes: 1, destroy() { g.destroyed++; }}); },
    initTexture(t) { g.inits.push(t); }, destroyed: 0, dispose() {}, forceContextLoss() {}};
  g.info = {programs: g.programs};
  return g;
}
const mkCanvas = () => ({width: 0, height: 0, getContext: () => ({}), addEventListener() {}, removeEventListener() {}});

test("world textures stay bounded over room walks, the WIN overlay prepares the next room once, dispose returns to baseline", () => {
  const live = new Set();
  let builds = 0, sprites = 0;
  const mkTex = () => { const t = new THREE.DataTexture(new Uint8Array(4), 1, 1); t._shared = true; live.add(t); t.addEventListener("dispose", () => live.delete(t)); return t; };
  let g = null;
  const r = createRenderer3D(mkCanvas(), null, {audio: null, makeGL: () => (g = mkGL()),
    buildSprites: () => { sprites++; return {player: mkTex()}; },
    buildWorld: () => { builds++; return {wallStrip: mkTex(), wallSurf: mkTex(), brick: mkTex(), floor: mkTex(), rim: mkTex()}; }});
  assert.equal(live.size, 0, "baseline: nothing before the first frame");
  const w = worldAt(1, 2);
  r.render(w, 1 / 60);
  assert.equal(builds, 1);
  const SPR = 1, WT = 5;
  assert.equal(live.size, SPR + WT);
  for (let lap = 0; lap < 3; lap++) for (let room = 1; room <= 8; room++) {
    loadLevel(w, room, true);
    r.render(w, 1 / 60);
    assert.ok(live.size <= SPR + WT * WORLDS_KEPT, "bounded at room " + room + ": " + live.size);
  }
  assert.equal(sprites, 1, "sprites are painted once for the renderer's life");
  assert.equal(g.programs.length, 1, "the program cache did not grow");

  /* WIN on room 2: room 3 is built and uploaded here, once, and room 3 then builds nothing */
  loadLevel(w, 2, true); r.render(w, 1 / 60);
  const b0 = builds; g.inits.length = 0;
  w.state = "WIN";
  r.invalidate(); r.render(w, 1 / 60); r.invalidate(); r.render(w, 1 / 60);
  assert.equal(builds, b0 + 1, "one world prepared however long WIN lasts");
  assert.equal(g.inits.length, WT, "its textures are uploaded on the overlay");
  loadLevel(w, 3, true); w.state = "PLAY"; r.render(w, 1 / 60);
  assert.equal(builds, b0 + 1, "the prepared room paints nothing on its first frame");

  /* a finale's WIN prepares nothing: the run ends there */
  loadLevel(w, 5, true); r.render(w, 1 / 60);
  const b1 = builds;
  w.state = "WIN"; r.invalidate(); r.render(w, 1 / 60);
  assert.equal(builds, b1);

  g.programs[0].usedTimes--;   // what three does as the room's last material goes
  r.dispose();
  assert.equal(live.size, 0, "back to baseline after dispose");
  assert.equal(g.destroyed, 1, "the pinned program is freed with the renderer");
});

test("a SHADOWS tier change drops the pins on the next rebuild, a lost context forgets them", () => {
  let g = null;
  const handlers = {};
  const cv = {...mkCanvas(), addEventListener(t, f) { handlers[t] = f; }};
  const r = createRenderer3D(cv, null, {audio: null, perf: {aa: true, dpr3d: 1, shadow: "soft", partK: 1, epoch: 1}, makeGL: () => (g = mkGL())});
  const w = worldAt(1, 2);
  r.render(w, 1 / 60);
  const p = g.programs[0];
  assert.equal(p.usedTimes, 2, "pinned after the first frame");
  r.render(w, 1 / 60);
  assert.equal(p.usedTimes, 2, "one pin");
  r.setPerf({aa: true, dpr3d: 1, shadow: "sharp", partK: 1, epoch: 2});
  loadLevel(w, 2, true); r.render(w, 1 / 60);
  assert.ok(g.destroyed === 0 && p.usedTimes === 2, "released on the rebuild, pinned again for the new tier");
  handlers.webglcontextlost(); handlers.webglcontextrestored();
  g.programs.length = 0;
  r.invalidate(); r.render(w, 1 / 60);
  assert.equal(g.programs[0].usedTimes, 2, "the restored context's programs are pinned afresh");
  r.dispose();
});
