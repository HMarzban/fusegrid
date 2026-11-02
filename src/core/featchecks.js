/* Floor-tile fairness checks V13-V27 as PURE STATIC checks (#28 design pass 2;
   #18 moved this from tools/balance, which re-exports it). In the sim's import
   graph only for gen 3: genBoard3's BOOSTER spot gate.
   No DOM / Date / Math.random. featChecks(board, profile, opts) returns the
   failed rules in FEAT_RULES order as [{id, why, ...detail}]; skippedChecks
   names the rules the given inputs cannot decide (never a silent pass).
     board   {grid, feat, featPair, level, heat, gen, pact, items, enemies|foes,
              featByHeat, pairByHeat (V21), rebuild (V22: {feat, featPair}),
              layout (V23)} - a world straight after loadLevel works as is
     profile a FEAT_PROFILE row {belt, glide, bloom, plate}; every knob is
             read from it (unknown knobs such as plate.near are honoured)
     opts    {only, limits, fuse, tier, pace, near}
             near: a BOOSTER-only speed-up (see inLine), an array of booster
             cells; only bombs in line with one are checked in V18 / V19
             firstSpot: the placement gates, V19 stops at its first spot, so the
             pass / fail is the full scan's and the detail fields are not
   The behaviour checks (V18 V19) share ONE timed-escape engine: earliest
   arrival over (cell, dir, steps) with float64 times. The player plants at
   t 0 and moves at 3.4 x the EASY pace; a cell is held until the NEXT centre
   is reached (stricter than the 0.8-tile hit box), and a cell may not be held
   at or after its first lethal time, forever (never re-entered once its blade
   window ends). Every constraint is then a deadline, so earliest arrival is
   optimal and no wait state exists: a pass is a proof inside the model.
   Ride lengths take the HARD pace (the longest ride); speeds take EASY. */
import { CFG, T, key, biomeOf } from "./config.js";
import { walk, POCKET, DOORS, ESC_STEPS, REACH_MAX, foeMin } from "./fair.js";
import { F, HOME, FEAT_PROFILE, TILE_NAME, isBelt, beltDir, isStream, isFlow, flowDir, featKindOf, pairTwins } from "./feat.js";
import { QUICK_PLACE, quickSeals, quickDetour, PORTAL_PLACE } from "./featplace.js";
import { HOLD_MIN, holdReach } from "./tilequick.js";
import { heatProfile, heatRoster, clampHeat } from "./heat.js";
import { applyPact } from "./pact.js";
import { PACE_MUL, paceMul } from "./pace.js";
import { spawnEnemy } from "./entities.js";

const C = CFG.COLS, R = CFG.ROWS, N = C * R, INF = Infinity;
const D4 = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const VP = CFG.PLAYER_START.speed;
export const FEAT_RULES = Object.freeze(["V13", "V14", "V15", "V16", "V17", "V18", "V19", "V20", "V21", "V22", "V23", "V24", "V25", "V26", "V27", "V28", "V29", "V30", "V31", "V32", "V33", "V34", "V35"]);
export const RULE_TILES = Object.freeze(["BLOOM", "GLIDE", "BELT", "PLATE", "STREAM", "QUICK", "GATE", "PORTAL"]);
export { TILE_NAME };
export const LIMITS = Object.freeze({
  spawnSteps: 4, chainMin: 4, chainMax: 9, chainTotal: 16, stepOff: 2, exitOpen: 2, foeKeep: 0.4, playerKeep: 0.5,
  doorRing: 10, sheetMin: 3, sheetMax: 9, runMax: 3, iceSteps: 3, boostMin: 3, boostMax: 5, boostPocket: 2, boostGap: 3,
  trapMin: 3, trapMax: 5, trapSteps: 6, trapFoe: 2, trapGap: 2, sideR: 3, escSteps: ESC_STEPS, escFree: 12, radius: 8, rings: 4,
  gateMin: 2, gateMax: 3, gateGap: 4,
  streamRuns: 2, streamMin: 4, streamMax: 6, streamTotal: 12,
});
const K11 = key(1, 1);
const inB = (x, y) => x >= 0 && y >= 0 && x < C && y < R;
const xy = (k) => [k % C, (k / C) | 0];
const manh = (a, b) => Math.abs((a % C) - (b % C)) + Math.abs(((a / C) | 0) - ((b / C) | 0));
/* the checks run on the room-start frame, so the hot path below allocates nothing
   per bomb: lookup tables here, one-owner scratch beside armInto / lethalInto /
   bombMap / timedEscape. Each scratch buffer is read before its next writer runs. */
const NB = new Int16Array(N * 4).fill(-1), RIM = new Uint8Array(N);
for (let k = 0; k < N; k++) {
  const x = k % C, y = (k / C) | 0;
  RIM[k] = Math.min(x, C - 1 - x, y, R - 1 - y);
  for (let d = 0; d < 4; d++) { const a = x + D4[d][0], b = y + D4[d][1]; if (inB(a, b)) NB[k * 4 + d] = key(a, b); }
}
const nbr = (k, d) => NB[k * 4 + d];
const dirOf = (dx, dy) => D4.findIndex(([a, b]) => a === dx && b === dy);
const notWall = (g, k) => k >= 0 && g[k] !== T.WALL;

