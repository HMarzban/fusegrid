// Pointer routing (src/app/pointer.js, v202 UI plan Task 0.4): main.js's one tap handler,
// moved out whole. Every case drives the real mountPointer with a fake #c / #sh, app, input
// and world, and the real hit functions wrapped in spies, so each tap must reach the same
// handler with the same arguments it did inside main.js.
import { readFileSync } from "node:fs";
import { mountPointer } from "../src/app/pointer.js";
import { ITEMS, SCREEN } from "../src/app/menuapp.js";
import { shellGeo } from "../src/app/fit.js";
import { overlayBox, pauseGeom, pauseHit, touchLay } from "../src/render/scenes.js";
import { controlsHit, dims } from "../src/render/shellview.js";
import { graphicsHit, guideHit, layout, levelGeom, levelHit, menuHit, scoresHit, settingsHit, statsHit, recTabHit, recTabsGeom, recPlate } from "../src/render/menudraw.js";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}

/* headless.test's mkCamCanvas element shape (copied: importing that file runs its checks),
   plus a log of each addEventListener's argument count and of rect reads. */
function mkEl(w, h, rect, lay) {
  const L = {}, adds = [];
  const el = {
    width: w, height: h, style: {}, rects: 0, adds,
    getBoundingClientRect: () => { el.rects++; return rect || { left: 0, top: 0, width: w, height: h }; },
    addEventListener(ty, fn) { adds.push([ty, arguments.length]); (L[ty] = L[ty] || []).push(fn); },
    fire(ty, ev) { (L[ty] || []).slice().forEach((fn) => fn(ev || {})); },
  };
  if (lay) el.ownerDocument = { body: { getAttribute: (k) => (k === "data-lay" ? lay : null) } }; // body[data-lay] as fit.js writes it
  return el;
}
const REAL = { overlayBox, pauseHit, touchLay, controlsHit, dims, menuHit, settingsHit, graphicsHit, guideHit, levelHit, scoresHit, statsHit, recTabHit, layout };
function mkHit(over = {}) {
  const calls = [], hit = {};
  for (const [k, f] of Object.entries(REAL)) hit[k] = (...a) => { const r = (over[k] || f)(...a); calls.push({ f: k, a, r }); return r; };
  return { hit, calls, of: (k) => calls.filter((c) => c.f === k), last: (k) => calls.filter((c) => c.f === k).pop() };
}
const SHELL = ["confirm", "back", "pauseBack", "playFromAttract", "skipShow", "move", "adjustPace", "recTab", "levelFocus"];
function rig(o = {}) {
  const log = [], taps = [];
  const app = { screen: SCREEN.MENU, pauseView: 0, pauseCursor: 0, cursor: 0, optRow: 0, gfxRow: 0, guideRow: 0, level: 1, heat: 1, pace: 0, scoreHeat: 0, pactUnlocked: true, resetArm: false, subT: 1.25, ctlT: 0.5, controls: { view: (t) => ({ view: t }) }, ...o.app };
  for (const m of SHELL) app[m] = (...a) => { log.push([m, ...a]); return true; };
  const input = { _intent: { fire: true }, keys: [], onUiKey(c) { this.keys.push(c); } };
  const world = { state: o.state || "PLAY" }, canvas = o.canvas || mkEl(600, 520), H = mkHit(o.over);
  let kind = o.kind || "2d", ctl = null;
  mountPointer({ canvas, fit: o.fit === undefined ? null : o.fit, input, app, world, kind: () => kind, ctl: () => ctl, hit: H.hit });
  ctl = { tap: (v) => taps.push(v) }; // assigned after the mount, as main's const ctl is
  const down = (x, y, ev = {}) => canvas.fire("pointerdown", { clientX: x, clientY: y, ...ev });
  return { app, input, world, canvas, H, log, taps, down, setKind: (k) => { kind = k; } };
}
const J = (v) => JSON.stringify(v);
const spot = (pred, W = 600, H = 520) => { for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (pred(x, y)) return { x, y }; return null; };
/* the centre of a row / tile / tab (a rectangle), found through the hit function itself */
const mid = (pred, W = 600, H = 520) => { let n = 0, sx = 0, sy = 0; for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (pred(x, y)) { n++; sx += x; sy += y; } return n ? { x: sx / n, y: sy / n } : null; };
const L0 = layout(600, 520);
const SENT = { sentinel: 1 };

