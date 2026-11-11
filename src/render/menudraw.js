/* MENU DRAWING LAYER: the entry names shellview, the pointer and the tests call. The pages are src/render/pages/ (the world kit, kit/); this
   file keeps the INTRO chrome, the ATTRACT hint, the FPS meter, the RENDER row's job note and THE LOADING plate's ask, and the CONSOLE PANEL
   kit (plate, head, foot, paintRow, listGeom) that the PAUSE list and CONTROLS still wear: accent #37f0d0, text #dfe7f5, muted #7385ad, veils
   rgba(7,10,18,a). Easing helpers duplicated from the intro beat table (spec §3): this file must not import from src/app. */
import { LABEL, runParts } from "./words.js";
import { rr } from "./icons.js";
import { hints, tapMode } from "./hintcopy.js";
import { drawLogo2d, deviceScale, TITLE_RUNUP } from "./logo/draw2d.js";
import * as menuPage from "./pages/menu.js";
import * as levelPage from "./pages/level.js";
import { rosterOf } from "./pages/card.js";
import * as lazy from "./pages/lazy.js";
import { capDpr } from "./kit/cache.js";
import { loadingPlate, loadBox } from "./kit/room.js";
import { FOOT_TAP, LOOK_NAME, lookVal, LOAD_WORDS } from "./kit/copy.js";
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
/* heatRoster deduped to [{t, n}] in first-seen order: the next-run card's (pages/card.js), the one roster. */
export { rosterOf };
/* A run's setup for one value slot, longest first (the first that fits is kept): every setting named; the modifiers as a count; only what
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
const frameOf = (L, touch) => ({ W: L.W, H: L.H, touch: !!touch, shell: !!L.shell, css: L.css });
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

/* LAZY PAGES (R20, R1: one plate, one ask; AGENTS.md "Lazy pages"). _rec.want: the test seam. */
export const _rec = { want: (n) => lazy.want(n) };
const RETRY_MS = 3000, nowMs = () => (globalThis.performance && typeof performance.now === "function" ? performance.now() : 0), asks = {};
function lazyMod(name) {
  const m = lazy.get(name);
  if (m) return m;
  const a = asks[name] || (asks[name] = { fails: 0, at: -Infinity, seen: null });
  if (a.fails < 2 || nowMs() - a.at >= RETRY_MS)
    Promise.resolve().then(() => {
      const p = _rec.want(name);
      return Promise.resolve(p).then(() => { a.fails = 0; }, () => { if (a.seen !== p) { a.seen = p; a.fails++; a.at = nowMs(); } });
    });
  return null;
}
/** THE LOADING plate (kit room.js loadingPlate); DID NOT LOAD while name's last import failed. ui: {level, rev, paused, failed}. */
export function loadingPage(c, F, title, ui, name) {
  const u = ui || {}, a = asks[name];
  loadingPlate(c, F, { level: u.level, rev: u.rev, paused: u.paused, title, dpr: capDpr(deviceScale(c), !!F.touch), line: u.failed || (a && a.fails > 0) ? LOAD_WORDS.failed : LOAD_WORDS.loading });
}

/* GUIDE and its four pages are src/render/pages/guide.js (UI upgrade v202 Task 3.5), lazy (pages/lazy.js "guide"): one geometry for draw and
   tap, names by label. These keep the entry names shellview, the pointer and the tests call; L is layout(W, H, lg, css) for the box the page draws
   on, touch body[data-lay] p / l, o = {level (the world), foe (ENEMIES' focused foe), tip (its tooltip open)}. Until the module is in, a page
   paints the LOADING plate (loadingPage) and its hits find nothing (-2: inert, so a tap while it loads never backs out). */
