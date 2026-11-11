/* KIT ROOM: the world behind the menus (R4) and the next run's start corner (R5). Menus look the same in every art style, so both are the CLASSIC board art on
   the 2D menu canvas, painted through the kit's cell painters (paint.js wallCell / floorCell / brickCell) on artOf(level): the level's REAL board art, the
   untinted biomeOf(level) (appendix 1.3: the backdrop keeps the game's real art, only the veil is tinted; the mock's lane paints the same raw biome).
   tok gives the UI colours only: the veil (tok.bg1), the lane bed (tok.bed) and the cache key (tok.name). roomLook and lane leave the context state as found.
   roomLook   (c, box, level, tok, o) fills bg1, scales the 600 x 520 representative board to COVER box (s = max(w/600, h/520) x o.k) and centres it, then
              lays the veil rgba(toL(tok.bg1, 0.004), o.veil = 0.5) over the box last (appendix 6). The layout is fixed, never the board the run deals:
              border and even-even pillar walls (border codes, pillar variant [0,0,1,2] by hsh seed 7), bricks where hsh(x, y, 10) < 0.42 off both diagonals.
   roomLayer  (box, level, tok, o) the same painted once per key into a cache.js layer at o.dpr (o.look, o.textScale in the key; a veil or k other than
              the default joins the layer name, so a WIN veil never reuses the menu one).
   laneGrid   (level) pure and DOM-free: the representative board as T codes with fair.js stampStart over it (the sealed spawn pocket, doors (5,1) and
              (1,5) BRICK), MAKO on (1,1), the room's first CORE roster foe and its floor tile (core/feat.js HOME, coded by F's first code of that kind) on FLOOR cells of row 1 past the door,
              inside the first 8 columns so a 9-column crop still shows them. Its only true facts: the pocket, the roster, the tile. A fresh grid per call.
   lane       (c, x, y, w, rows, level, tok, o) the first LANE_COLS (o.cols) columns of that grid at s = w / cols, rows x s tall, cut 0.3 cell into the
              top border: the bed, the cells, the tile (featdraw drawSpec, CORE, a lone cell), MAKO and the foe at rest at the appendix 6 scales, a 2 px
              #0b0609 frame on the box edge. Returns the height. No clock: the page animates its focused cell itself.
   foeCell    (c, x, y, s, type, level) a foe at rest on a floor cell of level's world, s px square: a 2 px #0b0609 outline, radius 3, a hard 3 px drop.
   tileCell   (c, x, y, s, level) level's floor tile (core/feat.js HOME, CORE, a lone cell) in the same frame; a world with no tile paints its floor.
   SHARED ROOM (R1 kit): every page with a room blits MENU's own roomLayer at MENU's room dpr, so a hop between pages never refills it.
   roomFit    (F, dpr, held) the dpr left once held bytes sit in BUDGET, never above dpr nor under 0.5 (3 places).
   shareRoom  (rule) MENU installs its rule (its plate, foot reserve and ROOM_RESERVE for the logo; pages/menu.js roomDpr) when it loads.
   roomDpr    (c, F, ui, dpr) that rule's dpr for the box F; throws until it is installed, so no page can fall back to a different room.
   pageRoomDpr (c, F, ui, dpr, held) the lower of MENU's and the page's own fit (its layers held, no logo reserve): the room gives way only there. */
import {CFG, T, key, biomeOf} from "../../core/config.js";
import {stampStart} from "../../core/fair.js";
import {heatRoster} from "../../core/heat.js";
import {F, HOME, featKindOf, isBelt, isStream} from "../../core/feat.js";
import {FOES} from "../../core/entities.js";
import {drawPlayerBody, drawEnemyBody} from "../sprites.js";
import {drawSpec} from "../featdraw.js";
import {rr} from "../icons.js";
import {floorVar} from "../floorart.js";
import {borderCode} from "../wallvar.js";
import {wallCell, floorCell, brickCell} from "./paint.js";
import {CONST, toL} from "./tokens.js";
import {layer, BUDGET} from "./cache.js";

