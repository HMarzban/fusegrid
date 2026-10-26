/* THROWAWAY PROTOTYPE (2026-10-21 tile round, wave 1): the floor-feature
   layer world.feat. Codes: 1..4 BELT E/S/W/N, 5 GLIDE, 6 BLOOM, 7 PLATE.
   Tables follow 04-synthesis §7.2 exactly; `tier` is heat (or an arm
   override, world.featTier). Placement is keyed (seed, room) only and runs
   on the gen-2 skeleton after stamps and flip, so heat never moves a tile.
   Never merges.
   ART-ONLY CODES 8..14 (2026-10-25 integration): 8..11 STREAM E/S/W/N, 12 QUICK,
   13 PORTAL (pair id 1/2 in world.featPair), 14 GATE (lit in world.featM, always
   0 = open). The sim never reads them (it tests only 1..7), so a WATER / SAND /
   VOID / CROWN gen-2 room is placed for its look and plays exactly as without the
   layer until the sim rules land (#19-#22). HOME is the one room-biome -> tile
   table. */
import { CFG, key } from "./config.js";
import { createRng } from "./rng.js";

const C = CFG.COLS, R = CFG.ROWS, N = C * R;
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const F = Object.freeze({ NONE: 0, BELT_E: 1, BELT_S: 2, BELT_W: 3, BELT_N: 4, GLIDE: 5, BLOOM: 6, PLATE: 7, STREAM_E: 8, STREAM_S: 9, STREAM_W: 10, STREAM_N: 11, QUICK: 12, PORTAL: 13, GATE: 14 });
export const FDIR = Object.freeze([[1, 0], [0, 1], [-1, 0], [0, -1]]);
export const isBelt = (v) => v >= 1 && v <= 4;
export const beltDir = (v) => FDIR[v - 1];
export const HOME = Object.freeze({ FACTORY: "BELT", ICE: "GLIDE", JUNGLE: "BLOOM", ARENA: "PLATE", WATER: "STREAM", SAND: "QUICK", VOID: "PORTAL", CROWN: "GATE" });

export const FEAT_PROFILE = Object.freeze([
  Object.freeze({ belt: { actors: false, v: 1.0 }, glide: { boost: 1.25, coast: 0, turn: 0.35 }, bloom: { fwd: 2, side: 0, delay: 0, cd: 1.0 }, plate: { wind: 0.5, r: 1, cd: 3, inert: 2, near: 4, off: 1, hold: true, chain: false } }),
  Object.freeze({ belt: { actors: true, v: 1.0 }, glide: { boost: 1.25, coast: 1, turn: 0.2 }, bloom: { fwd: 2, side: 1, delay: 0.15, cd: 1.0 }, plate: { wind: 0.8, r: 2, cd: 4, inert: 2, near: 4, off: 1, hold: true, chain: false, spare: true } }),
  Object.freeze({ belt: { actors: true, v: 1.2 }, glide: { boost: 1.25, coast: 3, turn: 0.1 }, bloom: { fwd: 2, side: 2, delay: 0.3, cd: 1.0 }, plate: { wind: 1.0, r: 3, cd: 3, inert: 6, off: 1, hold: true, chain: false, kill: false } }),
]);
export const TILE_HELP = Object.freeze({
  BELT: ["CARRIES BOMBS", "CARRIES BOMBS, YOU, FOES", "CARRIES ALL, FAST"],
  GLIDE: ["FAST ICE, STOP ANY TIME", "FAST ICE, SLIDES A STEP", "FAST ICE, NO STOPPING"],
  BLOOM: ["THROWS YOUR BLAST ON", "BLAST LEAKS SIDEWAYS", "BLAST TURNS CORNERS LATE"],
  PLATE: ["LURE FOES ON · SHORT", "TRIGGER FOE LIVES · LONG", "FOES IMMUNE · HUGE"],
});
export function featTier(w) {
  const t = w.featTier != null ? w.featTier : w.heat;
  return t < 0 ? 0 : t > 2 ? 2 : t | 0;
}
/* PLATE knobs (#28 design pass 2): near = arms only with the player within
   that many tiles (Manhattan; absent = anywhere); off = never arms while the
   player is on or within that many tiles of its lines; hold = never arms while
   a lit bomb's blast reaches its lines; chain false = its blast sets off no
   bomb (a number = no bomb younger than that many s); spare = the foe that
   armed it is immune to that blast; kill false = its blast kills no foe */
/* w.featProf: an optional 3-tier knob table set by the offline balance harness
   (tools/balance) after loadLevel; unset everywhere in the game */
