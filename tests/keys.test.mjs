/* KEY MATRIX — every documented key in every shell / world state, driven
   through the REAL createGame: stubbed window keydown/keyup listeners (the
   same ones Input and main register in the browser) and the real loop(t).
   Expectations come from README "How to play", AGENTS.md and the on-screen
   foot hints in menudraw.js — not from reading the handlers back. */
import { createGame } from "../src/main.js";
import { preloadControls } from "../src/app/controlswire.js";
import { loadControlsArt } from "../src/render/shellview.js";
import "../src/core/board3.js";
import { createPixelRenderer } from "../src/render/pixel/renderer.js";
import { SCREEN, ITEMS, GUIDE_ROWS, PAUSE_ITEMS, IDLE_T, FEELS } from "../src/app/menuapp.js";
import { PACT } from "../src/core/pact.js";
import { GFX_ROWS, DEMO_T } from "../src/app/gfx.js";
import { graphicsGeom, layout as menuLayout, modeFocusOf } from "../src/render/menudraw.js";
import * as lazyPages from "../src/render/pages/lazy.js";
import * as settingsPage from "../src/render/pages/settings.js";
lazyPages._set("settings", settingsPage); // the lazy SETTINGS / GRAPHICS page, in as if its import had landed (R20)
import { readFileSync } from "node:fs";
import { SHOW_STEP, SHOW_DUR, popOf } from "../src/app/intro.js";
import { CFG } from "../src/core/config.js";
import { dailySeed } from "../src/app/daily.js";
import { getFlash, getShake } from "../src/render/fx.js";
import { copyPayload, drawOverlay, overlayBox } from "../src/render/scenes.js";
import { createToast, copyText, toastOf, toastTick, TOAST_T } from "../src/app/endkeys.js";
import "../src/app/demobot.js";
import { rec as krec } from "./lib/textrec.mjs";
import * as kprobe from "../src/render/kit/probe.js";
import * as endWin from "../src/render/pages/endwin.js";
import * as endLose from "../src/render/pages/endlose.js";
import { endFacts, endGeom } from "../src/render/pages/endgeom.js";
(await import("../src/render/pages/lazy.js"))._set("level", await import("../src/render/pages/level.js")); // LEVEL SELECT is a lazy page (Task 9.14): in as if its import had landed
lazyPages._set("endlose", endLose); // GAME OVER is a lazy page (v202 Task 5.4)
await preloadControls(loadControlsArt); // the CONTROLS page, its paint and rumble are lazy (v202): in before the first mount
const RECP = await (await import("../src/render/pages/lazy.js")).want("records"); // RECORDS is a lazy page (R20): in before its taps

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const noop = () => {};
const flush = () => new Promise((r) => setImmediate(r));

const L = {}, mem = {}, clip = [], opens = [];
let clipMode = "ok", reloads = 0;
globalThis.window = {
  addEventListener: (ty, fn) => { (L[ty] = L[ty] || []).push(fn); },
  removeEventListener: noop, innerWidth: 1440, innerHeight: 900,
  localStorage: { getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } },
  open: (u) => { opens.push(u); },
};
globalThis.location = { search: "", reload: () => { reloads++; } };
const clipStub = { writeText: (s) => clipMode === "ok" ? (clip.push(s), Promise.resolve())
  : Promise.reject(new Error("denied")) };
navigator.clipboard = clipStub;

/* One live game at a time: each mk() drops the previous game's listeners so a
   keydown reaches exactly one Input + main pair. */
let BOOT = {}; // extra createGame opts while a look is booted (withSettings: REAL 3D gets a fake 3D renderer)
function mk(o = {}, cv = null) {
  for (const k in L) delete L[k];
  const g = createGame(cv, { seed: 42, createPixelRenderer, ...BOOT, ...o });
  g.t = 0;
  g.tick = (n = 1) => { for (let i = 0; i < n; i++) { g.t += 1000 / 60; g.loop(g.t); } };
  const r = g.renderer, r0 = r.render.bind(r);
  r.render = (w, dt, ro) => { g.ro = ro; g.rw = w; return r0(w, dt, ro); };
  g.tick();
  return g;
}
/* key mirrors the browser's for the modifiers armUnlock reads (Shift carries no activation) */
const keyOf = (code) => (/^Shift/.test(code) ? "Shift" : code);
const down = (code, repeat = false) => (L.keydown || []).forEach((f) => f({ code, key: keyOf(code), repeat, preventDefault: noop }));
const up = (code) => (L.keyup || []).forEach((f) => f({ code, key: code, preventDefault: noop }));
const press = (g, code, hold = 3) => { down(code); g.tick(hold); up(code); g.tick(2); };
/* Real-key path to MENU: a press starts the show (no audio here, so armUnlock's
   first-gesture rule), tick past the 0.2 s SKIP_GUARD, then Enter skips it. */
const show = (g, code = "KeyA") => { press(g, code); g.tick(15); return g; };
const menu = (cv) => { const g = show(mk({}, cv)); press(g, "Enter"); return g; };
const toRow = (g, i) => { for (let k = 0; k < i; k++) press(g, "ArrowDown"); };
const run = (o) => { const g = menu(); if (o && o.unlock) g.app.pactUnlocked = true; press(g, "Enter"); return g; };
const clearRoom = (g) => { g.world.enemies.forEach((e) => { e.dead = true; }); g.tick(150); };
/* v202 Task 2.4: SETTINGS shows CAMERA and BRIGHTNESS only while ART STYLE is REAL 3D, so every SETTINGS / GRAPHICS / pause-view
   case runs in both row sets (LOOKS), the row looked up by its label in the app's visible list (optAt), never a fixed number. */
const FAKE3D = (() => { const rec = new Proxy(function () {}, { get: (t, p) => (p === Symbol.toPrimitive ? () => "" : () => rec), apply: () => rec, set: () => true });
  return () => ({ ctx: rec, overlay: null, canvas: null, render() {}, consumeEvents() {}, getShake: () => ({ x: 0, y: 0 }) }); })();
/* the look a game boots in comes from nb.settings.v1; the blob (and BOOT) are restored after fn, so nothing leaks to later cases */
const withSettings = (blob, fn) => {
  const s0 = mem["nb.settings.v1"], b0 = BOOT;
  if (blob) mem["nb.settings.v1"] = JSON.stringify(blob); else delete mem["nb.settings.v1"];
  BOOT = blob && blob.r3d ? { createRenderer3D: FAKE3D } : {};
  try { return fn(); } finally { BOOT = b0; if (s0 === undefined) delete mem["nb.settings.v1"]; else mem["nb.settings.v1"] = s0; }
};
const LOOKS = [["CLASSIC 2D", null], ["REAL 3D", { r3d: 1 }]];
const optAt = (g, lab) => g.app.optRows().indexOf(lab);
const live = (w) => w.bombs.filter((b) => !b.dead).length;

// ---- U (NEW VERSION READY, src/app/update.js): the reload key lives on the
// update card's own document listener, live only while the card shows; with
// no update pending (always, under Node) it is inert in MENU, PLAY and PAUSE. ----
{
  const g = menu();
  press(g, "KeyU");
  check("U in MENU with no update pending: nothing happens", g.app.screen === SCREEN.MENU && g.app.cursor === 0, g.app.screen);
  press(g, "Enter"); press(g, "KeyU");
  check("U in PLAY: nothing happens, the run keeps going", g.app.screen === SCREEN.GAME && g.world.state === "PLAY", g.world.state);
  press(g, "Escape"); press(g, "KeyU");
  check("U in PAUSE: nothing happens", g.world.state === "PAUSE" && g.app.pauseCursor === 0, g.world.state);
}
// ---- Y / N (GA consent card, src/app/analytics.js): the card's own window
// capture listener owns them, live only while the card shows; under Node no
// card ever mounts, so they are inert in MENU, PLAY and PAUSE. ----
for (const code of ["KeyY", "KeyN"]) {
  const g = menu();
  press(g, code);
  check(code + " in MENU with no consent card: nothing happens", g.app.screen === SCREEN.MENU && g.app.cursor === 0 && g.app.analytics === false, g.app.screen);
  press(g, "Enter"); press(g, code);
  check(code + " in PLAY: nothing happens, the run keeps going", g.app.screen === SCREEN.GAME && g.world.state === "PLAY", g.world.state);
  press(g, "Escape"); press(g, code);
  check(code + " in PAUSE: nothing happens", g.world.state === "PAUSE" && g.app.pauseCursor === 0, g.world.state);
}
// ---- INTRO (opening 2026-10-09): the title waits for a press that starts the
// show; Escape and modifiers never do. In the show, past the 0.2 s guard, any
// key skips to MENU at PLAY. Every visit, the first included, lands on MENU. ----
const KEYS = ["Enter", "NumpadEnter", "Backspace", "ArrowDown", "KeyW", "Space", "KeyJ", "KeyX", "KeyQ", "KeyN", "KeyC", "KeyB", "Digit7", "KeyR", "KeyM", "KeyT", "Digit1", "BracketLeft", "KeyP", "KeyU"];
for (const code of KEYS) {
  const g = mk();
  press(g, code);
  check("INTRO title " + code + ": starts the show, stays on INTRO, starts nothing",
    g.app.screen === SCREEN.INTRO && g.app.introStage === 1 && !g.app.inGame, g.app.screen + "/" + g.app.introStage);
}
for (const code of ["Escape", "ShiftLeft"]) {
  const g = mk();
  press(g, code); g.tick(30);
  check("INTRO title " + code + ": no show (carries no activation), still the title",
    g.app.screen === SCREEN.INTRO && g.app.introStage === 0, g.app.screen + "/" + g.app.introStage);
  press(g, "KeyA");
  check("INTRO title " + code + " then A: the next real press starts the show", g.app.introStage === 1);
}
{
  const g = mk();
  g.tick(Math.ceil(30 * 60));
  check("INTRO title never times out (30 s, no key)", g.app.screen === SCREEN.INTRO && g.app.introStage === 0, g.app.screen);
}
{
  const g = mk();
  down("KeyA"); g.tick(3); up("KeyA");
  press(g, "KeyS", 1);
  check("INTRO show: a key inside the 0.2 s guard does not skip", g.app.screen === SCREEN.INTRO && g.app.introStage === 1);
}
for (const code of ["Enter", "NumpadEnter", "Escape", "Backspace", "ArrowDown", "KeyW", "Space", "KeyJ", "KeyQ", "KeyC", "KeyR", "KeyM", "KeyT", "Digit1", "BracketLeft", "KeyP"]) {
  const g = show(mk());
  press(g, code); g.tick(10);
  check("INTRO show " + code + ": skips to MENU at PLAY, starts nothing, plants nothing",
    g.app.screen === SCREEN.MENU && g.app.cursor === 0 && !g.app.inGame && live(g.world) === 0,
    g.app.screen + "/" + g.app.cursor);
}
{
  const g = mk();
  down("Space"); g.tick(Math.ceil((4.384 + 0.6) * 60));
  check("INTRO Space held from the title press through the show's end: MENU at PLAY, no run",
    g.app.screen === SCREEN.MENU && g.app.cursor === 0 && !g.app.inGame && live(g.world) === 0, g.app.screen);
  up("Space"); g.tick(2);
  press(g, "Space"); g.tick(3);
  check("...then a fresh Space confirms PLAY", g.app.screen === SCREEN.GAME && live(g.world) === 0, g.app.screen);
}
{
  const g = mk();
  down("ArrowDown"); g.tick(Math.ceil((4.384 + 0.2) * 60));
  check("INTRO ArrowDown held from the title press through the show's end lands on PLAY",
    g.app.screen === SCREEN.MENU && g.app.cursor === 0, g.app.screen + "/" + g.app.cursor);
  up("ArrowDown"); g.tick(2);
}
{
  for (const k in mem) delete mem[k]; // an unseen cabinet
  const g = mk();
  press(g, "Enter"); g.tick(Math.ceil((4.384 + 0.3) * 60));
  check("INTRO unseen cabinet: the show lands on MENU at PLAY, not a run (ruling 2026-10-09)",
    g.app.screen === SCREEN.MENU && g.app.cursor === 0 && g.app.fromShow && !g.app.inGame, g.app.screen);
  check("INTRO unseen cabinet: nb.cabinet.v1 still written once", mem["nb.cabinet.v1"] === "1", mem["nb.cabinet.v1"]);
}
// O2 render pins: the show world backs the title, the show and the revealed
// MENU; MAKO is hidden on the title and pops in the show; ATTRACT drops it.
{
  const g = mk();
  check("INTRO title renders the show world with MAKO hidden (pop 0)", !!g.show && g.rw === g.show.world && g.ro.pop === 0, g.ro && g.ro.pop);
  press(g, "KeyA"); g.tick(Math.ceil(4 * SHOW_STEP * 60) + 6);
  check("INTRO show renders the show world with MAKO at popOf(subT)",
    g.rw === g.show.world && g.ro.pop > 0 && g.ro.pop === popOf(g.app.subT), g.ro.pop);
  g.tick(Math.ceil(SHOW_DUR * 60));
  check("MENU after the reveal still renders the show world", g.app.screen === SCREEN.MENU && g.rw === g.show.world, g.app.screen);
  g.tick(Math.ceil((IDLE_T + 0.5) * 60));
  check("MENU idle -> ATTRACT drops the show world", g.app.screen === SCREEN.ATTRACT && g.show === null, g.app.screen);
}
/* a USER skip drops the show world: the live world backs MENU and the show
   bomb never goes off behind it (no flash, no shake, no boom); only the
   natural end keeps the show world, and its reveal boom sounds. */
for (const at of [1.0, 2.0, 3.0, 4.0]) {
  const plays = [];
  const g = mk({ audio: { play: (n) => plays.push(n), toggle: () => false, duck: noop, pump: noop, unlocked: () => false } });
  press(g, "KeyA");
  while (g.app.subT < at && g.t < 20000) g.tick();
  press(g, "Enter");
  let fl = 0, sh = 0, rw = true;
  for (let i = 0; i < Math.ceil((SHOW_DUR + 1.5) * 60); i++) {
    g.tick();
    const k = getShake();
    fl = Math.max(fl, getFlash()); sh = Math.max(sh, Math.abs(k.x), Math.abs(k.y));
    rw = rw && g.rw === g.world;
  }
  check("INTRO skip at " + at + " s: MENU on the live world, no flash, no shake, no boom",
    g.app.screen === SCREEN.MENU && g.show === null && rw && fl === 0 && sh === 0 && !plays.includes("boom"),
    g.app.screen + " show " + !!g.show + " live " + rw + " flash " + fl + " shake " + sh + " " + plays.join());
}
{
  const plays = [];
  const g = mk({ audio: { play: (n) => plays.push(n), toggle: () => false, duck: noop, pump: noop, unlocked: () => false } });
  press(g, "KeyA");
  g.tick(Math.ceil((SHOW_DUR + 0.5) * 60));
  check("INTRO natural end: MENU keeps the show world, its brick broken, and the reveal boom sounds",
    g.app.screen === SCREEN.MENU && g.app.fromShow && g.rw === g.show.world && g.show.world.grid[CFG.COLS + 5] === 0 && plays.includes("boom"),
    g.app.screen + " " + plays.join());
}

// ---- MENU: arrows, Enter on every row, Space confirm, idle -> ATTRACT ----
{
  const g = menu();
  press(g, "ArrowDown"); const a = g.app.cursor;
  press(g, "KeyS"); const b = g.app.cursor;
  press(g, "ArrowUp"); press(g, "KeyW"); press(g, "ArrowUp");
  check("MENU ArrowDown / S move down, ArrowUp / W move up and wrap",
    a === 1 && b === 2 && g.app.cursor === ITEMS.length - 1, a + "," + b + "," + g.app.cursor);
  press(g, "Escape");
  check("MENU Escape stays on MENU", g.app.screen === SCREEN.MENU);
}
{
  const want = { "PLAY": SCREEN.GAME, "LEVEL SELECT": SCREEN.LEVEL, "DAILY": SCREEN.GAME, "SETTINGS": SCREEN.SETTINGS,
    "GUIDE": SCREEN.GUIDE, "RECORDS": SCREEN.SCORES, "SOURCE": SCREEN.MENU };
  for (let i = 0; i < ITEMS.length; i++) {
    const g = menu();
    toRow(g, i);
    const o0 = opens.length;
    press(g, "Enter");
    check("MENU Enter on " + ITEMS[i] + " -> screen " + want[ITEMS[i]],
      g.app.screen === want[ITEMS[i]] && (ITEMS[i] !== "SOURCE" || opens.length === o0 + 1),
      g.app.screen);
  }
}
{
  const g = menu();
  down("Space"); g.tick(10);
  check("MENU Space confirms PLAY and the held press plants nothing",
    g.app.screen === SCREEN.GAME && g.world.state === "PLAY" && live(g.world) === 0, g.app.screen + "/" + live(g.world));
  up("Space"); g.tick(2);
}
{
  const g = menu();
  g.tick(Math.ceil(10.2 * 60));
  check("MENU idle 10 s -> ATTRACT", g.app.screen === SCREEN.ATTRACT, g.app.screen);
  const r = menu(); r.tick(Math.ceil(10.2 * 60));
  press(r, "Escape");
  check("ATTRACT Escape -> MENU", r.app.screen === SCREEN.MENU, r.app.screen);
  for (const code of ["Enter", "KeyQ", "ArrowLeft", "Space", "KeyP", "KeyR", "KeyM", "KeyC"]) {
    const t = menu(); t.tick(Math.ceil(10.2 * 60));
    const r0 = reloads, c0 = clip.length;
    press(t, code);
    check("ATTRACT " + code + " -> a CORE room-1 run, playing, no bomb from the press",
      t.app.screen === SCREEN.GAME && t.world.state === "PLAY" && t.world.level === 1 && (t.world.heat | 0) === 0 && live(t.world) === 0,
      t.app.screen + "/" + live(t.world));
    check("ATTRACT " + code + " arms no reset, reloads nothing, copies nothing, pauses nothing",
      t.app.resetArm === false && reloads === r0 && clip.length === c0 && t.world.state !== "PAUSE", t.app.resetArm + "/" + reloads);
  }
  // H4 (ruling 2026-10-09): a cursor parked on DAILY never turns ATTRACT's exit into the daily
  const d = new Date(), p2 = (n) => (n < 10 ? "0" + n : "" + n);
  const today = d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
  for (const code of ["KeyR", "KeyM"]) {
    const t = menu(); toRow(t, ITEMS.indexOf("DAILY")); t.tick(Math.ceil(10.2 * 60));
    const at = t.app.screen === SCREEN.ATTRACT && t.app.cursor === ITEMS.indexOf("DAILY");
    press(t, code);
    check("ATTRACT " + code + " with the MENU cursor on DAILY -> an ordinary run, not the daily",
      at && t.app.screen === SCREEN.GAME && !(t.ro.run && t.ro.run.daily) && t.world.seed !== dailySeed(today) >>> 0,
      at + "/" + t.app.screen + "/" + JSON.stringify(t.ro.run && t.ro.run.daily));
  }
}

