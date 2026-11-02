/* Tile model for the offline balance harness (#25): the floor-tile rules of
   src/core/sim.js (codes 1..14: CONVEYOR E/S/W/N, ICE PATCH, BOOSTER, TRAP, STREAM E/S/W/N,
   QUICKSAND, PORTAL, GATE; sim names BELT / GLIDE / BLOOM / PLATE / QUICK) as read-only predictions. Shared by
   the bot fork (danger sets) and the no-escape counter (timed lethal map).
   Every knob comes from the sim's own featProfile(w) and paceMul, so a
   harness knob table (w.featProf) or tier override (w.featTier) reaches the
   model exactly as it reaches step(). Never imported by src/. */
import { CFG, T, key } from "../../src/core/config.js";
import "../../src/core/board3.js";
import { tileOf } from "../../src/core/board.js";
import { featProfile, isBelt, beltDir, isStream, isFlow, flowDir, pairTwins } from "../../src/core/feat.js";
import { portalDim, MAX_JUMPS } from "../../src/core/tileportal.js";
import { holdReach } from "../../src/core/tilequick.js";
import { GATE_DEAD } from "../../src/core/tilegate.js";
import { paceMul } from "../../src/core/pace.js";
import { carryPins } from "../../src/core/sim.js";

export const C = CFG.COLS, R = CFG.ROWS, N = C * R;
export const BD = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const NAME = Object.freeze({ BELT: "CONVEYOR", GLIDE: "ICE PATCH", BLOOM: "BOOSTER", PLATE: "TRAP", STREAM: "STREAM", PORTAL: "PORTAL", QUICK: "QUICKSAND", GATE: "GATE" });
export const prof = (w) => featProfile(w);
export const beltV = (w) => prof(w).belt.v * paceMul(w.pace);

/* the tile model runs only when the room carries a rule code; every code 1..14 has a rule */
const memo = new WeakMap();
export function rulesOn(w) {
  const f = w.feat;
  if (!f) return false;
  let v = memo.get(f);
  if (v === undefined) {
    v = false;
    for (let i = 0; i < f.length; i++) if (f[i] >= 1 && f[i] <= 14) { v = true; break; }
    memo.set(f, v);
  }
  return v;
}
export function ruleKind(w) {
  if (!w.feat) return null;
  for (const v of w.feat) { if (isBelt(v)) return "BELT"; if (v === 5) return "GLIDE"; if (v === 6) return "BLOOM"; if (v === 7) return "PLATE"; if (isStream(v)) return "STREAM"; if (v === 13) return "PORTAL"; if (v === 12) return "QUICK"; if (v === 14) return "GATE"; }
  return null;
}
export const BOT_BRAKE = !(globalThis.process && globalThis.process.env && globalThis.process.env.FG_BOTBRAKE === "0");
export const onIce = (w, k) => w.feat[k] === 5 && w.grid[k] === T.EMPTY;
/* ICE PATCH at MAX (coast >= 2): does a coast arriving on ice tile k moving
   BD[d] at time t stop there? A WALL ahead, or a BRICK / bomb still standing
   at arrival (t < its first lethal time in L); with glide.stop "brake"
   anywhere (an opposite press before the centre) */
export function iceStop(w, k, d, t, L, bombAt) {
  const st = prof(w).glide.stop;
  if (st === "brake") return true;
  const nk = key((k % C) + BD[d][0], ((k / C) | 0) + BD[d][1]), v = w.grid[nk];
  if (v === undefined || v === T.WALL) return true;
  return (v === T.BRICK || !!bombAt[nk]) && t < L[nk];
}
export const onBelt = (w, k) => isBelt(w.feat[k]) && w.grid[k] === T.EMPTY;
export const onFlow = (w, k) => isFlow(w.feat[k]) && w.grid[k] === T.EMPTY;
export const onWater = (w, k) => isStream(w.feat[k]) && w.grid[k] === T.EMPTY;
/* #28: does a CONVEYOR carry a standing player (actors ride at v > 0)? */
export const carries = (w) => { const pb = prof(w).belt; return !!pb.actors && pb.v > 0; };

/* PORTAL: the twin of k for a walker crossing onto it now, -1 when k is plain floor to him */
export const warpTo = (w, k) => (w.featPair && w.featPair[k] && w.grid[k] === T.EMPTY && !portalDim(w, k) ? pairTwins(w.featPair)[k] : -1);
export const armPt = (w) => (w.featPair ? { twin: pairTwins(w.featPair), blast: !!prof(w).portal.blast } : null);
/* GATE, tilegate.js as a forecast: one signed countdown u, > 0 open, (-shut, 0] shut.
   PLUS / MAX read the room clock; CORE reads featS (0 idle, your next crossing is not
   predicted). A shut that waits on an occupied tile is not predicted either. */
