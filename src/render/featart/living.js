/* TILE ART direction D, living ground (from option B "TERRAIN"): the biome's own floor changed, no frame. Light top-left; STREAM rotates itself and takes its light vector from dir, so bevels stay top-left at every dir. Painters are (c, k) (see featdraw kOf). */
import { mix, hsh, rgb, floorTile } from "./kit.js";
import { GEO } from "./geo.js";
const PI = Math.PI, T2 = PI * 2;
const LV = [[1, 1], [1, -1], [-1, -1], [-1, 1]], BS = [["W", "E"], ["N", "S"], ["E", "W"], ["S", "N"]];
const rg = (h, a) => { const q = rgb(h); return "rgba(" + q[0] + "," + q[1] + "," + q[2] + "," + a + ")"; };
const K0 = (a) => "rgba(0,0,0," + a + ")", W0 = (a) => "rgba(255,255,255," + a + ")";
const P2 = (p, cl = 1) => { const q = new Path2D(); p.forEach((v, i) => i ? q.lineTo(v[0], v[1]) : q.moveTo(v[0], v[1])); if (cl) q.closePath(); return q; };
const lin = (c, x0, y0, x1, y1, st) => { const g = c.createLinearGradient(x0, y0, x1, y1); st.forEach((s) => g.addColorStop(s[0], s[1])); return g; };
const rad = (c, x, y, r, st) => { const g = c.createRadialGradient(x, y, 0, x, y, r); st.forEach((s) => g.addColorStop(s[0], s[1])); return g; };
const wrap = (c, f) => { [-40, 0, 40].forEach((dx) => { c.save(); c.translate(dx, 0); f(dx); c.restore(); }); };
const bevP = (c, P, d, tl, br, lv) => {
  const [lx, ly] = lv || [1, 1];
  c.save(); c.clip(P);
  if (tl) { const q = new Path2D(); q.rect(-60, -60, 160, 160); q.addPath(P, new DOMMatrix([1, 0, 0, 1, d * lx, d * ly])); c.fillStyle = tl; c.fill(q, "evenodd"); }
  if (br) { const q = new Path2D(); q.rect(-60, -60, 160, 160); q.addPath(P, new DOMMatrix([1, 0, 0, 1, -d * lx, -d * ly])); c.fillStyle = br; c.fill(q, "evenodd"); }
  c.restore();
};
const blobP = (cx, cy, R, jag, seed, sc, n, alt, ox, oy) => {
  const p = []; n = n || 36;
  for (let i = 0; i < n; i++) {
    const t = i / n * T2, co = Math.abs(Math.cos(t)), si = Math.abs(Math.sin(t)), s = 1 / Math.pow(Math.pow(co, 4) + Math.pow(si, 4), .25);
    let w = 1 + (hsh(seed, i, 7) - .5) * jag; if (alt) w = 1 + (i & 1 ? -1 : 1) * jag * .5 * (.6 + hsh(seed, i, 3));
    const r = R * s * w * sc; p.push([cx + (ox || 0) + Math.cos(t) * r, cy + (oy || 0) + Math.sin(t) * r]);
  }
  return P2(p);
};
const stk = (c, col, w, f) => { c.strokeStyle = col; c.lineWidth = w; f(); c.stroke(); };

/* ---------- BOOSTER : JUNGLE, a moss tuft bursting out of the loam ---------- */
const leaf = (c, x, y, a, len, w, pt, lit, mid, dk, ol) => {
  const path = (dx, dy) => {
    c.save(); c.translate(x + dx, y + dy); c.rotate(a); c.beginPath(); c.moveTo(0, 0);
    c.bezierCurveTo(len * .25, -w, len * .7, -w * (1 - .45 * pt), len, pt ? 0 : -w * .3);
    if (!pt) c.quadraticCurveTo(len + w * .55, 0, len, w * .3);
    c.bezierCurveTo(len * .7, w * (1 - .45 * pt), len * .25, w, 0, 0); c.restore();
  };
  path(1.1, 1.6); c.fillStyle = K0(.3); c.fill();
  path(0, 0); const mx = x + Math.cos(a) * len * .5, my = y + Math.sin(a) * len * .5;
  c.fillStyle = lin(c, mx - w, my - w, mx + w, my + w, [[0, lit], [.5, mid], [1, dk]]); c.fill();
  if (ol) { c.strokeStyle = ol; c.lineWidth = 1.1; c.stroke(); }
  c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.moveTo(len * .12, 0); c.lineTo(len * .82, 0); c.restore();
  c.strokeStyle = K0(.28); c.lineWidth = 1.1; c.stroke();
};