// ---- LEVEL SELECT cues (polish 2026-10-19; rows since v202 Task 2.3): ←/→ on a value row, ↓ to the next row and [ ] each
// play ONE uiMove per change through the real keydown path, and none at a clamp edge (pace used to change silently). ----
{
  const plays = [];
  const g = mk({ audio: { play: (n) => plays.push(n), toggle: () => false, duck: noop, pump: noop, unlocked: () => false } });
  g.app.skip(); g.app.cursor = ITEMS.indexOf("LEVEL SELECT"); g.app.confirm(); g.tick(2);
  const lv0 = g.app.screen === SCREEN.LEVEL;
  plays.length = 0; press(g, "ArrowRight"); const a = plays.join();
  plays.length = 0; press(g, "ArrowDown"); const b0 = plays.join();
  plays.length = 0; press(g, "ArrowRight"); const b = plays.join();
  plays.length = 0; press(g, "BracketRight"); const c = plays.join();
  plays.length = 0; press(g, "BracketRight"); const d = plays.join();
  check("LEVEL → / ↓ then → on DIFFICULTY / ] each cue exactly one uiMove",
    lv0 && a === "uiMove" && b0 === "uiMove" && b === "uiMove" && c === "uiMove" && g.app.level === 2 && g.app.heat === 1 && g.app.pace === 1, [lv0, a, b0, b, c, g.app.level, g.app.heat, g.app.pace].join("|"));
  check("LEVEL ] at HARD clamps silently", d === "" && g.app.pace === 1, d);
}
// ---- LEVEL SELECT: the FLOOR line adds no key and moves none (#24) ----
{
  const g = show(mk()); press(g, "Enter"); toRow(g, 1); press(g, "Enter");
  const scr = g.app.screen === SCREEN.LEVEL;
  press(g, "ArrowRight"); press(g, "ArrowRight"); press(g, "ArrowDown"); press(g, "ArrowRight"); press(g, "ArrowRight");
  press(g, "KeyF"); press(g, "KeyT");
  check("LEVEL: ←/→ on the LEVEL row, ↓ then ←/→ on DIFFICULTY, F and T are not bound", scr && g.app.screen === SCREEN.LEVEL && g.app.level === 3 && g.app.heat === 2, g.app.level + "/" + g.app.heat);
  press(g, "Enter");
  check("LEVEL Enter starts that room on a tile board", g.app.screen === SCREEN.GAME && g.world.level === 3 && g.world.heat === 2 && g.world.gen === 3 && !!g.world.feat, g.world.gen);
  const e = show(mk()); press(e, "Enter"); toRow(e, 1); press(e, "Enter"); press(e, "Escape");
  check("LEVEL Escape -> MENU", e.app.screen === SCREEN.MENU);
}
// ---- ICE PATCH at MAX: the brake tip paints, adds no key, and
// the key path does what it says: back as you let go stops the slide. ----
{
  delete mem["nb.coach.v2"];
  const v1 = mem["nb.coach.v1"];
  mem["nb.coach.v1"] = "1";
  const g = show(mk()); press(g, "Enter"); toRow(g, 1); press(g, "Enter");
  press(g, "ArrowRight"); press(g, "ArrowDown"); press(g, "ArrowRight"); press(g, "ArrowRight"); press(g, "Enter");
  const w = g.world, p = w.players[0], F = CFG.TILE;
  check("room 2 at MAX, through the keys", g.app.screen === SCREEN.GAME && w.level === 2 && w.heat === 2 && w.gen === 3 && !!w.feat, w.level + "/" + w.heat);
  for (const e of w.enemies) e.speed = 0;
  const y = 6, xs = [3, 4, 5, 6, 7, 8, 9, 10, 11];
  for (const x of xs) { w.grid[y * CFG.COLS + x] = 0; w.feat[y * CFG.COLS + x] = 5; }
  w.bombs = [];
  p.x = 3.5 * F; p.y = (y + 0.5) * F; p.tx = 3; p.ty = y;
  g.tick(2);
  check("first ICE at MAX paints the brake line", /PRESS THE OTHER WAY/.test(g.ro.coach2.s.toUpperCase()) && g.ro.coach2.k === "BRAKE", g.ro.coach2.s); // the tip body is sentence case (fix round 1)
  down("ArrowRight"); g.tick(4); up("ArrowRight"); g.tick(2);
  const moving = p.x; g.tick(2);
  check("let go on MAX ice: the slide goes on", p.x > moving && !!p.gl, moving + " -> " + p.x);
  down("ArrowLeft"); g.tick(1); up("ArrowLeft"); g.tick(30);
  const rest = p.x; g.tick(10);
  check("back as you let go: stopped on a tile centre, short of the far end", p.x === rest && !p.gl && (rest / F) % 1 === 0.5 && rest < 11.5 * F, rest / F);
  check("the tip outlives the slide: a move key does not close it", g.ro.coach2.k === "BRAKE");
  delete mem["nb.coach.v2"];
  if (v1 === undefined) delete mem["nb.coach.v1"]; else mem["nb.coach.v1"] = v1;
}
{
  // an F2 link at MAX: its own board, no tile, no tip, no brake bit
  delete mem["nb.coach.v2"];
  const g = show(mk());
  g.app.playChallenge({ seed: 7, heat: 2, pact: 0, pace: 0, gen: 2 });
  g.tick(5);
  check("an F2 run at MAX: no tile layer, no tile tip", g.world.gen === 2 && !g.world.feat && !g.ro.coach2.k && !(mem["nb.coach.v2"] || "").includes('"z":1'), g.world.gen);
  delete mem["nb.coach.v2"];
}
// ---- LEVEL SELECT: ←/→ room on the LEVEL row, ↓ then ←/→ heat on DIFFICULTY, [ ] pace, 1–5 when unlocked, Enter, Esc ----
{
  const g = menu(); toRow(g, 1); press(g, "Enter");
  press(g, "ArrowRight"); press(g, "KeyD"); press(g, "ArrowLeft");
  const lv = g.app.level;
  press(g, "ArrowDown"); press(g, "ArrowRight"); const h1 = g.app.heat; press(g, "ArrowLeft"); const h0 = g.app.heat; press(g, "KeyD");
  press(g, "BracketRight"); const p1 = g.app.pace; press(g, "BracketLeft"); press(g, "BracketLeft");
  press(g, "Digit1");
  check("LEVEL → / D raise the room, ← lowers it", lv === 2, lv);
  check("LEVEL ↓ to DIFFICULTY, then → / D raise heat, ← lowers it", h1 === 1 && h0 === 0 && g.app.heat === 1, h1 + "," + h0 + "," + g.app.heat);
  check("LEVEL ] raises pace, [ lowers it", g.app.pace === p1 - 2, p1 + "->" + g.app.pace);
  check("LEVEL 1 is inert before the first clear", (g.app.pact | 0) === 0, g.app.pact);
  press(g, "KeyW");
  check("LEVEL W / ↑ walks back to the LEVEL row, heat kept", g.app.levelRow === 0 && g.app.heat === 1, g.app.levelRow + "/" + g.app.heat);
  for (let i = 0; i < 6; i++) press(g, "ArrowRight");
  check("LEVEL → clamps at room 5 while locked", g.app.level === 5, g.app.level);
  press(g, "Enter");
  check("LEVEL Enter starts that room at that heat", g.app.screen === SCREEN.GAME && g.world.level === 5 && g.world.heat === 1,
    g.world.level + "/" + g.world.heat);
  const e = menu(); toRow(e, 1); press(e, "Enter"); press(e, "Escape");
  check("LEVEL Escape -> MENU", e.app.screen === SCREEN.MENU);
  const u = menu(); u.app.pactUnlocked = true; toRow(u, 1); press(u, "Enter");
  press(u, "Digit1"); press(u, "Digit2"); press(u, "Numpad3"); press(u, "Digit4"); press(u, "Digit5");
  check("LEVEL 1–4 toggle the four Pact bits once unlocked", (u.app.pact | 0) === 15, u.app.pact);
  check("LEVEL 5 toggles TIME ATTACK once unlocked", u.app.timeAttack === true);
  for (let i = 0; i < 9; i++) press(u, "ArrowRight");
  check("LEVEL → reaches room 8 once unlocked", u.app.level === 8, u.app.level);
}

// ---- LEVEL SELECT matrix (v202 Task 2.3; design record §4 "LEVEL SELECT: one path"; the lead's rulings 1-10): every row
// focused (0 LEVEL, 1 DIFFICULTY, 2 GAME SPEED, 3 MODIFIERS, 4 START), modifiers offered and not, and the open MODIFIERS list
// (cursor on ONE LIFE, FEWER ITEMS, TIME TRIAL), x every key, through the real keydown listeners and main's cue wrappers.
// Base: level 3, HARD, NORMAL speed, no modifiers, so every step has room. Each row checks the screen, the focused row, the
// list and its cursor, level, difficulty, speed, the modifier mask and TIME TRIAL, the run started (from the world), the cues
// and the one ranked feel the press leaves. Expected values come from the rulings, never from reading the handlers back. ----
const LVPLAY = [];
const LVAUD = { play: (n) => LVPLAY.push(n), toggle: () => false, duck: noop, unlocked: () => true, pump: noop, unlock: () => true };
const LVBITS = [PACT.LAST, PACT.BARE, PACT.THIN, PACT.SHRINK];
const LVROW = ["LEVEL", "DIFFICULTY", "GAME SPEED", "MODIFIERS", "START"];
const lvWalk = (U) => (U ? [0, 1, 2, 3, 4] : [0, 1, 2, 4]);
const lvTop = (fs) => fs.reduce((a, f) => (!a || FEELS.indexOf(f) < FEELS.indexOf(a) ? f : a), "");
const lvStates = () => [...[false, true].flatMap((U) => lvWalk(U).map((row) => ({ U, row }))), ...[0, 2, 4].map((cur) => ({ U: true, row: 3, open: true, cur }))];
const lvName = (s) => (s.open ? "the open list on " + ["ONE LIFE", "NO FLOOR ITEMS", "FEWER ITEMS", "SHRINK", "TIME TRIAL"][s.cur] : LVROW[s.row] + (s.U ? "" : " (no modifiers)"));
/* The rulings as a table: the state after one press of k (a key code, or START for the controller's START). */
function lvWant(s, k) {
  const e = { scr: SCREEN.LEVEL, row: s.row, open: !!s.open, cur: s.open ? s.cur : -1, level: 3, heat: 1, pace: 0, pact: 0, time: false, run: null, cues: "", feel: "" };
  const W = lvWalk(s.U), i = W.indexOf(s.row);
  const go = () => Object.assign(e, { scr: SCREEN.GAME, run: { level: e.level, heat: e.heat, pace: e.pace, pact: e.pact }, cues: "uiSel", feel: "launch" });
  const tog = (j) => { if (j < 4) e.pact ^= LVBITS[j]; else e.time = !e.time; };
  switch (k) {
    case "ArrowLeft": case "ArrowRight": { // the focused row's value; nothing on MODIFIERS, START or in the list
      const d = k === "ArrowLeft" ? -1 : 1;
      if (e.open || s.row > 2) break;
      if (s.row === 0) e.level += d; else if (s.row === 1) e.heat += d; else e.pace += d;
      Object.assign(e, { cues: "uiMove", feel: "move" });
      break;
    }
    case "ArrowUp": case "ArrowDown": { // the rows (MODIFIERS skipped when not offered), or the list's entries; clamped, silent at an edge
      const d = k === "ArrowUp" ? -1 : 1;
      if (e.open) { const n = s.cur + d; if (n >= 0 && n <= 4) Object.assign(e, { cur: n, cues: "uiMove", feel: "move" }); }
      else { const j = i + d; if (j >= 0 && j < W.length) Object.assign(e, { row: W[j], cues: "uiMove", feel: "move" }); }
      break;
    }
    case "Enter": case "Space": // toggle in the list, open it on MODIFIERS, else start the run
      if (e.open) { tog(s.cur); Object.assign(e, { cues: "uiTog", feel: "confirm" }); } // the in-place toggle sound (SETTINGS' precedent), never the start sound
      else if (s.row === 3) Object.assign(e, { open: true, cur: 0, cues: "uiSel", feel: "enter" });
      else go();
      break;
    case "Escape": case "Backspace": // close the list first, then leave for MENU on LEVEL SELECT
      if (e.open) Object.assign(e, { open: false, cur: -1, cues: "uiBack", feel: "back" });
      else Object.assign(e, { scr: SCREEN.MENU, cues: "uiBack", feel: "back" });
      break;
    case "BracketLeft": case "BracketRight": // the pace shortcut from anywhere, the focus kept
      e.pace += k === "BracketLeft" ? -1 : 1;
      Object.assign(e, { cues: "uiMove", feel: "confirm" });
      break;
    case "START": // the controller's START always starts, from any row, the list open or shut
      Object.assign(e, { row: 4, open: false, cur: -1 });
      go();
      break;
    default: { const m = /^Digit([1-5])$/.exec(k); if (m && s.U) { tog(+m[1] - 1); e.feel = "confirm"; } } // the digit shortcuts: silent, as before
  }
  return e;
}
const lvGot = (g) => { const a = g.app, w = g.world; return { scr: a.screen, row: a.levelRow, open: a.modOpen, cur: a.modeCur, level: a.level, heat: a.heat, pace: a.pace, pact: a.pact | 0, time: a.timeAttack, run: a.screen === SCREEN.GAME ? { level: w.level, heat: w.heat | 0, pace: w.pace | 0, pact: w.pact | 0 } : null, cues: LVPLAY.join(), feel: lvTop(g.fs) }; };
const lvSpy = (g) => { const f0 = g.app._feel.bind(g.app); g.fs = []; g.app._feel = (n) => { g.fs.push(n); return f0(n); }; LVPLAY.length = 0; return g; };
const lvMem = () => { const s = { p: mem["nb.pace.v1"], t: mem["nb.times.v1"] }; return () => { for (const [k, v] of [["nb.pace.v1", s.p], ["nb.times.v1", s.t]]) if (v === undefined) delete mem[k]; else mem[k] = v; }; };
{
  const restore = lvMem();
  /* setup by state (the walk, the entry and the list's opening are rows of this matrix and of tests/level-select.test.mjs) */
  const lvAt = (s) => {
    const g = mk({ audio: LVAUD }); g.app.cabinetSeen = true; g.app.skip();
    g.app.pactUnlocked = s.U; g.app.cursor = ITEMS.indexOf("LEVEL SELECT"); g.app.confirm(); g.tick(2);
    Object.assign(g.app, { level: 3, heat: 1, pace: 0, pact: 0, timeAttack: false, levelRow: s.row, modOpen: !!s.open, modeCur: s.open ? s.cur : -1 });
    return lvSpy(g);
  };
  const KEYS_LV = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "Space", "Escape", "Backspace", "BracketLeft", "BracketRight", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5"];
  for (const s of lvStates()) for (const k of KEYS_LV) {
    const g = lvAt(s), w = lvWant(s, k);
    press(g, k); g.tick();
    const got = lvGot(g), ok = JSON.stringify(got) === JSON.stringify(w) && (w.scr !== SCREEN.MENU || g.app.cursor === ITEMS.indexOf("LEVEL SELECT"));
    check("LEVEL keys: " + lvName(s) + " + " + k + " -> " + (w.scr === SCREEN.GAME ? "a run " + JSON.stringify(w.run) : w.scr === SCREEN.MENU ? "MENU on LEVEL SELECT" : (w.open ? "list " + w.cur : LVROW[w.row])) + ", cues [" + w.cues + "], feel " + (w.feel || "none"),
      ok, JSON.stringify(got) + " vs " + JSON.stringify(w));
  }
  /* ruling 10: a start from LEVEL SELECT starts exactly what the page shows, from every row that starts */
  for (const row of [0, 1, 2, 4]) for (const k of ["Enter", "Space"]) {
    const g = lvAt({ U: true, row });
    Object.assign(g.app, { level: 4, heat: 2, pace: 1, pact: PACT.LAST | PACT.THIN, timeAttack: true });
    press(g, k); g.tick();
    check("LEVEL keys: " + k + " on " + LVROW[row] + " starts level 4, EXPERT, FAST, ONE LIFE + FEWER ITEMS (what the page shows)",
      g.app.screen === SCREEN.GAME && g.world.level === 4 && g.world.heat === 2 && g.world.pace === 1 && g.world.pact === (PACT.LAST | PACT.THIN), [g.world.level, g.world.heat, g.world.pace, g.world.pact].join("/"));
  }
  /* the lock cannot be bypassed by any key path */
  {
    const g = lvAt({ U: false, row: 0 });
    down("ArrowRight"); g.tick(90); up("ArrowRight"); g.tick(2);
    check("LEVEL keys (locked): → held from 3 stops at 5, one uiMove a level, the card flashes level 6 once (one deny) for the whole hold",
      g.app.level === 5 && LVPLAY.join() === "uiMove,uiMove" && g.fs.filter((f) => f === "deny").length === 1 && g.app.lockR === 6, g.app.level + " " + LVPLAY.join() + " " + g.fs.join());
    LVPLAY.length = 0; g.fs.length = 0;
    press(g, "ArrowRight");
    check("LEVEL keys (locked): one press of → at 5 flashes once and plays no cue", g.app.level === 5 && LVPLAY.length === 0 && g.fs.join() === "deny", g.fs.join());
    for (const k of ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"]) press(g, k);
    press(g, "Enter");
    check("LEVEL keys (locked): Enter after the flash and 1-5 starts level 5, no modifier, never the locked level", g.app.screen === SCREEN.GAME && g.world.level === 5 && (g.world.pact | 0) === 0, g.world.level + "/" + g.world.pact);
  }
  /* held repeat: rows walk at the menu rate and stop silently; a held → on DIFFICULTY steps it; a held ↓ walks the list */
  for (const U of [false, true]) {
    const g = lvAt({ U, row: 0 });
    down("ArrowDown"); g.tick(120); up("ArrowDown"); g.tick(2);
    check("LEVEL keys: ↓ held walks every row to START and stops there silently (" + (U ? "offered" : "not offered") + ")", g.app.levelRow === 4 && LVPLAY.filter((n) => n === "uiMove").length === lvWalk(U).length - 1 && g.app.heat === 1, g.app.levelRow + " " + LVPLAY.join());
  }
  {
    const g = lvAt({ U: true, row: 1 }); g.app.heat = 0;
    down("ArrowRight"); g.tick(90); up("ArrowRight"); g.tick(2);
    check("LEVEL keys: → held on DIFFICULTY steps NORMAL -> EXPERT and stops silently", g.app.heat === 2 && LVPLAY.join() === "uiMove,uiMove" && g.app.levelRow === 1, g.app.heat + " " + LVPLAY.join());
    const h = lvAt({ U: true, row: 3, open: true, cur: 0 });
    down("ArrowDown"); h.tick(120); up("ArrowDown"); h.tick(2);
    check("LEVEL keys: ↓ held in the open list walks to TIME TRIAL and stops silently", h.app.modeCur === 4 && h.app.modOpen && LVPLAY.filter((n) => n === "uiMove").length === 4, h.app.modeCur + " " + LVPLAY.join());
    const sp = lvAt({ U: true, row: 2 }); sp.app.pace = -1;
    down("ArrowRight"); sp.tick(90); up("ArrowRight"); sp.tick(2);
    check("LEVEL keys: → held on GAME SPEED repeats like any value row: SLOW -> FAST, two uiMoves, then silent at FAST", sp.app.pace === 1 && LVPLAY.join() === "uiMove,uiMove" && sp.app.levelRow === 2, sp.app.pace + " " + LVPLAY.join());
    for (const k of ["ArrowLeft", "ArrowRight"]) {
      const l = lvAt({ U: true, row: 3, open: true, cur: 2 });
      down(k); l.tick(90); up(k); l.tick(2);
      check("LEVEL keys: " + k + " held in the open list does nothing at all (no step, no repeat, no cue)", l.app.modeCur === 2 && l.app.modOpen && l.app.pace === 0 && l.app.level === 3 && l.app.heat === 1 && LVPLAY.length === 0, l.app.modeCur + " " + LVPLAY.join());
    }
  }
  restore();
}

// ---- DAILY ----
{
  const d = new Date(), p = (n) => (n < 10 ? "0" + n : "" + n);
  const today = d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  const g = menu(); toRow(g, 2); press(g, "Enter");
  check("DAILY Enter plays today's pinned board", g.app.screen === SCREEN.GAME && g.world.level === 1 &&
    (g.world.heat | 0) === 0 && (g.world.pact | 0) === 0 && (g.world.pace | 0) === 0 && g.world.seed === dailySeed(today) >>> 0,
    g.world.seed + " vs " + dailySeed(today));
}

// ---- OPTIONS (both row sets) ----
for (const [LK, blob] of LOOKS) withSettings(blob, () => {
  const g = menu(); toRow(g, ITEMS.indexOf("SETTINGS")); press(g, "Enter");
  check("OPTIONS (" + LK + "): the rows on screen", g.app.optRows().length === (blob ? 12 : 10) && g.app.optRows().includes("CAMERA") === !!blob, g.app.optRows().length);
  const m0 = g.app.settings.mus;
  press(g, "ArrowLeft"); const m1 = g.app.settings.mus; press(g, "ArrowRight");
  press(g, "ArrowDown"); const r1 = g.app.optLabel(); press(g, "ArrowUp");
  press(g, "Enter"); const m2 = g.app.settings.mus;
  check("OPTIONS ← / → adjust the row (" + LK + ")", m1 === m0 - 10 && g.app.settings.mus !== m1, m0 + "," + m1);
  check("OPTIONS ↓ / ↑ move the row (" + LK + ")", r1 === "SFX" && g.app.optLabel() === "MUSIC", r1 + "," + g.app.optRow);
  check("OPTIONS Enter cycles the row once (" + LK + ")", m2 === (m0 >= 100 ? 0 : m0 + 10), m0 + "->" + m2);
  press(g, "ArrowUp"); const last = g.app.optLabel(); press(g, "ArrowDown");
  check("OPTIONS ↑ from the top wraps to the last row, RESET DEFAULTS, and ↓ back (" + LK + ")", last === "RESET DEFAULTS" && g.app.optRow === 0);
  press(g, "Escape");
  check("OPTIONS Escape -> MENU (" + LK + ")", g.app.screen === SCREEN.MENU);
});
// ---- OPTIONS RENDER: three values (R4), persisted in nb.settings.v1 (R5) ----
{
  const rec = new Proxy(function () {}, { get: (t, p) => (p === Symbol.toPrimitive ? () => "" : () => rec), apply: () => rec, set: () => true });
  const fake3d = () => ({ ctx: rec, overlay: null, canvas: null, render() {}, consumeEvents() {}, getShake: () => ({ x: 0, y: 0 }) });
  const s0 = mem["nb.settings.v1"];
  const v = (g) => (g.app.render3d ? 2 : g.app.pixel ? 1 : 0) + ":" + g.app.settings.r3d + g.app.settings.px;
  let g = show(mk({ createRenderer3D: fake3d })); press(g, "Enter"); toRow(g, ITEMS.indexOf("SETTINGS")); press(g, "Enter"); toRow(g, 3);
  const at = [v(g)];
  for (let i = 0; i < 3; i++) { press(g, "Enter"); at.push(v(g)); }
  check("OPTIONS RENDER Enter cycles CLASSIC 2D -> PIXEL -> REAL 3D -> CLASSIC 2D", at.join() === "0:00,1:01,2:10,0:00", at.join());
  const lr = [];
  for (let i = 0; i < 4; i++) { press(g, "ArrowRight"); lr.push(v(g)); }
  for (let i = 0; i < 4; i++) { press(g, "ArrowLeft"); lr.push(v(g)); }
  check("OPTIONS RENDER → / ← clamp at REAL 3D and CLASSIC 2D", lr.join() === "1:01,2:10,2:10,2:10,1:01,0:00,0:00,0:00", lr.join());
  press(g, "ArrowRight");
  const kinds = [g.app.pixel, g.renderer && g.renderer._dbg ? "px" : "?"].join();
  press(g, "ArrowDown"); const cam0 = g.app.settings.cam, lab0 = g.app.optLabel(); press(g, "Enter"); press(g, "ArrowRight");
  check("OPTIONS CAMERA is locked in PIXEL (Enter and → change nothing): not a row, ↓ from ART STYLE lands on SCREEN SHAKE, and Enter / → there leave cam alone", g.app.settings.cam === cam0 && lab0 === "SCREEN SHAKE" && g.app.optLabel() === "SCREEN SHAKE" && !g.app.optRows().includes("CAMERA"), g.app.settings.cam + " " + lab0);
  check("OPTIONS RENDER PIXEL swaps the live renderer and saves px:1, r3d:0", kinds === "true,px" && /"r3d":0,.*"px":1[,}]/.test(mem["nb.settings.v1"] || ""), kinds + " " + mem["nb.settings.v1"]);
  g = mk({ createRenderer3D: fake3d });
  check("RENDER PIXEL survives a reload: boots pixel, px renderer, blob unchanged", g.app.pixel === true && g.app.render3d === false && !!g.renderer._dbg && g.app.settings.px === 1, v(g));
  if (s0 === undefined) delete mem["nb.settings.v1"]; else mem["nb.settings.v1"] = s0;
}

