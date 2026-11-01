/* PORTAL (#27, record 2026-11-01 section 6): paired tiles, world.featPair holds the
   pair id. A warp is a relocation outside moveEntity: the sim moves an entity as
   usual, then this tick sees its centre cross onto a portal tile and sets it on the
   twin's centre, direction kept. Only the crossing fires, so nothing warps again
   until it has left the tile it arrived on (the latch), and a walker who crossed
   while the pair was blocked stays on plain floor until it leaves.
   A pair is dead for good once a SHRINK ring walls either tile. computeBlast reads
   armJump, so a blast passes per heat and the render tell reads the same rule. */
import { CFG, T, key } from "./config.js";
import { tileOf } from "./board.js";
import { featProfile, pairTwins } from "./feat.js";

export const MAX_JUMPS = 2;
const FT = CFG.TILE, C = CFG.COLS;
const cx = (k) => ((k % C) + 0.5) * FT, cy = (k) => (((k / C) | 0) + 0.5) * FT;
const twinOf = (w, k) => pairTwins(w.featPair)[k];
const dead = (g, k, tw) => g[k] === T.WALL || g[tw] === T.WALL;

/* an arm has just included portal tile k on grid g: -1 walk on (no portal, or a
   dead pair), -2 stop here (CORE, or the jump budget is spent), else the twin */
export function armJump(w, g, k, jumps) {
  const tw = twinOf(w, k);
  if (tw < 0 || dead(g, k, tw)) return -1;
  return featProfile(w).portal.blast && jumps < MAX_JUMPS ? tw : -2;
}
const bombOn = (w, k) => w.bombs.some((b) => !b.dead && key(b.tx, b.ty) === k);
const bladeOn = (w, k) => w.blades.some((bl) => bl.tiles && bl.tiles.some((t) => key(t.tx, t.ty) === k));
/* a tile must not start damage, so it never drops you beside a foe or onto a bomb or a live blade */
function blockedTo(w, tw) {
  if (bombOn(w, tw) || bladeOn(w, tw)) return true;
  const x = tw % C, y = (tw / C) | 0;
  return w.enemies.some((e) => !e.dead && Math.abs(tileOf(e.x) - x) <= 1 && Math.abs(tileOf(e.y) - y) <= 1);
}
/* the dim look, the truth for a walker: stepping on k would not warp you */
export function portalDim(w, k) {
  const tw = twinOf(w, k);
  return tw < 0 || dead(w.grid, k, tw) || bombOn(w, k) || bladeOn(w, k) || blockedTo(w, tw);
}
const jump = (e, tw) => { e.x = cx(tw); e.y = cy(tw); e.tx = tw % C; e.ty = (tw / C) | 0; };
/* did e's tile change this tick onto a live portal? Returns the twin or -1, and keeps the latch */
function crossed(w, e, k) {
  const was = e.warpK;
  e.warpK = k;
  if (was === undefined || was === k) return -1;
  const tw = twinOf(w, k);
  return tw < 0 || dead(w.grid, k, tw) ? -1 : tw;
}
function warpPlayer(w, emit) {
  const p = w.players[0];
  if (!p.alive) { p.warpK = undefined; return; }
  const k = key(tileOf(p.x), tileOf(p.y)), tw = crossed(w, p, k);
  if (tw < 0 || blockedTo(w, tw)) return;
  const x = p.x, y = p.y;
  jump(p, tw);
  p.warpK = tw;
  emit({ t: "warp", x, y, x2: p.x, y2: p.y, who: "you" });
}
/* a moving bomb keeps its fuse and slide. The slider has just committed onto the
   tile, so a bomb on the twin (or a foe, which a slide stops for) rolls it back:
   it stops short, on the tile it came from. A resting bomb is only tracked, so a
   planted or thrown bomb stays and blocks the pair. */
