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
import { hints } from "./hintcopy.js";

export function kindSize(kind) {
  const iso = kind === "iso";
  return {
    w: iso ? PROJ.canvasW : CFG.COLS * CFG.TILE,
    h: iso ? PROJ.canvasH : CFG.ROWS * CFG.TILE,
  };
}

/* Build tag for the OPTIONS head kicker and the MENU foot. CACHE_NAME is the only build identifier
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
const SHELL_ON = new Set([SCREEN.MENU, SCREEN.LEVEL, SCREEN.HOWTO, SCREEN.SCORES, SCREEN.ITEMS, SCREEN.ENEMIES, SCREEN.SETTINGS, SCREEN.GUIDE, SCREEN.STATS, SCREEN.TROPHIES, SCREEN.GRAPHICS, SCREEN.FLOOR, SCREEN.CONTROLS]);
export const isShellScreen = (s) => SHELL_ON.has(s);
export function dims(canvas, kind) {
  const s = kindSize(kind);
  return { cw: canvas ? canvas.width : s.w, ch: canvas ? canvas.height : s.h, lg: canvas ? canvas.logo : undefined }; // lg: #sh's logo line (fit.js shellGeo)
}

/* GRAPHICS page data arrives finished from the app (gfx.js strings via
   app.gfxView()); this module only hands it on, like app.stats. */
const doorOf = (app) => (app.gfxPreset ? app.gfxPreset() + " ›" : "");
/* The door names the last-used device; a touch layout reads CONTROLLER. */
const ctlDoorOf = (app, canvas) => (app.lastDev === "key" && layOf(canvas) === "d" ? "KEYBOARD ›" : "CONTROLLER ›");
/* OPTIONS' ui, one literal for the screen and the inline PAUSE page. */
const padVibOf = (app) => (app.controls ? menudraw.vibWord(app.controls.view(app.ctlT)) : "");
/* The RENDER row's job note (menudraw lookNote), stepped every frame on any
   screen so a job's age is true when OPTIONS opens mid-load. app.lookJob is
   rcache's job read through a getter (a function or a property); null = none. */
let lookM = null, lookN = null;
const nowS = () => (globalThis.performance && typeof performance.now === "function" ? performance.now() / 1000 : 0);
const jobOf = (app) => { const j = typeof app.lookJob === "function" ? app.lookJob() : app.lookJob; return j || null; };
export function stepLookNote(app, now = nowS()) {
  const r = menudraw.lookNote(lookM, jobOf(app), now, app.render3d ? "3d" : app.pixel ? "px" : "2d");
  lookM = r.m;
  return (lookN = r.n);
}
/* index.html's loader (window.__load) paints the DOM chip. row: the RENDER row is
   on screen, so the docked plate stays down; off: live PLAY or the INTRO show,
   where no loading surface shows. The chip sits top-centre inside the drawn
   stage (#c, or #sh's box), 4 css px under its top: clear of the MENU logo line
   (its top is >= 37 logical px down on every box), and never over the PAUSE pill
   or the touch pad, which live outside the stage. The rect is read only while the
   loader has something docked to place. */
export function loaderSpot(app, world, canvas, host = globalThis) {
  const L = host.__load;
  if (!L || typeof L.spot !== "function") return null;
  const s = app.screen, game = s === SCREEN.GAME, st = world && world.state;
  const o = {
    row: s === SCREEN.SETTINGS || (game && st === "PAUSE" && (app.pauseView === 1 || (!app.pauseView && !!app.lookNext))), // PAUSE's kicker says it: one indicator
    off: s === SCREEN.BOOT || (game && st === "PLAY") || (s === SCREEN.INTRO && app.introStage === 1),
    x: null, y: null, w: null,
  };
  const r = (!L.wants || L.wants()) && canvas && typeof canvas.getBoundingClientRect === "function" ? canvas.getBoundingClientRect() : null;
  if (r && r.width > 0) { o.x = r.left + r.width / 2; o.y = r.top + 4; o.w = r.width - 16; }
  L.spot(o);
  return o;
}
const optUi = (app, canvas, kicker) => ({
  kicker,
  job: lookN,
  row: app.optRow,
  vals: app.settings,
  r3d: app.render3d,
  px: app.pixel,
  togT: app.togT,
  rev: REV,
  door: doorOf(app),
  ctlDoor: ctlDoorOf(app, canvas),
  padVib: padVibOf(app),
  ana: app.analytics,
  anaNote: app.anaNote,
  touch: layOf(canvas) !== "d",
});
const gfxUi = (app, canvas, kicker) => ({
  kicker,
  row: app.gfxRow,
  view: app.gfxView ? app.gfxView() : null,
  togT: app.togT,
  chg: app.gfxChg,
  touch: layOf(canvas) !== "d",
});

/* CONTROLS draws and taps through one set of arguments, so a tap lands where
   the plate is drawn. The row floor is 44 CSS px, so it needs this box's real
   CSS scale; with no usable rect geoFor takes its worst case. paused = the
   inline pauseView 3, measured against overlayBox like the other PAUSE pages. */
const cssScale = (cv) => {
  const r = cv && cv.width > 0 && cv.getBoundingClientRect ? cv.getBoundingClientRect().width / cv.width : 0;
  return r > 0 && Number.isFinite(r) ? r : undefined;
};
const ctlLayout = (canvas, kind, paused) => {
  if (paused) { const B = overlayBox(kind); return menudraw.layout(B.w, B.h); }
  const { cw, ch, lg } = dims(canvas, kind);
  return menudraw.layout(cw, ch, lg);
};
const HUD_BOT = 40, STRIP = "#0a0e18"; // the HUD strip's floor; the plate's ground, opaque
const ctlUi = (canvas, L) => ({ touch: layOf(canvas) !== "d", narrow: L.narrow, scale: cssScale(canvas) });
/* The CONTROLS paint (controlsdraw, controlsgeo, padart) is not in the boot
   graph (v202): it loads when CONTROLS opens or in idle after the title
   (controlswire asks through main). Until it lands the page is one plate that
   says LOADING, and a tap on the canvas finds nothing. */
