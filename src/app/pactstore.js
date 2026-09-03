export const PACT_KEY = "nb.pact.v1";

function defaultStore() {
  try {
    if (typeof window !== "undefined" && window.localStorage)
      return window.localStorage;
  } catch (_) {}
  return null;
}

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
