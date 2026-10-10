/* PIXEL placeholders. Any manifest cell without authored art is GENERATED
   here as an ordinary palette-slot grid, so it travels the same grid -> atlas
   -> drawImage path as real art (browser and Node identical) and ?render=px is
   always a complete, playable board while art lands. These are stand-ins, not
   art: plain outlined shapes in each entity's own repo hex. */
import {paintCell, rot90} from "./grid.js";

const CH = {o: "body.outline", s: "body.shadow", b: "body.base", l: "body.light", e: "eye", k: "ink", w: "spec", f: "fin", F: "fin.light", t: "feet", r: "shieldc", p: "passc"};
const blank = (w, h) => Array.from({length: h}, () => Array(w).fill("."));
const toRows = (g) => g.map((r) => r.join(""));
const inE = (x, y, cx, cy, rx, ry) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
function fill(g, fn, ch) { for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) if (fn(x, y)) g[y][x] = ch; }
function ring(g, ch = "o") {
  const h = g.length, w = g[0].length, add = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (g[y][x] !== ".") continue;
    const n = (x > 0 && g[y][x - 1] !== ".") || (x < w - 1 && g[y][x + 1] !== ".") || (y > 0 && g[y - 1][x] !== ".") || (y < h - 1 && g[y + 1][x] !== ".");
    if (n) add.push([x, y]);
  }
  for (const [x, y] of add) g[y][x] = ch;
}
const put = (g, x, y, ch) => { if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = ch; };
const cell = (g, pal, extra) => ({w: g[0].length, h: g.length, rows: toRows(g), pal, ...extra});

function makoGrid(face, o = {}) {
  const g = blank(20, 20), ax = 9, cx = ax + 0.5, lift = o.lift || 0, by = 12.5 - (o.up || 0);
  const rx = o.deflate ? 5.5 - o.deflate : 6.5, ry = o.deflate ? 5 - o.deflate : 5.5;
  if (!o.noFins) {
    const fh = o.fold ? 3 : 7 + (o.up || 0);
    fill(g, (x, y) => { const d = Math.abs(x - ax), r = by - 0.5 - y; return r >= 0 && r <= fh && d >= 4 + r * 0.35 && d <= 6 + r * 0.45 && !(face === "side" && x < ax && r > fh - 2); }, "f");
    fill(g, (x, y) => g[y][x] === "f" && (y === 0 || g[y - 1][x] !== "f"), "F");
  }
  for (const s of [-1, 1]) { const fx = ax + s * 3; for (let x = fx - 1; x <= fx + 1; x++) put(g, x, 18 - (lift === s ? 1 : 0), "t"); }
  if (o.kick) for (let x = 13; x <= 15; x++) put(g, x, 17, "t");
  fill(g, (x, y) => inE(x, y, cx, by, rx, ry), "b");
  fill(g, (x, y) => g[y][x] === "b" && (x - ax) + (y - by) > rx * 0.9, "s");
  fill(g, (x, y) => g[y][x] === "b" && (x - ax) + (y - by) < -rx * 0.95, "l");
  if (!o.deflate || o.deflate < 2) {
    const sh = face === "side" ? 1 : 0, ey = by - 5;
    for (const s of [-1, 1]) {
      const ex = ax + s * 3 + sh + 0.5;
      fill(g, (x, y) => inE(x, y, ex, ey, 2.1, 2.1), face === "back" ? "b" : "e");
      if (face !== "back") {
        if (o.squint) for (let x = Math.floor(ex) - 1; x <= Math.floor(ex) + 1; x++) put(g, x, Math.floor(ey), "k");
        else put(g, Math.floor(ex) + sh, Math.floor(ey) + 1, "k");
      }
    }
    if (face !== "back") {
      const my = Math.floor(by) + 2, mx = ax + sh;
      for (let x = mx - 2; x <= mx + 2; x++) put(g, x, my, "k");
      for (let x = mx - 1; x <= mx + 1; x++) put(g, x, my + 1, "k");
      if (!o.squint) { put(g, mx - 1, my, "e"); put(g, mx + 1, my, "e"); }
    }
  }
  ring(g, "o");
  return g;
}
function makoCell(name) {
  const [a, b] = name.split(".");
  if (b) {
    const o = {lift: b === "walk0" ? -1 : b === "walk1" ? 1 : 0, up: b === "idle1" ? 0 : 0};
    const g = makoGrid(a, o);
    if (b === "idle1") { g.shift(); g.push(Array(20).fill(".")); }
    return cell(g, CH, {axis: 9});
  }
  const m = /^(death|mat|win)(\d)$/.exec(name);
  if (m && m[1] === "death") {
    const i = +m[2];
    if (i >= 4) { const g = blank(20, 20); for (let k = 0; k < 8; k++) { const t = (k / 8) * 6.283, r = i === 4 ? 4 : 7; put(g, Math.round(9 + Math.cos(t) * r), Math.round(12 + Math.sin(t) * r * 0.8), k & 1 ? "F" : "l"); } return cell(g, CH, {axis: 9}); }
    return cell(makoGrid("front", {squint: true, fold: i >= 1, deflate: i >= 2 ? i - 1 : 0, noFins: i >= 3}), CH, {axis: 9});
  }
  if (m && m[1] === "mat") {
    const i = +m[2], g = makoGrid("front", {});
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) if (g[y][x] !== "." && (i === 0 ? (x + y) % 3 : i === 1 ? (x + y) % 3 === 0 : 0)) g[y][x] = ".";
    return cell(g, CH, {axis: 9});
  }
  if (m && m[1] === "win") return cell(makoGrid("front", {up: +m[2] ? 1 : 2}), CH, {axis: 9});
  if (name === "kick") return cell(makoGrid("front", {kick: true, lift: 1}), CH, {axis: 9});
  if (name === "throw") return cell(makoGrid("front", {up: 1}), CH, {axis: 9});
  const g = blank(24, 24), dot = name === "passing", rx = dot ? 11.6 : name === "shield1" ? 11.2 : 11.4;
  fill(g, (x, y) => { const d = ((x + 0.5 - 12) / rx) ** 2 + ((y + 0.5 - 13) / (rx * 0.78)) ** 2; return d <= 1 && d >= 0.8 && (!dot || (x + y) % 3 !== 0); }, dot ? "p" : "r");
  return cell(g, CH, {axis: 12, anchor: [12, 10]});
}

