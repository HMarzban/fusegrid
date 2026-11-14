/* THE HUD (UI upgrade Task 8.2, round 5 09-hud on the K7 world kit; R2, R9). Seven labelled chips, LIVES BOMBS FLAME LEVEL ENEMIES TIME SCORE
   (words.js HUD_CHIPS), and the power-ups bar, drawn on #hud (fit.js hudGeo, viewport CSS px) off the board in every look, so no chip ever sits
   on board row 0 and the board canvases (#c, #px, #gl) draw no HUD at all.
     d  the chips in one row inside the world's rampart plate above the board (kit plate, T 10: the mock's data-t), the bar under the board.
     p  the chips on one four-column grid in the plate (LIVES BOMBS FLAME + the PAUSE slot over LEVEL ENEMIES TIME SCORE), the bar a two-column
        grid in the band under the board.
     l  one-line chips stacked in the side gutters (LIVES BOMBS FLAME LEVEL left above the power-ups, the PAUSE slot then ENEMIES TIME SCORE right).
   A chip is a pane (the world's pane, an ol band 4 px around and between) with its label (secondary, t2) over its value (the HUD size, nums: fixed
   digit cells) after its glyph; LIVES is up to five hearts, else one heart and the count (kit5 lives()); LEVEL is the number alone (the HUD names
   no difficulty: lead ruling R1, PAUSE's tag row and LEVEL SELECT name the run's); SCORE has thousands separators. Too wide for its slot, a chip
   steps down in order: hearts to heart + count, the value to its floor (cap 18 desktop / 11 phone), the label to its floor, then (l only) the
   label of a chip whose glyph names it.
   Glyphs are the look's own: PIXEL the atlas cells (hudart, once pixelArt() is registered), else the vector icons and the foe body.
   The bar lists the powers held now (fx abilityList order) and the ones a hit just took, dimmed and fading (ABAR.dim, ABAR.fade); THROW and
   REMOTE carry their key cap (the controller's button with a controller) on a desktop or portrait layout. A changed BOMBS / FLAME / LIVES value pulses a ring just inside its chip for LBL.pulse (fx
   getPulse), so two pulses never meet across the 4 px gap.
   The phone's touch strip (Task 8.3; fit.js hudGeo strip, the DOM hit areas sit over it): the D-PAD as four keys round a well, BOMB the yellow
   main key (the frame's one yellow), THROW and REMOTE keys only while held, all in PLAY only; the PAUSE key in its slot (RESUME while paused),
   where createHud docks #tpause. The floor-tile tip (coach v2's tile kinds; the board keeps every other tip): a plate beside the board on a
   leader to the nearest tile of its kind (desktop, on the wider side), at the band's foot over the controls (portrait phone), in the left
   gutter (landscape), else over the chip plate, never over the board; its words are the tip's own, split at the first " · ".
   createHud() is main's one call per frame: it paints only when what the HUD shows changed (hudState, the slots, the look), so an idle frame
   (PAUSE, a still TIME) makes no canvas call; the plate's ring is a kit cache layer. The probe records page "hud" while the world PLAYs. */
import {FOES, POWER} from "../core/entities.js";
import {CFG, key as cell} from "../core/config.js";
import {TILE_NAME, featKindOf, featProfile, tileTip} from "../core/feat.js";
import {CONST, worldTokens} from "./kit/tokens.js";
import {plate, key as kkey, runW, runText, hasPadGlyph, PAD_GLYPH} from "./kit/paint.js";
import {T, DEV, measure, textScale} from "./kit/type.js";
import {layer, canMake, keyOf, touch as touchLayer} from "./kit/cache.js";
import * as P from "./kit/probe.js";
import {drawIcon} from "./icons.js";
import {drawEnemyBody} from "./sprites.js";
import {pixelArt, itemCell, foeCell, blitCell, opaqueBox} from "./hudart.js";
import {abilityText, getStrip, getPulse, LBL} from "./fx.js";
import {abilityChips, fmtTime} from "./scenes.js";
import {HUD_CHIPS, HUD_WORDS, PAD_TOAST} from "./words.js";
import {hints} from "./hintcopy.js";

