/* THROWAWAY PROTOTYPE (2026-10-21 tile round, wave 1): the floor-feature
   layer world.feat. Codes: 1..4 BELT E/S/W/N, 5 GLIDE, 6 BLOOM, 7 PLATE.
   Tables follow 04-synthesis §7.2 exactly, except CONVEYOR (BELT), which is
   design pass 2 (#28, 2026-10-26: placement, thru / snap / endHalt / wallStop,
   PLUS carries no foes, CORE v 0.6); `tier` is heat (or an arm
   override, world.featTier). Placement is keyed (seed, room) only and runs
   on the gen-2 skeleton after stamps and flip, so heat never moves a tile.
   Never merges.
   Placement lives in featplace.js (gen 3 only, out of the boot graph).
   CODES 8..14 (rules 2026-11-01, #26 #27): 8..11 STREAM E/S/W/N (tilestream.js), 12 QUICK
   (tilequick.js), 13 PORTAL (pair id 1/2 in world.featPair, tileportal.js), 14 GATE
   (tilegate.js). HOME is the one room-biome -> tile table. */
import { CFG, key } from "./config.js";

const C = CFG.COLS, R = CFG.ROWS, N = C * R;
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const F = Object.freeze({ NONE: 0, BELT_E: 1, BELT_S: 2, BELT_W: 3, BELT_N: 4, GLIDE: 5, BLOOM: 6, PLATE: 7, STREAM_E: 8, STREAM_S: 9, STREAM_W: 10, STREAM_N: 11, QUICK: 12, PORTAL: 13, GATE: 14 });
export const FDIR = Object.freeze([[1, 0], [0, 1], [-1, 0], [0, -1]]);
export const isBelt = (v) => v >= 1 && v <= 4;
export const beltDir = (v) => FDIR[v - 1];
export const isStream = (v) => v >= 8 && v <= 11;
export const isFlow = (v) => isBelt(v) || isStream(v);
export const flowDir = (v) => FDIR[isStream(v) ? v - 8 : v - 1];
export const HOME = Object.freeze({ FACTORY: "BELT", ICE: "GLIDE", JUNGLE: "BLOOM", ARENA: "PLATE", WATER: "STREAM", SAND: "QUICK", VOID: "PORTAL", CROWN: "GATE" });

