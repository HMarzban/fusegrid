/* CONTROLS PAGE (UI upgrade v202 Task 6.3; design record §4 CONTROLS, appendix 9.x; the round 7 C7-controls frames d-05-controls / -keys / -none /
   -capture and p-05-*). The owner's remark "I think you forgot to work on the cntroller side ha?" reversed the CONSOLE PANEL ruling: the page is on
   the world kit like every other menu. Lazy: shellview.loadControlsArt imports it (never the boot graph); until it lands the kit's one LOADING plate
   (menudraw loadingPage) stands in. The room of ui.level dresses the stage opaque (SCREEN.CONTROLS; MENU's own room layer at MENU's room dpr, kit
   room.js pageRoomDpr); on PAUSE view 3 (F.paused) the plate sits over the frozen board in the PLAYED room's tokens, kept off the HUD strip.
   Top to bottom: kicker SETTINGS over the display title CONTROLS (a phone: BACK and the title), KEYBOARD | CONTROLLER as kit tabs (bricks in a wall
   trough, the open one lit), the rows (MOVE BOMB THROW REMOTE PAUSE, a wall course, CONFIRM BACK or SENSITIVITY VIBRATION, a course, RESET): each a
   lane of the board, label left, the bound inputs right as kit keys (a controller's position glyph and its word; a key's legend; FIXED a wall plaque),
   SENSITIVITY and VIBRATION steppers (◀ a well window with the word and a meter of bricks ▶; on a phone a door: meter, word, chevron), RESET coral
   with the reset glyph. Focus = the band and the bare bomb on the row (no ring on rows); the drawing rings the focused row's button. Desk: beside the
   rows a floor slab framed in wall cells, the pane: the device's name and its test note, the drawing LARGE with its callouts (padart drawPad /
   drawKeys, controlsgeo's planners), the row's status line, the rule sentence, the foot plaque (label first, keycap last).
   controlsGeom(F, s) is the one geometry for draw and tap: rects by row id in box units (G.d design px; u box units per design px). F = {W, H,
   touch, shell, css, ts, paused, cue (a controller drives a touch layout: the cue line)}; s = the reducer's view (tab, row, capture). Arrangements:
   desk (a keyboard box or a touch shell box that holds the two columns at u >= DESK_U; the plate and its pane hug the content and centre in a taller
   box, the top margin a minimum), col (a keyboard #c and PAUSE on keys: the list alone, no drawing, scaled as one piece as every page there),
   phone (a touch-portrait shell box, every touch #c and a touch PAUSE view: the column in CSS px, rows >= 44 CSS px 8 apart, the drawing above the
   rows where it fits, else none, then the rows PAGE with the kit pager). controlsHit(s, x, y, G) answers what the reducer's wire takes: {tab},
   {row}, {k: "page", d, to} (the kit pager; to the first row of the page it opens), {off: 1} off the plate or on BACK, {} on the plate; while a rebind
   listens only the capture plate counts ({} on it, {off: 1} off it). Cached (kit cache.js): the room and one page layer (plate, head, tabs, courses,
   every row at rest, the pane's slab, name and rule), keyed by what they show, so a cursor move never misses; live: the focused row, the drawing
   (its own layers, padart) with its ring and callouts, the status line, the foot and the capture plate. Under the probe the page records its rects,
   texts and squint pairs outside any layer paint. */
import {CONTROLS_WORDS as CW, LABEL, SW2_WORDS} from "../words.js";
import {worldTokens, CONST, toL} from "../kit/tokens.js";
import {key, plate, band, focusBomb, plaque, rfill as rr, wallCell} from "../kit/paint.js";
import {T, DEV, SANS, measure as W, textScale, dsp, measurer as mOf, text, CAP_K} from "../kit/type.js";
import {deep, R, sc, okBox, inR, big} from "../kit/geom.js";
import {layer, capDpr, touch as touchK, keyOf, canMake} from "../kit/cache.js";
import {roomLayer, roomKey, pageRoomDpr} from "../kit/room.js";
import * as probe from "../kit/probe.js";
import {paginate, pagerKeys, pageLabel, pageKeyAt, paintPager, keySide, pageOfFocus} from "../kit/pager.js";
import {deviceScale} from "../logo/draw2d.js";
import {hints, tapAt} from "../hintcopy.js";
import {FOOT_TAP, BACK_TAP} from "../kit/copy.js";
import {meterCell, slab, mark, course, SLAB} from "../kit/parts.js";
import {drawPad, drawCallouts, drawKeys, glyph as padGlyph, padBox, kbPrints, kbLegend, KB_AT, PART_AT, ringR, keyRect} from "../padart.js";
import {rowsOf, statusOf, footItems, padStates, padRing, padCallouts, padFit, keyStates, keyRing, keyCallouts, kbFit, keyName, CAPTION, PAD_TALL, capCallouts, inUseLine} from "../controlsgeo.js";

export const DESK = deep({
  d: {pad: [18, 22, 18, 22], list: 440, gap: 24, row: 40, grp: 12, tabs: 10, below: 12, pw: 1300, paneMin: 420, art: [200, 460], foot: 50},
  d125: {pad: [14, 22, 14, 22], list: 500, gap: 24, row: 40, grp: 12, tabs: 10, below: 10, pw: 1300, paneMin: 420, art: [190, 460], foot: 50},
});
export const COL = deep({c: {pad: [14, 18, 14, 18], list: 480, row: 34, grp: 10, tabs: 8, below: 10, ttl: 32}, c125: {pad: [12, 18, 12, 18], list: 540, row: 36, grp: 10, tabs: 8, below: 8, ttl: 32}});
export const PHONE = deep({p: {top: 12, bot: 12, side: 12, pad: [12, 12, 14, 12], grp: 10, tabs: 10, back: 112, below: 12, max: 600, art: [120, 300]},
  p125: {top: 10, bot: 10, side: 12, pad: [10, 12, 12, 12], grp: 10, tabs: 10, back: 124, below: 10, max: 600, art: [120, 300]}});
export const COL_ART = 180; // col's compact drawing, at the head's right over the tabs (no callouts: the rows name every input)
export const TOUCH = Object.freeze({h: 44, g: 8}), DESK_U = 0.8, GUT = 8, FOOT1 = 50, TROUGH = 11, TAB_GAP = 8, MIN_ROWS = 2;
/* a wall course before each of these rows: actions · fixed or feel · connect (Task 3: shown only where switch2.js reaches) · reset */
export const GROUP = Object.freeze(["CONFIRM", "SENSITIVITY", "RESET"]);
const BACK_CHEV = 52; // BACK as its chevron alone (>= 44 CSS px), records' compact step-down
const LAND_TIGHT = Object.freeze({top: 12, bot: 12, pad: Object.freeze([6, 12, 8, 12]), below: 8, tabs: 6});
const pauseBand = (F) => (F.free ? [8, F.H - 8] : [44, F.touch ? F.H - 8 : F.H - 28]); // PAUSE keeps the HUD strip (y < 40) clear, and on keys the ability bar; F.free: a phone's over box (Task 9.8), under the HUD already
const padOff = (s) => s.tab === "pad" && (!s.pad || s.pad.state === "none" || s.pad.state === "lost");
const idsOf = (s) => rowsOf(s || {}).map((r) => r.id);

/* ---- geometry ---- */
function run(ids, row, grp, fl, u) {
  const hs = ids.map(() => (fl ? Math.max(row, fl.h / u) : row)), gs = ids.map((l, i) => (!i ? 0 : GROUP.includes(l) ? Math.max(grp, fl ? fl.g / u : 0) : fl ? fl.g / u : 0));
  return {hs, gs, h: hs.reduce((a, h, i) => a + h + gs[i], 0)};
}
/* every row's rect on its own page, its tap rect (half of each gap round it, out to x0..x1; a page's first row from top0 above, its last to bot1
   below) and the courses, each with its page */
