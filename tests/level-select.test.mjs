// LEVEL SELECT navigation (UI upgrade v202 Task 2.3; design record §4: "LEVEL SELECT: one path"; owner: LEVEL SELECT was "too
// much details"). ↑↓ walk the rows LEVEL, DIFFICULTY, GAME SPEED, MODIFIERS (in the walk only once modifiers are offered), START;
// ←→ change the focused row; confirm starts the run and, on MODIFIERS, opens the inline list (app.modOpen, no SCREEN). The
// machine's contract, the focus mark drawn from levelGeom (the geometry taps use), the foot per device, and taps through the real
// mountPointer on desktop #c, a landscape #sh box and a portrait #sh box. The key and controller matrix through the real
// createGame lives in tests/keys.test.mjs.
import { ITEMS, SCREEN, LEVEL_ROWS, FEELS, createMenuApp } from "../src/app/menuapp.js";
import { PACT } from "../src/core/pact.js";
import { mountPointer } from "../src/app/pointer.js";
import { shellGeo } from "../src/app/fit.js";
import { overlayBox, pauseHit, touchLay } from "../src/render/scenes.js";
import { controlsHit, dims, drawShell } from "../src/render/shellview.js";
import * as md from "../src/render/menudraw.js";
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
const DT = 1 / 60;
const R = (n) => LEVEL_ROWS.indexOf(n);
const ROW = { LEVEL: 0, DIFFICULTY: 1, SPEED: 2, MODS: 3, START: 4 };
const MOD_BITS = [PACT.LAST, PACT.BARE, PACT.THIN, PACT.SHRINK];
const top = (fs) => fs.reduce((a, f) => (!a || FEELS.indexOf(f) < FEELS.indexOf(a) ? f : a), ""); // the one ranked feel a press leaves

/* ---- the rows ---- */
check("LEVEL_ROWS: LEVEL, DIFFICULTY, GAME SPEED, MODIFIERS, START, frozen; no SCREEN is added",
  J(LEVEL_ROWS) === J(["LEVEL", "DIFFICULTY", "GAME SPEED", "MODIFIERS", "START"]) && Object.isFrozen(LEVEL_ROWS) && Object.keys(SCREEN).length === 17 && SCREEN.CONTROLS === 16, J(LEVEL_ROWS));
check("ROW indices match LEVEL_ROWS", R("LEVEL") === ROW.LEVEL && R("DIFFICULTY") === ROW.DIFFICULTY && R("GAME SPEED") === ROW.SPEED && R("MODIFIERS") === ROW.MODS && R("START") === ROW.START);

