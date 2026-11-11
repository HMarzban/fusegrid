/* SETTINGS rows and the PAUSE order (v202 Task 2.4; design record §4: "CAMERA and BRIGHTNESS rows exist only while ART STYLE is
   REAL 3D"; plan R11: optRow indexes the visible list optRows(r3d), the one source for app and render). Every check drives the
   real menu app, the real createGame key / controller listeners, the real mountPointer and the real painters through drawShell.
   r3d is the ART STYLE row's selected value (app.render3d), not the live renderer. When the visible list changes the cursor keeps
   its label, or lands on ART STYLE when its row went away (lead ruling, refining R11). */
import { createGame } from "../src/main.js";
import { preloadControls } from "../src/app/controlswire.js";
import { loadControlsArt, drawShell, controlsHit, dims } from "../src/render/shellview.js";
import "../src/core/board3.js";
import { createPixelRenderer } from "../src/render/pixel/renderer.js";
import { SCREEN, ITEMS, OPT_ROWS, PAUSE_ITEMS, optRows, createMenuApp } from "../src/app/menuapp.js";
import { renderVal } from "../src/app/renderkind.js";
import { DEFAULTS } from "../src/app/settings.js";
import { mountPointer } from "../src/app/pointer.js";
import { shellGeo } from "../src/app/fit.js";
import { createControlsPage } from "../src/app/controlspage.js";
import { DEF_CONTROLS } from "../src/app/controls.js";
import { overlayBox, pauseGeom, pauseHit, touchLay, drawOverlay, PAUSE_ROWS, PAUSE_SHAPE } from "../src/render/scenes.js";
import * as md from "../src/render/menudraw.js";
import * as lazyPages from "../src/render/pages/lazy.js";
import * as sp from "../src/render/pages/settings.js";
import { worldTokens } from "../src/render/kit/tokens.js";
lazyPages._set("settings", sp); // the lazy SETTINGS page, in as if its import had landed (R20)
import { rec } from "./lib/textrec.mjs";
await preloadControls(loadControlsArt); // the CONTROLS page and its paint are lazy: in before the first mount

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const J = JSON.stringify, noop = () => {};
const FLAT = OPT_ROWS.filter((r) => r !== "CAMERA" && r !== "BRIGHTNESS");
const page = () => createControlsPage({ get: () => DEF_CONTROLS, set() {}, padView: () => ({ state: "none" }), say() {} });

// ---- 1. the two row lists ----
check("OPT_ROWS: every SETTINGS row, twelve, in order", J(OPT_ROWS) === J(["MUSIC", "SFX", "SOUND", "ART STYLE", "CAMERA", "BRIGHTNESS", "SCREEN SHAKE", "REDUCE FLASH", "ANALYTICS", "GRAPHICS", "CONTROLS", "RESET DEFAULTS"]));
check("optRows(false): the ten rows outside REAL 3D, OPT_ROWS order without CAMERA and BRIGHTNESS, frozen", J(optRows(false)) === J(FLAT) && optRows(false).length === 10 && Object.isFrozen(optRows(false)));
check("optRows(true): all twelve in REAL 3D, OPT_ROWS itself, frozen", optRows(true) === OPT_ROWS && optRows(true).length === 12 && Object.isFrozen(optRows(true)));
check("optRows answers by truthiness and returns the same two arrays every call", optRows(0) === optRows(false) && optRows(1) === optRows(true) && optRows() === optRows(false));
{
  const a = createMenuApp({ controls: page() });
  a.skip(); a.cursor = ITEMS.indexOf("SETTINGS"); a.confirm();
  check("CLASSIC 2D: app.optRows() is the ten, the cursor opens on MUSIC", a.optRows() === optRows(false) && a.optLabel() === "MUSIC" && a.optRow === 0);
  a.optRow = a.optRows().indexOf("ART STYLE");
  a.lookJob = { k: "px", state: "loading" }; a.confirm();
  check("PIXEL picked: still the ten", a.pixel && a.optRows().length === 10 && a.optLabel() === "ART STYLE");
  a.lookJob = { k: "3d", state: "loading", done: 0, total: 20 }; a.confirm();
  check("REAL 3D picked while it still loads: CAMERA and BRIGHTNESS show at once (the row's value, not the live renderer)", a.render3d && a.optRows() === optRows(true) && a.optLabel() === "ART STYLE");
  a.confirm();
  check("back to CLASSIC 2D by Enter on ART STYLE: ten again, the cursor stays on ART STYLE", !a.render3d && !a.pixel && a.optRows().length === 10 && a.optLabel() === "ART STYLE");
  const b = createMenuApp({ render3d: true });
  check("a boot in REAL 3D (opts / ?render=3d / nb.settings.v1 r3d) shows the twelve", b.optRows() === OPT_ROWS);
}

// ---- 2. what is drawn is the visible list, on the SETTINGS page and in PAUSE view 1, in all three looks ----
const box = (w, h, lay) => ({ width: w, height: h, ownerDocument: { body: { getAttribute: () => lay } }, getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }) });
/* v202 Task 3.4 (pages/settings.js): every row is painted at rest, then the focused row again, live, on its band: the drawn rows are each label's
   first draw, the selected one the label drawn twice (Node paints straight onto the target: no layer canvas) */