// ---- mount: the same four listeners on #c, then #sh, two arguments each ----
{
  const want = ["pointerdown", "pointerup", "pointercancel", "pointerleave"].map((t) => [t, 2]);
  const sh = mkEl(436, 946), r = rig({ fit: { sh, box: () => null } });
  check("mount: #c then #sh each get pointerdown, pointerup, pointercancel, pointerleave, with no options; #sh adds contextmenu (#c's camera controls own it there)", J(r.canvas.adds) === J(want) && J(sh.adds) === J([...want, ["contextmenu", 2]]), J(r.canvas.adds) + " / " + J(sh.adds));
  const a = rig({ fit: { sh: null, box: () => null } }), b = rig({ fit: null });
  check("mount: no #sh (or no fit) binds #c alone", J(a.canvas.adds) === J(want) && J(b.canvas.adds) === J(want));
}

// ---- GAME, not PAUSE: the tap belongs to Input's fire latch (the WIN / LOSE overlay's tap is Space) ----
for (const st of ["PLAY", "WIN", "LOSE"]) {
  const r = rig({ app: { screen: SCREEN.GAME }, state: st });
  r.down(300, 306);
  check("GAME " + st + ": no swallow, no hit test, no shell call (the latched fire stays)", r.input._intent.fire === true && r.H.calls.length === 0 && r.log.length === 0 && r.canvas.rects === 0, J(r.log));
}

// ---- PAUSE list: scaled tap through #c, pauseHit, Enter on the row ----
{
  const cv = mkEl(600, 520, { left: 0, top: 0, width: 300, height: 260 });
  const r = rig({ app: { screen: SCREEN.GAME }, state: "PAUSE", canvas: cv });
  const R = pauseGeom(overlayBox("2d"), false).rows;
  r.down(150, R[2].cy / 2);
  const p = r.H.last("pauseHit");
  check("PAUSE list: a scaled tap on row 2 sets pauseCursor 2 and confirms once, fire swallowed", r.app.pauseCursor === 2 && J(r.log) === J([["confirm"]]) && r.input._intent.fire === false, r.app.pauseCursor + " " + J(r.log));
  check("PAUSE list: pauseHit(px, py, overlayBox(kind), touchLay(#c)) in buffer px", p.a[0] === 300 && p.a[1] === R[2].cy && p.a[2] === r.H.last("overlayBox").r && p.a[3] === false && r.H.last("overlayBox").a[0] === "2d" && r.H.last("touchLay").a[0] === cv, J(p.a));
  const off = spot((x, y) => pauseHit(x, y, overlayBox("2d"), false) < 0);
  r.log.length = 0; r.input._intent.fire = true;
  r.down(off.x / 2, off.y / 2);
  check("PAUSE list: a tap off the rows only swallows the fire", r.log.length === 0 && r.app.pauseCursor === 2 && r.input._intent.fire === false, J(r.log));
  r.setKind("iso"); r.down(150, 2);
  check("PAUSE list: the look is read at the tap (overlayBox gets the kind set after mount)", r.H.last("overlayBox").a[0] === "iso");
}
{
  const R = pauseGeom(overlayBox("2d"), true).rows, cv = mkEl(600, 520, null, "p");
  const r = rig({ app: { screen: SCREEN.GAME }, state: "PAUSE", canvas: cv });
  r.down(300, R[1].cy);
  check("PAUSE list on a touch layout: touchLay(#c) is true and the touch pitch lands row 1", r.app.pauseCursor === 1 && r.H.last("pauseHit").a[3] === true, r.app.pauseCursor);
}

