/* drawPixelWorld: the px board, in CLASSIC's draw order (floor + contact band,
   bricks + crumble, items, bombs, blades, ghost, foes (SHADE's hem over its
   float frame, BURROW's plume over its body), MAKO, fx particles, one-shots
   then the collect bursts), into the NATIVE 300x260 canvas (1 art px = 2 logical px).
   It needs only a minimal ctx: drawImage(img,x,y) at integer positions,
   fillRect, fillStyle and globalAlpha, so the same code runs in the browser
   and through the Node RGBA shim (tools/pixel/rgba.mjs). Reads world, never
   writes it; per-entity anim state lives in V (the renderer's view state). */
import {CFG, T, BIOMES} from "../../core/config.js";
import {wallCodes} from "../wallvar.js";
import {cellSpec} from "../featdraw.js";
import {floorVar} from "../floorart.js";
import {drawShadows} from "../featpxcells.js";
import {drawAmbient} from "./ambient.js";
import {ITEM_FAMILY} from "../icons.js";
import {GHOST_A} from "../sprites.js";
import {PX_T} from "./timing.js";
import {wellPx} from "../frame.js";
import {snapArt} from "./snap.js";
import {OS, shotFrame} from "./oneshot.js";
import {blit, drawFoes, drawItems, drawBursts} from "./entities.js";
import {deathK} from "../motion.js";
import {getFxOpts} from "../fx.js";
import {F_FRONT, P_CROSS, P_STRAIGHT, facingOf, walkStep, newWalk, isIdle, cycle, bladeAgeFrame, bladePieces, bladeScratch, fuseFrame, swellFrame, popFrame} from "./anim.js";

const C = CFG.COLS, R = CFG.ROWS, TA = CFG.TILE / 2;
const MAKO_SEQ = [0, 2, 0, 3];

export function createView(atlas) {
  return {A: atlas, t: 0, dt: 0, walk: new WeakMap(), ghostWalk: newWalk(), pw: null, shots: null, ghost: null, pop: null,
    parts: null, bg: "#000000", blades: bladeScratch(), prev: new Uint8Array(C * R), prevGrid: null, draws: 0};
}
export function resetView(V) { V.walk = new WeakMap(); V.ghostWalk = newWalk(); V.pw = null; V.iseen = null; V.prevGrid = null; V.t = 0; V.dt = 0; }


/* A tile that turns to WALL under a live grid (SHRINK) gets a slam one-shot. */
export function trackGrid(V, world) {
  const g = world.grid, p = V.prev;
  if (!g) return;
  if (V.prevGrid === g && V.shots) for (let k = 0; k < g.length; k++) if (g[k] === T.WALL && p[k] !== T.WALL) V.shots.push(OS.SLAM, (k % C) * CFG.TILE + TA, ((k / C) | 0) * CFG.TILE + TA, V.t);
  for (let k = 0; k < g.length; k++) p[k] = g[k];
  V.prevGrid = g;
}

function drawTiles(c, V, world) {
  const g = world.grid, level = world.level | 0, bi = (Math.max(1, level) - 1) % BIOMES.length, TS = V.A.tiles(bi), WC = wallCodes(world), fe = world.feat;
  if (V.fvL !== level) { V.fvL = level; V.fv = new Uint8Array(C * R); for (let k = 0; k < C * R; k++) V.fv[k] = floorVar(k % C, (k / C) | 0, level); }
  const oc = (i) => (g[i] === T.WALL ? 1 : g[i] === T.BRICK ? 2 : 0);
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
    const k = y * C + x, t = g[k], X = x * 20, Y = y * 20, alt = (x + y) & 1;
    if (t === T.WALL) { c.drawImage(TS.wallV[alt][WC[k]].im, X, Y); V.draws++; continue; }
    if (fe && fe[k]) { const sp = cellSpec(world, x, y); if (sp.kind) { c.drawImage(V.A.feat(bi, sp, world.featT).im, X, Y); V.draws++; continue; } }
    const n = y ? oc(k - C) : 0, w = x ? oc(k - 1) : 0, nw = x && y ? oc(k - C - 1) : 0;
    c.drawImage(TS.floor(alt, V.fv[k], n, w, nw).im, X, Y); V.draws++;
  }
  for (let k = 0; k < g.length; k++) if (g[k] === T.BRICK) { c.drawImage(TS.brick.im, (k % C) * 20, ((k / C) | 0) * 20); V.draws++; }
  const pool = V.shots ? V.shots.pool : null;
  if (pool) for (let i = 0; i < pool.length; i++) {
    const o = pool[i];
    if (o.k === OS.CRUMBLE) { c.drawImage(TS.crumble[shotFrame(o, V.t)].im, Math.floor(o.x / CFG.TILE) * 20, Math.floor(o.y / CFG.TILE) * 20); V.draws++; }
    else if (o.k === OS.SLAM) { c.drawImage(TS.slam[shotFrame(o, V.t)].im, Math.floor(o.x / CFG.TILE) * 20, Math.floor(o.y / CFG.TILE) * 20); V.draws++; }
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
  const sh = V.shots;
  if (world.state === "WIN") { const w = sh && sh.live(OS.WIN); return set.win[w ? shotFrame(w, t) : cycle(t, PX_T.WIN_FPS, PX_T.WIN_N)]; }
  if (sh) {
    const m = sh.live(OS.MAT);
    if (m) return set.mat[shotFrame(m, t)];
    if (sh.live(OS.KICK)) return set.kick;
    if (sh.live(OS.THROW)) return set.throw;
  }
  const row = set.cyc[st.face];
  return isIdle(st) ? row[cycle(t, PX_T.IDLE_FPS, 2)] : row[MAKO_SEQ[st.f]];
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
      const dk = fr < 0 ? deathK(t - o.t0) : null;
      blit(c, V, fr >= 0 ? (A.fx.puff[o.type] || A.fx.puff.walker)[fr] : dk && dk.flash && t - o.t0 < PX_T.FLASH_MS / 1000 ? (V.flashK < 1 ? set.tint : set.flash) : dk && dk.sy > 0.7 ? set.stun : set.squash, X, Y);
    } else if (o.k === OS.CORPSE) blit(c, V, A.mako(null, false).corpse[fr], X, Y);
    else if (o.k === OS.DEATH) blit(c, V, A.mako(world.players[0] && world.players[0].color, false).death[fr], X, Y);
    else if (o.k === OS.REVEAL) blit(c, V, A.fx.reveal[fr], X, Y);
  }
}

export function drawPixelWorld(c, world, V) {
  V.draws = 0;
  V.flashK = getFxOpts().flashK;
  if (!world || !world.grid) return 0;
  c.globalAlpha = 1;
  drawTiles(c, V, world);
  drawAmbient(c, V, world, "under");
  drawShadows(c, V, world, blit, snapArt);
  drawItems(c, V, world);
  drawBombs(c, V, world);
  drawBlades(c, V, world);
  drawGhost(c, V, world);
  drawFoes(c, V, world);
  drawMako(c, V, world);
  drawAmbient(c, V, world, "over");
  drawParts(c, V);
  drawShots(c, V, world);
  drawBursts(c, V, world);
  c.globalAlpha = 1;
  return V.draws;
}