// ---- GRAPHICS (unified spec 2026-10-10 §5, UX §10 rows 1-11) ----
/* main.js's GRAPHICS glue (P/Esc 2 -> 1 in PAUSE, GRAPHICS tap routing, the
   door / page confirm cues) is the frame-pacing package's edit; until its
   graphicsHit import lands those rows log as SKIP, never as a silent pass. */
const WIRED = /graphicsHit/.test(readFileSync(new URL("../src/main.js", import.meta.url), "utf8"));
const wired = (name, cond, detail) => (WIRED ? check(name, cond, detail) : console.log("  SKIP " + name + " (awaiting main.js GRAPHICS wiring)"));
const gdoor = (g) => optAt(g, "GRAPHICS"); // the GRAPHICS door in the rows on screen: 7 of the ten, 9 of the twelve
const gfxPage = (g) => { toRow(g, ITEMS.indexOf("SETTINGS")); press(g, "Enter"); toRow(g, gdoor(g)); press(g, "Enter"); return g; };
const six = (s) => [s.fps, s.res, s.shd, s.aa, s.fxq, s.dmo].join("");
for (const [LK, blob] of LOOKS) withSettings(blob, () => {
  // 1: the door
  const g = menu(); toRow(g, ITEMS.indexOf("SETTINGS")); press(g, "Enter"); toRow(g, gdoor(g));
  const s0 = JSON.stringify(g.app.settings);
  press(g, "ArrowLeft"); press(g, "ArrowRight");
  check("GRAPHICS door (" + LK + "): OPTIONS ↓ x" + (blob ? 9 : 7) + " lands on it, ←/→ change nothing", g.app.optRow === (blob ? 9 : 7) && g.app.optLabel() === "GRAPHICS" && g.app.screen === SCREEN.SETTINGS && JSON.stringify(g.app.settings) === s0, g.app.optRow);
  press(g, "Enter");
  check("GRAPHICS door Enter opens SCREEN.GRAPHICS at row 0", g.app.screen === SCREEN.GRAPHICS && g.app.gfxRow === 0, g.app.screen + "/" + g.app.gfxRow);
  // 2: wrap
  press(g, "ArrowUp"); const up = g.app.gfxRow; press(g, "ArrowDown");
  check("GRAPHICS ↑ wraps 0 -> 7, ↓ wraps 7 -> 0", up === GFX_ROWS.length - 1 && g.app.gfxRow === 0, up + "," + g.app.gfxRow);
  // 3: FRAME RATE clamps, Enter wraps
  press(g, "ArrowDown"); press(g, "ArrowRight"); press(g, "ArrowRight");
  const mx = g.app.settings.fps; press(g, "Enter");
  check("FRAME RATE → clamps at MAX; Enter cycles MAX -> 30", mx === 2 && g.app.settings.fps === 0, mx + "->" + g.app.settings.fps);
  check("a GRAPHICS change persists inside nb.settings.v1", /"fps":0/.test(mem["nb.settings.v1"] || ""), mem["nb.settings.v1"]);
  // 5: CUSTOM, then 4: the preset cycle
  press(g, "ArrowUp");
  check("a hand edit derives CUSTOM", g.app.gfxPreset() === "CUSTOM");
  press(g, "Enter");
  check("from CUSTOM, Enter = AUTO", g.app.gfxPreset() === "AUTO" && six(g.app.settings) === "112111", six(g.app.settings));
  const cyc = [];
  for (let i = 0; i < 3; i++) { press(g, "Enter"); cyc.push(g.app.gfxPreset() + ":" + six(g.app.settings)); }
  check("QUALITY Enter AUTO -> HIGH -> BATTERY -> AUTO writes all six rows", cyc.join() === "HIGH:222212,BATTERY:000000,AUTO:112111", cyc.join());
  g.app.settings.fxq = 0; press(g, "ArrowLeft");
  check("from CUSTOM, ← = BATTERY", g.app.gfxPreset() === "BATTERY");
  g.app.settings.fxq = 1; press(g, "ArrowRight");
  check("from CUSTOM, → = HIGH", g.app.gfxPreset() === "HIGH");
  // 7: back path, M and digits
  const sx = JSON.stringify(g.app.settings);
  for (const k of ["Digit1", "Digit5", "BracketLeft", "BracketRight", "KeyM", "KeyT"]) press(g, k);
  check("digits, pace keys, M and T do nothing on GRAPHICS", g.app.screen === SCREEN.GRAPHICS && JSON.stringify(g.app.settings) === sx);
  press(g, "Escape");
  check("Escape -> OPTIONS on the GRAPHICS door (" + LK + ")", g.app.screen === SCREEN.SETTINGS && g.app.optRow === gdoor(g) && g.app.optLabel() === "GRAPHICS", g.app.screen + "/" + g.app.optRow);
  press(g, "Enter"); press(g, "Backspace");
  check("Backspace -> OPTIONS on the GRAPHICS door (" + LK + ")", g.app.screen === SCREEN.SETTINGS && g.app.optRow === gdoor(g));
  press(g, "Escape");
  check("a second Escape -> MENU", g.app.screen === SCREEN.MENU);
  // RESET DEFAULTS returns GRAPHICS to AUTO
  check("MENU kept its cursor on OPTIONS", g.app.cursor === ITEMS.indexOf("SETTINGS"));
  press(g, "Enter"); toRow(g, optAt(g, "RESET DEFAULTS")); press(g, "Enter");
  check("RESET DEFAULTS returns GRAPHICS to AUTO", g.app.gfxPreset() === "AUTO" && /"fps":1,"res":1,"shd":2,"aa":1,"fxq":1,"dmo":1,"fpm":0/.test(mem["nb.settings.v1"] || ""), mem["nb.settings.v1"]);
});
// 6: locks per RENDER (presets still write locked rows)
{
  const rec = new Proxy(function () {}, { get: (t, p) => (p === Symbol.toPrimitive ? () => "" : () => rec), apply: () => rec, set: () => true });
  const fake3d = () => ({ ctx: rec, overlay: null, canvas: null, render() {}, consumeEvents() {}, getShake: () => ({ x: 0, y: 0 }) });
  const probe = (g) => [2, 3, 4].filter((r) => {
    const k = ["", "", "res", "shd", "aa"][r], v = g.app.settings[k];
    g.app.gfxRow = r; press(g, "ArrowLeft"); const a = g.app.settings[k]; g.app.settings[k] = v;
    press(g, "Enter"); const b = g.app.settings[k]; g.app.settings[k] = v;
    return a === v && b === v;
  }).join("");
  for (const [name, blob, want] of [["CLASSIC 2D", {}, "234"], ["PIXEL", { px: 1 }, "34"], ["REAL 3D", { r3d: 1 }, ""]]) withSettings(blob, () => {
    const g = show(mk({ createRenderer3D: fake3d })); press(g, "Enter"); gfxPage(g);
    const got = probe(g);
    check("GRAPHICS locks in " + name + ": rows " + (want || "none") + " ignore ← and Enter", got === want && g.app.screen === SCREEN.GRAPHICS, got);
    g.app.gfxRow = 0; press(g, "Enter");
    check("GRAPHICS in " + name + ": QUALITY still writes the locked rows", g.app.gfxPreset() === "HIGH" && g.app.settings.res === 2 && g.app.settings.aa === 2);
    const dash = g.app.gfxView().rows.filter((r) => r.val === "—").length;
    check("GRAPHICS in " + name + ": " + want.length + " rows read an em dash", dash === want.length, dash);
  });
}
// 8: idle — GRAPHICS never enters ATTRACT; DEMO OFF never; SHORT parks MENU after DEMO_T
withSettings(null, () => {
  const g = gfxPage(menu()); g.tick(60 * (IDLE_T + 2));
  check("12 s idle on GRAPHICS never enters ATTRACT", g.app.screen === SCREEN.GRAPHICS, g.app.screen);
  const m = menu(); g.tick(1); m.tick(60 * IDLE_T + 30);
  check("DEMO SHORT (default): MENU idle still enters ATTRACT", m.app.screen === SCREEN.ATTRACT, m.app.screen);
  m.tick(60 * DEMO_T + 30);
  check("DEMO SHORT: after 60 s ATTRACT returns to MENU and parks", m.app.screen === SCREEN.MENU && m.app.parked === true && !m.demo, m.app.screen);
  m.tick(60 * (IDLE_T + 5));
  check("DEMO SHORT: parked MENU never re-enters ATTRACT", m.app.screen === SCREEN.MENU);
  press(m, "ArrowDown");
  check("DEMO SHORT: the next input unparks", m.app.parked === false && m.app.cursor === 1);
});
withSettings({ dmo: 0 }, () => {
  const m = menu(); m.tick(60 * (IDLE_T + 5));
  check("DEMO OFF: 15 s idle on MENU never enters ATTRACT", m.app.screen === SCREEN.MENU, m.app.screen);
});
// 9: PAUSE -> OPTIONS -> GRAPHICS is the inline pauseView 2 (both row sets)
for (const [LK, blob] of LOOKS) withSettings(blob, () => {
  const o = run(); press(o, "KeyP"); toRow(o, PAUSE_ITEMS.indexOf("SETTINGS")); press(o, "Enter"); toRow(o, gdoor(o)); press(o, "Enter");
  check("PAUSE OPTIONS GRAPHICS door opens inline pauseView 2 (shell GAME, still PAUSE)", o.app.pauseView === 2 && o.app.screen === SCREEN.GAME && o.world.state === "PAUSE" && o.app.gfxRow === 0,
    o.app.pauseView + "/" + o.app.screen + "/" + o.world.state);
  press(o, "ArrowDown"); press(o, "ArrowLeft");
  check("pause view 2: ↓ moves gfxRow, ← adjusts FRAME RATE (" + LK + ")", o.app.gfxRow === 1 && o.app.settings.fps === 0 && o.app.optRow === gdoor(o));
  press(o, "Enter");
  check("pause view 2: Enter cycles the row, still PAUSE", o.app.settings.fps === 1 && o.world.state === "PAUSE" && o.app.pauseView === 2);
  press(o, "KeyP");
  wired("pause view 2: P backs to OPTIONS on the door, still PAUSE (" + LK + ")", o.app.pauseView === 1 && o.app.optRow === gdoor(o) && o.app.optLabel() === "GRAPHICS" && o.world.state === "PAUSE", o.app.pauseView + "/" + o.world.state);
  if (WIRED) {
    press(o, "Enter"); press(o, "Escape");
    wired("pause view 2: Escape backs to OPTIONS", o.app.pauseView === 1 && o.world.state === "PAUSE", o.app.pauseView);
    press(o, "Escape");
    wired("pause OPTIONS: Escape backs to the list, on SETTINGS (" + LK + ")", o.app.pauseView === 0 && o.app.pauseCursor === PAUSE_ITEMS.indexOf("SETTINGS") && o.world.state === "PAUSE");
    press(o, "KeyP");
    wired("pause list: P resumes", o.world.state === "PLAY");
  }
});
// 10: taps — a row tap = Enter on it, off the rows backs out one level (600x520 buffer, k=1); both row sets
for (const [LK, blob] of LOOKS) withSettings(blob, () => {
  const mkEl = () => {
    const PL = {};
    const ctx = new Proxy(function () {}, { get: (t, p) => (p === Symbol.toPrimitive ? () => "" : () => ctx), apply: () => ctx, set: () => true });
    const el = { width: 600, height: 520, style: {}, getContext: () => ctx,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 520 }),
      addEventListener: (ty, fn) => { (PL[ty] = PL[ty] || []).push(fn); }, removeEventListener: noop };
    return { el, tap: (g, x, y) => { (PL.pointerdown || []).forEach((f) => f({ clientX: x, clientY: y })); g.tick(); (PL.pointerup || []).forEach((f) => f({ clientX: x, clientY: y })); g.tick(); } };
  };
  const G = graphicsGeom(menuLayout(600, 520)), at = (r) => G.rows[G.order[r]].y + G.rows[G.order[r]].h / 2; // v202 Task 3.4: rows by name (pages/settings.js)
  const A = mkEl(), g = gfxPage(menu(A.el));
  A.tap(g, 300, at(1));
  wired("GRAPHICS tap on FRAME RATE = Enter on it (60 -> MAX)", g.app.screen === SCREEN.GRAPHICS && g.app.gfxRow === 1 && g.app.settings.fps === 2, g.app.gfxRow + "/" + g.app.settings.fps);
  A.tap(g, 4, 4); // off the plate (v202 Task 3.4: the world-kit plate reaches higher than the old one's y 20)
  wired("GRAPHICS tap off the rows backs out to OPTIONS on the door (" + LK + ")", g.app.screen === SCREEN.SETTINGS && g.app.optRow === gdoor(g) && g.app.optLabel() === "GRAPHICS", g.app.screen);
  const B = mkEl(), o = menu(B.el); press(o, "Enter");
  press(o, "KeyP"); toRow(o, PAUSE_ITEMS.indexOf("SETTINGS")); press(o, "Enter"); toRow(o, gdoor(o)); press(o, "Enter");
  const PG = graphicsGeom({ ...menuLayout(600, 520), paused: true }), atP = (r) => PG.rows[PG.order[r]].y + PG.rows[PG.order[r]].h / 2; // a PAUSE view: the HUD band kept clear (fix round 1)
  B.tap(o, 300, atP(5));
  wired("pause view 2 tap on EFFECTS = Enter on it (FULL -> LOW), still PAUSE", o.app.pauseView === 2 && o.app.gfxRow === 5 && o.app.settings.fxq === 0 && o.world.state === "PAUSE",
    o.app.pauseView + "/" + o.app.gfxRow + "/" + o.app.settings.fxq);
  B.tap(o, 4, 4); // off the plate (v202 Task 3.4 fix round 1: was (300, 20), ~2 px from the world-kit ring)
  wired("pause view 2 tap off the rows backs to OPTIONS (view 1), still PAUSE", o.app.pauseView === 1 && o.world.state === "PAUSE", o.app.pauseView + "/" + o.world.state);
});
// 12 (close-out review): the rest of the documented keys on SCREEN.GRAPHICS and in pauseView 2.
// Space / J / X are fire = Enter (cycle the row, never a bomb); the play-only and other-screen
// keys change nothing; in pauseView 2 M is still PAUSE's quit-to-MENU and Backspace is a no-op as in view 1.
for (const [LK, blob] of LOOKS) withSettings(blob, () => {
  const gs = (g) => JSON.stringify([g.app.screen, g.app.pauseView, g.world.state, g.app.gfxRow, g.app.settings, live(g.world)]);
  for (const code of ["Space", "KeyJ", "KeyX"]) {
    const g = gfxPage(menu()); g.app.gfxRow = 5; const f0 = g.app.settings.fxq; press(g, code);
    check("GRAPHICS " + code + " = Enter: cycles EFFECTS, stays on the page", g.app.screen === SCREEN.GRAPHICS && g.app.settings.fxq === 1 - f0 && live(g.world) === 0, f0 + "->" + g.app.settings.fxq);
    const o = run(); press(o, "KeyP"); toRow(o, PAUSE_ITEMS.indexOf("SETTINGS")); press(o, "Enter"); toRow(o, gdoor(o)); press(o, "Enter");
    o.app.gfxRow = 5; const q0 = o.app.settings.fxq; press(o, code);
    check("pause view 2 " + code + " = Enter: cycles EFFECTS, still PAUSE view 2, no bomb", o.app.pauseView === 2 && o.world.state === "PAUSE" && o.app.settings.fxq === 1 - q0 && live(o.world) === 0, q0 + "->" + o.app.settings.fxq);
  }
  for (const code of ["KeyQ", "KeyN", "KeyC", "KeyB", "KeyR", "KeyP", "KeyK", "ShiftLeft", "Digit7"]) {
    const g = gfxPage(menu()); const s0 = gs(g); press(g, code);
    check("GRAPHICS " + code + " does nothing", gs(g) === s0, gs(g));
  }
  for (const code of ["KeyQ", "KeyN", "KeyC", "KeyB", "KeyR", "KeyT", "KeyK", "ShiftLeft", "Digit1", "BracketLeft", "Backspace"]) {
    const o = run(); press(o, "KeyP"); toRow(o, PAUSE_ITEMS.indexOf("SETTINGS")); press(o, "Enter"); toRow(o, gdoor(o)); press(o, "Enter");
    const s0 = gs(o); press(o, code);
    check("pause view 2 " + code + " does nothing (still PAUSE view 2)", gs(o) === s0, gs(o));
  }
  const o = run(); press(o, "KeyP"); toRow(o, PAUSE_ITEMS.indexOf("SETTINGS")); press(o, "Enter"); toRow(o, gdoor(o)); press(o, "Enter");
  press(o, "KeyM");
  check("pause view 2 M quits to MENU like the PAUSE list (score recorded by the same path)", o.app.screen === SCREEN.MENU && !o.app.inGame, o.app.screen);
});
// 11: the AA deferral (a live context rebuild on leaving the page) needs rAF and
// a WebGL renderer cache; tests/frameloop.test.mjs pins it with injected rAF.