function warpBombs(w, emit) {
  for (const b of w.bombs) {
    if (b.dead) continue;
    const k = key(b.tx, b.ty), was = b.warpK;
    if (!b.slide) { b.warpK = k; continue; }
    const tw = crossed(w, b, k);
    if (tw < 0) continue;
    if (w.bombs.some((o) => o !== b && !o.dead && key(o.tx, o.ty) === tw) || w.enemies.some((e) => !e.dead && e.tx === tw % C && e.ty === ((tw / C) | 0))) {
      b.tx -= b.slide.x; b.ty -= b.slide.y; b.warpK = was;
      b.x = (b.tx + 0.5) * FT; b.y = (b.ty + 0.5) * FT;
      b.slide = null; b.prog = 0;
      continue;
    }
    const x = b.x, y = b.y;
    b.tx = tw % C; b.ty = (tw / C) | 0; b.warpK = tw;
    b.x = (b.tx + 0.5 + b.slide.x * (b.prog || 0)) * FT;
    b.y = (b.ty + 0.5 + b.slide.y * (b.prog || 0)) * FT;
    emit({ t: "warp", x, y, x2: b.x, y2: b.y, who: "bomb" });
  }
}
/* MAX: a foe warps only by walking onto a portal (no AI change, it plans over the
   tile as floor). Exit guard: it waits on the entry tile while you are within
   guard - 1 Manhattan of the twin, at most `hold` s, then walks on without warping.
   The wait pins the body from here, so the AI's own tick keeps running. A bomb or
   blade on the twin means plain floor. No foe warps in the room's first `inert` s,
   so a foe spawned beside a portal cannot shortcut the fair start. */
function warpFoes(w, dt, pr, emit) {
  const p = w.players[0], px = tileOf(p.x), py = tileOf(p.y);
  const near = (tw) => p.alive && Math.abs(tw % C - px) + Math.abs(((tw / C) | 0) - py) < pr.guard;
  for (const e of w.enemies) {
    if (e.dead || !(e.speed > 0)) continue;
    const k = key(tileOf(e.x), tileOf(e.y));
    if (w.featT < pr.inert) { e.warpK = k; continue; }
    if (e.warpHold > 0) {
      const tw = twinOf(w, e.warpFrom);
      e.warpHold -= dt;
      if (dead(w.grid, e.warpFrom, tw) || bombOn(w, tw) || bladeOn(w, tw) || e.warpHold <= 0) { e.warpHold = 0; e.warpK = k; e.warpX = e.warpY = undefined; continue; }
      if (near(tw)) { pin(e, e.warpFrom, dt); continue; }
      e.warpHold = 0;
      warpFoe(e, tw, emit);
      continue;
    }
    const tw = crossed(w, e, k);
    if (tw < 0 || bombOn(w, tw) || bladeOn(w, tw)) continue;
    if (near(tw)) { e.warpHold = pr.hold; e.warpFrom = k; pin(e, k, dt); continue; }
    warpFoe(e, tw, emit);
  }
}
/* the waiting body finishes walking to the tile's centre, then stands */
function pin(e, k, dt) {
  e.x = e.warpX ?? e.x; e.y = e.warpY ?? e.y;
  const step = e.speed * FT * dt;
  e.x += Math.max(-step, Math.min(step, cx(k) - e.x));
  e.y += Math.max(-step, Math.min(step, cy(k) - e.y));
  e.tx = k % C; e.ty = (k / C) | 0;
  e.warpX = e.x; e.warpY = e.y;
}
function warpFoe(e, tw, emit) {
  const x = e.x, y = e.y;
  jump(e, tw);
  e.warpK = tw; e.warpX = undefined; e.warpY = undefined;
  emit({ t: "warp", x, y, x2: e.x, y2: e.y, who: "foe" });
}
export function portalTick(w, dt, emit) {
  if (!w.featPair) return;
  warpPlayer(w, emit);
  warpBombs(w, emit);
  const pr = featProfile(w).portal;
  if (pr.foes) warpFoes(w, dt, pr, emit);
}