// ---- PAUSE inline pages: OPTIONS (view 1) and GRAPHICS (view 2) ----
for (const [pv, fn, other, field, row] of [[1, "settingsHit", "graphicsHit", "optRow", 6], [2, "graphicsHit", "settingsHit", "gfxRow", 3]]) {
  const r = rig({ app: { screen: SCREEN.GAME, pauseView: pv }, state: "PAUSE" });
  const F = (x, y) => REAL[fn](x, y, L0, 0, false), on = mid((x, y) => F(x, y) === row), plate = spot((x, y) => F(x, y) === -2), off = spot((x, y) => F(x, y) === -1);
  r.down(on.x, on.y);
  const c = r.H.last(fn), lc = r.H.last("layout");
  check("PAUSE view " + pv + ": a tap on row " + row + " sets " + field + " and confirms", r.app[field] === row && J(r.log) === J([["confirm"]]) && r.input._intent.fire === false, r.app[field] + " " + J(r.log));
  check("PAUSE view " + pv + ": " + fn + "(px, py, layout(B.w, B.h), 0, touchLay(#c)), never " + other, c.a[0] === on.x && c.a[1] === on.y && J(c.a[2]) === J(L0) && c.a[3] === 0 && c.a[4] === false && lc.a.length === 2 && lc.a[0] === 600 && lc.a[1] === 520 && r.H.of(other).length === 0, J(lc.a));
  r.log.length = 0; r.down(plate.x, plate.y);
  check("PAUSE view " + pv + ": -2 (on the plate, off the rows) is inert", r.log.length === 0 && r.app[field] === row, J(r.log));
  r.down(off.x, off.y);
  check("PAUSE view " + pv + ": -1 (off the plate) backs one level (pauseBack)", J(r.log) === J([["pauseBack"]]), J(r.log));
}

// ---- PAUSE view 3 (CONTROLS): ctl.tap(controlsHit(view, px, py, #c, kind, true)) ----
{
  const cv = mkEl(600, 520, { left: 10, top: 20, width: 300, height: 260 });
  const r = rig({ app: { screen: SCREEN.GAME, pauseView: 3, ctlT: 0.75 }, state: "PAUSE", canvas: cv, kind: "px", over: { controlsHit: () => SENT } });
  r.down(70, 60);
  const c = r.H.last("controlsHit");
  check("PAUSE view 3: ctl (read at the tap) gets controlsHit's answer; no shell call", r.taps.length === 1 && r.taps[0] === SENT && r.log.length === 0 && r.input._intent.fire === false, J(r.taps));
  check("PAUSE view 3: controlsHit(app.controls.view(app.ctlT), px, py, #c, kind, true)", c.a[0].view === 0.75 && c.a[1] === 120 && c.a[2] === 80 && c.a[3] === cv && c.a[4] === "px" && c.a[5] === true, J(c.a.slice(0, 3)));
}

// ---- PAUSE taps on #sh still map through #c (never the shell box) ----
{
  const g = shellGeo(393, 852), sh = mkEl(1000, 2000, { left: 0, top: 0, width: g.w * g.s, height: g.h * g.s }, "p");
  const box = { width: g.w, height: g.h, logo: g.logo, ownerDocument: sh.ownerDocument, rects: 0, getBoundingClientRect: () => { box.rects++; return sh.getBoundingClientRect(); } };
  const r = rig({ app: { screen: SCREEN.GAME }, state: "PAUSE", fit: { sh, box: () => box } });
  const R = pauseGeom(overlayBox("2d"), false).rows;
  sh.fire("pointerdown", { clientX: 300, clientY: R[2].cy, currentTarget: sh });
  check("PAUSE on #sh: maps through #c's rect and touchLay(#c), the box is never read", r.app.pauseCursor === 2 && box.rects === 0 && r.H.last("touchLay").a[0] === r.canvas, r.app.pauseCursor + " " + box.rects);
}

