/* HUNTER LOCK-ON (issue #32, owner ruling 2026-10-26 "Lock-on tell"): a READ-ONLY warning every look draws, never a sim field. A hunter (e.hunt: FAST, CHASER,
   KNIGHT) is locked on when the player sits in its own tile row or column, 1..LOCK.N tiles away, the straight lane between them is open by the AI's own
   rules and its current e.dir points down that lane. The open-lane test mirrors bfsNext (src/core/board.js) as updateEnemies calls it: WALL always blocks,
   BRICK and a live bomb (!b.dead at b.tx/b.ty) block unless e.pass, and the player's own tile is tested too, because bfsNext refuses a blocked target
   (a hunter cannot path onto a player standing on a bomb). On an open straight lane the Manhattan-shortest route is that lane alone, so this is exactly
   when the next re-plan points the hunter at you; the onset can lag the alignment by up to world.chaseCd, because e.dir only changes on a re-plan.
   N = 4: contact is at about e.r + CONTACT_R = 0.58 tile, and the fastest hunter is FAST in room 8 at MAX HARD, 2 x (1.5 + 8 x 0.18) x 1.15 = 6.76 tiles/s,
   so a lock seen at 4 tiles still leaves (4 - 0.58) / 6.76 = 0.51 s; CHASER and KNIGHT there leave 0.78 s, room-2 FAST at CORE NORM 0.98 s. N = 3 would
   leave 0.36 s. Pure: reads world.grid / world.bombs / world.players[0] and the foe, writes nothing, no Date, no Math.random. The ramp is motion.js lockK. */
import { CFG, T, key } from "../core/config.js";
import { tileOf } from "../core/board.js";

export const LOCK_N = 4;

/* {dx, dy, n}: the unit lane direction from the foe toward the player and the tile distance, or null when not locked on */
export function lockOn(world, e) {
  if (!e || !e.hunt || e.dead || !(e.speed > 0) || !e.dir) return null;
  const p = world.players && world.players[0], g = world.grid;
  if (!p || p.alive === false || !g) return null;
  const px = tileOf(p.x), py = tileOf(p.y), ex = e.tx, ey = e.ty;
  let dx = 0, dy = 0, n = 0;
  if (ey === py && ex !== px) { dx = Math.sign(px - ex); n = Math.abs(px - ex); }
  else if (ex === px && ey !== py) { dy = Math.sign(py - ey); n = Math.abs(py - ey); }
  else return null;
  if (n > LOCK_N || Math.sign(e.dir.x) !== dx || Math.sign(e.dir.y) !== dy) return null;
  const bs = world.bombs || [];
  for (let i = 1; i <= n; i++) {
    const x = ex + dx * i, y = ey + dy * i;
    if (x < 0 || y < 0 || x >= CFG.COLS || y >= CFG.ROWS) return null;
    const v = g[key(x, y)];
    if (v === undefined || v === T.WALL) return null;
    if (e.pass) continue;
    if (v === T.BRICK) return null;
    for (let j = 0; j < bs.length; j++) if (!bs[j].dead && bs[j].tx === x && bs[j].ty === y) return null;
  }
  return { dx, dy, n };
}