function lay(ids, pages, S, x, y0, w, x0, x1, top0, bot1) {
  const out = {}, hit = {}, divs = [], pageOf = {};
  let bot = y0;
  pages.forEach((pg, p) => {
    let y = y0;
    pg.forEach((i, k) => {
      const l = ids[i], g = k ? S.gs[i] : 0;
      if (g && GROUP.includes(l)) divs.push({r: R(x, y + g / 2 - 1, w, 2), p});
      y += g; out[l] = R(x, y, w, S.hs[i]); pageOf[l] = p; y += S.hs[i];
    });
    pg.forEach((i, k) => {
      const l = ids[i], r = out[l], up = k ? S.gs[i] / 2 : top0, dn = k === pg.length - 1 ? bot1 : S.gs[pg[k + 1]] / 2;
      hit[l] = R(x0, r.y - up, x1 - x0, r.h + up + dn);
    });
    bot = Math.max(bot, y);
  });
  return {out, hit, divs, pageOf, bot};
}
function solve(u0, fits) {
  if (fits(u0)) return u0;
  let lo = 0, hi = u0;
  for (let i = 0; i < 48; i++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
  return lo;
}
const headH = (ts, ttl) => DEV.d.sec * ts * 1.2 + 6 + ttl * ts * 1.1;
/* the pane's parts top to bottom: the device's name line, the drawing, the status line (two lines), the rule sentence (two lines), the foot plaque */
/* the pane's parts top to bottom (it stands the plate's full inner height beside the head and the list, so the drawing has the room its callouts
   need at the kit's type): the device's name line, the drawing, the rule sentence (two lines), the foot plaque (one line) */
const paneChrome = (ts, foot) => 2 * (SLAB + 12) + DEV.d.pri * ts * 1.25 + 8 + 8 + 2 * DEV.d.bod * ts * 1.4 + 10 + foot;
function paneParts(P, ts, footH) {
  const dv = DEV.d, ix = P.x + SLAB + 12, iw = P.w - 2 * (SLAB + 12), iy = P.y + SLAB + 12, hN = dv.pri * ts * 1.25, hR = 2 * dv.bod * ts * 1.4;
  const foot = R(ix, P.y + P.h - SLAB - 12 - footH, iw, footH), rule = R(ix, foot.y - 10 - hR, iw, hR), name = R(ix, iy, iw, hN);
  return {pane: P, name, art: R(ix, iy + hN + 8, iw, rule.y - 8 - (iy + hN + 8)), rule, foot};
}
/* a short desk window gives way before it scales (Task 3: the CONNECT row's ninth row at 1366 x 657): the courses, the gap under the head and over the rows close */
export const DESK_SHORT = Object.freeze({grp: 8, below: 6, tabs: 6});
/* desk: the head, the tabs, the rows and the row's status line in the left column; the pane the plate's full inner height on the right */
function desk(F, ids, ts, fl, short) {
  const D = short ? {...DESK[big(ts) ? "d125" : "d"], ...DESK_SHORT} : DESK[big(ts) ? "d125" : "d"], dv = DEV.d, T0 = dv.T, head = headH(ts, dv.ttl), mx = T0 + 2 + GUT, my = T0 + 3 + GUT, chrome = paneChrome(ts, D.foot), hS = 2 * dv.sec * ts * 1.3;
  const tabH = (u) => Math.max(dv.bkh, fl ? fl.h / u : 0), leftH = (u) => head + D.below + tabH(u) + TROUGH + D.tabs + run(ids, D.row, D.grp, fl, u).h + 12 + hS;
  const need = (u) => D.pad[0] + Math.max(leftH(u), chrome + D.art[0]) + D.pad[2], pwMin = D.pad[3] + D.list + D.gap + D.paneMin + D.pad[1];
  const u = solve(Math.min(1, F.W / (pwMin + 2 * mx)), (v) => v * (need(v) + 2 * my) <= F.H);
  const Wd = F.W / u, Hd = F.H / u, pw = Math.min(D.pw, Wd - 2 * mx), avail = Hd - 2 * my - D.pad[0] - D.pad[2];
  const S = run(ids, D.row, D.grp, fl, u), inner = Math.max(leftH(u), Math.min(avail, chrome + D.art[1])), ph = D.pad[0] + inner + D.pad[2];
  const px = (Wd - pw) / 2, py = Math.max(my, (Hd - ph) / 2), hy = py + D.pad[0], top = hy + head + D.below, lx = px + D.pad[3], th = tabH(u), tw = (D.list - TAB_GAP) / 2;
  const L = lay(ids, [ids.map((_, i) => i)], S, lx, top + th + TROUGH + D.tabs, D.list, px, lx + D.list + D.gap / 2, D.tabs / 2, 6);
  const P = R(lx + D.list + D.gap, hy, pw - D.pad[1] - D.pad[3] - D.list - D.gap, inner);
  return {mode: "desk", dev: "d", u, ts, T: T0, plate: R(px, py, pw, ph), head: R(lx, hy, D.list, head), kick: true, ttl: dv.ttl, back: null,
    tabs: [0, 1].map((i) => R(lx + i * (tw + TAB_GAP), top, tw, th)), trough: R(lx, top + th, D.list, TROUGH), rows: L.out, hit: L.hit, divs: L.divs,
    pageOf: L.pageOf, pages: [ids], keys: null, list: R(lx, top, D.list, L.bot - top), ...paneParts(P, ts, D.foot), status: R(lx, L.bot + 12, D.list, hS), cue: null};
}
/* col: the list alone (a keyboard #c, PAUSE on keys): the head, the tabs, the device's name line, the rows, the status line, the foot, the compact
   drawing at the head's right over the tabs; scaled as one piece to the box (a keyboard #c is 600 x 520) */
function col(F, ids, ts) {
  const C = COL[big(ts) ? "c125" : "c"], dv = DEV.d, T0 = dv.T, head = headH(ts, C.ttl), mx = T0 + 2 + GUT / 2, my = T0 + 3 + GUT / 2;
  const [b0, b1] = F.paused ? pauseBand(F) : [0, F.H], Hb = b1 - b0, pw = C.pad[3] + C.list + C.pad[1], S = run(ids, C.row, C.grp, null, 1);
  const hN = dv.sec * ts * 1.3 + 6, hS = 2 * dv.sec * ts * 1.3, ph = C.pad[0] + head + C.below + dv.bkh + TROUGH + C.tabs + hN + S.h + 8 + hS + 8 + FOOT1 + C.pad[2];
  const u = Math.min(1, F.W / (pw + 2 * mx), Hb / (ph + 2 * my)), Wd = F.W / u, px = (Wd - pw) / 2, py = Math.max(b0 / u + my, (b0 + Hb / 2) / u - ph / 2);
  const hy = py + C.pad[0], top = hy + head + C.below, lx = px + C.pad[3], tw = (C.list - COL_ART - 12 - TAB_GAP) / 2, ny = top + dv.bkh + TROUGH + C.tabs, ry = ny + hN;
  const L = lay(ids, [ids.map((_, i) => i)], S, lx, ry, C.list, px, px + pw, 0, 4), sy = L.bot + 8;
  return {mode: "col", dev: "d", u, ts, T: T0, plate: R(px, py, pw, ph), head: R(lx, hy, C.list, head), kick: true, ttl: C.ttl, back: null,
    tabs: [0, 1].map((i) => R(lx + i * (tw + TAB_GAP), top, tw, dv.bkh)), trough: R(lx, top + dv.bkh, 2 * tw + TAB_GAP, TROUGH), rows: L.out, hit: L.hit, divs: L.divs,
    pageOf: L.pageOf, pages: [ids], keys: null, list: R(lx, ry, C.list, L.bot - ry), pane: null, name: R(lx, ny, C.list, hN - 6), art: R(lx + C.list - COL_ART, hy, COL_ART, ny - 4 - hy),
    status: R(lx, sy, C.list, hS), rule: null, foot: R(px + 8, sy + hS + 8, pw - 16, FOOT1), cue: null};
}
/* phone: the column in CSS px (u = 1 / css) for every touch box off the desk: a portrait shell box, a touch #c (a landscape phone) and a touch PAUSE
   view (inside the pause band). The drawing stands over the rows where both fit, else the rows alone; where the rows do not fit they page (the kit
   pager's strip under them, the page on screen the focused row's); a page short of MIN_ROWS rows closes the margins first */
function phone(F, ids, ts, cue) {
  let P = PHONE[big(ts) ? "p125" : "p"];
  const dv = DEV.p, css = F.css > 0 ? F.css : 1, u = 1 / css, Wd = F.W / u, [pb0, pb1] = F.paused ? pauseBand(F) : [0, F.H], b0 = pb0 / u, Hb = (pb1 - pb0) / u;
  const lhS = dv.sec * ts * 1.3, hC = cue ? dv.caph + 24 : 0, kh = keySide(css, u), S = run(ids, TOUCH.h, P.grp, TOUCH, 1);
  /* tight (a page short of MIN_ROWS rows): the margins and pads close, the name line goes (the open tab and the status line say the state) and the
     status keeps one line */
  let tight = false;
  const hN = () => (tight ? 0 : lhS + 6), hS = () => (tight ? 1 : 2) * lhS + 4;
  /* a wide box (a landscape phone's #c, a touch PAUSE view): BACK and the tabs share the head row, the title between them where it fits */
  let wide = Wd >= 400 && Wd > Hb * 1.05;
  const tabRow = (q) => (wide ? Math.max(0, dv.bkh + TROUGH - dv.btnh) : q.below + dv.bkh + TROUGH);
  const fixed = (q) => q.top + q.pad[0] + dv.btnh + tabRow(q) + q.tabs + hN() + 8 + hS() + hC + q.pad[2] + q.bot;
  let avail = Hb - fixed(P);
  if (S.h > avail && paginate(S.hs, S.gs, avail - 8 - kh)[0].length < MIN_ROWS) { P = {...P, ...LAND_TIGHT}; tight = true; if (!wide) { wide = true; P.back = BACK_CHEV; } avail = Hb - fixed(P); } // tight and narrow: BACK steps down to its chevron and the tabs ride the head row
  const pw = Math.min(Wd - 2 * P.side, wide ? Math.max(P.max, 720) : P.max), padX = Wd < 380 ? 8 : P.pad[3], iw = pw - 2 * padX, all = ids.map((_, i) => i);
  let art = 0, pages = [all], cap = Infinity;
  if (S.h + 10 + P.art[0] <= avail) art = Math.min(P.art[1], iw * PAD_TALL + 24, avail - S.h - 10);
  else if (S.h > avail) { cap = Math.max(avail - 8 - kh, S.hs[0]); pages = paginate(S.hs, S.gs, cap); if (pages.length < 2) { pages = [all]; cap = Infinity; } }
  const paged = pages.length > 1, lh = paged ? cap : S.h, ph = P.pad[0] + dv.btnh + tabRow(P) + P.tabs + hN() + (art ? art + 10 : 0) + lh + (paged ? 8 + kh : 0) + 8 + hS() + hC + P.pad[2];
  const px = (Wd - pw) / 2, py = b0 + Math.max(P.top, (Hb - ph) / 2), ix = px + padX, hy = py + P.pad[0];
  const tw = wide ? Math.min(200, (iw - P.back - 16 - TAB_GAP) / 2) : (iw - TAB_GAP) / 2, tx = wide ? ix + iw - 2 * tw - TAB_GAP : ix, ty = wide ? hy : hy + dv.btnh + P.below;
  const ny = (wide ? hy + Math.max(dv.btnh, dv.bkh + TROUGH) : ty + dv.bkh + TROUGH) + P.tabs, ay = ny + hN(), ry = ay + (art ? art + 10 : 0);
  const L = lay(ids, pages, S, ix, ry, iw, px, px + pw, 4, 4), lb = ry + lh, keys = paged ? pagerKeys(ix, lb + 8, iw, kh) : null, sy = lb + (paged ? 8 + kh : 0) + 8;
  return {mode: "phone", dev: "p", u, ts, T: dv.T, plate: R(px, py, pw, ph), head: R(ix, hy, iw, dv.btnh), kick: false, ttl: dv.ttl, back: R(ix, hy, P.back, dv.btnh),
    tabs: [0, 1].map((i) => R(tx + i * (tw + TAB_GAP), ty, tw, dv.bkh)), trough: R(tx, ty + dv.bkh, wide ? 2 * tw + TAB_GAP : iw, TROUGH), rows: L.out, hit: L.hit, divs: L.divs,
    pageOf: L.pageOf, pages: pages.map((pg) => pg.map((i) => ids[i])), keys, list: R(ix, ry, iw, lh), pane: null, name: tight ? null : R(ix, ny, iw, hN() - 6), titleEnd: wide ? tx - 12 : ix + iw,
    art: art ? R(ix, ay, iw, art) : null, status: R(ix, sy, iw, hS() - 4), rule: null, foot: null, cue: hC ? R(ix, sy + hS(), iw, dv.caph + 20) : null};
}
const memo = new Map();
/** THE geometry for draw and tap; see the header. */
export function controlsGeom(F, s) {
  const ids = idsOf(s), ts = F.ts > 0 ? F.ts : textScale(), touchy = !!F.touch, shell = !!F.shell, css = F.css > 0 ? F.css : 1, paused = !!F.paused, cue = !!F.cue && touchy;
  const id = [F.W, F.H, touchy, shell, css, ts, paused, !!F.free, cue, ...ids].join("|");
  let G = memo.get(id);
  if (G) return G;
  const portrait = !paused && shell && touchy && F.H > F.W * 1.3, fl = touchy ? {h: TOUCH.h / css, g: TOUCH.g / css} : null;
  let d = portrait || (touchy && !shell) ? null : paused ? null : desk(F, ids, ts, fl);
  if (d && d.u < 1 && d.u >= DESK_U) { const e = desk(F, ids, ts, fl, true); if (e.u > d.u + 1e-9) d = e; } // only a desk that would scale, where it buys scale: a width-bound box keeps its gaps, and a box on the phone or col form never turns desk
  if (!d || d.u < DESK_U) d = touchy ? phone(F, ids, ts, cue) : col(F, ids, ts);
  /* a touch board canvas too small for even MIN_ROWS rows a page at its CSS scale (a 568 x 320 phone): the column scales as one piece, the one give-way left */
  const bot = paused ? pauseBand(F)[1] : F.H;
  for (let i = 0, k = 1; d.mode === "phone" && i < 16 && (d.plate.y + d.plate.h + d.T) * d.u > bot + 0.5; i++) d = phone({...F, css: css / (k *= 0.96)}, ids, ts, cue);
  const u = d.u, ks = d.keys, S = (r) => sc(r, u), cw = Math.min(440, d.plate.w - 24), cy = d.plate.y + d.plate.h / 2;
  G = {mode: d.mode, dev: d.dev, u, ts, t125: big(ts), W: F.W, H: F.H, d, T: d.T * u, order: ids.slice(), plate: S(d.plate), back: S(d.back), tabs: d.tabs.map(S),
    trough: S(d.trough), pane: S(d.pane), art: S(d.art), name: S(d.name), status: S(d.status), rule: S(d.rule), foot: S(d.foot), cue: S(d.cue),
    pages: d.pages, pageOf: d.pageOf, keys: ks ? {up: S(ks.up), dn: S(ks.dn), strip: S(ks.strip), label: S(ks.label)} : null, rows: {}, hit: {},
    cap: S(R(d.plate.x + (d.plate.w - cw) / 2, cy - 130, cw, 260)), dcap: R(d.plate.x + (d.plate.w - cw) / 2, cy - 130, cw, 260)};
  for (const l of ids) { G.rows[l] = S(d.rows[l]); G.hit[l] = S(d.hit[l]); }
  if (memo.size > 64) memo.clear();
  memo.set(id, (G = deep(G)));
  return G;
}
/** The page on screen: the focused row's (s.row, an index). */
export const pageAt = (G, s) => pageOfFocus(G.pageOf, G.order[(s && s.row) | 0]);
/** A tap; see the header. */
export function controlsHit(s, x, y, G) {
  if (!G) return {off: 1};
  if (s && s.capture) return inR(G.art && G.name ? G.plate : G.cap, x, y) ? {} : {off: 1}; // listening: the page itself where the drawing listens in place, else the capture plate; inert on it, off it cancels
  if (G.back && inR(G.back, x, y)) return {off: 1};
  for (let i = 0; i < 2; i++) { const r = G.tabs[i], gu = (TAB_GAP / 2) * G.u; if (inR(R(r.x - (i ? gu : 0), r.y, r.w + gu, r.h + TROUGH * G.u), x, y)) return {tab: i ? "pad" : "key"}; }
  const p = pageAt(G, s), n = G.pages.length;
  const k = pageKeyAt(G.keys, x, y, (d) => (p + d >= 0 && p + d < n ? G.order.indexOf(G.pages[p + d][0]) : null));
  if (k) return k;
  for (const l of G.pages[p] || []) if (inR(G.hit[l], x, y)) return {row: G.order.indexOf(l)};
  return inR(G.plate, x, y) ? {} : {off: 1};
}

/* ---- the plan: every row's parts and words, measured once per change ---- */
const LF = (px) => T.label(px);
const fixedW = (c, dv) => W(c, LF(dv.sec), CW.FIXED) + 22;
const nameOf = (s, q) => (s.names && s.names[q] ? String(s.names[q]).toUpperCase() : keyName(q));
/* the bound inputs of a row as parts: {k: "gkey", g, v} a controller's position glyph on a key, {k: "cap", s} a key's legend, {k: "word", s} the
   position word, {k: "plus", s} the fixed partner, {k: "fixed"} the FIXED plaque. lvl steps down: 1 drops the words beside the glyph keys, 2 drops
   PAUSE's fixed partner and plaque (the status line names it), 3 joins a MOVE set into one key */
function tokens(s, r, lvl) {
  const out = [], v = r.val || [];
  if (!v.length) return out;
  if (v[0].cap) {
    if (r.id === "MOVE" && s.tab === "key") { const m = (s.key || {}).MOVE; if (m && lvl < 3) for (const q of [m[0], m[3], m[2], m[1]]) out.push({k: "cap", s: nameOf(s, q)}); else out.push({k: "cap", s: v[0].cap}); return out; }
    if (r.id === "PAUSE") { out.push({k: "cap", s: v[v.length - 1].cap}); if (s.tab === "pad" && lvl < 2) out.push({k: "plus", s: CW.PLUS + v[0].cap}, {k: "fixed"}); return out; }
    for (const q of v) out.push({k: "cap", s: q.cap});
    if (r.fixed) out.push({k: "fixed"});
    return out;
  }
  const one = (t) => { if (t.g === "centre") out.push({k: "cap", s: t.w}); else { out.push({k: "gkey", g: t.g, v: t.v}); if (lvl < 1) out.push({k: "word", s: t.w}); } };
  if (r.id === "PAUSE") { one(v[1]); if (lvl < 2) out.push({k: "plus", s: CW.PLUS + v[0].w}, {k: "fixed"}); return out; }
  v.forEach(one);
  return out;
}
/* parts laid right to left from xr on the row's centre cy */
function place(c, parts, xr, cy, dv, off) {
  const kh = dv === DEV.p ? 34 : dv.keyh, f = LF(dv.sec), P = [];
  const wOf = (q) => (q.k === "gkey" ? kh + 4 : q.k === "cap" ? Math.max(kh, W(c, f, q.s) + 20) : q.k === "fixed" ? fixedW(c, dv) : W(c, f, q.s));
  let x = xr, x0 = xr;
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i], w = wOf(q);
    x -= w; x0 = x;
    if (q.k === "gkey") P.push({...q, r: R(x, cy - kh / 2, kh + 4, kh), kind: "key"});
    else if (q.k === "cap") P.push({...q, r: R(x, cy - kh / 2, w, kh), kind: "key", f, px: dv.sec});
    else if (q.k === "fixed") P.push({...q, r: R(x, cy - kh / 2 + 2, w, kh - 4), f, px: dv.sec});
    else P.push({...q, x, y: cy, w, f, px: dv.sec, col: CONST.t2});
    if (i) x -= q.k === "word" && parts[i - 1].k === "gkey" ? 6 : 10; // a position word sits close to its glyph key
  }
  return {P, x: x0, w: xr - x0};
}
/* SENSITIVITY and VIBRATION: ◀ a well window (the word, a meter of bricks) ▶ on the desk; a door on a phone (meter, word, chevron) */
function stepper(c, r, xr, cy, dv, phone) {
  const f = LF(dv.sec), off = !!(r.off || r.none), wd = W(c, f, r.text), bar = r.bar && !r.none ? r.bar : null, n = bar ? bar[1] : 0, lit = bar ? bar[0] : 0;
  const cw = phone ? 7 : 8, g = 3, mh = phone ? 18 : 16, mw = n ? n * cw + (n - 1) * g : 0, P = [];
  if (phone) {
    const gs = 18, gx = xr - gs - 2, wx = gx - 10 - wd, mx = wx - 12 - mw;
    P.push({k: "glyph", n: "chev", r: R(gx, cy - gs / 2, gs, gs), col: off ? CONST.off : CONST.t2});
    P.push({k: "word", s: r.text, x: wx, y: cy, w: wd, f, px: dv.sec, col: off ? CONST.off : CONST.ink});
    for (let i = 1; i <= n; i++) P.push({k: "cell", kind: off ? "well" : i < lit ? "mid" : i === lit ? "lit" : "well", r: R(mx + (i - 1) * (cw + g), cy - mh / 2, cw, mh), head: i === lit, empty: i === n && i > lit});
    return {P, x: n ? mx : wx, w: xr - (n ? mx : wx)};
  }
  const a = dv.keyh, win = 12 + wd + (n ? 10 + mw : 0) + 12, w = a + 6 + win + 6 + a, x0 = xr - w, y = cy - a / 2, atL = !bar || off || lit <= (r.id === "SENSITIVITY" ? 1 : 0), atR = !bar || off || lit >= n;
  P.push({k: "key", kind: atL ? "well" : "key", r: R(x0, y, a, a), glyph: "chl"});
  P.push({k: "key", kind: "well", r: R(x0 + a + 6, y, win, a), win: true});
  P.push({k: "word", s: r.text, x: x0 + a + 6 + 12, y: cy, w: wd, f, px: dv.sec, col: off ? CONST.off : CONST.ink});
  const mx = x0 + a + 6 + 12 + wd + 10;
  for (let i = 1; i <= n; i++) P.push({k: "cell", kind: off ? "well" : i < lit ? "mid" : i === lit ? "lit" : "well", r: R(mx + (i - 1) * (cw + g), cy - mh / 2, cw, mh), head: i === lit, empty: i === n && i > lit});
  P.push({k: "key", kind: atR ? "well" : "key", r: R(x0 + a + 6 + win + 6, y, a, a), glyph: "chev"});
  return {P, x: x0, w};
}
function rowPlan(c, G, r, s, dv) {
  const g = G.d.rows[r.id], cy = g.y + g.h / 2, labx = dv.labx, xr = g.x + g.w - 12, label = r.label || r.id, lf = LF(dv.pri), lw = W(c, lf, label), off = !!(r.off || r.none);
  const o = {id: r.id, r: g, row: r, label: {s: label, f: lf, px: dv.pri, x: g.x + labx, y: cy, w: lw, col: r.reset ? CONST.cor : off ? CONST.t2 : CONST.ink}};
  let left = g.x + labx + lw + 10;
  if (r.changed && !(s.swap && s.swap.row === r.id)) { o.dot = {x: left + 2, y: cy - dv.pri * textScale() * 0.3}; left += 12; }
  if (s.swap && s.swap.row === r.id) { const sf = LF(dv.sec), sw = W(c, sf, CW.SWAPPED); o.swap = {s: CW.SWAPPED, f: sf, px: dv.sec, x: left + 4, y: cy, w: sw}; left += sw + 14; }
  const room = xr - left;
  if (r.reset) {
    const gs = dv === DEV.p ? 18 : 16, P = [{k: "glyph", n: "reset", r: R(xr - gs - 2, cy - gs / 2, gs, gs), col: CONST.cor}];
    if (s.armed) { const f = LF(dv.sec), say = CW.AGAIN.find((q) => W(c, f, q) <= room - gs - 14); if (say) P.push({k: "word", s: say, x: xr - gs - 12 - W(c, f, say), y: cy, w: W(c, f, say), f, px: dv.sec, col: CONST.cor}); }
    o.val = {P, x: xr - gs - 2, w: gs + 2};
    return o;
  }
  if (r.text) { o.val = stepper(c, r, xr, cy, dv, G.d.dev === "p"); return o; }
  if (r.door) { /* the CONNECT door: a key with its word; the word alone where the label leaves no room; then the door's chevron alone (the foot or the
       status says it); at 125 % a label that leaves not even that steps down to its 100 % size (SETTINGS' rule, R1 landscape) */
    const gs = dv === DEV.p ? 18 : 16, chev = {P: [{k: "glyph", n: "chev", r: R(xr - gs - 2, cy - gs / 2, gs, gs), col: CONST.ink}], x: xr - gs - 2, w: gs + 2};
    const door = (rm) => { let v = place(c, [{k: "cap", s: r.door}], xr, cy, dv); if (v.w > rm) v = place(c, [{k: "word", s: r.door}], xr, cy, dv); return v.w > rm ? chev : v; };
    o.val = door(room);
    if (o.val === chev && chev.w > room && textScale() > 1) { const p1 = dv.pri / textScale(), f1 = LF(p1), w1 = W(c, f1, label); o.label = {...o.label, f: f1, px: p1, w: w1}; o.val = door(xr - (g.x + labx + w1 + 10)); }
    return o;
  }
  for (let lvl = 0; lvl <= 3; lvl++) { o.val = place(c, tokens(s, r, lvl), xr, cy, dv, off); if (o.val.w <= room) break; }
  return o;
}
/* the foot plaque's lines: units (a label and its keycaps, label first) packed into at most maxL lines of maxW */
function footPlan(c, box, items, dv, maxL, tapWords) {
  if (!box) return null;
  const f = LF(dv.sec), maxW = box.w - 32, sw = W(c, f, "·"), capw = (q) => (Array.isArray(q) ? dv.capw : Math.max(dv.capw, Math.ceil(W(c, f, q)) + 20));
  const unit = (it) => { const ps = [{t: it.t, w: W(c, f, it.t), x: 0}]; let x = ps[0].w; (it.caps || []).forEach((q, j) => { const w = capw(q); x += j ? 5 : 8; ps.push({cap: q, w, x}); x += w; }); return {ps, w: x}; };
  const sets = tapWords ? tapWords.map((t) => [{t}]) : [items, items.filter((q) => q.t !== CW.TAB), items.filter((q) => q.t !== CW.TAB && q.t !== CW.ROW), items.filter((q) => q.t === CW.BACK)]; // whole items step down: the tab, then the row walk, then all but BACK
  for (const set of sets.filter((q) => q.length)) {
    const L = [];
    for (const q of set.map(unit)) { const cur = L[L.length - 1], add = 12 + sw + 12 + q.w; if (cur && cur.w + add <= maxW) { cur.us.push(q); cur.w += add; } else L.push({us: [q], w: q.w}); }
    if (L.length > maxL || L.some((q) => q.w > maxW)) continue;
    const lh = dv.caph, h = L.length * lh + (L.length - 1) * 8 + 20, w = Math.max(...L.map((q) => q.w)) + 32, x = box.x, y = box.y + box.h - h, lines = [];
    L.forEach((q, i) => {
      const my = y + 10 + i * (lh + 8) + lh / 2, ps = [];
      let lx = x + 16;
      q.us.forEach((un, j) => { if (j) { ps.push({sep: "·", w: sw, x: lx + 12, y: my}); lx += 12 + sw + 12; } for (const p of un.ps) ps.push({...p, x: lx + p.x, y: my}); lx += un.w; });
      lines.push({ps});
    });
    return {x, y, w, h, f, px: dv.sec, lines};
  }
  return null;
}
/* words split whole at spaces into at most n lines of w; null when one word alone is wider */
function wrap(c, f, s, w, n) {
  const out = [];
  let line = "";
  for (const q of String(s).split(" ")) { const t = line ? line + " " + q : q; if (!line || W(c, f, t) <= w) line = t; else { out.push(line); line = q; } }
  if (line) out.push(line);
  const k = out.length - 1, a = k > 0 ? out[k - 1].lastIndexOf(" ") : -1; // no word alone on a last line: its neighbour comes down with it
  if (a > 0 && !out[k].includes(" ")) { const down = out[k - 1].slice(a + 1) + " " + out[k]; if (W(c, f, down) <= w) { out[k - 1] = out[k - 1].slice(0, a); out[k] = down; } }
  return out.length <= n && out.every((q) => W(c, f, q) <= w) ? out : null;
}
/* a status or rule line: whole, split at its " · " parts (a sentence, at its sentences), wrapped; the last that fits; never an ellipsis */
function lines(c, f, s, w, n) {
  if (!s) return [];
  const one = wrap(c, f, s, w, n);
  if (one) return one;
  const sep = String(s).includes(" · ") ? " · " : ". ", parts = String(s).split(sep), end = sep === ". " ? "." : "";
  for (let k = parts.length - 1; k >= 1; k--) { const q = wrap(c, f, parts.slice(0, k).join(sep) + end, w, n); if (q) return q; }
  return wrap(c, f, parts[0], w, 99) ? wrap(c, f, parts[0], w, 99).slice(0, n) : [];
}
function nameWords(s) {
  const st = s.pad && s.pad.state;
  if (s.tab === "key") return [CW.KEYBOARD, CW.ALSO];
  if (padOff(s)) return [st === "lost" ? CW.LOST : CW.NONE, ""];
  return [(s.pad && s.pad.name) || CW.CONTROLLER, CW.TEST];
}
function headPlan(c, G, ui) {
  const d = G.d, dv = DEV[d.dev], ts = d.ts, h = d.head, out = {};
  if (d.mode === "phone") {
    out.back = {r: d.back, s: CW.BACK};
    out.title = {s: CW.TITLE, px: d.ttl, x: d.back.x + d.back.w + 16, y: h.y + h.h / 2};
    const room = d.titleEnd - out.title.x, tw = W(c, T.display(d.ttl), CW.TITLE);
    if (tw > room) out.title.px = d.ttl * room / tw;
    if (out.title.px < d.ttl * 0.6) out.title = null; // a head row too narrow beside the tabs: the tabs and BACK say where you are (records' compact rule)
    else out.title.w = Math.min(tw, room);
    return out;
  }
  const kick = ui.kicker != null ? ui.kicker : LABEL.SETTINGS;
  out.kick = {s: kick, f: LF(DEV.d.sec), px: DEV.d.sec, x: h.x, y: h.y + DEV.d.sec * ts * 0.6, w: W(c, LF(DEV.d.sec), kick)};
  out.title = {s: CW.TITLE, px: d.ttl, x: h.x, y: h.y + h.h - d.ttl * ts * 0.55};
  return out;
}
function plan(c0, G, s, ui) {
  const c = mOf(c0), d = G.d, dv = DEV[d.dev], rows = {}, list = rowsOf(s);
  for (const r of list) rows[r.id] = rowPlan(c, G, r, s, dv);
  const tf = LF(d.dev === "p" ? dv.pri : dv.pri), tabs = [CW.KEYBOARD, CW.CONTROLLER].map((t, i) => ({s: t, r: d.tabs[i], on: (s.tab === "pad") === !!i, w: W(c, tf, t), f: tf, px: dv.pri}));
  const [nm, note] = nameWords(s), nf = LF(d.dev === "p" || d.mode === "col" ? dv.sec : dv.pri), sf = LF(DEV.d.sec);
  const name = d.name ? {s: nm, f: nf, px: d.dev === "p" || d.mode === "col" ? dv.sec : dv.pri, x: d.name.x, y: d.name.y + d.name.h / 2, w: W(c, nf, nm)} : null;
  if (name && note && d.pane && name.w + 24 + W(c, sf, note) <= d.name.w) name.note = {s: note, f: sf, px: DEV.d.sec, x: d.name.x + d.name.w, y: name.y, w: W(c, sf, note)};
  let rule = null, rule2 = null;
  const ruleOf = (say) => { const bf = T.body(DEV.d.bod), ls = lines(c, bf, say, d.rule.w, 2), lh = DEV.d.bod * d.ts * 1.4; return ls.map((q, i) => ({s: q, f: bf, px: DEV.d.bod, x: d.rule.x, y: d.rule.y + d.rule.h - (ls.length - i - 0.5) * lh, w: W(c, bf, q)})); };
  if (d.rule) { rule = ruleOf(s.tab === "key" ? CW.RULE_KEY : CW.RULE_PAD); if (rows.SW2) rule2 = ruleOf(SW2_WORDS.help); } // the CONNECT row's help takes the rule's place (the sentence wants the pane's width)
  return {rows, list, tabs, name, rule, rule2, head: headPlan(c, G, ui), c};
}

