/* TILE ART direction D, built worlds (from option A "FIXTURE"): hardware sunk into the floor. Light top-left: wells shadowed top/left, lips lit bottom/right. Painters take (c, k) (see featdraw kOf); BELT is {mech, lit}. */
import { mix, floorTile } from "./kit.js";
import { GEO } from "./geo.js";
const WH = "#fff", BK = "#000";
const fillP = (c, col, pts, a) => { c.save(); if (a != null) c.globalAlpha = a; c.fillStyle = col; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); c.restore(); };
const rect = (c, col, x, y, w, h, a) => fillP(c, col, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], a);
const line = (c, col, pts, w, a, cap, join) => { c.save(); if (a != null) c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = w; c.lineCap = cap || "butt"; c.lineJoin = join || "round"; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); c.restore(); };
const oct = (x, y, w, h, cs) => [[x + cs, y], [x + w - cs, y], [x + w, y + cs], [x + w, y + h - cs], [x + w - cs, y + h], [x + cs, y + h], [x, y + h - cs], [x, y + cs]];
const octIn = (x, y, w, h, cs, t) => oct(x + t, y + t, w - 2 * t, h - 2 * t, Math.max(0.01, cs - 0.586 * t));
/* bevel strips between outer and inner polygon; up = raised (top-left lit), else recessed (top-left shadowed) */
function bevel(c, o, i, up, ha, la, hi) {
  const n = o.length;
  for (let k = 0; k < n; k++) {
    const p = o[k], q = o[(k + 1) % n], r = i[(k + 1) % n], s = i[k], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy);
    if (l < 0.05) continue;
    let lit = Math.max(-1, Math.min(1, 1.4142 * 0.7071 * (dx - dy) / l)); if (!up) lit = -lit;
    fillP(c, lit > 0 ? (hi || WH) : BK, [p, q, r, s], Math.abs(lit) * (lit > 0 ? ha * 0.6 : la * 0.9));
  }
}
const pit = (c, x, y, w, h, cs, t, fill, ha, la, hi) => { const o = oct(x, y, w, h, cs), i = octIn(x, y, w, h, cs, t); fillP(c, fill, o); bevel(c, o, i, false, ha == null ? 0.4 : ha, la == null ? 0.6 : la, hi); return i; };
/* contact shadow: falls a little to the south-east */
function ao(c, x, y, w, h, cs, n, a) { for (let j = n; j >= 1; j--) fillP(c, BK, oct(x - j * 0.55 + 0.5, y - j * 0.55 + 0.9, w + j * 1.1, h + j * 1.1, cs + j * 0.5), a / n); }
const stud = (c, x, y, s, base) => { rect(c, base, x - s / 2, y - s / 2, s, s); rect(c, WH, x - s / 2, y - s / 2, s, s * 0.4, 0.35); rect(c, BK, x - s / 2, y + s * 0.1, s, s * 0.4, 0.4); };
const vgrad = (c, y0, y1, stops) => { const g = c.createLinearGradient(0, y0, 0, y1); stops.forEach(s => g.addColorStop(s[0], s[1])); return g; };
const hgrad = (c, x0, x1, stops) => { const g = c.createLinearGradient(x0, 0, x1, 0); stops.forEach(s => g.addColorStop(s[0], s[1])); return g; };
const fillG = (c, g, x, y, w, h) => { c.save(); c.fillStyle = g; c.fillRect(x, y, w, h); c.restore(); };

