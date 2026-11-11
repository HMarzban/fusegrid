/* LEVEL SELECT PAGE (UI upgrade v202 Task 3.3; design record §4 "LEVEL SELECT: one path"; appendix 7.2 levelKeys, 7.3; the round 7 S7-menu d-03 / p-03
   frames). The room the next run starts in (the selected level's world) dresses the stage, opaque like MENU: its room look over the whole canvas, its
   rampart round the plate, and its tokens on every part, so the page changes world as LEVEL changes. One path, top to bottom: the rows LEVEL (8 level
   keys in one course, the chosen one a lit brick, the rest floor wells, a finale flag on 5 and 8, 6-8 wall keys with a lock until the first CLEAR),
   DIFFICULTY and GAME SPEED (banks: chosen lit, the rest wells), MODIFIERS (one door row, once modifiers are offered; its list opens inline), then the
   one next-run card (pages/card.js, with BEST) and the START hero (the one yellow part).
   levelGeom(F, o) is the one geometry for draw and tap: rects by NAME in box units (G.d: the same in design px, the mock's CSS px; u box units per design
   px). F = {W, H, touch, shell, css, ts} as menu.js; o = {unlocked (rooms 6-8 and MODIFIERS open), open (the MODIFIERS list is open), row (the
   focused row's name: a paged compact's page)}. Fields: plate (S,
   with mid), rows (the focus band per LEVEL_ROWS name; MODIFIERS null until offered), room[8] (the level keys), heat[3], pace[3], mods (the door), mode[5]
   (the open list's entries, [] when shut), start, pane (the card's slot; null in compact), back (the BACK key; phone and compact), list (the list's region,
   reserved whether open or not, so opening it moves nothing), help (desk), foot (desk). Three arrangements, as MENU's: desk (every keyboard box, the 1366
   x 768 frame at u 1: list column 640 beside the card's column, centred; a narrower or shorter window gives way first (see desk()), then the page scales
   as one piece; a touch box floors every target at 44 CSS px and stays the desk while u x css holds TOUCH_U), phone (a touch-portrait shell box: the
   393 x 852 column in CSS px, labels over their controls, the card's slot the height left, a reserved cue line, the open list in the card's place) and
   compact (any other touch box: the phone's grammar across the box in CSS px, no card; it never scales: groups that do not fit PAGE, whole groups a
   page, with page keys beside START; the open list covers the head and the groups).
   levelHit(x, y, F, o): {k: "room"|"lock", i} a level key (6-8 locked: lock, never a selection), {k: "heat"|"pace", i}, {k: "mods"} the door, {k: "mode",
   i} an open list's entry, {k: "page", i: -1|1, row} a page key (the first row of that page; a key at the end is none), {k: "start"}, {k: "back"} off the plate or the BACK key, {k: "none"} on the plate off every target (inert). A key owns half
   of each gap beside it, out to its row's band.
   drawLevelPage(c, F, ui, t): ui = {level, heat, pace, pact, time, unlocked, best (a formatted time or null), row (the focused row's name), open, cur
   (the list's cursor), trig (a controller's TRIGGER cursor with the list shut, -1 none), tap (tap mode: no focus model, START focused as the page's one
   action), lockR, lockT (the locked level a refusal named and when), reduced, enterT}. Cached (kit cache.js, recency touched on a steady frame; see sizes()):
   the room with the plate at the room's dpr, the rampart's strips, the head, the rows at rest, START at rest, the card, the LEVEL row's focus, the list
   and the desk feet, all made at once so a focus move never misses, keyed by what they show. Live: the other rows', START's and a list entry's focus,
   the door's teaser, the help line, START's tag and keycap, the lock tip. The room's dpr gives way so the rest and a 1 MiB reserve fit the budget. A context that cannot measure plans on a
   0.6 em estimate; with no canvas source (Node) everything paints straight onto the target over one flat fill; a context with no clip or rect gets the
   plan only. Under the probe it records its rects, texts and pairs outside any layer paint. */
import {isFinale, roomCap} from "../../core/config.js";
import {LABEL, DIFF, SPEED, MOD, MOD_BITS, TIME_TRIAL, DEFAULT_RULES, modWords, tagFor, runParts, LEVEL_WORDS as LW} from "../words.js";
import {worldTokens, CONST, toL} from "../kit/tokens.js";
import {key, cap, capW, plate, band, focusBomb, glyph} from "../kit/paint.js";
import {T, DEV, measure, textScale} from "../kit/type.js";
import {layer, capDpr, touch, keyOf, canMake} from "../kit/cache.js";
import {roomLayer} from "../kit/room.js";
import {roomDpr} from "./menu.js";
import * as probe from "../kit/probe.js";
import {deviceScale} from "../logo/draw2d.js";
import {hints, tapMode} from "../hintcopy.js";
import {deep, cardPlan, paintCard, recordCard} from "./card.js";

/* the rows by name: menuapp LEVEL_ROWS, pinned equal to these words in tests/words.test.mjs (src/render may not import src/app) */
export const LV = Object.freeze({LEVEL: LABEL.LEVEL, DIFF: LABEL.DIFFICULTY, SPEED: LABEL.GAME_SPEED, MODS: LABEL.MODIFIERS, START: LABEL.START});
const ORDER = [LV.LEVEL, LV.DIFF, LV.SPEED, LV.MODS, LV.START];
/* desk in design px (the mock's CSS px at 1366 x 768): plate w and pad [t r b l], the head (kicker, gap, title), the list column and the gap to the
   card's column, a row and the gap between rows, the label inset, the value inset, level keys (w h gap), the bank cell (w h), the list key, the START
   hero, the gap over it, the card's least slot height (cardPlan never over at 8 levels x 3 heats x pact 0 / 15 x BEST, tests/page-level), the gap
   to the foot. A narrower window scales the page as one piece (the card's column never narrows: CROWN's two foe rows need its width). */
export const DESK = deep({
  d: {w: 1110, pad: [16, 22, 20, 22], kick: 18, kgap: 6, title: 45, below: 12, left: 640, col: 22, row: 64, rgap: 10, labx: 50, rpad: 12, kw: 48, kh: 44, kg: 6, bkw: 112, bkh: 36, lh: 36, hero: 74, cgap: 16, card: 360, cardTall: 380, cardMin: 360, colMin: 14, padMin: 14, leftMin: 572, foot: 30},
  d125: {w: 1220, pad: [12, 22, 14, 22], kick: 0, kgap: 0, title: 53, below: 12, left: 700, col: 22, row: 58, rgap: 10, labx: 50, rpad: 12, kw: 50, kh: 44, kg: 6, bkw: 140, bkh: 44, lh: 36, hero: 84, cgap: 16, card: 400, cardTall: 425, cardMin: 380, colMin: 14, padMin: 14, leftMin: 680, foot: 20},
});
/* phone (CSS px, the p-03 frame): the plate's top / bottom / side margins, its pad, the BACK key, the gaps, the label line's top margin and the gap
   under it, level keys (h, gap; 4 x 2), a bank, the door, the gap over the card, START */
export const PHONE = deep({
  p: {top: 20, bot: 20, side: 12, pad: 12, back: [117, 44], hgap: 10, lab0: 6, lgap: 8, kh: 46, kg: 10, bank: 50, door: 52, cgap: 14, sgap: 8, hero: 66, max: 600, lh: 44, lg: 8, cue: 20},
  p125: {top: 20, bot: 20, side: 12, pad: 12, back: [117, 44], hgap: 10, lab0: 6, lgap: 8, kh: 46, kg: 10, bank: 50, door: 52, cgap: 14, sgap: 8, hero: 66, max: 600, lh: 44, lg: 8, cue: 20},
});
/* compact (CSS px): every target at the 44 px floor, the least gaps that keep them 8 apart across sets; under these the page scales as one piece */
export const COMPACT = deep({side: 12, padX: 8, top: 12, bot: 13, pad: 8, back: [104, 44], cue: 22, g: 6, lg: 4, kh: 44, kgMax: 6, bank: 50, door: 44, dgap: 8, wmax: 600, lh: 44, lgap: 8});
export const TOUCH = Object.freeze({h: 44, g: 8}), TOUCH_U = 0.8, FOOT_H = 54, GUT = 8;
const big = (ts) => ts > 1.1;
const R = (x, y, w, h) => ({x, y, w, h});
const sc = (r, u) => (r ? {x: r.x * u, y: r.y * u, w: r.w * u, h: r.h * u} : null);
const okBox = (F) => !!F && F.W > 0 && F.H > 0 && Number.isFinite(F.W) && Number.isFinite(F.H);
const labH = (dv, ts) => dv.sec * ts * 1.2;

/* the five list entries in Digit1-5 order: the four modifier bits, then TIME TRIAL */
export const ENTRIES = Object.freeze([...MOD_BITS.map((b) => MOD[b]), TIME_TRIAL]);
/* list entries in cols columns (row-major, the ↑↓ order) inside region q, each lh tall, gap g; two columns split 44 / 56, so the right one holds NO
   FLOOR ITEMS on its two lines in the least box at 125 % (the left holds ONE LIFE, FEWER ITEMS, TIME TRIAL, each broken once at most) */
function listIn(q, cols, lh, g) {
  const ws = cols === 1 ? [q.w] : [(q.w - g) * 0.44, (q.w - g) * 0.56];
  return ENTRIES.map((_, i) => R(q.x + (i % cols ? ws[0] + g : 0), q.y + Math.floor(i / cols) * (lh + g), ws[i % cols], lh));
}
/* a course of 8 keys right-aligned at xr, centred on cy */
const course = (xr, cy, kw, kh, kg) => Array.from({length: 8}, (_, i) => R(xr - (8 - i) * kw - (7 - i) * kg, cy - kh / 2, kw, kh));
/* a bank of three cells inside frame b (3 px pad, 4 px gaps) */
const cellsIn = (b) => { const w = (b.w - 6 - 8) / 3; return [0, 1, 2].map((i) => R(b.x + 3 + i * (w + 4), b.y + 3, w, b.h - 6)); };

