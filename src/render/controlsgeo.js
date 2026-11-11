// CONTROLS page geometry and copy, shared by draw, tap and the page reducer. Pure. BTN, DEF_KEY, DEF_PAD, VIB_LEVELS, SENS_LEVELS, keyName, moveLabel and softAliasesOf are local copies of src/app/controls.js (render never reads src/app), pinned equal in tests/controlsdraw.test.mjs.
import { FOOT_TAP, VIB_LEVELS, bandOf, listGeom, listHit, pageBox, vibWord } from "./menudraw.js";
import { KB_ROWS, PART_AT, PART_R, padBox } from "./padart.js";
import { textScale } from "./kit/type.js";

const dpad = { g: "dpad", v: "all", w: "D-PAD" };
export const BTN = Object.freeze({
  S: { g: "face", v: "S", w: "SOUTH" }, E: { g: "face", v: "E", w: "EAST" }, W: { g: "face", v: "W", w: "WEST" }, N: { g: "face", v: "N", w: "NORTH" },
  SHL: { g: "shoulder", v: "L", w: "L SHOULDER" }, SHR: { g: "shoulder", v: "R", w: "R SHOULDER" }, TRL: { g: "trigger", v: "L", w: "L TRIGGER" }, TRR: { g: "trigger", v: "R", w: "R TRIGGER" },
  START: { g: "centre", v: "START", w: "START" }, SELECT: { g: "centre", v: "SELECT", w: "SELECT" },
  dU: { g: "dpad", v: "U", w: "D-PAD UP" }, dD: { g: "dpad", v: "D", w: "D-PAD DOWN" }, dL: { g: "dpad", v: "L", w: "D-PAD LEFT" }, dR: { g: "dpad", v: "R", w: "D-PAD RIGHT" },
  dpad, LS: { g: "stick", v: "L", w: "L-STICK" }, RS: { g: "stick", v: "R", w: "R-STICK" },
});
export const DEF_KEY = Object.freeze({ BOMB: "Space", THROW: "KeyE", REMOTE: "KeyQ", PAUSE: "KeyP", MOVE: Object.freeze(["KeyW", "KeyD", "KeyS", "KeyA"]) });
export const DEF_PAD = Object.freeze({ BOMB: "S", THROW: "W", REMOTE: "E", PAUSE: "SELECT" });
export { VIB_LEVELS, vibWord }; // in menudraw.js since v202: the OPTIONS door reads them before this file loads
export const SENS_LEVELS = Object.freeze([Object.freeze({ name: "MIN", dead: 60 }), Object.freeze({ name: "LOW", dead: 40 }), Object.freeze({ name: "MEDIUM", dead: 25 }), Object.freeze({ name: "HIGH", dead: 15 }), Object.freeze({ name: "MAX", dead: 8 })]);
export const DEF_VIB = 2;
const DEF_DEAD = 25;
/** The SENS_LEVELS index nearest a stored dead value. */
export const sensIdx = (dead) => SENS_LEVELS.reduce((b, l, i) => (Math.abs(l.dead - dead) < Math.abs(SENS_LEVELS[b].dead - dead) ? i : b), 0);
const NAMES = { Period: ".", Comma: ",", Slash: "/", Semicolon: ";", Quote: "'", Minus: "-", Equal: "=", Backquote: "`", Backslash: "\\" };
/** Label for a key code. */
export function keyName(code) {
  if (code === "Space") return "SPACE";
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith("Arrow")) return code.slice(5).toUpperCase();
  return code.replace(/^Key/, "").replace(/^Digit/, "").replace(/^Numpad/, "NUM ").toUpperCase();
}
/** MOVE set as it reads on a keyboard (UP LEFT DOWN RIGHT, WASD). */
export const moveLabel = (m, names) => [m[0], m[3], m[2], m[1]].map((q) => nameOf(q, names)).join("");
/* A printed character the reducer saw at capture wins, so another layout never reads wrong. */
const nameOf = (code, names) => (names && names[code] ? String(names[code]).toUpperCase() : keyName(code));
/** The silent J / X aliases still alive for this key block. */
export function softAliasesOf(k) {
  if (k.BOMB !== "Space") return [];
  const used = new Set([...k.MOVE, k.BOMB, k.THROW, k.REMOTE, k.PAUSE]);
  return ["KeyJ", "KeyX"].filter((q) => !used.has(q));
}

