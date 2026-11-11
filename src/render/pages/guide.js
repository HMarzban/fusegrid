/* GUIDE PAGES (UI upgrade v202 Task 3.5; design record §1, §4 GUIDE · ENEMIES, §5; appendix 7.1 tooltip, 7.2 foeCell / pts / tip; the round 6 S6-menu
   06-enemies frames, the round 7 kit). One module for the GUIDE door page and its four read-only pages (HOW TO PLAY, POWER-UPS, ENEMIES, FLOOR), lazy
   (pages/lazy.js "guide"). The world of app.level dresses the stage: its room look (kit room.js roomLayer, MENU's own key) opaque over the canvas, its
   rampart round the plate; foes stand on a floor cell of the world they first appear in, drawn by the board's own painters (drawEnemyBody, drawItemBody,
   featdraw drawSpec, wallart; PIXEL: hudart's cells when its atlas is in).
   guideGeom(F, page) is the one geometry for draw and tap: rects by NAME in box units (G.d: the same in design px; u box units per design px).
   F = {W, H, touch, shell, css, ts} as MENU's. Three arrangements: desk (every keyboard box, and a touch box whose desk scale holds TOUCH_U), the plate
   centred under a 70 px top margin that gives way to a short window, then the page scales as one piece; phone (a touch-portrait shell box), one column
   in CSS px with a BACK key in the head; compact (any other touch box), the phone grammar two columns wide. Heights come from a fixed estimate of each
   string (EST em per character, wider than the system sans), so the geometry needs no context; the painter wraps with the real measure into the lines
   the geometry gave, else steps down (APPEARS IN LEVELS n, then LEVELS n) or drops a help line, never an ellipsis.
   GUIDE: four doors (2 x 2 desk and compact, stacked on the phone), each a key with its name, a quiet teaser and a strip of what is behind it; a door
   owns half of each gap round it. guideHit: a door's index, -2 on the plate (inert), -1 off it or on the BACK key (backs out).
   ENEMIES: one slab per foe (3 x 3 desk; rows on the phone), its points as brick digits + PTS, the levels it appears in, and the tooltip on the focused
   points value (ui.tip) covering whole slots (desk: two cards of the next row toward the middle; phone: whole rows), its pointer on the value.
   enemiesHit: a foe's index (desk: its points key; touch: its whole slot), else -1.
   drawGuidePage(c, F, ui, t): ui = {page, focus (a door label, shown in tap mode too as MENU shows PLAY; or a foe index, shown in tap mode only with its tooltip), tip, level, look ("px": the PIXEL atlas when it is in),
   narrow}. Cached (kit cache.js, recency touched on a steady frame): the room (MENU's room key: its dpr from MENU's own rule, so a hop between MENU and
   GUIDE never misses), the plate (rampart, head, every slot at rest, cells at a fixed time), the foot, the GUIDE doors' strips and the tooltip's plaque
   per size, all made at once so a move never misses. Live: the focused door or points value (key, band, bare bomb, words, the cream ring), the focused
   foe animated on its floor cell, the tooltip's words. With no canvas source (Node) the static parts paint straight onto the target over one flat fill;
   a context with no clip or rect gets the plan only. Under the probe it records its rects, texts and squint pairs outside any layer paint (text under
   the open tooltip is not recorded: it is not on screen). */
import {CFG, biomeOf, BIOMES} from "../../core/config.js";
import {POWER, FOES, helpOf} from "../../core/entities.js";
import {TILE_HELP, TILE_NAME} from "../../core/feat.js";
import {LABEL, DIFF, levelsOf} from "../words.js";
import {worldTokens, CONST, toL} from "../kit/tokens.js";
import {key, cap, capW, plate, band, focusBomb, glyph, wallCell, floorCell} from "../kit/paint.js";
import {T, DEV, dsp, measure, textScale} from "../kit/type.js";
import {layer, capDpr, touch as hold, keyOf, canMake, BUDGET} from "../kit/cache.js";
import {roomLayer} from "../kit/room.js";
import * as probe from "../kit/probe.js";
import {menuGeom, roomDpr, FOOT_H, TZ, CAP_K, TOUCH_U, TOP_MIN, GUT} from "./menu.js";
import {deviceScale} from "../logo/draw2d.js";
import {drawEnemyBody} from "../sprites.js";
import {drawItemBody} from "../itemdraw.js";
import {drawSpec} from "../featdraw.js";
import {pixelArt, itemCell, foeCell as pxFoe, blitCell, blitAnim, foeAnim, seedOf as pxSeed} from "../hudart.js";
import {foeM, blinkAt} from "../motion.js";
import {hints, tapMode} from "../hintcopy.js";

const deep = (o) => { for (const v of Object.values(o)) if (v && typeof v === "object") deep(v); return Object.freeze(o); };
export const GUIDE = "GUIDE", HOW = "HOW TO PLAY", PU = LABEL.POWER_UPS, EN = "ENEMIES", FL = "FLOOR";
/* the doors in menuapp GUIDE_ROWS order (tests/page-guide pins it equal) */
export const DOORS = Object.freeze([HOW, PU, EN, FL]);
export const SHOT = deep({[GUIDE]: "guide", [HOW]: "howto", [PU]: "items", [EN]: "enemies", [FL]: "floor"});
/* a foe's points: sim.js killEnemy (tests/page-guide drives a real kill per type and pins each) */
export const PTS = deep({walker: 100, stationary: 100, fast: 100, chaser: 100, boomerang: 250, rocket: 300, burrow: 150, shade: 250, knight: 200});
export const POINTS = "POINTS", PTS_W = "PTS", APPEARS = "APPEARS IN ";
export const tipText = (name) => "What you score each time your blast takes out a " + name + ". Saved scores count ×2 on " + DIFF[1] + " and ×3 on " + DIFF[2] + ".";
export const HINT = deep({key: "Move to a points value to see what it means.", tap: "Tap a points value to see what it means."});
export const BACK_TAP = "TAP OUTSIDE TO GO BACK";
const RULES = ["CLEAR EVERY ENEMY", "GOLD WALL NEVER BREAKS"], NOTE_KEY = "* NEEDS ITS POWER-UP", NOTE_TAP = "TOUCH · LEFT PAD MOVES · RIGHT BUTTON BOMBS";
const howRows = (W) => [
  [[W.move, W.moveAlt], "MOVE", null],
  [[W.bomb], "BOMB", "bomb"],
  [[W.throw], "THROW *", "throw"],
  [[W.remote], "REMOTE *", "remote"],
  [["WALK INTO BOMB"], "KICK *", "kick"],
  [[W.pause], "PAUSE", null],
];
const NARROW_TAP = deep({throw: "tap", remote: "tap"});
export const FLOOR_ROWS = deep([["BLOOM", 1], ["GLIDE", 2], ["BELT", 3], ["STREAM", 4], ["PLATE", 5], ["QUICK", 6], ["PORTAL", 7], ["GATE", 8]].map(([k, room]) => ({k, name: TILE_NAME[k], room})));

/* desk plate widths [text scale 1, 1.25] and the least width before the page scales; pads [top, right, bottom, left] */
const PWD = deep({[GUIDE]: [860, 960, 640], [HOW]: [960, 1060, 760], [PU]: [1250, 1250, 900], [EN]: [1250, 1250, 960], [FL]: [1250, 1250, 900]});
const PAD = deep({d: [18, 22, 22, 22], p: [12, 12, 14, 12]});
const CP = 9;
/* the tooltip's side padding: the mock's 16, 10 in the compact arrangement's narrow column */
const TIP_PAD = deep({d: 16, c: 10});
export const TOP = 70, FOOT_GAP = 18, EST = 0.66, TIP_T = deep({d: 8, p: 6}), SLAB_T = 8, PHONE_MAX = 600, COMPACT_MAX = 960, BACK_W = 112;
const est = (s, px) => String(s).length * EST * px;
const R = (x, y, w, h) => ({x, y, w, h});
const sc = (r, u) => (r ? {x: r.x * u, y: r.y * u, w: r.w * u, h: r.h * u} : null);
const okBox = (F) => !!F && F.W > 0 && F.H > 0 && Number.isFinite(F.W) && Number.isFinite(F.H);
const firstLevel = (rooms) => +String(rooms).match(/\d+/)[0];
const inRooms = (rooms, n) => String(rooms).split(",").some((p) => { const [a, b] = p.trim().split("-").map(Number); return n >= a && n <= (b || a); });
const helpOfFoe = (e) => { const s = e.help.replace(/\s*·\s*\d+$/, ""); return s.charAt(0).toUpperCase() + s.slice(1); };
/* a string's break points: spaces, but never inside a bracket ("(max 8)" stays whole) */
const words = (s) => String(s).match(/\([^)]*\)|[^\s(]+/g) || [""];
/* lines a string takes at width w by the estimate (a word wider than w counts as one line of its own) */
function estLines(s, px, w) {
  let n = 1, x = 0;
  for (const word of words(s)) { const ww = est(word, px), sp = x ? est(" ", px) : 0; if (x && x + sp + ww > w) { n++; x = ww; } else x += sp + ww; }
  return n;
}

