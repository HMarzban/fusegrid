/* Base floor (integration round 2026-10-25): the 195-cell checker as one quiet
   material per biome, painted in a 40x40 tile with the context already at the
   cell origin. Every cell is a flush slab (1px lit top-left edge, a soft AO
   bottom-right); the marks are low-contrast and each has a cause (damp, wear,
   wind, tooling). Only biome slots, black / white alpha and slot mixes: no new
   hex. Variants v (0..FLOOR_V-1) move the marks, never the structure, and the
   whole thing is a pure function of (biome, parity, v): no Math.random. The
   floor must stay far quieter than the direction D tiles, pickups, bombs and
   foes (busyness < 1.5 at the 40 px view, bed well off BRICK and WALL). */
import {hsh, mix, rgb} from "./featart/kit.js";

export const FLOOR_V = 4;
const SEED = {JUNGLE: 3, ICE: 5, FACTORY: 7, WATER: 11, ARENA: 13, SAND: 17, VOID: 19, CROWN: 23};
const rg = (h, a) => { const q = rgb(h); return "rgba(" + q[0] + "," + q[1] + "," + q[2] + "," + a + ")"; };
const W = (a) => "rgba(255,255,255," + a + ")";

/* the bed colour of a slab: the slot, except where the slot alone fails the
   bed gates (SAND's B slab sits on BRICK-B, VOID's A slab on the wall): those
   take a step toward the biome's own shadow (SAND A a step toward wallHi, a
   sun-bleached slab), never a new hue */
export const BED = {
  SAND: (b, par) => (par ? mix(b.bg1, b.floor1, 0.28) : mix(b.wallHi, b.floor0, 0.08)),
  VOID: (b, par) => (par ? b.bg1 : mix(b.bg1, b.floor0, 0.55)),
};
export const bedOf = (b, par) => (BED[b.name] ? BED[b.name](b, par) : par ? b.floor1 : b.floor0);

/* [lit alpha, AO alpha] per biome: light beds carry less white, dark beds less black */
const EDGE = {JUNGLE: [0.12, 0.2], ICE: [0.2, 0.14], FACTORY: [0.1, 0.22], WATER: [0.1, 0.22], ARENA: [0.1, 0.2], SAND: [0.12, 0.17], VOID: [0.085, 0.3], CROWN: [0.11, 0.24]};