/** Result lines the page reducer shows through view.status. */
export const STATUS = Object.freeze({ doneKey: "KEYBOARD BACK TO DEFAULTS", donePad: "CONTROLLER BACK TO DEFAULTS", nothing: "ALREADY ON THE DEFAULTS", back: "CONTROLLER BACK", cancelled: "CANCELLED · NOTHING CHANGED", same: "NO CHANGE" });
/** Lines under the pad diagram when no controller is there. */
export const CAPTION = Object.freeze({ none: "PRESS ANY BUTTON ON A CONTROLLER", touch: "TOUCH NEEDS NO SETUP" });
const RULE = {
  MOVE: "WALK THE GRID", BOMB: "PLANT A BOMB", THROW: "NEEDS THE THROW POWER-UP · TOSS A BOMB", REMOTE: "NEEDS THE REMOTE POWER-UP · SET OFF YOUR BOMBS",
  PAUSE: "STOP THE RUN", SENSITIVITY: "HOW FAR THE STICK MOVES BEFORE IT COUNTS", VIBRATION: "HITS, BLASTS, PLANTS AND MENUS · LOW SKIPS MENUS",
};
/** No actuator on the live pad; the unknown-effects addition to the rule. */
export const NO_VIB = "NO VIBRATION ON THIS CONTROLLER OR BROWSER", FEEL_NOTHING = "FEEL NOTHING? THIS CONTROLLER OR BROWSER MAY NOT VIBRATE";
/* The rule follows the level, so it never promises what this level drops. */
const VIB_RULE = ["NO VIBRATION AT ALL", "HITS, BIG BLASTS AND LEVEL ENDS · NO MENU BUZZ", "HITS, BLASTS, PLANTS AND MENUS · LOW SKIPS MENUS", "HITS, BLASTS, PLANTS AND MENUS · STRONGEST"];
const SENS_WORN = "SENSITIVE: A WORN STICK CAN KEEP WALKING";
const IDX = { S: 0, E: 1, W: 2, N: 3, SHL: 4, SHR: 5, TRL: 6, TRR: 7, SELECT: 8, START: 9 };
const padOff = (s) => s.tab === "pad" && (!s.pad || s.pad.state === "none" || s.pad.state === "lost");
const noBuzz = (s) => padOff(s) || !s.pad || s.pad.rumble !== true; // the actuator decides, whatever the mapping
const vibOf = (s) => (s.vib == null ? DEF_VIB : s.vib);
/** The eight rows of the current tab. */
export function rowsOf(s) {
  const p = s.pad || { state: "none" }, k = s.key || DEF_KEY, b = s.binds || DEF_PAD, dead = s.dead == null ? DEF_DEAD : s.dead;
  if (s.tab === "key") {
    const al = softAliasesOf(k).map((q) => q.slice(3)), nm = (q) => nameOf(q, s.names);
    return [
      { id: "MOVE", val: [{ cap: moveLabel(k.MOVE, s.names) }, { cap: "ARROWS" }], changed: k.MOVE.join() !== DEF_KEY.MOVE.join() },
      { id: "BOMB", val: [{ cap: nm(k.BOMB) }], note: al.length === 2 ? al.join(" · ") + " ALSO WORK" : al.length ? al[0] + " ALSO WORKS" : "", changed: k.BOMB !== DEF_KEY.BOMB },
      { id: "THROW", val: [{ cap: nm(k.THROW) }], changed: k.THROW !== DEF_KEY.THROW },
      { id: "REMOTE", val: [{ cap: nm(k.REMOTE) }], changed: k.REMOTE !== DEF_KEY.REMOTE },
      { id: "PAUSE", val: [{ cap: "ESC" }, { cap: nm(k.PAUSE) }], changed: k.PAUSE !== DEF_KEY.PAUSE },
      { id: "CONFIRM", gap: 1, fixed: 1, val: [{ cap: "ENTER" }] },
      { id: "BACK", fixed: 1, val: [{ cap: "ESC" }] },
      { id: "RESET", gap: 1, label: "RESET KEYS", reset: 1 },
    ];
  }
  const off = padOff(s), ch = (a) => b[a] !== DEF_PAD[a];
  const tail = () => [
    { id: "SENSITIVITY", gap: 1, text: SENS_LEVELS[sensIdx(dead)].name, off, changed: dead !== DEF_DEAD, bar: [sensIdx(dead) + 1, SENS_LEVELS.length] },
    noBuzz(s) ? { id: "VIBRATION", text: "NONE", off, none: 1 } : { id: "VIBRATION", text: VIB_LEVELS[vibOf(s)], off, changed: vibOf(s) !== DEF_VIB, bar: [vibOf(s), VIB_LEVELS.length - 1] },
    { id: "RESET", gap: 1, label: "RESET CONTROLLER", reset: 1, off },
  ];
  if (p.state === "nonstd") {
    const B = (id) => ({ cap: "BUTTON " + IDX[id] });
    return [
      { id: "MOVE", val: [{ cap: "STICK" }] }, { id: "BOMB", val: [B(b.BOMB)], changed: ch("BOMB") }, { id: "THROW", val: [B(b.THROW)], changed: ch("THROW") }, { id: "REMOTE", val: [B(b.REMOTE)], changed: ch("REMOTE") },
      { id: "PAUSE", val: [B("START"), B(b.PAUSE)], changed: ch("PAUSE") }, ...tail(),
    ];
  }
  const stick = s.stick === "R" ? BTN.RS : BTN.LS;
  return [
    { id: "MOVE", val: [BTN.dpad, stick], off, changed: s.stick === "R" },
    { id: "BOMB", val: [BTN[b.BOMB]], off, changed: ch("BOMB") },
    { id: "THROW", val: [BTN[b.THROW]], off, changed: ch("THROW") },
    { id: "REMOTE", val: [BTN[b.REMOTE]], off, changed: ch("REMOTE") },
    { id: "PAUSE", val: [BTN.START, BTN[b.PAUSE]], off, changed: ch("PAUSE") },
    ...tail(),
  ];
}
/** The pane's rule line: a result first, then this row's rule. */
export function statusOf(s, row) {
  if (s.status) return s.status;
  if (s.armed) return "PRESS AGAIN TO RESET THIS TAB";
  if (padOff(s)) return s.pad && s.pad.state === "lost" ? "PLUG IT BACK IN OR PRESS ANY BUTTON" : s.device === "touch" ? "PAIR ONE AND PRESS ANY BUTTON" : "IT WAKES ON ITS FIRST PRESS · USB OR BLUETOOTH";
  if (row.fixed) return "ENTER AND ESC STAY PUT SO YOU CAN ALWAYS GET BACK";
  if (row.reset) return "BACK TO THE DEFAULTS · THIS TAB ONLY";
  const ok = s.device === "pad" ? "SOUTH" : s.device === "touch" ? "TAP" : "ENTER";
  if (s.tab === "key") {
    if (row.id === "MOVE") return "ARROWS ALWAYS MOVE · " + ok + " REBINDS " + moveLabel((s.key || DEF_KEY).MOVE, s.names);
    if (row.id === "PAUSE") return "ESC ALWAYS PAUSES · " + ok + " REBINDS THE SECOND KEY";
    return (RULE[row.id] || "") + (row.note ? " · " + row.note : "");
  }
  if (row.id === "VIBRATION") return noBuzz(s) ? NO_VIB : VIB_RULE[vibOf(s)] + (vibOf(s) > 0 && s.pad.effects === null ? " · " + FEEL_NOTHING : "");
  if (row.id === "SENSITIVITY") return sensIdx(s.dead == null ? DEF_DEAD : s.dead) >= 3 ? SENS_WORN : RULE.SENSITIVITY;
  if (s.pad.state === "nonstd") return "NON-STANDARD BUTTONS · TEST EACH ONE · REBIND IF WRONG";
  if (row.id === "MOVE") return "D-PAD ALWAYS MOVES · " + ok + " SWITCHES THE STICK";
  if (row.id === "PAUSE") return "START ALWAYS PAUSES · " + ok + " REBINDS THE SECOND BUTTON";
  return RULE[row.id] || "";
}
/** The kit foot line, composed from the live words; a pad's CONFIRM and BACK are fixed. short = a plate too narrow for the tab words on a value row. */
export function footOf(s, row, words, short) {
  const w = words || {}, padTab = s.tab === "pad", gone = padOff(s), nonstd = padTab && s.pad && s.pad.state === "nonstd";
  if (s.device === "touch") return FOOT_TAP;
  const adjusts = padTab && !gone && (row.id === "SENSITIVITY" || (row.id === "VIBRATION" && !noBuzz(s)));
  const verb = gone || row.fixed || (padTab && row.id === "VIBRATION" && noBuzz(s)) ? null : row.reset ? "RESET" : adjusts ? "CYCLE" : padTab && row.id === "MOVE" ? "STICK" : "REBIND";
  const onPad = (s.device || s.tab) === "pad" && !gone;
  /* ←→ is taken on a value row, so the line names the other way to the tab; on SENSITIVITY the stick is under test, so a pad's line names the D-PAD. */
  const side = "↑↓ ROW · " + (adjusts && row.id === "SENSITIVITY" && onPad && !nonstd ? "D-PAD " : "←→ ") + (adjusts ? "ADJUST" + (short ? "" : " · " + (!onPad ? "[ ]" : nonstd ? "BUTTON 4 5" : "L R") + " TAB") : "TAB");
  let ok = w.ok || "ENTER", back = w.back || "ESC";
  if (onPad) { ok = nonstd ? "BUTTON 0" : "SOUTH"; back = nonstd ? "BUTTON 1" : "EAST"; }
  return side + (verb ? " · " + ok + " " + verb : "") + " · " + back + " BACK";
}
/** Which controller inputs wear the brick: every bound one (the D-PAD, the live stick, START, and each action's button), whatever the row. */
export function padStates(s) {
  const st = {};
  for (const id in padLabels(s)) st[id] = "lit";
  return st;
}
/** The focused row's button, the one the drawing rings: the live stick on MOVE, an action's button, PAUSE's rebindable one; none elsewhere. */
export function padRing(s, id) {
  const b = s.binds || DEF_PAD;
  return id === "MOVE" ? (s.stick === "R" ? "RS" : "LS") : id === "BOMB" || id === "THROW" || id === "REMOTE" || id === "PAUSE" ? b[id] : null;
}
/** Which keyboard keys light for a row. */
export function keyStates(s, id) {
  const k = s.key || DEF_KEY, st = {};
  if (id === "MOVE") { k.MOVE.forEach((q) => (st[q] = "lit")); for (const q of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) st[q] = "alias"; }
  else if (id === "BOMB") { st[k.BOMB] = "lit"; for (const q of softAliasesOf(k)) st[q] = "alias"; }
  else if (id === "PAUSE") { st.Escape = "lit"; st[k.PAUSE] = "alias"; }
  else if (id === "CONFIRM") st.Enter = "lit";
  else if (id === "BACK") st.Escape = "lit";
  else if (k[id]) st[k[id]] = "lit";
  if (s.echo) st[s.echo] = "lit";
  if (s.swap && s.swap.part) st[s.swap.part] = "swap";
  return st;
}

