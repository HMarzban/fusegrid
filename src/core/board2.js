/* Gen 2 (#12): the 14 bold biome layouts of
   docs/superpowers/specs/2026-10-20-level-variety-layouts.md. Stage 1, the
   layout, is keyed (seed, room, attempt): template, x per mirror orbit, the
   biome's stamps, the board transform, then the fair-start stamp. Stage 2,
   the fill, is keyed (seed, room, heat, attempt) and changes bricks only, on
   an exact budget (the gen-1 count for the same seed / room / heat minus CUT).
   The gate: up to TRIES layouts, the first structurally valid one gets up to
   TRIES fills against validateBoard (fair.js); else the fair fallback, the
   gen-1 grid with the fair-start stamp. Gen 3 (?gen=3 only) is the same board
   plus the world.feat tile layer, whose placement may force EMPTY tiles; gen 2
   itself never carries a tile.
   Templates: # wall  x pillar that may ruin  o lane slot that may join
   . reserved floor  b reserved brick  ? fill  s sparse fill. The appendix
   grids, except THRONE / COURT (V10 occlusion probe, tests/three.test.mjs):
   their E-W lane walls hid the row behind at rig C even capped at NEAR_H, so
   they are re-authored N-S like VAULT (TPL_EDITS). */
import { CFG, T, key, biomeOf, isFinale, EW_CAPPED } from "./config.js";
import { createRng } from "./rng.js";
import { genBoard } from "./board.js";
import { heatProfile } from "./heat.js";
import { placeFeat, FEAT_PROFILE } from "./feat.js";
/* EXPERIMENT (#28 BOOSTER lane): the static V18 / V19 checks gate BOOSTER placement;
   #18 moves featchecks.mjs into src/core unchanged (only the import path changes) */
import { featChecks } from "../../tools/balance/featchecks.mjs";
import { validateBoard, stampStart, STRUCT, TRIES, POCKET, DOORS, CORNERS } from "./fair.js";

