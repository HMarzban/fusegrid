import { CFG, clamp } from "./config.js";

/* Power-up table. apply(world, player) is PURE (no Math.random) so it is
   deterministic and network-safe. permanent=false -> reverted on death. */
export const POWER = [
  {
    t: "fire",
    col: "#ff8a3c",
    permanent: true,
    name: "FLAME",
    help: "blast +1 tile (max 8)",
    apply: (w, p) => (p.range = clamp(p.range + 1, 1, CFG.MAX_RANGE)),
  },
  {
    t: "bomb",
    col: "#ff5d73",
    permanent: true,
    name: "BOMB",
    help: "+1 bomb at a time (max 8)",
    apply: (w, p) => (p.bombs = clamp(p.bombs + 1, 1, CFG.MAX_BOMBS)),
  },
  {
    t: "speed",
    col: "#3db4ff",
    permanent: true,
    name: "SPEED",
    help: "move faster",
    apply: (w, p) =>
      (p.speed = clamp(
        p.speed + CFG.SPEED_UP,
        CFG.PLAYER_START.speed,
        CFG.MAX_SPEED,
      )),
  },
  {
    t: "heart",
    col: "#ff3b5c",
    name: "HEART",
    help: "+1 life",
    apply: (w, p) => {
      w.lives++;
    },
  },
  {
    t: "shield",
    col: "#6fb7ff",
    permanent: false,
    name: "SHIELD",
    help: "survive one hit",
    apply: (w, p) => (p.shield = true),
  },
  {
    t: "kick",
    col: "#c07a3a",
    permanent: false,
    name: "KICK",
    help: "walk into a bomb to slide it",
    apply: (w, p) => (p.kick = true),
  },
  {
    t: "throw",
    col: "#c07a3a",
    permanent: false,
    name: "THROW",
    help: "Shift+Space tosses a bomb",
    apply: (w, p) => (p.throw = true),
  },
  {
    t: "pass",
    col: "#77ff99",
    permanent: false,
    name: "PASS",
    help: "walk through green bricks",
    apply: (w, p) => (p.passing = true),
  },
  {
    t: "line",
    col: "#b8c0d8",
    name: "LINE",
    help: "long blast the way you face",
    apply: (w, p) => (p.bombKind = "line"),
  },
  {
    t: "power",
    col: "#ff4d5e",
    name: "POWER",
    help: "extra-long cross blast",
    apply: (w, p) => (p.bombKind = "power"),
  },
  {
    t: "pierce",
    col: "#8f8fff",
    name: "PIERCE",
    help: "blast keeps going through bricks",
    apply: (w, p) => (p.bombKind = "pierce"),
  },
  {
    t: "remote",
    col: "#9aa3c0",
    permanent: false,
    name: "REMOTE",
    help: "Q detonates your bombs",
    apply: (w, p) => (p.remote = true),
  },
];

/* Enemy field-guide table. Colors must stay identical to spawnEnemy.
   rooms is first-seen / present rooms (1-indexed). help is the ITEMS-page line. */
export const FOES = Object.freeze([
  Object.freeze({
    t: "walker",
    name: "WALKER",
    col: "#8affc1",
    rooms: "1-5",
    help: "wanders the lanes · 100",
  }),
  Object.freeze({
    t: "stationary",
    name: "SENTRY",
    col: "#c58aff",
    rooms: "1-3, 5",
    help: "stands still · touch still hurts",
  }),
  Object.freeze({
    t: "fast",
    name: "FAST",
    col: "#ffd447",
    rooms: "2-5",
    help: "twice as fast · hunts you · 100",
  }),
  Object.freeze({
    t: "chaser",
    name: "CHASER",
    col: "#66c8ff",
    rooms: "3-5",
    help: "hunts you down · 100",
  }),
  Object.freeze({
    t: "boomerang",
    name: "PHANTOM",
    col: "#ff9dd6",
    rooms: "4-5",
    help: "walks through green bricks · 250",
  }),
  Object.freeze({
    t: "rocket",
    name: "ROCKET",
    col: "#ff7a59",
    rooms: "5",
    help: "through bricks · 300 · room 5",
  }),
]);

