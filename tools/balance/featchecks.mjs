/* Floor-tile fairness checks V13-V27 as PURE STATIC checks (#28 design pass 2;
   #18 moves this into src/core unchanged, only the import paths change).
   No DOM / Date / Math.random. featChecks(board, profile, opts) returns the
   failed rules in FEAT_RULES order as [{id, why, ...detail}]; skippedChecks
   names the rules the given inputs cannot decide (never a silent pass).
     board   {grid, feat, featPair, level, heat, gen, pact, items, enemies|foes,
              featByHeat, pairByHeat (V21), rebuild (V22: {feat, featPair}),
              layout (V23)} - a world straight after loadLevel works as is
     profile a FEAT_PROFILE row {belt, glide, bloom, plate}; every knob is
             read from it (unknown knobs such as plate.near are honoured)
     opts    {only, limits, fuse, tier, pace}
   The behaviour checks (V18 V19) share ONE timed-escape engine: earliest
   arrival over (cell, dir, steps) with float64 times. The player plants at
   t 0 and moves at 3.4 x the EASY pace; a cell is held until the NEXT centre
   is reached (stricter than the 0.8-tile hit box), and a cell may not be held
   at or after its first lethal time, forever (never re-entered once its blade
   window ends). Every constraint is then a deadline, so earliest arrival is
   optimal and no wait state exists: a pass is a proof inside the model.
   Ride lengths take the HARD pace (the longest ride); speeds take EASY. */
import { CFG, T, key, biomeOf } from "../../src/core/config.js";
import { walk, POCKET, DOORS, ESC_STEPS, REACH_MAX, foeMin } from "../../src/core/fair.js";
import { F, HOME, FEAT_PROFILE, isBelt, beltDir, featKindOf } from "../../src/core/feat.js";
import { heatProfile, heatRoster, clampHeat } from "../../src/core/heat.js";
import { applyPact } from "../../src/core/pact.js";
import { PACE_MUL, paceMul } from "../../src/core/pace.js";
import { spawnEnemy } from "../../src/core/entities.js";

const C = CFG.COLS, R = CFG.ROWS, N = C * R, INF = Infinity;
const D4 = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const VP = CFG.PLAYER_START.speed;
export const FEAT_RULES = Object.freeze(["V13", "V14", "V15", "V16", "V17", "V18", "V19", "V20", "V21", "V22", "V23", "V24", "V25", "V26", "V27"]);
export const RULE_TILES = Object.freeze(["BLOOM", "GLIDE", "BELT", "PLATE"]);
export const TILE_NAME = Object.freeze({ BELT: "CONVEYOR", GLIDE: "ICE PATCH", BLOOM: "BOOSTER", PLATE: "TRAP", STREAM: "STREAM", QUICK: "QUICKSAND", PORTAL: "PORTAL", GATE: "GATE" });
export const LIMITS = Object.freeze({
  spawnSteps: 4, chainMin: 4, chainMax: 9, chainTotal: 16, stepOff: 2, exitOpen: 2, foeKeep: 0.4, playerKeep: 0.5,
  doorRing: 10, sheetMin: 3, sheetMax: 9, runMax: 3, iceSteps: 3, boostMin: 2, boostMax: 4, boostPocket: 4, boostGap: 3,
  trapMin: 3, trapMax: 5, trapSteps: 6, trapFoe: 2, trapGap: 2, sideR: 3, escSteps: ESC_STEPS, escFree: 12, radius: 8, rings: 4,
});
const inB = (x, y) => x >= 0 && y >= 0 && x < C && y < R;
const xy = (k) => [k % C, (k / C) | 0];
const manh = (a, b) => Math.abs((a % C) - (b % C)) + Math.abs(((a / C) | 0) - ((b / C) | 0));
const nbr = (k, d) => { const x = (k % C) + D4[d][0], y = ((k / C) | 0) + D4[d][1]; return inB(x, y) ? key(x, y) : -1; };
const dirOf = (dx, dy) => D4.findIndex(([a, b]) => a === dx && b === dy);
const notWall = (g, k) => k >= 0 && g[k] !== T.WALL;

function norm(b, profile, opts) {
  const level = b.level | 0, heat = clampHeat(b.heat), pact = b.pact | 0, P = applyPact(heatProfile(heat), pact);
  const lim = opts.limits ? { ...LIMITS, ...opts.limits } : LIMITS;
  const kind = b.feat ? kindOfLayer(b.feat) : null;
  const items = (b.items || []).map((it) => ({ k: key(it.tx ?? Math.floor(it.x / CFG.TILE), it.ty ?? Math.floor(it.y / CFG.TILE)), buried: !!it.buried, t: it.t }));
  const foes = (b.foes || b.enemies || []).map((e) => ({ type: e.type, k: key(e.tx, e.ty), speed: e.speed ?? foeSpeed(e.type, level, P.curve) }));
  const pace = opts.pace ?? -1, pm = paceMul(pace);
  return { ...b, g: b.grid, feat: b.feat || null, level, heat, pact, P, lim, kind, items, foes, prof: profile || FEAT_PROFILE[heat], tier: opts.tier ?? heat,
    fuse: opts.fuse ?? P.fuse, pm, pmRide: Math.max(...PACE_MUL), biome: biomeOf(level).name };
}
function kindOfLayer(f) { for (const v of f) if (v) return featKindOf(v); return null; }
export function foeSpeed(type, level, curve) { return spawnEnemy(type, 0, 0, level, null, { curve }).speed; }