const C = CFG.COLS, R = CFG.ROWS, N = C * R;
export const TPL = {
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
#?#?#?#b#?#?#?#
#?????...?????#
#?#?#?#.#?#?#?#
#???#?...?#???#
#?#?#?#.#?#?#?#
#???#?...?#???#
#?#?#?#.#?#?#?#
#?????...?????#
#?#?#?#.#?#?#?#
#?????...?????#
###############`},{n:"court",sym:"h",t:`
###############
#?????s.s?????#
#?#?#?#b#?#?#?#
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
export const TPL_EDITS = Object.freeze({
  "CROWN/throne": Object.freeze([[7, 2, "#", "b"], [5, 4, "#", "?"], [9, 4, "#", "?"], [5, 8, "#", "?"], [9, 8, "#", "?"], [4, 5, "?", "#"], [10, 5, "?", "#"], [4, 7, "?", "#"], [10, 7, "?", "#"]]),
  "CROWN/court": Object.freeze([[7, 2, "#", "b"]]),
});
for (const b in TPL) for (const t of TPL[b]) t.g = t.t.trim().split("\n").join("");
const W = 0, E = 1, B = 2, F = 3, S = 4;
const STAMPS = {JUNGLE:[["RUIN",0,2],["PLAZA",0,1]],ICE:[["JOINV",1,3],["RUIN",0,2]],FACTORY:[["JOINH",1,3],["RUIN",0,1]],
  WATER:[["RUIN",1,3],["JOINV",0,2],["PLAZA",0,1]],ARENA:[["JOINV",0,2],["RUIN",0,2]],SAND:[["RUIN",1,3],["JOINH",0,1]],VOID:[["RUIN",1,3]],CROWN:[["JOINV",0,2],["RUIN",0,2]]};
const CUT = { JUNGLE: 6 }, CUT_ALL = 17;
const PLAY = ["V2", "V3", "V5", "V6", "V11", "V12", "SEAL"];
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const pillar = (x, y) => x % 2 === 0 && y % 2 === 0;
function guarded(tg, kind, x, y) {
  const at = (a, b) => (a <= 0 || b <= 0 || a >= C - 1 || b >= R - 1 ? "" : tg[key(a, b)]);
  const join = (a, b) => at(a, b) === "#" && !pillar(a, b);
  if (kind === "JOINH" || kind === "JOINV") return at(x, y) === "." || at(x, y) === "b";
  if (kind === "RUIN") return D4.some(([dx, dy]) => at(x + dx, y + dy) === "b" || join(x + dx, y + dy));
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const ch = at(x + dx, y + dy); if (ch === "." || ch === "b" || join(x + dx, y + dy)) return true; }
  return false;
}
function fmix(h) {
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
const hash = (...p) => p.reduce((h, v, i) => fmix((h ^ Math.imul((v >>> 0) + 1, 0x9e3779b1 + i * 0x7feb352d)) >>> 0), 0xf2f2f2f2);
export function orbit(x, y, sym) {
  const o = [[x, y]];
  if (sym.includes("h")) o.push([C - 1 - x, y]);
  if (sym.includes("v")) o.push([x, R - 1 - y]);
  if (sym === "hv") o.push([C - 1 - x, R - 1 - y]);
  return o;
}
const flipK = (k, flip) => { const x = k % C, y = (k / C) | 0; return key(flip & 1 ? C - 1 - x : x, flip & 2 ? R - 1 - y : y); };
const toGrid = (m) => Int8Array.from(m, (v) => (v === W ? T.WALL : v === E ? T.EMPTY : T.BRICK));
const inPocket = new Uint8Array(N);
POCKET.forEach((k) => (inPocket[k] = 1));
function placed(m, flip) {
  const out = new Int8Array(N);
  for (let k = 0; k < N; k++) out[k] = m[flipK(k, flip)];
  POCKET.forEach((k) => (out[k] = E));
  DOORS.forEach((k) => (out[k] = B));
  for (const k of POCKET) for (const [dx, dy] of D4) { const n = key((k % C) + dx, ((k / C) | 0) + dy); if (!inPocket[n] && out[n] !== W) out[n] = B; }
  CORNERS.forEach((k) => { if (out[k] !== W) out[k] = E; });
  return out;
}

/* stage 1: the layout, keyed (seed, room, attempt). Heat never reaches it. */
export function layout2(seed, level, attempt = 0) {
  const biome = biomeOf(level).name, rng = createRng(hash(seed, level, 0x5ce1, attempt));
  const fam = TPL[biome], tp = fam[rng.int(0, fam.length - 1)];
  const flip = biome === "CROWN" ? 2 + rng.int(0, 1) : rng.int(0, 3);
  const pRuin = level > 5 ? 0.35 : 0.25, pJoin = 0.35;
  const m = new Int8Array(N), done = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (done[i]) continue;
    const ch = tp.g[i], x = i % C, y = (i / C) | 0;
    const v = ch === "#" ? W : ch === "." ? E : ch === "b" ? B : ch === "?" ? F : ch === "s" ? S
      : ch === "x" ? (rng.next() < pRuin ? F : W) : rng.next() < pJoin ? W : F;
    for (const [a, b] of orbit(x, y, tp.sym)) { const k = key(a, b); if (tp.g[k] === ch && !done[k]) { m[k] = v; done[k] = 1; } }
  }
  const edits = [];
  for (const [kind, lo, hi] of STAMPS[biome]) for (let n = rng.int(lo, hi), j = 0; j < n; j++) {
    let x = 0, y = 0, ok = false;
    for (let t = 0; t < 20 && !ok; t++) {
      x = rng.int(2, 12); y = rng.int(2, 10);
      if (kind === "RUIN" || kind === "PLAZA") { x &= ~1; y &= ~1; } else if (kind === "JOINH") { x |= 1; y &= ~1; } else { x &= ~1; y |= 1; }
      if (x < 2 || y < 2 || x > 12 || y > 10) continue;
      if (orbit(x, y, tp.sym).some(([a, b]) => (flip & 1 ? C - 1 - a : a) <= 4 && (flip & 2 ? R - 1 - b : b) <= 4)) continue;
      ok = (kind === "RUIN" || kind === "PLAZA") === (m[key(x, y)] === W);
    }
    if (!ok || orbit(x, y, tp.sym).some(([a, b]) => guarded(tp.g, kind, a, b))) continue;
    const undo = m.slice();
    for (const [a, b] of orbit(x, y, tp.sym)) {
      if (kind === "JOINH" || kind === "JOINV") m[key(a, b)] = W;
      else if (kind === "RUIN") m[key(a, b)] = F;
      else for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const p = a + dx, q = b + dy;
        if (p > 0 && q > 0 && p < C - 1 && q < R - 1) m[key(p, q)] = E;
      }
    }
    if (validateBoard(toGrid(placed(m, flip)), level, 0, { only: STRUCT, capped: EW_CAPPED }).length) m.set(undo); else edits.push(kind);
  }
  return { m: placed(m, flip), tpl: tp.n, sym: tp.sym, biome, flip, edits, attempt };
}

