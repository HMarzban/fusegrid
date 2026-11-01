/* No-escape counter (#25): a monotone timed-escape search over a timed
   lethal map, run twice per tick (plain model vs tile model). A spot is
   TILE-FORCED when the plain model finds an escape and the tile model does
   not. Never imported by src/.
   Lethal map L[k] = the earliest time (s from now, float64) tile k is under
   a blade: live blades at 0, every live bomb at its effective fuse (chains
   fold to the earliest blast that covers it), and with tiles: a carried
   bomb at the CONVEYOR cell it has reached when it blows, BOOSTER relays at
   blast + delay (recursive, delays add up, a cooling or arming booster does
   not relay, one relay per booster), pending TRAP wind-ups and BOOSTER
   flares at featS, and the early detonation they force on any bomb they
   cover. Blasts are processed in time order on a working grid, so a brick a
   blast breaks no longer stops a later one.
   Search: earliest arrival (Dijkstra, linear scan), hitbox r 0.3 tile as in
   applyBlastHits: moving centre to centre takes 1 / v, the hitbox touches the
   next tile after 0.2 of it and leaves the current one after 0.8. ENTRY IS
   FORBIDDEN once a tile turns lethal (the blade may end later; the search
   never waits for it), and the current tile must be left before it turns
   lethal. Every condition is "time < threshold", so an earlier arrival is
   never worse and the search is exact for the model (the 2026-10-21 first
   counter allowed entry after a blade window and stored Float32 times, and
   produced false spots). Success = reaching a tile that never turns lethal
   (with tiles: not an ICE PATCH tile at coast >= 2, no wait tile). Tile
   speeds: ICE PATCH boost leaving a sheet tile, CONVEYOR push with / against. */
import { CFG, T, key } from "../../src/core/config.js";
import { tileOf } from "../../src/core/board.js";
import { C, N, BD, prof, rulesOn, onIce, cross, bombArms, bombPass, relayArms, plateArms, beltPath, cellAt, moveSpeed } from "./tilemodel.mjs";

export const MARGIN = CFG.STEP;
const HR = 0.3;

export function lethalMap(w, tiles) {
  tiles = !!tiles && rulesOn(w);
  const L = new Float64Array(N).fill(Infinity), g = w.grid.slice();
  for (const bl of w.blades) if (bl.tiles) for (const t of bl.tiles) L[key(t.tx, t.ty)] = 0;
  const P = tiles ? prof(w) : null, bc = P && P.bloom;
  const bombs = w.bombs.filter((b) => !b.dead).map((b) => ({ b, te: b.timer, done: false, path: tiles ? beltPath(w, b, b.timer) : null }));
  const ev = [];
  if (tiles)
    for (const q of w.featPend) {
      const x = q.k % C, y = (q.k / C) | 0;
      ev.push({ t: Math.max(0, w.featS[q.k]), x, y, arms: q.kind === "plate" ? plateArms(P.plate) : relayArms(bc, q.dx, q.dy), pass: false, plate: q.kind === "plate" });
    }
  const fired = new Set();
  const cellOf = (o, t) => (o.path ? cellAt(o.path, t) : [o.b.tx, o.b.ty]);
  for (let guard = 0; guard < 4 * N; guard++) {
    let bi = -1, bt = Infinity;
    for (let i = 0; i < bombs.length; i++) if (!bombs[i].done && bombs[i].te < bt) { bt = bombs[i].te; bi = i; }
    let ei = -1, et = Infinity;
    for (let i = 0; i < ev.length; i++) if (ev[i].t < et) { et = ev[i].t; ei = i; }
    if (bi < 0 && ei < 0) break;
    let x, y, arms, pass, t, plate = false;
    if (ei >= 0 && et <= bt) { const e = ev.splice(ei, 1)[0]; x = e.x; y = e.y; arms = e.arms; pass = e.pass; t = e.t; plate = !!e.plate; }
    else { const o = bombs[bi]; o.done = true; [x, y] = cellOf(o, o.te); arms = bombArms(o.b); pass = bombPass(o.b); t = o.te; }
    const s = cross(g, x, y, arms, pass, new Set());
    for (const k of s) {
      if (t < L[k]) L[k] = t;
      if (g[k] === T.BRICK) g[k] = T.EMPTY;
    }
    const ch = plate ? P.plate.chain : undefined, fz = w.fuse == null ? CFG.FUSE : w.fuse;
    if (ch !== false) for (const o of bombs) if (!o.done && o.te > t) { const [bx, by] = cellOf(o, t); if (s.has(key(bx, by))) o.te = typeof ch === "number" ? Math.min(o.te, Math.max(t, ch - (fz - o.b.timer))) : t; }
    if (tiles)
      for (const k of s) {
        const kx = k % C, ky = (k / C) | 0;
        if ((kx === x && ky === y) || w.feat[k] !== 6 || w.grid[k] !== T.EMPTY || w.featM[k] !== 0 || fired.has(k)) continue;
        fired.add(k);
        ev.push({ t: t + bc.delay, x: kx, y: ky, arms: relayArms(bc, Math.sign(kx - x), Math.sign(ky - y)), pass: false });
      }
  }
  return L;
}

