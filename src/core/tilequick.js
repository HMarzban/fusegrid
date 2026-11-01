/* QUICKSAND (#26): see docs/superpowers/specs/2026-11-01-tiles-wave-2-3-design.md section 4.
   A tile's life: WAIT (from room start) -> GROW (visible, passable) -> MOUND (a real
   BRICK) -> broken: WAIT again, or DONE with no regrowth left. RETRY sits between: a
   growth that could not start, was cancelled by an arrival, or was held at its finish
   tries again once the tile has been clear and unheld for `retry` s. Neither a cancel
   nor a hold spends a regrowth. The state is w.quick, keyed to the grid object, so a
   room start or a new run starts it over; featM / featS stay wave 1's (featTick zeroes
   any featM with no pending entry). */
import { CFG, T, key } from "./config.js";
import { aabb, tileOf } from "./board.js";
import { F, featProfile } from "./feat.js";

export const HOLD_MIN = 4;
export const GROW_STEPS = 4;
/* growth neither starts nor finishes with a lit bomb of radius r this many Manhattan tiles away, or nearer */
export const holdReach = (r, min = HOLD_MIN) => Math.max(r + 1, min);
const WAIT = 0, RETRY = 1, GROW = 2, MOUND = 3, DONE = 4;

function stateOf(w) {
  if (w.quick && w.quick.grid === w.grid) return w.quick;
  const list = [], wait = featProfile(w).quick.wait, C = CFG.COLS;
  for (let k = 0; k < w.feat.length; k++) if (w.feat[k] === F.QUICK) list.push({ k, x: k % C, y: (k / C) | 0, st: WAIT, t: wait, n: 0 });
  return (w.quick = { grid: w.grid, list });
}
function occupied(w, q) {
  const { x, y } = q, g = w.grid;
  for (const p of w.players) if (p.alive && aabb(g, x, y, p.x, p.y, p.r)) return true;
  for (const e of w.enemies) if (!e.dead && aabb(g, x, y, e.x, e.y, e.r)) return true;
  for (const b of w.bombs) if (!b.dead && b.tx === x && b.ty === y) return true;
  for (const bl of w.blades) if (bl.tiles && bl.tiles.some((t) => t.tx === x && t.ty === y)) return true;
  for (const it of w.items) if (!it.taken && !it.buried && tileOf(it.x) === x && tileOf(it.y) === y) return true;
  return false;
}
function held(w, q) {
  for (const b of w.bombs) if (!b.dead && Math.abs(b.tx - q.x) + Math.abs(b.ty - q.y) <= holdReach(b.radius)) return true;
  return false;
}
export function quickTick(w, dt, emit) {
  const s = stateOf(w);
  if (!s.list.length) return;
  const pr = featProfile(w).quick;
  for (const q of s.list) {
    if (q.st === DONE) continue;
    const v = w.grid[q.k];
    if (v === T.WALL) { q.st = DONE; continue; }
    if (q.st === MOUND) {
      if (v === T.BRICK) continue;
      q.st = q.n >= pr.max ? DONE : WAIT;
      q.t = pr.wait;
      continue;
    }
    if (q.st === GROW) {
      if (occupied(w, q)) { q.st = RETRY; q.t = pr.retry; continue; }
      q.t += dt;
      if (q.t < pr.grow) continue;
      if (held(w, q)) { q.st = RETRY; q.t = pr.retry; continue; }
      w.grid[q.k] = T.BRICK;
      q.st = MOUND; q.n++;
      continue;
    }
    if (q.st === RETRY && (occupied(w, q) || held(w, q))) { q.t = pr.retry; continue; }
    q.t -= dt;
    if (q.t > 0) continue;
    if (q.st === WAIT && (occupied(w, q) || held(w, q))) { q.st = RETRY; q.t = pr.retry; continue; }
    q.st = GROW; q.t = 0;
  }
}
/* foes sink on open sand (the CORE joy); a mound is a brick, not sand */
export function quickSpeed(w, x, y) {
  const k = key(tileOf(x), tileOf(y));
  return w.feat[k] === F.QUICK && w.grid[k] === T.EMPTY ? featProfile(w).quick.sink : 1;
}
/* the growth frame of tile k for the looks, 0 (none) or 1..GROW_STEPS; read-only */
export function quickStep(w, k) {
  const s = w.quick;
  if (!s || s.grid !== w.grid) return 0;
  for (const q of s.list) if (q.k === k) return q.st === GROW ? Math.min(GROW_STEPS, 1 + Math.floor((q.t / featProfile(w).quick.grow) * GROW_STEPS)) : 0;
  return 0;
}
