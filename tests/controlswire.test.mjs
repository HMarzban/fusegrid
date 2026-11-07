/* The CONTROLS seam (plan T11): createGame with a fake getGamepads, the frame
   gate's pad poll, the same-game proofs D1 / D3 / D4, and the rumble and hint
   wiring. The full key and pad matrix lives in keys.test.mjs. */
import { createGame } from "../src/main.js";
import "../src/core/board3.js";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createPixelRenderer } from "../src/render/pixel/renderer.js";
import { SCREEN } from "../src/app/menuapp.js";
import { mountFrames } from "../src/app/frameloop.js";
import { mountControls } from "../src/app/controlswire.js";
import { mountUpdate, updVisible } from "../src/app/update.js";
import { ANALYTICS_KEY, GA_HOST, cardVisible, mountAnalytics } from "../src/app/analytics.js";
import { CFG } from "../src/core/config.js";
import { createWorld, loadLevel, step } from "../src/core/sim.js";
import { Input } from "../src/input.js";
import { createPad } from "../src/app/gamepad.js";
import { createPadRouter } from "../src/app/padroute.js";
import { DEF_CONTROLS } from "../src/app/controls.js";
import { hints, setHints } from "../src/render/hintcopy.js";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const noop = () => {};
const L = {}, mem = {};
globalThis.window = {
  addEventListener: (ty, fn) => { (L[ty] = L[ty] || []).push(fn); },
  removeEventListener: noop, innerWidth: 1440, innerHeight: 900,
  localStorage: { getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } },
  open: noop,
};
globalThis.location = { search: "", reload: noop };

