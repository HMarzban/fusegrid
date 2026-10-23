/* THROWAWAY PROTOTYPE (tile art detail pass + round-3 maturity pass,
   2026-10-23): PIXEL cells for the eight floor tiles. Palette-SLOT grids
   only (../pixel/grid.js format, never hex): every char maps to
   "tile.<BIOMES field>[.step]" through the pinned pxRamp, so each biome
   bakes its own ramp. 20x20 art px, 1 art px = 2 logical px. Kept OUT of
   src/render/pixel/** on purpose: the px tree has 771 B under its 122 KB
   cap, so wiring waits for the dynamic import (#15); nothing in the game
   imports this yet (export tool + tests only).
   Build order per cell: material bed (flat runs, rings built around the
   centre 9.5; no dither, no random flecks) -> inlay lip (AO on N/W, lit
   sliver on S/E, outer sides only) -> marks (hand-authored sprites, 1-px
   drop shade) -> heat edge strip (keyline / 2x2 dash every 5 px / 2-of-5
   hatch / 4-px teeth). Heat never changes a hue: the mark slot steps
   .shadow -> base -> .light (dark polarity: .light -> base -> .shadow);
   VOID caps at base (nothing brighter than wallHi), so PLUS and MAX share
   a value there and differ by edge, count and tip; CROWN starts at base
   (its .shadow step is pxRamp's olive), so CORE and PLUS share one. */
import {paintCell, overlayCell, rot90} from "./pixel/grid.js";

const DARK = {ICE: "wall", SAND: "bg1"};
const NATURAL = new Set(["JUNGLE", "ICE", "WATER", "SAND"]);
const SIDES = ["N", "E", "S", "W"];
const STEP = {L: [".shadow", "", ".light"], D: [".light", "", ".shadow"], VOID: [".shadow", "", ""], CROWN: ["", "", ".light"], SAND: ["", "", ".shadow"]};
/* the CORE keyline: a warm or in-family step, never pxRamp's olive outline */
const KEYQ = {CROWN: "tile.wall.light", JUNGLE: "tile.wallHi.shadow", VOID: "tile.wallHi.shadow"};
/* the shared slot map; family beds add their own chars */
export function palFor(biome, h) {
  const d = DARK[biome], m = d ? "tile." + d : "tile.wallHi", st = STEP[biome] || STEP[d ? "D" : "L"];
  return {M: m + st[h], Q: KEYQ[biome] || m + (d ? ".light" : ".outline"), F: m + (d ? ".shadow" : ".light"), P: "tile.wallHi", B: d ? "tile.floor0" : "tile.bg1",
    a: biome === "SAND" ? "tile.floor1.shadow" : "tile.floor1", A: biome === "SAND" ? "tile.wall.shadow" : "tile.floor1.light", s: biome === "SAND" ? "tile.bg0" : "tile.floor1.shadow",
    o: "tile.floor1.outline", k: "tile.bg1", f: "tile.floor0", g: "tile.floor0.light",
    h: "tile.wall", w: "tile.wall.shadow", W: "tile.wall.outline", H: "tile.wall.light", l: "tile.wallHi", u: "tile.wallHi.shadow", q: "tile.wallHi.outline", d: "tile.bg0"};
}
const fill = (n, ch) => ch.repeat(n);
const R = (row, n) => Array(n).fill(row);
const at = (rows, x, y, ch) => { if (y < 0 || y >= rows.length || x < 0 || x >= rows[y].length) return; rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1); };
const put = (rows, pts, ch) => { for (const [x, y] of pts) at(rows, x, y, ch); };
/* a sprite with an optional 1-px drop shade (down-right, away from the key) */
function stamp(rows, spr, dx, dy, shade) {
  const each = (fn) => spr.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== ".") fn(x, y, r[x]); });
  if (shade) each((x, y) => at(rows, dx + x + 1, dy + y + 1, shade));
  each((x, y, ch) => at(rows, dx + x, dy + y, ch));
}
/* ring distance from the cell centre (9.5, 9.5): 0 = the centre 2x2 */
const ring = (x, y) => Math.max(Math.abs(x - 9.5), Math.abs(y - 9.5)) - 0.5;
const ringCell = (fn) => paintCell(20, 20, (x, y) => fn(ring(x, y), x, y));
const square = (rows, d, ch) => { for (let i = 9 - d; i <= 10 + d; i++) put(rows, [[i, 9 - d], [i, 10 + d], [9 - d, i], [10 + d, i]], ch); };

