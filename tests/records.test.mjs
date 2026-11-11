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
import * as probe from "../src/render/kit/probe.js";
import * as lazy from "../src/render/pages/lazy.js";
const RP = await lazy.want("records"); // RECORDS is a lazy page (R20): the tests paint and tap it, not its LOADING plate
lazy._set("guide", await import("../src/render/pages/guide.js")); // the lazy GUIDE pages (v202 Task 3.5), as if their import had landed

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

/* ---- the one strip: draw and tap share one geometry on every box. SCORES and MEDALS are pages/records.js (v202 Task 4.1: the kit tabs, bricks in
   a wall trough, recordsGeom for draw and tap); STATS too since Task 4.2 ---- */
const sgP = shellGeo(393, 852), sgL = shellGeo(1024, 768, 600, 520, "l");
const BOXES = [
  ["600x520 d", md.layout(600, 520), false], ["608x352 iso", md.layout(608, 352), false], ["600x520 touch #c", md.layout(600, 520), true],
  ["1366x768 d window", md.layout(1366, 768, 300), false], ["landscape #sh " + sgL.w + "x" + sgL.h, md.layout(sgL.w, sgL.h, sgL.logo, sgL.s), true],
  ["portrait #sh " + sgP.w + "x" + sgP.h, md.layout(sgP.w, sgP.h, sgP.logo, sgP.s), true],
];
const TOP = [{ s: 4210, l: 5, d: "2026-11-09", t: 0, p: 0 }];
const FR = (L, touch) => ({ W: L.W, H: L.H, touch: !!touch, shell: !!L.shell, css: L.css });
const RG = (L, touch) => RP.recordsGeom(FR(L, touch));
const paintPage = (p, L, touch, tabs) => {
  const R = rec();
  probe.setOn(true);
  if (p === 0) md.drawScores(R.ctx, { level: 1, focus: tabs ? "tabs" : "body", heat: 1, scores: TOP, plaques: 0b11 }, L, 1, touch);
  else if (p === 1) md.drawStats(R.ctx, { level: 1, focus: tabs ? "tabs" : "body", view: null, notes: ["NOTE"] }, L, 1, touch);
  else md.drawTrophies(R.ctx, { level: 1, focus: tabs ? "tabs" : "body", rows: undefined }, L, 1, touch);
  R.snap = probe.snapshot();
  probe.setOn(false);
  return R;
};
const near = (a, b, e = 0.01) => Math.abs(a - b) < e;
for (const [nm, L, touch] of BOXES) for (let p = 0; p < 3; p++) {
  const R = paintPage(p, L, touch, true);
  const G = RG(L, touch), S = G.plate, T = G.tabs, rs = R.snap.rects;
  const drawn = T.map((r, i) => rs.find((q) => q.name === "tab " + RECORD_TABS[i] && near(q.x, r.x) && near(q.w, r.w) && near(q.h, r.h) && (i === p ? near(q.y, r.y - 2 * G.u) : near(q.y, r.y))));
  check(`${PAGES[p]} (${nm}): the drawn tab rects are recordsGeom's rects (the open tab stands 2 px up)`, drawn.every(Boolean), J([T, rs.filter((q) => /^tab /.test(q.name))]));
  const labels = RECORD_TABS.map((s, i) => R.snap.texts.find((t) => t.s === s && t.x >= T[i].x - 0.01 && t.x + t.w <= T[i].x + T[i].w + 0.01 && t.y > T[i].y - 2 * G.u && t.y + t.capH < T[i].y + T[i].h));
  check(`${PAGES[p]} (${nm}): each tab word sits whole inside its tab`, labels.every(Boolean), J(labels.map((t) => !!t)));
  check(`${PAGES[p]} (${nm}): the strip sits inside the plate, above the pane`, T.every((r) => r.x >= S.x && r.x + r.w <= S.x + S.w && r.y >= S.y && r.y + r.h <= G.pane.y), J([T, S, G.pane]));
  const hits = T.map((r) => md.recTabHit(r.x + r.w / 2, r.y + r.h / 2, L, p, touch));
  check(`${PAGES[p]} (${nm}): each tab's centre taps to itself`, J(hits) === J([0, 1, 2]), J(hits));
  check(`${PAGES[p]} (${nm}): the pane's middle and the outside are not a tab`, md.recTabHit(S.x + S.w / 2, G.pane.y + G.pane.h / 2, L, p, touch) === -1 && md.recTabHit(S.x - 6, T[0].y + 10, L, p, touch) === -1 && md.recTabHit(S.x + S.w / 2, S.y + S.h + 6, L, p, touch) === -1);
  if (p === 0) {
    let clash = 0;
    for (let y = S.y; y < S.y + S.h; y += 1) for (let x = S.x; x < S.x + S.w; x += 2) if (md.recTabHit(x, y, L, 0, touch) >= 0 && md.scoresHit(x, y, L, touch) >= 0) clash++;
    check(`SCORES (${nm}): no point taps both a RECORDS tab and a difficulty`, clash === 0 && G.keys.every((r) => r.y >= T[0].y + T[0].h + 4), clash);
  }
  const ring = (Rx) => Rx.paints.some((q) => q.op === "stroke" && q.style === "#fff2df" && q.lw === 3 && q.box && q.box.x < T[p].x && q.box.x + q.box.w > T[p].x + T[p].w && q.box.y < T[p].y - 2 * G.u);
  /* a touch box shows the focus only with a controller: tap mode draws no ring (fix round 1, as LEVEL SELECT) */
  if (touch) { check(`${PAGES[p]} (${nm}): tap mode draws no ring`, !ring(R)); setHints(wordsOf("pad", DEF_CONTROLS)); }
  const Rf = touch ? paintPage(p, L, touch, true) : R;
  check(`${PAGES[p]} (${nm}): the tab row's focus is the kit's ring on the open tab${p ? "" : "; none while the body has it"}`, ring(Rf) && (p === 2 || !ring(paintPage(p, L, touch, false))));
  setHints(null);
}
{
  /* the strip never moves: SCORES, STATS and MEDALS draw one plate and one strip (recordsGeom has no page argument) */
  for (const [nm, L, touch] of BOXES) {
    const [a, b, c] = [0, 1, 2].map((p) => paintPage(p, L, touch, true).snap.rects), pick = (rs) => rs.filter((q) => q.name === "plate" || /^tab /.test(q.name)).map((q) => [q.name, q.x, q.w, q.h]);
    check(`SCORES, STATS and MEDALS (${nm}): the same plate and the same tab strip`, J(pick(a)) === J(pick(b)) && J(pick(b)) === J(pick(c)) && pick(a).length === 4, J([pick(a), pick(b)]));
  }
}

