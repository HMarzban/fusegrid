/* UI upgrade v202 Task 6.3: the CONTROLS page on the world kit (src/render/pages/controls.js, lazy through shellview.loadControlsArt). The owner,
   verbatim: "I think you forgot to work on the cntroller side ha?". One geometry for draw and tap (rows by id), the round 7 C7-controls frames
   (desk 1366 x 768 with the pane and the drawing's callouts at 1 and 1.25; the phone column in CSS px), the touch floors (44 / 8 CSS px, paged
   where they do not fit), the desk text floors, the plate centred in a tall box, no CONSOLE PANEL token and no ellipsis, the steady-frame budget,
   PAUSE view 3 on the played room's tokens, the LOADING plate until the page lands, and the probe record the gates read. */
import { readFileSync } from "node:fs";
import { rec } from "./lib/textrec.mjs";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined && !cond ? " -> " + detail : ""));
}
const J = (v) => JSON.stringify(v);
const SV = await import("../src/render/shellview.js");
const { SCREEN, createMenuApp } = await import("../src/app/menuapp.js");
const { createControlsPage } = await import("../src/app/controlspage.js");
const { DEF_CONTROLS } = await import("../src/app/controls.js");
const { worldTokens, CONST } = await import("../src/render/kit/tokens.js");
const { setTextScale } = await import("../src/render/kit/type.js");
const probe = await import("../src/render/kit/probe.js");
const { shellGeo, fitBox } = await import("../src/app/fit.js");
const { DEF_KEY, DEF_PAD } = await import("../src/render/controlsgeo.js");

const mkApp = (state = "ready") => createMenuApp({ settings: {}, controls: createControlsPage({ get: () => DEF_CONTROLS, set() {}, padView: () => ({ state, name: "CONTROLLER 1 · STANDARD", rumble: true }), say() {} }) });
const PLAY = { state: "PLAY", time: 0 }, PAUSE = { state: "PAUSE", time: 0, level: 3 };

/* ---- before the page lands: the kit's one LOADING plate, the canvas inert (synchronously, before any import) ---- */
{
  const a = mkApp(); a.screen = SCREEN.CONTROLS;
  const R = rec(); SV.drawShell(R.ctx, a, PLAY, null, "2d", () => [], () => 0);
  const w = R.texts.map((t) => t.s);
  check("before the page lands: the LOADING plate (CONTROLS + LOADING), no row; a tap on or off the plate is inert ({}, R1 cohesion 1)", w.includes("CONTROLS") && w.includes("LOADING") && !w.includes("BOMB") && J(SV.controlsHit(a.controls.view(0), 300, 260, null, "2d", false)) === "{}" && J(SV.controlsHit(a.controls.view(0), 4, 4, null, "2d", false)) === "{}", J(w));
  check("the LOADING plate is the kit's (no CONSOLE PANEL fill)", !R.paints.some((q) => q.style === "rgba(10,14,24,0.94)") && R.paints.some((q) => q.style === worldTokens(1).bedA));
}
await SV.loadControlsArt();
const P = await import("../src/render/pages/controls.js");
const PR = { state: "ready", name: "CONTROLLER 1 · STANDARD", rumble: true };
const keyV = (o = {}) => ({ tab: "key", device: "key", row: 1, pad: { state: "none" }, key: DEF_KEY, binds: DEF_PAD, stick: "L", dead: 25, vib: 2, stickVal: [0, 0], reads: "", drift: 0, armed: false, swap: null, status: "", capture: null, echo: null, ...o });
const padV = (o = {}) => keyV({ tab: "pad", device: "pad", pad: PR, ...o });
const SW = { shown: true, state: "idle" }, swV = (o = {}) => padV({ sw2: SW, ...o }); // Task 3: the CONNECT row shown (switch2.js usbReach true)
const ctr = (r) => [r.x + r.w / 2, r.y + r.h / 2];
const inBox = (r, W, H) => r.x >= -0.01 && r.y >= -0.01 && r.x + r.w <= W + 0.01 && r.y + r.h <= H + 0.01;
const DESKS = [[1366, 768], [1366, 657], [1280, 720], [1024, 768]];

/* ---- the shell: CONTROLS covers the board, routes to the page ---- */
check("shellCovers(SCREEN.CONTROLS): no look rasters a board the page covers", SV.shellCovers(SCREEN.CONTROLS));
{
  const a = mkApp(); a.screen = SCREEN.CONTROLS;
  const R = rec(); SV.drawShell(R.ctx, a, PLAY, null, "2d", () => [], () => 0);
  check("shellview routes SCREEN.CONTROLS to the world-kit page (the room's bed, the tabs, the rows)", R.texts.some((t) => t.s === "KEYBOARD") && R.texts.some((t) => t.s === "CONTROLLER") && R.paints.some((q) => q.style === worldTokens(1).bedA));
  a.screen = SCREEN.GAME; a.pauseView = 3; a.level = 1;
  const Q = rec(); SV.drawShell(Q.ctx, a, PAUSE, null, "2d", () => [], () => 0);
  check("PAUSE view 3 wears the PLAYED room's tokens (FACTORY, level 3), never the menu's, and no room under it (the board shows through the veil)", Q.paints.some((q) => q.style === worldTokens(3).bedA) && !Q.paints.some((q) => q.style === worldTokens(1).bedA) && Q.texts.some((t) => t.s === "PAUSED · LEVEL 3"));
}

