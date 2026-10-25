/* PIXEL foes and pickups (2026-10-25): derived frames, 4-phase walk, blink, spawn, death, hover, item pop and collect bursts. */
import test from "node:test";
import assert from "node:assert/strict";
import { CFG, T, key } from "../src/core/config.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { FOES, POWER, spawnEnemy } from "../src/core/entities.js";
import { createAtlas } from "../src/render/pixel/atlas.js";
import { createView, drawPixelWorld } from "../src/render/pixel/world.js";
import { createOneShots, feedShot } from "../src/render/pixel/oneshot.js";
import { animClock, newClock } from "../src/render/pixel/anim.js";
import { passOf, squeeze, stretch, widen, squash, blob, wings, shine, blinkOf, silhouette } from "../src/render/pixel/foegen.js";
import { BURST_CAP } from "../src/render/pixel/entities.js";
import { blinkAt, phaseOf, MOTION, COLLECT_T } from "../src/render/motion.js";
import { fxOf } from "../src/render/entityfx.js";
import { setFxOpts } from "../src/render/fx.js";
import { PX_T } from "../src/render/pixel/timing.js";
import { createRGBA, surfRGBA } from "../tools/pixel/rgba.mjs";
import { createPixelRenderer } from "../src/render/pixel/renderer.js";

const atlas = createAtlas(surfRGBA);
const ctr = (v) => (v + 0.5) * CFG.TILE;
function room() {
  const w = createWorld(4242, 1); loadLevel(w, 1); w.state = "PLAY";
  for (let y = 3; y < 9; y++) for (let x = 3; x < 12; x++) w.grid[key(x, y)] = T.EMPTY;
  w.enemies.length = 0; w.items.length = 0; w.bombs.length = 0; w.blades.length = 0; w.events.length = 0;
  return w;
}
const view = () => { const V = createView(atlas); V.shots = createOneShots(); V.parts = []; return V; };
function draw(w, V, t, dt = 0.05) { V.t = t; V.dt = dt; const c = createRGBA(300, 260, "#101018").getContext(); c.imageSmoothingEnabled = false; drawPixelWorld(c, w, V); return c.calls; }
const imgs = (calls) => calls.filter((q) => q[0] === "drawImage").map((q) => q[5]);
const foe = (type, w, o = {}) => { const e = spawnEnemy(type, 6, 5, 1, null); e.invuln = false; e.invulnT = 0; Object.assign(e, o); w.enemies.push(e); return e; };

const cell = (rows, axis = 5) => ({ w: 10, h: 20, axis, rows: rows.concat(Array(20 - rows.length).fill("..........")), pal: {} });
const pad = (rs) => cell(["", "", ""].map(() => "..........").concat(rs));

test("foegen: pass lifts a foot-row, squeeze/stretch keep 20 rows, widen follows the axis", () => {
  const c = pad(["..oooooo..", ".obbbbbbo.", ".obbbbbbo.", ".obbbbbbo.", ".obbbbbbo.", ".obbbbbbo.", "...kk.kk..", ".......kk."]);
  assert.equal(passOf(c).rows[10], ".".repeat(10));
  assert.equal(passOf(c).rows[9], c.rows[9]);
  assert.equal(squeeze(c).rows.length, 20);
  assert.equal(stretch(c).rows.length, 20);
  assert.equal(squeeze(c).rows.filter((r) => /[^.]/.test(r)).length, c.rows.filter((r) => /[^.]/.test(r)).length - 1);
  const w = widen(c);
  assert.equal(w.w, 12);
  assert.equal(w.axis, 6);
  assert.ok(w.rows.every((r) => r.length === 12));
  assert.equal(squash(c).rows.length, 20);
});

test("foegen: shine shades the lowest sclera px of a 2+ tall eye, blink twins swap both steps, silhouette is one colour", () => {
  const c = cell(["", "", "", "...ee.....", "...ee.....", "...e......", ""].map((r) => r.padEnd(10, ".")));
  const s = shine(c);
  assert.equal(s.rows[3], "...ee.....");
  assert.equal(s.rows[4], "...eE.....");
  assert.equal(s.rows[5], "...E......");
  assert.ok(blinkOf(s).rows.every((r) => !/[eE]/.test(r)));
  assert.equal(blinkOf(cell([])), null);
  assert.ok(silhouette(s, "w").rows.every((r) => /^[.w]*$/.test(r)));
  assert.equal(wings(cell(["...ooooo.."])), null);
  assert.ok(wings(pad(["..oo..oo..", ".obbooobb.", "..bbbbbb.."])).rows[2] === "..oo..oo..");
  assert.ok(blob(c, 0.5).rows.every((r) => r.length === 10));
});

