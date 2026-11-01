/* #22 TRAP placement: V20 + V23 + V26 + V27 at once. A TRAP spot depends only
   on the layout's walls, so a GAUNTLET with no 3 SHRINK-safe spots cannot be
   saved by a salt: gen 3 walks on to the next layout attempt, and only then
   leaves the gen-2 layout. Gen 2 itself never moves. */
import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { genBoard2, layout2 } from "../src/core/board2.js";
import { FEAT_PROFILE, placeFeat } from "../src/core/feat.js";
import { featChecks } from "../src/core/featchecks.js";

const BAD = 2193589889, ONLY = ["V13", "V14", "V20", "V23", "V26", "V27"];
const hx = (a) => Buffer.from(a).toString("hex");
const world = (seed, heat) => { const w = createWorld(seed, 5); w.gen = 3; w.heat = heat; loadLevel(w, 5, false); return w; };

test("a GAUNTLET with no 3 SHRINK-safe spots fails placement at every salt", () => {
  const a = genBoard2(BAD, 5, 0).layout.tries[0], lay = layout2(BAD, 5, a);
  assert.equal(lay.tpl, "gauntlet");
  for (let salt = 0; salt < 4; salt++) assert.equal(placeFeat(lay.m, BAD, 5, lay.biome, salt).feat, null);
});
test("gen 3 re-rolls that layout at every heat to one shared layer; gen 2 keeps its board", () => {
  const b2 = [0, 1, 2].map((h) => genBoard2(BAD, 5, h)), b3 = [0, 1, 2].map((h) => genBoard2(BAD, 5, h, { feat: true }));
  for (let h = 0; h < 3; h++) {
    assert.equal(b2[h].layout.tpl, "gauntlet");
    assert.equal(b2[h].feat, null);
    assert.ok(b3[h].feat, "heat " + h + " has traps");
    assert.ok(b3[h].layout.tries[0] > b2[h].layout.tries[0], "a later attempt");
    assert.equal(hx(b3[h].feat), hx(b3[0].feat), "same layer");
    assert.equal(hx(b3[h].grid), hx(genBoard2(BAD, 5, h, { feat: true }).grid), "deterministic");
  }
});
test("room 5, 60 seeds x 3 heats: V20, V23, V26, V27 pass and a feasible layout stays the gen-2 layout", () => {
  for (let s = 0; s < 60; s++) {
    const seed = 70000 + s * 131;
    const ws = [0, 1, 2].map((h) => world(seed, h));
    for (let h = 0; h < 3; h++) {
      const w = ws[h], f = featChecks(w, FEAT_PROFILE[h], { only: ONLY }).map((r) => r.id + " " + r.why);
      assert.deepEqual(f, [], "seed " + seed + " heat " + h);
      assert.equal(hx(w.feat), hx(ws[0].feat), "heat never moves a trap");
      const b2 = genBoard2(seed, 5, h), b3 = genBoard2(seed, 5, h, { feat: true });
      const g2 = layout2(seed, 5, b2.layout.tries[0]);
      const ok = [0, 1, 2, 3].some((salt) => placeFeat(g2.m, seed, 5, g2.biome, salt).feat);
      if (ok) assert.equal(b3.layout.tries[0], b2.layout.tries[0], "seed " + seed);
    }
  }
});
