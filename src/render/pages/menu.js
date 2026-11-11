/* MENU PAGE (UI upgrade v202 Task 3.1; design record §1, §1b, §2, §4; appendix 7.4; the round 7 S7-menu / L7-logo frames). The room the next run starts
   in (ui.level) dresses the stage: its room look (kit room.js) opaque over the whole canvas, its rampart round the plate; the arcade bomber is the keys.
   menuGeom(F, rows) is the one geometry for draw and tap: rects by ROW NAME in box units (G.d: the same in design px, the mock's CSS px; u box units
   per design px). F = {W, H, touch, shell, css, ts}: the box (#sh's shell box, else #c's 600 x 520 / 608 x 352), touch (data-lay p / l), shell, css (CSS
   px per box unit, read on a phone), ts (the kit text scale). desk: every box but a touch-portrait shell box, the 1366 x 768 frame at u 1: the mock's
   plate centred, a narrower window narrows only the card's column (the list keeps 480), the 70 px top margin gives way to a short window, then the
   page scales as one piece (#c, the iso guard). phone: the 393 x 852 column in CSS px (u = 1 / css), capped at 600 CSS px and centred; the card's slot
   takes the height left. G.card is Task 3.2's slot, bare bed here. A row owns its key and half of each gap round it, out to the plate's bed edge;
   menuHit returns its ITEMS index, -1 off the rows. The logo (drawLogo2d, place menu) sits in the header at scale lk = max(u, 20 / 36): under a
   20-unit cap the plan has no MENU build. drawMenuPage(c, F, ui, t): ui = {rows, focus (a label; tap mode hands PLAY), level, run, daily (null or
   today's tries), best (the top played NORMAL score or null), look, pages, rev, note, pad, reduced, enterT}. Cached (kit cache.js, recency touched on
   a steady frame): the room (roomLayer, its dpr giving way so the plate, the foot verbs and a 3 MiB logo reserve fit the 24 MiB budget), the plate
   (rampart, bed, every row at rest), one foot per verb (START on PLAY, OPEN on a door, a controller's SOURCE line), all made at once so a cursor move
   never misses. Live: the logo, the focused row (key, band on a door, the bare bomb, its words, the cream ring), the 0.25 s fade of plate, logo and
   foot over the opaque room. A context that cannot measure plans on a 0.6 em estimate and gets no keycap; with no canvas source (Node) the plate and
   foot paint straight onto the target over one flat fill; a context with no clip or rect (the headless renderer's) gets the plan only. Under the
   probe it records its rects, texts and squint pairs outside any layer paint. */
import {biomeOf} from "../../core/config.js";
import {LABEL, MENU_ROWS, MENU_WORDS as M, ART_STYLES, DIFF, tagFor, runParts} from "../words.js";
import {worldTokens, CONST, toL} from "../kit/tokens.js";
import {key, cap, capW, plate, band, focusBomb} from "../kit/paint.js";
import {T, DEV, measure, textScale} from "../kit/type.js";
import {layer, capDpr, touch, keyOf, BUDGET} from "../kit/cache.js";
import {roomLayer} from "../kit/room.js";
import * as probe from "../kit/probe.js";
import {drawLogo2d, deviceScale} from "../logo/draw2d.js";
import {PLATE as LOGO} from "../logo/worlds.js";
import {layout as logoLay} from "../logo/glyphs.js";
import {hints, tapMode} from "../hintcopy.js";

const deep = (o) => { for (const v of Object.values(o)) if (v && typeof v === "object") deep(v); return Object.freeze(o); };
export const DESK = deep({
  d: {top: 70, w: 1060, pad: [30, 26, 26, 26], list: 480, col: 26, hero: 64, door: 46, card: 420, foot: 18},
  d125: {top: 56, w: 1180, pad: [22, 24, 20, 24], list: 520, col: 26, hero: 72, door: 49, card: 456, foot: 14},
});
export const PHONE = deep({
  p: {top: 40, bot: 20, side: 12, pad: [12, 12, 14, 12], hero: 62, door: 50, tile: 58, card: 120, max: 600},
  p125: {top: 26, bot: 20, side: 12, pad: [12, 12, 14, 12], hero: 62, door: 50, tile: 84, card: 120, max: 600},
});
export const PITCH = 8, BRK = 24, GAP = 10, FOOT_H = 54, TOP_MIN = 26, GUT = 8, CARD_MIN = 360, TZ = "#bcad9a", CAP_K = 0.705;
const LOGO_CAP = LOGO.menu.cap, ENV = logoLay(LOGO.menu.build).env, LOGO_H = ENV.h * LOGO_CAP, EDGE = 2, RESERVE = 3 * 1024 * 1024;
const LOGO_MIN = 20;
const PLAY = MENU_ROWS[0], LS = LABEL.LEVEL_SELECT, GUIDE = "GUIDE", SOURCE = "SOURCE";
const big = (ts) => ts > 1.1;

