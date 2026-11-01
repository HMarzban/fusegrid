/* QUICKSAND (#26, wave 2 design section 4): the sim rule, the score rule, placement V30, fairness V31 and the looks' growth frame. */
import test from "node:test";
import assert from "node:assert/strict";
import { CFG, T, key } from "../src/core/config.js";
import { createWorld, loadLevel, step } from "../src/core/sim.js";
import { genBoard2 } from "../src/core/board2.js";
import { spawnEnemy } from "../src/core/entities.js";
import { F, FEAT_PROFILE, QUICK_PLACE, quickSeals, quickDetour } from "../src/core/feat.js";
import { featChecks } from "../src/core/featchecks.js";
import { quickStep, quickSpeed, holdReach, HOLD_MIN, GROW_STEPS } from "../src/core/tilequick.js";
import { newTally, feedTally } from "../src/app/bests.js";
import { cellSpec, specKey } from "../src/render/featdraw.js";
import { featPxCell } from "../src/render/featpx.js";

const C = CFG.COLS, R = CFG.ROWS, N = C * R, TL = CFG.TILE, DT = CFG.STEP;
const IDLE = [{ move: { x: 0, y: 0 }, fire: false }];
const at = (t) => (t + 0.5) * TL;
/* a real room 6 with no foes or items, the player parked at the start: nothing touches a tile unless a test puts it there */
function room(heat = 2, seed = 42) {
  const w = createWorld(seed, 6);
  w.gen = 3; w.heat = heat; loadLevel(w, 6, false); w.state = "PLAY";
  w.enemies = []; w.items = [];
  const e = spawnEnemy("stationary", 1, 1, 6, null, {});
  e.invuln = true; e.speed = 0; e.r = 1;
  w.enemies.push(e);
  const k = w.feat.indexOf(F.QUICK);
  return { w, k, x: k % C, y: (k / C) | 0, pr: FEAT_PROFILE[heat].quick };
}
const run = (w, secs) => { for (let i = 0, n = Math.round(secs / DT); i < n; i++) { w.players[0].iFrames = 99; step(w, DT, IDLE); w.events.length = 0; } };
const bombAt = (w, x, y, radius = 1, timer = 99) => { const b = { x: at(x), y: at(y), tx: x, ty: y, radius, timer, owner: 0, variant: "normal", dead: false }; w.bombs.push(b); return b; };

