// Full-window menu canvas (UI upgrade v202 Task 1.0, owner pick "Full window"): MENU and every
// plated page draw on #sh on every layout that has a shell box (fit.js shellGeo), a run end
// shows #sh click-through and drawing nothing, PLAY and PAUSE hide it. The cases drive the real
// seams together: shellGeo, mountFit's fit.shell / fit.box, shellview's shellMode and drawShell,
// mountPointer with the real hit functions, and createGame's frame wiring.
import { readFileSync } from "node:fs";
import { DESK_SHELL, FIT_RES, PORT_SHELL, fitBox, mountFit, portraitGeo, shellGeo } from "../src/app/fit.js";
import { mountPointer } from "../src/app/pointer.js";
import { SCREEN, createMenuApp } from "../src/app/menuapp.js";
import { createControlsPage } from "../src/app/controlspage.js";
import { DEF_CONTROLS } from "../src/app/controls.js";
import { overlayBox, pauseHit, touchLay } from "../src/render/scenes.js";
import { controlsGeo, controlsHit, dims, drawShell, isShellScreen, loadControlsArt, shellMode } from "../src/render/shellview.js";
import * as md from "../src/render/menudraw.js";
import { geoFor, geomOf, hitPage } from "../src/render/controlsgeo.js";
import { createGame } from "../src/main.js";
import "../src/core/board3.js"; // an ordinary run deals gen 3; with the seam empty the start holds

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
const J = (v) => JSON.stringify(v);
await loadControlsArt(); // the CONTROLS paint is lazy (v202)

/* A fake page for mountFit: window, document, body[data-lay] and an #sh canvas whose rect is its CSS box. */
function mkDom(W, H, touch, dpr = 1) {
  const attrs = {}, hs = {}, L = {}, log = [];
  const ctx = { setTransform: (...a) => log.push(["setTransform", ...a]), clearRect: (...a) => log.push(["clearRect", ...a]), imageSmoothingEnabled: true };
  const doc = { body: { setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: (k) => (k in attrs ? attrs[k] : null), style: { setProperty() {} } } };
  const px = (v) => parseFloat(v) || 0;
  const sh = {
    width: 300, height: 150, hidden: true, style: {}, ownerDocument: doc, getContext: () => ctx,
    getBoundingClientRect: () => ({ left: px(sh.style.left), top: px(sh.style.top), width: px(sh.style.width), height: px(sh.style.height) }),
    addEventListener: (t, f) => { (L[t] = L[t] || []).push(f); },
    fire: (t, ev) => (L[t] || []).slice().forEach((f) => f({ currentTarget: sh, ...ev })),
  };
  doc.getElementById = (id) => (id === "sh" ? sh : null);
  const win = { innerWidth: W, innerHeight: H, addEventListener: (t, f) => { (hs[t] = hs[t] || []).push(f); } };
  if (touch) win.ontouchstart = null;
  globalThis.window = win;
  globalThis.document = doc;
  globalThis.devicePixelRatio = dpr;
  return { sh, ctx, log, attrs, win, hs, doc };
}
const undo = () => { delete globalThis.window; delete globalThis.document; delete globalThis.devicePixelRatio; };
const mkCv = (w = 600, h = 520) => {
  const L = {};
  return { width: w, height: h, style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }), addEventListener: (t, f) => { (L[t] = L[t] || []).push(f); }, fire: (t, ev) => (L[t] || []).slice().forEach((f) => f(ev || {})) };
};
/* A text recorder: fillText at a 0.6 em mono advance, through translate / scale. */
const rec = () => {
  const texts = [];
  const o = {
    font: "10px x", textAlign: "left", globalAlpha: 1, _t: [1, 0, 0, 1, 0, 0],
    fillText(s, x, y) { const w = o.measureText(s).width, a = o.textAlign, x0 = a === "center" ? x - w / 2 : a === "right" || a === "end" ? x - w : x; texts.push({ s: String(s), x: x0 * o._t[0] + o._t[4], w: w * o._t[0], y: y * o._t[3] + o._t[5] }); },
    measureText(s) { const m = /(\d+(?:\.\d+)?)px/.exec(o.font); return { width: String(s).length * 0.6 * (m ? +m[1] : 10) }; },
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
    save() {}, restore() { o._t = [1, 0, 0, 1, 0, 0]; }, translate(x, y) { o._t[4] += x; o._t[5] += y; }, scale(a, b) { o._t[0] *= a; o._t[3] *= b; },
  };
  return { texts, c: new Proxy(o, { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }) };
};
const mkApp = (screen) => {
  const a = createMenuApp({ settings: {}, controls: createControlsPage({ get: () => DEF_CONTROLS, set() {}, padView: () => ({ state: "none" }), say() {} }) });
  a.screen = screen; a.subT = 5; a.stats = { rows: [["RUNS", 3]], notes: ["NOTE"], trophies: [] };
  return a;
};
const HIT = { overlayBox, pauseHit, touchLay, controlsHit, dims, menuHit: md.menuHit, settingsHit: md.settingsHit, graphicsHit: md.graphicsHit, guideHit: md.guideHit, levelHit: md.levelHit, scoresHit: md.scoresHit, statsHit: md.statsHit, layout: md.layout };
const SHELL_SCREENS = ["MENU", "LEVEL", "HOWTO", "SCORES", "ITEMS", "ENEMIES", "SETTINGS", "GUIDE", "STATS", "TROPHIES", "GRAPHICS", "FLOOR", "CONTROLS"];

