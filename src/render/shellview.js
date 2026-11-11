/* Per-screen menu chrome painted OVER the frozen arena — main.js calls
   drawShell once a frame, after the renderer, and routes everything to
   src/render/menudraw.js. BOOT and GAME keep their own overlays and draw
   nothing here. kindSize/dims are the one source of the logical box every
   screen measures against: a real canvas always wins, otherwise the render
   kind picks the classic box or the projected dimetric one. */
import { CFG } from "../core/config.js";
import { clampHeat } from "../core/heat.js";
import { clampPact } from "../core/pact.js";
import { clampPace } from "../core/pace.js";
import { SCREEN, ITEMS, LEVEL_ROWS, GUIDE_ROWS } from "../app/menuapp.js";
import { LABEL } from "./words.js";
import { PROJ } from "./r3d/camera.js";
import { overlayBox, touchLay, fmtTime, isRunEnd } from "./scenes.js";
import * as menudraw from "./menudraw.js";
import * as lazy from "./pages/lazy.js";
import { CACHE_NAME } from "../pwa/shell.js";
import { hints } from "./hintcopy.js";
import { setLogoLook, logoProbe } from "./logo/draw2d.js";

export function kindSize(kind) {
  const iso = kind === "iso";
  return {
    w: iso ? PROJ.canvasW : CFG.COLS * CFG.TILE,
    h: iso ? PROJ.canvasH : CFG.ROWS * CFG.TILE,
  };
}

/* Build tag for the SETTINGS head kicker and the MENU foot. CACHE_NAME is the only build identifier
   in the repo, and the PWA rule already forces it to change whenever shipped
   bytes do — same precedent as scores arriving through a getter: a screen fed
   from outside app/world gets its value handed in, not re-derived downstream. */
const REV = CACHE_NAME.replace("fusegrid-shell-", "");

/* body[data-lay], the one layout predicate fit.js writes (d / p / l); "d" in Node. */
const layOf = (cv) => {
  const b = cv && cv.ownerDocument && cv.ownerDocument.body;
  return (b && b.getAttribute && b.getAttribute("data-lay")) || "d";
};

/* The screens drawn on #sh's own box (fit.js shellGeo) on every layout that
   has one: MENU and every plated page. INTRO, ATTRACT and GAME (PAUSE and
   WIN/LOSE included) stay on the board canvas and its box. */
const SHELL_ON = new Set([SCREEN.MENU, SCREEN.LEVEL, SCREEN.HOWTO, SCREEN.SCORES, SCREEN.ITEMS, SCREEN.ENEMIES, SCREEN.SETTINGS, SCREEN.GUIDE, SCREEN.STATS, SCREEN.TROPHIES, SCREEN.GRAPHICS, SCREEN.FLOOR, SCREEN.CONTROLS]);
export const isShellScreen = (s) => SHELL_ON.has(s);
/* fit.shell's argument for this frame: 1 = a shell screen draws on #sh; 2 = a
   run end (isRunEnd), #sh shown click-through and drawn on by nothing (the end
   overlay keeps #c until its own redesign); 0 = hidden (PLAY, PAUSE, a mid-run
   WIN, INTRO, ATTRACT). */
export const shellMode = (s, world) => (SHELL_ON.has(s) ? 1 : s === SCREEN.GAME && isRunEnd(world) ? 2 : 0);
/* The screens whose page paints the room look opaque over its whole canvas every frame it is up (v202 Task 3.1: MENU; Task 3.3: LEVEL
   SELECT; Task 3.4: SETTINGS and GRAPHICS, their LOADING plate included; Task 3.5: the GUIDE pages; Tasks 4.1 / 4.2: RECORDS' SCORES, STATS and MEDALS; each page task adds its screen): main passes
   {covered: true} to the renderer while one holds, so no look rasters a board nobody sees. PAUSE's views sit over the board and never cover it. */
