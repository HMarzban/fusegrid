import { clampPace } from "../core/pace.js";
import { defaultStore } from "./store.js";

export const PACE_KEY = "nb.pace.v1";

export function loadPace(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.getItem !== "function") return 0;
    const raw = st.getItem(PACE_KEY);
    if (raw === null) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? clampPace(n) : 0;
  } catch (_) {
    return 0;
  }
}

export function savePace(pace, store) {
  try {
    const st = store || defaultStore();
    if (st && typeof st.setItem === "function")
      st.setItem(PACE_KEY, String(clampPace(pace)));
  } catch (_) {}
}