/* desk. What gives way before the page scales (lane lessons 2026-11-11: the desk text floors bind ordinary windows): in width the card's column
   (down to cardMin, its slot then cardTall: CROWN's foes take two rows), then the gap between the columns (down to colMin), the plate's side pads (down to padMin), then the list column (down to leftMin: GAME SPEED and its bank whole); in
   height the gap over the foot (down to 12), then the MENU kicker. Only then does the page scale as one piece. */
function desk(F, U, t125, fl) {
  const D = DESK[t125 ? "d125" : "d"], dv = DEV.d, ts = t125 ? 1.25 : 1, T0 = dv.T;
  const n = U ? 4 : 3, side = 2 * (T0 + 2 + 6), cardCol = D.w - D.pad[1] - D.pad[3] - D.left - D.col, padGive = D.pad[1] + D.pad[3] - 2 * D.padMin, minW = side + D.w - (cardCol - D.cardMin) - (D.col - D.colMin) - padGive - (D.left - D.leftMin);
  const hlp = dv.bod * ts * 1.4, TM = T0 + 2 + 4;
  const at = (u, give) => {
    const f = fl ? fl.h / u : 0, kh = Math.max(D.kh, f), kw = Math.max(D.kw, f), bkh = Math.max(D.bkh, f), lh = Math.max(D.lh, f), row = Math.max(D.row, kh + 12, bkh + 12);
    const Wd = F.W / u, pw = Math.min(D.w, Wd - side), short = D.w - pw, s2 = Math.max(0, short - (cardCol - D.cardMin)), col = Math.max(D.colMin, D.col - s2), s3 = Math.max(0, s2 - (D.col - D.colMin)), pad = Math.max(D.padMin, D.pad[3] - s3 / 2), left = Math.max(D.leftMin, D.left - Math.max(0, s3 - padGive)), cw = pw - 2 * pad - left - col;
    const card = cw < cardCol - 1e-9 ? D.cardTall : D.card, kick = give < 2 && D.kick, head = kick ? D.kick + D.kgap + D.title : D.title, foot = give ? 12 : D.foot;
    const rows = n * row + (n - 1) * D.rgap, listH = 3 * lh + 16, colH = Math.max(card + D.cgap + D.hero, rows + (U ? 12 + listH : 0) + 8 + hlp + 8);
    const plateH = D.pad[0] + head + D.below + colH + D.pad[2];
    return {kh, kw, bkh, lh, row, rows, listH, colH, plateH, pw, left, col, pad, kick, head, foot, total: plateH + foot + FOOT_H};
  };
  const fits = (v, g) => v * minW <= F.W + 1e-9 && v * (at(v, g).total + TM + 8) <= F.H + 1e-9;
  let give = 0;
  while (give < 2 && !fits(Math.min(1, F.W / minW), give)) give++;
  let u = Math.min(1, F.W / minW);
  if (!fits(u, give)) { let lo = 0, hi = u; for (let i = 0; i < 48; i++) { const m = (lo + hi) / 2; if (fits(m, give)) lo = m; else hi = m; } u = lo; }
  const S = at(u, give), Wd = F.W / u, Hd = F.H / u, pw = S.pw, px = (Wd - pw) / 2, py = Math.max(TM, (Hd - S.total) / 2), left = S.left;
  const ix = px + S.pad, hy = py + D.pad[0], top = hy + S.head + D.below, cx = ix + left + S.col, cw = px + pw - S.pad - cx;
  const rows = {}, names = [LV.LEVEL, LV.DIFF, LV.SPEED, ...(U ? [LV.MODS] : [])];
  names.forEach((l, i) => { rows[l] = R(ix, top + i * (S.row + D.rgap), left, S.row); });
  const xr = ix + left - D.rpad, cy = (l) => rows[l].y + rows[l].h / 2;
  const room = course(xr, cy(LV.LEVEL), S.kw, S.kh, D.kg);
  const bk = (l) => { const w = 3 * D.bkw + 8 + 6, h = S.bkh + 6; return R(xr - w, cy(l) - h / 2, w, h); };
  const heatB = bk(LV.DIFF), paceB = bk(LV.SPEED), last = rows[names[names.length - 1]];
  const listR = U ? R(ix + D.labx, last.y + last.h + 12, left - D.labx - D.rpad, S.listH) : null;
  /* the help line: up to two lines while the list is shut (the list's reserved region is free), one under the open list */
  const help = R(ix + D.labx, last.y + last.h + 8, left - D.labx - D.rpad, U ? Math.min(2 * hlp, 12 + S.listH) : top + S.colH - (last.y + last.h + 8));
  const cardH = S.colH - D.cgap - D.hero, start = R(cx, top + cardH + D.cgap, cw, D.hero);
  rows[LV.START] = start;
  return {mode: "desk", dev: "d", u, t125, give, T: T0, plate: R(px, py, pw, S.plateH), head: R(ix, hy, pw - 2 * S.pad, S.head), kick: S.kick, title: R(ix, hy + (S.kick ? D.kick + D.kgap : 0), pw, D.title),
    rows, room, heatB, paceB, heat: cellsIn(heatB), pace: cellsIn(paceB), mods: U ? rows[LV.MODS] : null, listR, lh: S.lh, cols: 2, start, pane: R(cx, top, cw, cardH), back: null,
    help, helpAfter: U ? R(help.x, listR.y + listR.h + 8, help.w, hlp) : help, hl: hlp / 1.4, foot: R(px, py + S.plateH + S.foot, pw, FOOT_H), labx: D.labx, labels: "left"};
}
function phone(F, U, t125) {
  const P = PHONE[t125 ? "p125" : "p"], dv = DEV.p, ts = t125 ? 1.25 : 1, css = F.css > 0 ? F.css : 1, lab = labH(dv, ts), L = P.lab0 + lab + P.lgap;
  const fixed = P.top + P.pad + P.back[1] + P.hgap + L + 2 * P.kh + P.kg + P.sgap + 2 * (L + P.bank + P.sgap) + (U ? P.door + P.cgap : P.cgap - P.sgap) + P.sgap + P.cue + P.sgap + P.hero + P.pad + P.bot;
  const need = fixed + 234, u = Math.min(1 / css, F.H / need), Wd = F.W / u, Hd = F.H / u;
  const pw = Math.min(Wd - 2 * P.side, P.max), px = (Wd - pw) / 2, py = P.top, ph = Hd - P.top - P.bot, ix = px + P.pad, iw = pw - 2 * P.pad;
  const back = R(ix, py + P.pad, P.back[0], P.back[1]);
  let y = back.y + back.h + P.hgap;
  const labs = {}, rows = {};
  const labAt = (l) => { labs[l] = R(ix, y + P.lab0, iw, lab); y += L; };
  labAt(LV.LEVEL);
  const kw = (iw - 3 * P.kg) / 4, room = Array.from({length: 8}, (_, i) => R(ix + (i % 4) * (kw + P.kg), y + (i >> 2) * (P.kh + P.kg), kw, P.kh));
  y += 2 * P.kh + P.kg;
  rows[LV.LEVEL] = R(ix - 6, labs[LV.LEVEL].y - 4, iw + 12, y + 4 - (labs[LV.LEVEL].y - 4)); y += P.sgap;
  const bank = (l) => { labAt(l); const b = R(ix, y, iw, P.bank); rows[l] = R(ix - 6, labs[l].y - 4, iw + 12, y + P.bank + 4 - (labs[l].y - 4)); y += P.bank + P.sgap; return b; };
  const heatB = bank(LV.DIFF), paceB = bank(LV.SPEED);
  let mods = null;
  if (U) { mods = R(ix, y, iw, P.door); rows[LV.MODS] = mods; y += P.door + P.cgap; } else y += P.cgap - P.sgap;
  /* the controller's cue line sits between the card and START (reserved on every device, so the card's slot never moves with the hints) */
  const start = R(ix, py + ph - P.pad - P.hero, iw, P.hero), cue = R(ix, start.y - P.sgap - P.cue, iw, P.cue), pane = R(ix, y, iw, cue.y - P.sgap - y);
  rows[LV.START] = start;
  const cols = pane.h >= 5 * P.lh + 4 * P.lg ? 1 : 2, listR = U ? R(ix, pane.y, iw, cols === 1 ? 5 * P.lh + 4 * P.lg : 3 * P.lh + 2 * P.lg) : null;
  return {mode: "phone", dev: "p", u, t125, T: dv.T, plate: R(px, py, pw, ph), head: R(ix, back.y, iw, back.h), kick: 0, title: R(back.x + back.w + 14, back.y, iw - back.w - 14, back.h),
    rows, labs, room, heatB, paceB, heat: cellsIn(heatB), pace: cellsIn(paceB), mods, listR, lh: P.lh, cols, start, pane, back, help: null, helpAfter: null, foot: null, labels: "over", cue};
}
/* compact (CSS px, u = 1 / css): the head (BACK, the title), the groups LEVEL (its 8 keys in one line where they fit at 44, else 4 x 2),
   DIFFICULTY and GAME SPEED (each its label over its bank), then MODIFIERS | START, and the controller's cue line. Where the groups do not fit the
   height left they PAGE (lane lessons 2026-11-11: never under the touch floor): whole groups a page, MODIFIERS a group of its own there, the page the
   one holding the focused row (START: the last), so keys and a controller carry it; the bottom row then holds the page keys (each the first row of
   the page before or after; a key at the end is inert) and START. The open list covers the head and the groups. */
