// Which controller is in the player's hands, and the words its buttons wear (owner ruling R-LABELS, 2026-11-14). Pure. The id is matched here and
// nowhere else: never printed, never stored, never sent. Positions stay the ids, the binds and the store; only what a player reads follows the family.
import { BTN, refuseBtn } from "./controls.js";

export const FAMILIES = Object.freeze(["xbox", "playstation", "nintendo", "generic"]);
const VENDOR = Object.freeze({ "045e": "xbox", "054c": "playstation", "057e": "nintendo" });
const NAMED = [[/xbox/i, "xbox"], [/dualsense|dualshock|playstation/i, "playstation"], [/pro controller|joy-con|switch/i, "nintendo"]];

const memo = new Map();
/** "xbox" | "playstation" | "nintendo" | "generic" from a Gamepad id: the vendor id first (Chrome's "Vendor: 045e", Firefox's leading "045e-028e-",
    unpadded on macOS: "54c-9cc-"), then the name. Memoized per id string: the poller asks every frame. */
export function familyOf(id) {
  if (typeof id !== "string" || !id) return "generic";
  let f = memo.get(id);
  if (f) return f;
  const m = /vendor:\s*([0-9a-f]{4})\b/i.exec(id) || /^([0-9a-f]{1,4})-[0-9a-f]{1,4}-/i.exec(id);
  f = (m && VENDOR[m[1].toLowerCase().padStart(4, "0")]) || (NAMED.find(([re]) => re.test(id)) || [, "generic"])[1];
  if (memo.size >= 8) memo.clear();
  memo.set(id, f);
  return f;
}

const IDS = ["S", "E", "W", "N", "SHL", "SHR", "TRL", "TRR", "SELECT", "START"];
/* per family, id -> [printed word, short word, spoken word]; a missing short or spoken word is the printed one */
const ROWS = {
  xbox: { S: ["A"], E: ["B"], W: ["X"], N: ["Y"], SHL: ["LB"], SHR: ["RB"], TRL: ["LT"], TRR: ["RT"], SELECT: ["VIEW"], START: ["MENU"] },
  playstation: { S: ["CROSS"], E: ["CIRCLE"], W: ["SQUARE"], N: ["TRIANGLE"], SHL: ["L1"], SHR: ["R1"], TRL: ["L2"], TRR: ["R2"], SELECT: ["CREATE"], START: ["OPTIONS"] },
  nintendo: { S: ["B"], E: ["A"], W: ["Y"], N: ["X"], SHL: ["L"], SHR: ["R"], TRL: ["ZL"], TRR: ["ZR"], SELECT: ["−", "−", "MINUS"], START: ["+", "+", "PLUS"] },
  generic: Object.fromEntries(IDS.map((id) => [id, [BTN[id].w, BTN[id].s]])),
};
/** Per family, per button: w the printed word, s the short word, a the word the live region says. PlayStation's four faces are drawn as the
    ✕ ○ □ △ glyphs wherever a keycap is painted (kit/paint.js reads the word); the word stands wherever only text fits. */
export const FAMILY_LABEL = Object.freeze(Object.fromEntries(FAMILIES.map((f) => [f, Object.freeze(Object.fromEntries(IDS.map((id) => {
  const [w, s, a] = ROWS[f][id];
  return [id, Object.freeze({ w, s: s || w, a: a || w })];
})))])));
const famOf = (f) => (FAMILY_LABEL[f] ? f : "generic");
/** The printed word for a position id on this family; ids the family table does not hold (the D-PAD, the sticks) keep BTN's word. */
export const btnWord = (id, f) => (FAMILY_LABEL[famOf(f)][id] || BTN[id] || { w: id }).w;
/** The word the live region says for a position id on this family. */
export const btnSay = (id, f) => { const q = FAMILY_LABEL[famOf(f)][id]; return q ? q.a : (BTN[id] || { w: id }).w; };
/** The shoulders as the tab keys read: SHOULDERS on a generic pad, else the pair (LB RB, L1 R1, L R). */
export const tabWord = (f) => (famOf(f) === "generic" ? "SHOULDERS" : btnWord("SHL", f) + " " + btnWord("SHR", f));
/** The capture's refusal for a pad id, START named the way the controller in hand prints it (MENU, OPTIONS, +); a generic pad: refuseBtn's line. */
export const refuseBtnFor = (id, f) => refuseBtn(id, btnWord("START", f));
/** PlayStation's four face words as the characters a DOM keycap shows (words.js PAD_GLYPH_CHAR, pinned in tests/words.test.mjs). */
export const GLYPH_CHAR = Object.freeze({ CROSS: "✕", CIRCLE: "○", SQUARE: "□", TRIANGLE: "△" });
/** A DOM keycap's legend (the cards are HTML, not the kit painter): PlayStation's faces as the ✕ ○ □ △ characters, every other button its printed word. */
export const btnCap = (id, f) => { const w = btnWord(id, f); return GLYPH_CHAR[w] || w; };
