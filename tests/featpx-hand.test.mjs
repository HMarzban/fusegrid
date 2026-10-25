/* PIXEL floor tiles, hand art (2026-10-25): every tile kind has its hand frames or hand parts in pixel/art/feat.js, the frames are 20x20 DPAL-slot grids,
   and featPxCell draws them (a static kind at a full-outer idle state returns its hand frame unchanged), so no tile falls back to a blank cell. */
import test from "node:test";
import assert from "node:assert/strict";
import { FEAT_ART } from "../src/render/pixel/art/feat.js";
import { featPxCell } from "../src/render/featpx.js";
import { DPAL } from "../src/render/featpxcells.js";

const FRAMES = ["BLOOM", "PLATE", "QUICK", "PORTAL", "GLIDE", "GATE"], PARTS = ["BELT", "STREAM"];

test("every kind has hand art: three 20x20 slot-only frames, or the flow parts", () => {
  for (const k of FRAMES) {
    assert.equal(FEAT_ART[k].length, 3, k);
    for (const g of FEAT_ART[k]) { assert.equal(g.length, 20, k); for (const r of g) { assert.equal(r.length, 20, k); for (const c of r) assert.ok(c in DPAL, k + " " + c); } }
  }
  for (const k of PARTS) assert.ok(FEAT_ART[k] && FEAT_ART[k].roll ? FEAT_ART[k].roll.length === 3 : FEAT_ART[k].rip.length === 3, k);
});

test("featPxCell draws the hand frame for an idle lone tile", () => {
  const sp = { BLOOM: {}, PLATE: {}, QUICK: {}, GLIDE: null, GATE: { state: 1 } };
  for (const [k, s] of Object.entries(sp)) if (s) for (let h = 0; h < 3; h++) assert.deepEqual(featPxCell("X", { kind: k, h, outer: ["N", "E", "S", "W"], ...s }).rows, [...FEAT_ART[k][h]], k + h);
  for (let h = 0; h < 3; h++) { const r = featPxCell("X", { kind: "PORTAL", h, pair: 1 }).rows, d = r.map((row, y) => (row !== FEAT_ART.PORTAL[h][y] ? y : -1)).filter((y) => y >= 0); assert.ok(d.length > 0 && d.every((y) => y === 15 || y === 16), "PORTAL pair ticks touch only the south bezel rows " + d); }
  for (const k of ["BELT", "STREAM"]) assert.ok(!featPxCell("X", { kind: k, h: 1, dir: 0, outer: ["N", "S"] }).rows.every((r) => r === "O".repeat(20)), k);
});