/* opts.near: a bomb's arms stop only at WALLs at most (bricks may be broken), so
   a bomb fires a booster only from a cell in line with it, with no WALL between,
   within reach. Any other cell gets the same lethal map with or without the
   tile, so V18 / V19 can skip it without changing their answer. BOOSTER-only:
   a sheet or a chain moves the player, a trap blasts on its own. */
function inLine(g, near, reach, ball = 0) {
  const m = new Uint8Array(N);
  for (const k of near) {
    m[k] = 1;
    const [x, y] = xy(k);
    if (ball) for (let c = 0; c < N; c++) if (manh(c, k) <= ball) m[c] = 1;
    for (const [dx, dy] of D4) for (let i = 1; i <= reach; i++) {
      const a = x + dx * i, b = y + dy * i;
      if (!inB(a, b) || g[key(a, b)] === T.WALL) break;
      m[key(a, b)] = 1;
    }
  }
  return m;
}
/* opts.around: a STREAM-only speed-up. A bomb floats only from a run cell, and a
   wade changes an escape only within the step budget of a run cell (aroundR, 0
   when the row does not slow walkers), so no other cell can change the answer. */
function aroundMask(cells, rad) {
  const m = new Uint8Array(N);
  for (let c = 0; c < N; c++) if (cells.some((k) => manh(k, c) <= rad)) m[c] = 1;
  return m;
}
function norm(b, profile, opts) {
  const level = b.level | 0, heat = clampHeat(b.heat), pact = b.pact | 0, P = applyPact(heatProfile(heat), pact);
  const lim = opts.limits ? { ...LIMITS, ...opts.limits } : LIMITS;
  const kind = b.feat ? kindOfLayer(b.feat) : null;
  const items = (b.items || []).map((it) => ({ k: key(it.tx ?? Math.floor(it.x / CFG.TILE), it.ty ?? Math.floor(it.y / CFG.TILE)), buried: !!it.buried, t: it.t }));
  const foes = (b.foes || b.enemies || []).map((e) => ({ type: e.type, k: key(e.tx, e.ty), speed: e.speed ?? foeSpeed(e.type, level, P.curve) }));
  const pace = opts.pace ?? -1, pm = paceMul(pace);
  return { ...b, g: b.grid, feat: b.feat || null, level, heat, pact, P, lim, kind, has: layerHas(b.feat), items, foes, prof: profile || FEAT_PROFILE[heat], tier: opts.tier ?? heat, firstSpot: !!opts.firstSpot,
    fuse: opts.fuse ?? P.fuse, pm, pmRide: Math.max(...PACE_MUL), biome: biomeOf(level).name,
    twin: kind === "PORTAL" && b.featPair ? pairTwins(b.featPair) : null,
    mask: opts.near ? inLine(b.grid, opts.near, Math.max(lim.radius, REACH_MAX), kind === "PORTAL" ? lim.escSteps : 0) : opts.around ? aroundMask(opts.around, opts.aroundR ?? lim.escSteps) : null };
}
/* which moving tiles a layer holds: without them speeds and hides need no per-cell look */
function layerHas(f) {
  const h = { ice: false, belt: false, stream: false };
  if (f) for (let k = 0; k < N; k++) { const v = f[k]; if (!v) continue; if (v === F.GLIDE) h.ice = true; else if (isBelt(v)) h.belt = true; else if (isStream(v)) h.stream = true; }
  return h;
}
function kindOfLayer(f) { for (const v of f) if (v) return featKindOf(v); return null; }
export function foeSpeed(type, level, curve) { return spawnEnemy(type, 0, 0, level, null, { curve }).speed; }

/* ---- the blast model: arms stop at WALL, include and stop at BRICK unless
   pierce/line (fair.js blast()); BOOSTER relays run as an event queue on a
   grid copy (bricks broken earlier in the cascade are gone), one fire per
   booster (cooldown >= the cascade), never inheriting pierce ---- */
const TILES = new Int16Array(512);
function armInto(g, cx, cy, arms, through, pt) {
  let n = 0;
  TILES[n++] = key(cx, cy);
  for (let a = 0; a < arms.length; a++) {
    const arm = arms[a], dx = arm[0], dy = arm[1], len = arm[2];
    let x = cx, y = cy, jumps = 0;
    for (let i = 1; i <= len; i++) {
      x += dx; y += dy;
      if (!inB(x, y)) break;
      const c = key(x, y), v = g[c];
      if (v === T.WALL) break;
      TILES[n++] = c;
      if (v === T.BRICK && !through) break;
      /* PORTAL (#27), the sim's computeBlast: CORE stops on the tile; PLUS / MAX
         include the twin and go on with the leftover reach, 2 jumps at most */
      const tw = pt ? pt.twin[c] : -1;
      if (tw < 0 || g[tw] === T.WALL) continue;
      if (!pt.blast || jumps >= 2) break;
      jumps++;
      TILES[n++] = tw;
      x = tw % C; y = (tw / C) | 0;
    }
  }
  return n;
}
const armTiles = (g, cx, cy, arms, through, pt = null) => Array.from(TILES.subarray(0, armInto(g, cx, cy, arms, through, pt)));
const CROSS = [];
const cross = (r) => (CROSS[r] ??= D4.map(([dx, dy]) => [dx, dy, r]));
/* the furthest any plain arm of a bomb at k runs: cross(r) gains no tile past this r */
function armMax(g, k) {
  let best = 0;
  for (let d = 0; d < 4; d++) {
    let i = 0;
    for (let c = NB[k * 4 + d]; c >= 0 && g[c] !== T.WALL; c = NB[c * 4 + d]) { i++; if (g[c] === T.BRICK) break; }
    if (i > best) best = i;
  }
  return best;
}
/* first lethal time per cell for blasts [{t, k, arms, through}] */
export function lethalMap(g, feat, prof, blasts, useTiles = true, twin = null) {
  const L = new Float64Array(N);
  L.relay = lethalInto(L, g, feat, prof, blasts, useTiles, twin);
  return L;
}
const INF_L = new Float64Array(N).fill(INF), GRID = new Int8Array(N), FIRED = new Uint8Array(N), PT = { twin: null, blast: false };
/* fills L, returns whether a BOOSTER relayed. One blast whose tiles hold no booster
   (nearly every bomb) never needs the event queue or the grid copy. */