/** Every pad part's leader word. */
export function padLabels(s) {
  const b = s.binds || DEF_PAD, o = { dpad: "MOVE", START: "PAUSE", [s.stick === "R" ? "RS" : "LS"]: "MOVE" };
  for (const a of ["BOMB", "THROW", "REMOTE", "PAUSE"]) o[b[a]] = a;
  return o;
}
/** The controller's callouts, one per bound input by position: MOVE joins the D-PAD and the live stick (listed top to bottom as drawn), START is FIXED. */
export function padCallouts(s) {
  const L = padLabels(s), out = [];
  out.push(s.stick === "R" ? { grp: "MOVE", act: "MOVE", parts: ["dpad", "RS"], pos: ["D-PAD", "R-STICK"] } : { grp: "MOVE", act: "MOVE", parts: ["LS", "dpad"], pos: ["L-STICK", "D-PAD"] });
  for (const id in L) if (id !== "dpad" && id !== "LS" && id !== "RS") out.push({ grp: id, act: L[id], pos: [BTN[id].w], tag: id === "START" });
  return out;
}
/* Leaders (round 7 rules, appendix 9.2): plain orthogonal lines from a dot on the button out to a gutter label, ACTION over the position. Right gutter
   top to bottom START, R TRIGGER, WEST, R SHOULDER, NORTH, EAST, SOUTH; left SELECT, L TRIGGER, L SHOULDER, MOVE (the D-PAD and the live stick on one
   spine; a right stick reaches it under the body). START, SELECT and WEST rise to a lane (WEST under NORTH's well, the pills over the triggers); the
   rest run straight out, and a label that would meet the one above drops through a knee in the gutter, the lower leader taking the inner knee. */
