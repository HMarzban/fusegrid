import { CFG, T, key, clamp, isFinale } from "./config.js";
import { tileOf, isWall, aabb, moveEntity } from "./board.js";
import { createWorld, loadLevel } from "./world.js";
import { applyPower, hurtPlayer } from "./entities.js";
import { updateEnemies } from "../ai/enemies.js";
import { hasPact, PACT } from "./pact.js";
import { paceMul } from "./pace.js";
import { isBelt, beltDir, featProfile } from "./feat.js";

/* A clean intent for one player for this tick. This is exactly what a network
   client would send the server: move vector + edge-triggered fire/remote. */
export function newIntent() {
  return {
    move: { x: 0, y: 0 },
    fire: false,
    firePrev: false,
    shift: false,
    remote: false,
    kick: false,
  };
}
const emptyInputs = Object.freeze(
  Object.keys(newIntent()).reduce(
    (o, k) =>
      (o[0] = {
        move: { x: 0, y: 0 },
        fire: false,
        firePrev: false,
        shift: false,
        remote: false,
        kick: false,
      }),
    {},
  ),
);

/* Advance the sim by dt seconds for the given inputs (keyed by pid).
   Events (audio/particle triggers) ACCUMULATE in world.events; the renderer
   drains them each frame. DETERMINISTIC: same seed + same input sequence =>
   identical world. No DOM / audio / canvas referenced here. */
export function step(world, dt, inputs) {
  const emit = (e) => world.events.push(e);
  world.time += dt;
  world.tick++;

  if (world.state === "MENU") {
    const i = inputs[0] || emptyInputs[0];
    if (i.fire && !world.fireEdge) {
      startGame(world);
    }
    world.fireEdge = !!i.fire;
    return;
  }
  if (world.state === "WIN") {
    const i = inputs[0] || emptyInputs[0];
    if (i.fire && !world.fireEdge) {
      if (isFinale(world.level)) {
        world.state = "MENU";
        world.finale = true;
      } else {
        loadLevel(world, world.level + 1, true);
        world.state = "PLAY";
      }
    }
    world.fireEdge = !!i.fire;
    return;
  }
  if (world.state === "LOSE") {
    const i = inputs[0] || emptyInputs[0];
    if (i.fire && !world.fireEdge) {
      startGame(world);
    }
    world.fireEdge = !!i.fire;
    return;
  }
  if (world.state === "PAUSE") {
    return;
  }

  // ---- PLAY ----
  if (hasPact(world.pact, PACT.SHRINK)) advanceShrink(world, dt);
  if (world.feat) world.featT += dt;
  updatePlayer(world, dt, inputs[0] || emptyInputs[0], emit);
  if (world.feat) beltActors(world, dt, true, inputs[0] || emptyInputs[0]);
  updateBombs(world, dt, emit);
  const adv = updateEnemies(world, dt, inputs, emit);
  if (world.feat) {
    beltActors(world, dt, false);
    featTick(world, dt, emit);
  }
  if (adv && adv.advance) {
    world.events.push({ t: "win" });
    world.state = "WIN";
  }
}

function advanceShrink(world, dt) {
  world.shrinkT = (world.shrinkT == null ? 25 : world.shrinkT) - dt;
  while (world.shrinkT <= 0 && (world.shrinkGen | 0) < 6) {
    const gen = world.shrinkGen | 0;
    const want = gen + 1;
    for (let y = 0; y < CFG.ROWS; y++)
      for (let x = 0; x < CFG.COLS; x++) {
        if (x === 1 && y === 1) continue;
        const rim = Math.min(x, CFG.COLS - 1 - x, y, CFG.ROWS - 1 - y);
        if (rim !== want) continue;
        world.grid[key(x, y)] = T.WALL;
      }
    world.shrinkGen = gen + 1;
    world.shrinkT += 8;
  }
}

