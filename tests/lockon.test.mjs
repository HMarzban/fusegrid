/* Hunter lock-on tell (issue #32, owner ruling 2026-10-26 "Lock-on tell"): the read-only lockOn rule, its bfsNext mirror, the lockK ramp, the proof that
   the sim never sees it, and the PAUSE freeze in CLASSIC 2D, PIXEL and REAL 3D. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CFG, T, key } from "../src/core/config.js";
import { createWorld, loadLevel, step, newIntent } from "../src/core/sim.js";
import { spawnEnemy } from "../src/core/entities.js";
import { bfsNext } from "../src/core/board.js";
import { createRng } from "../src/core/rng.js";
import { lockOn, LOCK_N } from "../src/render/lockon.js";
import { lockK, LOCK } from "../src/render/motion.js";
import { createRenderer } from "../src/render/renderer.js";
import { initFx, setFxOpts } from "../src/render/fx.js";
import { createAtlas } from "../src/render/pixel/atlas.js";
import { createView, drawPixelWorld } from "../src/render/pixel/world.js";
import { createOneShots } from "../src/render/pixel/oneshot.js";
import { pxRamp } from "../src/render/pixel/palette.js";
import { createRGBA, surfRGBA } from "../tools/pixel/rgba.mjs";
import { createRenderer3D } from "../src/render/three/wrapper.js";
import { LANES } from "../src/render/three/groundfx.js";
import { makeFoe, stepFoe } from "../src/render/three/entityanim.js";

const TL = CFG.TILE, ctr = (v) => (v + 0.5) * TL, R = (x, y) => ({ x, y });
/* an open room: border WALL, interior EMPTY, no foes, no bombs; the player at tile (px, py) */
function room(px = 7, py = 5) {
  const w = createWorld(4242, 1); loadLevel(w, 1); w.state = "PLAY";
  for (let y = 1; y < CFG.ROWS - 1; y++) for (let x = 1; x < CFG.COLS - 1; x++) w.grid[key(x, y)] = T.EMPTY;
  w.enemies.length = 0; w.items.length = 0; w.bombs.length = 0; w.blades.length = 0; w.events.length = 0;
  const p = w.players[0]; p.x = ctr(px); p.y = ctr(py); p.tx = px; p.ty = py; p.iFrames = 0;
  return w;
}
const hunter = (w, type, x, y, dir, o = {}) => { const e = Object.assign(spawnEnemy(type, x, y, 1, null), { dir: { ...dir }, invuln: false, invulnT: 0 }, o); w.enemies.push(e); return e; };
const bomb = (w, x, y, o = {}) => w.bombs.push({ x: ctr(x), y: ctr(y), tx: x, ty: y, timer: CFG.FUSE, radius: 2, variant: "normal", dead: false, ...o });

test("rule: an open lane, facing the player, 1..LOCK_N tiles away, locks on (rows and columns, both ways)", () => {
  assert.equal(LOCK_N, 4);
  for (const type of ["fast", "chaser", "knight"]) {
    const w = room(7, 5);
    assert.deepEqual(lockOn(w, hunter(w, type, 3, 5, R(1, 0))), { dx: 1, dy: 0, n: 4 }, type + " east");
    assert.deepEqual(lockOn(w, hunter(w, type, 9, 5, R(-1, 0))), { dx: -1, dy: 0, n: 2 }, type + " west");
    assert.deepEqual(lockOn(w, hunter(w, type, 7, 1, R(0, 1))), { dx: 0, dy: 1, n: 4 }, type + " south");
    assert.deepEqual(lockOn(w, hunter(w, type, 7, 6, R(0, -1))), { dx: 0, dy: -1, n: 1 }, type + " north, adjacent");
  }
});