const R_ORDER = ["START", "TRR", "W", "SHR", "N", "E", "S"], L_ORDER = ["SELECT", "TRL", "SHL", "MOVE"], UP = { START: 1, SELECT: 1, W: 1 }, GAP_L = 6, KNEE = 4;
const lineYs = (n, m) => [0, ...Array.from({ length: n }, (_, i) => 0.6 * m.pri + 0.6 * m.sec + i * 1.2 * m.sec)];
/** The plan at body width W for callouts it (padCallouts), m = {pri, sec, wOf(s, px)}: {ok, lines:[{grp, pts, dot}], labels:[{grp, side, x, lines}], ext}. ok
    is false when a lane cannot clear its neighbour (a rare rebind on a narrow drawing): the page then draws no leaders. Px from the body box's top-left. */
export function padPlan(W, it, m) {
  const at = (id) => [PART_AT[id][0] * W, PART_AT[id][1] * W], by = Object.fromEntries(it.map((q) => [q.grp, q]));
  const lines = [], labels = [], top = (y) => y - 0.6 * m.pri, bot = (y, q) => y + lineYs(q.pos.length, m).at(-1) + 0.6 * m.sec;
  let ok = true, ext = { ...padBox(W) };
  for (const side of [1, -1]) {
    const list = (side > 0 ? R_ORDER : L_ORDER).filter((g) => by[g]), Y = {};
    let prev = -Infinity;
    for (const g of list) {
      const q = by[g], lo = prev + GAP_L + 0.6 * m.pri;
      let ex;
      if (g === "MOVE") { const ys = q.parts.map((p) => (p === "RS" ? 0.56 * W : at(p)[1])); ex = (ys[0] + ys[1]) / 2; }
      else ex = UP[g] ? (g === "W" ? 0.07 * W : -0.13 * W) : at(g)[1];
      const y = Math.max(ex, lo);
      if (UP[g] && y > (g === "W" ? 0.096 * W - 2 : -0.045 * W - 4)) ok = false;
      Y[g] = { y, ex };
      prev = bot(y, q);
    }
    const knees = list.filter((g) => !UP[g] && g !== "MOVE" && Y[g].y > Y[g].ex + 0.5).sort((a, b) => Y[b].ex - Y[a].ex);
    const kx = (g) => (side > 0 ? W + 8 + KNEE * knees.indexOf(g) : -8 - KNEE * knees.indexOf(g)), xG = side > 0 ? W + 18 + KNEE * knees.length : -18 - KNEE * knees.length;
    for (const g of list) {
      const q = by[g], { y } = Y[g];
      if (g === "MOVE") {
        const ys = [];
        for (const p of q.parts) { const d = at(p); if (p === "RS") { lines.push({ grp: g, pts: [d, [d[0], 0.56 * W], [xG, 0.56 * W]], dot: 1 }); ys.push(0.56 * W); } else { lines.push({ grp: g, pts: [d, [xG, d[1]]], dot: 1 }); ys.push(d[1]); } }
        lines.push({ grp: g, pts: [[xG, Math.min(...ys, y)], [xG, Math.max(...ys, y)]], dot: 0 });
      } else {
        const d = at(g);
        lines.push({ grp: g, pts: UP[g] ? [d, [d[0], y], [xG, y]] : y > Y[g].ex + 0.5 ? [d, [kx(g), d[1]], [kx(g), y], [xG, y]] : [d, [xG, y]], dot: 1 });
      }
      const ys = lineYs(q.pos.length, m), tagW = q.tag ? m.wOf(FIXED_WORD, m.sec) + 8 : 0;
      const L = [{ s: q.act, px: m.pri, act: 1, y, w: m.wOf(q.act, m.pri) }, ...q.pos.map((s, i) => ({ s, px: m.sec, y: y + ys[i + 1], w: m.wOf(s, m.sec), tag: i === q.pos.length - 1 ? tagW : 0 }))];
      const x = xG + side * 6, wide = Math.max(...L.map((l) => l.w + (l.tag ? l.tag + 6 : 0)));
      labels.push({ grp: g, side: side > 0 ? "r" : "l", x, lines: L });
      ext = { x0: Math.min(ext.x0, side > 0 ? ext.x0 : x - wide), x1: Math.max(ext.x1, side > 0 ? x + wide : ext.x1), y0: Math.min(ext.y0, top(y)), y1: Math.max(ext.y1, bot(y, q)) };
    }
  }
  return { ok, lines, labels, ext, W };
}
const FIXED_WORD = "FIXED";
const segX = (a, b, c, d) => {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])), on = (p, q, r) => Math.min(p[0], q[0]) - 1e-6 <= r[0] && r[0] <= Math.max(p[0], q[0]) + 1e-6 && Math.min(p[1], q[1]) - 1e-6 <= r[1] && r[1] <= Math.max(p[1], q[1]) + 1e-6;
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  return (o1 !== o2 && o3 !== o4 && o1 && o2 && o3 && o4) || (!o1 && on(a, b, c)) || (!o2 && on(a, b, d)) || (!o3 && on(c, d, a)) || (!o4 && on(c, d, b));
};
const segD = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
/** The crossing gate (appendix 9.2) on a plan: leader vs leader of another callout, and a leader within r + 2 of any input but its own (the sticks,
    the D-PAD, the face buttons, the pills; a BOUND shoulder or trigger too, sampled along its shape). [] when clean. */
