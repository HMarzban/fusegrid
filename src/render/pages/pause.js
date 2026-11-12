/* PAUSE PAGE (UI upgrade v202 Task 5.1; design record §4 PAUSE; appendix 7.3 PAUSE title block, rows and tags; the round 7 S7-pages 10-pause frames).
   PAUSE stays on #c over the frozen board (R1, R16; a portrait phone: #sh's over box under the HUD plate, Task 9.8, B.free), in the tokens of the room being PLAYED (world.level), drawn by drawOverlay for all three looks.
   Top to bottom on the kit plate: a centred kicker LEVEL n · WORLD (· DAILY), PAUSED, a tag row of the run's non-default rules (words.js runParts:
   each names its setting, at most 3 and +N; none for a default run), clear space, RESUME (the yellow key, the back key's cap at its end on a keyboard
   layout), SETTINGS (a door), the wall-course divider, RESTART and QUIT TO MENU (danger; M's cap at its end on a keyboard layout), the foot hint.
   pauseGeom(B, touch, o) is the one geometry for draw and tap, o = {css, world, time}: B the overlay box (600 x 520, or iso 608 x 352), touch the layout
   (data-lay p / l), css the CSS px per box unit (#c's stage scale, fit.js; 1 when unknown), world + time only for whether a tag row shows. Rows by
   index in PAUSE_ROWS order, box units; d holds the same in design px (u box units per design px). The plate keeps the HUD band (y < 42) and the
   ability bar (y >= 482 on a 520 box) clear. keyboard: the S7 desktop metrics in box units (u 1: RESUME 54, rows 44, plate 340, 420 at 125 %),
   scaled as one piece when a box is short (pitches are caps). touch: design px are CSS px (u = 1 / css) on the phone type; RESUME and the rows are
   floored at 44 CSS px and grow toward their box caps (76 / 70) with the room left; arrangements in turn, the first that fits wins: one list with
   the foot; the 2 x 2 grid (RESUME | SETTINGS, the divider, RESTART | QUIT TO MENU) with the foot; the grid without the foot; the grid with the tag
   row folded into the kicker; past that the last scales as one piece and the floors give way. A list row owns its band across the whole stage and
   half of each gap round it; a grid tile owns its half of the stage. pauseHit returns the row index, -1 off the rows.
   drawPause(c, world, B, ui, tm, run): ui = {cursor, touch, css, note (replaces the kicker's run line), next (the look tail, pauseKick)}. Cached
   (kit cache.js, recency touched on a steady frame): the plate layer (rampart, bed, header, every row at rest, divider, foot), keyed by what it
   shows. Live: the veil and the focused row (RESUME: the ring and the bare bomb; a row: the band and the bare bomb, a danger label in cream).
   With no canvas source (Node) it paints straight onto the target; a context with no clip or rect gets the plan only. Under the probe it records
   its rects, texts and squint pairs outside any layer paint. */
import {biomeOf} from "../../core/config.js";
import {LABEL, MENU_WORDS as M, PAUSE_WORDS as PW, runParts} from "../words.js";
import {worldTokens, CONST, rgba} from "../kit/tokens.js";
import {key, plate, band, focusBomb, glyph} from "../kit/paint.js";
import {T, DEV, measure, textScale} from "../kit/type.js";
import {layer, touch as touchLayer, keyOf, canMake} from "../kit/cache.js";
import * as probe from "../kit/probe.js";
import {deviceScale} from "../logo/draw2d.js";
import {hints, tapAt} from "../hintcopy.js";

