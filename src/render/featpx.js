/* PIXEL cells for the eight floor tiles (tile art, direction D 2026-10-25; polish pass 2026-10-25). Palette-SLOT grids only (./pixel/grid.js format, never hex): every
   char maps to "tile.<BIOMES field>[.step]" through the pinned pxRamp (DPAL in featpxcells.js: A-D bg0, E-H bg1, I-L floor0, M-P floor1, Q-T wall, U-X wallHi, each
   outline / shadow / base / light), so each biome bakes its own ramp. 20x20 art px, 1 art px = 2 logical px, light from the top-left: raised parts lit top-left,
   wells and beds shadowed top-left and lit bottom-right. Baked by pixel/atlas.js (feat), whose cache key is ph|biome|kind|h|dir|outer|state|lit|pair, so a builder
   never reads gx / gy / par. Open floor around a fixture keeps the base floor's slab shadow (slab), so a tile cell seams like a floor cell. Marks are flat runs,
   clean 1:1 or 2:1 stairs and 2 px minimums; the lone pixels left are deliberate (stair outlines, chevron shadows, bar tips, lamp gaps). Heat never changes a hue: it lives in structure, count, size and tips. VOID never goes past wallHi. */
import {DPAL} from "./featpxcells.js";
import {GEO} from "./featart/geo.js";

const SIDES = ["N", "E", "S", "W"];
const mk = (f) => Array.from({length: 20}, (_, y) => { let o = ""; for (let x = 0; x < 20; x++) o += f(x, y); return o; });
const at = (rows, x, y, ch) => { if (y < 0 || y >= rows.length || x < 0 || x >= rows[y].length) return; rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1); };
const clampI = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const edge = (outer, x, y) => { const d = [["N", y], ["S", 19 - y], ["W", x], ["E", 19 - x]].filter(([s]) => outer.includes(s)).sort((a, b) => a[1] - b[1])[0]; return d || ["", 99]; };
/* despeckle (QUICK's ring stairs): a pixel with no 4-neighbour of its own char takes the char 3 of its 4 neighbours share; keep = chars that are drawn as stairs */
function clean(rows, keep) {
  const q = (x, y) => (rows[y] || "")[x];
  return rows.map((r, y) => [...r].map((ch, x) => { const nb = [q(x - 1, y), q(x + 1, y), q(x, y - 1), q(x, y + 1)]; return keep.includes(ch) || nb.includes(ch) ? ch : nb.find((c) => c && nb.filter((d) => d === c).length >= 3) || ch; }).join(""));
}
/* the floorPxCell slab's shadow side (bottom / right) on the tile's own border, only where the open floor shows; the lit top / left run is left out on purpose,
   because a feature cell never takes the floor's cast-shadow strip and a lit line under a brick or wall would read as light leaking under it */
const SL = {O: "N", K: "J"};
function slab(rows, b) {
  const s = SL[b], put = (x, y) => { if (rows[y][x] === b) at(rows, x, y, s); };
  for (let i = 1; i < 20; i++) { put(i, 19); put(19, i); }
  return rows;
}
/* ICE PATCH: a glass pane in a steel frame on the outer sides; heat = 1 / 2 / 3 glazing bars, the glass a step darker each heat (P / O / N); one sheen glint
   top-left, on the patch's NW corner cell only (outer is in the atlas key), so a long patch never repeats it as a grid */
const BARS = [[10], [7, 13], [6, 10, 14]], GL = [["P", "K", "O"], ["O", "K", "N"], ["N", "J", "S"]];
function glideRows(h, outer) {
  const gl = outer.includes("N") && outer.includes("W");
  return mk((x, y) => {
    const [s, k] = edge(outer, x, y);
    if (k < 2) return s === "N" || s === "W" ? "RT"[k] : "RS"[k];
    const [bs, sh, dk] = GL[h];
    if (k === 2) return s === "N" || s === "W" ? dk : sh;
    if (BARS[h].includes(y)) return dk;
    if (BARS[h].includes(y - 1)) return sh;
    return gl && (x + y === 10 || x + y === 11) && x > 3 && x < 9 ? sh : bs;
  });
}
/* CONVEYOR: rails (low side lit), rollers across the flow (gap, lit edge, body; tighter and darker-gapped each heat), chevrons that point the way (1 / 2 / 3 by
   heat, a cast shadow under / right of each), end caps on the outer ends; built in screen space so the light stays top-left. Roller periods 5 / 5 / 4 match the
   atlas phase loop. */