// ---- GUIDE + HOW TO / ITEMS / ENEMIES / FLOOR ----
for (let i = 0; i < GUIDE_ROWS.length; i++) {
  const g = menu(); toRow(g, ITEMS.indexOf("GUIDE")); press(g, "Enter");
  toRow(g, i); press(g, "Enter");
  const want = [SCREEN.HOWTO, SCREEN.ITEMS, SCREEN.ENEMIES, SCREEN.FLOOR][i];
  const opened = g.app.screen === want;
  press(g, "Escape"); const esc = g.app.screen;
  press(g, "Enter");
  if (want === SCREEN.ENEMIES) { // v202 Task 3.5 + fix round 1 ruling R3: on keys the tooltip follows focus, arrival included; Escape shuts it first, a second leaves
    const shut = esc === SCREEN.ENEMIES && g.app.foeTip; // the first Escape only shut the arrival's tooltip; the Enter after it opened it again
    press(g, "Escape"); press(g, "Escape"); const left = g.app.screen === SCREEN.GUIDE;
    press(g, "Enter"); const again = g.app.screen === SCREEN.ENEMIES && g.app.foeTip; // GUIDE's Enter: back on ENEMIES, the tooltip open
    press(g, "Enter"); const stay = g.app.screen === SCREEN.ENEMIES && g.app.foeTip; // Enter on an open tooltip does nothing
    press(g, "Escape"); const off = g.app.screen === SCREEN.ENEMIES && !g.app.foeTip;
    press(g, "Enter"); const tip = g.app.foeTip; // Enter opens it
    press(g, "Escape"); press(g, "Escape");
    check("GUIDE ↓ + Enter opens ENEMIES with the tooltip on WALKER; Escape shuts it, a second Escape goes back to GUIDE; Enter opens a shut tooltip, a second Enter stays",
      opened && shut && left && again && stay && off && tip && g.app.screen === SCREEN.GUIDE, [opened, shut, left, again, stay, off, tip, g.app.screen].join("/"));
  } else {
    press(g, "Enter");
    check("GUIDE ↓ + Enter opens " + GUIDE_ROWS[i] + "; Escape and Enter both go back to GUIDE",
      opened && esc === SCREEN.GUIDE && g.app.screen === SCREEN.GUIDE, opened + "/" + esc + "/" + g.app.screen);
  }
  press(g, "Escape");
  check("GUIDE Escape -> MENU (" + GUIDE_ROWS[i] + ")", g.app.screen === SCREEN.MENU);
}
/* ENEMIES (v202 Task 3.5): the arrows walk the foes in order (all four, wrapping) and a key move opens the tooltip on the foe it lands on;
   Backspace leaves like Escape */
{
  const g = menu(); toRow(g, ITEMS.indexOf("GUIDE")); press(g, "Enter"); toRow(g, GUIDE_ROWS.indexOf("ENEMIES")); press(g, "Enter");
  const at0 = g.app.screen === SCREEN.ENEMIES && g.app.foeRow === 0 && g.app.foeTip;
  press(g, "ArrowRight"); const r1 = g.app.foeRow, t1 = g.app.foeTip;
  press(g, "ArrowDown"); const r2 = g.app.foeRow;
  press(g, "ArrowUp"); press(g, "ArrowLeft"); press(g, "ArrowLeft"); const r3 = g.app.foeRow;
  check("ENEMIES: arrives on WALKER, its tooltip open (keys, R3); → / ↓ step on, ↑ / ← step back and wrap to KNIGHT; the tooltip follows", at0 && r1 === 1 && t1 === true && r2 === 2 && r3 === 8 && g.app.foeTip, [at0, r1, t1, r2, r3].join("/"));
  press(g, "Backspace"); const b1 = g.app.screen === SCREEN.ENEMIES && !g.app.foeTip;
  press(g, "Backspace");
  check("ENEMIES: Backspace shuts the open tooltip first, a second Backspace -> GUIDE", b1 && g.app.screen === SCREEN.GUIDE);
}
/* HOW TO / POWER-UPS / FLOOR (fix round 1, R1 / R2): the arrows step the pages where the box pages them, clamped, and never leave; Escape leaves */
for (const [row, scr] of [["HOW TO PLAY", SCREEN.HOWTO], ["POWER-UPS", SCREEN.ITEMS], ["FLOOR", SCREEN.FLOOR]]) {
  const g = menu(); toRow(g, ITEMS.indexOf("GUIDE")); press(g, "Enter"); toRow(g, GUIDE_ROWS.indexOf(row)); press(g, "Enter");
  const p0 = g.app.infoPg;
  for (const k of ["ArrowDown", "ArrowRight", "ArrowDown", "ArrowRight", "ArrowDown", "ArrowRight", "ArrowDown", "ArrowRight", "ArrowDown", "ArrowRight"]) press(g, k);
  const hi = g.app.infoPg, stay = g.app.screen === scr;
  for (let n = 0; n < 12; n++) press(g, n % 2 ? "ArrowUp" : "ArrowLeft");
  const lo = g.app.infoPg;
  press(g, "Escape");
  check(row + ": the arrows step its pages (0 .. pages - 1, clamped) and never leave; Escape -> GUIDE", p0 === 0 && stay && hi >= 0 && lo === 0 && g.app.screen === SCREEN.GUIDE, [p0, hi, lo, g.app.screen].join("/"));
}

// ---- RECORDS: SCORES (its difficulty filter is the page body, under the tab row) ----
{
  const g = menu(); toRow(g, ITEMS.indexOf("RECORDS")); press(g, "Enter"); press(g, "ArrowDown");
  press(g, "ArrowRight"); const h = g.app.scoreHeat; press(g, "ArrowLeft");
  check("SCORES ← / → flip the heat tab", h === 1 && g.app.scoreHeat === 0, h + "," + g.app.scoreHeat);
  press(g, "Enter");
  check("SCORES Enter -> MENU", g.app.screen === SCREEN.MENU);
  const e = menu(); toRow(e, ITEMS.indexOf("RECORDS")); press(e, "Enter"); press(e, "Escape");
  check("SCORES Escape -> MENU", e.app.screen === SCREEN.MENU);
}

// ---- STATS + MEDALS (RECORDS' second and third tabs) ----
{
  const g = menu(); toRow(g, ITEMS.indexOf("RECORDS")); press(g, "Enter"); press(g, "ArrowRight");
  const c0 = clip.length;
  press(g, "KeyC"); await flush();
  check("STATS C copies the stats text", clip.length === c0 + 1 && /STATS|FUSE/i.test(clip[clip.length - 1]), clip[clip.length - 1]);
  press(g, "KeyT");
  check("STATS T opens MEDALS", g.app.screen === SCREEN.TROPHIES);
  press(g, "Escape"); const e = g.app.screen, ec = g.app.cursor; press(g, "Enter"); press(g, "ArrowRight"); press(g, "KeyT"); press(g, "Enter");
  check("MEDALS Escape and Enter both back out to MENU on RECORDS", e === SCREEN.MENU && ec === ITEMS.indexOf("RECORDS") && g.app.screen === SCREEN.MENU && g.app.cursor === ITEMS.indexOf("RECORDS"));
  press(g, "Enter"); press(g, "ArrowRight");
  press(g, "KeyR"); const arm = g.app.resetArm; press(g, "KeyN");
  check("STATS R arms, any other key disarms", arm === true && g.app.resetArm === false && reloads === 0);
  press(g, "KeyR"); press(g, "KeyR");
  check("STATS R, R resets and reloads once", reloads === 1, reloads);
  const cf = [];
  for (const k of ["Escape", "Backspace"]) { press(g, "KeyR"); const a0 = g.app.resetArm; press(g, k); cf.push(a0 && g.app.resetArm === false && g.app.screen === SCREEN.STATS); }
  check("STATS armed, Escape / Backspace close first (R1 cohesion ruling): the reset cancels, STATS stays, nothing reloads", cf.every(Boolean) && reloads === 1, JSON.stringify(cf));
  press(g, "Escape");
  check("STATS Escape -> MENU", g.app.screen === SCREEN.MENU);
  /* v202 Task 4.2, gap 4: only a plain R arms or erases; a chorded R (Ctrl / Cmd / Alt / Shift) never arms, and cancels an armed reset */
  press(g, "Enter"); press(g, "ArrowRight");
  const chord = (mod) => { (L.keydown || []).forEach((f) => f({ code: "KeyR", key: "r", repeat: false, preventDefault: noop, [mod]: true })); g.tick(2); (L.keyup || []).forEach((f) => f({ code: "KeyR", key: "r", preventDefault: noop })); g.tick(2); };
  const r0 = reloads, bad = [];
  for (const mod of ["ctrlKey", "metaKey", "altKey", "shiftKey"]) {
    chord(mod); if (g.app.resetArm) bad.push(mod + " armed");
    press(g, "KeyR"); chord(mod); if (g.app.resetArm || reloads !== r0) bad.push(mod + " confirmed or kept the arm");
  }
  check("STATS gap 4: a chorded R never arms; armed, a chorded R cancels and erases nothing", bad.length === 0 && reloads === r0 && g.app.screen === SCREEN.STATS, bad.join());
}
// STATS C reports back through the SAME endkeys toast WIN / LOSE use (app.toast, painted by shellview)
{
  const g = menu(); toRow(g, ITEMS.indexOf("RECORDS")); press(g, "Enter"); press(g, "ArrowRight");
  check("STATS: no copy note before any C", toastOf(g.app.toast) === null, JSON.stringify(g.app.toast));
  press(g, "KeyC"); await flush(); g.tick();
  check("STATS C shows COPIED", g.app.screen === SCREEN.STATS && toastOf(g.app.toast) && g.app.toast.s === "COPIED" && g.app.toast.ok === true,
    JSON.stringify(g.app.toast));
  const t1 = g.app.toast.t; g.tick(30);
  check("STATS C note ages on STATS", g.app.toast.t > 0 && g.app.toast.t < t1 - 0.4, t1 + " -> " + g.app.toast.t);
  g.tick(Math.ceil(TOAST_T * 60) + 2);
  check("STATS C note clears after ~" + TOAST_T + " s", toastOf(g.app.toast) === null, JSON.stringify(g.app.toast));
  clipMode = "no";
  press(g, "KeyC"); await flush(); g.tick();
  check("STATS C with a refusing clipboard says COPY FAILED, never COPIED",
    toastOf(g.app.toast) && g.app.toast.s === "COPY FAILED" && g.app.toast.ok === false, JSON.stringify(g.app.toast));
  clipMode = "ok";
  delete navigator.clipboard;
  press(g, "KeyC"); await flush(); g.tick();
  check("STATS C with no clipboard API says COPY FAILED", toastOf(g.app.toast) && g.app.toast.s === "COPY FAILED", JSON.stringify(g.app.toast));
  navigator.clipboard = clipStub;
  g.tick(Math.ceil(TOAST_T * 60) + 2);
  press(g, "KeyR"); const arm = g.app.resetArm;
  press(g, "KeyC"); await flush(); g.tick();
  check("STATS armed R then C: disarms, copies, shows COPIED, reloads nothing",
    arm === true && g.app.resetArm === false && g.app.toast.s === "COPIED" && toastOf(g.app.toast) && reloads === 1, g.app.resetArm + "/" + reloads);
  press(g, "Escape");
  check("STATS C note is dropped the moment STATS closes", g.app.screen === SCREEN.MENU && toastOf(g.app.toast) === null, JSON.stringify(g.app.toast));
  press(g, "KeyC"); await flush(); g.tick();
  check("MENU C copies nothing and raises no note", toastOf(g.app.toast) === null, JSON.stringify(g.app.toast));
  press(g, "Enter"); press(g, "ArrowRight"); press(g, "KeyC"); await flush(); press(g, "Escape"); // MENU's cursor came back on RECORDS
  while (g.app.cursor !== ITEMS.indexOf("PLAY")) press(g, "ArrowUp"); press(g, "Enter");
  check("a STATS note never leaks onto a run", g.app.screen === SCREEN.GAME && g.ro.toast === null, g.app.screen + "/" + JSON.stringify(g.ro.toast));
}
// STATS label taps (T1) ride the keyboard's own path: a tap on the painted COPY MY STATS label IS KeyC — copy plus the same note. 600x520
// buffer under a 300x260 CSS box (k=2). v202 Task 4.2: the targets are the RECORDS page's own (pages/records.js): the painted foot's COPY MY
// STATS (C) and RESET (R) zones, the MEDALS tab, and armed, the confirm plate's COPY (C) and AGAIN ERASES (R) keys; the pane is inert.
{
  const PL = {};
  const ctx = new Proxy(function () {}, { get: (t, p) => (p === Symbol.toPrimitive ? () => "" : () => ctx), apply: () => ctx, set: () => true });
  const el = { width: 600, height: 520, style: {}, getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 260 }),
    addEventListener: (ty, fn) => { (PL[ty] = PL[ty] || []).push(fn); }, removeEventListener: noop };
  const g = menu(el);
  const G0 = RECP.recordsGeom({ W: 600, H: 520, touch: false, shell: false, css: 1 }), u = G0.u, ctr = (r) => [(r.x + r.w / 2) * u, (r.y + r.h / 2) * u];
  const zone = (key) => { g.tick(); const S = RECP._dbg.last.S, fp = S.feet.find((q) => q.v === S.fv).fp, z = fp.zones.find((q) => q.key === key); return [((z.x0 + z.x1) / 2) * u, fp.mid * u]; };
  const tap = (x, y) => { g.tick(); (PL.pointerdown || []).forEach((f) => f({ clientX: x / 2, clientY: y / 2 })); g.tick();
    (PL.pointerup || []).forEach((f) => f({ clientX: x / 2, clientY: y / 2 })); g.tick(); };
  const toStats = () => { while (g.app.screen !== SCREEN.MENU) press(g, "Escape"); g.app.cursor = ITEMS.indexOf("RECORDS"); press(g, "Enter"); press(g, "ArrowRight"); press(g, "ArrowDown"); };
  toStats();
  const C = zone("KeyC"), R = zone("KeyR"), CA = ctr(G0.d.confirm.copy), AG = ctr(G0.d.confirm.again), PANE = ctr(G0.d.pane);
  const c0 = clip.length, r0 = reloads;
  tap(...C); await flush(); g.tick();
  check("STATS tap on COPY MY STATS copies the stats text", g.app.screen === SCREEN.STATS && clip.length === c0 + 1 && /FUSEGRID STATS/.test(clip[clip.length - 1]),
    g.app.screen + "/" + clip[clip.length - 1]);
  check("STATS tap on COPY MY STATS shows COPIED", toastOf(g.app.toast) && g.app.toast.s === "COPIED" && g.app.toast.ok === true, JSON.stringify(g.app.toast));
  clipMode = "no";
  tap(...C); await flush(); g.tick();
  check("STATS tap on COPY with a refusing clipboard says COPY FAILED", toastOf(g.app.toast) && g.app.toast.s === "COPY FAILED" && g.app.toast.ok === false,
    JSON.stringify(g.app.toast));
  clipMode = "ok";
  g.tick(Math.ceil(TOAST_T * 60) + 2);
  tap(...R); const arm = g.app.resetArm, c1 = clip.length;
  tap(...C); await flush(); g.tick();
  check("STATS armed, a tap where COPY MY STATS was is no key of the confirm plate: disarms, copies nothing, no note, stays on STATS",
    arm === true && g.app.resetArm === false && clip.length === c1 && toastOf(g.app.toast) === null && g.app.screen === SCREEN.STATS && reloads === r0,
    arm + "/" + g.app.resetArm + "/" + JSON.stringify(g.app.toast));
  tap(...R); press(g, "KeyC"); await flush(); g.tick();
  check("STATS armed by a tap, then keyboard C: disarms and shows COPIED", g.app.resetArm === false && g.app.toast.s === "COPIED" && toastOf(g.app.toast) && reloads === r0,
    g.app.resetArm + "/" + JSON.stringify(g.app.toast));
  tap(...ctr(G0.d.tabs[2]));
  check("STATS tap on the MEDALS tab opens MEDALS", g.app.screen === SCREEN.TROPHIES, g.app.screen);
  toStats(); g.tick(Math.ceil(TOAST_T * 60) + 2);
  const c2 = clip.length;
  tap(...PANE);
  check("STATS idle tap on the pane is inert", g.app.screen === SCREEN.STATS && clip.length === c2, g.app.screen);
  tap(2, 2);
  check("STATS idle tap off the plate backs out to MENU, copies nothing", g.app.screen === SCREEN.MENU && clip.length === c2 && toastOf(g.app.toast) === null,
    g.app.screen + "/" + clip.length);
  toStats(); g.tick(Math.ceil(TOAST_T * 60) + 2);
  const c3 = clip.length, ev = { clientX: C[0] / 2, clientY: C[1] / 2, pointerType: "touch" };
  (PL.pointerdown || []).forEach((f) => f(ev)); g.tick(); await flush();
  const downCopied = clip.length - c3;
  (PL.pointerup || []).forEach((f) => f(ev)); await flush(); g.tick();
  check("STATS touch tap on COPY copies on pointerup (a touch pointerdown carries no clipboard activation), not on pointerdown",
    downCopied === 0 && clip.length === c3 + 1 && g.app.toast.s === "COPIED" && toastOf(g.app.toast) && g.app.screen === SCREEN.STATS,
    downCopied + "/" + (clip.length - c3) + "/" + JSON.stringify(g.app.toast));
  const c4 = clip.length;
  (PL.pointerup || []).forEach((f) => f(ev)); await flush(); g.tick();
  check("STATS a stray touch pointerup with no C pointerdown copies nothing", clip.length === c4, clip.length - c4);
  // armed, the confirm plate's COPY IS KeyC too
  const ca = { clientX: CA[0] / 2, clientY: CA[1] / 2 }, ct = { ...ca, pointerType: "touch" };
  for (const [how, armIt] of [["by key", () => press(g, "KeyR")], ["by tap", () => tap(...R)]]) {
    g.tick(Math.ceil(TOAST_T * 60) + 2); armIt(); g.tick();
    const a0 = g.app.resetArm, c5 = clip.length, r5 = reloads;
    (PL.pointerdown || []).forEach((f) => f(ct)); g.tick(); await flush();
    const dn = [clip.length - c5, g.app.resetArm, toastOf(g.app.toast)];
    (PL.pointerup || []).forEach((f) => f(ct)); await flush(); g.tick();
    check(`STATS armed ${how}, touch tap on COPY: nothing copied on pointerdown (but disarmed at once), then pointerup copies + COPIED, no reload`,
      a0 === true && dn[0] === 0 && dn[1] === false && dn[2] === null && clip.length === c5 + 1 && /FUSEGRID STATS/.test(clip[clip.length - 1]) &&
        g.app.resetArm === false && toastOf(g.app.toast) && g.app.toast.s === "COPIED" && reloads === r5 && g.app.screen === SCREEN.STATS,
      JSON.stringify(dn) + "/" + g.app.resetArm + "/" + JSON.stringify(g.app.toast));
    g.tick(Math.ceil(TOAST_T * 60) + 2); armIt(); g.tick();
    const a1 = g.app.resetArm, c6 = clip.length;
    (PL.pointerdown || []).forEach((f) => f(ca)); g.tick(); await flush();
    const dn1 = clip.length - c6;
    (PL.pointerup || []).forEach((f) => f(ca)); await flush(); g.tick();
    check(`STATS armed ${how}, mouse tap on COPY copies on pointerdown (once), disarms, COPIED`,
      a1 === true && dn1 === 1 && clip.length === c6 + 1 && g.app.resetArm === false && g.app.toast.s === "COPIED" && toastOf(g.app.toast) && reloads === r5,
      dn1 + "/" + (clip.length - c6) + "/" + g.app.resetArm);
  }
  g.tick(Math.ceil(TOAST_T * 60) + 2); press(g, "KeyR"); clipMode = "no"; g.tick();
  (PL.pointerdown || []).forEach((f) => f(ct)); g.tick(); (PL.pointerup || []).forEach((f) => f(ct)); await flush(); g.tick();
  check("STATS armed, touch COPY with a refusing clipboard: disarms, says COPY FAILED, never COPIED",
    g.app.resetArm === false && toastOf(g.app.toast) && g.app.toast.s === "COPY FAILED" && g.app.toast.ok === false, JSON.stringify(g.app.toast));
  clipMode = "ok"; g.tick(Math.ceil(TOAST_T * 60) + 2);
  for (const end of ["pointercancel", "pointerleave"]) {
    g.tick(Math.ceil(TOAST_T * 60) + 2);
    const c8 = clip.length, rt = { clientX: R[0] / 2, clientY: R[1] / 2, pointerType: "touch" };
    (PL.pointerdown || []).forEach((f) => f(ev)); (PL[end] || []).forEach((f) => f(ev)); g.tick(); await flush();
    (PL.pointerup || []).forEach((f) => f(ev)); await flush(); g.tick();
    const bare = clip.length - c8;
    (PL.pointerdown || []).forEach((f) => f(ev)); (PL[end] || []).forEach((f) => f(ev));
    (PL.pointerdown || []).forEach((f) => f(rt)); (PL.pointerup || []).forEach((f) => f(rt)); await flush(); g.tick();
    check(`STATS touch C then ${end}: a later pointerup (bare, or a tap on RESET) copies nothing; R still arms`,
      bare === 0 && clip.length === c8 && toastOf(g.app.toast) === null && g.app.resetArm === true && g.app.screen === SCREEN.STATS,
      bare + "/" + (clip.length - c8) + "/" + g.app.resetArm + "/" + JSON.stringify(g.app.toast));
    tap(...PANE);
  }
  const r7 = reloads; tap(...R); tap(...AG);
  check("STATS armed, a tap on AGAIN ERASES still erases + reloads once", reloads === r7 + 1 && g.app.resetArm === false, reloads - r7);
}