/* ---- desk: the arrangements, centred, the text floors, the callouts ---- */
for (const ts of [1, 1.25]) {
  setTextScale(ts);
  for (const [W, H] of DESKS) {
    const F = { W, H }, G = P.controlsGeom(F, padV()), tg = `${W}x${H} @${ts}`;
    check(`desk ${tg}: the desk (list beside the pane), u >= 0.96, the plate and its ring inside the box`, G.mode === "desk" && G.u >= 0.96 && inBox({ x: G.plate.x - G.T, y: G.plate.y - G.T, w: G.plate.w + 2 * G.T, h: G.plate.h + 2 * G.T }, W, H), J([G.mode, G.u]));
    const above = G.plate.y, below = H - G.plate.y - G.plate.h;
    check(`desk ${tg}: centred vertically (top margin a minimum)`, Math.abs(above - below) <= 1, J([above, below]));
    probe.setOn(true);
    {
      const Gs = P.controlsGeom(F, swV()), a = Gs.plate.y, b = H - Gs.plate.y - Gs.plate.h;
      check(`desk ${tg} with the CONNECT row: still the desk, u >= 0.96, centred, the plate and its ring inside the box`, Gs.mode === "desk" && Gs.u >= 0.96 && Math.abs(a - b) <= 1 && inBox({ x: Gs.plate.x - Gs.T, y: Gs.plate.y - Gs.T, w: Gs.plate.w + 2 * Gs.T, h: Gs.plate.h + 2 * Gs.T }, W, H), J([Gs.mode, Gs.u, a, b]));
    }
    for (const v of [padV(), keyV(), padV({ pad: { state: "none" } }), padV({ row: 6 }), keyV({ row: 7, armed: true }), swV({ row: 7 }), swV({ row: 7, pad: { state: "none" } }), swV({ row: 8, armed: true })]) {
      const r = rec(); P.drawControlsPage(r.ctx, F, v, { level: 1, tap: false });
      const S = probe.snapshot(), small = S.texts.filter((t) => t.capH < (t.role === "primary" ? 14 : 11) - 0.01), out = S.texts.filter((t) => !inBox({ x: t.x, y: t.y, w: t.w, h: t.capH }, W, H));
      check(`desk ${tg} ${v.tab}${v.pad.state === "none" ? " (no controller)" : ""} row ${v.row}: every text over the floors (14 / 11 px cap) and inside the box`, !small.length && !out.length, J([small.map((t) => t.s + ":" + t.capH.toFixed(1)), out.map((t) => t.s)]));
      check(`desk ${tg} ${v.tab} row ${v.row}: no ellipsis anywhere`, !r.texts.some((t) => /…/.test(t.s)));
    }
    probe.setOn(false);
    if ((W === 1366 && H === 768) || (W === 1280 && H === 720)) for (const v of [padV(), keyV(), swV()]) {
      const r = rec(); P.drawControlsPage(r.ctx, F, v, { level: 1, tap: false });
      const L = P._dbg.last.live, words = L.plan ? L.plan.labels.flatMap((l) => l.lines.map((q) => q.s)) : [];
      check(`desk ${tg} ${v.tab === "key" ? "keyboard" : "controller"}: the drawing carries its callouts (every bound action named)`, !!L.plan && ["BOMB", "THROW", "REMOTE", "PAUSE", "MOVE"].every((w) => words.includes(w)), J(words));
    }
  }
}
setTextScale(1);
{
  const G = P.controlsGeom({ W: 1366, H: 1100 }, padV());
  check("a tall desk window: the plate centres (no more empty under it than over it)", Math.abs(G.plate.y - (1100 - G.plate.y - G.plate.h)) <= 1);
}

