import { defaultStore } from "./store.js";
import { POWER } from "../core/entities.js";
import { T, key } from "../core/config.js";
import { featKindOf, featProfile, isBelt, tileTip } from "../core/feat.js";

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
/* Same duration as v1 on purpose: one timing rule for both verb panels, so a
   change to how long a nudge lingers is a change in one place. A tile tip reads
   a whole rule, not one verb, and has its own window (COACH_TILE_DUR below). */
export const COACH2_DUR = COACH_DUR;
/* Eight verbs, one bit each, once ever (owner ruling 2026-10-10 widened the
   original three). FLAME / BOMB / SPEED / HEART are label-only: the floating
   pickup label already says everything they do. The key stays nb.coach.v2 and
   k/t/r keep their letters and lead every record, so a three-bit record from
   before the widening loads byte-stable with the five new bits at 0. */
const TIPS = ["kick", "throw", "remote", "pass", "line", "power", "pierce", "shield"];
/* Wave-1 floor tiles (#24), one bit each behind the eight verbs, same once-ever
   rule, so an eight-bit record loads byte-stable with these at 0. The kind is the
   tile's TILE_HELP key. A tile tip opens on first contact, never closes on a
   "use" (contact IS the use), and outlives a verb's: its line carries the tile's
   whole rule at this heat, and it fades only over the last COACH_FADE s. */
const TILES = ["BLOOM", "GLIDE", "BELT", "PLATE", "STREAM", "QUICK", "GATE", "PORTAL"];
export const COACH_TILE_DUR = 6;
const COACH_FADE = 1.5;
const isTile = (k) => TILES.indexOf(k) >= 0;
const FIELD = { kick: "k", throw: "t", remote: "r", pass: "p", line: "l", power: "w", pierce: "i", shield: "s", BLOOM: "b", GLIDE: "g", BELT: "c", PLATE: "x", STREAM: "f", QUICK: "q", GATE: "y", PORTAL: "o" };
const KEYS = TIPS.concat(TILES).map((k) => FIELD[k]);
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
export function coachTip(kind, lay, world) {
  if (isTile(kind)) return world ? tileTip(kind, featProfile(world)) : "";
  if (TIPS.indexOf(kind) < 0) return "";
  const d = POWER.find((x) => x.t === kind);
  if (!d) return "";
  const l = lay === undefined ? coachLay() : lay;
  return d.name + " · " + (l === "p" || l === "l" ? d.help.replace(KEY_HINT, "the " + d.name + " button") : d.help);
}

export function coachAlpha(st) {
  return isTile(st.kind) ? Math.max(0, Math.min(1, (COACH_TILE_DUR - st.t) / COACH_FADE)) : Math.max(0, 1 - st.t / COACH2_DUR);
}

/* First contact with a tile, read from the world like usedNow: the player's
   centre on a tile the sim would act on (grid EMPTY, the sim's own test), a bomb
   riding a belt, or a booster / trap going off, which usually happens before the
   player ever steps on one. */
function tileMet(w, p, ev) {
  if (!w.feat || w.state !== "PLAY") return null;
  const at = (x, y) => { const k = key(x, y); return w.grid[k] === T.EMPTY ? featKindOf(w.feat[k]) : null; };
  const on = p && p.alive ? at(p.tx, p.ty) : null;
  if (isTile(on)) return on;
  if (Array.isArray(w.bombs) && w.bombs.some((b) => !b.dead && isBelt(w.feat[key(b.tx, b.ty)]))) return "BELT";
  return ev.some((e) => e && e.t === "bloom") ? "BLOOM" : ev.some((e) => e && e.t === "plate") ? "PLATE" : null;
}
const roomHas = (w, k) => !!w.feat && w.feat.some((v) => featKindOf(v) === k);

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
   re-arms it. The live tip follows the same rule (verify 2026-10-11): once
   its power is gone (a hit, a bomb-kind swap to a seen kind) it closes
   rn:"lost" with its bit still 0, so a THROW tip never names a hidden THROW
   button; a use or a full window in the same frame still marks it. A tip
   opened or replaced this frame is never "lost". st.q is created lazily,
   so main's startRunState literal clears it at every run start. Tile tips ride
   the same queue and the same replace rule. Contact is a level, not an event, so
   a live or queued tile never re-triggers; tiles are not "lost", but a live tip
   whose room was left closes rn:"room", bit still 0, so it never names a tile
   this room does not have. Exception (R10 re-review Finding 2, 2026-09-07):
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
    if (used || st.t >= (isTile(st.kind) ? COACH_TILE_DUR : COACH2_DUR)) {
      saveCoach2(coach2Mark(loadCoach2(store), st.kind), store);
      out.push(["coach_dismissed", { v: st.kind, rn: used ? "use" : "timeout" }]);
      st.kind = null;
    }
  }
  const live = st.kind;
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
  const p = w.players && w.players[0];
  if (live && st.kind === live && (isTile(live) ? !roomHas(w, live) : p && !holds(p, live))) {
    out.push(["coach_dismissed", { v: live, rn: isTile(live) ? "room" : "lost" }]);
    st.kind = null;
  }
  const met = tileMet(w, p, ev);
  if (met && met !== st.kind && q.indexOf(met) < 0 && !coach2Seen(loadCoach2(store), met)) {
    if (v1Open) q.push(met);
    else {
      if (st.kind) {
        out.push(["coach_dismissed", { v: st.kind, rn: "replace" }]);
        q.unshift(st.kind);
      }
      show(met);
    }
  }
  if (v1Open || st.kind || w.state !== "PLAY") return out;
  while (q.length) {
    const k = q.shift();
    if (!coach2Seen(loadCoach2(store), k) && (isTile(k) ? roomHas(w, k) : holds(p, k))) { show(k); break; }
  }
  return out;
}
