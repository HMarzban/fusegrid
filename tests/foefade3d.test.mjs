/* REAL 3D spawn fade (2026-10-25 loose end): a spawning foe's slot swaps to its own transparent clones with opacity from spawnK().a, and returns to the
   shared per-type materials the frame its invulnerable window ends; a settled board is material-identical to before; PAUSE freezes the fade; draws do not move.
   Also pins that the far (top) corner bosses of the REAL 3D bezel sit below the HUD plate at the frozen rig and every CAMERA preset. Headless: THREE only. */
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three.module.js";
import { CFG, BIOMES } from "../src/core/config.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { createPools, ENEMY_TYPES, ENEMY_3D } from "../src/render/three/entities.js";
import { buildScene, countDrawCalls, disposeGroup } from "../src/render/three/scene.js";
import { createRenderer3D, VIEW_DY } from "../src/render/three/wrapper.js";
import { CAM_FOV, CAM_PRESET, createRig, applyOrbit } from "../src/render/three/camrig.js";
import { RIM_TEX } from "../src/render/three/rimart.js";
import { MOTION, spawnK } from "../src/render/motion.js";

const T = CFG.TILE;
const mkE = (type, x, y, over) => Object.assign({ type, x, y, tx: Math.floor(x / T), ty: Math.floor(y / T), dir: { x: 0, y: 1 }, speed: 1, color: "#8affc1", r: T * 0.34, pass: false, dead: false, invuln: false, invulnT: 0, cd: 4, home: { x: 1, y: 1 } }, over || {});
const world = (o) => Object.assign({ players: [], enemies: [], bombs: [], items: [], blades: [], events: [], time: 0, state: "PLAY" }, o || {});
const four = (s) => [s, s.children[0], s.children[1], s.children[2]];
const shared = (pools, s, type) => {
  const R = ENEMY_3D[type];
  return s.material === R.mat && s.children[0].material === R.details[0].mat && (type === "rocket" || s.children[1].material === R.details[1].mat);
};

test("a spawning foe fades on its own clones with opacity from spawnK().a, then swaps back to the shared materials", () => {
  const pools = createPools(BIOMES[0], null);
  const e = mkE("walker", 200, 200, { invuln: true, invulnT: MOTION.SPAWN_T }), still = mkE("walker", 300, 200, { home: { x: 7, y: 5 } });
  const w = world({ enemies: [e, still] });
  w.time = 0.1; pools.update(w);
  const [s, s2] = pools.enemies;
  const eye = s2.children[2].material;
  assert.ok(shared(pools, s2, "walker") && eye.transparent, "the settled neighbour keeps the shared materials");
  assert.ok(!shared(pools, s, "walker"), "the spawning slot does not use the shared hull");
  const k0 = spawnK(0, 0.1);
  for (const m of four(s)) {
    assert.ok(m.material.transparent && !m.material.depthWrite && m.material.forceSinglePass, "clone is a transparent, no-depth-write, single-pass material");
    assert.equal(m.castShadow, false, "no shadow while alpha < 1");
  }
  assert.ok(Math.abs(s.material.opacity - k0.a * ENEMY_3D.walker.mat.opacity) < 1e-9, "hull opacity = spawnK().a");
  assert.ok(Math.abs(s.children[2].material.opacity - k0.a * eye.opacity) < 1e-9, "eye opacity = spawnK().a");
  assert.notEqual(s.material, s2.material);
  const clones = four(s).map((m) => m.material);
  /* the window runs: same clone objects frame to frame, opacity follows spawnK, and no new material appears */
  const n0 = pools.fadeMats.length;
  for (let k = 1; k <= 50; k++) {
    w.time = 0.1 + k / 60; e.invulnT = Math.max(0, MOTION.SPAWN_T - k / 60); e.invuln = e.invulnT > 0;
    pools.update(w);
    if (!e.invuln) break;
    const p = 1 - e.invulnT / MOTION.SPAWN_T, a = spawnK(p, w.time).a;
    if (a < 0.999) { four(s).forEach((m, j) => assert.equal(m.material, clones[j], "clone reused")); assert.ok(Math.abs(s.material.opacity - a) < 1e-9, "opacity at frame " + k); }
  }
  assert.equal(pools.fadeMats.length, n0, "clones are built once per slot and type");
  assert.ok(n0 <= 4, "one foe fading = four clones");
  e.invulnT = 0; e.invuln = false; w.time += 1 / 60; pools.update(w);
  assert.ok(shared(pools, s, "walker"), "back on the shared hull and details");
  assert.equal(s.children[2].material, eye, "back on the shared eye");
  assert.ok(s.castShadow && s.children[0].castShadow && s.children[1].castShadow, "casting again by the skin rule");
});