/* ---- the machine ---- */
const mk = (o = {}) => {
  const got = { started: [], paces: [], times: [], feels: [] };
  const a = createMenuApp({ onStart: (x) => got.started.push(x), onPaceChange: (p) => got.paces.push(p), onTimeAttack: (v) => got.times.push(v), ...o });
  const f0 = a._feel.bind(a);
  a._feel = (n) => { got.feels.push(n); return f0(n); };
  a.got = got;
  a.screen = SCREEN.MENU;
  return a;
};
const at = (o) => { const a = mk(o); a.cursor = ITEMS.indexOf("LEVEL SELECT"); a.confirm(); a.got.feels.length = 0; return a; };
const clearLog = (a) => { a.got.feels.length = 0; a.got.paces.length = 0; a.got.times.length = 0; };
const frames = (a, n, held) => { for (let i = 0; i < n; i++) a.update(DT, { input: { up: false, down: false, left: false, right: false, ...held }, confirmHeld: false }); };
const walkTo = (a, row) => { while (a.levelRow < row && a.move(1, 1)); while (a.levelRow > row && a.move(-1, 1)); };
{
  const a = mk({ pactUnlocked: true });
  a.cursor = ITEMS.indexOf("LEVEL SELECT");
  a.confirm();
  check("MENU LEVEL SELECT + confirm: LEVEL SELECT, the LEVEL row focused, the list shut, no list cursor; feel enter",
    a.screen === SCREEN.LEVEL && a.levelRow === ROW.LEVEL && a.modOpen === false && a.modeCur === -1 && top(a.got.feels) === "enter", J([a.screen, a.levelRow, a.modOpen, a.modeCur, a.got.feels]));
  walkTo(a, ROW.MODS); a.confirm();
  check("confirm on MODIFIERS opens the list on its first entry (ONE LIFE); the row stays MODIFIERS; no run", a.modOpen === true && a.modeCur === 0 && a.levelRow === ROW.MODS && a.screen === SCREEN.LEVEL && a.got.started.length === 0);
  a.back();
  check("back with the list open closes it, onto the MODIFIERS row; still LEVEL SELECT", a.modOpen === false && a.modeCur === -1 && a.levelRow === ROW.MODS && a.screen === SCREEN.LEVEL);
  a.back();
  check("back with the list shut leaves for MENU with the cursor on LEVEL SELECT", a.screen === SCREEN.MENU && a.cursor === ITEMS.indexOf("LEVEL SELECT"));
  a.confirm();
  check("every entry lands on LEVEL with the list shut (focus reset)", a.screen === SCREEN.LEVEL && a.levelRow === ROW.LEVEL && a.modOpen === false && a.modeCur === -1);
  const d = createMenuApp();
  check("a fresh app's LEVEL SELECT state: the LEVEL row, the list shut", d.levelRow === 0 && d.modOpen === false);
}
for (const U of [false, true]) {
  const a = at({ pactUnlocked: U }), walk = U ? [1, 2, 3, 4] : [1, 2, 4], seen = [], rets = [];
  a.heat = 1; a.level = 3; a.pace = 0;
  for (let i = 0; i < 5; i++) { a.got.feels.length = 0; rets.push(a.move(1, 1)); seen.push(a.levelRow + ":" + top(a.got.feels)); }
  check(`↓ walks the rows (${U ? "modifiers offered" : "no modifiers"}): ${walk.map((r) => LEVEL_ROWS[r]).join(", ")}, clamped at START, a move feel per real step, silent at the edge`,
    J(seen) === J([...walk.map((r) => r + ":move"), ...Array(5 - walk.length).fill("4:")]) && J(rets) === J([...walk.map(() => true), ...Array(5 - walk.length).fill(false)]), J(seen));
  const back = [];
  for (let i = 0; i < 5; i++) { a.got.feels.length = 0; a.move(-1, 1); back.push(a.levelRow + ":" + top(a.got.feels)); }
  const rev = [...walk].reverse().slice(1).concat([0]);
  check(`↑ walks back to LEVEL and stays (${U ? "offered" : "not offered"})`, J(back) === J([...rev.map((r) => r + ":move"), ...Array(5 - rev.length).fill("0:")]), J(back));
  check(`↑ / ↓ never change the difficulty, the level or the speed (${U ? "offered" : "not offered"})`, a.heat === 1 && a.level === 3 && a.pace === 0 && a.got.paces.length === 0);
}
{
  const a = at({ pactUnlocked: false });
  a.pactUnlocked = true; // the first CLEAR can land while the page is open in a test; the walk reads it live
  walkTo(a, ROW.START); const r = [];
  for (let i = 0; i < 4; i++) { a.move(-1, 1); r.push(a.levelRow); }
  check("pactUnlocked flipped after entry: the walk includes MODIFIERS at once (one fixed table, never a filtered list)", J(r) === J([3, 2, 1, 0]), J(r));
}
{
  const a = at({ pactUnlocked: true });
  a.level = 3; a.heat = 1; a.pace = 0;
  const step = (row, d) => { walkTo(a, row); clearLog(a); const r = a.move(d, 0); return [r, top(a.got.feels)]; };
  let s = step(ROW.LEVEL, 1);
  check("→ on LEVEL: the next level, feel move", s[0] === true && a.level === 4 && s[1] === "move", J(s));
  s = step(ROW.LEVEL, -1);
  check("← on LEVEL: the previous level", s[0] === true && a.level === 3);
  s = step(ROW.DIFFICULTY, 1);
  check("→ on DIFFICULTY: HARD -> EXPERT, feel move", s[0] === true && a.heat === 2 && s[1] === "move" && a.level === 3, J(s));
  s = step(ROW.DIFFICULTY, 1);
  check("→ on DIFFICULTY at EXPERT: clamped, false, no feel", s[0] === false && a.heat === 2 && s[1] === "", J(s));
  step(ROW.DIFFICULTY, -1); s = step(ROW.DIFFICULTY, -1);
  check("← on DIFFICULTY walks down to NORMAL", s[0] === true && a.heat === 0);
  s = step(ROW.DIFFICULTY, -1);
  check("← on DIFFICULTY at NORMAL: clamped, silent", s[0] === false && a.heat === 0 && s[1] === "");
  s = step(ROW.SPEED, -1);
  check("← on GAME SPEED: SLOW, saved through onPaceChange, feel move (a value step, ruling 8)", s[0] === true && a.pace === -1 && J(a.got.paces) === "[-1]" && s[1] === "move", J([s, a.got.paces]));
  s = step(ROW.SPEED, -1);
  check("← on GAME SPEED at SLOW: clamped, nothing saved, silent", s[0] === false && a.pace === -1 && a.got.paces.length === 0 && s[1] === "");
  for (const row of [ROW.MODS, ROW.START]) for (const d of [-1, 1]) {
    const before = J([a.level, a.heat, a.pace, a.pact, a.timeAttack, a.modOpen]);
    s = step(row, d);
    check(`${d < 0 ? "←" : "→"} on ${LEVEL_ROWS[row]}: nothing, false, no feel`, s[0] === false && s[1] === "" && J([a.level, a.heat, a.pace, a.pact, a.timeAttack, a.modOpen]) === before && a.levelRow === row);
  }
}
{
  /* the lock: past the last open level a locked level is refused, never selected; its card flashes like a tap on its tile */
  const a = at({ pactUnlocked: false });
  a.level = 5; a.subT = 2.5;
  const r = a.move(1, 0);
  check("→ at level 5 while locked: false, level stays 5, the card flashes level 6 (lockR 6, lockT = subT), feel deny, no move feel",
    r === false && a.level === 5 && a.lockR === 6 && a.lockT === 2.5 && J(a.got.feels) === J(["deny"]), J([r, a.level, a.lockR, a.lockT, a.got.feels]));
  a.level = 4; clearLog(a);
  check("→ at level 4 while locked: level 5, feel move", a.move(1, 0) === true && a.level === 5 && top(a.got.feels) === "move");
  const u = at({ pactUnlocked: true });
  u.level = 5;
  check("→ at level 5 once unlocked: level 6, no flash", u.move(1, 0) === true && u.level === 6 && u.lockR === undefined);
  u.level = 8; clearLog(u);
  check("→ at level 8: clamped, silent, no flash (nothing past 8)", u.move(1, 0) === false && u.level === 8 && u.lockR === undefined && u.got.feels.length === 0);
  const h = at({ pactUnlocked: false });
  h.level = 3; frames(h, 120, { right: true });
  const deny = h.got.feels.filter((f) => f === "deny").length, moves = h.got.feels.filter((f) => f === "move").length;
  check("held → from level 3 while locked: 4, 5, then one flash of level 6 and silence for the rest of the hold", h.level === 5 && moves === 2 && deny === 1 && h.lockR === 6, J([h.level, h.got.feels]));
  frames(h, 3, {}); frames(h, 60, { right: true });
  check("a new hold at 5 flashes once more", h.level === 5 && h.got.feels.filter((f) => f === "deny").length === 2, J(h.got.feels));
  const k = at({ pactUnlocked: false });
  k.level = 5; k.key("ArrowRight"); frames(k, 3, { right: true }); frames(k, 2, {});
  check("one key press at 5 (the key tap and its held axis in the same frames): one flash, not two", k.got.feels.filter((f) => f === "deny").length === 1 && k.level === 5, J(k.got.feels));
  k.key("ArrowRight"); frames(k, 2, {});
  check("the next press flashes again", k.got.feels.filter((f) => f === "deny").length === 2);
  const t = at({ pactUnlocked: false });
  t.level = 3; t.key("ArrowRight"); t.key("ArrowRight"); t.key("ArrowRight"); t.key("ArrowRight");
  check("keys can never select a locked level: level stays 5", t.level === 5 && t.lockR === 6);
  t.confirm();
  check("confirm after the flash starts the level the page selects (5), never the flashed one", J(t.got.started) === J([{ level: 5, heat: 0, pact: 0, pace: 0 }]), J(t.got.started));
}
{
  /* confirm per row: LEVEL, DIFFICULTY, GAME SPEED and START start the run the page shows; MODIFIERS opens the list */
  for (const row of [ROW.LEVEL, ROW.DIFFICULTY, ROW.SPEED, ROW.START]) {
    const a = at({ pactUnlocked: true, pact: PACT.LAST | PACT.THIN });
    a.level = 4; a.heat = 2; a.pace = 1; a.timeAttack = true;
    walkTo(a, row); clearLog(a);
    const r = a.confirm();
    check(`confirm on ${LEVEL_ROWS[row]} starts exactly the run on screen (level 4, EXPERT, FAST, ONE LIFE + FEWER ITEMS), feel launch`,
      a.screen === SCREEN.GAME && J(a.got.started) === J([{ level: 4, heat: 2, pact: PACT.LAST | PACT.THIN, pace: 1 }]) && J(r) === J(a.got.started[0]) && top(a.got.feels) === "launch", J([a.got.started, a.got.feels]));
  }
  const a = at({ pactUnlocked: true });
  walkTo(a, ROW.MODS); clearLog(a);
  check("confirm on MODIFIERS opens the list: no run, feel enter", a.confirm() === true && a.modOpen === true && a.screen === SCREEN.LEVEL && a.got.started.length === 0 && top(a.got.feels) === "enter");
}
{
  /* the inline list */
  const a = at({ pactUnlocked: true });
  walkTo(a, ROW.MODS); a.confirm(); clearLog(a);
  check("in the list ↑ at the first entry stays (no auto-close), silent", a.move(-1, 1) === false && a.modeCur === 0 && a.modOpen === true && a.got.feels.length === 0);
  const cur = [];
  for (let i = 0; i < 5; i++) { a.move(1, 1); cur.push(a.modeCur); }
  check("in the list ↓ walks ONE LIFE, NO FLOOR ITEMS, FEWER ITEMS, SHRINK, TIME TRIAL and clamps; the row stays MODIFIERS", J(cur) === J([1, 2, 3, 4, 4]) && a.levelRow === ROW.MODS, J(cur));
  for (const d of [-1, 1]) {
    const s0 = J([a.level, a.heat, a.pace, a.pact, a.timeAttack, a.modeCur]); clearLog(a);
    check(`in the list ${d < 0 ? "←" : "→"} does nothing`, a.move(d, 0) === false && J([a.level, a.heat, a.pace, a.pact, a.timeAttack, a.modeCur]) === s0 && a.got.feels.length === 0);
  }
  for (let i = 4; i >= 0; i--) {
    a.modeCur = i; clearLog(a);
    const p0 = a.pact, t0 = a.timeAttack;
    a.confirm();
    const ok = i < 4 ? a.pact === (p0 ^ MOD_BITS[i]) && a.timeAttack === t0 : a.timeAttack === !t0 && J(a.got.times) === "[true]" && a.pact === p0;
    check(`confirm in the list toggles entry ${i} (${i < 4 ? "bit " + MOD_BITS[i] : "TIME TRIAL, through onTimeAttack"}), the list stays open on it, feel confirm`, ok && a.modOpen && a.modeCur === i && a.screen === SCREEN.LEVEL && top(a.got.feels) === "confirm", J([a.pact, a.timeAttack, a.got.feels]));
  }
  a.modeCur = 0; a.confirm();
  check("confirm again toggles ONE LIFE back off", (a.pact & PACT.LAST) === 0);
  clearLog(a);
  a.key("Escape");
  check("Escape closes the list (feel back), onto MODIFIERS", !a.modOpen && a.levelRow === ROW.MODS && a.screen === SCREEN.LEVEL && top(a.got.feels) === "back");
  a.confirm(); a.key("Backspace");
  check("Backspace closes it too", !a.modOpen && a.screen === SCREEN.LEVEL);
  a.confirm(); a.move(1, 1); a.move(1, 1); a.back(); a.confirm();
  check("re-opening lands on the first entry again", a.modOpen && a.modeCur === 0);
  a.back(); clearLog(a); a.key("Escape");
  check("then Escape leaves for MENU on LEVEL SELECT, feel back", a.screen === SCREEN.MENU && a.cursor === ITEMS.indexOf("LEVEL SELECT") && top(a.got.feels) === "back");
}
{
  /* shortcuts from any row, the list open or shut: [ ] pace, 1–5 modifiers; they never move the focus */
  for (const st of [ROW.LEVEL, ROW.DIFFICULTY, ROW.SPEED, ROW.MODS, ROW.START, "open"]) {
    const a = at({ pactUnlocked: true });
    if (st === "open") { walkTo(a, ROW.MODS); a.confirm(); a.move(1, 1); } else walkTo(a, st);
    const f0 = J([a.levelRow, a.modOpen, a.modeCur]);
    a.key("BracketRight"); a.key("Digit2"); a.key("Digit5"); a.key("BracketLeft"); a.key("BracketLeft");
    check(`shortcuts on ${st === "open" ? "the open list" : LEVEL_ROWS[st]}: ] [ [ step the speed, 2 toggles NO FLOOR ITEMS, 5 TIME TRIAL; the focus does not move`,
      a.pace === -1 && a.pact === PACT.BARE && a.timeAttack === true && J([a.levelRow, a.modOpen, a.modeCur]) === f0, J([a.pace, a.pact, a.timeAttack, a.levelRow, a.modOpen, a.modeCur]));
  }
  const l = at({ pactUnlocked: false });
  for (const k of ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"]) l.key(k);
  check("no modifiers offered: 1–5 do nothing", l.pact === 0 && l.timeAttack === false && l.levelRow === 0);
}
{
  /* levelFocus: the tap's row (pointer.js) */
  const a = at({ pactUnlocked: true });
  check("levelFocus(DIFFICULTY): the row, no feel", a.levelFocus(ROW.DIFFICULTY) === true && a.levelRow === ROW.DIFFICULTY && a.got.feels.length === 0);
  walkTo(a, ROW.MODS); a.confirm();
  check("levelFocus(MODIFIERS, 3) with the list open moves its cursor there", a.levelFocus(ROW.MODS, 3) === true && a.modOpen && a.modeCur === 3);
  check("levelFocus(LEVEL) closes the list", a.levelFocus(ROW.LEVEL) === true && !a.modOpen && a.modeCur === -1 && a.levelRow === ROW.LEVEL);
  check("levelFocus(MODIFIERS, 2) with the list shut: the row only, the list stays shut", a.levelFocus(ROW.MODS, 2) === true && !a.modOpen && a.levelRow === ROW.MODS);
  const l = at({ pactUnlocked: false });
  check("levelFocus(MODIFIERS) before modifiers are offered: refused", l.levelFocus(ROW.MODS) === false && l.levelRow === ROW.LEVEL);
  const m = mk();
  check("levelFocus off LEVEL SELECT: refused", m.levelFocus(ROW.START) === false && m.levelRow === 0);
  const t = at({ pactUnlocked: true });
  walkTo(t, ROW.MODS); t.confirm();
  check("a pad's TRIGGER walks the open list's cursor (one cursor over the chips)", t.modeWalk(1) === true && t.modeCur === 1);
}

/* ---- geometry: the focus rects (draw = the mark, the same levelGeom taps read) ---- */
const sgP = shellGeo(393, 852), sgL = shellGeo(1024, 768, 600, 520, "l");
const BOXES = [["600x520 keys", md.layout(600, 520), false], ["600x520 touch", md.layout(600, 520), true], ["iso 608x352", md.layout(608, 352), false], ["iso touch", md.layout(608, 352), true],
  ["1366x768", md.layout(1366, 768, 300), false], ["landscape #sh " + sgL.w + "x" + sgL.h, md.layout(sgL.w, sgL.h, sgL.logo), true], ["portrait #sh " + sgP.w + "x" + sgP.h, md.layout(sgP.w, sgP.h, sgP.logo), true]];
const ring = (r) => ({ x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 });
const span = (a, b) => ({ x: a.x, y: a.y, w: b.x + b.w - a.x, h: a.h });
const r3 = (q) => q && { x: +q.x.toFixed(3), y: +q.y.toFixed(3), w: +q.w.toFixed(3), h: +q.h.toFixed(3) };
const inside = (r, S) => r.x >= S.x && r.y >= S.y && r.x + r.w <= S.x + S.w && r.y + r.h <= S.y + S.h;
const meets = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
for (const [nm, L, T] of BOXES) for (const U of [false, true]) {
  const G = md.levelGeom(L, U, T), S = G.S, rows = G.rows;
  check(`rows (${nm}${U ? ", offered" : ""}): five, MODIFIERS null until offered`, Array.isArray(rows) && rows.length === LEVEL_ROWS.length && (rows[ROW.MODS] === null) === !U);
  const want = [ring(G.grid), ring(span(G.heatCap, G.heat[2])), ring(span(G.paceCap, G.pace[2])), U ? ring(span(G.modeCap, G.mode[4])) : null, { x: G.start.x + 8, y: G.start.y + 2, w: G.start.w - 16, h: G.start.h - 4 }];
  check(`rows (${nm}${U ? ", offered" : ""}): the level grid, the DIFFICULTY and GAME SPEED groups and the MODIFIERS group 2 px out, START's painted band`, J(rows.map(r3)) === J(want.map(r3)), J(rows));
  const live = rows.filter(Boolean), stroke = (r) => ({ x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 }); // a 2 px ring paints 1 px each side of its rect
  const content = [G.room.concat([G.grid]), [G.heatCap, ...G.heat], [G.paceCap, ...G.pace], U ? [G.modeCap, ...G.mode] : [], [rows[4]]];
  check(`rows (${nm}${U ? ", offered" : ""}): every row's mark inside the plate, and a ring's paint clears every other row's tiles, segments, chips and START`,
    live.every((r) => inside(stroke(r), S)) && rows.every((r, i) => !r || i === 4 || content.every((cs, j) => j === i || cs.every((q) => !meets(stroke(r), q)))), J(live));
  check(`rows (${nm}${U ? ", offered" : ""}): each row holds what it marks (tiles, segments, chips)`, G.room.every((r) => inside(r, rows[0])) && G.heat.every((r) => inside(r, rows[1])) && G.pace.every((r) => inside(r, rows[2])) && (!U || G.mode.every((r) => inside(r, rows[3]))));
  if (U) check(`chip rings (${nm}): each inside the plate, none meets a neighbour chip`, G.mode.every((r, i) => inside(ring(r), S) && G.mode.every((q, j) => i === j || !meets(ring(r), q))));
  for (let row = 0; row < 5; row++) for (const open of U && row === ROW.MODS ? [false, true] : [false]) for (const cur of open ? [0, 1, 2, 3, 4] : [-1]) {
    const m = md.levelMark(G, row, open, cur);
    check(`levelMark (${nm}${U ? ", offered" : ""}) row ${LEVEL_ROWS[row]}${open ? " list " + cur : ""}`, J(r3(m)) === J(r3(open ? ring(G.mode[cur]) : rows[row])), J(m));
  }
}

/* ---- the page draws the mark from levelGeom ---- */
const TEXT = "#dfe7f5", BAND = "rgba(55,240,208,0.12)";
const drawLv = (L, T, U, info, o = {}) => { const r = rec({ widthK: 0.648 }); md.drawLevelSelect(r.ctx, o.level || 3, L, 2, o.heat == null ? 1 : o.heat, o.pact || 0, U, 0, false, T, { kind: "2d", best: [], ...info }); return r; };
const rings = (r) => r.paints.filter((p) => p.op === "strokeRect" && p.style === TEXT && p.lw === 2).map((p) => p.box);
const bands = (r, rect) => r.paints.filter((p) => p.op === "fillRect" && p.style === BAND && J(p.box) === J(r3(rect)));
for (const [nm, L, T] of BOXES) for (const U of [false, true]) {
  const G = md.levelGeom(L, U, T);
  for (const row of U ? [0, 1, 2, 3, 4] : [0, 1, 2, 4]) {
    const r = drawLv(L, T, U, { row }), rg = rings(r), st = bands(r, G.rows[ROW.START]);
    if (row === ROW.START) check(`draw (${nm}${U ? ", offered" : ""}) START focused: START painted selected (its band = rows[4]), no ring`, st.length === 1 && rg.length === 0, J([st.length, rg]));
    else check(`draw (${nm}${U ? ", offered" : ""}) ${LEVEL_ROWS[row]} focused: one ring, = rows[${row}]; START not painted selected`, rg.length === 1 && J(rg[0]) === J(r3(G.rows[row])) && st.length === 0, J([rg, r3(G.rows[row]), st.length]));
  }
  if (U) for (let cur = 0; cur < 5; cur++) {
    const r = drawLv(L, T, U, { row: ROW.MODS, open: true, cur }), rg = rings(r);
    check(`draw (${nm}) the open list on entry ${cur}: one ring, on that chip (levelMark), no row ring, START not selected`, rg.length === 1 && J(rg[0]) === J(r3(md.levelMark(G, ROW.MODS, true, cur))) && bands(r, G.rows[ROW.START]).length === 0, J(rg));
  }
}
{
  const L = md.layout(600, 520), G = md.levelGeom(L, true, false);
  const r = drawLv(L, false, true, {});
  check("draw with no row in info: the LEVEL row is focused (the app's default)", J(rings(r)) === J([r3(G.rows[0])]), J(rings(r)));
  setHints(wordsOf("pad", DEF_CONTROLS)); md.setModeFocus(() => 2);
  const p = drawLv(L, false, true, { row: ROW.DIFFICULTY });
  md.setModeFocus(null); setHints(null);
  check("a controller's TRIGGER cursor with the list shut keeps today's chip ring beside the row's ring", J(rings(p)) === J([r3(G.rows[1]), r3(ring(G.mode[2]))].sort((a, b) => a.y - b.y)) || J(rings(p)) === J([r3(ring(G.mode[2])), r3(G.rows[1])]), J(rings(p)));
}

/* ---- the real path: app.levelRow / modOpen / modeCur reach the painter through shellview's infoOf (drawShell) ---- */
{
  const box = (w, h, lay) => ({ width: w, height: h, ownerDocument: { body: { getAttribute: (k) => (k === "data-lay" ? lay : null) } }, getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }) });
  for (const [nm, w, h, lay] of [["600x520 d", 600, 520, "d"], ["portrait #sh " + sgP.w + "x" + sgP.h, sgP.w, sgP.h, "p"]]) {
    const a = createMenuApp({ pactUnlocked: true, settings: { fpm: 0 } }), cv = box(w, h, lay), G = md.levelGeom(md.layout(w, h), true, lay !== "d");
    a.screen = SCREEN.LEVEL; a.heat = 1;
    const shot = () => { const r = rec({ widthK: 0.648 }); drawShell(r.ctx, a, { state: "PLAY", time: 1, level: 1 }, cv, "2d", () => [], () => 0, () => ({})); return r; };
    for (const row of [0, 1, 2, 3]) {
      a.levelRow = row;
      const r = shot();
      check(`drawShell (${nm}) app.levelRow ${row}: one ring, = levelGeom rows[${row}], START not selected`, J(rings(r)) === J([r3(G.rows[row])]) && bands(r, G.rows[ROW.START]).length === 0, J(rings(r)));
    }
    a.levelRow = ROW.START;
    let r = shot();
    check(`drawShell (${nm}) app.levelRow START: no ring, START's band = rows[4]`, rings(r).length === 0 && bands(r, G.rows[ROW.START]).length === 1, J(rings(r)));
    a.levelRow = ROW.MODS; a.modOpen = true;
    for (let cur = 0; cur < 5; cur++) {
      a.modeCur = cur;
      r = shot();
      check(`drawShell (${nm}) app.modOpen, app.modeCur ${cur}: one ring, on that chip (levelMark)`, J(rings(r)) === J([r3(md.levelMark(G, ROW.MODS, true, cur))]), J(rings(r)));
    }
  }
}

