// Task 9.8 (lead ruling 2026-11-12): on a portrait phone (data-lay p) PAUSE (the list and its inline views 1-3), LEVEL CLEAR, the finale and
// GAME OVER draw on #sh in the whole space under the HUD plate down to the viewport's bottom safe area (fit.js fit.over, shellview shellMode 3),
// not in the board's box on #c; the board stays where it is under the veil. d and l are unchanged: their PAUSE and run-end geometry is pinned
// to a hash taken before the change. On p: PAUSE is one list page, GAME OVER and LEVEL CLEAR fit without paging at text 1, every key holds its
// label whole at 1 and 1.25, and a tap through the real pointer path lands on the rect drawn there.
import { createHash } from "node:crypto";
import { overlayBox, pauseGeom, pauseHit, drawOverlay, touchLay, endHitAt, endPagesAt } from "../src/render/scenes.js";
import { endPlan } from "../src/render/pages/endgeom.js";
import { setTextScale, measure, T } from "../src/render/kit/type.js";
import * as md from "../src/render/menudraw.js";
import * as lazyPages from "../src/render/pages/lazy.js";
import * as settingsPage from "../src/render/pages/settings.js";
import * as endWin from "../src/render/pages/endwin.js";
import * as endLose from "../src/render/pages/endlose.js";
import { optRows } from "../src/app/menuapp.js";
lazyPages._set("settings", settingsPage); lazyPages._set("endwin", endWin); lazyPages._set("endlose", endLose);

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined && !cond ? " -> " + detail : ""));
}
const J = (v) => JSON.stringify(v);
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

/* ---- d / l (and p's #c fallback) unchanged: every PAUSE, run-end and paused SETTINGS / GRAPHICS geometry on the board's box, hashed ---- */
const TM = { on: false, t: 41.5, best: 50 };
const WORLDS = [
  [{ state: "LOSE", level: 4, score: 1360, heat: 0, pace: 0, pact: 0 }, { r: 3, k: 12, p: 4, t: 200, best: { s: 1480, r: 4 }, fromStart: true, cap: 5, medals: [], et: 9 }],
  [{ state: "LOSE", level: 1, score: 0, heat: 2, pace: 1, pact: 5 }, { r: 1, k: 0, p: 0, t: 20, best: null, fromStart: true, cap: 5, medals: [], et: 9, daily: "2026-11-12", tries: 2, dbest: 40, fixed: true }],
  [{ state: "WIN", level: 2, score: 400, heat: 1, pace: 0, pact: 0 }, { r: 2, k: 5, p: 2, t: 90, best: null, fromStart: true, cap: 5, medals: [], et: 9, lk: 5, lp: 2 }],
  [{ state: "WIN", level: 5, score: 9000, heat: 2, pace: 0, pact: 0 }, { r: 5, k: 40, p: 12, t: 600, best: { s: 100, r: 5 }, fromStart: true, cap: 5, medals: [["IRON CROWN", "LEVELS 1-5 · NO LIFE LOST", 1]], et: 9, opened: true }],
];
const KEYFIX = (ts, lay, css, w) => ts > 1.1 && lay !== "d" && css < 1 && w.state === "LOSE";
export function golden() {
  const out = [];
  for (const ts of [1, 1.25]) {
    setTextScale(ts);
    for (const kind of ["2d", "iso"]) {
      const B = overlayBox(kind);
      for (const touch of [false, true]) for (const css of [1, 0.65, 0.9]) for (const tags of [false, true]) {
        const o = { css, world: { level: 3, heat: tags ? 2 : 0, pace: 0, pact: 0 }, time: false };
        out.push(["pause", ts, kind, touch, css, tags, pauseGeom(B, touch, o)]);
        const h = [];
        for (let y = 0; y < B.h; y += 13) for (let x = 0; x < B.w; x += 17) h.push(pauseHit(x, y, B, touch, o));
        out.push(h.join(","));
      }
      for (const lay of ["d", "l", "p"]) for (const css of [1, 0.65]) for (const [w, r] of WORLDS) {
        if (KEYFIX(ts, lay, css, w)) continue; // GAME OVER's touch foot row at 125 % on a phone's #c: its labels overran their keys (the fix, held below)
        const run = { ...r, lay, css }, P = endPlan(B, w, run, TM, { lay, css, page: 0, m: null });
        out.push(["end", ts, kind, lay, css, w.state, w.level, P.G]);
      }
    }
    const B = overlayBox("2d");
    for (const touch of [false, true]) for (const css of [1, 0.65]) {
      const L = { ...md.layout(B.w, B.h, undefined, css), paused: true, focus: 0 };
      out.push(["set", ts, touch, css, md.settingsGeom(L, touch, optRows(false)), md.settingsGeom(L, touch, optRows(true)), md.graphicsGeom(L, touch)]);
    }
  }
  setTextScale(1);
  return sha(J(out));
}
const GOLD = "f384e8324b348427"; // re-pinned for v208 (run ends centred in #c's whole box, no HUD_TOP): without the run-end rects the hash is unchanged (560ce9b6647b43b3 before and after); was 5769fda632c575f0, taken at 3f772be
{
  const g = golden();
  check("d / l / the #c fallback: PAUSE, run-end and paused SETTINGS / GRAPHICS geometry on the board's box byte-identical to before Task 9.8", g === GOLD, g);
}

