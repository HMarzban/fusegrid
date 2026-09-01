import {CFG,T,key,clamp} from "./config.js";
import {tileOf, isWall, aabb, moveEntity} from "./board.js";
import {createWorld, loadLevel} from "./world.js";
import {applyPower, hurtPlayer} from "./entities.js";
import {updateEnemies} from "../ai/enemies.js";

/* A clean intent for one player for this tick. This is exactly what a network
   client would send the server: move vector + edge-triggered fire/remote. */
export function newIntent(){
  return {move:{x:0,y:0}, fire:false, firePrev:false, shift:false, remote:false, kick:false};
}
const emptyInputs=Object.freeze(Object.keys(newIntent()).reduce((o,k)=>(o[0]={move:{x:0,y:0},fire:false,firePrev:false,shift:false,remote:false,kick:false}),{}));

/* Advance the sim by dt seconds for the given inputs (keyed by pid).
   Events (audio/particle triggers) ACCUMULATE in world.events; the renderer
   drains them each frame. DETERMINISTIC: same seed + same input sequence =>
   identical world. No DOM / audio / canvas referenced here. */
 export function step(world, dt, inputs){
   const emit=(e)=>world.events.push(e);
   world.time+=dt; world.tick++;

   if(world.state==="MENU"){
     const i=inputs[0]||emptyInputs[0];
     if(i.fire && !world.fireEdge){ startGame(world); }
     world.fireEdge=!!i.fire;
     return;
     }
   if(world.state==="WIN"){
     const i=inputs[0]||emptyInputs[0];
     if(i.fire && !world.fireEdge){ loadLevel(world, world.level+1, true); world.state="PLAY"; }
     world.fireEdge=!!i.fire;
     return;
     }
   if(world.state==="LOSE"){
     const i=inputs[0]||emptyInputs[0];
     if(i.fire && !world.fireEdge){ startGame(world); }
     world.fireEdge=!!i.fire;
     return;
     }
   if(world.state==="PAUSE"){ return; }

     // ---- PLAY ----
   updatePlayer(world, dt, inputs[0]||emptyInputs[0], emit);
   updateBombs(world, dt, emit);
   const adv=updateEnemies(world, dt, inputs, emit);
   if(adv&&adv.advance){ world.events.push({t:"win"}); world.state="WIN"; }
 }

function startGame(world){
  loadLevel(world, 1, false);
  world.state="PLAY";
  world.score=0;
}

function updatePlayer(world, dt, inp, emit){
  const w=world, p=w.players[0];
  if(!p.alive)return;
  p.walk+=dt;
  let dx=inp.move?inp.move.x:0, dy=inp.move?inp.move.y:0;
  if(dx||dy){ p.face.x=dx; p.face.y=dy; }
  const sp=p.speed*CFG.TILE*dt;
  if(dx||dy){
    p.tx=tileOf(p.x); p.ty=tileOf(p.y);
    const ptx=p.tx, pty=p.ty;
    if(p.passing){
      moveEntity(p, w.grid, dx*sp*CFG.PASS_MULT, dy*sp*CFG.PASS_MULT, true);
      if(w.grid[key(p.tx,p.ty)]===T.BRICK){
        w.grid[key(p.tx,p.ty)]=T.EMPTY; revealItem(w,p.tx,p.ty,emit);
        w.events.push({t:"brick", x:p.x, y:p.y});
        w.score+=CFG.BRICK_SCORE;
       }
     } else {
      // canon: live bombs are tile-solid (bombsBlock gives walk-off + no re-entry)
      moveEntity(p, w.grid, dx*sp, 0, false, w.bombs);
      moveEntity(p, w.grid, 0, dy*sp, false, w.bombs);
      // KICK: moving into a bomb launches it (slides until an obstacle).
      // Axis preference: X when dx!=0, else Y. Replaces the old brick-break.
      if(inp.kick && p.kick){
        let sx=0,sy=0;
        if(dx)sx=dx>0?1:-1; else if(dy)sy=dy>0?1:-1;
        if(sx||sy){
          const b=w.bombs.find(bb=>!bb.dead&&!bb.slide
            &&bb.tx===ptx+sx&&bb.ty===pty+sy);
          if(b)launchSlider(w,b,sx,sy);
         }
       }
     }
    p.x=clamp(p.x, 1.5*CFG.TILE, (CFG.COLS-1.5)*CFG.TILE);
    p.y=clamp(p.y, 1.5*CFG.TILE, (CFG.ROWS-1.5)*CFG.TILE);
    }
  p.iFrames=Math.max(0,p.iFrames-dt);
   // fire / throw / remote
  if(inp.fire && !w.fireEdge){
    if(inp.shift && p.throw){
      placeBomb(w, p.x+p.face.x*CFG.TILE*1.1, p.y+p.face.y*CFG.TILE*1.1, emit, true);
       } else {
      placeBomb(w, p.x, p.y, emit);
      }
    }
  const re=!!inp.remote;
  if(re && !w.remoteEdge && p.remote){
    for(const b of w.bombs.slice())detonate(w,b,emit);
     }
  w.remoteEdge=re;
  w.fireEdge=!!inp.fire;
   // collect items by walking over them
  for(const it of w.items){
    if(it.taken)continue;
    const dx=it.x-p.x, dy=it.y-p.y;
    if(dx*dx+dy*dy < (CFG.TILE*CFG.PICKUP_R)**2){
      it.taken=true; w.score+=CFG.ITEM_SCORE; applyPower(w, it.pdef, it.x, it.y);
       }
     }
  // keep firePrev in sync so the next tick's edge works even without input
  if(inp.firePrev!==undefined) inp.firePrev=w.fireEdge;
 }

