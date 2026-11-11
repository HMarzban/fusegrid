/* MENU PAGE (UI upgrade v202 Task 3.1; design record §1, §1b, §2, §4; appendix 7.4; the round 7 S7-menu / L7-logo frames). The room the next run starts
   in (ui.level) dresses the stage: its room look (kit room.js) opaque over the whole canvas, its rampart round the plate; the arcade bomber is the keys.
   menuGeom(F, rows) is the one geometry for draw and tap: rects by ROW NAME in box units (G.d: the same in design px, the mock's CSS px; u box units
   per design px). F = {W, H, touch, shell, css, ts}: the box (#sh's shell box, else #c's 600 x 520 / 608 x 352), touch (data-lay p / l), shell, css (CSS
   px per box unit, handed in by fit.js for #sh's box and #c on a touch layout; 1 when unknown), ts (the kit text scale). Three arrangements.
   desk: every keyboard box, the 1366 x 768 frame at u 1: the mock's plate centred, a narrower window narrows only the card's column (the list keeps
   480), the 70 px top margin gives way to a short window, then the page scales as one piece (#c, the iso guard). On a touch layout its rows and gaps
   are floored in CSS px (>= 44 tall, >= 8 apart, never scaled below) and the page re-solved round them; it stays the desk while its own scale holds
   TOUCH_U (0.8 CSS px per design px, its text at the phone's cap floors), else the box goes compact. phone: a touch-portrait shell box, the 393 x 852
   column in CSS px (u = 1 / css), capped at 600 CSS px and centred; the card's slot takes the height left. compact: any other touch box (every
   landscape phone, which has no shell box, and a short landscape window): the phone's grammar across the box in CSS px, the logo and PLAY across the
   top, the six doors as tiles two wide and three deep, no card slot (PLAY's tag carries the run) and no foot (SOURCE's tile carries the build tag and
   the notes); its sizes step from COMPACT max down to min with the height, and under min it scales as one piece (there the floors give way).
   G.card is the next-run card's slot (pages/card.js, Task 3.2: the run PLAY starts, painted into the plate layer); compact has none. A row owns its
   key and half of each gap round it, out to the plate's bed edge; menuHit returns its ITEMS index, -1 off the rows or on a zero box. The logo (drawLogo2d, place menu) sits in the header at scale lk = max(u x cap / 36, 20 / 36): under a
   20-unit cap the plan has no MENU build. drawMenuPage(c, F, ui, t): ui = {rows, focus (a label; tap mode hands PLAY), level, run, daily (null or
   today's tries), best (the top played NORMAL score or null), look, pages, rev, note, pad, reduced, enterT}; a zero or non-finite box draws nothing.
   Cached (kit cache.js, recency touched on a steady frame): the room (roomLayer, its dpr giving way so the plate, a foot reserve (the bare three-verb
   feet, FEET_STEP) and a 3 MiB logo reserve fit the 24 MiB budget), the plate (rampart, bed, the next-run card, every row at rest but PLAY's tag and
   keycap; keyed by what it shows, the card's key included, so a device flip or a note on the desk never re-rasters it), one foot per verb (START on
   PLAY, OPEN on a door, a controller's SOURCE line, keyed by its words), all made at once so a cursor move never misses; feet wider in all than the
   reserve (a controller's three verbs under the sound note) paint live instead. Live: the logo, PLAY's tag and keycap, the focused row (key, band on a
   door, the bare bomb, its words, the cream ring), the 0.25 s fade of plate, logo and foot over the opaque room. A context that cannot measure plans on a 0.6 em estimate and
   gets no keycap; with no canvas source (Node) the plate and foot paint straight onto the target over one flat fill; a context with no clip or rect (the
   headless renderer's) gets the plan only. Under the probe it records its rects, texts and squint pairs outside any layer paint. */
import {biomeOf} from "../../core/config.js";
import {LABEL, MENU_ROWS, MENU_WORDS as M, ART_STYLES, DIFF, tagFor, runParts} from "../words.js";
import {worldTokens, CONST, toL} from "../kit/tokens.js";
import {key, cap, capW, plate, band, focusBomb, glyph, plaque} from "../kit/paint.js";
import {T, DEV, measure as W, textScale, measurer as mOf, measures as canCap, text, CAP_K} from "../kit/type.js";
import {R, sc, okBox, big, deep} from "../kit/geom.js";
import {layer, capDpr, touch, keyOf, canMake} from "../kit/cache.js";
import {roomLayer, roomFit, shareRoom, ROOM_RESERVE} from "../kit/room.js";
import * as probe from "../kit/probe.js";
import {drawLogo2d, deviceScale} from "../logo/draw2d.js";
import {PLATE as LOGO} from "../logo/worlds.js";
import {layout as logoLay} from "../logo/glyphs.js";
import {hints, tapMode} from "../hintcopy.js";
import {TZ, cardPlan, paintCard, recordCard} from "./card.js";

export const DESK = deep({
  d: {top: 70, w: 1060, pad: [30, 26, 26, 26], list: 480, col: 26, hero: 64, door: 46, card: 420, foot: 18},
  d125: {top: 56, w: 1180, pad: [22, 24, 20, 24], list: 520, col: 26, hero: 72, door: 49, card: 456, foot: 14},
});
export const PHONE = deep({
  p: {top: 40, bot: 20, side: 12, pad: [12, 12, 14, 12], hero: 62, door: 50, tile: 58, card: 120, max: 600},
  p125: {top: 26, bot: 20, side: 12, pad: [12, 12, 14, 12], hero: 62, door: 50, tile: 84, card: 120, max: 600},
});
export const PITCH = 8, BRK = 24, GAP = 10, FOOT_H = 54, TOP_MIN = 26, GUT = 8, CARD_MIN = 360;
/* the cached feet's reserve: the three verbs' feet (START, OPEN, the controller's SOURCE line) planned with no note or sign at the text scale in force,
   their layer widths summed and rounded up to FEET_STEP device px, so a key / controller flip (within a few px of each other) lands on the same room
   key and the room's dpr never moves with the words; feet wider in all (a note, the signpost, long rebound caps) paint live instead */