function startGame(world) {
  if (world.nextSeed != null) { world.seed = world.nextSeed >>> 0; world.nextSeed = null; }
  loadLevel(world, 1, false);
  world.state = "PLAY";
  world.score = 0;
}

function updatePlayer(world, dt, inp, emit) {
  const w = world,
    p = w.players[0];
  if (!p.alive) return;
  p.walk += dt;
  let dx = inp.move ? inp.move.x : 0,
    dy = inp.move ? inp.move.y : 0;
  if (dx || dy) {
    p.face.x = dx;
    p.face.y = dy;
  }
  const glided = w.feat && !p.passing ? glideMove(w, p, dx, dy, dt) : false;
  const sp = p.speed * CFG.TILE * dt * paceMul(w.pace);
  if ((dx || dy) && !glided) {
    p.tx = tileOf(p.x);
    p.ty = tileOf(p.y);
    const ptx = p.tx,
      pty = p.ty;
    if (p.passing) {
      moveEntity(
        p,
        w.grid,
        dx * sp * CFG.PASS_MULT,
        dy * sp * CFG.PASS_MULT,
        true,
      );
    } else {
      // canon: live bombs are tile-solid (bombsBlock gives walk-off + no re-entry)
      moveEntity(p, w.grid, dx * sp, 0, false, w.bombs);
      moveEntity(p, w.grid, 0, dy * sp, false, w.bombs);
      // KICK: moving into a bomb launches it (slides until an obstacle).
      // Axis preference: X when dx!=0, else Y. Replaces the old brick-break.
      if (p.kick) {
        let sx = 0,
          sy = 0;
        if (dx) sx = dx > 0 ? 1 : -1;
        else if (dy) sy = dy > 0 ? 1 : -1;
        if (sx || sy) {
          const b = w.bombs.find(
            (bb) =>
              !bb.dead && !bb.slide && bb.tx === ptx + sx && bb.ty === pty + sy,
          );
          if (b && launchSlider(w, b, sx, sy))
            emit({ t: "kick", x: b.x, y: b.y });
        }
      }
    }
    p.x = clamp(p.x, 1.5 * CFG.TILE, (CFG.COLS - 1.5) * CFG.TILE);
    p.y = clamp(p.y, 1.5 * CFG.TILE, (CFG.ROWS - 1.5) * CFG.TILE);
  }
  p.iFrames = Math.max(0, p.iFrames - dt);
  // fire / throw / remote
  if (inp.fire && !w.fireEdge) {
    if (inp.shift && p.throw) {
      placeBomb(
        w,
        p.x + p.face.x * CFG.TILE * 1.1,
        p.y + p.face.y * CFG.TILE * 1.1,
        emit,
        true,
      );
    } else {
      placeBomb(w, p.x, p.y, emit);
    }
  }
  const re = !!inp.remote;
  if (re && !w.remoteEdge && p.remote) {
    let n = 0;
    for (const b of w.bombs.slice())
      if (!b.dead) {
        detonate(w, b, emit);
        n++;
      }
    if (n) emit({ t: "remote" });
  }
  w.remoteEdge = re;
  w.fireEdge = !!inp.fire;
  // collect items by walking over them
  for (const it of w.items) {
    if (it.taken || it.buried) continue;
    const dx = it.x - p.x,
      dy = it.y - p.y;
    if (dx * dx + dy * dy < (CFG.TILE * CFG.PICKUP_R) ** 2) {
      it.taken = true;
      w.score += CFG.ITEM_SCORE;
      applyPower(w, it.pdef, it.x, it.y);
    }
  }
  // keep firePrev in sync so the next tick's edge works even without input
  if (inp.firePrev !== undefined) inp.firePrev = w.fireEdge;
}

