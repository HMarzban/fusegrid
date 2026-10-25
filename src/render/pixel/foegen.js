/* PIXEL foe frame derivation. Pure, bake time only: every extra frame (walk pass poses, idle breath, blink, death squash and flash, materialize blobs) is
   made from an authored cell by a row / column edit, so the art sheets stay small and every derived frame is still a palette-slot grid (never hex).
   Cells here keep h = 20 and the default anchor (a deleted row is paid for by a blank row at the top, so the foot line never moves). */
import {swapCell} from "./grid.js";

const blankRow = (w) => ".".repeat(w);
const nz = (r) => /[^.]/.test(r);
const count = (r) => { let n = 0; for (const ch of r) if (ch !== ".") n++; return n; };
const span = (c) => { let a = c.rows.findIndex(nz), b = c.rows.length - 1; while (b > 0 && !nz(c.rows[b])) b--; return [a, b]; };
const ham = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
const SKIP = /[emw]/;

/* walk pass pose: the planted foot lifts (a bottom row of 8 px or fewer is a foot), the caller blits it one art px higher */
export function passOf(c) {
  const [, b] = span(c), rows = c.rows.slice();
  if (count(rows[b]) <= 8) rows[b] = blankRow(c.w);
  return {...c, rows};
}
/* the body row to drop for a breath / squash: the lowest-contrast neighbour pair in the lower body, never an eye row */
function pickRow(c) {
  const [a, b] = span(c), y0 = a + Math.floor((b - a) * 0.4);
  let best = -1, bs = 1e9;
  for (let y = y0; y <= b - 3; y++) {
    if (SKIP.test(c.rows[y]) || SKIP.test(c.rows[y + 1])) continue;
    const s = ham(c.rows[y], c.rows[y + 1]);
    if (s < bs) { bs = s; best = y; }
  }
  return best;
}
export function squeeze(c, y) {
  const at = y == null ? pickRow(c) : y;
  if (at < 0) return c;
  return {...c, rows: [blankRow(c.w)].concat(c.rows.slice(0, at), c.rows.slice(at + 1))};
}
export function stretch(c, y) {
  const at = y == null ? pickRow(c) : y;
  if (at < 0 || nz(c.rows[0])) return c;
  const rows = c.rows.slice(1);
  rows.splice(at - 1, 0, c.rows[at]);
  return {...c, rows};
}
/* two extra columns copied from the axis column (a wide-low death pose); w grows, the axis and anchor follow */
export function widen(c, n = 2) {
  const ax = c.axis != null ? c.axis : c.w >> 1;
  return {...c, w: c.w + n, axis: ax + (n >> 1), rows: c.rows.map((r) => r.slice(0, ax + 1) + r[ax].repeat(n) + r.slice(ax + 1))};
}
export const squash = (c) => widen(squeeze(squeeze(squeeze(c))));
export const silhouette = (c, ch) => ({...c, rows: c.rows.map((r) => r.replace(/[^.]/g, ch))});
/* the eyelid: a slot recolour of the sclera rows (null when the cell shows no eye) */
export const blinkOf = (c, to = "k") => (c.rows.some((r) => /[eE]/.test(r)) ? swapCell(c, {e: to, E: to}) : null);
/* eye shading: the lowest sclera pixel of every 2+ px tall eye turns one ramp step down (pow.line.shadow), so a 2-row eye reads round */
export function shine(c) {
  const rows = c.rows.map((r) => [...r]);
  for (let y = 1; y < c.h; y++) for (let x = 0; x < c.w; x++) if (c.rows[y][x] === "e" && c.rows[y - 1][x] === "e" && c.rows[y + 1] && c.rows[y + 1][x] !== "e") rows[y][x] = "E";
  return {...c, rows: rows.map((r) => r.join(""))};
}
/* nearest-neighbour scale about the foot line; blob = every pixel body.base inside an outline ring */
function sample(c, f, keep) {
  const ax = c.axis != null ? c.axis : c.w >> 1, [, b] = span(c), at = (x, y) => (y >= 0 && y < c.h && x >= 0 && x < c.w ? c.rows[y][x] : ".");
  const rows = [];
  for (let y = 0; y < c.h; y++) { let o = ""; for (let x = 0; x < c.w; x++) { const ch = at(Math.round(ax + (x - ax) / f), Math.round(b + (y - b) / f)); o += ch === "." ? "." : keep ? ch : "b"; } rows.push(o); }
  return {...c, rows};
}
export function blob(c, f) {
  const s = sample(c, f, false), at = (x, y) => (y >= 0 && y < s.h && x >= 0 && x < s.w ? s.rows[y][x] : "."), edge = (x, y) => at(x, y) !== "." && (at(x - 1, y) === "." || at(x + 1, y) === "." || at(x, y - 1) === "." || at(x, y + 1) === ".");
  return {...s, rows: s.rows.map((r, y) => [...r].map((ch, x) => (ch === "." ? "." : edge(x, y) ? "o" : edge(x, y - 1) || edge(x - 1, y) ? "l" : "b")).join(""))};
}
export const scaled = (c, f) => sample(c, f, true);
/* FAST's wing flap: the rows that have a gap at the axis column are the wings; they step 1 px away from the body */
export function wings(c) {
  const ax = c.axis != null ? c.axis : c.w >> 1, [a, b] = span(c), g = [];
  for (let y = a; y <= b; y++) if (nz(c.rows[y]) && c.rows[y][ax] === "." && c.rows[y][ax - 1] === ".") g.push(y);
  if (!g.length) return null;
  const rows = c.rows.slice(), dy = g[0] === a ? -1 : 1;
  for (const y of g) rows[y + dy] = c.rows[y];
  return {...c, rows};
}
export const up1 = (c) => ({...c, rows: c.rows.slice(1).concat(blankRow(c.w))});
/* the spawn floor ring as a cell (rx art px wide, half that tall): one drawImage, so it travels the same path as every other sprite */
export function ringCell(rx) {
  const ry = Math.max(1, Math.round(rx / 2)), n = Math.max(12, Math.round(3.3 * (rx + ry))), g = Array.from({length: 2 * ry + 1}, () => Array(2 * rx + 1).fill("."));
  for (let j = 0; j < n; j++) { const a = (j / n) * 6.2832; g[ry + Math.round(ry * Math.sin(a))][rx + Math.round(rx * Math.cos(a))] = "r"; }
  return {w: 2 * rx + 1, h: 2 * ry + 1, axis: rx, anchor: [rx, ry], rows: g.map((r) => r.join("")), pal: {r: "body.light"}};
}
