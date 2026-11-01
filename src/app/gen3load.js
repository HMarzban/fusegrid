/* Boot seam for ?gen=3 (download size): createGame deals its first board
   synchronously, so the gen-3 code (src/core/board3.js + the tile checks) must be
   in before it runs. A page without the flag calls go() right here, in the same
   tick, and never fetches them; a failed fetch rejects and the game does not boot,
   never a tile-free board on a ?gen=3 page. readFlags keeps "a ?code= never plays gen 3". */
import { readFlags } from "./flags.js";

export function gen3Boot(search, go) {
  if (!readFlags(search).gen3) return go();
  return import("../core/board3.js").then(go);
}