test("a tile waits the heat's wait from room start, shows 1.5 s of growth still passable, then is a real BRICK", () => {
  for (const heat of [0, 1, 2]) {
    const { w, k, x, y, pr } = room(heat);
    assert.equal(w.grid[k], T.EMPTY, "starts open");
    run(w, pr.wait - 0.1);
    assert.equal(quickStep(w, k), 0, "no growth before the wait");
    run(w, 0.2);
    assert.ok(quickStep(w, k) >= 1, "growing after the wait");
    assert.equal(w.grid[k], T.EMPTY, "passable while growing");
    run(w, pr.grow - 0.3);
    assert.equal(w.grid[k], T.EMPTY);
    run(w, 0.4);
    assert.equal(w.grid[k], T.BRICK, "heat " + heat);
    assert.equal(quickStep(w, k), 0);
    assert.ok(x > 0 && y > 0);
  }
});
test("the profile row says 30 / 18 / 10 s, 1 / 3 / no limit, 1.5 s, 2 s retry, foes x0.6 at CORE only", () => {
  assert.deepEqual(FEAT_PROFILE.map((p) => p.quick.wait), [30, 18, 10]);
  assert.deepEqual(FEAT_PROFILE.map((p) => p.quick.sink), [0.6, 1, 1]);
  assert.equal(FEAT_PROFILE[2].quick.max, 99);
});
test("growth waits while anything is on the tile, and starts 2 s after it clears", () => {
  const put = {
    player: (w, x, y) => { w.players[0].x = at(x); w.players[0].y = at(y); return () => { w.players[0].x = at(1); w.players[0].y = at(1); }; },
    foe: (w, x, y) => { const e = spawnEnemy("stationary", x, y, 6, null, {}); e.parkedOn = true; w.enemies.push(e); return () => { e.dead = true; }; },
    item: (w, x, y) => { const it = { x: at(x), y: at(y), t: "flame", taken: false, buried: false }; w.items.push(it); return () => { it.taken = true; }; },
    blade: (w, x, y) => { const b = { x: at(x), y: at(y), tiles: [{ tx: x, ty: y, brick: false }], t: 0, ttl: 1e6, variant: "normal" }; w.blades.push(b); return () => { w.blades = []; }; },
  };
  for (const [name, f] of Object.entries(put)) {
    const { w, k, x, y, pr } = room(2);
    const clear = f(w, x, y);
    run(w, pr.wait + 4);
    assert.equal(w.grid[k], T.EMPTY, name + " keeps it open");
    assert.equal(quickStep(w, k), 0, name + " no growth under it");
    clear();
    run(w, pr.retry - 0.1);
    assert.equal(quickStep(w, k), 0, name + " retry not yet up");
    run(w, 0.2);
    assert.ok(quickStep(w, k) >= 1, name + " grows 2 s after clear");
  }
});
test("an arrival mid-growth cancels at once, costs no regrowth, and it retries; a half-on body counts", () => {
  const { w, k, x, y, pr } = room(0);
  run(w, pr.wait + 0.5);
  assert.ok(quickStep(w, k) >= 1);
  const p = w.players[0];
  p.x = at(x) + TL * 0.7; p.y = at(y);
  w.grid[key(x + 1, y)] = w.grid[key(x + 1, y)] === T.WALL ? T.WALL : T.EMPTY;
  run(w, DT * 2);
  assert.equal(quickStep(w, k), 0, "a body half on the tile cancels");
  run(w, 3);
  assert.equal(w.grid[k], T.EMPTY, "still occupied, never closes on a body");
  p.x = at(1); p.y = at(1);
  run(w, pr.retry + pr.grow + 0.2);
  assert.equal(w.grid[k], T.BRICK, "CORE's one regrowth was not spent by the cancel");
});
test("hold: no growth starts with a lit bomb within max(radius + 1, 4), and none finishes", () => {
  assert.equal(holdReach(1), HOLD_MIN);
  assert.equal(holdReach(3), 4);
  assert.equal(holdReach(8), 9);
  const { w, k, x, y, pr } = room(2);
  run(w, pr.wait - 1);
  const b = bombAt(w, x, y - 4 < 1 ? y + 4 : y - 4);
  run(w, 2);
  assert.equal(quickStep(w, k), 0, "held: exactly 4 tiles away");
  b.dead = true; w.bombs = [];
  bombAt(w, x, y - 5 < 1 ? y + 5 : y - 5, 3);
  run(w, pr.retry + 0.1);
  assert.ok(quickStep(w, k) >= 1, "a bomb 5 tiles off with radius 3 does not hold it");
  run(w, 0.5);
  w.bombs = [];
  const near = bombAt(w, x, y - 2 < 1 ? y + 2 : y - 2, 1);
  run(w, pr.grow + 0.2);
  assert.equal(w.grid[k], T.EMPTY, "a growth under a new lit bomb never finishes");
  assert.equal(quickStep(w, k), 0, "and goes back to retry");
  near.dead = true; w.bombs = [];
  run(w, pr.retry + pr.grow + 0.2);
  assert.equal(w.grid[k], T.BRICK);
});
test("regrowth limits: breaking restarts the wait; CORE 1, PLUS 3, MAX has none", () => {
  for (const [heat, grows] of [[0, 1], [1, 3], [2, 6]]) {
    const { w, k, pr } = room(heat);
    let got = 0;
    for (let i = 0; i < 6; i++) {
      run(w, pr.wait + pr.grow + 0.2);
      if (w.grid[k] !== T.BRICK) break;
      got++;
      w.grid[k] = T.EMPTY;
      run(w, DT);
    }
    assert.equal(got, grows, "heat " + heat);
  }
});
test("O6: a mound scores 0, reveals nothing, carries the flag and skips the brick tally; an ordinary brick is unchanged", () => {
  const { w, k, x, y, pr } = room(2);
  run(w, pr.wait + pr.grow + 0.2);
  assert.equal(w.grid[k], T.BRICK);
  const it = { x: at(x), y: at(y), t: "flame", taken: false, buried: true };
  w.items.push(it);
  w.score = 0;
  w.players[0].x = at(1); w.players[0].y = at(1);
  const b = bombAt(w, x - 1, y, 1, 0.01);
  if (w.grid[key(x - 1, y)] === T.WALL) { b.tx = x + 1; b.x = at(x + 1); w.grid[key(x + 1, y)] = T.EMPTY; } else w.grid[key(x - 1, y)] = T.EMPTY;
  w.players[0].iFrames = 99;
  step(w, DT, IDLE);
  const ev = w.events.filter((e) => e.t === "brick");
  assert.equal(ev.length, 1);
  assert.equal(ev[0].mound, true);
  assert.equal(w.grid[k], T.EMPTY);
  assert.equal(w.score, 0, "no score");
  assert.equal(it.buried, true, "reveals nothing");
  const t = newTally();
  feedTally(t, { events: [{ t: "brick", mound: true }, { t: "brick" }], lives: 1 });
  assert.equal(t.b, 1, "the mound is not tallied");
});
test("an ordinary brick still scores and carries no flag in a tile room", () => {
  const { w, pr } = room(2);
  assert.ok(pr);
  let bk = -1;
  for (let k = 0; k < N; k++) if (w.grid[k] === T.BRICK) {
    const x = k % C, y = (k / C) | 0;
    if (w.grid[key(x - 1, y)] === T.EMPTY && w.feat[key(x - 1, y)] === 0) { bk = k; break; }
  }
  assert.ok(bk >= 0);
  const x = bk % C, y = (bk / C) | 0;
  w.score = 0;
  bombAt(w, x - 1, y, 1, 0.01);
  w.players[0].iFrames = 99;
  step(w, DT, IDLE);
  const ev = w.events.filter((e) => e.t === "brick");
  assert.ok(ev.length >= 1);
  assert.ok(ev.every((e) => !e.mound));
  assert.equal(w.score, ev.length * CFG.BRICK_SCORE);
});
test("foes sink on open sand at CORE only; a mound is not sand; the player never sinks", () => {
  for (const [heat, v] of [[0, 0.6], [1, 1], [2, 1]]) {
    const { w, k, x, y } = room(heat);
    assert.equal(quickSpeed(w, at(x), at(y)), v);
    w.grid[k] = T.BRICK;
    assert.equal(quickSpeed(w, at(x), at(y)), 1);
    assert.equal(quickSpeed(w, at(1), at(1)), 1);
  }
});
test("a SHRINK ring kills the tile: never reopens or regrows", () => {
  const { w, k, pr } = room(2);
  w.grid[k] = T.WALL;
  run(w, pr.wait + pr.grow + 1);
  assert.equal(w.grid[k], T.WALL);
  assert.equal(quickStep(w, k), 0);
});
test("the state follows the room: a reload starts a fresh wait", () => {
  const { w, k, pr } = room(2);
  run(w, pr.wait + pr.grow + 0.2);
  assert.equal(w.grid[k], T.BRICK);
  loadLevel(w, 6, false); w.state = "PLAY"; w.enemies = []; w.items = [];
  assert.equal(w.grid[k], T.EMPTY);
  run(w, 1);
  assert.equal(w.grid[k], T.EMPTY);
});
test("the sim stays deterministic on sand", () => {
  const go = () => { const { w, pr } = room(2, 77); run(w, pr.wait + pr.grow + 0.5); return Buffer.from(w.grid).toString("hex"); };
  assert.equal(go(), go());
});