/* ---- the blast model: arms stop at WALL, include and stop at BRICK unless
   pierce/line (fair.js blast()); BOOSTER relays run as an event queue on a
   grid copy (bricks broken earlier in the cascade are gone), one fire per
   booster (cooldown >= the cascade), never inheriting pierce ---- */
function armTiles(g, cx, cy, arms, through) {
  const out = [key(cx, cy)];
  for (const [dx, dy, len] of arms) for (let i = 1; i <= len; i++) {
    const x = cx + dx * i, y = cy + dy * i;
    if (!inB(x, y)) break;
    const v = g[key(x, y)];
    if (v === T.WALL) break;
    out.push(key(x, y));
    if (v === T.BRICK && !through) break;
  }
  return out;
}
const cross = (r) => D4.map(([dx, dy]) => [dx, dy, r]);
/* first lethal time per cell for blasts [{t, k, arms, through}] */
export function lethalMap(g, feat, prof, blasts, useTiles = true) {
  const L = new Float64Array(N).fill(INF), grid = g.slice(), fired = new Uint8Array(N), q = blasts.slice();
  const bl = useTiles && feat ? prof.bloom : null;
  let relay = false;
  while (q.length) {
    let i = 0;
    for (let j = 1; j < q.length; j++) if (q[j].t < q[i].t) i = j;
    const { t, k, arms, through } = q.splice(i, 1)[0], [cx, cy] = xy(k), tiles = armTiles(grid, cx, cy, arms, through);
    for (const c of tiles) if (t < L[c]) L[c] = t;
    for (const c of tiles) if (grid[c] === T.BRICK) grid[c] = T.EMPTY;
    if (!bl) continue;
    for (const c of tiles) {
      if (c === k || feat[c] !== F.BLOOM || grid[c] !== T.EMPTY || fired[c]) continue;
      fired[c] = 1; relay = true;
      const [x, y] = xy(c), dx = Math.sign(x - cx), dy = Math.sign(y - cy), a = [[dx, dy, bl.fwd]];
      if (bl.side) a.push([dy, dx, bl.side], [-dy, -dx, bl.side]);
      q.push({ t: t + (bl.delay || 0), k: c, arms: a, through: false });
    }
  }
  L.relay = relay;
  return L;
}

/* ---- the timed-escape engine ----
   env {g, feat, prof, pm, cap, tiles, stopOnBrick, open (extra passable cell)}.
   ICE PATCH: boost on ice at every tier; coast >= 2 (MAX) = no stopping on
   ice in motion, you stop only when the next cell in your direction is a
   block (WALL, or a BRICK / static bomb you reach before it goes); you may
   turn into any free cell at a centre. CONVEYOR with actors riding: a step
   costs 1/(vp +- vb) per half cell, no belt cell is a hide unless a WALL (or
   a never-lethal BRICK) halts the push. Perpendicular drift is not modelled
   (vb/vp 0.35 at MAX: a centre-timed step-off clears a corner, 0.48 < 0.5). */
function env(n, g, o = {}) {
  const prof = n.prof, t = !!(o.tiles && n.feat);
  return { g, feat: n.feat, prof, pm: n.pm, cap: n.lim.escSteps, tiles: t, mvTiles: t && o.move !== false, stopOnBrick: o.stopOnBrick !== false, plantBlock: o.plantBlock !== false, open: o.open ?? -1,
    vp: VP * n.pm, vIce: Math.min(VP * prof.glide.boost, CFG.MAX_SPEED) * n.pm, vb: prof.belt.v * n.pm, actors: !!prof.belt.actors, nostop: prof.glide.coast >= 2 };
}
const isIce = (E, k) => E.mvTiles && E.feat[k] === F.GLIDE && E.g[k] === T.EMPTY;
const isRide = (E, k) => E.mvTiles && E.actors && isBelt(E.feat[k]) && E.g[k] === T.EMPTY;
function spd(E, k, d) {
  if (isIce(E, k)) return E.vIce;
  if (isRide(E, k)) { const [ux, uy] = beltDir(E.feat[k]); return E.vp + E.vb * (ux * D4[d][0] + uy * D4[d][1]); }
  return E.vp;
}
const passable = (E, k, plant) => k >= 0 && k !== plant && (E.g[k] === T.EMPTY || k === E.open);
function blockAt(E, k, t, L, plant) {
  if (k < 0 || E.g[k] === T.WALL) return true;
  if (k === plant) return E.plantBlock && t < L[k];
  return E.stopOnBrick && E.g[k] === T.BRICK && t < L[k];
}
function hide(E, k, d, t, L, plant) {
  if (L[k] !== INF) return false;
  if (isIce(E, k) && E.nostop && d < 4) return blockAt(E, nbr(k, d), t, L, plant);
  if (isRide(E, k)) {
    const [ux, uy] = beltDir(E.feat[k]), dn = nbr(k, dirOf(ux, uy));
    return dn < 0 || E.g[dn] === T.WALL || (E.stopOnBrick && E.g[dn] === T.BRICK && L[dn] === INF);
  }
  return true;
}
/* earliest escape from `start` under lethal map L; plant = the static bomb
   cell (never re-entered, a stop block on ice until it goes) or -1 */
