/* KEY MATRIX — every documented key in every shell / world state, driven
   through the REAL createGame: stubbed window keydown/keyup listeners (the
   same ones Input and main register in the browser) and the real loop(t).
   Expectations come from README "How to play", AGENTS.md and the on-screen
   foot hints in menudraw.js — not from reading the handlers back. */
import { createGame } from "../src/main.js";
import { SCREEN, ITEMS, GUIDE_ROWS, PAUSE_ITEMS, IDLE_T } from "../src/app/menuapp.js";
import { SHOW_STEP, SHOW_DUR, popOf } from "../src/app/intro.js";
import { CFG } from "../src/core/config.js";
import { dailySeed } from "../src/app/daily.js";
import { getFlash, getShake } from "../src/render/fx.js";
import { copyPayload, drawOverlay, overlayBox, overlayCue } from "../src/render/scenes.js";
import { createToast, copyText, toastOf, toastTick, TOAST_T } from "../src/app/endkeys.js";

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
function mk(o = {}, cv = null) {
  for (const k in L) delete L[k];
  const g = createGame(cv, { seed: 42, ...o });
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
const live = (w) => w.bombs.filter((b) => !b.dead).length;

// ---- INTRO (opening 2026-10-09): the title waits for a press that starts the
// show; Escape and modifiers never do. In the show, past the 0.2 s guard, any
// key skips to MENU at PLAY. Every visit, the first included, lands on MENU. ----
const KEYS = ["Enter", "NumpadEnter", "Backspace", "ArrowDown", "KeyW", "Space", "KeyJ", "KeyX", "KeyQ", "KeyN", "KeyC", "KeyB", "Digit7", "KeyR", "KeyM", "KeyT", "Digit1", "BracketLeft", "KeyP"];
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
  const want = { "PLAY": SCREEN.GAME, "LEVEL SELECT": SCREEN.LEVEL, "DAILY": SCREEN.GAME, "OPTIONS": SCREEN.SETTINGS,
    "GUIDE": SCREEN.GUIDE, "HIGH SCORES": SCREEN.SCORES, "STATS": SCREEN.STATS, "SOURCE": SCREEN.MENU };
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

// ---- LEVEL SELECT: ←/→ room, ↑/↓ heat, [ ] pace, 1–5 when unlocked, Enter, Esc ----
{
  const g = menu(); toRow(g, 1); press(g, "Enter");
  press(g, "ArrowRight"); press(g, "KeyD"); press(g, "ArrowLeft");
  const lv = g.app.level;
  press(g, "ArrowUp"); const h1 = g.app.heat; press(g, "ArrowDown"); const h0 = g.app.heat; press(g, "KeyW");
  press(g, "BracketRight"); const p1 = g.app.pace; press(g, "BracketLeft"); press(g, "BracketLeft");
  press(g, "Digit1");
  check("LEVEL → / D raise the room, ← lowers it", lv === 2, lv);
  check("LEVEL ↑ / W raise heat, ↓ lowers it", h1 === 1 && h0 === 0 && g.app.heat === 1, h1 + "," + h0 + "," + g.app.heat);
  check("LEVEL ] raises pace, [ lowers it", g.app.pace === p1 - 2, p1 + "->" + g.app.pace);
  check("LEVEL 1 is inert before the first clear", (g.app.pact | 0) === 0, g.app.pact);
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

// ---- DAILY ----
{
  const d = new Date(), p = (n) => (n < 10 ? "0" + n : "" + n);
  const today = d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  const g = menu(); toRow(g, 2); press(g, "Enter");
  check("DAILY Enter plays today's pinned board", g.app.screen === SCREEN.GAME && g.world.level === 1 &&
    (g.world.heat | 0) === 0 && (g.world.pact | 0) === 0 && (g.world.pace | 0) === 0 && g.world.seed === dailySeed(today) >>> 0,
    g.world.seed + " vs " + dailySeed(today));
}

// ---- OPTIONS ----
{
  const g = menu(); toRow(g, 3); press(g, "Enter");
  const m0 = g.app.settings.mus;
  press(g, "ArrowLeft"); const m1 = g.app.settings.mus; press(g, "ArrowRight");
  press(g, "ArrowDown"); const r1 = g.app.optRow; press(g, "ArrowUp");
  press(g, "Enter"); const m2 = g.app.settings.mus;
  check("OPTIONS ← / → adjust the row", m1 === m0 - 10 && g.app.settings.mus !== m1, m0 + "," + m1);
  check("OPTIONS ↓ / ↑ move the row", r1 === 1 && g.app.optRow === 0, r1 + "," + g.app.optRow);
  check("OPTIONS Enter cycles the row once", m2 === (m0 >= 100 ? 0 : m0 + 10), m0 + "->" + m2);
  press(g, "Escape");
  check("OPTIONS Escape -> MENU", g.app.screen === SCREEN.MENU);
}

// ---- GUIDE + HOW TO / ITEMS / ENEMIES ----
for (let i = 0; i < GUIDE_ROWS.length; i++) {
  const g = menu(); toRow(g, 4); press(g, "Enter");
  toRow(g, i); press(g, "Enter");
  const want = [SCREEN.HOWTO, SCREEN.ITEMS, SCREEN.ENEMIES][i];
  const opened = g.app.screen === want;
  press(g, "Escape"); const esc = g.app.screen;
  press(g, "Enter"); press(g, "Enter");
  check("GUIDE ↓ + Enter opens " + GUIDE_ROWS[i] + "; Escape and Enter both go back to GUIDE",
    opened && esc === SCREEN.GUIDE && g.app.screen === SCREEN.GUIDE, opened + "/" + esc + "/" + g.app.screen);
  press(g, "Escape");
  check("GUIDE Escape -> MENU (" + GUIDE_ROWS[i] + ")", g.app.screen === SCREEN.MENU);
}

// ---- HIGH SCORES ----
{
  const g = menu(); toRow(g, 5); press(g, "Enter");
  press(g, "ArrowRight"); const h = g.app.scoreHeat; press(g, "ArrowLeft");
  check("HIGH SCORES ← / → flip the heat tab", h === 1 && g.app.scoreHeat === 0, h + "," + g.app.scoreHeat);
  press(g, "Enter");
  check("HIGH SCORES Enter -> MENU", g.app.screen === SCREEN.MENU);
  const e = menu(); toRow(e, 5); press(e, "Enter"); press(e, "Escape");
  check("HIGH SCORES Escape -> MENU", e.app.screen === SCREEN.MENU);
}

// ---- STATS + MEDALS ----
{
  const g = menu(); toRow(g, 6); press(g, "Enter");
  const c0 = clip.length;
  press(g, "KeyC"); await flush();
  check("STATS C copies the stats text", clip.length === c0 + 1 && /STATS|FUSE/i.test(clip[clip.length - 1]), clip[clip.length - 1]);
  press(g, "KeyT");
  check("STATS T opens MEDALS", g.app.screen === SCREEN.TROPHIES);
  press(g, "Escape"); const e = g.app.screen; press(g, "KeyT"); press(g, "Enter");
  check("MEDALS Escape and Enter both back out to STATS", e === SCREEN.STATS && g.app.screen === SCREEN.STATS);
  press(g, "KeyR"); const arm = g.app.resetArm; press(g, "KeyN");
  check("STATS R arms, any other key disarms", arm === true && g.app.resetArm === false && reloads === 0);
  press(g, "KeyR"); press(g, "KeyR");
  check("STATS R, R resets and reloads once", reloads === 1, reloads);
  press(g, "Escape");
  check("STATS Escape -> MENU", g.app.screen === SCREEN.MENU);
}
// STATS C reports back through the SAME endkeys toast WIN / LOSE use (app.toast, painted by shellview)
{
  const g = menu(); toRow(g, ITEMS.indexOf("STATS")); press(g, "Enter");
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
  toRow(g, ITEMS.indexOf("STATS")); press(g, "Enter"); press(g, "KeyC"); await flush(); press(g, "Escape");
  while (g.app.cursor > 0) press(g, "ArrowUp"); press(g, "Enter");
  check("a STATS note never leaks onto a run", g.app.screen === SCREEN.GAME && g.ro.toast === null, g.app.screen + "/" + JSON.stringify(g.ro.toast));
}
// STATS label taps (T1) ride the keyboard's own path: a tap on the painted
// C COPY MY STATS label IS KeyC — copy plus the same note. 600x520 buffer under
// a 300x260 CSS box (k=2); buffer label centres T (183,478), C (270,478),
// R (354,478); (300,300) is off every label.
{
  const PL = {};
  const ctx = new Proxy(function () {}, { get: (t, p) => (p === Symbol.toPrimitive ? () => "" : () => ctx), apply: () => ctx, set: () => true });
  const el = { width: 600, height: 520, style: {}, getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 260 }),
    addEventListener: (ty, fn) => { (PL[ty] = PL[ty] || []).push(fn); }, removeEventListener: noop };
  const g = menu(el);
  const tap = (x, y) => { (PL.pointerdown || []).forEach((f) => f({ clientX: x / 2, clientY: y / 2 })); g.tick();
    (PL.pointerup || []).forEach((f) => f({ clientX: x / 2, clientY: y / 2 })); g.tick(); };
  const toStats = () => { while (g.app.screen !== SCREEN.MENU) press(g, "Escape"); g.app.cursor = ITEMS.indexOf("STATS"); press(g, "Enter"); };
  toStats();
  const c0 = clip.length, r0 = reloads;
  tap(270, 478); await flush(); g.tick();
  check("STATS tap on C COPY MY STATS copies the stats text", g.app.screen === SCREEN.STATS && clip.length === c0 + 1 && /FUSEGRID STATS/.test(clip[clip.length - 1]),
    g.app.screen + "/" + clip[clip.length - 1]);
  check("STATS tap on C COPY MY STATS shows COPIED", toastOf(g.app.toast) && g.app.toast.s === "COPIED" && g.app.toast.ok === true, JSON.stringify(g.app.toast));
  clipMode = "no";
  tap(270, 478); await flush(); g.tick();
  check("STATS tap on C with a refusing clipboard says COPY FAILED", toastOf(g.app.toast) && g.app.toast.s === "COPY FAILED" && g.app.toast.ok === false,
    JSON.stringify(g.app.toast));
  clipMode = "ok";
  g.tick(Math.ceil(TOAST_T * 60) + 2);
  tap(354, 478); const arm = g.app.resetArm, c1 = clip.length;
  tap(270, 478); await flush(); g.tick();
  check("STATS armed, a tap where C was is off R AGAIN: disarms, copies nothing, no note, stays on STATS",
    arm === true && g.app.resetArm === false && clip.length === c1 && toastOf(g.app.toast) === null && g.app.screen === SCREEN.STATS && reloads === r0,
    arm + "/" + g.app.resetArm + "/" + JSON.stringify(g.app.toast));
  tap(354, 478); press(g, "KeyC"); await flush(); g.tick();
  check("STATS armed by a tap, then keyboard C: disarms and shows COPIED", g.app.resetArm === false && g.app.toast.s === "COPIED" && toastOf(g.app.toast) && reloads === r0,
    g.app.resetArm + "/" + JSON.stringify(g.app.toast));
  tap(183, 478);
  check("STATS tap on T MEDALS still opens MEDALS (unchanged)", g.app.screen === SCREEN.TROPHIES, g.app.screen);
  press(g, "Escape"); g.tick(Math.ceil(TOAST_T * 60) + 2);
  const c2 = clip.length;
  tap(300, 300);
  check("STATS idle off-label tap still backs out to MENU, copies nothing", g.app.screen === SCREEN.MENU && clip.length === c2 && toastOf(g.app.toast) === null,
    g.app.screen + "/" + clip.length);
  toStats(); g.tick(Math.ceil(TOAST_T * 60) + 2);
  const c3 = clip.length, ev = { clientX: 135, clientY: 239, pointerType: "touch" };
  (PL.pointerdown || []).forEach((f) => f(ev)); g.tick(); await flush();
  const downCopied = clip.length - c3;
  (PL.pointerup || []).forEach((f) => f(ev)); await flush(); g.tick();
  check("STATS touch tap on C copies on pointerup (a touch pointerdown carries no clipboard activation), not on pointerdown",
    downCopied === 0 && clip.length === c3 + 1 && g.app.toast.s === "COPIED" && toastOf(g.app.toast) && g.app.screen === SCREEN.STATS,
    downCopied + "/" + (clip.length - c3) + "/" + JSON.stringify(g.app.toast));
  const c4 = clip.length;
  (PL.pointerup || []).forEach((f) => f(ev)); await flush(); g.tick();
  check("STATS a stray touch pointerup with no C pointerdown copies nothing", clip.length === c4, clip.length - c4);
  // armed foot ends in C COPY, buffer centre (492,478): a tap on it IS KeyC while armed too
  const ca = { clientX: 246, clientY: 239 }, ct = { ...ca, pointerType: "touch" };
  for (const [how, arm] of [["by key", () => press(g, "KeyR")], ["by tap", () => tap(354, 478)]]) {
    g.tick(Math.ceil(TOAST_T * 60) + 2); arm();
    const a0 = g.app.resetArm, c5 = clip.length, r5 = reloads;
    (PL.pointerdown || []).forEach((f) => f(ct)); g.tick(); await flush();
    const dn = [clip.length - c5, g.app.resetArm, toastOf(g.app.toast)];
    (PL.pointerup || []).forEach((f) => f(ct)); await flush(); g.tick();
    check(`STATS armed ${how}, touch tap on C COPY: nothing on pointerdown, then pointerup disarms + copies + COPIED, no reload`,
      a0 === true && dn[0] === 0 && dn[1] === true && dn[2] === null && clip.length === c5 + 1 && /FUSEGRID STATS/.test(clip[clip.length - 1]) &&
        g.app.resetArm === false && toastOf(g.app.toast) && g.app.toast.s === "COPIED" && reloads === r5 && g.app.screen === SCREEN.STATS,
      JSON.stringify(dn) + "/" + g.app.resetArm + "/" + JSON.stringify(g.app.toast));
    g.tick(Math.ceil(TOAST_T * 60) + 2); arm();
    const a1 = g.app.resetArm, c6 = clip.length;
    (PL.pointerdown || []).forEach((f) => f(ca)); g.tick(); await flush();
    const dn1 = clip.length - c6;
    (PL.pointerup || []).forEach((f) => f(ca)); await flush(); g.tick();
    check(`STATS armed ${how}, mouse tap on C COPY copies on pointerdown (once), disarms, COPIED`,
      a1 === true && dn1 === 1 && clip.length === c6 + 1 && g.app.resetArm === false && g.app.toast.s === "COPIED" && toastOf(g.app.toast) && reloads === r5,
      dn1 + "/" + (clip.length - c6) + "/" + g.app.resetArm);
  }
  g.tick(Math.ceil(TOAST_T * 60) + 2); press(g, "KeyR"); clipMode = "no";
  (PL.pointerdown || []).forEach((f) => f(ct)); g.tick(); (PL.pointerup || []).forEach((f) => f(ct)); await flush(); g.tick();
  check("STATS armed, touch C COPY with a refusing clipboard: disarms, says COPY FAILED, never COPIED",
    g.app.resetArm === false && toastOf(g.app.toast) && g.app.toast.s === "COPY FAILED" && g.app.toast.ok === false, JSON.stringify(g.app.toast));
  clipMode = "ok"; g.tick(Math.ceil(TOAST_T * 60) + 2);
  for (const end of ["pointercancel", "pointerleave"]) {
    g.tick(Math.ceil(TOAST_T * 60) + 2);
    const c8 = clip.length, rt = { clientX: 177, clientY: 239, pointerType: "touch" };
    (PL.pointerdown || []).forEach((f) => f(ev)); (PL[end] || []).forEach((f) => f(ev)); g.tick(); await flush();
    (PL.pointerup || []).forEach((f) => f(ev)); await flush(); g.tick();
    const bare = clip.length - c8;
    (PL.pointerdown || []).forEach((f) => f(ev)); (PL[end] || []).forEach((f) => f(ev));
    (PL.pointerdown || []).forEach((f) => f(rt)); (PL.pointerup || []).forEach((f) => f(rt)); await flush(); g.tick();
    check(`STATS touch C then ${end}: a later pointerup (bare, or a tap on R RESET) copies nothing; R still arms`,
      bare === 0 && clip.length === c8 && toastOf(g.app.toast) === null && g.app.resetArm === true && g.app.screen === SCREEN.STATS,
      bare + "/" + (clip.length - c8) + "/" + g.app.resetArm + "/" + JSON.stringify(g.app.toast));
    tap(300, 300);
  }
  const r7 = reloads; tap(354, 478); tap(132, 478);
  check("STATS armed, a tap on R AGAIN (132,478) still erases + reloads once", reloads === r7 + 1 && g.app.resetArm === false, reloads - r7);
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
  for (const [code, f] of [["ShiftLeft", "shift"], ["ShiftRight", "shift"], ["KeyQ", "remote"], ["KeyK", "kick"]]) {
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
  check("PAUSE ↓ / ↑ / W move the list cursor and wrap", c1 === 1 && g.app.pauseCursor === PAUSE_ITEMS.length - 1, c1 + "," + g.app.pauseCursor);
}
for (const code of ["Enter", "Space"]) {
  const g = run(); press(g, "KeyP");
  press(g, code); g.tick(30);
  check("PAUSE " + code + " on RESUME -> PLAY, nothing planted, fire not latched",
    g.world.state === "PLAY" && live(g.world) === 0 && g.input._intent.fire === false, g.world.state + "/" + live(g.world));
}
{
  const g = run(); g.world.score = 77; press(g, "KeyP"); toRow(g, 1); press(g, "Enter"); g.tick(10);
  check("PAUSE Enter on RESTART -> room 1, score 0, PLAY, nothing planted",
    g.world.state === "PLAY" && g.world.level === 1 && g.world.score === 0 && live(g.world) === 0);
  const o = run(); press(o, "KeyP"); toRow(o, 2); const s0 = JSON.stringify(o.app.settings); press(o, "Enter");
  check("PAUSE Enter on OPTIONS opens the inline page and changes no knob",
    o.app.pauseView === 1 && o.world.state === "PAUSE" && JSON.stringify(o.app.settings) === s0, o.app.pauseView);
  press(o, "ArrowDown"); const r = o.app.optRow; press(o, "Escape");
  check("PAUSE OPTIONS ↓ moves the row; Escape backs to the list, still paused",
    r === 1 && o.app.pauseView === 0 && o.world.state === "PAUSE", r + "/" + o.app.pauseView);
  press(o, "KeyP");
  check("PAUSE P from the list resumes", o.world.state === "PLAY");
  const q = run(); press(q, "KeyP"); toRow(q, 3); press(q, "Enter");
  check("PAUSE Enter on QUIT TO MENU -> MENU", q.app.screen === SCREEN.MENU, q.app.screen);
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
  check("WIN B copies the board link", /^https:\/\/hmarzban\.github\.io\/fusegrid\/\?code=F1/.test(clip[clip.length - 1]), clip[clip.length - 1]);
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
  check("LOSE B copies the board link and says so", /\?code=F1/.test(clip[clip.length - 1]) && g.ro.toast && g.ro.toast.s === "BOARD LINK COPIED", JSON.stringify(g.ro.toast));
  press(g, "KeyP");
  check("LOSE P does not pause a finished run", g.world.state === "LOSE", g.world.state);
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
    const c = { fillRect: noop, strokeText: noop, fillText: (s, x, y) => rows.push([String(s), y, c.fillStyle]) };
    return { c, rows }; };
  for (const B of [overlayBox("2d"), overlayBox("iso")]) {
    const tag = B.w + "x" + B.h;
    for (const st of [{ state: "WIN", level: 3 }, { state: "WIN", level: 5 }, { state: "LOSE", level: 2 }]) {
      const cue = overlayCue(st) + " · C copy · B board";
      check("cue '" + cue + "' fits one line in " + tag, [...cue].length * 15 * 0.6 <= B.w - 48, [...cue].length * 9);
      check("cue names ENTER for " + st.state + " L" + st.level, /SPACE \/ ENTER \/ TAP/.test(cue));
    }
    for (const s of ["COPIED", "BOARD LINK COPIED", "COPY FAILED"]) {
      const R = rec();
      drawOverlay(R.c, { state: "WIN", level: 3, score: 1 }, B.w, B.h, B.cx, B.cy, undefined, undefined, undefined, { s, ok: s !== "COPY FAILED" });
      const row = R.rows.find(([t]) => t === s);
      check(tag + ": '" + s + "' is drawn above the headline, inside the box",
        !!row && row[1] < B.cy - 36 && row[1] > 24 && [...s].length * 15 * 0.6 <= B.w - 48, row && row[1]);
    }
    const P = rec();
    drawOverlay(P.c, { state: "PAUSE" }, B.w, B.h, B.cx, B.cy, { view: 0, cursor: 0 }, undefined, undefined, { s: "COPIED", ok: true });
    check(tag + ": the copy note never lands on the PAUSE veil", !P.rows.some(([t]) => t === "COPIED"));
    const F = rec();
    drawOverlay(F.c, { state: "LOSE", level: 2, score: 1 }, B.w, B.h, B.cx, B.cy, undefined, undefined, undefined, { s: "COPY FAILED", ok: false });
    const fr = F.rows.find(([t]) => t === "COPY FAILED");
    check(tag + ": COPY FAILED is drawn in the warning red", !!fr && fr[2] === "#ff5d73", fr && fr[2]);
  }
}

delete globalThis.window; delete globalThis.location; delete navigator.clipboard;
console.log(fail ? "KEYS FAIL " + fail + "/" + (pass + fail) : "KEYS OK " + pass);
process.exit(fail ? 1 : 0);
