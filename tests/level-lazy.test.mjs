/* Task 9.14: LEVEL SELECT (src/render/pages/level.js) loads after the title, a lazy page like SETTINGS / GUIDE / RECORDS (AGENTS "Lazy pages", R20).
   Fresh process: the page module is never handed in, so every draw and tap here goes through the lazy getter. Until it lands the page paints THE
   LOADING plate titled LEVEL SELECT and every frame asks again; its taps follow R1 cohesion 1; the keys move the rows and START starts the run
   without it (the run never needs the page); once in, menudraw draws and taps through it exactly as before. */
import { readFileSync } from "node:fs";
import { createGame } from "../src/main.js";
import { SCREEN, ITEMS, LEVEL_ROWS } from "../src/app/menuapp.js";
import * as md from "../src/render/menudraw.js";
import * as lazy from "../src/render/pages/lazy.js";
import { loadBox } from "../src/render/kit/room.js";
import { LEVEL_WORDS, LABEL } from "../src/render/words.js";

let pass = 0, fail = 0;
function check(name, cond, detail) { cond ? pass++ : fail++; console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : "")); }
const J = JSON.stringify, flush = () => new Promise((r) => setTimeout(r, 0));
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

check("lazy.js has one LOAD line for the page: NAMES holds level", lazy.NAMES.includes("level"), J(lazy.NAMES));
for (const f of ["src/render/menudraw.js", "src/render/shellview.js", "src/app/pointer.js", "src/main.js"])
  check(f + " never imports pages/level.js statically", !/from\s*["'][^"']*pages\/level\.js["']|import\s*["'][^"']*pages\/level\.js["']/.test(noComments(readFileSync(f, "utf8"))));
check("LEVEL_TAP / LEVEL_TAP_LIST stay boot: words.js LEVEL_WORDS' own strings", md.LEVEL_TAP === LEVEL_WORDS.TAP && md.LEVEL_TAP_LIST === LEVEL_WORDS.TAP_LIST);

function mkCanvas(w, h, lay) {
  const L = {}, calls = [];
  const ctx = new Proxy(function () {}, { get: (t, p) => (p === Symbol.toPrimitive ? () => "" : (...a) => { calls.push([p, a]); return ctx; }), apply: () => ctx, set: () => true });
  const el = { width: w, height: h, style: {}, getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
    addEventListener(ty, fn) { (L[ty] = L[ty] || []).push(fn); }, removeEventListener() {}, fire(ty, ev) { (L[ty] || []).slice().forEach((fn) => fn(ev || {})); } };
  if (lay) el.ownerDocument = { body: { getAttribute: (k) => (k === "data-lay" ? lay : null) } };
  return { el, calls };
}
const texts = (calls) => calls.filter((c) => c[0] === "fillText").map((c) => String(c[1][0]));

/* in flight: LOADING titled LEVEL SELECT, one ask a frame; the keys walk the rows and START starts the run with the page never in */
{
  let asks = 0;
  const w0 = md._rec.want;
  md._rec.want = (n) => { if (n === "level") asks++; return new Promise(() => {}); };
  const KL = {}, noop = () => {};
  globalThis.window = { addEventListener: (ty, fn) => { (KL[ty] = KL[ty] || []).push(fn); }, removeEventListener: noop, innerWidth: 1440, innerHeight: 900 };
  const cv = mkCanvas(600, 520), g = createGame(cv.el, { seed: 42 });
  let t = 0;
  const tick = (n = 1) => { for (let i = 0; i < n; i++) g.loop((t += 1000 / 60)); };
  const down = (code) => (KL.keydown || []).forEach((f) => f({ code, key: code, repeat: false, preventDefault: noop }));
  const up = (code) => (KL.keyup || []).forEach((f) => f({ code, key: code, preventDefault: noop }));
  const press = (code) => { down(code); tick(3); up(code); tick(2); };
  g.app.cabinetSeen = true; g.app.skip(); g.app.cursor = ITEMS.indexOf("LEVEL SELECT"); g.app.confirm();
  cv.calls.length = 0; tick(1); await flush(); tick(1); await flush();
  const tx = texts(cv.calls);
  check("in flight: LEVEL SELECT paints THE LOADING plate titled LEVEL SELECT", g.app.screen === SCREEN.LEVEL && tx.includes("LOADING") && tx.includes(LABEL.LEVEL_SELECT || "LEVEL SELECT") && lazy.get("level") === null, J(tx));
  check("every LOADING frame asks for the page again (a failed import recovers)", asks >= 2, asks);
  const start = LEVEL_ROWS.indexOf("START");
  for (let i = 0; i < 6 && g.app.levelRow !== start; i++) press("ArrowDown");
  check("in flight: ↓ walks the rows to START on the app side, no page needed", g.app.screen === SCREEN.LEVEL && g.app.levelRow === start, g.app.levelRow);
  press("Enter");
  check("in flight: Enter on START starts the run (the run never needs the page)", g.app.screen === SCREEN.GAME && g.world.state === "PLAY" && lazy.get("level") === null, g.app.screen + " " + g.world.state);
  delete globalThis.window;
  md._rec.want = w0;
}