let art = null, artP = null;
/** Loads the CONTROLS paint once; resolves when it is in. A failed load is retried on the next call. */
export function loadControlsArt() {
  return artP || (artP = Promise.all([import("./controlsdraw.js"), import("./controlsgeo.js")]).then(([d, g]) => { art = { draw: d.drawControls, geoFor: g.geoFor, hitPage: g.hitPage }; }, (e) => { artP = null; throw e; }));
}
/** The CONTROLS page's geometry for this box, the same one it paints with; null until the paint is in. */
export function controlsGeo(canvas, kind, paused) {
  if (!art) return null;
  const L = ctlLayout(canvas, kind, paused), u = ctlUi(canvas, L);
  return art.geoFor(L, u.touch, u.narrow, u.scale);
}
/** A tap on the CONTROLS page: controlsgeo's hitPage on the painted geometry; null (inert) until the paint is in. */
export const controlsHit = (view, x, y, canvas, kind, paused) => (art ? art.hitPage(view, x, y, controlsGeo(canvas, kind, paused)) : null);
const paintControls = (c, app, canvas, kind, paused) => {
  const L = ctlLayout(canvas, kind, paused), u = ctlUi(canvas, L);
  if (!art || app.controls.loading) {
    const S = menudraw.pageBox(L, 360, 0, u.touch), failed = !!app.controls.failed;
    menudraw.plate(c, S.x, S.y, S.w, S.h);
    menudraw.head(c, S, "CONTROLS", failed ? "DID NOT LOAD" : "LOADING");
    if (failed) menudraw.foot(c, S, "OPEN IT AGAIN TO RETRY");
    return;
  }
  /* A phone's plate climbs over the HUD strip and stops short of its ends, which would leave a heart cut to a sliver: cover the whole strip. */
  if (paused && art.geoFor(L, u.touch, u.narrow, u.scale).y < HUD_BOT) { c.fillStyle = STRIP; c.fillRect(4, 10, L.cx * 2 - 8, 30); } // a 2D heart overhangs the strip's own x 10
  art.draw(c, L, app.controls.view(app.ctlT), { ...u, words: hints() });
};

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
/* Read live: a pad can wake while MENU is open. */
const padOn = (app) => { const st = app.controls ? app.controls.view(app.ctlT).pad.state : "none"; return st === "ready" || st === "nonstd"; };
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
    kind, heatT, tiles: !!cab.tiles, level: app.level | 0 || 1, heat: h, pact, unlocked: !!app.pactUnlocked,
    lockR: app.lockR, lockT: app.lockT !== lockSeen ? app.lockT : null,
    best: Array.from({ length: 8 }, (_, i) => { const d = tb[i + 1 + ":" + h + ":" + pact + ":" + pz]; return d > 0 ? fmtTime(d / 10) : null; }),
    daily: cab.daily || null, mask: cab.medals | 0, medals: bits(cab.medals), days: a.days | 0, runs: a.runs | 0, rooms: a.rooms | 0, kills: a.kills | 0,
    top: top3, look: app.render3d ? 2 : app.pixel ? 1 : 0, snd: st.snd !== 0, mus: st.mus, sfx: st.sfx, gfx: app.gfxPreset ? app.gfxPreset() : "", pad: padOn(app),
  };
}

/* FPS METER (GRAPHICS row 7) paints after every screen's chrome, GAME
   included, against the same box that screen measures with. */
export function drawShell(c, app, world, canvas, kind, getScores, getPlaques, getCab) {
  const s = app.screen;
  stepLookNote(app);
  shellBody(c, app, world, canvas, kind, getScores, getPlaques, getCab);
  loaderSpot(app, world, canvas);
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
      // HUD stays lit as run context on every pause view but CONTROLS, whose
      // plate would cut it at the top corners: there the veil puts it behind
      const B = overlayBox(kind),
        kicker = "PAUSED · ROOM " + (world.level | 0);
      if (app.pauseView === 3) {
        if (!app.controls) return;
        menudraw.drawDim(c, 0.72, B.w, B.h);
        return paintControls(c, app, canvas, kind, true);
      }
      if (app.pauseView === 2)
        return menudraw.drawGraphics(c, menudraw.layout(B.w, B.h), app.subT, gfxUi(app, canvas, kicker));
      menudraw.drawSettings(c, menudraw.layout(B.w, B.h), app.subT, optUi(app, canvas, kicker));
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
        rev: REV,
        soundNote: app.soundNote,
        padNote: app.padNote,
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
  } else if (s === SCREEN.FLOOR) {
    menudraw.drawDim(c, 0.72, cw, chh);
    menudraw.drawFloorHelp(c, L, app.subT, kind, touchLay(canvas));
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
    menudraw.drawSettings(c, L, app.subT, optUi(app, canvas));
  } else if (s === SCREEN.GRAPHICS) {
    menudraw.drawDim(c, 0.72, cw, chh);
    menudraw.drawGraphics(c, L, app.subT, gfxUi(app, canvas));
  } else if (s === SCREEN.CONTROLS) {
    menudraw.drawDim(c, 0.72, cw, chh);
    if (app.controls) paintControls(c, app, canvas, kind, false);
  }
}