const IDX = { S: 0, E: 1, W: 2, N: 3, SHL: 4, SHR: 5, TRL: 6, TRR: 7, SELECT: 8, START: 9, dU: 12, dD: 13, dL: 14, dR: 15 };
const mkPad = () => {
  const p = { connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  p.set = (id, on) => { const b = p.buttons[IDX[id]]; b.pressed = on; b.value = on ? 1 : 0; };
  return p;
};
function mk(o = {}) {
  for (const k in L) delete L[k];
  const rig = { list: [o.noPad ? null : mkPad()] };
  const g = createGame(null, { seed: 42, createPixelRenderer, getGamepads: () => rig.list, ...o });
  g.pad = rig.list[0];
  g.gpr = rig;
  g.t = 0;
  g.tick = (n = 1) => { for (let i = 0; i < n; i++) { g.t += 1000 / 60; g.ctl.poll(g.t); g.loop(g.t); } };
  g.tick();
  return g;
}
const tap = (g, id, hold = 3) => { g.pad.set(id, true); g.tick(hold); g.pad.set(id, false); g.tick(2); };
const menu = (o) => { const g = mk(o); tap(g, "S"); g.tick(15); tap(g, "S"); return g; };
const run = (o) => { const g = menu(o); tap(g, "S"); return g; };

/* FNV-1a over the whole world but `events`, as net-local.test does. */
function stateHash(w) {
  const s = JSON.stringify(w, (k, v) => (k === "events" ? undefined : v));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---- two pads: rumble and the deadzone view reach the pad that last pressed ----
{
  const actuator = (log, name) => ({ playEffect: () => { log.push(name); return Promise.resolve(); }, reset: () => { log.push(name + " reset"); return Promise.resolve(); } });
  const log = [];
  mem["nb.controls.v1"] = JSON.stringify({ v: 1, key: DEF_CONTROLS.key, pad: DEF_CONTROLS.pad, stick: "L", dead: 25, rumble: 1 });
  const g = run(), a = g.pad, b = mkPad();
  a.vibrationActuator = actuator(log, "A");
  b.vibrationActuator = actuator(log, "B");
  g.gpr.list = [a, b];
  a.axes = [0.5, 0, 0, 0];
  b.axes = [0, 0.5, 0, 0]; // the same magnitude: a guess from stick size would read pad A
  g.tick(30);
  b.set("N", true); g.tick(2); b.set("N", false); g.tick(2);
  const v = g.app.controls.view(g.app.ctlT).stickVal;
  check("the deadzone view reads the active pad, not the equal-sized other", v[0] === 0 && v[1] === 0.5, String(v));
  log.length = 0;
  g.ctl.afterStep([{ t: "hurt", x: 0, y: 0 }], { x: 0, y: 0 });
  check("rumble plays on the active pad only", log.join() === "B", log.join());
  b.vibrationActuator = null;
  g.tick(30);
  log.length = 0;
  g.ctl.afterStep([{ t: "hurt", x: 0, y: 0 }], { x: 0, y: 0 });
  check("an active pad with no actuator never borrows the other's", log.length === 0, log.join());
  check("and the page reads no rumble", g.app.controls.view(g.app.ctlT).pad.rumble === false);
  g.gpr.list = [a, null];
  g.tick(1);
  check("the active pad gone: the page reads it lost", g.app.controls.view(g.app.ctlT).pad.state === "lost");
  log.length = 0;
  g.ctl.afterStep([{ t: "hurt", x: 0, y: 0 }], { x: 0, y: 0 });
  check("the active pad gone: nothing reaches the idle one", log.length === 0, log.join());
  delete mem["nb.controls.v1"];
  setHints(null);
}

// ---- the frame gate polls above the cap, and a pad edge pokes it ----
{
  const q = [], Lw = {}, tgt = () => ({ addEventListener(t, f) { (Lw[t] = Lw[t] || []).push(f); } });
  let polls = 0, edge = false, runs = 0;
  const F = mountFrames(() => { runs++; }, { win: Object.assign(tgt(), { devicePixelRatio: 1 }), doc: Object.assign(tgt(), { body: { dataset: { lay: "d" } } }), raf: (f) => q.push(f), now: () => 0, idle: () => true, kind: () => "2d", app: () => ({ screen: SCREEN.MENU, pauseView: 0 }), running: () => true, pre: () => { polls++; return edge; } });
  F.apply({ fps: 1, res: 1, shd: 2, aa: 1, fxq: 1, dmo: 1, fpm: 0 });
  F.kick();
  let t = 0;
  const steps = (n) => { for (let i = 0; i < n; i++) { t += 1000 / 120; q.shift()(t); } };
  steps(60);
  const r0 = runs;
  steps(1);
  const quiet = runs - r0;
  check("the pad polls on every rAF, above the gate", polls === 61 && r0 < 61, polls + " polls, " + r0 + " runs");
  let forced = 0;
  edge = true;
  for (let i = 0; i < 6; i++) { const r = runs; steps(1); forced += runs - r; }
  edge = false;
  check("a pad edge pokes the gate: every polled edge renders under the idle floor", forced === 6 && quiet <= 1, forced);
}

// ---- mount: the seam owns the page, the gate and the guard ----
{
  const g = mk();
  check("app.controls is the page", !!g.app.controls && typeof g.app.controls.view === "function");
  check("input.gate.canThrow is false on MENU's PLAY backdrop", g.input.gate.canThrow() === false);
  check("input.guard is set", typeof g.input.guard === "function");
  g.app.screen = SCREEN.GAME; g.world.players[0].throw = false;
  check("canThrow needs the power", g.input.gate.canThrow() === false);
  g.world.players[0].throw = true;
  check("canThrow on GAME + PLAY + power", g.input.gate.canThrow() === true);
  g.world.state = "PAUSE";
  check("canThrow is false in PAUSE", g.input.gate.canThrow() === false);
}

// ---- hints: the device follows real presses, and app.lastDev is written first ----
{
  const g = menu();
  tap(g, "dD");
  check("a pad press writes app.lastDev", g.app.lastDev === "pad", g.app.lastDev);
  g.tick(60);
  check("the hint device flips on a pad press", g.ctl.device() === "pad" && hints().dev === "pad", g.ctl.device());
  (L.pointermove || []).forEach((f) => f({ pointerType: "mouse" }));
  (L.mousemove || []).forEach((f) => f({}));
  g.tick(60);
  check("a mouse move never flips it", g.ctl.device() === "pad", g.ctl.device());
  (L.pointerdown || []).forEach((f) => f({ pointerType: "mouse", button: 0 }));
  g.tick(60);
  check("a mouse click writes raw lastDev key (so the consent row is not blocked) and leaves the hint words", g.app.lastDev === "key" && g.ctl.device() === "pad", g.app.lastDev + "/" + g.ctl.device());
  (L.pointerdown || []).forEach((f) => f({ pointerType: "touch" }));
  g.tick(60);
  check("a touch tap writes lastDev touch and flips the words", g.app.lastDev === "touch" && g.ctl.device() === "touch", g.app.lastDev + "/" + g.ctl.device());
  (L.keydown || []).forEach((f) => f({ code: "ShiftLeft", key: "Shift", repeat: false, preventDefault: noop }));
  (L.keyup || []).forEach((f) => f({ code: "ShiftLeft", key: "Shift", preventDefault: noop }));
  g.tick(60);
  check("a modifier never flips it", g.app.lastDev === "touch" && g.ctl.device() === "touch", g.app.lastDev);
  const m = { dev: g.ctl.device(), page: g.app.controls.view(g.app.ctlT).device };
  check("one tracker: the page's device is the hints' device", m.dev === m.page && hints().dev === m.dev, JSON.stringify(m));
  setHints(null);
}

// ---- consent: SOUTH on an unanswered ANALYTICS row never consents ----
{
  const g = menu(); // the fake store has no answer, and the card logic reads ga.consent === -1
  const opt = g.app;
  opt.screen = SCREEN.SETTINGS; opt.optRow = 8;
  check("row 8 is ANALYTICS", opt.analytics === false);
  tap(g, "S");
  check("SOUTH on the unanswered row leaves analytics off", opt.analytics === false && mem["nb.analytics.v1"] === undefined, String(opt.analytics));
  check("and the row says why", opt.anaNote !== "", opt.anaNote);
  setHints(null);
}

// ---- rumble: no actuator, and the feed path ----
const STORED = (vib) => JSON.stringify({ v: 1, key: DEF_CONTROLS.key, pad: DEF_CONTROLS.pad, stick: "L", dead: 25, rumble: vib > 0 ? 1 : 0, vib });
const buzzer = (calls) => ({ playEffect: (ty, p) => { calls.push(p); return Promise.resolve(); }, reset: () => { calls.push("reset"); return Promise.resolve(); } });
const HIT = () => [{ t: "hurt", x: 0, y: 0 }];
{
  const g = menu();
  check("no actuator: the page reads no rumble", g.app.controls.view(g.app.ctlT).pad.rumble === false);
  check("no actuator: rumbleInfo says so", g.ctl.rumbleInfo().route === null && g.ctl.rumbleInfo().actuator === null && g.ctl.rumbleInfo().hapticActuators === 0, JSON.stringify(g.ctl.rumbleInfo()));
  g.app.screen = SCREEN.SETTINGS; g.app.optRow = 10; g.app.confirm();
  g.ctl.tap({ tab: "pad" }); g.ctl.tap({ row: 6 });
  check("no actuator: the row refuses, in the page's words", g.app.controls.view(g.app.ctlT).status === "NO VIBRATION ON THIS CONTROLLER OR BROWSER" && g.app.controls.view(g.app.ctlT).vib === 2 && !("nb.controls.v1" in mem), g.app.controls.view(g.app.ctlT).status);
  setHints(null);
}
{
  const calls = [];
  const g = menu();
  g.pad.vibrationActuator = buzzer(calls);
  check("an actuator: the page reads rumble", g.app.controls.view(g.app.ctlT).pad.rumble === true);
  g.world.state = "PLAY";
  g.ctl.afterStep(HIT(), { x: 0, y: 0 });
  check("the MENU backdrop world sits in PLAY and never buzzes", calls.length === 0 && g.app.screen === SCREEN.MENU, calls.length);
  for (const scr of ["ATTRACT", "INTRO", "SETTINGS", "CONTROLS", "LEVEL"]) {
    g.app.screen = SCREEN[scr];
    g.ctl.afterStep(HIT(), { x: 0, y: 0 });
    check("no buzz on " + scr + " with a PLAY world", calls.length === 0, calls.length);
  }
  setHints(null);
}
{
  const calls = [];
  const h = run();
  h.pad.vibrationActuator = buzzer(calls);
  h.tick(30);
  const n = calls.length;
  h.ctl.afterStep(HIT(), { x: 0, y: 0 });
  check("default ON with no store: a hurt plays in GAME", calls.length === n + 1 && !("nb.controls.v1" in mem), calls.length - n);
  h.tick(20);
  h.world.state = "WIN";
  h.ctl.afterStep([{ t: "win" }], { x: 0, y: 0 });
  check("a win plays even though the step flipped the state", calls.length === n + 2 && h.app.screen === SCREEN.GAME, calls.length - n);
  h.tick(20);
  h.world.state = "LOSE";
  h.ctl.afterStep([{ t: "hurt" }, { t: "lose" }], { x: 0, y: 0 });
  check("a lose plays even though the step flipped the state, at its own 300 ms", calls.length === n + 3 && calls.at(-1).duration === 300, calls.at(-1).duration);
  h.tick(20);
  h.ctl.afterStep(HIT(), { x: 0, y: 0 });
  check("WIN / LOSE with no flip in the feed: nothing", calls.length === n + 3, calls.length - n);
  h.world.state = "PLAY";
  h.tick(60); // past the 1 s on-time window the win and lose filled, or the engine drops the enter
  tap(h, "START");
  check("PAUSE stops it, through reset, then the page's enter", h.world.state === "PAUSE" && calls[calls.length - 2] === "reset" && calls[calls.length - 1].duration === 90, JSON.stringify(calls.slice(-3)));
  const m = calls.length;
  h.tick(20);
  h.ctl.afterStep(HIT(), { x: 0, y: 0 });
  check("in PAUSE nothing plays", calls.length === m, calls.length - m);
  setHints(null);
}
{
  mem["nb.controls.v1"] = STORED(0);
  const calls = [];
  const h = run();
  h.pad.vibrationActuator = buzzer(calls);
  h.tick(30);
  h.ctl.afterStep(HIT(), { x: 0, y: 0 });
  check("a stored 0 stays the player's choice: zero calls in GAME", calls.length === 0, calls.length);
  tap(h, "START");
  check("and a stored 0 never resets the pad on PAUSE", calls.length === 0, calls.length);
  delete mem["nb.controls.v1"];
  setHints(null);
}

// ---- rumble: the real sim's events through the real loop ----
{
  const calls = [];
  const h = run();
  h.pad.vibrationActuator = buzzer(calls);
  h.tick(30);
  calls.length = 0;
  tap(h, "S");
  check("a real plant: the 60 ms tick reaches the pad through the loop", h.world.bombs.length > 0 && calls.length === 1 && calls[0].duration === 60, JSON.stringify(calls));
  h.tick(30);
  calls.length = 0;
  const p = h.world.players[0], e = h.world.enemies.find((x) => !x.dead);
  h.world.lives = 1; p.iFrames = 0; p.shield = false; e.invuln = false; e.x = p.x; e.y = p.y;
  h.tick(2);
  check("a real death: the 300 ms lose step, after the step left PLAY", h.world.state === "LOSE" && calls.length === 1 && calls[0].duration === 300, h.world.state + " " + JSON.stringify(calls));
  h.tick(40);
  check("and its second step, with no feed behind it", calls.filter((q) => q !== "reset").map((q) => Math.round(q.duration)).join() === "300,117", JSON.stringify(calls));
  setHints(null);
}
{
  const calls = [];
  const h = run();
  h.pad.vibrationActuator = buzzer(calls);
  h.tick(30);
  calls.length = 0;
  h.world.enemies.forEach((e) => { e.dead = true; });
  h.world.winTimer = CFG.WIN_DELAY;
  h.tick(3);
  check("a real room clear: the win's first pulse", h.world.state === "WIN" && calls.length === 1 && calls[0].duration === 90, h.world.state + " " + JSON.stringify(calls));
  setHints(null);
}

// ---- rumble: a feed is one-way, the world hashes the same ----
{
  const calls = [];
  const h = run();
  h.pad.vibrationActuator = buzzer(calls);
  h.tick(30);
  const a = stateHash(h.world), ev = Object.freeze([Object.freeze({ t: "hurt", x: 0, y: 0 }), Object.freeze({ t: "boom", x: 0, y: 0 })]);
  h.ctl.afterStep(ev, Object.freeze({ x: 0, y: 0 }));
  check("a feed changes nothing in the world", calls.length === 1 && stateHash(h.world) === a);
  h.ctl.rumbleInfo();
  check("nor does rumbleInfo", stateHash(h.world) === a);
  setHints(null);
}

// ---- rumble: the pad is the live one, each play, from snap.index and a fresh list ----
{
  let lists = 0;
  const log = [];
  const base = mkPad();
  const fresh = () => {
    const id = ++lists;
    return [null, { ...base, buttons: base.buttons, axes: base.axes, vibrationActuator: { playEffect: () => { log.push("play" + id); return Promise.resolve(); }, reset: () => { log.push("reset" + id); return Promise.resolve(); } } }];
  };
  const w = createWorld(1, 1), inp = new Input(null), app = { screen: SCREEN.GAME, pauseView: 0, ctlT: 0, lastDev: "pad", wake: noop, onControls: () => false, capturing: false, ctlBtn: () => false, ctlKey: () => false };
  w.state = "PLAY";
  const c = mountControls({ win: null, doc: null, input: inp, app, SCREEN, world: w, onPause: noop, getGamepads: fresh, store: null });
  c.poll(16);
  check("the only pad is active at its own index, 1", lists > 0 && c.rumbleInfo().route === "dual-rumble");
  c.afterStep(HIT(), { x: 0, y: 0 });
  const a = lists;
  c.poll(200);
  c.afterStep(HIT(), { x: 0, y: 0 });
  check("two plays reach two different live gamepad objects, each the newest list's", log.length === 2 && log[0] !== log[1] && lists > a, log.join());
  check("each play's list came after the last poll: never a kept object", +log[1].slice(4) > a, log.join());
  setHints(null);
}

// ---- rumble: a hidden page stops it at once, and it stays stopped ----
{
  const calls = [], DL = {}, pad = mkPad();
  pad.vibrationActuator = buzzer(calls);
  const doc = { hidden: false, body: { dataset: { lay: "d" } }, getElementById: () => null, addEventListener: (t, f) => { (DL[t] = DL[t] || []).push(f); }, removeEventListener: noop };
  const w = createWorld(1, 1), inp = new Input(null), app = { screen: SCREEN.GAME, pauseView: 0, ctlT: 0, lastDev: "pad", wake: noop, onControls: () => false, capturing: false, ctlBtn: () => false, ctlKey: () => false };
  w.state = "PLAY";
  const c = mountControls({ win: null, doc, input: inp, app, SCREEN, world: w, onPause: noop, getGamepads: () => [pad], store: null });
  c.poll(16);
  c.afterStep(HIT(), { x: 0, y: 0 });
  check("visible: it plays", calls.length === 1, calls.length);
  doc.hidden = true;
  DL.visibilitychange.forEach((f) => f({}));
  check("hidden: reset at once", calls.at(-1) === "reset", String(calls.at(-1)));
  const n = calls.length;
  c.poll(500);
  c.afterStep(HIT(), { x: 0, y: 0 });
  check("hidden: nothing plays, even with PLAY and GAME", calls.length === n, calls.length - n);
  doc.hidden = false;
  DL.visibilitychange.forEach((f) => f({}));
  check("visible again: no stray reset", calls.length === n, calls.length - n);
  c.poll(800);
  w.lives--;
  c.afterStep(HIT(), { x: 0, y: 0 });
  check("visible again: it plays", calls.length === n + 1 && calls.at(-1).duration === 180 + 34, calls.length - n);
  setHints(null);
}

// ---- vibration: the test pulse, from the page's own write ----
const VIBROW = 6, SENSROW = 5;
{
  mem["nb.controls.v1"] = STORED(0);
  const calls = [];
  const g = menu();
  g.pad.vibrationActuator = buzzer(calls);
  g.tick(2);
  check("boot never pulses, stored OFF", calls.length === 0, calls.length);
  g.app.screen = SCREEN.SETTINGS; g.app.optRow = 10; g.app.confirm();
  g.ctl.tap({ tab: "pad" });
  check("the page shows it off", g.app.controls.view(g.app.ctlT).vib === 0);
  g.ctl.tap({ row: VIBROW });
  check("OFF to LOW: one 160 ms pulse at LOW", calls.length === 1 && calls[0].duration === 160 && Math.abs(calls[0].weakMagnitude - 0.4) < 1e-9 && g.app.screen === SCREEN.CONTROLS, JSON.stringify(calls));
  const raw = () => JSON.parse(mem["nb.controls.v1"]);
  check("and it is saved, with rumble still written", raw().vib === 1 && raw().rumble === 1);
  g.tick(1);
  g.ctl.tap({ row: VIBROW });
  check("inside 250 ms a further change plays nothing yet", calls.length === 1 && raw().vib === 2, JSON.stringify(calls));
  g.tick(20);
  check("then the last change plays once, at its level", calls.length === 2 && Math.abs(calls[1].weakMagnitude - 0.525) < 1e-9, JSON.stringify(calls));
  g.tick(20);
  g.ctl.tap({ row: VIBROW });
  check("past it, HIGH plays at HIGH", calls.length === 3 && calls[2].weakMagnitude === 0.7 && raw().vib === 3, JSON.stringify(calls));
  g.tick(20);
  g.ctl.tap({ row: VIBROW });
  check("HIGH cycles to OFF: no pulse, one reset", calls.length === 4 && calls[3] === "reset" && raw().vib === 0 && raw().rumble === 0, JSON.stringify(calls));
  g.tick(30);
  check("OFF stays quiet", calls.length === 4, calls.length);
  g.ctl.tap({ row: SENSROW });
  g.ctl.tap({ row: SENSROW });
  check("a write on another row never pulses", calls.length === 4, calls.length);
  delete mem["nb.controls.v1"];
  setHints(null);
}
{
  const calls = [];
  const g = menu();
  g.pad.vibrationActuator = buzzer(calls);
  g.tick(2);
  check("boot never pulses, default MEDIUM", calls.length === 0, calls.length);
  setHints(null);
  mem["nb.controls.v1"] = STORED(0);
  const h = run();
  h.pad.vibrationActuator = buzzer(calls);
  tap(h, "START");
  h.app.pauseView = 1; h.app.optRow = 10; h.app.confirm();
  h.ctl.tap({ tab: "pad" });
  calls.length = 0;
  h.ctl.tap({ row: VIBROW });
  check("from PAUSE view 3 the pulse still fires, though the run is paused", h.world.state === "PAUSE" && calls.length === 1 && calls[0].duration === 160, JSON.stringify(calls));
  delete mem["nb.controls.v1"];
  setHints(null);
}
// ---- vibration: a hold repeat plays nothing, and neither does RESET PAD ----
{
  const kd = (code) => (L.keydown || []).forEach((f) => f({ code, key: code, repeat: false, preventDefault: noop }));
  const ku = (code) => (L.keyup || []).forEach((f) => f({ code, key: code, preventDefault: noop }));
  mem["nb.controls.v1"] = STORED(0);
  const calls = [];
  const g = menu();
  g.pad.vibrationActuator = buzzer(calls);
  g.app.screen = SCREEN.SETTINGS; g.app.optRow = 10; g.app.confirm();
  g.ctl.tap({ tab: "pad" }); g.app.controls.pick(VIBROW);
  g.tick(2); calls.length = 0;
  kd("ArrowRight");
  g.tick(120);
  ku("ArrowRight"); g.tick(2);
  check("a held → walks to HIGH on one pulse, the first step's", g.app.controls.view(g.app.ctlT).vib === 3 && calls.length === 2 && Math.abs(calls[0].weakMagnitude - 0.4) < 1e-9 && calls[1].weakMagnitude === 0.7, JSON.stringify(calls));
  g.app.controls.pick(7); g.tick(30); calls.length = 0;
  g.app.confirm(); g.tick(2); g.app.confirm(); g.tick(30);
  check("RESET PAD takes HIGH to MEDIUM with no buzz", g.app.controls.view(g.app.ctlT).vib === 2 && calls.filter((q) => q !== "reset").length === 0, JSON.stringify(calls));
  check("and it says so in the store", JSON.parse(mem["nb.controls.v1"]).vib === 2);
  delete mem["nb.controls.v1"];
  setHints(null);
  mem["nb.controls.v1"] = STORED(0);
  const o = menu();
  o.pad.vibrationActuator = buzzer(calls);
  o.app.screen = SCREEN.SETTINGS; o.app.optRow = 10; o.app.confirm();
  o.ctl.tap({ tab: "pad" }); o.app.controls.pick(SENSROW); o.app.controls.adjust(1); o.app.controls.pick(7);
  o.tick(2); calls.length = 0;
  o.app.confirm(); o.tick(2); o.app.confirm(); o.tick(30);
  check("RESET PAD keeps a chosen OFF, in total silence", o.app.controls.view(o.app.ctlT).vib === 0 && o.app.controls.view(o.app.ctlT).dead === 25 && calls.length === 0, JSON.stringify(calls));
  delete mem["nb.controls.v1"];
  setHints(null);
}
// ---- vibration: OFF is really off, through the whole game ----
{
  mem["nb.controls.v1"] = STORED(0);
  let n = 0;
  const count = { effects: ["dual-rumble", "trigger-rumble"], playEffect: () => { n++; return Promise.resolve(); }, reset: () => { n++; return Promise.resolve(); } };
  const pulse = [{ pulse: () => { n++; return Promise.resolve(true); } }];
  const g = menu();
  g.pad.vibrationActuator = count; g.pad.hapticActuators = pulse;
  tap(g, "dD"); tap(g, "dU"); tap(g, "S"); g.tick(5); tap(g, "E"); g.tick(5);
  tap(g, "S"); g.tick(5);
  const h = g;
  h.ctl.afterStep([{ t: "hurt" }, { t: "lose" }, { t: "win" }, { t: "bomb" }, { t: "boom", x: 0, y: 0 }, { t: "boom", x: 0, y: 0 }], { x: 0, y: 0 });
  tap(h, "START"); h.tick(5); tap(h, "START"); h.tick(5);
  check("stored OFF: zero playEffect, pulse or reset calls on menus, a run and PAUSE", n === 0, n);
  delete mem["nb.controls.v1"];
  setHints(null);
}
// ---- vibration: patterns step on the rAF, and hurt and SHIELD differ on the real sim ----
{
  const calls = [];
  const h = run();
  h.pad.vibrationActuator = buzzer(calls);
  h.tick(30); calls.length = 0;
  const p = h.world.players[0], e = h.world.enemies.find((x) => !x.dead);
  const lives = h.world.lives;
  p.iFrames = 0; p.shield = true; e.invuln = false; e.x = p.x; e.y = p.y;
  h.tick(2);
  check("a real SHIELD absorb: the lives held, and the double tap", h.world.lives === lives && calls.length === 1 && calls[0].duration === 70 && calls[0].strongMagnitude === 0, JSON.stringify(calls));
  e.x = p.x + 2000;
  h.tick(30);
  check("the second tap plays on the poll, no event behind it", calls.length === 2 && Math.round(calls[1].duration) === 70, JSON.stringify(calls));
  h.tick(60); calls.length = 0;
  e.x = p.x; e.y = p.y; p.iFrames = 0; p.shield = false;
  h.tick(2);
  check("a real hit: the lives fell, and the long hard buzz", h.world.lives === lives - 1 && calls.length === 1 && calls[0].duration === 214 && calls[0].strongMagnitude === 0.75, h.world.lives + JSON.stringify(calls));
  e.dead = true;
  h.tick(30);
  check("then its tail", calls.length === 2 && Math.round(calls[1].duration) === 117, JSON.stringify(calls));
  setHints(null);
}
{
  const calls = [];
  const h = run();
  h.pad.vibrationActuator = buzzer(calls);
  h.tick(30); calls.length = 0;
  h.world.state = "LOSE";
  h.ctl.afterStep([{ t: "lose" }], { x: 0, y: 0 });
  h.world.state = "PAUSE";
  h.ctl.poll(h.t + 16);
  check("PAUSE mid-pattern: the poll itself stops it", calls.at(-1) === "reset", JSON.stringify(calls));
  const n = calls.length;
  h.world.state = "PLAY";
  for (let i = 1; i < 60; i++) h.ctl.poll(h.t + 16 + i * 16);
  check("and nothing resumes", calls.length === n, calls.length - n);
  setHints(null);
}
{
  const calls = [], pad = mkPad();
  pad.vibrationActuator = buzzer(calls);
  const doc = { hidden: false, body: { dataset: { lay: "d" } }, getElementById: () => null, addEventListener: noop, removeEventListener: noop };
  const w = createWorld(1, 1), inp = new Input(null), app = { screen: SCREEN.GAME, pauseView: 0, ctlT: 0, lastDev: "pad", wake: noop, onControls: () => false, capturing: false, ctlBtn: () => false, ctlKey: () => false };
  w.state = "PLAY";
  const c = mountControls({ win: null, doc, input: inp, app, SCREEN, world: w, onPause: noop, getGamepads: () => [pad], store: null });
  c.poll(16);
  w.lives--;
  c.afterStep(HIT(), { x: 0, y: 0 });
  doc.hidden = true;
  c.poll(32);
  check("hidden with no event yet: the next poll stops it", calls.at(-1) === "reset", String(calls.at(-1)));
  const n = calls.length;
  for (let i = 3; i < 60; i++) c.poll(i * 16);
  doc.hidden = false;
  for (let i = 60; i < 120; i++) c.poll(i * 16);
  check("and nothing resumes on the way back", calls.length === n, calls.length - n);
  setHints(null);
}
// ---- vibration: menu ticks ----
{
  const calls = [];
  const g = menu();
  g.pad.vibrationActuator = buzzer(calls);
  g.tick(2); calls.length = 0;
  g.app.lastDev = "pad";
  const c0 = g.app.cursor;
  tap(g, "dD");
  check("a first step on MENU: one 60 ms tick", g.app.cursor !== c0 && calls.length === 1 && calls[0].duration === 60, JSON.stringify(calls));
  g.tick(12); calls.length = 0;
  g.pad.set("dD", true); g.tick(90); g.pad.set("dD", false); g.tick(2);
  check("a hold repeats the cursor on one tick only", calls.length === 1, JSON.stringify(calls));
  g.tick(10); calls.length = 0;
  g.pad.set("dD", true); g.tick(1); g.pad.set("dD", false); g.tick(1); g.pad.set("dU", true); g.tick(1); g.pad.set("dU", false); g.tick(1);
  check("two steps inside 100 ms: one tick", calls.length === 1, calls.length);
  g.tick(12); calls.length = 0;
  g.app.screen = SCREEN.SETTINGS; g.app.optRow = 0; g.tick(2);
  tap(g, "dL"); tap(g, "dR"); g.tick(12);
  check("a value write on OPTIONS: one 70 ms confirm, the second inside 100 ms dropped", calls.length === 1 && calls[0].duration === 70, JSON.stringify(calls));
  g.app.screen = SCREEN.MENU; g.app.cursor = 3; g.tick(12); calls.length = 0;
  tap(g, "S"); g.tick(12);
  check("a row that opens a page: one 90 ms enter", g.app.screen === SCREEN.SETTINGS && calls.length === 1 && calls[0].duration === 90, JSON.stringify(calls));
  calls.length = 0;
  tap(g, "E"); g.tick(12);
  check("a back: one 70 ms back on the strong motor alone", g.app.screen === SCREEN.MENU && calls.length === 1 && calls[0].duration === 70 && calls[0].weakMagnitude === 0, JSON.stringify(calls));
  g.app.screen = SCREEN.SETTINGS; g.app.optRow = 7; g.tick(4); calls.length = 0;
  tap(g, "S"); g.tick(12);
  check("a row confirm that stays on the page: one 70 ms tick", g.app.screen === SCREEN.SETTINGS && calls.length === 1 && calls[0].duration === 70, JSON.stringify(calls));
  g.app.screen = SCREEN.MENU; g.app.lastDev = "key"; g.tick(4); calls.length = 0;
  setHints(null);
  mem["nb.controls.v1"] = STORED(1);
  const low = menu();
  low.pad.vibrationActuator = buzzer(calls);
  low.tick(2); calls.length = 0;
  tap(low, "dD"); tap(low, "dU"); low.tick(10);
  check("LOW: no menu ticks", calls.length === 0, JSON.stringify(calls));
  delete mem["nb.controls.v1"];
  setHints(null);
}
// ---- the note names the level, only when there is a motor ----
{
  const note = (actuator, vib) => {
    if (vib !== undefined) mem["nb.controls.v1"] = STORED(vib);
    const g = mk({ noPad: true });
    tapMenuReady(g);
    const pad = mkPad();
    if (actuator) pad.vibrationActuator = buzzer([]);
    g.gpr.list = [pad];
    g.tick(2);
    const out = g.app.padNote;
    delete mem["nb.controls.v1"];
    setHints(null);
    return out;
  };
  function tapMenuReady(g) { g.app.screen = SCREEN.MENU; g.app.cabinetSeen = true; g.tick(1); }
  check("READY names the level when it can buzz", note(true) === "CONTROLLER READY · VIBRATION MEDIUM", note(true));
  check("and OFF too", note(true, 0) === "CONTROLLER READY · VIBRATION OFF", note(true, 0));
  check("no motor: READY alone, no promise", note(false) === "CONTROLLER READY", note(false));
}


// ---- rumble: a non-standard pad with an actuator buzzes; only no actuator reads no rumble ----
{
  const calls = [];
  const g = menu();
  g.pad.mapping = "";
  g.pad.vibrationActuator = buzzer(calls);
  g.tick(2);
  check("non-standard with an actuator: padView reports rumble", g.app.controls.view(g.app.ctlT).pad.state === "nonstd" && g.app.controls.view(g.app.ctlT).pad.rumble === true);
  g.app.screen = SCREEN.GAME;
  g.ctl.afterStep(HIT(), { x: 0, y: 0 });
  check("non-standard with an actuator: a hurt plays", calls.length === 1 && calls[0].duration === 214, JSON.stringify(calls));
  check("rumbleInfo names the mapping and the route", g.ctl.rumbleInfo().route === "dual-rumble" && g.ctl.rumbleInfo().mapping === "");
  g.pad.vibrationActuator = null;
  g.tick(30);
  g.ctl.afterStep(HIT(), { x: 0, y: 0 });
  check("non-standard with no actuator: no rumble, zero calls", calls.length === 1 && g.app.controls.view(g.app.ctlT).pad.rumble === false, calls.length);
  setHints(null);
}

// ---- rumble: every API path through the seam, and what rumbleInfo reports ----
{
  const g = menu();
  g.tick(2);
  g.pad.vibrationActuator = { type: "dual-rumble", effects: ["dual-rumble", "trigger-rumble"], playEffect: () => Promise.resolve(), reset: () => Promise.resolve() };
  g.pad.hapticActuators = [{ pulse: () => Promise.resolve(true) }, { pulse: () => Promise.resolve(true) }];
  const i = g.ctl.rumbleInfo();
  check("rumbleInfo: type, effects, hapticActuators count", i.actuator === "dual-rumble" && i.effects.join() === "dual-rumble,trigger-rumble" && i.hapticActuators === 2 && i.route === "dual-rumble", JSON.stringify(i));
  const tr = [];
  g.pad.vibrationActuator = { effects: ["trigger-rumble"], playEffect: (ty) => { tr.push(ty); return Promise.resolve(); }, reset: () => Promise.resolve() };
  g.pad.hapticActuators = undefined;
  check("trigger-rumble alone: the page reads rumble", g.app.controls.view(g.app.ctlT).pad.rumble === true);
  g.app.screen = SCREEN.GAME;
  g.ctl.afterStep(HIT(), { x: 0, y: 0 });
  check("and it plays", tr.join() === "trigger-rumble", tr.join());
  const pu = [];
  g.pad.vibrationActuator = null;
  g.pad.hapticActuators = [{ pulse: (v, d) => { pu.push([v, d]); return Promise.resolve(true); } }];
  check("the older hapticActuators pulse alone: the page reads rumble", g.app.controls.view(g.app.ctlT).pad.rumble === true);
  g.tick(30);
  pu.length = 0;
  g.world.lives--;
  g.ctl.afterStep(HIT(), { x: 0, y: 0 });
  check("and it plays", pu.length === 1 && pu[0][0] === 0.75 && pu[0][1] === 214, JSON.stringify(pu));
  g.pad.hapticActuators = [];
  g.pad.vibrationActuator = { effects: [], playEffect: () => Promise.resolve() };
  check("an actuator with no effect it can play: the page reads no rumble", g.app.controls.view(g.app.ctlT).pad.rumble === false);
  g.pad.vibrationActuator = { playEffect: () => { throw new Error("x"); }, reset: () => { throw new Error("y"); } };
  g.tick(30);
  let threw = false;
  try { g.ctl.afterStep(HIT(), { x: 0, y: 0 }); g.tick(1); } catch (_) { threw = true; }
  check("a throwing actuator never breaks the loop", !threw);
  setHints(null);
}

// ---- rumbleInfo on the debug hook ----
{
  const g = mk({ debug: true });
  const hook = globalThis.window.__GAME__;
  check("window.__GAME__.ctl.rumbleInfo is there under debug", !!hook && typeof hook.ctl.rumbleInfo === "function" && hook.ctl.rumbleInfo().route === null);
  g.pad.vibrationActuator = { effects: ["dual-rumble"], playEffect: () => Promise.resolve() };
  check("and reads the active pad", hook.ctl.rumbleInfo().effects.join() === "dual-rumble", JSON.stringify(hook.ctl.rumbleInfo()));
  delete globalThis.window.__GAME__; delete globalThis.window.__pause; delete globalThis.window.__resume;
  setHints(null);
}

// ---- a saved bind reaches the game at boot ----
{
  mem["nb.controls.v1"] = JSON.stringify({ v: 1, key: { BOMB: "KeyZ", THROW: "KeyE", REMOTE: "KeyQ", PAUSE: "KeyP", MOVE: ["KeyW", "KeyD", "KeyS", "KeyA"] }, pad: DEF_CONTROLS.pad, stick: "R", dead: 40, rumble: 0 });
  const g = run();
  check("saved BOMB key is live at boot", g.input._kb.BOMB === "KeyZ", g.input._kb.BOMB);
  const x0 = g.world.players[0].x;
  g.pad.axes[0] = 0.9; g.tick(10); g.pad.axes[0] = 0; g.tick(2);
  check("saved R-STICK: the left stick moves nothing", g.world.players[0].x === x0);
  g.pad.axes[2] = 0.3; g.tick(10); g.pad.axes[2] = 0; g.tick(2);
  check("saved deadzone 40 is in percent: r 0.3 stays inside it", g.world.players[0].x === x0);
  g.pad.axes[2] = 0.9; g.tick(20); g.pad.axes[2] = 0; g.tick(2);
  check("saved R-STICK: past the deadzone the right stick walks", g.world.players[0].x !== x0, g.world.players[0].x - x0);
  delete mem["nb.controls.v1"];
  setHints(null);
}

// ---- update and consent cards stand down during capture ----
check("updVisible stands down while capturing", updVisible(SCREEN.MENU, "PLAY", false, SCREEN, false) && !updVisible(SCREEN.MENU, "PLAY", false, SCREEN, true));

// ---- taps: a row is Enter on it, off the plate cancels a capture, else backs out ----
{
  const g = menu();
  g.app.screen = SCREEN.SETTINGS; g.app.optRow = 10; g.app.confirm();
  check("door opens CONTROLS", g.app.screen === SCREEN.CONTROLS);
  g.ctl.tap({ tab: "key" });
  check("a tab tap switches tab", g.app.ctlTab === "key", g.app.ctlTab);
  g.ctl.tap({ row: 2 });
  check("a row tap is Enter on it: THROW listens", g.app.capturing && g.app.controls.view(g.app.ctlT).row === 2);
  g.ctl.tap({});
  check("on the plate during a capture is inert", g.app.capturing);
  g.ctl.tap({ off: 1 });
  check("off the plate cancels the capture and stays on the page", !g.app.capturing && g.app.screen === SCREEN.CONTROLS);
  g.ctl.tap({});
  check("a miss on the plate is inert", g.app.screen === SCREEN.CONTROLS && !g.app.capturing);
  g.ctl.tap({ off: 1 });
  check("off the plate backs out to OPTIONS on the door", g.app.screen === SCREEN.SETTINGS && g.app.optRow === 10, g.app.screen);
  const h = run();
  tap(h, "START");
  h.app.pauseView = 1; h.app.optRow = 10; h.app.confirm();
  check("from PAUSE the door is pauseView 3", h.app.pauseView === 3);
  h.ctl.tap({ off: 1 });
  check("off the plate in view 3 steps back to view 1, never to play", h.app.pauseView === 1 && h.world.state === "PAUSE", h.app.pauseView);
  setHints(null);
}

// ---- a tap off every canvas is off the plate while CONTROLS is open ----
{
  /* A DOM stub: an element, its ancestors, and closest() over id and tag selectors. */
  const elOf = (...chain) => ({ closest: (q) => { const qs = q.split(",").map((s) => s.trim()); return chain.find((n) => qs.includes(n)) || null; } });
  const BODY = elOf("body", "html"), WRAP = elOf("#wrap", "body", "html");
  const C = elOf("#c", "canvas", "#stage", "#wrap", "body"), SH = elOf("#sh", "canvas", "body");
  const PILL = elOf("#tpause", "#touchpad", "#stage", "#wrap", "body"), PADEL = elOf("#tpad", "#touchpad", "#stage", "#wrap", "body");
  const down = (target, o = {}) => (L.pointerdown || []).forEach((f) => f({ pointerType: "touch", button: 0, target, ...o }));
  const page = () => { const g = menu(); g.app.screen = SCREEN.SETTINGS; g.app.optRow = 10; g.app.confirm(); return g; };
  {
    const g = page();
    g.ctl.tap({ tab: "key" }); g.ctl.tap({ row: 3 });
    check("the capture is open", g.app.capturing);
    for (const [nm, t] of [["#c", C], ["#sh", SH], ["the pause pill", PILL], ["the move pad", PADEL], ["#upd", elOf("#upd", "body")], ["#updbg", elOf("#updbg", "body")], ["#ana", elOf("#ana", "body")], ["#load", elOf("#loadretry", "#load", "body")], ["no target", null]]) {
      down(t);
      check("capture: a press on " + nm + " is not this seam's", g.app.capturing && g.app.screen === SCREEN.CONTROLS, nm);
    }
    down(WRAP, { button: 2 });
    check("capture: a right click off the canvas cancels nothing", g.app.capturing);
    down(WRAP);
    check("852x393 step: an off-canvas tap cancels the capture, the page stays", !g.app.capturing && g.app.screen === SCREEN.CONTROLS, g.app.screen);
    for (const t of [C, SH, PILL]) { down(t); check("no capture: a press on a canvas or the pad never backs out here", g.app.screen === SCREEN.CONTROLS); }
    down(BODY);
    check("no capture: an off-canvas tap backs out to OPTIONS on the door", g.app.screen === SCREEN.SETTINGS && g.app.optRow === 10, g.app.screen);
    down(BODY);
    check("other pages keep their behaviour: OPTIONS ignores an off-canvas tap", g.app.screen === SCREEN.SETTINGS, g.app.screen);
    setHints(null);
  }
  {
    const h = run();
    down(WRAP);
    check("live PLAY: an off-canvas tap does nothing", h.app.screen === SCREEN.GAME && h.world.state === "PLAY" && !h.app.pauseView);
    tap(h, "START");
    h.app.pauseView = 1; h.app.optRow = 10; h.app.confirm();
    check("the view 3 door", h.app.pauseView === 3 && h.world.state === "PAUSE", h.app.pauseView);
    for (const t of [C, PILL, PADEL]) { down(t); check("view 3: a press on the canvas or the pad is not this seam's", h.app.pauseView === 3); }
    down(WRAP);
    check("393x852 step: an off-canvas tap in view 3 steps back to view 1, never to play", h.app.pauseView === 1 && h.world.state === "PAUSE", h.app.pauseView);
    down(WRAP);
    check("view 1 keeps its behaviour: an off-canvas tap stays", h.app.pauseView === 1, h.app.pauseView);
    setHints(null);
  }
}

// ---- a rising button that a live pad card takes never starts the show behind it ----
{
  let unlocks = 0;
  const log = [], audio = { play: noop, unlock: () => { unlocks++; return false; }, unlocked: () => false, duck: noop, pump: noop, setTrack: noop, cue: () => "menu" };
  const g = mk({ audio });
  check("the title is up", g.app.screen === SCREEN.INTRO && g.app.introStage === 0, g.app.screen);
  globalThis.__load = { padLive: (pad) => { log.push("live:" + pad); return true; }, padPress: (id) => log.push(id) };
  g.tick(40);
  tap(g, "S");
  check("the load card took SOUTH (RETRY)", log.includes("S") && log.includes("live:true"), log.slice(-3).join());
  check("SOUTH on a live card never unlocks", unlocks === 0, unlocks);
  check("and the show has not started", g.app.screen === SCREEN.INTRO && g.app.introStage === 0, g.app.introStage);
  delete globalThis.__load;
  tap(g, "S");
  check("the card gone, SOUTH unlocks", unlocks === 1, unlocks);
  check("and starts the show", g.app.introStage === 1, g.app.introStage);
  setHints(null);
}

// ---- cues: one per action on CONTROLS, door and view 3 included ----
{
  const cues = [];
  const audio = { play: (c) => cues.push(c), unlock: () => false, unlocked: () => false, duck: noop, pump: noop, setTrack: noop, cue: () => "menu" };
  const g = menu({ audio });
  const take = () => cues.splice(0).filter((c) => c.startsWith("ui") && c !== "uiJingle").join();
  g.app.screen = SCREEN.SETTINGS; g.app.optRow = 10; g.tick(); take();
  g.app.confirm();
  check("the door plays one uiSel", take() === "uiSel" && g.app.screen === SCREEN.CONTROLS);
  g.ctl.tap({ tab: "key" }); g.ctl.tap({ tab: "pad" });
  check("a tab tap plays one uiMove each", take() === "uiMove,uiMove");
  g.ctl.tap({ tab: "pad" });
  check("the tab already set is silent", take() === "");
  const kd = (code) => { (L.keydown || []).forEach((f) => f({ code, key: code, repeat: false, preventDefault: noop })); (L.keyup || []).forEach((f) => f({ code, key: code, preventDefault: noop })); };
  kd("BracketLeft");
  check("[ plays one uiMove", take() === "uiMove" && g.app.ctlTab === "key", cues.join());
  kd("BracketRight");
  check("] plays one uiMove", take() === "uiMove" && g.app.ctlTab === "pad", cues.join());
  tap(g, "SHL"); g.tick(2);
  check("a shoulder plays one uiMove", take() === "uiMove" && g.app.ctlTab === "key", cues.join());
  tap(g, "dR"); g.tick(2);
  check("D-PAD → plays one uiMove", take() === "uiMove" && g.app.ctlTab === "pad", cues.join());
  g.ctl.tap({ row: 6 });
  check("VIBRATION with no actuator refuses in silence, the status still says why", take() === "" && g.app.controls.view(g.app.ctlT).status === "NO VIBRATION ON THIS CONTROLLER OR BROWSER", cues.join());
  g.ctl.tap({ tab: "key" }); g.app.controls.pick(5); take();
  g.app.confirm();
  check("a fixed row refuses in silence, the status still says why", take() === "" && g.app.controls.view(g.app.ctlT).status === "ENTER AND ESC STAY PUT SO YOU CAN ALWAYS GET BACK", cues.join());
  g.ctl.tap({ tab: "pad" }); take();
  g.pad.set("S", false);
  g.ctl.tap({ row: 5 }); // DEADZONE steps through a write
  check("DEADZONE plays one uiTog, never uiSel too", take() === "uiTog", cues.join());
  g.app.controls.pick(1); take();
  g.app.confirm();
  check("opening a capture plays one uiSel", take() === "uiSel" && g.app.capturing);
  g.tick(20);
  tap(g, "W");
  check("a capture commit plays one uiTog", take() === "uiTog" && !g.app.capturing, cues.join());
  delete mem["nb.controls.v1"];
  const h = run({ audio });
  tap(h, "START");
  h.app.pauseView = 1; h.app.optRow = 10; take();
  h.app.confirm();
  check("view 3's door plays one uiSel", take() === "uiSel" && h.app.pauseView === 3);
  h.app.controls.pick(5); take();
  h.app.confirm();
  check("view 3 never double-cues a write", take() === "uiTog");
  delete mem["nb.controls.v1"];
  setHints(null);
}

// ---- a held key keeps stepping DEADZONE: only a key-block change lets held keys go ----
{
  const kd = (code) => (L.keydown || []).forEach((f) => f({ code, key: code, repeat: false, preventDefault: noop }));
  const ku = (code) => (L.keyup || []).forEach((f) => f({ code, key: code, preventDefault: noop }));
  const g = menu();
  g.app.screen = SCREEN.SETTINGS; g.app.optRow = 10; g.app.confirm();
  g.ctl.tap({ tab: "pad" }); g.app.controls.pick(5);
  let binds = 0;
  const sb = g.input.setKeyBinds.bind(g.input);
  g.input.setKeyBinds = (k) => { binds++; sb(k); };
  kd("ArrowRight");
  g.tick(120);
  const v = g.app.controls.view(g.app.ctlT);
  check("a held → walks SENSITIVITY to its last level", v.dead === 8 && v.row === 5, v.dead);
  check("and the key is still held", g.input.input.right === true);
  check("a SENSITIVITY write never rebinds the keys", binds === 0, binds);
  ku("ArrowRight");
  g.tick(2);
  g.ctl.tap({ tab: "key" }); g.app.controls.pick(2); g.app.confirm();
  g.tick(30);
  kd("KeyZ"); ku("KeyZ");
  g.tick(2);
  check("a rebind still reaches Input, once", binds === 1 && g.input._kb.THROW === "KeyZ", binds + " " + g.input._kb.THROW);
  delete mem["nb.controls.v1"];
  setHints(null);
}
{
  mem["nb.controls.v1"] = JSON.stringify({ v: 1, key: { BOMB: "KeyZ", THROW: "KeyE", REMOTE: "KeyQ", PAUSE: "KeyP", MOVE: ["KeyW", "KeyD", "KeyS", "KeyA"] }, pad: DEF_CONTROLS.pad, stick: "L", dead: 25, rumble: 1 });
  const g = menu();
  check("the boot call still applies a saved key block", g.input._kb.BOMB === "KeyZ", g.input._kb.BOMB);
  delete mem["nb.controls.v1"];
  setHints(null);
}

// ---- SPACE finishes RESET, through the real keydown and fire latch ----
{
  const kd = (code) => (L.keydown || []).forEach((f) => f({ code, key: code === "Space" ? " " : code, repeat: false, preventDefault: noop }));
  const ku = (code) => (L.keyup || []).forEach((f) => f({ code, key: code, preventDefault: noop }));
  mem["nb.controls.v1"] = JSON.stringify({ v: 1, key: { ...DEF_CONTROLS.key, THROW: "KeyZ" }, pad: DEF_CONTROLS.pad, stick: "L", dead: 25, rumble: 1 });
  const g = menu();
  g.app.screen = SCREEN.SETTINGS; g.app.optRow = 10; g.app.confirm();
  g.ctl.tap({ tab: "key" }); g.app.controls.pick(7);
  kd("Space"); g.tick(2); ku("Space"); g.tick(2);
  check("SPACE arms RESET", g.app.controls.view(g.app.ctlT).armed === true && g.input._kb.THROW === "KeyZ");
  kd("Space"); g.tick(2); ku("Space"); g.tick(2);
  check("a second SPACE finishes it", g.app.controls.view(g.app.ctlT).armed === false && g.input._kb.THROW === "KeyE" && g.app.controls.view(g.app.ctlT).status === "KEYBOARD BACK TO DEFAULTS", g.app.controls.view(g.app.ctlT).status);
  delete mem["nb.controls.v1"];
  setHints(null);
}

// ---- a pad player in a keyboard capture: EAST cancels, the same press never backs out ----
{
  const g = menu();
  g.app.screen = SCREEN.SETTINGS; g.app.optRow = 10; g.app.confirm();
  g.ctl.tap({ tab: "key" }); g.app.controls.pick(2); g.app.confirm();
  check("a keyboard capture is open", g.app.capturing && g.app.controls.view(g.app.ctlT).capture.dev === "key");
  g.tick(30);
  tap(g, "E");
  check("EAST cancels it and stays on the page", !g.app.capturing && g.app.screen === SCREEN.CONTROLS && g.app.controls.view(g.app.ctlT).status === "CANCELLED · NOTHING CHANGED", g.app.screen);
  tap(g, "E");
  check("the next EAST backs out", g.app.screen === SCREEN.SETTINGS, g.app.screen);
  setHints(null);
}

// ---- rumble: only while the pad is the last-used device ----
{
  const kd = (code) => { (L.keydown || []).forEach((f) => f({ code, key: code, repeat: false, preventDefault: noop })); (L.keyup || []).forEach((f) => f({ code, key: code, preventDefault: noop })); };
  const calls = [];
  const h = run();
  h.pad.vibrationActuator = buzzer(calls);
  h.tick(30);
  h.ctl.afterStep(HIT(), { x: 0, y: 0 });
  check("the pad last used: a hit buzzes", calls.length === 1 && h.app.lastDev === "pad", calls.length);
  h.tick(30);
  calls.length = 1;
  kd("KeyG"); h.tick(30);
  check("a key press makes keys the last device", h.app.lastDev === "key" && h.app.screen === SCREEN.GAME, h.app.lastDev);
  h.ctl.afterStep(HIT(), { x: 0, y: 0 });
  h.ctl.afterStep([{ t: "bomb", x: 0, y: 0 }], { x: 0, y: 0 });
  check("a keyboard player with an idle pad connected gets no buzz", calls.length === 1, calls.length);
  (L.pointerdown || []).forEach((f) => f({ pointerType: "touch", button: 0 }));
  h.tick(30);
  h.ctl.afterStep(HIT(), { x: 0, y: 0 });
  check("nor does a touch player", h.app.lastDev === "touch" && calls.length === 1, calls.length);
  tap(h, "N"); h.tick(30);
  h.ctl.afterStep(HIT(), { x: 0, y: 0 });
  check("a pad press takes it back", h.app.lastDev === "pad" && calls.length === 2, calls.length);
  h.tick(30);
  calls.length = 2;
  h.ctl.afterStep(HIT(), { x: 0, y: 0 });
  h.world.state = "PLAY";
  kd("KeyG");
  h.tick(1);
  check("a key press mid-pattern stops the buzz at the next poll", calls.at(-1) === "reset", String(calls.at(-1)));
  setHints(null);
  const p = menu();
  p.pad.vibrationActuator = buzzer(calls);
  p.app.screen = SCREEN.SETTINGS; p.app.optRow = 10; p.app.confirm();
  p.ctl.tap({ tab: "pad" });
  kd("KeyG"); calls.length = 0;
  p.ctl.tap({ row: 6 }); p.ctl.tap({ row: 6 });
  check("the VIBRATION row's test pulse still answers a keyboard player", calls.some((q) => q.duration === 160), JSON.stringify(calls));
  delete mem["nb.controls.v1"];
  setHints(null);
}

// ---- the MENU sign does not age while the sound note holds the foot ----
{
  let on = false;
  const audio = { play: noop, unlock: () => false, unlocked: () => on, duck: noop, pump: noop, setTrack: noop, cue: () => "menu" };
  const g = mk({ audio });
  g.app.screen = SCREEN.MENU; g.app.lastDev = "pad"; g.tick(2);
  check("audio locked: the sound note holds the foot", g.app.soundNote !== "");
  g.tick(60 * 8);
  check("8 s on, the sign has not aged out", g.app.padNote === "CONTROLLER READY", g.app.padNote);
  on = true;
  g.app.idleT = 0; // a real player is pressing keys; MENU's idle clock would leave for ATTRACT
  g.tick(60 * 5);
  check("audio unlocked: the note gives way and the sign shows", g.app.soundNote === "" && g.app.padNote === "CONTROLLER READY", g.app.padNote);
  g.app.idleT = 0;
  g.tick(60 * 2);
  check("and it has its own 6 s, then the normal foot", g.app.padNote === "", g.app.padNote);
  setHints(null);
  const k = mk();
  k.app.screen = SCREEN.MENU; k.tick(60 * 7);
  check("with no sound note the sign still ages at 6 s", k.app.soundNote === "" && k.app.padNote === "", k.app.padNote);
  setHints(null);
}

// ---- dispose ----
{
  const g = mk();
  g.ctl.dispose();
  check("dispose clears the guard and the gate", g.input.guard === null && g.input.gate === null);
  setHints(null);
}

// ---- D1: a pad script and the matching key script give equal worlds ----
/* The acceptance table's script: 4-way moves only, every press at least one tick,
   THROW on E, no SPACE release while REMOTE is held. Both Inputs are real, the pad
   one is fed through the real poller and router. Every tick compares the intent,
   every 60 the whole world. */
const KEY_OF = { up: "KeyW", right: "KeyD", down: "KeyS", left: "KeyA", bomb: "Space", throw: "KeyE", remote: "KeyQ" };
const PAD_OF = { up: "dU", right: "dR", down: "dD", left: "dL", bomb: "S", throw: "W", remote: "E" };
function scriptOf(seed, n) {
  let s = (seed >>> 0) || 1;
  const rnd = (m) => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s >>> 16) % m; };
  const out = Array.from({ length: n }, () => []);
  const MOV = ["up", "right", "down", "left"];
  for (let t = 0; t < n - 1;) { const d = 1 + rnd(40), m = MOV[rnd(4)], e = Math.min(n - 1, t + d); out[t].push(["d", m]); out[e].push(["u", m]); t = e + rnd(4); }
  for (let t = 2; t < n - 1;) {
    const k = rnd(10), d = 1 + rnd(10), e = Math.min(n - 1, t + d);
    if (k < 6) { out[t].push(["d", "bomb"]); out[e].push(["u", "bomb"]); }
    else if (k < 8) { out[t].push(["d", "throw"]); out[e].push(["u", "throw"]); }
    else { out[t].push(["d", "remote"]); out[e].push(["u", "remote"]); }
    t = e + 1 + rnd(30);
  }
  return out;
}
function d1World(gen, room, heat) {
  const w = createWorld(4242 + room * 7 + heat, room);
  w.gen = gen; w.heat = heat;
  loadLevel(w, room, false);
  w.state = "PLAY"; w.lives = 99;
  const p = w.players[0];
  p.bombs = 4; p.range = 2; p.throw = true; p.remote = true;
  return w;
}
function d1(gen, room, heat, n) {
  const wK = d1World(gen, room, heat), wP = d1World(gen, room, heat);
  const iK = new Input(null), iP = new Input(null);
  const gate = (w) => ({ canThrow: () => w.state === "PLAY" && !!(w.players[0] && w.players[0].throw) });
  iK.gate = gate(wK); iP.gate = gate(wP);
  iK.onPause = noop; iK.onUiKey = noop;
  const fake = mkPad(), poller = createPad({ getGamepads: () => [fake] });
  const router = createPadRouter({ input: iP, app: { screen: SCREEN.GAME, pauseView: 0 }, SCREEN, binds: () => DEF_CONTROLS, world: () => wP, onPause: noop, onUiKey: noop, page: null });
  const script = scriptOf(gen * 1000 + room * 10 + heat, n);
  let bad = -1, booms = 0, planted = 0;
  poller.poll(0); // the pad is seen and at rest before the first scripted press
  router.route(poller.snap(), 0);
  router.route(poller.poll(1), 1);
  for (let i = 0; i < n && bad < 0; i++) {
    for (const [a, name] of script[i]) {
      const code = KEY_OF[name];
      if (a === "d") iK._onKey({ code, key: code, repeat: false, preventDefault: noop });
      else iK._onKeyUp({ code, key: code, preventDefault: noop });
      fake.set(PAD_OF[name], a === "d");
    }
    router.route(poller.poll(i + 2), i + 2);
    const a = iK.intent(), b = iP.intent();
    if (JSON.stringify(a) !== JSON.stringify(b)) { bad = i; break; }
    step(wK, CFG.STEP, { 0: a });
    step(wP, CFG.STEP, { 0: b });
    iK.advance(); iP.advance();
    for (const e of wK.events) { if (e.t === "bomb") planted++; if (e.t === "boom") booms++; }
    wK.events.length = 0; wP.events.length = 0;
    if (i % 60 === 59 && stateHash(wK) !== stateHash(wP)) bad = i;
  }
  if (bad < 0 && stateHash(wK) !== stateHash(wP)) bad = n;
  iK._onBlur(); iP._onBlur();
  return { bad, planted, booms };
}
{
  let worst = "", cells = 0, planted = 0, booms = 0;
  for (const gen of [1, 2, 3]) for (let room = 1; room <= 8; room++) for (let heat = 0; heat <= 2; heat++) {
    const r = d1(gen, room, heat, 600);
    cells++; planted += r.planted; booms += r.booms;
    if (r.bad >= 0 && !worst) worst = "gen " + gen + " room " + room + " heat " + heat + " tick " + r.bad;
  }
  check("D1: pad and key scripts: equal intents and worlds on " + cells + " cells (gen 1, gen 2, gen 3, rooms 1-8, every heat)", !worst, worst);
  check("D1: the script really plays (bombs planted, blasts seen)", planted > cells && booms > cells, planted + " planted, " + booms + " booms");
}