function compact(F, U, t125, row, open) {
  const C = COMPACT, dv = DEV.p, ts = t125 ? 1.25 : 1, css = F.css > 0 ? F.css : 1, lab = labH(dv, ts), L = lab + C.lg;
  const u = 1 / css, Wd = F.W / u, Hd = F.H / u, pw = Math.min(Wd - 2 * C.side, C.wmax), px = (Wd - pw) / 2, ix = px + C.padX, iw = pw - 2 * C.padX;
  const line = iw >= 8 * C.kh + 7 * 2, kRows = line ? 1 : 2, gH = {[LV.LEVEL]: L + kRows * C.kh + (kRows - 1) * C.lgap, [LV.DIFF]: L + C.bank, [LV.SPEED]: L + C.bank, [LV.MODS]: C.door};
  const fixed = C.top + C.pad + C.back[1] + C.g + C.dgap + C.door + C.cue + C.pad + C.bot, area = Hd - fixed;
  const pack = (names) => { const out = []; for (const l of names) { const pg = out[out.length - 1], h = pg ? pg.h + C.g + gH[l] : gH[l]; if (pg && h <= area + 1e-9) { pg.rows.push(l); pg.h = h; } else out.push({rows: [l], h: gH[l]}); } return out; };
  let pages = pack([LV.LEVEL, LV.DIFF, LV.SPEED]);
  const multi = pages.length > 1;
  if (multi && U) pages = pack([LV.LEVEL, LV.DIFF, LV.SPEED, LV.MODS]);
  const pIx = row === LV.START ? pages.length - 1 : Math.max(0, pages.findIndex((q) => q.rows.includes(row))), page = pages[pIx];
  const regionH = Math.max(...pages.map((q) => q.h)), ph = C.pad + C.back[1] + C.g + regionH + C.dgap + C.door + C.cue + C.pad, py = C.top + Math.max(0, Hd - C.top - C.bot - ph) / 2;
  const back = R(ix, py + C.pad, C.back[0], C.back[1]), regionY = back.y + back.h + C.g;
  let y = regionY, mods = null;
  const labs = {}, rows = {};
  let room = [], heatB = null, paceB = null;
  for (const l of page.rows) {
    if (l === LV.MODS) { if (!open) { mods = R(ix, y, iw, C.door); rows[l] = mods; } y += C.door + C.g; continue; } // the open list covers this page's door: a tap off the plate closes it
    labs[l] = R(ix, y, iw, lab); y += L;
    if (l === LV.LEVEL) {
      const per = line ? 8 : 4, kg = line ? Math.max(2, Math.min(C.kgMax, (iw - 8 * C.kh) / 7)) : 6, kw = (iw - (per - 1) * kg) / per;
      room = Array.from({length: 8}, (_, i) => R(ix + (i % per) * (kw + kg), y + Math.floor(i / per) * (C.kh + C.lgap), kw, C.kh));
      y += kRows * C.kh + (kRows - 1) * C.lgap;
    } else { const b = R(ix, y, iw, C.bank); if (l === LV.DIFF) heatB = b; else paceB = b; y += C.bank; }
    rows[l] = R(ix - 4, labs[l].y - 3, iw + 8, y + 3 - (labs[l].y - 3));
    y += C.g;
  }
  y = regionY + regionH + C.dgap;
  let start, pk = null;
  if (multi) { pk = [R(ix, y, C.kh, C.door), R(ix + C.kh + 8, y, C.kh, C.door)]; start = R(ix + 2 * C.kh + 16, y, iw - 2 * C.kh - 16, C.door); }
  else { const half = (iw - 10) / 2; if (U) { mods = R(ix, y, half, C.door); rows[LV.MODS] = mods; } start = U ? R(ix + half + 10, y, half, C.door) : R(ix, y, iw, C.door); }
  rows[LV.START] = start;
  /* the open list covers the head and the groups (over a bed fill), so its five keys hold 44 px in the least box; BACK and the page keys go under it */
  const listR = U ? R(ix, back.y, iw, regionY + regionH - back.y) : null, lh = U ? Math.min(C.lh * 1.25, (listR.h - 2 * C.lgap) / 3) : C.lh;
  return {mode: "compact", dev: "p", u, t125, T: dv.T, plate: R(px, py, pw, ph), head: R(ix, back.y, iw, back.h), kick: 0, title: R(back.x + back.w + 12, back.y, ix + iw - (back.x + back.w + 12), back.h),
    rows, labs, room, heatB, paceB, heat: heatB ? cellsIn(heatB) : [], pace: paceB ? cellsIn(paceB) : [], mods, listR, lh, cols: 2, start, pane: null, back: open ? null : back, help: null, helpAfter: null, foot: null, labels: "over",
    pages: pages.map((q) => q.rows), page: pIx, pageKeys: pk, cover: true, cue: R(ix, start.y + start.h + 4, iw, C.cue - 4)};
}

const gm = new Map();
/** The one geometry for LEVEL SELECT's draw and tap; see the header. */
export function levelGeom(F, o = {}) {
  const ts = F.ts > 0 ? F.ts : textScale(), t125 = big(ts), touchy = !!F.touch, shell = !!F.shell, css = F.css > 0 ? F.css : 1, U = !!o.unlocked, open = !!o.open && U, row = o.row || LV.LEVEL;
  const isPhone = shell && touchy && F.H > F.W * 1.3;
  const mk = [F.W, F.H, touchy, shell, t125, css, U, open, row].join("|"), hit = gm.get(mk); // a few held (a paged compact plans every page at once)
  if (hit) return hit;
  let d = isPhone ? phone(F, U, t125) : desk(F, U, t125, touchy ? {h: TOUCH.h / css} : null);
  if (touchy && !isPhone && !(d.u * css >= TOUCH_U)) d = compact(F, U, t125, row, open);
  d.mode5 = open ? listIn(d.listR, d.cols, d.lh, d.mode === "desk" ? 8 : d.mode === "phone" ? PHONE.p.lg : COMPACT.lgap) : [];
  const u = d.u, S = sc(d.plate, u);
  S.mid = S.x + S.w / 2;
  if (d.foot) S.footY = (d.foot.y + d.foot.h / 2) * u;
  const rows = {};
  for (const l of ORDER) rows[l] = d.rows[l] ? sc(d.rows[l], u) : null;
  const G = {lay: d.mode, dev: d.dev, u, t125, W: F.W, H: F.H, d, T: d.T * u, U, open, S, plate: S, rows: Object.freeze(rows),
    room: d.room.map((r) => sc(r, u)), heat: d.heat.map((r) => sc(r, u)), pace: d.pace.map((r) => sc(r, u)), mods: sc(d.mods, u), mode: d.mode5.map((r) => sc(r, u)),
    start: sc(d.start, u), pane: sc(d.pane, u), back: sc(d.back, u), list: sc(d.listR, u), help: sc(d.help, u), foot: sc(d.foot, u), cap: roomCap(U),
    pages: d.pages ? d.pages.length : 1, page: d.page | 0, pageKeys: d.pageKeys ? d.pageKeys.map((r) => sc(r, u)) : null};
  if (gm.size >= 24) gm.clear();
  gm.set(mk, deep(G));
  return gm.get(mk);
}
const inR = (r, x, y, ex = 0, ey = ex) => !!r && x >= r.x - ex && x < r.x + r.w + ex && y >= r.y - ey && y < r.y + r.h + ey;
/** A tap on LEVEL SELECT: see the header for what it returns. */
export function levelHit(x, y, F, o = {}) {
  if (!okBox(F)) return {k: "none"};
  const G = levelGeom(F, o), d = G.d, u = G.u, over = G.mode.length > 0 && d.mode === "compact";
  if (G.mode.length) for (let i = 0; i < G.mode.length; i++) if (inR(G.mode[i], x, y, 4 * u)) return {k: "mode", i};
  /* the page keys: the first row of the page before or after (a key at its end is inert) */
  if (G.pageKeys) for (const [i, dir] of [[0, -1], [1, 1]]) if (inR(G.pageKeys[i], x, y, 3 * u)) { const p = G.page + dir; return p >= 0 && p < G.pages ? {k: "page", i: dir, row: d.pages[p][0]} : {k: "none"}; }
  const band = G.rows[LV.LEVEL];
  if (!over && band) {
    const kg = (d.room[1].x - d.room[0].x - d.room[0].w) * u, two = d.room[4].y > d.room[0].y;
    for (let i = 0; i < 8; i++) {
      const r = G.room[i], ey = two ? (d.room[4].y - d.room[0].y - d.room[0].h) * u / 2 : Math.max(0, band.y + band.h - (r.y + r.h));
      if (inR(r, x, y, kg / 2, ey)) return i < G.cap ? {k: "room", i} : {k: "lock", i};
    }
  }
  if (!over) for (const k of ["heat", "pace"]) for (let i = 0; i < G[k].length; i++) if (inR(G[k][i], x, y, 2 * u, 3 * u)) return {k, i};
  if (G.mods && inR(G.mods, x, y, 0, (d.mode === "desk" ? 5 : 4) * u)) return {k: "mods"};
  if (inR(G.start, x, y, 3 * u)) return {k: "start"};
  if (G.back && inR(G.back, x, y, 3 * u)) return {k: "back"};
  const S = G.S, T0 = G.T;
  return x >= S.x - T0 && x <= S.x + S.w + T0 && y >= S.y - T0 && y <= S.y + S.h + T0 ? {k: "none"} : {k: "back"};
}

