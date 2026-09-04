/* Per-screen menu chrome painted OVER the frozen arena — main.js calls
   drawShell once a frame, after the renderer, and routes everything to
   src/render/menudraw.js. BOOT and GAME keep their own overlays and draw
   nothing here. kindSize/dims are the one source of the logical box every
   screen measures against: a real canvas always wins, otherwise the render
   kind picks the classic box or the projected dimetric one. */
import { CFG } from "../core/config.js";
import { heatToken } from "../core/heat.js";
import { SCREEN, ITEMS } from "../app/menuapp.js";
import { PROJ } from "./r3d/camera.js";
import { drawLogo } from "./scenes.js";
import * as menudraw from "./menudraw.js";

export function kindSize(kind) {
  const iso = kind === "iso";
  return {
    w: iso ? PROJ.canvasW : CFG.COLS * CFG.TILE,
    h: iso ? PROJ.canvasH : CFG.ROWS * CFG.TILE,
  };
}

export function dims(canvas, kind) {
  const s = kindSize(kind);
  return { cw: canvas ? canvas.width : s.w, ch: canvas ? canvas.height : s.h };
}

export function drawShell(c, app, world, canvas, kind, getScores) {
  const s = app.screen;
  if (s === SCREEN.BOOT || s === SCREEN.GAME) return; // GAME keeps its own overlays
  const { cw, ch: chh } = dims(canvas, kind);
  if (s === SCREEN.INTRO) return menudraw.drawIntroChrome(c, app.subT, cw, chh);
  if (s === SCREEN.ATTRACT) {
    // no dim: the demo IS the show; only the blinking footer hint
    const L = menudraw.layout(cw, chh);
    menudraw.drawAttractHint(c, L, app.subT);
    return;
  }
  if (s === SCREEN.MENU) {
    const L = menudraw.layout(cw, chh);
    menudraw.drawDim(c, 0.62, cw, chh);
    // 0.25s INTRO→MENU fade-out (skip + natural end): extra veil k ramps
    // 1→0 over the first 0.25s of MENU entry (spec §1)
    if (app.subT < 0.25) menudraw.drawFade(c, 1 - app.subT / 0.25, cw, chh);
    // logo per spec §2: reuse drawLogo at logoScale via ctx.scale
    c.save();
    c.translate(L.cx, L.logoCy);
    c.scale(L.logoScale, L.logoScale);
    drawLogo(c, world.time, 0, 0);
    c.restore();
    menudraw.drawMenu(
      c,
      {
        cursor: app.cursor,
        enterT: app.subT,
        togT: app.togT,
        items: [
          ITEMS[0] + "|" + heatToken(app.heat),
          ITEMS[1] + "|" + heatToken(app.heat),
          "RENDER " + (app.render3d ? "REAL 3D" : "CLASSIC 2D"),
          "SOUND " + (app.sound ? "ON" : "OFF"),
          ITEMS[4],
          ITEMS[5],
          ITEMS[6],
          ITEMS[7],
          ITEMS[8],
        ],
      },
      L,
      app.subT,
    );
    return;
  }
  const L = menudraw.layout(cw, chh);
  if (s === SCREEN.LEVEL) {
    menudraw.drawDim(c, 0.72, cw, chh);
    menudraw.drawLevelSelect(
      c,
      app.level,
      L,
      app.subT,
      app.heat,
      app.pact,
      app.pactUnlocked,
      app.pace,
    );
  } else if (s === SCREEN.HOWTO) {
    menudraw.drawDim(c, 0.72, cw, chh);
    menudraw.drawHowTo(c, L, app.subT);
  } else if (s === SCREEN.ITEMS) {
    menudraw.drawDim(c, 0.72, cw, chh);
    menudraw.drawItemsHelp(c, L, app.subT);
  } else if (s === SCREEN.ENEMIES) {
    menudraw.drawDim(c, 0.72, cw, chh);
    menudraw.drawEnemiesHelp(c, L, app.subT);
  } else if (s === SCREEN.SCORES) {
    menudraw.drawDim(c, 0.72, cw, chh);
    menudraw.drawScores(c, getScores(), L, app.subT);
  }
}
