/* Board fairness validator (#11): pure over a grid, no DOM / Date / Math.random.
   validateBoard(grid, level, heat, opts) returns the failed rule IDs in RULES
   order. The grid alone answers V1 V2 V3 V5 V7 V8 V9 V10 and SEAL; the rest
   read opts: foes (V4, [{type,tx,ty}]), items (V6), capped (V10, biome names
   whose E-W lane walls REAL 3D caps at EW_WALL_H_MAX), tries / fallback (V11),
   sym / flip / ignore (V12; ignore = tiles a gen-3 tile layer forced open),
   pact (V3 / V5 counts), only (a rule subset).
   Walking distance is the route from (1,1) with BRICK passable and WALL
   blocking: the real route once the doors are open. */
import { CFG, T, key, biomeOf, isFinale, EW_WALL_H_MAX } from "./config.js";
import { heatProfile, heatRoster } from "./heat.js";
import { applyPact } from "./pact.js";
import { PACE_MUL } from "./pace.js";

const C = CFG.COLS, R = CFG.ROWS, N = C * R;
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const RULES = Object.freeze(["V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10", "V11", "V12", "SEAL"]);
export const STRUCT = Object.freeze(["V1", "V7", "V8", "V9", "V10"]);
export const POCKET = Object.freeze([[1, 1], [2, 1], [3, 1], [4, 1], [1, 2], [3, 2], [1, 3], [2, 3], [1, 4]].map(([x, y]) => key(x, y)));
export const DOORS = Object.freeze([key(5, 1), key(1, 5)]);
const inPocket = new Uint8Array(N);
POCKET.forEach((k) => (inPocket[k] = 1));
const near = new Uint8Array(N);
for (const k of POCKET) { near[k] = 1; for (const [dx, dy] of D4) near[key((k % C) + dx, ((k / C) | 0) + dy)] = 1; }
const corners = [];
for (const [x, y] of [[C - 2, 1], [1, R - 2], [C - 2, R - 2]]) for (const [dx, dy] of [[0, 0], ...D4]) {
  const a = x + dx, b = y + dy;
  if (a > 0 && b > 0 && a < C - 1 && b < R - 1 && !(a % 2 === 0 && b % 2 === 0)) { corners.push(key(a, b)); near[key(a, b)] = 1; }
}
export const CORNERS = Object.freeze(corners);
export const HUNT = Object.freeze(["fast", "chaser", "knight"]);
export const PASSER = Object.freeze(["boomerang", "rocket", "shade"]);
export const D_FOE = 10, D_HUNT = 12, ESC_STEPS = 4, BRICK_MIN = 40, BRICK_MAX = 90, BRICKS_PER_ITEM = 3, DEAD_MAX = 4, DEAD_DEEP = 3, SHRINK_RINGS = 4, TRIES = 8, REACH_MAX = 10;
export const foeMin = (type) => (HUNT.includes(type) || PASSER.includes(type) ? D_HUNT : D_FOE);
export const foeFar = (type, d) => d < 0 || d >= foeMin(type);
const FUSE_MIN = Math.min(heatProfile(0).fuse, heatProfile(1).fuse, heatProfile(2).fuse);
const PACE_MIN = Math.min(...PACE_MUL);
const Q = new Int16Array(N);

/* BFS distances from (sx, sy); brick=true lets BRICK through, WALL always blocks */
export function walk(g, brick = true, sx = 1, sy = 1) {
  const d = new Int16Array(N).fill(-1), s = key(sx, sy);
  if (g[s] === T.WALL || (!brick && g[s] === T.BRICK)) return d;
  let h = 0, t = 0;
  d[s] = 0; Q[t++] = s;
  while (h < t) {
    const k = Q[h++], x = k % C, y = (k / C) | 0;
    for (let i = 0; i < 4; i++) {
      const nx = x + D4[i][0], ny = y + D4[i][1];
      if (nx < 0 || ny < 0 || nx >= C || ny >= R) continue;
      const nk = ny * C + nx, v = g[nk];
      if (d[nk] >= 0 || v === T.WALL || (!brick && v === T.BRICK)) continue;
      d[nk] = d[k] + 1; Q[t++] = nk;
    }
  }
  return d;
}
/* the tiles loadLevel may spawn a foe on: interior EMPTY outside the straight-line SPAWN_CLEAR */
export function freeTiles(g) {
  const out = [], clr = CFG.SPAWN_CLEAR * CFG.SPAWN_CLEAR;
  for (let y = 1; y < R - 1; y++) for (let x = 1; x < C - 1; x++) {
    if (g[key(x, y)] !== T.EMPTY || (x - 1) * (x - 1) + (y - 1) * (y - 1) < clr) continue;
    out.push([x, y]);
  }
  return out;
}
/* gen-2 foe placement (#12): each roster entry, in order, takes the first unused
   free tile (loadLevel's shuffled list) at walking distance >= foeMin; the picks
   go first and the unused tiles follow, so floor items take the rest */
