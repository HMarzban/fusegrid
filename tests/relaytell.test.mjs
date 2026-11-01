/* BOOSTER relay tell (issue #21): the read-only relayTell rule, its mirror of the real step(), the proof that the sim never sees it, and the draw + PAUSE freeze in
   CLASSIC 2D, PIXEL and REAL 3D. */
import test from "node:test";
import "../src/core/board3.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CFG, T, key, biomeOf } from "../src/core/config.js";
import { createWorld, loadLevel, step, newIntent } from "../src/core/sim.js";
import { POWER } from "../src/core/entities.js";
import { relayTell, drawRelayTell, TELL_IN } from "../src/render/relaytell.js";
import { createRenderer } from "../src/render/renderer.js";
import { initFx, setFxOpts } from "../src/render/fx.js";
import { drawRelayTell as drawPx } from "../src/render/pixel/entities.js";
import { pxRamp } from "../src/render/pixel/palette.js";
import { createRenderer3D } from "../src/render/three/wrapper.js";
import { TELL } from "../src/render/three/groundfx.js";

const TL = CFG.TILE, ctr = (v) => (v + 0.5) * TL, FUSE = [CFG.FUSE, 2.3, 2.1], DELAY = [0, 0.15, 0.3], DT = CFG.STEP;
const mk = (seed, heat) => { const w = createWorld(seed, 1); w.gen = 3; w.heat = heat; loadLevel(w, 1, false); w.state = "PLAY"; return w; };
/* an open gen-3 room: border WALL, interior EMPTY, one booster at (7,5), no foes; the player parked far off */
function room(heat, bx = 7, by = 5) {
  const w = mk(4242, heat);
  for (let y = 1; y < CFG.ROWS - 1; y++) for (let x = 1; x < CFG.COLS - 1; x++) w.grid[key(x, y)] = T.EMPTY;
  w.feat.fill(0); w.featM.fill(0); w.featS.fill(0); w.featPend.length = 0;
  w.enemies.length = 0; w.items.length = 0; w.bombs.length = 0; w.blades.length = 0; w.events.length = 0;
  w.feat[key(bx, by)] = 6;
  const p = w.players[0]; p.x = ctr(1); p.y = ctr(1); p.tx = 1; p.ty = 1; p.iFrames = 1e9;
  return w;
}
const bomb = (w, x, y, o = {}) => { const b = { x: ctr(x), y: ctr(y), tx: x, ty: y, timer: w.fuse, radius: 2, pierce: false, line: false, dir: null, variant: "normal", dead: false, ...o }; w.bombs.push(b); return b; };
const set = (cells) => cells.map((c) => c.x + "," + c.y).sort();
const S = (...a) => a.map(([x, y]) => x + "," + y).sort();

test("reach per heat: the booster tile, +2 on, and 0 / 1 / 2 each side, from the moment the bomb is lit", () => {
  const want = [
    [[7, 5], [8, 5], [9, 5]],
    [[7, 5], [8, 5], [9, 5], [7, 4], [7, 6]],
    [[7, 5], [8, 5], [9, 5], [7, 4], [7, 6], [7, 3], [7, 7]],
  ];
  for (let h = 0; h < 3; h++) {
    const w = room(h); assert.equal(w.fuse, FUSE[h], "fuse at heat " + h);
    bomb(w, 5, 5);
    const c = relayTell(w);
    assert.deepEqual(set(c), S(...want[h]), "heat " + h);
    for (const e of c) { assert.ok(Math.abs(e.t - (FUSE[h] + DELAY[h])) < 1e-9, "fires at fuse + flare: " + e.t); assert.equal(e.hot, false); }
  }
});

test("the arm's own direction sets 'on': a bomb from the east throws west, from the south throws north", () => {
  { const w = room(0); bomb(w, 9, 5); assert.deepEqual(set(relayTell(w)), S([7, 5], [6, 5], [5, 5])); }
  { const w = room(0); bomb(w, 7, 7); assert.deepEqual(set(relayTell(w)), S([7, 5], [7, 4], [7, 3])); }
});

