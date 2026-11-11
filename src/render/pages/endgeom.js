/* END SCREENS: the one draw / tap contract of WIN and GAME OVER (UI upgrade v202 Task 5.2; design record §4 end screens, appendix 10; the round 7
   E7-end frames). Boot (pointer.js maps a tap through it while the lazy pages, endwin.js and endlose.js, are still on their way). Three modes:
   clear (a mid-run WIN), fin (FUSE/GRID CLEAR, the finale WIN) and lose (GAME OVER). They draw over the board on #c, inside drawOverlay's box
   (600 x 520, iso 608 x 352), never on #sh: a run end keeps #c, its overlay and its taps.
   endFacts(world, run, tm) is every word and claim the page shows, from the run-end facts main hands in (run: the tally, the run-start best
   snapshot, fromStart, daily, fixed, cap, medals; tm: the room time and the best captured before the WIN-edge write). A claim (a ribbon, the
   plaque, the shortfall) is made only at a run end (isRunEnd) from a persisted number, as "a delta that cannot lie" requires; the level-clear
   time ribbon reads the times store's own record (recordTime ran at the WIN edge, tm.best is the record before it). No run (ATTRACT) = no claim.
   endGeom(B, F, o) is the geometry in box units, rects by NAME (plate, the sections, and the keys main / menu / copy / map): o = {lay ("d" desk,
   "p" touch portrait, "l" touch landscape), css (CSS px per box unit, fit.js's stage scale on #c; 1 when unknown), ts (the kit text scale)}.
   Sizes are the mock's CSS px (design px, appendix 10); u = box units per design px = 1 / css, then the gaps give way to a short box (down to
   their floor), then the page scales as one piece. Desk: the mock's plates (level clear 560, finale 840, GAME OVER 200 | 400 two columns over a
   foot row); a touch-portrait box: the phone's one column, every key inside the plate (the board box has no window bottom to dock to).
   endHit(x, y, G) names the key under a tap (main, menu, copy, map) or null: off the keys a tap does nothing (it skips the motion). endTap is
   main's whole tap path: while the page for this mode is not in (LOADING), null; where no page is registered yet, today's tap, the main key. */
import {isFinale, biomeOf} from "../../core/config.js";
import {LABEL, diffTag, multTag, runParts} from "../words.js";
import {fmtTime, fmtSpan, bestLabel, dailyLine, pauseKickers, isRunEnd} from "../scenes.js";
import {textScale} from "../kit/type.js";

