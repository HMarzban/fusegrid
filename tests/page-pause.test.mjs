/* UI upgrade v202 Task 5.1: PAUSE on the world kit (src/render/pages/pause.js). One geometry for draw and tap (rows by index in PAUSE_ROWS order), the
   round 7 S7-pages 10-pause frame (a centred kicker, PAUSED and the run's tag row, clear space, RESUME the one yellow key, SETTINGS, the wall-course
   divider, RESTART and QUIT TO MENU in danger), the keyboard and touch pitches (44 / 54 / 340 and 70 / 76 / 380 box caps), the touch floors on every
   touch box (44 CSS px, >= 8 apart: the list, or the 2 x 2 grid, then the steps), taps on every row in both pitches, the focus (bare bomb, band on a
   row, the cream ring on RESUME), the longest strings whole at text scale 1 and 1.25, the one painter every look calls, the cached plate (0 misses on
   a steady frame or a cursor move), and the probe record the gates read. Every canvas is a textrec stub. */
import { rec } from "./lib/textrec.mjs";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined && !cond ? " -> " + detail : ""));
}
const J = (v) => JSON.stringify(v);
const K8 = 0.6 * 1.08; // the recorder's width factor 8 % above the default (appendix 11)
const made = [];
class Cv { constructor(w, h) { this.width = w; this.height = h; this.r = rec({ widthK: K8 }); made.push(this); } getContext() { return this.r.ctx; } }
const cache = await import("../src/render/kit/cache.js");
const P = await import("../src/render/pages/pause.js");
const S = await import("../src/render/scenes.js");
const W = await import("../src/render/words.js");
const { setTextScale } = await import("../src/render/kit/type.js");
const { worldTokens, CONST } = await import("../src/render/kit/tokens.js");
const probe = await import("../src/render/kit/probe.js");
const { PAUSE_ITEMS } = await import("../src/app/menuapp.js");
const { fitBox } = await import("../src/app/fit.js");
const { setHints } = await import("../src/render/hintcopy.js");
const { wordsOf } = await import("../src/app/hints.js");
const { DEF_CONTROLS } = await import("../src/app/controls.js");
const { SCREENS, needFor } = await import("../tools/ui/lib/screens.mjs"); // a capture's need is needFor's (R2 carry-in: scoped and exemptIfNo exemptions)

P.setMeasure(rec({ widthK: K8 }).ctx); // the page plans on its own measuring context: here the recorder's 8 % wide one, so every fit below is checked against wider text than the plan's
const B2 = S.overlayBox("2d"), BI = S.overlayBox("iso");
const css = (w, h) => fitBox(w, h, true, 600, 520).s;
/* every box PAUSE is drawn on: keyboard 600 x 520 and the iso guard, touch #c at the phones' and tablets' stage scales (and 1, the Node default) */
const BOX = {
  kb: { B: B2, touch: false }, iso: { B: BI, touch: false }, t1: { B: B2, touch: true, css: 1 },
  p393: { B: B2, touch: true, css: css(393, 852) }, p375: { B: B2, touch: true, css: css(375, 667) }, p360: { B: B2, touch: true, css: css(360, 740) },
  l852: { B: B2, touch: true, css: css(852, 393) }, l667: { B: B2, touch: true, css: css(667, 375) }, l740: { B: B2, touch: true, css: css(740, 360) },
  tab: { B: B2, touch: true, css: css(1024, 768) },
};
const TOUCHB = Object.keys(BOX).filter((k) => BOX[k].touch);
const PLAIN = { state: "PAUSE", level: 3, heat: 0, pace: 0, pact: 0, players: [{}] };
const HEAVY = { state: "PAUSE", level: 8, heat: 2, pace: 1, pact: 15, players: [{}] };
const geo = (b, world, time) => P.pauseGeom(BOX[b].B, BOX[b].touch, { css: BOX[b].css, world, time });
/* paint one PAUSE frame through drawOverlay (the path every look takes) */
function frame(b, world, ui = {}, o = {}) {
  const t = rec({ widthK: K8 }), n0 = made.length, m0 = cache._dbg.misses, X = BOX[b];
  S.drawOverlay(o.c || t.ctx, world, X.B.w, X.B.h, X.B.cx, X.B.cy, { view: 0, cursor: 0, touch: X.touch, css: X.css, ...ui }, o.tm, o.run);
  return { t, cvs: made.slice(n0), miss: cache._dbg.misses - m0 };
}
const inside = (a, b, e = 0.01) => a.x >= b.x - e && a.y >= b.y - e && a.x + a.w <= b.x + b.w + e && a.y + a.h <= b.y + b.h + e;
const rr = (r) => ({ x: r.x0, y: r.y0, w: r.w, h: r.h });

