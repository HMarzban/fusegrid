// Hint words, set from the app side and read by the render side (fx.js setFxOpts idiom). Imports nothing; tests pin KEYS equal to hints.js wordsOf("key", defaults).
const KEYS = Object.freeze({ dev: "key", ok: "ENTER", back: "ESC", tab: "[ ]", pause: "P", bomb: "SPACE", throw: "E", remote: "Q", move: "WASD", moveAlt: "ARROWS", moveCaps: Object.freeze(["W", "A", "S", "D"]), tapPage: false });
let cur = KEYS;
/** Hands in the words every hint reads; null restores the keyboard defaults. */
export function setHints(w) { cur = w || KEYS; }
/** The current words. */
export const hints = () => cur;
/** True where a touch layout's text should name taps: geometry stays on data-lay, text follows the device. */
export const tapMode = (touch) => !!touch && cur.dev !== "pad";