test("rule: too far, wrong facing, off the lane, same tile, non-hunter, dead or moving-less foe and dead player never lock", () => {
  const w = room(7, 5);
  assert.equal(lockOn(w, hunter(w, "chaser", 2, 5, R(1, 0))), null, "5 tiles is past LOCK_N");
  assert.equal(lockOn(w, hunter(w, "chaser", 3, 5, R(-1, 0))), null, "facing away");
  assert.equal(lockOn(w, hunter(w, "chaser", 3, 5, R(0, 1))), null, "facing across the lane");
  assert.equal(lockOn(w, hunter(w, "chaser", 4, 4, R(1, 0))), null, "one row off (diagonal)");
  assert.equal(lockOn(w, hunter(w, "chaser", 7, 5, R(1, 0))), null, "same tile: already in contact");
  assert.equal(lockOn(w, hunter(w, "walker", 4, 5, R(1, 0))), null, "a walker never hunts");
  assert.equal(lockOn(w, hunter(w, "chaser", 4, 5, R(1, 0), { dead: true })), null, "a dead foe");
  assert.equal(lockOn(w, hunter(w, "chaser", 4, 5, R(1, 0), { speed: 0 })), null, "a foe that cannot move");
  const e = hunter(w, "chaser", 4, 5, R(1, 0));
  assert.ok(lockOn(w, e), "control: the same foe is locked");
  w.players[0].alive = false;
  assert.equal(lockOn(w, e), null, "a dead player");
});

test("rule: WALL, BRICK and a live bomb between block a normal hunter; a dead bomb does not; a bomb on the player's own tile blocks too", () => {
  const mk = () => { const w = room(7, 5); return { w, e: hunter(w, "fast", 3, 5, R(1, 0)) }; };
  { const { w, e } = mk(); w.grid[key(5, 5)] = T.WALL; assert.equal(lockOn(w, e), null, "wall"); }
  { const { w, e } = mk(); w.grid[key(5, 5)] = T.BRICK; assert.equal(lockOn(w, e), null, "brick"); }
  { const { w, e } = mk(); bomb(w, 5, 5); assert.equal(lockOn(w, e), null, "live bomb"); }
  { const { w, e } = mk(); bomb(w, 5, 5, { dead: true }); assert.ok(lockOn(w, e), "a dead bomb is no wall"); }
  { const { w, e } = mk(); bomb(w, 7, 5); assert.equal(lockOn(w, e), null, "bfsNext refuses a bomb-covered target, so no lock"); }
  { const { w, e } = mk(); bomb(w, 3, 5); assert.ok(lockOn(w, e), "a bomb under the hunter itself is behind it, like bfsNext's start tile"); }
  { const { w, e } = mk(); w.grid[key(7, 5)] = T.BRICK; assert.equal(lockOn(w, e), null, "a PASS player inside a brick is unreachable for a normal hunter"); }
});

test("rule: a brick-passing hunter (synthetic: no shipped hunter has pass) looks through BRICK and bombs, never through WALL", () => {
  const mk = () => { const w = room(7, 5); return { w, e: hunter(w, "chaser", 3, 5, R(1, 0), { pass: true }) }; };
  { const { w, e } = mk(); w.grid[key(5, 5)] = T.BRICK; assert.ok(lockOn(w, e), "brick"); }
  { const { w, e } = mk(); bomb(w, 5, 5); assert.ok(lockOn(w, e), "bomb"); }
  { const { w, e } = mk(); w.grid[key(5, 5)] = T.WALL; assert.equal(lockOn(w, e), null, "wall"); }
});

test("rule mirrors the AI: on every lock, bfsNext (as updateEnemies calls it) steps down that same lane", () => {
  const rng = createRng(321);
  let locks = 0, blocked = 0;
  for (let n = 0; n < 3000; n++) {
    const w = room(1 + rng.int(0, CFG.COLS - 3), 1 + rng.int(0, CFG.ROWS - 3));
    for (let y = 1; y < CFG.ROWS - 1; y++) for (let x = 1; x < CFG.COLS - 1; x++) { const r = rng.next(); w.grid[key(x, y)] = r < 0.15 ? T.WALL : r < 0.35 ? T.BRICK : T.EMPTY; }
    const p = w.players[0], px = p.tx, py = p.ty;
    w.grid[key(px, py)] = T.EMPTY;
    for (let b = 0; b < 3; b++) bomb(w, 1 + rng.int(0, CFG.COLS - 3), 1 + rng.int(0, CFG.ROWS - 3));
    const d = rng.int(1, LOCK_N), ax = rng.next() < 0.5, sg = rng.next() < 0.5 ? -1 : 1, ex = ax ? px - sg * d : px, ey = ax ? py : py - sg * d;
    if (ex < 1 || ey < 1 || ex > CFG.COLS - 2 || ey > CFG.ROWS - 2) continue;
    w.grid[key(ex, ey)] = T.EMPTY;
    const e = hunter(w, "chaser", ex, ey, ax ? R(sg, 0) : R(0, sg), { pass: rng.next() < 0.2 });
    const bk = new Set(w.bombs.filter((b) => !b.dead).map((b) => key(b.tx, b.ty)));
    const nx = bfsNext(w.grid, e.tx, e.ty, px, py, e.pass, e.pass ? null : bk), lo = lockOn(w, e);
    if (lo) {
      locks++;
      assert.ok(nx && nx.x === e.tx + lo.dx && nx.y === e.ty + lo.dy, "locked, so the AI's next step is the lane");
    } else blocked++;
  }
  assert.ok(locks > 200 && blocked > 200, locks + " locks / " + blocked + " blocked");
});