const ROLL = ["RTSSS", "KTSSR", "KTSR"], CH = [[8], [4, 12], [2, 8, 14]], CHV = [[0, 1], [1, 2], [2, 3], [1, 2], [0, 1]];
function beltRows(h, d, outer, ph) {
  const hz = d % 2 === 0, s = d < 2 ? 1 : -1, lo = outer.includes(hz ? "W" : "N"), hi = outer.includes(hz ? "E" : "S"), P = ROLL[h].length;
  const cv = (a, c) => CH[h].some((a0) => c >= 7 && c < 12 && CHV[c - 7].some((j) => a === a0 + (s > 0 ? j : 3 - j)));
  return mk((X, Y) => {
    const a = hz ? X : Y, c = hz ? Y : X;
    if (c < 3) return "QTS"[c];
    if (c > 16) return "SRQ"[c - 17];
    if (lo && a < 3) return "QTS"[a];
    if (hi && a > 16) return "SRQ"[a - 17];
    if (cv(a, c)) return "W";
    if (cv(a, c - 1)) return "R";
    return ROLL[h][((a - ph * s) % P + P) % P];
  });
}
/* STREAM: a channel across the tile, sunk between stone banks (dark lip north, lit lip south), tapering to a mouth on an outer end; ripple dashes (2 tail + head)
   point downstream; the loop is 20 px so the 10 phases of 2 px wrap clean */
const CHN = [[3, 16], [4, 15], [5, 14]], RIP = [[[3, 6], [12, 12]], [[2, 6], [9, 9], [15, 12]], [[1, 6], [7, 8], [12, 10], [16, 12]]];
function streamRows(h, d, outer, ph) {
  const hz = d % 2 === 0, s = d < 2 ? 1 : -1, lo = outer.includes(hz ? "W" : "N"), hi = outer.includes(hz ? "E" : "S"), [c0, c1] = CHN[h], rm = [4, 3, 3][h];
  const rr = (a) => Math.max(lo ? clampI(rm - (a >> 1), 0, rm) : 0, hi ? clampI(rm - ((19 - a) >> 1), 0, rm) : 0);
  const dash = {}, DL = [5, 4, 4][h];
  for (const [a0, c] of RIP[h]) for (let i = 0; i < DL; i++) { const k = s > 0 ? i : DL - 1 - i, q = ((a0 + i + 2 * ph * s) % 20 + 20) % 20; dash[(hz ? q : c) + "," + (hz ? c : q)] = k < 2 ? "L" : "V"; }
  return slab(mk((X, Y) => {
    const a = hz ? X : Y, c = hz ? Y : X, r = rr(a), n0 = c0 + r, n1 = c1 - r, end = (lo && a === 0) || (hi && a === 19);
    if (c >= n0 && c <= n1) return end ? "R" : (c > n0 && c < n1 && dash[X + "," + Y]) || (c === n0 ? "J" : c === n1 ? "L" : "K");
    if (c === n0 - 1) return "R";
    if (c === n1 + 1) return "T";
    if (c === n0 - 2 || c === n1 + 2) return "S";
    return "O";
  }), "O");
}
/* BOOSTER: a fern frond pointing East out of a sunk loam bed (shadowed top-left, lit lip bottom-right): a 3-row blade lit on its top edge, tip one px; heat grows
   the bed and adds 0 / 1 / 2 pairs of leaflets swept back (">", so the frond reads as an arrow); flare lifts the frond one step */
