/* RECORDS PAGE (UI upgrade v202 Tasks 4.1 / 4.2; design record §4 RECORDS, §5; appendix 7.1 tabs, 7.3 pages; the round 7 S7-pages frames). One lazy module
   (pages/lazy.js "records") for the three tabs SCORES · STATS · MEDALS (SCREEN.SCORES / STATS / TROPHIES, ruling R7). The room of app.level dresses
   the stage: its room look (kit room.js, the layer MENU made when the box and level match, so a MENU <-> RECORDS trip never re-rasters it) opaque over
   the whole canvas, its rampart round the plate. recordsGeom(F) is the one geometry for draw and tap, the same for every tab so the strip never moves:
   G.d in design px (the mock's CSS px), u box units per design px. F = {W, H, touch, shell, css, ts}, as MENU's. Arrangements:
   desk   every keyboard box: the 1366 x 768 frame at u 1 (plate 980 wide, 1080 at 125 %): kicker MENU over the RECORDS title, the tabs in their wall
          trough, the pane (one height, the tallest tab's body), the foot under the plate; a smaller box scales the page as one piece (#c, the iso guard).
   phone  every touch box: the 393 x 852 column in CSS px (u = 1 / css, capped 600 CSS px and centred): a BACK key and the title, the tabs as three
          equal keys over the trough, the pane filling the plate; no foot. A body taller than its pane is scaled into it (k), floors giving way only there.
   Tabs are bricks in a wall trough: the open tab the world's brick standing 2 px up, the others floor wells. SCORES: the DIFFICULTY bank (the filter,
   R7: ←/→ and the shoulders in the body, a tap anywhere), the four badges (src/app/plaques.js bits CLEAR, PLUS, MAX, CROWN; earned = the medal outline
   tag, not yet = the lock tag) and the ten-slot table (RANK, SCORE, LEVEL, MODIFIERS as a count by words.js modsCount (R10; no modifier glyph exists in
   the kit, so the count stands alone), DATE); rows arrive with placeholders already dropped (main), so the table never reads a seeded row as a played
   run. MEDALS: eight sunk tiles, earned in the medal outline, the rest quiet goals. STATS: Task 4.2.
   Hits: tabHit -> 0..2 or -1; scoresHit -> a difficulty 0..2, -2 on the plate (inert), -1 off it or on the BACK key (main backs out).
   Cached (kit cache.js, recency touched on a steady frame): the room, one page layer per tab and its data (plate, header, the trough with every tab at
   rest, the pane, the body at rest), the feet (one per focus, made at once). Live: the open tab, the focus (bare bomb + the 3 px cream ring on the open
   tab or the chosen difficulty), SCORES' chosen difficulty and its rows. A tab step paints its own layer once; a focus move or a filter step paints none.
   With no canvas source (Node) everything paints straight onto the target over one flat fill; a context with no clip or rect gets the plan only.
   Under the probe the page records its rects, texts and squint pairs outside any layer paint. */
import {LABEL, DIFF, RECORD_TABS, REC_WORDS as RW, BADGE_NAMES, modsCount, noRunsYet, pickToSet} from "../words.js";
import {worldTokens, CONST, toL} from "../kit/tokens.js";
import {key, cap, capW, plate, focusBomb, wallCell} from "../kit/paint.js";
import {T, DEV, measure, textScale, nums} from "../kit/type.js";
import {layer, capDpr, touch, keyOf, canMake, BUDGET} from "../kit/cache.js";
import {roomLayer} from "../kit/room.js";
import * as probe from "../kit/probe.js";
import {_dbg as menuDbg} from "./menu.js";
import {deviceScale} from "../logo/draw2d.js";
import {hints, tapMode} from "../hintcopy.js";

const deep = (o) => { for (const v of Object.values(o)) if (v && typeof v === "object") deep(v); return Object.freeze(o); };
export const PAGES = Object.freeze(["scores", "stats", "medals"]);
export const DESK = deep({
  d: {w: 980, pad: [16, 24, 22, 24], tabW: 150, pane: [22, 30, 24, 30], foot: 24, bank: 130, kick: 150, row: 26},
  d125: {w: 1080, pad: [16, 24, 22, 24], tabW: 170, pane: [22, 30, 24, 30], foot: 24, bank: 150, kick: 180, row: 30},
});
export const PHONE = deep({
  p: {side: 12, top: 16, bot: 16, pad: [12, 10, 12, 10], back: 120, pane: [18, 8, 12, 8], max: 600, row: 28},
  p125: {side: 12, top: 16, bot: 16, pad: [12, 10, 12, 10], back: 140, pane: [14, 8, 12, 8], max: 600, row: 28},
});
export const TROUGH = 11, PANE_GAP = 10, FOOT_H = 54, GUT = 8, CAP_K = 0.705, TAB_GAP = 6, BANK_GAP = 4;
const big = (ts) => ts > 1.1;
const R = (x, y, w, h) => ({x, y, w, h});
const sc = (r, u) => (r ? {x: r.x * u, y: r.y * u, w: r.w * u, h: r.h * u} : null);
const inR = (r, x, y) => !!r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
const okBox = (F) => !!F && F.W > 0 && F.H > 0 && Number.isFinite(F.W) && Number.isFinite(F.H);

/* the bodies, laid out in a box iw wide at the device dv and text scale ts: design px relative to the body's top-left. SCORES: the DIFFICULTY kicker and
   bank stay at their size (they are touch targets); under them the badges and the table take the height left (avail), scaled by tk where they need
   more, the badges dropping first on a short touch box (tk under BADGE_K with them). row: the kicker left of the bank, else above it. */
