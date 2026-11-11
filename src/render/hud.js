/* THE HUD (UI upgrade Task 8.2, round 5 09-hud on the K7 world kit; R2, R9). Seven labelled chips, LIVES BOMBS FLAME LEVEL ENEMIES TIME SCORE
   (words.js HUD_CHIPS), and the power-ups bar, drawn on #hud (fit.js hudGeo, viewport CSS px) off the board in every look, so no chip ever sits
   on board row 0 and the board canvases (#c, #px, #gl) draw no HUD at all.
     d  the chips in one row inside the world's rampart plate above the board (kit plate, T 10: the mock's data-t), the bar under the board.
     p  the chips on one four-column grid in the plate (LIVES BOMBS FLAME + the PAUSE slot over LEVEL ENEMIES TIME SCORE), the bar a two-column
        grid in the band under the board.
     l  one-line chips stacked in the side gutters (LIVES BOMBS FLAME LEVEL left above the power-ups, the PAUSE slot then ENEMIES TIME SCORE right).
   A chip is a pane (the world's pane, an ol band 4 px around and between) with its label (secondary, t2) over its value (the HUD size, nums: fixed
   digit cells) after its glyph; LIVES is up to five hearts, else one heart and the count (kit5 lives()); LEVEL carries the difficulty word only
   when it is not NORMAL; SCORE has thousands separators. Too wide for its slot, a chip steps down in order: hearts to heart + count, the value to
   its floor (cap 18 desktop / 11 phone), the label to its floor, the difficulty word dropped, then (l only) the label of a chip whose glyph names it.
   Glyphs are the look's own: PIXEL the atlas cells (hudart, once pixelArt() is registered), else the vector icons and the foe body.
   The bar lists the powers held now (fx abilityList order) and the ones a hit just took, dimmed and fading (ABAR.dim, ABAR.fade); THROW and
   REMOTE carry their key cap (the controller's button with a controller) on a desktop or portrait layout. A changed BOMBS / FLAME / LIVES value pulses a ring just inside its chip for LBL.pulse (fx
   getPulse), so two pulses never meet across the 4 px gap.
   createHud() is main's one call per frame: it paints only when what the HUD shows changed (hudState, the slots, the look), so an idle frame
   (PAUSE, a still TIME) makes no canvas call; the plate's ring is a kit cache layer. The probe records page "hud" while the world PLAYs. */
import {FOES, POWER} from "../core/entities.js";
import {CONST, worldTokens} from "./kit/tokens.js";
import {plate} from "./kit/paint.js";
import {T, DEV, measure, textScale} from "./kit/type.js";
import {layer, canMake, keyOf, touch as touchLayer} from "./kit/cache.js";
import * as P from "./kit/probe.js";
import {drawIcon} from "./icons.js";
import {drawEnemyBody} from "./sprites.js";
import {pixelArt, itemCell, foeCell, blitCell, opaqueBox} from "./hudart.js";
import {abilityText, getStrip, getPulse, LBL} from "./fx.js";
import {abilityChips, fmtTime} from "./scenes.js";
import {DIFF, HUD_CHIPS} from "./words.js";
import {hints} from "./hintcopy.js";

