// RECORDS (UI upgrade v202 Task 2.2; design record §4: "MENU rows in order: PLAY, LEVEL SELECT, DAILY, RECORDS, SETTINGS, GUIDE,
// SOURCE"; plan ruling R7). RECORDS is not a SCREEN: it is SCORES, STATS and TROPHIES (the MEDALS page) reached from one MENU row and
// linked by one tab strip, the top row of each page's ↑↓ walk. The machine's contract (recTab, focus, Esc, onStats / onMedals), the one
// strip geometry for draw and tap on every box, and taps through the real mountPointer on desktop, landscape and portrait boxes.
import { ITEMS, SCREEN, RECORD_SCREENS, createMenuApp } from "../src/app/menuapp.js";
import { mountPointer } from "../src/app/pointer.js";
import { shellGeo } from "../src/app/fit.js";
import { overlayBox, pauseHit, touchLay } from "../src/render/scenes.js";
import { controlsHit, dims, drawShell } from "../src/render/shellview.js";
import * as md from "../src/render/menudraw.js";
import * as pg from "../src/render/pages/menu.js";
import { RECORD_TABS, LABEL } from "../src/render/words.js";
import * as W from "../src/render/words.js";
import { setHints } from "../src/render/hintcopy.js";
import { wordsOf } from "../src/app/hints.js";
import { DEF_CONTROLS } from "../src/app/controls.js";
import { rec } from "./lib/textrec.mjs";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined && !cond ? " -> " + detail : ""));
}
const J = JSON.stringify;
const PAGES = ["SCORES", "STATS", "MEDALS"];

/* ---- the rows and the tabs ---- */
check("MENU has seven rows in the design record's order", J(ITEMS) === J(["PLAY", "LEVEL SELECT", "DAILY", "RECORDS", "SETTINGS", "GUIDE", "SOURCE"]) && Object.isFrozen(ITEMS), J(ITEMS));
check("RECORDS' screens are SCORES, STATS, TROPHIES in tab order; no SCREEN is added", J(RECORD_SCREENS) === J([SCREEN.SCORES, SCREEN.STATS, SCREEN.TROPHIES]) && Object.isFrozen(RECORD_SCREENS) && Object.keys(SCREEN).length === 17 && SCREEN.CONTROLS === 16);
check("the tab words come from words.js: SCORES · STATS · MEDALS", J(RECORD_TABS) === J(PAGES) && Object.isFrozen(RECORD_TABS) && ITEMS[3] === LABEL.RECORDS);

