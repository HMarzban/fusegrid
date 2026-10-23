#!/usr/bin/env node
/* Round 3 (maturity pass, throwaway): grayscale WALL vs BRICK at true size,
   plus two shape gates. Per world, CLASSIC 2D (40x40 point samples of the
   shared shape lists at pixel centres, 2D slot resolution; NOT the AA bake)
   and PIXEL (the 20x20 generated slot grid):
   - L*: wall-mean (min over the four pillar pieces) vs brick-mean, and the
     cap-vs-face step (the WALL value read: light cap over a dark face);
   - stripes: interior rows of the body+face band where |dL*| row-to-row
     exceeds T over >= 70% of the width (the cap/face break, the under-cap
     line and the AO foot excluded). A course/mortar rhythm shows up here;
     the brick column is the reference (PIXEL brickTop's two mortar runs).
     Rows in a run count as ONE feature; perpends = interior vertical
     steps inside the face band (the other half of a course rhythm).
   - lint: every 2D shape (it also paints the 2x REAL 3D strip) must be at
     least 1 logical px (= 2 texels): stroke w >= 1, rect w/h >= 1.
   - marks: share of a block's pixels that differ from its plain form (the
     block grammar alone, no material, no detail, no variant): gate <= 30%.
   node tools/walls/gray.mjs [--json] */
import {BIOMES} from "../../src/core/config.js";
import {WV} from "../../src/render/wallvar.js";
import {wallShapes, slot2d, faceY} from "../../src/render/wallart.js";
import {ART} from "../../src/render/pixel/art/index.js";
import {resolveSlot} from "../../src/render/pixel/palette.js";
import {faceRows} from "../../src/render/pixel/atlas.js";
const {labOf, overA} = await import(process.env.CVD || "/Users/macbook/workspace/rollblock/.superpowers/sdd/2026-10-21-walls/cvd.mjs");

const T = 6;
const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const segD = (x, y, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); };
const hit = (s, x, y) => s.r ? x >= s.r[0] && y >= s.r[1] && x < s.r[0] + s.r[2] && y < s.r[1] + s.r[3] : s.p ? inPoly(x, y, s.p) : s.s.some((_, i) => i && segD(x, y, s.s[i - 1], s.s[i]) <= s.w / 2);
const L = (h) => labOf(h)[0];
const lumCache = new Map(), LL = (h) => { let v = lumCache.get(h); if (v == null) { v = L(h); lumCache.set(h, v); } return v; };
function grid2d(b, sh) { const g = []; for (let j = 0; j < 40; j++) { const r = []; for (let i = 0; i < 40; i++) { let h = b.floor0; for (const s of sh) if (hit(s, i + 0.5, j + 0.5)) h = slot2d(b, s.c); r.push(LL(h)); } g.push(r); } return g; }
function brick2d(b) { const g = []; for (let j = 0; j < 40; j++) { const r = []; for (let i = 0; i < 40; i++) { const x = i + 0.5, y = j + 0.5; let h = b.floor0; if (x >= 1 && y >= 1 && x < 39 && y < 39) h = b.brickB; if (x >= 2 && y >= 2 && x < 38 && y < 20.4) h = b.brickA; if (x >= 3 && y >= 3 && x < 37 && y < 11) h = overA(b.brickHi, h, 0.55); r.push(LL(h)); } g.push(r); } return g; }
const gridPx = (b, rows, pal) => rows.map((r) => [...r].map((ch) => LL(ch === "." ? b.floor0 : resolveSlot(pal[ch], {biome: b}))));
const TL = ART.tiles;
const composed = (top, face, fh) => TL.cells[top].rows.slice(0, 20 - fh).concat(TL.cells[face].rows.slice(0, fh));
const mean = (g, x0, y0, x1, y1) => { let s = 0, n = 0; for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) { s += g[j][i]; n++; } return n ? s / n : 0; };
/* stripes between rows j and j+1 for j in [a, b), skipping the listed breaks */
function stripes(g, x0, x1, a, b, skip) {
  const o = [];
  for (let j = a; j < b; j++) {
    if (skip.includes(j)) continue;
    let n = 0;
    for (let i = x0; i < x1; i++) if (Math.abs(g[j + 1][i] - g[j][i]) > T) n++;
    if (n >= 0.7 * (x1 - x0)) o.push(j + 1);
  }
  return o;
}
/* runs of consecutive stripe rows are ONE feature (a 2-row line is one line) */
const feats = (rows) => rows.filter((r, i) => i === 0 || rows[i - 1] !== r - 1).length;
/* perpends: interior column edges inside the face band (rows a..b) that
   step by more than T on at least k rows: the vertical half of a course */