const BED = [[3, 16, 4, 15, 4], [2, 17, 3, 16, 4], [1, 18, 2, 17, 5]], LEAF = [[5, 15], [5, 16], [4, 17]], FL = [[], [9], [8, 12]];
const inR = (x, y, x0, x1, y0, y1, c) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && Math.min(x - x0, x1 - x) + Math.min(y - y0, y1 - y) >= c;
function bloomRows(h, flare) {
  const [x0, x1, y0, y1, c] = BED[h], bed = (x, y) => inR(x, y, x0, x1, y0, y1, c);
  const rows = mk((x, y) => !bed(x, y) ? "O" : !bed(x - 1, y) || !bed(x, y - 1) ? "F" : !bed(x + 1, y) || !bed(x, y + 1) ? "H" : "G");
  const lit = flare ? "X" : "L", mid = flare ? "L" : "K", [a, b] = LEAF[h];
  for (let x = a; x <= b; x++) { if (x > a && x < b - 2) at(rows, x, 8, lit); at(rows, x, 9, mid); if (x > a && x < b - 1) at(rows, x, 10, "J"); }
  for (const t of FL[h]) for (let i = 0; i < 3; i++) { at(rows, t - i, 7 - i, lit); at(rows, t - i + 1, 7 - i, mid); at(rows, t - i, 11 + i, mid); at(rows, t - i + 1, 11 + i, "J"); }
  return slab(rows, "O");
}
/* TRAP: a plate sunk in a lipped well (lip lit north / west, plate lit bottom-right); heat thickens the lip (2 / 3 / 4, GEO.PLATE.lip) and adds vent bars (1 / 2
   / 3: lit top, shade, cast shadow) on a plate a step darker each heat; armed (state 1) dims the bars one step and shows 4 lamps in the south lip */
const PB = [[9], [7, 11], [7, 9, 11]], PC = [["L", "K", "P"], ["K", "J", "L"], ["J", "I", "K"]], LIP = [["QT", "QR"], ["QTS", "QRS"], ["QTTS", "QRRS"]];
function plateRows(h, on, lit) {
  const w = h + 2, i0 = 2 + w, i1 = 17 - w, bh = h > 1 ? 1 : 2;
  return slab(mk((x, y) => {
    const k = Math.min(x - 2, y - 2, 17 - x, 17 - y);
    if (k < 0) return "O";
    if (on && k < w && y >= 15 && y <= 16 && [4, 7, 10, 13].some((x0) => x === x0 || x === x0 + 1)) return [4, 7, 10, 13].findIndex((x0) => x >= x0 && x <= x0 + 1) < lit ? "W" : "Q";
    if (k < w) return LIP[h][+(Math.min(x - 2, y - 2) > Math.min(17 - x, 17 - y))][k];
    if (y === i0 || x === i0) return PC[h][1];
    if (y === i1 || x === i1) return PC[h][2];
    if (x > i0 && x < i1) for (const b of PB[h]) { const r = y - b; if (r >= 0 && r < bh) return (on ? "VR" : "WV")[r]; if (r === bh) return on ? "Q" : "R"; }
    return PC[h][0];
  }), "O");
}
/* QUICKSAND: a funnel of eccentric octagon rings sinking toward the lower right (2 / 3 / 4 rings, every SE band at least 1 px so no stair breaks); every slope is cut in facets, the N / W
   / NW faces in shadow, the S / E / SE faces lit, the outer crest lit NW, a dark pit; the floor outside stays K so it never reads as brick */
const QR = [[8.5, 5.5], [8.5, 6.5, 4.5], [8.5, 7, 5.5, 4.5]], QP = [2.5, 3, 3], QD = ["K", "N", "I", "I"], QS = ["L", "K", "N", "I"];
const oct = (dx, dy) => { const a = Math.abs(dx), b = Math.abs(dy), d = (a + b) * 0.75; return d > a && d > b ? [d, dx + dy < 0 ? 0 : dx + dy > 0 ? 2 : 1] : a > b ? [a, dx < 0 ? 0 : 2] : [b, dy < 0 ? 0 : 2]; };
function quickRows(h) {
  const R = QR[h], n = R.length;
  return slab(clean(mk((x, y) => {
    let out = "K";
    for (let i = 0; i <= n; i++) {
      const c = 9.5 + 0.5 * i, [r, f] = oct(x - c, y - c);
      if (r > (i < n ? R[i] : QP[h])) break;
      out = i === n ? "M" : i === 0 && f === 0 && r > R[0] - 1 ? "T" : f === 2 ? QS[i] : QD[i];
    }
    return out;
  }), "T"), "K");
}
/* PORTAL: a stepped square well, every step shadowed NW and lit SE (the bezel lip lit, never past W), down to a dark pit with a dim core; heat adds steps (2 / 3 / 6) and narrows
   the pit (10 / 8 / 2 px), and at MAX the light falls in on the pit's SE half; the pair ticks are dark notches cut in the lit south bezel */