const GATES = new WeakMap();
export function gatesOf(w) {
  const f = w.feat;
  if (!f) return [];
  let g = GATES.get(f);
  if (!g) { g = []; for (let k = 0; k < f.length; k++) if (f[k] === 14) g.push(k); GATES.set(f, g); }
  return g;
}
export const isLiveGate = (w, k) => !!w.feat && w.feat[k] === 14 && w.featM[k] !== GATE_DEAD;
function gateU(w, k, t, pr) {
  if (pr.cross) { const s = w.featS[k]; return s === 0 ? 1 : s - t; }
  return pr.open - (w.featT + t) % (pr.open + pr.shut);
}
export function gateShutAt(w, k, t) {
  const pr = prof(w).gate, u = gateU(w, k, t, pr);
  if (!(u <= 0 && u > -pr.shut)) return false;
  /* in its shut window and still open now: something on the tile holds it (tilegate.js gateBusy) */
  const u0 = gateU(w, k, 0, pr);
  return !(u0 <= 0 && u0 > -pr.shut && w.grid[k] !== T.WALL);
}
/* seconds after t until a walker can enter gate k: 0 when it is open at t */
export function gateOpenIn(w, k, t) {
  const pr = prof(w).gate;
  return gateShutAt(w, k, t) ? pr.shut + gateU(w, k, t, pr) : 0;
}
/* the grid a blast sees t s from now: every live gate at its phase then */
export function gridAt(w, t, g = w.grid.slice()) {
  for (const k of gatesOf(w)) if (w.featM[k] !== GATE_DEAD) g[k] = gateShutAt(w, k, t) ? T.WALL : (g[k] === T.WALL ? T.EMPTY : g[k]);
  return g;
}
/* QUICKSAND, tilequick.js as a forecast: per tile the s from now it is a mound, Infinity
   for none, null in a room with no sand. A walker arriving earlier cancels the growth; a
   lit bomb in its hold reach holds it past any escape, so a mound never closes an arm of
   a live bomb. */
const Q_WAIT = 0, Q_RETRY = 1, Q_GROW = 2;
export function moundTimes(w) {
  const s = w.quick;
  if (!s || s.grid !== w.grid || !s.list.length) return null;
  const M = new Float64Array(N).fill(Infinity), pr = prof(w).quick;
  for (const q of s.list) {
    if (q.st !== Q_WAIT && q.st !== Q_RETRY && q.st !== Q_GROW) continue;
    if (w.bombs.some((b) => !b.dead && Math.abs(b.tx - q.x) + Math.abs(b.ty - q.y) <= holdReach(b.radius))) continue;
    M[q.k] = q.st === Q_GROW ? pr.grow - q.t : q.t + pr.grow;
  }
  return M;
}
/* a cross footprint on grid g: centre plus arms [dx, dy, len]; the edge and
   WALL block, a BRICK is hit and stops the arm unless `pass`; pt: a PORTAL arm
   stops on the tile (CORE) or goes on from the twin with its leftover reach */
export function cross(g, cx, cy, arms, pass, out, pt = null) {
  out.add(key(cx, cy));
  for (const [dx, dy, len] of arms) {
    let x = cx, y = cy, jumps = 0;
    for (let i = 1; i <= len; i++) {
      x += dx; y += dy;
      const v = g[key(x, y)];
      if (v === undefined || v === T.WALL) break;
      out.add(key(x, y));
      if (v === T.BRICK && !pass) break;
      const tw = pt ? pt.twin[key(x, y)] : -1;
      if (tw < 0 || g[tw] === T.WALL) continue;
      if (!pt.blast || jumps >= MAX_JUMPS) break;
      jumps++;
      out.add(tw);
      x = tw % C; y = (tw / C) | 0;
    }
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
   another bomb, or where carryPins holds it right now (its next step only: a later
   hold depends on where foes and the player are by then); foes and the player's own
   tile (dynamic stops) are not otherwise predicted. Kicked sliders are left alone, as in the sim. */
export function beltPath(w, b, horizon) {
  const path = [[b.tx, b.ty, 0]];
  if (b.slide && !b.carry) return path;
  const v = isStream(w.feat[key(b.tx, b.ty)]) ? prof(w).stream.v * paceMul(w.pace) : beltV(w);
  if (v <= 0) return path;
  let x = b.tx, y = b.ty, t = -((b.carry ? b.prog : 0) || 0) / v;
  for (let n = 0; n < N; n++) {
    const k = key(x, y);
    if (!onFlow(w, k)) break;
    const [dx, dy] = flowDir(w.feat[k]), nx = x + dx, ny = y + dy, nk = key(nx, ny);
    if (w.grid[nk] !== T.EMPTY || w.bombs.some((o) => o !== b && !o.dead && o.tx === nx && o.ty === ny)) break;
    if (n === 0 && !b.carry && carryPins(w, b, nx, ny)) break;
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
  /* GATE: the arm the bomb throws when it blows; a bar that opens by then is no cover */
  const g = timer != null && gatesOf(w).length ? gridAt(w, timer) : w.grid;
  for (const [x, y] of cells) {
    const s = cross(g, x, y, arms, pass, new Set(), armPt(w));
    for (const k of s) out.add(k);
    relaySet(w, g, s, x, y, out, new Set(), 0, gain);
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
  /* plate.off: a trap never arms with the player on or beside its lines, so
     an idle TRAP is never a danger to stand in; only pending wind-ups are */
  if (w.featT >= pc.inert - 0.5 && (pc.off == null || pc.off === false)) {
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
  if (c === 0 || (c >= 2 && prof(w).glide.stop === "brake" && BOT_BRAKE)) return true;
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
  if (onWater(w, k)) return vp * prof(w).stream.wade;
  if (!beltOnly && onIce(w, k)) return Math.min(p.speed * prof(w).glide.boost, CFG.MAX_SPEED) * paceMul(w.pace);
  const pb = prof(w).belt;
  if (pb.actors && onBelt(w, k)) {
    const [bx, by] = flowDir(w.feat[k]), bv = pb.v * paceMul(w.pace);
    if (bx === dx && by === dy) return vp + bv;
    if (bx === -dx && by === -dy) return vp - bv;
  }
  return vp;
}