const guideMod = () => lazy.get("guide");
const gui = (page, kind, L, o, focus) => ({ page, focus, tip: !!(o && o.tip), pg: (o && o.pg) | 0, level: (o && o.level) | 0 || 1, look: kind === "px" ? "px" : "2d", narrow: !!L.narrow, rev: o && o.rev });
const guideLoading = (c, L, touch, title, o) => loadingPage(c, frameOf(L, touch), title, { level: o && o.level, rev: o && o.rev }, "guide");
const guidePage = (page) => (c, L, t, kind, touch, o) => { const g = lazyMod("guide"); if (!g) return guideLoading(c, L, touch, page, o); g.drawGuidePage(c, frameOf(L, touch), gui(page, kind, L, o, o && o.foe != null ? o.foe : null), t); };
export const drawHowTo = guidePage("HOW TO PLAY");
export const drawItemsHelp = guidePage(LABEL.POWER_UPS);
export const drawEnemiesHelp = guidePage("ENEMIES");
export const drawFloorHelp = guidePage("FLOOR");
export function drawGuide(c, L, t, cursor, kind, touch, o) {
  const g = lazyMod("guide");
  if (!g) return guideLoading(c, L, touch, "GUIDE", o);
  g.drawGuidePage(c, frameOf(L, touch), gui("GUIDE", kind, L, o, g.DOORS[cursor | 0]), t);
}
/** The GUIDE page's geometry (pages/guide.js guideGeom), null until the module is in. */
export const guideGeom = (L, touch, page) => { const g = guideMod(); return g ? g.guideGeom(frameOf(L, touch), page || "GUIDE") : null; };
export const guideHit = (x, y, L, _n, touch, focus) => { const g = guideMod(); return g ? g.guideHit(x, y, frameOf(L, touch), focus | 0) : -2; };
export const enemiesHit = (x, y, L, touch, focus, tip) => { const g = guideMod(); return g ? g.enemiesHit(x, y, frameOf(L, touch), focus | 0, !!tip) : -2; };
/** A read-only page (HOW TO PLAY, POWER-UPS, FLOOR) showing page pg: "up" / "down" on its page keys, else -1 (backs out); -2 while it loads. */
export const guideReadHit = (x, y, L, touch, page, pg) => { const g = guideMod(); return g ? g.readHit(x, y, frameOf(L, touch), page, pg | 0) : -2; };
/** How many pages a GUIDE page takes on this box (1 until the module is in). */
export const guidePages = (L, touch, page) => { const g = guideMod(); return g ? g.guideGeom(frameOf(L, touch), page).pages : 1; };

/* RECORDS' three tabs (SCORES, STATS, MEDALS) are src/render/pages/records.js (UI upgrade v202 Tasks 4.1 / 4.2), a lazy page (pages/lazy.js): until it
   lands they paint the LOADING plate and every hit is inert (-2, or "plate"). The entry names stay: shellview, the pointer and the tests call them. ui is
   the page's (records.js drawRecordsPage); L is layout(W, H, lg, css) for the box the page draws on, touch body[data-lay] p / l. */
const recMod = () => lazy.get("records");
const recDraw = (page) => (c, ui, L, t, touch) => {
  const m = lazyMod("records"), F = frameOf(L, touch);
  if (m) return m.drawRecordsPage(c, F, { ...ui, page }, t);
  return loadingPage(c, F, LABEL.RECORDS, ui || {}, "records");
};
export const drawScores = recDraw("scores"), drawStats = recDraw("stats"), drawTrophies = recDraw("medals");
/* The RECORDS tab under a tap, else -1; -2 while the page module is still loading (inert). */
export const recTabHit = (x, y, L, _page, touch) => { const m = recMod(); return m ? m.tabHit(x, y, frameOf(L, touch)) : -2; };
/* SCORES: the difficulty under a tap, -2 on the plate (inert), -1 off it or on the BACK key (main backs out). */
export const scoresHit = (x, y, L, touch, spage) => { const m = recMod(); return m ? m.scoresHit(x, y, frameOf(L, touch), spage | 0) : -2; }; // spage: the page shown (a split SCORES' bank answers on its first only)
/* STATS: a key code (KeyC / KeyR / KeyT), "back", "plate" (inert) or, armed, "cancel" (records.js statsHit); "plate" while loading. */
export const statsHit = (x, y, L, arm, _tabs, touch, spage) => { const m = recMod(); return m ? m.statsHit(x, y, frameOf(L, touch), arm, spage | 0) : "plate"; }; // spage: the page shown (a paged #c STATS keeps COPY / RESET on its last)
/* A RECORDS tab's page count on this box (records.js recPages: 1 where its body fits unpaged, and while the module loads); page scores | stats | medals. */
export const recPages = (L, touch, page, rows) => { const m = recMod(); return m ? m.recPages(frameOf(L, touch), page, rows) : 1; };
/* A RECORDS tab's page keys under a tap: -1 (▲), 1 (▼), else 0 (rows: SCORES' rows, whose count sets its pages). */
export const recPageHit = (x, y, L, touch, page, rows) => { const m = recMod(); return m ? m.pageKeyHit(x, y, frameOf(L, touch), page, rows) : 0; };