function launchSlider(w, b, sx, sy) {
  // no-op when the very first leg is blocked: kicking a wall/bomb/enemy-
  // adjacent resting bomb must not jitter it (stable halts under held key)
  if (sliderStopAt(w, b, b.tx + sx, b.ty + sy)) return false;
  b.x = (b.tx + 0.5) * CFG.TILE;
  b.y = (b.ty + 0.5) * CFG.TILE;
  b.slide = { x: sx, y: sy };
  b.prog = 0;
  return true;
}

/* Tile-to-tile slider: progress 0..1 toward the next tile center; on arrival
   the NEXT tile is stop-checked (WALL/BRICK/bomb/enemy) before commit, so a
   kicked bomb always halts just short of obstacles. Fuse keeps ticking. */
function advanceSlider(w, b, dt) {
  let travel = b.prog + CFG.KICK_SPEED * dt;
  while (travel >= 1) {
    const nx = b.tx + b.slide.x,
      ny = b.ty + b.slide.y;
    if (sliderStopAt(w, b, nx, ny)) {
      b.prog = 0;
      b.slide = null;
      b.x = (b.tx + 0.5) * CFG.TILE;
      b.y = (b.ty + 0.5) * CFG.TILE;
      return;
    }
    b.tx = nx;
    b.ty = ny;
    travel -= 1;
  }
  b.prog = travel;
  b.x = (b.tx + 0.5 + b.slide.x * travel) * CFG.TILE;
  b.y = (b.ty + 0.5 + b.slide.y * travel) * CFG.TILE;
}

function sliderStopAt(w, b, tx, ty) {
  const v = w.grid[key(tx, ty)];
  if (v === undefined || v === T.WALL || v === T.BRICK) return true;
  if (w.bombs.some((o) => o !== b && !o.dead && o.tx === tx && o.ty === ty))
    return true;
  if (w.enemies.some((e) => !e.dead && e.tx === tx && e.ty === ty)) return true;
  return false;
}

function updateBombs(world, dt, emit) {
  const w = world;
  for (const b of w.bombs) {
    if (b.dead) continue;
    if (b.slide && !b.carry) advanceSlider(w, b, dt);
    else if (w.feat) carryBomb(w, b, dt);
    b.timer -= dt;
    if (b.timer <= 0) detonate(w, b, emit);
  }
  w.bombs = w.bombs.filter((b) => !b.dead);
  for (const bl of w.blades) bl.t += dt;
  w.blades = w.blades.filter((bl) => bl.t < bl.ttl);
  for (const bl of w.blades) if (bl.tiles) applyBlastHits(w, bl.tiles, emit, bl);
}

/* Single source of truth for a cross blast. */
function computeBlast(w, cx, cy, radius, pierce, line, dir) {
  const tiles = [{ tx: cx, ty: cy, brick: false }];
  const arms = line
    ? [dir || { x: 1, y: 0 }]
    : [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ];
  for (const d of arms) {
    let blocked = false;
    for (let i = 1; i <= radius && !blocked; i++) {
      const tx = cx + d.x * i,
        ty = cy + d.y * i;
      if (isWall(w.grid, tx, ty)) {
        blocked = true;
        break;
      }
      const brick = w.grid[key(tx, ty)] === T.BRICK;
      tiles.push({ tx, ty, brick });
      if (brick && !pierce && !line) blocked = true;
    }
  }
  return tiles;
}

function snapFace(face) {
  const ax = face ? face.x : 0,
    ay = face ? face.y : 0;
  if (Math.abs(ax) >= Math.abs(ay)) return { x: ax < 0 ? -1 : 1, y: 0 };
  return { x: 0, y: ay < 0 ? -1 : 1 };
}

