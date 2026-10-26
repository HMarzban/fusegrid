/* CONVEYOR design pass 2 (#28, reference rules for #19): the forgiving
   step-off (snap: no push while you hold toward an open side cell), the ride to the chain's end (endHalt), a chain into a wall
   carries no one (wallStop), bombs ride under walkers (thru), PLUS carries
   no foe, and the static model's known fuse cell equals the sim's. Built on
   a real gen-3 world with a hand-made corridor. */
import test from "node:test";
import assert from "node:assert/strict";
import { CFG, T, key } from "../src/core/config.js";
import { tileOf } from "../src/core/board.js";
import { createWorld, loadLevel, step } from "../src/core/sim.js";
import { F, FEAT_PROFILE } from "../src/core/feat.js";
import { spawnEnemy } from "../src/core/entities.js";
import { PACE_MUL } from "../src/core/pace.js";

const C = CFG.COLS, R = CFG.ROWS, N = C * R, TL = CFG.TILE, ST = CFG.STEP;
const NO = { move: { x: 0, y: 0 }, fire: false, firePrev: false, shift: false, remote: false, kick: false };
const mv = (x, y, fire = false) => ({ ...NO, move: { x, y }, fire });
/* row-5 corridor x 2..12, a belt (code, cells), extra EMPTY cells */
function world(heat, cells, code = F.BELT_E, extra = [], pace = 0) {
  const w = createWorld(4242, 3);
  w.gen = 3; w.heat = heat; w.pace = pace;
  loadLevel(w, 3, false);
  w.grid = new Int8Array(N).fill(T.WALL);
  for (let x = 2; x <= 12; x++) w.grid[key(x, 5)] = T.EMPTY;
  for (const [x, y] of extra) w.grid[key(x, y)] = T.EMPTY;
  w.feat = new Uint8Array(N);
  for (const x of cells) w.feat[key(x, 5)] = code;
  w.featS = new Float32Array(N); w.featM = new Uint8Array(N); w.featPend = []; w.featT = 0;
  w.enemies = []; w.items = []; w.bombs = []; w.blades = [];
  /* one sentry walled off at (12,9) keeps the room from clearing */
  w.grid[key(12, 9)] = T.EMPTY; w.enemies.push(spawnEnemy("stationary", 12, 9, 3, null, {}));
  w.state = "PLAY";
  return w;
}
const put = (w, x, y) => { const p = w.players[0]; p.x = x * TL; p.y = y * TL; p.tx = tileOf(p.x); p.ty = tileOf(p.y); p.iFrames = 99; };
const run = (w, sec, inp, each) => { for (let i = 0; i < Math.round(sec / ST); i++) { step(w, ST, { 0: inp }); w.events.length = 0; if (each) each(w); } };
const RIDE = (heat) => [0, 1, 2].map((h) => (h === heat ? { ...FEAT_PROFILE[h], belt: { actors: true, v: FEAT_PROFILE[h].belt.v } } : FEAT_PROFILE[h]));

