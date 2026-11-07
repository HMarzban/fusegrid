// T10: the hint device, the hint words, and the menu copy that reads them.
import { readFileSync } from "node:fs";
import { DEF_CONTROLS, bindBtn, bindKey, bindMoveSet, resetDevice } from "../src/app/controls.js";
import { createHintDev, keyPress, pointerPress, wordsOf } from "../src/app/hints.js";
import { hints, setHints, tapMode } from "../src/render/hintcopy.js";
import * as md from "../src/render/menudraw.js";
import { drawShell } from "../src/render/shellview.js";
import { SCREEN, createMenuApp } from "../src/app/menuapp.js";
import { helpOf } from "../src/app/hints.js";
import { POWER } from "../src/core/entities.js";
import { coachTip } from "../src/app/coach.js";
import { drawCoach, drawOverlay, overlayCue } from "../src/render/scenes.js";

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
const L = md.layout(600, 520);
const INFO = { level: 1, best: [], unlocked: true, daily: null, top: [] };
const ITEMS = ["PLAY|JUNGLE · CORE · NORM", "LEVEL SELECT", "DAILY|TODAY", "OPTIONS", "GUIDE", "HIGH SCORES", "STATS", "SOURCE"];
const menu = (cur, touch, rev = "") => (c) => md.drawMenu(c, { cursor: cur, enterT: 9, items: ITEMS, touch: !!touch, kind: "2d", rev, info: INFO }, L, 9);
const STATS_UI = { rows: [], notes: [], trophies: [] };
const GFX = { rows: [] };
/* Every page with a foot, keyboard or touch geometry. */
const PAGES = {
  LEVEL: (T) => (c) => md.drawLevelSelect(c, 1, L, 9, 0, 0, true, 0, false, T, INFO),
  HOWTO: (T) => (c) => md.drawHowTo(c, L, 9, "2d", T),
  ITEMS: (T) => (c) => md.drawItemsHelp(c, L, 9, "2d", T),
  ENEMIES: (T) => (c) => md.drawEnemiesHelp(c, L, 9, "2d", T),
  FLOOR: (T) => (c) => md.drawFloorHelp(c, L, 9, "2d", T),
  GUIDE: (T) => (c) => md.drawGuide(c, L, 9, 0, "2d", T),
  SCORES: (T) => (c) => md.drawScores(c, [], L, 9, 0, 0, T),
  OPTIONS: (T) => (c) => md.drawSettings(c, L, 9, { row: 0, vals: {}, touch: T }),
  GRAPHICS: (T) => (c) => md.drawGraphics(c, L, 9, { row: 0, view: GFX, touch: T }),
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
    ["LEVEL foot", PAGES.LEVEL(false), "ENTER START · ESC BACK"],
    ["HOW TO foot", PAGES.HOWTO(false), "ESC / ENTER BACK"],
    ["ITEMS foot", PAGES.ITEMS(false), "WALK OVER A CUBE TO COLLECT · ESC BACK"],
    ["ENEMIES foot", PAGES.ENEMIES(false), "ESC BACK"],
    ["FLOOR foot", PAGES.FLOOR(false), "ESC BACK"],
    ["GUIDE foot", PAGES.GUIDE(false), "← → / ↑↓ PICK · ENTER OPEN · ESC BACK"],
    ["SCORES foot", PAGES.SCORES(false), "← → HEAT · ESC BACK"],
    ["OPTIONS foot", PAGES.OPTIONS(false), "↑↓ ROW · ←→ ADJUST · ENTER CYCLE · ESC BACK"],
    ["GRAPHICS foot", PAGES.GRAPHICS(false), "↑↓ ROW · ←→ ADJUST · ENTER CYCLE · ESC BACK"],
    ["STATS foot", (c) => md.drawStats(c, L, 9, STATS_UI, false, null), "T MEDALS · C COPY MY STATS · R RESET · ESC BACK"],
    ["STATS armed foot", (c) => md.drawStats(c, L, 9, STATS_UI, true, null), "R AGAIN ERASES · ANY OTHER KEY CANCELS · KEEPS OPTIONS + PACE · C COPY"],
    ["MEDALS foot", (c) => md.drawTrophies(c, L, 9, []), "ENTER / ESC BACK TO STATS"],
    ["PLAY pane", menu(0), "ENTER STARTS IT · LEVEL SELECT CHANGES IT"],
    ["OPTIONS pane", menu(3), "ENTER OPENS ALL TWELVE ROWS"],
    ["SCORES pane", menu(5), "ENTER: ALL TEN · CORE / PLUS / MAX"],
    ["SOURCE pane", menu(7), "ENTER OPENS IT IN A NEW TAB"],
    ["ATTRACT", (c) => md.drawAttractHint(c, L, 200), "DEMO — TAP TO PLAY"],
    ["show skip", (c) => md.drawIntroChrome(c, 1, 0.6, 600, 520, "d"), "ANY KEY TO SKIP"],
    ["show skip, touch", (c) => md.drawIntroChrome(c, 1, 0.6, 600, 520, "p"), "TAP TO SKIP"],
    ["title, touch", (c) => md.drawIntroChrome(c, 0, 1, 600, 520, "p"), "TAP TO START"],
    ["LEVEL room cap", PAGES.LEVEL(false), "ROOM  ← →"],
    ["LEVEL pace cap", PAGES.LEVEL(false), "[ ]"],
    ["LEVEL modes cap", PAGES.LEVEL(false), "1–5"],
    ["LEVEL modes chip keeps its digit", PAGES.LEVEL(false), "1 IRON"],
    ["GUIDE sub", PAGES.GUIDE(false), "2 RULES · 6 KEYS"],
    ["GUIDE sub, touch", PAGES.GUIDE(true), "2 RULES · 6 CONTROLS"],
    ["LEVEL foot, touch", PAGES.LEVEL(true), md.LEVEL_TAP],
    ["OPTIONS foot, touch", PAGES.OPTIONS(true), md.FOOT_TAP],
    ["HOW TO foot, touch", PAGES.HOWTO(true), "TAP OUTSIDE TO GO BACK"],
    ["GUIDE foot, touch", PAGES.GUIDE(true), "TAP A DOOR · TAP OUTSIDE TO GO BACK"],
  ];
  for (const [nm, f, s] of WANT) { const r = paint(f); check("default: " + nm + " stays \"" + s + "\"", r.has(s), r.strs().join("|")); }
  check("FOOT_KEYS keeps its default bytes", md.FOOT_KEYS === "↑↓ ROW · ←→ ADJUST · ENTER CYCLE · ESC BACK");
  const how = paint(PAGES.HOWTO(false));
  for (const s of ["WASD / ARROWS", "SPACE", "E", "Q", "WALK INTO BOMB", "P"]) check("HOW TO row reads " + s, how.has(s));
  check("HOW TO never advertises the old THROW chord", !how.has("SHIFT + SPACE"));
}

