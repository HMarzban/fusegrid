/* THROWAWAY PROTOTYPE (2026-10-21 tile round, detail pass 2026-10-23):
   CLASSIC 2D painter for the world.feat layer, art approach C (03-art.md).
   A tile is a flush, slightly recessed floor INLAY: a material bed (belt
   rubber, polished ice, leaf mat, engraved plate, water, rippled sand,
   carved portal, iron grate), board-space top-left key light (shadow on the
   N/W inner lip, a lit sliver on the S/E lip, AO at the inlay edge), then
   the marks in the biome's mark slot, then the heat edge. Heat = EDGE
   (keyline / dashed / hazard band) + DENSITY (1/2/3 marks) + VALUE + TIP,
   never hue. No new hex: every tone is a biome slot, a slot-to-slot mix, or
   #000 at alpha (the renderer's own shade). A feature tile REPLACES the
   floor drawImage with one baked 40x40 frame (0 extra draws); without a DOM
   it paints the same vectors in place. o.m = marks only (coverage count). */
import { CFG, key, biomeOf } from "../../src/core/config.js";
import { FEAT_PROFILE } from "../../src/core/feat.js";

const TL = CFG.TILE, C = CFG.COLS, R = CFG.ROWS;
const DARK = { ICE: "wall", SAND: "bg1" };
const NATURAL = new Set(["JUNGLE", "WATER", "SAND"]);
const SIDES = ["N", "E", "S", "W"];
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
export const mix = (top, bot, a) => { const t = rgb(top), b = rgb(bot); return hex(t.map((v, i) => v * a + b[i] * (1 - a))); };
const TONES = new Map();
export function tones(b, h) {
  const k = b.name + h;
  if (TONES.has(k)) return TONES.get(k);
  const m = DARK[b.name] ? b[DARK[b.name]] : b.wallHi;
  const sheet = b.name === "SAND" ? mix(b.bg1, b.floor1, 0.3) : b.floor1;
  const t = { sheet, hole: b.bg1, band: DARK[b.name] ? b.floor0 : b.bg1, key: mix(m, sheet, 0.4), full: m,
    mk: (DARK[b.name] ? [mix(m, sheet, 0.68), mix(m, sheet, 0.84), m] : [mix(m, sheet, 0.5), mix(m, sheet, 0.72), m])[h],
    dark: !!DARK[b.name], dim: mix(m, sheet, 0.22), natural: NATURAL.has(b.name),
    lite: mix(b.wallHi, sheet, 0.5), deep: mix(b.bg1, sheet, 0.55) };
  TONES.set(k, t);
  return t;
}
/* deterministic hash in [0,1) (render-side only, never world.rng) */
const hsh = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const caps = (c, h) => { c.lineCap = h === 0 ? "round" : h === 1 ? "square" : "butt"; c.lineJoin = h === 0 ? "round" : h === 1 ? "bevel" : "miter"; };
const SL = { N: [0, 0.75, 40, 0.75], S: [0, 39.25, 40, 39.25], W: [0.75, 0, 0.75, 40], E: [39.25, 0, 39.25, 40] };
const SR = { N: [0, 0, 40, 5], S: [0, 35, 40, 5], W: [0, 0, 5, 40], E: [35, 0, 5, 40] };
function line(c, x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
function fa(c, a, fn) { const g = c.globalAlpha; c.globalAlpha = g * a; fn(); c.globalAlpha = g; }
function rect(c, col, x, y, w, h) { c.fillStyle = col; c.fillRect(x, y, w, h); }
/* edge by heat: CORE soft keyline, PLUS dashed (6 on 4 off, period 10 so a
   run's dashes meet across tiles), MAX hazard band (HATCH built / TEETH
   natural) with a 1-unit inner shadow where the band meets the bed */
export function edge(c, t, h, side, force, o) {
  const hh = force != null ? force : h, m = o && o.m;
  c.save();
  if (hh === 0) { c.strokeStyle = t.key; c.lineWidth = 1.5; line(c, ...SL[side]); c.restore(); return; }
  if (hh === 1) {
    const [x1, y1, x2, y2] = SL[side].map((v) => (v === 0.75 ? 1.25 : v === 39.25 ? 38.75 : v));
    if (!m) { c.strokeStyle = "#000"; c.globalAlpha = 0.3; c.lineWidth = 2.5; c.setLineDash && c.setLineDash([6, 4]); c.lineDashOffset = -0.6; line(c, x1 + (side === "N" || side === "S" ? 0 : 0.6), y1 + (side === "N" || side === "S" ? 0.6 : 0), x2 + (side === "N" || side === "S" ? 0 : 0.6), y2 + (side === "N" || side === "S" ? 0.6 : 0)); c.globalAlpha = 1; }
    c.strokeStyle = t.mk; c.lineWidth = 2.5; c.setLineDash && c.setLineDash([6, 4]); c.lineDashOffset = 0; line(c, x1, y1, x2, y2); c.setLineDash && c.setLineDash([]);
    c.restore(); return;
  }
  const [rx, ry, rw, rh] = SR[side];
  if (!m) {
    c.fillStyle = t.band; c.fillRect(rx, ry, rw, rh);
    const ins = { N: [0, 5, 40, 1], S: [0, 34, 40, 1], W: [5, 0, 1, 40], E: [34, 0, 1, 40] }[side];
    fa(c, 0.32, () => rect(c, "#000", ...ins));
  }
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
/* board-space light on the inlay: AO + cast shadow on the N/W inner lip, a
   lit sliver + soft AO on the S/E lip, only on outer sides (runs flow) */
function lip(c, t, sides) {
  for (const sd of sides) {
    const g = sd === "N" ? c.createLinearGradient(0, 0, 0, 6) : sd === "W" ? c.createLinearGradient(0, 0, 6, 0) : sd === "S" ? c.createLinearGradient(0, 40, 0, 36) : c.createLinearGradient(40, 0, 36, 0);
    const lead = sd === "N" || sd === "W";
    g.addColorStop(0, lead ? "rgba(0,0,0,0.42)" : "rgba(0,0,0,0.16)"); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.fillRect(0, 0, 40, 40);
    if (!lead) fa(c, 0.55, () => rect(c, t.lite, ...(sd === "S" ? [0, 38.2, 40, 0.9] : [38.2, 0, 0.9, 40])));
  }
}
/* a gentle top-left key across the bed (lighter TL, darker BR) */
function sheen(c, t, a = 1) {
  const g = c.createLinearGradient(0, 0, 40, 40);
  g.addColorStop(0, t.lite); g.addColorStop(0.45, t.sheet); g.addColorStop(1, t.deep);
  fa(c, 0.22 * a, () => { c.fillStyle = g; c.fillRect(0, 0, 40, 40); });
}
const ROT = (c, d) => { c.translate(20, 20); c.rotate((d * Math.PI) / 2); c.translate(-20, -20); };
const L2B = (d, l) => SIDES[(SIDES.indexOf(l) + d) % 4];

/* ---- CONVEYOR (BELT, FACTORY): rubber belt with transverse tread between
   riveted steel rails. Local E = downstream. The tread and chevrons
   translate by phase; rails, rivets and the exit cap are board-fixed (the
   3D shader scrolls only the band |across| < 0.35). CORE: 16-unit bomb
   groove between inner rails over brushed deck plate. */
function belt(c, b, t, s, o) {
  const h = s.h, m = o.m, inner = h === 0, b0 = inner ? 12 : 6, b1 = inner ? 28 : 34;
  const rub = mix(b.bg1, t.sheet, 0.62), plate = t.sheet, steel = mix(b.wall, t.sheet, 0.5), sHi = mix(b.wallHi, steel, 0.3), sLo = mix(b.bg1, steel, 0.5);
  c.save(); ROT(c, s.dir);
  if (!m) {
    rect(c, plate, 0, 0, 40, 40);
    if (inner) { c.lineWidth = 0.5; for (let y = 1.5; y < 40; y += 2) { c.strokeStyle = (y | 0) % 4 < 2 ? t.lite : t.deep; fa(c, 0.13, () => line(c, 0, y, 40, y)); } }
    rect(c, rub, 0, b0, 40, b1 - b0);
    const ph = (s.phase || 0) % 5;
    for (let x = -5 + ph; x < 41; x += 5) {
      fa(c, 0.5, () => rect(c, mix(b.bg1, rub, 0.6), x, b0, 1.6, b1 - b0));
      fa(c, 0.35, () => rect(c, mix(b.wall, rub, 0.3), x - 0.8, b0, 0.8, b1 - b0));
    }
    for (let i = 0; i < 14; i++) { const x = (hsh(i, 7, 3) * 40 + (s.phase || 0)) % 40, y = b0 + 1 + hsh(i, 9, 5) * (b1 - b0 - 2); fa(c, 0.18, () => rect(c, i & 1 ? t.lite : b.bg1, x, y, 0.9, 0.9)); }
    fa(c, 0.5, () => { rect(c, "#000", 0, b0, 40, 1.4); rect(c, "#000", 0, b1 - 0.8, 40, 0.8); });
  }
  const n = h + 1, sp = 40 / n;
  c.strokeStyle = t.mk; c.lineWidth = 3.2; caps(c, h);
  for (let i = -1; i <= n; i++) {
    const cx = sp * (i + 0.5) + ((s.phase || 0) % sp), a = h === 2 ? 5 : h ? 6 : 4, w = h === 2 ? 4 : 5;
    if (!m) { c.save(); c.strokeStyle = "#000"; c.globalAlpha = 0.35; c.beginPath(); c.moveTo(cx - w + 0.7, 20 - a - 1.3); c.lineTo(cx + w - 0.3, 20.7); c.lineTo(cx - w + 0.7, 20 + a + 2.7); c.stroke(); c.restore(); }
    c.beginPath(); c.moveTo(cx - w, 20 - a - 2); c.lineTo(cx + w - 1, 20); c.lineTo(cx - w, 20 + a + 2); c.stroke();
  }
  c.restore();
  /* rails in board space so the key stays top-left whatever the direction */
  const rails = [L2B(s.dir, "N"), L2B(s.dir, "S")];
  if (!m) {
    for (const sd of rails) {
      const near = sd === "N" || sd === "W", lo = h === 2 ? 5 : inner ? 8 : 1, hi = h === 2 ? 8 : inner ? 12 : 6;
      const [x, y, w, hh] = sd === "N" ? [0, lo, 40, hi - lo] : sd === "S" ? [0, 40 - hi, 40, hi - lo] : sd === "W" ? [lo, 0, hi - lo, 40] : [40 - hi, 0, hi - lo, 40];
      rect(c, steel, x, y, w, hh);
      const hz = sd === "N" || sd === "S";
      fa(c, 0.9, () => rect(c, sHi, x, y, hz ? 40 : 0.8, hz ? 0.8 : 40));
      fa(c, 0.8, () => rect(c, sLo, hz ? x : x + w - 0.8, hz ? y + hh - 0.8 : y, hz ? 40 : 0.8, hz ? 0.8 : 40));
      if (hh >= 3) for (let k = 5; k < 40; k += 10) {
        const [rx, ry] = hz ? [k - 0.9, y + hh / 2 - 0.9] : [x + w / 2 - 0.9, k - 0.9];
        rect(c, sLo, rx, ry, 1.8, 1.8); fa(c, 0.9, () => rect(c, sHi, rx, ry, 0.9, 0.9));
      }
      void near;
    }
    lip(c, t, s.outer || rails);
  }
  if (h) for (const sd of rails) edge(c, t, h, sd, null, o);
  else if (!m) for (const sd of rails) {
    c.strokeStyle = t.key; c.lineWidth = 1.2;
    const v = sd === "N" || sd === "W" ? 12 : 28;
    if (sd === "N" || sd === "S") line(c, 0, v, 40, v); else line(c, v, 0, v, 40);
  }
  if (s.exit) edge(c, t, h, L2B(s.dir, "E"), h === 0 ? 0 : h, o);
}

/* ---- ICE PATCH (GLIDE, ICE): polished ice. A board-space inner-light band
   (continuous across the sheet), hairline scratches, frost at the rim, and
   the dark streak marks cut INTO the ice (dark groove + lit lower lip). */
function glide(c, b, t, s, o) {
  const h = s.h, m = o.m, X = s.gx * 40, Y = s.gy * 40;
  if (!m) {
    rect(c, t.sheet, 0, 0, 40, 40);
    const g = c.createLinearGradient(0, 0, 40, 40);
    for (let i = 0; i <= 4; i++) { const u = i / 4, v = 0.5 + 0.5 * Math.sin(((X + Y + u * 80) / 150) * Math.PI * 2); g.addColorStop(u, v > 0.5 ? b.wallHi : t.sheet); }
    fa(c, 0.2, () => { c.fillStyle = g; c.fillRect(0, 0, 40, 40); });
    sheen(c, t, 0.45);
    c.lineWidth = 0.5;
    for (let i = 0; i < 7; i++) {
      const x = hsh(s.gx, s.gy, i) * 40, y = hsh(s.gy, i, s.gx + 3) * 40, a = (hsh(i, s.gx, s.gy) - 0.5) * 1.2 - 0.785, l = 3 + hsh(i, 2, s.gy) * 7;
      c.strokeStyle = b.wallHi; fa(c, 0.32, () => line(c, x, y, x + Math.cos(a) * l, y + Math.sin(a) * l));
    }
    c.strokeStyle = b.wallHi; c.lineWidth = 0.9; fa(c, 0.5, () => { line(c, 4, 9, 10, 3); line(c, 5.5, 12, 13, 4.5); });
    for (const sd of s.outer) for (let i = 0; i < 9; i++) {
      const u = hsh(i, SIDES.indexOf(sd), s.gx * 13 + s.gy) * 40, d = 1 + hsh(s.gy, i, 9) * 4, [x, y] = sd === "N" ? [u, d] : sd === "S" ? [u, 40 - d] : sd === "W" ? [d, u] : [40 - d, u];
      fa(c, 0.4, () => rect(c, b.wallHi, x, y, 0.9, 0.9));
    }
  }
  const sp = [40, 20, 40 / 3][h], off = ((s.gx + s.gy) * 40) % sp;
  caps(c, h); c.setLineDash && c.setLineDash([11, 9]); c.lineDashOffset = (s.gx * 7 + s.gy * 3) % 20;
  if (!m) { c.strokeStyle = b.wallHi; c.lineWidth = 1; fa(c, 0.45, () => { for (let k = -80 - off; k < 80; k += sp) line(c, k + 1.3, 40.2, k + 41.3, 0.2); }); }
  c.strokeStyle = t.mk; c.lineWidth = 2;
  for (let k = -80 - off; k < 80; k += sp) line(c, k, 40, k + 40, 0);
  c.setLineDash && c.setLineDash([]);
  if (!m) lip(c, t, s.outer);
  for (const sd of s.outer) edge(c, t, h, sd, null, o);
}

/* ---- BOOSTER (BLOOM, JUNGLE): a living leaf inlay. Moss bed with a faint
   vein network, four diagonal leaves per ring (an x, never a +), each with a
   mark-tone midrib and side veins; rings = density. Flare / cooldown keep
   the prototype's states. */
function leaf(c, d0, d1, wdt, h) {
  const tip = h === 0 ? 0.55 : h === 1 ? 0.3 : 0;
  c.beginPath(); c.moveTo(d0, 0);
  c.quadraticCurveTo((d0 + d1) / 2, -wdt, d1 - tip, -tip * 0.6);
  if (tip) c.quadraticCurveTo(d1, 0, d1 - tip, tip * 0.6); else c.lineTo(d1, 0);
  c.quadraticCurveTo((d0 + d1) / 2, wdt, d0, 0); c.closePath();
}
function bloom(c, b, t, s, o) {
  const h = s.h, m = o.m, flare = s.state === 1, cool = s.state === 2, tf = flare ? tones(b, 2) : t;
  if (!m) {
    rect(c, t.sheet, 0, 0, 40, 40);
    sheen(c, t);
    c.lineWidth = 0.7; c.strokeStyle = b.bg1;
    fa(c, 0.4, () => { for (let i = 0; i < 4; i++) { const a = (i + 0.5) * Math.PI / 2 + 0.35; c.beginPath(); c.moveTo(20, 20); c.quadraticCurveTo(20 + Math.cos(a) * 9, 20 + Math.sin(a) * 9, 20 + Math.cos(a + 0.4) * 19, 20 + Math.sin(a + 0.4) * 19); c.stroke(); } });
    for (let i = 0; i < 26; i++) { const x = hsh(i, 1, 6) * 40, y = hsh(i, 2, 6) * 40, l = 1.2 + hsh(i, 3, 6) * 1.6; c.save(); c.translate(x, y); c.rotate(hsh(i, 4, 6) * 6.28); fa(c, 0.5, () => { c.fillStyle = i % 3 ? b.floor0 : mix(b.wallHi, t.sheet, 0.25); leaf(c, 0, l * 1.6, l * 0.5, 2); c.fill(); }); c.restore(); }
  }
  c.save(); c.translate(20, 20);
  const rings = cool ? 1 : h + 1, len = [9, 5.6, 4.4][h], gap = [0, 0.4, 0.2][h], wdt = [3.4, 2.7, 2.4][h];
  for (const r of [45, 135, 225, 315]) {
    c.save(); c.rotate((r * Math.PI) / 180);
    for (let i = 0; i < rings; i++) {
      const d0 = 3 + i * (len + gap), d1 = d0 + (cool ? 4 : len);
      if (!m) { c.save(); c.translate(0.7, 0.7); c.fillStyle = "#000"; fa(c, 0.3, () => { leaf(c, d0, d1, cool ? 1 : wdt, h); c.fill(); }); c.restore(); }
      if (!m) { c.fillStyle = cool ? t.dim : mix(b.floor0, b.wallHi, flare ? 0.55 : 0.72); leaf(c, d0, d1, cool ? 1 : wdt, h); c.fill(); }
      c.strokeStyle = cool ? t.dim : flare ? tf.full : t.mk; c.lineWidth = h === 2 ? 1.3 : 1.5; caps(c, h);
      line(c, d0, 0, d1 - 0.4, 0);
      if (!cool) { c.lineWidth = 0.8; for (const f of len > 6 ? [0.38, 0.62] : [0.5]) { const x = d0 + (d1 - d0) * f; line(c, x, 0, x + 1.4, -wdt * 0.55); line(c, x, 0, x + 1.4, wdt * 0.55); } }
    }
    c.restore();
  }
  if (!m) { rect(c, b.bg1, -1.6, -1.6, 3.2, 3.2); fa(c, 0.8, () => rect(c, t.mk, -1.6, -1.6, 1, 1)); }
  if (h === 2 && !flare && !cool) for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { c.fillStyle = t.mk; c.beginPath(); c.moveTo(sx * 17, sy * 17); c.lineTo(sx * 13.2, sy * 15.8); c.lineTo(sx * 15.8, sy * 13.2); c.closePath(); c.fill(); }
  c.restore();
  if (!m) lip(c, t, s.outer || SIDES);
  for (const sd of SIDES) edge(c, tf, h, sd, flare ? 2 : h, o);
}

/* ---- TRAP (PLATE, ARENA): an engraved, brushed metal plate set flush in
   the floor, four square bolt heads, an engraved double border, the two
   inward chevrons cut in (dark groove + lit lip), side ticks = density,
   and the 4-segment wind-up timer on the frame (clockwise from N). */
function plate(c, b, t, s, o) {
  const h = s.h, m = o.m, lit = s.lit || 0, cool = s.state === 2;
  const met = mix(b.wall, t.sheet, 0.42), mHi = mix(b.wallHi, met, 0.3), mLo = mix(b.bg1, met, 0.5);
  if (!m) {
    rect(c, t.sheet, 0, 0, 40, 40); sheen(c, t, 0.7);
    fa(c, 0.4, () => rect(c, "#000", 7, 7, 26, 26));
    rect(c, met, 8, 8, 24, 24);
    c.lineWidth = 0.5; for (let y = 8.6; y < 32; y += 1.2) { c.strokeStyle = (y * 5 | 0) % 3 ? mHi : mLo; fa(c, 0.16, () => line(c, 8, y, 32, y)); }
    const g = c.createLinearGradient(8, 8, 32, 32); g.addColorStop(0, mHi); g.addColorStop(0.5, met); g.addColorStop(1, mLo);
    fa(c, 0.35, () => { c.fillStyle = g; c.fillRect(8, 8, 24, 24); });
    fa(c, 0.9, () => { rect(c, mHi, 8, 31.2, 24, 0.8); rect(c, mHi, 31.2, 8, 0.8, 24); rect(c, mLo, 8, 8, 24, 0.8); rect(c, mLo, 8, 8, 0.8, 24); });
    c.lineWidth = 0.7; c.strokeStyle = mLo; c.strokeRect(11.2, 11.2, 17.6, 17.6); c.strokeStyle = mHi; fa(c, 0.6, () => c.strokeRect(11.9, 11.9, 17.6, 17.6));
    for (const [x, y] of [[9.4, 9.4], [28.2, 9.4], [9.4, 28.2], [28.2, 28.2]]) { rect(c, mLo, x, y, 2.4, 2.4); rect(c, mHi, x, y, 1.2, 1.2); fa(c, 0.6, () => rect(c, "#000", x + 1.6, x === y ? y + 1.6 : y + 1.6, 0.8, 0.8)); }
  }
  if (h === 2) for (const sd of SIDES) edge(c, t, h, sd, null, o);
  if (h < 2) {
    c.strokeStyle = h ? t.mk : t.key; c.lineWidth = h ? 2.2 : 1.5; caps(c, h);
    if (h === 1) c.setLineDash && c.setLineDash([5, 4]);
    c.strokeRect(8, 8, 24, 24);
    c.setLineDash && c.setLineDash([]);
  }
  c.fillStyle = t.mk;
  const r = h + 1;
  for (let i = 0; i < r; i++) { const q = 20 + (i - (r - 1) / 2) * 5 - 1; c.fillRect(q, 8, 2, 3); c.fillRect(q, 29, 2, 3); c.fillRect(8, q, 3, 2); c.fillRect(29, q, 3, 2); }
  const chev = (dx) => { c.beginPath(); c.moveTo(20 - 7.5 * dx + dx * 0, 15); c.lineTo(20 - 2.5 * dx, 20); c.lineTo(20 - 7.5 * dx, 25); c.stroke(); };
  if (!m) { c.save(); c.strokeStyle = mLo; c.lineWidth = 3.4; chev(1); chev(-1); c.translate(0.6, 0.6); c.strokeStyle = mHi; c.lineWidth = 2.6; fa(c, 0.5, () => { chev(1); chev(-1); }); c.restore(); }
  c.strokeStyle = cool ? t.dim : t.mk; c.lineWidth = 2.4; chev(1); chev(-1);
  if (lit) [[15, 1.5, 10, 3.5], [35, 15, 3.5, 10], [15, 35, 10, 3.5], [1.5, 15, 3.5, 10]].forEach(([x, y, w, hh], i) => rect(c, i < lit ? t.full : t.dim, x, y, w, hh));
  if (!m) lip(c, t, s.outer || SIDES);
}

/* ---- STREAM (WATER): a flowing channel. Shallows toward the banks, a
   deep centre, an angular caustic web (polylines, never cells or rings)
   that translates with the flow, dash + arrowhead rows (1 / 2 / 3), banks =
   the two side edges. Local E = downstream. */
const CAUS = (() => {
  const p = [], ys = [3, 9, 15, 21, 27, 33, 39], pt = (j, i) => [i * 8 + (hsh(i, j, 8) - 0.5) * 3, ys[j] + (hsh(j, i, 9) - 0.5) * 3.5];
  for (let j = 0; j < ys.length; j++) { const row = []; for (let i = 0; i <= 5; i++) row.push(pt(j, i % 5 === 0 && i ? 0 : i).map((v, k) => (k === 0 && i === 5 ? v + 40 : v))); p.push(row); }
  for (let j = 0; j < ys.length - 1; j++) for (let i = (j & 1); i < 5; i += 2) p.push([pt(j, i), pt(j + 1, i)]);
  return p; })();
function stream(c, b, t, s, o) {
  const h = s.h, m = o.m, ph = (s.phase || 0) % 40;
  c.save(); ROT(c, s.dir);
  if (!m) {
    rect(c, t.sheet, 0, 0, 40, 40);
    const g = c.createLinearGradient(0, 0, 0, 40);
    g.addColorStop(0, b.floor0); g.addColorStop(0.3, t.sheet); g.addColorStop(0.5, t.deep); g.addColorStop(0.7, t.sheet); g.addColorStop(1, b.floor0);
    fa(c, 0.75, () => { c.fillStyle = g; c.fillRect(0, 0, 40, 40); });
    c.lineWidth = 0.7; c.lineJoin = "miter"; c.strokeStyle = mix(b.wallHi, t.sheet, 0.5);
    for (const dx of [ph - 40, ph]) fa(c, 0.26, () => { for (const pts of CAUS) { c.beginPath(); pts.forEach(([x, y], j) => (j ? c.lineTo(x + dx, y) : c.moveTo(x + dx, y))); c.stroke(); } });
    c.lineWidth = 0.5; c.strokeStyle = b.wallHi;
    for (const dx of [ph - 40, ph]) fa(c, 0.3, () => { for (let i = 0; i < 6; i++) { const x = hsh(i, 5, 2) * 40 + dx, y = 6 + hsh(i, 6, 2) * 28; line(c, x, y, x + 3 + hsh(i, 7, 2) * 3, y); } });
  }
  const rows = [[20], [13, 27], [10, 20, 30]][h];
  rows.forEach((y, j) => {
    const x0 = (6 + j * 11 + ph) % 40;
    for (const xb of h === 2 ? [x0, x0 + 20] : [x0]) for (const xx of [xb - 40, xb]) {
      const head = () => { c.beginPath(); if (h === 0) { c.moveTo(xx + 9, y - 3.2); c.quadraticCurveTo(xx + 14.5, y, xx + 9, y + 3.2); } else { c.moveTo(xx + 9, y - 3.5); c.lineTo(xx + (h === 2 ? 14.5 : 13.5), y); c.lineTo(xx + 9, y + 3.5); } c.closePath(); c.fill(); };
      if (!m) { c.save(); c.translate(0.6, 0.8); c.fillStyle = c.strokeStyle = b.bg1; c.globalAlpha = 0.45; c.lineWidth = 2; caps(c, h); line(c, xx, y, xx + 9, y); head(); c.restore(); }
      c.strokeStyle = c.fillStyle = t.mk; c.lineWidth = 2; caps(c, h); line(c, xx, y, xx + 9, y); head();
    }
  });
  c.restore();
  const banks = [L2B(s.dir, "N"), L2B(s.dir, "S")].filter((sd) => !s.outer || s.outer.includes(sd));
  if (!m) lip(c, t, s.outer || banks);
  for (const sd of banks) edge(c, t, h, sd, null, o);
}

/* ---- QUICKSAND (SAND): rippled sand. The dark-polarity bed (floor1 pulled
   to bg1, the SAND brick fix), soft wind-ripple bands, grain speckle, a
   slow funnel pull toward the centre (darker, ripples bowing in), 1-3 dark
   ripple arcs as the marks (open strokes, never closed rings). */
function quick(c, b, t, s, o) {
  const h = s.h, m = o.m;
  if (!m) {
    rect(c, t.sheet, 0, 0, 40, 40); sheen(c, t, 0.9);
    for (let i = 0; i < 9; i++) {
      const y = 2 + i * 4.6, bow = (Math.abs(y - 20) < 14 ? 1 : 0.3) * (y < 20 ? 1.8 : -1.8);
      c.lineWidth = 1.6; c.strokeStyle = b.floor0;
      fa(c, 0.15, () => { c.beginPath(); c.moveTo(0, y); c.quadraticCurveTo(10, y - 1.2, 20, y + bow); c.quadraticCurveTo(30, y - 1.2, 40, y); c.stroke(); });
      c.lineWidth = 0.8; c.strokeStyle = mix(b.bg1, t.sheet, 0.2);
      fa(c, 0.3, () => { c.beginPath(); c.moveTo(0, y + 1.4); c.quadraticCurveTo(10, y + 0.2, 20, y + bow + 1.4); c.quadraticCurveTo(30, y + 0.2, 40, y + 1.4); c.stroke(); });
    }
    for (let i = 0; i < 150; i++) { const x = hsh(i, 3, 1) * 40, y = hsh(i, 4, 1) * 40, z = i % 7 === 0 ? 1.1 : 0.6; fa(c, 0.3 + hsh(i, 5, 1) * 0.25, () => rect(c, i % 3 ? mix(b.bg1, t.sheet, 0.2) : i % 2 ? b.floor0 : b.wallHi, x, y, z, z)); }
    for (let k = 0; k < 3; k++) { const d = 9 + k * 3.5; fa(c, 0.16, () => rect(c, mix(b.bg1, t.sheet, 0.2), d, d, 40 - 2 * d, 40 - 2 * d)); }
  }
  if (s.state !== 2) {
    const rip = [[22, 1], [13, 1], [31, 1]];
    const x0 = h === 2 ? 8 : 5, x1 = 40 - x0, xm = 20;
    c.strokeStyle = t.mk; c.lineWidth = h === 2 ? 1.5 : 2; caps(c, h);
    for (let i = 0; i <= h; i++) {
      const [y] = rip[i], drawR = (dy) => { c.beginPath(); c.moveTo(x0, y + dy); c.quadraticCurveTo((x0 + xm) / 2, y - 6 + dy, xm, y + dy); c.quadraticCurveTo((xm + x1) / 2, y + 6 + dy, x1, y + dy); c.stroke(); };
      if (!m) { c.save(); c.strokeStyle = b.floor0; c.globalAlpha = 0.5; c.lineWidth = 1; drawR(1.6); c.restore(); }
      drawR(0);
    }
  }
  if (!m) lip(c, t, s.outer);
  for (const sd of s.outer) edge(c, t, h, sd, null, o);
}

/* ---- PORTAL (VOID): a carved stone frame around a deep, glowing core. The
   frame is the wall slot with a top-left bevel; the core falls off in
   NESTED SQUARES (never a radial disc). Nested square marks = density,
   corner brackets always lit, pair id = tick count. */
function portal(c, b, t, s, o) {
  const h = s.h, m = o.m;
  const st = mix(b.wall, t.sheet, 0.6), sHi = mix(b.wallHi, st, 0.38), sLo = b.bg1;
  if (!m) {
    rect(c, t.sheet, 0, 0, 40, 40);
    rect(c, st, 6, 6, 28, 28);
    fa(c, 0.9, () => { rect(c, sHi, 6, 6, 28, 0.9); rect(c, sHi, 6, 6, 0.9, 28); rect(c, sLo, 6, 33.1, 28, 0.9); rect(c, sLo, 33.1, 6, 0.9, 28); });
    for (const [x, y, w, hh] of [[13, 6, 0.7, 3], [26, 31, 0.7, 3], [6, 24, 3, 0.7], [31, 15, 3, 0.7]]) fa(c, 0.7, () => rect(c, sLo, x, y, w, hh));
    for (let i = 0; i < 18; i++) { const u = hsh(i, 1, 4) * 28 + 6, v = hsh(i, 2, 4); const [x, y] = i % 4 === 0 ? [u, 6 + v * 3.5] : i % 4 === 1 ? [u, 30.5 + v * 3.5] : i % 4 === 2 ? [6 + v * 3.5, u] : [30.5 + v * 3.5, u]; fa(c, 0.35, () => rect(c, i & 1 ? sHi : sLo, x, y, 0.8, 0.8)); }
    rect(c, sLo, 10, 10, 20, 20);
    for (let k = 0; k < 6; k++) { const d = 11 + k * 1.5; fa(c, 0.05 + k * 0.024, () => rect(c, b.wallHi, d, d, 40 - 2 * d, 40 - 2 * d)); }
    fa(c, 0.55, () => { rect(c, "#000", 10, 10, 20, 2.2); rect(c, "#000", 10, 10, 2.2, 20); });
    fa(c, 0.6, () => { rect(c, sHi, 10, 29.3, 20, 0.7); rect(c, sHi, 29.3, 10, 0.7, 20); });
  }
  const ins = [[13], [12, 15.5], [11.5, 14, 16.5]][h];
  ins.forEach((d, i) => { const mk = i === ins.length - 1; if (!mk && m) return; c.strokeStyle = mk ? t.mk : t.dim; c.lineWidth = 1.6; caps(c, h); c.strokeRect(d, d, 40 - 2 * d, 40 - 2 * d); });
  if (!m) rect(c, t.full, 18.6, 18.6, 2.8, 2.8);
  if (h === 2) for (const sd of SIDES) edge(c, t, h, sd, null, o);
  else for (const sd of s.outer) edge(c, t, h, sd, null, o);
  c.strokeStyle = t.mk; c.lineWidth = 1.8; caps(c, Math.min(h, 1));
  for (const d of [[4.5, 10, 4.5, 4.5, 10, 4.5], [30, 4.5, 35.5, 4.5, 35.5, 10], [35.5, 30, 35.5, 35.5, 30, 35.5], [10, 35.5, 4.5, 35.5, 4.5, 30]]) { c.beginPath(); c.moveTo(d[0], d[1]); c.lineTo(d[2], d[3]); c.lineTo(d[4], d[5]); c.stroke(); }
  c.fillStyle = t.mk;
  for (let i = 0; i < (s.pair || 1); i++) c.fillRect(18.9 + (i - ((s.pair || 1) - 1) / 2) * 4, h === 2 ? 6.6 : 6.2, 2.2, 2.6);
  if (!m) lip(c, t, s.outer);
}

/* ---- GATE (CROWN, open): an iron portcullis grate sunk in a stone kerb.
   Kerb = wall slot with joints and a top-left bevel; the pit is bg1; three
   iron uprights, crossbars = density, each crossbar's top lit in the mark
   tone (thin gilt strokes only, never a filled gold area). Timer: 4
   segments clockwise from N, inset inside the band at MAX. Shut = WALL
   lane, not drawn here. */
function gate(c, b, t, s, o) {
  const h = s.h, m = o.m;
  const st = mix(b.wall, t.sheet, 0.55), sHi = mix(b.wallHi, st, 0.3), sLo = mix(b.bg1, st, 0.55);
  const iron = mix(b.bg1, b.wall, 0.55), iHi = mix(b.wallHi, iron, 0.22), iLo = b.bg1;
  if (!m) {
    rect(c, t.sheet, 0, 0, 40, 40); sheen(c, t, 0.6);
    rect(c, st, 6, 6, 28, 28);
    for (let i = 0; i < 40; i++) { const x = 6 + hsh(i, 1, 2) * 28, y = 6 + hsh(i, 2, 2) * 28; fa(c, 0.25, () => rect(c, i & 1 ? sHi : sLo, x, y, 0.8, 0.8)); }
    for (const [x, y, w, hh] of [[17, 6, 0.8, 3], [27, 31, 0.8, 3], [6, 21, 3, 0.8], [31, 14, 3, 0.8]]) rect(c, sLo, x, y, w, hh);
    fa(c, 0.9, () => { rect(c, sHi, 6, 6, 28, 0.9); rect(c, sHi, 6, 6, 0.9, 28); rect(c, sLo, 6, 33.1, 28, 0.9); rect(c, sLo, 33.1, 6, 0.9, 28); });
    rect(c, iLo, 9.5, 9.5, 21, 21);
    fa(c, 0.5, () => { rect(c, "#000", 9.5, 9.5, 21, 2); rect(c, "#000", 9.5, 9.5, 2, 21); });
    for (const x of [13.5, 19, 24.5]) { rect(c, iron, x, 9.5, 2.4, 21); rect(c, iHi, x, 9.5, 0.7, 21); fa(c, 0.8, () => rect(c, iLo, x + 2.4, 9.5, 0.6, 21)); }
  }
  const n = h + 1, gap = 21 / (n + 1);
  for (let i = 1; i <= n; i++) {
    const y = 9.5 + gap * i - 1.1;
    if (!m) { rect(c, iron, 9.5, y, 21, 2.4); fa(c, 0.8, () => rect(c, iLo, 9.5, y + 2.4, 21, 0.6)); for (const x of [13.5, 19, 24.5]) rect(c, iHi, x + 0.6, y + 0.6, 1.2, 1.2); }
    rect(c, t.mk, 9.5, y, 21, h === 2 ? 0.9 : 0.8);
  }
  c.strokeStyle = t.key; c.lineWidth = 1; if (!m) c.strokeRect(9, 9, 22, 22);
  if (h === 2) for (const sd of SIDES) edge(c, t, h, sd, null, o);
  else for (const sd of s.outer) edge(c, t, h, sd, null, o);
  const SEG = h === 2 ? [[16, 6.4, 8, 2.6], [31, 16, 2.6, 8], [16, 31, 8, 2.6], [6.4, 16, 2.6, 8]] : [[16, 1.8, 8, 2.6], [35.6, 16, 2.6, 8], [16, 35.6, 8, 2.6], [1.8, 16, 2.6, 8]];
  SEG.forEach(([x, y, w, hh], i) => rect(c, i < (s.lit || 0) ? t.full : t.dim, x, y, w, hh));
  if (!m) lip(c, t, s.outer);
}

const PAINT = { BELT: belt, GLIDE: glide, BLOOM: bloom, PLATE: plate, STREAM: stream, QUICK: quick, PORTAL: portal, GATE: gate };
/* spec: {kind, h, dir 0..3, exit, phase, outer:[sides], state, lit, gx, gy, pair} */
export function paintCell(c, b, s, o = {}) {
  const t = tones(b, s.h);
  c.save();
  c.beginPath(); c.rect(0, 0, 40, 40); c.clip();
  PAINT[s.kind](c, b, t, s, o);
  c.restore();
}
const featAt = (w, x, y) => (x < 0 || y < 0 || x >= C || y >= R ? 0 : w.feat[key(x, y)]);
const isBeltV = (v) => v >= 1 && v <= 4;
/* render-only codes 8..14 (no sim yet): STREAM E/S/W/N, QUICK, PORTAL, GATE */
const kindOf = (v) => (isBeltV(v) ? "BELT" : v === 5 ? "GLIDE" : v === 6 ? "BLOOM" : v === 7 ? "PLATE" : v >= 8 && v <= 11 ? "STREAM" : v === 12 ? "QUICK" : v === 13 ? "PORTAL" : v === 14 ? "GATE" : null);
export function tierOf(w) { const t = w.featTier != null ? w.featTier : w.heat; return t < 0 ? 0 : t > 2 ? 2 : t | 0; }
const PM = [0.85, 1, 1.15];
const D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
/* the spec of one feature tile in this frame (shared by 2D and 3D) */
export function cellSpec(w, x, y) {
  const v = w.feat[key(x, y)], k = kindOf(v), h = tierOf(w);
  const s = { kind: k, h };
  s.outer = SIDES.filter((sd, i) => kindOf(featAt(w, x + D4[i][0], y + D4[i][1])) !== k);
  if (k === "BELT") {
    s.dir = v - 1;
    const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][s.dir];
    s.exit = featAt(w, x + dx, y + dy) !== v;
    const vv = FEAT_PROFILE[h].belt.v * PM[Math.max(-1, Math.min(1, w.pace | 0)) + 1];
    s.phase = Math.floor(((w.featT || 0) * vv * TL) % 40);
  } else if (k === "STREAM") {
    s.dir = v - 8; s.phase = 0;
  } else if (k === "GATE") {
    s.lit = w.featM ? w.featM[key(x, y)] : 0;
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
  return [s.kind, s.h, s.dir, s.exit ? 1 : 0, s.phase, s.outer && s.outer.join(""), s.state, s.lit, s.pair, s.kind === "GLIDE" ? s.gx + "," + s.gy : ""].join("|");
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