const deep = (o) => { for (const v of Object.values(o)) if (v && typeof v === "object") deep(v); return Object.freeze(o); };
/* cap / font px of the faces (system-ui at 800 for numbers, 700 for labels; the round 5 audit: 27 -> 20.1, 16 -> 11.27) */
export const CAPR = deep({num: 0.744, label: 0.704});
export const HUD = deep({
  d: {pad: 4, gap: 4, ch: 66, cx: 10, ct: 8, lg: 6, icon: 22, ig: 6, heart: 4, r: 5, hud: DEV.d.hud, sec: DEV.d.sec, floor: {hud: 24.2, sec: 15.7}, edge: 12, ring: 10,
    bar: {pad: 4, gap: 4, cx: 10, icon: 22, ig: 8, px: DEV.d.pri, floor: 19.9, capg: 8}},
  p: {pad: 4, gap: 4, ch: 57, cx: 10, ct: 8, lg: 6, icon: 20, ig: 6, heart: 4, r: 5, hud: DEV.p.hud, sec: DEV.p.sec, floor: {hud: 14.8, sec: 12.8}, ring: 10, pause: 72,
    bar: {pad: 4, gap: 4, row: 30, cx: 10, icon: 18, ig: 8, px: DEV.p.pri, floor: 15.7, capg: 8}},
  l: {pad: 4, gap: 4, ch: 30, cx: 8, icon: 18, ig: 6, heart: 3, r: 5, hud: DEV.p.hud, sec: DEV.p.sec, floor: {hud: 14.8, sec: 12.8}, pause: 44, bargap: 6, cell: 26, ci: 18},
});
/* glyph colours: the catalog heart and fire; the bomb in the kit's cream (coral is danger only), the BOMBS pulse in the kit's ink */
const COL = deep({heart: "#ff3b5c", bomb: CONST.t2, fire: "#ff8a3c"}), PULSE = deep({l: "#ff3b5c", b: CONST.ink, r: "#ff8a3c"}), PCOL = Object.freeze(Object.fromEntries(POWER.map((q) => [q.t, q.col])));
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
    ab, pu: {b: r3(u.b), r: r3(u.r), l: r3(u.l)}, keys: H.dev === "key" || H.dev === "pad", play: world.state === "PLAY", paused: world.state === "PAUSE",
    hold: [!!p.throw, !!p.remote], tip: toastState(world, o) || tipState(world, o)};
}
/* the controller toast (controlswire's app.padToast, main's o.padToast): it takes the tip's plate and slots, no leader, over a tile tip for its 3 s */
export function toastState(world, o) {
  const q = o && o.padToast;
  if (!q || world.state !== "PLAY") return null;
  const head = q.k === "lost" ? PAD_TOAST.LOST : q.k === "back" ? PAD_TOAST.BACK : PAD_TOAST.READY, body = q.k === "lost" ? PAD_TOAST.LOST_BODY : PAD_TOAST.body(q.move, q.bomb);
  return {s: head + " · " + body, alt: PAD_TOAST.SHORT + " · " + head.slice(PAD_TOAST.SHORT.length + 1) + " · " + body, short: "", a: q.a, t: null, pad: true, ps: !!PAD_GLYPH[q.bomb]}; // ps: BOMB names a PlayStation face (only that family prints one), so its glyph paints
}
/* a floor-tile coach tip and its nearest tile of that kind (grid coords) to the player; null for any other tip */
const TILEK = (k) => (k === "BRAKE" ? "GLIDE" : k && TILE_NAME[k] ? k : null);
export function tipState(world, o) {
  const c2 = o && o.coach2, k = c2 && c2.a > 0 && c2.s ? TILEK(c2.k) : null;
  if (!k || world.state !== "PLAY") return null;
  const p = world.players && world.players[0], f = world.feat, T0 = CFG.TILE;
  let t = null, bd = Infinity;
  if (f && p) for (let y = 0; y < CFG.ROWS; y++) for (let x = 0; x < CFG.COLS; x++) {
    if (featKindOf(f[cell(x, y)]) !== k) continue;
    const d = Math.hypot((x + 0.5) * T0 - p.x, (y + 0.5) * T0 - p.y);
    if (d < bd) { bd = d; t = [x, y]; }
  }
  let short = "";
  try { short = tileTip(k, featProfile(world), true); } catch (_) { short = ""; }
  return {s: String(c2.s), short, a: Math.round(Math.min(1, c2.a) * 10) / 10, t}; // alpha in tenths: a fade repaints ten times, not every frame
}
/* the tip's words: the tile's name, then the rest */
export const tipOf = (s) => { const i = String(s).indexOf(" · "); return i < 0 ? [String(s), ""] : [s.slice(0, i), s.slice(i + 3)]; };

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
  if (name === "level") return [{n: String(st.level), px: f.hud}];
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
  const b = {hearts: true, hud: L.hud, sec: L.sec}, out = [b, {...b, hearts: false}, {...b, hearts: false, hud}, {...b, hearts: false, hud, sec}];
  if (one) out.push({...out[3], nolab: ["lives", "bombs", "flame", "enemies"]});
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
  const fl = Math.min(B.px, B.floor / textScale()); // a power's name is primary text: its floor is the primary cap (14 desktop / 11 phone)
  for (const [px, lim] of [[B.px, w], [B.px, max], [fl, w], [fl, max], [0, w]]) {
    const ws = st.ab.map((it) => B.cx + B.icon + (px ? B.ig + measure(c, T.label(px), it.m ? it.s + " " + it.m : it.s) : 0) + capw(it) + B.cx);
    const tot = ws.reduce((a, v) => a + v, 0) + (n - 1) * B.gap, W = Math.max(w, Math.min(lim, tot));
    if (tot <= lim || !px) {
      const share = (W - (n - 1) * B.gap) / n, eq = ws.every((v) => v <= share), extra = (W - tot) / n;
      return {px, w: W, ws: ws.map((v) => (eq ? share : v + Math.max(0, extra)))};
    }
  }
  return null;
}

/* every rect the HUD paints, by name, in viewport CSS px; c measures (memoized); box = {w, h, at}: at the tip's tile point in CSS px
   (createHud projects it through the live look; absent, the board's own linear map) */
