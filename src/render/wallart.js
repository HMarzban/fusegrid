/* Wall families (wall round 2026-10-21, THROWAWAY prototype; direction B
   LIVING WORLD without cracks, per 03-rulings.md). One shape list per
   (biome, code) in a 40x40 tile, authored ONCE in wall SLOTS and resolved per
   look: CLASSIC 2D (and the REAL 3D strip, which is baked from the 2D
   canvases) resolves a step as the sprites.js idiom, black / white over the
   base hex; PIXEL resolves it through pxRamp (tools/walls/genpx.mjs turns
   these lists into slot-grid strings in pixel/art/walls.js). Every variant is
   BUILT detail (roots wrapped round, carvings, plates, studs, seams), never
   damage. Shapes: {r:[x,y,w,h]} rect, {p:[[x,y]..]} polygon, {s:[[x,y]..],w}
   stroked polyline; c is a slot. Pure data: no DOM, no hex but the biome's. */
import {WV} from "./wallvar.js";

export const TS = 40;
export const faceRows = (h) => Math.max(2, Math.min(10, Math.round((h || 0) / 4)));
export const faceH = (b) => faceRows(b.hWall) * 2;
export const faceY = (b) => 38 - faceH(b);
export const WALL_SLOTS = Object.freeze(["wall", "wall.outline", "wall.shadow", "wall.light", "wallHi", "wallHi.light", "wallHi.shadow"]);
const OV = {"wall.outline": ["#000000", "wall", 0.6], "wall.shadow": ["#000000", "wall", 0.35], "wall.light": ["#ffffff", "wall", 0.15], "wallHi.light": ["#ffffff", "wallHi", 0.3], "wallHi.shadow": ["#000000", "wallHi", 0.2]};
/* the 1px outer ring: plain wall unless it fails dL* >= 15 against a floor
   (measured in 01-art.md section 3): SAND and VOID take a wall step */
const EDGE = {SAND: "wall.outline", VOID: "wallHi.shadow"};
const hx2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const over = (hi, lo, a) => "#" + hx2(hi).map((v, i) => Math.round(a * v + (1 - a) * hx2(lo)[i]).toString(16).padStart(2, "0")).join("");
export function edgeSlot(b) { return EDGE[b.name] || "wall"; }
export function slot2d(b, s) {
  if (s === "edge") s = edgeSlot(b);
  const o = OV[s];
  return o ? over(o[0], b[o[1]], o[2]) : b[s];
}

