/* MENU DRAWING LAYER — all menu/intro pixels as pure functions over a
   normalized layout valid at both 600x520 (2D) and 608x352 (3D). Reads only
   its args; never touches world/app state. Palette locked (spec §0/§2):
   accent #37f0d0, text #dfe7f5, muted #7385ad, veils rgba(7,10,18,a).
   Easing helpers duplicated from the intro beat table (spec §3) — this file
   must not import from src/app. */
import { CFG, roomCap, BIOMES, isFinale } from "../core/config.js";
import { POWER, FOES } from "../core/entities.js";
import { HEAT_COL, HEAT_MARK, HEAT_NAME, clampHeat, heatRoster, heatProfile } from "../core/heat.js";
import { PACE_NAME } from "../core/pace.js";
import { pactLabel } from "../core/pact.js";
import { PACT, PACT_COL, applyPact } from "../core/pact.js";
import { drawEnemyBody } from "./sprites.js";
import { drawItemBody } from "./itemdraw.js";
import { rr } from "./icons.js";
import { pixelArt, itemCell, foeCell, pageScale, blitCell, SLOT_PAD } from "./hudart.js";
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
  if (A) return blitCell(c, foeCell(A, f.t), cx, cy, ps || (s >= 36 ? 2 : 1));
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
  if (A) return blitCell(c, itemCell(A, p.t), cx, cy, ps || (s >= 36 ? 2 : 1));
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
/* The ROOM CARD: what a room is, read-only, in a pane P. d = {room, heat,
   pact, best, k (heat pulse 0..1), locked}. One card for LEVEL SELECT's pane
   and MENU's PLAY / LEVEL SELECT pane. */
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
  c.fillText("ROOM " + d.room + (fin ? " · FINALE" : ""), P.x + P.w - 10, hy);
  const ts = touch ? 6 : 8,
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
    rw = P.x + P.w - 10 - rx;
  c.textAlign = "left";
  if (d.locked) {
    lockGlyph(c, x0 + tw / 2, ty + th / 2, touch ? 22 : 20, TEXT);
    c.fillStyle = TEXT;
    c.font = sans(touch ? 15 : 12, "700");
    wrap(c, "CLEAR ROOM 5 TO OPEN", rw, 2).forEach((l, i) => c.fillText(l, rx, ty + 8 + i * (touch ? 18 : 15)));
    c.fillStyle = MUTED;
    c.font = font(touch ? 12 : 10, "700");
    c.fillText("SAND · VOID · CROWN", rx, ty + (touch ? 52 : 44));
    c.fillText("+ MODES", rx, ty + (touch ? 70 : 59));
  } else {
    const ros = rosterOf(d.room, d.heat),
      cap = 5,
      lh = touch ? 22 : 19,
      show = ros.length > cap ? ros.slice(0, cap - 1) : ros;
    c.fillStyle = MUTED;
    c.font = font(touch ? 11 : 9, "700");
    c.fillText("YOU'LL MEET", rx, ty + 5);
    let yy = ty + (touch ? 26 : 22);
    for (const e of show) {
      foeAt(c, A, e.t, rx + 8, yy, touch ? 20 : 17, t);
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
  c.font = font(touch ? 13 : 10, "700");
  c.fillText(clip(c, heatLine(d.heat, d.pact), P.w - 20), x0, P.y + P.h - (touch ? 12 : 10));
  c.shadowBlur = 0;
}
/* A two-line tile (GUIDE doors, the touch MENU hub): label + sub, the kit's
   selection idiom. o = {hero, ext, door, touch, subCol}. */
function paintTile(c, r, label, sub, sel, o) {
  const p = o || {},
    cy = r.y + r.h / 2,
    two = !!sub && !p.hero && !p.flat;
  cell(c, r, 0.5);
  if (sel) {
    selBand(c, r);
    caret(c, r.x + 11, cy, Math.min(r.h, 30));
  }
  c.textBaseline = "middle";
  c.textAlign = "left";
  c.fillStyle = sel ? TEXT : p.hero ? TEXT : "#b6c2dc";
  c.font = sans(p.hero ? (p.touch ? 24 : 20) : p.touch ? 17 : 15, p.hero ? "800" : "700");
  c.fillText(label, r.x + 24, two ? cy - 9 : cy);
  const mark = p.ext ? "↗" : p.door ? "›" : "";
  if (mark) {
    c.textAlign = "right";
    c.font = sans(p.ext ? 14 : 18, "600");
    c.fillStyle = sel ? TEXT : MUTED;
    c.fillText(mark, r.x + r.w - 10, cy);
  }
  if (sub) {
    c.font = font(p.touch && r.w >= 220 ? 13 : 11, "700"); // a narrow-box hub tile (~185) keeps its teaser whole
    c.fillStyle = p.subCol || (sel ? TEXT : MUTED);
    if (two) {
      c.textAlign = "left";
      c.fillText(clip(c, sub, r.w - 40), r.x + 24, cy + 11);
    } else {
      c.textAlign = "right";
      c.fillText(sub, r.x + r.w - (mark ? 30 : 12), cy);
    }
  }
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
/* The key / name cell at a control's left: keyboard prints its key under the
   name ("HEAT ↑↓"), touch only the name. */
function capCell(c, r, name, keyStr, touch) {
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = MUTED;
  if (touch || !keyStr) {
    c.font = sans(touch ? 13 : 10, "700");
    c.fillText(name, r.x + r.w / 2, r.y + r.h / 2);
    return;
  }
  c.font = font(8, "700");
  c.fillText(name, r.x + r.w / 2, r.y + r.h / 2 - 6);
  c.fillStyle = TEXT;
  c.font = font(11, "900");
  c.fillText(keyStr, r.x + r.w / 2, r.y + r.h / 2 + 6);
}

/* lg: the touch-portrait shell box's logo line (fit.js shellGeo, the board's
   own 0.27 in #sh units); tall marks that box (MENU's hub then hangs under the
   logo instead of centring in the band) and narrow any box under 560 wide
   (pages re-flow: LEVEL SELECT stacks its card under the grid, MEDALS goes to
   one column). Neither ever holds at 600x520 or 608x352. */
export function layout(W, H, lg) {
  return Object.freeze({
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

/* MAIN MENU over the dimmed frozen arena (ATLAS, r2 direction B): pick on
   the left, see it on the right. ui={cursor,items,enterT,touch,info,kind};
   item entries may carry a value token ("PLAY|L1 · CORE · NORM"). The row
   SHAPE (PLAY hero, group gaps before OPTIONS / HIGH SCORES / SOURCE) is a
   constant here, never read from items: main.js hit-tests with only n, so the
   painted and tapped rows come from the same table.
   Keyboard: one 560 plate under the logo, a 272 list (pitch 26 / hero 40 /
   gap 6) beside a preview pane that follows the cursor (menuPane).
   Touch (body[data-lay] p/l): a hub of tiles in the pinned reading order —
   PLAY bar, LEVEL SELECT | DAILY, OPTIONS | GUIDE, HIGH SCORES | STATS, the
   SOURCE foot link — so ↑↓ stays the linear walk and every index the
   headless confirms use still names the same row. menuLogo is the one source
   for shellview's logo and the list top. ui.rev is the build tag shellview
   derives from CACHE_NAME: keyboard prints it in the foot hint; touch hangs it
   under the hub where the box has room (#sh), else on the SOURCE tile. */
const MENU_DOOR = ["LEVEL SELECT", "OPTIONS", "GUIDE", "HIGH SCORES", "STATS"];
const menuShape = (n, touch) => Array.from({ length: n }, (_, i) => ({ hero: i === 0, gapBefore: !touch && n === 8 && (i === 3 || i === 5 || i === 7) }));
export const MENU_PITCH = 26, MENU_PITCH_T = 66;
const MENU_W = 560, MENU_LIST = 272, HUB = [70, 66, 66, 66, 50]; // SOURCE 50 = the 32 CSS px floor on a 393 px phone
export function menuLogo(L) {
  return { cy: L.logoCy, s: L.logoScale };
}
function hubGeom(L, top) {
  const w = Math.min(L.cx * 2 - 40, 540),
    x = Math.round(L.cx - w / 2),
    pad = 10,
    g = 6,
    bot = L.footY + 12,
    body = HUB.reduce((a, b) => a + b, 0) + g * 4,
    f = Math.min(1, (bot - top - pad * 2) / body),
    h = Math.round(pad * 2 + body * f),
    y = Math.round(L.tall ? top : top + Math.max(0, (bot - top - h) / 2)),
    iw = w - pad * 2,
    cw = (iw - g) / 2,
    cells = [];
  let yy = y + pad;
  for (let r = 0; r < 5; r++) {
    const rh = HUB[r] * f;
    if (r === 0 || r === 4) cells.push({ x: x + pad, y: yy, w: iw, h: rh });
    else cells.push({ x: x + pad, y: yy, w: cw, h: rh }, { x: x + pad + cw + g, y: yy, w: cw, h: rh });
    yy += rh + g * f;
  }
  const rows = cells.map((q) => ({ ...q, y0: q.y, y1: q.y + q.h, h: q.h, cy: q.y + q.h / 2, a: Math.max(y, q.y - (g * f) / 2), b: Math.min(y + h, q.y + q.h + (g * f) / 2), l: Math.max(x, q.x - g / 2), r: Math.min(x + w, q.x + q.w + g / 2) }));
  return { x, y, w, h, f, pad, rows, mid: x + w / 2, span: HUB[1] * f, hub: true };
}
export function menuList(L, n, touch) {
  const lg = menuLogo(L),
    top = Math.max(lg.cy + 10 * lg.s + 8, 8);
  if (touch && n === 8) return hubGeom(L, top);
  const w = Math.min(L.cx * 2 - 40, MENU_W),
    x = Math.round(L.cx - w / 2),
    g = listGeom(L, menuShape(n), { top, bot: L.footY - 14, w: MENU_LIST, x, pitch: MENU_PITCH, hero: 40, gap: 6, pad: 10 });
  g.px = x;
  g.pw = w;
  g.pane = { x: x + MENU_LIST + 2, y: g.y + 10, w: w - MENU_LIST - 12, h: g.h - 20 };
  return g;
}
export function menuGeom(L, n, touch) {
  const g = menuList(L, n, touch);
  return { bx: g.x, y0: g.y, rw: g.w, h: g.h, span: g.span, padY: g.pad, rows: g.rows, hub: !!g.hub };
}
/* Keyboard: contiguous full-stage-width bands (a side tap is its row).
   Touch hub: each tile owns half of every gutter beside it; the plate's
   rim and anything off it is -1, and main does nothing with -1. */
export function menuHit(x, y, L, n, touch) {
  const g = menuList(L, n, touch);
  if (!g.hub) return listHit(x, y, g, true);
  for (let i = 0; i < g.rows.length; i++) {
    const r = g.rows[i];
    if (x >= r.l && x < r.r && y >= r.a && y < r.b) return i;
  }
  return -1;
}
/* MENU teasers (the hub's second line), from info shellview hands in. */
const LOOK = ["CLASSIC 2D", "PIXEL", "REAL 3D"];
function teaser(label, val, I) {
  const i = I || {};
  switch (label) {
    case "PLAY": return val;
    case "LEVEL SELECT": return i.unlocked ? "8 ROOMS · MODES OPEN" : "5 ROOMS · 3 LOCKED";
    case "DAILY": return val === "NEW" ? "NEW · TODAY'S BOARD" : "PLAYED · " + ((i.daily && i.daily.played) | 0) + " TODAY";
    case "OPTIONS": return "LOOK · " + LOOK[i.look | 0];
    case "GUIDE": return POWER.length + " ITEMS · " + FOES.length + " FOES";
    case "HIGH SCORES": return i.top && i.top.length ? "TOP " + i.top[0].s + " · CORE" : "NO RUNS YET";
    case "STATS": return (i.medals | 0) + "/8 MEDALS · " + (i.days | 0) + ((i.days | 0) === 1 ? " DAY" : " DAYS");
    case "SOURCE": return "github.com/HMarzban/fusegrid";
  }
  return val;
}
export function drawMenu(c, ui, L, t) {
  const cur = (ui && ui.cursor) | 0;
  const items = (ui && ui.items) || [];
  const et = ui && typeof ui.enterT === "number" ? ui.enterT : t;
  const touch = !!(ui && ui.touch);
  const n = items.length;
  const g = menuList(L, n, touch),
    shape = menuShape(n, touch),
    I = (ui && ui.info) || {};
  // enterT < 0 holds the menu back (the show's blast reads first): nothing,
  // then the plate fades in over the last 0.12 s before the rows enter
  const pa = et < 0 ? clamp01(1 + et / 0.12) : 1;
  if (pa <= 0) return;
  c.globalAlpha = pa;
  const rows = items.map((it, i) => {
    const str = String(it),
      pipe = str.indexOf("|"),
      label = pipe > 0 ? str.slice(0, pipe) : str,
      val = pipe > 0 ? str.slice(pipe + 1) : "",
      ext = label === "SOURCE";
    return { label, val, hero: shape[i].hero, door: MENU_DOOR.indexOf(label) >= 0, ext, vc: label === "DAILY" && val === "NEW" ? ACCENT : null };
  });
  const rev = (ui && ui.rev) || "";
  if (g.hub) {
    const under = !!rev && L.footY - (g.y + g.h) >= 10; // off every tile: a root list ignores an off-plate tap
    plate(c, g.x, g.y, g.w, g.h);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i],
        k = easeOutCubic(clamp01((et - i * 0.03) / 0.12)),
        sub = teaser(r.label, r.val, I);
      c.globalAlpha = pa * k;
      const q = g.rows[i],
        rr2 = { x: q.x, y: q.y + 6 * (1 - k), w: q.w, h: q.h };
      paintTile(c, rr2, r.label, r.ext && rev && !under ? rev + " · " + sub : sub, i === cur, { hero: r.hero, ext: r.ext, door: r.door, touch, flat: i === 7, subCol: r.vc });
    }
    if (under) {
      c.globalAlpha = pa;
      footTag(c, L.cx, g.y + g.h + 16, rev);
    }
    c.globalAlpha = 1;
    return;
  }
  plate(c, g.px, g.y, g.pw, g.h);
  drawList(c, g, rows, cur, t, { et, touch, alpha: pa });
  const pk = easeOutCubic(clamp01((et - 0.08) / 0.12));
  c.globalAlpha = pa * pk;
  menuPane(c, { ...g.pane, y: g.pane.y + 6 * (1 - pk) }, rows[cur] || rows[0], I, ui.kind, t);
  c.globalAlpha = pa;
  footTag(c, L.cx, L.footY, "↑↓ MOVE · ENTER SELECT" + (rev ? " · " + rev : ""));
  c.globalAlpha = 1;
}
/* A muted line below a plate: give it the plate's own ground, never bare board. */
function footTag(c, x, y, s) {
  const bw = s.length * 6 + 24;
  c.fillStyle = PLATE;
  c.fillRect(Math.round(x - bw / 2), Math.round(y - 11), Math.round(bw), 22);
  c.fillStyle = MUTED;
  c.font = font(10);
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(s, x, y);
}
/* The preview pane: what the cursor row holds, from read-only info
   (shellview's getters; this file never imports src/app). */
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
function menuPane(c, P, row, I, kind, t) {
  const A = pxArt(kind),
    lab = row.label,
    a0 = c.globalAlpha;
  if (lab === "PLAY" || lab === "DAILY") {
    const d = lab === "DAILY";
    roomCard(c, { x: P.x, y: P.y, w: P.w, h: 172 }, d ? { room: 1, heat: 0, pact: 0, title: "TODAY'S BOARD" } : { room: I.level || 1, heat: I.heat | 0, pact: I.pact | 0, best: I.best && I.best[(I.level || 1) - 1], open: !!I.unlocked }, false, A, t);
    const y = P.y + 190;
    if (d) {
      const D = I.daily || {},
        played = (D.played | 0) > 0;
      paneLine(c, P, y, "ONE BOARD A DAY · JUNGLE · CORE · NORM", TEXT);
      paneLine(c, P, y + 16, "YOUR TRIES TODAY " + (D.played | 0) + (played ? " · YOUR BEST " + (D.best | 0) : ""), played ? ACCENT : MUTED);
      paneLine(c, P, y + 32, "SAME BOARD ON EVERY TRY TODAY", MUTED);
    } else {
      paneLine(c, P, y, "NEXT RUN · " + (row.val || ""), TEXT);
      paneLine(c, P, y + 16, "ENTER STARTS IT · LEVEL SELECT CHANGES IT", MUTED);
      paneLine(c, P, y + 32, "8 ROOMS · 3 HEATS · 3 PACES", MUTED);
    }
    return;
  }
  cell(c, P);
  if (lab === "LEVEL SELECT") {
    paneHead(c, P, I.unlocked ? "8 ROOMS" : "5 ROOMS", I.unlocked ? "ALL OPEN" : "3 LOCKED", I.unlocked ? ACCENT : MUTED);
    const tw = 60, tg = 5, x0 = P.x + (P.w - (4 * tw + 3 * tg)) / 2;
    for (let i = 0; i < 8; i++) {
      const r = { x: x0 + (i % 4) * (tw + tg), y: P.y + 30 + (i >> 2) * 58, w: tw, h: 54 },
        lock = !I.unlocked && i >= 5;
      cell(c, r, 0.5);
      c.globalAlpha = a0 * (lock ? 0.25 : 1);
      schem(c, r.x + 7, r.y + 4, 3, BIOMES[i]);
      c.globalAlpha = a0;
      if (lock) lockGlyph(c, r.x + r.w / 2, r.y + 22, 14, TEXT);
      c.textAlign = "center";
      c.fillStyle = lock ? MUTED : TEXT;
      c.font = font(9, "700");
      c.fillText(BIOMES[i].name, r.x + r.w / 2, r.y + 48);
    }
    paneLine(c, P, P.y + 160, "HEAT  CORE · PLUS · MAX", TEXT);
    paneLine(c, P, P.y + 176, "PACE  EASY · NORM · HARD", TEXT);
    paneLine(c, P, P.y + 192, I.unlocked ? "MODES IRON · BARE · THIN · SHRINK · TIME" : "CLEAR ROOM 5: ROOMS 6–8 + MODES", I.unlocked ? TEXT : ACCENT);
    paneLine(c, P, P.y + P.h - 14, "EVERY ROOM SHOWS ITS FOES + YOUR BEST", MUTED);
  } else if (lab === "OPTIONS") {
    paneHead(c, P, "THREE LOOKS", "RENDER ROW");
    const bw = (P.w - 28) / 3;
    for (let i = 0; i < 3; i++) {
      const r = { x: P.x + 10 + i * (bw + 4), y: P.y + 30, w: bw, h: 70 },
        on = (I.look | 0) === i;
      cell(c, r, 0.5);
      if (on) selBand(c, r);
      const b = BIOMES[0];
      c.globalAlpha = a0 * (on ? 1 : 0.55);
      if (i === 0) schem(c, r.x + (r.w - 45) / 2, r.y + 8, 3, b);
      else if (i === 1) {
        const q0 = r.x + (r.w - 54) / 2;
        for (let q = 0; q < 9; q++) for (let s = 0; s < 6; s++) {
          c.fillStyle = (q + s) % 3 === 0 ? b.brickA : (q + s) & 1 ? b.floor1 : b.floor0;
          c.fillRect(q0 + q * 6, r.y + 10 + s * 6, 6, 6);
        }
      } else {
        c.fillStyle = b.floor0;
        c.beginPath();
        c.moveTo(r.x + 18, r.y + 12);
        c.lineTo(r.x + r.w - 18, r.y + 12);
        c.lineTo(r.x + r.w - 6, r.y + 44);
        c.lineTo(r.x + 6, r.y + 44);
        c.closePath();
        c.fill();
        c.fillStyle = b.wall;
        c.fillRect(r.x + 28, r.y + 22, 10, 12);
        c.fillRect(r.x + r.w - 38, r.y + 22, 10, 12);
      }
      c.globalAlpha = a0;
      c.textAlign = "center";
      c.fillStyle = on ? ACCENT : MUTED;
      c.font = font(9, on ? "900" : "700");
      c.fillText(LOOK[i], r.x + r.w / 2, r.y + 60);
    }
    paneLine(c, P, P.y + 116, "CLASSIC 2D → PIXEL → REAL 3D, YOUR PICK", TEXT);
    paneLine(c, P, P.y + 140, "SOUND " + (I.snd ? "ON" : "OFF") + " · MUSIC " + (I.mus | 0) + " · SFX " + (I.sfx | 0));
    paneLine(c, P, P.y + 156, "CAMERA · BRIGHTNESS · SHAKE · FLASH");
    paneLine(c, P, P.y + 172, "GRAPHICS " + (I.gfx || "AUTO") + " · FRAME RATE · RESOLUTION");
    paneLine(c, P, P.y + P.h - 14, "ENTER OPENS ALL TEN ROWS", MUTED);
  } else if (lab === "GUIDE") {
    paneHead(c, P, "FIELD GUIDE", POWER.length + " ITEMS · " + FOES.length + " FOES");
    const sw = (P.w - 20) / 6;
    for (let i = 0; i < 6; i++) {
      const p = POWER[i], cx = P.x + 10 + sw * (i + 0.5);
      well(c, cx, P.y + 48, 26, p.col);
      itemAt(c, A, p, cx, P.y + 48, 18, t);
      c.textAlign = "center";
      c.fillStyle = MUTED;
      c.font = font(8, "700");
      c.fillText(p.name, cx, P.y + 72);
    }
    const fw = (P.w - 20) / 3;
    for (let i = 0; i < 3; i++) {
      const f = FOES[[0, 3, 4][i]], cx = P.x + 10 + fw * (i + 0.5);
      well(c, cx, P.y + 108, 34);
      foeAt(c, A, f.t, cx, P.y + 108, 26, t);
      c.textAlign = "center";
      c.fillStyle = TEXT;
      c.font = font(9, "700");
      c.fillText(f.name, cx, P.y + 136);
    }
    paneLine(c, P, P.y + 166, "HOW TO PLAY · ITEMS · ENEMIES", TEXT, 10, "center");
    paneLine(c, P, P.y + P.h - 14, "EVERY PICKUP + FOE, WITH WHAT IT DOES", MUTED, 10, "center");
  } else if (lab === "HIGH SCORES") {
    paneHead(c, P, "YOUR TOP 3", "CORE");
    const top = I.top || [];
    if (!top.length) paneLine(c, P, P.y + 90, "NO CORE RUNS YET", MUTED, 12, "center");
    for (let i = 0; i < Math.min(3, top.length); i++) {
      const r = { x: P.x + 10, y: P.y + 30 + i * 46, w: P.w - 20, h: 40 }, s = top[i];
      cell(c, r, 0.5);
      if (i === 0) selBand(c, r);
      c.textBaseline = "middle";
      c.textAlign = "left";
      c.fillStyle = i ? MUTED : ACCENT;
      c.font = font(13, "900");
      c.fillText(String(i + 1), r.x + 12, r.y + 20);
      c.fillStyle = TEXT;
      c.font = font(18, "900");
      c.fillText(String(s.s), r.x + 34, r.y + 20);
      c.textAlign = "right";
      c.fillStyle = MUTED;
      c.font = font(10, "700");
      c.fillText("ROOM " + s.l + " · " + s.d, r.x + r.w - 10, r.y + 20);
    }
    paneLine(c, P, P.y + 186, "PLUS ×2 · MAX ×3 ON EVERY SAVED SCORE", TEXT);
    paneLine(c, P, P.y + P.h - 14, "ENTER: ALL TEN · CORE / PLUS / MAX", MUTED);
  } else if (lab === "STATS") {
    paneHead(c, P, "YOUR CABINET", (I.medals | 0) + "/8 MEDALS", (I.medals | 0) ? ACCENT : MUTED);
    const dw = (P.w - 20) / 8;
    for (let i = 0; i < 8; i++) {
      const cx = P.x + 10 + dw * (i + 0.5), on = ((I.mask | 0) >> i) & 1;
      rr(c, cx - 10, P.y + 36, 20, 20, 10);
      if (on) {
        c.fillStyle = ACCENT;
        c.fill();
      } else {
        c.strokeStyle = MUTED;
        c.lineWidth = 1.5;
        c.stroke();
      }
    }
    const big = [["DAYS PLAYED", I.days | 0], ["RUNS", I.runs | 0], ["ROOMS CLEARED", I.rooms | 0], ["KILLS", I.kills | 0]];
    for (let i = 0; i < 4; i++) {
      const r = { x: P.x + 10 + (i % 2) * ((P.w - 24) / 2 + 4), y: P.y + 70 + (i >> 1) * 52, w: (P.w - 24) / 2, h: 46 };
      cell(c, r, 0.5);
      c.textAlign = "left";
      c.fillStyle = TEXT;
      c.font = font(18, "900");
      c.fillText(String(big[i][1]), r.x + 10, r.y + 18);
      c.fillStyle = MUTED;
      c.font = font(9, "700");
      c.fillText(big[i][0], r.x + 10, r.y + 36);
    }
    paneLine(c, P, P.y + P.h - 14, "EIGHT MEDALS · EACH NEEDS A FINALE WIN", MUTED);
  } else if (lab === "SOURCE") {
    paneHead(c, P, "OPEN SOURCE", "↗");
    paneLine(c, P, P.y + 60, "github.com/HMarzban/fusegrid", ACCENT, 12);
    paneLine(c, P, P.y + 90, "PLAIN ES MODULES · NO BUILD STEP", TEXT);
    paneLine(c, P, P.y + 106, "ZERO NPM DEPENDENCIES", TEXT);
    paneLine(c, P, P.y + 122, "THE SAME SIM RUNS IN NODE AND THE BROWSER", MUTED);
    paneLine(c, P, P.y + P.h - 14, "ENTER OPENS IT IN A NEW TAB", MUTED);
  }
}

/* MODES is a PRESENTATION relabel of the four Pact bits, so these names live
   here and core/pact.js keeps its own frozen name table and pactLabel's
   L/B/T/S letters — the HIGH SCORES p column and every pact.js pin depend on
   them. Same render-side duplication precedent as PLAQUE_NAME. IRON is a
   display name for PACT.LAST (applyPact sets lives = 1); BARE is PACT.BARE
   verbatim. TIME_COL is deliberately OUTSIDE PACT_COL so the fifth chip cannot
   read as a fifth Pact bit — that plus the 12px double gap are the two devices
   that enforce it. #ff8a3c is already the palette's FLAME colour. MODE_HELP
   says what the sim does with each bit (applyPact / sim.js advanceShrink). */
const MODE_NAME = ["IRON", "BARE", "THIN", "SHRINK"];
const MODE_HELP = ["IRON 1 life", "BARE no floor pickups", "THIN fewer buried items", "SHRINK walls close in from 25 s"];
const TIME_COL = "#ff8a3c";
const MODE_BIT = [PACT.LAST, PACT.BARE, PACT.THIN, PACT.SHRINK];
export function modeHelp(pact, time) {
  const on = MODE_HELP.filter((_, i) => (pact | 0) & MODE_BIT[i]);
  if (time) on.push("TIME stopwatch + per-room best");
  return on.length ? on.join(" · ") : "ONE LIFE · NO PICKUPS · FEWER ITEMS · WALLS CLOSE IN · STOPWATCH";
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
  return { S, f, grid, pane, room, heatCap, heat, paceCap, pace, modeCap, mode, help, start, capY: by + (capH * f) / 2, cap: roomCap(U) };
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
  return { S, f, grid, pane, room, heatCap, heat, paceCap, pace, modeCap, mode, help, start, capY: by + (capH * f) / 2, cap: roomCap(U), narrow: true };
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
/* info = {kind, best:[8 strings|null] at this heat/pace/modes, heatT, lockR,
   lockT} from shellview (times arrive formatted; this file never reads a
   store). */
export function drawLevelSelect(c, sel, L, t, heat, pact, unlocked, pace, timeAttack, touch, info) {
  const I = info || {},
    T = !!touch,
    U = !!unlocked,
    G = levelGeom(L, U, T),
    S = G.S,
    h = clampHeat(heat),
    mask = U ? pact | 0 : 0,
    A = pxArt(I.kind),
    best = I.best || [];
  let p = pace | 0;
  if (p < -1) p = -1;
  else if (p > 1) p = 1;
  boxPlate(c, S);
  head(c, S, "LEVEL SELECT", U ? "8 ROOMS · MODES OPEN" : "5 ROOMS · 3 LOCKED");
  c.textAlign = "left";
  c.textBaseline = "middle";
  c.fillStyle = MUTED;
  c.font = T ? sans(13, "700") : font(9, "700");
  c.fillText(T ? "TAP A ROOM" : "ROOM  ← →", G.grid.x, G.capY);
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
  roomCard(c, G.pane, peek ? { room: peek, heat: h, pact: mask, locked: true } : { room: sel, heat: h, pact: mask, best: best[sel - 1], k: hk, open: U }, T, A, t);
  capCell(c, G.heatCap, "HEAT", "↑↓", T);
  segs(c, G.heat, HEAT_NAME, h, HEAT_COL.map((x, i) => (i ? x : TEXT)), T);
  capCell(c, G.paceCap, "PACE", "[ ]", T);
  segs(c, G.pace, PACE_NAME, p + 1, null, T);
  if (U) {
    capCell(c, G.modeCap, "MODES", "1–5", T);
    for (let i = 0; i < 5; i++) {
      const r = G.mode[i],
        on = i < 4 ? (mask & MODE_BIT[i]) !== 0 : !!timeAttack;
      segs(c, [r], [(G.narrow && T ? "" : i + 1 + " ") + (i < 4 ? MODE_NAME[i] : "TIME")], on ? 0 : -1, [i < 4 ? PACT_COL[i] : TIME_COL], T, G.narrow ? 12 : 0); // a narrow touch chip drops the key digit
    }
    c.textAlign = "center";
    c.fillStyle = MUTED;
    if (G.narrow) {
      c.font = font(11, "700");
      const hl = wrap(c, modeHelp(mask, timeAttack), S.iw, 2);
      hl.forEach((l, i) => c.fillText(l, S.mid, G.help.y + G.help.h / 2 + 1 + (i - (hl.length - 1) / 2) * 13));
    } else {
      c.font = font(T ? 13 : 10, "700");
      c.fillText(clip(c, modeHelp(mask, timeAttack), S.iw), S.mid, G.help.y + G.help.h / 2 + 1);
    }
  }
  const st = G.start,
    tag = BIOMES[sel - 1].name + " · " + HEAT_NAME[h] + " · " + PACE_NAME[p + 1] + (mask ? " · " + MODE_NAME.filter((_, i) => mask & MODE_BIT[i]).join("+") : "") + (U && timeAttack ? " · TIME" : "");
  paintRow(c, st.x + 8, st.y + 2, st.w - 16, st.h - 4, "START", tag, true, { hero: true, touch: T });
  foot(c, S, T ? LEVEL_TAP : "ENTER START · ESC BACK");
}

/* GUIDE art in PIXEL (W5, R19): kind "px" swaps only the scaled vector glyph
   for the atlas cell (hudart.js); wells, rows and text are the same
   calls in every kind. */
const pxArt = (kind) => (kind === "px" ? pixelArt() : null);
const BACK_TAP = "TAP OUTSIDE TO GO BACK";

/* HOW TO PLAY: the two rules first, then the control grid mirroring the
   page .hint (power-gate asterisks). */
const HOW_ROWS = [
  ["WASD / ARROWS", "MOVE", null],
  ["SPACE", "BOMB", "bomb"],
  ["SHIFT + SPACE", "THROW *", "throw"],
  ["Q", "REMOTE *", "remote"],
  ["WALK INTO BOMB", "KICK *", "kick"],
  ["P", "PAUSE", null],
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
  for (let i = 0; i < HOW_ROWS.length; i++) {
    const [k, v, kd] = HOW_ROWS[i],
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
  c.fillText(T ? "TOUCH · LEFT PAD MOVES · RIGHT BUTTON BOMBS" : "* NEEDS ITS POWER-UP · ITEMS = CUBES · LEVEL = ROOM + HEAT", S.mid, y0 + (3 * rh + 6 + note / 2) * f - 4);
  foot(c, S, T ? BACK_TAP : "ESC / ENTER BACK");
}

/* ITEMS: two-column catalogue of every POWER pickup; help wraps (≤2 lines). */
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
  head(c, S, "ITEMS", n + " PICKUPS");
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
    const hl = wrap(c, p.help, tw, T ? 2 : 1);
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
  foot(c, S, T ? BACK_TAP : "WALK OVER A CUBE TO COLLECT · ESC BACK");
}

/* ENEMIES: 3x3 field guide; name, a 2-line measured help and ROOMS. */
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
    c.fillText("ROOMS " + e.rooms, tx, r.y + r.h - (T ? 11 : 8));
  }
  foot(c, S, T ? BACK_TAP : "ESC BACK");
}

/* GUIDE (ATLAS): three door tiles side by side on keyboard (←/→ or ↑/↓
   walk them), stacked 70-tall rows with the strip inline on touch. Each door
   shows what is behind it. guideHit shares guideGeom; a tile owns half of
   each gutter, the rest of the plate is inert (-2), off it backs out (-1). */
const GUIDE_LABEL = ["HOW TO PLAY", "ITEMS", "ENEMIES"];
export function guideGeom(L, touch) {
  const T = !!touch,
    S = pageBox(L, T ? 520 : 552, T ? 3 * 70 + 12 : 120, T),
    f = S.f,
    tw = T ? S.iw : (S.iw - 16) / 3;
  const tiles = [0, 1, 2].map((i) => (T ? { x: S.ix, y: S.by + i * 76 * f, w: tw, h: 70 * f } : { x: S.ix + i * (tw + 8), y: S.by, w: tw, h: 120 * f }));
  return { S, tiles, T };
}
export function guideHit(x, y, L, _n, touch) {
  const g = guideGeom(L, touch),
    p = g.T ? 3 : 4;
  for (let i = 0; i < 3; i++) if (inR(g.tiles[i], x, y, p)) return i;
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
export function drawGuide(c, L, t, cursor, kind, touch) {
  const cur = cursor | 0,
    g = guideGeom(L, touch),
    S = g.S,
    T = g.T,
    A = pxArt(kind);
  boxPlate(c, S);
  head(c, S, "GUIDE", "HOW TO · ITEMS · ENEMIES");
  const subs = ["2 RULES · 6 CONTROLS", POWER.length + " PICKUPS", FOES.length + " FOES"];
  for (let i = 0; i < 3; i++) {
    const r = g.tiles[i],
      sel = i === cur;
    cell(c, r, 0.5);
    if (sel) selBand(c, r);
    c.textBaseline = "middle";
    c.textAlign = "left";
    c.fillStyle = sel ? TEXT : "#b6c2dc";
    c.font = sans(T ? 17 : 15, "800");
    const lx = r.x + 24;
    c.fillText(GUIDE_LABEL[i], lx, T ? r.y + r.h / 2 - 10 : r.y + 20);
    c.fillStyle = sel ? TEXT : MUTED;
    c.font = font(T ? 13 : 10, "700");
    c.fillText(clip(c, subs[i], r.x + r.w - 10 - lx), lx, T ? r.y + r.h / 2 + 12 : r.y + r.h - 16);
    c.textAlign = "right";
    c.font = sans(18, "600");
    c.fillText("›", r.x + r.w - 10, T ? r.y + r.h / 2 : r.y + 20);
    if (sel) caret(c, r.x + 11, T ? r.y + r.h / 2 : r.y + 20, 30);
    const sy = T ? r.y + r.h / 2 : r.y + r.h / 2 + 4,
      sx = T ? r.x + r.w - 40 : r.x + 24;
    if (i === 0) {
      if (T) {
        c.font = font(12, "900");
        let x = sx;
        for (const k of ["PAUSE", "BOMB", "PAD"]) x -= keyCap(c, x - (mw(c, k) + 12), sy, k, T) + 4; // the touch controls, never keyboard caps on a phone
      } else {
        let x = sx;
        for (const k of ["WASD", "SPACE"]) x += keyCap(c, x, sy - 12, k, T) + 4;
        x = sx;
        for (const k of ["K", "Q", "P"]) x += keyCap(c, x, sy + 10, k, T) + 4;
      }
    } else {
      const list = i === 1 ? POWER.slice(0, 4) : [FOES[0], FOES[3], FOES[4]],
        s = T ? 30 : 30;
      list.forEach((e, j) => {
        const cx = T ? sx - (list.length - 1 - j) * (s + 4) - s / 2 : sx + s / 2 + j * (s + 4);
        well(c, cx, sy, s, i === 1 ? e.col : null);
        if (i === 1) itemAt(c, A, e, cx, sy, s * 0.72, t);
        else foeAt(c, A, e.t, cx, sy, s * 0.82, t);
      });
    }
  }
  foot(c, S, T ? "TAP A DOOR · " + BACK_TAP : "← → / ↑↓ PICK · ENTER OPEN · ESC BACK");
}

/* Local cabinet plaques (plan 5): bit order matches src/app/plaques.js
   PLAQUE = {CLEAR:1,PLUS:2,MAX:4,CROWN:8} — this file must not import
   src/app, so the names are duplicated here rather than imported. */
const PLAQUE_NAME = ["CLEAR", "PLUS", "MAX", "CROWN"];

/* HIGH SCORES: the CORE / PLUS / MAX segmented control, the four plaques
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
export function drawScores(c, scores, L, t, heat, plaques, touch) {
  const g = scoresGeom(L, touch),
    S = g.S,
    T = g.T,
    h = clampHeat(heat);
  boxPlate(c, S);
  head(c, S, "HIGH SCORES", "BEST RUNS");
  segs(c, g.tabs, HEAT_NAME, h, HEAT_COL.map((x, i) => (i ? x : TEXT)), T);
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
    foot0 = T ? BACK_TAP : "← → HEAT · ESC BACK";
  if (!nShow) {
    c.fillStyle = MUTED;
    c.font = font(T ? 15 : 12, "900");
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("NO " + HEAT_NAME[h] + " RUNS YET", S.mid, bt + 5 * rh);
    c.font = font(T ? 13 : 10);
    c.fillText("PICK " + HEAT_NAME[h] + " ON LEVEL SELECT TO SET ONE", S.mid, bt + 6.2 * rh);
    foot(c, S, foot0);
    return;
  }
  const gap = 10,
    cw = [32, 64, 40, 36, Math.max(56, S.iw - 32 - 64 - 40 - 36 - gap * 4)],
    xs = [S.ix];
  for (let i = 0; i < 4; i++) xs.push(xs[i] + cw[i] + gap);
  const hy = bt + rh / 2;
  c.font = font(T ? 11 : 9, "900");
  c.fillStyle = MUTED;
  c.textAlign = "left";
  c.textBaseline = "middle";
  c.fillText("RANK", xs[0], hy);
  c.fillText("LV", xs[2], hy);
  c.fillText("MODES", xs[3], hy);
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
const RESET_FOOT = "R AGAIN ERASES · ANY OTHER KEY CANCELS · KEEPS OPTIONS + PACE · C COPY";
const RESET_NOTES = Object.freeze([
  "ERASES SCORES · BESTS · TIMES · DAILY · MEDALS · PLAQUES · GHOSTS",
  "ERASES STATS + DAYS PLAYED · RELOCKS ROOMS 6-8 · MODES · TIME ATTACK",
]);
/* STATS (ATLAS): eight tiles (seven lifetime counters + MEDALS n/8) in two
   columns, a BESTS row of three heat-coloured tiles, two notes, the foot.
   ui={rows,notes,trophies} arrives already computed (app/stats.js). The
   plate is pinned to the keyboard band floor so the foot tap band (statsHit)
   stays 464-492 at 600x520. A C copy note takes the kicker's slot. */
export function statsGeom(L) {
  return { S: pageBox(L, 480, 4 * 46 + 3 * 6 + 8 + 14 + 46 + 8 + 28, false, { bottom: !L.tall }) }; // the tall shell box centres it like every page
}
/* STATS foot taps (T1): token zones over the one painted foot string at the
   0.6 em mono advance, half a separator wide each side. */
export function statsHit(x, y, L, arm) {
  const S = statsGeom(L).S,
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
export function drawStats(c, L, t, ui, arm, toast) {
  const S = statsGeom(L).S,
    f = S.f,
    sq = f < 1, // the iso 608x352 guard: a 28px tile takes a smaller value + label pair
    tn = toast && toast.s,
    rows = (ui && ui.rows) || [],
    tro = (ui && ui.trophies) || [],
    notes = arm ? RESET_NOTES : (ui && ui.notes) || [];
  boxPlate(c, S);
  head(c, S, "STATS", tn ? "" : "YOUR CABINET");
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
  c.fillText("BESTS · NO MODES · NORM", S.ix, y + 6);
  y += 14 * f;
  const bw = (S.iw - 12) / 3;
  for (let i = 0; i < 3; i++) {
    const r = { x: S.ix + i * (bw + 6), y, w: bw, h: 46 * f },
      v = rows[7 + i] || ["", "—"];
    cell(c, r, 0.55);
    c.fillStyle = i ? HEAT_COL[i] : TEXT;
    c.fillRect(r.x, r.y, 3, r.h);
    c.textAlign = "left";
    c.font = font(sq ? 13 : 15, "900");
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
  else foot(c, S, STATS_FOOT);
}

/* MEDALS (R6, SCREEN.TROPHIES): a 2x4 grid of medal tiles; the lock lives in
   the disc (filled accent = earned, hollow ring = still a goal), never in a
   0.45 alpha. rows=[name, desc, on] arrive finished from app/medals.js, so a
   missing list paints eight name-free placeholders. n/8 is a head bar. */
export function drawTrophies(c, L, t, rows) {
  const r0 = rows || [],
    nc = L.narrow ? 1 : 2, // the narrow box: one column, so every goal reads whole
    nr = 8 / nc,
    S = pageBox(L, 552, nr * 60 + (nr - 1) * 6, false),
    f = S.f,
    n = r0.filter((x) => x && x[2]).length,
    tw = (S.iw - 8 * (nc - 1)) / nc;
  boxPlate(c, S);
  head(c, S, "MEDALS", n + "/8");
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
   so it names the tap model both pages use (row = Enter, off the plate = back). */
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
/* One source for the layout budget (a hugging plate, pitch 28 keyboard / 41
   touch): the page draws it and settingsHit / graphicsHit read it, so a tap
   can never land on a row the plate did not paint. note = the line under the
   rows (CONTROLS on keyboard, dropped on touch; GRAPHICS' two-line help). */
function rowsGeom(L, n, note, touch) {
  const T = !!touch,
    pitch = T ? 41 : 28,
    S = pageBox(L, 500, n * pitch + note, T),
    rowH = pitch * S.f;
  return { S, y0: S.by, rowH, noteY: S.by + n * rowH + 6, n };
}
export const settingsGeom = (L, touch) => rowsGeom(L, OPT_N, touch ? 0 : 18, touch);
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
export const settingsHit = (x, y, L, _n, touch) => rowsHit(x, y, settingsGeom(L, touch));
export const graphicsHit = (x, y, L, _n, touch) => rowsHit(x, y, graphicsGeom(L, touch));
export function drawSettings(c, L, t, ui) {
  const u = ui || {};
  const cur = u.row | 0,
    r3d = !!u.r3d;
  const vals = settingsRows(u.vals, r3d, !!u.px, u.door);
  const g = settingsGeom(L, u.touch),
    S = g.S;
  boxPlate(c, S);
  head(c, S, "OPTIONS", u.kicker || "BUILD " + (u.rev || ""));
  const fk =
    typeof u.togT === "number" && u.togT >= 0 ? 1 - clamp01((t - u.togT) / 0.12) : 0;
  for (let i = 0; i < OPT_N; i++) {
    const sel = i === cur,
      dim = OPT_3D[i] && !r3d;
    c.globalAlpha = dim ? 0.45 : 1;
    paintRow(c, S.ix - 8, g.y0 + i * g.rowH + 1, S.iw + 16, g.rowH - 2, OPT_LABEL[i], dim ? "—" : vals[i], sel, { touch: u.touch, vc: TEXT, glow: sel ? fk : 0 });
    c.globalAlpha = 1;
  }
  /* CONTROLS: one line on keyboard — HOW TO PLAY keeps the long form with
     icons; touch drops it (the rows need the room). */
  if (!u.touch) {
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = MUTED;
    c.font = font(9);
    c.fillText(clip(c, "MOVE WASD/ARROWS · BOMB SPACE · THROW SHIFT+SPACE · REMOTE Q · PAUSE P", S.iw), S.mid, g.noteY + 4);
  }
  foot(c, S, u.touch ? FOOT_TAP : FOOT_KEYS);
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