test("no tell: no layer, no bomb, a blast that stops short or at a wall or brick, a bomb on the booster, a booster under a brick", () => {
  const w0 = createWorld(1, 1); loadLevel(w0, 1, false); w0.bombs.push({ tx: 3, ty: 1, timer: 1, radius: 2, dead: false });
  assert.deepEqual(relayTell(w0), [], "gen 1 has no feat layer");
  assert.deepEqual(relayTell(room(2)), [], "no bombs");
  { const w = room(2); bomb(w, 5, 5, { radius: 1 }); assert.deepEqual(relayTell(w), [], "radius 1 stops short"); }
  { const w = room(2); bomb(w, 5, 5); w.grid[key(6, 5)] = T.WALL; assert.deepEqual(relayTell(w), [], "a wall in the arm"); }
  { const w = room(2); bomb(w, 5, 5); w.grid[key(6, 5)] = T.BRICK; assert.deepEqual(relayTell(w), [], "a brick stops a normal blast"); }
  { const w = room(2); bomb(w, 7, 5); assert.deepEqual(relayTell(w), [], "a bomb on the booster does not relay"); }
  { const w = room(0); bomb(w, 5, 5); w.grid[key(7, 5)] = T.BRICK; assert.deepEqual(set(relayTell(w)), S([8, 5], [9, 5]), "the sim breaks the brick before relayCheck, so a booster under the arm's brick still fires; its own brick tile is left out"); }
  { const w = room(2); bomb(w, 5, 5, { dead: true }); assert.deepEqual(relayTell(w), [], "a dead bomb"); }
});

test("relay arms stop at a wall, leave out a brick tile, and never inherit PIERCE or POWER; a pierce or line bomb still reaches through a brick", () => {
  { const w = room(1); bomb(w, 5, 5); w.grid[key(9, 5)] = T.WALL; w.grid[key(7, 4)] = T.WALL; assert.deepEqual(set(relayTell(w)), S([7, 5], [8, 5], [7, 6])); }
  { const w = room(0); bomb(w, 5, 5); w.grid[key(8, 5)] = T.BRICK; assert.deepEqual(set(relayTell(w)), S([7, 5]), "the brick tile is left out and the arm stops there"); }
  { const w = room(0); bomb(w, 5, 5, { radius: 2, pierce: true }); w.grid[key(6, 5)] = T.BRICK; w.grid[key(8, 5)] = T.BRICK; assert.deepEqual(set(relayTell(w)), S([7, 5]), "a pierce bomb arrives, its relay does not pierce"); }
  { const w = room(0); bomb(w, 5, 5, { radius: 5, line: true, dir: { x: 1, y: 0 } }); w.grid[key(6, 5)] = T.BRICK; assert.deepEqual(set(relayTell(w)), S([7, 5], [8, 5], [9, 5])); }
  { const w = room(0); bomb(w, 5, 5, { radius: 5, line: true, dir: { x: -1, y: 0 } }); assert.deepEqual(relayTell(w), [], "a line bomb only fires down its own line"); }
});