export function hudGeom(c, geo, st, box) {
  const G = layout(c, geo, st, box);
  G.strip = stripOf(geo);
  G.tip = st.tip ? tipGeom(c, G, geo, st, box) : null;
  return G;
}
const R4 = (x, y, w, h) => ({x, y, w, h});
function stripOf(geo) {
  const S = geo.strip;
  if (!S) return null;
  const k = S.pad.key, g = S.pad.gap, x = S.pad.x + (S.pad.w - 3 * k - 2 * g) / 2, y = S.pad.y + (S.pad.h - 3 * k - 2 * g) / 2, at = (i, j) => R4(x + i * (k + g), y + j * (k + g), k, k);
  return {keys: {up: at(1, 0), lf: at(0, 1), rt: at(2, 1), dn: at(1, 2)}, well: at(1, 1), bomb: S.bomb, thr: S.thr, rem: S.rem};
}
const TIPT = 8;
/* words into lines of at most w; a break at a " · " drops the separator, so no line starts or ends with one */
function wrap(c, s, font, w, ps) {
  const out = [], end = (l) => l.replace(/ ·$/, "");
  let line = "";
  for (const wd of String(s).split(" ")) {
    if (wd === "·" && !line) continue;
    const t = line ? line + " " + wd : wd;
    if (line && runW(c, font, t, ps) > w) { out.push(end(line)); line = wd === "·" ? "" : wd; } else line = t;
  }
  if (line) out.push(end(line));
  return out;
}
/* the tile tip's place and words. It never covers the board or a live control (the PAUSE key, the D-PAD, BOMB, THROW, REMOTE: the strip sits
   outside every slot) and its words always fit its plate, by the real measure. Words step down: the whole tip, the body at its floor, the
   short line (feat.js tileTip(.., true)) at size then floor, at most two body lines; the slots are tried in order with every step but the
   last, and only when none takes any words does the name alone go in the first slot it fits. Slots: d the column beside the board (a leader
   to the tile), then over the chip plate inside the top reserve; p the band under the board below the power-ups, then the whole band, then
   over plate columns 1-3 (never the PAUSE column); l the left gutter above the D-PAD. */