export const FEET_STEP = 256;
export {TZ};
/* the touch floors in CSS px (a target's least side, the least gap between two), and the least desk scale a touch box keeps the desk at */
export const TOUCH = Object.freeze({h: 44, g: 8}), TOUCH_U = 0.8;
/* compact: each vertical size steps between min and max with the height (one t for all); in CSS px. top / bot clear the plate's ring (T + 2, T + 3),
   pad / lp / cap / lp2 / below the logo's header, hero PLAY, tile the six doors, gap every pitch (9 at the least, so a gap the gate measures through a
   fractional stage scale still reads >= 8). side and padX are fixed; the column is capped at wmax wide and centred. */
export const COMPACT = deep({
  c: {least: {}, min: {top: 12, pad: 4, lp: 2, cap: 20, lp2: 2, below: 8, hero: 44, gap: 9, tile: 44, pad2: 8, bot: 13}, max: {top: 40, pad: 12, lp: 18, cap: 36, lp2: 10, below: 10, hero: 62, gap: 10, tile: 58, pad2: 14, bot: 20}, side: 12, padX: 10, wmax: 600},
  c125: {least: {lp: 0, cap: 0, lp2: 0, gap: 8, pad2: 4, bot: 12, padX: 6}, min: {top: 12, pad: 4, lp: 2, cap: 20, lp2: 2, below: 8, hero: 50, gap: 9, tile: 58, pad2: 8, bot: 13}, max: {top: 40, pad: 12, lp: 18, cap: 36, lp2: 10, below: 10, hero: 62, gap: 10, tile: 84, pad2: 14, bot: 20}, side: 12, padX: 10, wmax: 600},
});
const LOGO_CAP = LOGO.menu.cap, ENV = logoLay(LOGO.menu.build).env, LOGO_H = ENV.h * LOGO_CAP, EDGE = 2;
const LOGO_MIN = 20;
const PLAY = MENU_ROWS[0], LS = LABEL.LEVEL_SELECT, GUIDE = "GUIDE", SOURCE = "SOURCE";
/* fl (a touch box): the floors in box units ({h, g}); a row's height and a gap in design px are then max(design, floor / u), and u is the largest
   scale whose floored page fits the box (the floored part is fixed in box units, so the fit is monotone in u: a bisection finds it) */
function desk(F, rows, t125, fl) {
  const D = DESK[t125 ? "d125" : "d"], Lp = LOGO.menu[t125 ? "d125" : "d"], T0 = DEV.d.T, head = Lp.pad[0] + LOGO_H + Lp.pad[2];
  const base = rows.map((l, i) => (i === 0 ? D.hero : D.door)), gap0 = rows.map((l, i) => (i === 0 ? 0 : i === 1 || l === GUIDE ? BRK : PITCH));
  const at = (u) => {
    const hs = fl ? base.map((h) => Math.max(h, fl.h / u)) : base, gs = fl ? gap0.map((g, i) => (i ? Math.max(g, fl.g / u) : 0)) : gap0;
    const colH = Math.max(rows.reduce((a, l, i) => a + gs[i] + hs[i], 0), D.card);
    return {hs, gs, colH, plateH: D.pad[0] + head + Lp.below + colH + D.pad[2]};
  };
  const tail = D.foot + FOOT_H + 4 + 12, side = 2 * (T0 + 2 + GUT), minW = side + D.pad[3] + D.list + D.col + CARD_MIN + D.pad[1];
  let S = at(1), u = Math.min(1, F.W / minW, F.H / (TOP_MIN + S.plateH + tail));
  if (fl) {
    const fits = (v) => v * (TOP_MIN + at(v).plateH + tail) <= F.H;
    if (!fits(u)) { let lo = 0, hi = u; for (let i = 0; i < 48; i++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; } u = lo; }
    S = at(u);
  }
  const {hs, gs, colH, plateH} = S, Wd = F.W / u, Hd = F.H / u;
  const pw = Math.min(D.w, Wd - side), px = (Wd - pw) / 2, py = Math.max(TOP_MIN, Math.min(D.top, Hd - plateH - tail));
  const hy = py + D.pad[0], ly = hy + Lp.pad[0], top = hy + head + Lp.below, lx = px + D.pad[3];
  const out = {}, hit = {};
  let y = top;
  rows.forEach((l, i) => { y += gs[i]; out[l] = R(lx, y, D.list, hs[i]); y += hs[i]; });
  rows.forEach((l, i) => {
    const r = out[l], up = i === 0 ? Math.min(12, Lp.below / 2) : gs[i] / 2, dn = i === rows.length - 1 ? D.pad[2] / 2 : gs[i + 1] / 2;
    hit[l] = R(px, r.y - up, lx + D.list + D.col / 2 - px, r.h + up + dn);
  });
  const cx = lx + D.list + D.col;
  return {mode: "desk", dev: "d", u, t125, T: T0, cap: LOGO_CAP, plate: R(px, py, pw, plateH), head: R(px + D.pad[3], hy, pw - D.pad[1] - D.pad[3], head),
    logo: R(px + D.pad[3], ly, pw - D.pad[1] - D.pad[3], LOGO_H), rows: out, hit, kind: Object.fromEntries(rows.map((l, i) => [l, i === 0 ? "main" : "door"])),
    card: R(cx, top, px + pw - D.pad[1] - cx, colH), foot: R(px, py + plateH + D.foot, pw, FOOT_H)};
}
function phone(F, rows, t125) {
  const P = PHONE[t125 ? "p125" : "p"], Lp = LOGO.menu[t125 ? "p125" : "p"], css = F.css > 0 ? F.css : 1, head = Lp.pad[0] + LOGO_H + Lp.pad[2];
  const mid = rows.slice(2, -1), tileRows = Math.ceil(mid.length / 2), tilesH = tileRows * P.tile + (tileRows - 1) * GAP;
  const fixed = P.top + P.pad[0] + head + Lp.below + P.hero + GAP + P.door + GAP + GAP + tilesH + GAP + P.door + P.pad[2] + P.bot;
  const u = Math.min(1 / css, F.H / (fixed + P.card)), Wd = F.W / u, Hd = F.H / u;
  const pw = Math.min(Wd - 2 * P.side, P.max), px = (Wd - pw) / 2, py = P.top, ph = Hd - P.bot - py;
  const ix = px + P.pad[3], iw = pw - P.pad[1] - P.pad[3], hy = py + P.pad[0], cardH = ph - P.pad[0] - head - Lp.below - P.pad[2] - (fixed - P.top - P.pad[0] - head - Lp.below - P.pad[2] - P.bot);
  const out = {}, kind = {};
  let y = hy + head + Lp.below;
  out[rows[0]] = R(ix, y, iw, P.hero); kind[rows[0]] = "main"; y += P.hero + GAP;
  out[rows[1]] = R(ix, y, iw, P.door); kind[rows[1]] = "door"; y += P.door + GAP;
  const card = R(ix, y, iw, cardH);
  y += cardH + GAP;
  const tw = (iw - GAP) / 2;
  mid.forEach((l, i) => { out[l] = R(ix + (i & 1) * (tw + GAP), y + (i >> 1) * (P.tile + GAP), tw, P.tile); kind[l] = "tile"; });
  y += tilesH + GAP;
  const last = rows[rows.length - 1];
  out[last] = R(ix, y, iw, P.door); kind[last] = "door";
  return {mode: "phone", dev: "p", u, t125, T: DEV.p.T, cap: LOGO_CAP, gap: GAP, plate: R(px, py, pw, ph), head: R(ix, hy, iw, head), logo: R(ix, hy + Lp.pad[0], iw, LOGO_H), rows: out,
    hit: hitTiles(rows, out, kind, ix, iw, P.pad[3] / 2, GAP, Math.min(GAP, Lp.below), P.pad[2]), kind, card, foot: null};
}
/* a phone-grammar row owns half of each gap round it; the outer column out to half the plate's side pad, PLAY from half its top gap, the last row half
   the plate's bottom pad */
