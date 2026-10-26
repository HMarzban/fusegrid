/* Tile model for the offline balance harness (#25): the floor-tile rules of
   src/core/sim.js (codes 1..7 = CONVEYOR E/S/W/N, ICE PATCH, BOOSTER, TRAP;
   sim names BELT / GLIDE / BLOOM / PLATE) as read-only predictions. Shared by
   the bot fork (danger sets) and the no-escape counter (timed lethal map).
   Every knob comes from the sim's own featProfile(w) and paceMul, so a
   harness knob table (w.featProf) or tier override (w.featTier) reaches the
   model exactly as it reaches step(). Never imported by src/. */
import { CFG, T, key } from "../../src/core/config.js";
import { tileOf } from "../../src/core/board.js";
import { featProfile, isBelt, beltDir } from "../../src/core/feat.js";
import { paceMul } from "../../src/core/pace.js";

export const C = CFG.COLS, R = CFG.ROWS, N = C * R;
export const BD = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const NAME = Object.freeze({ BELT: "CONVEYOR", GLIDE: "ICE PATCH", BLOOM: "BOOSTER", PLATE: "TRAP" });
export const prof = (w) => featProfile(w);
export const beltV = (w) => prof(w).belt.v * paceMul(w.pace);

/* the tile model runs only when the room carries a RULE code (1..7); art-only
   codes 8..14 (STREAM / QUICKSAND / PORTAL / GATE) play as plain floor */
const memo = new WeakMap();
export function rulesOn(w) {
  const f = w.feat;
  if (!f) return false;
  let v = memo.get(f);
  if (v === undefined) {
    v = false;
    for (let i = 0; i < f.length; i++) if (f[i] >= 1 && f[i] <= 7) { v = true; break; }
    memo.set(f, v);
  }
  return v;
}
export function ruleKind(w) {
  if (!w.feat) return null;
  for (const v of w.feat) { if (isBelt(v)) return "BELT"; if (v === 5) return "GLIDE"; if (v === 6) return "BLOOM"; if (v === 7) return "PLATE"; }
  return null;
}
export const onIce = (w, k) => w.feat[k] === 5 && w.grid[k] === T.EMPTY;
export const onBelt = (w, k) => isBelt(w.feat[k]) && w.grid[k] === T.EMPTY;

/* a cross footprint on grid g: centre plus arms [dx, dy, len]; the edge and
   WALL block, a BRICK is hit and stops the arm unless `pass` */
export function cross(g, cx, cy, arms, pass, out) {
  out.add(key(cx, cy));
  for (const [dx, dy, len] of arms)
    for (let i = 1; i <= len; i++) {
      const x = cx + dx * i, y = cy + dy * i, v = g[key(x, y)];
      if (v === undefined || v === T.WALL) break;
      out.add(key(x, y));
      if (v === T.BRICK && !pass) break;
    }
  return out;
}
export const bombArms = (b) => (b.line ? [[(b.dir || { x: 1 }).x || 0, (b.dir || { y: 0 }).y || 0, b.radius]] : BD.map(([dx, dy]) => [dx, dy, b.radius]));
export const bombPass = (b) => !!(b.pierce || b.line);
export function relayArms(bc, dx, dy) {
  const a = [[dx, dy, bc.fwd]];
  if (bc.side) a.push([dy, dx, bc.side], [-dy, -dx, bc.side]);
  return a;
}
export const plateArms = (pc) => BD.map(([dx, dy]) => [dx, dy, pc.r]);

/* the cells a resting / carried bomb visits on a CONVEYOR: [[x, y, t]] from
   its tile at t 0, each later cell at its arrival time, up to `horizon` s.
   It moves tile to tile at belt v (pace-scaled), re-reads the layer on
   arrival (plain floor = it stops there) and stops short of WALL / BRICK /
   another bomb; foes and the player's own tile (dynamic stops) are not
   predicted. Kicked sliders are left alone, as in the sim. */
export function beltPath(w, b, horizon) {
  const path = [[b.tx, b.ty, 0]];
  if (b.slide && !b.carry) return path;
  const v = beltV(w);
  if (v <= 0) return path;
  let x = b.tx, y = b.ty, t = -((b.carry ? b.prog : 0) || 0) / v;
  for (let n = 0; n < N; n++) {
    const k = key(x, y);
    if (!onBelt(w, k)) break;
    const [dx, dy] = beltDir(w.feat[k]), nx = x + dx, ny = y + dy, nk = key(nx, ny);
    if (w.grid[nk] !== T.EMPTY || w.bombs.some((o) => o !== b && !o.dead && o.tx === nx && o.ty === ny)) break;
    t += 1 / v;
    if (t > horizon) break;
    x = nx; y = ny;
    path.push([x, y, Math.max(0, t)]);
  }
  return path;
}
export function cellAt(path, t) {
  let c = path[0];
  for (const q of path) if (q[2] <= t) c = q;
  return c;
}