// ---- off GAME: every tap swallows the fire first ----
{
  const r = rig({ app: { screen: SCREEN.ATTRACT } });
  r.down(5, 5);
  check("ATTRACT: a tap plays (playFromAttract), nothing else", J(r.log) === J([["playFromAttract"]]) && r.input._intent.fire === false && r.H.calls.length === 0, J(r.log));
  const i = rig({ app: { screen: SCREEN.INTRO } });
  i.down(5, 5);
  check("INTRO: a tap is skipShow (gated in the machine), fire swallowed", J(i.log) === J([["skipShow"]]) && i.input._intent.fire === false, J(i.log));
}
{
  const cv = mkEl(600, 520, { left: 4, top: 8, width: 300, height: 260 });
  const r = rig({ app: { screen: SCREEN.CONTROLS, ctlT: 2 }, canvas: cv, over: { controlsHit: () => SENT } });
  r.down(54, 58);
  const c = r.H.last("controlsHit");
  check("CONTROLS: ctl.tap(controlsHit(app.controls.view(app.ctlT), x, y, cv, kind, false))", r.taps[0] === SENT && c.a[0].view === 2 && c.a[1] === 100 && c.a[2] === 100 && c.a[3] === cv && c.a[4] === "2d" && c.a[5] === false && r.log.length === 0 && r.input._intent.fire === false, J(c.a.slice(0, 3)));
}

// ---- MENU / OPTIONS / GRAPHICS / GUIDE: a row tap = Enter on it; off the rows a page backs out, MENU does nothing ----
for (const [scr, fn, field, row, offAct] of [[SCREEN.MENU, "menuHit", "cursor", 4, null], [SCREEN.SETTINGS, "settingsHit", "optRow", 6, "back"], [SCREEN.GRAPHICS, "graphicsHit", "gfxRow", 2, "back"], [SCREEN.GUIDE, "guideHit", "guideRow", 3, "back"]]) {
  const r = rig({ app: { screen: scr } }), F = (x, y) => REAL[fn](x, y, L0, ITEMS.length, false);
  const on = mid((x, y) => F(x, y) === row), off = spot((x, y) => F(x, y) === -1), plate = spot((x, y) => F(x, y) === -2);
  r.down(on.x, on.y);
  const c = r.H.last(fn), lc = r.H.last("layout");
  check(fn + ": a tap on row " + row + " sets " + field + " and confirms, fire swallowed", r.app[field] === row && J(r.log) === J([["confirm"]]) && r.input._intent.fire === false, r.app[field] + " " + J(r.log));
  check(fn + "(x, y, layout(cw, ch, lg), ITEMS.length, touchLay(cv)) with dims(cv, kind)", c.a[0] === on.x && c.a[1] === on.y && J(c.a[2]) === J(L0) && c.a[3] === ITEMS.length && c.a[4] === false && lc.a.length === 3 && lc.a[2] === undefined && r.H.last("dims").a[0] === r.canvas && r.H.last("dims").a[1] === "2d", J(lc.a));
  r.log.length = 0;
  r.down(off.x, off.y);
  check(fn + ": -1 " + (offAct ? "backs out" : "does nothing (a root list)"), J(r.log) === J(offAct ? [[offAct]] : []), J(r.log));
  if (plate) { r.log.length = 0; r.down(plate.x, plate.y); check(fn + ": -2 is inert", r.log.length === 0, J(r.log)); }
}

