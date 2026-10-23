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
/* detail pass 2026-10-23: more derived steps, still black / white over a wall
   slot (or over a step of one), so every hex stays in the wall family. PIXEL
   never sees these: its detail is authored on the art grid (px branches). */
const OV = {"wall.outline": ["#000000", "wall", 0.6], "wall.shadow": ["#000000", "wall", 0.35], "wall.light": ["#ffffff", "wall", 0.15], "wallHi.light": ["#ffffff", "wallHi", 0.3], "wallHi.shadow": ["#000000", "wallHi", 0.2],
  "wallHi.spec": ["#ffffff", "wallHi", 0.55], "wallHi.grain": ["#ffffff", "wallHi", 0.14], "wallHi.dim": ["#000000", "wallHi", 0.08], "wallHi.pit": ["#000000", "wallHi", 0.14],
  "wall.pit": ["#000000", "wall", 0.2], "wall.grain": ["#ffffff", "wall", 0.09],
  "face.grain": ["#ffffff", "wall.shadow", 0.1], "face.pit": ["#000000", "wall.shadow", 0.28], "face.ao": ["#000000", "wall.shadow", 0.34],
  "panel.pit": ["#000000", "wall.light", 0.13], "panel.grain": ["#ffffff", "wall.light", 0.12]};
/* the 1px outer ring: plain wall unless it fails dL* >= 15 against a floor
   (measured in 01-art.md section 3): SAND and VOID take a wall step */
const EDGE = {SAND: "wall.outline", VOID: "wallHi.shadow"};
const hx2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const over = (hi, lo, a) => "#" + hx2(hi).map((v, i) => Math.round(a * v + (1 - a) * hx2(lo)[i]).toString(16).padStart(2, "0")).join("");
export function edgeSlot(b) { return EDGE[b.name] || "wall"; }
export function slot2d(b, s) {
  if (s === "edge") s = edgeSlot(b);
  if (s.includes("|")) s = s.split("|")[0];
  const o = OV[s];
  return o ? over(o[0], OV[o[1]] ? slot2d(b, o[1]) : b[o[1]], o[2]) : b[s];
}