/* ---- the machine ---- */
const mkApp = (o = {}) => {
  const n = { stats: 0, medals: 0, reset: 0 };
  const a = createMenuApp({ onStats: () => n.stats++, onMedals: () => n.medals++, onReset: () => n.reset++, ...o });
  a.n = n;
  a.screen = SCREEN.MENU;
  return a;
};
const open = (o) => { const a = mkApp(o); a.cursor = ITEMS.indexOf("RECORDS"); a.feel = ""; a.confirm(); return a; };
{
  const a = open();
  check("MENU RECORDS + confirm opens SCORES with the tab row focused, the feel is enter", a.screen === SCREEN.SCORES && a.recFocus === 0 && a.feel === "enter", a.screen + "/" + a.recFocus + "/" + a.feel);
  a.feel = "";
  check("recTab(1) on SCORES: STATS, the tab row focused, onStats once, onMedals never, feel move", a.recTab(1) === true && a.screen === SCREEN.STATS && a.recFocus === 0 && a.n.stats === 1 && a.n.medals === 0 && a.feel === "move", J([a.screen, a.n, a.feel]));
  a.feel = "";
  check("recTab(1) on STATS: MEDALS, onMedals once, onStats not again", a.recTab(1) === true && a.screen === SCREEN.TROPHIES && a.n.stats === 1 && a.n.medals === 1 && a.feel === "move", J([a.screen, a.n]));
  a.feel = "";
  check("recTab(1) on MEDALS: the edge, false, nothing changes, no feel", a.recTab(1) === false && a.screen === SCREEN.TROPHIES && a.n.medals === 1 && a.feel === "", J([a.screen, a.feel]));
  check("recTab(-2) on MEDALS: SCORES in one step (a tap on the far tab), no hook", a.recTab(-2) === true && a.screen === SCREEN.SCORES && a.n.stats === 1 && a.n.medals === 1);
  a.feel = "";
  check("recTab(-1) on SCORES: the edge, false, no feel", a.recTab(-1) === false && a.screen === SCREEN.SCORES && a.feel === "");
  check("recTab(0) (a tap on the tab already shown): false", a.recTab(0) === false && a.screen === SCREEN.SCORES);
  check("recTab(2) on SCORES: MEDALS without passing STATS: onMedals, never onStats", a.recTab(2) === true && a.screen === SCREEN.TROPHIES && a.n.stats === 1 && a.n.medals === 2, J(a.n));
  check("reaching STATS from MEDALS calls onStats again (every arrival)", a.recTab(-1) === true && a.screen === SCREEN.STATS && a.n.stats === 2, J(a.n));
  a.recTab(-1); a.recTab(1);
  check("SCORES -> STATS again: a third onStats", a.screen === SCREEN.STATS && a.n.stats === 3, J(a.n));
  const m = mkApp();
  check("recTab off the three pages: false (MENU)", m.recTab(1) === false && m.screen === SCREEN.MENU);
  m.screen = SCREEN.SETTINGS;
  check("recTab off the three pages: false (SETTINGS)", m.recTab(1) === false && m.screen === SCREEN.SETTINGS);
}
{
  const a = open();
  a.recTab(1); a.key("KeyR");
  check("STATS R arms", a.resetArm === true && a.n.reset === 0);
  check("recTab while armed disarms and never wipes", a.recTab(-1) === true && a.resetArm === false && a.n.reset === 0 && a.screen === SCREEN.SCORES);
  a.recTab(1); a.key("KeyR");
  check("T while armed (MEDALS) disarms and never wipes", a.key("KeyT") === true && a.screen === SCREEN.TROPHIES && a.resetArm === false && a.n.reset === 0);
  a.recTab(-1); a.key("KeyR");
  check("E while armed disarms and never wipes", a.key("KeyE") === true && a.screen === SCREEN.TROPHIES && a.resetArm === false && a.n.reset === 0);
  a.recTab(-1); a.key("KeyR"); a.key("KeyR");
  check("R, R on STATS still wipes (onReset once)", a.n.reset === 1, a.n.reset);
}
{
  /* the ↑↓ walk: the tab row on top, the body under it where the page has one */
  const a = open();
  check("SCORES tab row: ↑ does nothing", a.move(-1, 1) === false && a.recFocus === 0);
  check("SCORES tab row: ↓ moves into the body", a.move(1, 1) === true && a.recFocus === 1 && a.screen === SCREEN.SCORES);
  check("SCORES body: ↓ does nothing", a.move(1, 1) === false && a.recFocus === 1);
  a.scoreHeat = 1;
  check("SCORES body: ←/→ move the difficulty filter, never the tab", a.move(-1, 0) === true && a.scoreHeat === 0 && a.move(1, 0) === true && a.move(1, 0) === true && a.scoreHeat === 2 && a.screen === SCREEN.SCORES);
  check("SCORES body: the filter clamps silently", a.move(1, 0) === false && a.scoreHeat === 2);
  check("SCORES body: ↑ returns to the tab row", a.move(-1, 1) === true && a.recFocus === 0);
  check("SCORES tab row: → is the next tab, the filter untouched", a.move(1, 0) === true && a.screen === SCREEN.STATS && a.scoreHeat === 2 && a.recFocus === 0);
  check("STATS tab row: ↓ moves into the body (its foot actions)", a.move(1, 1) === true && a.recFocus === 1);
  check("STATS body: ←/→ do nothing", a.move(1, 0) === false && a.move(-1, 0) === false && a.screen === SCREEN.STATS);
  check("STATS body: T, Q and E still work from the body and land on the tab row", a.key("KeyT") === true && a.screen === SCREEN.TROPHIES && a.recFocus === 0);
  check("MEDALS: no body, ↓ does nothing and ↑ does nothing", a.move(1, 1) === false && a.move(-1, 1) === false && a.recFocus === 0);
  check("MEDALS tab row: ← is STATS", a.move(-1, 0) === true && a.screen === SCREEN.STATS);
  a.move(1, 1);
  check("Q from a body: the previous tab, the tab row focused", a.key("KeyQ") === true && a.screen === SCREEN.SCORES && a.recFocus === 0);
  check("Q on the first tab: false", a.key("KeyQ") === false && a.screen === SCREEN.SCORES);
  check("E: the next tab", a.key("KeyE") === true && a.screen === SCREEN.STATS);
  check("T on SCORES and on MEDALS does nothing", (() => { const b = open(); const s = b.key("KeyT"); b.recTab(2); return s === false && b.key("KeyT") === false && b.screen === SCREEN.TROPHIES; })());
  const m = mkApp();
  check("Q / E on MENU do nothing", m.key("KeyQ") === false && m.key("KeyE") === false && m.screen === SCREEN.MENU && m.cursor === 0);
}
{
  /* Esc / Backspace / Enter: MENU on RECORDS from every page and focus; a cursor set elsewhere is moved there */
  const out = [];
  for (let p = 0; p < 3; p++) for (const f of [0, 1]) for (const k of ["Escape", "Backspace", "Enter"]) {
    if (p === 2 && f === 1) continue;
    const a = open();
    a.recTab(p); a.recFocus = f; a.cursor = 0; a.feel = "";
    a.key(k);
    if (!(a.screen === SCREEN.MENU && a.cursor === ITEMS.indexOf("RECORDS") && a.feel === "back")) out.push(PAGES[p] + "/" + f + "/" + k + " -> " + a.screen + "@" + a.cursor + " " + a.feel);
  }
  check("Esc, Backspace and Enter on every page, tab row or body: MENU on RECORDS, feel back", out.length === 0, out.join(" | "));
}
{
  /* held repeat (ruling 5): a held direction on the tab row repeats the tab step at the menu rate and stops silently at the edge; the
     SCORES body filter keeps today's no-repeat */
  const a = open(), held = (o, s) => { const n = Math.round(s * 60); for (let i = 0; i < n; i++) a.update(1 / 60, { input: { up: false, down: false, left: false, right: false, ...o }, confirmHeld: false }); };
  let steps = 0;
  const m0 = a.move.bind(a);
  a.move = (d, ax) => { const r = m0(d, ax); if (r) steps++; return r; };
  held({ right: true }, 0.2);
  check("held → on the tab row: one step at once", a.screen === SCREEN.STATS && steps === 1, a.screen + "/" + steps);
  held({ right: true }, 0.4);
  check("held → past 0.35 s: the second step (the menu repeat rate)", a.screen === SCREEN.TROPHIES && steps === 2, a.screen + "/" + steps);
  held({ right: true }, 1);
  check("held → at the last tab: silent, no further step", a.screen === SCREEN.TROPHIES && steps === 2, steps);
  held({}, 0.1);
  const b = open();
  b.move(1, 1); b.scoreHeat = 0;
  for (let i = 0; i < 90; i++) b.update(1 / 60, { input: { up: false, down: false, left: false, right: true }, confirmHeld: false });
  check("held → in the SCORES body: no repeat (the filter moves by key presses, as today)", b.scoreHeat === 0 && b.screen === SCREEN.SCORES, b.scoreHeat);
  const c = open(); let n = 0; const c0 = c.move.bind(c); c.move = (d, ax) => { const r = c0(d, ax); if (r) n++; return r; };
  c.key("ArrowRight");
  c.update(1 / 60, { input: { up: false, down: false, left: false, right: true }, confirmHeld: false });
  check("a key press and its held axis on the same frame make one tab step, never two", c.screen === SCREEN.STATS && n === 1, c.screen + "/" + n);
}