/* ---- rows, shape and words ---- */
check("PAUSE_ROWS mirrors menuapp PAUSE_ITEMS (RESUME, SETTINGS, RESTART, QUIT TO MENU), re-exported by scenes.js", J(P.PAUSE_ROWS) === J(PAUSE_ITEMS) && S.PAUSE_ROWS === P.PAUSE_ROWS && S.pauseGeom === P.pauseGeom && S.pauseHit === P.pauseHit && S.pauseKick === P.pauseKick);
check("the box caps are the brief's: touch 70 / 76 / 380, keyboard 44 / 54 / 340", P.PAUSE_ROW_H === 70 && P.PAUSE_HERO_H === 76 && P.PAUSE_W_H === 380 && P.PAUSE_ROW_D === 44 && P.PAUSE_HERO_D === 54 && P.PAUSE_W_D === 340);
check("tags: a default run has none; a heavy one names each rule (words.js runParts), TIME TRIAL when timed", P.tagsOf(PLAIN).length === 0 && J(P.tagsOf(HEAVY, true)) === J(W.runParts({ heat: 2, pace: 1, pact: 15, time: true })) && P.tagsOf({ heat: 0, pace: 0, pact: 0 }, true)[0] === W.TIME_TRIAL);

/* ---- geometry on every box, both text scales, with and without a tag row ---- */
for (const ts of [1, 1.25]) {
  setTextScale(ts);
  for (const b of Object.keys(BOX)) for (const world of [PLAIN, HEAVY]) {
    const G = geo(b, world), X = BOX[b], u = G.u, T = G.T, tag = `${b} ${ts === 1 ? "x1" : "x1.25"} ${world === HEAVY ? "tags" : "plain"}`;
    const ring = { x: G.x - T - 2 * u, y: G.y - T - 2 * u, w: G.w + 2 * T + 4 * u, h: G.h + 2 * T + 5 * u }, bot = X.B.h >= 480 ? X.B.h - 38 : X.B.h - 6;
    const pl = { x: G.x, y: G.y, w: G.w, h: G.h };
    check(`inside (${tag}): the plate's ring clears the HUD band (y >= 42) and the ability bar (<= ${bot}); every row and RESUME's ring inside the plate`,
      ring.y >= 42 - 1e-9 && ring.y + ring.h <= bot + 1e-9 && ring.x >= 0 && ring.x + ring.w <= X.B.w && G.rows.every((r) => inside({ x: r.x0 - 6 * u, y: r.y0 - 6 * u, w: r.w + 12 * u, h: r.h + 12 * u }, pl)), J({ ring, rows: G.rows.map(rr) }));
    const [a, s, rs, q] = G.rows;
    const order = G.mode === "grid" ? a.y0 === s.y0 && a.x0 < s.x0 && rs.y0 === q.y0 && rs.x0 < q.x0 && rs.y0 > a.y1 : a.y1 < s.y0 && s.y1 < rs.y0 && rs.y1 <= q.y0;
    check(`order (${tag}, ${G.mode}): RESUME, SETTINGS, the divider, RESTART, QUIT TO MENU; the divider between rows 1 and 2`, order && G.div > Math.max(a.y1, s.y1) && G.div < Math.min(rs.y0, q.y0), J([G.div, G.rows.map(rr)]));
    if (X.touch) {
      const k = X.css, R = G.rows.map((r) => ({ x: r.x0 * k, y: r.y0 * k, w: r.w * k, h: r.h * k })), small = R.filter((r) => r.w < 43.95 || r.h < 43.95);
      const gap = (i, j) => { const p = R[i], o = R[j]; return Math.max(o.x - (p.x + p.w), p.x - (o.x + o.w), o.y - (p.y + p.h), p.y - (o.y + o.h)); };
      const gaps = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]].map(([i, j]) => gap(i, j)); // every pair: on touch no two rows abut, a list's included
      check(`touch floors (${tag}, ${G.mode}${G.foot ? "" : ", no foot"}${G.fold ? ", folded" : ""}): every row >= 44 x 44 CSS px; every two rows >= 8 px apart (RESTART and QUIT TO MENU too)`,
        G.floored && small.length === 0 && gaps.every((g) => g >= 8 - 1e-9), J({ small, gaps, floored: G.floored }));
    }
  }
  setTextScale(1);
}
{
  const G = geo("kb", PLAIN), rows = G.rows.map((r) => r.h);
  check("keyboard 600 x 520, a default run: the S7 metrics at 1 box unit per design px (RESUME 54, rows 44, plate 340), centred on the board", G.u === 1 && J(rows) === J([54, 44, 44, 44]) && G.w === 340 && G.x + G.w / 2 === 300 && G.mode === "list", J([G.u, rows, G.w]));
  const H = geo("kb", HEAVY);
  check("keyboard with a tag row: the same plate scaled as one piece (pitches are caps), the rows in the S7 ratio", H.u < 1 && H.u > 0.9 && Math.abs(H.rows[0].h / H.rows[1].h - 54 / 44) < 1e-9, H.u);
  const t = geo("t1", PLAIN), p = geo("p393", PLAIN), tb = geo("tab", PLAIN);
  check("touch caps: rows grow toward 70 / 76 box units with the room left and never past them (tablet, Node's css 1)", [t, tb].every((g) => g.mode === "list" && g.rows[0].h <= 76 + 1e-9 && g.rows.slice(1).every((r) => r.h <= 70 + 1e-9) && g.rows[1].h > 44), J([t.rows.map((r) => r.h), tb.rows.map((r) => r.h)]));
  check("the 393 px phone reflows to the 2 x 2 grid (RESUME | SETTINGS over RESTART | QUIT TO MENU) and keeps every row at 44 CSS px or more", p.mode === "grid" && p.rows.every((r) => r.h * BOX.p393.css >= 43.95), J(p.rows.map(rr)));
  const steps = Object.fromEntries(TOUCHB.map((b) => { const g = geo(b, HEAVY); return [b, g.mode + (g.foot ? "+foot" : "") + (g.fold ? "+fold" : "")]; }));
  console.log("  NOTE touch PAUSE arrangement with a tag row " + J(steps));
}