// ---- shellGeo per layout: d and l are the window at scale 1, p follows PORT_SHELL ----
{
  const boardLine = (W, H, lay) => { const b = fitBox(W, H, lay !== "d", 600, 520).s; return (H - 520 * b) / 2 + 1 + PORT_SHELL.logo * 520 * b; }; // body flex-centres #wrap; 1px canvas border
  for (const [W, H] of [[1366, 768], [1920, 1080], [1280, 720], [3840, 2160], [600, 520]]) {
    const g = shellGeo(W, H, 600, 520, "d");
    check(`d ${W}x${H}: the shell box is the window at scale 1, logo on the centred board's 0.27 line`,
      !!g && g.w === W && g.h === H && g.s === 1 && g.left === 0 && g.top === 0 && Math.abs(g.logo - boardLine(W, H, "d")) < 1e-9, J(g));
  }
  check("d 1366x768 is exactly {w 1366, h 768, s 1, left 0, top 0} plus logo", J({ ...shellGeo(1366, 768, 600, 520, "d"), logo: 0 }) === J({ w: 1366, h: 768, s: 1, left: 0, top: 0, logo: 0 }));
  check("DESK_SHELL is frozen: a 600 x 520 floor, backing dpr cap 2", Object.isFrozen(DESK_SHELL) && J(DESK_SHELL) === J({ min: [600, 520], dpr: 2 }));
  check("d floor: 520 tall has a box, 519 does not (falls back to #c)", !!shellGeo(1366, 520, 600, 520, "d") && shellGeo(1366, 519, 600, 520, "d") === null);
  check("d floor: 600 wide has a box, 599 does not (a narrower keyboard page clips its text)", !!shellGeo(600, 768, 600, 520, "d") && shellGeo(599, 768, 600, 520, "d") === null);
  for (const [W, H] of [[393, 852], [390, 844], [360, 640], [430, 932], [768, 1024], [400, 470]])
    check(`p ${W}x${H}: unchanged from today's rule (lay defaults to p)`, J(shellGeo(W, H, 600, 520, "p")) === J(shellGeo(W, H, 600, 520)) && !!shellGeo(W, H, 600, 520, "p"));
  {
    const g = shellGeo(393, 852, 600, 520, "p");
    check("p 393x852: today's pin (s 0.9, 436 wide)", Math.abs(g.s - 0.9) < 0.002 && g.w === 436 && g.logo * g.s - (portraitGeo(393, 852, 600, 520).top + 1 + 0.27 * 520 * fitBox(393, 852, true, 600, 520).s) < 1e-6);
  }
  {
    const at = (H) => shellGeo(400, H, 600, 520, "p");
    let H0 = 470; while (at(H0 - 1)) H0--;
    check("p floor: the first height with a box is exactly 520 units tall, one px less has none", at(H0).h === 520 && at(H0 - 1) === null, H0);
  }
  // lead ruling (pre-review): a landscape tablet is the desktop form with touch pitches, so l takes the desktop rule
  for (const [W, H] of [[1024, 768], [1180, 820], [1194, 834], [1366, 1024]]) {
    const g = shellGeo(W, H, 600, 520, "l");
    check(`l ${W}x${H} (tablet): the shell box is the window at scale 1, logo on the centred landscape board's 0.27 line`,
      !!g && g.w === W && g.h === H && g.s === 1 && g.left === 0 && g.top === 0 && Math.abs(g.logo - boardLine(W, H, "l")) < 1e-9 && g.logo !== boardLine(W, H, "d"), J(g));
  }
  check("l: landscape phones (844x390, 932x430, 852x393) are under the floor: no box, menus stay on #c", [[844, 390], [932, 430], [852, 393]].every(([W, H]) => shellGeo(W, H, 600, 520, "l") === null));
  check("l floor: 520 tall has a box, 519 does not", !!shellGeo(1024, 520, 600, 520, "l") && shellGeo(1024, 519, 600, 520, "l") === null);
  check("l floor: 600 wide has a box, 599 does not", !!shellGeo(600, 560, 600, 520, "l") && shellGeo(599, 560, 600, 520, "l") === null);
  check("p is never the window rule: a 768x1024 tablet keeps the PORT_SHELL box (612 wide, s 1.2533)", shellGeo(768, 1024, 600, 520, "p").w === 612 && Math.abs(shellGeo(768, 1024, 600, 520, "p").s - 1.2533) < 1e-3 && FIT_RES.p[0] === 16);
}