/* SETTINGS and GRAPHICS (SCREEN.SETTINGS / GRAPHICS; PAUSE views 1 and 2): the page is src/render/pages/settings.js (UI upgrade v202 Task 3.4),
   lazy (R20) through pages/lazy.js. These keep the entry names shellview, the pointer and the tests call, with the same arguments for draw and
   tap: L is layout(W, H, lg, css) for the box the page draws on (PAUSE: overlayBox's), touch body[data-lay] p / l (the draw reads ui.touch).
   Until the module is in: THE LOADING plate, -2 on it, -1 off it, *Geom null. ui is the page's (see its header); rows the visible list. */
const page = () => lazy.get("settings");
const setFrame = (L, touch) => ({ ...frameOf(L, touch), paused: !!L.paused, focus: L.focus });
/* kit/copy.js words (CONTROLS' foot reads FOOT_TAP too) */
export { FOOT_TAP, LOOK_NAME, lookVal };
const loadHit = (x, y, F) => { const B = loadBox(F); return x >= B.x && x < B.x + B.w && y >= B.y && y < B.y + B.h ? -2 : -1; };
/** SETTINGS' geometry for the visible rows (pages/settings.js settingsGeom on this box); null until the page is in. */
export const settingsGeom = (L, touch, rows) => { const m = page(); return m ? m.settingsGeom(setFrame(L, touch), rows) : null; };
export const graphicsGeom = (L, touch) => { const m = page(); return m ? m.graphicsGeom(setFrame(L, touch)) : null; };
/** A tap's index into rows (the visible list optRow indexes, R11); -2 inert on the plate, -1 off it (or on the phone's BACK). */
export const settingsHit = (x, y, L, rows, touch) => { const m = page(), F = setFrame(L, touch); return m ? m.settingsHit(x, y, F, rows) : loadHit(x, y, F); };
export const graphicsHit = (x, y, L, _n, touch) => { const m = page(), F = setFrame(L, touch); return m ? m.graphicsHit(x, y, F) : loadHit(x, y, F); };
export function drawSettings(c, L, t, ui) {
  const u = ui || {}, F = setFrame(L, u.touch), m = page();
  if (lazyMod("settings")) return m.drawSettingsPage(c, F, u, t);
  loadingPage(c, F, LABEL.SETTINGS, u, "settings");
}

/* RENDER row job states (v202 delivery, design 2026-11-06 "What the player
   sees"). The value slot carries the job of the look being prepared and a 2 px
   line along the band's bottom its honest fill; nothing reflows. app.lookJob =
   {k, state:"loading"|"preparing"|"ready"|"failed", phase, done, total} (fill /
   slow when jobs.js hands them); lookNote is the pure memo step shellview runs
   every frame: a live wait shows nothing new for NOTE_HOLD, a finished one that
   was shown reads READY for READY_T, a failure shows at once. */
export const NOTE_HOLD = 0.4, READY_T = 0.8;
const PH_ORDER = ["bake", "build", "shaders", "warm"];
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
/* GRAPHICS' rows arrive finished from the app (gfx.js owns every string; this file must not import src/app): ui = {row, view, togT, chg, kicker,
   touch, level, paused}; the page draws them (pages/settings.js drawGraphicsPage). */
export const GFX_N = 8; // pinned equal to gfx.js GFX_ROWS.length
export function drawGraphics(c, L, t, ui) {
  const u = ui || {}, F = setFrame(L, u.touch), m = page();
  if (lazyMod("settings")) return m.drawGraphicsPage(c, F, u, t);
  loadingPage(c, F, "GRAPHICS", u, "settings");
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