/* ---- placement ---- */
const lattice = () => { const g = new Int8Array(N); for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) g[key(x, y)] = x === 0 || y === 0 || x === C - 1 || y === R - 1 || (x % 2 === 0 && y % 2 === 0) ? T.WALL : T.EMPTY; return g; };
const okOf = (g) => (x, y) => x >= 0 && y >= 0 && x < C && y < R && g[key(x, y)] !== T.WALL;
test("V30 helpers: a lattice corridor tile has a detour, a dead-end cell seals nothing, a neck mound parts the map", () => {
  const g = lattice(), ok = okOf(g);
  assert.ok(quickDetour(ok, key(4, 5)) >= 2, "a corridor tile");
  assert.equal(quickSeals(ok, [key(4, 5)]), false);
  const cut = new Int8Array(N).fill(T.WALL);
  for (let x = 1; x <= 9; x++) cut[key(x, 5)] = T.EMPTY;
  assert.equal(quickSeals(okOf(cut), [key(5, 5)]), true, "a corridor cut in two");
  assert.equal(quickSeals(okOf(cut), [key(9, 5)]), false, "the corridor's end only shortens it");
  assert.equal(quickDetour(okOf(cut), key(5, 5)), Infinity);
});
const bd = (feat, level = 6, heat = 2, g = lattice()) => ({ grid: g, feat, level, heat, gen: 3, items: [], foes: [] });
const layer = (cells) => { const f = new Uint8Array(N); for (const [x, y] of cells) f[key(x, y)] = F.QUICK; return f; };
const fail = (b, id, o) => featChecks(b, FEAT_PROFILE[b.heat], { only: [id], ...o }).map((r) => r.why);
test("V30 fails each breach on a hand-made board", () => {
  const good = [[4, 5], [10, 5], [7, 8]];
  assert.deepEqual(fail(bd(layer(good)), "V30"), []);
  assert.ok(fail(bd(layer(good.slice(0, 2))), "V30")[0].includes("2 quicksand"));
  assert.ok(fail(bd(layer([[7, 5], [8, 5], [7, 9]])), "V30")[0].includes("within"));
  assert.ok(fail(bd(layer([[4, 5], [10, 5], [3, 1]])), "V30")[0].includes("near the start"));
  const g = lattice(); g[key(7, 7)] = T.WALL;
  assert.ok(fail(bd(layer(good), 6, 2, g), "V30")[0].includes("open neighbours"));
  const c = new Int8Array(N).fill(T.WALL);
  for (let x = 1; x <= 13; x++) c[key(x, 5)] = T.EMPTY;
  for (let y = 1; y <= 11; y++) c[key(1, y)] = T.EMPTY;
  assert.ok(fail(bd(layer([[7, 5], [11, 5], [1, 9]]), 6, 2, c), "V30")[0].includes("part the map"), "a corridor mound seals");
  const open = new Int8Array(N).fill(T.EMPTY);
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (x === 0 || y === 0 || x === C - 1 || y === R - 1) open[key(x, y)] = T.WALL;
  assert.ok(fail(bd(layer([[4, 5], [13, 11], [7, 8]]), 6, 2, open), "V30")[0].includes("no detour"), "a room corner does nothing");
});
test("V31 is a real check: with no hold at all a mound beside a bomb closes the only way out", () => {
  const g = new Int8Array(N).fill(T.WALL);
  for (let x = 3; x <= 9; x++) g[key(x, 5)] = T.EMPTY;
  const f = layer([[5, 5]]);
  assert.deepEqual(fail(bd(f, 6, 2, g), "V31"), [], "the real hold proves it");
  assert.ok(fail(bd(f, 6, 2, g), "V31", { limits: { quickHold: -1 } })[0].includes("no-escape"), "no hold is unfair");
});
test("every real board in 150 seeds: 3-5 tiles, same at each heat, V30 V31 V19 V14 pass, all on floor", () => {
  let tiles = 0, boards = 0;
  for (let s = 0; s < 150; s++) {
    const seed = 2000 + s, B = [0, 1, 2].map((h) => genBoard2(seed, 6, h, { feat: true }));
    assert.ok(B[0].feat, "seed " + seed + " kept its tiles");
    assert.equal(Buffer.from(B[0].feat).toString("hex"), Buffer.from(B[2].feat).toString("hex"));
    for (let h = 0; h < 3; h++) {
      const w = createWorld(seed, 6); w.gen = 3; w.heat = h; loadLevel(w, 6, false);
      assert.deepEqual(featChecks({ ...w }, FEAT_PROFILE[h], { only: ["V14", "V19", "V30", "V31"] }).map((r) => r.id + " " + r.why), [], "seed " + seed + " heat " + h);
    }
    const n = B[0].feat.filter((v) => v === F.QUICK).length;
    assert.ok(n >= QUICK_PLACE.min && n <= QUICK_PLACE.max);
    tiles += n; boards++;
  }
  assert.ok(tiles / boards > 3.5, "mean tiles " + tiles / boards);
});

