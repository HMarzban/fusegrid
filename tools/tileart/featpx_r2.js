/* THROWAWAY PROTOTYPE (tile art detail pass, 2026-10-23): PIXEL cells for
   the eight floor tiles. Palette-SLOT grids only (../pixel/grid.js format,
   never hex): every char maps to "tile.<BIOMES field>[.step]" through the
   pinned pxRamp, so each biome bakes its own ramp. 20x20 art px, 1 art px =
   2 logical px. Kept OUT of src/render/pixel/** on purpose: the px tree has
   771 B under its 122 KB cap, so wiring waits for the dynamic import (#15);
   nothing in the game imports this yet (export tool + tests only).
   Build order per cell: material bed (hand-placed detail, ordered dither
   for the ramps) -> inlay lip (AO on N/W, lit sliver on S/E, outer sides
   only) -> marks (hand-authored sprites with a 1-px drop shade) -> heat
   edge strip (keyline / 3-on-2-off dash / 2-of-5 hatch / 4-px teeth).
   Heat never changes a hue: the mark slot steps .shadow -> base -> .light
   (dark polarity: .light -> base -> .shadow), density 1/2/3, tip shape. */
import {paintCell, overlayCell, rot90} from "../../src/render/pixel/grid.js";

const DARK = {ICE: "wall", SAND: "bg1"};
const NATURAL = new Set(["JUNGLE", "WATER", "SAND"]);
const SIDES = ["N", "E", "S", "W"];
const STEP_L = [".shadow", "", ".light"], STEP_D = [".light", "", ".shadow"];
/* the shared slot map; family beds add their own chars */
export function palFor(biome, h) {
  const d = DARK[biome], m = d ? "tile." + d : "tile.wallHi", st = d ? STEP_D : STEP_L;
  const sheet = biome === "SAND" ? "tile.floor1.shadow" : "tile.floor1";
  return {M: m + st[h], Q: d ? m + ".light" : m + ".outline", F: m + (d ? ".shadow" : ".light"), B: d ? "tile.floor0" : "tile.bg1",
    a: sheet, A: biome === "SAND" ? "tile.wall.shadow" : "tile.floor1.light", s: biome === "SAND" ? "tile.bg0" : "tile.floor1.shadow",
    o: "tile.floor1.outline", k: "tile.bg1", f: "tile.floor0", g: "tile.floor0.light",
    h: "tile.wall", w: "tile.wall.shadow", W: "tile.wall.outline", H: "tile.wall.light", l: "tile.wallHi", L: "tile.wallHi.light", q: "tile.wallHi.outline", u: "tile.wallHi.shadow", d: "tile.bg0"};
}
const R = (row, n) => Array(n).fill(row);
const cell = (rows) => ({w: rows[0].length, h: rows.length, rows});
const at = (rows, x, y, ch) => { if (y < 0 || y >= rows.length || x < 0 || x >= rows[y].length) return; rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1); };
const put = (rows, pts, ch) => { for (const [x, y] of pts) at(rows, x, y, ch); };
/* a sprite with an optional 1-px drop shade (down-right, away from the key) */
function stamp(rows, spr, dx, dy, shade) {
  const each = (fn) => spr.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== ".") fn(x, y, r[x]); });
  if (shade) each((x, y) => at(rows, dx + x + 1, dy + y + 1, shade));
  each((x, y, ch) => at(rows, dx + x, dy + y, ch));
}
const hsh = (a, b, c) => { let v = (a * 374761393 + b * 668265263 + c * 2147483647) >>> 0; v = Math.imul(v ^ (v >>> 13), 1274126177) >>> 0; return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };

/* ---- beds ---- */
const RIB = "kRrrkRrrkRrrkRrrkRrr";
const RIBS = ["kRrrkRrrkRrrkRrrkRrr", "kRrrkRrdkRrrkRrrkRrr", "kRrrkRrrkRrrkRdrkRrr", "kRdrkRrrkRrrkRrrkRrr", "kRrrkRrrkRrrkRrrkRrd", "kRrrkRrrkRdrkRrrkRrr"];
const RAIL = "wwvwwwwvwwwwvwwwwvww";
const BELT = [
  /* CORE: brushed deck, 2-row riveted rails hugging an 8-row groove */
  ["aaaaaaaaaaaaaaaaaaaa", "aaaAaaaaaaaaAaaaaaaa", "aaaaaaaaaaaaaaaaaaaa", "ssssssssssssssssssss", "hhhhhhhhhhhhhhhhhhhh", RAIL, "kkkkkkkkkkkkkkkkkkkk",
    RIBS[0], RIBS[1], RIBS[2], RIBS[3], RIBS[4], RIBS[5], "kkkkkkkkkkkkkkkkkkkk", "hhhhhhhhhhhhhhhhhhhh", RAIL, "WWWWWWWWWWWWWWWWWWWW", "aaaaaaaaaaaaaaaaaaaa", "aaaaaaaAaaaaaaaaaAaa", "aaaaaaaaaaaaaaaaaaaa"],
  /* PLUS: full bed between 3-row rails */
  ["hhhhhhhhhhhhhhhhhhhh", RAIL, "WWWWWWWWWWWWWWWWWWWW", "kkkkkkkkkkkkkkkkkkkk", ...RIBS, ...RIBS, "kkkkkkkkkkkkkkkkkkkk", "hhhhhhhhhhhhhhhhhhhh", RAIL, "WWWWWWWWWWWWWWWWWWWW"],
  /* MAX: band rows 0-2 / 17-19 (edge strip), thin rails, bed between */
  [...R("kkkkkkkkkkkkkkkkkkkk", 3), "hhhhhhhhhhhhhhhhhhhh", RAIL, "kkkkkkkkkkkkkkkkkkkk", ...RIBS, RIBS[0], RIBS[3], "kkkkkkkkkkkkkkkkkkkk", "hhhhhhhhhhhhhhhhhhhh", RAIL, ...R("kkkkkkkkkkkkkkkkkkkk", 3)],
];
const BELT_PAL = {r: "tile.floor1.shadow", R: "tile.floor1", k: "tile.bg1", v: "tile.wall", d: "tile.floor0", h: "tile.wall.shadow", w: "tile.wall.outline", W: "tile.bg1"};
function bedGlide(gx, gy) {
  const rows = paintCell(20, 20, (x, y) => { const d = (x + y + gx * 20 + gy * 20) % 40; return d >= 11 && d <= 16 ? "A" : (d === 9 || d === 18) && (x + y) % 2 === 0 ? "A" : (d === 10 || d === 17) && x % 2 === 0 ? "A" : "a"; });
  put(rows, [[3, 6], [4, 5], [5, 4], [6, 3]], "l");
  for (let i = 0; i < 3; i++) { const x = 4 + ((hsh(gx, gy, i) * 11) | 0), y = 4 + ((hsh(gy, i, gx) * 11) | 0); put(rows, [[x, y], [x + 1, y + 1], [x + 2, y + 2]], "A"); }
  put(rows, [[17, 3], [3, 16]], "l");
  return rows;
}
const BLOOM_BED = [
  "aaaaaaafaaaaaaaaaaaa", "aaafaaaaakaaaaaafaaa", "aaaaaaaaaakaaaaaaaaa", "afaaaaaaaaakaaaaaaga", "aaaaafaaaaakaaafaaaa",
  "aaaaaaaaaaaaaaaaaaaa", "aakaaaaaaaaaaaaaaaaa", "aaakkaaaaaaaaaaakkaa", "gaaaakaaaaaaaaakaaaa", "aaaaaakaaaaaaaaaaaaf",
  "aaaaaaaaaaaaaaaaaaaa", "aaafaaaaaaaaaakaaaaa", "aaaaakaaaaaaaaakaaaa", "aaaakaaaaaaaaaaakkaa", "aaakaaaaaaaaaaaaaaka",
  "afaaaaaaaaaaaaaaaaaa", "aaaaaaaakaaaaaaagaaa", "aaaaafaaakaaaaaaaaaa", "aaaaaaaaaakaaaafaaaa", "aaaaaaaaaaakaaaaaaaa"];
const PLATE_BED = [
  "aaaaaaaaaaaaaaaaaaaa", "aaaaaaaaaaaaaaaaaaaa", "aaaaaaaaaaaaaaaaaaaa", "aaaooooooooooooooaaa",
  "aaaoWWWWWWWWWWWWhaaa", "aaaoWuwwwwwwwwuwhaaa", "aaaoWwWWWWWWWWwwhaaa", "aaaoWwWwwwwwwhwwhaaa",
  "aaaoWwWwwwwwwhwwhaaa", "aaaoWwWwwwwwwhwwhaaa", "aaaoWwWwwwwwwhwwhaaa", "aaaoWwWwwwwwwhwwhaaa",
  "aaaoWwWwwwwwwhwwhaaa", "aaaoWwWhhhhhhhwwhaaa", "aaaoWuwwwwwwwwuwhaaa", "aaaoWhhhhhhhhhhhhaaa",
  "aaaahhhhhhhhhhhhhaaa", "aaaaaaaaaaaaaaaaaaaa", "aaaaaaaaaaaaaaaaaaaa", "aaaaaaaaaaaaaaaaaaaa"];