const R = (x, y, w, h) => ({x, y, w, h});
const sc = (r, u) => (r ? {x: r.x * u, y: r.y * u, w: r.w * u, h: r.h * u} : null);
function desk(F, rows, t125) {
  const D = DESK[t125 ? "d125" : "d"], Lp = LOGO.menu[t125 ? "d125" : "d"], T0 = DEV.d.T, head = Lp.pad[0] + LOGO_H + Lp.pad[2];
  const gaps = rows.map((l, i) => (i === 0 ? 0 : i === 1 || l === GUIDE ? BRK : PITCH));
  const listH = rows.reduce((a, l, i) => a + gaps[i] + (i === 0 ? D.hero : D.door), 0), colH = Math.max(listH, D.card);
  const plateH = D.pad[0] + head + Lp.below + colH + D.pad[2], tail = D.foot + FOOT_H + 4 + 12, side = 2 * (T0 + 2 + GUT);
  const minW = side + D.pad[3] + D.list + D.col + CARD_MIN + D.pad[1];
  const u = Math.min(1, F.W / minW, F.H / (TOP_MIN + plateH + tail)), Wd = F.W / u, Hd = F.H / u;
  const pw = Math.min(D.w, Wd - side), px = (Wd - pw) / 2, py = Math.max(TOP_MIN, Math.min(D.top, Hd - plateH - tail));
  const hy = py + D.pad[0], ly = hy + Lp.pad[0], top = hy + head + Lp.below, lx = px + D.pad[3];
  const out = {}, hit = {};
  let y = top;
  rows.forEach((l, i) => { y += gaps[i]; const h = i === 0 ? D.hero : D.door; out[l] = R(lx, y, D.list, h); y += h; });
  rows.forEach((l, i) => {
    const r = out[l], up = i === 0 ? Math.min(12, Lp.below / 2) : gaps[i] / 2, dn = i === rows.length - 1 ? D.pad[2] / 2 : gaps[i + 1] / 2;
    hit[l] = R(px, r.y - up, lx + D.list + D.col / 2 - px, r.h + up + dn);
  });
  const cx = lx + D.list + D.col;
  return {mode: "desk", dev: "d", u, t125, T: T0, plate: R(px, py, pw, plateH), head: R(px + D.pad[3], hy, pw - D.pad[1] - D.pad[3], head),
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
  const hit = {}, e = P.pad[3] / 2, x0 = ix - e, x1 = ix + iw + e;
  for (const l of rows) {
    const r = out[l], top = l === rows[0] ? r.y - Math.min(GAP, Lp.below) / 2 : r.y - GAP / 2, bot = l === last ? r.y + r.h + P.pad[2] / 2 : r.y + r.h + GAP / 2;
    const left = kind[l] === "tile" && r.x > ix ? r.x - GAP / 2 : x0, right = kind[l] === "tile" && r.x === ix ? r.x + r.w + GAP / 2 : x1;
    hit[l] = R(left, top, right - left, bot - top);
  }
  return {mode: "phone", dev: "p", u, t125, T: DEV.p.T, plate: R(px, py, pw, ph), head: R(ix, hy, iw, head), logo: R(ix, hy + Lp.pad[0], iw, LOGO_H), rows: out, hit, kind, card, foot: null};
}
let gm = null;
const sameRows = (a, b) => a === b || (a.length === b.length && a.every((l, i) => l === b[i]));
export function menuGeom(F, rows = MENU_ROWS) {
  const ts = F.ts > 0 ? F.ts : textScale(), t125 = big(ts), isPhone = !!(F.shell && F.touch && F.H > F.W * 1.3);
  if (gm && gm.W === F.W && gm.H === F.H && gm.phone === isPhone && gm.t125 === t125 && gm.css === (F.css || 1) && sameRows(gm.rows, rows)) return gm.G;
  const d = (isPhone ? phone : desk)(F, rows, t125), u = d.u, G = {mode: d.mode, dev: d.dev, u, t125, W: F.W, H: F.H, d, T: d.T * u, order: rows.slice(),
    lk: Math.max(u, LOGO_MIN / LOGO_CAP),
    plate: sc(d.plate, u), head: sc(d.head, u), logo: sc(d.logo, u), card: sc(d.card, u), foot: sc(d.foot, u), kind: d.kind, rows: {}, hit: {}};
  for (const l of rows) { G.rows[l] = sc(d.rows[l], u); G.hit[l] = sc(d.hit[l], u); }
  const k = G.lk / u, cy = d.logo.y + d.logo.h / 2, cx = d.logo.x + d.logo.w / 2, bw = Math.max(d.logo.w, ENV.w * LOGO_CAP * k + 2 * EDGE * k) / k;
  G.lbox = R(cx * u / G.lk - bw / 2, cy * u / G.lk - (LOGO_H + 2 * EDGE) / 2, bw, LOGO_H + 2 * EDGE);
  gm = {W: F.W, H: F.H, phone: isPhone, t125, css: F.css || 1, rows, G: deep(G)};
  return gm.G;
}
export function menuHit(x, y, F, rows = MENU_ROWS) {
  const G = menuGeom(F, rows);
  for (let i = 0; i < rows.length; i++) { const h = G.hit[rows[i]]; if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) return i; }
  return -1;
}