function placeBomb(w, px, py, emit, thrown) {
  const p = w.players[0];
  if (w.bombs.length >= p.bombs) return false;
  const tx = tileOf(px),
    ty = tileOf(py);
  if (w.grid[key(tx, ty)] !== T.EMPTY) return false;
  if (w.bombs.some((b) => b.tx === tx && b.ty === ty)) return false;
  if (thrown && w.enemies.some((e) => !e.dead && e.tx === tx && e.ty === ty))
    return false;
  const variant = p.bombKind;
  const radius =
    variant === "power"
      ? p.range + 2
      : variant === "line" || variant === "pierce"
        ? Math.max(p.range, 5)
        : p.range;
  const x = (tx + 0.5) * CFG.TILE,
    y = (ty + 0.5) * CFG.TILE;
  w.bombs.push({
    x,
    y,
    tx,
    ty,
    timer: w.fuse == null ? CFG.FUSE : w.fuse,
    radius,
    pierce: variant === "pierce",
    line: variant === "line",
    dir: variant === "line" ? snapFace(p.face) : null,
    variant,
    dead: false,
  });
  emit({ t: "bomb", x, y });
  if (thrown) emit({ t: "throw", x, y });
  return true;
}

function applyBlastHits(w, tiles, emit, bl) {
  const p = w.players[0];
  for (const t of tiles) {
    for (const e of w.enemies)
      if (!e.dead && !e.invuln && aabb(w.grid, t.tx, t.ty, e.x, e.y, e.r))
        killEnemy(w, e, emit, bl);
    if (
      p.alive &&
      p.iFrames <= 0 &&
      aabb(w.grid, t.tx, t.ty, p.x, p.y, CFG.TILE * 0.3)
    ) {
      if (p.shield) {
        p.shield = false;
        p.iFrames = CFG.IFRAMES;
        emit({ t: "hurt", x: p.x, y: p.y });
      } else hurtPlayer(w, emit);
    }
  }
}

function detonate(w, bomb, emit) {
  if (bomb.dead) return;
  bomb.dead = true;
  const tiles = computeBlast(
    w,
    bomb.tx,
    bomb.ty,
    bomb.radius,
    bomb.pierce,
    bomb.line,
    bomb.dir,
  );
  const blade = {
    x: bomb.x,
    y: bomb.y,
    tiles,
    t: 0,
    ttl: CFG.BLADE_TTL,
    variant: bomb.variant,
  };
  if (w.feat) {
    if (bomb.rode) blade.rode = true;
    if (bomb.chainSrc) blade.early = bomb.chainSrc;
  }
  w.blades.push(blade);
  for (const t of tiles) if (t.brick) breakBrick(w, t.tx, t.ty, emit);
  applyBlastHits(w, tiles, emit, blade);
  emit({ t: "boom", x: bomb.x, y: bomb.y });
  const covered = new Set(tiles.map((t) => key(t.tx, t.ty)));
  for (const b of w.bombs.slice())
    if (!b.dead && covered.has(key(b.tx, b.ty))) detonate(w, b, emit);
  if (w.feat) relayCheck(w, tiles, bomb.tx, bomb.ty, emit);
}

function breakBrick(w, tx, ty, emit) {
  const px = tx * CFG.TILE + CFG.TILE / 2,
    py = ty * CFG.TILE + CFG.TILE / 2;
  if (w.grid[key(tx, ty)] !== T.BRICK) return;
  w.grid[key(tx, ty)] = T.EMPTY;
  revealItem(w, tx, ty, emit);
  w.events.push({ t: "brick", x: px, y: py });
  w.score += CFG.BRICK_SCORE;
}

function revealItem(w, tx, ty, emit) {
  for (const it of w.items)
    if (!it.taken && tileOf(it.x) === tx && tileOf(it.y) === ty) {
      it.buried = false;
      emit({ t: "reveal", x: it.x, y: it.y });
    }
}

function killEnemy(w, e, emit, bl) {
  if (e.dead) return;
  e.dead = true;
  w.score +=
    e.type === "rocket"
      ? 300
      : e.type === "boomerang" || e.type === "shade"
        ? 250
        : e.type === "knight"
          ? 200
          : e.type === "burrow"
            ? 150
            : 100;
  const ev = { t: "kill", x: e.x, y: e.y, color: e.color, type: e.type };
  if (bl && w.feat) {
    if (bl.src) ev.src = bl.src;
    if (bl.rode) ev.rode = true;
    if (bl.early) ev.early = bl.early;
  }
  emit(ev);
}