/* ---- taps: every row in both pitches on every box; between rows a row, off them -1 ---- */
for (const b of Object.keys(BOX)) for (const world of [PLAIN, HEAVY]) {
  const X = BOX[b], o = { css: X.css, world }, G = geo(b, world), hit = (x, y) => P.pauseHit(x, y, X.B, X.touch, o);
  const centres = G.rows.every((r, i) => hit(r.cx, r.cy) === i && hit(r.x0 + 1, r.y0 + 1) === i && hit(r.x1 - 1, r.y1 - 1) === i);
  const between = G.mode === "list" ? [0, 1, 2].every((i) => hit(X.B.w / 2, (G.rows[i].y1 + G.rows[i + 1].y0) / 2) >= 0) : hit(X.B.w / 2 - 1, G.div) >= 0 && hit((G.rows[0].x1 + G.rows[1].x0) / 2, G.rows[0].cy) >= 0;
  const off = hit(X.B.w / 2, G.rows[0].y0 - 2) === -1 && hit(X.B.w / 2, Math.max(...G.rows.map((r) => r.y1)) + 2) === -1;
  check(`taps (${b} ${world === HEAVY ? "tags" : "plain"}, ${G.mode}): every row's centre and corners map to it, no tap between two rows falls through, above and below the rows is -1`, centres && between && off);
  if (G.mode === "list") check(`taps (${b}): a list band spans the whole stage`, hit(2, G.rows[0].cy) === 0 && hit(X.B.w - 2, G.rows[3].cy) === 3);
  /* a tap exactly on a seam is the row above's: a list's midpoints, the grid's divider (both halves: RESUME, SETTINGS); the grid's middle seam is the left tile's */
  const seam = G.mode === "list" ? [0, 1, 2].every((i) => { const a = G.rows[i].b; return hit(X.B.w / 2, a) === i && hit(X.B.w / 2, a + 1e-6) === i + 1; })
    : hit(G.rows[0].cx, G.div) === 0 && hit(G.rows[1].cx, G.div) === 1 && hit(G.rows[2].cx, G.div + 1e-6) === 2 && hit(G.rows[3].cx, G.div + 1e-6) === 3 && hit(G.rows[0].hx1, G.rows[0].cy) === 0;
  check(`taps (${b} ${world === HEAVY ? "tags" : "plain"}, ${G.mode}): a tap on a seam resolves to the row above, the same in both halves`, seam);
}

