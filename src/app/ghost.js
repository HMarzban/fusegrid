import { clampHeat } from "../core/heat.js";
import { clampPact } from "../core/pact.js";
import { clampPace } from "../core/pace.js";
import { defaultStore } from "./store.js";

export const GHOST_KEY = "nb.ghost.v1";
export const GHOST_V = 1;
export const GHOST_MAX = 16;
export const GHOST_HZ = 10;
export const GHOST_CAP = 2400;
/* One key, the times.js template: the key is the FULL 5-tuple, seed included,
   because a ghost is a route and a route is only valid on the board it was run
   on. Insertion order is recency (non-integer-like keys keep it): a write and
   a race-load both re-insert their key at the end, and overflow drops the
   first. A sample is 5 base-36 chars — x/2, y/2, one face digit 0..8. */
export const KEY_RE = /^\d{1,10}:[1-8]:[0-2]:(?:[0-9]|1[0-5]):[0-2]$/;

export function ghostKey(world) {
  const w = world || {};
  return `${w.seed >>> 0}:${w.level | 0}:${clampHeat(w.heat)}:${clampPact(w.pact)}:${clampPace(w.pace) + 1}`;
}

const okD = (v) => typeof v === "number" && (v | 0) === v && v >= 1 && v <= GHOST_CAP;
const okS = (s) => typeof s === "string" && /^[0-9A-Z]+$/.test(s) && s.length % 5 === 0 &&
  s.length / 5 >= 1 && s.length / 5 <= GHOST_CAP;

export function clampGhost(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  if (o.v !== GHOST_V) return { v: GHOST_V, g: {} };
  const src = o.g && typeof o.g === "object" ? o.g : {};
  const keys = Object.keys(src).filter((k) => KEY_RE.test(k) && src[k] && okD(src[k].d) && okS(src[k].s));
  const g = {};
  for (const k of keys.slice(Math.max(0, keys.length - GHOST_MAX))) g[k] = { d: src[k].d, s: src[k].s };
  return { v: GHOST_V, g };
}

export function loadGhost(store) {
  try {
    const st = store || defaultStore();
    if (!st || typeof st.getItem !== "function") return clampGhost(null);
    const raw = st.getItem(GHOST_KEY);
    if (raw === null) return clampGhost(null);
    return clampGhost(JSON.parse(raw));
  } catch (_) {
    return clampGhost(null);
  }
}

export function saveGhost(v, store) {
  try {
    const st = store || defaultStore();
    if (st && typeof st.setItem === "function") st.setItem(GHOST_KEY, JSON.stringify(clampGhost(v)));
  } catch (_) {}
}

const b36 = (n) => n.toString(36).toUpperCase().padStart(2, "0");
const sgn = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const sample = (p) => b36(Math.round(p.x / 2)) + b36(Math.round(p.y / 2)) +
  ((sgn(p.face.x) + 1) * 3 + (sgn(p.face.y) + 1));
export function decodeGhost(s) {
  const out = [];
  for (let i = 0; i + 5 <= s.length; i += 5) {
    const f = parseInt(s[i + 4], 36);
    out.push({ x: parseInt(s.slice(i, i + 2), 36) * 2, y: parseInt(s.slice(i + 2, i + 4), 36) * 2,
      fx: sgn(Math.floor(f / 3) - 1), fy: sgn((f % 3) - 1) });
  }
  return out;
}

export function createGhost() {
  return { grid: null, key: "", s: "", n: 0, done: true, race: null };
}

/* Read-only over world, once per GAME frame BEFORE the step loop: a fresh
   world.grid object is the "a room began" signal (loadLevel assigns one on
   every room load), so the sim's own retry and next-room need no hook. */
export function ghostTick(g, world, roomT, store) {
  if (world.grid !== g.grid) {
    g.grid = world.grid; g.key = ghostKey(world); g.s = ""; g.n = 0; g.done = false; g.race = null;
    const v = loadGhost(store), e = v.g[g.key];
    if (e) {
      delete v.g[g.key]; v.g[g.key] = e; saveGhost(v, store);
      g.race = decodeGhost(e.s);
    }
  }
  if (g.done) return;
  if (world.state === "PLAY") {
    const want = Math.floor(roomT * GHOST_HZ) + 1;
    if (want > GHOST_CAP) { g.done = true; return; }
    const p = world.players[0];
    while (g.n < want) { g.s += sample(p); g.n++; }
  } else if (world.state === "WIN") {
    g.done = true;
    const d = Math.max(1, Math.floor(roomT * GHOST_HZ)), v = loadGhost(store), e = v.g[g.key];
    if (e && e.d <= d) return;
    delete v.g[g.key]; v.g[g.key] = { d, s: g.s }; saveGhost(v, store);
  }
}

export function ghostAt(g, world, roomT) {
  const r = g && g.race;
  if (!r || world.grid !== g.grid || (world.state !== "PLAY" && world.state !== "PAUSE")) return null;
  const k = r.length, u = roomT * GHOST_HZ;
  if (u > k - 1) return null;
  const i = Math.floor(u), f = u - i, a = r[i], b = r[Math.min(i + 1, k - 1)];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, fx: a.fx, fy: a.fy, t: roomT };
}