test("snap: at MAX + HARD, holding UP across a carrying belt at any phase leaves by the side cell, never carried past it", () => {
  for (let ph = 0.02; ph < 1; ph += 0.04) {
    const w = world(2, [3, 4, 5, 6, 7, 8, 9, 10], F.BELT_E, [[7, 4], [7, 3]], 1);
    put(w, 7 + ph, 5.5);
    let past = false;
    run(w, 1.0, mv(0, -1), (q) => { if (tileOf(q.players[0].x) > 7) past = true; });
    const p = w.players[0];
    assert.ok(!past, `phase ${ph}: carried past the exit`);
    assert.equal(tileOf(p.x), 7, `phase ${ph}`);
    assert.ok(tileOf(p.y) <= 4, `phase ${ph}: still on the belt at y ${(p.y / TL).toFixed(2)}`);
  }
  /* the 2026-10-21 rule (no snap) loses the late phases: the push takes you past the corner */
  let lost = 0;
  for (let ph = 0.8; ph < 1; ph += 0.02) {
    const w = world(2, [3, 4, 5, 6, 7, 8, 9, 10], F.BELT_E, [[7, 4], [7, 3]], 1);
    w.featProf = RIDE(2);
    put(w, 7 + ph, 5.5);
    run(w, 1.0, mv(0, -1));
    if (tileOf(w.players[0].y) === 5 && tileOf(w.players[0].x) > 7) lost++;
  }
  assert.ok(lost > 0, "without snap a late phase is carried past the exit");
});
test("endHalt: a standing rider is carried to the chain's last cell and stays on it, at PLUS and MAX", () => {
  for (const heat of [1, 2]) {
    const w = world(heat, [3, 4, 5, 6], F.BELT_E);
    put(w, 3.5, 5.5);
    run(w, 6, NO);
    const p = w.players[0];
    assert.equal(tileOf(p.x), 6, "heat " + heat);
    assert.ok(Math.abs(p.x / TL - 6.5) < 0.02, "stops at the centre, heat " + heat);
  }
  const w = world(2, [3, 4, 5, 6], F.BELT_E);
  w.featProf = RIDE(2);
  put(w, 3.5, 5.5);
  run(w, 6, NO);
  assert.equal(tileOf(w.players[0].x), 7, "the 2026-10-21 rule drops the rider on the landing");
});
test("wallStop: a chain whose end is a WALL (a SHRINK ring) carries no one", () => {
  const w = world(2, [3, 4, 5, 6], F.BELT_E);
  w.grid[key(7, 5)] = T.WALL;
  put(w, 3.5, 5.5);
  run(w, 3, NO);
  assert.equal(w.players[0].x / TL, 3.5);
});
test("CORE carries no rider; PLUS carries you but no foe; MAX carries foes", () => {
  const ride = (heat, foe) => {
    const w = world(heat, [3, 4, 5, 6, 7, 8, 9, 10], F.BELT_E);
    put(w, 11.5, 5.5);
    if (foe) { const e = spawnEnemy("walker", 4, 5, 3, null, {}); e.speed = 0.0001; w.enemies.push(e); }
    else put(w, 4.5, 5.5);
    run(w, 1, NO);
    return foe ? w.enemies[1].x / TL - 4.5 : w.players[0].x / TL - 4.5;
  };
  assert.equal(ride(0, false), 0, "CORE player");
  assert.ok(ride(1, false) > 0.9, "PLUS player");
  assert.ok(Math.abs(ride(1, true)) < 0.01, "PLUS foe");
  assert.ok(ride(2, true) > 1.1, "MAX foe");
});
test("thru: a ridden bomb passes under the player and a foe, and stops only at a WALL, a BRICK or a bomb", () => {
  const plant = (w) => { put(w, 3.5, 5.5); step(w, ST, { 0: mv(0, 0, true) }); w.events.length = 0; return w.bombs[0]; };
  const w = world(0, [3, 4, 5, 6, 7, 8, 9], F.BELT_E);
  const b = plant(w);
  b.timer = 30;
  put(w, 5.5, 5.5);
  const e = spawnEnemy("stationary", 7, 5, 3, null, {}); w.enemies.push(e);
  run(w, 20, NO);
  assert.equal(b.tx, 10, "rides to the landing past the player and the foe");
  const w2 = world(0, [3, 4, 5, 6, 7, 8, 9], F.BELT_E);
  w2.grid[key(8, 5)] = T.BRICK;
  const b2 = plant(w2); b2.timer = 30; put(w2, 11.5, 5.5);
  run(w2, 20, NO);
  assert.equal(b2.tx, 7, "stops short of a BRICK");
});
test("thru: the cell a ridden bomb blows on is the static model's floor(v x pace x fuse) cell, every heat and pace", () => {
  for (const heat of [0, 1, 2]) for (let pc = -1; pc <= 1; pc++) {
    const w = world(heat, [3, 4, 5, 6, 7, 8, 9, 10], F.BELT_E, [], pc);
    put(w, 3.5, 5.5);
    step(w, ST, { 0: mv(0, 0, true) }); w.events.length = 0;
    const b = w.bombs[0];
    put(w, 12.5, 5.5);
    for (let i = 0; i < 600 && !b.dead; i++) { step(w, ST, { 0: NO }); w.events.length = 0; }
    const v = FEAT_PROFILE[heat].belt.v, want = 3 + Math.min(8, Math.floor(v * PACE_MUL[pc + 1] * w.fuse + 1e-9));
    assert.ok(b.dead, "it blew");
    assert.equal(b.tx, want, `heat ${heat} pace ${pc}`);
  }
});