export const BADGE_K = 0.8;
function scoresBody(dv, ts, iw, D, row, avail) {
  const kick = dv.sec * ts * 1.2, bh = dv.bkh + 6, x0 = row ? D.kick : 0, bw = row ? Math.min(iw - x0, 3 * D.bank + 2 * BANK_GAP + 6) : iw, y0 = row ? 0 : kick + 6;
  const bank = R(x0, y0, bw, bh), kw = (bw - 6 - 2 * BANK_GAP) / 3, keys = [0, 1, 2].map((i) => R(x0 + 3 + i * (kw + BANK_GAP), y0 + 3, kw, dv.bkh));
  const stack = iw < 520, top = y0 + bh, hh = Math.round(dv.sec * ts * 1.5), rp = stack ? Math.round(dv.pri * ts * 1.15 + dv.sec * ts * 1.2 + 8) : Math.max(D.row, Math.round(dv.pri * ts * 1.15)), tbl = hh + 10 * rp, bl = stack ? 2 : 1, bH = bl * dv.tg + (bl - 1) * 6, withB = 14 + bH + 14 + tbl;
  let badges = true, tk = 1;
  if (avail > 0 && top + withB > avail) { tk = (avail - top) / withB; if (tk < BADGE_K) { badges = false; tk = Math.min(1, (avail - top) / (14 + tbl)); } }
  const lw = iw / tk, by = 14, hy = badges ? by + bH + 14 : 14, at = (r) => R(r.x * tk, top + r.y * tk, r.w * tk, r.h * tk);
  return {kick: row ? R(0, 0, x0 - 12, bh) : R(0, 0, iw, kick), bank, keys, badges: badges ? at(R(0, by, lw, bH)) : null, bl, head: at(R(0, hy, lw, hh)), rp, stack, rows: at(R(0, hy + hh, lw, 10 * rp)), tk, top, h: top + (hy + tbl) * tk};
}
/* MEDALS: eight tiles, two columns from 640 wide (or on a short touch box, where two columns of three-line goals scale less than one column) */
function medalsBody(dv, ts, iw, cols = iw >= 640 ? 2 : 1, lines = 2) {
  const cnt = dv.sec * ts * 1.2, gap = cols > 1 ? 8 : 6, pad = 8, y0 = cnt + 8;
  const th = Math.round(2 * pad + dv.pri * ts * 1.15 + 4 + lines * dv.sec * ts * 1.2), tw = (iw - (cols - 1) * gap) / cols, n = 8 / cols;
  const tiles = Array.from({length: 8}, (_, i) => R((i % cols) * (tw + gap), y0 + Math.floor(i / cols) * (th + gap), tw, th));
  return {count: R(0, 0, iw, cnt), tiles, cols, pad, lines, h: y0 + n * th + (n - 1) * gap};
}
/* a body placed at (x, y) scaled by k: every rect in it made absolute; k, x, y the scaled region's scale and origin (SCORES: tk at the table's top) */
function place(b, x, y, k) {
  const out = {k, x, y};
  for (const [n, v] of Object.entries(b)) out[n] = Array.isArray(v) ? v.map((r) => (r && typeof r === "object" ? R(x + r.x * k, y + r.y * k, r.w * k, r.h * k) : r)) : v && typeof v === "object" && "w" in v ? R(x + v.x * k, y + v.y * k, v.w * k, v.h * k) : v;
  return out;
}
function bodiesAt(dv, ts, iw, D, row, bx, by, avail) {
  const out = {}, s = scoresBody(dv, ts, iw, D, row, avail);
  out.scores = place(s, bx, by, 1);
  Object.assign(out.scores, {k: s.tk, y: by + s.top});
  const opts = [[iw >= 640 ? 2 : 1, 2], ...(iw < 640 && iw >= 340 ? [[2, 3]] : [])].map(([cl, ln]) => {
    let m = medalsBody(dv, ts, iw, cl, ln), k = 1;
    if (avail > 0 && m.h > avail) { k = avail / m.h; m = medalsBody(dv, ts, iw / k, cl, ln); }
    return {m, k};
  });
  const best = opts.reduce((a, o) => (o.k > a.k + 1e-9 ? o : a));
  out.medals = place(best.m, bx, by, best.k);
  out.stats = {k: 1, x: bx, y: by, h: 0};
  return out;
}

function desk(F, t125) {
  const D = DESK[t125 ? "d125" : "d"], dv = DEV.d, ts = F.ts, T0 = dv.T, pw = D.w;
  const kick = dv.sec * ts * 1.2, ttl = dv.ttl * ts * 1.05, head = kick + 2 + ttl, tabsH = 2 + dv.bkh + TROUGH;
  const iw = pw - D.pad[1] - D.pad[3] - 4 - D.pane[1] - D.pane[3];
  const bh = Math.max(scoresBody(dv, ts, iw, D, true, 0).h, medalsBody(dv, ts, iw).h), paneH = 4 + D.pane[0] + bh + D.pane[2];
  const ph = D.pad[0] + head + 10 + tabsH + PANE_GAP + paneH + D.pad[2], block = ph + D.foot + FOOT_H;
  const side = T0 + 2 + GUT, u = Math.min(1, F.W / (pw + 2 * side), F.H / (block + 2 * side + 4));
  const Wd = F.W / u, Hd = F.H / u, px = (Wd - pw) / 2, py = Math.max(side, (Hd - block) / 2);
  const ix = px + D.pad[3], iwP = pw - D.pad[1] - D.pad[3], hy = py + D.pad[0], ty = hy + head + 10 + 2;
  const tabs = [0, 1, 2].map((i) => R(ix + i * (D.tabW + TAB_GAP), ty, D.tabW, dv.bkh));
  const pane = R(ix, ty + dv.bkh + TROUGH + PANE_GAP, iwP, paneH), bx = pane.x + 2 + D.pane[3], by = pane.y + 2 + D.pane[0];
  return {mode: "desk", dev: "d", u, t125, T: T0, plate: R(px, py, pw, ph), kick: R(ix, hy, iwP, kick), title: R(ix, hy + kick + 2, iwP, ttl), back: null,
    tabs, trough: R(ix, ty + dv.bkh, iwP, TROUGH), pane, body: R(bx, by, iw, bh), bodies: bodiesAt(dv, ts, iw, D, true, bx, by, 0), foot: R(px, py + ph + D.foot, pw, FOOT_H)};
}
/* every touch box, in CSS px (u = 1 / css, or less where the frame itself does not fit). phone (a touch-portrait shell box): BACK and the title, the tabs
   across under them. compact (any other touch box, the landscape phones' #c included): one header row, BACK, the title where it fits (else it drops: the
   open tab names the page), the tabs; the plate at most the desk's 980 wide, centred */