/* Apply a power-up. PURE (deterministic, no Math.random). `pdef` is a POWER
   entry. Some effects mutate `world` (heart), most mutate the player. */
export function applyPower(world, pdef, x, y) {
  world.events.push({ t: "power", x, y, col: pdef.col });
  pdef.apply(world, world.players[0]);
}

/* Lose a life (classic: revert transient power-ups, keep permanent stat upgs).
   Returns true if the game is lost. */
export function hurtPlayer(world, emit) {
  const p = world.players[0];
  world.lives--;
  world.score = Math.max(0, world.score - CFG.DEATH_PENALTY);
  p.passing = false;
  p.kick = false;
  p.throw = false;
  p.remote = false;
  p.shield = false;
  p.bombKind = "normal";
  world.events.push({ t: "hurt", x: p.x, y: p.y });
  if (world.lives <= 0) {
    world.state = "LOSE";
    world.players[0].alive = false;
    world.events.push({ t: "lose" });
    return true;
  }
  p.x = 1.5 * CFG.TILE;
  p.y = 1.5 * CFG.TILE;
  p.iFrames = CFG.IFRAMES * 1.6;
  return false;
}

export function createPlayer(pid = 0) {
  return {
    pid,
    x: 1.5 * CFG.TILE,
    y: 1.5 * CFG.TILE,
    tx: 1,
    ty: 1,
    dir: { x: 1, y: 0 },
    face: { x: 1, y: 0 },
    speed: CFG.PLAYER_START.speed,
    r: CFG.TILE * 0.34,
    bombs: CFG.PLAYER_START.bombs,
    range: CFG.PLAYER_START.range,
    passing: false,
    kick: false,
    throw: false,
    remote: false,
    shield: false,
    bombKind: "normal",
    iFrames: CFG.IFRAMES,
    walk: 0,
    alive: true,
    color: "#37f0d0",
  };
}

export function spawnEnemy(type, x, y, level, rng, opts) {
  const curve = opts && opts.curve != null ? opts.curve : CFG.ENEMY_LEVEL_CURVE;
  const invulnT =
    opts && opts.invulnT != null ? opts.invulnT : CFG.ENEMY_INVULN_T;
  const base = CFG.ENEMY_BASE_SPEED + level * curve;
  const spec = {
    walker: { speed: base, color: "#8affc1", r: CFG.TILE * 0.34 },
    fast: { speed: base * 2.0, color: "#ffd447", r: CFG.TILE * 0.32 },
    chaser: { speed: base * 1.3, color: "#66c8ff", r: CFG.TILE * 0.33 },
    stationary: { speed: 0, color: "#c58aff", r: CFG.TILE * 0.3 },
    boomerang: {
      speed: base * 1.6,
      color: "#ff9dd6",
      r: CFG.TILE * 0.3,
      pass: true,
    },
    rocket: {
      speed: base * 0.7,
      color: "#ff7a59",
      r: CFG.TILE * 0.4,
      pass: true,
    },
  }[type] || { speed: base, color: "#8affc1", r: CFG.TILE * 0.34 };
  return {
    type,
    x: x * CFG.TILE + CFG.TILE / 2,
    y: y * CFG.TILE + CFG.TILE / 2,
    tx: x,
    ty: y,
    dir: { x: 1, y: 0 },
    speed: spec.speed,
    color: spec.color,
    r: spec.r,
    pass: !!spec.pass,
    dead: false,
    invuln: true,
    invulnT,
    cd:
      type === "chaser" || type === "fast"
        ? 0.2 + (rng ? rng.next() * 0.3 : 0.15)
        : 4 + (rng ? rng.int(0, 12) : 6),
    home: { x, y },
  };
}
