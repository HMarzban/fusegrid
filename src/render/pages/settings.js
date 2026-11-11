/* SETTINGS AND GRAPHICS PAGES (UI upgrade v202 Task 3.4; design record §4, §5; appendix 2-5, 7.1; the round 7 S7-menu 04-settings / 04-settings-3d
   frames). Lazy (R20): pages/lazy.js loads this module and menudraw keeps the entry names, painting a LOADING plate until it lands. The room the
   player is in (ui.level) dresses the stage: its room look (kit room.js) opaque over the whole canvas, its rampart round the plate; on a PAUSE view
   (ui.paused) the plate sits over the frozen board and its veil instead. Every row is a lane of the board: label left, one game part right (MUSIC
   and SFX a meter of bricks, BRIGHTNESS one of seven; SOUND, SCREEN SHAKE, REDUCE FLASH, ANALYTICS and the GRAPHICS ON / OFF rows a rocker; ART
   STYLE, CAMERA and every other GRAPHICS value a stepper of stepped keys round a well window; GRAPHICS and CONTROLS doors; RESET DEFAULTS danger),
   groups split by wall courses, the focused row the band with the bare bomb at its start (no ring: no key here takes focus).
   settingsGeom(F, rows) / graphicsGeom(F, rows) are the one geometry for draw and tap: rects by ROW NAME in box units (G.d: design px; u box units
   per design px). F = {W, H, touch, shell, css, ts} as the MENU page's. Three arrangements. desk: a keyboard box (or a touch landscape shell box)
   that holds the two columns at u >= DESK_U: list beside the preview pane (SETTINGS: the three art styles; GRAPHICS: the focused row's help), the
   foot in the pane. col: any other box (a keyboard #c, PAUSE's overlayBox, the iso guard; a touch #c takes the phone column, R1 landscape): the list alone, the foot at the plate's bottom,
   scaled as one piece on keys. phone: a touch-portrait shell box, the column in CSS px (u = 1 / css) with a BACK key beside the title, steppers as
   door rows, the foot under the plate. On every touch box rows are >= 44 CSS px and >= 8 apart; where they do not fit the list pages (PAGING
   below). F.paused (a PAUSE view) keeps the plate off the HUD strip; F.focus (the focused row) picks the page on screen for a tap.
   A row owns its rect and half of each gap round it, out to the plate's edge; *Hit returns the index into rows (the visible list optRow indexes,
   R11), -1 on BACK or off the plate, -2 on the plate off the rows (inert), {k: "page", d, to: the row its page opens on} on a page key (kit pager
   pageKeyAt; to null at an end: inert); a zero box is -1.
   drawSettingsPage(c, F, ui, t): ui = {rows, row (the focused LABEL), vals (nb.settings.v1), r3d, px, togT, rev, kicker, door ("AUTO ›"), ctlDoor
   ("KEYBOARD ›"), padVib (the VIBRATION level or ""), ana, anaNote, job (menudraw lookNote's note), level, paused}. drawGraphicsPage(c, F, ui, t):
   ui = {row (an index), view {rows [{label, val, locked, help1, help2}]}, togT, chg, kicker, level, paused, rev (MENU's build tag: the shared room's dpr)}. Values are words; a door's trailing ›
   is drawn as the chevron. Cached (kit cache.js, recency touched on a steady frame): the room (MENU's own roomLayer at MENU's room dpr, menu.js
   roomDpr, unless this page's full-dpr layer cannot sit beside it in the budget; the LOADING plate makes the same one) and
   one page layer: the plate, its head, every row at rest with its value, the courses, the pane and the foot, keyed by what it shows, so a cursor
   move never misses and a value change re-rasters once. Live: the focused row (band, bomb, label, value), the 120 ms flash of a changed value, the
   ART STYLE row's load line, GRAPHICS' pane text. A context that cannot measure plans on a 0.6 em estimate; with no canvas source (Node) the page
   paints straight onto the target; a context with no clip or rect gets the plan only. Under the probe it records its rects, texts and squint pairs
   outside any layer paint. */
import {LABEL, ART_STYLES, SETTINGS_WORDS as COPY} from "../words.js";
import {worldTokens, CONST, toL} from "../kit/tokens.js";
import {key, plate, band, focusBomb, glyph, wallCell, capW, cap, plaque, rfill as rr} from "../kit/paint.js";
import {T, DEV, measure, measure as W, textScale, dsp, measurer as mOf, text, CAP_K} from "../kit/type.js";
import {deep, R, sc, okBox, inR, big} from "../kit/geom.js";
import {layer, capDpr, touch as touchK, keyOf, canMake} from "../kit/cache.js";
import {roomLayer, pageRoomDpr} from "../kit/room.js";
import * as probe from "../kit/probe.js";
import {paginate as pagesOf, pagerKeys, pageLabel, pageKeyAt, paintPager as kitPager, keySide, pageOfFocus} from "../kit/pager.js";
import {deviceScale} from "../logo/draw2d.js";
import {hints, tapMode} from "../hintcopy.js";
import {lookVal, FOOT_TAP, BACK_TAP} from "../kit/copy.js";

export const DESK = deep({
  d: {pad: [16, 22, 20, 22], list: 480, pane: 400, gap: 20, row: 38, grp: 12, kick: true, below: 12, paneMin: 452},
  d125: {pad: [12, 22, 14, 22], list: 540, pane: 440, gap: 20, row: 36, grp: 12, kick: false, below: 10, paneMin: 452},
});
export const COL = deep({c: {pad: [14, 18, 14, 18], list: 480, row: 34, grp: 10, below: 10, ttl: 32}, c125: {pad: [12, 18, 12, 18], list: 540, row: 36, grp: 10, below: 8, ttl: 32}});
export const PHONE = deep({p: {top: 14, bot: 12, side: 12, pad: [12, 12, 14, 12], row: 52, grp: 10, back: 112, below: 12, fgap: 14, max: 600}, p125: {top: 12, bot: 10, side: 12, pad: [10, 12, 12, 12], row: 52, grp: 10, back: 124, below: 10, fgap: 12, max: 600}});
export const TOUCH = Object.freeze({h: 44, g: 8}), DESK_U = 0.8, GUT = 8, SLAB = 10, FOOT1 = 50, FOOT2 = 88;
/* the GRAPHICS rows, pinned equal to src/app/gfx.js GRAPHICS GFX_ROWS (this module cannot import src/app) */
export const GFX_LABELS = Object.freeze(["QUALITY", "FRAME RATE", "RESOLUTION", "SHADOWS", "ANTI-ALIAS", "EFFECTS", "DEMO", "FPS METER"]);
/* a wall course before each of these rows: audio · look · comfort · privacy · doors · reset; GRAPHICS: preset · rows · meter */
export const GROUP = Object.freeze(["ART STYLE", "SCREEN SHAKE", "ANALYTICS", "GRAPHICS", "RESET DEFAULTS", "FRAME RATE", "FPS METER"]);
export {COPY}; // words.js SETTINGS_WORDS (the one table)
const CAM_NAME = COPY.cam;

/* the rows' vertical run: heights hs and the gap before each (a course before a GROUP row), design px; on a touch box (fl, the floors in box
   units) every row is >= 44 CSS px and every gap >= 8 (lead ruling, fix round 1) */
function run(rows, row, grp, fl, u) {
  const hs = rows.map(() => (fl ? Math.max(row, fl.h / u) : row)), gs = rows.map((l, i) => (!i ? 0 : GROUP.includes(l) ? Math.max(grp, fl ? fl.g / u : 0) : fl ? fl.g / u : 0));
  return {hs, gs, h: hs.reduce((a, h, i) => a + h + gs[i], 0)};
}
/* pages of row indices, each at most cap tall (a course at a page's top is dropped; kit pager.js); one page holds everything when cap is Infinity */
const paginate = (S, cap) => pagesOf(S.hs, S.gs, cap);
/* every row's rect on its own page (each page laid from y0), its tap rect (half of each gap round it on that page, out to x0..x1; a page's first
   row from top0 above, its last to bot1 below) and the courses, each with its page */
