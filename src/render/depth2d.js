/* CLASSIC 2D depth (depth round 2026-10-25): one light, upper-left, so every shadow falls toward the lower right. The room's whole floor-level layer is
   painted ONCE (2x offscreen, one drawImage per frame) and rebuilt only when the grid, the feature layer or the room changes, which is how a brick that
   breaks takes its shadow with it:
     cast shadow  each interior WALL and BRICK throws its footprint 4..8 px (taller = longer) onto the floor in three stepped layers, black alpha .15 each
                  (about .39 where they stack, at the base) with a 2 px contact line, soft ends and no gradient
     AO           a stepped halo around every solid, a darker strip under each brick's front face, and a patch in every concave corner (the border ring counts as
                  a neighbour here; its own rim shadow belongs to frame.js wellBoard)
     ground tone  floorart.paintGround, slab-to-slab variation with a physical cause per biome
   The layer is clipped to the cells that are not WALL (a wall tile is already drawn and must keep its own face) and ground tone skips features and bricks.
   With no canvas factory (Node) it paints straight, same ops. contact() is the soft ellipse the entity loops lay at a foot line: two stacked fills, no
   gradient. Black alpha and floorart slots only: no new hex. */
import {CFG, T, BIOMES} from "../core/config.js";
import {paintGround} from "./floorart.js";

const TL = CFG.TILE, CO = CFG.COLS, RO = CFG.ROWS, W = CO * TL, H = RO * TL, S = 2;
const K = (a) => "rgba(0,0,0," + a + ")";
const bioOf = (level) => BIOMES[(Math.max(1, level | 0) - 1) % BIOMES.length];
const clampR = (h, lo, hi, k) => Math.max(lo, Math.min(hi, Math.round(2 + h * k)));
export const wallReach = (b) => clampR(b.hWall, 4, 8, 0.18);
export const brickReach = (b) => clampR(b.hBrick, 3, 6, 0.16);
export const CAST_A = 0.15, CAST_STEPS = Object.freeze([0.4, 0.7, 1]);

function paint(c, world, b) {
  if (!c.clip || !c.rect) return;
  const g = world.grid, ft = world.feat, lv = world.level | 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= CO || y >= RO ? T.WALL : g[y * CO + x]);
  const solid = (x, y) => at(x, y) === T.WALL || at(x, y) === T.BRICK;
  const ring = (x, y) => x === 0 || y === 0 || x === CO - 1 || y === RO - 1;
  const walls = [], bricks = [];
  c.save();
  c.beginPath();
  for (let y = 0; y < RO; y++) for (let x = 0; x < CO; x++) {
    const t = g[y * CO + x];
    if (t !== T.WALL) c.rect(x * TL, y * TL, TL, TL);
    else if (!ring(x, y)) walls.push([x, y]);
    if (t === T.BRICK) bricks.push([x, y]);
  }
  c.clip();
  for (let y = 0; y < RO; y++) for (let x = 0; x < CO; x++) {
    if (g[y * CO + x] !== T.EMPTY || (ft && ft[y * CO + x])) continue;
    c.save(); c.translate(x * TL, y * TL); paintGround(c, b, x, y, lv); c.restore();
  }
  const dw = wallReach(b), db = brickReach(b), cast = walls.concat(bricks);
  for (const f of CAST_STEPS) {
    c.beginPath();
    for (const [x, y] of walls) c.rect(x * TL + dw * f, y * TL + dw * f, TL, TL);
    for (const [x, y] of bricks) c.rect(x * TL + db * f, y * TL + db * f, TL, TL);
    c.fillStyle = K(CAST_A); c.fill();
  }
  c.beginPath();
  for (const [x, y] of cast) { c.rect((x + 1) * TL, y * TL + 2, 2, TL); c.rect(x * TL + 2, (y + 1) * TL, TL, 2); }
  c.fillStyle = K(0.2); c.fill();
  for (const e of [3, 6, 9]) {
    c.beginPath();
    for (const [x, y] of cast) c.rect(x * TL - e, y * TL - e, TL + 2 * e, TL + 2 * e);
    c.fillStyle = K(0.055); c.fill();
  }
  for (const hh of [7, 3]) {
    c.beginPath();
    for (const [x, y] of bricks) c.rect(x * TL, (y + 1) * TL, TL, hh);
    c.fillStyle = K(0.07); c.fill();
  }
  for (const sz of [9, 5]) {
    c.beginPath();
    for (let y = 1; y < RO - 1; y++) for (let x = 1; x < CO - 1; x++) {
      if (solid(x, y)) continue;
      const l = solid(x - 1, y), r = solid(x + 1, y), u = solid(x, y - 1), d = solid(x, y + 1), x0 = x * TL, y0 = y * TL;
      if (l && u) c.rect(x0, y0, sz, sz);
      if (r && u) c.rect(x0 + TL - sz, y0, sz, sz);
      if (l && d) c.rect(x0, y0 + TL - sz, sz, sz);
      if (r && d) c.rect(x0 + TL - sz, y0 + TL - sz, sz, sz);
    }
    c.fillStyle = K(0.07); c.fill();
  }
  c.restore();
}

function sigOf(world) {
  const g = world.grid, ft = world.feat;
  let h = Math.imul((world.level | 0) + 1, 2654435761) | 0;
  for (let i = 0; i < CO * RO; i++) h = (Math.imul(h, 31) + g[i] + (ft && ft[i] ? 3 : 0) + 1) | 0;
  return h;
}

let LAYER = null, LSIG = null;
function mkLayer() {
  if (typeof document !== "undefined" && document && document.createElement) { const c = document.createElement("canvas"); c.width = W * S; c.height = H * S; return c; }
  return null;
}
export function drawDepth(c, world) {
  if (!world.grid) return;
  const sig = sigOf(world), b = bioOf(world.level);
  if (sig !== LSIG) {
    LSIG = sig; LAYER = mkLayer();
    const x = LAYER && LAYER.getContext && LAYER.getContext("2d");
    if (x) { x.scale(S, S); paint(x, world, b); } else LAYER = null;
  }
  if (LAYER) c.drawImage(LAYER, 0, 0, W, H);
  else paint(c, world, b);
}

/* the soft contact shadow an entity lays at its foot line, offset toward the lower right */
export function contact(c, rx, ry, dx = 1.6, dy = 0.8, a = 1) {
  if (!c.ellipse) return;
  c.fillStyle = K(0.1 * a); c.beginPath(); c.ellipse(dx, dy, rx * 1.22, ry * 1.3, 0, 0, 7); c.fill();
  c.fillStyle = K(0.17 * a); c.beginPath(); c.ellipse(dx * 0.7, dy * 0.7, rx, ry, 0, 0, 7); c.fill();
}