export function glyph(c, name, x, y, s, col) {
  c.save(); c.translate(x, y); c.scale(s / 16, s / 16);
  c.strokeStyle = c.fillStyle = col; c.lineCap = c.lineJoin = "round"; c.beginPath();
  if (name === "chev") { c.lineWidth = 2.4; c.moveTo(6, 3); c.lineTo(11, 8); c.lineTo(6, 13); c.stroke(); }
  else if (name === "ext") { c.lineWidth = 2; c.moveTo(9, 2); c.lineTo(14, 2); c.lineTo(14, 7); c.moveTo(14, 2); c.lineTo(7, 9); c.moveTo(12, 10); c.lineTo(12, 14); c.lineTo(2, 14); c.lineTo(2, 4); c.lineTo(6, 4); c.stroke(); }
  else if (name === "up") { c.moveTo(3, 11); c.lineTo(8, 5); c.lineTo(13, 11); c.closePath(); c.fill(); }
  else if (name === "dn") { c.moveTo(3, 5); c.lineTo(8, 11); c.lineTo(13, 5); c.closePath(); c.fill(); }
  c.restore();
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
const EST = {font: "", measureText(s) { const m = /(\d+(?:\.\d+)?)px/.exec(this.font); return {width: String(s).length * 0.6 * (m ? +m[1] : 10)}; }};
const mOK = new WeakMap(), mOf = (c) => {
  if (!c || (typeof c !== "object" && typeof c !== "function")) return EST;
  let v = mOK.get(c);
  if (v === undefined) { const m = typeof c.measureText === "function" ? c.measureText("M") : null; mOK.set(c, (v = !!m && typeof m.width === "number")); }
  return v ? c : EST;
};
const lblF = (px) => T.label(px), W = (c, f, s) => measure(c, f, s);
function fitCands(c, f, cands, room, two) {
  for (const s of cands) {
    if (W(c, f, s) <= room) return [s];
    if (two) for (let i = s.lastIndexOf(" "); i > 0; i = s.lastIndexOf(" ", i - 1)) { const a = s.slice(0, i), b = s.slice(i + 1); if (W(c, f, a) <= room && W(c, f, b) <= room) return [a, b]; }
  }
  return [];
}
const HERO_PX = 38;
function rowPlan(c, G, ui, l, words, showCap) {
  const d = G.d, r = d.rows[l], k = d.kind[l], ph = d.mode === "phone", dv = DEV[d.dev], ts = textScale(), o = {l, k, r, rest: {}, foc: {}};
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
  o.label = {s: l, f: lf, px: dv.pri, w: lw, col: l === SOURCE ? CONST.t2 : CONST.ink};
  o.glyph = {n: l === SOURCE ? "ext" : "chev", s: gs};
  const tf = lblF(dv.sec);
  if (!tile) {
    const gx = r.x + r.w - (ph ? 16 : 18) - gs, lx = r.x + 24, room = gx - 10 - (lx + sh + lw + 12);
    o.glyph.x = gx; o.glyph.y = r.y + r.h / 2 - gs / 2;
    o.rest.x = lx; o.foc.x = lx + sh; o.label.y = r.y + r.h / 2;
    const tz = fitCands(c, tf, teasers(l, ui, ph), room)[0] || "";
    o.tz = tz ? {lines: [tz], f: tf, px: dv.sec, x: gx - 10, ys: [r.y + r.h / 2], align: "right", w: W(c, tf, tz), col: l === SOURCE && (ui.note || padSign(ui.pad)) ? CONST.ink : TZ} : null;
    return o;
  }
  const lx = r.x + 16, fx = r.x + 8 + dv.bombs + 8, gx = r.x + r.w - 12 - gs, room = Math.min(gx - 6 - lx, r.x + r.w - 14 - fx);
  const lines = fitCands(c, tf, teasers(l, ui, ph), room, big(ts)), lhL = dv.pri * ts * 1.15, lhT = dv.sec * ts * 1.2, bh = lhL + (lines.length ? 4 + lines.length * lhT : 0), top = r.y + r.h / 2 - bh / 2;
  o.glyph.x = gx; o.glyph.y = r.y + r.h / 2 - gs / 2; o.glyph.focHide = true;
  o.rest.x = lx; o.foc.x = fx; o.label.y = top + lhL / 2;
  o.tz = lines.length ? {lines, f: tf, px: dv.sec, x: lx, fx, ys: lines.map((_, i) => top + lhL + 4 + lhT * (i + 0.5)), align: "left", w: Math.max(...lines.map((s) => W(c, tf, s))), col: TZ} : null;
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
  return {rows, foot, verbs};
}

const canCap = (c) => mOf(c) === c;
function text(c, s, x, y, f, col, align) { c.font = f; c.fillStyle = col; c.textAlign = align || "left"; c.textBaseline = "middle"; c.fillText(s, x, y); }
function paintRow(c, o, tok, ph, foc) {
  const r = o.r, dv = DEV[ph ? "p" : "d"];
  if (o.k === "main") {
    key(c, r.x, r.y, r.w, r.h, "main", {tok, ring: foc});
    if (foc) focusBomb(c, r.x + 8, r.y + r.h / 2, dv.bombs);
    text(c, o.word.s, foc ? o.word.foc : o.word.rest, o.word.y, o.word.f, CONST.yelInk);
    if (o.tag) o.tag.lines.forEach((q, i) => text(c, q, o.tag.x, o.tag.ys[i], o.tag.f, CONST.yelInk, "right"));
    if (o.cap && canCap(c)) cap(c, o.cap.x, o.cap.y, o.cap.s, {main: true, tok, phone: ph});
    return;
  }
  key(c, r.x, r.y, r.w, r.h, "key", {tok, ring: foc});
  if (foc) { band(c, r.x, r.y, r.w, r.h, tok); focusBomb(c, r.x + 8, r.y + r.h / 2, dv.bombs); }
  text(c, o.label.s, foc ? o.foc.x : o.rest.x, o.label.y, o.label.f, o.label.col);
  if (o.tz) o.tz.lines.forEach((s, i) => text(c, s, o.tz.align === "left" && foc ? o.tz.fx : o.tz.x, o.tz.ys[i], o.tz.f, o.tz.col, o.tz.align));
  if (!(foc && o.glyph.focHide)) glyph(c, o.glyph.n, o.glyph.x, o.glyph.y, o.glyph.s, CONST.t2);
}
const rp = (c, x, y, w, h, r) => { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
function paintFoot(c, P, tok) {
  const {x, y, w, h} = P, rr = (x0, y0, w0, h0, r0, col) => { c.fillStyle = col; c.beginPath(); rp(c, x0, y0, w0, h0, r0); c.fill(); };
  rr(x, y + 4, w, h, 8, CONST.ol); rr(x, y, w, h, 8, CONST.ol); rr(x + 2, y + 2, w - 4, h - 4, 6, tok.bed);
  c.fillStyle = tok.keyhi; c.fillRect(x + 6, y + 2, w - 12, 2);
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
  const u = G.u, d = G.d, b = (r) => [r.x * u, r.y * u, r.w * u, r.h * u], ph = G.mode === "phone", tok = worldTokens(ui.level);
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
    txt(o.label.s, f ? o.foc.x : o.rest.x, o.label.y, o.label.w, o.label.px, o.label.col, "primary");
    if (o.tz) o.tz.lines.forEach((s, i) => { const x = o.tz.align === "left" ? (f ? o.tz.fx : o.tz.x) : o.tz.x - o.tz.w; txt(s, x, o.tz.ys[i], o.tz.w, o.tz.px, o.tz.col, "secondary"); });
    if (!(f && o.glyph.focHide)) {
      const g = o.glyph, pad = 6, bx = R(Math.max(r.x + 2, g.x - pad), g.y - pad, g.s + 2 * pad, g.s + 2 * pad);
      probe.pair("info", b(R(g.x, g.y, g.s, g.s)), b(bx), {col: CONST.t2, name: l + " " + g.n});
    }
  }
  const k = d.rows[foc], x0 = d.kind[foc] === "tile" && k.x > d.rows[G.order[0]].x ? k.x - GAP + 1 : d.plate.x + 1, bed = R(x0, k.y, Math.max(1, k.x - 7 - x0), k.h);
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

let probeDoc = null, probeOK = false;
function canMake() {
  if (typeof OffscreenCanvas === "function") return true;
  const d = typeof document !== "undefined" ? document : null;
  if (!d || typeof d.createElement !== "function") return false;
  if (d !== probeDoc) { probeDoc = d; const el = d.createElement("canvas"); probeOK = !!el && typeof el.getContext === "function"; }
  return probeOK;
}
const outer = (d) => R(d.plate.x - d.T - 2, d.plate.y - d.T - 2, d.plate.w + 2 * d.T + 4, d.plate.h + 2 * d.T + 5);
const FIELDS = ["level", "look", "pages", "daily", "best", "rev", "note", "pad"];
function same(S, G, ui, w, touchy, dpr, ts, c, tap) {
  if (!S || S.G !== G || S.w !== w || S.touch !== touchy || S.dpr !== dpr || S.ts !== ts || S.c !== c || S.tap !== tap) return false;
  for (const k of FIELDS) if (S.ui[k] !== ui[k]) return false;
  const a = S.ui.run || {}, b = ui.run || {};
  return a.heat === b.heat && a.pace === b.pace && a.pact === b.pact && a.time === b.time;
}
function sizes(S, G, F, level, tok) {
  const d = G.d, u = G.u, dpr = S.dpr, P = S.P, ob = outer(d), pb = sc(ob, u), id = [level, G.mode, ...FIELDS.map((k) => S.ui[k]), J(S.ui.run || {}), S.w.dev, S.w.ok, S.w.move, S.tap].join("|");
  const K = {biome: tok.name, level, W: F.W, H: F.H, look: "2d", textScale: S.ts, dpr};
  S.ob = ob; S.pb = pb; S.pw = Math.round(pb.w * dpr); S.ph = Math.round(pb.h * dpr); S.plateKey = {...K, layer: "menu.plate|" + id}; S.plateK = keyOf(S.plateKey);
  let bytes = S.pw * S.ph * 4;
  S.feet = P.verbs.map((v) => { const fp = P.foot[v], fr = R(fp.x - 1, fp.y - 1, fp.w + 2, fp.h + 6), b = sc(fr, u), w = Math.round(b.w * dpr), h = Math.round(b.h * dpr), key = {...K, layer: "menu.foot|" + v + "|" + id}; bytes += w * h * 4; return {v, fp, fr, b, w, h, key, k: keyOf(key)}; });
  S.rd = +Math.max(0.5, Math.min(dpr, Math.sqrt(Math.max(0, BUDGET - RESERVE - bytes) / (4 * F.W * F.H)))).toFixed(3);
  S.box = {w: F.W, h: F.H};
  S.roomK = keyOf({layer: "room", biome: tok.name, level, W: F.W, H: F.H, dpr: S.rd, look: "2d", textScale: 1});
}
const J = JSON.stringify;
export const _dbg = {plans: 0, last: null};
let S = null;
function paintPlate(g, G, P, tok) {
  const d = G.d, ph = G.mode === "phone";
  plate(g, d.plate.x, d.plate.y, d.plate.w, d.plate.h, tok, {phone: ph});
  for (const l of G.order) paintRow(g, P.rows[l], tok, ph, false);
}
/** Paints MENU on c (#sh's context, or #c's when there is no shell box) for the frame F; see the header for ui. */
export function drawMenuPage(c, F, ui, t = 0) {
  const level = ui.level | 0 || 1, tok = worldTokens(level), G = menuGeom(F, ui.rows || MENU_ROWS), u = G.u, words = hints(), ts = textScale(), touchy = !!F.touch;
  const dev = deviceScale(c), dpr = capDpr(dev, touchy), tap = tapMode(touchy);
  if (!same(S, G, ui, words, touchy, dpr, ts, c, tap)) {
    S = {G, w: words, touch: touchy, dpr, ts, c, tap, ui: {...ui}, P: plan(c, Object.assign(Object.create(G), {touch: touchy}), ui), room: null, plate: null, foot: {}};
    sizes(S, G, F, level, tok);
    _dbg.plans++;
  }
  const P = S.P, d = G.d, ph = G.mode === "phone", a = Math.max(0, Math.min(1, (ui.enterT == null ? 1 : ui.enterT) / 0.25)), a0 = typeof c.globalAlpha === "number" ? c.globalAlpha : 1;
  const verb = G.mode === "desk" ? (P.verbs.length > 1 ? (ui.focus === G.order[0] ? M.START : ui.focus === SOURCE && P.verbs.includes(M.SOURCE_PAD) ? M.SOURCE_PAD : M.OPEN) : "") : null;
  const foc = P.rows[ui.focus] ? ui.focus : G.order[0];
  _dbg.last = {G, P, foc, verb, S};
  if (typeof c.clip !== "function" || typeof c.rect !== "function") return;
  if (canMake()) {
    if (!S.room || !S.room.width) S.room = roomLayer(S.box, level, tok, {dpr: S.rd, look: "2d", textScale: 1});
    else touch(S.roomK);
    if (!S.plate || !S.plate.width) S.plate = layer(S.plateKey, S.pw, S.ph, (g) => { g.scale(dpr * u, dpr * u); g.translate(-S.ob.x, -S.ob.y); paintPlate(g, G, P, tok); });
    else touch(S.plateK);
    for (const q of S.feet) {
      if (!S.foot[q.v] || !S.foot[q.v].width) S.foot[q.v] = layer(q.key, q.w, q.h, (g) => { g.scale(dpr * u, dpr * u); g.translate(-q.fr.x, -q.fr.y); paintFoot(g, q.fp, tok); });
      else touch(q.k);
    }
    c.save(); c.imageSmoothingEnabled = true; c.drawImage(S.room, 0, 0, F.W, F.H); c.restore();
    c.save(); c.globalAlpha = a0 * a; c.imageSmoothingEnabled = true; c.drawImage(S.plate, S.pb.x, S.pb.y, S.pb.w, S.pb.h);
    const q = verb != null && S.feet.find((f) => f.v === verb);
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
  drawLogo2d(c, {level, place: "menu", box: G.lbox, k: G.lk, dpr: dev, css: F.css > 0 ? F.css : 1, touch: touchy, t, reduced: !!ui.reduced});
  c.restore();
  c.scale(u, u);
  paintRow(c, P.rows[foc], tok, ph, true);
  c.restore();
  c.globalAlpha = a0;
  if (probe.probe.on) record(G, P, {...ui, level}, foc, dpr, F.shell ? "sh" : "c", verb, touchy);
}
