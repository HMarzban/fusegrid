/* PIXEL export (Node, no browser): featPxCell -> cellRGBA (palette slots via
   pxRamp) -> NEAREST x9 (180 px) centred on a clear 192 canvas. Also writes
   a review sheet when given a path, and prints cell validity + coverage
   (mark-slot "M" px + edge-strip mark px, of 400). */
import {writeFileSync} from "node:fs";
import {BIOMES} from "../../src/core/config.js";
const {featPxCell} = await import(process.env.TILEART_PX || "../../src/render/featpx.js");
import {cellRGBA, validateCell} from "../../src/render/pixel/grid.js";
import {surfRGBA, blank, paste, png} from "../pixel/rgba.mjs";
import {OUT, TILES, HEAT} from "./harness.mjs";
const sheet = process.argv[2], rep = [], NOW = !process.env.TILEART_PX;
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lab = ([r, g, b]) => { [r, g, b] = [r, g, b].map((v) => v / 255); const f = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); r = f(r); g = f(g); b = f(b); const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, Y = r * 0.2126 + g * 0.7152 + b * 0.0722, Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883; const k = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * k(Y) - 16, 500 * (k(X) - k(Y)), 200 * (k(Y) - k(Z))]; };
const dE = (a, b) => { const A = lab(a), B = lab(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
const MX = {protan: [[0.11238, 0.88762, 0], [0.11238, 0.88762, 0], [0.00401, -0.00401, 1]], deutan: [[0.29275, 0.70725, 0], [0.29275, 0.70725, 0], [-0.02234, 0.02234, 1]], tritan: [[1, 0.14461, -0.14461], [0, 0.85659, 0.14341], [0, 0.85659, 0.14341]]};
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }, gam = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055);
const sim = (c, m) => { const l = c.map(lin); return m.map((r) => Math.max(0, Math.min(255, gam(r[0] * l[0] + r[1] * l[1] + r[2] * l[2])))); };
const r1 = (v) => Math.round(v * 10) / 10;
const S = sheet ? blank(3 * 200, TILES.length * 200, "#0b0f1a") : null;
TILES.forEach(([w, p, bn, sp], r) => HEAT.forEach((hn, h) => {
  const b = BIOMES.find((x) => x.name === bn), c = featPxCell(bn, {...sp, h, exit: false});
  const errs = validateCell(c, c.pal);
  const img = surfRGBA(20, 20, cellRGBA(c, c.pal, {biome: b}));
  const big = blank(192, 192); paste(big, img, 6, 6, 9);
  if (NOW) writeFileSync(OUT + "px/" + w + "-" + p + "-" + hn + ".png", png(big));
  if (S) paste(S, img, h * 200 + 6, r * 200 + 6, 9);
  const marks = c.rows.join("").split("").filter((ch) => ch === "M" || ch === "Q" || ch === "F" || ch === "P").length;
  const D = img.data, mk = [], bed = [0, 0, 0]; let nb = 0, nearBrick = 0;
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) { const i = (y * 20 + x) * 4, c = [D[i], D[i + 1], D[i + 2]], ch = c0(y, x);
    if (dE(c, rgb(b.brickB)) < 10 || dE(c, rgb(b.brickA)) < 10) nearBrick++;
    if (ch === "M") mk.push(c); else if (x >= 4 && x < 16 && y >= 4 && y < 16) { bed[0] += c[0]; bed[1] += c[1]; bed[2] += c[2]; nb++; } }
  function c0(y, x) { return c.rows[y][x]; }
  const bm = bed.map((v) => v / nb), m0 = mk.length ? [0, 1, 2].map((j) => mk.reduce((s, c) => s + c[j], 0) / mk.length) : bm;
  rep.push({tile: w + "-" + p, heat: hn, errs: errs.length ? errs : 0, markPx: marks, cov: +(marks / 4).toFixed(1),
    dL: r1(Math.abs(lab(m0)[0] - lab(bm)[0])), cvd: r1(Math.min(...Object.values(MX).map((m) => dE(sim(m0, m), sim(bm, m))))),
    dEfloor0: r1(dE(bm, rgb(b.floor0))), dEbrickB: r1(dE(bm, rgb(b.brickB))), dEwall: r1(dE(bm, rgb(b.wall))), nearBrickPct: r1(nearBrick / 4)});
}));
if (S) writeFileSync(sheet, png(S));
console.log(JSON.stringify(rep).replace(/},{/g, "},\n{"));
