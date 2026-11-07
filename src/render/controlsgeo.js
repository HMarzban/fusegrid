// CONTROLS page geometry and copy, shared by draw, tap and the page reducer. Pure. BTN, DEF_KEY, DEF_PAD, VIB_LEVELS, SENS_LEVELS, keyName, moveLabel and softAliasesOf are local copies of src/app/controls.js (render never reads src/app), pinned equal in tests/controlsdraw.test.mjs.
import { FOOT_TAP, bandOf, listGeom, listHit, pageBox } from "./menudraw.js";
import { KB_ROWS } from "./padart.js";

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
export const VIB_LEVELS = Object.freeze(["OFF", "LOW", "MEDIUM", "HIGH"]);
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
  MOVE: "WALK THE GRID", BOMB: "PLANT A BOMB", THROW: "NEEDS THE THROW POWER · TOSS A BOMB", REMOTE: "NEEDS THE REMOTE POWER · SET OFF YOUR BOMBS",
  PAUSE: "STOP THE RUN", SENSITIVITY: "HOW FAR THE STICK MOVES BEFORE IT COUNTS", VIBRATION: "HITS, BLASTS, PLANTS AND MENUS · LOW SKIPS MENUS",
};
/** No actuator on the live pad; the unknown-effects addition to the rule. */
export const NO_VIB = "NO VIBRATION ON THIS CONTROLLER OR BROWSER", FEEL_NOTHING = "FEEL NOTHING? THIS PAD OR BROWSER MAY NOT VIBRATE";
/* The rule follows the level, so it never promises what this level drops. */
const VIB_RULE = ["NO VIBRATION AT ALL", "HITS, BIG BLASTS AND ROOM ENDS · NO MENU BUZZ", "HITS, BLASTS, PLANTS AND MENUS · LOW SKIPS MENUS", "HITS, BLASTS, PLANTS AND MENUS · STRONGEST"];
const SENS_WORN = "SENSITIVE: A WORN STICK CAN KEEP WALKING";
const IDX = { S: 0, E: 1, W: 2, N: 3, SHL: 4, SHR: 5, TRL: 6, TRR: 7, SELECT: 8, START: 9 };
const padOff = (s) => s.tab === "pad" && (!s.pad || s.pad.state === "none" || s.pad.state === "lost");
const noBuzz = (s) => padOff(s) || !s.pad || s.pad.rumble !== true; // the actuator decides, whatever the mapping
const vibOf = (s) => (s.vib == null ? DEF_VIB : s.vib);
/** The level word while a pad with an actuator is connected, else "": the OPTIONS door and the MENU note read it. */
export const vibWord = (s) => (s && s.pad && s.pad.state !== "none" && s.pad.state !== "lost" && s.pad.rumble === true && s.vib != null ? VIB_LEVELS[s.vib] || "" : "");
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
    { id: "RESET", gap: 1, label: "RESET PAD", reset: 1, off },
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
/** Which pad parts light for a row. */
export function padStates(s, id) {
  const b = s.binds || DEF_PAD, st = {}, stick = s.stick === "R" ? "RS" : "LS";
  if (id === "MOVE") { st.dpad = "lit"; st[stick] = "lit"; }
  else if (id === "PAUSE") { st.START = "lit"; st[b.PAUSE] = "alias"; }
  else if (id === "SENSITIVITY") st[stick] = "lit";
  else if (b[id]) st[b[id]] = "lit";
  if (s.echo) st[s.echo] = "lit";
  if (s.swap && s.swap.part) st[s.swap.part] = "swap";
  return st;
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

const CHROME = 88, PITCH = 26, PITCH_T = 52, GAP = 6, TAB_H = 30, TAB_T = 52, RULE_H = 30, HEAD_H = 26, PANE_MIN = 140, CAP_W = 400, CAP_H = 140, K_MAX = 1.25;
const SHAPE = [0, 0, 0, 0, 0, 1, 0, 1].map((g) => ({ gapBefore: !!g }));
const LIST_W = 272; // MENU's list column
/** The page's one geometry: a pageBox plate, HEAT | PACE height tabs, a listGeom list, and MENU's pane beside it (above it under 560 wide). scale = CSS px per logical px on a touch layout (default the worst real stage, PAUSE on a phone's #c). The tabs hold 44 CSS. Rows ask for it, but pitches are caps, as everywhere: a box too short for eight rows scales them, so they are 31 CSS in phone landscape and 26 in PAUSE on a phone, in line with PAUSE OPTIONS (lead ruling), and a pane too small to read goes. */
export function geoFor(L, touch, narrow, scale) {
  const T = !!touch, nar = !!narrow, floor = T ? Math.ceil(44 / (scale || 0.63)) : 0, B = bandOf(L, T), room = B.bot - B.top - CHROME;
  const tabH = Math.max(T ? TAB_T : TAB_H, floor), pitch = Math.max(T ? PITCH_T : PITCH, floor), listH = pitch * 8 + GAP * 2;
  const paneRoom = nar ? room - tabH - GAP * 2 - listH : Math.min(room - tabH - GAP, listH);
  const hasPane = paneRoom >= PANE_MIN, wPane = nar ? L.cx * 2 - 56 : 0;
  const paneNat = nar && hasPane ? Math.min(paneRoom, HEAD_H + RULE_H + Math.ceil(196 * Math.min(K_MAX, (wPane - 12) / 300))) : 0;
  const body = tabH + GAP + (nar && hasPane ? paneNat + GAP : 0) + listH + (hasPane ? 0 : RULE_H);
  const S = pageBox(L, 560, body, T), bot = S.y + S.h - 34, tw = Math.min(T ? 130 : 100, S.iw / 3); // HIGH SCORES' tab size, centred
  const tabs = [0, 1].map((i) => ({ x: S.mid - tw + i * tw, y: S.by, w: tw, h: tabH }));
  const top = S.by + tabH + GAP + (nar && hasPane ? paneNat + GAP : 0);
  const list = listGeom(L, SHAPE, { top, bot: bot - (hasPane ? 0 : RULE_H), x: S.x, w: nar ? S.w : LIST_W, pitch, gap: GAP, pad: 0 });
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