// ---- RECORDS matrix (v202 Task 2.2, plan ruling R7): SCORES, STATS and MEDALS, tab row and body, every key through the real
// keydown listeners and main's cue wrappers. The tab row is the top of each page's ↑↓ walk; MEDALS has no body. A STATS row runs
// unarmed and armed (R pressed first): any other key disarms, R again wipes. Expected values come from R7 and the lead's rulings. ----
const recPlays = [];
const RECAUD = { play: (n) => recPlays.push(n), toggle: () => false, duck: noop, unlocked: () => true, pump: noop, unlock: () => true };
const SC = SCREEN.SCORES, ST = SCREEN.STATS, ME = SCREEN.TROPHIES, MN = SCREEN.MENU, UM = "uiMove", UB = "uiBack";
const want = (s, f, c, x) => ({ s, f, c: c || "", ...x });
const OUT = want(MN, null, UB);
{
  const recAt = (page, body, armed) => {
    const g = mk({ audio: RECAUD }); g.app.cabinetSeen = true; g.app.skip(); g.tick(2);
    toRow(g, ITEMS.indexOf("RECORDS")); press(g, "Enter");
    for (let i = 0; i < page; i++) press(g, "ArrowRight");
    if (body) press(g, "ArrowDown");
    g.app.scoreHeat = 1;
    if (armed) press(g, "KeyR");
    recPlays.length = 0;
    return g;
  };
  const K = {
    "SCORES tab row": [0, 0, { ArrowLeft: want(SC, 0, "", { h: 1 }), ArrowRight: want(ST, 0, UM), ArrowUp: want(SC, 0, "", { h: 1 }), ArrowDown: want(SC, 1, UM, { h: 1 }), KeyQ: want(SC, 0), KeyE: want(ST, 0, UM), KeyT: want(SC, 0), KeyC: want(SC, 0), KeyR: want(SC, 0) }],
    "SCORES body": [0, 1, { ArrowLeft: want(SC, 1, UM, { h: 0 }), ArrowRight: want(SC, 1, UM, { h: 2 }), ArrowUp: want(SC, 0, UM, { h: 1 }), ArrowDown: want(SC, 1, "", { h: 1 }), KeyQ: want(SC, 1, "", { h: 1 }), KeyE: want(ST, 0, UM), KeyT: want(SC, 1), KeyC: want(SC, 1), KeyR: want(SC, 1) }],
    "STATS tab row": [1, 0, { ArrowLeft: want(SC, 0, UM), ArrowRight: want(ME, 0, UM), ArrowUp: want(ST, 0), ArrowDown: want(ST, 1, UM), KeyQ: want(SC, 0, UM), KeyE: want(ME, 0, UM), KeyT: want(ME, 0, UM), KeyC: want(ST, 0), KeyR: want(ST, 0) }],
    "STATS body": [1, 1, { ArrowLeft: want(ST, 1), ArrowRight: want(ST, 1), ArrowUp: want(ST, 0, UM), ArrowDown: want(ST, 1), KeyQ: want(SC, 0, UM), KeyE: want(ME, 0, UM), KeyT: want(ME, 0, UM), KeyC: want(ST, 1), KeyR: want(ST, 1) }],
    "MEDALS tab row": [2, 0, { ArrowLeft: want(ST, 0, UM), ArrowRight: want(ME, 0), ArrowUp: want(ME, 0), ArrowDown: want(ME, 0), KeyQ: want(ST, 0, UM), KeyE: want(ME, 0), KeyT: want(ME, 0), KeyC: want(ME, 0), KeyR: want(ME, 0) }],
  };
  for (const [name, [page, body, keys]] of Object.entries(K)) for (const armed of page === 1 ? [false, true] : [false]) {
    for (const [code, w] of Object.entries({ ...keys, Enter: OUT, Escape: armed ? want(ST, body, UB) : OUT, Backspace: armed ? want(ST, body, UB) : OUT })) { // armed, Esc / Backspace close first (R1 cohesion ruling)
      const g = recAt(page, body, armed), c0 = clip.length, r0 = reloads;
      press(g, code); await flush(); g.tick();
      const a = g.app, copy = clip.length - c0, wipe = reloads - r0;
      const arm = page === 1 && code === "KeyR" && !armed, wiped = armed && code === "KeyR" ? 1 : 0, copied = page === 1 && code === "KeyC" ? 1 : 0;
      const ok = a.screen === w.s && (w.s === MN ? a.cursor === ITEMS.indexOf("RECORDS") : a.recFocus === w.f) && (w.h == null || a.scoreHeat === w.h) && recPlays.join() === w.c && a.resetArm === arm && wipe === wiped && copy === copied;
      check("RECORDS keys: " + name + (armed ? " (armed)" : "") + " + " + code + " -> " + (w.s === MN ? "MENU on RECORDS" : ["SCORES", "STATS", "MEDALS"][[SC, ST, ME].indexOf(w.s)] + (w.f ? " body" : " tab row")) + (w.h != null ? " difficulty " + w.h : "") + ", cues [" + w.c + "]" + (arm ? ", armed" : "") + (wiped ? ", wiped once" : "") + (copied ? ", copied" : ""),
        ok, JSON.stringify([a.screen, a.cursor, a.recFocus, a.scoreHeat, recPlays, a.resetArm, wipe, copy]));
    }
  }
  /* the RECORDS row itself: one uiSel, SCORES on the tab row; Q / E on MENU are nothing */
  const g = mk({ audio: RECAUD }); g.app.cabinetSeen = true; g.app.skip(); g.tick(2);
  toRow(g, ITEMS.indexOf("RECORDS")); recPlays.length = 0;
  press(g, "KeyQ"); press(g, "KeyE");
  check("RECORDS keys: Q / E on MENU do nothing", g.app.screen === MN && g.app.cursor === ITEMS.indexOf("RECORDS") && recPlays.length === 0, recPlays.join());
  press(g, "Enter");
  check("RECORDS keys: MENU Enter on RECORDS opens SCORES on the tab row with one uiSel", g.app.screen === SC && g.app.recFocus === 0 && recPlays.join() === "uiSel", recPlays.join());
  down("ArrowRight"); g.tick(Math.ceil(0.4 * 60)); const mid = g.app.screen; g.tick(60); up("ArrowRight"); g.tick(2);
  check("RECORDS keys: → held on the tab row repeats at the menu rate and stops silently at MEDALS", mid === ME && g.app.screen === ME && recPlays.filter((n) => n === UM).length === 2, mid + "/" + recPlays.join());
}

// ---- RECORDS, fix round 1: one press, one action. A key that is both a tab shortcut (Q / E) and the confirm alias (BOMB rebound
// to it) only steps the tab on the three RECORDS pages; elsewhere it still confirms. ----
{
  mem["nb.controls.v1"] = JSON.stringify({ v: 1, key: { BOMB: "KeyE", THROW: "Space", REMOTE: "KeyQ", PAUSE: "KeyP", MOVE: ["KeyW", "KeyD", "KeyS", "KeyA"] }, pad: { BOMB: "S", THROW: "W", REMOTE: "E", PAUSE: "SELECT" }, stick: "L", dead: 25, vib: 2 });
  const g = mk({ audio: RECAUD }); g.app.cabinetSeen = true; g.app.skip(); g.tick(2);
  toRow(g, ITEMS.indexOf("RECORDS")); recPlays.length = 0;
  press(g, "KeyE");
  check("BOMB bound to E: on MENU, E still confirms (RECORDS opens SCORES)", g.app.screen === SC && recPlays.join() === "uiSel", g.app.screen + "/" + recPlays.join());
  recPlays.length = 0; press(g, "KeyE");
  check("BOMB bound to E: on SCORES, E steps to STATS and does not back out", g.app.screen === ST && recPlays.join() === UM, g.app.screen + "/" + recPlays.join());
  recPlays.length = 0; press(g, "KeyE"); press(g, "KeyE");
  check("BOMB bound to E: E onto MEDALS, then E at the last tab: silent, still MEDALS, no back out", g.app.screen === ME && recPlays.join() === UM, g.app.screen + "/" + recPlays.join());
  recPlays.length = 0; press(g, "Space"); // THROW now: no confirm in a menu
  press(g, "Enter");
  check("BOMB bound to E: Enter still backs out of MEDALS to MENU on RECORDS", g.app.screen === MN && g.app.cursor === ITEMS.indexOf("RECORDS"), g.app.screen);
  delete mem["nb.controls.v1"];
}
// ---- STATS foot taps with RECORDS' tab row focused (fix round 1; v202 Task 4.2: the targets read from the RECORDS page's painted foot and
// its confirm plate). Mouse and touch, through the real pointer: COPY MY STATS copies (a touch on pointerup), RESET arms, AGAIN ERASES erases,
// the armed COPY disarms and copies. ----
{
  const PL = {};
  const ctx = new Proxy(function () {}, { get: (t, p) => (p === Symbol.toPrimitive ? () => "" : () => ctx), apply: () => ctx, set: () => true });
  const el = { width: 600, height: 520, style: {}, getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 260 }),
    addEventListener: (ty, fn) => { (PL[ty] = PL[ty] || []).push(fn); }, removeEventListener: noop };
  const g = menu(el);
  const fire = (ty, x, y, pointerType) => (PL[ty] || []).forEach((f) => f({ clientX: x / 2, clientY: y / 2, pointerType }));
  const tap = (x, y, pt) => { fire("pointerdown", x, y, pt); g.tick(); fire("pointerup", x, y, pt); g.tick(); };
  const toTabs = () => { while (g.app.screen !== SCREEN.MENU) press(g, "Escape"); g.app.cursor = ITEMS.indexOf("RECORDS"); press(g, "Enter"); press(g, "ArrowRight"); g.tick(Math.ceil(TOAST_T * 60) + 2); };
  const G0 = RECP.recordsGeom({ W: 600, H: 520, touch: false, shell: false, css: 1 }), u = G0.u, ctr = (r) => [(r.x + r.w / 2) * u, (r.y + r.h / 2) * u];
  const zone = (key) => { g.tick(); const S = RECP._dbg.last.S, fp = S.feet.find((q) => q.v === S.fv).fp, z = fp.zones.find((q) => q.key === key); return [((z.x0 + z.x1) / 2) * u, fp.mid * u]; };
  for (const pt of ["mouse", "touch"]) {
    toTabs();
    const [cx, cy] = zone("KeyC"), [rx, ry] = zone("KeyR"), [ax, ay] = ctr(G0.d.confirm.again), [kx, ky] = ctr(G0.d.confirm.copy);
    const c0 = clip.length, r0 = reloads;
    fire("pointerdown", cx, cy, pt); g.tick(); await flush();
    const dn = clip.length - c0;
    fire("pointerup", cx, cy, pt); await flush(); g.tick();
    check("STATS tab row, " + pt + " tap on C COPY MY STATS: copies once (" + (pt === "touch" ? "on pointerup" : "on pointerdown") + "), COPIED, still the tab row",
      g.app.screen === SCREEN.STATS && g.app.recFocus === 0 && dn === (pt === "touch" ? 0 : 1) && clip.length === c0 + 1 && g.app.toast.s === "COPIED" && reloads === r0, dn + "/" + (clip.length - c0) + "/" + g.app.recFocus);
    g.tick(Math.ceil(TOAST_T * 60) + 2);
    tap(rx, ry, pt);
    check("STATS tab row, " + pt + " tap on R RESET arms, clears nothing", g.app.resetArm === true && reloads === r0 && g.app.recFocus === 0, g.app.resetArm + "/" + reloads);
    const c1 = clip.length;
    fire("pointerdown", kx, ky, pt); g.tick(); await flush(); fire("pointerup", kx, ky, pt); await flush(); g.tick();
    check("STATS tab row, " + pt + " tap on the armed C COPY: disarms, copies once, erases nothing", g.app.resetArm === false && clip.length === c1 + 1 && reloads === r0, g.app.resetArm + "/" + (clip.length - c1));
    tap(rx, ry, pt); tap(ax, ay, pt);
    check("STATS tab row, " + pt + ": RESET then AGAIN ERASES erases and reloads once", reloads === r0 + 1 && g.app.resetArm === false, reloads - r0);
  }
}

// ---- GAME / PLAY ----
{
  const g = run();
  const axis = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1],
    KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  for (const [code, [x, y]] of Object.entries(axis)) {
    down(code); const it = g.input.intent(); up(code);
    check("PLAY " + code + " moves (" + x + "," + y + ")", it.move.x === x && it.move.y === y, it.move.x + "," + it.move.y);
  }
  const p = g.world.players[0], x0 = p.x, y0 = p.y;
  down("KeyD"); g.tick(20); up("KeyD"); down("KeyS"); g.tick(20); up("KeyS"); g.tick();
  check("PLAY D then S walk the player off the spawn tile", p.x > x0 && p.y > y0, x0 + "," + y0 + " -> " + p.x + "," + p.y);
  for (const [code, f] of [["ShiftLeft", "shift"], ["ShiftRight", "shift"], ["KeyQ", "remote"]]) {
    down(code); const on = g.input._intent[f]; up(code);
    check("PLAY " + code + " holds " + f + " and releases it", on === true && g.input._intent[f] === false);
  }
  press(g, "Enter"); press(g, "NumpadEnter");
  check("PLAY Enter plants nothing and does not pause", live(g.world) === 0 && g.world.state === "PLAY", live(g.world) + "/" + g.world.state);
  press(g, "KeyM");
  check("PLAY M does nothing (M quits only from PAUSE)", g.app.screen === SCREEN.GAME && g.world.state === "PLAY");
  g.cam.zoom = 2; g.cam.x = 40; g.rig.dist = 1600;
  press(g, "KeyR");
  check("PLAY R resets the camera and the 3D dolly", g.cam.zoom === 1 && g.cam.x === 0 && g.rig.dist !== 1600, JSON.stringify(g.cam) + "/" + g.rig.dist);
}
for (const code of ["Space", "KeyJ", "KeyX"]) {
  const g = run();
  press(g, code);
  check("PLAY " + code + " plants one bomb", live(g.world) === 1, live(g.world));
}
{
  const g = run(), p = g.world.players[0];
  p.throw = true; p.face = { x: 1, y: 0 };
  down("ShiftLeft"); press(g, "Space"); up("ShiftLeft");
  const b = g.world.bombs[0];
  check("PLAY Shift + Space throws ahead (throw power)", !!b && Math.abs(b.x - p.x) > 20, b && b.x - p.x);
  const r = run(), q = r.world.players[0];
  q.remote = true; press(r, "Space"); const n = live(r.world); press(r, "KeyQ");
  check("PLAY Q detonates live bombs (remote power)", n === 1 && live(r.world) === 0, n + "->" + live(r.world));
}
{
  const g = run(), p = g.world.players[0];
  p.throw = true; p.face = { x: 1, y: 0 };
  g.input.pulseThrow(); g.tick(3);
  const b = g.world.bombs.filter((x) => !x.dead);
  check("PLAY touch THROW tap (Input.pulseThrow) throws ahead exactly once, through the real loop",
    b.length === 1 && Math.abs(b[0].x - p.x) > 20 && !g.input._intent.fire && !g.input._intent.shift, b.length + "/" + (b[0] && b[0].x - p.x));
  g.tick(30);
  check("PLAY touch THROW never latches: no second bomb on later ticks", live(g.world) === 1, live(g.world));
  const r = run(), q = r.world.players[0];
  r.input.pulseThrow(); r.tick(3);
  check("PLAY touch THROW without the power plants in place (the sim's Shift+Space rule)",
    live(r.world) === 1 && Math.abs(r.world.bombs[0].x - q.x) < 1, live(r.world));
  const d = run(), dq = d.world.players[0];
  dq.remote = true; press(d, "Space"); const n = live(d.world);
  d.input.pulseRemote(); d.tick(2);
  check("PLAY touch REMOTE tap (Input.pulseRemote) detonates live bombs and clears its intent",
    n === 1 && live(d.world) === 0 && !d.input._intent.remote, n + "->" + live(d.world));
  press(d, "Space"); d.input.pulseRemote(); d.tick(2);
  check("PLAY a second touch REMOTE tap is a fresh edge", live(d.world) === 0, live(d.world));
}
for (const code of ["KeyP", "Escape"]) {
  const g = run();
  press(g, code);
  check("PLAY " + code + " pauses", g.world.state === "PAUSE", g.world.state);
  press(g, code);
  check("PAUSE " + code + " resumes", g.world.state === "PLAY", g.world.state);
}

// ---- PAUSE ----
{
  const g = run(); press(g, "KeyP");
  press(g, "ArrowDown"); const c1 = g.app.pauseCursor; press(g, "ArrowUp"); press(g, "KeyW");
  check("PAUSE ↓ / ↑ / W move the list cursor and wrap", c1 === PAUSE_ITEMS.indexOf("SETTINGS") && g.app.pauseCursor === PAUSE_ITEMS.length - 1, c1 + "," + g.app.pauseCursor);
}
for (const code of ["Enter", "Space"]) {
  const g = run(); press(g, "KeyP");
  press(g, code); g.tick(30);
  check("PAUSE " + code + " on RESUME -> PLAY, nothing planted, fire not latched",
    g.world.state === "PLAY" && live(g.world) === 0 && g.input._intent.fire === false, g.world.state + "/" + live(g.world));
}
for (const [LK, blob] of LOOKS) withSettings(blob, () => {
  const g = run(); g.world.score = 77; press(g, "KeyP"); toRow(g, PAUSE_ITEMS.indexOf("RESTART")); press(g, "Enter"); g.tick(10);
  check("PAUSE Enter on RESTART -> room 1, score 0, PLAY, nothing planted (" + LK + ")",
    g.world.state === "PLAY" && g.world.level === 1 && g.world.score === 0 && live(g.world) === 0);
  const o = run(); press(o, "KeyP"); toRow(o, PAUSE_ITEMS.indexOf("SETTINGS")); const s0 = JSON.stringify(o.app.settings); press(o, "Enter");
  check("PAUSE Enter on OPTIONS opens the inline page and changes no knob (" + LK + ": " + o.app.optRows().length + " rows)",
    o.app.pauseView === 1 && o.world.state === "PAUSE" && JSON.stringify(o.app.settings) === s0 && o.app.optRows().length === (blob ? 12 : 10), o.app.pauseView);
  press(o, "ArrowDown"); const r = o.app.optLabel(); press(o, "Escape");
  check("PAUSE OPTIONS ↓ moves the row; Escape backs to the list on SETTINGS, still paused (" + LK + ")",
    r === "SFX" && o.app.pauseView === 0 && o.app.pauseCursor === PAUSE_ITEMS.indexOf("SETTINGS") && o.world.state === "PAUSE", r + "/" + o.app.pauseView);
  press(o, "KeyP");
  check("PAUSE P from the list resumes (" + LK + ")", o.world.state === "PLAY");
  const q = run(); press(q, "KeyP"); toRow(q, PAUSE_ITEMS.indexOf("QUIT TO MENU")); press(q, "Enter");
  check("PAUSE Enter on QUIT TO MENU -> MENU (" + LK + ")", q.app.screen === SCREEN.MENU, q.app.screen);
});
{
  const m = run(); press(m, "KeyP"); press(m, "KeyM");
  check("PAUSE M -> MENU", m.app.screen === SCREEN.MENU, m.app.screen);
}

// ---- WIN (mid room): Space / Enter advance; C / B copy with on-screen feedback ----
for (const code of ["Space", "Enter", "NumpadEnter"]) {
  const g = run(); clearRoom(g);
  const won = g.world.state === "WIN";
  press(g, code); g.tick(30);
  check("WIN " + code + " -> next room, nothing planted, fire not latched",
    won && g.world.state === "PLAY" && g.world.level === 2 && live(g.world) === 0 && g.input._intent.fire === false,
    won + "/" + g.world.state + "/" + g.world.level + "/" + live(g.world));
}
{
  const g = run(); clearRoom(g);
  down("Enter", true); g.tick(3); up("Enter"); g.tick(2);
  check("WIN Enter auto-repeat is ignored (one logical press per physical press)", g.world.state === "WIN");
  down("Enter"); g.tick(40); up("Enter"); g.tick(5);
  check("WIN Enter held 40 frames advances once and plants nothing",
    g.world.level === 2 && g.world.state === "PLAY" && live(g.world) === 0, g.world.level + "/" + live(g.world));
}
{
  const g = run(); clearRoom(g);
  const c0 = clip.length;
  press(g, "KeyC"); await flush(); g.tick();
  check("WIN C copies the result line", clip.length === c0 + 1 && clip[clip.length - 1] === copyPayload(g.world), clip[clip.length - 1]);
  check("WIN C shows COPIED on the overlay", !!g.ro.toast && g.ro.toast.s === "COPIED" && g.ro.toast.ok === true, JSON.stringify(g.ro.toast));
  press(g, "KeyB"); await flush(); g.tick();
  check("WIN B copies the board link (an ordinary run is gen 3: F3)", /^https:\/\/hmarzban\.github\.io\/fusegrid\/\?code=F3/.test(clip[clip.length - 1]), clip[clip.length - 1]);
  check("WIN B shows BOARD LINK COPIED", !!g.ro.toast && g.ro.toast.s === "BOARD LINK COPIED", JSON.stringify(g.ro.toast));
  g.tick(Math.ceil(TOAST_T * 60) + 2);
  check("the copy note clears after ~" + TOAST_T + " s", g.ro.toast === null, JSON.stringify(g.ro.toast));
  clipMode = "no";
  press(g, "KeyC"); await flush(); g.tick();
  check("WIN C with a refusing clipboard says COPY FAILED, never COPIED",
    !!g.ro.toast && g.ro.toast.s === "COPY FAILED" && g.ro.toast.ok === false, JSON.stringify(g.ro.toast));
  clipMode = "ok";
  delete navigator.clipboard;
  press(g, "KeyB"); await flush(); g.tick();
  check("WIN B with no clipboard API says COPY FAILED", !!g.ro.toast && g.ro.toast.s === "COPY FAILED", JSON.stringify(g.ro.toast));
  navigator.clipboard = clipStub;
  press(g, "KeyC"); await flush(); press(g, "Space");
  check("the copy note is dropped the moment the overlay closes", g.world.state === "PLAY" && g.ro.toast === null, JSON.stringify(g.ro.toast));
}
{
  const g = menu(); toRow(g, 1); press(g, "Enter");
  for (let i = 0; i < 4; i++) press(g, "ArrowRight");
  press(g, "Enter"); clearRoom(g);
  const won = g.world.state === "WIN" && g.world.level === 5;
  press(g, "Enter"); g.tick(5);
  check("finale WIN (room 5) Enter -> MENU and unlocks Pact", won && g.app.screen === SCREEN.MENU && g.app.pactUnlocked === true,
    won + "/" + g.app.screen);
}