test("cooldown and flare: a busy booster is silent only if it stays busy past the fuse; a flare is hot with the time it has left and the pending direction", () => {
  { const w = room(2); bomb(w, 5, 5, { timer: 0.5 }); w.featM[key(7, 5)] = 2; w.featS[key(7, 5)] = 0.9; assert.deepEqual(relayTell(w), [], "still folded at the fuse"); }
  { const w = room(2); bomb(w, 5, 5, { timer: 1.2 }); w.featM[key(7, 5)] = 2; w.featS[key(7, 5)] = 0.9; assert.equal(relayTell(w).length, 7, "reopens before the fuse: it will fire"); }
  const w = room(2), k = key(7, 5);
  w.featM[k] = 1; w.featS[k] = 0.2; w.featPend.push({ k, kind: "bloom", dx: 0, dy: 1 });
  const c = relayTell(w);
  assert.deepEqual(set(c), S([7, 5], [7, 6], [7, 7], [8, 5], [9, 5], [6, 5], [5, 5]));
  for (const e of c) { assert.equal(e.hot, true); assert.ok(Math.abs(e.t - 0.2) < 1e-6); assert.equal(e.k, 1); }
  bomb(w, 5, 5, { timer: 0.5 });
  assert.equal(relayTell(w).filter((e) => e.hot).length, 7, "a second bomb during the flare finds it still busy (0.2 + 1.0 cooldown), so no new reach");
  assert.equal(relayTell(w).length, 7);
});

test("chains and opened bricks are in the answer: a brick one bomb will break lets a later bomb's arm through; a chained bomb fires early", () => {
  { const w = room(0); w.grid[key(6, 5)] = T.BRICK; bomb(w, 5, 5, { timer: 2 }); assert.deepEqual(relayTell(w), []); bomb(w, 6, 4, { timer: 1, radius: 1 }); const c = relayTell(w); assert.deepEqual(set(c), S([7, 5], [8, 5], [9, 5])); assert.equal(c[0].t, 2); }
  { const w = room(0); bomb(w, 5, 5, { timer: 2 }); bomb(w, 5, 3, { timer: 0.5 }); const c = relayTell(w); assert.equal(c.length, 3); for (const e of c) assert.equal(e.t, 0.5, "the bomb at (5,5) is set off at 0.5"); }
});

test("the fade comes from the bomb's own fuse, so it needs no state", () => {
  const w = room(0), b = bomb(w, 5, 5);
  assert.equal(relayTell(w)[0].k, 0);
  b.timer -= TELL_IN / 2;
  assert.ok(Math.abs(relayTell(w)[0].k - 0.5) < 1e-9);
  b.timer -= TELL_IN;
  assert.equal(relayTell(w)[0].k, 1);
});

/* ---- the mirror: what it says on the first tick is what the real step() does, tile for tile, on real gen-3 boards with up to four bombs and no input ---- */
const boosters = (w) => { const o = []; for (let k = 0; k < w.feat.length; k++) if (w.feat[k] === 6) o.push(k); return o; };
function lineCells(w, k) {
  const cx = k % CFG.COLS, cy = (k / CFG.COLS) | 0, o = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const d of [1, 2]) { const x = cx + dx * d, y = cy + dy * d; if (w.grid[key(x, y)] === T.EMPTY) o.push([x, y]); }
  return o;
}
test("mirror: every predicted tile fires and nothing else does, at the predicted time, on real boards at all heats", () => {
  let cases = 0, fired = 0, chains = 0;
  for (let h = 0; h < 3; h++) for (let s = 0; s < 60; s++) {
    const w = mk(710000 + s * 13, h), p = w.players[0];
    w.enemies.length = 1; Object.assign(w.enemies[0], { invuln: true, invulnT: 1e9, speed: 0 }); p.iFrames = 1e9; // one still, unkillable foe: a cleared room would leave PLAY
    let r = 12345 + s * 97 + h;
    const rnd = (n) => { r = (Math.imul(r, 1103515245) + 12345) >>> 0; return (r >>> 8) % n; };
    const bs = boosters(w), n = 1 + rnd(4);
    for (let i = 0; i < n; i++) {
      const cs = lineCells(w, bs[rnd(bs.length)]);
      if (!cs.length) continue;
      const [x, y] = cs[rnd(cs.length)];
      if (w.bombs.some((b) => b.tx === x && b.ty === y)) continue;
      w.bombs.push({ x: ctr(x), y: ctr(y), tx: x, ty: y, timer: 0.4 + rnd(16) / 10, radius: 1 + rnd(3), pierce: false, line: false, dir: null, variant: "normal", dead: false });
    }
    if (!w.bombs.length) continue;
    const pred = relayTell(w), bricks0 = w.grid.slice(), got = new Map(), seen = new Set(), inp = [newIntent()];
    let time = 0, ok = true;
    for (let i = 0; i < 400 && (w.bombs.length || w.featPend.length || i < 2); i++) {
      step(w, DT, inp); time += DT; w.events.length = 0;
      if (w.state !== "PLAY") { ok = false; break; }
      for (const b of w.blades) if (b.src === "relay" && !seen.has(b)) { seen.add(b); for (const t of b.tiles) { const c = key(t.tx, t.ty); if (bricks0[c] !== T.BRICK && !got.has(c)) got.set(c, time); } }
    }
    assert.ok(ok, "stayed in PLAY");
    const label = "heat " + h + " seed " + s;
    assert.deepEqual([...new Set(pred.map((e) => key(e.x, e.y)))].sort((a, b) => a - b), [...got.keys()].sort((a, b) => a - b), label);
    for (const e of pred) assert.ok(Math.abs(got.get(key(e.x, e.y)) - e.t) <= 3 * DT, label + " time " + got.get(key(e.x, e.y)) + " vs " + e.t);
    cases++; fired += pred.length; if (new Set(pred.map((e) => e.t)).size > 1) chains++;
  }
  assert.ok(cases >= 150 && fired >= 300, "the boards really fire relays: " + cases + " cases, " + fired + " tiles");
  assert.ok(chains >= 5, "and really stagger them: " + chains);
});