// ---- mountFit: the box on every layout, its CSS box, its backing ----
for (const [lay, W, H, touch, dpr, q] of [["d", 1366, 768, false, 2, 2], ["d", 1366, 768, false, 3, 2], ["d", 1920, 1080, false, 1, 1], ["p", 393, 852, true, 3, 2.7], ["l", 1024, 768, true, 3, 2], ["l", 1366, 1024, true, 1.5, 1.5]]) {
  const D = mkDom(W, H, touch, dpr);
  try {
    const fit = mountFit(mkCv()), g = shellGeo(W, H, 600, 520, lay);
    check(`${lay} ${W}x${H} dpr ${dpr}: data-lay ${lay}, #sh spans the box's CSS rect, backing = box x ${q} (${lay === "p" ? "portrait cap 3" : "window cap 2"})`,
      D.attrs["data-lay"] === lay && D.sh.style.left === "0px" && D.sh.style.top === "0px" && D.sh.style.width === g.w * g.s + "px" && D.sh.style.height === g.h * g.s + "px" &&
        D.sh.width === Math.round(g.w * q) && D.sh.height === Math.round(g.h * q), J([D.sh.width, D.sh.height, D.sh.style]));
    const s = fit.shell(1);
    check(`${lay} ${W}x${H}: fit.shell(1) shows #sh, clears it, takes pointers, and hands back the box (${g.w}x${g.h}, logo)`,
      !!s && s.el === D.sh && s.ctx === D.ctx && !D.sh.hidden && D.sh.style.pointerEvents === "" && s.box.width === g.w && s.box.height === g.h && s.box.logo === g.logo &&
        D.log.some((e) => e[0] === "clearRect" && e[3] === D.sh.width && e[4] === D.sh.height) && J(D.log[D.log.length - 1]) === J(["setTransform", D.sh.width / g.w, 0, 0, D.sh.height / g.h, 0, 0]));
  } finally { undo(); }
}
{
  const D = mkDom(1366, 500, false, 2);
  try {
    const fit = mountFit(mkCv());
    check("d under the floor: no box, fit.shell(1) returns null, #sh stays hidden, fit.box() null", fit.shell(1) === null && D.sh.hidden && fit.box() === null);
    D.win.innerHeight = 768; D.hs.resize.forEach((f) => f());
    check("a resize past the floor brings the box (#sh sized to the window)", !!fit.shell(1) && D.sh.style.height === "768px" && !D.sh.hidden);
    D.win.innerWidth = 560; D.hs.resize.forEach((f) => f());
    check("a resize under the width floor hides #sh and drops the box", D.sh.hidden && fit.shell(1) === null && fit.box() === null);
    D.win.innerWidth = 844; D.win.ontouchstart = null; D.win.innerHeight = 390; D.hs.orientationchange.forEach((f) => f());
    check("orientationchange re-fits too (here to a landscape phone under the floor: no box)", D.attrs["data-lay"] === "l" && fit.shell(1) === null && D.sh.hidden);
    D.win.innerWidth = 1024; D.win.innerHeight = 768; D.hs.orientationchange.forEach((f) => f());
    check("orientationchange to a landscape tablet brings the window box", D.attrs["data-lay"] === "l" && !!fit.shell(1) && D.sh.style.width === "1024px" && D.sh.style.height === "768px" && fit.box().width === 1024);
  } finally { undo(); }
}

