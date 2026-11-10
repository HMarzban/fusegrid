/* LOGO B GEOMETRY: the FUSE/GRID wordmark (logo B, LIT FUSE) as pure data and geometry in cap units (C = 1, y down, cap line 0, baseline 1), ported from
   the round 7 mock as built (appendix section 8; its 14 builder deviations are binding). Every look reads this file: the CLASSIC painter, the PIXEL bake
   and the REAL 3D build. No DOM, no canvas, no clock, no randomness; every result is deep-frozen.
   Paths are op lists a painter replays on a canvas path or flattens with flat():
     ["M",x,y] ["L",x,y] ["Q",cx,cy,x,y] ["C",c1x,c1y,c2x,c2y,x,y] ["A",cx,cy,r,a0,a1,ccw] (canvas arc, joined from the current point) ["Z"].
   Parts (spark, bomb, world motifs) are drawn in list order:
     fill  {d, col, a?, ink?, clip?}  fill d; ink > 0 strokes d first in P.ol at that width, round joins; clip "face" = inside the faces only
     line  {d, w, col, cap}           stroke d, round joins
     disc  {x, y, r, col}   ring {x, y, r, w, col}   rect {x, y, w, h, col}   ell {x, y, rx, ry, rot, col, a?}   rrect {x, y, w, h, r, col}
     rim   {x, y, rx, ry, dx, dy, a0, a1, r, col}  even-odd of the body ellipse and itself moved (dx, dy), kept to the wedge a0..a1 of radius r
     clip "body" = inside the bomb body ellipse; tf [x, y, rot] = drawn in a frame moved to (x, y) and turned rot (radians).
   glyph(ch): d = one op list per shape (rings as subpaths, filled even-odd; round tops and bottoms overshoot OVER, radii clamped to half an edge, as
   canvas arcTo draws them), rings = the same flattened; inGlyph tests a point in the letter's own units. layout(build) is the one box per build
   ("line" | "stack"): letters {ch, x, y, word 0 FUSE / 1 GRID, i}, bomb {x, y, d}, cord control points, collar tip, face, baselines, env.
   cordPath: 97 samples {x, y, s arc length, tx, ty}, 6 straight segments from the collar tip (the MONO start at the mono tier) to P0, then 90 of the
   cubic; atS(pts, s) is the point at arc length s (braid ticks, the intro run-up). sparkAt: the cord tip moved along its tangent by SPARK.off[tier].
   spark(frame, {reduced, tier, px}) around its centre: frame = floor(t * 14) & 1 (0 A, 1 B); reduced = frame A in #ffb347, no embers; the small tier
   grows it to 8 px across; no embers at the MENU and small tiers. bomb(dpx): units of D, origin the centre, tiers hero >= 60 px, the 40 recipe >= 26,
   else the 24 recipe; tip = the collar tip; in the logo its body joins the letters' solid, standalone it adds BOMB.shadow.
   px arguments are the cap height (or the bomb diameter) in CSS px; they only raise the appendix's minimum widths ("min n px"). */
import {CONST} from "../kit/tokens.js";

const deep = (o) => { for (const v of Object.values(o)) if (v && typeof v === "object" && !Object.isFrozen(v)) deep(v); return Object.freeze(o); };
const rad = (d) => (d * Math.PI) / 180;
export const P = deep({ol: CONST.ol, dk: CONST.dk, cream: CONST.ink, t2: CONST.t2, white: "#ffffff", yel: CONST.yel, yelLip: CONST.yelLip, pale: "#fff3b0",
  cor: CONST.cor, corLip: "#c23058", corHi: "#ffc0d0", amb: "#ffb347", cord: CONST.cord, cord2: CONST.cord2, bomb: "#15181f", bombOl: "#0a0d14", lobe: "#2a3550",
  steel: "#8a96a4", steelHi: "#d0d8e0", steelDk: "#3d4a58", fillRim: "#2e4a78", spec: "#fff8ec", key: "#fff4e2", fill: "#bcd4ff"});