export function padCross(plan, lit) {
  const W = plan.W, out = [], segs = (L) => L.pts.slice(1).map((p, i) => [L.pts[i], p]), own = (g) => (g === "MOVE" ? ["LS", "dpad", "RS"] : [g]);
  const obs = Object.entries(PART_R).map(([id, r]) => ({ id, x: PART_AT[id][0] * W, y: PART_AT[id][1] * W, r: r * W }));
  for (const id of ["SHL", "SHR"]) if (lit && lit[id]) for (const p of BUMP_AT) obs.push({ id, x: (id === "SHL" ? 1 - p[0] : p[0]) * W, y: p[1] * W, r: 0.036 * W });
  for (const id of ["TRL", "TRR"]) if (lit && lit[id]) for (const dx of [-0.06, 0, 0.06]) obs.push({ id, x: ((id === "TRL" ? 0.24 : 0.76) + dx) * W, y: 0.02 * W, r: 0.05 * W });
  const L = plan.lines;
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (L[i].grp !== L[j].grp) for (const [a, b] of segs(L[i])) for (const [c, d] of segs(L[j])) if (segX(a, b, c, d)) out.push(L[i].grp + " x " + L[j].grp);
  for (const l of L) for (const [a, b] of segs(l)) for (const q of obs) if (!own(l.grp).includes(q.id) && segD([q.x, q.y], a, b) < q.r + 2) out.push(l.grp + " near " + q.id);
  return [...new Set(out)];
}
const BUMP_AT = [[0.66, 0.035], [0.74, 0.044], [0.82, 0.065], [0.88, 0.08], [0.93, 0.11], [0.96, 0.16]];
export const PAD_CAP = 460, PAD_FULL = 180, PAD_TALL = 0.74, PAD_KEEP = 0.7;
/** Fits the controller into an art box aw x ah: the largest W (<= 460) whose clean plan fits, else (under PAD_FULL, or no clean plan) the compact
    drawing with no leaders, as large as the box allows. {W, plan|null, ox, oy}: ox oy put the body box's top-left in the box's own px. */
