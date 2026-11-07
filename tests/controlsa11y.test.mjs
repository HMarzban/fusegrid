/* CONTROLS accessibility (plan T13, a11y notes R6 and R7): the one live region,
   the colour gate over the page's real palette, and a shape and a word for each state. */
import { readFileSync } from "node:fs";
import { createGame } from "../src/main.js";
import "../src/core/board3.js";
import { createPixelRenderer } from "../src/render/pixel/renderer.js";
import { SCREEN, OPT_ROWS } from "../src/app/menuapp.js";
import { mountControls } from "../src/app/controlswire.js";
import { ACCENT, DANGER, MUTED, TEXT, WARM, layout, lockGlyph } from "../src/render/menudraw.js";
import { DEF_KEY, DEF_PAD, geoFor, geomOf, rowsOf } from "../src/render/controlsgeo.js";
import { drawCapture, drawControls, drawRow } from "../src/render/controlsdraw.js";
import { dE, rgbOf, simRGB } from "../tools/tileart/gatefns.mjs";

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
  check("one aria-live element in the markup", live.length === 1, live.join(" "));
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
const openPage = (g) => { g.app._push(SCREEN.SETTINGS); g.app.optRow = OPT_ROWS.indexOf("CONTROLS"); g.app.confirm(); g.tick(16); };
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

// ---- the colour gate: the page's real palette ----
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const over = (f, a, b) => f.map((v, i) => v * a + b[i] * (1 - a));
const R = rgbOf, PLATE = R("#0a0e18"), WARM_BAND = 0.12;
const KIT = { nominal: R("#0a0e18"), worst: R("#191c26") };
const BANDS = { "swap band": over(R(WARM), WARM_BAND, PLATE) };
for (const [k, b] of Object.entries(KIT)) { BANDS["accent band, " + k] = over(R(ACCENT), 0.12, b); BANDS["danger band, " + k] = over(R(DANGER), 0.12, b); }
{
  for (const [n, b] of Object.entries(BANDS)) {
    const t = cr(R(TEXT), b), o = cr(R(MUTED), b);
    check("#dfe7f5 on " + n + " >= 4.5", t >= 4.5, t.toFixed(2));
    check("#7385ad outline on " + n + " >= 3", o >= 3, o.toFixed(2));
  }
  const op = cr(R(MUTED), PLATE);
  check("#7385ad outline on the plate >= 3", op >= 3, op.toFixed(2));
  const d = cr(R("#0a0e18"), R(DANGER));
  check("danger-chip ink #0a0e18 on #ff5d73 >= 6", d >= 6, d.toFixed(2));
  for (const [n, f] of [["text", TEXT], ["warm", WARM], ["accent", ACCENT]]) {
    for (const [m, b] of [["plate", PLATE], ["swap band", BANDS["swap band"]]]) {
      const v = cr(R(f), b);
      check("page text " + n + " on " + m + " >= 4.5", v >= 4.5, v.toFixed(2));
    }
  }
  for (const [n, f] of [["notch", ACCENT], ["danger notch", DANGER]]) { const v = cr(R(f), PLATE); check(n + " on the plate >= 3", v >= 3, v.toFixed(2)); }
  for (const k of ["protan", "deutan"]) {
    const v = dE(simRGB(R(ACCENT), k), simRGB(R(DANGER), k));
    check("solid accent vs danger, " + k + ": Lab dE >= 30", v >= 30, v.toFixed(1));
  }
  const cvd = readFileSync(new URL("../tools/tileart/cvdsets.mjs", import.meta.url), "utf8");
  check("the highlight stays out of cvdsets.mjs", !cvd.includes(ACCENT) && !/highlight/i.test(cvd));
}

