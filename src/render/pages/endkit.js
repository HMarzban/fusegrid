/* END KIT: the parts WIN (endwin.js) and GAME OVER (endlose.js) are built from (UI upgrade v202 Tasks 5.3 / 5.4; appendix 7.1 and 10; the round 7
   E7-end frames). Lazy with them. Every part draws through a PEN in design px (the mock's CSS px) with the plate's bed top-left at 0, 0; the page sets
   one transform (the plate's box position, then u box units per design px), so the kit painters run at their own design sizes.
   pen = {c, m, P, u, rec}: c the context painted on (null = record only), m the context text is measured on (always the target: measure memoizes
   on it), P the plate rect in box units and u its scale (probe records go to box units through them), rec true while the kit probe is on.
   A page paints its static parts once into a kit cache layer (pen with rec off) and records them every frame with c null, so a steady frame paints
   the blit and the live parts only. No filters: the soft parts are gradients. A colour is a token or a CONST, never a new hex but the few the
   appendix names (the warm core #fff3b0, char and soot #15181f / #07080b / #3a302c, the medal disc #1e1216). */
import {END_WORDS as EW} from "../words.js";
import {CONST, rgba} from "../kit/tokens.js";
import {key, cap, capW, glyph, focusBomb} from "../kit/paint.js";
import {T, DEV, measure, textScale} from "../kit/type.js";
import * as probe from "../kit/probe.js";
import {layer, canMake} from "../kit/cache.js";
import {deviceScale} from "../logo/draw2d.js";
import {hints, tapMode} from "../hintcopy.js";
import {pieceWidth, ledgerStacked, tokensOf, RULE_L, END} from "./endgeom.js";
import {drawEnemyBody} from "../enemybody.js";
import {drawItemBody} from "../itemdraw.js";
import {FOES, POWER} from "../../core/entities.js";

export const CAP_K = 0.705, WARM = "#fff3b0", DISC = "#1e1216";
const OL = CONST.ol;
export function pen(c, m, P, u, rec) { return {c, m, P, u, rec: !!rec && probe.probe.on, t: {k: 1, x: 0, y: 0}}; }
/* a part scaled k about (cx, cy): the context's transform (the caller sets it) and the record's, so the probe sees what is drawn */
export const scaledPen = (p, cx, cy, k) => ({...p, t: {k: p.t.k * k, x: p.t.x + p.t.k * cx * (1 - k), y: p.t.y + p.t.k * cy * (1 - k)}});
const bx = (p, x, y, w, h) => { const t = p.t; return [p.P.x + (t.x + t.k * x) * p.u, p.P.y + (t.y + t.k * y) * p.u, Math.max(0.01, w * t.k * p.u), Math.max(0.01, h * t.k * p.u)]; };
export const rrect = (p, name, x, y, w, h, o) => { if (p.rec) probe.rect(name, ...bx(p, x, y, w, h), o); };
export const rpair = (p, kind, a, b, o) => { if (p.rec) probe.pair(kind, bx(p, ...a), bx(p, ...b), o && Array.isArray(o.floor) ? {...o, floor: bx(p, ...o.floor)} : o); }; // a locked pair's floor cell is design px too
const FONT = {display: T.display, label: T.label, body: T.body, num: T.num};
/* one string: face display | label | body | num, at px design px; o.align (left), o.col, o.role (primary), o.outline (display: the kit's raised recipe) */
export function text(p, face, s, x, y, px, o = {}) {
  const font = FONT[face](px), w = measure(p.m, font, String(s)), al = o.align || "left", x0 = al === "center" ? x - w / 2 : al === "right" ? x - w : x;
  const col = o.col || (face === "body" ? CONST.t2 : CONST.ink), K = textScale(), capH = px * K * CAP_K;
  if (p.c) {
    const c = p.c;
    c.font = font; c.textAlign = al; c.textBaseline = "middle";
    if (face === "display" && o.outline) { const em = px * K; c.lineJoin = "round"; c.lineWidth = em * 0.12; c.strokeStyle = OL; c.fillStyle = OL; c.strokeText(String(s), x, y + em * 0.08); c.fillText(String(s), x, y + em * 0.08); c.strokeText(String(s), x, y); }
    c.fillStyle = col; c.fillText(String(s), x, y);
  }
  if (p.rec) probe.text(String(s), ...bx(p, x0, y - capH / 2, w, capH), {role: o.role || "primary", col, ...(face === "body" || o.role === "body" ? {px: px * K * p.u * p.t.k} : {})});
  return w;
}
export const textW = (p, face, s, px) => measure(p.m, FONT[face](px), String(s));
/* the first candidate that fits w at px (a claim's candidates are whole statements, never a cut one), else the last */
export const fitOf = (p, face, cands, px, w) => [].concat(cands).find((s) => textW(p, face, s, px) <= w) || [].concat(cands).pop();
/* greedy word wrap at w, measured */
export function wrap(p, face, s, px, w) {
  const out = [];
  let line = "";
  for (const word of tokensOf(s)) { const t = line ? line + " " + word : word; if (line && textW(p, face, t, px) > w) { out.push(line); line = word; } else line = t; }
  if (line) out.push(line);
  return out;
}