const PLATE_PAL = {w: "tile.wall.shadow", W: "tile.wall.outline", h: "tile.wall", u: "tile.wall.light"};
function bedStream() {
  const rows = paintCell(20, 20, (x, y) => { const e = Math.min(y, 19 - y); return e <= 1 ? "f" : e === 2 ? (x % 2 ? "f" : "a") : e === 7 ? (x % 2 === y % 2 ? "s" : "a") : e >= 8 ? "s" : "a"; });
  put(rows, [[0, 5], [1, 5], [2, 4], [3, 4], [4, 4], [5, 5], [6, 6], [7, 6], [8, 5], [9, 5], [10, 6], [11, 6], [12, 7], [13, 7], [14, 6], [15, 6], [16, 5], [17, 5], [18, 5], [19, 5],
    [1, 13], [2, 13], [3, 12], [4, 12], [5, 12], [6, 13], [7, 14], [8, 14], [9, 13], [10, 13], [11, 12], [12, 12], [13, 13], [14, 14], [15, 14], [16, 13], [17, 13], [18, 12], [19, 12], [0, 12],
    [5, 6], [5, 7], [5, 8], [12, 8], [12, 9], [13, 10], [13, 11], [7, 15], [9, 9], [9, 10], [9, 11], [17, 6], [17, 7], [16, 8]], "u");
  put(rows, [[3, 9], [4, 9], [14, 15], [15, 15], [11, 3], [12, 3], [16, 10], [17, 10]], "l");
  return rows;
}
const STREAM_PAL = {u: "tile.floor0.light"};
function bedQuick() {
  const rows = paintCell(20, 20, (x, y) => { const w = (y + Math.round(1.2 * Math.sin((x + y * 0.4) / 3.2))) % 5; return w === 0 ? ((x + y) % 3 ? "A" : "a") : "a"; });
  for (let i = 0; i < 22; i++) at(rows, (hsh(i, 3, 1) * 20) | 0, (hsh(i, 4, 1) * 20) | 0, i % 3 ? "d" : "g");
  for (let y = 6; y <= 13; y++) for (let x = 6; x <= 13; x++) if ((x + y) % 2 === 0 && rows[y][x] === "a") at(rows, x, y, "d");
  return rows;
}
const PORTAL_BED = [
  "aaaaaaaaaaaaaaaaaaaa", "aaaaaaaaaaaaaaaaaaaa", "aaaaaaaaaaaaaaaaaaaa", "aaaHHHHHHHHHHHHHHaaa",
  "aaaHwwwwwkwwwwwwkaaa", "aaaHwkkkkkkkkkkhkaaa", "aaaHwkoooooooooHkaaa", "aaaHwkoqqqqqqqoHkaaa",
  "aaaHkkoqquuuuqoHkaaa", "aaaHwkoquuLLuqoHkaaa", "aaaHwkoquuLLuqoHkaaa", "aaaHwkoqquuuuqoHkaaa",
  "aaaHwkoqqqqqqqoHkaaa", "aaaHwkoooooooooHwkaa", "aaaHwkHHHHHHHHHHwkaa", "aaaHwwwwwwkwwwwwwkaa",
  "aaaakkkkkkkkkkkkkkaa", "aaaaaaaaaaaaaaaaaaaa", "aaaaaaaaaaaaaaaaaaaa", "aaaaaaaaaaaaaaaaaaaa"];
const PORTAL_PAL = {w: "tile.wall", H: "tile.wall.light", o: "tile.bg1", q: "tile.wallHi.outline", u: "tile.wallHi.shadow", L: "tile.wallHi.light"};
const GATE_BED = [
  "aaaaaaaaaaaaaaaaaaaa", "aaaaaaaaaaaaaaaaaaaa", "aaaaaaaaaaaaaaaaaaaa", "aaahhhhhhhhhhhhhhaaa",
  "aaahwwwwwwWwwwwwwkaa", "aaahwkkkkkkkkkkwwkaa", "aaahwkIikkIikkIiwkaa", "aaahwkIikkIikkIiwkaa",
  "aaahWkIikkIikkIiwkaa", "aaahwkIikkIikkIiwkaa", "aaahwkIikkIikkIiWkaa", "aaahwkIikkIikkIiwkaa",
  "aaahwkIikkIikkIiwkaa", "aaahwkIikkIikkIiwkaa", "aaahwkkkkkkkkkkwwkaa", "aaahwwwwwWwwwwwwwkaa",
  "aaaakkkkkkkkkkkkkkaa", "aaaaaaaaaaaaaaaaaaaa", "aaaaaaaaaaaaaaaaaaaa", "aaaaaaaaaaaaaaaaaaaa"];
