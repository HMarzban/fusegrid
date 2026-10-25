/* Frame B, RECESSED WELL (mockup 2026-10-25): lighting and depth around the
   border, never new border art. One module for the three looks, DOM-free except
   the two guarded style writers.
     wellBoard(c, level)   CLASSIC: inner shadow + AO on the playfield edge, a
                           lit lip, outer corner brackets. Baked once per room at
                           2x into an offscreen layer (one drawImage per frame);
                           with no canvas factory (Node) it paints straight.
     wellPx(c, level)      PIXEL: the same read in whole art px, stepped alpha.
     hudPlate(c, px)       the HUD plate carved into the top rampart, overlay
                           layer, before the chips.
     stageGlow(el, level)  a soft biome glow on the canvas box-shadow.
     stageBack(el, level)  REAL 3D: the stage behind the rim, as CSS.
   Colours are the biome's own slots plus black alpha: lip = wallHi, glow =
   brickA (ICE bg0). Light is top-left everywhere. */
import {CFG, BIOMES} from "../core/config.js";
import {slot2d, paintShapes, FAM} from "./wallart.js";
import {bossOf} from "./frameart.js";

const W = CFG.COLS * CFG.TILE, H = CFG.ROWS * CFG.TILE, T = CFG.TILE, S = 2;
const bio = (level) => BIOMES[(Math.max(1, level | 0) - 1) % BIOMES.length];
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (hex, a) => { const [r, g, b] = rgb(hex); return "rgba(" + r + "," + g + "," + b + "," + a + ")"; };

/* the slot a world glows with */
export const glowOf = (level) => { const b = bio(level); return b.name === "ICE" ? b.bg0 : b.brickA; };

function paintWell(c, b, k) {
  if (!c.clip || !c.rect) return;
  const ix = T, iy = T, iw = W - 2 * T, ih = H - 2 * T;
  c.save();
  c.beginPath(); c.rect(ix, iy, iw, ih); c.clip();
  c.fillStyle = "#000000";
  const ring = () => { c.beginPath(); c.rect(-200, -200, W + 400, H + 400); c.rect(ix, iy, iw, ih); c.fill("evenodd"); };
  c.shadowColor = "rgba(0,0,0,0.95)"; c.shadowBlur = 26 * k; c.shadowOffsetX = 7 * k; c.shadowOffsetY = 10 * k; ring();
  c.shadowColor = "rgba(0,0,0,0.7)"; c.shadowBlur = 14 * k; c.shadowOffsetX = 0; c.shadowOffsetY = 0; ring();
  c.restore();
  c.shadowColor = "rgba(0,0,0,0)"; c.shadowBlur = 0;
  const hi = b.wallHi;
  /* lit lip, 3px in from the very edge (the canvas rounds its corners at 10px) */
  c.globalAlpha = 0.62; c.fillStyle = hi;
  c.fillRect(14, 3, W - 28, 2); c.fillRect(3, 14, 2, H - 28);
  c.globalAlpha = 0.34; c.fillRect(14, 5, W - 28, 1); c.fillRect(5, 14, 1, H - 28);
  c.globalAlpha = 0.5; c.fillStyle = "#000000";
  c.fillRect(14, H - 5, W - 28, 2); c.fillRect(W - 5, 14, 2, H - 28);
  /* the well's own rim: a hairline where the rampart meets the floor */
  c.globalAlpha = 0.5; c.fillRect(ix, iy - 1, iw, 1); c.fillRect(ix - 1, iy, 1, ih);
  c.globalAlpha = 0.34; c.fillStyle = hi; c.fillRect(ix, iy + ih, iw, 1); c.fillRect(ix + iw, iy, 1, ih);
  /* outer corner brackets: lit arms top-left, shaded bottom-right */
  const arm = (x, y, w, h, lit) => { c.globalAlpha = lit ? 0.7 : 0.55; c.fillStyle = lit ? hi : "#000000"; c.fillRect(x, y, w, h); };
  arm(7, 7, 12, 3, 1); arm(7, 7, 3, 12, 1);
  arm(W - 19, 7, 12, 3, 1); arm(W - 10, 7, 3, 12, 0);
  arm(7, H - 10, 12, 3, 0); arm(7, H - 19, 3, 12, 1);
  arm(W - 19, H - 10, 12, 3, 0); arm(W - 10, H - 19, 3, 12, 0);
  /* rivets */
  c.globalAlpha = 0.6; c.fillStyle = "#000000";
  for (const [x, y] of [[13, 13], [W - 15, 13], [13, H - 15], [W - 15, H - 15]]) c.fillRect(x, y, 3, 3);
  c.globalAlpha = 0.6; c.fillStyle = hi;
  for (const [x, y] of [[13, 13], [W - 15, 13], [13, H - 15], [W - 15, H - 15]]) c.fillRect(x, y, 1, 1);
  c.globalAlpha = 1;
}