/* ---- foot hints by focus and device: no hint names a key that does nothing there (SCORES / MEDALS: the kit foot under the plate, label first,
   keycap last; STATS: its old foot until Task 4.2) ---- */
{
  const L = md.layout(1366, 768, 300), feet = (p, touch, tabs) => paintPage(p, L, touch, tabs).texts.map((t) => t.s);
  const PAD = wordsOf("pad", DEF_CONTROLS), TOUCH = wordsOf("touch", DEF_CONTROLS), seq = (p, tabs) => { paintPage(p, L, false, tabs); return RP._dbg.last.S.feet.find((f) => f.v === (tabs ? "tabs" : "body")).fp.parts.map((q) => q.t || q.sep || (Array.isArray(q.cap) ? "[" + q.cap[0] + "]" : "[" + q.cap + "]")).join(" "); };
  check("SCORES tab row (keys): TAB ←→ · DIFFICULTY ↓ · BACK ESC, each label before its keycaps", seq(0, true) === "TAB [lf] [rt] · DIFFICULTY [dn] · BACK [ESC]", seq(0, true));
  check("SCORES body (keys): DIFFICULTY ←→ · TAB Q E · BACK ESC", seq(0, false) === "DIFFICULTY [lf] [rt] · TAB [Q] [E] · BACK [ESC]", seq(0, false));
  check("STATS tab row (keys): COPY MY STATS C · RESET R · TAB ←→ · BACK ESC", seq(1, true) === "COPY MY STATS [C] · RESET [R] · TAB [lf] [rt] · BACK [ESC]", seq(1, true));
  check("STATS body (keys): COPY MY STATS C · RESET R · TAB Q E · BACK ESC (its labels sit where they did on the tab row)", seq(1, false) === "COPY MY STATS [C] · RESET [R] · TAB [Q] [E] · BACK [ESC]", seq(1, false));
  check("MEDALS (keys): TAB ←→ · BACK ESC (Esc goes to MENU, never BACK TO STATS)", seq(2, true) === "TAB [lf] [rt] · BACK [ESC]" && !feet(2, false, true).some((s) => /TO STATS/.test(s)), seq(2, true));
  setHints(PAD);
  check("SCORES tab row (controller): TAB D-PAD · BACK EAST", seq(0, true) === "TAB [D-PAD] · BACK [EAST]", seq(0, true));
  check("STATS tab row (controller): COPY MY STATS WEST · MEDALS NORTH · TAB D-PAD · BACK EAST, no wipe", seq(1, true) === "COPY MY STATS [WEST] · MEDALS [NORTH] · TAB [D-PAD] · BACK [EAST]" && !feet(1, false, true).some((s) => /RESET/.test(s)), seq(1, true));
  check("SCORES body (controller): DIFFICULTY D-PAD · BACK EAST; STATS body: the same controller foot", seq(0, false) === "DIFFICULTY [D-PAD] · BACK [EAST]" && seq(1, false) === "COPY MY STATS [WEST] · MEDALS [NORTH] · TAB [D-PAD] · BACK [EAST]", seq(0, false));
  check("MEDALS (controller): TAB D-PAD · BACK EAST", seq(2, true) === "TAB [D-PAD] · BACK [EAST]", seq(2, true));
  setHints(TOUCH);
  const Lt = md.layout(sgP.w, sgP.h, sgP.logo, sgP.s), tf = (p) => paintPage(p, Lt, true, true).snap;
  check("SCORES and MEDALS on a touch layout: no foot, a BACK key in the header", [0, 2].every((p) => { const s = tf(p); return !s.rects.some((q) => q.name === "foot") && s.rects.some((q) => q.name === "BACK") && !s.texts.some((t) => /^TAB$|ESC/.test(t.s)); }));
  check("STATS for a touch player: no foot; COPY STATS and RESET keys in the pane tap C and R", (() => { const sn = tf(1), G = RG(Lt, true), A = G.d.bodies.stats.acts, c = (r) => [(r.x + r.w / 2) * G.u, (r.y + r.h / 2) * G.u]; return !sn.rects.some((q) => q.name === "foot") && sn.rects.some((q) => q.name === "COPY STATS") && md.statsHit(...c(A.copy), Lt, false, false, true) === "KeyC" && md.statsHit(...c(A.reset), Lt, false, false, true) === "KeyR"; })());
  setHints(null);
  /* statsHit rides the painted foot in both focus states: its labels (and keycaps) are their keys; TAB and the lead are not taps; BACK backs out */
  for (const tabs of [true, false]) {
    paintPage(1, L, false, tabs);
    const fp = RP._dbg.last.S.feet.find((f) => f.v === (tabs ? "tabs" : "body")).fp, u = RG(L, false).u, at = (t) => { const z = fp.zones[fp.parts.filter((q) => q.t != null).findIndex((q) => q.t === t)]; return [((z.x0 + z.x1) / 2) * u, fp.mid * u]; };
    const got = ["COPY MY STATS", "RESET", "TAB", "BACK"].map((t) => md.statsHit(...at(t), L, false, tabs, false));
    check(`statsHit maps COPY MY STATS / RESET at their painted place (${tabs ? "tab row" : "body"}); TAB on the foot plaque is inert, BACK backs out`, J(got) === J(["KeyC", "KeyR", "plate", "back"]), J(got)); // fix round 1: the foot plaque's words and keycaps look like keys, so a tap there is inert (as other pages), never a back-out; BACK is its key
    paintPage(0, L, false, tabs);
    const sp = RP._dbg.last.S.feet.find((f) => f.v === (tabs ? "tabs" : "body")).fp, zi = (t) => sp.zones[sp.parts.filter((q) => q.t != null).findIndex((q) => q.t === t)], zt = zi(W.LABEL.TAB), zb = zi("BACK");
    const capX = (zt.x1 - 4) * u; // the TAB item's last keycap
    check(`the desk foot plaque is inert on SCORES too (-2), its TAB keycaps included; its BACK label backs out (-1), and so does just under the plaque (${tabs ? "tab row" : "body"})`,
      md.scoresHit(capX, sp.mid * u, L, false) === -2 && md.scoresHit(((zb.x0 + zb.x1) / 2) * u, sp.mid * u, L, false) === -1 && md.scoresHit(capX, (sp.y + sp.h + 4) * u, L, false) === -1, J([zt, zb]));
  }
}