/* ---- TILE PROTO (2026-10-21, wave 1): BELT / GLIDE / BLOOM / PLATE.
   Every path below runs only when world.feat is set (gen 2 tile rooms). ---- */
const FT = CFG.TILE;
function keepDir(e, f) {
  const d = e.dir ? { x: e.dir.x, y: e.dir.y } : null;
  f();
  if (d) { e.dir.x = d.x; e.dir.y = d.y; }
}
/* PLUS/MAX: actors on a BELT tile ride at v (pace-scaled); e.dir is masked
   so the AI never sees the push; a WALL one step downstream halts it.
   Pass 2 (#28), each a profile flag so the 2026-10-21 rule stays readable:
   foes:false (PLUS) carries you but not foes; snap = the forgiving step-off,
   no push while you hold toward an open side cell, and a push never
   slides you sideways (moveEntity's corner slide) - if it would, it waits;
   endHalt = riders are carried to the chain's last cell and stop there, never
   shoved off the end; wallStop = a chain whose downstream end is a WALL (a
   SHRINK ring) carries no one */
function beltActors(w, dt, player, inp) {
  const pb = featProfile(w).belt;
  if (!pb.actors || (!player && pb.foes === false)) return;
  const v = pb.v * FT * dt * paceMul(w.pace);
  const push = (e, pass, bombs, mx, my) => {
    const tx = tileOf(e.x), ty = tileOf(e.y), k = key(tx, ty), f = w.feat[k];
    if (!isBelt(f) || w.grid[k] !== T.EMPTY) return;
    const [dx, dy] = beltDir(f);
    if (isWall(w.grid, tx + dx, ty + dy)) return;
    if (pb.wallStop) {
      let x = tx, y = ty;
      for (let n = 0; n < 16 && isBelt(w.feat[key(x, y)]) && w.grid[key(x, y)] === T.EMPTY; n++) { const [ux, uy] = beltDir(w.feat[key(x, y)]); x += ux; y += uy; }
      if (isWall(w.grid, x, y)) return;
    }
    if (pb.snap && (dx ? my : mx) && w.grid[key(tx + (dx ? 0 : mx), ty + (dx ? my : 0))] === T.EMPTY) return;
    let vv = v;
    if (pb.endHalt) {
      const nk = key(tx + dx, ty + dy);
      if (!(isBelt(w.feat[nk]) && w.grid[nk] === T.EMPTY)) {
        const rem = dx ? ((tx + 0.5) * FT - e.x) * dx : ((ty + 0.5) * FT - e.y) * dy;
        if (rem <= 0) return;
        vv = Math.min(v, rem);
      }
    }
    const ox = e.x, oy = e.y;
    keepDir(e, () => moveEntity(e, w.grid, dx * vv, dy * vv, pass, bombs));
    if (pb.snap && (dx ? e.y !== oy : e.x !== ox)) { e.x = ox; e.y = oy; e.tx = tileOf(ox); e.ty = tileOf(oy); return; }
    e.beltT = w.featT;
  };
  if (player) {
    const p = w.players[0], m = inp && inp.move;
    if (p.alive) push(p, p.passing, p.passing ? undefined : w.bombs, m ? Math.sign(m.x) : 0, m ? Math.sign(m.y) : 0);
    return;
  }
  for (const e of w.enemies) if (!e.dead && e.speed > 0) push(e, e.pass, e.pass ? undefined : w.bombs, e.dir ? Math.sign(e.dir.x) : 0, e.dir ? Math.sign(e.dir.y) : 0);
}
/* where a carried bomb stops: anything a kick stops for, plus the player's
   tile; pass 2 thru: only a WALL, a BRICK or another bomb, so a bomb rides
   under walkers and its cell at the fuse is known from the board alone */
