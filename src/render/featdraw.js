/* THROWAWAY PROTOTYPE (2026-10-21 tile round): CLASSIC 2D painter for the
   world.feat layer, art approach C (03-art.md / 04-synthesis §7.4): a flush
   floor1 inlay, marks in the biome's mark slot, heat = EDGE (keyline /
   dashed / hazard band) + DENSITY (1/2/3 marks) + VALUE + TIP, honest
   tempo. No new hex: every tone is a biome slot or a slot-to-slot mix.
   A feature tile REPLACES the floor drawImage with one baked 40x40 frame
   (0 extra draws); without a DOM it paints the same vectors in place. */
import { CFG, key, biomeOf } from "../core/config.js";
import { FEAT_PROFILE } from "../core/feat.js";

const TL = CFG.TILE, C = CFG.COLS, R = CFG.ROWS;
const DARK = { ICE: "wall", SAND: "bg1" };
const NATURAL = new Set(["JUNGLE", "WATER", "SAND"]);
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const mix = (top, bot, a) => { const t = rgb(top), b = rgb(bot); return hex(t.map((v, i) => v * a + b[i] * (1 - a))); };
const TONES = new Map();
export function tones(b, h) {
  const k = b.name + h;
  if (TONES.has(k)) return TONES.get(k);
  const m = DARK[b.name] ? b[DARK[b.name]] : b.wallHi;
  const sheet = b.name === "SAND" ? mix(b.bg1, b.floor1, 0.3) : b.floor1;
  const t = { sheet, hole: b.bg1, band: DARK[b.name] ? b.floor0 : b.bg1, key: mix(m, sheet, 0.4), full: m,
    mk: (DARK[b.name] ? [mix(m, sheet, 0.68), mix(m, sheet, 0.84), m] : [mix(m, sheet, 0.5), mix(m, sheet, 0.72), m])[h],
    dark: !!DARK[b.name], dim: mix(m, sheet, 0.22), natural: NATURAL.has(b.name) };
  TONES.set(k, t);
  return t;
}
const caps = (c, h) => { c.lineCap = h === 0 ? "round" : h === 1 ? "square" : "butt"; c.lineJoin = h === 0 ? "round" : h === 1 ? "bevel" : "miter"; };
const SL = { N: [0, 0.75, 40, 0.75], S: [0, 39.25, 40, 39.25], W: [0.75, 0, 0.75, 40], E: [39.25, 0, 39.25, 40] };
const SR = { N: [0, 0, 40, 5], S: [0, 35, 40, 5], W: [0, 0, 5, 40], E: [35, 0, 5, 40] };
function line(c, x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
/* edge by heat: CORE soft keyline, PLUS dashed, MAX hazard band (HATCH on
   built biomes, TEETH on natural ones) */
export function edge(c, t, h, side, force) {
  const hh = force != null ? force : h;
  c.save();
  if (hh === 0) { c.strokeStyle = t.key; c.lineWidth = 1.5; line(c, ...SL[side]); c.restore(); return; }
  if (hh === 1) {
    const [x1, y1, x2, y2] = SL[side].map((v) => (v === 0.75 ? 1.25 : v === 39.25 ? 38.75 : v));
    c.strokeStyle = t.mk; c.lineWidth = 2.5; c.setLineDash && c.setLineDash([5, 4]); line(c, x1, y1, x2, y2); c.setLineDash && c.setLineDash([]);
    c.restore(); return;
  }
  const [rx, ry, rw, rh] = SR[side];
  c.fillStyle = t.band; c.fillRect(rx, ry, rw, rh);
  c.fillStyle = t.mk; c.strokeStyle = t.mk;
  if (t.natural) {
    c.beginPath();
    const hz = side === "N" || side === "S";
    for (let i = 0; i < 40; i += 8) {
      if (hz) { const b0 = side === "N" ? 0 : 40, tip = side === "N" ? 4.5 : 35.5; c.moveTo(i, b0); c.lineTo(i + 4, tip); c.lineTo(i + 8, b0); }
      else { const b0 = side === "W" ? 0 : 40, tip = side === "W" ? 4.5 : 35.5; c.moveTo(b0, i); c.lineTo(tip, i + 4); c.lineTo(b0, i + 8); }
    }
    c.closePath(); c.fill();
  } else {
    c.beginPath(); c.rect(rx, ry, rw, rh); c.clip();
    c.lineWidth = 2; c.lineCap = "butt";
    for (let k = -40; k < 80; k += 7) line(c, k, 0, k + 40, 40);
  }
  c.restore();
}
const ROTS = { E: 0, S: 1, W: 2, N: 3 }, NAMES = ["E", "S", "W", "N"];
/* local side name (E = downstream) -> board side for a belt of direction d */
function chev(c, cx, h) {
  const a = h === 2 ? 5 : h ? 6 : 4, w = h === 2 ? 4 : 5;
  c.beginPath(); c.moveTo(cx - w, 20 - a - 2); c.lineTo(cx + w - 1, 20); c.lineTo(cx - w, 20 + a + 2); c.stroke();
}
/* spec: {kind, h, dir 0..3, exit, phase, outer:[sides], state, lit, gx, gy} */
export function paintCell(c, b, s) {
  const h = s.h, t = tones(b, h);
  c.save();
  c.beginPath(); c.rect(0, 0, 40, 40); c.clip();
  c.fillStyle = t.sheet; c.fillRect(0, 0, 40, 40);
  if (s.kind === "BELT") {
    c.translate(20, 20); c.rotate((s.dir * Math.PI) / 2); c.translate(-20, -20);
    if (h === 0) {
      c.globalAlpha = t.dark ? 0.25 : 0.55; c.fillStyle = t.hole; c.fillRect(0, 12, 40, 16); c.globalAlpha = 1;
      c.strokeStyle = t.key; c.lineWidth = 1.2; line(c, 0, 12, 40, 12); line(c, 0, 28, 40, 28);
    } else if (!t.dark) { c.globalAlpha = 0.45; c.fillStyle = t.hole; c.fillRect(0, 5, 40, 30); c.globalAlpha = 1; }
    const n = h + 1, sp = 40 / n;
    c.strokeStyle = t.mk; c.lineWidth = 3.2; caps(c, h);
    for (let i = -1; i <= n; i++) chev(c, sp * (i + 0.5) + (s.phase % sp), h);
    if (h) { edge(c, t, h, "N"); edge(c, t, h, "S"); }
    if (s.exit) edge(c, t, h, "E", h === 0 ? 0 : h);
  } else if (s.kind === "GLIDE") {
    const sp = [40, 20, 40 / 3][h], off = ((s.gx + s.gy) * 40) % sp;
    c.strokeStyle = t.mk; c.lineWidth = 2; caps(c, h);
    c.setLineDash && c.setLineDash([11, 9]); c.lineDashOffset = (s.gx * 7 + s.gy * 3) % 20;
    for (let k = -80 - off; k < 80; k += sp) line(c, k, 40, k + 40, 0);
    c.setLineDash && c.setLineDash([]);
    for (const sd of s.outer) edge(c, t, h, sd);
  } else if (s.kind === "BLOOM") {
    const flare = s.state === 1, cool = s.state === 2, tf = flare ? tones(b, 2) : t;
    for (const sd of ["N", "E", "S", "W"]) edge(c, tf, h, sd, flare ? 2 : h);
    c.translate(20, 20);
    if (cool) {
      c.strokeStyle = t.dim; c.lineWidth = 2.4; caps(c, h);
      line(c, -6, 0, 6, 0); line(c, 0, -2, 0, 2);
    } else {
      c.strokeStyle = flare ? t.full : t.mk; c.lineWidth = h === 2 ? 2.2 : 2.6; caps(c, h);
      for (let i = 0; i <= h; i++) {
        const d0 = 3.2 + i * 4.2, d1 = d0 + 3.2;
        for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) line(c, sx * d0, sy * d0, sx * d1, sy * d1);
      }
      if (h === 2 && !flare) for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { c.fillStyle = t.mk; c.beginPath(); c.moveTo(sx * 16.5, sy * 16.5); c.lineTo(sx * 13, sy * 15.5); c.lineTo(sx * 15.5, sy * 13); c.closePath(); c.fill(); }
    }
  } else if (s.kind === "PLATE") {
    const lit = s.lit || 0, cool = s.state === 2;
    if (h === 2) for (const sd of ["N", "E", "S", "W"]) edge(c, t, h, sd);
    c.strokeStyle = h ? t.mk : t.key; c.lineWidth = h ? 2.2 : 1.5; caps(c, h);
    if (h === 1) { c.setLineDash && c.setLineDash([5, 4]); }
    c.strokeRect(8, 8, 24, 24);
    c.setLineDash && c.setLineDash([]);
    c.fillStyle = t.mk;
    const r = h + 1;
    for (let i = 0; i < r; i++) {
      const o = 20 + (i - (r - 1) / 2) * 5 - 1;
      c.fillRect(o, 8, 2, 3); c.fillRect(o, 29, 2, 3); c.fillRect(8, o, 3, 2); c.fillRect(29, o, 3, 2);
    }
    c.strokeStyle = cool ? t.dim : t.mk; c.lineWidth = 2.6;
    c.beginPath(); c.moveTo(12.5, 15); c.lineTo(17.5, 20); c.lineTo(12.5, 25); c.stroke();
    c.beginPath(); c.moveTo(27.5, 15); c.lineTo(22.5, 20); c.lineTo(27.5, 25); c.stroke();
    if (lit) {
      const seg = [[15, 1.5, 10, 3.5], [35, 15, 3.5, 10], [15, 35, 10, 3.5], [1.5, 15, 3.5, 10]];
      seg.forEach(([x, y, w, hh], i) => { c.fillStyle = i < lit ? t.full : t.dim; c.fillRect(x, y, w, hh); });
    }
  }
  c.restore();
}
const featAt = (w, x, y) => (x < 0 || y < 0 || x >= C || y >= R ? 0 : w.feat[key(x, y)]);
const isBeltV = (v) => v >= 1 && v <= 4;
const kindOf = (v) => (isBeltV(v) ? "BELT" : v === 5 ? "GLIDE" : v === 6 ? "BLOOM" : v === 7 ? "PLATE" : null);
export function tierOf(w) { const t = w.featTier != null ? w.featTier : w.heat; return t < 0 ? 0 : t > 2 ? 2 : t | 0; }
const PM = [0.85, 1, 1.15];
/* the spec of one feature tile in this frame (shared by 2D and 3D) */
export function cellSpec(w, x, y) {
  const v = w.feat[key(x, y)], k = kindOf(v), h = tierOf(w);
  const s = { kind: k, h };
  if (k === "BELT") {
    s.dir = v - 1;
    const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][s.dir];
    s.exit = featAt(w, x + dx, y + dy) !== v;
    const vv = FEAT_PROFILE[h].belt.v * PM[Math.max(-1, Math.min(1, w.pace | 0)) + 1];
    s.phase = Math.floor(((w.featT || 0) * vv * TL) % 40);
  } else if (k === "GLIDE") {
    s.gx = x; s.gy = y;
    s.outer = ["N", "E", "S", "W"].filter((sd, i) => { const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][i]; return featAt(w, x + dx, y + dy) !== 5; });
  } else {
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
  return [s.kind, s.h, s.dir, s.exit ? 1 : 0, s.phase, s.outer && s.outer.join(""), s.state, s.lit, s.kind === "GLIDE" ? s.gx + "," + s.gy : ""].join("|");
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