// ---- LEVEL SELECT: a tap first focuses the row it touched (levelFocus, v202 Task 2.3), then acts through the cued key path
// (one call each, ←→ on that row = move(d, 0)); only START starts ----
{
  const G = levelGeom(L0, true, false), c = (q) => [q.x + q.w / 2, q.y + q.h / 2];
  const r = rig({ app: { screen: SCREEN.LEVEL, level: 2, heat: 1, pace: 0, pactUnlocked: true } });
  r.down(...c(G.room[5]));
  check("LEVEL room tile 6: levelFocus(LEVEL), then app.move(6 - level, 0)", J(r.log) === J([["levelFocus", 0, -1], ["move", 4, 0]]), J(r.log));
  const h = r.H.last("levelHit"), lc = r.H.last("layout");
  check("LEVEL: levelHit(x, y, layout(cw, ch), app.pactUnlocked, touchLay(cv))", J(h.a[2]) === J(L0) && h.a[3] === true && h.a[4] === false && lc.a.length === 2, J(lc.a));
  r.log.length = 0; r.down(...c(G.heat[2]));
  check("LEVEL heat chip MAX: levelFocus(DIFFICULTY), then app.move(2 - heat, 0) (→ raises it)", J(r.log) === J([["levelFocus", 1, -1], ["move", 1, 0]]), J(r.log));
  r.log.length = 0; r.down(...c(G.pace[0]));
  check("LEVEL pace chip EASY: levelFocus(GAME SPEED), then app.adjustPace(0 - 1 - pace)", J(r.log) === J([["levelFocus", 2, -1], ["adjustPace", -1]]), J(r.log));
  r.log.length = 0; r.down(...c(G.mode[2]));
  check("LEVEL mode chip 3: levelFocus(MODIFIERS, 2), then input.onUiKey('Digit3'), no other shell call", J(r.input.keys) === J(["Digit3"]) && J(r.log) === J([["levelFocus", 3, 2]]), J(r.input.keys) + " " + J(r.log));
  r.log.length = 0; r.down(...c(G.start));
  check("LEVEL START: levelFocus(START), then confirm", J(r.log) === J([["levelFocus", 4, -1], ["confirm"]]), J(r.log));
  const none = spot((x, y) => levelHit(x, y, L0, true, false).k === "none");
  r.log.length = 0; r.down(none.x, none.y);
  check("LEVEL: the rest of the plate is inert", r.log.length === 0 && r.input.keys.length === 1, J(r.log));
  r.down(2, 2);
  check("LEVEL: off the plate backs out", J(r.log) === J([["back"]]), J(r.log));
  const lk = rig({ app: { screen: SCREEN.LEVEL, pactUnlocked: false, subT: 3.5 } }), GL = levelGeom(L0, false, false);
  lk.down(...c(GL.room[6]));
  check("LEVEL locked room 7: lockR 7, lockT = subT, the LEVEL row focused, nothing else", lk.app.lockR === 7 && lk.app.lockT === 3.5 && J(lk.log) === J([["levelFocus", 0, -1]]) && lk.app.level === 1, lk.app.lockR + "/" + lk.app.lockT + " " + J(lk.log));
}

// ---- HIGH SCORES: a tab is app.move(i - scoreHeat, 0); -1 confirms (= back); -2 inert ----
{
  const r = rig({ app: { screen: SCREEN.SCORES, scoreHeat: 2 } }), F = (x, y) => scoresHit(x, y, L0, false);
  const t1 = mid((x, y) => F(x, y) === 1), off = spot((x, y) => F(x, y) === -1), plate = spot((x, y) => F(x, y) === -2);
  r.down(t1.x, t1.y);
  check("SCORES tab 1: app.move(1 - scoreHeat, 0)", J(r.log) === J([["move", -1, 0]]) && r.input._intent.fire === false, J(r.log));
  check("SCORES: scoresHit(x, y, layout(cw, ch), touchLay(cv))", J(r.H.last("scoresHit").a) === J([t1.x, t1.y, L0, false]) && r.H.last("layout").a.length === 2);
  r.log.length = 0; r.down(plate.x, plate.y);
  check("SCORES: -2 (the table) is inert", r.log.length === 0, J(r.log));
  r.down(off.x, off.y);
  check("SCORES: -1 (off the plate) confirms", J(r.log) === J([["confirm"]]), J(r.log));
}