let LAYER = null, LAYER_BI = -1;
function mkLayer() {
  if (typeof document !== "undefined" && document && document.createElement) { const c = document.createElement("canvas"); c.width = W * S; c.height = H * S; return c; }
  return null;
}
export function wellBoard(c, level) {
  const b = bio(level), bi = BIOMES.indexOf(b);
  if (LAYER_BI !== bi) {
    LAYER_BI = bi; LAYER = mkLayer();
    const x = LAYER && LAYER.getContext && LAYER.getContext("2d");
    if (x) { x.scale(S, S); paintWell(x, b, S); } else LAYER = null;
  }
  if (LAYER) c.drawImage(LAYER, 0, 0, W, H);
  else paintWell(c, b, 1);
}

/* PIXEL: native 300x260 art px (1 art px = 2 logical px) */
const NW = W / 2, NH = H / 2;
export function wellPx(c, level) {
  const b = bio(level), hi = b.wallHi, x0 = 20, y0 = 20, x1 = NW - 20, y1 = NH - 20;
  const band = (a, f) => { c.globalAlpha = a; f(); };
  c.fillStyle = "#000000";
  [0.42, 0.3, 0.18, 0.08].forEach((a, i) => band(a, () => c.fillRect(x0, y0 + i, x1 - x0, 1)));
  [0.38, 0.26, 0.15, 0.07].forEach((a, i) => band(a, () => c.fillRect(x0 + i, y0, 1, y1 - y0)));
  [0.26, 0.12].forEach((a, i) => band(a, () => c.fillRect(x0, y1 - 1 - i, x1 - x0, 1)));
  [0.26, 0.12].forEach((a, i) => band(a, () => c.fillRect(x1 - 1 - i, y0, 1, y1 - y0)));
  c.fillStyle = hi;
  band(0.6, () => { c.fillRect(6, 1, NW - 12, 1); c.fillRect(1, 6, 1, NH - 12); });
  c.fillStyle = "#000000";
  band(0.5, () => { c.fillRect(6, NH - 2, NW - 12, 1); c.fillRect(NW - 2, 6, 1, NH - 12); });
  band(0.5, () => { c.fillRect(x0, y0 - 1, x1 - x0, 1); c.fillRect(x0 - 1, y0, 1, y1 - y0); });
  c.fillStyle = hi;
  band(0.32, () => { c.fillRect(x0, y1, x1 - x0, 1); c.fillRect(x1, y0, 1, y1 - y0); });
  const br = (x, y, dx, dy, col, a) => band(a, () => { c.fillStyle = col; c.fillRect(dx > 0 ? x : x - 5, y, 6, 1); c.fillRect(x, dy > 0 ? y : y - 5, 1, 6); });
  br(3, 3, 1, 1, hi, 0.75); br(NW - 4, 3, -1, 1, hi, 0.6); br(3, NH - 4, 1, -1, "#000000", 0.55); br(NW - 4, NH - 4, -1, -1, "#000000", 0.55);
  c.globalAlpha = 1;
}