const R = (x, y, w, h, c) => ({r: [x, y, w, h], c});
const P = (p, c) => ({p, c});
const S = (s, w, c) => ({s, w, c});
/* 2D-only highlight: a 1-art-px core samples as a dotted line in PIXEL */
const np = (x) => ({...x, npx: true});
const OCT = (k, d) => [[k, d], [TS - k, d], [TS - d, k], [TS - d, TS - k], [TS - k, TS - d], [k, TS - d], [d, TS - k], [d, k]];
const meander = (x0, x1, ya, yb, st) => { const o = []; let up = true; for (let x = x0; x <= x1; x += st) { o.push([x, up ? ya : yb], [Math.min(x + st, x1), up ? ya : yb]); up = !up; } return o; };
/* Catmull-Rom through the points: roots are smooth tubes, never a jagged crack */
const curve = (p, n = 6) => { const o = []; for (let i = 0; i < p.length - 1; i++) { const a = p[Math.max(0, i - 1)], b = p[i], c = p[i + 1], d = p[Math.min(p.length - 1, i + 2)]; for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; o.push([0, 1].map((j) => 0.5 * (2 * b[j] + (c[j] - a[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (3 * b[j] - a[j] - 3 * c[j] + d[j]) * t3))); } } o.push(p[p.length - 1]); return o; };

/* Each family: base mark, v1, v2, acc (one per room), plus bmark (the mark
   the rampart border repeats; a facet polygon would repeat as a sawtooth).
   lit = the cap bevel step (overrides measured in 01-art.md section 3),
   panel = CROWN's stone panel inside the gilt frame, px = PIXEL-only remaps. */
export const FAM = {
  JUNGLE: {name: "TEMPLE STONE", px: {"wallHi.shadow": "wall"},
    base: () => [S([[6, 11], [34, 11]], 1, "wallHi.shadow")],
    v1: (g) => { const a = curve([[2, 12], [9, 9], [16, 10], [23, 14], [29, 19], [33, g.y0 + 3], [36, 37]]); return [S(a, 4.4, "wall.outline"), np(S(a, 2, "wall"))]; },
    v2: (g) => [S(meander(5, 35, g.y0 + 3, g.y0 + g.f - 4, 5), 1.4, "wall.outline")],
    acc: (g) => { const a = curve([[9, 3], [11, 10], [8, 17], [11, g.y0 + 2], [9, 37]]), b = curve([[29, 3], [26, 9], [29, 16], [26, g.y0 + 4], [29, 37]]), t = curve([[11, 10], [15, 12], [19, 12]]); return [S(a, 4.6, "wall.outline"), S(b, 4.6, "wall.outline"), S(t, 3, "wall.outline"), np(S(a, 2, "wall")), np(S(b, 2, "wall")), np(S(t, 1, "wall"))]; },
    names: ["root wrap", "fret band", "root-bound"]},
  ICE: {name: "GLACIER BLOCK", lit: "wallHi",
    base: () => [P([[38, 6], [38, 17], [14, 17]], "wallHi.shadow")], bmark: () => [],
    v1: (g) => [R(8, g.y0 + 3, 2, 12, "wallHi"), S([[9, g.y0 + 5], [14, g.y0 + 3]], 2, "wallHi"), S([[9, g.y0 + 9], [14, g.y0 + 7]], 2, "wallHi"),
      R(26, g.y0 + 3, 2, 12, "wallHi"), S([[27, g.y0 + 4], [32, g.y0 + 9]], 2, "wallHi")],
    v2: (g) => [[7, 9], [15, 12], [24, 7], [32, 10]].flatMap(([x, l]) => [P([[x - 2, g.y0], [x, g.y0], [x, g.y0 + l]], "wallHi"), P([[x, g.y0], [x + 2, g.y0], [x, g.y0 + l]], "wall.outline")]),
    acc: (g) => [P([[2, g.y0], [38, g.y0], [38, g.y0 + 2], [35, g.y0 + 11], [32, g.y0 + 2], [27, g.y0 + 7], [23, g.y0 + 2], [18, g.y0 + 14], [14, g.y0 + 2], [9, g.y0 + 8], [6, g.y0 + 2], [2, g.y0 + 4]], "wallHi.shadow"),
      ...[[35, 11], [27, 7], [18, 14], [9, 8]].map(([x, l]) => P([[x, g.y0 + 2], [x + 2, g.y0 + 2], [x, g.y0 + l]], "wall.outline")),
      S([[5, 8], [15, 8]], 1.5, "wall.shadow"), S([[19, 12], [34, 12]], 1.5, "wall.shadow"), S([[8, 15], [17, 15]], 1.5, "wall.shadow")],
    names: ["carved runes", "icicles", "frozen fringe"]},
  FACTORY: {name: "PLATE STEEL",
    base: () => [R(5, 6, 3, 3, "wall.outline"), R(32, 6, 3, 3, "wall.outline"), R(5, 13, 3, 3, "wall.outline"), R(32, 13, 3, 3, "wall.outline")],
    v1: () => [R(19, 3, 2, 16, "wallHi.shadow"), R(21, 3, 1, 16, "wallHi.light"), ...[5, 9, 13].map((y) => R(18, y, 4, 1, "wall.shadow"))],
    v2: () => [R(10, 9, 20, 4, "wallHi.shadow"), R(10, 9, 20, 1, "wallHi.light"), R(10, 13, 20, 1, "wall.outline"), R(12, 10, 2, 2, "wall.outline"), R(26, 10, 2, 2, "wall.outline")],
    acc: (g) => [R(2, g.y0 + 1, 36, 5, "wallHi.shadow"), R(2, g.y0 + 1, 36, 1, "wallHi.light"), R(2, g.y0 + 6, 36, 1, "wall.outline"), R(27, 8, 5, g.y0 - 7, "wallHi.shadow"), R(27, 8, 1, g.y0 - 7, "wallHi.light"), R(25, 7, 9, 2, "wall.outline"), R(10, g.y0, 2, 7, "wall.outline")],
    names: ["weld seam", "bolted strap", "pipe run"]},
  WATER: {name: "PIER STONE", lit: "wallHi",
    base: (g) => [R(2, g.y0 + Math.round(g.f * 0.6), 36, g.f - Math.round(g.f * 0.6), "wall.outline")],
    v1: (g) => [[27, 14], [31, 16], [34, 13], [30, 11], [24, 17]].map(([x, y]) => P([[x - 2, y + 2], [x + 2, y + 2], [x, y - 2]], "wallHi.shadow")).concat([[8, g.y0 + 4], [12, g.y0 + 3]].map(([x, y]) => P([[x - 2, y + 2], [x + 2, y + 2], [x, y - 2]], "wallHi.shadow"))),
    v2: () => [R(8, 19, 2, 9, "wall.outline"), R(17, 19, 2, 13, "wall.outline"), R(28, 19, 2, 7, "wall.outline")],
    acc: (g) => [R(9, g.y0 + 1, 22, 3, "wallHi.shadow"), R(9, g.y0 + 1, 22, 1, "wallHi"), R(9, g.y0 + 4, 22, 1, "wall.outline"), R(18, g.y0 + 4, 4, 4, "wallHi.shadow"), R(7, g.y0 + 1, 2, 2, "wall.outline"), R(31, g.y0 + 1, 2, 2, "wall.outline")],
    names: ["barnacles", "algae drips", "mooring cleat"]},
  ARENA: {name: "COLOSSEUM STONE", px: {"wallHi.shadow": "wallHi", "wall.outline": "wall.shadow"}, pxCapFull: true,
    base: (g) => [R(2, g.y0 + 4, 36, 1, "wall.outline")],
    v1: () => [10, 14, 18, 22].map((x) => R(x, 7, 2, 9, "wall.outline")).concat([S([[8, 14], [25, 8]], 2, "wall.outline")]),
    v2: () => [R(13, 5, 14, 2, "wall.shadow"), R(14, 14, 12, 2, "wall.shadow"), R(16, 7, 2, 7, "wall.shadow"), R(22, 7, 2, 7, "wall.shadow"), R(13, 7, 14, 1, "wallHi.light")],
    acc: () => [R(6, 10, 28, 2, "wall.shadow"), ...[[9, -1], [15, 1], [21, -1], [27, 1]].map(([x, d]) => P([[x, 11 + 3.5 * d], [x + 3, 11 + 2 * d], [x + 6, 11 + 3.5 * d], [x + 3, 11 + 5.5 * d]], "wall.shadow"))],
    names: ["tally marks", "carved column", "laurel"]},
  SAND: {name: "SANDSTONE",
    base: () => [S([[3, 8], [12, 7], [22, 9], [37, 8]], 1.2, "wallHi.shadow"), S([[3, 9.4], [12, 8.4], [22, 10.4], [37, 9.4]], 1, "wallHi.light"), S([[3, 14], [14, 15], [26, 13], [37, 14]], 1.2, "wallHi.shadow"), S([[3, 15.4], [14, 16.4], [26, 14.4], [37, 15.4]], 1, "wallHi.light")],
    v1: (g) => [P([[2, 38], [2, g.y0 - 1], [9, g.y0 - 2], [17, g.y0 + 2], [24, 38]], "wallHi.light")],
    v2: (g) => [6, 17, 28].flatMap((x) => [R(x, g.y0 + 1, 6, 4, "wallHi.shadow"), R(x, g.y0 + 1, 6, 1, "wallHi.light"), R(x, g.y0 + 5, 6, 2, "wall.outline")]),
    acc: () => [S([[8, 18], [8, 15], [12, 15], [12, 12], [16, 12], [16, 9], [24, 9]], 1.3, "wallHi.shadow"), S([[24, 9], [24, 12], [28, 12], [28, 15], [32, 15], [32, 18]], 1.3, "wallHi.light"), S([[9, 18], [31, 18]], 1, "wallHi.light")],
    names: ["sand drift", "beam ends", "step relief"]},
  VOID: {name: "OBSIDIAN MONOLITH", lit: "wallHi", px: {"wallHi.shadow": "wallHi"},
    base: () => [P([[22, 5], [36, 5], [36, 17], [16, 17]], "wallHi.shadow")], bmark: () => [],
    v1: (g) => [S([[5, g.y0 + 5], [15, g.y0 + 5], [19, g.y0 + 9], [35, g.y0 + 9]], 1.5, "wallHi")],
    v2: (g) => [P([[2, 5], [9, 5], [6, 17], [2, 17]], "wallHi.shadow"), P([[21, g.y0 + 2.5], [27.5, g.y0 + 9], [21, g.y0 + 15.5], [14.5, g.y0 + 9]], "wallHi")],
    acc: (g) => [S([[20, g.y0 + 2], [20, g.y0 + 13]], 2, "wallHi"), S([[20, g.y0 + 5], [25, g.y0 + 2]], 1.5, "wallHi"), S([[20, g.y0 + 9], [15, g.y0 + 12]], 1.5, "wallHi")],
    names: ["crystal inlay", "faceted cap", "rune slit"]},
  CROWN: {name: "ROYAL MASONRY", panel: "wall.light", lit: "wallHi",
    base: (g) => [R(2, g.y0 + 5, 36, 1, "wall.outline")],
    v1: (g) => [R(9, 9, 6, 1.5, "wallHi"), R(9, 9, 1.5, 5, "wallHi"), R(25, 9, 6, 1.5, "wallHi"), R(29.5, 9, 1.5, 5, "wallHi"), R(19, g.y0 + 2, 2, 2, "wallHi")],
    v2: (g) => [8, 15, 22, 29].flatMap((x) => [R(x, g.y0 + 7, 3, 3, "wallHi"), R(x, g.y0 + 10, 3, 1, "wall.outline")]),
    acc: (g) => [P([[14, g.y0], [26, g.y0], [24, 38], [16, 38]], "wall.light"), S([[14, g.y0], [16, 38]], 1.2, "wallHi"), S([[26, g.y0], [24, 38]], 1.2, "wallHi"), R(14, g.y0, 12, 1.2, "wallHi")],
    names: ["gilt corners", "gilt studs", "keystone"]},
};

function geo(b) { const f = faceH(b); return {f, y0: 38 - f}; }
/* grammar G: chamfered monolith (square-ish chamfer, bricks keep round
   corners), edge ring, face band at the PIXEL faceRows height, cap 36x16 with
   a light top/left and a shadow bottom/right bevel */
function block(b, px) {
  const F = FAM[b.name], g = geo(b), lit = F.lit || "wallHi.light", full = px && F.pxCapFull;
  return [P(OCT(3, 0), "edge"), P(OCT(3, 1), "wall"), R(2, g.y0, 36, g.f, "wall.shadow"),
    full ? R(0, 3, 40, 16, "wallHi") : R(2, 3, 36, 16, "wallHi"),
    ...(F.panel ? [R(7, 7, 26, 8, F.panel)] : []),
    full ? R(0, 3, 40, 2, lit) : R(2, 3, 36, 2, lit), R(2, 3, 2, 16, lit), R(2, 17, full ? 38 : 36, 2, "wallHi.shadow"), R(36, 5, 2, 12, "wallHi.shadow")];
}
/* rampart pieces: the cap runs edge to edge so the frame reads as ONE
   structure; plain (no variants on the border, ruling) */
function borderH(b) {
  const F = FAM[b.name], g = geo(b), lit = F.lit || "wallHi.light", bm = F.bmark ? F.bmark(g) : F.base(g);
  return [R(0, 0, TS, TS, "wall"), R(0, g.y0, TS, g.f, "wall.shadow"), R(0, 3, TS, 16, "wallHi"), ...(F.panel ? [R(3, 7, 34, 8, F.panel)] : []),
    R(0, 3, TS, 2, lit), R(0, 17, TS, 2, "wallHi.shadow"), R(39, 3, 1, 35, "wall.shadow"), R(0, 39, TS, 1, "edge"), ...(F.panel ? [] : bm)];
}
function borderV(b) {
  const F = FAM[b.name], lit = F.lit || "wallHi.light";
  return [R(0, 0, TS, TS, "wall"), R(3, 0, 31, TS, "wallHi"), ...(F.panel ? [R(8, 0, 21, TS, F.panel)] : []),
    R(3, 0, 2, TS, lit), R(32, 0, 2, TS, "wallHi.shadow"), R(35, 0, 5, TS, "wall.shadow"), R(3, 39, 31, 1, "wall.shadow"), R(39, 0, 1, TS, "edge")];
}
function cornerT(b) {
  const F = FAM[b.name], lit = F.lit || "wallHi.light";
  return [R(0, 0, TS, TS, "wall"), R(3, 3, 37, 16, "wallHi"), R(3, 3, 31, 37, "wallHi"), ...(F.panel ? [R(8, 8, 32, 6, F.panel), R(8, 8, 21, 32, F.panel)] : []),
    R(3, 3, 37, 2, lit), R(3, 3, 2, 37, lit), R(34, 19, 6, 21, "wall.shadow"), R(34, 17, 6, 2, "wallHi.shadow"), R(39, 19, 1, 21, "edge")];
}
function cornerB(b) {
  const F = FAM[b.name], g = geo(b), lit = F.lit || "wallHi.light";
  return [R(0, 0, TS, TS, "wall"), R(3, g.y0, 37, g.f, "wall.shadow"), R(35, 0, 5, 3, "wall.shadow"), R(3, 0, 31, 19, "wallHi"), R(3, 3, 37, 16, "wallHi"),
    ...(F.panel ? [R(8, 0, 21, 14, F.panel), R(8, 7, 32, 8, F.panel)] : []),
    R(3, 0, 2, 19, lit), R(34, 3, 6, 2, lit), R(3, 17, 37, 2, "wallHi.shadow"), R(32, 0, 2, 3, "wallHi.shadow"), R(3, 39, 37, 1, "edge")];
}
const mirror = (sh) => sh.map((s) => s.r ? {...s, r: [TS - s.r[0] - s.r[2], s.r[1], s.r[2], s.r[3]]} : s.p ? {...s, p: s.p.map(([x, y]) => [TS - x, y])} : {...s, s: s.s.map(([x, y]) => [TS - x, y])});

/* the shape list for one wall code; px = the PIXEL resolution (ARENA's cap
   runs full width there: 01-art.md's open protan item) */
export function wallShapes(b, code, px = false) {
  const F = FAM[b.name], g = geo(b);
  switch (code) {
    case WV.V1: return block(b, px).concat(F.base(g), F.v1(g));
    case WV.V2: return block(b, px).concat(F.base(g), F.v2(g));
    case WV.ACC: return block(b, px).concat(F.base(g), F.acc(g));
    case WV.H: return borderH(b);
    case WV.VL: return borderV(b);
    case WV.VR: return mirror(borderV(b));
    case WV.CTL: return cornerT(b);
    case WV.CTR: return mirror(cornerT(b));
    case WV.CBL: return cornerB(b);
    case WV.CBR: return mirror(cornerB(b));
    default: return block(b, px).concat(F.base(g));
  }
}
/* REAL 3D: which rows of the 2D cell feed the box top and which the sides */
export function topRows(b, code) { return code === WV.VL || code === WV.VR || code === WV.CTL || code === WV.CTR ? [0, TS] : [0, faceY(b)]; }
export function sideRows(b) { return [faceY(b), 38]; }

/* canvas painter shared by the bake (at 0,0) and the vector fallback */
export function paintShapes(c, b, shapes, px0, py0) {
  for (const s of shapes) {
    const col = slot2d(b, s.c);
    if (s.r) { c.fillStyle = col; c.fillRect(px0 + s.r[0], py0 + s.r[1], s.r[2], s.r[3]); continue; }
    c.beginPath();
    const pts = s.p || s.s;
    c.moveTo(px0 + pts[0][0], py0 + pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(px0 + pts[i][0], py0 + pts[i][1]);
    if (s.p) { c.closePath(); c.fillStyle = col; c.fill(); }
    else { c.strokeStyle = col; c.lineWidth = s.w; c.lineCap = "square"; c.lineJoin = "miter"; c.stroke(); }
  }
}
