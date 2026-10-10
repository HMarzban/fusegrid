import { defaultStore } from "./store.js";
import { POWER } from "../core/entities.js";
import { T, key } from "../core/config.js";

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
/* Eight verbs, one bit each, once ever (owner ruling 2026-10-10 widened the
   original three). FLAME / BOMB / SPEED / HEART are label-only: the floating
   pickup label already says everything they do. The key stays nb.coach.v2 and
   k/t/r keep their letters and lead every record, so a three-bit record from
   before the widening loads byte-stable with the five new bits at 0. */
const TIPS = ["kick", "throw", "remote", "pass", "line", "power", "pierce", "shield"];
const FIELD = { kick: "k", throw: "t", remote: "r", pass: "p", line: "l", power: "w", pierce: "i", shield: "s" };
const KEYS = TIPS.map((k) => FIELD[k]);
const bit = (v) => (v ? 1 : 0);
const shape = (v) => { const o = {}; for (const f of KEYS) o[f] = bit(v && v[f]); return o; };

export function loadCoach2(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.getItem !== "function") return shape();
    const raw = st.getItem(COACH2_KEY);
    const o = raw === null ? {} : JSON.parse(raw);
    return shape(o && typeof o === "object" ? o : {});
  } catch (_) {
    return shape();
  }
}

export function saveCoach2(v, store) {
  try {
    const st = store || defaultStore();
    const o = v && typeof v === "object" ? v : {};
    if (st && typeof st.setItem === "function") st.setItem(COACH2_KEY, JSON.stringify(shape(o)));
  } catch (_) {}
}

export function coach2Seen(v, kind) {
  const f = FIELD[kind];
  return !!f && !!(v && v[f]);
}

export function coach2Mark(v, kind) {
  const cur = shape(v);
  const f = FIELD[kind];
  if (f) cur[f] = 1;
  return cur;
}

/* The copy is NOT new copy: POWER already ships one-line help for every tipped
   verb and the ITEMS help screen already shows those strings, so writing more
   would create a second source that drifts. Composed here rather than in
   render/, because scenes.js states in its own words that main.js precomputes
   what the panel draws and render/ never re-derives it. On a touch layout
   (body[data-lay] p or l) a help line that OPENS with a key chord (THROW's
   and REMOTE's, the only two) swaps that chord for the touch button touch.js
   paints with the same POWER name; the rest of the line is the same string. */
const KEY_HINT = /^[A-Z]\w*(?:\+[A-Z]\w*)*(?= )/;
export function coachLay() {
  try {
    const b = globalThis.document && globalThis.document.body;
    const v = b && typeof b.getAttribute === "function" ? b.getAttribute("data-lay") : null;
    return v === "p" || v === "l" ? v : "d";
  } catch (_) {
    return "d";
  }
}
export function coachTip(kind, lay) {
  if (TIPS.indexOf(kind) < 0) return "";
  const d = POWER.find((x) => x.t === kind);
  if (!d) return "";
  const l = lay === undefined ? coachLay() : lay;
  return d.name + " · " + (l === "p" || l === "l" ? d.help.replace(KEY_HINT, "the " + d.name + " button") : d.help);
}

/* Per-verb "used" read from the world, never e.t === kind: "power" is also the
   pickup event's own type, and PASS / the bomb kinds / SHIELD emit nothing of
   their own. A bomb kind is used by planting while holding it; SHIELD by the
   hurt it absorbs; PASS by standing inside a green brick. */
const holds = (p, k) =>
  !!p && (k === "pass" ? !!p.passing : k === "line" || k === "power" || k === "pierce" ? p.bombKind === k : !!p[k]);
function usedNow(w, ev, k) {
  const p = w.players && w.players[0];
  if (k === "kick" || k === "throw" || k === "remote") return ev.some((e) => e && e.t === k);
  if (k === "shield") return ev.some((e) => e && e.t === "hurt");
  if (k === "pass") return !!(p && p.passing && w.grid && w.grid[key(p.tx, p.ty)] === T.BRICK);
  return holds(p, k) && ev.some((e) => e && e.t === "bomb");
}

/* The whole v2 transition, so main.js stays a lean browser entry: advance the
   PLAY-only clock, close a live tip when its verb is used or its window
   elapses, then open at most one new tip. Returns the stat rows for main to
   emit — this module does not know about nb.stats.v1.
   v1 wins ties: while the ghost coach is open a trigger is QUEUED on st.q and
   opens once v1 has closed (one frame after, since main reads v1Open before
   its own close check), so a first-timer never sees two panels and never
   loses the tip. One tip at a time: a new trigger replaces a live one and
   dismisses it (rn:"replace", review 2026-09-07 Minor-1 ruling) BEFORE the new
   coach_shown, so shown/dismissed still pair exactly once per displayed tip.
   The replaced verb is NOT marked seen (2026-10-10, eight verbs made a
   two-verb blast common): its bit stays 0 and it goes back on st.q, to open
   after the live tip closes if the player still holds that power; a power
   lost meanwhile is dropped from the queue, bit still 0, so its next pickup
   re-arms it. st.q is created lazily, so main's startRunState literal clears
   it at every run start. Exception (R10 re-review Finding 2, 2026-09-07):
   abandoning a run mid-tip resets st without this function ever running its
   close branch, so that tip's coach_shown is left unpaired and its bit stays
   0 — truthful and generous by design, not a bug. */
export function coach2Tick(st, world, v1Open, dt, store) {
  const out = [];
  const w = world || {};
  const ev = Array.isArray(w.events) ? w.events : [];
  const q = Array.isArray(st.q) ? st.q : (st.q = []);
  const show = (k) => { st.kind = k; st.t = 0; out.push(["coach_shown", { v: k }]); };
  if (w.state === "PLAY") st.t += typeof dt === "number" && isFinite(dt) ? dt : 0;
  if (st.kind) {
    const used = usedNow(w, ev, st.kind);
    if (used || st.t >= COACH2_DUR) {
      saveCoach2(coach2Mark(loadCoach2(store), st.kind), store);
      out.push(["coach_dismissed", { v: st.kind, rn: used ? "use" : "timeout" }]);
      st.kind = null;
    }
  }
  for (const e of ev) {
    if (!e || e.t !== "power" || TIPS.indexOf(e.kind) < 0) continue;
    if (coach2Seen(loadCoach2(store), e.kind)) continue;
    if (st.kind === e.kind) { st.t = 0; continue; }
    if (v1Open) { if (q.indexOf(e.kind) < 0) q.push(e.kind); continue; }
    const i = q.indexOf(e.kind);
    if (i >= 0) q.splice(i, 1);
    if (st.kind) {
      out.push(["coach_dismissed", { v: st.kind, rn: "replace" }]);
      q.unshift(st.kind);
    }
    show(e.kind);
  }
  if (v1Open || st.kind || w.state !== "PLAY") return out;
  const p = w.players && w.players[0];
  while (q.length) {
    const k = q.shift();
    if (!coach2Seen(loadCoach2(store), k) && holds(p, k)) { show(k); break; }
  }
  return out;
}