/* ---- the one strip: draw and tap share recTabsGeom on every box ---- */
const sgP = shellGeo(393, 852), sgL = shellGeo(1024, 768, 600, 520, "l");
const BOXES = [
  ["600x520 d", md.layout(600, 520), false], ["608x352 iso", md.layout(608, 352), false], ["600x520 touch #c", md.layout(600, 520), true],
  ["1366x768 d window", md.layout(1366, 768, 300), false], ["landscape #sh " + sgL.w + "x" + sgL.h, md.layout(sgL.w, sgL.h, sgL.logo), true],
  ["portrait #sh " + sgP.w + "x" + sgP.h, md.layout(sgP.w, sgP.h, sgP.logo), true],
];
const TOP = [{ s: 4210, l: 5, d: "2026-11-09", t: 0, p: 0 }];
const paintPage = (p, L, touch, tabs) => {
  const R = rec();
  if (p === 0) md.drawScores(R.ctx, TOP, L, 1, 1, 0b11, touch, tabs);
  else if (p === 1) md.drawStats(R.ctx, L, 1, { rows: [["RUNS", 3]], notes: ["NOTE"], trophies: [] }, false, null, touch, tabs);
  else md.drawTrophies(R.ctx, L, 1, undefined, touch, tabs);
  return R;
};
const near = (a, b) => Math.abs(a - b) < 0.01;
for (const [nm, L, touch] of BOXES) for (let p = 0; p < 3; p++) {
  const S = md.recPlate(L, p, touch), T = md.recTabsGeom(S, touch), R = paintPage(p, L, touch, true);
  const drawn = T.map((r) => R.rects.find((q) => q.fill && near(q.x, r.x) && near(q.y, r.y) && near(q.w, r.w) && near(q.h, r.h)));
  check(`${PAGES[p]} (${nm}): the drawn tab rects are recTabsGeom's rects`, drawn.every(Boolean), J(T));
  const labels = RECORD_TABS.map((s, i) => R.texts.find((t) => t.s === s && t.x - t.w / 2 >= T[i].x - 0.01 && t.x + t.w / 2 <= T[i].x + T[i].w + 0.01 && t.y > T[i].y && t.y < T[i].y + T[i].h));
  check(`${PAGES[p]} (${nm}): each tab word sits whole inside its tab`, labels.every(Boolean), J(labels.map((t) => !!t)));
  check(`${PAGES[p]} (${nm}): the strip sits inside the plate, in the head, above the body`, T.every((r) => r.x >= S.x && r.x + r.w <= S.x + S.w && r.y >= S.y && r.y + r.h + 4 <= S.by), J([T, S.y, S.by]));
  check(`${PAGES[p]} (${nm}): the page's own title is gone, the tab says which page it is`, !R.texts.some((t) => t.s === "HIGH SCORES" || (p === 2 && t.s === "MEDALS" && !labels.includes(t))));
  const hits = T.map((r) => md.recTabHit(r.x + r.w / 2, r.y + r.h / 2, L, p, touch));
  check(`${PAGES[p]} (${nm}): each tab's centre taps to itself`, J(hits) === J([0, 1, 2]), J(hits));
  check(`${PAGES[p]} (${nm}): the plate's middle and the outside are not a tab`, md.recTabHit(S.mid, S.y + S.h / 2, L, p, touch) === -1 && md.recTabHit(S.x - 6, T[0].y + 10, L, p, touch) === -1 && md.recTabHit(S.mid, S.y + S.h + 6, L, p, touch) === -1);
  if (p === 0) {
    const g = md.scoresGeom(L, touch);
    let clash = 0;
    for (let y = S.y; y < S.y + S.h; y += 1) for (let x = S.x; x < S.x + S.w; x += 2) if (md.recTabHit(x, y, L, 0, touch) >= 0 && md.scoresHit(x, y, L, touch) >= 0) clash++;
    check(`SCORES (${nm}): no point taps both a RECORDS tab and a difficulty tab`, clash === 0 && g.tabs.every((r) => r.y >= T[0].y + T[0].h + 4), clash);
  }
  const notch = (Rx) => Rx.rects.some((q) => q.fill === md.ACCENT && near(q.x, T[p].x) && near(q.w, 3) && near(q.h, T[p].h));
  check(`${PAGES[p]} (${nm}): the tab row's focus is the kit's notch on the current tab; none while the body has it`, notch(R) && !notch(paintPage(p, L, touch, false)));
}
{
  /* the strip leaves each page's plate where it was: the strip sits in the head's title line, so no plate moves */
  const L = md.layout(600, 520);
  check("SCORES plate at 600x520 keeps its size (no scale): f 1, h 392", md.scoresGeom(L, false).S.f === 1 && md.scoresGeom(L, false).S.h === 392, J(md.scoresGeom(L, false).S));
  check("STATS plate at 600x520 keeps its size and its floor pin", md.statsGeom(L).S.f === 1 && md.statsGeom(L).S.y + md.statsGeom(L).S.h === 492, J(md.statsGeom(L).S));
  check("MEDALS plate at 600x520 keeps its size", md.recPlate(L, 2, false).f === 1 && md.recPlate(L, 2, false).h === 88 + 4 * 60 + 3 * 6, J(md.recPlate(L, 2, false)));
}

