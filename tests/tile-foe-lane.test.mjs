/* Forced moments with a foe in the lane: a tile may not close the player's only way out.
   A CONVEYOR or STREAM waits rather than carry a bomb to where it pins him (carryPins in
   sim.js); a GATE waits rather than shut on him (gatePins in tilegate.js). Each rule also
   pins where it must NOT fire, so the tiles keep their dial. */
import test from "node:test";
import "../src/core/board3.js";
import assert from "node:assert/strict";
import { CFG, T, key } from "../src/core/config.js";
import { tileOf } from "../src/core/board.js";
import { createWorld, loadLevel, step } from "../src/core/sim.js";
import { F } from "../src/core/feat.js";
import { spawnEnemy } from "../src/core/entities.js";
import { GATE_ROOM, GATE_SHUT, gatePins } from "../src/core/tilegate.js";
import { search } from "../tools/balance/oracle.mjs";

const C = CFG.COLS, R = CFG.ROWS, N = C * R, TL = CFG.TILE, ST = CFG.STEP;
const NO = { move: { x: 0, y: 0 }, fire: false, firePrev: false, shift: false, remote: false, kick: false };
const mv = (x, y, fire = false) => ({ ...NO, move: { x, y }, fire });
/* a hand-made floor on a real gen-3 world: `cells` are EMPTY, the rest WALL */
function world(room, heat, cells) {
  const w = createWorld(4242, room);
  w.gen = 3; w.heat = heat;
  loadLevel(w, room, false);
  w.grid = new Int8Array(N).fill(T.WALL);
  for (const [x, y] of cells) w.grid[key(x, y)] = T.EMPTY;
  w.feat = new Uint8Array(N); w.featS = new Float32Array(N); w.featM = new Uint8Array(N); w.featPend = []; w.featT = 0;
  w.enemies = []; w.items = []; w.bombs = []; w.blades = []; w.quick = null;
  /* one sentry walled off keeps the room from clearing */
  w.grid[key(12, 11)] = T.EMPTY; foe(w, 12, 11);
  w.state = "PLAY";
  return w;
}
function foe(w, x, y, type = "stationary") { const e = spawnEnemy(type, x, y, 3, w.rng); w.enemies.push(e); return e; }
const put = (w, x, y) => { const p = w.players[0]; p.x = (x + 0.5) * TL; p.y = (y + 0.5) * TL; p.tx = x; p.ty = y; p.iFrames = 0; };
const run = (w, sec, inp) => { let hurt = false; for (let i = 0; i < Math.round(sec / ST); i++) { step(w, ST, { 0: inp }); if (w.events.some((e) => e.t === "hurt")) hurt = true; w.events.length = 0; } return hurt; };
const row = (y, a, b) => { const o = []; for (let x = a; x <= b; x++) o.push([x, y]); return o; };

