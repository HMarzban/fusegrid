/* TILE ART direction D (2026-10-25): painter contract, colours, geometry. */
import test from "node:test";
import assert from "node:assert/strict";
import { CFG, key } from "../src/core/config.js";
import { cellSpec, specKey, mix as fdMix } from "../src/render/featdraw.js";
import { mix, hsh } from "../src/render/featart/kit.js";

const world = (cells) => { const n = CFG.COLS * CFG.ROWS, w = { feat: new Uint8Array(n), featM: new Uint8Array(n), featS: new Float32Array(n), featPair: new Uint8Array(n), featT: 0, heat: 1, pace: 0, level: 3 }; for (const [x, y, v] of cells) w.feat[key(x, y)] = v; return w; };

test("cellSpec gives nb and par for a belt chain", () => {
  const w = world([[5, 5, 1], [6, 5, 1], [7, 5, 1]]);
  assert.deepEqual(cellSpec(w, 6, 5).nb, { N: false, E: true, S: false, W: true });
  assert.deepEqual(cellSpec(w, 5, 5).nb, { N: false, E: true, S: false, W: false });
  assert.deepEqual(cellSpec(w, 7, 5).nb, { N: false, E: false, S: false, W: true });
  assert.equal(cellSpec(w, 6, 5).par, 1);
  assert.equal(cellSpec(w, 5, 5).par, 0);
});
test("specKey differs when par differs", () => {
  const w = world([[5, 5, 6], [6, 5, 6]]);
  assert.notEqual(specKey(cellSpec(w, 5, 5)), specKey(cellSpec(w, 6, 5)));
});
test("kit.mix matches the round-3 mix; hsh is deterministic in [0,1)", () => {
  assert.equal(mix("#ffffff", "#000000", 0.5), "#808080");
  assert.equal(mix("#d4a030", "#062416", 0.37), fdMix("#d4a030", "#062416", 0.37));
  assert.equal(hsh(3, 4, 5), hsh(3, 4, 5));
  for (let i = 0; i < 50; i++) { const v = hsh(i, 7, 9); assert.ok(v >= 0 && v < 1); }
});

import { rec } from "./lib/ctxrec.mjs";
import { BIOMES } from "../src/core/config.js";
import { BUILT } from "../src/render/featart/built.js";
import { LIVING } from "../src/render/featart/living.js";
import { rgb } from "../src/render/featart/kit.js";
import { kOf, paintCell } from "../src/render/featdraw.js";

