/* v202 swap on ready, REAL 3D side: a constructor and a prepare() that touch no shared state, a staged build that reports
   honest phases (shaders total = the unique programs), the no-KHR sliced warm path, a first frame after prepare that
   builds nothing, and a cancel that leaves nothing behind once rcache disposes. Fake GL: one program per material key. */
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three.module.js";
import {createWorld, loadLevel} from "../src/core/sim.js";
import "../src/core/board3.js";
import {createRenderer3D, COMPILE_K} from "../src/render/three/wrapper.js";
import {spriteSteps, spriteSources, buildSpriteAtlas, wrapTex} from "../src/render/three/textures.js";
import {getFx} from "../src/render/fx.js";

const worldAt = (room) => { const w = createWorld({seed: 4242 + room}); w.gen = 3; loadLevel(w, room, true); return w; };
const keyOf = (m, o) => m.type + "|" + (o.isInstancedMesh ? "i" : "") + "|" + (m.customProgramCacheKey ? m.customProgramCacheKey() : "");

function mkGL({khr = false, readyAfter = 2} = {}) {
  const props = new WeakMap(), byKey = new Map();
  const g = {programs: [], renders: 0, compiles: 0, shadowRenders: 0, inits: [], disposed: 0, lost: 0, toneMapping: 0, ratio: 1,
    debug: {checkShaderErrors: true}, domElement: {width: 0, height: 0},
    shadowMap: {enabled: true, type: 0, autoUpdate: true, needsUpdate: false},
    setPixelRatio(d) { g.ratio = d; }, setSize(w, h) { g.domElement.width = Math.floor(w * g.ratio); g.domElement.height = Math.floor(h * g.ratio); },
    properties: {get(m) { let p = props.get(m); if (!p) props.set(m, p = {}); return p; }},
    extensions: {has: (n) => n === "KHR_parallel_shader_compile" && khr},
    compile(node, camera, target) {
      g.compiles++;
      assert.ok(target && target.isScene, "compile keeps the real scene's lights");
      const out = new Set();
      node.traverse((o) => { for (const m of [].concat(o.material || [])) {
        const k = keyOf(m, o);
        let p = byKey.get(k);
        if (!p) { let polls = 0; const lag = readyAfter + g.programs.length % 3; p = {key: k, usedTimes: 1, used: -1, isReady: () => !khr || ++polls > lag, destroy() {}}; byKey.set(k, p); g.programs.push(p); }
        g.properties.get(m).currentProgram = p; out.add(m);
      } });
      return out;
    },
    render(scene) {
      g.renders++;
      if (g.shadowMap.enabled && (g.shadowMap.autoUpdate || g.shadowMap.needsUpdate)) g.shadowRenders++;
      g.shadowMap.needsUpdate = false;
      scene.traverseVisible((o) => { for (const m of [].concat(o.material || [])) { const p = props.get(m) && props.get(m).currentProgram; if (p && p.used < 0) p.used = g.renders; } });
    },
    initTexture(t) { g.inits.push(t); }, dispose() { g.disposed++; }, forceContextLoss() { g.lost++; }};
  g.info = {programs: g.programs};
  return g;
}
function mkRec() {
  const calls = [];
  return {calls, ctx: new Proxy({}, {get: (t, k) => (k in t ? t[k] : (...a) => { calls.push(k); return {addColorStop() {}}; }), set: (t, k, v) => { calls.push("set:" + String(k)); t[k] = v; return true; }})};
}
function rig(gopts, extra = {}) {
  const live = new Set();
  let worldBuilds = 0, spriteBuilds = 0, g = null;
  const mkTex = () => { const t = new THREE.DataTexture(new Uint8Array(4), 1, 1); t._shared = true; live.add(t); t.addEventListener("dispose", () => live.delete(t)); return t; };
  const glCv = {width: 0, height: 0, style: {}, getContext: () => ({}), addEventListener() {}, removeEventListener() {}};
  const ov = mkRec(), ovCv = {width: 600, height: 520, style: {}, getContext: () => ov.ctx};
  const r = createRenderer3D(glCv, ovCv, {audio: null, perf: {aa: true, dpr3d: 1, shadow: "soft", partK: 1, epoch: 1},
    makeGL: () => (g = mkGL(gopts)),
    buildSprites: () => { spriteBuilds++; return {player: mkTex(), face: mkTex()}; },
    buildWorld: () => { worldBuilds++; return {wallStrip: mkTex(), wallSurf: mkTex(), brick: mkTex(), floor: mkTex(), rim: mkTex()}; }, ...extra});
  r.setPerf({aa: true, dpr3d: 1, shadow: "soft", partK: 1, epoch: 1});
  return {r, g: () => g, live, glCv, ovCv, ov, builds: () => ({worldBuilds, spriteBuilds})};
}
function mkJob(world, {cancelAt = Infinity} = {}) {
  const log = [];
  let steps = 0;
  return {log, get steps() { return steps; }, world,
    report(p, d, t) { log.push([p, d, t]); },
    step() { return ++steps >= cancelAt ? Promise.reject({cancelled: true}) : Promise.resolve(); }};
}
function checkReports(log) {
  const order = ["build", "shaders", "warm"];
  let ph = -1, last = null;
  for (const [p, d, t] of log) {
    const i = order.indexOf(p);
    assert.ok(i >= ph, "phases in order: " + p + " after " + order[ph]);
    if (i > ph) { ph = i; last = null; }
    assert.ok(d <= t, p + " done " + d + " <= total " + t);
    if (last) { assert.equal(t, last[1], p + " total is fixed"); assert.ok(d >= last[0], p + " never moves back"); }
    last = [d, t];
  }
  assert.equal(ph, 2, "reached warm");
}