/* ---- the foot follows the focus and the device; no hint names a key that does nothing there ---- */
const footOf = (r, L, T, U) => { const S = md.levelGeom(L, U, T).S; return (r.texts.find((t) => Math.abs(t.y - S.footY) < 0.01 && t.x === S.mid) || {}).s; };
{
  const L = md.layout(600, 520);
  const KEY = ["↑↓ ROW · ←→ ADJUST · ENTER START · ESC BACK", "↑↓ ROW · ←→ ADJUST · ENTER START · ESC BACK", "↑↓ ROW · ←→ ADJUST · ENTER START · ESC BACK", "↑↓ ROW · ENTER OPEN · ESC BACK", "↑↓ ROW · ENTER START · ESC BACK"];
  const PADW = KEY.map((s) => s.replace("ENTER", "SOUTH").replace("ESC", "EAST"));
  for (const [dev, words, want, list] of [["keys", null, KEY, "↑↓ PICK · ENTER TOGGLE · ESC CLOSE"], ["controller", wordsOf("pad", DEF_CONTROLS), PADW, "↑↓ PICK · SOUTH TOGGLE · EAST CLOSE"]]) {
    setHints(words);
    for (let row = 0; row < 5; row++) {
      const f = footOf(drawLv(L, false, true, { row }), L, false, true);
      check(`foot (${dev}) on ${LEVEL_ROWS[row]}: "${want[row]}"`, f === want[row] && md.levelFoot(row, false) === want[row], f);
    }
    const f = footOf(drawLv(L, false, true, { row: ROW.MODS, open: true, cur: 1 }), L, false, true);
    check(`foot (${dev}) in the open list: "${list}"`, f === list && md.levelFoot(ROW.MODS, true) === list, f);
    for (const T of [true]) { const t = footOf(drawLv(L, T, true, { row: 1 }), L, T, true); check(`foot (${dev}) on a touch layout: ${dev === "keys" ? "the tap rule" : "the controller's words"}`, t === (dev === "keys" ? md.LEVEL_TAP : PADW[1]), t); }
    setHints(null);
  }
  check("no foot names ←→ on MODIFIERS, START or in the open list", ![md.levelFoot(3, false), md.levelFoot(4, false), md.levelFoot(3, true)].some((s) => s.includes("←→")));
  /* caps name only keys that work from any row ([ ] and 1–5); the arrows live in the foot alone */
  for (let row = 0; row < 5; row++) {
    const r = drawLv(L, false, true, { row }), S = md.levelGeom(L, true, false).S, notFoot = r.texts.filter((t) => !(Math.abs(t.y - S.footY) < 0.01)).map((t) => t.s);
    check(`no arrow keycap off the foot (row ${LEVEL_ROWS[row]}): the LEVEL caption is the word alone, DIFFICULTY's cap has no key`, !notFoot.some((s) => /[←→↑↓]/.test(s)) && notFoot.includes("LEVEL") && notFoot.includes("[ ]") && notFoot.includes("1–5"), notFoot.filter((s) => /[←→↑↓]|^LEVEL/.test(s)).join("|"));
  }
}

