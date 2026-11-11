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
import {key, cap, capW, plate, band, focusBomb, glyph, wallCell, floorCell, plaque, rpath as rp} from "../kit/paint.js";
import {T, DEV, dsp, measure, textScale, measurer as mOf, CAP_K} from "../kit/type.js";
import {deep, R, sc, okBox, inR} from "../kit/geom.js";
import {layer, capDpr, touch as hold, keyOf, canMake, BUDGET} from "../kit/cache.js";
import {roomLayer, roomDpr} from "../kit/room.js";
import * as probe from "../kit/probe.js";
import {PAGE_KEY, PAGE_GAP, pagerKeys, pageLabel, pageOfFocus as pageOfName} from "../kit/pager.js";
import {menuGeom, FOOT_H, TZ, TOUCH_U, TOP_MIN, GUT} from "./menu.js";
import {deviceScale} from "../logo/draw2d.js";
import {drawEnemyBody} from "../sprites.js";
import {drawItemBody} from "../itemdraw.js";
import {drawSpec} from "../featdraw.js";
import {pixelArt, itemCell, foeCell as pxFoe, blitCell, blitAnim, foeAnim, seedOf as pxSeed} from "../hudart.js";
import {foeM, blinkAt} from "../motion.js";
import {hints, tapMode} from "../hintcopy.js";

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

/* desk plate widths [text scale 1, 1.25]; under PW_MIN the box narrows the plate no further (only #c's 600 wide box and the iso guard scale); pads [top, right, bottom, left] */
const PWD = deep({[GUIDE]: [860, 960], [HOW]: [960, 1060], [PU]: [1250, 1250], [EN]: [1250, 1300], [FL]: [1250, 1250]});
const PW_MIN = 520, PAD = deep({d: [18, 22, 22, 22], p: [12, 12, 14, 12], c: [8, 12, 10, 12]});
const CP = 9;
/* the tooltip's side padding: the mock's 16, 10 in the compact arrangement's narrow column */
const TIP_PAD = deep({d: 16, c: 10});
/* the pager: two page keys under the body (a touch target on every layout), PAGER its height with the gap above it */
/* touch keys (BACK, the page keys) take 46: 2 over the 44 CSS px floor, so a stage's whole-px snap never lands them under it */
export const BACK_H = 46, PAGER = PAGE_KEY + PAGE_GAP, PAGE = "PAGE";
export {PAGE_KEY};
export const TOP = 70, FOOT_GAP = 18, EST = 0.66, TIP_T = deep({d: 8, p: 6}), SLAB_T = 8, PHONE_MAX = 600, COMPACT_MAX = 960, BACK_W = 112, CUE_H = 34;
/* the text floors (appendix 11): the least desk scale that keeps primary 14, secondary 11 and body 17.9 px at this text scale */
export const uFloor = (ts) => Math.max(17.9 / (DEV.d.bod * ts), 11 / (DEV.d.sec * ts * CAP_K), 14 / (DEV.d.pri * ts * CAP_K));
const est = (s, px) => String(s).length * EST * px;
const firstLevel = (rooms) => +String(rooms).match(/\d+/)[0];
const inRooms = (rooms, n) => String(rooms).split(",").some((p) => { const [a, b] = p.trim().split("-").map(Number); return n >= a && n <= (b || a); });
/* a teaser breaks only at its " · " (each part whole on its line), the words.js step-down for a "2 RULES · 6 CONTROLS" pair */
const partsOf = (meas, s, w) => { const out = []; let line = ""; for (const p of String(s).split(" · ")) { const t = line ? line + " · " + p : p; if (!line || meas(t) <= w) line = t; else { out.push(line); line = p; } } if (line) out.push(line); return out; };
const subsOf = (tap, ph, W) => [tap || ph || W.dev === "pad" ? "2 RULES · 6 CONTROLS" : "2 RULES · 6 KEYS", POWER.length + " " + LABEL.POWER_UPS, FOES.length + " FOES", FLOOR_ROWS.length + " TILES"];
const helpOfFoe = (e) => { const s = e.help.replace(/\s*·\s*\d+$/, ""); return s.charAt(0).toUpperCase() + s.slice(1); };
/* a string's break points: spaces, but never inside a bracket ("(max 8)" stays whole) */
const words = (s) => String(s).match(/\([^)]*\)|[^\s(]+/g) || [""];
/* the geometry measures with the real text measure (a 1 x 1 canvas of its own, the same font strings the painter sets); with no canvas source
   (Node without a factory) it falls back to EST em per character, wider than the system sans, so the painter's wrap never needs more lines */
let MC;
function mctx() {
  if (MC !== undefined) return MC;
  try { MC = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(1, 1).getContext("2d") : typeof document !== "undefined" && document.createElement ? document.createElement("canvas").getContext("2d") : null; } catch (e) { MC = null; }
  if (MC && typeof MC.measureText !== "function") MC = null;
  return MC;
}
const mw = (face, px, s) => { const c = mctx(); return c ? measure(c, face(px), String(s)) : est(s, px * textScale()); };
/** Test seam: the geometry's measuring context (undefined: find one again), and the geometry memo dropped. */
export const _measureWith = (c) => { MC = c; gm = null; };
/* lines a string takes at width w (a word wider than w counts as a line of its own) */
function linesOf(face, px, s, w) {
  let n = 1, line = "";
  for (const word of words(s)) { const t = line ? line + " " + word : word; if (!line || mw(face, px, t) <= w) line = t; else { n++; line = word; } }
  return n;
}

/* ---- geometry ---- */
/* items in grid order, row-major; a row is as tall as its tallest; returns {h, rects, rows [{y, h}], ri (each item's row), cw} */
function grid(n, cols, gap, w, hOf, gy = gap) {
  const cw = (w - (cols - 1) * gap) / cols, rects = [], rows = [], ri = [];
  let y = 0;
  for (let r = 0; r * cols < n; r++) {
    let rh = 0;
    for (let c = 0; c < cols && r * cols + c < n; c++) rh = Math.max(rh, hOf(r * cols + c, cw));
    for (let c = 0; c < cols && r * cols + c < n; c++) { rects.push(R(c * (cw + gap), y, cw, rh)); ri.push(r); }
    rows.push({y, h: rh});
    y += rh + gy;
  }
  return {h: Math.max(0, y - gy), rects, rows, ri, cw, cols};
}
/* each page's body in design px from (0, 0) at width iw: {h, top (a header repeated on every page), bands [{y, h}] (the rows a page break may fall
   between), items [{name, r, band, ...}], ...} */