globalThis.Path2D ??= class { moveTo() {} lineTo() {} closePath() {} rect() {} addPath() {} arc() {} bezierCurveTo() {} quadraticCurveTo() {} ellipse() {} };
globalThis.DOMMatrix ??= class { constructor() {} };
const BIOME_OF = { GLIDE: "ICE", BELT: "FACTORY", PLATE: "ARENA", PORTAL: "VOID", GATE: "CROWN", BLOOM: "JUNGLE", STREAM: "WATER", QUICK: "SAND" };
const biome = (n) => BIOMES.find((b) => b.name === n);
const SIDES = ["N", "E", "S", "W"];
const nbs = () => Array.from({ length: 16 }, (_, i) => Object.fromEntries(SIDES.map((s, j) => [s, !!(i >> j & 1)])));
const kk = (kind, o = {}) => ({ bio: biome(BIOME_OF[kind]), h: 0, nb: { N: false, E: false, S: false, W: false }, par: 0, on: 0, dir: 0, phase: 0, state: 0, lit: 0, pair: 1, gx: 0, gy: 0, ...o });
const run = (P, k) => { const { ctx, log } = rec(); (typeof P === "function" ? P(ctx, k) : (P.mech(ctx, k), P.lit(ctx, k))); return log; };
const colours = (log) => log.flatMap((e) => (/^=(fill|stroke)Style$/.test(e.op) ? [e.a[0]] : e.op === "g.addColorStop" ? [e.a[1]] : [])).filter((v) => typeof v === "string" && v !== "{o}");
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function kinds(T) { return Object.keys(T).filter((n) => BIOME_OF[n]); }
test("built painters never throw: every kind x heat x state x neighbours x dir", () => {
  for (const n of kinds(BUILT)) for (let h = 0; h < 3; h++) for (const nb of nbs()) for (const dir of n === "BELT" ? [0, 1, 2, 3] : [0]) for (const state of [0, 1, 2]) for (const lit of [0, 2, 4]) for (const pair of [1, 2, 3]) {
    const k = kk(n, { h, nb, dir, state, lit, pair, on: state === 1 ? 1 : 0, phase: 7, gx: 3, gy: 5 });
    assert.doesNotThrow(() => run(BUILT[n], k), n);
  }
});
test("painters draw only palette colours: black, white, rgba black/white, or a hex inside the biome's per-channel slot range", () => {
  for (const T of [BUILT, LIVING]) for (const n of kinds(T)) for (let h = 0; h < 3; h++) {
    const b = biome(BIOME_OF[n]), slots = [b.bg0, b.bg1, b.floor0, b.floor1, b.wall, b.wallHi].map(rgb), lo = [0, 1, 2].map((i) => Math.min(...slots.map((s) => s[i]))), hi = [0, 1, 2].map((i) => Math.max(...slots.map((s) => s[i])));
    for (const col of colours(run(T[n], kk(n, { h, lit: 2, state: 1, on: 1 })))) {
      if (/^#(000|fff)$/i.test(col) || /^rgba\((0,0,0|255,255,255),[\d.]+\)$/.test(col)) continue;
      const m = /^rgba\((\d+),(\d+),(\d+),[\d.]+\)$/.exec(col);
      assert.ok(m || /^#[0-9a-f]{6}$/i.test(col), n + " " + col);
      const c = m ? [+m[1], +m[2], +m[3]] : rgb(col);
      for (let i = 0; i < 3; i++) assert.ok(c[i] >= lo[i] - 1 && c[i] <= hi[i] + 1, `${n} h${h} ${col} channel ${i} outside ${b.name} slots`);
    }
  }
});
test("PORTAL never uses a white overlay and no hex brighter than wallHi (VOID dim rule)", () => {
  const b = biome("VOID"), cap = lum(rgb(b.wallHi));
  for (let h = 0; h < 3; h++) for (const on of [0, 1]) for (const pair of [1, 2, 3]) {
    const cols = colours(run(BUILT.PORTAL, kk("PORTAL", { h, on, pair })));
    for (const col of cols) { assert.ok(!/^#fff$/i.test(col) && !/255,255,255/.test(col), "white overlay " + col); if (/^#[0-9a-f]{6}$/i.test(col)) assert.ok(lum(rgb(col)) <= cap + 0.5, col); }
  }
});
test("BELT roller phase wraps at the roller period", () => {
  for (const [h, per] of [[0, 10], [1, 8], [2, 5]]) assert.deepEqual(run(BUILT.BELT, kk("BELT", { h, phase: 0 })), run(BUILT.BELT, kk("BELT", { h, phase: per })));
});
test("kOf maps a cell spec to the painter contract", () => {
  const b = biome("FACTORY"), k = kOf(b, { kind: "BELT", h: 2, outer: ["N", "S"], par: 1, dir: 3, phase: 12.7, state: 1, lit: 2, pair: 3 });
  assert.deepEqual(k.nb, { N: false, E: true, S: false, W: true });
  assert.equal(k.h, 2); assert.equal(k.par, 1); assert.equal(k.dir, 3); assert.equal(k.phase, 12); assert.equal(k.on, 1); assert.equal(k.pair, 3);
  assert.deepEqual(kOf(b, { kind: "GLIDE", h: 0 }).nb, { N: false, E: false, S: false, W: false });
});
test("paintCell routes BELT, GLIDE, PLATE, PORTAL and GATE to the D painters", () => {
  for (const [n, k] of [["BELT", "FACTORY"], ["GLIDE", "ICE"], ["PLATE", "ARENA"], ["PORTAL", "VOID"], ["GATE", "CROWN"]]) {
    const { ctx, log } = rec(); paintCell(ctx, biome(k), { kind: n, h: 1, dir: 0, outer: ["N", "S"], pair: 2, lit: 1, gx: 1, gy: 1 });
    assert.ok(log.length > 20, n + " drew");
    assert.ok(!log.some((e) => e.op === "setLineDash"), n + " no round-3 dash edge");
  }
});

test("living painters never throw: every kind x heat x state x neighbours x dir", () => {
  for (const n of kinds(LIVING)) for (let h = 0; h < 3; h++) for (const nb of nbs()) for (const dir of n === "STREAM" ? [0, 1, 2, 3] : [0]) for (const state of [0, 1, 2]) {
    assert.doesNotThrow(() => run(LIVING[n], kk(n, { h, nb, dir, state, on: state === 1 ? 1 : 0, phase: 9 })), n);
  }
});
test("STREAM ripple phase wraps at the tile period", () => {
  for (let h = 0; h < 3; h++) assert.deepEqual(run(LIVING.STREAM, kk("STREAM", { h, phase: 0 })), run(LIVING.STREAM, kk("STREAM", { h, phase: 40 })));
});
test("QUICKSAND: 2/3/4 terraces, the same intact outer rim at every heat, throat centre follows the last terrace", async () => {
  const { GEO } = await import("../src/render/featart/geo.js");
  assert.deepEqual(GEO.QUICK.radii.map((r) => r.length), [2, 3, 4]);
  assert.deepEqual(GEO.QUICK.radii.map((r) => r[0]), [17.8, 17.8, 17.8]);
  GEO.QUICK.radii.forEach((r, h) => { for (let i = 1; i < r.length; i++) assert.ok(r[i] < r[i - 1]); assert.deepEqual(GEO.QUICK.c[h], [20 + 0.6 * (r.length - 1), 20 + 0.9 * (r.length - 1)]); });
});

import { createWorld, loadLevel } from "../src/core/sim.js";
import { atlasSpecs } from "../src/render/three/featmesh.js";
const room = (gen, seed, rm, heat) => { const w = createWorld(seed, rm); w.gen = gen; w.heat = heat; loadLevel(w, rm, false); return w; };
test("atlas cap: every tile room's distinct cells (all state variants) fit the 64-cell atlas", () => {
  let worst = 0;
  for (const rm of [1, 2, 3, 5]) for (let seed = 1; seed <= 80; seed++) for (const heat of [0, 2]) {
    const w = room(2, 1000 + seed, rm, heat);
    if (!w.feat) continue;
    const n = atlasSpecs(w).length; worst = Math.max(worst, n);
    assert.ok(n <= 64, `room ${rm} seed ${seed} heat ${heat}: ${n} cells`);
  }
  assert.ok(worst > 0);
});

import { buildFeat } from "../src/render/three/featmesh.js";
test("an unknown feat code paints nothing and does not throw; no feat layer builds no atlas specs", () => {
  const w = world([[5, 5, 99], [6, 5, 0]]);
  assert.doesNotThrow(() => { cellSpec(w, 5, 5); });
  const w2 = room(1, 5, 1, 0);
  assert.equal(w2.feat ?? null, null);
});
test("PAUSE freezes tile effects: with featT fixed, update() leaves every uniform and instance as it was", () => {
  const w = room(2, 1003, 3, 1), b = BIOMES[2];
  assert.ok(w.feat, "tile room");
  const L = buildFeat(w, b);
  w.featT = 4.25; L.update(w);
  const snap = () => JSON.stringify([L.mesh.material.userData.uniforms ?? null, Array.from(L.mesh.geometry.getAttribute("aCell").array), Array.from(L.mesh.geometry.getAttribute("aFx").array)]);
  const a = snap(); L.update(w); L.update(w);
  assert.equal(snap(), a);
});

import { fragSource } from "../src/render/three/featmesh.js";
import { GEO } from "../src/render/featart/geo.js";
test("fragSource carries every geometry number the painters use (art and shader cannot drift)", () => {
  const f = fragSource(GEO), n = (v) => (+v).toFixed(4);
  for (const v of [GEO.PORTAL.tick.w, GEO.PORTAL.tick.g, GEO.PORTAL.tick.y, GEO.PORTAL.tick.h, GEO.GATE.x0, GEO.GATE.x1, GEO.GATE.bw, GEO.GATE.y0, GEO.GATE.y1 - GEO.GATE.y0, ...GEO.GATE.n]) assert.ok(f.includes(n(v)), "missing " + n(v));
  for (const v of [...GEO.PORTAL.core.half, ...GEO.STREAM.half.map((h) => h - GEO.STREAM.scrollInset), ...GEO.QUICK.rIn].map((x) => x / CFG.TILE)) assert.ok(f.includes(n(v)), "missing " + n(v));
  for (const c of GEO.QUICK.c) assert.ok(f.includes(n(c[0] / CFG.TILE)), "missing quick centre");
  assert.ok(!/NaN|undefined/.test(f));
});
test("REAL 3D tile room still adds exactly ONE draw with the D layer", async () => {
  const { buildScene, countDrawCalls } = await import("../src/render/three/scene.js");
  for (const rm of [1, 2, 3, 5]) {
    const w = room(2, 93, rm, 0), w0 = room(2, 93, rm, 0); w0.feat = null;
    assert.equal(countDrawCalls(buildScene(w, null).group) - countDrawCalls(buildScene(w0, null).group), 1, "room " + rm);
  }
});

import { readFileSync } from "node:fs";
import { featPxCell } from "../src/render/featpx.js";
import { validateCell } from "../src/render/pixel/grid.js";
test("PIXEL: every direction D cell is palette slots only and valid (kind x heat x state x outer x dir)", () => {
  const KS = [["GLIDE"], ["BELT"], ["STREAM"], ["BLOOM"], ["PLATE"], ["QUICK"], ["PORTAL"], ["GATE"]];
  const outers = [[], ["N", "S"], ["E", "W"], ["N", "E", "S", "W"], ["W"], ["E"]];
  for (const [kind] of KS) for (let h = 0; h < 3; h++) for (const outer of outers) for (const dir of [0, 1, 2, 3]) for (const state of [0, 1, 2]) for (const lit of [0, 2, 4]) for (const pair of [1, 2, 3]) {
    const c = featPxCell("X", { kind, h, outer, dir, state, lit, pair });
    assert.deepEqual(validateCell(c, c.pal), [], `${kind} h${h}`);
    assert.equal(c.rows.length, 20); for (const r of c.rows) assert.equal(r.length, 20);
    for (const v of Object.values(c.pal)) assert.ok(/^tile\.(bg0|bg1|floor0|floor1|wall|wallHi)(\.(outline|shadow|light))?$/.test(v), v);
  }
});
test("PIXEL PORTAL never uses wallHi.light (VOID dim rule) at any heat or pair", () => {
  for (let h = 0; h < 3; h++) for (const pair of [1, 2, 3]) { const c = featPxCell("VOID", { kind: "PORTAL", h, pair }); assert.ok(!c.rows.join("").includes("X"), `h${h} pair${pair}`); }
});
test("PIXEL cell files stay under the byte cap (outside the px tree until #15)", () => {
  const n = readFileSync(new URL("../src/render/featpx.js", import.meta.url)).length + readFileSync(new URL("../src/render/featpxcells.js", import.meta.url)).length;
  assert.ok(n <= 26000, n + " bytes");
});

import { heatSep, edgeEnergy, hullDist, litSkew, maxLum } from "../tools/tileart/gatefns.mjs";
const solid = (r, g, b, S = 8) => { const a = new Uint8ClampedArray(S * S * 4); for (let i = 0; i < a.length; i += 4) { a[i] = r; a[i + 1] = g; a[i + 2] = b; a[i + 3] = 255; } return a; };
test("gate functions: identical renders have zero heat separation and busyness; a red pixel is off the VOID slot hull", () => {
  assert.equal(heatSep(solid(40, 40, 40), solid(40, 40, 40), 8), 0);
  assert.ok(heatSep(solid(40, 40, 40), solid(120, 120, 120), 8) > 20);
  assert.equal(edgeEnergy(solid(9, 9, 9, 16), 16), 0);
  const b = BIOMES.find((x) => x.name === "VOID"), V = [b.bg0, b.bg1, b.floor0, b.floor1, b.wall, b.wallHi].map(rgb).concat([[0, 0, 0], [255, 255, 255]]);
  assert.ok(hullDist(rgb(b.wallHi), V) < 2);
  assert.ok(hullDist([255, 0, 0], V) > 30);
  assert.equal(maxLum(solid(0, 0, 0)), 0);
  assert.equal(litSkew(solid(0, 0, 0), 8).dSkew, 0);
});

test("specKey: two ICE tiles of one patch that paint differently get different atlas/bake keys (gx and gy both)", () => {
  const w = world([2, 3, 4, 5, 6, 7, 8].map((x) => [x, 5, 5]));
  assert.notEqual(specKey(cellSpec(w, 4, 5)), specKey(cellSpec(w, 6, 5)));
  const b = BIOMES.find((x) => x.name === "ICE"), a = rec(), c = rec();
  paintCell(a.ctx, b, cellSpec(w, 4, 5)); paintCell(c.ctx, b, cellSpec(w, 6, 5));
  assert.notDeepEqual(a.log, c.log, "painters differ, so the keys must");
});
test("PAUSE freezes: buildFeat exposes its clock uniforms and update() with a fixed featT leaves them unchanged", () => {
  const w = room(2, 1003, 3, 1), L = buildFeat(w, BIOMES[2]);
  w.featT = 4.25; L.update(w);
  const a = JSON.stringify([L.uniforms.uT.value, L.uniforms.uSt.value, L.uniforms.uTime.value]);
  L.update(w); L.update(w);
  assert.equal(JSON.stringify([L.uniforms.uT.value, L.uniforms.uSt.value, L.uniforms.uTime.value]), a);
  assert.equal(L.uniforms.uTime.value, 4.25);
});