const GATE_PAL = {h: "tile.wall", w: "tile.wall.shadow", W: "tile.bg1", I: "tile.wall.shadow", i: "tile.wall.outline"};

/* ---- marks (hand-authored; "M" = this heat's mark slot) ---- */
const CHEV = [["MM...", ".MM..", "..MM.", "...MM", "...MM", "..MM.", ".MM..", "MM..."], ["MM...", ".MM..", "..MM.", "...MM", "..MM.", ".MM..", "MM..."], ["M...", "MM..", ".MM.", "..MM", ".MM.", "MM..", "M..."]];
const ARROW = [["....MM.", "MMMMMMM", "....MM."], [".....M.", "MMMMMMM", ".....M."], ["....M..", ".....M.", "MMMMMMM", ".....M.", "....M.."]];
const WAVE = [["..MMMM..........", ".M....M.........", "M......M.......M", "........M.....M.", ".........MMMMM.."],
  ["..MMMM..........", ".M....M.........", "M......M.......M", "........M.....M.", ".........MMMMM.."],
  ["..MMM.......", ".M...M......", "M.....M....M", ".......MMMM."]];
/* booster: the top-left quadrant (centre = its bottom-right corner); "f" =
   leaf body (floor0.light), "M" = midrib; mirrored into all four diagonals */
/* each leaf: [tip i, base i, half-widths from tip to base]; i runs along
   the diagonal toward the centre pore at (9,9); "f" body, "M" midrib */
const LEAVES = [[[2, 8, [0, 1, 1, 2, 2, 1, 0]]], [[1, 4, [0, 1, 1, 0]], [6, 8, [0, 1, 0]]], [[1, 2, [0, 1]], [4, 5, [0, 1]], [7, 8, [0, 1]]]];
const LEAF = LEAVES.map((ls) => {
  const q = R("..........", 10);
  for (const [t, b, wd] of ls) for (let i = t; i <= b; i++) { const w = wd[i - t] || 0; for (let d = 1; d <= w; d++) { at(q, i + d, i, "f"); at(q, i, i + d, "f"); } at(q, i, i, "M"); }
  return q;
});