function hitTiles(rows, out, kind, ix, iw, e, gap, top0, pad2) {
  const hit = {}, x0 = ix - e, x1 = ix + iw + e, lastY = Math.max(...rows.map((l) => out[l].y));
  for (const l of rows) {
    const r = out[l], top = l === rows[0] ? r.y - top0 / 2 : r.y - gap / 2, bot = r.y === lastY ? r.y + r.h + pad2 / 2 : r.y + r.h + gap / 2;
    const left = kind[l] === "tile" && r.x > ix ? r.x - gap / 2 : x0, right = kind[l] === "tile" && r.x + r.w < ix + iw - 1e-9 ? r.x + r.w + gap / 2 : x1;
    hit[l] = R(left, top, right - left, bot - top);
  }
  return hit;
}
/* the compact arrangement: one t steps every size between COMPACT min and max (CSS px, u = 1 / css); under min the whole scales (u = H / min) */
function compact(F, rows, t125) {
  const C = COMPACT[t125 ? "c125" : "c"], css = F.css > 0 ? F.css : 1, n = Math.ceil((rows.length - 1) / 2);
  const tot = (q) => q.top + q.pad + q.lp + ENV.h * q.cap + q.lp2 + q.below + q.hero + q.gap + n * q.tile + (n - 1) * q.gap + q.pad2 + q.bot;
  const lo = tot(C.min), hi = tot(C.max), Hc = F.H * css, lo2 = tot({...C.min, ...C.least});
  /* under min, a 125 % box first takes its least sizes (the wordmark steps out of the header, the gaps close to 8: R1 landscape, never under the
     floors; every row keeps its words); only under those does the whole scale */
  const least = Hc < lo, M = least ? {...C.min, ...C.least} : C.min;
  const u = Hc >= lo2 ? 1 / css : F.H / lo2, Hd = F.H / u, t = least ? 0 : Math.max(0, Math.min(1, (Hd - lo) / (hi - lo)));
  const q = Object.fromEntries(Object.keys(C.min).map((k) => [k, M[k] + t * (C.max[k] - M[k])]));
  const pX = least && C.least.padX != null ? C.least.padX : C.padX, Wd = F.W / u, pw = Math.min(Wd - 2 * C.side, C.wmax), px = (Wd - pw) / 2, ix = px + pX, iw = pw - 2 * pX;
  const ph = tot(q) - q.top - q.bot, py = q.top + Math.max(0, Hd - tot(q)) / 2, hy = py + q.pad, lh = ENV.h * q.cap, head = q.lp + lh + q.lp2;
  const out = {}, kind = {}, tw = (iw - q.gap) / 2;
  let y = hy + head + q.below;
  out[rows[0]] = R(ix, y, iw, q.hero); kind[rows[0]] = "main"; y += q.hero + q.gap;
  rows.slice(1).forEach((l, i) => { out[l] = R(ix + (i & 1) * (tw + q.gap), y + (i >> 1) * (q.tile + q.gap), tw, q.tile); kind[l] = "tile"; });
  return {mode: "compact", dev: "p", u, t125, t, T: DEV.p.T, cap: q.cap, gap: q.gap, plate: R(px, py, pw, ph), head: R(ix, hy, iw, head), logo: q.cap > 0 ? R(ix, hy + q.lp, iw, lh) : null, rows: out,
    hit: hitTiles(rows, out, kind, ix, iw, pX / 2, q.gap, Math.min(q.gap, q.below), q.pad2), kind, card: null, foot: null};
}
let gm = null;
const sameRows = (a, b) => a === b || (a.length === b.length && a.every((l, i) => l === b[i]));
export function menuGeom(F, rows = MENU_ROWS) {
  const ts = F.ts > 0 ? F.ts : textScale(), t125 = big(ts), touchy = !!F.touch, shell = !!F.shell, css = F.css > 0 ? F.css : 1, isPhone = shell && touchy && F.H > F.W * 1.3;
  if (gm && gm.W === F.W && gm.H === F.H && gm.touch === touchy && gm.shell === shell && gm.t125 === t125 && gm.css === css && sameRows(gm.rows, rows)) return gm.G;
  let d = isPhone ? phone(F, rows, t125) : desk(F, rows, t125, touchy ? {h: TOUCH.h / css, g: TOUCH.g / css} : null);
  if (touchy && !isPhone && !(d.u * css >= TOUCH_U)) d = compact(F, rows, t125);
  const u = d.u, G = {mode: d.mode, dev: d.dev, u, t125, W: F.W, H: F.H, d, T: d.T * u, order: rows.slice(),
    lk: Math.max(u * d.cap / LOGO_CAP, LOGO_MIN / LOGO_CAP),
    plate: sc(d.plate, u), head: sc(d.head, u), logo: sc(d.logo, u), card: sc(d.card, u), foot: sc(d.foot, u), kind: d.kind, rows: {}, hit: {}};
  for (const l of rows) { G.rows[l] = sc(d.rows[l], u); G.hit[l] = sc(d.hit[l], u); }
  const k = G.lk / u, cy = d.logo && d.logo.y + d.logo.h / 2, cx = d.logo && d.logo.x + d.logo.w / 2, bw = d.logo && Math.max(d.logo.w, ENV.w * LOGO_CAP * k + 2 * EDGE * k) / k;
  G.lbox = d.logo ? R(cx * u / G.lk - bw / 2, cy * u / G.lk - (LOGO_H + 2 * EDGE) / 2, bw, LOGO_H + 2 * EDGE) : null; // null: compact's least step, no wordmark
  gm = {W: F.W, H: F.H, touch: touchy, shell, t125, css, rows, G: deep(G)};
  return gm.G;
}
export function menuHit(x, y, F, rows = MENU_ROWS) {
  if (!okBox(F)) return -1;
  const G = menuGeom(F, rows);
  for (let i = 0; i < rows.length; i++) { const h = G.hit[rows[i]]; if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) return i; }
  return -1;
}