const deep = (o) => { for (const v of Object.values(o)) if (v && typeof v === "object") deep(v); return Object.freeze(o); };
/* Row copy mirrors src/app/menuapp.js PAUSE_ITEMS (words.test pins them equal): render/ never imports src/app. */
export const PAUSE_ROWS = Object.freeze([PW.RESUME, LABEL.SETTINGS, PW.RESTART, PW.QUIT]);
const DANGER = [PW.RESTART, PW.QUIT];
/* the shape by LABEL, the one place draw and tap read it: RESUME the hero, SETTINGS the door, a divider before the first danger row */
export const PAUSE_SHAPE = Object.freeze(PAUSE_ROWS.map((label, i) => Object.freeze({label, hero: label === PW.RESUME, door: label === LABEL.SETTINGS, danger: DANGER.includes(label), rule: i > 0 && DANGER.includes(label) && !DANGER.includes(PAUSE_ROWS[i - 1])})));
const RULE_AT = PAUSE_SHAPE.findIndex((r) => r.rule);
/* box-unit caps: touch row 70, hero 76, plate 380; keyboard row 44, hero 54, plate 340 */
export const PAUSE_ROW_H = 70, PAUSE_ROW_D = 44, PAUSE_HERO_H = 76, PAUSE_HERO_D = 54, PAUSE_W_H = 380, PAUSE_W_D = 340;
export const PZ = deep({
  d: {w: PAUSE_W_D, w125: 420, pad: [11, 18, 14, 18], top: 6, gap: 6, title: 34, below: 30, below125: 34, hero: PAUSE_HERO_D, row: PAUSE_ROW_D, heroGap: 12, div: 19, rowGap: 2, footTop: 14, gs: 16},
  p: {w: PAUSE_W_H, pad: [11, 14, 14, 14], top: 6, gap: 6, title: 26, below: 24, below125: 26, hero: PAUSE_HERO_H, row: PAUSE_ROW_H, heroGap: 12, div: 19, rowGap: 9, footTop: 14, gs: 18, tileGap: 12, gridMax: 560},
});
/* the touch floors in CSS px (44 x 44, 8 apart), and the row floor the plan holds: 45, since #c's 1 px border leaves its content box ~0.5 %
   under the stage scale (canvas.css) on a phone; the box rows the plate keeps clear (CLEAR: the HUD band, y < 42, and the ability bar, y >= H - 38, 482 on a 520 box);
   MARGIN past the ring */
export const TOUCH = Object.freeze({h: 44, g: 8, row: 45});
export const CLEAR = Object.freeze({top: 42, bot: 38, short: 6});
const MARGIN = 4, MAXTAGS = 3;
export const TRIES = deep([{mode: "list", foot: true, fold: false}, {mode: "grid", foot: true, fold: false}, {mode: "grid", foot: false, fold: false}, {mode: "grid", foot: false, fold: true}, {mode: "grid", foot: false, fold: true, tight: true}]);
/* the tight try: the header's clear space, the divider's bed, the plate's side padding and the tiles' gap close up to TIGHT (the divider and the gap
   still leave >= 8 CSS px between two rows) */
export const TIGHT = Object.freeze({below: 12, div: 13, padX: 8, tileGap: 9});

/* the run's non-default rules, each named (words.js runParts); TIME TRIAL when the run is timed */
export const tagsOf = (world, time) => { const w = world || {}; return runParts({heat: w.heat, pace: w.pace, pact: w.pact, time: !!time}); };
const R = (x, y, w, h) => ({x, y, w, h});
const sc = (r, u) => ({x: r.x * u, y: r.y * u, w: r.w * u, h: r.h * u});