const FOE_SHAPE = {
  walker: (x, y) => inE(x, y, 10, 11, 6.5, 6.5) && y < 16,
  fast: (x, y, f) => y >= 6 && y <= 16 && Math.abs(x + 0.5 - 10) <= (f === "back" ? 17 - y : y - 5) * 0.7 + 1,
  chaser: (x, y) => x >= 4 && x <= 15 && y >= 6 && y <= 16 && !((x === 4 || x === 15) && (y === 6 || y === 16)),
  knight: (x, y) => x >= 5 && x <= 14 && y >= 4 && y <= 16 && !(y > 13 && Math.abs(x + 0.5 - 10) > 17 - y),
  stationary: (x, y) => x >= 3 && x <= 16 && y >= 8 && y <= 17,
  boomerang: (x, y) => Math.abs(x + 0.5 - 10) + Math.abs(y + 0.5 - 10) <= 7 && Math.abs(Math.abs(x + 0.5 - 10) - Math.abs(y + 0.5 - 10)) <= 3,
  rocket: (x, y) => x >= 7 && x <= 12 && y >= 3 + Math.max(0, 3 - Math.min(x - 6, 13 - x)) && y <= 15,
  burrow: (x, y) => inE(x, y, 10, 15, 8, 4.5),
  shade: (x, y, f, i) => inE(x, y, 10, 10, 6, 6.5) || (y >= 10 && y <= 15 + ((x + i) % 3 === 0 ? 1 : 0) && x >= 4 && x <= 15),
};
function foeCell(type, nm) {
  const g = blank(20, 20), shape = FOE_SHAPE[type] || FOE_SHAPE.walker;
  const face = /^back/.test(nm) ? "back" : /^side/.test(nm) ? "side" : "front", i = +(nm.match(/\d$/) || [0])[0];
  if (/^plume/.test(nm)) { for (let k = 0; k <= i + 1; k++) put(g, 6 + k * 3, 9 - k - i, "s"); ring(g, "o"); return cell(g, CH); }
  if (nm === "hem") { for (let x = 4; x <= 15; x += 2) put(g, x, 16, "s"); return cell(g, CH); }
  fill(g, (x, y) => shape(x, y, face, i), "b");
  fill(g, (x, y) => g[y][x] === "b" && (y === 19 || g[y + 1][x] !== "b" || x === 19 || g[y][x + 1] !== "b"), "s");
  fill(g, (x, y) => g[y][x] === "b" && (y === 0 || g[y - 1][x] !== "b") && x < 10, "l");
  const ey = type === "burrow" ? 13 : type === "stationary" ? 11 : type === "rocket" ? 8 : 9;
  if (type !== "boomerang" && face !== "back") {
    const sh = face === "side" ? 2 : 0;
    if (nm === "stunned") { put(g, 7, ey, "k"); put(g, 8, ey + 1, "k"); put(g, 12, ey, "k"); put(g, 11, ey + 1, "k"); }
    else if (type === "walker") { for (let x = 7; x <= 11; x++) put(g, x + sh, ey, "e"); put(g, 9 + sh, ey, "k"); }
    else if (type === "stationary") for (let x = 6; x <= 13; x++) put(g, x, ey, x === 9 + (i ? 1 : 0) ? "e" : "k");
    else { put(g, 7 + sh, ey, "e"); put(g, 12 + sh, ey, "e"); put(g, 8 + sh, ey, "k"); put(g, 11 + sh, ey, "k"); }
  }
  if (type === "rocket" && (nm.startsWith("up") || nm.startsWith("down") || nm.startsWith("side"))) { put(g, 9, 16, "l"); put(g, 10, 16, "l"); if (i) { put(g, 9, 17, "l"); put(g, 10, 18, "l"); } }
  if (type === "fast" || type === "knight" || type === "walker" || type === "chaser") if (nm !== "stunned") { put(g, 7 - (i ? 1 : 0), 17, "s"); put(g, 12 + (i ? 1 : 0), 17, "s"); }
  if (type === "knight" && face !== "back") put(g, 6, 5, "w");
  ring(g, "o");
  let c = cell(g, CH);
  if (type === "rocket" && nm.startsWith("down")) c = {...c, rows: c.rows.slice().reverse()};
  if (type === "rocket" && nm.startsWith("side")) c = rot90(c, 1);
  return c;
}

