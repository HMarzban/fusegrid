import { CFG, ROOM_LOCK, ROOM_MAX } from "./config.js";

export const HEAT = Object.freeze({ CORE: 0, PLUS: 1, MAX: 2 });
export const HEAT_NAME = Object.freeze(["CORE", "PLUS", "MAX"]);
export const HEAT_MARK = Object.freeze(["·", "+", "×"]);
export const HEAT_COL = Object.freeze(["#7385ad", "#37f0d0", "#ff5d73"]);

export function clampHeat(h) {
  const n = h | 0;
  return n < 0 ? 0 : n > 2 ? 2 : n;
}

export function heatScore(raw, heat) {
  return (raw | 0) * (1 + clampHeat(heat));
}

export function heatToken(h) {
  const i = clampHeat(h);
  return HEAT_MARK[i] + " " + HEAT_NAME[i];
}

const CORE_ROSTER = Object.freeze({
  1: Object.freeze(["walker", "walker", "stationary"]),
  2: Object.freeze(["walker", "walker", "fast", "stationary"]),
  3: Object.freeze(["walker", "chaser", "fast", "stationary"]),
  4: Object.freeze(["walker", "chaser", "fast", "boomerang"]),
  5: Object.freeze([
    "walker",
    "chaser",
    "fast",
    "stationary",
    "boomerang",
    "rocket",
  ]),
});
const PLUS_ROSTER = Object.freeze({
  2: Object.freeze(["walker", "walker", "fast", "stationary", "chaser"]),
  3: Object.freeze(["walker", "chaser", "fast", "stationary", "boomerang"]),
  4: Object.freeze(["walker", "chaser", "fast", "boomerang", "rocket"]),
  5: Object.freeze([
    "walker",
    "chaser",
    "fast",
    "stationary",
    "boomerang",
    "rocket",
    "chaser",
  ]),
});
const MAX_L5 = Object.freeze([
  "walker",
  "chaser",
  "fast",
  "stationary",
  "boomerang",
  "rocket",
  "boomerang",
]);
const ROOM_EXTRA = Object.freeze(["burrow", "shade", "knight"]);
const HEAT_PROFILES = Object.freeze([
  Object.freeze({
    heat: 0,
    fuse: CFG.FUSE,
    lives: CFG.PLAYER_START.lives,
    curve: CFG.ENEMY_LEVEL_CURVE,
    chaseCd: 0.35,
    invulnT: CFG.ENEMY_INVULN_T,
    iFrames: CFG.IFRAMES,
    carve: 0.32,
    buriedAdd: 4,
    floorAdd: 2,
    floorMin: 2,
  }),
  Object.freeze({
    heat: 1,
    fuse: 2.3,
    lives: 3,
    curve: 0.16,
    chaseCd: 0.28,
    invulnT: 1.4,
    iFrames: CFG.IFRAMES,
    carve: 0.28,
    buriedAdd: 4,
    floorAdd: 1,
    floorMin: 2,
  }),
  Object.freeze({
    heat: 2,
    fuse: 2.1,
    lives: 2,
    curve: 0.18,
    chaseCd: 0.22,
    invulnT: 1.6,
    iFrames: 1.1,
    carve: 0.24,
    buriedAdd: 3,
    floorAdd: 0,
    floorMin: 1,
  }),
]);

export function heatRoster(level, heat) {
  const room = Math.min(ROOM_MAX, Math.max(1, level | 0));
  const lv = Math.min(ROOM_LOCK, room);
  const h = clampHeat(heat);
  let base;
  if (lv === 1 || h === 0) base = CORE_ROSTER[lv];
  else if (h === 1) base = PLUS_ROSTER[lv];
  else base = lv < ROOM_LOCK ? CORE_ROSTER[lv + 1] : MAX_L5;
  const out = base.slice();
  for (let i = ROOM_LOCK; i < room; i++) out.push(ROOM_EXTRA[i - ROOM_LOCK]);
  return out;
}

export function heatProfile(heat) {
  return Object.assign({}, HEAT_PROFILES[clampHeat(heat)]);
}