const TITLE_W = 150, TAB_MIN = 96;
function touchFrame(F, t125) {
  const P = PHONE[t125 ? "p125" : "p"], dv = DEV.p, ts = F.ts, css = F.css > 0 ? F.css : 1, T0 = dv.T, tall = !!F.shell && F.H > F.W * 1.3;
  const head = tall ? dv.keyh + 12 + 2 + dv.bkh : dv.keyh;
  const fixed = P.top + P.pad[0] + head + TROUGH + PANE_GAP + 4 + P.pane[0] + P.pane[2] + P.pad[2] + P.bot, minBody = tall ? 120 : 90;
  const u = Math.min(1 / css, F.H / (fixed + minBody)), Wd = F.W / u, Hd = F.H / u;
  const pw = Math.min(Wd - 2 * P.side, tall ? P.max : DESK.d.w), px = (Wd - pw) / 2, py = P.top, ph = Hd - P.top - P.bot;
  const ix = px + P.pad[3], iwP = pw - P.pad[1] - P.pad[3], hy = py + P.pad[0];
  let tabs, title = null, back = R(ix, hy, P.back, dv.keyh);
  if (tall) {
    const ty = hy + dv.keyh + 12 + 2, tw = (iwP - 2 * TAB_GAP) / 3;
    tabs = [0, 1, 2].map((i) => R(ix + i * (tw + TAB_GAP), ty, tw, dv.bkh));
    title = R(ix + P.back + 14, hy, iwP - P.back - 14, dv.keyh);
  } else {
    /* a tab must hold its longest word (6 letters, at a generous 0.66 em); where three would not beside BACK, BACK steps down to its chevron alone */
    const need = 6 * 0.66 * dv.pri * ts + 16, fit3 = (bw) => (iwP - bw - 12 - 2 * TAB_GAP) / 3;
    if (fit3(P.back) < need) back = R(ix, hy, dv.keyh, dv.keyh);
    const room = iwP - back.w - 12, withT = (room - TITLE_W - 12 - 2 * TAB_GAP) / 3, tw = Math.min(DESK.d.tabW, withT >= TAB_MIN ? withT : (room - 2 * TAB_GAP) / 3), x0 = ix + iwP - 3 * tw - 2 * TAB_GAP;
    tabs = [0, 1, 2].map((i) => R(x0 + i * (tw + TAB_GAP), hy + dv.keyh - dv.bkh, tw, dv.bkh));
    if (withT >= TAB_MIN) title = R(ix + back.w + 14, hy, x0 - 12 - (ix + back.w + 14), dv.keyh);
  }
  const tb = tabs[0].y + dv.bkh, tx = tall ? ix : tabs[0].x, trough = R(tx, tb, ix + iwP - tx, TROUGH);
  const pane = R(ix, tb + TROUGH + PANE_GAP, iwP, py + ph - P.pad[2] - (tb + TROUGH + PANE_GAP));
  const iw = pane.w - 4 - P.pane[1] - P.pane[3], bh = pane.h - 4 - P.pane[0] - P.pane[2], bx = pane.x + 2 + P.pane[3], by = pane.y + 2 + P.pane[0];
  return {mode: tall ? "phone" : "compact", dev: "p", u, t125, T: T0, plate: R(px, py, pw, ph), kick: null, title, back, tabs, trough, pane, body: R(bx, by, iw, bh),
    bodies: bodiesAt(dv, ts, iw, {...P, kick: DESK.d.kick, bank: DESK.d.bank}, iw >= 520, bx, by, bh), foot: null};
}
let gm = null;
/** The one geometry for draw and tap; see the header. */
export function recordsGeom(F) {
  const ts = F.ts > 0 ? F.ts : textScale(), t125 = big(ts), touchy = !!F.touch, css = F.css > 0 ? F.css : 1;
  if (gm && gm.W === F.W && gm.H === F.H && gm.touch === touchy && gm.ts === ts && gm.css === css) return gm.G;
  const d = touchy ? touchFrame({...F, ts}, t125) : desk({...F, ts}, t125), u = d.u;
  const G = {mode: d.mode, dev: d.dev, u, t125, ts, W: F.W, H: F.H, d, T: d.T * u, plate: sc(d.plate, u), tabs: d.tabs.map((r) => sc(r, u)), back: sc(d.back, u), foot: sc(d.foot, u), keys: d.bodies.scores.keys.map((r) => sc(r, u)), pane: sc(d.pane, u)};
  gm = {W: F.W, H: F.H, touch: touchy, ts, css, G: deep(G)};
  return gm.G;
}
/* box -> design px */
const toD = (G, x, y) => [x / G.u, y / G.u];
/** The RECORDS tab under (x, y) on the box, else -1. */
export function tabHit(x, y, F) {
  if (!okBox(F)) return -1;
  const G = recordsGeom(F), [dx, dy] = toD(G, x, y);
  for (let i = 0; i < 3; i++) { const r = G.d.tabs[i]; if (inR(R(r.x - (i ? TAB_GAP / 2 : 0), r.y - 4, r.w + (i ? TAB_GAP / 2 : 0) + (i < 2 ? TAB_GAP / 2 : 0), r.h + 4 + TROUGH), dx, dy)) return i; }
  return -1;
}
const onPlate = (G, dx, dy) => inR(G.d.plate, dx, dy);
/** SCORES: the difficulty under (x, y); -2 on the plate (inert), -1 off it or on the BACK key (main backs out). */
export function scoresHit(x, y, F) {
  if (!okBox(F)) return -1;
  const G = recordsGeom(F), [dx, dy] = toD(G, x, y), b = G.d.bodies.scores;
  if (inR(G.d.back, dx, dy)) return -1;
  for (let i = 0; i < 3; i++) { const r = b.keys[i]; if (inR(R(r.x - BANK_GAP / 2, b.bank.y, r.w + BANK_GAP, b.bank.h), dx, dy)) return i; }
  return onPlate(G, dx, dy) ? -2 : -1;
}
/** MEDALS and any page with no body hit: -2 on the plate, -1 off it or on the BACK key. */
export function plateHit(x, y, F) {
  if (!okBox(F)) return -1;
  const G = recordsGeom(F), [dx, dy] = toD(G, x, y);
  return inR(G.d.back, dx, dy) ? -1 : onPlate(G, dx, dy) ? -2 : -1;
}

