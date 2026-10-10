/* createPixelRenderer (panel rulings R20-R25): the PIXEL look as its own
   factory, modelled on three/wrapper.js. The world goes to #px through a
   two-step sharp-bilinear blit; #c stays the 600x520 overlay.
     1. drawPixelWorld paints the NATIVE 300x260 board (1 art px = 1 canvas
        px, integer positions, smoothing off).
     2. native -> hi, NEAREST, at the integer M = snap.js pxM: ceil(k*z),
        clamped 1..8 (k = device px per art px, z = the zoom in main's overlay
        transform).
     3. hi -> #px once, smoothing ON (quality low, so no mipmap filter),
        carrying the device scale, main's intro and camera transform (read
        from the overlay ctx, R23) and the shake snapped to even logical px;
        translation rounded to device px.
   The smooth step is a downscale at k*z/M in (0.5,1] below the M cap, so the
   soft edge is at most 1 device px. The #px backing comes from fit.js
   (data-bw / data-bh, the device-px-snapped content box), so the browser
   composites it 1:1; clientWidth x dpr is only the fallback (fit's pxCap
   only lowers that backing density, never the board's CSS size). A smaller
   M draws into the hi canvas's top-left sub-rect (cleared once on the drop),
   and its last column and row are copied one px outward so the smooth step
   samples the edge, never the cleared margin; once M sits below hiCap-1 for
   SHRINK_N renders the hi canvas is re-allocated at M (the intro zoom no
   longer pins ~20 MB). #px is filled only in the 0-4 margin strips the
   transformed hi rect leaves uncovered (the board itself is opaque); a skew,
   a non-positive scale or a frame with no grid fills the whole backing.
   setPerf(K) arms render-on-change: the board raster (drawPixelWorld + blit)
   is skipped while its signature holds (world, grid, state, level, the anim
   clock, events, live particles, the even shake, the overlay matrix, the
   backing, pop, ghost, K.epoch), forced every FORCE_MS; events and the
   overlay still run every frame. sleep() drops hi and #px to 1x1 (atlas
   kept); the next raster regrows them. Construction calls
   initFx(), as the classic factory does. PAUSE freezes the whole board (R16):
   the anim clock stops, updateFx is skipped so particles hold still, and the
   shake and the flash wash read as zero until PLAY resumes them; a new grid
   straight out of PAUSE (RESTART, QUIT) drops that held shake and flash.
   Surface contract mirrors the wrapper: {canvas:#px, overlay:#c, ctx:overlay
   2D ctx, render, consumeEvents, getShake, reset, setPerf, invalidate,
   sleep}. Node / no-canvas => stub mode (overlay noop ctx, no world draw),
   so main's shell path never throws. */
import {CFG, biomeOf} from "../../core/config.js";
import {sfxOf} from "../../audio/item.js";
import {drawHudChips, drawOverlay, overlayBox, drawCoach, drawCoach2} from "../scenes.js";
import {onEvent, updateFx, getShake as fxShake, getFlash, getFx, feedFx, drawFxOverlay, syncFx, initFx} from "../fx.js";
import {createAtlas} from "./atlas.js";
import {setPixelArt, hudIcon} from "./hudart.js";
import {createView, resetView, drawPixelWorld, trackGrid} from "./world.js";
import {createOneShots, feedShot} from "./oneshot.js";
import {animClock, newClock} from "./anim.js";
import {NATIVE_W, NATIVE_H, evenShake, kOf, pxM, zOf, finalMatrix} from "./snap.js";

const W = CFG.COLS * CFG.TILE, H = CFG.ROWS * CFG.TILE;
const noop = () => {};
const ID = Object.freeze({a: 1, b: 0, c: 0, d: 1, e: 0, f: 0}), STILL = Object.freeze({x: 0, y: 0});
export const SHRINK_N = 120, FORCE_MS = 500;
const EPS = 1e-6;