/* taps: inert while in flight; once failed, DID NOT LOAD and SETTINGS' rule (off the plate backs out, on it inert), on a desk #c and a phone #sh */
const BOXES = [["desk #c", 600, 520, undefined, false, false], ["phone #sh", 393, 852, 1, true, true]];
const at = (W, H, css, touch, shell) => { const F = { W, H, touch, shell, css }, B = loadBox(F); return { F, L: { ...md.layout(W, H, shell ? 120 : 0, css), shell }, on: [B.x + B.w / 2, B.y + B.h / 2], off: [3, 3] }; };
{
  md._rec.want = () => new Promise(() => {});
  const r = BOXES.map(([n, W, H, css, touch, shell]) => { const q = at(W, H, css, touch, shell), t = mkCanvas(W, H); md.drawLevelSelect(t.el.getContext(), 1, q.L, 0, 0, 0, false, 0, false, touch, {}); return [n, md.levelHit(...q.on, q.L, false, touch, false, "LEVEL").k, md.levelHit(...q.off, q.L, false, touch, false, "LEVEL").k]; });
  check("in flight: a tap on or off the LOADING plate does nothing ({k: none})", r.every((x) => x[1] === "none" && x[2] === "none"), J(r));
}
{
  md._rec.want = () => Promise.reject(new Error("offline"));
  const draw = () => BOXES.map(([n, W, H, css, touch, shell]) => { const q = at(W, H, css, touch, shell), t = mkCanvas(W, H); md.drawLevelSelect(t.el.getContext(), 1, q.L, 0, 0, 0, false, 0, false, touch, {}); return texts(t.calls); });
  draw(); await flush(); await flush();
  const tx = draw();
  const r = BOXES.map(([n, W, H, css, touch, shell]) => { const q = at(W, H, css, touch, shell); return [n, md.levelHit(...q.on, q.L, false, touch, false, "LEVEL").k, md.levelHit(...q.off, q.L, false, touch, false, "LEVEL").k]; });
  check("failed: the plate says DID NOT LOAD", tx.every((x) => x.includes("DID NOT LOAD")), J(tx));
  check("failed: a tap off the plate backs out ({k: back}), one on it stays inert ({k: none})", r.every((x) => x[1] === "none" && x[2] === "back"), J(r));
}

/* landed: menudraw draws and taps through the page module, the same calls as before */
{
  const P = await import("../src/render/pages/level.js");
  md._rec.want = (n) => (n === "level" ? Promise.resolve(P) : Promise.reject(new Error(n)));
  lazy._set("level", P);
  const q = at(600, 520, undefined, false, false), t = mkCanvas(600, 520);
  md.drawLevelSelect(t.el.getContext(), 1, q.L, 0, 0, 0, false, 0, false, false, {});
  const F = { W: 600, H: 520, touch: false, shell: false, css: undefined, play: q.L.play, tap: undefined };
  const G = P.levelGeom({ ...F }, { unlocked: false, open: false, row: "LEVEL" }), s = G.start;
  check("landed: the page paints (no LOADING)", !texts(t.calls).includes("LOADING"));
  check("landed: levelGeom / levelHit are the page's", J(md.levelGeom(q.L, false, false, false, "LEVEL").start) === J(s) && md.levelHit(s.x + s.w / 2, s.y + s.h / 2, q.L, false, false, false, "LEVEL").k === "start");
  check("landed: levelFoot is the page's footText of footItems", md.levelFoot("LEVEL", false) === P.footText(P.footItems("LEVEL", false)));
}

console.log("\n  LEVEL LAZY RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
