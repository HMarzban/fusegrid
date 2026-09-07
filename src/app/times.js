import { clampHeat } from "../core/heat.js";
import { clampPact } from "../core/pact.js";
import { clampPace } from "../core/pace.js";
import { defaultStore } from "./store.js";

export const TIMES_KEY = "nb.times.v1";
export const TIMES_MAX = 96;
/* One key, one module — the load(store)/save(store) template pactstore /
   plaques / pacestore / cabinetseen / coach / settings all share.
   The key is the report's 5-tuple MINUS the seed: a time is only comparable
   against another time at the same room, heat, pact and pace, because paceMul
   scales player speed inside updatePlayer (sim.js:124) and pace is not folded
   into the world's rng seeding. pace is shifted +1 so the segment is 0..2 and
   the whole key is regex-checkable. Values are integer TENTHS of a second, so
   the stored number and the displayed number are the same number. */
const KEY_RE = /^[1-8]:[0-2]:(?:[0-9]|1[0-5]):[0-2]$/;
const MIN_D = 1,
  MAX_D = 5999;

export function timeKey(world) {
  const w = world || {};
  return (
    (w.level | 0) +
    ":" +
    clampHeat(w.heat) +
    ":" +
    clampPact(w.pact) +
    ":" +
    (clampPace(w.pace) + 1)
  );
}

const bit = (v, d) => {
  if (v === undefined || v === null) return d ? 1 : 0;
  if (typeof v === "number") return isFinite(v) && v ? 1 : 0;
  return v ? 1 : 0;
};
const okD = (v) =>
  typeof v === "number" && isFinite(v) && (v | 0) === v && v >= MIN_D && v <= MAX_D;

/* The key form is non-integer-like, so JS preserves insertion order over `b`
   deterministically — which is what makes "drop the FIRST inserted" a defined
   overflow policy rather than a coin flip. */
export function clampTimes(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const src = o.b && typeof o.b === "object" ? o.b : {};
  const keys = Object.keys(src).filter((k) => KEY_RE.test(k) && okD(src[k]));
  const kept = keys.length > TIMES_MAX ? keys.slice(keys.length - TIMES_MAX) : keys;
  const b = {};
  for (const k of kept) b[k] = src[k];
  return { on: bit(o.on, 0), b };
}

export function loadTimes(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.getItem !== "function") return clampTimes(null);
    const raw = st.getItem(TIMES_KEY);
    if (raw === null) return clampTimes(null);
    return clampTimes(JSON.parse(raw));
  } catch (_) {
    return clampTimes(null);
  }
}

export function saveTimes(v, store) {
  try {
    const st = store || defaultStore();
    if (st && typeof st.setItem === "function")
      st.setItem(TIMES_KEY, JSON.stringify(clampTimes(v)));
  } catch (_) {}
}

export function bestOf(v, key) {
  const b = v && v.b;
  const d = b ? b[key] : undefined;
  return okD(d) ? d / 10 : null;
}

/* FLOOR, not round: a stored 412 must display as 0:41.2 and never as a tenth
   the player did not run. Writes only on no-prior or strictly faster, so a
   re-clear at the same time leaves the record alone. */
export function recordTime(v, key, sec) {
  const cur = clampTimes(v);
  if (!KEY_RE.test(key)) return cur;
  const n = typeof sec === "number" && isFinite(sec) ? sec : 0;
  const d = Math.min(MAX_D, Math.max(MIN_D, Math.floor(n * 10)));
  const prior = cur.b[key];
  if (okD(prior) && prior <= d) return cur;
  const b = Object.assign({}, cur.b);
  b[key] = d;
  return clampTimes({ on: cur.on, b });
}