const rowTexts = (R) => { const seen = new Set(); return R.texts.filter((t) => OPT_ROWS.includes(t.s) && !seen.has(t.s) && seen.add(t.s)).sort((p, q) => p.y - q.y); };
const selOf = (R) => { const n = {}; for (const t of R.texts) if (OPT_ROWS.includes(t.s)) n[t.s] = (n[t.s] || 0) + 1; const s = Object.keys(n).filter((k) => n[k] === 2); return s.length === 1 ? s[0] : J(n); };
const shellDraw = (a, world, cv, kind = "2d") => { const R = rec({ widthK: 0.6 }); drawShell(R.ctx, a, world, cv, kind, () => [], () => 0, () => ({})); return R; };
for (const kind of ["2d", "px", "3d"]) for (const r3d of [false, true]) {
  const a = createMenuApp({ render3d: r3d, controls: page() }), bad = [];
  a.skip(); a.screen = SCREEN.SETTINGS;
  for (let i = 0; i < a.optRows().length; i++) {
    a.optRow = i;
    const P = shellDraw(a, { state: "PLAY", time: 1, level: 1 }, box(600, 520, "d"), kind);
    const g = Object.assign(createMenuApp({ render3d: r3d, controls: page() }), { screen: SCREEN.GAME, worldState: "PAUSE", pauseView: 1, optRow: i });
    const Q = shellDraw(g, { state: "PAUSE", time: 1, level: 3 }, box(600, 520, "d"), kind);
    if (i === 0) {
      check(`${kind} look, ART STYLE ${r3d ? "REAL 3D" : "not REAL 3D"}: the SETTINGS page draws exactly optRows(${r3d}) in order`, J(rowTexts(P).map((t) => t.s)) === J(optRows(r3d)), J(rowTexts(P).map((t) => t.s)));
      check(`${kind} look, ART STYLE ${r3d ? "REAL 3D" : "not REAL 3D"}: PAUSE view 1 draws exactly optRows(${r3d}) in order`, J(rowTexts(Q).map((t) => t.s)) === J(optRows(r3d)), J(rowTexts(Q).map((t) => t.s)));
    }
    if (selOf(P) !== a.optLabel() || selOf(Q) !== g.optLabel() || a.optLabel() !== optRows(r3d)[i]) bad.push(i + ": " + selOf(P) + " / " + selOf(Q) + " vs " + a.optLabel());
  }
  check(`${kind} look, ${r3d ? "REAL 3D" : "not REAL 3D"}: at every optRow the one row drawn selected is app.optLabel() = optRows(${r3d})[optRow], page and PAUSE view 1`, bad.length === 0, bad.join(" | "));
}

