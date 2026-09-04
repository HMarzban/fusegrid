import { defaultStore } from "./store.js";

export const PACT_KEY = "nb.pact.v1";

export function loadPactUnlocked(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.getItem !== "function") return false;
    return st.getItem(PACT_KEY) === "1";
  } catch (_) {
    return false;
  }
}

export function savePactUnlocked(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.setItem !== "function") return false;
    st.setItem(PACT_KEY, "1");
    return true;
  } catch (_) {
    return false;
  }
}