function launchSlider(w,b,sx,sy){
  // no-op when the very first leg is blocked: kicking a wall/bomb/enemy-
  // adjacent resting bomb must not jitter it (stable halts under held key)
  if(sliderStopAt(w,b,b.tx+sx,b.ty+sy))return false;
  b.x=(b.tx+.5)*CFG.TILE; b.y=(b.ty+.5)*CFG.TILE;
  b.slide={x:sx,y:sy}; b.prog=0;
  return true;
}

/* Tile-to-tile slider: progress 0..1 toward the next tile center; on arrival
   the NEXT tile is stop-checked (WALL/BRICK/bomb/enemy) before commit, so a
   kicked bomb always halts just short of obstacles. Fuse keeps ticking. */
function advanceSlider(w,b,dt){
  let travel=b.prog+CFG.KICK_SPEED*dt;
  while(travel>=1){
    const nx=b.tx+b.slide.x, ny=b.ty+b.slide.y;
    if(sliderStopAt(w,b,nx,ny)){
      b.prog=0; b.slide=null;
      b.x=(b.tx+.5)*CFG.TILE; b.y=(b.ty+.5)*CFG.TILE;
      return;
     }
    b.tx=nx; b.ty=ny; travel-=1;
   }
  b.prog=travel;
  b.x=(b.tx+.5+b.slide.x*travel)*CFG.TILE;
  b.y=(b.ty+.5+b.slide.y*travel)*CFG.TILE;
}

function sliderStopAt(w,b,tx,ty){
  const v=w.grid[key(tx,ty)];
  if(v===undefined||v===T.WALL||v===T.BRICK)return true;
  if(w.bombs.some(o=>o!==b&&!o.dead&&o.tx===tx&&o.ty===ty))return true;
  if(w.enemies.some(e=>!e.dead&&e.tx===tx&&e.ty===ty))return true;
  return false;
}

function updateBombs(world, dt, emit){
  const w=world;
  for(const b of w.bombs){
    if(b.dead)continue;
    if(b.slide)advanceSlider(w,b,dt);
    b.timer-=dt; if(b.timer<=0)detonate(w,b,emit);
   }
  w.bombs=w.bombs.filter(b=>!b.dead);
  for(const bl of w.blades) bl.t+=dt;
  w.blades=w.blades.filter(bl=>bl.t<bl.ttl);
 }