function lethalInto(L, g, feat, prof, blasts, useTiles, twin) {
  L.set(INF_L);
  const bl = useTiles && feat ? prof.bloom : null;
  let pt = null;
  if (useTiles && twin) { pt = PT; pt.twin = twin; pt.blast = !!prof.portal.blast; }
  if (blasts.length === 1) {
    const { t, k, arms, through, safe } = blasts[0], cnt = armInto(g, k % C, (k / C) | 0, arms, through, pt);
    let relays = false;
    if (bl) for (let i = 0; i < cnt && !relays; i++) relays = TILES[i] !== k && feat[TILES[i]] === F.BLOOM;
    if (!relays) {
      if (!safe) for (let i = 0; i < cnt; i++) { const c = TILES[i]; if (t < L[c]) L[c] = t; }
      return false;
    }
  }
  const q = blasts.slice();
  GRID.set(g); FIRED.fill(0);
  let relay = false;
  while (q.length) {
    let i = 0;
    for (let j = 1; j < q.length; j++) if (q[j].t < q[i].t) i = j;
    const { t, k, arms, through, safe } = q.splice(i, 1)[0], cx = k % C, cy = (k / C) | 0, cnt = armInto(GRID, cx, cy, arms, through, pt);
    if (!safe) for (let a = 0; a < cnt; a++) { const c = TILES[a]; if (t < L[c]) L[c] = t; }
    for (let a = 0; a < cnt; a++) if (GRID[TILES[a]] === T.BRICK) GRID[TILES[a]] = T.EMPTY;
    if (!bl) continue;
    for (let a = 0; a < cnt; a++) {
      const c = TILES[a];
      if (c === k || feat[c] !== F.BLOOM || GRID[c] !== T.EMPTY || FIRED[c]) continue;
      FIRED[c] = 1; relay = true;
      const dx = Math.sign((c % C) - cx), dy = Math.sign(((c / C) | 0) - cy), arm = [[dx, dy, bl.fwd]];
      if (bl.side) arm.push([dy, dx, bl.side], [-dy, -dx, bl.side]);
      q.push({ t: t + (bl.delay || 0), k: c, arms: arm, through: false, safe: !!bl.safe });
    }
  }
  return relay;
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
  const mvTiles = t && o.move !== false, wade = prof.stream ? prof.stream.wade : 1, has = n.has;
  return { g, feat: n.feat, prof, pm: n.pm, cap: n.lim.escSteps, tiles: t, mvTiles, moves: mvTiles && (has.ice || (has.belt && !!prof.belt.actors) || (has.stream && wade < 1)), near: null, stopOnBrick: o.stopOnBrick !== false, plantBlock: o.plantBlock !== false, open: o.open ?? -1, twin: t && o.warp !== false ? n.twin : null,
    vp: VP * n.pm, vIce: Math.min(VP * prof.glide.boost, CFG.MAX_SPEED) * n.pm, vb: prof.belt.v * n.pm, actors: !!prof.belt.actors, endHalt: !!prof.belt.endHalt, nostop: prof.glide.coast >= 2, stop: prof.glide.stop, wade };
}
const isIce = (E, k) => E.mvTiles && E.feat[k] === F.GLIDE && E.g[k] === T.EMPTY;
const isRide = (E, k) => E.mvTiles && E.actors && isBelt(E.feat[k]) && E.g[k] === T.EMPTY;
const isWade = (E, k) => E.mvTiles && E.wade < 1 && isStream(E.feat[k]) && E.g[k] === T.EMPTY;
function spd(E, k, d) {
  if (isIce(E, k)) return E.vIce;
  if (isWade(E, k)) return E.vp * E.wade;
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
  if (!E.moves) return true;
  if (isIce(E, k) && E.nostop && d < 4) return E.stop === "brake" || blockAt(E, nbr(k, d), t, L, plant);
  if (isRide(E, k)) {
    const [ux, uy] = beltDir(E.feat[k]), dn = nbr(k, dirOf(ux, uy));
    if (dn < 0 || E.g[dn] === T.WALL || (E.stopOnBrick && E.g[dn] === T.BRICK && L[dn] === INF)) return true;
    /* #28 endHalt: a rider is carried to the chain's last cell and stays there */
    return E.endHalt && (isRide(E, dn) ? hide(E, dn, d, t, L, plant) : E.g[dn] !== T.WALL);
  }
  return true;
}
/* earliest escape from `start` under lethal map L; plant = the static bomb
   cell (never re-entered, a stop block on ice until it goes) or -1 */
