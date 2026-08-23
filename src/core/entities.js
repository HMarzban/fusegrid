import {CFG, clamp} from "./config.js";

/* Power-up table. apply(world, player) is PURE (no Math.random) so it is
   deterministic and network-safe. permanent=false -> reverted on death. */
export const POWER = [
  {t:"fire",   col:"#ff8a3c", permanent:true,  apply:(w,p)=>p.range=clamp(p.range+1,1,CFG.MAX_RANGE)},
  {t:"bomb",   col:"#ff5d73", permanent:true,  apply:(w,p)=>p.bombs=clamp(p.bombs+1,1,CFG.MAX_BOMBS)},
  {t:"speed",  col:"#3db4ff", permanent:true,  apply:(w,p)=>p.speed+=CFG.SPEED_UP},
  {t:"heart",  col:"#ff3b5c", apply:(w,p)=>{w.lives++;}},
  {t:"shield", col:"#6fb7ff", permanent:false, apply:(w,p)=>p.shield=true},
  {t:"kick",   col:"#c07a3a", permanent:false, apply:(w,p)=>p.kick=true},
  {t:"throw",  col:"#c07a3a", permanent:false, apply:(w,p)=>p.throw=true},
  {t:"pass",   col:"#77ff99", permanent:false, apply:(w,p)=>p.passing=true},
  {t:"line",   col:"#b8c0d8", apply:(w,p)=>p.bombKind="line"},
  {t:"power",  col:"#ff4d5e", apply:(w,p)=>p.bombKind="power"},
  {t:"pierce", col:"#8f8fff", apply:(w,p)=>p.bombKind="pierce"},
  {t:"remote", col:"#9aa3c0", permanent:false, apply:(w,p)=>p.remote=true},
];
export const POWER_BY_TYPE=Object.fromEntries(POWER.map(p=>[p.t,p]));

/* Apply a power-up. PURE (deterministic, no Math.random). `pdef` is a POWER
   entry. Some effects mutate `world` (heart), most mutate the player. */
export function applyPower(world, pdef, x, y){
  world.events.push({t:"power", x, y, col:pdef.col});
  pdef.apply(world, world.players[0]);
 }

/* Lose a life (classic: revert transient power-ups, keep permanent stat upgs).
   Returns true if the game is lost. */
export function hurtPlayer(world, emit){
  const p=world.players[0];
  world.lives--;
  world.score=Math.max(0,world.score-20);
  p.passing=false; p.kick=false; p.throw=false; p.remote=false; p.shield=false; p.bombKind="normal";
  world.events.push({t:"hurt", x:p.x, y:p.y});
  if(world.lives<=0){
    world.state="LOSE";
    world.players[0].alive=false;
    world.events.push({t:"lose"});
    return true;
     }
  p.x=1.5*CFG.TILE; p.y=1.5*CFG.TILE; p.iFrames=CFG.IFRAMES*1.6;
  world.bombs=[]; world.blades=[];
  return false;
 }

export function createPlayer(pid=0){
  return {
    pid,
    x:1.5*CFG.TILE, y:1.5*CFG.TILE, tx:1, ty:1,
    dir:{x:1,y:0}, face:{x:1,y:0},
    speed:CFG.PLAYER_START.speed, r:CFG.TILE*0.34,
    bombs:CFG.PLAYER_START.bombs, range:CFG.PLAYER_START.range,
    passing:false, kick:false, throw:false, remote:false, shield:false,
    bombKind:"normal",
    iFrames:CFG.IFRAMES, walk:0, alive:true, color:"#37f0d0",
  };
}

export function spawnEnemy(type,x,y,level,rng){
  const base=1.5+level*0.12;
  const spec={
    walker:     {speed:base,    color:"#8affc1", r:CFG.TILE*0.34},
    fast:       {speed:base*2.0,color:"#ffd447", r:CFG.TILE*0.32},
    chaser:     {speed:base*1.3,color:"#66c8ff", r:CFG.TILE*0.33},
    stationary: {speed:0,       color:"#c58aff", r:CFG.TILE*0.30},
    boomerang:  {speed:base*1.6,color:"#ff9dd6", r:CFG.TILE*0.30, pass:true},
    rocket:     {speed:base*0.7,color:"#ff7a59", r:CFG.TILE*0.40, pass:true},
  }[type] || {speed:base,color:"#8affc1",r:CFG.TILE*0.34};
  return {
    type,
    x:x*CFG.TILE+CFG.TILE/2, y:y*CFG.TILE+CFG.TILE/2, tx:x, ty:y,
    dir:{x:1,y:0}, speed:spec.speed, color:spec.color, r:spec.r,
    pass:!!spec.pass, dead:false,
    invuln:true, invulnT:1.2, cd:4+(rng?rng.int(0,12):6), home:{x,y},
  };
}