export function featProfile(w) { return (w.featProf || FEAT_PROFILE)[featTier(w)]; }
export function featKindOf(v) { return isBelt(v) ? "BELT" : v === 5 ? "GLIDE" : v === 6 ? "BLOOM" : v === 7 ? "PLATE" : v >= 8 && v <= 11 ? "STREAM" : v === 12 ? "QUICK" : v === 13 ? "PORTAL" : v === 14 ? "GATE" : null; }

/* ---- placement (V13-V27 subset, see notes.md) ---- */
function fmix(h) {
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
const POCKET = [[1,1],[2,1],[1,2],[3,1],[4,1],[3,2],[1,3],[1,4],[2,3]];
const DOORS = [[5,1],[1,5]];
const open = (m, x, y) => x > 0 && y > 0 && x < C - 1 && y < R - 1 && m[key(x, y)] !== 0;
function bfs(m, sx, sy) {
  const d = new Int16Array(N).fill(-1), q = [key(sx, sy)];
  d[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const k = q[h], x = k % C, y = (k / C) | 0;
    for (const [dx, dy] of D4) {
      const nx = x + dx, ny = y + dy;
      if (!open(m, nx, ny)) continue;
      const nk = key(nx, ny);
      if (d[nk] >= 0) continue;
      d[nk] = d[k] + 1; q.push(nk);
    }
  }
  return d;
}
/* m: skeleton class map (0 wall, else open; bricks count as passable, the
   real route once the doors are open). Returns {feat, force, fails} or null. */
export function placeFeat(m, seed, level, biome, salt = 0) {
  const kind = HOME[biome];
  if (!kind) return null;
  const rng = createRng(fmix((seed ^ Math.imul(level + 1, 0x9e3779b1) ^ 0x7ea7 ^ Math.imul(salt, 0x27d4eb2f)) >>> 0));
  const dS = bfs(m, 1, 1), dD = DOORS.map(([x, y]) => bfs(m, x, y));
  const near = (x, y) => { const k = key(x, y); return dS[k] >= 0 && dS[k] <= 4 || DOORS.some(([a, b]) => a === x && b === y); };
  const far = (x, y) => open(m, x, y) && dS[key(x, y)] > 4 && !DOORS.some(([a, b]) => a === x && b === y);
  for (let tries = 0; tries < 40; tries++) {
    const f = new Uint8Array(N), force = [];
    let ok = false;
    let pair = null;
    if (kind === "BELT") ok = belt(m, f, rng, near, dD);
    else if (kind === "GLIDE") ok = glide(m, f, rng, dS);
    else if (kind === "BLOOM") ok = bloom(m, f, rng, force);
    else if (kind === "STREAM") ok = stream(m, f, rng, far, force);
    else if (kind === "QUICK") ok = quick(m, f, rng, far, force);
    else if (kind === "PORTAL") { pair = new Uint8Array(N); ok = portal(m, f, rng, far, force, pair); }
    else if (kind === "GATE") ok = gate(m, f, rng, far, force);
    else ok = plate(m, f, rng, dS, force);
    if (ok) return pair ? { feat: f, force, kind, tries, pair } : { feat: f, force, kind, tries };
  }
  return { feat: null, force: [], kind, tries: 40, fallback: true };
}
/* V15 + V17: straight acyclic chains on odd lanes, 4-9 tiles, total <= 16;
   entry and landing tiles open with >= 2 open neighbours; a step-off within
   2 tiles downstream; the landing tile >= 10 walking steps from both doors */
function belt(m, f, rng, near, dD) {
  const runs = [];
  for (let y = 1; y < R - 1; y += 2) {
    let x = 1;
    while (x < C - 1) { if (!open(m, x, y)) { x++; continue; } const s = x; while (open(m, x, y)) x++; if (x - s >= 6) runs.push({ h: true, a: s, b: x - 1, l: y }); }
  }
  for (let x = 1; x < C - 1; x += 2) {
    let y = 1;
    while (y < R - 1) { if (!open(m, x, y)) { y++; continue; } const s = y; while (open(m, x, y)) y++; if (y - s >= 6) runs.push({ h: false, a: s, b: y - 1, l: x }); }
  }
  if (!runs.length) return false;
  const want = rng.int(1, 2);
  let total = 0, made = 0;
  const order = runs.map((r) => [rng.next(), r]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
  for (const r of order) {
    if (made >= want) break;
    for (let t = 0; t < 12; t++) {
      const L = rng.int(4, Math.min(9, r.b - r.a - 1, 16 - total));
      if (L < 4) break;
      const s = rng.int(r.a + 1, r.b - L);
      const dir = rng.int(0, 1) ? 1 : -1;
      const at = (i) => (r.h ? [s + i, r.l] : [r.l, s + i]);
      const cells = []; for (let i = 0; i < L; i++) cells.push(at(i));
      if (dir < 0) cells.reverse();
      const [ex, ey] = r.h ? [cells[0][0] - dir, r.l] : [r.l, cells[0][1] - dir];
      const [lx, ly] = r.h ? [cells[L - 1][0] + dir, r.l] : [r.l, cells[L - 1][1] + dir];
      if (!open(m, ex, ey) || !open(m, lx, ly)) continue;
      const nOpen = (x, y) => D4.filter(([dx, dy]) => open(m, x + dx, y + dy)).length;
      if (nOpen(ex, ey) < 2 || nOpen(lx, ly) < 2) continue;
      if (cells.some(([x, y]) => near(x, y) || f[key(x, y)] || D4.some(([dx, dy]) => f[key(x + dx, y + dy)]))) continue;
      if (f[key(lx, ly)] || f[key(ex, ey)]) continue;
      if (dD.some((d) => { const v = d[key(lx, ly)]; return v >= 0 && v < 10; })) continue;
      const perp = (x, y) => (r.h ? open(m, x, y - 1) || open(m, x, y + 1) : open(m, x - 1, y) || open(m, x + 1, y));
      let stepOk = true;
      for (let i = 0; i < L && stepOk; i++) {
        let any = false;
        for (let j = i; j <= Math.min(L, i + 2); j++) { const [x, y] = j < L ? cells[j] : [lx, ly]; if (j === L || perp(x, y)) { any = true; break; } }
        stepOk = any;
      }
      if (!stepOk) continue;
      const code = r.h ? (dir > 0 ? 1 : 3) : (dir > 0 ? 2 : 4);
      for (const [x, y] of cells) f[key(x, y)] = code;
      total += L; made++;
      break;
    }
  }
  return made > 0;
}
/* V24: rings of 8 around one pillar (runs of 3 at most), 1-2 rings, never
   within 4 walking steps of spawn; rings never share or touch a run */
function glide(m, f, rng, dS) {
  const want = rng.int(1, 2), cand = [];
  for (let y = 2; y < R - 2; y += 2) for (let x = 2; x < C - 2; x += 2) {
    if (m[key(x, y)] !== 0) continue;
    let ok = true;
    for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1 && ok; dx++) {
      if (!dx && !dy) continue;
      const k = key(x + dx, y + dy);
      if (!open(m, x + dx, y + dy) || dS[k] < 0 || dS[k] <= 4) ok = false;
    }
    if (ok) cand.push([x, y]);
  }
  if (!cand.length) return false;
  for (let i = cand.length - 1; i > 0; i--) { const j = rng.int(0, i); [cand[i], cand[j]] = [cand[j], cand[i]]; }
  const used = [];
  for (const [x, y] of cand) {
    if (used.length >= want) break;
    if (used.some(([a, b]) => Math.abs(a - x) < 4 && Math.abs(b - y) < 4)) continue;
    used.push([x, y]);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) f[key(x + dx, y + dy)] = 5;
  }
  return used.length > 0 && runsOk(f);
}
function runsOk(f) {
  for (let y = 0; y < R; y++) { let n = 0; for (let x = 0; x < C; x++) { n = f[key(x, y)] === 5 ? n + 1 : 0; if (n > 3) return false; } }
  for (let x = 0; x < C; x++) { let n = 0; for (let y = 0; y < R; y++) { n = f[key(x, y)] === 5 ? n + 1 : 0; if (n > 3) return false; } }
  return true;
}
const farPocket = (x, y, d) => POCKET.concat(DOORS).every(([a, b]) => Math.abs(a - x) + Math.abs(b - y) >= d);
/* V25: 2-4 on (odd,odd), >= 4 Manhattan from the pocket and doors, no two
   within 3 in a row or column, forced floor (never under a fill brick) */