/* ---- the sim never sees it ---- */
const snap = (w) => JSON.stringify(w, (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v));
test("purity: a call writes nothing, and a run with a call every tick is byte-identical to a run with none (all heats, a bomb every 40 ticks)", () => {
  { const w = room(2); bomb(w, 5, 5); bomb(w, 3, 5, { timer: 1 }); const a = snap(w); relayTell(w); relayTell(w); assert.equal(snap(w), a); }
  for (let h = 0; h < 3; h++) {
    const run = (call) => {
      const w = mk(725000 + h, h), inp = [newIntent()], p = w.players[0];
      p.iFrames = 1e9; let n = 0, H = 0;
      for (let i = 0; i < 1500 && w.state === "PLAY"; i++) {
        inp[0].fire = i % 40 === 0; inp[0].move = { x: Math.sin(i / 70) > 0 ? 1 : -1, y: Math.sin(i / 37) > 0 ? 1 : -1 };
        if (call) n += relayTell(w).length;
        step(w, DT, inp);
      }
      return { s: snap(w), n, H };
    };
    const a = run(false), b = run(true);
    assert.equal(b.s, a.s, "heat " + h);
  }
});
test("the sim does not import the tell", () => {
  for (const f of ["sim", "feat", "world", "board2", "featchecks"]) assert.ok(!readFileSync(new URL("../src/core/" + f + ".js", import.meta.url), "utf8").includes("relaytell"), f);
});