/* ---- the named word changes ---- */
{
  const r = paint(menu(0, false, "v99"));
  check("MENU foot reads ENTER CONFIRM", r.has("↑↓ MOVE · ENTER CONFIRM · v99") && !r.strs().some((s) => /ENTER SELECT/.test(s)), r.strs().join("|"));
  check("MENU foot without a build tag", paint(menu(0)).has("↑↓ MOVE · ENTER CONFIRM"));
  for (const [W, H] of [[600, 520], [608, 352]]) {
    const t = paint((c) => md.drawIntroChrome(c, 0, 1, W, H, "d"));
    check(`title reads PRESS ANY KEY OR BUTTON on keyboard layouts ${W}x${H}`, t.has("PRESS ANY KEY OR BUTTON") && !t.has("PRESS ANY KEY"));
    check(`the title fits W-28 at ${W}x${H}`, "PRESS ANY KEY OR BUTTON".length * 18 * 0.6 <= W - 28);
  }
  setHints(PAD);
  const tp = paint((c) => md.drawIntroChrome(c, 0, 1, 600, 520, "p"));
  setHints(null);
  check("a touch title keeps its own words whatever the device", tp.has("TAP TO START"));
  const g = paint(PAGES.GUIDE(false));
  check("GUIDE preview draws the THROW key, no K", g.has("E") && g.has("Q") && g.has("P") && !g.has("K"), g.strs().join("|"));
  check("GUIDE preview keeps WASD and SPACE", g.has("WASD") && g.has("SPACE"));
  setHints(wordsOf("key", bindKey(DEF_CONTROLS, "THROW", "KeyZ").c));
  const g2 = paint(PAGES.GUIDE(false));
  setHints(null);
  check("GUIDE preview follows a rebound THROW", g2.has("Z") && !g2.has("E"));
}