/* ---- painting ---- */
function trough(c, r, tok) {
  rr(c, r.x, r.y, r.w, r.h, 3, CONST.ol);
  c.save(); c.beginPath(); c.rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4); c.clip();
  c.fillStyle = tok.well; c.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
  for (let x = 0; x < r.w - 4; x += r.h - 4) wallCell(c, r.x + 2 + x, r.y + 2, r.h - 4, tok, {code: 1, veil: true});
  c.restore();
}
function paintVal(c, o, tok, dv) {
  const ph = dv === DEV.p;
  for (const p of o.val.P) {
    const r = p.r;
    if (p.k === "gkey") { key(c, r.x, r.y, r.w, r.h, p.kind, {tok, phone: ph}); padGlyph(c, p.g, r.x + (r.w - (p.g === "stick" ? 18 : 16) * (r.h * 0.55 / 16)) / 2, r.y + r.h / 2, r.h * 0.55, p.v, p.kind === "well" ? CONST.t2 : CONST.ink, CONST.off); }
    else if (p.k === "cap") key(c, r.x, r.y, r.w, r.h, p.kind, {tok, phone: ph, label: p.s, px: p.px});
    else if (p.k === "fixed") key(c, r.x, r.y, r.w, r.h, "wall", {tok, phone: ph, label: CW.FIXED, px: p.px});
    else if (p.k === "word" || p.k === "plus") text(c, p.s, p.x, p.y, p.f, p.col);
    else if (p.k === "cell") meterCell(c, r, p.kind, tok);
    else if (p.k === "glyph") mark(c, p.n, r.x, r.y, r.w, p.col);
    else if (p.k === "key") { key(c, r.x, r.y, r.w, r.h, p.kind, {tok, phone: ph}); if (p.glyph) mark(c, p.glyph, r.x + (r.w - 16) / 2, r.y + (r.h - 16) / 2, 16, p.kind === "well" ? CONST.off : CONST.ink); }
  }
}
function paintRow(c, o, tok, dv, foc) {
  const r = o.r;
  if (foc) { band(c, r.x, r.y, r.w, r.h, tok); focusBomb(c, r.x + 8, r.y + r.h / 2, dv.bombs); }
  text(c, o.label.s, o.label.x, o.label.y, o.label.f, foc && o.row.reset ? CONST.ink : o.label.col);
  if (o.dot) { c.fillStyle = CONST.ink; c.beginPath(); c.arc(o.dot.x, o.dot.y, 2.5, 0, 7); c.fill(); }
  if (o.swap) text(c, o.swap.s, o.swap.x, o.swap.y, o.swap.f, CONST.ink);
  paintVal(c, o, tok, dv);
}
/* a foot keycap: one small layer per word (or arrow), world and density, blitted (a kit key is ~40 canvas calls; the foot paints live, as its verb
   follows the focused row); straight onto the target with no canvas source */