/* ---- the looks ---- */
const fmt = (v) => (typeof v === "number" ? v.toFixed(3) : typeof v === "string" ? v : String(v));
function recCtx() {
  const log = [];
  return { log, ctx: new Proxy({}, { get(o, k) { if (k in o) return o[k]; if (k === "canvas") return { width: 600, height: 520 }; return (...a) => { log.push(k + "(" + a.map(fmt).join(",") + ")"); return k.startsWith("create") ? { addColorStop() {} } : undefined; }; }, set(o, k, v) { log.push(k + "=" + fmt(v)); o[k] = v; return true; } }) };
}
const JUNGLE = biomeOf(1);
test("CLASSIC 2D: no tell = not one ctx call; the mark is wallHi over bg1, never a blast hue; the wash is the flare's only and REDUCE FLASH takes it, not the brackets", () => {
  const R0 = recCtx();
  drawRelayTell(R0.ctx, room(2));
  assert.equal(R0.log.length, 0);
  const w = room(2), b = bomb(w, 5, 5); b.timer -= 1;
  const R1 = recCtx(); drawRelayTell(R1.ctx, w, 1);
  assert.equal(R1.log.filter((l) => l.startsWith("fillRect")).length, 0, "no wash before the flare");
  assert.equal(R1.log.filter((l) => l === "stroke()").length, 14, "two strokes per tile, 7 tiles");
  assert.deepEqual([...new Set(R1.log.filter((l) => l.startsWith("strokeStyle")))].sort(), ["strokeStyle=" + JUNGLE.bg1, "strokeStyle=" + JUNGLE.wallHi].sort());
  const f = room(2), k = key(7, 5);
  f.featM[k] = 1; f.featS[k] = 0.2; f.featPend.push({ k, kind: "bloom", dx: 1, dy: 0 });
  const R2 = recCtx(); drawRelayTell(R2.ctx, f, 1);
  assert.equal(R2.log.filter((l) => l.startsWith("fillRect")).length, 7);
  assert.ok(R2.log.includes("fillStyle=" + JUNGLE.wallHi));
  const R3 = recCtx(); drawRelayTell(R3.ctx, f, 0);
  assert.equal(R3.log.filter((l) => l.startsWith("fillRect")).length, 0, "REDUCE FLASH: no wash");
  assert.equal(R3.log.filter((l) => l === "stroke()").length, 14, "REDUCE FLASH keeps the brackets");
});

const spyItem = (w, x, y, mark) => { const pd = POWER.find((p) => p.t === "fire"), it = { x: ctr(x), y: ctr(y), t: "fire", col: pd.col, buried: false, pdef: pd }; Object.defineProperty(it, "taken", { get() { mark(); return false; } }); w.items.push(it); };
test("CLASSIC 2D renderer: the mark is a floor pass under the pickups, and PAUSE holds the frame's mark byte for byte", () => {
  initFx(); setFxOpts({ flashK: 1 });
  const R = recCtx(), r = createRenderer({ width: 600, height: 520, getContext: () => R.ctx }, { kind: "2d" });
  const w = room(2), b = bomb(w, 5, 5); b.timer -= 0.5;
  let at = -1; spyItem(w, 8, 5, () => { if (at < 0) at = R.log.length; });
  w.time = 1;
  r.render(w, 1 / 60);
  const wh = "strokeStyle=" + JUNGLE.wallHi, first = R.log.indexOf(wh);
  assert.ok(first >= 0, "the mark is drawn");
  assert.ok(at > R.log.lastIndexOf(wh) || at > first, "before drawItems reads the pickup (" + first + " vs " + at + ")");
  const mark = () => { R.log.length = 0; r.render(w, 1 / 60); return R.log.filter((l) => l.startsWith("moveTo") || l.startsWith("lineTo") || l === wh).join(); };
  w.state = "PAUSE";
  const m0 = mark(); assert.ok(m0.length > 0);
  for (let i = 0; i < 30; i++) { w.time += 1 / 60; assert.ok(mark().includes(m0.slice(0, 200))); }
});