/* ---- a transform-aware recorder: every fillText in device space (0.6 em x 1.08, the page tests' conservative advance) ---- */
const recorder = (canvas) => {
  const texts = [], stack = [];
  let m = [1, 0, 0, 1, 0, 0];
  const o = {
    font: "10px x", textAlign: "left", textBaseline: "alphabetic", globalAlpha: 1, canvas,
    measureText(s) { const r = /(\d+(?:\.\d+)?)px/.exec(o.font); return { width: String(s).length * 0.6 * 1.08 * (r ? +r[1] : 10) }; },
    fillText(s, x, y) { const w = o.measureText(s).width, a = o.textAlign, x0 = a === "center" ? x - w / 2 : a === "right" || a === "end" ? x - w : x; texts.push({ s: String(s), x: x0 * m[0] + m[4], w: w * m[0], y: y * m[3] + m[5] }); },
    save() { stack.push(m.slice()); }, restore() { m = stack.pop() || [1, 0, 0, 1, 0, 0]; },
    translate(x, y) { m[4] += x * m[0]; m[5] += y * m[3]; }, scale(a, b) { m[0] *= a; m[3] *= b; },
    setTransform(a, b, c, d, e, f) { m = [a, b, c, d, e, f]; }, getTransform: () => ({ a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] }),
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
  };
  return { texts, c: new Proxy(o, { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => ((t[p] = v), true) }) };
};
/* a fake page for mountFit: window, document, body[data-lay] and an #sh canvas whose rect is its CSS box */
function mkDom(W, H, touch, dpr = 1) {
  const attrs = {}, L = {}, log = [];
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
  const win = { innerWidth: W, innerHeight: H, addEventListener() {} };
  if (touch) win.ontouchstart = null;
  globalThis.window = win; globalThis.document = doc; globalThis.devicePixelRatio = dpr;
  return { sh, ctx, log, attrs, doc };
}
const undo = () => { delete globalThis.window; delete globalThis.document; delete globalThis.devicePixelRatio; };
const mkCv = (w = 600, h = 520) => { const L = {}; return { width: w, height: h, style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }), addEventListener: (t, f) => { (L[t] = L[t] || []).push(f); }, fire: (t, ev) => (L[t] || []).slice().forEach((f) => f({ currentTarget: null, ...ev })) }; };
const { mountFit, shellGeo, PORT_GAME } = await import("../src/app/fit.js");
const { shellMode, drawShell, dims } = await import("../src/render/shellview.js");
const { mountPointer } = await import("../src/app/pointer.js");
const { SCREEN, createMenuApp } = await import("../src/app/menuapp.js");
const { createControlsPage } = await import("../src/app/controlspage.js");
const { DEF_CONTROLS } = await import("../src/app/controls.js");
const probe = await import("../src/render/kit/probe.js");

