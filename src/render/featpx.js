/* PIXEL cells for the eight floor tiles (direction D; hand-pixelled 2026-10-25). The art is pixel/art/feat.js: one hand drawing per tile per heat (BOOSTER,
   TRAP, QUICKSAND, PORTAL, ICE PATCH, GATE) or hand parts in flow x across space (CONVEYOR rails / rollers / chevrons, STREAM banks / water / ripples). This
   file only lays small explicit deltas over it: a slot swap (BOOSTER flare, TRAP armed), lamp / notch patches (TRAP lit 1..4, PORTAL pair), the GATE bars drawn
   shorter, the rim on outer sides of the tiles that join (ICE PATCH, GATE), the ICE sheen on a patch's NW cell, and the CONVEYOR / STREAM phase. Palette-SLOT
   grids only (DPAL in featpxcells.js), never hex; 20x20 art px, 1 art px = 2 logical px, light from the top-left. Baked by pixel/atlas.js (feat), whose cache
   key is ph|biome|kind|h|dir|outer|state|lit|pair, so nothing here reads gx / gy / par or the biome. Heat never changes a hue; VOID never goes past wallHi. */
import {DPAL} from "./featpxcells.js";
import {FEAT_ART} from "./pixel/art/feat.js";

const SIDES = ["N", "E", "S", "W"];
const mk = (f) => Array.from({length: 20}, (_, y) => { let o = ""; for (let x = 0; x < 20; x++) o += f(x, y); return o; });
const at = (rows, x, y, ch) => { if (y < 0 || y >= rows.length || x < 0 || x >= rows[y].length) return; rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1); };
const clampI = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/* the floorPxCell slab's shadow side (bottom / right) on the tile's own border where open floor shows (a feature cell never takes the lit top / left run) */
const SL = {O: "N", K: "J"};
function slab(rows, b) {
  const s = SL[b], put = (x, y) => { if (rows[y][x] === b) at(rows, x, y, s); };
  for (let i = 1; i < 20; i++) { put(i, 19); put(19, i); }
  return rows;
}
const HAND = (k, h) => (FEAT_ART[k] && FEAT_ART[k][h] ? FEAT_ART[k][h].slice() : null);
const swap = (rows, m) => rows.map((r) => r.replace(/./g, (c) => m[c] || c));
const FLARE = {L: "X", K: "L"};
function bloomHand(h, flare) { const r = HAND("BLOOM", h); return r && flare ? swap(r, FLARE) : r; }
/* TRAP armed: the cleats dim one step and four 2 px lamps light in the south rim, left to right (lit 1..4) */
const ARMED = {W: "V", V: "R"}, LAMP = [[16], [15, 16], [15, 16]];
function plateHand(h, on, lit) {
  const r = HAND("PLATE", h);
  if (!r || !on) return r;
  const o = swap(r, ARMED);
  for (const y of LAMP[h]) [4, 7, 10, 13].forEach((x, i) => { at(o, x, y, i < lit ? "W" : "Q"); at(o, x + 1, y, i < lit ? "W" : "Q"); });
  return o;
}
/* tiles that join their neighbours (ICE PATCH, GATE) are drawn as a lone patch; a side that is not outer takes the first interior strip (index k) copied out over
   its k rim strips, so the field runs on into the next cell and the rim stays only where the patch ends */
function join(rows, outer, k, n = k, s = 19 - k) {
  const o = rows.map((r) => [...r]);
  if (!outer.includes("N")) for (let y = 0; y < k; y++) o[y] = o[n].slice();
  if (!outer.includes("S")) for (let y = 20 - k; y < 20; y++) o[y] = o[s].slice();
  for (const r of o) { if (!outer.includes("W")) r.fill(r[k], 0, k); if (!outer.includes("E")) r.fill(r[19 - k], 20 - k); }
  return o.map((r) => r.join(""));
}
const SHEEN = [[3, 7], [4, 6], [5, 5], [6, 4], [7, 3], [4, 7], [5, 6], [6, 5], [7, 4]];
function glideHand(h, outer) {
  const r = HAND("GLIDE", h);
  if (!r) return r;
  const o = join(r, outer, 3);
  if (outer.includes("N") && outer.includes("W")) for (const [x, y] of SHEEN) at(o, x, y, "L");
  return o;
}
/* GATE: the hand frame is the shut portcullis (bars rows 4..15); open (4) and half (7) keep each bar's body and pull its last two rows (the tip) up under it.
   N joins carry the bar tops on, S joins the sill */