function footCap(c, x, y, w, h, q, tok, ph, k) {
  const paint = (g) => { key(g, 0, 0, w, h, "key", {tok, phone: ph, ...(Array.isArray(q) ? {} : {label: q, px: DEV[ph ? "p" : "d"].sec})}); if (Array.isArray(q)) mark(g, q[0], (w - 13) / 2, (h - 13) / 2, 13, CONST.t2); };
  if (!(k > 0) || !canMake()) { c.save(); c.translate(x, y); paint(c); c.restore(); return; }
  const pw = Math.ceil((w + 2) * k), ph2 = Math.ceil((h + 6) * k), K = {layer: "controls.cap|" + JSON.stringify([q, +w.toFixed(2), +h.toFixed(2), ph]), biome: tok.name, level: 0, W: pw, H: ph2, dpr: +k.toFixed(4), look: "2d", textScale: textScale()};
  const L = layer(K, pw, ph2, (g) => { g.scale(k, k); g.translate(1, 1); paint(g); });
  touchK(keyOf(K));
  c.drawImage(L, x - 1, y - 1, pw / k, ph2 / k);
}
function paintFoot(c, Fp, tok, ph, k) {
  const dv = DEV[ph ? "p" : "d"];
  plaque(c, Fp.x, Fp.y, Fp.w, Fp.h, tok);
  for (const L of Fp.lines) for (const p of L.ps) {
    if (p.sep) text(c, p.sep, p.x, p.y, Fp.f, CONST.off);
    else if (p.cap) footCap(c, p.x, p.y - dv.caph / 2, p.w, dv.caph, p.cap, tok, ph, k);
    else text(c, p.t, p.x, p.y, Fp.f, CONST.t2);
  }
}
/* the base layer, at 1 device px a box unit (texture only): the plate and the pane's floor slab */
function paintBase(g, G, tok) {
  const d = G.d;
  plate(g, d.plate.x, d.plate.y, d.plate.w, d.plate.h, tok, {phone: d.dev === "p"});
  if (d.pane) slab(g, d.pane, tok);
}
/* the column layer at full dpr (every word and key at rest): the head, the tabs, the courses, the rows, the pager, and off the desk the name line */
function paintCol(g, G, Pl, tok, s, p) {
  const d = G.d, ph = d.dev === "p", dv = DEV[d.dev], H = Pl.head;
  if (H.kick) text(g, H.kick.s, H.kick.x, H.kick.y, H.kick.f, CONST.t2);
  if (H.back) { const r = H.back.r; key(g, r.x, r.y, r.w, r.h, "key", {tok, phone: ph}); mark(g, "chl", r.w > 60 ? r.x + 16 : r.x + (r.w - 18) / 2, r.y + r.h / 2 - 9, 18, CONST.ink); if (r.w > 60) text(g, H.back.s, r.x + 44, r.y + r.h / 2, LF(dv.pri), CONST.ink); }
  if (H.title) dsp(g, H.title.s, H.title.x, H.title.y, H.title.px);
  trough(g, d.trough, tok);
  for (const t of Pl.tabs) key(g, t.r.x, t.r.y, t.r.w, t.r.h, t.on ? "lit" : "well", {tok, phone: ph, label: t.s, px: t.px});
  for (const q of d.divs) if (q.p === p) course(g, q.r, tok);
  for (const l of G.pages[p]) paintRow(g, Pl.rows[l], tok, dv, false);
  if (d.keys) paintPager(g, d.keys, p, G.pages.length, tok, {f: LF(dv.sec), phone: ph});
  if (!d.pane && Pl.name && !s.capture) text(g, Pl.name.s, Pl.name.x, Pl.name.y, Pl.name.f, CONST.t2); // a rebind listening in place: its prompt paints there live
}
/* the pane's words (live: three fillText, measured once in the plan) */
const ruleAt = (Pl, row) => (row && row.id === "SW2" && Pl.rule2 && Pl.rule2.length ? Pl.rule2 : Pl.rule);
function paneWords(c, G, Pl, s, row) {
  const d = G.d, N = s.capture ? null : Pl.name;
  if (!d.pane) return;
  if (N) text(c, N.s, N.x, N.y, N.f, CONST.ink);
  if (N && N.note) text(c, N.note.s, N.note.x, N.note.y, N.note.f, CONST.t2, "right");
  if (Pl.rule && !s.capture) for (const q of ruleAt(Pl, row)) text(c, q.s, q.x, q.y, q.f, CONST.t2);
}
const paintStatic = (g, G, Pl, tok, s, p) => { paintBase(g, G, tok); paintCol(g, G, Pl, tok, s, p); };