/* measuring: a context that cannot measure plans on a 0.6 em estimate */
const EST = {font: "", measureText(s) { const m = /(\d+(?:\.\d+)?)px/.exec(this.font); return {width: String(s).length * 0.6 * (m ? +m[1] : 10)}; }};
const mOK = new WeakMap(), mOf = (c) => {
  if (!c || (typeof c !== "object" && typeof c !== "function")) return EST;
  let v = mOK.get(c);
  if (v === undefined) { const m = typeof c.measureText === "function" ? c.measureText("M") : null; mOK.set(c, (v = !!m && typeof m.width === "number")); }
  return v ? c : EST;
};
const W = (c, f, s) => measure(c, f, s);
const sep3 = (n) => String(n | 0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
/* fit: the first candidate that fits room, else "" (a word steps down or drops, never clipped) */
const fit = (c, f, cands, room) => { for (const s of cands) if (s === "" || W(c, f, s) <= room) return s; return ""; };
/* words wrapped at spaces into at most n lines of room; null when they need more */
function wrap(c, f, s, room, n) {
  const out = [];
  let cur = "";
  for (const w of String(s).split(" ")) { const t = cur ? cur + " " + w : w; if (!cur || W(c, f, t) <= room) cur = t; else { out.push(cur); cur = w; } }
  if (cur) out.push(cur);
  return out.length <= n && out.every((l) => W(c, f, l) <= room) ? out : null;
}

/* the SCORES table plan: columns placed left to right with a gap; each level steps a column down (MODIFIERS to the bare count, DATE to the month
   and day, then DATE drops) until the table fits the body's width */
function tablePlan(c, G, b, list, ts) {
  const dv = DEV[G.dev], fS = T.label(dv.sec), fP = T.num(dv.pri), gap = G.dev === "p" ? 12 : 28, rows = list.slice(0, 10), room = b.rows.w / b.k;
  const mods = (r, l) => { const s = modsCount(r.p | 0); return !s ? RW.NONE : l >= 1 ? String(s.split(" ")[0]) : s; };
  const date = (r, l) => (l >= 2 ? String(r.d || "").slice(5) : String(r.d || ""));
  if (b.stack) { /* a narrow table: RANK, SCORE, LEVEL on the row's first line; its modifiers (named: NO MODIFIERS for none) and date under the score */
    const cols = [
      {n: RW.RANK, cells: rows.map((_, i) => String(i + 1)), f: fS, num: true},
      {n: RW.SCORE, cells: rows.map((r) => sep3(r.s)), f: fP, num: true, right: true},
      {n: LABEL.LEVEL, cells: rows.map((r) => String(r.l | 0)), f: fP, num: true},
    ];
    for (const k of cols) k.w = Math.max(W(c, fS, k.n), ...k.cells.map((s) => nW(c, k.f, s)), 0);
    let x = 0;
    for (const k of cols) { k.x = x; x += k.w + gap; }
    const l2x = cols[1].x, l2 = rows.map((r) => { const m = modsCount(r.p | 0) || RW.NO_MODS; return fit(c, fS, [m + " · " + date(r, 0), m + " · " + date(r, 2), m], room - l2x); });
    return {cols, fS, fP, level: 0, stack: true, l2, l2x, fits: x - gap <= room + 1e-6 && l2.every(Boolean)};
  }
  for (let l = 0; l < 4; l++) {
    const cols = [
      {n: RW.RANK, cells: rows.map((_, i) => String(i + 1)), f: fS, num: true},
      {n: RW.SCORE, cells: rows.map((r) => sep3(r.s)), f: fP, num: true, right: true},
      {n: LABEL.LEVEL, cells: rows.map((r) => String(r.l | 0)), f: fP, num: true},
      {n: LABEL.MODIFIERS, cells: rows.map((r) => mods(r, l)), f: fS},
      ...(l < 3 ? [{n: RW.DATE, cells: rows.map((r) => date(r, l)), f: fS}] : []),
    ];
    for (const k of cols) k.w = Math.max(W(c, fS, k.n), ...k.cells.map((s) => (k.num ? nW(c, k.f, s) : W(c, k.f, s))), 0);
    const tot = cols.reduce((a, k) => a + k.w, 0) + gap * (cols.length - 1);
    if (tot <= b.rows.w / b.k + 1e-6 || l === 3) {
      let x = 0;
      const extra = Math.max(0, b.rows.w / b.k - tot) / Math.max(1, cols.length - 1);
      for (const k of cols) { k.x = x; x += k.w + gap + Math.min(extra, gap * 3); }
      return {cols, fS, fP, level: l, fits: tot <= b.rows.w / b.k + 1e-6};
    }
  }
  return null;
}
/* a stacked row's two lines: their centres below the row's top */
const rowY1 = (dv, ts) => 4 + (dv.pri * ts * 1.15) / 2, rowY2 = (dv, ts) => 4 + dv.pri * ts * 1.15 + (dv.sec * ts * 1.2) / 2;
/* nums' width without drawing: every digit takes the widest digit's cell */
function nW(c, f, s) {
  let cell = 0;
  for (const d of "0123456789") cell = Math.max(cell, W(c, f, d));
  return [...String(s)].reduce((a, q) => a + ("0123456789".includes(q) ? cell : W(c, f, q)), 0);
}

/** The page plan for one frame's data: words, fits and positions measured once (memoized by the caller). */
export function plan(c0, G, ui) {
  const c = mOf(c0), d = G.d, dv = DEV[G.dev], ts = G.ts, out = {};
  out.title = {s: LABEL.RECORDS, px: G.dev === "p" ? 28 : dv.ttl};
  const tf = T.label(dv.pri);
  /* the focus bomb sits inside a key only where the legend still fits beside it (else the ring alone marks the focus) */
  const fitsBomb = (r, w) => r.w >= w + dv.bombs + 6 + 16;
  out.tabs = RECORD_TABS.map((s, i) => { const w = W(c, tf, s); return {s, w, r: d.tabs[i], bomb: fitsBomb(d.tabs[i], w)}; });
  if (ui.page === "scores") {
    const b = d.bodies.scores, h = Math.max(0, Math.min(2, ui.heat | 0)), list = Array.isArray(ui.scores) ? ui.scores : [];
    const bf = T.label(dv.sec), room = b.badges ? b.badges.w / b.k : 0, lay = (x0) => { /* the four tags left to right from x0, a new line at x0 where one would pass the row (bl lines at most) */
      const out = [];
      let x = x0, ln = 0;
      for (let i = 0; i < 4; i++) {
        const w = 8 + 16 + 6 + W(c, bf, BADGE_NAMES[i]) + 10;
        if (x > x0 && x + w > room) { x = x0; ln++; }
        out.push({s: BADGE_NAMES[i], on: !!(((ui.plaques | 0) >> i) & 1), x, w, ln});
        x += w + 8;
      }
      return out.every((t) => t.ln < b.bl && t.x + t.w <= room + 1e-6) ? out : null;
    };
    const lab = W(c, bf, RW.BADGES) + 14, badges = lay(lab) || lay(0) || [];
    out.scores = {h, bank: DIFF.slice(), bomb: d.bodies.scores.keys.map((r, i) => fitsBomb(r, W(c, tf, DIFF[i]))), badges, bf, label: badges.length && badges[0].x > 0, table: list.length ? tablePlan(c, G, b, list, ts) : null, n: Math.min(10, list.length),
      empty: list.length ? null : [fit(c, T.label(dv.pri), [noRunsYet(h), "NO RUNS YET"], b.rows.w / b.k), fit(c, T.body(dv.bod), [pickToSet(h), ""], b.rows.w / b.k)]};
  }
  if (ui.page === "medals") {
    const b = d.bodies.medals, rows = Array.isArray(ui.rows) ? ui.rows : [], nf = T.label(dv.pri), df = T.label(dv.sec), gl = Math.round(dv.pri * 1.4);
    const tiles = Array.from({length: 8}, (_, i) => {
      const [name, desc, on] = rows[i] || [RW.NONE, "", false], r = b.tiles[i], room = r.w / b.k - 2 * b.pad - gl - 12;
      return {name: String(name), on: !!on, desc: wrap(c, df, String(desc), room, b.lines) || wrap(c, df, String(desc), room, b.lines + 1) || [String(desc)], gl};
    });
    out.medals = {tiles, n: tiles.filter((t) => t.on).length, nf, df};
  }
  return out;
}

/* ---------- painters ---------- */
const sp = (c, x, y, w, h, r) => { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const rf = (c, x, y, w, h, r, col) => { c.fillStyle = col; c.beginPath(); sp(c, x, y, w, h, r); c.fill(); };
function text(c, s, x, y, f, col, align) { c.font = f; c.fillStyle = col; c.textAlign = align || "left"; c.textBaseline = "middle"; c.fillText(s, x, y); }
/* the page's own icons on the appendix 4.1 16-unit grid (medal, lock, back, the four arrow legends) */
function ic(c, n, x, y, s, col) {
  c.save(); c.translate(x, y); c.scale(s / 16, s / 16);
  c.strokeStyle = c.fillStyle = col; c.lineCap = c.lineJoin = "round"; c.beginPath();
  if (n === "medal") { c.lineWidth = 2.6; c.moveTo(5, 1); c.lineTo(11, 1); c.lineTo(15, 5); c.lineTo(15, 11); c.lineTo(11, 15); c.lineTo(5, 15); c.lineTo(1, 11); c.lineTo(1, 5); c.closePath(); c.stroke(); }
  else if (n === "dot") { c.arc(8, 8, 3, 0, Math.PI * 2); c.fill(); }
  else if (n === "lock") { c.lineWidth = 2; c.moveTo(4.5, 7); c.lineTo(4.5, 5); c.arc(8, 5, 3.5, Math.PI, 0); c.lineTo(11.5, 7); c.stroke(); c.beginPath(); c.rect(3, 7, 10, 7.5); c.fill(); }
  else if (n === "back") { c.lineWidth = 2.6; c.moveTo(10, 3); c.lineTo(5, 8); c.lineTo(10, 13); c.stroke(); }
  else { const P = {up: [3, 11, 8, 5, 13, 11], dn: [3, 5, 8, 11, 13, 5], lf: [11, 3, 5, 8, 11, 13], rt: [5, 3, 11, 8, 5, 13]}[n]; if (P) { c.moveTo(P[0], P[1]); c.lineTo(P[2], P[3]); c.lineTo(P[4], P[5]); c.closePath(); c.fill(); } }
  c.restore();
}
/* earned: the medal outline and its dot in the medal colour; a goal not yet earned: the outline in t2 with a small lock inside */
function medalGlyph(c, x, y, s, on) { ic(c, "medal", x, y, s, on ? CONST.medal : CONST.t2); if (on) ic(c, "dot", x, y, s, CONST.medal); else ic(c, "lock", x + s * 0.25, y + s * 0.22, s * 0.5, CONST.t2); }
function trough(c, r, tok) {
  rf(c, r.x, r.y, r.w, r.h, 3, CONST.ol);
  c.save(); c.beginPath(); c.rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4); c.clip();
  c.fillStyle = tok.well; c.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
  for (let u = 0; u < r.w - 4; u += r.h - 4) wallCell(c, r.x + 2 + u, r.y + 2, r.h - 4, tok, {code: 1, veil: true});
  c.restore();
}
function pane(c, r, tok) {
  rf(c, r.x, r.y, r.w, r.h, 6, CONST.ol);
  c.save(); c.beginPath(); c.rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4); c.clip();
  c.fillStyle = tok.pane; c.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4); c.fillStyle = "rgba(0,0,0,0.4)"; c.fillRect(r.x + 2, r.y + 2, r.w - 4, 3);
  c.restore();
}
/* a tag (appendix 4): 2 px outline in its colour on the dark chip, a glyph, the word */
function tag(c, x, y, w, h, s, f, col, glyph, on) {
  rf(c, x, y, w, h, 4, col); rf(c, x + 2, y + 2, w - 4, h - 4, 3, CONST.ol);
  if (glyph === "medal") medalGlyph(c, x + 8, y + h / 2 - 8, 16, on); else ic(c, "lock", x + 8, y + h / 2 - 8, 16, col);
  text(c, s, x + 8 + 16 + 6, y + h / 2, f, col);
}
/* the static page: plate, header, the trough with every tab at rest, the pane, the body at rest */
function paintPage(c, G, P, ui, tok) {
  const d = G.d, ph = G.dev === "p", dv = DEV[G.dev];
  plate(c, d.plate.x, d.plate.y, d.plate.w, d.plate.h, tok, {phone: ph});
  if (d.kick) text(c, RW.MENU, d.kick.x, d.kick.y + d.kick.h / 2, T.label(dv.sec), CONST.t2);
  if (d.back) { key(c, d.back.x, d.back.y, d.back.w, d.back.h, "key", {tok}); ic(c, "back", d.back.x + (d.back.w > 60 ? 14 : (d.back.w - 16) / 2), d.back.y + d.back.h / 2 - 8, 16, CONST.ink); if (d.back.w > 60) text(c, RW.BACK, d.back.x + 40, d.back.y + d.back.h / 2, T.label(dv.pri), CONST.ink); }
  if (d.title) dspText(c, P.title.s, d.title.x, d.title.y + d.title.h / 2, P.title.px);
  trough(c, d.trough, tok);
  for (const t of P.tabs) key(c, t.r.x, t.r.y, t.r.w, t.r.h, "well", {tok, label: t.s, phone: ph});
  pane(c, d.pane, tok);
  if (ui.page === "scores") scoresStatic(c, G, P, tok);
  if (ui.page === "medals") medalsStatic(c, G, P, tok);
}
function dspText(c, s, x, y, px) {
  const font = T.display(px), em = px * textScale();
  c.font = font; c.textAlign = "left"; c.textBaseline = "middle"; c.lineJoin = "round"; c.lineWidth = em * 0.12; c.strokeStyle = CONST.ol; c.fillStyle = CONST.ol;
  c.strokeText(s, x, y + em * 0.08); c.fillText(s, x, y + em * 0.08); c.strokeText(s, x, y);
  c.fillStyle = CONST.ink; c.fillText(s, x, y);
}
function scoresStatic(c, G, P, tok) {
  const b = G.d.bodies.scores, S = P.scores, dv = DEV[G.dev], k = b.k, ph = G.dev === "p", kr = b.kick, br = b.bank;
  text(c, LABEL.DIFFICULTY, kr.x, kr.y + kr.h / 2, T.label(dv.sec), CONST.t2);
  rf(c, br.x, br.y, br.w, br.h, 8, CONST.ol);
  b.keys.forEach((r, i) => key(c, r.x, r.y, r.w, r.h, "well", {tok, label: S.bank[i], phone: ph}));
  if (!b.badges) return;
  c.save(); c.translate(b.x, b.y); c.scale(k, k); c.translate(-b.x, -b.y);
  const gr = R(b.x + (b.badges.x - b.x) / k, b.y + (b.badges.y - b.y) / k, b.badges.w / k, b.badges.h / k);
  const th = (gr.h - (b.bl - 1) * 6) / b.bl;
  if (S.label) text(c, RW.BADGES, gr.x, gr.y + th / 2, S.bf, CONST.t2);
  for (const t of S.badges) tag(c, gr.x + t.x, gr.y + t.ln * (th + 6), t.w, th, t.s, S.bf, t.on ? CONST.medal : CONST.off, t.on ? "medal" : "lock", t.on);
  c.restore();
}
function scoresLive(c, G, P, ui, tok, foc) {
  const b = G.d.bodies.scores, S = P.scores, dv = DEV[G.dev], k = b.k, ph = G.dev === "p", r = b.keys[S.h];
  key(c, r.x, r.y, r.w, r.h, "lit", {tok, label: S.bank[S.h], phone: ph, ring: foc, bomb: foc && S.bomb[S.h]});
  c.save(); c.translate(b.x, b.y); c.scale(k, k); c.translate(-b.x, -b.y);
  const rr = R(b.x, b.y + (b.rows.y - b.y) / k, b.rows.w / k, b.rows.h / k), rp = b.rp;
  if (S.empty) {
    text(c, S.empty[0], rr.x + rr.w / 2, rr.y + rp * 3, T.label(dv.pri), CONST.ink, "center");
    if (S.empty[1]) text(c, S.empty[1], rr.x + rr.w / 2, rr.y + rp * 4.2, T.body(dv.bod), CONST.t2, "center");
  } else if (S.table) {
    const tp = S.table, hr = R(b.x, b.y + (b.head.y - b.y) / k, b.head.w / k, b.head.h / k);
    for (const col of tp.cols) text(c, col.n, col.right ? hr.x + col.x + col.w : hr.x + col.x, hr.y + hr.h / 2, tp.fS, CONST.t2, col.right ? "right" : "left");
    c.fillStyle = CONST.ol; c.fillRect(hr.x, hr.y + hr.h - 2, hr.w, 2);
    for (let i = 0; i < S.n; i++) {
      const y = rr.y + rp * (i + 0.5);
      if (i % 2 === 0) { c.fillStyle = tok.well; c.fillRect(rr.x - 8, y - rp / 2, rr.w + 16, rp); }
      tp.cols.forEach((col) => {
        const s = col.cells[i], x = rr.x + col.x + (col.right ? col.w : 0), ink = col.n === RW.RANK || col.n === RW.DATE ? CONST.t2 : CONST.ink, yy = tp.stack ? y - rp / 2 + rowY1(dv, G.ts) : y;
        if (col.num) nums(c, s, x, yy, col.f === tp.fP ? dv.pri : dv.sec, {col: ink, align: col.right ? "right" : "left"});
        else text(c, s, x, yy, col.f, s === RW.NONE ? CONST.t2 : ink);
      });
      if (tp.stack) text(c, tp.l2[i], rr.x + tp.l2x, y - rp / 2 + rowY2(dv, G.ts), tp.fS, CONST.t2);
    }
  }
  c.restore();
}
function medalsStatic(c, G, P, tok) {
  const b = G.d.bodies.medals, M = P.medals, dv = DEV[G.dev], k = b.k;
  c.save(); c.translate(b.x, b.y); c.scale(k, k); c.translate(-b.x, -b.y);
  const L = (r) => R(b.x + (r.x - b.x) / k, b.y + (r.y - b.y) / k, r.w / k, r.h / k), cr = L(b.count);
  const cw = nums(c, M.n + "/8", cr.x, cr.y + cr.h / 2, dv.sec, {col: CONST.ink});
  text(c, RW.EARNED, cr.x + cw + 8, cr.y + cr.h / 2, T.label(dv.sec), CONST.t2);
  M.tiles.forEach((t, i) => {
    const r = L(b.tiles[i]), x0 = r.x + b.pad, gl = t.gl, tx = x0 + gl + 12, ny = r.y + b.pad + dv.pri * G.ts * 0.575;
    key(c, r.x, r.y, r.w, r.h, "well", {tok});
    medalGlyph(c, x0, r.y + b.pad + 2, gl, t.on);
    text(c, t.name, tx, ny, M.nf, t.on ? CONST.ink : CONST.t2);
    t.desc.forEach((l, j) => text(c, l, tx, ny + dv.pri * G.ts * 0.575 + 4 + dv.sec * G.ts * 1.2 * (j + 0.5), M.df, CONST.t2));
  });
  c.restore();
}