/* ---- pad words, and geometry that never moves ---- */
{
  setHints(PAD);
  const PADWANT = [
    ["LEVEL foot", PAGES.LEVEL(false), "SOUTH START · EAST BACK"],
    ["HOW TO foot", PAGES.HOWTO(false), "REBIND IN OPTIONS › CONTROLS · EAST / SOUTH BACK"],
    ["ITEMS foot", PAGES.ITEMS(false), "WALK OVER A CUBE TO COLLECT · EAST BACK"],
    ["ENEMIES foot", PAGES.ENEMIES(false), "EAST BACK"],
    ["FLOOR foot", PAGES.FLOOR(false), "EAST BACK"],
    ["GUIDE foot", PAGES.GUIDE(false), "← → / ↑↓ PICK · SOUTH OPEN · EAST BACK"],
    ["SCORES foot", PAGES.SCORES(false), "← → HEAT · EAST BACK"],
    ["OPTIONS foot", PAGES.OPTIONS(false), "↑↓ ROW · ←→ ADJUST · SOUTH CYCLE · EAST BACK"],
    ["GRAPHICS foot", PAGES.GRAPHICS(false), "↑↓ ROW · ←→ ADJUST · SOUTH CYCLE · EAST BACK"],
    ["STATS foot offers no reset", (c) => md.drawStats(c, L, 9, STATS_UI, false, null), "NORTH MEDALS · WEST COPY MY STATS · EAST BACK"],
    ["MEDALS foot", (c) => md.drawTrophies(c, L, 9, []), "SOUTH / EAST BACK TO STATS"],
    ["MENU foot", menu(0, false, "v99"), "↑↓ MOVE · SOUTH CONFIRM · v99"],
    ["PLAY pane", menu(0), "SOUTH STARTS IT · LEVEL SELECT CHANGES IT"],
    ["OPTIONS pane", menu(3), "SOUTH OPENS ALL TWELVE ROWS"],
    ["SCORES pane", menu(5), "SOUTH: ALL TEN · CORE / PLUS / MAX"],
    ["SOURCE pane", menu(7), "NEEDS A CLICK OR ENTER"],
    ["ATTRACT", (c) => md.drawAttractHint(c, L, 200), "DEMO — PRESS ANY BUTTON"],
    ["show skip", (c) => md.drawIntroChrome(c, 1, 0.6, 600, 520, "d"), "ANY BUTTON TO SKIP"],
    ["LEVEL pace cap", PAGES.LEVEL(false), "SHOULDERS"],
    ["GUIDE sub, whole beside the key strip", PAGES.GUIDE(false), "6 CONTROLS"],
    ["GUIDE sub, touch door", PAGES.GUIDE(true), "2 RULES · 6 CONTROLS"],
    ["HOW TO move", PAGES.HOWTO(false), "D-PAD / L-STICK"],
    ["HOW TO throw", PAGES.HOWTO(false), "WEST"],
    ["HOW TO pause", PAGES.HOWTO(false), "START"],
    ["pad words on a touch layout: LEVEL", PAGES.LEVEL(true), "SOUTH START · EAST BACK"],
    ["pad words on a touch layout: OPTIONS", PAGES.OPTIONS(true), "↑↓ ROW · ←→ ADJUST · SOUTH CYCLE · EAST BACK"],
    ["pad words on a touch layout: HOW TO", PAGES.HOWTO(true), "REBIND IN OPTIONS › CONTROLS · EAST / SOUTH BACK"],
    ["pad words on a touch layout: show skip", (c) => md.drawIntroChrome(c, 1, 0.6, 600, 520, "p"), "ANY BUTTON TO SKIP"],
  ];
  for (const [nm, f, s] of PADWANT) { const r = paint(f); check("pad: " + nm + " = \"" + s + "\"", r.has(s), r.strs().join("|")); }
  const lv = paint(PAGES.LEVEL(false));
  check("pad: LEVEL has no [ ] or 1–5 cap and no key digits on MODES", !lv.has("[ ]") && !lv.has("1–5") && lv.has("IRON") && !lv.has("1 IRON"), lv.strs().join("|"));
  const gd = paint(PAGES.GUIDE(false));
  check("pad: GUIDE preview names pad buttons, no key caps", gd.has("D-PAD") && gd.has("SOUTH") && gd.has("WEST") && gd.has("EAST") && !gd.has("WASD") && !gd.has("SPACE"), gd.strs().join("|"));
  const noLetter = /(^|[ ·/])(A|B|X|Y) (CONFIRM|BACK|OPEN|START|CYCLE|STARTS|OPENS|MEDALS|COPY)|(^|[ ·/])(LB|RB|LT|RT)( |$)/;
  const every = [...Object.values(PAGES).map((p) => p(false)), menu(0), menu(3), menu(5), menu(7)].flatMap((f) => paint(f).strs());
  check("no face-button letter on a pad hint", !every.some((s) => noLetter.test(s)), every.filter((s) => noLetter.test(s)).join("|"));

  check("pad: SHOULDERS fits its 44 px cap at the cap's 8 px face", "SHOULDERS".length * 8 * 0.6 <= 44);
  const capT = lv.texts.find((x) => x.s === "SHOULDERS");
  check("pad: the SHOULDERS cap is drawn at 8 px", !!capT && /\b8px/.test(capT.font), capT && capT.font);

  const G = md.guideGeom ? md.guideGeom(L, false) : null;
  const caps = paint(PAGES.GUIDE(false));
  const right = Math.max(...caps.rects.filter((r) => r[0] === "rgba(4,7,14,0.9)").map((r) => r[1] + r[3]));
  const door = G && G.tiles ? G.tiles[0] : null;
  check("pad: GUIDE caps stop before the door's chevron", !door || right <= door.x + door.w - 22, J({ right, door }));

  setHints(wordsOf("key", bindMoveSet(bindKey(bindKey(DEF_CONTROLS, "THROW", "PageDown").c, "BOMB", "Insert").c, ["PageUp", "End", "Home", "Delete"]).c));
  const wide = paint(PAGES.GUIDE(false));
  const wr = Math.max(...wide.rects.filter((r) => r[0] === "rgba(4,7,14,0.9)").map((r) => r[1] + r[3]));
  check("long key names never run a GUIDE cap past the chevron", !door || wr <= door.x + door.w - 22, J({ wr, door }));

  setHints(null);
  const flat = (r) => r.rects.filter((x) => x[0] !== "rgba(4,7,14,0.9)");
  const pages = { ...PAGES, MENU0: () => menu(0, false, "v99"), MENU3: () => menu(3, false, "v99"), STATS: () => (c) => md.drawStats(c, L, 9, STATS_UI, false, null), MEDALS: () => (c) => md.drawTrophies(c, L, 9, []) };
  for (const T of [false, true]) for (const [nm, p] of Object.entries(pages)) {
    setHints(null); const a = paint(p(T));
    setHints(PAD); const b = paint(p(T));
    setHints(null);
    check(`a flip changes words only: ${nm}${T ? " touch" : ""} keeps every rect`, J(flat(a)) === J(flat(b)), J(flat(a)).length + " vs " + J(flat(b)).length);
  }
}

