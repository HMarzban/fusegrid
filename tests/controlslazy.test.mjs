/* v202 delivery: the CONTROLS page, its paint and rumble are not in the boot
   graph. This file runs COLD (nothing preloaded, its own process): the door
   opens on a LOADING plate whose inputs are inert, the page lands and works,
   the OPTIONS door and the READY note read the stored level without rumble.js,
   the hello waits for rumble.js, and the idle warm never runs in PLAY or the show. */
import { createGame } from "../src/main.js";
import "../src/core/board3.js";
import { createPixelRenderer } from "../src/render/pixel/renderer.js";
import { SCREEN, OPT_ROWS } from "../src/app/menuapp.js";
import { drawShell, controlsHit, controlsGeo } from "../src/render/shellview.js";
import { Input } from "../src/input.js";
import { createWorld } from "../src/core/sim.js";
import { setHints } from "../src/render/hintcopy.js";

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
  localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } },
  open: noop,
};
globalThis.location = { search: "", reload: noop };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f) => { for (let i = 0; i < 400 && !f(); i++) await sleep(1); return f(); };

const IDX = { S: 0, E: 1, W: 2, N: 3, SHL: 4, SHR: 5, TRL: 6, TRR: 7, SELECT: 8, START: 9, dU: 12, dD: 13, dL: 14, dR: 15 };
const mkPad = (calls) => {
  const p = { connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  p.set = (id, on) => { const b = p.buttons[IDX[id]]; b.pressed = on; b.value = on ? 1 : 0; };
  p.vibrationActuator = { playEffect: (ty, q) => { calls.push(q); return Promise.resolve(); }, reset: () => Promise.resolve() };
  return p;
};
function mk(o = {}) {
  for (const k in L) delete L[k];
  setHints(null);
  const calls = [], rig = { list: [o.pad ? mkPad(calls) : null] };
  const g = createGame(null, { seed: 42, createPixelRenderer, getGamepads: () => rig.list });
  g.pad = rig.list[0]; g.calls = calls; g.t = 0;
  g.tick = (n = 1) => { for (let i = 0; i < n; i++) { g.t += 1000 / 60; g.ctl.poll(g.t); g.loop(g.t); } };
  return g;
}
const rec = () => {
  const texts = [];
  const o = {
    font: "10px x", textAlign: "left", globalAlpha: 1,
    fillText(s) { texts.push(String(s)); },
    measureText(s) { return { width: String(s).length * 6 }; },
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  };
  return { texts, c: new Proxy(o, { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }) };
};
const draw = (g) => { const R = rec(); drawShell(R.c, g.app, g.world, null, "2d", () => [], () => 0); return R.texts; };

// ---- 1. the door opens on a LOADING plate; the page's inputs are inert until it lands ----
{
  const g = mk();
  g.tick(2);
  const a = g.app;
  check("cold mount: the page stands in, loading", a.controls && a.controls.loading === true && a.controls.failed === false);
  check("cold mount: no idle warm in Node (no document), nothing is fetched yet", a.controls.loading === true);
  a.screen = SCREEN.SETTINGS; a.optRow = OPT_ROWS.indexOf("CONTROLS");
  check("the OPTIONS door still opens CONTROLS", a.confirm() === true && a.screen === SCREEN.CONTROLS && a.onControls());
  const t0 = draw(g);
  check("one frame of the plate: CONTROLS + LOADING, no rows", t0.includes("CONTROLS") && t0.includes("LOADING") && !t0.includes("BOMB"), t0.join("|"));
  check("controlsHit / controlsGeo are null until the paint is in", controlsHit(a.controls.view(0), 300, 260, null, "2d", false) === null && controlsGeo(null, "2d", false) === null);
  const row0 = a.controls.view(a.ctlT).row;
  const keys = ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Enter", "Space"].map((k) => a.key(k));
  check("keys on the LOADING page do nothing: no move, no tab, no capture", keys.every((r) => !r) && !a.capturing && a.controls.view(a.ctlT).row === row0 && a.ctlTab === "key" && a.screen === SCREEN.CONTROLS, keys.join());
  g.ctl.tap(null);
  check("a tap on the canvas is inert while loading", a.screen === SCREEN.CONTROLS);
  check("the way out stays live: ESC backs out onto the door", a.key("Escape") === true && a.screen === SCREEN.SETTINGS && a.optRow === OPT_ROWS.indexOf("CONTROLS"));
  a.lastDev = "pad";
  a.confirm();
  check("re-opened by a pad player: still loading, the stand-in reads the pad tab", a.screen === SCREEN.CONTROLS && a.controls.loading && a.ctlTab === "pad");
  const landed = await until(() => !a.controls.loading);
  check("the page lands by itself after the door opened it", landed);
  g.tick(1);
  const t1 = draw(g);
  check("landed: the real page paints, opened on the device it was opened with", t1.includes("BOMB") && !t1.includes("LOADING") && a.ctlTab === "pad", t1.join("|"));
  a.lastDev = "key"; a.key("Escape"); a.confirm();
  check("landed: keys reach the page (Enter on BOMB starts a capture)", a.screen === SCREEN.CONTROLS && a.ctlTab === "key" && a.key("Enter") === true && a.capturing === true);
  check("landed: a canvas tap now resolves on the painted geometry", controlsHit(a.controls.view(a.ctlT), 1, 1, null, "2d", false) !== null);
  setHints(null);
}

// ---- 2. rumble.js lands on the first pad seen; the door and the READY note never wait on it; the hello waits ----
{
  const g = mk({ pad: true });
  g.tick(1); // the first poll sees the pad: rumble.js is asked for, not in yet
  const a = g.app;
  a.screen = SCREEN.MENU;
  g.tick(1); // the note shows off the title
  check("pad seen, rumble.js not in: nothing buzzed yet", g.calls.length === 0, g.calls.length);
  check("the READY note names the stored level without rumble.js", a.padNote === "CONTROLLER READY · VIBRATION MEDIUM", a.padNote);
  a.screen = SCREEN.SETTINGS;
  check("the OPTIONS door reads VIBRATION MEDIUM › without rumble.js", draw(g).includes("VIBRATION MEDIUM ›"));
  a.screen = SCREEN.MENU;
  await import("../src/app/rumble.js");
  await sleep(0);
  g.tick(1);
  check("the hello waited for rumble.js and plays on the first poll after it lands (one frame late here)", g.calls.length > 0, g.calls.length);
  setHints(null);
}

// ---- 3. the idle warm: never in live PLAY or the show; once in, a mount builds at once ----
{
  const W = await import("../src/app/controlswire.js?idle"); // a fresh copy of the seam: its page is not in yet
  const mount = (o) => {
    const app = { screen: SCREEN.MENU, pauseView: 0, ctlT: 0, lastDev: "key", wake: noop, _feel: noop, onControls: () => false, get capturing() { return false; }, ctlBtn: () => false, ctlKey: () => false };
    const c = W.mountControls({ win: null, doc: null, input: new Input(null), app, SCREEN, world: createWorld(1, 1), onPause: noop, getGamepads: () => null, store: null, ...o });
    return { app, c };
  };
  const q = [];
  let open = false;
  const { app } = mount({ defer: (f) => q.push(f), idle: () => open, art: () => Promise.resolve() });
  check("the warm is deferred to idle, not run at mount", q.length === 1 && app.controls.loading);
  q.shift()();
  check("idle comes during PLAY or the show: it defers again and fetches nothing", q.length === 1 && app.controls.loading);
  open = true;
  q.shift()();
  check("idle after the title: the page warms by itself", await until(() => !app.controls.loading) && q.length === 0);
  const q2 = [], m2 = mount({ defer: (f) => q2.push(f), idle: () => true, art: () => Promise.resolve() });
  check("once in, a later mount builds at once and defers nothing", !m2.app.controls.loading && q2.length === 0);
  const F = await import("../src/app/controlswire.js?fail"); // another fresh copy: its paint load fails
  const fa = { screen: SCREEN.CONTROLS, pauseView: 0, ctlT: 0, lastDev: "key", wake: noop, _feel: noop, onControls: () => true, get capturing() { return false; }, ctlBtn: () => false, ctlKey: () => false, back() { this.screen = SCREEN.SETTINGS; return true; } };
  const fc = F.mountControls({ win: null, doc: null, input: new Input(null), app: fa, SCREEN, world: createWorld(1, 1), onPause: noop, getGamepads: () => null, store: null, defer: null, art: () => Promise.reject(new Error("offline")) });
  fa.controls.open("key");
  check("a failed load reads failed, and the page stays out", (await until(() => fa.controls.failed)) && fa.controls.loading);
  fc.tap(null);
  check("after a failed load a canvas tap backs out, so a touch player is never trapped", fa.screen === SCREEN.SETTINGS);
  setHints(null);
}

delete globalThis.window; delete globalThis.location;
console.log("\n  CONTROLSLAZY RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
