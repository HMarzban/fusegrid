#!/usr/bin/env node
/* Wall round 2026-10-21 (THROWAWAY prototype). Turns the shared wall shape
   lists (src/render/wallart.js) into PIXEL palette-SLOT string grids and
   writes src/render/pixel/art/walls.js. Same sampler as the art director's
   walls-concept.mjs pxGrid: 80x80 sub-samples (2 per logical px), each art px
   reads one sub-sample, the outermost ones read the outermost sample so a
   1-px ring survives. Slots resolve through the family's PIXEL remaps.
   Mirrored pieces (vr ctr cbr) are not stored: atlas.js mirrors vl ctl cbl. */
import {writeFileSync} from "node:fs";
import {BIOMES} from "../../src/core/config.js";
import {WV} from "../../src/render/wallvar.js";
import {FAM, wallShapes, edgeSlot} from "../../src/render/wallart.js";

export const PX_WALL_CELLS = [["base", WV.BASE], ["v1", WV.V1], ["v2", WV.V2], ["acc", WV.ACC], ["h", WV.H], ["vl", WV.VL], ["vr", WV.VR], ["ctl", WV.CTL], ["ctr", WV.CTR], ["cbl", WV.CBL], ["cbr", WV.CBR]];
const CH = {"wall": "w", "wall.outline": "X", "wall.shadow": "W", "wall.light": "L", "wallHi": "h", "wallHi.light": "H", "wallHi.shadow": "s"};
const N = 80;
const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const segD = (x, y, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); };
function hit(s, x, y) {
  if (s.r) return x >= s.r[0] && y >= s.r[1] && x < s.r[0] + s.r[2] && y < s.r[1] + s.r[3];
  if (s.p) return inPoly(x, y, s.p);
  for (let i = 1; i < s.s.length; i++) if (segD(x, y, s.s[i - 1], s.s[i]) <= s.w / 2) return true;
  return false;
}
const SI = (i) => (i === 0 ? 0 : i === 19 ? N - 1 : i * 4 + 1);
export function pxRows(b, code) {
  const F = FAM[b.name], sh = wallShapes(b, code, true).filter((s) => !s.npx), map = F.px || {};
  const res = (s) => { if (s === "edge") s = edgeSlot(b); if (s.includes("|")) s = s.split("|")[1]; return map[s] || s; };
  const rows = [];
  for (let j = 0; j < 20; j++) {
    let o = "";
    for (let i = 0; i < 20; i++) {
      const x = (SI(i) + 0.5) / 2, y = (SI(j) + 0.5) / 2;
      let sl = null;
      for (const s of sh) if (hit(s, x, y)) sl = res(s.c);
      o += sl ? CH[sl] : ".";
    }
    rows.push(o);
  }
  return rows;
}
/* round 3: runs of one row collapse to R(row, n), and a row string used in
   two or more places across the sheet is written once in the shared row
   table Q and referenced as Q[i] (the cells are still plain slot strings
   at runtime; this only stops 64 cells repeating the same rim rows) */
function runs(rows) {
  const o = [];
  for (let i = 0; i < rows.length;) { let j = i; while (j + 1 < rows.length && rows[j + 1] === rows[i]) j++; o.push([rows[i], j - i + 1]); i = j + 1; }
  return o;
}
function lit(rows, Q) {
  const ref = (r) => (Q.has(r) ? `Q[${Q.get(r)}]` : `"${r}"`);
  return `c([${runs(rows).map(([r, n]) => (n > 1 ? `...R(${ref(r)}, ${n})` : ref(r))).join(", ")}])`;
}
if (process.argv[1] && process.argv[1].endsWith("genpx.mjs")) {
  const all = [], freq = new Map(), Q = new Map();
  for (const b of BIOMES) for (const [n, code] of PX_WALL_CELLS) { const rows = pxRows(b, code); all.push([b.name + "." + n, rows]); for (const [r] of runs(rows)) freq.set(r, (freq.get(r) || 0) + 1); }
  for (const [r, k] of [...freq].sort((a, b) => b[1] - a[1])) if (k > 1) Q.set(r, Q.size);
  const cells = all.map(([k, rows]) => `    "${k}": ${lit(rows, Q)},`);
  const src = `/* PIXEL wall families (wall round 2026-10-21, THROWAWAY prototype). GENERATED
   by tools/walls/genpx.mjs from the shared shape lists in ../../wallart.js:
   do not hand-edit, re-run the generator. One full 20x20 cell per biome and
   wall code (the face band is already faceRows(hWall)*2 tall, so no
   composeFace); vr / ctr / cbr are mirrored from vl / ctl / cbl at bake.
   Q is the shared row table (a row used in two or more places).
   Wall SLOTS only (never a brick slot, never hex). */
const A = "art-walls";
const c = (rows) => ({w: rows[0].length, h: rows.length, author: A, rows});
const R = (row, n) => Array(n).fill(row);
const Q = [${[...Q.keys()].map((r) => `"${r}"`).join(", ")}];

export const SHEET = Object.freeze({
  id: "walls",
  pal: Object.freeze({w: "tile.wall", X: "tile.wall.outline", W: "tile.wall.shadow", L: "tile.wall.light", h: "tile.wallHi", H: "tile.wallHi.light", s: "tile.wallHi.shadow"}),
  cells: Object.freeze({
${cells.join("\n")}
  }),
});
`;
  const out = new URL("../../src/render/pixel/art/walls.js", import.meta.url);
  writeFileSync(out, src);
  console.log("wrote", out.pathname, Buffer.byteLength(src), "bytes,", cells.length, "cells");
}
