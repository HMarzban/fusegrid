// Task 9.12 (owner: "why that menu (second pic) is blury?"): #c's backing is the 600 x 520 board box in every look, scaled up by CSS (about
// 2.3x at 1366x768 @2), so PAUSE, its inline views and the run ends drawn on it were soft; PIXEL's #px and REAL 3D's #gl are near device
// resolution, so the plate read blurry beside the board. Off p, PAUSE and every WIN / LOSE now draw on #sh laid exactly over #c's content box
// at device density (fit.js fit.shell(2), the stage; shellview shellMode 2), click-through so taps stay #c's, in #c's own box units, so every
// layout and hit is the board's as before. The renderers draw no overlay then (main's {over}); their run-end particles still land over it.
import { mountFit, shellGeo, pxBox } from "../src/app/fit.js";
import { shellMode } from "../src/render/shellview.js";
import { SCREEN } from "../src/app/menuapp.js";
import { createGame } from "../src/main.js";
import "../src/core/board3.js";
import * as lazyPages from "../src/render/pages/lazy.js";
import * as endWin from "../src/render/pages/endwin.js";
import * as endLose from "../src/render/pages/endlose.js";
import * as settingsPage from "../src/render/pages/settings.js";
import { getFx } from "../src/render/fx.js";
lazyPages._set("endwin", endWin); lazyPages._set("endlose", endLose); lazyPages._set("settings", settingsPage);

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined && !cond ? " -> " + detail : ""));
}
const J = (v) => JSON.stringify(v);

function mkDom(W, H, touch, dpr) {
  const attrs = {}, hs = {}, log = [];
  const ctx = { setTransform: (...a) => log.push(["setTransform", ...a]), clearRect: (...a) => log.push(["clearRect", ...a]), imageSmoothingEnabled: false };
  const doc = { body: { setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: (k) => (k in attrs ? attrs[k] : null), style: { setProperty() {}, removeProperty() {} } } };
  const px = (v) => parseFloat(v) || 0;
  const sh = { width: 300, height: 150, hidden: true, style: {}, ownerDocument: doc, getContext: () => ctx, addEventListener() {},
    getBoundingClientRect: () => ({ left: px(sh.style.left), top: px(sh.style.top), width: px(sh.style.width), height: px(sh.style.height) }) };
  doc.getElementById = (id) => (id === "sh" ? sh : null);
  const win = { innerWidth: W, innerHeight: H, addEventListener: (t, f) => { (hs[t] = hs[t] || []).push(f); } };
  if (touch) win.ontouchstart = null;
  globalThis.window = win; globalThis.document = doc; globalThis.devicePixelRatio = dpr;
  globalThis.getComputedStyle = () => ({ borderLeftWidth: "1px", borderTopWidth: "1px" });
  return { sh, ctx, log, attrs, win, hs, doc };
}
const undo = () => { delete globalThis.window; delete globalThis.document; delete globalThis.devicePixelRatio; delete globalThis.getComputedStyle; };
/* #c: the board box (600 x 520 units), its border box where the browser put it (a 1 px border round its content) */
const mkCv = (rect, w = 600, h = 520) => ({ width: w, height: h, style: {}, getBoundingClientRect: () => rect, addEventListener() {} });

/* ---- shellMode: off p, PAUSE, a mid-run WIN (LEVEL CLEAR), a finale WIN and LOSE draw on the stage (2); p keeps its over box (3) ---- */
{
  const W = (state, level = 1) => ({ state, level });
  check("d / l (and no lay): PAUSE, a mid-run WIN, a finale WIN and LOSE -> 2 (the stage on #sh); PLAY -> 0",
    ["d", "l", undefined].every((l) => ["PAUSE", "LOSE"].every((s) => shellMode(SCREEN.GAME, W(s), l) === 2) && shellMode(SCREEN.GAME, W("WIN", 1), l) === 2 && shellMode(SCREEN.GAME, W("WIN", 5), l) === 2 && shellMode(SCREEN.GAME, W("PLAY"), l) === 0));
  check("p: still 3 for all four, the shell pages still 1", ["PAUSE", "LOSE"].every((s) => shellMode(SCREEN.GAME, W(s), "p") === 3) && shellMode(SCREEN.GAME, W("WIN", 1), "p") === 3 && shellMode(SCREEN.MENU, W("PAUSE"), "p") === 1);
}