/* ---- foot hints by focus and device: no hint names a key that does nothing there ---- */
{
  const L = md.layout(600, 520), feet = (p, touch, tabs) => paintPage(p, L, touch, tabs).texts.map((t) => t.s);
  const PAD = wordsOf("pad", DEF_CONTROLS), TOUCH = wordsOf("touch", DEF_CONTROLS);
  check("SCORES tab row (keys): ←→ TAB · ↓ DIFFICULTY · ESC BACK", feet(0, false, true).includes("←→ TAB · ↓ DIFFICULTY · ESC BACK"));
  check("SCORES body (keys): ↑ TABS leads back to the tabs, then today's foot", feet(0, false, false).includes("↑ TABS · ← → DIFFICULTY · ESC BACK"));
  check("STATS tab row (keys): ←→ TAB, then today's foot", feet(1, false, true).includes("←→ TAB · T MEDALS · C COPY MY STATS · R RESET · ESC BACK"));
  check("STATS body (keys): ↑ TABS leads back to the tabs, then today's foot", feet(1, false, false).includes("↑ TABS · T MEDALS · C COPY MY STATS · R RESET · ESC BACK"));
  check("the two leads are the same length, so STATS' T / C / R zones do not move with the focus", md.TAB_LEAD.length === md.TABS_LEAD.length && md.TAB_LEAD === "←→ " + W.LABEL.TAB + " · " && md.TABS_LEAD === "↑ " + W.LABEL.TABS + " · ");
  check("MEDALS (keys): ←→ TAB · ENTER / ESC BACK (Esc goes to MENU now, never BACK TO STATS)", feet(2, false, true).includes("←→ TAB · ENTER / ESC BACK") && !feet(2, false, true).some((s) => /TO STATS/.test(s)));
  setHints(PAD);
  check("SCORES tab row (controller): ←→ TAB · ↓ DIFFICULTY · EAST BACK", feet(0, false, true).includes("←→ TAB · ↓ DIFFICULTY · EAST BACK"));
  check("STATS tab row (controller): ←→ TAB, then the controller foot, no wipe", feet(1, false, true).includes("←→ TAB · NORTH MEDALS · WEST COPY MY STATS · EAST BACK") && !feet(1, false, true).some((s) => /RESET/.test(s)));
  check("SCORES and STATS body (controller): ↑ TABS leads back", feet(0, false, false).includes("↑ TABS · ← → DIFFICULTY · EAST BACK") && feet(1, false, false).includes("↑ TABS · NORTH MEDALS · WEST COPY MY STATS · EAST BACK"));
  check("MEDALS (controller): ←→ TAB · SOUTH / EAST BACK", feet(2, false, true).includes("←→ TAB · SOUTH / EAST BACK"));
  setHints(TOUCH);
  check("SCORES and MEDALS on a touch layout: the tap rule", feet(0, true, true).includes("TAP OUTSIDE TO GO BACK") && feet(2, true, true).includes("TAP OUTSIDE TO GO BACK") && !feet(0, true, true).some((s) => /TAB ·/.test(s)));
  check("STATS for a touch player: no lead in either focus (the tabs are tapped), today's tappable foot", [true, false].every((tb) => feet(1, true, tb).includes("T MEDALS · C COPY MY STATS · R RESET · ESC BACK") && !feet(1, true, tb).some((s) => /TABS? ·/.test(s))));
  { const S = md.statsGeom(L).S, s0 = "T MEDALS · C COPY MY STATS · R RESET · ESC BACK", x0 = S.mid - s0.length * 3;
    check("statsHit follows the touch foot on the tab row too: T MEDALS at its painted place", md.statsHit(x0 + 6 * 4, S.footY, L, false, true) === "KeyT"); }
  setHints(null);
  /* statsHit rides the painted foot in both focus states */
  for (const tabs of [true, false]) {
    const R = paintPage(1, L, false, tabs), f = R.texts.find((t) => /T MEDALS/.test(t.s)), S = md.statsGeom(L).S, x0 = S.mid - f.s.length * 3;
    const at = (tok) => { const a = f.s.indexOf(tok); return x0 + 6 * (a + tok.length / 2); };
    const got = ["T MEDALS", "C COPY MY STATS", "R RESET", "ESC BACK"].map((tok) => md.statsHit(at(tok), S.footY, L, false, tabs));
    check(`statsHit maps T / C / R at their painted place (${tabs ? "tab row" : "body"}); ESC and the lead are not taps`, J(got) === J(["KeyT", "KeyC", "KeyR", null]) && md.statsHit(at(tabs ? "←→ TAB" : "↑ TABS"), S.footY, L, false, tabs) === null, J(got));
  }
}

