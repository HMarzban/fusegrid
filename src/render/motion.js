/* ENTITY MOTION (2026-10-25): the one shared timing spec for foes and pickups, read by CLASSIC, PIXEL and REAL 3D so all three animate as the same creature.
   Pure and deterministic: every function is a function of (entity key, t or age), identity comes from `e.home` + type (never an array index: slots are compaction
   indices), randomness from a hash (never Math.random). CLOCK POLICY: callers pass their own PLAY-frozen time (2D and 3D already swap in the pause time around a
   draw; PIXEL uses animClock) and stamp event times (kill, power, spawn seen) on that same clock; nothing here reads world.time. Reduce Flash: callers draw
   flash(k) as a tint instead of a white frame. Nothing here cycles faster than the existing 12 rad/s walk bob; flashes last one frame at most. */
import { hsh } from "./featart/kit.js";

export const MOTION = Object.freeze({ SPAWN_T: 1.2, POP_T: 0.25, DEATH_T: 0.35, HIT_T: 0.12, GLINT_EVERY: 2.8, GLINT_LEN: 0.7, HOVER_A: 2, HOVER_W: 2.4 });
/* per foe type: bobA px, bobW rad/s (walk), idleA px, idleW rad/s, breathe (scale amp), blinkEvery s, blinkLen s, lean (px toward the player when hunting), sway (rad) */
export const FOE_M = Object.freeze({
  walker: Object.freeze({ bobA: 1.6, bobW: 12, idleA: 0.6, idleW: 3, breathe: 0.02, blinkEvery: 3.5, blinkLen: 0.12, lean: 1.2, sway: 0 }),
  stationary: Object.freeze({ bobA: 0, bobW: 0, idleA: 0, idleW: 0, breathe: 0.04, blinkEvery: 4.5, blinkLen: 0.14, lean: 0, sway: 0 }),
  fast: Object.freeze({ bobA: 1.4, bobW: 16, idleA: 0.5, idleW: 4, breathe: 0.02, blinkEvery: 3, blinkLen: 0.1, lean: 1.6, sway: 0 }),
  chaser: Object.freeze({ bobA: 1.5, bobW: 13, idleA: 0.5, idleW: 3.4, breathe: 0.02, blinkEvery: 3.2, blinkLen: 0.1, lean: 2, sway: 0 }),
  boomerang: Object.freeze({ bobA: 1, bobW: 5, idleA: 1, idleW: 4, breathe: 0, blinkEvery: 0, blinkLen: 0, lean: 0, sway: 0.12 }),
  rocket: Object.freeze({ bobA: 0.6, bobW: 20, idleA: 0.6, idleW: 9, breathe: 0, blinkEvery: 0, blinkLen: 0, lean: 0, sway: 0.05 }),
  burrow: Object.freeze({ bobA: 1.2, bobW: 9, idleA: 0.8, idleW: 3, breathe: 0.03, blinkEvery: 5, blinkLen: 0.14, lean: 0.8, sway: 0 }),
  shade: Object.freeze({ bobA: 1.8, bobW: 6, idleA: 1.6, idleW: 2.4, breathe: 0.03, blinkEvery: 4, blinkLen: 0.12, lean: 1, sway: 0.08 }),
  knight: Object.freeze({ bobA: 1.2, bobW: 8, idleA: 0.5, idleW: 2.6, breathe: 0.015, blinkEvery: 5.5, blinkLen: 0.14, lean: 0.8, sway: 0.05 }),
});
export const foeM = (type) => FOE_M[type] || FOE_M.walker;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const eo = (v) => 1 - (1 - clamp01(v)) ** 3;
/* a stable 0..1 phase for an entity: from its spawn home and type, so respawned objects at the same home restart in phase */
export const phaseOf = (type, home, salt = 0) => hsh(Math.round(home ? home.x : 0), Math.round(home ? home.y : 0), type.length * 31 + (type.charCodeAt(0) || 0) + salt);
/* idle/walk vertical offset in px: walking uses bobA/bobW, standing uses idleA/idleW; ph from phaseOf */
export function bobAt(type, ph, t, moving) { const m = foeM(type); return moving ? m.bobA * Math.sin(m.bobW * t + ph * 6.283) : m.idleA * Math.sin(m.idleW * t + ph * 6.283); }
export const breatheAt = (type, ph, t) => 1 + foeM(type).breathe * Math.sin(3 * t + ph * 6.283);
/* eyelid closed amount 0..1: one blink every blinkEvery (+-20 %, hashed per foe), lasting blinkLen as a triangle; 0 for types that do not blink */
export function blinkAt(type, ph, t) {
  const m = foeM(type); if (!m.blinkEvery) return 0;
  const per = m.blinkEvery * (0.8 + 0.4 * ph), u = ((t + ph * per) % per);
  return u < m.blinkLen ? 1 - Math.abs(u / m.blinkLen * 2 - 1) : 0;
}
/* spawn materialise from the sim's own invuln timer: p = 1 - invulnT / SPAWN_T (0 at spawn). Pops over the first POP_T, then the foe is solid; the rest of the
   invulnerable window is a slow 0.7..1 alpha breathe (never a strobe). ring: a floor ring in the foe colour {r px, a} */