// ---- fit.shell modes: 1 draws, 2 (a run end) shows it click-through and hands back nothing, 0 hides ----
{
  const D = mkDom(1366, 768, false, 1);
  try {
    const fit = mountFit(mkCv());
    D.log.length = 0;
    const e = fit.shell(2);
    check("run end: #sh shown and cleared, click-through, nothing to draw on (null), so drawShell stays on #c",
      e === null && !D.sh.hidden && D.sh.style.pointerEvents === "none" && D.log.some((x) => x[0] === "clearRect"));
    const d = fit.shell(1);
    check("run end -> a page: pointers back on #sh", !!d && D.sh.style.pointerEvents === "");
    fit.shell(2); fit.shell(0);
    check("run end -> hidden: #sh hidden", D.sh.hidden && fit.shell(0) === null);
    fit.shell(1);
    check("hidden after a run end -> a page: pointers back", !D.sh.hidden && D.sh.style.pointerEvents === "");
    check("fit.shell(true) still draws, fit.shell(false) still hides", !!fit.shell(true) && D.sh.style.pointerEvents === "" && fit.shell(false) === null && D.sh.hidden);
  } finally { undo(); }
}

// ---- the visibility predicate: shellview shellMode(screen, world) ----
{
  const W = (state, level = 1, o = {}) => ({ state, level, ...o });
  check("every shell page draws on #sh (1)", SHELL_SCREENS.every((s) => shellMode(SCREEN[s], W("PLAY")) === 1 && isShellScreen(SCREEN[s])));
  check("BOOT, INTRO and ATTRACT: hidden (0)", [SCREEN.BOOT, SCREEN.INTRO, SCREEN.ATTRACT].every((s) => shellMode(s, W("PLAY")) === 0));
  check("GAME PLAY: hidden", shellMode(SCREEN.GAME, W("PLAY")) === 0);
  check("GAME PAUSE (every pause view): hidden, PAUSE stays on #c", [0, 1, 2, 3].every((v) => shellMode(SCREEN.GAME, W("PAUSE")) === 0) && !isShellScreen(SCREEN.GAME));
  check("a mid-run WIN (room 1): hidden", shellMode(SCREEN.GAME, W("WIN", 1)) === 0);
  check("a run end: LOSE, a finale WIN (room 5, room 8, world.finale) -> 2", shellMode(SCREEN.GAME, W("LOSE", 3)) === 2 && shellMode(SCREEN.GAME, W("WIN", 5)) === 2 && shellMode(SCREEN.GAME, W("WIN", 8)) === 2 && shellMode(SCREEN.GAME, W("WIN", 2, { finale: true })) === 2);
  check("no world outside GAME never throws", shellMode(SCREEN.MENU, null) === 1 && shellMode(SCREEN.INTRO, undefined) === 0);
}

// ---- the pointer maps through the box on every layout: a tap at a drawn MENU row confirms that row ----
for (const [lay, W, H, touch, dpr] of [["d", 1366, 768, false, 2], ["d", 3840, 2160, false, 1], ["l", 1024, 768, true, 3], ["p", 393, 852, true, 3]]) {
  const D = mkDom(W, H, touch, dpr);
  try {
    const cv = mkCv(), fit = mountFit(cv), sh = fit.shell(1), app = mkApp(SCREEN.MENU), input = { _intent: { fire: true }, onUiKey() {} };
    mountPointer({ canvas: cv, fit, input, app, world: { state: "PLAY" }, kind: () => "2d", ctl: () => null, hit: HIT });
    const R = rec();
    drawShell(R.c, app, { state: "PLAY", time: 1 }, sh.box, "2d", () => [], () => 0, () => ({}));
    const t = R.texts.find((q) => q.s === "OPTIONS"), r = D.sh.getBoundingClientRect(), k = r.width / sh.box.width;
    D.sh.fire("pointerdown", { clientX: r.left + (t.x + 4) * k, clientY: r.top + t.y * k, pointerType: "mouse" });
    check(`${lay} ${W}x${H}: a tap on #sh at the drawn OPTIONS row confirms it (cursor 3, OPTIONS opens), the fire latch swallowed`,
      app.cursor === 3 && app.screen === SCREEN.SETTINGS && input._intent.fire === false, app.cursor + "/" + app.screen);
  } finally { undo(); }
}