export const GL = deep({
  F: {w: 0.58, sh: [[[[0, 0, .08], [.58, 0, .02], [.58, .23, .02], [.26, .23, .05], [.26, .345, .05], [.40, .345, .02], [.40, .575, .02], [.26, .575, .05], [.26, 1, .02], [0, 1, .08]]]], bot: [[0, .26]], top: [[.04, .56]]},
  U: {w: 0.70, sh: [[[[0, 0, .02], [.25, 0, .02], [.25, .77, .05], [.45, .77, .05], [.45, 0, .02], [.70, 0, .02], [.70, 1, .30], [0, 1, .30]]]], bot: [[.12, .58]], top: [[.02, .23], [.47, .68]]},
  S: {w: 0.66, sh: [[[[.02, 0, .30], [.64, 0, .22], [.64, .30, .02], [.38, .30, .02], [.38, .22, .05], [.28, .22, .05], [.28, .40, .05], [.66, .40, .30], [.66, 1, .30], [0, 1, .22], [0, .70, .02], [.26, .70, .02], [.26, .78, .05], [.40, .78, .05], [.40, .60, .05], [.02, .60, .30]]]], bot: [[.10, .54]]},
  E: {w: 0.60, sh: [[[[0, 0, .08], [.60, 0, .02], [.60, .23, .02], [.26, .23, .05], [.26, .395, .05], [.50, .395, .02], [.50, .605, .02], [.26, .605, .05], [.26, .77, .05], [.60, .77, .02], [.60, 1, .02], [0, 1, .08]]]], bot: [[.04, .56]], top: [[.04, .56]]},
  G: {w: 0.72, sh: [[[[0, 0, .30], [.72, 0, .22], [.72, .30, .02], [.46, .30, .02], [.46, .23, .05], [.26, .23, .05], [.26, .77, .05], [.46, .77, .05], [.46, .70, .02], [.40, .70, .02], [.40, .50, .02], [.72, .50, .04], [.72, 1, .30], [0, 1, .30]]]], bot: [[.12, .60]], top: [[.14, .66]]},
  R: {w: 0.68, sh: [[[[0, 0, .08], [.68, 0, .30], [.68, .55, .30], [.26, .55, .02], [.26, 1, .02], [0, 1, .08]], [[.26, .22, .05], [.42, .22, .05], [.42, .34, .05], [.26, .34, .05]]], [[[.30, .50, .02], [.5175, .50, .02], [.68, 1, .02], [.40, 1, .02], [.268, .59, .02]]]], bot: [[0, .26], [.40, .68]], top: [[.04, .50]]},
  I: {w: 0.28, sh: [[[[0, 0, .06], [.28, 0, .06], [.28, 1, .06], [0, 1, .06]]]], bot: [[0, .28]], top: [[.02, .26]]},
  D: {w: 0.70, sh: [[[[0, 0, .08], [.70, 0, .38], [.70, 1, .38], [0, 1, .08]], [[.26, .23, .05], [.46, .23, .12], [.46, .77, .12], [.26, .77, .05]]]], bot: [[.04, .50]], top: [[.04, .46]]},
});
export const GAP = deep({FU: .07, US: .09, SE: .09, GR: .10, RI: .09, ID: .11});
export const OVER = 0.015, BD = 0.72;
export const FACE = deep({full: {f: [P.yel, P.yelLip, P.pale], g: [P.cor, P.corLip, P.corHi]}, menu: {f: [P.cream, P.t2, P.white], g: [P.cream, P.t2, P.white]},
  mono: {f: [P.cream], g: [P.cream]}, ink: {f: [P.ol], g: [P.ol]}});
export const faces = (tier, ver) => (tier === "mono" ? (ver === "ink" ? FACE.ink : FACE.mono) : tier === "menu" ? FACE.menu : FACE.full);
export const STACK = deep({ol: .10, ext: .14, smallPx: 2, close: .08, shade: [-.04, -.06], shadePx: 2, light: [.025, .035], lightTiers: ["title", "menu"], plateA: .94, side: P.dk});
export const CORD = deep({w0: .11, w1: .09, minPx: 3, ol: .035, olPx: 1.2, olPxSmall: 2, col: P.cord, lead: 6, n: 90,
  braid: {w: .025, wPx: 1, len: .2, deg: 35, step: {title: .10, token: .16}, first: .6, stop: .08, col: P.cord2},
  light: {w: .015, wPx: 1, inset: .022, insetPx: 1.4, col: P.pale}, burnt: {len: .07, k: 1.3, col: P.cord2}, char: {w: .03, wPx: 1.5, half: .1, back: .01, col: P.dk}});