function body(page, m, iw) {
  const {dv, ts, dev} = m, ph = dev === "p", gap = ph ? 10 : 12, P = dv.pri, Sx = dv.sec, Bd = dv.bod;
  const lhP = P * ts * 1.15, lhS = Sx * ts * 1.25, lhB = Bd * ts * 1.4, L = (s, px) => mw(T.label, px, s);
  if (page === GUIDE) {
    /* a door's name and teaser take the lines they need beside the focused bomb and the chevron (the one wrap rule: a slot grows, never clips) */
    const strip = ph ? 30 : 32, cols = m.mode === "phone" ? 1 : 2, cw = (iw - (cols - 1) * gap) / cols, tw = cw - (8 + dv.bombs + 8) - 18 - 16 - 10, subs = subsOf(m.tap, ph, m.W);
    const nL = Math.max(...DOORS.map((l) => linesOf(T.label, P, l, tw))), nS = Math.max(...subs.map((t) => partsOf((x) => mw(T.label, Sx, x), t, tw).length));
    const dh = 14 + nL * lhP + 2 + nS * lhS + 8 + strip + 14, g = grid(4, cols, gap, iw, () => dh);
    return {h: g.h, top: 0, bands: g.rows, gap, items: DOORS.map((l, i) => ({name: l, r: g.rects[i], band: g.ri[i], ri: g.ri[i], strip, tw}))};
  }
  if (page === HOW) {
    /* a rule slab takes the lines its words need; the note too */
    const cols = m.mode === "phone" || iw < 700 ? 1 : 2, rh0 = ph ? 52 : 60, ch = ph ? 48 : 52, cs = rh0 - 2 * (SLAB_T + 2) - 12;
    const rl = (cw) => Math.max(...RULES.map((s) => linesOf(T.label, P, s, cw - 2 * (SLAB_T + 2) - 12 - cs - 12)));
    const rg = grid(2, cols, gap, iw, (i, cw) => Math.max(rh0, 2 * (SLAB_T + 2) + 12 + rl(cw) * lhP)), cg = grid(6, cols, 8, iw, () => ch, 8), y1 = rg.h + gap;
    const items = RULES.map((s, i) => ({name: s, r: rg.rects[i], band: rg.ri[i], kind: "rule", cs, lines: rl(rg.cw)}));
    howRows(m.W).forEach((q, i) => { const r = cg.rects[i]; items.push({name: q[1], r: R(r.x, r.y + y1, r.w, r.h), band: rg.rows.length + cg.ri[i], kind: "ctl", keys: q[0], icon: q[2]}); });
    const nl = linesOf(T.label, Sx, m.tap ? NOTE_TAP : NOTE_KEY, iw), nh = nl * Sx * ts * 1.4, ny = y1 + cg.h + 8;
    const bands = [...rg.rows, ...cg.rows.map((q) => ({y: q.y + y1, h: q.h})), {y: ny, h: nh}];
    return {h: ny + nh, top: 0, bands, items, note: {r: R(0, ny, iw, nh), band: bands.length - 1}, nl};
  }
  if (page === PU) {
    const hs = (p) => helpOf(p, m.narrow && m.tap ? NARROW_TAP : m.W, m.tap);
    if (m.mode !== "desk") {
      /* phone and compact: two tiles a row, the cell and the name across the top, the help under them in the secondary size, as many lines as it needs */
      const cell = 32, tw = (iw - gap) / 2 - 16, nl = Math.max(...POWER.map((p) => linesOf(T.label, Sx, hs(p), tw))), nw = (iw - gap) / 2 - 8 - cell - 10 - 10;
      const hh = Math.max(cell, Math.max(...POWER.map((p) => linesOf(T.label, P, p.name, nw))) * lhP); /* a name too wide for its tile breaks at its space (POWER BOMB at 125 %) */
      const g = grid(POWER.length, 2, gap, iw, () => 8 + hh + 6 + nl * lhS + 8, 8);
      return {h: g.h, top: 0, bands: g.rows, items: POWER.map((p, i) => ({name: p.name, r: g.rects[i], band: g.ri[i], cell, hh, nw, lines: nl, t: p.t, tile: true}))};
    }
    const cols = iw >= 900 ? 2 : 1, cell = 44, tw0 = (cw) => cw - 8 - cell - 12 - 14, lines = (cw) => Math.max(...POWER.map((p) => linesOf(T.body, Bd, hs(p), tw0(cw))));
    const g = grid(POWER.length, cols, gap, iw, (i, cw) => Math.max(cell + 12, 8 + lhP + 2 + lines(cw) * lhB + 8), 8);
    return {h: g.h, top: 0, bands: g.rows, items: POWER.map((p, i) => ({name: p.name, r: g.rects[i], band: g.ri[i], cell, lines: lines(g.cw), t: p.t}))};
  }
  if (page === EN) {
    const pts = L(PTS_W, Sx);
    if (m.mode === "desk") {
      /* the points key sits on the name's line, right-aligned (the round 7 frame), where the name and the focused key fit it by the measure; else under
         the name, its digits on the name's left edge (the focused key's bomb pushes them right, as a focused row's words move past MENU's bomb) */
      const cols = iw >= 1100 ? 3 : iw >= 700 ? 2 : 1, cw = (iw - (cols - 1) * gap) / cols, tw = cw - 2 * (SLAB_T + 2) - 2 * CP - 56 - 14, twK = tw, wF = dv.bombs + 10 + 85 + 6 + pts + 10;
      const one = FOES.map((e) => {
        const inl = L(e.name, P) + 10 + wF <= twK, nh = inl ? 44 : lhP + 4 + 44, hl = linesOf(T.body, Bd, helpOfFoe(e), tw);
        const ap = [APPEARS + levelsOf(e.rooms), levelsOf(e.rooms)].find((s) => L(s, Sx) <= tw) || levelsOf(e.rooms), an = linesOf(T.label, Sx, ap, tw);
        return {inl, nh, hl, ap, an, h: (SLAB_T + 2) * 2 + 1 + 2 * CP + Math.max(78, nh + 6 + hl * lhB + 4 + an * lhS)};
      });
      const g = grid(FOES.length, cols, gap, iw, (i) => one[i].h);
      const items = FOES.map((e, i) => { const r = g.rects[i], o = one[i], x0 = r.x + SLAB_T + 2 + CP, y0 = r.y + SLAB_T + 2 + CP, tx = x0 + 70, px = o.inl ? tx + twK - wF : tx, py = o.inl ? y0 : y0 + lhP + 4;
        const dig = o.inl ? R(px + dv.bombs + 10, py + 4, 85, 36) : R(tx, py + 4, 85, 36);
        return {name: e.name, t: e.t, r, band: g.ri[i], ri: g.ri[i], col: i % cols, cell: R(x0, y0, 56, 56), tx, tw, nameY: o.inl ? y0 + 22 : y0 + lhP / 2, pts: R(px, py, wF, 44), dig, digF: R(px + dv.bombs + 10, py + 4, 85, 36),
          helpY: y0 + o.nh + 6, hl: o.hl, appY: y0 + o.nh + 6 + o.hl * lhB + 4, ap: o.ap, an: o.an, pips: R(x0 + 1, y0 + 66, 54, 12)}; });
      return {h: g.h, top: 0, bands: g.rows, items, cols, gap, tipH: (w) => tipNeed(m, w), tipHd: tipHead(m)};
    }
    /* phone: one column, PTS under the digits; compact: two columns, PTS beside them. The help takes the lines it needs; at 125 % the phone and
       compact drop it (the round 6 phone frame's step-down) */
    const side = m.mode === "compact", pth = side ? 40 : 58, ptw = 8 + dv.bombs + 6 + 67 + (side ? 6 + pts : 0) + 8, cols = side && (iw - gap) / 2 >= 330 ? 2 : 1, cw = (iw - (cols - 1) * gap) / cols, tw = cw - 12 - 44 - 10 - ptw - 10;
    const help = !(ts > 1.1), hl = FOES.map((e) => (help ? linesOf(T.body, Bd, helpOfFoe(e), tw) : 0)), need = (i) => Math.max(side ? 48 : 64, 6 + lhP + lhS + hl[i] * lhB + 6);
    const g = grid(FOES.length, cols, gap, iw, (i) => need(i), 0);
    const items = FOES.map((e, i) => { const r = g.rects[i], x0 = r.x + 6, tx = x0 + 54, ptx = r.x + r.w - 6 - ptw, top = r.y + (r.h - (lhP + lhS + hl[i] * lhB)) / 2, py = r.y + (r.h - pth) / 2, dig = R(ptx + 8 + dv.bombs + 6, py + 6, 67, 28);
      return {name: e.name, t: e.t, r, band: g.ri[i], ri: g.ri[i], col: i % cols, cell: R(x0, r.y + (r.h - 44) / 2, 44, 44), tx, tw, nameY: top + lhP / 2, levY: top + lhP + lhS / 2, helpY: help ? top + lhP + lhS : null, hl: hl[i], pts: R(ptx, py, ptw, pth), dig, digF: dig, side}; });
    return {h: g.h, top: 0, bands: g.rows, items, cols, gap, help, iw, tipH: (w) => tipNeed(m, w), tipHd: tipHead(m)};
  }
  /* FLOOR: three tile cells (by difficulty) then the tile's name, its world and the NORMAL and EXPERT lines, every one whole; the level line on every row
     (beside the name where it fits on all of them, else under it), never on some. A desk plate under 700 wide stacks a row as the phone does (the
     cells and the name on top, the rules under them at the full width), so its rules wrap less */
  const desk = m.mode === "desk" && iw >= 700, s = desk ? 44 : m.mode === "desk" ? 36 : 30, cg = desk ? Math.max(6, Math.ceil(L(DIFF[2], Sx) - s + 6)) : 4, cellsW = 3 * s + 2 * cg;
  const colsF = desk || m.mode === "phone" || (iw - gap) / 2 < 300 ? 1 : 2, cwF = (iw - (colsF - 1) * gap) / colsF, tw = desk ? cwF - 16 - cellsW - 16 : cwF - 16, nameW = desk ? tw : cwF - 8 - cellsW - 10 - 8;
  const lvl = (q) => LABEL.LEVEL + " " + q.room + " · " + BIOMES[q.room - 1].name, two = (q) => { const h = TILE_HELP[q.k]; return h ? [DIFF[0] + " · " + h[0], DIFF[2] + " · " + h[2]] : ["LOOK ONLY FOR NOW", "ITS RULE COMES LATER"]; };
  const inl = FLOOR_ROWS.every((q) => L(q.name, P) + 12 + L(lvl(q), Sx) <= nameW), side = desk && FLOOR_ROWS.every((q) => { const [a, b] = two(q); return L(a, Sx) + 24 + L(b, Sx) <= tw; });
  const nl = FLOOR_ROWS.map((q) => (side ? 1 : two(q).reduce((n, x) => n + linesOf(T.label, Sx, x, tw), 0)));
  const hd = lhS + 6, rowH = (i) => (desk ? Math.max(s + 12, 6 + lhP + (inl ? 0 : lhS) + nl[i] * lhS + 6) : 5 + Math.max(s, lhP + (inl ? 0 : lhS)) + 4 + nl[i] * lhS + 5);
  const g = grid(FLOOR_ROWS.length, colsF, gap, iw, (i) => rowH(i), desk ? 6 : 4);
  return {h: hd + g.h, top: hd, bands: g.rows.map((q) => ({y: q.y + hd, h: q.h})), items: FLOOR_ROWS.map((q, i) => ({name: q.name, r: R(g.rects[i].x, g.rects[i].y + hd, g.rects[i].w, g.rects[i].h), band: g.ri[i], s, cg, cellsW, tw, nl: nl[i], side, inl, wide: desk, lvl: lvl(q), lines: two(q), k: q.k, room: q.room})), head: R(0, 0, iw, lhS), desk};
}
/* the tooltip's head: pad, the title row (36: POINTS and the value), then 6, the body lines and the bottom pad; a compact box (a landscape phone)
   has no room for the value's keys, so its title row is the POINTS word alone (the value sits ringed on the row it points at) */