/* ---- the painted page: one painter, centre axis, one yellow, divider, focus, words ---- */
const tok8 = worldTokens(8), YEL = CONST.yel.toLowerCase();
for (const b of ["kb", "p393", "iso"]) for (let cur = 0; cur < 4; cur++) {
  const f = frame(b, HEAVY, { cursor: cur }, { tm: { on: true }, run: { daily: "2026-11-11" } }), G = geo(b, HEAVY, true), T = f.t.texts, u = G.u;
  const by = (s) => T.filter((x) => x.s === s);
  if (cur === 0) {
    const kick = T.find((x) => /^LEVEL 8/.test(x.s)), title = by("PAUSED").pop(), tags = T.filter((x) => x.align === "center" && x.s !== "PAUSED" && x.y > title.y && x.y < G.rows[0].y0 / u);
    const cx = (G.x + G.w / 2) / u;
    check(`centre axis (${b}): the kicker, PAUSED and the tag row share the plate's centre x`, !!kick && kick.align === "center" && Math.abs(kick.x - cx) < 1e-6 && title.align === "center" && Math.abs(title.x - cx) < 1e-6 &&
      (G.fold || (tags.length > 0 && Math.abs((Math.min(...tags.map((t) => t.x - t.w / 2)) + Math.max(...tags.map((t) => t.x + t.w / 2))) / 2 - cx) < 12)), J([kick, title.x, cx, tags.map((t) => t.s)]));
    const full = "LEVEL 8 · CROWN · DAILY", fits = full.length * K8 * (G.dev === "p" ? 16 : 21) <= G.d.cw; // the world drops only where the full form does not fit
    check(`kicker (${b}): LEVEL n · WORLD · DAILY whole where it fits, LEVEL n · DAILY only where it does not (folded: the rules after DAILY), drawn whole`,
      !!kick && (G.fold ? kick.s.startsWith((fits ? full : "LEVEL 8 · DAILY") + " · ") : kick.s === (fits ? full : "LEVEL 8 · DAILY")) && kick.w <= G.d.cw + 1e-9, J([kick && kick.s, fits]));
    if (!G.fold) check(`tags (${b}): only non-default rules, at most 3 named, then +N`, tags.length >= 1 && tags.length <= 4 && tags.every((t) => /^\+\d$/.test(t.s) || W.runParts({ heat: 2, pace: 1, pact: 15, time: true }).concat(W.runParts({ heat: 2, pace: 1, pact: 15, time: true }, { terse: true })).includes(t.s)), J(tags.map((t) => t.s)));
  }
  const yel = f.t.paints.filter((p) => typeof p.style === "string" && p.style.toLowerCase() === YEL && p.op !== "stroke");
  const R0 = G.rows[0], rbox = { x: R0.x0 - 1, y: R0.y0 - 3, w: R0.w + 2, h: R0.h + 8 };
  check(`one yellow (${b}, cursor ${cur}): every #ffd447 fill is RESUME's face`, yel.length >= 1 && yel.every((p) => p.box && inside(p.box, rbox, 0.6)), J(yel.map((p) => p.box)));
  const course = f.t.paints.filter((p) => p.op === "fillRect" && p.style === tok8.band && p.box && p.box.h <= 1.01 * u + 1e-6);
  check(`divider (${b}, cursor ${cur}): the wall course's band line at pauseGeom's div, between SETTINGS and RESTART`, course.length === 1 && Math.abs(course[0].box.y + course[0].box.h / 2 - (G.div + 1 * u)) <= u + 1e-6, J(course.map((p) => p.box)));
  const k = G.rows[cur], fb = { x: k.x0 - 1, y: k.y0 - 1, w: k.w + 2, h: k.h + 2 };
  const ringP = f.t.paints.filter((p) => p.op === "stroke" && p.style === CONST.ink && p.lw === 3);
  const bandP = f.t.paints.filter((p) => p.op === "fill" && p.style === tok8.band && p.box && inside(p.box, fb, 0.6));
  if (cur === 0) check(`focus (${b}, RESUME): the 3 px cream ring round the key, no band`, ringP.length === 1 && bandP.length === 0, J([ringP.length, bandP.length]));
  else check(`focus (${b}, ${P.PAUSE_ROWS[cur]}): the band on the row, no ring`, ringP.length === 0 && bandP.length === 1, J([ringP.length, bandP.length]));
  const lab = T.filter((x) => P.PAUSE_ROWS[cur].startsWith(x.s) || x.s === P.PAUSE_ROWS[cur]).pop();
  if (cur >= 2) check(`danger (${b}, ${P.PAUSE_ROWS[cur]}): coral at rest, cream on the band`, T.some((x) => x.s.startsWith(P.PAUSE_ROWS[cur].split(" ")[0]) && x.fill === CONST.cor) && !!lab && lab.fill === CONST.ink, lab && lab.fill);
}
/* no yellow and no coral ink anywhere but RESUME's face and the danger rows (a default run, every cursor, the keyboard words and a controller's) */
for (const dev of ["key", "pad"]) {
  setHints(dev === "pad" ? wordsOf("pad", DEF_CONTROLS) : null);
  const f = frame("kb", PLAIN, { cursor: 1 }), T = f.t.texts, G = geo("kb", PLAIN);
  const res = T.find((x) => x.s === "RESUME"), cap = T.find((x) => x.s === (dev === "pad" ? "EAST" : "ESC")), m = T.find((x) => x.s === "M"), foot = T.find((x) => /^MOVE /.test(x.s));
  check(`keycaps (${dev}): RESUME's label left of its ${dev === "pad" ? "EAST" : "ESC"} cap; QUIT TO MENU's ${dev === "pad" ? "back glyph (no M on a controller)" : "M cap right of its label"}; the foot reads label first, key last`,
    !!res && !!cap && res.x + res.w < cap.x - cap.w / 2 && (dev === "pad" ? !m : !!m && T.find((x) => x.s === "QUIT TO MENU").x + T.find((x) => x.s === "QUIT TO MENU").w < m.x - m.w / 2) &&
    !!foot && foot.s === (dev === "pad" ? "MOVE D-PAD · CONFIRM SOUTH" : "MOVE ↑↓ · CONFIRM ENTER"), J([res, cap, m, foot && foot.s]));
}
setHints(null);
{
  const f = frame("p393", PLAIN), T = f.t.texts.map((x) => x.s);
  check("touch: TAP A ROW, no keycaps (no ESC, no M), RESTART's and QUIT TO MENU's glyphs instead", T.includes("TAP A ROW") && !T.includes("ESC") && !T.includes("M") && !T.some((s) => /^MOVE/.test(s)));
  const h = frame("p393", HEAVY), G = geo("p393", HEAVY);
  check("the 393 px phone with a tag row: the foot steps down first (rows stay at the floor)", !G.foot && !h.t.texts.some((x) => x.s === "TAP A ROW"));
}