const STATES = N * 5, FRONT = [new Int16Array(STATES), new Int16Array(STATES)], TIME = [new Float64Array(STATES), new Float64Array(STATES)], SLOT = new Int16Array(STATES), SEEN = new Int32Array(STATES);
let layer = 0;
export function timedEscape(E, L, start, plant = -1) {
  return escapes(E, L, start, plant) ? { ok: true, t: escT, steps: escS } : { ok: false };
}
let escT = 0, escS = 0;
function escapes(E, L, start, plant) {
  if (hide(E, start, 4, 0, L, plant)) { escT = 0; escS = 0; return true; }
  if (layer > 0x3fffffff) { SEEN.fill(0); layer = 0; }
  const g = E.g, open = E.open, mv = E.moves, twin = E.twin, nostop = E.nostop, vp = E.vp;
  let side = 0, count = 1;
  FRONT[0][0] = start * 5 + 4; TIME[0][0] = 0;
  for (let s = 0; s < E.cap && count; s++) {
    const ids = FRONT[side], ts = TIME[side], nid = FRONT[1 - side], nt = TIME[1 - side], gen = ++layer;
    let nn = 0;
    for (let i = 0; i < count; i++) {
      const a = (ids[i] / 5) | 0, ta = ts[i];
      for (let d = 0; d < 4; d++) {
        const b = NB[a * 4 + d];
        if (b < 0 || b === plant || (g[b] !== T.EMPTY && b !== open)) continue;
        const sa = mv ? spd(E, a, d) : vp, sb = mv ? spd(E, b, d) : vp;
        if (sa <= 0 || sb <= 0) continue;
        /* a warp fires as the centre crosses onto the tile and lands on the twin's
           centre; a bomb on the twin or a blade already there leaves plain floor */
        const tw = twin ? twin[b] : -1, te = ta + 0.5 / sa, jump = tw >= 0 && tw !== plant && g[tw] !== T.WALL && te < L[tw];
        const tb = jump ? te : te + 0.5 / sb, c = jump ? tw : b;
        if (tb > L[a]) continue;
        const sid = c * 5 + (mv && nostop && isIce(E, c) ? d : 4);
        if (SEEN[sid] !== gen) { SEEN[sid] = gen; SLOT[sid] = nn; nid[nn] = sid; nt[nn++] = tb; }
        else if (tb < nt[SLOT[sid]]) nt[SLOT[sid]] = tb;
      }
    }
    for (let i = 0; i < nn; i++) if (hide(E, (nid[i] / 5) | 0, nid[i] % 5, nt[i], L, plant)) { escT = nt[i]; escS = s + 1; return true; }
    side = 1 - side; count = nn;
  }
  return false;
}

/* the TRAP footprint a foe arms at plate k: reach r, bricks transparent when
   `through` (an over-approximation of every brick state), else the sim's arms */
const trapTiles = (g, k, r, through) => { const [x, y] = xy(k); return armTiles(g, x, y, cross(r), through); };
/* memo on n, keyed by grid: v20 and v29 re-enter with {...n, g} */
function plates(n) {
  if (n.plateG === n.g) return n.plateL;
  const out = [];
  if (n.feat) for (let k = 0; k < N; k++) if (n.feat[k] === F.PLATE && n.g[k] === T.EMPTY) out.push(k);
  n.plateG = n.g; n.plateL = out;
  return out;
}

/* own bomb at cell c, radius r, on grid g: the lethal map with the tile live
   (BOOSTER relays, CONVEYOR ride union, TRAP chain) or ignored */