// ---- 3. Review Focus: the visible list changes from outside the page; the cursor lands on a real row and the next press acts on it ----
const KL = {}, mem = {};
globalThis.window = {
  addEventListener: (ty, fn) => { (KL[ty] = KL[ty] || []).push(fn); }, removeEventListener: noop, innerWidth: 1440, innerHeight: 900,
  localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } }, open: noop,
};
globalThis.location = { search: "", reload: noop };
const recP = new Proxy(function () {}, { get: (t, p) => (p === Symbol.toPrimitive ? () => "" : () => recP), apply: () => recP, set: () => true });
const fake3d = () => ({ ctx: recP, overlay: null, canvas: null, render() {}, consumeEvents() {}, getShake: () => ({ x: 0, y: 0 }) });
const IDX = { S: 0, E: 1, W: 2, N: 3, SHL: 4, SHR: 5, TRL: 6, TRR: 7, SELECT: 8, START: 9, dU: 12, dD: 13, dL: 14, dR: 15 };
const mkP = () => { const p = { connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }; p.set = (id, on) => { const b = p.buttons[IDX[id]]; b.pressed = on; b.value = on ? 1 : 0; }; return p; };
/* one live game at a time; ART STYLE booted from nb.settings.v1 (r3d / px), the ANALYTICS consent answered (so the row is live on a controller too) */
function game(look) {
  for (const k in KL) delete KL[k];
  for (const k in mem) delete mem[k];
  mem["nb.settings.v1"] = J(look === "3d" ? { r3d: 1 } : look === "px" ? { px: 1 } : {});
  mem["nb.analytics.v1"] = "0";
  const rig = { list: [mkP()] }, g = createGame(null, { seed: 42, createPixelRenderer, createRenderer3D: fake3d, getGamepads: () => rig.list });
  g.pad = rig.list[0]; g.t = 0;
  g.tick = (n = 1) => { for (let i = 0; i < n; i++) { g.t += 1000 / 60; g.ctl.poll(g.t); g.loop(g.t); } };
  g.app.cabinetSeen = true; g.app.skip(); g.tick(2); // the pad's first sight with nothing pressed: no press of it is swallowed later
  return g;
}
const down = (code) => (KL.keydown || []).forEach((f) => f({ code, key: code, repeat: false, preventDefault: noop }));
const up = (code) => (KL.keyup || []).forEach((f) => f({ code, key: code, preventDefault: noop }));
const press = (g, code) => { down(code); g.tick(3); up(code); g.tick(2); };
const padTap = (g, id) => { g.pad.set(id, true); g.tick(3); g.pad.set(id, false); g.tick(2); };
const DEV = { key: { ok: (g) => press(g, "Enter"), back: (g) => press(g, "Escape"), right: (g) => press(g, "ArrowRight") }, pad: { ok: (g) => padTap(g, "S"), back: (g) => padTap(g, "E"), right: (g) => padTap(g, "dR") } };
const toPage = (g) => { g.app.cursor = ITEMS.indexOf("SETTINGS"); g.app.confirm(); g.tick(); };
const toPause1 = (g) => { g.app.startRun(); g.tick(2); press(g, "KeyP"); g.app.pauseCursor = PAUSE_ITEMS.indexOf("SETTINGS"); g.app.confirm(); g.tick(); };
const focus = (g, label) => { g.app.optRow = g.app.optRows().indexOf(label); g.tick(); };
const snap = (g) => { const a = g.app, s = a.settings; return { scr: a.screen, pv: a.pauseView, look: renderVal(a), mus: s.mus, sfx: s.sfx, snd: s.snd, cam: s.cam, bri: s.bri, shk: s.shk, flx: s.flx, ana: a.analytics }; };
const KEYOF = { MUSIC: "mus", SFX: "sfx", SOUND: "snd", "ART STYLE": "look", CAMERA: "cam", BRIGHTNESS: "bri", "SCREEN SHAKE": "shk", "REDUCE FLASH": "flx", ANALYTICS: "ana" };
/* the effect of Enter / SOUTH / a tap on a row, read off the state: a value row changes its one setting, a door opens its page, RESET DEFAULTS brings MUSIC (set to 30 first) back */
function did(label, b, a) {
  const ch = Object.keys(b).filter((k) => b[k] !== a[k]), paused = b.scr === SCREEN.GAME;
  if (label === "GRAPHICS") return paused ? J(ch) === J(["pv"]) && a.pv === 2 : J(ch) === J(["scr"]) && a.scr === SCREEN.GRAPHICS;
  if (label === "CONTROLS") return paused ? J(ch) === J(["pv"]) && a.pv === 3 : J(ch) === J(["scr"]) && a.scr === SCREEN.CONTROLS;
  if (label === "RESET DEFAULTS") return b.mus === 30 && a.mus === DEFAULTS.mus && a.scr === b.scr && a.pv === b.pv;
  return J(ch) === J([KEYOF[label]]);
}
const drawnFocus = (g) => selOf(shellDraw(g.app, g.world, box(600, 520, "d"), g.app.render3d ? "3d" : g.app.pixel ? "px" : "2d"));
/* after a change: the cursor's label, in range, the one drawn selected, and the next press (dev) does that row's thing */
function after(name, g, want, dev) {
  const a = g.app, L = a.optRows(), lab = a.optLabel(), drawn = drawnFocus(g);
  const ok = lab === want && a.optRow >= 0 && a.optRow < L.length && L[a.optRow] === want && drawn === want;
  g.app.settings.mus = 30;
  const b = snap(g); DEV[dev].ok(g); const s = snap(g);
  check(`${name}: the cursor is on ${want} (optRow ${a.optRow} of ${L.length}, drawn there); the next ${dev === "key" ? "Enter" : "SOUTH"} acts on ${want}`, ok && did(want, b, s), J({ lab, optRow: a.optRow, n: L.length, drawn, b, s }));
}
const CAUSES = [
  /* rcache's lookFailed for a look job: onFail(k, on) -> app.lookFailed (pinned in rcache.test). A look card has no USE CLASSIC 2D
     today (the centred card is boot-only, design Q4); this is the path a REAL 3D that did not load takes back to CLASSIC 2D */
  ["a REAL 3D load fails, CLASSIC 2D on screen (the USE CLASSIC 2D path)", (g) => { g.app.lookJob = { k: "3d", state: "failed", fails: 1 }; g.app.lookFailed("3d", "2d"); }, "2d"],
  ["a REAL 3D load fails, PIXEL on screen", (g) => { g.app.lookJob = { k: "3d", state: "failed", fails: 1 }; g.app.lookFailed("3d", "px"); }, "px"],
  ["a lost REAL 3D context that cannot be rebuilt falls back (rcache onFail(3d, 2d))", (g) => { g.app.lookJob = { k: "3d", state: "failed", restore: true, fails: 1 }; g.app.lookFailed("3d", "2d"); }, "2d"],
  ["a failed rebuild3d reverts its row (ANTI-ALIAS, through setGfx: the list stays)", (g) => { g.app.setGfx("aa", g.app.settings.aa ? 0 : 1); }, "3d"],
];
const START = ["ART STYLE", "CAMERA", "BRIGHTNESS", "MUSIC", "GRAPHICS", "RESET DEFAULTS"];
const land = (start, look) => (look === "3d" || optRows(false).includes(start) ? start : "ART STYLE");
for (const [cause, fn, look] of CAUSES) for (const where of ["page", "PAUSE view 1"]) for (const start of START) for (const dev of ["key", "pad"]) {
  const g = game("3d");
  if (where === "page") toPage(g); else toPause1(g);
  focus(g, start);
  fn(g); g.tick();
  check(`${cause} (${where}, cursor on ${start}): ART STYLE reads ${look}`, renderVal(g.app) === ["2d", "px", "3d"].indexOf(look), renderVal(g.app));
  after(`${cause} (${where}, from ${start}, ${dev})`, g, land(start, look), dev);
}
/* the next ADJUST after an outside change acts on the drawn row too: from CAMERA / BRIGHTNESS the cursor is on ART STYLE, so → steps
   the look (never cam / bri); from MUSIC → raises MUSIC */