const TP = {a: "tile.floor0", A: "tile.floor0.light", c: "tile.floor1", C: "tile.floor1.light", w: "tile.wall", W: "tile.wall.shadow", X: "tile.wall.outline", h: "tile.wallHi", b: "tile.brickA", B: "tile.brickB", m: "tile.brickB.shadow", i: "tile.brickHi"};
function tileCell(nm) {
  const t = (fn) => ({w: 20, h: 20, rows: paintCell(20, 20, fn), pal: TP});
  if (nm === "floor0" || nm === "floor1") { const a = nm === "floor0" ? "a" : "c", A = a.toUpperCase(); return t((x, y) => ((x * 7 + y * 13) % 23 === 0 ? A : a)); }
  if (nm === "wallTop") return t((x, y) => (y < 2 || x < 1 ? "h" : x > 18 ? "W" : "w"));
  if (nm === "wallFace") return {w: 20, h: 10, rows: paintCell(20, 10, (x, y) => (y === 9 ? "X" : "W")), pal: TP};
  const brick = (x, y) => { const o = Math.floor(y / 5) % 2 ? 5 : 0; return y % 5 === 4 || (x + o) % 10 === 9 ? "m" : y % 5 === 0 ? "i" : "b"; };
  if (nm === "brickTop") return t(brick);
  if (nm === "brickFace") return {w: 20, h: 10, rows: paintCell(20, 10, (x, y) => (y === 9 ? "m" : "B")), pal: TP};
  let m = /^crumble(\d)$/.exec(nm);
  if (m) { const i = +m[1]; return t((x, y) => ((x * 5 + y * 3) % 4 <= i - 1 || (i === 3 && (x + y) % 2) ? "." : brick(x, y))); }
  m = /^slam(\d)$/.exec(nm);
  if (m) { const top = 20 - (+m[1] + 1) * 6; return t((x, y) => (y < top ? "." : y < top + 2 ? "h" : "w")); }
  m = /^motif\.\w+\.(\d)$/.exec(nm);
  if (m) { const k = +m[1]; return t((x, y) => ((k ? x === 6 && y >= 9 && y <= 11 : x >= 12 && x <= 14 && y === 13) ? "A" : ".")); }
  return t(() => "a");
}

const BP = {k: "bomb", K: "bomb.light", o: "stroke", f: "fuse", s: "spark", S: "sparkB", w: "spec", p: "pow.pierce"};
function bombCell(nm) {
  const g = blank(20, 20), r = nm === "swell0" ? 6.4 : nm === "swell1" ? 6.9 : 6;
  if (nm === "body" || nm.startsWith("swell") || nm.startsWith("roll")) {
    fill(g, (x, y) => inE(x, y, 10, 11, r, r), "k");
    const hx = nm === "roll1" ? 11 : nm === "roll0" ? 8 : 7;
    put(g, hx, 8, "K"); put(g, hx + 1, 8, "K"); put(g, hx, 9, "K");
    ring(g, "o");
    return cell(g, BP);
  }
  const fu = /^fuse(\d)$/.exec(nm);
  if (fu) { const n = 4 - +fu[1]; let x = 12, y = 5; for (let k = 0; k < n; k++) { put(g, x, y, "f"); x++; y--; } return cell(g, BP, {tip: [x, y + 1]}); }
  if (nm === "spark") return {w: 3, h: 3, rows: [".s.", "sSs", ".s."], pal: BP, anchor: [1, 1]};
  if (nm === "mark.power") { for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.283; put(g, Math.round(9.5 + Math.cos(a) * 8), Math.round(10.5 + Math.sin(a) * 8), "o"); } return cell(g, BP); }
  if (nm === "mark.pierce") { for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.283 + 0.5; put(g, Math.round(9.5 + Math.cos(a) * 8.5), Math.round(10.5 + Math.sin(a) * 8.5), "p"); } return cell(g, BP); }
  if (nm === "mark.line") { fill(g, (x, y) => inE(x, y, 3, 11, 3, 3) || inE(x, y, 17, 11, 3, 3), "k"); ring(g, "o"); return cell(g, BP); }
  return cell(g, BP);
}