/* ---- hit = paint: every row, tab, page key, off and inert, in every arrangement ---- */
const BOXES = [["desk 1366x768", { W: 1366, H: 768 }], ["desk 1024x768", { W: 1024, H: 768 }], ["col 600x520 (keyboard #c)", { W: 600, H: 520 }], ["PAUSE keys", { W: 600, H: 520, paused: true }]];
{ const g = shellGeo(393, 852, 600, 520); BOXES.push(["phone 393x852", { W: g.w, H: g.h, touch: true, shell: true, css: g.s }]); }
{ const g = shellGeo(375, 667, 600, 520); BOXES.push(["phone 375x667", { W: g.w, H: g.h, touch: true, shell: true, css: g.s }]); }
{ const f = fitBox(852, 393, true, 600, 520); BOXES.push(["landscape #c 852x393", { W: 600, H: 520, touch: true, css: f.s }]); }
{ const f = fitBox(667, 375, true, 600, 520); BOXES.push(["landscape #c 667x375", { W: 600, H: 520, touch: true, css: f.s }]); }
BOXES.push(["PAUSE touch #c 0.63", { W: 600, H: 520, touch: true, css: 0.63, paused: true }]);
BOXES.push(["tablet 1024x768 (touch shell)", { W: 1024, H: 768, touch: true, shell: true, css: 1 }]);
BOXES.push(["short touch 1024x600 (touch shell)", { W: 1024, H: 600, touch: true, shell: true, css: 1 }], ["short touch 800x600 (touch shell)", { W: 800, H: 600, touch: true, shell: true, css: 1 }]); // lane lesson 1: short touch windows
for (const ts of [1, 1.25]) {
  setTextScale(ts);
  for (const [nm, F] of BOXES) for (const v0 of [padV(), keyV(), swV(), swV({ pad: { state: "none" } })]) {
    const tg = `${nm} @${ts} ${v0.tab}${v0.sw2 ? " +CONNECT" + (v0.pad.state === "none" ? " (no controller)" : "") : ""}`, ids = P.controlsGeom(F, v0).order;
    let ok = true, drawnOk = true;
    ids.forEach((id, i) => {
      const v = { ...v0, row: i }, G = P.controlsGeom(F, v), r = G.rows[id], h = P.controlsHit(v, ...ctr(r), G);
      if (!h || h.row !== i) ok = false;
      const R = rec(); P.drawControlsPage(R.ctx, F, v, { level: 1, tap: false });
      const lab = P._dbg.last.Pl.rows[id].label;
      if (!R.texts.some((t) => t.s === lab.s && Math.abs(t.y - lab.y) < 0.01)) drawnOk = false;
    });
    check(`hit = paint: every row taps to itself on its own page, its label drawn there (${tg})`, ok && drawnOk);
    const G = P.controlsGeom(F, v0), [t0, t1] = G.tabs;
    check(`tabs: each taps to itself, KEYBOARD then CONTROLLER (${tg})`, P.controlsHit(v0, ...ctr(t0), G).tab === "key" && P.controlsHit(v0, ...ctr(t1), G).tab === "pad");
    const pl = G.plate;
    check(`off the plate is {off:1}, a miss on the plate is inert (${tg})`, P.controlsHit(v0, pl.x - 3, pl.y + 40, G).off === 1 && P.controlsHit(v0, pl.x + pl.w + 3, pl.y + 3, G).off === 1 && (!G.pane || Object.keys(P.controlsHit(v0, ...ctr(G.pane), G)).length === 0));
    if (G.back) check(`BACK backs out (${tg})`, P.controlsHit(v0, ...ctr(G.back), G).off === 1);
    if (F.touch) {
      const css = F.css > 0 ? F.css : 1, tgt = [...G.tabs, ...(G.back ? [G.back] : []), ...(G.keys ? [G.keys.up, G.keys.dn] : [])];
      const rows = G.pages.flatMap((pg, p) => pg.map((id) => P.controlsGeom(F, { ...v0, row: G.order.indexOf(id) }).rows[id]));
      const small = [...tgt, ...rows].filter((r) => Math.min(r.w, r.h) * css < 43.99);
      const gaps = G.pages.flatMap((pg) => pg.slice(1).map((id, k) => (G.rows[id].y - G.rows[pg[k]].y - G.rows[pg[k]].h) * css)).filter((gp) => gp < 7.99);
      check(`touch floors: rows, tabs, BACK and page keys >= 44 CSS px, rows >= 8 CSS px apart (${tg})`, !small.length && !gaps.length, J([small.length, gaps]));
      const bot = F.paused ? F.H - 8 : F.H;
      check(`touch: the plate and its ring inside the box${F.paused ? " and the pause band" : ""} (${tg})`, pl.y - G.T >= (F.paused ? 40 : -0.01) && pl.y + pl.h + G.T <= bot + 0.5, J([pl.y, pl.h, G.T]));
      if (G.keys) {
        const p0 = 0, d = P.controlsHit(v0, ...ctr(G.keys.dn), G), up = P.controlsHit(v0, ...ctr(G.keys.up), G);
        check(`paged: ▼ opens the next page on its first row, ▲ on the first page is inert (${tg})`, d && d.k === "page" && d.d === 1 && d.to === G.order.indexOf(G.pages[p0 + 1][0]) && up && up.k === "page" && up.to === null, J([d, up]));
      }
    }
  }
}
setTextScale(1);
{
  const capV = padV({ row: 2, capture: { action: "THROW", prompt: "PRESS A BUTTON", sub: "", foot: "START CANCELS" } });
  for (const [nm, F] of [["desk", { W: 1366, H: 768 }], ["col", { W: 600, H: 520 }], ["phone 393x852", (() => { const g = shellGeo(393, 852, 600, 520); return { W: g.w, H: g.h, touch: true, shell: true, css: g.s }; })()]]) {
    /* the drawing listens in place (the -capture frame): a tap on the plate, a row included, is inert (nothing rebinds by tap), off it cancels */
    const G = P.controlsGeom(F, capV), r0 = G.rows.MOVE, pl = G.plate;
    check(`listening (${nm}): a row and the tabs are inert, off the plate cancels ({off:1})`, Object.keys(P.controlsHit(capV, ...ctr(r0), G)).length === 0 && Object.keys(P.controlsHit(capV, ...ctr(G.tabs[0]), G)).length === 0 && P.controlsHit(capV, pl.x - 3, pl.y + 10, G).off === 1);
    const R = rec(); P.drawControlsPage(R.ctx, F, capV, { level: 1, tap: false });
    check(`listening (${nm}): the prompt for the action and the cancel words on the page, the drawing's ring on the action's button`, R.texts.some((t) => t.s.startsWith("PRESS A BUTTON")) && R.texts.some((t) => /CANCELS/.test(t.s)) && !!P._dbg.last.live.ring);
  }
  {
    const f = fitBox(852, 393, true, 600, 520), F = { W: 600, H: 520, touch: true, css: f.s }, G = P.controlsGeom(F, capV);
    check("listening on a box with no drawing (landscape #c): only the capture plate counts, the page under it taps off", !G.art && P.controlsHit(capV, G.plate.x + 4, G.plate.y + 4, G).off === 1 && Object.keys(P.controlsHit(capV, ...ctr(G.cap), G)).length === 0);
  }
}