// ---- STATS: a foot label IS its key; C on a touch / pen pointer copies on pointerup ----
{
  const at = (k, arm) => spot((x, y) => statsHit(x, y, L0, arm) === k);
  const C = at("KeyC", false), T = at("KeyT", false), R = at("KeyR", false), CA = at("KeyC", true), none = spot((x, y) => y > 300 && statsHit(x, y, L0, false) === null);
  for (const pt of ["mouse", undefined]) {
    const r = rig({ app: { screen: SCREEN.STATS } });
    r.down(C.x, C.y, { pointerType: pt });
    const k0 = J(r.input.keys);
    r.canvas.fire("pointerup", {});
    check("STATS C with pointerType " + pt + ": KeyC on pointerdown, nothing more on pointerup", k0 === J(["KeyC"]) && J(r.input.keys) === J(["KeyC"]) && r.log.length === 0 && r.input._intent.fire === false, k0 + " " + J(r.input.keys));
  }
  for (const pt of ["touch", "pen"]) {
    const r = rig({ app: { screen: SCREEN.STATS } });
    r.down(C.x, C.y, { pointerType: pt });
    const k0 = r.input.keys.length;
    r.canvas.fire("pointerup", {});
    r.canvas.fire("pointerup", {});
    check("STATS C with a " + pt + " pointer: nothing on pointerdown, one KeyC on pointerup", k0 === 0 && J(r.input.keys) === J(["KeyC"]) && r.log.length === 0, k0 + " " + J(r.input.keys));
  }
  {
    const r = rig({ app: { screen: SCREEN.STATS, resetArm: true } });
    r.down(CA.x, CA.y, { pointerType: "touch" });
    const k0 = r.input.keys.length;
    r.canvas.fire("pointerup", {});
    check("STATS armed, C COPY on touch: deferred to pointerup too; statsHit gets app.resetArm", k0 === 0 && J(r.input.keys) === J(["KeyC"]) && r.H.last("statsHit").a[3] === true && r.H.last("layout").a.length === 2, J(r.input.keys));
  }
  for (const end of ["pointercancel", "pointerleave"]) {
    const r = rig({ app: { screen: SCREEN.STATS } });
    r.down(C.x, C.y, { pointerType: "touch" });
    r.canvas.fire(end, {});
    r.canvas.fire("pointerup", {});
    check("STATS touch C then " + end + ": a later pointerup copies nothing", r.input.keys.length === 0, J(r.input.keys));
  }
  {
    const r = rig({ app: { screen: SCREEN.STATS } });
    r.down(C.x, C.y, { pointerType: "touch" });
    r.app.screen = SCREEN.MENU;
    r.canvas.fire("pointerup", {});
    r.app.screen = SCREEN.STATS;
    r.canvas.fire("pointerup", {});
    check("STATS touch C, then the screen leaves STATS: that pointerup copies nothing and clears the flag", r.input.keys.length === 0, J(r.input.keys));
  }
  {
    const sh = mkEl(436, 946), r = rig({ app: { screen: SCREEN.STATS }, fit: { sh, box: () => null } });
    r.down(C.x, C.y, { pointerType: "touch", currentTarget: r.canvas });
    sh.fire("pointerup", {});
    const a = J(r.input.keys);
    r.down(C.x, C.y, { pointerType: "touch", currentTarget: r.canvas });
    sh.fire("pointerleave", {});
    r.canvas.fire("pointerup", {});
    check("STATS: one C flag for #c and #sh (a pointerup on either copies; a leave on either clears)", a === J(["KeyC"]) && J(r.input.keys) === J(["KeyC"]), a + " " + J(r.input.keys));
  }
  {
    const r = rig({ app: { screen: SCREEN.STATS } });
    r.down(T.x, T.y, { pointerType: "touch" });
    r.down(R.x, R.y, { pointerType: "mouse" });
    check("STATS T MEDALS / R RESET taps are KeyT / KeyR through input.onUiKey at once, on any pointer", J(r.input.keys) === J(["KeyT", "KeyR"]) && r.log.length === 0, J(r.input.keys));
    r.down(none.x, none.y);
    check("STATS idle off-label tap confirms (backs out)", J(r.log) === J([["confirm"]]), J(r.log));
    r.log.length = 0; r.app.resetArm = true;
    r.down(none.x, none.y);
    check("STATS armed off-label tap disarms and stays", r.app.resetArm === false && r.log.length === 0, J(r.log));
  }
}