// ---- every page in a desktop window box (and a landscape tablet's, touch pitches) draws inside it, unclipped, and taps where it draws ----
{
  const base = {};
  const shot = (nm, box, cur) => { const a = mkApp(SCREEN[nm]); if (cur != null) a.cursor = cur; const R = rec(); drawShell(R.c, a, { state: "PLAY", time: 1 }, box, "2d", () => [], () => 0, () => ({})); return R.texts; };
  const boxOf = (g, lay) => ({ width: g.w, height: g.h, logo: g.logo, ownerDocument: { body: { getAttribute: () => lay } }, getBoundingClientRect: () => ({ left: 0, top: 0, width: g.w * g.s, height: g.h * g.s }) });
  const each = (f) => { for (const nm of SHELL_SCREENS) for (let cur = 0; cur < (nm === "MENU" ? 8 : 1); cur++) f(nm, nm === "MENU" ? cur : null); };
  /* the words, by " · " token: a tall touch box hangs the hub's build tag under the plate instead of on the SOURCE tile (menudraw drawMenu), the same tokens; an ellipsis changes a token */
  const words = (T) => T.flatMap((q) => q.s.split(" · ")).sort().join("|");
  for (const lay of ["d", "l"]) each((nm, cur) => { base[lay + nm + cur] = words(shot(nm, boxOf({ w: 600, h: 520, s: 1 }, lay), cur)); });
  for (const [lay, W, H] of [["d", 600, 520], ["d", 1366, 768], ["d", 1920, 1080], ["d", 3840, 2160], ["l", 600, 520], ["l", 1024, 768], ["l", 1180, 820], ["l", 1194, 834], ["l", 1366, 1024]]) {
    const g = shellGeo(W, H, 600, 520, lay), box = boxOf(g, lay), touch = lay !== "d", L = md.layout(g.w, g.h, g.logo), tg = `${lay} ${W}x${H} box ${g.w}x${g.h}`;
    const out = [], same = [];
    each((nm, cur) => {
      const T = shot(nm, box, cur);
      if (T.some((q) => q.x < -0.5 || q.x + q.w > g.w + 0.5 || q.y < 0 || q.y > g.h)) out.push(nm + cur);
      if (words(T) !== base[lay + nm + cur]) same.push(nm + cur);
    });
    check(`every page's text sits inside the box (${tg})`, out.length === 0, out.join());
    check(`every page prints exactly its 600x520 words, token for token: nothing elided (${tg})`, same.length === 0, same.join());
    const inBox = (S) => S.x >= 0 && S.y >= 0 && S.x + S.w <= g.w && S.y + S.h <= g.h && S.f === 1;
    const inPlate = (r, S) => r.x >= S.x - 1 && r.y >= S.y && r.x + r.w <= S.x + S.w + 1.01 && r.y + r.h <= S.y + S.h + 0.01;
    const ctr = (r) => [r.x + r.w / 2, r.y + r.h / 2];
    const mg = md.menuGeom(L, 8, touch);
    check(`MENU: inside the box, every row taps to itself (${tg})`, mg.y0 >= 0 && mg.y0 + mg.h <= g.h && mg.rows.every((r, i) => md.menuHit(r.x != null ? r.x + r.w / 2 : g.w / 2, r.cy, L, 8, touch) === i));
    for (const U of [false, true]) {
      const G = md.levelGeom(L, U, touch), rects = [...G.room, G.pane, G.heatCap, ...G.heat, G.paceCap, ...G.pace, ...(U ? [G.modeCap, ...G.mode, G.help] : []), G.start];
      const hits = [...G.room.map((r, i) => [r, i < G.cap ? "room" : "lock", i]), ...G.heat.map((r, i) => [r, "heat", i]), ...G.pace.map((r, i) => [r, "pace", i]), ...G.mode.map((r, i) => [r, "mode", i]), [G.start, "start"]];
      check(`LEVEL SELECT${U ? " (modes open)" : ""}: plate in the box, every rect in it, each taps to itself, card inert, off-plate backs (${tg})`,
        inBox(G.S) && rects.every((r) => inPlate(r, G.S)) && hits.every(([r, k, i]) => { const h = md.levelHit(...ctr(r), L, U, touch); return h.k === k && (i == null || h.i === i); }) &&
          md.levelHit(...ctr(G.pane), L, U, touch).k === "none" && md.levelHit(4, 4, L, U, touch).k === "back");
    }
    const sc = md.scoresGeom(L, touch);
    check(`HIGH SCORES: tabs in the plate, each taps to itself (${tg})`, inBox(sc.S) && sc.tabs.every((r, i) => inPlate(r, sc.S) && md.scoresHit(...ctr(r), L, touch) === i));
    for (const [nm, geo, hit, n] of [["OPTIONS", md.settingsGeom, md.settingsHit, md.OPT_N], ["GRAPHICS", md.graphicsGeom, md.graphicsHit, md.GFX_N]]) {
      const q = geo(L, touch);
      check(`${nm}: rows in the box, each taps to itself, off the plate backs out (${tg})`, inBox(q.S) && Array.from({ length: n }, (_, i) => hit(q.S.mid, q.y0 + (i + 0.5) * q.rowH, L, 0, touch) === i).every(Boolean) && hit(4, 4, L, 0, touch) === -1);
    }
    const gd = md.guideGeom(L, touch);
    check(`GUIDE: doors in the box, each taps to itself (${tg})`, inBox(gd.S) && gd.tiles.every((r, i) => md.guideHit(...ctr(r), L, 0, touch) === i));
    const st = md.statsGeom(L).S;
    check(`STATS: in the box, foot T taps KeyT (${tg})`, inBox(st) && md.statsHit(st.mid - 47 * 3 + 24, st.footY, L, false) === "KeyT");
    const cg = controlsGeo(box, "2d", false);
    check(`CONTROLS: the painted geometry is the tapped one, every row taps to itself, a window corner is off the plate (${tg})`,
      J(cg) === J(geoFor(L, touch, L.narrow, g.s)) && cg.x >= 0 && cg.y >= 0 && cg.x + cg.w <= g.w && cg.y + cg.h <= g.h &&
        Array.from({ length: 8 }, (_, i) => geomOf(i, cg)).every((r, i) => hitPage({}, ...ctr(r), cg).row === i) && hitPage({}, 1, 1, cg).off === 1 && hitPage({}, g.w - 1, g.h - 1, cg).off === 1);
  }
}