/* ---- a controller on a touch layout: the cue line (lane lesson 6) ---- */
{
  const g = shellGeo(393, 852, 600, 520), F = { W: g.w, H: g.h, touch: true, shell: true, css: g.s, cue: true }, v = padV({ row: 1 });
  const G = P.controlsGeom(F, v), r = rec(); P.drawControlsPage(r.ctx, F, v, { level: 1, tap: false });
  const L = P._dbg.last.live, ps = L.foot ? L.foot.lines.flatMap((q) => q.ps) : [], seq = ps.map((q) => q.t || q.sep || (Array.isArray(q.cap) ? q.cap[0] : q.cap));
  const iB = seq.indexOf("BACK"), cue = G.d.cue;
  check("a controller on the phone column: the cue line, label first and keycap last (BACK EAST, CHANGE SOUTH), inside the plate", !!L.foot && iB >= 0 && seq[iB + 1] === "EAST" && seq.includes("CHANGE") && seq[seq.indexOf("CHANGE") + 1] === "SOUTH" && !!cue && cue.y + cue.h <= G.d.plate.y + G.d.plate.h + 0.01 && cue.x >= G.d.plate.x, J(seq));
  const ok = G.order.every((id, i) => { const vi = { ...v, row: i }, Gi = P.controlsGeom(F, vi), rr = Gi.rows[id]; return rr.h * g.s >= 43.99 && P.controlsHit(vi, ...ctr(rr), Gi).row === i; });
  check("with the cue line the rows stay 44 CSS px and every row taps itself", ok);
  const t = rec(); P.drawControlsPage(t.ctx, { ...F, cue: true }, v, { level: 1, tap: true });
  check("tap mode on the phone: no cue line (the BACK key and the tabs say it)", !P._dbg.last.live.foot);
}

/* ---- focus by label; tap mode shows none ---- */
{
  const tok = worldTokens(1);
  for (const [i, id] of [[0, "MOVE"], [3, "REMOTE"], [6, "VIBRATION"]]) {
    const r = rec(); P.drawControlsPage(r.ctx, { W: 1366, H: 768 }, padV({ row: i }), { level: 1, tap: false });
    const g = P._dbg.last.G.rows[id];
    check(`focus by label: row ${i} wears the band on ${id}'s rect`, P._dbg.last.foc === id && r.paints.some((q) => q.style === tok.band && q.box && Math.abs(q.box.y - g.y) < 1 && Math.abs(q.box.h - g.h) < 1));
  }
  const t = rec(); P.drawControlsPage(t.ctx, { W: 1366, H: 768, touch: true, shell: true, css: 1 }, padV({ row: 3 }), { level: 1, tap: true });
  check("tap mode shows no focus (ruling 5): no band, no ring on the drawing", P._dbg.last.foc === null && !P._dbg.last.live.ring);
}

