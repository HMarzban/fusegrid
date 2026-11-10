/* LOGO B, CLASSIC 2D: the FUSE/GRID wordmark painted from glyphs.js and worlds.js alone. drawLogo2d(c, o) is the one entry (the title, the show's
   exit and MENU in every look): it walks plan(world, ...).layers once per cache key into a kit/cache.js layer and blits it; the spark is a live
   sprite (frame floor(t * 14) & 1, frozen on frame 0's reduced form under prefers-reduced-motion or REDUCE FLASH), drawn after the blit.
   No pixel is read and nothing is blurred: faces, bomb and the outline's growth are path fills and round-joined strokes; the side and the outline
   are swept by drawImage at whole device px; closings and VOID's rings dilate by a solid octagon of the same area as the mock's disc (segments in
   four directions, each by doubling at whole device px, smoothing off), an erosion the complement of the dilated complement; a closing runs on a
   padded canvas, cleared after it, and only the logo canvas's own rect of a mask is ever composited (nothing leaves the envelope). The world-independent masks (faces, side, outline, bomb,
   cord) are one "logo.mask" layer per build, version, cap and dpr, so a world change only re-tints; the spark frames are one "logo.spark" layer.
   o: {level, place "title" | "menu", dev "d" | "p" (the title's build), box {x, y, w, h} in the caller's units, cy (the title's centre line),
   k (box units per caller unit), dpr (device px per box unit, read before any transient transform), touch, t (page clock s), run (0..1, the
   intro run-up), reduced (REDUCE FLASH), spark (false: none), scale (a transient zoom about the logo's centre)}. The title's plate padding,
   ring and bed tile keep PLATE.title's proportions to its cap (the board canvas is no window). Returns the placement, or null when no canvas
   can be made (Node), counted in _dbg.ran either way. */
import {BD, BOMB, glyph, layout, cord, bomb, spark, sparkAt, fit} from "./glyphs.js";
import {PLATE, plan, plateBox, motif, worldOf} from "./worlds.js";
import {layer, capDpr} from "../kit/cache.js";
import {plate as kitPlate} from "../kit/paint.js";
import {worldTokens} from "../kit/tokens.js";

export const TITLE_LIT = true;
export const _dbg = {ran: 0, place: "", trace: [], last: null};
const TAU = 2 * Math.PI, N = 7, F0 = 0, F1 = 1, SIDE = 2, INK = 3, BOMBC = 4, CINK = 5, ROPE = 6, K0 = {look: "2d", textScale: 1};