test("a settled board is material-identical to a pool that never faded (every type, rocket flame included)", () => {
  const a = createPools(BIOMES[0], null), b = createPools(BIOMES[0], null);
  const mk = (inv) => ENEMY_TYPES.map((t, i) => mkE(t, 80 + i * 40, 120, { home: { x: i + 1, y: 2 }, invuln: inv, invulnT: inv ? MOTION.SPAWN_T : 0 }));
  const wa = world({ enemies: mk(true) }), wb = world({ enemies: mk(false) });
  for (let k = 0; k < 4; k++) { wa.time = wb.time = k / 60; a.update(wa); b.update(wb); }
  assert.ok(a.enemies.slice(0, ENEMY_TYPES.length).every((s) => s.userData.fd === 1), "every type is fading on clones");
  for (const e of wa.enemies) { e.invuln = false; e.invulnT = 0; }
  wa.time = wb.time = 0.2; a.update(wa); b.update(wb);
  a.enemies.forEach((s, i) => {
    const t = b.enemies[i];
    four(s).forEach((m, j) => {
      const n = four(t)[j], A = m.material, N = n.material, at = "slot " + i + " mesh " + j;
      assert.ok(!a.fadeMats.includes(A), at + " is off the clones");
      /* hull and details are module-shared (the same object in both pools); the eye and the rocket flame are per pool, so compare their state */
      if (j < 2 || (j === 2 && s.userData.k !== "e_rocket")) assert.equal(A, N, at + " material");
      else assert.ok(A.type === N.type && A.color.getHex() === N.color.getHex() && A.opacity === N.opacity && A.transparent === N.transparent && A.depthWrite === N.depthWrite, at + " material state");
      assert.equal(m.castShadow, n.castShadow, at + " cast");
    });
  });
  ENEMY_TYPES.forEach((t, i) => assert.ok(shared(a, a.enemies[i], t), t + " shared"));
});

test("a slot that leaves the pool, or changes type mid-fade, never keeps a clone; ghosts fade their tail and return too", () => {
  const pools = createPools(BIOMES[0], null);
  const e = mkE("chaser", 200, 200, { invuln: true, invulnT: MOTION.SPAWN_T });
  const w = world({ enemies: [e] });
  w.time = 0.05; pools.update(w);
  const s = pools.enemies[0];
  assert.equal(s.userData.fd, 1);
  w.enemies = []; w.time += 1 / 60; pools.update(w);
  assert.ok(!s.visible && shared(pools, s, "chaser"), "hidden tail slot restored");
  w.enemies = [mkE("knight", 200, 200, { invuln: true, invulnT: MOTION.SPAWN_T })]; w.time += 1 / 60; pools.update(w);
  assert.equal(s.userData.k, "e_knight"); assert.equal(s.userData.fd, 1);
  assert.equal(s.material.color.getHex(), ENEMY_3D.knight.mat.color.getHex(), "the clone carries the new type's colour");
  /* death ghost: a kill edge, then the tail past 0.6 of DEATH_T fades, and the hidden ghost is restored */
  const k = w.enemies[0]; k.invuln = false; k.invulnT = 0; w.time += 1 / 60; pools.update(w);
  w.enemies = []; w.time += 1 / 60; pools.update(w);
  const g = pools.deadSlots.find((d) => d.visible);
  assert.ok(g, "a ghost shows");
  let faded = false;
  for (let i = 0; i < 30; i++) { w.time += 1 / 60; pools.update(w); if (g.visible && g.userData.fd === 1) { faded = true; assert.ok(g.material.opacity < 1 && !g.castShadow); } }
  assert.ok(faded, "the ghost tail fades");
  assert.ok(!g.visible && g.userData.fd === 0 && g.material === ENEMY_3D.knight.mat, "the finished ghost is back on shared");
});

test("MAX heat (invulnT 1.6 > SPAWN_T) holds the faint pop, then still swaps back", () => {
  const pools = createPools(BIOMES[0], null);
  const e = mkE("walker", 200, 200, { invuln: true, invulnT: 1.6 });
  const w = world({ enemies: [e] }), s = pools.enemies[0];
  for (let k = 0; k < 120; k++) { w.time = k / 60; e.invulnT = Math.max(0, 1.6 - k / 60); e.invuln = e.invulnT > 0; pools.update(w); if (k === 1) assert.ok(Math.abs(s.material.opacity - 0.35) < 1e-9, "p < 0 holds a = 0.35"); }
  assert.ok(shared(pools, s, "walker") && s.castShadow);
});