const tipHead = (m) => (m.mode === "compact" ? {top: 8, th: m.dv.pri * m.ts * 1.15, bot: 8, dig: false} : {top: 12, th: 36, bot: 14, dig: true});
function tipNeed(m, w) {
  const n = Math.max(...FOES.map((e) => linesOf(T.body, m.dv.bod, tipText(e.name), w))), q = tipHead(m);
  return {h: q.top + q.th + 6 + n * m.dv.bod * m.ts * 1.4 + q.bot, n};
}
function headOf(page, m, iw) {
  const {dv, ts} = m, Sx = dv.sec, sec = Sx * ts, hint = page === EN ? (m.tap ? HINT.tap : HINT.key) : "", D = (s) => mw(T.display, dv.ttl, s);
  if (m.mode === "desk") {
    /* at 125 % the kicker goes (the round 7 t125 frame) and the hint rides the title's line where it fits */
    const kick = m.ts > 1.1 ? 0 : sec * 1.25, k2 = kick ? kick + 2 : 0, tt = dv.ttl * ts * 1.1, inline = !hint || mw(T.label, Sx, hint) + D(page) + 24 <= iw;
    return {h: k2 + tt + (inline ? 0 : 4 + sec * 1.3), kick: kick ? R(0, 0, iw, kick) : null, title: R(0, k2, iw, tt), hint: hint ? (inline ? R(0, k2, iw, tt) : R(0, k2 + 4 + tt, iw, sec * 1.3)) : null, s: hint};
  }
  const hn = hint ? linesOf(T.label, Sx, hint, iw) : 0, tt = dv.ttl * ts * 1.1, below = D(page) > iw - BACK_W - 16, ty = below ? BACK_H + 6 : 0, th = below ? tt : BACK_H;
  const hy = ty + th + 8, cy = hy + (hint ? hn * sec * 1.3 + 6 : 0), ch = m.cue ? CUE_H : 0;
  return {h: ty + th + (hint ? 8 + hn * sec * 1.3 : 0) + (m.cue ? (hint ? 6 : 8) + ch : 0), back: R(0, 0, BACK_W, BACK_H), title: below ? R(0, ty, iw, tt) : R(BACK_W + 16, 0, iw - BACK_W - 16, BACK_H),
    hint: hint ? R(0, hy, iw, hn * sec * 1.3) : null, cue: m.cue ? R(0, hint ? cy : ty + th + 8, iw, ch) : null, s: hint, hn};
}
function frameOf(F) {
  const ts = F.ts > 0 ? F.ts : textScale(), touch = !!F.touch, shell = !!F.shell, css = F.css > 0 ? F.css : 1;
  return {ts, touch, shell, css, t125: ts > 1.1, phone: shell && touch && F.H > F.W * 1.3};
}
/* page breaks: whole bands, greedy, each page as tall as `room` holds (its header included); null when one band is taller than a page. With `need`
   (ENEMIES off the desk: the tooltip's height) every band also keeps that much room above or below it on its page (the pager's strip counts), and
   the body grows toward `room` until it does */