/* ---- words ---- */
const EST = {font: "", measureText(s) { const m = /(\d+(?:\.\d+)?)px/.exec(this.font); return {width: String(s).length * 0.6 * (m ? +m[1] : 10)}; }};
const mOK = new WeakMap(), mOf = (c) => {
  if (!c || (typeof c !== "object" && typeof c !== "function")) return EST;
  let v = mOK.get(c);
  if (v === undefined) { const m = typeof c.measureText === "function" ? c.measureText("M") : null; mOK.set(c, (v = !!m && typeof m.width === "number")); }
  return v ? c : EST;
};
const W = (c, f, s) => measure(c, f, s);
/* the first candidate that fits room; two: one break, at a " · " first, else at a space, into two lines that each fit */
function fitLines(c, f, cands, room, two) {
  for (const s of cands) {
    if (!s) continue;
    if (W(c, f, s) <= room) return [s];
    if (!two) continue;
    const cuts = [];
    for (let i = s.indexOf(" · "); i > 0; i = s.indexOf(" · ", i + 1)) cuts.push([s.slice(0, i), s.slice(i + 3)]);
    if (!cuts.length) for (let i = s.indexOf(" "); i > 0; i = s.indexOf(" ", i + 1)) cuts.push([s.slice(0, i), s.slice(i + 1)]);
    let best = null;
    for (const [a, b] of cuts) { const w = Math.max(W(c, f, a), W(c, f, b)); if (w <= room && (!best || w < best.w)) best = {w, l: [a, b]}; }
    if (best) return best.l;
  }
  return [];
}
const onNames = (ui) => [...modWords(ui.pact), ...(ui.time ? [TIME_TRIAL] : [])];
export const entryOn = (ui, i) => (i < 4 ? ((ui.pact | 0) & MOD_BITS[i]) !== 0 : !!ui.time);
/** The MODIFIERS door's teaser, longest first, the first that fits by measure: the names that are on, then their count; NONE with none; a controller's
    TRIGGER cursor (list shut) names its entry. */
export function doorTeasers(ui) {
  if (ui.trig >= 0 && !ui.open) return [ENTRIES[ui.trig] + " · " + (entryOn(ui, ui.trig) ? LW.ON : LW.OFF)];
  const on = onNames(ui);
  return !on.length ? [LW.NONE] : [on.join(" · "), on.length + " " + LW.ON];
}
/** START's tag, longest first: what differs from a default run, each setting named (tagFor), then the modifiers as a count, then EXPERT bare; DEFAULT RULES for a default run. */
export function startTags(ui) {
  const run = {heat: ui.heat, pace: ui.pace, pact: ui.pact, time: ui.time}, t = tagFor(run);
  if (!t) return [DEFAULT_RULES];
  return [...new Set([t, runParts(run, {count: true}).join(" · "), runParts(run, {count: true, terse: true}).join(" · ")])];
}
/** The desk's help line: the focused list entry (or a controller's TRIGGER cursor); a controller with modifiers offered, how TRIGGER and NORTH work; else the level's sentence. */
export const helpOf = (ui) => (ui.open && ui.cur >= 0 ? LW.MOD_HELP[ui.cur] : ui.trig >= 0 ? LW.MOD_HELP[ui.trig] : ui.pad && ui.unlocked && !ui.open ? LW.PAD_HELP : LW.help(ui.level | 0 || 1, !!ui.unlocked));
/** LEVEL SELECT's foot follows the focus, label first and keycap last: ↑↓ ROW, ←→ CHANGE on LEVEL / DIFFICULTY / GAME SPEED, confirm STARTs (OPENs on
    MODIFIERS), back BACK; in the open list ↑↓ PICK, confirm TOGGLEs, back CLOSEs. Keys and controller words. */
export function footItems(row, open, words) {
  const w = words || hints(), pad = w.dev === "pad", ud = pad ? [w.move] : [["up"], ["dn"]], lr = pad ? [w.move] : [["lf"], ["rt"]];
  if (open) return [[LW.PICK, ud], [LW.TOGGLE, [w.ok]], [LABEL.CLOSE, [w.back]]];
  const value = row !== LV.MODS && row !== LV.START;
  return [[LW.ROW, ud], ...(value ? [[LW.CHANGE, lr]] : []), [row === LV.MODS ? LW.OPEN : LV.START, [w.ok]], [LW.BACK, [w.back]]];
}
const ARROW = {up: "↑", dn: "↓", lf: "←", rt: "→"};
export const footText = (items) => items.map(([t, caps]) => t + " " + caps.map((q) => (Array.isArray(q) ? ARROW[q[0]] : q)).join("")).join(" · ");
/* touch swaps the key foot for the tap rule levelHit implements */
export const LEVEL_TAP = LW.TAP, LEVEL_TAP_LIST = LW.TAP_LIST;

