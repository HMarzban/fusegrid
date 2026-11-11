/* LOGO B, CLASSIC 2D: the FUSE/GRID wordmark painted from glyphs.js and worlds.js alone. drawLogo2d(c, o) is the one entry (the title and MENU in
   every look): it walks plan(world, ...).layers once per cache key into a kit/cache.js layer and blits it; the spark is a live sprite (frame
   floor(t x SPARK.hz) & 1, frozen on frame 0's reduced form under prefers-reduced-motion or REDUCE FLASH), drawn after the blit. The title is
   plan()'s fitted placement (worlds.js titleFit: the mock's plate scaled as one piece into the box the caller has, tier title), MENU the cream line
   build at PLATE.menu.cap x k. No pixel is read and nothing is blurred: faces, bomb and the outline's growth are path fills and round-joined strokes;
   the side and the outline are swept by drawImage at whole device px; closings and VOID's rings dilate by a solid octagon of the same area as the
   mock's disc (segments in four directions, each by doubling at whole device px, smoothing off), an erosion the complement of the dilated
   complement; a closing runs on a padded canvas, cleared after it, and only the logo canvas's own rect of a mask is ever composited. The
   world-independent masks (faces, side, outline, bomb, cord) are one "logo.mask" layer per build, version, cap and dpr, so a world change only
   re-tints; the spark frames (A, B, reduced) are one "logo.spark" layer whose cell is the spark parts' own reach. A steady frame is the memo check,
   one getTransform, two blits: the placement, plan and both layer canvases are kept per place until an input changes or the cache frees a canvas
   (it shrinks a freed one to 0x0, so a 0-wide held canvas is asked for again, never drawn); a steady frame touch()es the world and spark
   layers it blits, so the cache's LRU never takes the logo on screen before a stale layer. o: {level, place "title" | "menu", dev "d" | "p" (the
   title's build), box {x, y, w, h} in the caller's units, cy (the title's centre line), k (box units per caller unit), dpr (device px per box unit,
   read before any transient transform), css (CSS px per box unit, 1 when the caller does not know it), touch, t (page clock s), run (0..1: the
   run-up along the cord, which nothing asks for today; TITLE_RUNUP says whether the title's exit runs it), reduced (REDUCE FLASH), spark (false:
   none), scale (a transient zoom about the logo's centre)}. EDGE caller units stay free on every side of the box for the layer's whole device px
   and the blit's snap. Returns the placement (reused per place, its look named), or null when no canvas can be made (Node). _dbg records only
   while _dbg.on; _seam.plan is the plan the painter calls (a test spies on it).
   Looks (Task 7.3): this is the one entry for every look. setLogoLook(kind) is the look on screen (shellview, once a frame); registerLogo(kind, f)
   is called by each lazy tree when it loads (PIXEL pixel/logo.js, REAL 3D logo/draw3d.js). Until the look's tree is in, the CLASSIC build paints,
   so the swap is the next frame and never a blank one. f(G, o) changes only what its look draws: the world layer fill (fw), the spark sprite
   (fs, cell, sw, half), the spark's tip, the face colours and grow (the extent its art needs round the logo canvas, centred, when that is more
   than CLASSIC's: the layer grows, G.room is what the caller's box allows); placement, plate, memo, cache, snapping and the spark clock stay here. The look and
   a registry epoch are in the memo, and the look (with that epoch for a lazy look) in every layer key, so a kind that registers again never
   blits the layer its last painter made. */
import {P, BD, BOMB, SPARK, glyph, layout, cord, bomb, spark, sparkAt, fit, flat} from "./glyphs.js";
import {PLATE, plan, motif, worldOf} from "./worlds.js";
import {layer, capDpr, touch, keyOf, canMake} from "../kit/cache.js";
import {plate as kitPlate} from "../kit/paint.js";
import {worldTokens} from "../kit/tokens.js";
import * as kp from "../kit/probe.js";

