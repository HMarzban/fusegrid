import {step, createWorld, loadLevel, newIntent} from "../src/core/sim.js";
import {CFG, T, key} from "../src/core/config.js";
import {createRng} from "../src/core/rng.js";
import "../src/core/board3.js";

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
  if(p0.tx!==p1.tx||p0.ty!==p1.ty||p0.bombs!==p1.bombs||p0.range!==p1.range
    ||p0.iFrames!==p1.iFrames||p0.shield!==p1.shield||p0.bombKind!==p1.bombKind
    ||p0.passing!==p1.passing||p0.kick!==p1.kick||p0.throw!==p1.throw
    ||p0.remote!==p1.remote)return false;
  if(x.enemies.length!==y.enemies.length)return false;
  for(let i=0;i<x.enemies.length;i++){
    const a=x.enemies[i], b=y.enemies[i];
    if(a.x!==b.x||a.y!==b.y||a.tx!==b.tx||a.ty!==b.ty)return false;
    if(a.dir.x!==b.dir.x||a.dir.y!==b.dir.y)return false;
    if(a.type!==b.type||a.dead!==b.dead)return false;
    if(a.home.x!==b.home.x||a.home.y!==b.home.y)return false;
    if(a.cd!==b.cd||a.invulnT!==b.invulnT||a.speed!==b.speed||a.pass!==b.pass)return false;
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
  return x.score===y.score && x.lives===y.lives && x.tick===y.tick
    && x.winTimer===y.winTimer
    && bladesEq(x.blades,y.blades)
    && tilesEq(x,y);
}
function bladesEq(a,b){
  if(a.length!==b.length)return false;
  for(let i=0;i<a.length;i++){
    if(a[i].t!==b[i].t||a[i].ttl!==b[i].ttl||a[i].variant!==b[i].variant
      ||a[i].src!==b[i].src||a[i].spare!==b[i].spare||a[i].safe!==b[i].safe)return false;
  }
  return true;
}
// the floor-tile state: the layer, the per-cell clocks, the pending list, QUICKSAND, the per-entity fields
const cellsEq=(a,b)=>(!a||!b)?!a===!b:a.length===b.length&&a.every((v,i)=>v===b[i]);
const js=v=>JSON.stringify(v===undefined?null:v);
const fieldsEq=(a,b,ks)=>ks.every(k=>js(a[k])===js(b[k]));
const P_TILE=["gl","glBuf","warpK","beltT"], E_TILE=["warpK","warpHold","warpFrom","warpX","warpY","plateK","beltT"], B_TILE=["carry","slide","prog","warpK","chainSrc"];
function tilesEq(x,y){
  if(!cellsEq(x.feat,y.feat)||!cellsEq(x.featPair,y.featPair)||!cellsEq(x.featS,y.featS)||!cellsEq(x.featM,y.featM))return false;
  if(x.feat&&!fieldsEq(x,y,["featT","featN","featTier","featPend"]))return false;
  if(js(x.quick&&x.quick.list)!==js(y.quick&&y.quick.list))return false;
  return x.players.every((p,i)=>fieldsEq(p,y.players[i],P_TILE))
    && x.enemies.every((e,i)=>fieldsEq(e,y.enemies[i],E_TILE))
    && x.bombs.every((b,i)=>fieldsEq(b,y.bombs[i],B_TILE));
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

{
  const w=createWorld(20260823,1); loadLevel(w,1,false); w.state="PLAY";
  let diag=0;
  for(let i=0;i<HORIZON;i++){
    step(w, CFG.STEP, script(i));
    for(const e of w.enemies){
      if(e.dir.x&&e.dir.y)diag++;
    }
  }
  check("COULD 6: enemy dirs stay 4-way (no diagonal)", diag===0, "diag="+diag);
}

// --- gen 3: replay on every tile room, every heat, mixed input ---
/* A walker that never reaches a tile proves nothing, and a spawn pocket is sealed,
   so the script also VISITS: every VISIT ticks it sets the player beside a tile,
   walking at it, plants there, and drops a live foe onto a tile; every third visit
   is a lure instead, see lure(). All of it comes
   from one LCG over a fixed seed, so A and B get the same moves (one run after the
   other, as run() does, so module state would leak too). Each tick folds the events
   and every 60 ticks the WHOLE world JSON into a trace, so a field nobody listed
   in sameWorld still shows. A WIN / LOSE reloads the room, which replays a reset. */
const G3_HORIZON=2400, VISIT=120, MV=[{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1},{x:0,y:0}];
const ROOM_TILE=["","BOOSTER","ICE PATCH","CONVEYOR","STREAM","TRAP","QUICKSAND","PORTAL","GATE"];
const fold=(h,s)=>{ for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; };
function g3World(seed,room,heat){
  const w=createWorld(seed,room); w.gen=3; w.heat=heat; loadLevel(w,room,false); w.state="PLAY";
  w.lives=99; w.players[0].bombs=4; w.players[0].range=2;
  return w;
}
function visit(w,next){
  const open=[]; w.feat.forEach((v,k)=>{ if(v&&w.grid[k]===T.EMPTY)open.push(k); });
  if(!open.length)return null;
  const k=open[next()%open.length], tx=k%CFG.COLS, ty=(k/CFG.COLS)|0, p=w.players[0];
  const nb=MV.slice(0,4).map((m,i)=>MV[(i+next())%4]).find(m=>w.grid[key(tx-m.x,ty-m.y)]===T.EMPTY);
  if(p.alive&&nb){ p.x=(tx-nb.x+0.5)*CFG.TILE; p.y=(ty-nb.y+0.5)*CFG.TILE; p.tx=tx-nb.x; p.ty=ty-nb.y; p.gl=null; p.glBuf=null; }
  const foes=w.enemies.filter(e=>!e.dead&&e.speed>0);
  if(foes.length){ const e=foes[next()%foes.length], f=open[next()%open.length]; e.x=(f%CFG.COLS+0.5)*CFG.TILE; e.y=(((f/CFG.COLS)|0)+0.5)*CFG.TILE; e.tx=f%CFG.COLS; e.ty=(f/CFG.COLS)|0; }
  return nb||null;
}
/* a TRAP arms for a foe with the player near but off its lines: stand two tiles off on a diagonal and hold fire */
function lure(w,next){
  const open=[]; w.feat.forEach((v,k)=>{ if(v&&w.grid[k]===T.EMPTY)open.push(k); });
  const foes=w.enemies.filter(e=>!e.dead&&e.speed>0), p=w.players[0];
  if(!open.length||!foes.length||!p.alive)return;
  const f=open[next()%open.length], fx=f%CFG.COLS, fy=(f/CFG.COLS)|0, e=foes[next()%foes.length];
  const spot=[[2,2],[-2,2],[2,-2],[-2,-2]].map(([dx,dy])=>[fx+dx,fy+dy]).find(([x,y])=>x>0&&y>0&&x<CFG.COLS-1&&y<CFG.ROWS-1&&w.grid[key(x,y)]===T.EMPTY);
  if(!spot)return;
  e.x=(fx+0.5)*CFG.TILE; e.y=(fy+0.5)*CFG.TILE; e.tx=fx; e.ty=fy;
  p.x=(spot[0]+0.5)*CFG.TILE; p.y=(spot[1]+0.5)*CFG.TILE; p.tx=spot[0]; p.ty=spot[1]; p.gl=null; p.glBuf=null;
}
function runG3(seed,room,heat){
  const w=g3World(seed,room,heat), seen=new Set(), counts={};
  let s=(seed^room*40503^heat*7)>>>0||1, m=MV[4], until=0, quiet=0, h=0x811c9dc5, reloads=0;
  const next=()=>{ s=(Math.imul(s,1664525)+1013904223)>>>0; return s>>>16; };
  for(let i=0;i<G3_HORIZON;i++){
    const it=newIntent();
    if(i%(VISIT*3)===VISIT&&w.state==="PLAY"){ lure(w,next); m=MV[4]; until=quiet=i+VISIT; }
    else if(i%VISIT===0&&w.state==="PLAY"){ const a=visit(w,next); if(a){ m=a; until=i+40; it.fire=true; } }
    else if(i>=until){ m=MV[next()%5]; until=i+8+next()%40; }
    it.move=m; it.fire=it.fire||(i>=quiet&&i%29===0); it.shift=i%53===0; it.remote=i%97===0;
    step(w,CFG.STEP,{0:it});
    for(const e of w.events){ if(e.t==="warp")seen.add("warp_"+e.who); }
    h=fold(h,JSON.stringify(w.events)); w.events.length=0;
    if(i%60===0)h=fold(h,JSON.stringify(w));
    const p=w.players[0];
    if(w.feat)for(let k=0;k<w.feat.length;k++)if(w.featM[k])seen.add("M"+(w.feat[k]));
    if(p.gl)seen.add("gl");
    if(w.bombs.some(b=>b.carry))seen.add("carry");
    if(p.beltT!=null||w.enemies.some(e=>e.beltT!=null))seen.add("ride");
    if(w.quick&&w.quick.list.some(q=>q.st>=2))seen.add("quick");
    if(w.state!=="PLAY"){ reloads++; const b=p.bombs, r=p.range; loadLevel(w,room,false); w.state="PLAY"; w.lives=99; p.bombs=b; p.range=r; }
  }
  return {w,h,seen,reloads};
}
const WANT=[null,
  ()=>["M6"],
  (h)=>h?["gl"]:[],                // CORE ICE has coast 0: no p.gl to see, its speed reaches the replay through p.x
  (h)=>h?["carry","ride"]:["carry"], // CORE CONVEYOR carries bombs only
  ()=>["carry"],
  ()=>["M7"],
  ()=>["quick"],
  (h)=>h===2?["warp_you","warp_foe"]:["warp_you"],
  ()=>["M14"],
];
const G3_SEEDS=[20261102,4242];
let g3last=null;
for(let room=1;room<=8;room++) for(let heat=0;heat<3;heat++){
  const seen=new Set(); let eq=true, tiles=true, tr="";
  for(const seed of G3_SEEDS){
    const A=runG3(seed,room,heat), B=runG3(seed,room,heat);
    if(!sameWorld(A.w,B.w)||A.h!==B.h)eq=false;
    if(!A.w.feat||!A.w.feat.some(Boolean))tiles=false;
    A.seen.forEach(v=>seen.add(v));
    tr+=A.h.toString(16)+" ";
    g3last=A;
  }
  const want=WANT[room](heat), miss=want.filter(k=>!seen.has(k));
  check("gen 3 room "+room+" "+ROOM_TILE[room]+" heat "+heat+": "+G3_HORIZON+"-tick replay equal, world JSON trace too", eq, tr);
  check("gen 3 room "+room+" heat "+heat+": the replay reached the tile ("+(want.join("+")||"layer only")+")", tiles&&!miss.length, "seen "+[...seen].sort().join()+(miss.length?" MISSING "+miss:""));
}

// --- self-proof: sameWorld sees every tile field, or the replays above prove nothing ---
{
  const a=runG3(4242,7,2).w, b=runG3(4242,7,2).w;
  check("mutation proof: starts equal", sameWorld(a,b));
  const proof=(name,mut,undo)=>{ mut(); const d=sameWorld(a,b); undo(); check("mutation proof: "+name+" makes sameWorld false", !d); };
  const k=b.feat.findIndex(Boolean), arr=(f,n)=>{ const v=b[f][k]; proof(n,()=>{ b[f][k]=v+1; },()=>{ b[f][k]=v; }); };
  arr("feat","the tile layer"); arr("featPair","a portal pair"); arr("featS","a tile clock (featS)"); arr("featM","a tile mode (featM)");
  const t=b.featT; proof("the tile clock featT",()=>{ b.featT=t+0.25; },()=>{ b.featT=t; });
  const n=b.featN; proof("the trigger id featN",()=>{ b.featN=(n|0)+1; },()=>{ b.featN=n; });
  proof("a pending tile blast",()=>{ b.featPend.push({k,kind:"plate",by:"walker"}); },()=>{ b.featPend.pop(); });
  const p=b.players[0];
  proof("the player's warp latch",()=>{ p.warpK=-7; },()=>{ p.warpK=a.players[0].warpK; });
  proof("the player's glide",()=>{ p.gl={x:1,y:0}; },()=>{ p.gl=a.players[0].gl; });
  const e=b.enemies[0], ea=a.enemies[0];
  proof("a foe's warp hold",()=>{ e.warpHold=9; },()=>{ e.warpHold=ea.warpHold; });
  proof("a foe's trap id",()=>{ e.plateK=9; },()=>{ e.plateK=ea.plateK; });
  const qa=runG3(4242,6,2).w, qb=runG3(4242,6,2).w, q=qb.quick.list[0], st=q.st;
  check("mutation proof: QUICKSAND run starts equal", sameWorld(qa,qb));
  q.st=st===4?3:4; check("mutation proof: a QUICKSAND life state makes sameWorld false", !sameWorld(qa,qb)); q.st=st;
  q.t+=0.25; check("mutation proof: a QUICKSAND timer makes sameWorld false", !sameWorld(qa,qb));
}

console.log(fail? "DETERMINISM FAIL":"DETERMINISM OK");
process.exit(fail?1:0);
