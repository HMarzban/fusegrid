/* KIT COPY (R1): words more than one page paints, all from words.js (the one table). lookVal: the RENDER row's job words, longest first (n = menudraw
   lookNote's note). */
import {hints} from "../hintcopy.js";
import {ART_STYLES, LOAD_WORDS, BACK_TAP, FOOT_TAP, LOOK_WORDS as LW} from "../words.js";

export {LOAD_WORDS, BACK_TAP, FOOT_TAP};
export const LOOK_NAME = Object.freeze({px: ART_STYLES[1], "3d": ART_STYLES[2]});
/* tap: the page's tap mode (hintcopy tapAt) */
export function lookVal(n, tap) {
  const L = LOOK_NAME[n.k] || "", F = LOAD_WORDS.failed;
  if (n.st === "fail") { const r = tap ? LW.TAP_RETRY : hints().ok + " " + LW.RETRY; return [L + " · " + F + " · " + r, F + " · " + r, r]; } // r alone, in the danger colour: the narrowest box, where ART STYLE (longer than RENDER) leaves less room
  if (n.st === "ready") return [L + " · " + LW.READY, LW.READY];
  const cnt = n.total > 0 ? n.done + " / " + n.total : "";
  const s = n.st === "loading" ? (n.slow ? LW.SLOW : cnt || LOAD_WORDS.loading) : LW.PH[n.phase] && cnt ? LW.PH[n.phase] + " " + cnt : LW.PREPARING;
  return [L + " · " + s, s];
}
