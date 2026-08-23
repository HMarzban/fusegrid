import {step, createWorld, loadLevel, newIntent} from "../src/core/sim.js";
import {CFG, key} from "../src/core/config.js";
import {createRng} from "../src/core/rng.js";

let pass=0, fail=0;
const check=(n,c,d)=>{c?pass++:fail++;console.log((c?"  PASS ":"  FAIL ")+n+(d?" -> "+d:""))};

// --- RNG contract ---
{
  const a=createRng(12345), b=createRng(12345);
  let eq=true;
  for(let i=0;i<10000;i++){ if(a.next()!==b.next()){eq=false;break;} }
  check("same seed => identical 10k sequence", eq);
  const lo=createRng(7), bounds=[Infinity,-Infinity]; let inB=true;
  for(let i=0;i<1000;i++){ const v=lo.int(2,5); if(v<2||v>5)inB=false;
    bounds[0]=Math.min(bounds[0],v); bounds[1]=Math.max(bounds[1],v); }
  check("int(2,5) within bounds, hits endpoints", inB && bounds[0]===2 && bounds[1]===5);
  const s=createRng(9); s.next(); s.next();
  const saved=s.state; const seq1=Array.from({length:10},()=>s.next());
  s.state=saved; const seq2=Array.from({length:10},()=>s.next());
  check("state save/restore resumes sequence", seq1.every((v,i)=>v===seq2[i]));
}

// --- full-state replay equality ---
function sameWorld(x,y){
  if(x.grid.length!==y.grid.length)return false;
  for(let i=0;i<x.grid.length;i++) if(x.grid[i]!==y.grid[i])return false;
  if(x.rng.state!==y.rng.state)return false;
  if(x.state!==y.state)return false;
  const p0=x.players[0], p1=y.players[0];
  if(p0.x!==p1.x||p0.y!==p1.y)return false;
  if(x.enemies.length!==y.enemies.length)return false;
  for(let i=0;i<x.enemies.length;i++){
    const a=x.enemies[i], b=y.enemies[i];
    if(a.x!==b.x||a.y!==b.y||a.tx!==b.tx||a.ty!==b.ty)return false;
    if(a.dir.x!==b.dir.x||a.dir.y!==b.dir.y)return false;
    if(a.type!==b.type||a.dead!==b.dead)return false;
    if(a.home.x!==b.home.x||a.home.y!==b.home.y)return false;
  }
  if(x.bombs.length!==y.bombs.length)return false;
  for(let i=0;i<x.bombs.length;i++){
    const a=x.bombs[i], b=y.bombs[i];
    if(a.x!==b.x||a.y!==b.y||a.timer!==b.timer||a.tx!==b.tx||a.ty!==b.ty
      ||a.radius!==b.radius||a.variant!==b.variant||a.dead!==b.dead)return false;
  }
  if(x.items.length!==y.items.length)return false;
  for(let i=0;i<x.items.length;i++){
    const a=x.items[i], b=y.items[i];
    if(a.x!==b.x||a.y!==b.y||a.taken!==b.taken)return false;
  }
  return x.score===y.score && x.lives===y.lives && x.tick===y.tick;
}
function script(i){
  const moves=[{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}];
  const it=newIntent();
  it.move=moves[i%4];
  it.fire=(i%37===0); it.firePrev=(i%37===1);
  it.shift=(i%53===0);
  return {0:it};
}
const HORIZON=1800;
function run(seed){
  const w=createWorld(seed,1); loadLevel(w,1,false); w.state="PLAY";
  for(let i=0;i<HORIZON;i++) step(w, CFG.STEP, script(i));
  return w;
}
{
  for(const seed of [20260823, 777, 424242]){
    const A=run(seed), B=run(seed);
    check(HORIZON+"-tick mixed-input replay (seed "+seed+"): full-state equal", sameWorld(A,B));
  }
}

// --- self-proof: horizon actually exercises AI direction decisions ---
{
  const w=createWorld(20260823,1); loadLevel(w,1,false); w.state="PLAY";
  const prev=new Map(w.enemies.map(e=>[e.home.x+","+e.home.y, e.dir.x+","+e.dir.y]));
  let changes=0;
  for(let i=0;i<HORIZON && changes===0;i++){
    step(w, CFG.STEP, script(i));
    for(const e of w.enemies){
      const k=e.home.x+","+e.home.y, cur=e.dir.x+","+e.dir.y;
      if(prev.get(k)!==cur){ changes++; prev.set(k,cur); }
    }
  }
  check("replay horizon sees AI decisions (>=1 enemy dir change)", changes>0,
    "changes="+changes+" within "+HORIZON+" ticks");
}

console.log(fail? "DETERMINISM FAIL":"DETERMINISM OK");
process.exit(fail?1:0);