/* ---- the longest strings drawn whole at x1 and x1.25 on every box: nothing past its slot, no ellipsis ---- */
for (const ts of [1, 1.25]) {
  setTextScale(ts);
  for (const b of Object.keys(BOX)) for (const ui of [{ cursor: 3 }, { cursor: 3, next: "REAL 3D · RESTORING" }, { cursor: 0, note: "CONTROLLER LOST" }]) {
    const f = frame(b, HEAVY, ui, { tm: { on: true }, run: { daily: "2026-11-11" } }), G = geo(b, HEAVY, true), u = G.u, pl = { x: G.x / u, y: G.y / u, w: G.w / u, h: G.h / u };
    const T = f.t.texts.filter((x) => x.fill !== CONST.ol), out = T.filter((x) => { const x0 = x.align === "center" ? x.x - x.w / 2 : x.align === "right" ? x.x - x.w : x.x; return x0 < pl.x + 1 || x0 + x.w > pl.x + pl.w - 1; });
    const quit = G.rows[3], ql = T.filter((x) => x.y > quit.y0 / u && x.y < quit.y1 / u && x.fill === (ui.cursor === 3 ? CONST.ink : CONST.cor) && x.x > quit.x0 / u && x.x < quit.x1 / u).map((x) => x.s).join(" ");
    check(`whole (${b} x${ts}${ui.next ? " + look tail" : ui.note ? " + note" : ""}): every string inside the plate, none with an ellipsis; QUIT TO MENU whole${G.mode === "grid" ? " (one break in a tile)" : ""}`,
      out.length === 0 && !T.some((x) => x.s.includes("…")) && ql === "QUIT TO MENU", J({ out: out.map((x) => x.s), ql }));
  }
  setTextScale(1);
}
{
  const f = frame("kb", HEAVY, { next: "REAL 3D NEXT" }), k = f.t.texts.find((x) => /REAL 3D NEXT$/.test(x.s));
  check("the look tail rides the kicker (run context dropped from the end until it fits)", !!k && /^LEVEL 8/.test(k.s), k && k.s);
  const n = frame("kb", PLAIN, { note: "CONTROLLER LOST" }).t.texts.map((x) => x.s);
  check("a note replaces the kicker's run line", n.includes("CONTROLLER LOST") && !n.some((s) => /^LEVEL 3/.test(s)));
}