/* ---------- the foot (desk): label first, keycap last ---------- */
export function footItems(page, foc, words) {
  const pad = words.dev === "pad", A = (n) => [n];
  if (pad) return page === "scores" && foc === "body" ? [{t: LABEL.DIFFICULTY, caps: [words.move]}, {t: RW.BACK, caps: [words.back]}] : [{t: RW.TAB, caps: [words.move]}, {t: RW.BACK, caps: [words.back]}];
  if (page === "scores") return foc === "body" ? [{t: LABEL.DIFFICULTY, caps: [A("lf"), A("rt")]}, {t: RW.TAB, caps: ["Q", "E"]}, {t: RW.BACK, caps: [words.back]}]
    : [{t: RW.TAB, caps: [A("lf"), A("rt")]}, {t: LABEL.DIFFICULTY, caps: [A("dn")]}, {t: RW.BACK, caps: [words.back]}];
  return [{t: RW.TAB, caps: [A("lf"), A("rt")]}, {t: RW.BACK, caps: [words.back]}];
}
function footPlan(c, G, items) {
  const d = G.d, dv = DEV.d, f = T.label(dv.sec), parts = [];
  items.forEach((it, i) => {
    if (i) parts.push({sep: "·", w: W(c, f, "·")});
    parts.push({t: it.t, w: W(c, f, it.t)});
    (it.caps || []).forEach((q, j) => parts.push({cap: q, w: Array.isArray(q) ? dv.capw : capW(c, q), gap: j ? 5 : 8}));
  });
  let w = 0;
  parts.forEach((p, i) => { w += (i ? (p.cap ? p.gap : 12) : 0) + p.w; });
  const fw = w + 36, x = d.plate.x + d.plate.w / 2 - fw / 2;
  let cx = x + 18;
  parts.forEach((p, i) => { cx += i ? (p.cap ? p.gap : 12) : 0; p.x = cx; cx += p.w; });
  return {x, y: d.foot.y, w: fw, h: FOOT_H, f, px: dv.sec, parts, mid: d.foot.y + FOOT_H / 2};
}
const canCap = (c) => mOf(c) === c;
function paintFoot(c, P, tok) {
  const {x, y, w, h} = P;
  rf(c, x, y + 4, w, h, 8, CONST.ol); rf(c, x, y, w, h, 8, CONST.ol); rf(c, x + 2, y + 2, w - 4, h - 4, 6, tok.bed);
  c.fillStyle = tok.keyhi; c.fillRect(x + 6, y + 2, w - 12, 2);
  for (const p of P.parts) {
    if (p.sep) text(c, p.sep, p.x, P.mid, P.f, CONST.off);
    else if (p.cap) {
      const cy = P.mid - DEV.d.caph / 2;
      if (Array.isArray(p.cap)) { key(c, p.x, cy, p.w, DEV.d.caph, "key", {tok}); ic(c, p.cap[0], p.x + (p.w - 13) / 2, cy + (DEV.d.caph - 13) / 2, 13, CONST.t2); }
      else if (canCap(c)) cap(c, p.x, cy, p.cap, {tok});
    } else text(c, p.t, p.x, P.mid, P.f, CONST.t2);
  }
}

