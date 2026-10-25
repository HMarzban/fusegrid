/* World bezel (frame mockup A, 2026-10-25, THROWAWAY). The border ring is no
   longer a row of wall blocks with a repeated mark: every world gets ONE
   continuous rail inlaid along the cap (authored once per world in a cell's
   own (u along the run, w across it) space, periodic at 40 so the run never
   shows a seam) and a corner boss where two rails meet. Same slots as the
   walls (never a new hex): CLASSIC resolves them with slot2d, PIXEL through
   tools/walls/genpx.mjs, REAL 3D paints the same lists into the rim strip.
   "a|b" = CLASSIC slot a, PIXEL slot b. Pure data, no DOM. */
const R = (x, y, w, h, c) => ({r: [x, y, w, h], c});
const P = (p, c) => ({p, c});
const S = (s, w, c) => ({s, w, c});
const np = (x) => ({...x, npx: true});
const xp = (x) => ({...x, xpx: true});
const wave = (u0, u1, f) => { const o = []; for (let u = u0; u <= u1; u += 2.5) o.push([u, f(u)]); return o; };
const dia = (cx, cy, r) => [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]];
const oct = (cx, cy, r, k) => [[cx - k, cy - r], [cx + k, cy - r], [cx + r, cy - k], [cx + r, cy + k], [cx + k, cy + r], [cx - k, cy + r], [cx - r, cy + k], [cx - r, cy - k]];
/* clip a convex-window polygon to the rect [x0,y0,x1,y1] (Sutherland-Hodgman) */
function clip(p, x0, y0, x1, y1) {
  const fs = [[(q) => q[0] >= x0, (a, b) => { const t = (x0 - a[0]) / (b[0] - a[0]); return [x0, a[1] + t * (b[1] - a[1])]; }], [(q) => q[0] <= x1, (a, b) => { const t = (x1 - a[0]) / (b[0] - a[0]); return [x1, a[1] + t * (b[1] - a[1])]; }],
    [(q) => q[1] >= y0, (a, b) => { const t = (y0 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), y0]; }], [(q) => q[1] <= y1, (a, b) => { const t = (y1 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), y1]; }]];
  for (const [inside, cut] of fs) {
    const o = [];
    for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; if (inside(a)) { o.push(a); if (!inside(b)) o.push(cut(a, b)); } else if (inside(b)) o.push(cut(a, b)); }
    p = o;
    if (!p.length) break;
  }
  return p;
}
/* 45-degree stripes inside a square, alternating c0 / c1 */
function stripes(x0, y0, w, h, step, c0, c1) {
  const o = [];
  for (let k = -h, i = 0; k < w; k += step, i++) {
    const q = clip([[x0 + k, y0 + h], [x0 + k + step, y0 + h], [x0 + k + step + h, y0], [x0 + k + h, y0]], x0, y0, x0 + w, y0 + h);
    if (q.length > 2) o.push(P(q, i & 1 ? c1 : c0));
  }
  return o;
}

/* RAIL[world](u0, u1): the rail between u0 and u1 on the centre line w = 0
   (H cap: y = 11 + w, V cap: x = 11 + w). Features are placed by u and kept
   when their centre falls inside [u0, u1]. */
