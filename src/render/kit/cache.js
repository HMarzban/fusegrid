/* KIT LAYER CACHE: static menu parts are painted once into an offscreen canvas and blitted every frame; animated parts draw live on top. A layer is keyed
   by (layer, biome, level, W, H, dpr, look, textScale), so a resize, dpr, world, look or text-scale change misses once. Bytes are w*h*4 per live layer, the total
   stays <= BUDGET (24 MB) by freeing the least recently USED layers first (a hit refreshes recency); one layer larger than BUDGET is still made, and goes first.
   Freed canvases are shrunk to 0x0 so the browser returns the memory. The caller puts capDpr(dpr, touch) into the key. No DOM at import: the canvas factory is
   injectable (tests) and defaults lazily to OffscreenCanvas, else a canvas element. */
export const BUDGET = 24 * 1024 * 1024;
export const _dbg = { misses: 0, bytes: 0, reason: "" };
const live = new Map();
let make = null;

export const setFactory = (fn) => (make = fn);
export const capDpr = (dpr, touch) => (touch ? Math.min(dpr, 2) : dpr);
export const keyOf = (k) => [k.layer, k.biome, k.level, k.W, k.H, k.dpr, k.look, k.textScale].join("|");

function create(w, h) {
  if (make) return make(w, h);
  if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function free(key) {
  const e = live.get(key);
  live.delete(key);
  _dbg.bytes -= e.bytes;
  e.canvas.width = e.canvas.height = 0;
}

export function layer(key, w, h, paint) {
  const k = keyOf(key),
    hit = live.get(k);
  if (hit) {
    live.delete(k);
    live.set(k, hit);
    return hit.canvas;
  }
  _dbg.misses++;
  const bytes = w * h * 4;
  for (const old of [...live.keys()]) {
    if (_dbg.bytes + bytes <= BUDGET) break;
    free(old);
  }
  const canvas = create(w, h);
  live.set(k, { canvas, bytes });
  _dbg.bytes += bytes;
  paint(canvas.getContext("2d"), canvas);
  return canvas;
}

export function release() {
  for (const k of [...live.keys()]) free(k);
}

export function invalidate(reason) {
  release();
  _dbg.reason = reason;
}
