/* NEXT-RUN CARD (UI upgrade v202 Task 3.2; design record §4 MENU / LEVEL SELECT, appendix 7.2 / 7.4; the round 7 S7-menu / L7-logo m1-menu frames).
   One module for MENU's card slot and LEVEL SELECT's card (Task 3.3), fed names and values only: d = {level, heat, pact} (the run PLAY starts), plus
   d.kick (a kicker in place of NEXT RUN · LEVEL n) and d.best (a word in place of the level's mark, LEVEL SELECT's BEST) where a page wants them.
   What it shows is true of every run it starts: the world, the lane (kit room.js: the representative start corner, MAKO on his spawn FLOOR cell, the
   room's first foe and its floor tile; never the dealt board, which every ordinary run deals anew), every roster foe with its count (heatRoster, ×1
   included), the floor tile (core feat HOME / TILE_NAME / TILE_HELP at the run's heat), LIVES / FUSE / SCORE (heatProfile through applyPact).
   cardPlan(c, box, d, dev) lays it out in box (design px; dev "d" desk, "p" phone) and measures through c: desk is the mock's stack (kicker, the world in
   display type, the lane 14 cells across, YOU'LL MEET with the names, the foe cells, the floor tile with its help, three stat cells anchored to the
   bottom); phone is the lane 9 across, LEVEL n · WORLD, the foes, the floor tile, one LIVES / FUSE / SCORE line. The lane gives way first (down to
   LANE rows, MAKO always whole), then the foe cells step down, then the gaps; a quiet line that does not fit is dropped, never cut. The plan holds
   every text (its font, colour and role), every part's rect (parts never overlap) and key, the string a cache keys the card by.
   paintCard(c, P, tok, o) paints it (static: the page bakes it into a layer; o.dpr, the layer's device px per design px, sizes its wall cell);
   recordCard(P, rect, text) hands its rect and texts to the page's probe. */
import {biomeOf, isFinale} from "../../core/config.js";
import {heatRoster, heatProfile, clampHeat} from "../../core/heat.js";
import {applyPact} from "../../core/pact.js";
import {HOME, TILE_NAME, TILE_HELP} from "../../core/feat.js";
import {FOES} from "../../core/entities.js";
import {LABEL, CARD_WORDS as CW} from "../words.js";
import {CONST} from "../kit/tokens.js";
import {wallCell} from "../kit/paint.js";
import {T, DEV, measure, textScale} from "../kit/type.js";
import {lane, laneGrid, foeCell, tileCell} from "../kit/room.js";
import {layer, canMake} from "../kit/cache.js";
import {drawIcon} from "../icons.js";

const deep = (o) => { for (const v of Object.values(o)) if (v && typeof v === "object") deep(v); return Object.freeze(o); };
/* pad [y, x] inside the slot (the wall-cell frame T sits in it); lane [least, most] rows; foe the cell sizes tried, largest first (grow: the phone's
   most, from slack); gap the section gaps tried; cg / rg a foe item's column / row gap; tile the floor tile cell; heart the LIVES heart (the appendix's item size) */
export const CARD = deep({
  d: {pad: [18, 22], T: 10, cols: 14, lane: [1.85, 2.5], lane125: [1.85, 2.1], foe: [40, 34, 30, 26], gap: [12, 8, 6], cg: 12, rg: 8, tile: 40, heart: 20},
  p: {pad: [14, 14], T: 8, cols: 9, lane: [1.85, 3], lane125: [1.85, 3], foe: [28, 26, 24, 22], grow: 36, gap: [10, 8, 6], cg: 10, rg: 6, tile: 28, heart: 22},
});
export const TZ = "#bcad9a", HEART = "#ff3b5c";
export const cardLane = laneGrid;