for (const [cause, fn, look] of CAUSES.slice(0, 3)) for (const where of ["page", "PAUSE view 1"]) for (const start of ["CAMERA", "BRIGHTNESS", "MUSIC"]) for (const dev of ["key", "pad"]) {
  const g = game("3d");
  if (where === "page") toPage(g); else toPause1(g);
  focus(g, start); fn(g); g.tick();
  g.app.lookJob = null; // the failure shown on the row is read; → is a plain step from here
  g.app.settings.mus = 30;
  const b = snap(g); DEV[dev].right(g); const a = snap(g);
  const ok = start === "MUSIC" ? a.mus === 40 && J(Object.keys(b).filter((k) => b[k] !== a[k])) === J(["mus"]) : a.look === b.look + 1 && a.cam === b.cam && a.bri === b.bri;
  check(`${cause} (${where}, from ${start}, ${dev}): the next → acts on ${land(start, look)}`, ok, J({ b, a }));
}
/* the player's own ART STYLE change on the page: both ways, the cursor stays on ART STYLE */
for (const where of ["page", "PAUSE view 1"]) for (const dev of ["key", "pad"]) {
  const g = game("3d");
  if (where === "page") toPage(g); else toPause1(g);
  focus(g, "ART STYLE");
  DEV[dev].ok(g); // REAL 3D -> CLASSIC 2D
  check(`ART STYLE REAL 3D -> CLASSIC 2D by ${dev} (${where}): ten rows`, g.app.optRows().length === 10 && renderVal(g.app) === 0);
  after(`own ART STYLE change down (${where}, ${dev})`, g, "ART STYLE", dev); // -> PIXEL
  DEV[dev].ok(g); // PIXEL -> REAL 3D
  check(`ART STYLE PIXEL -> REAL 3D by ${dev} (${where}): twelve rows, cursor on ART STYLE`, g.app.optRows().length === 12 && g.app.optLabel() === "ART STYLE");
  DEV[dev].right(g); // → clamps at REAL 3D
  check(`→ on ART STYLE at REAL 3D clamps (${where}, ${dev}): twelve rows, still ART STYLE`, g.app.optRows().length === 12 && g.app.optLabel() === "ART STYLE" && renderVal(g.app) === 2);
}
/* RESET DEFAULTS from REAL 3D: the reset itself drops ART STYLE to CLASSIC 2D; the cursor stays on RESET DEFAULTS */
for (const where of ["page", "PAUSE view 1"]) for (const dev of ["key", "pad"]) {
  const g = game("3d");
  if (where === "page") toPage(g); else toPause1(g);
  focus(g, "RESET DEFAULTS");
  g.app.settings.mus = 30;
  const b = snap(g); DEV[dev].ok(g);
  check(`RESET DEFAULTS from REAL 3D (${where}, ${dev}): CLASSIC 2D, ten rows`, renderVal(g.app) === 0 && g.app.optRows().length === 10 && did("RESET DEFAULTS", b, snap(g)));
  after(`RESET DEFAULTS from REAL 3D (${where}, ${dev})`, g, "RESET DEFAULTS", dev);
}
/* the GRAPHICS and CONTROLS doors: back onto the door in both row sets, also when the list changed while the door's page was open */
for (const door of ["GRAPHICS", "CONTROLS"]) for (const look of ["2d", "3d"]) for (const change of [false, true]) for (const where of ["page", "PAUSE"]) for (const dev of ["key", "pad"]) {
  if (change && look !== "3d") continue;
  const g = game(look);
  if (where === "page") toPage(g); else toPause1(g);
  focus(g, door);
  DEV[dev].ok(g);
  const opened = where === "page" ? g.app.screen === SCREEN[door] : g.app.pauseView === (door === "GRAPHICS" ? 2 : 3);
  if (change) { g.app.lookJob = { k: "3d", state: "failed", fails: 1 }; g.app.lookFailed("3d", "2d"); g.tick(); }
  DEV[dev].back(g);
  const back = where === "page" ? g.app.screen === SCREEN.SETTINGS : g.app.pauseView === 1;
  check(`${door} door (${where}, ${look === "3d" ? "REAL 3D" : "CLASSIC 2D"}${change ? ", REAL 3D lost while open" : ""}, ${dev}): opened, then back out onto the door`, opened && back, g.app.screen + "/" + g.app.pauseView);
  after(`${door} door return (${where}, ${look}${change ? ", list changed" : ""}, ${dev})`, g, door, dev);
}
/* PAUSE views 2 and 3 in REAL 3D, then a look change, then Esc: view 1 on the door (2 -> 1 and 3 -> 1), and 1 -> 0 on SETTINGS */
for (const [door, view] of [["GRAPHICS", 2], ["CONTROLS", 3]]) for (const dev of ["key", "pad"]) {
  const g = game("3d"); toPause1(g); focus(g, door); DEV[dev].ok(g);
  check(`PAUSE view ${view} reached through the ${door} door (${dev})`, g.app.pauseView === view);
  g.app.lookJob = { k: "3d", state: "failed", restore: true, fails: 1 }; g.app.lookFailed("3d", "2d"); g.tick();
  DEV[dev].back(g);
  check(`PAUSE view ${view} -> 1 after a lost context (${dev}): on the ${door} door at its CLASSIC 2D index ${optRows(false).indexOf(door)}`, g.app.pauseView === 1 && g.app.optRow === optRows(false).indexOf(door) && g.app.optLabel() === door, g.app.pauseView + "/" + g.app.optRow);
  DEV[dev].back(g);
  check(`PAUSE view 1 -> 0 (${dev}): the list, on SETTINGS`, g.app.pauseView === 0 && g.app.pauseCursor === PAUSE_ITEMS.indexOf("SETTINGS") && g.world.state === "PAUSE", g.app.pauseView + "/" + g.app.pauseCursor);
}
/* the hidden rows: no path changes CAMERA or BRIGHTNESS outside REAL 3D — every visible row, every key and button that moves or writes, and a held → */
for (const look of ["2d", "px"]) for (const where of ["page", "PAUSE view 1"]) {
  const g = game(look);
  if (where === "page") toPage(g); else toPause1(g);
  g.app.settings.cam = 1; g.app.settings.bri = 90;
  const seen = new Set();
  for (let i = 0; i < 2 * g.app.optRows().length; i++) {
    seen.add(g.app.optLabel());
    const lab = g.app.optLabel();
    if (lab !== "GRAPHICS" && lab !== "CONTROLS" && lab !== "RESET DEFAULTS" && lab !== "ART STYLE") {
      press(g, "ArrowRight"); press(g, "ArrowLeft"); padTap(g, "dR"); padTap(g, "dL"); press(g, "Enter"); padTap(g, "S");
      if (i % 3 === 0) { down("ArrowRight"); g.tick(40); up("ArrowRight"); g.tick(2); } // a held → repeats on its own row only
      if (i % 3 === 1) { g.pad.set("dR", true); g.tick(40); g.pad.set("dR", false); g.tick(2); } // a held D-PAD right (the controller's repeat)
    }
    if (i % 2) press(g, "ArrowDown"); else padTap(g, "dD");
  }
  check(`${look} (${where}): ↓ / D-PAD walk every visible row and never stop on CAMERA or BRIGHTNESS; ←→ / Enter / SOUTH / a held → / a held D-PAD right never change cam or bri`, !seen.has("CAMERA") && !seen.has("BRIGHTNESS") && seen.size === 10 && g.app.settings.cam === 1 && g.app.settings.bri === 90 && renderVal(g.app) === ["2d", "px"].indexOf(look), J([...seen]) + " cam " + g.app.settings.cam + " bri " + g.app.settings.bri);
}