/* ---- taps through the real mountPointer (main's hit bag), on #c and on #sh boxes ---- */
function mkEl(w, h, rect, lay) {
  const Lr = {};
  return { width: w, height: h, style: {}, getBoundingClientRect: () => rect, ownerDocument: { body: { getAttribute: (k) => (k === "data-lay" ? lay : null) } },
    addEventListener(ty, fn) { (Lr[ty] = Lr[ty] || []).push(fn); }, fire(ty, ev) { (Lr[ty] || []).slice().forEach((fn) => fn(ev || {})); } };
}
const HIT = { overlayBox, pauseHit, touchLay, controlsHit, dims, menuHit: md.menuHit, settingsHit: md.settingsHit, graphicsHit: md.graphicsHit, guideHit: md.guideHit, levelHit: md.levelHit, scoresHit: md.scoresHit, statsHit: md.statsHit, recTabHit: md.recTabHit, layout: md.layout };
function tapRig(kind, o = {}) {
  const app = mk(o), cues = [], world = { state: "PLAY", time: 0, level: 1 };
  for (const k of ["move", "adjustPace"]) { const f = app[k].bind(app); app[k] = (...a) => { const r = f(...a); if (r) cues.push("uiMove"); return r; }; } // main's cue wrappers
  const b0 = app.back.bind(app); app.back = () => { const r = b0(); if (r) cues.push("uiBack"); return r; };
  const c0 = app.confirm.bind(app); app.confirm = () => { const r = c0(); if (r) cues.push("uiSel"); return r; };
  const input = { _intent: { fire: false }, onUiKey: (c) => app.key(c) };
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
  const tapAt = (x, y, pointerType = "mouse") => { const r = surf.getBoundingClientRect(); el.fire("pointerdown", { clientX: r.left + (x * r.width) / surf.width, clientY: r.top + (y * r.height) / surf.height, currentTarget: el, pointerType }); el.fire("pointerup", {}); };
  const ctr = (q) => tapAt(q.x + q.w / 2, q.y + q.h / 2);
  app.cursor = ITEMS.indexOf("LEVEL SELECT"); c0();
  return { app, cues, tapAt, ctr, surf, G: () => md.levelGeom(md.layout(surf.width, surf.height), app.pactUnlocked, kind !== "d") };
}
const prep = (t, row, open) => { const a = t.app; a.level = 2; a.heat = 1; a.pace = 0; a.pact = 0; a.timeAttack = false; a.subT = 1.75; a.levelFocus(row); if (open) { a.levelFocus(ROW.MODS); a.confirm(); } t.cues.length = 0; a.got.feels.length = 0; a.got.started.length = 0; };
/* every tap check compares the whole state: screen, focused row, the list and its cursor, level, difficulty, speed, the modifier
   mask, TIME TRIAL, the run started (with what) and the cues; base level 2, HARD, NORMAL speed, nothing on */
