/* PIXEL one-shots: short frame sequences fed from world.events (the px
   renderer drains events once, like the wrapper, and hands each one here).
   Kind-scoped to the px renderer, stamped on its PLAY-only anim clock, held in
   a fixed pool (no per-frame allocation), cleared by reset() on a RENDER flip,
   a run start and a new grid. */
import {PX_T as T} from "./timing.js";

export const OS = Object.freeze({CRUMBLE: 1, STUN: 2, CORPSE: 3, MAT: 4, DEATH: 5, REVEAL: 6, KICK: 7, THROW: 8, SLAM: 9});
export const OS_DUR = Object.freeze([0,
  (T.CRUMBLE_MS * T.CRUMBLE_N) / 1000,
  (T.STUN_MS + T.PUFF_MS * T.PUFF_N) / 1000,
  (T.HURT_MS * T.HURT_N) / 1000,
  (T.MAT_MS * T.MAT_N) / 1000,
  T.LOSE_MS / 1000,
  (T.REVEAL_MS * T.REVEAL_N) / 1000,
  T.POSE_MS / 1000,
  T.POSE_MS / 1000,
  (T.SLAM_MS * T.SLAM_N) / 1000]);

export function createOneShots(cap = 96) {
  const pool = Array.from({length: cap}, () => ({k: 0, x: 0, y: 0, t0: 0, type: "", col: ""}));
  function push(k, x, y, t, type, col) {
    let o = null, old = null;
    for (let i = 0; i < pool.length; i++) { const p = pool[i]; if (!p.k) { o = p; break; } if (!old || p.t0 < old.t0) old = p; }
    o = o || old;
    o.k = k; o.x = x || 0; o.y = y || 0; o.t0 = t; o.type = type || ""; o.col = col || "";
    return o;
  }
  function expire(t) { for (let i = 0; i < pool.length; i++) { const p = pool[i]; if (p.k && t - p.t0 >= OS_DUR[p.k] - 1e-9) p.k = 0; } }
  function reset() { for (let i = 0; i < pool.length; i++) pool[i].k = 0; }
  function live(k) { for (let i = 0; i < pool.length; i++) if (pool[i].k === k) return pool[i]; return null; }
  function count() { let n = 0; for (let i = 0; i < pool.length; i++) if (pool[i].k) n++; return n; }
  return {pool, push, expire, reset, live, count};
}

/* Frame index of a live one-shot at clock t. STUN returns -1 while the
   stunned pose holds, then the puff frames 0..PUFF_N-1. */
export function shotFrame(o, t) {
  const e = Math.max(0, t - o.t0) * 1000, cl = (v, n) => Math.min(n - 1, Math.floor(v + 1e-9));
  switch (o.k) {
    case OS.CRUMBLE: return cl(e / T.CRUMBLE_MS, T.CRUMBLE_N);
    case OS.STUN: return e < T.STUN_MS ? -1 : cl((e - T.STUN_MS) / T.PUFF_MS, T.PUFF_N);
    case OS.CORPSE: return cl(e / T.HURT_MS, T.HURT_N);
    case OS.MAT: return cl(e / T.MAT_MS, T.MAT_N);
    case OS.DEATH: return cl((e / T.LOSE_MS) * T.LOSE_N, T.LOSE_N);
    case OS.REVEAL: return cl(e / T.REVEAL_MS, T.REVEAL_N);
    case OS.SLAM: return cl(e / T.SLAM_MS, T.SLAM_N);
    default: return 0;
  }
}

/* One world event -> one-shots. A hurt that moved the player is a respawn:
   a desaturated corpse where it fell and a materialize at the spawn. A hurt
   that did not (a shield break, or the hit that ends the run) leaves none. */
export function feedShot(shots, ev, world, t) {
  const p = world.players && world.players[0];
  switch (ev.t) {
    case "brick": shots.push(OS.CRUMBLE, ev.x, ev.y, t); break;
    case "kill": shots.push(OS.STUN, ev.x, ev.y, t, ev.type, ev.color); break;
    case "hurt":
      if (p && p.alive !== false && (Math.abs(p.x - ev.x) > 1 || Math.abs(p.y - ev.y) > 1)) {
        shots.push(OS.CORPSE, ev.x, ev.y, t);
        shots.push(OS.MAT, p.x, p.y, t);
      }
      break;
    case "lose": if (p) shots.push(OS.DEATH, p.x, p.y, t); break;
    case "reveal": shots.push(OS.REVEAL, ev.x, ev.y, t); break;
    case "kick": if (p) shots.push(OS.KICK, p.x, p.y, t); break;
    case "throw": if (p) shots.push(OS.THROW, p.x, p.y, t); break;
  }
}