// ---- read-only pages: any tap confirms (backs out) ----
for (const s of ["HOWTO", "ITEMS", "ENEMIES", "FLOOR"]) {
  const r = rig({ app: { screen: SCREEN[s] } });
  r.down(300, 260);
  check(s + ": any tap confirms, no hit test", J(r.log) === J([["confirm"]]) && r.H.calls.length === 0 && r.input._intent.fire === false, J(r.log));
}
{
  /* MEDALS (TROPHIES) is read-only too, but its head carries RECORDS' tab strip (v202 Task 2.2): the strip is its one hit test */
  const r = rig({ app: { screen: SCREEN.TROPHIES } });
  r.down(300, 260);
  check("TROPHIES: any tap off the tabs confirms; the only hit test is the tab strip's", J(r.log) === J([["confirm"]]) && r.H.calls.every((c) => ["dims", "layout", "touchLay", "recTabHit"].includes(c.f)) && r.H.of("recTabHit").length === 1 && r.input._intent.fire === false, J(r.log) + " " + J(r.H.calls.map((c) => c.f)));
}

// ---- RECORDS' tab strip: recTabHit(x, y, layout(cw, ch), page, touchLay(cv)); a tab is app.recTab(tab - page), never a key ----
for (const [scr, page] of [[SCREEN.SCORES, 0], [SCREEN.STATS, 1], [SCREEN.TROPHIES, 2]]) {
  for (let tab = 0; tab < 3; tab++) {
    const r = rig({ app: { screen: scr, recFocus: 1, resetArm: false } }), T = recTabsGeom(recPlate(L0, page, false), false)[tab];
    r.down(T.x + T.w / 2, T.y + T.h / 2);
    const h = r.H.last("recTabHit");
    check("RECORDS tab " + tab + " on page " + page + ": app.recTab(" + (tab - page) + "), no key, no confirm, fire swallowed", J(r.log) === J([["recTab", tab - page]]) && r.input.keys.length === 0 && r.input._intent.fire === false &&
      J(h.a) === J([T.x + T.w / 2, T.y + T.h / 2, L0, page, false]) && r.H.last("layout").a.length === 2, J(r.log));
  }
}
{
  const r = rig({ app: { screen: SCREEN.SCORES, scoreHeat: 0, recFocus: 0 } }), t2 = mid((x, y) => scoresHit(x, y, L0, false) === 2);
  r.down(t2.x, t2.y);
  check("SCORES: a difficulty tab tapped from the tab row focuses the body first, then app.move(2 - scoreHeat, 0)", r.app.recFocus === 1 && J(r.log) === J([["move", 2, 0]]), J(r.log));
}