function fakePx() {
  const log = [];
  const c = { globalAlpha: 1, fillStyle: "", fillRect(x, y, w, h) { log.push({ x, y, w, h, a: c.globalAlpha, s: c.fillStyle }); } };
  return { c, log };
}
test("PIXEL: no tell = no call; ramp slots of JUNGLE's wallHi only; stepped alpha, frozen with the timers; integer art pixels inside the tile; REDUCE FLASH drops only the wash", () => {
  const A = fakePx(); drawPx(A.c, { flashK: 1 }, room(2)); assert.equal(A.log.length, 0);
  const w = room(2), b = bomb(w, 5, 5), R = pxRamp(JUNGLE.wallHi), draw = (fk = 1) => { const F = fakePx(); drawPx(F.c, { flashK: fk }, w); return F.log; };
  assert.equal(draw().length, 0, "k 0 on the plant frame");
  b.timer -= TELL_IN / 2;
  assert.ok(draw().every((r) => r.a === 0.5), "half way: the low step");
  b.timer -= TELL_IN;
  const L = draw(), S2 = CFG.TILE / 2;
  assert.equal(L.length, 7 * 2 * 8, "7 tiles, 4 brackets of 2 rects, outline + light");
  assert.ok(L.every((r) => r.a === 1), "full once faded in");
  assert.ok(L.every((r) => r.s === R.light || r.s === R.outline));
  assert.ok(L.every((r) => Number.isInteger(r.x) && Number.isInteger(r.y)));
  for (const r of L) { const gx = Math.floor(r.x / S2), gy = Math.floor(r.y / S2); assert.ok(r.x + r.w <= (gx + 1) * S2 && r.y + r.h <= (gy + 1) * S2, "inside the tile"); }
  assert.deepEqual(draw(), L, "the same timers draw the same (PAUSE)");
  const f = room(2), k = key(7, 5);
  f.featM[k] = 1; f.featS[k] = 0.2; f.featPend.push({ k, kind: "bloom", dx: 1, dy: 0 });
  const F1 = fakePx(); drawPx(F1.c, { flashK: 1 }, f);
  const F0 = fakePx(); drawPx(F0.c, { flashK: 0 }, f);
  assert.equal(F1.log.length - F0.log.length, 7, "one wash per tile");
  assert.ok(F0.log.every((r) => r.a === 1), "REDUCE FLASH keeps a flare's brackets full");
});

test("REAL 3D: the feed writes the board texture (no mesh), holds through PAUSE, clears when quiet; both ground shaders read it", () => {
  initFx(); setFxOpts({ flashK: 1 });
  const w = room(2), r = createRenderer3D(null, null, { audio: null, hud: null });
  const at = (x, y) => (y * CFG.COLS + x) * 4, tick = (n) => { for (let i = 0; i < n; i++) { w.time += 1 / 60; r.render(w, 1 / 60); } };
  tick(1);
  assert.equal(TELL.n.value, 0);
  assert.ok(TELL.data.every((v) => v === 0), "all zero with no tell");
  const b = bomb(w, 5, 5); b.timer -= 1;
  tick(1);
  assert.equal(TELL.n.value, 7);
  assert.equal(TELL.data[at(7, 7)], 255);
  assert.equal(TELL.data[at(7, 7) + 1], 0, "no wash before the flare");
  assert.equal(TELL.data[at(6, 7)], 0);
  const v0 = TELL.tex.value.version, d0 = TELL.data.slice();
  w.state = "PAUSE"; tick(30);
  assert.deepEqual(TELL.data, d0, "PAUSE holds it");
  assert.equal(TELL.tex.value.version, v0, "and uploads nothing");
  w.state = "PLAY"; b.dead = true; w.bombs.length = 0; tick(1);
  assert.equal(TELL.n.value, 0);
  assert.ok(TELL.data.every((v) => v === 0), "gone with its bomb");
  const k = key(7, 5); w.featM[k] = 1; w.featS[k] = 9; w.featPend.push({ k, kind: "bloom", dx: 1, dy: 0 });
  tick(1);
  assert.equal(TELL.data[at(7, 5) + 1], 255, "the flare wash");
  setFxOpts({ flashK: 0 }); tick(1);
  assert.equal(TELL.data[at(7, 5) + 1], 0, "REDUCE FLASH takes the wash");
  assert.equal(TELL.data[at(7, 5)], 255, "and keeps the brackets");
  setFxOpts({ flashK: 1 });
  const src = readFileSync(new URL("../src/render/three/groundfx.js", import.meta.url), "utf8");
  assert.equal((src.match(/tellU\(sh\)/g) || []).length, 2, "floorFX and featAO");
  assert.equal((src.match(/\+ TELLS\(/g) || []).length, 2);
});
