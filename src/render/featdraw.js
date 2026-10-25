/* TILE ART direction D (owner ruling 2026-10-25), CLASSIC 2D painter for the world.feat layer; it also bakes the REAL 3D atlas. Built worlds get hardware sunk
   into the floor (featart/built.js), JUNGLE / WATER / SAND the ground itself changed (featart/living.js); geometry both the painters and the 3D shader read lives
   in featart/geo.js. No new hex: biome slots, slot mixes, #000 / #fff at alpha. Heat = structure, count, value and tip shape, never colour. A feature tile REPLACES
   the floor drawImage with one baked 40x40 frame (0 extra draws); without a DOM it paints the same vectors in place. */
import { CFG, key, biomeOf } from "../core/config.js";
import { FEAT_PROFILE } from "../core/feat.js";
import { BUILT } from "./featart/built.js";
import { LIVING } from "./featart/living.js";
export { mix } from "./featart/kit.js";

const TL = CFG.TILE, C = CFG.COLS, R = CFG.ROWS;
const SIDES = ["N", "E", "S", "W"];
const ROT = (c, d) => { c.translate(20, 20); c.rotate((d * Math.PI) / 2); c.translate(-20, -20); };
export const PAINTERS = { ...BUILT, ...LIVING };
/* spec: {kind, h, dir 0..3, exit, phase, outer:[sides], state, lit, gx, gy, pair, par} */
export function paintCell(c, b, s) {
  if (!c.rect) return;
  c.save();
  c.beginPath(); c.rect(0, 0, 40, 40); c.clip();
  if (PAINTERS[s.kind]) runPainter(PAINTERS[s.kind], c, kOf(b, s));
  c.restore();
}
const nbOf = (outer) => ({ N: !outer.includes("N"), E: !outer.includes("E"), S: !outer.includes("S"), W: !outer.includes("W") });
/* the painter's view of a cell spec (featart/ contract): outer = sides with no same-kind neighbour */
export function kOf(b, s) {
  return { bio: b, h: s.h, nb: nbOf(s.outer || SIDES), par: s.par | 0, on: s.state === 1 ? 1 : 0, dir: s.dir | 0, phase: s.phase | 0, state: s.state | 0, lit: s.lit | 0, pair: s.pair || 1, gx: s.gx | 0, gy: s.gy | 0 };
}
/* a painter is a function (c,k) or {mech,lit}: mech in the rotated frame (flow = East), lit in the board frame */
function runPainter(P, c, k) {
  if (typeof P === "function") { P(c, k); return; }
  c.save(); ROT(c, k.dir); P.mech(c, k); c.restore();
  P.lit(c, k);
}
const featAt = (w, x, y) => (x < 0 || y < 0 || x >= C || y >= R ? 0 : w.feat[key(x, y)]);
const isBeltV = (v) => v >= 1 && v <= 4;
/* render-only codes 8..14 (no sim yet): STREAM E/S/W/N, QUICK, PORTAL, GATE */
const kindOf = (v) => (isBeltV(v) ? "BELT" : v === 5 ? "GLIDE" : v === 6 ? "BLOOM" : v === 7 ? "PLATE" : v >= 8 && v <= 11 ? "STREAM" : v === 12 ? "QUICK" : v === 13 ? "PORTAL" : v === 14 ? "GATE" : null);
export function tierOf(w) { const t = w.featTier != null ? w.featTier : w.heat; return t < 0 ? 0 : t > 2 ? 2 : t | 0; }
const PM = [0.85, 1, 1.15];
const D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
/* a run's flow ends are outer sides even when a different-direction tile of the same kind sits there */
function endSides(s, dir, exit, entry) {
  const ahead = SIDES[[1, 2, 3, 0][dir]], behind = SIDES[[3, 0, 1, 2][dir]];
  if (exit && !s.outer.includes(ahead)) s.outer.push(ahead);
  if (entry && !s.outer.includes(behind)) s.outer.push(behind);
  s.nb = nbOf(s.outer);
}
/* the spec of one feature tile in this frame (shared by 2D and 3D) */
export function cellSpec(w, x, y) {
  const v = w.feat[key(x, y)], k = kindOf(v), h = tierOf(w);
  const s = { kind: k, h, par: (x + y) & 1 };
  s.outer = SIDES.filter((sd, i) => kindOf(featAt(w, x + D4[i][0], y + D4[i][1])) !== k);
  s.nb = nbOf(s.outer);
  if (k === "BELT") {
    s.dir = v - 1;
    const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][s.dir];
    s.exit = featAt(w, x + dx, y + dy) !== v;
    s.entry = featAt(w, x - dx, y - dy) !== v;
    endSides(s, s.dir, s.exit, s.entry);
    const vv = FEAT_PROFILE[h].belt.v * PM[Math.max(-1, Math.min(1, w.pace | 0)) + 1];
    s.phase = Math.floor(((w.featT || 0) * vv * TL) % 40);
  } else if (k === "STREAM") {
    s.dir = v - 8; s.phase = 0;
    const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][s.dir];
    s.exit = featAt(w, x + dx, y + dy) !== v; s.entry = featAt(w, x - dx, y - dy) !== v;
    endSides(s, s.dir, s.exit, s.entry);
  } else if (k === "GATE") {
    s.lit = w.featM ? w.featM[key(x, y)] : 0;
  } else if (k === "PORTAL") {
    s.pair = (w.featPair && w.featPair[key(x, y)]) || 1;
  } else if (k === "GLIDE") {
    s.gx = x; s.gy = y;
  } else if (k === "BLOOM" || k === "PLATE") {
    const m = w.featM ? w.featM[key(x, y)] : 0;
    s.state = m;
    if (k === "PLATE" && m === 1) {
      const wind = FEAT_PROFILE[h].plate.wind, left = w.featS[key(x, y)];
      s.lit = Math.min(4, Math.max(1, Math.ceil(4 * (1 - left / wind))));
    }
  }
  return s;
}
export function specKey(s) {
  return [s.kind, s.h, s.par | 0, s.dir, s.exit ? 1 : 0, s.phase, s.outer && s.outer.join(""), s.state, s.lit, s.pair, s.kind === "GLIDE" ? s.gx + "," + s.gy : ""].join("|");
}
const BAKE = new Map();
export function drawFeat(c, w, x, y, px, py) {
  const s = cellSpec(w, x, y), b = biomeOf(w.level);
  if (typeof document === "undefined" || !document.createElement) {
    c.save(); c.translate(px, py); paintCell(c, b, s); c.restore(); return;
  }
  const k = b.name + "|" + specKey(s);
  let cv = BAKE.get(k);
  if (!cv) {
    cv = document.createElement("canvas"); cv.width = TL * 2; cv.height = TL * 2;
    const g = cv.getContext("2d"); g.scale(2, 2); paintCell(g, b, s);
    if (BAKE.size > 600) BAKE.clear();
    BAKE.set(k, cv);
  }
  c.drawImage(cv, px, py, TL, TL);
}
