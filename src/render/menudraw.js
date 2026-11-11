/* MENU DRAWING LAYER — all menu/intro pixels as pure functions over a
   normalized layout valid at both 600x520 (2D) and 608x352 (3D). Reads only
   its args; never touches world/app state. Palette locked (spec §0/§2):
   accent #37f0d0, text #dfe7f5, muted #7385ad, veils rgba(7,10,18,a).
   Easing helpers duplicated from the intro beat table (spec §3) — this file
   must not import from src/app. */
import { CFG, BIOMES } from "../core/config.js";
import { POWER, FOES, helpOf } from "../core/entities.js";
import { HEAT_COL, HEAT_MARK, clampHeat } from "../core/heat.js";
import { pactLabel } from "../core/pact.js";
import { DIFF, TIME_TRIAL, LABEL, RECORD_TABS, diffTag, speedTag, runParts, levelsOf } from "./words.js";
import { drawEnemyBody } from "./sprites.js";
import { drawItemBody } from "./itemdraw.js";
import { HOME, TILE_HELP, TILE_NAME } from "../core/feat.js";
import { drawSpec } from "./featdraw.js";
import { rr } from "./icons.js";
import { pixelArt, itemCell, foeCell, pageScale, blitAnim, blitCell, foeAnim, itemAnim, seedOf as pxSeed, SLOT_PAD } from "./hudart.js";
import { foeM, blinkAt } from "./motion.js";
import { hints, tapMode } from "./hintcopy.js";
import { drawLogo2d, deviceScale, TITLE_RUNUP } from "./logo/draw2d.js";
import * as menuPage from "./pages/menu.js";
import * as levelPage from "./pages/level.js";
import { rosterOf } from "./pages/card.js";
import * as lazy from "./pages/lazy.js";
import { worldTokens, CONST, toL } from "./kit/tokens.js";
import { plate as kitPlate } from "./kit/paint.js";
import { dsp as kitDsp, lbl as kitLbl } from "./kit/type.js";
import { canMake, capDpr, BUDGET } from "./kit/cache.js";
import { roomLayer } from "./kit/room.js";
const ACCENT = "#37f0d0",
  TEXT = "#dfe7f5",
  MUTED = "#7385ad";
const MONO = "ui-monospace,monospace";
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t) => t * t * t;
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutBack = (t) => {
  const c1 = 1.70158,
    c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
/* Local copies of src/app/intro.js beats (pinned equal in menudraw.test). */
export const SHOW_STEP = 0.137,
  SKIP_GUARD = 0.2,
  TITLE_IN = 0.9;
const font = (size, weight) => (weight || "") + " " + size + "px " + MONO;
/* CONSOLE PANEL (direction A): labels and titles in the system sans stack (no
   font file; disclosed: system-ui varies by OS), values / tags / foot stay
   mono. One plate, one border, one selection idiom (paintRow) everywhere. */
const SANS = "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
const sans = (size, weight) => (weight || "") + " " + size + "px " + SANS;
const DANGER = "#ff5d73";
const LINE = "#26324a",
  EDGE = "#2a3550",
  WARM = "#ffd447";
export const PLATE = "rgba(10,14,24,0.94)";
export const VIB_LEVELS = Object.freeze(["OFF", "LOW", "MEDIUM", "HIGH"]);
/** The OPTIONS door's VIBRATION word: a pad that is here, can buzz and has a stored level; "" otherwise. Boot-side, so the door never waits on the lazy CONTROLS paint. */
export const vibWord = (s) => (s && s.pad && s.pad.state !== "none" && s.pad.state !== "lost" && s.pad.rumble === true && s.vib != null ? VIB_LEVELS[s.vib] || "" : "");
const even = (v) => 2 * Math.round(v / 2); // even logical px: crisp at x0.5 / x1 / x1.5 and on PIXEL's 2px art grid
export function plate(c, x, y, w, h) {
  x = even(x);
  y = even(y);
  w = even(w);
  h = even(h);
  c.fillStyle = "rgba(0,0,0,0.35)";
  rr(c, x, y + 4, w, h, 6);
  c.fill();
  c.fillStyle = PLATE;
  rr(c, x, y, w, h, 6);
  c.fill();
  c.strokeStyle = EDGE;
  c.lineWidth = 1;
  rr(c, x + 0.5, y + 0.5, w - 1, h - 1, 6);
  c.stroke();
}
function well(c, x, y, s, col) {
  c.fillStyle = "rgba(4,7,14,0.95)";
  c.fillRect(x - s / 2, y - s / 2, s, s);
  if (col) {
    c.fillStyle = col;
    c.globalAlpha = 0.14;
    c.fillRect(x - s / 2 + 2, y - s / 2 + 2, s - 4, s - 4);
    c.globalAlpha = 1;
  }
  c.strokeStyle = col || LINE;
  c.lineWidth = 1.5;
  c.strokeRect(x - s / 2 + 0.5, y - s / 2 + 0.5, s - 1, s - 1);
}
const spaced = (c, on) => {
  if ("letterSpacing" in c) c.letterSpacing = on ? "0.12em" : "0px";
};
export function head(c, S, title, kicker) {
  c.textAlign = "center";
  c.textBaseline = "middle";
  if (kicker) {
    c.fillStyle = MUTED;
    c.font = sans(10, "600");
    spaced(c, true);
    c.fillText(kicker, S.mid, S.headY - 9);
    spaced(c, false);
  }
  if (!title) return; // RECORDS' pages: the tab strip stands on the title's line
  c.fillStyle = TEXT;
  c.font = sans(18, "700");
  c.fillText(title, S.mid, S.headY + 8);
}
/* The kicker's first candidate that fits room (head's own type), else the last: PAUSE's look tail (v202). */
export function fitKicker(c, cands, room) {
  c.font = sans(10, "600");
  spaced(c, true);
  let s = cands[cands.length - 1];
  for (const t of cands) if (mw(c, t) <= room) { s = t; break; }
  spaced(c, false);
  return s;
}
export function foot(c, S, s, col) {
  c.fillStyle = col || MUTED;
  c.font = font(10);
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(s, S.mid, S.footY);
}
function caret(c, x, y, h, col) {
  const hh = Math.max(5, Math.min(7, h * 0.22));
  c.fillStyle = col || ACCENT;
  c.beginPath();
  c.moveTo(x, y - hh);
  c.lineTo(x + hh * 1.1, y);
  c.lineTo(x, y + hh);
  c.closePath();
  c.fill();
}
/* THE row: every list in the shell (MENU, PAUSE, OPTIONS, GRAPHICS, GUIDE)
   paints its rows here, so the selected row is the same object on every
   page. o = {hero, danger, warm, caret, door, ext, touch, vc, glow}. Selection = a
   full-width 0.12 band, a 3px notch and the caret; label weight and size never
   jitter. danger rows (RESTART / QUIT) select in red, keeping the shape. warm
   (a CONTROLS row a swap just moved) is the same band and notch in gold, and has
   a caret only with o.caret: the row is marked, the cursor may be elsewhere. */
const rowSize = (h, p) => Math.max(10, Math.min(p.hero ? (p.touch ? 22 : 20) : p.touch ? 17 : 15, Math.round(h * (p.hero ? 0.5 : 0.62))));
export function paintRow(c, x, y, w, h, label, val, sel, o) {
  const p = o || {},
    col = p.warm ? WARM : p.danger ? DANGER : ACCENT,
    cy = y + h / 2;
  if (sel) {
    c.fillStyle = p.warm ? "rgba(255,212,71,0.12)" : p.danger ? "rgba(255,93,115,0.12)" : "rgba(55,240,208,0.12)";
    c.fillRect(x, y, w, h);
    c.fillStyle = col;
    c.fillRect(x, y, 3, h);
    if (!p.warm || p.caret) caret(c, x + 11, cy, h, col);
  }
  const size = rowSize(h, p);
  c.textBaseline = "middle";
  c.textAlign = "left";
  c.font = sans(size, p.hero ? "800" : "600");
  c.fillStyle = sel ? TEXT : MUTED;
  c.fillText(label, x + 26, cy);
  const mark = p.ext ? "↗" : p.door ? "›" : "",
    v = val ? String(val) : "";
  c.textAlign = "right";
  if (mark) {
    c.font = sans(p.ext ? 14 : 18, "600");
    c.fillStyle = sel ? TEXT : MUTED;
    c.fillText(mark, x + w - 12, cy);
  }
  if (v) {
    const vx = x + w - 12 - (mark ? 18 : 0);
    c.font = font(12);
    c.fillStyle = p.vc || (sel ? TEXT : MUTED);
    if (p.glow > 0) {
      c.shadowColor = c.fillStyle;
      c.shadowBlur = 14 * p.glow;
    }
    c.fillText(v, vx, cy);
    if (p.glow > 0) c.shadowBlur = 0;
  }
}
/* Pure list geometry. rows=[{hero,gapBefore}] (label etc. ignored); o =
   {top, bot, w, pitch, hero, gap, pad, head, foot, body}. Pitches are CAPS: a band
   too short for them scales pitch / hero / gap down together. body is a floor
   for the rows' own height (MENU: its pane keeps its room); the rows stay at the
   top and the floor's rest is plate under the last one. Hit bands are
   contiguous: each row owns half of any group gap beside it. */
export function listGeom(L, rows, o) {
  const p = o || {},
    n = rows.length,
    pad = p.pad == null ? 10 : p.pad,
    hd = p.head | 0,
    ft = p.foot | 0;
  let sum = 0,
    gaps = 0;
  for (let i = 0; i < n; i++) {
    sum += rows[i].hero ? p.hero || p.pitch : p.pitch;
    if (i && rows[i].gapBefore) gaps += p.gap | 0;
  }
  const body = Math.max(sum + gaps, p.body || 0);
  const room = p.bot - p.top - pad * 2 - hd - ft;
  const f = body > 0 ? Math.min(1, room / body) : 1;
  const h = Math.round(pad * 2 + hd + ft + body * f);
  const w = Math.min(L.cx * 2 - 40, p.w || 380);
  const x = p.x != null ? p.x : Math.round(L.cx - w / 2),
    y = Math.round(p.top + Math.max(0, (p.bot - p.top - h) / 2));
  const out = [];
  let yy = y + pad + hd;
  for (let i = 0; i < n; i++) {
    if (i && rows[i].gapBefore) yy += (p.gap | 0) * f;
    const rh = (rows[i].hero ? p.hero || p.pitch : p.pitch) * f;
    out.push({ y0: yy, y1: yy + rh, h: rh, cy: yy + rh / 2 });
    yy += rh;
  }
  for (let i = 0; i < n; i++) {
    out[i].a = i ? (out[i - 1].y1 + out[i].y0) / 2 : out[i].y0;
    out[i].b = i < n - 1 ? (out[i].y1 + out[i + 1].y0) / 2 : out[i].y1;
  }
  return { x, y, w, h, f, pad, rows: out, mid: x + w / 2, headY: y + 26, footY: y + h - 16, ix: x + 16, iw: w - 32, span: p.pitch * f };
}
export function listHit(x, y, g, full) {
  if (!full && (x < g.x || x > g.x + g.w)) return -1;
  const r = g.rows;
  for (let i = 0; i < r.length; i++) if (y >= r[i].a && (y < r[i].b || (i === r.length - 1 && y <= r[i].b))) return i;
  return -1;
}
/* drawList: the plate's rows only (plate / head / foot are the caller's).
   o.et (MENU only) staggers the entrance; PAUSE passes none and stays still. */
export function drawList(c, g, rows, cur, t, o) {
  const p = o || {},
    et = typeof p.et === "number" ? p.et : null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i],
      G = g.rows[i],
      k = et == null ? 1 : easeOutCubic(clamp01((et - i * 0.03) / 0.22));
    c.globalAlpha = k * (p.alpha == null ? 1 : p.alpha);
    paintRow(c, g.x + 8, G.y0 + 2 + 6 * (1 - k), g.w - 16, G.h - 4, r.label, r.val, i === cur, { ...r, touch: p.touch });
  }
  c.globalAlpha = 1;
}