const mir = (sh) => sh.map((s) => (s.r ? {...s, r: [W - s.r[0] - s.r[2], s.r[1], s.r[2], s.r[3]]} : s.p ? {...s, p: s.p.map(([x, y]) => [W - x, y])} : {...s, s: s.s.map(([x, y]) => [W - x, y])}));
/* REAL 3D plate studs: the world's corner boss, small, in the plate's corners */
function studs(c, b) {
  const L = bossOf(b, 0.8, 7.5);
  c.globalAlpha = 1;
  paintShapes(c, b, L, 0, 0, slot2d);
  paintShapes(c, b, mir(L), 0, 0, slot2d);
}
/* Top corner pieces (CLASSIC + PIXEL): the HUD band (chip panel x 10-588,
   y 10-40, the first heart, the score column) owns both top corner cells and
   the canvas rounds its corners (10 CSS px, about 16 logical on a phone), so
   the corner boss sits where it can show whole: at the plate's foot, on the
   side rail it caps, the bottom corners' own size (bossOf k 1.4, the same
   inset 14 from the outer edge), mirrored right. Its box (x 1-27, y >= 40)
   stays out of the band and off the playfield; the plate rests on it, so
   plate, boss and rail read as one piece. PIXEL samples the same shapes once
   per world into whole art px (2 logical), the walls' own sampler and slot
   remaps, as runs (dyPx keeps the grid even). */
export const TOP_BOSS = Object.freeze({k: 1.4, c: 14, dy: 39, dyPx: 38});
const topBoss = (b) => bossOf(b, TOP_BOSS.k, TOP_BOSS.c);
const inPoly = (x, y, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const segD = (x, y, a, q) => { const dx = q[0] - a[0], dy = q[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); };
const hit = (s, x, y) => s.r ? x >= s.r[0] && y >= s.r[1] && x < s.r[0] + s.r[2] && y < s.r[1] + s.r[3] : s.p ? inPoly(x, y, s.p) : s.s.some((q, i) => i > 0 && segD(x, y, s.s[i - 1], q) <= s.w / 2);
const RUNS = new Map();
function bossRuns(b) {
  let o = RUNS.get(b.name);
  if (o) return o;
  const sh = topBoss(b).filter((s) => !s.npx), map = (FAM[b.name] && FAM[b.name].px) || {};
  const res = (s) => { if (s.includes("|")) s = s.split("|")[1]; return slot2d(b, map[s] || s); };
  o = [];
  for (let y = 0; y < 28; y += 2) {
    let run = null;
    for (let x = 0; x < 28; x += 2) {
      let col = null;
      for (const s of sh) if (hit(s, x + 1, y + 1)) col = res(s.c);
      if (run && run[3] === col) { run[2] += 2; continue; }
      if (run && run[3]) o.push(run);
      run = [x, y, 2, col];
    }
    if (run && run[3]) o.push(run);
  }
  RUNS.set(b.name, o);
  return o;
}
/* the plate's end caps: an L of the world's wall slot over each top corner
   cell's outer margin (x 2-6 down to the plate's foot, clear of the first
   heart's widest PIXEL x2 cell at x 6; y 2-6 along the plate's top) that also
   hides the buried corner cell's boss scraps; lit top / left and shaded
   right / bottom on both sides (light is top-left), running into the boss.
   Painted before the plate, so its round corner seats in the cap (the seat
   squares above the first heart). Even logical px, so PIXEL stays on its art grid. */
export const CAPS = Object.freeze([[2, 2, 4, 38], [2, 2, 16, 4], [6, 6, 6, 4], [6, 10, 2, 6], [W - 6, 2, 4, 38], [W - 18, 2, 16, 4], [W - 12, 6, 6, 4], [W - 8, 10, 2, 6]]);
function caps(c, px, b) {
  const t = px ? 2 : 1;
  c.globalAlpha = 1; c.fillStyle = b.wall;
  for (const [x, y, w, h] of CAPS) c.fillRect(x, y, w, h);
  c.fillStyle = b.wallHi; c.globalAlpha = 0.8;
  for (const x0 of [2, W - 18]) c.fillRect(x0, 2, 16, t);
  for (const x0 of [2, W - 6]) c.fillRect(x0, 2, t, 38);
  c.fillStyle = "#000000"; c.globalAlpha = 0.5;
  for (const x0 of [2, W - 6]) c.fillRect(x0 + 4 - t, 2 + t, t, 38 - t);
  c.fillRect(6, 6 - t, 12, t); c.fillRect(W - 18, 6 - t, 12, t);
  c.globalAlpha = 1;
}
function topBosses(c, px, b) {
  c.globalAlpha = 1;
  if (px) {
    for (const [x, y, w, col] of bossRuns(b)) { c.fillStyle = col; c.fillRect(x, y + TOP_BOSS.dyPx, w, 2); c.fillRect(W - x - w, y + TOP_BOSS.dyPx, w, 2); }
    return;
  }
  const L = topBoss(b);
  paintShapes(c, b, L, 0, TOP_BOSS.dy, slot2d);
  paintShapes(c, b, mir(L), 0, TOP_BOSS.dy, slot2d);
}

/* HUD plate: a dark panel cut into the top rampart, flush with the well edge.
   px = stepped corners in whole art px; else rounded. Overlay layer only. */
export function hudPlate(c, px, level, bare) {
  const x = 8, y = 6, w = W - 16, h = T - 6, b = bio(level);
  c.save();
  if (!bare) caps(c, px, b);
  c.fillStyle = b.bg1; c.globalAlpha = 0.9;
  if (px) { c.fillRect(x + 4, y, w - 8, h); c.fillRect(x + 2, y + 2, w - 4, h - 2); c.fillRect(x, y + 4, w, h - 4); }
  else if (c.arcTo) { c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, y + 6); c.arcTo(x, y, x + 6, y, 6); c.lineTo(x + w - 6, y); c.arcTo(x + w, y, x + w, y + 6, 6); c.lineTo(x + w, y + h); c.closePath(); c.fill(); }
  else c.fillRect(x, y, w, h);
  c.fillStyle = "#000000";
  c.globalAlpha = 0.55; c.fillRect(x + 6, y, w - 12, 2); c.fillRect(x, y + 6, 2, h - 6); c.fillRect(x + w - 2, y + 6, 2, h - 6);
  c.globalAlpha = 0.25; c.fillRect(x + 6, y + 2, w - 12, 2);
  c.globalAlpha = 0.5; c.fillStyle = b.wallHi; if (!bare) c.fillRect(x, y + h - 1, w, 1);
  if (bare) { c.restore(); return; }
  topBosses(c, px, b);
  c.restore();
}

