/* PIXEL floor-tile cells (polish pass 2026-10-25): the eight tiles x three heats are deterministic 20x20 palette-slot grids, CORE / PLUS / MAX read apart at the
   40 px view (the gates.mjs heat-separation rule applied to the PIXEL cells), VOID stays under wallHi, and open floor around a fixture keeps the base slab bevel. */
import test from "node:test";
import assert from "node:assert/strict";
import { BIOMES } from "../src/core/config.js";
import { featPxCell } from "../src/render/featpx.js";
import { DPAL, floorPxCell } from "../src/render/featpxcells.js";
import { cellRGBA, validateCell } from "../src/render/pixel/grid.js";
import { heatSep, maxLum, lum, rgbOf } from "../tools/tileart/gatefns.mjs";

const TILES = [["BLOOM", "JUNGLE", {}], ["GLIDE", "ICE", {}], ["BELT", "FACTORY", { dir: 0, outer: ["N", "S"] }], ["STREAM", "WATER", { dir: 0, outer: ["N", "S"] }],
  ["PLATE", "ARENA", {}], ["QUICK", "SAND", {}], ["PORTAL", "VOID", { pair: 1 }], ["GATE", "CROWN", { lit: 0 }]];
const bio = (n) => BIOMES.find((b) => b.name === n);
const cell = (k, bn, sp, h) => featPxCell(bio(bn), { kind: k, h, outer: ["N", "E", "S", "W"], ...sp });
const big = (c, bn, k = 8) => { const a = cellRGBA(c, c.pal, { biome: bio(bn) }), S = 20 * k, o = new Uint8ClampedArray(S * S * 4); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) for (let i = 0; i < 4; i++) o[(y * S + x) * 4 + i] = a[((y / k | 0) * 20 + (x / k | 0)) * 4 + i]; return o; };

test("eight tiles x three heats: deterministic, 20x20, palette slots only", () => {
  for (const [k, bn, sp] of TILES) for (let h = 0; h < 3; h++) {
    const a = cell(k, bn, sp, h), b = cell(k, bn, sp, h);
    assert.deepEqual(a.rows, b.rows, k + h + " deterministic");
    assert.equal(a.w, 20); assert.equal(a.h, 20); assert.equal(a.rows.length, 20);
    for (const r of a.rows) { assert.equal(r.length, 20); for (const ch of r) assert.ok(ch in DPAL, k + h + " char " + ch); }
    assert.deepEqual(validateCell(a, a.pal), [], k + h);
    for (const v of Object.values(a.pal)) assert.match(v, /^tile\.(bg0|bg1|floor0|floor1|wall|wallHi)(\.(outline|shadow|light))?$/);
  }
});

test("CORE / PLUS / MAX separate by >= 4 L* at the 40 px view (idle and the worst states)", () => {
  const set = TILES.concat([["PLATE", "ARENA", { state: 1, lit: 4 }], ["GATE", "CROWN", { lit: 4 }], ["BLOOM", "JUNGLE", { state: 1 }], ["PORTAL", "VOID", { pair: 3 }]]);
  for (const [k, bn, sp] of set) {
    const im = [0, 1, 2].map((h) => big(cell(k, bn, sp, h), bn));
    for (const [a, b] of [[0, 1], [1, 2], [0, 2]]) assert.ok(heatSep(im[a], im[b], 160) >= 4, k + JSON.stringify(sp) + " heat " + a + "-" + b);
  }
});

test("VOID PORTAL never passes wallHi at any heat or pair", () => {
  const cap = lum(...rgbOf(bio("VOID").wallHi));
  for (let h = 0; h < 3; h++) for (const pair of [1, 2, 3]) assert.ok(maxLum(big(cell("PORTAL", "VOID", { pair }, h), "VOID", 1)) <= cap + 1.5, "h" + h + " pair" + pair);
});

test("open floor around a fixture keeps the base floor's slab shadow (bottom / right) and never a lit top / left run", () => {
  for (const [k, bn, par] of [["BLOOM", "JUNGLE", 1], ["PLATE", "ARENA", 1], ["QUICK", "SAND", 0], ["PORTAL", "VOID", 1]]) for (let h = 0; h < 3; h++) {
    const t = cell(k, bn, {}, h).rows, f = floorPxCell(bn, par, 0).rows, [lit, base] = par ? ["P", "O"] : ["L", "K"];
    assert.equal(t[19].slice(1), f[19].slice(1), k + h + " bottom edge"); assert.equal(t.map((r) => r[19]).join("").slice(1), f.map((r) => r[19]).join("").slice(1), k + h + " right edge");
    assert.equal(t[0], base.repeat(20), k + h + " top edge is base"); assert.ok(!t.some((r) => r[0] === lit), k + h + " no lit left run");
  }
});