const at = (u0, u1, us) => us.filter((u) => u >= u0 && u <= u1);
export const RAIL = {
  /* timber beam: two grain grooves, a strap and nails per cell, one vine
     that wraps the beam (gold-family leaves, never green: green is BRICK) */
  JUNGLE: (u0, u1) => {
    const L = u1 - u0, o = [R(u0, -5, L, 2, "wall.pit|wall.shadow"), R(u0, 3, L, 2, "wall.pit|wall.shadow"), np(R(u0, -3, L, 1, "wall.light")), np(R(u0, 5, L, 1, "wall.light"))];
    for (const u of at(u0, u1, [20])) o.push(R(u - 2, -6, 4, 12, "wall.shadow"), np(R(u - 2, -6, 1, 12, "wall.light")), R(u - 1, -4, 2, 2, "wall.outline"), R(u - 1, 2, 2, 2, "wall.outline"));
    o.push(S(wave(u0, u1, (u) => 2.4 * Math.sin((u / 40) * 2 * Math.PI)), 2, "wall.outline|wall.shadow"), np(S(wave(u0, u1, (u) => 2.4 * Math.sin((u / 40) * 2 * Math.PI) - 0.8), 1, "wall.light")));
    for (const u of at(u0, u1, [8])) o.push(P([[u, -2.2], [u + 5, -6], [u + 6, -2.5]], "wallHi.light|wallHi"), P([[u, -2.2], [u + 4, -3.6], [u + 5, -2]], "wall.outline|wall.shadow"));
    for (const u of at(u0, u1, [32])) o.push(P([[u, 2.2], [u - 5, 6], [u - 6, 2.5]], "wallHi.light|wallHi"), P([[u, 2.2], [u - 4, 3.6], [u - 5, 2]], "wall.outline|wall.shadow"));
    return o;
  },
  /* frosted steel: a recessed channel with a lit lower lip, a rivet pair per
     half cell and one cold glint streak per cell */
  ICE: (u0, u1) => {
    const L = u1 - u0, o = [R(u0, -2, L, 4, "wallHi.shadow"), R(u0, 2, L, 2, "wallHi"), np(R(u0, -3, L, 1, "wall.outline"))];
    for (const u of at(u0, u1, [6, 14, 26, 34])) o.push(R(u - 1, -5.5, 2, 2, "wall.outline|wall.shadow"), np(R(u - 1, -5.5, 1, 1, "wallHi")), R(u - 1, 3.5, 2, 2, "wall.outline|wall.shadow"), np(R(u - 1, 3.5, 1, 1, "wallHi")));
    for (const u of at(u0, u1, [20])) o.push(np(P([[u - 4, 4], [u - 1, 4], [u + 4, -4], [u + 1, -4]], "wallHi")), xp(R(u - 2, -2, 4, 2, "wallHi")));
    return o;
  },
  /* riveted plate: a weld seam down the middle, rivets both sides every
     ten, a plate joint at the cell line */
  FACTORY: (u0, u1) => {
    const L = u1 - u0, o = [R(u0, -1, L, 3, "wallHi.shadow"), R(u0, -1, L, 1, "wallHi.light"), R(u0, 2, L, 1, "wall.outline")];
    for (const u of at(u0, u1, [5, 15, 25, 35])) for (const w of [-5, 3]) o.push(R(u - 1, w, 3, 3, "wall.outline"), R(u - 1, w, 2, 2, "wallHi.shadow"), np(R(u - 1, w, 1, 1, "wallHi.spec")));
    if (u0 <= 0.5) o.push(R(0, -6, 1, 12, "wall.pit|wall.shadow"), np(R(1, -6, 1, 12, "wallHi.light")));
    return o;
  },
  /* sluice stone: a dark water channel with two wave crests, a mooring
     post at the cell line */
  WATER: (u0, u1) => {
    const L = u1 - u0, f = (u) => -0.6 + 1.5 * Math.sin((u / 40) * 2 * Math.PI), top = wave(u0, u1, f), o = [R(u0, -5, L, 10, "wall.outline|wall.shadow")];
    o.push(P(top.concat([[u1, 4], [u0, 4]]), "wall"), S(top, 2, "wallHi"), np(S(wave(u0, u1, (u) => f(u) + 2.6), 1, "wallHi.shadow")));
    for (const u of at(u0, u1, [0, 40])) o.push(R(u - 1, -6, 3, 12, "wall.light"), R(u - 1, -6, 3, 2, "wallHi"));
    return o;
  },
  /* scored stone: two cut grooves with a lit lip each, tick marks and one
     lozenge a cell */
  ARENA: (u0, u1) => {
    const L = u1 - u0, o = [R(u0, -4, L, 2, "wall.shadow|wall.outline"), R(u0, -2, L, 2, "wallHi.light|wall.light"), R(u0, 2, L, 2, "wall.shadow|wall.outline"), R(u0, 4, L, 2, "wallHi.light|wall.light")];
    for (const u of at(u0, u1, [6, 12, 28, 34])) o.push(np(R(u, -1, 1, 3, "wall.shadow")));
    for (const u of at(u0, u1, [20])) o.push(P(dia(u + 0.5, 0.5, 5.5), "wall.shadow|wall.outline"), P(dia(u, 0, 4.5), "wallHi.light|wall.light"), P(dia(u, 0, 2), "wall.shadow|wall.outline"));
    return o;
  },
  /* dune stone: a rippled ridge, lit crest above, warm shade below */
  SAND: (u0, u1) => {
    const f = (u) => 0.8 + 1.8 * Math.sin((u / 40) * 2 * Math.PI), top = wave(u0, u1, f), bot = wave(u0, u1, (u) => f(u) + 4).reverse();
    return [P(top.concat(bot), "cap.warm|wall.light"), S(top, 2, "wallHi.light"), np(S(wave(u0, u1, (u) => f(u) + 5.2), 1, "wall.outline")), np(S(wave(u0, u1, (u) => f(u) - 3.5), 1, "wallHi.light")), np(S(wave(u0, u1, (u) => f(u) - 5.2), 1, "cap.warm"))];
  },
  /* black glass: one violet inlay line and a faceted node a cell (nothing
     above wallHi) */
  VOID: (u0, u1) => {
    const L = u1 - u0, o = [R(u0, -3, L, 6, "wall"), R(u0, -1, L, 2, "wallHi"), np(R(u0, -4, L, 1, "wallHi.shadow")), np(R(u0, 4, L, 1, "wallHi.shadow"))];
    for (const u of at(u0, u1, [20])) o.push(P(dia(u, 0, 6), "wallHi"), P(dia(u, 0, 4), "wall"), P(dia(u, 0, 1.6), "wallHi"));
    for (const u of at(u0, u1, [6, 34])) o.push(R(u - 1, -3, 2, 2, "wallHi"), R(u - 1, 1, 2, 2, "wallHi"));
    return o;
  },
  /* gilt frame: two gilt lines, a gilt boss and egg-and-dart dots */
  CROWN: (u0, u1) => {
    const L = u1 - u0, o = [R(u0, -5, L, 2, "wallHi"), R(u0, 3, L, 2, "wallHi")];
    for (const u of at(u0, u1, [6, 13, 27, 34])) o.push(R(u - 1, -1, 2, 2, "wallHi"));
    for (const u of at(u0, u1, [20])) o.push(P(oct(u, 0, 4.5, 2), "wallHi"), P(oct(u, 0, 2.5, 1), "wall.shadow|wall"), R(u - 0.5, -0.5, 1, 1, "wallHi"));
    return o;
  },
};