function paginate(B, room, need = 0) {
  const n = B.bands.length, req = (b0, k) => { const y = B.bands[k].y - B.bands[b0].y; return !need || y >= need ? 0 : y + B.bands[k].h + need; };
  if (B.h <= room) { const r = Math.max(0, ...B.bands.map((_, k) => req(0, k))); if (B.top + r <= room) return {pages: [{b0: 0, b1: n, y0: B.top, h: B.h - B.top}], h: Math.max(B.h, B.top + r)}; }
  const per = room - PAGER - B.top, pages = [];
  let b0 = 0, r = 0;
  while (b0 < n) {
    let b1 = b0;
    while (b1 < n && B.bands[b1].y + B.bands[b1].h - B.bands[b0].y <= per && (b1 === b0 || req(b0, b1) <= room - B.top)) { r = Math.max(r, Math.min(room - B.top, req(b0, b1))); b1++; }
    if (b1 === b0) return null;
    pages.push({b0, b1, y0: B.bands[b0].y, h: B.bands[b1 - 1].y + B.bands[b1 - 1].h - B.bands[b0].y});
    b0 = b1;
  }
  return {pages, h: B.top + Math.max(Math.max(...pages.map((p) => p.h)) + PAGER, r)};
}
function lay(F, page, mode, fr) {
  const dev = mode === "desk" ? "d" : "p", dv = DEV[dev], W = hints(), m = {mode, dev, dv, ts: fr.ts, W, tap: tapMode(fr.touch), narrow: F.W < 560, cue: mode !== "desk" && W.dev === "pad"}, P0 = PAD[mode === "compact" ? "c" : dev];
  const tipNeed0 = (iw) => (page === EN && mode !== "desk" ? tipNeed(m, iw - 2 * TIP_T[dev] - 4 - 2 * (mode === "compact" ? TIP_PAD.c : TIP_PAD.d)).h + 2 * TIP_T[dev] + 5 : 0);
  const fit = (u, H, top0, tail, build) => {
    const S = build(u), fixed = top0 + P0[0] + S.hd.h + S.gap + P0[2] + tail, pg = paginate(S.bd, H / u - fixed, tipNeed0(S.iw));
    return pg ? {S, pg, u} : null;
  };
  if (mode === "desk") {
    const want = PWD[page][fr.t125 ? 1 : 0], side = 2 * (DEV.d.T + 2 + GUT), tail = FOOT_GAP + FOOT_H + 4 + 12;
    let u = Math.min(1, F.W / (PW_MIN + side));
    const build = (uu) => { const pw = Math.max(PW_MIN, Math.min(want, F.W / uu - side)), iw = pw - P0[1] - P0[3]; return {pw, iw, hd: headOf(page, m, iw), bd: body(page, m, iw), gap: 14}; };
    /* #c with no shell box (a keyboard window under 600 x 520, the iso guard) scales as one piece, as MENU does there; a shell box pages instead */
    if (!fr.shell) {
      const ok = (uu) => { const S = build(uu); return (TOP_MIN + P0[0] + S.hd.h + 14 + S.bd.h + P0[2] + tail) * uu <= F.H; };
      if (!ok(u)) { let lo = 0.25, hi = u; for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2; if (ok(mid)) lo = mid; else hi = mid; } u = lo; }
    }
    let R0 = fit(u, F.H, TOP_MIN, tail, build);
    if (!R0) { const S = build(u), pg = paginate(S.bd, Infinity), band = Math.max(...S.bd.bands.map((b) => b.h)); u = Math.min(u, F.H / (TOP_MIN + P0[0] + S.hd.h + 14 + S.bd.top + band + PAGER + P0[2] + tail)); R0 = fit(u, F.H, TOP_MIN, tail, build) || {S: build(u), pg, u}; }
    const {S, pg} = R0, Wd = F.W / u, Hd = F.H / u, plateH = P0[0] + S.hd.h + 14 + pg.h + P0[2], px = (Wd - S.pw) / 2, py = Math.max(TOP_MIN, Math.min(TOP, Hd - plateH - tail));
    return {mode, dev, u, m, plate: R(px, py, S.pw, plateH), ix: px + P0[3], iy: py + P0[0], iw: S.iw, hd: S.hd, bd: S.bd, pg, by: py + P0[0] + S.hd.h + 14, foot: R(px, py + plateH + FOOT_GAP, S.pw, FOOT_H)};
  }
  /* compact (a landscape phone's #c): margins just clear the plate's ring, tighter pads and head gap, so a foe's row keeps its tooltip's room */
  const side = 12, cp = mode === "compact", top = cp ? DEV.p.T + 2 : 20, bot = cp ? DEV.p.T + 3 : 20, hg = cp ? 8 : 12, max = mode === "phone" ? PHONE_MAX : COMPACT_MAX;
  let u = 1 / fr.css;
  const build = (uu) => { const pw = Math.min(F.W / uu - 2 * side, max), iw = pw - P0[1] - P0[3]; return {pw, iw, hd: headOf(page, m, iw), bd: body(page, m, iw), gap: hg}; };
  let R0 = fit(u, F.H, top, bot, build);
  if (!R0) { const S = build(u), pg = paginate(S.bd, Infinity), band = Math.max(...S.bd.bands.map((b) => b.h)); u = Math.min(u, F.H / (top + P0[0] + S.hd.h + hg + S.bd.top + band + PAGER + P0[2] + bot)); R0 = fit(u, F.H, top, bot, build) || {S: build(u), pg, u}; }
  const {S, pg} = R0, plateH = P0[0] + S.hd.h + hg + pg.h + P0[2], px = (F.W / u - S.pw) / 2, py = top + Math.max(0, F.H / u - top - bot - plateH) * (mode === "phone" ? 0 : 0.5);
  return {mode, dev, u, m, plate: R(px, py, S.pw, plateH), ix: px + P0[3], iy: py + P0[0], iw: S.iw, hd: S.hd, bd: S.bd, pg, by: py + P0[0] + S.hd.h + hg, foot: null};
}
const off = (r, x, y) => (r ? R(r.x + x, r.y + y, r.w, r.h) : null);
const RECTS = ["cell", "pts", "dig", "digF", "pips"], YS = ["nameY", "helpY", "appY", "levY"];
let gm = null;
export function guideGeom(F, page = GUIDE) {
  const fr = frameOf(F), W = hints();
  if (gm && gm.W === F.W && gm.H === F.H && gm.page === page && gm.touch === fr.touch && gm.shell === fr.shell && gm.css === fr.css && gm.ts === fr.ts && gm.words === W) return gm.G;
  let d = lay(F, page, fr.phone ? "phone" : "desk", fr);
  if (!fr.phone && fr.touch && !(d.u * fr.css >= Math.max(TOUCH_U, uFloor(fr.ts)) - 1e-9)) d = lay(F, page, "compact", fr);
  const u = d.u, x0 = d.ix, y0 = d.by, B = d.bd, pages = d.pg.pages, D = {mode: d.mode, dev: d.dev, u, plate: d.plate, foot: d.foot, T: DEV[d.dev].T, head: {}, items: {}, order: [], hit: {}, tips: null, pages: pages.length, pager: null};
  for (const k of ["kick", "title", "hint", "back", "cue"]) D.head[k] = off(d.hd[k], d.ix, d.iy);
  D.hintS = d.hd.s; D.hintN = d.hd.hn || 1;
  /* every band to its page: a page's first band starts under the repeated header */
  const pOf = [], dy = [];
  pages.forEach((p, i) => { for (let b = p.b0; b < p.b1; b++) { pOf[b] = i; dy[b] = B.top - p.y0; } });
  const place = (it) => {
    const q = {...it, page: pOf[it.band], r: off(it.r, x0, y0 + dy[it.band])};
    for (const k of RECTS) if (it[k] && typeof it[k] === "object") q[k] = off(it[k], x0, y0 + dy[it.band]);
    for (const k of YS) if (it[k] != null) q[k] = it[k] + y0 + dy[it.band];
    if (it.tx != null) q.tx = it.tx + x0;
    return q;
  };
  for (const it of B.items) { D.items[it.name] = place(it); D.order.push(it.name); }
  if (B.note) D.note = {r: off(B.note.r, x0, y0 + dy[B.note.band]), page: pOf[B.note.band]};
  if (B.head) D.fhead = off(B.head, x0, y0);
  if (pages.length > 1) {
    D.pager = pagerKeys(x0, y0 + d.pg.h - PAGE_KEY, d.iw, PAGE_KEY);
  }
  const bottomOf = (p) => y0 + B.top + pages[p].h;
  /* hits: a door owns half of each gap round it out to half the plate's pad; ENEMIES on a touch layout taps a foe's whole slot, else its points key */
  if (page === GUIDE || page === EN) {
    const gx = B.gap, gy = page === GUIDE || d.mode === "desk" ? B.gap : 0, e = PAD[d.dev][3] / 2, hg = d.by - (d.iy + d.hd.h); /* a first row's hit keeps 8 clear of the BACK key */
    for (const n of D.order) {
      const q = D.items[n], r = q.r;
      if (page === EN && !fr.touch && d.mode === "desk") { D.hit[n] = R(q.pts.x - 3, q.pts.y - 3, q.pts.w + 6, q.pts.h + 6); continue; }
      const L = Math.abs(r.x - x0) < 1e-6 ? r.x - e : r.x - gx / 2, Rt = Math.abs(r.x + r.w - (x0 + d.iw)) < 1e-6 ? r.x + r.w + e : r.x + r.w + gx / 2;
      const Tp = Math.abs(r.y - (y0 + B.top)) < 1e-6 ? r.y - Math.max(0, Math.min(gy / 2, 4, hg - 8)) : r.y - gy / 2, last = Math.abs(r.y + r.h - bottomOf(q.page)) < 1e-6;
      const Bt = last ? r.y + r.h + (D.pager ? Math.min(gy / 2, 4) : PAD[d.dev][2] / 2) : r.y + r.h + gy / 2;
      D.hit[n] = R(L, Tp, Rt - L, Bt - Tp);
    }
  }
  if (page === EN) D.tips = FOES.map((e, i) => tipGeom(D, B, i, d, {x0, w: d.iw, y0, top: B.top, h: d.pg.h}));
  const G = {page, mode: d.mode, dev: d.dev, u, W: F.W, H: F.H, t125: fr.t125, touch: fr.touch, T: D.T * u, d: D, order: D.order.slice(), plate: sc(D.plate, u), foot: sc(D.foot, u), back: sc(D.head.back, u),
    pages: pages.length, pageOf: {}, pager: D.pager ? {up: sc(D.pager.up, u), dn: sc(D.pager.dn, u)} : null, items: {}, hit: {}, tips: null};
  for (const n of D.order) { G.items[n] = sc(D.items[n].r, u); G.pageOf[n] = D.items[n].page; if (D.hit[n]) G.hit[n] = sc(D.hit[n], u); }
  if (D.tips) G.tips = D.tips.map((q) => ({r: sc(q.r, u), U: sc(q.U, u), up: q.up, cover: q.cover.slice()}));
  gm = {W: F.W, H: F.H, page, touch: fr.touch, shell: fr.shell, css: fr.css, ts: fr.ts, words: W, G: deep(G)};
  return gm.G;
}
/* the tooltip for foe i, on its own page; the first place its measured words fit: desk with columns, whole row bands of two cards toward the middle
   (an empty slot of a short row included), above the focused row unless it is its page's first; then the page's body under or over the focused row,
   full width (the pager's strip under the last row included: a one-row page); never the foe's own card. Its plaque sits inside that box by its
   ring; the pointer runs from the plaque toward the points value. */
