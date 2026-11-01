/* Wave 2 / 3 floor tile rules (#26, #27): the seam the sim calls. Every path here
   runs only with world.feat set (gen 3). One module per tile owns its rule. */
import { gateTick } from "./tilegate.js";
import { portalTick } from "./tileportal.js";
import { quickTick, quickSpeed } from "./tilequick.js";
import { streamSpeed } from "./tilestream.js";

export function tileTick(w, dt, emit) {
  quickTick(w, dt, emit);
  gateTick(w, dt, emit);
  portalTick(w, dt, emit);
}
/* a walker's speed multiplier on the tile under (x, y); 1 with no layer */
export function featSpeed(w, x, y, foe) {
  if (!w.feat) return 1;
  return streamSpeed(w, x, y) * (foe ? quickSpeed(w, x, y) : 1);
}
