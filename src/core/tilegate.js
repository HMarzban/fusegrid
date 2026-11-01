/* GATE (#26): see docs/superpowers/specs/2026-11-01-tiles-wave-2-3-design.md section 5.
   featM per gate is what the looks draw: 0 open, 1..3 warning (bars lowering, still
   passable), 4 shut (grid T.WALL), 5 dead (a SHRINK ring took the tile; it stays a
   plain WALL and never reopens). One signed countdown u drives every heat: u > 0 is
   open with the last `warn` s as the warning, u <= 0 is the shut window, -shut its
   end. PLUS / MAX read u from the room clock, every gate in step. CORE keeps it in
   featS: 0 = idle, your crossing arms `after`, standing on the tile holds it there.
   A shut waits while anything overlaps the tile, then lands the moment it clears if
   at least GATE_MIN s of the window is left, else this shut is skipped. */
import { CFG, T, key } from "./config.js";
import { F, featProfile } from "./feat.js";

const C = CFG.COLS, R = CFG.ROWS, TL = CFG.TILE;
export const GATE_SHUT = 4, GATE_DEAD = 5, GATE_MIN = 0.5;
/* a tile the wall passes leave to the gate's own bars: a shut bar is a WALL for
   collision only; a ring-dead gate is a real wall again */
export const gateBar = (w, k) => !!w.feat && w.feat[k] === F.GATE && (!w.featM || w.featM[k] !== GATE_DEAD);
/* the last lit step always holds >= GATE_MIN s before the shut */
const litOf = (u, warn) => (u > GATE_MIN ? (u > (warn + GATE_MIN) / 2 ? 1 : 2) : 3);
function overlaps(e, x, y) {
  const r = e.r || TL * 0.34, dx = e.x - Math.max(x * TL, Math.min(e.x, (x + 1) * TL)), dy = e.y - Math.max(y * TL, Math.min(e.y, (y + 1) * TL));
  return dx * dx + dy * dy < r * r;
}
export function gateBusy(w, x, y) {
  for (const p of w.players) if (p.alive !== false && overlaps(p, x, y)) return true;
  for (const e of w.enemies) if (!e.dead && overlaps(e, x, y)) return true;
  for (const b of w.bombs) if (!b.dead && ((b.tx === x && b.ty === y) || overlaps({ x: b.x, y: b.y, r: TL * 0.4 }, x, y))) return true;
  for (const bl of w.blades) for (const t of bl.tiles) if (t.tx === x && t.ty === y) return true;
  for (const it of w.items) if ((it.tx ?? Math.floor(it.x / TL)) === x && (it.ty ?? Math.floor(it.y / TL)) === y) return true;
  return false;
}
export function gateTick(w, dt, emit) {
  const f = w.feat, M = w.featM, S = w.featS, pr = featProfile(w).gate, ring = w.shrinkGen | 0, p = w.players[0];
  const per = pr.cross ? 0 : pr.open + pr.shut, clock = per ? pr.open - w.featT % per : 0;
  for (let k = 0; k < f.length; k++) {
    if (f[k] !== F.GATE || M[k] === GATE_DEAD) continue;
    const x = k % C, y = (k / C) | 0, rim = Math.min(x, C - 1 - x, y, R - 1 - y);
    if (rim <= ring && rim >= 1 && !(x === 1 && y === 1)) { M[k] = GATE_DEAD; S[k] = 0; continue; }
    let u = clock;
    if (pr.cross) {
      const on = p && p.alive !== false && Math.floor(p.x / TL) === x && Math.floor(p.y / TL) === y;
      if (on && S[k] >= 0) S[k] = pr.after;
      else if (S[k] !== 0) S[k] = (S[k] - dt) || -1e-6;
      if (S[k] === 0) continue;
      u = S[k];
    }
    if (u > 0 || u <= -pr.shut) {
      if (M[k] === GATE_SHUT) w.grid[key(x, y)] = T.EMPTY;
      M[k] = u > 0 && u <= pr.warn ? litOf(u, pr.warn) : 0;
      if (pr.cross && u <= 0) S[k] = 0;
    } else if (M[k] !== GATE_SHUT) {
      if (gateBusy(w, x, y)) M[k] = 3;
      else if (u + pr.shut >= GATE_MIN) { M[k] = GATE_SHUT; w.grid[key(x, y)] = T.WALL; }
      else M[k] = 0;
    }
  }
}