function tipGeom(D, B, i, d, body) {
  const it = D.items[D.order[i]], Tt = TIP_T[d.dev], pad = d.mode === "compact" ? TIP_PAD.c : TIP_PAD.d, onPg = (j) => D.items[D.order[j]].page === it.page, all = D.order.map((_, j) => j);
  const fits = (U) => U.h >= B.tipH(U.w - 2 * Tt - 4 - 2 * pad).h + 2 * Tt + 5;
  const across = (U) => all.filter((j) => { const q = D.items[D.order[j]].r; return j !== i && onPg(j) && q.y < U.y + U.h - 1e-6 && q.y + q.h > U.y + 1e-6 && q.x < U.x + U.w - 1e-6 && q.x + q.w > U.x + 1e-6; });
  const cands = [];
  if (d.mode === "desk" && B.cols > 1) {
    const cols = B.cols, c = it.col, cs = cols === 3 ? (c > 0 ? [c - 1, c] : [0, 1]) : [0, 1], cw = it.r.w, x0 = it.r.x - c * (cw + B.gap);
    const ux = x0 + cs[0] * (cw + B.gap), uw = cs.length * cw + (cs.length - 1) * B.gap, rowOf = (rr) => all.filter((j) => onPg(j) && D.items[D.order[j]].ri === rr);
    const run = (dir) => {
      let U = null;
      for (let rr = it.ri + dir; rowOf(rr).length; rr += dir) {
        const r = D.items[D.order[rowOf(rr)[0]]].r, y = U ? Math.min(U.y, r.y) : r.y;
        U = R(ux, y, uw, Math.max(U ? U.y + U.h : 0, r.y + r.h) - y);
        if (fits(U)) break;
      }
      return U;
    };
    const a = run(-1), b = run(1);
    if (it.ri > 0 || !b) { if (a) cands.push({U: a, up: true}); if (b) cands.push({U: b, up: false}); }
    else { cands.push({U: b, up: false}); if (a) cands.push({U: a, up: true}); }
  }
  /* the body region grows by whole rows (to the body's edge last) until the words fit */
  const top = body.y0 + body.top, bot = body.y0 + body.h, y1 = it.r.y + it.r.h, mine = all.filter((j) => j !== i && onPg(j)).map((j) => D.items[D.order[j]].r);
  const grow = (ends, mk) => { let U = null; for (const e of ends) { U = mk(e); if (fits(U)) break; } return U || mk(ends[ends.length - 1]); };
  const below = grow([...new Set([...mine.filter((r) => r.y >= y1 - 1e-6).map((r) => r.y + r.h), bot])].sort((a, b) => a - b), (e) => R(body.x0, y1, body.w, e - y1));
  const over = grow([...new Set([...mine.filter((r) => r.y + r.h <= it.r.y + 1e-6).map((r) => r.y), top])].sort((a, b) => b - a), (e) => R(body.x0, e, body.w, it.r.y - e));
  if (below.h >= over.h) cands.push({U: below, up: false}, {U: over, up: true}); else cands.push({U: over, up: true}, {U: below, up: false});
  const pick = cands.find((q) => q.U.h > 0 && fits(q.U)) || cands.filter((q) => q.U.h > 0).sort((p, q) => q.U.h - p.U.h)[0] || {U: R(body.x0, it.r.y + it.r.h, body.w, 1), up: false};
  const U = pick.U, up = pick.up, need = B.tipH(U.w - 2 * Tt - 4 - 2 * pad), cover = across(U);
  const box = R(U.x + Tt + 2, U.y + Tt + 2, U.w - 2 * Tt - 4, Math.max(1, U.h - 2 * Tt - 5)), p = it.pts, pw = d.dev === "p" ? 16 : 18, phh = d.dev === "p" ? 10 : 14;
  const cx = Math.max(box.x + 14 + pw / 2, Math.min(box.x + box.w - 14 - pw / 2, p.x + p.w / 2));
  const ptr = up ? {x: cx, y: box.y + box.h + Tt + 3, w: pw, h: phh, dir: 1} : {x: cx, y: box.y - Tt - 2, w: pw, h: phh, dir: -1};
  return {r: box, U, up, cover, ptr, n: need.n, Tt, pad, page: it.page, hd: B.tipHd};
}
const onPlate = (G, x, y) => { const p = G.plate; return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h; };
const clampPg = (G, pg) => Math.max(0, Math.min(G.pages - 1, pg | 0));
/** The page a focused door or foe shows on (0 when nothing is focused). */
export const pageOfFocus = (G, name) => pageOfName(G.pageOf, name);
/** A tap on the GUIDE door page: the door's index, -2 on the plate (inert), -1 off it or on the BACK key. focus: the focused door's index. */
export function guideHit(x, y, F, focus = 0) {
  if (!okBox(F)) return -1;
  const G = guideGeom(F, GUIDE), pg = pageOfFocus(G, DOORS[focus | 0]);
  for (let i = 0; i < DOORS.length; i++) if (G.pageOf[DOORS[i]] === pg && inR(G.hit[DOORS[i]], x, y)) return i;
  if (G.pager) for (const [k, d] of [["up", -1], ["dn", 1]]) if (inR(G.pager[k], x, y)) { const to = clampPg(G, pg + d); return -10 - DOORS.findIndex((n) => G.pageOf[n] === to); } /* a page key: -10 - that page's first door */
  if (inR(G.back, x, y)) return -1;
  return onPlate(G, x, y) ? -2 : -1;
}
/** A tap on ENEMIES (focus: the focused foe's index, whose page shows): a foe's index (its points value; a touch layout's whole slot); a page key,
    -10 - the first foe of the page it shows; else -1 (any other tap closes an open tooltip, or backs out). */
export function enemiesHit(x, y, F, focus = 0, tip = false) {
  if (!okBox(F)) return -1;
  const G = guideGeom(F, EN), pg = pageOfFocus(G, G.order[focus | 0]);
  if (tip && G.tips && inR(G.tips[focus | 0].U, x, y)) return -1; /* a tap on the open tooltip (the slots and keys under it included) only closes it */
  for (let i = 0; i < G.order.length; i++) if (G.pageOf[G.order[i]] === pg && inR(G.hit[G.order[i]], x, y)) return i;
  if (G.pager) for (const [k, d] of [["up", -1], ["dn", 1]]) if (inR(G.pager[k], x, y)) { const to = clampPg(G, pg + d); return -10 - G.order.findIndex((n) => G.pageOf[n] === to); }
  return -1;
}
/** A tap on a read-only page (HOW TO PLAY, POWER-UPS, FLOOR) showing page pg: "up" / "down" on a page key, else -1 (backs out). */
export function readHit(x, y, F, page, pg = 0) {
  if (!okBox(F)) return -1;
  const G = guideGeom(F, page);
  if (G.pager) { if (inR(G.pager.up, x, y)) return "up"; if (inR(G.pager.dn, x, y)) return "down"; }
  return -1;
}

/* ---- plan: every part as a display list in design px; the plate layer of each page paints `rest` (ops with no page, and that page's), the frame
   paints the focused part and the tip live ---- */
const Wm = (c, f, s) => measure(c, f, s);
/* the one wrap rule: greedy by the real measure into as many lines as the string needs. The geometry gave the slot those lines with the same
   measure (or a wider estimate), so a wrapped string is never dropped and never runs out of its slot. */
function wrap(c, f, s, w) {
  const out = [];
  let line = "";
  for (const word of words(s)) { const t = line ? line + " " + word : word; if (!line || Wm(c, f, t) <= w) line = t; else { out.push(line); line = word; } }
  if (line) out.push(line);
  return out;
}
const txt = (s, x, y, px, o = {}) => ({op: "text", s, x, y, px, f: (o.face || T.label)(px), col: o.col || CONST.ink, align: o.align || "left", role: o.role || "primary", lock: o.lock, name: o.name});
function homeArt(level) { return {biome: biomeOf(level)}; }
/* the controller's cue on a phone or compact page (no foot there): label first, keycap last; a part that does not fit is dropped whole, the signpost
   first, then PAGE */
