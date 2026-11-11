// T10: the hint device, the hint words, and the menu copy that reads them.
import { readFileSync } from "node:fs";
import { DEF_CONTROLS, bindBtn, bindKey, bindMoveSet, resetDevice } from "../src/app/controls.js";
import { createHintDev, keyPress, pointerPress, wordsOf } from "../src/app/hints.js";
import { hints, setHints, tapMode } from "../src/render/hintcopy.js";
import * as md from "../src/render/menudraw.js";
import { drawShell, loadControlsArt } from "../src/render/shellview.js";
await loadControlsArt(); // the CONTROLS paint is lazy (v202): in before any CONTROLS draw
import { want as wantPage } from "../src/render/pages/lazy.js";
const RP = await wantPage("records"); // RECORDS is a lazy page (R20) too
import { SCREEN, OPT_ROWS, optRows, createMenuApp } from "../src/app/menuapp.js";
import { helpOf } from "../src/app/hints.js";
import { POWER } from "../src/core/entities.js";
import { coachTip } from "../src/app/coach.js";
import { drawCoach, drawOverlay, overlayCue } from "../src/render/scenes.js";
import { _set as setLazyPage } from "../src/render/pages/lazy.js";
setLazyPage("guide", await import("../src/render/pages/guide.js")); // the lazy GUIDE pages (v202 Task 3.5), as if their import had landed

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined && !cond ? " -> " + detail : ""));
}
const J = JSON.stringify;

