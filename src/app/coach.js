import { defaultStore } from "./store.js";
import { POWER } from "../core/entities.js";

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

export const COACH2_KEY = "nb.coach.v2";
/* Same duration as v1 on purpose: one timing rule for both panels, so a change
   to how long a nudge lingers is a change in one place. */
export const COACH2_DUR = COACH_DUR;
/* Three verbs the player has no way to discover, one bit each, once ever. */
const TIPS = ["kick", "throw", "remote"];
const FIELD = { kick: "k", throw: "t", remote: "r" };
const bit = (v) => (v ? 1 : 0);

export function loadCoach2(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.getItem !== "function") return { k: 0, t: 0, r: 0 };
    const raw = st.getItem(COACH2_KEY);
    const o = raw === null ? {} : JSON.parse(raw);
    const v = o && typeof o === "object" ? o : {};
    return { k: bit(v.k), t: bit(v.t), r: bit(v.r) };
  } catch (_) {
    return { k: 0, t: 0, r: 0 };
  }
}

export function saveCoach2(v, store) {
  try {
    const st = store || defaultStore();
    const o = v && typeof v === "object" ? v : {};
    if (st && typeof st.setItem === "function")
      st.setItem(COACH2_KEY, JSON.stringify({ k: bit(o.k), t: bit(o.t), r: bit(o.r) }));
  } catch (_) {}
}

export function coach2Seen(v, kind) {
  const f = FIELD[kind];
  return !!f && !!(v && v[f]);
}

export function coach2Mark(v, kind) {
  const cur = { k: bit(v && v.k), t: bit(v && v.t), r: bit(v && v.r) };
  const f = FIELD[kind];
  if (f) cur[f] = 1;
  return cur;
}

/* The copy is NOT new copy: POWER already ships one-line help for exactly these
   three verbs and the ITEMS help screen already shows those strings, so writing
   three more would create a second source that drifts. Composed here rather than
   in render/, because scenes.js states in its own words that main.js precomputes
   what the panel draws and render/ never re-derives it. */
export function coachTip(kind) {
  if (TIPS.indexOf(kind) < 0) return "";
  const d = POWER.find((x) => x.t === kind);
  return d ? d.name + " · " + d.help : "";
}

/* The whole v2 transition, so main.js stays a lean browser entry: advance the
   PLAY-only clock, close a live tip when its verb is used or its window
   elapses, then open at most one new tip. Returns the stat rows for main to
   emit — this module does not know about nb.stats.v1.
   v1 wins ties: while the ghost coach is open a trigger is deferred to the frame
   v1 closes, so a first-timer never sees two panels. One tip at a time: a new
   trigger replaces a live one and marks it seen immediately, so a player who
   grabs two verbs in one blast gets one tip now and never the other. Disclosed. */
export function coach2Tick(st, world, v1Open, dt, store) {
  const out = [];
  const w = world || {};
  const ev = Array.isArray(w.events) ? w.events : [];
  if (w.state === "PLAY") st.t += typeof dt === "number" && isFinite(dt) ? dt : 0;
  if (st.kind) {
    const used = ev.some((e) => e && e.t === st.kind);
    if (used || st.t >= COACH2_DUR) {
      saveCoach2(coach2Mark(loadCoach2(store), st.kind), store);
      out.push(["coach_dismissed", { v: st.kind, rn: used ? "use" : "timeout" }]);
      st.kind = null;
    }
  }
  if (v1Open) return out;
  for (const e of ev) {
    if (!e || e.t !== "power" || TIPS.indexOf(e.kind) < 0) continue;
    if (coach2Seen(loadCoach2(store), e.kind)) continue;
    if (st.kind) saveCoach2(coach2Mark(loadCoach2(store), st.kind), store);
    st.kind = e.kind;
    st.t = 0;
    out.push(["coach_shown", { v: e.kind }]);
  }
  return out;
}