/* ATLAS (r2 direction B): plates HUG their content, centred in bandOf —
   keyboard L.top-10..L.footY-8, touch 8..H-8 (the foot hint lives inside the
   plate). Pitches are caps: f < 1 only in a short box (the iso 608x352
   guard), never at 600x520. pageBox is the one page measure; o.bottom pins a
   plate to the band floor (STATS keeps its foot tap band where statsHit
   expects it). */
const PAD = 10, HEAD = 44, FOOT = 24, CHROME = PAD * 2 + HEAD + FOOT;
export const bandOf = (L, touch) => (touch ? { top: 8, bot: L.footY + 12 } : { top: Math.max(12, L.top - 10), bot: L.footY - 8 });
export function pageBox(L, maxW, body, touch, o) {
  const p = o || {},
    B = bandOf(L, touch),
    f = body > 0 ? Math.min(1, (B.bot - B.top - CHROME) / body) : 1,
    h = Math.round(CHROME + body * f),
    w = Math.min(L.cx * 2 - 40, maxW),
    x = Math.round(L.cx - w / 2),
    y = Math.round(p.bottom ? B.bot - h : B.top + Math.max(0, (B.bot - B.top - h) / 2));
  return { x, y, w, h, f, ix: x + 16, iw: w - 32, mid: x + w / 2, headY: y + 26, footY: y + h - 16, by: y + PAD + HEAD };
}
const boxPlate = (c, S) => plate(c, S.x, S.y, S.w, S.h);
const inR = (r, x, y, p) => x >= r.x - p && x <= r.x + r.w + p && y >= r.y - p && y <= r.y + r.h + p;
const mw = (c, s) => {
  const m = c.measureText && c.measureText(s);
  return m && typeof m.width === "number" ? m.width : String(s).length * 6;
};
export { ACCENT, TEXT, MUTED, DANGER, LINE, EDGE, WARM, font, sans, spaced, lockGlyph, mw, clip, wrap, cell, segs, paneHead, paneLine };
function clip(c, s, w) {
  s = String(s);
  if (mw(c, s) <= w) return s;
  let t = s;
  while (t.length > 1 && mw(c, t + "…") > w) t = t.slice(0, -1);
  return t + "…";
}
/* measureText wrap to n lines (the last one clipped), so no catalogue line
   can run past its cell (C8: WALKER's ENEMIES help overflowed). */
function wrap(c, s, w, n) {
  const out = [];
  let cur = "";
  for (const wd of String(s).split(" ")) {
    const t = cur ? cur + " " + wd : wd;
    if (!cur || mw(c, t) <= w) cur = t;
    else {
      out.push(cur);
      cur = wd;
    }
  }
  if (cur) out.push(cur);
  if (out.length > n) {
    out.length = n;
    out[n - 1] += " …";
  }
  return out.map((l) => clip(c, l, w));
}
function cell(c, r, a) {
  c.fillStyle = "rgba(4,7,14," + (a == null ? 0.72 : a) + ")";
  c.fillRect(r.x, r.y, r.w, r.h);
  c.strokeStyle = LINE;
  c.lineWidth = 1;
  c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
}
/* A tile's selection is paintRow's: the 0.12 band, the 3px notch, the caret. */
function selBand(c, r, col) {
  c.fillStyle = col === DANGER ? "rgba(255,93,115,0.12)" : "rgba(55,240,208,0.12)";
  c.fillRect(r.x, r.y, r.w, r.h);
  c.fillStyle = col || ACCENT;
  c.fillRect(r.x, r.y, 3, r.h);
}
function lockGlyph(c, x, y, s, col) {
  c.strokeStyle = col;
  c.fillStyle = col;
  c.lineWidth = Math.max(1.5, s / 7);
  const k = Math.max(1.5, s / 7);
  c.fillRect(x - s * 0.26, y - s * 0.4, k, s * 0.3);
  c.fillRect(x + s * 0.26 - k, y - s * 0.4, k, s * 0.3);
  c.fillRect(x - s * 0.26, y - s * 0.4, s * 0.52, k);
  c.fillRect(x - s * 0.38, y - s * 0.12, s * 0.76, s * 0.55);
}
const DUMMY = { type: "walker", color: "#8affc1", r: 14, home: { x: 0, y: 0 }, invuln: false };
const FOE_OF = Object.fromEntries(FOES.map((f) => [f.t, f]));
const GX = { a: 1, gl: 0, fl: 0, bl: null };
const GW = { time: 0 };
const seedOf = (k) => {
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0;
  return (h & 255) * 9;
};
function foeAt(c, A, t, cx, cy, s, time, ps) {
  const f = FOE_OF[t] || FOES[0];
  if (A) return blitAnim(c, foeAnim(A, f.t, time, { idleW: foeM(f.t).idleW, blink: blinkAt(f.t, pxSeed(f.t), time || 0) > 0.5 }), cx, cy, ps || (s >= 36 ? 2 : 1));
  DUMMY.type = f.t;
  DUMMY.color = f.col;
  DUMMY.home.x = seedOf(f.t);
  DUMMY.home.y = seedOf(f.t + "y");
  GW.time = time;
  c.save();
  c.translate(cx, cy);
  c.scale(s / 30, s / 30);
  drawEnemyBody(c, GW, DUMMY, GX);
  c.restore();
}
const ITEM = { t: "", col: "#fff", x: 0, y: 0 };
function itemAt(c, A, p, cx, cy, s, time, ps) {
  if (A) return blitAnim(c, itemAnim(A, p.t, time), cx, cy, ps || (s >= 36 ? 2 : 1));
  ITEM.t = p.t;
  ITEM.col = p.col;
  ITEM.x = seedOf(p.t);
  ITEM.y = seedOf(p.t + "y");
  GW.time = time;
  c.save();
  c.translate(cx, cy);
  const k = (s * 1.43) / CFG.TILE;
  c.scale(k, k);
  drawItemBody(c, GW, ITEM, 1, null);
  c.restore();
}
/* heatRoster deduped to [{t, n}] in first-seen order: the next-run card's (pages/card.js), the one roster. */
export { rosterOf };
/* A run's setup for one value slot, longest first (fitVal / fitIn keep the
   first that fits): every setting named; the modifiers as a count; only what
   differs from a default run (the approved PLAY tag); the same with EXPERT
   bare; the same without the world, which the MENU pane beside the list
   already names. The words and the non-default filter are words.js runParts. */
export function setupVals(world, run) {
  const j = (a) => [world].concat(a).join(" · "), terse = runParts(run, { count: true, terse: true });
  return [j(runParts(run, { all: true })), j(runParts(run, { all: true, count: true })), j(runParts(run, { count: true })), j(terse), terse.join(" · ") || world];
}
/* Segmented control: one outer frame, abutting segments, the selected one
   banded and stroked in its colour. */
function segs(c, rs, labels, on, cols, touch, fs) {
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i],
      s = i === on,
      col = (cols && cols[i]) || ACCENT;
    c.fillStyle = s ? (col === DANGER ? "rgba(255,93,115,0.12)" : "rgba(55,240,208,0.12)") : "rgba(4,7,14,0.6)";
    c.fillRect(r.x, r.y, r.w, r.h);
    c.strokeStyle = s ? col : LINE;
    c.lineWidth = s ? 2 : 1;
    c.strokeRect(r.x + (s ? 1 : 0.5), r.y + (s ? 1 : 0.5), r.w - (s ? 2 : 1), r.h - (s ? 2 : 1));
    c.fillStyle = s ? col : MUTED;
    c.font = font(fs || (touch ? 14 : 11), s ? "900" : "700");
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(labels[i], r.x + r.w / 2, r.y + r.h / 2 + 1);
  }
}
/* The largest size from px down to min whose s fits w (the font is left set);
   a word that outgrows its old slot keeps its whole spelling, smaller. */
function fitFont(c, s, w, px, min, weight, f) {
  const mk = f || font;
  let k = px;
  for (c.font = mk(k, weight); k > min && mw(c, s) > w; ) c.font = mk(--k, weight);
  return c.font;
}

