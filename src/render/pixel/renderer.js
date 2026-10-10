/* createPixelRenderer (panel rulings R20-R25): the PIXEL look as its own
   factory, modelled on three/wrapper.js. The world goes to #px through a
   two-step sharp-bilinear blit; #c stays the 600x520 overlay.
     1. drawPixelWorld paints the NATIVE 300x260 board (1 art px = 1 canvas
        px, integer positions, smoothing off).
     2. native -> hi, NEAREST, at the integer M = clamp(floor(k*z),1,8)
        (k = device px per art px, z = the zoom in main's overlay transform).
     3. hi -> #px once, smoothing ON, carrying the device scale, main's intro
        and camera transform (read from the overlay ctx, R23) and the shake
        snapped to even logical px; translation rounded to device px.
   The linear ratio k*z/M stays in [1,2) below the M cap, so the soft edge is
   at most 1 device px. Surface contract mirrors the wrapper:
   {canvas:#px, overlay:#c, ctx:overlay 2D ctx, render, consumeEvents,
    getShake, reset}. Node / no-canvas => stub mode (overlay noop ctx, no
   world draw), so main's shell path never throws. */
import {CFG} from "../../core/config.js";
import {biomeOf} from "../../core/config.js";
import {sfxOf} from "../../audio/item.js";
import {drawHudChips, drawOverlay, overlayBox, drawCoach, drawCoach2} from "../scenes.js";
import {onEvent, updateFx, getShake, getFlash, getFx, feedFx, drawFxOverlay, syncFx} from "../fx.js";
import {createAtlas} from "./atlas.js";
import {createView, resetView, drawPixelWorld, trackGrid} from "./world.js";
import {createOneShots, feedShot} from "./oneshot.js";
import {animClock, newClock} from "./anim.js";
import {NATIVE_W, NATIVE_H, evenShake, kOf, pxM, zOf, finalMatrix} from "./snap.js";

const W = CFG.COLS * CFG.TILE, H = CFG.ROWS * CFG.TILE;
const noop = () => {};
const ID = Object.freeze({a: 1, b: 0, c: 0, d: 1, e: 0, f: 0});

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
  const mk = opts.mkCanvas || defaultMk;
  const probe = pxCanvas && typeof pxCanvas.getContext === "function" ? mk(1, 1) : null;
  const live = !!(probe && probe.getContext);
  const surf = opts.surf || (live ? canvasSurf(mk) : (w, h, rgba) => ({width: w, height: h, data: rgba}));
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  const atlas = createAtlas(surf);
  const bakeMs = (typeof performance !== "undefined" ? performance.now() : 0) - t0;
  const V = createView(atlas);
  V.shots = createOneShots();
  const clock = newClock();
  const native = live ? mk(NATIVE_W, NATIVE_H) : null;
  const nctx = native ? native.getContext("2d") : null;
  let hi = null, hctx = null, hiM = 0;
  const pctx = live ? pxCanvas.getContext("2d", {alpha: false}) : null;
  const mat = [1, 0, 0, 1, 0, 0];
  const stat = {k: 0, M: 0, z: 1, bw: 0, bh: 0, draws: 0, ms: 0};
  const now = () => (typeof performance !== "undefined" ? performance.now() : 0);
  let lastGrid = null, lastWorld = null;

  function reset() { V.shots.reset(); resetView(V); clock.t = 0; clock.w = null; lastGrid = null; lastWorld = null; }

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
    updateFx(dt || CFG.STEP);
  }

  function blitWorld(m) {
    const dpr = (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1;
    const bw = Math.max(1, Math.round((pxCanvas.clientWidth || W) * dpr)), bh = Math.max(1, Math.round((pxCanvas.clientHeight || H) * dpr));
    if (pxCanvas.width !== bw) pxCanvas.width = bw;
    if (pxCanvas.height !== bh) pxCanvas.height = bh;
    const k = kOf(bw), z = zOf(m.a, m.b), M = pxM(k, z);
    if (M !== hiM || !hi) {
      hi = hi || mk(NATIVE_W * M, NATIVE_H * M);
      hi.width = NATIVE_W * M; hi.height = NATIVE_H * M;
      hctx = hi.getContext("2d"); hiM = M;
    }
    hctx.imageSmoothingEnabled = false;
    hctx.drawImage(native, 0, 0, NATIVE_W * M, NATIVE_H * M);
    const sh = getShake();
    finalMatrix(mat, bw, bh, m, evenShake(sh.x), evenShake(sh.y), M);
    pctx.setTransform(1, 0, 0, 1, 0, 0);
    pctx.fillStyle = V.bg;
    pctx.fillRect(0, 0, bw, bh);
    pctx.imageSmoothingEnabled = true;
    pctx.setTransform(mat[0], mat[1], mat[2], mat[3], mat[4], mat[5]);
    pctx.drawImage(hi, 0, 0);
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
    if (world !== lastWorld || world.grid !== lastGrid) { V.shots.reset(); resetView(V); lastWorld = world; lastGrid = world.grid; }
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
      const t1 = now();
      nctx.imageSmoothingEnabled = false;
      stat.draws = drawPixelWorld(nctx, world, V);
      blitWorld(m);
      stat.ms = now() - t1;
    }
    const fl = getFlash();
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
    if (o && o.hud === true) drawHudChips(ovCtx, world, o && o.time);
    if (o && o.hud === true && world.state === "PLAY") drawFxOverlay(ovCtx);
    if (o && o.hud === true) drawCoach(ovCtx, (o && o.coach) || 0);
    if (o && o.hud === true) drawCoach2(ovCtx, (o && o.coach2 && o.coach2.a) || 0, (o && o.coach2 && o.coach2.s) || "");
  }

  const surface = {canvas: pxCanvas, overlay: overlayCanvas, ctx: ovCtx, render, consumeEvents, getShake, reset};
  Object.defineProperty(surface, "_dbg", {enumerable: false, value: {
    get atlas() { return atlas; }, get view() { return V; }, get clock() { return clock; },
    get stat() { return stat; }, get bakeMs() { return bakeMs; }, get native() { return native; }, get hi() { return hi; }}});
  return surface;
}