export const FEAT_PROFILE = Object.freeze([
  Object.freeze({ belt: { actors: false, v: 0.6, thru: true }, glide: { boost: 1.0, coast: 0, turn: 0.35 }, bloom: { fwd: 2, side: 0, delay: 0, cd: 1.0 }, plate: { wind: 0.5, r: 1, cd: 3, inert: 2, near: 4, off: 1, hold: true, chain: false }, stream: { v: 0.8, wade: 1 }, quick: { wait: 30, max: 1, grow: 1.5, retry: 2, sink: 0.6 }, gate: { cross: true, warn: 0.5, shut: 3, after: 3 }, portal: { blast: false, foes: false } }),
  Object.freeze({ belt: { actors: true, v: 1.0, foes: false, thru: true, snap: true, endHalt: true, wallStop: true }, glide: { boost: 1.25, coast: 1, turn: 0.2 }, bloom: { fwd: 2, side: 1, delay: 0.15, cd: 1.0 }, plate: { wind: 0.8, r: 2, cd: 4, inert: 2, near: 4, off: 1, hold: true, chain: false, spare: true }, stream: { v: 1.0, wade: 0.85 }, quick: { wait: 18, max: 3, grow: 1.5, retry: 2, sink: 1 }, gate: { open: 6, warn: 1, shut: 3 }, portal: { blast: true, foes: false } }),
  Object.freeze({ belt: { actors: true, v: 1.2, thru: true, snap: true, endHalt: true, wallStop: true }, glide: { boost: 1.5, coast: 3, turn: 0.1, stop: "brake" }, bloom: { fwd: 2, side: 2, delay: 0.3, cd: 1.0 }, plate: { wind: 1.0, r: 3, cd: 3, inert: 6, off: 1, hold: true, chain: false, kill: false }, stream: { v: 1.4, wade: 0.75 }, quick: { wait: 10, max: 99, grow: 1.5, retry: 2, sink: 1 }, gate: { open: 4, warn: 0.75, shut: 4 }, portal: { blast: true, foes: true, guard: 3, hold: 2, inert: 6 } }),
]);
export const TILE_HELP = Object.freeze({
  BELT: ["CARRIES YOUR BOMBS", "CARRIES BOMBS AND YOU", "CARRIES ALL, FOES TOO"],
  GLIDE: ["SMOOTH ICE, STOP ANY TIME", "FAST ICE, SLIDES A STEP", "SLIDES ON · BACK TO STOP"],
  BLOOM: ["THROWS YOUR BLAST 2 ON", "2 ON + 1 EACH SIDE", "2 ON + 2 EACH SIDE, LATE"],
  PLATE: ["LURE FOES ON · SHORT", "TRIGGER FOE LIVES · LONG", "HURTS ONLY YOU · HUGE"],
  STREAM: ["CARRIES BOMBS", "CARRIES BOMBS · SLOWS ALL", "FAST · SLOWS ALL MORE"],
  QUICK: ["BRICK GROWS BACK ONCE", "GROWS BACK, 3 TIMES", "KEEPS GROWING BACK"],
  GATE: ["SHUTS BEHIND YOU", "SHUTS ON A CLOCK", "SHUTS LONGER"],
  PORTAL: ["YOU AND BOMBS JUMP", "BLASTS JUMP TOO", "FOES JUMP TOO"],
});
export const TILE_NAME = Object.freeze({ BLOOM: "BOOSTER", GLIDE: "ICE PATCH", BELT: "CONVEYOR", STREAM: "STREAM", PLATE: "TRAP", QUICK: "QUICKSAND", PORTAL: "PORTAL", GATE: "GATE" });
/* The first-contact coach tip (#24): TILE_HELP's short line says what a tile is,
   this says what to do about it, one panel line (<= 80 chars, the 600 board) and
   no key names, so every layout reads the same. Facts come from the live
   profile row, so a retuned knob cannot leave the copy behind. */