function lay(rows, pages, S, x, y0, w, x0, x1, top0, bot1) {
  const out = {}, hit = {}, divs = [], pageOf = {};
  let bot = y0;
  pages.forEach((pg, p) => {
    let y = y0;
    pg.forEach((i, k) => {
      const l = rows[i], g = k ? S.gs[i] : 0;
      if (g && GROUP.includes(l)) divs.push({r: R(x, y + g / 2 - 1, w, 2), p}); // a course between groups; the touch floor's 8 px between rows is bare bed
      y += g;
      out[l] = R(x, y, w, S.hs[i]); pageOf[l] = p; y += S.hs[i];
    });
    pg.forEach((i, k) => {
      const l = rows[i], r = out[l], up = k ? S.gs[i] / 2 : top0, dn = k === pg.length - 1 ? bot1 : S.gs[pg[k + 1]] / 2;
      hit[l] = R(x0, r.y - up, x1 - x0, r.h + up + dn);
    });
    bot = Math.max(bot, y);
  });
  return {out, hit, divs, pageOf, bot};
}
const headH = (ts, kick, ttl) => (kick ? DEV.d.sec * ts * 1.2 + 6 : 0) + ttl * ts * 1.1;
/* the largest u at which fits(u) holds, from u0 down (fits is monotone in u: the floored part is fixed in box units); 0 when none does */
function solve(u0, fits) {
  if (fits(u0)) return u0;
  let lo = 0, hi = u0;
  for (let i = 0; i < 48; i++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
  return lo;
}
/* PAGING (lead ruling, fix round 1): on a touch box the rows keep >= 44 CSS px and the courses >= 8 (fl, in box units). Where every row does not
   fit at a scale >= PAGE_U the list pages: as many whole rows as fit, and a strip of two page keys (>= 44 CSS px each, >= 8 apart) under them;
   at least MIN_ROWS rows a page (the page shrinks toward FLOOR_U for them). Keys and a controller turn the page with the focus (the page shown is
   the focused row's); a tap on a page key focuses the first row of the page it opens. The keys are the kit pager's (PAGE_KEY CSS px). */
export const PAGE_U = 0.7, FLOOR_U = 0.5, MIN_ROWS = 3;
const keyH = (dv, fl, u) => Math.max(DEV[dv].keyh, fl ? keySide(TOUCH.h / fl.h, u) : 0);
function desk(F, rows, ts, fl) {
  const D = DESK[big(ts) ? "d125" : "d"], T0 = DEV.d.T, head = headH(ts, D.kick, DEV.d.ttl), mx = T0 + 2 + GUT, my = T0 + 3 + GUT;
  const at = (u, q) => { const S = run(rows, D.row, D.grp, q, u), colH = Math.max(S.h, D.paneMin); return {S, colH, ph: D.pad[0] + head + D.below + colH + D.pad[2]}; };
  const pw = D.pad[3] + D.list + D.gap + D.pane + D.pad[1];
  const u = solve(Math.min(1, F.W / (pw + 2 * mx)), (v) => v * (at(v, fl).ph + 2 * my) <= F.H);
  const {S, colH, ph} = at(u, fl), Wd = F.W / u, Hd = F.H / u, px = (Wd - pw) / 2, py = Math.max(my, (Hd - ph) / 2);
  const hy = py + D.pad[0], top = hy + head + D.below, lx = px + D.pad[3], pages = paginate(S, Infinity);
  const L = lay(rows, pages, S, lx, top, D.list, px, lx + D.list + D.gap / 2, D.below / 2, D.pad[2] / 2);
  const pane = R(lx + D.list + D.gap, top, D.pane, colH);
  return {mode: "desk", dev: "d", u, ts, T: T0, plate: R(px, py, pw, ph), head: R(lx, hy, pw - D.pad[1] - D.pad[3], head), kick: D.kick, ttl: DEV.d.ttl,
    rows: L.out, hit: L.hit, divs: L.divs, pageOf: L.pageOf, pages: pages.map((pg) => pg.map((i) => rows[i])), keys: null, pane,
    foot: R(pane.x + SLAB + 12, pane.y + pane.h - SLAB - 12 - FOOT2, pane.w - 2 * (SLAB + 12), FOOT2), back: null, list: R(lx, top, D.list, L.bot - top)};
}
/* GRAPHICS off the desk has no pane: its two help lines sit under the rows */
const helpH = (dv, ts) => 2 * DEV[dv].sec * ts * 1.3 + 8;
/* a touch board canvas too short for one row a page: the plate's ring 12 off the box (its 10 px ring inside), the head and the pads closed */
const LAND_TIGHT = Object.freeze({top: 12, bot: 12, pad: Object.freeze([6, 12, 8, 12]), below: 8});
const HINT_H = DEV.d.caph + 6; // a paged column's back-out hint line under its page keys
/* PAUSE keeps the HUD strip (y < 40) clear, and on a keyboard box the old CONSOLE band (H x 0.16 - 10 .. H - 28) */
const pauseBand = (F) => [44, F.touch ? F.H - 8 : F.H - 28];
function col(F, rows, ts, fl, help) {
  const C = COL[big(ts) ? "c125" : "c"], dv = "d", T0 = DEV[dv].T, head = headH(ts, true, C.ttl), mx = T0 + 2 + GUT / 2, my = T0 + 3 + GUT / 2, hh = help ? helpH(dv, ts) : 0;
  const [b0, b1] = F.paused ? pauseBand(F) : [0, F.H], Hb = b1 - b0, pw = C.pad[3] + C.list + C.pad[1], u0 = Math.min(1, F.W / (pw + 2 * mx));
  const chrome = C.pad[0] + head + C.below + hh + C.pad[2];
  const all = (u) => { const S = run(rows, C.row, C.grp, fl, u); return {S, ph: chrome + S.h + 8 + FOOT1}; };
  let u = solve(u0, (v) => v * (all(v).ph + 2 * my) <= Hb), S, ph, pages, keys = null, cap = Infinity, kh = 0;
  const kgOf = (v) => Math.max(8, fl ? fl.g / v : 0); // the rows to the page keys: 8 CSS px on a touch box
  if (!fl || u >= PAGE_U) ({S, ph} = all(u)), (pages = paginate(S, Infinity));
  else { /* page: the rows that fit under the head, the page keys' strip under them, no foot (the strip carries the page), and under the strip
             one hint line that keeps the way back (BACK and its keycap, or the tap rule's back-out words; R1 kit leftover) */
    const capOf = (v) => Hb / v - 2 * my - chrome - kgOf(v) - keyH(dv, fl, v) - HINT_H;
    const rowsAt = (v) => paginate(run(rows, C.row, C.grp, fl, v), capOf(v))[0].length;
    u = u0;
    if (rowsAt(u) < Math.min(MIN_ROWS, rows.length)) u = Math.max(FLOOR_U, solve(u0, (v) => capOf(v) > 0 && rowsAt(v) >= Math.min(MIN_ROWS, rows.length)));
    S = run(rows, C.row, C.grp, fl, u); kh = keyH(dv, fl, u); cap = Math.max(capOf(u), S.hs[0]); pages = paginate(S, cap);
    if (pages.length < 2) { cap = Infinity; pages = [pages.flat()]; }
    ph = chrome + (pages.length > 1 ? cap + kgOf(u) + kh + HINT_H : S.h + 8 + FOOT1);
  }
  const Wd = F.W / u, px = (Wd - pw) / 2, py = Math.max(b0 / u + my, (b0 + Hb / 2) / u - ph / 2);
  const hy = py + C.pad[0], top = hy + head + C.below, lx = px + C.pad[3], paged = pages.length > 1;
  const L = lay(rows, pages, S, lx, top, C.list, px, px + pw, C.below / 2, 4), lb = paged ? top + cap : L.bot;
  if (paged) keys = pagerKeys(lx, lb + hh + kgOf(u), C.list, kh);
  return {mode: "col", dev: dv, u, ts, T: T0, plate: R(px, py, pw, ph), head: R(lx, hy, C.list, head), kick: true, ttl: C.ttl,
    rows: L.out, hit: L.hit, divs: L.divs, pageOf: L.pageOf, pages: pages.map((pg) => pg.map((i) => rows[i])), keys, pane: null,
    help: hh ? R(lx, lb + 4, C.list, hh - 4) : null, foot: paged ? null : R(px + 8, lb + hh + 8, pw - 16, FOOT1), back: null, list: R(lx, top, C.list, lb - top), // the foot may use the plate's sides
    hint: paged ? R(lx, lb + hh + kgOf(u) + kh + 6, C.list, DEV[dv].caph) : null};
}
/* phone: the column in CSS px. Also every touch board canvas (#c with no shell box: a landscape phone; R1 landscape, land): there it
   pages where the rows do not fit (the kit pager's strip under them) and, paged, drops the foot: the BACK key beside the title keeps the way back, so
   the strip holds only PAGE n OF m and its keys (a PAUSE view keeps its column) */
function phone(F, rows, ts, help, land) {
  let P = PHONE[big(ts) ? "p125" : "p"];
  const css = F.css > 0 ? F.css : 1, hh = help ? helpH("p", ts) : 0, u = 1 / css, Hd = F.H / u, Wd = F.W / u;
  const b0 = 0, Hb = Hd, footH = P.fgap + FOOT1 + 4;
  const fixedOf = (q) => q.top + q.pad[0] + DEV.p.btnh + q.below + hh + q.pad[2] + footH + q.bot, S = run(rows, TOUCH.h, P.grp, TOUCH, 1); // 44 CSS px rows 8 apart: the mock's 52 pitch
  const capOf = (q) => Hb - fixedOf(q) + (land ? footH : 0) - 8 - keySide(css, u);
  if (land && fixedOf(P) + S.h > Hb && capOf(P) < S.hs[0]) P = {...P, ...LAND_TIGHT}; // a page short of one row: the margins and pads close first
  let pages, cap = Infinity, keys = null;
  if (fixedOf(P) + S.h <= Hb) pages = paginate(S, Infinity);
  else { cap = Math.max(capOf(P), S.hs[0]); pages = paginate(S, cap); }
  const paged = pages.length > 1, foot = !(land && paged), lh = paged ? cap : S.h, ph = P.pad[0] + DEV.p.btnh + P.below + lh + hh + (paged ? 8 + keySide(css, u) : 0) + P.pad[2];
  const side = P.side, padX = Wd < 380 ? 8 : P.pad[3]; // a phone under 380 CSS px keeps the 125 % rows whole: a thinner bed inside the ring
  const pw = Math.min(Wd - 2 * side, P.max), px = (Wd - pw) / 2, py = b0 + Math.max(P.top, (Hb - P.bot - (foot ? footH : 0) - ph) / 2), ix = px + padX, iw = pw - 2 * padX, hy = py + P.pad[0];
  const top = hy + DEV.p.btnh + P.below, L = lay(rows, pages, S, ix, top, iw, px, px + pw, P.below / 2, hh || paged ? 4 : P.pad[2] / 2), lb = top + lh;
  if (paged) keys = pagerKeys(ix, lb + hh + 8, iw, keySide(css, u));
  return {mode: "phone", dev: "p", u, ts, T: DEV.p.T, plate: R(px, py, pw, ph), head: R(ix, hy, iw, DEV.p.btnh), kick: false, ttl: DEV.p.ttl,
    rows: L.out, hit: L.hit, divs: L.divs, pageOf: L.pageOf, pages: pages.map((pg) => pg.map((i) => rows[i])), keys, pane: null,
    help: hh ? R(ix, lb + 4, iw, hh - 4) : null, foot: foot ? R(px, py + ph + P.fgap, pw, FOOT1) : null, back: R(ix, hy, P.back, DEV.p.btnh), list: R(ix, top, iw, lh), stripHint: !foot};
}
const memo = new Map();
function geom(F, rows, page) {
  const ts = F.ts > 0 ? F.ts : textScale(), touchy = !!F.touch, shell = !!F.shell, css = F.css > 0 ? F.css : 1, paused = !!F.paused, isPhone = !paused && shell && touchy && F.H > F.W * 1.3;
  const id = [page, F.W, F.H, touchy, shell, css, ts, paused, ...rows].join("|");
  let G = memo.get(id);
  if (G) return G;
  const fl = touchy ? {h: TOUCH.h / css, g: TOUCH.g / css} : null;
  const land = touchy && !shell && !paused; // a touch board canvas (#c, a landscape phone): the phone's CSS px column, paged, never scaled under the floors (R1 landscape; a PAUSE view keeps its column)
  const ph = (q) => phone(q, rows, ts, page === "graphics", land);
  let d = isPhone || land ? ph(F) : paused ? null : desk(F, rows, ts, fl);
  /* a board canvas too small for even one row a page at its CSS scale (a 568 x 320 phone): the column scales as one piece, the one give-way left */
  for (let i = 0, k = 1; land && i < 16 && (d.plate.y + d.plate.h + d.T) * d.u > F.H + 0.5; i++) d = ph({...F, css: css / (k *= 0.96)});
  if (!d || (!isPhone && !(d.u >= DESK_U))) d = col({...F, touch: touchy, paused}, rows, ts, fl, page === "graphics"); // the desk's part sizes: a col row is the desk's height or the touch floor, never under a part
  const u = d.u, ks = d.keys;
  G = {page, mode: d.mode, dev: d.dev, u, ts, t125: big(ts), W: F.W, H: F.H, d, T: d.T * u, order: rows.slice(), plate: sc(d.plate, u), pane: sc(d.pane, u), back: sc(d.back, u),
    pages: d.pages.length ? d.pages : [[]], pageOf: d.pageOf, keys: ks ? {up: sc(ks.up, u), dn: sc(ks.dn, u), strip: sc(ks.strip, u), label: sc(ks.label, u)} : null, rows: {}, hit: {}};
  for (const l of rows) { G.rows[l] = sc(d.rows[l], u); G.hit[l] = sc(d.hit[l], u); }
  if (memo.size > 64) memo.clear();
  memo.set(id, (G = deep(G)));
  return G;
}
const rowsOr = (rows, dflt) => (Array.isArray(rows) && rows.length ? rows : dflt);
export const settingsGeom = (F, rows) => geom(F, rowsOr(rows, []), "settings");
export const graphicsGeom = (F, rows) => geom(F, rowsOr(rows, GFX_LABELS), "graphics");
/** The page on screen: the focused row's (focus a label or an index into the rows); 0 without one. */
export const pageAt = (G, focus) => pageOfFocus(G.pageOf, typeof focus === "number" ? G.order[focus] : focus);
function hitOf(G, x, y, focus) {
  if (G.back && inR(G.back, x, y)) return -1;
  const p = pageAt(G, focus), n = G.pages.length;
  const k = pageKeyAt(G.keys, x, y, (d) => (p + d >= 0 && p + d < n ? G.order.indexOf(G.pages[p + d][0]) : null));
  if (k) return k;
  for (const l of G.pages[p] || []) if (inR(G.hit[l], x, y)) return G.order.indexOf(l);
  return inR(G.plate, x, y) ? -2 : -1;
}
/** A tap's index into rows (the visible SETTINGS list optRow indexes, R11); -2 on the plate off the rows (inert), -1 on BACK or off the plate;
    a page key answers {k: "page", d, to} (to: the row to focus, its page opens). F.focus is the focused row (label or index): the page on screen. */
export const settingsHit = (x, y, F, rows) => (okBox(F) && rowsOr(rows, []).length ? hitOf(settingsGeom(F, rows), x, y, F.focus) : -1);
export const graphicsHit = (x, y, F, rows) => (okBox(F) ? hitOf(graphicsGeom(F, rows), x, y, F.focus) : -1);

/* ---- values: the words of each row by its label (SETTINGS), and the part that shows them ---- */
const onOff = (b) => (b ? COPY.on : COPY.off);
/** Each visible row's value word by its label, aligned with rows; a label it does not know reads empty. */
export function settingsRows(rows, vals, r3d, px, door, ana, ctlDoor) {
  const v = vals || {};
  const by = {MUSIC: String(v.mus | 0), SFX: String(v.sfx | 0), SOUND: onOff(v.snd), [LABEL.ART_STYLE]: r3d ? ART_STYLES[2] : px ? ART_STYLES[1] : ART_STYLES[0],
    CAMERA: CAM_NAME[Math.min(2, Math.max(0, v.cam | 0))], BRIGHTNESS: (v.bri > 0 ? v.bri | 0 : 100) + "%", "SCREEN SHAKE": onOff(v.shk), "REDUCE FLASH": onOff(v.flx),
    ANALYTICS: onOff(ana), GRAPHICS: door || "›", CONTROLS: ctlDoor || "›", "RESET DEFAULTS": ""};
  return (rows || []).map((r) => by[r] || "");
}
const word = (s) => String(s || "").replace(/\s*›\s*$/, "");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function settingSpec(l, u, phoneM) {
  const v = u.vals || {}, ai = u.r3d ? 2 : u.px ? 1 : 0;
  switch (l) {
    case "MUSIC": case "SFX": { const n = clamp((l === "MUSIC" ? v.mus : v.sfx) | 0, 0, 100); return {t: "meter", n: 10, v: Math.round(n / 10), num: String(n)}; }
    case "BRIGHTNESS": { const b = clamp(v.bri > 0 ? v.bri | 0 : 100, 70, 130); return {t: "meter", n: 7, v: Math.round((b - 70) / 10) + 1, num: b + "%"}; }
    case "SOUND": return {t: "rocker", on: v.snd ? "on" : "off"};
    case "SCREEN SHAKE": return {t: "rocker", on: v.shk ? "on" : "off"};
    case "REDUCE FLASH": return {t: "rocker", on: v.flx ? "on" : "off"};
    case "ANALYTICS": return u.anaNote ? {t: "note", s: u.anaNote} : {t: "rocker", on: u.ana ? "on" : "off"};
    case LABEL.ART_STYLE: {
      const s = ART_STYLES[ai], job = u.job || null;
      if (job) return {t: phoneM ? "door" : "step", cands: lookVal(job, !!u.touch), job, i: ai, n: 3, fail: job.st === "fail", s};
      return phoneM ? {t: "door", cands: [s]} : {t: "step", cands: [s], i: ai, n: 3, cl: ai === 0, cr: ai === 2};
    }
    case "CAMERA": { const i = clamp(v.cam | 0, 0, 2); return phoneM ? {t: "door", cands: [CAM_NAME[i]]} : {t: "step", cands: [CAM_NAME[i]], i, n: 3, cl: i === 0, cr: i === 2}; }
    case "GRAPHICS": return {t: "door", cands: [word(u.door)].filter(Boolean)};
    case "CONTROLS": { const d = word(u.ctlDoor); return {t: "door", cands: [u.padVib ? COPY.vib + " " + u.padVib : "", d].filter(Boolean)}; }
    case "RESET DEFAULTS": return {t: "reset"};
  }
  return {t: "none"};
}
function gfxSpec(r, phoneM) {
  if (!r) return {t: "none"};
  if (r.locked) return {t: "lock"};
  const s = String(r.val == null ? "" : r.val);
  const [i, n] = Array.isArray(r.at) ? r.at : [-1, 0]; // gfx.js's position on the row's own list: an arrow that cannot move is a well (CUSTOM has none)
  if ((s === COPY.on || s === COPY.off) && n === 2) return {t: "rocker", on: s.toLowerCase()}; // a two-way row (FPS METER); DEMO and ANTI-ALIAS have three values: steppers
  return phoneM ? {t: "door", cands: [s]} : {t: "step", cands: [s], free: true, cl: i === 0, cr: i >= 0 && i === n - 1};
}

/* ---- the plan: every part's place and words, measured once per change ---- */
function wrap(c, f, s, w) {
  const out = [];
  let line = "";
  for (const q of String(s).split(" ")) { const t = line ? line + " " + q : q; if (!line || W(c, f, t) <= w) line = t; else { out.push(line); line = q; } }
  if (line) out.push(line);
  return out.every((q) => W(c, f, q) <= w) ? out : null;
}
/* a value's parts, right-aligned at xr on the row's centre cy */
function valParts(c, s, xr, cy, dv, ts) {
  const P = [];
  if (s.t === "meter") { /* a narrow row (a 360 phone at 125 %) tightens the number's cell, then the cells, never under 6 px a cell */
    const nf = T.num(dv.pri), numW = W(c, nf, s.num), need = (nw0, cw0, g0) => nw0 + 10 + s.n * cw0 + (s.n - 1) * g0, room = s.room > 0 ? s.room : Infinity;
    let nw = 2.2 * dv.pri * ts, cw = dv.mcw, g = 3;
    if (need(nw, cw, g) > room) nw = Math.max(numW, room - 10 - (s.n * cw + (s.n - 1) * g));
    if (need(nw, cw, g) > room) { g = 2; cw = Math.max(6, Math.floor((room - nw - 10 - (s.n - 1) * g) / s.n)); }
    const x1 = xr - nw - 10, w = s.n * cw + (s.n - 1) * g, x0 = x1 - w, y = cy - dv.mch / 2;
    for (let i = 1; i <= s.n; i++) P.push({k: "cell", kind: i < s.v ? "mid" : i === s.v ? "lit" : "well", r: R(x0 + (i - 1) * (cw + g), y, cw, dv.mch), head: i === s.v, empty: i === s.n && i > s.v});
    P.push({k: "num", s: s.num, f: nf, px: dv.pri, x: xr, y: cy, w: W(c, nf, s.num)});
    return {P, x: x0, w: xr - x0};
  }
  if (s.t === "rocker") { /* a narrow row narrows the two cells, never under their widest legend + 4 (the row, not a cell, is the tap target) */
    const lf = T.label(dv.pri), lw = Math.max(W(c, lf, COPY.off), W(c, lf, COPY.on)) + 4, room = s.room > 0 ? s.room : Infinity;
    const cw = Math.max(lw, Math.min(dv.rkw, Math.floor((room - 11) / 2))), h = dv.keyh - 2, w = 3 + cw + 4 + cw + 3, x0 = xr - w, y = cy - (h + 6) / 2;
    P.push({k: "trough", r: R(x0, y, w, h + 6)});
    ["off", "on"].forEach((q, i) => P.push({k: "key", kind: s.on === q ? "lit" : "well", r: R(x0 + 3 + i * (cw + 4), y + 3, cw, h), s: q.toUpperCase(), px: dv.pri, chosen: s.on === q}));
    return {P, x: x0, w};
  }
  if (s.t === "lock") {
    const w = 2 * dv.rkw + 10, h = dv.keyh, x0 = xr - w;
    P.push({k: "lock", r: R(x0, cy - h / 2, w, h), px: dv.sec});
    return {P, x: x0, w};
  }
  if (s.t === "reset") { const gs = dv === DEV.p ? 18 : 16; P.push({k: "glyph", n: "reset", r: R(xr - gs - 4, cy - gs / 2, gs, gs), col: CONST.cor}); return {P, x: xr - gs - 4, w: gs + 4}; }
  if (s.t === "door" || s.t === "note") {
    const gs = dv === DEV.p ? 18 : 16, f = T.label(dv.sec), gx = s.t === "door" ? xr - gs - 4 : xr, ws = s.word ? W(c, f, s.word) : 0;
    if (s.t === "door") P.push({k: "glyph", n: "chev", r: R(gx, cy - gs / 2, gs, gs), col: CONST.t2});
    if (s.word) P.push({k: "text", s: s.word, f, px: dv.sec, x: (s.t === "door" ? gx - 10 : xr) - ws, y: cy, w: ws, col: s.fail ? CONST.cor : s.t === "note" ? CONST.ink : CONST.t2});
    const x0 = (s.t === "door" ? gx - 10 : xr) - ws;
    return {P, x: x0, w: xr - x0};
  }
  if (s.t === "step" && s.job) { /* a look being prepared: the window takes the value's whole room for the job's words, its fill line at its foot */
    const a = dv.keyh, f = T.label(dv.sec), ws = s.word ? W(c, f, s.word) : 0, win = s.win, x0 = xr - win, y = cy - a / 2;
    P.push({k: "key", kind: "well", r: R(x0, y, win, a), win: true});
    if (s.word) P.push({k: "text", s: s.word, f, px: dv.sec, x: x0 + 12, y: cy, w: ws, col: s.fail ? CONST.cor : CONST.t2});
    if (!s.fail) P.push({k: "line", r: R(x0 + 6, y + a - 5, win - 12, 2)});
    return {P, x: x0, w: win, win};
  }
  if (s.t === "step") {
    const a = dv.keyh, f = T.label(dv.pri), wf = s.job ? T.label(dv.sec) : f, pw = s.free || s.job ? 0 : s.n * 8 + (s.n - 1) * 3, ws = s.word ? W(c, wf, s.word) : 0;
    const win = s.win || Math.max(s.free ? 150 : 180, 12 + (pw ? pw + 10 : 0) + ws + 12), w = a + 6 + win + 6 + a, x0 = xr - w, y = cy - a / 2;
    P.push({k: "key", kind: s.cl ? "well" : "key", r: R(x0, y, a, a), glyph: "chl"});
    P.push({k: "key", kind: "well", r: R(x0 + a + 6, y, win, a), win: true});
    if (pw) for (let i = 0; i < s.n; i++) P.push({k: "pip", on: i === s.i, r: R(x0 + a + 6 + 12 + i * 11, cy - 4, 8, 8)});
    if (s.word) P.push({k: "text", s: s.word, f: wf, px: s.job ? dv.sec : dv.pri, x: x0 + a + 6 + 12 + (pw ? pw + 10 : 0), y: cy, w: ws, col: s.fail ? CONST.cor : s.job ? CONST.t2 : CONST.ink});
    P.push({k: "key", kind: s.cr ? "well" : "key", r: R(x0 + a + 6 + win + 6, y, a, a), glyph: "chev"});
    if (s.job) P.push({k: "line", r: R(x0 + a + 6 + 6, y + a - 5, win - 12, 2)});
    return {P, x: x0, w, win};
  }
  return {P, x: xr, w: 0};
}
/* a row of two lines (the label, then its words under it): their centres, the two lines' em boxes touching 2 px apart round the row's centre */
const twoLines = (cy, dv, ts) => { const a = dv.pri * ts, b = dv.sec * ts; return {h: a + b + 2, y1: cy - b / 2 - 1, y2: cy + a / 2 + 1}; };
function rowPlan(c, G, l, spec, dv, ts) {
  const r = G.d.rows[l], cy = r.y + r.h / 2, labx = dv.labx, xr = r.x + r.w - 12;
  let lp = dv.pri, lf = T.label(lp), lw = W(c, lf, l), room = xr - (r.x + labx + lw + 12);
  /* a rocker or meter that would run into its label at 125 % on the narrowest column (a 667 x 375 phone's #c): the label steps down to its 100 %
     size, still over the floors (R1 landscape) */
  if (ts > 1 && r.x + labx + lw > xr) { const p1 = dv.pri / ts; lp = p1; lf = T.label(p1); lw = W(c, lf, l); room = xr - (r.x + labx + lw + 12); } // a label that alone overruns its row (568 x 320 at 125 %)
  else if (ts > 1 && (spec.t === "rocker" || spec.t === "meter") && valParts(c, {...spec, room}, xr, cy, dv, ts).w > room) {
    const p1 = dv.pri / ts, w1 = W(c, T.label(p1), l), r1 = xr - (r.x + labx + w1 + 12);
    if (valParts(c, {...spec, room: r1}, xr, cy, dv, ts).w <= r1) { lp = p1; lf = T.label(p1); lw = w1; room = r1; }
  }
  const o = {l, r, spec, label: {s: l, f: lf, px: lp, x: r.x + labx, y: cy, w: lw, col: spec.t === "reset" ? CONST.cor : CONST.ink}};
  if (spec.job && spec.t === "step") { /* the first of the job's words that fits the room's window whole; the last (the shortest) else */
    const f = T.label(dv.sec), s = spec.cands.find((q) => W(c, f, q) + 24 <= room) || spec.cands[spec.cands.length - 1];
    o.word = s; o.val = valParts(c, {...spec, word: s, win: Math.max(room, W(c, f, s) + 24)}, xr, cy, dv, ts);
    return o;
  }
  if (spec.t === "door" && spec.cands.length) { /* a door whose first words do not fit beside the label take the row's second line, whole (QA #8) */
    const f = T.label(dv.sec), s0 = spec.cands[0], w0 = W(c, f, s0), gl = valParts(c, {...spec, word: ""}, xr, cy, dv, ts), two = twoLines(cy, dv, ts);
    if (valParts(c, {...spec, word: s0}, xr, cy, dv, ts).w > room && r.h >= two.h && r.x + labx + w0 <= gl.x - 8) {
      o.label.y = two.y1; o.word = s0; o.two = true;
      o.val = {P: [...gl.P, {k: "text", s: s0, f, px: dv.sec, x: r.x + labx, y: two.y2, w: w0, col: CONST.t2}], x: gl.x, w: gl.w};
      return o;
    }
  }
  if (spec.cands) {
    let pick = null;
    for (const s of spec.cands) { const v = valParts(c, {...spec, word: s}, xr, cy, dv, ts); if (v.w <= room) { pick = {s, v}; break; } }
    if (!pick && spec.t === "step") { const v = valParts(c, {...spec, word: spec.cands[spec.cands.length - 1], win: 0}, xr, cy, dv, ts); pick = v.w <= room ? {s: spec.cands[spec.cands.length - 1], v} : {s: "", v: valParts(c, {...spec, word: ""}, xr, cy, dv, ts)}; }
    if (!pick && spec.job) { const v = valParts(c, {...spec, word: spec.cands[spec.cands.length - 1]}, xr, cy, dv, ts); pick = {s: spec.cands[spec.cands.length - 1], v}; }
    o.val = pick ? pick.v : valParts(c, {...spec, word: ""}, xr, cy, dv, ts);
    o.word = pick ? pick.s : "";
    return o;
  }
  if (spec.t === "note") {
    const f = T.label(dv.sec), nw = W(c, f, spec.s), two = twoLines(cy, dv, ts);
    if (nw <= room) o.val = valParts(c, {t: "note", word: spec.s}, xr, cy, dv, ts);
    else { /* a note too wide for the row's right: it takes a second line under its label, whole */
      o.label.y = two.y1;
      o.val = {P: [{k: "text", s: spec.s, f, px: dv.sec, x: r.x + labx, y: two.y2, w: nw, col: CONST.ink}], x: r.x + labx, w: nw};
    }
    return o;
  }
  o.val = valParts(c, {...spec, room}, xr, cy, dv, ts);
  return o;
}
/* the foot's word sets, longest first: each item is a label and its keycaps (label first, keycap last); a touch layout names the tap model */
function footSets(touchy, words) {
  if (tapMode(touchy)) return [[{t: FOOT_TAP}], [{t: COPY.tapRow}]];
  const pad = words.dev === "pad", it = [{t: COPY.row, caps: pad ? [words.move] : [["up"], ["dn"]]}, {t: COPY.change, caps: pad ? [words.move] : [["lf"], ["rt"]]}, {t: COPY.back, caps: [words.back]}];
  return [it, [it[0], it[2]], [it[2]]];
}
/* units (an item with its caps, or the build tag) packed greedily into at most maxL lines of maxW; a line break eats the separator */
function footPlan(c, G, touchy, words, rev) {
  if (!G.d.foot) return null; // a paged column: the page keys' strip stands where the foot was
  const d = G.d, dv = DEV[d.dev], ph = d.dev === "p", f = T.label(dv.sec), box = d.foot, maxW = box.w - 32, maxL = d.mode === "desk" ? 2 : 1, sw = W(c, f, "·");
  const unit = (it) => {
    const ps = [{t: it.t, w: W(c, f, it.t), x: 0}];
    let x = ps[0].w;
    (it.caps || []).forEach((q, j) => { const w = Array.isArray(q) ? dv.capw : capW(c, q, {phone: ph}); x += j ? 5 : 8; ps.push({cap: q, w, x}); x += w; });
    return {ps, w: x};
  };
  const pack = (us) => {
    const L = [];
    for (const q of us) {
      const cur = L[L.length - 1], add = q.tag ? 12 + q.w : 12 + sw + 12 + q.w;
      if (cur && cur.w + add <= maxW) { cur.us.push(q); cur.w += add; } else L.push({us: [q], w: q.w});
    }
    return L;
  };
  for (const set of footSets(touchy, words)) for (const withRev of rev ? [true, false] : [false]) {
    const us = set.map(unit);
    if (withRev) { const w = W(c, f, rev), bw = W(c, f, "|"); us.push({ps: [{sep: "|", w: bw, x: 0}, {t: rev, w, x: bw + 12}], w: bw + 12 + w, tag: true}); }
    const L = pack(us);
    if (L.length > maxL || L.some((q) => q.w > maxW)) continue;
    const lh = dv.caph, h = L.length * lh + (L.length - 1) * 8 + 20, w = Math.max(...L.map((q) => q.w)) + 32;
    const x = d.mode === "desk" ? box.x : box.x + (box.w - w) / 2, y = d.mode === "desk" ? box.y + box.h - h : box.y + (box.h - h) / 2, lines = [];
    L.forEach((q, i) => {
      const my = y + 10 + i * (lh + 8) + lh / 2, ps = [];
      let lx = x + (w - q.w) / 2;
      q.us.forEach((un, j) => {
        if (j && !un.tag) { ps.push({sep: "·", w: sw, x: lx + 12, y: my}); lx += 12 + sw + 12; } else if (j) lx += 12;
        for (const p of un.ps) ps.push({...p, x: lx + p.x, y: my});
        lx += un.w;
      });
      lines.push({ps});
    });
    return {x, y, w, h, f, px: dv.sec, lines};
  }
  return null;
}
/* a paged column's back-out hint: the tap rule's words, or BACK and its keycap (label first, keycap last) */
function hintPlan(c, G, touchy, words) {
  const H = G.d.hint, dv = DEV.d, f = T.label(dv.sec);
  if (G.d.stripHint && G.d.keys && !tapMode(touchy)) { /* a paged landscape column (R1 landscape): a controller's BACK and keycap ride the strip's lower line under PAGE n OF m (tap mode: the BACK key says it) */
    const L = G.d.keys.label, fp = T.label(DEV.p.sec), ch = DEV.p.caph, bw = W(c, fp, COPY.back), cw = capW(c, words.back, {phone: true});
    return bw + 8 + cw <= L.w ? {f: fp, px: DEV.p.sec, y: L.y + L.h - ch / 2, ch, ph: true, ps: [{t: COPY.back, x: L.x, w: bw}, {cap: words.back, x: L.x + bw + 8, w: cw}]} : null;
  }
  if (!H) return null;
  const y = H.y + H.h / 2, tw = W(c, f, tapMode(touchy) ? BACK_TAP : COPY.back);
  if (tapMode(touchy)) return {f, px: dv.sec, y, ps: [{t: BACK_TAP, x: H.x, w: tw}]};
  return {f, px: dv.sec, y, ps: [{t: COPY.back, x: H.x, w: tw}, {cap: words.back, x: H.x + tw + 8, w: capW(c, words.back)}]};
}
function panePlan(c, G, u, words) {
  const d = G.d, P = d.pane;
  if (!P) return null;
  const dv = DEV.d, ts = d.ts, ix = P.x + SLAB + 12, iw = P.w - 2 * (SLAB + 12), iy = P.y + SLAB + 12, out = {ix, iw, iy};
  if (G.page === "settings") {
    const ai = u.r3d ? 2 : u.px ? 1 : 0, kf = T.label(dv.sec), bh = dv.bkh, kw = (iw - 16) / 3, by = iy + dv.pri * ts + 14;
    out.head = {s: LABEL.ART_STYLE, f: T.label(dv.pri), px: dv.pri, x: ix, y: iy + dv.pri * ts / 2};
    out.count = {s: ai + 1 + " " + COPY.of + " 3", f: kf, px: dv.sec, x: ix + iw, y: iy + dv.pri * ts / 2};
    out.count.w = W(c, kf, out.count.s);
    out.looks = ART_STYLES.map((s, i) => ({s, kind: i === ai ? "lit" : "well", r: R(ix + i * (kw + 8), by, kw, bh), px: dv.sec, w: W(c, kf, s)}));
    const bf = T.body(dv.bod), lh = dv.bod * ts * 1.5, fy = d.foot.y - 14;
    let y = by + bh + 14 + lh / 2;
    out.body = [];
    for (const [s, rule] of [[COPY.looks, false], [u.r3d ? COPY.on3d : COPY.add3d, true]]) {
      const ls = wrap(c, bf, s, iw);
      if (!ls) continue;
      const need = (rule ? 14 : 0) + ls.length * lh;
      if (y - lh / 2 + need > fy) continue;
      if (rule) { out.rule = R(ix, y - lh / 2 + 4, iw, 2); y += 14; }
      for (const q of ls) { out.body.push({s: q, f: bf, px: dv.bod, x: ix, y, w: W(c, bf, q)}); y += lh; }
    }
  }
  return out;
}
/* GRAPHICS' help (live: it follows the cursor). The desk's pane: the focused row's name over its two help lines, wrapped. Off the desk: the
   two lines under the rows, one each; a line too wide for the list takes both (help2 first: it carries the lock, the limit and CUSTOM) */
function gfxPane(c, G, r) {
  const d = G.d, P = d.pane, dv = DEV.d, ts = d.ts;
  if (!r) return null;
  if (!P) {
    const H = d.help, dh = DEV[d.dev], f = T.label(dh.sec), lh = dh.sec * ts * 1.3, out = {head: null, lines: []};
    if (!H) return null;
    const one = [[r.help1, CONST.t2], [r.help2, CONST.ink]].filter(([s]) => s);
    const pick = one.every(([s]) => W(c, f, s) <= H.w) ? one : (() => { for (const [s, col] of one.slice().reverse()) { const ls = wrap(c, f, s, H.w); if (ls && ls.length <= 2) return ls.map((q) => [q, col]); } return []; })();
    pick.forEach(([s, col], i) => out.lines.push({s, f, px: dh.sec, x: H.x + H.w / 2 - W(c, f, s) / 2, y: H.y + lh * (i + 0.5), w: W(c, f, s), col, role: "secondary"}));
    return out;
  }
  const ix = P.x + SLAB + 12, iw = P.w - 2 * (SLAB + 12), iy = P.y + SLAB + 12, bf = T.body(dv.bod), lh = dv.bod * ts * 1.5, out = {lines: []};
  out.head = {s: r.label, f: T.label(dv.pri), px: dv.pri, x: ix, y: iy + dv.pri * ts / 2, w: W(c, T.label(dv.pri), r.label)};
  let y = iy + dv.pri * ts + 14 + lh / 2;
  for (const [s, col] of [[r.help1, CONST.t2], [r.help2, CONST.ink]]) {
    const ls = s ? wrap(c, bf, s, iw) : null;
    if (!ls || y - lh / 2 + ls.length * lh > d.foot.y - 14) continue;
    for (const q of ls) { out.lines.push({s: q, f: bf, px: dv.bod, x: ix, y, w: W(c, bf, q), col}); y += lh; }
    y += 8;
  }
  return out;
}
function headPlan(c, G, u, title) {
  const d = G.d, dv = DEV[d.dev], ts = d.ts, h = d.head, out = {};
  if (d.mode === "phone") {
    out.back = {r: d.back, s: COPY.back};
    out.title = {s: title, px: d.ttl, x: d.back.x + d.back.w + 16, y: h.y + h.h / 2};
    const room = h.x + h.w - out.title.x;
    if (W(c, T.display(d.ttl), title) > room) out.title.px = d.ttl * room / W(c, T.display(d.ttl), title);
    return out;
  }
  const kick = u.kicker != null ? u.kicker : G.page === "graphics" ? COPY.perf : u.rev ? COPY.build + " " + u.rev : "";
  if (d.kick && kick) out.kick = {s: kick, f: T.label(DEV.d.sec), px: DEV.d.sec, x: h.x, y: h.y + DEV.d.sec * ts * 0.6, w: W(c, T.label(DEV.d.sec), kick)};
  out.title = {s: title, px: d.ttl, x: h.x, y: h.y + h.h - d.ttl * ts * 0.55};
  return out;
}
function plan(c0, G, u, specs, touchy, words) {
  const c = mOf(c0), d = G.d, dv = DEV[d.dev], ts = d.ts, rows = {};
  for (const l of G.order) rows[l] = rowPlan(c, G, l, specs[l], dv, ts);
  const title = G.page === "settings" ? LABEL.SETTINGS : "GRAPHICS";
  return {rows, head: headPlan(c, G, u, title), pane: panePlan(c, G, u, words), foot: footPlan(c, G, touchy, words, u.rev || ""), hint: hintPlan(c, G, touchy, words), c};
}

/* ---- painting ---- */
/* the meter's cell: a small key, radius 3; lit = the brick standing up 2 px with its brickHi strip, mid = the brick's darker step, well = sunk */
function cell(c, r, kind, tok) {
  const y = r.y - (kind === "lit" ? 2 : 0), ix = r.x + 2, iy = y + 2, iw = r.w - 4, ih = r.h - 4;
  if (kind !== "well") rr(c, r.x, y + 3, r.w, r.h, 3, CONST.ol);
  rr(c, r.x, y, r.w, r.h, 3, CONST.ol);
  if (kind === "lit") { c.fillStyle = tok.lit2; c.fillRect(ix, iy, iw, ih); c.fillStyle = tok.lit; c.fillRect(ix, iy, iw, ih * 0.54); c.fillStyle = tok.lithi; c.fillRect(ix, iy + 1, iw, 3); c.fillStyle = tok.lip; c.fillRect(ix, iy + ih - 4, iw, 4); }
  else if (kind === "mid") { c.fillStyle = tok.mid; c.fillRect(ix, iy, iw, ih); c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(ix, iy + ih - 4, iw, 4); }
  else { c.fillStyle = tok.well; c.fillRect(ix, iy, iw, ih); c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(ix, iy, iw, 3); }
}
/* the page's own marks on the 16-unit grid: the stepped arrows' chevrons, the arrow keycaps, reset and lock */
function mark(c, n, x, y, s, col) {
  if (n === "chev" || n === "up" || n === "dn") return glyph(c, n, x, y, s, col);
  c.save(); c.translate(x, y); c.scale(s / 16, s / 16); c.strokeStyle = c.fillStyle = col; c.lineCap = c.lineJoin = "round"; c.beginPath();
  if (n === "chl") { c.lineWidth = 2.4; c.moveTo(10, 3); c.lineTo(5, 8); c.lineTo(10, 13); c.stroke(); }
  else if (n === "lf") { c.moveTo(11, 3); c.lineTo(5, 8); c.lineTo(11, 13); c.closePath(); c.fill(); }
  else if (n === "rt") { c.moveTo(5, 3); c.lineTo(11, 8); c.lineTo(5, 13); c.closePath(); c.fill(); }
  else if (n === "reset") { c.lineWidth = 2.2; c.arc(8, 8, 4.5, Math.PI, -Math.PI / 2, true); c.lineTo(5, 3.5); c.moveTo(6.5, 1); c.lineTo(4, 3.5); c.lineTo(6.5, 6); c.stroke(); }
  else if (n === "lock") { c.lineWidth = 2; c.moveTo(4.5, 7); c.lineTo(4.5, 5); c.arc(8, 5, 3.5, Math.PI, 0); c.lineTo(11.5, 7); c.stroke(); c.beginPath(); c.rect(3, 7, 10, 7.5); c.fill(); }
  c.restore();
}
/* a small layer the page layer blits from (a slab cell, a locked key); the page layer's paint collects their keys so a steady frame keeps them
   recent with it, and a re-raster never finds them freed */
let subs = null;
const sub = (k, w, h, fn) => { if (subs) subs.push(keyOf(k)); return layer(k, w, h, fn); };
/* the locked value's wall key (its wall-cell texture is a few hundred path calls): one small layer per size and world, blitted, so a focused
   locked row stays inside the steady frame's call budget */
function lockKey(c, r, tok, ph) {
  if (!canMake()) return key(c, r.x, r.y, r.w, r.h, "wall", {tok, phone: ph});
  const k = deviceScale(c), w = Math.ceil(r.w * k), h = Math.ceil(r.h * k);
  const L = sub({layer: "settings.lock|" + r.w + "|" + r.h, biome: tok.name, level: 0, W: w, H: h, dpr: +k.toFixed(4), look: "2d", textScale: 1}, w, h, (g) => { g.scale(w / r.w, h / r.h); key(g, 0, 0, r.w, r.h, "wall", {tok, phone: ph}); });
  c.drawImage(L, r.x, r.y, r.w, r.h);
}
function paintVal(c, o, tok, dv, fk) {
  const ph = dv === DEV.p;
  for (const p of o.val.P) {
    const r = p.r;
    if (p.k === "cell") cell(c, r, p.kind, tok);
    else if (p.k === "num") { c.font = p.f; c.fillStyle = CONST.ink; c.textAlign = "right"; c.textBaseline = "middle"; c.fillText(p.s, p.x, p.y); }
    else if (p.k === "trough") rr(c, r.x, r.y, r.w, r.h, 8, CONST.ol);
    else if (p.k === "key") {
      key(c, r.x, r.y, r.w, r.h, p.kind, {tok, phone: ph, ...(p.s ? {label: p.s, px: p.px} : {})});
      if (p.glyph) mark(c, p.glyph, r.x + (r.w - 16) / 2, r.y + (r.h - 16) / 2, 16, p.kind === "well" ? CONST.off : CONST.ink);
    } else if (p.k === "pip") { c.fillStyle = p.on ? CONST.ink : CONST.t2; c.fillRect(r.x, r.y, r.w, r.h); if (!p.on) { c.fillStyle = tok.well; c.fillRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3); } }
    else if (p.k === "text") text(c, p.s, p.x, p.y, p.f, p.col);
    else if (p.k === "glyph") mark(c, p.n, r.x, r.y, r.w, p.col);
    else if (p.k === "lock") {
      lockKey(c, r, tok, ph);
      const f = T.label(p.px), dw = measure(c, f, "—"), cw = dw + 6 + 13 + 16, ch = p.px * textScale() + 6, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      rr(c, cx - cw / 2, cy - ch / 2, cw, ch, 4, CONST.ol);
      text(c, "—", cx - cw / 2 + 8, cy, f, CONST.off);
      mark(c, "lock", cx - cw / 2 + 8 + dw + 6, cy - 6.5, 13, CONST.off);
    }
  }
  if (fk > 0 && o.val.w > 0) { const a = c.globalAlpha; c.globalAlpha = a * 0.3 * fk; c.fillStyle = CONST.ink; c.fillRect(o.val.x - 4, o.r.y + 3, o.val.w + 8, o.r.h - 6); c.globalAlpha = a; }
}
function paintRow(c, o, tok, dv, foc, fk) {
  const r = o.r;
  if (foc) { band(c, r.x, r.y, r.w, r.h, tok); focusBomb(c, r.x + 8, r.y + r.h / 2, dv.bombs); }
  text(c, o.label.s, o.label.x, o.label.y, o.label.f, foc && o.spec.t === "reset" ? CONST.ink : o.label.col);
  paintVal(c, o, tok, dv, fk);
}
/* the job's honest fill along the ART STYLE window's foot: the share, or still stripes when there is no count */
function jobLine(c, o, tok) {
  const p = o.val.P.find((q) => q.k === "line"), f = o.spec.job && typeof o.spec.job.fill === "number" ? o.spec.job.fill : -1;
  if (!p) return;
  const r = p.r;
  c.fillStyle = CONST.ol; c.fillRect(r.x, r.y, r.w, r.h);
  c.fillStyle = tok.lit;
  if (f < 0) for (let x = r.x; x < r.x + r.w; x += 8) c.fillRect(x, r.y, Math.min(4, r.x + r.w - x), r.h);
  else if (f > 0) c.fillRect(r.x, r.y, Math.round(r.w * Math.min(1, f)), r.h);
}
function course(c, r, tok) {
  c.fillStyle = CONST.ol; c.fillRect(r.x, r.y, r.w, 2);
  c.fillStyle = tok.band; c.fillRect(r.x, r.y + 2, r.w, 1);
  c.fillStyle = CONST.ol; for (let x = r.x + 16; x < r.x + r.w - 3; x += 32) c.fillRect(x, r.y - 1, 3, 4);
}
/* one wall cell at the slab's size and this context's density, a small layer the frame blits; with no canvas source (Node) the frame is the
   wall's flat colour */
