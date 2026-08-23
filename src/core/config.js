export const CFG = Object.freeze({
  COLS: 15, ROWS: 13, TILE: 40,
  STEP: 1/60,
  FUSE: 2.5,
  WIN_DELAY: 1.6,
  PLAYER_START: {bombs:1, range:1, speed:3.4, lives:3},
  SPEED_UP: 0.8,
  MAX_BOMBS: 8, MAX_RANGE: 8,
  CONTACT_R:0.26, PICKUP_R:0.45, PASS_MULT:2.4, SPAWN_CLEAR:3.5,
  DEATH_PENALTY:20, BRICK_SCORE:10, ITEM_SCORE:50,
  LEVEL_BONUS:500, LEVEL_BONUS_PER_LIFE:100,
  ENEMY_BASE_SPEED:1.5, ENEMY_LEVEL_CURVE:0.12, ENEMY_INVULN_T:1.2,
  IFRAMES: 1.4, BLADE_TTL: 0.34,
});
export const T = Object.freeze({EMPTY:0, BRICK:1, WALL:2});
export const BIOMES = Object.freeze([
  {name:"JUNGLE", bg0:"#123a33",bg1:"#0a201d",brickA:"#57c34a",brickB:"#2f7d34",brickHi:"#8fe87a",wall:"#5b6c86",wallHi:"#7f93b4",floor0:"#123028",floor1:"#0c241f"},
  {name:"ICE",    bg0:"#2b4a7a",bg1:"#0f2350",brickA:"#7fb4ff",brickB:"#3f6fbf",brickHi:"#cfe6ff",wall:"#8ea6c8",wallHi:"#c2d4ea",floor0:"#123056",floor1:"#0c2040"},
  {name:"FACTORY",bg0:"#4a3f2b",bg1:"#241d12",brickA:"#d78a3c",brickB:"#9c5f26",brickHi:"#ffc27a",wall:"#6b7382",wallHi:"#98a2b2",floor0:"#2a2418",floor1:"#1a1610"},
  {name:"ARENA",  bg0:"#3a2b4a",bg1:"#1c1330",brickA:"#ff5d73",brickB:"#b03a4d",brickHi:"#ff9db0",wall:"#6a5a82",wallHi:"#9a86b4",floor0:"#241a34",floor1:"#181028"},
]);
export const biomeOf = lvl => BIOMES[(Math.max(1,lvl)-1)%BIOMES.length];
export function key(x,y){return y*CFG.COLS+x;}
export function clamp(v,a,b){return v<a?a:v>b?b:v;}
export const DIRS4=Object.freeze([{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]);
export const DIRS8=Object.freeze(DIRS4.concat([{x:1,y:1},{x:1,y:-1},{x:-1,y:1},{x:-1,y:-1}]));
