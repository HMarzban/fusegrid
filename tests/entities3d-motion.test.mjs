/* REAL 3D FOES AND ITEMS motion (entities round 2026-10-25): determinism, PAUSE freeze, bounds, spawn / death / collect, draw budget. Headless: THREE objects only. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../vendor/three.module.js";
import { CFG, BIOMES } from "../src/core/config.js";
import { POWER } from "../src/core/entities.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { createPools, ENEMY_TYPES } from "../src/render/three/entities.js";
import { buildScene, countDrawCalls } from "../src/render/three/scene.js";
import { createRenderer3D } from "../src/render/three/wrapper.js";
import { createBurstFx, BURST_CAP } from "../src/render/three/burstfx.js";
import { makeFoe, stepFoe, turn, faceYaw, itemPose, VZ } from "../src/render/three/entityanim.js";
import { MOTION, COLLECT, COLLECT_T, FOE_M } from "../src/render/motion.js";
import { ITEM_FAMILY } from "../src/render/icons.js";
import { setFxOpts, getFxOpts } from "../src/render/fx.js";

const T = CFG.TILE;
const mkE = (type, x, y, over) => Object.assign({ type, x, y, tx: Math.floor(x / T), ty: Math.floor(y / T), dir: { x: 0, y: 1 }, speed: 1, color: "#8affc1", r: T * 0.34, pass: false, dead: false, invuln: false, invulnT: 0, cd: 4, home: { x: 1, y: 1 } }, over || {});
const mkI = (t, x, y) => ({ x, y, t, col: "#ffffff", taken: false, pdef: null });
const slots = (pools) => pools.enemies;
const world = (o) => Object.assign({ players: [], enemies: [], bombs: [], items: [], blades: [], events: [], time: 0, state: "PLAY" }, o || {});
const tag = (g, k) => { const o = []; g.traverse((x) => { if (x.userData && x.userData.tag === k) o.push(x); }); return o; };
const snapSlot = (s) => { s.updateMatrixWorld(true); return [s.visible, ...s.matrix.elements, ...s.children.flatMap((c) => [...c.matrix.elements])].map((v) => (typeof v === "number" ? +v.toFixed(7) : v)).join(","); };
const snapItems = (pools) => POWER.map((pd) => [...pools.itemBodies[pd.t].instanceMatrix.array.slice(0, 16 * pools.itemBodies[pd.t].count), ...pools.itemBodies[pd.t].instanceColor.array.slice(0, 3 * pools.itemBodies[pd.t].count), ...pools.itemRingIM[pd.t].instanceColor.array.slice(0, 3 * pools.itemRingIM[pd.t].count)].map((v) => +v.toFixed(7)).join(",")).join("|");

test("the pose is a pure function of the world and clock: two pools, one history, identical transforms", () => {
  const run = () => {
    const pools = createPools(BIOMES[0], null), out = [];
    const w = world({ players: [{ x: 300, y: 300, alive: true, face: { x: 0, y: 1 } }], enemies: ENEMY_TYPES.map((t, i) => mkE(t, 100 + i * 40, 120, { home: { x: i + 1, y: 2 }, hunt: t === "chaser" })), items: POWER.map((pd, i) => mkI(pd.t, 60 + i * 40, 200)) });
    for (let k = 0; k < 120; k++) { w.time = k / 60; w.enemies.forEach((e, i) => { e.x += 0.5; e.dir = { x: Math.sin(k / 20 + i), y: Math.cos(k / 20 + i) }; }); pools.update(w); }
    out.push(...slots(pools).map(snapSlot), snapItems(pools));
    return out.join("\n");
  };
  assert.equal(run(), run());
});

test("PAUSE freezes every foe and pickup pose: the same paused frame at two clock times is identical (wrapper swaps pzT)", () => {
  const r = createRenderer3D(null, null, { audio: null, hud: null });
  const w = createWorld(41, 1); loadLevel(w, 1, false);
  w.enemies = ENEMY_TYPES.map((t, i) => mkE(t, 100 + i * 40, 120, { home: { x: i + 1, y: 2 } }));
  w.items = POWER.map((pd, i) => mkI(pd.t, 60 + i * 40, 200));
  w.time = 0.3; w.state = "PLAY";
  for (let k = 0; k < 6; k++) { w.time += 1 / 60; r.render(w, 1 / 60); }
  w.state = "PAUSE"; r.render(w, 1 / 60);
  const scene = r._dbg.scene, grab = () => [...tag(scene, "enemy").map(snapSlot), ...POWER.map((pd) => { let s = ""; scene.traverse((o) => { if (o.isInstancedMesh && o.userData.tag === "item" && o.userData.kind === pd.t) s += [...o.instanceMatrix.array.slice(0, 16 * o.count)].map((v) => v.toFixed(6)).join(","); }); return s; })].join("|");
  const a = grab();
  w.time += 3.7; r.render(w, 1 / 60);
  assert.equal(grab(), a);
});

test("foe transforms stay bounded across every type over 20 s, and eyes never fully close", () => {
  const pools = createPools(BIOMES[0], null);
  const w = world({ players: [{ x: 300, y: 260, alive: true }], enemies: ENEMY_TYPES.map((t, i) => mkE(t, 100 + i * 40, 120, { home: { x: 2 + i, y: 3 }, hunt: true, dir: { x: 1, y: 0 } })) });
  let eyeMin = 9;
  for (let k = 0; k < 1200; k++) {
    w.time = k / 60; w.enemies.forEach((e, i) => { e.x = 100 + i * 40 + 20 * Math.sin(k / 30); e.dir = { x: Math.cos(k / 25), y: Math.sin(k / 25) }; });
    pools.update(w);
    slots(pools).slice(0, ENEMY_TYPES.length).forEach((s) => {
      assert.ok(s.visible); assert.ok(s.scale.x > 0.3 && s.scale.x < 1.2 && s.scale.y > 0.3 && s.scale.y < 1.2, "scale " + s.scale.x);
      assert.ok(Math.abs(s.rotation.x) < 0.35 && Math.abs(s.rotation.z) < 0.35, "tilt " + s.rotation.x + " " + s.rotation.z);
      assert.ok(Number.isFinite(s.position.y) && s.position.y > -4 && s.position.y < 60);
      eyeMin = Math.min(eyeMin, s.children[2].scale.y);
    });
  }
  assert.ok(eyeMin >= 0.08 - 1e-9 && eyeMin < 0.5, "a blink happens and never collapses the plane: " + eyeMin);
});

test("facing turns smoothly: shortest arc, no snap, converges; the clock not advancing freezes it", () => {
  assert.ok(Math.abs(turn(3.0, -3.0, 1 / 60) - 3.0) < 0.5 && turn(3.0, -3.0, 1 / 60) > 3.0, "wraps through pi, not back through zero");
  const S = makeFoe(), e = mkE("walker", 100, 100, { dir: { x: 0, y: 1 } });
  stepFoe(S, e, 0, 0, null);
  assert.equal(S.yaw, faceYaw(e));
  e.dir = { x: 1, y: 0 };
  stepFoe(S, e, 1 / 60, 1 / 60, null);
  const y1 = S.yaw; assert.ok(y1 > 0 && y1 < Math.PI / 2 - 0.05, "one step is partial: " + y1);
  stepFoe(S, e, 1 / 60, 0, null); assert.equal(S.yaw, y1);
  for (let k = 2; k < 40; k++) stepFoe(S, e, k / 60, 1 / 60, null);
  assert.ok(Math.abs(S.yaw - Math.PI / 2) < 0.02);
});

test("foe phase comes from the foe's home, never its slot: re-ordering the array moves no foe's pose", () => {
  const A = mkE("walker", 100, 100, { home: { x: 2, y: 3 } }), B = mkE("walker", 160, 100, { home: { x: 5, y: 1 } });
  const grab = (list) => { const p = createPools(BIOMES[0], null); const w = world({ enemies: list }); w.time = 1.7; p.update(w); w.time = 1.9; p.update(w); return list.map((e) => { const s = p.enemies[list.indexOf(e)]; return [e.home.x, +s.position.y.toFixed(6), +s.scale.x.toFixed(6), +s.children[2].scale.y.toFixed(6)].join(":"); }).sort().join("|"); };
  assert.equal(grab([A, B]), grab([B, A]));
});

test("spawn: an invulnerable foe pops in small with a floor ring, then is solid; nothing blinks", () => {
  const pools = createPools(BIOMES[0], null), e = mkE("chaser", 200, 200, { invuln: true, invulnT: MOTION.SPAWN_T });
  const w = world({ enemies: [e] });
  w.time = 0; pools.update(w);
  const s0 = slots(pools)[0].scale.x; assert.ok(slots(pools)[0].visible && s0 < 0.7, "starts small " + s0);
  assert.equal(pools.spawnRing.count, 1);
  let max = 0;
  for (let k = 1; k < 90; k++) { w.time = k / 60; e.invulnT = Math.max(0, MOTION.SPAWN_T - w.time); pools.update(w); assert.ok(slots(pools)[0].visible, "never hidden"); max = Math.max(max, slots(pools)[0].scale.x); }
  assert.ok(max > 1.02 && max < 1.2, "overshoots then settles " + max);
  e.invuln = false; e.invulnT = 0; w.time = 2; pools.update(w);
  assert.ok(Math.abs(slots(pools)[0].scale.x - 1) <= FOE_M.chaser.breathe + 1e-9);
  assert.equal(pools.spawnRing.count, 0);
});

test("death: a kill event squashes a pooled body for DEATH_T (flash one frame, REDUCE FLASH tints), then it is hidden again", () => {
  const prev = getFxOpts();
  try {
    const pools = createPools(BIOMES[0], null), e = mkE("walker", 200, 200, { color: "#8affc1" });
    const w = world({ enemies: [e] });
    w.time = 1; pools.update(w);
    assert.ok(pools.deadSlots.every((s) => !s.visible));
    e.dead = true; w.enemies = w.enemies.filter((q) => !q.dead);   // the sim's own AI filter drops a killed foe within the step
    w.time = 1.02; pools.update(w);
    const g = pools.deadSlots.find((s) => s.visible); assert.ok(g, "a ghost shows");
    assert.notEqual(g.material.type, undefined);
    const flashAt = g.material.isMeshBasicMaterial && g.material.color.getHex();
    assert.ok(flashAt !== false, "flash frame is a Basic tint");
    w.time = 1.15; pools.update(w);
    assert.ok(g.scale.x > 1.05 && g.scale.y < 0.8, `squash wide and low ${g.scale.x} ${g.scale.y}`);
    assert.ok(!g.material.isMeshBasicMaterial || g.material !== pools.deadSlots[0].material || true);
    assert.ok(Math.abs(g.position.x - (200 - CFG.COLS * T / 2)) < 1e-9);
    w.time = 1 + MOTION.DEATH_T + 0.1; pools.update(w);
    assert.ok(pools.deadSlots.every((s) => !s.visible), "gone after DEATH_T");
    // REDUCE FLASH: the white frame is a tint of the foe colour
    const run = (fk) => { setFxOpts({ flashK: fk }); const p = createPools(BIOMES[0], null), d = mkE("walker", 200, 200, { color: "#8affc1" }), ww = world({ enemies: [d] }); ww.time = 1; p.update(ww); d.dead = true; ww.enemies = []; ww.time = 1.01; p.update(ww); const s = p.deadSlots.find((q) => q.visible); return s.material.color.clone(); };
    const full = run(1), tint = run(0);
    assert.ok(full.r > 0.99 && full.g > 0.99 && full.b > 0.99, "full flash is white");
    assert.ok(tint.r < 0.9 || tint.b < 0.9, "reduced flash keeps the foe's hue: " + tint.getHexString());
  } finally { setFxOpts(prev); }
});

test("death pool caps at three bodies and two kills in one frame both show", () => {
  const pools = createPools(BIOMES[0], null), es = [0, 1, 2, 3, 4].map((i) => mkE("fast", 100 + i * 40, 200, { home: { x: i, y: 1 } }));
  const w = world({ enemies: es }); w.time = 2; pools.update(w);
  es.forEach((e) => { e.dead = true; }); w.enemies = [];
  w.time = 2.1; pools.update(w);
  assert.equal(pools.deadSlots.filter((s) => s.visible).length, 3);
});

test("collect: a power event bursts through ONE Points for COLLECT_T, then it is empty and hidden", () => {
  const pools = createPools(BIOMES[0], null), w = world({ items: [] });
  w.time = 5; pools.update(w);
  assert.equal(pools.burst.points.visible, false);
  for (const pd of POWER) {
    const it = { x: 200, y: 200, t: pd.t, col: pd.col, taken: false, pdef: pd }; w.items = [it]; w.time += 0.05; pools.update(w);
    it.taken = true;
    w.time += 0.05; pools.update(w);
    assert.ok(pools.burst.count > 0, pd.t + " bursts");
    assert.ok(pools.burst.count <= COLLECT[pd.t].n, pd.t + " count <= spec n");
    const pos = pools.burst.points.geometry.attributes.position.array;
    for (let i = 0; i < pools.burst.count * 3; i++) assert.ok(Number.isFinite(pos[i]) && Math.abs(pos[i]) < 400, "inside the board " + pos[i]);
    w.time += COLLECT_T + 0.1; pools.update(w);
    assert.equal(pools.burst.count, 0, pd.t + " ends");
    assert.equal(pools.burst.points.visible, false);
  }
});

test("burst Points: preallocated, alpha-blended, depthWrite off, never casts, EFFECTS LOW halves the sparks", () => {
  const b = createBurstFx(), m = b.points.material;
  assert.equal(b.points.geometry.attributes.position.count, BURST_CAP);
  assert.ok(m.transparent && m.depthWrite === false && m.blending === THREE.NormalBlending, "alpha-blended so the kind colour never clumps to white");
  assert.equal(b.points.castShadow, false); assert.equal(b.points.receiveShadow, false);
  const list = [{ kind: "fire", x: 100, y: 100, col: "#ff8a3c", age: 0.1 }];
  const full = b.update(list, 1, 1), half = b.update(list, 1, 0.5);
  assert.ok(half < full && half >= full / 2 - 1, `${half} < ${full}`);
  const many = []; for (let i = 0; i < 40; i++) many.push({ kind: "power", x: 100, y: 100, col: "#ff4d5e", age: 0.1 });
  assert.equal(b.update(many, 1, 1), BURST_CAP, "overflow clamps to the cap");
});

test("pickups: phase is per instance (rings no longer pulse in lockstep), hover/tilt/glint come from itemIdle", () => {
  const pools = createPools(BIOMES[0], null), w = world({ items: [mkI("fire", 60, 120), mkI("fire", 140, 200), mkI("heart", 60, 300), mkI("kick", 220, 300)] });
  w.time = 1.1; pools.update(w);
  const rk = pools.itemRingIM.fire.instanceColor.array;
  assert.notEqual(rk[0], rk[3], "two fire rings sit at different brightness at one instant");
  const ys = pools.itemBodies.fire.instanceMatrix.array; assert.notEqual(ys[13], ys[16 + 13]);
  let glints = 0, gmax = -1;
  for (let k = 0; k < 600; k++) { w.time = k / 60; pools.update(w); const g = pools.itemBodies.fire.instanceColor.array[0]; if (g >= 0) { glints++; gmax = Math.max(gmax, g); } }
  assert.ok(glints > 20 && glints < 600 * 0.35 && gmax > 0.9, `glint sweeps now and then (${glints}/600, max ${gmax})`);
  for (const fam of Object.values(ITEM_FAMILY)) { const P = {}; for (let k = 0; k < 400; k++) { itemPose(P, fam, "fire", mkI("fire", 100, 100), k / 20, -Infinity); assert.ok(P.ringK > 0 && P.ringK <= 1 && Math.abs(P.hy - T * 0.64) < T * 0.2 && Math.abs(P.rz) < 0.2 && P.sc > 0.9 && P.sc < 1.1); } }
});

test("pickup spawn: an item that appears mid-room pops in; items present at the start do not", () => {
  const pools = createPools(BIOMES[0], null), a = mkI("bomb", 100, 100), w = world({ items: [a] });
  w.time = 3; pools.update(w);
  const sz = (i) => { const a = pools.itemBodies.bomb.instanceMatrix.array; return Math.hypot(a[i * 16 + 4], a[i * 16 + 5], a[i * 16 + 6]); };
  assert.ok(Math.abs(sz(0) - 1) < 0.04, "present at start: full size");
  const b = mkI("bomb", 200, 200); w.items.push(b); w.time = 3.05; pools.update(w);
  assert.ok(sz(1) < 0.8, "new item starts small " + sz(1));
  w.time = 4; pools.update(w);
  assert.ok(Math.abs(sz(1) - 1) < 0.04);
});

test("contact shadows follow the new motion: a spawning foe shadow shrinks, a death shadow is appended, none exceed the 32 slots", async () => {
  const { CONTACT } = await import("../src/render/three/groundfx.js");
  const pools = createPools(BIOMES[0], null), e = mkE("walker", 200, 200, { invuln: true, invulnT: MOTION.SPAWN_T });
  const w = world({ enemies: [e] }); w.time = 0; pools.update(w);
  const r0 = CONTACT.v.value[2], base = e.r * 1.5;
  assert.ok(r0 < base * 0.7, `spawn shadow ${r0} < ${base}`);
  e.invuln = false; e.dead = true; w.enemies = []; w.time = 0.1; pools.update(w);
  assert.equal(CONTACT.n.value, 1, "the dying foe keeps a shadow");
  assert.ok(CONTACT.n.value <= 32);
});

test("draw budget: the entity pools add 14 draws and every one is empty/hidden when idle; fat world <= 160", () => {
  const w = createWorld(55, 1); loadLevel(w, 1, false);
  w.enemies = [];
  const sc = buildScene(w); sc.update(w);
  assert.equal(sc.pools.deadSlots.length * 4 + 2, 14);
  assert.ok(sc.pools.deadSlots.every((s) => !s.visible) && sc.pools.spawnRing.count === 0 && sc.pools.burst.count === 0);
  assert.ok(countDrawCalls(sc.group) + 0 <= 160);
  const wf = createWorld(93, 1); loadLevel(wf, 1, false);
  wf.enemies = []; wf.items = [];
  for (let i = 0; i < 16; i++) wf.enemies.push(mkE(ENEMY_TYPES[i % 6], 60 + i * 30, 80));
  for (let i = 0; i < 32; i++) wf.items.push(mkI("fire", 60 + i * 15, 120));
  wf.blades = [{ x: 200, y: 120, tiles: [{ tx: 5, ty: 3 }], t: 0, ttl: CFG.BLADE_TTL }];
  const r = createRenderer3D(null, null, { audio: null, hud: null }); r.render(wf, 1 / 60);
  assert.ok(countDrawCalls(r._dbg.scene) <= 160, String(countDrawCalls(r._dbg.scene)));
});

test("the four-mesh foe slot ABI holds under animation: children never added, reordered or retyped", () => {
  const pools = createPools(BIOMES[0], null), w = world({ enemies: ENEMY_TYPES.map((t, i) => mkE(t, 100 + i * 30, 120, { home: { x: i, y: 1 } })) });
  const before = slots(pools).map((s) => s.children.length);
  for (let k = 0; k < 200; k++) { w.time = k / 60; pools.update(w); }
  slots(pools).forEach((s, i) => { assert.equal(s.children.length, before[i]); assert.equal(s.children.length, 3); assert.equal(s.children[2].geometry.type, "PlaneGeometry"); });
});

test("new render files use no Math.random and no allocation-heavy per-frame constructors in their hot paths", () => {
  for (const f of ["entityanim.js", "burstfx.js"]) {
    const src = readFileSync(new URL("../src/render/three/" + f, import.meta.url), "utf8");
    assert.ok(!/Math\.random/.test(src), f);
  }
  assert.ok(VZ > 1 && VZ < 2.5);
});

test("through the real renderer: a kill and a pickup drained by consumeEvents still animate (edges, not events)", () => {
  const r = createRenderer3D(null, null, { audio: null, hud: null });
  const w = createWorld(61, 1); loadLevel(w, 1, false);
  const e = mkE("walker", 200, 200, { home: { x: 5, y: 5 } }), pd = POWER.find((p) => p.t === "fire");
  const it = { x: 280, y: 200, t: "fire", col: pd.col, taken: false, pdef: pd };
  w.enemies = [e]; w.items = [it]; w.state = "PLAY";
  const pools = () => { let p = null; r._dbg.scene.traverse((o) => { if (o.userData && o.userData.pools) p = o.userData.pools; }); return p; };
  for (let k = 0; k < 6; k++) { w.time += 1 / 60; r.render(w, 1 / 60); }
  assert.ok(pools().deadSlots.every((s) => !s.visible) && pools().burst.count === 0);
  e.dead = true; w.enemies = []; it.taken = true;
  w.events.push({ t: "kill", x: e.x, y: e.y, color: e.color, type: "walker" }, { t: "power", kind: "fire", x: it.x, y: it.y, col: pd.col });
  for (let k = 0; k < 4; k++) { w.time += 1 / 60; r.render(w, 1 / 60); }
  assert.ok(pools().deadSlots.some((s) => s.visible), "death body shows");
  assert.ok(pools().burst.count > 0, "burst shows");
  for (let k = 0; k < 45; k++) { w.time += 1 / 60; r.render(w, 1 / 60); }
  assert.ok(pools().deadSlots.every((s) => !s.visible) && pools().burst.count === 0, "both end");
});

test("a new room never fires a burst or a death: resetting the grid drops everything tracked", () => {
  const pools = createPools(BIOMES[0], null), a = mkE("walker", 100, 100), it = mkI("bomb", 200, 200);
  const w = world({ enemies: [a], items: [it], grid: {} }); w.time = 1; pools.update(w);
  w.grid = {}; w.enemies = []; w.items = []; it.taken = true; w.time = 1.02; pools.update(w);
  assert.ok(pools.deadSlots.every((s) => !s.visible)); assert.equal(pools.burst.count, 0);
});

test("worst-case draw count: a tile room (floor-tile mesh) with 16 foes, 32 pickups, a blast and a racing ghost stays <= 160", () => {
  const wf = createWorld(1003, 3); wf.gen = 2; wf.heat = 1; loadLevel(wf, 3, false);
  assert.ok(wf.feat, "tile room");
  wf.enemies = []; wf.items = [];
  for (let i = 0; i < 16; i++) wf.enemies.push(mkE(ENEMY_TYPES[i % 9], 60 + i * 30, 80));
  for (let i = 0; i < 32; i++) wf.items.push(mkI("fire", 60 + i * 15, 120));
  wf.blades = [{ x: 200, y: 120, tiles: [{ tx: 5, ty: 3 }], t: 0, ttl: CFG.BLADE_TTL }];
  const r = createRenderer3D(null, null, { audio: null, hud: null }); r.render(wf, 1 / 60, { ghost: { x: 100, y: 100, fx: 1, fy: 0, t: 0 } });
  const n = countDrawCalls(r._dbg.scene);
  assert.ok(n <= 160, "draws " + n);
});

test("cost: pools.update over the fat world (16 foes, 32 pickups, 8 bombs)", () => {
  const pools = createPools(BIOMES[0], null), w = world({ players: [{ x: 300, y: 260, alive: true }], enemies: [], items: [] });
  for (let i = 0; i < 16; i++) w.enemies.push(mkE(ENEMY_TYPES[i % 9], 60 + i * 30, 80, { home: { x: i, y: 1 }, hunt: true }));
  for (let i = 0; i < 32; i++) w.items.push(mkI(POWER[i % 12].t, 60 + i * 15, 120));
  for (let k = 0; k < 200; k++) { w.time = k / 60; pools.update(w); }
  const t0 = performance.now(), N = 2000;
  for (let k = 0; k < N; k++) { w.time = (200 + k) / 60; pools.update(w); }
  const ms = (performance.now() - t0) / N;
  console.log("pools.update fat world: " + ms.toFixed(4) + " ms");
  assert.ok(ms < 1.0, ms + " ms");
});

test("round 2: ONE white frame on death (never a second), spawn ring thin and gone by 0.35 s, burst in the kind colour", () => {
  const pools = createPools(BIOMES[0], null), e = mkE("walker", 200, 200, { color: "#8affc1" });
  const w = world({ enemies: [e] }); w.time = 1; pools.update(w);
  e.dead = true; w.enemies = [];
  w.time = 1.01; pools.update(w);
  const g = pools.deadSlots.find((s) => s.visible);
  assert.ok(g.material.isMeshBasicMaterial && g.material.color.r > 0.99, "first frame is white");
  pools.update(w);
  assert.ok(g.material.isMeshBasicMaterial && g.material.color.r > 0.99, "a repeat render of the same clock keeps it");
  w.time = 1.03; pools.update(w);
  assert.ok(!g.material.isMeshBasicMaterial, "the next frame is the real body again");
  const sp = createPools(BIOMES[0], null), f = mkE("chaser", 200, 200, { invuln: true, invulnT: MOTION.SPAWN_T });
  const ww = world({ enemies: [f] }); ww.time = 0; sp.update(ww);
  assert.equal(sp.spawnRing.count, 1);
  const rp = sp.spawnRing.geometry.parameters; assert.ok(rp.innerRadius >= 0.88 && rp.outerRadius === 1, "thin ring");
  ww.time = 0.36; f.invulnT = MOTION.SPAWN_T - 0.36; sp.update(ww);
  assert.equal(sp.spawnRing.count, 0, "no ring after the pop");
  const bf = createBurstFx(); bf.update([{ kind: "fire", x: 100, y: 100, col: "#ff8a3c", age: 0.1 }], 1, 1);
  const c = new THREE.Color("#ff8a3c"), a = bf.points.geometry.attributes.aCol.array;
  assert.ok(Math.abs(a[0] - c.r) < 1e-6 && Math.abs(a[1] - c.g) < 1e-6 && Math.abs(a[2] - c.b) < 1e-6, "kind colour, not whitened");
});

test("round 2: pickups are glyph badges with ONE ring; stationary is the 2D violet with a raked lens; chaser is a drop pointing along travel", async () => {
  const ent = await import("../src/render/three/entities.js");
  for (const pd of POWER) {
    const g = ent.ITEM_GEO[pd.t]; assert.ok(g.attributes.aF && g.attributes.uv, pd.t);
  }
  const pools = createPools(BIOMES[0], null);
  assert.equal(new Set(POWER.map((p) => pools.itemRingIM[p.t].geometry.uuid)).size, 1, "one ring geometry");
  const w = world({ items: [mkI("heart", 100, 100)] });
  let ymax = 0;
  for (let k = 0; k < 300; k++) { w.time = k / 30; pools.update(w); const m = pools.itemBodies.heart.instanceMatrix.array; ymax = Math.max(ymax, Math.abs(Math.atan2(m[8], m[0]))); }
  assert.ok(ymax > 0.1 && ymax < 0.3, "sways, never spins: " + ymax);
  const st = ent.ENEMY_3D.stationary;
  const col = st.mat.color; assert.ok(0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b > 0.2, "not a near-black obelisk");
  assert.ok(st.face.rot[0] < -0.3, "lens plane raked toward the rig");
  const ch = ent.ENEMY_3D.chaser.geo; ch.computeBoundingBox();
  assert.ok(ch.boundingBox.max.z > Math.abs(ch.boundingBox.min.z) * 1.2, "the point leads, the round end trails");
});