function slabCell(c, tok) {
  if (!canMake()) return null;
  const k = deviceScale(c), n = Math.max(1, Math.round(SLAB * k));
  return sub({layer: "settings.slab", biome: tok.name, level: 0, W: n, H: n, dpr: +k.toFixed(4), look: "2d", textScale: 1}, n, n, (g) => { g.scale(n / SLAB, n / SLAB); wallCell(g, 0, 0, SLAB, tok, {code: 1}); });
}
/* the pane: a slab of the world's floor framed in its own wall cells (the mock's slab()) */
function slab(c, P, tok) {
  c.fillStyle = tok.pane; c.fillRect(P.x, P.y, P.w, P.h);
  c.save(); c.beginPath(); c.rect(P.x, P.y, P.w, P.h); c.rect(P.x + SLAB, P.y + SLAB, P.w - 2 * SLAB, P.h - 2 * SLAB); c.clip("evenodd");
  const cell = slabCell(c, tok), put = (x, y) => (cell ? c.drawImage(cell, x, y, SLAB, SLAB) : c.fillRect(x, y, SLAB, SLAB));
  c.fillStyle = tok.wall;
  for (let x = P.x; x < P.x + P.w; x += SLAB) { put(x, P.y); put(x, P.y + P.h - SLAB); } // the frame only: top and bottom courses, then the two sides
  for (let y = P.y + SLAB; y < P.y + P.h - SLAB; y += SLAB) { put(P.x, y); put(P.x + P.w - SLAB, y); }
  c.fillStyle = "rgba(6,4,6,0.42)"; c.fillRect(P.x, P.y, P.w, P.h);
  c.restore();
  c.strokeStyle = CONST.ol; c.lineWidth = 2; c.strokeRect(P.x + 1, P.y + 1, P.w - 2, P.h - 2); c.strokeRect(P.x + SLAB - 1, P.y + SLAB - 1, P.w - 2 * SLAB + 2, P.h - 2 * SLAB + 2);
}
function paintFoot(c, F, tok, ph) {
  const dv = DEV[ph ? "p" : "d"];
  plaque(c, F.x, F.y, F.w, F.h, tok);
  for (const L of F.lines) for (const p of L.ps) {
    if (p.sep) text(c, p.sep, p.x, p.y, F.f, CONST.off);
    else if (p.cap) {
      const cy = p.y - dv.caph / 2;
      if (Array.isArray(p.cap)) { key(c, p.x, cy, p.w, dv.caph, "key", {tok, phone: ph}); mark(c, p.cap[0], p.x + (p.w - 13) / 2, cy + (dv.caph - 13) / 2, 13, CONST.t2); }
      else cap(c, p.x, cy, p.cap, {tok, phone: ph});
    } else text(c, p.t, p.x, p.y, F.f, CONST.t2);
  }
}
/* the page keys' strip (kit pager.js): PAGE n OF m, then ▲ and ▼ (a key with no page to open is a well) */
function pagerOf(c, G, p, hint) {
  const k0 = G.d.keys, dv = DEV[G.d.dev];
  if (!k0) return null;
  const k = hint && hint.ch ? {...k0, label: R(k0.label.x, k0.label.y, k0.label.w, k0.label.h - hint.ch)} : k0; // the strip's hint below: PAGE n OF m on its upper line
  const f = T.label(dv.sec), s = pageLabel(p, G.pages.length);
  return {s, f, px: dv.sec, x: k.label.x, y: k.label.y + k.label.h / 2, w: measure(c, f, s), up: k.up, dn: k.dn, upOn: p > 0, dnOn: p < G.pages.length - 1, p, n: G.pages.length, K: k};
}
const paintPager = (g, Q, tok, ph) => Q && kitPager(g, Q.K, Q.p, Q.n, tok, {f: Q.f, phone: ph});
function paintStatic(g, G, Pl, tok, u, p) {
  const d = G.d, ph = d.dev === "p", dv = DEV[d.dev], H = Pl.head;
  plate(g, d.plate.x, d.plate.y, d.plate.w, d.plate.h, tok, {phone: ph});
  if (H.kick) text(g, H.kick.s, H.kick.x, H.kick.y, H.kick.f, CONST.t2);
  if (H.back) { const r = H.back.r; key(g, r.x, r.y, r.w, r.h, "key", {tok, phone: ph}); mark(g, "chl", r.x + 16, r.y + r.h / 2 - 9, 18, CONST.ink); text(g, H.back.s, r.x + 44, r.y + r.h / 2, T.label(dv.pri), CONST.ink); }
  dsp(g, H.title.s, H.title.x, H.title.y, H.title.px);
  for (const q of d.divs) if (q.p === p) course(g, q.r, tok);
  for (const l of G.pages[p]) paintRow(g, Pl.rows[l], tok, dv, false, 0);
  paintPager(g, pagerOf(g, G, p, Pl.hint), tok, ph);
  if (d.pane) slab(g, d.pane, tok);
  const P = Pl.pane;
  if (P && P.head) {
    text(g, P.head.s, P.head.x, P.head.y, P.head.f, CONST.ink);
    text(g, P.count.s, P.count.x, P.count.y, P.count.f, CONST.t2, "right");
    for (const k of P.looks) key(g, k.r.x, k.r.y, k.r.w, k.r.h, k.kind, {tok, label: k.s, px: k.px});
    if (P.rule) { g.fillStyle = CONST.ol; g.fillRect(P.rule.x, P.rule.y, P.rule.w, P.rule.h); }
    for (const b of P.body) text(g, b.s, b.x, b.y, b.f, CONST.t2);
  }
  if (Pl.foot) paintFoot(g, Pl.foot, tok, ph);
  if (Pl.hint) for (const p of Pl.hint.ps) { if (p.cap) cap(g, p.x, Pl.hint.y - (Pl.hint.ch || DEV.d.caph) / 2, p.cap, {tok, phone: !!Pl.hint.ph}); else text(g, p.t, p.x, Pl.hint.y, Pl.hint.f, CONST.t2); }
}
function paintGfxPane(c, P) {
  if (!P) return;
  if (P.head) text(c, P.head.s, P.head.x, P.head.y, P.head.f, CONST.ink);
  for (const q of P.lines) text(c, q.s, q.x, q.y, q.f, q.col);
}

