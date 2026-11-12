/* v202 swap on ready, lane C: the PIXEL renderer's prepare(job) / activate() contract. */
import test from "node:test";
import assert from "node:assert/strict";
import "../src/core/board3.js";
import { CFG, BIOMES } from "../src/core/config.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { createAtlas, atlasBuilder } from "../src/render/pixel/atlas.js";
import { MANIFEST } from "../src/render/pixel/manifest.js";
import { HEX } from "../src/render/pixel/palette.js";
import { createPixelRenderer } from "../src/render/pixel/renderer.js";
import { setPixelArt, pixelArt } from "../src/render/hudart.js";
import { getFx } from "../src/render/fx.js";
import { surfRGBA } from "../tools/pixel/rgba.mjs";

const job = (world, o = {}) => {
  const log = [];
  let n = 0;
  return { world, log, report: (ph, d, t) => log.push([ph, d, t]), step: () => (o.cancelAt != null && ++n > o.cancelAt ? Promise.reject({ cancelled: true }) : Promise.resolve()) };
};
function rec(w, h, tag) {
  const cv = { width: w, height: h, clientWidth: w, clientHeight: h, tag }, ctx = { canvas: cv, fillStyle: "#000", globalAlpha: 1 };
  for (const k of ["save", "restore", "translate", "scale", "rotate", "clearRect", "beginPath", "closePath", "moveTo", "lineTo", "arc", "fill", "stroke", "fillText", "measureText", "rect", "clip", "strokeRect", "ellipse", "quadraticCurveTo", "bezierCurveTo", "arcTo", "transform", "setLineDash", "strokeText", "fillRect", "drawImage", "setTransform"]) ctx[k] = () => ({ width: 10 });
  ctx.getTransform = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
  ctx.createLinearGradient = ctx.createRadialGradient = () => ({ addColorStop() {} });
  cv.getContext = () => ctx;
  return cv;
}
const live = (surf = surfRGBA) => createPixelRenderer(rec(600, 520, "px"), rec(600, 520, "ov"), { mkCanvas: (w, h) => rec(w, h, "x"), surf });
function room(level = 3, gen = 3) { const w = createWorld(4242, 1); w.gen = gen; loadLevel(w, level); w.state = "PLAY"; return w; }

/* every frame an atlas holds after the same lazy sets are forced, in a fixed walk order, as one FNV-1a hash per frame */
function frames(A) {
  for (let i = 0; i < BIOMES.length; i++) A.tiles(i);
  const out = [], seen = new Set();
  const walk = (v, path) => {
    if (!v || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    if (v.im && v.im.data) { let h = 2166136261; const d = v.im.data; for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619); out.push(path + ":" + v.w + "x" + v.h + "@" + v.ax + "," + v.ay + "#" + (h >>> 0)); }
    for (const k of Object.keys(v)) walk(v[k], path + "." + k);
  };
  for (const k of ["foe", "bomb", "blast", "items", "fx", "shadow"]) walk(A[k], k);
  for (let i = 0; i < BIOMES.length; i++) { const t = A.tiles(i); for (const k of ["wall", "brick", "crumble", "slam", "wallV"]) walk(t[k], "tiles" + i + "." + k); }
  for (const kick of [false, true]) walk(A.mako(HEX.fin, kick), "mako" + kick);
  return out;
}

test("the step builder: every step owns its MANIFEST cells, the total is the manifest", () => {
  const b = atlasBuilder(surfRGBA);
  assert.equal(b.total, MANIFEST.length);
  assert.equal(b.core.concat(b.rest).reduce((s, u) => s + u.n, 0), MANIFEST.length);
  assert.ok(b.core.length + b.rest.length >= 20, "small units: each foe, bomb, blast, items, fx, each biome's tiles, MAKO");
});

