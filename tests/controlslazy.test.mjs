/* v202 delivery: the CONTROLS page, its paint and rumble are not in the boot
   graph. This file runs COLD (nothing preloaded, its own process): the door
   opens on a LOADING plate whose inputs are inert, the page lands and works,
   the OPTIONS door and the READY note read the stored level without rumble.js,
   the hello waits for rumble.js, and the idle warm never runs in PLAY or the show. */
import { createGame } from "../src/main.js";
import "../src/core/board3.js";
import { createPixelRenderer } from "../src/render/pixel/renderer.js";
import { SCREEN } from "../src/app/menuapp.js";
import { drawShell, controlsHit, controlsGeo } from "../src/render/shellview.js";
import { Input } from "../src/input.js";
import { createWorld } from "../src/core/sim.js";
import { setHints } from "../src/render/hintcopy.js";
import * as lazyPages from "../src/render/pages/lazy.js";
import * as settingsPage from "../src/render/pages/settings.js";
lazyPages._set("settings", settingsPage); // the lazy SETTINGS page, in as if its import had landed (R20)

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
  a.screen = SCREEN.SETTINGS; a.optRow = a.optRows().indexOf("CONTROLS");
  check("the OPTIONS door still opens CONTROLS", a.confirm() === true && a.screen === SCREEN.CONTROLS && a.onControls());
  const t0 = draw(g);
  check("one frame of the plate: CONTROLS + LOADING, no rows", t0.includes("CONTROLS") && t0.includes("LOADING") && !t0.includes("BOMB"), t0.join("|"));
  check("controlsGeo is null until the paint is in", controlsGeo(null, "2d", false) === null);
  /* fix round 1 (lead ruling on 7b, R1 cohesion 1 as GUIDE / RECORDS): while the LOADING plate is drawn, taps meet ITS geometry: in flight every
     hit is inert ({}), once the load failed (DID NOT LOAD) a tap OFF the plate backs out ({off: 1}) and ON it stays inert; PAUSE view 3 too */
  const v0 = a.controls.view(0), vF = { ...v0, failed: true }, J = JSON.stringify;
  check("while loading the stand-in view says so (loading, not failed)", v0.loading === true && v0.failed === false, J({ l: v0.loading, f: v0.failed }));
  for (const paused of [false, true]) {
    const P = paused ? " (PAUSE view 3)" : "", pts = [];
    for (let y = 0; y < 520; y += 4) for (const x of [4, 150, 300, 450, 596]) pts.push([x, y]);
    const fl = pts.map(([x, y]) => controlsHit(v0, x, y, null, "2d", paused)), fd = pts.map(([x, y]) => controlsHit(vF, x, y, null, "2d", paused));
    check("in flight every hit on and off the LOADING plate is inert ({}), never null, never a back-out" + P, fl.every((h) => h && J(h) === "{}"), J(fl.find((h) => !h || J(h) !== "{}")));
    const on = fd.filter((h) => h && J(h) === "{}").length, off = fd.filter((h) => h && h.off === 1).length;
    check("DID NOT LOAD: off the plate backs out ({off:1}), on it stays inert ({}), nothing else" + P, on > 10 && off > 10 && on + off === pts.length && controlsHit(vF, 300, 260, null, "2d", paused) && J(controlsHit(vF, 300, 260, null, "2d", paused)) === "{}" && controlsHit(vF, 4, 4, null, "2d", paused).off === 1, J({ on, off, n: pts.length }));
  }
  const row0 = a.controls.view(a.ctlT).row;
  const keys = ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Enter", "Space"].map((k) => a.key(k));
  check("keys on the LOADING page do nothing: no move, no tab, no capture", keys.every((r) => !r) && !a.capturing && a.controls.view(a.ctlT).row === row0 && a.ctlTab === "key" && a.screen === SCREEN.CONTROLS, keys.join());
  g.ctl.tap(controlsHit(a.controls.view(0), 4, 4, null, "2d", false));
  g.ctl.tap(controlsHit(a.controls.view(0), 300, 260, null, "2d", false));
  check("a canvas tap on or off the plate is inert while loading (through the real wire)", a.screen === SCREEN.CONTROLS);
  check("the way out stays live: ESC backs out onto the door", a.key("Escape") === true && a.screen === SCREEN.SETTINGS && a.optRow === a.optRows().indexOf("CONTROLS") && a.optLabel() === "CONTROLS");
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
  /* the mismatch (fix round 1): the page's paint in, its reducer not (a loading view), the LOADING plate is what is drawn, so taps meet the plate */
  {
    const vl = { ...a.controls.view(a.ctlT), capture: null }, lv = { ...vl, loading: true, failed: false }, lf = { ...lv, failed: true }, rows = [];
    for (let y = 0; y < 520; y += 4) for (let x = 4; x < 600; x += 16) { const h = controlsHit(vl, x, y, null, "2d", false); if (h && h.row != null && controlsHit(lf, x, y, null, "2d", false).off === 1) rows.push([x, y]); }
    check("paint in, reducer not: a point on a real row but off the LOADING plate is inert in flight, a back-out once failed (the plate's geometry, never the page's)", rows.length > 0 && rows.every(([x, y]) => JSON.stringify(controlsHit(lv, x, y, null, "2d", false)) === "{}"), rows.length);
    check("paint in, reducer not: the LOADING plate's centre stays inert even once failed", JSON.stringify(controlsHit(lf, 300, 260, null, "2d", false)) === "{}");
  }
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
  check("the OPTIONS door reads VIBRATION MEDIUM (its › the door's chevron) without rumble.js", draw(g).includes("VIBRATION MEDIUM"));
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
  const WL = {}, fwin = { addEventListener: (t, f) => { WL[t] = f; }, removeEventListener: noop };
  const vp = () => WL.pointerdown({ pointerType: "mouse", button: 0, target: { closest: () => null } }); // a click in the viewport, off the canvas
  let artGo = null;
  const fc = F.mountControls({ win: fwin, doc: null, input: new Input(null), app: fa, SCREEN, world: createWorld(1, 1), onPause: noop, getGamepads: () => null, store: null, defer: null, art: () => new Promise((ok, no) => { artGo = no; }) });
  fa.controls.open("key");
  check("in flight the stand-in view reads loading, not failed", fa.controls.view(0).loading === true && fa.controls.view(0).failed === false);
  vp();
  fc.tap(controlsHit(fa.controls.view(0), 4, 4, null, "2d", false));
  check("in flight a viewport click off the canvas and a canvas tap off the plate are both inert (R1 cohesion 1)", fa.screen === SCREEN.CONTROLS);
  artGo(new Error("offline"));
  check("a failed load reads failed, and the page stays out", (await until(() => fa.controls.failed)) && fa.controls.loading && fa.controls.view(0).failed === true);
  fc.tap(controlsHit(fa.controls.view(0), 300, 260, null, "2d", false));
  check("after a failed load a tap ON the DID NOT LOAD plate stays inert", fa.screen === SCREEN.CONTROLS);
  fc.tap(null);
  check("a hit of nothing (null) is inert", fa.screen === SCREEN.CONTROLS);
  fc.tap(controlsHit(fa.controls.view(0), 4, 4, null, "2d", false));
  check("after a failed load a tap OFF the plate backs out, so a touch or mouse player is never trapped", fa.screen === SCREEN.SETTINGS);
  fa.screen = SCREEN.CONTROLS;
  vp();
  check("after a failed load a viewport click off the canvas backs out too", fa.screen === SCREEN.SETTINGS);
  setHints(null);
}