/* lg: the shell box's logo line (fit.js shellGeo, the board's own 0.27 in #sh
   units, on every layout that has a shell box); tall marks a box over 1.3x as
   tall as wide (a portrait phone's #sh or a tall window: the touch MENU hub
   then hangs under the logo instead of centring in the band, STATS centres
   instead of pinning to the floor) and narrow any box under 560 wide
   (pages re-flow: LEVEL SELECT stacks its card under the grid, MEDALS goes to
   one column). Neither ever holds at 600x520 or 608x352. */
export function layout(W, H, lg, css) {
  return Object.freeze({
    W,
    H,
    shell: typeof lg === "number", // dims hands lg only for #sh's shell box
    css: css > 0 ? css : 1, // CSS px per box unit on a touch layout (the MENU's touch floors and its phone column and compact tiles are in CSS px)
    cx: W / 2,
    tall: H > W * 1.3,
    narrow: W < 560,
    top: H * 0.16,
    logoCy: typeof lg === "number" ? lg : H * 0.27,
    logoScale: Math.max(0.72, Math.min(1.0, (H / 520) * 1.0)),
    itemsY: H * 0.45,
    itemH: Math.max(24, Math.min(34, Math.round(H * 0.062))),
    footY: H - 20,
    chipW: 44,
    chipGap: 14,
    tableY: H * 0.42,
    rowH: H * 0.055,
  });
}

/* The title's logo box (logo B on the kit plate, logo/draw2d.js): the board
   canvas inside a 12 px margin, above the prompt's backing by 10 px, centred
   on the old wordmark's line (logoCy - 35.5 x logoScale); the stacked build on
   touch portrait, the line build elsewhere. It keeps its last answer, so a
   steady frame allocates no box. MENU's logo is the page header's (pages/menu.js). */
let tlb = null;
export function titleLogoBox(W, H, lay) {
  if (tlb && tlb.W === W && tlb.H === H && tlb.lay === lay) return tlb.v;
  const L = layout(W, H),
    px = lay === "p" || lay === "l" ? 26 : 18,
    m = 12;
  tlb = { W, H, lay, v: Object.freeze({ box: Object.freeze({ x: m, y: m, w: W - 2 * m, h: L.footY - (px + 12) / 2 - 10 - m }), cy: L.logoCy - 35.5 * L.logoScale, dev: lay === "p" ? "p" : "d" }) };
  return tlb.v;
}
/* INTRO chrome (opening spec §3/§7). Title (stage 0): logo reveal (fade +
   slide 0.9 s, a 0.92 -> 1 pop over 0.45 s: the old GRID letters' pop, on
   the whole logo) then a +-2 px bob on 16S, and a prompt that fades in from
   0.6 s and pulses 0.45<->1 on the beat (4S). Show (stage 1): logo and prompt
   exit up over 0.3 s, the spark still flickering at the tip (it runs up the
   cord over that 0.3 s only if TITLE_RUNUP), the veil drops 0.45 -> 0.12 by
   8S, and the skip hint
   appears only past SKIP_GUARD. lay is body[data-lay] (p/l = touch copy);
   rk is the board-ready fraction: 0 paints an opaque veil (3D still loading),
   1 the stage veil. o: {level (the world the logo wears), reduced (REDUCE FLASH)}. */
export function drawIntroChrome(c, stage, t, W, H, lay, rk = 1, o = {}) {
  const L = layout(W, H),
    touch = lay === "p" || lay === "l",
    show = stage === 1,
    dpr = deviceScale(c);
  const v0 = show ? 0.45 + (0.12 - 0.45) * easeInOutCubic(seg(t, 0, 8 * SHOW_STEP)) : 0.45;
  c.fillStyle = "rgba(7,10,18," + (rk >= 1 ? v0 : 1 - clamp01(rk) * (1 - v0)) + ")";
  c.fillRect(0, 0, W, H);
  const reveal = show ? 1 : easeOutCubic(seg(t, 0, TITLE_IN)),
    exit = show ? easeInCubic(seg(t, 0, 0.3)) : 0;
  const a = reveal * (1 - exit);
  if (a > 0.01) {
    const bob = show ? 0 : 2 * Math.sin((2 * Math.PI * t) / (16 * SHOW_STEP));
    const slide = 14 * (1 - reveal) - 20 * exit + bob;
    c.save();
    c.translate(0, slide);
    c.globalAlpha *= a;
    const B = titleLogoBox(W, H, lay);
    drawLogo2d(c, { level: o.level, place: "title", box: B.box, cy: B.cy, dev: B.dev, dpr, touch, t, run: show && TITLE_RUNUP ? seg(t, 0, 0.3) : undefined, reduced: o.reduced, scale: show ? 1 : 0.92 + 0.08 * easeOutBack(seg(t, 0, 0.45)) });
    c.restore();
  }
  const pin = show ? 1 - exit : easeOutCubic(seg(t, 0.6, TITLE_IN));
  if (pin > 0.01) {
    // touch copy is phone-sized: the stage scales to ~0.6 on a portrait phone
    const px = touch ? 26 : 18,
      prompt = touch ? "TAP TO START" : "PRESS ANY KEY OR BUTTON";
    // a steady dark box (drawAttractHint's idiom) under a fill that pulses
    // 0.45<->1 on the beat: legible at the pulse minimum over bright bricks
    c.globalAlpha = pin;
    backing(c, L.cx, L.footY, prompt.length * px * 0.6 + 24, px + 12);
    c.font = font(px, "900");
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.globalAlpha = show ? pin : pin * (0.725 + 0.275 * Math.cos((2 * Math.PI * t) / (4 * SHOW_STEP)));
    c.fillStyle = ACCENT;
    c.fillText(prompt, L.cx, L.footY);
    c.globalAlpha = 1;
  }
  const ha = show ? easeOutCubic(seg(t, SKIP_GUARD, SKIP_GUARD + 0.3)) : 0;
  if (ha > 0) {
    const px = touch ? 18 : 10,
      hint = tapMode(touch) ? "TAP TO SKIP" : hints().dev === "pad" ? "ANY BUTTON TO SKIP" : "ANY KEY TO SKIP",
      w = hint.length * px * 0.6,
      y = H - 8 - px / 2;
    c.globalAlpha = ha;
    backing(c, W - 14 - w / 2, y, w + 16, px + 8);
    c.fillStyle = MUTED;
    c.font = font(px);
    c.textAlign = "right";
    c.textBaseline = "middle";
    c.fillText(hint, W - 14, y);
    c.globalAlpha = 1;
  }
}
function backing(c, cx, cy, w, h) {
  c.fillStyle = "rgba(7,10,18,0.9)";
  c.fillRect(cx - w / 2, cy - h / 2, w, h);
  c.strokeStyle = LINE;
  c.lineWidth = 1;
  c.strokeRect(cx - w / 2 + 0.5, cy - h / 2 + 0.5, w - 1, h - 1);
}
/* MAIN MENU: the page is src/render/pages/menu.js (UI upgrade v202 Task 3.1): one geometry for draw and tap, rows by name. These keep the
   entry names shellview, the pointer and the tests call; L is layout(W, H, lg, css) for the box the page draws on (css: CSS px per box unit, the
   touch floors' scale), touch body[data-lay] p / l, the same argument for draw and tap. */
const frameOf = (L, touch) => ({ W: L.W, H: L.H, touch: !!touch, shell: !!L.shell, css: L.css, paused: !!L.paused, focus: L.focus }); // paused / focus: a PAUSE view's box, the focused row (the SETTINGS page's page on screen)
export const menuGeom = (L, _n, touch) => menuPage.menuGeom(frameOf(L, touch));
export const menuHit = (x, y, L, _n, touch) => menuPage.menuHit(x, y, frameOf(L, touch));
export const drawMenu = (c, ui, L, t, touch) => menuPage.drawMenuPage(c, frameOf(L, touch), ui || {}, t);
/* A pane's head line and a pane line (the CONTROLS page's preview pane). */
function paneHead(c, P, title, right, rc) {
  c.textBaseline = "middle";
  c.textAlign = "left";
  c.fillStyle = TEXT;
  c.font = sans(15, "800");
  c.fillText(title, P.x + 10, P.y + 14);
  if (right) {
    c.textAlign = "right";
    c.font = font(10, "700");
    c.fillStyle = rc || MUTED;
    c.fillText(right, P.x + P.w - 10, P.y + 14);
  }
}
function paneLine(c, P, y, s, col, size, align) {
  c.textAlign = align || "left";
  c.textBaseline = "middle";
  c.fillStyle = col || MUTED;
  c.font = font(size || 10, "700");
  c.fillText(clip(c, s, P.w - 20), align === "center" ? P.x + P.w / 2 : P.x + 10, y);
}

/* LEVEL SELECT: the page is src/render/pages/level.js (UI upgrade v202 Task 3.3): one geometry for draw and tap, rects by name. These keep the
   entry names shellview, the pointer and the tests call; L is layout(W, H, lg, css) for the box the page draws on, touch body[data-lay] p / l, open
   the MODIFIERS list (app.modOpen): the same arguments for draw and tap. */
const NO_FOCUS = () => -1;
let modeFocus = NO_FOCUS;
/** The LEVEL SELECT MODIFIERS entry a controller's TRIGGER has focused, as a getter: -1 = none. Set once by main; shellview's info does not carry it. */
export function setModeFocus(f) { modeFocus = f || NO_FOCUS; }
export function modeFocusOf() { return modeFocus(); }
const lvOpt = (unlocked, open, row) => ({ unlocked: !!unlocked, open: !!open, row: row || LABEL.LEVEL });
/* row: the focused row's name (app.levelRow), which picks a paged compact's page */
export const levelGeom = (L, unlocked, touch, open, row) => levelPage.levelGeom(frameOf(L, touch), lvOpt(unlocked, open, row));
export const levelHit = (x, y, L, unlocked, touch, open, row) => levelPage.levelHit(x, y, frameOf(L, touch), lvOpt(unlocked, open, row));
export const LEVEL_TAP = levelPage.LEVEL_TAP, LEVEL_TAP_LIST = levelPage.LEVEL_TAP_LIST;
/** LEVEL SELECT's foot words for the focused row (or the open list), label first and keycap last: the page's footItems as one line. */
export const levelFoot = (row, open) => levelPage.footText(levelPage.footItems(row || LABEL.LEVEL, !!open));
/* info = {best: [8 formatted times or null] at this difficulty, speed and modifiers, row (the focused row's name), open, cur (the list), tap (tap mode,
   ruling 4: shellview's app.lastDev; absent = hintcopy tapMode), lockR, lockT, enterT, rev (MENU's build tag: the shared room's dpr)} from shellview (times arrive formatted; this file never reads a store). */
