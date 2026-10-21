/* THROWAWAY MOCKUP (2026-10-20 levels round): gen 2 = the critic's merged
   design (06-critic-synthesis §2a). LD option C authored biome skeletons +
   seeded flips + RUIN / PLAZA / JOINH / JOINV edits, keyed (seed, room)
   only; a separate fill stage keyed (seed, room, heat, attempt) that changes
   ONLY bricks, on an exact budget = the v1 board's own brick count; the
   validator (V1 V7 V8 V9 structural, ESC at full reach, V3 fit, V5 band);
   K=8 skeleton x M=8 fill tries, then the v1 lattice. Never merges. */
import { CFG, T, key } from "./config.js";
import { createRng } from "./rng.js";
import { genBoard } from "./board.js";
import { heatProfile, heatRoster } from "./heat.js";
import { placeFeat } from "./feat.js";
/* TILE PROTO (2026-10-21): FEAT.on=false builds the board exactly as before the tile round */
export const FEAT = { on: true };

const C = CFG.COLS, R = CFG.ROWS, N = C * R;
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const W = 0, E = 1, B = 2, F = 3, S = 4;
/* # wall  x pillar that may ruin  o lane slot that may join  . reserved floor
   b reserved brick  ? fill  s sparse fill. WATER atoll's reef is N-S
   (V10: no E-W lane wall where hWall > 22); the rest is LD's text. */