// ---- 4. delivery review 7: a failed rumble.js load retries on the next controller press, or when CONTROLS opens; never on a quiet poll ----
{
  const stub = (screen) => ({ screen, pauseView: 0, ctlT: 0, lastDev: "key", introStage: 0, padCards: [], feel: "", wake: noop, _feel: noop, onControls: () => false,
    get capturing() { return false; }, ctlBtn: () => false, ctlKey: () => false, back() { this.screen = SCREEN.SETTINGS; return true; } });
  const rig = (W, fails) => {
    let n = 0;
    const calls = [], p = mkPad(calls), app = stub(SCREEN.MENU);
    const importRumble = () => (++n <= fails ? Promise.reject(new Error("offline")) : import("../src/app/rumble.js"));
    const c = W.mountControls({ win: null, doc: null, input: new Input(null), app, SCREEN, world: createWorld(1, 1), onPause: noop, getGamepads: () => [p], store: null, defer: null, art: () => Promise.resolve(), importRumble });
    let t = 0;
    return { app, c, p, calls, n: () => n, poll: () => c.poll((t += 1000 / 60)) };
  };
  const A = rig(await import("../src/app/controlswire.js?rumble"), 1);
  A.poll(); // the pad is found: the first load, which fails
  await sleep(1);
  check("rumble: the first controller seen asks for rumble.js once", A.n() === 1, A.n());
  for (let i = 0; i < 5; i++) A.poll();
  await sleep(1);
  check("rumble: a failed load is not retried on a quiet poll", A.n() === 1, A.n());
  A.p.set("N", true); A.poll(); A.p.set("N", false); A.poll();
  check("rumble: the next controller press retries it", A.n() === 2, A.n());
  await sleep(1);
  A.p.set("N", true); A.poll(); A.p.set("N", false); A.poll();
  check("rumble: once in, a press asks for nothing more", A.n() === 2, A.n());
  const B = rig(await import("../src/app/controlswire.js?rumble2"), 1);
  B.poll();
  await sleep(1);
  B.app.screen = SCREEN.CONTROLS; B.app.onControls = () => true;
  B.app.controls.open("pad");
  check("rumble: opening CONTROLS with a controller in retries a failed load (the VIBRATION test buzz needs it)", B.n() === 2, B.n());
  const C = rig(await import("../src/app/controlswire.js?rumble3"), 1);
  C.app.controls.open("key");
  check("rumble: opening CONTROLS with no controller seen asks for nothing", C.n() === 0, C.n());
  setHints(null);
}

delete globalThis.window; delete globalThis.location;
console.log("\n  CONTROLSLAZY RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
