// The last-used device tracker behind the hints, and the words each device reads. Every t is frame time in ms; dwell is in seconds.
import { BTN, DEF_CONTROLS, keyName, moveLabel } from "./controls.js";
export { helpOf } from "../core/entities.js"; // lives beside POWER: menudraw may not import src/app, and src/app may not import src/render

const SRC = new Set(["key", "pad", "touch"]);
const MOD_CODE = /^(Shift|Control|Alt|Meta|OS)(Left|Right)?$|^(AltGraph|CapsLock|Fn|FnLock|NumLock|ScrollLock|Symbol|SymbolLock|Hyper|Super|ContextMenu)$/;
const STICK_ON = 0.5, STICK_OFF = 0.35;

/** "key" for a real key press, null for a modifier, a lock key or an auto-repeat. */
export const keyPress = (e) => (!e || e.repeat || MOD_CODE.test(e.code || "") || MOD_CODE.test(e.key || "") ? null : "key");
/** "touch" for a finger or a pen; a mouse, a move or a wheel is null. */
export const pointerPress = (e) => (e && (e.pointerType === "touch" || e.pointerType === "pen") ? "touch" : null);

/** Tracks the device the hints name: flips on a real press only, at most once per dwell, and the last press wins. */
export function createHintDev({ lay, dwell = 0.75 } = {}) {
  const ms = dwell * 1000, boot = () => (!lay || lay() === "d" ? "key" : "touch");
  let shown = null, want = null, flipT = -Infinity, over = false;
  const now = () => shown || boot();
  const settle = (t) => { if (want && want !== now() && t - flipT >= ms) { shown = want; flipT = t; } };
  const note = (src, t) => { if (SRC.has(src)) { want = src; settle(t); } };
  return {
    note,
    /** A keydown event. */
    key: (e, t) => note(keyPress(e), t),
    /** A pointer event. */
    pointer: (e, t) => note(pointerPress(e), t),
    /** A PadSnap: any button, or the stick crossing 0.50 (a stuck stick claims once, then needs to fall under 0.35). */
    pad(s, t) {
      if (!s) return;
      const up = s.mag >= STICK_ON && !over;
      if (s.mag >= STICK_ON) over = true; else if (!(s.mag >= STICK_OFF)) over = false;
      if (up || (s.press && s.press.length)) note("pad", t);
    },
    /** The device to name at t. */
    device(t) { settle(t); return now(); },
  };
}

/** The words a device reads under these binds; CONFIRM and BACK are fixed on both devices. */
export function wordsOf(dev, c) {
  const b = c || DEF_CONTROLS;
  if (dev === "pad") return { dev, ok: "SOUTH", back: "EAST", tab: "SHOULDERS", pause: "START", bomb: BTN[b.pad.BOMB].w, throw: BTN[b.pad.THROW].w, remote: BTN[b.pad.REMOTE].w, move: "D-PAD", moveAlt: b.stick === "R" ? "R-STICK" : "L-STICK", moveCaps: null, tapPage: false };
  return { dev, ok: "ENTER", back: "ESC", tab: "[ ]", pause: keyName(b.key.PAUSE), bomb: keyName(b.key.BOMB), throw: keyName(b.key.THROW), remote: keyName(b.key.REMOTE), move: moveLabel(b.key.MOVE), moveAlt: "ARROWS", moveCaps: [0, 3, 2, 1].map((i) => keyName(b.key.MOVE[i])), tapPage: dev === "touch" };
}
