import {biomeOf} from "../../core/config.js";
import {biomeSpecs, particleAt, ambientCount, ambientClock, reduceMotion} from "../ambient.js";
import {getFxOpts} from "../fx.js";
import {resolveSlot} from "./palette.js";

export const AMB_HZ = 8;
const D = [[0, 0]], DIA = [[0, 0], [-1, 1], [1, -1]], P2 = [[0, 0], [1, 0], [0, 1], [1, 1]], P3 = [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]];
const RG = [0, 1, 2, 3].map((r) => { const d = Math.round(r * 0.7); return r ? [[r, 0], [-r, 0], [0, r], [0, -r], [d, d], [-d, d], [d, -d], [-d, -d]] : D; });
const pts = (sh, q) => (sh === "diamond" ? (q.p > 0.3 && q.p < 0.7 ? DIA : D) : sh === "puff" ? (q.p < 0.5 ? P2 : P3) : sh === "ring" ? RG[Math.min(3, Math.round(q.s / 4))] : D);

export function armAmbient(V, world, o, dt) {
  V.amb = o && o.hud === true && !reduceMotion() ? (V.ac || (V.ac = ambientClock())).tick(world, dt) : null;
}

export function drawAmbient(c, V, world, layer) {
  if (V.amb == null) return;
  const k = getFxOpts().partK, b = biomeOf(world.level), t = Math.floor(V.amb * AMB_HZ) / AMB_HZ, sp = biomeSpecs(b.name);
  for (let g = 0; g < sp.length; g++) {
    const s = sp[g], n = s.layer === layer ? ambientCount(s, k) : 0;
    if (!n) continue;
    c.fillStyle = resolveSlot("tile." + s.src, {biome: b});
    for (let i = 0; i < n; i++) {
      const q = particleAt(s, g, i, t);
      if (!q) continue;
      c.globalAlpha = Math.min(0.8, s.alpha * 2.6) * (q.a > 0.5 ? 1 : 0.6);
      const x = q.x >> 1, y = q.y >> 1;
      if (s.shape === "streak") { c.fillRect(x, y, Math.max(3, Math.min(5, Math.round(q.s / 3))), 1); continue; }
      const P = pts(s.shape, q);
      for (let j = 0; j < P.length; j++) c.fillRect(x + P[j][0], y + P[j][1], 1, 1);
    }
  }
  c.globalAlpha = 1;
}