export function drawLevelSelect(c, sel, L, t, heat, pact, unlocked, pace, timeAttack, touch, info) {
  const I = info || {}, U = !!unlocked, lv = sel | 0 || 1;
  levelPage.drawLevelPage(c, frameOf(L, touch), { level: lv, heat, pace, pact: U ? pact | 0 : 0, time: U && !!timeAttack, unlocked: U, best: (I.best || [])[lv - 1] || null, row: I.row || LABEL.LEVEL, open: !!I.open, cur: I.cur, trig: modeFocus(), tap: I.tap, lockR: I.lockR, lockT: I.lockT, enterT: I.enterT, rev: I.rev }, t);
}

/* GUIDE art in PIXEL (W5, R19): kind "px" swaps only the scaled vector glyph
   for the atlas cell (hudart.js); wells, rows and text are the same
   calls in every kind. */
const pxArt = (kind) => (kind === "px" ? pixelArt() : null);
const BACK_TAP = "TAP OUTSIDE TO GO BACK";

/* HOW TO PLAY: the two rules first, then the control grid mirroring the
   page .hint (power-gate asterisks). */
const howRows = (W) => [
  [W.move + " / " + W.moveAlt, "MOVE", null],
  [W.bomb, "BOMB", "bomb"],
  [W.throw, "THROW *", "throw"],
  [W.remote, "REMOTE *", "remote"],
  ["WALK INTO BOMB", "KICK *", "kick"],
  [W.pause, "PAUSE", null],
];
export function drawHowTo(c, L, t, kind, touch) {
  const T = !!touch,
    rule = T ? 44 : 34,
    rh = T ? 52 : 40,
    note = T ? 20 : 16,
    nr = L.narrow ? 2 : 1, // the narrow box stacks the two rules
    rules = nr * rule + (nr - 1) * 6,
    S = pageBox(L, 520, rules + 8 + 3 * rh + 6 + note, T),
    f = S.f;
  boxPlate(c, S);
  head(c, S, "HOW TO PLAY", "TWO RULES · SIX CONTROLS");
  const rw = nr === 2 ? S.iw : (S.iw - 8) / 2;
  ["CLEAR EVERY ENEMY", "GOLD WALL NEVER BREAKS"].forEach((s, i) => {
    const r = nr === 2 ? { x: S.ix, y: S.by + i * (rule + 6) * f, w: rw, h: rule * f } : { x: S.ix + i * (rw + 8), y: S.by, w: rw, h: rule * f };
    cell(c, r, 0.5);
    c.fillStyle = i ? "#ffd447" : ACCENT;
    c.fillRect(r.x, r.y, 3, r.h);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = sans(T ? 15 : 13, "800");
    c.fillText(s, r.x + r.w / 2, r.y + r.h / 2);
  });
  const y0 = S.by + (rules + 8) * f,
    cw = (S.iw - 8) / 2,
    ws = T ? 26 : 22,
    A = pxArt(kind);
  const W = hints(), rows = howRows(W);
  for (let i = 0; i < rows.length; i++) {
    const [k, v, kd] = rows[i],
      r = { x: S.ix + (i % 2) * (cw + 8), y: y0 + ((i >> 1) * rh) * f, w: cw, h: (rh - 4) * f },
      cy = r.y + r.h / 2;
    cell(c, r);
    let tx = r.x + 10;
    if (kd) {
      const p = POWER.find((d) => d.t === kd);
      well(c, r.x + 10 + ws / 2, cy, ws, p && p.col);
      itemAt(c, A, p, r.x + 10 + ws / 2, cy, ws * 0.72, t);
      tx = r.x + ws + 18;
    }
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.fillStyle = ACCENT;
    c.font = font(T ? 12 : 10, "900");
    c.fillText(k, tx, cy - (T ? 9 : 7));
    c.fillStyle = TEXT;
    c.font = sans(T ? 16 : 13, "700");
    c.fillText(v, tx, cy + (T ? 10 : 8));
  }
  c.textAlign = "center";
  c.fillStyle = MUTED;
  c.font = font(T ? 12 : 10);
  c.fillText(tapMode(T) ? "TOUCH · LEFT PAD MOVES · RIGHT BUTTON BOMBS" : "* NEEDS ITS POWER-UP", S.mid, y0 + (3 * rh + 6 + note / 2) * f - 4);
  foot(c, S, tapMode(T) ? BACK_TAP : (W.dev === "pad" ? "REBIND IN " + LABEL.SETTINGS + " › CONTROLS · " : "") + W.back + " / " + W.ok + " BACK");
}

/* POWER-UPS (SCREEN.ITEMS): two-column catalogue of every POWER pickup; help wraps (≤2 lines). */
/* A narrow touch column cannot hold "the REMOTE button detonates your bombs" in two lines; the row's title already names the button. */
const NARROW_TAP = Object.freeze({ throw: "tap", remote: "tap" });
export function drawItemsHelp(c, L, t, kind, touch) {
  const T = !!touch,
    n = POWER.length,
    rows = Math.ceil(n / 2),
    rh = T ? 54 : 38,
    S = pageBox(L, 560, rows * rh + (rows - 1) * 4, T),
    f = S.f,
    cw = (S.iw - 8) / 2,
    ws = T ? 28 : 24,
    A = pxArt(kind),
    ps = A ? pageScale(POWER.map((p) => itemCell(A, p.t)), ws + SLOT_PAD) : 1;
  boxPlate(c, S);
  head(c, S, LABEL.POWER_UPS, n + " " + LABEL.POWER_UPS);
  for (let i = 0; i < n; i++) {
    const p = POWER[i],
      r = { x: S.ix + (i % 2) * (cw + 8), y: S.by + (i >> 1) * (rh + 4) * f, w: cw, h: rh * f },
      cy = r.y + r.h / 2,
      tx = r.x + ws + 18,
      tw = r.x + r.w - 8 - tx;
    cell(c, r);
    well(c, r.x + 10 + ws / 2, cy, ws, p.col);
    itemAt(c, A, p, r.x + 10 + ws / 2, cy, ws * 0.72, t, ps);
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.font = font(T ? 12 : 10);
    const hl = wrap(c, tapMode(T) && L.narrow ? helpOf(p, NARROW_TAP) : helpOf(p, hints(), tapMode(T)), tw, T ? 2 : 1);
    const top = cy - ((hl.length - 1) * (T ? 7 : 6)) - (T ? 9 : 6);
    c.fillStyle = TEXT;
    c.font = sans(T ? 15 : 12, "800");
    c.fillText(p.name, tx, top);
    c.fillStyle = MUTED;
    c.font = font(T ? 12 : 10);
    hl.forEach((l, j) => c.fillText(l, tx, top + (T ? 17 : 13) + j * (T ? 14 : 12)));
    if (p.permanent) {
      c.fillStyle = ACCENT;
      c.globalAlpha = 0.7;
      c.fillRect(r.x + r.w - 3, r.y + 4, 2, r.h - 8);
      c.globalAlpha = 1;
    }
  }
  foot(c, S, tapMode(T) ? BACK_TAP : "WALK OVER A POWER-UP TO COLLECT · " + hints().back + " BACK");
}

/* ENEMIES: 3x3 field guide; name, a 2-line measured help and its LEVELS. */
export function drawEnemiesHelp(c, L, t, kind, touch) {
  const T = !!touch,
    n = FOES.length,
    nc = L.narrow ? 2 : 3, // the narrow box: two columns, so names and help read whole
    rows = Math.ceil(n / nc),
    rh = T ? 86 : 64,
    S = pageBox(L, 560, rows * rh + (rows - 1) * 6, T),
    f = S.f,
    cw = (S.iw - 6 * (nc - 1)) / nc,
    ws = T ? 34 : 32,
    A = pxArt(kind),
    ps = A ? pageScale(FOES.map((e) => foeCell(A, e.t)), ws + SLOT_PAD) : 1;
  boxPlate(c, S);
  head(c, S, "ENEMIES", "FIELD GUIDE · " + n + " FOES");
  for (let i = 0; i < n; i++) {
    const e = FOES[i],
      r = { x: S.ix + (i % nc) * (cw + 6), y: S.by + Math.floor(i / nc) * (rh + 6) * f, w: cw, h: rh * f },
      tx = r.x + ws + 16,
      tw = r.x + r.w - 6 - tx;
    cell(c, r);
    well(c, r.x + 8 + ws / 2, r.y + r.h / 2, ws);
    foeAt(c, A, e.t, r.x + 8 + ws / 2, r.y + r.h / 2, ws * 0.8, t, ps);
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.fillStyle = TEXT;
    c.font = sans(T ? 15 : 12, "800");
    c.fillText(clip(c, e.name, tw), tx, r.y + (T ? 16 : 12));
    c.fillStyle = MUTED;
    c.font = font(T ? 12 : 9);
    wrap(c, e.help, tw, 2).forEach((l, j) => c.fillText(l, tx, r.y + (T ? 36 : 26) + j * (T ? 15 : 11)));
    c.fillStyle = ACCENT;
    c.font = font(T ? 11 : 8, "900");
    c.fillText(levelsOf(e.rooms), tx, r.y + r.h - (T ? 11 : 8)); // LEVEL 8 for one
  }
  foot(c, S, tapMode(T) ? BACK_TAP : hints().back + " BACK");
}

/* GUIDE (ATLAS): four door tiles in a 2x2 on keyboard (←/→ or ↑/↓
   walk them in order), stacked 70-tall rows with the strip inline on touch. Each door
   shows what is behind it. guideHit shares guideGeom; a tile owns half of
   each gutter, the rest of the plate is inert (-2), off it backs out (-1). */