// ---- LOSE: Space / Enter retry; C / B copy with feedback ----
for (const code of ["Space", "Enter"]) {
  const g = run(); g.tick(5);
  g.world.state = "LOSE"; g.tick(3);
  press(g, code); g.tick(30);
  check("LOSE " + code + " -> a new run at room 1, nothing planted",
    g.world.state === "PLAY" && g.world.level === 1 && live(g.world) === 0 && g.input._intent.fire === false, g.world.state + "/" + live(g.world));
}
{
  const g = run(); g.tick(5); g.world.state = "LOSE"; g.tick(3);
  press(g, "KeyC"); await flush(); g.tick();
  check("LOSE C copies and shows COPIED", clip[clip.length - 1] === copyPayload(g.world) && g.ro.toast && g.ro.toast.s === "COPIED", JSON.stringify(g.ro.toast));
  press(g, "KeyB"); await flush(); g.tick();
  check("LOSE B copies the board link and says so", /\?code=F3/.test(clip[clip.length - 1]) && g.ro.toast && g.ro.toast.s === "BOARD LINK COPIED", JSON.stringify(g.ro.toast));
  press(g, "KeyP");
  check("LOSE P does not pause a finished run", g.world.state === "LOSE", g.world.state);
}
// ---- run ends, R19 (v202 Task 5.2): Esc (and Backspace never) goes to MENU at a run end; a mid-run WIN keeps it inert ----
{
  const g = run(); g.tick(5); g.world.state = "LOSE"; g.tick(3);
  const seed = g.world.seed;
  press(g, "Escape"); g.tick(5);
  check("LOSE Esc -> MENU, the run's world left in MENU (no GAME OVER behind the menu), nothing planted", g.app.screen === SCREEN.MENU && g.world.state === "MENU" && g.world.seed === seed && live(g.world) === 0, g.app.screen + "/" + g.world.state);
  press(g, "Enter");
  check("after LOSE Esc, MENU's Enter starts a fresh run at room 1", g.app.screen === SCREEN.GAME && g.world.state === "PLAY" && g.world.level === 1, g.app.screen + "/" + g.world.state);
}
{
  const g = run(); g.tick(5); g.world.state = "LOSE"; g.tick(3);
  press(g, "Backspace"); g.tick(3);
  check("LOSE Backspace is not Esc: the run end stays", g.app.screen === SCREEN.GAME && g.world.state === "LOSE", g.app.screen + "/" + g.world.state);
}
{
  const g = run(); clearRoom(g);
  const won = g.world.state === "WIN" && g.world.level === 1;
  press(g, "Escape"); g.tick(5);
  check("mid-run WIN Esc: nothing (no run end, no MENU)", won && g.app.screen === SCREEN.GAME && g.world.state === "WIN", g.app.screen + "/" + g.world.state);
}
{
  const g = menu(); toRow(g, 1); press(g, "Enter");
  for (let i = 0; i < 4; i++) press(g, "ArrowRight");
  press(g, "Enter"); clearRoom(g);
  const won = g.world.state === "WIN" && g.world.level === 5;
  press(g, "Escape"); g.tick(5);
  check("finale WIN Esc -> MENU through the sim's own edge: Pact unlocked, the score saved", won && g.app.screen === SCREEN.MENU && g.app.pactUnlocked === true && "nb.highscores.v1" in mem, won + "/" + g.app.screen);
}

// ---- run ends: Space on the finale, and taps (v202 Tasks 5.2-5.4, brief: Enter, Space, SOUTH, START, tap, Esc) ----
{
  const g = menu(); toRow(g, 1); press(g, "Enter");
  for (let i = 0; i < 4; i++) press(g, "ArrowRight");
  press(g, "Enter"); clearRoom(g);
  const won = g.world.state === "WIN" && g.world.level === 5;
  press(g, "Space"); g.tick(5);
  check("finale WIN Space -> MENU (the same fire edge as Enter)", won && g.app.screen === SCREEN.MENU, won + "/" + g.app.screen);
}
{
  lazyPages._set("endwin", endWin); lazyPages._set("endlose", endLose);
  const mkTapEl = () => { let font = "10px sans-serif"; const PL = {}, ctx = new Proxy(function () {}, { get: (t, p) => (p === Symbol.toPrimitive ? () => "" : p === "font" ? font : p === "measureText" ? (s) => ({ width: String(s).length * 0.6 * (+(/(\d+(?:\.\d+)?)px/.exec(font) || [0, 10])[1]) }) : () => ctx), apply: () => ctx, set: (t, p, v) => { if (p === "font") font = v; return true; } });
    const el = { width: 600, height: 520, style: {}, getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 520 }), addEventListener: (ty, fn) => { (PL[ty] = PL[ty] || []).push(fn); }, removeEventListener: noop };
    return { el, tap: (g, x, y) => { (PL.pointerdown || []).forEach((f) => f({ clientX: x, clientY: y, button: 0, pointerType: "mouse" })); g.tick(); (PL.pointerup || []).forEach((f) => f({ clientX: x, clientY: y, button: 0, pointerType: "mouse" })); g.tick(3); } }; };
  const keyAt = (g, n) => { const G = endGeom(overlayBox("2d"), endFacts(g.world, g.ro.run, g.ro.time), { lay: g.ro.run.lay, css: g.ro.run.css, page: g.ro.run.page }), r = G && G.keys[n]; return r ? [r.x + r.w / 2, r.y + r.h / 2] : null; };
  { const A = mkTapEl(), g = menu(A.el); press(g, "Enter"); g.tick(5); g.world.state = "LOSE"; g.tick(100);
    const m = keyAt(g, "main"); A.tap(g, ...m); g.tick(10);
    check("LOSE tap on TRY AGAIN -> a new run at level 1", g.world.state === "PLAY" && g.world.level === 1, g.world.state); }
  { const A = mkTapEl(), g = menu(A.el); press(g, "Enter"); g.tick(5); g.world.state = "LOSE"; g.tick(100);
    A.tap(g, ...keyAt(g, "menu")); g.tick(5);
    check("LOSE tap on MENU -> MENU", g.app.screen === SCREEN.MENU && g.world.state === "MENU", g.app.screen + "/" + g.world.state); }
  { const A = mkTapEl(), g = menu(A.el); toRow(g, 1); press(g, "Enter"); for (let i = 0; i < 4; i++) press(g, "ArrowRight"); press(g, "Enter"); clearRoom(g); g.tick(100);
    const won = g.world.state === "WIN" && g.world.level === 5;
    A.tap(g, ...keyAt(g, "main")); g.tick(5);
    check("finale tap on MENU (its main key) -> MENU", won && g.app.screen === SCREEN.MENU, won + "/" + g.app.screen); }
  { const A = mkTapEl(), g = menu(A.el); press(g, "Enter"); clearRoom(g); g.tick(100);
    for (const [x, y] of [[300, 40], [20, 500]]) A.tap(g, x, y);
    const off = g.world.state === "WIN" && g.app.screen === SCREEN.GAME;
    A.tap(g, ...keyAt(g, "main")); g.tick(10);
    check("mid-run WIN: a tap off its key is inert, a tap on NEXT LEVEL goes on (never MENU)", off && g.app.screen === SCREEN.GAME && g.world.state === "PLAY" && g.world.level === 2, off + "/" + g.world.state + "/" + g.world.level); }
}

// ---- seam units: copyText / toastTick ----
{
  const t = createToast();
  copyText("x", t, "COPIED"); await flush();
  check("copyText: resolves -> the ok message for TOAST_T", t.s === "COPIED" && t.ok && t.t === TOAST_T, JSON.stringify(t));
  toastTick(t, { state: "WIN" }, 1);
  check("toastTick ages the note while the overlay is up", toastOf(t) && Math.abs(t.t - (TOAST_T - 1)) < 1e-9);
  toastTick(t, { state: "PLAY" }, 0);
  check("toastTick drops the note outside WIN / LOSE", toastOf(t) === null);
  const at = (screen, state, t0) => { const n = { s: "COPIED", ok: true, t: t0 }; toastTick(n, { state }, 0.5, { screen }); return n.t; };
  check("toastTick with the shell: STATS ages the note whatever the frozen world says",
    at(SCREEN.STATS, "PLAY", 1.5) === 1 && at(SCREEN.STATS, "WIN", 1.5) === 1);
  check("toastTick with the shell: GAME ages it only on WIN / LOSE",
    at(SCREEN.GAME, "WIN", 1.5) === 1 && at(SCREEN.GAME, "LOSE", 1.5) === 1 && at(SCREEN.GAME, "PLAY", 1.5) === 0 && at(SCREEN.GAME, "PAUSE", 1.5) === 0);
  check("toastTick with the shell: every other screen drops it",
    [SCREEN.MENU, SCREEN.TROPHIES, SCREEN.ATTRACT, SCREEN.INTRO, SCREEN.SETTINGS].every((s) => at(s, "WIN", 1.5) === 0));
  const s = createToast();
  navigator.clipboard = { writeText: () => { throw new Error("sync"); } };
  copyText("x", s, "COPIED");
  check("copyText: a synchronous throw says COPY FAILED", s.s === "COPY FAILED" && s.ok === false, JSON.stringify(s));
  copyText("x", null, "COPIED");
  check("copyText: a null note copies without a toast and never throws", true);
  navigator.clipboard = clipStub;
}

// ---- overlay: cue copy, toast placement and fit ----
{
  const rec = () => { const rows = [];
    const c = { fillRect: noop, strokeText: noop, beginPath: noop, moveTo: noop, lineTo: noop, arcTo: noop, quadraticCurveTo: noop, closePath: noop, fill: noop, stroke: noop, fillText: (s, x, y) => rows.push([String(s), y, c.fillStyle]) }; // path ops: the pause plate is a rounded rect
    return { c, rows }; };
  for (const B of [overlayBox("2d"), overlayBox("iso")]) {
    const tag = B.w + "x" + B.h;
    /* v202 Tasks 5.2-5.4: the run ends name their keys on the page (endFacts().keys + endkit.capsOf), each inside the plate; was one cue line */
    lazyPages._set("endwin", endWin); lazyPages._set("endlose", endLose);
    for (const st of [{ state: "WIN", level: 3 }, { state: "WIN", level: 5 }, { state: "LOSE", level: 2 }]) {
      const R = krec(); kprobe.setOn(true);
      drawOverlay(R.ctx, { ...st, score: 1 }, B.w, B.h, B.cx, B.cy, { r: 1, k: 0, p: 0, t: 5, best: null });
      const S = kprobe.snapshot(); kprobe.setOn(false);
      const main = S.texts.find((t) => t.s === "ENTER");
      check("the " + st.state + " L" + st.level + " page names ENTER on its main key, inside the box " + tag, !!main && main.x >= 0 && main.x <= B.w && main.y >= 0 && main.y <= B.h, JSON.stringify(main));
    }
    for (const s of ["COPIED", "BOARD LINK COPIED", "COPY FAILED"]) {
      // v202 Task 5.3: the WIN page (lazy, handed in) drops the note as a brick tag at its plate's top, above the headline
      lazyPages._set("endwin", endWin);
      const R = krec(); kprobe.setOn(true);
      drawOverlay(R.ctx, { state: "WIN", level: 3, score: 1 }, B.w, B.h, B.cx, B.cy, undefined, undefined, undefined, { s, ok: s !== "COPY FAILED", t: 1 });
      const S = kprobe.snapshot(); kprobe.setOn(false);
      const row = S.texts.find((t) => t.s === s), hd = S.texts.find((t) => t.s === "LEVEL 3 CLEAR");
      check(tag + ": '" + s + "' is drawn above the headline, inside the box",
        !!row && !!hd && row.y + row.capH < hd.y && row.y > 24 && row.x >= 0 && row.x + row.w <= B.w, row && row.y);
    }
    const P = rec();
    drawOverlay(P.c, { state: "PAUSE" }, B.w, B.h, B.cx, B.cy, { view: 0, cursor: 0 }, undefined, undefined, { s: "COPIED", ok: true });
    check(tag + ": the copy note never lands on the PAUSE veil", !P.rows.some(([t]) => t === "COPIED"));
    const F = krec(); // v202 Task 5.4: the GAME OVER page's toast tag (the coral danger key)
    drawOverlay(F.ctx, { state: "LOSE", level: 2, score: 1 }, B.w, B.h, B.cx, B.cy, undefined, undefined, undefined, { s: "COPY FAILED", ok: false, t: 1 });
    const fr = F.texts.find((t) => t.s === "COPY FAILED");
    check(tag + ": COPY FAILED is drawn in the warning red", !!fr && fr.fill === "#ff5d73", fr && fr.fill);
  }
}

// ---- K is an ordinary unbound key (KICK is passive: walk into a bomb). In every
// shell and world state it does exactly what Z, bound to nothing anywhere, does. ----
{
  const at = (scr) => (g) => { g.app.screen = scr; };
  const pauseOn = (view) => (g) => { press(g, "Enter"); press(g, "KeyP"); if (view) { toRow(g, PAUSE_ITEMS.indexOf("SETTINGS")); press(g, "Enter"); } if (view === 2) { toRow(g, optAt(g, "GRAPHICS")); press(g, "Enter"); } };
  const STATES = {
    "INTRO title": { boot: mk },
    "INTRO show": { boot: () => show(mk()) },
    ATTRACT: { boot: menu, go: (g) => g.app.enterAttract() },
    MENU: { boot: menu },
    "LEVEL SELECT": { boot: menu, go: at(SCREEN.LEVEL) },
    "HIGH SCORES": { boot: menu, go: at(SCREEN.SCORES) },
    OPTIONS: { boot: menu, go: at(SCREEN.SETTINGS) },
    GRAPHICS: { boot: menu, go: at(SCREEN.GRAPHICS) },
    GUIDE: { boot: menu, go: at(SCREEN.GUIDE) },
    "HOW TO": { boot: menu, go: at(SCREEN.HOWTO) },
    ITEMS: { boot: menu, go: at(SCREEN.ITEMS) },
    ENEMIES: { boot: menu, go: at(SCREEN.ENEMIES) },
    FLOOR: { boot: menu, go: at(SCREEN.FLOOR) },
    STATS: { boot: menu, go: at(SCREEN.STATS) },
    MEDALS: { boot: menu, go: at(SCREEN.TROPHIES) },
    PLAY: { boot: run },
    "PAUSE list": { boot: menu, go: pauseOn(0) },
    "PAUSE OPTIONS": { boot: menu, go: pauseOn(1) },
    "PAUSE GRAPHICS": { boot: menu, go: pauseOn(2) },
    WIN: { boot: run, go: clearRoom },
    LOSE: { boot: run, go: (g) => { g.world.state = "LOSE"; } },
  };
  const sig = (g) => { const a = g.app, w = g.world; return JSON.stringify([a.screen, a.introStage, a.cursor, a.pauseCursor, a.pauseView, a.optRow, a.gfxRow, a.level, a.heat, a.pace, a.settings, w.state, w.level, w.seed, w.score, w.lives, live(w), g.input._intent]); };
  for (const [name, s] of Object.entries(STATES)) for (const [LK, blob] of LOOKS) {
    if (blob && !["OPTIONS", "GRAPHICS", "PAUSE OPTIONS", "PAUSE GRAPHICS"].includes(name)) continue; // the row sets matter on the SETTINGS / GRAPHICS / pause views only
    const tag = blob ? " (" + LK + ")" : "";
    const after = (code) => withSettings(blob, () => { const g = s.boot(); if (s.go) s.go(g); g.tick();
      if (code === "KeyK" && name.startsWith("PAUSE")) check(name + tag + " is really reached", g.world.state === "PAUSE" && g.app.pauseView === ["list", "OPTIONS", "GRAPHICS"].indexOf(name.slice(6)) && g.app.render3d === !!blob, g.app.pauseView);
      press(g, code); return sig(g); });
    const k = after("KeyK"), z = after("KeyZ");
    check("K = an unbound key on " + name + tag, k === z, k === z ? undefined : k + " vs " + z);
  }
  const g = run(); down("KeyK");
  check("K held in PLAY latches nothing: the intent has no kick field", !("kick" in g.input._intent) && !("kick" in g.input.intent()), JSON.stringify(g.input._intent));
  up("KeyK");
}

