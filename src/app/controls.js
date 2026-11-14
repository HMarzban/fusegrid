// The controls model, its store and the bind rules (CONTROLS feature, record 2026-11-02-controls-menu-design.md).
import { defaultStore } from "./store.js";
export const CONTROLS_KEY = "nb.controls.v1";

const freeze = (o) => {
  if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); for (const k of Object.keys(o)) freeze(o[k]); }
  return o;
};
const thaw = (c) => ({ key: { ...c.key, MOVE: [...c.key.MOVE] }, pad: { ...c.pad }, stick: c.stick, dead: c.dead, rumble: c.rumble, vib: c.vib });

export const ACTIONS = freeze(["BOMB", "THROW", "REMOTE", "PAUSE"]);
export const MOVE_ORDER = freeze(["UP", "RIGHT", "DOWN", "LEFT"]);
export const DEF_KEY = freeze({ BOMB: "Space", THROW: "KeyE", REMOTE: "KeyQ", PAUSE: "KeyP", MOVE: ["KeyW", "KeyD", "KeyS", "KeyA"] });
export const DEF_PAD = freeze({ BOMB: "S", THROW: "W", REMOTE: "E", PAUSE: "SELECT" });
/* Index = the stored vib: 0 is really off. */
export const VIB_LEVELS = freeze(["OFF", "LOW", "MEDIUM", "HIGH"]);
const VIB_DEF = 2;
/* Least to most sensitive; dead is the stored percent, flip how far the other axis must lead before a turn. */
export const SENS_LEVELS = freeze([{ name: "MIN", dead: 60, flip: 1.4 }, { name: "LOW", dead: 40, flip: 1.35 }, { name: "MEDIUM", dead: 25, flip: 1.25 }, { name: "HIGH", dead: 15, flip: 1.15 }, { name: "MAX", dead: 8, flip: 1.1 }]);
export const DEF_CONTROLS = freeze({ key: DEF_KEY, pad: DEF_PAD, stick: "L", dead: 25, rumble: 1, vib: VIB_DEF });
export const PAD_IDX = freeze({ 0: "S", 1: "E", 2: "W", 3: "N", 4: "SHL", 5: "SHR", 6: "TRL", 7: "TRR", 8: "SELECT", 9: "START", 12: "dU", 13: "dD", 14: "dL", 15: "dR" });
export const BTN = freeze({
  S: { g: "face", v: "S", w: "SOUTH", s: "SOUTH" }, E: { g: "face", v: "E", w: "EAST", s: "EAST" },
  W: { g: "face", v: "W", w: "WEST", s: "WEST" }, N: { g: "face", v: "N", w: "NORTH", s: "NORTH" },
  SHL: { g: "shoulder", v: "L", w: "L SHOULDER", s: "L SHLDR" }, SHR: { g: "shoulder", v: "R", w: "R SHOULDER", s: "R SHLDR" },
  TRL: { g: "trigger", v: "L", w: "L TRIGGER", s: "L TRIG" }, TRR: { g: "trigger", v: "R", w: "R TRIGGER", s: "R TRIG" },
  START: { g: "centre", v: "START", w: "START", s: "START" }, SELECT: { g: "centre", v: "SELECT", w: "SELECT", s: "SELECT" },
  dU: { g: "dpad", v: "U", w: "D-PAD UP", s: "D-PAD UP" }, dD: { g: "dpad", v: "D", w: "D-PAD DOWN", s: "D-PAD DN" },
  dL: { g: "dpad", v: "L", w: "D-PAD LEFT", s: "D-PAD L" }, dR: { g: "dpad", v: "R", w: "D-PAD RIGHT", s: "D-PAD R" },
  dpad: { g: "dpad", v: "all", w: "D-PAD", s: "D-PAD" }, LS: { g: "stick", v: "L", w: "L-STICK", s: "L-STICK" }, RS: { g: "stick", v: "R", w: "R-STICK", s: "R-STICK" },
});
const CAPTURABLE = ["S", "E", "W", "N", "SHL", "SHR", "TRL", "TRR", "SELECT"];

const MODS = /^(Shift|Control|Alt|Meta|OS)(Left|Right)?$|^(AltGraph|CapsLock|Fn|FnLock|NumLock|ScrollLock|Symbol|SymbolLock|Hyper|Super|ContextMenu)$/;
/** The press a letter shortcut reads: the printed Latin letter wherever it sits ("Key" + it), else the code (a synthetic press, a key of another
    script, a dead key); a letter position that prints punctuation (AZERTY's M key prints ,) is no letter: "". Binds and movement keep the code. */