// ---- CONTROLS: a tap off the plate backs out anywhere in the window (#sh covers it on a desktop) ----
{
  const D = mkDom(1366, 768, false, 1);
  try {
    const cv = mkCv(), fit = mountFit(cv), sh = fit.shell(1), app = mkApp(SCREEN.CONTROLS), taps = [];
    mountPointer({ canvas: cv, fit, input: { _intent: { fire: true }, onUiKey() {} }, app, world: { state: "PLAY" }, kind: () => "2d", ctl: () => ({ tap: (v) => taps.push(v) }), hit: HIT });
    const G = controlsGeo(sh.box, "2d", false), r2 = geomOf(2, G);
    for (const [x, y] of [[2, 2], [1364, 766], [2, 766], [1364, 2]]) D.sh.fire("pointerdown", { clientX: x, clientY: y, pointerType: "mouse" });
    D.sh.fire("pointerdown", { clientX: r2.x + r2.w / 2, clientY: r2.y + r2.h / 2, pointerType: "mouse" });
    check("CONTROLS on a desktop #sh: each window corner taps off the plate ({off:1}), a row taps itself", taps.length === 5 && taps.slice(0, 4).every((t) => t && t.off === 1) && taps[4] && taps[4].row === 2, J(taps));
  } finally { undo(); }
}