/* ---- MENU (v202 Task 3.1, the world kit page): the desk list beside the card's slot, the RECORDS teaser, the phone column ---- */
{
  const L = md.layout(600, 520), g = md.menuGeom(L, ITEMS.length, false), u = g.u, r = (l) => g.rows[l];
  const gap = (a, b) => +((r(b).y - (r(a).y + r(a).h)) / u).toFixed(6);
  check("keyboard MENU (600x520, the desk geometry scaled as one piece): the card's slot beside the list keeps the list's height (420 design px) for Task 3.2", near(g.card.h / u, 420) && near(g.card.y, r("PLAY").y) && g.card.x > r("PLAY").x + r("PLAY").w, J(g.card));
  check("keyboard MENU: 24 px breaks after PLAY and before GUIDE, 8 px between the doors; PLAY 64, the doors 46 (design px)", gap("PLAY", "LEVEL SELECT") === 24 && gap("SETTINGS", "GUIDE") === 24 && gap("LEVEL SELECT", "DAILY") === 8 && gap("RECORDS", "SETTINGS") === 8 && gap("GUIDE", "SOURCE") === 8 && near(r("PLAY").h / u, 64) && near(r("RECORDS").h / u, 46), J(ITEMS.map((l) => [r(l).y, r(l).h])));
  const R = rec();
  md.drawMenu(R.ctx, { rows: ITEMS, focus: "RECORDS", touch: false, level: 1, best: TOP[0].s, enterT: 9 }, L, 9);
  const s = R.texts.map((t) => t.s), tz = pg._dbg.last.P.rows.RECORDS.tz;
  check("the RECORDS row's teaser names the best played NORMAL run: BEST 4,210 (with NORMAL DIFFICULTY where it fits)", !!tz && /^BEST 4,210( · NORMAL DIFFICULTY)?$/.test(tz.lines[0]) && s.includes(tz.lines[0]), s.join("|"));
  const lab = pg._dbg.last.P.rows.RECORDS;
  check("the RECORDS teaser sits inside its key, right of its label (focused: past the bomb)", tz.x <= lab.r.x + lab.r.w - 2 && tz.x - tz.w >= lab.foc.x + lab.label.w + 12, J({ tz: [tz.x - tz.w, tz.x], label: lab.foc.x + lab.label.w }));
  const R0 = rec();
  md.drawMenu(R0.ctx, { rows: ITEMS, focus: "RECORDS", touch: false, level: 1, best: null, enterT: 9 }, L, 9);
  check("hooks never lie: no played run, no score: RECORDS reads NO RUNS YET and MENU prints no score", R0.texts.some((t) => t.s === "NO RUNS YET") && !R0.texts.some((t) => /\d{3,}|\d,\d{3}/.test(t.s) && !/^v\d+$/.test(t.s)));
  check("the STATS pane is gone with its row", !R0.texts.some((t) => t.s === "YOUR CABINET"));
}
for (const [nm, W, H, lg, css] of [["600x520 #c", 600, 520], ["portrait #sh", sgP.w, sgP.h, sgP.logo, sgP.s], ["landscape #sh", sgL.w, sgL.h, sgL.logo, sgL.s]]) {
  const L = md.layout(W, H, lg, css), g = md.menuGeom(L, ITEMS.length, true), r = (l) => g.rows[l];
  if (g.mode === "phone") check(`touch MENU (${nm}): the phone column in reading order: PLAY; LEVEL SELECT; the card's slot; DAILY | RECORDS; SETTINGS | GUIDE; SOURCE`,
    r("LEVEL SELECT").y > r("PLAY").y && g.card.y > r("LEVEL SELECT").y && r("DAILY").y > g.card.y && r("DAILY").y === r("RECORDS").y && r("DAILY").x < r("RECORDS").x && r("SETTINGS").y === r("GUIDE").y && r("SETTINGS").y > r("DAILY").y && r("SOURCE").y > r("GUIDE").y && r("SOURCE").w === r("PLAY").w && r("DAILY").w < r("PLAY").w / 2, J(ITEMS.map((l) => [r(l).x, r(l).y, r(l).w])));
  else check(`touch MENU (${nm}): the desk list in ITEMS order, one column`, ITEMS.every((l, i) => !i || r(l).y > r(ITEMS[i - 1]).y) && ITEMS.every((l) => r(l).x === r("PLAY").x), J(ITEMS.map((l) => r(l).y)));
  check(`touch MENU (${nm}): the mock's sizes (phone: PLAY 62, doors 50, tiles 58 CSS px; desk: PLAY 64, doors 46 design px)`, g.mode === "phone" ? near(r("PLAY").h * css, 62, 0.01) && near(r("SOURCE").h * css, 50, 0.01) && near(r("DAILY").h * css, 58, 0.01) : near(r("PLAY").h / g.u, 64) && near(r("DAILY").h / g.u, 46), g.mode + " " + r("PLAY").h);
}