const BOOSTER = (c, k) => {
  const b = k.bio, h = k.h, on = k.on, hs = k.state === 2 ? Math.max(0, h - 1) : h; floorTile(c, b, k.par);
  const loam = mix(b.bg1, b.floor1, [.8, .3, 0][h]);
  const st = [7, 4, 1][h], sp = [.2, .09, .025][h], al = [.04, .68, 1][h], R = [15, 15.3, 15.6][h], jg = [.06, .14, .24][h];
  const LP = (sc) => blobP(0, 0, R, jg, 11 + h, sc, 40, 0);
  c.save(); c.translate(21, 20); c.scale(1.1, [.72, .82, .94][h]);
  if (h < 2) { for (let i = 0; i < st; i++) { const sc = 1 + sp * (st - 1 - i) / Math.max(1, st - 1); c.fillStyle = rg(loam, al); c.fill(LP(sc)); } if (h > 0) bevP(c, LP(1), 2.2, W0(.08), K0(.3)); }
  else {
    const nl = 11, lp = [];
    for (let i = 0; i < nl; i++) { const t = i / nl * T2 + .2, rr = 10.8 + (hsh(i, 5, 2) - .5) * 1.4, r2 = 5.3 + hsh(i, 6, 2) * 1.1; lp.push([Math.cos(t) * rr, Math.sin(t) * rr, r2]); }
    c.fillStyle = rg(loam, al); lp.forEach(([x, y, r2]) => { c.beginPath(); c.arc(x, y, r2, 0, T2); c.fill(); }); c.beginPath(); c.arc(0, 0, 12, 0, T2); c.fill();
    c.lineWidth = .9 / 1.1; c.strokeStyle = rg(mix(b.floor1, b.floor0, .5), .55); lp.forEach(([x, y, r2]) => { c.beginPath(); c.arc(x, y, r2, PI * 1.05, PI * 1.75); c.stroke(); });
  }
  c.restore();
  const rn = [3, 4, 5][h]; c.lineCap = "round";
  for (let i = 0; i < rn; i++) {
    const a = PI + (i - (rn - 1) / 2) * .62, L = 7.5 + hsh(i, h, 2) * 3;
    const ex = 10 + Math.cos(a) * L, ey = 20 + Math.sin(a) * L * .9, qx = 10 + Math.cos(a + .5) * L * .55, qy = 20 + Math.sin(a + .5) * L * .55;
    c.beginPath(); c.moveTo(10, 20); c.quadraticCurveTo(qx, qy, ex, ey); c.strokeStyle = rg(b.bg1, .9); c.lineWidth = 1.8; c.stroke();
    c.beginPath(); c.moveTo(9.4, 19.4); c.quadraticCurveTo(qx - .6, qy - .6, ex - .6, ey - .6); c.strokeStyle = rg(mix(b.wall, b.floor1, .3), .4); c.lineWidth = 1; c.stroke();
  }
  c.fillStyle = rad(c, 9, 19, 5, [[0, mix(b.floor0, b.bg0, .5)], [1, mix(b.bg1, b.floor1, .5)]]);
  c.beginPath(); c.arc(10, 20, 3.8, 0, T2); c.fill(); c.strokeStyle = W0(.18); c.lineWidth = 1; c.beginPath(); c.arc(10, 20, 3.8, PI * 1.05, PI * 1.55); c.stroke();
  const lm = [-.1, .08, .66][h], lit = mix(b.wallHi, b.floor0, Math.min(.96, (on ? .42 : .3) + lm)), mid = mix(b.wallHi, b.floor0, .06 * h), dk = mix(b.floor1, b.bg0, .45 + .15 * h), pt = [0, .6, 1][h], f = on ? 1.12 : 1;
  const sh = [[], [[13, 20, 1.15, 9.5, 3], [13, 20, -1.15, 9.5, 3]], [[12.5, 20, 1.2, 14, 3.3], [12.5, 20, -1.2, 14, 3.3], [18, 20, .62, 14.5, 3.1], [18, 20, -.62, 14.5, 3.1]]][hs];
  sh.forEach(([x, y, a, len, w]) => leaf(c, x, y, a, len * f, w, Math.max(pt, .6), lit, mid, dk));
  const ol = h ? 0 : rg(mix(b.wallHi, b.floor0, .5), .6);
  const len = [23, 24.5, 26][h] * f, w = [5.4, 5, 4.4][h] * f;
  leaf(c, 10, 20, 0, len, w, pt, lit, mid, dk, ol);
  const nv = [3, 4, 5][h];
  for (let i = 0; i < nv; i++) {
    const t = .22 + .56 * (i / (nv - 1)), px = 10 + len * t, hw = w * .75 * 4 * t * (1 - t) * .9;
    c.beginPath(); c.moveTo(px, 20); c.lineTo(px + hw * .85, 20 - hw); c.moveTo(px, 20); c.lineTo(px + hw * .85, 20 + hw);
    c.strokeStyle = K0(.32); c.lineWidth = 1.1; c.stroke();
  }
};