/* The one test for "this heat's ICE line teaches the brake", V19's nostop case */
export const glideBrakes = (pr) => pr.glide.coast >= 2 && pr.glide.stop === "brake";
export function tileTip(kind, pr) {
  const n = TILE_NAME[kind] + " · ";
  if (kind === "BLOOM") {
    const b = pr.bloom;
    return n + "THROWS YOUR BLAST " + b.fwd + " FURTHER" + (b.side ? ", " + b.side + " EACH SIDE" : "") + (b.delay ? ", LATE" : "") + (b.safe ? "" : " · CAN HURT YOU");
  }
  if (kind === "GLIDE") {
    const g = pr.glide;
    if (!g.coast) return n + TILE_HELP.GLIDE[0];
    if (g.coast === 1) return n + "FAST ICE · LET GO AND YOU SLIDE A STEP";
    return n + "FAST ICE, YOU SLIDE ON · " + (glideBrakes(pr) ? "STOP EARLY: PRESS BACK AS YOU LET GO" : "ONLY A BLOCK STOPS YOU");
  }
  if (kind === "BELT") {
    const b = pr.belt;
    return n + "CARRIES " + (!b.actors ? "YOUR BOMBS, NOT YOU" : b.foes === false ? "BOMBS AND YOU, NOT FOES" : "BOMBS, YOU AND FOES") + (b.actors && b.snap ? " · HOLD A SIDE TO STEP OFF" : "");
  }
  if (kind === "PLATE") {
    const p = pr.plate, chain = p.chain === false ? " · NO BOMB CHAIN" : "";
    if (p.kill === false) return n + "FOES SET IT OFF · MARKS HURT ONLY YOU · FIRST " + p.inert + " S SAFE" + chain;
    if (p.spare) return n + "THE FOE THAT SETS IT OFF LIVES · MARKS HURT YOU" + chain;
    return n + "LURE A FOE ON · MARKS KILL IT, CAN HURT YOU" + chain;
  }
  if (kind === "STREAM") return n + "FLOATS YOUR BOMBS" + (pr.stream.wade < 1 ? " · SLOWS YOU AND FOES" : " · WALK THROUGH FREELY");
  if (kind === "QUICK") return n + (pr.quick.max === 1 ? "A BRICK GROWS BACK ONCE · FOES SINK SLOW" : "BRICKS GROW BACK · WATCH THE RIPPLES");
  if (kind === "GATE") return n + (pr.gate.cross ? "SHUTS BEHIND YOU · FOES CAN'T PASS" : "SHUTS ON A CLOCK · WATCH THE WARNING");
  if (kind === "PORTAL") return n + (pr.portal.foes ? "YOU, BOMBS, BLASTS AND FOES JUMP" : pr.portal.blast ? "YOU, BOMBS AND BLASTS JUMP" : "YOU AND BOMBS JUMP · BLASTS STOP");
  return "";
}
/* the pair lookup: twin cell per cell, -1 off a portal */
const TWINS = new WeakMap();
export function pairTwins(pair) {
  let t = TWINS.get(pair);
  if (t) return t;
  t = new Int16Array(N).fill(-1);
  const seen = [0, -1, -1, -1, -1];
  for (let k = 0; k < N; k++) { const id = pair[k]; if (!id) continue; if (seen[id] < 0) seen[id] = k; else { t[k] = seen[id]; t[seen[id]] = k; } }
  TWINS.set(pair, t);
  return t;
}
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

/* spawner exclusion: no foe on a feature tile, none within 1 of a PLATE or a PORTAL;
   ICE PATCH is player-only, so only a SENTRY may not start on it (V24) */
export function spawnBlocked(feat, x, y, t) {
  if (!feat) return false;
  const v = feat[key(x, y)];
  if (v === 5) return t === "stationary";
  if (v) return true;
  for (const [dx, dy] of D4) { const n = feat[key(x + dx, y + dy)]; if (n === 7 || n === 13) return true; }
  return false;
}
/* V17 time-weighted foe distance (pass 2: the featchecks V17 model): steps
   from the spawn, a foe walking a BELT cell (bricks passable) pays half a
   step per half cell at vf/(vf +- v), with the conservative foe per edge:
   the slowest (vf) where the belt carries it toward the spawn, the fastest
   (vmax) where it walks against. */
export function beltDist(grid, feat, v, vf, sx = 1, sy = 1, vmax = vf) {
  const d = new Float32Array(N).fill(Infinity), done = new Uint8Array(N);
  d[key(sx, sy)] = 0;
  const half = (q, dx, dy) => {
    if (!isBelt(feat[q])) return 0.5;
    const [bx, by] = beltDir(feat[q]), u = -(bx * dx + by * dy), f = u > 0 ? vf : vmax, s = f + v * u;
    return s > 0 ? 0.5 * f / s : Infinity;
  };
  for (;;) {
    let k = -1, best = Infinity;
    for (let i = 0; i < N; i++) if (!done[i] && d[i] < best) { best = d[i]; k = i; }
    if (k < 0) break;
    done[k] = 1;
    const x = k % C, y = (k / C) | 0;
    for (const [dx, dy] of D4) {
      const nx = x + dx, ny = y + dy, nk = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= C || ny >= R || grid[nk] === 2 || done[nk]) continue;
      const c = half(k, dx, dy) + half(nk, dx, dy);
      if (d[k] + c < d[nk]) d[nk] = d[k] + c;
    }
  }
  return d;
}