/* ---- beds ---- */
const RIB = fill(5, "kRrr"), RAIL = fill(4, "wwvww"), K20 = fill(20, "k");
const BELT = [
  /* CORE: plain deck, riveted rails hugging an 8-row groove */
  [...R(fill(20, "a"), 3), fill(20, "s"), fill(20, "h"), RAIL, K20, ...R(RIB, 6), K20, fill(20, "h"), RAIL, fill(20, "W"), ...R(fill(20, "a"), 3)],
  /* PLUS: full bed between 3-row rails */
  [fill(20, "h"), RAIL, fill(20, "W"), K20, ...R(RIB, 12), K20, fill(20, "h"), RAIL, fill(20, "W")],
  /* MAX: band rows 0-2 / 17-19 (edge strip), thin rails, bed between */
  [...R(K20, 3), fill(20, "h"), RAIL, K20, ...R(RIB, 8), K20, fill(20, "h"), RAIL, ...R(K20, 3)],
];
const BELT_PAL = {r: "tile.floor1.shadow", R: "tile.floor1", k: "tile.bg1", v: "tile.wall", h: "tile.wall.shadow", w: "tile.wall.outline", W: "tile.bg1"};
const bedGlide = (gx, gy) => { const rows = paintCell(20, 20, (x, y) => { const d = (x + y + gx * 20 + gy * 20) % 40; return d >= 11 && d <= 16 ? "A" : "a"; }); put(rows, [[3, 6], [4, 5], [5, 4], [6, 3]], "l"); return rows; };
/* flat moss; plate inlay; stream = banks / channel / deep runs */
const PLATE_PAL = {w: "tile.wall.shadow", W: "tile.wall.outline", h: "tile.wall", u: "tile.wall.light"};
function bedPlate() {
  const rows = paintCell(20, 20, (x, y) => (x < 3 || x > 16 || y < 3 || y > 16 ? "a" : y === 3 || x === 3 ? "o" : y === 16 || x === 16 ? "h" : y === 4 || x === 4 ? "W" : "w"));
  put(rows, [[5, 5], [14, 5], [5, 14], [14, 14]], "u");
  return rows;
}
const STREAM_PAL = {u: "tile.floor0.light"};
const RIPS = [[4, 7, 13, 15], [3, 9, 16], []];
function bedStream(h) {
  const rows = paintCell(20, 20, (x, y) => { const e = Math.min(y, 19 - y); return e <= 1 ? "f" : e >= 7 ? "s" : "a"; });
  RIPS[h].forEach((y, j) => { for (const x of [(j * 7 + 2) % 20, (j * 7 + 12) % 20]) put(rows, [[x, y], [x + 1, y], [x + 2, y]], "u"); });
  return rows;
}
/* quicksand: flat settled sand, six grains, a stepped DIAMOND dimple */
function bedQuick() {
  const rows = paintCell(20, 20, (x, y) => { const m = Math.abs(x - 9.5) + Math.abs(y - 9.5); return m <= 1 ? "k" : m <= 3 ? "s" : "a"; });
  put(rows, [[4, 15], [15, 4], [13, 16], [5, 7], [16, 12], [8, 4]], "d");
  return rows;
}
const PORTAL_PAL = {w: "tile.wall", H: "tile.wall.light"};
const PORTAL_BED = ringCell((d, x, y) => (d >= 7 ? "a" : d === 6 ? (x + y < 19 && (x === 3 || y === 3) ? "H" : "k") : d === 5 ? "w" : d >= 3 ? "k" : d === 2 ? "q" : d === 1 ? "u" : "l"));
const GATE_PAL = {h: "tile.wall", w: "tile.wall.shadow", W: "tile.bg1", I: "tile.wall.shadow", i: "tile.wall.outline"};
const GATE_BED = ringCell((d, x, y) => (d >= 7 ? "a" : d === 6 ? "h" : d === 5 ? "w" : y >= 5 && y <= 14 && [6, 9, 12].includes(x) ? "I" : y >= 5 && y <= 14 && [7, 10, 13].includes(x) ? "i" : "k"));

/* ---- marks (hand-authored; "M" = this heat's mark slot) ---- */
const CHEV = [["M....", "MM...", "MMM..", "MMMM.", "MMMM.", "MMM..", "MM...", "M...."], ["MM...", ".MM..", "..MM.", "...MM", "..MM.", ".MM..", "MM..."], ["M...", "MM..", ".MM.", "..MM", ".MM.", "MM..", "M..."]];
const CHEV_X = [[8], [3, 13], [3, 9, 15]];
const ARROW = [["....MM.", "MMMMMMM", "....MM."], [".....M.", "MMMMMMM", ".....M."], ["....M..", ".....M.", "MMMMMMM", ".....M.", "....M.."]];
/* booster: a stem (midrib "M") from the pore out along each diagonal, with
   1 / 2 / 3 SOLID leaf bodies ("f") on it: [first, last] index per leaf,
   mirrored into all four diagonals (an x, never a +) */