/* ---- every look calls the one painter ---- */
{
  const src = (f) => readFileSync(new URL("../src/render/" + f, import.meta.url), "utf8");
  check("CLASSIC, PIXEL and REAL 3D call scenes.js drawOverlay for PAUSE, and its PAUSE branch is pages/pause.js drawPause (no second painter)",
    /drawOverlay\(ctx, world, B\.w/.test(src("renderer.js")) && /drawOverlay\(ovCtx, world, B\.w/.test(src("pixel/renderer.js")) && /drawOverlay\(ovCtx,world,B\.w/.test(src("three/wrapper.js")) &&
    /drawPause\(c, world, B, /.test(src("scenes.js")) && /B = box \|\| \{ w, h \}/.test(src("scenes.js")) && /* Task 9.8: B is the board's { w, h } or a phone's over box */ !/PAUSED/.test(src("scenes.js").replace(/\/\*[\s\S]*?\*\//g, "")));
  const code = (f) => src(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""), main = readFileSync(new URL("../src/main.js", import.meta.url), "utf8"), ptr = readFileSync(new URL("../src/app/pointer.js", import.meta.url), "utf8");
  check("css reaches the painter through opts.pause (main hands #c's canvas.css), the very value pointer.js taps with; no painter reads canvas.css",
    /pause: \{[^}]*css: canvas && canvas\.css[^}]*\}/.test(main) && /pauseHit\(px, py, B, touchLay\(cv\), \{ css: cv\.css,/.test(ptr) && /const cv = over\(\) \|\| canvas;/.test(ptr) && !/canvas\.css/.test(code("scenes.js")) && (code("scenes.js").match(/\.css\b/g) || []).length === (code("scenes.js").match(/\brun\.css\b/g) || []).length + (code("scenes.js").match(/\bob\.css\b/g) || []).length /* scenes reads only run.css (main's run-end facts, v202 Task 5.2) and a phone's over box's own css (Task 9.8); pointer taps with #c's canvas.css or that box's (cv) */ && !/canvas\.css/.test(code("pages/pause.js")));
  const { createRenderer } = await import("../src/render/renderer.js");
  const { createWorld, loadLevel } = await import("../src/core/world.js");
  const w = createWorld(11, 1); loadLevel(w, 3, false); w.state = "PAUSE";
  const a = rec({ widthK: K8 }), r = createRenderer({ getContext: () => a.ctx }, { kind: "2d", hud: null, audio: null });
  r.render(w, 1 / 60, { pause: { view: 0, cursor: 2 } });
  const d = rec({ widthK: K8 });
  S.drawOverlay(d.ctx, w, B2.w, B2.h, B2.cx, B2.cy, { view: 0, cursor: 2 });
  const pz = (t) => t.texts.filter((x) => P.PAUSE_ROWS.includes(x.s) || x.s === "PAUSED").map((x) => [x.s, +x.x.toFixed(3), +x.y.toFixed(3)]);
  check("CLASSIC's renderer paints PAUSE exactly as drawOverlay does (the same texts at the same places)", pz(a).length >= 5 && J(pz(a)) === J(pz(d)), J([pz(a), pz(d)]));
}

/* ---- cached plate: a steady frame and a cursor move make 0 misses; two idle frames are the same calls ---- */
{
  globalThis.OffscreenCanvas = Cv;
  cache.setFactory((w, h) => new Cv(w, h));
  cache.release(); cache._dbg.misses = 0;
  const f0 = frame("kb", PLAIN, { cursor: 0 }), f1 = frame("kb", PLAIN, { cursor: 0 }), f2 = frame("kb", PLAIN, { cursor: 0 }), f3 = frame("kb", PLAIN, { cursor: 2 }), f4 = frame("p393", PLAIN, { cursor: 2 });
  const calls = (f) => J(f.t.calls);
  check("the first frame fills the plate layer once; a steady frame and a cursor move miss 0 times; two idle frames make the same calls", f0.miss === 1 && f1.miss === 0 && f2.miss === 0 && f3.miss === 0 && calls(f1) === calls(f2) && f4.miss === 1, J([f0.miss, f1.miss, f2.miss, f3.miss, f4.miss]));
  check("a steady frame is a blit and the focused row: well under 400 canvas calls and 20 measureText", f1.t.calls.length <= 400 && f1.t.calls.filter((c) => c.op === "measureText").length <= 20, f1.t.calls.length);
  const f5 = frame("kb", { ...PLAIN, level: 8 }, { cursor: 0 });
  check("a world change refills the plate once (the tokens of the room being played)", f5.miss === 1);
  delete globalThis.OffscreenCanvas;
  cache.setFactory(null);
  cache.release();
}

/* ---- the probe: what the gates read ---- */
{
  probe.setOn(true);
  frame("p393", HEAVY, { cursor: 1 });
  const s = probe.snapshot();
  probe.setOn(false);
  const rows = P.PAUSE_ROWS.map((l) => s.rects.find((r) => r.name === l));
  const yel = s.rects.filter((r) => r.fill && r.fill.toLowerCase() === YEL);
  check("probe: page pause on #c, the plate with its ring, four touch rows in one set with no kind (the gap gate measures every pair), one yellow (RESUME)", s.page === "pause" && s.box.el === "c" && s.rects.some((r) => r.name === "plate" && r.plate > 0) &&
    rows.every((r) => r && r.touch && r.set === "pause" && !r.kind) && yel.length === 1 && yel[0].name === "RESUME", J(s.rects));
  check("probe: the focus band and ring pairs on the focused row, text roles and colours for every string", s.pairs.some((p) => p.kind === "band") && s.pairs.some((p) => p.kind === "ring") && s.texts.length >= 6 && s.texts.every((t) => t.col && t.role));
  const row = SCREENS.pause;
  check("tools/ui screens: PAUSE exempts only what it has none of (chosen, locked), each with a reason", row && !needFor(row, { flags: {} }).includes("chosen") && !needFor(row, { flags: {} }).includes("locked") && ["band", "ring", "info", "text", "cap", "inside", "plate", "yellow", "touch", "gap"].every((g) => needFor(row, { flags: {} }).includes(g)), J(row && needFor(row, { flags: {} })));
}
console.log("\n  PAGE-PAUSE RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
