/* TILE-AWARE DEMOBOT FORK (#25 balance harness; tracked, offline, never
   imported by src/, never shipped). A copy of src/app/demobot.js (the stock
   attract bot, pinned by tests/demobot.test.mjs) plus a tile model that runs
   ONLY when the room carries floor-tile rule codes 1..7 (`rulesOn`, see
   tilemodel.mjs). With world.feat null, or art-only codes 8..14, every
   intent and every private-rng draw equals the stock bot's tick by tick
   (tests/demobot-tiles.test.mjs; the full pin is `tilesweep.mjs --plan pin`).
   Tile model (spec 2026-10-21 §6, synthesis §7.5), all knobs read through
   the sim's featProfile(w):
   - danger: CONVEYOR edge costs in the flee search and every cell a carried
     bomb reaches before its fuse; ICE PATCH flee destinations (no wait tile
     at MAX, coast endpoints); BOOSTER relay cover at the tier; TRAP pending
     wind-ups at full r and an idle TRAP a foe stands next to;
   - joy: plant when the tile-extended blast (delivery / relay) holds a foe
     or brick the plain blast does not; wander toward a CONVEYOR when idle;
     with a hunter <= 5 steps away, hop over a TRAP, whose footprint then
     reads as danger and turns the bot off its line.
   Stock header follows.
   ATTRACT-MODE DEMO BOT — deterministic casual-player AI for the attract
   demo world. Pure: reads world fields only, owns a private mulberry32
   stream, no wall-clock, no PRNG outside that stream, no DOM; state is
   serializable so replays can snapshot and restore it. Mirrors the sim's
   computeBlast footprint inline (cross walk with wall/brick blocking)
   instead of importing from src/core/sim.js.
   intent(world) order: NOOP guard -> danger map -> flee / post-plant
   escape -> pause -> sticky heading -> cube / foe-plant / foe-hunt /
   brick / wander. Combat cubes ignore the Manhattan-8 cap; soft cubes
   do not. Reachable foes beat spawn-brick nibble. Hunger wander aims
   at a blocked foe. Fire is one rising edge per want episode. */
import {CFG,T,key,DIRS4} from "../../src/core/config.js";
import {bfsNext} from "../../src/core/board.js";
import {createRng} from "../../src/core/rng.js";
import {isBelt} from "../../src/core/feat.js";
import {rulesOn,prof,tileDanger,bombCover,iceDestOk,moveSpeed} from "./tilemodel.mjs";

export const NOOP=Object.freeze({move:{x:0,y:0},fire:false,firePrev:false,
  shift:false,remote:false,kick:false});