// ---- 4. taps through the real mountPointer: desktop #c, touch landscape (#sh box), touch portrait (#sh box) ----
function mkEl(w, h, rect, lay) {
  const Lr = {};
  return { width: w, height: h, style: {}, getBoundingClientRect: () => rect, ownerDocument: { body: { getAttribute: (k) => (k === "data-lay" ? lay : null) } },
    addEventListener(ty, fn) { (Lr[ty] = Lr[ty] || []).push(fn); }, fire(ty, ev) { (Lr[ty] || []).slice().forEach((fn) => fn(ev || {})); } };
}
const HIT = { overlayBox, pauseHit, touchLay, controlsHit, dims, menuHit: md.menuHit, settingsHit: md.settingsHit, graphicsHit: md.graphicsHit, guideHit: md.guideHit, levelHit: md.levelHit, scoresHit: md.scoresHit, statsHit: md.statsHit, recTabHit: md.recTabHit, layout: md.layout };
const sgP = shellGeo(393, 852), sgL = shellGeo(1024, 768, 600, 520, "l");
function tapRig(lay, r3d, where) {
  const cmds = [], app = createMenuApp({ render3d: r3d, controls: page(), onPauseCmd: (c) => cmds.push(c) });
  app.skip();
  const world = { state: where === "page" ? "PLAY" : "PAUSE", time: 1, level: 3 };
  if (where === "page") { app.cursor = ITEMS.indexOf("SETTINGS"); app.confirm(); }
  else Object.assign(app, { screen: SCREEN.GAME, worldState: "PAUSE", pauseView: where === "PAUSE view 1" ? 1 : 0, pauseCursor: 0, inGame: true });
  const input = { _intent: { fire: false }, onUiKey: (c) => app.key(c) };
  let cv, fit = null, box = null, sh = null;
  cv = mkEl(600, 520, { left: 0, top: 0, width: 300, height: 260 }, lay);
  if (lay !== "d") {
    const g = lay === "p" ? sgP : sgL, rect = { left: 5, top: 9, width: g.w * g.s, height: g.h * g.s };
    sh = mkEl(Math.round(g.w * 2), Math.round(g.h * 2), rect, lay);
    box = { width: g.w, height: g.h, logo: g.logo, ownerDocument: sh.ownerDocument, getBoundingClientRect: () => rect };
    fit = { sh, box: () => box };
  }
  mountPointer({ canvas: cv, fit, input, app, world, kind: () => "2d", ctl: () => null, hit: HIT });
  const page_ = where === "page", surf = page_ && box ? box : cv, el = page_ && sh ? sh : cv;
  const tapAt = (x, y) => { const r = surf.getBoundingClientRect(); el.fire("pointerdown", { clientX: r.left + (x * r.width) / surf.width, clientY: r.top + (y * r.height) / surf.height, currentTarget: el, pointerType: "mouse" }); el.fire("pointerup", {}); };
  const draw = () => shellDraw(app, world, surf);
  return { app, world, cmds, tapAt, draw, surf, touch: lay !== "d" };
}
const tsnap = (a) => { const s = a.settings; return { scr: a.screen, pv: a.pauseView, look: renderVal(a), mus: s.mus, sfx: s.sfx, snd: s.snd, cam: s.cam, bri: s.bri, shk: s.shk, flx: s.flx, ana: a.analytics }; };
for (const lay of ["d", "l", "p"]) for (const r3d of [false, true]) for (const where of ["page", "PAUSE view 1"]) {
  const tag = `tap (${lay}, ${r3d ? "REAL 3D" : "CLASSIC 2D"}, ${where})`;
  const t0 = tapRig(lay, r3d, where), rows = t0.app.optRows(), R = t0.draw(), drawn = rowTexts(R);
  /* css: the box's CSS scale, as the draw and the pointer read it (v202 Task 3.4); a PAUSE view is paused (the HUD band clear) and pages its rows on a touch #c (fix round 1) */
  const css = dims(t0.surf, "2d").css, L = where === "page" ? md.layout(t0.surf.width, t0.surf.height, t0.surf.logo, css) : { ...md.layout(overlayBox("2d").w, overlayBox("2d").h, undefined, css), paused: true };
  const G = md.settingsGeom(L, t0.touch, rows), ctr = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 }); // rows by name, box units (G.d: design px, the drawn texts' own)
  check(`${tag}: drawn rows = the focused row's page of optRows(${r3d}) (${G.pages.length} page(s)); each label sits on its geometry row's centre line`, J(drawn.map((t) => t.s)) === J(G.pages[0]) && J(G.pages.flat()) === J(rows) && drawn.every((t) => Math.abs(t.y - (G.d.rows[t.s].y + G.d.rows[t.s].h / 2)) < 1e-6) && G.order.length === rows.length, J(drawn.map((t) => [t.s, +t.y.toFixed(2)])));
  if (lay !== "d" && where !== "page") check(`${tag}: a phone's PAUSE view pages its 44 CSS px rows`, G.pages.length > 1 && G.order.every((l) => G.rows[l].h * css >= 43.99));
  { const bad = [], tok = worldTokens(where === "page" ? 1 : 3); // a PAUSE view wears the room being played (the rig's world.level 3), the page app.level's
    for (let i = 0; i < rows.length; i++) {
      const t = tapRig(lay, r3d, where); t.app.optRow = i;
      const band = (t.draw().paints.find((q) => q.op === "fill" && q.style === tok.band) || {}).box, want = G.rows[rows[i]];
      if (!band || ["x", "y", "w", "h"].some((k) => Math.abs(band[k] - want[k]) > 0.01)) bad.push(rows[i] + " " + J([band, want]));
    }
    check(`${tag}: the selected row's drawn band is the geometry's row rect, every row`, bad.length === 0, bad.join(" | ")); }
  let bad = [];
  for (let i = 0; i < rows.length; i++) {
    const t = tapRig(lay, r3d, where), lab = rows[i], d = ctr(G.rows[lab]);
    t.app.optRow = rows.indexOf(G.pages[G.pageOf[lab]][0]); // its page on screen (the focus carries the page)
    t.app.settings.mus = 30;
    const b = tsnap(t.app); t.tapAt(d.x, d.y); const s = tsnap(t.app);
    if (!(t.app.optLabel() === lab && did(lab, b, s))) bad.push(lab + " " + J([t.app.optRow, b, s])); // RESET DEFAULTS in REAL 3D drops to ten rows: same label, a new index
  }
  check(`${tag}: a tap at the centre of each drawn row acts on that row's label`, bad.length === 0, bad.join(" | "));
  /* the list shrinks under the page (REAL 3D lost): a tap where CAMERA was drawn acts on the row drawn there now */
  if (r3d) {
    const t = tapRig(lay, true, where), camY = ctr(G.rows.CAMERA);
    t.app.optRow = t.app.optRows().indexOf("CAMERA");
    t.app.lookJob = { k: "3d", state: "failed", fails: 1 }; t.app.lookFailed("3d", "2d");
    const G2 = md.settingsGeom(L, t.touch, t.app.optRows()), lab2 = G2.pages[sp.pageAt(G2, t.app.optLabel())].find((l) => { const r = G2.hit[l]; return camY.y >= r.y && camY.y < r.y + r.h; }), under = lab2 ? { s: lab2 } : null; // the row on the page now shown whose tap rect holds the old spot
    t.app.settings.mus = 30;
    const b = tsnap(t.app); t.tapAt(camY.x + 4, camY.y); const s = tsnap(t.app);
    check(`${tag}: after REAL 3D is lost the cursor is on ART STYLE, and a tap at CAMERA's old spot acts on the row drawn there now (${under && under.s})`, !!under && t.app.optLabel() === under.s && did(under.s, b, s) && s.cam === b.cam, J([under && under.s, t.app.optLabel(), b, s]));
  }
}