export function placeFoes(free, roster, d, blocked) {
  const used = new Uint8Array(free.length), pick = [];
  for (const t of roster) {
    const j = free.findIndex(([x, y], i) => !used[i] && foeFar(t, d[key(x, y)]) && !(blocked && blocked(x, y, t)));
    if (j < 0) continue;
    used[j] = 1;
    pick.push([t, free[j]]);
  }
  return { pick, rest: free.filter((_, i) => !used[i]) };
}
/* gen-1 diagnostic: some foe start is <= n EMPTY steps from the spawn */
export function openLane(g, n = 5) {
  const e = walk(g, false);
  return freeTiles(g).some(([x, y]) => { const v = e[key(x, y)]; return v >= 0 && v <= n; });
}
export function sealed(g) {
  for (const k of POCKET) {
    if (g[k] !== T.EMPTY) return false;
    const x = k % C, y = (k / C) | 0;
    for (const [dx, dy] of D4) { const n = key(x + dx, y + dy); if (!inPocket[n] && g[n] !== T.WALL && g[n] !== T.BRICK) return false; }
  }
  return true;
}
/* the fair-start stamp, in final coordinates: pocket EMPTY, doors BRICK, every
   other non-wall neighbour of the pocket BRICK, the three other corners EMPTY */
export function stampStart(g) {
  POCKET.forEach((k) => (g[k] = T.EMPTY));
  DOORS.forEach((k) => (g[k] = T.BRICK));
  for (const k of POCKET) for (const [dx, dy] of D4) {
    const n = key((k % C) + dx, ((k / C) | 0) + dy);
    if (!inPocket[n] && g[n] !== T.WALL) g[n] = T.BRICK;
  }
  CORNERS.forEach((k) => { if (g[k] !== T.WALL) g[k] = T.EMPTY; });
  return g;
}
function blast(g, m, r, pierce, line, dir) {
  m.fill(0); m[key(1, 1)] = 1;
  for (const [dx, dy] of line ? [dir] : D4) for (let i = 1; i <= r; i++) {
    const x = 1 + dx * i, y = 1 + dy * i;
    if (x < 0 || y < 0 || x >= C || y >= R) break;
    const v = g[key(x, y)];
    if (v === T.WALL) break;
    m[key(x, y)] = 1;
    if (v === T.BRICK && !pierce && !line) break;
  }
  return m;
}
function escFails(g) {
  const e = walk(g, false), m = new Uint8Array(N);
  if (e[key(1, 1)] !== 0) return true;
  let worst = 0;
  const one = () => { let best = 99; for (let k = 0; k < N; k++) if (e[k] >= 0 && !m[k] && e[k] < best) best = e[k]; if (best > worst) worst = best; };
  for (let r = 1; r <= REACH_MAX; r++) {
    blast(g, m, r, false, false); one();
    blast(g, m, r, true, false); one();
    for (const d of D4) { blast(g, m, r, false, true, d); one(); }
  }
  return worst > ESC_STEPS || worst / (CFG.PLAYER_START.speed * PACE_MIN) > FUSE_MIN;
}
function shrinkFails(g) {
  const s = new Int8Array(N), q = new Int16Array(N), seen = new Uint8Array(N), k11 = key(1, 1);
  for (let ring = 1; ring <= SHRINK_RINGS; ring++) {
    let st = -1, open = 0;
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
      const k = key(x, y), rim = Math.min(x, C - 1 - x, y, R - 1 - y);
      s[k] = g[k] === T.WALL || (rim >= 1 && rim <= ring && k !== k11) ? 1 : 0;
      if (!s[k] && k !== k11) { open++; if (st < 0) st = k; }
    }
    if (st < 0) return false;
    seen.fill(0);
    let h = 0, t = 0, n = 1;
    seen[st] = 1; q[t++] = st;
    while (h < t) {
      const k = q[h++], x = k % C, y = (k / C) | 0;
      for (const [dx, dy] of D4) {
        const nk = key(x + dx, y + dy);
        if (x + dx < 0 || y + dy < 0 || x + dx >= C || y + dy >= R || seen[nk] || s[nk] || nk === k11) continue;
        seen[nk] = 1; q[t++] = nk; n++;
      }
    }
    if (n < open) return true;
  }
  return false;
}
function deadFails(g) {
  const isW = (x, y) => g[key(x, y)] === T.WALL;
  const nb = (x, y) => D4.filter(([dx, dy]) => !isW(x + dx, y + dy)).map(([dx, dy]) => [x + dx, y + dy]);
  let dead = 0;
  for (let y = 1; y < R - 1; y++) for (let x = 1; x < C - 1; x++) {
    if (isW(x, y)) continue;
    const n = nb(x, y);
    if (n.length > 1) continue;
    dead++;
    if (!n.length) continue;
    let dep = 1, px = x, py = y, [cx, cy] = n[0];
    while (dep <= DEAD_DEEP) {
      const m = nb(cx, cy);
      if (m.length !== 2) break;
      const [nx, ny] = m[0][0] === px && m[0][1] === py ? m[1] : m[0];
      px = cx; py = cy; cx = nx; cy = ny; dep++;
    }
    if (dep > DEAD_DEEP) return true;
  }
  return dead > DEAD_MAX;
}
function mirrorFails(g, sym, ignore) {
  const skip = near.slice();
  if (ignore) for (const k of ignore) skip[k] = 1;
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
    const k = key(x, y);
    if (skip[k]) continue;
    const o = [];
    if (sym.includes("h")) o.push(key(C - 1 - x, y));
    if (sym.includes("v")) o.push(key(x, R - 1 - y));
    if (sym === "hv") o.push(key(C - 1 - x, R - 1 - y));
    for (const q of o) if (!skip[q] && g[q] !== g[k]) return true;
  }
  return false;
}

