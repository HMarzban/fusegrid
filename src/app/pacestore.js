import { clampPace } from "../core/pace.js";

export const PACE_KEY = "nb.pace.v1";

function defaultStore() {
  try {
    if (typeof window !== "undefined" && window.localStorage)
      return window.localStorage;
  } catch (_) {}
  return null;
}

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
