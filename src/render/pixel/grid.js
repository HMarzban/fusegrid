/* Palette-slot string grids. A cell is {w,h,rows,axis?,anchor?,pal?,author?}:
   rows are h strings of w chars, "." is transparent, every other char is a
   key of the cell's pal (or its sheet's pal) whose value is a slot string
   (palette.js). axis is the mirror COLUMN (default floor(w/2)); flipX mirrors
   about it, never about the cell edge, so an odd-width body keeps its centre
   pixel. anchor [ax,ay] is the pixel placed on an entity's art position
   (default [axis, h-10], so 20- and 24-tall cells share a foot line).
   Everything here runs at bake time only and is pure. */
import {resolveSlot, rgbOf} from "./palette.js";

export const axisOf = (c) => (c.axis != null ? c.axis : c.w >> 1);
export const anchorOf = (c) => (c.anchor ? c.anchor : [axisOf(c), c.h - 10]);

export function validateCell(cell, pal) {
  const errs = [];
  if (!cell || !Array.isArray(cell.rows)) return ["no rows"];
  const P = {...(pal || {}), ...(cell.pal || {})};
  if (!(cell.w > 0 && cell.h > 0)) errs.push("bad w/h");
  if (cell.rows.length !== cell.h) errs.push("rows " + cell.rows.length + " != h " + cell.h);
  const ax = axisOf(cell);
  if (!(ax >= 0 && ax < cell.w)) errs.push("axis out of range");
  cell.rows.forEach((r, y) => {
    if (typeof r !== "string" || r.length !== cell.w) errs.push("row " + y + " width " + (r && r.length));
    else for (const ch of r) if (ch !== "." && !(ch in P)) { errs.push("row " + y + " unknown char " + ch); break; }
  });
  for (const k in P) if (P[k] !== "." && resolveSlot(P[k], {}) == null) errs.push("slot " + k + "=" + P[k] + " unresolvable");
  return errs;
}

export function flipX(cell) {
  const ax = axisOf(cell), w = cell.w;
  const rows = cell.rows.map((r) => { let o = ""; for (let x = 0; x < w; x++) { const s = 2 * ax - x; o += s >= 0 && s < w ? r[s] : "."; } return o; });
  const out = {...cell, rows};
  if (cell.anchor) out.anchor = [2 * ax - cell.anchor[0], cell.anchor[1]];
  return out;
}

export function rot90(cell, n = 1) {
  let c = cell;
  for (let i = 0; i < ((n % 4) + 4) % 4; i++) {
    const w = c.h, h = c.w, src = c.rows, rows = [];
    for (let y = 0; y < h; y++) { let o = ""; for (let x = 0; x < w; x++) o += src[c.h - 1 - x][y]; rows.push(o); }
    c = {...c, w, h, rows, axis: undefined, anchor: undefined};
  }
  return c;
}

export function swapCell(cell, map) {
  return {...cell, rows: cell.rows.map((r) => r.replace(/./g, (ch) => (ch in map ? map[ch] : ch)))};
}

export function overlayCell(base, top, dx = 0, dy = 0) {
  const rows = base.rows.map((r, y) => { const t = top.rows[y - dy]; if (!t) return r; let o = ""; for (let x = 0; x < base.w; x++) { const ch = t[x - dx]; o += ch && ch !== "." ? ch : r[x]; } return o; });
  return {...base, rows, pal: {...(base.pal || {}), ...(top.pal || {})}};
}

/* cell -> RGBA bytes (w*h*4), alpha 0 or 255 only (plan P5). */
export function cellRGBA(cell, pal, ctx) {
  const P = {...(pal || {}), ...(cell.pal || {})}, w = cell.w, h = cell.h;
  const out = new Uint8ClampedArray(w * h * 4), lut = {};
  for (let y = 0; y < h; y++) {
    const r = cell.rows[y] || "";
    for (let x = 0; x < w; x++) {
      const ch = r[x];
      if (!ch || ch === ".") continue;
      let c = lut[ch];
      if (c === undefined) { const hex = resolveSlot(P[ch], ctx); c = lut[ch] = hex ? rgbOf(hex) : null; }
      if (!c) continue;
      const i = (y * w + x) * 4;
      out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255;
    }
  }
  return out;
}

export function paintCell(w, h, fn) {
  const rows = [];
  for (let y = 0; y < h; y++) { let o = ""; for (let x = 0; x < w; x++) o += fn(x, y) || "."; rows.push(o); }
  return rows;
}