/* heatRoster deduped to [{t, n}] in first-seen order: the one roster (menudraw re-exports it) */
export function rosterOf(level, heat) {
  const out = [];
  for (const t of heatRoster(level, heat)) { const e = out.find((o) => o.t === t); if (e) e.n++; else out.push({t, n: 1}); }
  return out;
}
export function cardFacts(d) {
  const level = d.level | 0 || 1, h = clampHeat(d.heat), b = biomeOf(level), p = applyPact(heatProfile(h), d.pact | 0), k = HOME[b.name], fin = isFinale(level), roster = rosterOf(level, h);
  return {level, heat: h, world: b.name, fin, mark: level === 1 ? CW.FIRST : level >= 8 ? CW.LAST : fin ? CW.FINALE : "", roster,
    names: roster.map((e) => (FOES.find((f) => f.t === e.t) || {name: e.t}).name), tile: {kind: k, name: TILE_NAME[k] || "", help: (TILE_HELP[k] || [])[h] || ""},
    lives: p.lives, fuse: p.fuse + "s", score: "×" + (h + 1)};
}

const W = (c, f, s) => measure(c, f, s);
function fit(c, f, cands, room, two) {
  for (const s of cands) {
    if (!s) continue;
    if (W(c, f, s) <= room) return [s];
    /* two lines: the break that fits with the most even lines, so no word is left alone below */
    let best = null;
    if (two) for (let i = s.indexOf(" "); i > 0; i = s.indexOf(" ", i + 1)) { const a = s.slice(0, i), b = s.slice(i + 1), w = Math.max(W(c, f, a), W(c, f, b)); if (w <= room && (!best || w < best.w)) best = {w, l: [a, b]}; }
    if (best) return best.l;
  }
  return [];
}
/* foe items (cell, 6 px, ×n) in rows across iw: the row of each and its x */
function flow(cw, fs, K, iw) {
  let x = 0, row = 0;
  const at = cw.map((w0) => { const w = fs + 6 + w0; if (x > 0 && x + w > iw + 1e-9) { row++; x = 0; } const q = {x, row, w}; x += w + K.cg; return q; });
  const n = row + 1;
  return {at, rows: n, h: n * fs + (n - 1) * K.rg + 3};
}