const GUIDE_LABEL = ["HOW TO PLAY", LABEL.POWER_UPS, "ENEMIES", "FLOOR"];
export function guideGeom(L, touch) {
  const T = !!touch,
    S = pageBox(L, T ? 520 : 552, T ? 4 * 70 + 18 : 2 * 64 + 8, T),
    f = S.f,
    tw = T ? S.iw : (S.iw - 8) / 2;
  const tiles = [0, 1, 2, 3].map((i) => (T ? { x: S.ix, y: S.by + i * 76 * f, w: tw, h: 70 * f } : { x: S.ix + (i & 1) * (tw + 8), y: S.by + (i >> 1) * 72 * f, w: tw, h: 64 * f }));
  return { S, tiles, T };
}
export function guideHit(x, y, L, _n, touch) {
  const g = guideGeom(L, touch),
    p = g.T ? 3 : 4;
  for (let i = 0; i < 4; i++) if (inR(g.tiles[i], x, y, p)) return i;
  const S = g.S;
  return x >= S.x && x <= S.x + S.w && y >= S.y && y <= S.y + S.h ? -2 : -1;
}
function keyCap(c, x, y, s, T) {
  c.font = font(T ? 12 : 10, "900");
  const w = mw(c, s) + 12,
    h = T ? 22 : 18;
  c.fillStyle = "rgba(4,7,14,0.9)";
  c.fillRect(x, y - h / 2, w, h);
  c.strokeStyle = MUTED;
  c.lineWidth = 1;
  c.strokeRect(x + 0.5, y - h / 2 + 0.5, w - 1, h - 1);
  c.fillStyle = TEXT;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(s, x + w / 2, y + 1);
  return w;
}
/* FLOOR: the eight tiles, one per world (core/feat.js HOME), painted by the look's own painter at each difficulty (heat 0..2). All eight have rules since v196; every ordinary run and the DAILY play them since v198. */
const FLOOR_ROWS = [
  { k: "BLOOM", name: TILE_NAME.BLOOM, room: 1 },
  { k: "GLIDE", name: TILE_NAME.GLIDE, room: 2 },
  { k: "BELT", name: TILE_NAME.BELT, room: 3 },
  { k: "STREAM", name: TILE_NAME.STREAM, room: 4 },
  { k: "PLATE", name: TILE_NAME.PLATE, room: 5 },
  { k: "QUICK", name: TILE_NAME.QUICK, room: 6 },
  { k: "PORTAL", name: TILE_NAME.PORTAL, room: 7 },
  { k: "GATE", name: TILE_NAME.GATE, room: 8 },
];
const SIDES4 = ["N", "E", "S", "W"];
const floorSpec = (k, h, t) => ({ kind: k, h, par: 0, dir: 0, outer: SIDES4, exit: true, entry: true, phase: ((Math.floor(t * 28) % 8) * 5) | 0, state: 0, lit: 0, pair: 1, gx: 3, gy: 4 });
function floorAt(c, A, row, h, cx, cy, size, t) {
  const sp = floorSpec(row.k, h, t || 0), bi = row.room - 1;
  if (A && A.feat) return blitCell(c, [A.feat(bi, sp, t || 0)], cx, cy, size >= 40 ? 2 : 1);
  drawSpec(c, BIOMES[bi % BIOMES.length], sp, Math.round(cx - size / 2), Math.round(cy - size / 2), size);
}
export function drawFloorHelp(c, L, t, kind, touch) {
  const T = !!touch,
    n = FLOOR_ROWS.length,
    rh = T ? 54 : 44,
    hd = T ? 16 : 14,
    sw = L.narrow ? 28 : 40,
    S = pageBox(L, 560, hd + n * rh + (n - 1) * 4, T),
    f = S.f,
    A = pxArt(kind),
    gx = S.ix + 8,
    tx = gx + 3 * sw + 2 * 4 + 14;
  boxPlate(c, S);
  head(c, S, "FLOOR", n + " TILES · ONE PER WORLD · BY " + LABEL.DIFFICULTY); // its columns are the three difficulties
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = MUTED;
  c.font = font(T ? 10 : 8, "900");
  for (let j = 0; j < 3; j++) { c.font = fitFont(c, DIFF[j], sw + 2, T ? 10 : 8, 6, "900"); c.fillText(DIFF[j], gx + j * (sw + 4) + sw / 2, S.by + hd / 2 - 1); } // EXPERT outgrows a narrow 28 px column
  for (let i = 0; i < n; i++) {
    const row = FLOOR_ROWS[i],
      r = { x: S.ix, y: S.by + (hd + i * (rh + 4)) * f, w: S.iw, h: rh * f },
      cy = r.y + r.h / 2,
      tw = r.x + r.w - 8 - tx,
      rules = !!TILE_HELP[row.k];
    cell(c, r);
    for (let j = 0; j < 3; j++) floorAt(c, A, row, j, gx + j * (sw + 4) + sw / 2, cy, sw, t);
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.fillStyle = TEXT;
    c.font = sans(T ? 15 : 12, "800");
    c.fillText(row.name, tx, cy - (T ? 14 : 11));
    const nw = mw(c, row.name);
    c.fillStyle = ACCENT;
    c.font = font(T ? 10 : 8, "900");
    c.fillText(clip(c, LABEL.LEVEL + " " + row.room + " · " + BIOMES[row.room - 1].name, tw - nw - 10), tx + nw + 10, cy - (T ? 14 : 11));
    c.fillStyle = MUTED;
    c.font = font(T ? 11 : 9);
    const l1 = rules ? DIFF[0] + " · " + TILE_HELP[row.k][0] : "LOOK ONLY FOR NOW",
      l2 = rules ? DIFF[2] + " · " + TILE_HELP[row.k][2] : "ITS RULE COMES LATER";
    c.fillText(clip(c, l1, tw), tx, cy + (T ? 4 : 3));
    c.fillText(clip(c, l2, tw), tx, cy + (T ? 19 : 14));
    if (rules) {
      c.fillStyle = ACCENT;
      c.globalAlpha = 0.7;
      c.fillRect(r.x + r.w - 3, r.y + 4, 2, r.h - 8);
      c.globalAlpha = 1;
    }
  }
  foot(c, S, tapMode(T) ? BACK_TAP : hints().back + " BACK");
}

export function drawGuide(c, L, t, cursor, kind, touch) {
  const cur = cursor | 0,
    g = guideGeom(L, touch),
    S = g.S,
    T = g.T,
    A = pxArt(kind);
  boxPlate(c, S);
  head(c, S, "GUIDE", "HOW TO · " + LABEL.POWER_UPS + " · ENEMIES · FLOOR");
  const W = hints(), subs = [T || W.dev === "pad" ? "2 RULES · 6 CONTROLS" : "2 RULES · 6 KEYS", POWER.length + " " + LABEL.POWER_UPS, FOES.length + " FOES", FLOOR_ROWS.length + " TILES"];
  for (let i = 0; i < 4; i++) {
    const r = g.tiles[i],
      sel = i === cur;
    cell(c, r, 0.5);
    if (sel) selBand(c, r);
    c.textBaseline = "middle";
    c.textAlign = "left";
    c.fillStyle = sel ? TEXT : "#b6c2dc";
    c.font = sans(T ? 17 : 14, "800");
    const lx = r.x + 24,
      strip = T || r.w >= 230, // a narrow keyboard door (2x2 in a < 560 box) drops the preview strip so its words stay whole
      sx = T ? r.x + r.w - 40 : strip ? r.x + r.w - 118 : r.x + r.w - 18; // the strip ends left of the chevron; label and sub stop 8 px before it
    c.fillText(clip(c, GUIDE_LABEL[i], T ? r.w : sx - 8 - lx), lx, T ? r.y + r.h / 2 - 10 : r.y + 20);
    c.fillStyle = sel ? TEXT : MUTED;
    c.font = font(T ? 13 : 10, "700");
    c.fillText(clip(c, !T && !i && strip && W.dev === "pad" ? "6 CONTROLS" : subs[i], (T ? r.x + r.w - 150 : sx - 8) - lx), lx, T ? r.y + r.h / 2 + 12 : r.y + r.h - 16);
    c.textAlign = "right";
    c.font = sans(18, "600");
    c.fillText("›", r.x + r.w - 10, T ? r.y + r.h / 2 : r.y + 20);
    if (sel) caret(c, r.x + 11, T ? r.y + r.h / 2 : r.y + 20, 30);
    const sy = T ? r.y + r.h / 2 : r.y + r.h / 2 + 2;
    if (!strip) continue;
    if (i === 0) {
      if (T) {
        c.font = font(12, "900");
        let x = sx;
        for (const k of ["PAUSE", "BOMB", "PAD"]) x -= keyCap(c, x - (mw(c, k) + 12), sy, k, T) + 4; // the touch controls, never keyboard caps on a phone
      } else {
        const end = r.x + r.w - 22; // the chevron's edge: a cap that would cross it (a long rebound name, a third pad word) is dropped whole
        for (const [ky, list] of [[sy - 12, [W.move, W.bomb]], [sy + 10, [W.throw, W.remote, W.pause]]]) {
          let x = sx;
          for (const k of list) {
            c.font = font(10, "900");
            if (x + mw(c, k) + 12 > end) break;
            x += keyCap(c, x, ky, k, T) + 4;
          }
        }
      }
    } else {
      const list = i === 1 ? POWER.slice(0, T ? 4 : 3) : i === 2 ? [FOES[0], FOES[3], FOES[4]] : [FLOOR_ROWS[2], FLOOR_ROWS[1], FLOOR_ROWS[0]],
        s = T ? 30 : 28,
        x0 = sx;
      list.forEach((e, j) => {
        const cx = T ? x0 - (list.length - 1 - j) * (s + 4) - s / 2 : x0 + s / 2 + j * (s + 4);
        if (i === 3) return floorAt(c, A, e, 1, cx, sy, s, t);
        well(c, cx, sy, s, i === 1 ? e.col : null);
        if (i === 1) itemAt(c, A, e, cx, sy, s * 0.72, t);
        else foeAt(c, A, e.t, cx, sy, s * 0.82, t);
      });
    }
  }
  foot(c, S, tapMode(T) ? "TAP A DOOR · " + BACK_TAP : "← → / ↑↓ PICK · " + W.ok + " OPEN · " + W.back + " BACK");
}