/* stage 2: the fill, keyed (seed, room, heat, attempt). Target = the gen-1
   brick count minus CUT; fixed bricks count toward it; blob-weighted
   exponential keys carve the fill cells (finales on their mirror orbits). */
export function fill2(lay, seed, level, heat, attempt = 0) {
  const rng = createRng(hash(seed, level, heat, 0xf111, attempt)), v1 = genBoard(seed, level, heatProfile(heat).carve);
  let target = -(CUT[lay.biome] ?? CUT_ALL);
  for (let i = 0; i < N; i++) if (v1[i] === T.BRICK) target++;
  const g = new Int8Array(N);
  let fixed = 0;
  for (let i = 0; i < N; i++) { const v = lay.m[i]; g[i] = v === W ? T.WALL : v === E ? T.EMPTY : T.BRICK; if (v === B) fixed++; }
  const blobs = [];
  for (let i = 0, nb = rng.int(1, 3); i < nb; i++) blobs.push([rng.int(2, C - 3), rng.int(2, R - 3), 1.5 + rng.next() * 2.5]);
  const sym = isFinale(level) ? lay.sym : "none", seen = new Uint8Array(N), reps = [];
  let elig = 0;
  for (let y = 1; y < R - 1; y++) for (let x = 1; x < C - 1; x++) {
    const k = key(x, y), v = lay.m[k];
    if ((v !== F && v !== S) || seen[k]) continue;
    const orb = [];
    for (const [a, b] of orbit(x, y, sym)) { const q = key(a, b); if (!seen[q] && (lay.m[q] === F || lay.m[q] === S)) { seen[q] = 1; orb.push(q); } }
    let w = 0.35;
    for (const [bx, by, s] of blobs) w += Math.exp(-((x - bx) ** 2 + (y - by) ** 2) / (s * s));
    if (v === S) w *= 2.2;
    reps.push({ orb, k: -Math.log(1 - rng.next()) / w });
    elig += orb.length;
  }
  const open = elig - Math.max(0, Math.min(elig, target - fixed));
  reps.sort((a, b) => a.k - b.k);
  for (let i = 0, carved = 0; i < reps.length && carved < open; i++) { reps[i].orb.forEach((q) => (g[q] = T.EMPTY)); carved += reps[i].orb.length; }
  return { grid: g, target, cap: fixed + elig };
}

/* the fair fallback (V11): the gen-1 grid with the fair-start stamp; gen-2 foe placement follows in loadLevel */
export function fallback2(seed, level, heat) {
  return stampStart(genBoard(seed, level, heatProfile(heat).carve));
}
const gateOpts = (lay, a, m, ignore) => ({ only: PLAY, capped: EW_CAPPED, sym: lay.sym, flip: lay.flip, tries: [a, m], ignore });
const meta = (lay, a, m) => ({ name: lay.biome + " · " + lay.tpl.toUpperCase(), tpl: lay.tpl, flip: lay.flip, sym: lay.sym, edits: lay.edits, tries: [a, m], fallback: false });