export const MONO = deep({start: [.23, -.27], w: .10, wPx: 2, ring: {off: .04, r: .08, w: .04, wPx: 1.5}});
export const SPARK = deep({A: {len: .17, deg: 15, col: P.yel, ember: [[.18, -.08], [-.10, -.16]]}, B: {len: .13, deg: 45, col: P.cor, ember: [[.12, -.18], [.20, .04]]},
  root: .05, core: .065, coreInk: .025, ink: .02, inkPx: 1, ember: .03, off: {title: .04, token: 0, menu: 0, small: -.04}, minPx: {small: 8}, reach: .34, hz: 14});
export const BOMB = deep({hero: 60, mid: 26, rx: .5, ry: .48, oy: .02, ol: .05, collar: {deg: 40, at: .52, tip: .60},
  shadow: {k: "ell", x: 0, y: .49, rx: .20, ry: .045, rot: 0, col: "#000000", a: .35}});
export const LOOK3D = deep({sy: .93, drop: .135, hull: .06, mix: .30, deep: .72, shadow: {dx: .08, dy: .12, sigma: .02, a: .45}});
export const PX_SCALE = deep({title: 3, menu: 3, small: 2});
export const pxEnv = (A) => deep({t: Math.max(Math.ceil(.40 * A), 7), b: Math.ceil(.36 * A), s: Math.ceil(.20 * A)});