const TPL = {
JUNGLE:[{n:"clearing",sym:"h",t:`
###############
#?????????????#
#?#?#?#?#?#?#?#
#?????????????#
#?#?#?x?x?#?#?#
#????.....????#
#?#?#.#.#.#?#?#
#????.....????#
#?#?#?x?x?#?#?#
#?????????????#
#?#?#?#?#?#?#?#
#?????????????#
###############`}],
ICE:[{n:"lanes",sym:"h",t:`
###############
#?????????????#
#?#?#?#?#?#?#?#
#?????#?#?????#
#?#?#?#?#?#?#?#
#.............#
#?#?#.....#?#?#
#.............#
#?#?#?#?#?#?#?#
#?????#?#?????#
#?#?#?#?#?#?#?#
#?????????????#
###############`}],
FACTORY:[{n:"conveyor",sym:"h",t:`
###############
#???#?????#???#
#?#?#?#?#?#?#?#
#?????????????#
#?#.#######.#?#
#ss.........ss#
#####.#?#.#####
#ss.........ss#
#?#.#######.#?#
#?????????????#
#?#?#?#?#?#?#?#
#???#?????#???#
###############`}],
WATER:[{n:"islands",sym:"h",t:`
###############
#??????.??????#
#?#?#?#.#?#?#?#
#??????.??????#
#?#?#?#.#?#?#?#
#.............#
#?#?#?#.#?#?#?#
#.............#
#?#?#?#.#?#?#?#
#??????.??????#
#?#?#?#.#?#?#?#
#??????.??????#
###############`},{n:"river",sym:"none",t:`
###############
#?????????..??#
#?#?#?#?#?..#?#
#??????.....#?#
#?#?#?#.....#?#
#?????#..?????#
#?#?#?#..?#?#?#
#??......?????#
#?#......?#?#?#
#?#..?????????#
#?#..?#?#?#?#?#
#??..?????????#
###############`},{n:"atoll",sym:"h",t:`
###############
#?????????????#
#?#?#b#b#b#?#?#
#???#.....#???#
#?#?#.#.#.#?#?#
#???b.....b???#
#?#?#.....#?#?#
#???b.....b???#
#?#?#.#.#.#?#?#
#???#.....#???#
#?#?#b#b#b#?#?#
#?????????????#
###############`}],
ARENA:[{n:"ring",sym:"hv",t:`
###############
#?????????????#
#?#?#?#?#?#?#?#
#??sssssssss??#
#?#s.......s#?#
#??s.......s??#
#?#s...x...s#?#
#??s.......s??#
#?#s.......s#?#
#??sssssssss??#
#?#?#?#?#?#?#?#
#?????????????#
###############`},{n:"pit",sym:"h",t:`
###############
#?????????????#
#?#?#?#?#?#?#?#
#??...#?#...??#
#?#...#?#...#?#
#??...???...??#
#?###?#.#?###?#
#??...???...??#
#?#...#?#...#?#
#??...#?#...??#
#?#?#?#?#?#?#?#
#?????????????#
###############`},{n:"gauntlet",sym:"h",t:`
###############
#?????????????#
#?#?#?#?#?#?#?#
#?#?#?#?#?#?#?#
#?#?#?#?#?#?#?#
#??.........??#
#?#.........#?#
#??.........??#
#?#?#?#?#?#?#?#
#?#?#?#?#?#?#?#
#?#?#?#?#?#?#?#
#?????????????#
###############`}],
SAND:[{n:"ruins",sym:"none",t:`
###############
#?????ss??????#
#?#?#?x?#?x?#?#
#????s?...????#
#?x?#?#...#?#?#
#??s???...?s??#
#?#?x?#?#?x?#?#
#??...??s...?s#
#?#...x?#...x?#
#??...???...??#
#?x?#?#?x?#?#?#
#??????s??????#
###############`}],
VOID:[{n:"drift",sym:"h",t:`
###############
#?????????????#
#?#?x?x?x?x?#?#
#?ssssssssss??#
#?x?#?x?#?x?x?#
#?...........?#
#?x.........x?#
#?...........?#
#?x?#?x?#?x?x?#
#?ssssssssss??#
#?#?x?x?x?x?#?#
#?????????????#
###############`}],
CROWN:[{n:"throne",sym:"h",t:`
###############
#?????...?????#
#?#?#?###?#?#?#
#?????...?????#
#?#?###.###?#?#
#?????...?????#
#?#?#?#.#?#?#?#
#?????...?????#
#?#?###.###?#?#
#?????...?????#
#?#?#?#.#?#?#?#
#?????...?????#
###############`},{n:"court",sym:"h",t:`
###############
#?????s.s?????#
#?#?#?###?#?#?#
#??.........??#
#?#.#.#.#.#.#?#
#??.........??#
#?#.#.#.#.#.#?#
#??.........??#
#?#?#?#.#?#?#?#
#?????s.s?????#
#?#?#?#.#?#?#?#
#?????s.s?????#
###############`},{n:"vault",sym:"h",t:`
###############
#???#.#.#.#???#
#?#?#.#.#.#?#?#
#???#.....#???#
#?#?#.#b#.#?#?#
#?????...?????#
#?#?#?#.#?#?#?#
#?????...?????#
#?#?#?#.#?#?#?#
#?????...?????#
#?#?#?#.#?#?#?#
#?????...?????#
###############`}],
};
export const BIOME2 = ["JUNGLE", "ICE", "FACTORY", "WATER", "ARENA", "SAND", "VOID", "CROWN"];
for (const b in TPL) for (const t of TPL[b]) {
  const rows = t.t.trim().split("\n");
  if (rows.length !== R || rows.some((r) => r.length !== C)) throw Error("bad template " + b + "/" + t.n);
  t.g = rows.join("");
}
const STAMPS = {JUNGLE:[["RUIN",0,2],["PLAZA",0,1]],ICE:[["JOINV",1,3],["RUIN",0,2]],FACTORY:[["JOINH",1,3],["RUIN",0,1]],
  WATER:[["RUIN",1,3],["JOINV",0,2],["PLAZA",0,1]],ARENA:[["JOINV",0,2],["RUIN",0,2]],SAND:[["RUIN",1,3],["JOINH",0,1]],VOID:[["RUIN",1,3]],CROWN:[["JOINV",0,2],["RUIN",0,2]]};
const FINALE = { ARENA: 1, CROWN: 1 };
/* WATER / ARENA / CROWN carry authored features (channels, reef, pits, dais,
   vault): an edit whose 3x3 touches a reserved tile or an authored join is skipped */