/* Single source of truth for a cross blast. */
function computeBlast(w,cx,cy,radius,pierce,line,dir){
  const tiles=[{tx:cx,ty:cy,brick:false}];
  const arms = line ? [dir||{x:1,y:0}] : [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
  for(const d of arms){
    let blocked=false;
    for(let i=1;i<=radius && !blocked;i++){
      const tx=cx+d.x*i, ty=cy+d.y*i;
      if(isWall(w.grid,tx,ty)){ blocked=true; break; }
      const brick=w.grid[key(tx,ty)]===T.BRICK;
      tiles.push({tx,ty,brick});
      if(brick && !pierce && !line) blocked=true;
       }
    }
  return tiles;
 }

function placeBomb(w,px,py,emit,thrown){
  const p=w.players[0];
  if(w.bombs.length>=p.bombs)return false;
  const tx=tileOf(px), ty=tileOf(py);
  if(w.grid[key(tx,ty)]!==T.EMPTY)return false;
  if(w.bombs.some(b=>b.tx===tx&&b.ty===ty))return false;
  if(thrown && w.enemies.some(e=>!e.dead&&e.tx===tx&&e.ty===ty))return false;
  const variant=p.bombKind;
  const radius = variant==="power"?CFG.PLAYER_START.range+2
                :(variant==="line"||variant==="pierce")?Math.max(p.range,5)
                :p.range;
  w.bombs.push({x:px,y:py,tx,ty,timer:CFG.FUSE,radius,
    pierce:variant==="pierce", line:variant==="line",
    dir:variant==="line"?{x:p.face.x,y:p.face.y}:null, variant, dead:false});
  emit({t:"bomb", x:px, y:py});
  return true;
 }

function detonate(w,bomb,emit){
  if(bomb.dead)return; bomb.dead=true;
  const tiles=computeBlast(w,bomb.tx,bomb.ty,bomb.radius,bomb.pierce,bomb.line,bomb.dir);
  w.blades.push({x:bomb.x,y:bomb.y,tiles,t:0,ttl:CFG.BLADE_TTL,variant:bomb.variant});
  for(const t of tiles) if(t.brick && !bomb.pierce && !bomb.line) breakBrick(w,t.tx,t.ty,emit);
   // damage
  const p=w.players[0];
  for(const t of tiles){
    for(const e of w.enemies)
      if(!e.dead && !e.invuln && aabb(w.grid,t.tx,t.ty,e.x,e.y,e.r)) killEnemy(w,e,emit);
    if(aabb(w.grid,t.tx,t.ty,p.x,p.y,CFG.TILE*0.30) && p.alive && p.iFrames<=0){
      if(p.shield){ p.shield=false; p.iFrames=CFG.IFRAMES; emit({t:"hurt", x:p.x, y:p.y}); }
      else hurtPlayer(w, emit);
       }
     }
  emit({t:"boom", x:bomb.x, y:bomb.y});
   // chain: any live bomb sitting on a blast-covered tile detonates too
  const covered=new Set(tiles.map(t=>key(t.tx,t.ty)));
  for(const b of w.bombs.slice())
    if(!b.dead && covered.has(key(b.tx,b.ty))) detonate(w,b,emit);
 }

function breakBrick(w,tx,ty,emit){
  const px=tx*CFG.TILE+CFG.TILE/2, py=ty*CFG.TILE+CFG.TILE/2;
  if(w.grid[key(tx,ty)]!==T.BRICK)return;
  w.grid[key(tx,ty)]=T.EMPTY;
  revealItem(w,tx,ty,emit);
  w.events.push({t:"brick", x:px, y:py});
  w.score+=CFG.BRICK_SCORE;
 }

function revealItem(w,tx,ty,emit){
  const cxx=tx*CFG.TILE+CFG.TILE/2, cyy=ty*CFG.TILE+CFG.TILE/2;
  for(const it of w.items) if(!it.taken && tileOf(it.x)===tx && tileOf(it.y)===ty){
    it.taken=true; w.score+=CFG.ITEM_SCORE; applyPower(w,it.pdef,cxx,cyy);
     }
 }

function killEnemy(w,e,emit){
  if(e.dead)return; e.dead=true;
  w.score += e.type==="rocket"?300:e.type==="boomerang"?250:100;
  emit({t:"kill", x:e.x, y:e.y, color:e.color});
 }

/* Renderer consumes world.events for audio/particle fx. The sim never writes
   visual-only state, so single-player and future multiplayer stay identical. */

export {createWorld, loadLevel};