const C = CFG.COLS, R = CFG.ROWS, TS = 40, BW = C * TS, BH = R * TS, SEED = 7;
export const LANE_COLS = 14;
const FOE_AT = Object.freeze([7, 1]), TILE_AT = Object.freeze([6, 1]);
const tileCode = (kind) => Object.values(F).find((v) => featKindOf(v) === kind) || 0;
const SIDES = Object.freeze(["N", "E", "S", "W"]);
const REST = {time: 0}, MAKO = {face: {x: 1, y: 0}, walk: 0, iFrames: 0, kick: false, shield: false, passing: false, color: "#37f0d0"};

const hsh = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 1442695041) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const rgba = (h, a) => `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
const edge = (x, y) => x === 0 || y === 0 || x === C - 1 || y === R - 1;
const isWall = (x, y) => edge(x, y) || (x % 2 === 0 && y % 2 === 0);
const wallCode = (x, y) => (edge(x, y) ? borderCode(x, y) : [0, 0, 1, 2][Math.floor(hsh(x, y, SEED) * 4)]);
const isBrick = (x, y) => !(x + y <= 3 || x + y >= C + R - 5) && hsh(x, y, SEED + 3) < 0.42;
const ART = new Map(), artOf = (level) => { const b = biomeOf(level); let a = ART.get(b); if (!a) ART.set(b, (a = Object.freeze({biome: b}))); return a; };
function cell(c, px, py, s, art, v, x, y, level) {
  if (v === T.WALL) return wallCell(c, px, py, s, art, {code: wallCode(x, y)});
  floorCell(c, px, py, s, art, {par: (x + y) & 1, v: floorVar(x, y, level)});
  if (v === T.BRICK) brickCell(c, px, py, s, art);
}

export function roomLook(c, box, level, tok, o = {}) {
  const x = box.x || 0, y = box.y || 0, w = box.w, h = box.h, art = artOf(level), s = Math.max(w / BW, h / BH) * (o.k || 1);
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = art.biome.bg1; c.fillRect(x, y, w, h);
  c.save(); c.translate(x + (w - BW * s) / 2, y + (h - BH * s) / 2); c.scale(s, s);
  for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) cell(c, i * TS, j * TS, TS, art, isWall(i, j) ? T.WALL : isBrick(i, j) ? T.BRICK : T.EMPTY, i, j, level);
  c.restore();
  c.fillStyle = rgba(toL(tok.bg1, 0.004), o.veil ?? 0.5); c.fillRect(x, y, w, h);
  c.restore();
}

export function roomLayer(box, level, tok, o = {}) {
  const dpr = o.dpr || 1, veil = o.veil ?? 0.5, k = o.k || 1, w = box.w, h = box.h;
  const name = veil === 0.5 && k === 1 ? "room" : "room|" + veil + "|" + k;
  return layer({layer: name, biome: tok.name, level, W: w, H: h, dpr, look: o.look || "2d", textScale: o.textScale || 1}, Math.round(w * dpr), Math.round(h * dpr),
    (g) => { g.scale(dpr, dpr); roomLook(g, {x: 0, y: 0, w, h}, level, tok, {veil, k}); });
}

export const ROOM_RESERVE = 3 * 1024 * 1024;
export const roomFit = (F, dpr, held) => +Math.max(0.5, Math.min(dpr, Math.sqrt(Math.max(0, BUDGET - held) / (4 * F.W * F.H)))).toFixed(3);
let rule = null;
export const shareRoom = (fn) => { rule = fn; };
export function roomDpr(c, F, ui, dpr) {
  if (!rule) throw new Error("kit roomDpr: no shared room rule (pages/menu.js installs it)");
  return rule(c, F, ui, dpr);
}
export const pageRoomDpr = (c, F, ui, dpr, held) => Math.min(roomDpr(c, F, ui, dpr), roomFit(F, dpr, held));

export function laneGrid(level) {
  const g = new Uint8Array(C * R), b = biomeOf(level), [fx, fy] = FOE_AT, [tx, ty] = TILE_AT;
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) g[key(x, y)] = isWall(x, y) ? T.WALL : isBrick(x, y) ? T.BRICK : T.EMPTY;
  g[key(fx, fy)] = g[key(tx, ty)] = T.EMPTY;
  stampStart(g);
  return {cols: C, rows: R, grid: g, mako: {x: 1, y: 1}, foe: {x: fx, y: fy, type: heatRoster(level, 0)[0]}, tile: {x: tx, y: ty, code: tileCode(HOME[b.name])}};
}

const specOf = (t) => ({kind: featKindOf(t.code), h: 0, par: (t.x + t.y) & 1, dir: isBelt(t.code) ? t.code - 1 : isStream(t.code) ? t.code - 8 : 0,
  outer: SIDES.slice(), exit: true, entry: true, phase: 0, state: 0, lit: 0, pair: 1, gx: t.x, gy: t.y});

export function lane(c, x, y, w, rows, level, tok, o = {}) {
  const L = laneGrid(level), n = o.cols || LANE_COLS, s = w / n, h = rows * s, art = artOf(level), ox = x + 2, oy = y + 2 - 0.3 * s;
  c.save();
  c.fillStyle = tok.bed; c.fillRect(x, y, w, h);
  c.save(); c.beginPath(); c.rect(x + 2, y + 2, w - 4, h - 4); c.clip();
  const nr = Math.min(R, Math.ceil(rows + 0.3)), nc = Math.min(C, Math.ceil(n));
  for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) cell(c, ox + i * s, oy + j * s, s, art, L.grid[key(i, j)], i, j, level);
  const t = L.tile;
  if (t.code) drawSpec(c, art.biome, specOf(t), ox + t.x * s, oy + t.y * s, s);
  c.save(); c.translate(ox + (L.mako.x + 0.5) * s, oy + (L.mako.y + 0.5) * s + s * 0.02); c.scale(s / 40, s / 40);
  drawPlayerBody(c, REST, MAKO);
  c.restore();
  const f = L.foe, ft = FOES.find((q) => q.t === f.type) || FOES[0];
  c.save(); c.translate(ox + (f.x + 0.5) * s, oy + (f.y + 0.5) * s + s * 0.04); c.scale(s / 34, s / 34);
  drawEnemyBody(c, REST, {type: ft.t, color: ft.col, r: 14, home: {x: 3, y: 7}, invuln: false, dir: {x: 0, y: 1}});
  c.restore();
  c.restore();
  c.strokeStyle = CONST.ol; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, w - 2, h - 2);
  c.restore();
  return h;
}

function framed(c, x, y, s, inner) {
  c.save();
  c.fillStyle = CONST.ol; rr(c, x, y + 3, s, s, 3); c.fill(); rr(c, x, y, s, s, 3); c.fill();
  rr(c, x + 2, y + 2, s - 4, s - 4, 1); c.clip();
  inner(x + 2, y + 2, s - 4);
  c.restore();
}
export function foeCell(c, x, y, s, type, level) {
  const art = artOf(level), ft = FOES.find((q) => q.t === type) || FOES[0];
  framed(c, x, y, s, (ix, iy, is) => {
    floorCell(c, ix, iy, is, art, {par: 0, v: floorVar(1, 1, level)});
    c.translate(ix + is / 2, iy + is / 2 + is * 0.04); c.scale(is / 34, is / 34);
    drawEnemyBody(c, REST, {type: ft.t, color: ft.col, r: 14, home: {x: 3, y: 7}, invuln: false, dir: {x: 0, y: 1}});
  });
}
export function tileCell(c, x, y, s, level) {
  const art = artOf(level), code = tileCode(HOME[art.biome.name]);
  framed(c, x, y, s, (ix, iy, is) => {
    floorCell(c, ix, iy, is, art, {par: 1, v: floorVar(3, 4, level)});
    if (code) drawSpec(c, art.biome, specOf({code, x: 3, y: 4}), ix, iy, is);
  });
}