/* Local cabinet plaques (plan 5): bit order matches src/app/plaques.js
   PLAQUE = {CLEAR:1,PLUS:2,MAX:4,CROWN:8} — this file must not import
   src/app, so the names are duplicated here rather than imported; the two
   heat plaques read as their difficulty (words.js). */
const PLAQUE_NAME = ["CLEAR", DIFF[1], DIFF[2], "CROWN"];

/* RECORDS' tab strip (Task 2.2, ruling R7): SCORES · STATS · MEDALS as one segmented row on the head's title line of
   each of the three pages (no plate moves), the current tab marked by segs, the tab row's focus the kit's selection
   (the 3px notch on the current tab and the caret). recTabsGeom is the one geometry for draw and tap; recPlate is the
   plate each page paints (page 0 SCORES, 1 STATS, 2 MEDALS); recTabHit's band is the head over each tab, the kicker
   included, and ends 5 px above the body, so it never meets SCORES' difficulty tabs (inR pad 4 under it). */
export function recTabsGeom(S, touch) {
  const tw = Math.min(touch ? 120 : 96, S.iw / 3), x0 = S.mid - (3 * tw) / 2;
  return [0, 1, 2].map((i) => ({ x: x0 + i * tw, y: S.y + 23, w: tw, h: 22 }));
}
export const recPlate = (L, page, touch) => (page === 0 ? scoresGeom(L, touch).S : page === 1 ? statsGeom(L).S : trophiesGeom(L).S);
/* The RECORDS tab under a tap on page's plate, else -1. */
export function recTabHit(x, y, L, page, touch) {
  const S = recPlate(L, page, touch), T = recTabsGeom(S, touch);
  if (y < S.y || y > T[0].y + T[0].h + 4) return -1;
  for (let i = 0; i < 3; i++) if (x >= T[i].x - (i ? 0 : 4) && x <= T[i].x + T[i].w + (i < 2 ? 0 : 4)) return i;
  return -1;
}
function recTabs(c, S, page, tabs, touch) {
  const T = recTabsGeom(S, touch), r = T[page];
  segs(c, T, RECORD_TABS, page, null, touch, touch ? 13 : 11);
  if (!tabs) return;
  c.fillStyle = ACCENT;
  c.fillRect(r.x, r.y, 3, r.h);
  caret(c, T[0].x - 12, r.y + r.h / 2, r.h);
}
/* The foot leads (the words from words.js, the keycaps here): on the tab row ←/→ (keys, D-PAD) step the tabs; from a page body
   ↑ goes back to them. The same length, so STATS' tappable T / C / R sit in the same place in both focus states. */
export const TAB_LEAD = "←→ " + LABEL.TAB + " · ", TABS_LEAD = "↑ " + LABEL.TABS + " · ";

/* HIGH SCORES (RECORDS' SCORES tab; the strip on the head's title line): the
   CORE / PLUS / MAX segmented control, the four plaques
   (dim when locked), then a hugging ten-slot table. `scores` arrives already
   filtered by heat (scoresForHeat lives in src/app/highscores.js — this file
   must not import src/app); `plaques` is the unlocked bitmask. scoresGeom is
   the one table for draw and tap (scoresHit). */
export function scoresGeom(L, touch) {
  const T = !!touch,
    tabH = T ? 52 : 30,
    rh = T ? 26 : 22,
    S = pageBox(L, 480, tabH + 6 + 18 + 8 + 11 * rh, T),
    f = S.f,
    tw = Math.min(T ? 130 : 100, S.iw / 3),
    tabs = [0, 1, 2].map((i) => ({ x: S.mid - (3 * tw) / 2 + i * tw, y: S.by, w: tw, h: tabH * f }));
  return { S, f, tabs, chipY: S.by + (tabH + 6) * f, bodyTop: S.by + (tabH + 6 + 18 + 8) * f, rh: rh * f, T };
}
/* HIGH SCORES heat tab under a tap; -2 on the plate (inert), -1 off it
   (main backs out). */
export function scoresHit(x, y, L, touch) {
  const g = scoresGeom(L, touch),
    S = g.S;
  for (let i = 0; i < 3; i++) if (inR(g.tabs[i], x, y, 4)) return i;
  return x >= S.x && x <= S.x + S.w && y >= S.y && y <= S.y + S.h ? -2 : -1;
}
export function drawScores(c, scores, L, t, heat, plaques, touch, tabs) {
  const g = scoresGeom(L, touch),
    S = g.S,
    T = g.T,
    h = clampHeat(heat);
  boxPlate(c, S);
  head(c, S, "", "BEST RUNS BY " + LABEL.DIFFICULTY); // its tabs and plaques are difficulties; the touch foot names no key
  recTabs(c, S, 0, tabs, T);
  segs(c, g.tabs, DIFF, h, HEAT_COL.map((x, i) => (i ? x : TEXT)), T);
  const pmask = plaques | 0,
    chH = g.f < 1 ? Math.max(12, Math.floor((18 + 8) * g.f) - 4) : 18, // iso: the chip never reaches bodyTop
    chipW = 74,
    chipX0 = S.mid - (4 * chipW + 24) / 2;
  for (let i = 0; i < 4; i++) {
    const x = chipX0 + i * (chipW + 8),
      on = (pmask & (1 << i)) !== 0;
    if (on) {
      c.fillStyle = "rgba(55,240,208,0.14)";
      c.fillRect(x, g.chipY, chipW, chH);
    }
    c.strokeStyle = on ? ACCENT : EDGE; // locked plaques stay legible: muted, never faded out
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, g.chipY + 0.5, chipW - 1, chH - 1);
    c.fillStyle = on ? ACCENT : MUTED;
    c.font = font(9, on ? "900" : "");
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(PLAQUE_NAME[i], x + chipW / 2, g.chipY + chH / 2 + 1);
  }
  const list = Array.isArray(scores) ? scores : [],
    nShow = Math.min(10, list.length),
    rh = g.rh,
    bt = g.bodyTop,
    foot0 = tapMode(T) ? BACK_TAP : tabs ? TAB_LEAD + "↓ " + LABEL.DIFFICULTY + " · " + hints().back + " BACK" : TABS_LEAD + "← → " + LABEL.DIFFICULTY + " · " + hints().back + " BACK"; // tab row: ←/→ step the tabs, ↓ reaches the filter; the body: ↑ back to the tabs
  if (!nShow) {
    c.fillStyle = MUTED;
    c.font = font(T ? 15 : 12, "900");
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("NO " + diffTag(h) + " RUNS YET", S.mid, bt + 5 * rh);
    c.font = font(T ? 13 : 10);
    c.fillText("PICK " + diffTag(h) + " ON " + LABEL.LEVEL_SELECT + " TO SET ONE", S.mid, bt + 6.2 * rh);
    foot(c, S, foot0);
    return;
  }
  const gap = 10,
    mc = T ? 62 : 52, // MODIFIERS: the header outgrew today's 36 px column
    cw = [32, 64, 40, mc, Math.max(56, S.iw - 32 - 64 - 40 - mc - gap * 4)],
    xs = [S.ix];
  for (let i = 0; i < 4; i++) xs.push(xs[i] + cw[i] + gap);
  const hy = bt + rh / 2;
  c.font = font(T ? 11 : 9, "900");
  c.fillStyle = MUTED;
  c.textAlign = "left";
  c.textBaseline = "middle";
  c.fillText("RANK", xs[0], hy);
  c.fillText(LABEL.LEVEL, xs[2], hy);
  c.fillText(LABEL.MODIFIERS, xs[3], hy);
  c.fillText("DATE", xs[4], hy);
  c.textAlign = "right";
  c.fillText("SCORE", xs[1] + cw[1], hy);
  c.strokeStyle = LINE;
  c.beginPath();
  c.moveTo(S.ix, bt + rh - 1);
  c.lineTo(S.ix + S.iw, bt + rh - 1);
  c.stroke();
  for (let i = 0; i < nShow; i++) {
    const r = list[i],
      y = bt + (i + 1.5) * rh;
    if (i % 2 === 0) {
      c.fillStyle = "rgba(55,240,208,0.05)";
      c.fillRect(S.ix, y - rh / 2, S.iw, rh);
    }
    c.font = font(T ? 15 : 13);
    c.fillStyle = TEXT;
    c.textAlign = "left";
    c.fillText(String(i + 1), xs[0], y);
    c.fillText(String(r.l) + (HEAT_MARK[r.t | 0] || "·"), xs[2], y);
    c.fillText(pactLabel(r.p | 0), xs[3], y);
    c.fillText(String(r.d), xs[4], y);
    c.textAlign = "right";
    c.fillStyle = i === 0 ? ACCENT : TEXT;
    c.fillText(String(r.s), xs[1] + cw[1], y);
  }
  foot(c, S, foot0);
}

const RESET_RED = "#ff5d73";
const STATS_FOOT = "T MEDALS · C COPY MY STATS · R RESET · ESC BACK";
const STATS_PAD = "NORTH MEDALS · WEST COPY MY STATS · EAST BACK"; // no route to the wipe on a pad (acceptance S12)
/* The idle foot and its tap keys, one source for drawStats and statsHit. For keys and a controller a lead (no tap of its own)
   names the way to the tabs: ←→ TAB on the tab row, ↑ TABS from the body; a touch player taps the tabs, so that foot has none. */