/* A canvas stand-in: every call is a no-op, text and flat rects are recorded. */
const rec = () => {
  const texts = [], rects = [], st = { globalAlpha: 1, font: "10px mono", fillStyle: "#000" };
  const fn = {
    fillText: (s, x, y) => { texts.push({ s: String(s), x, y, font: st.font }); },
    fillRect: (x, y, w, h) => { rects.push([st.fillStyle, x, y, w, h]); },
    measureText: (s) => ({ width: String(s).length * 0.6 * parseFloat((/(\d+)px/.exec(st.font) || [0, 10])[1]) }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    getTransform: () => ({ a: 1, d: 1 }),
  };
  const c = new Proxy(st, { get: (t, p) => (p in t ? t[p] : fn[p] || (() => {})), set: (t, p, v) => { t[p] = v; return true; } });
  return { c, texts, rects, has: (s) => texts.some((x) => x.s === s), strs: () => texts.map((x) => x.s) };
};
const paint = (f) => { const r = rec(); f(r.c); return r; };
/* a GUIDE door's teaser may break at its " · " onto two lines where its door is narrow (fix round 1: the words.js step-down, never a clip) */
const hasT = (r, s) => r.has(s) || r.strs().some((x, i, a) => x + " · " + a[i + 1] === s);
const L = md.layout(600, 520);
const INFO = { level: 1, best: [], unlocked: true, daily: null, top: [], opt: OPT_ROWS }; // opt: the SETTINGS rows the pane counts (REAL 3D: twelve)
const ITEMS = ["PLAY", "LEVEL SELECT", "DAILY", "RECORDS", "SETTINGS", "GUIDE", "SOURCE"];
/* MENU (v202 Task 3.1, pages/menu.js): shellview's names and values; the foot is label first, keycap last, read back from the page's plan */
const menu = (cur, touch, rev = "", o = {}, L2) => (c) => md.drawMenu(c, { rows: ITEMS, focus: ITEMS[cur], level: 1, rev, pages: 4, enterT: 9, ...o }, L2 || L, 9, !!touch);
const pg = await import("../src/render/pages/menu.js");
const lvp = await import("../src/render/pages/level.js");
const CAPG = { up: "▲", dn: "▼", lf: "◀", rt: "▶" };
const footOf = () => { const { P, verb } = pg._dbg.last, F = verb != null && P.foot[verb]; return F ? F.parts.map((q) => q.t || q.sep || (Array.isArray(q.cap) ? CAPG[q.cap[0]] : "[" + q.cap + "]")).join(" ") : ""; };
/* SETTINGS / GRAPHICS (v202 Task 3.4, pages/settings.js, lazy: in as if its import had landed): the foot is label first, keycap last, read back from the page's plan */
const sp = await import("../src/render/pages/settings.js");
(await import("../src/render/pages/lazy.js"))._set("settings", sp);
const sfootOf = () => { const F = sp._dbg.last.Pl.foot; return F ? F.lines.map((L) => L.ps.map((q) => q.t || q.sep || (Array.isArray(q.cap) ? CAPG[q.cap[0]] : "[" + q.cap + "]")).join(" ")).join(" · ") : ""; }; // the words in order, whether the foot takes one line or two
const sfoot = (f, want) => (c) => { f(c); const s = sfootOf(); if (s === want) c.fillText(want, 0, 0); }; // the foot's words as one line, so r.has() reads them
/* the GUIDE pages' foot (v202 Task 3.5, pages/guide.js): label first, keycap last, read back from the page's plan; "" where the box has no foot (touch) */
const gpg = await import("../src/render/pages/guide.js");
const GCAP = { up: "▲", dn: "▼", lf: "◀", rt: "▶" };
const gfoot = () => { const F = gpg._dbg.last && gpg._dbg.last.P.foot; return F ? F.parts.map((q) => q.t || q.sep || (Array.isArray(q.cap) ? GCAP[q.cap[0]] : "[" + q.cap + "]")).join(" ") : ""; };
const GFOOT = (f) => { const r = paint(f); return { r, foot: gfoot() }; };
const GPAGE = { HOWTO: "HOW TO PLAY", ITEMS: "POWER-UPS", ENEMIES: "ENEMIES", FLOOR: "FLOOR", GUIDE: "GUIDE" };
const STATS_UI = { rows: [], notes: [], trophies: [] };
const LT = md.layout(1024, 768, 207);
/* RECORDS' SCORES / MEDALS foot (v202 Task 4.1, pages/records.js): label first, keycaps last, read back from the page's plan like MENU's */
const RCAP = { lf: "←", rt: "→", up: "↑", dn: "↓" };
const recFoot = () => { const { S, foc } = RP._dbg.last, q = S.feet.find((f) => f.v === foc); return q ? q.fp.parts.map((x) => x.t || x.sep || (Array.isArray(x.cap) ? RCAP[x.cap[0]] : "[" + x.cap + "]")).join(" ") : ""; };
const RF = (want) => Object.assign(() => recFoot() === want, { toString: () => want + " (records foot " + recFoot() + ")" });
const MEDALS_P = (T, tabs = true) => (c) => md.drawTrophies(c, { level: 1, focus: tabs ? "tabs" : "body", rows: [] }, L, 9, T);
const GFX = { rows: [] };
/* Every page with a foot, keyboard or touch geometry. */
const PAGES = {
  LEVEL: (T) => (c) => md.drawLevelSelect(c, 1, L, 9, 0, 0, true, 0, false, T, INFO),
  HOWTO: (T) => (c) => md.drawHowTo(c, L, 9, "2d", T),
  ITEMS: (T) => (c) => md.drawItemsHelp(c, L, 9, "2d", T),
  ENEMIES: (T) => (c) => md.drawEnemiesHelp(c, L, 9, "2d", T),
  FLOOR: (T) => (c) => md.drawFloorHelp(c, L, 9, "2d", T),
  GUIDE: (T) => (c) => md.drawGuide(c, L, 9, 0, "2d", T),
  SCORES: (T) => (c) => md.drawScores(c, { level: 1, focus: "body", heat: 0, scores: [], plaques: 0 }, L, 9, T),
  /* SETTINGS / GRAPHICS on touch: the tablet's desk (#sh 1024x768), where the page has a foot; a touch 600x520 column pages its 44 CSS px rows
     and its page keys' strip stands where the foot was (v202 Task 3.4 fix round 1) */
  OPTIONS: (T) => (c) => md.drawSettings(c, T ? LT : L, 9, { rows: optRows(false), row: "MUSIC", vals: {}, touch: T }),
  GRAPHICS: (T) => (c) => md.drawGraphics(c, T ? LT : L, 9, { row: 0, view: GFX, touch: T }),
};
const PAD = wordsOf("pad", DEF_CONTROLS);

/* ---- the tracker ---- */
{
  const devAt = (lay) => createHintDev({ lay: () => lay });
  check("boot: keys on a desktop layout", devAt("d").device(0) === "key");
  check("boot: touch on a phone layout", devAt("p").device(0) === "touch" && devAt("l").device(0) === "touch");
  const d = devAt("d");
  d.note("pad", 1000);
  check("the first flip from boot is immediate", d.device(1000) === "pad");
  d.note("key", 1500);
  check("dwell: a flip inside 0.75 s of the last one is held back", d.device(1500) === "pad" && d.device(1749) === "pad");
  check("dwell: the held flip lands at 0.75 s, by t alone", d.device(1750) === "key");
  const a = devAt("d");
  let flips = 0, was = a.device(0), stamps = [];
  for (let t = 0; t <= 2000; t += 100) {
    a.note(t % 200 === 0 ? "pad" : "key", t);
    const n = a.device(t);
    if (n !== was) { flips++; stamps.push(t); was = n; }
  }
  check("alternating presses for 2 s: at most one flip per dwell", flips <= 4 && stamps.every((t, i) => !i || t - stamps[i - 1] >= 750), J(stamps));
  a.note("key", 2100);
  check("the last device used wins once the dwell ends", a.device(2100 + 750) === "key");
  const b = devAt("d");
  b.note("pad", 0); b.note("key", 100); b.note("pad", 200);
  check("a press back to the shown device drops the pending flip", b.device(5000) === "pad");
  const m = devAt("d");
  m.note("mouse", 0); m.note("wheel", 0); m.note("", 0); m.note(undefined, 0);
  check("note() only takes key / pad / touch", m.device(9000) === "key");

  for (const code of ["ShiftLeft", "ShiftRight", "ControlLeft", "AltRight", "MetaLeft", "CapsLock", "NumLock", "ScrollLock", "ContextMenu", "Fn"])
    check(code + " is no press", keyPress({ code, key: code }) === null);
  check("AltGraph by its key name is no press", keyPress({ code: "AltRight", key: "AltGraph" }) === null);
  check("an auto-repeat is no press", keyPress({ code: "KeyW", key: "w", repeat: true }) === null);
  check("letters, Escape and Enter are presses", ["KeyW", "Escape", "Enter", "Space"].every((code) => keyPress({ code, key: "x" }) === "key"));
  check("a mouse move and a wheel are no press", pointerPress({ type: "mousemove", pointerType: "mouse" }) === null && pointerPress({ type: "wheel" }) === null);
  check("a mouse click is no press", pointerPress({ type: "pointerdown", pointerType: "mouse" }) === null);
  check("a touch or a pen tap is a press", pointerPress({ pointerType: "touch" }) === "touch" && pointerPress({ pointerType: "pen" }) === "touch");
  const k = devAt("d");
  k.pad({ press: ["S"], mag: 0 }, 0);
  k.key({ code: "ShiftLeft", key: "Shift" }, 5000);
  k.pointer({ pointerType: "mouse" }, 5000);
  check("modifier keys, mouse move and wheel never flip", k.device(9000) === "pad");
  k.key({ code: "KeyW", key: "w" }, 9000);
  check("a real key flips back", k.device(9000) === "key");

  const s = devAt("d");
  s.pad({ press: [], mag: 0.49 }, 0);
  check("stick below 0.5 never flips", s.device(0) === "key");
  s.pad({ press: [], mag: 0.5 }, 10);
  check("stick at 0.5 flips", s.device(10) === "pad");
  const n = devAt("d");
  n.pad({ press: [], mag: 0.6 }, 0);
  n.key({ code: "KeyW", key: "w" }, 800);
  for (let t = 800; t < 4000; t += 16) n.pad({ press: [], mag: 0.6 }, t);
  check("a stick stuck past 0.5 claims once, never against a later key", n.device(4000) === "key");
  n.pad({ press: [], mag: 0.3 }, 4000);
  n.pad({ press: [], mag: 0.6 }, 4016);
  check("the stick re-arms under 0.35", n.device(4016) === "pad");
  const q = devAt("d");
  q.pad({ press: ["dU"], mag: 0 }, 0);
  check("a D-PAD press flips", q.device(0) === "pad");
  const e = devAt("d");
  e.pad(null, 0); e.key(null, 0); e.pointer(null, 0);
  check("null events are inert", e.device(0) === "key");
}

/* ---- the words ---- */
{
  const K = wordsOf("key", DEF_CONTROLS);
  check("wordsOf key = ENTER / ESC", K.ok === "ENTER" && K.back === "ESC" && K.dev === "key" && K.tapPage === false);
  check("wordsOf key reads the default binds", K.bomb === "SPACE" && K.throw === "E" && K.remote === "Q" && K.pause === "P" && K.move === "WASD" && K.moveAlt === "ARROWS" && K.tab === "[ ]", J(K));
  check("wordsOf pad = SOUTH / EAST", PAD.ok === "SOUTH" && PAD.back === "EAST" && PAD.dev === "pad" && PAD.tapPage === false && PAD.tab === "SHOULDERS");
  check("wordsOf pad reads the default binds", PAD.bomb === "SOUTH" && PAD.throw === "WEST" && PAD.remote === "EAST" && PAD.pause === "START" && PAD.move === "D-PAD" && PAD.moveAlt === "L-STICK", J(PAD));
  const T = wordsOf("touch", DEF_CONTROLS);
  check("wordsOf touch keeps the key column and says tapPage", T.dev === "touch" && T.tapPage === true && T.ok === "ENTER" && T.back === "ESC");
  check("no controls given = the defaults", J(wordsOf("key")) === J(K));
  check("the render default is exactly wordsOf(key, defaults)", J(hints()) === J(K), J(hints()));

  const onEast = bindBtn(DEF_CONTROLS, "BOMB", "E").c, ep = wordsOf("pad", onEast);
  check("BOMB rebound to EAST: the pad's BOMB word follows it", ep.bomb === "EAST" && ep.remote === "SOUTH");
  check("BOMB rebound to EAST: CONFIRM and BACK stay fixed (the record's fixed layer, no rebound BACK exists)", ep.ok === "SOUTH" && ep.back === "EAST");
  const kk = wordsOf("key", bindKey(bindKey(DEF_CONTROLS, "THROW", "KeyZ").c, "PAUSE", "KeyO").c);
  check("keys: THROW and PAUSE follow a rebind", kk.throw === "Z" && kk.pause === "O" && kk.ok === "ENTER" && kk.back === "ESC");
  const mv = wordsOf("key", bindMoveSet(DEF_CONTROLS, ["KeyI", "KeyL", "KeyK", "KeyJ"]).c);
  check("keys: MOVE follows a rebind", mv.move === "IJKL", mv.move);
  const rs = wordsOf("pad", { ...DEF_CONTROLS, stick: "R" });
  check("pad: the stick word follows the MOVE row", rs.moveAlt === "R-STICK");
  check("pad: a shoulder bind prints its full word", wordsOf("pad", bindBtn(DEF_CONTROLS, "THROW", "SHL").c).throw === "L SHOULDER");
  check("a reset comes back to the default words", J(wordsOf("key", resetDevice(bindKey(DEF_CONTROLS, "THROW", "KeyZ").c, "key"))) === J(K));

  check("tapMode: a keyboard layout never", tapMode(false) === false);
  check("tapMode: touch layout, keys or touch words", tapMode(true) === true);
  setHints(PAD);
  check("tapMode: touch layout, pad words read as a pad", tapMode(true) === false && tapMode(false) === false && hints() === PAD);
  setHints(null);
  check("setHints(null) restores the keyboard words", hints().dev === "key" && tapMode(true) === true);
}

/* ---- default copy, byte for byte ---- */
{
  const WANT = [
    ["LEVEL foot", PAGES.LEVEL(false), "CHANGE"], // the LEVEL row focused (v202 Task 2.3: the foot follows the row; Task 3.3: label first, keycap last, checked whole below)
    ["SCORES foot", PAGES.SCORES(false), RF("DIFFICULTY ← → · TAB [Q] [E] · BACK [ESC]")], // the page body's foot: the filter, the tab keys, back
    ["OPTIONS foot", sfoot(PAGES.OPTIONS(false), "ROW ▲ ▼ · CHANGE ◀ ▶ · BACK [ESC]"), "ROW ▲ ▼ · CHANGE ◀ ▶ · BACK [ESC]"],
    ["GRAPHICS foot", sfoot(PAGES.GRAPHICS(false), "ROW ▲ ▼ · CHANGE ◀ ▶ · BACK [ESC]"), "ROW ▲ ▼ · CHANGE ◀ ▶ · BACK [ESC]"],
    ["STATS foot", (c) => md.drawStats(c, L, 9, STATS_UI, false, null), "↑ TABS · T MEDALS · C COPY MY STATS · R RESET · ESC BACK"],
    ["STATS armed foot", (c) => md.drawStats(c, L, 9, STATS_UI, true, null), "R AGAIN ERASES · OTHER KEYS CANCEL · KEEPS SETTINGS + GAME SPEED · C COPY"],
    ["MEDALS foot", MEDALS_P(false), RF("TAB ← → · BACK [ESC]")],
    ["MENU foot verb on PLAY", menu(0), "START"],
    ["MENU foot verb on a door", menu(4), "OPEN"],
    ["MENU PLAY keycap", menu(0), "ENTER"],
    ["MENU SOURCE teaser", menu(6), "GITHUB"],
    ["ATTRACT", (c) => md.drawAttractHint(c, L, 200), "DEMO — TAP TO PLAY"],
    ["show skip", (c) => md.drawIntroChrome(c, 1, 0.6, 600, 520, "d"), "ANY KEY TO SKIP"],
    ["show skip, touch", (c) => md.drawIntroChrome(c, 1, 0.6, 600, 520, "p"), "TAP TO SKIP"],
    ["title, touch", (c) => md.drawIntroChrome(c, 0, 1, 600, 520, "p"), "TAP TO START"],
    ["LEVEL row label", PAGES.LEVEL(false), "LEVEL"], // the row's label (Task 3.3: the approved d-03 frame names no shortcut cap; ←→ live in the foot)
    ["GUIDE sub", PAGES.GUIDE(false), "2 RULES · 6 KEYS"],
    ["GUIDE sub, touch", PAGES.GUIDE(true), "2 RULES · 6 CONTROLS"],
    ["LEVEL touch (compact, 600x520: no foot, its BACK key)", PAGES.LEVEL(true), "BACK"],
    ["LEVEL foot, touch (a landscape tablet in tap mode)", (c) => md.drawLevelSelect(c, 1, md.layout(1024, 768, 200), 9, 0, 0, true, 0, false, true, { ...INFO, tap: true }), md.LEVEL_TAP],
    ["OPTIONS foot, touch", PAGES.OPTIONS(true), sp.COPY.tapRow], // the tablet desk's pane foot: FOOT_TAP's step-down (FOOT_TAP itself is wider than the pane)
  ];
  for (const [nm, f, s] of WANT) { const r = paint(f); check("default: " + nm + " stays \"" + s + "\"", typeof s === "function" ? s() : /^GUIDE sub/.test(nm) ? hasT(r, s) : r.has(s), r.strs().join("|")); }
  /* v202 Task 3.5: the GUIDE pages' feet are label first, keycap last (the MENU page's grammar); every key the old foot named is still named */
  for (const [nm, f, s] of [["HOW TO foot", PAGES.HOWTO(false), "BACK [ESC] [ENTER]"], ["ITEMS foot", PAGES.ITEMS(false), "WALK OVER A POWER-UP TO COLLECT · BACK [ESC]"],
    ["ENEMIES foot", PAGES.ENEMIES(false), "MOVE ▲ ▼ ◀ ▶ · POINTS [ENTER] · BACK [ESC]"], ["FLOOR foot", PAGES.FLOOR(false), "BACK [ESC]"], ["GUIDE foot", PAGES.GUIDE(false), "PICK ▲ ▼ ◀ ▶ · OPEN [ENTER] · BACK [ESC]"]]) {
    const g = GFOOT(f);
    check("default: " + nm + " reads \"" + s + "\"", g.foot === s, g.foot);
  }
  { const g = GFOOT(PAGES.HOWTO(true)); check("default: HOW TO, touch (600x520 goes compact): no foot, the BACK key in the head (any tap backs out)", g.foot === "" && g.r.has("BACK"), g.r.strs().join("|")); }
  { const g = GFOOT(PAGES.GUIDE(true)); check("default: GUIDE foot, touch (the desk holds at 600x520) stays \"TAP A DOOR · TAP OUTSIDE TO GO BACK\"", g.foot === "TAP A DOOR · TAP OUTSIDE TO GO BACK", g.foot); }
  { const r = paint(PAGES.LEVEL(false)), d = lvp._dbg.last; // the LEVEL row's own label, and the foot whole (label first, keycap last)
    check("default: the LEVEL row's label reads \"LEVEL\", no keycap; the foot reads ROW ↑↓ · CHANGE ←→ · START ENTER · BACK ESC", d.P.rows.LEVEL.label.s === "LEVEL" && !r.has("[ ]") && md.levelFoot("LEVEL", false) === "ROW ↑↓ · CHANGE ←→ · START ENTER · BACK ESC" && d.verb === "value", JSON.stringify(d.P.rows.LEVEL.label)); }
  check("FOOT_TAP keeps its default bytes (CONTROLS reads it too); the key foot is the page's parts, no one string", md.FOOT_TAP === "TAP A ROW TO CHANGE IT · TAP OUTSIDE TO GO BACK" && md.FOOT_KEYS === undefined);
  const how = paint(PAGES.HOWTO(false));
  for (const s of ["WASD", "ARROWS", "SPACE", "E", "Q", "WALK INTO BOMB", "P"]) check("HOW TO row reads " + s, how.has(s)); // MOVE's two keycaps (v202 Task 3.5: one cap each)
  check("HOW TO on touch: MOVE reads WASD / ARROWS (no keycaps on touch)", paint(PAGES.HOWTO(true)).has("WASD / ARROWS"));
  check("HOW TO never advertises the old THROW chord", !how.has("SHIFT + SPACE"));
}

/* ---- the named word changes ---- */
{
  const r = paint(menu(0, false, "v99")), f0 = footOf();
  check("MENU foot reads MOVE ▲▼ · START ENTER | v99: label first, keycap last, every word drawn", f0 === "MOVE ▲ ▼ · START [ENTER] | v99" && ["MOVE", "START", "ENTER", "v99"].every((s) => r.has(s)) && !r.strs().some((s) => /ENTER SELECT/.test(s)), f0 + " / " + r.strs().join("|"));
  paint(menu(0));
  check("MENU foot without a build tag", footOf() === "MOVE ▲ ▼ · START [ENTER]", footOf());
  for (const [W, H] of [[600, 520], [608, 352]]) {
    const t = paint((c) => md.drawIntroChrome(c, 0, 1, W, H, "d"));
    check(`title reads PRESS ANY KEY OR BUTTON on keyboard layouts ${W}x${H}`, t.has("PRESS ANY KEY OR BUTTON") && !t.has("PRESS ANY KEY"));
    check(`the title fits W-28 at ${W}x${H}`, "PRESS ANY KEY OR BUTTON".length * 18 * 0.6 <= W - 28);
  }
  setHints(PAD);
  const tp = paint((c) => md.drawIntroChrome(c, 0, 1, 600, 520, "p"));
  setHints(null);
  check("a touch title keeps its own words whatever the device", tp.has("TAP TO START"));
  /* v202 Task 3.5: the HOW TO door's preview is label-first key pairs, whole pairs only: the desktop window's door keeps MOVE and BOMB (a 600 x 520
     board box's narrower door keeps MOVE alone); the THROW, REMOTE and PAUSE keys moved to the page itself, which follows a rebound THROW */
  const g = paint((c) => md.drawGuide(c, md.layout(1366, 768, 200, 1), 9, 0, "2d", false)), g6 = paint(PAGES.GUIDE(false));
  check("GUIDE preview: MOVE [WASD] then BOMB [SPACE], label first; no K (1366 x 768)", g.has("MOVE") && g.has("WASD") && g.has("BOMB") && g.has("SPACE") && !g.has("K"), g.strs().join("|"));
  check("GUIDE preview at 600 x 520: MOVE [WASD], whole", g6.has("MOVE") && g6.has("WASD") && !g6.has("K"), g6.strs().join("|"));
  const hw = paint(PAGES.HOWTO(false));
  check("HOW TO draws the THROW key, no K", hw.has("E") && hw.has("Q") && hw.has("P") && !hw.has("K"), hw.strs().join("|"));
  setHints(wordsOf("key", bindKey(DEF_CONTROLS, "THROW", "KeyZ").c));
  const g2 = paint(PAGES.HOWTO(false));
  setHints(null);
  check("HOW TO follows a rebound THROW", g2.has("Z") && !g2.has("E"));
}

/* ---- pad words, and geometry that never moves ---- */
{
  setHints(PAD);
  const PADWANT = [
    ["LEVEL foot", PAGES.LEVEL(false), "D-PAD"],
    ["LEVEL foot's confirm", PAGES.LEVEL(false), "SOUTH"],
    ["SCORES foot", PAGES.SCORES(false), RF("DIFFICULTY [D-PAD] · BACK [EAST]")],
    ["OPTIONS foot", sfoot(PAGES.OPTIONS(false), "ROW [D-PAD] · CHANGE [D-PAD] · BACK [EAST]"), "ROW [D-PAD] · CHANGE [D-PAD] · BACK [EAST]"],
    ["GRAPHICS foot", sfoot(PAGES.GRAPHICS(false), "ROW [D-PAD] · CHANGE [D-PAD] · BACK [EAST]"), "ROW [D-PAD] · CHANGE [D-PAD] · BACK [EAST]"],
    ["STATS foot offers no reset", (c) => md.drawStats(c, L, 9, STATS_UI, false, null), "↑ TABS · NORTH MEDALS · WEST COPY MY STATS · EAST BACK"],
    ["MEDALS foot", MEDALS_P(false), RF("TAB [D-PAD] · BACK [EAST]")],
    ["MENU foot's D-PAD keycap", menu(0, false, "v99"), "D-PAD"],
    ["MENU PLAY keycap", menu(0), "SOUTH"],
    ["MENU foot on a door", menu(4), "OPEN"],
    ["MENU foot on SOURCE: a controller press opens no tab", menu(6), "NEEDS A CLICK OR ENTER"],
    ["ATTRACT", (c) => md.drawAttractHint(c, L, 200), "DEMO — PRESS ANY BUTTON"],
    ["show skip", (c) => md.drawIntroChrome(c, 1, 0.6, 600, 520, "d"), "ANY BUTTON TO SKIP"],
    ["GUIDE sub, whole beside the key strip", PAGES.GUIDE(false), "2 RULES · 6 CONTROLS"],
    ["GUIDE sub, touch door", PAGES.GUIDE(true), "2 RULES · 6 CONTROLS"],
    ["HOW TO move", PAGES.HOWTO(false), "D-PAD"],
    ["HOW TO move, its second cap", PAGES.HOWTO(false), "L-STICK"],
    ["HOW TO throw", PAGES.HOWTO(false), "WEST"],
    ["HOW TO pause", PAGES.HOWTO(false), "START"],
    ["pad words on a touch layout: LEVEL (a landscape tablet)", (c) => md.drawLevelSelect(c, 1, md.layout(1024, 768, 200), 9, 0, 0, true, 0, false, true, INFO), "SOUTH"],
    ["pad words on a touch layout: OPTIONS", sfoot(PAGES.OPTIONS(true), "ROW [D-PAD] · CHANGE [D-PAD] · BACK [EAST]"), "ROW [D-PAD] · CHANGE [D-PAD] · BACK [EAST]"],
    ["pad words on a touch layout: HOW TO", PAGES.HOWTO(true), "D-PAD / L-STICK"],
    ["pad words on a touch layout: show skip", (c) => md.drawIntroChrome(c, 1, 0.6, 600, 520, "p"), "ANY BUTTON TO SKIP"],
  ];
  for (const [nm, f, s] of PADWANT) { const r = paint(f); check("pad: " + nm + " = \"" + s + "\"", typeof s === "function" ? s() : /^GUIDE sub/.test(nm) ? hasT(r, s) : r.has(s), r.strs().join("|")); }
  for (const [nm, f, s] of [["HOW TO foot", PAGES.HOWTO(false), "REBIND IN SETTINGS › CONTROLS · BACK [EAST] [SOUTH]"], ["ITEMS foot", PAGES.ITEMS(false), "WALK OVER A POWER-UP TO COLLECT · BACK [EAST]"],
    ["ENEMIES foot", PAGES.ENEMIES(false), "MOVE [D-PAD] · POINTS [SOUTH] · BACK [EAST]"], ["FLOOR foot", PAGES.FLOOR(false), "BACK [EAST]"], ["GUIDE foot", PAGES.GUIDE(false), "PICK [D-PAD] · OPEN [SOUTH] · BACK [EAST]"]]) {
    const g = GFOOT(f);
    check("pad: " + nm + " = \"" + s + "\"", g.foot === s, g.foot);
  }
  /* a touch layout has no foot: a controller there gets the cue line under the head (fix round 1, Important 4), label first, keycap last; HOW TO
     names CONTROLS where it fits (600 x 520 touch: it does) */
  for (const [nm, f, want, sign] of [["HOW TO", PAGES.HOWTO(true), ["BACK"], "REBIND IN SETTINGS › CONTROLS"], ["ENEMIES", PAGES.ENEMIES(true), ["POINTS", "BACK"]], ["FLOOR", PAGES.FLOOR(true), ["BACK"]], ["POWER-UPS", PAGES.ITEMS(true), ["PAGE", "BACK"]]]) {
    const r = paint(f), cue = gpg._dbg.last.G.d.head.cue, ops = gpg._dbg.last.P.rest.filter((o) => (o.op === "text" || o.op === "cap") && cue && o.y >= cue.y - 1 && o.y <= cue.y + cue.h + 1);
    const seq = ops.map((o) => (o.op === "cap" ? "[" + o.s + "]" : o.s)).filter((s) => s !== "·"), at = (s) => seq.indexOf(s);
    check("pad on a touch layout: " + nm + " has the controller cue line, " + want.join(", ") + ", each label before its keycap" + (sign ? ", and the " + sign + " signpost" : ""), !!cue && r.has("BACK") && want.every((s) => at(s) >= 0 && /^\[/.test(seq[at(s) + 1] || "")) && (!sign || at(sign) === 0), J(seq));
  }
  paint(menu(0, false, "v99"));
  check("pad: MENU foot = MOVE D-PAD · START SOUTH | v99 (label first, keycap last)", footOf() === "MOVE [D-PAD] · START [SOUTH] | v99", footOf());
  paint(menu(6, false, "v99"));
  check("pad: MENU foot on SOURCE says it needs a click or Enter, with no SOUTH keycap (never a claim the press keeps)", footOf() === "MOVE [D-PAD] · NEEDS A CLICK OR ENTER | v99", footOf());
  const lv = paint(PAGES.LEVEL(false));
  check("pad: LEVEL has no [ ] or 1–5 cap and no key digits on MODIFIERS; its foot reads ROW D-PAD · CHANGE D-PAD · START SOUTH · BACK EAST", !lv.has("[ ]") && !lv.has("1–5") && lv.has("MODIFIERS") && !lv.has("1 ONE LIFE") && md.levelFoot("LEVEL", false) === "ROW D-PAD · CHANGE D-PAD · START SOUTH · BACK EAST", lv.strs().join("|"));
  paint(PAGES.LEVEL(true));
  check("pad on a touch layout (compact): the focus model (the LEVEL row), never tap mode", lvp._dbg.last.foc === "LEVEL", lvp._dbg.last.foc);
  const gd = paint(PAGES.GUIDE(false)), hp = paint(PAGES.HOWTO(false));
  check("pad: GUIDE preview names pad buttons, no key caps (THROW WEST and REMOTE EAST on the HOW TO page)", gd.has("D-PAD") && gd.has("SOUTH") && hp.has("WEST") && hp.has("EAST") && !gd.has("WASD") && !gd.has("SPACE") && !hp.has("WASD"), gd.strs().join("|"));
  const noLetter = /(^|[ ·/])(A|B|X|Y) (CONFIRM|BACK|OPEN|START|CYCLE|STARTS|OPENS|MEDALS|COPY)|(^|[ ·/])(LB|RB|LT|RT)( |$)/;
  const every = [...Object.values(PAGES).map((p) => p(false)), menu(0), menu(4), menu(3), menu(6)].flatMap((f) => paint(f).strs());
  check("no face-button letter on a pad hint", !every.some((s) => noLetter.test(s)), every.filter((s) => noLetter.test(s)).join("|"));

  check("pad: LEVEL SELECT draws no SHOULDERS cap (v202 Task 3.3: the approved frame names no shortcut cap; the foot names the controls)", !lv.has("SHOULDERS"));

  /* the HOW TO door's strip (pages/guide.js): every pair ends inside the strip, which ends 10 px before the door's chevron */
  const stripEnd = () => { const S = gpg._dbg.last.P.strips["HOW TO PLAY"]; return { w: S.w, right: Math.max(0, ...S.ops.map((o) => (o.op === "cap" ? o.x + o.w : o.op === "text" ? o.x + (o.mw || 0) : 0))) }; };
  paint(PAGES.GUIDE(false));
  const se = stripEnd();
  check("pad: GUIDE caps stop before the door's chevron", se.right > 0 && se.right <= se.w + 1e-9, J(se));

  setHints(wordsOf("key", bindMoveSet(bindKey(bindKey(DEF_CONTROLS, "THROW", "PageDown").c, "BOMB", "Insert").c, ["PageUp", "End", "Home", "Delete"]).c));
  paint(PAGES.GUIDE(false));
  const sw = stripEnd();
  check("long key names never run a GUIDE cap past the chevron", sw.right <= sw.w + 1e-9, J(sw));

  setHints(null);
  const flat = (r) => r.rects.filter((x) => x[0] !== "rgba(4,7,14,0.9)");
  const pages = { ...PAGES, MENU0: (T) => menu(0, T, "v99"), MENU3: (T) => menu(3, T, "v99"), MENU4: (T) => menu(4, T, "v99"), STATS: () => (c) => md.drawStats(c, L, 9, STATS_UI, false, null), MEDALS: () => MEDALS_P(false, false),
    SCORES_TABS: (T) => (c) => md.drawScores(c, { level: 1, focus: "tabs", heat: 0, scores: [], plaques: 0 }, L, 9, T), STATS_TABS: (T) => (c) => md.drawStats(c, L, 9, STATS_UI, false, null, T, true), MEDALS_TABS: (T) => MEDALS_P(T) }; // MENU3 is RECORDS since v202 Task 2.2, MENU4 SETTINGS; *_TABS: RECORDS' tab row
  /* MENU (v202 Task 3.1; fix round 1): the foot's keycaps and PLAY's keycap are keys, sized by their legend (▲ ▼ + ENTER vs D-PAD + SOUTH). Only
     those cap rects are exempt. The foot's plaque is centred, so it moves by exactly the caps' advance (each cap's gap + width) that changed: its x by
     minus half of it, its w by all of it; every rect of the plaque compares by its offsets from the plaque's two edges, every other rect as it is, and
     the plaque's words (everything but its caps) keep their order. */
  const inR = (q, x) => x[1] >= q.x - 0.5 && x[2] >= q.y - 0.5 && x[1] + x[3] <= q.x + q.w + 0.5 && x[2] + x[4] <= q.y + q.h + 6.5;
  const CAPH = 30; // DEV.d.caph: a foot cap's height
  const capsOf = () => {
    const { P, verb } = pg._dbg.last, F = (verb != null && P.foot[verb]) || null;
    return { F, caps: [...(F ? F.parts.filter((q) => q.cap).map((q) => ({ x: q.x, y: F.mid - CAPH / 2, w: q.w, h: CAPH })) : []), ...(P.rows.PLAY.cap ? [P.rows.PLAY.cap] : [])],
      adv: F ? F.parts.reduce((n, q) => n + (q.cap ? q.gap + q.w : 0), 0) : 0, words: F ? F.parts.filter((q) => !q.cap).map((q) => q.t || q.sep) : [] };
  };
  const norm = (r, q) => flat(r).filter((x) => !q.caps.some((z) => inR(z, x))).map((x) => (q.F && inR(q.F, x) ? ["plaque", x[0], x[1] - q.F.x, x[2], q.F.x + q.F.w - (x[1] + x[3]), x[4]] : x));
  for (const T of [false, true]) for (const [nm, p] of Object.entries(pages)) {
    /* LEVEL SELECT's foot (v202 Task 3.3): its caps, their advance, its plaque and its words, read back from the page's plan as MENU's */
    const lvFoot = () => { const { P, verb } = lvp._dbg.last, F = verb != null && P.foot[verb] ? P.foot[verb] : null; return { F, caps: F ? F.parts.filter((q) => q.cap).map((q) => ({ x: q.x, y: F.mid - CAPH / 2, w: q.w, h: CAPH })) : [], adv: F ? F.parts.reduce((n, q) => n + (q.cap ? q.gap + q.w : 0), 0) : 0, words: F ? F.parts.filter((q) => !q.cap).map((q) => q.t || q.sep) : [] }; };
    setHints(null); const a = paint(p(T)), qa = /^MENU/.test(nm) ? capsOf() : nm === "LEVEL" ? lvFoot() : null;
    setHints(PAD); const b = paint(p(T)), qb = /^MENU/.test(nm) ? capsOf() : nm === "LEVEL" ? lvFoot() : null;
    setHints(null);
    if (/^MENU/.test(nm)) {
      const na = norm(a, qa), nb = norm(b, qb), d = qb.adv - qa.adv, moved = !qa.F === !qb.F && (!qa.F || (Math.abs(qb.F.w - qa.F.w - d) < 1e-9 && Math.abs(qb.F.x - qa.F.x + d / 2) < 1e-9));
      check(`a flip changes words only: ${nm}${T ? " touch" : ""} keeps every rect but its keycaps; the foot's plaque moves by the caps' advance alone (${d.toFixed(1)}), its words in order`,
        J(na) === J(nb) && na.length > 0 && moved && J(qa.words) === J(qb.words) && (T || (qa.F && na.some((x) => x[0] === "plaque"))), J({ n: [na.length, nb.length], d, F: [qa.F && [qa.F.x, qa.F.w], qb.F && [qb.F.x, qb.F.w]], words: [qa.words, qb.words] }));
      continue;
    }
    if (nm === "OPTIONS" || nm === "GRAPHICS") { // v202 Task 3.4: the foot's keycaps are keys sized by their legend (▲ ▼ ◀ ▶ vs D-PAD); only the foot plaque's rects are exempt, its words keep their order
      const fa = (setHints(null), paint(p(T)), sp._dbg.last.Pl.foot), wa = sfootOf(), fb = (setHints(PAD), paint(p(T)), sp._dbg.last.Pl.foot), wb = sfootOf(), out = () => (x) => ![fa, fb].some((F) => F && inR({ x: F.x, y: F.y, w: F.w, h: F.h }, x)); // either plaque's rect: the bed's tiles under a plaque that moved
      setHints(null);
      const words = (s) => s.replace(/ ?(\[[^\]]*\]|[▲▼◀▶])/g, "");
      /* MENU's rule, per line (fix round 1): each line's width moves by its own keycaps' advance alone (each cap's gap + width) and its words keep
         their order; the plaque's width moves by the widest line's change, its x by nothing (the pane's foot is left-aligned) or by half of it
         (a centred foot) */
      const lineOf = (F) => F.lines.map((L) => ({ w: L.ps.at(-1).x + L.ps.at(-1).w - L.ps[0].x, adv: L.ps.reduce((n, q, i) => n + (q.cap ? q.w + (i ? q.x - (L.ps[i - 1].x + L.ps[i - 1].w) : 0) : 0), 0), words: L.ps.filter((q) => !q.cap).map((q) => q.t || q.sep) }));
      let moved = true;
      if (!T) {
        const la = lineOf(fa), lb = lineOf(fb), dW = Math.max(...lb.map((q) => q.w)) - Math.max(...la.map((q) => q.w)), left = Math.abs(fb.x - fa.x) < 1e-9, centred = Math.abs(fb.x - fa.x + dW / 2) < 1e-9;
        moved = la.length === lb.length && la.every((q, i) => Math.abs(lb[i].w - q.w - (lb[i].adv - q.adv)) < 1e-6 && J(q.words) === J(lb[i].words)) && Math.abs(fb.w - fa.w - dW) < 1e-6 && (left || centred);
      }
      const touchWords = !T || (words(wa) === sp.COPY.tapRow && words(wb) === "ROW · CHANGE · BACK"); // touch: the tap model's words become the controller's keys, both feet present
      check(`a flip changes words only: ${nm}${T ? " touch" : ""} keeps every rect but its foot's keycaps; the foot's plaque moves by the keycaps' advance alone, its words in order`, J(flat(a).filter(out(fa))) === J(flat(b).filter(out(fb))) && flat(a).filter(out(fa)).length > 0 && !!fa && !!fb && moved && touchWords && (T || words(wa) === words(wb)), J([words(wa), words(wb)]));
      continue;
    }
    if (nm === "LEVEL" && !T) { // v202 Task 3.3: the keyboard foot, MENU's rule: every rect but the caps the same, the plaque moved by the caps' advance alone, its words in order
      const na = norm(a, qa), nb = norm(b, qb), d = qb.adv - qa.adv, moved = !!qa.F && !!qb.F && Math.abs(qb.F.w - qa.F.w - d) < 1e-9 && Math.abs(qb.F.x - qa.F.x + d / 2) < 1e-9;
      check(`a flip changes words only: LEVEL keeps every rect but its keycaps; the foot's plaque moves by the caps' advance alone (${d.toFixed(1)}), its words in order`,
        J(na) === J(nb) && na.length > 0 && moved && J(qa.words) === J(qb.words) && na.some((x) => x[0] === "plaque"), J({ n: [na.length, nb.length], d, words: [qa.words, qb.words] }));
      continue;
    }
    if (nm === "LEVEL") { // touch (600x520: compact, no foot): tap mode focuses START, a controller the LEVEL row, and a controller gets its cue line; every other rect stays
      const G = md.levelGeom(L, true, T).d, out = (x, r) => !(r && x[1] >= r.x - 10 && x[2] >= r.y - 10 && x[1] + x[3] <= r.x + r.w + 10 && x[2] + x[4] <= r.y + r.h + 10);
      const keep = (x) => out(x, G.start) && out(x, G.rows.LEVEL);
      check("a flip changes the focus only: LEVEL touch keeps every rect but the focus (tap mode START, a controller the LEVEL row)", J(flat(a).filter(keep)) === J(flat(b).filter(keep)) && flat(a).filter(keep).length > 20 && !qa.F && !qb.F, J(flat(a)).length + " vs " + J(flat(b)).length);
      continue;
    }
    if (GPAGE[nm]) { // v202 Task 3.5: a GUIDE page's caps and key pairs are keys sized by their legend; its geometry (plate, every slot, its hits, the foot's row) never moves
      /* a touch layout adds the controller's cue line under the head when a pad is in use (fix round 1, Important 4): the plate's x and width, the
         BACK key and every slot's x, width and height hold; the slots may only move down by that band (or onto the next page) */
      const cueOn = T && md.guideGeom(L, T, GPAGE[nm]).mode !== "desk"; // the phone and compact arrangements have no foot: the cue line is theirs
      const geo = () => { const G = md.guideGeom(L, T, GPAGE[nm]), k = (r) => (cueOn && r ? [r.x, r.w, r.h] : r); return J([cueOn ? [G.plate.x, G.plate.w] : G.plate, Object.values(G.items).map(k), cueOn ? 0 : G.hit, k(G.back), G.foot && G.foot.y, G.mode]); };
      setHints(null); const ga = geo(), ca = md.guideGeom(L, T, GPAGE[nm]).d.head.cue; setHints(PAD); const gb = geo(), cb = md.guideGeom(L, T, GPAGE[nm]).d.head.cue; setHints(null);
      check(`a flip changes words only: ${nm}${T ? " touch" : ""} keeps its geometry (plate, slots, hits${cueOn ? "; plus the controller cue band only: every x and width holds, every slot's height" : ""})`, ga === gb && !ca && !!cb === cueOn, ga.length + " vs " + gb.length);
      continue;
    }
    if (/^(SCORES|MEDALS)/.test(nm) && RP._dbg.last.G.mode === "desk") { // v202 Task 4.1: the kit foot under the plate is words and keycaps; everything above it keeps every rect
      const fy = RP.recordsGeom({ W: L.W, H: L.H, touch: false, shell: false, css: 1 }).d.foot.y - 2, up = (r) => flat(r).filter((x) => x[2] + x[4] <= fy);
      check(`a flip changes words only: ${nm} keeps every rect above its foot`, J(up(a)) === J(up(b)) && up(a).length > 20, up(a).length + " vs " + up(b).length);
      continue;
    }
    check(`a flip changes words only: ${nm}${T ? " touch" : ""} keeps every rect`, J(flat(a)) === J(flat(b)), J(flat(a)).length + " vs " + J(flat(b)).length);
  }
}

/* ---- the STATS tap map follows the painted foot ---- */
{
  const zones = (arm) => { const seen = []; for (let x = 60; x < 540; x++) { const k = md.statsHit(x, md.statsGeom(L).S.footY, L, arm); if (k && !seen.includes(k)) seen.push(k); } return seen; };
  check("keys: STATS taps stay T / C / R", J(zones(false)) === J(["KeyT", "KeyC", "KeyR"]), J(zones(false)));
  check("keys: armed taps stay R / C", J(zones(true)) === J(["KeyR", "KeyC"]), J(zones(true)));
  setHints(PAD);
  const z = zones(false), s = "↑ TABS · NORTH MEDALS · WEST COPY MY STATS · EAST BACK", x0 = 300 - s.length * 3; // the body's foot, led by ↑ TABS
  const y = md.statsGeom(L).S.footY;
  check("pad words: the taps are MEDALS and COPY, no route to the wipe", J(z) === J(["KeyT", "KeyC"]), J(z));
  check("pad words: a tap on MEDALS lands on the painted word", md.statsHit(x0 + 6 * (9 + 6), y, L, false) === "KeyT");
  check("pad words: a tap on COPY lands on the painted word", md.statsHit(x0 + 6 * (9 + 20), y, L, false) === "KeyC");
  check("pad words: a tap on EAST BACK does nothing", md.statsHit(x0 + 6 * (9 + 40), y, L, false) === null);
  check("pad words: a tap on the ↑ TABS lead does nothing", md.statsHit(x0 + 6 * 3, y, L, false) === null);
  const armed = paint((c) => md.drawStats(c, L, 9, STATS_UI, true, null));
  check("pad words: an armed foot (a key armed it) keeps its own line", armed.has("R AGAIN ERASES · OTHER KEYS CANCEL · KEEPS SETTINGS + GAME SPEED · C COPY"));
  setHints(null);
}

/* ---- shellview hands the words to CONTROLS ---- */
{
  const a = createMenuApp({ settings: {} });
  a.screen = SCREEN.CONTROLS;
  a.controls = { view: () => ({ tab: "key", device: "key", row: 1, pad: { state: "none", name: "" }, key: DEF_CONTROLS.key, binds: DEF_CONTROLS.pad, stick: "L", dead: 25, vib: 0, stickVal: [0, 0], armed: false, swap: null, status: "", capture: null, echo: null }) };
  const shot = () => paint((c) => drawShell(c, a, { state: "PLAY", time: 0 }, null, "2d", () => [], () => 0));
  check("CONTROLS foot reads the default words", shot().has("↑↓ ROW · ←→ TAB · ENTER REBIND · ESC BACK"), shot().strs().join("|"));
  setHints({ ...hints(), ok: "RETURN", back: "BKSP" });
  const r = shot();
  setHints(null);
  check("shellview passes the hint words to the CONTROLS page", r.has("↑↓ ROW · ←→ TAB · RETURN REBIND · BKSP BACK"), r.strs().join("|"));
}

/* ---- T12: every prompt composes from live binds ---- */
{
  const padW = wordsOf("pad", DEF_CONTROLS), keyW = wordsOf("key", DEF_CONTROLS), P = (t) => POWER.find((p) => p.t === t);
  const Z = bindKey(DEF_CONTROLS, "BOMB", "KeyZ").c, swapped = bindBtn(DEF_CONTROLS, "THROW", "N").c;
  check("POWER default: THROW opens with E, REMOTE with Q", P("throw").help === "E tosses a bomb" && P("remote").help === "Q detonates your bombs");
  check("helpOf: no words is the table", helpOf(P("throw")) === "E tosses a bomb");
  check("helpOf: default keys read the table", helpOf(P("throw"), keyW) === "E tosses a bomb" && helpOf(P("remote"), keyW) === "Q detonates your bombs");
  check("helpOf: a rebound key is named", helpOf(P("throw"), wordsOf("key", bindKey(DEF_CONTROLS, "THROW", "KeyZ").c)) === "Z tosses a bomb");
  check("helpOf: pad words, live bind", helpOf(P("throw"), padW) === "WEST tosses a bomb" && helpOf(P("throw"), wordsOf("pad", swapped)) === "NORTH tosses a bomb");
  check("helpOf: tap names the touch button", helpOf(P("throw"), keyW, true) === "the THROW button tosses a bomb");
  check("helpOf: only THROW and REMOTE swap", POWER.filter((p) => !/^(throw|remote)$/.test(p.t)).every((p) => helpOf(p, padW) === p.help && helpOf(p, keyW, true) === p.help));
  check("coachTip: keyboard default, REMOTE unchanged", coachTip("throw", "d") === "THROW · E tosses a bomb" && coachTip("remote", "d") === "REMOTE · Q detonates your bombs");
  check("coachTip: pad variant", coachTip("throw", "d", null, padW) === "THROW · WEST tosses a bomb");
  check("coachTip: a pad on a touch layout names the pad", coachTip("throw", "p", null, padW) === "THROW · WEST tosses a bomb");
  check("coachTip: touch swap still works", coachTip("throw", "p") === "THROW · the THROW button tosses a bomb" && coachTip("remote", "l", null, wordsOf("touch", DEF_CONTROLS)) === "REMOTE · the REMOTE button detonates your bombs");
  check("coachTip: a touch device on a desktop layout has no button to name", coachTip("throw", "d", null, wordsOf("touch", DEF_CONTROLS)) === "THROW · E tosses a bomb");

  check("overlayCue keyboard default: PAUSE reads ENTER CONFIRM", overlayCue({ state: "PAUSE" }) === "ESC · P RESUME · ↑↓ MOVE · ENTER CONFIRM · M QUIT", overlayCue({ state: "PAUSE" }));
  check("overlayCue keyboard default: WIN / LOSE bytes", overlayCue({ state: "WIN", level: 1 }) === "SPACE / ENTER / TAP · next level" && overlayCue({ state: "WIN", level: 5 }) === "SPACE / ENTER / TAP · menu" && overlayCue({ state: "LOSE" }) === "SPACE / ENTER / TAP · new run");
  check("overlayCue touch default", overlayCue({ state: "PAUSE" }, true) === "TAP A ROW · PAUSE PILL RESUMES");
  check("overlayCue pad PAUSE", overlayCue({ state: "PAUSE" }, false, padW) === "START · EAST RESUME · ↑↓ MOVE · SOUTH CONFIRM", overlayCue({ state: "PAUSE" }, false, padW));
  check("overlayCue pad wins on a touch layout", overlayCue({ state: "PAUSE" }, true, padW) === "START · EAST RESUME · ↑↓ MOVE · SOUTH CONFIRM");
  check("overlayCue pad run end, BOMB rebound or not", overlayCue({ state: "WIN", level: 1 }, false, padW) === "SOUTH · next level" && overlayCue({ state: "LOSE" }, false, wordsOf("pad", bindBtn(DEF_CONTROLS, "BOMB", "E").c)) === "SOUTH · new run");
  check("overlayCue follows rebound PAUSE and BOMB keys", overlayCue({ state: "PAUSE" }, false, wordsOf("key", bindKey(DEF_CONTROLS, "PAUSE", "KeyO").c)) === "ESC · O RESUME · ↑↓ MOVE · ENTER CONFIRM · M QUIT" && overlayCue({ state: "LOSE" }, false, wordsOf("key", Z)) === "Z / ENTER / TAP · new run");
  setHints(padW);
  check("overlayCue reads the live hints with no words argument", overlayCue({ state: "PAUSE" }) === "START · EAST RESUME · ↑↓ MOVE · SOUTH CONFIRM");
  setHints(null);

  const over = (w, ui) => { const r = rec(); drawOverlay(r.c, { level: 1, heat: 0, pace: 0, score: 0, players: [{}], ...w }, 600, 520, 300, 260, ui); return r; };
  check("PAUSE kicker: the level line with no note", over({ state: "PAUSE" }, { view: 0, cursor: 0, touch: false }).strs().some((s) => s.startsWith("LEVEL 1 · ")));
  for (const n of ["CONTROLLER LOST", "CONTROLLER BACK"]) {
    const r = over({ state: "PAUSE" }, { view: 0, cursor: 0, touch: false, note: n });
    check(n + " replaces the level kicker", r.has(n) && !r.strs().some((s) => s.startsWith("LEVEL 1 · ")), r.strs().join("|"));
  }
  check("an empty note keeps the level kicker", over({ state: "PAUSE" }, { view: 0, cursor: 0, touch: false, note: "" }).strs().some((s) => s.startsWith("LEVEL 1 · ")));
  check("an inline page draws no note", !over({ state: "PAUSE" }, { view: 3, cursor: 0, touch: false, note: "CONTROLLER LOST" }).has("CONTROLLER LOST"));
  const endText = () => over({ state: "LOSE" }).strs().join("|");
  check("run end keeps the copy hint on keys", /new run · C copy · B board/.test(endText()), endText());
  setHints(padW);
  check("run end on a pad names its copy buttons", /SOUTH · new run · WEST copy · NORTH board/.test(endText()), endText());
  setHints(null);

  const coach = () => { const r = rec(); drawCoach(r.c, 1); return r; };
  check("ghost coach default: W A S D + SPACE", coach().strs().join() === "W,A,S,D,SPACE", coach().strs().join());
  setHints(wordsOf("key", bindMoveSet(Z, ["KeyI", "KeyL", "KeyK", "KeyJ"]).c));
  check("ghost coach follows rebound MOVE and BOMB", coach().strs().join() === "I,J,K,L,Z", coach().strs().join());
  setHints(padW);
  check("ghost coach on a pad", coach().strs().join() === "D-PAD,SOUTH", coach().strs().join());
  setHints(wordsOf("pad", bindBtn(DEF_CONTROLS, "BOMB", "SHR").c));
  const r6 = coach();
  check("ghost coach: a long BOMB word stays inside the board", r6.has("R SHOULDER") && r6.texts.every((t) => t.x > 0 && t.x < 600), J(r6.texts));
  setHints(null);

  /* every page of POWER-UPS where the box pages it (fix round 1, ruling R1) */
  const items = (T) => { const r = rec(), L6 = md.layout(600, 520); for (let p = 0; p < md.guidePages(L6, T, "POWER-UPS"); p++) md.drawItemsHelp(r.c, L6, 1, "2d", T, { pg: p }); return r; };
  const whole = (r, s) => r.strs().join(" ").includes(s);
  check("ITEMS default: E tosses a bomb", items(false).has("E tosses a bomb"), items(false).strs().join("|"));
  setHints(wordsOf("key", bindKey(DEF_CONTROLS, "THROW", "KeyZ").c));
  check("ITEMS follows a rebound THROW key", items(false).has("Z tosses a bomb"));
  setHints(padW);
  check("ITEMS on a pad", items(false).has("WEST tosses a bomb"));
  check("ITEMS on a touch layout with a pad names the pad", whole(items(true), "WEST tosses a bomb"));
  setHints(null);
  check("ITEMS on touch names the button, whole", whole(items(true), "the THROW button tosses a bomb") && whole(items(true), "the REMOTE button detonates your bombs"), items(true).strs().join("|"));
  for (const nw of [400, 420, 559]) {
    const narrowItems = paint((c) => md.drawItemsHelp(c, md.layout(nw, 860), 1, "2d", true));
    check("ITEMS on a narrow touch box (" + nw + ") loses no word of the two tips", whole(narrowItems, "tap tosses a bomb") && whole(narrowItems, "tap detonates your bombs"), narrowItems.strs().join("|"));
  }

  /* v202 Task 3.1: MENU's notes. On a desk layout (the keyboard foot, the touch-landscape foot) a note leads the foot; on the phone column it rides
     SOURCE's teaser, whole where it fits, else its first part. The controller's signpost is the foot's one cream word; the rest is t2. */
  const NOTE = "NO SOUND YET · PRESS A KEY OR TAP", INK = "#fff2df", T2 = "#dccbb8";
  const TODAY = "MOVE ▲ ▼ · START [ENTER] | v99", SIGN = "CONTROLLER READY · SETTINGS › CONTROLS";
  const drawn = (touch, o, L2) => { const r = rec(), cols = []; const c = new Proxy(r.c, { get: (t, p) => (p === "fillText" ? (s, x, y) => { cols.push({ s: String(s), col: t.fillStyle, x }); t.fillText(s, x, y); } : t[p]), set: (t, p, v) => { t[p] = v; return true; } }); menu(0, touch, "v99", o, L2)(c); return { r, cols, col: (s) => (cols.find((x) => x.s === s) || {}).col, foot: footOf(), last: pg._dbg.last }; };
  const PH = [["narrow tall box", 420, 860, 113], ["wide tall box", 600, 900, 162]];
  const tease = (k) => k.last.P.rows.SOURCE.tz && k.last.P.rows.SOURCE.tz.lines.join(" ");
  check("MENU foot: no note, today's foot", drawn(false, {}).foot === TODAY && !drawn(false, {}).r.strs().some((s) => /NO SOUND/.test(s)));
  check("MENU foot: the note leads the foot", drawn(false, { note: NOTE }).foot === NOTE + " · " + TODAY && drawn(false, { note: NOTE }).r.has(NOTE), drawn(false, { note: NOTE }).foot);
  { const k = drawn(false, { note: NOTE }), F = k.last.P.foot.START, u = k.last.G.u; check("MENU foot: the keyboard note fits the stage", F.x * u >= 0 && (F.x + F.w) * u <= 600, J([F.x * u, (F.x + F.w) * u])); }
  const LS = md.layout(1024, 600, 200, 1); // a short touch-landscape window: the floored desk keeps its foot (fix round 1)
  check("touch landscape (short box, the desk foot): the note leads TAP A ROW", drawn(true, { note: NOTE }, LS).last.G.mode === "desk" && drawn(true, { note: NOTE }, LS).foot === NOTE + " · TAP A ROW | v99", drawn(true, { note: NOTE }, LS).foot);
  {
    const LC = md.layout(600, 520), k = drawn(true, { note: NOTE }, LC);
    check("compact (a landscape phone's #c): no foot; SOURCE's tile carries the note, whole or its first part, in cream; without one, the build tag", k.last.G.mode === "compact" && k.foot === "" && /^NO SOUND YET( · PRESS A KEY OR TAP)?$/.test(tease(k)) && k.r.has(tease(k)) && k.last.P.rows.SOURCE.tz.col === INK && tease(drawn(true, {}, LC)) === "v99", tease(k));
  }
  for (const [n, W, H, lg] of PH) {
    const LT = md.layout(W, H, lg), k = drawn(true, { note: NOTE }, LT);
    check("phone (" + n + "): SOURCE's teaser carries the note, whole or its first part", k.last.G.mode === "phone" && /^NO SOUND YET( · PRESS A KEY OR TAP)?$/.test(tease(k)) && k.r.has(tease(k)), tease(k));
    check("phone without a note (" + n + "): no note, the build tag", tease(drawn(true, {}, LT)) === "v99" && !drawn(true, {}, LT).r.strs().some((s) => /NO SOUND/.test(s)));
  }
  const shot = (note) => { const r = rec(); const app = createMenuApp({ settings: {} }); app.screen = SCREEN.MENU; app.subT = 9; app.soundNote = note; drawShell(r.c, app, {}, null, "2d", () => [], () => 0); return { r, foot: footOf() }; };
  check("shellview hands app.soundNote to the MENU foot", shot(NOTE).foot.startsWith(NOTE + " · MOVE") && shot(NOTE).r.has(NOTE), shot(NOTE).foot);
  check("no note on app: no note drawn", !shot("").r.strs().some((s) => /NO SOUND/.test(s)));
  /* A controller arrives: the MENU signposts CONTROLS, in cream, for the note's lifetime. */
  for (const pad of ["CONTROLLER READY", "CONTROLLER BACK"]) {
    const k = drawn(false, { pad });
    check("MENU foot: " + pad + " reads the signpost, in cream, the build tag after it", k.foot === SIGN + " | v99" && k.col(SIGN) === INK, k.foot + " " + J(k.cols.slice(-3)));
    check("MENU foot: " + pad + " replaces the hint", k.foot.indexOf("MOVE") < 0);
  }
  for (const pad of ["", "CONTROLLER LOST", undefined]) {
    const k = drawn(false, { pad });
    check("MENU foot: padNote " + J(pad) + " keeps today's foot, its words t2", k.foot === TODAY && k.col("MOVE") === T2 && !k.r.strs().includes(SIGN));
  }
  { const k = drawn(false, { pad: "CONTROLLER READY" }), F = k.last.P.foot[""], u = k.last.G.u; check("MENU foot: the signpost fits the stage", F.x * u >= 0 && (F.x + F.w) * u <= 600); }
  check("MENU foot: the sound note wins over the signpost", drawn(false, { pad: "CONTROLLER READY", note: NOTE }).foot === NOTE + " · " + TODAY, drawn(false, { pad: "CONTROLLER READY", note: NOTE }).foot);
  {
    const k = drawn(true, { pad: "CONTROLLER READY" }, LS);
    check("touch landscape (short box): the signpost, whole, in cream", k.foot === SIGN + " | v99" && k.col(SIGN) === INK, k.foot);
    check("touch landscape: the sound note wins", drawn(true, { pad: "CONTROLLER READY", note: NOTE }, LS).foot === NOTE + " · TAP A ROW | v99");
    check("touch landscape: LOST paints no signpost", !drawn(true, { pad: "CONTROLLER LOST" }, LS).r.strs().includes(SIGN));
  }
  for (const [n, W, H, lg] of PH) {
    const LT = md.layout(W, H, lg), k = drawn(true, { pad: "CONTROLLER READY" }, LT), o = k.last.P.rows.SOURCE;
    check("phone (" + n + "): SOURCE's teaser carries the signpost in cream, whole where it fits, else CONTROLLER READY; never over the label", /^CONTROLLER READY( · SETTINGS › CONTROLS)?$/.test(tease(k)) && o.tz.col === INK && o.tz.x - o.tz.w >= o.foc.x + o.label.w + 12, tease(k));
    check("phone (" + n + "): the sound note wins", /^NO SOUND YET/.test(tease(drawn(true, { pad: "CONTROLLER READY", note: NOTE }, LT))));
    check("phone (" + n + "): LOST paints no signpost", tease(drawn(true, { pad: "CONTROLLER LOST" }, LT)) === "v99");
  }
  {
    const LONG = "CONTROLLER READY · VIBRATION MEDIUM · SETTINGS › CONTROLS", VN = "CONTROLLER READY · VIBRATION MEDIUM";
    check("MENU foot: the level joins the signpost where it fits", drawn(false, { pad: VN }).foot === LONG + " | v99", drawn(false, { pad: VN }).foot);
    { const k = drawn(false, { pad: VN }), F = k.last.P.foot[""], u = k.last.G.u; check("the long signpost fits the stage it is drawn on", F.x * u >= 0 && (F.x + F.w) * u <= 600); }
    check("MENU foot: no level, today's signpost", drawn(false, { pad: "CONTROLLER READY" }).foot === SIGN + " | v99" && drawn(false, { pad: "CONTROLLER BACK" }).foot === SIGN + " | v99");
    for (const [n, W, H, lg] of PH) { const t = tease(drawn(true, { pad: VN }, md.layout(W, H, lg))); check("phone (" + n + "): the long signpost steps down whole (" + t + ")", [LONG, SIGN, "CONTROLLER READY"].includes(t), t); }
  }
  const padShot = (n) => { const r = rec(); const app = createMenuApp({ settings: {} }); app.screen = SCREEN.MENU; app.subT = 9; app.padNote = n; drawShell(r.c, app, {}, null, "2d", () => [], () => 0); return { r, foot: footOf() }; };
  const SIGN0 = /^CONTROLLER READY · SETTINGS › CONTROLS \| v\d+$/;
  check("shellview hands app.padNote to the MENU foot, the live build tag kept", SIGN0.test(padShot("CONTROLLER READY").foot), padShot("CONTROLLER READY").foot);
  check("no padNote on app: no signpost", !padShot("").r.strs().some((s) => s.startsWith("CONTROLLER READY")));
  { const r = rec(); md.drawMenu(r.c, { rows: ITEMS, focus: "PLAY", rev: "", level: 1, pad: "CONTROLLER READY", enterT: 9 }, L, 9); check("no tag to keep: the signpost alone, no dangling bar", footOf() === SIGN && r.has(SIGN)); }
  check("the note gone, the normal foot is back with its tag", drawn(false, { pad: "" }).foot === TODAY);
  setHints(PAD);
  { const g = GFOOT(PAGES.HOWTO(false)), F = gpg._dbg.last.P.foot, G = gpg._dbg.last.G; check("HOW TO on a pad: the foot names CONTROLS, whole, and fits its box", g.r.has("REBIND IN SETTINGS › CONTROLS") && F.x * G.u >= 0 && (F.x + F.w) * G.u <= 600, g.foot); }
  setHints(null);
  check("HOW TO on keys: the foot reads BACK [ESC] [ENTER] and never REBIND", GFOOT(PAGES.HOWTO(false)).foot === "BACK [ESC] [ENTER]" && !paint(PAGES.HOWTO(false)).strs().some((s) => s.includes("REBIND")));
  const src = (p) => readFileSync(new URL("../src/" + p, import.meta.url), "utf8");
  check("core/entities.js still has no src/app import", !/from\s+"[^"]*app\//.test(src("core/entities.js")));
  check("coach.js keeps no second key rule", !/KEY_HINT\s*=/.test(src("app/coach.js")));
}

/* ---- seams ---- */
{
  const src = (p) => readFileSync(new URL("../src/" + p, import.meta.url), "utf8");
  const imports = (s) => [...s.matchAll(/^\s*import\b[^;]*?from\s+"([^"]+)"/gm)].map((m) => m[1]);
  check("menudraw still imports nothing from src/app", !imports(src("render/menudraw.js")).some((p) => /\/app\//.test(p)));
  check("hintcopy imports nothing", imports(src("render/hintcopy.js")).length === 0);
  const fresh = !/\bperformance\.now\b|\bDate\b/.test(src("app/hints.js"));
  check("hints.js reads no clock of its own", fresh);
}

// ---- T14: the live coach call now hands hints(): touch copy must not move ----
{
  const touchW = wordsOf("touch", DEF_CONTROLS), keyW = wordsOf("key", DEF_CONTROLS);
  for (const k of ["kick", "throw", "remote", "pass", "line", "power", "pierce", "shield"]) for (const lay of ["p", "l"]) {
    check("coach on touch unchanged by the words: " + k + " " + lay, coachTip(k, lay, null, touchW) === coachTip(k, lay), coachTip(k, lay, null, touchW));
  }
  for (const k of ["throw", "remote"]) check("coach on keys unchanged by default words: " + k, coachTip(k, "d", null, keyW) === coachTip(k, "d"));
  check("coach on touch still names the button", /^THROW · the THROW button/.test(coachTip("throw", "p", null, touchW)), coachTip("throw", "p", null, touchW));
}
// ---- T14: LEVEL MODIFIERS on a controller (v202 Task 3.3): the help line says how, a TRIGGER cursor (list shut) is named on the door and in the help ----
{
  const lvl = (W, H, T, cur, mask = 0, time = false, U = true, lg, css) => { const LL = md.layout(W, H, lg, css); md.setModeFocus(() => cur); const r = paint((c) => md.drawLevelSelect(c, 1, LL, 9, 0, mask, U, 0, time, T, INFO)); md.setModeFocus(null); return { r, d: lvp._dbg.last }; };
  const help = (x) => (x.d.P.help ? x.d.P.help.lines.join(" ") : ""), door = (x) => (x.d.P.rows.MODIFIERS && x.d.P.rows.MODIFIERS.tz ? x.d.P.rows.MODIFIERS.tz.lines.join(" ") : "");
  const k = lvl(600, 520, false, 2);
  check("keys: no TRIGGERS words, the door names what is on (NONE)", !help(k).includes("TRIGGERS") && door(k) === "NONE", help(k) + " / " + door(k));
  setHints(wordsOf("pad", DEF_CONTROLS));
  const a = lvl(600, 520, false, -1);
  check("pad, no cursor: the help line says how", help(a) === "TRIGGERS pick a modifier, NORTH toggles it." && door(a) === "NONE", help(a));
  const b = lvl(600, 520, false, 3);
  check("pad, cursor on SHRINK: the door names it and its state, the help line says what it does", door(b) === "SHRINK · OFF" && help(b) === "Walls close in from 25s.", door(b) + " / " + help(b));
  check("pad, cursor on the fifth entry: TIME TRIAL", door(lvl(600, 520, false, 4, 0, true)) === "TIME TRIAL · ON");
  for (const [W, H, T, lg, css, tag] of [[1366, 768, false, 200, 1, "desk"], [608, 352, false, undefined, 1, "iso guard"], [393, 852, true, 300, 0.9, "phone"]])
    for (let i = 0; i < 5; i++) {
      const x = lvl(W, H, T, i, 0, false, true, lg, css), words = door(x);
      check("pad door fits, whole (on one line, or two on the phone's door): " + tag + " entry " + i, words === ["ONE LIFE", "NO FLOOR ITEMS", "FEWER ITEMS", "SHRINK", "TIME TRIAL"][i] + " · OFF" && !/…/.test(words), words);
    }
  check("no MODIFIERS row before the first CLEAR: no door, no TRIGGERS help", !lvl(600, 520, false, 2, 0, false, false).r.has("TRIGGERS pick a modifier, NORTH toggles it."));
  setHints(null);
  check("setModeFocus(null) restores no cursor", md.modeFocusOf() === -1);
}

console.log("\n  HINTS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