/* ---- MENU (v202 Task 3.1, the world kit page): the desk list beside the card's slot, the RECORDS teaser, the phone column ---- */
{
  const L = md.layout(600, 520), g = md.menuGeom(L, ITEMS.length, false), u = g.u, r = (l) => g.rows[l];
  const gap = (a, b) => +((r(b).y - (r(a).y + r(a).h)) / u).toFixed(6);
  check("keyboard MENU (600x520, the desk geometry scaled as one piece): the card's slot beside the list keeps the list's height (420 design px) for Task 3.2", near(g.card.h / u, 420) && near(g.card.y, r("PLAY").y) && g.card.x > r("PLAY").x + r("PLAY").w, J(g.card));
  check("keyboard MENU: 24 px breaks after PLAY and before GUIDE, 8 px between the doors; PLAY 64, the doors 46 (design px)", gap("PLAY", "LEVEL SELECT") === 24 && gap("SETTINGS", "GUIDE") === 24 && gap("LEVEL SELECT", "DAILY") === 8 && gap("RECORDS", "SETTINGS") === 8 && gap("GUIDE", "SOURCE") === 8 && near(r("PLAY").h / u, 64) && near(r("RECORDS").h / u, 46), J(ITEMS.map((l) => [r(l).y, r(l).h])));
  const R = rec();
  md.drawMenu(R.ctx, { rows: ITEMS, focus: "RECORDS", level: 1, best: TOP[0].s, enterT: 9 }, L, 9);
  const s = R.texts.map((t) => t.s), tz = pg._dbg.last.P.rows.RECORDS.tz;
  check("the RECORDS row's teaser names the best played NORMAL run: BEST 4,210 (with NORMAL DIFFICULTY where it fits)", !!tz && /^BEST 4,210( · NORMAL DIFFICULTY)?$/.test(tz.lines[0]) && s.includes(tz.lines[0]), s.join("|"));
  const lab = pg._dbg.last.P.rows.RECORDS;
  check("the RECORDS teaser sits inside its key, right of its label (focused: past the bomb)", tz.x <= lab.r.x + lab.r.w - 2 && tz.x - tz.w >= lab.foc.x + lab.label.w + 12, J({ tz: [tz.x - tz.w, tz.x], label: lab.foc.x + lab.label.w }));
  const R0 = rec();
  md.drawMenu(R0.ctx, { rows: ITEMS, focus: "RECORDS", level: 1, best: null, enterT: 9 }, L, 9);
  check("hooks never lie: no played run, no score: RECORDS reads NO RUNS YET and MENU prints no score", R0.texts.some((t) => t.s === "NO RUNS YET") && !R0.texts.some((t) => /\d{3,}|\d,\d{3}/.test(t.s) && !/^v\d+$/.test(t.s)));
  check("the STATS pane is gone with its row", !R0.texts.some((t) => t.s === "YOUR CABINET"));
}
for (const [nm, W, H, lg, css] of [["600x520 #c", 600, 520], ["portrait #sh", sgP.w, sgP.h, sgP.logo, sgP.s], ["landscape #sh", sgL.w, sgL.h, sgL.logo, sgL.s]]) {
  const L = md.layout(W, H, lg, css), g = md.menuGeom(L, ITEMS.length, true), r = (l) => g.rows[l];
  if (g.mode === "phone") check(`touch MENU (${nm}): the phone column in reading order: PLAY; LEVEL SELECT; the card's slot; DAILY | RECORDS; SETTINGS | GUIDE; SOURCE`,
    r("LEVEL SELECT").y > r("PLAY").y && g.card.y > r("LEVEL SELECT").y && r("DAILY").y > g.card.y && r("DAILY").y === r("RECORDS").y && r("DAILY").x < r("RECORDS").x && r("SETTINGS").y === r("GUIDE").y && r("SETTINGS").y > r("DAILY").y && r("SOURCE").y > r("GUIDE").y && r("SOURCE").w === r("PLAY").w && r("DAILY").w < r("PLAY").w / 2, J(ITEMS.map((l) => [r(l).x, r(l).y, r(l).w])));
  else if (g.mode === "compact") check(`touch MENU (${nm}): compact (fix round 1: the desk would scale its rows under 44 CSS px): PLAY across the top, the six doors two wide in ITEMS order, no card slot`,
    ITEMS.slice(1).every((l, i, a) => r(l).y > r("PLAY").y + r("PLAY").h && (i % 2 ? r(l).y === r(a[i - 1]).y && r(l).x > r(a[i - 1]).x : r(l).x === r("PLAY").x && (!i || r(l).y > r(a[i - 1]).y))) && !g.card, J(ITEMS.map((l) => [r(l).x, r(l).y])));
  else check(`touch MENU (${nm}): the desk list in ITEMS order, one column`, ITEMS.every((l, i) => !i || r(l).y > r(ITEMS[i - 1]).y) && ITEMS.every((l) => r(l).x === r("PLAY").x), J(ITEMS.map((l) => r(l).y)));
  const k = css || 1;
  check(`touch MENU (${nm}): the mock's sizes (phone: PLAY 62, doors 50, tiles 58 CSS px; compact with room to spare: PLAY 62, tiles 58 CSS px; desk: PLAY 64, doors 46 design px)`, g.mode === "phone" ? near(r("PLAY").h * css, 62, 0.01) && near(r("SOURCE").h * css, 50, 0.01) && near(r("DAILY").h * css, 58, 0.01) : g.mode === "compact" ? near(r("PLAY").h * k, 62, 0.01) && near(r("DAILY").h * k, 58, 0.01) : near(r("PLAY").h / g.u, 64) && near(r("DAILY").h / g.u, 46), g.mode + " " + r("PLAY").h);
}