/* ---- the drawings (padart), in the art box A ---- */
const SANS_F = (px) => "700 " + px + "px " + SANS; // padart's callout face (menudraw sans), measured so
const metrics = (c, dv) => { const ts = textScale(), m = mOf(c); return {pri: dv.pri * ts, sec: dv.sec * ts, wOf: (s, px) => W(m, SANS_F(px), s)}; };
/* the NO CONTROLLER body under this width (design px) is too small to read as locked (its lip under 4 CSS px: tools/ui/gates.mjs locked): the
   plaque alone stands in the art box (Task 3: the CONNECT row's ninth row leaves a 393 x 852 phone's drawing that small) */
export const LOCK_MIN = 112;
const fits = new Map();
const fitOnce = (k, fn) => { if (!fits.has(k)) { if (fits.size > 32) fits.clear(); fits.set(k, fn()); } return fits.get(k); };
function padArt(c, s, row, A, tok, ui) {
  const cap = s.capture, off = padOff(s), tgt = cap ? padRing(s, row.id) : null, lit = off ? {} : cap ? (tgt ? {[tgt]: "lit"} : {}) : padStates(s), it = off ? [] : cap ? (ui.call ? capCallouts(s, row.id) : []) : padCallouts(s), plq = off ? 56 : 0, ts = textScale();
  const F = fitOnce(["pad", A.w, A.h - plq, ts, JSON.stringify(it), JSON.stringify(lit)].join("|"), () => padFit(A.w, A.h - plq, it, metrics(c, ui.dv), lit, !!cap));
  const Wd = off ? F.W * 0.82 : F.W, ox = A.x + F.ox + (F.W - Wd) / 2, oy = A.y + F.oy, ring = off || !ui.focus ? null : cap ? tgt : padRing(s, row.id), bare = off && Wd < LOCK_MIN;
  if (!bare) drawPad(c, ox, oy, Wd, {tok, lit, lock: off, ring, press: s.echo, grips: row.id === "VIBRATION" && !off && !row.none && !!row.bar && row.bar[0] > 0, reduced: !!ui.reduced});
  if (F.plan) drawCallouts(c, ox, oy, F.plan, tok);
  let none = null;
  if (off) { const y = bare ? A.y + (A.h - plq) / 2 : A.y + A.h - plq, dv = ui.dv; none = [{s: CW.NONE, f: LF(dv.pri), px: dv.pri, y: y + 14, col: CONST.ink, role: "primary"}, {s: CAPTION.none, f: T.body(dv.bod), px: dv.bod, y: y + 40, col: CONST.t2, role: "body"}]; for (const q of none) { q.w = W(mOf(c), q.f, q.s); q.x = A.x + (A.w - q.w) / 2; text(c, q.s, q.x, q.y, q.f, q.col); } }
  if (!off && !cap && ui.warm && !(row.id === "VIBRATION")) { const a = c.globalAlpha; c.globalAlpha = 0; drawPad(c, ox, oy, Wd, {tok, lit, grips: true}); c.globalAlpha = a; } // the grips layer made with the page, so a cursor move onto VIBRATION never misses
  return {plan: F.plan, W: Wd, none, body: off && !bare ? R(ox + 0.06 * Wd, oy + 0.42 * Wd, 0.18 * Wd, 0.14 * Wd) : null, ox, oy, ring: ring && PART_AT[ring] ? {x: ox + PART_AT[ring][0] * Wd, y: oy + PART_AT[ring][1] * Wd, r: ringR(ring, Wd)} : null};
}
function keyArt(c, s, row, A, tok, ui) {
  const lit = s.capture ? {} : keyStates(s), it = s.capture ? (ui.call ? capCallouts(s, row.id) : []) : keyCallouts(s), ts = textScale();
  const ns = s.names && Object.keys(s.names).length ? JSON.stringify(s.names) : "", K = fitOnce(["key", A.w, A.h, ts, JSON.stringify(it), Object.keys(lit).sort().join(), ...(ns ? [ns] : [])].join("|"), () => { const m = metrics(c, ui.dv), F = kbFit(A.w, A.h, it, m); return {F, prints: kbPrints(F.k, lit, m.wOf, ts, s.names)}; });
  const {F, prints} = K, ox = A.x + F.ox, oy = A.y + F.oy, rk = ui.focus ? keyRing(s, row.id) : null;
  drawKeys(c, ox, oy, F.k, {tok, lit, ring: rk, prints, px: kbLegend(F.k, ts), names: s.names});
  if (F.plan) drawCallouts(c, ox, oy, F.plan, tok);
  const q = rk && KB_AT[rk] && keyRect(KB_AT[rk], F.k);
  return {plan: F.plan, ox, oy, ring: q ? {x: ox + q.x + q.w / 2, y: oy + q.y + q.h / 2, r: Math.max(q.w, q.h) / 2 + 4.5, w: q.w + 9, h: q.h + 9} : null};
}
/* SENSITIVITY under test: the stick's ring, the dead zone at the level, the dot, what it reads */
function stickView(c, s, A) {
  const r = Math.min(64, A.h / 2 - 8), x = A.x + A.w / 2 - 80, y = A.y + A.h / 2, dz = (s.dead == null ? 25 : s.dead) / 100, v = s.stickVal || [0, 0], out = !!s.reads, f = (n) => (n >= 0 ? "+" : "") + n.toFixed(2);
  c.strokeStyle = CONST.t2; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
  c.strokeStyle = CONST.off; for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; c.beginPath(); c.arc(x, y, r * dz, a, a + Math.PI / 12); c.stroke(); }
  c.fillStyle = CONST.ink; c.strokeStyle = CONST.ink; c.beginPath(); c.arc(x + v[0] * r, y + v[1] * r, 5, 0, 7); out ? c.fill() : c.stroke();
  const tx = x + r + 24, f2 = LF(DEV.d.sec);
  text(c, "X " + f(v[0]) + "  Y " + f(v[1]), tx, y - 22, f2, CONST.ink);
  text(c, CW.DRIFT + (s.drift || 0).toFixed(2), tx, y, f2, CONST.t2);
  text(c, CW.READS + (s.reads || CW.NOTHING), tx, y + 22, f2, out ? CONST.ink : CONST.t2);
}
/* the listening plate: the prompt over what is listened for (the controller with only the action's button lit and ringed, or a dashed key slot),
   the sub line and the cancel words (label first, keycap last). Static: nothing counts down. */