// ---- 4b. paging (fix round 1, lead ruling): where 44 CSS px rows do not fit, every row is reachable by keys, a controller and taps ----
{
  const g6 = shellGeo(360, 640), rect6 = { left: 0, top: 0, width: g6.w * g6.s, height: g6.h * g6.s };
  const box6 = { width: g6.w, height: g6.h, logo: g6.logo, ownerDocument: { body: { getAttribute: (k) => (k === "data-lay" ? "p" : null) } }, getBoundingClientRect: () => rect6 };
  const shown = (R) => rowTexts(R).map((t) => t.s);
  for (const [dev, step] of [["keys", (g) => press(g, "ArrowDown")], ["controller", (g) => padTap(g, "dD")]]) for (const look of ["2d", "3d"]) {
    const g = game(look);
    toPage(g);
    const rows = g.app.optRows(), seen = new Set(), bad = [];
    for (let i = 0; i < rows.length; i++) {
      const R = shellDraw(g.app, g.world, box6), G = sp._dbg.last.G, lab = g.app.optLabel(), on = shown(R);
      if (J(on) !== J(G.pages[G.pageOf[lab]]) || !on.includes(lab)) bad.push(lab + " " + J(on));
      on.forEach((l) => seen.add(l));
      step(g);
    }
    const G = md.settingsGeom(md.layout(g6.w, g6.h, g6.logo, g6.s), true, rows);
    check(`paging on ${dev} (${look}, 360x640 phone, ${G.pages.length} pages): moving past a page's last row turns the page; every row is shown and focused once`, G.pages.length > 1 && bad.length === 0 && seen.size === rows.length, bad.join(" | "));
  }
  for (const r3d of [false, true]) {
    const t = tapRig("p", r3d, "PAUSE view 1"), rows = t.app.optRows(), css = dims(t.surf, "2d").css, L = { ...md.layout(600, 520, undefined, css), paused: true, focus: 0 };
    const G = md.settingsGeom(L, true, rows), ctr = (r) => [r.x + r.w / 2, r.y + r.h / 2], seen = [], bad = [];
    for (let p = 0; p < G.pages.length; p++) {
      const on = shown(t.draw());
      if (J(on) !== J(G.pages[p])) bad.push("page " + p + " " + J(on));
      seen.push(...on);
      if (p < G.pages.length - 1) { t.tapAt(...ctr(G.keys.dn)); if (t.app.optLabel() !== G.pages[p + 1][0] || t.app.pauseView !== 1) bad.push("▼ on page " + p + " -> " + t.app.optLabel()); }
    }
    for (let p = G.pages.length - 1; p > 0; p--) { t.tapAt(...ctr(G.keys.up)); if (t.app.optLabel() !== G.pages[p - 1][0]) bad.push("▲ on page " + p + " -> " + t.app.optLabel()); }
    const s0 = tsnap(t.app); t.tapAt(...ctr(G.keys.up)); // page 1 has no page before it: inert
    check(`paging on taps (a phone's PAUSE view 1, ${rows.length} rows, ${G.pages.length} pages): ▼ opens each page in turn (its first row focused, nothing confirmed), ▲ walks back, every row shown once`,
      G.pages.length > 1 && bad.length === 0 && J(seen) === J(rows) && J(tsnap(t.app)) === J(s0) && t.app.optRow === 0, bad.join(" | "));
  }
}