export function spawnK(p, t) {
  const u = clamp01(p * MOTION.SPAWN_T / MOTION.POP_T);
  const s = u < 0.7 ? 0.4 + 0.7 * eo(u / 0.7) : 1.1 - 0.1 * eo((u - 0.7) / 0.3);
  const el = p * MOTION.SPAWN_T, ramp = clamp01(Math.min((el - MOTION.POP_T) / 0.25, (MOTION.SPAWN_T - el) / 0.2));
  const a = u < 1 ? 0.35 + 0.65 * u : 1 - 0.3 * ramp * (0.5 - 0.5 * Math.sin(2.4 * t));
  return { s: p >= 1 ? 1 : s, a: p >= 1 ? 1 : a, ring: u < 1 ? { r: 6 + 16 * eo(u), a: 0.5 * (1 - u) } : null };
}
/* death over MOTION.DEATH_T from the `kill` event: squash wide and low, one flash frame, then shrink away; null once finished */
export function deathK(age) {
  if (age < 0 || age >= MOTION.DEATH_T) return null;
  const u = age / MOTION.DEATH_T, sq = eo(Math.min(1, u * 3)), sh = u > 0.4 ? 1 - eo((u - 0.4) / 0.6) : 1;
  return { sx: (1 + 0.25 * sq) * sh, sy: (1 - 0.4 * sq) * sh, flash: age < 0.05 ? 1 : 0, a: 1 - clamp01((u - 0.6) / 0.4) };
}
/* a short hit squash 1 -> 1.1 / 0.9 -> 1 over HIT_T */
export function hitK(age) { if (age < 0 || age >= MOTION.HIT_T) return null; const u = age / MOTION.HIT_T, k = Math.sin(u * Math.PI); return { sx: 1 + 0.1 * k, sy: 1 - 0.1 * k }; }
/* hunter lean: toward the player when e.hunt and within 3 tiles: {ox, oy px, glow 0..1} (render only; no sim field is read beyond hunt + positions) */
export function leanAt(type, hunt, dx, dy, tile) {
  const m = foeM(type), d = Math.hypot(dx, dy); if (!hunt || !m.lean || d > tile * 3 || d < 1) return null;
  const g = 1 - d / (tile * 3); return { ox: dx / d * m.lean * g, oy: dy / d * m.lean * g, glow: g };
}
/* hunter LOCK-ON ramp (issue #32; the rule is lockon.js lockOn): s is the look's own per-foe state, on the lockOn result, t that look's PLAY-frozen clock.
   k eases in over LOCK.IN and out over LOCK.OUT; dt = t - s.lt clamped to 0..0.05, so a repeat render at the same t and a PAUSE (frozen t) both hold k, and a
   clock reset never jumps it. Returns k 0..1 and keeps the last lane on s (s.ldx, s.ldy, s.ln) so the ramp out still points somewhere. */
