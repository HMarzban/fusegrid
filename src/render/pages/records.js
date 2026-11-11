/* RECORDS PAGE (UI upgrade v202 Tasks 4.1 / 4.2; design record §4 RECORDS, §5; appendix 7.1 tabs, 7.3 pages; the round 7 S7-pages frames). One lazy module
   (pages/lazy.js "records") for the three tabs SCORES · STATS · MEDALS (SCREEN.SCORES / STATS / TROPHIES, ruling R7). The room of app.level dresses
   the stage: its room look (kit room.js, the layer MENU made when the box and level match, so a MENU <-> RECORDS trip never re-rasters it) opaque over
   the whole canvas, its rampart round the plate. recordsGeom(F) is the one geometry for draw and tap, the same for every tab so the strip never moves:
   G.d in design px (the mock's CSS px), u box units per design px. F = {W, H, touch, shell, css, ts}, as MENU's. Arrangements:
   desk   every keyboard box: the 1366 x 768 frame at u 1 (plate 980 wide, 1080 at 125 %): kicker MENU over the RECORDS title, the tabs in their wall
          trough, the pane (one height, the tallest tab's body), the foot under the plate; a smaller box scales the page as one piece (#c, the iso guard).
   phone  a touch-portrait shell box: the 393 x 852 column in CSS px (u = 1 / css, capped 600 CSS px and centred): a BACK key and the title, the tabs
          as three equal keys over the trough, the pane filling the plate; no foot.
   touch-desk any other touch shell box (a landscape tablet) while its scale holds TOUCH_U (R1 cohesion 3, as every page): the desk, its tabs and
          DIFFICULTY bank floored to 44 CSS px, STATS' COPY STATS / RESET keys under its body, the touch confirm plate, the tap foot in tap mode.
   compact any other touch box (the landscape phones' #c, a short tablet window): one header row (BACK, the title where it fits, the tabs; BACK steps down
          to its chevron where three tabs would not hold their word), the plate at most 980 wide. On a touch box a body taller than its pane is
          scaled into it (k; SCORES' bank and STATS' keys keep their size), floors giving way only there (the landscape phones' #c); the armed
          confirm plate shrinks its words the same way (fk).
   Tabs are bricks in a wall trough: the open tab the world's brick standing 2 px up, the others floor wells. SCORES: the DIFFICULTY bank (the filter,
   R7: ←/→ and the shoulders in the body, a tap anywhere), the four badges (src/app/plaques.js bits CLEAR, PLUS, MAX, CROWN; earned = the medal outline
   tag, not yet = the lock tag) and the ten-slot table (RANK, SCORE, LEVEL, MODIFIERS as a count by words.js modsCount (R10; no modifier glyph exists in
   the kit, so the count stands alone), DATE); rows arrive with placeholders already dropped (main), so the table never reads a seeded row as a played
   run. MEDALS: eight sunk tiles, earned in the medal outline, the rest quiet goals (a small lock in the outline). STATS (Task 4.2): app/stats.js
   statsView's numbers worded here: the hero, three stat tiles, LIFETIME, BEST BY DIFFICULTY, the cabinet notes; RESET quiet at rest (the foot on a
   keyboard, a quiet key on touch); armed, the page dims under a confirm plate whose one sentence is words.js resetSentence over src/app/reset.js's
   CLEAR / KEEP lists (handed in as ui.wipe), its AGAIN ERASES key focused (band face, cream label, the R keycap last) beside COPY.
   Hits: tabHit -> 0..2 or -1; scoresHit -> a difficulty 0..2, -2 on the plate (inert), -1 off it or on the BACK key (main backs out); statsHit -> a key
   code (KeyC / KeyR / KeyT, a foot label or a touch key), "back", "plate" (inert) or, armed, "cancel" (anything but AGAIN ERASES and COPY).
   Cached (kit cache.js, recency touched on a steady frame): the room, one page layer per tab and its data (plate, header, the trough with every tab at
   rest, the pane, the body at rest), the feet (one per focus, made at once). Live: the open tab, the focus (bare bomb + the 3 px cream ring on the open
   tab or the chosen difficulty), SCORES' chosen difficulty and its rows. A tab step paints its own layer once; a focus move or a filter step paints none.
   With no canvas source (Node) everything paints straight onto the target over one flat fill; a context with no clip or rect gets the plan only.
   Under the probe the page records its rects, texts and squint pairs outside any layer paint. */
import {LABEL, DIFF, RECORD_TABS, REC_WORDS as RW, BADGE_NAMES, STATS_WORDS as ST, RESET_DEFAULT, modsCount, noRunsYet, pickToSet, diffTag, speedTag, resetSentence} from "../words.js";
import {biomeOf} from "../../core/config.js";
import {FOES, POWER} from "../../core/entities.js";
import {drawEnemyBody} from "../sprites.js";
import {drawIcon} from "../icons.js";
import {worldTokens, CONST, toL} from "../kit/tokens.js";
import {key, cap, capW, plate, focusBomb, wallCell, plaque, rpath as sp, rfill as rf} from "../kit/paint.js";
import {T, DEV, measure, measure as W, textScale, nums, measurer as mOf, measures as canCap, text, CAP_K} from "../kit/type.js";
import {deep, R, sc, okBox, inR, big} from "../kit/geom.js";
import {layer, capDpr, touch, keyOf, canMake} from "../kit/cache.js";
import {roomLayer, pageRoomDpr} from "../kit/room.js";
import * as probe from "../kit/probe.js";
import {PAGE_KEY, pagerKeys, pageLabel, pageKeyAt, paintPager as kitPager} from "../kit/pager.js";
import {deviceScale} from "../logo/draw2d.js";
import {TOUCH, TOUCH_U} from "./menu.js";
import {hints, tapMode} from "../hintcopy.js";

export const PAGES = Object.freeze(["scores", "stats", "medals"]);
export const DESK = deep({
  d: {w: 980, pad: [16, 24, 22, 24], tabW: 150, pane: [22, 30, 24, 30], foot: 24, bank: 130, kick: 150, row: 26, statL: 400},
  d125: {w: 1080, pad: [16, 24, 22, 24], tabW: 170, pane: [22, 30, 24, 30], foot: 24, bank: 150, kick: 180, row: 30, statL: 450},
});
export const PHONE = deep({
  p: {side: 12, top: 16, bot: 16, pad: [12, 10, 12, 10], back: 120, pane: [18, 8, 12, 8], max: 600, row: 28},
  p125: {side: 12, top: 16, bot: 16, pad: [12, 10, 12, 10], back: 140, pane: [14, 8, 12, 8], max: 600, row: 28},
});
export const TROUGH = 11, PANE_GAP = 10, FOOT_H = 54, GUT = 8, TAB_GAP = 6, BANK_GAP = 4;

/* the bodies, laid out in a box iw wide at the device dv and text scale ts: design px relative to the body's top-left. SCORES: the DIFFICULTY kicker and
   bank stay at their size (they are touch targets); under them the badges and the table take the height left (avail), scaled by tk where they need
   more, the badges dropping first on a short touch box (tk under BADGE_K with them). row: the kicker left of the bank, else above it. */
export const BADGE_K = 0.8;
function scoresBody(dv, ts, iw, D, row, avail, c = 0, land = false) {
  const kick = dv.sec * ts * 1.2, bh = dv.bkh + 6, x0 = row ? D.kick : 0, bw = row ? Math.min(iw - x0, 3 * D.bank + 2 * BANK_GAP + 6) : iw, y0 = row ? 0 : kick + 6;
  const bank = R(x0, y0, bw, bh), kw = (bw - 6 - 2 * BANK_GAP) / 3, keys = [0, 1, 2].map((i) => R(x0 + 3 + i * (kw + BANK_GAP), y0 + 3, kw, dv.bkh));
  const stack = iw < 520, top = y0 + bh, hh = Math.round(dv.sec * ts * 1.5), rp = stack ? Math.round(dv.pri * ts * 1.15 + dv.sec * ts * 1.2 + 8) : Math.max(c ? 22 : D.row, Math.round(dv.pri * ts * 1.15)), tbl = hh + 10 * rp, bl = stack ? 2 : 1, bH = bl * dv.tg + (bl - 1) * 6, bg = c ? 8 : 14, withB = bg + bH + bg + tbl;
  let badges = true, tk = 1, per = 10, pages = 1, pagerY = null, split = false;
  if (avail > 0 && top + withB > avail) {
    /* a touch body too short pages its table instead of scaling it (fix round 1b): whole rows per page, the header on each, the badges kept; only a
       box that cannot hold MIN_ROWS rows a page still scales. On a touch board canvas (land: #c, R1 landscape) one row a page is enough, and where
       not even one fits beside the badges (or that takes fewer pages), the bank and the badges take page 1 (split 1; split 2: the bank page 1, the
       badges page 2 in its place) and the table the pages after, in the bank's place under the kicker, which names the difficulty shown there
       (words.js diffTag); the bank's keys answer on page 1 only */
    const free = avail - PAGER.h - PAGER.g - top, n = Math.floor((free - bg - bH - bg - hh + 1e-6) / rp);
    const n3 = Math.floor((avail - PAGER.h - PAGER.g - y0 - hh + 1e-6) / rp);
    const lead = bg + bH + bg <= free + 1e-6 ? 1 : bg + bH + bg <= avail - PAGER.h - PAGER.g - y0 + 1e-6 ? 2 : 0; // the split's pages before the table: the bank (and the badges where they fit beside it), else the badges' own
    if (n >= (land ? 1 : MIN_ROWS) && !(land && !row && n3 >= 1 && lead && lead + Math.ceil(10 / n3) < Math.ceil(10 / n))) { per = Math.min(10, n); pages = Math.ceil(10 / per); pagerY = avail - PAGER.h; }
    else if (land && !row && n3 >= 1 && lead) { split = lead; per = Math.min(10, n3); pages = lead + Math.ceil(10 / per); pagerY = avail - PAGER.h; }
    else { tk = (avail - top) / withB; if (tk < BADGE_K) { badges = false; tk = Math.min(1, (avail - top) / (bg + tbl)); } }
  }
  const lw = iw / tk, by = bg, hy = badges && !split ? by + bH + bg : bg, at = (r) => R(r.x * tk, top + r.y * tk, r.w * tk, r.h * tk);
  return {kick: row ? R(0, 0, x0 - 12, bh) : R(0, 0, iw, kick), bank, keys, badges: badges ? (split === 2 ? R(0, y0 + bg, lw, bH) : at(R(0, by, lw, bH))) : null, bl, head: split ? R(0, y0, lw, hh) : at(R(0, hy, lw, hh)), rp, stack,
    rows: split ? R(0, y0 + hh, lw, per * rp) : at(R(0, hy + hh, lw, per * rp)), tk, top, per, pages, pagerY, split, h: pagerY != null ? avail : top + (hy + hh + per * rp) * tk};
}
/* MEDALS paged (fix round 1b): the tiles that fit in cap, whole, per page (each laid from y0), at least MIN_TILES a page; null where they cannot */
export const MIN_ROWS = 3, MIN_TILES = 2;
function medalsPaged(dv, ts, iw, cols, lines, c, cap, minT = MIN_TILES) {
  const m = medalsBody(dv, ts, iw, cols, lines, c), th = m.tiles[0].h, gap = cols > 1 ? (c ? 4 : 8) : (c ? 4 : 6), y0 = m.tiles[0].y;
  const rowsFit = Math.floor((cap - y0 + gap + 1e-6) / (th + gap)), per = rowsFit * cols;
  if (per < minT) return null;
  const tp = [], tiles = m.tiles.map((r, i) => { const p = Math.floor(i / per), j = i % per; tp.push(p); return R(r.x, y0 + Math.floor(j / cols) * (th + gap), r.w, r.h); });
  return {...m, tiles, tp, pages: Math.ceil(8 / per), per, h: cap};
}
/* MEDALS: eight tiles, two columns from 640 wide (or on a short touch box, where two columns of three-line goals scale less than one column) */
function medalsBody(dv, ts, iw, cols = iw >= 640 ? 2 : 1, lines = 2, c = 0) {
  const cnt = dv.sec * ts * 1.2, gap = c ? 4 : cols > 1 ? 8 : 6, pad = c ? 5 : 8, y0 = cnt + (c ? 4 : 8);
  const th = Math.round(2 * pad + dv.pri * ts * 1.15 + 4 + lines * dv.sec * ts * 1.2), tw = (iw - (cols - 1) * gap) / cols, n = 8 / cols;
  const tiles = Array.from({length: 8}, (_, i) => R((i % cols) * (tw + gap), y0 + Math.floor(i / cols) * (th + gap), tw, th));
  return {count: R(0, 0, iw, cnt), tiles, cols, pad, lines, h: y0 + n * th + (n - 1) * gap};
}
/* STATS (Task 4.2): the hero (BEST SCORE, its qualifier on up to two lines, the score in brick digits; then, apart, the level course and FURTHEST
   LEVEL n · WORLD: the stores keep the best score and the furthest level as separate maxima, so they are two facts, never one run), three
   stat tiles (RUNS, PLAY TIME, MEDALS), LIFETIME (five ledger lines), BEST BY DIFFICULTY (no modifiers, NORMAL SPEED: three two-line ledger lines, the
   level under the difficulty) and the cabinet's notes. Two columns from 700 wide (the hero and the bests left of a wall course; the tiles, LIFETIME and
   the notes right), one column below it (there the notes drop: their facts ride the copy payload and MENU's DAILY teaser). */
export const LEDGER = Object.freeze({d: 35, p: 30});
/* tight (a touch body too short for it, steps in order so its words keep their size): 1 the gaps close to 10, 2 the level course drops (FURTHEST
   LEVEL n · WORLD still says it), 3 the LIFETIME pitch closes to 27, 4 the stat tiles tighten (a 20 px glyph, closer pads; fix round 1), 5 the bests
   take one line each (the level after the difficulty, stepping out where it would touch the score) */