let probeDoc = null, probeOK = false;
function canMake() {
  if (typeof OffscreenCanvas === "function") return true;
  const d = typeof document !== "undefined" ? document : null;
  if (!d || typeof d.createElement !== "function") return false;
  if (d !== probeDoc) { probeDoc = d; const el = d.createElement("canvas"); probeOK = !!el && typeof el.getContext === "function"; }
  return probeOK;
}
const mk = (w, h) => { if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(w, h); const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
export function reduceMotion() { const m = globalThis.matchMedia; if (typeof m !== "function") return false; try { return !!m("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }
export function deviceScale(c) { const m = c && typeof c.getTransform === "function" ? c.getTransform() : null; return m && typeof m.a === "number" && m.a > 0 ? Math.hypot(m.a, m.b || 0) : 1; }

function ops(c, d, x = 0, y = 0) {
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
function part(c, q) {
  c.save();
  if (q.tf) { c.translate(q.tf[0], q.tf[1]); c.rotate(q.tf[2]); }
  if (q.clip === "body") { c.beginPath(); c.ellipse(0, BOMB.oy, BOMB.rx, BOMB.ry, 0, 0, TAU); c.clip(); }
  if (q.a != null) c.globalAlpha *= q.a;
  c.fillStyle = c.strokeStyle = q.col;
  c.beginPath();
  if (q.k === "fill") { ops(c, q.d); if (q.ink > 0) { c.lineJoin = "round"; c.lineWidth = q.ink; c.strokeStyle = "#0b0609"; c.stroke(); } c.fill(); }
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
function word(c, L, w) { for (const l of L.letters) if (l.word === w) for (const d of glyph(l.ch).d) { c.beginPath(); ops(c, d, l.x, l.y); c.fill("evenodd"); } }
const body = (c, L) => { c.beginPath(); c.ellipse(L.bomb.x, L.bomb.y + BOMB.oy * BD, BOMB.rx * BD, BOMB.ry * BD, 0, 0, TAU); };
function grown(c, L, g) {
  c.lineJoin = "round"; c.lineWidth = 2 * g;
  for (const l of L.letters) for (const d of glyph(l.ch).d) { c.beginPath(); ops(c, d, l.x, l.y); c.fill("evenodd"); c.stroke(); }
  body(c, L); c.fill(); c.stroke();
}

function oct(r) {
  if (r <= 0.3) return [];
  const p = r * 0.9737, a = Math.round(p / 2.4142), b = Math.round(p / 3.4142);
  return [[1, 0, a], [0, 1, a], [1, 1, b], [1, -1, b]].filter((q) => q[2] > 0);
}
const fresh = (cv) => { const x = cv.getContext("2d"); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "source-over"; x.globalAlpha = 1; x.imageSmoothingEnabled = false; x.clearRect(0, 0, cv.width, cv.height); return x; };
function dil(dst, src, r, tmp) {
  let from = src, k = 0;
  const put = (o) => { const to = k++ & 1 ? tmp : dst, x = fresh(to); for (const [dx, dy] of o) x.drawImage(from, dx, dy); from = to; };
  for (const [ux, uy, h] of oct(r)) {
    put([[-h * ux, -h * uy], [(1 - h) * ux, (1 - h) * uy]]);
    for (let n = 2; n < 2 * h + 1;) { const st = Math.min(n, 2 * h + 1 - n); put([[0, 0], [st * ux, st * uy]]); n += st; }
  }
  if (from !== dst) fresh(dst).drawImage(from, 0, 0);
}
function inv(dst, src) { const x = fresh(dst); x.fillStyle = "#000"; x.fillRect(0, 0, dst.width, dst.height); x.globalCompositeOperation = "destination-out"; x.drawImage(src, 0, 0); x.globalCompositeOperation = "source-over"; }
function close(a, b, r, t) { dil(b, a, r, t); inv(a, b); dil(b, a, r, t); inv(a, b); }

function geo(o) {
  const w = worldOf(o.level | 0 || 1), title = o.place === "title", dev = o.dev === "p" ? "p" : "d", ti = PLATE.title[dev], k = o.k > 0 ? o.k : 1;
  const build = title ? ti.build : PLATE.menu.build, ver = title ? "full" : PLATE.menu.ver, L = layout(build), env = L.env, B = o.box;
  let capL;
  if (title) {
    const ex = (ti.pad[1] + ti.pad[3] + 2 * ti.T) / ti.cap, ey = (ti.pad[0] + ti.pad[2] + 2 * ti.T) / ti.cap;
    capL = fit(build, {fitW: ((B.w * k - 8) * env.w) / (env.w + ex) / k, fitH: ((B.h * k - 9) * env.h) / (env.h + ey) / k});
  } else capL = fit(build, {fitW: B.w - 4, fitH: B.h - 4, capMax: PLATE.menu.cap});
  const capB = capL * k, dprB = capDpr(o.dpr > 0 ? o.dpr : 1, !!o.touch), dprL = dprB * k, s = capB * dprB;
  const P = plan(w.name, {cap: capB, ver: title ? undefined : ver, dpr: dprB, build, dev, place: o.place});
  const G = {w, L, env, build, ver, dev, place: o.place, k, capL, capB, dprB, dprL, s, P, Wd: Math.ceil(env.w * s), Hd: Math.ceil(env.h * s)};
  if (title) {
    const kk = capB / ti.cap;
    G.T = ti.T * kk; G.tile = ti.tile * kk; G.pb = plateBox(build, capB, ti.pad.map((v) => v * kk));
    G.outer = {x: (G.pb.x - G.T - 2) / k, y: (G.pb.y - G.T - 2) / k, w: (G.pb.w + 2 * G.T + 4) / k, h: (G.pb.h + 2 * G.T + 5) / k};
  } else G.outer = {x: 0, y: 0, w: env.w * capL, h: env.h * capL};
  G.Wc = Math.ceil(G.outer.w * dprL); G.Hc = Math.ceil(G.outer.h * dprL);
  G.dxL = Math.round(-G.outer.x * dprL); G.dyL = Math.round(-G.outer.y * dprL);
  return G;
}
const keyOf = (G, kind, extra) => ({layer: "logo." + kind + "." + G.build + "." + extra + "." + G.capB.toFixed(2), ...K0});
const maskKey = (G) => ({...keyOf(G, "mask", G.ver), biome: "", level: 0, W: G.Wd, H: G.Hd * N, dpr: G.dprB});

function fillMask(x, cv, G) {
  const {L, env, s, Wd, Hd, P} = G, ox = -env.l * s, oy = -env.t * s, lay = (id) => P.layers.find((l) => l.id === id), pool = [];
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
  const cp = cord(G.build, P.tier, G.capB);
  cell(CINK, () => { for (const q of cp) if (q.layer === "cordInk") part(x, q); });
  const rp = work(Wd, Hd), rx = rp.getContext("2d");
  rx.setTransform(s, 0, 0, s, ox, oy);
  for (const q of cp) if (q.layer === "rope") { rx.globalCompositeOperation = q.clip === "rope" ? "source-atop" : "source-over"; part(rx, q); }
  cell(ROPE, () => { x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(rp, 0, ROPE * Hd); });
  for (const c of pool) c.width = c.height = 0;
}

function fillWorld(x, cv, G) {
  const A = layer(maskKey(G), G.Wd, G.Hd * N, (mx, mc) => fillMask(mx, mc, G));
  const {L, env, s, Wd, Hd, P, dxL, dyL} = G, ox = -env.l * s, oy = -env.t * s, pool = [], trace = (_dbg.trace = []);
  const cmax = Math.max(...P.layers.filter((l) => l.id === "outline").flatMap((l) => l.close)), pp = Math.ceil(cmax * s * 1.1) + 2, Wp = Wd + 2 * pp, Hp = Hd + 2 * pp;
  const work = () => { const c = mk(Wp, Hp); pool.push(c); fresh(c); return c; };
  const S1 = work(), S2 = work(), id = () => x.setTransform(1, 0, 0, 1, 0, 0), Tw = () => x.setTransform(s, 0, 0, s, dxL + ox, dyL + oy);
  const tint = (src, sx, sy, sw, sh, dx, dy, col) => {
    const t = fresh(S1);
    t.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
    t.globalCompositeOperation = "source-in"; t.fillStyle = col; t.fillRect(0, 0, sw, sh); t.globalCompositeOperation = "source-over";
    id(); x.drawImage(S1, 0, 0, sw, sh, dx, dy, sw, sh);
  };
  const cell = (i, col) => tint(A, 0, i * Hd, Wd, Hd, dxL, dyL, col);
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
      const m = work(), mx = m.getContext("2d"), l = P.layers.find((q) => q.id === "outline");
      mx.drawImage(A, 0, INK * Hd, Wd, Hd, pp, pp, Wd, Hd);
      for (const r of l.close.slice(1)) close(m, work(), r * s, work());
      if (l.close.length > 1) { mx.setTransform(1, 0, 0, 1, 0, 0); mx.clearRect(0, 0, Wp, pp); mx.clearRect(0, Hp - pp, Wp, pp); mx.clearRect(0, 0, pp, Hp); mx.clearRect(Wp - pp, 0, pp, Hp); }
      return (M[src] = m);
    }
    const l = P.layers.find((q) => q.id === src), m = work();
    dil(m, mask(l.src), l.grow * s, work());
    return (M[src] = m);
  };
  x.imageSmoothingEnabled = false;
  for (const l of P.layers) {
    trace.push(l.id);
    switch (l.id) {
      case "plate":
        x.setTransform(G.dprB, 0, 0, G.dprB, dxL, dyL);
        kitPlate(x, G.pb.x, G.pb.y, G.pb.w, G.pb.h, worldTokens(l.level), {phone: l.phone, T: G.T, tile: G.tile});
        break;
      case "ringOuter": case "ringInner": case "outline":
        tint(mask(l.id), pp, pp, Wd, Hd, dxL, dyL, l.col);
        break;
      case "side": cell(SIDE, l.col); break;
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
      case "face": cell(F0, l.col[0]); cell(F1, l.col[1]); break;
      case "shade": case "light": band(F0, l.shift[0] * s, l.shift[1] * s, l.col[0]); band(F1, l.shift[0] * s, l.shift[1] * s, l.col[1]); break;
      case "motif": {
        const parts = motif(G.w.name, G.build, P.tier, G.capB);
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
  _dbg.last.atlas = A;
  for (const c of pool) c.width = c.height = 0;
}

function fillSpark(x, cv, G, cell) {
  for (const [i, f, red] of [[0, 0, false], [1, 1, false], [2, 0, true]]) {
    x.setTransform(G.s, 0, 0, G.s, i * cell + cell / 2, cell / 2);
    for (const q of spark(f, {reduced: red, tier: G.P.tier, px: G.capB}).parts) part(x, q);
  }
}

export function drawLogo2d(c, o) {
  _dbg.ran++;
  _dbg.place = o.place;
  if (!canMake()) return null;
  const G = geo(o), B = o.box, O = G.outer;
  const ox = B.x + (B.w - O.w) / 2, oy = o.cy != null ? Math.max(B.y + 2, Math.min(B.y + B.h - O.h - 2, o.cy - O.h / 2)) : B.y + (B.h - O.h) / 2;
  const wk = {...keyOf(G, o.place, G.dev), biome: G.w.name, level: G.w.level, W: G.Wc, H: G.Hc, dpr: G.dprL};
  const sk = G.P.layers.some((l) => l.id === "spark") && o.spark !== false, k1 = spark(0, {tier: G.P.tier, px: G.capB}).k, cell = 2 * Math.ceil(0.25 * k1 * G.s + 2);
  _dbg.last = {spark: null};
  const world = layer(wk, G.Wc, G.Hc, (x, cv) => fillWorld(x, cv, G));
  const sp = sk ? layer({...keyOf(G, "spark", G.P.tier), biome: "", level: 0, W: 3 * cell, H: cell, dpr: G.dprB}, 3 * cell, cell, (x, cv) => fillSpark(x, cv, G, cell)) : null;
  _dbg.last.world = world; _dbg.last.spark = sp;
  const sc = o.scale > 0 ? o.scale : 1, m = sc === 1 && typeof c.getTransform === "function" ? c.getTransform() : null;
  const ok = !!m && m.b === 0 && m.c === 0 && m.a > 0 && m.d > 0, snx = (v) => (ok ? (Math.round(m.a * v + m.e) - m.e) / m.a : v), sny = (v) => (ok ? (Math.round(m.d * v + m.f) - m.f) / m.d : v);
  const x0 = snx(ox), y0 = sny(oy), lx = x0 + G.dxL / G.dprL, ly = y0 + G.dyL / G.dprL, red = !!o.reduced || reduceMotion();
  c.save();
  if (sc !== 1) { const cx = ox + O.w / 2, cy = oy + O.h / 2; c.translate(cx, cy); c.scale(sc, sc); c.translate(-cx, -cy); }
  c.imageSmoothingEnabled = true;
  c.drawImage(world, x0, y0, G.Wc / G.dprL, G.Hc / G.dprL);
  let at = null;
  if (sp) {
    const p = sparkAt(G.build, G.P.tier, red ? undefined : o.run), h = cell / 2 / G.dprL, f = red ? 2 : Math.floor((o.t || 0) * 14) & 1;
    at = {x: snx(lx + (p.x - G.env.l) * G.capL), y: sny(ly + (p.y - G.env.t) * G.capL), frame: f};
    c.drawImage(sp, f * cell, 0, cell, cell, at.x - h, at.y - h, 2 * h, 2 * h);
  }
  c.restore();
  return {cap: G.capB, capL: G.capL, tier: G.P.tier, build: G.build, ver: G.ver, dev: G.dev, place: G.place, dpr: G.dprB, x: x0, y: y0, w: G.Wc / G.dprL, h: G.Hc / G.dprL, lx, ly, spark: at};
}