/* ---- edges + lip ---- */
function edgeRows(rows, h, side, natural, force) {
  const hh = force != null ? force : h;
  const pts = (fn) => { for (let i = 0; i < 20; i++) for (let j = 0; j < 3; j++) { const ch = fn(i, j); if (!ch) continue; const [x, y] = side === "N" ? [i, j] : side === "S" ? [i, 19 - j] : side === "W" ? [j, i] : [19 - j, i]; at(rows, x, y, ch); } };
  if (hh === 0) return pts((i, j) => (j === 0 ? "Q" : null));
  if (hh === 1) return pts((i, j) => (j === 0 ? (i % 5 < 3 ? "M" : null) : j === 1 && i % 5 < 3 ? "o" : null));
  if (natural) return pts((i, j) => (j === 0 ? (i % 4 < 3 ? "M" : "B") : j === 1 ? (i % 4 === 1 ? "M" : "B") : "B"));
  const bx = (i, j) => (side === "N" ? [i, j] : side === "S" ? [i, 19 - j] : side === "W" ? [j, i] : [19 - j, i]);
  return pts((i, j) => { const [x, y] = bx(i, j); return ((x - y) % 5 + 5) % 5 < 2 ? "M" : "B"; });
}
function lip(rows, sides) {
  for (const sd of sides) for (let i = 0; i < 20; i++) {
    if (sd === "N") { at(rows, i, 0, "o"); if (rows[1][i] !== "o") at(rows, i, 1, "s"); if (i % 2 === 0) at(rows, i, 2, "s"); }
    if (sd === "W") { at(rows, 0, i, "o"); at(rows, 1, i, "s"); if (i % 2) at(rows, 2, i, "s"); }
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
    const n = h + 1, sp = 20 / n;
    for (let i = 0; i < n; i++) stamp(rows, CHEV[h], Math.round(sp * (i + 0.5) - 2.5), 6, "k");
  } else if (s.kind === "STREAM") {
    rows = bedStream(); pal = STREAM_PAL; rot = s.dir || 0;
    const ys = [[10], [6, 13], [4, 9, 14]][h];
    ys.forEach((y, j) => { const x0 = (3 + j * 6) % 20; for (const x of h === 2 ? [x0 - 10, x0] : [x0]) stamp(rows, ARROW[h], x, y - (h === 2 ? 2 : 1), "k"); });
  } else if (s.kind === "GLIDE") {
    rows = bedGlide(s.gx || 0, s.gy || 0);
    const sp = [20, 10, 7][h];
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      const d = ((x + y + (s.gx || 0) * 20 + (s.gy || 0) * 20) % sp + sp) % sp, run = ((x - y + (s.gx || 0) * 7 + 40) % 10);
      if (d === 0 && run < 6) at(rows, x, y, "M"); else if (d === 1 && run < 6) at(rows, x, y, "A");
    }
  } else if (s.kind === "BLOOM") {
    rows = BLOOM_BED.slice(); pal = {f: "tile.floor0.light"};
    const q = LEAF[h];
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) { const ch = q[y][x]; if (ch === ".") continue; for (const [X, Y] of [[x, y], [19 - x, y], [x, 19 - y], [19 - x, 19 - y]]) at(rows, X, Y, ch); }
    put(rows, [[9, 9], [10, 9], [9, 10], [10, 10]], "k"); at(rows, 9, 9, "M");
  } else if (s.kind === "PLATE") {
    rows = PLATE_BED.slice(); pal = PLATE_PAL;
    stamp(rows, ["M..", ".M.", "..M", "..M", ".M.", "M.."], 6, 7, "W");
    stamp(rows, ["..M", ".M.", "M..", "M..", ".M.", "..M"], 11, 7, "W");
    if (h === 0) { for (let i = 3; i <= 16; i++) { at(rows, i, 3, "Q"); at(rows, i, 16, "Q"); at(rows, 3, i, "Q"); at(rows, 16, i, "Q"); } }
    if (h === 1) for (let i = 3; i <= 16; i++) if ((i - 3) % 5 < 3) { at(rows, i, 3, "M"); at(rows, i, 16, "M"); at(rows, 3, i, "M"); at(rows, 16, i, "M"); }
    const tk = [[9.5], [8, 11], [7, 9.5, 12]][h];
    for (const v of tk) { const a = Math.floor(v), b = Math.ceil(v); void b; put(rows, [[a, 4], [a, 15], [4, a], [15, a]], "M"); }
  } else if (s.kind === "QUICK") {
    rows = bedQuick();
    const ys = [[11], [6, 12], [4, 9, 14]][h];
    for (const y of ys.slice(0, h + 1)) { const spr = WAVE[h]; stamp(rows, spr.map((r) => r.replace(/M/g, "A")), h === 2 ? 4 : 2, y - 2 + 1); stamp(rows, spr, h === 2 ? 4 : 2, y - 2); }
  } else if (s.kind === "PORTAL") {
    rows = PORTAL_BED.slice(); pal = PORTAL_PAL;
    const sq = [[[7, "M"]], [[5, "q"], [7, "M"]], [[5, "q"], [7, "q"], [8, "M"]]][h];
    for (const [d, ch] of sq) for (let i = d; i <= 19 - d; i++) { at(rows, i, d, ch); at(rows, i, 19 - d, ch); at(rows, d, i, ch); at(rows, 19 - d, i, ch); }
  } else if (s.kind === "GATE") {
    rows = GATE_BED.slice(); pal = GATE_PAL;
    for (const y of [[9], [7, 11], [6, 9, 12]][h]) for (let x = 5; x <= 14; x++) { at(rows, x, y, "M"); at(rows, x, y + 1, "i"); }
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
    put(rows, [[2, 2], [3, 2], [4, 2], [2, 3], [2, 4], [17, 2], [16, 2], [15, 2], [17, 3], [17, 4], [2, 17], [3, 17], [4, 17], [2, 16], [2, 15], [17, 17], [16, 17], [15, 17], [17, 16], [17, 15]], "M");
    for (let i = 0; i < (s.pair || 1); i++) put(rows, [[9 + i * 2, h === 2 ? 3 : 1]], "M");
  }
  if (s.kind === "GATE") {
    const seg = h === 2 ? [[[8, 3], [9, 3], [10, 3], [11, 3]], [[16, 8], [16, 9], [16, 10], [16, 11]], [[8, 16], [9, 16], [10, 16], [11, 16]], [[3, 8], [3, 9], [3, 10], [3, 11]]]
      : [[[8, 1], [9, 1], [10, 1], [11, 1]], [[18, 8], [18, 9], [18, 10], [18, 11]], [[8, 18], [9, 18], [10, 18], [11, 18]], [[1, 8], [1, 9], [1, 10], [1, 11]]];
    seg.forEach((p, i) => put(rows, p, i < (s.lit || 0) ? "F" : "q"));
  }
  return {w: 20, h: 20, rows, pal: {...P, ...pal}};
}
export { overlayCell };