function ringOps(ring, out) {
  const n = ring.length, q = ring.map(([x, y, r]) => [x, r >= .2 && y === 0 ? y - OVER : r >= .2 && y === 1 ? y + OVER : y]);
  const D = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const rr = ring.map((p, i) => Math.min(p[2], D(q[(i + n - 1) % n], q[i]) / 2, D(q[i], q[(i + 1) % n]) / 2));
  let cur = [(q[n - 1][0] + q[0][0]) / 2, (q[n - 1][1] + q[0][1]) / 2];
  out.push(["M", cur[0], cur[1]]);
  for (let i = 0; i < n; i++) {
    const p = q[i], nx = q[(i + 1) % n], r = rr[i], a = [cur[0] - p[0], cur[1] - p[1]], b = [nx[0] - p[0], nx[1] - p[1]], la = Math.hypot(...a), lb = Math.hypot(...b);
    const u = [a[0] / la, a[1] / la], v = [b[0] / lb, b[1] / lb];
    if (!r || Math.abs(u[0] * v[1] - u[1] * v[0]) < 1e-12) { out.push(["L", p[0], p[1]]); cur = p; continue; }
    const th = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]))), d = r / Math.tan(th / 2), h = r / Math.sin(th / 2), m = Math.hypot(u[0] + v[0], u[1] + v[1]);
    const t1 = [p[0] + u[0] * d, p[1] + u[1] * d], t2 = [p[0] + v[0] * d, p[1] + v[1] * d], c = [p[0] + ((u[0] + v[0]) / m) * h, p[1] + ((u[1] + v[1]) / m) * h];
    const a0 = Math.atan2(t1[1] - c[1], t1[0] - c[0]), a1 = Math.atan2(t2[1] - c[1], t2[0] - c[0]);
    let da = a1 - a0;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    out.push(["L", t1[0], t1[1]], ["A", c[0], c[1], r, a0, a1, da < 0]);
    cur = t2;
  }
  out.push(["Z"]);
}
const sweep = (a0, a1, ccw) => {
  const T = 2 * Math.PI;
  if (!ccw) { if (a1 - a0 >= T) return T; const d = (a1 - a0) % T; return d < 0 ? d + T : d; }
  if (a0 - a1 >= T) return -T;
  const d = (a0 - a1) % T;
  return -(d < 0 ? d + T : d);
};
export function flat(ops, seg = 16) {
  const out = [];
  let sub = null, cur = [0, 0];
  const add = (x, y) => { if (!sub) out.push((sub = {pts: [], closed: false})); sub.pts.push([x, y]); cur = [x, y]; };
  for (const o of ops) {
    if (o[0] === "M") { out.push((sub = {pts: [], closed: false})); add(o[1], o[2]); }
    else if (o[0] === "L") add(o[1], o[2]);
    else if (o[0] === "Q") { const [x0, y0] = cur; for (let i = 1; i <= seg; i++) { const t = i / seg, u = 1 - t; add(u * u * x0 + 2 * u * t * o[1] + t * t * o[3], u * u * y0 + 2 * u * t * o[2] + t * t * o[4]); } }
    else if (o[0] === "C") { const [x0, y0] = cur; for (let i = 1; i <= seg; i++) { const t = i / seg, u = 1 - t, A = u * u * u, B = 3 * u * u * t, C = 3 * u * t * t, E = t * t * t; add(A * x0 + B * o[1] + C * o[3] + E * o[5], A * y0 + B * o[2] + C * o[4] + E * o[6]); } }
    else if (o[0] === "A") { const [, cx, cy, r, a0, a1, ccw] = o, s = sweep(a0, a1, ccw), n = Math.max(2, Math.ceil(Math.abs(s) / (Math.PI / 16))); for (let i = 0; i <= n; i++) add(cx + r * Math.cos(a0 + (s * i) / n), cy + r * Math.sin(a0 + (s * i) / n)); }
    else if (o[0] === "Z" && sub) { sub.closed = true; cur = sub.pts[0]; sub = null; }
  }
  return deep(out);
}
const GLY = new Map();
export function glyph(ch) {
  let g = GLY.get(ch);
  if (!g) {
    const L = GL[ch], d = L.sh.map((rings) => { const o = []; for (const r of rings) ringOps(r, o); return o; });
    GLY.set(ch, (g = deep({ch, w: L.w, d, rings: d.map((o) => flat(o).map((s) => s.pts)), bot: L.bot || [], top: L.top || []})));
  }
  return g;
}
const inPoly = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
export const inShape = (rings, x, y) => rings.reduce((c, r) => (inPoly(r, x, y) ? !c : c), false);
export const inGlyph = (ch, x, y) => glyph(ch).rings.some((rings) => inShape(rings, x, y));
export const wordW = (w) => [...w].reduce((a, ch, i) => a + GL[ch].w + (i ? GAP[w[i - 1] + ch] : 0), 0);

const bez = (Q, t) => { const u = 1 - t; return [0, 1].map((k) => u * u * u * Q[0][k] + 3 * u * u * t * Q[1][k] + 3 * u * t * t * Q[2][k] + t * t * t * Q[3][k]); };
const CP = {line: [[.31, .73], [.39, .82], [.40, 1.03], [.54, 1.18]], stack: [[.31, .73], [.45, .95], [.22, 1.55], [.42, 2.46]]};
const LAY = new Map();
export function layout(build) {
  if (build !== "line" && build !== "stack") throw new Error("logo build " + build);
  if (LAY.has(build)) return LAY.get(build);
  const L = {build, letters: []};
  const put = (w, x, y, word) => { let cx = x; [...w].forEach((ch, i) => { if (i) cx += GAP[w[i - 1] + ch]; L.letters.push({ch, x: cx, y, word, i: L.letters.length}); cx += GL[ch].w; }); return cx; };
  const rel = (o, pts) => pts.map(([px, py]) => [o[0] + px, o[1] - py]);
  if (build === "line") {
    const xe = put("FUSE", 0, 0, 0), bx = xe + .10 + BD / 2;
    put("GRID", xe + .90, 0, 1);
    L.bomb = {x: bx, y: 1 - BD / 2, d: BD};
    L.cord = rel([bx, 1], CP.line);
    L.face = {w: 6.37, h: 1};
    L.base = [1];
  } else {
    const xg = put("GRID", 0, 1.30, 1), bx = xg + .10 + BD / 2;
    L.bomb = {x: bx, y: 2.30 - BD / 2, d: BD};
    L.cord = rel([bx, 2.30], CP.stack);
    let t = 0.5;
    for (let i = 0; i < 40; i++) { const p = bez(L.cord, t); t += (p[1] - 0.5) * 0.4; }
    const cx = bez(L.cord, t)[0], cw = .11 - .02 * t, indent = cx - (cw / 2 + .035) - .10 - wordW("FUSE");
    const fl = put("FUSE", indent, 0, 0);
    L.indent = +indent.toFixed(3);
    L.eGap = +((cx - cw / 2 - .035) - fl).toFixed(3);
    L.face = {w: 3.74, h: 2.30};
    L.base = [1, 2.30];
  }
  const a = rad(BOMB.collar.deg);
  L.collar = [L.bomb.x + Math.sin(a) * BOMB.collar.tip * BD, L.bomb.y + BOMB.oy * BD - Math.cos(a) * BOMB.collar.tip * BD];
  L.env = {l: -.20, t: -.40, w: L.face.w + .40, h: L.face.h + .76};
  LAY.set(build, deep(L));
  return LAY.get(build);
}