const deep = (o) => { for (const v of Object.values(o)) if (v && typeof v === "object") deep(v); return Object.freeze(o); };
/* cap / font px of the faces (system-ui at 800 for numbers, 700 for labels; the round 5 audit: 27 -> 20.1, 16 -> 11.27) */
export const CAPR = deep({num: 0.744, label: 0.704});
export const HUD = deep({
  d: {pad: 4, gap: 4, ch: 66, cx: 10, ct: 8, lg: 6, icon: 22, ig: 6, heart: 4, r: 5, hud: DEV.d.hud, sec: DEV.d.sec, floor: {hud: 24.2, sec: 15.7}, edge: 12, ring: 10,
    bar: {pad: 4, gap: 4, cx: 10, icon: 22, ig: 8, px: DEV.d.pri, floor: 15.7, capg: 8}},
  p: {pad: 4, gap: 4, ch: 57, cx: 10, ct: 8, lg: 6, icon: 20, ig: 6, heart: 4, r: 5, hud: DEV.p.hud, sec: DEV.p.sec, floor: {hud: 14.8, sec: 12.8}, ring: 10, pause: 72,
    bar: {pad: 4, gap: 4, row: 30, cx: 10, icon: 18, ig: 8, px: DEV.p.pri, floor: 12.8, capg: 8}},
  l: {pad: 4, gap: 4, ch: 30, cx: 8, icon: 18, ig: 6, heart: 3, r: 5, hud: DEV.p.hud, sec: DEV.p.sec, floor: {hud: 14.8, sec: 12.8}, pause: 44, bargap: 6, cell: 26, ci: 18},
});
const COL = deep({heart: "#ff3b5c", bomb: "#ff5d73", fire: "#ff8a3c"}), PCOL = Object.freeze(Object.fromEntries(POWER.map((q) => [q.t, q.col])));
const WALKER = FOES.find((f) => f.t === "walker") || FOES[0];
const REST = {time: 0}, FOE = {type: WALKER.t, color: WALKER.col, r: 14, home: {x: 3, y: 7}, invuln: false, dir: {x: 0, y: 1}};
const NAME = ["lives", "bombs", "flame", "level", "enemies", "time", "score"];
export const CHIP_NAMES = Object.freeze(NAME);
const LABEL = Object.fromEntries(NAME.map((n, i) => [n, HUD_CHIPS[i]]));
const commas = (n) => String(Math.max(0, n | 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const r3 = (v) => Math.round((+v || 0) * 1000) / 1000;

/* what the HUD shows, plain data: the change key and the painter's input */
export function hudState(world, o) {
  const p = (world.players && world.players[0]) || {}, tm = o && o.time, live = world.state === "PLAY" || world.state === "PAUSE", H = hints();
  const ab = live ? abilityChips(p, getStrip()).filter((e) => e.a > 0).map((e) => {
    const [s, m, col] = abilityText(e.k, p);
    return {k: e.k, a: r3(e.a), s, m, col, cap: e.k === "throw" ? H.throw : e.k === "remote" ? H.remote : ""};
  }) : [];
  const u = getPulse();
  return {lives: Math.max(0, world.lives | 0), bombs: p.bombs | 0, flame: p.range | 0, level: world.level | 0, heat: Math.max(0, Math.min(2, world.heat | 0)),
    enemies: Array.isArray(world.enemies) ? world.enemies.length : 0, time: fmtTime(tm ? tm.t : 0), score: world.score | 0,
    ab, pu: {b: r3(u.b), r: r3(u.r), l: r3(u.l)}, keys: H.dev === "key" || H.dev === "pad", play: world.state === "PLAY"};
}

const DIG = "0123456789";
function numW(c, s, px) {
  const f = T.num(px);
  let cell = 0, w = 0;
  for (const d of DIG) cell = Math.max(cell, measure(c, f, d));
  for (const q of String(s)) w += DIG.includes(q) ? cell : measure(c, f, q);
  return w;
}
/* a chip's value: parts left to right, {g: glyph, s: its size} | {n: digits, px} | {w: a word, px} */
function parts(name, st, f, L) {
  const ic = L.icon;
  if (name === "lives") return f.hearts && st.lives >= 1 && st.lives <= 5 ? Array.from({length: st.lives}, () => ({g: "heart", s: ic})) : [{g: "heart", s: ic}, {n: String(st.lives), px: f.hud}];
  if (name === "bombs") return [{g: "bomb", s: ic}, {n: String(st.bombs), px: f.hud}];
  if (name === "flame") return [{g: "fire", s: ic}, {n: String(st.flame), px: f.hud}];
  if (name === "level") return st.heat && f.diff ? [{n: String(st.level), px: f.hud}, {w: DIFF[st.heat], px: f.sec}] : [{n: String(st.level), px: f.hud}];
  if (name === "enemies") return [{g: "foe", s: ic + 2}, {n: String(st.enemies), px: f.hud}];
  if (name === "time") return [{n: st.time, px: f.hud}];
  return [{n: commas(st.score), px: f.hud}];
}
const partW = (c, q) => (q.g ? q.s : q.n != null ? numW(c, q.n, q.px) : measure(c, T.label(q.px), q.w));
function rowW(c, ps, L) {
  let w = 0;
  ps.forEach((q, i) => { w += partW(c, q) + (i ? (q.g === "heart" && ps[i - 1].g === "heart" ? L.heart : L.ig) : 0); });
  return w;
}
const labW = (c, name, f) => (f.nolab && f.nolab.includes(name) ? 0 : measure(c, T.label(f.sec), LABEL[name]));
/* the step-down ladder: each form a little smaller than the one before */
function forms(L, one) {
  const K = textScale(), hud = Math.min(L.hud, L.floor.hud / K), sec = Math.min(L.sec, L.floor.sec / K);
  const b = {hearts: true, diff: true, hud: L.hud, sec: L.sec}, out = [b, {...b, hearts: false}, {...b, hearts: false, hud}, {...b, hearts: false, hud, sec}, {hearts: false, diff: false, hud, sec}];
  if (one) out.push({...out[4], nolab: ["lives", "bombs", "flame", "enemies"]});
  return out;
}
const chipW = (c, name, st, f, L, one) => (one ? L.cx + labW(c, name, f) + (labW(c, name, f) ? 8 : 0) + rowW(c, parts(name, st, f, L), L) + L.cx : L.cx + Math.max(labW(c, name, f), rowW(c, parts(name, st, f, L), L)) + L.cx);

/* a power's key cap (THROW / REMOTE on a keyboard, or the controller button they are bound to): its width at the layout's secondary size */
const capPx = (lay) => DEV[lay === "d" ? "d" : "p"].sec;
const capWOf = (c, lay, s) => Math.max(28, Math.ceil(measure(c, T.label(capPx(lay)), s)) + 16);
/* the bar's items in a slot w wide (it may widen to max, centred): labels at px, else the floor, else glyphs only (with their caps); equal widths
   when every item fits its share */
function barItems(c, st, B, w, keys, max) {
  const n = st.ab.length;
  if (!n) return null;
  const capw = (it) => (keys && it.cap ? capWOf(c, "d", it.cap) + B.capg : 0);
  for (const [px, lim] of [[B.px, w], [B.floor, w], [B.px, max], [B.floor, max], [0, w]]) {
    const ws = st.ab.map((it) => B.cx + B.icon + (px ? B.ig + measure(c, T.label(px), it.m ? it.s + " " + it.m : it.s) : 0) + capw(it) + B.cx);
    const tot = ws.reduce((a, v) => a + v, 0) + (n - 1) * B.gap, W = Math.max(w, Math.min(lim, tot));
    if (tot <= lim || !px) {
      const share = (W - (n - 1) * B.gap) / n, eq = ws.every((v) => v <= share), extra = (W - tot) / n;
      return {px, w: W, ws: ws.map((v) => (eq ? share : v + Math.max(0, extra)))};
    }
  }
  return null;
}

/* every rect the HUD paints, by name, in viewport CSS px; c measures (memoized) */
export function hudGeom(c, geo, st, box) {
  const lay = geo.lay, L = HUD[lay], R = (x, y, w, h) => ({x, y, w, h}), G = {lay, chips: {}, bar: null, pause: null, plate: null, cols: null};
  if (lay === "d") {
    const pl = geo.plate, maxW = box.w - 2 * (L.edge + L.ring), F = forms(L);
    let f = F[F.length - 1], ws = null;
    for (const q of F) { const v = NAME.map((n) => chipW(c, n, st, q, L)); if (v.reduce((a, b) => a + b, 0) + 6 * L.gap + 2 * L.pad <= maxW || q === F[F.length - 1]) { f = q; ws = v; break; } }
    const need = ws.reduce((a, b) => a + b, 0) + 6 * L.gap + 2 * L.pad, w = Math.min(maxW, Math.max(pl.w, need)), cx = pl.x + pl.w / 2;
    const x0 = Math.max(L.edge + L.ring, Math.min(box.w - L.edge - L.ring - w, cx - w / 2)), extra = (w - need) / 7;
    G.plate = R(x0, pl.y, w, pl.h); G.f = f;
    let x = x0 + L.pad;
    NAME.forEach((n, i) => { const cw = ws[i] + extra; G.chips[n] = R(x, pl.y + L.pad, cw, L.ch); x += cw + L.gap; });
    const B = L.bar, it = barItems(c, st, B, geo.bar.w - 2 * B.pad, st.keys, box.w - 2 * L.edge - 2 * B.pad);
    if (it) {
      const bw = it.w + 2 * B.pad, bx0 = Math.max(L.edge, Math.min(box.w - L.edge - bw, geo.bar.x + geo.bar.w / 2 - bw / 2));
      let bx = bx0 + B.pad;
      G.bar = {x: bx0, y: geo.bar.y, w: bw, h: geo.bar.h, px: it.px, items: st.ab.map((a, i) => { const r = R(bx, geo.bar.y + B.pad, it.ws[i], geo.bar.h - 2 * B.pad); bx += it.ws[i] + B.gap; return r; })};
    }
    return G;
  }
  if (lay === "p") {
    const pl = geo.plate, F = forms(L), rows = [["lives", "bombs", "flame"], ["level", "enemies", "time", "score"]];
    let f = F[F.length - 1], cols = null;
    for (const q of F) {
      const w = (n) => chipW(c, n, st, q, L), c3 = [0, 1, 2].map((i) => Math.max(w(rows[0][i]), w(rows[1][i])));
      const rest = pl.w - 2 * L.pad - 3 * L.gap - c3.reduce((a, b) => a + b, 0);
      if (rest >= Math.max(w("score"), L.pause) || q === F[F.length - 1]) { f = q; cols = [...c3, rest]; break; }
    }
    const used = cols.slice(0, 3).reduce((a, b) => a + b, 0), extra = Math.max(0, (pl.w - 2 * L.pad - 3 * L.gap - used - Math.max(L.pause, cols[3])) / 4);
    const cw = cols.slice(0, 3).map((v) => v + extra);
    cw.push(pl.w - 2 * L.pad - 3 * L.gap - cw.reduce((a, b) => a + b, 0));
    G.plate = R(pl.x, pl.y, pl.w, pl.h); G.f = f;
    rows.forEach((row, j) => { let x = pl.x + L.pad; for (let i = 0; i < 4; i++) { const r = R(x, pl.y + L.pad + j * (L.ch + L.gap), cw[i], L.ch); if (row[i]) G.chips[row[i]] = r; else G.pause = R(r.x, r.y, r.w, r.h - 4); x += cw[i] + L.gap; } });
    const B = L.bar, n = st.ab.length;
    if (n) {
      const w2 = (geo.band.w - 2 * B.pad - B.gap) / 2, rws = Math.ceil(n / 2);
      let px = B.px;
      const cap = (a) => (st.keys && a.cap ? capWOf(c, "p", a.cap) + B.capg : 0);
      for (const q of [B.px, B.floor, 0]) { px = q; if (!q || st.ab.every((a) => B.cx + B.icon + B.ig + measure(c, T.label(q), a.m ? a.s + " " + a.m : a.s) + cap(a) + B.cx <= w2)) break; }
      G.bar = {x: geo.band.x, y: geo.band.y, w: geo.band.w, h: rws * B.row + (rws - 1) * B.gap + 2 * B.pad, px,
        items: st.ab.map((a, i) => R(geo.band.x + B.pad + (i % 2) * (w2 + B.gap), geo.band.y + B.pad + Math.floor(i / 2) * (B.row + B.gap), w2, B.row))};
    }
    return G;
  }
  const lc = geo.left, rc = geo.right, F = forms(L, true), left = ["lives", "bombs", "flame", "level"], right = ["enemies", "time", "score"];
  let f = F[F.length - 1];
  for (const q of F) if (left.every((n) => chipW(c, n, st, q, L, true) <= lc.w - 2 * L.pad) && right.every((n) => chipW(c, n, st, q, L, true) <= rc.w - 2 * L.pad)) { f = q; break; }
  G.f = f; G.one = true;
  const col = (r, names, y0) => names.forEach((n, i) => { G.chips[n] = R(r.x + L.pad, y0 + i * (L.ch + L.gap), r.w - 2 * L.pad, L.ch); });
  G.cols = [R(lc.x, lc.y, lc.w, 2 * L.pad + 4 * L.ch + 3 * L.gap), R(rc.x, rc.y + L.pause + L.bargap, rc.w, 2 * L.pad + 3 * L.ch + 2 * L.gap)];
  col(G.cols[0], left, lc.y + L.pad);
  col(G.cols[1], right, G.cols[1].y + L.pad);
  G.pause = R(rc.x, rc.y, rc.w, L.pause);
  /* the power-ups as glyph cells: under the left chips, else under the board (a width-bound stage leaves a band), else smaller cells */
  const grid = (x, y, w, cell, icon) => {
    const per = Math.max(1, Math.floor((w - 2 * L.pad + L.gap) / (cell + L.gap))), rws = Math.ceil(n / per);
    return {x, y, w: Math.min(w, 2 * L.pad + Math.min(n, per) * (cell + L.gap) - L.gap), h: 2 * L.pad + rws * cell + (rws - 1) * L.gap, px: 0, icon,
      items: st.ab.map((a, i) => R(x + L.pad + (i % per) * (cell + L.gap), y + L.pad + Math.floor(i / per) * (cell + L.gap), cell, cell))};
  };
  const n = st.ab.length, by = G.cols[0].y + G.cols[0].h + L.bargap, room = lc.y + lc.h - by, sb = geo.stage.y + geo.stage.h + 4;
  if (n) {
    const a = grid(lc.x, by, lc.w, L.cell, L.ci), b = grid(geo.stage.x, sb, geo.stage.w, L.cell, L.ci);
    let z = a;
    for (let cell = L.cell - 2; z.h > room && cell >= 14; cell -= 2) z = grid(lc.x, by, lc.w, cell, cell - 6);
    G.bar = a.h <= room ? a : b.y + b.h <= box.h ? b : z;
  }
  return G;
}

const sp = (c, x, y, w, h, r) => { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
const rf = (c, q, r, col) => { c.fillStyle = col; c.beginPath(); sp(c, q.x, q.y, q.w, q.h, r); c.fill(); };
/* a PIXEL cell's whole-number scale: as large as fits the glyph's box by its opaque rect (a 10-px heart doubles in a 22-px slot) */
export const pxScale = (f, s) => { const b = opaqueBox(f); return Math.max(1, Math.floor(s / Math.max(1, b.w, b.h))); };
function glyph(c, g, x, cy, s, px) {
  const A = px && pixelArt();
  if (A) { const fs = g === "foe" ? foeCell(A, WALKER.t) : itemCell(A, g); if (fs.length) blitCell(c, fs, x + s / 2, cy, pxScale(fs[0], s)); return; }
  c.save(); c.translate(x + s / 2, cy);
  if (g === "foe") { c.translate(0, s * 0.04); c.scale(s / 34, s / 34); drawEnemyBody(c, REST, FOE); }
  else { c.scale(s / 24, s / 24); drawIcon(c, g, COL[g] || PCOL[g], 0); }
  c.restore();
}
/* rec: the chip's rect; its glyphs are one info pair (their union against the chip's pane, the glyphs masked out, the text hidden in the twin) */
function drawParts(c, ps, x, cy, L, o, rec) {
  const gs = [];
  ps.forEach((q, i) => {
    if (i) x += q.g === "heart" && ps[i - 1].g === "heart" ? L.heart : L.ig;
    const w = partW(c, q);
    if (q.g) { glyph(c, q.g, x, cy, q.s, o.px); gs.push([x, cy - q.s / 2, x + q.s, cy + q.s / 2, q.g]); }
    else if (q.n != null) { nums(c, q.n, x, cy, q.px); if (rec) P.text(q.n, x, cy - q.px * textScale() * CAPR.num / 2, w, q.px * textScale() * CAPR.num, {role: "hud", col: CONST.ink}); }
    else { c.font = T.label(q.px); c.fillStyle = CONST.t2; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText(q.w, x, cy); if (rec) P.text(q.w, x, cy - q.px * textScale() * CAPR.label / 2, w, q.px * textScale() * CAPR.label, {role: "secondary", col: CONST.t2}); }
    x += w;
  });
  if (rec && gs.length) {
    const x0 = Math.min(...gs.map((g) => g[0])), y0 = Math.min(...gs.map((g) => g[1])), x1 = Math.max(...gs.map((g) => g[2])), y1 = Math.max(...gs.map((g) => g[3]));
    P.pair("info", [x0 - 5, y0 - 5, x1 - x0 + 10, y1 - y0 + 10], [rec.x, rec.y, rec.w, rec.h], {name: "glyphs " + gs[0][4], col: COL[gs[0][4]] || WALKER.col});
  }
}
function nums(c, s, x, cy, px) {
  const f = T.num(px);
  let cell = 0;
  for (const d of DIG) cell = Math.max(cell, measure(c, f, d));
  c.font = f; c.fillStyle = CONST.ink; c.textAlign = "center"; c.textBaseline = "middle";
  for (const q of String(s)) { const w = DIG.includes(q) ? cell : measure(c, f, q); c.fillText(q, x + w / 2, cy); x += w; }
}
function chip(c, name, r, st, f, L, tok, o, rec) {
  rf(c, r, L.r, tok.pane);
  c.fillStyle = "rgba(0,0,0,0.4)"; c.fillRect(r.x + L.r, r.y, r.w - 2 * L.r, 2);
  const ps = parts(name, st, f, L), K = textScale(), lw = labW(c, name, f);
  if (o.one) {
    const cy = r.y + r.h / 2, rw = rowW(c, ps, L);
    if (lw) { c.font = T.label(f.sec); c.fillStyle = CONST.t2; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText(LABEL[name], r.x + L.cx, cy);
      if (rec) P.text(LABEL[name], r.x + L.cx, cy - f.sec * K * CAPR.label / 2, lw, f.sec * K * CAPR.label, {role: "secondary", col: CONST.t2}); }
    drawParts(c, ps, r.x + r.w - L.cx - rw, cy, L, o, rec && r);
    return;
  }
  const sl = f.sec * K, hl = f.hud * K, room = r.h - sl - hl, k = Math.min(1, room / (L.ct + L.lg + 9)), ly = r.y + L.ct * k + sl / 2, vy = r.y + (L.ct + L.lg) * k + sl + hl / 2;
  c.font = T.label(f.sec); c.fillStyle = CONST.t2; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText(LABEL[name], r.x + L.cx, ly);
  if (rec) P.text(LABEL[name], r.x + L.cx, ly - f.sec * K * CAPR.label / 2, lw, f.sec * K * CAPR.label, {role: "secondary", col: CONST.t2});
  drawParts(c, ps, r.x + L.cx, vy, L, o, rec && r);
}
function pulse(c, G, st) {
  for (const [k, n, col] of [["l", "lives", COL.heart], ["b", "bombs", COL.bomb], ["r", "flame", COL.fire]]) {
    const v = st.pu[k], r = G.chips[n];
    if (!(v > 0) || !r) continue;
    c.globalAlpha = Math.min(1, v / LBL.pulse);
    c.lineWidth = 3; c.strokeStyle = col; c.beginPath(); sp(c, r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, HUD[G.lay].r); c.stroke();
  }
  c.globalAlpha = 1;
}
function bar(c, G, st, tok, o, rec) {
  const B = G.bar;
  if (!B) return;
  const L = HUD[G.lay], Bs = L.bar || {cx: 4, icon: B.icon || L.ci, ig: 0};
  rf(c, B, 8, CONST.ol);
  st.ab.forEach((a, i) => {
    const r = B.items[i], cy = r.y + r.h / 2, txt = a.m ? a.s + " " + a.m : a.s;
    c.globalAlpha = a.a;
    rf(c, r, L.r, tok.pane);
    const capOn = st.keys && a.cap && G.lay !== "l", cw = capOn ? capWOf(c, G.lay, a.cap) : 0;
    if (!B.px) { glyph(c, a.k, r.x + (r.w - Bs.icon) / 2 - (capOn ? (cw + Bs.capg) / 2 : 0), cy, Bs.icon, o.px); }
    else {
      glyph(c, a.k, r.x + Bs.cx, cy, Bs.icon, o.px);
      c.font = T.label(B.px); c.fillStyle = CONST.ink; c.textAlign = "left"; c.textBaseline = "middle";
      const tx = r.x + Bs.cx + Bs.icon + Bs.ig;
      c.fillText(a.s, tx, cy);
      if (a.m) { c.fillStyle = CONST.t2; c.fillText(a.m, tx + measure(c, T.label(B.px), a.s + " "), cy); }
      if (rec && a.a === 1) P.text(txt, tx, cy - B.px * textScale() * CAPR.label / 2, measure(c, T.label(B.px), txt), B.px * textScale() * CAPR.label, {role: "primary", col: CONST.ink});
    }
    if (capOn) {
      const px = capPx(G.lay), ch = Math.min(28, r.h - 6), x = r.x + r.w - Bs.cx - cw, tw = measure(c, T.label(px), a.cap);
      rf(c, {x, y: cy - ch / 2, w: cw, h: ch}, 5, CONST.ol); rf(c, {x: x + 2, y: cy - ch / 2 + 2, w: cw - 4, h: ch - 4}, 4, tok.key);
      c.font = T.label(px); c.fillStyle = CONST.t2; c.textAlign = "center"; c.fillText(a.cap, x + cw / 2, cy);
      if (rec && a.a === 1) P.text(a.cap, x + cw / 2 - tw / 2, cy - px * textScale() * CAPR.label / 2, tw, px * textScale() * CAPR.label, {role: "secondary", col: CONST.t2});
    }
  });
  c.globalAlpha = 1;
}
/* the plate: the kit rampart ring and bed around the chips' ol band; a cache layer at the backing scale q where a canvas can be made */
function plateOf(c, G, tok, q, look) {
  const L = HUD[G.lay], T0 = L.ring, p = G.plate, w = Math.ceil(p.w + 2 * T0 + 4), h = Math.ceil(p.h + 2 * T0 + 6);
  const paint = (x) => { plate(x, T0 + 2, T0 + 2, p.w, p.h, tok, {T: T0, tile: 40, phone: G.lay !== "d"}); };
  if (!canMake()) { c.save(); c.translate(p.x - T0 - 2, p.y - T0 - 2); paint(c); c.restore(); return; }
  const key = {layer: "hud.plate", biome: tok.biome.name, level: 0, W: w, H: h, dpr: q, look, textScale: 1};
  const img = layer(key, Math.ceil(w * q), Math.ceil(h * q), (x) => { x.scale(q, q); paint(x); });
  touchLayer(keyOf(key));
  c.drawImage(img, p.x - T0 - 2, p.y - T0 - 2, w, h);
}

/* one full paint of G (tests call it straight; createHud calls it on a change) */
export function drawHud(c, G, st, tok, o = {}) {
  const rec = !!o.rec, L = HUD[G.lay];
  if (G.plate) { plateOf(c, G, tok, o.q || 1, o.look || ""); rf(c, G.plate, 0, CONST.ol); if (rec) P.rect("plate", G.plate.x, G.plate.y, G.plate.w, G.plate.h, {plate: L.ring, fill: CONST.ol}); }
  if (G.cols) for (const r of G.cols) { rf(c, r, 8, CONST.ol); if (rec) P.rect("gutter", r.x + L.pad, r.y + L.pad, r.w - 2 * L.pad, r.h - 2 * L.pad, {plate: L.pad, fill: CONST.ol}); } // a landscape gutter column: its ol band is the chips' ring
  for (const n of NAME) { const r = G.chips[n]; chip(c, n, r, st, G.f, L, tok, {px: o.px, one: G.one}, rec); if (rec) P.rect("chip " + n, r.x, r.y, r.w, r.h, {fill: tok.pane}); }
  pulse(c, G, st);
  bar(c, G, st, tok, {px: o.px}, rec);
}

/* main's seam: frame(fit, world, o, look) each frame; world null (off GAME) hides #hud once */
export function createHud() {
  let shown = false, last = "";
  return {
    frame(fit, world, o, look) {
      if (!fit || typeof fit.hud !== "function") return;
      if (!world) { if (shown) fit.hud(0); shown = false; last = ""; return; }
      const geo = fit.hudGeo && fit.hudGeo(), st = hudState(world, o), rec = P.probe.on && st.play;
      if (!geo) { if (shown) fit.hud(0); shown = false; last = ""; return; }
      const key = JSON.stringify([geo, st, look, textScale(), look === "px" && !!pixelArt(), world.level | 0, fit.hudGen ? fit.hudGen() : 0]);
      if (shown && key === last && !rec) return; // under the probe (tools/ui/shots.mjs only) a PLAY frame repaints, so the text-hidden twin is real
      const h = fit.hud(1);
      if (!h) { shown = false; last = ""; return; }
      shown = true; last = key;
      const c = h.ctx, q = h.el && h.w ? h.el.width / h.w : 1;
      c.clearRect(0, 0, h.w, h.h);
      const G = hudGeom(c, geo, st, {w: h.w, h: h.h});
      if (rec) P.begin("hud", {w: h.w, h: h.h, dpr: q, el: "hud"});
      drawHud(c, G, st, worldTokens(world.level), {px: look === "px", q, look, rec});
    },
  };
}
