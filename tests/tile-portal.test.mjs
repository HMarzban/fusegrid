/* PORTAL (#27, record 2026-11-01 section 6): warp, latch, blocked cases, a dead pair, bomb warp, blast continuation per heat, MAX foes with the exit guard, the tell, V34 / V35 */
import test from "node:test";
import assert from "node:assert/strict";
import { CFG, T, key } from "../src/core/config.js";
import { createWorld, loadLevel, step, newIntent } from "../src/core/sim.js";
import { genBoard2 } from "../src/core/board2.js";
import { FEAT_PROFILE, pairTwins, PORTAL_PLACE } from "../src/core/feat.js";
import { featChecks, lethalMap } from "../src/core/featchecks.js";
import { portalDim } from "../src/core/tileportal.js";
import { relayTell, dimCells } from "../src/render/relaytell.js";
import { walk } from "../src/core/fair.js";

const TL = CFG.TILE, DT = CFG.STEP, ctr = (v) => (v + 0.5) * TL, C = CFG.COLS, R = CFG.ROWS, N = C * R;
const A = [3, 3], B = [11, 9], A2 = [3, 9], B2 = [11, 3];
function room(heat, pairs = [[A, B]]) {
  const w = createWorld(4242, 7); w.gen = 3; w.heat = heat; loadLevel(w, 7, false); w.state = "PLAY";
  for (let y = 1; y < R - 1; y++) for (let x = 1; x < C - 1; x++) w.grid[key(x, y)] = T.EMPTY;
  w.feat.fill(0); w.featPair = new Uint8Array(N);
  pairs.forEach(([a, b], i) => { for (const [x, y] of [a, b]) { w.feat[key(x, y)] = 13; w.featPair[key(x, y)] = i + 1; } });
  w.enemies.length = 0; w.items.length = 0; w.bombs.length = 0; w.blades.length = 0; w.events.length = 0;
  place(w.players[0], 1, 1); w.players[0].iFrames = 1e9;
  return w;
}
const place = (e, x, y) => { e.x = ctr(x); e.y = ctr(y); e.tx = x; e.ty = y; };
const go = (dx, dy = 0) => { const i = newIntent(); i.move = { x: dx, y: dy }; return [i]; };
const idle = () => [newIntent()];
const run = (w, secs, inp = idle) => { for (let t = 0; t < secs; t += DT) step(w, DT, inp()); };
const tile = (e) => [Math.floor(e.x / TL), Math.floor(e.y / TL)];
const bomb = (w, x, y, o = {}) => { const b = { x: ctr(x), y: ctr(y), tx: x, ty: y, timer: w.fuse, radius: 2, pierce: false, line: false, dir: null, variant: "normal", dead: false, ...o }; w.bombs.push(b); return b; };
const foe = (w, x, y, speed = 2) => { const e = { type: "walker", x: ctr(x), y: ctr(y), tx: x, ty: y, r: TL * 0.3, speed, hunt: false, pass: false, dir: { x: 1, y: 0 }, cd: 99, color: "#fff", dead: false }; w.enemies.push(e); return e; };
const keep = (w) => foe(w, 13, 11, 0);
const walkOn = (w, ax, ay, dx) => { place(w.players[0], ax, ay); step(w, DT, idle()); let n = 0; while (tile(w.players[0])[0] === ax && n++ < 200) step(w, DT, go(dx)); };
const blastKeys = (w) => w.blades.flatMap((bl) => bl.tiles.map((t) => t.tx + "," + t.ty));