function makeOverlayCtx(canvas) {
  if (canvas && canvas.getContext) return canvas.getContext("2d", {alpha: true});
  return {save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
    fillRect: noop, strokeRect: noop, clearRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, arcTo: noop, bezierCurveTo: noop,
    quadraticCurveTo: noop, fill: noop, stroke: noop, ellipse: noop, transform: noop,
    createLinearGradient: () => ({addColorStop: noop}),
    createRadialGradient: () => ({addColorStop: noop}),
    drawImage: noop, fillText: noop, strokeText: noop, setTransform: noop};
}
function defaultMk(w, h) {
  if (typeof document !== "undefined" && document && document.createElement) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  return null;
}
function canvasSurf(mk) {
  return (w, h, rgba) => {
    const c = mk(w, h), x = c && c.getContext && c.getContext("2d");
    if (x && x.putImageData && typeof ImageData !== "undefined") x.putImageData(new ImageData(rgba, w, h), 0, 0);
    return c || {width: w, height: h, data: rgba};
  };
}

export function createPixelRenderer(pxCanvas, overlayCanvas, opts = {}) {
  const ovCtx = makeOverlayCtx(overlayCanvas);
  const audio = opts.audio || null;
  initFx();
  const getShake = opts.getShake || fxShake;
  const mk = opts.mkCanvas || defaultMk;
  const probe = pxCanvas && typeof pxCanvas.getContext === "function" ? mk(1, 1) : null;
  const live = !!(probe && probe.getContext);
  const surf = opts.surf || (live ? canvasSurf(mk) : (w, h, rgba) => ({width: w, height: h, data: rgba}));
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  const atlas = createAtlas(surf);
  setPixelArt(atlas);
  const hudIco = hudIcon(atlas);
  const bakeMs = (typeof performance !== "undefined" ? performance.now() : 0) - t0;
  const V = createView(atlas);
  V.shots = createOneShots();
  const clock = newClock();
  const native = live ? mk(NATIVE_W, NATIVE_H) : null;
  const nctx = native ? native.getContext("2d") : null;
  let hi = null, hctx = null, hiM = 0, hiCap = 0, shrinkN = 0;
  const pctx = live ? pxCanvas.getContext("2d", {alpha: false}) : null;
  const mat = [1, 0, 0, 1, 0, 0];
  const stat = {k: 0, M: 0, z: 1, bw: 0, bh: 0, draws: 0, ms: 0, rasters: 0, skips: 0, fills: 0};
  const now = opts.now || (() => (typeof performance !== "undefined" ? performance.now() : 0));
  let lastGrid = null, lastWorld = null, wasPaused = false;
  let armed = false, perf = null, ep, inv = true, lastR = -Infinity, BW = 0, BH = 0;
  const sig = [];

  function reset() { V.shots.reset(); resetView(V); clock.t = 0; clock.w = null; lastGrid = null; lastWorld = null; inv = true; }
  function setPerf(K) { armed = true; perf = K || perf; const e = K && K.epoch; if (e !== ep) { ep = e; inv = true; } }
  function invalidate() { inv = true; }
  function sleep() {
    if (hi) { hi.width = 1; hi.height = 1; }
    hiCap = 0; hiM = 0; shrinkN = 0; inv = true;
    if (live) { pxCanvas.width = 1; pxCanvas.height = 1; }
  }
  function backing() {
    const ds = pxCanvas.dataset, fw = ds && +ds.bw, fh = ds && +ds.bh, dpr = (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1;
    BW = fw > 0 ? fw : Math.max(1, Math.round((pxCanvas.clientWidth || W) * dpr));
    BH = fh > 0 ? fh : Math.max(1, Math.round((pxCanvas.clientHeight || H) * dpr));
  }
  function changed(v) {
    let d = false;
    for (let i = 0; i < v.length; i++) if (sig[i] !== v[i]) { sig[i] = v[i]; d = true; }
    return d;
  }

  function consumeEvents(world, dt, playSfx = true) {
    syncFx(world);
    feedFx(world, dt || CFG.STEP);
    for (let i = 0; i < world.events.length; i++) {
      const ev = world.events[i];
      onEvent(world, ev, world.time);
      feedShot(V.shots, ev, world, clock.t);
      if (audio && playSfx !== false) audio.play(sfxOf(ev));
    }
    world.events.length = 0;
    if (world.state !== "PAUSE") updateFx(dt || CFG.STEP);
  }

  function fillBack(bw, bh, hw, hh, full) {
    pctx.fillStyle = V.bg;
    if (full || mat[1] || mat[2] || !(mat[0] > 0) || !(mat[3] > 0)) { pctx.fillRect(0, 0, bw, bh); stat.fills = 1; return; }
    const x1 = mat[4] + mat[0] * hw, y1 = mat[5] + mat[3] * hh;
    const l = Math.min(bw, Math.max(0, Math.ceil(mat[4]))), t = Math.min(bh, Math.max(0, Math.ceil(mat[5])));
    const r = Math.max(l, Math.min(bw, x1 >= bw - EPS ? bw : Math.floor(x1))), b = Math.max(t, Math.min(bh, y1 >= bh - EPS ? bh : Math.floor(y1)));
    let n = 0;
    if (t > 0) { pctx.fillRect(0, 0, bw, t); n++; }
    if (b < bh) { pctx.fillRect(0, b, bw, bh - b); n++; }
    if (l > 0 && b > t) { pctx.fillRect(0, t, l, b - t); n++; }
    if (r < bw && b > t) { pctx.fillRect(r, t, bw - r, b - t); n++; }
    stat.fills = n;
  }

  function blitWorld(m, sx, sy, bw, bh, full) {
    if (pxCanvas.width !== bw) pxCanvas.width = bw;
    if (pxCanvas.height !== bh) pxCanvas.height = bh;
    const k = kOf(bw), z = zOf(m.a, m.b), M = pxM(k, z), hw = NATIVE_W * M, hh = NATIVE_H * M;
    if (!hi || M > hiCap || shrinkN >= SHRINK_N) {
      hi = hi || mk(hw, hh);
      hi.width = hw; hi.height = hh;
      hctx = hi.getContext("2d"); hiCap = M; shrinkN = 0;
    } else if (M < hiM) hctx.clearRect(0, 0, hi.width, hi.height);
    hiM = M;
    hctx.imageSmoothingEnabled = false;
    hctx.drawImage(native, 0, 0, hw, hh);
    if (M < hiCap) { hctx.drawImage(hi, hw - 1, 0, 1, hh, hw, 0, 1, hh); hctx.drawImage(hi, 0, hh - 1, hw + 1, 1, 0, hh, hw + 1, 1); }
    finalMatrix(mat, bw, bh, m, sx, sy, M);
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    fillBack(bw, bh, hw, hh, full);
    pctx.imageSmoothingEnabled = true;
    pctx.imageSmoothingQuality = "low";
    pctx.setTransform(mat[0], mat[1], mat[2], mat[3], mat[4], mat[5]);
    if (M === hiCap) pctx.drawImage(hi, 0, 0);
    else pctx.drawImage(hi, 0, 0, hw, hh, 0, 0, hw, hh);
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    stat.k = k; stat.M = M; stat.z = z; stat.bw = bw; stat.bh = bh;
  }

  /* CLASSIC parity: WIN/LOSE confetti also lands OVER the veil, as whole
     art px (even logical px), no alpha. */
  function drawPartsOver(ps) {
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i], s = Math.max(1, Math.round((p.size || 2) / 2));
      ovCtx.fillStyle = p.color;
      ovCtx.fillRect(2 * (Math.round(p.x / 2) - (s >> 1)), 2 * (Math.round(p.y / 2) - (s >> 1)), 2 * s, 2 * s);
    }
  }

  function render(world, dt, o) {
    if (!world) return;
    const paused = world.state === "PAUSE", ev = world.events.length > 0;
    if (world !== lastWorld || world.grid !== lastGrid) { V.shots.reset(); resetView(V); if (wasPaused) initFx(); lastWorld = world; lastGrid = world.grid; }
    wasPaused = paused;
    animClock(clock, world);
    consumeEvents(world, dt, !(o && o.sfx === false));
    V.t = clock.t; V.dt = clock.dt;
    V.shots.expire(V.t);
    trackGrid(V, world);
    V.ghost = (o && o.ghost) || null;
    V.pop = o && o.pop != null ? o.pop : null;
    V.parts = getFx();
    V.bg = biomeOf(world.level).bg1;
    const m = ovCtx.getTransform ? ovCtx.getTransform() : ID;
    if (ovCtx.setTransform) { ovCtx.save(); ovCtx.setTransform(1, 0, 0, 1, 0, 0); ovCtx.clearRect(0, 0, W, H); ovCtx.restore(); }
    if (nctx) {
      const t1 = now(), sh = paused ? STILL : getShake(), sx = evenShake(sh.x), sy = evenShake(sh.y), g = o && o.ghost;
      backing();
      const bw = BW, bh = BH, M = pxM(kOf(bw), zOf(m.a, m.b));
      shrinkN = hi && M < hiCap - 1 ? shrinkN + 1 : 0;
      const d = changed([world, world.grid, world.state, world.level, clock.t, V.parts.length, sx, sy, m.a, m.b, m.c, m.d, m.e, m.f, bw, bh, V.pop, g ? g.x : null, g ? g.y : null]);
      if (!armed || d || inv || ev || shrinkN >= SHRINK_N || (!paused && V.parts.length > 0) || (o && o.intro != null) || t1 - lastR >= FORCE_MS) {
        const full = !world.grid || !stat.rasters;
        inv = false; lastR = t1;
        nctx.imageSmoothingEnabled = false;
        stat.draws = drawPixelWorld(nctx, world, V);
        blitWorld(m, sx, sy, bw, bh, full);
        stat.ms = now() - t1; stat.rasters++;
      } else stat.skips++;
    }
    const fl = paused ? 0 : getFlash();
    if (fl > 0) {
      ovCtx.globalAlpha = fl * 0.28;
      ovCtx.fillStyle = "#ffe8a8";
      ovCtx.fillRect(0, 0, W, H);
      ovCtx.globalAlpha = 1;
    }
    if (world.state !== "PLAY") {
      const B = overlayBox("2d");
      drawOverlay(ovCtx, world, B.w, B.h, B.cx, B.cy, o && o.pause, o && o.time, o && o.run, o && o.toast);
      if (world.state === "WIN" || world.state === "LOSE") drawPartsOver(V.parts);
    }
    if (o && o.hud === true) drawHudChips(ovCtx, world, o && o.time, hudIco);
    if (o && o.hud === true && world.state === "PLAY") drawFxOverlay(ovCtx);
    if (o && o.hud === true) drawCoach(ovCtx, (o && o.coach) || 0);
    if (o && o.hud === true) drawCoach2(ovCtx, (o && o.coach2 && o.coach2.a) || 0, (o && o.coach2 && o.coach2.s) || "");
  }

  if (opts.perf) setPerf(opts.perf);
  const surface = {canvas: pxCanvas, overlay: overlayCanvas, ctx: ovCtx, render, consumeEvents, getShake, reset, setPerf, invalidate, sleep};
  Object.defineProperty(surface, "_dbg", {enumerable: false, value: {
    get atlas() { return atlas; }, get view() { return V; }, get clock() { return clock; },
    get stat() { return stat; }, get bakeMs() { return bakeMs; }, get native() { return native; }, get hi() { return hi; },
    get hiCap() { return hiCap; }, get armed() { return armed; }, get perf() { return perf; }}});
  return surface;
}
