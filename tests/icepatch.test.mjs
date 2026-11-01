/* ICE PATCH (sim code GLIDE, tile 5) design pass 2 (#28), the reference rule:
   CORE stops on release, MAX coasts on release and an opposite press brakes
   (stops at the next centre, never reverses), KICK kicks on ice, the glide
   state never survives a room load, a SENTRY never starts on ice while other
   foes may, and the placement takes two rings in the open lane band. */
import test from "node:test";
import assert from "node:assert";
import { CFG, T, key } from "../src/core/config.js";
import { createWorld, loadLevel, step } from "../src/core/sim.js";
import { spawnBlocked } from "../src/core/feat.js";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const FT = CFG.TILE, NOOP = { move: { x: 0, y: 0 }, fire: false };
const hold = (x, y) => ({ move: { x, y }, fire: false });
/* a gen-3 ICE room at `heat`, foes and bombs cleared, the player on the west
   end of a horizontal ice run of 3 (every tile EMPTY), bricks around kept */
function rink(heat, seed = 7) {
  for (let s = seed; s < seed + 50; s++) {
    const w = createWorld(s, 2); w.gen = 3; w.heat = heat; loadLevel(w, 2, false); w.state = "PLAY";
    if (!w.feat) continue;
    for (let y = 1; y < CFG.ROWS - 1; y++) for (let x = 1; x < CFG.COLS - 3; x++) {
      const run = [0, 1, 2].every((i) => w.feat[key(x + i, y)] === 5 && w.grid[key(x + i, y)] === T.EMPTY);
      if (!run || w.feat[key(x - 1, y)] === 5) continue;
      w.enemies = []; w.items = []; w.bombs = [];
      const p = w.players[0];
      p.x = (x + 0.5) * FT; p.y = (y + 0.5) * FT; p.tx = x; p.ty = y; p.iFrames = 99;
      return { w, p, x, y };
    }
  }
  throw new Error("no ice run found");
}
const run = (w, inp, n) => { for (let i = 0; i < n; i++) { step(w, CFG.STEP, { 0: inp }); w.events.length = 0; } };

{
  const { w, p, x } = rink(0);
  run(w, hold(1, 0), 6);
  const x0 = p.x;
  run(w, NOOP, 20);
  check("CORE: letting go on ice stops at once", p.x === x0 && !p.gl, `${x0} -> ${p.x}`);
  const want = CFG.PLAYER_START.speed * 1.0 * FT * CFG.STEP * 6;
  check("CORE: ice keeps your speed (x1.0)", Math.abs(x0 - (x + 0.5) * FT - want) < 1e-6, `${(x0 - (x + 0.5) * FT).toFixed(3)} vs ${want.toFixed(3)}`);
}
{
  const { w, p } = rink(2);
  run(w, hold(1, 0), 3);
  run(w, NOOP, 3);
  check("MAX: letting go keeps you sliding", !!p.gl && p.gl.x === 1, JSON.stringify(p.gl));
}
{
  const { w, p, x } = rink(2);
  run(w, hold(1, 0), 3);
  run(w, hold(-1, 0), 1);
  let n = 0;
  while (p.gl && n < 120) { run(w, NOOP, 1); n++; }
  const tx = Math.floor(p.x / FT);
  run(w, NOOP, 30);
  check("MAX: a tap back brakes at the next centre, on the ice, facing on", !p.gl && tx === x + 1 && p.x === (x + 1.5) * FT && Math.floor(p.x / FT) === tx, `stopped at ${p.x / FT}`);
  run(w, hold(-1, 0), 12);
  check("MAX: holding back from rest walks you back", p.x < (x + 1.5) * FT, p.x / FT);
}
{
  const { w, p, x, y } = rink(2);
  p.kick = true;
  w.bombs.push({ x: (x + 2.5) * FT, y: (y + 0.5) * FT, tx: x + 2, ty: y, timer: 2, radius: 1, owner: 0, dead: false, slide: null, prog: 0 });
  let kicked = false;
  for (let i = 0; i < 60 && !kicked; i++) { step(w, CFG.STEP, { 0: hold(1, 0) }); kicked = w.events.some((e) => e.t === "kick"); w.events.length = 0; }
  check("KICK: walking into a bomb on ice kicks it, as on floor", kicked && !!w.bombs[0].slide);
}
{
  const { w, p, x, y } = rink(2);
  p.kick = true;
  w.bombs.push({ x: (x + 2.5) * FT, y: (y + 0.5) * FT, tx: x + 2, ty: y, timer: 2, radius: 1, owner: 0, dead: false, slide: null, prog: 0 });
  run(w, hold(1, 0), 2);
  let kicked = false;
  for (let i = 0; i < 60 && !kicked; i++) { step(w, CFG.STEP, { 0: NOOP }); kicked = w.events.some((e) => e.t === "kick"); w.events.length = 0; }
  check("KICK: a MAX coast (keys released) into a bomb kicks it", kicked && !!w.bombs[0].slide);
}
{
  const { w, p } = rink(2);
  run(w, hold(1, 0), 3);
  run(w, NOOP, 1);
  loadLevel(w, 2, true);
  check("a room load clears the glide state", !p.gl && !p.glBuf);
}
{
  const f = new Uint8Array(CFG.COLS * CFG.ROWS); f[key(5, 5)] = 5; f[key(7, 7)] = 1;
  check("spawns: a SENTRY never starts on ice, other foes may", spawnBlocked(f, 5, 5, "stationary") && !spawnBlocked(f, 5, 5, "walker") && spawnBlocked(f, 7, 7, "walker"));
}
{
  let lane = 0, rings = 0, open = 0, all = 0;
  for (let s = 0; s < 40; s++) {
    const w = createWorld(1000 + s, 2); w.gen = 3; w.heat = 0; loadLevel(w, 2, false);
    if (!w.feat) continue;
    let n = 0, band = 0;
    for (let k = 0; k < w.feat.length; k++) if (w.feat[k] === 5) { n++; all++; if (w.grid[k] === T.EMPTY) open++; const y = (k / CFG.COLS) | 0; if (y >= 5 && y <= 7) band++; }
    rings += n / 8;
    if (band >= 12) lane++;
  }
  check("placement: two rings a room, mostly open, in the lane band", rings / 40 > 1.9 && open / all > 0.75 && lane >= 30, `rings ${rings / 40}, open ${(open / all).toFixed(2)}, lane ${lane}/40`);
}
console.log(`\n  ICE PATCH RESULT: ${pass} PASS / ${fail} FAIL`);
test("ICE PATCH pass-2 rule", () => assert.equal(fail, 0));