/* ---- the STATS tap map follows the painted foot ---- */
{
  const zones = (arm) => { const seen = []; for (let x = 60; x < 540; x++) { const k = md.statsHit(x, md.statsGeom(L).S.footY, L, arm); if (k && !seen.includes(k)) seen.push(k); } return seen; };
  check("keys: STATS taps stay T / C / R", J(zones(false)) === J(["KeyT", "KeyC", "KeyR"]), J(zones(false)));
  check("keys: armed taps stay R / C", J(zones(true)) === J(["KeyR", "KeyC"]), J(zones(true)));
  setHints(PAD);
  const z = zones(false), s = "NORTH MEDALS · WEST COPY MY STATS · EAST BACK", x0 = 300 - s.length * 3;
  const y = md.statsGeom(L).S.footY;
  check("pad words: the taps are MEDALS and COPY, no route to the wipe", J(z) === J(["KeyT", "KeyC"]), J(z));
  check("pad words: a tap on MEDALS lands on the painted word", md.statsHit(x0 + 6 * 6, y, L, false) === "KeyT");
  check("pad words: a tap on COPY lands on the painted word", md.statsHit(x0 + 6 * 20, y, L, false) === "KeyC");
  check("pad words: a tap on EAST BACK does nothing", md.statsHit(x0 + 6 * 40, y, L, false) === null);
  const armed = paint((c) => md.drawStats(c, L, 9, STATS_UI, true, null));
  check("pad words: an armed foot (a key armed it) keeps its own line", armed.has("R AGAIN ERASES · ANY OTHER KEY CANCELS · KEEPS OPTIONS + PACE · C COPY"));
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
  check("overlayCue keyboard default: WIN / LOSE bytes", overlayCue({ state: "WIN", level: 1 }) === "SPACE / ENTER / TAP · next room" && overlayCue({ state: "WIN", level: 5 }) === "SPACE / ENTER / TAP · menu" && overlayCue({ state: "LOSE" }) === "SPACE / ENTER / TAP · new run");
  check("overlayCue touch default", overlayCue({ state: "PAUSE" }, true) === "TAP A ROW · PAUSE PILL RESUMES");
  check("overlayCue pad PAUSE", overlayCue({ state: "PAUSE" }, false, padW) === "START · EAST RESUME · ↑↓ MOVE · SOUTH CONFIRM", overlayCue({ state: "PAUSE" }, false, padW));
  check("overlayCue pad wins on a touch layout", overlayCue({ state: "PAUSE" }, true, padW) === "START · EAST RESUME · ↑↓ MOVE · SOUTH CONFIRM");
  check("overlayCue pad run end, BOMB rebound or not", overlayCue({ state: "WIN", level: 1 }, false, padW) === "SOUTH · next room" && overlayCue({ state: "LOSE" }, false, wordsOf("pad", bindBtn(DEF_CONTROLS, "BOMB", "E").c)) === "SOUTH · new run");
  check("overlayCue follows rebound PAUSE and BOMB keys", overlayCue({ state: "PAUSE" }, false, wordsOf("key", bindKey(DEF_CONTROLS, "PAUSE", "KeyO").c)) === "ESC · O RESUME · ↑↓ MOVE · ENTER CONFIRM · M QUIT" && overlayCue({ state: "LOSE" }, false, wordsOf("key", Z)) === "Z / ENTER / TAP · new run");
  setHints(padW);
  check("overlayCue reads the live hints with no words argument", overlayCue({ state: "PAUSE" }) === "START · EAST RESUME · ↑↓ MOVE · SOUTH CONFIRM");
  setHints(null);

  const over = (w, ui) => { const r = rec(); drawOverlay(r.c, { level: 1, heat: 0, pace: 0, score: 0, players: [{}], ...w }, 600, 520, 300, 260, ui); return r; };
  check("PAUSE kicker: the room line with no note", over({ state: "PAUSE" }, { view: 0, cursor: 0, touch: false }).strs().some((s) => s.startsWith("ROOM 1 · ")));
  for (const n of ["CONTROLLER LOST", "CONTROLLER BACK"]) {
    const r = over({ state: "PAUSE" }, { view: 0, cursor: 0, touch: false, note: n });
    check(n + " replaces the room kicker", r.has(n) && !r.strs().some((s) => s.startsWith("ROOM 1 · ")), r.strs().join("|"));
  }
  check("an empty note keeps the room kicker", over({ state: "PAUSE" }, { view: 0, cursor: 0, touch: false, note: "" }).strs().some((s) => s.startsWith("ROOM 1 · ")));
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

  const items = (T) => { const r = rec(); md.drawItemsHelp(r.c, md.layout(600, 520), 1, "2d", T); return r; };
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

  const NOTE = "NO SOUND YET · PRESS A KEY OR TAP";
  const noted = (touch, note, L2) => { const r = rec(); md.drawMenu(r.c, { cursor: 0, enterT: 9, items: ITEMS, touch, kind: "2d", rev: "v99", info: INFO, soundNote: note }, L2 || L, 9); return r; };
  check("MENU foot: no note, today's foot", noted(false, "").has("↑↓ MOVE · ENTER CONFIRM · v99") && !noted(false, "").strs().some((s) => /NO SOUND/.test(s)));
  check("MENU foot: the note joins the foot", noted(false, NOTE).has(NOTE + " · ↑↓ MOVE · ENTER CONFIRM · v99"), noted(false, NOTE).strs().join("|"));
  check("MENU foot: the keyboard note fits the stage", (NOTE + " · ↑↓ MOVE · SOUTH CONFIRM · v99").length * 6 + 24 <= 600);
  for (const [n, h] of [["short box", 520], ["tall box", 860]]) {
    const LT = md.layout(420, h, h > 600 ? 0.27 * 420 : undefined), r = noted(true, NOTE, LT);
    check("touch hub paints the note (" + n + ")", r.strs().some((s) => s.includes(NOTE)), r.strs().join("|"));
    check("touch hub without a note paints none (" + n + ")", !noted(true, "", LT).strs().some((s) => /NO SOUND/.test(s)));
  }
  const shot = (note) => { const r = rec(); const app = createMenuApp({ settings: {} }); app.screen = SCREEN.MENU; app.subT = 9; app.soundNote = note; drawShell(r.c, app, {}, null, "2d", () => [], () => 0); return r; };
  check("shellview hands app.soundNote to the MENU foot", shot(NOTE).strs().some((s) => s.startsWith(NOTE)), shot(NOTE).strs().join("|"));
  check("no note on app: no note drawn", !shot("").strs().some((s) => /NO SOUND/.test(s)));
  /* A controller arrives: the MENU signposts CONTROLS, in accent, for the note's lifetime. */
  const SIGN = "CONTROLLER READY · OPTIONS › CONTROLS · v99", ACC = "#37f0d0";
  const padded = (touch, pad, sound = "", L2) => { const r = rec(), cols = []; const c = new Proxy(r.c, { get: (t, p) => (p === "fillText" ? (s, x, y) => { cols.push({ s: String(s), col: t.fillStyle, x }); t.fillText(s, x, y); } : t[p]), set: (t, p, v) => { t[p] = v; return true; } }); md.drawMenu(c, { cursor: 0, enterT: 9, items: ITEMS, touch, kind: "2d", rev: "v99", info: INFO, soundNote: sound, padNote: pad }, L2 || L, 9); return { r, cols, col: (s) => (cols.find((x) => x.s === s) || {}).col }; };
  const TODAY = "↑↓ MOVE · ENTER CONFIRM · v99";
  for (const pad of ["CONTROLLER READY", "CONTROLLER BACK"]) {
    const k = padded(false, pad);
    check("MENU foot: " + pad + " reads the signpost, in accent", k.col(SIGN) === ACC, J(k.cols.slice(-2)));
    check("MENU foot: " + pad + " replaces the hint", !k.r.has(TODAY));
  }
  for (const pad of ["", "CONTROLLER LOST", undefined]) {
    const k = padded(false, pad);
    check("MENU foot: padNote " + J(pad) + " keeps today's foot, muted", k.r.has(TODAY) && k.col(TODAY) !== ACC && !k.r.strs().includes(SIGN));
  }
  check("MENU foot: the signpost fits the stage", SIGN.length * 6 + 24 <= 600);
  const both = padded(false, "CONTROLLER READY", NOTE);
  check("MENU foot: soundNote wins over the signpost", both.r.has(NOTE + " · " + TODAY) && !both.r.has(SIGN), both.r.strs().join("|"));
  for (const [n, W, h, lg] of [["short box", 600, 520], ["narrow tall box", 420, 860, 113], ["wide tall box", 600, 900, 162]]) {
    const LT = md.layout(W, h, lg), r = padded(true, "CONTROLLER READY", "", LT);
    check("touch hub: the signpost, whole, in accent (" + n + ")", r.col(SIGN) === ACC, r.r.strs().join("|"));
    check("touch hub: soundNote wins (" + n + ")", (() => { const x = padded(true, "CONTROLLER READY", NOTE, LT); return x.r.strs().some((s) => s.includes(NOTE)) && !x.r.strs().includes(SIGN); })());
    check("touch hub: LOST paints no signpost (" + n + ")", !padded(true, "CONTROLLER LOST", "", LT).r.strs().includes(SIGN));
  }
  {
    const LT = md.layout(600, 520), S = md.menuList(LT, 8, true).rows[7], tile = padded(true, "CONTROLLER BACK", "", LT).cols.find((x) => x.s === SIGN);
    check("touch hub: on the SOURCE tile the signpost clears the SOURCE label", !!tile && tile.x - SIGN.length * 0.6 * 13 >= S.x + 24 + 70, tile && tile.x);
    const LN = md.layout(400, 520), N = padded(true, "CONTROLLER READY", "", LN).cols.find((x) => /^CONTROLLER READY/.test(x.s));
    const LP = md.layout(400, 800, 108), P = padded(true, "CONTROLLER READY", "", LP), URL0 = "github.com/HMarzban/fusegrid";
    check("touch hub, signpost under the plate: the SOURCE tile keeps its URL whole, in its own colour", P.col(SIGN) === ACC && P.r.has(URL0) && P.col(URL0) !== ACC, P.r.strs().join("|"));
    check("touch hub: a tile too narrow clips rather than run over the label", !!N && N.s !== SIGN, N && N.s);
  }
  {
    const LONG = "CONTROLLER READY · VIBRATION MEDIUM · OPTIONS › CONTROLS · v99", VN = "CONTROLLER READY · VIBRATION MEDIUM", sh = (touch, LT, padNote = VN) => { const r = rec(); md.drawMenu(r.c, { cursor: 0, enterT: 9, items: ITEMS, touch, kind: "2d", rev: "v99", info: INFO, padNote }, LT, 9); return r; };
    check("MENU foot: the level joins the note where it fits", sh(false, L).has(LONG) && !sh(false, L).has(SIGN));
    check("the long note fits the stage it is drawn on", LONG.length * 6 + 24 <= 600 - 16);
    check("MENU foot: no level, today's note", sh(false, L, "CONTROLLER READY").has(SIGN) && sh(false, L, "CONTROLLER BACK").has(SIGN) && !sh(false, L, "CONTROLLER BACK").has(LONG));
    check("touch hub, wide tall box: it fits under the plate", sh(true, md.layout(600, 900, 162)).has(LONG));
    check("touch hub, 400 wide tall box: too wide, today's note stands whole", sh(true, md.layout(400, 800, 108)).has(SIGN) && !sh(true, md.layout(400, 800, 108)).has(LONG));
    check("touch hub, on the SOURCE tile: too wide, today's note stands", !sh(true, md.layout(600, 520)).has(LONG) && sh(true, md.layout(600, 520)).has(SIGN));
  }
  const padShot = (n) => { const r = rec(); const app = createMenuApp({ settings: {} }); app.screen = SCREEN.MENU; app.subT = 9; app.padNote = n; drawShell(r.c, app, {}, null, "2d", () => [], () => 0); return r; };
  const SIGN0 = /^CONTROLLER READY · OPTIONS › CONTROLS · v\d+$/;
  check("shellview hands app.padNote to the MENU foot, the live build tag kept", padShot("CONTROLLER READY").strs().some((s) => SIGN0.test(s)), padShot("CONTROLLER READY").strs().join("|"));
  check("no padNote on app: no signpost", !padShot("").strs().some((s) => s.startsWith("CONTROLLER READY")));
  { const r = rec(); md.drawMenu(r.c, { cursor: 0, enterT: 9, items: ITEMS, touch: false, kind: "2d", rev: "", info: INFO, padNote: "CONTROLLER READY" }, L, 9); check("no tag to keep: the sign alone, no dangling dot", r.has("CONTROLLER READY · OPTIONS › CONTROLS")); }
  check("the note gone, the normal foot is back with its tag", padded(false, "").r.has(TODAY));
  setHints(PAD);
  check("HOW TO on a pad: the foot names CONTROLS, whole, and fits its plate", paint(PAGES.HOWTO(false)).has("REBIND IN OPTIONS › CONTROLS · EAST / SOUTH BACK") && "REBIND IN OPTIONS › CONTROLS · EAST / SOUTH BACK".length * 6 <= 520);
  setHints(null);
  check("HOW TO on keys: the foot stays today's bytes", paint(PAGES.HOWTO(false)).has("ESC / ENTER BACK") && !paint(PAGES.HOWTO(false)).strs().some((s) => s.includes("REBIND")));
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
// ---- T14: LEVEL MODES on a pad: the help line carries the words, the ring follows the cursor ----
{
  const lvl = (W, H, T, cur, mask = 0, time = false, U = true, lg) => { const LL = md.layout(W, H, lg); md.setModeFocus(() => cur); const r = rec(), strokes = []; const c0 = r.c; const c = new Proxy(c0, { get: (t, p) => (p === "strokeRect" ? (x, y, w, h) => strokes.push({ col: t.strokeStyle, x, y, w, h }) : t[p]), set: (t, p, v) => { t[p] = v; return true; } }); md.drawLevelSelect(c, 1, LL, 9, 0, mask, U, 0, time, T, INFO); md.setModeFocus(null); return { r, strokes, G: md.levelGeom(LL, U, T) }; };
  const ringOf = (x) => x.strokes.filter((s) => s.col === "#dfe7f5" && s.y + s.h > x.G.mode[0].y && s.y < x.G.mode[0].y + x.G.mode[0].h);
  const inHelp = (x) => x.r.texts.filter((t) => t.y >= x.G.help.y - 2 && t.y <= x.G.help.y + x.G.help.h + 2).map((t) => t.s).join(" ");
  const k = lvl(600, 520, false, 2);
  check("keys: help line and chips unchanged, no ring", !inHelp(k).includes("TRIGGERS") && k.r.has("3 THIN") && ringOf(k).length === 0, inHelp(k));
  setHints(wordsOf("pad", DEF_CONTROLS));
  const a = lvl(600, 520, false, -1);
  check("pad, no cursor: the help line says how, no ring", inHelp(a) === "TRIGGERS PICK · NORTH TOGGLES" && ringOf(a).length === 0, inHelp(a));
  const b = lvl(600, 520, false, 3), ring = ringOf(b), m = b.G.mode[3];
  check("pad, cursor: one ring, on the focused chip, outside its edge", ring.length === 1 && ring[0].x < m.x && ring[0].x + ring[0].w > m.x + m.w && ring[0].y < m.y && ring[0].y + ring[0].h > m.y + m.h, J(ring));
  check("pad, cursor: the help line names the focused mode", inHelp(b) === "TRIGGERS PICK · NORTH TOGGLES · SHRINK walls close in from 25 s", inHelp(b));
  check("pad, cursor on the fifth chip: TIME", inHelp(lvl(600, 520, false, 4)).endsWith("TIME stopwatch + per-room best"));
  const clipped = (x) => /…|\.\.\./.test(inHelp(x));
  for (const [W, H, T, lg, tag] of [[600, 520, false, undefined, "keyboard"], [600, 520, true, undefined, "touch"], [608, 352, false, undefined, "iso guard"], [400, 800, true, 140, "narrow touch"], [440, 760, true, 140, "narrow touch wide"]])
    for (let i = 0; i < 5; i++) {
      const x = lvl(W, H, T, i), words = inHelp(x).replace(/\s+/g, " "), S = x.G.S;
      check("pad help fits, whole: " + tag + " chip " + i, words.startsWith("TRIGGERS PICK · NORTH TOGGLES") && !clipped(x) && words.endsWith(i === 4 ? "per-room best" : ["1 life", "floor pickups", "buried items", "from 25 s"][i]), words + " / " + S.iw);
    }
  check("no MODES row before the first CLEAR: no help, no ring", !lvl(600, 520, false, 2, 0, false, false).r.has("TRIGGERS PICK · NORTH TOGGLES"));
  setHints(null);
  check("setModeFocus(null) restores no cursor", md.modeFocusOf() === -1);
}

console.log("\n  HINTS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