export function cardPlan(c, box, d, dev = "d") {
  const desk = dev !== "p", K = CARD[desk ? "d" : "p"], dv = DEV[desk ? "d" : "p"], ts = textScale(), F = cardFacts(d), big = ts > 1.1;
  const x0 = box.x + K.pad[1], iw = box.w - 2 * K.pad[1], y0 = box.y + K.pad[0], ih = box.h - 2 * K.pad[0], s = iw / K.cols, [lmin, lmax] = big ? K.lane125 : K.lane;
  const lS = dv.sec * ts * 1.2, lP = dv.pri * ts * 1.15, fS = T.label(dv.sec), fP = T.label(dv.pri), fN = T.num(dv.pri), titleH = dv.ttl * ts;
  /* a count reads at the label size beside a full cell, one step down (the secondary size) beside a stepped-down one, so it never outweighs its foe */
  const cnt = F.roster.map((e) => "×" + e.n), cpx = (fs) => (fs >= K.foe[1] ? dv.pri : dv.sec), cw = (fs) => cnt.map((q) => W(c, T.num(cpx(fs)), q));
  const floorH = desk ? Math.max(K.tile + 3, lS + 2 + lP) : Math.max(K.tile + 3, lP), hud = dv.hud * ts;
  const statsH = desk ? 4 + 7 + lS + 6 + hud + 8 + 4 : Math.max(lS, lP, K.heart);
  const fixedOf = (g, fl) => (desk ? lS + 2 + titleH + g + g + lS + 8 + fl.h + g + floorH + g + statsH : g + lP + g + fl.h + g + floorH + g + statsH);
  let S = null;
  search: for (const g of K.gap) for (const fs of K.foe) {
    const fl = flow(cw(fs), fs, K, iw), room = ih - fixedOf(g, fl);
    S = {g, fs, fl, rows: Math.max(lmin, Math.min(lmax, room / s)), over: room < lmin * s - 1e-9};
    if (!S.over) break search;
  }
  /* the phone's slot is the height left: once the lane is at its most, the foe cells grow into the slack (up to grow, in as many rows), then the gaps */
  if (!desk && !S.over) for (let fs = S.fs + 2; fs <= K.grow; fs += 2) { const fl = flow(cw(fs), fs, K, iw); if (fl.rows !== S.fl.rows || ih - fixedOf(S.g, fl) < lmax * s) break; S = {...S, fs, fl, rows: lmax}; }
  const P = {box, dev: desk ? "d" : "p", level: F.level, T: K.T, inner: {x: x0, y: y0, w: iw, h: ih}, facts: F, over: S.over, texts: [], parts: [], foes: [], hearts: [], lane: null, tile: null, stats: null,
    key: JSON.stringify([F.level, F.heat, F.lives, d.kick || "", d.best || "", dev])};
  const tx = (s0, x, y, f, px, col, o = {}) => { const t = {s: s0, x, y, f, px, col, role: o.role || "secondary", align: o.align || "left", kind: o.kind || "lbl", w: W(c, f, s0)}; P.texts.push(t); return t; };
  const part = (name, x, y, w, h) => P.parts.push({name, x, y, w, h});
  const tpart = (t) => part("text " + t.s, t.align === "right" ? t.x - t.w : t.x, t.y - t.px * ts / 2, t.w, t.px * ts);
  const laneAt = (y, rows) => {
    const g = laneGrid(F.level), ox = x0 + 2, oy = y + 2 - 0.3 * s, cell = (q) => ({cx: q.x, cy: q.y, x: ox + q.x * s, y: oy + q.y * s, w: s, h: s, kind: g.grid[q.y * g.cols + q.x]});
    P.lane = {x: x0, y, w: iw, h: rows * s, rows, cols: K.cols, s, mako: cell(g.mako), foe: cell(g.foe), tile: cell(g.tile)};
    part("lane", x0, y, iw, rows * s);
    return rows * s;
  };
  const foesAt = (y) => {
    F.roster.forEach((e, i) => {
      const q = S.fl.at[i], x = x0 + q.x, yy = y + q.row * (S.fs + K.rg), px = cpx(S.fs), t = tx(cnt[i], x + S.fs + 6, yy + S.fs / 2, T.num(px), px, CONST.ink, {role: px === dv.pri ? "primary" : "secondary", kind: "num"});
      P.foes.push({t: e.t, n: e.n, x, y: yy, s: S.fs, cnt: t});
      part("foe " + e.t, x, yy, S.fs, S.fs + 3); tpart(t);
    });
  };
  let y = y0;
  if (desk) {
    const kick = d.kick || CW.NEXT + " · " + LABEL.LEVEL + " " + F.level, kl = tx(kick, x0, y + lS / 2, fS, dv.sec, CONST.t2), right = d.best || F.mark;
    tpart(kl);
    const mk = fit(c, fS, [right], iw - kl.w - 12)[0];
    if (mk) tpart(tx(mk, x0 + iw, y + lS / 2, fS, dv.sec, TZ, {align: "right"}));
    y += lS + 2;
    tpart(tx(F.world, x0, y + titleH / 2, T.display(dv.ttl), dv.ttl, CONST.ink, {role: "primary", kind: "dsp"}));
    y += titleH + S.g;
    y += laneAt(y, S.rows) + S.g;
    const ml = tx(CW.MEET, x0, y + lS / 2, fS, dv.sec, CONST.t2);
    tpart(ml);
    const nm = fit(c, fS, [F.names.join(" · "), F.roster.length + " " + CW.ENEMIES], iw - ml.w - 12)[0];
    if (nm) tpart(tx(nm, x0 + iw, y + lS / 2, fS, dv.sec, TZ, {align: "right"}));
    y += lS + 8;
    foesAt(y);
    y += S.fl.h + S.g;
    P.tile = {x: x0, y: y + (floorH - K.tile - 3) / 2, s: K.tile};
    part("tile", P.tile.x, P.tile.y, K.tile, K.tile + 3);
    const cx = x0 + K.tile + 12, top = y + (floorH - (lS + 2 + lP)) / 2;
    const a = tx(CW.TILE, cx, top + lS / 2, fS, dv.sec, CONST.t2), b = tx(F.tile.name, cx, top + lS + 2 + lP / 2, fP, dv.pri, CONST.ink, {role: "primary"});
    tpart(a); tpart(b);
    const hr = Math.min(iw * 0.52, x0 + iw - (cx + Math.max(a.w, b.w)) - 12), hl = fit(c, fS, [F.tile.help], hr, true);
    hl.forEach((q, i) => tpart(tx(q, x0 + iw, y + floorH / 2 + (i - (hl.length - 1) / 2) * lS, fS, dv.sec, TZ, {align: "right"})));
    const sy = y0 + ih - statsH, chipW = (iw - 16) / 3, ch = statsH - 8, vy = sy + 4 + 7 + lS + 6 + hud / 2;
    P.stats = {x: x0, y: sy, w: iw, h: statsH, chips: []};
    part("stats", x0, sy, iw, statsH);
    const vals = [F.fuse, F.score], vf = [dv.hud, dv.pri].find((px) => vals.every((v) => W(c, T.num(px), v) <= chipW - 20)) || dv.pri;
    [CW.LIVES, CW.FUSE, CW.SCORE].forEach((l, i) => {
      const cx2 = x0 + 4 + i * (chipW + 4);
      P.stats.chips.push({x: cx2, y: sy + 4, w: chipW, h: ch});
      tx(l, cx2 + 10, sy + 4 + 7 + lS / 2, fS, dv.sec, CONST.t2);
      if (i) tx(vals[i - 1], cx2 + 10, vy, T.num(vf), vf, CONST.ink, {role: vf === dv.hud ? "hud" : "primary", kind: "num"});
    });
    const hs = Math.min(K.heart, (chipW - 20 - 8) / 3);
    for (let i = 0; i < Math.min(F.lives, 3); i++) P.hearts.push({x: x0 + 4 + 10 + i * (hs + 4), y: vy - hs / 2, s: hs});
    return P;
  }
  const extra = Math.max(0, ih - fixedOf(S.g, S.fl) - S.rows * s) / 4, g = S.g + extra;
  y += laneAt(y, S.rows) + g;
  const nl = tx(LABEL.LEVEL + " " + F.level + " · " + F.world, x0, y + lP / 2, fP, dv.pri, CONST.ink, {role: "primary"});
  tpart(nl);
  const mk = fit(c, fS, [d.best || F.mark], iw - nl.w - 12)[0];
  if (mk) tpart(tx(mk, x0 + iw, y + lP / 2, fS, dv.sec, TZ, {align: "right"}));
  y += lP + g;
  foesAt(y);
  y += S.fl.h + g;
  P.tile = {x: x0, y: y + (floorH - K.tile - 3) / 2, s: K.tile};
  part("tile", P.tile.x, P.tile.y, K.tile, K.tile + 3);
  const tn = tx(F.tile.name, x0 + K.tile + 10, y + floorH / 2, fP, dv.pri, CONST.ink, {role: "primary"});
  tpart(tn);
  const hl = fit(c, fS, [F.tile.help], x0 + iw - (tn.x + tn.w) - 12)[0];
  if (hl) tpart(tx(hl, x0 + iw, y + floorH / 2, fS, dv.sec, TZ, {align: "right"}));
  y += floorH + g;
  /* one stats line: LIVES and its hearts, FUSE, SCORE; SCORE drops where the line would not fit */
  const hs = K.heart, cy = y + statsH / 2, groups = [[CW.LIVES, null], [CW.FUSE, F.fuse], [CW.SCORE, F.score]];
  const gw = groups.map(([l, v]) => W(c, fS, l) + 6 + (v == null ? Math.min(F.lives, 3) * (hs + 4) - 4 : W(c, fN, v)));
  let n = 3;
  while (n > 2 && gw.slice(0, n).reduce((a, b) => a + b, 0) + (n - 1) * 16 > iw) n--;
  let x = x0;
  groups.slice(0, n).forEach(([l, v], i) => {
    const t = tx(l, x, cy, fS, dv.sec, CONST.t2);
    if (v == null) for (let j = 0; j < Math.min(F.lives, 3); j++) P.hearts.push({x: t.x + t.w + 6 + j * (hs + 4), y: cy - hs / 2, s: hs});
    else tx(v, t.x + t.w + 6, cy, fN, dv.pri, CONST.ink, {role: "primary", kind: "num"});
    x += gw[i] + 16;
  });
  P.stats = {x: x0, y, w: x - 16 - x0, h: statsH, chips: []};
  part("stats", x0, y, x - 16 - x0, statsH);
  return P;
}

