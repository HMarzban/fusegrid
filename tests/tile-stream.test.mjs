/* STREAM (#26, design 2026-11-01 section 3): water floats resting bombs tile by tile
   and slows walkers; nobody rides. Placement V28, fairness V29, SHRINK V20. */
import test from "node:test";
import assert from "node:assert/strict";
import { CFG, T, key } from "../src/core/config.js";
import { createWorld, loadLevel, step } from "../src/core/sim.js";
import { genBoard2 } from "../src/core/board2.js";
import { F, FEAT_PROFILE, isStream, flowDir, placeFeat } from "../src/core/feat.js";
import { featChecks } from "../src/core/featchecks.js";
import { stampStart, walk } from "../src/core/fair.js";
import { paceMul } from "../src/core/pace.js";
import { streamSpeed } from "../src/core/tilestream.js";
import { featSpeed } from "../src/core/tiles2.js";
import { layout2 } from "../src/core/board2.js";

const C = CFG.COLS, R = CFG.ROWS, N = C * R, TL = CFG.TILE, DT = CFG.STEP;
const IDLE = { 0: { move: { x: 0, y: 0 }, fire: false, firePrev: false, shift: false, remote: false, kick: false } };
const P = FEAT_PROFILE;
const ids = (r) => r.map((f) => f.id);

/* an empty room with one east-flowing run on row 3, x 3..6, the player parked far off */
function room(heat, pace = 0, run = [3, 6], y = 3, code = F.STREAM_E) {
  const w = createWorld(7, 4);
  w.heat = heat; w.pace = pace; w.pact = 0;
  loadLevel(w, 4, false);
  w.enemies = w.enemies.slice(0, 1); w.items = []; w.bombs = []; w.blades = [];
  const e = w.enemies[0]; e.x = 13.5 * TL; e.y = 11.5 * TL; e.tx = 13; e.ty = 11; e.speed = 0;
  for (let k = 0; k < N; k++) { const x = k % C, yy = (k / C) | 0; w.grid[k] = x === 0 || yy === 0 || x === C - 1 || yy === R - 1 ? T.WALL : T.EMPTY; }
  w.feat = new Uint8Array(N); w.featS = new Float32Array(N); w.featM = new Uint8Array(N); w.featT = 0; w.featPend = [];
  for (let x = run[0]; x <= run[1]; x++) w.feat[key(x, y)] = code;
  const p = w.players[0]; p.x = 1.5 * TL; p.y = 11.5 * TL; p.tx = 1; p.ty = 11; p.iFrames = 999;
  w.state = "PLAY";
  return w;
}
const bomb = (w, tx, ty, timer = 99) => { const b = { x: (tx + 0.5) * TL, y: (ty + 0.5) * TL, tx, ty, timer, radius: 1, pierce: false, line: false, dir: null, variant: "normal", dead: false }; w.bombs.push(b); return b; };
const run = (w, s) => { for (let i = 0; i < Math.round(s / DT); i++) { step(w, DT, IDLE); w.events.length = 0; } };