export function timedEscape(E, L, start, plant = -1) {
  if (hide(E, start, 4, 0, L, plant)) return { ok: true, t: 0, steps: 0 };
  let cur = new Map([[start * 5 + 4, 0]]);
  for (let s = 0; s < E.cap && cur.size; s++) {
    const nx = new Map();
    for (const [id, ta] of cur) {
      const a = (id / 5) | 0;
      for (let d = 0; d < 4; d++) {
        const b = nbr(a, d);
        if (!passable(E, b, plant)) continue;
        const sa = spd(E, a, d), sb = spd(E, b, d);
        if (sa <= 0 || sb <= 0) continue;
        const tb = ta + 0.5 / sa + 0.5 / sb;
        if (tb > L[a]) continue;
        const sid = b * 5 + (isIce(E, b) && E.nostop ? d : 4), o = nx.get(sid);
        if (o === undefined || tb < o) nx.set(sid, tb);
      }
    }
    for (const [id, tb] of nx) if (hide(E, (id / 5) | 0, id % 5, tb, L, plant)) return { ok: true, t: tb, steps: s + 1 };
    cur = nx;
  }
  return { ok: false };
}

/* the TRAP footprint a foe arms at plate k: reach r, bricks transparent when
   `through` (an over-approximation of every brick state), else the sim's arms */
const trapTiles = (g, k, r, through) => { const [x, y] = xy(k); return armTiles(g, x, y, cross(r), through); };
const plates = (n) => n.feat ? [...n.feat.keys()].filter((k) => n.feat[k] === F.PLATE && n.g[k] === T.EMPTY) : [];

/* own bomb at cell c, radius r, on grid g: the lethal map with the tile live
   (BOOSTER relays, CONVEYOR ride union, TRAP chain) or ignored */
function bombMap(n, g, c, r, live, blast = null) {
  const arms = blast ? blast.arms : cross(r), through = blast ? blast.through : false;
  if (!live || !n.feat) return lethalMap(g, null, n.prof, [{ t: n.fuse, k: c, arms, through }], false);
  const [cx, cy] = xy(c);
  let tb = n.fuse, chain = false;
  const extra = [];
  for (const p of plates(n)) if (!n.prof.plate.hold && trapTiles(g, p, n.prof.plate.r, false).includes(c) && (n.prof.plate.near == null || manh(p, c) <= n.prof.plate.near + n.lim.escSteps)) {
    const ch = n.prof.plate.chain;
    if (ch !== false) { chain = true; tb = Math.min(tb, typeof ch === "number" ? Math.max(n.prof.plate.wind, ch) : n.prof.plate.wind); }
    extra.push({ t: n.prof.plate.wind, k: p, arms: cross(n.prof.plate.r), through: false });
  }
  const at = [c];
  if (isBelt(n.feat[c]) && g[c] === T.EMPTY) {
    let k = c, steps = Math.ceil(n.prof.belt.v * n.pmRide * n.fuse - 1e-9);
    while (steps-- > 0 && isBelt(n.feat[k]) && g[k] === T.EMPTY) {
      const [ux, uy] = beltDir(n.feat[k]), nk = nbr(k, dirOf(ux, uy));
      if (nk < 0 || g[nk] !== T.EMPTY) break;
      k = nk; at.push(k);
    }
  }
  let L = null, relay = false;
  for (const k of at) {
    const M = lethalMap(g, n.feat, n.prof, [{ t: tb, k, arms, through }, ...extra], true);
    relay ||= M.relay;
    if (!L) L = M; else for (let i = 0; i < N; i++) if (M[i] < L[i]) L[i] = M[i];
  }
  L.cause = chain ? "trap-chain" : at.length > 1 ? "bomb-ride" : relay ? "relay" : null;
  L.moved = at.length > 1;
  return L;
}
const sameIn = (A, B, c, rad) => { const [cx, cy] = xy(c); for (let y = Math.max(0, cy - rad); y <= Math.min(R - 1, cy + rad); y++) for (let x = Math.max(0, cx - rad); x <= Math.min(C - 1, cx + rad); x++) { if (Math.abs(x - cx) + Math.abs(y - cy) > rad) continue; const k = key(x, y); if (A[k] !== B[k]) return false; } return true; };
function moveTileNear(n, E, c, rad) { const [cx, cy] = xy(c); for (let y = Math.max(0, cy - rad); y <= Math.min(R - 1, cy + rad); y++) for (let x = Math.max(0, cx - rad); x <= Math.min(C - 1, cx + rad); x++) { if (Math.abs(x - cx) + Math.abs(y - cy) > rad) continue; const k = key(x, y); if (isIce(E, k) || isRide(E, k)) return true; } return false; }