export function letterOf(code, key) {
  if (typeof key !== "string" || key.length !== 1) return code;
  if (/^[a-z]$/i.test(key)) return "Key" + key.toUpperCase();
  return /^Key[A-Z]$/.test(code) && !/\p{L}/u.test(key) ? "" : code;
}
/* The letters the shell answers that no bind may print (refuseKey): the camera / STATS reset, the privacy card, the run end's copies, the menus' M T U */
const SHORTCUT = new Set(["KeyR", "KeyY", "KeyN", "KeyC", "KeyB", "KeyM", "KeyT", "KeyU"]);
/** The shortcut a press reads: letterOf, except that a key the player plays with (bound(code): the MOVE set, BOMB THROW REMOTE PAUSE) is never one of
    the SHORTCUT letters, though a layout change may print one on it (Colemak's MOVE DOWN KeyS prints r): "" then, never the raw code (Dvorak may bind
    KeyR, which prints p). Q and E, RECORDS' tab keys, sit on QWERTY's own REMOTE and THROW by design and stay. */
export function shortcutOf(code, key, bound) {
  const L = letterOf(code, key);
  return SHORTCUT.has(L) && typeof bound === "function" && bound(code) ? "" : L;
}
/** A printed name worth showing: one printable ASCII character (a letter upper-cased, a digit, punctuation such as AZERTY's , on KeyM); "" for
    anything else (another script, an accented letter, a dead key, space). */
export const layoutName = (v) => (typeof v === "string" && /^[!-~]$/.test(v) ? v.toUpperCase() : "");
const letterWhy = (code) => {
  if (code === "KeyR") return "R IS THE CAMERA · PICK ANOTHER";
  if (code === "KeyY" || code === "KeyN") return "Y AND N ANSWER THE PRIVACY CARD · PICK ANOTHER";
  if (code === "KeyC" || code === "KeyB") return "C AND B COPY ON THE RUN END · PICK ANOTHER";
  if (/^Key[MTU]$/.test(code)) return code[3] + " IS TAKEN BY THE MENUS · PICK ANOTHER";
  return "";
};
/* "" when the code may hold a bind on some layout: every refusal but the shortcut letters, which follow what the key prints (refuseKey) */
function fixedWhy(code) {
  if (typeof code !== "string" || !code) return "THAT KEY CANNOT BE BOUND";
  if (code === "Escape") return "ESC ALWAYS BACKS OUT · PICK ANOTHER";
  if (code === "Enter" || code === "NumpadEnter") return "ENTER IS CONFIRM · PICK ANOTHER";
  if (code === "Backspace") return "BACKSPACE IS BACK · PICK ANOTHER";
  if (code.startsWith("Arrow")) return "ARROWS ALWAYS MOVE · PICK ANOTHER";
  if (code === "Tab" || /^F\d+$/.test(code)) return "THAT KEY BELONGS TO THE BROWSER";
  if (MODS.test(code)) return "THAT KEY CANNOT BE BOUND";
  if (/^(Digit|Numpad)[1-5]$/.test(code) || code === "BracketLeft" || code === "BracketRight") return "THAT KEY IS TAKEN ON LEVEL SELECT";
  return "";
}
/** "" when the code can be bound, else the exact refusal line. key = what it prints, when known: the shortcut letters (R Y N C B M T U) are judged
    by it (QWERTZ's KeyY prints Z and binds; its KeyZ prints Y and is refused); with no key, or one of another script, by the code. */
export function refuseKey(code, key) {
  return fixedWhy(code) || letterWhy(letterOf(code, key));
}
/** "" when the pad id can be bound, else the exact refusal line; start = START's printed word on the controller in hand (padfamily refuseBtnFor). */
export function refuseBtn(id, start = "START") {
  if (id === "START") return start + " IS PAUSE · PICK ANOTHER";
  if (id === "LS" || id === "RS") return "STICKS ALWAYS MOVE · PICK ANOTHER";
  if (id === "dU" || id === "dD" || id === "dL" || id === "dR") return "D-PAD ALWAYS MOVES · PICK ANOTHER";
  return CAPTURABLE.includes(id) ? "" : "THAT BUTTON CANNOT BE BOUND · PICK ANOTHER";
}

