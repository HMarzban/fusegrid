import { CFG, T, key, clamp } from "./config.js";
import { genBoard, isBrick } from "./board.js";
import { createRng } from "./rng.js";
import { POWER, createPlayer, spawnEnemy } from "./entities.js";
import { clampHeat, heatProfile, heatRoster } from "./heat.js";
import { clampPact, applyPact } from "./pact.js";

/* A world is the entire authoritative simulation state. It is a plain
   data structure (serializable) that the sim advances and the renderer reads.
   All randomness lives in world.rng (no Math.random anywhere in the sim). */
export function createWorld(seed = 1, level = 1) {
  return {
    seed: seed >>> 0,
    level,
    rng: createRng((seed ^ (level * 40503)) >>> 0),
    grid: null,
    players: [createPlayer(0)],
    enemies: [],
    bombs: [],
    blades: [],
    items: [],
    events: [], // drained by the renderer (audio/particles)
    score: 0,
    lives: CFG.PLAYER_START.lives,
    state: "MENU", // MENU PLAY WIN LOSE PAUSE
    time: 0,
    tick: 0,
    winTimer: 0,
    fireEdge: false,
    remoteEdge: false, // press-edge latch for remote detonation
    finale: false,
    heat: 0,
    fuse: CFG.FUSE,
    chaseCd: 0.35,
    pact: 0,
    shrinkT: 0,
    shrinkGen: 0,
    pace: 0,
  };
}

/* (re)generate the board for `level` and spawn items + enemies.
   Uses world.rng so the layout is deterministic for a given seed. */
export function loadLevel(world, level, keepProgress = false) {
  const w = world;
  // snapshot persistent progress before regenerating
  const carry = keepProgress
    ? {
        bombs: Math.min(CFG.MAX_BOMBS, w.players[0].bombs || 1),
        range: Math.min(CFG.MAX_RANGE, w.players[0].range || 1),
        speed: w.players[0].speed || CFG.PLAYER_START.speed,
        lives: Math.max(0, w.lives || 0),
        throw: !!w.players[0].throw,
        kick: !!w.players[0].kick,
        passing: !!w.players[0].passing,
        remote: !!w.players[0].remote,
        shield: !!w.players[0].shield,
        bombKind: w.players[0].bombKind || "normal",
        score: w.score || 0,
      }
    : null;

  const heat = clampHeat(w.heat);
  const pact = clampPact(w.pact);
  const P = applyPact(heatProfile(heat), pact);
  w.heat = heat;
  w.pact = pact;
  w.fuse = P.fuse;
  w.chaseCd = P.chaseCd;
  w.shrinkGen = 0;
  w.shrinkT = P.shrinkT;
  w.level = level;
  w.state = "MENU";
  w.rng = createRng((w.seed ^ (level * 40503)) >>> 0);
  w.grid = genBoard(w.seed, level, P.carve);
  w.bombs = [];
  w.blades = [];
  w.enemies = [];
  w.items = [];
  w.events = [];
  w.winTimer = 0;
  w.fireEdge = false;
  w.remoteEdge = false;
  w.finale = false;

  w.players.forEach((p, i) => {
    p.x = 1.5 * CFG.TILE;
    p.y = 1.5 * CFG.TILE;
    p.tx = 1;
    p.ty = 1;
    p.speed = CFG.PLAYER_START.speed;
    p.bombs = CFG.PLAYER_START.bombs;
    p.range = CFG.PLAYER_START.range;
    p.passing = false;
    p.kick = false;
    p.throw = false;
    p.remote = false;
    p.shield = false;
    p.bombKind = "normal";
    p.iFrames = P.iFrames;
    p.alive = true;
    p.color = p.color || "#37f0d0";
    if (carry) {
      p.bombs = carry.bombs;
      p.range = carry.range;
      p.speed = carry.speed;
      p.throw = carry.throw;
      p.kick = carry.kick;
      p.passing = carry.passing;
      p.remote = carry.remote;
      p.shield = carry.shield;
      p.bombKind = carry.bombKind;
      p.iFrames = P.iFrames;
    }
  });
  w.score = carry ? carry.score : 0;
  w.lives = carry ? carry.lives : P.lives;

  // power-ups under bricks
  const rng = w.rng;
  const brickCells = [];
  for (let y = 1; y < CFG.ROWS - 1; y++)
    for (let x = 1; x < CFG.COLS - 1; x++)
      if (isBrick(w.grid, x, y)) brickCells.push([x, y]);
  for (let i = brickCells.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [brickCells[i], brickCells[j]] = [brickCells[j], brickCells[i]];
  }
  const nP = clamp(
    P.buriedAdd + level,
    3,
    brickCells.length,
  );
  for (let i = 0; i < nP; i++) {
    const [x, y] = brickCells[i];
    const p = POWER[rng.int(0, POWER.length - 1)];
    w.items.push({
      x: x * CFG.TILE + CFG.TILE / 2,
      y: y * CFG.TILE + CFG.TILE / 2,
      t: p.t,
      col: p.col,
      pdef: p,
      taken: false,
      buried: true,
    });
  }
  if (level === 1) {
    for (const need of ["fire", "bomb"]) {
      if (w.items.some((it) => it.t === need)) continue;
      const def = POWER.find((pp) => pp.t === need);
      if (!def) continue;
      const i = w.items.findIndex((it) => it.t !== "fire" && it.t !== "bomb");
      const j = i >= 0 ? i : 0;
      if (!w.items[j]) continue;
      w.items[j].t = def.t;
      w.items[j].col = def.col;
      w.items[j].pdef = def;
    }
  }
  const roster = heatRoster(level, heat);
  const nE = roster.length;
  const spawnOpts = { curve: P.curve, invulnT: P.invulnT };
  const free = [];
  for (let y = 1; y < CFG.ROWS - 1; y++)
    for (let x = 1; x < CFG.COLS - 1; x++) {
      if (w.grid[key(x, y)] !== T.EMPTY) continue;
      const tx = x * CFG.TILE + CFG.TILE / 2,
        ty = y * CFG.TILE + CFG.TILE / 2;
      const ddx = tx - w.players[0].x,
        ddy = ty - w.players[0].y;
      if (ddx * ddx + ddy * ddy < (CFG.TILE * CFG.SPAWN_CLEAR) ** 2) continue;
      free.push([x, y]);
    }
  for (let i = free.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [free[i], free[j]] = [free[j], free[i]];
  }
  for (let i = 0; i < nE && i < free.length; i++)
    w.enemies.push(
      spawnEnemy(roster[i], free[i][0], free[i][1], level, rng, spawnOpts),
    );
  const nFloor = P.bare
    ? 0
    : clamp(
        P.floorAdd + (level | 0),
        P.floorMin,
        Math.max(0, free.length - nE),
      );
  for (let i = 0; i < nFloor; i++) {
    const cell = free[nE + i];
    if (!cell) break;
    const [x, y] = cell;
    const p = POWER[rng.int(0, POWER.length - 1)];
    w.items.push({
      x: x * CFG.TILE + CFG.TILE / 2,
      y: y * CFG.TILE + CFG.TILE / 2,
      t: p.t,
      col: p.col,
      pdef: p,
      taken: false,
      buried: false,
    });
  }
}