const GUARD = { JUNGLE: 1, ICE: 1, FACTORY: 1, WATER: 1, ARENA: 1, CROWN: 1, SAND: 1, VOID: 1 };
/* BOLD: bricks below the v1 count per room; JUNGLE (teaching room) stays mild */
const CUT = { JUNGLE: 6, ICE: 17, FACTORY: 17, WATER: 17, ARENA: 17, SAND: 17, VOID: 17, CROWN: 17 };
function guarded(g, kind, x, y) {
  const at = (a, b) => (a <= 0 || b <= 0 || a >= C - 1 || b >= R - 1 ? "" : g[key(a, b)]);
  const feat = (a, b) => { const ch = at(a, b); return ch === "." || ch === "b" || (ch === "#" && !(a % 2 === 0 && b % 2 === 0)); };
  if (kind === "JOINH" || kind === "JOINV") return at(x, y) === "." || at(x, y) === "b";
  if (kind === "RUIN") return D4.some(([dx, dy]) => { const ch = at(x + dx, y + dy); return ch === "b" || (ch === "#" && !((x + dx) % 2 === 0 && (y + dy) % 2 === 0)); });
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (feat(x + dx, y + dy)) return true;
  return false;
}
const POCKET = [[1,1],[2,1],[1,2],[3,1],[4,1],[3,2],[1,3],[1,4],[2,3]].map(([x, y]) => key(x, y));
const DOORS = [[5,1],[1,5]].map(([x, y]) => key(x, y));
const FAR = [];
[[C-2,1],[1,R-2],[C-2,R-2]].forEach(([x, y]) => [[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
  const a = x + dx, b = y + dy;
  if (a > 0 && b > 0 && a < C - 1 && b < R - 1 && !(a % 2 === 0 && b % 2 === 0)) FAR.push(key(a, b));
}));
const CARVE1 = [0.32, 0.28, 0.24];

function fmix(h) {
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
const hash = (...p) => p.reduce((h, v, i) => fmix((h ^ Math.imul((v >>> 0) + 1, 0x9e3779b1 + i * 0x7feb352d)) >>> 0), 0xf2f2f2f2);

function mir(x, y, sym) {
  const o = [[x, y]];
  if (sym.includes("h")) o.push([C - 1 - x, y]);
  if (sym.includes("v")) o.push([x, R - 1 - y]);
  if (sym === "hv") o.push([C - 1 - x, R - 1 - y]);
  return o;
}
function bfs(g, sx, sy, pass) {
  const d = new Int16Array(N).fill(-1), q = [key(sx, sy)];
  d[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const k = q[h], x = k % C, y = (k / C) | 0;
    for (const [dx, dy] of D4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= C || ny >= R) continue;
      const nk = key(nx, ny);
      if (d[nk] >= 0 || !pass(g[nk])) continue;
      d[nk] = d[k] + 1; q.push(nk);
    }
  }
  return d;
}
/* structural rules over the class map (any non-W is bomb-passable): V1 one
   region, V7 SHRINK-safe rings 1..4, V8 dead ends, V9 no wall on (odd,odd) */
