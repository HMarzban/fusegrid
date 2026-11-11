/* MENU DRAWING LAYER — all menu/intro pixels as pure functions over a
   normalized layout valid at both 600x520 (2D) and 608x352 (3D). Reads only
   its args; never touches world/app state. Palette locked (spec §0/§2):
   accent #37f0d0, text #dfe7f5, muted #7385ad, veils rgba(7,10,18,a).
   Easing helpers duplicated from the intro beat table (spec §3) — this file
   must not import from src/app. */
import { CFG, roomCap, BIOMES, isFinale } from "../core/config.js";
import { POWER, FOES, helpOf } from "../core/entities.js";
import { HEAT_COL, HEAT_MARK, clampHeat, heatRoster, heatProfile } from "../core/heat.js";
import { pactLabel } from "../core/pact.js";
import { PACT_COL, applyPact } from "../core/pact.js";
import { DIFF, SPEED, MOD, MOD_BITS, TIME_TRIAL, LABEL, RECORD_TABS, diffTag, speedTag, runParts, levelsOf } from "./words.js";
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
/* Biome SCHEMATIC, never the room's layout (bricks are seeded): border and
   the fixed pillar lattice in wall, a floor0/floor1 checker and a fixed brickA
   scatter, all BIOMES hexes; 15x13 cells of ts px. */
