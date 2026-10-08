import { HS_KEY } from "./highscores.js";
import { BESTS_KEY } from "./bests.js";
import { STATS_KEY } from "./stats.js";
import { DAILY_KEY } from "./daily.js";
import { TIMES_KEY } from "./times.js";
import { MEDALS_KEY } from "./medals.js";
import { PLAQUES_KEY } from "./plaques.js";
import { GHOST_KEY } from "./ghost.js";
import { PACT_KEY } from "./pactstore.js";
import { COACH_KEY, COACH2_KEY } from "./coach.js";
import { CABINET_KEY } from "./cabinetseen.js";
import { SETTINGS_KEY } from "./settings.js";
import { PACE_KEY } from "./pacestore.js";
import { defaultStore } from "./store.js";

export const CLEAR_KEYS = Object.freeze([HS_KEY, BESTS_KEY, STATS_KEY, DAILY_KEY, TIMES_KEY, MEDALS_KEY,
  PLAQUES_KEY, GHOST_KEY, PACT_KEY, COACH_KEY, COACH2_KEY, CABINET_KEY]);
export const KEEP_KEYS = Object.freeze([SETTINGS_KEY, PACE_KEY]);

export function clearCabinet(store) {
  let st = null;
  try { st = store || defaultStore(); } catch (_) {}
  if (!st || typeof st.removeItem !== "function") return;
  for (const k of CLEAR_KEYS) {
    try { st.removeItem(k); } catch (_) {}
  }
}
