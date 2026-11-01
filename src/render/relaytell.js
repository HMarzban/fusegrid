/* BOOSTER RELAY TELL (issue #21): a READ-ONLY warning of where a relay will reach, drawn from the moment the bomb that sets it off is lit, never a sim field.
   relayTell plays the lit bombs and flares forward on a private copy of the grid, in fuse order, by the sim's own rules (sim.js): detonate + computeBlast, a
   blast breaks its bricks and sets off the bombs it covers, relayCheck (an arm from a neighbouring tile arms an idle booster on open floor; a bomb on the booster
   does not), fireBlast (the relay arms stop at WALL, stop on a brick, never inherit PIERCE or POWER), the cooldown. So a brick one bomb will open and a chain are
   already in the answer. Pure: reads world, writes nothing, no clock, no Math.random; timers stand still in PAUSE, so the tell does too. tests/relaytell.test.mjs
   holds the mirror to the real step(). It cannot see what has not happened yet: a new plant, a kick, REMOTE, a SHRINK ring.
   Cell {x, y, t, k, hot}: t = seconds until the relay fires on it; k = the 0..1 fade from the lit bomb's own fuse (TELL_IN); hot = its booster is flaring now.
   A tile that is a brick right now is left out: nobody stands there, and every look draws under the bricks. */
import { CFG, T, key, biomeOf } from "../core/config.js";
import { isWall } from "../core/board.js";
import { featProfile } from "../core/feat.js";
import { armJump, portalDim } from "../core/tileportal.js";

export const TELL_IN = 0.1;
const NONE = Object.freeze([]), D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], BLOOM = 6;

export function relayTell(w) {
  const f = w && w.feat, g0 = w && w.grid;
  if (!f || !g0 || !w.featM) return NONE;
  const bombs = (w.bombs || []).filter((b) => !b.dead), pend = (w.featPend || []).filter((q) => q.kind === "bloom");
  if (!bombs.length && !pend.length) return NONE;
  const bc = featProfile(w).bloom, fz = w.fuse == null ? CFG.FUSE : w.fuse, g = g0.slice(), gone = new Set(), until = new Map(), cells = new Map(), q = [];
  const idleAt = (k) => (until.has(k) ? until.get(k) : w.featM[k] === 2 ? w.featS[k] : w.featM[k] === 1 ? w.featS[k] + bc.cd : 0);
  const burn = (tiles, t, k0) => {
    for (const [x, y] of tiles) if (g[key(x, y)] === T.BRICK) g[key(x, y)] = T.EMPTY;
    const hit = new Set(tiles.map(([x, y]) => key(x, y)));
    for (const b of bombs) if (!gone.has(b) && hit.has(key(b.tx, b.ty))) boom(b, t, k0);
  };
  const reach = (tiles, cx, cy, t, k0) => {
    for (const [x, y] of tiles) {
      if (x === cx && y === cy) continue;
      const k = key(x, y);
      if (f[k] !== BLOOM || g[k] !== T.EMPTY || idleAt(k) > t) continue;
      const dx = Math.sign(x - cx), dy = Math.sign(y - cy);
      until.set(k, t + bc.delay + bc.cd);
      if (bc.delay <= 0) fire(k, dx, dy, t, k0, false);
      else q.push({ t: t + bc.delay, k, dx, dy, k0, hot: false });
    }
  };
  const fire = (k, dx, dy, t, k0, hot) => {
    const cx = k % CFG.COLS, cy = (k / CFG.COLS) | 0, tiles = [[cx, cy]], arms = [[dx, dy, bc.fwd]];
    if (bc.side) arms.push([dy, dx, bc.side], [-dy, -dx, bc.side]);
    for (const [ax, ay, len] of arms) for (let i = 1; i <= len; i++) {
      const x = cx + ax * i, y = cy + ay * i;
      if (isWall(g, x, y)) break;
      tiles.push([x, y]);
      if (g[key(x, y)] === T.BRICK) break;
    }
    for (const [x, y] of tiles) {
      const c = key(x, y);
      if (g0[c] === T.BRICK) continue;
      const o = cells.get(c);
      if (!o) cells.set(c, { x, y, t, k: k0, hot });
      else { if (t < o.t) o.t = t; if (k0 > o.k) o.k = k0; if (hot) o.hot = true; }
    }
    burn(tiles, t, k0);
    reach(tiles, cx, cy, t, k0);
  };
  /* PORTAL (#27): an arm's tiles past a jump are this tell's cells, from the moment the bomb is lit: the warning that a blast comes out of the twin */
  const mark = (x, y, t, k0) => {
    const c = key(x, y);
    if (g0[c] === T.BRICK) return;
    const o = cells.get(c);
    if (!o) cells.set(c, { x, y, t, k: k0, hot: false });
    else { if (t < o.t) o.t = t; if (k0 > o.k) o.k = k0; }
  };
  const boom = (b, t, k1) => {
    gone.add(b);
    const tiles = [[b.tx, b.ty]], arms = b.line ? [[b.dir ? b.dir.x : 1, b.dir ? b.dir.y : 0]] : D4, past = [];
    for (const [ax, ay] of arms) {
      let x = b.tx, y = b.ty, jumps = 0;
      for (let i = 1; i <= b.radius; i++) {
        x += ax; y += ay;
        if (isWall(g, x, y)) break;
        tiles.push([x, y]);
        if (jumps) past.push([x, y]);
        if (g[key(x, y)] === T.BRICK && !b.pierce && !b.line) break;
        if (!w.featPair) continue;
        const tw = armJump(w, g, key(x, y), jumps);
        if (tw === -2) break;
        if (tw < 0) continue;
        jumps++;
        x = tw % CFG.COLS; y = (tw / CFG.COLS) | 0;
        tiles.push([x, y]); past.push([x, y]);
      }
    }
    const k0 = Math.max(k1 || 0, Math.min(1, Math.max(0, (fz - b.timer) / TELL_IN)));
    for (const [x, y] of past) mark(x, y, t, k0);
    burn(tiles, t, k0);
    reach(tiles, b.tx, b.ty, t, k0);
  };
  for (const b of bombs) q.push({ t: b.timer, b });
  for (const p of pend) q.push({ t: w.featS[p.k], k: p.k, dx: p.dx, dy: p.dy, k0: 1, hot: true });
  while (q.length) {
    let m = 0;
    for (let i = 1; i < q.length; i++) if (q[i].t < q[m].t) m = i;
    const e = q.splice(m, 1)[0];
    if (!e.b) fire(e.k, e.dx, e.dy, e.t, e.k0, e.hot);
    else if (!gone.has(e.b)) boom(e.b, e.t, 0);
  }
  return cells.size ? [...cells.values()] : NONE;
}

