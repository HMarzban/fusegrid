/* #30 balance tools, the small-sample gates (the sweeps run offline):
   - the oracle's clone steps exactly like the world it copied;
   - the oracle can say FORCED (a sealed box) and can find a two-turn escape
     the one-turn plans cannot, so "escapable" is a finding, not a default;
   - it flags the same episodes the sweep's counter counts;
   - the tile-hit gate is the paired share (A1 - A0) / A1, in pass / FAIL /
     unresolved bands. */
import test from "node:test";
import assert from "node:assert/strict";
import { CFG, T, key } from "../src/core/config.js";
import { step } from "../src/core/sim.js";
import { createTileBot } from "../tools/balance/demobot-tiles.mjs";
import { makeWorld, runRoom, simSnap } from "../tools/balance/tilerun.mjs";
import { clone, search, runOracle } from "../tools/balance/oracle.mjs";
import { gateRow, inBand } from "../tools/balance/summary.mjs";
import { pairedRatioCI } from "../tools/balance/stats.mjs";

const NOOP = { move: { x: 0, y: 0 }, fire: false, firePrev: false, shift: false, remote: false, kick: false };

test("a clone steps exactly like the world it copied", () => {
  for (const room of [1, 2, 3, 5]) {
    const { w, seed } = makeWorld({ room, heat: 2, arm: "A1" }, 3), bot = createTileBot(seed);
    for (let i = 0; i < 300 && w.state === "PLAY"; i++) { step(w, CFG.STEP, { 0: bot.intent(w) }); w.events.length = 0; }
    const c = clone(w), snap = (o) => simSnap(o).replace(/"rs":-?\d+/, (m) => `"rs":${+m.slice(5) >>> 0}`);
    assert.equal(snap(c), snap(w));
    for (let i = 0; i < 200; i++) {
      step(w, CFG.STEP, { 0: NOOP }); step(c, CFG.STEP, { 0: NOOP });
      w.events.length = 0; c.events.length = 0;
    }
    assert.equal(snap(c), snap(w));
  }
});

/* a tile-free room carved by hand: the player on a lit bomb at (1,1) */
function carved(cells, timer = 2.5) {
  const { w } = makeWorld({ room: 1, heat: 0, arm: "A0" }, 0);
  w.grid.fill(T.WALL);
  for (const [x, y] of cells) w.grid[key(x, y)] = T.EMPTY;
  /* a live foe sealed in a far cell, so the room does not end at once */
  w.grid[key(13, 11)] = T.EMPTY;
  w.enemies.length = 1; w.items.length = 0;
  Object.assign(w.enemies[0], { x: 13.5 * CFG.TILE, y: 11.5 * CFG.TILE, tx: 13, ty: 11 });
  const p = w.players[0];
  p.x = 1.5 * CFG.TILE; p.y = 1.5 * CFG.TILE; p.tx = 1; p.ty = 1; p.iFrames = 0; p.gl = null;
  w.bombs.length = 0; w.blades.length = 0;
  w.bombs.push({ x: p.x, y: p.y, tx: 1, ty: 1, timer, radius: 3, pierce: false, line: false, dir: null, variant: "normal", dead: false, owner: 0 });
  return w;
}

test("the oracle says forced in a sealed box", () => {
  const w = carved([[1, 1], [2, 1], [3, 1]]);
  assert.equal(search(w), false);
});

test("the search finds a two-turn escape", () => {
  const w = carved([[1, 1], [2, 1], [3, 1], [3, 2], [3, 3], [4, 3], [5, 3]]);
  assert.equal(search(w), true);
});

test("the oracle flags the same episodes the sweep counts", () => {
  let a = 0, b = 0;
  for (let s = 600000; s < 600004; s++) {
    const c = { room: 1, heat: 2, arm: "A1" };
    a += runOracle(c, s, { margins: false }).length;
    b += runRoom(c, s).noEsc;
  }
  assert.equal(a, b);
});

test("the tile-hit gate is the paired share of hits", () => {
  const a = [1, 1, 1, 1], b = [2, 1, 2, 1];
  const c = pairedRatioCI(a, b, (x, y) => (y ? (y - x) / y : 0));
  assert.ok(Math.abs(c.mean - 2 / 6) < 1e-9);
  assert.equal(inBand({ lo: 0, hi: 4 }, -Infinity, 5), "pass");
  assert.equal(inBand({ lo: 4, hi: 6 }, -Infinity, 5), "unresolved");
  assert.equal(inBand({ lo: 6, hi: 9 }, -Infinity, 5), "FAIL");
  const row = (hits) => ({ s: 0, st: "LOSE", t: 9, hits, hit15: 0, hit5: 0, kills: 0, tileKills: 0, ownRelay: 0, nearMiss: 0, rules: 1 });
  const g = gateRow(5, 2, [row(2), row(2)], [row(3), row(3)]);
  assert.ok(Math.abs(g.share.mean - 100 / 3) < 1e-9);
  assert.equal(g.tileHit, "FAIL");
});