// ---- every state has a shape and a word ----
function recCtx() {
  const log = [], texts = [];
  const c = {
    fillStyle: "#000", strokeStyle: "#000", font: "10px monospace", globalAlpha: 1, textAlign: "left", textBaseline: "alphabetic", lineWidth: 1, lineCap: "butt", lineJoin: "miter",
    save() { log.push("save"); }, restore() { log.push("restore"); }, translate() {}, scale() {},
    beginPath() { log.push("bp"); }, closePath() { log.push("cp"); },
    moveTo(x, y) { log.push("m" + x + "," + y); }, lineTo(x, y) { log.push("l" + x + "," + y); },
    arc(...a) { log.push("a" + a.join()); }, arcTo(...a) { log.push("at" + a.join()); },
    bezierCurveTo(...a) { log.push("bz" + a.join()); }, quadraticCurveTo(...a) { log.push("q" + a.join()); },
    fill() { log.push("f" + c.fillStyle); }, stroke() { log.push("k" + c.strokeStyle); },
    fillRect(...a) { log.push("fr" + a.join() + "," + c.fillStyle); }, strokeRect() {},
    measureText(s) { return { width: String(s).length * 6 }; },
    fillText(s) { texts.push({ s: String(s), alpha: c.globalAlpha, fill: c.fillStyle }); },
  };
  return { c, log, texts };
}
const L600 = layout(600, 520), G = geoFor(L600, false, false);
const keyV = (o) => ({ tab: "key", device: "key", row: 1, pad: { state: "none" }, key: DEF_KEY, binds: DEF_PAD, stick: "L", dead: 25, vib: 0, stickVal: [0, 0], armed: false, swap: null, status: "", capture: null, echo: null, ...o });
const padV = (o) => keyV({ tab: "pad", device: "pad", pad: { state: "ready", name: "CONTROLLER 1" }, ...o });
const has = (r, s) => r.texts.some((t) => t.s === s);
const strokes = (r, col) => r.log.filter((l) => l === "k" + col).length;
const rects = (r, col, w) => r.log.filter((l) => l.startsWith("fr") && l.endsWith(col) && (w == null || l.split(",")[2] === String(w))).length;
{
  const row = (s, sel, i) => { const r = recCtx(), rows = rowsOf(s); drawRow(r.c, rows[i], geomOf(i, G), sel, s, false); return r; };
  const k = keyV(), on = row(k, true, 2), off = row(k, false, 2);
  check("Selected: a notch and a band, and the label brightens", rects(on, ACCENT, 3) === 1 && rects(off, ACCENT, 3) === 0 && on.texts.some((t) => t.s === "THROW" && t.fill === TEXT));

  const cap = (o) => { const r = recCtx(); drawCapture(r.c, { action: "THROW", prompt: "PRESS A KEY", sub: "NOW E", foot: "ESC CANCELS", ...o }, G); return r; };
  const lis = cap({});
  check("Listening: a dashed slot, and the words", strokes(lis, TEXT) >= 8 && has(lis, "PRESS A KEY") && has(lis, "ESC CANCELS"));
  const src = readFileSync(new URL("../src/render/controlsdraw.js", import.meta.url), "utf8");
  check("Listening is static: the paint reads no clock", !/performance\.now|Date\b|setTimeout|setInterval/.test(src) && !/\bt\b\s*[%*]/.test(src.slice(src.indexOf("function drawCapture"), src.indexOf("function drawControls"))));
  check("Refused: the why in words", has(cap({ sub: "R IS THE CAMERA · PICK ANOTHER", warn: 1 }), "R IS THE CAMERA · PICK ANOTHER"));

  const sw = padV({ swap: { row: "REMOTE" }, status: "EAST WAS REMOTE · REMOTE NOW SOUTH" }), a = row(sw, false, 3), b = row(padV(), false, 3);
  check("Conflict: a swap mark and the word", strokes(a, WARM) === 1 && strokes(b, WARM) === 0 && has(a, "SWAPPED"));
  check("Conflict: the band's text is the kit's bright ink, never muted", a.texts.every((t) => t.fill !== MUTED));

  const gc = geomOf(5, G), fx = row(keyV({ row: 5 }), false, 5), lock = recCtx();
  lockGlyph(lock.c, gc.x + gc.w - 18, gc.y + gc.h / 2, 12, MUTED);
  check("Fixed: the padlock is painted", lock.log.length > 0 && fx.log.join(";").includes(lock.log.join(";")));
  check("Fixed: never dimmed", fx.texts.every((t) => t.alpha === 1));

  const ch = recCtx();
  drawControls(ch.c, L600, keyV({ row: 2, key: { ...DEF_KEY, THROW: "KeyZ" } }), {});
  check("Changed: a dot, and the word", ch.log.some((l) => l.startsWith("f" + ACCENT)) && has(ch, "CHANGED"));
  const un = recCtx();
  drawControls(un.c, L600, keyV({ row: 2 }), {});
  check("Unchanged: neither", !has(un, "CHANGED"));

  const na = recCtx();
  drawControls(na.c, L600, padV({ row: 6, pad: { state: "ready", name: "x", rumble: false } }), {});
  check("Not available: NONE, and the words", has(na, "NONE") && na.texts.map((t) => t.s).join(" ").includes("NO VIBRATION ON THIS CONTROLLER OR BROWSER"));

  const ar = row(keyV({ row: 7, armed: true }), true, 7);
  check("Armed reset: a danger notch, and PRESS AGAIN", rects(ar, DANGER, 3) === 1 && has(ar, "PRESS AGAIN"));
}

console.log("\n  CONTROLS A11Y RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