/* ---------- probe ---------- */
function record(G, P, ui, foc, dpr, el, F0, tok, touchy) {
  const u = G.u, d = G.d, dv = DEV[G.dev], ts = G.ts, b = (r) => [r.x * u, r.y * u, r.w * u, r.h * u], page = ui.page, pi = PAGES.indexOf(page);
  probe.begin("records." + page, {w: G.W, h: G.H, dpr, el});
  probe.rect("plate", ...b(d.plate), {plate: G.T});
  const txt = (s, x, y, w, px, col, role, o = {}) => { if (s && w > 0) probe.text(s, x * u, (y - px * ts * CAP_K / 2) * u, w * u, px * ts * CAP_K * u, {role, col, px: px * ts * u, ...o}); };
  if (d.back) { probe.rect(RW.BACK, ...b(d.back), {touch: touchy, set: "head", fill: tok.key}); const gx = d.back.x + (d.back.w > 60 ? 14 : (d.back.w - 16) / 2); if (d.back.w > 60) txt(RW.BACK, d.back.x + 40, d.back.y + d.back.h / 2, measureOr(RW.BACK, dv.pri), dv.pri, CONST.ink, "primary"); probe.pair("info", b(R(gx, d.back.y + d.back.h / 2 - 8, 16, 16)), b(R(gx - 6, d.back.y + 8, 28, d.back.h - 16)), {col: CONST.ink, name: "back chevron"}); }
  if (d.kick) txt(RW.MENU, d.kick.x, d.kick.y + d.kick.h / 2, measureOr(RW.MENU, dv.sec), dv.sec, CONST.t2, "secondary");
  if (d.title) txt(P.title.s, d.title.x, d.title.y + d.title.h / 2, measureOr(P.title.s, P.title.px, true), P.title.px, CONST.ink, "primary");
  P.tabs.forEach((t, i) => {
    const on = i === pi, r = on ? R(t.r.x, t.r.y - 2, t.r.w, t.r.h) : t.r;
    probe.rect("tab " + t.s, ...b(r), {touch: touchy, set: "tabs", kind: "tab", focus: on && foc === "tabs", fill: on ? tok.lit : tok.well});
    txt(t.s, r.x + r.w / 2 - t.w / 2 + (on && foc === "tabs" && t.bomb ? (dv.bombs + 6) / 2 : 0), r.y + r.h / 2, t.w, dv.pri, on ? CONST.dk : CONST.t2, "primary");
  });
  const on = P.tabs[pi].r, off = P.tabs[pi === 0 ? 1 : 0].r;
  /* a squint pair samples the face beside the legend (the right end of each key), so a bigger legend at 125 % never stands in for the face */
  const face = (r, lift) => R(r.x + r.w - 26, r.y + 4 - lift, 20, r.h - 10);
  probe.pair("chosen", b(face(on, 2)), b(face(off, 0)), {name: "open tab vs not"});
  let fr = null;
  if (foc === "tabs") fr = R(on.x, on.y - 2, on.w, on.h);
  if (page === "scores") {
    const B = d.bodies.scores, S = P.scores, k = B.k;
    B.keys.forEach((r, i) => { const ch = i === S.h, rr = ch ? R(r.x, r.y - 2, r.w, r.h) : r; probe.rect("difficulty " + S.bank[i], ...b(rr), {touch: touchy, set: "filter", kind: "bank", focus: ch && foc === "body", fill: ch ? tok.lit : tok.well}); txt(S.bank[i], rr.x + rr.w / 2 - measureOr(S.bank[i], dv.pri) / 2 + (ch && foc === "body" && S.bomb[i] ? (dv.bombs + 6) / 2 : 0), rr.y + rr.h / 2, measureOr(S.bank[i], dv.pri), dv.pri, ch ? CONST.dk : CONST.t2, "primary"); });
    const kc = B.keys[S.h], ko = B.keys[(S.h + 1) % 3];
    probe.pair("chosen", b(R(kc.x + kc.w - 20, kc.y + 2, 14, kc.h - 10)), b(R(ko.x + ko.w - 20, ko.y + 4, 14, ko.h - 10)), {name: "chosen difficulty vs not"});
    if (foc === "body") fr = R(kc.x, kc.y - 2, kc.w, kc.h);
    txt(LABEL.DIFFICULTY, B.kick.x, B.kick.y + B.kick.h / 2, measureOr(LABEL.DIFFICULTY, dv.sec), dv.sec, CONST.t2, "secondary");
    const th = B.badges ? (B.badges.h - (B.bl - 1) * 6 * k) / B.bl : 0;
    if (B.badges && S.label) txt(RW.BADGES, B.badges.x, B.badges.y + th / 2, measureOr(RW.BADGES, dv.sec) * k, dv.sec * k, CONST.t2, "secondary");
    if (B.badges) for (const t of S.badges) {
      const x = B.badges.x + t.x * k, y = B.badges.y + t.ln * (th + 6 * k), col = t.on ? CONST.medal : CONST.off;
      txt(t.s, x + 30 * k, y + th / 2, measureOr(t.s, dv.sec) * k, dv.sec * k, col, "secondary", t.on ? {} : {lock: true});
      probe.pair("info", b(R(x + 8 * k, y + th / 2 - 8 * k, 16 * k, 16 * k)), b(R(x + 4 * k, y + 4 * k, 24 * k, th - 8 * k)), {col, name: "badge " + t.s, ...(t.on ? {} : {lock: true})});
    }
    const rr = B.rows, rp = B.rp * k;
    if (S.empty) S.empty.forEach((s, j) => { if (!s) return; const w = (j ? W(MC, T.body(dv.bod), s) : measureOr(s, dv.pri)) * k; txt(s, rr.x + rr.w / 2 - w / 2, rr.y + rp * (j ? 4.2 : 3), w, (j ? dv.bod : dv.pri) * k, j ? CONST.t2 : CONST.ink, j ? "body" : "primary"); });
    else if (S.table) {
      const tp = S.table;
      for (const col of tp.cols) { const w = measureOr(col.n, dv.sec) * k, x = rr.x + (col.x + (col.right ? col.w : 0)) * k - (col.right ? w : 0); txt(col.n, x, B.head.y + B.head.h / 2, w, dv.sec * k, CONST.t2, "secondary"); }
      for (let i = 0; i < S.n; i++) {
        for (const col of tp.cols) {
          const s = col.cells[i], px = col.f === tp.fP ? dv.pri : dv.sec, w = (col.num ? nWOr(s, px) : measureOr(s, px)) * k, x = rr.x + (col.x + (col.right ? col.w : 0)) * k - (col.right ? w : 0);
          txt(s, x, rr.y + (tp.stack ? rp * i + rowY1(dv, ts) * k : rp * (i + 0.5)), w, px * k, col.n === RW.RANK || col.n === RW.DATE || s === RW.NONE ? CONST.t2 : CONST.ink, px === dv.pri ? "primary" : "secondary");
        }
        if (tp.stack) txt(tp.l2[i], rr.x + tp.l2x * k, rr.y + rp * i + rowY2(dv, ts) * k, measureOr(tp.l2[i], dv.sec) * k, dv.sec * k, CONST.t2, "secondary");
      }
    }
  }
  if (page === "medals") {
    const B = d.bodies.medals, M = P.medals, k = B.k;
    txt(M.n + "/8", B.count.x, B.count.y + B.count.h / 2, nWOr(M.n + "/8", dv.sec) * k, dv.sec * k, CONST.ink, "secondary");
    txt(RW.EARNED, B.count.x + nWOr(M.n + "/8", dv.sec) * k + 8 * k, B.count.y + B.count.h / 2, measureOr(RW.EARNED, dv.sec) * k, dv.sec * k, CONST.t2, "secondary");
    M.tiles.forEach((t, i) => {
      const r = B.tiles[i], x0 = r.x + B.pad * k, tx = x0 + (t.gl + 12) * k, ny = r.y + (B.pad + dv.pri * ts * 0.575) * k;
      probe.rect("medal " + t.name, ...b(r), {fill: tok.well});
      txt(t.name, tx, ny, measureOr(t.name, dv.pri) * k, dv.pri * k, t.on ? CONST.ink : CONST.t2, "primary");
      t.desc.forEach((l, j) => txt(l, tx, ny + (dv.pri * ts * 0.575 + 4 + dv.sec * ts * 1.2 * (j + 0.5)) * k, measureOr(l, dv.sec) * k, dv.sec * k, CONST.t2, "secondary"));
      probe.pair("info", b(R(x0 - 2 * k, r.y + B.pad * k, (t.gl + 4) * k, (t.gl + 4) * k)), b(R(x0 - 7 * k, r.y + (B.pad - 5) * k, (t.gl + 14) * k, (t.gl + 14) * k)), {col: t.on ? CONST.medal : CONST.t2, name: "medal glyph " + t.name, ...(t.on ? {} : {lock: true})}); // a goal not yet earned is the locked state (3:1)
    });
  }
  if (fr) {
    const rest = foc === "tabs" ? P.tabs[pi === 0 ? 1 : 0].r : d.bodies.scores.keys[(P.scores.h + 1) % 3];
    probe.pair("band", b(fr), b(R(rest.x, rest.y, rest.w, rest.h)), {name: "focus " + foc});
    const bed = R(d.pane.x + 4, fr.y, Math.max(1, fr.x - 7 - (d.pane.x + 4)), fr.h), bedT = foc === "tabs" ? R(d.plate.x + 1, fr.y, Math.max(1, fr.x - 7 - d.plate.x - 1), fr.h) : bed;
    probe.pair("ring", b(R(fr.x - 6, fr.y - 6, fr.w + 12, fr.h + 12)), b(bedT.w > 2 ? bedT : R(d.plate.x + 1, d.plate.y + 1, 20, 20)), {name: "ring " + foc});
  }
  if (F0) {
    probe.rect("foot", ...b(F0));
    for (const p of F0.parts) {
      if (p.cap) probe.rect("foot cap", ...b(R(p.x, F0.mid - DEV.d.caph / 2, p.w, DEV.d.caph)));
      if (p.cap && !Array.isArray(p.cap)) txt(p.cap, p.x + 10, F0.mid, p.w - 20, F0.px, CONST.t2, "secondary");
      else if (!p.cap) txt(p.sep || p.t, p.x, F0.mid, p.w, F0.px, p.sep ? CONST.off : CONST.t2, "secondary", p.sep ? {lock: true} : {});
    }
  }
}
/* the probe's text widths come from the measuring context the plan used (the page's canvas), here through the memo */
let MC = EST;
const measureOr = (s, px, disp) => W(MC, disp ? T.display(px) : T.label(px), s);
const nWOr = (s, px) => nW(MC, T.num(px), s);

