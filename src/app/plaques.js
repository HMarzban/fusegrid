import { isFinale } from "../core/config.js";
import { defaultStore } from "./store.js";

export const PLAQUES_KEY = "nb.plaques.v1";
export const PLAQUE = Object.freeze({ CLEAR: 1, PLUS: 2, MAX: 4, CROWN: 8 });

export function loadPlaques(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.getItem !== "function") return 0;
    const raw = st.getItem(PLAQUES_KEY);
    if (raw === null) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? (n | 0) & 15 : 0;
  } catch (_) {
    return 0;
  }
}

export function savePlaques(mask, store) {
  try {
    const st = store || defaultStore();
    if (st && typeof st.setItem === "function")
      st.setItem(PLAQUES_KEY, String((mask | 0) & 15));
  } catch (_) {}
}

export function unlockPlaques(mask, world) {
  let m = mask | 0;
  if (world.finale || isFinale(world.level)) m |= PLAQUE.CLEAR;
  if ((world.heat | 0) >= 1 && (world.finale || isFinale(world.level)))
    m |= PLAQUE.PLUS;
  if ((world.heat | 0) >= 2 && (world.finale || isFinale(world.level)))
    m |= PLAQUE.MAX;
  if ((world.level | 0) >= 8) m |= PLAQUE.CROWN;
  return m;
}
