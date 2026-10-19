/* Per-screen menu chrome painted OVER the frozen arena — main.js calls
   drawShell once a frame, after the renderer, and routes everything to
   src/render/menudraw.js. BOOT and GAME keep their own overlays and draw
   nothing here. kindSize/dims are the one source of the logical box every
   screen measures against: a real canvas always wins, otherwise the render
   kind picks the classic box or the projected dimetric one. */
import { CFG, biomeOf } from "../core/config.js";
import { HEAT_NAME, clampHeat } from "../core/heat.js";
import { paceToken } from "../core/pace.js";
import { clampPact, pactLabel } from "../core/pact.js";
import { clampPace } from "../core/pace.js";
import { SCREEN, ITEMS } from "../app/menuapp.js";
import { PROJ } from "./r3d/camera.js";
import { drawLogo, overlayBox, touchLay, fmtTime } from "./scenes.js";
import * as menudraw from "./menudraw.js";
import { CACHE_NAME } from "../pwa/shell.js";

export function kindSize(kind) {
  const iso = kind === "iso";
  return {
    w: iso ? PROJ.canvasW : CFG.COLS * CFG.TILE,
    h: iso ? PROJ.canvasH : CFG.ROWS * CFG.TILE,
  };
}

/* Build kicker for the OPTIONS head. CACHE_NAME is the only build identifier
   in the repo, and the PWA rule already forces it to change whenever shipped
   bytes do — same precedent as scores arriving through a getter: a screen fed
   from outside app/world gets its value handed in, not re-derived downstream. */
const REV = CACHE_NAME.replace("fusegrid-shell-", "");

/* body[data-lay], the one layout predicate fit.js writes (d / p / l); "d" in Node. */
const layOf = (cv) => {
  const b = cv && cv.ownerDocument && cv.ownerDocument.body;
  return (b && b.getAttribute && b.getAttribute("data-lay")) || "d";
};

/* PLAY's tag is the whole setup it will start, worded like LEVEL SELECT's
   START: room (by its world name), heat, pace (+pact). */
const playTag = (app) => {
  const p = app.pactUnlocked ? clampPact(app.pact) : 0;
  return biomeOf(app.level | 0 || 1).name + " · " + HEAT_NAME[clampHeat(app.heat)] + " · " + paceToken(app.pace) + (p ? " · " + pactLabel(p) : "");
};
/* The screens a touch-portrait phone draws on #sh's own box (fit.js
   shellGeo): MENU and every plated page. INTRO, ATTRACT and GAME (PAUSE and
   WIN/LOSE included) stay on the board canvas and its box. */
const SHELL_ON = new Set([SCREEN.MENU, SCREEN.LEVEL, SCREEN.HOWTO, SCREEN.SCORES, SCREEN.ITEMS, SCREEN.ENEMIES, SCREEN.SETTINGS, SCREEN.GUIDE, SCREEN.STATS, SCREEN.TROPHIES, SCREEN.GRAPHICS]);
export const isShellScreen = (s) => SHELL_ON.has(s);
export function dims(canvas, kind) {
  const s = kindSize(kind);
  return { cw: canvas ? canvas.width : s.w, ch: canvas ? canvas.height : s.h, lg: canvas ? canvas.logo : undefined }; // lg: #sh's logo line (fit.js shellGeo)
}

/* GRAPHICS page data arrives finished from the app (gfx.js strings via
   app.gfxView()); this module only hands it on, like app.stats. */
const doorOf = (app) => (app.gfxPreset ? app.gfxPreset() + " ›" : "");
const gfxUi = (app, canvas, kicker) => ({
  kicker,
  row: app.gfxRow,
  view: app.gfxView ? app.gfxView() : null,
  togT: app.togT,
  chg: app.gfxChg,
  touch: layOf(canvas) !== "d",
});

/* SCORES / plaques memo: nothing writes either store while SCORES is open
   (a reset reloads the page), so the getters run on entry, on a heat change
   (scores) and whenever main hands in a different getter — never per frame. */
let prevScreen = -1,
  memo = null;
function scoreData(app, getScores, getPlaques) {
  const m = memo,
    stay = !!m && prevScreen === SCREEN.SCORES;
  memo = {
    h: app.scoreHeat,
    gs: getScores,
    gp: getPlaques,
    s: stay && m.h === app.scoreHeat && m.gs === getScores ? m.s : getScores(app.scoreHeat),
    p: stay && m.gp === getPlaques ? m.p : getPlaques ? getPlaques() : 0,
  };
  return memo;
}