export const TITLE_RUNUP = false;
export const _dbg = {on: false, ran: 0, place: "", run: undefined, last: null};
export const _seam = {plan};
const TAU = 2 * Math.PI, N = 7, F0 = 0, F1 = 1, SIDE = 2, INK = 3, BOMBC = 4, CINK = 5, ROPE = 6, EDGE = 2, K0 = {look: "2d", textScale: 1};

export const mk = (w, h) => { if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(w, h); const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
let mqf = null, mql = null;
export function reduceMotion() {
  const m = globalThis.matchMedia;
  if (typeof m !== "function") return false;
  if (m !== mqf) { mqf = m; try { mql = m("(prefers-reduced-motion: reduce)"); } catch (e) { mql = null; } }
  return !!(mql && mql.matches);
}
export function deviceScale(c) { const m = c && typeof c.getTransform === "function" ? c.getTransform() : null; return m && typeof m.a === "number" && m.a > 0 ? Math.hypot(m.a, m.b || 0) : 1; }

export function ops(c, d, x = 0, y = 0) {
  for (const o of d) {
    const k = o[0];
    if (k === "M") c.moveTo(o[1] + x, o[2] + y);
    else if (k === "L") c.lineTo(o[1] + x, o[2] + y);
    else if (k === "Q") c.quadraticCurveTo(o[1] + x, o[2] + y, o[3] + x, o[4] + y);
    else if (k === "C") c.bezierCurveTo(o[1] + x, o[2] + y, o[3] + x, o[4] + y, o[5] + x, o[6] + y);
    else if (k === "A") c.arc(o[1] + x, o[2] + y, o[3], o[4], o[5], o[6]);
    else if (k === "Z") c.closePath();
  }
}
const rr = (c, x, y, w, h, r) => { c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
export function part(c, q) {
  c.save();
  if (q.tf) { c.translate(q.tf[0], q.tf[1]); c.rotate(q.tf[2]); }
  if (q.clip === "body") { c.beginPath(); c.ellipse(0, BOMB.oy, BOMB.rx, BOMB.ry, 0, 0, TAU); c.clip(); }
  if (q.a != null) c.globalAlpha *= q.a;
  c.fillStyle = c.strokeStyle = q.col;
  c.beginPath();
  if (q.k === "fill") { ops(c, q.d); if (q.ink > 0) { c.lineJoin = "round"; c.lineWidth = q.ink; c.strokeStyle = P.ol; c.stroke(); } c.fill(); }
  else if (q.k === "line") { ops(c, q.d); c.lineWidth = q.w; c.lineCap = q.cap || "butt"; c.lineJoin = q.join || "round"; c.stroke(); }
  else if (q.k === "tube") { c.lineCap = q.cap || "butt"; c.lineJoin = "round"; for (let i = 1; i < q.d.length; i++) { c.beginPath(); c.moveTo(q.d[i - 1][1], q.d[i - 1][2]); c.lineTo(q.d[i][1], q.d[i][2]); c.lineWidth = q.w[i - 1]; c.stroke(); } }
  else if (q.k === "disc") { c.arc(q.x, q.y, q.r, 0, TAU); c.fill(); }
  else if (q.k === "ring") { c.arc(q.x, q.y, q.r, 0, TAU); c.lineWidth = q.w; c.stroke(); }
  else if (q.k === "rect") c.fillRect(q.x, q.y, q.w, q.h);
  else if (q.k === "ell") { c.ellipse(q.x, q.y, q.rx, q.ry, q.rot, 0, TAU); c.fill(); }
  else if (q.k === "rrect") { rr(c, q.x, q.y, q.w, q.h, q.r); c.fill(); }
  else if (q.k === "rim") { c.moveTo(q.x, q.y); c.arc(q.x, q.y, q.r, q.a0, q.a1); c.closePath(); c.clip(); c.beginPath(); c.ellipse(q.x, q.y, q.rx, q.ry, 0, 0, TAU); c.ellipse(q.x + q.dx, q.y + q.dy, q.rx, q.ry, 0, 0, TAU); c.fill("evenodd"); }
  c.restore();
}
/* how far a centred part reaches from its origin (the spark's parts: rays with their ink, embers, core) */
const reach = (q) => q.k === "disc" ? Math.hypot(q.x, q.y) + q.r
  : q.k === "rect" ? Math.max(...[[q.x, q.y], [q.x + q.w, q.y], [q.x, q.y + q.h], [q.x + q.w, q.y + q.h]].map(([a, b]) => Math.hypot(a, b)))
  : Math.max(...flat(q.d).flatMap((s) => s.pts.map(([a, b]) => Math.hypot(a, b)))) + (q.k === "line" ? q.w / 2 : 0);
export function word(c, L, w) { for (const l of L.letters) if (l.word === w) for (const d of glyph(l.ch).d) { c.beginPath(); ops(c, d, l.x, l.y); c.fill("evenodd"); } }
export const body = (c, L) => { c.beginPath(); c.ellipse(L.bomb.x, L.bomb.y + BOMB.oy * BD, BOMB.rx * BD, BOMB.ry * BD, 0, 0, TAU); };
export function grown(c, L, g) {
  c.lineJoin = "round"; c.lineWidth = 2 * g;
  for (const l of L.letters) for (const d of glyph(l.ch).d) { c.beginPath(); ops(c, d, l.x, l.y); c.fill("evenodd"); c.stroke(); }
  body(c, L); c.fill(); c.stroke();
}

function oct(r) {
  if (r <= 0.3) return [];
  const p = r * 0.9737, a = Math.round(p / 2.4142), b = Math.round(p / 3.4142);
  return [[1, 0, a], [0, 1, a], [1, 1, b], [1, -1, b]].filter((q) => q[2] > 0);
}
export const fresh = (cv) => { const x = cv.getContext("2d"); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "source-over"; x.globalAlpha = 1; x.imageSmoothingEnabled = false; x.clearRect(0, 0, cv.width, cv.height); return x; };
export function dil(dst, src, r, tmp) {
  let from = src, k = 0;
  const put = (o) => { const to = k++ & 1 ? tmp : dst, x = fresh(to); for (const [dx, dy] of o) x.drawImage(from, dx, dy); from = to; };
  for (const [ux, uy, h] of oct(r)) {
    put([[-h * ux, -h * uy], [(1 - h) * ux, (1 - h) * uy]]);
    for (let n = 2; n < 2 * h + 1;) { const st = Math.min(n, 2 * h + 1 - n); put([[0, 0], [st * ux, st * uy]]); n += st; }
  }
  if (from !== dst) fresh(dst).drawImage(from, 0, 0);
}
function inv(dst, src) { const x = fresh(dst); x.fillStyle = "#000"; x.fillRect(0, 0, dst.width, dst.height); x.globalCompositeOperation = "destination-out"; x.drawImage(src, 0, 0); x.globalCompositeOperation = "source-over"; }
export function close(a, b, r, t) { dil(b, a, r, t); inv(a, b); dil(b, a, r, t); inv(a, b); }

const lev = (o) => o.level | 0 || 1;
const LOOKS = {}, ST = {look: "2d", ep: 0}, PEND = [];
export const setLogoLook = (k) => { ST.look = k; };
export function registerLogo(k, L) { LOOKS[k] = L; ST.ep++; }
export const logoLook = () => (ST.look !== "2d" && LOOKS[ST.look] ? ST.look : "2d");
const same = (G, o, lk) => !!G && G.in.lk === lk && G.in.ep === ST.ep && G.in.level === lev(o) && G.in.dev === o.dev && G.in.k === o.k && G.in.dpr === o.dpr && G.in.css === o.css && G.in.touch === !!o.touch && G.in.cy === o.cy
  && G.in.bx === o.box.x && G.in.by === o.box.y && G.in.bw === o.box.w && G.in.bh === o.box.h;
function geo(o, lk) {
  const w = worldOf(lev(o)), title = o.place === "title", dev = o.dev === "p" ? "p" : "d", k = o.k > 0 ? o.k : 1, css = o.css > 0 ? o.css : 1, B = o.box;
  const dprB = capDpr(o.dpr > 0 ? o.dpr : 1, !!o.touch), dprL = dprB * k, bw = (B.w - 2 * EDGE) * k, bh = (B.h - 2 * EDGE) * k;
  const capM = title ? 0 : fit(PLATE.menu.build, {fitW: bw, fitH: bh, capMax: PLATE.menu.cap * k});
  const Pl = title ? _seam.plan(w.name, {fit: {w: bw, h: bh}, dev, dpr: dprB, css}) : _seam.plan(w.name, {cap: capM, ver: PLATE.menu.ver, dpr: dprB, css, build: PLATE.menu.build, dev, place: "menu"});
  const L = layout(Pl.build), env = L.env, capB = Pl.cap, capL = capB / k, s = capB * dprB, px = capB * css, tier = Pl.tier, pl = Pl.layers.find((l) => l.id === "plate");
  const G = {in: {lk, ep: ST.ep, level: lev(o), dev: o.dev, k: o.k, dpr: o.dpr, css: o.css, touch: !!o.touch, cy: o.cy, bx: B.x, by: B.y, bw: B.w, bh: B.h},
    w, L, env, build: Pl.build, ver: title ? "full" : PLATE.menu.ver, dev, place: o.place, k, capL, capB, px, dprB, dprL, s, P: Pl, Wd: Math.ceil(env.w * s), Hd: Math.ceil(env.h * s)};
  G.outer = pl ? {x: pl.outer.x / k, y: pl.outer.y / k, w: pl.outer.w / k, h: pl.outer.h / k} : {x: 0, y: 0, w: env.w * capL, h: env.h * capL};
  const put = () => {
    G.Wc = Math.ceil(G.outer.w * dprL); G.Hc = Math.ceil(G.outer.h * dprL);
    G.dxL = Math.round(-G.outer.x * dprL); G.dyL = Math.round(-G.outer.y * dprL);
    G.ox = B.x + (B.w - G.outer.w) / 2;
    G.oy = o.cy != null ? Math.max(B.y + EDGE, Math.min(B.y + B.h - G.outer.h - EDGE, o.cy - G.outer.h / 2)) : B.y + (B.h - G.outer.h) / 2;
  };
  put();
  G.room = {w: B.w - 2 * EDGE, h: B.h - 2 * EDGE};
  G.hasSpark = Pl.layers.some((l) => l.id === "spark");
  G.sparks = [[0, false], [1, false], [0, true]].map(([f, red]) => spark(f, {reduced: red, tier, px}));
  G.cell = 2 * Math.ceil(Math.max(...G.sparks.flatMap((sp) => sp.parts.map(reach))) * s + 1);
  G.tip = sparkAt(G.build, tier);
  const name = "." + G.build + "." + G.ver + "." + capB.toFixed(2) + "." + css;
  const K = {...K0, look: lk === "2d" ? lk : lk + "#" + ST.ep};
  G.lk = lk; G.fw = fillWorld; G.fs = fillSpark; G.sw = 3 * G.cell; G.face = (Pl.layers.find((l) => l.id === "face") || {col: [P.yel, P.cor]}).col;
  G.mk = {layer: "logo.mask" + name, biome: "", level: 0, W: G.Wd, H: G.Hd * N, dpr: dprB, ...K0};
  G.wk = {layer: "logo." + o.place + "." + dev + name, biome: w.name, level: w.level, W: G.Wc, H: G.Hc, dpr: dprL, ...K};
  if (lk !== "2d") LOOKS[lk](G, o);
  if (G.grow) {
    const gx = Math.max(0, G.grow.w - G.outer.w) / 2, gy = Math.max(0, G.grow.h - G.outer.h) / 2;
    G.outer = {x: G.outer.x - gx, y: G.outer.y - gy, w: G.outer.w + 2 * gx, h: G.outer.h + 2 * gy};
    put(); G.wk.W = G.Wc; G.wk.H = G.Hc;
  }
  G.half = G.half || G.cell / 2 / dprL;
  G.sk = {layer: "logo.spark." + tier + name, biome: "", level: 0, W: G.sw, H: G.cell, dpr: dprB, ...K};
  G.wkS = keyOf(G.wk); G.skS = keyOf(G.sk);
  G.out = {look: lk, cap: capB, capL, tier, build: G.build, ver: G.ver, dev, place: o.place, dpr: dprB, css, cell: G.cell, w: G.Wc / dprL, h: G.Hc / dprL, x: 0, y: 0, lx: 0, ly: 0, spark: null};
  G.world = G.sprite = null;
  return G;
}

function fillMask(x, G) {
  const {L, env, s, Wd, Hd, P: Pl} = G, ox = -env.l * s, oy = -env.t * s, lay = (id) => Pl.layers.find((l) => l.id === id), pool = [];
  const work = (w, h) => { const c = mk(w, h); pool.push(c); fresh(c); return c; };
  const cell = (i, f) => { x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.beginPath(); x.rect(0, i * Hd, Wd, Hd); x.clip(); x.setTransform(s, 0, 0, s, ox, oy + i * Hd); x.fillStyle = "#000"; f(); x.restore(); };
  x.imageSmoothingEnabled = false;
  cell(F0, () => word(x, L, 0));
  cell(F1, () => word(x, L, 1));
  const sol = work(Wd, Hd), sx = sol.getContext("2d"), e = lay("side").sweep * s;
  sx.setTransform(s, 0, 0, s, ox, oy); sx.fillStyle = "#000"; word(sx, L, 0); word(sx, L, 1); body(sx, L); sx.fill();
  cell(SIDE, () => { x.setTransform(1, 0, 0, 1, 0, SIDE * Hd); x.imageSmoothingEnabled = true; for (let i = 0; i <= Math.ceil(e); i++) x.drawImage(sol, 0, Math.min(i, e)); x.imageSmoothingEnabled = false; });
  const ol = lay("outline"), pp = Math.ceil(ol.close[0] * s * 1.1) + 2, a = work(Wd + 2 * pp, Hd + 2 * pp), b = work(Wd + 2 * pp, Hd + 2 * pp), ax = a.getContext("2d");
  ax.setTransform(s, 0, 0, s, ox + pp, oy + pp); ax.fillStyle = ax.strokeStyle = "#000"; grown(ax, L, ol.grow);
  const bx = fresh(b);
  for (let i = 0; i <= Math.round(e); i++) bx.drawImage(a, 0, i);
  close(b, a, ol.close[0] * s, work(Wd + 2 * pp, Hd + 2 * pp));
  cell(INK, () => { x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(b, pp, pp, Wd, Hd, 0, INK * Hd, Wd, Hd); });
  cell(BOMBC, () => { x.setTransform(s * BD, 0, 0, s * BD, ox + L.bomb.x * s, oy + BOMBC * Hd + L.bomb.y * s); for (const q of bomb(lay("bomb").dpx).parts) part(x, q); });
  const cp = cord(G.build, Pl.tier, G.px);
  cell(CINK, () => { for (const q of cp) if (q.layer === "cordInk") part(x, q); });
  const rp = work(Wd, Hd), rx = rp.getContext("2d");
  rx.setTransform(s, 0, 0, s, ox, oy);
  for (const q of cp) if (q.layer === "rope") { rx.globalCompositeOperation = q.clip === "rope" ? "source-atop" : "source-over"; part(rx, q); }
  cell(ROPE, () => { x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(rp, 0, ROPE * Hd); });
  for (const c of pool) c.width = c.height = 0;
}

function fillWorld(x, G) {
  const A = layer(G.mk, G.Wd, G.Hd * N, (mx) => fillMask(mx, G));
  const {L, env, s, Wd, Hd, P: Pl, dxL, dyL} = G, ox = -env.l * s, oy = -env.t * s, pool = [];
  const cmax = Math.max(...Pl.layers.filter((l) => l.id === "outline").flatMap((l) => l.close)), pp = Math.ceil(cmax * s * 1.1) + 2, Wp = Wd + 2 * pp, Hp = Hd + 2 * pp;
  const work = () => { const c = mk(Wp, Hp); pool.push(c); fresh(c); return c; };
  const S1 = work(), S2 = work(), id = () => x.setTransform(1, 0, 0, 1, 0, 0), Tw = () => x.setTransform(s, 0, 0, s, dxL + ox, dyL + oy);
  const tint = (src, sx, sy, col) => {
    const t = fresh(S1);
    t.drawImage(src, sx, sy, Wd, Hd, 0, 0, Wd, Hd);
    t.globalCompositeOperation = "source-in"; t.fillStyle = col; t.fillRect(0, 0, Wd, Hd); t.globalCompositeOperation = "source-over";
    id(); x.drawImage(S1, 0, 0, Wd, Hd, dxL, dyL, Wd, Hd);
  };
  const blit = (i) => { id(); x.drawImage(A, 0, i * Hd, Wd, Hd, dxL, dyL, Wd, Hd); };
  const band = (i, dx, dy, col) => {
    const t = fresh(S1);
    t.drawImage(A, 0, i * Hd, Wd, Hd, 0, 0, Wd, Hd);
    t.globalCompositeOperation = "destination-out"; t.imageSmoothingEnabled = true; t.drawImage(A, 0, i * Hd, Wd, Hd, dx, dy, Wd, Hd); t.imageSmoothingEnabled = false;
    t.globalCompositeOperation = "source-in"; t.fillStyle = col; t.fillRect(0, 0, Wd, Hd); t.globalCompositeOperation = "source-over";
    id(); x.drawImage(S1, 0, 0, Wd, Hd, dxL, dyL, Wd, Hd);
  };
  const M = {};
  const mask = (src) => {
    if (M[src]) return M[src];
    if (src === "outline") {
      const m = work(), mx = m.getContext("2d"), l = Pl.layers.find((q) => q.id === "outline");
      mx.drawImage(A, 0, INK * Hd, Wd, Hd, pp, pp, Wd, Hd);
      for (const r of l.close.slice(1)) close(m, work(), r * s, work());
      if (l.close.length > 1) { mx.setTransform(1, 0, 0, 1, 0, 0); mx.clearRect(0, 0, Wp, pp); mx.clearRect(0, Hp - pp, Wp, pp); mx.clearRect(0, 0, pp, Hp); mx.clearRect(Wp - pp, 0, pp, Hp); }
      return (M[src] = m);
    }
    const l = Pl.layers.find((q) => q.id === src), m = work();
    dil(m, mask(l.src), l.grow * s, work());
    return (M[src] = m);
  };
  x.imageSmoothingEnabled = false;
  for (const l of Pl.layers) {
    switch (l.id) {
      case "plate": paintPlate(x, G); break;
      case "ringOuter": case "ringInner": case "outline": tint(mask(l.id), pp, pp, l.col); break;
      case "side": tint(A, 0, SIDE * Hd, l.col); break;
      case "gilt": {
        const t = fresh(S1);
        t.drawImage(A, 0, SIDE * Hd, Wd, Hd, 0, 0, Wd, Hd);
        t.globalCompositeOperation = "destination-out"; t.imageSmoothingEnabled = true; t.drawImage(A, 0, SIDE * Hd, Wd, Hd, 0, -l.band * s, Wd, Hd); t.imageSmoothingEnabled = false;
        t.drawImage(A, 0, F0 * Hd, Wd, Hd, 0, 0, Wd, Hd); t.drawImage(A, 0, F1 * Hd, Wd, Hd, 0, 0, Wd, Hd);
        t.setTransform(s, 0, 0, s, ox, oy); t.fillStyle = "#000"; body(t, L); t.fill(); t.setTransform(1, 0, 0, 1, 0, 0);
        t.globalCompositeOperation = "source-in"; t.fillStyle = l.col; t.fillRect(0, 0, Wd, Hd); t.globalCompositeOperation = "source-over";
        id(); x.drawImage(S1, 0, 0, Wd, Hd, dxL, dyL, Wd, Hd);
        break;
      }
      case "giltInk": Tw(); x.fillStyle = x.strokeStyle = l.col; grown(x, L, l.grow); break;
      case "face": tint(A, 0, F0 * Hd, l.col[0]); tint(A, 0, F1 * Hd, l.col[1]); break;
      case "shade": case "light": band(F0, l.shift[0] * s, l.shift[1] * s, l.col[0]); band(F1, l.shift[0] * s, l.shift[1] * s, l.col[1]); break;
      case "motif": {
        const parts = motif(G.w.name, G.build, Pl.tier, G.px);
        for (let i = 0; i < parts.length;) {
          if (parts[i].clip !== "face") { Tw(); part(x, parts[i++]); continue; }
          const t = fresh(S1), u = fresh(S2);
          t.setTransform(s, 0, 0, s, ox, oy);
          while (i < parts.length && parts[i].clip === "face") part(t, parts[i++]);
          u.drawImage(A, 0, F0 * Hd, Wd, Hd, 0, 0, Wd, Hd); u.drawImage(A, 0, F1 * Hd, Wd, Hd, 0, 0, Wd, Hd);
          t.setTransform(1, 0, 0, 1, 0, 0); t.globalCompositeOperation = "destination-in"; t.drawImage(S2, 0, 0); t.globalCompositeOperation = "source-over";
          id(); x.drawImage(S1, 0, 0, Wd, Hd, dxL, dyL, Wd, Hd);
        }
        break;
      }
      case "bomb": blit(BOMBC); break;
      case "cordInk": blit(CINK); break;
      case "rope": blit(ROPE); break;
    }
  }
  if (_dbg.on) G.atlas = A;
  for (const c of pool) c.width = c.height = 0;
}

/* the kit plate a title sits on (plan's plate layer), into a world layer at its origin: every look's */
export function paintPlate(x, G) {
  const l = G.P.layers.find((q) => q.id === "plate");
  if (!l) return;
  x.setTransform(G.dprB, 0, 0, G.dprB, G.dxL, G.dyL);
  kitPlate(x, l.box.x, l.box.y, l.box.w, l.box.h, worldTokens(l.level), {phone: l.phone, T: l.T, tile: l.tile});
}
function fillSpark(x, G) {
  G.sparks.forEach((sp, i) => {
    x.setTransform(G.s, 0, 0, G.s, i * G.cell + G.cell / 2, G.cell / 2);
    for (const q of sp.parts) part(x, q);
  });
}

const MEMO = {title: null, menu: null};
export function drawLogo2d(c, o) {
  if (_dbg.on) { _dbg.ran++; _dbg.place = o.place; _dbg.run = o.run; }
  if (!canMake()) return null;
  const lk = logoLook();
  let G = MEMO[o.place];
  if (!same(G, o, lk)) G = MEMO[o.place] = geo(o, lk);
  if (!G.world || !G.world.width) G.world = layer(G.wk, G.Wc, G.Hc, (x) => G.fw(x, G));
  else touch(G.wkS);
  const sk = G.hasSpark && o.spark !== false;
  if (sk && (!G.sprite || !G.sprite.width)) G.sprite = layer(G.sk, G.sw, G.cell, (x) => G.fs(x, G));
  else if (sk) touch(G.skS);
  if (_dbg.on) _dbg.last = {world: G.world, spark: sk ? G.sprite : null, atlas: G.atlas};
  const sc = o.scale > 0 ? o.scale : 1, m = sc === 1 && typeof c.getTransform === "function" ? c.getTransform() : null;
  const ok = !!m && m.b === 0 && m.c === 0 && m.a > 0 && m.d > 0, snx = (v) => (ok ? (Math.round(m.a * v + m.e) - m.e) / m.a : v), sny = (v) => (ok ? (Math.round(m.d * v + m.f) - m.f) / m.d : v);
  const R = G.out, O = G.outer;
  R.x = snx(G.ox); R.y = sny(G.oy); R.lx = R.x + G.dxL / G.dprL; R.ly = R.y + G.dyL / G.dprL;
  c.save();
  if (sc !== 1) { const cx = G.ox + O.w / 2, cy = G.oy + O.h / 2; c.translate(cx, cy); c.scale(sc, sc); c.translate(-cx, -cy); }
  c.imageSmoothingEnabled = true;
  c.drawImage(G.world, R.x, R.y, R.w, R.h);
  R.spark = null;
  if (sk) {
    const red = !!o.reduced || reduceMotion(), p = !red && !G.noRun && o.run != null && o.run < 1 ? sparkAt(G.build, R.tier, o.run) : G.tip, h = G.half, f = red ? 2 : Math.floor((o.t || 0) * SPARK.hz) & 1;
    const sx = snx(R.lx + (p.x - G.env.l) * G.capL), sy = sny(R.ly + (p.y - G.env.t) * G.capL);
    R.spark = G.at || (G.at = {x: 0, y: 0, frame: 0});
    R.spark.x = sx; R.spark.y = sy; R.spark.frame = f;
    c.drawImage(G.sprite, f * G.cell, 0, G.cell, G.cell, sx - h, sy - h, 2 * h, 2 * h);
  }
  if (kp.probe.on) note(c, o, G, R);
  c.restore();
  return R;
}
/* Under the kit probe (shots.mjs only) the logo says what it drew, for the Chrome face gate: which look painted, the title's plate, each word's
   face (a rect with its fill, so the yellow gate counts FUSE) and that face against a strip of bare bed (the title plate's left pad; above U..S in
   the MENU header), lock floor 3:1 (appendix 8.8 L1). It is held until logoProbe(), which shellview calls after the page (MENU's page record
   begins after the logo paints); a caller that never flushes holds at most 8. Box px. */
function note(c, o, G, R) {
  const m = c.getTransform(), d = o.dpr > 0 ? o.dpr : 1, E = G.env, k = G.capL, L = G.L, bx = (x, y, w, h) => [(m.a * x + m.e) / d, (m.d * y + m.f) / d, (m.a * w) / d, (m.d * h) / d];
  const C = (x0, y0, x1, y1) => bx(R.lx + (x0 - E.l) * k, R.ly + (y0 - E.t) * k, (x1 - x0) * k, (y1 - y0) * k), at = (ch) => L.letters.find((l) => l.ch === ch);
  const F = at("F"), I = at("I"), pl = G.P.layers.find((l) => l.id === "plate"), b = pl ? [pl.box.x / G.k, pl.box.y / G.k, pl.box.w / G.k, pl.box.h / G.k] : null;
  const bed = pl ? bx(R.lx + b[0] * .8, R.ly + (F.y + .2 - E.t) * k, -b[0] * .6, .6 * k) : C(.7, -.38, 2, -.17);
  if (PEND.length > 7) PEND.length = 0;
  PEND.push({look: G.lk, logo: bx(R.lx, R.ly, E.w * k, E.h * k), plate: pl && bx(R.lx + b[0], R.ly + b[1], b[2], b[3]), T: pl && (pl.T / G.k) * (m.a / d), bed,
    faces: [[C(F.x + .04, F.y + .3, F.x + .22, F.y + .9), G.face[0], "FUSE"], [C(I.x + .04, I.y + .12, I.x + .24, I.y + .88), G.face[1], "GRID"]]});
}
export function logoProbe() {
  if (kp.probe.on && kp.probe.page) for (const e of PEND) {
    kp.rect("logo " + e.look, ...e.logo);
    if (e.plate) kp.rect("logo plate", ...e.plate, {plate: e.T});
    for (const [a, col, n] of e.faces) { kp.rect("logo " + n, ...a, {fill: col}); kp.pair("info", a, e.bed, {col, lock: true, name: "logo " + n + " face"}); }
  }
  PEND.length = 0;
}