/* REAL 3D: the HUD floats on the stage, so ONE plate is cut from the rim's
   colour: a header band across the top with the same lit lip (top and left
   edges wallHi, shade bottom and right) and the two corner studs. No legs:
   the plate hangs from the top edge only (a, b are unused, kept for the call
   shape). Slots only; wallHi is the brightest it ever gets. */
export function hudPlate3(c, level) {
  const bi = bio(level), x = 8, y = 6, w = W - 16, hb = T - 6;
  c.save();
  c.fillStyle = bi.wall; c.globalAlpha = 0.96;
  c.fillRect(x, y, w, hb);
  c.fillStyle = bi.bg1; c.globalAlpha = 0.42;
  c.fillRect(x + 2, y + 2, w - 4, hb - 4);
  c.fillStyle = bi.wallHi; c.globalAlpha = 0.55;
  c.fillRect(x, y, w, 2); c.fillRect(x, y, 2, hb);
  c.globalAlpha = 0.28; c.fillRect(x, y + 2, w, 1);
  c.fillStyle = "#000000"; c.globalAlpha = 0.5;
  c.fillRect(x, y + hb - 2, w, 2); c.fillRect(x + w - 2, y, 2, hb);
  c.globalAlpha = 1;
  studs(c, bi);
  c.restore();
}

/* the glow: written on change only, never without a style */
const GLOW = new WeakMap();
const RING = "0 0 0 4px #0a0e18";
export function stageGlow(el, level) {
  if (!el || !el.style) return;
  const k = bio(level).name;
  if (GLOW.get(el) === k) return;
  GLOW.set(el, k);
  el.style.boxShadow = RING + ",0 0 64px 10px " + rgba(glowOf(level), 0.32) + ",0 12px 48px rgba(0,0,0,.6)";
}
export function stageBack(el, level) {
  if (!el || !el.style) return;
  const b = bio(level), g = glowOf(level);
  el.style.background = "radial-gradient(ellipse 78% 74% at 50% 52%," + rgba(g, 0.5) + " 0%," + rgba(g, 0.2) + " 52%," + rgba(g, 0) + " 100%),"
    + "radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 52%,rgba(0,0,0,.5) 100%)," + b.bg1;
}