/* ATLAS info (MENU pane + hub teasers, LEVEL SELECT card + room ticks).
   getCab hands main's read-only stores {times, medals, stats, daily}; they
   are read once per screen entry (nothing writes them while a menu page is
   open) and formatted here, so menudraw never reads a store. heatT stamps
   every heat change (the card's heat-line pulse); lockT is honoured only
   when main stamped it on THIS visit. */
let cab = null,
  cabFor = -1,
  heatSeen = null,
  heatT = -1,
  lockSeen = null,
  top3 = [];
const bits = (m) => { let n = 0; for (let v = m | 0; v; v &= v - 1) n++; return n; };
function infoOf(app, kind, getScores, getCab) {
  if (cabFor !== app.screen) {
    cabFor = app.screen;
    cab = (getCab && getCab()) || {};
    top3 = Array.isArray(cab.top) ? cab.top : []; // played runs only (main drops the seeded placeholders)
    heatSeen = app.heat;
    heatT = -1;
    lockSeen = app.lockT;
  }
  if (app.heat !== heatSeen) {
    heatSeen = app.heat;
    heatT = app.subT;
  }
  const h = clampHeat(app.heat),
    pact = app.pactUnlocked ? clampPact(app.pact) : 0,
    pz = clampPace(app.pace) + 1,
    tb = (cab.times && cab.times.b) || {},
    a = (cab.stats && cab.stats.a) || {},
    st = app.settings || {};
  return {
    kind, heatT, level: app.level | 0 || 1, heat: h, pact, unlocked: !!app.pactUnlocked,
    lockR: app.lockR, lockT: app.lockT !== lockSeen ? app.lockT : null,
    best: Array.from({ length: 8 }, (_, i) => { const d = tb[i + 1 + ":" + h + ":" + pact + ":" + pz]; return d > 0 ? fmtTime(d / 10) : null; }),
    daily: cab.daily || null, mask: cab.medals | 0, medals: bits(cab.medals), days: a.days | 0, runs: a.runs | 0, rooms: a.rooms | 0, kills: a.kills | 0,
    top: top3, look: app.render3d ? 2 : app.pixel ? 1 : 0, snd: st.snd !== 0, mus: st.mus, sfx: st.sfx, gfx: app.gfxPreset ? app.gfxPreset() : "",
  };
}

/* FPS METER (GRAPHICS row 7) paints after every screen's chrome, GAME
   included, against the same box that screen measures with. */
export function drawShell(c, app, world, canvas, kind, getScores, getPlaques, getCab) {
  const s = app.screen;
  shellBody(c, app, world, canvas, kind, getScores, getPlaques, getCab);
  prevScreen = s;
  if (s === SCREEN.BOOT || !app.settings || app.settings.fpm !== 1) return;
  const B = s === SCREEN.GAME ? overlayBox(kind) : null,
    d = B ? null : dims(canvas, kind);
  const idle = s === SCREEN.GAME ? world.state !== "PLAY" : !(s === SCREEN.INTRO && app.introStage === 1); // main's frame-gate idle predicate
  menudraw.drawMeter(c, B ? B.w : d.cw, B ? B.h : d.ch, app.gfx, idle);
}