function gateHand(h, st, outer) {
  const r = HAND("GATE", h);
  if (!r) return r;
  const len = [4, 7, 12][st], o = r.slice();
  if (len < 12) for (let x = 2; x < 18; x++) if (r[8][x] !== "B") for (let t = 0; t < 12; t++) at(o, x, 4 + t, t >= len ? "B" : r[4 + t + (t >= len - 2 ? 12 - len : 0)][x]);
  return join(o, outer, 2, 4, 17);
}
/* CONVEYOR from its hand parts (pixel/art/feat.js BELT) in flow x across space, turned to the dir; the rollers scroll with ph, rails, bolts, caps and chevrons hold */
function beltHand(h, d, outer, ph) {
  const A = FEAT_ART.BELT;
  if (!A) return null;
  const hz = d % 2 === 0, s = d < 2 ? 1 : -1, lo = outer.includes(hz ? "W" : "N"), hi = outer.includes(hz ? "E" : "S"), R = A.roll[h], P = R.length;
  const chev = (a, c) => c >= 7 && c < 12 && A.chevAt[h].some((a0) => { const i = s > 0 ? a - a0 : 3 - (a - a0); return i >= 0 && i < 4 && A.chev[c - 7][i] === "W"; });
  const g = Array.from({length: 20}, (_, c) => Array.from({length: 20}, (_, a) => {
    if (A.rail[c] !== ".") return A.rail[c];
    if (lo && a < 3) return A.capW[a];
    if (hi && a > 16) return A.capE[a - 17];
    if (chev(a, c)) return "W";
    if (chev(a, c - 1)) return "R";
    const r = R[((a - ph * s) % P + P) % P];
    return c === 3 ? A.shade[r] || r : r;
  }));
  for (const [a, c, ch] of A.bolt) if (!(lo && a < 3) && !(hi && a > 16)) g[c][a] = ch;
  return mk((X, Y) => (hz ? g[Y][X] : g[X][Y]));
}
/* STREAM from its hand parts (pixel/art/feat.js STREAM), built in flow (a) x across (c) space and turned to the dir, so wells stay shaded on their top / left
   at every dir; ripples step 2 px a phase over a 20 px loop (10 phases) */
function streamHand(h, d, outer, ph) {
  const A = FEAT_ART.STREAM;
  if (!A) return null;
  const hz = d % 2 === 0, s = d < 2 ? 1 : -1, lo = outer.includes(hz ? "W" : "N"), hi = outer.includes(hz ? "E" : "S"), [c0, c1] = A.c[h], [wb, wd, dd] = A.wat[h];
  const g = Array.from({length: 20}, () => Array(20).fill("O"));
  for (let a = 0; a < 20; a++) {
    const m = (lo && a < 3) || (hi && a > 16) ? 1 : 0, n0 = c0 + Math.max(m, +A.top[h][a]), n1 = c1 - Math.max(m, +A.bot[h][a]);
    g[n0 - 2][a] = "S"; g[n0 - 1][a] = "R"; g[n1 + 1][a] = "T"; g[n1 + 2][a] = "S";
    for (let c = n0; c <= n1; c++) g[c][a] = c === n0 ? "J" : c === n1 ? "L" : Math.min(c - c0, c1 - c) >= dd ? wd : wb;
    const cap = lo && a < 3 ? A.mouthW[a] : hi && a > 16 ? A.mouthE[a - 17] : null;
    if (cap) for (let c = n0; c <= n1; c++) g[c][a] = cap;
  }
  const G = A.rip[h], L = G[0].length;
  for (const [a0, c] of A.lanes[h]) for (let j = 0; j < G.length; j++) for (let i = 0; i < L; i++) {
    const ch = G[j][s > 0 ? i : L - 1 - i], a = ((a0 + i + 2 * ph * s) % 20 + 20) % 20, cc = c + j;
    if (ch !== "." && !((lo && a < 3) || (hi && a > 16)) && "KJB".includes(g[cc][a]) && g[cc - 1][a] !== "R" && g[cc + 1][a] !== "T") g[cc][a] = ch;
  }
  return slab(mk((X, Y) => (hz ? g[Y][X] : g[X][Y])), "O");
}
/* PORTAL pair id: 1 / 2 / 3 dark 2 px notches cut in the lit south bezel, centred */
function portalHand(h, pair) {
  const r = HAND("PORTAL", h), n = clampI(pair || 1, 1, 3), x0 = 10 - (3 * n - 1) / 2;
  if (r) for (let i = 0; i < n; i++) for (const y of [15, 16]) { at(r, x0 + 3 * i, y, "U"); at(r, x0 + 3 * i + 1, y, "U"); }
  return r;
}
export function featPxCell(biome, s) {
  const h = s.h, outer = s.outer || SIDES, d = s.dir || 0;
  let rows;
  if (s.kind === "BLOOM") rows = bloomHand(s.state === 2 ? Math.max(0, h - 1) : h, s.state === 1);
  else if (s.kind === "PLATE") rows = plateHand(h, s.state === 1, s.lit | 0);
  else if (s.kind === "QUICK") rows = HAND("QUICK", h);
  else if (s.kind === "PORTAL") rows = portalHand(h, s.pair);
  else if (s.kind === "GLIDE") rows = glideHand(h, outer);
  else if (s.kind === "STREAM") rows = streamHand(h, d, outer, s.ph | 0);
  else if (s.kind === "BELT") rows = beltHand(h, d, outer, s.ph | 0);
  else if (s.kind === "GATE") { const l = s.lit | 0; rows = gateHand(h, s.state === 1 || l >= 3 ? 2 : l === 2 ? 1 : 0, outer); }
  return {w: 20, h: 20, rows: (rows || mk(() => "O")).slice(), pal: {...DPAL}};
}