export const TILE = Object.freeze({n: {top: 8, gs: 28, gg: 6, pad: 12}, t: {top: 6, gs: 20, gg: 3, pad: 10}});
function statsBody(dv, ts, iw, D, narrow, tight = 0) {
  const sec = dv.sec * ts * 1.2, pri = dv.pri * ts * 1.2, lh = Math.max(tight >= 3 ? 27 : narrow ? LEDGER.p : LEDGER.d, Math.round(dv.pri * ts * 1.5)), one = tight >= 5, tl = tight >= 4 ? TILE.t : TILE.n, lh2 = one ? lh : Math.round(dv.pri * ts * 1.15 + sec + 4), g = tight >= 1 ? 10 : narrow ? 14 : 18;
  const L = narrow ? iw : D.statL, rx = narrow ? 0 : L + 40, rw = narrow ? iw : iw - rx;
  let y = 0;
  const kick = R(0, y, L, sec); y += sec + 4;
  const qual = R(0, y, L, 2 * pri); y += 2 * pri + 8;
  const digits = R(0, y, L, dv.sdh + 4); y += dv.sdh + 4 + 8;
  const course = tight >= 2 ? null : R(0, y, L, dv.lch + 4); if (course) y += dv.lch + 4 + 6;
  const reached = R(0, y, L, sec); y += sec;
  const tileH = Math.round(tl.top + 4 + tl.gs + tl.gg + dv.hud * ts + 6 + sec), tw = (rw - 20) / 3;
  let ry = narrow ? y + g : 0;
  const tiles = [0, 1, 2].map((i) => R(rx + i * (tw + 10), ry, tw, tileH));
  ry += tileH + g;
  const lifeK = R(rx, ry, rw, sec); ry += sec + 6;
  const life = [0, 1, 2, 3, 4].map((i) => R(rx, ry + i * lh, rw, lh)); ry += 5 * lh;
  /* the kicker breaks once (BEST BY DIFFICULTY / NO MODIFIERS · NORMAL SPEED) wherever its width at the recorder's generous 0.648 em (0.6 + 8 %)
     passes its column, 100 % included (fix round 1: one line ran into the wall course); the plan then draws one line only where it measures inside
     the column. Broken on a two-column desk, the gap above it closes to 12 so the 1366 x 768 frame still fits unscaled */
  const bk = narrow || bestKick().join(" · ").length * 0.648 * dv.sec * ts > L ? 2 : 1;
  let by = narrow ? ry + g : y + (bk === 2 && g > 12 ? 12 : g);
  const bestK = R(0, by, L, bk * sec); by += bk * sec + 6;
  const best = [0, 1, 2].map((i) => R(0, by + i * lh2, L, lh2)); by += 3 * lh2;
  const notes = narrow ? null : R(rx, ry + 12, rw, 3 * sec), h = narrow ? by : Math.max(by, ry + 12 + 3 * sec);
  return {kick, qual, digits, course, reached, tiles, tl, lifeK, life, bestK, bk, best, one, notes, lh, lh2, div: narrow ? null : R(L + 18, 0, 3, h), narrow, h};
}
const bestKick = () => [ST.BY_DIFF, RW.NO_MODS + " · " + speedTag(0)];
/* the armed reset's confirm plate (appendix 7.3) inside the pane: desk centred, 700 wide (680 at 125 %), its keys side by side (stacked at 125 %); touch at
   the pane's foot, its keys stacked full width over TAP ANYWHERE ELSE TO CANCEL. Lines are counted at a generous 0.66 em, so the measured wrap fits. */
const estLines = (s, px, w) => { let n = 1, cur = 0; for (const wd of String(s).split(" ")) { const ww = (wd.length + 1) * 0.7 * px; if (cur && cur + ww > w) { n++; cur = ww; } else cur += ww; } return n; };
/* floorY (a touch box): AGAIN ERASES ends above it, clear of the COPY STATS / RESET keys, so no point of RESET (or COPY) is ever AGAIN ERASES: a
   double tap on RESET never erases. Below AGAIN ERASES the plate (COPY, the cancel line) may run on over the dimmed keys to the plate's foot (fix
   round 1b: a short phone keeps the sentence at its size) */
function confirmGeom(pane, dv, ts, touch, T0, t125, plateR, tall, floorY) {
  const pad = touch ? [16, 14] : [22, 26], cw = touch ? pane.w - 2 * (T0 + 8) : Math.min(pane.w - 2 * (T0 + 8), t125 ? 680 : 700), iw = cw - 2 * pad[1];
  const foot = plateR ? plateR.y + plateR.h - T0 - 4 : Infinity, bot = floorY != null ? floorY : foot, stack = (touch && tall) || t125, kh = touch ? DEV.p.btnh : dv.btnh, keysH = stack ? 2 * kh + 12 : kh;
  /* a short box (a landscape phone's #c) shrinks the plate's words (fk) until it fits: the floors give way only there. The plate starts in the pane
     (never over the tabs and the trough, fix round 1b); only where AGAIN ERASES could not stay above floorY even so does it start at the plate's top */
  let fk = 1, tl, th, bl, bh, can, h, h1, top, room;
  for (const t0 of [Math.max(plateR ? plateR.y + T0 + 4 : -Infinity, pane.y + T0 + 2), plateR ? plateR.y + T0 + 4 : -Infinity]) {
    top = t0; room = bot - top; fk = 1;
    for (;;) {
      const tpx = dv.ttl * 0.72 * ts * fk, bod = dv.bod * ts * fk;
      tl = estLines(ST.TITLE, tpx * 0.95, iw - 34); th = tl * tpx * 1.1; bl = estLines(RESET_DEFAULT, bod, iw); bh = bl * bod * 1.5; can = touch ? dv.sec * ts * fk * 1.2 + 12 : 0;
      h = pad[0] + th + 14 + bh + 18 + keysH + can + pad[0];
      h1 = pad[0] + th + 14 + bh + 18 + kh; // to AGAIN ERASES' foot: above floorY
      if ((floorY != null ? h1 <= room && h <= foot - top : h <= room) || fk < 0.4) break;
      fk *= 0.92;
    }
    if (floorY == null || h1 <= room) break;
  }
  const x = pane.x + (pane.w - cw) / 2, y = touch ? Math.max(top, Math.min(bot - h, bot - (h - keysH - can - pad[0] + kh))) : Math.max(top, pane.y + (pane.h - h) / 2), ky = y + pad[0] + th + 14 + bh + 18, kw = stack ? iw : (iw - 14) / 2;
  const again = R(x + pad[1], ky, kw, kh), copy = stack ? R(x + pad[1], ky + kh + 12, iw, kh) : R(x + pad[1] + kw + 14, ky, kw, kh);
  return {box: R(x, y, cw, h), title: R(x + pad[1], y + pad[0], iw, th), tl, body: R(x + pad[1], y + pad[0] + th + 14, iw, bh), bl, fk, again, copy, cancel: touch ? R(x + pad[1], (stack ? copy.y : again.y) + kh + 12, iw, dv.sec * ts * fk * 1.2) : null};
}
/* STATS PAGES (lead ruling, fix round 1b; lane rules lesson 1, SETTINGS' paginate is the reference): a narrow touch body that does not fit unscaled
   after the tight steps pages instead of scaling. Whole sections per page, in order: the hero (BEST SCORE, its digits, the course, FURTHEST LEVEL),
   the stat tiles, LIFETIME, BEST BY DIFFICULTY, laid at tight 1 (the course and the two-line bests kept: a page has the room). A strip under them
   holds PAGE n OF m and the ▲ / ▼ page keys (44 CSS px, 8 apart). Keys and a controller carry the page (↓ / ↑ in the body, menuapp _recFocus), a
   tap turns it (statsHit PageUp / PageDown), tap mode keeps the keys; the armed confirm plate stays one page. A section taller than a page (the
   landscape phones' #c) still scales, floors giving way only there. */
export const PAGER = Object.freeze({h: PAGE_KEY, g: 8}); // the kit pager's strip and the gap above it
const SECS = Object.freeze({hero: ["kick", "qual", "digits", "course", "reached"], tiles: ["tiles"], life: ["lifeK", "life"], bests: ["bestK", "best"]});
const span = (b, sec) => { const rs = SECS[sec].flatMap((n) => [].concat(b[n] || [])).filter(Boolean); return [Math.min(...rs.map((r) => r.y)), Math.max(...rs.map((r) => r.y + r.h))]; };
function pageStats(dv, ts, iw, D, cap) {
  const b = statsBody(dv, ts, iw, D, true, 1), g = 10, pg = {}, dy = {};
  let p = 0, used = 0, any = false, top = 0;
  for (const sec of Object.keys(SECS)) {
    const [y0, y1] = span(b, sec), h = y1 - y0;
    if (any && used + g + h > cap + 1e-6) { p++; used = 0; any = false; }
    const at = any ? used + g : 0;
    pg[sec] = p; dy[sec] = at - y0; used = at + h; any = true; top = Math.max(top, used);
  }
  const out = {...b, pg, pages: p + 1, h: top};
  for (const [sec, names] of Object.entries(SECS)) for (const n of names) {
    const v = b[n], sh = (r) => (r ? R(r.x, r.y + dy[sec], r.w, r.h) : r);
    out[n] = Array.isArray(v) ? v.map(sh) : sh(v);
  }
  return out;
}
/* a touch board canvas (#c, R1 landscape): STATS pages by its PARTS (whole items: a kicker kept with its first line, every ledger line, the stat
   tiles as one row) and its COPY STATS / RESET keys are the last item, so no page holds a part under its floors; each part keeps the gap above it
   from statsBody inside its section (10 between sections). pg maps a part (kick qual digits course reached tiles lifeK life0..4 bestK best0..2 acts)
   to its page */
const SEC_OF = {kick: "hero", qual: "hero", digits: "hero", course: "hero", reached: "hero", tiles: "tiles", lifeK: "life", bestK: "bests"};
const secOf = (p) => SEC_OF[p] || (/^life/.test(p) ? "life" : /^best/.test(p) ? "bests" : p);
function pageStatsLand(dv, ts, iw, D, cap, actH) {
  const b = statsBody(dv, ts, iw, D, true, 1), at = (p) => (/^life\d/.test(p) ? b.life[+p.slice(4)] : /^best\d/.test(p) ? b.best[+p.slice(4)] : p === "tiles" ? R(0, b.tiles[0].y, iw, b.tiles[0].h) : b[p]);
  const items = [["kick", "qual"], ["digits"], [b.course ? "course" : null, "reached"].filter(Boolean), ["tiles"], ["lifeK", "life0"], ["life1"], ["life2"], ["life3"], ["life4"], ["bestK", "best0"], ["best1"], ["best2"]];
  const pg = {}, dy = {}, out = {};
  let p = 0, used = 0, prev = null, top = 0, acts = null;
  for (const it of [...items, ["acts"]]) {
    const rs = it[0] === "acts" ? [R(0, 0, iw, actH)] : it.map(at), y0 = Math.min(...rs.map((r) => r.y)), h = Math.max(...rs.map((r) => r.y + r.h)) - y0;
    const g = prev == null ? 0 : it[0] !== "acts" && secOf(it[0]) === secOf(prev.p) ? Math.max(0, y0 - prev.y1) : 10;
    if (prev != null && used + g + h > cap + 1e-6) { p++; used = 0; prev = null; }
    const yy = it[0] === "acts" ? cap - h : prev == null ? 0 : used + g; // COPY / RESET stand at their page's foot (the armed plate keeps AGAIN ERASES above them)
    for (const q of it) { pg[q] = p; dy[q] = yy - y0; }
    if (it[0] === "acts") acts = {y: yy, p};
    used = yy + h; top = Math.max(top, used); prev = {p: it[it.length - 1], y1: y0 + h};
  }
  for (const n of ["kick", "qual", "digits", "course", "reached", "lifeK", "bestK"]) out[n] = b[n] ? R(b[n].x, b[n].y + dy[n], b[n].w, b[n].h) : b[n];
  out.tiles = b.tiles.map((r) => R(r.x, r.y + dy.tiles, r.w, r.h));
  out.life = b.life.map((r, i) => R(r.x, r.y + dy["life" + i], r.w, r.h));
  out.best = b.best.map((r, i) => R(r.x, r.y + dy["best" + i], r.w, r.h));
  return {...b, ...out, pg, pages: p + 1, h: top, actY: acts.y, actP: acts.p};
}
/* a body placed at (x, y) scaled by k: every rect in it made absolute; k, x, y the scaled region's scale and origin (SCORES: tk at the table's top) */
function place(b, x, y, k) {
  const out = {k, x, y};
  for (const [n, v] of Object.entries(b)) out[n] = Array.isArray(v) ? v.map((r) => (r && typeof r === "object" ? R(x + r.x * k, y + r.y * k, r.w * k, r.h * k) : r)) : v && typeof v === "object" && "w" in v ? R(x + v.x * k, y + v.y * k, v.w * k, v.h * k) : v;
  return out;
}
function bodiesAt(dv, ts, iw, D, row, bx, by, avail, c = 0, st0 = 0, land = false) {
  const out = {}, s = scoresBody(dv, ts, iw, D, row, avail, c, land), pagerAt = (y) => pagerKeys(bx, y, iw, PAGER.h);
  out.scores = place(s, bx, by, 1);
  Object.assign(out.scores, {k: s.tk, y: by + s.top});
  if (s.pagerY != null) out.scores.pager = pagerAt(by + s.pagerY);
  const cm = land ? 1 : c; // a touch board canvas: MEDALS' tight gaps and pads (each tile keeps its words at size)
  const opts = [[iw >= 640 ? 2 : 1, 2], ...(iw < 640 && iw >= 340 ? [[2, 3]] : [])].map(([cl, ln]) => {
    let m = medalsBody(dv, ts, iw, cl, ln, cm), k = 1;
    if (avail > 0 && m.h > avail) { k = avail / m.h; m = medalsBody(dv, ts, iw / k, cl, ln, cm); }
    return {m, k};
  });
  const best = opts.reduce((a, o) => (o.k > a.k + 1e-9 ? o : a));
  /* a touch body too short pages the medals (whole tiles) instead of scaling them: the column count that puts the most on a page */
  /* paged, a goal must stay whole in its tile at full size: one column (the widest tile), two goal lines (three at 125 %), or two columns from 640 */
  const mp = avail > 0 && best.k < 1 - 1e-9 ? medalsPaged(dv, ts, iw, iw >= 640 ? 2 : 1, big(ts) ? 3 : 2, cm, avail - PAGER.h - PAGER.g, land ? 1 : MIN_TILES) : null; // a touch board canvas: one tile a page is enough
  out.medals = mp ? place(mp, bx, by, 1) : place(best.m, bx, by, best.k);
  if (mp) out.medals.pager = pagerAt(by + avail - PAGER.h);
  /* STATS: on a touch box COPY STATS and RESET sit under the body at their size; the body above them scales into what is left */
  const actH = avail > 0 ? DEV.p.btnh : 0, room = avail > 0 ? avail - actH - 14 : 0, narrow = iw < 700;
  let tt = st0, st = statsBody(dv, ts, iw, D, narrow, tt), sk = 1;
  for (let t = tt + 1; room > 0 && st.h > room && t <= 4; t++) st = statsBody(dv, ts, iw, D, narrow, tt = t);
  /* step 5 (one-line bests) only where it makes the body fit; a body that must scale anyway keeps its two-line bests and every level */
  if (room > 0 && st.h > room) { const s5 = statsBody(dv, ts, iw, D, narrow, 5); if (s5.h <= room) st = s5; }
  let pager = null;
  if (land && room > 0 && st.h > room) { /* a touch board canvas: the parts page, COPY / RESET the last item */
    const cap = avail - PAGER.h - PAGER.g, L = pageStatsLand(dv, ts, iw, D, cap, actH);
    if (L.h <= cap + 1e-6) {
      const cw = Math.round((iw - 12) * 0.58);
      out.stats = place(L, bx, by, 1);
      Object.assign(out.stats, {pager: pagerAt(by + avail - PAGER.h), acts: {copy: R(bx, by + L.actY, cw, actH), reset: R(bx + cw + 12, by + L.actY, iw - cw - 12, actH), p: L.actP}});
      return out;
    }
  }
  if (room > 0 && st.h > room && narrow && room - PAGER.h - PAGER.g > 0) {
    const cap = room - PAGER.h - PAGER.g;
    st = pageStats(dv, ts, iw, D, cap);
    if (st.h > cap) sk = cap / st.h; // a section taller than a page: the landscape phones' #c only
    pager = pagerAt(by + room - PAGER.h);
  }
  if (room > 0 && st.h > room && !pager) { sk = room / st.h; st = statsBody(dv, ts, iw / sk, D, (iw / sk) < 700, tt); }
  out.stats = place(st, bx, by, sk);
  if (pager) out.stats.pager = pager;
  if (actH) { const cw = Math.round((iw - 12) * 0.58); out.stats.acts = {copy: R(bx, by + avail - actH, cw, actH), reset: R(bx + cw + 12, by + avail - actH, iw - cw - 12, actH)}; }
  return out;
}

