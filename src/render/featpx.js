/* THROWAWAY PROTOTYPE (tile art, direction D 2026-10-25): PIXEL cells for the eight floor tiles. Palette-SLOT grids only (./pixel/grid.js format, never hex): every
   char maps to "tile.<BIOMES field>[.step]" through the pinned pxRamp (DPAL in featpxcells.js: A-D bg0, E-H bg1, I-L floor0, M-P floor1, Q-T wall, U-X wallHi, each
   outline / shadow / base / light), so each biome bakes its own ramp. 20x20 art px, 1 art px = 2 logical px, light from the top-left. Every kind is a small procedural
   builder (flat runs, one-step bevels, 2 px minimum marks, no single-pixel noise); first drafted by a 4x4 mode-snap of the 2D painters (the old pxdraft tool), then rebuilt by hand. Kept OUT of
   src/render/pixel/** on purpose: the px tree has 771 B under its 122 KB cap, so wiring waits for the dynamic import (#15); nothing in the game imports this yet
   (export tool + tests only). Heat never changes a hue: it lives in structure, count, value and tips. VOID never goes past wallHi. */
import {DPAL} from "./featpxcells.js";
import {GEO} from "./featart/geo.js";

const SIDES = ["N", "E", "S", "W"];
const mk = (f) => Array.from({length: 20}, (_, y) => { let o = ""; for (let x = 0; x < 20; x++) o += f(x, y); return o; });
const at = (rows, x, y, ch) => { if (y < 0 || y >= rows.length || x < 0 || x >= rows[y].length) return; rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1); };
const clampI = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const edge = (outer, x, y) => { const d = [["N", y], ["S", 19 - y], ["W", x], ["E", 19 - x]].filter(([s]) => outer.includes(s)).sort((a, b) => a[1] - b[1])[0]; return d || ["", 99]; };
/* ICE PATCH: a glass pane in a steel frame on the outer sides; heat = 1 / 2 / 3 glazing bars; the glass steps darker with heat (P / O / N) under a sheen, never the near-white brick tones */
const BARS = [[9], [6, 12], [4, 9, 14]], GL = [["P", "K", "O"], ["O", "K", "N"], ["N", "J", "S"]];
function glideRows(h, outer) {
  return mk((x, y) => {
    const [s, k] = edge(outer, x, y);
    if (k < 3) return s === "N" || s === "W" ? "RTS"[k] : "RSR"[k];
    const [bs, sh, dk] = GL[h];
    if (k === 3) return s === "N" || s === "W" ? dk : sh;
    if (BARS[h].includes(y)) return dk;
    if (BARS[h].includes(y - 1)) return sh;
    return (x + y) % 10 < 2 ? sh : bs;
  });
}
/* CONVEYOR: rails (low side lit), rollers across the flow, chevrons that point the way (1 / 2 / 3 by heat), end caps on the outer ends; built in screen space so the light stays top-left */
const ROLL = ["KKSRL", "KSRLK", "KSRL"], CH = [[8], [4, 12], [2, 8, 14]], CHV = [[0, 1], [1, 2], [2, 3], [1, 2], [0, 1]];
function beltRows(h, d, outer, ph) {
  const hz = d % 2 === 0, s = d < 2 ? 1 : -1, lo = outer.includes(hz ? "W" : "N"), hi = outer.includes(hz ? "E" : "S"), P = ROLL[h].length;
  return mk((X, Y) => {
    const a = hz ? X : Y, c = hz ? Y : X;
    if (c < 3) return "QTS"[c];
    if (c > 16) return "SRQ"[c - 17];
    if (lo && a < 3) return "QTS"[a];
    if (hi && a > 16) return "SRQ"[a - 17];
    for (const a0 of CH[h]) for (let r = 0; r < 5; r++) if (c === 7 + r) for (const j of CHV[r]) if (a === a0 + (s > 0 ? j : 3 - j)) return "W";
    return ROLL[h][((a - ph * s) % P + P) % P];
  });
}
/* STREAM: a channel across the tile, sunk between stone banks (dark lip north, lit lip south), tapering to a mouth on an outer end; ripple dashes fade tail to head so they point downstream */
const CHN = [[3, 16], [4, 15], [5, 14]], RIP = [[[3, 6], [11, 12]], [[2, 5], [9, 8], [14, 11]], [[1, 6], [7, 8], [11, 10], [15, 6]]];
function streamRows(h, d, outer, ph) {
  const hz = d % 2 === 0, s = d < 2 ? 1 : -1, lo = outer.includes(hz ? "W" : "N"), hi = outer.includes(hz ? "E" : "S"), [c0, c1] = CHN[h], rm = [4, 3, 3][h];
  const rr = (a) => Math.max(lo ? clampI(rm - (a >> 1), 0, rm) : 0, hi ? clampI(rm - ((19 - a) >> 1), 0, rm) : 0);
  const dash = {}, DL = [5, 4, 3][h], dc = ["L", "L", "V", "V", "V"];
  for (const [a0, c] of RIP[h]) for (let i = 0; i < DL; i++) for (let j = 0; j < 2; j++) if (!j || i < DL - 2) { const k = s > 0 ? i : DL - 1 - i, q = ((a0 + i + 2 * ph * s) % 20 + 20) % 20; dash[(hz ? q : c + j) + "," + (hz ? c + j : q)] = j ? "L" : dc[Math.min(4, k + (5 - DL))]; }
  return mk((X, Y) => {
    const a = hz ? X : Y, c = hz ? Y : X, r = rr(a), n0 = c0 + r, n1 = c1 - r, end = (lo && a === 0) || (hi && a === 19);
    if (c >= n0 && c <= n1) return end ? "R" : dash[X + "," + Y] || (c === n0 ? "J" : c === n1 ? "L" : "K");
    if (c === n0 - 1) return "R";
    if (c === n1 + 1) return "T";
    if (c === n0 - 2 || c === n1 + 2) return "S";
    return "O";
  });
}
/* BOOSTER: a spear-leaf pointing East out of a loose squarish loam patch; swept shoots at PLUS (one pair) and MAX (two pairs, longer); flare lifts the leaf one step */
const inR = (x, y, x0, y0, x1, y1, c = 2) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && Math.min(x - x0, x1 - x) + Math.min(y - y0, y1 - y) >= c;
const loam = (x, y) => inR(x, y, 2, 3, 17, 16) && !inR(x, y, 14, 0, 19, 5, 0) || inR(x, y, 3, 4, 18, 15, 3);
function bloomRows(h, flare) {
  const rows = mk((x, y) => !loam(x, y) ? "N" : !loam(x - 1, y) || !loam(x, y - 1) ? "H" : !loam(x + 1, y) || !loam(x, y + 1) ? "F" : "G");
  const lit = flare ? "X" : "L", mid = flare ? "L" : "K", dark = "J", len = [13, 14, 15][h];
  for (let x = 4; x <= 4 + len; x++) {
    const t = (x - 4) / len, w = Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.04)) * [2.6, 2.4, 2.1][h] * (h === 2 ? 1.05 : 1);
    for (let y = 0; y < 20; y++) { const dy = y - 9; if (Math.abs(dy) <= w) at(rows, x, y, dy < -w * 0.35 ? lit : dy > w * 0.45 ? dark : mid); }
    if (t > 0.1 && t < 0.85) at(rows, x, 9, "I");
  }
  for (const sx of h === 0 ? [] : h === 1 ? [6] : [3, 11]) for (let i = 0; i < 4; i++) for (const dy of [-1, 1]) for (let j = 0; j < 2; j++) for (let t = 0; t < 2; t++) at(rows, sx + 2 * i + j, 9 + dy * (3 + i + t), dy < 0 ? (t ? mid : lit) : (t ? dark : mid));
  return rows;
}
/* TRAP: a plate sunk in a lipped well, lit lip north / west; heat = 1 / 2 / 3 bars; armed (state 1) dims the bars and shows 4 lamps in the south lip */
const PB = [[9], [7, 12], [6, 9, 12]], PC = [["L", "K", "P"], ["K", "J", "L"], ["J", "I", "K"]];
function plateRows(h, on, lit) {
  return mk((x, y) => {
    const k = Math.min(x - 2, y - 2, 17 - x, 17 - y);
    if (k < 0) return "O";
    if (on && y >= 15 && y <= 16 && [4, 7, 10, 13].some((x0, i) => x === x0 || x === x0 + 1)) return [4, 7, 10, 13].findIndex((x0) => x >= x0 && x <= x0 + 1) < lit ? "W" : "Q";
    if (k < 3) { const nw = Math.min(x - 2, y - 2) <= Math.min(17 - x, 17 - y); return nw ? "QTS"[k] : "SRQ"[2 - k]; }
    if (y === 5 || x === 5) return PC[h][1];
    if (y === 14 || x === 14) return PC[h][2];
    for (const b of PB[h]) { if (y === b && x >= 6 && x <= 13) return on ? "R" : "W"; if (y === b + 1 && x >= 6 && x <= 13) return on ? "Q" : "R"; }
    return PC[h][0];
  });
}
/* QUICKSAND: a funnel of eccentric rings sinking toward the lower right (2 / 3 / 4 rings), lit crest NW, lit slope SE, a dark pit; the floor outside stays K so it never reads as brick */
const QR = [[8.9, 5.75], [8.9, 6.8, 4.8], [8.9, 7.3, 5.8, 4.3]], QP = [2.5, 3, 3.6], QB = [["L", "K"], ["K", "N"], ["N", "I"], ["I", "I"]];
function quickRows(h) {
  const R = QR[h], n = R.length;
  return mk((x, y) => {
    let out = "K";
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1), c = 9.9 + 1.4 * t, dx = x - c, dy = y - c;
      if (Math.hypot(dx, dy) > R[i]) break;
      const se = dx + dy > 0;
      out = i === 0 && !se && Math.hypot(dx, dy) > R[0] - 1.3 ? "T" : QB[i][se ? 0 : 1];
      if (i === n - 1) { const u = Math.abs(dx - 0.4), v = Math.abs(dy - 0.4); if (Math.max(u, v) < QP[h] && u + v < QP[h] * 1.45) out = "M"; }
    }
    return out;
  });
}
/* PORTAL: stepped square rings (lit NW, shade SE) down to a dark pit, bezel ring bright; heat is a value ladder, never X; the pair ticks sit in the south bezel */
const RG = ["aagbbpp", "abgbgcp", "bbgcgcp"], RC = {a: ["W", "V"], b: ["V", "U"], c: ["U", "S"], g: ["K", "K"], p: ["E", "E"]};
function portalRows(h, pair) {
  const n = clampI(pair || 1, 1, 3), x0 = 10 - (3 * n - 1) / 2;
  return mk((x, y) => {
    const dx = x - 9.5, dy = y - 9.5, d = Math.max(Math.abs(dx), Math.abs(dy)) - 0.5;
    if (d > 6) return "O";
    if (y >= 15 && y <= 16 && Math.abs(dx) <= 6.5 && Math.abs(dy) > Math.abs(dx) - 1.5) { for (let i = 0; i < n; i++) if (x >= x0 + 3 * i && x < x0 + 3 * i + 2) return "W"; }
    const code = RG[h][6 - d], lit = Math.abs(dx) >= Math.abs(dy) ? dx < 0 : dy < 0;
    return RC[code][lit ? 0 : 1];
  });
}
/* GATE: a portcullis in a gold frame; bars hang from the lintel (3 / 4 / 5 by heat): open = short stubs, half = half height, shut = full */
const GAPS = [[2, 3, 3, 2], [1, 2, 2, 2, 1], [1, 1, 1, 1, 1, 1]];
function gateRows(h, st, outer) {
  const n = GEO.GATE.n[h], gaps = GAPS[h], xs = [];
  let x = 2 + gaps[0];
  for (let i = 0; i < n; i++) { xs.push(x); x += 2 + gaps[i + 1]; }
  const len = [3, 6, 10][st];
  return mk((X, Y) => {
    const [s, k] = edge(outer, X, Y);
    if (k < 2) return s === "N" || s === "W" ? "QW"[k] : "QS"[k];
    const b = xs.findIndex((x0) => X >= x0 && X < x0 + 2);
    if (Y === 2 || Y === 3) return Y === 2 ? "T" : "R";
    if (b >= 0 && Y - 4 < len) return Y - 4 === len - 1 ? "R" : X === xs[b] ? "W" : "S";
    return "B";
  });
}
/* hand corrections applied last: "KIND.heat" -> [[x, y, ch], ...] */
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