/* ---- shellMode: on p, PAUSE and every WIN / LOSE draw on #sh (3); d and l draw them on the stage (2, Task 9.12) ---- */
{
  const W = (state, level = 1, o = {}) => ({ state, level, ...o });
  check("p: PAUSE, a mid-run WIN (LEVEL CLEAR), a finale WIN and LOSE -> 3; PLAY -> 0", ["PAUSE", "LOSE"].every((s) => shellMode(SCREEN.GAME, W(s), "p") === 3) && shellMode(SCREEN.GAME, W("WIN", 1), "p") === 3 && shellMode(SCREEN.GAME, W("WIN", 5), "p") === 3 && shellMode(SCREEN.GAME, W("PLAY"), "p") === 0);
  check("d / l (and no lay): PAUSE 2, a mid-run WIN 2, a run end 2 (the stage over #c, Task 9.12); PLAY 0", ["d", "l", undefined].every((l) => shellMode(SCREEN.GAME, W("PAUSE"), l) === 2 && shellMode(SCREEN.GAME, W("WIN", 1), l) === 2 && shellMode(SCREEN.GAME, W("LOSE"), l) === 2 && shellMode(SCREEN.GAME, W("WIN", 5), l) === 2 && shellMode(SCREEN.GAME, W("PLAY"), l) === 0));
  check("p: the shell pages are still 1", shellMode(SCREEN.MENU, W("PAUSE"), "p") === 1);
}

/* ---- fit.shell(3): #sh shown, taking taps, its box the space under the HUD plate (PORT_GAME.top) to the viewport's foot ---- */
const PHONES = [[393, 852], [375, 667]];
for (const [W, H] of PHONES) {
  const D = mkDom(W, H, true, 3);
  try {
    const fit = mountFit(mkCv()), g = shellGeo(W, H, 600, 520, "p"), sh = fit.shell(3), b = sh && sh.box, r = b && b.getBoundingClientRect();
    check(`p ${W}x${H}: fit.shell(3) shows #sh taking taps and hands the over box: #sh's width and scale, from y ${PORT_GAME.top} to the foot`,
      !!b && b.over === true && !D.sh.hidden && D.sh.style.pointerEvents === "" && b.width === g.w && b.css === g.s && Math.abs(b.height * g.s - (H - PORT_GAME.top)) < 1e-6 && r.top === PORT_GAME.top && Math.abs(r.height - (H - PORT_GAME.top)) < 1e-6 && Math.abs(r.width - g.w * g.s) < 1e-6, J([b && b.width, b && b.height, r]));
    const T = D.log.filter((q) => q[0] === "setTransform").pop(), kx = D.sh.width / g.w, ky = D.sh.height / g.h;
    check(`p ${W}x${H}: the context is cleared and set so box (0, 0) is #sh's (0, ${PORT_GAME.top} CSS px)`, !!T && Math.abs(T[1] - kx) < 1e-9 && Math.abs(T[4] - ky) < 1e-9 && Math.abs(T[6] - (PORT_GAME.top / g.s) * ky) < 1e-6 && Math.abs(b.top - PORT_GAME.top / g.s) < 1e-9, J(T));
    check(`p ${W}x${H}: fit.over() is that box; fit.box() (the shell pages' box) is null`, fit.over() === b || J(fit.over()) === J(b), J(fit.over()));
    check(`p ${W}x${H}: fit.box() is null while the over box shows`, fit.box() === null);
    fit.shell(0);
    check(`p ${W}x${H}: off again, #sh hidden and no over box`, D.sh.hidden && fit.over() === null);
  } finally { undo(); }
}
{
  const D = mkDom(400, 440, true, 3);
  try { const cv = mkCv(), fit = mountFit(cv), s3 = fit.shell(3); check("p with no shell box (400x440): fit.shell(3) is the stage (Task 9.12): #sh over #c, click-through, #c's own box, no over box", !!s3 && s3.box === cv && !D.sh.hidden && D.sh.style.pointerEvents === "none" && fit.over() === null); } finally { undo(); }
}