/* ---------- the page ---------- */
const FIELDS = ["page", "level", "heat", "plaques", "scores", "rows"];
let S = null;
export const _dbg = {plans: 0, last: null};
function same(S0, G, ui, w, dpr, c, tap) {
  if (!S0 || S0.G !== G || S0.w !== w || S0.dpr !== dpr || S0.c !== c || S0.tap !== tap) return false;
  for (const k of FIELDS) if (S0.ui[k] !== ui[k]) return false;
  return true;
}
const J = JSON.stringify;
/* the room: MENU's layer when MENU last painted this box and level (its dpr gave way to MENU's own layers, so the key is the same and the layer is
   shared); else this page's own give-way: the room shrinks so the page layer, its feet and the logo reserve fit the budget */
function roomDpr(F, level, dpr, bytes) {
  const m = menuDbg.last, ms = m && m.S;
  if (ms && ms.box && ms.box.w === F.W && ms.box.h === F.H && (ms.ui.level | 0 || 1) === level && ms.dpr === dpr) return ms.rd;
  return +Math.max(0.5, Math.min(dpr, Math.sqrt(Math.max(0, BUDGET - 3 * 1024 * 1024 - bytes) / (4 * F.W * F.H)))).toFixed(3);
}
function sizes(S0, G, F, level, tok, ui) {
  const d = G.d, u = G.u, dpr = S0.dpr, T0 = d.T, ob = R(d.plate.x - T0 - 2, d.plate.y - T0 - 2, d.plate.w + 2 * T0 + 4, d.plate.h + 2 * T0 + 6), pb = sc(ob, u);
  const id = [ui.page, G.mode, +u.toFixed(6), J(d.plate), ui.page === "scores" ? ui.plaques | 0 : "", J(ui.rows || null)].join("|");
  const K = {biome: tok.name, level, W: F.W, H: F.H, look: "2d", textScale: G.ts, dpr};
  S0.ob = ob; S0.pb = pb; S0.pw = Math.round(pb.w * dpr); S0.ph = Math.round(pb.h * dpr); S0.pageKey = {...K, layer: "records.page|" + id}; S0.pageK = keyOf(S0.pageKey);
  S0.feet = Object.entries(S0.P.feet).map(([v, fp]) => {
    const fr = R(fp.x - 1, fp.y - 1, fp.w + 2, fp.h + 6), bb = sc(fr, u), w = Math.round(bb.w * dpr), h = Math.round(bb.h * dpr);
    const key = {...K, layer: "records.foot|" + J([+u.toFixed(6), fp.x, fp.y, fp.w, fp.parts.map((p) => [p.t || p.sep || "", p.cap || ""])])};
    return {v, fp, fr, b: bb, w, h, key, k: keyOf(key)};
  });
  const bytes = S0.pw * S0.ph * 4 + S0.feet.reduce((a, q) => a + q.w * q.h * 4, 0);
  S0.rd = roomDpr(F, level, dpr, bytes);
  S0.box = {w: F.W, h: F.H};
  S0.roomK = keyOf({layer: "room", biome: tok.name, level, W: F.W, H: F.H, dpr: S0.rd, look: "2d", textScale: 1});
}
/** Paints one RECORDS tab on c for the frame F. ui = {page "scores" | "stats" | "medals", level, focus "tabs" | "body", heat, scores (played rows of that
    difficulty), plaques (the badge bits), rows (MEDALS: [name, desc, earned] x 8)}; a zero or non-finite box draws nothing. */
