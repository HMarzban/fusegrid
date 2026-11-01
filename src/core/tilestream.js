/* STREAM (#26): see docs/superpowers/specs/2026-11-01-tiles-wave-2-3-design.md section 3.
   Water carries resting bombs (sim.js carryBomb) and slows walkers; nobody rides.
   The wade reads the tile under the walker's centre, in any direction. */
import { CFG, T, key } from "./config.js";
import { featProfile, isStream } from "./feat.js";

export function streamSpeed(w, x, y) {
  const k = key(Math.floor(x / CFG.TILE), Math.floor(y / CFG.TILE));
  return isStream(w.feat[k]) && w.grid[k] === T.EMPTY ? featProfile(w).stream.wade : 1;
}