/* the planted-beside-a-walker board: a flow runs east to x 10, floor at (11,5), a dead-end cell (11,4) */
function pocket(code, heat) {
  const w = world(code === F.BELT_E ? 3 : 4, heat, [...row(5, 2, 11), [11, 4]]);
  for (let x = 6; x <= 10; x++) w.feat[key(x, 5)] = code;
  return w;
}
for (const [name, code] of [["CONVEYOR", F.BELT_E], ["STREAM", F.STREAM_E]]) for (const heat of [0, 1, 2]) {
  test(`${name} heat ${heat}: planted beside a foe, the flow waits and the way out stays open`, () => {
    const w = pocket(code, heat);
    foe(w, 9, 5); put(w, 10, 5);
    step(w, ST, { 0: mv(0, 0, true) }); w.events.length = 0;
    const b = w.bombs.find((q) => !q.dead);
    assert.ok(b, "a bomb was planted");
    assert.equal(b.tx, 10);
    run(w, 0.5, NO);
    assert.equal(b.tx, 10, "not carried on to (11,5), which leaves no cell out of its blast");
    /* he walks off: the bomb still waits, or his pocket is its blast */
    let hurt = run(w, 0.5, mv(1, 0));
    hurt = run(w, 0.5, mv(0, -1)) || hurt;
    assert.equal(tileOf(w.players[0].y), 4);
    hurt = run(w, 3, NO) || hurt;
    assert.ok(!hurt, "he lives in the pocket");
  });
  test(`${name} heat ${heat}: with a way out the flow carries as ever`, () => {
    const w = world(code === F.BELT_E ? 3 : 4, heat, [...row(5, 2, 11), ...row(3, 2, 11), [2, 4], [11, 4]]);
    for (let x = 6; x <= 10; x++) w.feat[key(x, 5)] = code;
    put(w, 8, 5);
    step(w, ST, { 0: mv(0, 0, true) }); w.events.length = 0;
    const b = w.bombs.find((q) => !q.dead);
    w.players[0].x = 2.5 * TL;
    w.players[0].tx = 2;
    run(w, 2.2, NO);
    assert.ok(b.tx > 8, `carried down the run, at ${b.tx}`);
  });
}
test("the flow's wait is lifted the moment the foe leaves the lane", () => {
  const w = pocket(F.BELT_E, 2), e = foe(w, 9, 5);
  put(w, 10, 5);
  step(w, ST, { 0: mv(0, 0, true) }); w.events.length = 0;
  const b = w.bombs.find((q) => !q.dead);
  run(w, 0.3, NO);
  assert.equal(b.tx, 10);
  /* the lane west is open now, so (11,5) no longer pins him; he has not moved */
  w.enemies = w.enemies.filter((q) => q !== e);
  run(w, 1.2, NO);
  assert.equal(b.tx, 11);
});
test("no foe needed: the flow waits rather than pin the player in a dead end", () => {
  const w = world(3, 2, [...row(5, 6, 11), [11, 4]]);
  for (let x = 6; x <= 10; x++) w.feat[key(x, 5)] = F.BELT_E;
  put(w, 10, 5);
  step(w, ST, { 0: mv(0, 0, true) }); w.events.length = 0;
  const b = w.bombs.find((q) => !q.dead);
  /* he walks up into the dead end: the bomb stays a tile short, off the line of his cell */
  run(w, 0.5, mv(1, 0));
  const hurt = run(w, 0.5, mv(0, -1));
  assert.equal(tileOf(w.players[0].y), 4);
  assert.equal(b.tx, 10);
  assert.ok(!hurt && !run(w, 2.5, NO), "he lives in the dead end");
});

/* row 5: pocket x 2..6 west of the gate at (7,5), long floor east of it */
function gated(heat) {
  const w = world(8, heat, row(5, 2, 12));
  w.feat[key(7, 5)] = F.GATE;
  return w;
}
const OPEN = { 1: 6, 2: 4 };
for (const heat of [1, 2]) {
  test(`GATE heat ${heat}: never shuts on a player with a foe in his lane; lands once he is out of the pin`, () => {
    const w = gated(heat), k = key(7, 5);
    foe(w, 3, 5); put(w, 6, 5);
    assert.ok(gatePins(w, 7, 5), "2 free cells shut, more open");
    assert.ok(!run(w, OPEN[heat] + 0.1, NO));
    assert.notEqual(w.featM[k], GATE_SHUT, "still open");
    assert.equal(w.grid[k], T.EMPTY);
    assert.equal(w.featM[k], 3, "held at the last warning step");
    /* he crosses and clears the tile: the room behind him no longer pins him */
    run(w, 0.8, mv(1, 0));
    assert.ok(tileOf(w.players[0].x) >= 8);
    run(w, 0.1, NO);
    assert.equal(w.featM[k], GATE_SHUT, "lands behind him");
  });
  test(`GATE heat ${heat}: a quiet pocket and a far player do not stop the clock`, () => {
    const a = gated(heat);
    put(a, 6, 5);
    assert.ok(!gatePins(a, 7, 5), "no foe at its edge, no blast on it");
    run(a, OPEN[heat] + 0.1, NO);
    assert.equal(a.featM[key(7, 5)], GATE_SHUT);
    const b = world(8, heat, [...row(5, 2, 12), ...row(4, 2, 12), ...row(6, 2, 12), ...row(3, 2, 12)]);
    b.feat[key(7, 5)] = F.GATE;
    foe(b, 3, 3); put(b, 5, 3);
    assert.ok(!gatePins(b, 7, 5), "open ground: the gate takes nothing he needs");
    run(b, OPEN[heat] + 0.1, NO);
    assert.equal(b.featM[key(7, 5)], GATE_SHUT);
  });
  test(`GATE heat ${heat}: a lit bomb's blast counts: it waits while it would seal him in the blast`, () => {
    const w = gated(heat), k = key(7, 5);
    run(w, OPEN[heat] - 1, NO);
    put(w, 5, 5);
    step(w, ST, { 0: mv(0, 0, true) }); w.events.length = 0;
    put(w, 6, 5);
    w.players[0].iFrames = 99;
    assert.ok(gatePins(w, 7, 5));
    run(w, 1.2, NO);
    assert.equal(w.grid[k], T.EMPTY);
  });
}
test(`GATE: the pin is a small room: at ${GATE_ROOM} free cells he has space and the clock runs`, () => {
  const cells = [...row(5, 8, 12), ...row(5, 2, 7), ...row(3, 2, GATE_ROOM)];
  for (let y = 3; y <= 5; y++) cells.push([2, y]);
  const w = world(8, 1, cells);
  w.feat[key(7, 5)] = F.GATE;
  foe(w, 3, 5); put(w, 2, 4);
  assert.ok(!gatePins(w, 7, 5), "the foe's own lane does not pin a player with room behind him");
});
test("the rule replays: one seed and one input stream give one gate history", () => {
  const hist = () => {
    const w = gated(2), out = [];
    foe(w, 3, 5); put(w, 6, 5);
    for (let i = 0; i < 400; i++) { step(w, ST, { 0: i > 300 ? mv(1, 0) : NO }); w.events.length = 0; out.push(w.featM[key(7, 5)]); }
    return out.join("");
  };
  assert.equal(hist(), hist());
});
test("the oracle's closure search: a quiet world is not safe from a foe", () => {
  const w = world(8, 2, row(5, 2, 6));
  foe(w, 3, 5, "chaser"); put(w, 6, 5);
  assert.equal(search(w), true, "no hold: nothing lit, so it stops at once");
  assert.equal(search(w, { hold: 2.5 }), false, "hold: he has nowhere to go and the chaser walks in");
});