/* ---- bot danger (sets, no timing): what the fork must never stand in ---- */
/* relay cover of every idle BOOSTER an arm of `tiles` (a blast centred cx, cy) reaches, recursively */
export function relaySet(w, g, tiles, cx, cy, out, seen, depth = 0, gain = false) {
  if (depth > 4) return out;
  const bc = prof(w).bloom;
  if (bc.safe && !gain) return out;
  for (const k of tiles) {
    const x = k % C, y = (k / C) | 0;
    if ((x === cx && y === cy) || w.feat[k] !== 6 || w.grid[k] !== T.EMPTY || w.featM[k] !== 0 || seen.has(k)) continue;
    if (x !== cx && y !== cy) continue;
    seen.add(k);
    const s = cross(g, x, y, relayArms(bc, Math.sign(x - cx), Math.sign(y - cy)), false, new Set());
    for (const q of s) out.add(q);
    relaySet(w, g, s, x, y, out, seen, depth + 1, gain);
  }
  return out;
}
/* a bomb's tile-extended cover: its cross at every CONVEYOR cell it can reach
   before the fuse (stops are uncertain, so all of them) plus BOOSTER relays */
/* gain: also the cover of BOOSTER relays that cannot hurt the player (bloom.safe), for "what does it hit" */
export function bombCover(w, b, timer, out, gain = false) {
  const cells = timer != null ? beltPath(w, b, timer) : [[b.tx, b.ty, 0]];
  const arms = bombArms(b), pass = bombPass(b);
  for (const [x, y] of cells) {
    const s = cross(w.grid, x, y, arms, pass, new Set());
    for (const k of s) out.add(k);
    relaySet(w, w.grid, s, x, y, out, new Set(), 0, gain);
  }
  return out;
}
/* every tile danger the fork adds to the stock map: carried bombs and relays,
   pending TRAP wind-ups at full r, pending BOOSTER flares, and an idle TRAP
   a moving foe stands next to (after the inert window, honouring plate.near) */
export function tileDanger(w, danger) {
  for (const b of w.bombs) bombCover(w, b, b.timer, danger);
  const P = prof(w), pc = P.plate;
  for (const q of w.featPend) {
    const x = q.k % C, y = (q.k / C) | 0;
    if (q.kind !== "plate" && P.bloom.safe) continue;
    const s = q.kind === "plate" ? cross(w.grid, x, y, plateArms(pc), false, new Set()) : cross(w.grid, x, y, relayArms(P.bloom, q.dx, q.dy), false, new Set());
    for (const k of s) danger.add(k);
    relaySet(w, w.grid, s, x, y, danger, new Set());
  }
  if (w.featT >= pc.inert - 0.5) {
    const p = w.players[0], ptx = tileOf(p.x), pty = tileOf(p.y);
    for (let k = 0; k < N; k++) {
      if (w.feat[k] !== 7 || w.featM[k] !== 0 || w.grid[k] !== T.EMPTY) continue;
      const x = k % C, y = (k / C) | 0;
      if (pc.near != null && Math.abs(ptx - x) + Math.abs(pty - y) > pc.near + 1) continue;
      if (w.enemies.some((e) => !e.dead && e.speed > 0 && Math.abs(e.tx - x) + Math.abs(e.ty - y) <= 1)) cross(w.grid, x, y, plateArms(pc), false, danger);
    }
  }
  return danger;
}
/* ICE PATCH flee rule: may (nx, ny), entered from (x, y), be a flee
   destination? CORE (coast 0) always; PLUS (coast 1) only if the tile past
   it is not a free tile in danger; MAX (coast >= 2) the coast endpoint must be
   off the sheet or against a block, and out of danger (no wait tile on ice) */
export function iceDestOk(w, x, y, nx, ny, danger) {
  const k = key(nx, ny);
  if (!onIce(w, k)) return true;
  const c = prof(w).glide.coast;
  if (c === 0) return true;
  const dx = nx - x, dy = ny - y;
  if (c === 1) { const ak = key(nx + dx, ny + dy); return !(w.grid[ak] === T.EMPTY && danger.has(ak)); }
  let ex = nx, ey = ny;
  for (let i = 0; i < N && onIce(w, key(ex, ey)); i++) {
    const ak = key(ex + dx, ey + dy);
    if (w.grid[ak] !== T.EMPTY || w.bombs.some((b) => !b.dead && b.tx === ex + dx && b.ty === ey + dy)) break;
    ex += dx; ey += dy;
  }
  for (let px = nx, py = ny; ; px += dx, py += dy) { if (danger.has(key(px, py))) return false; if (px === ex && py === ey) break; }
  return true;
}
/* per-move speed in tiles/s leaving tile k in direction (dx, dy): ICE PATCH
   boost on the sheet, CONVEYOR push (with or against) when actors ride */
export function moveSpeed(w, p, k, dx, dy, tiles, beltOnly) {
  const vp = p.speed * paceMul(w.pace);
  if (!tiles) return vp;
  if (!beltOnly && onIce(w, k)) return Math.min(p.speed * prof(w).glide.boost, CFG.MAX_SPEED) * paceMul(w.pace);
  const pb = prof(w).belt;
  if (pb.actors && onBelt(w, k)) {
    const [bx, by] = beltDir(w.feat[k]), bv = pb.v * paceMul(w.pace);
    if (bx === dx && by === dy) return vp + bv;
    if (bx === -dx && by === -dy) return vp - bv;
  }
  return vp;
}
