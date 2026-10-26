/* tools/balance/featchecks.mjs (#28 design pass 2): the floor-tile checks
   V13-V27 as pure static checks. One hand-made pass and fail fixture per
   check, plus V18 == V2 parity on real boards with the layer off. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CFG, T, key } from "../src/core/config.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { validateBoard, stampStart } from "../src/core/fair.js";
import { heatProfile } from "../src/core/heat.js";
import { F, FEAT_PROFILE } from "../src/core/feat.js";
import { featChecks, skippedChecks, tableChecks, FEAT_RULES } from "../tools/balance/featchecks.mjs";

const C = CFG.COLS, R = CFG.ROWS, N = C * R, P = FEAT_PROFILE;
const lattice = () => { const g = new Int8Array(N); for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) g[key(x, y)] = x === 0 || y === 0 || x === C - 1 || y === R - 1 || (x % 2 === 0 && y % 2 === 0) ? T.WALL : T.EMPTY; return g; };
const blank = () => new Int8Array(N).fill(T.WALL);
/* b({level, heat, g, open, walls, bricks, tiles:[[x,y,code]], items, foes}) */
function b(o = {}) {
  const g = o.g ? o.g.slice() : stampStart(lattice()), feat = new Uint8Array(N);
  for (const [x, y] of o.open || []) g[key(x, y)] = T.EMPTY;
  for (const [x, y] of o.walls || []) g[key(x, y)] = T.WALL;
  for (const [x, y] of o.bricks || []) g[key(x, y)] = T.BRICK;
  for (const [x, y, v] of o.tiles || []) feat[key(x, y)] = v;
  return { grid: g, feat, level: o.level ?? 3, heat: o.heat ?? 1, gen: 3, items: o.items || [], foes: o.foes || [], featPair: o.featPair || null };
}
const row = (y, x0, x1) => { const a = []; for (let x = x0; x <= x1; x++) a.push([x, y]); return a; };
const corridor = (x0, x1, y = 5) => { const g = blank(); for (const [x, yy] of row(y, x0, x1)) g[key(x, yy)] = T.EMPTY; return g; };
const ids = (r) => r.map((f) => f.id);
const run = (bd, prof, id, o = {}) => featChecks(bd, prof, { only: [id], ...o });
const fails = (bd, prof, id, o) => ids(run(bd, prof, id, o)).includes(id);
const E = (xs, y, v) => xs.map((x) => [x, y, v]);

