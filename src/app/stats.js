import { FOES, POWER } from "../core/entities.js";
import { defaultStore } from "./store.js";
import { bestOfRun } from "./bests.js";
import { bestOf } from "./times.js";

export const STATS_KEY = "nb.stats.v1";
export const RING_MAX = 200;
/* run_end is the TENTH kind. The arcade reset makes the RUN the unit every
   aggregate counts, and a run can end without a death (pause -> QUIT TO MENU /
   RESTART), so "deaths" alone would undercount runs by exactly the quits. */
export const EVENTS = Object.freeze([
  "session_start", "room_enter", "room_clear", "death", "win_finale",
  "run_end", "score_set", "plaque_unlock", "coach_shown", "coach_dismissed",
]);
/* Aggregates record unconditionally — five nb.* keys already do, all local,
   none of them leaving the device on its own. The RING is the fine-grained,
   ordered record, and it exists to answer "what did I do" — a question only a
   player who has opened STATS has asked. Nothing here ever leaves the device
   except through the explicit C keypress on the STATS screen.
   Every date is a STRING: main.js computes one anyway, a ms field would need a
   formatter to be read, and the blob has to be readable in DevTools. */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FOE_T = new Set(FOES.map((f) => f.t));
const POW_T = new Set(POWER.map((x) => x.t));
const KIND = new Set(EVENTS);
const A_KEYS = ["runs", "rooms", "deaths", "kills", "picks", "bricks", "secs", "sessions"];

const bit = (v) => {
  if (v === undefined || v === null) return 0;
  if (typeof v === "number") return isFinite(v) && v ? 1 : 0;
  return v ? 1 : 0;
};
const cnt = (v) =>
  typeof v === "number" && isFinite(v) && (v | 0) === v && v >= 0 && v <= 1e9 ? v : 0;
const dat = (v) => (typeof v === "string" && DATE_RE.test(v) ? v : "");
const pad2 = (n) => (n < 10 ? "0" + n : String(n));

function mapOf(src, ok) {
  const out = {};
  if (!src || typeof src !== "object") return out;
  for (const k of Object.keys(src)) if (ok(k) && cnt(src[k])) out[k] = src[k];
  return out;
}

export function clampStats(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const ai = o.a && typeof o.a === "object" ? o.a : {};
  const a = { first: dat(ai.first), last: dat(ai.last) };
  for (const k of A_KEYS) a[k] = cnt(ai[k]);
  const e0 = Array.isArray(o.e) ? o.e.filter((x) => x && KIND.has(x.t)) : [];
  return {
    on: bit(o.on),
    a,
    d: mapOf(o.d, (k) => /^[1-8]$/.test(k)),
    k: mapOf(o.k, (k) => FOE_T.has(k)),
    p: mapOf(o.p, (k) => POW_T.has(k)),
    e: e0.length > RING_MAX ? e0.slice(e0.length - RING_MAX) : e0,
  };
}

export function loadStats(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.getItem !== "function") return clampStats(null);
    const raw = st.getItem(STATS_KEY);
    if (raw === null) return clampStats(null);
    return clampStats(JSON.parse(raw));
  } catch (_) {
    return clampStats(null);
  }
}

export function saveStats(v, store) {
  try {
    const st = store || defaultStore();
    if (st && typeof st.setItem === "function")
      st.setItem(STATS_KEY, JSON.stringify(clampStats(v)));
  } catch (_) {}
}

export function setStatsOn(store) {
  const v = loadStats(store);
  v.on = 1;
  saveStats(v, store);
  return v;
}

const bump = (m, k, n) => {
  if (k === undefined || k === null) return;
  m[k] = (m[k] | 0) + (n | 0);
};

/* One read-modify-write of one key, the same shape saveTimes(recordTime(...))
   already performs on every room WIN. The aggregate effect applies ALWAYS; the
   ring entry is appended only while on===1. */
export function stat(ev, data, today, store) {
  if (!KIND.has(ev)) return null;
  const d = data || {};
  const y = dat(today);
  const v = loadStats(store);
  const a = v.a;
  if (ev === "session_start") {
    a.sessions++;
    if (!a.first) a.first = y;
    a.last = y;
  } else if (ev === "room_enter") {
    a.last = y;
  } else if (ev === "room_clear") {
    a.rooms++;
  } else if (ev === "death") {
    a.deaths++;
    bump(v.d, d.r | 0, 1);
  } else if (ev === "run_end") {
    a.runs++;
    a.kills += cnt(d.k);
    a.picks += cnt(d.p);
    a.bricks += cnt(d.b);
    a.secs += cnt(d.secs);
    a.last = y;
    for (const k of Object.keys(d.kt || {})) bump(v.k, k, d.kt[k]);
    for (const k of Object.keys(d.pk || {})) bump(v.p, k, d.pk[k]);
  }
  if (v.on === 1) {
    const row = { t: ev, y };
    for (const f of ["r", "s", "h", "b", "v", "rn", "pc", "pa"])
      if (d[f] !== undefined) row[f] = d[f];
    v.e.push(row);
  }
  saveStats(v, store);
  return v;
}

