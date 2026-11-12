/* CONTROLS accessibility (plan T13, a11y notes R6 and R7): the one live region,
   the colour gate over the page's real palette, and a shape and a word for each state. */
import { readFileSync } from "node:fs";
import { createGame } from "../src/main.js";
import { loadControlsArt } from "../src/render/shellview.js";
import "../src/core/board3.js";
import { createPixelRenderer } from "../src/render/pixel/renderer.js";
import { SCREEN } from "../src/app/menuapp.js";
import { mountControls, preloadControls } from "../src/app/controlswire.js";
import { DEF_KEY, DEF_PAD } from "../src/render/controlsgeo.js";
import { drawControlsPage, _dbg as pageDbg } from "../src/render/pages/controls.js";
import { worldTokens, CONST } from "../src/render/kit/tokens.js";
import { rec } from "./lib/textrec.mjs";
import { dE, rgbOf, simRGB } from "../tools/tileart/gatefns.mjs";
await preloadControls(loadControlsArt); // the CONTROLS page, its paint and rumble are lazy (v202): in before the first mount

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const noop = () => {};

// ---- the region in index.html ----
{
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const live = [...html.matchAll(/<[a-z]+\b[^>]*aria-live=[^>]*>/g)].map((m) => m[0]), tag = live.find((t) => /id="ctlsay"/.test(t));
  check("two aria-live elements in the markup: the CONTROLS region and the loader's stage status", live.length === 2 && live.some((t) => /id="loadsay"/.test(t)), live.join(" "));
  check("the live region exists once", html.split('id="ctlsay"').length === 2);
  check("it is polite", !!tag && /aria-live="polite"/.test(tag), tag);
  check("it is read as one line", !!tag && /aria-atomic="true"/.test(tag));
  check("it is sr-only, with no display rule that could hide it from a reader", !!tag && /class="sr-only"/.test(tag) && !/\bhidden\b/.test(tag) && !/#ctlsay/.test(html));
  const wrap = html.indexOf('<div id="wrap"'), between = html.slice(wrap, html.lastIndexOf("<div", html.indexOf('id="ctlsay"')));
  const depth = between.split("<div").length - between.split("</div>").length;
  check("it sits outside #wrap, which stays hidden until the title paints", wrap > 0 && depth === 0, depth);
}

// ---- the sink, on the real shell ----
const L = {}, mem = {};
globalThis.window = {
  addEventListener: (ty, fn) => { (L[ty] = L[ty] || []).push(fn); },
  removeEventListener: noop, innerWidth: 1440, innerHeight: 900,
  localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } },
  open: noop,
};
globalThis.location = { search: "", reload: noop };
const IDX = { S: 0, E: 1, N: 3, START: 9 };
const mkPad = () => {
  const p = { connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  p.set = (id, on) => { const b = p.buttons[IDX[id]]; b.pressed = on; b.value = on ? 1 : 0; };
  return p;
};
const region = () => {
  let text = "";
  const log = [];
  return { log, get textContent() { return text; }, set textContent(s) { text = s; log.push(s); } };
};
function mk() {
  for (const k in L) delete L[k];
  for (const k in mem) delete mem[k];
  const el = region(), pad = mkPad();
  globalThis.document = { getElementById: (id) => (id === "ctlsay" ? el : null), addEventListener: noop, body: { dataset: { lay: "d" } } };
  const g = createGame(null, { seed: 42, createPixelRenderer, getGamepads: () => [pad] });
  delete globalThis.document;
  g.el = el; g.t = 0;
  g.tick = (n = 1) => { for (let i = 0; i < n; i++) { g.t += 1000 / 60; g.ctl.poll(g.t); g.loop(g.t); } };
  g.btn = (id) => { pad.set(id, true); g.tick(3); pad.set(id, false); g.tick(2); };
  g.key = (code, key) => {
    for (const f of L.keydown) f({ code, key: key || code, repeat: false, preventDefault: noop, stopPropagation: noop });
    g.tick(2);
    for (const f of L.keyup) f({ code, key: key || code, preventDefault: noop });
    g.tick(16);
  };
  g.tick();
  g.btn("S"); g.tick(15); g.btn("S");
  return g;
}
const openPage = (g) => { g.app._push(SCREEN.SETTINGS); g.app.optRow = g.app.optRows().indexOf("CONTROLS"); g.app.confirm(); g.tick(16); };
{
  const g = mk();
  check("the shell reached the menu", g.app.screen === SCREEN.MENU, g.app.screen);
  check("nothing written before the page opens", g.el.log.length === 0, g.el.log.join("|"));
  g.app.lastDev = "key";
  openPage(g);
  check("page open is said", g.app.screen === SCREEN.CONTROLS && g.el.textContent === "Controls, keyboard.", g.el.textContent);
  g.key("ArrowDown");
  check("a row move is said", g.el.textContent === "Throw, E. 3 of 8.", g.el.textContent);
  const quiet = g.el.log.length;
  g.tick(120);
  check("an idle page writes nothing", g.el.log.length === quiet);
  g.key("Enter");
  const v = g.app.controls.view(g.app.ctlT);
  check("capture start is said, in the plate's own words", v.capture && g.el.textContent === v.capture.prompt + " for THROW.", g.el.textContent);
  g.key("KeyR", "r");
  const why = g.app.controls.view(g.app.ctlT).capture.sub;
  check("a refusal is said, the plate's line", g.el.textContent === why && /PICK ANOTHER/.test(why), g.el.textContent);
  const n = g.el.log.length;
  g.key("KeyR", "r");
  check("the same refusal twice is a new write, or a reader stays silent", g.el.log.length === n + 1 && g.el.textContent !== why && g.el.textContent.trim() === why, JSON.stringify(g.el.textContent));
  g.key("KeyZ", "z");
  const line = g.app.controls.view(g.app.ctlT).status;
  check("a capture result is said, the status line", g.app.capturing === false && line.length > 0 && g.el.textContent.trim() === line, g.el.textContent);
  g.key("Enter");
  g.key("KeyQ", "q");
  const sw = g.app.controls.view(g.app.ctlT);
  check("a conflict is said: the key, the action it left, and where that action went", !!sw.swap && g.el.textContent === sw.status && /Q WAS REMOTE/.test(sw.status) && /REMOTE NOW Z/.test(sw.status), g.el.textContent);
  g.key("Enter");
  g.key("Escape");
  check("a cancel is said", /^CANCELLED/.test(g.el.textContent), g.el.textContent);
  g.key("Escape");
  check("leaving the page empties the region", g.app.screen === SCREEN.SETTINGS && g.el.textContent === "", JSON.stringify(g.el.textContent));
}
{
  const g = mk();
  g.btn("S");
  check("a run is live", g.app.screen === SCREEN.GAME && g.world.state === "PLAY", g.world.state);
  const n = g.el.log.length;
  g.app.controls.walk(1, 0);
  g.app.controls.open("key");
  g.btn("S"); g.btn("N"); g.key("Space", " "); g.key("KeyE", "e"); g.tick(30);
  check("say is silent in PLAY, even if the page is called", g.el.log.length === n && g.el.textContent === "", g.el.log.join("|"));
  g.btn("START");
  check("PAUSE", g.world.state === "PAUSE", g.world.state);
  check("the PAUSE list writes nothing", g.el.log.length === n);
  g.app._ctlOpen();
  check("the inline page in PAUSE speaks", g.app.pauseView === 3 && g.el.log.length === n + 1 && /^Controls/.test(g.el.textContent), g.el.textContent);
  g.key("Escape");
  g.tick(2);
  check("leaving the inline page empties the region", g.app.pauseView !== 3 && g.el.textContent === "", JSON.stringify(g.el.textContent));
  const m = g.el.log.length;
  g.app.pauseView = 0;
  g.btn("START");
  g.btn("S"); g.tick(30);
  check("back in PLAY, still silent", g.world.state === "PLAY" && g.el.log.length === m, g.el.log.join("|"));
}
{
  const app = { screen: SCREEN.CONTROLS, onControls: () => true, ctlT: 0, ctlKey: noop };
  const inp = { setKeyBinds: noop };
  const c = mountControls({ win: null, doc: { getElementById: () => null, addEventListener: noop }, input: inp, app, SCREEN, world: { state: "PLAY", players: [] }, onPause: noop, getGamepads: () => null, store: null });
  let threw = false;
  try { app.controls.open("key"); c.poll(0); } catch (_) { threw = true; }
  check("a page with no region does not crash", !threw);
  c.dispose();
}

// ---- the colour gate: the page's real palette (the world kit, Task 6.3: every world's tokens) ----
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const R = rgbOf;
for (let lv = 1; lv <= 8; lv++) {
  const t = worldTokens(lv), nm = " (world " + lv + ")";
  for (const [n, f, b, floor] of [["row label ink on the bed", CONST.ink, t.bedA, 4.5], ["row label ink on the focus band", CONST.ink, t.band, 4.5], ["a value word t2 on the bed", CONST.t2, t.bedA, 4.5],
    ["RESET coral on the bed", CONST.cor, t.bedA, 4.5], ["a key legend ink on its key", CONST.ink, t.key, 4.5], ["the open tab's dark ink on the brick", CONST.dk, t.lit, 4.5], ["a closed tab's t2 in its well", CONST.t2, t.well, 4.5],
    ["the FIXED plaque's off ink on its dark outline", CONST.off, CONST.ol, 3]]) { const v = cr(R(f), R(b)); check(n + nm + " >= " + floor, v >= floor, v.toFixed(2)); }
}
for (const k of ["protan", "deutan"]) {
  const v = dE(simRGB(R(CONST.cor), k), simRGB(R(CONST.ink), k));
  check("coral (RESET) vs cream (a row), " + k + ": Lab dE >= 30", v >= 30, v.toFixed(1));
}

// ---- every state has a shape and a word (the world kit page, Task 6.3) ----
const keyV = (o) => ({ tab: "key", device: "key", row: 1, pad: { state: "none" }, key: DEF_KEY, binds: DEF_PAD, stick: "L", dead: 25, vib: 0, stickVal: [0, 0], armed: false, swap: null, status: "", capture: null, echo: null, ...o });
const padV = (o) => keyV({ tab: "pad", device: "pad", pad: { state: "ready", name: "CONTROLLER 1", rumble: true }, ...o });
const DESK = { W: 1366, H: 768 };
const paint = (v, F = DESK) => { const r = rec(); drawControlsPage(r.ctx, F, v, { level: 1, tap: false }); return r; };
const has = (r, s) => r.texts.some((t) => t.s === s);
const words = (r) => r.texts.map((t) => t.s).join(" ");
{
  const tok = worldTokens(1), on = paint(keyV({ row: 2 })), G = pageDbg.last.G, g = G.rows.THROW;
  check("Selected: the band on the focused row, the bare bomb, the label in ink", on.paints.some((q) => q.style === tok.band && q.box && Math.abs(q.box.y - g.y) < 1 && Math.abs(q.box.h - g.h) < 1) && on.texts.some((t) => t.s === "THROW" && t.fill === CONST.ink));

  const cap = (o, v = keyV) => paint(v({ row: 2, capture: { action: "THROW", prompt: "PRESS A KEY", sub: "NOW E", foot: "ESC CANCELS", ...o } }));
  const lis = cap({});
  check("Listening: the prompt for the action in the pane, the prompt on its row, the cancel words label first", has(lis, "PRESS A KEY FOR THROW") && has(lis, "PRESS A KEY") && has(lis, "CANCELS") && has(lis, "ESC") && has(lis, "NO TIME LIMIT"));
  const src = readFileSync(new URL("../src/render/pages/controls.js", import.meta.url), "utf8");
  check("Listening is static: the paint reads no clock", !/performance\.now|Date\b|setTimeout|setInterval/.test(src));
  check("Refused: the why in words", words(cap({ sub: "R IS THE CAMERA · PICK ANOTHER", warn: 1 })).includes("R IS THE CAMERA · PICK ANOTHER"));

  const a = paint(padV({ row: 1, swap: { row: "REMOTE" }, status: "EAST WAS REMOTE · REMOTE NOW SOUTH" })), b = paint(padV({ row: 1 }));
  check("Conflict: SWAPPED on the row and the line that says where it went", has(a, "SWAPPED") && !has(b, "SWAPPED") && words(a).includes("EAST WAS REMOTE · REMOTE NOW SOUTH"));

  const fx = paint(keyV({ row: 5 }));
  check("Fixed: the FIXED plaque on CONFIRM and BACK, the rows never dimmed (their labels in ink)", fx.texts.filter((t) => t.s === "FIXED").length >= 2 && ["CONFIRM", "BACK"].every((s) => fx.texts.some((t) => t.s === s && t.fill === CONST.ink)));

  const ch = paint(keyV({ row: 2, key: { ...DEF_KEY, THROW: "KeyZ" } }));
  check("Changed: a dot by the label, and the word", ch.paints.some((q) => q.op === "fill" && q.style === CONST.ink) && words(ch).includes("CHANGED"));
  check("Unchanged: neither word", !words(paint(keyV({ row: 2 }))).includes("CHANGED"));

  const na = paint(padV({ row: 6, pad: { state: "ready", name: "x", rumble: false } }));
  check("Not available: NONE, and the words", has(na, "NONE") && words(na).includes("NO VIBRATION ON THIS CONTROLLER OR BROWSER"));

  const ar = paint(keyV({ row: 7, armed: true }));
  check("Armed reset: PRESS AGAIN in coral, and the line", ar.texts.some((t) => t.s === "PRESS AGAIN" && t.fill === CONST.cor) && words(ar).includes("PRESS AGAIN TO RESET THIS TAB"));
}

console.log("\n  CONTROLS A11Y RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
