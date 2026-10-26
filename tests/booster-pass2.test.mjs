/* #28 design pass 2, BOOSTER lane (reference patch): spot-gated placement and
   the optional bloom.safe knob. */
import test from "node:test";
import assert from "node:assert/strict";
import { CFG, T, key } from "../src/core/config.js";
import { createWorld, loadLevel, step } from "../src/core/sim.js";
import { FEAT_PROFILE, BLOOM_PLACE } from "../src/core/feat.js";
import { featChecks } from "../tools/balance/featchecks.mjs";

const mk = (seed, heat) => { const w = createWorld(seed, 1); w.gen = 3; w.heat = heat; loadLevel(w, 1, false); w.state = "PLAY"; return w; };
const LIM = { boostMin: BLOOM_PLACE.min, boostMax: BLOOM_PLACE.max, boostPocket: BLOOM_PLACE.pocket, boostGap: BLOOM_PLACE.gap };

test("room 1 gen 3: 3-5 boosters, the same at every heat, no V18 / V19 / V25 failure at any heat", () => {
  for (let s = 0; s < 12; s++) {
    const ws = [0, 1, 2].map((h) => mk(5000 + s, h));
    assert.ok(ws[0].feat, "seed " + s);
    const hx = ws.map((w) => Buffer.from(w.feat).toString("hex"));
    assert.equal(hx[0], hx[1]); assert.equal(hx[1], hx[2]);
    const n = ws[0].feat.filter((v) => v === 6).length;
    assert.ok(n >= BLOOM_PLACE.min && n <= BLOOM_PLACE.max, "count " + n);
    for (let h = 0; h < 3; h++) assert.deepEqual(featChecks(ws[h], FEAT_PROFILE[h], { only: ["V18", "V19", "V25"], limits: LIM }).map((r) => r.id), [], "seed " + s + " heat " + h);
  }
});

function relayShot(safe) {
  const w = mk(5003, 0);
  w.enemies.length = 1;
  Object.assign(w.enemies[0], { x: 13.5 * CFG.TILE, y: 11.5 * CFG.TILE, tx: 13, ty: 11, speed: 0 });
  w.items.length = 0;
  const b = w.feat.findIndex((v) => v === 6), bx = b % CFG.COLS, by = (b / CFG.COLS) | 0;
  for (let x = bx - 1; x <= bx + 2; x++) w.grid[key(x, by)] = T.EMPTY;
  w.featProf = FEAT_PROFILE.map((t) => ({ ...t, bloom: { ...t.bloom, safe } }));
  const p = w.players[0];
  p.x = (bx - 0.5) * CFG.TILE; p.y = (by + 0.5) * CFG.TILE; p.tx = bx - 1; p.ty = by; p.range = 1;
  step(w, CFG.STEP, { 0: { move: { x: 0, y: 0 }, fire: true, firePrev: false, shift: false, remote: false, kick: false } });
  assert.equal(w.bombs.length, 1);
  p.x = (bx + 1.5) * CFG.TILE; p.tx = bx + 1;
  const lives = w.lives;
  let relays = 0;
  for (let i = 0; i < 400 && w.bombs.length; i++) { step(w, CFG.STEP, { 0: { move: { x: 0, y: 0 }, fire: false, firePrev: false, shift: false, remote: false, kick: false } }); relays += w.events.filter((e) => e.t === "boom" && e.src === "relay").length; w.events.length = 0; }
  for (let i = 0; i < 30; i++) { step(w, CFG.STEP, { 0: { move: { x: 0, y: 0 }, fire: false, firePrev: false, shift: false, remote: false, kick: false } }); w.events.length = 0; }
  return { relays, hurt: lives - w.lives };
}
test("a relay blade hurts the player by default; bloom.safe (an option, off) spares only the player", () => {
  const a = relayShot(false), b = relayShot(true);
  assert.equal(a.relays, 1); assert.equal(b.relays, 1);
  assert.equal(a.hurt, 1);
  assert.equal(b.hurt, 0);
});