const sep3 = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
function teasers(l, ui, phoneMode) {
  const n = ui.daily, b = ui.best;
  switch (l) {
    case LS: return phoneMode ? [] : [M.LEVEL_TEASE];
    case "DAILY": return n == null ? [phoneMode ? M.NEW_SHORT : M.NEW, M.NEW_SHORT] : phoneMode ? [M.TRIES_SHORT + " · " + n, M.TRIES_MIN + " · " + n] : [M.TRIES + " · " + n, M.TRIES_SHORT + " · " + n, M.TRIES_MIN + " · " + n];
    case LABEL.RECORDS: return b == null ? [M.NO_RUNS] : phoneMode ? [M.BEST + " " + sep3(b), sep3(b)] : [M.BEST + " " + sep3(b) + " · " + DIFF[0] + " " + LABEL.DIFFICULTY, M.BEST + " " + sep3(b), sep3(b)];
    case LABEL.SETTINGS: return [ART_STYLES[ui.look | 0] || ART_STYLES[0]];
    case GUIDE: return [(ui.pages | 0) + " " + M.PAGES];
    case SOURCE: return phoneMode ? noteCands(ui).concat(ui.rev ? [ui.rev] : []) : [M.GITHUB];
  }
  return [];
}
const PAD_SIGN = "CONTROLLER READY · " + LABEL.SETTINGS + " › CONTROLS", VIB = /^CONTROLLER READY · VIBRATION \w+$/;
export const padSign = (n) => (n === "CONTROLLER READY" || n === "CONTROLLER BACK" || VIB.test(n || "") ? PAD_SIGN : "");
function noteCands(ui) {
  if (ui.note) return [ui.note, ui.note.split(" · ")[0]];
  const s = padSign(ui.pad);
  return !s ? [] : VIB.test(ui.pad) ? [ui.pad + " · " + LABEL.SETTINGS + " › CONTROLS", s, "CONTROLLER READY"] : [s, "CONTROLLER READY"];
}
export function playTags(ui) {
  const run = ui.run || {}, t = tagFor(run), lv = LABEL.LEVEL + " " + (ui.level | 0 || 1) + " · " + biomeOf(ui.level | 0 || 1).name;
  if (!t) return [lv];
  return [...new Set([t, runParts(run, {count: true}).join(" · "), runParts(run, {count: true, terse: true}).join(" · "), lv])];
}
const lblF = (px) => T.label(px);
function fitCands(c, f, cands, room, two) {
  for (const s of cands) {
    if (W(c, f, s) <= room) return [s];
    if (two) for (let i = s.lastIndexOf(" "); i > 0; i = s.lastIndexOf(" ", i - 1)) { const a = s.slice(0, i), b = s.slice(i + 1); if (W(c, f, a) <= room && W(c, f, b) <= room) return [a, b]; }
  }
  return [];
}
const HERO_PX = 38;
function rowPlan(c, G, ui, l, words, showCap) {
  const d = G.d, r = d.rows[l], k = d.kind[l], ph = d.dev === "p", dv = DEV[d.dev], ts = textScale(), o = {l, k, r, rest: {}, foc: {}};
  if (k === "main") {
    const wf = T.display(HERO_PX / textScale()), ww = W(c, wf, PLAY), capS = showCap ? words.ok : "", cw = capS ? capW(c, capS, {phone: ph}) : 0, right = r.x + r.w - 16;
    o.cap = capS ? {s: capS, x: right - cw, y: r.y + r.h / 2 - dv.caph / 2, w: cw, h: dv.caph} : null;
    const tagR = o.cap ? o.cap.x - 14 : right, tf = lblF(dv.sec), x0 = r.x + 46, room = tagR - (x0 + ww + 12);
    o.word = {s: PLAY, f: wf, px: HERO_PX / ts, rest: r.x + 20, foc: x0, w: ww, y: r.y + r.h / 2};
    const lines = fitCands(c, tf, playTags(ui), room, r.h >= 2 * dv.sec * ts * 1.2 + 8), lh = dv.sec * ts * 1.2;
    o.tag = lines.length ? {lines, f: tf, px: dv.sec, x: tagR, ys: lines.map((_, i) => r.y + r.h / 2 + (i - (lines.length - 1) / 2) * lh), w: Math.max(...lines.map((q) => W(c, tf, q)))} : null;
    return o;
  }
  const lf = lblF(dv.pri), lw = W(c, lf, l), gs = ph ? 18 : 16, tile = k === "tile", sh = dv.bombs + 6;
  const tzCol = l === SOURCE && ph && (ui.note || padSign(ui.pad)) ? CONST.ink : TZ;
  o.label = {s: l, f: lf, px: dv.pri, w: lw, col: l === SOURCE ? CONST.t2 : CONST.ink, lines: [l], ws: [lw]};
  o.glyph = {n: l === SOURCE ? "ext" : "chev", s: gs};
  const tf = lblF(dv.sec);
  if (!tile) {
    const gx = r.x + r.w - (ph ? 16 : 18) - gs, lx = r.x + 24, room = gx - 10 - (lx + sh + lw + 12);
    o.glyph.x = gx; o.glyph.y = r.y + r.h / 2 - gs / 2;
    o.rest.x = lx; o.foc.x = lx + sh; o.label.y = r.y + r.h / 2; o.label.ys = [o.label.y];
    const tz = fitCands(c, tf, teasers(l, ui, ph), room)[0] || "";
    o.tz = tz ? {lines: [tz], f: tf, px: dv.sec, x: gx - 10, ys: [r.y + r.h / 2], align: "right", w: W(c, tf, tz), col: tzCol} : null;
    return o;
  }
  /* a tile: the label breaks once at a space where one line will not fit (a compact LEVEL SELECT); the teaser takes the lines the tile has left */
  const lx = r.x + 16, fx = r.x + 8 + dv.bombs + 8, gx = r.x + r.w - 12 - gs, room = Math.min(gx - 6 - lx, r.x + r.w - 14 - fx);
  /* a one-word label too wide for its tile at 125 % (SETTINGS on a 667 x 375 phone's least tiles) steps down to its 100 % size, still over the floors */
  if (lw > room && ts > 1 && !/ /.test(l) && W(c, lblF(dv.pri / ts), l) <= room) { o.label.f = lblF(dv.pri / ts); o.label.px = dv.pri / ts; o.label.w = o.label.ws[0] = W(c, o.label.f, l); }
  const lab = o.label.w <= room ? [l] : fitCands(c, lf, [l], room, true), ll = lab.length ? lab : [l], lhL = dv.pri * ts * 1.15, lhT = dv.sec * ts * 1.2;
  const nT = Math.floor((r.h - 4 - ll.length * lhL - 4) / lhT), lines = nT >= 1 ? fitCands(c, tf, teasers(l, ui, ph), room, big(ts) && nT >= 2) : [];
  const bh = ll.length * lhL + (lines.length ? 4 + lines.length * lhT : 0), top = r.y + r.h / 2 - bh / 2;
  o.glyph.x = gx; o.glyph.y = r.y + r.h / 2 - gs / 2; o.glyph.focHide = true;
  o.rest.x = lx; o.foc.x = fx; o.label.lines = ll; o.label.ys = ll.map((_, i) => top + lhL * (i + 0.5)); o.label.y = o.label.ys[0];
  if (ll.length > 1) { o.label.ws = ll.map((q) => W(c, lf, q)); o.label.w = Math.max(...o.label.ws); }
  o.tz = lines.length ? {lines, f: tf, px: dv.sec, x: lx, fx, ys: lines.map((_, i) => top + ll.length * lhL + 4 + lhT * (i + 0.5)), align: "left", w: Math.max(...lines.map((s) => W(c, tf, s))), col: tzCol} : null;
  return o;
}
function footPlan(c, G, ui, words, verb, sign) {
  const d = G.d, dv = DEV.d, f = lblF(dv.sec);
  const items = [];
  if (sign) items.push({t: sign, col: CONST.ink});
  else {
    if (ui.note) items.push({t: ui.note});
    if (tapMode(!!G.touch)) items.push({t: M.TAP});
    else {
      items.push({t: M.MOVE, caps: words.dev === "pad" ? [words.move] : [["up"], ["dn"]]});
      items.push(verb === M.SOURCE_PAD ? {t: verb} : {t: verb, caps: [words.ok]});
    }
  }
  const parts = [];
  items.forEach((it, i) => {
    if (i) parts.push({sep: "·"});
    parts.push({t: it.t, col: it.col, w: W(c, f, it.t)});
    if (it.caps) it.caps.forEach((q, j) => parts.push({cap: q, w: Array.isArray(q) ? dv.capw : capW(c, q), gap: j ? 5 : 8}));
  });
  if (ui.rev) parts.push({sep: "|"}, {t: ui.rev, w: W(c, f, ui.rev)});
  let w = 0;
  parts.forEach((p, i) => { if (p.sep) p.w = W(c, f, p.sep); w += (i ? (p.cap ? p.gap : 12) : 0) + p.w; });
  const fw = w + 32 + 4, x = d.plate.x + d.plate.w / 2 - fw / 2, y = d.foot.y;
  if (x < GUT && sign && sign !== PAD_SIGN) return footPlan(c, G, ui, words, verb, PAD_SIGN);
  let cx = x + 18;
  parts.forEach((p, i) => { cx += i ? (p.cap ? p.gap : 12) : 0; p.x = cx; cx += p.w; });
  return {x, y, w: fw, h: FOOT_H, f, px: dv.sec, parts, mid: y + FOOT_H / 2};
}
export function plan(c0, G, ui) {
  const c = mOf(c0), words = hints(), showCap = G.mode === "desk" && !tapMode(!!G.touch) && !G.touch, rows = {};
  for (const l of G.order) rows[l] = rowPlan(c, G, ui, l, words, showCap);
  const sign = !ui.note && padSign(ui.pad) ? (VIB.test(ui.pad) ? ui.pad + " · " + LABEL.SETTINGS + " › CONTROLS" : PAD_SIGN) : "";
  const verbs = G.mode === "desk" ? (tapMode(!!G.touch) || sign ? [""] : words.dev === "pad" ? [M.START, M.OPEN, M.SOURCE_PAD] : [M.START, M.OPEN]) : [];
  const foot = {};
  for (const v of verbs) foot[v] = footPlan(c, G, ui, words, v, sign);
  const run = ui.run || {}, card = G.d.card ? cardPlan(c, G.d.card, {level: ui.level, heat: run.heat, pact: run.pact}, G.d.dev) : null;
  const bare = {...ui, note: "", pad: ""}, reserve = G.mode === "desk" ? [M.START, M.OPEN, M.SOURCE_PAD].map((v) => footPlan(c, G, bare, words, v, "").w + 2) : [];
  return {rows, foot, verbs, card, reserve};
}