/* a pressable key, label first and keycap last (appendix 3): kind main | key; o.cap the keycap word (none in tap mode), o.sub a second line in
   yelInk (TRY AGAIN's board line), o.big the display face, o.phone, o.center (the phone dock's centred legend). The bomb's place at the key start
   is kept clear (the focused key's bare bomb draws live on top, focusKey). Records the key (touch, its set, the yellow fill). */
export function keyPart(p, name, r, kind, label, o = {}) {
  const d = DEV[o.phone ? "p" : "d"], tok = o.tok, main = kind === "main", px = o.big ? (o.phone ? 26 : 28) : d.pri;
  if (p.c) key(p.c, r.x, r.y, r.w, r.h, kind, {tok, phone: o.phone});
  const face = o.big ? "display" : "label", lx = r.x + (main ? 8 + d.bombs + 12 : 16), ink = main ? CONST.yelInk : CONST.ink, cy = r.y + r.h / 2;
  const ln = Array.isArray(o.lines) ? o.lines : null; // a label broken once at a space (endgeom G.lines: a touch row too narrow for it whole)
  const lw = Math.max(ln ? Math.max(...ln.map((s) => textW(p, face, s, px))) : textW(p, face, label, px), o.sub ? textW(p, "label", o.sub, d.sec) : 0), cw0 = o.cap ? capW(p.m, o.cap, {phone: o.phone}) : 0;
  /* a key too narrow for its label and its keycap keeps the label (the keycap is a hint the label does not need) */
  if (o.cap && lx + lw + 14 + cw0 > r.x + r.w - 12) o = {...o, cap: null};
  const cw = o.cap ? cw0 : 0, room = r.x + r.w - (o.cap ? cw + 14 : 12) - lx;
  if (o.sub) {
    const sp = d.sec, cx = o.center ? lx + room / 2 : lx, al = o.center ? "center" : "left";
    text(p, face, label, cx, cy - sp * 0.62, px, {col: ink, align: al});
    text(p, "label", o.sub, cx, cy + px * 0.5, sp, {col: CONST.yelInk, align: al, role: "secondary"});
  } else if (ln) { const lh = px * textScale() * 1.05; ln.forEach((s, i) => text(p, face, s, o.center ? lx + room / 2 : lx, cy + (i - (ln.length - 1) / 2) * lh, px, {col: ink, align: o.center ? "center" : "left"})); }
  else text(p, face, label, o.center ? lx + room / 2 : lx, cy, px, {col: ink, align: o.center ? "center" : "left"});
  if (o.cap) {
    const cx = r.x + r.w - cw - 12, cyy = r.y + (r.h - d.caph) / 2;
    if (p.c) cap(p.c, cx, cyy, o.cap, {tok, phone: o.phone, main});
    if (p.rec) { rrect(p, name + " cap", cx, cyy, cw, d.caph); probe.text(o.cap, ...bx(p, cx + 10, cyy + d.caph / 2 - d.sec * textScale() * CAP_K / 2, cw - 20, d.sec * textScale() * CAP_K), {role: "secondary", col: main ? CONST.yel : CONST.t2}); }
  }
  rrect(p, name, r.x, r.y, r.w, r.h, {touch: true, set: "end", fill: main ? CONST.yel : tok.key});
}
/* the focused key (appendix 5), live over the blit: the bare bomb at its start and the 3 px cream ring at offset 3; the band and ring pairs for the
   gates (o.rest: an unfocused part's zone of the same size, o.bed: the bed beside the ring) */