function carryStop(w, b, tx, ty) {
  if (featProfile(w).belt.thru) {
    const v = w.grid[key(tx, ty)];
    return v === undefined || v === T.WALL || v === T.BRICK || w.bombs.some((o) => o !== b && !o.dead && o.tx === tx && o.ty === ty);
  }
  if (sliderStopAt(w, b, tx, ty)) return true;
  const p = w.players[0];
  if (p.alive && tileOf(p.x) === tx && tileOf(p.y) === ty) {
    const bx = (b.tx + 0.5) * FT, by = (b.ty + 0.5) * FT;
    const riding = Math.max(Math.abs(p.x - bx), Math.abs(p.y - by)) < FT / 2 + p.r * 0.9;
    if (!riding) return true;
  }
  return false;
}
/* BELT carry: a resting bomb on a belt rides at v tile to tile; it re-reads
   the layer on arrival (a new belt turns it, plain floor stops it) and
   stops short of anything a kick stops for, plus the player's tile */
function carryBomb(w, b, dt) {
  const snap = () => { b.prog = 0; b.slide = null; b.carry = false; b.x = (b.tx + 0.5) * FT; b.y = (b.ty + 0.5) * FT; };
  if (!b.slide) {
    const k = key(b.tx, b.ty), f = w.feat[k];
    if (!isBelt(f) || w.grid[k] !== T.EMPTY) return;
    const [dx, dy] = beltDir(f);
    if (carryStop(w, b, b.tx + dx, b.ty + dy)) return;
    b.slide = { x: dx, y: dy };
    b.carry = true;
    b.prog = 0;
  }
  let travel = b.prog + featProfile(w).belt.v * paceMul(w.pace) * dt;
  while (travel >= 1) {
    const nx = b.tx + b.slide.x, ny = b.ty + b.slide.y;
    if (carryStop(w, b, nx, ny)) return snap();
    b.tx = nx;
    b.ty = ny;
    b.rode = true;
    travel -= 1;
    const f = w.feat[key(nx, ny)];
    if (isBelt(f) && w.grid[key(nx, ny)] === T.EMPTY) {
      const [dx, dy] = beltDir(f);
      b.slide = { x: dx, y: dy };
    } else return snap();
  }
  b.prog = travel;
  b.x = (b.tx + 0.5 + b.slide.x * travel) * FT;
  b.y = (b.ty + 0.5 + b.slide.y * travel) * FT;
}
/* GLIDE (player only): x1.25; CORE stops on release (corner assist 0.35),
   PLUS coasts to the next centre, MAX coasts until a block or off the
   sheet; a new direction is buffered and taken at a centre (window turn) */
