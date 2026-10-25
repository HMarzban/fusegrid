/* PIXEL entities: foes, pickups and collect bursts, drawn from the shared motion spec (render/motion.js) on the px clock (V.t, PLAY-only, frozen in PAUSE).
   Foes: a 4-phase walk (contact, pass, contact, pass; a pass frame is blitted 1 art px higher), idle breath + a hashed blink (the frame's .blink twin),
   FAST flaps its wings, SENTRY's lens pulses, SHADE's hem sways over 3 frames, BURROW's body hops with its plume, the rocket flame is a 3-frame loop,
   hunters lean 1 art px toward MAKO. Spawn pops through blob -> scaled -> stretch frames with a small stepped floor ring (never a strobe); death is
   flash -> squash -> puff and lives in drawShots (world.js). Pickups hover +-1 art px, keep the ring flip, pop in when revealed and wink with a glint
   that walks the ring. Collect bursts are procedural 1-2 px marks from collectParticle (ring / fan / trail / rise / pop) drawn straight on the board:
   no one-shot slots, so they can never evict a kill puff; capped at BURST_CAP marks a frame. Everything is hashed or clocked, nothing is random. */
import {CFG} from "../../core/config.js";
import {ITEM_FAMILY} from "../icons.js";
import {MOTION, COLLECT_T, phaseOf, blinkAt, foeM, bobAt, leanAt, spawnK, itemIdle, collectM, collectParticle} from "../motion.js";
import {fxOf} from "../entityfx.js";
import {getFxOpts} from "../fx.js";
import {PX_T} from "./timing.js";
import {snapArt} from "./snap.js";
import {pxRamp, HEX} from "./palette.js";
import {facingOf, walkStep, newWalk, isIdle, cycle} from "./anim.js";

export const BURST_CAP = 40;
const SEQ3 = [0, 1, 0, 2], PULSE = [0, 1, 2, 1], GL = [[-5, -5], [0, -7], [5, -5]], FLYER = {boomerang: 1, shade: 1, rocket: 1};

export function blit(c, V, f, X, Y) { if (!f) return; c.drawImage(f.im, X - f.ax, Y - f.ay); V.draws++; }
function foeState(V, e) { let s = V.walk.get(e); if (!s) { s = newWalk(); s.ph = phaseOf(e.type, e.home); s.inv0 = 0; V.walk.set(e, s); } return s; }

function ringPts(c, cx, cy, rx, ry) {
  const n = Math.max(12, Math.round(3.3 * (rx + ry)));
  for (let j = 0; j < n; j++) { const a = (j / n) * 6.2832; c.fillRect(Math.round(cx + rx * Math.cos(a)), Math.round(cy + ry * Math.sin(a)), 1, 1); }
}

export function drawFoes(c, V, world) {
  const es = world.enemies, t = V.t, F = V.A.foe, p0 = world.players && world.players[0];
  for (let i = 0; i < es.length; i++) {
    const e = es[i];
    if (e.dead) continue;
    const set = F[e.type] || F.walker, st = foeState(V, e), L = set.layout, ph = st.ph;
    walkStep(st, e.x, e.y, V.dt);
    st.face = facingOf(e.dir ? e.dir.x : 0, e.dir ? e.dir.y : 0, st.face);
    const moving = e.speed > 0 && !isIdle(st);
    let X = snapArt(e.x), Y = snapArt(e.y), dy = 0, f, hx = 0, pf = 0;
    if (e.hunt && p0 && p0.alive !== false) { const ln = leanAt(e.type, true, p0.x - e.x, p0.y - e.y, CFG.TILE); if (ln) { X += Math.round(ln.ox / 2); Y += Math.round(ln.oy / 2); } }
    if (FLYER[e.type]) dy = Math.round(bobAt(e.type, ph, t, moving) / 2);
    if (set.walk) {
      const idle = ((t * foeM(e.type).idleW / 6.2832 + ph) % 1) < 0.62 ? 0 : 1;
      f = moving ? set.walk[st.face][e.type === "fast" ? cycle(t + ph, PX_T.FLAP_FPS, 4) : st.n & 3] : set.idle[st.face][idle];
      if (L === "burrow") { pf = cycle(t, PX_T.PLUME_FPS, 3); dy = pf === 1 ? -1 : 0; }
    } else if (L === "rocket") f = set.face[st.face][SEQ3[cycle(t + ph, PX_T.FLAME_FPS, 4)]];
    else if (L === "still") f = set.still[PULSE[cycle(t + ph, PX_T.PULSE_FPS, 4)]];
    else if (L === "spin") f = set.still[cycle(t, PX_T.SPIN_FPS, 8)];
    else { const k = SEQ3[cycle(t + ph, PX_T.HEM_FPS, 4)]; f = set.still[k]; hx = k === 1 ? -1 : k === 2 ? 1 : 0; if (k === 1) dy -= 1; }
    if (f.blink && blinkAt(e.type, ph, t) > 0.5) f = f.blink;
    let ga = 1;
    if (e.invuln && e.invulnT > 0) {
      if (e.invulnT > st.inv0) st.inv0 = e.invulnT;
      const k = spawnK((st.inv0 - e.invulnT) / MOTION.SPAWN_T, t);
      if (k.ring) { c.globalAlpha = k.ring.a > 0.25 ? 0.7 : 0.4; blit(c, V, set.ring(Math.max(2, Math.round(k.ring.r / 2))), X, Y + 6); c.globalAlpha = 1; }
      f = k.s < 0.6 ? set.mat[0] : k.s < 0.9 ? set.mat[1] : k.s > 1.04 ? set.mat[2] : f;
      ga = k.a < 0.6 ? 0.5 : k.a < 0.88 ? 0.75 : 1;
    }
    if (ga < 1) c.globalAlpha = ga;
    if (moving && e.type === "fast" && e.dir && ga === 1) { c.globalAlpha = 0.3; blit(c, V, f, X - 3 * e.dir.x, Y + dy - 3 * e.dir.y); c.globalAlpha = 1; }
    blit(c, V, f, X, Y + dy);
    if (L === "burrow" && set.extra) blit(c, V, set.extra[pf], X, Y + dy);
    else if (L === "shade" && set.extra) blit(c, V, set.extra, X + hx, Y + dy);
    if (ga < 1) c.globalAlpha = 1;
  }
}

