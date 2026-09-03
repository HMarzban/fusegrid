import { clampHeat, heatScore } from "../core/heat.js";
import { clampPact } from "../core/pact.js";

export const HS_KEY = "nb.highscores.v1";
export const DEFAULT_SCORES = Object.freeze(
  [
    { s: 5000, l: 5 },
    { s: 3800, l: 4 },
    { s: 2900, l: 4 },
    { s: 2200, l: 3 },
    { s: 1700, l: 3 },
    { s: 1250, l: 2 },
    { s: 900, l: 2 },
    { s: 600, l: 1 },
    { s: 400, l: 1 },
    { s: 250, l: 1 },
  ].map((r) => Object.freeze({ s: r.s, l: r.l, d: "2026-08-23" })),
);

function defaultStore() {
  try {
    if (typeof window !== "undefined" && window.localStorage)
      return window.localStorage;
  } catch (_) {}
  return null;
}
function copyDefaults() {
  return DEFAULT_SCORES.map((r) => ({ s: r.s, l: r.l, d: r.d }));
}
function isRow(r) {
  return (
    !!r &&
    typeof r === "object" &&
    !Array.isArray(r) &&
    Number.isFinite(r.s) &&
    Number.isFinite(r.l) &&
    typeof r.d === "string" &&
    r.d.length <= 32 &&
    (r.p == null || (Number.isFinite(r.p) && (r.p | 0) === clampPact(r.p)))
  );
}

export function loadScores(store) {
  let raw = null;
  try {
    const st = store || defaultStore();
    if (!st || typeof st.getItem !== "function") return copyDefaults();
    raw = st.getItem(HS_KEY);
  } catch (_) {
    return copyDefaults();
  }
  if (typeof raw !== "string") return copyDefaults();
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v) || v.length > 10 || !v.every(isRow))
      return copyDefaults();
    return v.map((r) => {
      const o = { s: r.s, l: r.l, d: r.d };
      if (r.t) o.t = r.t | 0;
      if (r.p) o.p = clampPact(r.p);
      return o;
    });
  } catch (_) {
    return copyDefaults();
  }
}

export function recordScore(list, entry) {
  const t = Number.isFinite(entry.t) ? entry.t | 0 : 0;
  const row = { s: entry.s, l: entry.l, d: entry.d };
  const pact = clampPact(entry.p);
  if (pact) row.p = pact;
  if (t) row.t = clampHeat(t);
  return [...list, row]
    .sort(
      (a, b) =>
        b.s - a.s ||
        (b.t | 0) - (a.t | 0) ||
        (b.p | 0) - (a.p | 0) ||
        b.l - a.l ||
        (a.d < b.d ? -1 : a.d > b.d ? 1 : 0),
    )
    .slice(0, 10);
}

export function scoreEntry(world, date) {
  const t = world.heat | 0;
  const p = clampPact(world.pact);
  const row = {
    s: heatScore(world.score, t),
    l: world.level,
    d: date,
  };
  if (t) row.t = t;
  if (p) row.p = p;
  return row;
}

export function qualifies(score, list) {
  return list.length < 10 || score > list[list.length - 1].s;
}

export function saveScores(list, store) {
  try {
    const st = store || defaultStore();
    if (st && typeof st.setItem === "function")
      st.setItem(HS_KEY, JSON.stringify(list));
  } catch (_) {}
}