/* ---- taps through the real mountPointer (main's hit bag), on #c and on #sh boxes ---- */
function mkEl(w, h, rect, lay) {
  const L = {};
  return { width: w, height: h, style: {}, getBoundingClientRect: () => rect, ownerDocument: { body: { getAttribute: (k) => (k === "data-lay" ? lay : null) } },
    addEventListener(ty, fn) { (L[ty] = L[ty] || []).push(fn); }, fire(ty, ev) { (L[ty] || []).slice().forEach((fn) => fn(ev || {})); } };
}
const HIT = { overlayBox, pauseHit, touchLay, controlsHit, dims, menuHit: md.menuHit, settingsHit: md.settingsHit, graphicsHit: md.graphicsHit, guideHit: md.guideHit, enemiesHit: md.enemiesHit, levelHit: md.levelHit, scoresHit: md.scoresHit, statsHit: md.statsHit, recTabHit: md.recTabHit, layout: md.layout };
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
  const D = dims(t.surf, "2d"), Lk = md.layout(D.cw, D.ch, D.lg, D.css), Lo = md.layout(D.cw, D.ch), G = RG(Lk, kind !== "d"); // the pointer's own frame: lg and css for RECORDS (v202 Task 4.1)
  const mid = (r) => [r.x + r.w / 2, r.y + r.h / 2];
  const tabAt = (p, to) => mid(G.tabs[to]); // one strip for all three (Tasks 4.1 / 4.2)
  for (const [from, to] of [[0, 1], [1, 2], [2, 0], [0, 2], [2, 1], [1, 0]]) {
    a.recTab(from - RECORD_SCREENS.indexOf(a.screen)); a.recFocus = 1; t.cues.length = 0;
    t.draw();
    t.tapAt(...tabAt(from, to));
    check(`tap (${kind}): on ${PAGES[from]}, the drawn ${PAGES[to]} tab opens ${PAGES[to]} with one cue, the tab row focused`, a.screen === RECORD_SCREENS[to] && a.recFocus === 0 && t.cues.join() === "uiMove", a.screen + "/" + t.cues.join());
    t.cues.length = 0;
    t.draw();
    t.tapAt(...tabAt(to, to));
    check(`tap (${kind}): the tab already shown is silent (${PAGES[to]})`, a.screen === RECORD_SCREENS[to] && t.cues.length === 0, t.cues.join());
  }
  /* the rest of each page's tap rules stay */
  a.recTab(-2);
  const T = G.keys[2];
  t.cues.length = 0; a.scoreHeat = 0;
  t.tapAt(T.x + T.w / 2, T.y + T.h / 2);
  check(`tap (${kind}): a SCORES difficulty from the tab row sets the filter (one cue), focus moves into the body`, a.screen === SCREEN.SCORES && a.scoreHeat === 2 && a.recFocus === 1 && t.cues.join() === "uiMove", a.scoreHeat + "/" + t.cues.join());
  const S0 = G.plate, P0 = G.pane;
  t.tapAt(P0.x + P0.w / 2, P0.y + P0.h - 10);
  check(`tap (${kind}): SCORES on the plate off every tab and difficulty is inert`, a.screen === SCREEN.SCORES);
  t.tapAt(S0.x - 8 * G.u, S0.y + 40);
  check(`tap (${kind}): SCORES off the plate backs out to MENU on RECORDS`, a.screen === SCREEN.MENU && a.cursor === ITEMS.indexOf("RECORDS"));
  if (G.back) {
    a.confirm(); t.tapAt(...mid(G.back));
    check(`tap (${kind}): the BACK key backs out to MENU on RECORDS`, a.screen === SCREEN.MENU && a.cursor === ITEMS.indexOf("RECORDS"));
  }
  a.confirm(); a.recTab(2);
  t.tapAt(P0.x + P0.w / 2, P0.y + P0.h / 2);
  check(`tap (${kind}): MEDALS anywhere off a tab backs out to MENU on RECORDS`, a.screen === SCREEN.MENU && a.cursor === ITEMS.indexOf("RECORDS"));
  a.confirm(); a.recTab(1); a.key("KeyR");
  t.tapAt(...mid(G.tabs[0]));
  check(`tap (${kind}): a tab tap on an armed STATS only disarms (the confirm plate is modal): stays on STATS, never wipes`, a.screen === SCREEN.STATS && a.resetArm === false && a.n.reset === 0);
  t.draw();
  const A = G.d.bodies.stats.acts, rz = A ? [(A.reset.x + A.reset.w / 2) * G.u, (A.reset.y + A.reset.h / 2) * G.u] : (() => { const fp = RP._dbg.last.S.feet.find((f) => f.v === RP._dbg.last.S.fv).fp, z = fp.zones.find((q) => q.key === "KeyR"); return [((z.x0 + z.x1) / 2) * G.u, fp.mid * G.u]; })();
  t.tapAt(...rz);
  check(`tap (${kind}): STATS taps its RESET (the foot label, or the touch key): armed, nothing wiped`, a.screen === SCREEN.STATS && a.resetArm === true && a.n.reset === 0, a.resetArm);
  a.resetArm = false;
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
for (const kind of ["d", "l", "p"]) for (const focus of [0, 1]) for (const pt of ["mouse", "touch"]) {
  const t = tapRig(kind), a = t.app, D = dims(t.surf, "2d"), G = RG(md.layout(D.cw, D.ch, D.lg, D.css), kind !== "d"), u = G.u, f = G.d.confirm, P = G.d.pane;
  const c = (r) => [(r.x + r.w / 2) * u, (r.y + r.h / 2) * u], mid = (r) => [r.x + r.w / 2, r.y + r.h / 2];
  const armed = () => { a.screen = SCREEN.MENU; a.cursor = ITEMS.indexOf("RECORDS"); a.confirm(); a.recTab(1); if (focus) a.move(1, 1); a.key("KeyR"); t.draw(); return a.screen === SCREEN.STATS && a.recFocus === focus && a.resetArm === true; };
  const bad = [], cell = (name, x, y, wipes, then) => {
    const ok0 = armed(), r0 = a.n.reset;
    t.tapAt(x, y, pt);
    if (then) then();
    const w = a.n.reset - r0;
    if (!ok0 || a.resetArm !== false || w !== wipes) bad.push(name + " armed:" + ok0 + " after:" + a.resetArm + " wipes:" + w);
  };
  G.tabs.forEach((r, i) => cell("tab " + PAGES[i], ...mid(r), 0));
  cell("the tab shown, then R", ...mid(G.tabs[1]), 0, () => { if (a.resetArm) return; a.key("KeyR"); if (a.n.reset || !a.resetArm) bad.push("R after the current-tab tap did more than arm"); a.resetArm = false; });
  cell("a miss on the pane", (P.x + 6) * u, (P.y + 6) * u, 0);
  cell("off the plate", 2, 2, 0);
  cell("COPY", ...c(f.copy), 0);
  if (G.foot) { armed(); const fp = RP._dbg.last.S.feet.find((q) => q.v === "arm").fp; a.resetArm = false; for (const z of fp.zones) cell("foot " + (z.key || "label"), ((z.x0 + z.x1) / 2) * u, fp.mid * u, 0); }
  cell("AGAIN ERASES", ...c(f.again), 1);
  check(`armed STATS (${kind}, ${focus ? "body" : "tab row"}, ${pt}): every tab, the pane, off the plate, COPY and each armed foot label disarm; only AGAIN ERASES wipes`, bad.length === 0, bad.join(" | "));
}

console.log("\n  RECORDS RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