/* One plaque_unlock per NEWLY-set bit. Lives here rather than in main.js so the
   shipped savePlaques(unlockPlaques(loadPlaques(), world)) literal — pinned in
   tests/menudraw.test.mjs — is read around, never restructured. */
export function statPlaques(prev, next, today, store) {
  for (let i = 0; i < 4; i++)
    if (!((prev | 0) & (1 << i)) && (next | 0) & (1 << i))
      stat("plaque_unlock", { b: i }, today, store);
}

/* The THIRD formatter of this wave, and the reason there are three: fmtTime
   (scenes.js) pins a run at 9:59.9 because its six-character guarantee holds
   the HUD chip's width budget; fmtSpan pins at 99:59, which a run never
   reaches; a lifetime crosses 99:59 after 100 minutes and would pin forever. */
export function fmtLong(sec) {
  const n = typeof sec === "number" && isFinite(sec) ? sec : 0;
  const s = Math.floor(Math.min(3599999, Math.max(0, n)));
  return Math.floor(s / 3600) + "h " + pad2(Math.floor(s / 60) % 60) + "m";
}

/* Rows 7-9 read the PLAIN bucket "<heat>:0:1" — no pact, NORM pace. Folding an
   IRON run into "CORE BEST" would be the same unit error nb.highscores.v1
   makes; note 2 says so on screen. STATS READS nb.bests.v1 and nb.times.v1 and
   copies neither — a second copy of a best is a second thing that can disagree
   with the overlay. */
export function statsRows(v, bests) {
  const s = clampStats(v);
  const best = (h) => {
    const b = bestOfRun(bests, h + ":0:1");
    return b ? b.s + " · R" + b.r : "—";
  };
  return [
    ["RUNS", String(s.a.runs)],
    ["ROOMS CLEARED", String(s.a.rooms)],
    ["DEATHS", String(s.a.deaths)],
    ["KILLS", String(s.a.kills)],
    ["PICKUPS", String(s.a.picks)],
    ["PLAY TIME", fmtLong(s.a.secs)],
    ["CORE BEST", best(0)],
    ["PLUS BEST", best(1)],
    ["MAX BEST", best(2)],
  ];
}
/* `today` is used for one thing only: deciding whether the stored daily record
   is today's. It is therefore the DAILY's day (main.js's local todayStr once R3
   lands), never the UTC dateStr that stamps the aggregates. Before R3, `daily`
   is null and note 1 is omitted entirely rather than faked. */
export function statsNotes(v, daily, today) {
  const s = clampStats(v);
  const out = [];
  if (daily && typeof daily === "object") {
    out.push(
      daily.date && daily.date === today && (daily.played | 0) > 0
        ? "DAILY " + today + " · BEST " + (daily.best | 0) + " · " +
          (daily.played | 0) + " TRIES · YOUR OWN ATTEMPTS ONLY"
        : "DAILY " + today + " · NOT PLAYED YET",
    );
  }
  out.push(
    "SINCE " + (s.a.first || "—") + " · LAST " + (s.a.last || "—") + " · " +
    s.a.sessions + " SESSIONS · BESTS: NO PACT · NORM",
  );
  return out;
}

/* The payload's one tenths formatter. src/app/ may not import src/render/, so
   fmtTime cannot be reused; this is the same clamp-and-floor arithmetic over
   the integer tenths times.js already stores, and block 11's 0:38.9 assertion
   is what keeps the two from drifting. */
const fmtT = (sec) => {
  const d = Math.round(Math.min(5999, Math.max(0, sec)) * 10);
  return Math.floor(d / 600) + ":" + pad2(Math.floor(d / 10) % 60) + "." + (d % 10);
};

/* Four plain-text lines, pure over four values. Line 3's time reads
   nb.times.v1's room-1 CORE-plain key, so the payload NAMES R7's store instead
   of duplicating it. The URL keeps its trailing slash: the no-slash Pages 301
   drops the OG tags. main.js hands the times blob in rather than this module
   reading a store, because purity is what makes the payload pinnable. */
export function statsPayload(v, bests, times, today) {
  const s = clampStats(v);
  const a = s.a;
  const best = (h) => {
    const b = bestOfRun(bests, h + ":0:1");
    return b ? b.s + "/R" + b.r : "—";
  };
  const t1 = bestOf(times, "1:0:0:1");
  return (
    "FUSEGRID STATS · " + (a.first || "—") + "→" + (a.last || today || "—") +
      " · " + a.sessions + " SESSIONS\n" +
    "RUNS " + a.runs + " · ROOMS " + a.rooms + " · DEATHS " + a.deaths +
      " · KILLS " + a.kills + " · PICKS " + a.picks + " · BRICKS " + a.bricks +
      " · TIME " + fmtLong(a.secs) + "\n" +
    "CORE " + best(0) + " · PLUS " + best(1) + " · MAX " + best(2) +
      " · CORE BEST TIME " + (t1 == null ? "—" : fmtT(t1)) + "\n" +
    "https://hmarzban.github.io/fusegrid/"
  );
}