function structFails(m) {
  const nw = (v) => v !== W, f = [];
  const d = bfs(m, 1, 1, nw);
  for (let i = 0; i < N; i++) if (m[i] !== W && d[i] < 0) { f.push("V1"); break; }
  for (let gen = 1; gen <= 4 && !f.includes("V7"); gen++) {
    const g = m.slice();
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
      if (x === 1 && y === 1) continue;
      const rim = Math.min(x, C - 1 - x, y, R - 1 - y);
      if (rim >= 1 && rim <= gen) g[key(x, y)] = W;
    }
    let st = -1;
    for (let i = 0; i < N; i++) if (g[i] !== W && i !== key(1, 1)) { st = i; break; }
    if (st < 0) break;
    const dd = bfs(g, st % C, (st / C) | 0, nw);
    for (let i = 0; i < N; i++) if (g[i] !== W && i !== key(1, 1) && dd[i] < 0) { f.push("V7"); break; }
  }
  const isW = (x, y) => m[key(x, y)] === W;
  const nb = (x, y) => D4.filter(([dx, dy]) => !isW(x + dx, y + dy)).map(([dx, dy]) => [x + dx, y + dy]);
  let dead = 0;
  for (let y = 1; y < R - 1; y++) for (let x = 1; x < C - 1; x++) {
    if (isW(x, y)) continue;
    const n = nb(x, y);
    if (n.length <= 1) dead++;
    if (n.length === 1 && !f.includes("V8d")) {
      let dep = 1, px = x, py = y, [cx, cy] = n[0];
      while (nb(cx, cy).length === 2 && dep < 20) { const q = nb(cx, cy).find(([a, b]) => a !== px || b !== py); px = cx; py = cy; [cx, cy] = q; dep++; }
      if (dep > 3) f.push("V8d");
    }
  }
  for (let y = 1; y < R - 1; y++) for (let x = 1; x < C - 1; x++) if (x % 2 && y % 2 && isW(x, y) && !f.includes("V9")) f.push("V9");
  if (dead > 4) f.push("V8");
  return f;
}
function withPocket(m) {
  const t = m.slice();
  POCKET.forEach((k) => (t[k] = E));
  return t;
}

/* stage 1: skeleton, keyed (seed, room, attempt). Heat never reaches it. */
export function skeleton2(seed, level, attempt = 0) {
  const biome = BIOME2[(Math.max(1, level | 0) - 1) % 8];
  const rng = createRng(hash(seed, level, 0x5ce1, attempt));
  const fam = TPL[biome], tp = fam[rng.int(0, fam.length - 1)];
  const flip = FINALE[biome] && biome === "CROWN" ? 2 + rng.int(0, 1) : rng.int(0, 3);
  const pBreak = 0.25 + 0.1 * (level > 5), pAdd = 0.35;
  const m = new Int8Array(N), done = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (done[i]) continue;
    const ch = tp.g[i], x = i % C, y = (i / C) | 0;
    let v;
    if (ch === "#") v = W; else if (ch === ".") v = E; else if (ch === "b") v = B;
    else if (ch === "?") v = F; else if (ch === "s") v = S;
    else if (ch === "x") v = rng.next() < pBreak ? F : W;
    else if (ch === "o") v = rng.next() < pAdd ? W : F;
    for (const [a, b] of mir(x, y, tp.sym)) if (tp.g[key(a, b)] === ch && !done[key(a, b)]) { m[key(a, b)] = v; done[key(a, b)] = 1; }
  }
  const edits = [];
  for (const [kind, lo, hi] of STAMPS[biome]) {
    const n = rng.int(lo, hi);
    for (let k = 0; k < n; k++) {
      let x = 0, y = 0, tries = 0, ok = false;
      while (tries++ < 20 && !ok) {
        x = rng.int(2, 12); y = rng.int(2, 10);
        if (kind === "RUIN" || kind === "PLAZA") { x &= ~1; y &= ~1; } else if (kind === "JOINH") { x |= 1; y &= ~1; } else { x &= ~1; y |= 1; }
        if (mir(x, y, tp.sym).some(([a, b]) => { const p = flip & 1 ? C - 1 - a : a, q = flip & 2 ? R - 1 - b : b; return p <= 4 && q <= 4; })) continue;
        if (x < 2 || y < 2 || x > 12 || y > 10) continue;
        const v = m[key(x, y)];
        ok = kind === "RUIN" || kind === "PLAZA" ? v === W : v !== W;
      }
      if (!ok) continue;
      if (GUARD[biome] && mir(x, y, tp.sym).some(([a, b]) => guarded(tp.g, kind, a, b))) continue;
      const undo = m.slice();
      for (const [a, b] of mir(x, y, tp.sym)) {
        if (kind === "JOINH" || kind === "JOINV") m[key(a, b)] = W;
        else if (kind === "RUIN") m[key(a, b)] = F;
        else for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const p = a + dx, q = b + dy;
          if (p > 0 && q > 0 && p < C - 1 && q < R - 1) m[key(p, q)] = E;
        }
      }
      if (structFails(withPocket(m)).length) m.set(undo); else edits.push(kind);
    }
  }
  const out = new Int8Array(N);
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
    const sx = flip & 1 ? C - 1 - x : x, sy = flip & 2 ? R - 1 - y : y;
    out[key(x, y)] = m[key(sx, sy)];
  }
  POCKET.forEach((k) => (out[k] = E));
  DOORS.forEach((k) => (out[k] = B));
  if (RULE2.seal) for (const k of POCKET) for (const [dx, dy] of D4) {
    const n = key((k % C) + dx, ((k / C) | 0) + dy);
    if (!POCKET.includes(n) && out[n] !== W) out[n] = B;
  }
  FAR.forEach((k) => { if (out[k] !== W) out[k] = E; });
  return { m: out, tpl: tp.n, sym: tp.sym, biome, flip, edits, fails: structFails(out) };
}