export function createTileBot(seed){
  let rng=createRng(seed>>>0),latch=false;
  let mode=0,gx=0,gy=0,hx=0,hy=0,hold=0,pause=0,esc=false;

  function dangerTiles(w){
    const danger=new Set();
    for(const b of w.bombs){
      danger.add(key(b.tx,b.ty));
      const arms=b.line?[b.dir||{x:1,y:0}]
        :[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
      for(const d of arms){
        let blocked=false;
        for(let i=1;i<=b.radius&&!blocked;i++){
          const tx=b.tx+d.x*i,ty=b.ty+d.y*i,v=w.grid[key(tx,ty)];
          if(v===undefined||v===T.WALL){blocked=true;break;}
          danger.add(key(tx,ty));
          if(v===T.BRICK&&!b.pierce&&!b.line)blocked=true;
         }
       }
     }
    for(const bl of w.blades)
      if(bl.tiles)for(const t of bl.tiles)danger.add(key(t.tx,t.ty));
    if(rulesOn(w))tileDanger(w,danger);
    return danger;
   }

  function blastAt(w,tx,ty,radius){
    const d=new Set([key(tx,ty)]);
    for(const dir of DIRS4){
      for(let i=1;i<=radius;i++){
        const x=tx+dir.x*i,y=ty+dir.y*i,v=w.grid[key(x,y)];
        if(v===undefined||v===T.WALL)break;
        d.add(key(x,y));
        if(v===T.BRICK)break;
       }
     }
    if(rulesOn(w))bombCover(w,{tx,ty,radius,pierce:false,line:false,dir:null},
      w.fuse==null?CFG.FUSE:w.fuse,d);
    return d;
   }

  function usefulBlast(w,tx,ty,range){
    for(const dir of DIRS4){
      for(let i=1;i<=range;i++){
        const x=tx+dir.x*i,y=ty+dir.y*i,v=w.grid[key(x,y)];
        if(v===undefined||v===T.WALL)break;
        if(v===T.BRICK)return true;
        if(w.enemies.some(e=>!e.dead&&e.tx===x&&e.ty===y))return true;
       }
     }
    return false;
   }

  /* tile flee: earliest-arrival search with CONVEYOR edge costs and the ICE
     PATCH destination rule. Ties pop in discovery order (seq), so with
     uniform costs it visits, accepts and reconstructs exactly as the stock
     BFS does (first safe tile with no danger neighbour, else the first safe
     one): the fork departs from the stock bot only where a tile does. */
  function fleeMoveT(w,ptx,pty,danger){
    const N=CFG.COLS*CFG.ROWS,best=new Float64Array(N).fill(Infinity),seq=new Int32Array(N),
      done=new Uint8Array(N),prev=new Int16Array(N).fill(-1),p=w.players[0],s0=key(ptx,pty);
    const pb=prof(w).belt;
    best[s0]=0;
    let fallback=-1,n=1;
    for(;;){
      let k=-1,bt=Infinity,bs=0;
      for(let i=0;i<N;i++)if(!done[i]&&(best[i]<bt||(best[i]===bt&&bt<Infinity&&seq[i]<bs))){bt=best[i];bs=seq[i];k=i;}
      if(k<0)break;
      done[k]=1;
      const x=k%CFG.COLS,y=(k/CFG.COLS)|0;
      if(k!==s0&&!danger.has(k)&&iceDestOk(w,prev[k]%CFG.COLS,(prev[k]/CFG.COLS)|0,x,y,danger)){
        const edge=DIRS4.some(dd=>danger.has(key(x+dd.x,y+dd.y)));
        if(!edge){fallback=k;break;}
        if(fallback<0)fallback=k;
       }
      for(const d of DIRS4){
        const nx=x+d.x,ny=y+d.y,nk=key(nx,ny);
        if(nx<0||ny<0||nx>=CFG.COLS||ny>=CFG.ROWS)continue;
        if(done[nk]||w.grid[nk]!==T.EMPTY)continue;
        const v=pb.actors?moveSpeed(w,p,k,d.x,d.y,true,true):1;
        if(v<=0.05)continue;
        const nt=bt+1/v;
        if(nt<best[nk]){best[nk]=nt;prev[nk]=k;seq[nk]=n++;}
       }
     }
    if(fallback<0)return null;
    let cur=fallback;
    while(prev[cur]!==s0)cur=prev[cur];
    return {x:Math.sign(cur%CFG.COLS-ptx),y:Math.sign(((cur/CFG.COLS)|0)-pty)};
   }

  function fleeMove(w,ptx,pty,danger){
    if(rulesOn(w))return fleeMoveT(w,ptx,pty,danger);
    const prev=new Map(),seen=new Set([key(ptx,pty)]),q=[[ptx,pty]];
    let fallback=null;
    while(q.length){
      const [x,y]=q.shift();
      for(const d of DIRS4){
        const nx=x+d.x,ny=y+d.y,k=key(nx,ny);
        if(nx<0||ny<0||nx>=CFG.COLS||ny>=CFG.ROWS)continue;
        if(seen.has(k)||w.grid[k]!==T.EMPTY)continue;
        seen.add(k); prev.set(k,key(x,y));
        if(!danger.has(k)){
          const step=()=>{
            let cur=k;
            while(prev.get(cur)!==key(ptx,pty))cur=prev.get(cur);
            const sx=cur%CFG.COLS,sy=Math.floor(cur/CFG.COLS);
            return {x:Math.sign(sx-ptx),y:Math.sign(sy-pty)};
           };
          const edge=DIRS4.some(dd=>danger.has(key(nx+dd.x,ny+dd.y)));
          if(!edge)return step();
          if(!fallback)fallback=step;
         }
        q.push([nx,ny]);
       }
     }
    return fallback?fallback():null;
   }

  function lineClear(g,x0,y0,x1,y1){
    const dx=Math.sign(x1-x0),dy=Math.sign(y1-y0);
    let x=x0+dx,y=y0+dy;
    while(x!==x1||y!==y1){
      if(g[key(x,y)]!==T.EMPTY)return false;
      x+=dx;y+=dy;
     }
    return true;
   }

  function hugging(tx,ty,danger){
    return DIRS4.some(d=>danger.has(key(tx+d.x,ty+d.y)));
   }
  function foeAt(w,x,y){
    return w.enemies.some(e=>!e.dead&&e.tx===x&&e.ty===y);
   }
  function hopToward(w,x0,y0,x1,y1,blocked){
    const hop=bfsNext(w.grid,x0,y0,x1,y1,false,blocked);
    if(!hop)return null;
    return {x:Math.sign(hop.x-x0),y:Math.sign(hop.y-y0)};
   }
  function canEscape(w,ptx,pty,extra){
    const d=dangerTiles(w);
    for(const k of extra)d.add(k);
    return !!fleeMove(w,ptx,pty,d);
   }
  function tileOfItem(it){
    return {x:(it.x/CFG.TILE)|0,y:(it.y/CFG.TILE)|0};
   }

  function pickItem(w,ptx,pty,blocked){
    let best=null,bestPri=9,bestD=99;
    for(const it of w.items){
      if(it.taken||it.buried)continue;
      const t=tileOfItem(it),d=Math.abs(t.x-ptx)+Math.abs(t.y-pty);
      const combat=it.t==="fire"||it.t==="bomb"||it.t==="kick";
      if(!combat&&d>8)continue;
      if(!bfsNext(w.grid,ptx,pty,t.x,t.y,false,blocked))continue;
      const pri=combat?0:1;
      if(pri<bestPri||(pri===bestPri&&d<bestD)){best=it;bestPri=pri;bestD=d;}
     }
    return best;
   }

  function nearestFoe(w,ptx,pty){
    let ne=null,nd=Infinity;
    for(const e of w.enemies){
      if(e.dead)continue;
      const d=Math.abs(e.tx-ptx)+Math.abs(e.ty-pty);
      if(d<nd){nd=d;ne=e;}
     }
    return {ne,nd};
   }

  function adopt(mx,my,ticks,m,tx,ty){
    hx=mx;hy=my;hold=ticks;mode=m;gx=tx|0;gy=ty|0;
   }

  function walkOk(w,ptx,pty,nx,ny,danger,onBomb,deep){
    if(nx<0||ny<0||nx>=CFG.COLS||ny>=CFG.ROWS)return false;
    if(w.grid[key(nx,ny)]!==T.EMPTY)return false;
    if(foeAt(w,nx,ny))return false;
    if(w.bombs.some(b=>b.tx===nx&&b.ty===ny)&&!onBomb)return false;
    if(danger.has(key(nx,ny))&&!onBomb&&!danger.has(key(ptx,pty)))return false;
    if(deep&&w.bombs.length&&hugging(nx,ny,danger))return false;
    return true;
   }

  function tryPlantFoe(w,p,ptx,pty,ne,nd){
    if(!ne||w.bombs.length>=p.bombs)return false;
    const dx=ne.tx-ptx,dy=ne.ty-pty;
    const adj=nd===1;
    const lined=(dx===0||dy===0)&&nd<=p.range
      &&lineClear(w.grid,ptx,pty,ne.tx,ne.ty);
    if(!adj&&!lined)return false;
    if(!canEscape(w,ptx,pty,blastAt(w,ptx,pty,p.range)))return false;
    return true;
   }
  function tryPlantBrick(w,p,ptx,pty){
    if(w.bombs.length>=p.bombs)return false;
    let brick=false;
    for(const d of DIRS4)
      if(w.grid[key(ptx+d.x,pty+d.y)]===T.BRICK){brick=true;break;}
    if(!brick||!usefulBlast(w,ptx,pty,p.range))return false;
    if(!canEscape(w,ptx,pty,blastAt(w,ptx,pty,p.range)))return false;
    return true;
   }
  /* joy: a plant whose tile-extended blast (CONVEYOR delivery / BOOSTER
     relay) holds a foe or a brick the plain blast does not reach */
  function tryPlantTile(w,p,ptx,pty){
    if(w.bombs.length>=p.bombs||w.grid[key(ptx,pty)]!==T.EMPTY)return false;
    if(w.bombs.some(b=>b.tx===ptx&&b.ty===pty))return false;
    const plain=new Set([key(ptx,pty)]);
    for(const dir of DIRS4)for(let i=1;i<=p.range;i++){
      const x=ptx+dir.x*i,y=pty+dir.y*i,v=w.grid[key(x,y)];
      if(v===undefined||v===T.WALL)break;
      plain.add(key(x,y));
      if(v===T.BRICK)break;
     }
    const ext=blastAt(w,ptx,pty,p.range);
    let gain=false;
    for(const k of ext){
      if(plain.has(k))continue;
      if(w.grid[k]===T.BRICK||w.enemies.some(e=>!e.dead&&key(e.tx,e.ty)===k)){gain=true;break;}
     }
    if(!gain)return false;
    return canEscape(w,ptx,pty,ext);
   }
  function nearestFeat(w,ptx,pty,pred,maxd){
    let best=null,bd=maxd+1;
    for(let k=0;k<w.feat.length;k++){
      if(!pred(w.feat[k],k)||w.grid[k]!==T.EMPTY)continue;
      const x=k%CFG.COLS,y=(k/CFG.COLS)|0,d=Math.abs(x-ptx)+Math.abs(y-pty);
      if(d>0&&d<bd){bd=d;best={tx:x,ty:y};}
     }
    return best;
   }
  /* joy: chased by a hunter (<= 5 steps), step toward an idle TRAP within 4 */
  function lureHop(w,ptx,pty,ne,nd,danger,blocked,onBomb,deep){
    if(!ne||!ne.hunt||nd>5||w.featT<prof(w).plate.inert)return null;
    const t=nearestFeat(w,ptx,pty,(v,k)=>v===7&&w.featM[k]===0&&!danger.has(k),4);
    if(!t)return null;
    const hop=hopToward(w,ptx,pty,t.tx,t.ty,blocked);
    if(!hop||foeAt(w,ptx+hop.x,pty+hop.y)
      ||!walkOk(w,ptx,pty,ptx+hop.x,pty+hop.y,danger,onBomb,deep))return null;
    return {hop,t};
   }

  function wanderDir(w,ptx,pty,danger,onBomb,deep,aim){
    if(aim){
      let best=null,bd=99;
      for(const d of DIRS4){
        const nx=ptx+d.x,ny=pty+d.y;
        if(!walkOk(w,ptx,pty,nx,ny,danger,onBomb,deep))continue;
        const md=Math.abs(nx-aim.tx)+Math.abs(ny-aim.ty);
        if(md<bd){bd=md;best=d;}
       }
      return best;
     }
    for(let i=0;i<8;i++){
      const d=DIRS4[rng.int(0,3)],nx=ptx+d.x,ny=pty+d.y;
      if(walkOk(w,ptx,pty,nx,ny,danger,onBomb,deep))return d;
     }
    return null;
   }

  function intent(world){
    const p=world.players[0];
    if(world.state!=="PLAY"||!p.alive){
      latch=false;esc=false;hold=0;pause=0;mode=0;
      return NOOP;
     }
    const ptx=p.tx,pty=p.ty;
    const danger=dangerTiles(world);
    const onBomb=world.bombs.some(b=>b.tx===ptx&&b.ty===pty);
    if(onBomb)esc=true;
    if(!world.bombs.length)esc=false;
    const inPocket=danger.has(key(ptx,pty));
    const hug=hugging(ptx,pty,danger);
    const deep=!inPocket&&!hug;
    const blocked=new Set(danger);
    for(const b of world.bombs)
      if(!(b.tx===ptx&&b.ty===pty))blocked.add(key(b.tx,b.ty));
    const out={move:{x:0,y:0},fire:false,firePrev:latch,
      shift:false,remote:false,kick:false};
    let want=false;

    if(inPocket||(esc&&(onBomb||hug))){
      const m=fleeMove(world,ptx,pty,danger);
      if(m)out.move=m;
      mode=inPocket?1:2;hold=0;
     }else{
      if(esc){esc=false;pause=rng.int(4,10);hold=0;}
      if(pause>0)pause--;
      else{
        const held=hold>0&&(hx||hy)
          &&walkOk(world,ptx,pty,ptx+hx,pty+hy,danger,onBomb,deep);
        if(held){out.move={x:hx,y:hy};hold--;}
        else{
          hold=0;
          const item=pickItem(world,ptx,pty,blocked);
          const {ne,nd}=nearestFoe(world,ptx,pty);
          const tm=rulesOn(world);
          const lure=tm&&!item?lureHop(world,ptx,pty,ne,nd,danger,blocked,onBomb,deep):null;
          if(item){
            const t=tileOfItem(item);
            const hop=hopToward(world,ptx,pty,t.x,t.y,blocked)
              ||hopToward(world,ptx,pty,t.x,t.y,null);
            if(hop&&walkOk(world,ptx,pty,ptx+hop.x,pty+hop.y,danger,onBomb,deep)){
              out.move=hop;adopt(hop.x,hop.y,24,3,t.x,t.y);
             }
           }else if(tm&&tryPlantTile(world,p,ptx,pty)){
            want=true;esc=true;mode=8;gx=ptx;gy=pty;
           }else if(lure){
            out.move=lure.hop;adopt(lure.hop.x,lure.hop.y,10,7,lure.t.tx,lure.t.ty);
           }else if(ne&&tryPlantFoe(world,p,ptx,pty,ne,nd)){
            want=true;esc=true;mode=4;gx=ne.tx;gy=ne.ty;
           }else if(ne){
            const hop=hopToward(world,ptx,pty,ne.tx,ne.ty,blocked)
              ||hopToward(world,ptx,pty,ne.tx,ne.ty,null);
            if(hop&&!foeAt(world,ptx+hop.x,pty+hop.y)
              &&walkOk(world,ptx,pty,ptx+hop.x,pty+hop.y,danger,onBomb,deep)){
              out.move=hop;adopt(hop.x,hop.y,20,4,ne.tx,ne.ty);
             }else if(tryPlantBrick(world,p,ptx,pty)){
              want=true;esc=true;mode=5;gx=ptx;gy=pty;
             }else{
              const belt=tm?nearestFeat(world,ptx,pty,isBelt,6):null;
              const d=wanderDir(world,ptx,pty,danger,onBomb,deep,belt||ne);
              if(d){
                if(rng.next()<0.22)pause=rng.int(6,14);
                else{out.move={x:d.x,y:d.y};adopt(d.x,d.y,rng.int(18,42),6,0,0);}
               }
             }
           }else{
            const d=wanderDir(world,ptx,pty,danger,onBomb,deep,null);
            if(d){
              if(rng.next()<0.22)pause=rng.int(6,14);
              else{out.move={x:d.x,y:d.y};adopt(d.x,d.y,rng.int(18,42),6,0,0);}
             }
           }
         }
        if(!want&&!inPocket){
          const {ne,nd}=nearestFoe(world,ptx,pty);
          if(ne&&tryPlantFoe(world,p,ptx,pty,ne,nd)){
            want=true;esc=true;out.move={x:0,y:0};
           }
         }
       }
     }

    const mx=out.move.x,my=out.move.y;
    if(mx||my){
      const nx=ptx+mx,ny=pty+my;
      const reenter=world.bombs.some(b=>b.tx===nx&&b.ty===ny)&&!onBomb;
      if(reenter||foeAt(world,nx,ny))out.move={x:0,y:0};
      else if(!inPocket&&!onBomb&&danger.has(key(nx,ny)))out.move={x:0,y:0};
      else if(deep&&world.bombs.length&&hugging(nx,ny,danger))out.move={x:0,y:0};
     }

    const prev=latch;
    out.fire=want&&!prev&&!inPocket;
    out.firePrev=prev;
    latch=want;
    if(out.fire)esc=true;
    return out;
   }

  return {intent,
    get state(){return {rng:rng.state,latch,mode,gx,gy,hx,hy,hold,pause,esc};},
    set state(v){
      rng.state=v.rng>>>0;latch=!!v.latch;
      mode=v.mode|0;gx=v.gx|0;gy=v.gy|0;hx=v.hx|0;hy=v.hy|0;
      hold=v.hold|0;pause=v.pause|0;esc=!!v.esc;
     }};
 }
