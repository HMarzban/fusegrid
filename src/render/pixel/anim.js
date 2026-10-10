/* PIXEL animation maths. Pure and DOM-free: every function reads numbers or
   the world and writes only into state objects the caller owns, so the px
   hot path allocates nothing per frame. Facing codes: 0 front (down),
   1 back (up), 2 right, 3 left (3/4-left is the mirror of 3/4-right). */
import {CFG} from "../../core/config.js";
import {PX_T} from "./timing.js";

export const F_FRONT = 0, F_BACK = 1, F_RIGHT = 2, F_LEFT = 3;
export const P_CROSS = 0, P_STRAIGHT = 1, P_END = 2;

export function facingOf(fx, fy, prev = F_FRONT) {
  const ax = Math.abs(fx || 0), ay = Math.abs(fy || 0);
  if (!ax && !ay) return prev;
  if (ax > ay + 1e-6) return fx < 0 ? F_LEFT : F_RIGHT;
  if (ay > ax + 1e-6) return fy < 0 ? F_BACK : F_FRONT;
  const h = fx < 0 ? F_LEFT : F_RIGHT, v = fy < 0 ? F_BACK : F_FRONT;
  return prev === h || prev === v ? prev : h;
}

export const walkFrame = (dist) => Math.floor(Math.max(0, dist) / PX_T.STRIDE) & 3;

export function newWalk() { return {init: false, x: 0, y: 0, dist: 0, n: 0, f: 0, ft: 0, still: 0, face: F_FRONT}; }
/* Distance-driven 4-phase walk (contact, pass, contact, pass), one phase per
   STRIDE logical px, never faster than WALK_FPS_MAX. dt is the renderer's anim
   dt (0 in PAUSE), so a frozen board never steps. A jump over one tile is a
   respawn or a room change and restarts the cycle. */
export function walkStep(st, x, y, dt) {
  if (!st.init) { st.init = true; st.x = x; st.y = y; st.dist = 0; st.n = 0; st.f = 0; st.ft = 0; st.still = 0; return 0; }
  const d = Math.hypot(x - st.x, y - st.y);
  st.x = x; st.y = y;
  if (!(dt > 0)) return st.f;
  st.ft += dt;
  if (d > CFG.TILE) { st.dist = 0; st.n = 0; st.f = 0; st.still = 0; return 0; }
  if (d > 1e-6) { st.dist += d; st.still = 0; } else st.still += dt;
  if (st.dist >= (st.n + 2) * PX_T.STRIDE) st.dist = (st.n + 2) * PX_T.STRIDE - 1e-6;
  if (Math.floor(st.dist / PX_T.STRIDE) > st.n && st.ft >= 1 / PX_T.WALK_FPS_MAX - 1e-9) { st.n++; st.ft = 0; }
  st.f = st.n & 3;
  return st.f;
}
export const isIdle = (st) => st.still >= PX_T.IDLE_TICKS * CFG.STEP - 1e-9;
export const cycle = (t, fps, n) => Math.floor(Math.max(0, t) * fps + 1e-9) % n;

export function bladeAgeFrame(a) {
  const c = PX_T.BLADE_CUTS;
  return a >= c[3] ? 3 : a >= c[2] ? 2 : a >= c[1] ? 1 : 0;
}
export function fuseFrac(timer, fuse) {
  const F = fuse > 0 ? fuse : CFG.FUSE;
  return Math.max(0, Math.min(1, 1 - Math.max(0, timer) / F));
}
export const fuseFrame = (timer, fuse) => Math.min(3, Math.floor(fuseFrac(timer, fuse) * 4));
export function bombFps(timer, fuse) {
  const f = fuseFrac(timer, fuse), B = PX_T.BOMB_FPS;
  return f < 1 / 3 ? B[0] : f < 2 / 3 ? B[1] : B[2];
}
const SWELL = [0, 1, 2, 1];
export const swellFrame = (timer, fuse, t) => SWELL[cycle(t, bombFps(timer, fuse), 4)];
export const popFrame = (pop) => { const c = PX_T.POP_CUTS; return pop < c[0] ? 0 : pop < c[1] ? 1 : pop < c[2] ? 2 : -1; };

export function newClock() { return {t: 0, dt: 0, wt: 0, w: null}; }
/* Renderer-owned anim clock: advances by the world's own time step while the
   world is in PLAY, WIN or LOSE, and not at all in PAUSE or on a frozen menu
   backdrop (world.time does not move there). A world swap re-anchors; a long
   frame is clamped to DT_MAX rather than dropped. */
export function animClock(clk, world) {
  const wt = world && world.time || 0;
  if (clk.w !== world) { clk.w = world; clk.wt = wt; clk.dt = 0; return clk.t; }
  let d = wt - clk.wt;
  clk.wt = wt;
  d = d > 0 ? Math.min(d, PX_T.DT_MAX) : 0;
  const s = world.state;
  clk.dt = s === "PLAY" || s === "WIN" || s === "LOSE" ? d : 0;
  clk.t += clk.dt;
  return clk.t;
}

export function bladeScratch() {
  const N = CFG.COLS * CFG.ROWS;
  return {on: new Uint8Array(N), age: new Float32Array(N), list: new Int16Array(N), n: 0,
    out: Array.from({length: N}, () => ({x: 0, y: 0, p: 0, r: 0, a: 0}))};
}
/* Union of every live blade's tiles, youngest age winning at a crossing,
   classified by its 4-neighbour mask: CROSS (0, 3 or 4 neighbours, or a
   corner), STRAIGHT (r 0 horizontal, 1 vertical), END (r = clockwise quarter
   turns of the authored right-pointing tip; the arm comes from the left). */
export function bladePieces(world, sc) {
  const C = CFG.COLS, R = CFG.ROWS, on = sc.on, age = sc.age, list = sc.list, bl = world.blades || [];
  let m = 0;
  on.fill(0);
  for (let b = 0; b < bl.length; b++) {
    const B = bl[b], ts = B.tiles, a = B.ttl > 0 ? Math.max(0, B.t / B.ttl) : 1;
    if (!ts) continue;
    for (let j = 0; j < ts.length; j++) {
      const t = ts[j];
      if (t.tx < 0 || t.ty < 0 || t.tx >= C || t.ty >= R) continue;
      const k = t.ty * C + t.tx;
      if (!on[k]) { on[k] = 1; age[k] = a; list[m++] = k; } else if (a < age[k]) age[k] = a;
    }
  }
  for (let i = 0; i < m; i++) {
    const k = list[i], x = k % C, y = (k / C) | 0;
    const L = x > 0 && on[k - 1] ? 1 : 0, Rt = x < C - 1 && on[k + 1] ? 1 : 0, U = y > 0 && on[k - C] ? 1 : 0, D = y < R - 1 && on[k + C] ? 1 : 0;
    const n = L + Rt + U + D, o = sc.out[i];
    o.p = P_CROSS; o.r = 0;
    if (n === 1) { o.p = P_END; o.r = L ? 0 : U ? 1 : Rt ? 2 : 3; }
    else if (n === 2 && L && Rt) o.p = P_STRAIGHT;
    else if (n === 2 && U && D) { o.p = P_STRAIGHT; o.r = 1; }
    o.x = x; o.y = y; o.a = age[k];
  }
  sc.n = m;
  return m;
}
