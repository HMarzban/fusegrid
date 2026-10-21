/* Wall variants (wall round 2026-10-21, THROWAWAY prototype). A pure
   render-side pick over (seed, level, x, y): never world.rng, never written
   back, no sim change. Gen-1 walls class by position:
     border  the outer ring: a plain rampart (ruling), H rows, V columns with
             the shadow strip on the playfield side, four corner pieces;
     pillar  an interior wall present when the renderer first sees this grid
             object: base ~55% / v1 ~23% / v2 ~22%, plus exactly ONE accent per
             room (the pillar with the lowest hash);
     other   any wall that appears later (SHRINK rings) reads 0, the base block.
   The WALL mask is snapshotted on the first call for a new world.grid object
   (the room-start signal ghostTick and PIXEL trackGrid already use) and never
   recomputed for that grid, so a SHRINK wall can never become a pillar or
   steal the accent. A WeakMap keyed by the grid keeps the show, demo and game
   worlds from thrashing one memo. */
import {CFG, T} from "../core/config.js";

export const WV = Object.freeze({BASE: 0, V1: 1, V2: 2, ACC: 3, H: 4, VL: 5, VR: 6, CTL: 7, CTR: 8, CBL: 9, CBR: 10});
export const WALL_VARS = Object.freeze(["base", "v1", "v2", "acc", "h", "vl", "vr", "ctl", "ctr", "cbl", "cbr"]);
export const WV_N = WALL_VARS.length;
const C = CFG.COLS, R = CFG.ROWS;

export function wallHash(seed, level, x, y) {
  let h = ((seed >>> 0) ^ Math.imul(level | 0, 0x9e3779b1) ^ Math.imul(x + 1, 0x85ebca6b) ^ Math.imul(y + 1, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16;
  return h >>> 0;
}
export function borderCode(x, y) {
  const l = x === 0, r = x === C - 1, t = y === 0, b = y === R - 1;
  if (t && l) return WV.CTL; if (t && r) return WV.CTR; if (b && l) return WV.CBL; if (b && r) return WV.CBR;
  if (t || b) return WV.H; if (l) return WV.VL; if (r) return WV.VR;
  return -1;
}
let OVR = null;
/* debug/staging only: f(x, y, code) -> code, applied on the next new grid */
export function setWallOverride(f) { OVR = f || null; }
const MEMO = new WeakMap(), EMPTY = new Uint8Array(C * R);
export function wallCodes(world) {
  const g = world.grid, s = world.seed >>> 0, l = world.level | 0;
  if (!g) return EMPTY;
  const m = MEMO.get(g);
  if (m && m.s === s && m.l === l) return m.out;
  const out = new Uint8Array(C * R);
  let best = -1, bh = 4294967296;
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
    const i = y * C + x;
    if (g[i] !== T.WALL) continue;
    const bc = borderCode(x, y);
    if (bc >= 0) { out[i] = bc; continue; }
    const h = wallHash(s, l, x, y), p = h % 100;
    out[i] = p < 55 ? WV.BASE : p < 78 ? WV.V1 : WV.V2;
    if (h < bh) { bh = h; best = i; }
  }
  if (best >= 0) out[best] = WV.ACC;
  if (OVR) for (let i = 0; i < out.length; i++) if (g[i] === T.WALL) out[i] = OVR(i % C, (i / C) | 0, out[i]);
  MEMO.set(g, {s, l, out});
  return out;
}