// ---- PAD MATRIX (plan T11): a fake getGamepads, the real poller, router and seam ----
{
  const IDX = { S: 0, E: 1, W: 2, N: 3, SHL: 4, SHR: 5, TRL: 6, TRR: 7, SELECT: 8, START: 9, dU: 12, dD: 13, dL: 14, dR: 15 };
  const mkP = () => { const p = { connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    p.set = (id, on) => { const b = p.buttons[IDX[id]]; b.pressed = on; b.value = on ? 1 : 0; }; return p; };
  const pk = (o = {}) => {
    const rig = { list: [mkP()] }, g = mk({ getGamepads: () => rig.list, ...o });
    g.gpr = rig; g.pad = rig.list[0];
    g.tick = (n = 1) => { for (let i = 0; i < n; i++) { g.t += 1000 / 60; g.ctl.poll(g.t); g.loop(g.t); } };
    return g;
  };
  const tap = (g, id, hold = 3) => { g.pad.set(id, true); g.tick(hold); g.pad.set(id, false); g.tick(2); };
  /* the first press a pad gives is its first sight: it acts at the title, and a pad
     seen elsewhere has that press swallowed (ruling Q10), so a pad-only route starts here */
  const pMenu = () => { const g = pk(); tap(g, "S"); g.tick(15); tap(g, "S"); return g; };
  const pRun = () => { const g = pMenu(); tap(g, "S"); return g; };
  const pPause = () => { const g = pRun(); tap(g, "START"); return g; };
  const rowTo = (g, i) => { for (let k = 0; k < i; k++) tap(g, "dD"); };
  const pOpt = () => { const g = pMenu(); rowTo(g, ITEMS.indexOf("SETTINGS")); tap(g, "S"); return g; };
  const pCtl = () => { const g = pOpt(); rowTo(g, optAt(g, "CONTROLS")); tap(g, "S"); return g; };

  { const g = pk();
    check("pad: the title waits for a press", g.app.screen === SCREEN.INTRO && g.app.introStage === 0);
    g.pad.axes[0] = 0.9; g.tick(10); g.pad.axes[0] = 0; g.tick(2);
    check("pad: a stick never leaves the title", g.app.introStage === 0 && g.app.screen === SCREEN.INTRO, g.app.introStage);
    tap(g, "dU");
    check("pad: a pad alone leaves the title, D-PAD included, into the show", g.app.screen === SCREEN.INTRO && g.app.introStage === 1, g.app.introStage);
    g.tick(15); tap(g, "E");
    check("pad: any button skips the show past its guard, onto MENU at cursor 0", g.app.screen === SCREEN.MENU && g.app.cursor === 0, g.app.screen); }
  { const g = pk(); tap(g, "S", 1);
    check("pad: the press that starts the show never also skips it", g.app.introStage === 1 && g.app.screen === SCREEN.INTRO); }

  const guided = (i) => (g) => { const n = g; for (let k = 0; k < i; k++) tap(n, "dD"); tap(n, "S"); };
  /* every state, table driven: [boot, SOUTH expect, EAST expect, START expect] */
  const onScr = (s) => (g) => g.app.screen === s;
  const paused = (v) => (g) => g.world.state === "PAUSE" && g.app.pauseView === v;
  const page = (name, go) => () => { const g = pMenu(); rowTo(g, ITEMS.indexOf(name)); tap(g, "S"); if (go) go(g); return g; };
  const MATRIX = {
    "MENU root": { boot: pMenu, E: onScr(SCREEN.MENU) },
    "LEVEL SELECT": { boot: page("LEVEL SELECT"), E: onScr(SCREEN.MENU), S: onScr(SCREEN.GAME), START: onScr(SCREEN.GAME) },
    "SETTINGS": { boot: page("SETTINGS"), E: onScr(SCREEN.MENU) },
    "GUIDE": { boot: page("GUIDE"), E: onScr(SCREEN.MENU), S: onScr(SCREEN.HOWTO) },
    "SCORES": { boot: page("RECORDS"), E: onScr(SCREEN.MENU), S: onScr(SCREEN.MENU) },
    "STATS": { boot: page("RECORDS", (g) => tap(g, "dR")), E: onScr(SCREEN.MENU) },
    "HOW TO": { boot: page("GUIDE", (g) => tap(g, "S")), E: onScr(SCREEN.GUIDE), S: onScr(SCREEN.GUIDE) },
    "GRAPHICS": { boot: () => { const g = pOpt(); rowTo(g, optAt(g, "GRAPHICS")); tap(g, "S"); return g; }, E: onScr(SCREEN.SETTINGS) },
    "CONTROLS": { boot: pCtl, E: onScr(SCREEN.SETTINGS) },
    "ITEMS": { boot: page("GUIDE", guided(GUIDE_ROWS.indexOf("POWER-UPS"))), E: onScr(SCREEN.GUIDE), S: onScr(SCREEN.GUIDE) },
    "ENEMIES": { boot: page("GUIDE", guided(GUIDE_ROWS.indexOf("ENEMIES"))), E: onScr(SCREEN.GUIDE), S: (g) => g.app.screen === SCREEN.ENEMIES && g.app.foeTip }, // v202 Task 3.5: SOUTH opens the points tooltip
    "ENEMIES tooltip open": { boot: page("GUIDE", (g) => { guided(GUIDE_ROWS.indexOf("ENEMIES"))(g); tap(g, "S"); }), E: (g) => g.app.screen === SCREEN.ENEMIES && !g.app.foeTip, dR: (g) => g.app.screen === SCREEN.ENEMIES && g.app.foeRow === 1 && !g.app.foeTip }, // EAST closes it first; a D-PAD move walks on and closes it
    "FLOOR": { boot: page("GUIDE", guided(GUIDE_ROWS.indexOf("FLOOR"))), E: onScr(SCREEN.GUIDE), S: onScr(SCREEN.GUIDE) },
    "MEDALS": { boot: page("RECORDS", (g) => { tap(g, "dR"); g.app.key("KeyT"); g.tick(); }), E: onScr(SCREEN.MENU) },
    "PAUSE GRAPHICS": { boot: () => { const g = pPause(); rowTo(g, PAUSE_ITEMS.indexOf("SETTINGS")); tap(g, "S"); rowTo(g, optAt(g, "GRAPHICS")); tap(g, "S"); return g; }, E: paused(1), START: paused(1) },
    "GAME PLAY": { boot: pRun, E: (g) => g.world.state === "PLAY" && g.app.screen === SCREEN.GAME, START: paused(0), SELECT: paused(0) },
    "GAME PAUSE": { boot: pPause, E: (g) => g.world.state === "PLAY", START: (g) => g.world.state === "PLAY", S: (g) => g.world.state === "PLAY" },
    "GAME PAUSE OPTIONS": { boot: () => { const g = pPause(); rowTo(g, PAUSE_ITEMS.indexOf("SETTINGS")); tap(g, "S"); return g; }, E: paused(0), START: paused(0) },
    "GAME WIN": { boot: () => { const g = pRun(); clearRoom(g); return g; }, E: (g) => g.world.state === "WIN", S: (g) => g.world.state !== "WIN", START: (g) => g.world.state !== "WIN" },
    "GAME LOSE": { boot: () => { const g = pRun(); g.world.state = "LOSE"; g.tick(); return g; }, E: (g) => g.app.screen === SCREEN.MENU && g.world.state === "MENU", S: (g) => g.world.state === "PLAY" && g.world.level === 1, START: (g) => g.world.state === "PLAY" && g.world.level === 1 }, // EAST = Esc: MENU at a run end (R19); START = SOUTH = Enter: TRY AGAIN
    "GAME FINALE": { boot: () => { const g = page("LEVEL SELECT")(); for (let i = 0; i < 4; i++) tap(g, "dR"); tap(g, "START"); clearRoom(g); return g; }, E: onScr(SCREEN.MENU), S: onScr(SCREEN.MENU), START: onScr(SCREEN.MENU) }, // a finale WIN: SOUTH / START = its main key MENU, EAST = Esc MENU
    "ATTRACT": { boot: () => { const g = pMenu(); g.app.enterAttract(); g.tick(); return g; }, E: onScr(SCREEN.MENU), S: onScr(SCREEN.GAME), START: onScr(SCREEN.GAME) },
  };
  for (const [name, row] of Object.entries(MATRIX)) for (const [LK, blob] of LOOKS) for (const id of ["S", "E", "START", "SELECT", "dR"]) {
    if (!row[id] || (blob && !["SETTINGS", "GRAPHICS", "CONTROLS", "PAUSE GRAPHICS", "GAME PAUSE OPTIONS"].includes(name))) continue;
    withSettings(blob, () => {
      const g = row.boot();
      const rows = g.app.optRows().length;
      tap(g, id);
      check("pad matrix: " + name + (blob ? " (" + LK + ")" : "") + " + " + id, row[id](g) && rows === (blob ? 12 : 10), "screen " + g.app.screen + " state " + g.world.state + " view " + g.app.pauseView);
    });
  }

  { const g = pRun(); g.world.state = "LOSE"; g.tick(); const feels = [], f0 = g.app._feel.bind(g.app); g.app._feel = (n) => (feels.push(n), f0(n)); // R2 carry-in
    tap(g, "E");
    check("pad: EAST at GAME OVER goes to MENU with the back feel (R19: the PAUSE quit's)", g.app.screen === SCREEN.MENU && feels.includes("back"), JSON.stringify(feels)); }
  { const g = page("LEVEL SELECT")(); const p0 = g.app.pace;
    tap(g, "SHR"); const p1 = g.app.pace; tap(g, "SHL");
    check("pad: L/R SHOULDER move PACE on LEVEL SELECT", p1 === Math.min(1, p0 + 1) && g.app.pace === Math.max(-1, p1 - 1), p0 + ">" + p1 + ">" + g.app.pace); }
  { const g = page("RECORDS", (g) => tap(g, "dD"))(); const h0 = g.app.scoreHeat;
    tap(g, "SHR"); const h1 = g.app.scoreHeat; tap(g, "SHL");
    check("pad: L/R SHOULDER walk the SCORES difficulty tabs (in the page body)", h1 !== h0 && g.app.scoreHeat === h0, h0 + ">" + h1 + ">" + g.app.scoreHeat); }
  { const g = page("RECORDS", (g) => tap(g, "dR"))(), r0 = reloads;
    for (const id of Object.keys(IDX)) { tap(g, id); tap(g, id); if (g.app.screen !== SCREEN.STATS) { g.app.screen = SCREEN.STATS; g.tick(); } }
    check("S12: no pad path reaches the STATS wipe", !g.app.resetArm && reloads === r0, reloads - r0); }
  /* RECORDS on a controller (Task 2.2, R7): D-PAD left / right switch tabs on the tab row; in the SCORES body they and the
     shoulders keep the difficulty filter; the shoulders do nothing on the tab row; NORTH / WEST stay STATS' MEDALS / copy;
     SOUTH and EAST leave for MENU on RECORDS; nothing is newly bound and no button reaches the wipe */
  { const pRec = (page, body) => { const g = pk({ audio: RECAUD }); tap(g, "S"); g.tick(15); tap(g, "S"); rowTo(g, ITEMS.indexOf("RECORDS")); tap(g, "S");
      for (let i = 0; i < page; i++) tap(g, "dR"); if (body) tap(g, "dD"); g.app.scoreHeat = 1; recPlays.length = 0; return g; };
    const P = {
      "SCORES tab row": [0, 0, { dL: want(SC, 0, "", { h: 1 }), dR: want(ST, 0, UM), dU: want(SC, 0), dD: want(SC, 1, UM), SHL: want(SC, 0, "", { h: 1 }), SHR: want(SC, 0, "", { h: 1 }), N: want(SC, 0), W: want(SC, 0) }],
      "SCORES body": [0, 1, { dL: want(SC, 1, UM, { h: 0 }), dR: want(SC, 1, UM, { h: 2 }), dU: want(SC, 0, UM, { h: 1 }), dD: want(SC, 1), SHL: want(SC, 1, UM, { h: 0 }), SHR: want(SC, 1, UM, { h: 2 }), N: want(SC, 1), W: want(SC, 1) }],
      "STATS tab row": [1, 0, { dL: want(SC, 0, UM), dR: want(ME, 0, UM), dU: want(ST, 0), dD: want(ST, 1, UM), SHL: want(ST, 0), SHR: want(ST, 0), N: want(ME, 0, UM), W: want(ST, 0, "", { copy: 1 }) }],
      "STATS body": [1, 1, { dL: want(ST, 1), dR: want(ST, 1), dU: want(ST, 0, UM), dD: want(ST, 1), SHL: want(ST, 1), SHR: want(ST, 1), N: want(ME, 0, UM), W: want(ST, 1, "", { copy: 1 }) }],
      "MEDALS tab row": [2, 0, { dL: want(ST, 0, UM), dR: want(ME, 0), dU: want(ME, 0), dD: want(ME, 0), SHL: want(ME, 0), SHR: want(ME, 0), N: want(ME, 0), W: want(ME, 0) }],
    };
    for (const [name, [page, body, btns]] of Object.entries(P)) for (const [id, w] of Object.entries({ ...btns, S: OUT, E: OUT, START: OUT })) {
      const g = pRec(page, body), c0 = clip.length, r0 = reloads;
      tap(g, id); await flush(); g.tick();
      const a = g.app, copy = clip.length - c0;
      const ok = a.screen === w.s && (w.s === MN ? a.cursor === ITEMS.indexOf("RECORDS") : a.recFocus === w.f) && (w.h == null || a.scoreHeat === w.h) && recPlays.join() === w.c && !a.resetArm && reloads === r0 && copy === (w.copy | 0);
      check("RECORDS controller: " + name + " + " + id + " -> " + (w.s === MN ? "MENU on RECORDS" : ["SCORES", "STATS", "MEDALS"][[SC, ST, ME].indexOf(w.s)] + (w.f ? " body" : " tab row")) + (w.h != null ? " difficulty " + w.h : "") + ", cues [" + w.c + "]" + (w.copy ? ", copied" : ""),
        ok, JSON.stringify([a.screen, a.cursor, a.recFocus, a.scoreHeat, recPlays, a.resetArm, reloads - r0, copy]));
    }
    const g = pRec(0, 0);
    g.pad.set("dR", true); g.tick(Math.ceil(0.4 * 60)); const mid = g.app.screen; g.tick(60); g.pad.set("dR", false); g.tick(2);
    check("RECORDS controller: D-PAD right held repeats the tab step and stops silently at MEDALS", mid === ME && g.app.screen === ME && recPlays.filter((n) => n === UM).length === 2, mid + "/" + recPlays.join());
    const s = pRec(0, 0);
    s.pad.axes[0] = 0.9; s.tick(3); s.pad.axes[0] = 0; s.tick(3);
    check("RECORDS controller: the stick steps the tab too", s.app.screen === ST && recPlays.join() === UM, s.app.screen + "/" + recPlays.join());
    /* fix round 1: a reset armed by a keyboard R (a controller has no route to it) is cancelled by every button, and nothing wipes */
    for (const body of [0, 1]) for (const id of ["S", "E", "W", "N", "SHL", "SHR", "TRL", "TRR", "SELECT", "START", "dU", "dD", "dL", "dR"]) {
      const g = pRec(1, body), r0 = reloads;
      press(g, "KeyR"); const armed = g.app.resetArm;
      tap(g, id); await flush(); g.tick();
      check("RECORDS controller: STATS " + (body ? "body" : "tab row") + " armed by a keyboard R, then " + id + ": disarmed, nothing wiped", armed === true && g.app.resetArm === false && reloads === r0, armed + "/" + g.app.resetArm + "/" + (reloads - r0) + " on " + g.app.screen);
    } }
  for (const [name, boot] of [["MENU", pMenu], ["PAUSE", pPause]]) {
    const g = boot(), s0 = () => JSON.stringify([g.app.screen, g.app.cursor, g.app.pauseCursor, g.app.pauseView, g.app.optRow, g.world.state, g.world.seed, live(g.world), g.input._intent]);
    const a0 = s0();
    for (const id of ["N", "W", "TRL", "TRR"]) tap(g, id);
    check("pad: N, W and the triggers are inert on " + name, s0() === a0, s0());
  }
  /* T14: the routes through the real createGame */
  const pLevel = () => { const g = pMenu(); g.app.pactUnlocked = true; rowTo(g, ITEMS.indexOf("LEVEL SELECT")); tap(g, "S"); return g; };
  { const g = pLevel();
    check("T14: on LEVEL SELECT", g.app.screen === SCREEN.LEVEL);
    tap(g, "TRR"); tap(g, "TRR");
    check("T14: R TRIGGER walks the MODES cursor", g.app.modeCur === 1, g.app.modeCur);
    tap(g, "N");
    check("T14: NORTH toggles a mode through the key path", g.app.pact !== 0, g.app.pact);
    const p = g.app.pact; tap(g, "N");
    check("T14: NORTH toggles it back", g.app.pact !== p && g.app.pact === 0, g.app.pact);
    while (g.app.modeCur < 4) tap(g, "TRR");
    const t0 = g.app.timeAttack; tap(g, "N");
    check("T14: TIME too", g.app.timeAttack === !t0);
    tap(g, "N");
    g.app.timeAttack = t0; }
  /* v202 Task 3.3 (ruling 5): the MODIFIERS list by controller too: D-PAD down to the door, SOUTH opens it, SOUTH toggles the entry, EAST closes */
  { const g = pLevel(); g.app.pact = 0; g.app.timeAttack = false;
    while (g.app.levelRow < 3) tap(g, "dD");
    tap(g, "S");
    check("controller: SOUTH on MODIFIERS opens the list on ONE LIFE", g.app.modOpen === true && g.app.modeCur === 0 && g.app.screen === SCREEN.LEVEL, [g.app.levelRow, g.app.modOpen, g.app.modeCur].join());
    tap(g, "S");
    check("controller: SOUTH in the list toggles ONE LIFE", (g.app.pact & PACT.LAST) !== 0 && g.app.modOpen, g.app.pact);
    tap(g, "dD"); tap(g, "S");
    check("controller: D-PAD down, SOUTH toggles NO FLOOR ITEMS", (g.app.pact & PACT.BARE) !== 0 && g.app.modeCur === 1, g.app.pact);
    tap(g, "E");
    check("controller: EAST closes the list, still on LEVEL SELECT", !g.app.modOpen && g.app.screen === SCREEN.LEVEL);
    g.app.pact = 0; }
  { const g = page("LEVEL SELECT")(); g.app.pactUnlocked = false; tap(g, "TRR"); tap(g, "N");
    check("T14: MODES stay shut before the first CLEAR", g.app.modeCur === -1 && g.app.pact === 0); }
  { const g = page("RECORDS", (g) => tap(g, "dR"))(), c0 = clip.length; tap(g, "W"); await flush(); g.tick();
    check("T14: STATS WEST copies the stats, with the same note", g.app.screen === SCREEN.STATS && clip.length === c0 + 1 && g.app.toast.s === "COPIED" && g.app.toast.t > 0, g.app.toast.s);
    clipMode = "no"; tap(g, "W"); await flush(); g.tick(); clipMode = "ok";
    check("T14: STATS WEST with a refusing clipboard says COPY FAILED", g.app.toast.s === "COPY FAILED", g.app.toast.s);
    tap(g, "N");
    check("T14: STATS NORTH opens MEDALS", g.app.screen === SCREEN.TROPHIES, g.app.screen);
    tap(g, "E");
    check("T14: EAST backs to MENU on RECORDS", g.app.screen === SCREEN.MENU && g.app.cursor === ITEMS.indexOf("RECORDS"), g.app.screen); }
  for (const [nm, set] of [["WIN", (g) => clearRoom(g)], ["LOSE", (g) => { g.world.state = "LOSE"; g.tick(); }]]) {
    const g = pRun(); set(g);
    const st = g.world.state, c0 = clip.length;
    tap(g, "W"); await flush(); g.tick();
    check("T14: " + nm + " WEST copies the result, with the same toast", g.world.state === st && clip.length === c0 + 1 && clip.at(-1) === copyPayload(g.world) && g.ro.toast && g.ro.toast.s === "COPIED", JSON.stringify(g.ro.toast));
    tap(g, "N"); await flush(); g.tick();
    check("T14: " + nm + " NORTH copies the board link", g.world.state === st && /\?code=F3/.test(clip.at(-1)) && g.ro.toast && g.ro.toast.s === "BOARD LINK COPIED", JSON.stringify(g.ro.toast));
    { // v202 Tasks 5.3 / 5.4: the run-end pages' copy keys read COPY RESULT … WEST, COPY MAP … NORTH (WIN: on the finale; a level clear shows NEXT LEVEL only)
      const R = krec(); drawOverlay(R.ctx, nm === "WIN" ? { ...g.world, level: 5 } : g.world, 600, 520, 300, 260, {}, undefined, { r: 5, et: 9, css: 1.38 }); const ws = R.texts.map((t) => t.s);
      check("T14: " + nm + " the keycaps name them", ws.indexOf("WEST") === ws.indexOf("COPY RESULT") + 1 && ws.indexOf("NORTH") === ws.indexOf("COPY MAP") + 1, ws.join("|"));
    }
  }
  { const g = pMenu(), log = [], c = { on: true, live() { return this.on; }, press(id) { log.push(id); } };
    g.app.padCards = [c, ...g.app.padCards]; g.tick();
    const c0 = g.app.cursor, s0 = g.app.screen;
    tap(g, "S"); tap(g, "E"); tap(g, "S");
    check("T14: a mash within 0.5 s never reaches the card or MENU", log.length === 0 && g.app.screen === s0 && g.app.cursor === c0, log.join());
    g.pad.set("dD", true); g.tick(40); g.pad.set("dD", false); g.tick(2);
    check("T14: a held D-PAD under the card walks nothing", g.app.cursor === c0, g.app.cursor);
    tap(g, "S");
    check("T14: past the guard SOUTH answers the card only", log.join() === "S" && g.app.screen === s0, log.join());
    c.on = false; g.tick(); tap(g, "S");
    check("T14: the card gone, SOUTH confirms again", g.app.screen === SCREEN.GAME, g.app.screen); }
  { const g = pMenu(), k = Object.keys(mem).length, a0 = mem["nb.analytics.v1"];
    for (const id of Object.keys(IDX)) { tap(g, id); tap(g, id); if (g.app.screen !== SCREEN.MENU) { g.app.screen = SCREEN.MENU; g.world.state = "PLAY"; g.tick(); } }
    check("T14: no pad button on MENU writes a consent answer", a0 === undefined && mem["nb.analytics.v1"] === undefined, mem["nb.analytics.v1"]); }
  for (const [LK, blob] of LOOKS) withSettings(blob, () => { delete mem["nb.analytics.v1"];
    const g = pOpt(); rowTo(g, optAt(g, "ANALYTICS"));
    check("T14: on the ANALYTICS row (" + LK + ", row " + g.app.optRow + ")", g.app.screen === SCREEN.SETTINGS && g.app.optLabel() === "ANALYTICS" && g.app.optRow === (blob ? 8 : 6), g.app.optRow);
    for (const id of ["S", "START", "dL", "dR", "W", "N", "SELECT", "SHL", "SHR", "TRL", "TRR", "S"]) tap(g, id);
    check("T14: the consent row: a pad mash on an unanswered card never answers it (" + LK + ")", mem["nb.analytics.v1"] === undefined && g.app.anaNote !== "", mem["nb.analytics.v1"] + " / " + g.app.anaNote); });
  { const plays = [], g = pk({ audio: { play: (n) => plays.push(n), toggle: () => false, duck: noop, pump: noop, unlocked: () => false } });
    g.app.screen = SCREEN.LEVEL; g.app.pactUnlocked = true; plays.length = 0;
    g.app.modeWalk(1); const one = plays.join(); g.app.modeWalk(-1);
    check("T14: a MODES step plays one uiMove, the clamped end is silent", one === "uiMove" && plays.length === 1, plays.join()); }
  { const g = pLevel(); tap(g, "TRR"); tap(g, "TRR");
    check("T14: the ring reads the live cursor", modeFocusOf() === 1 && g.app.modeCur === 1, modeFocusOf()); }
  /* LEVEL SELECT on a controller (v202 Task 2.3): the keyboard matrix's states x D-PAD four ways, SOUTH, EAST, START and the
     shoulders, through the real poller, router and seam (lvWant is the same table: D-PAD = arrows, SOUTH = Enter, EAST = Escape,
     the shoulders = [ ]); START always starts the run. */
  {
    const restore = lvMem();
    const PADKEY = { dL: "ArrowLeft", dR: "ArrowRight", dU: "ArrowUp", dD: "ArrowDown", S: "Enter", E: "Escape", START: "START", SHL: "BracketLeft", SHR: "BracketRight" };
    const pLv = (s) => { // the pad's first sight on the first poll (nothing pressed, so nothing to swallow), then the page set by state like the keyboard matrix
      const g = pk({ audio: LVAUD }); g.app.cabinetSeen = true; g.app.skip(); g.tick(1);
      g.app.pactUnlocked = s.U; g.app.cursor = ITEMS.indexOf("LEVEL SELECT"); g.app.confirm(); g.tick(2);
      Object.assign(g.app, { level: 3, heat: 1, pace: 0, pact: 0, timeAttack: false, levelRow: s.row, modOpen: !!s.open, modeCur: s.open ? s.cur : -1 });
      return lvSpy(g);
    };
    for (const s of lvStates()) for (const [id, k] of Object.entries(PADKEY)) {
      const g = pLv(s), w = lvWant(s, k);
      tap(g, id); g.tick();
      const got = lvGot(g), ok = JSON.stringify(got) === JSON.stringify(w) && (w.scr !== SCREEN.MENU || g.app.cursor === ITEMS.indexOf("LEVEL SELECT"));
      check("LEVEL controller: " + lvName(s) + " + " + id + " -> " + (w.scr === SCREEN.GAME ? "a run " + JSON.stringify(w.run) : w.scr === SCREEN.MENU ? "MENU on LEVEL SELECT" : (w.open ? "list " + w.cur : LVROW[w.row])) + ", cues [" + w.cues + "], feel " + (w.feel || "none"),
        ok, JSON.stringify(got) + " vs " + JSON.stringify(w));
    }
    for (const s of [...[0, 1, 2, 3, 4].map((row) => ({ U: true, row })), { U: true, row: 3, open: true, cur: 2 }]) for (const id of s.row === 3 ? ["START"] : ["S", "START"]) {
      const g = pLv(s);
      Object.assign(g.app, { level: 4, heat: 2, pace: 1, pact: PACT.LAST | PACT.THIN, timeAttack: true });
      tap(g, id); g.tick();
      check("LEVEL controller: " + id + " on " + lvName(s) + " starts level 4, EXPERT, FAST, ONE LIFE + FEWER ITEMS (what the page shows)",
        g.app.screen === SCREEN.GAME && g.world.level === 4 && g.world.heat === 2 && g.world.pace === 1 && g.world.pact === (PACT.LAST | PACT.THIN), [g.app.screen, g.world.level, g.world.heat, g.world.pace, g.world.pact].join("/"));
    }
    {
      const g = pLv({ U: true, row: 3 });
      g.pad.set("S", true); g.pad.set("START", true); g.tick(3); g.pad.set("S", false); g.pad.set("START", false); g.tick(2);
      check("LEVEL controller: SOUTH + START in one poll on MODIFIERS: START wins, one run, the list never opens", g.app.screen === SCREEN.GAME && LVPLAY.join() === "uiSel" && g.world.level === 3, g.app.screen + " " + LVPLAY.join());
    }
    {
      const g = pLv({ U: false, row: 0 });
      g.pad.set("dR", true); g.tick(90); g.pad.set("dR", false); g.tick(2);
      check("LEVEL controller (locked): D-PAD → held from 3 stops at 5 and flashes level 6 once", g.app.level === 5 && LVPLAY.join() === "uiMove,uiMove" && g.fs.filter((f) => f === "deny").length === 1 && g.app.lockR === 6, g.app.level + " " + LVPLAY.join() + " " + g.fs.join());
      tap(g, "dR"); tap(g, "START");
      check("LEVEL controller (locked): another → then START starts level 5, never the locked level", g.app.screen === SCREEN.GAME && g.world.level === 5, g.world.level);
      const d = pLv({ U: true, row: 0 });
      d.pad.set("dD", true); d.tick(120); d.pad.set("dD", false); d.tick(2);
      check("LEVEL controller: D-PAD ↓ held walks every row to START and stops silently", d.app.levelRow === 4 && LVPLAY.filter((n) => n === "uiMove").length === 4, d.app.levelRow + " " + LVPLAY.join());
      const t = pLv({ U: true, row: 3, open: true, cur: 0 });
      tap(t, "TRR");
      check("LEVEL controller: R TRIGGER in the open list walks the same cursor", t.app.modeCur === 1 && t.app.modOpen, t.app.modeCur);
      /* the L-STICK walks the rows and steps a value like the D-PAD */
      const st = pLv({ U: true, row: 0 });
      st.pad.axes[1] = 0.9; st.tick(3); st.pad.axes[1] = 0; st.tick(3);
      const r1 = st.app.levelRow, c1 = LVPLAY.join(); LVPLAY.length = 0;
      st.pad.axes[0] = 0.9; st.tick(3); st.pad.axes[0] = 0; st.tick(3);
      check("LEVEL controller: L-STICK down walks to DIFFICULTY, L-STICK right then raises it (one uiMove each)", r1 === 1 && c1 === "uiMove" && st.app.heat === 2 && LVPLAY.join() === "uiMove" && st.app.levelRow === 1, [r1, c1, st.app.heat, LVPLAY.join()].join("/"));
      /* TRIGGER / NORTH in two states: the list shut on LEVEL (today's cursor, the focus stays), and the list open (the same cursor) */
      const sh = pLv({ U: true, row: 0 });
      tap(sh, "TRR"); const a1 = [sh.app.modeCur, sh.app.levelRow, sh.app.modOpen, LVPLAY.join(), lvTop(sh.fs)]; LVPLAY.length = 0; sh.fs.length = 0;
      tap(sh, "N");
      check("LEVEL controller: list shut on LEVEL: R TRIGGER puts the chip cursor on ONE LIFE (uiMove, move) and the focus stays on LEVEL; NORTH toggles ONE LIFE (silent, confirm)",
        JSON.stringify(a1) === JSON.stringify([0, 0, false, "uiMove", "move"]) && sh.app.pact === PACT.LAST && sh.app.levelRow === 0 && !sh.app.modOpen && LVPLAY.length === 0 && lvTop(sh.fs) === "confirm", JSON.stringify(a1) + " " + sh.app.pact + " " + LVPLAY.join());
      const op = pLv({ U: true, row: 3, open: true, cur: 2 });
      tap(op, "TRR"); const b1 = [op.app.modeCur, LVPLAY.join()]; LVPLAY.length = 0;
      tap(op, "N");
      check("LEVEL controller: list open on FEWER ITEMS: R TRIGGER moves its cursor to SHRINK (uiMove); NORTH toggles SHRINK (silent); the list stays open",
        JSON.stringify(b1) === JSON.stringify([3, "uiMove"]) && op.app.pact === PACT.SHRINK && op.app.modOpen && op.app.modeCur === 3 && LVPLAY.length === 0, JSON.stringify(b1) + " " + op.app.pact);
      /* a TRIGGER cursor from the shut list never leaks into the list: SOUTH on MODIFIERS opens it on ONE LIFE */
      const lk = pLv({ U: true, row: 3 });
      tap(lk, "TRR"); tap(lk, "TRR"); const c0 = lk.app.modeCur;
      tap(lk, "S");
      check("LEVEL controller: R TRIGGER twice with the list shut (cursor 1), then SOUTH on MODIFIERS: the list opens on ONE LIFE", c0 === 1 && lk.app.modOpen && lk.app.modeCur === 0, c0 + " -> " + lk.app.modeCur);
    }
    restore();
  }
  { const g = pMenu(); const calls = []; globalThis.__load = { padLive: (pad) => { calls.push("live:" + pad); return true; }, padPress: (id) => calls.push(id) };
    const c0 = g.app.cursor; g.tick(2); tap(g, "S");
    const early = calls.filter((c) => !c.startsWith("live")).length;
    g.tick(40); tap(g, "E"); delete globalThis.__load;
    check("T14: the look-load card is wired: guarded, then EAST reaches it, nothing behind", early === 0 && calls.includes("E") && calls.includes("live:true") && g.app.screen === SCREEN.MENU && g.app.cursor === c0, calls.slice(-3).join()); }
  { const v1 = mem["nb.coach.v1"], v2 = mem["nb.coach.v2"]; mem["nb.coach.v1"] = "1"; delete mem["nb.coach.v2"];
    const g = pRun();
    g.world.events.push({ t: "power", kind: "throw" }); g.tick(1);
    check("T14: the live coach tip names the pad button", g.ro.coach2.k === "throw" && g.ro.coach2.s === "THROW · WEST tosses a bomb", g.ro.coach2.k + " / " + g.ro.coach2.s);
    if (v1 === undefined) delete mem["nb.coach.v1"]; else mem["nb.coach.v1"] = v1;
    if (v2 === undefined) delete mem["nb.coach.v2"]; else mem["nb.coach.v2"] = v2; }
  { const g = pRun(); const p = g.world.players[0], x0 = p.x, y0 = p.y, b0 = live(g.world);
    g.pad.set("dR", true); g.tick(25); g.pad.set("dR", false); g.pad.set("dD", true); g.tick(25); g.pad.set("dD", false); g.tick(2);
    check("pad: movement moves the hero", p.x !== x0 || p.y !== y0, (p.x - x0) + "," + (p.y - y0));
    tap(g, "S");
    check("pad: SOUTH plants", live(g.world) === b0 + 1, live(g.world));
    tap(g, "W");
    check("pad: WEST without the power plants nothing", live(g.world) === b0 + 1, live(g.world)); }
  { const g = pMenu(); const b0 = live(g.world); tap(g, "S");
    check("pad: the SOUTH that started the run plants nothing", g.app.screen === SCREEN.GAME && live(g.world) === b0, live(g.world)); }
  { const g = pMenu(); g.app.parked = true; g.app.idleT = 20; tap(g, "N");
    check("pad: a press zeroes idleT and parked", g.app.idleT < 0.5 && g.app.parked === false, g.app.idleT);
    g.app.idleT = IDLE_T - 0.01; g.pad.set("N", true); g.ctl.poll(g.t + 1); g.pad.set("N", false); g.tick();
    check("pad: a press never lets MENU drop into ATTRACT", g.app.screen === SCREEN.MENU, g.app.screen);
    g.app.idleT = 20; g.pad.axes[0] = 0.2; g.tick(); g.pad.axes[0] = 0; g.tick();
    check("pad: stick noise does not wake", g.app.idleT > 20, g.app.idleT); }
  { const g = pMenu(); const c0 = g.app.cursor, n = ITEMS.length;
    g.pad.set("dD", true); g.tick(1);
    check("pad repeat: one move at the press", g.app.cursor === (c0 + 1) % n, g.app.cursor);
    g.tick(18);
    check("pad repeat: none before 350 ms", g.app.cursor === (c0 + 1) % n, g.app.cursor);
    g.tick(5);
    check("pad repeat: the second at 350 ms", g.app.cursor === (c0 + 2) % n, g.app.cursor);
    g.tick(8);
    check("pad repeat: then every 110 ms", g.app.cursor === (c0 + 3) % n, g.app.cursor);
    g.pad.set("dD", false); g.tick(); }
  { const g = pCtl();
    check("pad: CONTROLS opens on the pad tab, MOVE's neighbour BOMB selected", g.app.ctlTab === "pad" && g.app.controls.view(g.app.ctlT).row === 1, g.app.ctlTab);
    /* a double tap: open with SOUTH, tap SOUTH again inside 200 ms, it binds nothing */
    g.pad.set("S", true); g.tick(2); g.pad.set("S", false); g.tick(2); g.pad.set("S", true); g.tick(2); g.pad.set("S", false); g.tick(2);
    check("pad double tap: the capture stays open, nothing bound", g.app.capturing && !mem["nb.controls.v1"], String(g.app.capturing));
    g.tick(20); tap(g, "E");
    check("pad capture: EAST onto BOMB swaps with REMOTE and saves", !g.app.capturing && JSON.parse(mem["nb.controls.v1"]).pad.BOMB === "E" && JSON.parse(mem["nb.controls.v1"]).pad.REMOTE === "S", mem["nb.controls.v1"]);
    tap(g, "E"); // the same button after the commit: menu EAST is still back
    check("pad: a rebound EAST still backs out of the page", g.app.screen === SCREEN.SETTINGS, g.app.screen);
    tap(g, "E");
    rowTo(g, 0);
    /* to a run: the new bomb plants, and menu SOUTH still confirms */
    g.app.cursor = 0; tap(g, "S");
    check("pad: menu SOUTH still confirms after the rebind", g.app.screen === SCREEN.GAME, g.app.screen);
    const b0 = live(g.world);
    tap(g, "S");
    check("pad: SOUTH no longer plants", live(g.world) === b0, live(g.world));
    tap(g, "E");
    check("pad: the rebound button plants", live(g.world) === b0 + 1, live(g.world));
    delete mem["nb.controls.v1"]; }
  { const g = pCtl(), v = () => g.app.controls.view(g.app.ctlT);
    tap(g, "dD");
    check("pad CONTROLS: D-PAD down walks one row", v().row === 2, v().row);
    tap(g, "dL");
    check("pad CONTROLS: D-PAD left changes tab", g.app.ctlTab === "key", g.app.ctlTab);
    tap(g, "SHR");
    check("pad CONTROLS: a shoulder changes tab", g.app.ctlTab === "pad", g.app.ctlTab);
    for (let i = 0; i < 3; i++) tap(g, "dD");
    const d0 = v().dead;
    tap(g, "dR");
    check("pad CONTROLS: D-PAD right on SENSITIVITY adjusts", v().row === 5 && d0 === 25 && v().dead === 15 && g.app.ctlTab === "pad", v().dead);
    tap(g, "dL");
    check("pad CONTROLS: D-PAD left on SENSITIVITY adjusts back", v().dead === d0, v().dead);
    delete mem["nb.controls.v1"]; }
  { const g = pCtl(); tap(g, "S"); g.tick(20);
    check("pad capture: open", g.app.capturing);
    tap(g, "START");
    check("pad capture: START cancels and writes nothing", !g.app.capturing && !mem["nb.controls.v1"] && g.app.screen === SCREEN.CONTROLS); }
  for (const [LK, blob] of LOOKS) withSettings(blob, () => { const g = pPause(); rowTo(g, PAUSE_ITEMS.indexOf("SETTINGS")); tap(g, "S"); rowTo(g, optAt(g, "CONTROLS")); tap(g, "S");
    check("pad: PAUSE CONTROLS is pauseView 3", g.app.pauseView === 3 && g.world.state === "PAUSE", g.app.pauseView);
    tap(g, "S"); g.tick(20);
    check("pauseView 3: a capture is open", g.app.capturing);
    press(g, "Escape");
    check("ESC in capture never pauses or backs out", !g.app.capturing && g.app.pauseView === 3 && g.world.state === "PAUSE", g.app.pauseView);
    tap(g, "E");
    check("pauseView 3 steps back to OPTIONS on the door (" + LK + ")", g.app.pauseView === 1 && g.app.optRow === optAt(g, "CONTROLS") && g.app.optLabel() === "CONTROLS", g.app.pauseView); });
  for (const [LK, blob] of LOOKS) withSettings(blob, () => { const g = mk(); show(g); press(g, "Enter"); toRow(g, ITEMS.indexOf("SETTINGS")); press(g, "Enter"); toRow(g, optAt(g, "CONTROLS")); press(g, "Enter");
    check("keys: CONTROLS opens on the keyboard tab", g.app.screen === SCREEN.CONTROLS && g.app.ctlTab === "key", g.app.ctlTab);
    press(g, "ArrowRight");
    check("keys: → changes tab", g.app.ctlTab === "pad", g.app.ctlTab);
    press(g, "ArrowLeft");
    check("keys: ← changes it back", g.app.ctlTab === "key", g.app.ctlTab);
    press(g, "ArrowDown"); press(g, "ArrowUp");
    check("keys: ↓ then ↑ comes back to BOMB", g.app.controls.view(g.app.ctlT).row === 1);
    press(g, "Enter"); g.tick(20);
    check("keys capture: open", g.app.capturing);
    for (const k of ["KeyU", "KeyY", "KeyN"]) press(g, k);
    check("U, Y and N are refused by the capture, which stays open, and answer nothing", g.app.capturing && mem["nb.analytics.v1"] === undefined && !mem["nb.controls.v1"]);
    g.tick(20); press(g, "KeyZ");
    const c1 = JSON.parse(mem["nb.controls.v1"] || "{}");
    check("keys capture: Z binds BOMB", !g.app.capturing && c1.key && c1.key.BOMB === "KeyZ", mem["nb.controls.v1"]);
    press(g, "Escape");
    check("keys: back on OPTIONS, on the CONTROLS door (" + LK + ")", g.app.screen === SCREEN.SETTINGS && g.app.optLabel() === "CONTROLS", g.app.screen);
    delete mem["nb.controls.v1"]; });
  { mem["nb.controls.v1"] = JSON.stringify({ v: 1, key: { BOMB: "Space", THROW: "KeyE", REMOTE: "KeyQ", PAUSE: "KeyP", MOVE: ["KeyI", "KeyL", "KeyO", "KeyK"] }, pad: { BOMB: "S", THROW: "W", REMOTE: "E", PAUSE: "SELECT" }, stick: "L", dead: 25, rumble: 0 });
    const g = menu(); const c0 = g.app.cursor;
    press(g, "KeyO");
    check("keyboard rebind of MOVE navigates menus", g.app.cursor === c0 + 1, g.app.cursor);
    press(g, "KeyS");
    check("the old key is dead in menus", g.app.cursor === c0 + 1, g.app.cursor);
    g.app.cursor = 0; press(g, "Enter");
    const p = g.world.players[0], y0 = p.y, x0 = p.x;
    down("KeyL"); g.tick(20); up("KeyL"); down("KeyO"); g.tick(20); up("KeyO"); g.tick(2);
    check("keyboard rebind of MOVE plays", p.x !== x0 || p.y !== y0, (p.x - x0) + "," + (p.y - y0));
    delete mem["nb.controls.v1"]; }
  { const g = pRun();
    g.gpr.list[0] = null; g.tick();
    check("disconnect with the pad last used in GAME PLAY pauses, kicker CONTROLLER LOST", g.world.state === "PAUSE" && g.app.padNote === "CONTROLLER LOST", g.world.state + " " + g.app.padNote);
    g.tick(30);
    g.gpr.list[0] = g.pad; g.tick();
    check("reconnect never resumes", g.world.state === "PAUSE", g.world.state);
    check("reconnect: CONTROLLER BACK", g.app.padNote === "CONTROLLER BACK", g.app.padNote);
    g.pad.set("S", true); g.tick(3); g.pad.set("S", false); g.tick(2);
    check("the wake press is swallowed in PAUSE", g.world.state === "PAUSE", g.world.state); }
  { const g = pMenu();
    g.gpr.list[0] = null; g.tick(5);
    check("disconnect on MENU's PLAY backdrop never pauses", g.world.state === "PLAY" && g.app.screen === SCREEN.MENU, g.world.state); }
  { const g = pRun(); press(g, "KeyA");
    g.gpr.list[0] = null; g.tick(5);
    check("disconnect with keys last used does not pause; the note waits", g.world.state === "PLAY" && g.app.padNote === "", g.world.state + " " + g.app.padNote);
    press(g, "Escape");
    check("the note shows at the next PAUSE", g.world.state === "PAUSE" && g.app.padNote === "CONTROLLER LOST", g.app.padNote); }
  { const g = pRun(); const p = g.world.players[0], x0 = p.x;
    g.pad.set("dR", true); g.pad.set("S", true); g.tick(3);
    (L.blur || []).forEach((f) => f({}));
    check("blur clears the pad latches", g.input._intent.fire === false && g.input.axes.right === false, JSON.stringify(g.input.axes));
    const b1 = live(g.world);
    g.tick(40);
    check("a button held across blur stays no press", live(g.world) === b1, live(g.world));
    void x0;
    g.pad.set("dR", false); g.pad.set("S", false); g.tick(2); }
  { /* the design review's case: SOUTH held, then START, inside one capped frame must not pause and resume */
    const g = pRun();
    g.pad.set("S", true); g.ctl.poll(g.t + 1); g.pad.set("START", true); g.ctl.poll(g.t + 2);
    g.pad.set("START", false); g.tick(3);
    check("SOUTH then START between frames pauses and stays paused", g.world.state === "PAUSE", g.world.state);
    g.pad.set("S", false); g.tick(2);
    check("and the released SOUTH confirms nothing", g.world.state === "PAUSE", g.world.state); }
  { const g = pk(); // no pad press, keys only: the pad layer changes nothing
    g.gpr.list[0] = null; g.tick();
    press(g, "KeyA"); g.tick(15); press(g, "Enter");
    check("no pad: the key path still reaches MENU", g.app.screen === SCREEN.MENU, g.app.screen); }
}

/* R1 cohesion 8: a page-key tap is ONE step on every page, cued the same: main wraps app.pageKey with the one uiMove (and none where nothing moves) */
{
  const got = [];
  for (const [scr, set, to] of [[SCREEN.SETTINGS, (a) => { a.optRow = 0; }, 4], [SCREEN.GUIDE, (a) => { a.guideRow = 0; }, 2], [SCREEN.ENEMIES, (a) => { a.foeRow = 0; }, 3], [SCREEN.LEVEL, (a) => { a.levelRow = 0; }, "START"], [SCREEN.SCORES, (a) => { a.recPage = 0; }, 1]]) {
    const g = mk({ audio: RECAUD }); g.app.cabinetSeen = true; g.app.skip(); g.tick(2);
    g.app.screen = scr; set(g.app); recPlays.length = 0;
    const r = g.app.pageKey(1, to), one = recPlays.join(), n0 = recPlays.length; g.app.pageKey(1, null);
    got.push([scr, scr === SCREEN.SCORES ? one === "" : r === true && one === UM, recPlays.length === n0]); // SCORES: one page on this box, so its step moves nothing and stays silent
  }
  check("a page-key tap sounds one uiMove on SETTINGS, GUIDE, ENEMIES and LEVEL SELECT, and a key with no page (or a RECORDS tab with one page) is silent", got.every((q) => q[1] && q[2]), JSON.stringify(got));
}

delete globalThis.window; delete globalThis.location; delete navigator.clipboard;
console.log(fail ? "KEYS FAIL " + fail + "/" + (pass + fail) : "KEYS OK " + pass);
process.exit(fail ? 1 : 0);