export function validateBoard(g, level, heat, opts = {}) {
  const want = (id) => !opts.only || opts.only.includes(id);
  const f = new Set(), P = applyPact(heatProfile(heat), opts.pact | 0), roster = heatRoster(level, heat), biome = biomeOf(level);
  let bricks = 0;
  for (let i = 0; i < N; i++) if (g[i] === T.BRICK) bricks++;
  const needB = want("V1") || want("V3") || want("V4");
  const b = needB ? walk(g, true) : null;
  if (want("V1")) for (let i = 0; i < N; i++) if (g[i] !== T.WALL && b[i] < 0) { f.add("V1"); break; }
  if (want("V2") && escFails(g)) f.add("V2");
  if (want("V3")) {
    const free = freeTiles(g), floor = P.bare ? 0 : Math.max(P.floorMin, P.floorAdd + level);
    const far = free.filter(([x, y]) => b[key(x, y)] < 0 || b[key(x, y)] >= D_HUNT).length;
    if (far < roster.length || free.length < roster.length + floor) f.add("V3");
  }
  if (want("V4") && opts.foes) for (const e of opts.foes) if (!foeFar(e.type, b[key(e.tx, e.ty)])) { f.add("V4"); break; }
  if (want("V5") && (bricks < Math.max(BRICK_MIN, BRICKS_PER_ITEM * (P.buriedAdd + level)) || bricks > BRICK_MAX)) f.add("V5");
  if (want("V6") && (level | 0) === 1) {
    const ok = opts.items ? ["fire", "bomb"].every((t) => opts.items.some((it) => it.t === t && it.buried)) : bricks >= 2;
    if (!ok) f.add("V6");
  }
  if (want("V7") && shrinkFails(g)) f.add("V7");
  if (want("V8") && deadFails(g)) f.add("V8");
  if (want("V9")) for (let y = 1; y < R - 1; y += 2) for (let x = 1; x < C - 1; x += 2) if (g[key(x, y)] === T.WALL) f.add("V9");
  if (want("V10") && biome.hWall > EW_WALL_H_MAX && !(opts.capped && opts.capped.includes(biome.name)))
    for (let y = 2; y < R - 1; y += 2) for (let x = 1; x < C - 1; x += 2) if (g[key(x, y)] === T.WALL) f.add("V10");
  if (want("V11")) {
    const t = opts.tries;
    if ((t && (t[0] >= TRIES || t[1] >= TRIES)) || (opts.fallback && !sealed(g))) f.add("V11");
  }
  if (want("V12") && isFinale(level) && opts.sym) {
    if (mirrorFails(g, opts.sym, opts.ignore) || (biome.name === "CROWN" && !((opts.flip | 0) & 2))) f.add("V12");
  }
  if (want("SEAL") && !sealed(g)) f.add("SEAL");
  return RULES.filter((id) => f.has(id));
}