/* ---- plan: every text measured, every part placed (design px) ---- */
function plan(c0, G, ui, words, showCap) {
  const c = mOf(c0), d = G.d, dv = DEV[d.dev], ts = textScale(), ph = d.dev === "p", P = {texts: {}, keys: [], rows: {}, list: [], card: null, foot: {}, verbs: []};
  const fL = T.label(dv.pri), fS = T.label(dv.sec), fN = T.num(dv.pri);
  P.title = {s: LABEL.LEVEL_SELECT, f: T.display(ph ? 28 : dv.ttl), px: ph ? 28 : dv.ttl, x: d.title.x, y: d.title.y + (ph ? d.title.h / 2 : d.title.h / 2 + 2), w: W(c, T.display(ph ? 28 : dv.ttl), LABEL.LEVEL_SELECT)};
  if (ph && P.title.w > d.title.w) { const px = Math.max(16, (ph ? 28 : dv.ttl) * d.title.w / P.title.w); P.title.f = T.display(px); P.title.px = px; P.title.w = W(c, P.title.f, LABEL.LEVEL_SELECT); }
  P.kick = d.kick ? {s: "MENU", f: fS, px: dv.sec, x: d.head.x, y: d.head.y + d.kick / 2, w: W(c, fS, "MENU")} : null;
  if (d.back) P.back = {r: d.back, s: LW.BACK, f: fL, px: dv.pri, w: W(c, fL, LW.BACK)};
  /* the row labels: desk at labx in the band, phone / compact on the line over the control */
  const labelOf = (l) => {
    const r = d.rows[l], w = W(c, fL, l);
    if (d.labels === "left") return {s: l, f: fL, px: dv.pri, x: r.x + d.labx, fx: r.x + d.labx, y: r.y + r.h / 2, w, col: CONST.ink};
    const q = d.labs[l];
    return {s: l, f: fS, px: dv.sec, x: q.x, fx: q.x + dv.bombs + 8, y: q.y + q.h / 2, w: W(c, fS, l), col: CONST.t2};
  };
  for (const l of [LV.LEVEL, LV.DIFF, LV.SPEED]) if (d.rows[l]) P.rows[l] = {label: labelOf(l)};
  /* level keys: the number in the label face (an ink by kind), the flag after it on 5 and 8; 6-8 wall keys with a lock until offered */
  d.room.forEach((r, i) => {
    const n = i + 1, lock = n > G.cap, s = String(n), fin = isFinale(n), gs = Math.round(dv.sec * 0.8), nw = W(c, fN, s), w = nw + (fin || lock ? 3 + gs : 0);
    P.keys.push({set: "level", i, r, s, f: fN, px: dv.pri, nw, w, x: r.x + r.w / 2 - w / 2, y: r.y + r.h / 2, kind: lock ? "wall" : n === (ui.level | 0 || 1) ? "lit" : "well", fin, lock, gs});
  });
  const bankKeys = (set, rs, labels, on) => rs.forEach((r, i) => P.keys.push({set, i, r, s: labels[i], f: fL, px: dv.pri, w: W(c, fL, labels[i]), x: r.x + r.w / 2, y: r.y + r.h / 2, kind: i === on ? "lit" : "well", center: true}));
  bankKeys("heat", d.heat, DIFF, Math.max(0, Math.min(2, ui.heat | 0)));
  bankKeys("pace", d.pace, SPEED, Math.max(-1, Math.min(1, ui.pace | 0)) + 1);
  if (d.mods) {
    const r = d.mods, desk = d.mode === "desk", lab = desk ? {s: LV.MODS, f: fL, px: dv.pri, x: r.x + d.labx, fx: r.x + d.labx, y: r.y + r.h / 2, w: W(c, fL, LV.MODS), col: CONST.ink} : {s: LV.MODS, f: fL, px: dv.pri, x: r.x + 16, fx: r.x + 8 + dv.bombs + 8, y: r.y + r.h / 2, w: W(c, fL, LV.MODS), col: CONST.ink};
    const gs = 16, gx = r.x + r.w - (desk ? d.labx - 34 : 12) - gs;
    /* the teaser: one line, or two on a phone or compact door (a controller's TRIGGER entry and its state); dropped where neither fits */
    const room = gx - 10 - (lab.fx + lab.w + 12), lines = fitLines(c, fS, doorTeasers(ui), room, !desk && r.h >= 2 * dv.sec * ts * 1.15 + 6), lh = dv.sec * ts * 1.15;
    P.rows[LV.MODS] = {label: lab, door: !desk, glyph: {n: "rt", x: gx, y: r.y + r.h / 2 - gs / 2, s: gs},
      tz: lines.length ? {s: lines.join(" "), lines, f: fS, px: dv.sec, x: gx - 10, y: r.y + r.h / 2, ys: lines.map((_, i) => r.y + r.h / 2 + (i - (lines.length - 1) / 2) * lh), ws: lines.map((q) => W(c, fS, q)), w: Math.max(...lines.map((q) => W(c, fS, q)))} : null};
  }
  /* START: the word, the tag (one or two lines), the keycap on a desk keyboard */
  {
    const r = d.start, hpx = ph ? 32 : 38, wf = T.display(hpx / ts), ww = W(c, wf, LV.START), capS = showCap ? words.ok : "", cw = capS ? capW(c, capS, {phone: ph}) : 0, right = r.x + r.w - 16;
    const capR = capS ? {s: capS, x: right - cw, y: r.y + r.h / 2 - dv.caph / 2, w: cw, h: dv.caph} : null, tagR = capR ? capR.x - 14 : right, x0 = r.x + 8 + dv.bombs + 8;
    const lines = fitLines(c, fS, startTags(ui), tagR - (x0 + ww + 12), r.h >= 2 * dv.sec * ts * 1.2 + 8), lh = dv.sec * ts * 1.2;
    P.start = {r, word: {s: LV.START, f: wf, px: hpx / ts, rest: r.x + 20, foc: x0, w: ww, y: r.y + r.h / 2}, cap: capR,
      tag: lines.length ? {lines, f: fS, px: dv.sec, x: tagR, ys: lines.map((_, i) => r.y + r.h / 2 + (i - (lines.length - 1) / 2) * lh), w: Math.max(...lines.map((q) => W(c, fS, q)))} : null};
  }
  /* the list (when open): each entry a toggle key, on lit, off well; its name breaks once where one line will not fit */
  d.mode5.forEach((r, i) => {
    const on = entryOn(ui, i), room = r.w - 16 - dv.bombs - 6, lines = fitLines(c, fL, [ENTRIES[i]], room, true);
    P.list.push({i, r, on, lines: lines.length ? lines : [ENTRIES[i]], f: fL, px: dv.pri, ws: (lines.length ? lines : [ENTRIES[i]]).map((q) => W(c, fL, q))});
  });
  /* the card: the run LEVEL SELECT starts, with BEST (a saved time; NO TIME YET only once TIME is open) */
  if (d.pane) P.card = cardPlan(c, d.pane, {level: ui.level, heat: ui.heat, pact: ui.unlocked ? ui.pact : 0, best: ui.best ? "✓ " + LW.BEST + " " + ui.best : ui.unlocked ? LW.NO_TIME : ""}, d.dev);
  /* the help line (desk) and the lock tip */
  /* the help line: whole on one line, or broken once at a space onto two where its region holds two (never cut, never dropped while it fits) */
  if (d.help) {
    const s = helpOf(ui), f = T.body(dv.bod), r = ui.open ? d.helpAfter : d.help, lh = dv.bod * ts * 1.3, lines = fitLines(c, f, [s], r.w, r.h >= 2 * lh);
    P.help = {s, f, px: dv.bod, x: r.x, lines, ys: lines.map((_, i) => r.y + dv.bod * ts * 0.7 + i * lh), ws: lines.map((q) => W(c, f, q))};
  }
  /* phone and compact: no foot, so a controller gets its cue line (lane lessons 2026-11-11), label first, keycap word last; it steps down by
     whole items (CHANGE first, then ROW) to its line, never cut */
  if (d.cue && words.dev === "pad") {
    const it = footItems(ui.open ? LV.MODS : ui.row, ui.open, words), drop = (n) => it.filter(([t]) => !n.includes(t));
    const s0 = fitLines(c, fS, [footText(it), footText(drop([LW.CHANGE])), footText(drop([LW.CHANGE, LW.ROW, LW.PICK]))], d.cue.w)[0];
    P.cue = s0 ? {s: s0, f: fS, px: dv.sec, x: d.cue.x + d.cue.w / 2, y: d.cue.y + d.cue.h / 2, w: W(c, fS, s0)} : null;
  }
  P.lockTip = {s: LW.LOCKED, f: fS, px: dv.sec, w: W(c, fS, LW.LOCKED)};
  /* the feet (desk): one per verb, all planned at once so a focus move never misses */
  if (d.foot) {
    const verbs = ui.tap ? [ui.open ? "taplist" : "tap"] : ["value", "mods", "start", "list"];
    for (const v of verbs) P.foot[v] = footPlan(c, G, v === "tap" ? [[LEVEL_TAP, []]] : v === "taplist" ? [[LEVEL_TAP_LIST, []]] : footItems(v === "value" ? LV.LEVEL : v === "mods" ? LV.MODS : LV.START, v === "list", words));
    P.verbs = verbs;
  }
  return P;
}
function footPlan(c, G, items) {
  const d = G.d, dv = DEV.d, f = T.label(dv.sec), parts = [];
  items.forEach(([t, caps], i) => {
    if (i) parts.push({sep: "·", w: W(c, f, "·")});
    parts.push({t, w: W(c, f, t)});
    caps.forEach((q, j) => parts.push({cap: q, w: Array.isArray(q) ? dv.capw : capW(c, q), gap: j ? 5 : 8}));
  });
  let w = 0;
  parts.forEach((p, i) => { w += (i ? (p.cap ? p.gap : 12) : 0) + p.w; });
  const fw = w + 36, x = d.plate.x + d.plate.w / 2 - fw / 2, y = d.foot.y;
  let cx = x + 18;
  parts.forEach((p, i) => { cx += i ? (p.cap ? p.gap : 12) : 0; p.x = cx; cx += p.w; });
  return {x, y, w: fw, h: FOOT_H, f, px: dv.sec, parts, mid: y + FOOT_H / 2};
}
const verbOf = (ui) => (ui.tap ? (ui.open ? "taplist" : "tap") : ui.open ? "list" : ui.row === LV.MODS ? "mods" : ui.row === LV.START ? "start" : "value");

