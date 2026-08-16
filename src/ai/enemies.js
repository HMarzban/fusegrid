import {CFG, DIRS4, DIRS8, key, clamp} from "../core/config.js";
import {tileOf, isWall, solidAt, aabb, bfsNext, moveEntity} from "../core/board.js";

/* Update every enemy on the world for one fixed step. PURE & DETERMINISTIC:
   uses world.rng (seeded) instead of Math.random so the sim is replayable and
   net-syncable. The renderer must NOT call this. */
export function updateEnemies(world, dt, input, emit){
  const w=world, p=w.players[0];
  const emitFx = emit || ((e)=>w.events.push(e));
  const pt={x:tileOf(p.x), y:tileOf(p.y)};

  // deterministic shuffle using the world rng (no Math.random)
  const shuffle=(arr)=>{
    for(let i=arr.length-1;i>0;i--){ const j=w.rng.int(0,i); [arr[i],arr[j]]=[arr[j],arr[i]]; }
    return arr;
   };

 for(const e of w.enemies){
  if(e.dead)continue;
  if(e.invuln){ e.invulnT=Math.max(0,e.invulnT-dt); e.invuln=e.invulnT>0; }

  if(e.type==="stationary"){
    e.y=(e.home.y*CFG.TILE+CFG.TILE/2)+Math.sin(e.home.y*CFG.TILE*0+ (w.time*3))*1.5;
    // contact check (stationary can still hit you if you walk into it)
    checkContact(w, e, emitFx);
    continue;
   }
  if(e.speed===0)continue;
  const sp=e.speed*CFG.TILE*dt;
  e.cd-=dt;
  if(e.cd<=0){
    e.cd=6+w.rng.int(0,14);
    let ndir=null;
    if(e.type==="chaser"||e.type==="fast"){
      const next=bfsNext(w.grid,e.tx,e.ty,pt.x,pt.y,e.pass);
      if(next)ndir={x:Math.sign(next.x-e.tx),y:Math.sign(next.y-e.ty)}||e.dir;
     }
    // fall back to a deterministic random legal direction
    const cands=shuffle(DIRS4.slice().concat(DIRS8.slice()));
    for(const d of cands){
      const nx=e.x+d.x*sp, ny=e.y+d.y*sp;
      const blocked = e.pass ? isWall(w.grid,tileOf(nx),tileOf(ny))
                             : solidAt(w.grid,nx,ny);
      if(!blocked){ ndir=d; break; }
      }
    if(ndir)e.dir=ndir;
    }
  moveEntity(e, w.grid, e.dir.x*sp, e.dir.y*sp, e.pass);
   // keep on board (wall/border)
  if(e.tx<1){ e.x=CFG.TILE; e.dir.x=1; }
  else if(e.tx>CFG.COLS-2){ e.x=(CFG.COLS-2)*CFG.TILE+CFG.TILE/2; e.dir.x=-1; }
  if(e.ty<1){ e.y=CFG.TILE; e.dir.y=1; }
  else if(e.ty>CFG.ROWS-2){ e.y=(CFG.ROWS-2)*CFG.TILE+CFG.TILE/2; e.dir.y=-1; }
  e.tx=tileOf(e.x); e.ty=tileOf(e.y);
   checkContact(w, e, emitFx);
  }

  w.enemies=w.enemies.filter(e=>!e.dead);
   // all-clear -> auto-advance timer
  if(w.enemies.length===0 && w.state==="PLAY"){
    w.winTimer+=dt;
    if(w.winTimer>=CFG.WIN_DELAY){
      return {advance:true, bonus:w.score+=500+w.lives*100};
      }
    }
  return null;
 }

function checkContact(w,e,emit){
  const p=w.players[0];
  if(p.iFrames>0)return;
  const hit = Math.hypot(e.x-p.x,e.y-p.y) < e.r + CFG.TILE*0.26;
  if(hit){
    if(p.shield){ p.shield=false; p.iFrames=CFG.IFRAMES; emit({t:"kill", x:e.x, y:e.y}); }
    else emit({t:"hurt", x:p.x, y:p.y});
   }
 }