function capPlan(cap) {
  return String(cap.foot || "").split(" · ").map((q) => { for (const sfx of [CW.CANCELS, CW.KEEPS]) if (q.endsWith(sfx) && !/^TAP /.test(q)) return {t: sfx.trim(), caps: [q.slice(0, -sfx.length)]}; return {t: q, caps: []}; });
}
function paintCapture(c, G, s, tok, ui, row) {
  const cap = s.capture, B = G.dcap, dv = DEV[G.d.dev], ph = G.d.dev === "p", mid = B.x + B.w / 2, padOn = s.tab === "pad" && !padOff(s) && !(s.pad && s.pad.state === "nonstd");
  c.save(); c.globalAlpha = 0.6; c.fillStyle = CONST.ol; c.fillRect(G.d.plate.x - 40, G.d.plate.y - 40, G.d.plate.w + 80, G.d.plate.h + 80); c.restore();
  plate(c, B.x, B.y, B.w, B.h, tok, {phone: ph, T: 10});
  const mc0 = mOf(c), texts = [], caps = [], put = (t, y, f, px, col, role) => { const w = W(mc0, f, t); texts.push({s: t, x: mid - w / 2, y, w, px, col, role}); };
  const kick = CW.LISTEN + " " + cap.action, pp = Math.min(28, dv.ttl * 0.75);
  text(c, kick, mid, B.y + 18, LF(dv.sec), CONST.t2, "center"); put(kick, B.y + 18, LF(dv.sec), dv.sec, CONST.t2, "secondary");
  dsp(c, cap.prompt, mid, B.y + 46, pp, {align: "center"}); put(cap.prompt, B.y + 46, T.display(pp), pp, CONST.ink, "primary");
  const top = B.y + 66, room = B.h - 66 - 66;
  let ring = null;
  if (padOn) {
    const id = padRing(s, row.id), Wp = Math.min(150, B.w - 40, room / PAD_TALL), bx = padBox(Wp), px = mid - Wp / 2, py = top + (room - (bx.y1 - bx.y0)) / 2 - bx.y0;
    drawPad(c, px, py, Wp, {tok, lit: id ? {[id]: "lit"} : {}, ring: id});
    if (id && PART_AT[id]) ring = {x: px + PART_AT[id][0] * Wp, y: py + PART_AT[id][1] * Wp, r: ringR(id, Wp)};
  } else {
    const sw = 64, sh = 30, sx = mid - sw / 2, sy = top + (room - sh) / 2;
    c.strokeStyle = CONST.t2; c.lineWidth = 2;
    for (const [x0, y0, x1, y1] of [[sx, sy, sx + sw, sy], [sx + sw, sy, sx + sw, sy + sh], [sx + sw, sy + sh, sx, sy + sh], [sx, sy + sh, sx, sy]]) { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 7)); for (let i = 0; i < n; i++) { const a = i / n, b = (i + 0.57) / n; c.beginPath(); c.moveTo(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a); c.lineTo(x0 + (x1 - x0) * b, y0 + (y1 - y0) * b); c.stroke(); } }
  }
  if (cap.sub) { text(c, cap.sub, mid, B.y + B.h - 54, LF(dv.sec), cap.warn ? CONST.cor : CONST.t2, "center"); put(cap.sub, B.y + B.h - 54, LF(dv.sec), dv.sec, cap.warn ? CONST.cor : CONST.t2, "secondary"); }
  const its = capPlan(cap), f = LF(dv.sec), mc = mOf(c), parts = [];
  let x = 0;
  its.forEach((q, i) => { if (i) { parts.push({sep: "·", x: x + 10}); x += 10 + W(mc, f, "·") + 10; } parts.push({t: q.t, x}); x += W(mc, f, q.t); for (const k of q.caps) { const w = Math.max(dv.capw, W(mc, f, k) + 20); parts.push({cap: k, x: x + 8, w}); x += 8 + w; } });
  const x0 = mid - x / 2, fy = B.y + B.h - 24;
  for (const p of parts) {
    if (p.cap) { key(c, x0 + p.x, fy - dv.caph / 2, p.w, dv.caph, "key", {tok, phone: ph, label: p.cap, px: dv.sec}); caps.push(R(x0 + p.x, fy - dv.caph / 2, p.w, dv.caph)); const w = W(mc, f, p.cap); texts.push({s: p.cap, x: x0 + p.x + (p.w - w) / 2, y: fy, w, px: dv.sec, col: CONST.ink, role: "secondary"}); }
    else { text(c, p.sep || p.t, x0 + p.x, fy, f, p.sep ? CONST.off : CONST.t2); texts.push({s: p.sep || p.t, x: x0 + p.x, y: fy, w: W(mc, f, p.sep || p.t), px: dv.sec, col: p.sep ? CONST.off : CONST.t2, role: "secondary", ...(p.sep ? {} : {})}); }
  }
  return {ring, texts, caps};
}

/* ---- the probe record (outside any layer paint) ---- */
function record(G, Pl, s, ui, foc, live, dpr, el, touchy, pg, tok) {
  const u = G.u, d = G.d, b = (r) => [r.x * u, r.y * u, r.w * u, r.h * u], ts = textScale(), dv = DEV[d.dev], mc = Pl.c, cap = s.capture, plateCap = cap && !(d.art && d.name);
  const txt = (t, x, y, w, px, col, role, o = {}) => { if (t && w > 0) probe.text(t, x * u, (y - px * ts * CAP_K / 2) * u, Math.max(0.01, w * u), px * ts * CAP_K * u, {role, col, px: px * u, ...o}); };
  const info = (r, col, name, lock) => probe.pair("info", b(r), b(R(r.x - 8, r.y - 8, r.w + 16, r.h + 16)), {col, name, ...(lock ? {lock: true} : {})});
  probe.begin("controls", {w: G.W, h: G.H, dpr, el});
  probe.rect("plate", ...b(d.plate), {plate: G.T});
  if (plateCap) { /* a rebind listening on a plate over the page (col, phone): only the plate is read; the page under its veil is not */
    const B = G.dcap, C = live.cap;
    probe.rect("plate", ...b(B), {plate: 10});
    if (C && C.ring) ringPair(probe, b, C.ring, "capture", R(B.x + 8, B.y + 8, 20, 12));
    for (const t of C ? C.texts : []) txt(t.s, t.x, t.y, t.w, t.px, t.col, t.role);
    for (const k of C ? C.caps : []) probe.rect("foot cap", ...b(k));
    return;
  }
  const H = Pl.head;
  if (H.kick) txt(H.kick.s, H.kick.x, H.kick.y, H.kick.w, H.kick.px, CONST.t2, "secondary");
  if (H.title) txt(H.title.s, H.title.x, H.title.y, H.title.w || W(mc, T.display(H.title.px), H.title.s), H.title.px, CONST.ink, "primary");
  if (H.back) { const r = H.back.r, gx = r.w > 60 ? r.x + 14 : r.x + (r.w - 22) / 2; probe.rect("BACK", ...b(r), {touch: touchy, fill: tok.key}); if (r.w > 60) txt(H.back.s, r.x + 44, r.y + r.h / 2, W(mc, LF(dv.pri), H.back.s), dv.pri, CONST.ink, "primary"); probe.pair("info", b(R(gx, r.y + r.h / 2 - 11, 22, 22)), b(R(gx - 10, r.y + 6, 42, r.h - 12)), {col: CONST.ink, name: "back chevron"}); }
  Pl.tabs.forEach((t) => {
    const r = t.on ? R(t.r.x, t.r.y - 2, t.r.w, t.r.h) : t.r;
    probe.rect("tab " + t.s, ...b(r), {touch: touchy, set: "tabs", kind: "tab", fill: t.on ? tok.lit : tok.well});
    txt(t.s, r.x + (r.w - t.w) / 2, r.y + r.h / 2, t.w, t.px, t.on ? CONST.dk : CONST.t2, "primary");
  });
  const on = Pl.tabs.find((t) => t.on).r, off = Pl.tabs.find((t) => !t.on).r, face = (r, lift) => R(r.x + r.w - 20, r.y + 4 - lift, 14, r.h - 10);
  probe.pair("chosen", b(face(on, 2)), b(face(off, 0)), {name: "tab open vs not"});
  const N = cap ? live.name : Pl.name;
  if (N) { txt(N.s, N.x, N.y, N.w, N.px, d.pane ? CONST.ink : CONST.t2, d.pane ? "primary" : "secondary"); if (N.note) txt(N.note.s, N.note.x - (cap ? 0 : N.note.w), N.note.y, N.note.w, N.note.px, CONST.t2, "secondary"); }
  let fixedP = null, meterP = false;
  for (const l of G.pages[pg]) {
    const o = Pl.rows[l], f = l === foc, cr = f && live.capRow;
    probe.rect(l, ...b(o.r), {touch: touchy, set: "controls", kind: "list", focus: f, fill: f ? tok.band : tok.bedA});
    txt(o.label.s, o.label.x, o.label.y, o.label.w, o.label.px, f ? CONST.ink : o.label.col, "primary");
    if (o.swap && !cr) txt(o.swap.s, o.swap.x, o.swap.y, o.swap.w, o.swap.px, CONST.ink, "secondary");
    if (cr) { txt(cr.s, cr.x, cr.y, cr.w, cr.px, CONST.ink, "secondary"); continue; }
    const cells = o.val.P.filter((q) => q.k === "cell");
    for (const q of o.val.P) {
      if (q.k === "word" || q.k === "plus") txt(q.s, q.x, q.y, q.w, q.px, q.col, "secondary", q.col === CONST.off ? {lock: true} : {});
      else if (q.k === "cap") { const w = W(mc, LF(q.px), q.s); txt(q.s, q.r.x + (q.r.w - w) / 2, q.r.y + q.r.h / 2, w, q.px, CONST.ink, "secondary"); }
      else if (q.k === "fixed") { const w = W(mc, LF(q.px), CW.FIXED); fixedP = fixedP || q.r; txt(CW.FIXED, q.r.x + (q.r.w - w) / 2, q.r.y + q.r.h / 2, w, q.px, CONST.off, "secondary", {lock: true}); }
      else if (q.k === "glyph") info(R(q.r.x - 2, q.r.y - 2, q.r.w + 4, q.r.h + 4), q.col, l + " " + q.n, q.col === CONST.off);
      else if (q.k === "key" && q.glyph) { const r = q.r; probe.pair("info", b(R(r.x + (r.w - 20) / 2, r.y + (r.h - 20) / 2, 20, 20)), b(R(r.x + 3, r.y + 4, r.w - 6, r.h - 7)), {col: q.kind === "well" ? CONST.off : CONST.ink, name: l + " " + q.glyph, ...(q.kind === "well" ? {lock: true} : {})}); }
    }
    if (!meterP && cells.length && !o.row.off && !o.row.none) { const h = cells.find((q) => q.head), e = cells.find((q) => q.empty); if (h && e) { meterP = true; probe.pair("chosen", b(R(h.r.x + 1, h.r.y - 1, h.r.w - 2, h.r.h - 4)), b(R(e.r.x + 1, e.r.y + 1, e.r.w - 2, e.r.h - 4)), {name: "meter head vs empty " + l}); } }
  }
  /* locked parts: a FIXED input's wall plaque, the NO CONTROLLER body; each against the open tab */
  const body = live.art && live.art.body;
  const fo = G.pages[pg].map((l) => Pl.rows[l]).find((o) => o.id !== foc && o.val.x - (o.label.x + o.label.w) >= 60), floor = fo && b(R(o2x(fo), fo.r.y + 6, 30, fo.r.h - 12)); // a plain bed sample in a row at rest, between its label and its value
  if (fixedP) { probe.rect("locked fixed", ...b(fixedP)); probe.pair("locked", b(fixedP), b(R(on.x, on.y - 2, on.w, on.h)), {name: "FIXED plaque vs open tab", ...(floor ? {floor} : {})}); }
  if (body) { probe.rect("locked body", ...b(body)); probe.pair("locked", b(body), b(R(on.x, on.y - 2, on.w, on.h)), {name: "no controller body vs open tab", ...(floor ? {floor} : {})}); }
  const k = d.rows[foc];
  if (k) { const lx = Pl.rows[foc].label.x, a = R(k.x + 8 + dv.bombs + 2, k.y + 4, Math.max(4, lx - k.x - dv.bombs - 12), k.h - 8), bed = R(d.plate.x + 4, k.y, Math.max(4, k.x - d.plate.x - 6), k.h); probe.pair("band", b(a), b(bed), {name: "focus " + foc}); }
  if (live.ring && d.art) ringPair(probe, b, live.ring, cap ? "capture" : foc, R(d.art.x + 2, d.art.y + d.art.h - 22, 20, 20));
  if (live.plan) for (const L of live.plan.labels) for (const ln of L.lines) { const x = live.art.ox + L.x, tw = ln.tag || 0, w = ln.w; txt(ln.s, L.side === "l" ? x - tw - (tw ? 6 : 0) - w : x, live.art.oy + ln.y, w, ln.px / ts, ln.act ? CONST.ink : CONST.t2, ln.act ? "primary" : "secondary"); }
  if (live.art && live.art.none) for (const q of live.art.none) txt(q.s, q.x, q.y, q.w, q.px, q.col, q.role);
  if (Pl.rule && !cap) for (const q of ruleAt(Pl, rowsOf(s)[Math.min(s.row | 0, rowsOf(s).length - 1)])) txt(q.s, q.x, q.y, q.w, q.px, CONST.t2, "body");
  if (live.inuse) for (const q of live.inuse.lines) txt(q.s, q.x, q.y, q.w, q.px, q.col, q.role);
  if (live.status) for (const q of live.status) txt(q.s, q.x, q.y, q.w, q.px, q.col, "secondary");
  if (d.keys) { const f = LF(dv.sec), sL = pageLabel(pg, G.pages.length); txt(sL, d.keys.label.x, d.keys.label.y + d.keys.label.h / 2, W(mc, f, sL), dv.sec, CONST.t2, "secondary"); for (const [nm, r, on2] of [["PAGE UP", d.keys.up, pg > 0], ["PAGE DOWN", d.keys.dn, pg < G.pages.length - 1]]) { probe.rect(nm, ...b(r), {touch: touchy, set: "controls pages", kind: "step", fill: on2 ? tok.key : tok.well}); probe.pair("info", b(R(r.x + r.w / 2 - 11, r.y + r.h / 2 - 11, 22, 22)), b(R(r.x + 4, r.y + 5, r.w - 8, r.h - 9)), {col: on2 ? CONST.ink : CONST.off, name: nm, ...(on2 ? {} : {lock: true})}); } }
  const Fp = live.foot, fdv = d.dev === "p" ? DEV.p : DEV.d;
  if (Fp) {
    probe.rect("foot", ...b(Fp));
    for (const L of Fp.lines) for (const q of L.ps) {
      if (q.cap) { probe.rect("foot cap", ...b(R(q.x, q.y - fdv.caph / 2, q.w, fdv.caph))); if (!Array.isArray(q.cap)) { const w = W(mc, Fp.f, q.cap); txt(q.cap, q.x + (q.w - w) / 2, q.y, w, Fp.px, CONST.ink, "secondary"); } }
      else txt(q.sep || q.t, q.x, q.y, q.w, Fp.px, q.sep ? CONST.off : CONST.t2, "secondary", q.sep ? {lock: true} : {});
    }
  }
}
const o2x = (o) => o.label.x + o.label.w + 16;
/* the drawing's focus ring (3 px cream, 3 px off the button) against the surround */
function ringPair(pr, b, g, nm, bed) {
  const w = g.w || 2 * g.r, h = g.h || 2 * g.r, a = R(g.x - w / 2 - 2, g.y - h / 2 - 2, w + 4, h + 4);
  pr.rect("ring " + nm, ...b(a));
  pr.pair("ring", b(a), b(bed), {name: "drawing ring " + nm + " vs the pane's floor"}); // the surround: an empty corner of the slab the drawing sits on (the mock's ring vs plate)
}

