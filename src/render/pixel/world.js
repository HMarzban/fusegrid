/* drawPixelWorld: the px board, in CLASSIC's draw order (floor + contact band,
   bricks + crumble, items, bombs, blades, ghost, foes (SHADE's hem over its
   float frame, BURROW's plume over its body), MAKO, fx particles, one-shots
   incl. the pickup sparkle), into the NATIVE 300x260 canvas (1 art px = 2 logical px).
   It needs only a minimal ctx: drawImage(img,x,y) at integer positions,
   fillRect, fillStyle and globalAlpha, so the same code runs in the browser
   and through the Node RGBA shim (tools/pixel/rgba.mjs). Reads world, never
   writes it; per-entity anim state lives in V (the renderer's view state). */
import {CFG, T, BIOMES} from "../../core/config.js";
import {ITEM_FAMILY} from "../icons.js";
import {GHOST_A} from "../sprites.js";
import {PX_T} from "./timing.js";
import {snapArt} from "./snap.js";
import {OS, shotFrame} from "./oneshot.js";
import {F_FRONT, P_CROSS, P_STRAIGHT, facingOf, walkStep, newWalk, isIdle, cycle, bladeAgeFrame, bladePieces, bladeScratch, fuseFrame, swellFrame, popFrame} from "./anim.js";

const C = CFG.COLS, R = CFG.ROWS, TA = CFG.TILE / 2;
const MAKO_SEQ = [0, 2, 0, 3];

export function createView(atlas) {
  return {A: atlas, t: 0, dt: 0, walk: new WeakMap(), ghostWalk: newWalk(), pw: null, shots: null, ghost: null, pop: null,
    parts: null, bg: "#000000", blades: bladeScratch(), prev: new Uint8Array(C * R), prevGrid: null, draws: 0};
}
export function resetView(V) { V.walk = new WeakMap(); V.ghostWalk = newWalk(); V.pw = null; V.prevGrid = null; V.t = 0; V.dt = 0; }

function blit(c, V, f, X, Y) { if (!f) return; c.drawImage(f.im, X - f.ax, Y - f.ay); V.draws++; }
function stateOf(V, e) { let s = V.walk.get(e); if (!s) { s = newWalk(); V.walk.set(e, s); } return s; }

/* A tile that turns to WALL under a live grid (SHRINK) gets a slam one-shot. */
export function trackGrid(V, world) {
  const g = world.grid, p = V.prev;
  if (!g) return;
  if (V.prevGrid === g && V.shots) for (let k = 0; k < g.length; k++) if (g[k] === T.WALL && p[k] !== T.WALL) V.shots.push(OS.SLAM, (k % C) * CFG.TILE + TA, ((k / C) | 0) * CFG.TILE + TA, V.t);
  for (let k = 0; k < g.length; k++) p[k] = g[k];
  V.prevGrid = g;
}

function drawTiles(c, V, world) {
  const g = world.grid, level = world.level | 0, TS = V.A.tiles((Math.max(1, level) - 1) % BIOMES.length);
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
    const k = y * C + x, t = g[k], X = x * 20, Y = y * 20;
    if (t === T.WALL) { c.drawImage(TS.wall.im, X, Y); V.draws++; continue; }
    const alt = (x + y) & 1, under = y > 0 && g[k - C] !== T.EMPTY;
    c.drawImage((under ? TS.floorC : TS.floor)[alt].im, X, Y); V.draws++;
    if (t === T.EMPTY && (x * 7 + y * 13 + level * 3) % 5 === 0) { c.drawImage(TS.motif[alt].im, X, Y); V.draws++; }
  }
  for (let k = 0; k < g.length; k++) if (g[k] === T.BRICK) { c.drawImage(TS.brick.im, (k % C) * 20, ((k / C) | 0) * 20); V.draws++; }
  const pool = V.shots ? V.shots.pool : null;
  if (pool) for (let i = 0; i < pool.length; i++) {
    const o = pool[i];
    if (o.k === OS.CRUMBLE) { c.drawImage(TS.crumble[shotFrame(o, V.t)].im, Math.floor(o.x / CFG.TILE) * 20, Math.floor(o.y / CFG.TILE) * 20); V.draws++; }
    else if (o.k === OS.SLAM) { c.drawImage(TS.slam[shotFrame(o, V.t)].im, Math.floor(o.x / CFG.TILE) * 20, Math.floor(o.y / CFG.TILE) * 20); V.draws++; }
  }
}

