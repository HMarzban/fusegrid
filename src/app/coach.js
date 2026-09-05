import { defaultStore } from "./store.js";

export const COACH_KEY = "nb.coach.v1";
export const COACH_DUR = 3;

export function loadCoachSeen(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.getItem !== "function") return false;
    return st.getItem(COACH_KEY) === "1";
  } catch (_) {
    return false;
  }
}

export function saveCoachSeen(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.setItem !== "function") return;
    st.setItem(COACH_KEY, "1");
  } catch (_) {}
}

export function coachOpen(seen, time, planted) {
  return !seen && time < COACH_DUR && !planted;
}