/* one owner each: v19 holds a live map and a base map at once, nothing holds two of a kind */
const L_LIVE = new Float64Array(N), L_BASE = new Float64Array(N), L_MORE = new Float64Array(N), NONE = [], AT_ONE = [0], BLAST = { t: 0, k: 0, arms: null, through: false, safe: false }, ONE = [BLAST];
function oneBlast(t, k, arms, through) { BLAST.t = t; BLAST.k = k; BLAST.arms = arms; BLAST.through = through; return ONE; }
function bombMap(n, g, c, r, live, blast = null) {
  const arms = blast ? blast.arms : cross(r), through = blast ? blast.through : false;
  if (!live || !n.feat) { lethalInto(L_BASE, g, null, n.prof, oneBlast(n.fuse, c, arms, through), false, null); return L_BASE; }
  let tb = n.fuse, chain = false, extra = NONE;
  for (const p of plates(n)) if (!n.prof.plate.hold && trapTiles(g, p, n.prof.plate.r, false).includes(c) && (n.prof.plate.near == null || manh(p, c) <= n.prof.plate.near + n.lim.escSteps)) {
    const ch = n.prof.plate.chain;
    if (ch !== false) { chain = true; tb = Math.min(tb, typeof ch === "number" ? Math.max(n.prof.plate.wind, ch) : n.prof.plate.wind); }
    if (extra === NONE) extra = [];
    extra.push({ t: n.prof.plate.wind, k: p, arms: cross(n.prof.plate.r), through: false });
  }
  let at = AT_ONE;
  AT_ONE[0] = c;
  if ((n.prof.belt.thru || isStream(n.feat[c])) && isFlow(n.feat[c]) && g[c] === T.EMPTY) {
    /* #28 pass-through carry: only WALL / BRICK / a bomb stops a ridden bomb, so
       its cell at the fuse is known for each pace (the cells it passes are safe);
       a STREAM float is the same walk at stream.v */
    const path = [c], v = isStream(n.feat[c]) ? n.prof.stream.v : n.prof.belt.v;
    for (let k = c; isFlow(n.feat[k]) && g[k] === T.EMPTY;) {
      const [ux, uy] = flowDir(n.feat[k]), nk = nbr(k, dirOf(ux, uy));
      if (nk < 0 || g[nk] !== T.EMPTY) break;
      k = nk; path.push(k);
      if (path.length > N) break;
    }
    at = [...new Set(PACE_MUL.map((pm) => path[Math.min(path.length - 1, Math.floor(v * pm * n.fuse + 1e-9))]))];
  } else if (isBelt(n.feat[c]) && g[c] === T.EMPTY) {
    let k = c, steps = Math.ceil(n.prof.belt.v * n.pmRide * n.fuse - 1e-9);
    at = [c];
    while (steps-- > 0 && isBelt(n.feat[k]) && g[k] === T.EMPTY) {
      const [ux, uy] = beltDir(n.feat[k]), nk = nbr(k, dirOf(ux, uy));
      if (nk < 0 || g[nk] !== T.EMPTY) break;
      k = nk; at.push(k);
    }
  }
  const L = L_LIVE;
  let relay = false;
  for (let a = 0; a < at.length; a++) {
    const list = extra.length ? [{ t: tb, k: at[a], arms, through }, ...extra] : oneBlast(tb, at[a], arms, through), M = a ? L_MORE : L;
    relay = lethalInto(M, g, n.feat, n.prof, list, true, n.twin) || relay;
    if (a) for (let i = 0; i < N; i++) if (M[i] < L[i]) L[i] = M[i];
  }
  L.cause = chain ? "trap-chain" : at.length > 1 || at[0] !== c ? "bomb-ride" : relay ? "relay" : null;
  L.moved = at.length > 1 || at[0] !== c;
  L.at = at;
  return L;
}
const sameIn = (A, B, c, rad) => { const [cx, cy] = xy(c); for (let y = Math.max(0, cy - rad); y <= Math.min(R - 1, cy + rad); y++) for (let x = Math.max(0, cx - rad); x <= Math.min(C - 1, cx + rad); x++) { if (Math.abs(x - cx) + Math.abs(y - cy) > rad) continue; const k = key(x, y); if (A[k] !== B[k]) return false; } return true; };
function moveTileNear(E, c, rad) {
  if (!E.moves && !E.twin) return false;
  if (!E.near) { E.near = []; for (let k = 0; k < N; k++) if (isIce(E, k) || isRide(E, k) || isWade(E, k) || (E.twin && E.twin[k] >= 0)) E.near.push(k); }
  for (let i = 0; i < E.near.length; i++) if (manh(E.near[i], c) <= rad) return true;
  return false;
}

const FIRST = [];
for (let r = 1; r <= REACH_MAX; r++) FIRST[r] = [["normal", cross(r), false], ["pierce", cross(r), true], ...D4.map(([dx, dy]) => ["line", [[dx, dy, r]], true])];
/* V18: V2 re-run with the tile live, this heat's fuse (opts.fuse overrides),
   the EASY pace; bomb at (1,1), r 1..REACH_MAX, normal / pierce / line x4 */