const RG = ["wvppppc", "wvwpppc", "wvwvwvq"], RC = {w: ["V", "W"], v: ["U", "V"], p: ["E", "E"], c: ["S", "U"], q: ["E", "V"]};
function portalRows(h, pair) {
  const n = clampI(pair || 1, 1, 3), x0 = 10 - (3 * n - 1) / 2;
  return slab(mk((x, y) => {
    const dx = x - 9.5, dy = y - 9.5, d = Math.max(Math.abs(dx), Math.abs(dy)) - 0.5;
    if (d > 6 || (d === 6 && Math.abs(dx) === Math.abs(dy))) return "O";
    if (y >= 15 && y <= 16 && Math.abs(dx) <= 6.5 && Math.abs(dy) > Math.abs(dx) - 1.5) { for (let i = 0; i < n; i++) if (x >= x0 + 3 * i && x < x0 + 3 * i + 2) return "U"; }
    const c = RG[h][6 - d];
    return RC[c][+(c === "q" ? dx + dy > 0 : Math.abs(dx) >= Math.abs(dy) ? dx > 0 : dy > 0)];
  }), "O");
}
/* GATE: a portcullis in a gold frame over a dark well; bars (3 / 4 / 5 by heat) hang from the lintel, chamfered tips, each over its own socket in the lit sill:
   open = short stubs, half = half height, shut = full */
const GAPS = [[2, 3, 3, 2], [1, 2, 2, 2, 1], [1, 1, 1, 1, 1, 1]];
function gateRows(h, st, outer) {
  const n = GEO.GATE.n[h], gaps = GAPS[h], xs = [];
  let x = 2 + gaps[0];
  for (let i = 0; i < n; i++) { xs.push(x); x += 2 + gaps[i + 1]; }
  const len = [4, 7, 12][st];
  return mk((X, Y) => {
    const [s, k] = edge(outer, X, Y);
    if (k < 2) return s === "N" || s === "W" ? "QW"[k] : "QS"[k];
    const b = xs.findIndex((x0) => X >= x0 && X < x0 + 2);
    if (Y === 2 || Y === 3) return Y === 2 ? "T" : "R";
    if (Y === 16) return b >= 0 ? "A" : "T";
    if (Y === 17) return "S";
    if (b >= 0 && Y - 4 < len) return Y - 4 === len - 1 ? (X === xs[b] ? "S" : "B") : X === xs[b] ? "W" : "S";
    return "B";
  });
}
export function featPxCell(biome, s) {
  const h = s.h, outer = s.outer || SIDES, d = s.dir || 0;
  let rows;
  if (s.kind === "GLIDE") rows = glideRows(h, outer);
  else if (s.kind === "BELT") rows = beltRows(h, d, outer, s.ph | 0);
  else if (s.kind === "STREAM") rows = streamRows(h, d, outer, s.ph | 0);
  else if (s.kind === "BLOOM") rows = bloomRows(s.state === 2 ? Math.max(0, h - 1) : h, s.state === 1);
  else if (s.kind === "PLATE") rows = plateRows(h, s.state === 1, s.lit | 0);
  else if (s.kind === "QUICK") rows = quickRows(h);
  else if (s.kind === "PORTAL") rows = portalRows(h, s.pair);
  else if (s.kind === "GATE") { const l = s.lit | 0; rows = gateRows(h, s.state === 1 || l >= 3 ? 2 : l === 2 ? 1 : 0, outer); }
  return {w: 20, h: 20, rows: rows.slice(), pal: {...DPAL}};
}