// ---- index.html: #sh sits over #c and under the touch controls and the DOM cards ----
{
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8"), css = html.slice(html.indexOf("<style"), html.indexOf("</style>")).replace(/\/\*[\s\S]*?\*\//g, "");
  const z = (sel) => { const m = new RegExp("(?:^|[}\\s])" + sel.replace("#", "#") + "\\{[^}]*z-index:(\\d+)").exec(css); return m ? +m[1] : null; };
  const zs = { c: z("#c"), sh: z("#sh"), touchpad: z("#touchpad"), upd: z("#upd"), updbg: z("#updbg"), ana: z("#ana"), load: z("#load") };
  check("z-order: #c < #sh < #touchpad < #updbg < #upd, #ana < #load", Object.values(zs).every(Number.isFinite) && zs.c < zs.sh && zs.sh < zs.touchpad && zs.touchpad < zs.updbg && zs.updbg < zs.upd && zs.upd === zs.ana && zs.ana < zs.load, J(zs));
  const wrap = html.indexOf('<div id="wrap"'), at = html.indexOf('<canvas id="sh"'), between = html.slice(wrap, at), depth = between.split("<div").length - between.split("</div>").length;
  check("#sh is fixed and outside #wrap (over the whole viewport, never inside the stage)", /#sh\{position:fixed/.test(css) && wrap > 0 && at > wrap && depth === 0, depth);
}

// ---- createGame on a desktop window: main's frame shows #sh where the shell draws, and nowhere it must not ----
{
  const D = mkDom(1366, 768, false, 1), shText = [];
  D.sh.getContext = () => new Proxy({}, { get: (t, p) => (p === "fillText" ? (s) => shText.push(String(s)) : p === "measureText" ? (s) => ({ width: String(s).length * 6 }) : p in t ? t[p] : () => ({ addColorStop() {} })), set: (t, p, v) => ((t[p] = v), true) });
  const L = {}, cText = [];
  const cctx = new Proxy({}, { get: (t, p) => (p === "fillText" ? (s) => cText.push(String(s)) : p === "measureText" ? (s) => ({ width: String(s).length * 6 }) : p === "canvas" ? cv : p in t ? t[p] : () => ({ addColorStop() {} })), set: (t, p, v) => ((t[p] = v), true) });
  const cv = { width: 600, height: 520, style: {}, ownerDocument: D.doc, getContext: () => cctx, getBoundingClientRect: () => ({ left: 383, top: 24, width: 720, height: 624 }),
    addEventListener: (t, f) => { (L[t] = L[t] || []).push(f); }, removeEventListener() {}, fire: (t, ev) => (L[t] || []).slice().forEach((f) => f({ currentTarget: cv, ...ev })) };
  D.doc.addEventListener = () => {};
  try {
    const g = createGame(cv, { seed: 7 });
    let t = 0;
    const tick = (n = 1) => { for (let i = 0; i < n; i++) { t += 16; g.loop(t); } };
    const frame = () => { shText.length = 0; cText.length = 0; tick(); };
    g.app.cabinetSeen = true; g.app.skip(); frame();
    check("MENU: #sh shown and taking pointers, the menu drawn on #sh, none of it on #c", g.app.screen === SCREEN.MENU && !D.sh.hidden && D.sh.style.pointerEvents === "" && shText.includes("OPTIONS") && !cText.includes("OPTIONS"), J([D.sh.hidden, shText.length, cText.includes("OPTIONS")]));
    g.app.confirm(); frame();
    check("GAME PLAY: #sh hidden", g.app.screen === SCREEN.GAME && g.world.state === "PLAY" && D.sh.hidden);
    g.input.onPause(); frame();
    check("PAUSE: #sh hidden, the PAUSE list still on #c", g.world.state === "PAUSE" && D.sh.hidden && cText.includes("RESUME"), J(cText.slice(0, 12)));
    g.input.onPause(); frame();
    g.world.state = "WIN"; frame();
    check("a mid-run WIN (room 1): #sh hidden", g.world.level === 1 && g.world.state === "WIN" && D.sh.hidden);
    g.world.state = "LOSE"; frame();
    check("LOSE (a run end): #sh shown, click-through, nothing drawn on it; the end overlay on #c", !D.sh.hidden && D.sh.style.pointerEvents === "none" && shText.length === 0 && cText.length > 0, J([D.sh.hidden, D.sh.style.pointerEvents, shText.length]));
    cv.fire("pointerdown", { clientX: 700, clientY: 300, button: 0, pointerType: "mouse", preventDefault() {} });
    tick(3);
    check("LOSE: a tap on #c is the game's Space, as today: a fresh run at room 1", g.world.state === "PLAY" && g.world.level === 1 && D.sh.hidden, g.world.state + "/" + g.world.level);
    cv.fire("pointerup", { pointerType: "mouse" }); tick(3);
    g.world.state = "LOSE"; frame();
    g.input.onUiKey("Enter"); tick(3);
    check("LOSE: Enter (endkeys) still starts a fresh run", g.world.state === "PLAY" && g.world.level === 1, g.world.state);
  } finally { undo(); }
}

console.log("\n  FIT SHELL RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