function glideFree(w, tx, ty) {
  const v = w.grid[key(tx, ty)];
  if (v !== T.EMPTY) return false;
  return !w.bombs.some((b) => !b.dead && b.tx === tx && b.ty === ty);
}
function glideMove(w, p, dx, dy, dt) {
  const tx = tileOf(p.x), ty = tileOf(p.y), k = key(tx, ty);
  const onIce = w.feat[k] === 5 && w.grid[k] === T.EMPTY;
  let ix = 0, iy = 0;
  if (dx || dy) { if (Math.abs(dx) >= Math.abs(dy)) ix = Math.sign(dx); else iy = Math.sign(dy); }
  if (!onIce && (!p.gl || ix || iy)) { p.gl = null; p.glBuf = null; return false; }
  const g = featProfile(w).glide;
  let sp = Math.min(p.speed * g.boost, CFG.MAX_SPEED) * FT * dt * paceMul(w.pace);
  const mv = (mx, my) => { const ox = p.x, oy = p.y; keepDir(p, () => moveEntity(p, w.grid, mx, my, false, w.bombs)); return Math.abs(p.x - ox) + Math.abs(p.y - oy); };
  if (g.coast === 0) {
    p.gl = null;
    if (!ix && !iy) return true;
    if (ix) { const ly = (ty + 0.5) * FT, o = ly - p.y; if (Math.abs(o) <= g.turn * FT) p.y += Math.sign(o) * Math.min(Math.abs(o), sp); }
    else { const lx = (tx + 0.5) * FT, o = lx - p.x; if (Math.abs(o) <= g.turn * FT) p.x += Math.sign(o) * Math.min(Math.abs(o), sp); }
    mv(ix * sp, iy * sp);
    p.tx = tileOf(p.x); p.ty = tileOf(p.y);
    return true;
  }
  let cur = p.gl;
  if (!cur) {
    if (!ix && !iy) return true;
    cur = { x: ix, y: iy };
  }
  if (ix || iy) p.glBuf = ix === cur.x && iy === cur.y ? null : { x: ix, y: iy };
  const coasting = !ix && !iy;
  const cx = (tx + 0.5) * FT, cy = (ty + 0.5) * FT;
  if (p.glBuf && Math.abs(cur.x ? p.x - cx : p.y - cy) <= g.turn * FT && glideFree(w, tx + p.glBuf.x, ty + p.glBuf.y)) {
    p.x = cx; p.y = cy; cur = p.glBuf; p.glBuf = null;
  }
  for (let guard = 0; guard < 3 && sp > 1e-6; guard++) {
    const a = cur.x ? p.x : p.y, s = cur.x || cur.y, t0 = a / FT - 0.5;
    const nc = s > 0 ? Math.floor(t0 + 1e-6) + 1 : Math.ceil(t0 - 1e-6) - 1;
    const d = Math.abs((nc + 0.5) * FT - a);
    if (d > sp) { if (mv(cur.x * sp, cur.y * sp) < sp * 0.5) { p.gl = null; p.glBuf = null; return true; } break; }
    if (mv(cur.x * d, cur.y * d) < d * 0.5) { p.gl = null; p.glBuf = null; return true; }
    sp -= d;
    const qx = tileOf(p.x), qy = tileOf(p.y), q = key(qx, qy), ice = w.feat[q] === 5 && w.grid[q] === T.EMPTY;
    p.x = (qx + 0.5) * FT; p.y = (qy + 0.5) * FT;
    if (p.glBuf && glideFree(w, qx + p.glBuf.x, qy + p.glBuf.y)) { cur = p.glBuf; p.glBuf = null; continue; }
    if (!ice) { p.gl = null; p.glBuf = null; p.tx = qx; p.ty = qy; return true; }
    if (coasting && (g.coast === 1 || !glideFree(w, qx + cur.x, qy + cur.y))) { p.gl = null; p.tx = qx; p.ty = qy; return true; }
  }
  p.gl = cur;
  p.face.x = cur.x; p.face.y = cur.y;
  p.tx = tileOf(p.x); p.ty = tileOf(p.y);
  return true;
}
/* one emitted blast (BLOOM relay / PLATE lure): the real blade, bricks,
   hits, bomb chains and further relays; never inherits PIERCE / POWER */