/* ---- no CONSOLE PANEL token, no ellipsis, no clock, kit painters ---- */
{
  const src = readFileSync(new URL("../src/render/pages/controls.js", import.meta.url), "utf8");
  check("no CONSOLE PANEL token in the page (colours, plate fill, the menudraw kit)", !/#2a3550|#37f0d0|#dfe7f5|#7385ad|rgba\(10,14,24|menudraw\.js|paintRow\(c, x/.test(src));
  check("no ellipsis in the page's source, no clip()-to-ellipsis helper", !/…|\\u2026/.test(src) && !/function clip\b/.test(src));
  check("no filter, blur, shadow or pixel read in the paint paths", !/\.filter\s*=|shadowBlur|shadowColor|getImageData|toDataURL/.test(src));
  check("the page never reads src/app (render only)", !/from\s+["'][^"']*\/app\//.test(src));
  check("player words come from words.js CONTROLS_WORDS", /CONTROLS_WORDS as CW/.test(src) && !/"(PRESS AGAIN|SWAPPED|NO CONTROLLER|KEYBOARD|CONTROLLER 1)"/.test(src));
  const old = (() => { try { readFileSync(new URL("../src/render/controlsdraw.js", import.meta.url)); return true; } catch { return false; } })();
  check("the CONSOLE PANEL painter (controlsdraw.js) is gone", !old);
  const wire = readFileSync(new URL("../src/app/controlswire.js", import.meta.url), "utf8");
  check("the wire takes the kit pager's page key: it focuses the first row of the page it opens, nothing confirmed", /h\.k === "page" && h\.to != null\) page\.pick\(h\.to\)/.test(wire));
}

/* ---- the steady frame: cached layers, the budget, a cursor move ---- */
{
  const cache = await import("../src/render/kit/cache.js");
  class Cv { constructor(w, h) { this.width = w; this.height = h; this.r = rec(); } getContext() { return this.r.ctx; } }
  globalThis.OffscreenCanvas = Cv;
  cache.setFactory((w, h) => new Cv(w, h));
  try {
    const capL = (v) => ({ ...v, row: 2, capture: { action: "THROW", prompt: "PRESS A BUTTON", sub: "NOW WEST", foot: "ESC CANCELS · WEST KEEPS IT" } }); // Task 9.10: listening, the callout and the in-use plaque, holds the same budget
    for (const [nm, F] of [["desk 1366x768", { W: 1366, H: 768 }], ["phone 393x852", (() => { const g = shellGeo(393, 852, 600, 520); return { W: g.w, H: g.h, touch: true, shell: true, css: g.s }; })()]]) for (const v of [padV(), keyV(), capL(padV()), capL(keyV()), swV()]) {
      cache.release();
      const r = rec(); r.ctx.setTransform(2, 0, 0, 2, 0, 0);
      P.drawControlsPage(r.ctx, F, v, { level: 1, tap: false });
      const m0 = cache._dbg.misses, n0 = r.calls.length;
      P.drawControlsPage(r.ctx, F, v, { level: 1, tap: false });
      const calls = r.calls.slice(n0), mt = calls.filter((q) => q.op === "measureText").length;
      check(`steady frame (${nm} ${v.tab}): 0 misses, <= 400 canvas calls, <= 20 measureText`, cache._dbg.misses === m0 && calls.length <= 400 && mt <= 20, J([cache._dbg.misses - m0, calls.length, mt]));
      let miss = 0;
      for (let i = 0; i < P.controlsGeom(F, v).order.length; i++) { const m = cache._dbg.misses; P.drawControlsPage(r.ctx, F, { ...v, row: i }, { level: 1, tap: false }); miss += cache._dbg.misses - m; }
      if (!v.capture) check(`a cursor move over every row (${nm} ${v.tab}): 0 misses`, miss === 0 || (F.touch && P.controlsGeom(F, v).pages.length > 1), miss);
      check(`the cache inside the 24 MiB budget (${nm} ${v.tab})`, cache._dbg.bytes <= cache.BUDGET, cache._dbg.bytes);
    }
  } finally { delete globalThis.OffscreenCanvas; cache.release(); }
}

/* ---- the probe record ---- */
{
  probe.setOn(true);
  const r = rec(); P.drawControlsPage(r.ctx, { W: 1366, H: 768, shell: true }, padV(), { level: 1, tap: false });
  const S = probe.snapshot();
  check("probe: page controls, the plate, every row a list rect with one focused, the tabs a set", S.page === "controls" && S.rects.some((q) => q.name === "plate") && S.rects.filter((q) => q.kind === "list").length === 8 && S.rects.filter((q) => q.focus).length === 1 && S.rects.filter((q) => q.set === "tabs").length === 2);
  check("probe: the chosen pair (tab open vs not), the band pair, the drawing's ring (SOUTH on BOMB), a locked pair (the FIXED plaque)", ["chosen", "band", "ring", "locked"].every((k) => S.pairs.some((q) => q.kind === k)) && S.rects.some((q) => /^ring /.test(q.name)) && S.rects.some((q) => /^locked /.test(q.name)));
  check("probe: the callout labels are recorded texts", ["BOMB", "SOUTH", "THROW", "WEST"].every((w) => S.texts.filter((t) => t.s === w).length >= 2));
  { const q = rec(); P.drawControlsPage(q.ctx, { W: 1366, H: 768, shell: true }, swV(), { level: 1, tap: false });
    const Q = probe.snapshot();
    check("probe with the CONNECT row: nine list rects, SW2 among them, its label and door recorded", Q.rects.filter((q) => q.kind === "list").length === 9 && Q.rects.some((q) => q.name === "SW2") && Q.texts.some((t) => t.s === "SWITCH 2 CONTROLLER") && Q.texts.some((t) => t.s === "CONNECT")); }
  const n = rec(); P.drawControlsPage(n.ctx, { W: 1366, H: 768, shell: true }, padV({ pad: { state: "none" }, row: 5 }), { level: 1, tap: false });
  const N = probe.snapshot();
  check("probe, no controller on SENSITIVITY: no ring (none drawn), the locked body and plaque recorded", !N.rects.some((q) => /^ring /.test(q.name)) && N.rects.some((q) => q.name === "locked body") && N.texts.some((t) => t.s === "NO CONTROLLER"));
  probe.setOn(false);
}

/* ---- Task 9.10: the CONTROLS follow-ups. The owner, verbatim: "do the CONTROLS follow-ups and also look at the first init game page? ..." ---- */
const { bindBtn, bindKey } = await import("../src/app/controls.js");
const { padRing: ringOf } = await import("../src/render/controlsgeo.js");
const CW9 = (await import("../src/render/words.js")).CONTROLS_WORDS;
{
  /* 1. listening: the callout on the target button (the action over NOW <its button>) and the in-use plaque with the mock's words */
  const capP = padV({ row: 2, capture: { action: "THROW", prompt: "PRESS A BUTTON", sub: "NOW WEST", foot: "ESC CANCELS · WEST KEEPS IT" } });
  const capK = keyV({ row: 2, capture: { action: "THROW", prompt: "PRESS A KEY", sub: "NOW E", foot: "ESC CANCELS · E KEEPS IT" } });
  check("words: the plaque's words are the mock's, in CONTROLS_WORDS (controller, never pad)", CW9.IN_USE === "BUTTON ALREADY IN USE?" && CW9.SWAPS === "The two actions swap, and the page says which one moved:" && CW9.IN_USE_SHORT === "IN USE? THEY SWAP:" && !/\bpad\b/i.test(JSON.stringify(CW9)));
  const lineP = bindBtn(DEF_CONTROLS, "THROW", DEF_CONTROLS.pad.BOMB).line, lineK = bindKey(DEF_CONTROLS, "THROW", DEF_CONTROLS.key.BOMB).line;
  check("the plaque's example is the swap line the page would really say (controls.js bindBtn / bindKey: BOMB's input pressed for THROW)", lineP === "SOUTH WAS BOMB · BOMB NOW WEST" && lineK === "SPACE WAS BOMB · BOMB NOW E", J([lineP, lineK]));
  for (const ts of [1, 1.25]) {
    setTextScale(ts);
    for (const [W, H] of [[1366, 768], [1280, 720], [1366, 657], [1024, 768]]) for (const [v, line, pos, head] of [[capP, lineP, "NOW WEST", CW9.IN_USE], [capK, lineK, "NOW E", CW9.IN_USE_KEY]]) {
      const tg = `${W}x${H} @${ts} ${v.tab}`;
      probe.setOn(true);
      const r = rec(); P.drawControlsPage(r.ctx, { W, H }, v, { level: 1, tap: false });
      const S = probe.snapshot(), L = P._dbg.last.live, G = P._dbg.last.G, lab = L.plan ? L.plan.labels.flatMap((l) => l.lines.map((q) => q.s)) : [];
      probe.setOn(false);
      if (W === 1024 && v.tab === "key") check(`listening ${tg}: the keyboard keeps no leader (KB_FULL: the 1024 pane cannot hold the board at callout size), the ring marks the key`, !L.plan && !!L.ring);
      else check(`listening ${tg}: one callout, on the target, the action over its button now`, !!L.plan && L.plan.labels.length === 1 && lab.join("|") === "THROW|" + pos && L.plan.lines[0].grp === (v.tab === "pad" ? ringOf(v, "THROW") : "KeyE"), J(lab));
      const U = L.inuse, ws = U ? U.lines.map((q) => q.s).join(" ") : "";
      check(`listening ${tg}: the in-use plaque inside the pane, above the foot, its words whole (head, the mock's sentence, the real swap line)`, !!U && ws.startsWith(head) && ws.includes(CW9.SWAPS.split(" ").slice(0, 3).join(" ")) && ws.replace(/ /g, "").includes(line.replace(/ /g, "")) && U.box.x >= G.d.pane.x && U.box.x + U.box.w <= G.d.pane.x + G.d.pane.w && U.box.y + U.box.h <= (L.foot ? L.foot.y : G.d.foot.y) + 0.01 && U.box.y >= G.d.art.y, J([ws, U && U.box]));
      const small = S.texts.filter((t) => t.capH < (t.role === "primary" ? 14 : 11) - 0.01);
      check(`listening ${tg}: every text over the floors, the plaque's included in the record, no ellipsis`, !small.length && [head, line.split(" · ")[0]].every((s) => S.texts.some((t) => t.s.includes(s.split(" ")[0]))) && !r.texts.some((t) => /…/.test(t.s)), J(small.map((t) => t.s)));
      check(`listening ${tg}: no countdown and the cancel words label first (the foot, or the status line where the foot will not hold them)`, !r.texts.some((t) => /\d+(\.\d+)?s\b/.test(t.s)) && (L.foot ? (() => { const seq = L.foot.lines.flatMap((q) => q.ps).map((q) => q.t || q.sep || q.cap); return seq[0] === "CANCELS" && seq[1] === "ESC"; })() : L.status.map((q) => q.s).join(" ").includes("CANCELS ESC")), J(L.status && L.status.map((q) => q.s)));
    }
  }
  setTextScale(1);
  /* the phone: the plaque beside the drawing (the p-05-capture frame), its three lines whole; the status line still says the rest */
  for (const ts of [1, 1.25]) {
    setTextScale(ts);
    const g = shellGeo(393, 852, 600, 520), F = { W: g.w, H: g.h, touch: true, shell: true, css: g.s };
    const r = rec(); P.drawControlsPage(r.ctx, F, capP, { level: 1, tap: false });
    const L = P._dbg.last.live, G = P._dbg.last.G, U = L.inuse, ws = U ? U.lines.map((q) => q.s).join(" ") : "";
    check(`listening phone @${ts}: the plaque beside the drawing inside the art box, IN USE? THEY SWAP: and the swap line whole`, !!U && ws.startsWith(CW9.IN_USE_SHORT) && ws.replace(/ /g, "").includes(lineP.replace(/ · /g, "").replace(/ /g, "")) && U.box.x + U.box.w <= G.d.art.x + G.d.art.w + 0.01 && U.box.y >= G.d.art.y - 0.01 && U.box.y + U.box.h <= G.d.art.y + G.d.art.h + 0.01 && U.box.x > G.d.art.x + G.d.art.w / 2, J([ws, U && U.box, G.d.art]));
    check(`listening phone @${ts}: the drawing's ring stays on the target, left of the plaque`, !!L.ring && L.ring.x + L.ring.r <= U.box.x, J([L.ring, U && U.box]));
    check(`listening phone @${ts}: the status line still carries the cancel words (the swap's own line comes after a press)`, L.status.map((q) => q.s).join(" ").includes("CANCELS"));
  }
  setTextScale(1);
  /* MOVE on the keyboard listens for a set of four: no single target, no swap example (the sub line says ARROWS STAY ON) */
  { const v = keyV({ row: 0, capture: { action: "MOVE · 1 OF 4", prompt: "PRESS UP", sub: "ARROWS STAY ON", foot: "ESC CANCELS", moveCap: 1 } }), r = rec(); P.drawControlsPage(r.ctx, { W: 1366, H: 768 }, v, { level: 1, tap: false });
    check("listening for a MOVE set: no callout and no plaque (no single input to swap)", !P._dbg.last.live.plan && !P._dbg.last.live.inuse); }
}
{
  /* 2. PAUSE view 3 on a phone's over box (F.free, Task 9.8): the 44 units the HUD strip needed come back, rows still >= 44 CSS px */
  for (const [W, H, css] of [[436, 769, 393 / 436], [417, 565, 375 / 417]]) {
    const base = { W, H, touch: true, css, paused: true }, G0 = P.controlsGeom(base, padV()), G1 = P.controlsGeom({ ...base, free: true }, padV());
    const rows = G1.pages[0].map((l) => G1.rows[l].h * css), n0 = G0.pages.length, n1 = G1.pages.length;
    check(`PAUSE CONTROLS on the over box ${W}x${H}: the plate starts in the top 44 units (band [8, H - 8]), inside the box, rows >= 44 CSS px, no more pages than with the strip reserved`,
      G1.plate.y < 44 && G1.plate.y >= 8 - 0.01 && G1.plate.y + G1.plate.h <= H - 8 + 0.01 && rows.every((h) => h >= 44 - 1e-6) && n1 <= n0 && G1 !== G0, J([G1.plate, G0.plate, n0, n1]));
  }
}
{
  /* 3. 1024-wide desk windows: the callouts need a wider art box than the pane holds; the drawing keeps no leaders and the rows name every input */
  const { padFit, kbFit, padCallouts, keyCallouts, padStates } = await import("../src/render/controlsgeo.js");
  const { DEV, SANS } = await import("../src/render/kit/type.js");
  for (const ts of [1, 1.25]) {
    setTextScale(ts);
    const r = rec(), c = r.ctx, m = { pri: DEV.d.pri * ts, sec: DEV.d.sec * ts, wOf: (s, px) => { c.font = "700 " + px + "px " + SANS; return c.measureText(s).width; } };
    let needP = 0, needK = 0;
    for (let aw = 300; aw <= 900 && (!needP || !needK); aw += 4) { if (!needP && padFit(aw, 460, padCallouts(padV()), m, padStates(padV())).plan) needP = aw; if (!needK && kbFit(aw, 460, keyCallouts(keyV()), m).plan) needK = aw; }
    for (const v of [padV(), keyV()]) {
      P.drawControlsPage(rec().ctx, { W: 1024, H: 768 }, v, { level: 1, tap: false });
      const A = P._dbg.last.G.d.art, need = v.tab === "pad" ? needP : needK;
      check(`1024x768 @${ts} ${v.tab}: no leaders, because the art box (${Math.round(A.w)}) is narrower than the callouts need (${need})`, !P._dbg.last.live.plan && need > A.w, J([A.w, need]));
    }
  }
  setTextScale(1);
}

/* ---- Task 3: the CONNECT row (SW2): words, door, status, foot, in every arrangement ---- */
{
  const SW2 = (await import("../src/render/words.js")).SW2_WORDS, { footItems, footText, statusOf, rowsOf } = await import("../src/render/controlsgeo.js");
  check("no CONNECT row unless the view says shown: eight pad rows, no SW2", !P.controlsGeom({ W: 1366, H: 768 }, padV()).order.includes("SW2") && !P.controlsGeom({ W: 1366, H: 768 }, padV({ sw2: { shown: false, state: "idle" } })).order.includes("SW2"));
  check("shown: SW2 after VIBRATION, before RESET, on the CONTROLLER tab only", P.controlsGeom({ W: 1366, H: 768 }, swV()).order.join() === "MOVE,BOMB,THROW,REMOTE,PAUSE,SENSITIVITY,VIBRATION,SW2,RESET" && !P.controlsGeom({ W: 1366, H: 768 }, keyV({ sw2: SW })).order.includes("SW2"));
  const none = rowsOf(swV({ pad: { state: "none" } })).find((r) => r.id === "SW2"), lost = rowsOf(swV({ pad: { state: "lost" } })).find((r) => r.id === "SW2");
  check("NO CONTROLLER and LOST: the CONNECT row is live (never off), its door CONNECT", none && !none.off && lost && !lost.off && none.door === SW2.door, J(none));
  check("the door reads CONNECTED only once woken with a controller seen", rowsOf(swV({ sw2: { shown: true, state: "woken" } })).find((r) => r.id === "SW2").door === SW2.ok && rowsOf(swV({ sw2: { shown: true, state: "woken" }, pad: { state: "none" } })).find((r) => r.id === "SW2").door === SW2.door);
  const sr = (o) => rowsOf(swV(o)).find((r) => r.id === "SW2");
  check("its status line: the help sentence; a result in its place once there is one, even with no controller", statusOf(swV({ pad: { state: "none" } }), sr({ pad: { state: "none" } })) === SW2.help && statusOf(swV({ status: SW2.cancel, pad: { state: "none" } }), sr()) === SW2.cancel);
  const fk = footText(footItems(swV({ row: 7, device: "key" }), sr(), {})), fp = footText(footItems(swV({ row: 7, device: "pad" }), sr(), {})), fn = footText(footItems(swV({ row: 7, device: "key", pad: { state: "none" } }), sr({ pad: { state: "none" } }), {}));
  check("its foot: CONNECT ENTER on keys, on a controller (SOUTH would not open the chooser) and with no controller", /CONNECT ENTER/.test(fk) && /CONNECT ENTER/.test(fp) && !/CONNECT SOUTH/.test(fp) && /CONNECT ENTER/.test(fn), J([fk, fp, fn]));
  for (const ts of [1, 1.25]) {
    setTextScale(ts);
    for (const [nm, F] of BOXES) for (const v0 of [swV({ row: 7 }), swV({ row: 7, pad: { state: "none" } })]) {
      const tg = `${nm} @${ts}${v0.pad.state === "none" ? " (no controller)" : ""}`, r = rec(); P.drawControlsPage(r.ctx, F, v0, { level: 1, tap: false });
      const o = P._dbg.last.Pl.rows.SW2, door = o.val.P.find((q) => q.s === SW2.door), chev = o.val.P.find((q) => q.k === "glyph" && q.n === "chev"), at = door ? (door.r ? door.r.x : door.x) : chev ? chev.r.x : -1;
      check(`the CONNECT row (${tg}): its label drawn, then the door right of it with room between (the CONNECT key, its word, or where neither fits the door's chevron)`, r.texts.some((t) => t.s === SW2.row) && (door ? r.texts.some((t) => t.s === SW2.door) : !!chev) && at >= o.label.x + o.label.w + 8 && o.val.x + o.val.w <= o.r.x + o.r.w + 0.01, J([o.label.x + o.label.w, at, door ? "word" : chev ? "chev" : "none"]));
      const st = P._dbg.last.live.status.map((q) => q.s).join(" "), rl = (P._dbg.last.G.d.rule ? P._dbg.last.Pl.rule2 : []).map((q) => q.s).join(" "), first = SW2.help.split(". ")[0] + ".";
      check(`the CONNECT row (${tg}): the help sentence whole, or where it will not fit its first sentence whole (the pane's rule on the desk, the status line off it); never cut mid-sentence, never twice`, P._dbg.last.G.d.rule ? (rl === SW2.help || rl === first) && st === "" : st === SW2.help || st === first, J([rl, st]));
    }
    for (const [W, H] of DESKS.filter(([W]) => W > 1024 && (ts === 1 || W === 1366))) { const r = rec(); P.drawControlsPage(r.ctx, { W, H }, swV({ row: 7 }), { level: 1, tap: false }); const rl = P._dbg.last.Pl.rule2.map((q) => q.s); check(`desk ${W}x${H} @${ts} (1366 and 1280 wide at 1, 1366 at 1.25; a narrower pane keeps the first sentence): the help sentence whole in the pane's rule on the CONNECT row (drawn), the menus rule on every other row`, rl.join(" ") === SW2.help && rl.every((q) => r.texts.some((t) => t.s === q)) && (() => { const k = rec(); P.drawControlsPage(k.ctx, { W, H }, swV({ row: 6 }), { level: 1, tap: false }); return !k.texts.some((t) => t.s === rl[0]); })(), J(rl)); }
  }
  setTextScale(1);
  /* DESK_SHORT only for a desk that would scale (0.8 <= u < 1): a touch shell box on the phone form (816 x 648, 1.25: 864 x 664) stays the phone
     form, and keyboard 1024 x 600 keeps the desk with closer gaps (u 0.9588 -> 0.9872 at 1) */
  for (const [ts, W, H] of [[1, 816, 648], [1.25, 864, 664]]) { setTextScale(ts); for (const v of [padV(), swV()]) { const G = P.controlsGeom({ W, H, touch: true, shell: true, css: 1 }, v); check(`DESK_SHORT never moves a box off its form: touch ${W}x${H} @${ts}${v.sw2 ? " +CONNECT" : ""} stays the phone form`, G.mode === "phone", G.mode); } }
  setTextScale(1);
  { const G = P.controlsGeom({ W: 1024, H: 600 }, padV()); check("DESK_SHORT: keyboard 1024x600 stays the desk, its gaps closed, u 0.9872 (was 0.9588)", G.mode === "desk" && Math.abs(G.u - 0.9872) < 5e-4, G.u); }
  /* the ninth row takes the 393 x 852 phone's drawing under LOCK_MIN with no controller: the locked body is not drawn (too small to read as locked;
     the gates' lip under 4 CSS px), the NO CONTROLLER plaque stands alone; the eight-row page keeps its body */
  { const g = shellGeo(393, 852, 600, 520), F = { W: g.w, H: g.h, touch: true, shell: true, css: g.s };
    const r8 = rec(); P.drawControlsPage(r8.ctx, F, padV({ pad: { state: "none" } }), { level: 1, tap: true }); const a8 = P._dbg.last.live.art;
    const r9 = rec(); P.drawControlsPage(r9.ctx, F, swV({ pad: { state: "none" } }), { level: 1, tap: true }); const a9 = P._dbg.last.live.art;
    check("393x852, no controller: eight rows keep the locked body; with the CONNECT row a drawing under LOCK_MIN gives way to the plaque alone (NO CONTROLLER and its line still drawn)", a8.W >= P.LOCK_MIN && !!a8.body && a9.W < P.LOCK_MIN && !a9.body && r9.texts.some((t) => t.s === "NO CONTROLLER") && r9.texts.some((t) => t.s === "Connect one and press a button."), J([a8.W, a9.W])); }
}

console.log("\n  PAGE-CONTROLS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