// ---- D3: a pad-fed ?net=local pair stays equal ----
{
  for (const k in L) delete L[k];
  const fake = mkPad();
  const g = createGame(null, { seed: 42, netLocal: true, createPixelRenderer, getGamepads: () => [fake] });
  g.t = 0;
  g.pad = fake;
  g.tick = (n = 1) => { for (let i = 0; i < n; i++) { g.t += 1000 / 60; g.ctl.poll(g.t); g.loop(g.t); } };
  g.tick();
  tap(g, "S"); g.tick(15); tap(g, "S"); tap(g, "S");
  check("D3: a pad alone reached the run", g.app.screen === SCREEN.GAME && g.world.state === "PLAY", g.app.screen);
  const a = g.world, b = g.net.wB, t0 = a.tick;
  let bad = 0;
  const seq = ["dR", "S", "dD", "S", "dL", "E", "dU", "S", "dR", "dD"];
  for (let i = 0; i < 240; i++) {
    const id = seq[(i / 24 | 0) % seq.length];
    if (i % 24 === 0) fake.set(id, true);
    if (i % 24 === 18) fake.set(id, false);
    g.tick();
    if (stateHash(a) !== stateHash(b)) bad++;
  }
  check("D3: A and B hash equal on all 240 pad-fed frames", bad === 0 && a.tick > t0, "bad " + bad + ", ticks " + (a.tick - t0));
  setHints(null);
}