const keyOk = (code) => typeof code === "string" && fixedWhy(code) === ""; // a stored bind is judged by its place only: the layout it was made on is not known here
const keyBlockOk = (k) => {
  if (!k || typeof k !== "object" || !Array.isArray(k.MOVE) || k.MOVE.length !== 4) return false;
  const all = [...k.MOVE, ...ACTIONS.map((a) => k[a])];
  return all.every(keyOk) && new Set(all).size === 8;
};
const padOk = (p) => {
  if (!p || typeof p !== "object") return false;
  const all = ACTIONS.map((a) => p[a]);
  return all.every((id) => CAPTURABLE.includes(id)) && new Set(all).size === 4;
};
/* Nearest level; a tie takes the bigger deadzone, because a stick that walks on after you let go is the worse mistake. */
const nearDead = (n) => SENS_LEVELS.reduce((a, b) => (Math.abs(b.dead - n) < Math.abs(a.dead - n) || (Math.abs(b.dead - n) === Math.abs(a.dead - n) && b.dead > a.dead) ? b : a)).dead;
const vibOk = (v) => Number.isInteger(v) && v >= 0 && v < VIB_LEVELS.length;
/* A valid vib wins; an older store's rumble 0 is OFF and 1 is MEDIUM. */
const vibOf = (r) => (vibOk(r.vib) ? r.vib : r.rumble === 0 ? 0 : VIB_DEF);
const clampStep = (i, d, n) => Math.max(0, Math.min(n - 1, i + Math.sign(d)));
/** One clamped step along VIB_LEVELS; a bad value reads as the default. */
export function stepVib(v, d) {
  return clampStep(vibOk(v) ? v : VIB_DEF, d, VIB_LEVELS.length);
}
/** One clamped step along SENS_LEVELS, d > 0 towards MAX; takes and returns the stored dead. */
export function stepSens(dead, d) {
  const at = SENS_LEVELS.findIndex((l) => l.dead === nearDead(typeof dead === "number" && Number.isFinite(dead) ? dead : DEF_CONTROLS.dead));
  return SENS_LEVELS[clampStep(at, d, SENS_LEVELS.length)].dead;
}
/** Normalises any raw value; a bad key block or a bad pad block resets that device only. A bad vib or rumble never touches the binds. */
export function clampControls(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const key = keyBlockOk(r.key) ? { ...Object.fromEntries(ACTIONS.map((a) => [a, r.key[a]])), MOVE: [...r.key.MOVE] } : { ...DEF_KEY, MOVE: [...DEF_KEY.MOVE] };
  const good = padOk(r.pad) && (r.stick === "L" || r.stick === "R") && typeof r.dead === "number" && Number.isFinite(r.dead);
  const v = vibOf(r), vib = v === 0 || good ? v : VIB_DEF; // a stored OFF is the player's choice, even when the rest of the pad block resets
  const pad = good ? { ...Object.fromEntries(ACTIONS.map((a) => [a, r.pad[a]])) } : { ...DEF_PAD };
  return freeze({ key, pad, stick: good ? r.stick : "L", dead: good ? nearDead(r.dead) : DEF_CONTROLS.dead, rumble: vib > 0 ? 1 : 0, vib }); // rumble stays written: an older cached page throws away the pad block without it
}
/** Reads the saved controls; anything wrong loads the defaults. */
export function loadControls(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.getItem !== "function") return DEF_CONTROLS;
    const raw = st.getItem(CONTROLS_KEY);
    if (raw === null) return DEF_CONTROLS;
    const o = JSON.parse(raw);
    return o && o.v === 1 ? clampControls(o) : DEF_CONTROLS;
  } catch (_) {
    return DEF_CONTROLS;
  }
}
/** Writes the controls; never throws. */
export function saveControls(c, store) {
  try {
    const st = store || defaultStore();
    if (st && typeof st.setItem === "function") st.setItem(CONTROLS_KEY, JSON.stringify({ v: 1, ...clampControls(c) }));
  } catch (_) {}
}

const NAMES = { Period: ".", Comma: ",", Slash: "/", Semicolon: ";", Quote: "'", Minus: "-", Equal: "=", Backquote: "`", Backslash: "\\" };
/** Label for a key code; a printed single character wins so a layout reads true. */
export function keyName(code, key) {
  if (code === "Space" || key === " ") return "SPACE";
  if (typeof key === "string" && key.length === 1) return key.toUpperCase();
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith("Arrow")) return code.slice(5).toUpperCase();
  return code.replace(/^Key/, "").replace(/^Digit/, "").replace(/^Numpad/, "NUM ").toUpperCase();
}
const nameIn = (code, names) => keyName(code, names && names[code]);
/** MOVE set as it reads on a keyboard (UP LEFT DOWN RIGHT, WASD); names = code to printed character, when known. */
export function moveLabel(move, names) {
  return [move[0], move[3], move[2], move[1]].map((c) => nameIn(c, names)).join("");
}