/* the first time an item is seen on the px clock, per grid: pickups already on the floor when a room is first drawn never pop, a revealed one does */
export function drawItems(c, V, world) {
  const I = V.A.items, its = world.items, t = V.t, T = CFG.TILE;
  const st = V.iseen || (V.iseen = {at: new WeakMap(), fresh: true}), glint = getFxOpts().flashK >= 1;
  for (let i = 0; i < its.length; i++) {
    const it = its[i];
    if (it.taken || it.buried) continue;
    let t0 = st.at.get(it);
    if (t0 === undefined) { t0 = st.fresh ? -1e9 : t; st.at.set(it, t0); }
    const age = t - t0, fam = ITEM_FAMILY[it.t] || "cap", id = itemIdle(fam, (it.x * 0.7 + it.y * 1.3) / T, t), rp = ((it.x * 7 + it.y * 13) / T) | 0;
    const X = snapArt(it.x), Y = snapArt(it.y) + Math.round(id.dy / 2) - (age < 0.06 ? 3 : age < 0.12 ? 1 : 0);
    if (age >= 0.06) blit(c, V, I.well, X, Y);
    const ring = I.ring[it.t];
    if (ring && age >= 0.12) blit(c, V, ring[fam === "utl" || fam === "bls" ? cycle(t + rp * 0.21, PX_T.RING_FPS, 2) : 0], X, Y);
    blit(c, V, I.glyph[it.t], X, Y);
    if (glint && id.glint != null && age >= 0.2) { const k = Math.min(2, (id.glint * 3) | 0); blit(c, V, V.A.fx.glint[k], X + GL[k][0], Y + GL[k][1]); }
  }
  st.fresh = false;
}

/* rise = hollow diamonds (5x5 -> 3x3 -> a dot, three lanes), trails are five staggered dashes, nothing is a plus */
const DIA = [[[0, -2], [-1, -1], [1, -1], [-2, 0], [2, 0], [-1, 1], [1, 1], [0, 2]], [[0, -1], [-1, 0], [1, 0], [0, 1]]];
function mark(c, style, x, y, p, u, i) {
  if (style === "ring") { const r = Math.max(1, Math.round(p.s / 2)); ringPts(c, x, y, r, r); return; }
  if (style === "trail") { if (i & 1) return; const L = ((i >> 1) % 5) - 2; c.fillRect(x + (L & 1 ? 2 : 0), y + L, Math.max(1, Math.round(p.streak / 2)), 1); return; }
  if (style === "rise") {
    if (i % 3) return;
    const h = x + ((i / 3 | 0) - 1) * 5 - Math.round(p.x / 2), D = u < 0.45 ? DIA[0] : u < 0.75 ? DIA[1] : null;
    if (!D) c.fillRect(h, y, 1, 1); else for (let j = 0; j < D.length; j++) c.fillRect(h + D[j][0], y + D[j][1], 1, 1);
    return;
  }
  const s = style === "pop" ? Math.round(p.s / 2) : u < 0.25 ? 2 : 1;
  c.fillRect(x, y, Math.max(1, s), Math.max(1, s));
}
export function drawBursts(c, V, world) {
  const bs = fxOf(world, "px").bursts(V.t);
  let n = 0;
  for (let b = 0; b < bs.length; b++) {
    const B = bs[b], m = collectM(B.kind), R = pxRamp(B.col || HEX.spark), X = snapArt(B.x), Y = snapArt(B.y), u = B.age / COLLECT_T;
    for (let i = 0; i < m.n; i++) {
      if (n >= BURST_CAP) return;
      const p = collectParticle(B.kind, i, B.age);
      if (!p || p.a < 0.1 || (B.age < 0.02 && m.style !== "ring")) continue;
      n++;
      c.fillStyle = p.a > 0.66 ? R.light : p.a > 0.33 ? R.base : R.shadow;
      mark(c, m.style, X + Math.round(p.x / 2), Y + Math.round(p.y / 2), p, u, i);
    }
  }
}