const R = (x, y, w, h, c) => ({r: [x, y, w, h], c});
const P = (p, c) => ({p, c});
const S = (s, w, c) => ({s, w, c});
/* 2D-only highlight: a 1-art-px core samples as a dotted line in PIXEL */
const np = (x) => ({...x, npx: true});
const OCT = (k, d) => [[k, d], [TS - k, d], [TS - d, k], [TS - d, TS - k], [TS - k, TS - d], [k, TS - d], [d, TS - k], [d, k]];
const meander = (x0, x1, ya, yb, st) => { const o = []; let up = true; for (let x = x0; x <= x1; x += st) { o.push([x, up ? ya : yb], [Math.min(x + st, x1), up ? ya : yb]); up = !up; } return o; };
/* the lit crest of a tube: its centre line nudged toward the key light */
const sh1 = (p) => p.map(([x, y]) => [x - 0.7, y - 0.7]);
/* Catmull-Rom through the points: roots are smooth tubes, never a jagged crack */
const curve = (p, n = 6) => { const o = []; for (let i = 0; i < p.length - 1; i++) { const a = p[Math.max(0, i - 1)], b = p[i], c = p[i + 1], d = p[Math.min(p.length - 1, i + 2)]; for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; o.push([0, 1].map((j) => 0.5 * (2 * b[j] + (c[j] - a[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (3 * b[j] - a[j] - 3 * c[j] + d[j]) * t3))); } } o.push(p[p.length - 1]); return o; };

/* Each family: base mark, v1, v2, acc (one per room), plus bmark (the mark
   the rampart border repeats; a facet polygon would repeat as a sawtooth).
   lit = the cap bevel step (overrides measured in 01-art.md section 3),
   panel = CROWN's stone panel inside the gilt frame, px = PIXEL-only remaps. */
export const FAM = {
  JUNGLE: {name: "TEMPLE STONE", px: {"wallHi.shadow": "wall"},
    base: () => [S([[6, 11], [34, 11]], 1, "wallHi.shadow")],
    v1: (g) => { const a = curve([[2, 12], [9, 9], [16, 10], [23, 14], [29, 19], [33, g.y0 + 3], [36, 37]]); return [S(a, 4.4, "wall.outline"), np(S(a, 2, "wall")), np(S(sh1(a), 0.8, "wall.light"))]; },
    v2: (g) => [S(meander(5, 35, g.y0 + 3, g.y0 + g.f - 4, 5), 1.4, "wall.outline")],
    acc: (g) => { const a = curve([[9, 3], [11, 10], [8, 17], [11, g.y0 + 2], [9, 37]]), b = curve([[29, 3], [26, 9], [29, 16], [26, g.y0 + 4], [29, 37]]), t = curve([[11, 10], [15, 12], [19, 12]]); return [S(a, 4.6, "wall.outline"), S(b, 4.6, "wall.outline"), S(t, 3, "wall.outline"), np(S(a, 2, "wall")), np(S(b, 2, "wall")), np(S(t, 1, "wall")), np(S(sh1(a), 0.8, "wall.light")), np(S(sh1(b), 0.8, "wall.light"))]; },
    names: ["root wrap", "fret band", "root-bound"]},
  ICE: {name: "GLACIER BLOCK", lit: "wallHi", pxNoWedge: true, pxNoAO: true,
    base: () => [P([[38, 6], [38, 17], [14, 17]], "wallHi.shadow")], bmark: () => [],
    v1: (g) => [R(8, g.y0 + 3, 2, 12, "wallHi"), S([[9, g.y0 + 5], [14, g.y0 + 3]], 2, "wallHi"), S([[9, g.y0 + 9], [14, g.y0 + 7]], 2, "wallHi"),
      R(26, g.y0 + 3, 2, 12, "wallHi"), S([[27, g.y0 + 4], [32, g.y0 + 9]], 2, "wallHi")],
    v2: (g) => [[7, 9], [15, 12], [24, 7], [32, 10]].flatMap(([x, l]) => [P([[x - 2, g.y0], [x, g.y0], [x, g.y0 + l]], "wallHi"), P([[x, g.y0], [x + 2, g.y0], [x, g.y0 + l]], "wall.outline")]),
    acc: (g) => [P([[2, g.y0], [38, g.y0], [38, g.y0 + 2], [35, g.y0 + 11], [32, g.y0 + 2], [27, g.y0 + 7], [23, g.y0 + 2], [18, g.y0 + 14], [14, g.y0 + 2], [9, g.y0 + 8], [6, g.y0 + 2], [2, g.y0 + 4]], "wallHi.shadow"),
      ...[[35, 11], [27, 7], [18, 14], [9, 8]].map(([x, l]) => P([[x, g.y0 + 2], [x + 2, g.y0 + 2], [x, g.y0 + l]], "wall.outline")),
      S([[5, 8], [15, 8]], 1.5, "wall.shadow"), S([[19, 12], [34, 12]], 1.5, "wall.shadow"), S([[8, 15], [17, 15]], 1.5, "wall.shadow")],
    names: ["carved runes", "icicles", "frozen fringe"]},
  FACTORY: {name: "PLATE STEEL",
    /* bolts catch the key light: lit top-left pixel, dark lower-right rim */
    base: () => [[5, 6], [32, 6], [5, 13], [32, 13]].flatMap(([x, y]) => [R(x, y, 3, 3, "wall.outline"), R(x, y, 2, 2, "wallHi.shadow|wall.outline"), R(x, y, 1, 1, "wallHi.spec|wall.outline")]),
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
    v1: () => [10, 14, 18, 22].flatMap((x) => [np(R(x + 2, 8, 1, 9, "wall.shadow")), R(x, 7, 2, 9, "wallHi.light|wall.light")]).concat([np(S([[8, 15.4], [25, 9.4]], 1, "wall.shadow")), S([[8, 14], [25, 8]], 2, "wallHi.light|wall.light")]),
    v2: () => [np(R(14, 7, 14, 1, "wall.shadow")), np(R(15, 16, 12, 1, "wall.shadow")), np(R(18, 8, 1, 6, "wall.shadow")), np(R(24, 8, 1, 6, "wall.shadow")), R(13, 5, 14, 2, "wallHi.light|wall.light"), R(14, 14, 12, 2, "wallHi.light|wall.light"), R(16, 7, 2, 7, "wallHi.light|wall.light"), R(22, 7, 2, 7, "wallHi.light|wall.light")],
    acc: () => [np(R(6, 12, 28, 1, "wall.shadow")), R(6, 10, 28, 2, "wallHi.light|wall.light"), ...[[9, -1], [15, 1], [21, -1], [27, 1]].flatMap(([x, d]) => [np(P([[x + 1, 12 + 3.5 * d], [x + 4, 12 + 2 * d], [x + 7, 12 + 3.5 * d], [x + 4, 12 + 5.5 * d]], "wall.shadow")), P([[x, 11 + 3.5 * d], [x + 3, 11 + 2 * d], [x + 6, 11 + 3.5 * d], [x + 3, 11 + 5.5 * d]], "wallHi.light|wall.light")])],
    names: ["tally marks", "carved column", "laurel"]},
  SAND: {name: "SANDSTONE",
    base: () => [S([[3, 8], [12, 7], [22, 9], [37, 8]], 1.2, "wallHi.shadow"), S([[3, 9.4], [12, 8.4], [22, 10.4], [37, 9.4]], 1, "wallHi.light"), S([[3, 14], [14, 15], [26, 13], [37, 14]], 1.2, "wallHi.shadow"), S([[3, 15.4], [14, 16.4], [26, 14.4], [37, 15.4]], 1, "wallHi.light")],
    v1: (g) => [P([[2, 38], [2, g.y0 - 1], [9, g.y0 - 2], [17, g.y0 + 2], [24, 38]], "wallHi.light")],
    v2: (g) => [6, 17, 28].flatMap((x) => [R(x, g.y0 + 1, 6, 4, "wallHi.shadow"), R(x, g.y0 + 1, 6, 1, "wallHi.light"), R(x, g.y0 + 5, 6, 2, "wall.outline")]),
    acc: () => [S([[8, 18], [8, 15], [12, 15], [12, 12], [16, 12], [16, 9], [24, 9]], 1.3, "wallHi.shadow"), S([[24, 9], [24, 12], [28, 12], [28, 15], [32, 15], [32, 18]], 1.3, "wallHi.light"), S([[9, 18], [31, 18]], 1, "wallHi.light")],
    names: ["sand drift", "beam ends", "step relief"]},
  VOID: {name: "OBSIDIAN MONOLITH", lit: "wallHi", pxNoAO: true, px: {"wallHi.shadow": "wallHi"},
    base: () => [P([[22, 5], [36, 5], [36, 17], [16, 17]], "wallHi.shadow")], bmark: () => [],
    v1: (g) => [S([[5, g.y0 + 5], [15, g.y0 + 5], [19, g.y0 + 9], [35, g.y0 + 9]], 1.5, "wallHi")],
    v2: (g) => [P([[2, 5], [9, 5], [6, 17], [2, 17]], "wallHi.shadow"), P([[21, g.y0 + 2.5], [27.5, g.y0 + 9], [21, g.y0 + 15.5], [14.5, g.y0 + 9]], "wallHi")],
    acc: (g) => [S([[20, g.y0 + 2], [20, g.y0 + 13]], 2, "wallHi"), S([[20, g.y0 + 5], [25, g.y0 + 2]], 1.5, "wallHi"), S([[20, g.y0 + 9], [15, g.y0 + 12]], 1.5, "wallHi")],
    names: ["crystal inlay", "faceted cap", "rune slit"]},
  CROWN: {name: "ROYAL MASONRY", panel: "wall.light", lit: "wallHi", pxNoWedge: true,
    base: (g) => [R(2, g.y0 + 5, 36, 1, "wall.outline")],
    v1: (g) => [R(9, 9, 6, 1.5, "wallHi"), R(9, 9, 1.5, 5, "wallHi"), R(25, 9, 6, 1.5, "wallHi"), R(29.5, 9, 1.5, 5, "wallHi"), R(19, g.y0 + 2, 2, 2, "wallHi")],
    v2: (g) => [8, 15, 22, 29].flatMap((x) => [R(x, g.y0 + 7, 3, 3, "wallHi"), R(x, g.y0 + 10, 3, 1, "wall.outline")]),
    acc: (g) => [P([[14, g.y0], [26, g.y0], [24, 38], [16, 38]], "wall.light"), S([[14, g.y0], [16, 38]], 1.2, "wallHi"), S([[26, g.y0], [24, 38]], 1.2, "wallHi"), R(14, g.y0, 12, 1.2, "wallHi")],
    names: ["gilt corners", "gilt studs", "keystone"]},
};

function geo(b) { const f = faceH(b); return {f, y0: 38 - f}; }

/* ---- detail pass 2026-10-23: material micro-texture + light ----
   One key light from the top left (the REAL 3D key sits at -x +y +z), so
   every piece gets: a lit cap bevel with a specular top edge, a shade
   wedge at the cap's lower right, a soft inner shadow under the cap, a lit
   left / dark right face edge and contact AO at the foot. Texture is a
   deterministic stamp scatter (fmix32 over x, y, salt: never Math.random,
   never world.rng) authored at the look's own grid: 1 logical px for
   CLASSIC (also the REAL 3D strip), 2x2 on the PIXEL art grid, where PIXEL
   names its slots directly and dithers selectively (checker between two
   ramp steps). Built detail only (W3): grain, strata, brushing, seams,
   frost, sheen; never a crack. "Dim" worlds (F.lit set: ICE WATER VOID
   CROWN) may not go above wallHi on the cap (01-art.md section 3), so their
   cap body sits a step under wallHi and the bevel / sheen / frost are pure
   wallHi: light by contrast, never a brighter hex. */
const fmix = (h) => { h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16; return h >>> 0; };
const hh = (x, y, s) => fmix((Math.imul(x + 11, 0x85ebca6b) ^ Math.imul(y + 7, 0xc2b2ae35) ^ Math.imul(s + 3, 0x9e3779b1)) >>> 0) / 4294967296;
const snap = (v, px) => (px ? Math.ceil(v / 2) * 2 : v);
/* scattered stamps merged into horizontal runs (dozens per tile, not hundreds) */
function speck(rc, d, c, s, px) {
  if (!rc) return [];
  const [x, y, w, h] = rc, k = px ? 2 : 1, o = [];
  for (let j = snap(y, px); j + k <= y + h; j += k) {
    let run = -1;
    for (let i = snap(x, px); ; i += k) {
      const inside = i + k <= x + w, on = inside && hh(i, j, s) < d;
      if (on && run < 0) run = i;
      if (!on && run >= 0) { o.push(R(run, j, i - run, k, c)); run = -1; }
      if (!inside) break;
    }
  }
  return o;
}
/* n horizontal runs of hashed length: brushing, strata dashes, wet streaks */
function streaks(rc, n, c, s, px, lo = 3, hi = 10) {
  if (!rc) return [];
  const [x, y, w, h] = rc, k = px ? 2 : 1, o = [];
  for (let t = 0; t < n; t++) {
    const L = snap(lo + Math.floor(hh(t, 1, s) * (hi - lo)), px), X = snap(x + Math.floor(hh(t, 2, s) * Math.max(1, w - L)), px), Y = snap(y + Math.floor(hh(t, 3, s) * Math.max(1, h - k)), px);
    if (Y + k <= y + h && X < x + w) o.push(R(X, Y, Math.min(L, x + w - X), k, c));
  }
  return o;
}
/* PIXEL selective dither: a 2x2 checker of one slot over a rect */
function dith(rc, c, par = 0) {
  const [x, y, w, h] = rc, o = [];
  for (let j = snap(y, true); j + 2 <= y + h; j += 2) for (let i = snap(x, true); i + 2 <= x + w; i += 2) if (((i + j) / 2 + par) & 1) o.push(R(i, j, 2, 2, c));
  return o;
}
const vline = (x, y, h, c) => R(x, y, 1, h, c);
/* masonry joints: one bed joint and staggered perpends; 1 px in CLASSIC, a
   2-px art line in PIXEL */
function courses(rc, c, s, px, step = 13) {
  if (!rc || rc[3] < 6) return [];
  const [x, y, w, h] = rc, k = px ? 2 : 1, mid = snap(y + Math.floor(h / 2) - (px ? 0 : 1), px), o = [R(x, mid, w, k, c)];
  const off = Math.floor(hh(0, 0, s) * step);
  for (let i = x + 4 + (off % 6); i < x + w - 3; i += step) o.push(R(snap(i, px), y, k, mid - y, c));
  for (let i = x + 4 + ((off + Math.floor(step / 2)) % step); i < x + w - 3; i += step) o.push(R(snap(i, px), mid + k, k, y + h - mid - k, c));
  return o;
}
function moss(rc, s) {
  if (!rc || rc[3] < 6) return [];
  const [x, y, w, h] = rc, mid = y + Math.floor(h / 2) - 1, o = [];
  for (let i = x + 2; i < x + w - 3; i += 5) if (hh(i, mid, s) < 0.45) { o.push(R(i, mid - 1, 3, 1, "wall")); if (hh(i, 0, s) < 0.5) o.push(R(i + 1, mid - 2, 1, 1, "wall")); }
  return o;
}
function frost(rc, c, s, px) {
  if (!rc) return [];
  const [x, y, w, h] = rc, k = px ? 2 : 1;
  return [...speck([x, y, w, k * 2], px ? 0.18 : 0.22, c, s, px), ...speck([x, y + k * 2, k * 2, h - k * 2], px ? 0.18 : 0.22, c, s + 7, px), ...speck([x + k * 2, y + k * 2, w - k * 2, h - k * 2], px ? 0.03 : 0.05, c, s + 9, px)];
}
function inner(rc) {
  if (!rc) return [];
  const [x, y, , h] = rc;
  return [S([[x + 6, y + h - 3], [x + 14, y + 3]], 1, "wallHi"), S([[x + 10, y + h - 3], [x + 17, y + 4]], 1, "wallHi"), S([[x + 21, y + h - 4], [x + 25, y + 4]], 1, "wallHi")];
}
function refract(rc, s) {
  if (!rc || rc[3] < 5) return [];
  const [x, y, w, h] = rc, o = [];
  for (let t = 0; t < 4; t++) { const X = x + 3 + Math.floor(hh(t, 5, s) * (w - 6)), L = 2 + Math.floor(hh(t, 6, s) * (h - 4)); o.push(vline(X, y + 1 + Math.floor(hh(t, 7, s) * Math.max(1, h - L - 2)), L, "face.grain")); }
  return o;
}
function wet(rc) {
  if (!rc) return [];
  const [x, y] = rc;
  return [R(x + 4, y + 3, 12, 1, "wallHi"), R(x + 6, y + 4, 5, 1, "wallHi"), R(x + 19, y + 3, 4, 1, "wallHi")];
}
function damp(rc, s) {
  if (!rc) return [];
  const [x, y, w, h] = rc, t = y + Math.round(h * 0.6), o = [R(x, t - 1, w, 1, "face.grain")];
  for (let i = x; i < x + w; i++) if (hh(i, t, s) < 0.55) o.push(R(i, t - 2 - (hh(i, 1, s) < 0.3 ? 1 : 0), 1, 1 + (hh(i, 1, s) < 0.3 ? 1 : 0), "face.pit"));
  return o;
}
function tooling(rc, c, s) {
  if (!rc) return [];
  const [x, y, w, h] = rc, o = [];
  for (let j = y + 1; j < y + h - 2; j += 3) for (let i = x + 1 + (j % 2); i < x + w - 2; i += 4) if (hh(i, j, s) < 0.42) o.push(S([[i, j + 2], [i + 2, j]], 0.8, c));
  return o;
}
function strata(rc, px, s) {
  if (!rc || rc[3] < 3) return [];
  const [x, y, w, h] = rc, k = px ? 2 : 1, o = [];
  let lt = true;
  for (let j = y + k; j + k <= y + h; j += px ? 4 : 3) {
    const c = lt ? (px ? "wall.light" : "wall.grain") : (px ? "wall.shadow" : "wall.pit");
    let run = -1, rdy = 0;
    for (let i = x; ; i += k) {
      const inside = i < x + w, dy = px ? 0 : (Math.sin((i + hh(0, j, s) * 20) / 5) > 0.55 ? 1 : 0);
      const on = inside && hh(i, j, s + 3) < (px ? 0.55 : lt ? 0.7 : 0.4) && j + dy + k <= y + h;
      if (run >= 0 && (!on || dy !== rdy)) { o.push(R(run, snap(j + rdy, px), i - run, k, c)); run = -1; }
      if (on && run < 0) { run = i; rdy = dy; }
      if (!inside) break;
    }
    lt = !lt;
  }
  return o;
}
function sheen(rc) {
  if (!rc) return [];
  const [x, y, , h] = rc;
  return [P([[x + 3, y + h], [x + 8, y + h], [x + 17, y], [x + 12, y]], "wallHi"), P([[x + 10, y + h], [x + 11.5, y + h], [x + 20.5, y], [x + 19, y]], "wallHi")];
}
function glint(rc, px) {
  if (!rc) return [];
  const cx = rc[0] + 15, cy = rc[1] + 3;
  return px ? [] : [R(cx - 2, cy, 5, 1, "wallHi"), R(cx, cy - 2, 1, 5, "wallHi")];
}
/* a stone panel set INTO the gilt frame: shadow on its top / left inner
   edge, light on its bottom / right, one joint, sparse grain */
function inset(rc, s) {
  if (!rc) return [];
  const [x, y, w, h] = rc, j = x + Math.round(w * 0.45);
  return [...speck(rc, 0.035, "panel.pit", s, false), R(x - 1, y - 1, w + 2, 1, "panel.pit"), R(x - 1, y - 1, 1, h + 2, "panel.pit"), R(x - 1, y + h, w + 2, 1, "panel.grain"), R(x + w, y - 1, 1, h + 2, "panel.grain"), vline(j, y, h, "panel.pit"), vline(j + 1, y, h, "panel.grain")];
}
function gilt(rc) {
  if (!rc) return [];
  const [x, y, w, h] = rc;
  return [R(x, y + h - 5, w, 3, "wallHi.dim"), S([[x + 3, y + h - 2], [x + 6, y + h - 5]], 1, "wallHi"), S([[x + w - 9, y + h - 2], [x + w - 6, y + h - 5]], 1, "wallHi")];
}

/* per-world material: rg = {cap, body, face, panel} rects in the piece's
   own frame, s = salt (biome x code), px = the PIXEL grid */
const MAT = {
  /* temple stone: grain on the cap, staggered courses on the face, moss
     tufts (wall-family warm, never a green: a green moss reads as BRICK) */
  JUNGLE: (g, px, s) => px ? [...speck(g.cap, 0.05, "wallHi.shadow", s, px), ...speck(g.body, 0.06, "wall.shadow", s + 1, px), ...courses(g.face, "wall.outline", s, px, 14), ...speck(g.face, 0.06, "wall", s + 2, px)]
    : [...speck(g.cap, 0.05, "wallHi.pit", s, px), ...speck(g.cap, 0.035, "wallHi.grain", s + 1, px), ...speck(g.body, 0.08, "wall.pit", s + 2, px), ...speck(g.body, 0.04, "wall.grain", s + 3, px),
      ...courses(g.face, "face.pit", s, px, 14), ...moss(g.face, s), ...speck(g.face, 0.05, "face.grain", s + 4, px)],
  /* glacier ice: frost speckle crowding the cap rim, inner refraction
     streaks, vertical refraction lines in the deep navy face */
  ICE: (g, px, s) => px ? (g.face ? [[6, 3, 6], [16, 7, 4], [26, 2, 8]].flatMap(([dx, dy, l]) => [R(snap(g.face[0] + dx, true), snap(g.face[1] + dy, true), 2, l, "wall"), R(snap(g.face[0] + dx, true) + 2, snap(g.face[1] + dy, true) + 2, 2, l, "wall.outline")]) : [])
    : [...frost(g.cap, "wallHi", s, px), ...inner(g.cap), ...refract(g.face, s), ...speck(g.face, 0.04, "face.grain", s + 2, px)],
  /* plate steel: horizontal brushing on cap and face */
  FACTORY: (g, px, s) => px ? [...streaks(g.cap, 3, "wallHi.shadow", s, px, 4, 10), ...streaks(g.face, 2, "wall", s + 1, px, 4, 10)]
    : [...streaks(g.cap, 7, "wallHi.grain", s, px, 5, 16), ...streaks(g.cap, 7, "wallHi.pit", s + 1, px, 4, 14), ...streaks(g.body, 3, "wall.grain", s + 2, px, 5, 14), ...streaks(g.face, 4, "face.grain", s + 3, px, 5, 16), ...streaks(g.face, 3, "face.pit", s + 4, px, 4, 12)],
  /* wet pier stone: porous pits, a wet film streak, damp creeping up to the
     water line (the base tide band) */
  WATER: (g, px, s) => px ? [...speck(g.cap, 0.06, "wallHi.shadow", s, px), ...(g.face ? dith([g.face[0], g.face[1] + Math.round(g.face[3] * 0.6) - 2, g.face[2], 2], "wall.outline", 1) : [])]
    : [...speck(g.cap, 0.08, "wallHi.pit", s, px), ...wet(g.cap), ...speck(g.body, 0.07, "wall.pit", s + 2, px), ...damp(g.face, s), ...courses(g.face && [g.face[0], g.face[1], g.face[2], Math.round(g.face[3] * 0.6)], "face.pit", s, px, 16)],
  /* dressed colosseum stone: diagonal claw-chisel tooling, ashlar courses */
  ARENA: (g, px, s) => px ? [...speck(g.face, 0.05, "wall", s + 2, px)]
    : [...tooling(g.cap, "wallHi.pit", s), ...tooling(g.cap, "wallHi.grain", s + 5), ...speck(g.body, 0.05, "wall.grain", s + 1, px), ...courses(g.face, "face.pit", s, px, 12), ...speck(g.face, 0.04, "face.grain", s + 2, px)],
  /* sandstone: wavy strata through the body and face, fine sand grain */
  SAND: (g, px, s) => px ? [...speck(g.cap, 0.05, "wallHi.shadow", s, px), ...strata(g.body, px, s), ...strata(g.face, px, s + 1)]
    : [...speck(g.cap, 0.04, "wallHi.pit", s, px), ...speck(g.cap, 0.06, "wallHi.grain", s + 1, px), ...strata(g.body, px, s), ...strata(g.face, px, s + 1)],
  /* polished obsidian: no grain; a broad diagonal sheen on the cap, one
     crystal-star glint in plain wallHi (never wallHi.light: the MAKO
     collision), a faint diagonal sheen in the face */
  VOID: (g, px, s) => px ? [...glint(g.cap, px), ...(g.face ? [0, 1, 2, 3].map((k) => R(g.face[0] + 6 + k * 2, snap(g.face[1] + g.face[3] - 2 - k * 2, true), 2, 2, "wall")) : [])]
    : [...sheen(g.cap), ...glint(g.cap, px), ...(g.face ? [P([[g.face[0] + 4, g.face[1] + g.face[3]], [g.face[0] + 8, g.face[1] + g.face[3]], [g.face[0] + 13, g.face[1]], [g.face[0] + 9, g.face[1]]], "face.grain"), P([[g.face[0] + 10, g.face[1] + g.face[3]], [g.face[0] + 11, g.face[1] + g.face[3]], [g.face[0] + 16, g.face[1]], [g.face[0] + 15, g.face[1]]], "face.grain")] : [])],
  /* royal masonry: grained stone panel with a joint, gilt sheen on the
     frame (lit top, dimmed body, diagonal glints), coursed face */
  CROWN: (g, px, s) => px ? [...speck(g.panel, 0.08, "wall", s, px), ...speck(g.face, 0.05, "wall", s + 2, px)]
    : [...gilt(g.cap), ...inset(g.panel, s), ...courses(g.face, "face.pit", s, px, 12)],
};

/* grammar G + light: chamfered monolith (square-ish chamfer, bricks keep
   round corners), edge ring, face band at the PIXEL faceRows height, cap
   36x16 with a lit top/left bevel, a specular top edge, a shaded bottom /
   right bevel, inner shadow under the cap, contact AO at the foot */
function block(b, px, salt) {
  const F = FAM[b.name], g = geo(b), dim = !!F.lit, lit = F.lit || "wallHi.light", full = px && F.pxCapFull, cx = full ? 0 : 2, cw = full ? 40 : 36;
  const body = g.y0 > 20 ? [2, 20, 36, g.y0 - 20] : null, face = [2, g.y0 + 1, 36, g.f - 3];
  const capBody = dim && !px ? "wallHi.dim" : "wallHi";
  const sh = [P(OCT(3, 0), "edge"), P(OCT(3, 1), "wall"), R(2, g.y0, 36, g.f, "wall.shadow"), R(cx, 3, cw, 16, capBody), ...(F.panel ? [R(7, 7, 26, 8, F.panel)] : [])];
  sh.push(...MAT[b.name]({cap: [4, 5, 32, 12], body, face, panel: F.panel ? [8, 8, 24, 6] : null}, px, salt));
  if (px) {
    /* PIXEL light: a checker shade wedge at the cap's lower right (the one
       selective dither every family shares) and a contact AO row */
    if (!F.pxNoWedge) sh.push(...dith([24, 12, 12, 4], "wallHi.shadow", 0), ...dith([30, 8, 6, 4], "wallHi.shadow", 0));
    if (!F.pxNoAO) sh.push(R(4, 36, 32, 2, "wall.outline"));
  } else {
    sh.push(P([[36, 9], [36, 17], [24, 17]], dim ? "wallHi.pit" : "wallHi.dim"));
    if (!dim) sh.push(P([[4, 5], [17, 5], [4, 11]], "wallHi.grain"));
    if (body) sh.push(R(2, 19, 36, 1, "wall.pit"), R(2, 20, 2, body[3], "wall.grain"), R(36, 20, 2, body[3], "wall.pit"));
    sh.push(R(2, g.y0, 36, 1, "face.pit"), R(2, g.y0 + 1, 2, g.f - 3, "face.grain"), R(36, g.y0 + 1, 2, g.f - 3, "face.pit"), R(2, 36, 36, 2, "face.ao"));
  }
  sh.push(R(cx, 3, cw, 2, lit), R(2, 3, 2, 16, lit), R(2, 17, full ? 38 : 36, 2, "wallHi.shadow"), R(36, 5, 2, 12, "wallHi.shadow"));
  if (!px && !dim) sh.push(R(2, 3, 20, 1, "wallHi.spec"), R(2, 3, 1, 9, "wallHi.spec"), R(3, 4, 1, 1, "wallHi.spec"));
  return sh;
}
/* rampart pieces: the cap runs edge to edge so the frame reads as ONE
   structure; plain (no variants on the border, ruling), same material and
   light as the pillars */
function lightH(b, px, x0, w, g) {
  const dim = !!FAM[b.name].lit;
  if (px) return [...(FAM[b.name].pxNoAO ? [] : [R(x0, 36, w, 2, "wall.outline")]), ...(FAM[b.name].pxNoWedge ? [] : dith([x0, 16, w, 2], "wallHi.shadow", 1))];
  return [R(x0, 19, w, 1, "wall.pit"), R(x0, g.y0, w, 1, "face.pit"), R(x0, 36, w, 2, "face.ao"), ...(dim ? [] : [R(x0, 3, w, 1, "wallHi.spec")])];
}
function borderH(b, px, salt) {
  const F = FAM[b.name], g = geo(b), lit = F.lit || "wallHi.light", bm = F.bmark ? F.bmark(g) : F.base(g), cb = F.lit && !px ? "wallHi.dim" : "wallHi";
  return [R(0, 0, TS, TS, "wall"), R(0, g.y0, TS, g.f, "wall.shadow"), R(0, 3, TS, 16, cb), ...(F.panel ? [R(3, 7, 34, 8, F.panel)] : []),
    ...MAT[b.name]({cap: [0, 5, TS, 12], body: g.y0 > 20 ? [0, 20, TS, g.y0 - 20] : null, face: [0, g.y0 + 1, TS, g.f - 3], panel: F.panel ? [3, 8, 34, 6] : null}, px, salt),
    R(0, 3, TS, 2, lit), R(0, 17, TS, 2, "wallHi.shadow"), ...lightH(b, px, 0, TS, g), R(39, 3, 1, 35, "wall.shadow"), R(0, 39, TS, 1, "edge"), ...(F.panel ? [] : bm)];
}
function borderV(b, px, salt) {
  const F = FAM[b.name], lit = F.lit || "wallHi.light", cb = F.lit && !px ? "wallHi.dim" : "wallHi";
  return [R(0, 0, TS, TS, "wall"), R(3, 0, 31, TS, cb), ...(F.panel ? [R(8, 0, 21, TS, F.panel)] : []),
    ...MAT[b.name]({cap: [6, 0, 25, TS], body: null, face: null, panel: F.panel ? [9, 0, 19, TS] : null}, px, salt),
    R(3, 0, 2, TS, lit), ...(px || F.lit ? [] : [R(3, 0, 1, TS, "wallHi.spec")]), R(32, 0, 2, TS, "wallHi.shadow"), R(35, 0, 5, TS, "wall.shadow"), ...(px ? [] : [R(35, 0, 1, TS, "face.pit"), R(38, 0, 1, TS, "face.ao")]),
    R(3, 39, 31, 1, "wall.shadow"), R(39, 0, 1, TS, "edge")];
}
function cornerT(b, px, salt) {
  const F = FAM[b.name], lit = F.lit || "wallHi.light", cb = F.lit && !px ? "wallHi.dim" : "wallHi";
  return [R(0, 0, TS, TS, "wall"), R(3, 3, 37, 16, cb), R(3, 3, 31, 37, cb), ...(F.panel ? [R(8, 8, 32, 6, F.panel), R(8, 8, 21, 32, F.panel)] : []),
    ...MAT[b.name]({cap: [6, 6, 26, 32], body: null, face: null, panel: null}, px, salt),
    R(3, 3, 37, 2, lit), R(3, 3, 2, 37, lit), ...(px || F.lit ? [] : [R(3, 3, 37, 1, "wallHi.spec"), R(3, 3, 1, 37, "wallHi.spec")]), R(34, 19, 6, 21, "wall.shadow"), R(34, 17, 6, 2, "wallHi.shadow"), R(39, 19, 1, 21, "edge")];
}
function cornerB(b, px, salt) {
  const F = FAM[b.name], g = geo(b), lit = F.lit || "wallHi.light", cb = F.lit && !px ? "wallHi.dim" : "wallHi";
  return [R(0, 0, TS, TS, "wall"), R(3, g.y0, 37, g.f, "wall.shadow"), R(35, 0, 5, 3, "wall.shadow"), R(3, 0, 31, 19, cb), R(3, 3, 37, 16, cb),
    ...(F.panel ? [R(8, 0, 21, 14, F.panel), R(8, 7, 32, 8, F.panel)] : []),
    ...MAT[b.name]({cap: [6, 0, 26, 17], body: g.y0 > 20 ? [5, 20, 35, g.y0 - 20] : null, face: [5, g.y0 + 1, 35, g.f - 3], panel: null}, px, salt),
    R(3, 0, 2, 19, lit), R(34, 3, 6, 2, lit), R(3, 17, 37, 2, "wallHi.shadow"), R(32, 0, 2, 3, "wallHi.shadow"), ...lightH(b, px, 3, 37, g), R(3, 39, 37, 1, "edge")];
}
const mirror = (sh) => sh.map((s) => s.r ? {...s, r: [TS - s.r[0] - s.r[2], s.r[1], s.r[2], s.r[3]]} : s.p ? {...s, p: s.p.map(([x, y]) => [TS - x, y])} : {...s, s: s.s.map(([x, y]) => [TS - x, y])});

/* the shape list for one wall code; px = the PIXEL resolution (ARENA's cap
   runs full width there: 01-art.md's open protan item) */
export function wallShapes(b, code, px = false) {
  const F = FAM[b.name], g = geo(b), salt = code * 97 + b.name.length * 13 + b.name.charCodeAt(0);
  switch (code) {
    case WV.V1: return block(b, px, salt).concat(F.base(g), F.v1(g));
    case WV.V2: return block(b, px, salt).concat(F.base(g), F.v2(g));
    case WV.ACC: return block(b, px, salt).concat(F.base(g), F.acc(g));
    case WV.H: return borderH(b, px, salt);
    case WV.VL: return borderV(b, px, salt);
    case WV.VR: return mirror(borderV(b, px, salt));
    case WV.CTL: return cornerT(b, px, salt);
    case WV.CTR: return mirror(cornerT(b, px, salt));
    case WV.CBL: return cornerB(b, px, salt);
    case WV.CBR: return mirror(cornerB(b, px, salt));
    default: return block(b, px, salt).concat(F.base(g));
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