const lightRect = (c, r) => {
  const [x, y, w, h] = r;
  if (w >= h) { rect(c, WH, x, y, w, 1.2, 0.4); rect(c, BK, x, y + h - 1.4, w, 1.4, 0.5); }
  else { rect(c, WH, x, y, 1.2, h, 0.4); rect(c, BK, x + w - 1.4, y, 1.4, h, 0.5); }
};
const BS = [["W", "E"], ["N", "S"], ["E", "W"], ["S", "N"]];
const rotR = (d, x, y, w, h) => { let X = x, Y = y, W = w, H = h; for (let i = 0; i < d; i++) { const nx = 40 - (Y + H); Y = X; X = nx; [W, H] = [H, W]; } return [X, Y, W, H]; };
const rotP = (d, x, y) => { let X = x, Y = y; for (let i = 0; i < d; i++) { const nx = 40 - Y; Y = X; X = nx; } return [X, Y]; };
const R_BELT = GEO.BELT.R;
export const BUILT = {
  /* ICE PATCH: a glazed ice plate; steel rails sit only on sides with no same-kind neighbour (any patch shape), streaks and grooves continue across tiles */
  GLIDE(c, k) {
    const b = k.bio, h = k.h, nb = k.nb;
    floorTile(c, b, k.par);
    const steel = [mix(b.wallHi, b.wall, 0.3), mix(b.wallHi, b.wall, 0.14), b.wall][h], plate = mix(b.wallHi, b.floor0, [0.5, 0.58, 0.68][h]);
    const R = 7, y0 = nb.N ? 0 : R, y1 = nb.S ? 40 : 40 - R, sk = -((k.gy * 7) % 40);
    rect(c, plate, 0, y0, 40, y1 - y0);
    c.save(); c.beginPath(); c.rect(0, y0, 40, y1 - y0); c.clip();
    [10, 24].forEach((x, bi) => [-40, 0, 40].forEach(o => fillP(c, WH, [[x + o + sk, y0], [x + o + sk + (bi ? 3 : 7), y0], [x + o + sk + (bi ? 3 : 7) - 7, y1], [x + o + sk - 7, y1]], bi ? 0.1 : 0.16)));
    fillG(c, vgrad(c, y0, y1, [[0, nb.N ? "rgba(0,0,0,0)" : "rgba(0,0,0,.42)"], [0.22, "rgba(0,0,0,0)"], [0.82, "rgba(255,255,255,0)"], [1, nb.S ? "rgba(255,255,255,0)" : "rgba(255,255,255,.28)"]]), 0, y0, 40, y1 - y0);
    const ys = [[20], [16.5, 23.5], [14, 20, 26]][h];
    ys.forEach(y => { line(c, BK, [[0, y], [40, y]], 1.3, 0.42); line(c, WH, [[0, y + 1.3], [40, y + 1.3]], 1.1, 0.5); });
    c.restore();
    const t = [1.2, 1.7, 2.4][h];
    if (!nb.N) { rect(c, steel, 0, 0, 40, R); rect(c, WH, 0, 0, 40, 1.2, 0.5); rect(c, BK, 0, R - t, 40, t, 0.55); [10, 30].forEach(x => stud(c, x, R / 2, 2.6, steel)); }
    if (!nb.S) { rect(c, steel, 0, 40 - R, 40, R); rect(c, WH, 0, 40 - R, 40, t, 0.55); rect(c, BK, 0, 40 - 1.4, 40, 1.4, 0.45); [10, 30].forEach(x => stud(c, x, 40 - R / 2, 2.6, steel)); }
    if (!nb.W) { rect(c, steel, 0, 0, 3.6, 40); rect(c, WH, 0, 0, 1.2, 40, 0.4); rect(c, BK, 3.6 - 1.4, y0, 1.4, y1 - y0, 0.5); }
    if (!nb.E) { rect(c, steel, 36.4, 0, 3.6, 40); rect(c, WH, 36.4, y0, 1.3, y1 - y0, 0.5); rect(c, BK, 38.6, 0, 1.4, 40, 0.4); }
  },

  /* CONVEYOR: real rollers between two rails; mech in the flow frame (East), lit in the board frame so the key stays top-left at every dir */
  BELT: {
    mech(c, k) {
      const b = k.bio, h = k.h, [wl, el] = BS[k.dir], nbW = k.nb[wl], nbE = k.nb[el], fx = k.dir >= 2, fy = k.dir === 1 || k.dir === 2;
      floorTile(c, b, k.par);
      const R = R_BELT, y0 = R, y1 = 40 - R, per = [10, 8, 5][h], rw = [7, 5.6, 3.6][h], ph = ((k.phase % per) + per) % per;
      const metal = [mix(b.wallHi, b.wall, 0.78), mix(b.wallHi, b.wall, 0.5), mix(b.wallHi, b.wall, 0.22)][h], rail = mix(b.wall, b.floor1, [0.8, 0.6, 0.42][h]);
      rect(c, b.bg1, 0, y0, 40, y1 - y0);
      c.save(); c.beginPath(); c.rect(0, y0, 40, y1 - y0); c.clip();
      for (let x = -per; x < 40 + per; x += per) {
        const rx = x + ph + (per - rw) / 2;
        rect(c, BK, rx + (fx ? -0.9 : 0.9), y0, rw, y1 - y0, 0.35);
        rect(c, metal, rx, y0, rw, y1 - y0);
        fillG(c, hgrad(c, fx ? rx + rw : rx, fx ? rx : rx + rw, [[0, "rgba(255,255,255,.5)"], [0.3, "rgba(255,255,255,.14)"], [0.65, "rgba(0,0,0,.08)"], [1, "rgba(0,0,0,.55)"]]), rx, y0, rw, y1 - y0);
        rect(c, BK, rx, y0, rw, 2.4, 0.4); rect(c, BK, rx, y1 - 2.4, rw, 2.4, 0.4);
      }
      fillG(c, vgrad(c, fy ? y1 : y0, fy ? y0 : y1, [[0, "rgba(0,0,0,.55)"], [0.2, "rgba(0,0,0,.05)"], [0.85, "rgba(0,0,0,0)"], [1, "rgba(255,255,255,.1)"]]), 0, y0, 40, y1 - y0);
      c.restore();
      rect(c, rail, 0, 0, 40, R); rect(c, rail, 0, 40 - R, 40, R);
      [R / 2, 40 - R / 2].forEach(y => { line(c, BK, [[18.2, y - 1.8], [21.4, y], [18.2, y + 1.8]], 1.7, 0.5); line(c, WH, [[17.6, y - 1.8], [20.8, y], [17.6, y + 1.8]], 1.2, 0.5); });
      if (!nbW) rect(c, rail, 0, 0, 3.4, 40);
      if (!nbE) rect(c, rail, 36.6, 0, 3.4, 40);
    },
    lit(c, k) {
      const [wl, el] = BS[k.dir], rail = mix(k.bio.wall, k.bio.floor1, [0.8, 0.6, 0.42][k.h]), d = k.dir;
      lightRect(c, rotR(d, 0, 0, 40, R_BELT)); lightRect(c, rotR(d, 0, 40 - R_BELT, 40, R_BELT));
      if (!k.nb[wl]) lightRect(c, rotR(d, 0, 0, 3.4, 40));
      if (!k.nb[el]) lightRect(c, rotR(d, 36.6, 0, 3.4, 40));
      [[5, R_BELT / 2], [35, R_BELT / 2], [5, 40 - R_BELT / 2], [35, 40 - R_BELT / 2]].forEach(([x, y]) => { const [X, Y] = rotP(d, x, y); stud(c, X, Y, 2.2, rail); });
    },
  },

  /* ARENA TRAP: a cast plate sunk below the floor in its well; N cleats = N tiles of reach. state 1 = winding: sunk deeper, flat cleats, `lit` 1..4 fills a four-notch strip along the lower lip; state 2 = cooling, plate dimmed */
  PLATE(c, k) {
    const b = k.bio, h = k.h, on = k.on, cool = k.state === 2;
    floorTile(c, b, k.par);
    const t = [2.6, 3.4, 4.4][h] + (on ? 1.6 : 0), [X, , S] = GEO.PLATE.well, plate0 = mix(b.wall, b.floor0, on ? 0.2 : [0.4, 0.34, 0.28][h]), plate = cool ? mix(plate0, b.bg1, 0.7) : plate0;
    pit(c, X, X, S, S, 0.01, t, plate, 0.5, 0.95, b.wallHi);
    const ix = X + t, iw = S - 2 * t;
    c.save(); c.beginPath(); c.rect(ix, ix, iw, iw); c.clip();
    fillG(c, vgrad(c, ix, ix + iw, [[0, "rgba(0,0,0,.5)"], [0.35, "rgba(0,0,0,.05)"], [1, "rgba(0,0,0,0)"]]), 0, 0, 40, 40);
    fillG(c, hgrad(c, ix, ix + iw, [[0, "rgba(0,0,0,.35)"], [0.3, "rgba(0,0,0,0)"]]), 0, 0, 40, 40);
    if (on) rect(c, BK, ix, ix, iw, iw, 0.22);
    [[ix + 1.8, ix + 1.8], [ix + iw - 1.8, ix + 1.8], [ix + 1.8, ix + iw - 1.8], [ix + iw - 1.8, ix + iw - 1.8]].forEach(p => { rect(c, BK, p[0] - 1.1, p[1] - 1.1, 2.2, 2.2, 0.4); rect(c, WH, p[0] - 1.1, p[1] + 0.3, 2.2, 0.8, 0.22); });
    const n = h + 1, bh = 3.2, gap = 2.8, tot = n * bh + (n - 1) * gap, by = 20 - tot / 2 - (on ? 1.2 : 0), bx = ix + 3.4, bw = iw - 6.8;
    for (let i = 0; i < n; i++) {
      const yy = by + i * (bh + gap);
      if (!on) { rect(c, BK, bx + 0.6, yy + 1.2, bw, bh, 0.42); rect(c, mix(plate, b.wallHi, 0.62), bx, yy, bw, bh); rect(c, WH, bx, yy, bw, 1, 0.4); rect(c, BK, bx, yy + bh - 0.9, bw, 0.9, 0.3); }
      else { rect(c, BK, bx, yy, bw, bh, 0.4); rect(c, WH, bx, yy + bh - 0.8, bw, 0.8, 0.14); }
    }
    if (on) {
      const nw = (iw - 8) / 4 - 1, ny = ix + iw - 3.4;
      for (let i = 0; i < 4; i++) { const nx = ix + 4 + i * (nw + 1); rect(c, BK, nx, ny, nw, 1.6, 0.5); if (i < k.lit) { rect(c, mix(b.wallHi, plate, 0.7), nx, ny, nw, 1.6); rect(c, WH, nx, ny, nw, 0.5, 0.35); } }
    }
    c.restore();
  },

  /* VOID PORTAL: a dark socket with an inset stack of stepped rings; 1 / 2 / 3 ticks on the lip are the pair id */
  PORTAL(c, k) {
    const b = k.bio, h = k.h, on = k.on, ids = Math.max(1, Math.min(3, k.pair || 1));
    floorTile(c, b, k.par);
    const X = 1.5, S = 37, hiC = b.wallHi, t0 = 2.4, floorW = mix(b.wall, b.bg1, 0.55), T = GEO.PORTAL.tick;
    pit(c, X, X, S, S, 0.01, t0, floorW, 0.9, 0.9, hiC);
    const tt = ids * T.w + (ids - 1) * T.g, tx = 20 - tt / 2;
    for (let i = 0; i < ids; i++) { rect(c, BK, tx + i * (T.w + T.g) + 0.5, T.y + 0.5, T.w, T.h, 0.5); rect(c, mix(b.wallHi, b.wall, 0.78), tx + i * (T.w + T.g), T.y, T.w, T.h); rect(c, hiC, tx + i * (T.w + T.g), T.y, T.w, 0.8, 0.5); }
    const n = [2, 3, 4][h], st = [3.4, 2.6, 2][h];
    let x = 7, w = 26, cc = 3.4;
    fillP(c, mix(b.bg1, b.floor1, 0.4), oct(x, 5.4, w, w, cc));
    bevel(c, oct(x, 5.4, w, w, cc), octIn(x, 5.4, w, w, cc, 1.8), false, 0.4, 0.8, hiC);
    x += 2.4; w -= 4.8; cc = Math.max(0.01, cc - 1.4);
    let y = 7.8;
    for (let i = 0; i < n; i++) {
      const oo = oct(x, y, w, w, cc), ii = octIn(x, y, w, w, cc, 1.9);
      ao(c, x, y, w, w, cc, 2, 0.5);
      fillP(c, mix(b.wallHi, b.wall, 0.12 + 0.13 * i + (on ? 0.1 : 0)), oo); bevel(c, oo, ii, true, 0.9, 0.9, hiC);
      line(c, hiC, [oo[7], oo[0], oo[1]], 1.2, [0.35, 0.5, 0.65, 0.8][i] * (on ? 1 : 0.85));
      x += st; y += st; w -= 2 * st; cc = Math.max(0.01, cc - 0.586 * st);
    }
    const core = oct(x, y, w, w, cc);
    fillP(c, on ? mix(b.wallHi, b.wall, 0.45) : b.bg1, core);
    bevel(c, core, octIn(x, y, w, w, cc, Math.min(1.6, w / 4)), false, 0.35, 0.7, hiC);
    if (on) fillP(c, BK, core, 0.1);
  },

  /* CROWN GATE: a portcullis in a gilt inlay. `lit` 0..4 is the closing progress: 0 open (bars sunk in slits), 1..3 bars rising, 4 or on = shut. The bottom strip is the dial (shut cells raised, open cells sunk), the heat tell */
  GATE(c, k) {
    const b = k.bio, h = k.h, f = k.on ? 1 : Math.max(0, Math.min(4, k.lit)) / 4;
    floorTile(c, b, k.par);
    const gilt = mix(b.wallHi, b.wall, [0.68, 0.54, 0.4][h]), X = 2, S = 36, tt = 4.4, tb = 8.2;
    pit(c, X, X, S, S, 0.01, 2, gilt, 0.8, 0.9, b.wallHi);
    const ix = X + tt, iy = X + tt, iw = S - 2 * tt, ih = S - tt - tb;
    [[X + 3.2, X + 3.2], [X + S - 3.2, X + 3.2]].forEach(p => { rect(c, BK, p[0] - 1, p[1] - 1, 2, 2, 0.4); rect(c, WH, p[0] - 1, p[1] + 0.2, 2, 0.8, 0.25); });
    pit(c, ix, iy, iw, ih, 0.01, 1.8, mix(b.bg1, b.floor1, 0.35), 0.4, 0.65);
    c.save(); c.beginPath(); c.rect(ix, iy, iw, ih); c.clip();
    const nb = [3, 4, 5][h], bw = 3.4, left = ix + 2.2, right = ix + iw - 2.2, pitch = (right - left - bw) / (nb - 1);
    if (f === 0) {
      for (let i = 0; i < nb; i++) { const x = left + i * pitch, slit = [x, iy + 3.2, bw, ih - 6.4]; rect(c, BK, slit[0], slit[1], slit[2], slit[3], 0.88); rect(c, WH, slit[0], slit[1] + slit[3] - 1, slit[2], 1, 0.3); rect(c, mix(b.wallHi, b.wall, 0.4), slit[0] + 0.2, slit[1] + 1.8, bw - 0.4, 1.2, 0.35); }
      rect(c, BK, ix + 1.8, iy + ih / 2 - 0.5, iw - 3.6, 1.3, 0.28);
    } else {
      const bot = iy + ih - 1.2, top = bot - f * (bot - (iy + 1.2));
      for (let i = 0; i < nb; i++) { const x = left + i * pitch; rect(c, BK, x, iy + 3.2, bw, ih - 6.4, 0.6); fillP(c, BK, [[x + bw, top + 5], [x + bw + 4.6, top + 7], [x + bw + 4.6, bot + 2], [x + bw, bot]], 0.5 * f); }
      rect(c, BK, ix, iy + ih / 2 + 2.8, iw, 2.6, 0.38);
      for (let i = 0; i < nb; i++) {
        const x = left + i * pitch, tipH = [2.4, 3.6, 5][h] * f;
        rect(c, gilt, x, top + tipH, bw, bot - top - tipH);
        const tip = h === 0 ? [[x, top + tipH], [x, top + 0.4], [x + bw, top + 0.4], [x + bw, top + tipH]] : h === 1 ? [[x, top + tipH], [x + 0.5, top + 0.8], [x + bw - 0.5, top + 0.8], [x + bw, top + tipH]] : [[x, top + tipH], [x + bw / 2, top - 0.6], [x + bw, top + tipH]];
        fillP(c, gilt, tip);
        fillG(c, hgrad(c, x, x + bw, [[0, "rgba(255,255,255,.55)"], [0.45, "rgba(255,255,255,.08)"], [1, "rgba(0,0,0,.5)"]]), x, top, bw, bot - top);
      }
      rect(c, gilt, ix, iy + ih / 2 - 1.8, iw, 3.4); rect(c, WH, ix, iy + ih / 2 - 1.8, iw, 1.1, 0.5); rect(c, BK, ix, iy + ih / 2 + 0.7, iw, 0.9, 0.5);
    }
    c.restore();
    const shut = h === 0 ? 3 : h === 1 ? 3 : 4, open = h === 0 ? 0 : h === 1 ? 6 : 4, cells = shut + open, cw = 2.7, pitchc = 3.3, tx = 20 - (cells * pitchc - (pitchc - cw)) / 2, ty = X + S - tb + 1.6;
    for (let i = 0; i < cells; i++) {
      const x = tx + i * pitchc, isOpen = i < open;
      if (isOpen) { rect(c, BK, x, ty, cw, 3.2, 0.62); rect(c, WH, x, ty + 2.5, cw, 0.7, 0.28); }
      else { rect(c, BK, x + 0.4, ty + 0.7, cw, 3.2, 0.4); rect(c, mix(b.wallHi, gilt, 0.75), x, ty, cw, 3.2); rect(c, WH, x, ty, cw, 0.9, 0.5); rect(c, BK, x, ty + 2.4, cw, 0.8, 0.3); }
    }
  },
};