/* ---- fit.shell(2): #sh over #c's content box at device px, click-through, the box #c itself, the transform #c's units -> device px ---- */
for (const [lay, W, H, touch, dpr, rect] of [
  ["d", 1366, 768, false, 2, { left: 333.96875, top: 106, width: 698.0625, height: 605 }],
  ["d", 1366, 768, false, 1, { left: 383, top: 24, width: 720, height: 624 }],
  ["l", 852, 393, true, 3, { left: 197.5, top: 1, width: 457.75, height: 396.5 }], // a landscape phone: no shell box, the stage still comes
  ["l", 1024, 768, true, 2, { left: 160, top: 40, width: 704, height: 610 }],
]) {
  const D = mkDom(W, H, touch, dpr);
  try {
    const cv = mkCv(rect), fit = mountFit(cv), B = pxBox(rect.width, rect.height, dpr, 1, 1);
    D.log.length = 0;
    const s = fit.shell(2), L = parseFloat(D.sh.style.left), T = parseFloat(D.sh.style.top);
    check(`${lay} ${W}x${H} @${dpr}: fit.shell(2) shows #sh click-through and hands back #c as the box (its own units: every layout read is the board's)`,
      !!s && s.ctx === D.ctx && s.el === D.sh && s.box === cv && !D.sh.hidden && D.sh.style.pointerEvents === "none" && fit.box() === null && fit.over() === null, J([!!s, D.sh.hidden, D.sh.style.pointerEvents]));
    check(`${lay} ${W}x${H} @${dpr}: #sh lies on #c's content box (inside its 1 px border), whole device px, backing 1:1 (${B.bw} x ${B.bh})`,
      D.sh.width === B.bw && D.sh.height === B.bh && D.sh.style.width === B.w + "px" && D.sh.style.height === B.h + "px" &&
        Math.abs(L - (rect.left + 1)) <= 0.5 && Math.abs(T - (rect.top + 1)) <= 0.5 && Number.isInteger(Math.round(L * dpr * 1e6) / 1e6) && Number.isInteger(Math.round(T * dpr * 1e6) / 1e6),
      J([D.sh.width, D.sh.height, D.sh.style]));
    check(`${lay} ${W}x${H} @${dpr}: cleared, then the transform maps #c's 600 x 520 onto the backing (device px per unit ${(B.bw / 600).toFixed(3)})`,
      D.log.some((e) => e[0] === "clearRect" && e[3] === D.sh.width && e[4] === D.sh.height) && J(D.log[D.log.length - 1]) === J(["setTransform", B.bw / 600, 0, 0, B.bh / 520, 0, 0]) && B.bw / 600 > 1.5 * (dpr > 1 ? 1 : 0.6), J(D.log.slice(-2)));
    D.ctx.globalAlpha = 0.3; D.ctx.globalCompositeOperation = "copy"; fit.shell(2);
    check(`${lay} ${W}x${H}: a frame's leftover alpha / composite never reaches the next stage frame (one context for the stage and the pages)`, D.ctx.globalAlpha === 1 && D.ctx.globalCompositeOperation === "source-over");
    const n = D.log.length; fit.shell(2);
    check(`${lay} ${W}x${H}: every stage frame clears and redraws (the overlay paints live every frame, as it did on #c)`, D.log.slice(n).some((e) => e[0] === "clearRect"));
    const g = shellGeo(W, H, 600, 520, lay), m = fit.shell(1);
    check(`${lay} ${W}x${H}: back to a page, #sh is the shell box again (or hidden where the layout has none)`,
      g ? !!m && D.sh.style.pointerEvents === "" && D.sh.style.left === "0px" && D.sh.style.width === g.w + "px" && D.sh.width === Math.round(g.w * Math.min(2, dpr)) && m.box.width === g.w : m === null && D.sh.hidden, J([!!m, D.sh.style, D.sh.width]));
    fit.shell(2); fit.shell(0);
    check(`${lay} ${W}x${H}: the stage -> PLAY hides #sh`, D.sh.hidden && fit.shell(0) === null);
  } finally { undo(); }
}
/* a portrait phone with no over box (no shell box) takes the stage too, rather than #c's soft backing */
{
  const D = mkDom(400, 440, true, 3);
  try {
    const cv = mkCv({ left: 8, top: 60, width: 384, height: 333 }), fit = mountFit(cv), s = fit.shell(3);
    check("p with no shell box (400 x 440): fit.shell(3) falls back to the stage over #c (click-through, #c's box)", shellGeo(400, 440, 600, 520, "p") === null && !!s && s.box === cv && !D.sh.hidden && D.sh.style.pointerEvents === "none" && fit.over() === null, J([!!s, D.sh.hidden]));
  } finally { undo(); }
}