/* part: "bare" paints PLAY's key and word only (the plate layer), "dev" its tag and keycap only (live: they follow the device and the run); else all */
function paintRow(c, o, tok, ph, foc, part) {
  const r = o.r, dv = DEV[ph ? "p" : "d"];
  if (o.k === "main") {
    if (part !== "dev") {
      key(c, r.x, r.y, r.w, r.h, "main", {tok, ring: foc});
      if (foc) focusBomb(c, r.x + 8, r.y + r.h / 2, dv.bombs);
      text(c, o.word.s, foc ? o.word.foc : o.word.rest, o.word.y, o.word.f, CONST.yelInk);
    }
    if (part === "bare") return;
    if (o.tag) o.tag.lines.forEach((q, i) => text(c, q, o.tag.x, o.tag.ys[i], o.tag.f, CONST.yelInk, "right"));
    if (o.cap && canCap(c)) cap(c, o.cap.x, o.cap.y, o.cap.s, {main: true, tok, phone: ph});
    return;
  }
  key(c, r.x, r.y, r.w, r.h, "key", {tok, ring: foc});
  if (foc) { band(c, r.x, r.y, r.w, r.h, tok); focusBomb(c, r.x + 8, r.y + r.h / 2, dv.bombs); }
  o.label.lines.forEach((s, i) => text(c, s, foc ? o.foc.x : o.rest.x, o.label.ys[i], o.label.f, o.label.col));
  if (o.tz) o.tz.lines.forEach((s, i) => text(c, s, o.tz.align === "left" && foc ? o.tz.fx : o.tz.x, o.tz.ys[i], o.tz.f, o.tz.col, o.tz.align));
  if (!(foc && o.glyph.focHide)) glyph(c, o.glyph.n, o.glyph.x, o.glyph.y, o.glyph.s, CONST.t2);
}
function paintFoot(c, P, tok) {
  plaque(c, P.x, P.y, P.w, P.h, tok);
  for (const p of P.parts) {
    if (p.sep) text(c, p.sep, p.x, P.mid, P.f, CONST.off);
    else if (p.cap) {
      const cy = P.mid - DEV.d.caph / 2;
      if (Array.isArray(p.cap)) { key(c, p.x, cy, p.w, DEV.d.caph, "key", {tok}); glyph(c, p.cap[0], p.x + (p.w - 13) / 2, cy + (DEV.d.caph - 13) / 2, 13, CONST.t2); }
      else if (canCap(c)) cap(c, p.x, cy, p.cap, {tok});
    } else text(c, p.t, p.x, P.mid, P.f, p.col || CONST.t2);
  }
}

