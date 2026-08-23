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
  if(x.enemies.length!==y.enemies.length)return false;
  for(let i=0;i<x.enemies.length;i++){
    const a=x.enemies[i], b=y.enemies[i];
    if(a.x!==b.x||a.y!==b.y||a.tx!==b.tx||a.ty!==b.ty)return false;
  }
  return x.score===y.score && x.lives===y.lives && x.tick===y.tick
      && x.bombs.length===y.bombs.length && x.items.length===y.items.length;
}
function script(i){
  const moves=[{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}];
  const it=newIntent();
  it.move=moves[i%4];
  it.fire=(i%37===0); it.firePrev=(i%37===1);
  it.shift=(i%53===0);
  return {0:it};
}
function run(seed){
  const w=createWorld(seed,1); loadLevel(w,1,false); w.state="PLAY";
  for(let i=0;i<300;i++) step(w, CFG.STEP, script(i));
  return w;
}
{
  const A=run(20260823), B=run(20260823);
  check("300-tick mixed-input replay: full-state equal", sameWorld(A,B));
}

console.log(fail? "DETERMINISM FAIL":"DETERMINISM OK");
process.exit(fail?1:0);