const stOf = (t) => { const a = t.app; return { scr: a.screen, row: a.levelRow, open: a.modOpen, cur: a.modeCur, level: a.level, heat: a.heat, pace: a.pace, pact: a.pact | 0, time: a.timeAttack, run: a.got.started[0] || null, cues: t.cues.join() }; };
const want = (o) => ({ scr: SCREEN.LEVEL, row: 0, open: false, cur: -1, level: 2, heat: 1, pace: 0, pact: 0, time: false, run: null, cues: "", ...o });
const same = (t, w) => J(stOf(t)) === J(w);
for (const kind of ["d", "l", "p"]) for (const U of [false, true]) {
  const tag = `tap (${kind}${U ? ", offered" : ""})`;
  for (let i = 0; i < 8; i++) {
    const t = tapRig(kind, { pactUnlocked: U }), a = t.app;
    prep(t, ROW.START);
    t.ctr(t.G().room[i]);
    const open = i < (U ? 8 : 5), set = i + 1 === 2;
    if (open) check(`${tag}: level tile ${i + 1} selects it, the LEVEL row focused, ${set ? "silent (already set)" : "one uiMove"}`, same(t, want({ level: i + 1, cues: set ? "" : "uiMove" })), J(stOf(t)));
    else check(`${tag}: locked tile ${i + 1} only flashes its card (lockR ${i + 1}, lockT = subT), the LEVEL row focused, level unchanged, no cue`, same(t, want({})) && a.lockR === i + 1 && a.lockT === 1.75, J([stOf(t), a.lockR, a.lockT]));
  }
  for (let i = 0; i < 3; i++) {
    const t = tapRig(kind, { pactUnlocked: U });
    prep(t, ROW.START); t.ctr(t.G().heat[i]);
    check(`${tag}: DIFFICULTY segment ${i} sets it, the DIFFICULTY row focused, ${i === 1 ? "silent" : "one uiMove"}`, same(t, want({ row: ROW.DIFFICULTY, heat: i, cues: i === 1 ? "" : "uiMove" })), J(stOf(t)));
    const p = tapRig(kind, { pactUnlocked: U });
    prep(p, ROW.LEVEL); p.ctr(p.G().pace[i]);
    check(`${tag}: GAME SPEED segment ${i} sets it (saved), the GAME SPEED row focused, ${i === 1 ? "silent" : "one uiMove"}`, same(p, want({ row: ROW.SPEED, pace: i - 1, cues: i === 1 ? "" : "uiMove" })) && J(p.app.got.paces) === (i === 1 ? "[]" : "[" + (i - 1) + "]"), J(stOf(p)));
  }
  if (U) for (let i = 0; i < 5; i++) for (const open of [false, true]) {
    const t = tapRig(kind, { pactUnlocked: U });
    prep(t, open ? ROW.MODS : ROW.DIFFICULTY, open);
    t.ctr(t.G().mode[i]);
    check(`${tag}: chip ${i} ${open ? "in the open list" : "with the list shut"} toggles it (the digit path, no cue), the MODIFIERS row focused, ${open ? "the list cursor on it" : "the list stays shut"}`,
      same(t, want({ row: ROW.MODS, open, cur: open ? i : -1, pact: i < 4 ? MOD_BITS[i] : 0, time: i === 4 })), J(stOf(t)));
  }
  for (const row of U ? [ROW.LEVEL, ROW.MODS, "open"] : [ROW.LEVEL, ROW.SPEED]) {
    const t = tapRig(kind, { pactUnlocked: U });
    prep(t, row === "open" ? ROW.MODS : row, row === "open");
    if (U) t.app.pact = PACT.SHRINK;
    t.ctr(t.G().start);
    const pact = U ? PACT.SHRINK : 0;
    check(`${tag}: START from ${row === "open" ? "the open list" : LEVEL_ROWS[row]} starts the run on screen, one uiSel`, same(t, want({ scr: SCREEN.GAME, row: ROW.START, pact, run: { level: 2, heat: 1, pact, pace: 0 }, cues: "uiSel" })), J(stOf(t)));
  }
  {
    const t = tapRig(kind, { pactUnlocked: U }), a = t.app, G = t.G();
    prep(t, ROW.SPEED);
    t.ctr(G.pane);
    check(`${tag}: a miss on the plate (the card) is inert: no change, no focus move, no cue`, same(t, want({ row: ROW.SPEED })), J(stOf(t)));
    t.tapAt(G.S.x - 6, G.S.y + G.S.h / 2);
    check(`${tag}: a tap off the plate backs out to MENU on LEVEL SELECT`, same(t, want({ scr: SCREEN.MENU, row: ROW.SPEED, cues: "uiBack" })) && a.cursor === ITEMS.indexOf("LEVEL SELECT"), J(stOf(t)));
  }
  if (U) {
    const t = tapRig(kind, { pactUnlocked: U }), G = t.G();
    prep(t, ROW.MODS, true);
    t.tapAt(G.S.x - 6, G.S.y + G.S.h / 2);
    check(`${tag}: with the list open a tap off the plate closes the list first (one level, as Esc)`, same(t, want({ row: ROW.MODS, cues: "uiBack" })), J(stOf(t)));
    prep(t, ROW.MODS, true);
    t.ctr(G.heat[2]);
    check(`${tag}: with the list open a tap on another row closes it and acts there`, same(t, want({ row: ROW.DIFFICULTY, heat: 2, cues: "uiMove" })), J(stOf(t)));
    prep(t, ROW.START, false);
    t.ctr(G.room[6]);
    check(`${tag}: no tap starts a run but START (a tile tap stays on the page)`, same(t, want({ level: 7, cues: "uiMove" })), J(stOf(t)));
  }
  if (!U) {
    const t = tapRig(kind, { pactUnlocked: false }), G = t.G();
    prep(t, ROW.LEVEL); t.app.level = 5;
    t.ctr(G.room[7]); t.ctr(G.start);
    check(`${tag}: a locked tile then START starts the selected level (5), never the locked one`, same(t, want({ scr: SCREEN.GAME, row: ROW.START, level: 5, run: { level: 5, heat: 1, pact: 0, pace: 0 }, cues: "uiSel" })), J(stOf(t)));
  }
}

console.log("\n  LEVEL SELECT RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