const SCATTER = (q, r) => (q * 73 + r * 151 + q * r * 7) % 11 < 5 && q + r > 3;
export function schem(c, x, y, ts, b) {
  const a0 = c.globalAlpha;
  for (let r = 0; r < 13; r++)
    for (let q = 0; q < 15; q++) {
      const wall = q === 0 || r === 0 || q === 14 || r === 12 || (q % 2 === 0 && r % 2 === 0),
        brick = !wall && SCATTER(q, r);
      c.fillStyle = wall ? b.wall : brick ? b.brickA : (q + r) & 1 ? b.floor1 : b.floor0;
      c.fillRect(x + q * ts, y + r * ts, ts, ts);
      if (ts >= 6 && (wall || brick)) {
        c.globalAlpha = a0 * 0.55;
        c.fillStyle = wall ? b.wallHi : b.brickHi;
        c.fillRect(x + q * ts, y + r * ts, ts, 1);
        c.globalAlpha = a0;
        if (brick) {
          c.fillStyle = b.brickB;
          c.fillRect(x + q * ts, y + (r + 1) * ts - 2, ts, 2);
        }
      }
    }
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
/* heatRoster deduped to [{t, n}] in first-seen order. */
export function rosterOf(room, heat) {
  const out = [];
  for (const t of heatRoster(room, heat)) {
    const e = out.find((o) => o.t === t);
    if (e) e.n++;
    else out.push({ t, n: 1 });
  }
  return out;
}
/* The heat line, from heatProfile through applyPact (IRON reads LIVES 1). */
export function heatLine(heat, pact) {
  const h = clampHeat(heat),
    p = applyPact(heatProfile(h), pact | 0);
  return "LIVES " + p.lives + " · FUSE " + p.fuse + "s · SCORE ×" + (h + 1);
}
/* The FLOOR line (#24): the room's tile at this heat from the one copy source,
   "" in a room whose tile has no rule yet. Worded as the room's floor: a board
   may rarely drop its tile (V23). */
export function floorLine(room, heat) {
  const k = HOME[BIOMES[(room - 1) % BIOMES.length].name],
    help = TILE_HELP[k];
  return help ? "FLOOR " + TILE_NAME[k] + " · " + help[clampHeat(heat)] : "";
}
/* The ROOM CARD: what a room is, read-only, in a pane P. d = {room, heat,
   pact, best, k (heat pulse 0..1), locked, floor, tiles}. One card for LEVEL SELECT's
   pane and MENU's PLAY / LEVEL SELECT pane. d.floor (LEVEL SELECT, tile boards
   only) makes its room inside the card, never by moving a tap rect: keyboard
   gives the row by one schematic scale step (d.tiles, the page's flag, so the
   schematic keeps one size room to room), touch by a tighter foe list. */
function roomCard(c, P, d, touch, A, t) {
  const b = BIOMES[(d.room - 1) % BIOMES.length],
    fin = isFinale(d.room),
    x0 = P.x + 10,
    hy = P.y + (touch ? 16 : 14);
  cell(c, P);
  c.textBaseline = "middle";
  c.textAlign = "left";
  c.fillStyle = TEXT;
  c.font = sans(touch ? 18 : 15, "800");
  c.fillText(d.title || b.name, x0, hy);
  c.textAlign = "right";
  c.font = font(touch ? 12 : 10, "700");
  c.fillStyle = fin ? DANGER : MUTED;
  c.fillText(LABEL.LEVEL + " " + d.room + (fin ? " · FINALE" : ""), P.x + P.w - 10, hy);
  const ts = touch ? 6 : d.tiles ? 7 : 8,
    ty = P.y + (touch ? 32 : 28),
    tw = 15 * ts,
    th = 13 * ts;
  c.globalAlpha = d.locked ? 0.28 : 1;
  schem(c, x0, ty, ts, b);
  c.globalAlpha = 1;
  c.strokeStyle = EDGE;
  c.lineWidth = 1;
  c.strokeRect(x0 - 0.5, ty - 0.5, tw + 1, th + 1);
  const rx = x0 + tw + 10,
    rw = P.x + P.w - 10 - rx,
    hy2 = P.y + P.h - (touch ? 12 : 10),
    fp = touch ? 13 : 12,
    flFont = font(touch ? 11 : 9, "700");
  if (d.floor) c.font = flFont;
  const fcut = d.floor ? d.floor.indexOf(" · ") : -1,
    fl = !d.floor ? [] : mw(c, d.floor) <= P.w - 20 ? [d.floor] : [d.floor.slice(0, fcut), d.floor.slice(fcut + 3)], // too long for one row: the name, then its whole help string
    fy = hy2 - fl.length * fp;
  c.textAlign = "left";
  if (d.locked) {
    lockGlyph(c, x0 + tw / 2, ty + th / 2, touch ? 22 : 20, TEXT);
    c.fillStyle = TEXT;
    c.font = sans(touch ? 15 : 12, "700");
    wrap(c, "CLEAR LEVEL 5 TO OPEN", rw, 2).forEach((l, i) => c.fillText(l, rx, ty + 8 + i * (touch ? 18 : 15)));
    c.fillStyle = MUTED;
    c.font = font(touch ? 12 : 10, "700");
    c.fillText("SAND · VOID · CROWN", rx, ty + (touch ? 52 : 44));
    c.fillText("+ " + LABEL.MODIFIERS, rx, ty + (touch ? 70 : 59));
  } else {
    const ros = rosterOf(d.room, d.heat),
      cap = 5,
      show = ros.length > cap ? ros.slice(0, cap - 1) : ros,
      y0 = ty + (touch ? 26 : 22),
      lh = Math.min(touch ? 22 : 19, fl.length ? (fy - 12 - y0) / Math.max(1, show.length - (show.length < ros.length ? 0 : 1)) : 99);
    c.fillStyle = MUTED;
    c.font = font(touch ? 11 : 9, "700");
    c.fillText("YOU'LL MEET", rx, ty + 5);
    let yy = y0;
    for (const e of show) {
      foeAt(c, A, e.t, rx + 8, yy, Math.min(touch ? 20 : 17, lh), t);
      c.textAlign = "left";
      c.textBaseline = "middle";
      c.fillStyle = TEXT;
      c.font = sans(touch ? 14 : 12, "600");
      c.fillText(clip(c, FOE_OF[e.t].name, rw - 46), rx + 22, yy);
      c.textAlign = "right";
      c.fillStyle = MUTED;
      c.font = font(touch ? 13 : 11, "700");
      c.fillText("×" + e.n, rx + rw, yy);
      yy += lh;
    }
    if (show.length < ros.length) {
      c.textAlign = "left";
      c.fillStyle = MUTED;
      c.font = font(touch ? 12 : 10, "700");
      c.fillText("+" + (ros.length - show.length) + " MORE", rx + 22, yy);
    }
  }
  c.textAlign = "left";
  c.font = font(touch ? 13 : 11, "700");
  c.fillStyle = d.locked ? MUTED : d.best ? ACCENT : MUTED;
  const bl = d.locked ? "LOCKED" : d.best ? "✓ BEST " + d.best : d.open ? "NO TIME YET" : ""; // the empty-time line waits for TIME (MODES open); a saved best is a real record and always shows
  if (bl) c.fillText(bl, x0, ty + th + (touch ? 14 : 12));
  const k = d.k || 0;
  c.fillStyle = k > 0 ? ACCENT : TEXT;
  if (k > 0) {
    c.shadowColor = ACCENT;
    c.shadowBlur = 12 * k;
  }
  if (fl.length) {
    c.font = flFont;
    fl.forEach((l, i) => c.fillText(l, x0, fy + i * fp));
  }
  c.font = font(touch ? 13 : 10, "700");
  c.fillText(clip(c, heatLine(d.heat, d.pact), P.w - 20), x0, hy2);
  c.shadowBlur = 0;
}
/* A MODIFIERS chip: segs' own frame and type; a name too wide for its chip
   (NO FLOOR ITEMS) breaks at a space onto two lines, then steps down until both
   lines fit its width and height (the iso guard's chip is ~19 px tall). */
function chip(c, r, label, on, col, touch, fs) {
  const px = fs || (touch ? 14 : 11), wt = on ? "900" : "700", room = r.w - 6;
  c.font = font(px, wt);
  if (mw(c, label) <= room || label.indexOf(" ") < 0) return segs(c, [r], [label], on ? 0 : -1, [col], touch, fs);
  segs(c, [r], [""], on ? 0 : -1, [col], touch, fs);
  let best = null;
  for (let i = label.indexOf(" "); i > 0; i = label.indexOf(" ", i + 1)) {
    const two = [label.slice(0, i), label.slice(i + 1)], w = Math.max(mw(c, two[0]), mw(c, two[1]));
    if (!best || w < best.w) best = { two, w };
  }
  const L2 = best.two;
  fitFont(c, L2[0].length > L2[1].length ? L2[0] : L2[1], room, px, 8, wt);
  let k = parseFloat(/(\d+(?:\.\d+)?)px/.exec(c.font)[1]) || px;
  while (k > 8 && 2 * k + 1 > r.h - 2) c.font = font(--k, wt);
  const lh = k + 1;
  c.fillStyle = on ? col : MUTED;
  c.textAlign = "center";
  c.textBaseline = "middle";
  L2.forEach((l, i) => c.fillText(l, r.x + r.w / 2, r.y + r.h / 2 + (i - 0.5) * lh));
}
/* A run's setup for one value slot, longest first (fitVal / fitIn keep the
   first that fits): every setting named; the modifiers as a count; only what
   differs from a default run (the approved PLAY tag); the same with EXPERT
   bare; the same without the world, which the MENU pane beside the list
   already names. The words and the non-default filter are words.js runParts. */
export function setupVals(world, run) {
  const j = (a) => [world].concat(a).join(" · "), terse = runParts(run, { count: true, terse: true });
  return [j(runParts(run, { all: true })), j(runParts(run, { all: true, count: true })), j(runParts(run, { count: true })), j(terse), terse.join(" · ") || world];
}
/* The value slot beside a hero row's label (PLAY, START): paintRow's hero type. */
function heroRoom(c, w, h, label, touch) {
  c.font = sans(rowSize(h, { hero: true, touch }), "800");
  return w - 12 - 26 - mw(c, label) - 12;
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
/* The key / name cell at a control's left: keyboard prints its key under the
   name ("GAME SPEED [ ]"), touch only the name, each stepped down to fit the
   44 px cell (DIFFICULTY and GAME SPEED outgrew it; LEVEL SELECT's own redraw
   gives them room). */
function capCell(c, r, name, keyStr, touch, keyPx) {
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = MUTED;
  if (touch || !keyStr) {
    fitFont(c, name, r.w - 2, touch ? 13 : 10, 7, "700", sans);
    c.fillText(name, r.x + r.w / 2, r.y + r.h / 2);
    return;
  }
  fitFont(c, name, r.w - 2, 8, 6, "700");
  c.fillText(name, r.x + r.w / 2, r.y + r.h / 2 - 6);
  c.fillStyle = TEXT;
  c.font = font(keyPx || 11, "900");
  c.fillText(keyStr, r.x + r.w / 2, r.y + r.h / 2 + 6);
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
    css: css > 0 ? css : 1, // CSS px per box unit (the MENU phone column is laid out in CSS px)
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
   entry names shellview, the pointer and the tests call; L is layout(W, H, lg, css) for the box the page draws on, touch body[data-lay] p / l. */
const frameOf = (L, touch) => ({ W: L.W, H: L.H, touch: !!touch, shell: !!L.shell, css: L.css });
export const menuGeom = (L, _n, touch) => menuPage.menuGeom(frameOf(L, touch));
export const menuHit = (x, y, L, _n, touch) => menuPage.menuHit(x, y, frameOf(L, touch));
export const drawMenu = (c, ui, L, t) => menuPage.drawMenuPage(c, frameOf(L, ui && ui.touch), ui || {}, t);
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

/* MODIFIERS are a PRESENTATION relabel of the four Pact bits: their names come
   from words.js (MOD, keyed by PACT bit), and core/pact.js keeps its own frozen
   name table and pactLabel's L/B/T/S letters — the HIGH SCORES p column and
   every pact.js pin depend on them. ONE LIFE is PACT.LAST (applyPact sets
   lives = 1). TIME_COL is deliberately OUTSIDE PACT_COL so the fifth chip
   cannot read as a fifth Pact bit — that plus the 12px double gap are the two
   devices that enforce it. #ff8a3c is already the palette's FLAME colour.
   MODE_HELP says what the sim does with each bit (applyPact / sim.js
   advanceShrink). */
const MODE_BIT = MOD_BITS;
const MODE_NAME = MODE_BIT.map((b) => MOD[b]);
const MODE_HELP = [MOD[MODE_BIT[0]], MOD[MODE_BIT[1]], MOD[MODE_BIT[2]] + " in bricks", MOD[MODE_BIT[3]] + " walls close in from 25s"];
const TIME_HELP = TIME_TRIAL + " timer + per-level best"; // "stopwatch" no longer fits the pad help line on touch
const TIME_COL = "#ff8a3c";
const NO_FOCUS = () => -1;
let modeFocus = NO_FOCUS;
/** The LEVEL SELECT MODIFIERS chip a pad has focused, as a getter: -1 = none. Set once by main; shellview's info does not carry it. */
export function setModeFocus(f) { modeFocus = f || NO_FOCUS; }
export function modeFocusOf() { return modeFocus(); }
/* The MODIFIERS cap has no room for TRIGGERS + NORTH (44 px), so a pad reads them here. */
const PAD_MODE = "TRIGGERS PICK · NORTH TOGGLES";
const modeOne = (i) => (i < 4 ? MODE_HELP[i] : TIME_HELP); // one chip's help, in chip order
const padModeHelp = (i) => (i < 0 ? PAD_MODE : PAD_MODE + " · " + modeOne(i));
export function modeHelp(pact, time) {
  const on = MODE_HELP.filter((_, i) => (pact | 0) & MODE_BIT[i]);
  if (time) on.push(TIME_HELP);
  return on.length ? on.join(" · ") : "ONE LIFE · NO FLOOR ITEMS · FEWER ITEMS · WALLS CLOSE IN · STOPWATCH";
}

/* LEVEL SELECT (ATLAS): ONE table for draw and tap (levelHit). Top block: a
   4x2 grid of room tiles (always all 8; 6–8 dim + locked until the first
   CLEAR) beside the ROOM CARD pane. Then the HEAT | PACE segmented row, MODES
   + its help line once unlocked, and the START hero. heat / pace / mode stay
   separate rect arrays (the headless taps read them). Keyboard: top 168,
   rows 30, hero 40, gaps 6; touch: 180 / 52 / 70. */
export function levelGeom(L, unlocked, touch) {
  if (L.narrow) return levelNarrow(L, !!unlocked, !!touch);
  const T = !!touch,
    U = !!unlocked,
    top = T ? 180 : 168,
    segH = T ? 52 : 30,
    heroH = T ? 70 : 40,
    gap = 6,
    helpH = U ? (T ? 20 : 14) : 0,
    capH = T ? 18 : 14,
    body = top + gap + segH + (U ? gap + segH + helpH : 0) + gap + heroH,
    S = pageBox(L, 560, body, T),
    f = S.f,
    tw = 62,
    tg = 4,
    th = ((top - capH - tg) / 2) * f,
    by = S.by;
  const room = Array.from({ length: 8 }, (_, i) => ({ x: S.ix + (i % 4) * (tw + tg), y: by + capH * f + (i >> 2) * (th + tg * f), w: tw, h: th }));
  const grid = { x: S.ix, y: by, w: 4 * tw + 3 * tg, h: top * f },
    pane = { x: S.ix + grid.w + 8, y: by, w: S.iw - grid.w - 8, h: top * f };
  let y = by + (top + gap) * f;
  const sh = segH * f,
    sw = 70,
    heatCap = { x: S.ix, y, w: 44, h: sh },
    heat = [0, 1, 2].map((i) => ({ x: S.ix + 48 + i * sw, y, w: sw, h: sh })),
    paceCap = { x: S.ix + 48 + 3 * sw + 12, y, w: 44, h: sh },
    pace = [0, 1, 2].map((i) => ({ x: paceCap.x + 48 + i * sw, y, w: sw, h: sh }));
  y += (segH + gap) * f;
  let mode = [],
    modeCap = null,
    help = null;
  if (U) {
    const mw2 = (S.iw - 48 - 4 * 4 - 12) / 5;
    modeCap = { x: S.ix, y, w: 44, h: sh };
    mode = [0, 1, 2, 3, 4].map((i) => ({ x: S.ix + 48 + i * (mw2 + 4) + (i >= 4 ? 12 : 0), y, w: mw2, h: sh }));
    help = { x: S.ix, y: y + sh, w: S.iw, h: helpH * f };
    y += (segH + helpH + gap) * f;
  }
  const start = { x: S.ix - 8, y, w: S.iw + 16, h: heroH * f };
  return { S, f, grid, pane, room, heatCap, heat, paceCap, pace, modeCap, mode, help, start, rows: focusRows(f, grid, heatCap, heat, paceCap, pace, modeCap, mode, help, start), capY: by + (capH * f) / 2, cap: roomCap(U) };
}
/* LEVEL SELECT's rows by name: menuapp LEVEL_ROWS, which words.test pins equal to these words (this file may not import
   src/app). shellview hands drawLevelSelect the focused row's name, never an index. */
const LV = Object.freeze({ LEVEL: LABEL.LEVEL, DIFF: LABEL.DIFFICULTY, SPEED: LABEL.GAME_SPEED, MODS: LABEL.MODIFIERS, START: LABEL.START });
/* The focus mark's rect per LEVEL SELECT row, keyed by its name (v202 Task 2.3). A group's ring sits half the row gap outside
   it, at most 3 px, so its 2 px paint stays 2 px clear of a selected segment's own 2 px stroke and clear of every neighbour
   row: the level grid with its caption, a cap and its segments, the MODIFIERS cap, chips and their help line (null until
   modifiers are offered); START is its painted hero band. A chip's ring stays today's 2 px. */
const ringOf = (r, o) => ({ x: r.x - o, y: r.y - o, w: r.w + 2 * o, h: r.h + 2 * o });
const spanOf = (a, b, c) => ({ x: a.x, y: a.y, w: b.x + b.w - a.x, h: (c || b).y + (c || b).h - a.y });
function focusRows(f, grid, heatCap, heat, paceCap, pace, modeCap, mode, help, start) {
  const o = Math.min(3, 3 * f);
  return Object.freeze({
    [LV.LEVEL]: ringOf(grid, o),
    [LV.DIFF]: ringOf(spanOf(heatCap, heat[2]), o),
    [LV.SPEED]: ringOf(spanOf(paceCap, pace[2]), o),
    [LV.MODS]: modeCap ? ringOf(spanOf(modeCap, mode[4], help), o) : null,
    [LV.START]: { x: start.x + 8, y: start.y + 2, w: start.w - 16, h: start.h - 4 },
  });
}
/** Where LEVEL SELECT's focus mark is drawn: the open list's chip (a ring like a row's), else the named row's rect. */
export function levelMark(G, row, open, cur) {
  return open && G.mode[cur] ? ringOf(G.mode[cur], 2) : G.rows[row] || null;
}
/* The ring: today's chip-focus outline, 2 px TEXT, on every focus target but START (its own hero band). */
function focusRing(c, r) {
  c.strokeStyle = TEXT;
  c.lineWidth = 2;
  c.strokeRect(r.x, r.y, r.w, r.h);
}
/** LEVEL SELECT's foot follows the focus: ↑↓ walk the rows, ←→ change LEVEL / DIFFICULTY / GAME SPEED, confirm starts the run
    (opens the list on MODIFIERS); in the open list ↑↓ pick, confirm toggles, back closes it. Keys and controller words. */
export function levelFoot(row, open) {
  const W = hints();
  if (open) return "↑↓ PICK · " + W.ok + " TOGGLE · " + W.back + " " + LABEL.CLOSE;
  const value = row !== LV.MODS && row !== LV.START; // LEVEL, DIFFICULTY, GAME SPEED change on ←→
  return "↑↓ ROW · " + (value ? "←→ ADJUST · " : "") + W.ok + (row === LV.MODS ? " OPEN" : " " + LV.START) + " · " + W.back + " BACK";
}
/* The narrow box (touch-portrait shell, < 560 wide): the same rects
   stacked — the room grid across the plate, the ROOM CARD under it, HEAT and
   PACE on their own rows, MODES (5 chips, cap cell kept), help, START. */
function levelNarrow(L, U, T) {
  const capH = T ? 18 : 14, th = T ? 70 : 56, tg = 4, cardH = T ? 172 : 150, segH = T ? 52 : 30, heroH = T ? 70 : 40, gap = 6, helpH = U ? 32 : 0, capW = 60,
    body = capH + 2 * th + tg + gap + cardH + gap + segH + gap + segH + (U ? gap + segH + helpH : 0) + gap + heroH,
    S = pageBox(L, 560, body, T),
    f = S.f,
    by = S.by,
    tw = (S.iw - 3 * tg) / 4,
    room = Array.from({ length: 8 }, (_, i) => ({ x: S.ix + (i % 4) * (tw + tg), y: by + capH * f + (i >> 2) * (th + tg) * f, w: tw, h: th * f })),
    grid = { x: S.ix, y: by, w: S.iw, h: (capH + 2 * th + tg) * f };
  let y = grid.y + grid.h + gap * f;
  const pane = { x: S.ix, y, w: S.iw, h: cardH * f },
    sh = segH * f,
    row = (n, yy) => { const w = (S.iw - capW - 4 - (n - 1) * 4) / n; return Array.from({ length: n }, (_, i) => ({ x: S.ix + capW + 4 + i * (w + 4), y: yy, w, h: sh })); };
  y += (cardH + gap) * f;
  const heatCap = { x: S.ix, y, w: capW, h: sh }, heat = row(3, y);
  y += (segH + gap) * f;
  const paceCap = { x: S.ix, y, w: capW, h: sh }, pace = row(3, y);
  y += (segH + gap) * f;
  let mode = [], modeCap = null, help = null;
  if (U) {
    modeCap = { x: S.ix, y, w: capW, h: sh };
    mode = row(5, y);
    help = { x: S.ix, y: y + sh, w: S.iw, h: helpH * f };
    y += (segH + helpH + gap) * f;
  }
  const start = { x: S.ix - 8, y, w: S.iw + 16, h: heroH * f };
  return { S, f, grid, pane, room, heatCap, heat, paceCap, pace, modeCap, mode, help, start, rows: focusRows(f, grid, heatCap, heat, paceCap, pace, modeCap, mode, help, start), capY: by + (capH * f) / 2, cap: roomCap(U), narrow: true };
}
/* A tap on LEVEL SELECT: {k:"room"|"heat"|"pace"|"mode", i}, {k:"lock", i}
   on a locked room (main shows its card, never sets app.level), {k:"start"}
   on START, {k:"back"} off the plate, {k:"none"} anywhere else on it — a
   miss never starts a run (C3). Gutters split half to each neighbour. */
export function levelHit(x, y, L, unlocked, touch) {
  const g = levelGeom(L, unlocked, touch);
  for (let i = 0; i < 8; i++) if (inR(g.room[i], x, y, 2)) return i < g.cap ? { k: "room", i } : { k: "lock", i };
  for (const k of ["heat", "pace", "mode"]) for (let i = 0; i < g[k].length; i++) if (inR(g[k][i], x, y, 3)) return { k, i };
  if (inR(g.start, x, y, 3)) return { k: "start" };
  const S = g.S;
  return x >= S.x && x <= S.x + S.w && y >= S.y && y <= S.y + S.h ? { k: "none" } : { k: "back" };
}
/* touch swaps the key foot for the tap rule levelHit implements (main.js). */
export const LEVEL_TAP = "TAP START TO PLAY · TAP OUTSIDE TO GO BACK";
/* the same with the MODIFIERS list open (opened by keys on a touch layout): a tap off the plate closes it first */
export const LEVEL_TAP_LIST = "TAP START TO PLAY · TAP OUTSIDE TO " + LABEL.CLOSE;
/* info = {kind, best:[8 strings|null] at this heat/pace/modes, heatT, lockR,
   lockT, row, open, cur} from shellview (times arrive formatted; this file never reads a
   store). row / open / cur: the focused row (LEVEL when absent), the MODIFIERS list open and its cursor (v202 Task 2.3). */
export function drawLevelSelect(c, sel, L, t, heat, pact, unlocked, pace, timeAttack, touch, info) {
  const I = info || {},
    T = !!touch,
    W = hints(),
    onPad = W.dev === "pad",
    U = !!unlocked,
    G = levelGeom(L, U, T),
    S = G.S,
    h = clampHeat(heat),
    mask = U ? pact | 0 : 0,
    A = pxArt(I.kind),
    best = I.best || [],
    row = I.row || LV.LEVEL,
    open = !!I.open && U,
    tap = tapMode(T); // tap mode: no focus is shown (a tap has none); keys, or a controller on a touch layout, run the focus model
  let p = pace | 0;
  if (p < -1) p = -1;
  else if (p > 1) p = 1;
  boxPlate(c, S);
  head(c, S, LABEL.LEVEL_SELECT, U ? "8 " + LABEL.LEVELS + " · " + LABEL.MODIFIERS + " OPEN" : "5 " + LABEL.LEVELS + " · 3 LOCKED");
  c.textAlign = "left";
  c.textBaseline = "middle";
  c.fillStyle = MUTED;
  c.font = T ? sans(13, "700") : font(9, "700");
  c.fillText(tapMode(T) ? "TAP A LEVEL" : LABEL.LEVEL, G.grid.x, G.capY); // a cap names only keys that work from any row ([ ], 1–5); ←→ live in the foot
  const ts = G.f < 0.8 ? 2 : 3;
  for (let i = 0; i < 8; i++) {
    const r = G.room[i],
      on = i + 1 === sel,
      lock = i >= G.cap,
      b = BIOMES[i];
    cell(c, r, 0.6);
    if (on) {
      c.fillStyle = "rgba(55,240,208,0.12)";
      c.fillRect(r.x, r.y, r.w, r.h);
    }
    c.globalAlpha = lock ? 0.25 : 1;
    schem(c, r.x + (r.w - 15 * ts) / 2, r.y + 6, ts, b);
    c.globalAlpha = 1;
    const ny = r.y + 6 + 13 * ts + (r.h - 6 - 13 * ts) / 2;
    if (lock) lockGlyph(c, r.x + r.w / 2, r.y + 6 + 6.5 * ts, 16, TEXT);
    c.textAlign = "center";
    c.fillStyle = on ? ACCENT : lock ? MUTED : TEXT;
    c.font = font(T ? 16 : 14, "900");
    c.fillText(String(i + 1), r.x + r.w / 2, ny);
    if (isFinale(i + 1)) {
      c.fillStyle = DANGER;
      c.fillRect(r.x + 6, ny - 2, 4, 4);
    }
    if (best[i] && !lock) {
      c.textAlign = "right";
      c.fillStyle = ACCENT;
      c.font = font(11, "900");
      c.fillText("✓", r.x + r.w - 6, ny);
    }
    c.strokeStyle = on ? ACCENT : LINE;
    c.lineWidth = on ? 2 : 1;
    c.strokeRect(r.x + (on ? 1 : 0.5), r.y + (on ? 1 : 0.5), r.w - (on ? 2 : 1), r.h - (on ? 2 : 1));
    if (on) {
      c.fillStyle = ACCENT;
      c.fillRect(r.x, r.y + r.h - 3, r.w, 3);
    }
  }
  const peek = I.lockR && typeof I.lockT === "number" && t - I.lockT >= 0 && t - I.lockT < 1.8 ? I.lockR : 0,
    hk = typeof I.heatT === "number" && t - I.heatT >= 0 ? 1 - clamp01((t - I.heatT) / 0.45) : 0;
  roomCard(c, G.pane, peek ? { room: peek, heat: h, pact: mask, locked: true, tiles: !!I.tiles } : { room: sel, heat: h, pact: mask, best: best[sel - 1], k: hk, open: U, tiles: !!I.tiles, floor: I.tiles ? floorLine(sel, h) : "" }, T, A, t);
  capCell(c, G.heatCap, LABEL.DIFFICULTY, "", T);
  segs(c, G.heat, DIFF, h, HEAT_COL.map((x, i) => (i ? x : TEXT)), T);
  capCell(c, G.paceCap, LABEL.GAME_SPEED, W.tab, T, onPad ? 8 : 0); // SHOULDERS only fits the 44 px cap at 8 px
  segs(c, G.pace, SPEED, p + 1, null, T);
  if (U) {
    capCell(c, G.modeCap, LABEL.MODIFIERS, onPad ? "" : "1–5", T);
    for (let i = 0; i < 5; i++) {
      const r = G.mode[i],
        on = i < 4 ? (mask & MODE_BIT[i]) !== 0 : !!timeAttack;
      chip(c, r, ((G.narrow && T) || onPad ? "" : i + 1 + " ") + (i < 4 ? MODE_NAME[i] : TIME_TRIAL), on, i < 4 ? PACT_COL[i] : TIME_COL, T, G.narrow ? 12 : 0); // a narrow touch chip drops the key digit
    }
    const cur = open ? I.cur | 0 : -1, trig = onPad ? modeFocus() : -1,
      help = open ? (onPad ? padModeHelp(cur) : modeOne(cur)) : onPad ? padModeHelp(trig) : modeHelp(mask, timeAttack), // the open list describes its focused entry
      ring = open ? cur : row !== LV.MODS ? trig : -1; // the open list's cursor; a controller's TRIGGER cursor, unless the MODIFIERS row's own ring is on (they share edges)
    if (ring >= 0 && G.mode[ring]) focusRing(c, ringOf(G.mode[ring], 2)); // a shape, so it reads apart from an on chip's own outline
    c.textAlign = "center";
    c.fillStyle = MUTED;
    if (G.narrow) {
      c.font = font(11, "700");
      const hl = wrap(c, help, S.iw, 2);
      hl.forEach((l, i) => c.fillText(l, S.mid, G.help.y + G.help.h / 2 + 1 + (i - (hl.length - 1) / 2) * 13));
    } else {
      c.font = font(T ? 13 : 10, "700");
      c.fillText(clip(c, help, S.iw), S.mid, G.help.y + G.help.h / 2 + 1);
    }
  }
  const st = G.start,
    tag = fitVal(c, setupVals(BIOMES[sel - 1].name, { heat: h, pace: p, pact: mask, time: U && timeAttack }), heroRoom(c, st.w - 16, st.h - 4, "START", T));
  paintRow(c, st.x + 8, st.y + 2, st.w - 16, st.h - 4, LV.START, tag, tap || (!open && row === LV.START), { hero: true, touch: T }); // lit in tap mode (the page's one action), else only while focused
  if (!tap && !open && row !== LV.START && G.rows[row]) focusRing(c, G.rows[row]);
  foot(c, S, tap ? (open ? LEVEL_TAP_LIST : LEVEL_TAP) : levelFoot(row, open));
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

/* SETTINGS (SCREEN.SETTINGS, spec §2; design record §4): the rows on LEVEL SELECT's adjust model — the live knobs,
   ANALYTICS (the GA consent, its own store), the GRAPHICS and CONTROLS doors and RESET DEFAULTS.
   ui = {rows, row, vals, r3d, px, togT, rev, door, ctlDoor, ana, anaNote, touch}; rows is the visible list the app hands
   in (menuapp optRows: CAMERA and BRIGHTNESS only while ART STYLE is REAL 3D) and row the focused row's LABEL, never an
   index (this file cannot import src/app); vals is the nb.settings.v1 blob,
   rev is the build tag shellview derives from CACHE_NAME, door is the
   GRAPHICS preset value (`AUTO ›`) the app derives, ctlDoor is the last-used
   device (`KEYBOARD ›`), padVib is the VIBRATION level while a pad with an
   actuator is connected (the door reads it where it fits) and anaNote is why the ANALYTICS row did nothing on a
   pad, shown as that row's value. CAM_NAME
   mirrors camrig.js's CAM_PRESET order; this file must not import from
   src/render/three (the 2D path never loads three), so the names are
   duplicated here the way PLAQUE_NAME is. */
const CAM_NAME = ["STANDARD", "WIDE", "FAR"];
/* OPTIONS and GRAPHICS share one foot; a touch layout has none of those keys,
   so it names the tap model both pages use (row = Enter, off the plate = back). */
export const FOOT_KEYS = "↑↓ ROW · ←→ ADJUST · ENTER CYCLE · ESC BACK", FOOT_TAP = "TAP A ROW TO CHANGE IT · TAP OUTSIDE TO GO BACK";
const footKeys = () => "↑↓ ROW · ←→ ADJUST · " + hints().ok + " CYCLE · " + hints().back + " BACK";
/* Each row's value by its label, aligned with rows (the visible list); a label it does not know reads empty. */
export function settingsRows(rows, vals, r3d, px, door, ana, ctlDoor) {
  const v = vals || {};
  const on = (b) => (b ? "ON" : "OFF");
  const by = {
    MUSIC: String(v.mus | 0),
    SFX: String(v.sfx | 0),
    SOUND: on(v.snd),
    [LABEL.ART_STYLE]: r3d ? "REAL 3D" : px ? "PIXEL" : "CLASSIC 2D",
    CAMERA: CAM_NAME[Math.min(2, Math.max(0, v.cam | 0))],
    BRIGHTNESS: String(v.bri | 0),
    "SCREEN SHAKE": on(v.shk),
    "REDUCE FLASH": on(v.flx),
    ANALYTICS: on(ana),
    GRAPHICS: door || "›",
    CONTROLS: ctlDoor || "›",
    "RESET DEFAULTS": "",
  };
  return (rows || []).map((r) => by[r] || "");
}
/* One source for the layout budget (a hugging plate, default pitch 28 keyboard
   / 41 touch; SETTINGS is 27 keyboard and, touch, 37 where its rows fit
   the band, else 34 so twelve fit the 520 band unscaled): the page draws it and settingsHit / graphicsHit read it, so a tap
   can never land on a row the plate did not paint. note = the line under the
   rows (GRAPHICS' two-line help). SETTINGS sizes to the visible list it is handed. */
function rowsGeom(L, n, note, touch, tp, kp) {
  const T = !!touch,
    pitch = T ? tp || 41 : kp || 28,
    S = pageBox(L, 500, n * pitch + note, T),
    rowH = pitch * S.f;
  return { S, y0: S.by, rowH, noteY: S.by + n * rowH + 6, n };
}
const rowsN = (rows) => (rows && rows.length) | 0;
const optTouchPitch = (L, n) => { const B = bandOf(L, true); return n * 37 <= B.bot - B.top - CHROME ? 37 : 34; };
/** SETTINGS' geometry for the visible rows (the app's optRows): the page draws it, settingsHit reads it. */
export const settingsGeom = (L, touch, rows) => rowsGeom(L, rowsN(rows), 0, touch, optTouchPitch(L, rowsN(rows)), 27);
export const graphicsGeom = (L, touch) => rowsGeom(L, GFX_N, 32, touch);
/* Row index under a tap; -2 = on the plate but off the rows (inert), -1 =
   off the plate (main backs out). Bands are contiguous: +1e-9 keeps a
   boundary computed as y0 + n*rowH (float sum error) on the row below it. */
function rowsHit(x, y, g) {
  const S = g.S;
  if (x >= S.ix - 8 && x <= S.ix + S.iw + 8) { // the painted row band (paintRow at S.ix-8 .. +8)
    const i = Math.floor((y - g.y0) / g.rowH + 1e-9);
    if (i >= 0 && i < g.n) return i;
  }
  return x >= S.x && x <= S.x + S.w && y >= S.y && y <= S.y + S.h ? -2 : -1;
}
/** A tap's index into rows (the visible list optRow indexes, R11); -2 inert on the plate, -1 off it. */
export const settingsHit = (x, y, L, rows, touch) => rowsHit(x, y, settingsGeom(L, touch, rows));
export const graphicsHit = (x, y, L, _n, touch) => rowsHit(x, y, graphicsGeom(L, touch));
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
/* The value slot beside a label: paintRow's own type, no door mark. */
export function valueRoom(c, w, h, label, touch) {
  c.font = sans(rowSize(h, { touch }), "600");
  return w - 12 - 26 - mw(c, label) - 12;
}
export function fitVal(c, cands, room) {
  c.font = font(12);
  for (const s of cands) if (mw(c, s) <= room) return s;
  return clip(c, cands[cands.length - 1], room);
}
/* 2 px along the band's bottom, past the notch: the fill, or still stripes. */
function jobLine(c, x, y, w, f) {
  c.fillStyle = LINE;
  c.fillRect(x, y, w, 2);
  c.fillStyle = ACCENT;
  if (f < 0) for (let xx = x; xx < x + w; xx += 8) c.fillRect(xx, y, Math.min(4, x + w - xx), 2);
  else if (f > 0) c.fillRect(x, y, Math.round(w * Math.min(1, f)), 2);
}
export function drawSettings(c, L, t, ui) {
  const u = ui || {};
  const rows = u.rows || [],
    cur = rows.indexOf(u.row),
    at = (r) => rows.indexOf(r);
  const vals = settingsRows(rows, u.vals, !!u.r3d, !!u.px, u.door, u.ana, u.ctlDoor);
  if (u.anaNote && at("ANALYTICS") >= 0) vals[at("ANALYTICS")] = u.anaNote;
  const g = settingsGeom(L, u.touch, rows),
    S = g.S;
  boxPlate(c, S);
  head(c, S, LABEL.SETTINGS, u.kicker || "BUILD " + (u.rev || ""));
  if (u.padVib) { // the door reads the level, only where it fits beside the label at the row's largest type
    const s = "VIBRATION " + u.padVib + " ›";
    c.font = sans(17, "600");
    const lab = mw(c, "CONTROLS");
    c.font = font(12);
    if (mw(c, s) <= S.iw + 16 - 38 - lab - 12 && at("CONTROLS") >= 0) vals[at("CONTROLS")] = s;
  }
  const fk =
    typeof u.togT === "number" && u.togT >= 0 ? 1 - clamp01((t - u.togT) / 0.12) : 0;
  const n = u.job || null, rx = S.ix - 8, rw = S.iw + 16, rh = g.rowH - 2;
  for (let i = 0; i < rows.length; i++) {
    const sel = i === cur,
      ry = g.y0 + i * g.rowH + 1;
    c.globalAlpha = 1;
    if (rows[i] === LABEL.ART_STYLE && n) {
      const bad = n.st === "fail", v = fitVal(c, lookVal(n, u.touch), valueRoom(c, rw, rh, rows[i], u.touch));
      paintRow(c, rx, ry, rw, rh, rows[i], v, sel, { touch: u.touch, danger: bad, vc: bad ? DANGER : TEXT, glow: sel ? fk : 0 });
      if (!bad) jobLine(c, rx + 3, ry + rh - 2, rw - 3, n.fill);
    } else paintRow(c, rx, ry, rw, rh, rows[i], vals[i], sel, { touch: u.touch, vc: TEXT, glow: sel ? fk : 0 });
    c.globalAlpha = 1;
  }
  foot(c, S, tapMode(u.touch) ? FOOT_TAP : footKeys());
}

/* GRAPHICS (unified spec 2026-10-10 §5): the OPTIONS look with eight rows
   and a two-line help area. ui = {row, view, togT, chg, touch}; view =
   {rows:[{label,val,locked,help1,help2}]} arrives finished from the app
   (gfx.js owns every string — this file must not import src/app). chg is the
   bitmask of rows the last change touched, so a preset glows on every row it
   wrote. Locked rows dim to 0.45, read an em dash and stay focusable. */
export const GFX_N = 8; // pinned equal to gfx.js GFX_ROWS.length
export function drawGraphics(c, L, t, ui) {
  const u = ui || {},
    rows = (u.view && u.view.rows) || [],
    cur = u.row | 0,
    chg = u.chg | 0,
    big = !!u.touch;
  const g = graphicsGeom(L, big),
    S = g.S;
  boxPlate(c, S);
  head(c, S, "GRAPHICS", u.kicker || "PERFORMANCE · BATTERY");
  const fk =
    typeof u.togT === "number" && u.togT >= 0 ? 1 - clamp01((t - u.togT) / 0.12) : 0;
  for (let i = 0; i < GFX_N; i++) {
    const r = rows[i] || { label: "", val: "" };
    c.globalAlpha = r.locked ? 0.45 : 1;
    paintRow(c, S.ix - 8, g.y0 + i * g.rowH + 1, S.iw + 16, g.rowH - 2, r.label, r.locked ? "—" : String(r.val), i === cur, { touch: big, vc: TEXT, glow: fk > 0 && (chg >> i) & 1 ? fk : 0 });
    c.globalAlpha = 1;
  }
  const h = rows[cur] || {};
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = MUTED;
  c.font = font(big && !L.narrow ? 11 : 10);
  c.fillText(clip(c, h.help1 || "", S.iw), S.mid, g.noteY + 6);
  c.fillStyle = TEXT;
  c.fillText(clip(c, h.help2 || "", S.iw), S.mid, g.noteY + 20);
  foot(c, S, tapMode(big) ? FOOT_TAP : footKeys());
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
