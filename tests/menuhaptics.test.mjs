/* Menu feels (spec .superpowers/sdd/notes/v201-controls-build/menu-haptics/spec.md):
   one feel a poll, through the real createGame, mountControls and rumble with a
   fake pad whose actuator records every call. The calls are read back into feel
   names from the live PATTERNS, so level gating, priority drops and the stop
   before PAUSE's enter are the engine's own. Each feel() moves the poll clock
   past the rolling caps, so one feel never starves the next check. */
import { createGame } from "../src/main.js";
import "../src/core/board3.js";
import { createPixelRenderer } from "../src/render/pixel/renderer.js";
import { SCREEN, PAUSE_ITEMS, OPT_ROWS, ITEMS } from "../src/app/menuapp.js";
import { GFX_KEYS } from "../src/app/gfx.js";
import { LIMITS, PATTERNS, scaleMag } from "../src/app/rumble.js";
import { DEF_CONTROLS } from "../src/app/controls.js";
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

const IDX = { S: 0, E: 1, W: 2, N: 3, SHL: 4, SHR: 5, TRL: 6, TRR: 7, SELECT: 8, START: 9, dU: 12, dD: 13, dL: 14, dR: 15 };
const MENU_FEELS = ["launch", "enter", "deny", "back", "confirm", "move", "hello"];
const near = (a, b) => Math.abs(a - b) < 1e-6;
/* The calls a feel makes at a level: the first with its exact duration (a following pulse adds LIMITS.over), the rest by magnitude, since a late frame may shorten them. */
const sig = (name, lv) => {
  const st = PATTERNS[name].steps, out = [];
  st.forEach((x, i) => { if (!x.gap) out.push({ ms: x.ms + (st[i + 1] && !st[i + 1].gap ? LIMITS.over : 0), w: scaleMag(x.weak, lv), s: scaleMag(x.strong, lv) }); });
  return out;
};
/* Reads recorded calls back into feel names; anything else (a reset, a gameplay pattern) is skipped. */
function decode(calls, lv) {
  const xs = calls.filter((q) => q !== "reset"), out = [];
  for (let i = 0; i < xs.length;) {
    let best = null;
    for (const n of MENU_FEELS) {
      const sg = sig(n, lv);
      const ok = sg.every((e, k) => xs[i + k] && near(xs[i + k].weakMagnitude, e.w) && near(xs[i + k].strongMagnitude, e.s) && (k > 0 || near(xs[i].duration, e.ms)));
      if (ok && (!best || sg.length > best[1])) best = [n, sg.length];
    }
    if (best) { out.push(best[0]); i += best[1]; } else i++;
  }
  return out;
}
const mkPad = (calls) => {
  const p = { connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  p.set = (id, on) => { const b = p.buttons[IDX[id]]; b.pressed = on; b.value = on ? 1 : 0; };
  p.vibrationActuator = { playEffect: (ty, q) => { calls.push(q); return Promise.resolve(); }, reset: () => { calls.push("reset"); return Promise.resolve(); } };
  return p;
};
function mk(o = {}) {
  for (const k in L) delete L[k];
  setHints(null);
  const calls = [], lv = o.vib === undefined ? 2 : o.vib;
  if (o.vib !== undefined) mem["nb.controls.v1"] = JSON.stringify({ v: 1, key: DEF_CONTROLS.key, pad: DEF_CONTROLS.pad, stick: "L", dead: 25, rumble: lv > 0 ? 1 : 0, vib: lv });
  else delete mem["nb.controls.v1"];
  const rig = { list: [o.noPad ? null : mkPad(calls)] };
  const g = createGame(null, { seed: 42, createPixelRenderer, getGamepads: () => rig.list, ...o });
  g.pad = rig.list[0]; g.gpr = rig; g.calls = calls; g.t = 0; g.off = 0;
  g.newPad = () => mkPad(calls);
  g.log = { get length() { return decode(calls, lv).length; }, set length(n) { calls.length = n; }, join: () => decode(calls, lv).join() };
  g.tick = (n = 1) => { for (let i = 0; i < n; i++) { g.t += 1000 / 60; g.ctl.poll(g.t + g.off); g.loop(g.t); } };
  g.tick();
  return g;
}
const tap = (g, id, hold = 3) => { g.pad.set(id, true); g.tick(hold); g.pad.set(id, false); g.tick(8); };
const menu = (o) => { const g = mk(o); g.tick(30); tap(g, "S"); g.tick(15); tap(g, "S"); g.log.length = 0; return g; };
const run = (o) => { const g = menu(o); tap(g, "S"); g.tick(10); g.log.length = 0; return g; };
const feel = (g, f) => { g.off += 11000; g.log.length = 0; f(); g.tick(10); return g.log.join(); };
const kd = (code) => (L.keydown || []).forEach((f) => f({ code, key: code, repeat: false, preventDefault: noop }));
const ku = (code) => (L.keyup || []).forEach((f) => f({ code, key: code, preventDefault: noop }));
const at = (g, label) => { g.app.cursor = ITEMS.indexOf(label); g.tick(2); };

// ---- hello and the title ----
{
  const g = mk();
  check("a pad already there on the title: hello, regardless of lastDev", g.log.join() === "hello", g.log.join());
  g.log.length = 0;
  tap(g, "S");
  check("a title press right after hello: the show starts, no second feel", g.app.introStage === 1 && g.log.length === 0, g.log.join());
  const h = mk();
  h.tick(30);
  const f = feel(h, () => tap(h, "S"));
  check("title press: introStage 0 -> 1 is one enter", h.app.introStage === 1 && f === "enter", f);
  h.tick(15);
  const s = feel(h, () => tap(h, "S"));
  check("a pad press skipping the show to MENU: enter", h.app.screen === SCREEN.MENU && s === "enter", s);
  const k = mk(); k.tick(30); k.log.length = 0;
  k.app.lastDev = "key"; k.app.beginShow(); k.tick(4);
  check("a show started off the pad: nothing", k.app.introStage === 1 && k.log.length === 0, k.log.join());
}
{
  const g = mk({ noPad: true });
  g.app.screen = SCREEN.MENU; g.tick(2);
  g.gpr.list = [g.newPad()]; g.tick(2);
  check("a pad connecting on MENU: hello", g.log.join() === "hello", g.log.join());
  const h = run();
  h.gpr.list = [null]; h.tick(2); h.world.state = "PLAY"; h.tick(2); // a lost pad pauses only a pad run: resume by hand
  h.gpr.list = [h.newPad()]; h.log.length = 0; h.tick(2);
  check("a pad connecting in GAME PLAY: no hello", h.app.screen === SCREEN.GAME && h.world.state === "PLAY" && h.log.length === 0, h.log.join());
}

// ---- launch ----
{
  const g = menu();
  at(g, "PLAY");
  const f = feel(g, () => tap(g, "S"));
  check("MENU PLAY: launch, once", g.app.screen === SCREEN.GAME && f === "launch", f);
  const d = menu(); at(d, "DAILY");
  const fd = feel(d, () => tap(d, "S"));
  check("MENU DAILY: launch", d.app.screen === SCREEN.GAME && fd === "launch", fd);
  const l = menu(); at(l, "LEVEL SELECT");
  const fe = feel(l, () => tap(l, "S"));
  check("MENU -> LEVEL SELECT: enter", l.app.screen === SCREEN.LEVEL && fe === "enter", fe);
  const fl = feel(l, () => tap(l, "S"));
  check("LEVEL SELECT START: launch", l.app.screen === SCREEN.GAME && fl === "launch", fl);
  const a = menu(); a.app.enterAttract(); a.tick(2);
  const fa = feel(a, () => tap(a, "S"));
  check("ATTRACT left by a pad press into a run: launch", a.app.screen === SCREEN.GAME && fa === "launch", fa);
  const b = menu(); b.app.enterAttract(); b.tick(2);
  const fb = feel(b, () => tap(b, "E"));
  check("ATTRACT left by EAST to MENU: back", b.app.screen === SCREEN.MENU && fb === "back", fb);
}

// ---- PAUSE ----
{
  const g = run();
  let f = feel(g, () => tap(g, "START"));
  check("PAUSE opened by START: enter (after the PAUSE stop)", g.world.state === "PAUSE" && f === "enter", f);
  const ri = g.calls.indexOf("reset"), ei = g.calls.findIndex((q) => q !== "reset");
  check("the PAUSE stop's reset comes first, then enter plays", ri >= 0 && ei > ri, JSON.stringify(g.calls));
  f = feel(g, () => tap(g, "S"));
  check("RESUME: back, once", g.world.state === "PLAY" && f === "back", f);
  tap(g, "START"); g.app.pauseCursor = PAUSE_ITEMS.indexOf("RESTART"); g.tick(2);
  const grid = g.world.grid;
  f = feel(g, () => tap(g, "S"));
  check("PAUSE RESTART: launch, once", g.world.state === "PLAY" && g.world.grid !== grid && f === "launch", f);
  tap(g, "START"); g.app.pauseCursor = PAUSE_ITEMS.indexOf("OPTIONS"); g.tick(2);
  f = feel(g, () => tap(g, "S"));
  check("PAUSE list -> OPTIONS view: enter", g.app.pauseView === 1 && f === "enter", f);
  f = feel(g, () => tap(g, "E"));
  check("OPTIONS view back to the list: back", g.app.pauseView === 0 && g.world.state === "PAUSE" && f === "back", f);
  f = feel(g, () => tap(g, "E"));
  check("EAST on the PAUSE list resumes: back", g.world.state === "PLAY" && f === "back", f);
  tap(g, "START"); g.app.pauseCursor = PAUSE_ITEMS.indexOf("QUIT TO MENU"); g.tick(2);
  f = feel(g, () => tap(g, "S"));
  check("QUIT TO MENU: back", g.app.screen === SCREEN.MENU && f === "back", f);
}

// ---- run end back to PLAY ----
{
  const g = run();
  g.world.state = "WIN"; g.tick(2); g.log.length = 0;
  const lv = g.world.level;
  const f = feel(g, () => tap(g, "S"));
  check("a pad press taking WIN to the next room: launch, once", g.world.state === "PLAY" && g.world.level === lv + 1 && f === "launch", f);
  g.world.state = "LOSE"; g.tick(2);
  const fl = feel(g, () => tap(g, "S"));
  check("a pad press taking LOSE to a new run: launch", g.world.state === "PLAY" && g.world.level === 1 && fl === "launch", fl);
  g.world.state = "WIN"; g.tick(2); g.log.length = 0;
  g.app.lastDev = "key"; kd("Enter"); g.tick(1); ku("Enter"); g.tick(10);
  check("the same with the keyboard: nothing", g.world.state === "PLAY" && g.log.length === 0, g.log.join());
}

// ---- pages, confirm, move ----
{
  const g = menu();
  at(g, "OPTIONS");
  let f = feel(g, () => tap(g, "S"));
  check("MENU -> OPTIONS: enter", g.app.screen === SCREEN.SETTINGS && f === "enter", f);
  g.app.optRow = OPT_ROWS.indexOf("GRAPHICS"); g.tick(2);
  f = feel(g, () => tap(g, "S"));
  check("OPTIONS -> GRAPHICS: enter", g.app.screen === SCREEN.GRAPHICS && f === "enter", f);
  f = feel(g, () => tap(g, "E"));
  check("GRAPHICS -> OPTIONS: back", g.app.screen === SCREEN.SETTINGS && f === "back", f);
  g.app.optRow = OPT_ROWS.indexOf("REDUCE FLASH"); g.tick(2);
  f = feel(g, () => tap(g, "S"));
  check("Enter that writes a value on the same page: confirm", g.app.screen === SCREEN.SETTINGS && f === "confirm", f);
  g.app.optRow = OPT_ROWS.indexOf("MUSIC"); g.tick(10);
  f = feel(g, () => tap(g, "dL"));
  check("←→ that writes an OPTIONS value: confirm", f === "confirm", f);
  f = feel(g, () => tap(g, "dD"));
  check("a real cursor change: move", g.app.optRow === 1 && f === "move", f);
  g.app.optRow = OPT_ROWS.indexOf("CAMERA"); g.tick(10);
  f = feel(g, () => tap(g, "S"));
  check("a dimmed 3D-only OPTIONS row (no reason painted): nothing", g.app.screen === SCREEN.SETTINGS && f === "", f);
  g.app.optRow = OPT_ROWS.indexOf("SCREEN SHAKE"); g.app.settings.shk = 1; g.tick(10);
  f = feel(g, () => tap(g, "dL"));
  const f2 = feel(g, () => tap(g, "dL"));
  check("a clamped edge is silent", f === "confirm" && f2 === "", f + "|" + f2);
  const h = menu(); at(h, "GUIDE");
  f = feel(h, () => tap(h, "S"));
  check("MENU -> GUIDE: enter", h.app.screen === SCREEN.GUIDE && f === "enter", f);
  f = feel(h, () => tap(h, "S"));
  check("GUIDE -> HOW TO: enter", h.app.screen === SCREEN.HOWTO && f === "enter", f);
  f = feel(h, () => tap(h, "S"));
  check("SOUTH on a read-only page backs out: back", h.app.screen === SCREEN.GUIDE && f === "back", f);
  const s = menu(); at(s, "STATS"); tap(s, "S");
  f = feel(s, () => tap(s, "N"));
  check("STATS -> MEDALS by NORTH: enter", s.app.screen === SCREEN.TROPHIES && f === "enter", f);
}
{
  const g = menu(); at(g, "LEVEL SELECT"); tap(g, "S");
  let f = feel(g, () => tap(g, "SHR"));
  check("a shoulder on LEVEL SELECT changes PACE: confirm", f === "confirm", f);
  g.app.level = 1; g.tick(2);
  f = feel(g, () => tap(g, "dL"));
  check("room 1 and ← : clamped, silent", g.app.level === 1 && f === "", f);
  g.app.pactUnlocked = true; g.tick(2);
  f = feel(g, () => tap(g, "TRR"));
  check("a trigger walks MODES: move", g.app.modeCur === 0 && f === "move", f);
  f = feel(g, () => tap(g, "N"));
  check("NORTH toggles the mode: confirm", g.app.pact !== 0 && f === "confirm", f);
}

// ---- deny, and refusals that show nothing ----
{
  const g = menu(); at(g, "OPTIONS"); tap(g, "S");
  g.app.optRow = OPT_ROWS.indexOf("ANALYTICS"); g.tick(2);
  let f = feel(g, () => tap(g, "S"));
  check("ANALYTICS on a pad before the card is answered: deny", g.app.anaNote !== "" && f === "deny", f);
  f = feel(g, () => tap(g, "dR"));
  check("and ←→ there: deny", g.app.analytics === false && f === "deny", f);
  g.app.optRow = OPT_ROWS.indexOf("GRAPHICS"); g.tick(2); tap(g, "S");
  g.app.gfxRow = GFX_KEYS.indexOf("res"); g.tick(2);
  f = feel(g, () => tap(g, "S"));
  check("a locked GRAPHICS row in CLASSIC: deny", g.app.gfxView().rows[g.app.gfxRow].locked && f === "deny", f);
}
{
  const g = menu(); at(g, "OPTIONS"); tap(g, "S");
  g.app.optRow = OPT_ROWS.indexOf("CONTROLS"); g.tick(2);
  let f = feel(g, () => tap(g, "S"));
  check("OPTIONS -> CONTROLS: enter", g.app.screen === SCREEN.CONTROLS && f === "enter", f);
  g.app.controls.tab("key"); g.app.controls.pick(5); g.tick(2);
  f = feel(g, () => tap(g, "S"));
  check("the fixed CONFIRM row on the keyboard tab: deny", g.app.controls.view(g.app.ctlT).status !== "" && f === "deny", f);
  g.app.controls.tab("pad"); g.app.controls.pick(1); g.tick(2);
  f = feel(g, () => tap(g, "S"));
  check("Enter on BOMB opens a capture: confirm", g.app.capturing && f === "confirm", f);
  g.tick(20);
  f = feel(g, () => tap(g, "dU"));
  check("a refused D-PAD in the capture: deny", g.app.capturing && g.app.controls.view(g.app.ctlT).capture.warn === 1 && f === "deny", f);
  g.tick(20);
  f = feel(g, () => tap(g, "N"));
  check("a capture commit: confirm", !g.app.capturing && g.app.controls.view(g.app.ctlT).binds.BOMB === "N" && f === "confirm", f);
  g.app.controls.pick(1); g.tick(2); tap(g, "S"); g.tick(20);
  f = feel(g, () => tap(g, "START"));
  check("START cancels the capture: back", !g.app.capturing && g.app.screen === SCREEN.CONTROLS && f === "back", f);
  f = feel(g, () => tap(g, "E"));
  check("EAST leaves CONTROLS: back", g.app.screen === SCREEN.SETTINGS && f === "back", f);
}

// ---- the slow board, the waiting hello, the levels ----
{
  const g = mk(); g.tick(30);
  g.app.boardReady = false; g.tick(2);
  const f = feel(g, () => tap(g, "S"));
  check("a board still loading: the press marks the show pending and buzzes enter once, on the press", g.app._showPending && g.app.introStage === 0 && f === "enter", f);
  g.app.boardReady = true;
  const f2 = feel(g, () => g.tick(10));
  check("and the show beginning later adds nothing", g.app.introStage === 1 && f2 === "", f2);
}
{
  const g = mk({ noPad: true }); g.tick(30);
  g.app.beginShow(); g.tick(20);
  g.off += 11000; g.log.length = 0;
  const p = g.newPad(); p.set("S", true); g.gpr.list = [p]; g.tick(2); p.set("S", false); g.tick(40);
  check("a pad found by the press that skips the show: enter first, hello waits for a free poll", g.app.screen === SCREEN.MENU && g.log.join() === "enter,hello", g.log.join());
}
{
  const low = menu({ vib: 1 });
  at(low, "OPTIONS");
  const f = feel(low, () => { tap(low, "dD"); tap(low, "S"); tap(low, "E"); });
  check("LOW: no menu feel at all", low.app.screen === SCREEN.MENU && f === "" && low.calls.length === 0, JSON.stringify(low.calls));
  const off = mk({ vib: 0 }); off.tick(30); tap(off, "S"); off.tick(15); tap(off, "S"); tap(off, "S");
  check("OFF: zero calls from the title to a run", off.app.screen === SCREEN.GAME && off.calls.length === 0, off.calls.length);
  delete mem["nb.controls.v1"];
}

// ---- never ----
{
  const g = menu();
  g.app.lastDev = "key";
  const f = feel(g, () => { kd("ArrowDown"); g.tick(1); ku("ArrowDown"); g.tick(1); kd("Enter"); g.tick(1); ku("Enter"); });
  check("keyboard presses: nothing", g.app.screen !== SCREEN.MENU && g.log.length === 0, f);
  const h = menu();
  const r = feel(h, () => { h.pad.set("dD", true); h.tick(90); h.pad.set("dD", false); });
  check("a hold repeat: the first step's move only", r === "move", r);
  const q = menu();
  const two = feel(q, () => { q.pad.set("dD", true); q.tick(1); q.pad.set("dD", false); q.tick(1); q.pad.set("dU", true); q.tick(1); q.pad.set("dU", false); });
  check("two moves inside 100 ms: one move", two === "move", two);
  const o = menu(); at(o, "OPTIONS");
  const ef = feel(o, () => { o.pad.set("dD", true); o.tick(1); o.pad.set("dD", false); o.tick(1); at(o, "OPTIONS"); o.pad.set("S", true); o.tick(1); o.pad.set("S", false); });
  check("TICK_GAP never holds back an enter", o.app.screen === SCREEN.SETTINGS && ef === "move,enter", ef);
  const p = run();
  const pf = feel(p, () => { p.pad.set("dR", true); p.tick(30); p.pad.set("dR", false); p.pad.set("S", true); p.tick(2); p.pad.set("S", false); });
  check("GAME PLAY: walking and planting feel nothing here", p.world.state === "PLAY" && pf === "", pf);
}

delete globalThis.window; delete globalThis.location;
console.log("\n  MENUHAPTICS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
