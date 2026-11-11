/* KIT COPY (R1): words more than one page paints. lookVal: the RENDER row's job words, longest first (n = menudraw lookNote's note). */
import {hints, tapMode} from "../hintcopy.js";
import {ART_STYLES} from "../words.js";

export const LOAD_WORDS = Object.freeze({loading: "LOADING", failed: "DID NOT LOAD"});
export const BACK_TAP = "TAP OUTSIDE TO GO BACK";
export const FOOT_TAP = "TAP A ROW TO CHANGE IT · " + BACK_TAP;
export const LOOK_NAME = Object.freeze({px: ART_STYLES[1], "3d": ART_STYLES[2]});
const PH_WORD = {bake: "ART", build: "BUILDING", shaders: "SHADERS"};
export function lookVal(n, touch) {
  const L = LOOK_NAME[n.k] || "";
  if (n.st === "fail") { const r = tapMode(touch) ? "TAP TO RETRY" : hints().ok + " RETRY"; return [L + " · DID NOT LOAD · " + r, "DID NOT LOAD · " + r, r]; } // r alone, in the danger colour: the narrowest box, where ART STYLE (longer than RENDER) leaves less room
  if (n.st === "ready") return [L + " · READY", "READY"];
  const cnt = n.total > 0 ? n.done + " / " + n.total : "";
  const s = n.st === "loading" ? (n.slow ? "SLOW, STILL TRYING" : cnt || "LOADING") : PH_WORD[n.phase] && cnt ? PH_WORD[n.phase] + " " + cnt : "PREPARING";
  return [L + " · " + s, s];
}
