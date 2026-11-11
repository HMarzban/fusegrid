/* KIT COPY: the words more than one page paints and that no store owns (R1 kit harmonisation: SETTINGS read them from menudraw).
   LOAD_WORDS a lazy page's LOADING plate line: loading, or failed after an import did not land.
   FOOT_TAP   the tap model OPTIONS, GRAPHICS and CONTROLS share on a touch layout (a row = Enter, off the plate = back).
   LOOK_NAME  the looks a RENDER job prepares, by kind.
   lookVal    (n, touch) the RENDER row's job words, longest first (the row keeps the first that fits its slot): n = menudraw lookNote's note
              {k, st, phase, done, total, slow}; a failure ends in its retry word (the tap rule's, else the confirm keycap's). */
import {hints, tapMode} from "../hintcopy.js";

export const LOAD_WORDS = Object.freeze({loading: "LOADING", failed: "DID NOT LOAD"});
export const FOOT_TAP = "TAP A ROW TO CHANGE IT · TAP OUTSIDE TO GO BACK";
export const LOOK_NAME = Object.freeze({px: "PIXEL", "3d": "REAL 3D"});
const PH_WORD = {bake: "ART", build: "BUILDING", shaders: "SHADERS"};
export function lookVal(n, touch) {
  const L = LOOK_NAME[n.k] || "";
  if (n.st === "fail") { const r = tapMode(touch) ? "TAP TO RETRY" : hints().ok + " RETRY"; return [L + " · DID NOT LOAD · " + r, "DID NOT LOAD · " + r, r]; } // r alone, in the danger colour: the narrowest box, where ART STYLE (longer than RENDER) leaves less room
  if (n.st === "ready") return [L + " · READY", "READY"];
  const cnt = n.total > 0 ? n.done + " / " + n.total : "";
  const s = n.st === "loading" ? (n.slow ? "SLOW, STILL TRYING" : cnt || "LOADING") : PH_WORD[n.phase] && cnt ? PH_WORD[n.phase] + " " + cnt : "PREPARING";
  return [L + " · " + s, s];
}
