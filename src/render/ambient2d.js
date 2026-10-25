/* AMBIENT MOTION, CLASSIC 2D painter (2026-10-25). The particle spec lives in ambient.js (pure, shared by all three looks); this file only draws it:
   "under" particles right after the floor and shadow layer (bricks, pickups, bombs and foes paint over them), "over" ones after the entities and before the
   blasts (tiny and faint). One solid fill or stroke per particle, no gradient, no shadowBlur, at most 27 particles a frame. The clock is renderer-owned and
   PLAY-only (PAUSE, WIN and LOSE freeze it), EFFECTS LOW (partK) halves the count and prefers-reduced-motion draws nothing. Only the GAME screen asks for it
   (o.hud === true): menus, the title and the show never get ambient. */
import {CFG, T, BIOMES} from "../core/config.js";
import {biomeSpecs, particleAt, ambientColor, ambientCount, ambientClock, reduceMotion} from "./ambient.js";
import {getFxOpts} from "./fx.js";

const CO = CFG.COLS, TL = CFG.TILE;
const bioOf = (level) => BIOMES[(Math.max(1, level | 0) - 1) % BIOMES.length];

export function createAmbient2d() {
  const clock = ambientClock(), cols = new Map();
  let rm = reduceMotion(), n = 0;
  const colorsOf = (b) => { let a = cols.get(b.name); if (!a) { a = biomeSpecs(b.name).map((s) => ambientColor(b, s)); cols.set(b.name, a); } return a; };
  const tick = (world, dt) => { if (++n % 240 === 0) rm = reduceMotion(); return clock.tick(world, dt || CFG.STEP); };
  function draw(c, world, layer) {
    if (rm || !c.arc) return;
    const k = getFxOpts().partK;
    if (!(k > 0)) return;
    const b = bioOf(world.level), specs = biomeSpecs(b.name), colors = colorsOf(b), t = clock.t, g = world.grid;
    c.save();
    for (let gi = 0; gi < specs.length; gi++) {
      const sp = specs[gi];
      if (sp.layer !== layer) continue;
      const cnt = ambientCount(sp, k), col = colors[gi], sh = sp.shape;
      c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 1;
      const len = Math.hypot(sp.dx, sp.dy) || 1;
      for (let i = 0; i < cnt; i++) {
        const p = particleAt(sp, gi, i, t);
        if (!p) continue;
        if (layer === "under" && g && g[((p.y / TL) | 0) * CO + ((p.x / TL) | 0)] === T.WALL) continue;
        c.globalAlpha = sp.alpha * p.a;
        if (sh === "dot" || sh === "puff") { c.beginPath(); c.arc(p.x, p.y, sh === "dot" ? p.s * 0.7 : p.s, 0, 7); c.fill(); }
        else if (sh === "ring") { c.beginPath(); c.arc(p.x, p.y, p.s, 0, 7); c.stroke(); }
        else if (sh === "streak") { c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - (sp.dx / len) * p.s, p.y - (sp.dy / len) * p.s); c.stroke(); }
        else if (sh === "diamond") { const r = p.s; c.beginPath(); c.moveTo(p.x, p.y - r); c.lineTo(p.x + r * 0.7, p.y); c.lineTo(p.x, p.y + r); c.lineTo(p.x - r * 0.7, p.y); c.closePath(); c.fill(); }
        else { const r = p.s * 0.5, a = p.p * 6.283, co = Math.cos(a) * r, si = Math.sin(a) * r; c.beginPath(); c.moveTo(p.x + co, p.y + si); c.lineTo(p.x - si, p.y + co); c.lineTo(p.x - co, p.y - si); c.lineTo(p.x + si, p.y - co); c.closePath(); c.fill(); }
      }
    }
    c.restore();
  }
  return {tick, draw, clock};
}