test("a prepared atlas is byte-identical to the one-shot atlas", async () => {
  const one = createAtlas(surfRGBA);
  const r = createPixelRenderer(null, null, { surf: surfRGBA });
  await r.prepare(job(room()));
  const a = frames(one), b = frames(r._dbg.atlas);
  assert.ok(a.length > 400, "walked " + a.length + " frames");
  assert.deepEqual(b, a);
  assert.deepEqual([...r._dbg.atlas.pending], [...one.pending]);
});

test("report: bake then warm, done <= total, bake total = MANIFEST, monotonic, ends full", async () => {
  const j = job(room());
  await createPixelRenderer(null, null, { surf: surfRGBA }).prepare(j);
  const bake = j.log.filter((q) => q[0] === "bake"), warm = j.log.filter((q) => q[0] === "warm");
  assert.ok(j.log.every((q) => q[1] <= q[2]));
  assert.ok(bake.every((q) => q[2] === MANIFEST.length));
  assert.ok(bake.every((q, i) => !i || q[1] >= bake[i - 1][1]));
  assert.deepEqual(bake[bake.length - 1], ["bake", MANIFEST.length, MANIFEST.length]);
  assert.deepEqual(warm, [["warm", 1, 1]]);
  assert.equal(j.log.findIndex((q) => q[0] === "warm"), j.log.length - 1);
});

test("construction and prepare touch no shared state; activate does (idempotent)", async () => {
  const sentinel = { sentinel: true };
  setPixelArt(sentinel);
  const fx0 = getFx(); fx0.push({ x: 0, y: 0 });
  const r = live();
  assert.equal(pixelArt(), sentinel);
  assert.equal(getFx(), fx0);
  assert.equal(r._dbg.built, false, "the constructor bakes nothing");
  await r.prepare(job(room()));
  assert.equal(pixelArt(), sentinel);
  assert.equal(getFx(), fx0);
  assert.equal(fx0.length, 1);
  r.activate();
  assert.equal(pixelArt(), r._dbg.atlas);
  assert.equal(getFx().length, 0);
  const fx1 = getFx(); fx1.push({ x: 1, y: 1 });
  r.activate();
  assert.equal(getFx(), fx1, "a second activate does not wipe live fx");
  fx1.length = 0;
  setPixelArt(null);
});

test("the first render after prepare bakes nothing (gen-3 tile room, HUD on)", async () => {
  for (const [level, gen] of [[3, 3], [1, 3], [7, 3], [2, 1]]) {
    let n = 0;
    const r = live((w, h, d) => { n++; return surfRGBA(w, h, d); });
    const w = room(level, gen);
    await r.prepare(job(w));
    r.activate();
    n = 0;
    r.render(w, CFG.STEP, { hud: true });
    assert.equal(n, 0, "room " + level + " gen " + gen + ": " + n + " bakes in the first frame");
    const cold = live((w2, h, d) => { n++; return surfRGBA(w2, h, d); });
    n = 0;
    cold.render(room(level, gen), CFG.STEP, { hud: true });
    assert.ok(n > 0, "control: an unprepared renderer bakes on its first render");
  }
  setPixelArt(null);
});

test("cancel: prepare rejects with {cancelled}, nothing shared, a later render still builds at once", async () => {
  const sentinel = { sentinel: true };
  setPixelArt(sentinel);
  const fx0 = getFx();
  const r = live(), w = room();
  await assert.rejects(r.prepare(job(w, { cancelAt: 5 })), (e) => e && e.cancelled === true);
  assert.equal(pixelArt(), sentinel);
  assert.equal(getFx(), fx0);
  assert.equal(r._dbg.built, false, "a cancelled bake installs no half atlas");
  r.render(w, CFG.STEP, { hud: true });
  assert.equal(r._dbg.active, true);
  assert.equal(pixelArt(), r._dbg.atlas);
  setPixelArt(null);
});

test("back-compat: render without prepare builds and activates on the first frame", () => {
  setPixelArt(null);
  const r = live();
  assert.equal(r._dbg.active, false);
  r.render(room(), CFG.STEP, { hud: true });
  assert.equal(r._dbg.active, true);
  assert.equal(pixelArt(), r._dbg.atlas);
  setPixelArt(null);
});