const PAINT = {
  JUNGLE(c, b, par, o) {
    const {n, R, sh} = o, moss = rg(b.brickB, 0.17);
    for (let i = 0; i < 3; i++) { const w = n(i, 5, 10), x = n(i + 3, 4, 34 - w), y = 7 + i * 11 + n(i + 6, 0, 4); R(x, y, w, 1, sh(0.07)); R(x + 1, y + 1, w - 2, 1, W(0.025)); }
    for (let i = 0; i < 2 + (o.h(9) > 0.5 ? 1 : 0); i++) { const x = n(i + 12, 5, 31), y = n(i + 15, 6, 30); R(x + 1, y + 2, 2, 1, sh(0.12)); R(x, y, 2, 2, sh(0.17)); R(x, y, 1, 1, W(0.13)); }
    const left = o.h(20) > 0.5, mx = left ? 2 : 32;
    for (let i = 0; i < 8; i++) R(mx + n(i + 21, 0, 4), 31 + n(i + 30, 0, 5), 1, 1, moss);
    R(mx + n(40, 1, 3), 31 + n(41, 1, 3), 2, 1, W(0.07));
  },
  ICE(c, b, par, o) {
    const {n, R, sh, ln} = o, d = n(0, -4, 4);
    ln([[34 + d, 3], [7 + d, 31]], 3.2, W(0.05));
    ln([[31 + d, 3], [5 + d, 29]], 1, W(0.09));
    ln([[37 + d, 8], [11 + d, 34]], 1, sh(0.05));
    for (let i = 0; i < 6; i++) { const e = n(i + 5, 0, 3), t = n(i + 12, 3, 36); if (e === 0) R(t, 2 + n(i + 20, 0, 2), 1, 1, W(0.16)); else if (e === 1) R(2 + n(i + 20, 0, 2), t, 1, 1, W(0.16)); else R(t, 34 + n(i + 20, 0, 2), 1, 1, W(0.1)); }
  },
  FACTORY(c, b, par, o) {
    const {n, R, sh} = o;
    R(3, 3, 34, 1, sh(0.16)); R(3, 4, 1, 32, sh(0.16)); R(4, 36, 33, 1, W(0.06)); R(36, 4, 1, 32, W(0.06));
    for (const [x, y] of [[6, 6], [32, 6], [6, 32], [32, 32]]) { R(x + 1, y + 1, 2, 2, sh(0.2)); R(x, y, 2, 2, sh(0.34)); R(x, y, 1, 1, W(0.16)); }
    for (let i = 0; i < 4; i++) { const w = n(i, 7, 17), x = n(i + 4, 9, 31 - w), y = 11 + i * 6 + n(i + 8, 0, 2); R(x, y, w, 1, W(0.035)); }
  },
  WATER(c, b, par, o) {
    const {n, R, sh} = o, cx = 22 + n(0, -3, 3), cy = 24 + n(1, -3, 3);
    R(cx - 9, cy - 1, 18, 3, sh(0.06)); R(cx - 7, cy - 2, 14, 5, sh(0.06)); R(cx - 4, cy - 3, 8, 7, sh(0.05));
    R(cx - 6, cy - 2, 5, 1, W(0.12)); R(cx - 8, cy - 1, 2, 1, W(0.08));
    for (let i = 0; i < 5; i++) R(n(i + 3, 4, 34), n(i + 9, 4, 20), 1, 1, sh(0.1));
    R(n(30, 5, 15), 36, n(31, 4, 9), 1, sh(0.12));
  },
  ARENA(c, b, par, o) {
    const {n, R, sh, ln} = o, k = n(0, 0, 2);
    { const x = n(3, -5, 5), y = n(4, -4, 4); R(10 + x, 14 + y, 20, 12, W(0.02)); R(12 + x, 11 + y, 16, 18, W(0.02)); R(14 + x, 9 + y, 12, 22, W(0.018)); }
    c.strokeStyle = sh(0.075); c.lineWidth = 1; c.beginPath(); c.arc(18 + n(1, 0, 4), 22, 9, Math.PI * 1.1, Math.PI * 1.6); c.stroke();
    ln([[22, 31 + n(2, 0, 2)], [30, 29]], 1, sh(0.07));
    const cs = [[36, 2], [2, 36], [36, 36]][k]; R(cs[0] - (cs[0] > 20 ? 3 : 0), cs[1] - (cs[1] > 20 ? 3 : 0), 3, 3, sh(0.2)); R(cs[0] - (cs[0] > 20 ? 2 : 0), cs[1] - (cs[1] > 20 ? 2 : 0), 2, 2, sh(0.1));
    for (let i = 0; i < 4; i++) R(n(i + 5, 5, 34), n(i + 11, 5, 34), 1, 1, sh(0.12));
  },
  SAND(c, b, par, o) {
    const {n, R, sh, ln} = o;
    for (let i = 0; i < 3; i++) {
      const y0 = 9 + i * 10 + n(i, -2, 2), x0 = 5 + n(i + 4, 0, 5), x1 = 31 + n(i + 8, 0, 4), ph = o.h(i + 12) * 6, p = [];
      for (let x = x0; x <= x1; x += 2) p.push([x, y0 + Math.sin(x / 4.4 + ph) * 1.15]);
      ln(p, 1.2, W(0.11)); ln(p.map(([x, y]) => [x, y + 1.7]), 1.4, sh(0.1));
    }
    for (let i = 0; i < 9; i++) R(n(i + 20, 3, 36), n(i + 30, 3, 36), 1, 1, i & 1 ? W(0.09) : sh(0.08));
  },
  VOID(c, b, par, o) {
    const {n, R, sh, ln} = o, d = par ? 5 : -5;
    R(4, 4, 32, 1, W(0.045)); R(4, 5, 1, 30, W(0.045)); R(5, 35, 31, 1, sh(0.3)); R(35, 5, 1, 31, sh(0.3));
    ln([[33 + d + n(0, 0, 2), 6], [10 + d, 34]], 2.4, W(0.035));
    ln([[27 + d + n(0, 0, 2), 6], [6 + d, 30]], 1, W(0.05));
    for (let i = 0; i < 3; i++) R(n(i + 3, 8, 32), n(i + 7, 8, 32), 1, 1, W(0.07));
  },
  CROWN(c, b, par, o) {
    const {n, R, sh, ln} = o;
    { const x = n(20, 2, 6), y = n(21, 2, 6); R(9 + x, 13 + y, 16, 10, W(0.022)); R(11 + x, 10 + y, 12, 16, W(0.022)); R(13 + x, 8 + y, 8, 20, W(0.016)); }
    for (let i = 0; i < 5; i++) { const y = 8 + i * 5 + n(i, 0, 2); ln([[35, y], [37, y + 2]], 1, sh(0.12)); }
    for (let i = 0; i < 4; i++) { const x = 9 + i * 6 + n(i + 6, 0, 2); ln([[x, 35], [x + 2, 37]], 1, sh(0.11)); }
    R(3, 3, 1, 1, W(0.14)); R(4, 3, 1, 1, W(0.08));
    for (let i = 0; i < 3; i++) R(n(i + 10, 6, 33), n(i + 14, 6, 33), 1, 1, sh(0.12));
  },
};

/* paint one slab at the context origin; par 0 = floor0, 1 = floor1; v = variant;
   mode 1 = the slot's own bed, mode 2 = a near-white bed (REAL 3D
   multiplies the map by the per-cell floor0 / floor1 instance colour, so the
   map must carry no colour of its own or the slot is applied twice) */
export function paintFloor(c, b, par, v = 0, mode = 0) {
  par = par ? 1 : 0; v = (v | 0) % FLOOR_V;
  const seed = SEED[b.name] * 31 + par, h = (i) => hsh(seed, v + 1, i), sh = (a) => rg(b.bg1, a);
  const R = (x, y, w, hh, col) => { c.fillStyle = col; c.fillRect(x, y, w, hh); };
  const ln = (p, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); };
  const n = (i, lo, hi) => lo + Math.floor(h(i) * (hi - lo + 1));
  R(0, 0, 40, 40, mode === 2 ? "#f4f4f4" : mode === 1 ? (par ? b.floor1 : b.floor0) : bedOf(b, par));
  (PAINT[b.name] || (() => {}))(c, b, par, {h, n, R, sh, ln});
  const [lit, ao] = EDGE[b.name] || [0.1, 0.2];
  R(0, 39, 40, 1, sh(ao)); R(39, 0, 1, 40, sh(ao));
  R(1, 38, 38, 1, sh(ao * 0.45)); R(38, 1, 1, 38, sh(ao * 0.45));
  R(0, 0, 39, 1, W(lit)); R(0, 1, 1, 38, W(lit));
}

/* the variant a board cell takes: stable per (x, y, room), render-side only */
export const floorVar = (x, y, level) => Math.floor(hsh(x + 1, y + 1, level | 0) * FLOOR_V);
