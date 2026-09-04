/* MENU DRAWING LAYER — all menu/intro pixels as pure functions over a
   normalized layout valid at both 600x520 (2D) and 608x352 (3D). Reads only
   its args; never touches world/app state. Palette locked (spec §0/§2):
   accent #37f0d0, text #dfe7f5, muted #7385ad, veils rgba(7,10,18,a).
   Easing helpers duplicated from the intro beat table (spec §3) — this file
   must not import from src/app. */
import { roomCap } from "../core/config.js";
import { POWER, FOES } from "../core/entities.js";
import { HEAT_COL, HEAT_MARK, HEAT_NAME } from "../core/heat.js";
import { PACE_NAME } from "../core/pace.js";
import { pactLabel } from "../core/pact.js";
import { PACT, PACT_COL, PACT_NAME } from "../core/pact.js";
import { drawIcon, drawEnemyBody } from "./sprites.js";
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
const lerpEnd = (a, b, k) => b + (a - b) * (1 - k);
const DUR = 5.0; // intro total (matches app/intro)
const font = (size, weight) => (weight || "") + " " + size + "px " + MONO;
const LINE = "#26324a",
  PLATE = "rgba(8,12,22,0.92)";
function plate(c, x, y, w, h) {
  c.fillStyle = PLATE;
  c.fillRect(x, y, w, h);
  c.strokeStyle = LINE;
  c.lineWidth = 1;
  c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  c.strokeStyle = "rgba(55,240,208,0.20)";
  c.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
  c.fillStyle = ACCENT;
  c.globalAlpha = 0.5;
  c.fillRect(x + 12, y + 2, w - 24, 1.5);
  c.globalAlpha = 1;
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
function head(c, S, title, kicker) {
  c.textAlign = "center";
  c.textBaseline = "middle";
  if (kicker) {
    c.fillStyle = ACCENT;
    c.font = font(8, "900");
    c.fillText(kicker, S.mid, S.headY - 9);
  }
  c.fillStyle = TEXT;
  c.font = font(16, "900");
  c.fillText(title, S.mid, S.headY + 7);
}
function foot(c, S, s) {
  c.fillStyle = MUTED;
  c.font = font(10);
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(s, S.mid, S.footY);
}
function caret(c, x, y, h) {
  const hh = Math.max(6, Math.min(9, h * 0.38));
  c.fillStyle = ACCENT;
  c.beginPath();
  c.moveTo(x, y - hh);
  c.lineTo(x + 8, y);
  c.lineTo(x, y + hh);
  c.closePath();
  c.fill();
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

/* INTRO chrome over the live flyover: veil, logo reveal/exit, tagline, skip.
   logoP contract: 0..1 reveal (fade + slide 14px down), >1 exit
   ((p-1)*20px up, alpha 1-(p-1)) — beats identical to app/intro. */
export function drawIntroChrome(c, t, W, H) {
  const L = layout(W, H);
  const s = clamp01(t / DUR) * DUR;
  const veil =
    s < 2.8
      ? lerpEnd(0.55, 0.18, easeInOutCubic(seg(s, 1.4, 2.8)))
      : s < 4.2
        ? 0.18
        : lerpEnd(0.18, 0.62, easeOutCubic(seg(s, 4.2, 5.0)));
  c.fillStyle = "rgba(7,10,18," + veil + ")";
  c.fillRect(0, 0, W, H);
  const logoP =
    s < 1.4 ? easeOutCubic(seg(s, 0, 0.9)) : 1 + easeInCubic(seg(s, 1.4, 1.9));
  const reveal = Math.min(1, logoP),
    exit = Math.max(0, logoP - 1);
  const a = reveal * (1 - exit);
  if (a > 0.01) {
    const slide = 14 * (1 - reveal) - 20 * exit;
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
      const lt = t - i * 0.06;
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
  // tagline: PRESS ENTER at footY, fade-in x 1Hz blink (render-time only)
  const tagP = easeOutCubic(seg(s, 4.2, 5.0));
  if (tagP > 0) {
    const blink = 0.55 + 0.45 * Math.sin(2 * Math.PI * t);
    c.globalAlpha = tagP * Math.max(0, blink);
    c.fillStyle = ACCENT;
    c.font = font(13, "900");
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("PRESS ENTER", L.cx, L.footY);
    c.globalAlpha = 1;
  }
  // skip hint: bottom-right, appears from t=0.6
  const ha = easeOutCubic(seg(t, 0.6, 0.9));
  if (ha > 0) {
    c.globalAlpha = ha;
    c.fillStyle = MUTED;
    c.font = font(10);
    c.textAlign = "right";
    c.textBaseline = "middle";
    c.fillText("ANY KEY TO SKIP", W - 14, H - 12);
    c.globalAlpha = 1;
  }
}

/* MAIN MENU over the dimmed frozen arena. ui={cursor,items,enterT,togT}; item
   entries may carry a value token ("RENDER 3D"/"SOUND OFF") drawn in accent.
   §3 pinned row: the just-flipped value flashes accent, fading over 120ms from
   the machine's flip stamp togT (-1 = idle). The flipped row is necessarily
   the selected one (toggles go through confirm), so the glow rides sel.
   List plate sits under the logo with a small inset; rows stay inside the
   plate so the highlight never kisses the border. */
export function drawMenu(c, ui, L, t) {
  const cur = (ui && ui.cursor) | 0;
  const items = (ui && ui.items) || [];
  const et = ui && typeof ui.enterT === "number" ? ui.enterT : t;
  const fk =
    ui && typeof ui.togT === "number" && ui.togT >= 0
      ? 1 - clamp01((t - ui.togT) / 0.12)
      : 0;
  const n = items.length;
  const hintBand = 34;
  const logoBot = L.logoCy + 10 * L.logoScale;
  const bandTop = Math.max(logoBot + 8, 8);
  const bandBot = L.footY - hintBand;
  const padX = 16,
    padY = 12;
  const inner = Math.max(1, bandBot - bandTop - padY * 2);
  const span = n ? Math.min(L.itemH, Math.max(18, inner / n)) : L.itemH;
  const h = n * span + padY * 2;
  const y0 = bandTop + Math.max(0, (bandBot - bandTop - h) / 2);
  const rw = Math.min(L.cx * 2 - 56, 340);
  const bx = L.cx - rw / 2;
  plate(c, bx, y0, rw, h);
  const size = 13;
  const rh = Math.max(16, span - 4);
  const slotL = bx + padX + 22;
  const slotR = bx + rw - padX;
  c.textBaseline = "middle";
  for (let i = 0; i < n; i++) {
    const str = String(items[i]);
    const pipe = str.indexOf("|");
    let label, val, hasVal;
    if (pipe > 0) {
      label = str.slice(0, pipe);
      val = str.slice(pipe + 1);
      hasVal = true;
    } else {
      const sp = str.indexOf(" ");
      hasVal =
        sp > 0 &&
        (str.slice(0, sp) === "RENDER" || str.slice(0, sp) === "SOUND");
      label = hasVal ? str.slice(0, sp) : str;
      val = hasVal ? str.slice(sp).trim() : "";
    }
    const k = easeOutCubic(clamp01((et - i * 0.03) / 0.22));
    const y = y0 + padY + i * span + span / 2 + 6 * (1 - k);
    const sel = i === cur;
    c.globalAlpha = k;
    if (sel) {
      c.fillStyle = "rgba(55,240,208,0.14)";
      c.fillRect(bx + 8, y - rh / 2, rw - 16, rh);
      c.fillStyle = "rgba(55,240,208,0.40)";
      c.fillRect(bx + 8, y - rh / 2, rw - 16, 1);
      c.fillStyle = ACCENT;
      c.fillRect(bx + 8, y - rh / 2, 3, rh);
      caret(c, bx + 16, y, rh);
    }
    c.font = font(size, sel ? "900" : "");
    c.textAlign = "left";
    c.fillStyle = sel ? TEXT : MUTED;
    c.fillText(label, slotL, y);
    if (val) {
      c.textAlign = "right";
      c.fillStyle =
        val.indexOf("MAX") >= 0
          ? "#ff5d73"
          : val.indexOf("CORE") >= 0
            ? MUTED
            : ACCENT;
      if (sel && fk > 0) {
        c.shadowColor = c.fillStyle;
        c.shadowBlur = 14 * fk;
      }
      c.fillText(val, slotR, y);
      if (sel && fk > 0) c.shadowBlur = 0;
    }
    c.globalAlpha = 1;
  }
  c.fillStyle = MUTED;
  c.font = font(10);
  c.textAlign = "center";
  c.fillText("↑↓ MOVE · ENTER SELECT", L.cx, L.footY - 16);
  c.fillStyle = selAccent(items, cur);
  c.fillText("SOURCE  github.com/HMarzban/fusegrid", L.cx, L.footY);
}
function selAccent(items, cur) {
  return String(items[cur] || "").indexOf("SOURCE") === 0 ? ACCENT : MUTED;
}

/* LEVEL SELECT: five chips 44x34 gap 14; sel in 1..5. */
export function drawLevelSelect(c, sel, L, t, heat, pact, unlocked, pace) {
  const S = shell(c, L, 400);
  const h = heat | 0;
  let p = pace | 0;
  if (p < -1) p = -1;
  else if (p > 1) p = 1;
  const showPact = !!unlocked;
  head(c, S, "SELECT LEVEL", showPact ? "ROOM + HEAT + PACE + PACT" : "ROOM + HEAT + PACE");
  const rooms = roomCap(showPact);
  const chipW = showPact ? 34 : L.chipW;
  const chipGap = showPact ? 8 : L.chipGap;
  const total = rooms * chipW + (rooms - 1) * chipGap;
  const sx = S.mid - total / 2;
  const mid = (S.headY + 28 + S.footY - 22) / 2;
  const cy = Math.round(mid - (showPact ? 58 : 48));
  for (let i = 0; i < rooms; i++) {
    const x = sx + i * (chipW + chipGap),
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
    hg = 10,
    htot = 3 * hw + 2 * hg,
    hx0 = S.mid - htot / 2,
    hy = cy + 46;
  for (let i = 0; i < 3; i++) {
    const x = hx0 + i * (hw + hg),
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
    pg2 = 10,
    ptot2 = 3 * pw2 + 2 * pg2,
    px2 = S.mid - ptot2 / 2,
    pzy = hy + 34;
  for (let i = 0; i < 3; i++) {
    const x = px2 + i * (pw2 + pg2),
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
    const pw = 70,
      pg = 8,
      ptot = 4 * pw + 3 * pg,
      px0 = S.mid - ptot / 2,
      py = pzy + 34;
    const mask = pact | 0;
    for (let i = 0; i < 4; i++) {
      const x = px0 + i * (pw + pg),
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
      c.fillText(i + 1 + " " + PACT_NAME[i], x + pw / 2, py + 11);
    }
  }
  foot(
    c,
    S,
    showPact
      ? "ENTER START · ←/→ ROOM · ↑/↓ HEAT · [ ] PACE · 1–4 PACT · ESC"
      : "ENTER START · ←/→ ROOM · ↑/↓ HEAT · [ ] PACE · ESC BACK",
  );
}

/* HOW TO PLAY: control rows mirroring the page .hint, power-gate asterisks. */
export function drawHowTo(c, L, t) {
  const S = shell(c, L, 520);
  head(c, S, "HOW TO PLAY", "CONTROLS");
  const rows = [
    ["WASD / ARROWS", "move"],
    ["SPACE", "bomb"],
    ["SHIFT + SPACE", "throw *"],
    ["Q", "remote *"],
    ["K + MOVE", "kick *"],
    ["P", "pause"],
  ];
  const cols = 2,
    noteY = S.footY - 30;
  const y0 = S.headY + 22,
    avail = noteY - 10 - y0;
  const rh = Math.min(40, avail / 3);
  const cw = S.iw / cols;
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
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.fillStyle = ACCENT;
    c.font = font(9, "900");
    c.fillText(rows[i][0], x + 10, y + (rh - 6) / 2 - 6);
    c.fillStyle = TEXT;
    c.font = font(12);
    c.fillText(rows[i][1], x + 10, y + (rh - 6) / 2 + 8);
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
    "clear every enemy · 5 rooms · gold wall never breaks",
    S.mid,
    noteY + 14,
  );
  foot(c, S, "ESC / ENTER BACK");
}

/* ITEMS: two-column catalog of every POWER pickup. */
export function drawItemsHelp(c, L, t) {
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
    c.save();
    c.translate(ix, iy);
    c.scale((ws / 28) * 0.72, (ws / 28) * 0.72);
    drawIcon(c, p.t, p.col, t);
    c.restore();
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

/* ENEMIES: two-column field guide of every FOES type, live 2D bodies. */
export function drawEnemiesHelp(c, L, t) {
  const S = shell(c, L, 560);
  head(c, S, "ENEMIES", "FIELD GUIDE");
  const n = FOES.length,
    cols = 2,
    rows = Math.ceil(n / cols);
  const gap = 7;
  const y0 = S.headY + 20,
    y1 = S.footY - 18;
  const cw = (S.iw - gap) / cols,
    ch = (y1 - y0) / rows - 3;
  const ws = Math.min(32, Math.max(18, ch - 14));
  const dummy = {
    type: "walker",
    color: "#8affc1",
    r: 14,
    home: { x: 0, y: 0 },
    invuln: false,
  };
  const world = { time: t };
  for (let i = 0; i < n; i++) {
    const f = FOES[i],
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
    well(c, ix, iy, ws, f.col);
    dummy.type = f.t;
    dummy.color = f.col;
    c.save();
    c.translate(ix, iy);
    c.scale(ws / 40, ws / 40);
    drawEnemyBody(c, world, dummy);
    c.restore();
    const tx = x + ws + 18,
      mid = y + ch / 2;
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.fillStyle = TEXT;
    c.font = font(ch < 40 ? 10 : 12, "900");
    c.fillText(f.name, tx, mid - 11);
    c.fillStyle = MUTED;
    c.font = font(ch < 40 ? 8 : 9);
    c.fillText(f.help, tx, mid + 3);
    c.fillStyle = ACCENT;
    c.globalAlpha = 0.75;
    c.font = font(8, "900");
    c.fillText("ROOMS " + f.rooms, tx, mid + 15);
    c.globalAlpha = 1;
  }
  foot(c, S, "TOUCH HURTS · BOMB TO CLEAR · ESC BACK");
}

/* HIGH SCORES: RANK / SCORE / LEVEL / DATE fitted inside the plate.
   Row pitch is derived from the inner body, not L.tableY / L.rowH, so all
   ten runs plus the in-plate ESC BACK stay inside the shell at 352 and 520. */
export function drawScores(c, scores, L, t) {
  const S = shell(c, L, 480);
  head(c, S, "HIGH SCORES", "BEST RUNS");
  const list = Array.isArray(scores) ? scores : [];
  const nShow = Math.min(10, list.length);
  const bodyTop = S.headY + 22,
    bodyBot = S.footY - 18;
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
  foot(c, S, "ESC BACK");
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
  c.fillText("DEMO — PRESS ANY KEY", L.cx, L.footY);
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