/* ---- the over box's pages: PAUSE one list page, GAME OVER and LEVEL CLEAR unpaged at text 1, every key holding its label, at 1 and 1.25 ---- */
const overBox = (W, H) => { const D = mkDom(W, H, true, 3); try { const fit = mountFit(mkCv()); return fit.shell(3).box; } finally { undo(); } };
for (const [W, H] of PHONES) for (const ts of [1, 1.25]) {
  setTextScale(ts);
  const box = overBox(W, H), B = overlayBox("2d", box), css = box.css, tg = `p ${W}x${H} at ${ts}`;
  check(`${tg}: overlayBox(kind, the over box) is the box itself, with no HUD clearance`, B.w === box.width && B.h === box.height && B.free === true, J(B));
  for (const tags of [false, true]) {
    const o = { css, world: { level: 3, heat: tags ? 2 : 0, pace: tags ? 1 : 0, pact: 0 }, time: false }, G = pauseGeom(B, true, o), R = G.rows;
    const gaps = R.slice(1).map((q, i) => (q.y0 - R[i].y1) * css);
    check(`${tg}${tags ? " (a tag row)" : ""}: PAUSE is one list, rows >= 44 CSS px and >= 8 apart, the plate inside the box`,
      G.mode === "list" && G.floored && R.every((q) => q.h * css >= 44) && gaps.every((g) => g >= 8 - 1e-9) && G.y >= 0 && G.y + G.h <= B.h && G.x >= 0 && G.x + G.w <= B.w, J([G.mode, R.map((q) => q.h * css), gaps]));
    const ys = R.map((q) => pauseHit(q.cx, q.cy, B, true, o));
    check(`${tg}${tags ? " (a tag row)" : ""}: each PAUSE row's centre taps to itself`, J(ys) === J([0, 1, 2, 3]), J(ys));
  }
  for (const [w, r] of WORLDS) {
    const run = { ...r, lay: "p", css }, R = recorder({ ownerDocument: { body: { getAttribute: () => "p" } } });
    drawOverlay(R.c, w, B.w, B.h, B.w / 2, B.h / 2, { view: 0, cursor: 0, touch: true, css }, TM, run, null, B);
    const P = endPlan(B, w, run, TM, { lay: "p", css, page: 0, m: R.c }), G = P.G, nm = w.state + " " + w.level;
    if (ts === 1 && (w.state === "LOSE" || w.level === 2)) check(`${tg}: ${nm} fits one page, unscaled`, G.pages === 1 && !G.scaled, J([G.pages, G.scaled]));
    check(`${tg}: ${nm}: the plate inside the box`, G.plate.y >= 0 && G.plate.y + G.plate.h <= B.h + 0.5 && G.plate.x >= 0 && G.plate.x + G.plate.w <= B.w + 0.5, J(G.plate));
    const bad = [];
    for (const [k, q] of Object.entries(G.keys)) {
      if (k === "up" || k === "down") continue;
      if (q.h / G.u < 44 - 1e-9) bad.push(k + " under 44");
      for (const t of R.texts) { const cx = t.x + t.w / 2; if (cx >= q.x && cx <= q.x + q.w && t.y >= q.y && t.y <= q.y + q.h && (t.x < q.x + 2 * G.u || t.x + t.w > q.x + q.w - 2 * G.u)) bad.push(k + ":" + t.s); }
    }
    check(`${tg}: ${nm}: every key at least 44 CSS px tall and its label whole inside it`, bad.length === 0, bad.join());
  }
  const PL = { ...md.layout(B.w, B.h, undefined, css), paused: true, free: true, focus: 0 }, sg = md.settingsGeom(PL, true, optRows(false));
  check(`${tg}: a PAUSE SETTINGS view in the over box: rows >= 44 CSS px, the plate inside the box, using the room the board box did not have`,
    Object.values(sg.rows).every((q) => q.h * css >= 44 - 1e-6) && sg.plate.y >= 0 && sg.plate.y + sg.plate.h <= B.h + 0.5 && sg.plate.h * css > 340, J([sg.plate, sg.pages.length]));
}
setTextScale(1);
/* GAME OVER's foot keys where its labels overran them before (a phone's #c at 125 %, and the finale's halves): each label now fits its key with
   8 px clear, whole or broken once at its space (the board box has no room to stack them), never scaled under the floors, and drawn inside it */
