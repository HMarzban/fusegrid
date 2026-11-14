/* KIT ROOM: the world behind the menus (R4) and the next run's start corner (R5). Menus look the same in every art style, so both are the CLASSIC board art on
   the 2D menu canvas, painted through the kit's cell painters (paint.js wallCell / floorCell / brickCell) on artOf(level): the level's REAL board art, the
   untinted biomeOf(level) (appendix 1.3: the backdrop keeps the game's real art, only the veil is tinted; the mock's lane paints the same raw biome).
   tok gives the UI colours only: the veil (tok.bg1), the lane bed (tok.bed) and the cache key (tok.name). roomLook and lane leave the context state as found.
   roomLook   (c, box, level, tok, o) fills bg1, paints the world's FLOOR checker over the whole box at PLAY scale, its grid centred as the board's
              (Task 9.6: s = min(o.play, cover) x o.k, o.play = box units per board unit in a run on this layout, fit.js shellGeo's play through the frame F;
              no o.play (#c, the board's own canvas, where play = cover = 1) keeps COVER, s = max(w/600, h/520)), then lays the veil
              rgba(toL(tok.bg1, 0.004), o.veil = 0.5) over the box last (appendix 6). Floor only, no wall or brick (owner veto 1, pick D, 2026-11-14:
              "nothing outside the plate competes with PLAY"; the room's walls and bricks read as busy), so only the cells the box shows are painted.
   roomLayer  (box, level, tok, o) the same painted once per key into a cache.js layer at o.dpr (o.look, o.textScale in the key; a veil, k or play other than
              the default joins the layer name, so a WIN veil never reuses the menu one); roomKey is that key, the one every page touches.
   laneGrid   (level) pure and DOM-free: the representative board as T codes with fair.js stampStart over it (the sealed spawn pocket, doors (5,1) and
              (1,5) BRICK), MAKO on (1,1), the room's first CORE roster foe and its floor tile (core/feat.js HOME, coded by F's first code of that kind) on FLOOR cells of row 1 past the door,
              inside the first 8 columns so a 9-column crop still shows them. Its only true facts: the pocket, the roster, the tile. A fresh grid per call.
   lane       (c, x, y, w, rows, level, tok, o) the first LANE_COLS (o.cols) columns of that grid at s = w / cols, rows x s tall, cut 0.3 cell into the
              top border: the bed, the cells, the tile (featdraw drawSpec, CORE, a lone cell), MAKO and the foe at rest at the appendix 6 scales, a 2 px
              #0b0609 frame on the box edge. Returns the height. No clock: the page animates its focused cell itself.
   foeCell    (c, x, y, s, type, level) a foe at rest on a floor cell of level's world, s px square: a 2 px #0b0609 outline, radius 3, a hard 3 px drop.
   tileCell   (c, x, y, s, level) level's floor tile (core/feat.js HOME, CORE, a lone cell) in the same frame; a world with no tile paints its floor.
   R1: the shared room rule (MENU installs it: shareRoom; roomDpr throws until then; pageRoomDpr caps it at a page's own fit) and THE
   LOADING plate (loadingPlate, its box loadBox); AGENTS.md "Lazy pages". */
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
import {wallCell, floorCell, brickCell, plate} from "./paint.js";
import {CONST, toL, worldTokens} from "./tokens.js";
import {dsp, lbl, measure, T as TY, textScale, CAP_K} from "./type.js";
import * as probe from "./probe.js";
import {canMake} from "./cache.js";
import {layer, keyOf, BUDGET} from "./cache.js";

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
const wallCode = (x, y) => (inBoard(x, y) && edge(x, y) ? borderCode(x, y) : [0, 0, 1, 2][Math.floor(hsh(x, y, SEED) * 4)]);
const isBrick = (x, y) => !(x + y <= 3 || x + y >= C + R - 5) && hsh(x, y, SEED + 3) < 0.42;
const inBoard = (x, y) => x >= 0 && y >= 0 && x < C && y < R;
const ART = new Map(), artOf = (level) => { const b = biomeOf(level); let a = ART.get(b); if (!a) ART.set(b, (a = Object.freeze({biome: b}))); return a; };
function cell(c, px, py, s, art, v, x, y, level) {
  if (v === T.WALL) return wallCell(c, px, py, s, art, {code: wallCode(x, y)});
  floorCell(c, px, py, s, art, {par: (x + y) & 1, v: floorVar(x, y, level)});
  if (v === T.BRICK) brickCell(c, px, py, s, art);
}

export function roomLook(c, box, level, tok, o = {}) {
  const x = box.x || 0, y = box.y || 0, w = box.w, h = box.h, art = artOf(level), cover = Math.max(w / BW, h / BH), s = (o.play > 0 ? Math.min(o.play, cover) : cover) * (o.k || 1);
  const ox = (w - BW * s) / 2, oy = (h - BH * s) / 2, q = TS * s, E = 1e-6;
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = art.biome.bg1; c.fillRect(x, y, w, h);
  c.save(); c.translate(x + ox, y + oy); c.scale(s, s);
  const i0 = Math.floor(-ox / q + E), i1 = Math.ceil((w - ox) / q - E), j0 = Math.floor(-oy / q + E), j1 = Math.ceil((h - oy) / q - E);
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) cell(c, i * TS, j * TS, TS, art, T.EMPTY, i, j, level);
  c.restore();
  c.fillStyle = rgba(toL(tok.bg1, 0.004), o.veil ?? 0.5); c.fillRect(x, y, w, h);
  c.restore();
}