function fireBlast(w, cx, cy, arms, src, emit) {
  const tiles = [{ tx: cx, ty: cy, brick: false }];
  for (const [dx, dy, len] of arms)
    for (let i = 1; i <= len; i++) {
      const tx = cx + dx * i, ty = cy + dy * i;
      if (isWall(w.grid, tx, ty)) break;
      const brick = w.grid[key(tx, ty)] === T.BRICK;
      tiles.push({ tx, ty, brick });
      if (brick) break;
    }
  const x = (cx + 0.5) * FT, y = (cy + 0.5) * FT;
  const blade = { x, y, tiles, t: 0, ttl: CFG.BLADE_TTL, variant: "normal", src };
  w.blades.push(blade);
  for (const t of tiles) if (t.brick) breakBrick(w, t.tx, t.ty, emit);
  applyBlastHits(w, tiles, emit, blade);
  emit({ t: "boom", x, y, src });
  const covered = new Set(tiles.map((t) => key(t.tx, t.ty)));
  for (const b of w.bombs.slice())
    if (!b.dead && covered.has(key(b.tx, b.ty))) { b.chainSrc = src; detonate(w, b, emit); }
  relayCheck(w, tiles, cx, cy, emit);
}
function fireBloom(w, k, dx, dy) {
  const bc = featProfile(w).bloom, cx = k % CFG.COLS, cy = (k / CFG.COLS) | 0;
  w.featM[k] = 2;
  w.featS[k] = bc.cd;
  const arms = [[dx, dy, bc.fwd]];
  if (bc.side) arms.push([dy, dx, bc.side], [-dy, -dx, bc.side]);
  fireBlast(w, cx, cy, arms, "relay", (e) => w.events.push(e));
}
/* BLOOM: an arm arriving from a neighbouring tile arms an idle bloom */
function relayCheck(w, tiles, cx, cy, emit) {
  const bc = featProfile(w).bloom;
  for (const t of tiles) {
    if (t.tx === cx && t.ty === cy) continue;
    const k = key(t.tx, t.ty);
    if (w.feat[k] !== 6 || w.grid[k] !== T.EMPTY || w.featM[k] !== 0) continue;
    const dx = Math.sign(t.tx - cx), dy = Math.sign(t.ty - cy);
    emit({ t: "bloom", x: (t.tx + 0.5) * FT, y: (t.ty + 0.5) * FT });
    if (bc.delay <= 0) fireBloom(w, k, dx, dy);
    else {
      w.featM[k] = 1;
      w.featS[k] = bc.delay;
      w.featPend.push({ k, kind: "bloom", dx, dy });
    }
  }
}
/* per tick: pending bloom flares / plate wind-ups, cooldowns, and PLATE
   triggers by a foe's centre (after the inert window) */
function featTick(w, dt, emit) {
  const pc = featProfile(w).plate;
  for (let k = 0; k < w.featM.length; k++) {
    if (!w.featM[k]) continue;
    w.featS[k] -= dt;
    if (w.featS[k] > 0) continue;
    if (w.featM[k] === 2) { w.featM[k] = 0; w.featS[k] = 0; continue; }
    const i = w.featPend.findIndex((q) => q.k === k);
    if (i < 0) { w.featM[k] = 0; continue; }
    const q = w.featPend.splice(i, 1)[0];
    if (q.kind === "bloom") fireBloom(w, k, q.dx, q.dy);
    else {
      w.featM[k] = 2;
      w.featS[k] = pc.cd;
      const cx = k % CFG.COLS, cy = (k / CFG.COLS) | 0;
      fireBlast(w, cx, cy, [[1, 0, pc.r], [-1, 0, pc.r], [0, 1, pc.r], [0, -1, pc.r]], "plate", emit);
    }
  }
  if (w.featT < pc.inert) return;
  for (const e of w.enemies) {
    if (e.dead) continue;
    const k = key(e.tx, e.ty);
    if (w.feat[k] !== 7 || w.grid[k] !== T.EMPTY || w.featM[k] !== 0) continue;
    if (pc.near != null) { const p = w.players[0]; if (!p.alive || Math.abs(tileOf(p.x) - e.tx) + Math.abs(tileOf(p.y) - e.ty) > pc.near) continue; }
    w.featM[k] = 1;
    w.featS[k] = pc.wind;
    w.featPend.push({ k, kind: "plate", by: e.type });
    emit({ t: "plate", x: (e.tx + 0.5) * FT, y: (e.ty + 0.5) * FT });
  }
}


/* Renderer consumes world.events for audio/particle fx. The sim never writes
   visual-only state, so single-player and future multiplayer stay identical. */

export { createWorld, loadLevel };
