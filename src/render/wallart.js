/* Wall families (wall round 2026-10-21, THROWAWAY prototype; direction B
   LIVING WORLD without cracks, per 03-rulings.md). One shape list per
   (biome, code) in a 40x40 tile, authored ONCE in wall SLOTS and resolved per
   look: CLASSIC 2D (and the REAL 3D strip, which is painted from these lists)
   resolves a step as the sprites.js idiom, black / white over the base hex,
   or a mix of two wall slots; PIXEL resolves it through pxRamp
   (tools/walls/genpx.mjs turns these lists into slot-grid strings in
   pixel/art/walls.js). Every variant is BUILT detail (roots wrapped round,
   carvings, plates, studs, seams), never damage. Shapes: {r:[x,y,w,h]} rect,
   {p:[[x,y]..]} polygon, {s:[[x,y]..],w} stroked polyline; c is a slot, and
   "a|b" names the CLASSIC slot a and the PIXEL slot b. Pure data: no DOM, no
   hex but the biome's. */
import {WV} from "./wallvar.js";
import {railOf, bossOf} from "./frameart.js";

export const TS = 40;
export const faceRows = (h) => Math.max(2, Math.min(10, Math.round((h || 0) / 4)));
export const faceH = (b) => faceRows(b.hWall) * 2;
export const faceY = (b) => 38 - faceH(b);
export const WALL_SLOTS = Object.freeze(["wall", "wall.outline", "wall.shadow", "wall.light", "wallHi", "wallHi.light", "wallHi.shadow"]);
/* derived CLASSIC steps: black / white over a wall slot (or over a step of
   one), or "cap.warm", the cap bevel on the gold / sand worlds: wall mixed
   into wallHi, so the shade stays warm instead of going olive / grey (round
   3 maturity pass). Every hex stays in the wall family. */
const OV = {"wall.outline": ["#000000", "wall", 0.6], "wall.shadow": ["#000000", "wall", 0.35], "wall.light": ["#ffffff", "wall", 0.15], "wallHi.light": ["#ffffff", "wallHi", 0.3], "wallHi.shadow": ["#000000", "wallHi", 0.2],
  "wallHi.spec": ["#ffffff", "wallHi", 0.55], "wallHi.grain": ["#ffffff", "wallHi", 0.14], "wallHi.dim": ["#000000", "wallHi", 0.08], "wallHi.pit": ["#000000", "wallHi", 0.14],
  "wall.pit": ["#000000", "wall", 0.2], "wall.grain": ["#ffffff", "wall", 0.09],
  "face.grain": ["#ffffff", "wall.shadow", 0.1], "face.pit": ["#000000", "wall.shadow", 0.28], "face.ao": ["#000000", "wall.shadow", 0.34],
  "panel.pit": ["#000000", "wall.light", 0.13], "panel.grain": ["#ffffff", "wall.light", 0.12],
  "cap.warm": ["wall", "wallHi", 0.42]};
/* the 1px outer ring: plain wall unless it fails dL* >= 15 against a floor
   (measured in 01-art.md section 3): SAND and VOID take a wall step */
const EDGE = {SAND: "wall.outline", VOID: "wallHi.shadow"};
const hx2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const over = (hi, lo, a) => "#" + hx2(hi).map((v, i) => Math.round(a * v + (1 - a) * hx2(lo)[i]).toString(16).padStart(2, "0")).join("");
export function edgeSlot(b) { return EDGE[b.name] || "wall"; }
export function slot2d(b, s) {
  if (s === "edge") s = edgeSlot(b);
  if (s.includes("|")) s = s.split("|")[0];
  const F = FAM[b.name], o = (F && F.ov && F.ov[s]) || OV[s];
  if (!o) return b[s];
  const res = (k) => (k[0] === "#" ? k : OV[k] || (F && F.ov && F.ov[k]) ? slot2d(b, k) : b[k]);
  return over(res(o[0]), res(o[1]), o[2]);
}

