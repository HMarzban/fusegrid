import { CFG, DIRS4, key } from "../core/config.js";
import {
  tileOf,
  isWall,
  solidAt,
  bfsNext,
  moveEntity,
  bombsBlock,
} from "../core/board.js";
import { hurtPlayer } from "../core/entities.js";

/* Update every enemy on the world for one fixed step. PURE & DETERMINISTIC:
   uses world.rng (seeded) instead of Math.random so the sim is replayable and
   net-syncable. The renderer must NOT call this. */
export function updateEnemies(world, dt, input, emit) {
  const w = world,
    p = w.players[0];
  const emitFx = emit || ((e) => w.events.push(e));
  const pt = { x: tileOf(p.x), y: tileOf(p.y) };
  // live bomb tiles block chaser/fast BFS (pass types ignore them)
  const bombKeys = new Set();
  for (const b of w.bombs) if (!b.dead) bombKeys.add(key(b.tx, b.ty));

  // deterministic shuffle using the world rng (no Math.random)
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = w.rng.int(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  for (const e of w.enemies) {
    if (e.dead) continue;
    if (e.invuln) {
      e.invulnT = Math.max(0, e.invulnT - dt);
      e.invuln = e.invulnT > 0;
    }

    if (e.type === "stationary") {
      // contact check (stationary can still hit you if you walk into it)
      checkContact(w, e, emitFx);
      continue;
    }
    if (e.speed === 0) continue;
    const sp = e.speed * CFG.TILE * dt;
    e.cd -= dt;
    if (e.cd <= 0) {
      e.cd =
        e.type === "chaser" || e.type === "fast"
          ? w.chaseCd == null
            ? 0.35
            : w.chaseCd
          : 6 + w.rng.int(0, 14);
      let ndir = null;
      if (e.type === "chaser" || e.type === "fast") {
        const next = bfsNext(
          w.grid,
          e.tx,
          e.ty,
          pt.x,
          pt.y,
          e.pass,
          e.pass ? null : bombKeys,
        );
        if (next)
          ndir =
            { x: Math.sign(next.x - e.tx), y: Math.sign(next.y - e.ty) } ||
            e.dir;
      }
      // fall back to a deterministic random legal direction ONLY when BFS
      // found no route (e.g. bomb seals the corridor)
      if (!ndir) {
        const cands = shuffle(DIRS4.slice());
        for (const d of cands) {
          const nx = e.x + d.x * sp,
            ny = e.y + d.y * sp;
          const blocked = e.pass
            ? isWall(w.grid, tileOf(nx), tileOf(ny))
            : solidAt(w.grid, nx, ny) ||
              bombsBlock(w.bombs, e.x, e.y, nx, ny, e.r * 0.9);
          if (!blocked) {
            ndir = d;
            break;
          }
        }
      }
      if (ndir) e.dir = { x: ndir.x, y: ndir.y };
    }
    const mvx = e.dir.x * sp,
      mvy = e.dir.y * sp;
    const mv = moveEntity(
      e,
      w.grid,
      mvx,
      mvy,
      e.pass,
      e.pass ? undefined : w.bombs,
    );
    // bomb-zone corner escape: BFS plans from tile coords while the body may sit
    // between lanes; if a bomb zone bounced the intended step, re-scan for any
    // legal direction now (deterministic) instead of flip-flopping on the boundary
    if (
      !e.pass &&
      (mv.bouncedX || mv.bouncedY) &&
      (bombsBlock(
        w.bombs,
        e.x,
        e.y,
        e.x + Math.sign(mvx) * sp,
        e.y,
        e.r * 0.9,
      ) ||
        bombsBlock(
          w.bombs,
          e.x,
          e.y,
          e.x,
          e.y + Math.sign(mvy) * sp,
          e.r * 0.9,
        ))
    ) {
      const cands = shuffle(DIRS4.slice());
      for (const d of cands) {
        const nx = e.x + d.x * sp,
          ny = e.y + d.y * sp;
        if (
          !(
            solidAt(w.grid, nx, ny) ||
            bombsBlock(w.bombs, e.x, e.y, nx, ny, e.r * 0.9)
          )
        ) {
          e.dir = { x: d.x, y: d.y };
          break;
        }
      }
    }
    // keep on board (wall/border)
    if (e.tx < 1) {
      e.x = CFG.TILE;
      e.dir.x = 1;
    } else if (e.tx > CFG.COLS - 2) {
      e.x = (CFG.COLS - 2) * CFG.TILE + CFG.TILE / 2;
      e.dir.x = -1;
    }
    if (e.ty < 1) {
      e.y = CFG.TILE;
      e.dir.y = 1;
    } else if (e.ty > CFG.ROWS - 2) {
      e.y = (CFG.ROWS - 2) * CFG.TILE + CFG.TILE / 2;
      e.dir.y = -1;
    }
    e.tx = tileOf(e.x);
    e.ty = tileOf(e.y);
    checkContact(w, e, emitFx);
  }

  w.enemies = w.enemies.filter((e) => !e.dead);
  // all-clear -> auto-advance timer
  if (w.enemies.length === 0 && w.state === "PLAY") {
    w.winTimer += dt;
    if (w.winTimer >= CFG.WIN_DELAY) {
      return {
        advance: true,
        bonus: (w.score +=
          CFG.LEVEL_BONUS + w.lives * CFG.LEVEL_BONUS_PER_LIFE),
      };
    }
  }
  return null;
}

function checkContact(w, e, emit) {
  const p = w.players[0];
  if (!p.alive || p.iFrames > 0) return;
  const dx = e.x - p.x,
    dy = e.y - p.y;
  if (dx * dx + dy * dy < (e.r + CFG.TILE * CFG.CONTACT_R) ** 2) {
    if (p.shield) {
      p.shield = false;
      p.iFrames = CFG.IFRAMES;
      emit({ t: "hurt", x: p.x, y: p.y });
    } else hurtPlayer(w, emit);
  }
}
