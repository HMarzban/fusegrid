import { clampPace } from "../core/pace.js";
import { defaultStore } from "./store.js";

export const DAILY_KEY = "nb.daily.v1";
/* FNV-1a 32-bit plus the standard 32-bit avalanche. The avalanche is not
   decoration: world.js:15 seeds the rng with seed ^ (level*40503), so a hash
   whose low bits barely move between consecutive dates would hand two
   consecutive days near-identical room-1 boards. No Date and no store anywhere
   in this module — every function takes the string, the flags.js template, so
   the whole feature is drivable from Node. */
export function dailySeed(dateStr) {
  const s = String(dateStr || "");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 3266489917) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const cl = (v, lo, hi) => {
  const n = v | 0;
  return n < lo ? lo : n > hi ? hi : n;
};

/* A record with no well-formed date is not a partial record, it is no record:
   without the day, best/played/room mean nothing and comparing them to today
   would be exactly the fabricated number this wave refuses. */
export function clampDaily(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const date = typeof o.date === "string" && DATE_RE.test(o.date) ? o.date : "";
  if (!date) return { date: "", best: 0, played: 0, room: 1, pace: 1 };
  return {
    date,
    best: cl(o.best, 0, 9999999),
    played: cl(o.played, 0, 999),
    room: cl(o.room, 1, 8),
    pace: cl(o.pace, 0, 2),
  };
}

export function loadDaily(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.getItem !== "function") return clampDaily(null);
    const raw = st.getItem(DAILY_KEY);
    if (raw === null) return clampDaily(null);
    return clampDaily(JSON.parse(raw));
  } catch (_) {
    return clampDaily(null);
  }
}

export function saveDaily(v, store) {
  try {
    const st = store || defaultStore();
    if (st && typeof st.setItem === "function")
      st.setItem(DAILY_KEY, JSON.stringify(clampDaily(v)));
  } catch (_) {}
}

/* The pace is STAMPED as well as the config being pinned: a record whose
   stamped pace does not match the pace THIS run just used is treated as
   ABSENT rather than merged into — the run's result REPLACES it under the
   new stamp (fresh day: played 1, best is this run's own score, no silent
   comparison to a best made under a different pin). Minor-2 (review
   2026-09-07, owner ruling): a record made under a future different pin is
   refused rather than silently compared. */
export function recordDaily(v, today, score, room, pace) {
  const cur = clampDaily(v);
  const s = cl(score, 0, 9999999),
    r = cl(room, 1, 8),
    p = clampPace(pace) + 1;
  if (!DATE_RE.test(String(today || ""))) return cur;
  if (cur.date !== today || cur.pace !== p)
    return { date: today, best: s, played: 1, room: r, pace: p };
  return {
    date: today,
    best: s > cur.best ? s : cur.best,
    played: cl(cur.played + 1, 0, 999),
    room: r > cur.room ? r : cur.room,
    pace: p,
  };
}

export function dailyTag(v, today) {
  const c = clampDaily(v);
  return c.date && c.date === today && c.played > 0 ? "PLAYED" : "NEW";
}

/* No code is appended: the board is derivable from the date by anyone who
   presses DAILY that day, which is the whole point. The URL keeps its trailing
   slash — the no-slash Pages 301 drops the OG tags. */
export function dailyStamp(date, level, score) {
  return (
    "DAILY " + date + " · L" + (level | 0) + " · " + (score | 0) +
    " · https://hmarzban.github.io/fusegrid/"
  );
}