test("every foe bakes its extra frames: walk x4, idle x2 + blink twins, death flash / tint / squash, 3 materialize stages", () => {
  for (const f of FOES) {
    const s = atlas.foe[f.t];
    assert.ok(s.flash && s.tint && s.squash && s.mat.length === 3, f.t);
    assert.ok(s.squash.w > s.stun.w, f.t + " squash is wider than the stun pose");
    if (s.layout === "step" || s.layout === "burrow") {
      assert.equal(s.walk.length, 4, f.t);
      assert.ok(s.walk.every((r) => r.length === 4) && s.idle.every((r) => r.length === 2), f.t);
      assert.equal(new Set(s.walk[2].map((q) => q.im)).size, 4, f.t + " side walk poses");
      assert.equal(s.walk[0][1].ay, s.walk[0][0].ay + (f.t === "fast" ? 0 : 1), f.t + " pass frames sit 1 art px higher");
    }
  }
  assert.ok(atlas.foe.walker.walk[0][0].blink && atlas.foe.shade.still[0].blink, "eyes carry a blink twin");
  assert.equal(atlas.foe.rocket.face[0].length, 3);
  assert.equal(atlas.foe.stationary.still.length, 3);
  assert.equal(atlas.foe.shade.still.length, 3);
});

test("a walker's four phases appear in order as it covers ground, and blink swaps the face for the twin only at the hashed beat", () => {
  const w = room(), V = view(), e = foe("walker", w, { dir: { x: 1, y: 0 } }), st = atlas.foe.walker, seen = [];
  for (let i = 0; i < 60; i++) { e.x += 3; const ims = imgs(draw(w, V, 1 + i * 0.05)); const k = st.walk[2].findIndex((f) => ims.includes(f.im)); if (k >= 0 && seen[seen.length - 1] !== k) seen.push(k); }
  assert.deepEqual(seen.slice(0, 5), [0, 1, 2, 3, 0], seen.join());
  const w2 = room(), V2 = view(), e2 = foe("walker", w2), ph = phaseOf("walker", e2.home);
  let on = 0, off = 0;
  for (let i = 0; i < 400; i++) { const t = i * 0.05, ims = imgs(draw(w2, V2, t)), b = blinkAt("walker", ph, t) > 0.5, has = st.idle.some((r) => r.some((f) => f.blink && ims.includes(f.blink.im))); if (b) { on++; assert.ok(has, "blink at " + t); } else { off++; assert.ok(!has, "open at " + t); } }
  assert.ok(on > 0 && off > on);
});

test("deterministic and PAUSE-frozen: the same clock draws the same board, the anim clock does not move in PAUSE", () => {
  const w = room(); foe("shade", w); foe("rocket", w, { x: ctr(8), y: ctr(5) }); foe("fast", w, { x: ctr(4), y: ctr(5) });
  const V = view(), a = draw(w, V, 3.3).map((q) => q.slice(0, 5).join()).join("|"), b = draw(w, V, 3.3).map((q) => q.slice(0, 5).join()).join("|");
  assert.equal(a, b);
  const clk = newClock(); w.time = 1; animClock(clk, w); w.time = 1.2; const t1 = animClock(clk, w);
  w.state = "PAUSE"; w.time = 9; const t2 = animClock(clk, w); w.time = 15; const t3 = animClock(clk, w);
  assert.ok(t1 > 0 && t2 === t1 && t3 === t1);
  assert.equal(draw(w, V, t2).map((q) => q.slice(0, 5).join()).join("|"), draw(w, V, t3).map((q) => q.slice(0, 5).join()).join("|"));
});

test("spawn: blob, scaled, then the real frame with a small stepped floor ring that is gone after the pop; the sim's own invulnT drives it", () => {
  const w = room(), V = view(), e = foe("knight", w, { invuln: true, invulnT: 1.2 }), st = atlas.foe.knight;
  const at = (left) => { e.invulnT = left; e.invuln = left > 0; const c = draw(w, V, 5); return { ims: imgs(c) }; };
  let r = at(1.2);
  const ring = r.ims.length;
  assert.ok(r.ims.includes(st.mat[0].im), "starts as the small blob");
  r = at(1.2 - 0.03);
  assert.ok(r.ims.includes(st.mat[1].im), "scaled stage");
  r = at(0.5);
  assert.ok(!r.ims.includes(st.mat[0].im) && r.ims.length === ring - 1, "the floor ring (one stepped cell) is gone after the pop");
  r = at(0);
  assert.ok(!st.mat.some((f) => r.ims.includes(f.im)));
  const alphas = new Set();
  for (let i = 0; i < 40; i++) { e.invulnT = 1.2 - i * 0.03; e.invuln = true; const c = draw(w, V, 5); c.filter((q) => q[0] === "drawImage").forEach((q) => alphas.add(q[4])); }
  assert.ok([...alphas].every((a) => [0.5, 0.75, 1, 0.3, 0.7, 0.4].includes(a) || a >= 0.25), [...alphas].join());
});