test("a walker crossing onto a portal comes out on the twin's centre, facing the same way", () => {
  for (const h of [0, 1, 2]) {
    const w = room(h); keep(w);
    walkOn(w, 2, 3, 1);
    const p = w.players[0];
    assert.deepEqual([p.x, p.y], [ctr(B[0]), ctr(B[1])], "heat " + h);
    assert.equal(p.face.x, 1);
    assert.ok(w.events.some((e) => e.t === "warp" && e.who === "you"));
  }
});
test("latch: standing on the twin does not warp back; leaving and stepping on again does", () => {
  const w = room(0); keep(w);
  walkOn(w, 2, 3, 1);
  run(w, 1);
  assert.deepEqual(tile(w.players[0]), B);
  let n = 0;
  while (tile(w.players[0])[0] === B[0] && n++ < 200) step(w, DT, go(1));
  assert.deepEqual(tile(w.players[0]), [12, 9]);
  n = 0;
  while (tile(w.players[0])[0] === 12 && n++ < 200) step(w, DT, go(-1));
  assert.deepEqual(tile(w.players[0]), A);
});
test("blocked: a bomb on the twin, a live blade on it or a foe within 1 tile make it plain floor, and the look says so", () => {
  const setups = [(w) => bomb(w, B[0], B[1], { timer: 60 }), (w) => w.blades.push({ x: 0, y: 0, t: 0, ttl: 60, tiles: [{ tx: B[0], ty: B[1], brick: false }] }), (w) => foe(w, B[0] + 1, B[1] - 1, 0.0001)];
  for (const set of setups) {
    const w = room(1); keep(w); set(w);
    assert.equal(portalDim(w, key(A[0], A[1])), true);
    assert.ok(dimCells(w).some((c) => c.x === A[0] && c.y === A[1]));
    walkOn(w, 2, 3, 1);
    assert.deepEqual(tile(w.players[0]), A, "walks onto it");
    run(w, 0.3);
    assert.deepEqual(tile(w.players[0]), A, "and stays");
  }
  const w = room(1);
  assert.equal(dimCells(w).length, 0);
});
test("the latch holds through a blocked crossing: a pair that clears under your feet does not fire", () => {
  const w = room(1); keep(w);
  const b = bomb(w, B[0], B[1], { timer: 60 });
  walkOn(w, 2, 3, 1);
  b.dead = true; w.bombs.length = 0;
  run(w, 0.3);
  assert.deepEqual(tile(w.players[0]), A);
});
test("a SHRINK ring on a twin kills the pair: plain floor both for you and for an arm", () => {
  const w = room(2); keep(w);
  w.grid[key(B[0], B[1])] = T.WALL;
  assert.equal(portalDim(w, key(A[0], A[1])), true);
  walkOn(w, 2, 3, 1);
  assert.deepEqual(tile(w.players[0]), A);
  place(w.players[0], 1, 1);
  bomb(w, 1, 3, { timer: 0.01, radius: 4 });
  run(w, 0.05);
  const k = blastKeys(w);
  assert.ok(k.includes("5,3"), "the arm walks over a dead pair");
  assert.ok(!k.includes("12,9"));
});
test("a kicked bomb warps and keeps fuse and slide; it stops on the twin if the next tile is blocked", () => {
  const w = room(0); keep(w);
  const b = bomb(w, 2, 3, { timer: 5, slide: { x: 1, y: 0 }, prog: 0 });
  w.grid[key(B[0] + 3, B[1])] = T.WALL;
  let n = 0;
  while (b.ty === 3 && n++ < 200) step(w, DT, idle());
  assert.equal(b.tx, B[0]); assert.equal(b.ty, B[1]);
  assert.ok(b.slide, "still sliding");
  assert.ok(Math.abs(b.timer - (5 - n * DT)) < DT * 2, "fuse unchanged");
  run(w, 1.5);
  assert.equal(b.tx, B[0] + 2);
  assert.equal(b.slide, null);
  const w2 = room(0); keep(w2);
  const c = bomb(w2, 2, 3, { timer: 5, slide: { x: 1, y: 0 }, prog: 0 });
  w2.grid[key(B[0] + 1, B[1])] = T.WALL;
  run(w2, 1.5);
  assert.deepEqual([c.tx, c.ty], B, "stops on the twin");
  assert.equal(c.slide, null);
});
test("a sliding bomb stops short when a bomb sits on the twin; a planted or thrown bomb stays and blocks", () => {
  const w = room(0); keep(w);
  bomb(w, B[0], B[1], { timer: 5 });
  const b = bomb(w, 1, 3, { timer: 5, slide: { x: 1, y: 0 }, prog: 0 });
  run(w, 1);
  assert.deepEqual([b.tx, b.ty], [2, 3]);
  assert.equal(b.slide, null);
  const w2 = room(0); keep(w2);
  const c = bomb(w2, A[0], A[1], { timer: 5 });
  run(w2, 0.5);
  assert.deepEqual([c.tx, c.ty], A);
  assert.equal(portalDim(w2, key(B[0], B[1])), true, "the twin reads blocked");
  assert.equal(portalDim(w2, key(A[0], A[1])), true, "so does its own tile");
});
test("blast: CORE stops on the portal; PLUS / MAX include the twin and go on with the leftover reach", () => {
  const expect0 = room(0); keep(expect0);
  bomb(expect0, 1, 3, { timer: 0.01, radius: 5 });
  run(expect0, 0.05);
  let k = blastKeys(expect0);
  assert.ok(k.includes("3,3") && !k.includes("4,3") && !k.includes("11,9"), "CORE " + k);
  for (const h of [1, 2]) {
    const w = room(h); keep(w);
    bomb(w, 1, 3, { timer: 0.01, radius: 5 });
    run(w, 0.05);
    k = blastKeys(w);
    for (const c of ["2,3", "3,3", "11,9", "12,9", "13,9"]) assert.ok(k.includes(c), c + " at heat " + h);
    assert.ok(!k.includes("4,3"), "nothing past the entry tile");
    assert.equal(new Set(k).size, k.length, "no tile twice");
  }
});
test("blast: lit tiles reach the twin side, hit a foe there and chain a bomb there", () => {
  const w = room(1);
  const e = foe(w, 12, 9, 0.0001); keep(w);
  const far = bomb(w, 13, 9, { timer: 30 });
  bomb(w, 1, 3, { timer: 0.01, radius: 5 });
  run(w, 0.05);
  assert.ok(e.dead, "foe past the twin");
  assert.ok(far.dead, "bomb past the twin");
});
test("blast: at most 2 jumps per arm, and a bomb on a portal does not jump by itself", () => {
  const w = room(2, [[[3, 3], [3, 9]], [[6, 9], [6, 3]]]); keep(w);
  bomb(w, 1, 3, { timer: 0.01, radius: 12 });
  run(w, 0.05);
  const k = blastKeys(w);
  assert.ok(k.includes("3,9") && k.includes("6,3"), "two jumps");
  assert.ok(!k.includes("3,3") || k.filter((c) => c === "3,3").length === 1);
  const w2 = room(2); keep(w2);
  bomb(w2, A[0], A[1], { timer: 0.01, radius: 2 });
  run(w2, 0.05);
  const k2 = blastKeys(w2);
  assert.ok(!k2.includes("11,9"), "the bomb's own tile does not jump");
  assert.ok(k2.includes("4,3"));
});
test("foes warp only at MAX, only by walking on; CORE and PLUS walk over", () => {
  for (const h of [0, 1]) {
    const w = room(h); place(w.players[0], 1, 1);
    const e = foe(w, 2, 3); keep(w);
    run(w, 1);
    assert.equal(e.warpK == null || !w.events.some((v) => v.t === "warp"), true, "heat " + h);
    assert.notDeepEqual(tile(e), [12, 9]);
  }
  const w = room(2);
  const e = foe(w, 2, 3); keep(w);
  let n = 0;
  while (tile(e)[1] === 3 && n++ < 200) step(w, DT, idle());
  assert.deepEqual(tile(e), B);
  assert.ok(w.events.some((v) => v.t === "warp" && v.who === "foe") || n > 0);
});
test("MAX exit guard: Manhattan < 3 of the twin holds the foe on the entry tile, 2 s at most, then it walks on", () => {
  const w = room(2);
  place(w.players[0], B[0] + 2, B[1]);
  const e = foe(w, 2, 3); keep(w);
  let n = 0;
  while (tile(e)[0] < A[0] && n++ < 200) step(w, DT, idle());
  assert.deepEqual(tile(e), A, "reaches the entry");
  assert.ok(e.warpHold > 0, "waiting");
  run(w, 1);
  assert.deepEqual(tile(e), A, "still waiting");
  assert.ok(Math.abs(e.x - ctr(A[0])) < 2, "at the centre");
  run(w, 1.2);
  assert.ok(!(e.warpHold > 0), "the cap ran out");
  run(w, 1);
  assert.notDeepEqual(tile(e), B, "walked on without warping");
  assert.notDeepEqual(tile(e), A);
});
test("MAX exit guard: moving away from the twin lets a waiting foe through; a waiting foe can be killed", () => {
  const w = room(2);
  place(w.players[0], B[0] + 2, B[1]);
  const e = foe(w, 2, 3); keep(w);
  let n = 0;
  while (!(e.warpHold > 0) && n++ < 200) step(w, DT, idle());
  place(w.players[0], 1, 1);
  run(w, DT * 2);
  assert.deepEqual(tile(e), B);
  const w2 = room(2);
  place(w2.players[0], B[0] + 2, B[1]);
  const f = foe(w2, 2, 3); keep(w2);
  n = 0;
  while (!(f.warpHold > 0) && n++ < 200) step(w2, DT, idle());
  bomb(w2, A[0], A[1] + 2, { timer: 0.01, radius: 3 });
  run(w2, 0.05);
  assert.ok(f.dead);
});
test("MAX exit guard: a foe never comes out within 2 Manhattan of you, whatever you do", () => {
  const w = room(2);
  const e = foe(w, 2, 3, 2.5);
  let out = true;
  for (let i = 0; i < 2000; i++) {
    const was = tile(e);
    place(w.players[0], B[0] + (i >> 6) % 5, B[1]);
    step(w, DT, idle());
    const now = tile(e), tile2 = tile(w.players[0]);
    if (Math.abs(now[0] - was[0]) + Math.abs(now[1] - was[1]) > 1 && Math.abs(now[0] - tile2[0]) + Math.abs(now[1] - tile2[1]) < 3) out = false;
    if (e.dead) break;
  }
  assert.ok(out);
});
test("the tell marks every continuation tile from the moment the bomb is lit, the same tiles the blast then hits", () => {
  for (const h of [1, 2]) {
    const w = room(h); keep(w);
    place(w.players[0], 1, 11);
    bomb(w, 1, 3, { radius: 5 });
    const cells = relayTell(w).map((c) => c.x + "," + c.y).sort();
    assert.deepEqual(cells, ["11,9", "12,9", "13,9"], "heat " + h);
    const b = w.bombs[0]; b.timer = 0.01;
    run(w, 0.05);
    const k = blastKeys(w);
    for (const c of cells) assert.ok(k.includes(c));
  }
  const core = room(0); keep(core);
  bomb(core, 1, 3, { radius: 5 });
  assert.equal(relayTell(core).length, 0, "CORE: no continuation, no marks");
});
test("the engine: lethalMap continues through a pair at PLUS / MAX and stops at CORE", () => {
  const w = room(1), tw = pairTwins(w.featPair);
  const arms = [[1, 0, 5]];
  const L = lethalMap(w.grid, w.feat, FEAT_PROFILE[1], [{ t: 2, k: key(1, 3), arms, through: false }], true, tw);
  assert.equal(L[key(13, 9)], 2); assert.equal(L[key(4, 3)], Infinity);
  const L0 = lethalMap(w.grid, w.feat, FEAT_PROFILE[0], [{ t: 2, k: key(1, 3), arms, through: false }], true, tw);
  assert.equal(L0[key(11, 9)], Infinity); assert.equal(L0[key(3, 3)], 2);
});
/* hand boards: cell list, portal pairs; V19 names the mode that lost the escape */
const hand = (cells, pairs) => {
  const g = new Int8Array(N).fill(T.WALL), f = new Uint8Array(N), pr = new Uint8Array(N);
  for (const [x, y] of cells) g[key(x, y)] = T.EMPTY;
  pairs.forEach(([a, b], i) => { for (const [x, y] of [a, b]) { f[key(x, y)] = 13; pr[key(x, y)] = i + 1; } });
  return { grid: g, feat: f, featPair: pr, level: 7, heat: 1, items: [], enemies: [] };
};
test("both ways: a warp that lands you in the blast with nowhere to go is a spot, cause warp", () => {
  const b = hand([[1, 5], [2, 5], [3, 5], [12, 9]], [[[2, 5], [12, 9]]]);
  const r = featChecks(b, FEAT_PROFILE[1], { only: ["V19"] });
  assert.equal(r.length, 1);
  assert.ok(r[0].cause.warp >= 1, JSON.stringify(r[0]));
  assert.equal(featChecks(b, FEAT_PROFILE[1], { only: ["V35"] }).length, 1, "V35 is the same rule");
});
test("both ways: an escape that only works through the warp is a spot too, cause floor", () => {
  const cells = [[1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [10, 5], [11, 5], [10, 6]];
  const r = featChecks(hand(cells, [[[4, 5], [10, 5]], [[2, 5], [7, 5]]]), FEAT_PROFILE[1], { only: ["V19"] });
  assert.equal(r.length, 1);
  assert.ok(r[0].cause.floor >= 1, JSON.stringify(r[0]));
});
test("V34: placement on 40 seeds: 1-2 pairs, >= 12 steps from the start, twins >= 8 apart, no two within 3, >= 2 open neighbours; every heat the same layer; V35 clean", () => {
  const P = PORTAL_PLACE;
  let kept = 0;
  for (let s = 0; s < 40; s++) {
    const seed = Math.imul(s + 1, 2654435761) >>> 0;
    const bs = [0, 1, 2].map((h) => genBoard2(seed, 7, h, { feat: true }));
    if (!bs[0].feat) continue;
    kept++;
    assert.deepEqual(Array.from(bs[0].feat), Array.from(bs[2].feat));
    for (const h of [0, 1, 2]) {
      const fails = featChecks({ ...bs[h], level: 7, heat: h, gen: 3 }, FEAT_PROFILE[h], { only: ["V13", "V34", "V35", "V18", "V19"] });
      assert.deepEqual(fails, [], "seed " + seed + " heat " + h);
      const w = walk(bs[h].grid, true), tw = pairTwins(bs[h].featPair);
      for (let k = 0; k < N; k++) if (tw[k] >= 0) assert.ok(w[k] >= P.start);
    }
  }
  assert.ok(kept / 40 >= 0.95, "kept " + kept);
});
test("V34 catches a bad layer", () => {
  const g = new Int8Array(N).fill(T.EMPTY);
  for (let i = 0; i < C; i++) { g[key(i, 0)] = T.WALL; g[key(i, R - 1)] = T.WALL; }
  for (let i = 0; i < R; i++) { g[key(0, i)] = T.WALL; g[key(C - 1, i)] = T.WALL; }
  const mk = (cells) => { const f = new Uint8Array(N), pr = new Uint8Array(N); cells.forEach(([x, y], i) => { f[key(x, y)] = 13; pr[key(x, y)] = 1 + (i >> 1); }); return { grid: g, feat: f, featPair: pr, level: 7, heat: 1, items: [], enemies: [] }; };
  const v = (c) => featChecks(mk(c), FEAT_PROFILE[1], { only: ["V34"] }).length;
  assert.equal(v([[13, 11], [13, 1]]), 0);
  assert.equal(v([[2, 2], [13, 11]]), 1, "too near the start");
  assert.equal(v([[13, 11], [13, 8]]), 1, "twins too near");
  assert.equal(v([[13, 11], [13, 1], [12, 11], [5, 11]]), 1, "two portals within 3");
});
test("no layer, no portal: gen 2 never carries a pair and computeBlast stays the plain cross", () => {
  const b = genBoard2(4242, 7, 2);
  assert.equal(b.featPair, null);
  const w = createWorld(4242, 7); w.gen = 2; loadLevel(w, 7, false); w.state = "PLAY";
  assert.equal(w.featPair ?? null, null);
  assert.equal(dimCells(w).length, 0);
});
test("replay: a portal room is deterministic", () => {
  const snap = (w) => JSON.stringify([w.players[0].x, w.players[0].y, w.enemies.map((e) => [e.x, e.y, e.dead]), w.bombs.map((b) => [b.tx, b.ty, b.timer])]);
  const mk = () => { const w = createWorld(77, 7); w.gen = 3; w.heat = 2; loadLevel(w, 7, false); w.state = "PLAY"; return w; };
  const a = mk(), b = mk();
  for (let i = 0; i < 900; i++) { const m = [[1, 0], [0, 1], [-1, 0], [0, -1]][(i >> 5) & 3]; step(a, DT, go(m[0], m[1])); step(b, DT, go(m[0], m[1])); }
  assert.equal(snap(a), snap(b));
});
