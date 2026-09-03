import { CFG, isFinale } from "../core/config.js";
import { HEAT_COL, heatToken } from "../core/heat.js";
import { drawIcon } from "./sprites.js";

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
  function sub(txt, col) {
    c.font = "15px ui-monospace,monospace";
    c.fillStyle = col || "#c3d2ee";
    c.fillText(txt, cx, cy + 20);
  }
  if (world.state === "MENU") {
    drawLogo(c, world.time, cx, cy);
    sub("Press FIRE / SPACE to start", "#9fb3d8");
    c.font = "11px ui-monospace,monospace";
    c.fillStyle = "#6f7fa0";
    c.fillText("clear every enemy to advance · collect power-ups", cx, cy + 44);
  } else if (world.state === "WIN") {
    const fin = isFinale(world.level) || world.finale;
    head(winHeadline(world), "#37f0d0");
    const heat = world.heat ? " · " + heatToken(world.heat) : "";
    sub(
      fin
        ? "Score " + world.score + heat + " · press FIRE for menu"
        : "Score " + world.score + heat + " · press FIRE for next level",
      "#9fb3d8",
    );
  } else if (world.state === "LOSE") {
    head("GAME OVER", "#ff5d73");
    sub(
      "Score " +
        world.score +
        (world.heat ? " · " + heatToken(world.heat) : "") +
        " · press FIRE to retry",
      "#9fb3d8",
    );
  } else if (world.state === "PAUSE") {
    head("PAUSED", "#ffd447");
    sub(
      (world.heat ? heatToken(world.heat) + " · " : "") + "press P to resume",
      "#9fb3d8",
    );
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
  chip(140, 76, "BOMB", p.bombs || 0, "#ffd447");
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