test("death: flash on the first frame, the stun pose, a wide-low squash, then the puff; REDUCE FLASH swaps the white flash for a tint", () => {
  for (const flashK of [1, 0.3]) {
    setFxOpts({ flashK });
    const w = room(), V = view(); feedShot(V.shots, { t: "kill", x: ctr(6), y: ctr(5), color: "#8affc1", type: "walker" }, w, 0);
    const s = atlas.foe.walker, at = (t) => imgs(draw(w, V, t));
    assert.ok(at(0).includes(flashK < 1 ? s.tint.im : s.flash.im), "frame 0, flashK " + flashK);
    assert.ok(!at(0).includes(flashK < 1 ? s.flash.im : s.tint.im));
    assert.ok(at(0.02).includes(s.stun.im) && !at(0.02).includes(s.flash.im), "the stun pose holds just after the flash");
    assert.ok(at(0.08).includes(s.squash.im), "then the wide-low squash");
    assert.ok(at((PX_T.STUN_MS + 5) / 1000).some((im) => atlas.fx.puff.walker.some((f) => f.im === im)));
    assert.ok(!at(0.5).includes(s.squash.im));
  }
  setFxOpts({ flashK: 1 });
  const lum = (f) => { let n = 0, on = 0; for (let i = 0; i < f.im.data.length; i += 4) if (f.im.data[i + 3]) { on++; if (f.im.data[i] > 235 && f.im.data[i + 1] > 235) n++; } return n / on; };
  for (const f of FOES) assert.ok(lum(atlas.foe[f.t].tint) < 0.6 && lum(atlas.foe[f.t].flash) > 0.9, f.t);
});

test("pickups hover within 1 art px of the floor spot; a revealed pickup pops in, one already on the floor never does", () => {
  const w = room(), V = view(), p = POWER[0], it = { x: ctr(6), y: ctr(5), t: p.t, col: p.col, taken: false, buried: false }; w.items.push(it);
  const g = atlas.items.glyph[p.t], ys = new Set();
  for (let i = 0; i < 80; i++) { const q = draw(w, V, i * 0.1).find((c) => c[0] === "drawImage" && c[5] === g.im); ys.add(q[2]); }
  assert.ok(ys.size >= 2 && ys.size <= 3 && Math.max(...ys) - Math.min(...ys) <= 2, [...ys].join());
  const late = { x: ctr(8), y: ctr(5), t: "heart", col: "#ff4d6d", taken: false, buried: false }; w.items.push(late);
  const first = imgs(draw(w, V, 20)), later = imgs(draw(w, V, 20.3));
  assert.ok(first.includes(atlas.items.glyph.heart.im) && !first.includes(atlas.items.well.im) || first.filter((im) => im === atlas.items.well.im).length === 1, "pop frame has no well for the new item");
  assert.equal(later.filter((im) => im === atlas.items.well.im).length, 2);
});

test("collect bursts: per-kind marks, capped, whole art px, gone after COLLECT_T, and they never take a one-shot slot", () => {
  for (const p of POWER) {
    const w = room(), V = view(), ev = { t: "power", x: ctr(6), y: ctr(5), col: p.col, kind: p.t };
    fxOf(w, "px").feed([ev], 0); feedShot(V.shots, ev, w, 0);
    assert.equal(V.shots.count(), 0, p.t);
    let most = 0;
    for (let i = 0; i < 8; i++) {
      const fr = draw(w, V, i * 0.06).filter((q) => q[0] === "fillRect");
      most = Math.max(most, fr.length);
      assert.ok(fr.every((q) => q.slice(1).every(Number.isInteger)), p.t);
    }
    const base = draw(w, V, COLLECT_T + 0.2).filter((q) => q[0] === "fillRect").length;
    assert.ok(most > base && most <= BURST_CAP * 4 + 40, p.t + " " + most + " " + base);
  }
  const w = room(), V = view(); for (let i = 0; i < 12; i++) fxOf(w, "px").feed([{ t: "power", x: ctr(6), y: ctr(5), col: "#ffd447", kind: "fire" }], 0);
  const n = draw(w, V, 0.05).filter((q) => q[0] === "fillRect").length;
  assert.ok(n <= BURST_CAP * 3 + 40, "capped " + n);
  assert.equal(draw(w, V, COLLECT_T + 0.1).filter((q) => q[0] === "fillRect").length, 0);
});

