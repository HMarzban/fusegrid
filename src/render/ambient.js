/* AMBIENT MOTION (2026-10-25): slow, per-world particles shared by all three looks. Pure and deterministic: a particle is a function of (biome, index, t), so CLASSIC,
   PIXEL and REAL 3D agree on what moves where. t comes from a renderer-owned PLAY-only clock (ambientClock: it advances only while world.state is "PLAY", so PAUSE, WIN and
   LOSE freeze it), never from world.time (which keeps ticking in PAUSE). Nothing flashes: the fastest cycle is a 2.4 s twinkle. Colours are biome slots at low alpha
   (VOID never above wallHi). Particles are decoration: alpha <= 0.34 (dots and twinkles <= 3 px; steam, ripples and sand streaks are bigger but <= 0.26), under or over the board and never a competitor for pickups, bombs and foes.
   Zero cost when off: ambientCount() is 0 under prefers-reduced-motion and halves with EFFECTS LOW (knob partK). */
import { CFG } from "../core/config.js";
import { mix, hsh } from "./featart/kit.js";

const W = CFG.COLS * CFG.TILE, H = CFG.ROWS * CFG.TILE, T = CFG.TILE;
/* board interior (inside the border ring): x 40..560, y 40..480 */
export const AREA = Object.freeze({ x0: T, y0: T, x1: W - T, y1: H - T });
/* layer: "under" draws between the floor and the entities, "over" above them (tiny, faint).
   shape: dot (soft round), diamond (twinkle), puff (grows and fades), ring (expands and fades), streak (thin line), flake (small tilted square)
   dx, dy: drift in px/s; sway: horizontal sine amplitude px; life: seconds per cycle; src: slot, over: slot it is mixed over */
export const AMB = Object.freeze({
  JUNGLE: [
    { n: 14, shape: "dot", layer: "over", dx: 2, dy: -7, sway: 9, life: 9, size: 1.6, alpha: 0.30, src: "wallHi", over: "floor0" },
    { n: 4, shape: "flake", layer: "under", dx: 5, dy: 9, sway: 14, life: 12, size: 2.6, alpha: 0.26, src: "floor0", over: "bg1" },
  ],
  ICE: [
    { n: 11, shape: "diamond", layer: "over", dx: 0, dy: 0, sway: 0, life: 2.4, size: 2.4, alpha: 0.34, src: "brickHi", over: "wallHi" },
    { n: 16, shape: "dot", layer: "over", dx: -4, dy: 11, sway: 6, life: 10, size: 1.3, alpha: 0.28, src: "brickHi", over: "wallHi" },
  ],
  FACTORY: [
    { n: 6, shape: "puff", layer: "under", dx: 3, dy: -14, sway: 4, life: 5, size: 7, alpha: 0.22, src: "wallHi", over: "floor0" },
    { n: 6, shape: "dot", layer: "over", dx: 6, dy: -20, sway: 5, life: 3.2, size: 1.3, alpha: 0.30, src: "brickHi", over: "brickA" },
  ],
  WATER: [
    { n: 6, shape: "ring", layer: "under", dx: 0, dy: 0, sway: 0, life: 4.5, size: 13, alpha: 0.26, src: "wallHi", over: "floor0" },
    { n: 10, shape: "dot", layer: "over", dx: 0, dy: -9, sway: 5, life: 7, size: 1.5, alpha: 0.26, src: "brickHi", over: "floor0" },
  ],
  ARENA: [
    { n: 14, shape: "dot", layer: "over", dx: 3, dy: -4, sway: 7, life: 11, size: 1.3, alpha: 0.24, src: "wallHi", over: "floor0" },
    { n: 4, shape: "dot", layer: "over", dx: 2, dy: -16, sway: 5, life: 4.2, size: 1.5, alpha: 0.32, src: "brickHi", over: "brickB" },
  ],
  SAND: [
    { n: 9, shape: "streak", layer: "under", dx: 46, dy: 3, sway: 0, life: 6, size: 14, alpha: 0.24, src: "brickHi", over: "floor0" },
    { n: 12, shape: "dot", layer: "over", dx: 38, dy: -2, sway: 3, life: 5, size: 1.2, alpha: 0.28, src: "brickHi", over: "floor0" },
  ],
  VOID: [
    { n: 12, shape: "diamond", layer: "over", dx: 0, dy: 0, sway: 0, life: 2.4, size: 2.2, alpha: 0.34, src: "wallHi", over: "floor0" },
    { n: 6, shape: "puff", layer: "under", dx: 1, dy: -9, sway: 6, life: 8, size: 9, alpha: 0.16, src: "wallHi", over: "floor0" },
  ],
  CROWN: [
    { n: 12, shape: "dot", layer: "over", dx: 1, dy: -5, sway: 8, life: 9, size: 1.5, alpha: 0.32, src: "wallHi", over: "floor0" },
    { n: 6, shape: "diamond", layer: "over", dx: 0, dy: 0, sway: 0, life: 2.4, size: 2.2, alpha: 0.30, src: "brickHi", over: "wallHi" },
  ],
});
export const biomeSpecs = (name) => AMB[name] || [];