/* stage 2: fill, keyed (seed, room, heat, attempt). Exact budget = the v1
   board's brick count for the same (seed, room, heat). Blob-weighted carve,
   sparse cells twice as likely to open; finales carve on mirror orbits. */
export function fill2(sk, seed, level, heat, attempt = 0) {
  const rng = createRng(hash(seed, level, heat, 0xf111, attempt));
  const v1 = genBoard(seed, level, CARVE1[heat]);
  let target = 0;
  for (let i = 0; i < N; i++) if (v1[i] === T.BRICK) target++;
  target -= CUT[sk.biome] || 0;
  const g = new Int8Array(N);
  let fixed = 0;
  for (let i = 0; i < N; i++) { const v = sk.m[i]; g[i] = v === W ? T.WALL : v === E ? T.EMPTY : T.BRICK; if (v === B) fixed++; }
  const blobs = [];
  for (let i = 0, nb = rng.int(1, 3); i < nb; i++) blobs.push([rng.int(2, C - 3), rng.int(2, R - 3), 1.5 + rng.next() * 2.5]);
  const sym = FINALE[sk.biome] ? sk.sym : "none", seen = new Uint8Array(N), reps = [];
  let elig = 0;
  for (let y = 1; y < R - 1; y++) for (let x = 1; x < C - 1; x++) {
    const k = key(x, y), v = sk.m[k];
    if ((v !== F && v !== S) || seen[k]) continue;
    const orb = mir(x, y, sym).map(([a, b]) => key(a, b)).filter((q, j, arr) => arr.indexOf(q) === j && (sk.m[q] === F || sk.m[q] === S) && !seen[q]);
    orb.forEach((q) => (seen[q] = 1));
    let w = 0.35;
    for (const [bx, by, s] of blobs) w += Math.exp(-((x - bx) ** 2 + (y - by) ** 2) / (s * s));
    if (v === S) w *= 2.2;
    reps.push({ orb, k: -Math.log(1 - rng.next()) / w });
    elig += orb.length;
  }
  const keep = Math.max(0, Math.min(elig, target - fixed));
  let open = elig - keep, carved = 0;
  reps.sort((a, b) => a.k - b.k);
  for (const r of reps) { if (carved >= open) break; r.orb.forEach((q) => (g[q] = T.EMPTY)); carved += r.orb.length; }
  return { grid: g, target };
}

/* gen-2 foe eligibility (critic §2a.3): every foe >= 7 EMPTY steps or no
   EMPTY path; hunters >= 8; phasers also >= 5 bomb-path steps */
const HUNT = new Set(["fast", "chaser", "knight"]), PHASE = new Set(["boomerang", "rocket", "shade"]);
/* FAIR START (2026-10-20): seal = every exit of the spawn pocket is a brick
   door; mode "path" = every foe starts >= dAll bomb-path steps (bricks count
   as passable: the real route once the doors are open), hunters >= dHunt.
   mode "empty" = the previous bold rule, kept for the A/B sweep. */
