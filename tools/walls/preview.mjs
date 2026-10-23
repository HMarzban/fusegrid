#!/usr/bin/env node
/* Round 3 (throwaway): a fast Node contact sheet for iteration. Per world:
   CLASSIC 2D base v1 v2 acc border (shape lists rasterised at 40 px with 4x4
   supersampling, a stand-in for the canvas AA bake) + the brick, then PIXEL
   the same pieces (20x20 slot cells) + the PIXEL brick. Every tile is shown
   at its true game size x scale (2D 40 px, PIXEL 20 art px x 2), NEAREST.
   node tools/walls/preview.mjs <out.png> [--gray] [--scale 3] [--only JUNGLE,SAND] */
import {writeFileSync} from "node:fs";
import {BIOMES} from "../../src/core/config.js";
import {WV} from "../../src/render/wallvar.js";
import {wallShapes, slot2d} from "../../src/render/wallart.js";
import {ART} from "../../src/render/pixel/art/index.js";
import {resolveSlot} from "../../src/render/pixel/palette.js";
import {faceRows} from "../../src/render/pixel/atlas.js";
import {createRGBA, hexRGB, paste, png, blank, label} from "../pixel/rgba.mjs";
const a = process.argv.slice(2), OUT = a[0], GRAY = a.includes("--gray");
const SC = +(a[a.indexOf("--scale") + 1] || 3) || 3, ONLY = a.includes("--only") ? a[a.indexOf("--only") + 1].split(",") : null;
const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const segD = (x, y, p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - p[0] - t * dx, y - p[1] - t * dy); };
const hit = (s, x, y) => s.r ? x >= s.r[0] && y >= s.r[1] && x < s.r[0] + s.r[2] && y < s.r[1] + s.r[3] : s.p ? inPoly(x, y, s.p) : s.s.some((_, i) => i && segD(x, y, s.s[i - 1], s.s[i]) <= s.w / 2);
const gr = ([r, g, b]) => { const v = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b); return GRAY ? [v, v, v] : [r, g, b]; };
function tile2d(b, sh, bgHex) {
  const o = createRGBA(40, 40, "#000000"), bg = hexRGB(bgHex), N = 4;
  for (let j = 0; j < 40; j++) for (let i = 0; i < 40; i++) {
    const acc = [0, 0, 0];
    for (let v = 0; v < N; v++) for (let u = 0; u < N; u++) { const x = i + (u + 0.5) / N, y = j + (v + 0.5) / N; let c = bg; for (const s of sh) if (hit(s, x, y)) c = hexRGB(slot2d(b, s.c)); c.forEach((k, m) => (acc[m] += k)); }
    const c = gr(acc.map((k) => Math.round(k / (N * N)))), q = (j * 40 + i) * 4;
    o.data[q] = c[0]; o.data[q + 1] = c[1]; o.data[q + 2] = c[2]; o.data[q + 3] = 255;
  }
  return o;
}
function brick2d(b) { const sh = [{r: [0, 0, 40, 40], c: "floor0"}, {r: [1, 1, 38, 38], c: "brickB"}, {r: [2, 2, 36, 18.4], c: "brickA"}, {r: [3, 3, 34, 8], c: "brickHi"}]; return tile2d(b, sh, b.floor0); }
function tilePx(b, rows, pal) {
  const o = createRGBA(rows[0].length, rows.length, "#000000");
  rows.forEach((r, j) => [...r].forEach((ch, i) => { const c = gr(hexRGB(ch === "." ? b.floor0 : resolveSlot(pal[ch], {biome: b}))), q = (j * r.length + i) * 4; o.data[q] = c[0]; o.data[q + 1] = c[1]; o.data[q + 2] = c[2]; o.data[q + 3] = 255; }));
  return o;
}
const TL = ART.tiles, comp = (top, face, fh) => TL.cells[top].rows.slice(0, 20 - fh).concat(TL.cells[face].rows.slice(0, fh));
const PCS = [["base", WV.BASE], ["v1", WV.V1], ["v2", WV.V2], ["acc", WV.ACC], ["h", WV.H]];
const bs = BIOMES.filter((b) => !ONLY || ONLY.includes(b.name)), T = 40 * SC, G = 6;
const W = 12 * (T + G) + 3 * G + 60, H = bs.length * (T + G) + 30;
const sheet = blank(W, H, "#0b0f1a");
label(sheet, 8, 8, 2, "2D BASE V1 V2 ACC BORDER BRICK  |  PIXEL BASE V1 V2 ACC BORDER BRICK" + (GRAY ? "  (GRAY)" : ""), [255, 220, 120]);
bs.forEach((b, r) => {
  const y = 30 + r * (T + G);
  const fl = createRGBA(1, 1, b.floor0);
  label(sheet, 4, y + T / 2 - 4, 1, b.name.slice(0, 6), [200, 200, 200]);
  PCS.forEach(([, c], k) => paste(sheet, tile2d(b, wallShapes(b, c), b.floor0), 60 + k * (T + G), y, SC));
  paste(sheet, brick2d(b), 60 + 5 * (T + G), y, SC);
  const x0 = 60 + 6 * (T + G) + 3 * G;
  PCS.forEach(([n], k) => paste(sheet, tilePx(b, ART.walls.cells[b.name + "." + n].rows, ART.walls.pal), x0 + k * (T + G), y, SC * 2));
  paste(sheet, tilePx(b, comp("brickTop", "brickFace", faceRows(b.hBrick)), TL.pal), x0 + 5 * (T + G), y, SC * 2);
  void fl;
});
writeFileSync(OUT, png(sheet));
console.log("wrote", OUT);