/* the desk gives way before it scales (as MENU's): SHORT[sl] for sl = 0.. in order, the first that fits the box at u 1 wins, else the last scales as
   one piece. 1 the margins close (the plate's ring 18 from the top, the foot 10 under the plate, 4 under it); 2 the plate's and the pane's pads and the
   head's gaps close; 3 the bodies tighten (SCORES' rows 24 and badge gaps 8, MEDALS' gaps 4 and pads 5, STATS' gaps 10); 4 STATS' level course drops
   (FURTHEST LEVEL n · WORLD still says it); 5 the MENU kicker drops (the title stays) and STATS' LIFETIME pitch closes; 6 STATS' tiles tighten;
   7 STATS' bests take one line.
   Steps 4 to 7 take something away, so they are used only where they make the page fit (u >= FIT_U, inside the text floors' tolerance); a box that
   must scale anyway (#c's 600 x 520, the iso guard) scales at step 3, every word kept. A narrower window narrows the plate first, down to 40 px under
   the mock's (the bodies keep their columns), then scales. */
const SHORT = deep([
  {top: 0, foot: 24, bot: 4, pad: null, gap: 10, pg: PANE_GAP, pane: null, c: 0, st: 0, kick: true},
  {top: 18, foot: 10, bot: 4, pad: null, gap: 10, pg: PANE_GAP, pane: null, c: 0, st: 0, kick: true},
  {top: 18, foot: 10, bot: 4, pad: [10, 12], gap: 6, pg: 6, pane: [12, 12], c: 0, st: 0, kick: true},
  {top: 18, foot: 10, bot: 4, pad: [10, 12], gap: 6, pg: 6, pane: [12, 12], c: 1, st: 1, kick: true},
  {top: 18, foot: 10, bot: 4, pad: [10, 12], gap: 6, pg: 6, pane: [12, 12], c: 1, st: 2, kick: true},
  {top: 18, foot: 10, bot: 4, pad: [10, 12], gap: 6, pg: 6, pane: [12, 12], c: 1, st: 3, kick: false},
  {top: 18, foot: 10, bot: 4, pad: [10, 12], gap: 6, pg: 6, pane: [12, 12], c: 1, st: 4, kick: false},
  {top: 18, foot: 10, bot: 4, pad: [10, 12], gap: 6, pg: 6, pane: [12, 12], c: 1, st: 5, kick: false},
]);
export const PW_GIVE = 40, FIT_U = 0.995, KEEP_SL = 3;
function deskAt(F, t125, sl, fl = 0) {
  const D = DESK[t125 ? "d125" : "d"], K = SHORT[sl], dv = fl ? {...DEV.d, bkh: Math.max(DEV.d.bkh, fl)} : DEV.d, ts = F.ts, T0 = dv.T, side = T0 + 2 + GUT;
  const pad = [K.pad ? K.pad[0] : D.pad[0], D.pad[1], K.pad ? K.pad[1] : D.pad[2], D.pad[3]], pp = [K.pane ? K.pane[0] : D.pane[0], D.pane[1], K.pane ? K.pane[1] : D.pane[2], D.pane[3]];
  const pw0 = Math.max(D.w - PW_GIVE, Math.min(D.w, F.W - 2 * side)), uw = Math.min(1, F.W / (pw0 + 2 * side));
  const kick = K.kick ? dv.sec * ts * 1.2 : 0, ttl = dv.ttl * ts * 1.05, head = (K.kick ? kick + 2 : 0) + ttl, tabsH = 2 + dv.bkh + TROUGH;
  const iw = pw0 - pad[1] - pad[3] - 4 - pp[1] - pp[3];
  const bh = Math.max(scoresBody(dv, ts, iw, D, true, 0, K.c).h, medalsBody(dv, ts, iw, undefined, 2, K.c).h, statsBody(dv, ts, iw, D, iw < 700, K.st).h + (fl ? DEV.p.btnh + 14 : 0)), paneH = 4 + pp[0] + bh + pp[2];
  const ph = pad[0] + head + K.gap + tabsH + K.pg + paneH + pad[2], top = K.top || side, below = K.foot + FOOT_H + (K.top ? K.bot : side + 4);
  const u = Math.min(uw, F.H / (top + ph + below));
  return {D, K, dv, ts, T0, side, pad, pp, pw0, kick, ttl, head, tabsH, iw, bh, paneH, ph, top, below, u, fl};
}
/* fl (a touch shell box: the touch-desk form, as MENU's, GUIDE's and SETTINGS' desks on a landscape tablet): the tabs and the DIFFICULTY bank floored
   to fl design px (44 CSS px at the page's scale), STATS' COPY STATS / RESET keys under its body (the touch keys), the touch confirm plate */
function desk(F, t125, fl = 0) {
  let A = deskAt(F, t125, 0, fl);
  for (let sl = 1; A.u < 1 && sl < SHORT.length; sl++) { const B = deskAt(F, t125, sl, fl); if (B.u > A.u + 1e-6) A = B; } // a step that gains nothing is not taken
  if (A.u < FIT_U) { A = deskAt(F, t125, KEEP_SL, fl); }
  else if (A.u < 1) { for (let sl = 1; sl <= KEEP_SL; sl++) { const B = deskAt(F, t125, sl, fl); if (B.u >= 1 - 1e-9) { A = B; break; } } }
  const {D, K, dv, ts, T0, pad, pp, kick, ttl, head, iw, bh, paneH, ph, top, below, u} = A;
  const Wd = F.W / u, Hd = F.H / u, pw = A.pw0, px = (Wd - pw) / 2, py = Math.max(top, (Hd - ph - K.foot - FOOT_H) / 2);
  const ix = px + pad[3], iwP = pw - pad[1] - pad[3], hy = py + pad[0], ty = hy + head + K.gap + 2;
  const tabs = [0, 1, 2].map((i) => R(ix + i * (D.tabW + TAB_GAP), ty, D.tabW, dv.bkh));
  const pane = R(ix, ty + dv.bkh + TROUGH + K.pg, iwP, paneH), bx = pane.x + 2 + pp[3], by = pane.y + 2 + pp[0], bodies = bodiesAt(dv, ts, iw, D, true, bx, by, fl ? bh : 0, K.c, K.st);
  return {mode: "desk", dev: "d", u, t125, sl: SHORT.indexOf(K), T: T0, plate: R(px, py, pw, ph), kick: K.kick ? R(ix, hy, iwP, kick) : null, title: R(ix, hy + (K.kick ? kick + 2 : 0), iwP, ttl), back: null,
    tabs, trough: R(ix, ty + dv.bkh, iwP, TROUGH), pane, body: R(bx, by, iw, bh), bodies, foot: R(px, py + ph + K.foot, pw, FOOT_H),
    confirm: fl ? confirmGeom(pane, dv, ts, true, 8, t125, R(px, py, pw, ph), false, bodies.stats.acts.copy.y - 12) : confirmGeom(pane, dv, ts, false, 8, t125, R(px, py, pw, ph))};
}
/* the touch-desk form: the floors re-solved at the page's own scale (twice: a scale under 1 grows them), then kept only while that scale holds TOUCH_U */
function deskTouch(F, t125, css) {
  let d = desk(F, t125, TOUCH.h / css);
  for (let i = 0; i < 2 && d.u < 1 - 1e-9; i++) d = desk(F, t125, TOUCH.h / (css * d.u));
  return d.u * css >= TOUCH_U - 1e-9 ? d : null;
}
/* every touch box, in CSS px (u = 1 / css, or less where the frame itself does not fit). phone (a touch-portrait shell box): BACK and the title, the tabs
   across under them. compact (any other touch box the touch-desk form does not hold, the landscape phones' #c included): one header row, BACK, the title where it fits (else it drops: the
   open tab names the page), the tabs; the plate at most the desk's 980 wide, centred */