for (const lay of ["l", "p"]) for (const [w, r] of [WORLDS[0], WORLDS[3]]) {
  setTextScale(1.25);
  const B = overlayBox("2d"), R = recorder({ ownerDocument: { body: { getAttribute: () => lay } } }), run = { ...r, lay, css: 0.65 };
  const G = endPlan(B, w, run, TM, { lay, css: 0.65, page: 0, m: R.c }).G, ln = G.lines || {};
  R.c.font = T.label(16);
  const wd = (s) => R.c.measureText(s).width, need = (k, s) => (ln[k] ? Math.max(...ln[k].map(wd)) : wd(s)) + 16;
  const ok = [["menu", "MENU"], ["copy", "COPY RESULT"], ["map", "COPY MAP"]].every(([k, s]) => !G.keys[k] || G.keys[k].w / G.u >= need(k, s) - 1e-9);
  drawOverlay(R.c, w, B.w, B.h, B.w / 2, B.h / 2, undefined, TM, run, null);
  const bad = [];
  for (const [k, q] of Object.entries(G.keys)) for (const t of R.texts) { const cx = t.x + t.w / 2; if (cx >= q.x && cx <= q.x + q.w && t.y >= q.y && t.y <= q.y + q.h && (t.x < q.x + 2 * G.u || t.x + t.w > q.x + q.w - 2 * G.u)) bad.push(k + ":" + t.s); }
  check(`${lay} #c at 125 % (${w.state} ${w.level}): MENU, COPY RESULT and COPY MAP each hold their label with 8 px clear, unscaled, every label drawn inside its key`, ok && !G.scaled && bad.length === 0, J([G.keys, ln, bad]));
  setTextScale(1);
}

/* ---- taps through the real pointer path on #sh land on the drawn rects; a tap over the HUD plate does nothing ---- */
const mkApp = (screen) => { const a = createMenuApp({ settings: {}, controls: createControlsPage({ get: () => DEF_CONTROLS, set() {}, padView: () => ({ state: "none" }), say() {} }) }); a.screen = screen; return a; };
const HIT = (getWorld, run, fitRef) => ({ overlayBox, pauseHit, touchLay, controlsHit: () => null, dims, menuHit: md.menuHit, settingsHit: md.settingsHit, graphicsHit: md.graphicsHit, guideHit: md.guideHit, enemiesHit: md.enemiesHit, levelHit: md.levelHit, scoresHit: md.scoresHit, statsHit: md.statsHit, recTabHit: md.recTabHit, layout: md.layout,
  endHit: (x, y) => endHitAt(x, y, "2d", getWorld(), run, TM, fitRef.fit.over()) });