/* ---- the probe record (outside any layer paint) ---- */
function record(G, Pl, foc, ui, dpr, el, touchy, gp, pg) {
  const u = G.u, d = G.d, b = (r) => [r.x * u, r.y * u, r.w * u, r.h * u], tok = worldTokens(ui.level), ts = textScale(), dv = DEV[d.dev];
  const txt = (s, x, y, w, px, col, role, o = {}) => probe.text(s, x * u, (y - px * ts * CAP_K / 2) * u, Math.max(0.01, w * u), px * ts * CAP_K * u, {role, col, px: px * u, ...o});
  probe.begin(G.page, {w: G.W, h: G.H, dpr, el});
  probe.rect("plate", ...b(d.plate), {plate: G.T});
  const H = Pl.head;
  if (H.kick) txt(H.kick.s, H.kick.x, H.kick.y, H.kick.w, H.kick.px, CONST.t2, "secondary");
  if (H.back) { probe.rect("BACK", ...b(H.back.r), {touch: touchy, fill: tok.key}); txt(H.back.s, H.back.r.x + 44, H.back.r.y + H.back.r.h / 2, measure(Pl.c, T.label(dv.pri), H.back.s), dv.pri, CONST.ink, "primary"); }
  let chosen = false, meterP = false, lockP = null, litR = null, winR = null;
  const Q = pagerOf(Pl.c, G, pg, Pl.hint);
  if (Q) {
    txt(Q.s, Q.x, Q.y, Q.w, Q.px, CONST.t2, "secondary");
    for (const [nm, r, on] of [["PAGE UP", Q.up, Q.upOn], ["PAGE DOWN", Q.dn, Q.dnOn]]) {
      probe.rect(nm, ...b(r), {touch: touchy, set: G.page + " pages", kind: "step", fill: on ? tok.key : tok.well});
      probe.pair("info", b(R(r.x + r.w / 2 - 11, r.y + r.h / 2 - 11, 22, 22)), b(R(r.x + 4, r.y + 5, r.w - 8, r.h - 9)), {col: on ? CONST.ink : CONST.off, name: nm, ...(on ? {} : {lock: true})});
    }
  }
  for (const l of G.pages[pg]) {
    const o = Pl.rows[l], f = l === foc;
    probe.rect(l, ...b(o.r), {touch: touchy, set: G.page, kind: "list", focus: f, fill: f ? tok.band : tok.bedA});
    txt(o.label.s, o.label.x, o.label.y, o.label.w, o.label.px, f && o.spec.t === "reset" ? CONST.ink : o.label.col, "primary");
    const cells = o.val.P.filter((p) => p.k === "cell"), keys = o.val.P.filter((p) => p.k === "key" && p.s);
    for (const p of o.val.P) {
      if (p.k === "num") txt(p.s, p.x - p.w, p.y, p.w, p.px, CONST.ink, "primary");
      else if (p.k === "text") txt(p.s, p.x, p.y, p.w, p.px, p.col, p.px === dv.pri ? "primary" : "secondary");
      else if (p.k === "key" && p.s) { const w = measure(Pl.c, T.label(p.px), p.s); txt(p.s, p.r.x + (p.r.w - w) / 2, p.r.y + p.r.h / 2 - (p.kind === "lit" ? 2 : 0), w, p.px, p.kind === "lit" ? CONST.dk : CONST.t2, "primary"); }
      else if (p.k === "glyph") { const r = p.r, pad = 8; probe.pair("info", b(R(r.x - 2, r.y - 2, r.w + 4, r.h + 4)), b(R(r.x - pad, r.y - pad, r.w + 2 * pad, r.h + 2 * pad)), {col: p.col, name: l + " " + p.n}); } // a: the mark with its round caps' overhang
      else if (p.k === "lock") { lockP = lockP || p.r; txt("—", p.r.x + p.r.w / 2 - 12, p.r.y + p.r.h / 2, measure(Pl.c, T.label(p.px), "—"), p.px, CONST.off, "secondary", {lock: true}); }
      else if (p.k === "key" && p.glyph) { const r = p.r, g = R(r.x + (r.w - 20) / 2, r.y + (r.h - 20) / 2, 20, 20); probe.pair("info", b(g), b(R(r.x + 3, r.y + 4, r.w - 6, r.h - 7)), {col: p.kind === "well" ? CONST.off : CONST.ink, name: l + " " + p.glyph, ...(p.kind === "well" ? {lock: true} : {})}); } // a stepped key's arrow (a clamped one is locked, 3:1)
      if (p.k === "key" && p.win) winR = winR || p.r;
      if (p.k === "key" && p.kind === "lit") litR = litR || R(p.r.x, p.r.y - 2, p.r.w, p.r.h);
    }
    if (keys.length === 2 || cells.some((p) => p.empty)) probe.rect("two-state " + l, ...b(o.r)); // a rocker or a meter with an empty cell: a chosen pair this page can show (screens.mjs exemptIfNo)
    if (!chosen && keys.length === 2) { const on = keys.find((k) => k.chosen), off = keys.find((k) => !k.chosen); chosen = true; const side = (k) => Math.max(4, (k.r.w - measure(Pl.c, T.label(k.px), k.s)) / 2 - 4); probe.pair("chosen", b(R(on.r.x + 2, on.r.y, side(on), on.r.h - 4)), b(R(off.r.x + 2, off.r.y + 2, side(off), off.r.h - 4)), {name: "rocker on vs off " + l}); } // the faces inside the outline, beside the legend (the lit key stands 2 px up)
    if (!meterP && cells.length) { const h = cells.find((p) => p.head), e = cells.find((p) => p.empty); if (h && e) { meterP = true; probe.pair("chosen", b(R(h.r.x + 2, h.r.y, h.r.w - 4, h.r.h - 4)), b(R(e.r.x + 2, e.r.y + 2, e.r.w - 4, e.r.h - 4)), {name: "meter head vs empty " + l}); } }
  }
  if (lockP && litR) { // floor: a plain bed sample in a row at rest, between its label and its value
    const o = G.pages[pg].map((l) => Pl.rows[l]).find((q) => q.l !== foc && q.val.x - (q.label.x + q.label.w) >= 40), fl = o && R(o.label.x + o.label.w + 12, o.r.y + 6, Math.min(40, o.val.x - (o.label.x + o.label.w) - 24), o.r.h - 12);
    probe.pair("locked", b(lockP), b(litR), {name: "locked vs chosen", ...(fl ? {floor: b(fl)} : {})});
  }
  const k = d.rows[foc];
  if (k) {
    const lx = Pl.rows[foc].label.x, a = R(k.x + 8 + dv.bombs + 2, k.y + 4, Math.max(4, lx - k.x - dv.bombs - 12), k.h - 8), bed = R(d.plate.x + 4, k.y, Math.max(4, k.x - d.plate.x - 6), k.h);
    probe.pair("band", b(a), b(bed), {name: "focus " + foc});
  }
  const P = Pl.pane;
  if (P && P.looks) {
    for (const q of P.looks) txt(q.s, q.r.x + (q.r.w - q.w) / 2, q.r.y + q.r.h / 2 - (q.kind === "lit" ? 2 : 0), q.w, q.px, q.kind === "lit" ? CONST.dk : CONST.t2, "secondary");
    const on = P.looks.find((q) => q.kind === "lit"), off = P.looks.find((q) => q.kind !== "lit");
    probe.pair("chosen", b(R(on.r.x + 2, on.r.y, on.r.w - 4, on.r.h - 4)), b(R(off.r.x + 2, off.r.y + 2, off.r.w - 4, off.r.h - 4)), {name: "art style chosen vs not"});
    txt(P.head.s, P.head.x, P.head.y, measure(Pl.c, P.head.f, P.head.s), P.head.px, CONST.ink, "primary");
    txt(P.count.s, P.count.x - P.count.w, P.count.y, P.count.w, P.count.px, CONST.t2, "secondary");
    for (const q of P.body) txt(q.s, q.x, q.y, q.w, q.px, CONST.t2, "body");
  }
  if (gp) { if (gp.head) txt(gp.head.s, gp.head.x, gp.head.y, gp.head.w, gp.head.px, CONST.ink, "primary"); for (const q of gp.lines) txt(q.s, q.x, q.y, q.w, q.px, q.col, q.role || "body"); }
  if (Pl.hint) for (const p of Pl.hint.ps) { if (p.cap) { probe.rect("foot cap", ...b(R(p.x, Pl.hint.y - (Pl.hint.ch || DEV.d.caph) / 2, p.w, Pl.hint.ch || DEV.d.caph))); txt(p.cap, p.x + (p.w - measure(Pl.c, Pl.hint.f, p.cap)) / 2, Pl.hint.y, measure(Pl.c, Pl.hint.f, p.cap), Pl.hint.px, CONST.t2, "secondary"); } else txt(p.t, p.x, Pl.hint.y, p.w, Pl.hint.px, CONST.t2, "secondary"); }
  const F = Pl.foot;
  if (F) {
    probe.rect("foot", ...b(F));
    for (const L of F.lines) for (const p of L.ps) {
      if (p.cap) { probe.rect("foot cap", ...b(R(p.x, p.y - dv.caph / 2, p.w, dv.caph))); if (!Array.isArray(p.cap)) txt(p.cap, p.x + (p.w - measure(Pl.c, F.f, p.cap)) / 2, p.y, measure(Pl.c, F.f, p.cap), F.px, CONST.t2, "secondary"); }
      else txt(p.sep || p.t, p.x, p.y, p.w, F.px, p.sep ? CONST.off : CONST.t2, "secondary", p.sep ? {lock: true} : {});
    }
  }
}