// ---- #sh: a touch-portrait shell page is tapped on #sh's own box ----
{
  const g = shellGeo(393, 852), rect = { left: 7, top: 11, width: g.w * g.s, height: g.h * g.s };
  const sh = mkEl(Math.round(g.w * 3), Math.round(g.h * 3), rect, "p");
  const box = { width: g.w, height: g.h, logo: g.logo, ownerDocument: sh.ownerDocument, getBoundingClientRect: () => sh.getBoundingClientRect() };
  let boxOn = true;
  const cv = mkEl(600, 520, { left: 30, top: 300, width: 378, height: 327.6 }, "p");
  const r = rig({ canvas: cv, fit: { sh, box: () => (boxOn ? box : null) } });
  const LB = layout(g.w, g.h, g.logo), hit = mid((x, y) => menuHit(x, y, LB, ITEMS.length, true) === 2, g.w, g.h);
  const cx = rect.left + (hit.x * rect.width) / g.w, cy = rect.top + (hit.y * rect.height) / g.h;
  sh.fire("pointerdown", { clientX: cx, clientY: cy, currentTarget: sh });
  const d = r.H.last("dims"), m = r.H.last("menuHit"), lc = r.H.last("layout");
  check("#sh MENU: the tap maps through the box (its rect, its width / height / logo, touch) onto row 2", r.app.cursor === 2 && J(r.log) === J([["confirm"]]) && d.a[0] === box && r.H.last("touchLay").a[0] === box && m.a[4] === true && J(lc.a) === J([g.w, g.h, g.logo]) && Math.abs(m.a[0] - hit.x) < 1e-6 && Math.abs(m.a[1] - hit.y) < 1e-6, J(m.a.slice(0, 2)) + " " + J(lc.a));
  r.log.length = 0;
  cv.fire("pointerdown", { clientX: 30, clientY: 300, currentTarget: cv });
  check("#sh on, a tap whose currentTarget is #c maps through #c", r.H.last("dims").a[0] === cv);
  cv.fire("pointerdown", { clientX: 30, clientY: 300 });
  check("#sh on, an event with no currentTarget (!== #c) maps through the box", r.H.last("dims").a[0] === box);
  boxOn = false;
  sh.fire("pointerdown", { clientX: cx, clientY: cy, currentTarget: sh });
  check("#sh box off (fit.box() null): even a #sh tap maps through #c", r.H.last("dims").a[0] === cv);
}

// ---- live reads: the shell's wrapped methods, the key path and the look are read at the tap ----
{
  const r = rig({ app: { screen: SCREEN.MENU } }), on = mid((x, y) => menuHit(x, y, L0, ITEMS.length, false) === 1);
  const seen = [];
  r.app.confirm = () => { seen.push("wrapped confirm"); return true; };
  r.setKind("3d");
  r.down(on.x, on.y);
  check("live: a confirm wrapped after mount (main's audio cue wrapper) is the one called; dims gets the look set after mount", J(seen) === J(["wrapped confirm"]) && r.log.length === 0 && r.H.last("dims").a[1] === "3d", J(seen));
  const s = rig({ app: { screen: SCREEN.STATS } }), T = spot((x, y) => statsHit(x, y, L0, false) === "KeyT"), got = [];
  s.input.onUiKey = (k) => got.push(k);
  s.down(T.x, T.y);
  check("live: input.onUiKey set after mount is the one a label tap reaches", J(got) === J(["KeyT"]), J(got));
}

// ---- main.js keeps one call ----
{
  const M = readFileSync(new URL("../src/main.js", import.meta.url), "utf8"), P = readFileSync(new URL("../src/app/pointer.js", import.meta.url), "utf8"), ML = M.split("\n");
  check("main.js got shorter: " + ML.length + " lines (split on \\n) < 794, the count before the move", ML.length < 794, ML.length);
  check("main.js imports mountPointer from ./app/pointer.js and calls it once", /import \{ mountPointer \} from "\.\/app\/pointer\.js";/.test(M) && (M.match(/\bmountPointer\(/g) || []).length === 1);
  check("main.js keeps no tap router of its own (no statsC, no pointerup listener, no rect read)", !/statsC|"pointerup"|getBoundingClientRect/.test(M));
  check("pointer.js reads no src/render module (main hands the hit functions in)", !/["']\.\.\/render/.test(P));
}

console.log("\n  POINTER RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