/* ---- the frame ---- */
const outer = (d) => { const T0 = d.T, p = d.plate; return R(p.x - T0 - 2, p.y - T0 - 2, p.w + 2 * T0 + 4, p.h + 2 * T0 + 5); };
export const _dbg = {plans: 0, last: null};
let S = null;
const stMemo = new Map();
function statusLines(c, G, s, row) {
  const d = G.d, dv = DEV[d.dev], f = LF(dv.sec), B = d.status, lh = dv.sec * d.ts * 1.3;
  let say = (row.changed && !s.status && !s.armed && !s.swap ? CW.CHANGED + " · " : "") + statusOf(s, row); // a changed row: the dot by its label and the word here
  if (row.id === "SW2" && say === SW2_WORDS.help && d.rule) return []; // the pane's rule says it, at the pane's width
  if (!d.pane && row.id === "SENSITIVITY" && !padOff(s) && !s.status) say += " · " + CW.DRIFT + (s.drift || 0).toFixed(2) + " · " + CW.READS + (s.reads || CW.NOTHING);
  const k = [say, B.w, d.ts].join("|");
  if (!stMemo.has(k)) { if (stMemo.size > 32) stMemo.clear(); stMemo.set(k, lines(mOf(c), f, say, B.w, Math.max(1, Math.floor((B.h + 1) / lh)))); }
  const col = s.swap ? CONST.ink : CONST.t2;
  return stMemo.get(k).map((q, i, a) => ({s: q, f, px: dv.sec, x: B.x, y: B.y + B.h - (a.length - i - 0.5) * lh, w: W(mOf(c), f, q), col}));
}
/* the foot (desk, col) or a controller's cue line (phone): the items label first, keycap last; tap mode or a touch device reads the tap words on a
   foot, and a phone in tap mode has no line (its BACK key and the tabs say it) */
const footMemo = new Map();
function footOf(c, G, s, row, words, tap) {
  const d = G.d, dv = DEV[d.dev], box = d.foot || d.cue, it = tap ? null : footItems(s, row, words);
  if (!box || (!d.foot && !it)) return null;
  const key = JSON.stringify([it, box, d.ts]);
  if (!footMemo.has(key)) { if (footMemo.size > 32) footMemo.clear(); footMemo.set(key, footPlan(mOf(c), box, it, dv, box.h >= 88 ? 2 : 1, it ? null : [FOOT_TAP, BACK_TAP])); }
  return footMemo.get(key);
}
/** Paints the page for the frame F; s = the reducer's view; ui = {level (the room dressing it: the menus' or the one played), kicker (PAUSE's),
    paused, rev (MENU's build tag: the shared room's dpr), reduced (REDUCE FLASH), tap}. */
