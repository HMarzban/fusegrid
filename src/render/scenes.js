import { CFG, isFinale, biomeOf } from "../core/config.js";
import { HEAT_COL, heatToken, HEAT_NAME, clampHeat } from "../core/heat.js";
import { drawIcon } from "./sprites.js";
import { rr } from "./icons.js";

/* Scene UI: menu logo, HUD, and the CLEARED / GAME OVER / PAUSED overlays.
   Pure draw; reads world + (optionally) DOM for HUD. */
export function drawLogo(
  c,
  time,
  cx = (CFG.COLS * CFG.TILE) / 2,
  cy = (CFG.ROWS * CFG.TILE) / 2,
) {
  c.save();
  c.textAlign = "center";
  c.textBaseline = "middle";
  const x = cx,
    y = cy - 34;
  function text(txt, yy, size, fill, outline) {
    c.font = "900 " + size + "px ui-monospace,monospace";
    c.lineWidth = size * 0.14;
    c.strokeStyle = outline || "#0a0d14";
    c.lineJoin = "round";
    c.strokeText(txt, x, yy);
    c.fillStyle = fill;
    c.fillText(txt, x, yy);
  }
  text("FUSE", y - 30, 34, "#ffd447", "#3a2a00");
  text("GRID", y + 18, 46, "#ff5d73", "#3a0014");
  c.restore();
}
export function winHeadline(world) {
  return isFinale(world.level) || world.finale
    ? "FUSE/GRID CLEAR"
    : "LEVEL " + world.level + " CLEARED";
}
export function overlayCue(world) {
  if (world.state === "WIN") {
    const fin = isFinale(world.level) || world.finale;
    return fin ? "SPACE / TAP · menu" : "SPACE / TAP · next room";
  }
  if (world.state === "LOSE") return "SPACE / TAP · new run";
  if (world.state === "PAUSE") return "P · resume · M / MENU · quit";
  return "";
}
export function runStamp(world) {
  const lv = world.level | 0;
  const bio = biomeOf(lv).name;
  const heat = HEAT_NAME[clampHeat(world.heat)];
  return "L" + lv + " " + bio + " · " + heat + " · " + (world.score | 0);
}
export function copyPayload(world) {
  return runStamp(world) + " https://hmarzban.github.io/fusegrid/";
}
export function drawOverlay(
  c,
  world,
  w = CFG.COLS * CFG.TILE,
  h = CFG.ROWS * CFG.TILE,
  cx = w / 2,
  cy = h / 2,
) {
  c.fillStyle = "rgba(6,10,20,0.80)";
  c.fillRect(0, 0, w, h);
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineWidth = 5;
  c.strokeStyle = "#0a0d14";
  c.lineJoin = "round";
  function head(txt, col) {
    c.font = "900 40px ui-monospace,monospace";
    c.strokeText(txt, cx, cy - 16);
    c.fillStyle = col;
    c.fillText(txt, cx, cy - 16);
  }
  function sub(txt, col, dy = 20) {
    c.font = "15px ui-monospace,monospace";
    c.fillStyle = col || "#c3d2ee";
    c.fillText(txt, cx, cy + dy);
  }
  if (world.state === "WIN") {
    head(winHeadline(world), "#37f0d0");
    sub(runStamp(world), "#9fb3d8");
    sub(overlayCue(world) + " · C copy", "#9fb3d8", 44);
  } else if (world.state === "LOSE") {
    head("GAME OVER", "#ff5d73");
    sub(runStamp(world), "#9fb3d8");
    sub(overlayCue(world) + " · C copy", "#9fb3d8", 44);
  } else if (world.state === "PAUSE") {
    head("PAUSED", "#ffd447");
    sub(overlayCue(world), "#9fb3d8");
  }
}
export function updateHud(hud, world) {
  const p = world.players[0];
  const set = (id, v) => {
    if (hud && hud[id]) hud[id].textContent = v;
  };
  set("score", world.score);
  set("level", world.level);
  set("lives", world.lives);
  set("enemies", world.enemies.length);
  if (p) {
    set("bombs", p.bombs);
    set("range", p.range);
  }
}
export function makeHud(dom) {
  return {
    score: dom && dom.getElementById ? dom.getElementById("score") : null,
    level: dom && dom.getElementById ? dom.getElementById("level") : null,
    lives: dom && dom.getElementById ? dom.getElementById("lives") : null,
    enemies: dom && dom.getElementById ? dom.getElementById("enemies") : null,
    bombs: dom && dom.getElementById ? dom.getElementById("bombs") : null,
    range: dom && dom.getElementById ? dom.getElementById("range") : null,
  };
}

