import { defaultStore } from "./store.js";

export const CABINET_KEY = "nb.cabinet.v1";

export function loadCabinetSeen(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.getItem !== "function") return false;
    return st.getItem(CABINET_KEY) === "1";
  } catch (_) {
    return false;
  }
}

export function saveCabinetSeen(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.setItem !== "function") return;
    st.setItem(CABINET_KEY, "1");
  } catch (_) {}
}