/* review 2026-11-02: a shut gate stops a blast, so the pocket behind it is safe ground, not a reason to hold it open */
test("a gate is not held open by a blast it would stop: hiding behind it costs no life", () => {
  for (const [heat, open] of [[1, 6], [2, 4]]) {
    const w = world(8, heat, [...row(5, 4, 10), [8, 6], [8, 7], [8, 8], [8, 9], ...row(9, 8, 11)]);
    w.feat[key(7, 5)] = F.GATE; w.featT = open - 0.05;
    put(w, 5, 5);
    const lives = w.lives;
    w.bombs = [{ x: 9.5 * TL, y: 5.5 * TL, tx: 9, ty: 5, timer: 1, radius: 5, pierce: false, line: false, dir: null, variant: "normal", dead: false }];
    assert.equal(gatePins(w, 7, 5), false, "heat " + heat);
    const hurt = run(w, 2, NO);
    assert.equal(hurt, false, "heat " + heat + " takes no hit");
    assert.equal(w.lives, lives, "heat " + heat);
  }
});

/* with PASS he walks through bricks, so a brick is no reason to hold anything */
test("PASS: a flow carries a bomb when he can walk out through the bricks", () => {
  const walled = (pass) => {
    const w = pocket(F.BELT_E, 2);
    w.grid[key(11, 3)] = T.BRICK; w.grid[key(11, 2)] = T.EMPTY; w.grid[key(10, 2)] = T.EMPTY; w.grid[key(9, 2)] = T.EMPTY;
    put(w, 11, 4);
    w.players[0].iFrames = 1e9; w.players[0].passing = pass;
    const b = { x: 10.5 * TL, y: 5.5 * TL, tx: 10, ty: 5, timer: 2, radius: 3, pierce: false, line: false, dir: null, variant: "normal", dead: false };
    w.bombs = [b];
    return { w, b };
  };
  const a = walled(false); run(a.w, 1.2, NO);
  assert.equal(a.b.tx, 10, "without PASS the flow waits");
  const c = walled(true); run(c.w, 1.2, NO);
  assert.equal(c.b.tx, 11, "with PASS it carries");
});
test("PASS: a gate is not held when he can walk out through the bricks", () => {
  const w = world(8, 2, [...row(5, 4, 6), [7, 5], ...row(5, 8, 10)]);
  w.feat[key(7, 5)] = F.GATE;
  w.grid[key(5, 6)] = T.BRICK;
  for (let x = 2; x <= 10; x++) w.grid[key(x, 7)] = T.EMPTY;
  w.grid[key(5, 6)] = T.BRICK;
  put(w, 5, 5);
  foe(w, 4, 5);
  assert.equal(gatePins(w, 7, 5), true, "without PASS: a foe beside him, too few cells");
  w.players[0].passing = true;
  assert.equal(gatePins(w, 7, 5), false, "with PASS the brick is a door");
});