const deep = (o) => { for (const v of Object.values(o)) if (v && typeof v === "object") deep(v); return Object.freeze(o); };
/* design px by device (d desk, p phone): L the label cap, the type px (sec pri hud bod), key heights, the course cell, the plate ring T */
export const END = deep({
  d: {L: 14.8, sec: 16, pri: 21, hud: 27, bod: 18, btnh: 50, cell: 40, T: 16, gap: 1.6, side: 24, clearW: 560, finW: 770, loseL: 200, loseR: 400, loseGap: 20, hClear: 50, hFin: 66, hLose: 54},
  p: {L: 11.3, sec: 13.5, pri: 16, hud: 20, bod: 15, btnh: 52, cell: 37, T: 10, gap: 1.2, side: 12, hClear: 38, hFin: 33, hLose: 40},
});
export const KEYS = Object.freeze(["main", "menu", "copy", "map"]);
export const MARGIN = 6, GAP_MIN = 0.5, MOTION = Object.freeze({win: 1.6, lose: 1.4});
export const fmtN = (n) => String(Math.max(0, Math.round(+n || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export const endMode = (w) => (!w ? null : w.state === "LOSE" ? "lose" : w.state === "WIN" ? (isFinale(w.level) || w.finale ? "fin" : "clear") : null);
const runFin = (lv) => (lv <= 5 ? 5 : 8);

function course(mode, lv, run) {
  const r = run || {}, cap = r.cap === 8 ? 8 : 5, start = Math.max(1, Math.min(lv, run ? lv - (r.r | 0) + (mode === "fin" ? 1 : 0) : lv <= 5 ? 1 : 6)), out = [];
  for (let n = 1; n <= 8; n++) {
    let st;
    if (n > cap && n > lv) st = "locked";
    else if (n > lv) st = "ahead";
    else if (n === lv) st = mode === "fin" ? "won" : "crack";
    else if (n >= start) st = mode === "fin" ? "won" : "clear";
    else st = start > 5 ? "clear" : "ahead";
    out.push({n, st, fin: isFinale(n)});
  }
  return out;
}
const timeRib = (lv, tm) => (tm && Number.isFinite(tm.t) && (tm.best == null || tm.t < tm.best) ? {kind: "rib", name: [LABEL.LEVEL + " " + lv + " TIME"], value: fmtTime(tm.t)} : null);

export function endFacts(world, run, tm) {
  const w = world || {}, mode = endMode(w), lv = w.level | 0 || 1, h = Math.max(0, Math.min(2, w.heat | 0)), k = h + 1, s = w.score | 0;
  const end = !!run && isRunEnd(w), b = run && run.best, lvw = LABEL.LEVEL + " " + lv + " · " + biomeOf(lv).name, dly = run && run.daily ? " · DAILY" : "";
  const F = {mode, lv, heat: h, k, fixed: !!(run && run.fixed), daily: !!(run && run.daily), pieces: [], tail: null, note: null};
  F.kick = mode === "clear" ? [lvw] : [lvw + " · " + runParts({heat: w.heat, pace: w.pace, pact: w.pact}, {diff: true}).join(" · ") + dly, ...pauseKickers(w, run)];
  if (mode === "clear") {
    F.head = LABEL.LEVEL + " " + lv + " CLEAR";
    F.stats = [["clock", "TIME", tm && Number.isFinite(tm.t) ? fmtTime(tm.t) : "0:00.0"], ["foe", "ENEMIES", String(run ? run.lk | 0 : 0)], ["item", LABEL.POWER_UPS, String(run ? run.lp | 0 : 0)]];
    const t = timeRib(lv, tm);
    if (t) F.pieces.push(t);
    F.keys = {main: "NEXT LEVEL"};
    return deep(F);
  }
  F.course = course(mode, lv, run);
  if (mode === "fin") {
    F.head = "FUSE/GRID CLEAR";
    F.score = {digits: fmtN(s * k), sub: "SCORE · " + multTag(h)};
    F.stats = [["foe", "ENEMIES", String(run ? run.k | 0 : 0)], ["item", LABEL.POWER_UPS, String(run ? run.p | 0 : 0)], ["clock", "TIME", fmtSpan(run ? run.t : 0)]];
    if (end && F.daily) F.note = dailyLine(w, run);
    const p = [];
    if (end && !F.daily && (b ? s > (b.s | 0) : s > 0)) p.push({kind: "rib", name: ["SCORE · " + bestLabel(w), "SCORE"], value: fmtN(s * k)});
    const t = run ? timeRib(lv, tm) : null;
    if (t) p.push(t);
    for (const m of (end && run.medals) || []) p.push({kind: "medal", name: m[0], desc: m[1]});
    F.pieces = p.length > 3 ? [p[0], p[1], {kind: "more", n: p.length - 2}] : p;
    F.keys = {main: "MENU", copy: true};
    return deep(F);
  }
  F.head = "GAME OVER";
  F.reached = "Reached level " + lv + " of " + runFin(lv) + ".";
  F.scoreLine = {label: "SCORE", value: fmtN(s * k), mult: multTag(h)};
  if (end && F.daily) F.tail = {kind: "daily", text: dailyLine(w, run)};
  else if (end && (b || s > 0)) {
    if (!b || s > (b.s | 0)) F.tail = {kind: "plaque", text: ["NEW BEST · " + bestLabel(w), "NEW BEST"]};
    else if (run.fromStart !== false && lv > (b.r | 0)) F.tail = {kind: "plaque", text: ["FURTHEST " + LABEL.LEVEL + " YET"]};
    else if (s === (b.s | 0)) F.tail = {kind: "short", lead: "Matched", text: "Matched your " + bestLabel(w) + " best (" + fmtN(b.s * k) + ")."};
    else { const lead = fmtN(((b.s | 0) - s) * k) + " points short"; F.tail = {kind: "short", lead, text: lead + " of your " + bestLabel(w) + " best (" + fmtN(b.s * k) + ")."}; }
  }
  F.keys = {main: "TRY AGAIN", sub: F.fixed ? "Same board" : "New board · " + LABEL.LEVEL.toLowerCase() + " 1", menu: true, copy: true};
  return deep(F);
}

/* body lines a sentence takes in w design px at body size px: a conservative estimate (0.6 em a character), so the painter's measured wrap fits */
export const lineCount = (s, w, px) => { let n = 1, at = 0; for (const word of String(s).split(" ")) { const ww = (word.length + 1) * 0.6 * px; if (at && at + ww > w) { n++; at = ww; } else at += ww; } return n; };

/* the sections of one mode as a column: [name, height, width or null (the column), x offset or null (centred)], design px, top to bottom */
function column(F, D, ph, ts, W) {
  const L = D.L, t = (v) => v * ts, line = (px) => t(px * 1.25), rows = [];
  const kick = line(D.sec), head = t((F.mode === "fin" ? D.hFin : F.mode === "lose" ? D.hLose : D.hClear) * 1.08);
  const card = ph ? t(D.sec * 1.25) + 10 : Math.max(3.4 * L, t(D.sec * 1.25 + 5 + D.hud * 1.15)) + 16;
  const rib = (ph ? 15 : 17) + t(D.sec * 1.2 + 3 + D.pri * 1.2 + 3 + (1.6 * L) / 0.72), med = ph ? Math.max(4 * L + 18, t(D.pri * 1.2 + 4 + 2 * D.bod * 1.35)) : 1.2 * L + 4 * L + 4 + 6 + t(D.pri * 1.2 + 4 + 2 * D.bod * 1.35);
  const piece = (p) => (p.kind === "medal" ? med : rib + 1.4 * L + 4);
  if (F.mode === "lose") return null;
  rows.push(["band", kick + 6 + head + (F.mode === "fin" && !ph ? Math.max(0, 5 * L - kick - 6 - head) : 0)]);
  if (F.mode === "fin") {
    rows.push(["score", 3.4 * L + 0.8 * L + line(D.sec) + (F.note ? 6 + line(D.sec) * lineCount(F.note, W, D.sec * ts) : 0)]);
    rows.push(["course", D.cell + 4]);
  }
  rows.push(["tally", card]);
  if (F.pieces.length) rows.push(["shelf", 0.9 * L + 0.5 * L + Math.max(...F.pieces.map(piece))]);
  rows.push(["keys", F.mode === "fin" && ph ? D.btnh + 8 + 46 : D.btnh]);
  return rows;
}

function solve(B, rows, D, o, plateW, pad) {
  const gap = D.gap * D.L, gaps = rows.map((r, i) => (i ? gap : 0)), fixed = rows.reduce((a, r) => a + r[1], 0) + pad[0] + pad[2];
  const T = D.T, u0 = 1 / (o.css > 0 ? o.css : 1), avW = B.w - 2 * MARGIN, avH = B.h - 2 * MARGIN, ring = 2 * (T + 3);
  const natural = fixed + gaps.reduce((a, g) => a + g, 0);
  let g = 1;
  if ((natural + ring) * u0 > avH) g = Math.max(GAP_MIN, (avH / u0 - ring - fixed) / Math.max(1, natural - fixed));
  const H = fixed + (natural - fixed) * g;
  const u = Math.min(u0, avW / (plateW + ring), avH / (H + ring));
  return {u, g, H};
}

export function endGeom(B, F, o = {}) {
  if (!F || !F.mode || !(B && B.w > 0 && B.h > 0)) return null;
  const ph = o.lay === "p", D = END[ph ? "p" : "d"], ts = o.ts > 0 ? o.ts : textScale(), css = o.css > 0 ? o.css : 1, L = D.L;
  const G = {mode: F.mode, ph, ts, d: D, rects: {}, keys: {}};
  const side = F.mode === "lose" ? (ph ? 14 : D.loseGap) : ph ? 12 : D.side, ring = 2 * (D.T + 3);
  const build = (plateW) => {
    const inW = plateW - 2 * side;
    let rows, pad;
    if (F.mode === "lose") {
      const t = (v) => v * ts, rw = ph ? inW : inW - D.loseL - D.loseGap, tail = !F.tail ? 0 : F.tail.kind === "plaque" ? 2.6 * L + 4 : t(D.bod * 1.35) * lineCount(F.tail.text, rw, D.bod * ts);
      const head = ph ? Math.max(5 * L, t(D.hLose * 1.08)) : t(D.hLose * 1.08), tryH = ph ? 64 : 1.32 * D.btnh, foot = ph ? 46 : 0.85 * D.btnh;
      rows = [["kick", t(D.sec * 1.25)], ["head", head], ["reached", t((1.3 * L) / 0.72 * 1.2)], ["course", D.cell + 4], ["score", t((1.6 * L) / 0.72 * 1.15)]];
      if (tail) rows.push(["tail", tail]);
      rows.push(["try", tryH + (ph ? 0 : 0.4 * L)], ["foot", foot]);
      pad = ph ? [16, 14, 18, 14] : [1.4 * L, side, 1.3 * L, side];
    } else {
      rows = column(F, D, ph, ts, inW);
      pad = [1.3 * L, side, 1.5 * L, side];
    }
    return {plateW, inW, rows, pad, ...solve(B, rows, D, {css}, plateW, pad)};
  };
  /* desk: the mock's plate; phone: the column across the box, re-solved at the width the scale leaves (a scaled page takes the width back) */
  let S = build(ph ? Math.min(600, B.w * css - 2 * MARGIN * css) - ring : F.mode === "clear" ? D.clearW * (ts > 1.1 ? 1.18 : 1) : F.mode === "fin" ? D.finW * (ts > 1.1 ? 1.07 : 1) : D.loseL + D.loseR * (ts > 1.1 ? 1.2 : 1) + 3 * D.loseGap);
  if (ph) for (let i = 0; i < 3; i++) { const w = Math.min(600, (B.w - 2 * MARGIN) / S.u - ring); if (Math.abs(w - S.plateW) < 0.5) break; S = build(w); }
  const {plateW, inW, rows, pad, u, g, H} = S;
  const pw = plateW * u, phh = H * u, px = Math.round((B.w - pw) / 2), py = Math.round((B.h - phh) / 2);
  G.u = u; G.T = D.T * u; G.L = L * u; G.cssK = css;
  G.plate = {x: px, y: py, w: pw, h: phh};
  const R = (x, y, w, h) => ({x: px + x * u, y: py + y * u, w: w * u, h: h * u});
  let y = pad[0];
  const colX = F.mode === "lose" && !ph ? side + D.loseL + D.loseGap : side, colW = F.mode === "lose" && !ph ? inW - D.loseL - D.loseGap : inW;
  rows.forEach(([name, h], i) => {
    if (i) y += D.gap * L * g * (F.mode === "lose" && !ph && name === "foot" ? 1 : F.mode === "lose" && !ph ? 1.4 / 1.6 : 1);
    if (F.mode === "lose" && !ph && name === "foot") G.rects.foot = R(side, y, inW, h);
    else G.rects[name] = R(colX, y, colW, h);
    y += h;
  });
  if (F.mode === "lose" && !ph) G.rects.bomb = R(side, pad[0] + 1.2 * L, D.loseL, Math.min(260, G.rects.try.y / u - py / u - pad[0]));
  const kr = G.rects;
  if (F.mode === "lose") {
    const t0 = kr.try, th = ph ? 64 : 1.32 * D.btnh;
    G.keys.main = {x: t0.x, y: t0.y + t0.h - th * u, w: t0.w, h: th * u};
    const f = kr.foot, gp = 12 * u, n = 3, wt = ph ? [1, 1.3, 1.1] : [1, 1.35, 1.25], sum = wt.reduce((a, b) => a + b, 0);
    let x = f.x;
    ["menu", "copy", "map"].forEach((name, i) => { const w = (f.w - (n - 1) * gp) * wt[i] / sum; G.keys[name] = {x, y: f.y, w, h: f.h}; x += w + gp; });
  } else if (F.mode === "fin") {
    const r = kr.keys, gp = (ph ? 8 : 12) * u, ch = (ph ? 46 : 0.85 * D.btnh) * u;
    if (ph) {
      G.keys.main = {x: r.x, y: r.y, w: r.w, h: D.btnh * u};
      const kw = (r.w - gp) / 2;
      G.keys.copy = {x: r.x, y: r.y + r.h - ch, w: kw, h: ch};
      G.keys.map = {x: r.x + kw + gp, y: r.y + r.h - ch, w: kw, h: ch};
    } else {
      const mw = Math.min(r.w * 0.42, 300 * u * (ts > 1.1 ? 1 : 1.1)), rest = r.w - mw - 16 * u, kw = (rest - gp) / 2, cy = r.y + (r.h - ch) / 2;
      G.keys.main = {x: r.x, y: r.y, w: mw, h: r.h};
      G.keys.copy = {x: r.x + mw + 16 * u, y: cy, w: kw * 1.06, h: ch};
      G.keys.map = {x: r.x + mw + 16 * u + kw * 1.06 + gp, y: cy, w: kw * 0.94, h: ch};
    }
  } else G.keys.main = {...kr.keys};
  return G;
}

export function endHit(x, y, G) {
  if (!G) return null;
  for (const n of KEYS) { const r = G.keys[n]; if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return n; }
  return null;
}
/* main's tap: ready(mode) is true once that mode's page is in, false while it loads, null where no page is registered (today's tap: the main key) */
export function endTap(x, y, B, world, run, tm, o, ready) {
  const mode = endMode(world), r = ready ? ready(mode) : null;
  if (!mode) return null;
  if (r == null) return "main";
  if (!r) return null;
  return endHit(x, y, endGeom(B, endFacts(world, run, tm), o));
}
