/* KEY MATRIX — every documented key in every shell / world state, driven
   through the REAL createGame: stubbed window keydown/keyup listeners (the
   same ones Input and main register in the browser) and the real loop(t).
   Expectations come from README "How to play", AGENTS.md and the on-screen
   foot hints in menudraw.js — not from reading the handlers back. */
import { createGame } from "../src/main.js";
import { SCREEN, ITEMS, GUIDE_ROWS, PAUSE_ITEMS } from "../src/app/menuapp.js";
import { dailySeed } from "../src/app/daily.js";
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
function mk(o = {}) {
  for (const k in L) delete L[k];
  const g = createGame(null, { seed: 42, ...o });
  g.t = 0;
  g.tick = (n = 1) => { for (let i = 0; i < n; i++) { g.t += 1000 / 60; g.loop(g.t); } };
  const r = g.renderer, r0 = r.render.bind(r);
  r.render = (w, dt, ro) => { g.ro = ro; return r0(w, dt, ro); };
  g.tick();
  return g;
}
const down = (code, repeat = false) => (L.keydown || []).forEach((f) => f({ code, key: code, repeat, preventDefault: noop }));
const up = (code) => (L.keyup || []).forEach((f) => f({ code, key: code, preventDefault: noop }));
const press = (g, code, hold = 3) => { down(code); g.tick(hold); up(code); g.tick(2); };
const menu = () => { const g = mk(); g.app.cabinetSeen = true; press(g, "Enter"); return g; };
const toRow = (g, i) => { for (let k = 0; k < i; k++) press(g, "ArrowDown"); };
const run = (o) => { const g = menu(); if (o && o.unlock) g.app.pactUnlocked = true; press(g, "Enter"); return g; };
const clearRoom = (g) => { g.world.enemies.forEach((e) => { e.dead = true; }); g.tick(150); };
const live = (w) => w.bombs.filter((b) => !b.dead).length;

// ---- INTRO: Enter / Escape / arrows / Space / "ANY KEY TO SKIP" ----
for (const code of ["Enter", "NumpadEnter", "Escape", "Backspace", "ArrowDown", "KeyW", "Space", "KeyJ", "KeyX", "KeyQ", "KeyN", "KeyC", "KeyB", "Digit7", "ShiftLeft", "KeyR", "KeyM", "KeyT", "Digit1", "BracketLeft"]) {
  const g = mk();
  g.app.cabinetSeen = true;
  press(g, code);
  check("INTRO " + code + ": skips to MENU (seen cabinet) and starts nothing",
    g.app.screen === SCREEN.MENU && g.app.cursor === 0, g.app.screen + "/" + g.app.cursor);
}
const fresh = () => { for (const k in mem) delete mem[k]; return mk(); }; // an unseen cabinet
for (const code of ["Enter", "Escape", "KeyP", "ArrowDown", "KeyQ", "KeyR", "KeyM", "Space"]) {
  const g = fresh();
  press(g, code); g.tick(10);
  check("INTRO " + code + " (unseen cabinet): boots a CORE room-1 run that is PLAYING, not paused, nothing planted",
    g.app.screen === SCREEN.GAME && g.world.state === "PLAY" && g.world.level === 1 && live(g.world) === 0,
    g.app.screen + "/" + g.world.state + "/" + live(g.world));
}
{
  const g = fresh();
  down("Space"); g.tick(20);
  check("INTRO Space (unseen cabinet): boots a CORE room-1 run",
    g.app.screen === SCREEN.GAME && g.world.state === "PLAY" && g.world.level === 1, g.app.screen + "/" + g.world.state);
  check("INTRO Space held into the run plants nothing", live(g.world) === 0, live(g.world));
  up("Space"); g.tick(2);
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
  const r = mk(); r.app.cabinetSeen = true; press(r, "Enter"); r.tick(Math.ceil(10.2 * 60));
  press(r, "Escape");
  check("ATTRACT Escape -> MENU", r.app.screen === SCREEN.MENU, r.app.screen);
  for (const code of ["Enter", "KeyQ", "ArrowLeft", "Space", "KeyP"]) {
    const t = menu(); t.tick(Math.ceil(10.2 * 60));
    press(t, code);
    check("ATTRACT " + code + " -> a CORE room-1 run, playing, no bomb from the press",
      t.app.screen === SCREEN.GAME && t.world.state === "PLAY" && t.world.level === 1 && (t.world.heat | 0) === 0 && live(t.world) === 0,
      t.app.screen + "/" + live(t.world));
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
  const s = createToast();
  navigator.clipboard = { writeText: () => { throw new Error("sync"); } };
  copyText("x", s, "COPIED");
  check("copyText: a synchronous throw says COPY FAILED", s.s === "COPY FAILED" && s.ok === false, JSON.stringify(s));
  copyText("x", null, "COPIED");
  check("copyText: a null note (STATS) copies without a toast and never throws", true);
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