const TITLE_W = 150, TAB_MIN = 96;
const LAND = Object.freeze({top: 12, bot: 13, pad: Object.freeze([9, 10, 6, 10]), pane: Object.freeze([4, 6, 4, 6]), gap: 4});
function touchFrame(F, t125) {
  const land = !F.shell, P = land ? {...PHONE[t125 ? "p125" : "p"], ...LAND} : PHONE[t125 ? "p125" : "p"], dv = DEV.p, ts = F.ts, css = F.css > 0 ? F.css : 1, T0 = dv.T, tall = !!F.shell && F.H > F.W * 1.3;
  const head = tall ? dv.keyh + 12 + 2 + dv.bkh : dv.keyh, PG = land ? LAND.gap : PANE_GAP;
  const fixed = P.top + P.pad[0] + head + TROUGH + PG + 4 + P.pane[0] + P.pane[2] + P.pad[2] + P.bot, minBody = tall ? 120 : 90;
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
    const need = 6 * 0.66 * dv.pri * ts + dv.bombs + 14, fit3 = (bw) => (iwP - bw - 12 - 2 * TAB_GAP) / 3;
    if (fit3(P.back) < need) back = R(ix, hy, dv.keyh, dv.keyh);
    const room = iwP - back.w - 12, withT = (room - TITLE_W - 12 - 2 * TAB_GAP) / 3, tw = Math.min(DESK.d.tabW, withT >= TAB_MIN ? withT : (room - 2 * TAB_GAP) / 3), x0 = ix + iwP - 3 * tw - 2 * TAB_GAP;
    tabs = [0, 1, 2].map((i) => R(x0 + i * (tw + TAB_GAP), hy + dv.keyh - dv.bkh, tw, dv.bkh));
    if (withT >= TAB_MIN) title = R(ix + back.w + 14, hy, x0 - 12 - (ix + back.w + 14), dv.keyh);
  }
  const tb = tabs[0].y + dv.bkh, tx = tall ? ix : tabs[0].x, trough = R(tx, tb, ix + iwP - tx, TROUGH);
  const pane = R(ix, tb + TROUGH + PG, iwP, py + ph - P.pad[2] - (tb + TROUGH + PG));
  const iw = pane.w - 4 - P.pane[1] - P.pane[3], bh = pane.h - 4 - P.pane[0] - P.pane[2], bx = pane.x + 2 + P.pane[3], by = pane.y + 2 + P.pane[0];
  const bodies = bodiesAt(dv, ts, iw, {...P, kick: DESK.d.kick, bank: DESK.d.bank, statL: DESK.d.statL}, iw >= 520, bx, by, bh, 0, 0, land);
  return {mode: tall ? "phone" : "compact", dev: "p", u, t125, T: T0, plate: R(px, py, pw, ph), kick: null, title, back, tabs, trough, pane, body: R(bx, by, iw, bh),
    bodies, foot: null, confirm: confirmGeom(pane, dv, ts, true, 6, t125, R(px, py, pw, ph), tall, (bodies.stats.acts ? bodies.stats.acts.copy.y : by + bh - DEV.p.btnh) - 12)};
}
let gm = null;
/** The one geometry for draw and tap; see the header. */
export function recordsGeom(F) {
  const ts = F.ts > 0 ? F.ts : textScale(), t125 = big(ts), touchy = !!F.touch, css = F.css > 0 ? F.css : 1;
  const shell = !!F.shell;
  if (gm && gm.W === F.W && gm.H === F.H && gm.touch === touchy && gm.ts === ts && gm.css === css && gm.shell === shell) return gm.G;
  /* the arrangement rule every page keeps (R1 cohesion 3): desk on a keyboard box; phone on a touch-portrait shell box; the touch-desk form on any
     other touch shell box (a landscape tablet) while its scale holds TOUCH_U; else compact */
  const tall = shell && touchy && F.H > F.W * 1.3, d = !touchy ? desk({...F, ts}, t125) : (!tall && shell && deskTouch({...F, ts}, t125, css)) || touchFrame({...F, ts}, t125), u = d.u;
  const G = {mode: d.mode, dev: d.dev, u, t125, ts, W: F.W, H: F.H, d, touch: touchy, T: d.T * u, plate: sc(d.plate, u), tabs: d.tabs.map((r) => sc(r, u)), back: sc(d.back, u), foot: sc(d.foot, u), keys: d.bodies.scores.keys.map((r) => sc(r, u)), pane: sc(d.pane, u)};
  gm = {W: F.W, H: F.H, touch: touchy, ts, css, shell, G: deep(G)};
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
/* on the plate, or on the desk foot's plaque (its words and keycaps look like keys: a tap there is inert, never a back-out; fix round 1): the plaque as
   last painted for this geometry, else the foot's whole row */
const onPlate = (G, dx, dy) => {
  if (inR(G.d.plate, dx, dy)) return true;
  if (!G.d.foot) return false;
  const q = S && S.G === G && S.feet ? S.feet.find((f) => f.v === S.fv) : null;
  return inR(q ? R(q.fp.x, q.fp.y, q.fp.w, q.fp.h) : G.d.foot, dx, dy);
};
/** SCORES: the difficulty under (x, y); -2 on the plate (inert), -1 off it or on the BACK key (main backs out). */
export function scoresHit(x, y, F, spage = 0) {
  if (!okBox(F)) return -1;
  const G = recordsGeom(F), [dx, dy] = toD(G, x, y), b = G.d.bodies.scores;
  if (inR(G.d.back, dx, dy)) return -1;
  if (!(b.split && spage >= 1)) for (let i = 0; i < 3; i++) { const r = b.keys[i]; if (inR(R(r.x - BANK_GAP / 2, b.bank.y, r.w + BANK_GAP, b.bank.h), dx, dy)) return i; }
  if (footHit(G, dx, dy) === "back") return -1; // the foot's BACK label (its words and keycap) backs out; the rest of the plaque is inert
  return onPlate(G, dx, dy) ? -2 : -1;
}
/* the desk foot's tap zones: each item from its label to its last keycap, on the foot painted for this geometry (the last plan). A zone answers only
   when the painted foot's armed state is the one asked (fix round 1): a second click that lands before the armed frame paints reads no idle RESET */
function footHit(G, dx, dy, arm = false) {
  const S0 = S, q = S0 && S0.G === G && S0.feet && (S0.fv === "arm") === !!arm ? S0.feet.find((f) => f.v === S0.fv) : null;
  if (!q || dy < q.fp.y || dy > q.fp.y + q.fp.h) return null;
  for (const z of q.fp.zones) if (dx >= z.x0 - 6 && dx <= z.x1 + 6) return z.key || null;
  return null;
}
/** STATS: a key code (KeyC / KeyR / KeyT: a foot label, a touch key, or armed AGAIN ERASES / COPY), "back" (BACK, off the plate), "plate" (on it, inert),
    or, armed, "cancel" for anything else (the confirm plate is modal). */
export function statsHit(x, y, F, arm, spage = 0) {
  if (!okBox(F)) return arm ? "cancel" : "back";
  const G = recordsGeom(F), [dx, dy] = toD(G, x, y), d = G.d;
  if (arm) return inR(d.confirm.again, dx, dy) ? "KeyR" : inR(d.confirm.copy, dx, dy) ? "KeyC" : footHit(G, dx, dy, true) || "cancel";
  if (inR(d.back, dx, dy)) return "back";
  const a0 = d.bodies.stats.acts, a = a0 && (a0.p == null || a0.p === spage) ? a0 : null; // a paged #c STATS: COPY / RESET on their page only
  if (a && inR(a.copy, dx, dy)) return "KeyC";
  if (a && inR(a.reset, dx, dy)) return "KeyR";
  const pg = d.bodies.stats.pager; // the page keys (a key with no page to open is a well: inert)
  if (pg && inR(pg.up, dx, dy)) return "PageUp";
  if (pg && inR(pg.dn, dx, dy)) return "PageDown";
  const f = footHit(G, dx, dy);
  if (f) return f;
  return onPlate(G, dx, dy) ? "plate" : "back";
}
/* SCORES' pages follow the rows it draws (an empty table is one page, so no PAGE 1 OF n and no header-only page) */
const scoresPages = (b, rows) => (b && b.pager ? (b.split | 0) + Math.max(1, Math.ceil(Math.max(0, Math.min(10, rows | 0)) / b.per)) : 1); // split: the badges' page first
/* the table's page (split: page 1 is the badges' alone, -1) and an empty table's two lines, centred in its first rows */
const tpage = (b, P) => (P.pg ? P.pg.page : 0) - (b.split | 0);
const bankOn = (b, P) => !b.split || !(P.pg && P.pg.page), badgeOn = (b, P) => !b.split || (P.pg ? P.pg.page : 0) === b.split - 1;
const emptyY = (per, j) => (j ? Math.min(4.2, Math.max(0.75, per - 0.5)) : Math.min(3, Math.max(0.3, per - 1.5)));
/** A tab's page count on this box (1 where its body fits unpaged): what the app's ↑ / ↓ and the page keys clamp to. page: scores | stats | medals;
    rows: SCORES' rows for the difficulty shown (its pages follow them). */
export function recPages(F, page, rows) {
  const b = okBox(F) ? recordsGeom(F).d.bodies[page] : null;
  if (!b || !b.pager) return 1;
  return page === "scores" ? scoresPages(b, rows) : b.pages;
}
export const statsPages = (F) => recPages(F, "stats");
/** The page keys under (x, y): kit pager pageKeyAt's {k: "page", d, to: d} (the app's recPageStep clamps), else null (no pager, or off its keys;
    SCORES: no keys where its rows fit one page). */
export function pageKeyHit(x, y, F, page, rows) {
  if (!okBox(F) || recPages(F, page, rows) < 2) return null;
  const G = recordsGeom(F), [dx, dy] = toD(G, x, y), b = G.d.bodies[page], q = b && b.pager;
  return pageKeyAt(q, dx, dy);
}
/** MEDALS and any page with no body hit: -2 on the plate, -1 off it or on the BACK key. */
export function plateHit(x, y, F) {
  if (!okBox(F)) return -1;
  const G = recordsGeom(F), [dx, dy] = toD(G, x, y);
  return inR(G.d.back, dx, dy) || footHit(G, dx, dy) === "back" ? -1 : onPlate(G, dx, dy) ? -2 : -1;
}

/* measuring: a context that cannot measure plans on a 0.6 em estimate */
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
  /* the focus bomb is always drawn (fix round 1). A focused legend that would not fit beside it steps down: to its 100 % size (still above the
     floors), then, only on a touch box whose tabs are too narrow even for that (the landscape phones' #c, where the floors give way), to what fits; lp is
     the legend's type px before the text scale, lw its width. Unfocused, a legend keeps dv.pri. */
  const fitsBomb = (r, w) => r.w >= w + dv.bombs + 14;
  const leg = (r, s) => {
    const w = W(c, tf, s);
    if (fitsBomb(r, w)) return {w, lp: dv.pri, lw: w, fit: true};
    const p1 = dv.pri / G.ts, w1 = W(c, T.label(p1), s);
    if (G.ts > 1 && fitsBomb(r, w1)) return {w, lp: p1, lw: w1, fit: true};
    if (G.dev === "p") { const k = Math.max(0.5, (r.w - dv.bombs - 14) / w1), w2 = W(c, T.label(p1 * k), s); return {w, lp: p1 * k, lw: w2, fit: fitsBomb(r, w2)}; }
    return {w, lp: dv.pri, lw: w, fit: false};
  };
  out.tabs = RECORD_TABS.map((s, i) => { const L = leg(d.tabs[i], s); return {s, w: L.w, lp: L.lp, lw: L.lw, r: d.tabs[i], bomb: L.fit}; });
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
    out.scores = {h, bank: DIFF.slice(), bleg: d.bodies.scores.keys.map((r, i) => leg(r, DIFF[i])), badges, bf, label: badges.length && badges[0].x > 0, table: list.length ? tablePlan(c, G, b, list, ts) : null, n: Math.min(10, list.length),
      empty: list.length ? null : [fit(c, T.label(dv.pri), [noRunsYet(h), ST.NO_BEST], b.rows.w / b.k), fit(c, T.body(dv.bod), [pickToSet(h), ""], b.rows.w / b.k)]};
  }
  if (ui.page === "stats") out.stats = statsPlan(c, G, ui);
  if (ui.page === "medals") {
    const b = d.bodies.medals, rows = Array.isArray(ui.rows) ? ui.rows : [], nf = T.label(dv.pri), df = T.label(dv.sec), gl = Math.round(dv.pri * 1.4);
    const tiles = Array.from({length: 8}, (_, i) => {
      const [name, desc, on] = rows[i] || [RW.NONE, "", false], r = b.tiles[i], room = r.w / b.k - 2 * b.pad - gl - 12;
      return {name: String(name), on: !!on, desc: wrap(c, df, String(desc), room, b.lines) || wrap(c, df, String(desc), room, b.lines + 1) || [String(desc)], gl};
    });
    out.medals = {tiles, n: tiles.filter((t) => t.on).length, nf, df};
  }
  /* a paged body (fix round 1b): the page shown (ui.spage, clamped), PAGE n OF m and which of ▲ / ▼ has a page to open */
  const bp = d.bodies[ui.page];
  const n0 = bp && bp.pager ? (ui.page === "scores" ? scoresPages(bp, out.scores.n) : bp.pages) : 1; // SCORES: the rows drawn, never a header-only page
  if (n0 > 1) { const n = n0, p = Math.max(0, Math.min(n - 1, ui.spage | 0)); out.pg = {page: p, n, s: pageLabel(p, n), upOn: p > 0, dnOn: p < n - 1}; }
  return out;
}

/* ---------- painters ---------- */
/* the page's own icons on the appendix 4.1 16-unit grid (medal, lock, back, the four arrow legends) */
function ic(c, n, x, y, s, col) {
  c.save(); c.translate(x, y); c.scale(s / 16, s / 16);
  c.strokeStyle = c.fillStyle = col; c.lineCap = c.lineJoin = "round"; c.beginPath();
  if (n === "medal") { c.lineWidth = 2.6; c.moveTo(5, 1); c.lineTo(11, 1); c.lineTo(15, 5); c.lineTo(15, 11); c.lineTo(11, 15); c.lineTo(5, 15); c.lineTo(1, 11); c.lineTo(1, 5); c.closePath(); c.stroke(); }
  else if (n === "dot") { c.lineWidth = 2.2; c.arc(8, 8, 2.6, 0, Math.PI * 2); c.stroke(); }
  else if (n === "lock") { c.lineWidth = 2; c.moveTo(4.5, 7); c.lineTo(4.5, 5); c.arc(8, 5, 3.5, Math.PI, 0); c.lineTo(11.5, 7); c.stroke(); c.beginPath(); c.rect(3, 7, 10, 7.5); c.fill(); }
  else if (n === "back") { c.lineWidth = 2.6; c.moveTo(10, 3); c.lineTo(5, 8); c.lineTo(10, 13); c.stroke(); }
  else if (n === "flag") { c.lineWidth = 1.8; c.moveTo(4, 15); c.lineTo(4, 2); c.moveTo(4, 2.5); c.lineTo(12, 2.5); c.lineTo(10, 5.5); c.lineTo(12, 8.5); c.lineTo(4, 8.5); c.stroke(); }
  else if (n === "clock") { c.lineWidth = 2; c.arc(8, 8, 6, 0, Math.PI * 2); c.moveTo(8, 4.5); c.lineTo(8, 8); c.lineTo(10.5, 9.5); c.stroke(); }
  else if (n === "cal") { c.lineWidth = 2; c.rect(2, 3, 12, 11); c.moveTo(2, 7); c.lineTo(14, 7); c.moveTo(5, 1.5); c.lineTo(5, 4.5); c.moveTo(11, 1.5); c.lineTo(11, 4.5); c.stroke(); }
  else if (n === "warn") { c.lineWidth = 2; c.moveTo(8, 1.5); c.lineTo(15, 14); c.lineTo(1, 14); c.closePath(); c.moveTo(8, 6); c.lineTo(8, 9.5); c.moveTo(8, 11.5); c.lineTo(8, 12); c.stroke(); }
  else if (n === "reset") { c.lineWidth = 2.2; c.arc(8, 8, 4.5, Math.PI, Math.PI * 2.85, false); c.moveTo(6.5, 1); c.lineTo(4, 3.5); c.lineTo(6.5, 6); c.stroke(); }
  else if (n === "check") { c.lineWidth = 2.6; c.moveTo(2.5, 8.5); c.lineTo(6, 12); c.lineTo(13.5, 4); c.stroke(); }
  else { const P = {up: [3, 11, 8, 5, 13, 11], dn: [3, 5, 8, 11, 13, 5], lf: [11, 3, 5, 8, 11, 13], rt: [5, 3, 11, 8, 5, 13]}[n]; if (P) { c.moveTo(P[0], P[1]); c.lineTo(P[2], P[3]); c.lineTo(P[4], P[5]); c.closePath(); c.fill(); } }
  c.restore();
}
/* earned: the medal outline and its centre ring in the medal colour, both strokes (appendix: the medal is an outline, never a #ffd447 fill); a goal
   not yet earned: the outline in t2 with a small lock inside */
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
/* a tag (appendix 4): the dark chip, its 2 px outline stroked in its colour, a glyph, the word (an earned badge's word in ink: the medal colour is
   only ever an outline) */