function solve(B, touchy, css, ts, tags) {
  const dev = touchy ? "p" : "d", P = PZ[dev], dv = DEV[dev], t125 = ts > 1.1, Tt = dv.T, top = B.free ? 0 : CLEAR.top, bot = B.free ? B.h : B.h >= 480 ? B.h - CLEAR.bot : B.h - CLEAR.short; // B.free: the over box (Task 9.8), nothing of the HUD's to clear
  const kL = dv.pri * ts * 1.2, tL = P.title * ts * 1.2, tagH = Math.max(dv.tg, dv.sec * ts + 10), footL = dv.sec * ts * 1.2, below = t125 ? P.below125 : P.below, reachY = 2 * Tt + 5;
  const head = (k) => P.pad[0] + P.top + kL + P.gap + tL + (tags && !k.fold ? P.gap + tagH : 0) + (k.tight ? TIGHT.below : below), dv0 = (k) => (k.tight ? TIGHT.div : P.div);
  const rowsH = (k, hero, row) => (k.mode === "grid" ? hero + dv0(k) + row : hero + P.heroGap + row + dv0(k) + row + P.rowGap + row);
  const tail = (foot) => (foot ? P.footTop + footL : 0) + P.pad[2];
  const total = (k, hero, row) => head(k) + rowsH(k, hero, row) + tail(k.foot);
  let u, k, hero, row, w, floored = true;
  if (!touchy) {
    k = TRIES[0]; hero = P.hero; row = P.row;
    u = Math.min(1, (bot - top) / (total(k, hero, row) + reachY));
  } else {
    const fl = TOUCH.row, hc = Math.max(fl, P.hero * css), rc = Math.max(fl, P.row * css), room = (bot - top) * css - reachY;
    k = null;
    for (const q of TRIES) {
      const h0 = total(q, fl, fl), h1 = total(q, hc, rc);
      if (h0 <= room) { const t = h1 > h0 ? Math.max(0, Math.min(1, (room - h0) / (h1 - h0))) : 0; k = q; hero = fl + t * (hc - fl); row = fl + t * (rc - fl); break; }
    }
    u = 1 / css;
    if (!k) { k = TRIES[TRIES.length - 1]; hero = row = fl; u = (bot - top) / (total(k, fl, fl) + reachY); floored = false; }
  }
  const Wd = B.w / u, availW = Wd - 2 * (Tt + 2) - 2 * MARGIN;
  w = Math.min(availW, !touchy ? (t125 ? P.w125 : P.w) : k.mode === "grid" ? P.gridMax : P.w * css);
  const Hd = total(k, hero, row), x = (Wd - w) / 2, y = top / u + Tt + 2 + Math.max(0, ((bot - top) / u - reachY - Hd) / 2);
  const px = k.tight ? TIGHT.padX : P.pad[3], tg = k.tight ? TIGHT.tileGap : P.tileGap, cx0 = x + px, cw = w - 2 * px, ry = y + head(k), dg = dv0(k), rows = [];
  let div;
  if (k.mode === "grid") {
    const tw = (cw - tg) / 2, x1 = cx0 + tw + tg, r2 = ry + hero + dg;
    rows.push(R(cx0, ry, tw, hero), R(x1, ry, tw, hero), R(cx0, r2, tw, row), R(x1, r2, tw, row));
    div = ry + hero + dg / 2;
  } else {
    const s = ry + hero + P.heroGap, r2 = s + row + dg;
    rows.push(R(cx0, ry, cw, hero), R(cx0, s, cw, row), R(cx0, r2, cw, row), R(cx0, r2 + row + P.rowGap, cw, row));
    div = s + row + dg / 2;
  }
  const last = rows[rows.length - 1], kickY = y + P.pad[0] + P.top + kL / 2, titleY = kickY + kL / 2 + P.gap + tL / 2;
  return {dev, u, t125, T: Tt, mode: k.mode, foot: k.foot, fold: k.fold, tight: !!k.tight, tagRow: !!tags && !k.fold, floored, plate: R(x, y, w, Hd), cx: x + w / 2, cw, cx0,
    kickY, kL, titleY, tL, tagY: titleY + tL / 2 + P.gap + tagH / 2, tagH, footY: k.foot ? last.y + last.h + P.footTop + footL / 2 : null, footL, rows, div, top, bot};
}
let gm = null;
/** The one PAUSE geometry for draw and tap (box units; d: design px). */
export function pauseGeom(B, touch, o) {
  const p = o || {}, touchy = !!touch, css = touchy && p.css > 0 && Number.isFinite(p.css) ? p.css : 1, ts = textScale(), tags = tagsOf(p.world, p.time).length > 0;
  if (gm && gm.w === B.w && gm.h === B.h && gm.free === !!B.free && gm.touch === touchy && gm.css === css && gm.ts === ts && gm.tags === tags) return gm.G;
  const d = solve(B, touchy, css, ts, tags), u = d.u, n = PAUSE_ROWS.length, b = d.rows.map((r) => sc(r, u)), out = [];
  for (let i = 0; i < n; i++) {
    const r = b[i], grid = d.mode === "grid", col = grid ? i & 1 : 0, mate = grid ? (i < 2 ? [0, 1] : [2, 3]) : [i];
    const up = grid ? (i < 2 ? null : d.div * u) : i ? (b[i - 1].y + b[i - 1].h + r.y) / 2 : null, dn = grid ? (i < 2 ? d.div * u : null) : i < n - 1 ? (r.y + r.h + b[i + 1].y) / 2 : null;
    const mid = grid ? (b[mate[0]].x + b[mate[0]].w + b[mate[1]].x) / 2 : null;
    out.push(Object.freeze({label: PAUSE_ROWS[i], x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.h, w: r.w, h: r.h, cx: r.x + r.w / 2, cy: r.y + r.h / 2,
      a: up == null ? r.y : up, b: dn == null ? r.y + r.h : dn, hx0: grid && col ? mid : 0, hx1: grid && !col ? mid : B.w}));
  }
  const pl = sc(d.plate, u);
  const G = deep({mode: d.mode, dev: d.dev, u, css, t125: d.t125, touch: touchy, tags: d.tagRow, fold: d.fold, foot: d.foot, floored: d.floored, x: pl.x, y: pl.y, w: pl.w, h: pl.h,
    T: d.T * u, mid: d.cx * u, rows: out, div: RULE_AT > 0 ? d.div * u : null, d});
  gm = {w: B.w, h: B.h, free: !!B.free, touch: touchy, css, ts, tags, G};
  return G;
}
/** The PAUSE row under (x, y) in box units, -1 off the rows; o as pauseGeom's. A row owns [a, b]; a y on the seam with the row above it (a list
    midpoint, the grid's divider) is the row above's, and an x on the grid's middle seam the left tile's. */