/* V18: V2 re-run with the tile live, this heat's fuse (opts.fuse overrides),
   the EASY pace; bomb at (1,1), r 1..REACH_MAX, normal / pierce / line x4 */
function v18(n) {
  const g = n.g, s = key(1, 1), E = env(n, g, { tiles: true });
  for (let r = 1; r <= REACH_MAX; r++) for (const [kind, arms, through] of [["normal", cross(r), false], ["pierce", cross(r), true], ...D4.map(([dx, dy]) => ["line", [[dx, dy, r]], true])]) {
    const L = bombMap(n, g, s, r, true, { arms, through });
    if (!timedEscape(E, L, s, s).ok) return { why: "first bomb has no escape", r, kind };
  }
  return null;
}

/* V19 no-escape spots the tile adds (counterfactual, per heat):
   A) own bomb at every EMPTY cell, r 1..LIMITS.radius, on two brick states
      (as loaded / every brick broken): base escape (tile ignored, the V2
      step cap) holds but the tile-live escape does not. r stops once base
      fails (monotone).
   B) TRAP: a foe arms a trap with the player anywhere on its reach (within
      plate.near if set): arms see through bricks, movement only through
      cells EMPTY now (plus the start), stops only at WALLs - sound over
      every brick state reachable from the loaded one. No base hazard exists,
      so every failure is tile-forced. `trapExact` is the same count in the
      loaded state alone (arms stop at bricks).
   A spot is `time` when even an uncapped (escFree moves) escape fails, else
   `cap` (only the escSteps budget fails it). Causes overlap: one cell may
   count under two. */
function v19(n) {
  const spots = new Map(), by = {}, kind = { time: new Set(), cap: new Set() }, exact = new Set();
  const add = (k, cause, ex, timed) => { if (!spots.has(k)) spots.set(k, ex); (by[cause] ||= new Set()).add(k); kind[timed ? "time" : "cap"].add(k); };
  const free = (E) => ({ ...E, cap: n.lim.escFree });
  const cleared = n.g.map((v) => (v === T.BRICK ? T.EMPTY : v)), rad = n.lim.escSteps + 1;
  for (const [st, g] of [["loaded", n.g], ["cleared", cleared]]) {
    const Eb = env(n, g, { tiles: false }), Et = env(n, g, { tiles: true }), Em = env(n, g, { tiles: true, move: false });
    for (let c = 0; c < N; c++) {
      if (g[c] !== T.EMPTY) continue;
      for (let r = 1; r <= n.lim.radius; r++) {
        const Lb = bombMap(n, g, c, r, false);
        if (!timedEscape(Eb, Lb, c, c).ok) break;
        const Lt = bombMap(n, g, c, r, true), plant = Lt.moved ? -1 : c;
        if (sameIn(Lb, Lt, c, rad) && !moveTileNear(n, Et, c, rad)) continue;
        if (timedEscape(Et, Lt, c, plant).ok) continue;
        const cause = Lt.cause && !timedEscape(Em, Lt, c, plant).ok ? Lt.cause : n.kind === "GLIDE" ? "coast" : n.kind === "BELT" ? "ride" : Lt.cause || "tile";
        const timed = !timedEscape(free(Et), Lt, c, plant).ok;
        add(c, cause, { at: xy(c), r, state: st, cause, kind: timed ? "time" : "cap" }, timed);
        break;
      }
    }
  }
  const pr = n.prof.plate;
  if (!pr.off) for (const p of plates(n)) for (const through of [true, false]) {
    const foot = trapTiles(n.g, p, pr.r, through), L = new Float64Array(N).fill(INF);
    for (const k of foot) L[k] = pr.wind;
    for (const q of foot) {
      if (q === p || (pr.near != null && manh(p, q) > pr.near) || (!through && n.g[q] !== T.EMPTY)) continue;
      const E = through ? env(n, n.g, { tiles: true, stopOnBrick: false, plantBlock: false, open: q }) : env(n, n.g, { tiles: true, plantBlock: false });
      if (timedEscape(E, L, q, p).ok) continue;
      if (!through) { exact.add(q); continue; }
      const timed = !timedEscape(free(E), L, q, p).ok;
      add(q, "trap-blast", { at: xy(q), trap: xy(p), cause: "trap-blast", kind: timed ? "time" : "cap" }, timed);
    }
  }
  if (!spots.size) return null;
  const out = { why: spots.size + " no-escape spot(s)", spots: spots.size, time: kind.time.size, cap: [...kind.cap].filter((k) => !kind.time.has(k)).length, cause: Object.fromEntries(Object.entries(by).map(([c, s]) => [c, s.size])), first: spots.values().next().value };
  if (n.kind === "PLATE") out.trapExact = exact.size;
  return out;
}