export function focusKey(p, r, o = {}) {
  const d = DEV[o.phone ? "p" : "d"], c = p.c;
  if (c) {
    focusBomb(c, r.x + 8, r.y + r.h / 2, d.bombs);
    const x = r.x - 4.5, y = r.y - 4.5, w = r.w + 9, h = r.h + 9, q = 10.5;
    c.strokeStyle = CONST.ink; c.lineWidth = 3; c.beginPath();
    c.moveTo(x + q, y); c.arcTo(x + w, y, x + w, y + h, q); c.arcTo(x + w, y + h, x, y + h, q); c.arcTo(x, y + h, x, y, q); c.arcTo(x, y, x + w, y, q); c.closePath(); c.stroke();
  }
  rrect(p, "focus", r.x, r.y, r.w, r.h, {focus: true});
  if (o.rest) rpair(p, "band", [r.x - 6, r.y - 6, r.w + 12, r.h + 12], o.rest, {name: "focus band vs rest"});
  if (o.bed) rpair(p, "ring", [r.x - 6, r.y - 6, r.w + 12, r.h + 12], o.bed, {name: "focus ring vs plate"});
}

/* a stat card: a sunk floor slab (well), the glyph in a raised wall-block socket, label t2 over the value in the HUD face (appendix 7.1, 10) */
const FOE = {type: "walker", color: FOES[0].col, r: 14, home: {x: 0, y: 0}, invuln: false}, ITEM = {t: POWER[0].t, col: POWER[0].col, x: 0, y: 0}, W0 = {time: 0}, X0 = {a: 1, gl: 0, fl: 0, bl: null};
export function statGlyph(c, kind, cx, cy, s) {
  c.save(); c.translate(cx, cy);
  if (kind === "foe") { c.scale(s / 30, s / 30); drawEnemyBody(c, W0, FOE, X0); }
  else if (kind === "item") { const k = (s * 1.43) / 40; c.scale(k, k); drawItemBody(c, W0, ITEM, 1, null); }
  else { c.strokeStyle = CONST.t2; c.lineWidth = s * 0.11; c.lineCap = "round"; c.beginPath(); c.arc(0, 0, s * 0.4, 0, 7); c.moveTo(0, -s * 0.24); c.lineTo(0, 0); c.lineTo(s * 0.17, s * 0.1); c.stroke(); }
  c.restore();
}
export function statTile(p, name, r, st, o = {}) {
  const d = DEV[o.phone ? "p" : "d"], tok = o.tok, [g, label, value] = st;
  if (p.c) key(p.c, r.x, r.y, r.w, r.h, "well", {tok});
  rrect(p, name, r.x, r.y, r.w, r.h);
  const so = Math.min(r.h - 16, (o.L || 14.8) * 2.7), sx = r.x + 8, sy = r.y + (r.h - so) / 2;
  if (p.c) { key(p.c, sx, sy, so, so, "key", {tok}); statGlyph(p.c, g, sx + so / 2, sy + so / 2, so * 0.62); }
  rpair(p, "info", [sx + so * 0.15, sy + so * 0.1, so * 0.7, so * 0.68], [sx + so + 3, sy + 4, 6, so - 8], {col: g === "foe" ? FOES[0].col : g === "item" ? POWER[0].col : CONST.t2, name: name + " glyph"}); // b: the slab's well beside the socket
  const tx = sx + so + 12, K = textScale();
  text(p, "label", label, tx, r.y + r.h / 2 - d.hud * K * 0.45, d.sec, {col: CONST.t2, role: "secondary"});
  text(p, "num", value, tx, r.y + r.h / 2 + d.sec * K * 0.55, d.hud, {role: "hud"});
}
/* the phone's tally: one ledger row in a well, "LABEL value" thirds */
export function ledger(p, r, stats, o = {}) {
  if (ledgerStacked(stats, END.p, r.w, p.m)) {
    const lh = (r.h - 10) / stats.length;
    if (p.c) key(p.c, r.x, r.y, r.w, r.h, "well", {tok: o.tok});
    rrect(p, "tally", r.x, r.y, r.w, r.h);
    stats.forEach(([, label, value], i) => { const y = r.y + 5 + lh * (i + 0.5); text(p, "label", label, r.x + 10, y, DEV.p.sec, {col: CONST.t2, role: "secondary"}); text(p, "num", value, r.x + r.w - 10, y, DEV.p.sec + 2, {align: "right", role: "secondary"}); });
    return;
  }
  const d = DEV.p, ws = stats.map(([, label, value]) => textW(p, "label", label, d.sec) + 6 + textW(p, "num", value, d.sec + 2)), tot = ws.reduce((a, b) => a + b, 0);
  const sp = stats.length > 1 ? Math.max(8, (r.w - 16 - tot) / (stats.length - 1)) : 0;
  if (p.c) key(p.c, r.x, r.y, r.w, r.h, "well", {tok: o.tok});
  rrect(p, "tally", r.x, r.y, r.w, r.h);
  let x = r.x + 8;
  stats.forEach(([, label, value], i) => {
    const lw = text(p, "label", label, x, r.y + r.h / 2, d.sec, {col: CONST.t2, role: "secondary"});
    text(p, "num", value, x + lw + 6, r.y + r.h / 2, d.sec + 2, {role: "secondary"});
    x += ws[i] + sp;
  });
}