const statsFoot = (tabs) => {
  const f = hints().dev === "pad" ? [STATS_PAD, ["KeyT", "KeyC"]] : [STATS_FOOT, ["KeyT", "KeyC", "KeyR"]];
  return hints().dev === "touch" ? f : [(tabs ? TAB_LEAD : TABS_LEAD) + f[0], [null].concat(f[1])];
};
const RESET_FOOT = "R AGAIN ERASES · OTHER KEYS CANCEL · KEEPS " + LABEL.SETTINGS + " + " + LABEL.GAME_SPEED + " · C COPY"; // 73 chars: the S.iw budget of 74 at the 0.6 em advance
const RESET_NOTES = Object.freeze([
  "ERASES SCORES · BESTS · TIMES · DAILY · MEDALS · PLAQUES · GHOSTS",
  "ERASES STATS + DAYS PLAYED · RELOCKS " + LABEL.LEVELS + " 6-8 · " + LABEL.MODIFIERS + " · " + TIME_TRIAL,
]);
/* STATS (ATLAS; RECORDS' STATS tab, the strip on the head's title line): eight tiles (seven lifetime counters + MEDALS n/8) in two
   columns, a BESTS row of three heat-coloured tiles, two notes, the foot.
   ui={rows,notes,trophies} arrives already computed (app/stats.js). The
   plate is pinned to the keyboard band floor so the foot tap band (statsHit)
   stays 464-492 at 600x520. A C copy note takes the kicker's slot. */
export function statsGeom(L) {
  return { S: pageBox(L, 480, 4 * 46 + 3 * 6 + 8 + 14 + 46 + 8 + 28, false, { bottom: !L.tall }) }; // the tall shell box centres it like every page
}
/* STATS foot taps (T1): token zones over the one painted foot string at the
   0.6 em mono advance, half a separator wide each side. */
export function statsHit(x, y, L, arm, tabs) {
  const S = statsGeom(L).S,
    idle = statsFoot(tabs),
    s = arm ? RESET_FOOT : idle[0],
    keys = arm ? ["KeyR", null, null, "KeyC"] : idle[1];
  if (y < S.footY - 12 || y > S.y + S.h) return null;
  const x0 = S.mid - s.length * 3;
  let a = 0;
  for (const [i, tok] of s.split(" · ").entries()) {
    const b = a + tok.length;
    if (keys[i] && x >= x0 + 6 * (a - 1.5) && x <= x0 + 6 * (b + 1.5)) return keys[i];
    a = b + 3;
  }
  return null;
}
export function drawStats(c, L, t, ui, arm, toast, touch, tabs) {
  const S = statsGeom(L).S,
    f = S.f,
    sq = f < 1, // the iso 608x352 guard: a 28px tile takes a smaller value + label pair
    tn = toast && toast.s,
    rows = (ui && ui.rows) || [],
    tro = (ui && ui.trophies) || [],
    notes = arm ? RESET_NOTES : (ui && ui.notes) || [];
  boxPlate(c, S);
  head(c, S, "", tn ? "" : "YOUR CABINET");
  recTabs(c, S, 1, tabs, touch);
  if (tn) {
    c.fillStyle = toast.ok ? ACCENT : RESET_RED;
    c.font = font(11, "900");
    c.fillText(toast.s, S.mid, S.headY - 9);
  }
  const tw = (S.iw - 6) / 2,
    th = 46 * f,
    life = rows.slice(0, 7).concat([["MEDALS", tro.filter((x) => x && x[2]).length + "/8"]]);
  c.textBaseline = "middle";
  for (let i = 0; i < 8; i++) {
    const r = { x: S.ix + (i % 2) * (tw + 6), y: S.by + (i >> 1) * (th + 6 * f), w: tw, h: th },
      v = life[i] || ["", ""];
    cell(c, r, 0.55);
    c.textAlign = "left";
    c.fillStyle = i === 7 ? ACCENT : TEXT;
    c.font = font(sq ? 14 : 18, "900");
    c.fillText(String(v[1]), r.x + 12, r.y + r.h / 2 - (sq ? 5 : 6));
    c.fillStyle = MUTED;
    c.font = font(sq ? 9 : 10, "700");
    c.fillText(String(v[0]), r.x + 12, r.y + r.h / 2 + (sq ? 8 : 12));
  }
  let y = S.by + (4 * 46 + 3 * 6 + 8) * f;
  c.fillStyle = MUTED;
  c.font = font(9, "700");
  c.fillText("BESTS · NO " + LABEL.MODIFIERS + " · " + speedTag(0), S.ix, y + 6);
  y += 14 * f;
  const bw = (S.iw - 12) / 3;
  for (let i = 0; i < 3; i++) {
    const r = { x: S.ix + i * (bw + 6), y, w: bw, h: 46 * f },
      v = rows[7 + i] || ["", "—"];
    cell(c, r, 0.55);
    c.fillStyle = i ? HEAT_COL[i] : TEXT;
    c.fillRect(r.x, r.y, 3, r.h);
    c.textAlign = "left";
    c.font = font(sq ? 12 : 13, "900"); // 13, not 15: "1840 · LEVEL 5" fits the tile whole
    c.fillStyle = TEXT;
    c.fillText(clip(c, String(v[1]), r.w - 20), r.x + 12, r.y + r.h / 2 - (sq ? 5 : 6));
    c.fillStyle = i ? HEAT_COL[i] : MUTED;
    c.font = font(sq ? 9 : 10, "700");
    c.fillText(String(v[0]), r.x + 12, r.y + r.h / 2 + (sq ? 8 : 12));
  }
  c.fillStyle = arm ? RESET_RED : MUTED;
  c.font = font(10);
  c.textAlign = "center";
  for (let i = 0; i < notes.length && i < 2; i++) c.fillText(clip(c, String(notes[i]), S.iw), S.mid, S.footY - (notes.length - i) * 14 - 2);
  if (arm) foot(c, S, RESET_FOOT, RESET_RED);
  else foot(c, S, statsFoot(tabs)[0]);
}

/* MEDALS (R6, SCREEN.TROPHIES): a 2x4 grid of medal tiles; the lock lives in
   the disc (filled accent = earned, hollow ring = still a goal), never in a
   0.45 alpha. rows=[name, desc, on] arrive finished from app/medals.js, so a
   missing list paints eight name-free placeholders. n/8 is a head bar. RECORDS'
   MEDALS tab: the strip on the head's title line, and no body under it. */
export function trophiesGeom(L) {
  const nc = L.narrow ? 1 : 2, // the narrow box: one column, so every goal reads whole
    nr = 8 / nc;
  return { S: pageBox(L, 552, nr * 60 + (nr - 1) * 6, false), nc };
}
export function drawTrophies(c, L, t, rows, touch, tabs) {
  const r0 = rows || [],
    { S, nc } = trophiesGeom(L),
    f = S.f,
    n = r0.filter((x) => x && x[2]).length,
    tw = (S.iw - 8 * (nc - 1)) / nc;
  boxPlate(c, S);
  head(c, S, "", n + "/8");
  recTabs(c, S, 2, tabs, touch);
  c.fillStyle = LINE;
  c.fillRect(S.mid - 80, S.y + 48, 160, 3);
  c.fillStyle = ACCENT;
  c.fillRect(S.mid - 80, S.y + 48, (160 * n) / 8, 3);
  for (let i = 0; i < 8; i++) {
    const [name, desc, on] = r0[i] || ["—", "", false],
      r = { x: S.ix + (i % nc) * (tw + 8), y: S.by + 4 + Math.floor(i / nc) * (60 + 6) * f, w: tw, h: 60 * f },
      dx = r.x + 22,
      cy = r.y + r.h / 2;
    cell(c, r, 0.55);
    if (on) {
      c.fillStyle = "rgba(55,240,208,0.08)";
      c.fillRect(r.x, r.y, r.w, r.h);
    }
    rr(c, dx - 11, cy - 11, 22, 22, 11);
    if (on) {
      c.fillStyle = ACCENT;
      c.fill();
      c.fillStyle = "#0a0e18";
      c.font = font(11, "900");
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("★", dx, cy + 1);
    } else {
      c.strokeStyle = MUTED;
      c.lineWidth = 1.5;
      c.stroke();
    }
    c.textAlign = "left";
    c.textBaseline = "middle";
    const sq = f < 1; // the iso 608x352 guard: a 44px tile packs name + two goal lines inside it
    c.fillStyle = on ? TEXT : "#b6c2dc";
    c.font = sans(13, "800");
    c.fillText(String(name), r.x + 42, sq ? cy - 13 : r.y + 15);
    c.fillStyle = MUTED;
    c.font = font(10, "700");
    wrap(c, String(desc), r.w - 52, 2).forEach((l, j) => c.fillText(l, r.x + 42, sq ? cy + 1 + j * 11 : r.y + 32 + j * 12));
  }
  foot(c, S, tapMode(touch) ? BACK_TAP : TAB_LEAD + hints().ok + " / " + hints().back + " BACK"); // no body: the tab row always has the focus; back is MENU
}

/* SETTINGS and GRAPHICS (SCREEN.SETTINGS / GRAPHICS; PAUSE views 1 and 2): the page is src/render/pages/settings.js (UI upgrade v202 Task 3.4),
   lazy (R20) through pages/lazy.js. These keep the entry names shellview, the pointer and the tests call, with the same arguments for draw and
   tap: L is layout(W, H, lg, css) for the box the page draws on (PAUSE: overlayBox's), touch body[data-lay] p / l (the draw reads ui.touch).
   Until the module is in, the page is one plate on the room that says LOADING (want() starts the import), a tap on it is inert (-2) and a tap off
   it backs out (-1); once in, every call is synchronous. *Geom answers null until then. ui is the page's (see its header); rows the visible list. */
const page = () => lazy.get("settings");
/* one ask in flight; a failed import shows DID NOT LOAD and is asked again at most every RETRY_MS, never every frame */
let failAt = -Infinity;
const RETRY_MS = 3000, nowMs = () => (globalThis.performance && typeof performance.now === "function" ? performance.now() : 0);
let asking = false;
const want = () => {
  if (!asking && nowMs() - failAt >= RETRY_MS) { asking = true; lazy.want("settings").then(() => { asking = false; failAt = -Infinity; }, () => { asking = false; failAt = nowMs(); }); }
  return failAt > -Infinity;
};
/* OPTIONS and GRAPHICS share the tap model on a touch layout (row = Enter, off the plate = back); CONTROLS' foot reads it too. */
export const FOOT_TAP = "TAP A ROW TO CHANGE IT · TAP OUTSIDE TO GO BACK";
const LOAD_W = 360, LOAD_H = 128;
/* The room's dpr behind a lazy page and its LOADING plate, one formula for both (so the room the plate made is the one the page finds): the
   budget less the logo reserve and a page layer up to 0.7 of the box at full dpr; a page that needs more lowers its own. */