export function padFit(aw, ah, it, m, lit) {
  const Wc = Math.max(40, Math.min(PAD_CAP, aw - 8, (ah - 8) / PAD_TALL));
  if (it && it.length) {
    for (let W = Math.floor(Math.min(PAD_CAP, aw - 120)); W >= Math.max(PAD_FULL, PAD_KEEP * Wc); W -= 4) { // callouts never shrink the drawing past PAD_KEEP of what the box holds without them
      const p = padPlan(W, it, m), e = p.ext, w = e.x1 - e.x0, h = e.y1 - e.y0;
      if (p.ok && w <= aw && h <= ah && !padCross(p, lit).length) return { W, plan: p, ox: (aw - w) / 2 - e.x0, oy: (ah - h) / 2 - e.y0 };
    }
  }
  const W = Wc, e = padBox(W);
  return { W, plan: null, ox: (aw - (e.x1 - e.x0)) / 2 - e.x0, oy: (ah - (e.y1 - e.y0)) / 2 - e.y0 };
}
const KEY_XY = {};
for (const [ry, row] of KB_ROWS) for (const [id, , kx, kw] of row) if (id) KEY_XY[id] = [kx + (kw || 18) / 2, ry];
/** The selected row's leaders on the keyboard: [[points], x, y, align, word]. A key off the diagram has none; its row still names it. */
export function keyLabels(s, id) {
  const k = s.key || DEF_KEY, out = [], up = (code, word) => {
    const p = KEY_XY[code];
    if (!p) return;
    if (p[1] >= 92 && code !== "ArrowUp") out.push([[[p[0], p[1] + 17], [p[0], 146]], p[0], 154, "center", word]); // the two bottom rows leave downward, or the leader crosses the whole board
    else out.push([[p, [p[0], 14]], p[0], 8, "center", word]);
  };
  if (id === "MOVE") { up(k.MOVE[0], moveLabel(k.MOVE, s.names)); up("ArrowUp", "ARROWS"); }
  else if (id === "BOMB") up(k.BOMB, "BOMB");
  else if (id === "PAUSE") { up("Escape", "ESC"); up(k.PAUSE, "PAUSE"); }
  else if (id === "BACK") up("Escape", "BACK");
  else if (id === "CONFIRM") up("Enter", "CONFIRM");
  else if (k[id]) up(k[id], id);
  return out;
}