/* corner boss: centred (11, 11) in the cell's left-side coordinates, ~14 wide */
const BOSS = {
  JUNGLE: () => [P(oct(11, 11, 8, 3), "wall.outline|wall.shadow"), P(oct(11, 11, 6.5, 2.5), "wall"), S([[11, 5], [14, 6], [16, 11], [14, 16], [11, 17], [8, 16], [6, 11], [8, 6], [11, 5]], 1, "wall.pit|wall.shadow"), S([[11, 8.5], [13, 11], [11, 13.5], [9, 11], [11, 8.5]], 1, "wall.pit|wall.shadow"), R(10, 10, 2, 2, "wall.outline")],
  ICE: () => [R(3, 3, 16, 16, "wall.outline"), R(4, 4, 14, 14, "wallHi.shadow"), R(5, 5, 12, 12, "wallHi.dim|wall.light"), P(dia(11, 11, 5), "wallHi"), P(dia(11, 11, 2.5), "wallHi.shadow"), R(5, 5, 2, 2, "wall.outline"), R(15, 5, 2, 2, "wall.outline"), R(5, 15, 2, 2, "wall.outline"), R(15, 15, 2, 2, "wall.outline")],
  FACTORY: () => [R(3, 3, 16, 16, "wall.outline"), ...stripes(4, 4, 14, 14, 5, "wallHi.light", "wall.outline"), R(3, 3, 16, 1, "wall.outline"), R(3, 18, 16, 1, "wall.outline"), R(3, 3, 1, 16, "wall.outline"), R(18, 3, 1, 16, "wall.outline")],
  WATER: () => [P(oct(11, 11, 8, 3), "wall.outline|wall.shadow"), P(oct(11, 11, 6.5, 2.5), "wallHi"), P(oct(11, 11, 4.5, 2), "wall.outline|wall.shadow"), S([[11, 6], [11, 16]], 2, "wallHi"), S([[6, 11], [16, 11]], 2, "wallHi"), R(10, 10, 2, 2, "wall.outline|wall.shadow")],
  ARENA: () => [P(dia(11, 11, 9), "wall.shadow|wall.outline"), P(dia(11, 11, 7.5), "wallHi.light|wall.light"), P(dia(11, 11, 5.5), "wall.shadow|wall.outline"), P(dia(11, 11, 3.5), "wallHi.light|wall.light"), R(10, 10, 2, 2, "wall.shadow|wall.outline")],
  SAND: () => [R(3, 3, 16, 16, "wall.outline"), R(4, 4, 14, 14, "cap.warm|wall.light"), R(6, 6, 10, 10, "wallHi.light"), R(8, 8, 6, 6, "cap.warm|wall.light"), R(10, 10, 2, 2, "wallHi.light"), R(4, 4, 14, 1, "wallHi.light"), R(4, 4, 1, 14, "wallHi.light")],
  VOID: () => [P(dia(11, 11, 9), "wallHi"), P(dia(11, 11, 7), "wall"), P(dia(11, 11, 4.5), "wallHi"), P(dia(11, 11, 2.5), "wall"), R(10, 10, 2, 2, "wallHi")],
  CROWN: () => [R(3, 3, 16, 16, "wallHi"), R(5, 5, 12, 12, "wall.shadow|wall"), P(dia(11, 11, 4.5), "wallHi"), P(dia(11, 11, 2.5), "wall.shadow|wall"), R(3, 3, 4, 4, "wallHi.light|wallHi"), R(15, 3, 4, 4, "wallHi.light|wallHi"), R(3, 15, 4, 4, "wallHi.light|wallHi"), R(15, 15, 4, 4, "wallHi.light|wallHi")],
};
/* compact: the corner cells sit under the hearts and the score column, so the
   boss stays in the upper outer 13 px (y < 16) and the rails end at it */
export const bossOf = (b, k = 0.8, c = 10) => BOSS[b.name]().map((s) => {
  const m = ([x, y]) => [c + (x - 11) * k, c + (y - 11) * k];
  if (s.r) { const [x, y] = m(s.r); return {...s, r: [x, y, s.r[2] * k, s.r[3] * k]}; }
  return s.p ? {...s, p: s.p.map(m)} : {...s, s: s.s.map(m), w: s.w * k};
});

const xf = (s, ax) => {
  const sw = (a, c) => (ax === "h" ? [a, 11 + c] : [11 + c, a]);
  if (s.r) { const [u, w, du, dw] = s.r; return {...s, r: ax === "h" ? [u, 11 + w, du, dw] : [11 + w, u, dw, du]}; }
  if (s.p) return {...s, p: s.p.map(([u, w]) => sw(u, w))};
  return {...s, s: s.s.map(([u, w]) => sw(u, w))};
};
/* the rail of world b over [u0, u1] along axis "h" (a row) or "v" (a column) */
export const railOf = (b, ax, u0 = 0, u1 = 40) => RAIL[b.name](u0, u1).map((s) => xf(s, ax));
