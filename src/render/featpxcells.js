import {hsh} from "./featart/kit.js";
/* PIXEL palette for the direction D cells: 6 BIOMES fields x 4 pxRamp steps, one char each (A-D bg0, E-H bg1, I-L floor0, M-P floor1, Q-T wall, U-X wallHi; outline, shadow, base, light). */
export const DPAL = {"A":"tile.bg0.outline","B":"tile.bg0.shadow","C":"tile.bg0","D":"tile.bg0.light","E":"tile.bg1.outline","F":"tile.bg1.shadow","G":"tile.bg1","H":"tile.bg1.light","I":"tile.floor0.outline","J":"tile.floor0.shadow","K":"tile.floor0","L":"tile.floor0.light","M":"tile.floor1.outline","N":"tile.floor1.shadow","O":"tile.floor1","P":"tile.floor1.light","Q":"tile.wall.outline","R":"tile.wall.shadow","S":"tile.wall","T":"tile.wall.light","U":"tile.wallHi.outline","V":"tile.wallHi.shadow","W":"tile.wallHi","X":"tile.wallHi.light"};
/* PIXEL base floor (depth round 2026-10-25): one 20x20 slab per (biome, parity, variant v 0..3 = floorart.js FLOOR_V) in the same cause-per-mark language as floorart.js:
   lit top-left edge, AO bottom-right, a few floor-step marks hash-seeded per cell, never a checker dither. n / w / nw (0 none, 1 wall, 2 brick) = the caster N / W / NW of
   the cell: light is upper-left, so the cell below a caster takes a shadow strip along its top (brick 4 rows, its front line two deep), the cell east one down its left side
   (wall 3 cols, brick 2) and the diagonal one a corner. Shadow = the floor's shadow step, contact line = its outline step. Pure; the atlas bakes and memoises each one.
   SAND's parity-B slab sits one step down (floor1.shadow base, ΔE 16.8 from BRICK-B where raw floor1 was 4.9), the PIXEL twin of floorart.js BED.SAND. */
