export const CFG = Object.freeze({
  COLS: 15, ROWS: 13, TILE: 40,
  STEP: 1/60,
  FUSE: 2.5,
  WIN_DELAY: 1.6,
  PLAYER_START: {bombs:1, range:1, speed:3.4, lives:3},
  SPEED_UP: 0.8,
  MAX_BOMBS: 8, MAX_RANGE: 8, MAX_SPEED: 6,
  CONTACT_R:0.26, PICKUP_R:0.45, PASS_MULT:2.4, SPAWN_CLEAR:3.5,
  DEATH_PENALTY:20, BRICK_SCORE:10, ITEM_SCORE:50,
  LEVEL_BONUS:500, LEVEL_BONUS_PER_LIFE:100,
  ENEMY_BASE_SPEED:1.5, ENEMY_LEVEL_CURVE:0.12, ENEMY_INVULN_T:1.2,
  IFRAMES: 1.4, BLADE_TTL: 0.34,
  KICK_SPEED: 4.5,
});
export const T = Object.freeze({EMPTY:0, BRICK:1, WALL:2});
export const BIOMES = Object.freeze([
  {name:"JUNGLE", bg0:"#0e4a28",bg1:"#062416",brickA:"#42f024",brickB:"#14a018",brickHi:"#d4ff70",wall:"#d4a030",wallHi:"#ffe878",floor0:"#1a7a30",floor1:"#126024",hWall:22,hBrick:12,sky:"#7ec8ff"},
  {name:"ICE",    bg0:"#4a9ae0",bg1:"#0a2048",brickA:"#f4fcff",brickB:"#b0dcf0",brickHi:"#ffffff",wall:"#2e4a78",wallHi:"#d0e8f8",floor0:"#7eb8e0",floor1:"#5a9cc8",hWall:36,hBrick:20,sky:"#c8e4ff"},
  {name:"FACTORY",bg0:"#3d4a58",bg1:"#0e1218",brickA:"#ff9a20",brickB:"#c45010",brickHi:"#ffe06a",wall:"#8a96a4",wallHi:"#d0d8e0",floor0:"#3a3c40",floor1:"#282a2e",hWall:16,hBrick:8,sky:"#f0c070"},
  {name:"WATER",  bg0:"#0a3a48",bg1:"#041820",brickA:"#3ad0c8",brickB:"#1a7a78",brickHi:"#b8fff4",wall:"#6a7a88",wallHi:"#c0d0dc",floor0:"#0e4a58",floor1:"#0a3844",hWall:28,hBrick:14,sky:"#1a6080"},
  {name:"ARENA",  bg0:"#4a2058",bg1:"#140818",brickA:"#ff6a8c",brickB:"#c23058",brickHi:"#ffc0d0",wall:"#6a6460",wallHi:"#c8b8b0",floor0:"#3a2848",floor1:"#281830",hWall:20,hBrick:12,sky:"#2a1840"},
  {name:"SAND",   bg0:"#6a4a18",bg1:"#241808",brickA:"#e8b040",brickB:"#a07020",brickHi:"#ffe8a0",wall:"#c4a070",wallHi:"#f0e0c0",floor0:"#c49840",floor1:"#a07828",hWall:14,hBrick:8,sky:"#ffd080"},
  {name:"VOID",   bg0:"#0a0614",bg1:"#020108",brickA:"#6a20c8",brickB:"#3a1070",brickHi:"#d0a0ff",wall:"#1a1428",wallHi:"#8a70b0",floor0:"#140e20",floor1:"#0a0814",hWall:32,hBrick:16,sky:"#201040"},
  {name:"CROWN",  bg0:"#3a2010",bg1:"#140808",brickA:"#ffd447",brickB:"#c49020",brickHi:"#fff0a8",wall:"#8a6040",wallHi:"#f0d080",floor0:"#5a3020",floor1:"#3a2018",hWall:24,hBrick:12,sky:"#f0c060"},
]);
export const biomeOf = lvl => BIOMES[(Math.max(1,lvl)-1)%BIOMES.length];
export const ROOM_LOCK=5;
export const ROOM_MAX=8;
export function isFinale(level){ const n=level|0; return n===ROOM_LOCK||n>=ROOM_MAX; }
export function roomCap(unlocked){ return unlocked?ROOM_MAX:ROOM_LOCK; }
export function key(x,y){return y*CFG.COLS+x;}
export function clamp(v,a,b){return v<a?a:v>b?b:v;}
export const DIRS4=Object.freeze([{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}]);
export const DIRS8=Object.freeze(DIRS4.concat([{x:1,y:1},{x:1,y:-1},{x:-1,y:1},{x:-1,y:-1}]));