for (const [W, H] of PHONES) {
  const D = mkDom(W, H, true, 3);
  try {
    const cv = mkCv(), fit = mountFit(cv), sh = fit.shell(3), box = sh.box, B = overlayBox("2d", box), css = box.css, keys = [], log = [];
    const world = { state: "PAUSE", level: 3, heat: 0, pace: 0, pact: 0 }, app = mkApp(SCREEN.GAME), input = { _intent: { fire: true }, onUiKey: (k) => keys.push(k) };
    app.confirm = () => log.push(app.pauseCursor); app.pauseBack = () => log.push("back");
    const run = { ...WORLDS[0][1], lay: "p", css };
    mountPointer({ canvas: cv, fit, input, app, world, kind: () => "2d", ctl: () => null, hit: HIT(() => world, run, { fit }) });
    const G = pauseGeom(B, true, { css, world, time: false }), at = (x, y) => ({ clientX: x * css, clientY: PORT_GAME.top + y * css, pointerType: "touch" });
    for (const q of G.rows) D.sh.fire("pointerdown", at(q.cx, q.cy));
    check(`p ${W}x${H}: a tap on #sh at each drawn PAUSE row's centre confirms that row`, J(log) === J([0, 1, 2, 3]), J(log));
    log.length = 0;
    D.sh.fire("pointerdown", { clientX: W / 2, clientY: 60, pointerType: "touch" });
    app.pauseView = 1; D.sh.fire("pointerdown", { clientX: 8, clientY: 60, pointerType: "touch" });
    check(`p ${W}x${H}: a tap on #sh over the HUD plate does nothing (the list, and a SETTINGS view: no back out)`, log.length === 0, J(log));
    app.pauseView = 1; app.optRow = 0;
    const PL = { ...md.layout(B.w, B.h, undefined, css), paused: true, free: true, focus: 0 }, sg = md.settingsGeom(PL, true, app.optRows()), l0 = sg.order[0], r0 = sg.rows[l0];
    let hit = -9; app.confirm = () => { hit = app.optRow; };
    app.optRow = 3; D.sh.fire("pointerdown", at(r0.x + r0.w / 2, r0.y + r0.h / 2));
    check(`p ${W}x${H}: a PAUSE SETTINGS view: a tap at its first drawn row's centre confirms that row`, hit === 0, hit);
    app.pauseView = 0;
    world.state = "LOSE"; fit.shell(3);
    const E = endPlan(B, world, run, TM, { lay: "p", css, page: 0, m: null }).G;
    for (const k of ["main", "menu", "copy", "map"]) { const q = E.keys[k], ev = at(q.x + q.w / 2, q.y + q.h / 2); D.sh.fire("pointerdown", ev); D.sh.fire("pointerup", ev); }
    check(`p ${W}x${H}: GAME OVER: a tap on #sh at each drawn key's centre is that key (Enter, Escape, C, B) on its pointerup`, J(keys) === J(["Enter", "Escape", "KeyC", "KeyB"]), J(keys));
  } finally { undo(); }
}

/* ---- PAUSE view 3 (CONTROLS, pages/controls.js) on the over box: its plate inside the box, rows >= 44 CSS px, a tap at a drawn row is that row ---- */
{
  const { loadControlsArt, controlsGeo, controlsHit } = await import("../src/render/shellview.js");
  await loadControlsArt();
  for (const [W, H] of PHONES) {
    const D = mkDom(W, H, true, 3);
    try {
      const cv = mkCv(), fit = mountFit(cv), box = fit.shell(3).box, css = box.css, app = mkApp(SCREEN.GAME), taps = [], view = app.controls.view(0);
      const G = controlsGeo(box, "2d", true, view), rows = (G.pages[0] || []).map((l) => [l, G.rows[l], G.hit[l]]);
      check(`p ${W}x${H}: PAUSE CONTROLS on the over box: the plate inside it, every row on its first page >= 44 CSS px`,
        G.plate.y >= 0 && G.plate.y + G.plate.h <= box.height + 0.5 && rows.length > 0 && rows.every(([, r]) => r.h * css >= 44 - 1e-6), J([G.plate, box.height, rows.map(([l, r]) => [l, r.h * css])]));
      app.pauseView = 3;
      mountPointer({ canvas: cv, fit, input: { _intent: { fire: true }, onUiKey() {} }, app, world: { state: "PAUSE", level: 2 }, kind: () => "2d", ctl: () => ({ tap: (v) => taps.push(v) }), hit: { ...HIT(() => ({ state: "PAUSE" }), {}, { fit }), controlsHit } });
      const [l0, , h0] = rows[0];
      D.sh.fire("pointerdown", { clientX: (h0.x + h0.w / 2) * css, clientY: PORT_GAME.top + (h0.y + h0.h / 2) * css, pointerType: "touch" });
      D.sh.fire("pointerdown", { clientX: 8, clientY: 60, pointerType: "touch" });
      check(`p ${W}x${H}: a tap on #sh at the first drawn CONTROLS row is that row; a tap over the HUD plate does nothing`, taps.length === 1 && taps[0] && taps[0].row === G.order.indexOf(l0), J(taps));
    } finally { undo(); }
  }
}