export const RULE2 = { seal: true, mode: "path", dAll: 10, dHunt: 12 };
export function foeOk2(type, e, b) {
  if (RULE2.mode === "path") return b < 0 || b >= (HUNT.has(type) ? RULE2.dHunt : RULE2.dAll);
  if (e >= 0 && e < (HUNT.has(type) ? 8 : 7)) return false;
  if (PHASE.has(type) && b >= 0 && b < 5) return false;
  return true;
}
export function dists2(g, sx = 1, sy = 1) {
  return { e: bfs(g, sx, sy, (v) => v === T.EMPTY), b: bfs(g, sx, sy, (v) => v !== T.WALL) };
}

function blastSet(g, cx, cy, r, pierce, line, dir) {
  const out = new Set([key(cx, cy)]);
  for (const d of line ? [dir] : D4.map(([x, y]) => ({ x, y }))) for (let i = 1; i <= r; i++) {
    const tx = cx + d.x * i, ty = cy + d.y * i, v = g[key(tx, ty)];
    if (v === undefined || v === T.WALL) break;
    out.add(key(tx, ty));
    if (v === T.BRICK && !pierce && !line) break;
  }
  return out;
}
/* play rules: ESC <= 4 at every reach/kind, V3 roster + floor fit on the
   strictest eligibility, V5 brick band */
export function playFails(g, level, heat) {
  const f = [], P = heatProfile(heat), roster = heatRoster(level, heat);
  const { e, b } = dists2(g);
  let worst = 0;
  const kinds = [];
  for (let r = 1; r <= 10; r++) kinds.push([r, false, false, null]);
  kinds.push([8, true, false, null]);
  for (const [x, y] of D4) kinds.push([8, false, true, { x, y }]);
  for (const [r, pi, li, dir] of kinds) {
    const bl = blastSet(g, 1, 1, r, pi, li, dir);
    let best = 99;
    for (let k = 0; k < N; k++) if (e[k] >= 0 && !bl.has(k) && e[k] < best) best = e[k];
    worst = Math.max(worst, best);
  }
  if (worst > 4) f.push("ESC");
  const clr = (CFG.TILE * CFG.SPAWN_CLEAR) ** 2;
  let strict = 0, free = 0, bricks = 0;
  for (let y = 1; y < R - 1; y++) for (let x = 1; x < C - 1; x++) {
    const k = key(x, y);
    if (g[k] === T.BRICK) bricks++;
    if (g[k] !== T.EMPTY) continue;
    const dx = (x - 1) * CFG.TILE, dy = (y - 1) * CFG.TILE;
    if (dx * dx + dy * dy < clr) continue;
    free++;
    if (foeOk2("knight", e[k], b[k]) && foeOk2("shade", e[k], b[k])) strict++;
  }
  const floor = P.bare ? 0 : Math.max(P.floorMin, P.floorAdd + level);
  if (strict < roster.length || free < roster.length + floor) f.push("V3");
  if (bricks < Math.max(40, 3 * (P.buriedAdd + level)) || bricks > 90) f.push("V5");
  return f;
}

export function genBoard2(seed, level, heat = 0) {
  for (let a = 0; a < 8; a++) {
    const sk = skeleton2(seed, level, a);
    if (sk.fails.length) continue;
    const pf = FEAT.on ? placeFeat(sk.m, seed, level, sk.biome) : null;
    if (pf && pf.feat) for (const k of pf.force) sk.m[k] = E;
    for (let m = 0; m < 8; m++) {
      const fl = fill2(sk, seed, level, heat, m);
      if (!playFails(fl.grid, level, heat).length)
        return { grid: fl.grid, feat: pf && pf.feat, layout: { name: sk.biome + " · " + sk.tpl.toUpperCase(), tpl: sk.tpl, flip: sk.flip, edits: sk.edits, skAttempt: a, fillAttempt: m, fallback: false, featKind: pf ? pf.kind : null, featFallback: !!(pf && pf.fallback) } };
    }
    break;
  }
  return { grid: genBoard(seed, level, CARVE1[heat]), feat: null, layout: { name: "v1 LATTICE (fallback)", tpl: "lattice", flip: 0, edits: [], fallback: true } };
}