/* ---- paint ---- */
const canCap = (c) => mOf(c) === c;
function text(c, s, x, y, f, col, align) { c.font = f; c.fillStyle = col; c.textAlign = align || "left"; c.textBaseline = "middle"; c.fillText(s, x, y); }
function dspText(c, s, x, y, f, px, col) {
  const em = px * textScale();
  c.font = f; c.textAlign = "left"; c.textBaseline = "middle"; c.lineJoin = "round"; c.lineWidth = em * 0.12; c.strokeStyle = c.fillStyle = CONST.ol;
  c.strokeText(s, x, y + em * 0.08); c.fillText(s, x, y + em * 0.08); c.strokeText(s, x, y);
  c.fillStyle = col; c.fillText(s, x, y);
}
/* a ←→ keycap's legend: the kit's up triangle turned */
function arrowCap(c, x, y, w, h, dir, tok, kind = "key") {
  key(c, x, y, w, h, kind, {tok});
  if (dir === "up" || dir === "dn") return glyph(c, dir, x + (w - 13) / 2, y + (h - 13) / 2, 13, CONST.t2);
  c.save(); c.translate(x + w / 2, y + h / 2); c.rotate(dir === "lf" ? -Math.PI / 2 : Math.PI / 2); glyph(c, "up", -6.5, -6.5, 13, CONST.t2); c.restore();
}
/* a door's chevron (the kit's chev) pointing rt, lf or dn */
function chevron(c, dir, x, y, s, col) {
  if (dir === "rt") return glyph(c, "chev", x, y, s, col);
  c.save(); c.translate(x + s / 2, y + s / 2); c.rotate(dir === "lf" ? Math.PI : Math.PI / 2); glyph(c, "chev", -s / 2, -s / 2, s, col); c.restore();
}
/* compact's open list stands on the plate's bed over what it covers (the head and the groups) */
function coverBed(c, r, tok) { c.fillStyle = tok.bedA; c.fillRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8); }
/* the lock: a shackle over a body, in col, centred at cx cy, s tall */
function lockGlyph(c, cx, cy, s, col) {
  const k = Math.max(1.5, s / 7);
  c.fillStyle = col;
  c.fillRect(cx - s * 0.26, cy - s * 0.42, k, s * 0.34); c.fillRect(cx + s * 0.26 - k, cy - s * 0.42, k, s * 0.34); c.fillRect(cx - s * 0.26, cy - s * 0.42, s * 0.52, k);
  c.fillRect(cx - s * 0.38, cy - s * 0.1, s * 0.76, s * 0.55);
}
const KEY_INK = {lit: CONST.dk, well: CONST.t2, wall: CONST.off};
function paintKey(c, q, tok, ph) {
  const r = q.r;
  key(c, r.x, r.y, r.w, r.h, q.kind, {tok, phone: ph});
  const dy = q.kind === "lit" ? -2 : 0, col = KEY_INK[q.kind];
  if (q.center) return text(c, q.s, q.x, q.y + dy, q.f, col, "center");
  if (q.lock) {
    const cw = q.w + 14, ch = q.px * textScale() + 6;
    c.fillStyle = CONST.ol; c.beginPath(); c.rect(q.x - 7, q.y - ch / 2, cw, ch); c.fill();
  }
  text(c, q.s, q.x, q.y + dy, q.f, col);
  if (q.lock) lockGlyph(c, q.x + q.nw + 3 + q.gs / 2, q.y, q.gs, col);
  else if (q.fin) glyph(c, "flag", q.x + q.nw + 3, q.y + dy - q.gs / 2, q.gs, col);
}
function bankFrame(c, b) { c.fillStyle = CONST.ol; c.beginPath(); rp(c, b.x, b.y, b.w, b.h, 8); c.fill(); }
const rp = (c, x, y, w, h, r) => { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
/* one row's controls and label, at rest or focused (band, bomb, label at its focused x) */
function paintRowPart(c, G, P, tok, l, foc) {
  const d = G.d, ph = d.dev === "p", dv = DEV[d.dev], r = d.rows[l], o = P.rows[l];
  if (l === LV.START) return paintStart(c, G, P, tok, foc, "bare");
  if (l === LV.MODS && o.door) {
    key(c, r.x, r.y, r.w, r.h, "key", {tok, ring: foc, phone: ph});
    if (foc) { band(c, r.x, r.y, r.w, r.h, tok); focusBomb(c, r.x + 8, r.y + r.h / 2, dv.bombs); }
    text(c, o.label.s, foc ? o.label.fx : o.label.x, o.label.y, o.label.f, o.label.col);
    chevron(c, o.glyph.n, o.glyph.x, o.glyph.y, o.glyph.s, CONST.t2);
    return;
  }
  if (foc) { band(c, r.x, r.y, r.w, r.h, tok); focusBomb(c, r.x + (d.labels === "left" ? 8 : 4), d.labels === "left" ? r.y + r.h / 2 : o.label.y, dv.bombs); }
  const lab = o.label;
  text(c, lab.s, foc && d.labels !== "left" ? lab.fx : lab.x, lab.y, lab.f, lab.col);
  if (l === LV.LEVEL) for (const q of P.keys) { if (q.set === "level") paintKey(c, q, tok, ph); }
  else if (l === LV.DIFF || l === LV.SPEED) { bankFrame(c, l === LV.DIFF ? d.heatB : d.paceB); for (const q of P.keys) if (q.set === (l === LV.DIFF ? "heat" : "pace")) paintKey(c, q, tok, ph); }
  else if (l === LV.MODS) chevron(c, o.glyph.n, o.glyph.x, o.glyph.y, o.glyph.s, CONST.t2);
}
/* part: "bare" START's key and word (static), "dev" its tag and keycap (live: they follow the device and the run), else all */
function paintStart(c, G, P, tok, foc, part) {
  const o = P.start, r = o.r, dv = DEV[G.d.dev], ph = G.d.dev === "p";
  if (part !== "dev") {
    key(c, r.x, r.y, r.w, r.h, "main", {tok, ring: foc});
    if (foc) focusBomb(c, r.x + 8, r.y + r.h / 2, dv.bombs);
    text(c, o.word.s, foc ? o.word.foc : o.word.rest, o.word.y, o.word.f, CONST.yelInk);
  }
  if (part === "bare") return;
  if (o.tag) o.tag.lines.forEach((q, i) => text(c, q, o.tag.x, o.tag.ys[i], o.tag.f, CONST.yelInk, "right"));
  if (o.cap && canCap(c)) cap(c, o.cap.x, o.cap.y, o.cap.s, {main: true, tok, phone: ph});
}
function paintEntry(c, G, q, tok, foc) {
  const r = q.r, dv = DEV[G.d.dev], ph = G.d.dev === "p", lh = q.px * textScale() * 1.1, x = r.x + 8 + dv.bombs + 6;
  key(c, r.x, r.y, r.w, r.h, q.on ? "lit" : "well", {tok, ring: foc, phone: ph});
  const dy = q.on ? -2 : 0;
  if (foc) focusBomb(c, r.x + 8, r.y + dy + r.h / 2, dv.bombs);
  q.lines.forEach((s, i) => text(c, s, x, r.y + dy + r.h / 2 + (i - (q.lines.length - 1) / 2) * lh, q.f, q.on ? CONST.dk : CONST.t2));
}
/* the static parts, one painter per layer: the plate (rampart and bed), the head, the rows at rest, START at rest */
const paintPlate = (g, G, tok) => plate(g, G.d.plate.x, G.d.plate.y, G.d.plate.w, G.d.plate.h, tok, {phone: G.d.dev === "p"});
function paintHead(g, G, P, tok) {
  if (P.kick) text(g, P.kick.s, P.kick.x, P.kick.y, P.kick.f, CONST.t2);
  dspText(g, P.title.s, P.title.x, P.title.y, P.title.f, P.title.px, CONST.ink);
  if (P.back) { const r = P.back.r; key(g, r.x, r.y, r.w, r.h, "key", {tok, phone: G.d.dev === "p"}); chevron(g, "lf", r.x + 16, r.y + r.h / 2 - 9, 18, CONST.ink); text(g, P.back.s, r.x + 46, r.y + r.h / 2, P.back.f, CONST.ink); }
}
const paintRows = (g, G, P, tok) => { for (const l of [LV.LEVEL, LV.DIFF, LV.SPEED, LV.MODS]) if (P.rows[l]) paintRowPart(g, G, P, tok, l, false); };
function paintRest(g, G, P, tok, dpr) {
  paintPlate(g, G, tok); paintHead(g, G, P, tok); paintRows(g, G, P, tok);
  if (P.card) paintCard(g, P.card, tok, {dpr});
  paintStart(g, G, P, tok, false, "bare");
}
function paintFoot(c, F, tok) {
  const {x, y, w, h} = F, rr = (x0, y0, w0, h0, r0, col) => { c.fillStyle = col; c.beginPath(); rp(c, x0, y0, w0, h0, r0); c.fill(); };
  rr(x, y + 4, w, h, 8, CONST.ol); rr(x, y, w, h, 8, CONST.ol); rr(x + 2, y + 2, w - 4, h - 4, 6, tok.bed);
  c.fillStyle = tok.keyhi; c.fillRect(x + 6, y + 2, w - 12, 2);
  for (const p of F.parts) {
    if (p.sep) text(c, p.sep, p.x, F.mid, F.f, CONST.off);
    else if (p.cap) { const cy = F.mid - DEV.d.caph / 2; if (Array.isArray(p.cap)) arrowCap(c, p.x, cy, p.w, DEV.d.caph, p.cap[0], tok); else if (canCap(c)) cap(c, p.x, cy, p.cap, {tok}); }
    else text(c, p.t, p.x, F.mid, F.f, CONST.t2);
  }
}
/* the lock tip: a sign plaque under the locked key (bed, 2 px outline, hard 3 px drop), clamped inside the plate */
function tipRect(G, P, i) {
  const d = G.d, k = d.room[i], dv = DEV[d.dev], w = P.lockTip.w + 32, h = dv.sec * textScale() + 20;
  const x = Math.max(d.plate.x + 6, Math.min(d.plate.x + d.plate.w - 6 - w, k.x + k.w / 2 - w / 2));
  return R(x, k.y + k.h + 6, w, h);
}
function paintTip(c, r, P, tok) {
  c.fillStyle = CONST.ol; c.beginPath(); rp(c, r.x, r.y + 3, r.w, r.h, 6); c.fill(); c.beginPath(); rp(c, r.x, r.y, r.w, r.h, 6); c.fill();
  c.fillStyle = tok.bed; c.beginPath(); rp(c, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 4); c.fill();
  text(c, P.lockTip.s, r.x + r.w / 2, r.y + r.h / 2, P.lockTip.f, CONST.ink, "center");
}

/* ---- probe ---- */
const CAP_K = 0.705;
function record(G, P, ui, foc, dpr, el, touchy, verb, tipR, tok) {
  const u = G.u, d = G.d, b = (r) => [r.x * u, r.y * u, r.w * u, r.h * u], ts = textScale();
  probe.begin("level", {w: G.W, h: G.H, dpr, el});
  probe.rect("plate", ...b(d.plate), {plate: G.T});
  const txt = (s, x, y, w, px, col, role, o = {}) => probe.text(s, x * u, (y - px * ts * CAP_K / 2) * u, Math.max(0.01, w * u), px * ts * CAP_K * u, {role, col, px: px * u, ...o});
  txt(P.title.s, P.title.x, P.title.y, P.title.w, P.title.px, CONST.ink, "primary");
  if (P.kick) txt(P.kick.s, P.kick.x, P.kick.y, P.kick.w, P.kick.px, CONST.t2, "secondary");
  if (d.pageKeys) d.pageKeys.forEach((r, i) => probe.rect(i ? "PAGE DOWN" : "PAGE UP", ...b(r), {touch: touchy, set: "page", kind: "step", fill: tok.key}));
  if (P.back) { probe.rect("BACK", ...b(P.back.r), {touch: touchy, set: "back", focus: false, fill: tok.key}); txt(P.back.s, P.back.r.x + 46, P.back.r.y + P.back.r.h / 2, P.back.w, P.back.px, CONST.ink, "primary"); }
  for (const l of [LV.LEVEL, LV.DIFF, LV.SPEED, LV.MODS]) {
    const o = P.rows[l];
    if (!o) continue;
    const f = foc === l, lab = o.label;
    txt(lab.s, f && (d.labels !== "left" || o.door) ? lab.fx : lab.x, lab.y, lab.w, lab.px, lab.col, d.labels === "left" || o.door ? "primary" : "secondary");
    if (l === LV.MODS) {
      probe.rect(l, ...b(d.mods), {touch: touchy, set: "mods door", focus: f, fill: f ? tok.band : tok.key});
      if (o.tz) o.tz.lines.forEach((q, i) => txt(q, o.tz.x - o.tz.ws[i], o.tz.ys[i], o.tz.ws[i], o.tz.px, CONST.t2, "secondary"));
      const g = o.glyph;
      probe.pair("info", b(R(g.x, g.y, g.s, g.s)), b(R(g.x - 6, g.y - 6, g.s + 12, g.s + 12)), {col: CONST.t2, name: "MODIFIERS " + g.n});
    } else if (f) probe.rect(l + " band", ...b(d.rows[l]), {focus: true, fill: tok.band});
  }
  let chosen = {}, unchosen = {}, lockedK = null, wellK = null;
  for (const q of P.keys) {
    const lit = q.kind === "lit", nm = (q.set === "level" ? LABEL.LEVEL : q.set === "heat" ? LABEL.DIFFICULTY : LABEL.GAME_SPEED) + " " + q.s;
    probe.rect(nm, ...b(q.r), {touch: touchy, set: q.set, kind: "bank", fill: lit ? tok.lit : q.kind === "wall" ? tok.well : tok.well});
    const x0 = q.center ? q.x - q.w / 2 : q.x;
    txt(q.s, x0, q.y - (lit ? 2 : 0), q.center ? q.w : q.nw, q.px, KEY_INK[q.kind], "primary", q.kind === "wall" ? {lock: true} : {});
    if (lit) chosen[q.set] = q; else if (q.kind === "well" && !unchosen[q.set]) unchosen[q.set] = q;
    if (q.kind === "wall" && !lockedK) lockedK = q;
    if (q.set === "level" && q.kind === "well" && !wellK) wellK = q;
    if (q.fin && !q.lock) probe.pair("info", b(R(q.x + q.nw + 3, q.y - (lit ? 2 : 0) - q.gs / 2, q.gs, q.gs)), b(R(q.x + q.nw - 2, q.y - q.gs, q.gs + 10, 2 * q.gs)), {col: KEY_INK[q.kind], name: "flag " + q.s});
  }
  for (const s of ["level", "heat", "pace"]) if (chosen[s] && unchosen[s]) probe.pair("chosen", b(chosen[s].r), b(unchosen[s].r), {name: s + " chosen vs not"});
  /* the locked key against the chosen one; its texture against an open well's own lip (the same sub-rect the gate reads, clear of the legend) */
  if (lockedK && chosen.level) probe.pair("locked", b(lockedK.r), b(chosen.level.r), wellK ? {name: "locked level " + lockedK.s, floor: b(R(wellK.r.x + 3, wellK.r.y + 3, Math.max(4, wellK.r.w * 0.2), wellK.r.h - 6))} : {name: "locked level " + lockedK.s});
  const o = P.start, fs = foc === LV.START;
  probe.rect(LV.START, ...b(o.r), {touch: touchy, set: "start", focus: fs, fill: CONST.yel});
  txt(o.word.s, fs ? o.word.foc : o.word.rest, o.word.y, o.word.w, o.word.px, CONST.yelInk, "primary");
  if (o.tag) o.tag.lines.forEach((q, i) => txt(q, o.tag.x - o.tag.w, o.tag.ys[i], o.tag.w, o.tag.px, CONST.yelInk, "secondary"));
  if (o.cap) { probe.rect("START cap", ...b(o.cap)); txt(o.cap.s, o.cap.x + 10, o.cap.y + o.cap.h / 2, o.cap.w - 20, DEV[d.dev].sec, CONST.yel, "secondary"); }
  const ent = {};
  for (const q of P.list) {
    const f = foc === "M" + q.i, x = q.r.x + 8 + DEV[d.dev].bombs + 6, lh = q.px * ts * 1.1, dy = q.on ? -2 : 0;
    probe.rect(ENTRIES[q.i], ...b(q.r), {touch: touchy, set: "mods", kind: "list", focus: f, fill: q.on ? tok.lit : tok.well});
    q.lines.forEach((s, i) => txt(s, x, q.r.y + dy + q.r.h / 2 + (i - (q.lines.length - 1) / 2) * lh, q.ws[i], q.px, q.on ? CONST.dk : CONST.t2, "primary"));
    ent[q.on ? "on" : "off"] = ent[q.on ? "on" : "off"] || q;
  }
  if (ent.on && ent.off) probe.pair("chosen", b(ent.on.r), b(ent.off.r), {name: "modifier on vs off"});
  if (P.card) recordCard(P.card, (n, x, y, w, h) => probe.rect(n, ...b(R(x, y, w, h))), (s, x, y, w, px, col, role) => txt(s, x, y, w, px, col, role), (a, bg, col, name) => probe.pair("info", b(a), b(bg), {col, name}));
  if (P.help) P.help.lines.forEach((q, i) => probe.text(q, P.help.x * u, (P.help.ys[i] - P.help.px * ts * CAP_K / 2) * u, P.help.ws[i] * u, P.help.px * ts * CAP_K * u, {role: "body", col: CONST.t2, px: P.help.px * ts * u}));
  /* the focus: the band (a row) or the key (START, the door, a list entry) against the bed beside it; a key's ring */
  const fr = foc === LV.START ? o.r : foc && foc[0] === "M" && foc.length === 2 ? P.list[+foc[1]] && P.list[+foc[1]].r : d.rows[foc];
  if (fr) {
    const bed = R(d.plate.x + 1, fr.y, Math.max(1, Math.min(fr.x - 7 - d.plate.x - 1, 12)), fr.h), ring = foc === LV.START || (foc === LV.MODS && P.rows[LV.MODS] && P.rows[LV.MODS].door) || foc[0] === "M" && foc.length === 2;
    if (bed.w >= 4) {
      probe.pair("band", b(fr), b(bed), {name: "focus " + foc});
      if (ring) probe.pair("ring", b(R(fr.x - 6, fr.y - 6, fr.w + 12, fr.h + 12)), b(bed), {name: "ring " + foc});
    }
  }
  const F = verb != null && P.foot[verb];
  if (F) {
    probe.rect("foot", ...b(F));
    for (const p of F.parts) {
      if (p.cap) probe.rect("foot cap", ...b(R(p.x, F.mid - DEV.d.caph / 2, p.w, DEV.d.caph)));
      if (p.cap && !Array.isArray(p.cap)) txt(p.cap, p.x + 10, F.mid, p.w - 20, F.px, CONST.t2, "secondary");
      else if (!p.cap) txt(p.sep || p.t, p.x, F.mid, p.w, F.px, p.sep ? CONST.off : CONST.t2, "secondary", p.sep ? {lock: true} : {});
    }
  }
  if (P.cue) txt(P.cue.s, P.cue.x - P.cue.w / 2, P.cue.y, P.cue.w, P.cue.px, CONST.t2, "secondary");
  if (tipR) txt(P.lockTip.s, tipR.x + tipR.w / 2 - P.lockTip.w / 2, tipR.y + tipR.h / 2, P.lockTip.w, P.lockTip.px, CONST.ink, "secondary");
}

/* ---- the frame ---- */
const J = JSON.stringify;
export const _dbg = {plans: 0, last: null};
let S = null;
const FIELDS = ["level", "heat", "pace", "pact", "time", "unlocked", "best", "open", "tap", "trig", "cur", "row", "rev"];
function same(S, G, ui, w, touchy, dpr, ts, c) {
  if (!S || S.G !== G || S.w !== w || S.touch !== touchy || S.dpr !== dpr || S.ts !== ts || S.c !== c) return false;
  for (const k of FIELDS) if (S.ui[k] !== ui[k]) return false;
  return true;
}
const grow = (r, e) => R(r.x - e, r.y - e, r.w + 2 * e, r.h + 2 * e);
const union = (rs) => { const q = rs.filter(Boolean), x = Math.min(...q.map((r) => r.x)), y = Math.min(...q.map((r) => r.y)); return R(x, y, Math.max(...q.map((r) => r.x + r.w)) - x, Math.max(...q.map((r) => r.y + r.h)) - y); };
/* The layers, each keyed by what it shows (fix round 1, ruling (c)). The room is MENU's own kit roomLayer at MENU's room dpr (menu.js roomDpr: one
   rule, one key), so a MENU / LEVEL SELECT switch never refills it. The plate (rampart and bed) is its own layer at 1 device px per box unit (the
   bed is flat rects) under the four rampart strips at full dpr; the head, the rows at rest, the card and START at rest are full-dpr layers of their
   own rects, so the plate's empty bed costs no full-dpr bytes. The LEVEL row's focus (eight keys) is a layer; the other rows, START and a list entry
   focus live (a band, a bomb, at most three keys). The feet (desk keyboard) are one layer per verb, all made at once. */
function sizes(S, G, F, level, tok) {
  const d = G.d, u = G.u, dpr = S.dpr, P = S.P, ui = S.ui, J6 = (v) => +v.toFixed(6), T0 = d.T, pl = d.plate;
  const lay = [level, G.lay, J6(u), J(pl), S.ts].join("|"), vals = [ui.heat, ui.pace, ui.unlocked ? ui.pact : 0, ui.unlocked ? +!!ui.time : 0, !!ui.unlocked].join("|");
  const K = {biome: tok.name, level, W: F.W, H: F.H, look: "2d", textScale: S.ts, dpr};
  const mk = (name, r, id) => { const b = sc(r, u); return {r, b, w: Math.max(1, Math.round(b.w * dpr)), h: Math.max(1, Math.round(b.h * dpr)), key: {...K, layer: "level." + name + "|" + lay + "|" + id}}; };
  const ox = pl.x - T0 - 2, oy = pl.y - T0 - 2, ow = pl.w + 2 * T0 + 4, oh = pl.h + 2 * T0 + 5;
  S.L = {
    rT: mk("ringT", R(ox, oy, ow, T0 + 4), ""), rB: mk("ringB", R(ox, pl.y + pl.h - 2, ow, T0 + 5 + 2), ""),
    rL: mk("ringL", R(ox, pl.y, T0 + 4, pl.h), ""), rR: mk("ringR", R(pl.x + pl.w - 2, pl.y, T0 + 4, pl.h), ""),
    head: mk("head", grow(union([R(P.title.x, P.title.y - P.title.px * S.ts * 0.7, P.title.w + 8, P.title.px * S.ts * 1.5), P.kick && R(P.kick.x, d.head.y, P.kick.w, d.kick), d.back && R(d.back.x, d.back.y, d.back.w, d.back.h + 6)]), 4), ""),
    start: mk("start", grow(d.start, 6), ""),
  };
  /* the rows at rest, one layer per page (a paged compact plans every page at once, so a focus move across pages never misses), and the LEVEL row's focus */
  S.PG.forEach((q, p) => {
    const e = q.G.d;
    S.L["rows" + p] = {...mk("rows" + p, grow(union([e.rows[LV.LEVEL], e.rows[LV.DIFF], e.rows[LV.SPEED], e.rows[LV.MODS], ...e.room]), 6), vals + "|" + ui.level + "|" + p + "|" + J(e.rows)), pg: p};
    if (e.rows[LV.LEVEL]) S.L.focL = {...mk("focus", grow(e.rows[LV.LEVEL], 4), vals + "|" + ui.level + "|" + p), pg: p};
  });
  if (P.card) S.L.card = mk("card", grow(d.pane, 2), P.card.key);
  if (P.list.length) S.L.list = mk("list", grow(d.listR, 4), P.list.map((q) => +q.on).join(""));
  for (const v of P.verbs) { const fp = P.foot[v]; S.L["foot " + v] = {...mk("foot " + v, R(fp.x - 1, fp.y - 1, fp.w + 2, fp.h + 6), ""), fp, key: {...K, layer: "level.foot|" + J([J6(u), fp.x, fp.y, fp.w, fp.parts.map((p) => [p.t || p.sep || "", p.cap || ""])])}}; }
  /* the list's layer is reserved whether the list is open or not, so opening it never moves the room's dpr (a room re-raster) */
  const ob = R(ox, oy, ow, oh), bb = sc(ob, u);
  S.L.bed = {r: ob, b: bb, w: Math.max(1, Math.round(bb.w)), h: Math.max(1, Math.round(bb.h)), key: {...K, dpr: 1, layer: "level.bed|" + lay}};
  S.rd = roomDpr(S.c, F, {rev: ui.rev}, dpr);
  S.box = {w: F.W, h: F.H};
  S.roomK = keyOf({layer: "room", biome: tok.name, level, W: F.W, H: F.H, dpr: S.rd, look: "2d", textScale: 1});
}
const blit = (c, q) => c.drawImage(q.cv, q.b.x, q.b.y, q.b.w, q.b.h);
function want(q, paint, u, dpr) {
  if (q.cv && q.cv.width) { touch(q.key); return q.cv; }
  return (q.cv = layer(q.key, q.w, q.h, (g) => { g.scale(dpr * u, dpr * u); g.translate(-q.r.x, -q.r.y); g.beginPath(); g.rect(q.r.x, q.r.y, q.r.w, q.r.h); g.clip(); paint(g); }));
}
/** Paints LEVEL SELECT on c (#sh's context, or #c's when there is no shell box) for the frame F; see the header for ui. */
export function drawLevelPage(c, F, ui0, t = 0) {
  if (!okBox(F)) return;
  const level = ui0.level | 0 || 1, tok = worldTokens(level), U = !!ui0.unlocked, touchy = !!F.touch, words = hints(), ts = textScale();
  const tap = ui0.tap != null ? !!ui0.tap : tapMode(touchy), open = !!ui0.open && U;
  const ui = {...ui0, level, unlocked: U, open, tap, pad: words.dev === "pad", cur: open ? ui0.cur | 0 : -1, trig: !open && U && words.dev === "pad" && ui0.trig >= 0 ? ui0.trig | 0 : -1};
  const G = levelGeom(F, {unlocked: U, open, row: ui.row}), u = G.u, d = G.d, dev = deviceScale(c), dpr = capDpr(dev, touchy);
  if (!same(S, G, ui, words, touchy, dpr, ts, c)) {
    const showCap = d.mode === "desk" && !tap && !touchy, K = S;
    S = {G, w: words, touch: touchy, dpr, ts, c, tap, ui, P: plan(c, G, ui, words, showCap)};
    S.PG = d.pages && d.pages.length > 1 ? d.pages.map((rows, p) => { if (p === d.page) return {G, P: S.P}; const Gp = levelGeom(F, {unlocked: U, open, row: rows[0]}); return {G: Gp, P: plan(c, Gp, ui, words, showCap)}; }) : [{G, P: S.P}];
    sizes(S, G, F, level, tok);
    /* a layer whose key did not change keeps its canvas */
    if (K) {
      for (const [n, q] of Object.entries(S.L)) { const o = K.L && K.L[n]; if (o && o.cv && keyOf(o.key) === keyOf(q.key)) q.cv = o.cv; }
      if (K.room && K.roomK === S.roomK) S.room = K.room;
    }
    _dbg.plans++;
  }
  const P = S.P, a = Math.max(0, Math.min(1, (ui.enterT == null ? 1 : ui.enterT) / 0.25)), a0 = typeof c.globalAlpha === "number" ? c.globalAlpha : 1;
  const rowFoc = ui.tap ? LV.START : P.rows[ui.row] || ui.row === LV.START ? ui.row : LV.LEVEL, foc = open ? "M" + ui.cur : rowFoc, verb = d.foot ? verbOf(ui) : null;
  const peek = ui.lockR > G.cap && typeof ui.lockT === "number" && t - ui.lockT >= 0 && t - ui.lockT < 1.8 ? ui.lockR : 0, tipR = peek ? tipRect(G, P, peek - 1) : null;
  _dbg.last = {G, P, foc, verb, S, tipR};
  if (typeof c.clip !== "function" || typeof c.rect !== "function") return;
  const L = S.L, dp = dpr;
  if (canMake()) {
    if (!S.room || !S.room.width) S.room = roomLayer(S.box, level, tok, {dpr: S.rd, look: "2d", textScale: 1}); // MENU's call, MENU's key
    else touch(S.roomK);
    want(L.bed, (g) => paintPlate(g, G, tok), u, 1);
    for (const n of ["rT", "rB", "rL", "rR"]) want(L[n], (g) => paintPlate(g, G, tok), u, dp);
    want(L.head, (g) => paintHead(g, G, P, tok), u, dp);
    S.PG.forEach((q, p) => want(L["rows" + p], (g) => paintRows(g, q.G, q.P, tok), u, dp));
    want(L.start, (g) => paintStart(g, G, P, tok, false, "bare"), u, dp);
    const fq = S.PG[L.focL.pg];
    want(L.focL, (g) => paintRowPart(g, fq.G, fq.P, tok, LV.LEVEL, true), u, dp);
    if (L.card) want(L.card, (g) => paintCard(g, P.card, tok, {dpr: dp * u}), u, dp);
    if (L.list) want(L.list, (g) => { if (d.cover) coverBed(g, d.listR, tok); for (const q of P.list) paintEntry(g, G, q, tok, false); }, u, dp);
    for (const v of P.verbs) want(L["foot " + v], (g) => paintFoot(g, L["foot " + v].fp, tok), u, dp);
    c.save(); c.imageSmoothingEnabled = true; c.drawImage(S.room, 0, 0, F.W, F.H); c.restore();
    c.save(); c.globalAlpha = a0 * a; c.imageSmoothingEnabled = true;
    for (const n of ["bed", "rT", "rB", "rL", "rR", "head", "rows" + (d.page | 0), "start", ...(L.card ? ["card"] : []), ...(L.list ? ["list"] : [])]) blit(c, L[n]);
    if (foc === LV.LEVEL) blit(c, L.focL);
    if (verb && L["foot " + verb]) blit(c, L["foot " + verb]);
    c.restore();
  } else {
    c.save(); c.fillStyle = toL(tok.bg1, 0.004); c.fillRect(0, 0, F.W, F.H); c.globalAlpha = a0 * a; c.scale(u, u);
    paintRest(c, G, P, tok);
    if (d.cover && P.list.length) coverBed(c, d.listR, tok);
    for (const q of P.list) paintEntry(c, G, q, tok, false);
    if (foc === LV.LEVEL) paintRowPart(c, G, P, tok, LV.LEVEL, true);
    if (verb && P.foot[verb]) paintFoot(c, P.foot[verb], tok);
    c.restore();
  }
  /* live: the focused part (but LEVEL's), the door's teaser, the help line, START's tag and keycap, the lock tip */
  c.save(); c.globalAlpha = a0 * a; c.scale(u, u);
  if (open && P.list[ui.cur]) paintEntry(c, G, P.list[ui.cur], tok, true);
  else if (foc !== LV.LEVEL) paintRowPart(c, G, P, tok, foc, true);
  const mo = P.rows[LV.MODS];
  if (mo && mo.tz) mo.tz.lines.forEach((q, i) => text(c, q, mo.tz.x, mo.tz.ys[i], mo.tz.f, CONST.t2, "right"));
  if (P.help) P.help.lines.forEach((q, i) => text(c, q, P.help.x, P.help.ys[i], P.help.f, CONST.t2));
  paintStart(c, G, P, tok, false, "dev");
  if (P.cue) text(c, P.cue.s, P.cue.x, P.cue.y, P.cue.f, CONST.t2, "center");
  if (d.pageKeys) d.pageKeys.forEach((r, i) => { const on = i ? d.page < d.pages.length - 1 : d.page > 0; arrowCap(c, r.x, r.y, r.w, r.h, i ? "dn" : "up", tok, on ? "key" : "well"); });
  if (tipR) paintTip(c, tipR, P, tok);
  c.restore();
  c.globalAlpha = a0;
  if (probe.probe.on) record(G, P, ui, foc, dpr, F.shell ? "sh" : "c", touchy, verb, tipR, tok);
}