function drawItems(c, V, world) {
  const I = V.A.items, its = world.items, t = V.t;
  for (let i = 0; i < its.length; i++) {
    const it = its[i];
    if (it.taken || it.buried) continue;
    const X = snapArt(it.x), fam = ITEM_FAMILY[it.t] || "cap", ph = ((it.x * 7 + it.y * 13) / CFG.TILE) | 0;
    const Y = snapArt(it.y) - (fam === "vit" && cycle(t + ph * 0.13, PX_T.RING_FPS, 2) ? 1 : 0);
    blit(c, V, I.well, X, snapArt(it.y));
    const ring = I.ring[it.t];
    if (ring) blit(c, V, ring[fam === "utl" || fam === "bls" ? cycle(t + ph * 0.21, PX_T.RING_FPS, 2) : 0], X, Y);
    blit(c, V, I.glyph[it.t], X, Y);
    const gp = (t * 0.5 + ph * 0.37) % 2;
    if (gp < 0.3) blit(c, V, V.A.fx.glint[Math.min(2, (gp / 0.1) | 0)], X - 5, Y - 5);
  }
}

function drawBombs(c, V, world) {
  const Bm = V.A.bomb, bs = world.bombs, t = V.t, fuse = world.fuse;
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    if (b.dead) continue;
    const X = snapArt(b.x), Y = snapArt(b.y);
    const body = b.slide ? Bm.roll[((Math.floor(b.x / PX_T.ROLL_STRIDE) + Math.floor(b.y / PX_T.ROLL_STRIDE)) & 1)] : Bm.swellSeq[swellFrame(b.timer, fuse, t)];
    blit(c, V, body, X, Y);
    const mk = b.variant && Bm.mark[b.variant];
    if (mk) blit(c, V, mk, X, Y);
    const fu = Bm.fuse[fuseFrame(b.timer, fuse)];
    blit(c, V, fu, X, Y);
    if (fu.tip) blit(c, V, Bm.spark[cycle(t, PX_T.SPARK_HZ, 2)], X - fu.ax + fu.tip[0], Y - fu.ay + fu.tip[1]);
  }
}

function drawBlades(c, V, world) {
  const sc = V.blades, n = bladePieces(world, sc), Bl = V.A.blast;
  for (let i = 0; i < n; i++) {
    const o = sc.out[i], a = bladeAgeFrame(o.a);
    const set = o.p === P_CROSS ? Bl.cross[0] : o.p === P_STRAIGHT ? Bl.straight[o.r] : Bl.end[o.r];
    const f = set[a];
    c.drawImage(f.im, o.x * 20 + 10 - f.ax, o.y * 20 + 10 - f.ay); V.draws++;
  }
}

function makoFrame(V, set, p, st, world) {
  const t = V.t;
  if (world.state === "WIN") return set.win[cycle(t, PX_T.WIN_FPS, PX_T.WIN_N)];
  const sh = V.shots;
  if (sh) {
    const m = sh.live(OS.MAT);
    if (m) return set.mat[shotFrame(m, t)];
    if (sh.live(OS.KICK)) return set.kick;
    if (sh.live(OS.THROW)) return set.throw;
  }
  const row = set.cyc[st.face];
  return isIdle(st) ? row[cycle(t, PX_T.IDLE_FPS, 2)] : row[MAKO_SEQ[st.f]];
}

function drawFoes(c, V, world) {
  const es = world.enemies, t = V.t, F = V.A.foe;
  for (let i = 0; i < es.length; i++) {
    const e = es[i];
    if (e.dead) continue;
    const set = F[e.type] || F.walker, st = stateOf(V, e);
    walkStep(st, e.x, e.y, V.dt);
    st.face = facingOf(e.dir ? e.dir.x : 0, e.dir ? e.dir.y : 0, st.face);
    const X = snapArt(e.x), Y = snapArt(e.y);
    let f;
    if (set.face) {
      const row = set.face[st.face];
      f = set.layout === "rocket" ? row[cycle(t, PX_T.FLAME_FPS, 2)] : row[e.speed > 0 && !isIdle(st) ? st.n & 1 : 0];
    } else if (set.layout === "spin") f = set.still[cycle(t, PX_T.SPIN_FPS, 8)];
    else f = set.still[cycle(t, PX_T.IDLE_FPS, 2)];
    blit(c, V, f, X, Y);
    if (set.layout === "burrow" && set.extra) blit(c, V, set.extra[cycle(t, PX_T.PLUME_FPS, 3)], X, Y);
    else if (set.layout === "shade" && set.extra) blit(c, V, set.extra, X, Y);
  }
}