/* generate -> validateBoard -> re-roll; opts.layouts / opts.fills cap the
   attempts (0 forces the fallback, for tests). */
export function genBoard2(seed, level, heat = 0, opts = {}) {
  if (opts.feat) return genBoard3(seed, level, heat);
  const LA = opts.layouts ?? TRIES, FI = opts.fills ?? TRIES;
  for (let a = 0; a < LA; a++) {
    const lay = layout2(seed, level, a);
    if (validateBoard(toGrid(lay.m), level, heat, { only: [...STRUCT, "SEAL"], capped: EW_CAPPED }).length) continue;
    for (let m = 0; m < FI; m++) {
      const g = fill2(lay, seed, level, heat, m).grid;
      if (!validateBoard(g, level, heat, gateOpts(lay, a, m)).length) return { grid: g, feat: null, featPair: null, layout: meta(lay, a, m) };
    }
    break;
  }
  return { grid: fallback2(seed, level, heat), feat: null, featPair: null, layout: { name: "FALLBACK · LATTICE", tpl: "lattice", flip: 0, sym: null, edits: [], tries: [LA, FI], fallback: true } };
}

/* gen 3 (?gen=3 only): the gen-2 board of every heat plus the world.feat tile
   layer, placed on the layout (so heat never moves a tile). The tiles it
   forces open are the only grid change; a salt is kept only when all three
   heats still pass the gate, else the plain gen-2 board ships. */
/* #28: BOOSTER spot gate. Candidates come in placement order; each one is kept
   only if, with it and every booster kept so far forced open, V18 and V19
   find no spot on the grid of ALL three heats (so every heat keeps the same
   layer, R5 / V21); stops at `want`, fails below BLOOM_PLACE.min */
export const BLOOM_GATE = { on: true, only: ["V18", "V19"], min: 3 };
function bloomGate(base, level, lay) {
  return (cand, want, sp) => {
    const used = [], uk = [];
    for (const [x, y] of cand) {
      if (used.length >= want) break;
      if (sp(used, x, y)) continue;
      const ks = [...uk, key(x, y)], f = new Uint8Array(N);
      for (const k of ks) f[k] = 6;
      let ok = true;
      for (let h = 0; h < 3 && ok; h++) {
        const g = base[h].grid.slice();
        for (const k of ks) g[k] = T.EMPTY;
        ok = !featChecks({ grid: g, feat: f, level, heat: h, items: [], enemies: [] }, FEAT_PROFILE[h], { only: BLOOM_GATE.only }).length;
      }
      if (ok) { used.push([x, y]); uk.push(key(x, y)); }
    }
    return used.length >= BLOOM_GATE.min ? uk : null;
  };
}
export function genBoard3(seed, level, heat = 0) {
  const base = [0, 1, 2].map((h) => genBoard2(seed, level, h));
  if (base[heat].layout.fallback) return base[heat];
  const L = base[heat].layout, lay = layout2(seed, level, L.tries[0]);
  const gate = BLOOM_GATE.on && lay.biome === "JUNGLE" ? bloomGate(base, level, lay) : null;
  for (let pa = 0; pa < 4; pa++) {
    const pf = placeFeat(lay.m, seed, level, lay.biome, pa, gate);
    if (gate && pf && !pf.feat) continue;
    if (!pf || !pf.feat) break;
    const open = base.map((b) => { const g = b.grid.slice(); for (const k of pf.force) g[k] = T.EMPTY; return g; });
    if ([0, 1, 2].every((h) => !base[h].layout.fallback && !validateBoard(open[h], level, h, gateOpts(lay, ...base[h].layout.tries, pf.force)).length))
      return { grid: open[heat], feat: pf.feat, featPair: pf.pair || null, layout: { ...L, featKind: pf.kind, ignore: pf.force } };
  }
  return base[heat];
}