const CORDS = new Map();
export function cordPath(build, tier) {
  const k = build + (tier === "mono" ? ":mono" : "");
  if (CORDS.has(k)) return CORDS.get(k);
  const L = layout(build), Q = L.cord, st = tier === "mono" ? [L.bomb.x + MONO.start[0], L.bomb.y + MONO.start[1]] : L.collar, pts = [];
  for (let i = 0; i <= CORD.lead; i++) { const t = i / CORD.lead; pts.push([st[0] + (Q[0][0] - st[0]) * t, st[1] + (Q[0][1] - st[1]) * t]); }
  for (let i = 1; i <= CORD.n; i++) pts.push(bez(Q, i / CORD.n));
  let s = 0;
  const out = pts.map((p, i) => { if (i) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]); return {x: p[0], y: p[1], s}; });
  for (let i = 0; i < out.length; i++) { const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.y - a.y) || 1; out[i].tx = (b.x - a.x) / l; out[i].ty = (b.y - a.y) / l; }
  CORDS.set(k, deep(out));
  return CORDS.get(k);
}
export function atS(pts, s) {
  for (let i = 1; i < pts.length; i++) if (pts[i].s >= s) { const a = pts[i - 1], b = pts[i], f = (s - a.s) / (b.s - a.s || 1); return deep({x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, tx: b.tx, ty: b.ty}); }
  const e = pts[pts.length - 1];
  return deep({x: e.x, y: e.y, tx: e.tx, ty: e.ty});
}
export function sparkAt(build, tier) {
  const e = cordPath(build)[CORD.lead + CORD.n], off = SPARK.off[tier] || 0;
  return deep({x: e.x + e.tx * off, y: e.y + e.ty * off});
}
export function spark(frame, o = {}) {
  const red = !!o.reduced, f = red || !(frame & 1) ? SPARK.A : SPARK.B, px = o.px || Infinity;
  const k = Math.max(1, (SPARK.minPx[o.tier] || 0) / (SPARK.reach * px)), len = f.len * k, rw = SPARK.root * k, inkw = Math.max(SPARK.ink * k, SPARK.inkPx / px), col = red ? P.amb : f.col;
  const rays = [0, 1, 2, 3].map((i) => { const a = rad(f.deg + i * 90), dx = Math.cos(a), dy = Math.sin(a); return [["M", (-dy * rw) / 2, (dx * rw) / 2], ["L", dx * len, dy * len], ["L", (dy * rw) / 2, (-dx * rw) / 2], ["Z"]]; });
  const parts = [...rays.map((d) => ({k: "line", d, w: 2 * inkw, col: P.ol, cap: "round"})), ...rays.map((d) => ({k: "fill", d, col}))];
  if (!red && o.tier !== "small" && o.tier !== "menu") for (const [ex, ey] of f.ember) { const q = SPARK.ember * k; parts.push({k: "rect", x: ex * k - q / 2, y: ey * k - q / 2, w: q, h: q, col: P.amb}); }
  parts.push({k: "disc", x: 0, y: 0, r: (SPARK.core + SPARK.coreInk) * k, col: P.ol}, {k: "disc", x: 0, y: 0, r: SPARK.core * k, col: red ? P.amb : P.pale});
  return deep({frame: f === SPARK.B ? 1 : 0, k, parts});
}
export function bomb(dpx = Infinity) {
  const t = dpx >= BOMB.hero ? "hero" : dpx >= BOMB.mid ? "40" : "24", H = t === "hero", px = (n) => n / dpx, oy = BOMB.oy, ow = H ? BOMB.ol : px(2), parts = [];
  parts.push({k: "ell", x: 0, y: oy, rx: BOMB.rx + ow, ry: BOMB.ry + ow, rot: 0, col: P.bombOl}, {k: "ell", x: 0, y: oy, rx: BOMB.rx, ry: BOMB.ry, rot: 0, col: P.bomb});
  if (t !== "24") {
    const kr = H ? .035 : px(2), fr = H ? .05 : px(2);
    parts.push({k: "disc", x: -.10, y: -.12, r: .36, col: P.lobe, clip: "body"},
      {k: "rim", x: 0, y: oy, rx: BOMB.rx, ry: BOMB.ry, dx: kr * .9, dy: kr * .9, a0: rad(150), a1: rad(240), r: .8, col: P.steel, clip: "body"},
      {k: "rim", x: 0, y: oy, rx: BOMB.rx, ry: BOMB.ry, dx: -fr * .8, dy: -fr * .8, a0: rad(-5), a1: rad(95), r: .8, col: P.fillRim, clip: "body"});
  }
  parts.push({k: "ell", x: -.20, y: -.24, rx: Math.max(.10, px(1.5)), ry: Math.max(.06, px(1)), rot: rad(-35), col: P.white, a: .45, clip: "body"});
  if (t !== "24") parts.push({k: "disc", x: -.27, y: -.30, r: Math.max(.035, px(1)), col: P.spec, clip: "body"});
  const cw = H ? .08 : px(t === "40" ? 4 : 3), cross = (dx, dy) => [["M", -.14 + dx, .04 + dy], ["Q", dx, .08 + dy, .14 + dx, .04 + dy], ["M", dx, -.10 + dy], ["L", dx, .18 + dy]];
  if (H) parts.push({k: "line", d: cross(.015, .02), w: cw, col: P.bombOl, cap: "round"});
  parts.push({k: "line", d: cross(0, 0), w: cw, col: P.white, cap: "round"});
  const a = rad(BOMB.collar.deg), ux = Math.sin(a), uy = -Math.cos(a), tf = [ux * BOMB.collar.at, oy + uy * BOMB.collar.at, a];
  if (t === "24") parts.push({k: "rect", x: -.12 - ow, y: -.08 - ow, w: .24 + 2 * ow, h: .15 + 2 * ow, col: P.bombOl, tf}, {k: "rect", x: -.12, y: -.08, w: .24, h: .15, col: P.steel, tf});
  else {
    const co = H ? .03 : px(2);
    parts.push({k: "rrect", x: -.12 - co, y: -.07 - co, w: .24 + 2 * co, h: .14 + 2 * co, r: .04 + co, col: P.bombOl, tf}, {k: "ell", x: 0, y: -.07, rx: .12 + co, ry: .04 + co, rot: 0, col: P.bombOl, tf},
      {k: "rrect", x: -.12, y: -.07, w: .24, h: .14, r: .04, col: P.steel, tf}, {k: "ell", x: 0, y: -.07, rx: .12, ry: .04, rot: 0, col: P.steelHi, tf});
    if (H) {
      parts.push({k: "line", d: [["M", -.11, .015], ["L", .11, .015]], w: .02, col: P.steelDk, cap: "round", tf});
      for (const s of [-1, 1]) parts.push({k: "disc", x: s * .075, y: .035, r: .04, col: P.bombOl, tf}, {k: "disc", x: s * .075, y: .035, r: .03, col: P.steelHi, tf});
    }
  }
  return deep({tier: t, parts, tip: [ux * BOMB.collar.tip, oy + uy * BOMB.collar.tip]});
}