const LEAVES = [[[3, 7]], [[3, 4], [6, 7]], [[3, 3], [5, 5], [7, 7]]];
const STEM0 = [2, 2, 3];
const LEAF = LEAVES.map((ls, h) => {
  const q = R("..........", 10);
  for (const [a, b] of ls) for (let i = a; i <= b; i++) { at(q, i + 1, i, "f"); at(q, i, i + 1, "f"); }
  for (let i = STEM0[h]; i <= 8; i++) at(q, i, i, "M");
  return q;
});
/* quicksand: 1 / 2 / 3 spiral arms converging on the dimple */
const SPIRAL = [0, 1, 2].map((h) => {
  const n = h + 1, pts = new Map();
  for (let k = 0; k < n; k++) for (let j = 0; j <= 60; j++) {
    const u = j / 60, th = (k * 2 * Math.PI) / n - 0.6 + u * (n === 1 ? 3.4 : 2.3), r = 6.6 - 3.9 * u;
    const x = Math.round(9.5 + Math.cos(th) * r - 0.5 + 0.5), y = Math.round(9.5 + Math.sin(th) * r - 0.5 + 0.5);
    pts.set(x + "," + y, [x, y]);
  }
  return [...pts.values()];
});
const PIPS = [[5, 5], [8, 5], [5, 8]].map(([x, y]) => [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]);
const KERB = [[0, 3, 1, 0], [16, 0, 0, 1], [0, 16, 1, 0], [3, 0, 0, 1]];

/* ---- edges + lip ---- */
function edgeRows(rows, h, side, natural, force) {
  const hh = force != null ? force : h;
  const pts = (fn) => { for (let i = 0; i < 20; i++) for (let j = 0; j < 3; j++) { const ch = fn(i, j); if (!ch) continue; const [x, y] = side === "N" ? [i, j] : side === "S" ? [i, 19 - j] : side === "W" ? [j, i] : [19 - j, i]; at(rows, x, y, ch); } };
  if (hh === 0) return pts((i, j) => (j === 0 ? "Q" : null));
  if (hh === 1) return pts((i, j) => (j < 2 && i % 5 < 2 ? "M" : null));
  if (natural) return pts((i, j) => (j === 0 ? (i % 4 < 3 ? "M" : "B") : j === 1 ? (i % 4 === 1 ? "M" : "B") : "B"));
  const bx = (i, j) => (side === "N" ? [i, j] : side === "S" ? [i, 19 - j] : side === "W" ? [j, i] : [19 - j, i]);
  return pts((i, j) => { const [x, y] = bx(i, j); return ((x - y) % 5 + 5) % 5 < 2 ? "M" : "B"; });
}
function lip(rows, sides) {
  for (const sd of sides) for (let i = 0; i < 20; i++) {
    if (sd === "N") { at(rows, i, 0, "o"); if (rows[1][i] !== "o") at(rows, i, 1, "s"); }
    if (sd === "W") { at(rows, 0, i, "o"); at(rows, 1, i, "s"); }
    if (sd === "S") at(rows, i, 19, "A");
    if (sd === "E") at(rows, 19, i, "A");
  }
}
const L2B = (d, l) => SIDES[(SIDES.indexOf(l) + d) % 4];