/* a course cell (appendix 7.1, 10): won (lit brick + a check notch cut top-right; a finale cell carries the medal octagon), clear (lit), crack (lit +
   the dark split, fractures, chipped corner and soot), ahead (a floor well, its number t2, a finale's flag), locked (wall + lock). s = the cell size */
const CHECK = (c, x, y, s, col) => { c.strokeStyle = col; c.lineWidth = s * 0.18; c.lineCap = c.lineJoin = "round"; c.beginPath(); c.moveTo(x + s * 0.18, y + s * 0.53); c.lineTo(x + s * 0.38, y + s * 0.72); c.lineTo(x + s * 0.82, y + s * 0.26); c.stroke(); };
export function oct(c, cx, cy, r, sw, o = {}) {
  const pts = Array.from({length: 8}, (_, i) => { const a = ((i * 45 + 22.5) * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
  const path = () => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
  c.lineJoin = "miter";
  if (o.disc) { path(); c.fillStyle = o.disc; c.fill(); }
  path(); c.strokeStyle = OL; c.lineWidth = sw + 4; c.stroke();
  path(); c.strokeStyle = o.col || CONST.medal; c.lineWidth = sw; c.stroke();
  if (o.dot) { c.beginPath(); c.arc(cx, cy, o.dot, 0, 7); c.fillStyle = o.col || CONST.medal; c.fill(); c.lineWidth = 2; c.strokeStyle = OL; c.stroke(); }
}
const LOCK = (c, cx, cy, s, col) => { c.fillStyle = c.strokeStyle = col; c.lineWidth = s * 0.14; c.beginPath(); c.arc(cx, cy - s * 0.1, s * 0.22, Math.PI, 0); c.stroke(); c.fillRect(cx - s * 0.32, cy - s * 0.08, s * 0.64, s * 0.46); };
function crack(c, x, y, s) {
  const k = s / 36, P = (pts) => pts.map(([a, b]) => [x + a * k, y + b * k]), line = (pts, col, w, cap = "square") => { c.strokeStyle = col; c.lineWidth = w * k; c.lineCap = cap; c.lineJoin = "miter"; c.beginPath(); P(pts).forEach(([a, b], i) => (i ? c.lineTo(a, b) : c.moveTo(a, b))); c.stroke(); };
  const g = c.createLinearGradient(x, y + 14 * k, x, y + s);
  if (g && typeof g.addColorStop === "function") { g.addColorStop(0, rgba("#15181f", 0)); g.addColorStop(1, rgba("#15181f", 0.35)); c.fillStyle = g; c.fillRect(x, y + 14 * k, s, s - 14 * k); }
  c.fillStyle = OL; c.beginPath(); P([[0, 0], [12, 0], [0, 11]]).forEach(([a, b], i) => (i ? c.lineTo(a, b) : c.moveTo(a, b))); c.closePath(); c.fill();
  line([[12, 0], [0, 11]], "rgba(255,255,255,0.5)", 1.2, "butt");
  line([[16.6, 0], [10.6, 10], [16.4, 19], [9.6, 28], [13.6, 36]], "rgba(255,255,255,0.55)", 1.3, "butt");
  line([[14, 0], [8, 10], [14, 19], [7, 28], [11, 36]], OL, 4.6);
  line([[8, 10], [3, 14]], OL, 2.4, "round"); line([[7, 28], [2.5, 31]], OL, 2.2, "round");
}
export function cell(p, x, y, s, cl, o = {}) {
  /* a cell smaller than the device's (a paged column) keeps its number in proportion (Task 9.8: a digit as big as a full cell's fills a small
     one, and the lit / well pair loses its contrast), never under the secondary cap floor */
  const px0 = o.phone ? 15 : 17, px = Math.min(px0, Math.max((px0 * s) / END[o.phone ? "p" : "d"].cell, ((o.phone ? 9 : 11) + 0.1) / (CAP_K * textScale())));
  const c = p.c, tok = o.tok, kind = cl.st === "ahead" ? "well" : cl.st === "locked" ? "wall" : "lit", n = String(cl.n);
  if (c) {
    key(c, x, y, s, s, kind, {tok});
    const ty = kind === "lit" ? y - 2 : y;
    if (cl.st === "crack") { const g = cl.grow == null ? 1 : Math.max(0, Math.min(1, cl.grow)); c.save(); c.beginPath(); c.rect(x + 2, ty + 2, s - 4, (s - 4) * g); c.clip(); crack(c, x + 2, ty + 2, s - 4); c.restore(); } // grow: a crack stroking in, top down (GAME OVER 0.8-1.0 s)
    if (cl.st === "won") { const q = s * 0.44; c.fillStyle = OL; c.beginPath(); c.moveTo(x + s - q, ty); c.lineTo(x + s, ty); c.lineTo(x + s, ty + q); c.closePath(); c.fill(); CHECK(c, x + s - q * 0.62, ty + q * 0.02, q * 0.6, CONST.ink); }
    if (cl.st === "locked") LOCK(c, x + s / 2, y + s / 2, s * 0.42, CONST.off);
    else if (cl.fin && cl.st === "won") oct(c, x + s * 0.76, ty + s * 0.62, s * 0.13, Math.max(1.5, s * 0.05), {col: CONST.dk});
    else if (cl.fin && cl.st === "ahead") glyph(c, "flag", x + s * 0.6, y + s * 0.32, s * 0.32, CONST.ink); // cream: >= 4.5:1 on every world's well (t2 read 4.26 on ARENA)
  }
  if (cl.fin && cl.st === "ahead") rpair(p, "info", [x + s * 0.6, y + s * 0.32, s * 0.32, s * 0.32], [x + 3, y + 3, s - 6, s - 6], {col: CONST.ink, name: "finale flag"});
  /* the marks a player reads on a course, each over its own ground (2026-11-14: a world-8 finale or a death on level 8 drew no other non-text mark,
     so the info gate had nothing to measure): a won cell's check on its notch, the crack on the level fallen against the cell's face */
  { const q = s * 0.44, ty = kind === "lit" ? y - 2 : y;
    if (cl.st === "won") rpair(p, "info", [x + s - q * 0.62, ty + q * 0.02, q * 0.6, q * 0.6], [x + s - q * 0.5, ty, q * 0.5, q * 0.5], {col: CONST.ink, name: "check notch"});
    if (cl.st === "crack" && (cl.grow == null || cl.grow >= 1)) rpair(p, "info", [x + 2 + (s - 4) * 7 / 36, ty + 2, (s - 4) * 10 / 36, s - 4], [x + 2 + (s - 4) * 0.62, ty + s * 0.3, (s - 4) * 0.3, s * 0.4], {col: OL, name: "crack"}); }
  const ty = kind === "lit" ? y - 2 : y, nx = cl.st === "crack" ? x + s / 2 + 7 * (s / 40) : cl.fin && cl.st !== "locked" ? x + s * 0.32 : x + s / 2;
  if (cl.st !== "locked") text(p, "num", n, nx, ty + s / 2, px, {align: "center", col: kind === "lit" ? CONST.dk : CONST.t2, role: "secondary"});
  rrect(p, "cell " + n + (cl.st === "locked" ? " locked" : cl.st === "ahead" ? " ahead" : ""), x, y, s, s); // a locked or not-reached level is named so (tools/ui screens.mjs exemptIfNo)
}
export function course(p, x, y, s, gap, cells, o = {}) {
  cells.forEach((cl, i) => cell(p, x + i * (s + gap), y, s, cl, o));
  return cells.length * s + (cells.length - 1) * gap;
}

/* the shelf (appendix 10.3 step 5): a wall course 0.9 L tall, outlined, hard drop; pieces hang 0.5 L under it from hook studs */
export function shelf(p, x, y, w, L, o = {}) {
  if (p.c) key(p.c, x, y, w, 0.9 * L, "wall", {tok: o.tok});
  rrect(p, "shelf", x, y, w, 0.9 * L);
}
const hook = (c, cx, y, L, tok) => { const s = 0.6 * L; c.fillStyle = OL; c.fillRect(cx - s / 2 - 2, y - 2, s + 4, s + 4); c.fillStyle = tok.wall; c.fillRect(cx - s / 2, y, s, s); };
/* a ribbon: the world's brick lit two-tone, 2 px outline, no drop; NEW BEST / the record's name / the value at 1.6 L; two swallowtails splayed 10 degrees.
   ribbonW measures it (at least 9 L wide). x y its top-left; the hook stud sits on its top centre */
export function ribbonW(p, piece, L, ph) {
  const d = DEV[ph ? "p" : "d"], vpx = (1.6 * L) / 0.72, pad = ph ? 9 : 16;
  return Math.max(9 * L, textW(p, "label", EW.NEW_BEST, d.sec) + 2 * pad, textW(p, "label", piece.name, d.pri) + 2 * pad, textW(p, "num", piece.value || "", vpx) + 2 * pad);
}
export function ribbon(p, x, y, w, h, piece, L, o = {}) {
  const c = p.c, tok = o.tok, d = DEV[o.phone ? "p" : "d"], vpx = (1.6 * L) / 0.72, tw = 1.6 * L, tl = 1.4 * L, nv = 0.6 * L, apart = 1.2 * L;
  if (c) {
    for (const [dx, rot] of [[-apart / 2, 10], [apart / 2, -10]]) {
      const x0 = x + w / 2 + dx;
      c.save(); c.translate(x0, y + h - 4); c.rotate((rot * Math.PI) / 180);
      c.beginPath(); c.moveTo(-tw / 2, 0); c.lineTo(tw / 2, 0); c.lineTo(tw / 2, tl); c.lineTo(0, tl - nv); c.lineTo(-tw / 2, tl); c.closePath();
      c.fillStyle = tok.lit2; c.fill(); c.lineWidth = 2; c.lineJoin = "round"; c.strokeStyle = OL; c.stroke(); c.restore();
    }
    c.fillStyle = OL; c.fillRect(x, y, w, h);
    c.fillStyle = tok.lit2; c.fillRect(x + 2, y + 2, w - 4, h - 4);
    c.fillStyle = tok.lit; c.fillRect(x + 2, y + 2, w - 4, (h - 4) * 0.5);
    c.fillStyle = tok.lithi; c.fillRect(x + 5, y + 5, w - 10, 3);
    c.fillStyle = tok.lip; c.fillRect(x + 2, y + h - 6, w - 4, 4);
    hook(c, x + w / 2, y - 0.6 * L, L, tok);
  }
  const cx = x + w / 2, top = y + (o.phone ? 7 : 8), K = textScale();
  if (piece.kind === "more") text(p, "label", piece.name, cx, y + h / 2, d.pri, {align: "center", col: CONST.dk});
  else {
    text(p, "label", EW.NEW_BEST, cx, top + d.sec * K * 0.6, d.sec, {align: "center", col: CONST.yelInk, role: "secondary"});
    text(p, "label", piece.name, cx, top + d.sec * K * 1.2 + 3 + d.pri * K * 0.6, d.pri, {align: "center", col: CONST.dk});
    text(p, "num", piece.value, cx, top + d.sec * K * 1.2 + 6 + d.pri * K * 1.2 + vpx * K * 0.5, vpx, {align: "center", col: CONST.dk});
  }
  rrect(p, "ribbon " + (piece.name || ""), x, y, w, h);
}
/* a medal piece: the octagon outline (0.35 L yellow stroke over a dark outline, inner dot) 4 L across on a #1e1216 disc, from two brickB straps that
   meet at the hook stud; the name in cream and a NEW tag (an outline, never a yellow fill), the rule under it in body copy. Desk: stacked; phone:
   octagon left, words right. medalW measures it. */
export function medalW(p, piece, L, ph) {
  const d = DEV[ph ? "p" : "d"], nw = textW(p, "label", piece.name, d.pri) + 8 + textW(p, "label", EW.NEW, d.sec) + 26;
  const bw = Math.min(19 * L, Math.max(...wrap(p, "body", piece.desc, d.bod, 19 * L).slice(0, 2).map((s) => textW(p, "body", s, d.bod))));
  return ph ? 4 * L + 12 + Math.max(nw, bw) : Math.max(4 * L + 4, nw, bw);
}
export function medal(p, x, y, w, piece, L, o = {}) {
  const c = p.c, tok = o.tok, ph = !!o.phone, d = DEV[ph ? "p" : "d"], D = 4 * L, sw = 0.35 * L, sh = 1.2 * L, ox = ph ? x + D / 2 + 2 : x + w / 2, oy = y + sh + D / 2 + 2, K = textScale();
  if (c) {
    c.fillStyle = tok.lit2; c.strokeStyle = OL; c.lineWidth = 2; c.lineJoin = "round";
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(ox + s * 3, y); c.lineTo(ox + s * D * 0.24, y + sh + 4); c.lineTo(ox + s * (D * 0.24 - 0.55 * L), y + sh + 4); c.lineTo(ox - s, y + 2); c.closePath(); c.fill(); c.stroke(); }
    oct(c, ox, oy, D / 2 - sw / 2 - 1.5, sw, {disc: DISC, dot: 0.62 * L});
    hook(c, ox, y - 0.6 * L, L, tok);
  }
  rrect(p, "medal " + piece.name, ox - D / 2, y + sh, D, D);
  const tx = ph ? x + D + 12 : x + w / 2, al = ph ? "left" : "center", ny = ph ? y + sh + d.pri * K * 0.6 : oy + D / 2 + 8 + d.pri * K * 0.6;
  const nw = textW(p, "label", piece.name, d.pri), tagW = textW(p, "label", EW.NEW, d.sec) + 18, n0 = ph ? tx : tx - (nw + 8 + tagW) / 2;
  text(p, "label", piece.name, n0, ny, d.pri, {});
  const tgx = n0 + nw + 8, tgh = d.sec * K + 8;
  if (c) { c.fillStyle = OL; c.fillRect(tgx, ny - tgh / 2, tagW, tgh); c.strokeStyle = CONST.medal; c.lineWidth = 2; c.strokeRect(tgx + 1, ny - tgh / 2 + 1, tagW - 2, tgh - 2); }
  text(p, "label", EW.NEW, tgx + 9, ny, d.sec, {col: CONST.medal, role: "secondary"});
  wrap(p, "body", piece.desc, d.bod, Math.min(ph ? w - D - 12 : w, RULE_L * L)).slice(0, 2).forEach((s, i) => text(p, "body", s, tx, ny + d.pri * K * 0.6 + 6 + d.bod * K * (0.65 + 1.35 * i), d.bod, {align: al, role: "body"}));
}
export const pieceW = (p, piece, L, ph) => pieceWidth(piece, L, ph, p.m);

/* One end page frame. name the probe's page; G endGeom's; tok the room's tokens; o = {anim: paint live (the motion beats), A: the beat state the
   scene reads, alpha (the reduced-motion fade), key: what the page shows (its layer key)}; scene(pen, A) paints and records the static page in design
   px. At rest the page is one kit cache layer keyed by what it shows (made once, a hit every steady frame) and, under the probe, recorded with c null;
   while it moves, or with no canvas source (Node), it paints live. Returns the pen the live parts draw with (design px, the transform restored). */
const fnv = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };
export function frame(c, name, B, G, tok, o, scene) {
  const P = G.plate, u = G.u, dev = deviceScale(c), M = G.d.T + 4, a0 = typeof c.globalAlpha === "number" ? c.globalAlpha : 1, al = o.alpha == null ? 1 : o.alpha;
  if (probe.probe.on) { probe.begin(name, {w: B.w, h: B.h, dpr: dev, el: "c"}); probe.rect("plate", P.x, P.y, P.w, P.h, {plate: G.T}); }
  if (o.anim || !canMake() || typeof c.drawImage !== "function") {
    c.save(); c.translate(P.x, P.y); c.scale(u, u); c.globalAlpha = a0 * al;
    scene(pen(c, c, P, u, true), o.A);
    c.restore();
  } else {
    const pw = P.w / u + 2 * M, ph = P.h / u + 2 * M, W = Math.max(1, Math.ceil(pw * u * dev)), H = Math.max(1, Math.ceil(ph * u * dev));
    const L = layer({layer: name + ":" + fnv(o.key || ""), biome: tok.name, level: 0, W, H, dpr: +dev.toFixed(3), look: "", textScale: textScale()}, W, H, (g) => {
      g.scale(W / pw, H / ph); g.translate(M, M); scene(pen(g, g, P, u, false), null);
    });
    c.save(); c.globalAlpha = a0 * al; c.imageSmoothingEnabled = true; c.drawImage(L, P.x - M * u, P.y - M * u, pw * u, ph * u); c.restore();
    if (probe.probe.on) scene(pen(null, c, P, u, true), null);
  }
  return pen(c, c, P, u, true);
}
/* live parts in the plate's design px: f(pen) under the plate transform */
export function live(c, G, f) { const P = G.plate; c.save(); c.translate(P.x, P.y); c.scale(G.u, G.u); f(pen(c, c, P, G.u, true)); c.restore(); }
export const prefersReduced = () => { try { return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
export const ease = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

/* the keycap words for the device: none in tap mode (appendix 10.3 step 6; a controller on a touch layout keeps them), a controller's buttons by
   position, else the keys */
export function capsOf(touch) {
  const W = hints();
  if (tapMode(touch)) return {main: null, menu: null, copy: null, map: null};
  return W.dev === "pad" ? {main: W.ok, menu: W.back, copy: EW.CAP_COPY, map: EW.CAP_MAP} : {main: W.ok, menu: W.back, copy: "C", map: "B"};
}
/* the pager (endGeom on a short box): ▲ and ▼ keys (44 design px = 44 CSS px tall) either side of "page / pages"; r its row, G.keys.up / down */
export function pager(p, G, tok) {
  const r = G.rects.pager, ph = G.ph, d = DEV[ph ? "p" : "d"], dr = (q) => ({x: (q.x - G.plate.x) / G.u, y: (q.y - G.plate.y) / G.u, w: q.w / G.u, h: q.h / G.u});
  if (!r) return;
  const R = dr(r), up = dr(G.keys.up), dn = dr(G.keys.down), first = G.page === 0, last = G.page === G.pages - 1;
  for (const [n, q, gl, off] of [["up", up, "up", first], ["down", dn, "dn", last]]) {
    if (p.c) { key(p.c, q.x, q.y, q.w, q.h, off ? "well" : "key", {tok}); glyph(p.c, gl, q.x + q.w / 2 - 9, q.y + q.h / 2 - 9, 18, off ? CONST.off : CONST.ink); }
    rrect(p, n, q.x, q.y, q.w, q.h, {touch: true, set: "end"});
    if (!off) rpair(p, "info", [q.x + q.w / 2 - 9, q.y + q.h / 2 - 9, 18, 18], [q.x + 3, q.y + 3, q.w - 6, q.h - 6], {col: CONST.ink, name: "pager " + n}); // a live arrow is a mark that must read (a spent one is the well's off ink, quiet on purpose)
  }
  text(p, "label", G.page + 1 + " / " + G.pages, R.x + R.w / 2, R.y + R.h / 2, d.sec, {align: "center", col: CONST.t2, role: "secondary"});
}

/* the toast (appendix 7.1): a lit brick tag that drops 8 px from the plate top over 160 ms, holds, lifts; COPY FAILED on the coral danger key;
   reduced motion: it simply shows. t = seconds left of its TOAST_T life (1.5) */
export function toastTag(p, cx, top, toast, o = {}) {
  if (!toast || !toast.s) return;
  const d = DEV[o.phone ? "p" : "d"], age = 1.5 - (toast.t == null ? 1.5 : toast.t), drop = o.reduced ? 1 : Math.min(1, age / 0.16), lift = o.reduced ? 1 : Math.min(1, Math.max(0, (toast.t == null ? 1 : toast.t) / 0.16));
  const w = textW(p, "label", toast.s, d.sec) + 28, h = d.sec * textScale() + 14, y = top - 8 + 8 * drop * lift, a = Math.min(drop, lift);
  if (p.c) { const a0 = p.c.globalAlpha; p.c.globalAlpha = a0 * (o.reduced ? 1 : a); key(p.c, cx - w / 2, y, w, h, toast.ok ? "lit" : "dng", {tok: o.tok}); p.c.globalAlpha = a0; }
  text(p, "label", toast.s, cx, y + h / 2 - (toast.ok ? 2 : 0), d.sec, {align: "center", col: toast.ok ? CONST.dk : CONST.cor, role: "secondary"});
}