/* ---- geometry ---- */
/* items in grid order, row-major; a row is as tall as its tallest; returns {h, rects} */
function grid(n, cols, gap, w, hOf, gy = gap) {
  const cw = (w - (cols - 1) * gap) / cols, rects = [];
  let y = 0;
  for (let r = 0; r * cols < n; r++) {
    let rh = 0;
    for (let c = 0; c < cols && r * cols + c < n; c++) rh = Math.max(rh, hOf(r * cols + c, cw));
    for (let c = 0; c < cols && r * cols + c < n; c++) rects.push(R(c * (cw + gap), y, cw, rh));
    y += rh + gy;
  }
  return {h: Math.max(0, y - gy), rects, cw};
}
/* each page's body in design px from (0, 0) at width iw: {h, items: [{name, r, ...}], ...} */
function body(page, m, iw) {
  const {dv, ts, dev} = m, ph = dev === "p", cols = m.mode === "phone" ? 1 : 2, gap = ph ? 10 : 12;
  const pri = dv.pri * ts, sec = dv.sec * ts, bod = dv.bod * ts, lhP = pri * 1.15, lhS = sec * 1.25, lhB = bod * 1.4;
  if (page === GUIDE) {
    const strip = ph ? 30 : 32, dh = 14 + lhP + 2 + lhS + 8 + strip + 14, g = grid(4, cols, gap, iw, () => dh);
    return {h: g.h, gap, items: DOORS.map((l, i) => ({name: l, r: g.rects[i], strip}))};
  }
  if (page === HOW) {
    /* a rule slab takes a second line where its words will not fit one (the estimate); the note too */
    const rh0 = ph ? 52 : 60, ch = ph ? 48 : 52, cs = (h) => h - 2 * (SLAB_T + 2) - 12, rl = (cw) => Math.max(...RULES.map((s) => estLines(s, pri, cw - 2 * (SLAB_T + 2) - 12 - cs(rh0) - 12)));
    const rg = grid(2, cols, gap, iw, (i, cw) => Math.max(rh0, 2 * (SLAB_T + 2) + 12 + rl(cw) * lhP)), cg = grid(6, cols, 8, iw, () => ch, 8), y1 = rg.h + gap;
    const items = RULES.map((s, i) => ({name: s, r: rg.rects[i], kind: "rule", cs: cs(rh0), lines: rl(rg.cw)}));
    howRows(m.W).forEach((q, i) => { const r = cg.rects[i]; items.push({name: q[1], r: R(r.x, r.y + y1, r.w, r.h), kind: "ctl", keys: q[0], icon: q[2]}); });
    const nl = Math.min(2, estLines(m.tap ? NOTE_TAP : NOTE_KEY, sec, iw)), nh = nl * sec * 1.4;
    return {h: y1 + cg.h + 8 + nh, items, note: R(0, y1 + cg.h + 8, iw, nh), nl};
  }
  if (page === PU) {
    if (m.mode !== "desk") {
      /* phone and compact: two tiles a row, the cell and the name across the top, the help under them in the secondary size */
      const cell = 32, tw = (iw - gap) / 2 - 16, hs = (p) => helpOf(p, m.narrow && m.tap ? NARROW_TAP : m.W, m.tap);
      const nl = m.help === false ? 0 : Math.min(4, Math.max(...POWER.map((p) => estLines(hs(p), sec, tw))));
      const g = grid(POWER.length, 2, gap, iw, () => 8 + cell + (nl ? 6 + nl * lhS : 0) + 8, 8);
      return {h: g.h, items: POWER.map((p, i) => ({name: p.name, r: g.rects[i], cell, lines: nl, t: p.t, tile: true}))};
    }
    const cell = 44, tw0 = (cw) => cw - 8 - cell - 12 - 14, lines = (cw) => Math.min(2, Math.max(...POWER.map((p) => estLines(helpOf(p, m.W, m.tap), bod, tw0(cw)))));
    const g = grid(POWER.length, cols, gap, iw, (i, cw) => Math.max(cell + 12, 8 + lhP + 2 + lines(cw) * lhB + 8), 8);
    return {h: g.h, items: POWER.map((p, i) => ({name: p.name, r: g.rects[i], cell, lines: lines(g.cw), t: p.t}))};
  }
  if (page === EN) {
    if (m.mode === "desk") {
      /* the points key sits on the name's line, right-aligned (the round 7 frame), where every name and key fit it by the estimate; else under the name */
      const cw = (iw - 2 * gap) / 3, tw = cw - 2 * (SLAB_T + 2) - 2 * CP - 56 - 14, hl = Math.min(2, Math.max(...FOES.map((e) => estLines(helpOfFoe(e), bod, tw))));
      const pw = dv.bombs + 10 + 85 + 6 + est(PTS_W, sec) + 10, inl = FOES.every((e) => est(e.name, pri) + 10 + pw <= tw), nh = inl ? 44 : lhP + 4 + 44;
      const ch = (SLAB_T + 2) * 2 + 1 + 2 * CP + nh + 6 + hl * lhB + 4 + lhS, g = grid(FOES.length, 3, gap, iw, () => ch);
      const items = FOES.map((e, i) => { const r = g.rects[i], x0 = r.x + SLAB_T + 2 + CP, y0 = r.y + SLAB_T + 2 + CP, tx = x0 + 70, px = inl ? tx + tw - pw : tx, py = inl ? y0 : y0 + lhP + 4;
        return {name: e.name, t: e.t, r, cell: R(x0, y0, 56, 56), tx, tw, nameY: inl ? y0 + 22 : y0 + lhP / 2, pts: R(px, py, pw, 44), dig: R(px + dv.bombs + 10, py + 4, 85, 36), helpY: y0 + nh + 6, hl, appY: y0 + nh + 6 + hl * lhB + 4, pips: R(x0 + 1, y0 + 66, 54, 12)}; });
      return {h: g.h, items, cols: 3, gap, tipH: (w) => tipNeed(m, w)};
    }
    /* phone: one column, PTS under the digits; compact: two columns, PTS beside them, so five rows fit a landscape phone */
    const side = m.mode === "compact", pth = side ? 40 : 58, ptw = 8 + dv.bombs + 6 + 67 + (side ? 6 + est(PTS_W, sec) : 0) + 8, cols2 = side ? 2 : 1, cw = (iw - (cols2 - 1) * gap) / cols2, tw = cw - 12 - 44 - 10 - ptw - 10;
    const help = m.help !== false && !(ts > 1.1); /* the help line is kept where the row has room; a help the measure says will not fit its line is dropped */
    const rh = Math.max(side ? 48 : 64, 6 + lhP + lhS + (help ? lhB : 0) + 6), g = grid(FOES.length, cols2, gap, iw, () => rh, 0);
    const items = FOES.map((e, i) => { const r = g.rects[i], x0 = r.x + 6, tx = x0 + 54, ptx = r.x + r.w - 6 - ptw, top = r.y + (rh - (lhP + lhS + (help ? lhB : 0))) / 2, py = r.y + (rh - pth) / 2;
      return {name: e.name, t: e.t, r, cell: R(x0, r.y + (rh - 44) / 2, 44, 44), tx, tw, nameY: top + lhP / 2, levY: top + lhP + lhS / 2, helpY: help ? top + lhP + lhS + lhB / 2 : null, pts: R(ptx, py, ptw, pth), dig: R(ptx + 8 + dv.bombs + 6, py + 6, 67, 28), side}; });
    return {h: g.h, items, cols: cols2, gap, rh, help, iw, tipH: (w) => tipNeed(m, w)};
  }
  /* FLOOR: three tile cells (by difficulty) then the tile's name, its world and two help lines; desk one column under a header of the three names */
  const desk = m.mode === "desk", s = desk ? 44 : 30, cg = desk ? Math.max(6, Math.ceil(est(DIFF[2], sec) - s + 6)) : 4, cellsW = 3 * s + 2 * cg;
  const colsF = desk ? 1 : cols, cwF = (iw - (colsF - 1) * gap) / colsF, tw = desk ? cwF - 16 - cellsW - 16 : cwF - 16;
  const lean = m.mode === "phone" && m.help === false;
  const lines = (r) => { const h = TILE_HELP[r.k] || ["", "", ""], a = DIFF[0] + " · " + h[0], b = DIFF[2] + " · " + h[2];
    if (desk) return est(a, sec) + 24 + est(b, sec) <= tw ? 1 : 2;
    return estLines(a, sec, tw) + (lean ? 0 : estLines(b, sec, tw)); };
  const hd = lhS + 6, nl = Math.max(...FLOOR_ROWS.map(lines)), rowH = desk ? Math.max(s + 12, 6 + lhP + nl * lhS + 6) : 5 + Math.max(s, lhP + (lean ? 0 : lhS)) + 4 + nl * lhS + 5;
  const g = grid(FLOOR_ROWS.length, colsF, gap, iw, () => rowH, desk ? 6 : 4);
  return {h: hd + g.h, items: FLOOR_ROWS.map((q, i) => ({name: q.name, r: R(g.rects[i].x, g.rects[i].y + hd, g.rects[i].w, rowH), s, cg, cellsW, tw, nl, k: q.k, room: q.room, lean})), head: R(0, 0, iw, lhS), desk};
}
/* the tooltip's content height at text width w: pad 12, the title row (36: the digits), 6, the body lines, pad 14 */
function tipNeed(m, w) {
  const bod = m.dv.bod * m.ts, n = Math.max(...FOES.map((e) => estLines(tipText(e.name), bod, w)));
  return {h: 12 + 36 + 6 + n * bod * 1.4 + 14, n};
}
function headOf(page, m, iw, bk = 44) {
  const {dv, ts} = m, sec = dv.sec * ts, hint = page === EN ? (m.tap ? HINT.tap : HINT.key) : "";
  if (m.mode === "desk") {
    const kick = sec * 1.25, tt = dv.ttl * ts * 1.1, inline = !hint || est(hint, sec) + est(page, dv.ttl * ts) * 1.15 + 24 <= iw;
    return {h: kick + 2 + tt + (inline ? 0 : 4 + sec * 1.3), kick: R(0, 0, iw, kick), title: R(0, kick + 2, iw, tt), hint: hint ? (inline ? R(0, kick + 2, iw, tt) : R(0, kick + 6 + tt, iw, sec * 1.3)) : null, s: hint};
  }
  const hn = hint ? Math.min(2, estLines(hint, sec, iw)) : 0, hh = hint ? 8 + hn * sec * 1.3 : 0;
  const bw = BACK_W * bk / 44, tt = dv.ttl * ts * 1.1, below = est(page, dv.ttl * ts) * 1.15 > iw - bw - 16, ty = below ? bk + 6 : 0, th = below ? tt : bk;
  return {h: ty + th + hh, back: R(0, 0, bw, bk), title: below ? R(0, ty, iw, tt) : R(bw + 16, (bk - 44) / 2, iw - bw - 16, 44), hint: hint ? R(0, ty + th + 8, iw, hn * sec * 1.3) : null, s: hint, hn};
}
function frameOf(F) {
  const ts = F.ts > 0 ? F.ts : textScale(), touch = !!F.touch, shell = !!F.shell, css = F.css > 0 ? F.css : 1;
  return {ts, touch, shell, css, t125: ts > 1.1, phone: shell && touch && F.H > F.W * 1.3};
}
function lay(F, page, mode, fr) {
  const dev = mode === "desk" ? "d" : "p", dv = DEV[dev], m = {mode, dev, dv, ts: fr.ts, W: hints(), tap: tapMode(fr.touch), narrow: F.W < 560}, P0 = PAD[dev];
  if (mode === "desk") {
    const [w1, w2, wmin] = PWD[page], side = 2 * (DEV.d.T + 2 + GUT), want = fr.t125 ? w2 : w1;
    let u = Math.min(1, F.W / (wmin + side));
    const pw = Math.min(want, F.W / u - side), iw = pw - P0[1] - P0[3], hd = headOf(page, m, iw), bd = body(page, m, iw);
    const plateH = P0[0] + hd.h + 14 + bd.h + P0[2], tail = FOOT_GAP + FOOT_H + 4 + 12;
    u = Math.min(u, F.H / (TOP_MIN + plateH + tail));
    const Wd = F.W / u, Hd = F.H / u, px = (Wd - pw) / 2, py = Math.max(TOP_MIN, Math.min(TOP, Hd - plateH - tail));
    return {mode, dev, u, m, plate: R(px, py, pw, plateH), ix: px + P0[3], iy: py + P0[0], iw, hd, bd, by: py + P0[0] + hd.h + 14, foot: R(px, py + plateH + FOOT_GAP, pw, FOOT_H)};
  }
  const side = 12, top = 20, bot = 20, max = mode === "phone" ? PHONE_MAX : COMPACT_MAX;
  let u = 1 / fr.css;
  const build = (uu, help) => {
    const Wd = F.W / uu, pw = Math.min(Wd - 2 * side, max), iw = pw - P0[1] - P0[3], mm = {...m, help}, hd = headOf(page, mm, iw, Math.max(44, 44 / (uu * fr.css))), bd = body(page, mm, iw);
    return {pw, iw, hd, bd, mm, plateH: P0[0] + hd.h + 12 + bd.h + P0[2], Wd};
  };
  let S = build(u, true);
  /* too tall: POWER-UPS scales down to 0.75 of its size before it drops its help lines; ENEMIES drops its one-line help first (round 6 phone) */
  if (page === PU && top + S.plateH + bot > F.H / u && F.H / (top + S.plateH + bot) < 0.75 * u) S = build(u, false);
  if ((page === EN || page === FL) && top + S.plateH + bot > F.H / u) S = build(u, false);
  for (let k = 0; k < 4 && top + S.plateH + bot > F.H / u + 0.01; k++) { u = F.H / (top + S.plateH + bot); S = build(u, S.mm.help); }
  const px = (S.Wd - S.pw) / 2, py = top + Math.max(0, F.H / u - top - bot - S.plateH) * (mode === "phone" ? 0 : 0.5);
  return {mode, dev, u, m: S.mm, plate: R(px, py, S.pw, S.plateH), ix: px + P0[3], iy: py + P0[0], iw: S.iw, hd: S.hd, bd: S.bd, by: py + P0[0] + S.hd.h + 12, foot: null};
}
const off = (r, x, y) => (r ? R(r.x + x, r.y + y, r.w, r.h) : null);
let gm = null;
export function guideGeom(F, page = GUIDE) {
  const fr = frameOf(F), W = hints();
  if (gm && gm.W === F.W && gm.H === F.H && gm.page === page && gm.touch === fr.touch && gm.shell === fr.shell && gm.css === fr.css && gm.ts === fr.ts && gm.words === W) return gm.G;
  let d = lay(F, page, fr.phone ? "phone" : "desk", fr);
  if (!fr.phone && fr.touch && !(d.u * fr.css >= TOUCH_U)) d = lay(F, page, "compact", fr);
  const u = d.u, x0 = d.ix, y0 = d.by, D = {mode: d.mode, dev: d.dev, u, plate: d.plate, foot: d.foot, T: DEV[d.dev].T, head: {}, items: {}, order: [], hit: {}, tips: null};
  for (const k of ["kick", "title", "hint", "back"]) D.head[k] = off(d.hd[k], d.ix, d.iy);
  D.hintS = d.hd.s; D.hintN = d.hd.hn || 1;
  const B = d.bd;
  for (const it of B.items) {
    const q = {...it, r: off(it.r, x0, y0)};
    for (const k of ["cell", "pts", "dig", "pips"]) if (it[k] && typeof it[k] === "object") q[k] = off(it[k], x0, y0);
    for (const k of ["nameY", "helpY", "appY", "levY"]) if (it[k] != null) q[k] = it[k] + y0;
    if (it.tx != null) q.tx = it.tx + x0;
    D.items[it.name] = q;
    D.order.push(it.name);
  }
  if (B.note) D.note = off(B.note, x0, y0);
  if (B.head) D.fhead = off(B.head, x0, y0);
  /* hits: a door owns half of each gap round it out to half the plate's pad; ENEMIES on a touch layout taps a foe's whole slot, else its points key */
  if (page === GUIDE || page === EN) {
    const gx = B.gap, gy = page === GUIDE || d.mode === "desk" ? B.gap : 0, e = PAD[d.dev][3] / 2;
    for (const n of D.order) {
      const q = D.items[n], r = q.r;
      if (page === EN && !fr.touch && d.mode === "desk") { D.hit[n] = R(q.pts.x - 3, q.pts.y - 3, q.pts.w + 6, q.pts.h + 6); continue; }
      const L = Math.abs(r.x - x0) < 1e-6 ? r.x - e : r.x - gx / 2, Rt = Math.abs(r.x + r.w - (x0 + d.iw)) < 1e-6 ? r.x + r.w + e : r.x + r.w + gx / 2;
      const Tp = Math.abs(r.y - y0) < 1e-6 ? r.y - Math.min(gy / 2, 4) : r.y - gy / 2, Bt = Math.abs(r.y + r.h - (y0 + B.h)) < 1e-6 ? r.y + r.h + PAD[d.dev][2] / 2 : r.y + r.h + gy / 2;
      D.hit[n] = R(L, Tp, Rt - L, Bt - Tp);
    }
  }
  if (page === EN) D.tips = FOES.map((e, i) => tipGeom(D, B, i, d));
  const G = {page, mode: d.mode, dev: d.dev, u, W: F.W, H: F.H, t125: fr.t125, touch: fr.touch, T: D.T * u, d: D, order: D.order.slice(), plate: sc(D.plate, u), foot: sc(D.foot, u), back: sc(D.head.back, u), items: {}, hit: {}, tips: null};
  for (const n of D.order) { G.items[n] = sc(D.items[n].r, u); if (D.hit[n]) G.hit[n] = sc(D.hit[n], u); }
  if (D.tips) G.tips = D.tips.map((q) => ({r: sc(q.r, u), up: q.up, cover: q.cover.slice()}));
  gm = {W: F.W, H: F.H, page, touch: fr.touch, shell: fr.shell, css: fr.css, ts: fr.ts, words: W, G: deep(G)};
  return gm.G;
}
/* the tooltip for foe i: the box it covers (whole slots), its plaque inside that by its ring, the pointer from the plaque toward the points value */
function tipGeom(D, B, i, d) {
  const n = D.order.length, it = D.items[D.order[i]], Tt = TIP_T[d.dev];
  let cover, up, U, need;
  if (d.mode === "desk") {
    const r = Math.floor(i / 3), c = i % 3, r2 = r > 0 ? r - 1 : r + 1, cs = c > 0 ? [c - 1, c] : [0, 1];
    cover = cs.map((cc) => r2 * 3 + cc); up = r > 0;
    const rs = cover.map((j) => D.items[D.order[j]].r), x = Math.min(...rs.map((q) => q.x)), y = Math.min(...rs.map((q) => q.y));
    U = R(x, y, Math.max(...rs.map((q) => q.x + q.w)) - x, Math.max(...rs.map((q) => q.y + q.h)) - y);
    need = B.tipH(U.w - 2 * Tt - 4 - 2 * TIP_PAD.d);
  } else if (B.cols > 1) {
    /* compact: the other column, top to bottom (a landscape phone has no rows to spare above or below); the pointer points across */
    const x0 = D.items[D.order[0]].r.x, y0 = D.items[D.order[0]].r.y, cw = (B.iw - B.gap) / 2, oc = i % 2 ? 0 : 1, rows = Math.ceil(n / 2);
    cover = D.order.map((_, j) => j).filter((j) => j % 2 === oc);
    U = R(x0 + oc * (cw + B.gap), y0, cw, rows * B.rh);
    need = B.tipH(U.w - 2 * Tt - 4 - 2 * TIP_PAD.c);
    up = oc ? "r" : "l";
  } else {
    /* phone: whole rows on the side of the focused row with room, as many as the words need */
    const row = i, rows = n, x0 = D.items[D.order[0]].r.x, y0 = D.items[D.order[0]].r.y;
    need = B.tipH(B.iw - 2 * Tt - 4 - 2 * TIP_PAD.d);
    const k = Math.max(1, Math.ceil((need.h + 2 * Tt + 5) / B.rh)), below = rows - 1 - row, above = row, dn = below >= k || below >= above, cnt = Math.min(k, dn ? below : above), r0 = dn ? row + 1 : row - cnt;
    up = !dn;
    cover = [];
    for (let j = r0; j < r0 + cnt; j++) cover.push(j);
    U = R(x0, y0 + r0 * B.rh, B.iw, cnt * B.rh);
  }
  const box = R(U.x + Tt + 2, U.y + Tt + 2, U.w - 2 * Tt - 4, U.h - 2 * Tt - 5), p = it.pts, pw = d.dev === "p" ? 16 : 18, phh = d.dev === "p" ? 10 : 14;
  const cx = Math.max(box.x + 14 + pw / 2, Math.min(box.x + box.w - 14 - pw / 2, p.x + p.w / 2)), cy = Math.max(box.y + 14 + pw / 2, Math.min(box.y + box.h - 14 - pw / 2, p.y + p.h / 2));
  const ptr = up === "r" ? {x: box.x - Tt - 2, y: cy, w: pw, h: phh, dir: -2} : up === "l" ? {x: box.x + box.w + Tt + 2, y: cy, w: pw, h: phh, dir: 2} : up ? {x: cx, y: box.y + box.h + Tt + 3, w: pw, h: phh, dir: 1} : {x: cx, y: box.y - Tt - 2, w: pw, h: phh, dir: -1};
  return {r: box, U, up, cover, ptr, n: need.n, Tt, pad: d.mode === "compact" ? TIP_PAD.c : TIP_PAD.d};
}
const inR = (r, x, y) => !!r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
const onPlate = (G, x, y) => { const p = G.plate; return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h; };
/** A tap on the GUIDE door page: the door's index, -2 on the plate (inert), -1 off it or on the BACK key. */
export function guideHit(x, y, F) {
  if (!okBox(F)) return -1;
  const G = guideGeom(F, GUIDE);
  for (let i = 0; i < DOORS.length; i++) if (inR(G.hit[DOORS[i]], x, y)) return i;
  if (inR(G.back, x, y)) return -1;
  return onPlate(G, x, y) ? -2 : -1;
}
/** A tap on ENEMIES: the foe's index (its points value; a touch layout's whole slot), else -1 (a read-only page: any other tap closes an open
    tooltip, or backs out). */