/* ---- the frame ---- */
const outer = (d) => {
  const T0 = d.T, p = d.plate, f = d.mode === "phone" && d.foot ? d.foot : null, x = p.x - T0 - 2, y = p.y - T0 - 2;
  return R(x, y, p.w + 2 * T0 + 4, Math.max(p.h + 2 * T0 + 5, f ? f.y + f.h + 6 - y : 0));
};
export const _dbg = {plans: 0, last: null};
const S = {settings: null, graphics: null};
function frame(c, F, ui, t, page, rows, specs, foc, fks, gRow) {
  if (!okBox(F)) return;
  const level = ui.level | 0 || 1, tok = worldTokens(level), G = geom(F, rows, page), u = G.u, words = hints(), ts = textScale(), touchy = !!F.touch, paused = !!(ui.paused || F.paused), pg = pageAt(G, foc);
  const dev = deviceScale(c), dpr = capDpr(dev, touchy), tap = tapMode(touchy);
  const sig = JSON.stringify([level, G.mode, +u.toFixed(6), rows, JSON.stringify(specs, (k, v) => (k === "job" ? (v ? v.st : null) : v)), ui.kicker == null ? null : ui.kicker, ui.rev || "", words.dev, words.back, words.move, tap, ui.r3d ? 2 : ui.px ? 1 : 0, ts, dpr, paused, pg]);
  let s = S[page];
  if (!s || s.sig !== sig || s.G !== G || s.c !== c) {
    const Pl = plan(c, G, ui, specs, touchy, words), ob = outer(G.d), pb = sc(ob, u);
    const K = {biome: tok.name, level, W: F.W, H: F.H, look: "2d", textScale: ts, dpr};
    const pageKey = {...K, layer: page + ".page|" + sig}, pw = Math.round(pb.w * dpr), ph = Math.round(pb.h * dpr);
    const rd = pageRoomDpr(c, F, {rev: ui.rev}, dpr, pw * ph * 4); // MENU's room dpr (kit room.js: MENU's own room layer, the LOADING plate's too) unless this page needs less (no logo reserve: SETTINGS and GRAPHICS show no logo; lead ruling, R1 train)
    s = S[page] = {sig, G, c, Pl, ob, pb, pw, ph, pageKey, pageK: keyOf(pageKey), rd, roomK: keyOf({layer: "room", biome: tok.name, level, W: F.W, H: F.H, dpr: rd, look: "2d", textScale: 1}), room: null, page: null, subs: s ? s.subs : []};
    _dbg.plans++;
  }
  const Pl = s.Pl, d = G.d, dv = DEV[d.dev], focus = Pl.rows[foc] ? foc : null, gp = page === "graphics" ? gfxPane(mOf(c), G, gRow) : null;
  _dbg.last = {G, Pl, foc: focus, s, gp, pg};
  if (typeof c.clip !== "function" || typeof c.rect !== "function") return;
  if (canMake()) {
    for (const k of s.subs) touchK(k); // the small layers and the page before the room: a value change frees the stale page, never the room
    if (s.page && s.page.width) touchK(s.pageK);
    if (!paused) {
      if (!s.room || !s.room.width) s.room = roomLayer({w: F.W, h: F.H}, level, tok, {dpr: s.rd, look: "2d", textScale: 1});
      else touchK(s.roomK);
    }
    if (!s.page || !s.page.width) s.page = layer(s.pageKey, s.pw, s.ph, (g) => { subs = s.subs = []; try { g.scale(dpr * u, dpr * u); g.translate(-s.ob.x, -s.ob.y); paintStatic(g, G, Pl, tok, u, pg); } finally { subs = null; } });
    c.save(); c.imageSmoothingEnabled = true;
    if (!paused) c.drawImage(s.room, 0, 0, F.W, F.H);
    c.drawImage(s.page, s.pb.x, s.pb.y, s.pb.w, s.pb.h);
    c.restore();
  } else {
    c.save();
    if (!paused) { c.fillStyle = toL(tok.bg1, 0.004); c.fillRect(0, 0, F.W, F.H); }
    c.scale(u, u); paintStatic(c, G, Pl, tok, u, pg); c.restore();
  }
  c.save(); c.scale(u, u);
  for (const l of G.pages[pg]) {
    const o = Pl.rows[l];
    if (l === focus) paintRow(c, o, tok, dv, true, fks[l] || 0);
    else if (fks[l] > 0) paintVal(c, {...o, val: {P: [], x: o.val.x, w: o.val.w}}, tok, dv, fks[l]);
    if (o.spec.job) jobLine(c, o, tok);
  }
  paintGfxPane(c, gp);
  c.restore();
  if (probe.probe.on) record(G, Pl, focus, {...ui, level}, dpr, F.shell ? "sh" : "c", touchy, gp, pg);
}
const flash = (ui, t) => (typeof ui.togT === "number" && ui.togT >= 0 ? 1 - clamp((t - ui.togT) / 0.12, 0, 1) : 0);
/** Paints SETTINGS for the frame F; see the header for ui. */
export function drawSettingsPage(c, F, ui = {}, t = 0) {
  const rows = rowsOr(ui.rows, []), phoneM = okBox(F) && geom(F, rows, "settings").mode === "phone", specs = {};
  for (const l of rows) specs[l] = settingSpec(l, ui, phoneM);
  const fk = flash(ui, t);
  frame(c, F, ui, t, "settings", rows, specs, ui.row, fk > 0 && ui.row ? {[ui.row]: fk} : {}, null);
}
/** Paints GRAPHICS for the frame F; see the header for ui. */
export function drawGraphicsPage(c, F, ui = {}, t = 0) {
  const vr = (ui.view && ui.view.rows) || [], rows = GFX_LABELS.map((l, i) => (vr[i] && vr[i].label) || l), phoneM = okBox(F) && geom(F, rows, "graphics").mode === "phone", specs = {};
  rows.forEach((l, i) => { specs[l] = gfxSpec(vr[i] || {label: l, val: ""}, phoneM); });
  const fk = flash(ui, t), chg = ui.chg | 0, fks = {}, cur = clamp(ui.row | 0, 0, rows.length - 1);
  if (fk > 0) rows.forEach((l, i) => { if ((chg >> i) & 1) fks[l] = fk; });
  frame(c, F, ui, t, "graphics", rows, specs, rows[cur], fks, vr[cur] || null);
}