const COVERS = new Set([SCREEN.MENU, SCREEN.LEVEL, SCREEN.SETTINGS, SCREEN.GRAPHICS, SCREEN.GUIDE, SCREEN.HOWTO, SCREEN.ITEMS, SCREEN.ENEMIES, SCREEN.FLOOR, SCREEN.SCORES, SCREEN.STATS, SCREEN.TROPHIES]);
/* the GUIDE pages (v202 Task 3.5) are lazy (pages/lazy.js): menudraw's ask (every 3 s after a failure) and MENU's first idle bring them in */
const GUIDE_ON = new Set([SCREEN.GUIDE, SCREEN.HOWTO, SCREEN.ITEMS, SCREEN.ENEMIES, SCREEN.FLOOR]);
const guideO = (app, tap) => ({ level: app.level | 0 || 1, foe: app.foeRow | 0, tip: !!app.foeTip, pg: app.infoPg | 0, rev: REV, tap }); // rev: MENU's foot reserve, so the room dpr (and key) is MENU's
let guidePg = 1;
/** How many pages the read-only GUIDE page last drawn takes (menuapp's opts.pageCount: ↑↓ / ←→ step them, clamped). */
export const guidePageCount = () => guidePg;
export const shellCovers = (s) => COVERS.has(s);
/* css: CSS px per box unit on a touch layout (MENU's touch floors, its phone column and its compact tiles are in CSS px); undefined on a keyboard
   layout, whose pages never read it. fit.js hands it in as the box's own css: #sh's stand-in carries shellGeo's scale and fit writes #c's stage scale
   on #c, so the paint and the tap read one number and no frame measures a rect; a canvas without it (a test's) falls back to its rect. */
const cssOf = (cv) => (cv.css > 0 ? cv.css : cssScale(cv));
export function dims(canvas, kind) {
  const s = kindSize(kind);
  return { cw: canvas ? canvas.width : s.w, ch: canvas ? canvas.height : s.h, lg: canvas ? canvas.logo : undefined, css: canvas && layOf(canvas) !== "d" ? cssOf(canvas) : undefined }; // lg: #sh's logo line (fit.js shellGeo)
}

/** THE tap-mode predicate (R1 cohesion 4, ruling 4 for every page): a touch layout last driven by touch (app.lastDev, raw, no dwell). Any key or
    controller press leaves it and shows the focus, a tap re-enters it. Computed once a frame here and handed to every page (its frame's tap), the
    INTRO's skip hint included; a page shows no focus in it but MENU's PLAY (the lit main action) and ENEMIES' open tooltip. */
export const tapOf = (app, canvas) => touchLay(canvas) && app.lastDev === "touch";

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
   stage (#c, or #sh's box), 4 css px under its top: clear of the MENU logo (the
   MENU page's plate header, 70 CSS px down on #sh; renderrow.test checks the phone
   board stage too), and never over the PAUSE pill
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
/* rows: the visible SETTINGS list (menuapp optRows through the app's one predicate), row: the focused row's label (R11); level: the room whose
   world dresses the page; paused: a PAUSE view (the plate over the board, no room). */
const optUi = (app, canvas, kicker) => ({
  kicker,
  level: app.level | 0 || 1,
  paused: kicker != null,
  job: lookN,
  rows: app.optRows(),
  row: app.optLabel(),
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
  tap: tapOf(app, canvas),
});
const gfxUi = (app, canvas, kicker) => ({
  kicker,
  level: app.level | 0 || 1,
  paused: kicker != null,
  row: app.gfxRow,
  view: app.gfxView ? app.gfxView() : null,
  togT: app.togT,
  chg: app.gfxChg,
  rev: REV,
  touch: layOf(canvas) !== "d",
  tap: tapOf(app, canvas),
});

/* CONTROLS draws and taps through one set of arguments, so a tap lands where
   the plate is drawn. The row floor is 44 CSS px, so it needs this box's real
   CSS scale; with no usable rect geoFor takes its worst case. paused = the
   inline pauseView 3, measured against overlayBox like the other PAUSE pages. */