/* ---- taps through the real mountPointer (main's hit bag), on #c and on #sh boxes ---- */
function mkEl(w, h, rect, lay) {
  const L = {};
  return { width: w, height: h, style: {}, getBoundingClientRect: () => rect, ownerDocument: { body: { getAttribute: (k) => (k === "data-lay" ? lay : null) } },
    addEventListener(ty, fn) { (L[ty] = L[ty] || []).push(fn); }, fire(ty, ev) { (L[ty] || []).slice().forEach((fn) => fn(ev || {})); } };
}
const HIT = { overlayBox, pauseHit, touchLay, controlsHit, dims, menuHit: md.menuHit, settingsHit: md.settingsHit, graphicsHit: md.graphicsHit, guideHit: md.guideHit, levelHit: md.levelHit, scoresHit: md.scoresHit, statsHit: md.statsHit, recTabHit: md.recTabHit, layout: md.layout };
function tapRig(kind, o = {}) {
  const app = mkApp(o), cues = [], world = { state: "PLAY", time: 0, level: 1 };
  for (const k of ["move", "recTab"]) { const f = app[k].bind(app); app[k] = (...a) => { const r = f(...a); if (r) cues.push("uiMove"); return r; }; } // main's cue wrappers
  const b0 = app.back.bind(app); app.back = () => { const r = b0(); if (r) cues.push("uiBack"); return r; };
  const input = { _intent: { fire: false }, onUiKey: (c) => { if (c !== "KeyR") app.resetArm = false; app.key(c); } };
  let cv, fit = null, box = null, sh = null;
  if (kind === "d") cv = mkEl(600, 520, { left: 0, top: 0, width: 300, height: 260 }, "d");
  else {
    const g = kind === "p" ? sgP : sgL, rect = { left: 5, top: 9, width: g.w * g.s, height: g.h * g.s };
    sh = mkEl(Math.round(g.w * 2), Math.round(g.h * 2), rect, kind);
    box = { width: g.w, height: g.h, logo: g.logo, ownerDocument: sh.ownerDocument, getBoundingClientRect: () => rect };
    cv = mkEl(600, 520, { left: 0, top: 0, width: 300, height: 260 }, kind);
    fit = { sh, box: () => box };
  }
  mountPointer({ canvas: cv, fit, input, app, world, kind: () => "2d", ctl: () => null, hit: HIT });
  const surf = box || cv, el = sh || cv;
  const draw = () => { const R = rec(); drawShell(R.ctx, app, world, surf, "2d", () => TOP, () => 0, () => ({ top: TOP })); return R; };
  const tapAt = (x, y, pointerType = "mouse") => { const r = surf.getBoundingClientRect(); el.fire("pointerdown", { clientX: r.left + (x * r.width) / surf.width, clientY: r.top + (y * r.height) / surf.height, currentTarget: el, pointerType }); el.fire("pointerup", {}); };
  return { app, cues, draw, tapAt, surf };
}
for (const kind of ["d", "l", "p"]) {
  const t = tapRig(kind), a = t.app;
  a.cursor = ITEMS.indexOf("RECORDS"); a.confirm();
  const Lk = md.layout(t.surf.width, t.surf.height, t.surf.logo), tabLabel = (R, p, s) => { const S = md.recPlate(Lk, p, kind !== "d"); return R.texts.find((x) => x.s === s && x.y > S.y && x.y < S.by); }; // the strip's word, never STATS' MEDALS tile
  for (const [from, to] of [[0, 1], [1, 2], [2, 0], [0, 2], [2, 1], [1, 0]]) {
    a.recTab(from - RECORD_SCREENS.indexOf(a.screen)); a.recFocus = 1; t.cues.length = 0;
    const R = t.draw(), lab = tabLabel(R, from, RECORD_TABS[to]);
    t.tapAt(lab.x, lab.y);
    check(`tap (${kind}): on ${PAGES[from]}, the drawn ${PAGES[to]} tab opens ${PAGES[to]} with one cue, the tab row focused`, a.screen === RECORD_SCREENS[to] && a.recFocus === 0 && t.cues.join() === "uiMove", a.screen + "/" + t.cues.join());
    t.cues.length = 0;
    const R2 = t.draw(), own = tabLabel(R2, to, RECORD_TABS[to]);
    t.tapAt(own.x, own.y);
    check(`tap (${kind}): the tab already shown is silent (${PAGES[to]})`, a.screen === RECORD_SCREENS[to] && t.cues.length === 0, t.cues.join());
  }
  /* the rest of each page's tap rules stay */
  a.recTab(-2);
  const L = md.layout(t.surf.width, t.surf.height, t.surf.logo), T = md.scoresGeom(L, kind !== "d").tabs[2];
  t.cues.length = 0; a.scoreHeat = 0;
  t.tapAt(T.x + T.w / 2, T.y + T.h / 2);
  check(`tap (${kind}): a SCORES difficulty tab from the tab row sets the filter (one cue), focus moves into the body`, a.screen === SCREEN.SCORES && a.scoreHeat === 2 && a.recFocus === 1 && t.cues.join() === "uiMove", a.scoreHeat + "/" + t.cues.join());
  const S0 = md.recPlate(L, 0, kind !== "d");
  t.tapAt(S0.mid, S0.y + S0.h - 30);
  check(`tap (${kind}): SCORES on the plate off every tab is inert`, a.screen === SCREEN.SCORES);
  t.tapAt(S0.x - 8, S0.y + 40);
  check(`tap (${kind}): SCORES off the plate backs out to MENU on RECORDS`, a.screen === SCREEN.MENU && a.cursor === ITEMS.indexOf("RECORDS"));
  a.confirm(); a.recTab(2);
  const S2 = md.recPlate(L, 2, kind !== "d");
  t.tapAt(S2.mid, S2.y + S2.h / 2);
  check(`tap (${kind}): MEDALS anywhere off a tab backs out to MENU on RECORDS`, a.screen === SCREEN.MENU && a.cursor === ITEMS.indexOf("RECORDS"));
  a.confirm(); a.recTab(1); a.key("KeyR");
  const Ls = md.layout(t.surf.width, t.surf.height), S1 = md.statsGeom(Ls).S, T1 = md.recTabsGeom(md.recPlate(Ls, 1, kind !== "d"), kind !== "d");
  t.tapAt(T1[0].x + T1[0].w / 2, T1[0].y + T1[0].h / 2);
  check(`tap (${kind}): a tab tap on an armed STATS disarms, moves, never wipes`, a.screen === SCREEN.SCORES && a.resetArm === false && a.n.reset === 0);
  a.recTab(1);
  const R3 = t.draw(), tl = R3.texts.find((x) => /T MEDALS/.test(x.s)), x0 = S1.mid - tl.s.length * 3, ti = tl.s.indexOf("T MEDALS");
  t.tapAt(x0 + 6 * (ti + 4), S1.footY);
  check(`tap (${kind}): STATS still taps its T MEDALS foot label (the tab row's foot)`, a.screen === SCREEN.TROPHIES, a.screen);
}
{
  /* the phone column's taps open their row (touch portrait #sh, the MENU page's geometry) */
  const want = { PLAY: SCREEN.GAME, "LEVEL SELECT": SCREEN.LEVEL, DAILY: SCREEN.GAME, RECORDS: SCREEN.SCORES, SETTINGS: SCREEN.SETTINGS, GUIDE: SCREEN.GUIDE, SOURCE: SCREEN.MENU };
  const bad = [];
  for (let i = 0; i < ITEMS.length; i++) {
    let src = 0;
    const t = tapRig("p", { onSource: () => src++, dailySeed: () => ({ seed: 7, date: "2026-11-11", gen: 3 }) }), L = md.layout(t.surf.width, t.surf.height, t.surf.logo, sgP.s), q = md.menuGeom(L, ITEMS.length, true).rows[ITEMS[i]];
    t.tapAt(q.x + q.w / 2, q.y + q.h / 2);
    if (t.app.screen !== want[ITEMS[i]] || (ITEMS[i] === "SOURCE" && src !== 1) || (want[ITEMS[i]] !== SCREEN.GAME && t.app.cursor !== i)) bad.push(ITEMS[i] + " -> " + t.app.screen + "@" + t.app.cursor);
  }
  check("phone taps open their own row: PLAY; LEVEL SELECT; DAILY | RECORDS; SETTINGS | GUIDE; SOURCE", bad.length === 0, bad.join(" | "));
}