/* one 20x20 cell. spec: {kind, h, dir, outer, gx, gy, pair, lit, exit} */
export function featPxCell(biome, s) {
  const h = s.h, nat = NATURAL.has(biome), outer = s.outer || SIDES, P = palFor(biome, h);
  let rows, pal = {}, rot = 0;
  if (s.kind === "BELT") {
    rows = BELT[h].slice(); pal = BELT_PAL; rot = s.dir || 0;
    for (const x of CHEV_X[h]) stamp(rows, CHEV[h], x, 6, "k");
  } else if (s.kind === "STREAM") {
    rows = bedStream(h); pal = STREAM_PAL; rot = s.dir || 0;
    [[10], [6, 13], [4, 9, 14]][h].forEach((y, j) => { const x0 = (3 + j * 6) % 20; for (const x of h === 2 ? [x0 - 10, x0] : [x0]) stamp(rows, ARROW[h], x, y - (h === 2 ? 2 : 1), "k"); });
  } else if (s.kind === "GLIDE") {
    rows = bedGlide(s.gx || 0, s.gy || 0);
    const sp = [20, 10, 10][h];
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      const d = ((x + y + (s.gx || 0) * 20 + (s.gy || 0) * 20) % sp + sp) % sp, run = ((x - y + (s.gx || 0) * 7 + 40) % 10);
      if (d === 0 && run < 6) at(rows, x, y, "M"); else if (d === 1 && run < 6) at(rows, x, y, "A");
    }
  } else if (s.kind === "BLOOM") {
    rows = R(fill(20, "a"), 20); pal = {f: "tile.floor0.light"};
    const q = LEAF[h];
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) { const ch = q[y][x]; if (ch === ".") continue; for (const [X, Y] of [[x, y], [19 - x, y], [x, 19 - y], [19 - x, 19 - y]]) at(rows, X, Y, ch); }
    put(rows, [[9, 9], [10, 9], [9, 10], [10, 10]], "k");
  } else if (s.kind === "PLATE") {
    rows = bedPlate(); pal = PLATE_PAL;
    stamp(rows, ["M..", ".M.", "..M", ".M.", "M.."], 6, 7, "W");
    stamp(rows, ["..M", ".M.", "M..", ".M.", "..M"], 11, 7, "W");
    if (h < 2) for (let i = 3; i <= 16; i++) if (h === 0 || (i - 3) % 5 < 3) put(rows, [[i, 3], [i, 16], [3, i], [16, i]], h ? "M" : "Q");
    for (const a of [[9], [8, 11], [7, 9, 12]][h]) put(rows, [[a, 5], [a, 14], [5, a], [14, a]], "M");
  } else if (s.kind === "QUICK") {
    rows = bedQuick(); put(rows, SPIRAL[h], "M");
  } else if (s.kind === "PORTAL") {
    rows = PORTAL_BED.slice(); pal = PORTAL_PAL;
    for (const [d, ch] of [[[2, "M"]], [[4, "q"], [2, "M"]], [[4, "q"], [2, "q"], [1, "M"]]][h]) square(rows, d, ch);
  } else if (s.kind === "GATE") {
    rows = GATE_BED.slice(); pal = GATE_PAL;
    for (const y of [[9], [7, 11], [6, 9, 12]][h]) for (let x = 5; x <= 14; x++) if (x % 3) { at(rows, x, y, "M"); at(rows, x, y + 1, "i"); }
  }
  let c = {w: 20, h: 20, rows};
  if (rot) c = rot90(c, rot);
  rows = c.rows.slice();
  if (s.kind === "BELT") {
    lip(rows, outer.filter((sd) => sd !== L2B(rot, "N") && sd !== L2B(rot, "S")));
    if (h) for (const sd of [L2B(rot, "N"), L2B(rot, "S")]) edgeRows(rows, h, sd, nat);
    if (s.exit) edgeRows(rows, h, L2B(rot, "E"), nat);
  } else if (s.kind === "STREAM") {
    const banks = [L2B(rot, "N"), L2B(rot, "S")].filter((sd) => outer.includes(sd));
    lip(rows, outer); for (const sd of banks) edgeRows(rows, h, sd, nat);
  } else if (s.kind === "PLATE") {
    lip(rows, outer); if (h === 2) for (const sd of SIDES) edgeRows(rows, h, sd, nat);
  } else if (s.kind === "BLOOM" || ((s.kind === "PORTAL" || s.kind === "GATE") && h === 2)) {
    lip(rows, outer); for (const sd of SIDES) edgeRows(rows, h, sd, nat);
  } else { lip(rows, outer); for (const sd of outer) edgeRows(rows, h, sd, nat); }
  if (s.kind === "PORTAL") {
    for (const [x, y, dx, dy] of [[2, 2, 1, 1], [17, 2, -1, 1], [2, 17, 1, -1], [17, 17, -1, -1]]) put(rows, [[x, y], [x + dx, y], [x, y + dy]], "M");
    for (const p of PIPS.slice(0, s.pair || 1)) put(rows, p, "P");
  }
  if (s.kind === "GATE") KERB.forEach(([x, y, dx, dy], i) => { for (let k = 8; k <= 11; k++) at(rows, x + dx * k, y + dy * k, i < (s.lit || 0) ? "F" : "W"); });
  return {w: 20, h: 20, rows, pal: {...P, ...pal}};
}
export { overlayCell };