const SAME = (c) => ({ c, kind: "same", other: null, line: "NO CHANGE" });
/** Rebinds one action to a key; a held key swaps with its owner. The line reads through names when given. */
export function bindKey(c, action, code, names) {
  const why = refuseKey(code, names && names[code]);
  if (why) return { c, kind: "refused", other: null, line: why };
  const old = c.key[action];
  if (code === old) return SAME(c);
  const n = thaw(c), mi = c.key.MOVE.indexOf(code);
  n.key[action] = code;
  if (mi >= 0) {
    const d = MOVE_ORDER[mi];
    n.key.MOVE[mi] = old;
    return { c: freeze(n), kind: "move", other: d, line: nameIn(code, names) + " WAS MOVE " + d + " · MOVE " + d + " NOW " + nameIn(old, names) };
  }
  const other = ACTIONS.find((a) => a !== action && c.key[a] === code);
  if (other) {
    n.key[other] = old;
    return { c: freeze(n), kind: "swap", other, line: nameIn(code, names) + " WAS " + other + " · " + other + " NOW " + nameIn(old, names) };
  }
  return { c: freeze(n), kind: "set", other: null, line: action + " NOW " + nameIn(code, names) };
}
/** Commits a four-key MOVE set; an action key inside it takes a freed old MOVE key. */
export function bindMoveSet(c, codes, names) {
  const bad = Array.isArray(codes) && codes.length === 4 ? codes.map((q) => refuseKey(q, names && names[q])).find(Boolean) : "THAT KEY CANNOT BE BOUND";
  if (bad) return { c, moved: [], line: bad };
  if (new Set(codes).size !== 4) return { c, moved: [], line: "ALREADY IN THIS MOVE SET" };
  const n = thaw(c), free = c.key.MOVE.filter((q) => !codes.includes(q)), moved = [];
  for (const a of ACTIONS) if (codes.includes(c.key[a])) { n.key[a] = free.shift(); moved.push(a); }
  n.key.MOVE = [...codes];
  return { c: freeze(n), moved, line: "MOVE NOW " + moveLabel(codes, names) };
}
/** Rebinds one action to a pad button; a held button swaps with its owner. */
export function bindBtn(c, action, id) {
  const why = refuseBtn(id);
  if (why) return { c, kind: "refused", other: null, line: why };
  const old = c.pad[action];
  if (id === old) return SAME(c);
  const n = thaw(c), other = ACTIONS.find((a) => a !== action && c.pad[a] === id);
  n.pad[action] = id;
  if (other) {
    n.pad[other] = old;
    return { c: freeze(n), kind: "swap", other, line: BTN[id].w + " WAS " + other + " · " + other + " NOW " + BTN[old].w };
  }
  return { c: freeze(n), kind: "set", other: null, line: action + " NOW " + BTN[id].w };
}
/** Restores one device; the pad also gets sensitivity MEDIUM, L-STICK and vibration MEDIUM, but a chosen OFF stays OFF. */
export function resetDevice(c, dev) {
  const n = thaw(c);
  if (dev === "key") n.key = { ...DEF_KEY, MOVE: [...DEF_KEY.MOVE] };
  else { n.pad = { ...DEF_PAD }; n.dead = DEF_CONTROLS.dead; n.vib = c.vib === 0 ? 0 : VIB_DEF; n.rumble = n.vib > 0 ? 1 : 0; n.stick = "L"; }
  return freeze(n);
}
/** J and X plant while BOMB is Space, each only while bound to nothing else. */
export function softAliases(c) {
  if (c.key.BOMB !== "Space") return [];
  const used = new Set([...c.key.MOVE, ...ACTIONS.map((a) => c.key[a])]);
  return ["KeyJ", "KeyX"].filter((k) => !used.has(k));
}
/** The keys a player plays with: the MOVE set and the four actions (no silent alias: see shortcutOf's callers). */
export const playKeys = (k) => new Set([...k.MOVE, ...ACTIONS.map((a) => k[a])]);
/** Every key code the game owns, for preventDefault. */
export function boundKeys(c) {
  return new Set([...c.key.MOVE, ...ACTIONS.map((a) => c.key[a]), ...softAliases(c)]);
}