export function drawRecordsPage(c, F, ui, t = 0) {
  if (!okBox(F) || PAGES.indexOf(ui.page) < 0) return;
  const level = ui.level | 0 || 1, tok = worldTokens(level), G = recordsGeom(F), u = G.u, words = hints(), touchy = !!F.touch;
  const dpr = capDpr(deviceScale(c), touchy), tap = tapMode(touchy), foc = ui.page === "scores" && ui.focus === "body" ? "body" : "tabs";
  MC = mOf(c);
  if (!same(S, G, ui, words, dpr, c, tap)) {
    const P = plan(c, G, ui);
    P.feet = {};
    if (G.mode === "desk") for (const f of ui.page === "scores" ? ["tabs", "body"] : ["tabs"]) P.feet[f] = footPlan(MC, G, footItems(ui.page, f, words));
    S = {G, w: words, dpr, c, tap, ui: {...ui}, P, room: null, page: null, foot: {}};
    sizes(S, G, F, level, tok, ui);
    _dbg.plans++;
  }
  const P = S.P;
  _dbg.last = {G, P, foc, S};
  if (typeof c.clip !== "function" || typeof c.rect !== "function") return;
  const q = S.feet.find((f) => f.v === foc) || S.feet[0] || null;
  if (canMake()) {
    if (!S.room || !S.room.width) S.room = roomLayer(S.box, level, tok, {dpr: S.rd, look: "2d", textScale: 1});
    else touch(S.roomK);
    if (!S.page || !S.page.width) S.page = layer(S.pageKey, S.pw, S.ph, (g) => { g.scale(dpr * u, dpr * u); g.translate(-S.ob.x, -S.ob.y); paintPage(g, G, P, ui, tok); });
    else touch(S.pageK);
    for (const f of S.feet) {
      if (!S.foot[f.v] || !S.foot[f.v].width) S.foot[f.v] = layer(f.key, f.w, f.h, (g) => { g.scale(dpr * u, dpr * u); g.translate(-f.fr.x, -f.fr.y); paintFoot(g, f.fp, tok); });
      else touch(f.k);
    }
    c.save(); c.imageSmoothingEnabled = true; c.drawImage(S.room, 0, 0, F.W, F.H); c.drawImage(S.page, S.pb.x, S.pb.y, S.pb.w, S.pb.h);
    if (q) c.drawImage(S.foot[q.v], q.b.x, q.b.y, q.b.w, q.b.h);
    c.restore();
  } else {
    c.save(); c.fillStyle = toL(tok.bg1, 0.004); c.fillRect(0, 0, F.W, F.H); c.scale(u, u);
    paintPage(c, G, P, ui, tok);
    if (q) paintFoot(c, q.fp, tok);
    c.restore();
  }
  c.save(); c.scale(u, u);
  const pi = PAGES.indexOf(ui.page), tr = G.d.tabs[pi];
  key(c, tr.x, tr.y, tr.w, tr.h, "lit", {tok, label: P.tabs[pi].s, phone: G.dev === "p", ring: foc === "tabs", bomb: foc === "tabs" && P.tabs[pi].bomb});
  if (ui.page === "scores") scoresLive(c, G, P, ui, tok, foc === "body");
  c.restore();
  if (probe.probe.on) record(G, P, ui, foc, dpr, F.shell ? "sh" : "c", q && q.fp, tok, touchy);
}