const R = (x, y, w, h, c) => ({r: [x, y, w, h], c});
const P = (p, c) => ({p, c});
const S = (s, w, c) => ({s, w, c});
/* 2D-only highlight: a 1-art-px core samples as a dotted line in PIXEL */
const np = (x) => ({...x, npx: true});
/* PIXEL-only shape (authored on the 2-px art grid) */
const xp = (x) => ({...x, xpx: true});
const OCT = (k, d) => [[k, d], [TS - k, d], [TS - d, k], [TS - d, TS - k], [TS - k, TS - d], [k, TS - d], [d, TS - k], [d, k]];
const meander = (x0, x1, ya, yb, st) => { const o = []; let up = true; for (let x = x0; x <= x1; x += st) { o.push([x, up ? ya : yb], [Math.min(x + st, x1), up ? ya : yb]); up = !up; } return o; };
/* the lit crest of a tube: its centre line nudged toward the key light */
const sh1 = (p) => p.map(([x, y]) => [x - 0.7, y - 0.7]);
/* Catmull-Rom through the points: roots are smooth tubes, never a jagged crack */
const curve = (p, n = 6) => { const o = []; for (let i = 0; i < p.length - 1; i++) { const a = p[Math.max(0, i - 1)], b = p[i], c = p[i + 1], d = p[Math.min(p.length - 1, i + 2)]; for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; o.push([0, 1].map((j) => 0.5 * (2 * b[j] + (c[j] - a[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (3 * b[j] - a[j] - 3 * c[j] + d[j]) * t3))); } } o.push(p[p.length - 1]); return o; };
/* a closed outline as a stroke */
const ring = (p) => p.concat([p[0]]);

/* Each family: base mark, v1, v2, acc (one per room), plus bmark (the mark
   the rampart border repeats). lit = the cap bevel's lit step ("dim" worlds:
   nothing above wallHi), shade = its shaded step, face = the face slot,
   ov = family CLASSIC steps (a deeper face on SAND / CROWN), panel =
   CROWN's stone panel inside the gilt frame, px = PIXEL-only remaps,
   det = which caused details the family carries (round 3). */
export const FAM = {
  JUNGLE: {name: "TEMPLE STONE", px: {"wallHi.shadow": "wall"}, face: "wall.shadow|wall.outline", ov: {"wall.shadow": ["#000000", "wall", 0.5]}, shade: "cap.warm|wallHi.shadow", det: {polish: 1},
    base: () => [],
    v1: (g) => { const a = curve([[2, 12], [9, 9], [16, 10], [23, 14], [29, 19], [33, g.y0 + 3], [36, 37]]); return [S(a, 4.4, "wall.outline|wall.shadow"), np(S(a, 2, "wall")), np(S(sh1(a), 1, "wall.light"))]; },
    v2: (g) => [S(meander(5, 35, g.y0 + 2, g.y0 + 5, 5), 1.4, "wall.pit|wall")],
    acc: (g) => { const a = curve([[9, 3], [11, 10], [8, 17], [11, g.y0 + 2], [9, 37]]), b = curve([[29, 3], [26, 9], [29, 16], [26, g.y0 + 4], [29, 37]]), t = curve([[11, 10], [15, 12], [19, 12]]); return [S(a, 4.6, "wall.outline|wall.shadow"), S(b, 4.6, "wall.outline|wall.shadow"), S(t, 3, "wall.outline|wall.shadow"), np(S(a, 2, "wall")), np(S(b, 2, "wall")), np(S(t, 1, "wall")), np(S(sh1(a), 1, "wall.light")), np(S(sh1(b), 1, "wall.light"))]; },
    names: ["root wrap", "fret band", "root-bound"]},
  ICE: {name: "GLACIER BLOCK", lit: "wallHi", shade: "wallHi.shadow|wall.light", pxCap: "wallHi.shadow", pxNoAO: true, det: {polish: 1},
    /* the lower-right facet: a soft diagonal in CLASSIC / REAL 3D only; the
       PIXEL cap keeps a solid one-step bevel (no staircase) */
    base: () => [np(P([[38, 6], [38, 17], [14, 17]], "wallHi.shadow"))], bmark: () => [],
    /* one carved ice-crystal sigil, frost-filled: closed, never a letter */
    v1: (g) => { const y = g.y0, c = [[20, y + 3], [25, y + 7], [25, y + 11], [20, y + 15], [15, y + 11], [15, y + 7]]; return [np(P(c, "wallHi.shadow")), np(P([[20, y + 3], [20, y + 15], [15, y + 11], [15, y + 7]], "wallHi")),
      ...[[2, 9, 10], [4, 8, 11], [6, 7, 12], [8, 7, 12], [10, 7, 12], [12, 8, 11], [14, 9, 10]].flatMap(([d, a, b]) => [xp(R(a * 2, y + d, (10 - a) * 2, 2, "wallHi")), xp(R(20, y + d, (b - 9) * 2, 2, "wallHi.shadow"))])]; },
    v2: (g) => [[7, 9], [15, 12], [24, 7], [32, 10]].flatMap(([x, l]) => [P([[x - 2, g.y0], [x, g.y0], [x, g.y0 + l]], "wallHi"), P([[x, g.y0], [x + 2, g.y0], [x, g.y0 + l]], "wall.outline")]),
    /* frozen fringe below, a frost rim crowding the cap's front edge above */
    acc: (g) => [P([[2, g.y0], [38, g.y0], [38, g.y0 + 2], [35, g.y0 + 11], [32, g.y0 + 2], [27, g.y0 + 7], [23, g.y0 + 2], [18, g.y0 + 14], [14, g.y0 + 2], [9, g.y0 + 8], [6, g.y0 + 2], [2, g.y0 + 4]], "wallHi.shadow"),
      ...[[35, 11], [27, 7], [18, 14], [9, 8]].map(([x, l]) => P([[x, g.y0 + 2], [x + 2, g.y0 + 2], [x, g.y0 + l]], "wall.outline")),
      np(P([[4, 17], [4, 16], [7, 16], [8, 14], [10, 16], [15, 16], [16, 15], [18, 16], [23, 16], [25, 14], [27, 16], [31, 16], [32, 15], [34, 16], [36, 16], [36, 17]], "wallHi")), ...[8, 18, 28].map((x) => xp(R(x, 18, 2, 2, "wallHi")))],
    names: ["crystal inlay", "icicles", "frozen fringe"]},
  FACTORY: {name: "PLATE STEEL", det: {},
    /* bolts catch the key light (lit top-left pixel, dark rim); a 1 px rust
       run bleeds from each lower bolt toward the cap's front edge */
    base: () => [...[[5, 6], [32, 6], [5, 13], [32, 13]].flatMap(([x, y]) => [np(R(x, y, 3, 3, "wall.outline")), np(R(x, y, 2, 2, "wallHi.shadow")), np(R(x, y, 1, 1, "wallHi.spec"))]),
      np(R(6, 16, 1, 3, "wall.pit")), np(R(33, 16, 1, 3, "wall.pit")), ...[[6, 6], [32, 6], [6, 14], [32, 14]].map(([x, y]) => xp(R(x, y, 2, 2, "wall.outline"))), xp(R(6, 16, 2, 2, "wall.shadow")), xp(R(32, 16, 2, 2, "wall.shadow"))],
    v1: () => [R(19, 3, 2, 16, "wallHi.shadow"), R(21, 3, 1, 16, "wallHi.light"), ...[5, 9, 13].map((y) => R(18, y, 4, 1, "wall.shadow"))],
    v2: () => [R(10, 9, 20, 4, "wallHi.shadow"), R(10, 9, 20, 1, "wallHi.light"), R(10, 13, 20, 1, "wall.outline"), R(12, 10, 2, 2, "wall.outline"), R(26, 10, 2, 2, "wall.outline")],
    acc: (g) => [R(2, g.y0 + 1, 36, 5, "wallHi.shadow"), R(2, g.y0 + 1, 36, 1, "wallHi.light"), R(2, g.y0 + 6, 36, 1, "wall.outline"), R(27, 8, 5, g.y0 - 7, "wallHi.shadow"), R(27, 8, 1, g.y0 - 7, "wallHi.light"), R(25, 7, 9, 2, "wall.outline"), R(10, g.y0, 2, 7, "wall.outline")],
    names: ["weld seam", "bolted strap", "pipe run"]},
  WATER: {name: "PIER STONE", lit: "wallHi", det: {polish: 1},
    base: () => [],
    v1: (g) => [[27, 14], [31, 16], [34, 13], [30, 11], [24, 17]].map(([x, y]) => P([[x - 2, y + 2], [x + 2, y + 2], [x, y - 2]], "wallHi.shadow")).concat([[8, g.y0 + 4], [12, g.y0 + 3]].map(([x, y]) => P([[x - 2, y + 2], [x + 2, y + 2], [x, y - 2]], "wallHi.shadow"))),
    v2: () => [R(8, 19, 2, 9, "wall.outline"), R(17, 19, 2, 13, "wall.outline"), R(28, 19, 2, 7, "wall.outline")],
    acc: (g) => [R(9, g.y0 + 1, 22, 3, "wall.light"), R(9, g.y0 + 1, 22, 1, "wallHi"), R(9, g.y0 + 4, 22, 1, "wall.outline"), R(18, g.y0 + 4, 4, 4, "wall.light"), R(7, g.y0 + 1, 2, 2, "wall.outline"), R(31, g.y0 + 1, 2, 2, "wall.outline")],
    names: ["barnacles", "algae drips", "mooring cleat"]},
  ARENA: {name: "COLOSSEUM STONE", px: {"wallHi.shadow": "wallHi", "wall.outline": "wall.shadow"}, pxCapFull: true, det: {stain: 1, polish: 1},
    base: () => [],
    /* tally: four cut bars and one slash. PIXEL spaces the bars one art px
       wider and cuts a 45-degree slash so it never reads as letters */
    v1: () => [10, 14, 18, 22].flatMap((x) => [np(R(x + 2, 8, 1, 9, "wall.shadow")), np(R(x, 7, 2, 9, "wallHi.light"))]).concat([np(S([[8, 15.4], [25, 9.4]], 1, "wall.shadow")), np(S([[8, 14], [25, 8]], 2, "wallHi.light"))],
      [12, 16, 20, 24].map((x) => xp(R(x, 6, 2, 12, "wall.light"))), [5, 6, 7, 8, 9, 10, 11, 12, 13].map((c) => xp(R(c * 2, (8 - Math.round(((c - 5) * 5) / 8)) * 2, 2, 2, "wallHi.light")))),
    v2: () => [np(R(14, 7, 14, 1, "wall.shadow")), np(R(15, 16, 12, 1, "wall.shadow")), np(R(18, 8, 1, 6, "wall.shadow")), np(R(24, 8, 1, 6, "wall.shadow")), R(13, 5, 14, 2, "wallHi.light|wall.light"), R(14, 14, 12, 2, "wallHi.light|wall.light"), R(16, 7, 2, 7, "wallHi.light|wall.light"), R(22, 7, 2, 7, "wallHi.light|wall.light")],
    acc: () => [np(R(6, 12, 28, 1, "wall.shadow")), R(6, 10, 28, 2, "wallHi.light|wall.light"), ...[[9, -1], [15, 1], [21, -1], [27, 1]].flatMap(([x, d]) => [np(P([[x + 1, 12 + 3.5 * d], [x + 4, 12 + 2 * d], [x + 7, 12 + 3.5 * d], [x + 4, 12 + 5.5 * d]], "wall.shadow")), P([[x, 11 + 3.5 * d], [x + 3, 11 + 2 * d], [x + 6, 11 + 3.5 * d], [x + 3, 11 + 5.5 * d]], "wallHi.light|wall.light")])],
    names: ["tally marks", "carved column", "laurel"]},
  SAND: {name: "SANDSTONE", px: {"wallHi.shadow": "wall.light"}, pxStrata: ["wallHi", "wall.outline"], pxCap: "wallHi.light", face: "wall.shadow|wall.outline", shade: "cap.warm|wallHi.shadow", ov: {"wall.shadow": ["#000000", "wall", 0.42]}, det: {stain: 1, polish: 1},
    base: () => [],
    v1: (g) => [P([[2, 38], [2, g.y0 - 1], [9, g.y0 - 2], [17, g.y0 + 2], [24, 38]], "wallHi.light")],
    v2: (g) => [6, 17, 28].flatMap((x) => [R(x, g.y0 + 1, 6, 4, "cap.warm|wall.light"), R(x, g.y0 + 1, 6, 1, "wallHi.light"), R(x, g.y0 + 5, 6, 1, "wall.outline")]),
    acc: () => [S([[8, 18], [8, 15], [12, 15], [12, 12], [16, 12], [16, 9], [24, 9]], 1.3, "cap.warm|wallHi.shadow"), S([[24, 9], [24, 12], [28, 12], [28, 15], [32, 15], [32, 18]], 1.3, "wallHi.light"), S([[9, 18], [31, 18]], 1, "wallHi.light")],
    names: ["sand drift", "beam ends", "step relief"]},
  VOID: {name: "OBSIDIAN MONOLITH", lit: "wallHi", pxNoAO: true, px: {"wallHi.shadow": "wallHi"}, wedge: true,
    base: () => [P([[22, 5], [36, 5], [36, 17], [16, 17]], "wallHi.shadow")], bmark: () => [],
    v1: (g) => [S([[5, g.y0 + 5], [15, g.y0 + 5], [19, g.y0 + 9], [35, g.y0 + 9]], 1.5, "wallHi")],
    v2: (g) => [P([[2, 5], [9, 5], [6, 17], [2, 17]], "wallHi.shadow"), P([[21, g.y0 + 2.5], [27.5, g.y0 + 9], [21, g.y0 + 15.5], [14.5, g.y0 + 9]], "wallHi")],
    acc: (g) => [S([[20, g.y0 + 2], [20, g.y0 + 13]], 2, "wallHi"), S([[20, g.y0 + 5], [25, g.y0 + 2]], 1.5, "wallHi"), S([[20, g.y0 + 9], [15, g.y0 + 12]], 1.5, "wallHi")],
    names: ["crystal inlay", "faceted cap", "rune slit"]},
  CROWN: {name: "ROYAL MASONRY", panel: "wall.light", lit: "wallHi", px: {"wallHi.shadow": "wall"}, face: "wall.shadow|wall.outline", ov: {"wall.shadow": ["#000000", "wall", 0.5]}, det: {stain: 1, polish: 1},
    base: () => [],
    v1: (g) => [R(9, 9, 6, 1.5, "wallHi"), R(9, 9, 1.5, 5, "wallHi"), R(25, 9, 6, 1.5, "wallHi"), R(29.5, 9, 1.5, 5, "wallHi"), R(19, g.y0 + 2, 2, 2, "wallHi")],
    v2: (g) => [8, 15, 22, 29].flatMap((x) => [R(x, g.y0 + 6, 3, 3, "wallHi"), R(x, g.y0 + 9, 3, 1, "wall.outline")]),
    acc: (g) => [P([[14, g.y0], [26, g.y0], [24, 38], [16, 38]], "wall.light"), S([[14, g.y0], [16, 38]], 1.2, "wallHi"), S([[26, g.y0], [24, 38]], 1.2, "wallHi"), R(14, g.y0, 12, 1.2, "wallHi")],
    names: ["gilt corners", "gilt studs", "keystone"]},
};

function geo(b) { const f = faceH(b); return {f, y0: 38 - f}; }
/* the cap body: a step under wallHi on the dim worlds (CLASSIC), the
   family's own step in PIXEL (ICE: a shade under its lit rim) */
const capOf = (F, px) => (px ? F.pxCap || "wallHi" : F.lit ? "wallHi.dim" : "wallHi");

/* ---- material + light (detail pass 2026-10-23, maturity pass round 3) ----
   One key light from the top left (the REAL 3D key sits at -x +y +z): a lit
   cap bevel with a specular top edge, a hard one-step shade on the cap's
   bottom / right edges, an inner shadow under the cap, a lit left / dark
   right face edge and contact AO at the foot. Round 3 cut the filler: no
   all-over speckle, no course / mortar rhythm on any face (that is the
   BRICK's sign), no soft cap wedges (the BRICK's pillow). Marks are hand
   placed and each has a cause: a stain under the cap lip, splash-back at
   the foot, wear polish on the cap's front edge, a rust run under a bolt.
   Only SAND (the one granular stone) keeps a sparse hashed grain (fmix32
   over x, y, salt: never Math.random, never world.rng). "Dim" worlds (F.lit
   set: ICE WATER VOID CROWN) never go above wallHi on the cap, so their cap
   body sits a step under wallHi and the bevel / sheen / frost are pure
   wallHi: light by contrast, never a brighter hex. */
const fmix = (h) => { h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16; return h >>> 0; };
const hh = (x, y, s) => fmix((Math.imul(x + 11, 0x85ebca6b) ^ Math.imul(y + 7, 0xc2b2ae35) ^ Math.imul(s + 3, 0x9e3779b1)) >>> 0) / 4294967296;
const snap = (v, px) => (px ? Math.ceil(v / 2) * 2 : v);
/* scattered stamps merged into horizontal runs (SAND's grain only) */
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
/* n horizontal runs of hashed length: FACTORY's brushing */
function streaks(rc, n, c, s, px, lo = 3, hi = 10) {
  if (!rc) return [];
  const [x, y, w, h] = rc, k = px ? 2 : 1, o = [];
  for (let t = 0; t < n; t++) {
    const L = snap(lo + Math.floor(hh(t, 1, s) * (hi - lo)), px), X = snap(x + Math.floor(hh(t, 2, s) * Math.max(1, w - L)), px), Y = snap(y + Math.floor(hh(t, 3, s) * Math.max(1, h - k)), px);
    if (Y + k <= y + h && X < x + w) o.push(R(X, Y, Math.min(L, x + w - X), k, c));
  }
  return o;
}
const vline = (x, y, h, c) => R(x, y, 1, h, c);
/* claw-chisel tooling on ARENA's cap: two rows of short 1-px diagonal cuts */
function claw(rc, s) {
  if (!rc) return [];
  const [x, y, w] = rc, o = [];
  for (const j of [y + 2, y + 6]) for (let i = x + 2 + (j % 3); i < x + w - 4; i += 4) if (hh(i, j, s) < 0.5) o.push(R(i, j + 2, 1, 1, "wallHi.pit"), R(i + 1, j + 1, 1, 1, "wallHi.pit"), R(i + 2, j, 1, 1, "wallHi.pit"));
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
/* one stone panel set INTO the gilt frame: shadow on its top / left inner
   edge, light on its bottom / right; one piece, no joint */
function inset(rc) {
  if (!rc) return [];
  const [x, y, w, h] = rc;
  return [R(x - 1, y - 1, w + 2, 1, "panel.pit"), R(x - 1, y - 1, 1, h + 2, "panel.pit"), R(x - 1, y + h, w + 2, 1, "panel.grain"), R(x + w, y - 1, 1, h + 2, "panel.grain")];
}
function gilt(rc) {
  if (!rc) return [];
  const [x, y, w, h] = rc;
  return [R(x, y + h - 5, w, 3, "wallHi.dim"), S([[x + 3, y + h - 2], [x + 6, y + h - 5]], 1, "wallHi"), S([[x + w - 9, y + h - 2], [x + w - 6, y + h - 5]], 1, "wallHi")];
}

/* per-world material: g = {cap, body, face, panel} rects in the piece's own
   frame, px = the PIXEL grid, s = salt, code = the wall code */
const MAT = {
  /* temple stone: a clean cap; the face is two big dressed blocks split by
     ONE joint (CLASSIC; PIXEL keeps the face whole), gold moss in the damp
     at the foot (wall-family warm, never a green: green moss reads as BRICK) */
  JUNGLE: (g, px, s, code) => {
    if (!g.face) return [];
    const [x, y, w] = g.face, j = x + 19, o = [];
    if (!px && code !== WV.V2 && code !== WV.H) o.push(vline(j, y, 35 - y, "face.pit"), vline(j + 1, y, 35 - y, "face.grain"));
    o.push(...(px ? [R(x + 4, 36, 4, 2, "wall"), R(x + 6, 34, 2, 2, "wall"), R(x + 24, 36, 2, 2, "wall")] : [R(x + 5, 35, 4, 1, "wall"), R(x + 6, 34, 2, 1, "wall"), R(x + w - 12, 35, 5, 1, "wall"), R(x + w - 10, 34, 1, 1, "wall")]));
    return o;
  },
  /* glacier ice: two refraction streaks inside the cap, two light
     refraction lines in the deep navy face; PIXEL: two slivers, light on
     top, never a dark dash */
  ICE: (g, px) => {
    const o = [];
    if (g.cap && !px) { const [x, y, , h] = g.cap; o.push(S([[x + 7, y + h - 3], [x + 14, y + 3]], 1.2, "wallHi"), S([[x + 20, y + h - 4], [x + 24, y + 4]], 1.2, "wallHi")); }
    if (g.face && !px) { const [x, y] = g.face; o.push(vline(x + 7, y + 3, 6, "face.grain"), vline(x + 27, y + 7, 5, "face.grain")); }
    return o;
  },
  /* plate steel: horizontal brushing on cap and face */
  FACTORY: (g, px, s) => px ? [...streaks(g.cap, 3, "wallHi.shadow", s, px, 4, 10), ...streaks(g.face, 2, "wall", s + 1, px, 4, 10)]
    : [...streaks(g.cap, 6, "wallHi.grain", s, px, 5, 16), ...streaks(g.cap, 5, "wallHi.pit", s + 1, px, 4, 14), ...streaks(g.body, 3, "wall.grain", s + 2, px, 5, 14), ...streaks(g.face, 3, "face.grain", s + 3, px, 5, 16), ...streaks(g.face, 2, "face.pit", s + 4, px, 4, 12)],
  /* wet pier stone: a wet film along the cap's front edge only; the face
     stays dry down to ONE tide line, damp below it (no courses) */
  WATER: (g, px) => {
    const o = [];
    if (g.cap && !px) { const [x] = g.cap; o.push(R(x + 2, 15, 13, 1, "wallHi"), R(x + 18, 15, 10, 1, "wallHi"), R(x + 5, 14, 4, 1, "wallHi")); }
    if (g.face) {
      const [x, y, w, h] = g.face, t = y + Math.round(h * 0.3);
      o.push(...(px ? [R(x, snap(t, true), w, 38 - snap(t, true), "wall.outline"), R(x + 6, snap(t, true) - 2, 4, 2, "wall.outline")]
        : [R(x, t, w, 1, "face.grain"), R(x, t + 1, w, 36 - t - 1, "wall.outline"), R(x + 6, t - 1, 3, 1, "face.pit"), R(x + 21, t - 1, 4, 1, "face.pit")]));
    }
    return o;
  },
  /* dressed colosseum stone: claw-chisel tooling on the cap, a plain face
     and the lit ledge of a plinth at the foot (no speckle, no courses: any
     vertical tick on the face reads as a perpend) */
  ARENA: (g, px, s) => {
    if (px) return g.face ? [R(g.face[0], 32, g.face[2], 2, "wall")] : [];
    const o = claw(g.cap, s);
    if (g.face) o.push(R(g.face[0], 33, g.face[2], 1, "face.grain"));
    return o;
  },
  /* sandstone: sparse sand grain on the cap; the strata run on the side of
     the block, where bedding shows: two long undulating bands, one light,
     one dark, never broken into dashes */
  SAND: (g, px, s) => {
    const o = [];
    if (g.cap && !px) o.push(...speck(g.cap, 0.022, "wallHi.pit", s, px), ...speck(g.cap, 0.012, "wallHi.light", s + 1, px));
    if (g.body) {
      const [x, y, w] = g.body;
      o.push(...(px ? [R(x, y + 2, w, 2, FAM.SAND.pxStrata[0]), R(x, y + 6, w, 2, FAM.SAND.pxStrata[1])]
        : [P([[x, y + 2], [x + 11, y + 1], [x + 24, y + 2], [x + w, y + 1.5], [x + w, y + 3.5], [x + 24, y + 4], [x + 11, y + 3], [x, y + 4]], "wall.grain"), P([[x, y + 6], [x + 14, y + 7], [x + 27, y + 6], [x + w, y + 6.5], [x + w, y + 7.5], [x + 27, y + 7], [x + 14, y + 8], [x, y + 7]], "wall.pit")]));
    }
    return o;
  },
  /* polished obsidian (kept as is): a broad diagonal sheen on the cap, one
     crystal-star glint in plain wallHi (never wallHi.light: the MAKO
     collision), a faint diagonal sheen in the face */
  VOID: (g, px) => px ? [...glint(g.cap, px), ...(g.face ? [0, 1, 2, 3].map((k) => R(g.face[0] + 6 + k * 2, snap(g.face[1] + g.face[3] - 2 - k * 2, true), 2, 2, "wall")) : [])]
    : [...sheen(g.cap), ...glint(g.cap, px), ...(g.face ? [P([[g.face[0] + 4, g.face[1] + g.face[3]], [g.face[0] + 8, g.face[1] + g.face[3]], [g.face[0] + 13, g.face[1]], [g.face[0] + 9, g.face[1]]], "face.grain"), P([[g.face[0] + 10, g.face[1] + g.face[3]], [g.face[0] + 11, g.face[1] + g.face[3]], [g.face[0] + 16, g.face[1]], [g.face[0] + 15, g.face[1]]], "face.grain")] : [])],
  /* royal masonry: one stone panel set in the gilt frame (lit top, dimmed
     body, diagonal glints); the face is plain dark stone */
  CROWN: (g, px) => px ? [] : [...gilt(g.cap), ...inset(g.panel)],
};

/* caused details along a run of cap x0..x0+w (round 3): a stain under the
   cap lip where rain leaves it, wear polish glinting on the cap's front edge
   (dim worlds: plain wallHi, never above it), splash-back grime over the
   contact AO at the foot. PIXEL has room for the stain only. */
function details(F, g, px, x0, w, body) {
  const d = F.det || {}, o = [];
  if (px) {
    if (d.stain && body) o.push(R(x0 + 10, 20, 2, 2, "wall.shadow"));
    return o;
  }
  if (d.polish) { const c = F.lit ? "wallHi" : "wallHi.spec"; o.push(R(x0 + 7, 16, 7, 1, c), R(x0 + w - 12, 16, 3, 1, c)); }
  if (d.stain) { const c = body ? "wall.pit" : "face.pit"; o.push(R(x0 + 10, 19, 1, 4, c), R(x0 + 10, 24, 1, 1, c)); }
  if (d.splash) o.push(R(x0 + 3, 35, 8, 1, "face.pit"), R(x0 + 14, 35, 12, 1, "face.pit"), R(x0 + w - 9, 35, 5, 1, "face.pit"));
  return o;
}

/* grammar G + light: chamfered monolith (square-ish chamfer, bricks keep
   round corners), edge ring, face band at the PIXEL faceRows height, cap
   36x16 with a lit top/left bevel, a specular top edge, a hard shade on the
   bottom / right bevel, inner shadow under the cap, contact AO at the foot */
function block(b, px, salt, code, plain) {
  const F = FAM[b.name], g = geo(b), dim = !!F.lit, lit = F.lit || "wallHi.light", shade = F.shade || "wallHi.shadow", full = px && F.pxCapFull, cx = full ? 0 : 2, cw = full ? 40 : 36;
  const body = g.y0 > 20 ? [2, 20, 36, g.y0 - 20] : null, face = [2, g.y0 + 1, 36, g.f - 3];
  const capBody = capOf(F, px);
  const sh = [P(OCT(3, 0), "edge"), P(OCT(3, 1), "wall"), R(2, g.y0, 36, g.f, F.face || "wall.shadow"), R(cx, 3, cw, 16, capBody), ...(F.panel ? [R(7, 7, 26, 8, F.panel)] : [])];
  if (px && !F.pxNoAO) sh.push(R(4, 36, 32, 2, "wall.outline"));
  if (!plain) sh.push(...MAT[b.name]({cap: [4, 5, 32, 12], body, face, panel: F.panel ? [8, 8, 24, 6] : null}, px, salt, code));
  if (!px) {
    if (F.wedge) sh.push(P([[36, 9], [36, 17], [24, 17]], dim ? "wallHi.pit" : "wallHi.dim"));
    if (body) sh.push(R(2, 19, 36, 1, "wall.pit"), R(2, 20, 2, body[3], "wall.grain"), R(36, 20, 2, body[3], "wall.pit"));
    sh.push(R(2, g.y0, 36, 1, "face.pit"), R(2, g.y0 + 1, 2, g.f - 3, "face.grain"), R(36, g.y0 + 1, 2, g.f - 3, "face.pit"), R(2, 36, 36, 2, "face.ao"));
  }
  sh.push(R(cx, 3, cw, 2, lit), R(2, 3, 2, 16, lit), R(2, 17, full ? 38 : 36, 2, shade), R(36, 5, 2, 12, shade));
  if (!px && !dim) sh.push(R(2, 3, 20, 1, "wallHi.spec"), R(2, 3, 1, 9, "wallHi.spec"), R(3, 4, 1, 1, "wallHi.spec"));
  if (!plain) sh.push(...details(F, g, px, 2, 36, body));
  return sh;
}
/* rampart pieces: the cap runs edge to edge so the frame reads as ONE
   structure; plain (no variants on the border, ruling), same material and
   light as the pillars */
function lightH(b, px, x0, w, g) {
  const F = FAM[b.name], dim = !!F.lit;
  if (px) return F.pxNoAO ? [] : [R(x0, 36, w, 2, "wall.outline")];
  return [R(x0, 19, w, 1, "wall.pit"), R(x0, g.y0, w, 1, "face.pit"), R(x0, 36, w, 2, "face.ao"), ...(dim ? [] : [R(x0, 3, w, 1, "wallHi.spec")])];
}
function borderH(b, px, salt) {
  const F = FAM[b.name], g = geo(b), lit = F.lit || "wallHi.light", shade = F.shade || "wallHi.shadow", cb = capOf(F, px), body = g.y0 > 20 ? [0, 20, TS, g.y0 - 20] : null;
  return [R(0, 0, TS, TS, "wall"), R(0, g.y0, TS, g.f, F.face || "wall.shadow"), R(0, 3, TS, 16, cb), ...(F.panel ? [R(3, 7, 34, 8, F.panel)] : []),
    ...MAT[b.name]({cap: [0, 5, TS, 12], body, face: [0, g.y0 + 1, TS, g.f - 3], panel: F.panel ? [3, 8, 34, 6] : null}, px, salt, WV.H),
    R(0, 3, TS, 2, lit), R(0, 17, TS, 2, shade), ...lightH(b, px, 0, TS, g), ...details(F, g, px, 0, TS, body), R(0, 39, TS, 1, "edge"), ...railOf(b, "h")];
}
/* rt = the right-hand piece: built as the left piece, then mirrored by
   wallShapes, with the two vertical bevels swapped so the lit lip stays on
   the top-left and the shade on the bottom-right of the whole frame */
function borderV(b, px, salt, rt) {
  const F = FAM[b.name], lit = F.lit || "wallHi.light", shade = F.shade || "wallHi.shadow", cb = capOf(F, px), lv = rt ? shade : lit, sv = rt ? lit : shade;
  return [R(0, 0, TS, TS, "wall"), R(3, 0, 31, TS, cb), ...(F.panel ? [R(8, 0, 21, TS, F.panel)] : []),
    ...MAT[b.name]({cap: [6, 0, 25, TS], body: null, face: null, panel: F.panel ? [9, 0, 19, TS] : null}, px, salt, WV.VL),
    R(3, 0, 2, TS, lv), ...(px || F.lit || rt ? [] : [R(3, 0, 1, TS, "wallHi.spec")]), R(32, 0, 2, TS, sv), R(35, 0, 5, TS, "wall.shadow"), ...(px ? [] : [R(35, 0, 1, TS, "face.pit"), R(38, 0, 1, TS, "face.ao")]),
    R(39, 0, 1, TS, "edge"), ...railOf(b, "v")];
}
function cornerT(b, px, salt, rt) {
  const F = FAM[b.name], lit = F.lit || "wallHi.light", shade = F.shade || "wallHi.shadow", cb = capOf(F, px), lv = rt ? shade : lit;
  return [R(0, 0, TS, TS, "wall"), R(3, 3, 37, 16, cb), R(3, 3, 31, 37, cb), ...(F.panel ? [R(8, 8, 32, 6, F.panel), R(8, 8, 21, 32, F.panel)] : []),
    ...MAT[b.name]({cap: [6, 6, 26, 32], body: null, face: null, panel: null}, px, salt, WV.CTL),
    R(3, 3, 37, 2, lit), R(3, 3, 2, 37, lv), ...(px || F.lit || rt ? [] : [R(3, 3, 37, 1, "wallHi.spec"), R(3, 3, 1, 37, "wallHi.spec")]), R(34, 19, 6, 21, "wall.shadow"), R(34, 17, 6, 2, shade), R(39, 19, 1, 21, "edge"), ...bossOf(b)];
}
function cornerB(b, px, salt, rt) {
  const F = FAM[b.name], g = geo(b), lit = F.lit || "wallHi.light", shade = F.shade || "wallHi.shadow", cb = capOf(F, px), lv = rt ? shade : lit;
  return [R(0, 0, TS, TS, "wall"), R(3, g.y0, 37, g.f, F.face || "wall.shadow"), R(35, 0, 5, 3, "wall.shadow"), R(3, 0, 31, 19, cb), R(3, 3, 37, 16, cb),
    ...(F.panel ? [R(8, 0, 21, 14, F.panel), R(8, 7, 32, 8, F.panel)] : []),
    ...MAT[b.name]({cap: [6, 0, 26, 17], body: g.y0 > 20 ? [5, 20, 35, g.y0 - 20] : null, face: [5, g.y0 + 1, 35, g.f - 3], panel: null}, px, salt, WV.CBL),
    R(3, 0, 2, 19, lv), R(34, 3, 6, 2, lit), R(3, 17, 37, 2, shade), R(32, 0, 2, 3, shade), ...lightH(b, px, 3, 37, g), R(3, 39, 37, 1, "edge"), ...bossOf(b, 1.4, 14)];
}
const mirror = (sh) => sh.map((s) => s.r ? {...s, r: [TS - s.r[0] - s.r[2], s.r[1], s.r[2], s.r[3]]} : s.p ? {...s, p: s.p.map(([x, y]) => [TS - x, y])} : {...s, s: s.s.map(([x, y]) => [TS - x, y])});

/* the shape list for one wall code; px = the PIXEL resolution (ARENA's cap
   runs full width there: 01-art.md's open protan item). opts.plain = the
   block form alone (no material, detail or variant), for the marks gate */
export function wallShapes(b, code, px = false, opts = {}) {
  const F = FAM[b.name], g = geo(b), salt = code * 97 + b.name.length * 13 + b.name.charCodeAt(0);
  const keep = (sh) => sh.filter((s) => (px ? !s.npx : !s.xpx));
  if (opts.plain) return code <= WV.ACC ? keep(block(b, px, salt, code, true)) : null;
  switch (code) {
    case WV.V1: return keep(block(b, px, salt, code).concat(F.base(g), F.v1(g)));
    case WV.V2: return keep(block(b, px, salt, code).concat(F.base(g), F.v2(g)));
    case WV.ACC: return keep(block(b, px, salt, code).concat(F.base(g), F.acc(g)));
    case WV.H: return keep(borderH(b, px, salt));
    case WV.VL: return keep(borderV(b, px, salt));
    case WV.VR: return keep(mirror(borderV(b, px, salt, true)));
    case WV.CTL: return keep(cornerT(b, px, salt));
    case WV.CTR: return keep(mirror(cornerT(b, px, salt, true)));
    case WV.CBL: return keep(cornerB(b, px, salt));
    case WV.CBR: return keep(mirror(cornerB(b, px, salt, true)));
    default: return keep(block(b, px, salt, code).concat(F.base(g)));
  }
}

/* REAL 3D: which rows of the 2D cell feed the box top and which the sides */
export function topRows(b, code) { return code === WV.VL || code === WV.VR || code === WV.CTL || code === WV.CTR ? [0, TS] : [0, faceY(b)]; }
export function sideRows(b) { return [faceY(b), 38]; }

/* REAL 3D surface response (round 3): how much each slot catches the key
   as a highlight (gloss 0..255) and how tight that highlight is (shin
   0..255 -> exponent 4..64), per world. A material table painted into the
   wall surface strip, never a per-biome light: the frozen lights are
   untouched. cap = the wallHi family (frame, film, frost, bevel), dim = the
   dimmed cap body, face = the wall family. Matte stone (JUNGLE ARENA SAND)
   takes none. VOID stays low: nothing on a VOID wall may read brighter than
   its wallHi. */
const GLOSS = {ICE: {cap: 150, dim: 70, face: 60, shin: 120}, VOID: {cap: 60, dim: 45, face: 70, shin: 200}, FACTORY: {cap: 80, dim: 80, face: 55, shin: 30},
  CROWN: {cap: 150, dim: 110, face: 0, shin: 70}, WATER: {cap: 110, dim: 45, face: 30, shin: 110}};
export function glossOf(b, s) {
  const G = GLOSS[b.name];
  if (!G) return 0;
  if (s.includes("|")) s = s.split("|")[0];
  if (s.startsWith("panel") || s === "wall.light" && b.name === "CROWN") return 0;
  return s === "wallHi.dim" ? G.dim : s.startsWith("wallHi") || s.startsWith("cap.") ? G.cap : G.face;
}
export const shinOf = (b) => (GLOSS[b.name] ? GLOSS[b.name].shin : 0);

/* canvas painter shared by the bake (at 0,0) and the vector fallback; col =
   the slot resolver (the REAL 3D surface strip paints gloss with it) */
export function paintShapes(c, b, shapes, px0, py0, col0 = slot2d) {
  for (const s of shapes) {
    const col = col0(b, s.c);
    if (s.r) { c.fillStyle = col; c.fillRect(px0 + s.r[0], py0 + s.r[1], s.r[2], s.r[3]); continue; }
    c.beginPath();
    const pts = s.p || s.s;
    c.moveTo(px0 + pts[0][0], py0 + pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(px0 + pts[i][0], py0 + pts[i][1]);
    if (s.p) { c.closePath(); c.fillStyle = col; c.fill(); }
    else { c.strokeStyle = col; c.lineWidth = s.w; c.lineCap = "square"; c.lineJoin = "miter"; c.stroke(); }
  }
}