// ---- D4: the sim never sees a pad ----
{
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = d + "/" + f; return statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : []; });
  const hits = walk("src/core").filter((f) => /getGamepads|gamepad|padroute|controls\.js|controlswire|nb\.controls|rumble|CONTROLS_KEY|loadControls/i.test(readFileSync(f, "utf8")));
  const appFiles = readdirSync("src/app").filter((f) => f.endsWith(".js"));
  const toRender = appFiles.filter((f) => /(?:from\s*|import\s*\(?\s*)["']\.\.\/render/.test(readFileSync("src/app/" + f, "utf8")));
  check("src/app imports nothing from src/render (" + appFiles.length + " files)", appFiles.includes("controlswire.js") && toRender.length === 0, toRender.join(","));
  check("D4: nothing under src/core reads the pad, the controls store or rumble", hits.length === 0, hits.join(","));
}

// ---- mountControls runs with no window or document at all ----
{
  const w = createWorld(1, 1);
  const inp = new Input(null);
  const app = { screen: SCREEN.MENU, pauseView: 0, ctlT: 0, lastDev: "key", wake: noop, onControls: () => false, get capturing() { return false; }, ctlBtn: () => false };
  const c = mountControls({ win: null, doc: null, input: inp, app, SCREEN, world: w, onPause: noop, getGamepads: () => null, store: null });
  check("no pad, no window: poll is inert", c.poll(16) === false && c.anyDown() === false);
  setHints(null);
}

// ---- Y and N during a capture reach it, never the consent card ----
{
  const el = () => { const e = { L: {}, hidden: false, attrs: {}, setAttribute: noop, addEventListener: noop, querySelector: () => el() }; return e; };
  const body = [], WL = [];
  const doc = { body: { appendChild: (e) => body.push(e), dataset: { lay: "d" } }, head: { appendChild: noop }, createElement: el, cookie: "" };
  const win = { addEventListener: (t, f, cap) => WL.push({ t, f, cap }) };
  const m = new Map(), st = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
  const key = (code) => { const ev = { code, repeat: false, stopped: false, stopImmediatePropagation() { this.stopped = true; } }; WL.filter((l) => l.t === "keydown").forEach((l) => l.f(ev)); return ev; };
  const app = { screen: SCREEN.MENU, capturing: true };
  const ga = mountAnalytics({ id: "G-TEST1234", store: st, win, doc, loc: { hostname: GA_HOST, pathname: "/fusegrid/" }, get: () => ({ app, SCREEN }) });
  const card = () => body.find((e) => e.id === "ana");
  check("cardVisible stands down while capturing", !cardVisible(SCREEN.MENU, SCREEN, false, true, true) && cardVisible(SCREEN.MENU, SCREEN, false, true, false));
  card().hidden = false; // the 250 ms tick has not run yet
  const ev = key("KeyY");
  check("Y during a capture answers nothing and is not stopped", ga.consent === -1 && !m.has(ANALYTICS_KEY) && !ev.stopped, ga.consent);
  ga.tick();
  check("the card hides on its next tick", card().hidden === true);
  app.capturing = false;
  ga.tick();
  check("and comes back when the capture ends", card().hidden === false);
  key("KeyN");
  check("N answers once the capture is over", ga.consent === 0);
}

// ---- U during a capture: the card's own key stands down, even before its 250 ms tick ----
{
  const el = () => { const e = { L: {}, hidden: true, dataset: {}, style: {}, setAttribute: noop, appendChild: noop, addEventListener(t, f) { (e.L[t] = e.L[t] || []).push(f); }, querySelector: () => el() }; return e; };
  const docL = {};
  globalThis.document = { body: el(), createElement: el, addEventListener: (t, f) => { (docL[t] = docL[t] || []).push(f); } };
  let posts = 0;
  const reg = { waiting: { postMessage: () => { posts++; } } };
  const app = { screen: SCREEN.MENU, capturing: true };
  const u = mountUpdate(() => ({ app, world: { state: "PLAY" }, isRunEnd: () => false, SCREEN }), {
    top: null, self: null, href: "http://127.0.0.1/index.html", location: { reload: noop },
    navigator: { serviceWorker: { controller: {}, addEventListener: noop, register: () => Promise.resolve(reg) } } });
  await new Promise((r) => setImmediate(r));
  const key = () => (docL.keydown || []).forEach((f) => f({ code: "KeyU", repeat: false }));
  check("the card stays hidden while capturing", u.ready && u.shown === false, u.shown);
  key();
  check("U while capturing posts nothing", posts === 0, posts);
  app.capturing = false; u.tick();
  check("the card shows when the capture ends", u.shown === true, u.shown);
  app.capturing = true; // captured since, before the next tick hid it
  key();
  check("U with the card still up during a capture posts nothing", posts === 0, posts);
  app.capturing = false; key();
  check("U works again after", posts === 1, posts);
  delete globalThis.document;
}

// ---- T14: the NEW VERSION card on a pad ----
{
  const els = {}, el = (k) => (els[k] = els[k] || { L: {}, hidden: true, dataset: {}, style: {}, textContent: "", setAttribute: noop, appendChild: noop, addEventListener: noop, querySelector: (s) => el(s) });
  globalThis.document = { body: el("body"), createElement: () => el("n" + Object.keys(els).length), addEventListener: noop };
  let posts = 0;
  const reg = { waiting: { postMessage: () => { posts++; } } };
  const app = { screen: SCREEN.MENU, capturing: false, lastDev: "key" };
  const u = mountUpdate(() => ({ app, world: { state: "PLAY" }, isRunEnd: () => false, SCREEN }), {
    top: null, self: null, href: "http://127.0.0.1/index.html", location: { reload: noop },
    navigator: { serviceWorker: { controller: {}, addEventListener: noop, register: () => Promise.resolve(reg) } } });
  check("the card's pad entry is not live before an update", u.padCard.live() === false);
  await new Promise((r) => setImmediate(r));
  check("it is live once the card shows", u.shown && u.padCard.live() === true);
  check("keys: the markup's U stays unwritten", els[".go kbd"] === undefined || els[".go kbd"].textContent !== "SOUTH");
  app.lastDev = "pad"; u.tick();
  check("pad: the card names SOUTH", els[".go kbd"].textContent === "SOUTH" && u.shown);
  app.lastDev = "key"; u.tick();
  check("back on keys: U again", els[".go kbd"].textContent === "U");
  let writes = 0; const gk = els[".go kbd"]; let val = gk.textContent; Object.defineProperty(gk, "textContent", { get: () => val, set: (v) => { writes++; val = v; } });
  u.tick(); u.tick();
  check("an unchanged device never rewrites the live region", writes === 0, writes);
  u.padCard.press("W"); u.padCard.press("N");
  check("only SOUTH and EAST act", posts === 0 && u.shown);
  u.padCard.press("E");
  check("EAST is LATER", posts === 0 && !u.shown && u.padCard.live() === false);
  u.padCard.press("S");
  const stay = posts === 0;
  check("a hidden card ignores SOUTH", stay, posts);
  const a2 = app; a2.screen = SCREEN.GAME; u.tick(); a2.screen = SCREEN.MENU; u.tick();
  check("the snooze ends with the next return to the menus", u.shown);
  u.padCard.press("S");
  check("SOUTH is RELOAD", posts === 1, posts);
  delete globalThis.document;
}
{
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  check("touch layouts show the pad words on the card", /#upd\[data-pad="1"\] kbd\{display:inline\}/.test(html) && /body\[data-lay=p\] #upd\[data-pad="1"\] kbd/.test(html));
  check("LATER's button word only shows on a pad", /#upd \.later kbd\{display:none;/.test(html));
}

delete globalThis.window; delete globalThis.location;
console.log("\n  CONTROLSWIRE RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
