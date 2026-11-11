// Hint words, set from the app side and read by the render side (fx.js setFxOpts idiom). Imports nothing; tests pin KEYS equal to hints.js wordsOf("key", defaults).
const KEYS = Object.freeze({ dev: "key", ok: "ENTER", back: "ESC", tab: "[ ]", pause: "P", bomb: "SPACE", throw: "E", remote: "Q", move: "WASD", moveAlt: "ARROWS", moveCaps: Object.freeze(["W", "A", "S", "D"]), tapPage: false });
let cur = KEYS;
/** Hands in the words every hint reads; null restores the keyboard defaults. */
export function setHints(w) { cur = w || KEYS; }
/** The current words. */
export const hints = () => cur;
/** The fallback where no page frame says: a touch layout whose hint device is not a controller (a page drawn straight, as tests and the size
    reserve do). Every page frame carries THE tap mode instead (shellview tapOf, R1 cohesion 4), read through tapAt. */
export const tapMode = (touch) => !!touch && cur.dev !== "pad";
/** A page's tap mode: the frame's own (shellview tapOf: a touch layout last driven by touch), else the fallback. */
export const tapAt = (touch, tap) => (tap != null ? !!tap : tapMode(touch));