const playOf = (o) => (o.play > 0 ? +o.play.toFixed(4) : 0);
const roomSpec = (box, level, tok, o) => {
  const veil = o.veil ?? 0.5, k = o.k || 1, p = playOf(o);
  return {layer: (veil === 0.5 && k === 1 ? "room" : "room|" + veil + "|" + k) + (p ? "@" + p : ""), biome: tok.name, level, W: box.w, H: box.h, dpr: o.dpr || 1, look: o.look || "2d", textScale: o.textScale || 1};
};
export const roomKey = (box, level, tok, o = {}) => keyOf(roomSpec(box, level, tok, o));
export function roomLayer(box, level, tok, o = {}) {
  const dpr = o.dpr || 1, veil = o.veil ?? 0.5, k = o.k || 1, w = box.w, h = box.h, play = playOf(o);
  return layer(roomSpec(box, level, tok, o), Math.round(w * dpr), Math.round(h * dpr),
    (g) => { g.scale(dpr, dpr); roomLook(g, {x: 0, y: 0, w, h}, level, tok, {veil, k, play}); });
}

export const ROOM_RESERVE = 3 * 1024 * 1024;
export const roomFit = (F, dpr, held) => +Math.max(0.5, Math.min(dpr, Math.sqrt(Math.max(0, BUDGET - held) / (4 * F.W * F.H)))).toFixed(3);
let rule = null;
export const shareRoom = (fn) => { rule = fn; };
/* every page's room ask comes here, guarded once: with no canvas source (Node) there is no room layer to size */
export function roomDpr(c, F, ui, dpr) {
  if (!rule) throw new Error("kit roomDpr: no shared room rule (pages/menu.js installs it)");
  return canMake() ? rule(c, F, ui, dpr) : 1;
}
export const pageRoomDpr = (c, F, ui, dpr, held) => (canMake() ? Math.min(roomDpr(c, F, ui, dpr), roomFit(F, dpr, held)) : 1);

/* the plate is 360 x 128 design px; on a touch board canvas (#c, no shell box: a landscape phone, a PAUSE view) a design px is a CSS px where it fits
   and never under LOAD_FLOOR CSS px (its 16 px line at the phone's 9 px secondary cap), the plate narrowing to the box there and the title fitting it */
const LOAD_W = 360, LOAD_H = 128, LOAD_FLOOR = 0.8, LOAD_TTL = 34, LOAD_LINE = 16;
export function loadBox(F) {
  const fit = Math.min((F.W - 52) / LOAD_W, (F.H - 52) / LOAD_H), css = F.touch && !F.shell && F.css > 0 ? F.css : 0;
  const m = css ? 12 / css : 12, k = css ? Math.max(Math.min(1 / css, fit), Math.min(LOAD_FLOOR / css, (F.H - 2 * m) / LOAD_H)) : Math.min(1, fit), lw = Math.min(LOAD_W, (F.W - 2 * m) / k), w = lw * k, h = LOAD_H * k; // m: the phone's 10 px ring and 2 clear
  return {x: (F.W - w) / 2, y: (F.H - h) / 2, w, h, k, lw};
}
export function loadingPlate(c, F, o) {
  const level = o.level | 0 || 1, tok = worldTokens(level), B = loadBox(F), lw = B.lw;
  if (!(F.W > 0 && F.H > 0) || typeof c.clip !== "function") return;
  if (!o.paused) {
    if (canMake()) c.drawImage(roomLayer({w: F.W, h: F.H}, level, tok, {dpr: roomDpr(c, F, {rev: o.rev}, o.dpr), look: "2d", textScale: 1, play: F.play}), 0, 0, F.W, F.H);
    else { c.fillStyle = toL(tok.bg1, 0.004); c.fillRect(0, 0, F.W, F.H); }
  }
  const tw = measure(c, TY.display(LOAD_TTL), String(o.title)), tp = tw > lw - 32 ? LOAD_TTL * (lw - 32) / tw : LOAD_TTL;
  c.save(); c.translate(B.x, B.y); c.scale(B.k, B.k);
  plate(c, 0, 0, lw, LOAD_H, tok);
  dsp(c, o.title, lw / 2, 50, tp, {align: "center"});
  lbl(c, o.line, lw / 2, 96, LOAD_LINE, {align: "center", col: CONST.t2});
  c.restore();
  if (probe.probe.on) {
    const k = B.k, ts = textScale(), lnw = measure(c, TY.label(LOAD_LINE), String(o.line));
    probe.begin("loading", {w: F.W, h: F.H, dpr: o.dpr || 1, el: F.shell ? "sh" : "c"});
    probe.rect("plate", B.x, B.y, B.w, B.h, {plate: true});
    probe.text(String(o.title), B.x + (lw - Math.min(tw, lw - 32)) / 2 * k, B.y + (50 - tp * ts * CAP_K / 2) * k, Math.min(tw, lw - 32) * k, tp * ts * CAP_K * k, {role: "primary", col: CONST.ink, px: tp * k});
    probe.text(String(o.line), B.x + (lw - lnw) / 2 * k, B.y + (96 - LOAD_LINE * ts * CAP_K / 2) * k, lnw * k, LOAD_LINE * ts * CAP_K * k, {role: "secondary", col: CONST.t2, px: LOAD_LINE * k});
  }
}

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