/* ---- drawShell on the over box: the page drawn on #sh with the over box's css, the probe naming #sh and the box's place on it ---- */
{
  const D = mkDom(393, 852, true, 3);
  try {
    const fit = mountFit(mkCv()), box = fit.shell(3).box, R = recorder(D.sh), app = mkApp(SCREEN.GAME), world = { state: "PAUSE", level: 2, heat: 0, pace: 0, pact: 0, time: 1 };
    const ro = { hud: true, over: true, pause: { view: 0, cursor: 0, css: 0.6 }, time: TM, run: { ...WORLDS[0][1], lay: "p", css: 0.6 }, toast: null };
    probe.setOn(true);
    drawShell(R.c, app, world, box, "2d", () => [], () => 0, () => ({}), ro);
    const s = probe.snapshot();
    probe.setOn(false);
    const G = pauseGeom(overlayBox("2d", box), true, { css: box.css, world, time: false }), res = R.texts.find((t) => t.s === "RESUME");
    check("drawShell, over: PAUSED and its rows drawn on #sh at the over box's geometry (its css, not #c's)", R.texts.some((t) => t.s === "PAUSED") && !!res && res.y >= G.rows[0].y0 && res.y <= G.rows[0].y1, J(R.texts.slice(0, 6)));
    check("the probe names #sh, the over box and its place on #sh", !!s.box && s.box.el === "sh" && s.box.w === box.width && s.box.h === box.height && Math.abs(s.box.oy - box.top) < 1e-9 && s.box.fw === shellGeo(393, 852, 600, 520, "p").w && s.box.fh === shellGeo(393, 852, 600, 520, "p").h, J(s.box));
  } finally { undo(); }
}