export function enemiesHit(x, y, F) {
  if (!okBox(F)) return -1;
  const G = guideGeom(F, EN);
  for (let i = 0; i < G.order.length; i++) if (inR(G.hit[G.order[i]], x, y)) return i;
  return -1;
}
/** A read-only page (HOW TO PLAY, POWER-UPS, FLOOR) backs out on any tap: -1 everywhere. */
export const readHit = () => -1;

/* ---- plan: every part as a display list in design px; the plate layer paints `rest`, the frame paints the focused part and the tip live ---- */
const EST_C = {font: "", measureText(s) { const m = /(\d+(?:\.\d+)?)px/.exec(this.font); return {width: String(s).length * 0.6 * (m ? +m[1] : 10)}; }};
const mOK = new WeakMap(), mOf = (c) => {
  if (!c || (typeof c !== "object" && typeof c !== "function")) return EST_C;
  let v = mOK.get(c);
  if (v === undefined) { const q = typeof c.measureText === "function" ? c.measureText("M") : null; mOK.set(c, (v = !!q && typeof q.width === "number")); }
  return v ? c : EST_C;
};
const Wm = (c, f, s) => measure(c, f, s);
/* greedy wrap by the real measure into at most n lines, or null (a word too wide, or more lines) */
function wrap(c, f, s, w, n) {
  const out = [];
  let line = "";
  for (const word of words(s)) {
    const t = line ? line + " " + word : word;
    if (Wm(c, f, t) <= w) line = t;
    else { if (!line || Wm(c, f, word) > w) return null; out.push(line); line = word; }
  }
  if (line) out.push(line);
  return out.length <= n ? out : null;
}
const txt = (s, x, y, px, o = {}) => ({op: "text", s, x, y, px, f: (o.face || T.label)(px), col: o.col || CONST.ink, align: o.align || "left", role: o.role || "primary", lock: o.lock, name: o.name});
function homeArt(level) { return {biome: biomeOf(level)}; }
function plan(c0, G, ui) {
  const c = mOf(c0), D = G.d, dv = DEV[D.dev], ts = textScale(), W = hints(), tap = tapMode(!!G.touch), ph = D.dev === "p";
  const pri = dv.pri, sec = dv.sec, bod = dv.bod, rest = [], focus = {}, tips = [], strips = {}, info = [];
  const fS = (px) => T.label(px), fB = (px) => T.body(px);
  const w = (f, s) => Wm(c, f, s);
  rest.push({op: "plate", r: D.plate});
  /* head */
  const H = D.head;
  if (H.back) {
    rest.push({op: "key", r: H.back, kind: "key", name: "BACK"}, {op: "glyph", n: "back", x: H.back.x + 16, y: H.back.y + H.back.h / 2 - 8, s: 16, col: CONST.ink});
    info.push({name: "BACK chevron", r: R(H.back.x + 16, H.back.y + H.back.h / 2 - 8, 16, 16), col: CONST.ink});
    rest.push(txt("BACK", H.back.x + 42, H.back.y + H.back.h / 2, pri, {name: "BACK"}));
    rest.push({op: "dsp", s: G.page, x: H.title.x, y: H.title.y + H.title.h / 2, px: dv.ttl});
  } else {
    rest.push(txt(G.page === GUIDE ? "MENU" : GUIDE, H.kick.x, H.kick.y + H.kick.h / 2, sec, {col: CONST.t2, role: "secondary"}));
    rest.push({op: "dsp", s: G.page, x: H.title.x, y: H.title.y + H.title.h / 2, px: dv.ttl});
  }
  if (H.hint && !H.back) rest.push(txt(D.hintS, H.hint.x + H.hint.w, H.hint.y + H.hint.h / 2, sec, {col: CONST.t2, role: "secondary", align: "right"}));
  else if (H.hint) { const ls = wrap(c, fS(sec), D.hintS, H.hint.w, D.hintN) || [D.hintS]; ls.forEach((l, j) => rest.push(txt(l, H.hint.x, H.hint.y + sec * textScale() * 1.3 * (j + 0.5), sec, {col: CONST.t2, role: "secondary"}))); }
  const items = D.items;
  if (G.page === GUIDE) {
    const subs = [tap || ph || W.dev === "pad" ? "2 RULES · 6 CONTROLS" : "2 RULES · 6 KEYS", POWER.length + " " + LABEL.POWER_UPS, FOES.length + " FOES", FLOOR_ROWS.length + " TILES"];
    DOORS.forEach((l, i) => {
      const q = items[l], r = q.r, gs = 16, gx = r.x + r.w - 18 - gs, lx = r.x + 24, fx = r.x + 8 + dv.bombs + 8, ly = r.y + 14 + pri * ts * 0.575, ty = ly + pri * ts * 0.575 + 2 + sec * ts * 0.625, sy = r.y + r.h - 14 - q.strip;
      const label = txt(l, lx, ly, pri, {name: l}), tz = txt(subs[i], lx, ty, sec, {col: TZ, role: "secondary"}), chev = {op: "glyph", n: "chev", x: gx, y: r.y + r.h / 2 - gs / 2, s: gs, col: CONST.t2};
      const sw = gx - 10 - fx, st = stripOf(c, i, sw, q.strip, ph, tap, W);
      strips[l] = {w: Math.max(1, sw), h: q.strip, ops: st};
      rest.push({op: "key", r, kind: "key", name: l}, {...label, door: l}, {...tz, door: l}, chev, {op: "strip", l, x: lx, y: sy, door: l});
      focus[l] = [{op: "key", r, kind: "key", ring: true}, {op: "band", r}, {op: "bomb", x: r.x + 8, cy: r.y + r.h / 2}, {...label, x: fx}, {...tz, x: fx, col: CONST.t2}, chev, {op: "strip", l, x: fx, y: sy}];
      info.push({name: l + " chev", r: R(gx, chev.y, gs, gs), col: CONST.t2});
    });
  } else if (G.page === HOW) {
    for (const [i, s] of RULES.entries()) {
      const q = items[s], r = q.r, cs = q.cs, tx = r.x + SLAB_T + 8 + cs + 12, lh = pri * ts * 1.15;
      rest.push({op: "slab", r, name: s}, i ? {op: "wall", x: r.x + SLAB_T + 8, y: r.y + (r.h - cs) / 2, s: cs, level: 1} : {op: "foe", t: "walker", x: r.x + SLAB_T + 8, y: r.y + (r.h - cs) / 2, s: cs, level: 1});
      const ls = wrap(c, fS(pri), s, r.x + r.w - SLAB_T - 10 - tx, q.lines) || [s];
      ls.forEach((l, j) => rest.push(txt(l, tx, r.y + r.h / 2 + (j - (ls.length - 1) / 2) * lh, pri, {name: j ? undefined : s})));
    }
    for (const n of D.order.slice(2)) {
      const q = items[n], r = q.r, cs = Math.min(36, r.h - 12), cy = r.y + r.h / 2;
      rest.push({op: "lane", r});
      let x = r.x + 10;
      if (q.icon) { rest.push({op: "well", r: R(x, cy - cs / 2, cs, cs)}, {op: "item", t: q.icon, x, y: cy - cs / 2, s: cs}); x += cs + 12; }
      rest.push(txt(n, x, cy, pri, {name: n}));
      const room = r.x + r.w - 10 - (x + w(fS(pri), n) + 16);
      if (!ph && !tap) {
        let keys = q.keys.filter(Boolean), ws = keys.map((k) => capW(c, k));
        while (keys.length > 1 && ws.reduce((a, b) => a + b, 0) + 6 * (keys.length - 1) > room) { keys = keys.slice(0, -1); ws = ws.slice(0, -1); }
        let cx = r.x + r.w - 10 - (ws.reduce((a, b) => a + b, 0) + 6 * (keys.length - 1));
        keys.forEach((k, j) => { rest.push({op: "cap", s: k, x: cx, y: cy - dv.caph / 2, w: ws[j]}); cx += ws[j] + 6; });
      } else {
        const s = q.keys.filter(Boolean).join(" / "), s2 = w(fS(sec), s) <= room ? s : q.keys[0];
        if (w(fS(sec), s2) <= room) rest.push(txt(s2, r.x + r.w - 10, cy, sec, {col: CONST.t2, role: "secondary", align: "right"}));
      }
    }
    const nt = tap ? NOTE_TAP : NOTE_KEY, nn = Math.max(1, Math.round(D.note.h / (sec * ts * 1.4))), ls = wrap(c, fS(sec), nt, D.note.w, nn) || [nt];
    ls.forEach((l, j) => rest.push(txt(l, D.note.x + D.note.w / 2, D.note.y + sec * ts * 1.4 * (j + 0.5), sec, {col: CONST.t2, role: "secondary", align: "center"})));
  } else if (G.page === PU && items[POWER[0].name].tile) {
    for (const p of POWER) {
      const q = items[p.name], r = q.r, x = r.x + 8, tx = x + q.cell + 10, hs = tap && ui.narrow ? helpOf(p, NARROW_TAP) : helpOf(p, W, tap);
      rest.push({op: "lane", r}, {op: "well", r: R(x, r.y + 8, q.cell, q.cell)}, {op: "item", t: p.t, x, y: r.y + 8, s: q.cell});
      rest.push(txt(p.name, tx, r.y + 8 + q.cell / 2, pri, {name: p.name}));
      const hl = q.lines ? wrap(c, fS(sec), hs, r.w - 16, q.lines) || [] : [];
      hl.forEach((s, j) => rest.push(txt(s, x, r.y + 8 + q.cell + 6 + sec * ts * 1.25 * (j + 0.5), sec, {col: CONST.t2, role: "secondary"})));
      if (p.permanent) { rest.push({op: "fill", r: R(r.x + r.w - 7, r.y + 6, 3, q.cell + 4), col: CONST.ink}); info.push({name: p.name + " keeps", r: R(r.x + r.w - 7, r.y + 6, 3, q.cell + 4), col: CONST.ink}); }
    }
  } else if (G.page === PU) {
    for (const p of POWER) {
      const q = items[p.name], r = q.r, cy = r.y + r.h / 2, x = r.x + 8, tx = x + q.cell + 12, tw = r.x + r.w - 14 - 12 - tx;
      const hs = tap && ui.narrow ? helpOf(p, NARROW_TAP) : helpOf(p, W, tap), hl = wrap(c, fB(bod), hs, tw, q.lines) || [];
      const bh = pri * ts * 1.15 + (hl.length ? 2 + hl.length * bod * ts * 1.4 : 0), top = cy - bh / 2;
      rest.push({op: "lane", r}, {op: "well", r: R(x, cy - q.cell / 2, q.cell, q.cell)}, {op: "item", t: p.t, x, y: cy - q.cell / 2, s: q.cell});
      rest.push(txt(p.name, tx, top + pri * ts * 0.575, pri, {name: p.name}));
      hl.forEach((s, j) => rest.push(txt(s, tx, top + pri * ts * 1.15 + 2 + bod * ts * 1.4 * (j + 0.5), bod, {face: fB, col: CONST.t2, role: "body"})));
      if (p.permanent) { rest.push({op: "fill", r: R(r.x + r.w - 7, r.y + 6, 3, r.h - 12), col: CONST.ink}); info.push({name: p.name + " keeps", r: R(r.x + r.w - 7, r.y + 6, 3, r.h - 12), col: CONST.ink}); }
    }
  } else if (G.page === EN) enemies(c, G, ui, rest, focus, tips, info);
  else floorPlan(c, G, rest, info);
  return {rest, focus, tips, strips, info};
}
/* a GUIDE door's strip in strip px from (0, 0): label-first key pairs on HOW TO's door (keyboard and controller), else cells; whole parts only */
function stripOf(c, i, sw, sh, ph, tap, W) {
  const ops = [], s = sh, g = 6, dv = DEV[ph ? "p" : "d"];
  if (i === 0 && !ph && !tap) {
    let x = 0;
    for (const [lab, k] of [["MOVE", W.move], ["BOMB", W.bomb], ["THROW", W.throw], ["REMOTE", W.remote], ["PAUSE", W.pause]]) {
      const lw = Wm(c, T.label(dv.sec), lab), cw = capW(c, k), need = (x ? 14 : 0) + lw + 8 + cw;
      if (x + need > sw) break;
      x += x ? 14 : 0;
      ops.push(txt(lab, x, sh / 2, dv.sec, {col: CONST.t2, role: "secondary"}), {op: "cap", s: k, x: x + lw + 8, y: sh / 2 - dv.caph / 2, w: cw, h: Math.min(dv.caph, sh)});
      x += lw + 8 + cw;
    }
    return ops;
  }
  const list = i === 0 ? ["bomb", "throw", "remote", "kick"].map((t) => ({op: "item", t})) : i === 1 ? POWER.slice(0, 4).map((p) => ({op: "item", t: p.t})) : i === 2 ? [FOES[0], FOES[3], FOES[4]].map((e) => ({op: "foe", t: e.t, level: firstLevel(e.rooms)})) : [FLOOR_ROWS[2], FLOOR_ROWS[1], FLOOR_ROWS[0]].map((q) => ({op: "tile", k: q.k, room: q.room, heat: 1}));
  list.forEach((o, j) => { const x = j * (s + g); if (x + s > sw) return; if (o.op === "item") ops.push({op: "well", r: R(x, 0, s, s)}); ops.push({...o, x, y: 0, s}); });
  return ops;
}
function enemies(c, G, ui, rest, focus, tips, info) {
  const D = G.d, dv = DEV[D.dev], ts = textScale(), ph = D.dev === "p", desk = D.mode === "desk", pri = dv.pri, sec = dv.sec, bod = dv.bod;
  FOES.forEach((e, i) => {
    const q = D.items[e.name], r = q.r, home = firstLevel(e.rooms), v = PTS[e.t] || 100;
    if (desk) rest.push({op: "slab", r, name: e.name});
    else rest.push({op: "lane", r, alt: i % 2 === 1});
    rest.push({op: "foe", t: e.t, x: q.cell.x, y: q.cell.y, s: q.cell.w, level: home, floor: true});
    rest.push(txt(e.name, q.tx, q.nameY, pri, {name: e.name}));
    const pts = digitsOps(q, v, ph, false, dv);
    rest.push(...pts.rest);
    focus[i] = pts.focus;
    if (desk) {
      const hl = wrap(c, T.body(bod), helpOfFoe(e), q.tw, q.hl) || [];
      hl.forEach((s, j) => rest.push(txt(s, q.tx, q.helpY + bod * ts * 1.4 * (j + 0.5), bod, {face: T.body, col: CONST.t2, role: "body"})));
      const ap = [APPEARS + levelsOf(e.rooms), levelsOf(e.rooms)].find((s) => Wm(c, T.label(sec), s) <= q.tw);
      if (ap) rest.push(txt(ap, q.tx, q.appY + sec * ts * 0.625, sec, {col: CONST.t2, role: "secondary"}));
      for (let n = 1; n <= 8; n++) rest.push({op: "pip", r: R(q.pips.x + (n - 1) * 7, q.pips.y, 5, 12), on: inRooms(e.rooms, n)});
      info.push({name: e.name + " levels", r: q.pips, col: worldTokens(ui.level).lit});
    } else {
      rest.push(txt(levelsOf(e.rooms), q.tx, q.levY, sec, {col: CONST.t2, role: "secondary"}));
      if (q.helpY != null) { const hs = helpOfFoe(e); if (Wm(c, T.body(bod), hs) <= q.tw) rest.push(txt(hs, q.tx, q.helpY, bod, {face: T.body, col: CONST.t2, role: "body"})); }
    }
    const tg = D.tips[i], tp = tg.pad, tw = tg.r.w - 2 * tp, lines = wrap(c, T.body(bod), tipText(e.name), tw, Math.max(tg.n, 6)) || [tipText(e.name)];
    const ty = tg.r.y + 12, top = [{op: "tipPlate", r: tg.r, U: tg.U, Tt: tg.Tt}, {op: "wedge", ...tg.ptr}, txt(POINTS, tg.r.x + tp, ty + 18, pri, {name: "tip"})];
    const dr = R(tg.r.x + tg.r.w - tp - (ph ? 67 : 85), ty, ph ? 67 : 85, ph ? 28 : 36);
    top.push({op: "digits", v, r: dr, ph});
    lines.forEach((s, j) => top.push(txt(s, tg.r.x + tp, ty + 36 + 6 + bod * ts * 1.4 * (j + 0.5), bod, {face: T.body, col: CONST.t2, role: "body"})));
    tips[i] = top;
  });
}
function digitsOps(q, v, ph, foc, dv) {
  const p = q.pts, d = q.dig, sec = dv.sec, ts = textScale();
  const word = ph && !q.side ? txt(PTS_W, d.x + d.w / 2, d.y + d.h + 3 + sec * ts * 0.6, sec, {col: CONST.t2, role: "secondary", align: "center"}) : txt(PTS_W, d.x + d.w + 6, d.y + d.h / 2, sec, {col: CONST.t2, role: "secondary"});
  const dig = {op: "digits", v, r: d, ph};
  return {rest: [dig, word], focus: [{op: "band", r: p}, {op: "bomb", x: p.x + 8, cy: p.y + p.h / 2}, dig, word, {op: "ring", r: p}]};
}
function floorPlan(c, G, rest, info) {
  const D = G.d, dv = DEV[D.dev], ts = textScale(), desk = D.mode === "desk", pri = dv.pri, sec = dv.sec;
  const f0 = D.items[D.order[0]];
  if (desk) DIFF.forEach((s, j) => rest.push(txt(s, f0.r.x + 16 + j * (f0.s + f0.cg) + f0.s / 2, D.fhead.y + D.fhead.h / 2, sec, {col: CONST.t2, role: "secondary", align: "center"})));
  else rest.push(txt(DIFF.join(" · "), D.fhead.x, D.fhead.y + D.fhead.h / 2, sec, {col: CONST.t2, role: "secondary"}));
  for (const n of D.order) {
    const q = D.items[n], r = q.r, help = TILE_HELP[q.k], lvl = LABEL.LEVEL + " " + q.room + " · " + BIOMES[q.room - 1].name;
    rest.push({op: "lane", r});
    const cy = desk ? r.y + r.h / 2 : r.y + 8 + q.s / 2;
    for (let j = 0; j < 3; j++) rest.push({op: "tile", k: q.k, room: q.room, heat: j, x: r.x + (desk ? 16 : 8) + j * (q.s + q.cg), y: cy - q.s / 2, s: q.s});
    const tx = desk ? r.x + 16 + q.cellsW + 16 : r.x + 8 + q.cellsW + 10, all = help ? [DIFF[0] + " · " + help[0], DIFF[2] + " · " + help[2]] : ["LOOK ONLY FOR NOW", "ITS RULE COMES LATER"], lines = q.lean ? all.slice(0, 1) : all;
    const nw = Wm(c, T.label(pri), q.name), inl = tx + nw + 12 + Wm(c, T.label(sec), lvl) <= r.x + r.w - 12;
    const lhP = pri * ts * 1.15, lhS = sec * ts * 1.25, top = desk ? r.y + (r.h - (lhP + q.nl * lhS)) / 2 : r.y + 5;
    rest.push(txt(q.name, tx, top + lhP / 2, pri, {name: q.name}));
    if (inl) rest.push(txt(lvl, tx + nw + 12, top + lhP / 2, sec, {col: CONST.t2, role: "secondary"}));
    else if (!desk && !q.lean) rest.push(txt(lvl, tx, top + lhP + lhS / 2, sec, {col: CONST.t2, role: "secondary"}));
    let y = desk ? top + lhP : r.y + 5 + Math.max(q.s, lhP + (q.lean ? 0 : lhS)) + 4;
    const lx = desk ? tx : r.x + 8, lw = desk ? q.tw : r.w - 16;
    if (desk && q.nl === 1) { rest.push(txt(lines[0], lx, y + lhS / 2, sec, {col: CONST.t2, role: "secondary"}), txt(lines[1], lx + Wm(c, T.label(sec), lines[0]) + 24, y + lhS / 2, sec, {col: CONST.t2, role: "secondary"})); continue; }
    for (const s of lines) { const ls = wrap(c, T.label(sec), s, lw, 2) || [s]; for (const l of ls) { rest.push(txt(l, lx, y + lhS / 2, sec, {col: CONST.t2, role: "secondary"})); y += lhS; } }
  }
}