function record(G, P, ui, foc, dpr, el, verb, touchy) {
  const u = G.u, d = G.d, b = (r) => [r.x * u, r.y * u, r.w * u, r.h * u], tok = worldTokens(ui.level);
  probe.begin("menu", {w: G.W, h: G.H, dpr, el});
  probe.rect("plate", ...b(d.plate), {plate: G.T});
  const txt = (s, x, y, w, px, col, role, o = {}) => probe.text(s, x * u, (y - px * textScale() * CAP_K / 2) * u, Math.max(0.01, w * u), px * textScale() * CAP_K * u, {role, col, px: px * u, ...o});
  for (const l of G.order) {
    const o = P.rows[l], r = o.r, f = l === foc;
    probe.rect(l, ...b(r), {touch: touchy, set: "menu", focus: f, fill: o.k === "main" ? CONST.yel : f ? tok.band : tok.key});
    if (o.k === "main") {
      txt(o.word.s, f ? o.word.foc : o.word.rest, o.word.y, o.word.w, o.word.px, CONST.yelInk, "primary");
      if (o.tag) o.tag.lines.forEach((q, i) => txt(q, o.tag.x - o.tag.w, o.tag.ys[i], o.tag.w, o.tag.px, CONST.yelInk, "secondary"));
      if (o.cap) { probe.rect(l + " cap", ...b(o.cap)); txt(o.cap.s, o.cap.x + 10, o.cap.y + o.cap.h / 2, o.cap.w - 20, DEV[d.dev].sec, CONST.yel, "secondary"); }
      continue;
    }
    o.label.lines.forEach((s, i) => txt(s, f ? o.foc.x : o.rest.x, o.label.ys[i], o.label.ws[i], o.label.px, o.label.col, "primary"));
    if (o.tz) o.tz.lines.forEach((s, i) => { const x = o.tz.align === "left" ? (f ? o.tz.fx : o.tz.x) : o.tz.x - o.tz.w; txt(s, x, o.tz.ys[i], o.tz.w, o.tz.px, o.tz.col, "secondary"); });
    if (!(f && o.glyph.focHide)) {
      const g = o.glyph, pad = 6, bx = R(Math.max(r.x + 2, g.x - pad), g.y - pad, g.s + 2 * pad, g.s + 2 * pad);
      probe.pair("info", b(R(g.x, g.y, g.s, g.s)), b(bx), {col: CONST.t2, name: l + " " + g.n});
    }
  }
  if (P.card) recordCard(P.card, (n, x, y, w, h) => probe.rect(n, ...b(R(x, y, w, h))), (s, x, y, w, px, col, role) => txt(s, x, y, w, px, col, role),
    (a, bg, col, name) => probe.pair("info", b(a), b(bg), {col, name}));
  const k = d.rows[foc], x0 = d.kind[foc] === "tile" && k.x > d.rows[G.order[0]].x ? k.x - d.gap + 1 : d.plate.x + 1, bed = R(x0, k.y, Math.max(1, k.x - 7 - x0), k.h);
  probe.pair("band", b(k), b(bed), {name: "focus " + foc});
  probe.pair("ring", b(R(k.x - 6, k.y - 6, k.w + 12, k.h + 12)), b(bed), {name: "ring " + foc});
  const F = verb != null && P.foot[verb];
  if (F) {
    probe.rect("foot", ...b(F));
    for (const p of F.parts) {
      if (p.cap) probe.rect("foot cap", ...b(R(p.x, F.mid - DEV.d.caph / 2, p.w, DEV.d.caph)));
      if (p.cap && !Array.isArray(p.cap)) txt(p.cap, p.x + 10, F.mid, p.w - 20, F.px, CONST.t2, "secondary");
      else if (!p.cap) txt(p.sep || p.t, p.x, F.mid, p.w, F.px, p.sep ? CONST.off : p.col || CONST.t2, "secondary", p.sep ? {lock: true} : {});
    }
  }
}

