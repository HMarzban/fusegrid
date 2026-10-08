import { clampHeat } from "../core/heat.js";
import { clampPact } from "../core/pact.js";
import { clampPace } from "../core/pace.js";
import { defaultStore } from "./store.js";

export const MEDALS_KEY = "nb.medals.v1";
export const MEDAL = Object.freeze({ FLAWLESS: 1, UNSCATHED: 2, ALLIN: 4, ALLOUT: 8,
  OVERDRIVE: 16, REDLINE: 32, SPRINT: 64, IRONCROWN: 128 });
export const MEDAL_ROWS = Object.freeze([
  ["FLAWLESS", "ROOMS 1-5 IN ONE RUN · NO LIFE LOST"],
  ["UNSCATHED", "ROOMS 6-8 IN ONE RUN · NO LIFE LOST"],
  ["ALL IN", "ROOMS 1-5 IN ONE RUN · ALL FOUR PACTS"],
  ["ALL OUT", "ROOMS 6-8 IN ONE RUN · ALL FOUR PACTS"],
  ["OVERDRIVE", "ROOMS 1-5 IN ONE RUN ON HARD PACE"],
  ["REDLINE", "ROOMS 6-8 IN ONE RUN ON HARD PACE"],
  ["SPRINT", "ROOMS 1-5 · CORE · NORM · NO PACT · UNDER 3:00"],
  ["IRON CROWN", "ROOMS 6-8 IN ONE RUN AT MAX HEAT"],
]);
export const SPRINT_S = 180;

export function loadMedals(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.getItem !== "function") return 0;
    const raw = st.getItem(MEDALS_KEY);
    if (raw === null) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? (n | 0) & 255 : 0;
  } catch (_) {
    return 0;
  }
}

export function saveMedals(mask, store) {
  try {
    const st = store || defaultStore();
    if (st && typeof st.setItem === "function")
      st.setItem(MEDALS_KEY, String((mask | 0) & 255));
  } catch (_) {}
}

export function unlockMedals(world, tally, runT) {
  const w = world || {}, t = tally || {};
  const win = w.state === "WIN", lv = w.level | 0, r = t.r | 0, d = t.d | 0;
  const clear5 = win && lv === 5 && r === 5, clear8 = win && lv === 8 && r === 3;
  const heat = clampHeat(w.heat), pact = clampPact(w.pact), pace = clampPace(w.pace);
  let m = 0;
  if (clear5 && d === 0) m |= MEDAL.FLAWLESS;
  if (clear8 && d === 0) m |= MEDAL.UNSCATHED;
  if (clear5 && pact === 15) m |= MEDAL.ALLIN;
  if (clear8 && pact === 15) m |= MEDAL.ALLOUT;
  if (clear5 && pace === 1) m |= MEDAL.OVERDRIVE;
  if (clear8 && pace === 1) m |= MEDAL.REDLINE;
  if (clear5 && heat === 0 && pact === 0 && pace === 0 && runT < SPRINT_S) m |= MEDAL.SPRINT;
  if (clear8 && heat === 2) m |= MEDAL.IRONCROWN;
  return m;
}

export function settleMedals(world, tally, runT, store) {
  const prev = loadMedals(store);
  const next = prev | unlockMedals(world, tally, runT);
  if (next !== prev) saveMedals(next, store);
  return loadMedals(store) & ~prev;
}

const names = (bits) => MEDAL_ROWS.filter((_, i) => (bits >> i) & 1).map((r) => r[0]);
export function medalLine(bits) {
  const n = names(bits | 0);
  if (!n.length) return "";
  if (n.length === 1) return "MEDAL · " + n[0];
  if (n.length <= 3) return "MEDALS · " + n.join(" · ");
  return n.length + " NEW MEDALS";
}

export function medalRows(mask) {
  return MEDAL_ROWS.map(([name, desc], i) => [name, desc, (((mask | 0) >> i) & 1) === 1]);
}