/* ---- paint ---- */
const BOMB_W = (ph) => DEV[ph ? "p" : "d"].bombs;
const GW = {time: 0.4}, ITEM = {t: "", col: "#fff", x: 0, y: 0}, ITEMS_BY = Object.fromEntries(POWER.map((p) => [p.t, p]));
const FOE_E = {type: "walker", color: "#8affc1", r: 14, home: {x: 3, y: 7}, invuln: false, dir: {x: 0, y: 1}}, FX = {a: 1, gl: 0, fl: 0, bl: null};
function foeArt(c, t, x, y, s, level, time, A, floor) {
  const f = FOES.find((q) => q.t === t) || FOES[0];
  if (floor) floorCell(c, x, y, s, homeArt(level), {par: 0, v: 0});
  if (A && A.foe) return blitAnim(c, foeAnim(A, f.t, time, {idleW: foeM(f.t).idleW, blink: blinkAt(f.t, pxSeed(f.t), time || 0) > 0.5}), x + s / 2, y + s / 2, s >= 40 ? 2 : 1);
  FOE_E.type = f.t; FOE_E.color = f.col; GW.time = time;
  c.save(); c.translate(x + s / 2, y + s / 2 + s * 0.04); c.scale(s / 34, s / 34);
  drawEnemyBody(c, GW, FOE_E, FX);
  c.restore();
  c.globalAlpha = 1;
}
function itemArt(c, t, x, y, s, A) {
  const p = ITEMS_BY[t];
  if (!p) return;
  if (A && A.items) return blitCell(c, itemCell(A, t), x + s / 2, y + s / 2, s >= 40 ? 2 : 1);
  ITEM.t = p.t; ITEM.col = p.col; GW.time = 0.4;
  c.save(); c.translate(x + s / 2, y + s / 2); const k = (s * 0.72 * 1.43) / CFG.TILE; c.scale(k, k);
  drawItemBody(c, GW, ITEM, 1, null);
  c.restore();
}
const SIDES4 = Object.freeze(["N", "E", "S", "W"]);
function tileArt(c, k, room, heat, x, y, s, A) {
  const sp = {kind: k, h: heat, par: 0, dir: 0, outer: SIDES4, exit: true, entry: true, phase: 0, state: 0, lit: 0, pair: 1, gx: 3, gy: 4};
  if (A && A.feat) return blitCell(c, [A.feat(room - 1, sp, 0)], x + s / 2, y + s / 2, s >= 40 ? 2 : 1);
  drawSpec(c, BIOMES[(room - 1) % BIOMES.length], sp, Math.round(x), Math.round(y), s);
}
const rp = (c, x, y, w, h, r) => { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
function wedge(c, o, col) {
  c.fillStyle = col; c.beginPath();
  if (o.dir === 2 || o.dir === -2) { c.moveTo(o.x, o.y - o.w / 2); c.lineTo(o.x, o.y + o.w / 2); c.lineTo(o.x + (o.dir > 0 ? o.h : -o.h), o.y); }
  else if (o.dir > 0) { c.moveTo(o.x - o.w / 2, o.y); c.lineTo(o.x + o.w / 2, o.y); c.lineTo(o.x, o.y + o.h); }
  else { c.moveTo(o.x - o.w / 2, o.y); c.lineTo(o.x + o.w / 2, o.y); c.lineTo(o.x, o.y - o.h); }
  c.closePath(); c.fill();
}
function digits(c, v, r, tok, ph) {
  const s = String(v), n = s.length, g = 2, dw = (r.w - (n - 1) * g) / n, px = ph ? 17 : 25;
  for (let i = 0; i < n; i++) {
    const x = r.x + i * (dw + g);
    key(c, x, r.y, dw, r.h, "lit", {tok});
    c.font = T.num(px / textScale()); c.fillStyle = CONST.dk; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(s[i], x + dw / 2, r.y - 2 + r.h / 2);
  }
}
function paintOps(c, ops, tok, o) {
  const ph = o.ph, A = o.A, strips = o.strips;
  for (const p of ops) {
    switch (p.op) {
      case "plate": plate(c, p.r.x, p.r.y, p.r.w, p.r.h, tok, {phone: ph}); break;
      case "slab": plate(c, p.r.x + SLAB_T + 2, p.r.y + SLAB_T + 2, p.r.w - 2 * SLAB_T - 4, p.r.h - 2 * SLAB_T - 5, tok, {phone: ph, T: SLAB_T}); c.fillStyle = tok.pane; c.fillRect(p.r.x + SLAB_T + 2, p.r.y + SLAB_T + 2, p.r.w - 2 * SLAB_T - 4, p.r.h - 2 * SLAB_T - 5); break;
      case "tipPlate": {
        const r = p.r;
        c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(r.x - p.Tt, r.y + p.Tt + 6, r.w + 2 * p.Tt, p.U ? Math.min(r.h, p.U.y + p.U.h - (r.y + p.Tt + 6)) : r.h);
        plate(c, r.x, r.y, r.w, r.h, tok, {phone: ph, T: p.Tt}); c.fillStyle = tok.pane; c.fillRect(r.x, r.y, r.w, r.h);
        break;
      }
      case "wedge": wedge(c, p, tok.wall); break;
      case "lane": if (p.alt || !ph) { c.fillStyle = tok.bed; c.beginPath(); rp(c, p.r.x, p.r.y, p.r.w, p.r.h, 4); c.fill(); } break;
      case "well": key(c, p.r.x, p.r.y, p.r.w, p.r.h, "well", {tok}); break;
      case "key": key(c, p.r.x, p.r.y, p.r.w, p.r.h, p.kind, {tok, ring: p.ring}); break;
      case "band": band(c, p.r.x, p.r.y, p.r.w, p.r.h, tok); break;
      case "bomb": focusBomb(c, p.x, p.cy, BOMB_W(ph)); break;
      case "ring": c.strokeStyle = CONST.ink; c.lineWidth = 3; c.beginPath(); rp(c, p.r.x - 4.5, p.r.y - 4.5, p.r.w + 9, p.r.h + 9, 10.5); c.stroke(); break;
      case "text": c.font = p.f; c.fillStyle = p.col; c.textAlign = p.align; c.textBaseline = "middle"; c.fillText(p.s, p.x, p.y); break;
      case "dsp": dsp(c, p.s, p.x, p.y, p.px); break;
      case "cap": cap(c, p.x, p.y, p.s, {tok, phone: ph}); break;
      case "glyph": if (p.n === "back") { c.save(); c.strokeStyle = p.col; c.lineWidth = 2.6; c.lineCap = c.lineJoin = "round"; c.beginPath(); c.moveTo(p.x + 10, p.y + 3); c.lineTo(p.x + 5, p.y + 8); c.lineTo(p.x + 10, p.y + 13); c.stroke(); c.restore(); } else glyph(c, p.n, p.x, p.y, p.s, p.col); break;
      case "fill": c.fillStyle = p.col; c.fillRect(p.r.x, p.r.y, p.r.w, p.r.h); break;
      case "pip": c.fillStyle = CONST.ol; c.fillRect(p.r.x - 1, p.r.y - 1, p.r.w + 2, p.r.h + 2); c.fillStyle = p.on ? tok.lit : tok.well; c.fillRect(p.r.x, p.r.y, p.r.w, p.r.h); break;
      case "digits": { const L = o.dig && o.dig[p.v + "|" + p.r.w + "x" + p.r.h]; if (L && L.width) c.drawImage(L, p.r.x - 1, p.r.y - 3, p.r.w + 2, p.r.h + 9); else digits(c, p.v, p.r, tok, p.ph); break; }
      case "foe": foeArt(c, p.t, p.x, p.y, p.s, p.level || 1, o.time == null ? 0.4 : o.time, A, p.floor); break;
      case "item": itemArt(c, p.t, p.x, p.y, p.s, A); break;
      case "tile": tileArt(c, p.k, p.room, p.heat, p.x, p.y, p.s, A); break;
      case "wall": wallCell(c, p.x, p.y, p.s, homeArt(p.level), {code: 1}); break;
      case "strip": { const S = strips && strips[p.l]; if (!S) break; if (o.blit && o.blit[p.l]) c.drawImage(o.blit[p.l], p.x, p.y, S.w, S.h); else { c.save(); c.translate(p.x, p.y); paintOps(c, S.ops, tok, {...o, blit: null}); c.restore(); } break; }
    }
  }
}

/* ---- the probe record ---- */
function record(G, P, ui, foc, dpr, el) {
  const u = G.u, D = G.d, b = (r) => [r.x * u, r.y * u, r.w * u, r.h * u], tok = worldTokens(ui.level), ts = textScale();
  probe.begin(SHOT[G.page], {w: G.W, h: G.H, dpr, el});
  probe.rect("plate", ...b(D.plate), {plate: G.T, fill: tok.bedA});
  const tg = G.page === EN && ui.tip && foc != null && D.tips ? D.tips[foc] : null, hidden = tg ? tg.cover.map((j) => D.items[D.order[j]].r) : [];
  const under = (x, y, w2, h2) => hidden.some((r) => x < r.x + r.w && x + w2 > r.x && y < r.y + r.h && y + h2 > r.y);
  const text = (p, dx = 0, dy = 0) => {
    const px = p.px * ts, capH = px * CAP_K, wd = Math.max(0.01, p.mw || 1), x0 = (p.align === "right" ? p.x - wd : p.align === "center" ? p.x - wd / 2 : p.x) + dx, y0 = p.y + dy - capH / 2;
    if (under(x0, y0, wd, capH)) return;
    probe.text(p.s, x0 * u, y0 * u, wd * u, capH * u, {role: p.role, col: p.col, px: p.px * ts * u, ...(p.lock ? {lock: true} : {})});
  };
  const all = (ops, dx = 0, dy = 0) => { for (const p of ops) if (p.door && p.door === ui.focus) continue; else if (p.op === "text") text(p, dx, dy); else if (p.op === "dsp") text({...p, f: T.display(p.px), role: "primary", col: CONST.ink, align: "left", mw: p.mw}, dx, dy); else if (p.op === "strip") all(P.strips[p.l].ops, p.x + dx, p.y + dy); };
  if (D.head.back) probe.rect("BACK", ...b(D.head.back), {touch: !!G.touch, set: "back"});
  for (const n of G.order) {
    const q = D.items[n];
    if (G.page === GUIDE) probe.rect(n, ...b(q.r), {touch: !!G.touch, set: "doors", kind: "list", focus: n === ui.focus, fill: n === ui.focus ? tok.band : tok.key});
    else if (G.page === EN) { const i = G.order.indexOf(n), r = G.touch ? D.hit[n] : q.pts; if (!under(r.x, r.y, r.w, r.h) || i === foc) probe.rect(n, ...b(r), {touch: !!G.touch, set: "foes", kind: "list", focus: i === foc, fill: i === foc ? tok.band : tok.key}); }
  }
  all(P.rest);
  if (G.page === GUIDE && ui.focus && P.focus[ui.focus]) all(P.focus[ui.focus].filter((p) => p.op === "text" || p.op === "strip"));
  if (tg) { probe.rect("tip", ...b(tg.r), {plate: tg.Tt * u}); for (const p of P.tips[foc]) if (p.op === "text") { const px = p.px * ts, capH = px * CAP_K; probe.text(p.s, (p.align === "right" ? p.x - p.mw : p.x) * u, (p.y - capH / 2) * u, Math.max(0.01, p.mw) * u, capH * u, {role: p.role, col: p.col, px: p.px * ts * u}); } }
  for (const m of P.info) if (!under(m.r.x, m.r.y, m.r.w, m.r.h)) { const pad = m.pad || 6; probe.pair("info", b(m.r), b(R(m.r.x - pad, m.r.y - pad, m.r.w + 2 * pad, m.r.h + 2 * pad)), {col: m.col, name: m.name}); }
  const fr = G.page === GUIDE ? (ui.focus && D.items[ui.focus] ? D.items[ui.focus].r : null) : G.page === EN && foc != null ? D.items[D.order[foc]].pts : null;
  if (fr) {
    const bed = R(D.plate.x + 1, fr.y, Math.max(1, Math.min(6, fr.x - 7 - D.plate.x - 1)), fr.h);
    probe.pair("band", b(fr), b(bed), {name: "focus"});
    probe.pair("ring", b(R(fr.x - 6, fr.y - 6, fr.w + 12, fr.h + 12)), b(bed), {name: "ring"});
  }
  const F = D.foot && P.foot;
  if (F) {
    probe.rect("foot", ...b(F));
    for (const p of F.parts) {
      const capH = F.px * ts * CAP_K, y0 = F.mid - capH / 2;
      if (p.cap) { probe.rect("foot cap", ...b(R(p.x, F.mid - DEV.d.caph / 2, p.w, DEV.d.caph))); if (!Array.isArray(p.cap)) probe.text(p.cap, (p.x + 10) * u, y0 * u, Math.max(0.01, p.w - 20) * u, capH * u, {role: "secondary", col: CONST.t2, px: F.px * ts * u}); }
      else probe.text(p.sep || p.t, p.x * u, y0 * u, p.w * u, capH * u, {role: "secondary", col: p.sep ? CONST.off : CONST.t2, px: F.px * ts * u, ...(p.sep ? {lock: true} : {})});
    }
  }
}
/* measured widths for the record (a probe text's w is its drawn width) */
function widths(c, ops, strips) { for (const p of ops) { if (p.op === "text" && p.mw == null) p.mw = Wm(c, p.f, p.s); else if (p.op === "dsp" && p.mw == null) p.mw = Wm(c, T.display(p.px), p.s); else if (p.op === "strip" && strips[p.l]) widths(c, strips[p.l].ops, strips); } }

/* ---- the foot (desk): label first, keycap last ---- */
function footPlan(c, G, ui) {
  const D = G.d, dv = DEV.d, f = T.label(dv.sec), W = hints(), tap = tapMode(!!G.touch), items = [], pad = W.dev === "pad";
  const mv = G.page !== GUIDE && G.page !== EN ? null : pad ? [W.move] : [["up"], ["dn"], ["lf"], ["rt"]];
  if (tap) items.push({t: G.page === GUIDE ? "TAP A DOOR · " + BACK_TAP : G.page === EN ? "TAP A POINTS VALUE · " + BACK_TAP : BACK_TAP});
  else {
    if (G.page === HOW && pad) items.push({t: "REBIND IN " + LABEL.SETTINGS + " › CONTROLS"});
    if (G.page === PU) items.push({t: "WALK OVER A POWER-UP TO COLLECT"});
    if (mv) items.push({t: G.page === GUIDE ? "PICK" : "MOVE", caps: mv});
    if (G.page === GUIDE) items.push({t: "OPEN", caps: [W.ok]});
    if (G.page === EN) items.push({t: POINTS, caps: [W.ok]});
    items.push({t: "BACK", caps: G.page === HOW ? [W.back, W.ok] : [W.back]});
  }
  const parts = [];
  items.forEach((it, i) => {
    if (i) parts.push({sep: "·"});
    parts.push({t: it.t, w: Wm(c, f, it.t)});
    if (it.caps) it.caps.forEach((q, j) => parts.push({cap: q, w: Array.isArray(q) ? dv.capw : capW(c, q), gap: j ? 5 : 8}));
  });
  let w = 0;
  parts.forEach((p, i) => { if (p.sep) p.w = Wm(c, f, p.sep); w += (i ? (p.cap ? p.gap : 12) : 0) + p.w; });
  const fw = w + 36, x = D.plate.x + D.plate.w / 2 - fw / 2, y = D.foot.y;
  let cx = x + 18;
  parts.forEach((p, i) => { cx += i ? (p.cap ? p.gap : 12) : 0; p.x = cx; cx += p.w; });
  return {x, y, w: fw, h: FOOT_H, f, px: dv.sec, parts, mid: y + FOOT_H / 2};
}
function tri(c, n, x, y, s, col) { c.save(); c.translate(x, y); c.scale(s / 16, s / 16); c.fillStyle = col; c.beginPath(); if (n === "lf") { c.moveTo(11, 3); c.lineTo(5, 8); c.lineTo(11, 13); } else { c.moveTo(5, 3); c.lineTo(11, 8); c.lineTo(5, 13); } c.closePath(); c.fill(); c.restore(); }
function paintFoot(c, P, tok) {
  const {x, y, w, h} = P, rr = (x0, y0, w0, h0, r0, col) => { c.fillStyle = col; c.beginPath(); rp(c, x0, y0, w0, h0, r0); c.fill(); };
  rr(x, y + 4, w, h, 8, CONST.ol); rr(x, y, w, h, 8, CONST.ol); rr(x + 2, y + 2, w - 4, h - 4, 6, tok.bed);
  c.fillStyle = tok.keyhi; c.fillRect(x + 6, y + 2, w - 12, 2);
  for (const p of P.parts) {
    c.font = P.f; c.textAlign = "left"; c.textBaseline = "middle";
    if (p.sep) { c.fillStyle = CONST.off; c.fillText(p.sep, p.x, P.mid); }
    else if (p.cap) {
      const cy = P.mid - DEV.d.caph / 2;
      if (Array.isArray(p.cap)) { key(c, p.x, cy, p.w, DEV.d.caph, "key", {tok}); const g = p.cap[0], gx = p.x + (p.w - 13) / 2, gy = cy + (DEV.d.caph - 13) / 2; if (g === "lf" || g === "rt") tri(c, g, gx, gy, 13, CONST.t2); else glyph(c, g, gx, gy, 13, CONST.t2); }
      else cap(c, p.x, cy, p.cap, {tok});
    } else { c.fillStyle = CONST.t2; c.fillText(p.t, p.x, P.mid); }
  }
}

export const _dbg = {plans: 0, last: null};
let S = null;
const outer = (D) => R(D.plate.x - D.T - 2, D.plate.y - D.T - 2, D.plate.w + 2 * D.T + 4, D.plate.h + 2 * D.T + 5);
function sizes(S, G, F, level, tok, look) {
  const D = G.d, u = G.u, dpr = S.dpr, ob = outer(D), K = {biome: tok.name, level, W: F.W, H: F.H, look, textScale: S.ts};
  S.rd = roomDpr(S.c, F, {rev: S.ui.rev}, dpr); // the room's dpr: MENU's own rule (pages/menu.js roomDpr), so MENU and GUIDE share one room layer
  S.roomK = keyOf({layer: "room", biome: tok.name, level, W: F.W, H: F.H, dpr: S.rd, look: "2d", textScale: 1});
  const roomB = Math.round(F.W * S.rd) * Math.round(F.H * S.rd) * 4, area = ob.w * u * ob.h * u;
  const tipA = D.tips ? Math.max(...D.tips.map((q) => (q.r.w + 2 * q.Tt + 4) * (q.r.h + 2 * q.Tt + 12))) * u * u * 2 : 0, footA = D.foot ? (D.plate.w + 4) * (FOOT_H + 8) * u * u : 0;
  const pd = +Math.max(0.5, Math.min(dpr, Math.sqrt(Math.max(0, BUDGET - 1024 * 1024 - roomB) / (4 * (area + tipA + footA + 4 * 400 * 40 * u * u))))).toFixed(3);
  S.pd = pd; S.ob = ob; S.pb = sc(ob, u);
  const id = [G.page, G.mode, +u.toFixed(6), JSON.stringify(D.plate), S.A ? "px" : "2d", JSON.stringify(hints()), S.tap, S.ui.narrow ? 1 : 0].join("|");
  S.plateKey = {...K, dpr: pd, layer: "guide.plate|" + id}; S.plateK = keyOf(S.plateKey);
  S.pw = Math.max(1, Math.round(S.pb.w * pd)); S.ph = Math.max(1, Math.round(S.pb.h * pd));
  if (S.P.foot) { const fp = S.P.foot, fr = R(fp.x - 1, fp.y - 1, fp.w + 2, fp.h + 6); S.footR = fr; S.footB = sc(fr, u); S.footKey = {...K, dpr: pd, layer: "guide.foot|" + JSON.stringify([+u.toFixed(6), fp.x, fp.y, fp.w, fp.parts.map((p) => [p.t || p.sep || "", p.cap || ""])])}; S.footK = keyOf(S.footKey); }
  S.stripKeys = {};
  for (const [l, st] of Object.entries(S.P.strips)) S.stripKeys[l] = {...K, dpr: pd, layer: "guide.strip|" + id + "|" + l};
  S.tipKeys = {};
  if (D.tips) for (const q of D.tips) { const k = q.r.w.toFixed(2) + "x" + q.r.h.toFixed(2); if (!S.tipKeys[k]) S.tipKeys[k] = {...K, dpr: pd, layer: "guide.tip|" + id + "|" + k}; }
  /* the brick digits a focused points value and the tooltip blit: one layer per value and size */
  S.digKeys = {};
  if (D.tips) for (const tg of S.P.tips) for (const p of tg) if (p.op === "digits") S.digKeys[p.v + "|" + p.r.w + "x" + p.r.h] = {v: p.v, r: p.r, ph: p.ph, key: {...K, dpr: pd, layer: "guide.dig|" + id + "|" + p.v + "|" + p.r.w + "x" + p.r.h}};
  if (D.tips) for (const k in S.P.focus) for (const p of S.P.focus[k]) if (p.op === "digits") S.digKeys[p.v + "|" + p.r.w + "x" + p.r.h] = {v: p.v, r: p.r, ph: p.ph, key: {...K, dpr: pd, layer: "guide.dig|" + id + "|" + p.v + "|" + p.r.w + "x" + p.r.h}};
}
function same(S, G, ui, w, touchy, dpr, ts, c, tap, A) {
  return !!S && S.G === G && S.w === w && S.touch === touchy && S.dpr === dpr && S.ts === ts && S.c === c && S.tap === tap && S.A === A && S.ui.level === ui.level && S.ui.narrow === ui.narrow && S.ui.rev === ui.rev;
}
const tipKeyOf = (q) => q.r.w.toFixed(2) + "x" + q.r.h.toFixed(2);
/** Paints the GUIDE page ui.page on c (#sh's context, or #c's) for the frame F; see the header for ui. */
export function drawGuidePage(c, F, ui, t = 0) {
  if (!okBox(F)) return;
  const page = ui.page || GUIDE, level = ui.level | 0 || 1, tok = worldTokens(level), G = guideGeom(F, page), u = G.u, words = hints(), ts = textScale(), touchy = !!F.touch;
  const dev = deviceScale(c), dpr = capDpr(dev, touchy), tap = tapMode(touchy), A = ui.look === "px" ? pixelArt() : null, ph = G.d.dev === "p";
  if (!same(S, G, ui, words, touchy, dpr, ts, c, tap, A)) {
    const P = plan(c, G, ui), mc = mOf(c);
    widths(mc, P.rest, P.strips); for (const k in P.focus) widths(mc, P.focus[k], P.strips); for (const q of P.tips) widths(mc, q, P.strips);
    P.foot = G.d.foot ? footPlan(mc, G, ui) : null;
    S = {G, w: words, touch: touchy, dpr, ts, c, tap, A, ui: {...ui}, P, plate: null, foot: null, strips: {}, tipL: {}, dig: {}};
    sizes(S, G, F, level, tok, A ? "px" : "2d");
    _dbg.plans++;
  }
  const P = S.P, foc = page === GUIDE ? (DOORS.includes(ui.focus) ? ui.focus : null) : page === EN && ui.focus != null && ui.focus >= 0 && ui.focus < FOES.length && (!tap || ui.tip) ? ui.focus | 0 : null;
  const tipOn = page === EN && foc != null && !!ui.tip, o = {ph, A, strips: P.strips, time: 0.4};
  _dbg.last = {G, P, foc, tipOn, S};
  if (typeof c.clip !== "function" || typeof c.rect !== "function") return;
  if (canMake()) {
    const room = (S.room && S.room.width) ? (hold(S.roomK), S.room) : (S.room = roomLayer({w: F.W, h: F.H}, level, tok, {dpr: S.rd, look: "2d", textScale: 1}));
    for (const [l, st] of Object.entries(P.strips)) {
      const k = S.stripKeys[l];
      if (!S.strips[l] || !S.strips[l].width) S.strips[l] = layer(k, Math.max(1, Math.round(st.w * u * S.pd)), Math.max(1, Math.round(st.h * u * S.pd)), (g) => { g.scale(S.pd * u, S.pd * u); paintOps(g, st.ops, tok, {...o, blit: null}); });
      else hold(k);
    }
    if (!S.plate || !S.plate.width) S.plate = layer(S.plateKey, S.pw, S.ph, (g) => { g.scale(S.pd * u, S.pd * u); g.translate(-S.ob.x, -S.ob.y); paintOps(g, P.rest, tok, {...o, blit: S.strips}); });
    else hold(S.plateK);
    if (P.foot) { if (!S.foot || !S.foot.width) S.foot = layer(S.footKey, Math.round(S.footB.w * S.pd), Math.round(S.footB.h * S.pd), (g) => { g.scale(S.pd * u, S.pd * u); g.translate(-S.footR.x, -S.footR.y); paintFoot(g, P.foot, tok); }); else hold(S.footK); }
    if (G.d.tips) for (const q of G.d.tips) {
      const k = tipKeyOf(q), K = S.tipKeys[k], pad = q.Tt + 3, pr = R(q.r.x - pad, q.r.y - pad, q.r.w + 2 * pad, q.r.h + 2 * pad + 6);
      if (!S.tipL[k] || !S.tipL[k].cv.width) S.tipL[k] = {cv: layer(K, Math.round(pr.w * u * S.pd), Math.round(pr.h * u * S.pd), (g) => { g.scale(S.pd * u, S.pd * u); g.translate(-pr.x, -pr.y); paintOps(g, [{op: "tipPlate", r: q.r, U: q.U, Tt: q.Tt}], tok, o); }), dx: pad, dy: pad, w: pr.w, h: pr.h};
      else hold(K);
    }
    for (const [k, q] of Object.entries(S.digKeys)) {
      const pr = R(q.r.x - 1, q.r.y - 3, q.r.w + 2, q.r.h + 9);
      if (!S.dig[k] || !S.dig[k].width) S.dig[k] = layer(q.key, Math.max(1, Math.round(pr.w * u * S.pd)), Math.max(1, Math.round(pr.h * u * S.pd)), (g) => { g.scale(S.pd * u, S.pd * u); g.translate(-pr.x, -pr.y); digits(g, q.v, q.r, tok, q.ph); });
      else hold(q.key);
    }
    o.dig = S.dig;
    c.save(); c.imageSmoothingEnabled = true; c.drawImage(room, 0, 0, F.W, F.H); c.drawImage(S.plate, S.pb.x, S.pb.y, S.pb.w, S.pb.h);
    if (P.foot) c.drawImage(S.foot, S.footB.x, S.footB.y, S.footB.w, S.footB.h);
    c.restore();
  } else {
    c.save(); c.fillStyle = toL(tok.bg1, 0.004); c.fillRect(0, 0, F.W, F.H); c.scale(u, u);
    paintOps(c, P.rest, tok, o);
    if (P.foot) paintFoot(c, P.foot, tok);
    c.restore();
  }
  c.save(); c.scale(u, u);
  if (page === GUIDE && foc) paintOps(c, P.focus[foc], tok, {...o, blit: canMake() ? S.strips : null});
  if (page === EN && foc != null) {
    const q = G.d.items[G.d.order[foc]], e = FOES[foc];
    foeArt(c, e.t, q.cell.x, q.cell.y, q.cell.w, firstLevel(e.rooms), t, A, true);
    paintOps(c, P.focus[foc], tok, o);
    if (tipOn) {
      const tg = G.d.tips[foc], L = S.tipL[tipKeyOf(tg)];
      if (canMake() && L) { c.drawImage(L.cv, tg.r.x - L.dx, tg.r.y - L.dy, L.w, L.h); paintOps(c, P.tips[foc].slice(1), tok, o); }
      else paintOps(c, P.tips[foc], tok, o);
    }
  }
  c.restore();
  if (probe.probe.on) record(G, P, {...ui, level, focus: page === GUIDE ? foc : ui.focus}, foc, dpr, F.shell ? "sh" : "c");
}