// ---- 5. PAUSE: RESUME, SETTINGS, RESTART, QUIT TO MENU ----
check("PAUSE_ITEMS: RESUME, SETTINGS, RESTART, QUIT TO MENU (design record §4)", J(PAUSE_ITEMS) === J(["RESUME", "SETTINGS", "RESTART", "QUIT TO MENU"]) && Object.isFrozen(PAUSE_ITEMS));
check("scenes' PAUSE_ROWS mirrors PAUSE_ITEMS (render/ may not import src/app)", J(PAUSE_ROWS) === J(PAUSE_ITEMS));
check("PAUSE_SHAPE from the labels: RESUME the hero (row 0), SETTINGS the door (row 1), RESTART and QUIT TO MENU danger (rows 2-3), a rule before RESTART only",
  J(PAUSE_SHAPE.map((r) => [r.label, !!r.hero, !!r.door, !!r.danger, !!r.rule])) === J([["RESUME", true, false, false, false], ["SETTINGS", false, true, false, false], ["RESTART", false, false, true, true], ["QUIT TO MENU", false, false, true, false]]), J(PAUSE_SHAPE));
for (const kind of ["2d", "iso"]) for (const touch of [false, true]) {
  const B = overlayBox(kind), g = pauseGeom(B, touch), tag = `${kind} ${touch ? "touch" : "keyboard"}`;
  check(`PAUSE divider (${tag}): one rule between SETTINGS and RESTART, from pauseGeom (no gap: the pitches and plate stay)`, g.div === g.rows[2].y0 && g.rows[1].y1 === g.rows[2].y0, g.div + " / " + g.rows[1].y1 + " / " + g.rows[2].y0);
  const bad = [];
  for (let cur = 0; cur < 4; cur++) {
    const R = rec({ widthK: 0.6 });
    drawOverlay(R.ctx, { state: "PAUSE", level: 3, heat: 0, pace: 0, pact: 0 }, B.w, B.h, B.cx, B.cy, { view: 0, cursor: cur, touch });
    const rule = R.rects.filter((r) => r.h === 1 && r.fill === md.LINE && Math.abs(r.y - Math.round(g.div)) <= 0.5 && r.w >= g.w - 40);
    const band = R.rects.find((r) => /rgba\((255,93,115|55,240,208),0\.12\)/.test(r.fill));
    const red = band && /255,93,115/.test(band.fill);
    if (rule.length !== 1 || !band || red !== (cur >= 2)) bad.push(cur + ": " + J([rule.length, band && band.fill]));
  }
  check(`PAUSE (${tag}): the rule is drawn once at pauseGeom's div on every cursor; RESTART and QUIT TO MENU select red, RESUME and SETTINGS do not`, bad.length === 0, bad.join(" | "));
  check(`PAUSE (${tag}): pauseHit maps each drawn row back to its index`, g.rows.every((r, i) => pauseHit(B.cx, r.cy, B, touch) === i));
}
const pauseEffect = (lab, g, cmds) => (lab === "RESUME" ? g.world.state === "PLAY" : lab === "SETTINGS" ? g.app.pauseView === 1 && g.world.state === "PAUSE" : lab === "RESTART" ? g.world.state === "PLAY" && g.world.level === 1 && g.world.score === 0 : g.app.screen === SCREEN.MENU);
for (const lab of PAUSE_ITEMS) for (const dev of ["key", "pad"]) {
  const g = game("2d"); g.app.startRun(); g.tick(2); g.world.level = 2; g.world.score = 77; press(g, "KeyP");
  for (let k = 0; k < PAUSE_ITEMS.indexOf(lab); k++) (dev === "key" ? press(g, "ArrowDown") : padTap(g, "dD"));
  const at = g.app.pauseCursor; DEV[dev].ok(g); g.tick(10);
  check(`PAUSE ${lab} by ${dev === "key" ? "Enter" : "SOUTH"}: ${["back to PLAY", "the inline SETTINGS page", "a new run from level 1, score 0", "MENU"][PAUSE_ITEMS.indexOf(lab)]}`, at === PAUSE_ITEMS.indexOf(lab) && pauseEffect(lab, g), at + "/" + g.app.screen + "/" + g.world.state + "/" + g.app.pauseView);
}
for (const lay of ["d", "l", "p"]) for (const lab of PAUSE_ITEMS) {
  const t = tapRig(lay, false, "PAUSE list"), B = overlayBox("2d"), g = pauseGeom(B, lay !== "d"), r = g.rows[PAUSE_ITEMS.indexOf(lab)];
  t.tapAt(B.cx, r.cy);
  const ok = t.app.pauseCursor === PAUSE_ITEMS.indexOf(lab) && (lab === "SETTINGS" ? t.app.pauseView === 1 && t.cmds.length === 0 : J(t.cmds) === J([lab]));
  check(`PAUSE tap (${lay}, ${lay === "d" ? "keyboard pitch" : "touch pitch"}) on ${lab}: acts as ${lab}`, ok, t.app.pauseCursor + " " + J(t.cmds) + " view " + t.app.pauseView);
}
for (const code of ["Escape", "KeyP"]) {
  const g = game("2d"); g.app.startRun(); g.tick(2); press(g, "KeyP");
  press(g, "ArrowDown"); press(g, "ArrowDown");
  press(g, code);
  check(`PAUSE ${code} still resumes from the list (cursor on RESTART)`, g.world.state === "PLAY", g.world.state);
}
{
  const g = game("2d"); g.app.startRun(); g.tick(2); press(g, "KeyP");
  check("PAUSE opens on RESUME", g.app.pauseCursor === PAUSE_ITEMS.indexOf("RESUME"));
  press(g, "ArrowDown"); press(g, "Enter");
  check("↓ once from RESUME is SETTINGS: Enter opens the inline page", g.app.pauseView === 1);
  press(g, "Escape");
  check("Esc from view 1 lands on SETTINGS in the list", g.app.pauseView === 0 && g.app.pauseCursor === PAUSE_ITEMS.indexOf("SETTINGS") && g.world.state === "PAUSE");
}

console.log("\n  SETTINGS ROWS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