const XP = {0: "blast0", 1: "blast1", 2: "blast2", 3: "blast3", o: "stroke"};
function blastCell(nm) {
  const [piece, age] = nm.split("."), half = age === "grow" ? 4 : age === "full" ? 7 : 4, core = age === "thin" ? 0 : 2;
  const inBand = (v) => v >= 10 - half && v < 10 + half, inCore = (v) => v >= 10 - core && v < 10 + core;
  const body = age === "thin" ? "2" : "1";
  const g = blank(20, 20);
  fill(g, (x, y) => {
    const h = inBand(y) && (piece !== "end" || x <= 16 - (Math.abs(y + 0.5 - 10) > half - 2 ? 1 : 0)), v = piece === "cross" && inBand(x);
    return h || v;
  }, body);
  fill(g, (x, y) => (inCore(y) && (piece !== "end" || x <= 14)) || (piece === "cross" && inCore(x)), "0");
  return cell(g, XP);
}

const IP = {d: "well", r: "body", R: "body.light", s: "body.shadow", o: "body.outline", k: "ink", w: "spec"};
function itemCell(nm) {
  const g = blank(20, 20);
  if (nm === "well") { fill(g, (x, y) => inE(x, y, 10, 10, 7, 7), "d"); return cell(g, IP); }
  const m = /^ring\.(\w+?)(1?)$/.exec(nm);
  if (m) {
    const fam = m[1], alt = !!m[2];
    const ringAt = (x, y, r) => { const d = Math.hypot(x + 0.5 - 10, y + 0.5 - 10); return d <= r && d > r - 1; };
    if (fam === "cap") fill(g, (x, y) => ringAt(x, y, 9), "r");
    else if (fam === "vit") fill(g, (x, y) => ringAt(x, y, 9.5) || ringAt(x, y, 7.6), "r");
    else if (fam === "utl") fill(g, (x, y) => ringAt(x, y, 9.3) && Math.floor(((Math.atan2(y + 0.5 - 10, x + 0.5 - 10) + 7) * 6) / Math.PI + (alt ? 1 : 0)) % 2 === 0, "r");
    else fill(g, (x, y) => ringAt(x, y, alt ? 8.6 : 9.4), alt ? "s" : "r");
    return cell(g, IP);
  }
  fill(g, (x, y) => Math.abs(x + 0.5 - 10) + Math.abs(y + 0.5 - 10) <= 4.6, "r");
  put(g, 9, 8, "R"); put(g, 8, 9, "R");
  ring(g, "o");
  return cell(g, IP);
}

const FP = {w: "spec", 1: "blast1", 2: "blast2", b: "body", B: "body.light", s: "body.shadow"};
function fxCell(nm) {
  const m = /^(\w+?)(\d)$/.exec(nm) || [nm, nm, "0"], i = +m[2], g = blank(9, 9);
  if (m[1] === "puff") { const r = 1.5 + i; const G = blank(20, 20); fill(G, (x, y) => { const d = Math.hypot(x + 0.5 - 10, y + 0.5 - 10); return d <= r && d > r - 1.2 && (x + y + i) % 2 === 0; }, i < 2 ? "B" : "s"); return cell(G, FP); }
  const n = m[1] === "glint" ? 1 + (i === 1 ? 1 : 0) : 1 + i;
  for (let k = -n; k <= n; k++) { put(g, 4 + k, 4, Math.abs(k) === n ? "1" : "w"); put(g, 4, 4 + k, Math.abs(k) === n ? "1" : "w"); }
  if (m[1] === "reveal" && i) { put(g, 1, 1, "2"); put(g, 7, 1, "2"); put(g, 1, 7, "2"); put(g, 7, 7, "2"); }
  return cell(g, FP, {anchor: [4, 4]});
}

export function fallbackCell(group, name) {
  if (group === "mako") return makoCell(name);
  if (group === "foes") { const d = name.indexOf("."); return foeCell(name.slice(0, d), name.slice(d + 1)); }
  if (group === "tiles") return tileCell(name);
  if (group === "bomb") return bombCell(name);
  if (group === "blast") return blastCell(name);
  if (group === "items") return itemCell(name);
  if (group === "fx") return fxCell(name);
  return {w: 1, h: 1, rows: ["."], pal: {}};
}