/* S4 overlay HUD chips (real3d §3): lives as heart glyphs, BOMB/FLAME as
   icon+count chips, painted on the overlay ctx in board space. Palette and
   mono type match menudraw; the DOM #hud ids stay authoritative via
   updateHud — these chips are the in-arena readout. Opt-in per frame via
   o.hud===true so menus/attract keep their authored canvases untouched. */
const HUD_TEXT = "#dfe7f5",
  HUD_MUTED = "#7385ad",
  HUD_PANEL = "rgba(13,18,32,0.72)",
  HUD_LINE = "#26324a";
export function drawHudChips(c, world) {
  const p = world.players[0] || {};
  c.save();
  c.textBaseline = "middle";
  c.textAlign = "left";
  const lives = Math.max(0, world.lives | 0);
  const n = Math.min(lives, 6);
  for (let i = 0; i < n; i++) {
    c.save();
    c.translate(16 + i * 19, 25);
    c.scale(0.62, 0.62);
    drawIcon(c, "heart", "#ff3b5c", 0);
    c.restore();
  }
  if (lives > n) {
    c.fillStyle = HUD_TEXT;
    c.font = "900 12px ui-monospace,monospace";
    c.fillText("+" + (lives - n), 16 + 6 * 19, 25);
  }
  const chip = (x, w, label, count, col) => {
    c.fillStyle = HUD_PANEL;
    c.fillRect(x, 10, w, 30);
    c.strokeStyle = HUD_LINE;
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, 10.5, w - 1, 29);
    c.save();
    c.translate(x + 17, 25);
    c.scale(0.55, 0.55);
    drawIcon(c, label === "BOMB" ? "bomb" : "fire", col, 0);
    c.restore();
    c.fillStyle = HUD_MUTED;
    c.font = "9px ui-monospace,monospace";
    c.fillText(label, x + 31, 18);
    c.fillStyle = HUD_TEXT;
    c.font = "900 13px ui-monospace,monospace";
    c.fillText(String(count), x + 31, 33);
  };
  chip(140, 76, "BOMB", p.bombs || 0, "#ff5d73");
  chip(224, 82, "FLAME", p.range || 0, "#ff8a3c");
  const scx = CFG.COLS * CFG.TILE - 12;
  c.textAlign = "right";
  const hk = world.heat | 0;
  c.fillStyle = HEAT_COL[hk] || HUD_MUTED;
  c.font = "9px ui-monospace,monospace";
  c.fillText(heatToken(hk), scx, 18);
  c.fillStyle = HUD_TEXT;
  c.font = "900 13px ui-monospace,monospace";
  c.fillText(String(world.score | 0), scx, 33);
  c.restore();
}

/* Ghost coach (first-run nudge): faded W A S D + a SPACE pill drawn once so a
   first-time player sees the controls, then never again. In CLASSIC 2D this
   paints straight onto the board context near the spawn tile (1,1); in REAL
   3D it paints onto the fixed HUD-space overlay canvas instead (wrapper.js),
   so it is NOT tied to any world tile there — a fixed on-screen panel, same
   as the HUD chips. Persist state (nb.coach.v1) and the fade duration
   (COACH_DUR) live in src/app/coach.js — render/ must not import src/app
   (only shellview.js may, for screen constants), so main.js precomputes the
   fade alpha from COACH_DUR and passes the plain number down; this file
   never re-derives it. */
const COACH_TEXT = "#eef3ff",
  COACH_PANEL = "rgba(10,14,24,0.82)",
  COACH_LINE = "#3a4a6a";
export function drawCoach(c, alpha) {
  if (!(alpha > 0)) return;
  c.save();
  c.globalAlpha = alpha;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineWidth = 1;
  c.strokeStyle = COACH_LINE;
  const ox = CFG.TILE * 2.4,
    oy = CFG.TILE * 1.3,
    ks = 22,
    gap = 4;
  const cap = (dx, dy, label) => {
    c.fillStyle = COACH_PANEL;
    rr(c, ox + dx, oy + dy, ks, ks, 5);
    c.fill();
    c.stroke();
    c.fillStyle = COACH_TEXT;
    c.font = "900 12px ui-monospace,monospace";
    c.fillText(label, ox + dx + ks / 2, oy + dy + ks / 2 + 1);
  };
  cap(ks + gap, 0, "W");
  cap(0, ks + gap, "A");
  cap(ks + gap, ks + gap, "S");
  cap((ks + gap) * 2, ks + gap, "D");
  const pw = (ks + gap) * 3 - gap,
    ph = 18,
    py = oy + (ks + gap) * 2 + 6;
  c.fillStyle = COACH_PANEL;
  rr(c, ox, py, pw, ph, 8);
  c.fill();
  c.stroke();
  c.fillStyle = COACH_TEXT;
  c.font = "900 10px ui-monospace,monospace";
  c.fillText("SPACE", ox + pw / 2, py + ph / 2 + 1);
  c.restore();
}