test("the constructor and prepare touch no shared state; activate does, once", async () => {
  const h = rig({khr: true});
  assert.deepEqual(h.ov.calls, [], "constructor: no #c draw");
  assert.deepEqual(h.ovCv.style, {}, "constructor: no stage glow");
  assert.deepEqual(h.glCv.style, {}, "constructor: no stage background");
  const w = worldAt(2);
  w.events.push({t: "kill", x: 40, y: 40, color: "#fff", type: "walker"});
  const fx0 = getFx().length;
  await h.r.prepare(mkJob(w));
  assert.deepEqual(h.ov.calls, [], "prepare: no #c draw");
  assert.deepEqual(h.ovCv.style, {}, "prepare: no stage glow");
  assert.deepEqual(h.glCv.style, {}, "prepare: no stage background");
  assert.equal(w.events.length, 1, "prepare drains no events");
  assert.equal(getFx().length, fx0, "prepare feeds no fx");
  assert.equal(h.r._dbg.active, false);
  h.r.activate(); h.r.activate();
  assert.equal(h.r._dbg.active, true);
  assert.equal(h.ov.calls.filter((c) => c === "clearRect").length, 1, "one overlay clear, idempotent");
  assert.ok(h.ovCv.style.boxShadow && h.glCv.style.background, "stage glow and background at activate");
  h.r.dispose();
});

test("KHR: shaders total is the unique program count, polled to ready, then one warm frame; the first render builds nothing", async () => {
  const h = rig({khr: true, readyAfter: 2});
  const w = worldAt(3), job = mkJob(w);
  await h.r.prepare(job);
  const g = h.g();
  checkReports(job.log);
  const sh = job.log.filter((e) => e[0] === "shaders");
  assert.equal(sh[0][2], g.programs.length, "total = unique programs");
  assert.ok(g.programs.length >= 5, "programs: " + g.programs.length);
  assert.deepEqual(sh.at(-1), ["shaders", g.programs.length, g.programs.length]);
  assert.ok(sh.length > 2, "progress while the GPU links: " + sh.length);
  assert.equal(h.r._dbg.path, "khr");
  assert.equal(g.renders, 1, "KHR: one warm frame, no sliced draws");
  assert.ok(g.programs.every((p) => p.used === 1), "every program is used by the warm frame");
  assert.equal(g.programs.filter((p) => p.key.startsWith("MeshLambert") || p.key.startsWith("MeshPhong")).length >= 2, true);
  assert.ok(g.inits.length >= 7, "textures uploaded one per unit: " + g.inits.length);
  const b = job.log.filter((e) => e[0] === "build").at(-1);
  assert.equal(b[1], b[2], "build completes");
  assert.ok(job.steps >= b[2], "a step between units");

  const n0 = g.renders, c0 = g.compiles, b0 = h.builds(), grp = h.r._dbg.scene.children.slice();
  h.r.render(w, 1 / 60);
  assert.equal(g.renders, n0 + 1, "first render: one draw, no warm pass");
  assert.equal(h.r._dbg.glRenders, 1);
  assert.equal(g.compiles, c0, "no compile");
  assert.deepEqual(h.builds(), b0, "no texture painting");
  assert.deepEqual(h.r._dbg.scene.children, grp, "the prepared scene is the one drawn");
  assert.equal(g.shadowRenders, 2, "warm shadow + the first real shadow pass");
  assert.equal(g.debug.checkShaderErrors, false, "shader info logs off without debug");
  h.r.dispose();
});