function perps(g, x0, x1, a, b, k) {
  let n = 0, prev = false;
  for (let x = x0; x < x1; x++) { let c = 0; for (let y = a; y <= b; y++) if (Math.abs(g[y][x + 1] - g[y][x]) > T) c++; const on = c >= k; if (on && !prev) n++; prev = on; }
  return n;
}
const PIL = [["base", WV.BASE], ["v1", WV.V1], ["v2", WV.V2], ["acc", WV.ACC]];
const out = {};
const f1 = (v) => v.toFixed(1);
let lint = 0, overMarks = 0;
for (const b of BIOMES) {
  const y0 = faceY(b), r = {};
  /* CLASSIC */
  const g2 = PIL.map(([, c]) => grid2d(b, wallShapes(b, c))), bk = brick2d(b);
  const wm = g2.map((g) => mean(g, 0, 0, 40, 40)), bm = mean(bk, 0, 0, 40, 40);
  const cap = mean(g2[0], 4, 5, 36, 16), face = mean(g2[0], 4, y0 + 1, 36, 35);
  /* rows 19..35: the under-cap line (19), the cap/face break (y0-1, y0) and the AO (35) are form, not rhythm */
  const st = g2.map((g) => stripes(g, 4, 36, 19, 35, [19, y0 - 1, y0, 34, 35]));
  r.c2d = {wallL: Math.min(...wm), brickL: bm, dL: Math.min(...wm.map((w) => Math.abs(w - bm))), capL: cap, faceL: face, capFace: cap - face, stripes: st.map((s) => feats(s)), rows: st[0], perps: perps(g2[0], 4, 35, y0 + 1, 35, 3)};
  /* PIXEL */
  const P = ART.walls.pal, gp = PIL.map(([n]) => gridPx(b, ART.walls.cells[b.name + "." + n].rows, P));
  const bp = gridPx(b, composed("brickTop", "brickFace", faceRows(b.hBrick)), TL.pal);
  const pwm = gp.map((g) => mean(g, 0, 0, 20, 20)), pbm = mean(bp, 0, 0, 20, 20), py0 = y0 / 2;
  const pst = gp.map((g) => stripes(g, 2, 18, 9, 17, [9, py0 - 1, py0, 17]));
  r.px = {wallL: Math.min(...pwm), brickL: pbm, dL: Math.min(...pwm.map((w) => Math.abs(w - pbm))), capL: mean(gp[0], 2, 2, 18, 8), faceL: mean(gp[0], 2, py0 + 1, 18, 17), stripes: pst.map((s) => feats(s)), rows: pst[0], perps: perps(gp[0], 2, 17, 10, 17, 2), brickStripes: stripes(bp, 2, 18, 0, 18, []), brickPerps: perps(bp, 2, 17, 1, 17, 2)};
  r.px.capFace = r.px.capL - r.px.faceL;
  /* lint + marks (11 codes) */
  const bad = [];
  for (let c = 0; c < 11; c++) for (const s of wallShapes(b, c)) if ((s.s && s.w < 1) || (s.r && (s.r[2] < 1 || s.r[3] < 1))) bad.push(c + ":" + (s.s ? "w" + s.w : "r" + s.r.join(",")));
  lint += bad.length;
  r.lint = bad;
  r.marks = PIL.map(([, c]) => { let plain; try { plain = wallShapes(b, c, false, {plain: true}); } catch (_) { return null; } if (!plain) return null; const a = grid2d(b, wallShapes(b, c)), p = grid2d(b, plain); let d = 0, n = 0; for (let j = 0; j < 40; j++) for (let i = 0; i < 40; i++) { n++; if (Math.abs(a[j][i] - p[j][i]) > 0.5) d++; } return d / n; });
  overMarks += r.marks.filter((m) => m != null && m > 0.3).length;
  out[b.name] = r;
  if (!process.argv.includes("--json")) {
    console.log(b.name.padEnd(8), "2D  wall L", f1(r.c2d.wallL), "brick L", f1(r.c2d.brickL), "dL", f1(r.c2d.dL), "| cap", f1(cap), "face", f1(face), "step", f1(r.c2d.capFace), "| stripe features", r.c2d.stripes.join(","), "rows", r.c2d.rows.join(" "), "| perpends", r.c2d.perps, "| marks", r.marks.map((m) => (m == null ? "-" : (m * 100).toFixed(0) + "%")).join(","), bad.length ? "| LINT " + bad.length + " " + bad.slice(0, 4).join(" ") : "");
    console.log("".padEnd(8), "PX  wall L", f1(r.px.wallL), "brick L", f1(r.px.brickL), "dL", f1(r.px.dL), "| cap", f1(r.px.capL), "face", f1(r.px.faceL), "step", f1(r.px.capFace), "| stripe features", r.px.stripes.join(","), "rows", r.px.rows.join(" "), "| perpends", r.px.perps, "| brick stripes", r.px.brickStripes.join(" "), "perpends", r.px.brickPerps);
  }
}
if (process.argv.includes("--json")) console.log(JSON.stringify(out));
else console.log(`lint: ${lint} sub-2-texel shapes (gate 0) · marks > 30%: ${overMarks} pieces (gate 0) · T = ${T} L*`);
