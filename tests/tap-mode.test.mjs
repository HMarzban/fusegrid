// R1 cohesion 4 / 5 (integration review; lead ruling): ONE tap-mode predicate. shellview's tapOf (a touch layout last driven by touch: app.lastDev,
// raw) is computed once a frame and handed to every page; every page reads it, never its own. The hint words here are the keyboard's, so the old
// per-page predicate (hintcopy tapMode: a touch layout whose hint device is not a controller) would say tap mode on every frame: each page must follow
// lastDev instead. Tap mode shows no focus on any page but MENU's PLAY (and ENEMIES' open tooltip); a key press brings the focus and the key words back.
import { rec } from "./lib/textrec.mjs";

let pass = 0, fail = 0;
function check(name, cond, detail) { cond ? pass++ : fail++; console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined && !cond ? " -> " + detail : "")); }
const J = JSON.stringify;
const lazy = await import("../src/render/pages/lazy.js");
for (const n of ["settings", "guide", "records"]) lazy._set(n, await import("../src/render/pages/" + n + ".js"));
await import("../src/render/pages/menu.js");
const probe = await import("../src/render/kit/probe.js");
const { SCREEN, createMenuApp } = await import("../src/app/menuapp.js");
const SV = await import("../src/render/shellview.js");
const { setHints, tapMode } = await import("../src/render/hintcopy.js");
const { wordsOf } = await import("../src/app/hints.js");
const { DEF_CONTROLS } = await import("../src/app/controls.js");
const { gfxView } = await import("../src/app/gfx.js");
const { statsRows, statsNotes, clampStats } = await import("../src/app/stats.js");
const { medalRows } = await import("../src/app/medals.js");
const W = await import("../src/render/words.js");
const { LEVEL_TAP } = await import("../src/render/menudraw.js");

setHints(wordsOf("key", DEF_CONTROLS));
check("the hint words are the keyboard's: the old per-page predicate would read tap mode on any touch layout", tapMode(true) === true);
const st0 = clampStats({ a: { runs: 3, rooms: 7, secs: 900, days: 2 } });
const STATS = { rows: statsRows(st0, {}), notes: statsNotes(st0, null, "2026-11-10"), trophies: medalRows(0) };
/* a landscape tablet's #sh box (data-lay l, 1 box unit per CSS px): every page takes its desk form, so every page has a foot that names the model */
const cv = { width: 1366, height: 1024, css: 1, logo: 276, ownerDocument: { body: { getAttribute: (k) => (k === "data-lay" ? "l" : null) } }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1366, height: 1024 }) };
function frame(scr, dev, o = {}) {
  const a = Object.assign(createMenuApp({ settings: { fpm: 0 }, anaOpen: () => true, pageCount: SV.guidePageCount, recPages: () => 1 }), { screen: scr, subT: 5, stats: STATS, lastDev: dev, pactUnlocked: true }, o);
  if (scr === SCREEN.GRAPHICS) a.gfxView = () => gfxView(a.settings, "2d", {});
  const R = rec({ widthK: 0.6 });
  probe.setOn(true);
  SV.drawShell(R.ctx, a, { state: "PLAY", time: 1, level: 1 }, cv, "2d", () => [], () => 0, () => ({}));
  const snap = probe.snapshot(); probe.setOn(false);
  return { texts: R.texts.map((t) => t.s), focus: snap ? snap.rects.filter((r) => r.focus).map((r) => r.name) : [] };
}
/* each page: its tap-mode words, and a key word only the key model shows */
const PAGES = [
  ["MENU", SCREEN.MENU, W.MENU_WORDS.TAP, W.MENU_WORDS.MOVE, { cursor: 3 }],
  ["LEVEL SELECT", SCREEN.LEVEL, LEVEL_TAP, W.LEVEL_WORDS.ROW, { levelRow: 1 }],
  ["SETTINGS", SCREEN.SETTINGS, W.TAP_ROW, W.SETTINGS_WORDS.row, { optRow: 2 }], // FOOT_TAP, or its step-down TAP_ROW where the pane leaves less room
  ["GRAPHICS", SCREEN.GRAPHICS, W.TAP_ROW, W.SETTINGS_WORDS.row, { gfxRow: 2 }],
  ["GUIDE", SCREEN.GUIDE, W.GUIDE_WORDS.TAP_DOOR + " · " + W.BACK_TAP, W.GUIDE_WORDS.PICK, { guideRow: 1 }],
  ["SCORES", SCREEN.SCORES, W.REC_WORDS.TAP, W.REC_WORDS.TAB, { recFocus: 0 }],
  ["STATS", SCREEN.STATS, W.REC_WORDS.TAP, W.REC_WORDS.TAB, { recFocus: 0 }],
  ["MEDALS", SCREEN.TROPHIES, W.REC_WORDS.TAP, W.REC_WORDS.TAB, { recFocus: 0 }],
];
const bad = [];
for (const [name, scr, tapW, keyW, o] of PAGES) {
  const t = frame(scr, "touch", o), k = frame(scr, "key", o), has = (T, s) => T.some((x) => x === s || (s.length > 12 && x.startsWith(s)));
  if (!has(t.texts, tapW) || t.texts.includes(keyW)) bad.push(name + " tap: " + J([tapW, keyW, t.texts.filter((s) => /TAP|ROW|TAB|MOVE|PICK/.test(s))]));
  if (has(k.texts, tapW) || !k.texts.includes(keyW)) bad.push(name + " key: " + J([tapW, keyW, k.texts.filter((s) => /TAP|ROW|TAB|MOVE|PICK/.test(s))]));
  /* ruling 5: tap mode shows no focus but MENU's PLAY (and LEVEL SELECT's START, lit as its main action with no ring: ruling 4); the key model shows
     the focused row, door, tab or key */
  const tf = name === "MENU" ? J(t.focus) === J(["PLAY"]) : name === "LEVEL SELECT" ? J(t.focus) === J(["START"]) : t.focus.length === 0;
  if (!tf) bad.push(name + " tap focus " + J(t.focus));
  if (k.focus.length !== 1 || (name === "MENU" && k.focus[0] !== "RECORDS")) bad.push(name + " key focus " + J(k.focus));
}
check("every page reads shellview's one tap mode (lastDev on a touch layout), never the hint device: the tap words and no focus (MENU: PLAY) on touch, the key words and the focus on keys",
  bad.length === 0, bad.join(" | "));