const STREAM = (c, k) => {
  const [lx, ly] = LV[k.dir], lv = [lx, ly], b = k.bio, h = k.h, nb = { W: k.nb[BS[k.dir][0]], E: k.nb[BS[k.dir][1]] }, ph = ((k.phase % 40) + 40) % 40;
  c.save(); c.translate(20, 20); c.rotate(k.dir * PI / 2); c.translate(-20, -20);
  floorTile(c, b, k.par);
  const cy = 20, hw = GEO.STREAM.half[h], amp = [1.6, 1.2, .8][h], bw = GEO.STREAM.bank[h];
  const tooth = (x) => h == 2 ? (hsh(((Math.floor(x / 5) % 8) + 8) % 8, 4, 9) * 1.8) : 0;
  const top = (x) => cy - hw + amp * Math.sin(T2 * x / 40 + 1) + tooth(x), bot = (x) => cy + hw + amp * Math.sin(T2 * x / 20 + 2) - tooth(x + 10);
  const lo = nb.W ? -6 : -3, hi = nb.E ? 46 : 43, CAP = 15, sm = (t) => t * t * (3 - 2 * t);
  const off = (x) => { let o = 0; if (!nb.W && x < lo + CAP) o = Math.max(o, hw * .5 * (1 - sm((x - lo) / CAP))); if (!nb.E && x > hi - CAP) o = Math.max(o, hw * .5 * (1 - sm((hi - x) / CAP))); return o; };
  const poly = (g, dy) => { const p = [], q = []; for (let x = lo; x <= hi + .01; x += 1) { const o = off(x); p.push([x, top(x) + o - g + (dy || 0)]); q.push([x, bot(x) - o + g + (dy || 0)]); } return P2(p.concat(q.reverse())); };
  const bank = mix(b.wall, b.floor0, .3), bankHi = mix(b.wallHi, b.wall, .1);
  const PB = poly(bw);
  if (h == 0) { [3, 2.2, 1.5, .8, 0].forEach((g) => { c.fillStyle = rg(bank, .24); c.fill(poly(bw + g)); }); }
  else { c.fillStyle = K0(.2); c.fill(poly(bw, 1.5 * ly)); c.fillStyle = lin(c, 0, ly > 0 ? 0 : 40, 0, ly > 0 ? 40 : 0, [[0, mix(bankHi, bank, .3)], [.5, bank], [1, mix(b.wall, b.bg1, .35)]]); c.fill(PB); bevP(c, PB, 1.4, W0(.26), K0(.3), lv); }
  const PW = poly(0), sh = mix(b.wall, b.floor0, .35), mid = mix(b.floor0, b.bg0, .5), deep = h == 2 ? mix(b.bg1, b.bg0, .4) : mix(b.bg1, b.bg0, .6);
  c.fillStyle = lin(c, 0, cy - hw, 0, cy + hw, [[0, sh], [.28, mid], [.5, deep], [.72, mid], [1, sh]]); c.fill(PW);
  bevP(c, PW, 2.4, K0(.42), rg(b.wallHi, .14), lv);
  c.save(); c.clip(PW);
  const rows = [[[-6, 3], [1, 22], [8, 10]], [[-9, 6], [-4, 26], [2, 14], [7, 31], [10, 2]], [[-7, 2], [-3, 21], [1, 11], [4, 30], [7, 6], [9, 24]]][h];
  const L = [17, 12, 9][h], t = [1.7, 1.5, 1.4][h];
  wrap(c, () => rows.forEach(([dy, x0]) => {
    const x = x0 + ph;
    const y = cy + dy * (hw - GEO.STREAM.rowsInset) / Math.max(...rows.map((r) => Math.abs(r[0])));
    const hd = x + L * .86, tt = t * 1.05; c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + L * .4, y - tt * .1, x + L * .62, y - tt, hd, y - tt); c.bezierCurveTo(hd + L * .2, y - tt, hd + L * .2, y + tt, hd, y + tt); c.bezierCurveTo(x + L * .62, y + tt, x + L * .4, y + tt * .1, x, y);
    c.fillStyle = rg(mix(b.wallHi, b.floor0, .5), h == 0 ? .7 : .8); c.fill();
    c.save(); c.translate(0, 2 * ly); c.beginPath(); c.moveTo(x + L * .2, y); c.bezierCurveTo(x + L * .45, y - t * .3, x + L * .62, y - t * .7, x + L * .86, y - t * .7); c.strokeStyle = K0(.22); c.lineWidth = 1.2; c.stroke(); c.restore();
  }));
  if (!nb.W) { c.fillStyle = lin(c, 0, 0, 10, 0, [[0, K0(.5)], [1, K0(0)]]); c.fillRect(0, 0, 10, 40); }
  if (!nb.E) { c.fillStyle = lin(c, 40, 0, 30, 0, [[0, K0(.5)], [1, K0(0)]]); c.fillRect(30, 0, 10, 40); }
  c.restore();
  c.restore();
};
const TER = [.34, .24, .18], DK = [0, .1, .2], WH = (b) => mix(b.wallHi, b.floor0, .5);
const QUICKSAND = (c, k) => {
  const b = k.bio, h = k.h; floorTile(c, b, k.par);
  const jg = [.04, .06, .08][h], alt = 0, R0 = 17.8;
  c.fillStyle = h ? K0([0, .12, .24][h]) : rg(mix(b.wallHi, b.floor0, .35), .1); c.fill(blobP(20, 20, R0, jg, 21, [1.07, 1.07, 1.1][h], 40, alt));
  const rs = GEO.QUICK.radii[h], ps = [];
  rs.forEach((r, i) => {
    const ox = .6 * i, oy = .9 * i, P = blobP(20, 20, r, jg, 21 + i, 1, 40, alt, ox, oy); ps.push([r, ox, oy]);
    c.fillStyle = mix(b.bg1, mix(b.floor1, b.bg0, Math.max(0, TER[h] - [.03, .05, .05][h] * i)), DK[h] + .03 * i * h); c.fill(P);
    bevP(c, P, 1.5, K0(.1 + h * .03), rg(WH(b), .16 + h * .08));
  });
  const pr = [5.2, 5.6, 6.2][h], oi = rs.length - 1;
  const Pp = blobP(20, 20, pr, .1 + jg, 33, 1, 24, 0, .6 * oi, .9 * oi);
  c.fillStyle = rad(c, 20 + .6 * oi, 20 + .9 * oi, pr * 1.2, [[0, mix(b.floor1, b.bg0, .04)], [1, mix(b.floor1, b.bg0, .12)]]); c.fill(Pp);
  bevP(c, Pp, 1.6, K0(.3), rg(WH(b), .3));
};


export const LIVING = { BLOOM: BOOSTER, STREAM, QUICK: QUICKSAND };