function drawMako(c, V, world) {
  const ps = world.players;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (p.alive === false) continue;
    const set = V.A.mako(p.color, !!p.kick), st = V.pw || (V.pw = newWalk());
    walkStep(st, p.x, p.y, V.dt);
    st.face = facingOf(p.face ? p.face.x : 0, p.face ? p.face.y : 0, st.face);
    const X = snapArt(p.x), Y = snapArt(p.y);
    let f;
    if (i === 0 && V.pop != null) {
      if (!(V.pop > 0)) continue;
      const k = popFrame(V.pop);
      f = k >= 0 ? set.mat[k] : set.cyc[F_FRONT][0];
    } else f = makoFrame(V, set, p, st, world);
    const blink = p.iFrames > 0 && Math.floor(p.iFrames * 12) % 2;
    if (blink) c.globalAlpha = 0.4;
    blit(c, V, f, X, Y);
    if (p.shield) blit(c, V, set.shield[cycle(V.t, PX_T.RING_FPS, 2)], X, Y);
    if (p.passing) blit(c, V, set.passing, X, Y);
    if (blink) c.globalAlpha = 1;
  }
}

function drawGhost(c, V, world) {
  const g = V.ghost;
  if (!g) return;
  const set = V.A.mako(null, false), st = V.ghostWalk;
  walkStep(st, g.x, g.y, V.dt);
  st.face = facingOf(g.fx, g.fy, st.face);
  c.globalAlpha = GHOST_A;
  const row = set.cyc[st.face];
  blit(c, V, isIdle(st) ? row[0] : row[MAKO_SEQ[st.f]], snapArt(g.x), snapArt(g.y));
  c.globalAlpha = 1;
}

function drawParts(c, V) {
  const ps = V.parts;
  if (!ps) return;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i], s = Math.max(1, Math.round((p.size || 2) / 2));
    c.fillStyle = p.color;
    c.fillRect(snapArt(p.x) - (s >> 1), snapArt(p.y) - (s >> 1), s, s);
  }
}

function drawShots(c, V, world) {
  const pool = V.shots ? V.shots.pool : null, A = V.A, t = V.t;
  if (!pool) return;
  for (let i = 0; i < pool.length; i++) {
    const o = pool[i];
    if (!o.k) continue;
    const X = snapArt(o.x), Y = snapArt(o.y), fr = shotFrame(o, t);
    if (o.k === OS.STUN) {
      const set = A.foe[o.type] || A.foe.walker;
      blit(c, V, fr < 0 ? set.stun : (A.fx.puff[o.type] || A.fx.puff.walker)[fr], X, Y);
    } else if (o.k === OS.CORPSE) blit(c, V, A.mako(null, false).corpse[fr], X, Y);
    else if (o.k === OS.DEATH) blit(c, V, A.mako(world.players[0] && world.players[0].color, false).death[fr], X, Y);
    else if (o.k === OS.REVEAL) blit(c, V, A.fx.reveal[fr], X, Y);
    else if (o.k === OS.SPARKLE) blit(c, V, A.fx.sparkle[fr], X, Y);
  }
}

export function drawPixelWorld(c, world, V) {
  V.draws = 0;
  if (!world || !world.grid) return 0;
  c.globalAlpha = 1;
  drawTiles(c, V, world);
  drawItems(c, V, world);
  drawBombs(c, V, world);
  drawBlades(c, V, world);
  drawGhost(c, V, world);
  drawFoes(c, V, world);
  drawMako(c, V, world);
  drawParts(c, V);
  drawShots(c, V, world);
  c.globalAlpha = 1;
  return V.draws;
}