function v18(n) {
  const g = n.g, s = key(1, 1), E = env(n, g, { tiles: true }), Ef = n.twin ? env(n, g, { tiles: true, warp: false }) : null;
  if (n.mask && !n.mask[s]) return null;
  for (let r = 1; r <= REACH_MAX; r++) for (const [kind, arms, through] of FIRST[r]) {
    const L = bombMap(n, g, s, r, true, { arms, through });
    if (!escapes(E, L, s, s) || (Ef && !escapes(Ef, L, s, s))) return { why: "first bomb has no escape", r, kind };
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
  const cleared = n.g.map((v) => (v === T.BRICK ? T.EMPTY : v)), rad = n.lim.escSteps + 1, twinPt = n.twin ? { twin: n.twin, blast: !!n.prof.portal.blast } : null;
  for (const [st, g] of [["loaded", n.g], ["cleared", cleared]]) {
    const Eb = env(n, g, { tiles: false }), Et = env(n, g, { tiles: true }), Em = env(n, g, { tiles: true, move: false }), Ef = n.twin ? env(n, g, { tiles: true, warp: false }) : null;
    for (let c = 0; c < N; c++) {
      if (g[c] !== T.EMPTY || (n.mask && !n.mask[c])) continue;
      let reach = 0;
      for (let r = 1, cnt = -1; r <= n.lim.radius; r++) {
        if (n.twin) { const x = c % C, y = (c / C) | 0, rc = cross(r), m = armInto(g, x, y, rc, false, twinPt) + armInto(g, x, y, rc, false, null); if (m === cnt) continue; cnt = m; }
        /* a radius whose arms reach no further from any cell the bomb can blow at gives the same maps as the last one */
        else if (r > reach && r > 1) break;
        const Lt = bombMap(n, g, c, r, true), plant = Lt.moved ? -1 : c;
        if (r === 1 && !n.twin) { reach = armMax(g, c); for (const k of Lt.at) reach = Math.max(reach, armMax(g, k)); }
        if (!n.twin && escapes(Et, Lt, c, plant)) continue;
        const Lb = bombMap(n, g, c, r, false);
        if (!escapes(Eb, Lb, c, c)) break;
        if (!moveTileNear(Et, c, rad) && sameIn(Lb, Lt, c, rad)) continue;
        /* PORTAL: the escape holds both ways, every portal warping and every portal plain floor (a foe the check cannot see may block a warp) */
        const warped = escapes(Et, Lt, c, plant);
        if (warped && (!Ef || escapes(Ef, Lt, c, plant))) continue;
        if (Ef) { const cz = warped ? "floor" : "warp", timed = !n.firstSpot && !escapes(free(warped ? Ef : Et), Lt, c, plant); add(c, cz, { at: xy(c), r, state: st, cause: cz, kind: timed ? "time" : "cap" }, timed); if (n.firstSpot) return { why: "no-escape spot", spots: 1 }; break; }
        if (n.firstSpot) return { why: "no-escape spot", spots: 1 };
        const cause = Lt.cause && !escapes(Em, Lt, c, plant) ? Lt.cause : n.kind === "GLIDE" ? "coast" : n.kind === "BELT" ? "ride" : n.kind === "STREAM" ? "wade" : Lt.cause || "tile";
        const timed = !escapes(free(Et), Lt, c, plant);
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
      if (escapes(E, L, q, p)) continue;
      if (!through) { exact.add(q); continue; }
      const timed = !escapes(free(E), L, q, p);
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
  if (!prof.belt.actors || prof.belt.foes === false) return null;
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
      if (atWall && (!prof.belt.actors || prof.belt.wallStop)) continue;
      const s = stepOffs(g, feat, ch, lim, !atWall);
      if (s >= 0) return { why: "ring " + ring + ": no step-off" + (atWall ? " at the new wall" : ""), at: xy(s) };
    }
    if (n.kind === "GLIDE") {
      const ok = new Uint8Array(N), q = [];
      for (let k = 0; k < N; k++) if (alive(k) && feat[k] !== F.GLIDE) { ok[k] = 1; q.push(k); }
      for (let h = 0; h < q.length; h++) for (let d = 0; d < 4; d++) { const m = nbr(q[h], d); if (m >= 0 && alive(m) && !ok[m]) { ok[m] = 1; q.push(m); } }
      for (let k = 0; k < N; k++) if (feat[k] === F.GLIDE && alive(k) && !ok[k]) return { why: "ring " + ring + ": ice sealed", at: xy(k) };
    }
    if (n.kind === "STREAM") {
      const ok = new Uint8Array(N), q = [];
      for (let k = 0; k < N; k++) if (alive(k) && !isStream(feat[k])) { ok[k] = 1; q.push(k); }
      for (let h = 0; h < q.length; h++) for (let d = 0; d < 4; d++) { const m = nbr(q[h], d); if (m >= 0 && alive(m) && !ok[m]) { ok[m] = 1; q.push(m); } }
      for (let k = 0; k < N; k++) if (isStream(feat[k]) && alive(k) && !ok[k]) return { why: "ring " + ring + ": water sealed", at: xy(k) };
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
/* V30 QUICKSAND placement on the brick-free map (walls only), feat.js quick()'s rule on the finished board */
function v30(n) {
  const { g, feat } = n, P = QUICK_PLACE, qs = [], w = walk(g, true), ok = (x, y) => notWall(g, inB(x, y) ? key(x, y) : -1);
  for (let k = 0; k < N; k++) if (feat[k] === F.QUICK) qs.push(k);
  if (qs.length < P.min || qs.length > P.max) return { why: qs.length + " quicksand tiles" };
  for (const k of qs) {
    if (qs.some((o) => o !== k && manh(o, k) < P.gap)) return { why: "tiles within " + P.gap, at: xy(k) };
    if (w[k] >= 0 && w[k] <= n.lim.spawnSteps) return { why: "tile near the start", at: xy(k) };
    if (DOORS.includes(k)) return { why: "tile on a door", at: xy(k) };
    if (openN(g, k) < P.nbrs) return { why: "fewer than " + P.nbrs + " open neighbours", at: xy(k) };
    if (quickDetour(ok, k) < P.detour) return { why: "no detour", at: xy(k) };
  }
  if (quickSeals(ok, qs)) return { why: "mounds part the map" };
  for (let ring = 1; ring <= n.lim.rings; ring++) {
    const okR = (x, y) => ok(x, y) && (Math.min(x, C - 1 - x, y, R - 1 - y) > ring || (x === 1 && y === 1));
    if (quickSeals(okR, qs)) return { why: "ring " + ring + ": mounds part the map" };
  }
  return null;
}
/* V31: V19's counterfactual with mounds as WALL beyond the hold reach. An escape of at
   most escSteps only touches cells that near, and inside the reach a mound cannot grow
   or finish, so a cell is only tested if a mound lies past the reach yet within the cap;
   with hold 4 and escSteps 4 no such cell exists, a proof rather than a measurement.
   limits.quickHold moves the minimum; below 0 there is no hold at all (tests prove the
   check bites). */
function v31(n) {
  const { feat, lim } = n, qs = [], hold = lim.quickHold ?? HOLD_MIN, spots = new Map();
  for (let k = 0; k < N; k++) if (feat[k] === F.QUICK) qs.push(k);
  const cleared = n.g.map((v) => (v === T.BRICK ? T.EMPTY : v));
  for (const [st, g] of [["loaded", n.g], ["cleared", cleared]]) {
    const Eb = env(n, g, { tiles: false });
    for (let c = 0; c < N; c++) {
      if (g[c] !== T.EMPTY || spots.has(c)) continue;
      const near = qs.filter((q) => g[q] === T.EMPTY && manh(q, c) <= lim.escSteps && manh(q, c) > hold);
      if (!near.length) continue;
      for (let r = 1; r <= lim.radius; r++) {
        if (!escapes(Eb, bombMap(n, g, c, r, false), c, c)) break;
        const walls = near.filter((q) => manh(q, c) > (hold < 0 ? hold : holdReach(r, hold)));
        if (!walls.length) break;
        const m = g.slice();
        for (const q of walls) m[q] = T.WALL;
        if (escapes(env(n, m, { tiles: false }), bombMap(n, m, c, r, false), c, c)) continue;
        spots.set(c, { at: xy(c), r, state: st });
        break;
      }
    }
  }
  return spots.size ? { why: spots.size + " no-escape spot(s)", spots: spots.size, first: spots.values().next().value } : null;
}

/* ---- GATE: V32 + V33. All gates shut for good proves every phase of the clock:
   movement reads the shut grid (no phase blocks more), the blast reads the open
   grid (no phase reaches further, a shut bar only stops an arm). ---- */
const pieces = (g, gone) => {
  const seen = new Uint8Array(N);
  let n = 0;
  for (let s = 0; s < N; s++) {
    if (seen[s] || g[s] === T.WALL || gone.includes(s)) continue;
    n++; seen[s] = 1;
    const q = [s];
    while (q.length) { const a = q.pop(); for (let d = 0; d < 4; d++) { const b = nbr(a, d); if (b >= 0 && !seen[b] && g[b] !== T.WALL && !gone.includes(b)) { seen[b] = 1; q.push(b); } } }
  }
  return n;
};
/* a shut gate never parts the brick-free map, and neither does it under SHRINK
   rings 1..LIMITS.rings (the rings may part it themselves): returns -1 on the
   whole map, the ring number under a ring, 0 for no split */
export function gateSplit(grid, gs) {
  for (let ring = 0; ring <= LIMITS.rings; ring++) {
    const g = grid.slice();
    if (ring) for (let k = 0; k < N; k++) if (RIM[k] >= 1 && RIM[k] <= ring && k !== K11) g[k] = T.WALL;
    if (pieces(g, gs) > pieces(g, [])) return ring || -1;
  }
  return 0;
}
/* own bomb at every cell the shut gates can touch (within the step cap of `near`,
   default all of gs): an escape on the open grid that fails on the shut one is a
   spot. A bomb on a gate holds that gate open. r stops at the cap: a blast further
   out reaches no cell a capped escape can visit. Two brick states, as V19, on the
   open board and after each SHRINK ring: a ring can wall the other way round. */
export function gateSpot(b, profile, gs, near = null) {
  const n = norm(b, profile, {}), cap = n.lim.escSteps, rMax = Math.min(n.lim.radius, cap);
  const cleared = n.g.map((v) => (v === T.BRICK ? T.EMPTY : v));
  const at = near == null ? gs : [near];
  for (let ring = 0; ring <= n.lim.rings; ring++) for (const g0 of [n.g, cleared]) {
    const g = g0.slice();
    for (const k of gs) g[k] = T.EMPTY;
    if (ring) for (let k = 0; k < N; k++) if (RIM[k] >= 1 && RIM[k] <= ring && k !== K11) g[k] = T.WALL;
    const shut = g.slice();
    for (const k of gs) shut[k] = T.WALL;
    const Eb = env(n, g, { tiles: false }), Es = env(n, shut, { tiles: false });
    for (let c = 0; c < N; c++) {
      if (g[c] !== T.EMPTY || !at.some((k) => manh(k, c) <= cap)) continue;
      const own = gs.includes(c), E = own ? env(n, shut.map((v, i) => (i === c ? T.EMPTY : v)), { tiles: false }) : Es;
      for (let r = 1; r <= rMax; r++) {
        const L = bombMap(n, g, c, r, false);
        if (!escapes(Eb, L, c, c)) break;
        if (!escapes(E, L, c, c)) return { at: xy(c), r };
      }
    }
  }
  return null;
}

/* V28: the STREAM placement rule on the finished board, see feat.js stream() */
function streamRuns(feat) {
  const out = [];
  for (let k = 0; k < N; k++) {
    if (!isStream(feat[k])) continue;
    const [ux, uy] = flowDir(feat[k]), up = nbr(k, dirOf(-ux, -uy));
    if (up >= 0 && feat[up] === feat[k]) continue;
    const cells = [];
    let q = k;
    while (q >= 0 && feat[q] === feat[k]) { cells.push(q); q = nbr(q, dirOf(ux, uy)); }
    out.push({ cells, past: q });
  }
  return out;
}
function v28(n) {
  const { g, feat, lim } = n, runs = streamRuns(feat), w = walk(g, true);
  if (runs.length !== lim.streamRuns) return { why: runs.length + " runs" };
  let total = 0;
  for (const r of runs) {
    const L = r.cells.length, head = r.cells[0];
    total += L;
    if (L < lim.streamMin || L > lim.streamMax) return { why: "run of " + L, at: xy(head) };
    for (const k of r.cells) {
      if (g[k] !== T.EMPTY) return { why: "water under a block", at: xy(k) };
      if (DOORS.includes(k) || w[k] < 0 || w[k] <= lim.spawnSteps) return { why: "water near the start", at: xy(k) };
      for (let d = 0; d < 4; d++) { const m = nbr(k, d); if (m >= 0 && isStream(feat[m]) && !r.cells.includes(m)) return { why: "runs touch", at: xy(k) }; }
    }
    if (!notWall(g, r.past)) return { why: "run ends at a WALL", at: xy(head) };
    if (w[r.past] < w[head]) return { why: "run carries toward the start", at: xy(head) };
  }
  if (total > lim.streamTotal) return { why: "water tiles " + total };
  return null;
}
/* V29: the V19 counterfactual with the float and the wade after each SHRINK ring
   (V19 proves the open board; a run cut by a ring floats to the wall and stops) */
function v29(n) {
  for (let ring = 1; ring <= n.lim.rings; ring++) {
    const g = n.g.slice();
    for (let k = 0; k < N; k++) if (RIM[k] >= 1 && RIM[k] <= ring && k !== K11) g[k] = T.WALL;
    const f = v19({ ...n, g });
    if (f) return { ...f, why: "ring " + ring + ": " + f.why, ring };
  }
  return null;
}

/* V34 PORTAL placement: 1-2 pairs on open floor, >= 12 walking steps from the start
   (bricks passable, so a shortcut through a pair cannot beat a foe's fair-start
   distance), twins >= 8 Manhattan and walking apart, no two portals within 3, >= 2
   open neighbours */
function v34(n) {
  const { feat, g, twin } = n, ps = [], w = walk(g, true), P = PORTAL_PLACE;
  if (!twin) return { why: "portal without pairs" };
  for (let k = 0; k < N; k++) if (feat[k] === F.PORTAL) ps.push(k);
  if (ps.length < 2 || ps.length > 2 * P.pairs) return { why: ps.length + " portals" };
  for (const k of ps) {
    if (g[k] !== T.EMPTY) return { why: "portal under a brick", at: xy(k) };
    if (w[k] < P.start) return { why: "portal " + w[k] + " steps from spawn", at: xy(k) };
    if (openN(g, k) < P.open) return { why: "portal without a step-off", at: xy(k) };
    if (ps.some((o) => o !== k && manh(o, k) <= P.gap)) return { why: "portals within " + P.gap, at: xy(k) };
    const tw = twin[k], dw = walk(g, true, k % C, (k / C) | 0)[tw];
    if (manh(k, tw) < P.twin || dw < P.twin) return { why: "twins too near", at: xy(k) };
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
    for (const e of n.foes) if (feat[e.k] && (feat[e.k] !== F.GLIDE || e.type === "stationary")) hit(e.type === "stationary" ? "sentry" : "foe", (e.type === "stationary" ? "SENTRY" : e.type) + " spawns on a tile", xy(e.k));
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
  /* STREAM */
  V28(n) { return n.kind === "STREAM" ? v28(n) : null; },
  V29(n) { return n.kind === "STREAM" ? v29(n) : null; },
  /* QUICKSAND */
  V30(n) { return n.kind === "QUICK" ? v30(n) : null; },
  V31(n) { return n.kind === "QUICK" ? v31(n) : null; },
  /* GATE */
  V32(n) {
    if (n.kind !== "GATE") return null;
    const { g, feat, lim } = n, gs = [], w = walk(g, true);
    for (let k = 0; k < N; k++) if (feat[k] === F.GATE) gs.push(k);
    if (gs.length < lim.gateMin || gs.length > lim.gateMax) return { why: gs.length + " gates" };
    for (const k of gs) {
      const [x, y] = xy(k), o = (d) => notWall(g, nbr(k, d));
      if (!((o(0) && o(2) && !o(1) && !o(3)) || (o(1) && o(3) && !o(0) && !o(2)))) return { why: "gate off a corridor", at: [x, y] };
      if (g[k] !== T.EMPTY) return { why: "gate under a brick", at: [x, y] };
      if (w[k] >= 0 && w[k] <= lim.spawnSteps) return { why: "gate " + w[k] + " steps from spawn", at: [x, y] };
      if (DOORS.includes(k)) return { why: "gate on a door", at: [x, y] };
      if (gs.some((o2) => o2 !== k && manh(o2, k) < lim.gateGap)) return { why: "gates within " + lim.gateGap, at: [x, y] };
    }
    const r = gateSplit(g, gs);
    return r ? { why: "shut gates split the map" + (r > 0 ? " at ring " + r : "") } : null;
  },
  V33(n) {
    if (n.kind !== "GATE") return null;
    const gs = [];
    for (let k = 0; k < N; k++) if (n.feat[k] === F.GATE) gs.push(k);
    const s = gateSpot({ grid: n.g, level: n.level, heat: n.heat, pact: n.pact }, n.prof, gs);
    return s ? { why: "no-escape spot with the gates shut", ...s } : null;
  },
  /* PORTAL */
  V34(n) { return n.kind === "PORTAL" ? v34(n) : null; },
  V35(n) { return n.kind === "PORTAL" ? v18(n) || v19(n) : null; },
};
const NEED = { V21: (b) => !!b.featByHeat, V22: (b) => !!b.rebuild, V23: (b) => b.gen != null };
const NEEDS_LAYER = new Set(["V14", "V15", "V16", "V17", "V19", "V20", "V24", "V25", "V26", "V27", "V28", "V29", "V30", "V31", "V32", "V33", "V34", "V35"]);
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