function cueOps(c, G, r) {
  const W = hints(), dv = DEV.p, f = T.label(dv.sec), many = G.pages > 1, items = [];
  if (G.page === HOW) items.push({t: "REBIND IN " + LABEL.SETTINGS + " › CONTROLS", drop: 1});
  if (many && G.page !== EN && G.page !== GUIDE) items.push({t: PAGE, caps: [W.move], drop: 2});
  if (G.page === GUIDE) items.push({t: "OPEN", caps: [W.ok]});
  if (G.page === EN) items.push({t: POINTS, caps: [W.ok]});
  items.push({t: "BACK", caps: G.page === HOW ? [W.back, W.ok] : [W.back]});
  const widthOf = (list) => list.reduce((n, it, i) => n + (i ? 12 + Wm(c, f, "·") + 12 : 0) + Wm(c, f, it.t) + (it.caps || []).reduce((a, q, j) => a + (j ? 5 : 8) + capW(c, q, {phone: true}), 0), 0);
  let list = items;
  for (const lvl of [1, 2]) if (widthOf(list) > r.w) list = list.filter((it) => it.drop !== lvl);
  const ops = [], cy = r.y + r.h / 2;
  let x = r.x;
  list.forEach((it, i) => {
    if (i) { x += 12; ops.push(txt("·", x, cy, dv.sec, {col: CONST.off, role: "secondary", lock: true})); x += Wm(c, f, "·") + 12; }
    ops.push(txt(it.t, x, cy, dv.sec, {col: CONST.t2, role: "secondary"}));
    x += Wm(c, f, it.t);
    (it.caps || []).forEach((q, j) => { x += j ? 5 : 8; const w = capW(c, q, {phone: true}); ops.push({op: "cap", s: q, x, y: cy - dv.caph / 2, w}); x += w; });
  });
  return ops;
}
function plan(c0, G, ui) {
  const c = mOf(c0), D = G.d, dv = DEV[D.dev], ts = textScale(), W = hints(), tap = tapMode(!!G.touch), ph = D.dev === "p";
  const pri = dv.pri, sec = dv.sec, bod = dv.bod, rest = [], focus = {}, tips = [], strips = {}, info = [];
  const fS = (px) => T.label(px), fB = (px) => T.body(px);
  const w = (f, s) => Wm(c, f, s);
  const on = (pg, ...ops) => { for (const o of ops) { if (pg != null) o.pg = pg; rest.push(o); } };
  rest.push({op: "plate", r: D.plate});
  /* head */
  const H = D.head;
  if (H.back) {
    rest.push({op: "key", r: H.back, kind: "key", name: "BACK"}, {op: "glyph", n: "back", x: H.back.x + 16, y: H.back.y + H.back.h / 2 - 8, s: 16, col: CONST.ink});
    info.push({name: "BACK chevron", r: R(H.back.x + 16, H.back.y + H.back.h / 2 - 8, 16, 16), col: CONST.ink});
    rest.push(txt("BACK", H.back.x + 42, H.back.y + H.back.h / 2, pri, {name: "BACK"}));
  } else if (H.kick) rest.push(txt(G.page === GUIDE ? "MENU" : GUIDE, H.kick.x, H.kick.y + H.kick.h / 2, sec, {col: CONST.t2, role: "secondary"}));
  rest.push({op: "dsp", s: G.page, x: H.title.x, y: H.title.y + H.title.h / 2, px: dv.ttl});
  if (H.hint && !H.back) rest.push(txt(D.hintS, H.hint.x + H.hint.w, H.hint.y + H.hint.h / 2, sec, {col: CONST.t2, role: "secondary", align: "right"}));
  else if (H.hint) wrap(c, fS(sec), D.hintS, H.hint.w).forEach((l, j) => rest.push(txt(l, H.hint.x, H.hint.y + sec * ts * 1.3 * (j + 0.5), sec, {col: CONST.t2, role: "secondary"})));
  if (H.cue) rest.push(...cueOps(c, G, H.cue));
  /* the kit pager (kit pager.js): PAGE n OF m, then the two page keys (label first, keycap last) */
  if (D.pager) for (let p = 0; p < D.pages; p++) {
    const Q = D.pager, k = (r) => [r.x + r.w / 2 - 10, r.y + r.h / 2 - 10];
    on(p, txt(pageLabel(p, D.pages), Q.label.x, Q.label.y + Q.label.h / 2, sec, {col: CONST.t2, role: "secondary"}),
      {op: "key", r: Q.up, kind: p > 0 ? "key" : "well", name: "page up"}, {op: "glyph", n: "up", x: k(Q.up)[0], y: k(Q.up)[1], s: 20, col: p > 0 ? CONST.ink : CONST.off},
      {op: "key", r: Q.dn, kind: p < D.pages - 1 ? "key" : "well", name: "page down"}, {op: "glyph", n: "dn", x: k(Q.dn)[0], y: k(Q.dn)[1], s: 20, col: p < D.pages - 1 ? CONST.ink : CONST.off});
  }
  const items = D.items;
  if (G.page === GUIDE) {
    const subs = subsOf(tap, ph, W), lhP = pri * ts * 1.15, lhS = sec * ts * 1.25;
    DOORS.forEach((l, i) => {
      const q = items[l], r = q.r, gs = 16, gx = r.x + r.w - 18 - gs, lx = r.x + 24, fx = r.x + 8 + dv.bombs + 8, sy = r.y + r.h - 14 - q.strip;
      const nl = wrap(c, T.label(pri), l, q.tw), sl = partsOf((x) => Wm(c, T.label(sec), x), subs[i], q.tw), ty0 = r.y + 14 + nl.length * lhP + 2;
      const label = nl.map((s2, j) => txt(s2, lx, r.y + 14 + lhP * (j + 0.5), pri, {name: l})), tz = sl.map((s2, j) => txt(s2, lx, ty0 + lhS * (j + 0.5), sec, {col: TZ, role: "secondary"})), chev = {op: "glyph", n: "chev", x: gx, y: r.y + r.h / 2 - gs / 2, s: gs, col: CONST.t2};
      const sw = gx - 10 - fx, st = stripOf(c, i, sw, q.strip, ph, tap, W);
      strips[l] = {w: Math.max(1, sw), h: q.strip, ops: st};
      on(q.page, {op: "key", r, kind: "key", name: l}, ...label.map((o) => ({...o, door: l})), ...tz.map((o) => ({...o, door: l})), chev, {op: "strip", l, x: lx, y: sy, door: l});
      focus[l] = [{op: "key", r, kind: "key", ring: true}, {op: "band", r}, {op: "bomb", x: r.x + 8, cy: r.y + r.h / 2}, ...label.map((o) => ({...o, x: fx})), ...tz.map((o) => ({...o, x: fx, col: CONST.t2})), chev, {op: "strip", l, x: fx, y: sy}];
      info.push({name: l + " chev", r: R(gx, chev.y, gs, gs), col: CONST.t2, pg: q.page});
    });
  } else if (G.page === HOW) {
    for (const [i, s] of RULES.entries()) {
      const q = items[s], r = q.r, cs = q.cs, tx = r.x + SLAB_T + 8 + cs + 12, lh = pri * ts * 1.15, ls = wrap(c, fS(pri), s, r.x + r.w - SLAB_T - 10 - tx);
      on(q.page, {op: "slab", r, name: s}, i ? {op: "wall", x: r.x + SLAB_T + 8, y: r.y + (r.h - cs) / 2, s: cs, level: 1} : {op: "foe", t: "walker", x: r.x + SLAB_T + 8, y: r.y + (r.h - cs) / 2, s: cs, level: 1});
      ls.forEach((l, j) => on(q.page, txt(l, tx, r.y + r.h / 2 + (j - (ls.length - 1) / 2) * lh, pri, {name: j ? undefined : s})));
    }
    for (const n of D.order.slice(2)) {
      const q = items[n], r = q.r, cs = Math.min(36, r.h - 12), cy = r.y + r.h / 2;
      on(q.page, {op: "lane", r});
      let x = r.x + 10;
      if (q.icon) { on(q.page, {op: "well", r: R(x, cy - cs / 2, cs, cs)}, {op: "item", t: q.icon, x, y: cy - cs / 2, s: cs}); x += cs + 12; }
      on(q.page, txt(n, x, cy, pri, {name: n}));
      const room = r.x + r.w - 10 - (x + w(fS(pri), n) + 16);
      if (!ph && !tap) {
        let keys = q.keys.filter(Boolean), ws = keys.map((k) => capW(c, k));
        while (keys.length > 1 && ws.reduce((a, b) => a + b, 0) + 6 * (keys.length - 1) > room) { keys = keys.slice(0, -1); ws = ws.slice(0, -1); }
        let cx = r.x + r.w - 10 - (ws.reduce((a, b) => a + b, 0) + 6 * (keys.length - 1));
        keys.forEach((k, j) => { on(q.page, {op: "cap", s: k, x: cx, y: cy - dv.caph / 2, w: ws[j]}); cx += ws[j] + 6; });
      } else {
        const s = q.keys.filter(Boolean).join(" / "), s2 = w(fS(sec), s) <= room ? s : q.keys[0];
        on(q.page, txt(s2, r.x + r.w - 10, cy, sec, {col: CONST.t2, role: "secondary", align: "right"}));
      }
    }
    const nt = tap ? NOTE_TAP : NOTE_KEY;
    wrap(c, fS(sec), nt, D.note.r.w).forEach((l, j) => on(D.note.page, txt(l, D.note.r.x + D.note.r.w / 2, D.note.r.y + sec * ts * 1.4 * (j + 0.5), sec, {col: CONST.t2, role: "secondary", align: "center"})));
  } else if (G.page === PU && items[POWER[0].name].tile) {
    for (const p of POWER) {
      const q = items[p.name], r = q.r, x = r.x + 8, tx = x + q.cell + 10, hs = tap && ui.narrow ? helpOf(p, NARROW_TAP) : helpOf(p, W, tap);
      const cy = r.y + 8 + q.hh / 2, nl = wrap(c, T.label(pri), p.name, q.nw), lh = pri * ts * 1.15;
      on(q.page, {op: "lane", r}, {op: "well", r: R(x, cy - q.cell / 2, q.cell, q.cell)}, {op: "item", t: p.t, x, y: cy - q.cell / 2, s: q.cell});
      nl.forEach((s, j) => on(q.page, txt(s, tx, cy + (j - (nl.length - 1) / 2) * lh, pri, {name: p.name})));
      wrap(c, fS(sec), hs, r.w - 16).forEach((s, j) => on(q.page, txt(s, x, r.y + 8 + q.hh + 6 + sec * ts * 1.25 * (j + 0.5), sec, {col: CONST.t2, role: "secondary"})));
      if (p.permanent) { on(q.page, {op: "fill", r: R(r.x + r.w - 7, r.y + 6, 3, q.hh + 4), col: CONST.ink}); info.push({name: p.name + " keeps", r: R(r.x + r.w - 8, r.y + 5, 5, q.hh + 6), col: CONST.ink, pg: q.page}); } /* the info rect pads the bar by 1, so the gate's mask takes its soft edges at any scale */
    }
  } else if (G.page === PU) {
    for (const p of POWER) {
      const q = items[p.name], r = q.r, cy = r.y + r.h / 2, x = r.x + 8, tx = x + q.cell + 12, tw = r.x + r.w - 14 - 12 - tx;
      const hs = tap && ui.narrow ? helpOf(p, NARROW_TAP) : helpOf(p, W, tap), hl = wrap(c, fB(bod), hs, tw);
      const bh = pri * ts * 1.15 + (hl.length ? 2 + hl.length * bod * ts * 1.4 : 0), top = cy - bh / 2;
      on(q.page, {op: "lane", r}, {op: "well", r: R(x, cy - q.cell / 2, q.cell, q.cell)}, {op: "item", t: p.t, x, y: cy - q.cell / 2, s: q.cell});
      on(q.page, txt(p.name, tx, top + pri * ts * 0.575, pri, {name: p.name}));
      hl.forEach((s, j) => on(q.page, txt(s, tx, top + pri * ts * 1.15 + 2 + bod * ts * 1.4 * (j + 0.5), bod, {face: fB, col: CONST.t2, role: "body"})));
      if (p.permanent) { on(q.page, {op: "fill", r: R(r.x + r.w - 7, r.y + 6, 3, r.h - 12), col: CONST.ink}); info.push({name: p.name + " keeps", r: R(r.x + r.w - 8, r.y + 5, 5, r.h - 10), col: CONST.ink, pg: q.page}); }
    }
  } else if (G.page === EN) enemies(c, G, ui, on, focus, tips, info);
  else floorPlan(c, G, on);
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
function enemies(c, G, ui, on, focus, tips, info) {
  const D = G.d, dv = DEV[D.dev], ts = textScale(), ph = D.dev === "p", desk = D.mode === "desk", pri = dv.pri, sec = dv.sec, bod = dv.bod;
  FOES.forEach((e, i) => {
    const q = D.items[e.name], r = q.r, home = firstLevel(e.rooms), v = PTS[e.t] || 100, pg = q.page;
    if (desk) on(pg, {op: "slab", r, name: e.name});
    else on(pg, {op: "lane", r, alt: i % 2 === 1});
    on(pg, {op: "foe", t: e.t, x: q.cell.x, y: q.cell.y, s: q.cell.w, level: home, floor: true}, txt(e.name, q.tx, q.nameY, pri, {name: e.name}));
    const pts = digitsOps(q, v, ph, dv);
    on(pg, ...pts.rest);
    focus[i] = pts.focus;
    if (desk) {
      wrap(c, T.body(bod), helpOfFoe(e), q.tw).forEach((s, j) => on(pg, txt(s, q.tx, q.helpY + bod * ts * 1.4 * (j + 0.5), bod, {face: T.body, col: CONST.t2, role: "body"})));
      wrap(c, T.label(sec), q.ap, q.tw).forEach((s, j) => on(pg, txt(s, q.tx, q.appY + sec * ts * 1.25 * (j + 0.5), sec, {col: CONST.t2, role: "secondary"})));
      for (let n = 1; n <= 8; n++) on(pg, {op: "pip", r: R(q.pips.x + (n - 1) * 7, q.pips.y, 5, 12), on: inRooms(e.rooms, n)});
      info.push({name: e.name + " levels", r: q.pips, col: worldTokens(ui.level).lit, pg});
    } else {
      on(pg, txt(levelsOf(e.rooms), q.tx, q.levY, sec, {col: CONST.t2, role: "secondary"}));
      if (q.helpY != null) wrap(c, T.body(bod), helpOfFoe(e), q.tw).forEach((s, j) => on(pg, txt(s, q.tx, q.helpY + bod * ts * 1.4 * (j + 0.5), bod, {face: T.body, col: CONST.t2, role: "body"})));
    }
    const tg = D.tips[i], tp = tg.pad, tw = tg.r.w - 2 * tp, lines = wrap(c, T.body(bod), tipText(e.name), tw);
    const th = tg.hd.th, ty = tg.r.y + tg.hd.top, top = [{op: "tipPlate", r: tg.r, U: tg.U, Tt: tg.Tt}, {op: "wedge", ...tg.ptr}, txt(POINTS, tg.r.x + tp, ty + th / 2, pri, {name: "tip"})];
    if (tg.hd.dig) top.push({op: "digits", v, r: R(tg.r.x + tg.r.w - tp - (ph ? 67 : 85), ty, ph ? 67 : 85, ph ? 28 : 36), ph});
    lines.forEach((s, j) => top.push(txt(s, tg.r.x + tp, ty + th + 6 + bod * ts * 1.4 * (j + 0.5), bod, {face: T.body, col: CONST.t2, role: "body"})));
    tips[i] = top;
  });
}
/* a points value at rest (digits + PTS where the geometry puts them) and focused (the band, the bare bomb at its start, the digits past it, the ring) */
function digitsOps(q, v, ph, dv) {
  const sec = dv.sec, ts = textScale(), word = (d) => (ph && !q.side ? txt(PTS_W, d.x + d.w / 2, d.y + d.h + 3 + sec * ts * 0.6, sec, {col: CONST.t2, role: "secondary", align: "center"}) : txt(PTS_W, d.x + d.w + 6, d.y + d.h / 2, sec, {col: CONST.t2, role: "secondary"}));
  const p = q.pts;
  return {rest: [{op: "digits", v, r: q.dig, ph}, word(q.dig)], focus: [{op: "band", r: p}, {op: "bomb", x: p.x + 8, cy: p.y + p.h / 2}, {op: "digits", v, r: q.digF, ph}, word(q.digF), {op: "ring", r: p}]};
}
function floorPlan(c, G, on) {
  const D = G.d, dv = DEV[D.dev], ts = textScale(), f0 = D.items[D.order[0]], desk = !!f0.wide, pri = dv.pri, sec = dv.sec, lhP = pri * ts * 1.15, lhS = sec * ts * 1.25;
  const head = (s, x, y, align) => txt(s, x, y, sec, {col: CONST.t2, role: "secondary", align});
  if (desk) DIFF.forEach((s, j) => on(null, head(s, f0.r.x + 16 + j * (f0.s + f0.cg) + f0.s / 2, D.fhead.y + D.fhead.h / 2, "center")));
  else on(null, head(DIFF.join(" · "), D.fhead.x, D.fhead.y + D.fhead.h / 2));
  for (const n of D.order) {
    const q = D.items[n], r = q.r, pg = q.page;
    on(pg, {op: "lane", r});
    const cy = desk ? r.y + r.h / 2 : r.y + 5 + q.s / 2;
    for (let j = 0; j < 3; j++) on(pg, {op: "tile", k: q.k, room: q.room, heat: j, x: r.x + (desk ? 16 : 8) + j * (q.s + q.cg), y: cy - q.s / 2, s: q.s});
    const tx = desk ? r.x + 16 + q.cellsW + 16 : r.x + 8 + q.cellsW + 10, nw = Wm(c, T.label(pri), q.name);
    const top = desk ? r.y + (r.h - (lhP + (q.inl ? 0 : lhS) + q.nl * lhS)) / 2 : r.y + 5;
    on(pg, txt(q.name, tx, top + lhP / 2, pri, {name: q.name}));
    if (q.inl) on(pg, head(q.lvl, tx + nw + 12, top + lhP / 2)); else on(pg, head(q.lvl, tx, top + lhP + lhS / 2));
    let y = desk ? top + lhP + (q.inl ? 0 : lhS) : r.y + 5 + Math.max(q.s, lhP + (q.inl ? 0 : lhS)) + 4;
    const lx = desk ? tx : r.x + 8, lw = q.tw;
    if (q.side) { on(pg, head(q.lines[0], lx, y + lhS / 2), head(q.lines[1], lx + Wm(c, T.label(sec), q.lines[0]) + 24, y + lhS / 2)); continue; }
    for (const s of q.lines) for (const l of wrap(c, T.label(sec), s, lw)) { on(pg, head(l, lx, y + lhS / 2)); y += lhS; }
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
const onPage = (o, pg) => o.pg == null || o.pg === pg;
function record(G, P, ui, foc, dpr, el, pg) {
  const u = G.u, D = G.d, b = (r) => [r.x * u, r.y * u, r.w * u, r.h * u], tok = worldTokens(ui.level), ts = textScale();
  probe.begin(SHOT[G.page], {w: G.W, h: G.H, dpr, el});
  probe.rect("plate", ...b(D.plate), {plate: G.T, fill: tok.bedA});
  const tg = G.page === EN && ui.tip && foc != null && D.tips ? D.tips[foc] : null, hidden = tg ? [...tg.cover.map((j) => D.items[D.order[j]].r), tg.r] : []; // the tooltip plate covers the pager strip too
  const under = (x, y, w2, h2) => hidden.some((r) => x < r.x + r.w && x + w2 > r.x && y < r.y + r.h && y + h2 > r.y);
  const text = (p, dx = 0, dy = 0) => {
    const px = p.px * ts, capH = px * CAP_K, wd = Math.max(0.01, p.mw || 1), x0 = (p.align === "right" ? p.x - wd : p.align === "center" ? p.x - wd / 2 : p.x) + dx, y0 = p.y + dy - capH / 2;
    if (under(x0, y0, wd, capH)) return;
    probe.text(p.s, x0 * u, y0 * u, wd * u, capH * u, {role: p.role, col: p.col, px: p.px * ts * u, ...(p.lock ? {lock: true} : {})});
  };
  const all = (ops, dx = 0, dy = 0) => { for (const p of ops) if (p.door && p.door === ui.focus) continue; else if (p.op === "text") text(p, dx, dy); else if (p.op === "dsp") text({...p, f: T.display(p.px), role: "primary", col: CONST.ink, align: "left", mw: p.mw}, dx, dy); else if (p.op === "strip") all(P.strips[p.l].ops, p.x + dx, p.y + dy); };
  if (D.head.back) probe.rect("BACK", ...b(D.head.back), {touch: !!G.touch, set: "back"});
  if (D.pager) for (const k of ["up", "dn"]) probe.rect("page " + k, ...b(D.pager[k]), {touch: !!G.touch, set: "pager", kind: "step"});
  for (const n of G.order) {
    const q = D.items[n];
    if (q.page !== pg) continue;
    if (G.page === GUIDE) probe.rect(n, ...b(q.r), {touch: !!G.touch, set: "doors", kind: "list", focus: n === ui.focus, fill: n === ui.focus ? tok.band : tok.key});
    else if (G.page === EN) { const i = G.order.indexOf(n), r = G.touch ? D.hit[n] : q.pts; if (!under(r.x, r.y, r.w, r.h) || i === foc) probe.rect(n, ...b(r), {touch: !!G.touch, set: "foes", kind: "list", focus: i === foc, fill: i === foc ? tok.band : tok.key}); }
  }
  all(P.rest.filter((o) => onPage(o, pg)));
  if (G.page === GUIDE && ui.focus && P.focus[ui.focus]) all(P.focus[ui.focus].filter((p) => p.op === "text" || p.op === "strip"));
  if (tg) { probe.rect("tip", ...b(tg.r), {plate: tg.Tt * u}); for (const p of P.tips[foc]) if (p.op === "text") { const px = p.px * ts, capH = px * CAP_K; probe.text(p.s, (p.align === "right" ? p.x - p.mw : p.x) * u, (p.y - capH / 2) * u, Math.max(0.01, p.mw) * u, capH * u, {role: p.role, col: p.col, px: p.px * ts * u}); } }
  for (const m of P.info) if (onPage(m, pg) && !under(m.r.x, m.r.y, m.r.w, m.r.h)) { const pad = m.pad || 6; probe.pair("info", b(m.r), b(R(m.r.x - pad, m.r.y - pad, m.r.w + 2 * pad, m.r.h + 2 * pad)), {col: m.col, name: m.name}); }
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
    if (!mv && G.pages > 1) items.push({t: PAGE, caps: pad ? [W.move] : [["up"], ["dn"]]});
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
  plaque(c, P.x, P.y, P.w, P.h, tok);
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
  S.rd = canMake() ? roomDpr(S.c, F, {rev: S.ui.rev}, dpr) : 1; // the room's dpr: MENU's own rule (kit room.js roomDpr), so MENU and GUIDE share one room layer; with no canvas source there is no room layer to size
  S.roomK = keyOf({layer: "room", biome: tok.name, level, W: F.W, H: F.H, dpr: S.rd, look: "2d", textScale: 1});
  const roomB = Math.round(F.W * S.rd) * Math.round(F.H * S.rd) * 4, area = ob.w * u * ob.h * u;
  const tipA = D.tips ? Math.max(...D.tips.map((q) => (q.r.w + 2 * q.Tt + 4) * (q.r.h + 2 * q.Tt + 12))) * u * u * 2 : 0, footA = D.foot ? (D.plate.w + 4) * (FOOT_H + 8) * u * u : 0;
  const pd = +Math.max(0.5, Math.min(dpr, Math.sqrt(Math.max(0, BUDGET - 1024 * 1024 - roomB) / (4 * (area * D.pages + tipA + footA + 4 * 400 * 40 * u * u))))).toFixed(3);
  S.pd = pd; S.ob = ob; S.pb = sc(ob, u);
  const id = [G.page, G.mode, +u.toFixed(6), JSON.stringify(D.plate), S.A ? "px" : "2d", JSON.stringify(hints()), S.tap, S.ui.narrow ? 1 : 0].join("|");
  S.plateKeys = Array.from({length: D.pages}, (_, p) => ({...K, dpr: pd, layer: "guide.plate|" + id + "|" + p}));
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
    S = {G, w: words, touch: touchy, dpr, ts, c, tap, A, ui: {...ui}, P, plates: [], foot: null, strips: {}, tipL: {}, dig: {}};
    sizes(S, G, F, level, tok, A ? "px" : "2d");
    _dbg.plans++;
  }
  const P = S.P, foc = page === GUIDE ? (DOORS.includes(ui.focus) ? ui.focus : null) : page === EN && ui.focus != null && ui.focus >= 0 && ui.focus < FOES.length && (!tap || ui.tip) ? ui.focus | 0 : null;
  const tipOn = page === EN && foc != null && !!ui.tip, o = {ph, A, strips: P.strips, time: 0.4};
  /* the page on screen: the focused door's or foe's (a foe in tap mode keeps its page with no focus shown), a read-only page's ui.pg */
  const pg = page === GUIDE ? pageOfFocus(G, foc || DOORS[0]) : page === EN ? pageOfFocus(G, G.order[ui.focus | 0]) : clampPg(G, ui.pg);
  _dbg.last = {G, P, foc, tipOn, S, pg};
  if (typeof c.clip !== "function" || typeof c.rect !== "function") return;
  if (canMake()) {
    const room = (S.room && S.room.width) ? (hold(S.roomK), S.room) : (S.room = roomLayer({w: F.W, h: F.H}, level, tok, {dpr: S.rd, look: "2d", textScale: 1}));
    for (const [l, st] of Object.entries(P.strips)) {
      const k = S.stripKeys[l];
      if (!S.strips[l] || !S.strips[l].width) S.strips[l] = layer(k, Math.max(1, Math.round(st.w * u * S.pd)), Math.max(1, Math.round(st.h * u * S.pd)), (g) => { g.scale(S.pd * u, S.pd * u); paintOps(g, st.ops, tok, {...o, blit: null}); });
      else hold(k);
    }
    for (let p = 0; p < G.d.pages; p++) {
      if (!S.plates[p] || !S.plates[p].width) S.plates[p] = layer(S.plateKeys[p], S.pw, S.ph, (g) => { g.scale(S.pd * u, S.pd * u); g.translate(-S.ob.x, -S.ob.y); paintOps(g, P.rest.filter((x) => onPage(x, p)), tok, {...o, blit: S.strips}); });
      else hold(S.plateKeys[p]);
    }
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
    c.save(); c.imageSmoothingEnabled = true; c.drawImage(room, 0, 0, F.W, F.H); c.drawImage(S.plates[pg], S.pb.x, S.pb.y, S.pb.w, S.pb.h);
    if (P.foot) c.drawImage(S.foot, S.footB.x, S.footB.y, S.footB.w, S.footB.h);
    c.restore();
  } else {
    c.save(); c.fillStyle = toL(tok.bg1, 0.004); c.fillRect(0, 0, F.W, F.H); c.scale(u, u);
    paintOps(c, P.rest.filter((x) => onPage(x, pg)), tok, o);
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
  if (probe.probe.on) record(G, P, {...ui, level, focus: page === GUIDE ? foc : ui.focus}, foc, dpr, F.shell ? "sh" : "c", pg);
}