function tag(c, x, y, w, h, s, f, col, glyph, on) {
  rf(c, x, y, w, h, 4, CONST.ol);
  c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); sp(c, x + 1, y + 1, w - 2, h - 2, 3.5); c.stroke();
  if (glyph === "medal") medalGlyph(c, x + 8, y + h / 2 - 8, 16, on); else ic(c, "lock", x + 8, y + h / 2 - 8, 16, col);
  text(c, s, x + 8 + 16 + 6, y + h / 2, f, on ? CONST.ink : col);
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
  if (ui.page === "stats") { statsStatic(c, G, P, ui, tok); if (ui.arm) confirmStatic(c, G, P, tok); }
}
const dspText = (c, s, x, y, px) => dspCol(c, s, x, y, px, CONST.ink);
function scoresStatic(c, G, P, tok) {
  const b = G.d.bodies.scores, S = P.scores, dv = DEV[G.dev], k = b.k, ph = G.dev === "p", kr = b.kick, br = b.bank;
  if (bankOn(b, P)) { // a split's later pages: the kicker is live (it names the difficulty), no bank
    text(c, LABEL.DIFFICULTY, kr.x, kr.y + kr.h / 2, T.label(dv.sec), CONST.t2);
    rf(c, br.x, br.y, br.w, br.h, 8, CONST.ol);
    b.keys.forEach((r, i) => key(c, r.x, r.y, r.w, r.h, "well", {tok, label: S.bank[i], phone: ph}));
  }
  if (!b.badges || !badgeOn(b, P)) return;
  c.save(); c.translate(b.x, b.y); c.scale(k, k); c.translate(-b.x, -b.y);
  const gr = R(b.x + (b.badges.x - b.x) / k, b.y + (b.badges.y - b.y) / k, b.badges.w / k, b.badges.h / k);
  const th = (gr.h - (b.bl - 1) * 6) / b.bl;
  if (S.label) text(c, RW.BADGES, gr.x, gr.y + th / 2, S.bf, CONST.t2);
  for (const t of S.badges) tag(c, gr.x + t.x, gr.y + t.ln * (th + 6), t.w, th, t.s, S.bf, t.on ? CONST.medal : CONST.off, t.on ? "medal" : "lock", t.on);
  c.restore();
}
/* a lit key with the focus (bare bomb + ring) or none (tap mode shows no focus, as LEVEL SELECT); the bomb is never dropped: a legend that does not fit
   beside it (fits false) moves to the key's right end */
export const legX = (r, lw, dv, focused, fits) => (focused && !fits ? r.x + r.w - 6 - lw / 2 : r.x + (r.w + (focused ? dv.bombs + 6 : 0)) / 2);
function focusKey(c, r, label, L, focused, tok, dv, ph) {
  if (!focused || (L.fit && L.lp === dv.pri)) return key(c, r.x, r.y, r.w, r.h, "lit", {tok, label, phone: ph, ring: focused, bomb: focused});
  key(c, r.x, r.y, r.w, r.h, "lit", {tok, label: null, phone: ph, ring: true, bomb: true});
  text(c, label, legX(r, L.lw, dv, true, L.fit), r.y - 2 + r.h / 2, T.label(L.lp), tok.dk, "center");
}
/* the page keys' strip (any paged tab): PAGE n OF m, then ▲ and ▼ (a key with no page to open is a well); live, so a page step repaints no layer */
const paintPager = (c, Q, Qp, tok, dv) => kitPager(c, Q, Qp.page, Qp.n, tok, {f: T.label(dv.sec), phone: true});
function scoresLive(c, G, P, ui, tok, foc) {
  const b = G.d.bodies.scores, S = P.scores, dv = DEV[G.dev], k = b.k, ph = G.dev === "p", r = b.keys[S.h];
  if (!bankOn(b, P)) text(c, diffTag(S.h), b.kick.x, b.kick.y + b.kick.h / 2, T.label(dv.sec), CONST.t2);
  else focusKey(c, r, S.bank[S.h], S.bleg[S.h], foc, tok, dv, ph);
  c.save(); c.translate(b.x, b.y); c.scale(k, k); c.translate(-b.x, -b.y);
  const rr = R(b.x, b.y + (b.rows.y - b.y) / k, b.rows.w / k, b.rows.h / k), rp = b.rp;
  const pg = tpage(b, P), i0 = pg * b.per, i1 = Math.min(S.n, i0 + b.per); // a paged table draws its page's rows (split: none on the badges' page)
  if (pg < 0) {}
  else if (S.empty) {
    if (!pg) text(c, S.empty[0], rr.x + rr.w / 2, rr.y + rp * emptyY(b.per, 0), T.label(dv.pri), CONST.ink, "center");
    if (!pg && S.empty[1]) text(c, S.empty[1], rr.x + rr.w / 2, rr.y + rp * emptyY(b.per, 1), T.body(dv.bod), CONST.t2, "center");
  } else if (S.table) {
    const tp = S.table, hr = R(b.x, b.y + (b.head.y - b.y) / k, b.head.w / k, b.head.h / k);
    for (const col of tp.cols) text(c, col.n, col.right ? hr.x + col.x + col.w : hr.x + col.x, hr.y + hr.h / 2, tp.fS, CONST.t2, col.right ? "right" : "left");
    c.fillStyle = CONST.ol; c.fillRect(hr.x, hr.y + hr.h - 2, hr.w, 2);
    for (let i = i0; i < i1; i++) {
      const y = rr.y + rp * (i - i0 + 0.5);
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
    if (b.tp && b.tp[i] !== (P.pg ? P.pg.page : 0)) return; // a paged MEDALS draws its page's tiles
    const r = L(b.tiles[i]), x0 = r.x + b.pad, gl = t.gl, tx = x0 + gl + 12, ny = r.y + b.pad + dv.pri * G.ts * 0.575;
    key(c, r.x, r.y, r.w, r.h, "well", {tok});
    medalGlyph(c, x0, r.y + b.pad + 2, gl, t.on);
    text(c, t.name, tx, ny, M.nf, t.on ? CONST.ink : CONST.t2);
    t.desc.forEach((l, j) => text(c, l, tx, ny + dv.pri * G.ts * 0.575 + 4 + dv.sec * G.ts * 1.2 * (j + 0.5), M.df, CONST.t2));
  });
  c.restore();
}

/* ---------- STATS (Task 4.2) ---------- */
const hm = (secs) => { const s = Math.max(0, Math.floor(+secs || 0)); return Math.floor(s / 3600) + "h" + String(Math.floor(s / 60) % 60).padStart(2, "0") + "m"; }; // units unspaced
const qualCands = (h) => { const mods = modsCount(h.pact) || RW.NO_MODS, d = diffTag(h.heat), sp = speedTag(h.pace); return [[d + " · " + mods + " · " + sp], [d + " · " + sp, mods], [d, mods + " · " + sp], [d, mods]]; };
function statsPlan(c, G, ui) {
  const d = G.d, b = d.bodies.stats, dv = DEV[G.dev], ts = G.ts, v = ui.view || {}, h = v.hero || null, k = b.k, room = b.qual.w / k;
  const pf = T.label(dv.pri), sf = T.label(dv.sec);
  const qual = h ? qualCands(h).find((ls) => ls.every((l) => W(c, pf, l) <= room)) || [diffTag(h.heat)] : null;
  const life = [[ST.CLEARED, v.rooms, "flag"], [ST.KILLS, v.kills, "foe"], [ST.PICKS, v.picks, "fire"], [ST.DEATHS, v.deaths, "heart"], [ST.DAYS, v.days, "cal"]].map(([l, n, g]) => ({l, n: sep3(n | 0), g}));
  const bests = [0, 1, 2].map((i) => { const e = (v.bests || [])[i] || null; return {l: diffTag(i), sub: e ? LABEL.LEVEL + " " + e.r : "", n: e ? sep3(e.s) : RW.NONE, s: e ? e.s : -1}; });
  const top = Math.max(...bests.map((q) => q.s)), notes = [];
  if (b.notes) for (const n of ui.notes || []) { const ls = wrap(c, sf, String(n), b.notes.w / k, 3) || []; for (const l of ls) if (notes.length < 3) notes.push(l); }
  const conf = d.confirm, fk = conf.fk, cf = T.body(dv.bod * fk), sentence = resetSentence(ui.wipe ? ui.wipe[0] : null, ui.wipe ? ui.wipe[1] : null) || RESET_DEFAULT;
  const titleF = T.display(dv.ttl * 0.72 * fk), tl = wrap(c, titleF, ST.TITLE, conf.title.w - 34, conf.tl) || [ST.TITLE];
  const bk2 = bestKick(), bk = bk2.join(" · "), bestK = W(c, sf, bk) <= b.bestK.w / k ? [bk] : bk2;
  const spage = b.pg ? Math.max(0, Math.min(b.pages - 1, ui.spage | 0)) : 0, on = (q) => { const v = b.pg ? b.pg[q] ?? b.pg[secOf(q)] : null; return v == null || v === spage; }; // a part, or its section where the body pages by sections
  return {spage, on, bestK, hero: h, qual, digits: h ? [...sep3(h.s)] : [], far: h && v.far >= 1 ? v.far | 0 : 0, reached: h && v.far >= 1 ? ST.FURTHEST + " " + (v.far | 0) + " · " + biomeOf(v.far | 0).name : "", life, bests, top, notes,
    tiles: [[ST.RUNS, sep3(v.runs | 0), "bomb"], [ST.PLAY_TIME, hm(v.secs), "clock"], [ST.MEDALS, (v.medals | 0) + "/8", "medal"]],
    confirm: {title: tl, body: wrap(c, cf, sentence, conf.body.w, conf.bl) || [sentence], sentence, tf: titleF}};
}
const FOE0 = {type: "walker", color: "#9ce35b", r: 14, home: {x: 3, y: 7}, invuln: false, dir: {x: 0, y: 1}}, REST0 = {time: 0};
function glyphAt(c, g, x, y, s, on) {
  if (g === "foe") { const f = FOES[0]; c.save(); c.translate(x + s / 2, y + s / 2 + s * 0.04); c.scale(s / 34, s / 34); drawEnemyBody(c, REST0, {...FOE0, type: f.t, color: f.col}); c.restore(); return; }
  if (g === "fire" || g === "heart") { const p = POWER.find((q) => q.t === g) || POWER[0]; c.save(); c.translate(x + s / 2, y + s / 2); c.scale(s / 26, s / 26); drawIcon(c, p.t, p.col, 0); c.restore(); return; }
  if (g === "bomb") return focusBomb(c, x, y + s / 2, s);
  if (g === "medal") return medalGlyph(c, x, y, s, on);
  ic(c, g, x, y, s, CONST.t2);
}
function statsStatic(c, G, P, ui, tok) {
  const b = G.d.bodies.stats, S = P.stats, dv = DEV[G.dev], k = b.k, ts = G.ts, ph = G.dev === "p";
  c.save(); c.translate(b.x, b.y); c.scale(k, k); c.translate(-b.x, -b.y);
  const L = (r) => R(b.x + (r.x - b.x) / k, b.y + (r.y - b.y) / k, r.w / k, r.h / k), sf = T.label(dv.sec), pf = T.label(dv.pri);
  const kr = L(b.kick);
  if (S.on("kick")) text(c, ST.BEST_SCORE, kr.x, kr.y + kr.h / 2, sf, CONST.t2);
  const qr = L(b.qual);
  if (!S.hero) { if (S.on("qual")) text(c, ST.NO_BEST, qr.x, qr.y + dv.pri * ts * 0.6, pf, CONST.t2); }
  else {
    if (S.on("qual")) S.qual.forEach((l, i) => text(c, l, qr.x, qr.y + dv.pri * ts * (0.6 + 1.2 * i), pf, CONST.ink));
    const dr = L(b.digits);
    let x = dr.x;
    if (S.on("digits")) for (const ch of S.digits) {
      const w = ch === "," ? Math.round(dv.sdw * 0.6) : dv.sdw;
      key(c, x, dr.y + 2, w, dv.sdh, ch === "," ? "well" : "lit", {tok, label: ch, px: dv.sdf, phone: ph});
      x += w + 4;
    }
    const cr = b.course && S.far && S.on("course") && L(b.course); // the course shows the furthest level only (no run is implied by the score above it)
    if (cr) for (let r = 1; r <= 8; r++) {
      const x0 = cr.x + (r - 1) * (dv.lcw + 5), kind = r < S.far ? "lit" : r === S.far ? "key" : r > 5 && !ui.unlocked ? "wall" : "well";
      key(c, x0, cr.y + 2, dv.lcw, dv.lch, kind, {tok, label: kind === "wall" ? null : String(r), px: dv.pri, phone: ph});
      if (kind === "wall") ic(c, "lock", x0 + dv.lcw / 2 - 7, cr.y + 2 + dv.lch / 2 - 7, 14, CONST.off);
      if (r === 5 || r === 8) ic(c, "flag", x0 + dv.lcw - 13, cr.y + 4, 10, kind === "lit" ? CONST.dk : CONST.t2);
    }
    const rr = L(b.reached);
    if (S.reached && S.on("reached")) text(c, S.reached, rr.x, rr.y + rr.h / 2, sf, CONST.t2);
  }
  if (S.on("tiles")) S.tiles.forEach(([name, val, g], i) => {
    const r = L(b.tiles[i]);
    key(c, r.x, r.y, r.w, r.h, "well", {tok});
    const q = b.tl;
    glyphAt(c, g, r.x + q.pad - 2, r.y + q.top, q.gs, (ui.view && ui.view.medals) > 0);
    nums(c, val, r.x + q.pad, r.y + q.top + q.gs + q.gg + dv.hud * ts / 2, dv.hud, {col: CONST.ink});
    text(c, name, r.x + q.pad, r.y + r.h - 8 - dv.sec * ts * 0.6, sf, CONST.t2);
  });
  const lk = L(b.lifeK);
  if (S.on("lifeK")) text(c, ST.LIFETIME, lk.x, lk.y + lk.h / 2, sf, CONST.t2);
  S.life.forEach((q, i) => { if (S.on("life" + i)) ledger(c, L(b.life[i]), q.g, q.l, "", q.n, dv, ts, false); });
  const bk = L(b.bestK);
  if (S.on("bestK")) S.bestK.forEach((l, i) => text(c, l, bk.x, bk.y + dv.sec * ts * (0.6 + 1.2 * i), sf, CONST.t2));
  S.bests.forEach((q, i) => { if (S.on("best" + i)) ledger(c, L(b.best[i]), {pip: i + 1, lit: q.s >= 0 && q.s === S.top}, q.l, q.sub, q.n, dv, ts, !b.one, tok); });
  if (b.div) wallCourse(c, L(b.div), tok);
  if (b.notes) S.notes.forEach((l, i) => text(c, l, L(b.notes).x, L(b.notes).y + dv.sec * ts * (0.6 + 1.2 * i), sf, CONST.t2));
  c.restore();
  const a = b.acts;
  if (a && S.on("acts")) {
    key(c, a.copy.x, a.copy.y, a.copy.w, a.copy.h, "key", {tok, label: ST.COPY_SHORT, phone: true});
    key(c, a.reset.x, a.reset.y, a.reset.w, a.reset.h, "key", {tok});
    const lw = W(mOf(c), pf, ST.RESET), x0 = a.reset.x + a.reset.w / 2 - (lw + 26) / 2;
    ic(c, "reset", x0, a.reset.y + a.reset.h / 2 - 9, 18, CONST.cor);
    text(c, ST.RESET, x0 + 26, a.reset.y + a.reset.h / 2, pf, CONST.t2);
  }
}
/* a ledger line: glyph cell (28; a difficulty pip: a 24 px well holding its rank, the best one the world's brick), the label (and its sub: beside it, or
   under it on a two-line line), a leader of floor-tile dots, the number right-aligned */