test("lockOn is pure: a deep-frozen world gives the same answer twice, and the module reads no clock and no Math.random", () => {
  const w = room(7, 5), e = hunter(w, "knight", 4, 5, R(1, 0));
  bomb(w, 9, 5);
  const freeze = (o) => { if (o && typeof o === "object" && !Object.isFrozen(o) && !ArrayBuffer.isView(o)) { Object.freeze(o); for (const k of Object.keys(o)) freeze(o[k]); } return o; };
  const fw = freeze({ grid: Int8Array.from(w.grid), bombs: w.bombs, players: w.players, enemies: w.enemies });
  const before = JSON.stringify(fw);
  const a = lockOn(fw, e), b = lockOn(fw, e);
  assert.deepEqual(a, { dx: 1, dy: 0, n: 3 });
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(fw), before);
  const src = readFileSync(new URL("../src/render/lockon.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/Date|Math\.random|performance|world\.time/.test(src));
});

test("lockK ramps in over LOCK.IN and out over LOCK.OUT on the caller's clock; the same t or a frozen clock holds it; a clock reset never jumps", () => {
  const s = {}, on = { dx: 1, dy: 0, n: 3 };
  assert.equal(lockK(s, on, 10), 0, "first sight starts at 0");
  assert.ok(Math.abs(lockK(s, on, 10 + LOCK.IN / 2) - 0.5) < 1e-9);
  assert.ok(Math.abs(lockK(s, on, 10 + LOCK.IN / 2) - 0.5) < 1e-9, "a repeat render at the same t holds");
  for (let i = 1; i <= 6; i++) lockK(s, on, 10 + LOCK.IN / 2 + i / 60);
  assert.equal(s.lk, 1);
  const t1 = 10 + LOCK.IN / 2 + 6 / 60;
  assert.equal(lockK(s, null, t1 + LOCK.OUT / 2), 1 - 0.05 / LOCK.OUT, "a long gap is clamped to 0.05 s");
  assert.equal(s.ldx, 1, "the lane is kept for the ramp out");
  assert.equal(lockK(s, null, 2), s.lk, "a clock that went backwards (new room) does not move k");
  for (let i = 1; i <= 30; i++) lockK(s, null, 2 + i / 60);
  assert.equal(s.lk, 0);
  assert.ok(LOCK.IN <= 0.12 && LOCK.OUT <= 0.2, "short ramps: the warning is not eaten by its own fade");
});

/* ---- the sim never sees it ---- */
function run(seed, level, heat, look, open) {
  const w = createWorld(seed, level); w.heat = heat; w.gen = 2; loadLevel(w, level); w.state = "PLAY";
  if (open) {
    for (let y = 1; y < CFG.ROWS - 1; y++) for (let x = 1; x < CFG.COLS - 1; x++) if (w.grid[key(x, y)] === T.BRICK && (x + y * 3) % 4) w.grid[key(x, y)] = T.EMPTY;
    for (const [t, x, y] of [["chaser", 11, 9], ["fast", 13, 1], ["knight", 1, 11], ["walker", 7, 7]]) { w.grid[key(x, y)] = T.EMPTY; w.enemies.push(spawnEnemy(t, x, y, level, w.rng)); }
  }
  const rng = createRng(seed ^ 0x5eed), it = newIntent(), evs = [];
  let locks = 0, r2 = null, V = null, r3 = null, c = null;
  if (look) {
    initFx();
    const rec = new Proxy({}, { get: (o, k) => (k in o ? o[k] : k === "canvas" ? { width: 600, height: 520 } : () => ({ addColorStop() {} })), set: (o, k, v) => ((o[k] = v), true) });
    r2 = createRenderer({ width: 600, height: 520, getContext: () => rec }, { kind: "2d" });
    V = createView(createAtlas(surfRGBA)); V.shots = createOneShots(); V.parts = [];
    c = createRGBA(300, 260, "#101018").getContext();
    r3 = createRenderer3D(null, null, { audio: null, hud: null });
  }
  for (let f = 0; f < 60 * 40 && w.state === "PLAY"; f++) {
    if (f % 15 === 0) { const d = [R(1, 0), R(-1, 0), R(0, 1), R(0, -1), R(0, 0)][rng.int(0, 4)]; it.move = { x: d.x, y: d.y }; }
    it.fire = rng.next() < 0.02;
    step(w, CFG.STEP, [it]);
    evs.push(JSON.stringify(w.events));
    if (look) {
      for (const e of w.enemies) if (lockOn(w, e)) locks++;
      const ev = w.events.slice();
      r2.render(w, CFG.STEP);
      w.events.push(...ev); V.t = w.time; V.dt = CFG.STEP; drawPixelWorld(c, w, V);
      w.events.length = 0; w.events.push(...ev); r3.render(w, CFG.STEP);
    }
    w.events.length = 0;
  }
  return { snap: JSON.stringify({ grid: Array.from(w.grid), rng: w.rng.state, time: w.time, tick: w.tick, state: w.state, score: w.score, lives: w.lives, players: w.players, enemies: w.enemies, bombs: w.bombs, items: w.items }), evs: evs.join("\n"), locks };
}

test("no sim change: the same seeded runs give byte-identical worlds and events with all three looks drawing the tell every step", () => {
  let locks = 0;
  for (const [seed, level, heat, open] of [[11, 3, 0, false], [907, 8, 2, false], [52, 4, 1, true], [7, 8, 2, true]]) {
    const a = run(seed, level, heat, false, open), b = run(seed, level, heat, true, open);
    assert.equal(b.snap, a.snap, "world " + seed + "/" + level);
    assert.equal(b.evs, a.evs, "events " + seed + "/" + level);
    locks += b.locks;
  }
  assert.ok(locks > 0, "the runs really contain lock-ons (" + locks + " foe-frames)");
});

/* ---- PAUSE freezes the tell in every look ---- */
const fmt = (v) => (typeof v === "number" ? v.toFixed(3) : typeof v === "string" ? v : String(v));
function recCtx() {
  const log = [];
  return { log, ctx: new Proxy({}, { get(o, k) { if (k in o) return o[k]; if (k === "canvas") return { width: 600, height: 520 }; return (...a) => { log.push(k + "(" + a.map(fmt).join(",") + ")"); return k.startsWith("create") ? { addColorStop() {} } : undefined; }; }, set(o, k, v) { log.push(k + "=" + fmt(v)); o[k] = v; return true; } }) };
}
/* the alpha of the first lane under-stroke in a CLASSIC frame log (strokeStyle ROCK is only ever the lane), or null when no lane was drawn */
const laneA = (log) => { const i = log.indexOf("strokeStyle=#0b0e16"); return i < 1 ? null : +log[i - 1].split("=")[1]; };

test("CLASSIC 2D: a locked hunter paints lane chevrons that ramp in, hold still through PAUSE, ramp on after it and fade once the lane closes", () => {
  initFx(); setFxOpts({ flashK: 1 });
  const R2 = recCtx(), r = createRenderer({ width: 600, height: 520, getContext: () => R2.ctx }, { kind: "2d" });
  const w = room(7, 5); hunter(w, "chaser", 3, 5, R(1, 0));
  const frame = () => { R2.log.length = 0; w.time += 1 / 60; r.render(w, 1 / 60); return laneA(R2.log); };
  assert.equal(frame(), null, "first sight: k = 0, nothing drawn");
  frame(); frame();
  const a2 = frame();
  assert.ok(a2 > 0 && a2 < 0.9, "ramping: " + a2);
  w.state = "PAUSE";
  const held = [frame(), frame(), frame()];
  for (let i = 0; i < 60; i++) frame();
  held.push(frame());
  assert.ok(held.every((v) => v === held[0]), "PAUSE holds the lane: " + held.join());
  w.state = "PLAY";
  for (let i = 0; i < 6; i++) frame();
  assert.equal(frame(), 0.495, "full lock after the resume (0.9 x 0.55 under-stroke)");
  w.grid[key(5, 5)] = T.BRICK;
  const out = [frame(), frame(), frame()];
  assert.ok(out[0] < 0.495 && out[2] < out[0], "the lane fades out: " + out.join());
  for (let i = 0; i < 20; i++) frame();
  assert.equal(frame(), null, "and is gone");
});

test("CLASSIC 2D: REDUCE FLASH keeps the same steady chevrons (the tell is information, not a flash)", () => {
  initFx(); setFxOpts({ flashK: 0 });
  const R2 = recCtx(), r = createRenderer({ width: 600, height: 520, getContext: () => R2.ctx }, { kind: "2d" });
  const w = room(7, 5); hunter(w, "fast", 3, 5, R(1, 0));
  let a = null;
  for (let i = 0; i < 12; i++) { R2.log.length = 0; w.time += 1 / 60; r.render(w, 1 / 60); a = laneA(R2.log); }
  setFxOpts({ flashK: 1 });
  assert.equal(a, 0.495);
});

test("PIXEL: lane chevrons in the foe's own pxRamp slots, stepped alpha, frozen with the px clock", () => {
  const V = createView(createAtlas(surfRGBA)); V.shots = createOneShots(); V.parts = [];
  const w = room(7, 5), e = hunter(w, "chaser", 3, 5, R(1, 0)), RP = pxRamp(e.color);
  const draw = (t) => {
    V.t = t; V.dt = 1 / 60;
    const c = createRGBA(300, 260, "#101018").getContext(), f0 = c.fillRect, log = [];
    c.fillRect = function (x, y, w2, h2) { log.push([this.fillStyle, this.globalAlpha]); return f0.call(this, x, y, w2, h2); };
    drawPixelWorld(c, w, V);
    return log;
  };
  const lanePx = (log) => log.filter((q) => q[0] === RP.light).length;
  const alphaOf = (log) => { const q = log.find((q) => q[0] === RP.light); return q ? q[1] : null; };
  draw(1);
  assert.equal(lanePx(draw(1 + 1 / 60)), 0, "below the first step nothing is drawn");
  const half = draw(1 + 4 / 60);
  assert.equal(lanePx(half), 7 * 5, "seven chevrons of five marks for a 4-tile lane");
  const a0 = alphaOf(half);
  assert.ok(a0 === 0.5 || a0 === 0.9, "stepped alpha " + a0);
  for (let i = 0; i < 5; i++) assert.equal(alphaOf(draw(1 + 4 / 60)), a0, "a frozen px clock (PAUSE) holds the step");
  assert.equal(alphaOf(draw(1 + 12 / 60)), 0.9, "full lock");
});

test("REAL 3D: stepFoe crouches the locked hunter down the lane and holds the ramp on a frozen clock; the renderer writes one LANES entry (floor shader uniforms, no mesh)", () => {
  const w = room(7, 5), e = hunter(w, "knight", 3, 5, R(1, 0)), lo = lockOn(w, e), S = makeFoe();
  stepFoe(S, e, 1, 0, null, lo);
  for (let i = 1; i <= 3; i++) stepFoe(S, e, 1 + i / 60, 1 / 60, null, lo);
  const k = S.lk;
  assert.ok(k > 0 && k < 1);
  for (let i = 0; i < 5; i++) stepFoe(S, e, 1 + 3 / 60, 0, null, lo);
  assert.equal(S.lk, k, "frozen clock holds");
  for (let i = 4; i < 20; i++) stepFoe(S, e, 1 + i / 60, 1 / 60, null, lo);
  assert.equal(S.lk, 1);
  const S0 = makeFoe(); stepFoe(S0, e, 2, 0, null, null);
  assert.ok(Math.abs(S.pit - S0.pit) > 0.1 || Math.abs(S.rol - S0.rol) > 0.1, "a forward crouch of LOCK_PIT");
  const r = createRenderer3D(null, null, { audio: null, hud: null });
  const tick = (n) => { for (let i = 0; i < n; i++) { w.time += 1 / 60; r.render(w, 1 / 60); } };
  tick(12);
  assert.equal(LANES.n.value, 1);
  const L = LANES.v.value;
  assert.deepEqual([L[0], L[1], L[2], L[3], L[4]], [e.x - (CFG.COLS * TL) / 2, e.y - (CFG.ROWS * TL) / 2, 1, 0, 3.6 * TL]);
  assert.equal(L[5], 1);
  w.state = "PAUSE"; tick(1);
  w.grid[key(5, 5)] = T.BRICK; tick(30);
  assert.equal(L[5], 1, "PAUSE holds the lane even though the board under it changed");
  w.state = "PLAY"; tick(30);
  assert.equal(LANES.n.value, 0, "a closed lane clears once the ramp out ends");
});
