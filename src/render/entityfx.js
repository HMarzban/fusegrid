/* ENTITY EVENT STATE (2026-10-25): turns the sim's one-shot events into short, render-side lives so every look can animate deaths and collects without touching the sim.
   feed(events, t) is called by each look where it already reads world.events, with that look's own PLAY-frozen clock; ghosts(t) are the foes that just died (drawn
   by the look for MOTION.DEATH_T from their last position, using deathK(age)); bursts(t) are collected pickups (collectParticle(kind, i, age) for COLLECT_T).
   Capacity is fixed (no allocation storms); same events + same t give the same lists. A look never mutates world.events. */
import { MOTION, COLLECT_T } from "./motion.js";

export function createEntityFx(cap = 24) {
  const G = [], B = [];
  const push = (arr, o) => { if (arr.length >= cap) arr.shift(); arr.push(o); };
  return {
    feed(events, t) {
      for (const e of events || []) {
        if (e.t === "kill" && e.type) push(G, { type: e.type, x: e.x, y: e.y, col: e.color, t0: t });
        else if (e.t === "power" && e.kind) push(B, { kind: e.kind, x: e.x, y: e.y, col: e.col, t0: t });
      }
    },
    ghosts(t) { while (G.length && t - G[0].t0 >= MOTION.DEATH_T) G.shift(); return G.map((g) => ({ type: g.type, x: g.x, y: g.y, col: g.col, age: t - g.t0 })); },
    bursts(t) { while (B.length && t - B[0].t0 >= COLLECT_T) B.shift(); return B.map((b) => ({ kind: b.kind, x: b.x, y: b.y, col: b.col, age: t - b.t0 })); },
    clear() { G.length = 0; B.length = 0; },
  };
}