/* one particle at time t: {x, y, a (0..1 of spec.alpha), s (px), p (0..1 phase in its cycle)} or null when invisible */
export function particleAt(spec, group, i, t) {
  const sd = group * 131 + 7, h0 = hsh(i, sd, 1), h1 = hsh(i, sd, 2), h2 = hsh(i, sd, 3), h3 = hsh(i, sd, 4);
  const life = spec.life * (0.8 + 0.4 * h0), ph = (t / life + h1) % 1, ww = AREA.x1 - AREA.x0, hh = AREA.y1 - AREA.y0;
  const still = spec.dx === 0 && spec.dy === 0;
  /* drifting particles wrap around the board; still ones (twinkles, ripples, puffs) pop up at a fixed hashed cell per cycle */
  const cyc = Math.floor(t / life + h1), rx = still || spec.shape === "puff" || spec.shape === "ring" ? hsh(i, sd + cyc, 5) : h2, ry = still || spec.shape === "puff" || spec.shape === "ring" ? hsh(i, sd + cyc, 6) : h3;
  const ux = (((rx * ww + spec.dx * t) % ww) + ww) % ww, uy = (((ry * hh + spec.dy * t) % hh) + hh) % hh;
  let x = AREA.x0 + ux + spec.sway * Math.sin(t * 0.7 + h0 * 6.283);
  let y = AREA.y0 + uy;
  if (spec.shape === "puff") y = AREA.y0 + ry * hh + spec.dy * ((ph * life) % life) * 0.6;
  x = Math.min(AREA.x1, Math.max(AREA.x0, x)); y = Math.min(AREA.y1, Math.max(AREA.y0, y));
  /* fade in over the first 20 % of the cycle and out over the last 35 %: a triangle-ish envelope, never a pop */
  const seam = still || spec.shape === "puff" ? 1 : Math.min(1, ux / 30, (ww - ux) / 30, uy / 30, (hh - uy) / 30),
    env = Math.min(1, ph / 0.2, (1 - ph) / 0.35), a = Math.max(0, env) * seam * (spec.shape === "diamond" ? Math.sin(ph * Math.PI) ** 2 : 1);
  if (a < 0.02) return null;
  const s = spec.shape === "puff" ? spec.size * (0.5 + ph) : spec.shape === "ring" ? spec.size * (0.25 + 0.75 * ph) : spec.size * (0.85 + 0.3 * h2);
  return { x, y, a, s, p: ph };
}
/* the slot-mixed colour of a spec in a biome (a mix of its src slot over a darker one: VOID uses wallHi as src, so it can never pass wallHi) */
export const ambientColor = (b, spec) => mix(b[spec.src], b[spec.over], 0.8);
/* how many particles of a spec are live at density k (EFFECTS LOW = 0.5; 0 = off) */
export const ambientCount = (spec, k = 1) => (k <= 0 ? 0 : Math.max(1, Math.round(spec.n * Math.min(1, k))));
export function reduceMotion() {
  try { return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
}
/* a renderer-owned PLAY-only clock: tick(world, dt) from the frame's dt; PAUSE, WIN and LOSE do not advance it */
export function ambientClock() { const c = { t: 0, tick(world, dt) { if (world && world.state === "PLAY") c.t += Math.min(dt, 0.1); return c.t; } }; return c; }