export const roomDpr = (W, H, dpr) => +Math.max(0.5, Math.min(dpr, Math.sqrt(Math.max(0, BUDGET - 3 * 1024 * 1024 - 0.7 * 4 * W * H * dpr * dpr) / (4 * W * H)))).toFixed(3);
function loadBox(F) {
  const k = Math.min(1, (F.W - 52) / LOAD_W, (F.H - 52) / LOAD_H), w = LOAD_W * k, h = LOAD_H * k;
  return { x: (F.W - w) / 2, y: (F.H - h) / 2, w, h, k };
}
/** The LOADING plate a lazy page shows until its module lands: the room (none over PAUSE's board), the kit plate, the title, one line. */
export function loadingPage(c, F, title, ui) {
  const u = ui || {}, level = u.level | 0 || 1, tok = worldTokens(level), B = loadBox(F);
  if (!(F.W > 0 && F.H > 0) || typeof c.clip !== "function") return;
  if (!u.paused) {
    if (canMake()) c.drawImage(roomLayer({ w: F.W, h: F.H }, level, tok, { dpr: roomDpr(F.W, F.H, capDpr(deviceScale(c), !!F.touch)), look: "2d", textScale: 1 }), 0, 0, F.W, F.H);
    else { c.fillStyle = toL(tok.bg1, 0.004); c.fillRect(0, 0, F.W, F.H); }
  }
  c.save(); c.translate(B.x, B.y); c.scale(B.k, B.k);
  kitPlate(c, 0, 0, LOAD_W, LOAD_H, tok);
  kitDsp(c, title, LOAD_W / 2, 50, 34, { align: "center" });
  kitLbl(c, u.failed ? "DID NOT LOAD" : "LOADING", LOAD_W / 2, 96, 16, { align: "center", col: CONST.t2 });
  c.restore();
}
const loadHit = (x, y, F) => { const B = loadBox(F); return x >= B.x && x < B.x + B.w && y >= B.y && y < B.y + B.h ? -2 : -1; };
/** SETTINGS' geometry for the visible rows (pages/settings.js settingsGeom on this box); null until the page is in. */
export const settingsGeom = (L, touch, rows) => { const m = page(); return m ? m.settingsGeom(frameOf(L, touch), rows) : null; };
export const graphicsGeom = (L, touch) => { const m = page(); return m ? m.graphicsGeom(frameOf(L, touch)) : null; };
/** A tap's index into rows (the visible list optRow indexes, R11); -2 inert on the plate, -1 off it (or on the phone's BACK). */
export const settingsHit = (x, y, L, rows, touch) => { const m = page(), F = frameOf(L, touch); return m ? m.settingsHit(x, y, F, rows) : loadHit(x, y, F); };
export const graphicsHit = (x, y, L, _n, touch) => { const m = page(), F = frameOf(L, touch); return m ? m.graphicsHit(x, y, F) : loadHit(x, y, F); };
export function drawSettings(c, L, t, ui) {
  const u = ui || {}, F = frameOf(L, u.touch), m = page();
  if (m) return m.drawSettingsPage(c, F, u, t);
  loadingPage(c, F, LABEL.SETTINGS, { ...u, failed: want() });
}

/* RENDER row job states (v202 delivery, design 2026-11-06 "What the player
   sees"). The value slot carries the job of the look being prepared and a 2 px
   line along the band's bottom its honest fill; nothing reflows. app.lookJob =
   {k, state:"loading"|"preparing"|"ready"|"failed", phase, done, total} (fill /
   slow when jobs.js hands them); lookNote is the pure memo step shellview runs
   every frame: a live wait shows nothing new for NOTE_HOLD, a finished one that
   was shown reads READY for READY_T, a failure shows at once. */
export const LOOK_NAME = Object.freeze({ px: "PIXEL", "3d": "REAL 3D" });
export const NOTE_HOLD = 0.4, READY_T = 0.8;
const PH_ORDER = ["bake", "build", "shaders", "warm"], PH_WORD = { bake: "ART", build: "BUILDING", shaders: "SHADERS" };
/* 0..1, or -1 = no count (still stripes, never a made-up share). Without
   job.fill: files own [0, .5), each prepare phase a fixed eighth after them. */
export function jobFill(j) {
  if (typeof j.fill === "number") return clamp01(j.fill);
  const n = j.total > 0 ? clamp01((j.done | 0) / j.total) : -1;
  if (j.state === "loading") return n < 0 ? -1 : 0.5 * n;
  const i = PH_ORDER.indexOf(j.phase);
  return i < 0 || n < 0 ? -1 : 0.5 + 0.125 * (i + n);
}
const lookOf = (j) => (j && LOOK_NAME[j.k] ? j : null);
export function lookNote(m, job, now, pick) {
  const j = lookOf(job);
  if (j && j.state !== "ready") {
    if (!m || m.k !== j.k || m.readyT != null) m = { k: j.k, t0: now, fill: 0, shown: false };
    if (j.state === "failed") { m.shown = m.fail = true; return { m, n: { k: j.k, st: "fail", fill: -1 } }; }
    m.fail = false;
    const f = jobFill(j);
    if (f >= 0) m.fill = Math.max(m.fill, f);
    if (!m.shown && now - m.t0 < NOTE_HOLD) return { m, n: null };
    m.shown = true;
    return { m, n: { k: j.k, st: j.state, phase: j.phase, done: Math.min(j.done | 0, j.total | 0), total: j.total | 0, slow: !!j.slow, fill: f < 0 ? -1 : m.fill } };
  }
  if (m && m.shown && !m.fail && m.k === pick && (!j || j.k === m.k)) {
    if (m.readyT == null) m.readyT = now;
    if (now - m.readyT < READY_T) return { m, n: { k: m.k, st: "ready", fill: 1 } };
  }
  return { m: null, n: null };
}
/* The value's words, longest first; the row keeps the first that fits its slot. */
export function lookVal(n, touch) {
  const L = LOOK_NAME[n.k] || "";
  if (n.st === "fail") { const r = tapMode(touch) ? "TAP TO RETRY" : hints().ok + " RETRY"; return [L + " · DID NOT LOAD · " + r, "DID NOT LOAD · " + r, r]; } // r alone, in the danger colour: the narrowest box, where ART STYLE (longer than RENDER) leaves less room
  if (n.st === "ready") return [L + " · READY", "READY"];
  const cnt = n.total > 0 ? n.done + " / " + n.total : "";
  const s = n.st === "loading" ? (n.slow ? "SLOW, STILL TRYING" : cnt || "LOADING") : PH_WORD[n.phase] && cnt ? PH_WORD[n.phase] + " " + cnt : "PREPARING";
  return [L + " · " + s, s];
}
/* LEVEL SELECT's START tag: the first of cands that fits room at the value type, else the last one clipped. */
export function fitVal(c, cands, room) {
  c.font = font(12);
  for (const s of cands) if (mw(c, s) <= room) return s;
  return clip(c, cands[cands.length - 1], room);
}
/* GRAPHICS' rows arrive finished from the app (gfx.js owns every string; this file must not import src/app): ui = {row, view, togT, chg, kicker,
   touch, level, paused}; the page draws them (pages/settings.js drawGraphicsPage). */
export const GFX_N = 8; // pinned equal to gfx.js GFX_ROWS.length
export function drawGraphics(c, L, t, ui) {
  const u = ui || {}, F = frameOf(L, u.touch), m = page();
  if (m) return m.drawGraphicsPage(c, F, u, t);
  loadingPage(c, F, "GRAPHICS", { ...u, failed: want() });
}


/* FPS METER chip (GRAPHICS row 7): bottom-right of the box on every screen.
   info is app.gfx {fps, kind, dpr3d, dprPx, limit} or null before the frame
   loop has reported; density shows only in REAL 3D and PIXEL. idle tags the
   screens the gate holds at the idle rate (menus, PAUSE, WIN/LOSE, ATTRACT),
   so a 30 read beside FRAME RATE 60 explains itself. xOf mirrors
   gfx.js's one-decimal format (pinned equal in menudraw.test). */
const xOf = (v) => (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, "") + "X";
export function meterText(info, idle) {
  const i = info || {},
    d = i.kind === "3d" ? i.dpr3d : i.kind === "px" ? i.dprPx : 0;
  return (typeof i.fps === "number" ? String(Math.round(i.fps)) : "--") + " FPS" +
    (d > 0 ? " · " + xOf(d) : "") + (idle ? " · IDLE" : "") + (i.limit ? " · LIMIT" : "");
}
export function drawMeter(c, W, H, info, idle) {
  const s = meterText(info, idle),
    w = s.length * 5.4 + 10;
  c.fillStyle = "rgba(8,12,22,0.78)";
  c.fillRect(W - 4 - w, H - 18, w, 14);
  c.fillStyle = MUTED;
  c.font = font(9, "900");
  c.textAlign = "right";
  c.textBaseline = "middle";
  c.fillText(s, W - 9, H - 11);
}

/* ATTRACT hint: 1Hz-blink footer over the live demo (spec §5.6). */
export function drawAttractHint(c, L, t) {
  if (t % 1 >= 0.6 && t < 100) return;
  const w = 220;
  c.fillStyle = "rgba(8,12,22,0.78)";
  c.fillRect(L.cx - w / 2, L.footY - 12, w, 24);
  c.strokeStyle = LINE;
  c.strokeRect(L.cx - w / 2 + 0.5, L.footY - 11.5, w - 1, 23);
  c.fillStyle = ACCENT;
  c.font = font(11, "900");
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(hints().dev === "pad" ? "DEMO — PRESS ANY BUTTON" : "DEMO — TAP TO PLAY", L.cx, L.footY);
}

/* Full-canvas veil washes. */
export function drawDim(c, alpha, W, H) {
  c.fillStyle = "rgba(7,10,18," + Math.max(0, Math.min(1, alpha)) + ")";
  c.fillRect(0, 0, W, H);
}