export function escape(w, tiles, L) {
  tiles = !!tiles && rulesOn(w);
  if (!L) L = lethalMap(w, tiles);
  const p = w.players[0], sx = tileOf(p.x), sy = tileOf(p.y), s0 = key(sx, sy);
  const glideStop = !(tiles && prof(w).glide.coast >= 2);
  const terminal = (k) => L[k] === Infinity && (glideStop || !onIce(w, k));
  if (terminal(s0)) return true;
  const best = new Float64Array(N).fill(Infinity), done = new Uint8Array(N);
  const bombAt = new Uint8Array(N);
  for (const b of w.bombs) if (!b.dead) bombAt[key(b.tx, b.ty)] = 1;
  bombAt[s0] = 0;
  best[s0] = 0;
  const ox = p.x / CFG.TILE - (sx + 0.5), oy = p.y / CFG.TILE - (sy + 0.5);
  for (;;) {
    let k = -1, t = Infinity;
    for (let i = 0; i < N; i++) if (!done[i] && best[i] < t) { t = best[i]; k = i; }
    if (k < 0) return false;
    done[k] = 1;
    if (k !== s0 && terminal(k)) return true;
    const x = k % C, y = (k / C) | 0;
    for (const [dx, dy] of BD) {
      const nk = key(x + dx, y + dy);
      if (done[nk] || w.grid[nk] !== T.EMPTY || bombAt[nk]) continue;
      const v = moveSpeed(w, p, k, dx, dy, tiles);
      if (v <= 0.05) continue;
      let o = 0, q = 0;
      if (k === s0) { o = dx ? ox * dx : oy * dy; q = Math.abs(dx ? oy : ox); }
      const leave = t + (0.5 + HR - o + q) / v, enter = t + Math.max(0, 0.5 - HR - o + q) / v, arrive = t + (1 - o + q) / v;
      if (leave + MARGIN >= L[k] || enter + MARGIN >= L[nk]) continue;
      if (arrive < best[nk]) best[nk] = arrive;
    }
  }
}

/* the per-tick probe: in a live footprint (either model), can the player
   escape without / with the tile model? */
export function probe(w) {
  const tiles = rulesOn(w);
  if (!w.bombs.length && !(tiles && w.featPend.length) && !w.blades.length) return null;
  const p = w.players[0];
  if (!p.alive) return null;
  const k = key(tileOf(p.x), tileOf(p.y));
  const L0 = lethalMap(w, false), L1 = tiles ? lethalMap(w, true) : L0;
  if (L0[k] === Infinity && L1[k] === Infinity) return null;
  const e0 = escape(w, false, L0), e1 = tiles ? escape(w, true, L1) : e0;
  return { e0, e1, forced: e0 && !e1 };
}