/* ---- CONVEYOR chains: heads are belt cells nothing feeds; cells no head
   reaches sit on a cycle ---- */
function chains(feat, alive) {
  const belt = (k) => k >= 0 && isBelt(feat[k]) && alive(k), next = (k) => { const [ux, uy] = beltDir(feat[k]); return nbr(k, dirOf(ux, uy)); };
  const fed = new Uint8Array(N), seen = new Uint8Array(N), out = [];
  for (let k = 0; k < N; k++) if (belt(k)) { const m = next(k); if (belt(m)) fed[m] = 1; }
  for (let h = 0; h < N; h++) {
    if (!belt(h) || fed[h]) continue;
    const cells = [];
    let k = h, cyc = false;
    while (belt(k)) { if (cells.includes(k)) { cyc = true; break; } cells.push(k); seen[k] = 1; k = next(k); }
    const [ux, uy] = beltDir(feat[h]);
    out.push({ cells, land: cyc ? -1 : k, entry: nbr(h, dirOf(-ux, -uy)), cyc });
  }
  let cyc = false;
  for (let k = 0; k < N; k++) if (belt(k) && !seen[k]) cyc = true;
  return { list: out, cyc };
}
const openN = (g, k) => D4.reduce((s, _, d) => s + (notWall(g, nbr(k, d)) ? 1 : 0), 0);
function stepOffs(g, feat, ch, lim, landOk) {
  const L = ch.cells.length, perp = (k) => { const [ux, uy] = beltDir(feat[k]); return [dirOf(uy, ux), dirOf(-uy, -ux)].some((d) => { const m = nbr(k, d); return notWall(g, m) && !isBelt(feat[m]); }); };
  for (let i = 0; i < L; i++) {
    let ok = false;
    for (let j = i; j <= Math.min(L, i + lim.stepOff) && !ok; j++) ok = j === L ? landOk : perp(ch.cells[j]);
    if (!ok) return ch.cells[i];
  }
  return -1;
}
function v15(n) {
  const { g, feat, lim } = n, cs = chains(feat, () => true);
  if (cs.cyc) return { why: "conveyor loop" };
  let total = 0;
  for (const ch of cs.list) {
    const L = ch.cells.length;
    total += L;
    if (L < lim.chainMin || L > lim.chainMax) return { why: "chain length " + L, at: xy(ch.cells[0]) };
    for (const k of ch.cells) { const [x, y] = xy(k), [ux] = beltDir(feat[k]); if ((ux ? y : x) % 2 === 0) return { why: "off an odd lane", at: [x, y] }; }
    for (const [end, k] of [["entry", ch.entry], ["landing", ch.land]]) if (!notWall(g, k) || openN(g, k) < lim.exitOpen) return { why: end + " not open", at: k >= 0 ? xy(k) : null };
    const s = stepOffs(g, feat, ch, lim, true);
    if (s >= 0) return { why: "no step-off within " + lim.stepOff, at: xy(s) };
  }
  if (total > lim.chainTotal) return { why: "conveyor tiles " + total };
  return null;
}
function v16(n) {
  const pb = n.prof.belt;
  if (!pb.actors) return null;
  const sp = heatRoster(n.level, n.heat).map((t) => foeSpeed(t, n.level, n.P.curve)).filter((v) => v > 0), vf = Math.min(...sp);
  if (sp.length && pb.v > (1 - n.lim.foeKeep) * vf + 1e-9) return { why: "belt " + pb.v + " > " + (1 - n.lim.foeKeep) + " x slowest foe " + vf.toFixed(2) };
  if ((VP - pb.v) / VP < n.lim.playerKeep) return { why: "player keeps < " + n.lim.playerKeep };
  return null;
}
/* V17: per foe, Dijkstra foe -> (1,1), bricks passable, a belt cell costs
   0.5/(vf +- vb) per half step when actors ride (belt read under bricks too,
   the worst case); equivalent steps = time x vf >= foeMin. Plus every chain
   lands >= doorRing walking steps from both doors, and (MAX) no chain
   carries toward the start (landing nearer (1,1) than its head). */