const CHROME = 88, PITCH = 26, PITCH_T = 52, GAP = 6, TAB_H = 30, TAB_T = 52, RULE_H = 30, HEAD_H = 26, PANE_MIN = 140, CAP_W = 400, CAP_H = 200, K_MAX = 1.25, WIDE = 800, WIDE_W = 1000;
/* The pane a w-wide drawing box wants: head, rule (one spare line) and the default controller with all its callouts, at the text scale. */
const EST = (s, px) => s.length * px * 0.66;
const tallMemo = new Map();
function paneTall(w) {
  const ts = textScale(), key = w + "|" + ts;
  if (tallMemo.has(key)) return tallMemo.get(key);
  const m = { pri: 13 * ts, sec: 11 * ts, wOf: EST }, it = padCallouts({ binds: DEF_PAD, stick: "L" });
  let h = 0;
  for (let W = Math.floor(Math.min(PAD_CAP, w - 120)); W >= PAD_FULL && !h; W -= 4) { const p = padPlan(W, it, m); if (p.ok) h = Math.ceil(HEAD_H + RULE_H + 13 + p.ext.y1 - p.ext.y0 + 4); }
  tallMemo.set(key, h);
  return h;
}
const SHAPE = [0, 0, 0, 0, 0, 1, 0, 1].map((g) => ({ gapBefore: !!g }));
const LIST_W = 272; // MENU's list column
/** The page's one geometry: a pageBox plate, HEAT | PACE height tabs, a listGeom list, and MENU's pane beside it (above it under 560 wide). scale = CSS px per logical px on a touch layout (default the worst real stage, PAUSE on a phone's #c). The tabs hold 44 CSS. Rows ask for it, but pitches are caps, as everywhere: a box too short for eight rows scales them, so they are 31 CSS in phone landscape and 26 in PAUSE on a phone, in line with PAUSE OPTIONS (lead ruling), and a pane too small to read goes. */
export function geoFor(L, touch, narrow, scale) {
  const T = !!touch, nar = !!narrow, floor = T ? Math.ceil(44 / (scale || 0.63)) : 0, B = bandOf(L, T), room = B.bot - B.top - CHROME;
  const tabH = Math.max(T ? TAB_T : TAB_H, floor), pitch = Math.max(T ? PITCH_T : PITCH, floor), listH = pitch * 8 + GAP * 2;
  const paneRoom = nar ? room - tabH - GAP * 2 - listH : Math.min(room - tabH - GAP, listH);
  const hasPane = paneRoom >= PANE_MIN, wPane = nar ? L.cx * 2 - 56 : 0;
  const paneNat = nar && hasPane ? Math.min(paneRoom, HEAD_H + RULE_H + Math.ceil(196 * Math.min(K_MAX, (wPane - 12) / 300))) : 0;
  /* A desk-sized box (800 wide and up) widens the plate and lets the pane grow past the list, so the drawings have room for their callouts. */
  const wide = hasPane && !nar && L.cx * 2 >= WIDE, maxW = wide ? Math.min(L.cx * 2 - 80, WIDE_W) : 560, paneH = wide ? Math.max(listH, Math.min(room - tabH - GAP, paneTall(maxW - LIST_W - 24))) : 0;
  const body = tabH + GAP + (nar && hasPane ? paneNat + GAP : 0) + Math.max(listH, paneH) + (hasPane ? 0 : RULE_H);
  const S = pageBox(L, maxW, body, T), bot = S.y + S.h - 34, tw = Math.min(T ? 130 : 100, S.iw / 3); // HIGH SCORES' tab size, centred
  const tabs = [0, 1].map((i) => ({ x: S.mid - tw + i * tw, y: S.by, w: tw, h: tabH }));
  const top = S.by + tabH + GAP + (nar && hasPane ? paneNat + GAP : 0);
  const list = listGeom(L, SHAPE, { top, bot: wide ? Math.min(bot, top + listH) : bot - (hasPane ? 0 : RULE_H), x: S.x, w: nar ? S.w : LIST_W, pitch, gap: GAP, pad: 0 });
  const paneBox = !hasPane ? null : nar ? { x: S.ix - 8, y: S.by + tabH + GAP, w: S.iw + 16, h: paneNat } : { x: S.x + LIST_W + 2, y: top, w: S.w - LIST_W - 12, h: bot - top };
  const art = paneBox && { y: paneBox.y + HEAD_H, h: paneBox.h - HEAD_H - RULE_H }, cap = Math.min(CAP_W, S.w - 24);
  const fitK = (w, h) => Math.min(K_MAX, (paneBox.w - 12) / w, art.h / h);
  const pad = paneBox && { k: fitK(300, 196) }, keys = paneBox && { k: fitK(318, 162) };
  if (paneBox) {
    pad.x = paneBox.x + (paneBox.w - 300 * pad.k) / 2; pad.y = art.y + (art.h - 196 * pad.k) / 2;
    keys.x = paneBox.x + (paneBox.w - 300 * keys.k) / 2; keys.y = art.y + (art.h - 162 * keys.k) / 2;
  }
  return {
    S, x: S.x, y: S.y, w: S.w, h: S.h, narrow: nar, touch: T, W: L.cx * 2, H: L.footY + 20, tabs, list, pane: paneBox, art, pad, keys, statusY: bot - RULE_H + 8,
    cap: { x: L.cx - cap / 2, y: S.y + (S.h - CAP_H) / 2, w: cap, h: CAP_H },
  };
}
/** Row i's painted band: the same insets as drawList. */
export const geomOf = (i, G) => { const r = G.list.rows[i]; return { x: G.list.x + 8, y: r.y0 + 1, w: G.list.w - 16, h: r.h - 2 }; };
const inR = (x, y, r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
/** A tap: {tab}, {row}, {off:1} off the plate, {} on it. While capturing only the capture plate counts. */
export function hitPage(s, x, y, G) {
  if (s && s.capture) return inR(x, y, G.cap) ? {} : { off: 1 };
  for (let i = 0; i < 2; i++) if (inR(x, y, G.tabs[i])) return { tab: i ? "pad" : "key" };
  const row = G.pane && inR(x, y, G.pane) ? -1 : listHit(x, y, G.list);
  if (row >= 0) return { row };
  if (x < G.x || y < G.y || x > G.x + G.w || y > G.y + G.h) return { off: 1 };
  return {};
}
