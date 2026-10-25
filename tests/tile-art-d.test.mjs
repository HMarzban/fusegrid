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
      assert.ok(/^#[0-9a-f]{6}$/i.test(col), n + " " + col);
      const c = rgb(col);
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