function ledger(c, r, g, label, sub, num, dv, ts, two, tok) {
  const gw = 28, cy = two ? r.y + 4 + dv.pri * ts * 0.575 : r.y + r.h / 2, pf = T.label(dv.pri), sf = T.label(dv.sec), mc = mOf(c);
  if (typeof g === "object") {
    const s = 24, x = r.x + 2, y = cy - s / 2;
    rf(c, x, y, s, s, 4, CONST.ol);
    if (g.lit) { c.fillStyle = tok.lit2; c.fillRect(x + 2, y + 2, s - 4, s - 4); c.fillStyle = tok.lit; c.fillRect(x + 2, y + 2, s - 4, (s - 4) * 0.54); }
    else { c.fillStyle = tok.well; c.fillRect(x + 2, y + 2, s - 4, s - 4); }
    text(c, String(g.pip), x + s / 2, y + s / 2, sf, g.lit ? CONST.dk : CONST.t2, "center");
  } else glyphAt(c, g, r.x + 2, cy - 11, 22, false);
  const lx = r.x + gw + 12;
  text(c, label, lx, cy, pf, CONST.ink);
  const lw = W(mc, pf, label), nw = nW(mc, T.num(dv.pri), num);
  if (sub && !two && lx + lw + 10 + W(mc, sf, sub) + 12 > r.x + r.w - nw - 12) sub = ""; // one line: the level steps out before it would touch the score
  if (sub) two ? text(c, sub, lx, cy + dv.pri * ts * 0.575 + 4 + dv.sec * ts * 0.6, sf, CONST.t2) : text(c, sub, lx + lw + 10, cy, sf, CONST.t2);
  const d0 = lx + lw + (sub && !two ? W(mc, sf, sub) + 10 : 0) + 12, d1 = r.x + r.w - nw - 12;
  c.fillStyle = "#5a5047";
  for (let x = d0; x + 3 <= d1; x += 8) c.fillRect(x, cy + 2, 3, 3);
  nums(c, num, r.x + r.w, cy, dv.pri, {col: CONST.ink, align: "right"});
}
/* a wall course (appendix 7.1 divider), stood up: a dark groove, a band-light lip, square studs every 32 px */
function wallCourse(c, r, tok) {
  c.fillStyle = CONST.ol; c.fillRect(r.x, r.y, 2, r.h);
  c.fillStyle = tok.band; c.fillRect(r.x + 2, r.y, 1, r.h);
  c.fillStyle = CONST.ol;
  for (let y = r.y + 14; y + 3 <= r.y + r.h; y += 32) c.fillRect(r.x - 1, y, 5, 3);
}
/* the armed reset: the page dimmed under the confirm plate (static, in the armed page's layer), the AGAIN ERASES key live */
function confirmStatic(c, G, P, tok) {
  const d = G.d, f = d.confirm, S = P.stats.confirm, dv = DEV[G.dev], ph = G.dev === "p", ts = G.ts;
  c.fillStyle = "rgba(4,3,6,0.8)"; c.fillRect(d.pane.x + 2, d.pane.y + 2, d.pane.w - 4, d.pane.h - 4);
  plate(c, f.box.x, f.box.y, f.box.w, f.box.h, tok, {phone: ph, T: ph ? 6 : 8});
  const fk = f.fk, tp = dv.ttl * 0.72 * fk;
  ic(c, "warn", f.title.x, f.title.y + tp * ts * 0.55 - 11, 22, CONST.cor);
  S.title.forEach((l, i) => dspCol(c, l, f.title.x + 34, f.title.y + tp * ts * (0.55 + 1.1 * i), tp, CONST.cor));
  S.body.forEach((l, i) => text(c, l, f.body.x, f.body.y + dv.bod * fk * ts * (0.75 + 1.5 * i), T.body(dv.bod * fk), CONST.ink));
  const cp = f.copy;
  key(c, cp.x, cp.y, cp.w, cp.h, "key", {tok, label: ph ? ST.COPY_SHORT : ST.COPY, phone: ph});
  if (!ph && canCap(c)) { const w = capW(c, "C"); cap(c, cp.x + cp.w - w - 12, cp.y + cp.h / 2 - DEV.d.caph / 2, "C", {tok}); }
  if (f.cancel) text(c, ST.TAP_CANCEL, f.cancel.x, f.cancel.y + f.cancel.h / 2, T.label(dv.sec * fk), CONST.t2);
}
function confirmLive(c, G, tok) {
  const f = G.d.confirm, r = f.again, dv = DEV[G.dev], ph = G.dev === "p";
  /* round 7: the focused danger key takes the focus band as its face, its label cream; the coral edge, the warn title and R carry the danger */
  rf(c, r.x, r.y + 4, r.w, r.h, 6, CONST.ol); rf(c, r.x, r.y, r.w, r.h, 6, CONST.ol); rf(c, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 4, CONST.cor); rf(c, r.x + 4, r.y + 4, r.w - 8, r.h - 8, 3, tok.band);
  focusBomb(c, r.x + 8, r.y + r.h / 2, dv.bombs);
  const capOn = !ph && canCap(c), cw = capOn ? capW(c, "R") : 0;
  text(c, ST.AGAIN, r.x + (r.w + dv.bombs + 6 - cw - (capOn ? 12 : 0)) / 2, r.y + r.h / 2, T.label(dv.pri), CONST.ink, "center");
  if (capOn) cap(c, r.x + r.w - cw - 12, r.y + r.h / 2 - DEV.d.caph / 2, "R", {tok});
  c.strokeStyle = CONST.ink; c.lineWidth = 3; c.beginPath(); sp(c, r.x - 4.5, r.y - 4.5, r.w + 9, r.h + 9, 10.5); c.stroke();
}
/* COPIED / COPY FAILED (main's one endkeys toast): a tag at the header's right end, a lit brick with a check, or coral with the warn glyph */
export function toastRect(G, c, s) {
  const d = G.d, dv = DEV[G.dev], w = 8 + 16 + 8 + W(mOf(c), T.label(dv.sec), s) + 12, h = dv.tg + 6, row = d.title || d.back;
  return R(d.plate.x + d.plate.w - 24 - w, row.y + row.h / 2 - h / 2, w, h);
}
function toastTag(c, G, toast, tok) {
  const r = toastRect(G, c, toast.s), dv = DEV[G.dev], ok = !!toast.ok;
  c.save(); c.scale(G.u, G.u);
  key(c, r.x, r.y, r.w, r.h, ok ? "lit" : "key", {tok});
  ic(c, ok ? "check" : "warn", r.x + 8, r.y + r.h / 2 - 8 - (ok ? 2 : 0), 16, ok ? CONST.dk : CONST.cor);
  text(c, toast.s, r.x + 32, r.y + r.h / 2 - (ok ? 2 : 0), T.label(dv.sec), ok ? CONST.dk : CONST.cor);
  c.restore();
}
function dspCol(c, s, x, y, px, col) {
  const font = T.display(px), em = px * textScale();
  c.font = font; c.textAlign = "left"; c.textBaseline = "middle"; c.lineJoin = "round"; c.lineWidth = em * 0.12; c.strokeStyle = CONST.ol; c.fillStyle = CONST.ol;
  c.strokeText(s, x, y + em * 0.08); c.fillText(s, x, y + em * 0.08); c.strokeText(s, x, y);
  c.fillStyle = col; c.fillText(s, x, y);
}