const TIP_FLOOR = {d: 17.9, p: 14.1}; // the kit's body font px floors (tools/ui/lib/gatelib.mjs cap: desktop 17.9, phone 14.1), whatever the text scale
function tipGeom(c, G, geo, st, box) {
  const D0 = DEV[geo.lay === "d" ? "d" : "p"], nfl = Math.min(D0.pri, NAME_CAP[geo.lay === "d" ? "d" : "p"] / (textScale() * CAPR.label)); // a toast's title may step down to the primary cap floor
  const ss = [st.tip.s, st.tip.alt].filter(Boolean), nps = st.tip.pad && nfl < D0.pri ? [D0.pri, nfl] : [D0.pri]; // the toast's alt: its shorter title, tried with its words before any title alone
  for (const nameOnly of [false, true]) for (const np of nps) for (const s of ss) { const g = tipGeomOf(c, G, geo, st, box, s, nameOnly, np); if (g) return g; }
  return null;
}
const NAME_CAP = {d: 14, p: 11}; // the primary cap floors (tools/ui/lib/gatelib.mjs), CSS px
function tipGeomOf(c, G, geo, st, box, s, nameOnly, np) {
  const lay = geo.lay, D = DEV[lay === "d" ? "d" : "p"], K = textScale(), [name, rest] = tipOf(s), [, low] = tipOf(st.tip.short || ""), pad = 12, ST = geo.stage;
  const fl = Math.min(D.bod, TIP_FLOOR[lay === "d" ? "d" : "p"] / K);
  const words = [[rest, D.bod], [rest, fl], [low, D.bod], [low, fl]].filter(([b, px], i, a) => b && !a.slice(0, i).some(([b2, p2]) => b2 === b && p2 === px));
  const size = (w, body, px) => { const lines = body ? wrap(c, body, T.body(px), w - 2 * pad, st.tip.ps) : []; return {lines, px, body, h: 10 + np * K + (lines.length ? 6 + lines.length * px * K * 1.25 : 0) + 12}; };
  /* the first step of `steps` that fits a w x maxH inner box, or null; the toast, and any tip beside REAL 3D's wider stage (its column ~42 px
     narrower, box.gx), may wrap to a third line so the tip keeps its whole words (2026-11-14) */
  const pick = (w, maxH, steps) => {
    if (!(w >= 2 * pad) || !(maxH > 0) || measure(c, T.label(np), name) + 2 * pad > w) return null;
    for (const [body, px] of steps) {
      const z = size(w, body, px);
      if (z.lines.length <= (st.tip.pad || box.gx > 0 ? 3 : 2) && z.h <= maxH + 1e-6 && z.lines.every((l) => runW(c, T.body(px), l, st.tip.ps) + 2 * pad <= w + 1e-6)) return z;
    }
    return null;
  };
  const at = st.tip.t ? box.at || [ST.x + (st.tip.t[0] + 0.5) * CFG.TILE * geo.s, ST.y + (st.tip.t[1] + 0.5) * CFG.TILE * geo.s] : null;
  const ring = (r) => R4(r.x - TIPT, r.y - TIPT, r.w + 2 * TIPT, r.h + 2 * TIPT + 3);
  /* slots: w and the inner height it may take (its ring then stays inside the slot), place(z) -> [inner box, leader] */
  const slots = [];
  /* the controller toast (st.tip.pad) takes the chip plate first on a desktop and a portrait phone, the same place on both, and fills the plate's
     height so every chip under it is covered whole (owner veto 3, pick B, 2026-11-14); a tile tip keeps the plate as its last slot */
  const toast = !!st.tip.pad, plateFirst = toast && lay !== "l";
  const top = (x, y, w, maxH, grow) => (plateFirst ? slots.unshift : slots.push).call(slots, {w, maxH, place: (z) => [R4(x, y, w, grow ? Math.min(maxH, Math.max(z.h, grow)) : z.h), null]});
  if (lay === "d") {
    const gx = box.gx || 0, rx = ST.x + ST.w + gx + 30, rw = Math.min(360, box.w - 22 - rx - TIPT), lw = Math.min(360, ST.x - gx - 30 - 22 - TIPT), right = rw >= lw, w = right ? rw : lw; // gx: REAL 3D's wider stage (fit.js glBox), kept clear
    const y0 = (G.plate ? G.plate.y + G.plate.h + 10 + TIPT : TIPT), y1 = Math.min(ST.y + ST.h, box.h - 184) - TIPT - 3;
    if (w >= 120) slots.push({w, maxH: y1 - y0, place: (z) => {
      const h = z.h, cy = at ? at[1] : st.tip.pad ? y0 + h / 2 : ST.y + ST.h / 2, y = Math.max(y0, Math.min(y1 - h, cy - h / 2)), x = right ? rx + TIPT : ST.x - gx - 30 - TIPT - w;
      let lead = null;
      if (at) {
        const ex = right ? x - TIPT : x + w + TIPT, ky = Math.max(y + 12, Math.min(y + h - 12, at[1])), kx = right ? ST.x + ST.w + gx + 12 : ST.x - gx - 12;
        lead = Math.abs(ky - at[1]) < 0.5 ? [at, [ex, ky]] : [at, [kx, at[1]], [kx, ky], [ex, ky]];
      }
      return [R4(x, y, w, h), lead];
    }});
    if (G.plate) { const y = G.plate.y - HUD.d.ring + TIPT, m = ST.y - y - TIPT - 3; top(G.plate.x, y, G.plate.w, m, toast ? m : 0); } // over the chips: its ring on the plate's own ring, stopping at the board's top edge
  } else if (lay === "p") {
    const b = geo.band, x = b.x + TIPT, w = b.w - 2 * TIPT, foot = b.y + b.h - TIPT - 3, y0 = ST.y + ST.h + 8 + TIPT;
    for (const yt of G.bar ? [Math.max(y0, G.bar.y + G.bar.h + 8 + TIPT), y0] : [y0]) slots.push({w, maxH: foot - yt, place: (z) => [R4(x, foot - z.h, w, z.h), null]});
    if (G.plate) { const y = G.plate.y - HUD.p.ring + TIPT, m = ST.y - y - TIPT - 3; top(G.plate.x, y, (G.pause ? G.pause.x - 2 - TIPT : G.plate.x + G.plate.w) - G.plate.x, m, toast ? m : 0); } // its ring ends in the 4 px chip gap left of PAUSE
  } else if (geo.left && G.cols) {
    const a = R4(geo.left.x + TIPT, geo.left.y + TIPT, geo.left.w - 2 * TIPT, geo.left.h - 2 * TIPT - 3);
    top(a.x, a.y, a.w, a.h, G.cols[0].h - 2 * TIPT - 3);
  }
  for (const steps of nameOnly ? [[["", D.bod]]] : [words]) for (const sl of slots) {
    const z = pick(sl.w, sl.maxH, steps);
    if (!z) continue;
    const [inner, lead] = sl.place(z);
    return {name, np, lines: z.lines, px: z.px, body: z.body === rest ? "whole" : z.body ? "short" : "name", in: inner, box: ring(inner), lead, a: st.tip.a, D, ps: !!st.tip.ps};
  }
  return null;
}
function layout(c, geo, st, box) {
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
    /* two columns as in the frame; more (and then glyphs only) when the band under the board cannot hold the rows, never into the strip */
    if (n) {
      const cap = (a) => (st.keys && a.cap ? capWOf(c, "p", a.cap) + B.capg : 0), hOf = (r) => r * B.row + (r - 1) * B.gap + 2 * B.pad;
      let cols = 2;
      while (cols < n && hOf(Math.ceil(n / cols)) > geo.band.h) cols++;
      const w2 = (geo.band.w - 2 * B.pad - (cols - 1) * B.gap) / cols, rws = Math.ceil(n / cols);
      let px = B.px;
      for (const q of [B.px, Math.min(B.px, B.floor / textScale()), 0]) { px = q; if (!q || st.ab.every((a) => B.cx + B.icon + B.ig + measure(c, T.label(q), a.m ? a.s + " " + a.m : a.s) + cap(a) + B.cx <= w2)) break; }
      G.bar = {x: geo.band.x, y: geo.band.y, w: geo.band.w, h: hOf(rws), px,
        items: st.ab.map((a, i) => R(geo.band.x + B.pad + (i % cols) * (w2 + B.gap), geo.band.y + B.pad + Math.floor(i / cols) * (B.row + B.gap), w2, B.row))};
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
/* a glyph is a cached sprite (one layer per kind, size, look and backing scale), blitted on whole device px; with no canvas source it draws straight */
let curQ = 1, curLook = "";
function glyph(c, g, x, cy, s, px, col) {
  if (!canMake()) { glyphNow(c, g, x, cy, s, px, col); return; }
  const A = px && pixelArt(), b = s + 12, key = {layer: "hud.glyph", biome: "", level: g + (A ? ":px" : "") + (col ? ":" + col : ""), W: b, H: b, dpr: curQ, look: curLook, textScale: 1};
  const img = layer(key, Math.ceil(b * curQ), Math.ceil(b * curQ), (x2) => { x2.scale(curQ, curQ); glyphNow(x2, g, 6, b / 2, s, px, col); });
  touchLayer(keyOf(key));
  const sx = Math.round((x - 6) * curQ) / curQ, sy = Math.round((cy - b / 2) * curQ) / curQ;
  c.drawImage(img, sx, sy, b, b);
}
function glyphNow(c, g, x, cy, s, px, col) {
  const A = px && pixelArt();
  if (A) { const fs = g === "foe" ? foeCell(A, WALKER.t) : itemCell(A, g); if (fs.length) blitCell(c, fs, x + s / 2, cy, pxScale(fs[0], s)); return; }
  c.save(); c.translate(x + s / 2, cy);
  if (g === "foe") { c.translate(0, s * 0.04); c.scale(s / 34, s / 34); drawEnemyBody(c, REST, FOE); }
  else { c.scale(s / 24, s / 24); drawIcon(c, g, col || COL[g] || PCOL[g], 0); }
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
/* a chip's two lines: the label's middle and the value row's middle (one-line chips share one) */
function rowsOf(r, f, L, one) {
  if (one) return [r.y + r.h / 2, r.y + r.h / 2];
  const K = textScale(), sl = f.sec * K, hl = f.hud * K, k = Math.min(1, (r.h - sl - hl) / (L.ct + L.lg + 9));
  return [r.y + L.ct * k + sl / 2, r.y + (L.ct + L.lg) * k + sl + hl / 2];
}
/* the static half of a chip (pane, inset, label: it lives in the plate's layer) and the live half (glyph and value) */
function chipBase(c, name, r, f, L, tok, one) {
  rf(c, r, L.r, tok.pane);
  c.fillStyle = "rgba(0,0,0,0.4)"; c.fillRect(r.x + L.r, r.y, r.w - 2 * L.r, 2);
  if (!labW(c, name, f)) return;
  c.font = T.label(f.sec); c.fillStyle = CONST.t2; c.textAlign = "left"; c.textBaseline = "middle"; c.fillText(LABEL[name], r.x + L.cx, rowsOf(r, f, L, one)[0]);
}
function chipLabelRec(c, name, r, f, L, one) {
  const lw = labW(c, name, f), K = textScale();
  if (lw) P.text(LABEL[name], r.x + L.cx, rowsOf(r, f, L, one)[0] - f.sec * K * CAPR.label / 2, lw, f.sec * K * CAPR.label, {role: "secondary", col: CONST.t2});
}
function chipValue(c, name, r, st, f, L, o, rec) {
  const ps = parts(name, st, f, L), vy = rowsOf(r, f, L, o.one)[1];
  drawParts(c, ps, o.one ? r.x + r.w - L.cx - rowW(c, ps, L) : r.x + L.cx, vy, L, o, rec && r);
}
function pulse(c, G, st) {
  for (const [k, n, col] of [["l", "lives", PULSE.l], ["b", "bombs", PULSE.b], ["r", "flame", PULSE.r]]) {
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
  let al = 1; // alpha is written only where it changes: a ghost's dim, then the next live chip back at 1
  st.ab.forEach((a, i) => {
    const r = B.items[i], cy = r.y + r.h / 2, txt = a.m ? a.s + " " + a.m : a.s;
    if (o.hid && o.hid(r)) return;
    if (a.a !== al) c.globalAlpha = al = a.a;
    rf(c, r, L.r, tok.pane);
    const capOn = st.keys && a.cap && G.lay !== "l", cw = capOn ? capWOf(c, G.lay, a.cap) : 0;
    const gx = !B.px ? r.x + (r.w - Bs.icon) / 2 - (capOn ? (cw + Bs.capg) / 2 : 0) : r.x + Bs.cx;
    glyph(c, a.k, gx, cy, Bs.icon, o.px);
    /* a live power's glyph is an info pair against its pane, like a chip's glyphs (the tip may cover every chip) */
    if (rec && a.a === 1) P.pair("info", [gx - 5, cy - Bs.icon / 2 - 5, Bs.icon + 10, Bs.icon + 10], [r.x, r.y, r.w, r.h], {name: "power " + a.k, col: PCOL[a.k] || CONST.ink});
    if (B.px) {
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
  if (al !== 1) c.globalAlpha = 1;
}
/* the plate: the kit rampart ring and bed around the chips' ol band; a cache layer at the backing scale q where a canvas can be made */
/* a static part as a kit cache layer: region r (CSS px) at the backing scale q, keyed by its name, world, size, look, text scale and what (the
   content that is not its size); paint draws in CSS px. With no canvas source (Node) it paints straight. */
function cached(c, name, r, tok, q, look, what, paint) {
  if (!canMake()) { paint(c); return; }
  const w = Math.ceil(r.w), h = Math.ceil(r.h), key = {layer: "hud." + name, biome: tok.biome.name, level: what, W: w, H: h, dpr: q, look, textScale: textScale()};
  const img = layer(key, Math.ceil(w * q), Math.ceil(h * q), (x) => { x.scale(q, q); x.translate(-r.x, -r.y); paint(x); });
  touchLayer(keyOf(key));
  c.drawImage(img, r.x, r.y, w, h);
}
const ringed = (p, T0) => R4(p.x - T0 - 2, p.y - T0 - 2, p.w + 2 * T0 + 4, p.h + 2 * T0 + 6);
/* the static HUD: the rampart plate, its ol band and the chips' bases (d, p), or each landscape column's band and bases, one layer each */
function baseOf(c, G, tok, q, look) {
  const L = HUD[G.lay], f = G.f, what = (names) => JSON.stringify([G.lay, f.sec, f.nolab || 0, names.map((n) => [n, G.chips[n].x, G.chips[n].y, G.chips[n].w, G.chips[n].h])]);
  if (G.plate) {
    const p = G.plate;
    cached(c, "plate", ringed(p, L.ring), tok, q, look, what(NAME), (x) => {
      plate(x, p.x, p.y, p.w, p.h, tok, {T: L.ring, tile: 40, phone: G.lay !== "d"});
      rf(x, p, 0, CONST.ol);
      for (const n of NAME) chipBase(x, n, G.chips[n], f, L, tok, false);
    });
  }
  if (G.cols) G.cols.forEach((r, i) => {
    const names = i ? ["enemies", "time", "score"] : ["lives", "bombs", "flame", "level"];
    cached(c, "col" + i, r, tok, q, look, what(names), (x) => { rf(x, r, 8, CONST.ol); for (const n of names) chipBase(x, n, G.chips[n], f, L, tok, true); });
  });
}

/* the strip's arrow (dir 0 up, 1 right, 2 down, 3 left) and the PAUSE / RESUME marks, filled in col, centred on cx cy, s px */
function mark(c, m, cx, cy, s, col) {
  c.fillStyle = col; c.beginPath();
  if (m === "pause") { c.rect(cx - s * 0.36, cy - s / 2, s * 0.26, s); c.rect(cx + s * 0.1, cy - s / 2, s * 0.26, s); }
  else { const r = [[0, -1], [1, 0], [0, 1], [-1, 0]][m === "play" ? 1 : m], h = s / 2, px = -r[1], py = r[0];
    c.moveTo(cx + r[0] * h, cy + r[1] * h); c.lineTo(cx - r[0] * h * 0.6 + px * h, cy - r[1] * h * 0.6 + py * h); c.lineTo(cx - r[0] * h * 0.6 - px * h, cy - r[1] * h * 0.6 - py * h); c.closePath(); }
  c.fill();
}
const NAMEOF = Object.fromEntries(POWER.map((q) => [q.t, q.name]));
function strip(c, G, st, tok, o, rec) {
  const q = o.q || 1, look = o.look || "";
  const S = G.strip, D = DEV.p, K = textScale(), lab = (s, cx, cy, px, col) => { c.font = T.label(px); c.fillStyle = col; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(s, cx, cy); };
  const tr = (n, r, o2) => { if (rec) P.rect(n, r.x, r.y, r.w, r.h, {touch: true, set: "strip", ...o2}); };
  if (G.pause && (st.play || st.paused)) {
    const r = G.pause, w = st.paused ? HUD_WORDS.RESUME : HUD_WORDS.PAUSE, lw = measure(c, T.label(D.pri), w), ic = 14;
    kkey(c, r.x, r.y, r.w, r.h, "key", {tok, phone: true});
    const one = lw + ic + 10 <= r.w - 16, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    if (one) { mark(c, st.paused ? "play" : "pause", cx - (lw + 10) / 2, cy, ic, CONST.ink); lab(w, cx + (ic + 10) / 2, cy, D.pri, CONST.ink); }
    else lab(w, cx, cy, Math.min(D.pri, D.sec), CONST.ink);
    if (rec) P.text(w, (one ? cx + (ic + 10) / 2 : cx) - lw / 2, cy - D.pri * K * CAPR.label / 2, lw, D.pri * K * CAPR.label, {role: "primary", col: CONST.ink});
    tr("PAUSE", r);
  }
  if (!S || !st.play) return;
  /* the D-PAD and BOMB are static: one cached layer over both (their drops included) */
  const b = S.bomb, bs = Math.min(40, b.h - D.pri * K - 14), ks = Object.values(S.keys), x0 = Math.min(S.well.x, ...ks.map((r) => r.x), b.x) - 2, y0 = Math.min(...ks.map((r) => r.y), b.y) - 4;
  const box = R4(x0, y0, Math.max(...ks.map((r) => r.x + r.w), b.x + b.w) + 2 - x0, Math.max(...ks.map((r) => r.y + r.h), b.y + b.h) + 8 - y0);
  cached(c, "strip", box, tok, q, look, JSON.stringify([ks, b].flat().map((r) => [r.x - x0, r.y - y0, r.w, r.h])) + (o.px && pixelArt() ? "px" : ""), (x) => {
    const lx = (s, cx, cy, px, col) => { x.font = T.label(px); x.fillStyle = col; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(s, cx, cy); };
    for (const [n, d] of [["up", 0], ["rt", 1], ["dn", 2], ["lf", 3]]) { const r = S.keys[n]; kkey(x, r.x, r.y, r.w, r.h, "key", {tok, phone: true}); mark(x, d, r.x + r.w / 2, r.y + r.h / 2, Math.round(r.w * 0.36), CONST.ink); }
    kkey(x, S.well.x, S.well.y, S.well.w, S.well.h, "well", {tok, phone: true});
    kkey(x, b.x, b.y, b.w, b.h, "main", {tok, phone: true});
    glyph(x, "bomb", b.x + b.w / 2 - bs / 2, b.y + 6 + bs / 2, bs, o.px, CONST.yelInk);
    lx(HUD_WORDS.BOMB, b.x + b.w / 2, b.y + b.h - 8 - D.pri * K / 2, D.pri, CONST.yelInk);
  });
  for (const [n, r] of Object.entries(S.keys)) tr("D-PAD " + n, r);
  tr("BOMB", b, {fill: CONST.yel});
  const act = (r, k, name) => {
    kkey(c, r.x, r.y, r.w, r.h, "key", {tok, phone: true});
    /* the name at the primary size, else the secondary, else its floor (cap 9), else none: the key's glyph names it; 2 px air a side (REMOTE at
       the floor fits the 61 px half key of the 393x852 frame) */
    const px = [D.pri, D.sec, Math.min(D.sec, 12.8 / K)].find((q) => measure(c, T.label(q), name) + 4 <= r.w) || 0;
    const gs = Math.min(26, px ? r.h - px * K - 14 : r.h - 16), ly = r.y + r.h - 6 - px * K / 2, lw = px ? measure(c, T.label(px), name) : 0;
    glyph(c, k, r.x + r.w / 2 - gs / 2, px ? r.y + 6 + gs / 2 : r.y + r.h / 2, gs, o.px);
    if (px) lab(name, r.x + r.w / 2, ly, px, CONST.ink);
    if (rec && px) P.text(name, r.x + r.w / 2 - lw / 2, ly - px * K * CAPR.label / 2, lw, px * K * CAPR.label, {role: px === D.pri ? "primary" : "secondary", col: CONST.ink});
    tr(name, r);
  };
  if (st.hold[0]) act(S.thr, "throw", NAMEOF.throw);
  if (st.hold[1]) act(S.rem, "remote", NAMEOF.remote);
}
function tip(c, G, tok, rec, q, look) {
  const t = G.tip;
  if (!t) return;
  const K = textScale(), D = t.D, r = t.in, a0 = c.globalAlpha;
  c.globalAlpha = a0 * t.a;
  if (t.lead) {
    c.lineJoin = c.lineCap = "round";
    const path = () => { c.beginPath(); t.lead.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); };
    path(); c.strokeStyle = CONST.ol; c.lineWidth = 3.5; c.stroke();
    path(); c.strokeStyle = CONST.t2; c.lineWidth = 1.5; c.stroke();
    const [x, y] = t.lead[0];
    c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fillStyle = CONST.t2; c.fill(); c.lineWidth = 1.2; c.strokeStyle = CONST.ol; c.stroke();
  }
  cached(c, "tip", ringed(r, TIPT), tok, q, look, "", (x) => plate(x, r.x, r.y, r.w, r.h, tok, {T: TIPT, tile: 40, phone: G.lay !== "d"}));
  c.textAlign = "left"; c.textBaseline = "middle";
  const np = t.np || D.pri, ly = r.y + 10 + np * K / 2;
  c.font = T.label(np); c.fillStyle = CONST.ink; c.fillText(t.name, r.x + 12, ly);
  if (rec) P.text(t.name, r.x + 12, ly - np * K * CAPR.label / 2, measure(c, T.label(np), t.name), np * K * CAPR.label, {role: "primary", col: CONST.ink});
  const bp = t.px || D.bod;
  c.font = T.body(bp); c.fillStyle = CONST.t2;
  t.lines.forEach((l, i) => {
    const y = ly + np * K / 2 + 6 + (i + 0.5) * bp * K * 1.25;
    if (t.ps && hasPadGlyph(l)) { runText(c, l, r.x + 12, y, T.body(bp), CONST.t2, "left", true); c.font = T.body(bp); c.fillStyle = CONST.t2; } // the toast's BOMB ✕ on a PlayStation pad
    else c.fillText(l, r.x + 12, y);
    if (rec) P.text(l, r.x + 12, y - bp * K * 0.36, runW(c, T.body(bp), l, t.ps), bp * K * 0.72, {role: "body", px: bp * K, col: CONST.t2});
  });
  if (rec) P.rect("tip", r.x, r.y, r.w, r.h, {plate: TIPT, fill: tok.bedA});
  c.globalAlpha = a0;
}

/* one full paint of G (tests call it straight; createHud calls it on a change) */
export function drawHud(c, G, st, tok, o = {}) {
  const rec = !!o.rec, L = HUD[G.lay];
  curQ = o.q || 1; curLook = o.look || "";
  baseOf(c, G, tok, curQ, curLook);
  if (rec && G.plate) P.rect("plate", G.plate.x, G.plate.y, G.plate.w, G.plate.h, {plate: L.ring, fill: CONST.ol});
  if (rec && G.cols) for (const r of G.cols) P.rect("gutter", r.x + L.pad, r.y + L.pad, r.w - 2 * L.pad, r.h - 2 * L.pad, {plate: L.pad, fill: CONST.ol}); // a landscape gutter column: its ol band is the chips' ring
  const cov = G.tip && G.tip.box, hid = (r) => !!cov && !(r.x + r.w <= cov.x || cov.x + cov.w <= r.x || r.y + r.h <= cov.y || cov.y + cov.h <= r.y); // under the tip: not drawn, not recorded
  for (const n of NAME) {
    const r = G.chips[n];
    if (hid(r)) continue;
    chipValue(c, n, r, st, G.f, L, {px: o.px, one: G.one}, rec);
    if (rec) { chipLabelRec(c, n, r, G.f, L, G.one); P.rect("chip " + n, r.x, r.y, r.w, r.h, {fill: tok.pane}); }
  }
  pulse(c, G, st);
  bar(c, G, st, tok, {px: o.px, hid}, rec);
  strip(c, G, st, tok, {px: o.px, q: o.q, look: o.look}, rec);
  tip(c, G, tok, rec, o.q || 1, o.look || "");
}

/* a board point (logical px) in CSS px through the live look: REAL 3D's camera (view.proj), else the 2D user camera (view.cam) */
function pointOf(geo, view, bx, by) {
  const v = view || {}, W = CFG.COLS * CFG.TILE, H = CFG.ROWS * CFG.TILE, cam = v.cam;
  const q = typeof v.proj === "function" ? v.proj(bx, by, 0) : cam ? {x: W / 2 + (cam.x || 0) + (bx - W / 2) * (cam.zoom || 1), y: H / 2 + (cam.y || 0) + (by - H / 2) * (cam.zoom || 1)} : {x: bx, y: by};
  return [Math.round((geo.stage.x + q.x * geo.s) * 2) / 2, Math.round((geo.stage.y + q.y * geo.s) * 2) / 2];
}
/* #tpause over the PAUSE key it paints (stage-relative CSS px, the stage is its container); written on a change only */
let dock = "";
function dockPause(G, geo) {
  const el = G.pause && typeof document !== "undefined" && document && document.getElementById ? document.getElementById("tpause") : null;
  if (!el || !el.style) return;
  const v = [G.pause.x - geo.stage.x, G.pause.y - geo.stage.y, G.pause.w, G.pause.h], k = v.join();
  if (k === dock) return;
  dock = k;
  el.style.left = v[0] + "px"; el.style.top = v[1] + "px"; el.style.width = v[2] + "px"; el.style.height = v[3] + "px"; el.style.right = "auto"; el.style.bottom = "auto";
}

/* the right / bottom reach of the HUD as drawn (the plate's ring, the bar, both widened when they needed it, and the board): #hud's data-r,
   which the analytics card clears; fit writes the board-wide estimate, this the truth once painted */
function reachOf(G, geo, gx = 0) {
  const T0 = HUD[G.lay].ring, S = geo.stage, rs = [{x: S.x, y: S.y, w: S.w + gx, h: S.h}, G.bar, G.plate && ringed(G.plate, T0)].filter(Boolean);
  return Math.ceil(Math.max(...rs.map((r) => r.x + r.w))) + "," + Math.ceil(Math.max(...rs.map((r) => r.y + r.h)));
}

/* main's seam: frame(fit, world, o, look, view) each frame; world null (off GAME) hides #hud once; view = {proj, cam} places the tip's leader */
export function createHud() {
  let shown = false, last = "";
  dock = "";
  return {
    frame(fit, world, o, look, view) {
      if (!fit || typeof fit.hud !== "function") return;
      if (!world) { if (shown) fit.hud(0); shown = false; last = ""; return; }
      const geo = fit.hudGeo && fit.hudGeo(), st = hudState(world, o), rec = P.probe.on && st.play;
      if (!geo) { if (shown) fit.hud(0); shown = false; last = ""; return; }
      if (st.tip && st.tip.t) st.tip.at = pointOf(geo, view, (st.tip.t[0] + 0.5) * CFG.TILE, (st.tip.t[1] + 0.5) * CFG.TILE);
      const key = JSON.stringify([geo, st, look, textScale(), look === "px" && !!pixelArt(), world.level | 0, fit.hudGen ? fit.hudGen() : 0]);
      if (shown && key === last && !rec) return; // under the probe (tools/ui/shots.mjs only) a PLAY frame repaints, so the text-hidden twin is real
      const h = fit.hud(1);
      if (!h) { shown = false; last = ""; return; }
      shown = true; last = key;
      const c = h.ctx, q = h.el && h.w ? h.el.width / h.w : 1;
      c.clearRect(0, 0, h.w, h.h);
      const gx = look === "3d" && geo.gx > 0 ? geo.gx : 0, G = hudGeom(c, geo, st, {w: h.w, h: h.h, at: st.tip && st.tip.at, gx});
      if (rec) P.begin("hud", {w: h.w, h: h.h, dpr: q, el: "hud"});
      drawHud(c, G, st, worldTokens(world.level), {px: look === "px", q, look, rec});
      dockPause(G, geo);
      if (geo.lay === "d" && h.el && h.el.dataset) { const r = reachOf(G, geo, gx); if (h.el.dataset.r !== r) h.el.dataset.r = r; }
    },
  };
}