function cssScale(cv) {
  const r = cv && cv.width > 0 && cv.getBoundingClientRect ? cv.getBoundingClientRect().width / cv.width : 0;
  return r > 0 && Number.isFinite(r) ? r : undefined;
}
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
const paintControls = (c, app, canvas, kind, paused, world) => {
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
  art.draw(c, L, app.controls.view(app.ctlT), { ...u, words: hints(), level: paused && world ? world.level : app.level, reduced: !!(app.settings && app.settings.flx) }); // the drawing wears the menus' room, or the one being played
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

/* LEVEL SELECT's info and MENU's teasers. getCab hands main's read-only stores {times, daily, top}; they are read once per screen entry (nothing
   writes them while a menu page is open) and formatted here, so menudraw never reads a store. lockT is honoured only when main stamped it on THIS visit. */
let cab = null,
  cabFor = -1,
  lockSeen = null,
  top3 = [];
function infoOf(app, getCab) {
  if (cabFor !== app.screen) {
    cabFor = app.screen;
    cab = (getCab && getCab()) || {};
    top3 = Array.isArray(cab.top) ? cab.top : []; // played runs only (main drops the seeded placeholders)
    lockSeen = app.lockT;
  }
  const h = clampHeat(app.heat),
    pact = app.pactUnlocked ? clampPact(app.pact) : 0,
    pz = clampPace(app.pace) + 1,
    tb = (cab.times && cab.times.b) || {};
  return {
    lockR: app.lockR, lockT: app.lockT !== lockSeen ? app.lockT : null,
    row: LEVEL_ROWS[app.levelRow | 0], open: !!app.modOpen, cur: app.modeCur, // LEVEL SELECT's focus: the row's name, the MODIFIERS list and its cursor (v202 Task 2.3)
    best: Array.from({ length: 8 }, (_, i) => { const d = tb[i + 1 + ":" + h + ":" + pact + ":" + pz]; return d > 0 ? fmtTime(d / 10) : null; }),
  };
}

/* MENU's names and values (pages/menu.js): the rows, the focused row's label (tap mode: PLAY, the lit main action; a tap has no focus),
   the run PLAY starts, the teasers' facts (a score teaser reads only played runs: getCab's top), the build tag and the notes. The cabinet is read
   again on every arrival from another screen (a run played from PLAY or DAILY never passes LEVEL SELECT's read), so a teaser never shows the
   cabinet as it was before the run. */
function menuUi(app, tap, getCab) {
  if (cabFor !== app.screen || prevScreen !== SCREEN.MENU) { cabFor = -1; infoOf(app, getCab); }
  return {
    rows: ITEMS, tap, focus: tap ? ITEMS[0] : ITEMS[app.cursor | 0] || ITEMS[0], level: app.level | 0 || 1,
    run: { heat: app.heat, pace: app.pace, pact: app.pactUnlocked ? clampPact(app.pact) : 0, time: !!(app.pactUnlocked && app.timeAttack) },
    daily: app.dailyTag === "PLAYED" ? ((cab.daily && cab.daily.played) | 0) : null, best: top3.length ? top3[0].s : null,
    look: app.render3d ? 2 : app.pixel ? 1 : 0, pages: GUIDE_ROWS.length, rev: REV, note: app.soundNote || "", pad: app.padNote || "",
    reduced: !!(app.settings && app.settings.flx), enterT: app.subT,
  };
}

/* FPS METER (GRAPHICS row 7) paints after every screen's chrome, GAME
   included, against the same box that screen measures with. */
const REC_PAGE = { [SCREEN.SCORES]: "scores", [SCREEN.STATS]: "stats", [SCREEN.TROPHIES]: "medals" };
/** A RECORDS tab's page count on the box drawShell paints it on (the same frame as the RECORDS branch below): the app's ↑ / ↓ and page keys clamp to it. */
export function recPagesOf(canvas, kind, screen, rows) {
  if (!REC_PAGE[screen]) return 1;
  const { cw, ch, lg, css } = dims(canvas, kind);
  return menudraw.recPages(menudraw.layout(cw, ch, lg, css), touchLay(canvas), REC_PAGE[screen], rows);
}
export function drawShell(c, app, world, canvas, kind, getScores, getPlaques, getCab) {
  const s = app.screen;
  stepLookNote(app);
  if (s === SCREEN.MENU || s === SCREEN.GAME) lazy.idle(); // the lazy pages load in the first idle after MENU's (or a deep link's run's) first frame
  setLogoLook(kind);
  shellBody(c, app, world, canvas, kind, getScores, getPlaques, getCab);
  logoProbe();
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
       paused SETTINGS / GRAPHICS pages measure against overlayBox — the SAME
       box the pause list uses — never dims(canvas, kind), so list and page
       never disagree by a pixel. */
    if (world.state === "PAUSE" && app.pauseView >= 1) {
      // no second dim: drawOverlay's 0.72 PAUSE veil is the one wash, so the
      // HUD stays lit as run context on every pause view but CONTROLS, whose
      // plate would cut it at the top corners: there the veil puts it behind
      const B = overlayBox(kind),
        kicker = "PAUSED · " + LABEL.LEVEL + " " + (world.level | 0);
      if (app.pauseView === 3) {
        if (!app.controls) return;
        menudraw.drawDim(c, 0.72, B.w, B.h);
        return paintControls(c, app, canvas, kind, true, world);
      }
      /* the same box the pointer maps a PAUSE tap through: overlayBox at #c's CSS scale (the touch floors), paused (the HUD band kept clear), the
         focused row (its page is on screen); the room being played dresses the plate (world.level, never the menu's app.level) */
      const g2 = app.pauseView === 2, PL = { ...menudraw.layout(B.w, B.h, undefined, dims(canvas, kind).css), paused: true, focus: g2 ? app.gfxRow : app.optRow }, lv = world.level | 0 || 1;
      if (g2) return menudraw.drawGraphics(c, PL, app.subT, { ...gfxUi(app, canvas, kicker), level: lv });
      menudraw.drawSettings(c, PL, app.subT, { ...optUi(app, canvas, kicker), level: lv });
    }
    return;
  }
  const { cw, ch: chh, lg: logoY, css } = dims(canvas, kind), tap = tapOf(app, canvas); // THE tap mode, once a frame, handed to every page
  if (s === SCREEN.INTRO) // board alpha eases the veil from opaque once the board is ready (3D waits on three)
    return menudraw.drawIntroChrome(c, app.introStage, app.subT, cw, chh, layOf(canvas), app.boardReady ? Math.min(1, app.readyT / 0.4) : 0, { level: app.level, reduced: !!(app.settings && app.settings.flx), tap });
  if (s === SCREEN.ATTRACT) {
    // no dim: the demo IS the show; only the blinking footer hint
    const L = menudraw.layout(cw, chh, logoY);
    menudraw.drawAttractHint(c, L, app.subT);
    return;
  }
  if (s === SCREEN.MENU) { const t = touchLay(canvas); lazy.idle(); return menudraw.drawMenu(c, menuUi(app, tap, getCab), menudraw.layout(cw, chh, logoY, css), app.subT, t); } // the lazy pages load in the first idle after MENU's first frame
  if (s === SCREEN.SETTINGS) return menudraw.drawSettings(c, menudraw.layout(cw, chh, logoY, css), app.subT, optUi(app, canvas)); // css: the box the pointer maps a tap through
  if (s === SCREEN.GRAPHICS) return menudraw.drawGraphics(c, menudraw.layout(cw, chh, logoY, css), app.subT, gfxUi(app, canvas));
  if (GUIDE_ON.has(s)) {
    const t = touchLay(canvas), LG = menudraw.layout(cw, chh, logoY, css), o = guideO(app, tap);
    if (s === SCREEN.GUIDE) return menudraw.drawGuide(c, LG, app.subT, app.guideRow, kind, t, o);
    if (s !== SCREEN.ENEMIES) guidePg = menudraw.guidePages(LG, t, s === SCREEN.HOWTO ? "HOW TO PLAY" : s === SCREEN.ITEMS ? "POWER-UPS" : "FLOOR");
    return (s === SCREEN.HOWTO ? menudraw.drawHowTo : s === SCREEN.ITEMS ? menudraw.drawItemsHelp : s === SCREEN.ENEMIES ? menudraw.drawEnemiesHelp : menudraw.drawFloorHelp)(c, LG, app.subT, kind, t, o);
  }
  if (s === SCREEN.SCORES || s === SCREEN.STATS || s === SCREEN.TROPHIES) { // RECORDS' pages (pages/records.js): one frame for draw and tap, the room opaque under them
    const t = touchLay(canvas), Lr = menudraw.layout(cw, chh, logoY, css), focus = app.recFocus === 0 ? "tabs" : "body";
    if (s === SCREEN.SCORES) { const sd = scoreData(app, getScores, getPlaques); return menudraw.drawScores(c, { level: app.level, rev: REV, tap, focus, heat: app.scoreHeat, scores: sd.s, plaques: sd.p, spage: app.recPage | 0 }, Lr, app.subT, t); }
    if (s === SCREEN.STATS) { const st = app.stats || {}; return menudraw.drawStats(c, { level: app.level, rev: REV, tap, focus, view: st.view, notes: st.notes, wipe: st.wipe, arm: !!app.resetArm, toast: app.toast && app.toast.t > 0 ? app.toast : null, unlocked: !!app.pactUnlocked, spage: app.recPage | 0 }, Lr, app.subT, t); }
    return menudraw.drawTrophies(c, { level: app.level, rev: REV, tap, focus, rows: app.stats && app.stats.trophies, spage: app.recPage | 0 }, Lr, app.subT, t);
  }
  if (s === SCREEN.LEVEL) {
    /* opaque on the world kit (pages/level.js): the selected level's room; tap mode is tapOf's (ruling 4) */
    const t = touchLay(canvas);
    menudraw.drawLevelSelect(c, app.level, menudraw.layout(cw, chh, logoY, css), app.subT, app.heat, app.pact, app.pactUnlocked, app.pace, app.timeAttack, t,
      { ...infoOf(app, getCab), tap, enterT: app.subT, rev: REV }); // rev: MENU's foot reserve, so the room dpr (and key) is MENU's
  } else if (s === SCREEN.CONTROLS) {
    menudraw.drawDim(c, 0.72, cw, chh);
    if (app.controls) paintControls(c, app, canvas, kind, false);
  }
}
