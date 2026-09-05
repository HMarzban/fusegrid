import { defaultStore } from "./store.js";

export const SETTINGS_KEY = "nb.settings.v1";
/* One blob, one key. Stored as whole percent, consumed as a scalar
   (mus/100, sfx/100, bri/100) so the JSON stays readable and the clamp table
   below is the only place a range lives. Per-key would mean six modules, six
   SRC entries and six load/save pairs for one screen's state. */
export const DEFAULTS = Object.freeze({
  mus: 100,
  sfx: 100,
  snd: 1,
  r3d: 0,
  cam: 0,
  bri: 100,
  shk: 1,
  flx: 0,
});

const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);
const step10 = (v, lo, hi, d) =>
  Math.min(hi, Math.max(lo, Math.round(num(v, d) / 10) * 10)) | 0;
const bit = (v, d) => {
  if (v === undefined || v === null) return d ? 1 : 0;
  if (typeof v === "number") return isFinite(v) && v ? 1 : 0;
  return v ? 1 : 0;
};

export function clampSettings(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  return {
    mus: step10(o.mus, 0, 100, DEFAULTS.mus),
    sfx: step10(o.sfx, 0, 100, DEFAULTS.sfx),
    snd: bit(o.snd, DEFAULTS.snd),
    r3d: bit(o.r3d, DEFAULTS.r3d),
    cam: Math.min(2, Math.max(0, num(o.cam, DEFAULTS.cam) | 0)),
    bri: step10(o.bri, 70, 130, DEFAULTS.bri),
    shk: bit(o.shk, DEFAULTS.shk),
    flx: bit(o.flx, DEFAULTS.flx),
  };
}

export function loadSettings(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.getItem !== "function") return clampSettings(null);
    const raw = st.getItem(SETTINGS_KEY);
    if (raw === null) return clampSettings(null);
    return clampSettings(JSON.parse(raw));
  } catch (_) {
    return clampSettings(null);
  }
}

export function saveSettings(v, store) {
  try {
    const st = store || defaultStore();
    if (st && typeof st.setItem === "function")
      st.setItem(SETTINGS_KEY, JSON.stringify(clampSettings(v)));
  } catch (_) {}
}