/* ---- an armed STATS reset (fix round 1): R arms, and anything but a second R cancels it. Every tap cell through the real
   mountPointer, on #c (desktop), a landscape #sh box and a portrait #sh box, with the tab row and the body focused, by mouse and
   by touch: the three tabs (the one shown included), a miss on the plate, a tap off it, and each label of the armed foot. After
   each the reset is disarmed, and nothing is wiped except by R AGAIN ERASES, the documented second press. ---- */
const RESET_TOKENS = ["R AGAIN ERASES", "OTHER KEYS CANCEL", "KEEPS SETTINGS + GAME SPEED", "C COPY"];
for (const kind of ["d", "l", "p"]) for (const focus of [0, 1]) for (const pt of ["mouse", "touch"]) {
  const t = tapRig(kind), a = t.app, touch = kind !== "d", L = md.layout(t.surf.width, t.surf.height), S = md.statsGeom(L).S, T = md.recTabsGeom(md.recPlate(L, 1, touch), touch);
  const armed = () => { a.screen = SCREEN.MENU; a.cursor = ITEMS.indexOf("RECORDS"); a.confirm(); a.recTab(1); if (focus) a.move(1, 1); a.key("KeyR"); return a.screen === SCREEN.STATS && a.recFocus === focus && a.resetArm === true; };
  const bad = [], cell = (name, x, y, wipes, then) => {
    const ok0 = armed(), r0 = a.n.reset;
    t.tapAt(x, y, pt);
    if (then) then();
    const w = a.n.reset - r0;
    if (!ok0 || a.resetArm !== false || w !== wipes) bad.push(name + " armed:" + ok0 + " after:" + a.resetArm + " wipes:" + w);
  };
  T.forEach((r, i) => cell("tab " + PAGES[i], r.x + r.w / 2, r.y + r.h / 2, 0));
  cell("the tab shown, then R", T[1].x + T[1].w / 2, T[1].y + T[1].h / 2, 0, () => { if (a.resetArm) return; a.key("KeyR"); if (a.n.reset || !a.resetArm) bad.push("R after the current-tab tap did more than arm"); a.resetArm = false; });
  cell("a miss on the plate", S.mid, S.by + 30, 0);
  cell("off the plate", Math.max(2, S.x - 8), S.y + 60, 0);
  const R = (armed(), t.draw()), f = R.texts.find((x) => /^R AGAIN ERASES/.test(x.s)), x0 = S.mid - f.s.length * 3;
  a.resetArm = false;
  for (const tok of RESET_TOKENS) { const i = f.s.indexOf(tok); cell("foot " + tok, x0 + 6 * (i + tok.length / 2), S.footY, tok === "R AGAIN ERASES" ? 1 : 0); }
  check(`armed STATS (${kind}, ${focus ? "body" : "tab row"}, ${pt}): every tab, the plate, off it and each foot label disarm; only R AGAIN ERASES wipes`, bad.length === 0, bad.join(" | "));
}

console.log("\n  RECORDS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