test("a kill puff is never evicted by pickup bursts (they live outside the 96-slot pool)", () => {
  const w = room(), V = view(); feedShot(V.shots, { t: "kill", x: ctr(6), y: ctr(5), color: "#8affc1", type: "walker" }, w, 0);
  for (let i = 0; i < 200; i++) feedShot(V.shots, { t: "power", x: ctr(6), y: ctr(5), col: "#ffd447", kind: "fire" }, w, 0);
  assert.equal(V.shots.count(), 1);
});

test("hunters lean toward MAKO by at most 1 art px; MOTION spec constants the px look relies on are unchanged", () => {
  assert.equal(MOTION.SPAWN_T, 1.2); assert.equal(MOTION.DEATH_T, 0.35); assert.equal(COLLECT_T, 0.5);
  const w = room(), V = view(), e = foe("chaser", w, { speed: 0 }), p = w.players[0];
  p.x = e.x + CFG.TILE; p.y = e.y; p.alive = true;
  const all = new Set(atlas.foe.chaser.idle.flat().flatMap((f) => [f.im, f.blink && f.blink.im])), xs = [];
  for (const near of [false, true]) { p.x = near ? e.x + CFG.TILE : e.x + CFG.TILE * 6; const q = draw(w, V, 2).find((c) => c[0] === "drawImage" && all.has(c[5])); xs.push(q ? q[1] : null); }
  assert.ok(xs[0] !== null && xs[1] !== null && Math.abs(xs[1] - xs[0]) <= 1 && xs[1] >= xs[0], xs.join());
});

test("renderer level: PLAY, then PAUSE with world.time running on, two renders draw the identical board", () => {
  const log = []; let n = 0;
  const rec = (w, h, tag) => { const cv = {width: w, height: h, clientWidth: 829, clientHeight: 718}, ctx = { imageSmoothingEnabled: true, globalAlpha: 1, fillStyle: "#000", getTransform: () => ({a: 1, b: 0, c: 0, d: 1, e: 0, f: 0}), putImageData() {}, setTransform() {} };
    for (const k of ["save", "restore", "translate", "scale", "rotate", "clearRect", "beginPath", "closePath", "moveTo", "lineTo", "arc", "fill", "stroke", "fillText", "measureText", "rect", "clip", "strokeRect", "ellipse", "quadraticCurveTo", "bezierCurveTo", "arcTo", "transform", "setLineDash", "strokeText"]) ctx[k] = () => ({ width: 10 });
    ctx.fillRect = (...a) => log.push([tag, "fillRect", a, ctx.fillStyle, ctx.globalAlpha]);
    ctx.drawImage = (src, ...a) => log.push([tag, "drawImage", a, src && src.tag, ctx.globalAlpha]);
    ctx.createLinearGradient = ctx.createRadialGradient = () => ({ addColorStop() {} });
    cv.getContext = () => ctx; cv.tag = tag; return cv; };
  const mk = (w, h) => rec(w, h, ["probe", "native", "hi"][n++] || "x");
  const r = createPixelRenderer(rec(600, 520, "px"), rec(600, 520, "ov"), { mkCanvas: mk, surf: surfRGBA });
  const w = room(); foe("shade", w); foe("walker", w, { x: ctr(8), y: ctr(5), invuln: true, invulnT: 0.8 }); foe("fast", w, { x: ctr(4), y: ctr(6) });
  w.items.push({ x: ctr(5), y: ctr(4), t: "fire", col: "#ff6b3d", taken: false, buried: false });
  w.events.push({ t: "power", x: ctr(7), y: ctr(7), col: "#ff6b3d", kind: "fire" }, { t: "kill", x: ctr(9), y: ctr(4), type: "walker", color: "#8affc1" });
  for (let i = 0; i < 3; i++) { w.time += CFG.STEP * 3; r.render(w, CFG.STEP, { hud: true }); }
  w.state = "PAUSE";
  const nat = () => log.filter((q) => q[0] === "native").map((q) => JSON.stringify(q.slice(1)));
  log.length = 0; w.time += 7.3; r.render(w, CFG.STEP, { hud: true }); const a = nat();
  log.length = 0; w.time += 11.1; r.render(w, CFG.STEP, { hud: true }); const b = nat();
  assert.ok(a.length > 100);
  assert.deepEqual(a, b);
});
