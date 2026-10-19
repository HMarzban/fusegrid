/* MENU DRAWING LAYER — all menu/intro pixels as pure functions over a
   normalized layout valid at both 600x520 (2D) and 608x352 (3D). Reads only
   its args; never touches world/app state. Palette locked (spec §0/§2):
   accent #37f0d0, text #dfe7f5, muted #7385ad, veils rgba(7,10,18,a).
   Easing helpers duplicated from the intro beat table (spec §3) — this file
   must not import from src/app. */
import { roomCap } from "../core/config.js";
import { POWER, FOES } from "../core/entities.js";
import { HEAT_COL, HEAT_MARK, HEAT_NAME, clampHeat } from "../core/heat.js";
import { PACE_NAME } from "../core/pace.js";
import { pactLabel } from "../core/pact.js";
import { PACT, PACT_COL } from "../core/pact.js";
import { drawIcon, drawEnemyBody } from "./sprites.js";
import { rr } from "./icons.js";
import { pixelArt, itemCell, foeCell, pageScale, blitCell, SLOT_PAD } from "./pixel/hudart.js";
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
  EDGE = "#2a3550";
export const PLATE = "rgba(10,14,24,0.94)";
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
function shellBox(L, maxW) {
  const W = L.cx * 2;
  const w = Math.min(W - 40, maxW || 520);
  const x = L.cx - w / 2;
  const y = Math.max(12, L.top - 10);
  const h = L.footY - 8 - y;
  return {
    x,
    y,
    w,
    h,
    ix: x + 16,
    iy: y + 16,
    iw: w - 32,
    ih: h - 32,
    mid: x + w / 2,
    headY: y + 26,
    footY: y + h - 16,
  };
}
function shell(c, L, maxW) {
  const S = shellBox(L, maxW);
  plate(c, S.x, S.y, S.w, S.h);
  return S;
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
  c.fillStyle = TEXT;
  c.font = sans(18, "700");
  c.fillText(title, S.mid, S.headY + 8);
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
   page. o = {hero, danger, door, ext, touch, vc, glow}. Selection = a
   full-width 0.12 band, a 3px notch and the caret; label weight and size never
   jitter. danger rows (RESTART / QUIT) select in red, keeping the shape. */
export function paintRow(c, x, y, w, h, label, val, sel, o) {
  const p = o || {},
    col = p.danger ? DANGER : ACCENT,
    cy = y + h / 2;
  if (sel) {
    c.fillStyle = p.danger ? "rgba(255,93,115,0.12)" : "rgba(55,240,208,0.12)";
    c.fillRect(x, y, w, h);
    c.fillStyle = col;
    c.fillRect(x, y, 3, h);
    caret(c, x + 11, cy, h, col);
  }
  const size = Math.max(10, Math.min(p.hero ? (p.touch ? 22 : 20) : p.touch ? 17 : 15, Math.round(h * (p.hero ? 0.5 : 0.62))));
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
   {top, bot, w, pitch, hero, gap, pad, head, foot}. Pitches are CAPS: a band
   too short for them scales pitch / hero / gap down together. Hit bands are
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
  const room = p.bot - p.top - pad * 2 - hd - ft;
  const f = sum + gaps > 0 ? Math.min(1, room / (sum + gaps)) : 1;
  const h = Math.round(pad * 2 + hd + ft + (sum + gaps) * f);
  const w = Math.min(L.cx * 2 - 40, p.w || 380);
  const x = Math.round(L.cx - w / 2),
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

export function layout(W, H) {
  return Object.freeze({
    cx: W / 2,
    top: H * 0.16,
    logoCy: H * 0.27,
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

/* INTRO chrome (opening spec §3/§7). Title (stage 0): logo reveal (fade +
   slide 0.9 s) then a +-2 px bob on 16S, and a prompt that fades in from
   0.6 s and pulses 0.45<->1 on the beat (4S). Show (stage 1): logo and prompt
   exit up over 0.3 s, the veil drops 0.45 -> 0.12 by 8S, and the skip hint
   appears only past SKIP_GUARD. lay is body[data-lay] (p/l = touch copy);
   rk is the board-ready fraction: 0 paints an opaque veil (3D still loading),
   1 the stage veil. */
export function drawIntroChrome(c, stage, t, W, H, lay, rk = 1) {
  const L = layout(W, H),
    touch = lay === "p" || lay === "l",
    show = stage === 1;
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
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.lineJoin = "round";
    // FUSE: whole-word fade + slide (easeOutCubic)
    c.save();
    c.translate(L.cx, L.logoCy - 30 + slide);
    c.scale(L.logoScale, L.logoScale);
    c.globalAlpha *= a;
    c.font = font(34, "900");
    c.lineWidth = 34 * 0.14;
    c.strokeStyle = "#3a2a00";
    c.strokeText("FUSE", 0, 0);
    c.fillStyle = "#ffd447";
    c.fillText("FUSE", 0, 0);
    c.restore();
    const word = "GRID",
      size = 46,
      adv = size * 0.6 * L.logoScale;
    const x0 = L.cx - (word.length * adv) / 2 + adv / 2;
    for (let i = 0; i < word.length; i++) {
      const lt = show ? 1 : t - i * 0.06;
      const ka = easeOutCubic(seg(lt, 0, 0.5));
      if (ka <= 0) continue;
      const ks = 0.92 + 0.08 * easeOutBack(seg(lt, 0, 0.45));
      c.save();
      c.translate(x0 + i * adv, L.logoCy + 18 + slide);
      c.scale(L.logoScale * ks, L.logoScale * ks);
      c.globalAlpha *= a * ka;
      c.font = font(size, "900");
      c.lineWidth = size * 0.14;
      c.strokeStyle = "#3a0014";
      c.textAlign = "center";
      c.strokeText(word[i], 0, 0);
      c.fillStyle = "#ff5d73";
      c.fillText(word[i], 0, 0);
      c.restore();
    }
    c.restore();
  }
  const pin = show ? 1 - exit : easeOutCubic(seg(t, 0.6, TITLE_IN));
  if (pin > 0.01) {
    // touch copy is phone-sized: the stage scales to ~0.6 on a portrait phone
    const px = touch ? 26 : 18,
      prompt = touch ? "TAP TO START" : "PRESS ANY KEY";
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
      hint = touch ? "TAP TO SKIP" : "ANY KEY TO SKIP",
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
/* MENU entered at the show's natural end: the logo slams on the downbeat
   (1.35 -> 1, alpha 0 -> 1, easeOutBack, 0.12 s) while the blast plays
   unobstructed for 2S (hold): the plate and rows enter after it (enterT =
   subT - hold) and the dim ramps 0.12 -> 0.62 over the 0.35 s that follow.
   No white flash of its own. */
export function slamOf(t) {
  const hold = 2 * SHOW_STEP;
  return { dim: 0.12 + 0.5 * seg(t, hold, hold + 0.35), s: 1.35 - 0.35 * easeOutBack(seg(t, 0, 0.12)), a: seg(t, 0, 0.12), hold };
}

/* MAIN MENU over the dimmed frozen arena. ui={cursor,items,enterT,touch};
   item entries may carry a value token ("PLAY|L1 · CORE · NORM"). The row
   SHAPE (PLAY hero, group gaps before OPTIONS / HIGH SCORES / SOURCE) is a
   constant here, never read from items: main.js hit-tests with only n, so the
   painted and tapped rows come from the same table. Pitch 33 / hero 50 are
   caps; a short box (608x352) scales them down to the band. */
const MENU_DOOR = ["LEVEL SELECT", "OPTIONS", "GUIDE", "HIGH SCORES", "STATS"];
const menuShape = (n) => Array.from({ length: n }, (_, i) => ({ hero: i === 0, gapBefore: n === 8 && (i === 3 || i === 5 || i === 7) }));
export const MENU_PITCH = 33;
export function menuList(L, n) {
  const logoBot = L.logoCy + 10 * L.logoScale;
  return listGeom(L, menuShape(n), { top: Math.max(logoBot + 8, 8), bot: L.footY - 14, w: 380, pitch: MENU_PITCH, hero: 50, gap: 8, pad: 10 });
}
export function menuGeom(L, n) {
  const g = menuList(L, n);
  return { bx: g.x, y0: g.y, rw: g.w, h: g.h, span: g.span, padY: g.pad, rows: g.rows };
}
/* Settled rows only (no entrance slide): contiguous bands, half a group gap
   each side, full stage width, so no tap between or beside two rows falls
   through; above / below the list is -1 and main does nothing with it. */
export function menuHit(x, y, L, n) {
  return listHit(x, y, menuList(L, n), true);
}
/* STATS foot taps (T1): token zones over the one painted foot string at the
   0.6 em mono advance, half a separator wide each side. */
export function statsHit(x, y, L, arm) {
  const S = shellBox(L, 480),
    s = arm ? RESET_FOOT : STATS_FOOT,
    keys = arm ? ["KeyR", null, null, "KeyC"] : ["KeyT", "KeyC", "KeyR"];
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
export function drawMenu(c, ui, L, t) {
  const cur = (ui && ui.cursor) | 0;
  const items = (ui && ui.items) || [];
  const et = ui && typeof ui.enterT === "number" ? ui.enterT : t;
  const touch = !!(ui && ui.touch);
  const n = items.length;
  const g = menuList(L, n),
    shape = menuShape(n);
  // enterT < 0 holds the menu back (the show's blast reads first): nothing,
  // then the plate fades in over the last 0.12 s before the rows enter
  const pa = et < 0 ? clamp01(1 + et / 0.12) : 1;
  if (pa <= 0) return;
  c.globalAlpha = pa;
  plate(c, g.x, g.y, g.w, g.h);
  const rows = items.map((it, i) => {
    const str = String(it),
      pipe = str.indexOf("|"),
      label = pipe > 0 ? str.slice(0, pipe) : str,
      val = pipe > 0 ? str.slice(pipe + 1) : "",
      ext = label === "SOURCE";
    return {
      label,
      val: ext && i === cur ? "github.com/HMarzban/fusegrid" : val,
      hero: shape[i].hero,
      door: MENU_DOOR.indexOf(label) >= 0,
      ext,
      vc: label === "DAILY" && val === "NEW" ? ACCENT : null,
    };
  });
  drawList(c, g, rows, cur, t, { et, touch, alpha: pa });
  c.globalAlpha = pa;
  c.fillStyle = MUTED;
  c.font = font(10);
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(touch ? "TAP TO SELECT" : "↑↓ MOVE · ENTER SELECT", L.cx, L.footY);
  c.globalAlpha = 1;
}

/* MODES is a PRESENTATION relabel of the four Pact bits, so these names live
   here and core/pact.js keeps its own frozen name table and pactLabel's
   L/B/T/S letters — the HIGH SCORES p column and every pact.js pin depend on
   them. Same render-side duplication precedent as PLAQUE_NAME. IRON is a
   display name for PACT.LAST (applyPact sets lives = 1); BARE is PACT.BARE
   verbatim. TIME_COL is deliberately OUTSIDE PACT_COL so the fifth chip cannot
   read as a fifth Pact bit — that plus the 16px double gap are the two devices
   that enforce it. #ff8a3c is already the palette's FLAME colour. */
const MODE_NAME = ["IRON", "BARE", "THIN", "SHRINK"];
const TIME_COL = "#ff8a3c";

/* LEVEL SELECT chip rows, ONE table for draw and tap (levelHit): room chips
   (34 tall), heat tabs (26), pace tabs (22), then the four modes + TIME (22)
   once unlocked. */
export function levelGeom(L, unlocked) {
  const S = shellBox(L, 400),
    showPact = !!unlocked,
    rooms = roomCap(showPact),
    chipW = showPact ? 34 : L.chipW,
    chipGap = showPact ? 8 : L.chipGap,
    sx = S.mid - (rooms * chipW + (rooms - 1) * chipGap) / 2,
    cy = Math.round((S.headY + 28 + S.footY - 22) / 2 - (showPact ? 58 : 48)),
    hy = cy + 46,
    pzy = hy + 34,
    row = (n, w, g, y, h, gapAt) => Array.from({ length: n }, (_, i) => ({ x: S.mid - (n * w + (n - 1) * g + (gapAt ? 16 - g : 0)) / 2 + i * (w + g) + (gapAt && i >= gapAt ? 16 - g : 0), y, w, h }));
  return {
    S, chipW, cy, hy, pzy,
    room: row(rooms, chipW, chipGap, cy, 34),
    heat: row(3, 72, 10, hy, 26),
    pace: row(3, 60, 10, pzy, 22),
    mode: showPact ? row(5, 64, 6, pzy + 34, 22, 4) : [],
    sx,
  };
}
/* A tap on a LEVEL SELECT chip: {k:"room"|"heat"|"pace"|"mode", i}; any other
   tap inside the plate is {k:"start"}, outside it {k:"back"}. */
export function levelHit(x, y, L, unlocked) {
  const g = levelGeom(L, unlocked);
  for (const k of ["room", "heat", "pace", "mode"])
    for (let i = 0; i < g[k].length; i++) {
      const r = g[k][i];
      if (x >= r.x - 4 && x <= r.x + r.w + 4 && y >= r.y - 4 && y <= r.y + r.h + 4) return { k, i };
    }
  const S = g.S;
  return x >= S.x && x <= S.x + S.w && y >= S.y && y <= S.y + S.h ? { k: "start" } : { k: "back" };
}
/* LEVEL SELECT: five chips 44x34 gap 14; sel in 1..5. */
export function drawLevelSelect(c, sel, L, t, heat, pact, unlocked, pace, timeAttack) {
  const S = shell(c, L, 400);
  const h = heat | 0;
  let p = pace | 0;
  if (p < -1) p = -1;
  else if (p > 1) p = 1;
  const showPact = !!unlocked;
  head(c, S, "SELECT LEVEL", showPact ? "ROOM + HEAT + PACE + MODES" : "ROOM + HEAT + PACE");
  const G = levelGeom(L, showPact);
  const rooms = G.room.length;
  const chipW = G.chipW;
  const cy = G.cy;
  for (let i = 0; i < rooms; i++) {
    const x = G.room[i].x,
      on = i + 1 === sel;
    if (on) {
      c.fillStyle = "rgba(55,240,208,0.16)";
      c.fillRect(x, cy, chipW, 34);
    }
    c.strokeStyle = on ? ACCENT : LINE;
    c.lineWidth = on ? 2 : 1;
    c.strokeRect(x + 0.5, cy + 0.5, chipW - 1, 33);
    c.fillStyle = on ? ACCENT : TEXT;
    c.font = font(15, "900");
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(String(i + 1), x + chipW / 2, cy + 17);
  }
  const hw = 72,
    hy = G.hy;
  for (let i = 0; i < 3; i++) {
    const x = G.heat[i].x,
      on = i === h,
      col = HEAT_COL[i];
    if (on) {
      c.fillStyle = "rgba(55,240,208,0.12)";
      c.fillRect(x, hy, hw, 26);
    }
    c.strokeStyle = on ? col : LINE;
    c.lineWidth = on ? 2 : 1;
    c.strokeRect(x + 0.5, hy + 0.5, hw - 1, 25);
    c.fillStyle = on ? col : MUTED;
    c.font = font(11, on ? "900" : "");
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(HEAT_MARK[i] + " " + HEAT_NAME[i], x + hw / 2, hy + 13);
  }
  const pw2 = 60,
    pzy = G.pzy;
  for (let i = 0; i < 3; i++) {
    const x = G.pace[i].x,
      on = i === p + 1,
      col = on ? ACCENT : MUTED;
    if (on) {
      c.fillStyle = "rgba(55,240,208,0.12)";
      c.fillRect(x, pzy, pw2, 22);
    }
    c.strokeStyle = on ? ACCENT : LINE;
    c.lineWidth = on ? 2 : 1;
    c.strokeRect(x + 0.5, pzy + 0.5, pw2 - 1, 21);
    c.fillStyle = col;
    c.font = font(10, on ? "900" : "");
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(PACE_NAME[i], x + pw2 / 2, pzy + 11);
  }
  if (showPact) {
    const bits = [PACT.LAST, PACT.BARE, PACT.THIN, PACT.SHRINK];
    const pw = 64,
      py = pzy + 34;
    const mask = pact | 0;
    for (let i = 0; i < 4; i++) {
      const x = G.mode[i].x,
        on = (mask & bits[i]) !== 0,
        col = PACT_COL[i];
      if (on) {
        c.fillStyle = "rgba(55,240,208,0.12)";
        c.fillRect(x, py, pw, 22);
      }
      c.strokeStyle = on ? col : LINE;
      c.lineWidth = on ? 2 : 1;
      c.strokeRect(x + 0.5, py + 0.5, pw - 1, 21);
      c.fillStyle = on ? col : MUTED;
      c.font = font(10, on ? "900" : "");
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(i + 1 + " " + MODE_NAME[i], x + pw / 2, py + 11);
    }
    const tx = G.mode[4].x,
      ton = !!timeAttack;
    if (ton) {
      c.fillStyle = "rgba(55,240,208,0.12)";
      c.fillRect(tx, py, pw, 22);
    }
    c.strokeStyle = ton ? TIME_COL : LINE;
    c.lineWidth = ton ? 2 : 1;
    c.strokeRect(tx + 0.5, py + 0.5, pw - 1, 21);
    c.fillStyle = ton ? TIME_COL : MUTED;
    c.font = font(10, ton ? "900" : "");
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("5 TIME", tx + pw / 2, py + 11);
    c.fillStyle = MUTED;
    c.font = font(9, "");
    c.fillText("5 TIME ATTACK · stopwatch + per-room best", S.mid, py + 30);
  }
  foot(
    c,
    S,
    showPact
      ? "ENTER START · ←/→ ROOM · ↑/↓ HEAT · [ ] PACE · 1–5 MODES · ESC"
      : "ENTER START · ←/→ ROOM · ↑/↓ HEAT · [ ] PACE · ESC BACK",
  );
}

/* GUIDE art in PIXEL (W5, R19): kind "px" swaps only the scaled vector glyph
   for the atlas cell (pixel/hudart.js) at one integer scale per page; wells,
   rows and text are the same calls in every kind. */
const pxArt = (kind) => (kind === "px" ? pixelArt() : null);

/* HOW TO PLAY: control rows mirroring the page .hint, power-gate asterisks. */
export function drawHowTo(c, L, t, kind) {
  const S = shell(c, L, 520);
  head(c, S, "HOW TO PLAY", "CONTROLS");
  const rows = [
    ["WASD / ARROWS", "MOVE", null],
    ["SPACE", "BOMB", "bomb"],
    ["SHIFT + SPACE", "THROW *", "throw"],
    ["Q", "REMOTE *", "remote"],
    ["K + MOVE", "KICK *", "kick"],
    ["P", "PAUSE", null],
  ];
  const cols = 2,
    noteY = S.footY - 30;
  const y0 = S.headY + 22,
    avail = noteY - 10 - y0;
  const rh = Math.min(40, avail / 3);
  const cw = S.iw / cols;
  const A = pxArt(kind),
    pws = Math.min(22, Math.max(14, rh - 14)),
    ps = A ? pageScale(rows.filter((r) => r[2]).map((r) => itemCell(A, r[2])), pws + SLOT_PAD) : 1;
  for (let i = 0; i < rows.length; i++) {
    const col = i % cols,
      row = (i - col) / cols;
    const x = S.ix + col * cw,
      y = y0 + row * rh;
    c.fillStyle = "rgba(4,7,14,0.7)";
    c.fillRect(x, y, cw - 8, rh - 6);
    c.strokeStyle = LINE;
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, cw - 9, rh - 7);
    const kind = rows[i][2];
    const ws = Math.min(22, Math.max(14, rh - 14));
    let tx = x + 10;
    if (kind) {
      const p = POWER.find((d) => d.t === kind);
      const ix = x + 10 + ws / 2,
        iy = y + (rh - 6) / 2;
      well(c, ix, iy, ws, p && p.col);
      if (A) blitCell(c, itemCell(A, kind), ix, iy, ps);
      else {
        c.save();
        c.translate(ix, iy);
        c.scale((ws / 28) * 0.72, (ws / 28) * 0.72);
        drawIcon(c, kind, (p && p.col) || ACCENT, t);
        c.restore();
      }
      tx = x + ws + 16;
    }
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.fillStyle = ACCENT;
    c.font = font(9, "900");
    c.fillText(rows[i][0], tx, y + (rh - 6) / 2 - 6);
    c.fillStyle = TEXT;
    c.font = font(12);
    c.fillText(rows[i][1], tx, y + (rh - 6) / 2 + 8);
  }
  c.textAlign = "center";
  c.fillStyle = MUTED;
  c.font = font(9);
  c.fillText(
    "* needs its power-up  ·  ITEMS = cubes  ·  LEVEL = room + heat",
    S.mid,
    noteY,
  );
  c.fillStyle = ACCENT;
  c.font = font(10);
  c.fillText(
    "clear every enemy · gold wall never breaks",
    S.mid,
    noteY + 14,
  );
  foot(c, S, "ESC / ENTER BACK");
}

/* ITEMS: two-column catalog of every POWER pickup. */
export function drawItemsHelp(c, L, t, kind) {
  const S = shell(c, L, 560);
  head(c, S, "ITEMS", "PICKUPS");
  const n = POWER.length,
    cols = 2,
    rows = Math.ceil(n / cols);
  const gap = 7;
  const y0 = S.headY + 20,
    y1 = S.footY - 18;
  const cw = (S.iw - gap) / cols,
    ch = (y1 - y0) / rows - 3;
  const ws = Math.min(28, Math.max(16, ch - 8));
  const A = pxArt(kind),
    ps = A ? pageScale(POWER.map((p) => itemCell(A, p.t)), ws + SLOT_PAD) : 1;
  for (let i = 0; i < n; i++) {
    const p = POWER[i],
      col = i % cols,
      row = (i - col) / cols;
    const x = S.ix + col * (cw + gap),
      y = y0 + row * (ch + 3);
    c.fillStyle = "rgba(4,7,14,0.72)";
    c.fillRect(x, y, cw, ch);
    c.strokeStyle = LINE;
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
    const ix = x + 10 + ws / 2,
      iy = y + ch / 2;
    well(c, ix, iy, ws, p.col);
    if (A) blitCell(c, itemCell(A, p.t), ix, iy, ps);
    else {
      c.save();
      c.translate(ix, iy);
      c.scale((ws / 28) * 0.72, (ws / 28) * 0.72);
      drawIcon(c, p.t, p.col, t);
      c.restore();
    }
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.fillStyle = TEXT;
    c.font = font(ch < 32 ? 10 : 11, "900");
    c.fillText(p.name, x + ws + 18, y + ch / 2 - 6);
    c.fillStyle = MUTED;
    c.font = font(ch < 32 ? 8 : 9);
    c.fillText(p.help, x + ws + 18, y + ch / 2 + 8);
    if (p.permanent) {
      c.fillStyle = ACCENT;
      c.globalAlpha = 0.7;
      c.fillRect(x + cw - 3, y + 4, 2, ch - 8);
      c.globalAlpha = 1;
    }
  }
  foot(c, S, "WALK OVER A CUBE TO COLLECT · ESC BACK");
}

/* ENEMIES: 3-col field guide. Short canvas stacks well over name so all
   nine + ESC BACK stay inside the plate (HIGH SCORES inset). */
export function drawEnemiesHelp(c, L, t, kind) {
  const S = shell(c, L, 640);
  head(c, S, "ENEMIES", "FIELD GUIDE");
  const n = FOES.length,
    cols = n > 6 ? 3 : 2,
    rows = Math.ceil(n / cols);
  const gap = 6;
  const y0 = S.headY + 18,
    y1 = S.footY - 16;
  const cw = (S.iw - gap * (cols - 1)) / cols,
    ch = (y1 - y0) / rows - 2;
  const short = ch < 72;
  const ws = Math.min(short ? 22 : 32, Math.max(16, short ? ch - 20 : ch - 14));
  const dummy = {
    type: "walker",
    color: "#8affc1",
    r: 14,
    home: { x: 0, y: 0 },
    invuln: false,
  };
  const world = { time: t };
  const A = pxArt(kind),
    ps = A ? pageScale(FOES.map((f) => foeCell(A, f.t)), ws + SLOT_PAD) : 1;
  for (let i = 0; i < n; i++) {
    const f = FOES[i],
      col = i % cols,
      row = (i - col) / cols;
    const x = S.ix + col * (cw + gap),
      y = y0 + row * (ch + 2);
    c.fillStyle = "rgba(4,7,14,0.72)";
    c.fillRect(x, y, cw, ch);
    c.strokeStyle = LINE;
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
    dummy.type = f.t;
    dummy.color = f.col;
    if (short) {
      const ix = x + cw / 2,
        iy = y + 6 + ws / 2;
      well(c, ix, iy, ws);
      if (A) blitCell(c, foeCell(A, f.t), ix, iy, ps);
      else {
        c.save();
        c.translate(ix, iy);
        c.scale(ws / 30, ws / 30);
        drawEnemyBody(c, world, dummy);
        c.restore();
      }
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = TEXT;
      c.font = font(9, "900");
      c.fillText(f.name, x + cw / 2, y + ch - 14);
      c.fillStyle = ACCENT;
      c.globalAlpha = 0.75;
      c.font = font(7, "900");
      c.fillText("ROOMS " + f.rooms, x + cw / 2, y + ch - 5);
      c.globalAlpha = 1;
    } else {
      const ix = x + 10 + ws / 2,
        iy = y + ch / 2;
      well(c, ix, iy, ws);
      if (A) blitCell(c, foeCell(A, f.t), ix, iy, ps);
      else {
        c.save();
        c.translate(ix, iy);
        c.scale(ws / 30, ws / 30);
        drawEnemyBody(c, world, dummy);
        c.restore();
      }
      const tx = x + ws + 18,
        mid = y + ch / 2;
      c.textAlign = "left";
      c.textBaseline = "middle";
      c.fillStyle = TEXT;
      c.font = font(ch < 40 ? 10 : 12, "900");
      c.fillText(f.name, tx, mid - 11);
      c.fillStyle = MUTED;
      c.font = font(ch < 40 ? 8 : 9);
      c.fillText(f.help, tx, mid + 2);
      c.fillStyle = ACCENT;
      c.globalAlpha = 0.75;
      c.font = font(8, "900");
      c.fillText("ROOMS " + f.rooms, tx, mid + 15);
      c.globalAlpha = 1;
    }
  }
  foot(c, S, "ESC BACK");
}

/* GUIDE (folds HOW TO PLAY / ITEMS / ENEMIES one hop under MENU): a plain
   3-row list navigated exactly like MENU — own cursor, wraps both ways, tap
   confirms the row under the cursor. Not the SETTINGS knob model: these
   rows are doors to open, not values to adjust, so there is no value
   column. guideHit maps a tap the way menuHit does (full-width bands). */
const GUIDE_LABEL = ["HOW TO PLAY", "ITEMS", "ENEMIES"];
export function guideGeom(L) {
  const S = shellBox(L, 480);
  const y0 = S.headY + 26,
    y1 = S.footY - 14;
  return { S, y0, rowH: (y1 - y0) / 3 };
}
export function guideHit(x, y, L) {
  const g = guideGeom(L),
    i = Math.floor((y - g.y0) / g.rowH + 1e-9);
  return i >= 0 && i < 3 ? i : -1;
}
export function drawGuide(c, L, t, cursor) {
  const cur = cursor | 0;
  const S = shell(c, L, 480);
  head(c, S, "GUIDE", "HOW TO · ITEMS · ENEMIES");
  const g = guideGeom(L);
  for (let i = 0; i < 3; i++) {
    const y = g.y0 + i * g.rowH + g.rowH / 2;
    const bh = Math.min(g.rowH - 4, 48);
    paintRow(c, S.ix, y - bh / 2, S.iw, bh, GUIDE_LABEL[i], "", i === cur, { door: true });
  }
  foot(c, S, "↑↓ ROW · ENTER OPEN · ESC BACK");
}

/* Local cabinet plaques (plan 5): bit order matches src/app/plaques.js
   PLAQUE = {CLEAR:1,PLUS:2,MAX:4,CROWN:8} — this file must not import
   src/app, so the names are duplicated here rather than imported. */
const PLAQUE_NAME = ["CLEAR", "PLUS", "MAX", "CROWN"];

/* HIGH SCORES: CORE / PLUS / MAX heat tabs, four plaque chips (CLEAR / PLUS /
   MAX / CROWN — dim when locked) under the tabs, then RANK / SCORE / LEVEL /
   DATE, all fitted inside the plate. Row pitch is derived from the inner
   body, not L.tableY / L.rowH, so all ten runs plus tabs plus chips plus the
   in-plate foot stay inside the shell at 352 and 520. `scores` arrives
   already filtered by heat (scoresForHeat lives in src/app/highscores.js —
   this file must not import src/app); `heat` is only used for the tab
   highlight and the empty-tab label. `plaques` is the unlocked bitmask
   (src/app/plaques.js), reaching this draw through the same shell-router
   path as scores/heat — see shellview.js's getPlaques. */
const scoreTabs = (S) => ({ tabW: 64, tabGap: 8, tabH: 18, tabX0: S.mid - (3 * 64 + 2 * 8) / 2, tabY: S.headY + 18 });
/* HIGH SCORES heat tab under a tap (padded to a thumb), or -1. */
export function scoresHit(x, y, L) {
  const T = scoreTabs(shellBox(L, 480));
  if (y < T.tabY - 10 || y > T.tabY + T.tabH + 10) return -1;
  const i = Math.floor((x - T.tabX0 + T.tabGap / 2) / (T.tabW + T.tabGap));
  return i >= 0 && i < 3 ? i : -1;
}
export function drawScores(c, scores, L, t, heat, plaques) {
  const S = shell(c, L, 480);
  const h = clampHeat(heat);
  head(c, S, "HIGH SCORES", "BEST RUNS");
  const { tabW, tabGap, tabH, tabX0, tabY } = scoreTabs(S);
  for (let i = 0; i < 3; i++) {
    const x = tabX0 + i * (tabW + tabGap),
      on = i === h,
      col = HEAT_COL[i];
    if (on) {
      c.fillStyle = "rgba(55,240,208,0.12)";
      c.fillRect(x, tabY, tabW, tabH);
    }
    c.strokeStyle = on ? col : LINE;
    c.lineWidth = on ? 2 : 1;
    c.strokeRect(x + 0.5, tabY + 0.5, tabW - 1, tabH - 1);
    c.fillStyle = on ? col : MUTED;
    c.font = font(9, on ? "900" : "");
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(HEAT_NAME[i], x + tabW / 2, tabY + tabH / 2 + 1);
  }
  const pmask = plaques | 0;
  // Compact shells (H<520, e.g. the 608x352 3D projected box) reuse the
  // logoScale<1 signal layout() already derives from H (same test drawMenu's
  // logo scaling rides) to paint the four plaques inline on the tab row's
  // right side instead of a dedicated row, reclaiming that row's height for
  // the score table.
  const compact = L.logoScale < 1;
  let chipY, chipH;
  if (compact) {
    chipY = tabY;
    chipH = tabH;
    const cGap = 4,
      cX0 = tabX0 + 3 * tabW + 2 * tabGap + 10,
      cW = Math.max(16, (S.ix + S.iw - cX0 - 3 * cGap) / 4);
    for (let i = 0; i < 4; i++) {
      const x = cX0 + i * (cW + cGap),
        on = (pmask & (1 << i)) !== 0;
      if (on) {
        c.fillStyle = "rgba(55,240,208,0.14)";
        c.fillRect(x, chipY, cW, chipH);
      }
      c.globalAlpha = on ? 1 : 0.4;
      c.strokeStyle = on ? ACCENT : LINE;
      c.lineWidth = on ? 1.5 : 1;
      c.strokeRect(x + 0.5, chipY + 0.5, cW - 1, chipH - 1);
      c.fillStyle = on ? ACCENT : MUTED;
      c.font = font(7, on ? "900" : "");
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(PLAQUE_NAME[i], x + cW / 2, chipY + chipH / 2 + 1);
      c.globalAlpha = 1;
    }
  } else {
    const chipW = 74,
      chipGap = 8,
      chipTot = 4 * chipW + 3 * chipGap,
      chipX0 = S.mid - chipTot / 2;
    chipY = tabY + tabH + 8;
    chipH = 20;
    for (let i = 0; i < 4; i++) {
      const x = chipX0 + i * (chipW + chipGap),
        on = (pmask & (1 << i)) !== 0;
      if (on) {
        c.fillStyle = "rgba(55,240,208,0.14)";
        c.fillRect(x, chipY, chipW, chipH);
      }
      c.globalAlpha = on ? 1 : 0.4;
      c.strokeStyle = on ? ACCENT : LINE;
      c.lineWidth = on ? 2 : 1;
      c.strokeRect(x + 0.5, chipY + 0.5, chipW - 1, chipH - 1);
      c.fillStyle = on ? ACCENT : MUTED;
      c.font = font(9, on ? "900" : "");
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(PLAQUE_NAME[i], x + chipW / 2, chipY + chipH / 2 + 1);
      c.globalAlpha = 1;
    }
  }
  const list = Array.isArray(scores) ? scores : [];
  const nShow = Math.min(10, list.length);
  const bodyTop = chipY + chipH + 10,
    bodyBot = S.footY - 18;
  if (!nShow) {
    c.fillStyle = MUTED;
    c.font = font(12, "900");
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(
      "NO " + HEAT_NAME[h] + " RUNS YET",
      S.mid,
      (bodyTop + bodyBot) / 2,
    );
    foot(c, S, "← → HEAT · ESC BACK");
    return;
  }
  const slots = 1 + Math.max(1, nShow);
  const rowH = (bodyBot - bodyTop) / slots;
  const gap = 10;
  const cw = [32, 64, 40, 36, Math.max(56, S.iw - 32 - 64 - 40 - 36 - gap * 4)];
  const xs = [S.ix];
  for (let i = 0; i < 4; i++) xs.push(xs[i] + cw[i] + gap);
  const hy = bodyTop + rowH / 2;
  c.font = font(9, "900");
  c.fillStyle = MUTED;
  c.textAlign = "left";
  c.textBaseline = "middle";
  c.fillText("RANK", xs[0], hy);
  c.fillText("LV", xs[2], hy);
  c.fillText("PACT", xs[3], hy);
  c.fillText("DATE", xs[4], hy);
  c.textAlign = "right";
  c.fillText("SCORE", xs[1] + cw[1], hy);
  c.strokeStyle = LINE;
  c.beginPath();
  c.moveTo(S.ix, hy + rowH / 2 - 2);
  c.lineTo(S.ix + S.iw, hy + rowH / 2 - 2);
  c.stroke();
  for (let i = 0; i < nShow; i++) {
    const r = list[i],
      y = bodyTop + (i + 1.5) * rowH;
    if (i % 2 === 0) {
      c.fillStyle = "rgba(55,240,208,0.05)";
      c.fillRect(S.ix, y - rowH / 2, S.iw, rowH);
    }
    c.font = font(rowH < 18 ? 11 : 13);
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
  foot(c, S, "← → HEAT · ESC BACK");
}

const RESET_RED = "#ff5d73";
const STATS_FOOT = "T MEDALS · C COPY MY STATS · R RESET · ESC BACK";
const RESET_FOOT = "R AGAIN ERASES · ANY OTHER KEY CANCELS · KEEPS OPTIONS + PACE · C COPY";
const RESET_NOTES = Object.freeze([
  "ERASES SCORES · BESTS · TIMES · DAILY · MEDALS · PLAQUES · GHOSTS",
  "ERASES STATS + DAYS PLAYED · RELOCKS ROOMS 6-8 · PACTS · TIME ATTACK",
]);
/* STATS (R5): the drawScores scaffold — one plate, a head, a right-aligned
   value column, a rule, notes and a foot. ui={rows,notes} arrives already
   computed (app/stats.js), the same getter discipline scores and plaques use:
   this file must not import src/app. The rule after row 7 is what separates
   seven lifetime counters from three per-heat bests, so the screen reads as a
   cabinet and not as a debug dump — no JSON is ever painted here. A C copy
   note (endkeys toast {s,ok}) takes the kicker's slot above the headline, the
   WIN / LOSE overlay's place for it, clear of rows, notes and the tap foot. */
export function drawStats(c, L, t, ui, arm, toast) {
  const S = shell(c, L, 480);
  const tn = toast && toast.s;
  head(c, S, "STATS", tn ? "" : "YOUR CABINET");
  if (tn) {
    c.fillStyle = toast.ok ? ACCENT : RESET_RED;
    c.font = font(11, "900");
    c.fillText(toast.s, S.mid, S.headY - 9);
  }
  const rows = (ui && ui.rows) || [];
  const notes = arm ? RESET_NOTES : (ui && ui.notes) || [];
  const top = S.headY + 22,
    bot = S.footY - 42,
    n = rows.length || 10,
    rowH = (bot - top) / n;
  const size = rowH < 18 ? 11 : 13;
  c.textBaseline = "middle";
  for (let i = 0; i < rows.length; i++) {
    const y = top + (i + 0.5) * rowH;
    c.textAlign = "left";
    c.fillStyle = MUTED;
    c.font = font(9, "900");
    c.fillText(String(rows[i][0]), S.ix, y);
    c.textAlign = "right";
    c.fillStyle = TEXT;
    c.font = font(size);
    c.fillText(String(rows[i][1]), S.ix + S.iw, y);
  }
  const ry = top + (n - 3) * rowH;
  c.strokeStyle = LINE;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(S.ix, ry);
  c.lineTo(S.ix + S.iw, ry);
  c.stroke();
  c.fillStyle = arm ? RESET_RED : MUTED;
  c.font = font(10);
  c.textAlign = "center";
  for (let i = 0; i < notes.length && i < 2; i++)
    c.fillText(String(notes[i]), S.mid, S.footY - (notes.length - i) * 14 - 2);
  if (arm) foot(c, S, RESET_FOOT, RESET_RED);
  else foot(c, S, STATS_FOOT);
}

/* MEDALS (R6, SCREEN.TROPHIES): rows=[name, desc, on] arrive finished from
   app/medals.js — the names live only there, so a missing list paints eight
   name-free locked placeholders. Locked descriptions stay SHOWN: the page is
   the goal list. */
export function drawTrophies(c, L, t, rows) {
  const S = shell(c, L, 480);
  const r = rows || [];
  head(c, S, "MEDALS", r.filter((x) => x && x[2]).length + "/8");
  const top = S.headY + 22,
    rowH = (S.footY - 18 - top) / 8;
  c.textBaseline = "middle";
  for (let i = 0; i < 8; i++) {
    const [name, desc, on] = r[i] || ["—", "", false],
      y = top + (i + 0.5) * rowH;
    c.globalAlpha = on ? 1 : 0.45;
    c.textAlign = "left";
    c.fillStyle = on ? ACCENT : MUTED;
    c.font = font(11, "900");
    c.fillText(String(name), S.ix, y);
    c.textAlign = "right";
    c.fillStyle = on ? TEXT : MUTED;
    c.font = font(10);
    c.fillText(String(desc), S.ix + S.iw, y);
  }
  c.globalAlpha = 1;
  foot(c, S, "ENTER / ESC BACK TO STATS");
}

/* OPTIONS (spec §2): ten rows on LEVEL SELECT's adjust model — eight live
   knobs, the GRAPHICS door and RESET DEFAULTS.
   ui = {row, vals, r3d, px, togT, rev, door, touch}; vals is the nb.settings.v1 blob,
   rev is the build tag shellview derives from CACHE_NAME and door is the
   GRAPHICS preset value (`AUTO ›`) the app derives. Rows NEVER hide or
   reflow — the two 3D-only rows dim to 0.45 and read an em dash in CLASSIC 2D
   and PIXEL, so the list is the same ten lines in every kind. CAM_NAME
   mirrors camrig.js's CAM_PRESET order; this file must not import from
   src/render/three (the 2D path never loads three), so the names are
   duplicated here the way PLAQUE_NAME is. */
const CAM_NAME = ["STANDARD", "WIDE", "FAR"];
const OPT_LABEL = [
  "MUSIC",
  "SFX",
  "SOUND",
  "RENDER",
  "CAMERA",
  "BRIGHTNESS",
  "SCREEN SHAKE",
  "REDUCE FLASH",
  "GRAPHICS",
  "RESET DEFAULTS",
];
export const OPT_N = OPT_LABEL.length; // pinned equal to menuapp OPT_ROWS.length
/* OPTIONS and GRAPHICS share one foot; a touch layout has none of those keys,
   so it names the tap model both pages use (row = Enter, off the rows = back). */
export const FOOT_KEYS = "↑↓ ROW · ←→ ADJUST · ENTER CYCLE · ESC BACK", FOOT_TAP = "TAP A ROW TO CHANGE IT · TAP OUTSIDE TO GO BACK";
const OPT_3D = OPT_LABEL.map((s) => s === "CAMERA" || s === "BRIGHTNESS");
export function settingsRows(vals, r3d, px, door) {
  const v = vals || {};
  const on = (b) => (b ? "ON" : "OFF");
  return [
    String(v.mus | 0),
    String(v.sfx | 0),
    on(v.snd),
    r3d ? "REAL 3D" : px ? "PIXEL" : "CLASSIC 2D",
    CAM_NAME[Math.min(2, Math.max(0, v.cam | 0))],
    String(v.bri | 0),
    on(v.shk),
    on(v.flx),
    door || "›",
    "",
  ];
}
/* One source for the layout budget: the page draws it and settingsHit reads
   it, so a tap can never land on a row the plate did not paint. */
export function settingsGeom(L) {
  const S = shellBox(L, 520);
  const noteY = S.footY - 30;
  const y0 = S.headY + 22;
  return { S, noteY, y0, rowH: Math.min(30, (noteY - 10 - y0) / OPT_N) };
}
export function settingsHit(x, y, L) {
  const g = settingsGeom(L);
  if (x < g.S.ix || x > g.S.ix + g.S.iw) return -1;
  // +1e-9: a row boundary computed as g.y0 + n*g.rowH can land a hair under
  // the true multiple (float sum error), which floor() would misread as the
  // row above — full-pitch bands must stay contiguous with no dead gutter.
  const i = Math.floor((y - g.y0) / g.rowH + 1e-9);
  return i >= 0 && i < OPT_N ? i : -1;
}
export function drawSettings(c, L, t, ui) {
  const u = ui || {};
  const cur = u.row | 0,
    r3d = !!u.r3d;
  const vals = settingsRows(u.vals, r3d, !!u.px, u.door);
  const g = settingsGeom(L);
  const S = shell(c, L, 520);
  head(c, S, "OPTIONS", u.kicker || "BUILD " + (u.rev || ""));
  const fk =
    typeof u.togT === "number" && u.togT >= 0 ? 1 - clamp01((t - u.togT) / 0.12) : 0;
  for (let i = 0; i < OPT_N; i++) {
    const sel = i === cur,
      dim = OPT_3D[i] && !r3d;
    c.globalAlpha = dim ? 0.45 : 1;
    paintRow(c, S.ix, g.y0 + i * g.rowH + 1, S.iw, g.rowH - 2, OPT_LABEL[i], dim ? "—" : vals[i], sel, { touch: u.touch, vc: TEXT, glow: sel ? fk : 0 });
    c.globalAlpha = 1;
  }
  /* CONTROLS: one line, for the device in hand — HOW TO PLAY keeps the long
     form with icons. */
  c.textAlign = "center";
  c.fillStyle = MUTED;
  c.font = font(9);
  c.fillText(
    u.touch
      ? "TOUCH · LEFT PAD MOVES · RIGHT BUTTON BOMBS · TAP PAUSE PILL"
      : "MOVE WASD/ARROWS · BOMB SPACE · THROW SHIFT+SPACE · REMOTE Q · KICK K+MOVE · PAUSE P",
    S.mid,
    g.noteY + 7,
  );
  foot(c, S, u.touch ? FOOT_TAP : FOOT_KEYS);
}

/* GRAPHICS (unified spec 2026-10-10 §5): the OPTIONS look with eight rows
   and a two-line help area in place of CONTROLS. ui = {row, view, togT, chg,
   touch}; view = {rows:[{label,val,locked,help1,help2}]} arrives finished
   from the app (gfx.js owns every string — this file must not import
   src/app). chg is the bitmask of rows the last change touched, so a preset
   glows on every row it wrote. Locked rows dim to 0.45, read an em dash and
   stay focusable. touch (body[data-lay] p/l) grows the type 13 -> 15. */
export const GFX_N = 8; // pinned equal to gfx.js GFX_ROWS.length
export function graphicsGeom(L) {
  const S = shellBox(L, 520);
  const noteY = S.footY - 30;
  const y0 = S.headY + 22;
  return { S, noteY, y0, rowH: Math.min(36, (noteY - 10 - y0) / GFX_N) };
}
export function graphicsHit(x, y, L) {
  const g = graphicsGeom(L);
  if (x < g.S.ix || x > g.S.ix + g.S.iw) return -1;
  const i = Math.floor((y - g.y0) / g.rowH + 1e-9); // +1e-9: same contiguous-band guard as settingsHit
  return i >= 0 && i < GFX_N ? i : -1;
}
export function drawGraphics(c, L, t, ui) {
  const u = ui || {},
    rows = (u.view && u.view.rows) || [],
    cur = u.row | 0,
    chg = u.chg | 0,
    big = !!u.touch;
  const g = graphicsGeom(L);
  const S = shell(c, L, 520);
  head(c, S, "GRAPHICS", u.kicker || "PERFORMANCE · BATTERY");
  const fk =
    typeof u.togT === "number" && u.togT >= 0 ? 1 - clamp01((t - u.togT) / 0.12) : 0;
  for (let i = 0; i < GFX_N; i++) {
    const r = rows[i] || { label: "", val: "" };
    c.globalAlpha = r.locked ? 0.45 : 1;
    paintRow(c, S.ix, g.y0 + i * g.rowH + 1, S.iw, g.rowH - 2, r.label, r.locked ? "—" : String(r.val), i === cur, { touch: big, vc: TEXT, glow: fk > 0 && (chg >> i) & 1 ? fk : 0 });
    c.globalAlpha = 1;
  }
  const h = rows[cur] || {};
  c.textAlign = "center";
  c.fillStyle = MUTED;
  c.font = font(big ? 11 : 10);
  c.fillText(h.help1 || "", S.mid, g.noteY);
  c.fillStyle = TEXT;
  c.fillText(h.help2 || "", S.mid, g.noteY + 14);
  foot(c, S, big ? FOOT_TAP : FOOT_KEYS);
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
  c.fillText("DEMO — TAP TO PLAY", L.cx, L.footY);
}

/* Full-canvas veil washes. */
export function drawDim(c, alpha, W, H) {
  c.fillStyle = "rgba(7,10,18," + Math.max(0, Math.min(1, alpha)) + ")";
  c.fillRect(0, 0, W, H);
}
export function drawFade(c, k, W, H) {
  c.fillStyle = "rgba(7,10,18," + Math.max(0, Math.min(1, k)) + ")";
  c.fillRect(0, 0, W, H);
}