export const LOCK = Object.freeze({ IN: 0.1, OUT: 0.18 });
export function lockK(s, on, t) {
  const dt = s.lt == null ? 0 : Math.max(0, Math.min(0.05, t - s.lt));
  s.lt = t;
  if (on) { s.ldx = on.dx; s.ldy = on.dy; s.ln = on.n; }
  return (s.lk = clamp01((s.lk || 0) + (on ? dt / LOCK.IN : -dt / LOCK.OUT)));
}
/* pickups: hover dy px, scale and tilt per family, a soft ground shadow that tightens at the apex, and a glint sweep 0..1 every GLINT_EVERY (null outside it) */
export function itemIdle(fam, ph, t) {
  const hv = MOTION.HOVER_A * Math.sin(MOTION.HOVER_W * t + ph), apex = Math.max(0, hv) / MOTION.HOVER_A;
  const gu = ((t + ph * 0.9 + 100) % MOTION.GLINT_EVERY) / MOTION.GLINT_LEN;
  return { dy: hv, sc: fam === "cap" ? 1 + 0.03 * Math.sin(3 * t + ph) : 1, rot: fam === "utl" ? 0.08 * Math.sin(5 * t + ph) : 0, shadow: 1 - 0.28 * apex, glint: gu < 1 ? gu : null };
}
/* collect burst per kind, from the `power` event: style ring (expanding ring), fan (spark fan), trail (streaks), rise (diamonds rising), pop (soft puff) */
export const COLLECT = Object.freeze({
  fire: { style: "fan", n: 12, r: 26 }, bomb: { style: "fan", n: 12, r: 24 }, speed: { style: "trail", n: 10, r: 30 },
  heart: { style: "rise", n: 8, r: 22 }, shield: { style: "ring", n: 1, r: 30 }, kick: { style: "pop", n: 8, r: 20 },
  throw: { style: "fan", n: 8, r: 24 }, pass: { style: "ring", n: 1, r: 26 }, line: { style: "trail", n: 8, r: 32 },
  power: { style: "fan", n: 14, r: 28 }, pierce: { style: "trail", n: 8, r: 30 }, remote: { style: "ring", n: 1, r: 28 },
});
export const COLLECT_T = 0.5;
export const collectM = (kind) => COLLECT[kind] || COLLECT.power;
/* particle i of a collect burst at age: {x, y px from the pickup, a 0..1, s px}; null when finished. All styles are hashed, never random */
export function collectParticle(kind, i, age) {
  const m = collectM(kind); if (age < 0 || age >= COLLECT_T || i >= m.n) return null;
  const u = age / COLLECT_T, h = hsh(i, kind.length * 17 + kind.charCodeAt(0), 9), a0 = (i / m.n + h * 0.2) * 6.283, k = eo(u), fade = 1 - u * u;
  if (m.style === "ring") return { x: 0, y: 0, a: 0.8 * fade, s: m.r * (0.2 + 0.8 * k), ring: true };
  if (m.style === "rise") return { x: Math.sin(a0) * m.r * 0.4 * k, y: -m.r * k - h * 6, a: fade, s: 2.2 };
  if (m.style === "trail") return { x: -m.r * k * (0.6 + 0.4 * h), y: (h - 0.5) * 10 * k, a: fade * 0.9, s: 1.6, streak: 6 * (1 - u) };
  if (m.style === "pop") return { x: Math.cos(a0) * m.r * k, y: Math.sin(a0) * m.r * k, a: fade, s: 3 * (1 - u) + 1 };
  return { x: Math.cos(a0) * m.r * k, y: Math.sin(a0) * m.r * k, a: fade, s: 2.4 * (1 - 0.6 * u) };
}
