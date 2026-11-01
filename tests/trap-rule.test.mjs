/* #28 design pass 2, TRAP (sim code PLATE, room 5): the pass-2 arming and
   blast rules on a hand-built open room. A foe parked on the trap (speed 0)
   arms it unless: the player is farther than `near` (CORE / PLUS 4), on or
   within `off` 1 tile of its lines, or a lit bomb's blast reaches its lines
   (`hold`). Its blast sets off no bomb (`chain` false), spares the foe that
   armed it at PLUS (`spare`) and kills no foe at MAX (`kill` false). */
import test from "node:test";
import assert from "node:assert/strict";
import { CFG, T, key } from "../src/core/config.js";
import { createWorld, loadLevel, step } from "../src/core/sim.js";
import { FEAT_PROFILE } from "../src/core/feat.js";

const C = CFG.COLS, R = CFG.ROWS, TX = 7, TY = 5, NOOP = { move: { x: 0, y: 0 }, fire: false, firePrev: false, shift: false, remote: false, kick: false };
const at = (o, x, y) => { o.x = (x + 0.5) * CFG.TILE; o.y = (y + 0.5) * CFG.TILE; o.tx = x; o.ty = y; };
function room(heat) {
  const w = createWorld(12345, 5);
  w.gen = 3; w.heat = heat; w.pact = 0; w.pace = 0;
  loadLevel(w, 5, false);
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) w.grid[key(x, y)] = x === 0 || y === 0 || x === C - 1 || y === R - 1 ? T.WALL : T.EMPTY;
  w.feat = new Uint8Array(C * R); w.feat[key(TX, TY)] = 7;
  w.featS.fill(0); w.featM.fill(0); w.featPend = []; w.featT = 10;
  w.items = []; w.bombs = []; w.blades = [];
  w.enemies = w.enemies.slice(0, 2);
  for (const e of w.enemies) { e.speed = 0; e.invuln = false; }
  at(w.enemies[0], TX, TY); at(w.enemies[1], 12, 11);
  at(w.players[0], 3, 9); w.players[0].iFrames = 0;
  w.state = "PLAY";
  return w;
}
const tick = (w) => { step(w, CFG.STEP, { 0: NOOP }); w.events.length = 0; };
const armed = (w) => w.featPend.some((q) => q.kind === "plate");
const fire = (w) => { for (let i = 0; i < Math.ceil(FEAT_PROFILE[w.heat].plate.wind / CFG.STEP) + 2; i++) tick(w); };

test("the profile carries the pass-2 TRAP knobs", () => {
  const [c, p, m] = FEAT_PROFILE.map((r) => r.plate);
  assert.deepEqual([c.r, p.r, m.r], [1, 2, 3]);
  assert.deepEqual([c.near, p.near, m.near], [4, 4, undefined]);
  for (const q of [c, p, m]) { assert.equal(q.off, 1); assert.equal(q.hold, true); assert.equal(q.chain, false); }
  assert.equal(p.spare, true); assert.equal(m.kill, false); assert.equal(m.inert, 6);
});
test("near: CORE arms only with the player within 4 tiles; MAX arms anywhere", () => {
  const w = room(0); at(w.players[0], 1, 1); tick(w);
  assert.ok(!armed(w), "player 10 tiles away");
  const v = room(0); at(v.players[0], TX - 2, TY - 2); tick(v);
  assert.ok(armed(v), "player 4 away, off the lines");
  const m = room(2); at(m.players[0], 1, 1); tick(m);
  assert.ok(armed(m), "MAX has no near gate");
});
test("off: never arms with the player on or beside its lines", () => {
  for (const [x, y] of [[TX - 1, TY], [TX, TY + 1], [TX - 1, TY - 1], [TX - 2, TY + 1]]) {
    const w = room(0); at(w.players[0], x, y); tick(w);
    assert.ok(!armed(w), `player at ${x},${y}`);
  }
});
test("hold: never arms while a lit bomb's blast reaches its lines", () => {
  const w = room(0); at(w.players[0], TX - 2, TY - 2);
  w.bombs.push({ x: (TX + 0.5) * CFG.TILE, y: (TY - 2.5) * CFG.TILE, tx: TX, ty: TY - 3, timer: 2.5, radius: 2, pierce: false, line: false, dir: null, variant: "normal", dead: false });
  tick(w);
  assert.ok(!armed(w), "a bomb two tiles above the trap, radius 2");
});
test("chain false: the trap blast sets off no bomb on its lines", () => {
  const w = room(2); at(w.players[0], 1, 11);
  w.bombs.push({ x: (TX + 3.5) * CFG.TILE, y: (TY + 0.5) * CFG.TILE, tx: TX + 3, ty: TY, timer: 2.5, radius: 1, pierce: false, line: false, dir: null, variant: "normal", dead: false });
  w.featM[key(TX, TY)] = 1; w.featS[key(TX, TY)] = 0.01; w.featPend.push({ k: key(TX, TY), kind: "plate", by: "walker" });
  tick(w);
  assert.ok(w.blades.some((b) => b.src === "plate"), "the trap fired");
  assert.ok(w.bombs.some((b) => !b.dead), "the bomb on its arm is still lit");
});
test("CORE kills the foe that set it off; PLUS spares it but not a foe on its lines; MAX kills no foe", () => {
  const c = room(0); at(c.players[0], TX - 2, TY - 2); const ct = c.enemies[0]; fire(c);
  assert.ok(ct.dead, "CORE: trigger foe dead");
  const p = room(1); at(p.players[0], TX - 2, TY - 2); at(p.enemies[1], TX + 2, TY); const trig = p.enemies[0], other = p.enemies[1]; fire(p);
  assert.ok(!trig.dead, "PLUS: trigger foe lives"); assert.ok(other.dead, "PLUS: a foe on its line dies");
  const m = room(2); at(m.players[0], 1, 11); at(m.enemies[1], TX + 2, TY); const a = m.enemies[0], b = m.enemies[1]; for (let i = 0; i < 80; i++) tick(m);
  assert.ok(m.blades.length || m.featM[key(TX, TY)] === 2, "MAX fired"); assert.ok(!a.dead && !b.dead, "MAX: no foe dies");
});
