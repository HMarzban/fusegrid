import { CFG } from "../core/config.js";
import { drawIcon, ITEM_FAMILY, ITEM_RING } from "./icons.js";
import { contact } from "./depth2d.js";
import { itemIdle } from "./motion.js";
import { getFxOpts } from "./fx.js";

/* PICKUP DRAWING (moved out of sprites.js verbatim so the item lane and the foe lane never share a file) */
/* 64² REAL 3D cube face: navy plate + cabinet glyph. Atlas key item_<t>. */
export function paintItemFace(c, type, col) {
  c.fillStyle = "#0b1020";
  c.fillRect(0, 0, 64, 64);
  c.save();
  c.translate(32, 32);
  c.scale(2.35, 2.35);
  drawIcon(c, type, col, 0);
  c.restore();
  c.strokeStyle = "rgba(255,255,255,0.16)";
  c.lineWidth = 2;
  c.beginPath();
  c.rect(2, 2, 60, 60);
  c.stroke();
  c.beginPath();
  c.stroke();
}
/* The ring language a player learns in REAL 3D has to be recognisable in CLASSIC 2D, which has no additive ring at all, so the ring is the family echo.
   The geometry lives in icons.js ITEM_RING (ring weight / dash / tick pattern, so the four families read apart in grayscale at 40 px). Motion is body motion
   only: the ring breathes in radius and the dashes / ticks turn slowly, nothing pulses in luminance. The disc itself never scales (a +-7 % disc blurred its
   outline); the cap family's old whole-disc breathe is now its ring's. Dashes are arcs: the headless stub has no setLineDash. */
export function drawItemChrome(c, fam, t, ph) {
  const T = CFG.TILE, R = ITEM_RING[fam] || ITEM_RING.cap, br = 1 + R.breath * Math.sin(R.bw * t + ph);
  c.lineWidth = R.w;
  for (let i = 0; i < R.rings.length; i++) {
    c.beginPath();
    c.arc(0, 0, T * R.rings[i] * br, 0, 7);
    c.stroke();
  }
  if (R.dash) {
    c.lineWidth = R.dw;
    const a0 = R.spin * t + ph;
    for (let i = 0; i < R.dash; i++) {
      const a = a0 + (i * 2 * Math.PI) / R.dash;
      c.beginPath();
      c.arc(0, 0, T * R.dr, a, a + R.span);
      c.stroke();
    }
  }
  if (R.ticks) {
    c.lineWidth = R.tw;
    const a0 = R.spin * t;
    c.beginPath();
    for (let i = 0; i < R.ticks; i++) {
      const a = a0 + (i * 2 * Math.PI) / R.ticks, co = Math.cos(a), si = Math.sin(a);
      c.moveTo(co * T * R.t0, si * T * R.t0);
      c.lineTo(co * T * R.t1, si * T * R.t1);
    }
    c.stroke();
  }
}
/* spawn pop for a pickup that appears mid-room (a brick broke over it): scale 0.6 -> 1.1 -> 1 over POP_T on the draw clock, no alpha strobe */
export const POP_T = 0.32;
const eo = (v) => 1 - (1 - v) ** 3;
export function popK(age) {
  if (!(age >= 0) || age >= POP_T) return 1;
  const u = age / POP_T;
  return u < 0.55 ? 0.6 + 0.5 * eo(u / 0.55) : 1.1 - 0.1 * eo((u - 0.55) / 0.45);
}
/* the glint sweep (itemIdle().glint 0..1 every 2.8 s): a slanted white band across the disc, clipped to it, scaled by REDUCE FLASH */
function glintBand(c, g, T) {
  const fl = getFxOpts().flashK;
  if (!(fl > 0) || !c.clip) return;
  const r = T * 0.33, x = -r * 1.5 + g * r * 3;
  c.save();
  c.beginPath();
  c.arc(0, 0, r, 0, 7);
  c.clip();
  c.globalAlpha = 0.4 * Math.sin(g * Math.PI) * fl;
  c.fillStyle = "#ffffff";
  c.beginPath();
  c.moveTo(x + 3, -r);
  c.lineTo(x + 8, -r);
  c.lineTo(x - 3, r);
  c.lineTo(x - 8, r);
  c.closePath();
  c.fill();
  c.restore();
}
/* pop: spawn pop scale (1 = none); idle: itemIdle(...) when the caller already has it (drawItems does, for the shadow) */
export function drawItemBody(c, world, it, pop, idle) {
  const T = CFG.TILE,
    t = world.time || 0,
    fam = ITEM_FAMILY[it.t] || "cap";
  /* slot is a compaction index, so collecting one pickup re-indexes its
     neighbours and their animation jumps. Grid phase is stable and is the
     same number the 3D update() writes. */
  const ph = (it.x * 0.7 + it.y * 1.3) / T, id = idle || itemIdle(fam, ph, t);
  if (pop != null && pop !== 1) c.scale(pop, pop);
  c.translate(0, id.dy);
  if (id.rot) c.rotate(id.rot);
  c.fillStyle = "rgba(8,12,24,0.92)";
  c.beginPath();
  c.arc(0, 0, T * 0.34, 0, 7);
  c.fill();
  c.strokeStyle = it.col || "rgba(255,255,255,0.25)";
  c.globalAlpha = 0.85;
  drawItemChrome(c, fam, t, ph);
  c.globalAlpha = 1;
  drawIcon(c, it.t, it.col, t);
  if (id.glint != null) glintBand(c, id.glint, T);
}
/* first-seen time per item on the draw clock, per world + grid: items already on the floor when a room is first drawn never pop, a pickup revealed later does */
const SEEN = new WeakMap();
export function drawItems(c, world) {
  const T = CFG.TILE, t = world.time || 0;
  let st = SEEN.get(world);
  if (!st || st.grid !== world.grid) SEEN.set(world, (st = { grid: world.grid, at: new WeakMap(), fresh: true }));
  for (const it of world.items) {
    if (it.taken || it.buried) continue;
    let t0 = st.at.get(it);
    if (t0 === undefined) st.at.set(it, (t0 = st.fresh ? -1e9 : t));
    const fam = ITEM_FAMILY[it.t] || "cap", id = itemIdle(fam, (it.x * 0.7 + it.y * 1.3) / T, t), pop = popK(t - t0);
    c.save();
    c.translate(it.x, it.y);
    contact(c, T * 0.3 * id.shadow * pop, T * 0.09 * id.shadow * pop, 1.6, T * 0.31, 1.1 * id.shadow);
    drawItemBody(c, world, it, pop, id);
    c.restore();
  }
  st.fresh = false;
}