/* the slab (appendix 7.2): the pane inside a frame of the world's wall cells T wide, veiled, outlined both sides. With a canvas source the wall cell is
   painted once into a T x dpr layer (kit cache, keyed by world, T and dpr) and blitted round the frame, so a cold fill costs ~180 blits, not ~180
   wall paints; with none (Node) each cell paints straight onto c. */
function slab(c, r, tok, T0, dpr) {
  const d = dpr > 0 ? dpr : 1, n = Math.max(1, Math.ceil(T0 * d));
  const cell = canMake() ? layer({layer: "card.wall|" + T0, biome: tok.name, level: 0, W: n, H: n, dpr: d, look: "2d", textScale: 1}, n, n, (g) => { g.scale(n / T0, n / T0); wallCell(g, 0, 0, T0, tok, {code: 1}); }) : null;
  c.save();
  c.fillStyle = tok.pane; c.fillRect(r.x, r.y, r.w, r.h);
  c.beginPath(); c.rect(r.x, r.y, r.w, r.h); c.rect(r.x + T0, r.y + T0, r.w - 2 * T0, r.h - 2 * T0); c.clip("evenodd");
  for (let y = 0; y < r.h; y += T0) for (let x = 0; x < r.w; x += T0) {
    if (!(x < T0 || y < T0 || x + T0 > r.w - T0 || y + T0 > r.h - T0)) continue;
    if (cell) c.drawImage(cell, r.x + x, r.y + y, T0, T0); else wallCell(c, r.x + x, r.y + y, T0, tok, {code: 1});
  }
  c.fillStyle = "rgba(6,4,6,0.42)"; c.fillRect(r.x, r.y, r.w, r.h);
  c.restore();
  c.strokeStyle = CONST.ol; c.lineWidth = 2; c.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2); c.strokeRect(r.x + T0 - 1, r.y + T0 - 1, r.w - 2 * T0 + 2, r.h - 2 * T0 + 2);
}
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
export function paintCard(c, P, tok, o = {}) {
  slab(c, P.box, tok, P.T, o.dpr);
  const L = P.lane;
  lane(c, L.x, L.y, L.w, L.rows, P.level, tok, {cols: L.cols});
  for (const q of P.foes) foeCell(c, q.x, q.y, q.s, q.t, P.level);
  tileCell(c, P.tile.x, P.tile.y, P.tile.s, P.level);
  if (P.stats.chips.length) {
    const S = P.stats;
    c.fillStyle = CONST.ol; rr(c, S.x, S.y, S.w, S.h, 8); c.fill();
    for (const q of S.chips) {
      c.save(); rr(c, q.x, q.y, q.w, q.h, 5); c.fillStyle = tok.pane; c.fill(); c.clip();
      c.fillStyle = "rgba(0,0,0,0.4)"; c.fillRect(q.x, q.y, q.w, 2);
      c.restore();
    }
  }
  for (const h of P.hearts) { c.save(); c.translate(h.x + h.s / 2 - 0.4 * h.s / 25, h.y + h.s / 2 - 1.7 * h.s / 25); c.scale(h.s / 25, h.s / 25); drawIcon(c, "heart", HEART, 0); c.restore(); }
  for (const t of P.texts) {
    c.font = t.f; c.textAlign = t.align; c.textBaseline = "middle";
    /* display type (kit type.js dsp, painted without its measure: a layer context may not measure): the 0.12 em outline, the hard 0.08 em drop */
    if (t.kind === "dsp") { const em = t.px * textScale(); c.lineJoin = "round"; c.lineWidth = em * 0.12; c.strokeStyle = c.fillStyle = CONST.ol; c.strokeText(t.s, t.x, t.y + em * 0.08); c.fillText(t.s, t.x, t.y + em * 0.08); c.strokeText(t.s, t.x, t.y); }
    c.fillStyle = t.col; c.fillText(t.s, t.x, t.y);
  }
}
/* the probe's view: the card's rect (no tap target, no fill) and every text with its colour and role, in the page's design px */
export function recordCard(P, rect, text) {
  rect("card", P.box.x, P.box.y, P.box.w, P.box.h);
  for (const t of P.texts) text(t.s, t.align === "right" ? t.x - t.w : t.x, t.y, t.w, t.px, t.col, t.role);
}