/* ---- createGame on a desktop window @2: PAUSE, its views, LEVEL CLEAR and GAME OVER are drawn on #sh at device density, none on #c ---- */
{
  const D = mkDom(1366, 768, false, 2), shText = [], shT = [], marks = [];
  let tf = [1, 0, 0, 1, 0, 0];
  const shCtx = new Proxy({}, { get: (t, p) => (p === "fillText" ? (s) => { shText.push(String(s)); shT.push(tf[0]); } : p === "setTransform" ? (...a) => { tf = a; } : p === "getTransform" ? () => ({ a: tf[0], b: tf[1], c: tf[2], d: tf[3], e: tf[4], f: tf[5] }) : p === "measureText" ? (s) => ({ width: String(s).length * 6 }) : p === "canvas" ? D.sh : p in t ? t[p] : () => ({ addColorStop() {} })), set: (t, p, v) => { if (p === "fillStyle" && v === "#abcdef") marks.push(shText.length); t[p] = v; return true; } });
  D.sh.getContext = () => shCtx;
  const cText = [];
  const cctx = new Proxy({}, { get: (t, p) => (p === "fillText" ? (s) => cText.push(String(s)) : p === "measureText" ? (s) => ({ width: String(s).length * 6 }) : p === "canvas" ? cv : p in t ? t[p] : () => ({ addColorStop() {} })), set: (t, p, v) => ((t[p] = v), true) });
  const cv = { width: 600, height: 520, style: {}, ownerDocument: D.doc, getContext: () => cctx, getBoundingClientRect: () => ({ left: 333.96875, top: 106, width: 698.0625, height: 605 }), addEventListener() {}, removeEventListener() {} };
  D.doc.addEventListener = () => {};
  try {
    const g = createGame(cv, { seed: 7 });
    { const r0 = g.renderer.render.bind(g.renderer); g.renderer.render = (w, dt, ro) => { g.ro = ro; return r0(w, dt, ro); }; }
    let t = 0;
    const frame = () => { shText.length = 0; shT.length = 0; cText.length = 0; t += 16; g.loop(t); };
    g.app.cabinetSeen = true; g.app.skip(); frame(); g.app.confirm(); frame();
    check("GAME PLAY: #sh hidden, the renderer draws its own overlay", g.world.state === "PLAY" && D.sh.hidden && !g.ro.over);
    g.input.onPause(); frame();
    const k = D.sh.width / 600;
    check("PAUSE: the renderer is told {over}; #sh shown click-through over #c; RESUME drawn on #sh at device density, none on #c",
      g.world.state === "PAUSE" && g.ro.over === true && !D.sh.hidden && D.sh.style.pointerEvents === "none" && shText.includes("RESUME") && !cText.includes("RESUME") && k > 2 && shT.every((a) => a >= k - 1e-9),
      J([g.ro.over, D.sh.hidden, shText.slice(0, 6), cText.slice(0, 6), k]));
    for (const [v, word] of [[1, "MUSIC"], [2, "FRAME RATE"]]) {
      g.app.pauseView = v; frame();
      check(`PAUSE view ${v}: the inline page on #sh (${word}), none of it on #c`, shText.includes(word) && !cText.includes(word), J([shText.slice(0, 6), cText.slice(0, 6)]));
    }
    g.app.pauseView = 0; g.input.onPause(); frame();
    g.world.state = "WIN"; frame();
    getFx().push({ x: 300, y: 260, vx: 0, vy: 0, t: 0, life: 99, size: 4, color: "#abcdef", confetti: true }); marks.length = 0; frame();
    check("LEVEL CLEAR: a live particle is drawn on #sh after every word of the page (the renderer's over(), particles over the plate)", marks.length > 0 && marks.every((n) => n === shText.length && n > 0), J([marks, shText.length]));
    getFx().length = 0;
    check("a mid-run WIN (LEVEL CLEAR): drawn on #sh, none on #c", g.world.level === 1 && !D.sh.hidden && D.sh.style.pointerEvents === "none" && shText.length > 0 && !cText.some((s) => shText.includes(s)), J([shText.slice(0, 6), cText.slice(0, 6)]));
    g.world.state = "LOSE"; frame();
    check("GAME OVER: drawn on #sh, none on #c", !D.sh.hidden && shText.length > 0 && !cText.some((s) => shText.includes(s)), J([shText.slice(0, 6), cText.slice(0, 6)]));
  } finally { undo(); }
}

console.log("\n  SHARP OVERLAYS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