export function pauseHit(x, y, B, touch, o) {
  const G = pauseGeom(B, touch, o), r = G.rows;
  for (let i = 0; i < r.length; i++) {
    const q = r[i];
    if (x < q.hx0 || x > q.hx1 || y < q.a || y > q.b) continue;
    if (y === q.a && r.some((p) => p !== q && p.b === q.a && p.hx0 < q.hx1 && p.hx1 > q.hx0)) continue;
    return i;
  }
  return -1;
}

/* measuring never touches the target: PAUSE plans on its own 1 x 1 context (OffscreenCanvas, else a document canvas: the same system fonts), so
   the overlay's first frame makes the same calls as every frame after it; with neither (Node) on a 0.6 em estimate. setMeasure(ctx) is the tests'
   seam (null restores the default). */
const EST = {font: "", measureText(s) { const m = /(\d+(?:\.\d+)?)px/.exec(this.font); return {width: String(s).length * 0.6 * (m ? +m[1] : 10)}; }};
let MC = null;
export const setMeasure = (c) => { MC = c || null; };
const okM = (g) => { try { const m = g && typeof g.measureText === "function" ? g.measureText("M") : null; return !!m && typeof m.width === "number" && Number.isFinite(m.width); } catch (e) { return false; } };
function mc() {
  if (MC) return MC;
  let g = null;
  try {
    if (typeof OffscreenCanvas === "function") g = new OffscreenCanvas(1, 1).getContext("2d");
    else if (typeof document !== "undefined" && document && typeof document.createElement === "function") { const el = document.createElement("canvas"); g = el && typeof el.getContext === "function" ? el.getContext("2d") : null; }
  } catch (e) { g = null; }
  return (MC = okM(g) ? g : EST);
}
const W = (c, f, s) => measure(c, f, s);
const capWd = (c, s, dv) => Math.max(dv.capw, Math.ceil(W(c, T.label(dv.sec), String(s))) + 20);
/* the first candidate that fits room, else the last dropped from the end until it does */
function fitWords(c, f, cands, room) {
  const L = [].concat(cands), p = String(L[L.length - 1]).split(" · ");
  for (let n = p.length - 1; n >= 1; n--) L.push(p.slice(0, n).join(" · "));
  for (const s of L) if (W(c, f, s) <= room) return s;
  return L[L.length - 1];
}
/** The kicker with the look's tail (v202 Q1: REAL 3D NEXT / READY / · RESTORING): run context drops from the end until it fits; no tail = base, unmeasured. */
export function pauseKick(c, base, next, room, font) {
  if (!next) return base;
  const f = font || T.label(DEV.d.pri), p = String(base).split(" · "), cands = [];
  for (let n = p.length; n >= 1; n--) cands.push(p.slice(0, n).join(" · ") + " · " + next);
  cands.push(next);
  const g = okM(c) ? c : mc();
  for (const s of cands) if (W(g, f, s) <= room) return s;
  return next;
}
/* a label on one line where it fits, else broken once at a space into two that fit */
function lines(c, f, s, room) {
  if (W(c, f, s) <= room) return [s];
  for (let i = s.lastIndexOf(" "); i > 0; i = s.lastIndexOf(" ", i - 1)) { const a = s.slice(0, i), b = s.slice(i + 1); if (W(c, f, a) <= room && W(c, f, b) <= room) return [a, b]; }
  return [s];
}
const lvOf = (world) => (world && world.level) | 0 || 1;
/** The kicker's candidates, longest first: LEVEL n · WORLD (· DAILY); o.fold (a box too short for the tag row) folds the run's rules in, every one
    named, then counted, then terse (EXPERT bare), then without the world. pauseKicker is the longest folded form. */
