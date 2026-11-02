/* The room-start speed work in featchecks.js changes how fast the checks run, never what
   they decide. firstSpot (the placement gates) must give the same pass / fail as the full
   scan, and the shared scratch buffers must not carry one call's answer into the next. */
import test from "node:test";
import assert from "node:assert/strict";
import { CFG, T } from "../src/core/config.js";
import { createWorld, loadLevel } from "../src/core/world.js";
import "../src/core/board3.js";
import { FEAT_PROFILE } from "../src/core/feat.js";
import { featChecks, timedEscape, lethalMap } from "../src/core/featchecks.js";

const N = CFG.COLS * CFG.ROWS;
const board = (seed, room, heat) => { const w = createWorld(seed); w.seed = seed; w.gen = 3; w.heat = heat; loadLevel(w, room); return w; };
const J = (x) => JSON.stringify(x);
let r = 77;
const rnd = (m) => { r = (Math.imul(r, 1664525) + 1013904223) >>> 0; return (r >>> 8) % m; };
/* tiles dropped with no gate, so a good share of these boards do fail */
function ungated(w, codes, count) {
  const open = [], feat = new Uint8Array(N), grid = w.grid.slice();
  for (let k = 0; k < N; k++) if (grid[k] !== T.WALL) open.push(k);
  const ks = [];
  for (let i = 0; i < count; i++) { const k = open[rnd(open.length)]; if (ks.includes(k)) continue; ks.push(k); feat[k] = codes[rnd(codes.length)]; grid[k] = T.EMPTY; }
  return { b: { grid, feat, level: w.level, heat: w.heat, items: [], enemies: [] }, ks };
}

test("firstSpot gives the full scan's pass or fail", () => {
  let failed = 0, passed = 0;
  for (let seed = 1; seed <= 12; seed++) for (const [room, codes] of [[1, [6]], [2, [5]], [3, [1]], [4, [8, 9, 10, 11]]]) for (let h = 0; h < 3; h++) {
    const { b, ks } = ungated(board(seed, room, h), codes, 3 + rnd(8));
    for (const only of [["V18", "V19"], ["V29"]]) for (const o of [{}, { around: ks, aroundR: 0 }, { near: ks.slice(0, 1) }]) {
      const full = featChecks(b, FEAT_PROFILE[h], { only, ...o }).length > 0;
      assert.equal(featChecks(b, FEAT_PROFILE[h], { only, ...o, firstSpot: true }).length > 0, full);
      if (full) failed++; else passed++;
    }
  }
  assert.ok(failed > 20 && passed > 20, `both answers exercised: ${failed} fail, ${passed} pass`);
});

test("a check's answer does not depend on the call before it", () => {
  const a = ungated(board(5, 1, 2), [6], 6).b, c = ungated(board(9, 4, 2), [8, 9, 10, 11], 8).b, d = ungated(board(3, 2, 0), [5], 8).b;
  const first = [a, c, d].map((b) => J(featChecks(b, FEAT_PROFILE[b.heat])));
  const shuffled = [d, a, c, a, d, c].map((b) => J(featChecks(b, FEAT_PROFILE[b.heat])));
  assert.deepEqual([shuffled[1], shuffled[2], shuffled[0]], first);
  assert.deepEqual([shuffled[3], shuffled[5], shuffled[4]], first);
});

test("the exported engine keeps its shapes", () => {
  const w = board(11, 1, 0), g = w.grid, k = 1 * CFG.COLS + 1;
  const L = lethalMap(g, null, FEAT_PROFILE[0], [{ t: 2, k, arms: [[1, 0, 2], [0, 1, 2]], through: false }], false);
  assert.ok(L instanceof Float64Array && L.length === N && L.relay === false);
  assert.equal(L[k], 2);
  const M = lethalMap(g, null, FEAT_PROFILE[0], [{ t: 1, k, arms: [[1, 0, 1]], through: false }], false);
  assert.equal(L[k], 2, "a second call leaves the first map alone");
  assert.equal(M[k], 1);
  const E = { g, feat: null, prof: FEAT_PROFILE[0], pm: 1, cap: 4, tiles: false, mvTiles: false, moves: false, stopOnBrick: true, plantBlock: true, open: -1, twin: null, vp: 3.4 };
  const hit = timedEscape(E, L, k, k);
  assert.ok(hit.ok ? hit.t > 0 && hit.steps > 0 : Object.keys(hit).length === 1);
  assert.deepEqual(timedEscape(E, new Float64Array(N).fill(Infinity), k, k), { ok: true, t: 0, steps: 0 });
});
