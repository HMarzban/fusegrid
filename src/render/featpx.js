/* THROWAWAY PROTOTYPE (tile art, direction D 2026-10-25): PIXEL cells for the eight floor tiles. Palette-SLOT grids only (./pixel/grid.js format, never hex): every
   char maps to "tile.<BIOMES field>[.step]" through the pinned pxRamp, so each biome bakes its own ramp. 20x20 art px, 1 art px = 2 logical px. The bases are
   DRAFTS generated from the direction D painters (tools/tileart/pxdraft.mjs -> featpxcells.js, a 4x4 mode-snap to the biome ramp); this file composes them (rails,
   caps, rotation, state overlays) and holds the hand corrections (FIX). Kept OUT of src/render/pixel/** on purpose: the px tree has 771 B under its 122 KB cap, so
   wiring waits for the dynamic import (#15); nothing in the game imports this yet (export tool + tests only). Heat never changes a hue: it lives in the grids'
   structure, count, value and tips. VOID never goes past wallHi. */
import {rot90} from "./pixel/grid.js";
import {DPAL, DCELLS} from "./featpxcells.js";
import {GEO} from "./featart/geo.js";

const SIDES = ["N", "E", "S", "W"];
const BS = [["W", "E"], ["N", "S"], ["E", "W"], ["S", "N"]];
const rowsOf = (id) => DCELLS[id].split("|");
const at = (rows, x, y, ch) => { if (y < 0 || y >= rows.length || x < 0 || x >= rows[y].length) return; rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1); };
/* copy the rectangle [x0,x1) x [y0,y1) of src over rows */
const paste = (rows, src, x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) rows[y] = rows[y].slice(0, x0) + src[y].slice(x0, x1) + rows[y].slice(x1); };
const blank = (ch) => Array.from({length: 20}, () => ch.repeat(20));
const clampI = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/* PORTAL: ring distance from the centre 2x2 (0) outward; NW-lit side of a raised ring = north or west of centre */
const ringD = (x, y) => Math.max(Math.abs(x - 9.5), Math.abs(y - 9.5)) - 0.5;
const nwSide = (x, y) => (Math.abs(x - 9.5) >= Math.abs(y - 9.5) ? x < 9.5 : y < 9.5);
const RINGS = [[[5, 4], [3, 2]], [[5, 4], [3, 3], [2, 2]], [[5, 5], [4, 4], [3, 3], [2, 2]]];
const LIT = ["W", "V", "T", "S"], DRK = ["V", "U", "R", "Q"];
function portalRows(h) {
  const rows = blank("O");
  for (let y = 0; y < 20; y++) { let o = ""; for (let x = 0; x < 20; x++) {
    const d = ringD(x, y), nw = nwSide(x, y); let ch = "O";
    if (d >= 9) ch = nw ? "E" : "W";
    else if (d >= 8) ch = "R";
    else if (d >= 6) ch = "G";
    else {
      ch = "G";
      RINGS[h].forEach(([hi, lo], k) => { if (d <= hi && d >= lo) ch = nw ? LIT[k] : DRK[k]; });
      if (d < RINGS[h][RINGS[h].length - 1][1]) ch = d < 1 ? (nw ? "E" : "F") : (nw ? "F" : "E");
    }
    o += ch; } rows[y] = o; }
  return rows;
}
/* STREAM: channel along y=9.5, bank above and below, a taper to a mouth where the run ends; ripples are 3-px dashes (2 / 3 / 4) */
const HWP = [6.25, 5.75, 4.75], BKP = [2.2, 2.1, 1.8];
function streamRows(h, entry, exit) {
  const rows = blank("O"), RP = [[[3, 6], [10, 13]], [[2, 5], [8, 8], [14, 12]], [[1, 5], [6, 7], [11, 11], [16, 8]]][h];
  for (let x = 0; x < 20; x++) {
    const tw = entry ? clampI((x + 1) / 7, 0.45, 1) : 1, te = exit ? clampI((20 - x) / 7, 0.45, 1) : 1, k = Math.min(tw, te), hw = HWP[h] * k, bk = BKP[h];
    for (let y = 0; y < 20; y++) {
      const dy = y - 9.5, a = Math.abs(dy); let ch = "O";
      if (a <= hw) ch = a <= 1.5 ? "F" : a <= hw - 1.8 ? "J" : "K";
      else if (a <= hw + bk) ch = dy < 0 ? "R" : "T";
      if (a <= hw && dy < 0 && a > hw - 1.2) ch = "I";
      rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1);
    }
  }
  for (const [x0, y] of RP) { const yy = y + (h === 2 ? 0 : 0); for (let i = 0; i < 3; i++) { const x = x0 + i, ya = yy + (h === 2 && i === 1 ? -1 : 0); if (rows[ya][x] === "J" || rows[ya][x] === "F" || rows[ya][x] === "K") at(rows, x, ya, "L"); } }
  return rows;
}
/* BOOSTER: a spear-leaf pointing East out of a loam patch; side shoots appear at PLUS (one pair) and MAX (two pairs); flare lifts the leaf one step */
function bloomRows(h, flare) {
  const rows = blank("N");
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    const dx = (x - 10.5) / [8, 8.3, 8.6][h], dy = (y - 9.5) / 6, r = dx ** 4 + dy ** 4;
    if (r <= 1) at(rows, x, y, r > 0.55 ? "F" : "G");
  }
  const lit = flare ? "X" : "L", mid = flare ? "L" : "K", dark = "J", rib = "I";
  const len = [13, 14, 15][h], x0 = 4;
  for (let x = x0; x <= x0 + len; x++) {
    const t = (x - x0) / len, w = Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.04)) * [2.6, 2.4, 2.1][h] * (h === 2 ? 1.05 : 1);
    for (let y = 0; y < 20; y++) { const dy = y - 9.5 + 0.5; if (Math.abs(dy) <= w) at(rows, x, y, dy < -w * 0.35 ? lit : dy > w * 0.45 ? dark : mid); }
    if (t > 0.1 && t < 0.85) at(rows, x, 9, rib);
  }
  for (const [sx, a] of h === 0 ? [] : h === 1 ? [[8, 1]] : [[7, 1], [11, 1.3]]) for (let i = 0; i < 4; i++) { const px = sx + i, py = Math.round(9.5 - a * (i + 1) * 0.9), qy = Math.round(9.5 + a * (i + 1) * 0.9); at(rows, px, py, i === 3 ? lit : mid); at(rows, px, qy, i === 3 ? mid : dark); }
  return rows;
}
const BAND = {N: [0, 0, 20, 4], S: [0, 16, 20, 20], W: [0, 0, 2, 20], E: [18, 0, 20, 20]};
/* hand corrections applied last: id -> [[x, y, ch], ...] (empty until Task 9 review) */
const FIX = {};
export function featPxCell(biome, s) {
  const h = s.h, outer = s.outer || SIDES, d = s.dir || 0;
  let rows, rot = 0;
  if (s.kind === "GLIDE") {
    rows = rowsOf("GLIDE.plate." + h); const one = rowsOf("GLIDE.single." + h);
    for (const sd of ["W", "E", "N", "S"]) if (outer.includes(sd)) paste(rows, one, ...BAND[sd]);
  } else if (s.kind === "BELT") {
    rows = rowsOf("BELT.mid." + h); const one = rowsOf("BELT.single." + h), [wl, el] = BS[d];
    if (outer.includes(wl)) paste(rows, one, ...BAND.W);
    if (outer.includes(el)) paste(rows, one, ...BAND.E);
    rot = d;
  } else if (s.kind === "STREAM") {
    const [wl, el] = BS[d];
    rows = streamRows(h, outer.includes(wl), outer.includes(el));
    rot = d;
  } else if (s.kind === "BLOOM") {
    rows = bloomRows(s.state === 2 ? Math.max(0, h - 1) : h, s.state === 1);
  } else if (s.kind === "PLATE") {
    rows = rowsOf((s.state === 1 ? "PLATE.wind." : "PLATE.idle.") + h);
    if (s.state === 1) {
      const t = GEO.PLATE.lip[h] + 1.6, X = GEO.PLATE.well[0], ix = X + t, iw = GEO.PLATE.well[2] - 2 * t, nw = (iw - 8) / 4 - 1, ny = ix + iw - 3.4;
      for (let i = 0; i < 4; i++) { const nx = ix + 4 + i * (nw + 1), x0 = Math.round(nx / 2), x1 = Math.max(x0 + 1, Math.round((nx + nw) / 2)), y = Math.round(ny / 2); for (let x = x0; x < x1; x++) at(rows, x, y, i < (s.lit | 0) ? "W" : "E"); }
    }
  } else if (s.kind === "QUICK") {
    rows = rowsOf("QUICK.base." + h);
  } else if (s.kind === "PORTAL") {
    rows = portalRows(h);
    const n = Math.max(1, Math.min(3, s.pair || 1)), T = GEO.PORTAL.tick, x0 = Math.round((20 - (n * T.w + (n - 1) * T.g) / 2) / 2);
    for (let i = 0; i < n; i++) { at(rows, x0 + 2 * i, Math.round(T.y / 2), "W"); at(rows, x0 + 2 * i, Math.round(T.y / 2) + 1, "V"); }
  } else if (s.kind === "GATE") {
    const l = s.lit | 0;
    rows = rowsOf("GATE." + (s.state === 1 || l >= 3 ? "shut." : l === 2 ? "half." : "open.") + h);
  }
  for (const [x, y, ch] of FIX[s.kind + "." + h] || []) at(rows, x, y, ch);
  let c = {w: 20, h: 20, rows};
  if (rot) c = rot90(c, rot);
  return {w: 20, h: 20, rows: c.rows.slice(), pal: {...DPAL}};
}
