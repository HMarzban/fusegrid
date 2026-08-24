/* ATTRACT-MODE DEMO BOT — deterministic AI that drives the attract demo world
   (spec §2). Pure: reads world fields only, owns a private mulberry32 stream,
   no wall-clock, no PRNG outside that stream, no DOM; state is serializable so
   replays can snapshot and restore it. Mirrors the sim's computeBlast footprint inline (cross walk with
   wall/brick blocking) instead of importing from src/core/sim.js, keeping the
   sim's blast logic the single source of truth for DAMAGE while the bot only
   approximates DANGER for navigation.
   intent(world) order: NOOP guard -> danger map -> flee -> bomb-in-line ->
   BFS chase -> seeded wander. Fire uses a press-edge latch mirroring the sim's
   fire/firePrev contract so holding "want" never double-places bombs. */
import {CFG,T,key,DIRS4} from "../core/config.js";
import {bfsNext} from "../core/board.js";
import {createRng} from "../core/rng.js";

export const NOOP=Object.freeze({move:{x:0,y:0},fire:false,firePrev:false,
  shift:false,remote:false,kick:false});

export function createDemobot(seed){
  let rng=createRng(seed>>>0),latch=false;

  /* every tile currently inside a live bomb's future blast (plus the bomb
     tiles themselves) or an active blade sweep */
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
    return danger;
   }

  /* BFS through EMPTY tiles (danger tiles are walkable, just not destinations);
     first non-danger tile reached wins -> single-axis step toward it via the
     recorded parent chain. Deterministic: DIRS4 expansion order. */
  function fleeMove(w,ptx,pty,danger){
    const prev=new Map(),seen=new Set([key(ptx,pty)]),q=[[ptx,pty]];
    while(q.length){
      const [x,y]=q.shift();
      for(const d of DIRS4){
        const nx=x+d.x,ny=y+d.y,k=key(nx,ny);
        if(nx<0||ny<0||nx>=CFG.COLS||ny>=CFG.ROWS)continue;
        if(seen.has(k)||w.grid[k]!==T.EMPTY)continue;
        seen.add(k); prev.set(k,key(x,y));
        if(!danger.has(k)){
          let cur=k;
          while(prev.get(cur)!==key(ptx,pty))cur=prev.get(cur);
          const hx=cur%CFG.COLS,hy=Math.floor(cur/CFG.COLS);
          return {x:Math.sign(hx-ptx),y:Math.sign(hy-pty)};
         }
        q.push([nx,ny]);
       }
     }
    return null;
   }

  /* clear straight line between two same-row/col tiles (endpoints excluded) */
  function lineClear(g,x0,y0,x1,y1){
    const dx=Math.sign(x1-x0),dy=Math.sign(y1-y0);
    let x=x0+dx,y=y0+dy;
    while(x!==x1||y!==y1){
      if(g[key(x,y)]!==T.EMPTY)return false;
      x+=dx;y+=dy;
     }
    return true;
   }

  function wander(g,ptx,pty){
    for(let i=0;i<8;i++){
      const d=DIRS4[rng.int(0,3)],nx=ptx+d.x,ny=pty+d.y;
      if(nx<0||ny<0||nx>=CFG.COLS||ny>=CFG.ROWS)continue;
      if(g[key(nx,ny)]===T.EMPTY)return {x:d.x,y:d.y};
     }
    return {x:0,y:0};
   }

  function intent(world){
    const p=world.players[0];
    if(world.state!=="PLAY"||!p.alive){latch=false;return NOOP;}
    const ptx=p.tx,pty=p.ty;
    const danger=dangerTiles(world);
    const out={move:{x:0,y:0},fire:false,firePrev:latch,
      shift:false,remote:false,kick:false};
    let want=false;
    if(danger.has(key(ptx,pty))){
      const m=fleeMove(world,ptx,pty,danger);
      if(m)out.move=m;
     }else{
      let ne=null,nd=Infinity;
      for(const e of world.enemies){
        if(e.dead)continue;
        const d=Math.abs(e.tx-ptx)+Math.abs(e.ty-pty);
        if(d<nd){nd=d;ne=e;}
       }
      if(ne){
        const dx=ne.tx-ptx,dy=ne.ty-pty;
        const adj=Math.abs(dx)+Math.abs(dy)===1;
        const lined=(dx===0||dy===0)&&nd<=p.range
          &&lineClear(world.grid,ptx,pty,ne.tx,ne.ty);
        if((adj||lined)&&world.bombs.length<p.bombs)want=true;
        if(!want){
          const hop=bfsNext(world.grid,ptx,pty,ne.tx,ne.ty,false);
          if(hop)out.move={x:Math.sign(hop.x-ptx),y:Math.sign(hop.y-pty)};
          else out.move=wander(world.grid,ptx,pty);
         }
       }else out.move=wander(world.grid,ptx,pty);
     }
    const prev=latch;
    out.fire=want&&!prev;
    out.firePrev=prev;
    latch=out.fire;
    return out;
   }

  return {intent,
    get state(){return {rng:rng.state,latch};},
    set state(v){rng.state=v.rng>>>0;latch=!!v.latch;}};
 }