export function pauseKickers(world, run, o) {
  const p = o || {};
  return kickers(world, run, !!p.fold, !!p.time);
}
export const pauseKicker = (world, run) => pauseKickers(world, run, {fold: true})[0];
function kickers(world, run, fold, time) {
  const lv = LABEL.LEVEL + " " + lvOf(world), lw = lv + " · " + biomeOf(lvOf(world)).name, dl = run && run.daily ? " · " + PW.DAILY : "";
  if (!fold) return [lw + dl, lv + dl];
  const r = {heat: world && world.heat, pace: world && world.pace, pact: world && world.pact, time: !!time}, j = (h, a) => [h + dl].concat(a).join(" · ");
  return [j(lw, runParts(r)), j(lw, runParts(r, {count: true})), j(lw, runParts(r, {count: true, terse: true})), j(lv, runParts(r, {count: true, terse: true}))];
}
/* the tag chips: the named rules packed into one row (at most MAXTAGS, then +N), the terse form (EXPERT bare) where it shows more */
function tagPlan(c, d, dv, world, time) {
  const f = T.label(dv.sec), cw = (s) => W(c, f, s) + 20, room = d.cw;
  const pack = (parts) => {
    const out = [];
    for (let k = Math.min(parts.length, MAXTAGS); k >= 1; k--) {
      const shown = parts.slice(0, k), more = parts.length - k, all = shown.concat(more ? ["+" + more] : []), w = all.reduce((a, s) => a + cw(s), 0) + 6 * (all.length - 1);
      if (w <= room) { out.push(...all); return out; }
    }
    return ["+" + parts.length];
  };
  const r = {heat: world && world.heat, pace: world && world.pace, pact: world && world.pact, time: !!time}, full = runParts(r);
  if (!full.length) return null;
  let s = pack(full);
  if (s.length - (/^\+/.test(s[s.length - 1]) ? 1 : 0) < Math.min(full.length, MAXTAGS)) { const t = pack(runParts(r, {terse: true})); if (t.length >= s.length) s = t; }
  const ws = s.map(cw), tw = ws.reduce((a, b) => a + b, 0) + 6 * (s.length - 1);
  let x = d.cx - tw / 2;
  return {f, px: dv.sec, h: d.tagH, y: d.tagY, chips: s.map((q, i) => { const o = {s: q, x, w: ws[i]}; x += ws[i] + 6; return o; }), w: tw};
}
export function plan(G, world, ui, run, tm) {
  const c = mc(), d = G.d, dv = DEV[d.dev], P = PZ[d.dev], words = hints(), time = !!(tm && tm.on), showCaps = !G.touch, kf = T.label(dv.pri);
  const base = ui.note ? [ui.note] : kickers(world, run, d.fold, time), kick = ui.next ? pauseKick(c, ui.note || base[0], ui.next, d.cw, kf) : fitWords(c, kf, base, d.cw);
  const tags = d.tagRow ? tagPlan(c, d, dv, world, time) : null, lf = kf, bs = dv.bombs, gs = P.gs, rows = [];
  PAUSE_SHAPE.forEach((s, i) => {
    const r = d.rows[i], grid = d.mode === "grid", e = grid ? 6 : 8, o = {label: s.label, r, hero: s.hero, danger: s.danger, door: s.door, rest: r.x + (grid ? 12 : 16), bx: r.x + e, foc: r.x + e + bs + e};
    let right = r.x + r.w - 12;
    if (s.hero) {
      const cs = showCaps ? words.back : "";
      o.cap = cs ? {s: cs, w: capWd(c, cs, dv), h: dv.caph} : null;
      if (o.cap) { o.cap.x = right - o.cap.w; o.cap.y = r.y + r.h / 2 - dv.caph / 2; right = o.cap.x - 10; }
    } else if (s.label === PW.QUIT && showCaps && words.dev !== "pad") {
      o.cap = {s: "M", w: capWd(c, "M", dv), h: dv.caph};
      o.cap.x = right - o.cap.w; o.cap.y = r.y + r.h / 2 - dv.caph / 2; right = o.cap.x - 10;
    } else {
      o.glyph = {n: s.door ? "chev" : s.label === PW.RESTART ? "reset" : "back", s: gs, x: r.x + r.w - 14 - gs, y: r.y + r.h / 2 - gs / 2, col: s.danger ? CONST.cor : CONST.t2};
      o.glyph.hide = grid;
      right = grid ? r.x + r.w - 8 : o.glyph.x - 10;
    }
    o.lines = lines(c, lf, s.label, right - o.foc);
    o.ws = o.lines.map((q) => W(c, lf, q));
    const lh = dv.pri * textScale() * 1.15;
    o.ys = o.lines.map((_, k) => r.y + r.h / 2 + (k - (o.lines.length - 1) / 2) * lh);
    o.f = lf; o.px = dv.pri;
    rows.push(o);
  });
  const foot = d.foot ? (tapAt(G.touch, ui.tap) ? M.TAP : M.MOVE + " " + (words.dev === "pad" ? words.move : "↑↓") + " · " + PW.CONFIRM + " " + words.ok) : "";
  const ff = T.label(dv.sec);
  if (tags) for (const q of tags.chips) q.tw = W(c, tags.f, q.s);
  return {kick, kw: W(c, kf, kick), kf, kpx: dv.pri, pw: W(c, T.display(P.title), PW.PAUSED), tags, rows, foot, fw: foot ? W(c, ff, foot) : 0, ff, fpx: dv.sec, tf: P.title,
    caps: rows.map((o) => (o.cap ? W(c, T.label(dv.sec), o.cap.s) : 0))};
}