function shellBody(c, app, world, canvas, kind, getScores, getPlaques, getCab) {
  const s = app.screen;
  if (s === SCREEN.BOOT) return;
  if (s === SCREEN.GAME) {
    /* All shell chrome routing stays in the one module whose job it is. The
       paused OPTIONS / GRAPHICS pages measure against overlayBox — the SAME
       box the pause list uses — never dims(canvas, kind), so list and page
       never disagree by a pixel. */
    if (world.state === "PAUSE" && app.pauseView >= 1) {
      // no second dim: drawOverlay's 0.72 PAUSE veil is the one wash, so the
      // HUD stays lit as run context on every pause view
      const B = overlayBox(kind),
        kicker = "PAUSED · ROOM " + (world.level | 0);
      if (app.pauseView === 2)
        return menudraw.drawGraphics(c, menudraw.layout(B.w, B.h), app.subT, gfxUi(app, canvas, kicker));
      menudraw.drawSettings(c, menudraw.layout(B.w, B.h), app.subT, {
        kicker,
        row: app.optRow,
        vals: app.settings,
        r3d: app.render3d,
        px: app.pixel,
        togT: app.togT,
        rev: REV,
        door: doorOf(app),
        touch: layOf(canvas) !== "d",
      });
    }
    return;
  }
  const { cw, ch: chh, lg: logoY } = dims(canvas, kind);
  if (s === SCREEN.INTRO) // board alpha eases the veil from opaque once the board is ready (3D waits on three)
    return menudraw.drawIntroChrome(c, app.introStage, app.subT, cw, chh, layOf(canvas), app.boardReady ? Math.min(1, app.readyT / 0.4) : 0);
  if (s === SCREEN.ATTRACT) {
    // no dim: the demo IS the show; only the blinking footer hint
    const L = menudraw.layout(cw, chh, logoY);
    menudraw.drawAttractHint(c, L, app.subT);
    return;
  }
  if (s === SCREEN.MENU) {
    const L = menudraw.layout(cw, chh, logoY),
      touch = touchLay(canvas), // the predicate main.js taps with
      lg = menudraw.menuLogo(L); // one logo for both layouts: the touch hub sits under it
    // the show's natural end slams the logo over a ramping dim; any other
    // MENU entry (a skip included) keeps the 0.25s fade-out (spec §1)
    const sl = app.fromShow ? menudraw.slamOf(app.subT) : null;
    menudraw.drawDim(c, sl ? sl.dim : 0.62, cw, chh);
    if (!sl && app.subT < 0.25) menudraw.drawFade(c, 1 - app.subT / 0.25, cw, chh);
    // logo per spec §2: reuse drawLogo at logoScale via ctx.scale
    c.save();
    const ls = lg.s * (sl ? sl.s : 1);
    c.translate(L.cx, touch ? Math.max(lg.cy, 4 + 83 * ls) : lg.cy); // the slam's 1.35x never clips the touch logo off the top
    c.scale(ls, ls);
    if (sl) c.globalAlpha = sl.a;
    drawLogo(c, world.time, 0, 0);
    c.restore();
    menudraw.drawMenu(
      c,
      {
        cursor: app.cursor,
        enterT: sl ? app.subT - sl.hold : app.subT, // the show's blast plays out before the rows
        items: [
          ITEMS[0] + "|" + playTag(app),
          ITEMS[1],
          ITEMS[2] + "|" + app.dailyTag,
          ITEMS[3],
          ITEMS[4],
          ITEMS[5],
          ITEMS[6],
          ITEMS[7],
        ],
        touch,
        kind,
        info: infoOf(app, kind, getScores, getCab),
      },
      L,
      app.subT,
    );
    return;
  }
  const L = menudraw.layout(cw, chh, logoY);
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
      app.timeAttack,
      touchLay(canvas),
      infoOf(app, kind, getScores, getCab),
    );
  } else if (s === SCREEN.HOWTO) {
    menudraw.drawDim(c, 0.72, cw, chh);
    menudraw.drawHowTo(c, L, app.subT, kind, touchLay(canvas));
  } else if (s === SCREEN.ITEMS) {
    menudraw.drawDim(c, 0.72, cw, chh);
    menudraw.drawItemsHelp(c, L, app.subT, kind, touchLay(canvas));
  } else if (s === SCREEN.ENEMIES) {
    menudraw.drawDim(c, 0.72, cw, chh);
    menudraw.drawEnemiesHelp(c, L, app.subT, kind, touchLay(canvas));
  } else if (s === SCREEN.GUIDE) {
    menudraw.drawDim(c, 0.72, cw, chh);
    menudraw.drawGuide(c, L, app.subT, app.guideRow, kind, touchLay(canvas));
  } else if (s === SCREEN.SCORES) {
    menudraw.drawDim(c, 0.72, cw, chh);
    const sd = scoreData(app, getScores, getPlaques);
    menudraw.drawScores(c, sd.s, L, app.subT, app.scoreHeat, sd.p, touchLay(canvas));
  } else if (s === SCREEN.STATS) {
    menudraw.drawDim(c, 0.72, cw, chh);
    menudraw.drawStats(c, L, app.subT, app.stats, app.resetArm, app.toast && app.toast.t > 0 ? app.toast : null);
  } else if (s === SCREEN.TROPHIES) {
    menudraw.drawDim(c, 0.72, cw, chh);
    menudraw.drawTrophies(c, L, app.subT, app.stats && app.stats.trophies);
  } else if (s === SCREEN.SETTINGS) {
    menudraw.drawDim(c, 0.72, cw, chh);
    menudraw.drawSettings(c, L, app.subT, {
      row: app.optRow,
      vals: app.settings,
      r3d: app.render3d,
      px: app.pixel,
      togT: app.togT,
      rev: REV,
      door: doorOf(app),
      touch: layOf(canvas) !== "d",
    });
  } else if (s === SCREEN.GRAPHICS) {
    menudraw.drawDim(c, 0.72, cw, chh);
    menudraw.drawGraphics(c, L, app.subT, gfxUi(app, canvas));
  }
}