check("tapOf is a touch layout last driven by touch: a key or a controller press leaves it, a desk layout never has it",
  SV.tapOf({ lastDev: "touch" }, cv) === true && SV.tapOf({ lastDev: "key" }, cv) === false && SV.tapOf({ lastDev: "pad" }, cv) === false && SV.tapOf({ lastDev: "touch" }, { width: 600, height: 520 }) === false);
/* ENEMIES keeps its one tap-mode focus: the open tooltip's points value */
{
  const t = frame(SCREEN.ENEMIES, "touch", { foeRow: 2, foeTip: true }), s = frame(SCREEN.ENEMIES, "touch", { foeRow: 2, foeTip: false });
  check("ENEMIES in tap mode: the focused foe shows only with its tooltip open", t.focus.length === 1 && s.focus.length === 0, J([t.focus, s.focus]));
}
/* the INTRO's skip hint follows the same predicate */
{
  const show = (dev) => { const a = Object.assign(createMenuApp({ settings: { fpm: 0 } }), { screen: SCREEN.INTRO, introStage: 1, subT: 1, lastDev: dev, boardReady: true, readyT: 1 }); const R = rec({ widthK: 0.6 }); SV.drawShell(R.ctx, a, { state: "PLAY" }, cv, "2d", () => [], () => 0, () => ({})); return R.texts.map((t) => t.s); };
  check("INTRO's skip hint: TAP TO SKIP after a tap, ANY KEY TO SKIP after a key, on the same touch layout", show("touch").includes("TAP TO SKIP") && show("key").includes("ANY KEY TO SKIP"));
}
/* a hit sees the geometry the frame was drawn with: GUIDE's lines follow the tap mode, and its hits take the mode of the last frame drawn */
{
  const md = await import("../src/render/menudraw.js"), L = md.layout(1366, 1024, 276, 1);
  frame(SCREEN.GUIDE, "key");
  const gk = md.guideGeom(L, true);
  frame(SCREEN.GUIDE, "touch");
  const gt = md.guideGeom(L, true);
  check("GUIDE's hits use the geometry of the last frame drawn (its tap mode), so a tap lands where the doors are drawn", gk && gt && gk.tap === false && gt.tap === true, J([gk && gk.tap, gt && gt.tap]));
}

console.log("\n  TAP MODE RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
