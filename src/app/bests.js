import { clampHeat } from "../core/heat.js";
import { clampPact } from "../core/pact.js";
import { clampPace } from "../core/pace.js";
import { defaultStore } from "./store.js";

export const BESTS_KEY = "nb.bests.v1";
export const BESTS_MAX = 48;
/* One key, one module — the load(store)/save(store) template pactstore /
   plaques / pacestore / cabinetseen / coach / settings / times all share.
   The key is timeKey's key MINUS the level: a run spans rooms, so the level
   cannot be in it, while heat changes the roster (heat.js:102-113), pact
   changes the item count and therefore the rng draw order (pact.js:20-26), and
   pace scales player speed without being folded into the seed (sim.js:124,
   world.js:15,74). pace is shifted +1 so the segment is 0..2.
   nb.highscores.v1 cannot be the comparison target: it stores the heat-
   multiplied persist value, it is one 10-row list across all heats, and CORE
   ships pre-seeded to 250 — three ways to print a delta the player never ran. */
const KEY_RE = /^[0-2]:(?:[0-9]|1[0-5]):[0-2]$/;
const MAX_S = 9999999,
  MIN_R = 1,
  MAX_R = 8;

export function bestKey(world) {
  const w = world || {};
  return (
    clampHeat(w.heat) + ":" + clampPact(w.pact) + ":" + (clampPace(w.pace) + 1)
  );
}

const int = (v, lo, hi) =>
  typeof v === "number" && isFinite(v) && (v | 0) === v && v >= lo && v <= hi;
const okRow = (e) =>
  !!e && typeof e === "object" && int(e.s, 0, MAX_S) && int(e.r, MIN_R, MAX_R);

/* The key form is non-integer-like, so JS preserves insertion order over `b`
   deterministically — which is what makes "drop the FIRST inserted" a defined
   overflow policy rather than a coin flip. 48 is a third of the 144 reachable
   buckets and ~16x the set a real player uses; the blob stays under ~2 KB. */
export function clampBests(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const src = o.b && typeof o.b === "object" ? o.b : {};
  const keys = Object.keys(src).filter((k) => KEY_RE.test(k) && okRow(src[k]));
  const kept = keys.length > BESTS_MAX ? keys.slice(keys.length - BESTS_MAX) : keys;
  const b = {};
  for (const k of kept) b[k] = { s: src[k].s, r: src[k].r };
  return { b };
}

export function loadBests(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.getItem !== "function") return clampBests(null);
    const raw = st.getItem(BESTS_KEY);
    if (raw === null) return clampBests(null);
    return clampBests(JSON.parse(raw));
  } catch (_) {
    return clampBests(null);
  }
}

export function saveBests(v, store) {
  try {
    const st = store || defaultStore();
    if (st && typeof st.setItem === "function")
      st.setItem(BESTS_KEY, JSON.stringify(clampBests(v)));
  } catch (_) {}
}

export function bestOfRun(v, key) {
  const b = v && v.b;
  const e = b ? b[key] : undefined;
  return okRow(e) ? { s: e.s, r: e.r } : null;
}

/* s and r are written INDEPENDENTLY: a low-score run that reached a new room is
   a real record, and pinning them together would hide one behind the other. */
export function recordBest(v, key, score, room) {
  const cur = clampBests(v);
  if (!KEY_RE.test(key)) return cur;
  const s = Math.min(MAX_S, Math.max(0, score | 0));
  const r = Math.min(MAX_R, Math.max(MIN_R, room | 0));
  const prior = cur.b[key];
  const next = okRow(prior)
    ? { s: s > prior.s ? s : prior.s, r: r > prior.r ? r : prior.r }
    : { s, r };
  const b = Object.assign({}, cur.b);
  b[key] = next;
  return clampBests({ b });
}

/* The run tally, fed from the batch main.js already reads non-destructively
   beside the coach latch — before renderer.render drains world.events. Rooms
   are counted from {t:"win"}, never inferred from world.level, which a LEVEL
   SELECT start at room 5 would falsify. Deaths are a strictly DECREASING
   world.lives, never {t:"hurt"}: a shielded hit emits hurt without losing a
   life (sim.js:344-348) while hurtPlayer emits the same event when one is
   (entities.js:194). lv seeds itself on the first call, so the carry.lives jump
   on a new run is an increase and never a false death. */
/* R5 extends this shape in place — kt/pk/dr are filled in the SAME loop, so the
   stats screen adds zero new passes over world.events. */
export function newTally() {
  return { r: 0, k: 0, p: 0, b: 0, d: 0, dNew: 0, lv: null, kt: {}, pk: {}, dr: {} };
}

export function feedTally(t, world) {
  const w = world || {};
  t.dNew = 0;
  const ev = Array.isArray(w.events) ? w.events : [];
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i];
    if (!e) continue;
    if (e.t === "kill") { t.k++; if (e.type) t.kt[e.type] = (t.kt[e.type] | 0) + 1; }
    else if (e.t === "power") { t.p++; if (e.kind) t.pk[e.kind] = (t.pk[e.kind] | 0) + 1; }
    else if (e.t === "brick") t.b++;
    else if (e.t === "win") t.r++;
  }
  const lv = w.lives | 0;
  if (t.lv === null) t.lv = lv;
  else if (lv < t.lv) {
    const n = t.lv - lv;
    t.d += n;
    t.dNew = n;
    const rm = w.level | 0;
    // Nit-8 (review 2026-09-07): reserved, not yet consumed — the LIVE deaths-
    // by-room path is stats.js's v.d, filled by the "death" edge; wiring dr
    // into run_end on top of that would double-count every death.
    t.dr[rm] = (t.dr[rm] | 0) + n;
  }
  t.lv = lv;
  return t;
}