/* page-specific glyphs (16-unit grid, round caps, kit5 IC): reset (RESTART) and back (QUIT TO MENU on a touch layout or a controller) */
function icon(c, n, x, y, s, col) {
  if (n !== "reset" && n !== "back") return glyph(c, n, x, y, s, col);
  c.save(); c.translate(x, y); c.scale(s / 16, s / 16);
  c.strokeStyle = col; c.lineCap = c.lineJoin = "round"; c.beginPath();
  if (n === "back") { c.lineWidth = 2.6; c.moveTo(10, 3); c.lineTo(5, 8); c.lineTo(10, 13); }
  else { c.lineWidth = 2.2; c.arc(8, 8, 4.5, Math.PI, -Math.PI / 2, true); c.lineTo(5, 3.5); c.moveTo(6.5, 1); c.lineTo(4, 3.5); c.lineTo(6.5, 6); }
  c.stroke(); c.restore();
}
const rp = (c, x, y, w, h, r) => { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
/* the kit display recipe (type.js dsp: a 0.12 em outline, a hard 0.08 em drop), centred, measuring nothing, so a context that cannot measure still paints */
function title(c, s, x, y, px) {
  const em = px * textScale(), dy = em * 0.08;
  c.font = T.display(px); c.textAlign = "center"; c.textBaseline = "middle"; c.lineJoin = "round"; c.lineWidth = em * 0.12; c.strokeStyle = CONST.ol;
  c.fillStyle = CONST.ol; c.strokeText(s, x, y + dy); c.fillText(s, x, y + dy);
  c.strokeText(s, x, y); c.fillStyle = CONST.ink; c.fillText(s, x, y);
}
function text(c, s, x, y, f, col, align) { c.font = f; c.fillStyle = col; c.textAlign = align || "left"; c.textBaseline = "middle"; c.fillText(s, x, y); }
/* the wall-course divider (S7 .wc): a 2 px outline course over a 1 px band line, an outline tick every 32 px */
function course(c, x, y, w, tok) {
  c.fillStyle = CONST.ol; c.fillRect(x, y - 1.5, w, 2);
  c.fillStyle = tok.band; c.fillRect(x, y + 0.5, w, 1);
  c.fillStyle = CONST.ol;
  for (let t = 14; t + 3 <= w; t += 32) c.fillRect(x + t, y - 2.5, 3, 5);
}
/* a keycap (kit cap's recipe: a key-kind key, the t2 legend at the secondary size; main = the dark cap on the yellow key) at the width the plan measured */
function keycap(c, q, tok, ph, main) {
  const f = T.label(DEV[ph ? "p" : "d"].sec), fill = (x, y, w, h, r, col) => { c.fillStyle = col; c.beginPath(); rp(c, x, y, w, h, r); c.fill(); };
  if (main) { fill(q.x, q.y + 3, q.w, q.h, 6, "#6a4a08"); fill(q.x, q.y, q.w, q.h, 6, CONST.ol); fill(q.x + 2, q.y + 2, q.w - 4, q.h - 4, 4, CONST.yelInk); }
  else key(c, q.x, q.y, q.w, q.h, "key", {tok});
  text(c, q.s, q.x + q.w / 2, q.y + q.h / 2, f, main ? CONST.yel : CONST.t2, "center");
}
function paintRow(c, o, tok, ph, foc) {
  const r = o.r, dv = DEV[ph ? "p" : "d"], x = foc ? o.foc : o.rest;
  if (o.hero) {
    key(c, r.x, r.y, r.w, r.h, "main", {tok, ring: foc});
    if (foc) focusBomb(c, o.bx, r.y + r.h / 2, dv.bombs);
    o.lines.forEach((s, i) => text(c, s, x, o.ys[i], o.f, CONST.yelInk));
    if (o.cap) keycap(c, o.cap, tok, ph, true);
    return;
  }
  if (foc) { band(c, r.x, r.y, r.w, r.h, tok); focusBomb(c, o.bx, r.y + r.h / 2, dv.bombs); }
  o.lines.forEach((s, i) => text(c, s, x, o.ys[i], o.f, o.danger && !foc ? CONST.cor : CONST.ink));
  if (o.cap) keycap(c, o.cap, tok, ph, false);
  else if (o.glyph && !(foc && o.glyph.hide)) icon(c, o.glyph.n, o.glyph.x, o.glyph.y, o.glyph.s, o.glyph.col);
}
function paintPlate(c, G, Pl, tok) {
  const d = G.d, ph = d.dev === "p";
  plate(c, d.plate.x, d.plate.y, d.plate.w, d.plate.h, tok, {phone: ph});
  text(c, Pl.kick, d.cx, d.kickY, Pl.kf, CONST.t2, "center");
  title(c, PW.PAUSED, d.cx, d.titleY, Pl.tf);
  if (Pl.tags) for (const q of Pl.tags.chips) {
    const y = Pl.tags.y - Pl.tags.h / 2;
    c.fillStyle = CONST.t2; c.beginPath(); rp(c, q.x, y, q.w, Pl.tags.h, 4); c.fill();
    c.fillStyle = CONST.ol; c.beginPath(); rp(c, q.x + 2, y + 2, q.w - 4, Pl.tags.h - 4, 3); c.fill();
    text(c, q.s, q.x + q.w / 2, Pl.tags.y, Pl.tags.f, CONST.t2, "center");
  }
  for (const o of Pl.rows) paintRow(c, o, tok, ph, false);
  if (G.div != null) course(c, d.cx0, d.div, d.cw, tok);
  if (Pl.foot) text(c, Pl.foot, d.cx, d.footY, Pl.ff, CONST.t2, "center");
}

const CAP_K = 0.705;
function record(G, Pl, cur, tok, dpr) {
  const u = G.u, d = G.d, b = (r) => [r.x * u, r.y * u, r.w * u, r.h * u], ts = textScale();
  probe.begin("pause", {w: G.bw, h: G.bh, dpr, el: "c"});
  probe.rect("plate", ...b(d.plate), {plate: G.T});
  const txt = (s, x, y, w, px, col, role) => probe.text(s, x * u, (y - px * ts * CAP_K / 2) * u, Math.max(0.01, w * u), px * ts * CAP_K * u, {role, col, px: px * u});
  txt(Pl.kick, d.cx - Pl.kw / 2, d.kickY, Pl.kw, Pl.kpx, CONST.t2, "primary");
  txt(PW.PAUSED, d.cx - Pl.pw / 2, d.titleY, Pl.pw, Pl.tf, CONST.ink, "primary");
  if (Pl.tags) for (const q of Pl.tags.chips) txt(q.s, q.x + q.w / 2 - q.tw / 2, Pl.tags.y, q.tw, Pl.tags.px, CONST.t2, "secondary");
  Pl.rows.forEach((o, i) => {
    const r = o.r, f = i === cur;
    probe.rect(o.label, ...b(r), {touch: G.touch, set: "pause", focus: f, ...(o.hero ? {fill: CONST.yel} : f ? {fill: tok.band} : {})});
    o.lines.forEach((s, k) => txt(s, f ? o.foc : o.rest, o.ys[k], o.ws[k], o.px, o.hero ? CONST.yelInk : o.danger && !f ? CONST.cor : CONST.ink, "primary"));
    if (o.cap) { probe.rect(o.label + " cap", ...b(R(o.cap.x, o.cap.y, o.cap.w, o.cap.h))); const w = Pl.caps[i]; txt(o.cap.s, o.cap.x + o.cap.w / 2 - w / 2, o.cap.y + o.cap.h / 2, w, DEV[d.dev].sec, o.hero ? CONST.yel : CONST.t2, "secondary"); }
    if (o.glyph && !(f && o.glyph.hide)) { const g = o.glyph, p = 6, e = g.s / 16; probe.pair("info", b(R(g.x - e, g.y - e, g.s + 2 * e, g.s + 2 * e)), b(R(g.x - p, g.y - p, g.s + 2 * p, g.s + 2 * p)), {col: g.col, name: o.label + " " + g.n}); } // a: the ink, one grid unit past the 16-unit box (round caps reach out of it)
  });
  if (Pl.foot) txt(Pl.foot, d.cx - Pl.fw / 2, d.footY, Pl.fw, Pl.fpx, CONST.t2, "secondary");
  const k = d.rows[cur], left = !(d.mode === "grid" && cur & 1), x0 = left ? d.plate.x + 1 : k.x + k.w + 7, x1 = left ? k.x - 7 : d.plate.x + d.plate.w - 1, bed = R(x0, k.y, Math.max(1, x1 - x0), k.h);
  probe.pair("band", b(k), b(bed), {name: "focus " + PAUSE_ROWS[cur]});
  probe.pair("ring", b(R(k.x - 6, k.y - 6, k.w + 12, k.h + 12)), b(bed), {name: "ring " + PAUSE_ROWS[cur]});
}

const outer = (d) => R(d.plate.x - d.T - 2, d.plate.y - d.T - 2, d.plate.w + 2 * d.T + 4, d.plate.h + 2 * d.T + 5);
export const _dbg = {plans: 0, last: null};
let S = null;
const VEIL = rgba(CONST.ol, 0.6);
/** Paints the PAUSE list over the frozen board on c (the overlay context) in the box B; see the header for ui. */
export function drawPause(c, world, B, ui = {}, tm, run) {
  if (!B || !(B.w > 0 && B.h > 0)) return;
  const touchy = !!ui.touch, css = ui.css, level = lvOf(world), tok = worldTokens(level), G0 = pauseGeom(B, touchy, {css, world, time: tm && tm.on});
  const G = Object.assign(Object.create(G0), {bw: B.w, bh: B.h}), d = G.d, u = G.u, ts = textScale(), dpr = deviceScale(c), words = hints(), cur = Math.max(0, Math.min(PAUSE_ROWS.length - 1, ui.cursor | 0));
  const w = world || {}, id = [level, w.heat | 0, w.pace | 0, w.pact | 0, !!(tm && tm.on), run && run.daily ? 1 : 0, ui.note || "", ui.next || ""].join("|");
  if (!S || S.G0 !== G0 || S.id !== id || S.words !== words || S.ts !== ts || S.dpr !== dpr || S.c !== c) {
    const Pl = plan(G, w, ui, run, tm), ob = outer(d), pb = sc(ob, u);
    const lk = {layer: "pause.plate|" + JSON.stringify([d.mode, +u.toFixed(6), d.plate, Pl.kick, Pl.tags && Pl.tags.chips.map((q) => q.s), Pl.foot, Pl.rows.map((o) => [o.lines, o.cap && o.cap.s, o.glyph && o.glyph.n])]),
      biome: tok.name, level, W: B.w, H: B.h, dpr, look: "pause", textScale: ts};
    S = {G0, id, words, ts, dpr, c, Pl, ob, pb, lk, lkS: keyOf(lk), pw: Math.max(1, Math.round(pb.w * dpr)), ph: Math.max(1, Math.round(pb.h * dpr)), layer: null};
    _dbg.plans++;
  }
  const Pl = S.Pl;
  _dbg.last = {G, Pl, cur, S};
  if (typeof c.clip !== "function" || typeof c.rect !== "function") return;
  const a0 = typeof c.globalAlpha === "number" ? c.globalAlpha : 1;
  if (canMake()) {
    if (!S.layer || !S.layer.width) S.layer = layer(S.lk, S.pw, S.ph, (g) => { g.scale(dpr * u, dpr * u); g.translate(-S.ob.x, -S.ob.y); paintPlate(g, G, Pl, tok); });
    else touchLayer(S.lkS);
    c.save(); c.imageSmoothingEnabled = true; c.drawImage(S.layer, S.pb.x, S.pb.y, S.pb.w, S.pb.h); c.restore();
    c.save(); c.scale(u, u);
  } else {
    c.save(); c.scale(u, u);
    paintPlate(c, G, Pl, tok);
  }
  paintRow(c, Pl.rows[cur], tok, d.dev === "p", true);
  c.restore();
  c.globalAlpha = a0;
  if (probe.probe.on) record(G, Pl, cur, tok, dpr);
}
export {VEIL};