export function drawControlsPage(c, F, s, ui = {}) {
  if (!okBox(F) || !s) return;
  const level = ui.level | 0 || 1, tok = worldTokens(level), G = controlsGeom(F, s), u = G.u, words = hints(), ts = textScale(), touchy = !!F.touch, paused = !!(ui.paused || F.paused);
  const dev = deviceScale(c), dpr = capDpr(dev, touchy), tap = tapAt(touchy, F.tap != null ? F.tap : ui.tap), pg = pageAt(G, s), list = rowsOf(s), row = list[Math.min(s.row | 0, list.length - 1)];
  const sig = JSON.stringify([level, G.mode, +u.toFixed(6), list, words.dev, words.ok, words.back, tap, s.tab, s.pad && s.pad.state, s.pad && s.pad.name, s.swap, s.armed, !!s.capture, ui.kicker == null ? null : ui.kicker, ts, dpr, paused, pg, F.W, F.H]);
  if (!S || S.sig !== sig || S.G !== G || S.c !== c) {
    const Pl = plan(c, G, s, ui), d0 = G.d, ob = outer(d0), pb = sc(ob, u), bw = Math.round(pb.w), bh = Math.round(pb.h);
    /* the column layer's rect: the left column on the desk (the pane's words paint live), the whole plate off it */
    const cr = d0.pane ? R(ob.x, ob.y, d0.list.x + d0.list.w + 8 - ob.x, d0.list.y + d0.list.h + 8 - ob.y) : ob, cb = sc(cr, u), cw = Math.round(cb.w * dpr), ch = Math.round(cb.h * dpr);
    const K = {biome: tok.name, level, W: F.W, H: F.H, look: "2d", textScale: ts}, baseKey = {...K, dpr: 1, layer: "controls.base|" + JSON.stringify([G.mode, +u.toFixed(6), d0.plate, d0.pane])}, colKey = {...K, dpr, layer: "controls.col|" + sig};
    const art = d0.art ? 2 * Math.min(d0.art.w * d0.art.h, 470 * 350) * (u * dpr) ** 2 * 4 : 0; // the drawing's layer and its VIBRATION twin beside the page's own, so the room holds MENU's dpr where they fit
    const rd = pageRoomDpr(c, F, {rev: ui.rev}, dpr, bw * bh * 4 + cw * ch * 4 + art);
    S = {sig, G, c, Pl, ob, pb, bw, bh, cr, cb, cw, ch, baseKey, baseK: keyOf(baseKey), colKey, colK: keyOf(colKey), rd, roomK: roomKey({w: F.W, h: F.H}, level, tok, {dpr: rd, look: "2d", textScale: 1, play: F.play}), room: null, base: null, col: null};
    _dbg.plans++;
    if (canMake() && typeof c.drawImage === "function" && !s.capture) { c.save(); c.globalAlpha = 0; for (let i = 0; i < list.length; i++) { const q = footOf(c, G, {...s, row: i}, list[i], words, tap); if (q) paintFoot(c, q, tok, G.d.dev === "p", dpr * u); } c.restore(); } // every row's keycaps made with the page, so a cursor move never misses
  }
  const Pl = S.Pl, d = G.d, dv = DEV[d.dev], cap = s.capture, capIn = !!cap && !!d.art && !!d.name, focus = tap && !cap ? null : row.id, warm = !S.warm;
  const live = {ring: null, status: null, foot: null, plan: null, art: null, name: null, capRow: null, inuse: null};
  S.warm = true;
  _dbg.last = {G, Pl, foc: focus, pg, live};
  if (typeof c.clip !== "function" || typeof c.rect !== "function") return;
  if (canMake()) {
    if (S.base && S.base.width) touchK(S.baseK);
    if (S.col && S.col.width) touchK(S.colK);
    if (!paused) { if (!S.room || !S.room.width) S.room = roomLayer({w: F.W, h: F.H}, level, tok, {dpr: S.rd, look: "2d", textScale: 1, play: F.play}); else touchK(S.roomK); }
    if (!S.base || !S.base.width) S.base = layer(S.baseKey, S.bw, S.bh, (g) => { g.scale(u, u); g.translate(-S.ob.x, -S.ob.y); paintBase(g, G, tok); });
    if (!S.col || !S.col.width) S.col = layer(S.colKey, S.cw, S.ch, (g) => { g.scale(dpr * u, dpr * u); g.translate(-S.cr.x, -S.cr.y); paintCol(g, G, Pl, tok, s, pg); });
    c.save(); c.imageSmoothingEnabled = true;
    if (!paused) c.drawImage(S.room, 0, 0, F.W, F.H);
    c.drawImage(S.base, S.pb.x, S.pb.y, S.pb.w, S.pb.h);
    c.drawImage(S.col, S.cb.x, S.cb.y, S.cb.w, S.cb.h);
    c.restore();
  } else {
    c.save();
    if (!paused) { c.fillStyle = toL(tok.bg1, 0.004); c.fillRect(0, 0, F.W, F.H); }
    c.scale(u, u); paintStatic(c, G, Pl, tok, s, pg); c.restore();
  }
  c.save(); c.scale(u, u);
  paneWords(c, G, Pl, s, row);
  const fo = focus && Pl.rows[focus] && G.pages[pg].includes(focus) ? Pl.rows[focus] : null;
  if (fo && cap) { /* the row listening: its band, bomb and label, the prompt where its binds stood */
    band(c, fo.r.x, fo.r.y, fo.r.w, fo.r.h, tok); focusBomb(c, fo.r.x + 8, fo.r.y + fo.r.h / 2, dv.bombs); text(c, fo.label.s, fo.label.x, fo.label.y, fo.label.f, CONST.ink);
    const f = LF(dv.sec), w = W(mOf(c), f, cap.prompt);
    live.capRow = {s: cap.prompt, f, px: dv.sec, x: fo.r.x + fo.r.w - 12 - w, y: fo.r.y + fo.r.h / 2, w};
    text(c, cap.prompt, live.capRow.x, live.capRow.y, f, CONST.ink);
  } else if (fo) paintRow(c, fo, tok, dv, true);
  const off = padOff(s), U = capIn ? inUsePlan(c, G, s, row) : null, A = U ? U.art : d.art;
  if (A && (!cap || capIn)) {
    const ux = {focus: !!focus, reduced: !!ui.reduced, dv: d.pane ? DEV.d : DEV.p, warm, call: capIn && !!d.pane};
    if (!cap && row.id === "SENSITIVITY" && !off && s.tab === "pad" && d.pane) stickView(c, s, A);
    else if (s.tab === "key") live.art = keyArt(c, s, row, A, tok, ux);
    else if (s.pad && s.pad.state === "nonstd") text(c, CW.NO_DRAWING, A.x + A.w / 2, A.y + A.h / 2, LF(dv.sec), CONST.t2, "center");
    else live.art = padArt(c, s, row, A, tok, ux);
    if (live.art) { live.ring = live.art.ring; live.plan = live.art.plan; }
  }
  if (capIn) { /* the pane listens (the -capture frame): the prompt for the action over the drawing, NO TIME LIMIT, the sub line, the cancel foot */
    const nd = d.pane ? DEV.d : dv, N = d.name, f = LF(d.pane ? DEV.d.pri : dv.sec), sf = LF(DEV.d.sec), say = cap.prompt + CW.FOR + cap.action, w = W(mOf(c), f, say), nw = W(mOf(c), sf, CW.NO_LIMIT);
    live.name = {s: say, f, px: d.pane ? DEV.d.pri : dv.sec, x: N.x, y: N.y + N.h / 2, w, note: d.pane && w + 24 + nw <= N.w ? {s: CW.NO_LIMIT, f: sf, px: DEV.d.sec, x: N.x + N.w - nw, y: N.y + N.h / 2, w: nw} : null};
    text(c, say, N.x, live.name.y, f, d.pane ? CONST.ink : CONST.t2); void nd;
    if (live.name.note) text(c, CW.NO_LIMIT, live.name.note.x, live.name.note.y, sf, CONST.t2);
  }
  if (U) { plaque(c, U.box.x, U.box.y, U.box.w, U.box.h, tok); for (const q of U.lines) text(c, q.s, q.x, q.y, q.f, q.col); live.inuse = U; }
  live.status = capIn ? capLines(c, G, cap) : cap ? [] : statusLines(c, G, s, row);
  for (const q of live.status) text(c, q.s, q.x, q.y, q.f, q.col);
  live.foot = capIn ? capFoot(c, G, cap) : cap ? null : footOf(c, G, s, row, words, tap);
  if (live.foot) paintFoot(c, live.foot, tok, d.dev === "p", dpr * u); // live: its words are memoised (nothing measured on a steady frame), its keycaps small layers
  if (cap && !capIn) { const C = paintCapture(c, G, s, tok, ui, row); live.ring = C.ring; live.cap = C; }
  c.restore();
  if (probe.probe.on) record(G, Pl, s, ui, focus, live, dpr, F.shell ? "sh" : "c", touchy, pg, tok);
}
/* listening (Task 9.10, the -capture frames): the in-use plaque, what happens when the pressed input already does another action, with the swap
   line the page would say. Desk: under the drawing, over the rule's place, the head, the mock's sentence and the line; the drawing gives up the
   height. Phone: the short head and the line's two halves beside a controller (p-05-capture), under a keyboard (a wide drawing). None where the
   drawing would keep too little room or a word would not fit whole. {box, art (the drawing's box left), lines}. */
const useMemo = new Map();
function inUsePlan(c, G, s, row) {
  const d = G.d, A = d.art, ex = inUseLine(s, row.id), ts = d.ts;
  if (!A || !ex) return null;
  const k = JSON.stringify([s.tab, ex, A, d.rule, d.mode, ts]);
  if (useMemo.has(k)) return useMemo.get(k);
  const mc = mOf(c), out = [], put = (ls, f, px, lh, col, role, x, y) => { ls.forEach((q, i) => out.push({s: q, f, px, x, y: y + (i + 0.5) * lh, w: W(mc, f, q), col, role})); return y + ls.length * lh; };
  let U = null;
  if (d.pane && d.rule) {
    const dv = DEV.d, pad = 16, iw = A.w - 2 * pad, fh = LF(dv.pri), fb = T.body(dv.bod), fe = LF(dv.sec), lh = [dv.pri * ts * 1.25, dv.bod * ts * 1.4, dv.sec * ts * 1.35];
    const L = [wrap(mc, fh, s.tab === "key" ? CW.IN_USE_KEY : CW.IN_USE, iw, 2), wrap(mc, fb, CW.SWAPS, iw, 3), wrap(mc, fe, ex, iw, 2)];
    if (L.every(Boolean)) {
      const h = 12 + L[0].length * lh[0] + 4 + L[1].length * lh[1] + 4 + L[2].length * lh[2] + 12, y = d.rule.y + d.rule.h - h, art = R(A.x, A.y, A.w, y - 10 - A.y);
      if (art.h >= 160) {
        let ty = put(L[0], fh, dv.pri, lh[0], CONST.ink, "primary", A.x + pad, y + 12) + 4;
        ty = put(L[1], fb, dv.bod, lh[1], CONST.t2, "body", A.x + pad, ty) + 4;
        put(L[2], fe, dv.sec, lh[2], CONST.t2, "secondary", A.x + pad, ty);
        U = {box: R(A.x, y, A.w, h), art, lines: out};
      }
    }
  } else if (d.dev === "p") {
    const dv = DEV.p, f = LF(dv.sec), lh = dv.sec * ts * 1.3, parts = [CW.IN_USE_SHORT, ...ex.split(" · ")], side = s.tab !== "key";
    for (const k0 of side ? [0.4, 0.46, 0.52] : [1]) {
      const pw = side ? Math.min(Math.round(A.w * k0), 220) : A.w, L = parts.map((q) => wrap(mc, f, q, pw - 24, 3));
      if (!L.every(Boolean)) continue;
      const h = 12 + L.reduce((a, q) => a + q.length * lh, 0) + (L.length - 1) * 4 + 12, box = side ? R(A.x + A.w - pw, A.y + (A.h - h) / 2, pw, h) : R(A.x, A.y + A.h - h, A.w, h);
      const art = side ? R(A.x, A.y, A.w - pw - 10, A.h) : R(A.x, A.y, A.w, A.h - h - 10);
      if (h > A.h || art.w < 150 || art.h < 60) continue;
      let ty = box.y + 12;
      L.forEach((q, i) => { ty = put(q, f, dv.sec, lh, i ? CONST.t2 : CONST.ink, "secondary", box.x + 12, ty) + 4; });
      out.length = out.length; U = {box, art, lines: out};
      break;
    }
  }
  if (useMemo.size > 32) useMemo.clear();
  useMemo.set(k, U);
  return U;
}
const capLines = (c, G, cap) => { const d = G.d, dv = DEV[d.dev], f = LF(dv.sec), B = d.status, lh = dv.sec * d.ts * 1.3, say = d.foot && capFoot(c, G, cap) ? cap.sub || "" : [cap.sub, ...capPlan(cap).map((q) => q.t + (q.caps.length ? " " + q.caps.join(" ") : ""))].filter(Boolean).join(" · "), ls = lines(mOf(c), f, say, B.w, Math.max(1, Math.floor((B.h + 1) / lh))); return ls.map((q, i) => ({s: q, f, px: dv.sec, x: B.x, y: B.y + B.h - (ls.length - i - 0.5) * lh, w: W(mOf(c), f, q), col: cap.warn ? CONST.cor : CONST.t2})); };
const capFoot = (c, G, cap) => { const d = G.d; if (!d.foot) return null; const k = JSON.stringify(["cap", cap.foot, d.foot, d.ts]); if (!footMemo.has(k)) footMemo.set(k, footPlan(mOf(c), d.foot, capPlan(cap), DEV.d, d.foot.h >= 88 ? 2 : 1)); return footMemo.get(k); };
/** The adapter the shell and the tests call with a menudraw layout: the frame of L (layout(W, H, lg, css)) on a touch layout or not. */
export const frameOfL = (L, touch, o = {}) => ({W: L.W, H: L.H, touch: !!touch, shell: !!L.shell, css: L.css, ...o});