/* ---------- the foot (desk): label first, keycap last ---------- */
export function footItems(page, foc, words, tap = false) {
  const pad = words.dev === "pad", A = (n) => [n];
  if (tap) return [{t: page === "stats" && foc === "arm" ? ST.TAP_CANCEL : RW.TAP}]; // the touch-desk form in tap mode: the tap model, no keycaps
  if (page === "stats") {
    if (foc === "arm") return [{t: ST.ERASE, caps: ["R"]}, {t: ST.COPY_ARMED, caps: ["C"], key: "KeyC"}, {t: ST.CANCEL, caps: []}];
    if (pad) return [{t: ST.COPY, caps: [RW.WEST], key: "KeyC"}, {t: ST.MEDALS_T, caps: [RW.NORTH], key: "KeyT"}, {t: RW.TAB, caps: [words.move]}, {t: RW.BACK, caps: [words.back], key: "back"}];
    return [{t: ST.COPY, caps: ["C"], key: "KeyC"}, {t: ST.RESET, caps: ["R"], key: "KeyR"}, {t: RW.TAB, caps: foc === "body" ? ["Q", "E"] : [A("lf"), A("rt")]}, {t: RW.BACK, caps: [words.back], key: "back"}];
  }
  if (pad) return page === "scores" && foc === "body" ? [{t: LABEL.DIFFICULTY, caps: [words.move]}, {t: RW.BACK, caps: [words.back], key: "back"}] : [{t: RW.TAB, caps: [words.move]}, {t: RW.BACK, caps: [words.back], key: "back"}];
  if (page === "scores") return foc === "body" ? [{t: LABEL.DIFFICULTY, caps: [A("lf"), A("rt")]}, {t: RW.TAB, caps: ["Q", "E"]}, {t: RW.BACK, caps: [words.back], key: "back"}]
    : [{t: RW.TAB, caps: [A("lf"), A("rt")]}, {t: LABEL.DIFFICULTY, caps: [A("dn")]}, {t: RW.BACK, caps: [words.back], key: "back"}];
  return [{t: RW.TAB, caps: [A("lf"), A("rt")]}, {t: RW.BACK, caps: [words.back], key: "back"}];
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
  /* each item's tap zone: from its label to its last keycap (STATS' foot labels are keys) */
  const zones = [];
  let it = -1;
  for (const p of parts) { if (p.sep) continue; if (p.t != null) { it++; zones.push({x0: p.x, x1: p.x + p.w, key: items[it].key || null}); } else zones[zones.length - 1].x1 = p.x + p.w; }
  return {x, y: d.foot.y, w: fw, h: FOOT_H, f, px: dv.sec, parts, zones, mid: d.foot.y + FOOT_H / 2};
}
function paintFoot(c, P, tok) {
  plaque(c, P.x, P.y, P.w, P.h, tok);
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
function record(G, P, ui, foc, dpr, el, F0, tok, touchy, tap) {
  const u = G.u, d = G.d, dv = DEV[G.dev], ts = G.ts, b = (r) => [r.x * u, r.y * u, r.w * u, r.h * u], page = ui.page, pi = PAGES.indexOf(page);
  probe.begin("records." + page, {w: G.W, h: G.H, dpr, el});
  probe.rect("plate", ...b(d.plate), {plate: G.T});
  const txt = (s, x, y, w, px, col, role, o = {}) => { if (s && w > 0) probe.text(s, x * u, (y - px * ts * CAP_K / 2) * u, w * u, px * ts * CAP_K * u, {role, col, px: px * ts * u, ...o}); };
  if (d.back) { probe.rect(RW.BACK, ...b(d.back), {touch: touchy, set: "head", fill: tok.key}); const gx = d.back.x + (d.back.w > 60 ? 14 : (d.back.w - 16) / 2); if (d.back.w > 60) txt(RW.BACK, d.back.x + 40, d.back.y + d.back.h / 2, measureOr(RW.BACK, dv.pri), dv.pri, CONST.ink, "primary"); probe.pair("info", b(R(gx, d.back.y + d.back.h / 2 - 8, 16, 16)), b(R(gx - 6, d.back.y + 8, 28, d.back.h - 16)), {col: CONST.ink, name: "back chevron"}); }
  if (d.kick) txt(RW.MENU, d.kick.x, d.kick.y + d.kick.h / 2, measureOr(RW.MENU, dv.sec), dv.sec, CONST.t2, "secondary");
  if (d.title) txt(P.title.s, d.title.x, d.title.y + d.title.h / 2, measureOr(P.title.s, P.title.px, true), P.title.px, CONST.ink, "primary");
  P.tabs.forEach((t, i) => {
    const on = i === pi, r = on ? R(t.r.x, t.r.y - 2, t.r.w, t.r.h) : t.r;
    const fo = on && foc === "tabs" && !tap;
    probe.rect("tab " + t.s, ...b(r), {touch: touchy, set: "tabs", kind: "tab", focus: fo, fill: on ? tok.lit : tok.well});
    const lw = fo ? t.lw : t.w;
    txt(t.s, legX(r, lw, dv, fo, t.bomb) - lw / 2, r.y + r.h / 2, lw, fo ? t.lp : dv.pri, on ? CONST.dk : CONST.t2, "primary");
  });
  const on = P.tabs[pi].r, off = P.tabs[pi === 0 ? 1 : 0].r;
  /* a squint pair samples the face beside the legend (the right end of each key), so a bigger legend at 125 % never stands in for the face */
  const face = (r, lift) => R(r.x + r.w - 26, r.y + 4 - lift, 20, r.h - 10);
  probe.pair("chosen", b(face(on, 2)), b(face(off, 0)), {name: "open tab vs not"});
  let fr = null;
  if (foc === "tabs" && !tap) fr = R(on.x, on.y - 2, on.w, on.h);
  if (page === "scores") {
    const B = d.bodies.scores, S = P.scores, k = B.k, tpg = tpage(B, P), tbl = !bankOn(B, P);
    if (!tbl) B.keys.forEach((r, i) => { const ch = i === S.h, rr = ch ? R(r.x, r.y - 2, r.w, r.h) : r; const fo = ch && foc === "body" && !tap; probe.rect("difficulty " + S.bank[i], ...b(rr), {touch: touchy, set: "filter", kind: "bank", focus: fo, fill: ch ? tok.lit : tok.well}); const Lg = S.bleg[i], lw = fo ? Lg.lw : measureOr(S.bank[i], dv.pri); txt(S.bank[i], legX(rr, lw, dv, fo, Lg.fit) - lw / 2, rr.y + rr.h / 2, lw, fo ? Lg.lp : dv.pri, ch ? CONST.dk : CONST.t2, "primary"); });
    const kc = B.keys[S.h], ko = B.keys[(S.h + 1) % 3], kick = tbl ? diffTag(S.h) : LABEL.DIFFICULTY;
    if (!tbl) probe.pair("chosen", b(R(kc.x + kc.w - 20, kc.y + 2, 14, kc.h - 10)), b(R(ko.x + ko.w - 20, ko.y + 4, 14, ko.h - 10)), {name: "chosen difficulty vs not"});
    if (foc === "body" && !tap && !tbl) fr = R(kc.x, kc.y - 2, kc.w, kc.h);
    txt(kick, B.kick.x, B.kick.y + B.kick.h / 2, measureOr(kick, dv.sec), dv.sec, CONST.t2, "secondary");
    const bdg = B.badges && badgeOn(B, P), th = bdg ? (B.badges.h - (B.bl - 1) * 6 * k) / B.bl : 0;
    if (bdg && S.label) txt(RW.BADGES, B.badges.x, B.badges.y + th / 2, measureOr(RW.BADGES, dv.sec) * k, dv.sec * k, CONST.t2, "secondary");
    if (bdg) for (const t of S.badges) {
      const x = B.badges.x + t.x * k, y = B.badges.y + t.ln * (th + 6 * k), col = t.on ? CONST.medal : CONST.off;
      txt(t.s, x + 30 * k, y + th / 2, measureOr(t.s, dv.sec) * k, dv.sec * k, t.on ? CONST.ink : col, "secondary", t.on ? {} : {lock: true});
      probe.pair("info", b(R(x + 7 * k, y + th / 2 - 9 * k, 18 * k, 18 * k)), b(R(x + 4 * k, y + 3 * k, 26 * k, th - 6 * k)), {col, name: "badge " + t.s, ...(t.on ? {} : {lock: true})}); // a: the 16 px glyph and its stroke's 1 px bleed; b: inside the tag's 2 px outline by 2 more, so a squint block never takes the outline (a #c's half-px offset)
    }
    const rr = B.rows, rp = B.rp * k;
    if (tpg < 0) {}
    else if (S.empty && !tpg) S.empty.forEach((s, j) => { if (!s) return; const w = (j ? W(MC, T.body(dv.bod), s) : measureOr(s, dv.pri)) * k; txt(s, rr.x + rr.w / 2 - w / 2, rr.y + rp * emptyY(B.per, j), w, (j ? dv.bod : dv.pri) * k, j ? CONST.t2 : CONST.ink, j ? "body" : "primary"); });
    else if (S.table) {
      const tp = S.table;
      for (const col of tp.cols) { const w = measureOr(col.n, dv.sec) * k, x = rr.x + (col.x + (col.right ? col.w : 0)) * k - (col.right ? w : 0); txt(col.n, x, B.head.y + B.head.h / 2, w, dv.sec * k, CONST.t2, "secondary"); }
      const i0 = tpg * B.per, i1 = Math.min(S.n, i0 + B.per);
      for (let i = i0; i < i1; i++) {
        for (const col of tp.cols) {
          const s = col.cells[i], px = col.f === tp.fP ? dv.pri : dv.sec, w = (col.num ? nWOr(s, px) : measureOr(s, px)) * k, x = rr.x + (col.x + (col.right ? col.w : 0)) * k - (col.right ? w : 0);
          txt(s, x, rr.y + (tp.stack ? rp * (i - i0) + rowY1(dv, ts) * k : rp * (i - i0 + 0.5)), w, px * k, col.n === RW.RANK || col.n === RW.DATE || s === RW.NONE ? CONST.t2 : CONST.ink, px === dv.pri ? "primary" : "secondary");
        }
        if (tp.stack) txt(tp.l2[i], rr.x + tp.l2x * k, rr.y + rp * (i - i0) + rowY2(dv, ts) * k, measureOr(tp.l2[i], dv.sec) * k, dv.sec * k, CONST.t2, "secondary");
      }
    }
  }
  if (page === "stats") {
    const B = d.bodies.stats, S = P.stats, k = B.k, sw = (s, px) => measureOr(s, px) * k;
    if (!ui.arm) { // armed, the page under the confirm plate is dimmed and inert: not read (the mock's data-ng)
    { // a paged body records only the parts on the page shown
    if (S.on("kick")) txt(ST.BEST_SCORE, B.kick.x, B.kick.y + B.kick.h / 2, sw(ST.BEST_SCORE, dv.sec), dv.sec * k, CONST.t2, "secondary");
    if (!S.hero) { if (S.on("qual")) txt(ST.NO_BEST, B.qual.x, B.qual.y + dv.pri * ts * 0.6 * k, sw(ST.NO_BEST, dv.pri), dv.pri * k, CONST.t2, "primary"); }
    else {
      if (S.on("qual")) S.qual.forEach((l, i) => txt(l, B.qual.x, B.qual.y + dv.pri * ts * (0.6 + 1.2 * i) * k, sw(l, dv.pri), dv.pri * k, CONST.ink, "primary"));
      let x = B.digits.x;
      const cells = [];
      if (S.on("digits")) for (const ch of S.digits) { const w = (ch === "," ? Math.round(dv.sdw * 0.6) : dv.sdw) * k; cells.push(R(x, B.digits.y + 2 * k - (ch === "," ? 0 : 2 * k), w, dv.sdh * k)); x += w + 4 * k; }
      cells.forEach((r, i) => { probe.rect("digit " + i, ...b(r), {fill: S.digits[i] === "," ? tok.well : tok.lit}); const w = measureOr(S.digits[i], dv.sdf) * k; txt(S.digits[i], r.x + r.w / 2 - w / 2, r.y + r.h / 2, w, dv.sdf * k, S.digits[i] === "," ? CONST.t2 : CONST.dk, "hud"); });
      const cell = (r) => R(B.course.x + (r - 1) * (dv.lcw + 5) * k, B.course.y + 2 * k, dv.lcw * k, dv.lch * k);
      const crs = B.course && S.far && S.on("course");
      if (crs) for (let r = 1; r <= 8; r++) probe.rect("level " + r + (r > S.far && r > 5 && !ui.unlocked ? " locked" : ""), ...b(cell(r)), {fill: r < S.far ? tok.lit : r === S.far ? tok.key : tok.well});
      /* a locked level (a wall cell, 6-8 before the first CLEAR) against the first level (lit or the raised key); its texture against a flat floor: the
         PLAY TIME tile's empty top right (fix round 1: the filled STATS capture draws locked cells) */
      const lk = crs && S.on("tiles") ? [6, 7, 8].find((r) => r > S.far && !ui.unlocked) : null;
      if (lk) { const t1 = B.tiles[1]; probe.pair("locked", b(cell(lk)), b(cell(1)), {name: "locked level " + lk, floor: b(R(t1.x + t1.w - 24 * k, t1.y + 6 * k, 16 * k, 18 * k))}); }
      if (crs && S.far > 1 && S.far < 8) probe.pair("chosen", b(R(cell(1).x + 3 * k, cell(1).y + 2 * k, cell(1).w - 6 * k, 6 * k)), b(R(cell(8).x + 3 * k, cell(8).y + 6 * k, cell(8).w - 6 * k, 6 * k)), {name: "cleared vs ahead level"});
      if (S.reached && S.on("reached")) txt(S.reached, B.reached.x, B.reached.y + B.reached.h / 2, sw(S.reached, dv.sec), dv.sec * k, CONST.t2, "secondary");
    }
    }
    if (S.on("tiles")) S.tiles.forEach(([name, val, g], i) => {
      const r = B.tiles[i];
      probe.rect("tile " + name, ...b(r), {fill: tok.well});
      const q = B.tl;
      txt(val, r.x + q.pad * k, r.y + (q.top + q.gs + q.gg + dv.hud * ts / 2) * k, nWOr(val, dv.hud) * k, dv.hud * k, CONST.ink, "hud");
      txt(name, r.x + q.pad * k, r.y + r.h - (8 + dv.sec * ts * 0.6) * k, sw(name, dv.sec), dv.sec * k, CONST.t2, "secondary");
      probe.pair("info", b(R(r.x + (q.pad - 4) * k, r.y + (q.top - 2) * k, (q.gs + 4) * k, (q.gs + 4) * k)), b(R(r.x + (q.pad - 9) * k, r.y + (q.top - 7) * k, (q.gs + 14) * k, (q.gs + 14) * k)), {col: g === "medal" ? (S.tiles && (ui.view && ui.view.medals) > 0 ? CONST.medal : CONST.t2) : g === "clock" ? CONST.t2 : CONST.ink, name: "tile glyph " + name});
    });
    if (S.on("lifeK")) txt(ST.LIFETIME, B.lifeK.x, B.lifeK.y + B.lifeK.h / 2, sw(ST.LIFETIME, dv.sec), dv.sec * k, CONST.t2, "secondary");
    const line = (r, label, sub, num, two) => {
      const cy = two ? r.y + (4 + dv.pri * ts * 0.575) * k : r.y + r.h / 2, lx = r.x + 40 * k;
      if (sub && !two && lx + sw(label, dv.pri) + sw(sub, dv.sec) + 22 * k > r.x + r.w - (nWOr(num, dv.pri) + 12) * k) sub = "";
      txt(label, lx, cy, sw(label, dv.pri), dv.pri * k, CONST.ink, "primary");
      if (sub) txt(sub, two ? lx : lx + sw(label, dv.pri) + 10 * k, two ? cy + (dv.pri * ts * 0.575 + 4 + dv.sec * ts * 0.6) * k : cy, sw(sub, dv.sec), dv.sec * k, CONST.t2, "secondary");
      const w = nWOr(num, dv.pri) * k;
      txt(num, r.x + r.w - w, cy, w, dv.pri * k, num === RW.NONE ? CONST.t2 : CONST.ink, "primary");
    };
    S.life.forEach((q, i) => { if (S.on("life" + i)) line(B.life[i], q.l, "", q.n, false); });
    if (S.on("bestK")) S.bestK.forEach((l, i) => txt(l, B.bestK.x, B.bestK.y + dv.sec * ts * (0.6 + 1.2 * i) * k, sw(l, dv.sec), dv.sec * k, CONST.t2, "secondary"));
    S.bests.forEach((q, i) => { if (S.on("best" + i)) line(B.best[i], q.l, q.sub, q.n, !B.one); });

    if (B.notes) S.notes.forEach((l, i) => txt(l, B.notes.x, B.notes.y + dv.sec * ts * (0.6 + 1.2 * i) * k, sw(l, dv.sec), dv.sec * k, CONST.t2, "secondary"));
    const a = B.acts;
    if (a && S.on("acts")) { probe.rect(ST.COPY_SHORT, ...b(a.copy), {touch: touchy, set: "acts", fill: tok.key}); probe.rect(ST.RESET, ...b(a.reset), {touch: touchy, set: "acts", fill: tok.key}); txt(ST.COPY_SHORT, a.copy.x + a.copy.w / 2 - measureOr(ST.COPY_SHORT, dv.pri) / 2, a.copy.y + a.copy.h / 2, measureOr(ST.COPY_SHORT, dv.pri), dv.pri, CONST.ink, "primary"); const rw = measureOr(ST.RESET, dv.pri), rx = a.reset.x + a.reset.w / 2 - (rw + 26) / 2 + 26; txt(ST.RESET, rx, a.reset.y + a.reset.h / 2, rw, dv.pri, CONST.t2, "primary"); }
    }
    if (ui.arm) {
      const f = d.confirm, C = S.confirm, fk = f.fk, tpx = dv.ttl * 0.72 * fk;
      probe.rect("confirm", ...b(f.box), {plate: (G.dev === "p" ? 6 : 8) * u});
      const wy = f.title.y + tpx * ts * 0.55 - 11;
      probe.pair("info", b(R(f.title.x - 2, wy - 2, 26, 26)), b(R(f.title.x - 7, wy - 7, 32, 36)), {col: CONST.cor, name: "warn glyph"});
      C.title.forEach((l, i) => txt(l, f.title.x + 34, f.title.y + tpx * ts * (0.55 + 1.1 * i), W(MC, T.display(tpx), l), tpx, CONST.cor, "primary"));
      C.body.forEach((l, i) => { const w = W(MC, T.body(dv.bod * fk), l); txt(l, f.body.x, f.body.y + dv.bod * fk * ts * (0.75 + 1.5 * i), w, dv.bod * fk, CONST.ink, "body"); });
      probe.rect(ST.AGAIN, ...b(f.again), {touch: touchy, set: "confirm", focus: true, fill: tok.band});
      probe.rect(ST.COPY, ...b(f.copy), {touch: touchy, set: "confirm", fill: tok.key});
      fr = f.again;
      const capOn = G.dev !== "p", aw = measureOr(ST.AGAIN, dv.pri), cwR = capOn ? capW(MC, "R") : 0, ax = f.again.x + (f.again.w + dv.bombs + 6 - cwR - (capOn ? 12 : 0)) / 2 - aw / 2;
      txt(ST.AGAIN, ax, f.again.y + f.again.h / 2, aw, dv.pri, CONST.ink, "primary");
      const cl = G.dev === "p" ? ST.COPY_SHORT : ST.COPY, cwl = measureOr(cl, dv.pri);
      txt(cl, f.copy.x + f.copy.w / 2 - cwl / 2, f.copy.y + f.copy.h / 2, cwl, dv.pri, CONST.ink, "primary");
      if (f.cancel) txt(ST.TAP_CANCEL, f.cancel.x, f.cancel.y + f.cancel.h / 2, measureOr(ST.TAP_CANCEL, dv.sec * fk), dv.sec * fk, CONST.t2, "secondary");
    }
  }
  if (page === "medals") {
    const B = d.bodies.medals, M = P.medals, k = B.k;
    txt(M.n + "/8", B.count.x, B.count.y + B.count.h / 2, nWOr(M.n + "/8", dv.sec) * k, dv.sec * k, CONST.ink, "secondary");
    txt(RW.EARNED, B.count.x + nWOr(M.n + "/8", dv.sec) * k + 8 * k, B.count.y + B.count.h / 2, measureOr(RW.EARNED, dv.sec) * k, dv.sec * k, CONST.t2, "secondary");
    M.tiles.forEach((t, i) => {
      if (B.tp && B.tp[i] !== (P.pg ? P.pg.page : 0)) return;
      const r = B.tiles[i], x0 = r.x + B.pad * k, tx = x0 + (t.gl + 12) * k, ny = r.y + (B.pad + dv.pri * ts * 0.575) * k;
      probe.rect("medal " + t.name, ...b(r), {fill: tok.well});
      txt(t.name, tx, ny, measureOr(t.name, dv.pri) * k, dv.pri * k, t.on ? CONST.ink : CONST.t2, "primary");
      t.desc.forEach((l, j) => txt(l, tx, ny + (dv.pri * ts * 0.575 + 4 + dv.sec * ts * 1.2 * (j + 0.5)) * k, measureOr(l, dv.sec) * k, dv.sec * k, CONST.t2, "secondary"));
      probe.pair("info", b(R(x0 - 2 * k, r.y + B.pad * k, (t.gl + 4) * k, (t.gl + 4) * k)), b(R(x0 - 7 * k, r.y + (B.pad - 5) * k, (t.gl + 14) * k, (t.gl + 14) * k)), {col: t.on ? CONST.medal : CONST.t2, name: "medal glyph " + t.name, ...(t.on ? {} : {lock: true})}); // a goal not yet earned is the locked state (3:1)
    });
  }
  if (P.pg && !(page === "stats" && ui.arm)) { // the page keys (any paged tab): PAGE n OF m and ▲ / ▼, touch targets of one set
    const Q = d.bodies[page].pager, Qp = P.pg;
    txt(Qp.s, Q.label.x, Q.label.y + Q.label.h / 2, measureOr(Qp.s, dv.sec), dv.sec, CONST.t2, "secondary");
    for (const [nm, r, on] of [["PAGE UP", Q.up, Qp.upOn], ["PAGE DOWN", Q.dn, Qp.dnOn]]) {
      probe.rect(nm, ...b(r), {touch: touchy, set: page + " pages", kind: "step", fill: on ? tok.key : tok.well});
      probe.pair("info", b(R(r.x + r.w / 2 - 10, r.y + r.h / 2 - 10, 20, 20)), b(R(r.x + 6, r.y + 6, r.w - 12, r.h - 12)), {col: on ? CONST.ink : CONST.off, name: "page key " + nm, ...(on ? {} : {lock: true})});
    }
  }
  if (fr) {
    const rest = foc === "arm" ? d.confirm.copy : foc === "tabs" ? P.tabs[pi === 0 ? 1 : 0].r : d.bodies.scores.keys[(P.scores.h + 1) % 3];
    const z = foc === "arm" ? 6 : 0; // armed: the focused key's zone (the key and its ring) against COPY's same zone, as the round 7 probe measured it
    probe.pair("band", b(R(fr.x - z, fr.y - z, fr.w + 2 * z, fr.h + 2 * z)), b(R(rest.x - z, rest.y - z, rest.w + 2 * z, rest.h + 2 * z)), {name: "focus " + foc});
    const bed = R(d.pane.x + 4, fr.y, Math.max(1, fr.x - 7 - (d.pane.x + 4)), fr.h), bedT = foc === "tabs" ? R(d.plate.x + 1, fr.y, Math.max(1, fr.x - 7 - d.plate.x - 1), fr.h) : foc === "arm" ? R(d.confirm.box.x + 2, fr.y, Math.max(1, fr.x - 7 - d.confirm.box.x - 2), fr.h) : bed;
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
let MC = mOf(null); // the estimate until a page plans
const measureOr = (s, px, disp) => W(MC, disp ? T.display(px) : T.label(px), s);
const nWOr = (s, px) => nW(MC, T.num(px), s);

/* ---------- the page ---------- */
const FIELDS = ["page", "spage", "level", "heat", "plaques", "scores", "rows", "view", "notes", "wipe", "arm", "unlocked", "rev"];
let S = null;
export const _dbg = {plans: 0, last: null, foci: new Set()}; // foci: every page:focus painted (a sweep proves it reached each branch)
function same(S0, G, ui, w, dpr, c, tap) {
  if (!S0 || S0.G !== G || S0.w !== w || S0.dpr !== dpr || S0.c !== c || S0.tap !== tap) return false;
  for (const k of FIELDS) if (S0.ui[k] !== ui[k]) return false;
  return true;
}
const J = JSON.stringify;
/* the room: MENU's own room layer at MENU's room dpr (menu.js roomRule, the one rule MENU, LEVEL SELECT, SETTINGS and GUIDE use; R1 train), so a
   MENU / RECORDS hop never refills it; this page's own give-way (its page layer and feet inside the budget; no logo reserve, RECORDS shows no logo)
   is the floor, and only where that is under MENU's dpr does the room take its own key */
function sizes(S0, G, F, level, tok, ui) {
  const d = G.d, u = G.u, dpr = S0.dpr, T0 = d.T, ob = R(d.plate.x - T0 - 2, d.plate.y - T0 - 2, d.plate.w + 2 * T0 + 4, d.plate.h + 2 * T0 + 6), pb = sc(ob, u);
  const id = [ui.page, G.mode, +u.toFixed(6), J(d.plate), ui.page === "scores" ? ui.plaques | 0 : "", J(ui.rows || null), ui.page === "stats" ? J([ui.view || null, ui.notes || null, ui.arm ? S0.P.stats.confirm.sentence : "", !!ui.unlocked]) : "", S0.P.pg ? S0.P.pg.page : 0].join("|");
  const K = {biome: tok.name, level, W: F.W, H: F.H, look: "2d", textScale: G.ts, dpr};
  S0.ob = ob; S0.pb = pb; S0.pw = Math.round(pb.w * dpr); S0.ph = Math.round(pb.h * dpr); S0.pageKey = {...K, layer: "records.page|" + id}; S0.pageK = keyOf(S0.pageKey);
  S0.feet = Object.entries(S0.P.feet).map(([v, fp]) => {
    const fr = R(fp.x - 1, fp.y - 1, fp.w + 2, fp.h + 6), bb = sc(fr, u), w = Math.round(bb.w * dpr), h = Math.round(bb.h * dpr);
    const key = {...K, layer: "records.foot|" + J([+u.toFixed(6), fp.x, fp.y, fp.w, fp.parts.map((p) => [p.t || p.sep || "", p.cap || ""])])};
    return {v, fp, fr, b: bb, w, h, key, k: keyOf(key)};
  });
  const bytes = S0.pw * S0.ph * 4 + S0.feet.reduce((a, q) => a + q.w * q.h * 4, 0);
  S0.rd = pageRoomDpr(S0.c, F, {rev: ui.rev}, dpr, bytes);
  S0.box = {w: F.W, h: F.H};
  S0.roomK = keyOf({layer: "room", biome: tok.name, level, W: F.W, H: F.H, dpr: S0.rd, look: "2d", textScale: 1});
}
/** Paints one RECORDS tab on c for the frame F. ui = {page "scores" | "stats" | "medals", level, focus "tabs" | "body", heat, scores (played rows of that
    difficulty), plaques (the badge bits), rows (MEDALS: [name, desc, earned] x 8)}; a zero or non-finite box draws nothing. */
export function drawRecordsPage(c, F, ui, t = 0) {
  if (!okBox(F) || PAGES.indexOf(ui.page) < 0) return;
  const level = ui.level | 0 || 1, tok = worldTokens(level), G = recordsGeom(F), u = G.u, words = hints(), touchy = !!F.touch;
  const dpr = capDpr(deviceScale(c), touchy), tap = tapMode(touchy), foc = ui.page === "stats" && ui.arm ? "arm" : ui.page !== "medals" && ui.focus === "body" ? "body" : "tabs";
  MC = mOf(c);
  if (!same(S, G, ui, words, dpr, c, tap)) {
    const P = plan(c, G, ui);
    P.feet = {};
    if (G.mode === "desk") for (const f of ui.page === "medals" ? ["tabs"] : ui.page === "stats" && ui.arm ? ["arm"] : ["tabs", "body"]) P.feet[f] = footPlan(MC, G, footItems(ui.page, f, ui.page === "stats" && ui.arm ? hints() : words, tap && G.touch));
    S = {G, w: words, dpr, c, tap, ui: {...ui}, P, room: null, page: null, foot: {}};
    sizes(S, G, F, level, tok, ui);
    _dbg.plans++;
  }
  const P = S.P;
  _dbg.last = {G, P, foc, S};
  _dbg.foci.add(ui.page + ":" + foc);
  if (typeof c.clip !== "function" || typeof c.rect !== "function") return;
  const q = S.feet.find((f) => f.v === foc) || S.feet[0] || null;
  S.fv = q ? q.v : null;
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
  { const t0 = P.tabs[pi]; focusKey(c, tr, t0.s, {fit: t0.bomb, lp: t0.lp, lw: t0.lw}, foc === "tabs" && !tap, tok, DEV[G.dev], G.dev === "p"); }
  if (ui.page === "scores") scoresLive(c, G, P, ui, tok, foc === "body" && !tap);
  if (P.pg && !(ui.page === "stats" && ui.arm)) paintPager(c, G.d.bodies[ui.page].pager, P.pg, tok, DEV[G.dev]); // armed, the confirm plate is the one page
  if (ui.page === "stats" && ui.arm) confirmLive(c, G, tok);
  if (ui.toast && ui.toast.s) toastTag(c, G, ui.toast, tok);
  c.restore();
  if (probe.probe.on) record(G, P, ui, foc, dpr, F.shell ? "sh" : "c", q && q.fp, tok, touchy, tap);
}