/* PORTAL (#27): the tiles a walker would cross as plain floor right now, for the dim look in all three looks */
export function dimCells(w) {
  const pr = w && w.featPair;
  if (!pr || !w.grid) return NONE;
  let out = null;
  for (let k = 0; k < pr.length; k++) if (pr[k] && w.grid[k] === T.EMPTY && portalDim(w, k)) (out ||= []).push({ x: k % CFG.COLS, y: (k / CFG.COLS) | 0 });
  return out || NONE;
}
/* the CLASSIC mark, on the FLOOR before drawItems: four corner brackets in the world's own wallHi (the booster's mark colour, never a blast hue) over a dark
   under-stroke in bg1, and a faint wash while the flare burns, scaled by REDUCE FLASH (the brackets stay). Static: no march, no pulse. No tell = no ctx call. */
const IN = 0.11, ARM = 0.25;
export function drawRelayTell(c, world, flashK = 1) {
  const cells = relayTell(world), dim = dimCells(world);
  if (!cells.length && !dim.length) return;
  const B = biomeOf(world.level), TL = CFG.TILE, a = IN * TL, L = ARM * TL;
  for (const e of dim) { c.globalAlpha = 0.6; c.fillStyle = B.bg1; c.fillRect(e.x * TL + 2, e.y * TL + 2, TL - 4, TL - 4); }
  for (const e of cells) {
    if (!(e.k > 0.01)) continue;
    const x0 = e.x * TL + a, y0 = e.y * TL + a, x1 = (e.x + 1) * TL - a, y1 = (e.y + 1) * TL - a;
    if (e.hot && flashK > 0) { c.globalAlpha = 0.22 * flashK * e.k; c.fillStyle = B.wallHi; c.fillRect(x0, y0, x1 - x0, y1 - y0); }
    for (let pass = 0; pass < 2; pass++) {
      c.globalAlpha = e.k * (pass ? 0.95 : 0.7);
      c.strokeStyle = pass ? B.wallHi : B.bg1;
      c.lineWidth = pass ? 4.5 : 8;
      c.beginPath();
      for (const [px, py, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x1, y1, -1, -1], [x0, y1, 1, -1]]) { c.moveTo(px + sx * L, py); c.lineTo(px, py); c.lineTo(px, py + sy * L); }
      c.stroke();
    }
  }
  c.globalAlpha = 1;
}