const outer = (d) => R(d.plate.x - d.T - 2, d.plate.y - d.T - 2, d.plate.w + 2 * d.T + 4, d.plate.h + 2 * d.T + 5);
const FIELDS = ["level", "look", "pages", "daily", "best", "rev", "note", "pad"];
function same(S, G, ui, w, touchy, dpr, ts, c, tap) {
  if (!S || S.G !== G || S.w !== w || S.touch !== touchy || S.dpr !== dpr || S.ts !== ts || S.c !== c || S.tap !== tap) return false;
  for (const k of FIELDS) if (S.ui[k] !== ui[k]) return false;
  const a = S.ui.run || {}, b = ui.run || {};
  return a.heat === b.heat && a.pace === b.pace && a.pact === b.pact && a.time === b.time;
}
/* The plate's key names what it shows: the box's arrangement, the world, the teasers and the card (its own key: the level, heat and lives it shows);
   the notes only where SOURCE's teaser carries them (phone and compact). The hint words, tap mode and PLAY's run tag are not in it (PLAY's tag and
   keycap paint live), so on the desk a device flip, a note or a controller's arrival re-rasters only the feet. A foot's key is its own words. The
   room's dpr gives way to a foot reserve sized once from the bare three-verb feet (FEET_STEP), never to the feet of the moment, so the room's key
   never moves with the words either. */
function sizes(S, G, F, level, tok) {
  const d = G.d, u = G.u, dpr = S.dpr, P = S.P, ob = outer(d), pb = sc(ob, u), ui = S.ui;
  const id = [level, G.mode, +u.toFixed(6), J(d.plate), ui.look, ui.pages, ui.daily, ui.best, ui.rev, ...(d.dev === "p" ? [ui.note, ui.pad] : []), P.card ? P.card.key : ""].join("|");
  const K = {biome: tok.name, level, W: F.W, H: F.H, look: "2d", textScale: S.ts, dpr};
  S.ob = ob; S.pb = pb; S.pw = Math.round(pb.w * dpr); S.ph = Math.round(pb.h * dpr); S.plateKey = {...K, layer: "menu.plate|" + id}; S.plateK = keyOf(S.plateKey);
  S.feet = P.verbs.map((v) => {
    const fp = P.foot[v], fr = R(fp.x - 1, fp.y - 1, fp.w + 2, fp.h + 6), b = sc(fr, u), w = Math.round(b.w * dpr), h = Math.round(b.h * dpr);
    const key = {...K, layer: "menu.foot|" + J([+u.toFixed(6), fp.x, fp.y, fp.w, fp.parts.map((p) => [p.t || p.sep || "", p.cap || "", p.col || ""])])};
    return {v, fp, fr, b, w, h, key, k: keyOf(key)};
  });
  const feet = Math.ceil(P.reserve.reduce((n, w) => n + Math.round(w * u * dpr), 0) / FEET_STEP) * FEET_STEP * Math.round((FOOT_H + 6) * u * dpr) * 4;
  S.live = S.feet.reduce((n, q) => n + q.w * q.h * 4, 0) > feet;
  S.rd = rdOf(F, dpr, S.pw * S.ph * 4, feet);
  S.box = {w: F.W, h: F.H};
  S.roomK = keyOf({layer: "room", biome: tok.name, level, W: F.W, H: F.H, dpr: S.rd, look: "2d", textScale: 1});
}
/* the room's dpr: what is left of the budget once the plate, the foot reserve and the logo reserve are held, never above the device's */
const rdOf = (F, dpr, plate, feet) => roomFit(F, dpr, ROOM_RESERVE + plate + feet);
/** MENU's room dpr for the box F at the capped dpr: the shared room rule (kit room.js shareRoom / roomDpr) every page that blits MENU's room layer
    uses, so a hop between them never refills the room. ui: {rows, rev}. */