test("V13 layer sanity: home biome, one kind, never on a WALL, gen 3 only, portal pairs", () => {
  assert.ok(!fails(b({ tiles: E([6, 7, 8, 9], 5, F.BELT_E) }), P[1], "V13"));
  assert.ok(fails(b({ tiles: [[7, 7, F.BLOOM]] }), P[1], "V13"), "BOOSTER in FACTORY");
  assert.ok(fails(b({ tiles: [[6, 6, F.BELT_E]] }), P[1], "V13"), "on a WALL");
  assert.ok(fails(b({ tiles: [[7, 5, F.BELT_E], [9, 9, F.GLIDE]] }), P[1], "V13"), "two kinds");
  assert.ok(fails({ ...b({ tiles: E([6, 7, 8, 9], 5, F.BELT_E) }), gen: 2 }, P[1], "V13"), "gen 2 carries none");
  const pr = new Uint8Array(N); pr[key(7, 7)] = 1; pr[key(11, 9)] = 1;
  assert.ok(!fails(b({ level: 7, tiles: [[7, 7, F.PORTAL], [11, 9, F.PORTAL]], featPair: pr }), P[1], "V13"));
  const pr2 = pr.slice(); pr2[key(11, 9)] = 2;
  assert.ok(fails(b({ level: 7, tiles: [[7, 7, F.PORTAL], [11, 9, F.PORTAL]], featPair: pr2 }), P[1], "V13"), "pair of one");
});
test("V14 exclusion binds at 4 walking steps; no foe spawn, floor item or buried item on a tile", () => {
  const ok = { tiles: [[7, 7, F.BLOOM], [11, 9, F.BLOOM]], level: 1 };
  assert.ok(!fails(b(ok), P[0], "V14"));
  assert.ok(fails(b({ ...ok, open: [[3, 3]], tiles: [[3, 3, F.BLOOM]] }), P[0], "V14"), "(3,3) is 4 steps out");
  assert.ok(!fails(b({ ...ok, tiles: [[5, 3, F.BLOOM]] }), P[0], "V14"), "(5,3) is 6 steps out");
  assert.ok(fails(b({ ...ok, items: [{ x: 7.5 * CFG.TILE, y: 7.5 * CFG.TILE, buried: false }] }), P[0], "V14"), "floor item");
  assert.ok(fails(b({ ...ok, items: [{ tx: 11, ty: 9, buried: true }] }), P[0], "V14"), "buried item");
  assert.ok(fails(b({ ...ok, foes: [{ type: "stationary", tx: 7, ty: 7 }] }), P[0], "V14"), "SENTRY on a tile");
  assert.ok(!fails(b({ ...ok, foes: [{ type: "walker", tx: 9, ty: 7 }], items: [{ tx: 9, ty: 9 }] }), P[0], "V14"));
});
test("V15 conveyor chains: acyclic, 4-9 on odd lanes, <= 16 in all, open ends, a step-off within 2", () => {
  assert.ok(!fails(b({ tiles: E([6, 7, 8, 9], 5, F.BELT_E) }), P[1], "V15"));
  assert.ok(fails(b({ tiles: E([6, 7, 8], 5, F.BELT_E) }), P[1], "V15"), "3 long");
  assert.ok(fails(b({ tiles: E([10, 11, 12, 13], 5, F.BELT_E) }), P[1], "V15"), "lands on the border");
  assert.ok(fails(b({ open: [[8, 6]], tiles: [[7, 5, F.BELT_E], [8, 5, F.BELT_S], [8, 6, F.BELT_W], [7, 6, F.BELT_N]] }), P[1], "V15"), "loop");
  assert.ok(fails(b({ open: [[6, 6], [8, 6]], tiles: E([5, 6, 7, 8], 6, F.BELT_E) }), P[1], "V15"), "even lane");
  const nine = [2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.ok(!fails(b({ tiles: E(nine, 7, F.BELT_E) }), P[1], "V15"), "9 long");
  assert.ok(fails(b({ tiles: [...E(nine, 7, F.BELT_E), ...E(nine, 9, F.BELT_E)] }), P[1], "V15"), "18 tiles > 16");
  const g = corridor(3, 12); for (const y of [4, 6]) g[key(6, y)] = T.EMPTY;
  assert.ok(fails(b({ g, tiles: E([7, 8, 9, 10], 5, F.BELT_E) }), P[1], "V15"), "no step-off in a walled corridor");
});
test("V16 speed bound: a belt keeps >= 40% of the slowest moving foe and >= 50% of the player", () => {
  const bd = b({ tiles: E([6, 7, 8, 9], 5, F.BELT_E) });
  assert.ok(!fails(bd, P[1], "V16"));
  assert.ok(!fails({ ...bd, heat: 2 }, P[2], "V16"), "MAX 1.2 <= 0.6 x 2.04");
  assert.ok(fails(bd, { ...P[1], belt: { actors: true, v: 1.5 } }, "V16"));
  assert.ok(!fails(bd, { ...P[0], belt: { actors: false, v: 9 } }, "V16"), "bombs-only belts push no actor");
  assert.deepEqual(tableChecks(), []);
  assert.equal(tableChecks([P[2], P[0]]).length, 1, "a tile speed may not drop as heat rises");
});
test("V17 time-weighted foe distance, chain landings off the door ring, MAX never carries toward the start", () => {
  const free = { limits: { doorRing: 0 } }, foe = [{ type: "walker", tx: 11, ty: 1 }];
  assert.ok(!fails(b({ foes: foe, tiles: E([6, 7, 8, 9], 1, F.BELT_E) }), P[1], "V17", free), "10 plain steps, belt against it");
  assert.ok(fails(b({ foes: foe, tiles: E([6, 7, 8, 9], 1, F.BELT_W) }), P[1], "V17", free), "a belt toward the pocket shortens 10 steps in time");
  assert.ok(!fails(b({ foes: foe, tiles: E([6, 7, 8, 9], 1, F.BELT_W) }), P[0], "V17", free), "CORE belts carry no foe");
  const west = b({ tiles: E([9, 10, 11, 12], 5, F.BELT_W) });
  assert.ok(fails(west, P[1], "V17"), "lands 7 steps from door (1,5)");
  assert.ok(!fails({ ...west, heat: 1 }, P[1], "V17", free));
  assert.ok(fails({ ...west, heat: 2 }, P[2], "V17", free), "MAX: carries toward the start");
});
test("V18 safe first bomb with the tile live: booster side arms close the pocket at MAX only", () => {
  const bd = b({ level: 1, tiles: [[3, 1, F.BLOOM], [1, 3, F.BLOOM]] });
  assert.ok(!fails({ ...bd, heat: 0 }, P[0], "V18"));
  assert.ok(fails({ ...bd, heat: 2 }, P[2], "V18"));
  assert.ok(!fails({ ...b({ level: 1 }), feat: null }, P[2], "V18"), "the stamped lattice passes V2");
});
test("V18 is V2 exactly with the layer off (same fuse, same pace)", () => {
  const FMIN = Math.min(heatProfile(0).fuse, heatProfile(1).fuse, heatProfile(2).fuse);
  let bad = 0, n = 0;
  for (let s = 0; s < 12; s++) for (const [gen, lv] of [[1, 1 + (s % 8)], [2, 1 + ((s * 3) % 8)]]) {
    const w = createWorld(9100 + s, lv); w.gen = gen; loadLevel(w, lv, false);
    const a = fails({ grid: w.grid, feat: null, level: lv, heat: 0 }, P[0], "V18", { fuse: FMIN }), v2 = validateBoard(w.grid, lv, 0, { only: ["V2"] }).includes("V2");
    assert.equal(a, v2, `gen ${gen} seed ${9100 + s} room ${lv}`);
    if (v2) bad++; n++;
  }
  for (const set of [[[2, 1]], [[2, 1], [1, 2]], [[3, 1], [1, 3]], [[4, 1], [1, 4], [3, 2], [2, 3]], [[3, 1], [2, 3]], [[1, 2], [4, 1], [3, 2]]]) {
    const g = stampStart(lattice());
    for (const [x, y] of set) g[key(x, y)] = T.BRICK;
    const v2 = validateBoard(g, 1, 0, { only: ["V2"] }).includes("V2");
    assert.equal(fails({ grid: g, feat: null, level: 1, heat: 0 }, P[0], "V18", { fuse: FMIN }), v2, "pocket bricks " + JSON.stringify(set));
    if (v2) bad++;
  }
  assert.ok(bad > 0 && n > 0, "the parity sample holds V2 failures too");
});
const spots = (bd, prof) => { const r = run(bd, prof, "V19"); return r.length ? r[0] : { spots: 0, cause: {} }; };
test("V19 BOOSTER: the +2 relay overtakes a straight flee; a booster in a niche adds nothing", () => {
  const s = spots(b({ level: 1, g: corridor(3, 13), tiles: [[5, 5, F.BLOOM]] }), P[0]);
  assert.ok(s.spots > 0 && s.cause.relay > 0 && s.cap > 0, JSON.stringify(s));
  const dead = spots(b({ level: 1, g: corridor(3, 7), tiles: [[5, 5, F.BLOOM]] }), P[0]);
  assert.ok(dead.time > 0, "the relay fills a dead end: no exit in any number of steps " + JSON.stringify(dead));
  const g = corridor(3, 13); g[key(8, 4)] = T.EMPTY;
  assert.equal(spots(b({ level: 1, g, tiles: [[8, 4, F.BLOOM]] }), P[2]).spots, 0);
});
test("V19 ICE PATCH: MAX allows no stop mid-sheet; CORE and PLUS never add a spot", () => {
  const bd = b({ level: 2, g: corridor(3, 9), tiles: E([5, 6, 7], 5, F.GLIDE) });
  const s = spots({ ...bd, heat: 2 }, P[2]);
  assert.ok(s.spots > 0 && s.cause.coast > 0 && s.cap > 0, "the coast to (8,5) is in time, past the 4-step budget " + JSON.stringify(s));
  assert.equal(spots({ ...bd, heat: 1 }, P[1]).spots, 0);
  assert.equal(spots({ ...bd, heat: 0 }, P[0]).spots, 0);
});
test("V19 CONVEYOR: a riding player cannot hide on a belt (PLUS); a CORE bomb rides into the only exit", () => {
  const up = b({ g: corridor(3, 9), tiles: E([5, 6, 7], 5, F.BELT_W) });
  const s = spots({ ...up, heat: 1 }, P[1]);
  assert.ok(s.spots > 0 && s.cause.ride > 0 && s.cap > 0, JSON.stringify(s));
  assert.ok(!spots({ ...up, heat: 0 }, P[0]).cause.ride, "CORE carries no rider");
  const ride = spots({ ...b({ g: corridor(4, 13), tiles: E([5, 6, 7, 8], 5, F.BELT_E) }), heat: 0 }, P[0]);
  assert.ok(ride.cause["bomb-ride"] > 0, JSON.stringify(ride));
});
test("V19 TRAP: the MAX reach beats a straight flee in a corridor; CORE's does not, but its 0.5 s chain does", () => {
  const bd = b({ level: 5, g: corridor(3, 13), tiles: [[5, 5, F.PLATE]] });
  const mx = spots({ ...bd, heat: 2 }, P[2]);
  assert.ok(mx.cause["trap-blast"] > 0 && mx.time > 0 && mx.trapExact > 0, JSON.stringify(mx));
  const co = spots({ ...bd, heat: 0 }, P[0]);
  assert.ok(!co.cause["trap-blast"], JSON.stringify(co));
  assert.ok(co.cause["trap-chain"] > 0, "a bomb on a CORE trap arm can go off at 0.5 s");
  assert.ok(!spots({ ...bd, heat: 0 }, { ...P[0], plate: { ...P[0].plate, near: 0 } }).cause["trap-blast"]);
});
test("V20 SHRINK rings: a riding chain needs a step-off at the new wall, traps keep side exits, ice is never sealed", () => {
  const bd = b({ tiles: E([9, 10, 11, 12], 5, F.BELT_E) });
  assert.ok(!fails(bd, P[1], "V15"));
  assert.ok(fails(bd, P[1], "V20"), "ring 1 walls (13,5): (12,5) has only pillars beside it");
  assert.ok(!fails({ ...bd, heat: 0 }, P[0], "V20"), "CORE carries no rider");
  assert.ok(!fails(b({ tiles: [3, 4, 5, 6].map((y) => [7, y, F.BELT_S]) }), P[1], "V20"), "a chain whose ends hold through ring 4");
  assert.ok(fails(b({ tiles: E([6, 7, 8, 9], 5, F.BELT_E) }), P[1], "V20"), "ring 3 leaves (10,5) a dead end");
  const g = blank(); for (let y = 3; y <= 9; y++) { g[key(1, y)] = T.EMPTY; g[key(2, y)] = T.EMPTY; }
  const tr = b({ level: 5, g, tiles: [[2, 6, F.PLATE]] });
  assert.ok(!fails(tr, P[2], "V27"));
  assert.ok(fails(tr, P[2], "V20"), "ring 1 takes column 1, the only side exits");
  const ice = blank(); for (let y = 1; y <= 9; y++) ice[key(1, y)] = T.EMPTY; ice[key(2, 5)] = ice[key(3, 5)] = T.EMPTY;
  assert.ok(fails(b({ level: 2, g: ice, tiles: [[2, 5, F.GLIDE], [3, 5, F.GLIDE]] }), P[2], "V20"));
  ice[key(3, 6)] = ice[key(3, 7)] = ice[key(3, 8)] = ice[key(2, 8)] = T.EMPTY;
  assert.ok(!fails(b({ level: 2, g: ice, tiles: [[2, 5, F.GLIDE], [3, 5, F.GLIDE]] }), P[2], "V20"));
});
test("V21 heat-invariant layer, V22 rebuild, V23 drops; skippedChecks names what the inputs cannot decide", () => {
  const bd = b({ tiles: E([6, 7, 8, 9], 5, F.BELT_E) }), f = bd.feat, g = f.slice(); g[key(9, 5)] = 0;
  assert.deepEqual(skippedChecks(bd), ["V21", "V22"]);
  assert.ok(!fails({ ...bd, featByHeat: [f, f.slice(), f.slice()] }, P[1], "V21"));
  assert.ok(fails({ ...bd, featByHeat: [f, f, g] }, P[1], "V21"));
  assert.ok(!fails({ ...bd, rebuild: { feat: f.slice(), featPair: null } }, P[1], "V22"));
  assert.ok(fails({ ...bd, rebuild: { feat: g, featPair: null } }, P[1], "V22"));
  const drop = { ...bd, feat: null };
  assert.ok(fails(drop, P[1], "V23"));
  assert.equal(run({ ...drop, layout: { fallback: true } }, P[1], "V23")[0].fallback, true);
  assert.ok(!fails({ ...drop, gen: 2 }, P[1], "V23"));
  assert.ok(!fails(bd, P[1], "V23"));
});
test("V24 ICE PATCH sheets: 3-9 tiles, runs <= 3, >= 3 steps from spawn", () => {
  const ring = []; for (let y = 7; y <= 9; y++) for (let x = 7; x <= 9; x++) if (x !== 8 || y !== 8) ring.push([x, y, F.GLIDE]);
  assert.ok(!fails(b({ level: 2, tiles: ring }), P[2], "V24"));
  assert.ok(fails(b({ level: 2, tiles: [...ring, [10, 7, F.GLIDE], [11, 7, F.GLIDE]] }), P[2], "V24"), "10 tiles and a run of 5");
  assert.ok(fails(b({ level: 2, tiles: E([5, 6, 7, 8], 5, F.GLIDE) }), P[2], "V24"), "run of 4");
  assert.ok(fails(b({ level: 2, tiles: E([2, 3, 4], 1, F.GLIDE) }), P[2], "V24"), "on the pocket");
  assert.ok(fails(b({ level: 2, tiles: E([5, 6], 5, F.GLIDE) }), P[2], "V24"), "sheet of 2");
});
test("V25 BOOSTER: 2-4 on (odd,odd), >= 4 from the pocket, no two within 3 in a line, never under a brick", () => {
  const ok = [[7, 5, F.BLOOM], [11, 9, F.BLOOM]];
  assert.ok(!fails(b({ level: 1, tiles: ok }), P[0], "V25"));
  assert.ok(fails(b({ level: 1, tiles: [[7, 5, F.BLOOM]] }), P[0], "V25"), "one");
  assert.ok(fails(b({ level: 1, tiles: [...ok, [8, 5, F.BLOOM]] }), P[0], "V25"), "off (odd,odd)");
  assert.ok(fails(b({ level: 1, tiles: [...ok, [5, 3, F.BLOOM]] }), P[0], "V25"), "3 from the pocket");
  assert.ok(fails(b({ level: 1, tiles: [...ok, [7, 7, F.BLOOM]] }), P[0], "V25"), "2 apart in a column");
  assert.ok(fails(b({ level: 1, tiles: ok, bricks: [[11, 9]] }), P[0], "V25"), "under a brick");
});
test("V26 TRAP: 3-5 on (odd,odd), >= 6 steps out, no foe beside one, not on neighbouring crossings, never under a brick", () => {
  const ok = [[7, 7, F.PLATE], [11, 7, F.PLATE], [7, 11, F.PLATE]];
  assert.ok(!fails(b({ level: 5, tiles: ok }), P[2], "V26"));
  assert.ok(fails(b({ level: 5, tiles: ok.slice(0, 2) }), P[2], "V26"), "two");
  assert.ok(fails(b({ level: 5, tiles: [...ok, [9, 7, F.PLATE]] }), P[2], "V26"), "neighbouring crossings");
  assert.ok(fails(b({ level: 5, tiles: [...ok, [3, 3, F.PLATE]], open: [[3, 3]] }), P[2], "V26"), "4 steps out");
  assert.ok(fails(b({ level: 5, tiles: ok, foes: [{ type: "walker", tx: 8, ty: 7 }] }), P[2], "V26"), "foe beside it");
  assert.ok(fails(b({ level: 5, tiles: ok, bricks: [[11, 7]] }), P[2], "V26"), "under a brick");
});
test("V27 TRAP side exit within 1 tile on every arm tile out to r 3", () => {
  assert.ok(!fails(b({ level: 5, tiles: [[9, 9, F.PLATE]] }), P[2], "V27"));
  const g = blank(); for (let y = 3; y <= 9; y++) g[key(2, y)] = T.EMPTY;
  assert.ok(fails(b({ level: 5, g, tiles: [[2, 6, F.PLATE]] }), P[2], "V27"));
});
test("featChecks is pure, ordered, and quiet on tile-free rooms", () => {
  const src = readFileSync(new URL("../tools/balance/featchecks.mjs", import.meta.url), "utf8");
  assert.ok(!/Math\.random\(|Date\.now\(|new Date\(|document\.|window\./.test(src));
  const r = featChecks(b({ tiles: E([10, 11, 12, 13], 5, F.BELT_E), items: [{ tx: 10, ty: 5 }] }), P[1]);
  assert.deepEqual(ids(r), FEAT_RULES.filter((id) => ids(r).includes(id)));
  const w = createWorld(77, 3); w.gen = 2; loadLevel(w, 3, false);
  assert.deepEqual(ids(featChecks(w, P[1])).filter((id) => id !== "V18"), []);
});