/* ---- the looks ---- */
test("the growth frame reaches the spec in steps, only while growing; a rest cell's key is unchanged", () => {
  const { w, k, x, y, pr } = room(2);
  const rest = specKey(cellSpec(w, x, y));
  assert.equal(cellSpec(w, x, y).lit, undefined, "rest: nothing new on the spec");
  run(w, pr.wait + 0.05);
  const seen = new Set();
  for (let i = 0; i < 80 && w.grid[k] === T.EMPTY; i++) { const s = cellSpec(w, x, y); if (s.lit) seen.add(s.lit); run(w, DT); }
  assert.deepEqual([...seen].sort(), Array.from({ length: GROW_STEPS }, (_, i) => i + 1));
  const { w: w2, x: x2, y: y2 } = room(2);
  assert.equal(specKey(cellSpec(w2, x2, y2)), rest);
});
test("PIXEL: arcs thicken with the frame, open (never a closed ring), rest cells untouched, every heat differs", () => {
  const BIO = { name: "SAND" };
  const base = { kind: "QUICK", outer: ["N", "E", "S", "W"] };
  for (const h of [0, 1, 2]) {
    const rest = featPxCell(BIO, { ...base, h }).rows.join("");
    assert.equal(featPxCell(BIO, { ...base, h, lit: 0 }).rows.join(""), rest);
    let prev = 0;
    for (let g = 1; g <= GROW_STEPS; g++) {
      const c = featPxCell(BIO, { ...base, h, lit: g }).rows.join("");
      let d = 0;
      for (let i = 0; i < c.length; i++) if (c[i] !== rest[i]) d++;
      assert.ok(d > prev, "heat " + h + " frame " + g + " adds marks: " + d + " after " + prev);
      prev = d;
    }
  }
  const counts = [0, 1, 2].map((h) => { const a = featPxCell(BIO, { ...base, h, lit: 4 }).rows.join(""), b = featPxCell(BIO, { ...base, h }).rows.join(""); let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; });
  assert.ok(counts[0] < counts[1] && counts[1] < counts[2], "1 / 2 / 3 arcs by heat: " + counts);
});