export function roomDpr(c0, F, ui, dpr) {
  if (!okBox(F)) return 1;
  const c = mOf(c0), G = menuGeom(F, (ui && ui.rows) || MENU_ROWS), u = G.u, Gt = Object.assign(Object.create(G), {touch: !!F.touch}), words = hints(), bare = {...(ui || {}), note: "", pad: ""};
  const reserve = G.mode === "desk" ? [M.START, M.OPEN, M.SOURCE_PAD].map((v) => footPlan(c, Gt, bare, words, v, "").w + 2) : [];
  const pb = sc(outer(G.d), u), feet = Math.ceil(reserve.reduce((n, w) => n + Math.round(w * u * dpr), 0) / FEET_STEP) * FEET_STEP * Math.round((FOOT_H + 6) * u * dpr) * 4;
  return rdOf(F, dpr, Math.round(pb.w * dpr) * Math.round(pb.h * dpr) * 4, feet);
}
shareRoom(roomDpr);
const J = JSON.stringify;
export const _dbg = {plans: 0, last: null};
let S = null;
function paintPlate(g, G, P, tok, dpr) {
  const d = G.d, ph = d.dev === "p";
  plate(g, d.plate.x, d.plate.y, d.plate.w, d.plate.h, tok, {phone: ph});
  if (P.card) paintCard(g, P.card, tok, {dpr});
  for (const l of G.order) paintRow(g, P.rows[l], tok, ph, false, "bare");
}
/** Paints MENU on c (#sh's context, or #c's when there is no shell box) for the frame F; see the header for ui. */
export function drawMenuPage(c, F, ui, t = 0) {
  if (!okBox(F)) return;
  const level = ui.level | 0 || 1, tok = worldTokens(level), G = menuGeom(F, ui.rows || MENU_ROWS), u = G.u, words = hints(), ts = textScale(), touchy = !!F.touch;
  const dev = deviceScale(c), dpr = capDpr(dev, touchy), tap = tapMode(touchy);
  if (!same(S, G, ui, words, touchy, dpr, ts, c, tap)) {
    S = {G, w: words, touch: touchy, dpr, ts, c, tap, ui: {...ui}, P: plan(c, Object.assign(Object.create(G), {touch: touchy}), ui), room: null, plate: null, foot: {}};
    sizes(S, G, F, level, tok);
    _dbg.plans++;
  }
  const P = S.P, ph = G.d.dev === "p", a = Math.max(0, Math.min(1, (ui.enterT == null ? 1 : ui.enterT) / 0.25)), a0 = typeof c.globalAlpha === "number" ? c.globalAlpha : 1;
  const verb = G.mode === "desk" ? (P.verbs.length > 1 ? (ui.focus === G.order[0] ? M.START : ui.focus === SOURCE && P.verbs.includes(M.SOURCE_PAD) ? M.SOURCE_PAD : M.OPEN) : "") : null;
  const foc = P.rows[ui.focus] ? ui.focus : G.order[0];
  _dbg.last = {G, P, foc, verb, S};
  if (typeof c.clip !== "function" || typeof c.rect !== "function") return;
  if (canMake()) {
    if (!S.room || !S.room.width) S.room = roomLayer(S.box, level, tok, {dpr: S.rd, look: "2d", textScale: 1});
    else touch(S.roomK);
    if (!S.plate || !S.plate.width) S.plate = layer(S.plateKey, S.pw, S.ph, (g) => { g.scale(dpr * u, dpr * u); g.translate(-S.ob.x, -S.ob.y); paintPlate(g, G, P, tok, dpr * u); });
    else touch(S.plateK);
    if (!S.live) for (const q of S.feet) {
      if (!S.foot[q.v] || !S.foot[q.v].width) S.foot[q.v] = layer(q.key, q.w, q.h, (g) => { g.scale(dpr * u, dpr * u); g.translate(-q.fr.x, -q.fr.y); paintFoot(g, q.fp, tok); });
      else touch(q.k);
    }
    c.save(); c.imageSmoothingEnabled = true; c.drawImage(S.room, 0, 0, F.W, F.H); c.restore();
    c.save(); c.globalAlpha = a0 * a; c.imageSmoothingEnabled = true; c.drawImage(S.plate, S.pb.x, S.pb.y, S.pb.w, S.pb.h);
    const q = !S.live && verb != null && S.feet.find((f) => f.v === verb);
    if (q) c.drawImage(S.foot[verb], q.b.x, q.b.y, q.b.w, q.b.h);
    c.restore();
  } else {
    c.save(); c.fillStyle = toL(tok.bg1, 0.004); c.fillRect(0, 0, F.W, F.H); c.globalAlpha = a0 * a; c.scale(u, u);
    paintPlate(c, G, P, tok);
    if (verb != null && P.foot[verb]) paintFoot(c, P.foot[verb], tok);
    c.restore();
  }
  c.save(); c.globalAlpha = a0 * a;
  c.save(); c.scale(G.lk, G.lk);
  if (G.lbox) drawLogo2d(c, {level, place: "menu", box: G.lbox, k: G.lk, dpr: dev, css: F.css > 0 ? F.css : 1, touch: touchy, t, reduced: !!ui.reduced});
  c.restore();
  c.scale(u, u);
  if (S.live && canMake() && verb != null && P.foot[verb]) paintFoot(c, P.foot[verb], tok);
  if (foc !== G.order[0]) paintRow(c, P.rows[G.order[0]], tok, ph, false, "dev");
  paintRow(c, P.rows[foc], tok, ph, true);
  c.restore();
  c.globalAlpha = a0;
  if (probe.probe.on) record(G, P, {...ui, level}, foc, dpr, F.shell ? "sh" : "c", verb, touchy);
}