const FSEED = {JUNGLE: 3, ICE: 5, FACTORY: 7, WATER: 11, ARENA: 13, SAND: 17, VOID: 19, CROWN: 23};
export function floorPxCell(name, par, v, n = 0, w = 0, nw = 0) {
  const [o, s, b, l] = par ? (name === "SAND" ? "MMNO" : "MNOP") : "IJKL", h = (i) => hsh((FSEED[name] || 1) * 31 + par, v + 1, i), r = (i, lo, hi) => lo + Math.floor(h(i) * (hi - lo + 1));
  const g = Array.from({length: 20}, () => Array(20).fill(b));
  const px = (x, y, ch) => { if (x >= 0 && x < 20 && y >= 0 && y < 20) g[y][x] = ch; };
  const run = (x, y, len, ch, dy = 0) => { for (let i = 0; i < len; i++) px(x + i, y + (dy ? i * dy : 0), ch); };
  for (let i = 0; i < 20; i++) { px(i, 19, s); px(19, i, s); px(i, 0, l); px(0, i, l); }
  px(19, 0, b); px(0, 19, b);
  const a = r(1, 0, 3), c = r(2, 0, 2);
  if (name === "JUNGLE") { run(3 + a, 6, 4, s); run(8 - a, 12, 5, s); run(4 + c, 15, 2, s); px(5 + c, 14, l); run(r(3, 3, 14), 3, 2, s); px(r(4, 10, 15), 9, l); }
  else if (name === "ICE") { run(14 + c, 3, 7, l, 1); run(15 + c, 3, 5, s, 1); px(r(3, 3, 15), 2, l); px(2, r(4, 3, 15), l); px(r(5, 3, 15), 17, l); }
  else if (name === "FACTORY") { for (const [x, y] of [[3, 3], [15, 3], [3, 15], [15, 15]]) { px(x, y, o); px(x + 1, y, s); px(x, y + 1, s); px(x + 1, y + 1, o); } run(6 + a, 9 + c, 7, l); run(5, 2, 10, s); }
  else if (name === "WATER") { run(5 + a, 9 + c, 5, l); run(4 + a, 10 + c, 8, s); run(3 + c, 14, 4, s); px(r(3, 3, 15), r(4, 3, 7), s); px(r(5, 3, 15), 17, s); }
  else if (name === "ARENA") { run(5 + a, 10 + c, 6, s, 0); run(8 + a, 8, 3, s, 1); px(16 - c, 16 - c, o); px(15 - c, 16 - c, s); px(r(3, 3, 15), r(4, 3, 7), s); }
  else if (name === "SAND") { for (let i = 0; i < 3; i++) { const x = 3 + r(i, 0, 3), y = 4 + i * 5 + r(i + 4, 0, 1), L = 6 + r(i + 8, 0, 3); run(x, y, L, l); run(x + 1, y + 1, L - 1, s); } px(r(3, 3, 15), r(4, 12, 16), l); }
  else if (name === "VOID") { run(3, 2, 10 + a, l); run(2, 3, 12, l, 1); run(5 + a, 12, 6, l, 1); px(r(3, 3, 15), r(4, 4, 15), l); }
  else { run(3, 17, 3, s); run(16, 4 + a, 3, s, 1); px(2, 2, l); px(3, 2, l); px(r(3, 3, 15), r(4, 3, 15), s); run(9 + c, 7 + a, 5, l); }
  if (n) for (let y = 0; y < (n > 1 ? 4 : 3); y++) for (let x = 0; x < 20; x++) g[y][x] = y < (n > 1 ? 2 : 1) ? o : s;
  if (w) for (let x = 0; x < (w > 1 ? 2 : 3); x++) for (let y = 0; y < 20; y++) g[y][x] = x < 1 ? o : s;
  if (nw && !n && !w) { px(0, 0, o); px(1, 0, s); px(0, 1, s); px(1, 1, s); }
  return {w: 20, h: 20, rows: g.map((q) => q.join("")), pal: {...DPAL}};
}
/* contact shadows (ink, drawn at alpha 0.32 by pixel/world.js): foot-line ellipses, anchor row = first row below the sprite's own foot */
const eli = (w, h, ay) => ({w, h, rows: Array.from({length: h}, (_, y) => { const p = (w >> 1) - Math.round(Math.sqrt(1 - ((y + 0.5) / h * 2 - 1) ** 2) * w / 2); return ".".repeat(p) + "i".repeat(w - 2 * p) + ".".repeat(p); }), pal: {i: "ink"}, anchor: [w >> 1, ay]});
export const SHADOW_CELLS = {foe: eli(14, 4, -5), item: eli(12, 3, -8), mako: eli(14, 4, -5)};
export function drawShadows(c, V, world, blit, snap) {
  const S = V.A.shadow, its = world.items, bs = world.bombs, es = world.enemies, ps = world.players, at = (f, o) => blit(c, V, f, snap(o.x), snap(o.y));
  c.globalAlpha = 0.32;
  for (const o of its) if (!o.taken && !o.buried) at(S.item, o);
  for (const o of bs) if (!o.dead) at(S.foe, o);
  for (const o of es) if (!o.dead) at(S.foe, o);
  ps.forEach((o, i) => { if (o.alive !== false && !(i === 0 && V.pop != null)) at(S.mako, o); });
  c.globalAlpha = 1;
}
/* BRICK slots, lowered one ramp step (about 8-14 L* on the face) so the brick is no longer the loudest tile: body, mortar / face, edge, crumble shade; CROWN keeps its gold hue (the shadow step of #ffd447 shifts to olive) */
export const brickPal = (name) => ({b: name === "CROWN" || name === "JUNGLE" ? "tile.brickB.light" : "tile.brickA.shadow", B: "tile.brickB.shadow", j: name === "JUNGLE" ? "tile.brickA.shadow" : "tile.brickA", m: "tile.brickB.outline"});