test("no KHR: compile issues every link, then one warm draw per bucket before the warm frame", async () => {
  const h = rig({khr: false});
  const w = worldAt(1), job = mkJob(w);
  await h.r.prepare(job);
  const g = h.g();
  checkReports(job.log);
  assert.equal(h.r._dbg.path, "sliced");
  const sh = job.log.filter((e) => e[0] === "shaders");
  assert.equal(sh[0][2], g.programs.length);
  assert.ok(g.renders >= 3 && g.renders <= COMPILE_K + 1, "sliced draws + warm: " + g.renders);
  assert.ok(g.programs.every((p) => p.used >= 1 && p.used < g.renders), "every program first used by a sliced draw, before the warm frame");
  assert.equal(g.shadowRenders, 1, "the sliced draws hold the shadow map; the warm frame renders it");
  assert.equal(g.shadowMap.autoUpdate, false, "armed state restored");
  const n0 = g.renders;
  h.r.render(w, 1 / 60);
  assert.equal(g.renders, n0 + 1);
  h.r.dispose();
});

test("debug opt keeps the shader checks", () => {
  const h = rig({}, {debug: true});
  assert.equal(h.g().debug.checkShaderErrors, true);
  h.r.dispose();
});

for (const at of [2, 9, 14]) test(`cancel at step ${at}: the rejection propagates, the scene is as built, dispose leaves nothing`, async () => {
  const h = rig({khr: false}, at === 2 ? {buildSprites: undefined} : {});
  const w = worldAt(4), job = mkJob(w, {cancelAt: at}), step = job.step.bind(job);
  const snap = () => { const o = []; h.r._dbg.scene.traverse((x) => o.push([x.uuid, x.visible, x.isInstancedMesh ? x.count : -1])); return o; };
  let built = null;
  job.step = () => { if (!built && job.log.some((e) => e[0] === "build" && e[1] === 5)) built = snap(); return step(); };
  await assert.rejects(h.r.prepare(job), (e) => e && e.cancelled === true);
  if (at > 5) {
    assert.ok(built, "the scene unit ran before the cancel");
    assert.deepEqual(snap(), built, "every visible and count override undone");
    let rim = null; h.r._dbg.scene.traverse((o) => { if (o.userData.tag === "trim") rim = o; });
    let n = 0; h.r._dbg.scene.traverse((o) => { if (rim && o.geometry === rim.geometry) n++; });
    assert.equal(n, 1, "the warm twin is never left in the scene");
  }
  h.r.dispose();
  assert.equal(h.live.size, 0, "every texture freed");
  assert.equal(h.g().disposed, 1);
  assert.equal(h.g().lost, 1);
});

test("prepare on a renderer already on screen only compiles: no draws, no warm overrides", async () => {
  const h = rig({khr: true, readyAfter: 0});
  const w = worldAt(2);
  h.r.render(w, 1 / 60);
  const g = h.g(), n0 = g.renders, c0 = g.compiles;
  const vis = []; h.r._dbg.scene.traverse((o) => vis.push(o.visible));
  await h.r.prepare(mkJob(w));
  assert.equal(g.renders, n0, "no draw on the live canvas");
  assert.ok(g.compiles > c0);
  const vis2 = []; h.r._dbg.scene.traverse((o) => vis2.push(o.visible));
  assert.deepEqual(vis2, vis, "visibility untouched");
  h.r.dispose();
});

test("staged sprite steps paint the one-shot atlas: same keys, order and texture settings", () => {
  const mk = () => ({width: 0, height: 0, getContext: () => new Proxy({}, {get: (t, k) => (k in t ? t[k] : () => ({addColorStop() {}})), set: (t, k, v) => { t[k] = v; return true; }})});
  const steps = spriteSteps(mk);
  assert.deepEqual(steps.map((s) => s[0]), Object.keys(spriteSources(mk)));
  const one = buildSpriteAtlas(mk);
  for (const [k, f] of steps) {
    const tx = wrapTex(k, f()), a = one[k];
    for (const p of ["magFilter", "minFilter", "generateMipmaps", "colorSpace", "_shared"]) assert.equal(tx[p], a[p], k + " " + p);
  }
});