function bloom(m, f, rng, force) {
  const want = rng.int(2, 4), cand = [];
  for (let y = 1; y < R - 1; y += 2) for (let x = 1; x < C - 1; x += 2) if (open(m, x, y) && farPocket(x, y, 4)) cand.push([x, y]);
  for (let i = cand.length - 1; i > 0; i--) { const j = rng.int(0, i); [cand[i], cand[j]] = [cand[j], cand[i]]; }
  const used = [];
  for (const [x, y] of cand) {
    if (used.length >= want) break;
    if (used.some(([a, b]) => (a === x && Math.abs(b - y) <= 3) || (b === y && Math.abs(a - x) <= 3))) continue;
    used.push([x, y]);
  }
  if (used.length < 2) return false;
  for (const [x, y] of used) { f[key(x, y)] = 6; force.push(key(x, y)); }
  return true;
}
/* V26 + V27: 3-5 on (odd,odd), >= 6 walking steps from spawn, no two on
   neighbouring intersections, forced floor; every tile on its r=3 arms has
   a perpendicular open neighbour within 1 tile along the arm */
function plate(m, f, rng, dS, force) {
  const want = rng.int(3, 5), cand = [];
  for (let y = 1; y < R - 1; y += 2) for (let x = 1; x < C - 1; x += 2) {
    const k = key(x, y);
    if (!open(m, x, y) || dS[k] < 6 || !sideExit(m, x, y)) continue;
    cand.push([x, y]);
  }
  for (let i = cand.length - 1; i > 0; i--) { const j = rng.int(0, i); [cand[i], cand[j]] = [cand[j], cand[i]]; }
  const used = [];
  for (const [x, y] of cand) {
    if (used.length >= want) break;
    if (used.some(([a, b]) => Math.abs(a - x) + Math.abs(b - y) <= 2)) continue;
    used.push([x, y]);
  }
  if (used.length < 3) return false;
  for (const [x, y] of used) { f[key(x, y)] = 7; force.push(key(x, y)); }
  return true;
}
const shuf = (a, rng) => { for (let i = a.length - 1; i > 0; i--) { const j = rng.int(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const manh = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const clearOf = (f, x, y) => !f[key(x, y)] && D4.every(([dx, dy]) => !f[key(x + dx, y + dy)]);
/* art-only STREAM: 1-2 runs of 3-6 straight tiles in an open lane, one direction
   per run, every tile with a step-off (a side exit, or the open tile past the
   run) within 2 tiles downstream; never within 4 steps of spawn or on a door */
function stream(m, f, rng, far, force) {
  const lanes = [];
  for (let y = 1; y < R - 1; y++) { let x = 1; while (x < C - 1) { if (!far(x, y)) { x++; continue; } const s = x; while (far(x, y)) x++; if (x - s >= 3) lanes.push({ h: true, a: s, b: x - 1, l: y }); } }
  for (let x = 1; x < C - 1; x++) { let y = 1; while (y < R - 1) { if (!far(x, y)) { y++; continue; } const s = y; while (far(x, y)) y++; if (y - s >= 3) lanes.push({ h: false, a: s, b: y - 1, l: x }); } }
  if (!lanes.length) return false;
  const want = rng.int(1, 2);
  let made = 0;
  for (const r of shuf(lanes, rng)) {
    if (made >= want) break;
    for (let t = 0; t < 8; t++) {
      const L = rng.int(3, Math.min(6, r.b - r.a + 1)), s = rng.int(r.a, r.b - L + 1), dir = rng.int(0, 1) ? 1 : -1;
      const cells = []; for (let i = 0; i < L; i++) cells.push(r.h ? [s + i, r.l] : [r.l, s + i]);
      if (dir < 0) cells.reverse();
      if (!cells.every(([x, y]) => clearOf(f, x, y))) continue;
      const [lx, ly] = r.h ? [cells[L - 1][0] + dir, r.l] : [r.l, cells[L - 1][1] + dir];
      const perp = (x, y) => (r.h ? open(m, x, y - 1) || open(m, x, y + 1) : open(m, x - 1, y) || open(m, x + 1, y));
      let ok = true;
      for (let i = 0; i < L && ok; i++) {
        let any = false;
        for (let j = i; j <= Math.min(L, i + 2); j++) if (j === L ? open(m, lx, ly) : perp(cells[j][0], cells[j][1])) { any = true; break; }
        ok = any;
      }
      if (!ok) continue;
      const code = r.h ? (dir > 0 ? 8 : 10) : (dir > 0 ? 9 : 11);
      for (const [x, y] of cells) { f[key(x, y)] = code; force.push(key(x, y)); }
      made++;
      break;
    }
  }
  return made > 0;
}
/* art-only QUICK: 3-5 singles, no two within 4 Manhattan, none within 4 steps of spawn */
function quick(m, f, rng, far, force) {
  const want = rng.int(3, 5), cand = [], used = [];
  for (let y = 1; y < R - 1; y++) for (let x = 1; x < C - 1; x++) if (far(x, y)) cand.push([x, y]);
  for (const c of shuf(cand, rng)) {
    if (used.length >= want) break;
    if (used.some((u) => manh(u, c) < 4)) continue;
    used.push(c);
  }
  if (used.length < 3) return false;
  for (const [x, y] of used) { f[key(x, y)] = 12; force.push(key(x, y)); }
  return true;
}
/* art-only PORTAL: 1-2 pairs (pair id 1, 2 in `pair`), each pair >= 8 walking steps
   and >= 8 Manhattan apart, no two tiles within 3 of each other */
function portal(m, f, rng, far, force, pair) {
  const cand = [], used = [];
  for (let y = 1; y < R - 1; y++) for (let x = 1; x < C - 1; x++) if (far(x, y)) cand.push([x, y]);
  shuf(cand, rng);
  const want = rng.int(1, 2);
  let made = 0;
  for (let id = 1; id <= want; id++) {
    let got = false;
    for (let i = 0; i < cand.length && !got; i++) {
      const a = cand[i];
      if (used.some((u) => manh(u, a) < 3)) continue;
      const d = bfs(m, a[0], a[1]);
      for (let j = 0; j < cand.length; j++) {
        const b = cand[j];
        if (j === i || manh(a, b) < 8 || d[key(b[0], b[1])] < 8 || used.some((u) => manh(u, b) < 3)) continue;
        used.push(a, b);
        for (const [x, y] of [a, b]) { f[key(x, y)] = 13; pair[key(x, y)] = id; force.push(key(x, y)); }
        got = true; made++;
        break;
      }
    }
  }
  return made > 0;
}
/* art-only GATE: 2-3 singles on straight corridor tiles (two opposite open
   neighbours, nothing else), no two within 4 Manhattan; featM stays 0 = open */
function gate(m, f, rng, far, force) {
  const want = rng.int(2, 3), cand = [], used = [];
  const o = (x, y) => open(m, x, y);
  for (let y = 1; y < R - 1; y++) for (let x = 1; x < C - 1; x++) {
    if (!far(x, y)) continue;
    const h = o(x - 1, y) && o(x + 1, y) && !o(x, y - 1) && !o(x, y + 1), v = o(x, y - 1) && o(x, y + 1) && !o(x - 1, y) && !o(x + 1, y);
    if (h || v) cand.push([x, y]);
  }
  for (const c of shuf(cand, rng)) {
    if (used.length >= want) break;
    if (used.some((u) => manh(u, c) < 4)) continue;
    used.push(c);
  }
  if (used.length < 2) return false;
  for (const [x, y] of used) { f[key(x, y)] = 14; force.push(key(x, y)); }
  return true;
}
export function sideExit(m, x, y) {
  const perpOpen = (px, py, dx, dy) => open(m, px + dy, py + dx) || open(m, px - dy, py - dx);
  for (const [dx, dy] of D4) {
    const arm = [[x, y]];
    for (let i = 1; i <= 3; i++) { if (!open(m, x + dx * i, y + dy * i)) break; arm.push([x + dx * i, y + dy * i]); }
    for (let i = 1; i < arm.length; i++) {
      let ok = false;
      for (let j = Math.max(0, i - 1); j <= Math.min(arm.length - 1, i + 1); j++) if (perpOpen(arm[j][0], arm[j][1], dx, dy)) { ok = true; break; }
      if (!ok) return false;
    }
  }
  return true;
}
/* spawner exclusion: no foe on a feature tile, none within 1 of a PLATE */
export function spawnBlocked(feat, x, y) {
  if (!feat) return false;
  if (feat[key(x, y)]) return true;
  for (const [dx, dy] of D4) if (feat[key(x + dx, y + dy)] === 7) return true;
  return false;
}
/* V17 time-weighted foe distance: bomb-path steps from the spawn where a
   foe crossing a BELT tile at actor-riding heats pays vf/(vf+-v) steps per
   tile (vf = the slowest moving foe, the conservative case). */
export function beltDist(grid, feat, v, vf, sx = 1, sy = 1) {
  const d = new Float32Array(N).fill(Infinity), done = new Uint8Array(N);
  d[key(sx, sy)] = 0;
  for (;;) {
    let k = -1, best = Infinity;
    for (let i = 0; i < N; i++) if (!done[i] && d[i] < best) { best = d[i]; k = i; }
    if (k < 0) break;
    done[k] = 1;
    const x = k % C, y = (k / C) | 0;
    for (const [dx, dy] of D4) {
      const nx = x + dx, ny = y + dy, nk = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= C || ny >= R || grid[nk] === 2 || done[nk]) continue;
      const f = feat[nk];
      let c = 1;
      if (isBelt(f)) { const [bx, by] = beltDir(f); c = bx === -dx && by === -dy ? vf / (vf + v) : bx === dx && by === dy ? vf / Math.max(0.1, vf - v) : 1; }
      if (d[k] + c < d[nk]) d[nk] = d[k] + c;
    }
  }
  return d;
}