function v17(n) {
  const { g, feat, prof, lim } = n, cs = chains(feat, () => true), w = walk(g, true);
  for (const ch of cs.list) {
    if (ch.land < 0) continue;
    for (const d of DOORS) { const dd = walk(g, true, d % C, (d / C) | 0)[ch.land]; if (dd >= 0 && dd < lim.doorRing) return { why: "chain lands " + dd + " steps from a door", at: xy(ch.land) }; }
    if (n.tier >= 2 && w[ch.land] >= 0 && w[ch.land] < w[ch.cells[0]]) return { why: "chain carries toward the start", at: xy(ch.cells[0]) };
  }
  if (!prof.belt.actors) return null;
  const vb = prof.belt.v, goal = key(1, 1);
  for (const f of n.foes) {
    if (!(f.speed > 0)) continue;
    const t = new Float64Array(N).fill(INF), done = new Uint8Array(N), cost = (k, d) => { if (!isBelt(feat[k])) return 0.5 / f.speed; const [ux, uy] = beltDir(feat[k]), s = f.speed + vb * (ux * D4[d][0] + uy * D4[d][1]); return s > 0 ? 0.5 / s : INF; };
    t[f.k] = 0;
    for (;;) {
      let a = -1;
      for (let i = 0; i < N; i++) if (!done[i] && t[i] < (a < 0 ? INF : t[a])) a = i;
      if (a < 0 || a === goal) break;
      done[a] = 1;
      for (let d = 0; d < 4; d++) { const b = nbr(a, d); if (!notWall(g, b) || done[b]) continue; const tb = t[a] + cost(a, d) + cost(b, d); if (tb < t[b]) t[b] = tb; }
    }
    const eq = t[goal] * f.speed;
    if (eq < foeMin(f.type) - 1e-9) return { why: f.type + " " + eq.toFixed(2) + " equivalent steps", at: xy(f.k) };
  }
  return null;
}
/* V20: SHRINK rings 1..LIMITS.rings mask rim <= ring (not (1,1)) as WALL;
   surviving chains keep V15's shape (a chain may now end at the new wall:
   where actors ride its rider stops there, so G4 needs a side exit within
   stepOff of that end), ice is never sealed off the floor,
   and every surviving TRAP keeps its V27 side exits (extension). */
function v20(n) {
  const { feat, lim, prof } = n;
  for (let ring = 1; ring <= lim.rings; ring++) {
    const g = n.g.slice();
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) { const rim = Math.min(x, C - 1 - x, y, R - 1 - y); if (rim >= 1 && rim <= ring && !(x === 1 && y === 1)) g[key(x, y)] = T.WALL; }
    const alive = (k) => g[k] !== T.WALL;
    if (n.kind === "BELT") for (const ch of chains(feat, alive).list) {
      if (ch.land < 0) continue;
      const atWall = !notWall(g, ch.land);
      if (!atWall && openN(g, ch.land) < lim.exitOpen) return { why: "ring " + ring + ": landing not open", at: xy(ch.land) };
      if (atWall && !prof.belt.actors) continue;
      const s = stepOffs(g, feat, ch, lim, !atWall);
      if (s >= 0) return { why: "ring " + ring + ": no step-off" + (atWall ? " at the new wall" : ""), at: xy(s) };
    }
    if (n.kind === "GLIDE") {
      const ok = new Uint8Array(N), q = [];
      for (let k = 0; k < N; k++) if (alive(k) && feat[k] !== F.GLIDE) { ok[k] = 1; q.push(k); }
      for (let h = 0; h < q.length; h++) for (let d = 0; d < 4; d++) { const m = nbr(q[h], d); if (m >= 0 && alive(m) && !ok[m]) { ok[m] = 1; q.push(m); } }
      for (let k = 0; k < N; k++) if (feat[k] === F.GLIDE && alive(k) && !ok[k]) return { why: "ring " + ring + ": ice sealed", at: xy(k) };
    }
    if (n.kind === "PLATE") for (const p of plates({ ...n, g })) { const s = sideExit(g, p, Math.max(lim.sideR, prof.plate.r)); if (s) return { why: "ring " + ring + ": " + s.why, at: s.at }; }
  }
  return null;
}
/* V27 side exit: every tile on a TRAP arm (reach max(sideR, plate.r)) has a
   perpendicular non-WALL neighbour on itself or the arm tile before / after */
