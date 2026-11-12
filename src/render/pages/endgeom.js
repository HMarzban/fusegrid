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
   Sizes are the mock's CSS px (design px, appendix 10) at u = 1 / css box units per design px, never scaled under the floors: a short box
   closes the gaps, then pages the content (see endGeom). The page sits under the HUD band (HUD_TOP). Desk: the mock's plates (level clear 560, finale 840, GAME OVER 200 | 400 two columns over a
   foot row); a touch-portrait box: the phone's one column, every key inside the plate (the board box has no window bottom to dock to).
   endHit(x, y, G) names the key under a tap (main, menu, copy, map; up / down the pager's) or null: off the keys a tap does nothing (it skips the motion). endTap is
   main's whole tap path: while the page for this mode is not in (LOADING), null; where no page is registered yet, today's tap, the main key. */
import {isFinale, biomeOf} from "../../core/config.js";
import {LABEL, diffTag, multTag, runParts, END_WORDS as EW, MENU} from "../words.js";
import {fmtTime, fmtSpan, bestLabel, dailyLine, pauseKickers, isRunEnd} from "../scenes.js";
import {T, DEV, measure, textScale} from "../kit/type.js";
import {hints} from "../hintcopy.js";

const deep = (o) => { for (const v of Object.values(o)) if (v && typeof v === "object") deep(v); return Object.freeze(o); };
/* design px by device (d desk, p phone): L the label cap, the type px (sec pri hud bod), key heights, the course cell, the plate ring T */
export const END = deep({
  d: {L: 14.8, sec: 16, pri: 21, hud: 27, bod: 18, btnh: 50, cell: 40, T: 16, gap: 1.6, side: 24, clearW: 560, finW: 840, loseL: 200, loseR: 400, loseGap: 20, hClear: 50, hFin: 66, hLose: 54},
  p: {L: 11.3, sec: 13.5, pri: 16, hud: 20, bod: 15, btnh: 52, cell: 37, T: 10, gap: 1.2, side: 12, hClear: 38, hFin: 33, hLose: 40},
});
export const KEYS = Object.freeze(["main", "menu", "copy", "map", "up", "down"]);
export const MARGIN = 6, HUD_TOP = 42, GAP_MIN = 0.25, MOTION = Object.freeze({win: 1.6, lose: 1.4});
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
const timeRib = (lv, tm) => (tm && Number.isFinite(tm.t) && (tm.best == null || tm.t < tm.best) ? {kind: "rib", name: [LABEL.LEVEL + " " + lv + " " + EW.TIME], value: fmtTime(tm.t)} : null);

/* a medal's rule as the end page's body copy (appendix 10.3: sentence case, "Levels 1 to 5 in one run, no life lost."): the MEDALS page keeps the
   caps row (medals.js MEDAL_ROWS); a setting's name stays in caps as everywhere in body copy (NORMAL DIFFICULTY, FAST SPEED, DEFAULT RULES) */
const KEEP = /^(?:(?:NORMAL|HARD|EXPERT) DIFFICULTY|(?:SLOW|NORMAL|FAST) SPEED|DEFAULT RULES)$/;
export function ruleSentence(s) {
  const parts = String(s || "").replace(/(\d)-(\d)/g, "$1 to $2").split(/\s*·\s*/).filter(Boolean);
  if (!parts.length) return "";
  const out = parts.map((q) => q.split(/((?:NORMAL|HARD|EXPERT) DIFFICULTY|(?:SLOW|NORMAL|FAST) SPEED|DEFAULT RULES)/).map((t) => (KEEP.test(t) ? t : t.toLowerCase())).join("")).join(", ");
  return out.charAt(0).toUpperCase() + out.slice(1) + ".";
}
export function endFacts(world, run, tm) {
  const w = world || {}, mode = endMode(w), lv = w.level | 0 || 1, h = Math.max(0, Math.min(2, w.heat | 0)), k = h + 1, s = w.score | 0;
  const end = !!run && isRunEnd(w), b = run && run.best, lvw = LABEL.LEVEL + " " + lv + " · " + biomeOf(lv).name, dly = run && run.daily ? " · " + EW.DAILY : "";
  const F = {mode, lv, heat: h, k, fixed: !!(run && run.fixed), daily: !!(run && run.daily), pieces: [], tail: null, note: null};
  F.kick = mode === "clear" ? [lvw] : [lvw + " · " + runParts({heat: w.heat, pace: w.pace, pact: w.pact}, {diff: true}).join(" · ") + dly, ...pauseKickers(w, run)];
  if (mode === "clear") {
    F.head = LABEL.LEVEL + " " + lv + " " + EW.CLEAR;
    F.stats = [["clock", EW.TIME, tm && Number.isFinite(tm.t) ? fmtTime(tm.t) : "0:00.0"], ["foe", EW.ENEMIES, String(run ? run.lk | 0 : 0)], ["item", LABEL.POWER_UPS, String(run ? run.lp | 0 : 0)]];
    const t = timeRib(lv, tm);
    if (t) F.pieces.push(t);
    F.keys = {main: EW.NEXT};
    return deep(F);
  }
  F.course = course(mode, lv, run);
  if (mode === "fin") {
    F.head = EW.FUSE_CLEAR;
    F.score = {digits: fmtN(s * k), sub: EW.SCORE + " · " + multTag(h), subs: [EW.SCORE + " · " + multTag(h), multTag(h)]};
    F.stats = [["foe", EW.ENEMIES, String(run ? run.k | 0 : 0)], ["item", LABEL.POWER_UPS, String(run ? run.p | 0 : 0)], ["clock", EW.TIME, fmtSpan(run ? run.t : 0)]];
    if (end && F.daily) F.note = dailyLine(w, run);
    /* the finale that first opens levels 6-8 says so: run.opened is main's persisted fact (endRun saves the unlock on this run-end edge) */
    if (end && run.opened) F.opened = LABEL.LEVELS + " " + EW.OPEN;
    const p = [];
    if (end && !F.daily && (b ? s > (b.s | 0) : s > 0)) p.push({kind: "rib", name: [EW.SCORE + " · " + bestLabel(w), EW.SCORE], value: fmtN(s * k)});
    const t = run ? timeRib(lv, tm) : null;
    if (t) p.push(t);
    for (const m of (end && run.medals) || []) p.push({kind: "medal", name: m[0], desc: ruleSentence(m[1])});
    F.pieces = p.length > 3 ? [p[0], p[1], {kind: "more", n: p.length - 2}] : p;
    F.keys = {main: MENU, copy: true};
    return deep(F);
  }
  F.head = EW.OVER;
  F.reached = "Reached level " + lv + " of " + runFin(lv) + ".";
  F.scoreLine = {label: EW.SCORE, value: fmtN(s * k), mult: multTag(h)};
  if (end && F.daily) F.tail = {kind: "daily", text: dailyLine(w, run)};
  else if (end && (b || s > 0)) {
    if (!b || s > (b.s | 0)) F.tail = {kind: "plaque", text: [EW.NEW_BEST + " · " + bestLabel(w), EW.NEW_BEST]};
    else if (run.fromStart !== false && lv > (b.r | 0)) F.tail = {kind: "plaque", text: [EW.FURTHEST + " " + LABEL.LEVEL + " " + EW.YET]};
    else if (s === (b.s | 0)) F.tail = {kind: "short", lead: "Matched", text: "Matched your " + bestLabel(w) + " best (" + fmtN(b.s * k) + ")."};
    else { const lead = fmtN(((b.s | 0) - s) * k) + " points short"; F.tail = {kind: "short", lead, text: lead + " of your " + bestLabel(w) + " best (" + fmtN(b.s * k) + ")."}; }
  }
  F.keys = {main: EW.AGAIN, sub: F.fixed ? "Same board" : "New board · " + LABEL.LEVEL.toLowerCase() + " 1", menu: true, copy: true};
  return deep(F);
}

/* body lines a sentence takes in w design px at px: the real measure (m, a 2D context: the page's own, or scenes' measuring context for a tap);
   with no context (Node with no recorder) a 0.6 em estimate, which only a test without a context ever sees */
/* the words a line may break between: a run of capital words is one (a setting's name, FEWER ITEMS or EXPERT DIFFICULTY, never split) */
export const tokensOf = (s) => String(s).split(" ").reduce((a, w) => { const caps = /^[A-Z][A-Z-]*$/.test(w); if (caps && a.length && /^[A-Z][A-Z -]*$/.test(a[a.length - 1]) && a[a.length - 1] !== "·") a[a.length - 1] += " " + w; else a.push(w); return a; }, []);
export function lineCount(s, w, px, m, face = "body") {
  const wd = (t) => wOf(m, face, t, px);
  let n = 1, line = "";
  for (const word of tokensOf(s)) { const t = line ? line + " " + word : word; if (line && wd(t) > w) { n++; line = word; } else line = t; }
  return n;
}

/* the course cell: the device's size, smaller where eight cells and their gaps would not fit the column (cells are no touch targets) */
export const cellOf = (D, ph, W) => Math.min(D.cell, Math.floor((W - 7 * (ph ? 3 : 6)) / 8));
/* a text's width in design px: the real measure on m, else the 0.6 em estimate (Node with no context) */
const wOf = (m, face, s, px) => { const w = m ? measure(m, T[face](px), String(s)) : NaN; return Number.isFinite(w) ? w : String(s).length * 0.6 * px * textScale(); };
const wrapW = (m, face, s, px, w) => { const out = []; let line = ""; for (const word of tokensOf(s)) { const t = line ? line + " " + word : word; if (line && wOf(m, face, t, px) > w) { out.push(line); line = word; } else line = t; } if (line) out.push(line); return out; };
/* a record piece's name, the first of its candidates within 18 L (a whole statement, never a cut one), and its width in design px (the painter
   draws at exactly this: endkit pieceW calls it). A ribbon is at least 9 L wide; a medal its octagon, name + NEW tag and two lines of rule (19 L) */
export const pieceName = (q, L, ph, m) => (q.kind === "more" ? "+" + q.n + " " + EW.MORE : q.kind === "medal" ? q.name : [].concat(q.name).find((s) => wOf(m, "label", s, END[ph ? "p" : "d"].pri) <= 18 * L) || [].concat(q.name).pop());
export function pieceWidth(q, L, ph, m) {
  const D = END[ph ? "p" : "d"], pad = ph ? 9 : 16, name = pieceName(q, L, ph, m);
  if (q.kind !== "medal") return Math.max(9 * L, wOf(m, "label", EW.NEW_BEST, D.sec) + 2 * pad, wOf(m, "label", name, D.pri) + 2 * pad, wOf(m, "num", q.value || "", (1.6 * L) / 0.72) + 2 * pad);
  const nw = wOf(m, "label", name, D.pri) + 8 + wOf(m, "label", EW.NEW, D.sec) + 26, bw = Math.min(RULE_L * L, Math.max(...wrapW(m, "body", q.desc, D.bod, RULE_L * L).slice(0, 2).map((t) => wOf(m, "body", t, D.bod))));
  return ph ? 4 * L + 12 + Math.max(nw, bw) : Math.max(4 * L + 4, nw, bw);
}
/* a medal's rule takes one line where RULE_L L holds it, else two */
export const RULE_L = 24;
export const ruleLines = (q, L, ph, m) => Math.min(2, wrapW(m, "body", q.desc, END[ph ? "p" : "d"].bod, RULE_L * L).length);
/* the shelves: the pieces packed into rows of W at 1.6 L gaps (0.9 L on a phone), in order; each row is its own wall course (a phone's medal on a
   shelf of its own, as the mock) and its own section, so a page holds whole shelves */
export function shelvesOf(pieces, L, ph, m, W) {
  const gp = (ph ? 0.9 : 1.6) * L, out = [];
  let cur = [], at = 0;
  pieces.forEach((q, i) => { const w = pieceWidth(q, L, ph, m); if (cur.length && at + gp + w > W) { out.push(cur); cur = []; at = 0; } at += (cur.length ? gp : 0) + w; cur.push(i); });
  if (cur.length) out.push(cur);
  return out;
}

/* the phone's ledger of stats: one row "LABEL value" thirds, stacked one a line where the three do not fit W (text 1.25) */
export const ledgerStacked = (stats, D, W, m) => stats.reduce((a, [, l, v]) => a + wOf(m, "label", l, D.sec) + 6 + wOf(m, "num", v, D.sec + 2), 0) + 8 * (stats.length - 1) > W - 16;
/* GAME OVER's score line: SCORE, the saved score, its multiplier named; the multiplier takes a line of its own where the column is narrow */
export const scoreSplit = (F, D, W, m) => wOf(m, "label", F.scoreLine.label, D.pri) + 12 + wOf(m, "num", F.scoreLine.value, (1.6 * D.L) / 0.72) + 36 + wOf(m, "label", F.scoreLine.mult, D.sec) > W;
/* the content sections of one mode, top to bottom: [name, height in design px] (the key rows are endGeom's) */
function content(F, D, ph, ts, W, m, two) {
  const L = D.L, t = (v) => v * ts, line = (px) => t(px * 1.25), rows = [];
  if (F.mode === "lose") {
    const rw = W, tail = !F.tail ? 0 : F.tail.kind === "plaque" ? 2.6 * L + 4 : t(D.bod * 1.35) * lineCount(F.tail.text, rw - 8, D.bod, m);
    rows.push(["kick", line(D.sec)], ["head", two ? t(D.hLose * 1.08) : Math.max(5 * L, t(D.hLose * 1.08))], ["reached", t((1.3 * L) / 0.72 * 1.2)], ["course", cellOf(D, ph, rw) + 4], ["score", t((1.6 * L) / 0.72 * 1.15) + (scoreSplit(F, D, rw, m) ? t(D.sec * 1.25) + 2 : 0)]);
    if (tail) rows.push(["tail", tail]);
    return rows;
  }
  const kick = line(D.sec), head = t((F.mode === "fin" ? D.hFin : D.hClear) * (F.mode === "fin" ? 1 : 1.08)), dig = (ph ? 2.6 : 3.4) * L;
  const card = ph ? (ledgerStacked(F.stats, D, W, m) ? 3 * t(D.sec * 1.25 + 4) + 10 : t(D.sec * 1.25) + 10) : Math.max(3.4 * L, t(D.sec * 1.25 + 5 + D.hud * 1.15)) + 16;
  const rib = (ph ? 15 : 17) + t(D.sec * 1.2 + 3 + D.pri * 1.2 + 3 + (1.6 * L) / 0.72), med = (q) => { const n = ruleLines(q, L, ph, m); return ph ? Math.max(4 * L + 18, t(D.pri * 1.2 + 4 + n * D.bod * 1.35)) : 1.2 * L + 4 * L + 4 + 6 + t(D.pri * 1.2 + 4 + n * D.bod * 1.35); };
  rows.push(["band", kick + 6 + head + (F.mode === "fin" && !ph ? Math.max(0, 5 * L - kick - 6 - head) : 0)]);
  if (F.mode === "fin") {
    rows.push(["score", dig + (ph ? 0.6 : 0.8) * L + line(D.sec) + (F.note ? 6 + line(D.sec) * lineCount(F.note, W, D.sec, m, "label") : 0)]);
    rows.push(["course", cellOf(D, ph, W) + 4 + (F.opened ? 6 + line(D.sec) * lineCount(F.opened, W, D.sec, m, "label") : 0)]);
  }
  rows.push(["tally", card]);
  shelvesOf(F.pieces, L, ph, m, W).forEach((ix, i) => rows.push(["shelf" + (i || ""), 0.9 * L + 0.5 * L + Math.max(...ix.map((j) => (F.pieces[j].kind === "medal" ? med(F.pieces[j]) : rib + 1.4 * L + 4))), ix]));
  return rows;
}

/* The page never scales under its text and touch floors (lane rule): u = 1 / css always (design px = CSS px). The plate narrows to the box (a
   desk plate's columns give way: its cards and keys share what is left); a short box first closes the content gaps (to GAP_MIN of their size),
   then PAGES the content: whole sections a page, the key rows on every page, a pager column at the content's right (▲ at its top, ▼ at its
   foot, 44 tall, the page as "1 / 2" between); ↑ / ↓, the D-PAD and a tap on ▲ / ▼ turn it (main holds the page, run.page). Only a box too small for one section and the keys
   scales (the iso guard on its smallest windows): G.scaled says so. The touch key rows keep 8 CSS px from what is above them. */
export const PAGER_H = 46, PAGER_W = 54; // 44 CSS px and more: a fitted stage scale rounds a hair under
export function endGeom(B, F, o = {}) {
  if (!F || !F.mode || !(B && B.w > 0 && B.h > 0)) return null;
  const ph = o.lay === "p" || o.lay === "l", D = END[ph ? "p" : "d"], ts = o.ts > 0 ? o.ts : textScale(), css = o.css > 0 ? o.css : 1, L = D.L, lose = F.mode === "lose";
  const G = {mode: F.mode, ph, ts, d: D, rects: {}, keys: {}, page: 0, pages: 1, scaled: false};
  const side = lose ? (ph ? 14 : D.loseGap) : ph ? 12 : D.side, ring = 2 * (D.T + 3);
  const nominal = ph ? 600 : F.mode === "clear" ? D.clearW * (ts > 1.1 ? 1.18 : 1) : F.mode === "fin" ? D.finW * (ts > 1.1 ? 1.07 : 1) : D.loseL + D.loseR * (ts > 1.1 ? 1.2 : 1) + 3 * D.loseGap;
  const availW = (B.w - 2 * MARGIN) * css - ring, availH = (B.h - HUD_TOP - 2 * MARGIN) * css - ring;
  /* the keys' words (a touch layout in tap mode shows no keycaps): GAME OVER's foot keys share their row by what each needs (label and
     keycap), and its plate widens to hold them (never past the box) */
  const W = hints(), tap = ph && W.dev !== "pad", caps = W.dev === "pad" ? {menu: W.back, copy: EW.CAP_COPY, map: EW.CAP_MAP} : {menu: W.back, copy: "C", map: "B"};
  const need = (l, c) => 16 + wOf(o.m, "label", l, D.pri) + (tap ? 4 : 14 + Math.max(DEV.d.capw, wOf(o.m, "label", c, D.sec) + 20)) + 14;
  const footNeed = [need(MENU, caps.menu), need(EW.COPY, caps.copy), need(EW.MAP, caps.map)];
  let plateW = Math.min(lose && !ph ? Math.max(nominal, footNeed.reduce((a, b) => a + b, 0) + 24 + 2 * side) : nominal, availW);
  const pad = ph ? [10, side, 10, side] : lose ? [1.4 * L, side, 1.3 * L, side] : [1.3 * L, side, 1.5 * L, side], inW = plateW - 2 * side; // a phone column keeps 10 px above and below
  /* GAME OVER's two columns (the bomb's 200 | the facts) while the facts keep 330 px; narrower, one column with the bomb beside the headline */
  const two = lose && !ph && inW - D.loseL - D.loseGap >= 330 * ts;
  G.two = two;
  const gap = (n) => D.gap * L * (two ? (n === "foot" ? 1 : 1.4 / 1.6) : 1), kgap = Math.max(10, GAP_MIN * D.gap * L);
  const colX = two ? side + D.loseL + D.loseGap : side, colW0 = two ? inW - D.loseL - D.loseGap : inW;
  /* a narrow desk finale stacks its keys: MENU over COPY RESULT | COPY MAP */
  const copyNeed = Math.max(footNeed[1], footNeed[2]);
  const mainNeed = 8 + DEV.d.bombs + 12 + wOf(o.m, "display", MENU, 28) + (tap ? 4 : 14 + Math.max(DEV.d.capw, wOf(o.m, "label", W.ok, D.sec) + 20)) + 14;
  const menuW = Math.min(330, Math.max(mainNeed, inW - 28 - 2 * copyNeed)), fin2 = F.mode === "fin" && !ph && inW - 28 - 2 * copyNeed < mainNeed; // the keys keep label and keycap: else MENU over the copy keys
  const keys = lose ? [["try", ph ? 64 : 1.32 * D.btnh + 0.4 * L], ["foot", ph ? 46 : 0.85 * D.btnh]] : [["keys", F.mode === "fin" && ph ? 46 + 10 + 46 : fin2 ? D.btnh + 8 + 0.85 * D.btnh : D.btnh]];
  const keysH = keys.reduce((a, [n, h], i) => a + h + (i ? Math.max(kgap, gap(n)) : 0), 0);
  /* the content's height at gap factor k (the first section's top gap is the pad) */
  const span = (rs, k) => rs.reduce((a, [n, h], i) => a + h + (i ? gap(n) * k : 0), 0);
  const fit1 = (rs, room) => { if (span(rs, 1) <= room) return 1; const n = span(rs, 0), g = span(rs, 1) - n; return g > 0 && n + g * GAP_MIN <= room ? Math.max(GAP_MIN, (room - n) / g) : null; };
  const kTop = (k) => Math.max(kgap, gap(keys[0][0]) * k), room = availH - pad[0] - pad[2] - keysH;
  let rows = content(F, D, ph, ts, colW0, o.m, two), pages = [rows], k = fit1(rows, room - kTop(1)), colW = colW0, tight = false;
  if (k == null && (k = fit1(rows, room - kgap)) != null) tight = true; // the gap above the keys closes to its 8 px floor too
  if (k == null) {
    tight = true;
    /* pages: the content column gives a PAGER_W column at its right to the ▲ / ▼ keys (44 tall, the page between them); whole sections a page */
    colW = colW0 - PAGER_W - 8;
    rows = content(F, D, ph, ts, colW, o.m, two);
    const rm = Math.max(room - kgap, 2 * PAGER_H + 20);
    pages = [];
    let cur = [];
    for (const r of rows) { if (cur.length && fit1([...cur, r], rm) == null) { pages.push(cur); cur = []; } cur.push(r); }
    if (cur.length) pages.push(cur);
    k = Math.min(...pages.map((q) => fit1(q, rm) || GAP_MIN));
  }
  const paged = pages.length > 1, pg = Math.max(0, Math.min(pages.length - 1, o.page | 0)), mine = pages[pg];
  G.page = pg; G.pages = pages.length;
  const body = paged ? Math.max(2 * PAGER_H + 20, ...pages.map((q) => span(q, k))) : span(mine, k);
  const H = pad[0] + body + (tight ? kgap : kTop(k)) + keysH + pad[2];
  let u = 1 / css;
  if (H > availH + 0.5) { u = (B.h - HUD_TOP - 2 * MARGIN) / (H + ring); G.scaled = true; }
  const pw = plateW * u, phh = H * u, px = Math.round((B.w - pw) / 2), py = HUD_TOP + Math.round((B.h - HUD_TOP - phh) / 2);
  G.u = u; G.T = D.T * u; G.L = L * u; G.cssK = css; G.k = k; G.H = H; G.availH = availH;
  G.plate = {x: px, y: py, w: pw, h: phh};
  const R = (x, y, w, h) => ({x: px + x * u, y: py + y * u, w: w * u, h: h * u});
  let y = pad[0];
  G.shelves = {};
  G.cell = cellOf(D, ph, colW);
  mine.forEach(([name, h, ix], i) => { if (i) y += gap(name) * k; G.rects[name] = R(colX, y, colW, h); if (ix) G.shelves[name] = ix; y += h; });
  if (paged) {
    const x = colX + colW0 - PAGER_W, top = pad[0];
    G.rects.pager = R(x, top, PAGER_W, body);
    G.keys.up = R(x, top, PAGER_W, PAGER_H);
    G.keys.down = R(x, top + body - PAGER_H, PAGER_W, PAGER_H);
  }
  let ky = H - pad[2] - keysH;
  keys.forEach(([name, h], i) => {
    if (i) ky += Math.max(kgap, gap(name));
    G.rects[name] = two && name === "foot" ? R(side, ky, inW, h) : R(colX, ky, colW0, h);
    ky += h;
  });
  if (two) G.rects.bomb = R(side, pad[0] + 1.2 * L, D.loseL, Math.min(260, (G.rects.try.y - py) / u - pad[0] - 1.2 * L));
  const kr = G.rects, gp = Math.max(12 * u, 10 / css);
  if (lose) {
    const t0 = kr.try, th = ph ? t0.h : 1.32 * D.btnh * u;
    G.keys.main = {x: t0.x, y: t0.y + t0.h - th, w: t0.w, h: th};
    const f = kr.foot, wt = footNeed, sum = wt.reduce((a, b) => a + b, 0);
    let x = f.x;
    ["menu", "copy", "map"].forEach((name, i) => { const w = ((f.w - 2 * gp) * wt[i]) / sum; G.keys[name] = {x, y: f.y, w, h: f.h}; x += w + gp; });
  } else if (F.mode === "fin") {
    const r = kr.keys;
    if (ph) {
      const kh = 46 * u, kw = (r.w - gp) / 2;
      G.keys.main = {x: r.x, y: r.y, w: r.w, h: kh};
      G.keys.copy = {x: r.x, y: r.y + r.h - kh, w: kw, h: kh};
      G.keys.map = {x: r.x + kw + gp, y: r.y + r.h - kh, w: kw, h: kh};
    } else if (fin2) {
      const ch = 0.85 * D.btnh * u, kw = (r.w - gp) / 2;
      G.keys.main = {x: r.x, y: r.y, w: r.w, h: D.btnh * u};
      G.keys.copy = {x: r.x, y: r.y + r.h - ch, w: kw, h: ch};
      G.keys.map = {x: r.x + kw + gp, y: r.y + r.h - ch, w: kw, h: ch};
    } else {
      const ch = 0.85 * D.btnh * u, mw = menuW * u, rest = r.w - mw - 16 * u, kw = (rest - gp) / 2, cy = r.y + (r.h - ch) / 2;
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
/* the run end's facts and geometry, kept per run end instead of rebuilt each frame (fix round 1): keyed by what endFacts and endGeom read (the
   world's run-end fields, the run minus its motion clock, the room time, the box, the layout, stage scale and page, the text scale, the device the
   keys name, and WHICH context measures: a context id, so a page measured by one canvas is never reused for another). A few entries (the page's
   own and the tap path's). sig: the facts and the plate as one string, the painters' cache-layer key */
const ctxId = new WeakMap();
let ctxN = 0, plans = new Map();
const idOf = (m) => { if (!m || typeof m !== "object" && typeof m !== "function") return 0; let i = ctxId.get(m); if (!i) ctxId.set(m, (i = ++ctxN)); return i; };
export function endPlan(B, world, run, tm, o = {}) {
  const w = world || {}, r = run ? {...run, et: 0, reduced: 0} : null, W = hints();
  const key = JSON.stringify([B && B.w, B && B.h, w.state, w.level, w.score, w.heat, w.pace, w.pact, !!w.finale, r, tm || null, o.lay, o.css, o.page | 0, textScale(), W.dev, W.ok, W.back, idOf(o.m)]);
  let P = plans.get(key);
  if (!P) {
    const F = endFacts(world, run, tm), G = endMode(w) ? endGeom(B, F, o) : null;
    P = {F, G, sig: G ? JSON.stringify([F, G.plate, G.u, G.page]) : ""};
    if (plans.size >= 6) plans.delete(plans.keys().next().value);
    plans.set(key, P);
  }
  return P;
}
export const _plans = () => plans.size; // tests: the memo's size
/* main's tap: ready(mode) is true once that mode's page is in, false while it loads, null where no page is registered (today's tap: the main key) */
export function endTap(x, y, B, world, run, tm, o, ready) {
  const mode = endMode(world), r = ready ? ready(mode) : null;
  if (!mode) return null;
  if (r == null) return "main";
  if (!r) return null;
  return endHit(x, y, endPlan(B, world, run, tm, o).G);
}
/* how many pages the run end shows in box B (main clamps its page with it) */
export const endPagesOf = (B, world, run, tm, o) => { const G = endMode(world) ? endPlan(B, world, run, tm, o).G : null; return G ? G.pages : 1; };