test("float: a resting bomb moves at v x pace down the run and stops on the first tile past it", () => {
  for (const h of [0, 1, 2]) for (const pace of [-1, 0, 1]) {
    const w = room(h, pace), b = bomb(w, 3, 3), v = P[h].stream.v * paceMul(pace);
    run(w, 0.5 / v);
    assert.equal(b.tx, 3, "half a tile in, still on its tile");
    assert.ok(b.x > 3.5 * TL && b.x < 4.5 * TL, "drawn between tiles");
    run(w, 0.6 / v);
    assert.equal(b.tx, 4, "one tile after 1 / v");
    run(w, 10 / v);
    assert.deepEqual([b.tx, b.ty], [7, 3], `h${h} pace${pace} past the run`);
    assert.equal(b.slide, null); assert.equal(b.carry, false);
    assert.equal(b.x, 7.5 * TL, "snapped to the centre");
    assert.equal(b.rode, true);
  }
});
test("float: every direction follows its code", () => {
  for (const [code, dx, dy] of [[F.STREAM_E, 1, 0], [F.STREAM_S, 0, 1], [F.STREAM_W, -1, 0], [F.STREAM_N, 0, -1]]) {
    assert.deepEqual(flowDir(code), [dx, dy]);
    const w = room(1); w.feat.fill(0);
    w.feat[key(7, 6)] = code; w.feat[key(7 + dx, 6 + dy)] = code;
    const b = bomb(w, 7, 6);
    run(w, 4);
    assert.deepEqual([b.tx, b.ty], [7 + 2 * dx, 6 + 2 * dy]);
  }
});
test("float: a WALL, a BRICK or another bomb stops it; a walker does not; fuse unchanged", () => {
  for (const [what, set, end] of [["wall", (w) => (w.grid[key(5, 3)] = T.WALL), 4], ["brick", (w) => (w.grid[key(5, 3)] = T.BRICK), 4], ["bomb", (w) => bomb(w, 7, 3), 6]]) {
    const w = room(2), b = bomb(w, 3, 3);
    set(w);
    run(w, 5);
    assert.deepEqual([b.tx, b.ty], [end, 3], what);
    assert.equal(b.x, (end + 0.5) * TL, what + " rests on the centre");
  }
  const w = room(2), b = bomb(w, 3, 3), p = w.players[0];
  p.x = 4.5 * TL; p.y = 3.5 * TL; p.iFrames = 99;
  const e = w.enemies[0]; e.x = 5.5 * TL; e.y = 3.5 * TL; e.tx = 5; e.ty = 3;
  run(w, 6);
  assert.equal(b.tx, 7, "floats under the player and a foe");
  const w2 = room(1), b2 = bomb(w2, 3, 3, 1.7);
  run(w2, 1.6);
  assert.ok(Math.abs(b2.timer - 0.1) < 0.02, "the fuse runs on its own clock");
});
test("float: plain floor never moves a bomb, and a kicked bomb is only carried once it rests", () => {
  const w = room(2), b = bomb(w, 9, 9);
  run(w, 3);
  assert.deepEqual([b.tx, b.ty, b.x], [9, 9, 9.5 * TL]);
  const w2 = room(1), k = bomb(w2, 3, 3);
  k.slide = { x: 0, y: 1 }; k.prog = 0;
  step(w2, DT, IDLE);
  assert.equal(k.ty, 3); assert.ok(!k.carry, "a kick slide is not a float");
});
test("wade: the tile under the centre scales you and foes at each heat, only in water", () => {
  for (const h of [0, 1, 2]) {
    const w = room(h);
    assert.equal(streamSpeed(w, 4.5 * TL, 3.5 * TL), P[h].stream.wade);
    assert.equal(featSpeed(w, 4.5 * TL, 3.5 * TL, false), P[h].stream.wade);
    assert.equal(featSpeed(w, 4.5 * TL, 3.5 * TL, true), P[h].stream.wade);
    assert.equal(streamSpeed(w, 2.5 * TL, 3.5 * TL), 1);
    const p = w.players[0];
    p.x = 3.5 * TL; p.y = 3.5 * TL;
    const x0 = p.x, mv = { 0: { ...IDLE[0], move: { x: 1, y: 0 } } };
    step(w, DT, mv);
    assert.ok(Math.abs(p.x - x0 - p.speed * TL * DT * P[h].stream.wade) < 1e-6, "h" + h);
  }
  const w = room(2); w.grid[key(4, 3)] = T.WALL;
  assert.equal(streamSpeed(w, 4.5 * TL, 3.5 * TL), 1, "a ring wall on water is no water");
  const off = createWorld(7, 4);
  assert.equal(featSpeed(off, 50, 50, false), 1, "no layer, no scale");
});
test("the player always outruns a float: worst wade at EASY against the fastest float at HARD", () => {
  const vp = CFG.PLAYER_START.speed * paceMul(-1) * P[2].stream.wade, vb = P[2].stream.v * paceMul(1);
  assert.ok(vp > vb, vp + " > " + vb);
  assert.ok(P[0].stream.v < P[1].stream.v && P[1].stream.v < P[2].stream.v);
  assert.ok(P[0].stream.wade > P[1].stream.wade && P[1].stream.wade > P[2].stream.wade);
});
function runsOf(f) {
  const out = [];
  for (let k = 0; k < N; k++) {
    if (!isStream(f[k])) continue;
    const [dx, dy] = flowDir(f[k]), x = k % C, y = (k / C) | 0;
    if (f[key(x - dx, y - dy)] === f[k]) continue;
    const cells = [];
    let a = x, b = y;
    while (f[key(a, b)] === f[k]) { cells.push(key(a, b)); a += dx; b += dy; }
    out.push({ cells, past: key(a, b) });
  }
  return out;
}
test("V28 placement over 200 seeds: 2 runs of 4-6, 12 at most, apart, far, off the doors, away from the start; same at every heat", () => {
  let kept = 0;
  for (let s = 0; s < 200; s++) {
    const seed = 41000 + s, B = [0, 1, 2].map((h) => genBoard2(seed, 4, h, { feat: true }));
    if (!B[0].feat) { assert.ok(!B[1].feat && !B[2].feat, "a drop is at every heat"); continue; }
    kept++;
    assert.equal(Buffer.from(B[0].feat).toString("hex"), Buffer.from(B[1].feat).toString("hex"));
    assert.equal(Buffer.from(B[1].feat).toString("hex"), Buffer.from(B[2].feat).toString("hex"));
    const f = B[0].feat, g = B[0].grid, rs = runsOf(f), w = walk(g, true);
    assert.equal(rs.length, 2, "seed " + seed);
    assert.ok(rs[0].cells.length + rs[1].cells.length <= 12);
    for (const r of rs) {
      assert.ok(r.cells.length >= 4 && r.cells.length <= 6);
      for (const k of r.cells) {
        assert.equal(g[k], T.EMPTY); assert.ok(w[k] > 4);
        assert.ok(k !== key(5, 1) && k !== key(1, 5));
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const m = key((k % C) + dx, ((k / C) | 0) + dy); if (isStream(f[m])) assert.ok(r.cells.includes(m), "runs touch"); }
      }
      assert.notEqual(g[r.past], T.WALL);
      assert.ok(w[r.past] >= w[r.cells[0]], "carries toward the start");
    }
  }
  assert.ok(kept >= 190, "drops " + (200 - kept));
});
test("V13-V29 are clean on real boards at their own heat (60 seeds), V23 aside", () => {
  for (let s = 0; s < 60; s++) for (let h = 0; h < 3; h++) {
    const w = createWorld(52000 + s, 4); w.gen = 3; w.heat = h; loadLevel(w, 4, false);
    if (!w.feat) continue;
    assert.deepEqual(ids(featChecks(w, P[h])), [], `seed ${s} h${h}`);
    for (const e of w.enemies) assert.equal(w.feat[key(e.tx, e.ty)], 0);
    for (const it of w.items) assert.equal(w.feat[key(Math.floor(it.x / TL), Math.floor(it.y / TL))], 0);
  }
});
function fixture(cells, past, o = {}) {
  const g = o.g || stampStart(new Int8Array(N).map((_, k) => { const x = k % C, y = (k / C) | 0; return x === 0 || y === 0 || x === C - 1 || y === R - 1 || (x % 2 === 0 && y % 2 === 0) ? T.WALL : T.EMPTY; }));
  const feat = new Uint8Array(N);
  for (const [x, y, v] of cells) { feat[key(x, y)] = v; g[key(x, y)] = T.EMPTY; }
  return { grid: g, feat, level: 4, heat: o.heat ?? 2, items: [], enemies: [], gen: 3 };
}
const lane = (y, a, b, v) => { const o = []; for (let x = a; x <= b; x++) o.push([x, y, v]); return o; };
test("V28 fails on each broken placement", () => {
  const good = [...lane(5, 3, 7, F.STREAM_E), ...lane(9, 3, 7, F.STREAM_E)];
  const why = (cells) => (featChecks(fixture(cells), P[2], { only: ["V28"] })[0] || {}).why || "";
  assert.equal(why(good), "");
  assert.match(why(lane(5, 3, 7, F.STREAM_E)), /1 runs/);
  assert.match(why([...lane(5, 3, 5, F.STREAM_E), ...lane(9, 3, 7, F.STREAM_E)]), /run of 3/);
  assert.match(why([...lane(5, 3, 9, F.STREAM_E), ...lane(9, 3, 7, F.STREAM_E)]), /run of 7/);
  assert.match(why([...lane(5, 3, 8, F.STREAM_E), [9, 2, F.STREAM_S], [9, 3, F.STREAM_S], [9, 4, F.STREAM_S], [9, 5, F.STREAM_S]]), /touch/);
  assert.match(why([...lane(5, 9, 13, F.STREAM_E), ...lane(9, 3, 7, F.STREAM_E)]), /WALL/);
  assert.match(why([...lane(5, 3, 7, F.STREAM_W), ...lane(9, 3, 7, F.STREAM_E)]), /toward the start/);
});
test("V19 engine: the wade and the float each cost an escape the plain board has", () => {
  const g = new Int8Array(N).fill(T.WALL);
  for (let x = 3; x <= 13; x++) g[key(x, 7)] = T.EMPTY;
  g[key(1, 1)] = T.EMPTY;
  const wet = () => fixture(lane(7, 3, 8, F.STREAM_E), 0, { g: g.slice() });
  const spot = (st) => featChecks(wet(), { ...P[2], stream: st }, { only: ["V19"] });
  assert.deepEqual(featChecks({ ...wet(), feat: new Uint8Array(N) }, P[2], { only: ["V19"] }), [], "no water, no spot");
  assert.deepEqual(spot({ v: 0, wade: 1 }), [], "still water at full speed changes nothing");
  const fl = spot({ v: 1.2, wade: 1 });
  assert.equal(fl.length, 1, "a bomb floating after you down a dead-end lane");
  assert.ok(fl[0].cause["bomb-ride"] > 0);
  const wd = spot({ v: 0, wade: 0.05 });
  assert.equal(wd.length, 1, "a crawl through water loses the deadline");
  assert.ok(wd[0].cause.wade > 0);
});
test("the gate's mask gives the same layer proof as a full scan: every kept board passes V19 with no mask", () => {
  for (let s = 0; s < 40; s++) for (let h = 0; h < 3; h++) {
    const b = genBoard2(60000 + s, 4, h, { feat: true });
    if (!b.feat) continue;
    assert.deepEqual(ids(featChecks({ grid: b.grid, feat: b.feat, level: 4, heat: h, items: [], enemies: [] }, P[h], { only: ["V18", "V19", "V29"] })), [], `seed ${s} h${h}`);
  }
});
test("V20 SHRINK: a run cut by a ring floats to the wall and stops; a ring tile is no water", () => {
  const w = room(2, 0, [3, 8]), b = bomb(w, 3, 3);
  for (let x = 6; x <= 8; x++) w.grid[key(x, 3)] = T.WALL;
  run(w, 6);
  assert.deepEqual([b.tx, b.ty], [5, 3]);
  assert.equal(b.x, 5.5 * TL);
  /* a run whose only way in dies with ring 2 */
  const g = new Int8Array(N).fill(T.WALL);
  for (let x = 1; x <= 4; x++) g[key(x, 1)] = T.EMPTY;
  g[key(4, 2)] = T.EMPTY;
  const sealed = featChecks(fixture(lane(3, 4, 7, F.STREAM_E), 0, { g }), P[2], { only: ["V20"] });
  assert.match(sealed[0].why, /ring 2: water sealed/);
  for (let s = 0; s < 40; s++) {
    const w2 = createWorld(70000 + s, 4); w2.gen = 3; w2.heat = 2; loadLevel(w2, 4, false);
    if (w2.feat) assert.deepEqual(ids(featChecks(w2, P[2], { only: ["V20"] })), []);
  }
});
test("gen 1 and gen 2 room 4 carry no layer and no water rule", () => {
  for (const gen of [1, 2]) { const w = createWorld(55, 4); w.gen = gen; loadLevel(w, 4, false); assert.equal(w.feat ?? null, null); }
  assert.equal(genBoard2(55, 4, 0).feat, null);
  const lay = layout2(55, 4, 0);
  assert.equal(placeFeat(lay.m, 55, 4, "WATER", 0).kind, "STREAM");
});
test("determinism: one seed and intent stream replays to the same room", () => {
  const go = () => { const w = createWorld(4242, 4); w.gen = 3; w.heat = 2; loadLevel(w, 4, false); w.state = "PLAY"; const b = (w.feat ? bomb(w, ...(() => { const k = w.feat.findIndex(isStream); return [k % C, (k / C) | 0]; })()) : null); for (let i = 0; i < 180; i++) { step(w, DT, IDLE); w.events.length = 0; } return JSON.stringify([b && [b.tx, b.ty, b.x, b.y], w.players[0].x, w.enemies.map((e) => [e.x, e.y])]); };
  assert.equal(go(), go());
});