function sideExit(g, p, r) {
  const [x, y] = xy(p);
  for (const [dx, dy] of D4) {
    const arm = [p];
    for (let i = 1; i <= r; i++) { const k = inB(x + dx * i, y + dy * i) ? key(x + dx * i, y + dy * i) : -1; if (!notWall(g, k)) break; arm.push(k); }
    const side = (k) => { const [a, b] = xy(k); return notWall(g, inB(a + dy, b + dx) ? key(a + dy, b + dx) : -1) || notWall(g, inB(a - dy, b - dx) ? key(a - dy, b - dx) : -1); };
    for (let i = 1; i < arm.length; i++) {
      let ok = false;
      for (let j = Math.max(0, i - 1); j <= Math.min(arm.length - 1, i + 1) && !ok; j++) ok = side(arm[j]);
      if (!ok) return { why: "no side exit on a trap arm", at: xy(arm[i]) };
    }
  }
  return null;
}

const CHECK = {
  V13(n) {
    const f = n.feat;
    if (!f) return null;
    if ((n.gen ?? 3) < 3) return { why: "layer on gen " + n.gen };
    if (f.length !== N) return { why: "layer length " + f.length };
    const kinds = new Set();
    for (let k = 0; k < N; k++) {
      if (!f[k]) continue;
      const kd = featKindOf(f[k]);
      if (!kd) return { why: "unknown code " + f[k], at: xy(k) };
      if (n.g[k] === T.WALL) return { why: "tile on a WALL", at: xy(k) };
      kinds.add(kd);
    }
    if (kinds.size > 1) return { why: "kinds " + [...kinds].join("+") };
    if (kinds.size && HOME[n.biome] !== n.kind) return { why: n.kind + " in " + n.biome };
    if (n.kind === "PORTAL") {
      const cnt = {}, pr = n.featPair;
      if (!pr) return { why: "portal without pairs" };
      for (let k = 0; k < N; k++) { if ((f[k] === F.PORTAL) !== !!pr[k]) return { why: "pair id off a portal", at: xy(k) }; if (pr[k]) cnt[pr[k]] = (cnt[pr[k]] || 0) + 1; }
      if (Object.values(cnt).some((v) => v !== 2)) return { why: "portal pair not 2" };
    }
    return null;
  },
  /* every breach is listed in `causes` (spawn / door / foe / sentry / floor / buried) */
  V14(n) {
    const { g, feat, lim } = n, w = walk(g, true), c = {}, first = [], hit = (k, why, at) => { c[k] = (c[k] || 0) + 1; if (!first.length) first.push({ why, at }); };
    for (let k = 0; k < N; k++) {
      if (!feat[k]) continue;
      if (w[k] >= 0 && w[k] <= lim.spawnSteps) hit("spawn", "tile " + w[k] + " steps from spawn", xy(k));
      else if (DOORS.includes(k) || POCKET.includes(k)) hit("door", "tile on the pocket / a door", xy(k));
    }
    for (const e of n.foes) if (feat[e.k]) hit(e.type === "stationary" ? "sentry" : "foe", (e.type === "stationary" ? "SENTRY" : e.type) + " spawns on a tile", xy(e.k));
    for (const it of n.items) if (feat[it.k]) hit(it.buried ? "buried" : "floor", (it.buried ? "buried" : "floor") + " item on a tile", xy(it.k));
    return first.length ? { ...first[0], causes: c } : null;
  },
  V15(n) { return n.kind === "BELT" ? v15(n) : null; },
  V16(n) { return n.kind === "BELT" ? v16(n) : null; },
  V17(n) { return n.kind === "BELT" ? v17(n) : null; },
  V18(n) { return v18(n); },
  V19(n) { return RULE_TILES.includes(n.kind) ? v19(n) : null; },
  V20(n) { return v20(n); },
  V21(n) {
    const fb = n.featByHeat, pb = n.pairByHeat, hx = (a) => (a ? Array.from(a).join(",") : "-");
    if (fb.some((f) => hx(f) !== hx(fb[0]))) return { why: "layer differs by heat" };
    if (pb && pb.some((f) => hx(f) !== hx(pb[0]))) return { why: "pairs differ by heat" };
    return null;
  },
  V22(n) {
    const hx = (a) => (a ? Array.from(a).join(",") : "-");
    if (hx(n.rebuild.feat) !== hx(n.feat) || hx(n.rebuild.featPair) !== hx(n.featPair)) return { why: "rebuild differs" };
    return null;
  },
  V23(n) {
    if (n.feat || (n.gen ?? 3) < 3 || !HOME[n.biome]) return null;
    return { why: n.layout && n.layout.fallback ? "tiles dropped (gen-2 fallback board)" : "tiles dropped (placement)", fallback: !!(n.layout && n.layout.fallback) };
  },
  V24(n) {
    if (n.kind !== "GLIDE") return null;
    const { feat, g, lim } = n, seen = new Uint8Array(N), w = walk(g, true);
    for (let k = 0; k < N; k++) {
      if (feat[k] !== F.GLIDE || seen[k]) continue;
      const q = [k]; seen[k] = 1;
      for (let h = 0; h < q.length; h++) for (let d = 0; d < 4; d++) { const m = nbr(q[h], d); if (m >= 0 && feat[m] === F.GLIDE && !seen[m]) { seen[m] = 1; q.push(m); } }
      if (q.length < lim.sheetMin || q.length > lim.sheetMax) return { why: "sheet of " + q.length, at: xy(k) };
    }
    for (const [dx, dy] of [[1, 0], [0, 1]]) for (let k = 0; k < N; k++) {
      if (feat[k] !== F.GLIDE) continue;
      let run = 0, [x, y] = xy(k);
      while (inB(x, y) && feat[key(x, y)] === F.GLIDE) { run++; x += dx; y += dy; }
      if (run > lim.runMax) return { why: "ice run " + run, at: xy(k) };
    }
    for (let k = 0; k < N; k++) if (feat[k] === F.GLIDE && w[k] >= 0 && w[k] < lim.iceSteps) return { why: "ice " + w[k] + " steps from spawn", at: xy(k) };
    return null;
  },
  V25(n) {
    if (n.kind !== "BLOOM") return null;
    const { feat, g, lim } = n, bs = [];
    for (let k = 0; k < N; k++) if (feat[k] === F.BLOOM) bs.push(k);
    if (bs.length < lim.boostMin || bs.length > lim.boostMax) return { why: bs.length + " boosters" };
    for (const k of bs) {
      const [x, y] = xy(k);
      if (x % 2 === 0 || y % 2 === 0) return { why: "booster off (odd,odd)", at: [x, y] };
      if (g[k] !== T.EMPTY) return { why: "booster under a brick", at: [x, y] };
      if ([...POCKET, ...DOORS].some((p) => manh(p, k) < lim.boostPocket)) return { why: "booster near the pocket", at: [x, y] };
      for (const o of bs) { const [a, b] = xy(o); if (o !== k && ((a === x && Math.abs(b - y) <= lim.boostGap) || (b === y && Math.abs(a - x) <= lim.boostGap))) return { why: "boosters within " + lim.boostGap + " in a line", at: [x, y] }; }
    }
    return null;
  },
  V26(n) {
    if (n.kind !== "PLATE") return null;
    const { feat, g, lim } = n, ps = [], w = walk(g, true);
    for (let k = 0; k < N; k++) if (feat[k] === F.PLATE) ps.push(k);
    if (ps.length < lim.trapMin || ps.length > lim.trapMax) return { why: ps.length + " traps" };
    for (const k of ps) {
      const [x, y] = xy(k);
      if (x % 2 === 0 || y % 2 === 0) return { why: "trap off (odd,odd)", at: [x, y] };
      if (g[k] !== T.EMPTY) return { why: "trap under a brick", at: [x, y] };
      if (w[k] >= 0 && w[k] < lim.trapSteps) return { why: "trap " + w[k] + " steps from spawn", at: [x, y] };
      if (n.foes.some((e) => manh(e.k, k) < lim.trapFoe)) return { why: "foe spawn next to a trap", at: [x, y] };
      if (ps.some((o) => o !== k && manh(o, k) <= lim.trapGap)) return { why: "traps on neighbouring crossings", at: [x, y] };
    }
    return null;
  },
  V27(n) {
    if (n.kind !== "PLATE") return null;
    for (const p of plates(n)) { const s = sideExit(n.g, p, Math.max(n.lim.sideR, n.prof.plate.r)); if (s) return s; }
    return null;
  },
};
const NEED = { V21: (b) => !!b.featByHeat, V22: (b) => !!b.rebuild, V23: (b) => b.gen != null };
const NEEDS_LAYER = new Set(["V14", "V15", "V16", "V17", "V19", "V20", "V24", "V25", "V26", "V27"]);
/* the rules these inputs cannot decide: V21 needs featByHeat, V22 a rebuild, V23 the gen */
export function skippedChecks(board, opts = {}) {
  return FEAT_RULES.filter((id) => (!opts.only || opts.only.includes(id)) && NEED[id] && !NEED[id](board));
}
export function featChecks(board, profile, opts = {}) {
  const n = norm(board, profile, opts), skip = new Set(skippedChecks(board, opts)), out = [];
  for (const id of FEAT_RULES) {
    if ((opts.only && !opts.only.includes(id)) || skip.has(id) || (NEEDS_LAYER.has(id) && !n.feat)) continue;
    const r = CHECK[id](n);
    if (r) out.push({ id, ...r });
  }
  return out;
}
/* table-level V16: tile speeds never drop as heat rises (CORE <= PLUS <= MAX) */
export function tableChecks(profiles = FEAT_PROFILE) {
  const out = [];
  for (let h = 1; h < profiles.length; h++) if (profiles[h].belt.v < profiles[h - 1].belt.v || profiles[h].glide.boost < profiles[h - 1].glide.boost) out.push({ id: "V16", why: "a tile speed drops at heat " + h });
  return out;
}
