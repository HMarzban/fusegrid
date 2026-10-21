#!/usr/bin/env node
/* Wall round prototype measurement (throwaway): tile-mean dE76 true /
   protan / deutan / tritan of the BUILT families against floor and brick, in
   CLASSIC 2D (80x80 point samples of the shared shape lists, 2D slot
   resolution; also the REAL 3D albedo) and PIXEL (the generated slot grids
   through palette.js), against the live v184 tile. Helpers: the art
   director's cvd.mjs (labOf/dE verbatim from tests/items-art.test.mjs). */
import {BIOMES} from "../../src/core/config.js";
import {WV} from "../../src/render/wallvar.js";
import {wallShapes, slot2d} from "../../src/render/wallart.js";
import {ART} from "../../src/render/pixel/art/index.js";
import {resolveSlot} from "../../src/render/pixel/palette.js";
import {faceRows} from "../../src/render/pixel/atlas.js";
import {pxRows} from "./genpx.mjs";
const {dEs, mix, overA, labOf} = await import(process.env.CVD || "/Users/macbook/workspace/rollblock/.superpowers/sdd/2026-10-21-walls/cvd.mjs");

const N = 80;
const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const segD = (x, y, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); };
const hit = (s, x, y) => s.r ? x >= s.r[0] && y >= s.r[1] && x < s.r[0] + s.r[2] && y < s.r[1] + s.r[3] : s.p ? inPoly(x, y, s.p) : s.s.some((_, i) => i && segD(x, y, s.s[i - 1], s.s[i]) <= s.w / 2);
const meanOf = (hexes) => { const m = new Map(); for (const h of hexes) m.set(h, (m.get(h) || 0) + 1); return mix([...m]); };
function raster2d(b, sh, bg) { const o = []; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = (i + 0.5) / 2, y = (j + 0.5) / 2; let h = bg; for (const s of sh) if (hit(s, x, y)) h = slot2d(b, s.c); o.push(h); } return o; }
const today2d = (b) => { const o = []; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = (i + 0.5) / 2, y = (j + 0.5) / 2; let h = b.floor0; const inRR = x >= 0 && y >= 0 && x <= 40 && y <= 40 && Math.hypot(x - Math.min(Math.max(x, 4), 36), y - Math.min(Math.max(y, 4), 36)) <= 4; if (inRR) h = b.wall; if (x >= 3 && x < 37 && y >= 3 && y < 19) h = b.wallHi; if (x >= 3 && x < 37 && y >= 22 && y < 39.6) h = overA("#000000", h, 0.35); o.push(h); } return o; };
const brick2d = (b) => { const o = []; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = (i + 0.5) / 2, y = (j + 0.5) / 2; let h = b.floor0; if (x >= 1 && y >= 1 && x < 39 && y < 39) h = b.brickB; if (x >= 2 && y >= 2 && x < 38 && y < 20.4) h = b.brickA; if (x >= 3 && y >= 3 && x < 37 && y < 11) h = overA(b.brickHi, h, 0.55); o.push(h); } return o; };
const pxGrid = (b, rows, pal) => rows.flatMap((r) => [...r].map((ch) => (ch === "." ? b.floor0 : resolveSlot(pal[ch], {biome: b}))));
const T = ART.tiles;
const composed = (top, face, fh) => T.cells[top].rows.slice(0, 20 - fh).concat(T.cells[face].rows.slice(0, fh));
const SIM = ["true", "protan", "deutan", "tritan"];
const f1 = (a) => a.map((v) => v.toFixed(1)).join(" / ");
const out = {};
for (const b of BIOMES) {
  const fl = mix([[b.floor0, 1], [b.floor1, 1]]);
  const r = {};
  const pillar = [WV.BASE, WV.V1, WV.V2, WV.ACC];
  /* CLASSIC */
  const bk2 = meanOf(brick2d(b)), t2 = meanOf(today2d(b));
  const n2 = pillar.map((v) => meanOf(raster2d(b, wallShapes(b, v), b.floor0)));
  r.c2d = {todayVsBrick: dEs(t2, bk2), todayVsFloor: dEs(t2, fl), newVsBrick: SIM.map((_, k) => Math.min(...n2.map((m) => dEs(m, bk2)[k]))), newVsFloor: SIM.map((_, k) => Math.min(...n2.map((m) => dEs(m, fl)[k])))};
  /* PIXEL */
  const bkp = meanOf(pxGrid(b, composed("brickTop", "brickFace", faceRows(b.hBrick)), T.pal)), tp = meanOf(pxGrid(b, composed("wallTop", "wallFace", faceRows(b.hWall)), T.pal));
  const np = ["base", "v1", "v2", "acc"].map((n) => meanOf(pxGrid(b, ART.walls.cells[b.name + "." + n].rows, ART.walls.pal)));
  r.px = {todayVsBrick: dEs(tp, bkp), todayVsFloor: dEs(tp, fl), newVsBrick: SIM.map((_, k) => Math.min(...np.map((m) => dEs(m, bkp)[k]))), newVsFloor: SIM.map((_, k) => Math.min(...np.map((m) => dEs(m, fl)[k])))};
  /* VOID cap share (PIXEL: wallHi chars over the cell) */
  if (process.argv.includes("--var")) console.log(b.name, "2D per variant vs brick:", n2.map((m, i) => ["base", "v1", "v2", "acc"][i] + " " + f1(dEs(m, bk2))).join(" | "));
  if (process.argv.includes("--var")) console.log(b.name, "PX per variant vs brick:", np.map((m, i) => ["base", "v1", "v2", "acc"][i] + " " + m + " L" + labOf(m)[0].toFixed(1) + " " + f1(dEs(m, bkp))).join(" | "), "| brick L", labOf(bkp)[0].toFixed(1), "today L", labOf(tp)[0].toFixed(1));
  r.pxCapShare = ["base", "v1", "v2", "acc"].map((n) => ART.walls.cells[b.name + "." + n].rows.join("").split("").filter((c) => c === "h" || c === "H" || c === "s").length / 400);
  out[b.name] = r;
  console.log(b.name.padEnd(8), "2D wall~brick today", f1(r.c2d.todayVsBrick), "-> min", f1(r.c2d.newVsBrick), "| wall~floor today", f1(r.c2d.todayVsFloor), "-> min", f1(r.c2d.newVsFloor));
  console.log("".padEnd(8), "PX wall~brick today", f1(r.px.todayVsBrick), "-> min", f1(r.px.newVsBrick), "| wall~floor today", f1(r.px.todayVsFloor), "-> min", f1(r.px.newVsFloor), "| px cap share", r.pxCapShare.map((v) => (v * 100).toFixed(0)).join(","));
}
if (process.argv.includes("--json")) console.log(JSON.stringify(out));
