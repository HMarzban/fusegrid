/* #22 TRAP placement: V20 + V23 + V26 + V27 at once. A TRAP spot depends only
   on the layout's walls, so a GAUNTLET with no 3 SHRINK-safe spots cannot be
   saved by a salt: gen 3 walks on to the next layout attempt, and only then
   leaves the gen-2 layout. Gen 2 itself never moves. */
import test from "node:test";
import "../src/core/board3.js";
import assert from "node:assert/strict";
import { CFG } from "../src/core/config.js";
import { createWorld, loadLevel, step } from "../src/core/sim.js";
import { genBoard2, layout2 } from "../src/core/board2.js";
import { FEAT_PROFILE } from "../src/core/feat.js";
import { PLATE_TPL, placeFeat, plateFill } from "../src/core/featplace.js";
import { featChecks } from "../src/core/featchecks.js";
import { makeWorld } from "../tools/balance/tilerun.mjs";
import { createTileBot } from "../tools/balance/demobot-tiles.mjs";
import { clone } from "../tools/balance/oracle.mjs";

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
test("PIT holds 3-4 traps, at most one on a central-door spot; other layouts keep 3-5", () => {
  const seen = { pit: new Set(), ring: new Set() };
  let fat = 0;
  for (let s = 0; s < 240; s++) {
    const seed = 91000 + s * 37, b = genBoard2(seed, 5, 0, { feat: true }), tpl = b.layout.tpl;
    if (!b.feat) continue;
    const lay = layout2(seed, 5, b.layout.tries[0]), spots = [];
    for (let k = 0; k < b.feat.length; k++) if (b.feat[k] === 7) spots.push(k);
    if (seen[tpl]) seen[tpl].add(spots.length);
    if (tpl !== "pit") continue;
    assert.ok(spots.length >= 3 && spots.length <= PLATE_TPL.pit.max, "seed " + seed);
    const over = spots.filter((k) => plateFill(lay.m, k % 15, (k / 15) | 0) > PLATE_TPL.pit.fill).length;
    assert.ok(over <= PLATE_TPL.pit.seal, "seed " + seed);
    fat += over;
  }
  assert.ok(fat > 0, "the one central-door spot is still dealt, so the dial keeps its teeth");
  assert.deepEqual([...seen.pit].sort(), [3, 4]);
  assert.deepEqual([...seen.ring].sort(), [3, 4, 5]);
});
test("from the moment a trap arms, standing still is never hit by that trap's blast", () => {
  const still = { move: { x: 0, y: 0 }, fire: false, firePrev: false, shift: false, remote: false, kick: false };
  for (const heat of [0, 1, 2]) {
    let arms = 0;
    for (let s = 0; s < 24; s++) {
      const { w, seed } = makeWorld({ room: 5, heat, arm: "A1" }, 760000 + s), bot = createTileBot(seed);
      for (let i = 0; i < 2400 && w.state === "PLAY"; i++) {
        step(w, CFG.STEP, { 0: bot.intent(w) });
        const armed = w.events.some((e) => e.t === "plate");
        w.events.length = 0;
        if (!armed) continue;
        arms++;
        const c = clone(w);
        c.players[0].iFrames = 0;
        for (const f of c.enemies) f.r = -CFG.TILE * CFG.CONTACT_R;
        for (let j = 0; j < 75 && c.state === "PLAY"; j++) {
          step(c, CFG.STEP, { 0: still });
          const h = c.events.find((e) => e.t === "hurt");
          c.events.length = 0;
          if (!h) continue;
          const hx = Math.floor(h.x / CFG.TILE), hy = Math.floor(h.y / CFG.TILE);
          assert.ok(!c.blades.some((b) => b.src === "plate" && b.tiles.some((q) => q.tx === hx && q.ty === hy)), `heat ${heat} s ${s} tick ${i}`);
          break;
        }
      }
    }
    assert.ok(arms > 0, "heat " + heat + " saw an arming");
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
      const ok = [0, 1, 2, 3].some((salt) => placeFeat(g2.m, seed, 5, g2.biome, salt, null, g2.tpl).feat);
      if (ok) assert.equal(b3.layout.tries[0], b2.layout.tries[0], "seed " + seed);
    }
  }
});