/* ---- createGame on a 393 x 852 phone: main's frame puts PAUSE and every run end on #sh's over box and nothing of them on #c; a tap there acts ---- */
{
  const { createGame } = await import("../src/main.js");
  await import("../src/core/board3.js");
  const D = mkDom(393, 852, true, 3), shText = [], cText = [], L = {};
  const pen = (out, cv) => new Proxy({}, { get: (t, p) => (p === "fillText" ? (s) => out.push(String(s)) : p === "measureText" ? (s) => ({ width: String(s).length * 6 }) : p === "canvas" ? cv : p === "getTransform" ? () => ({ a: 1, b: 0 }) : p in t ? t[p] : () => ({ addColorStop() {} })), set: (t, p, v) => ((t[p] = v), true) });
  const shCtx = pen(shText, D.sh); D.sh.getContext = () => shCtx;
  const cv = { width: 600, height: 520, style: {}, ownerDocument: D.doc, getBoundingClientRect: () => ({ left: 8, top: 160, width: 377, height: 326.7 }), addEventListener: (t, f) => { (L[t] = L[t] || []).push(f); }, removeEventListener() {} };
  const cctx = pen(cText, cv); cv.getContext = () => cctx;
  D.doc.addEventListener = () => {};
  try {
    const g = createGame(cv, { seed: 7 });
    { const r0 = g.renderer.render.bind(g.renderer); g.renderer.render = (w, dt, ro) => { g.ro = ro; return r0(w, dt, ro); }; } // the run facts the page and the tap read
    let t = 0;
    const tick = (n = 1) => { for (let i = 0; i < n; i++) { t += 16; g.loop(t); } };
    const frame = () => { shText.length = 0; cText.length = 0; tick(); };
    g.app.cabinetSeen = true; g.app.skip(); frame(); g.app.confirm(); frame();
    check("p: GAME PLAY: #sh hidden", D.attrs["data-lay"] === "p" && g.app.screen === SCREEN.GAME && g.world.state === "PLAY" && D.sh.hidden, J([D.attrs["data-lay"], g.world.state, D.sh.hidden]));
    g.input.onPause(); frame();
    check("p: PAUSE: #sh shown and taking taps, PAUSED on #sh, nothing of PAUSE on #c", g.world.state === "PAUSE" && !D.sh.hidden && D.sh.style.pointerEvents === "" && shText.includes("PAUSED") && !cText.includes("PAUSED") && !cText.includes("RESUME"), J([shText.slice(0, 6), cText.slice(0, 6)]));
    for (const [v, word] of [[1, "MUSIC"], [2, "FRAME RATE"]]) {
      g.app.pauseView = v; frame();
      check(`p: PAUSE view ${v}: the inline page on #sh (${word}), none of it on #c`, !D.sh.hidden && shText.includes(word) && !cText.includes(word), J(shText.slice(0, 8)));
    }
    g.app.pauseView = 0; g.input.onPause(); frame();
    g.world.state = "WIN"; frame();
    check("p: a mid-run WIN (LEVEL CLEAR) on #sh, none of it on #c", g.world.level === 1 && !D.sh.hidden && D.sh.style.pointerEvents === "" && shText.includes("NEXT LEVEL") && !cText.includes("NEXT LEVEL"), J([shText, cText]));
    g.world.state = "LOSE"; frame();
    check("p: GAME OVER on #sh, taking taps, none of it on #c", !D.sh.hidden && D.sh.style.pointerEvents === "" && shText.includes("GAME OVER") && !cText.includes("GAME OVER"), J(shText.slice(0, 8)));
    /* TRY AGAIN found through the hit main taps with, on the over box (#sh's width and scale, from y PORT_GAME.top), then tapped in client px on #sh */
    const sg = shellGeo(393, 852, 600, 520, "p"), box = { over: true, width: sg.w, height: (852 - PORT_GAME.top) / sg.s, css: sg.s };
    let hx = 0, hy = 0;
    for (let y = 0; y < box.height && !hx; y += 4) for (let x = 0; x < box.width; x += 4) if (endHitAt(x, y, "2d", g.world, g.ro.run, g.ro.time, box) === "main") { hx = (x + 6) * sg.s; hy = PORT_GAME.top + (y + 6) * sg.s; break; }
    D.sh.fire("pointerdown", { clientX: hx, clientY: hy, button: 0, pointerType: "touch", preventDefault() {} });
    D.sh.fire("pointerup", { clientX: hx, clientY: hy, button: 0, pointerType: "touch", preventDefault() {} });
    tick(3);
    check("p: LOSE: a tap on #sh at TRY AGAIN is the game's Space: a fresh run at room 1, #sh hidden again", hx > 0 && g.world.state === "PLAY" && g.world.level === 1 && D.sh.hidden, J([hx, hy, g.world.state]));
    g.world.state = "LOSE"; frame();
    g.input.onUiKey("Enter"); tick(3);
    check("p: LOSE: Enter still starts a fresh run", g.world.state === "PLAY" && g.world.level === 1, g.world.state);
  } finally { undo(); }
}

console.log("\n  PHONE OVERLAYS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