test("PAUSE freezes the fade: the wrapper's pause clock holds opacity while world.time runs", () => {
  const r = createRenderer3D(null, null, { audio: null, hud: null });
  const w = createWorld(41, 1); loadLevel(w, 1, false); w.state = "PLAY";
  const e = mkE("walker", 200, 200, { invuln: true, invulnT: 0.6 }); w.enemies = [e];
  const pools = () => { let p = null; r._dbg.scene.traverse((o) => { if (o.userData && o.userData.pools) p = o.userData.pools; }); return p; };
  for (let k = 0; k < 3; k++) { w.time += 1 / 60; r.render(w, 1 / 60); }
  w.state = "PAUSE"; w.time += 1 / 60; r.render(w, 1 / 60);
  const s = pools().enemies[0], a0 = s.material.opacity;
  assert.ok(s.userData.fd === 1 && a0 < 1);
  for (const dt of [0.37, 1.1, 2.9]) { w.time += dt; r.render(w, 1 / 60); assert.equal(s.material.opacity, a0, "paused opacity holds at +" + dt); }
});

test("draw calls do not move: a fresh room (every foe invulnerable and fading) counts the same as the settled room", () => {
  const w = createWorld(93, 1); loadLevel(w, 1, false); w.state = "PLAY";
  assert.ok(w.enemies.length > 0 && w.enemies.every((e) => e.invuln), "a fresh room's foes spawn invulnerable");
  const sc = buildScene(w); sc.update(w);
  assert.ok(sc.pools.enemies.slice(0, w.enemies.length).every((s) => s.userData.fd === 1), "all fading on clones");
  const fading = countDrawCalls(sc.group);
  for (const e of w.enemies) { e.invuln = false; e.invulnT = 0; }
  w.time += 1 / 60; sc.update(w);
  assert.ok(sc.pools.enemies.every((s) => !s.userData.fd));
  assert.equal(countDrawCalls(sc.group), fading);
  assert.ok(fading <= 160, String(fading));
  /* the fat world (16 foes, all fading) stays at the pinned 156 */
  const wf = createWorld(93, 1); loadLevel(wf, 1, false);
  wf.enemies = []; wf.items = [];
  for (let i = 0; i < 16; i++) wf.enemies.push(mkE(ENEMY_TYPES[i % ENEMY_TYPES.length], 60 + i * 30, 80, { invuln: true, invulnT: 1 }));
  for (let i = 0; i < 32; i++) wf.items.push({ x: 60 + i * 15, y: 120, t: "fire", col: "#ffffff", taken: false, pdef: null });
  wf.blades = [{ x: 200, y: 120, tiles: [{ tx: 5, ty: 3 }], t: 0, ttl: CFG.BLADE_TTL }];
  const r = createRenderer3D(null, null, { audio: null, hud: null }); r.render(wf, 1 / 60);
  const fatFading = countDrawCalls(r._dbg.scene);
  for (const e of wf.enemies) { e.invuln = false; e.invulnT = 0; }
  wf.time += 1 / 60; r.render(wf, 1 / 60);
  const fatSettled = countDrawCalls(r._dbg.scene);
  console.log("fat world draws: fading " + fatFading + ", settled " + fatSettled);
  assert.equal(fatFading, fatSettled, "16 fading foes add no draw");
  assert.ok(fatFading <= 160, String(fatFading));
  /* disposal: the clones are freed with the scene */
  let disposed = 0; for (const m of sc.pools.fadeMats) m.addEventListener("dispose", () => disposed++);
  const n = sc.pools.fadeMats.length; disposeGroup(sc.group);
  assert.ok(n > 0 && disposed === n, "every fade clone disposed with the scene");
});

test("the REAL 3D bezel's far (top) corner bosses sit below the HUD plate at the frozen rig and every CAMERA preset", () => {
  const W = 600, H = 520, PLATE_BOT = 40, cam = new THREE.PerspectiveCamera(CAM_FOV, W / H, 1, 3000);
  cam.setViewOffset(W, H, 0, -VIEW_DY, W, H);
  const { rx, rz } = RIM_TEX;
  for (const dist of CAM_PRESET) {
    const rig = createRig(); rig.dist = dist; applyOrbit(cam, rig, { x: 0, y: 0 }); cam.updateMatrixWorld();
    for (const B of BIOMES) {
      let top = Infinity;
      for (const sx of [-1, 1]) for (const [x, z] of [[rx, -rz], [rx - 38, -rz], [rx, -rz + 38], [rx - 38, -rz + 38]]) {
        const v = new THREE.Vector3(sx * x, B.hWall + 6, z).project(cam);
        top = Math.min(top, (1 - v.y) / 2 * H);
      }
      assert.ok(top >= PLATE_BOT + 20, B.name + " dist " + dist + ": far corner top y " + top.toFixed(1));
    }
  }
});
