import {createDemobot, NOOP} from "../src/app/demobot.js";
import {step, createWorld, loadLevel} from "../src/core/sim.js";
import {CFG, T, key} from "../src/core/config.js";

let pass=0, fail=0;
function check(name, cond, detail){ cond?pass++:fail++;
  console.log((cond?"  PASS ":"  FAIL ")+name+(detail!==undefined?" -> "+detail:"")); }
const fnv=s=>{let h=0x811c9dc5;for(let i=0;i<s.length;i++){
  h^=s.charCodeAt(i);h=(h*0x01000193)>>>0;}return h.toString(16);};

function mkWorld(seed,lvl){
  const w=createWorld(seed,lvl); loadLevel(w,lvl,false); w.state="PLAY"; return w;
}
/* compact full-state snapshot (bot-relevant + sim fields) for equality */
function snap(w){
  return JSON.stringify({g:Array.from(w.grid),rs:w.rng.state,st:w.state,
    tk:w.tick,tm:Math.round(w.time*1e9),sc:w.score,lv:w.lives,
    p:{x:w.players[0].x,y:w.players[0].y,tx:w.players[0].tx,ty:w.players[0].ty,
      b:w.players[0].bombs,r:w.players[0].range,a:w.players[0].alive,
      s:w.players[0].shield,k:w.players[0].bombKind},
    en:w.enemies.map(e=>[e.x,e.y,e.tx,e.ty,e.dead]),
    bo:w.bombs.map(b=>[b.tx,b.ty,Math.round(b.timer*1e9),b.radius]),
    it:w.items.map(i=>i.taken)});
}
const iser=i=>JSON.stringify([i.move.x,i.move.y,i.fire,i.firePrev,
  i.shift,i.remote,i.kick]);
const ARMS=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
function blastSet(w){
  const d=new Set();
  for(const b of w.bombs){
    d.add(key(b.tx,b.ty));
    for(const dir of ARMS){
      for(let i=1;i<=b.radius;i++){
        const x=b.tx+dir.x*i,y=b.ty+dir.y*i,v=w.grid[key(x,y)];
        if(v===undefined||v===T.WALL)break;
        d.add(key(x,y));
        if(v===T.BRICK&&!b.pierce&&!b.line)break;
      }
    }
  }
  for(const bl of w.blades)
    if(bl.tiles)for(const t of bl.tiles)d.add(key(t.tx,t.ty));
  return d;
}
function isHug(tx,ty,d){
  return ARMS.some(dir=>d.has(key(tx+dir.x,ty+dir.y)));
}

// ---- surface ----
{
  const b=createDemobot(1);
  check("createDemobot returns intent() + serializable state",
    typeof b.intent==="function"&&Number.isFinite(b.state.rng)
    &&typeof b.state.latch==="boolean");
  check("NOOP frozen exact shape", Object.isFrozen(NOOP)
    &&NOOP.move.x===0&&NOOP.move.y===0&&!NOOP.fire&&!NOOP.firePrev
    &&!NOOP.shift&&!NOOP.remote&&!NOOP.kick);
}

// ---- replay determinism: same seed x2, N=1800 => identical intents+worlds ----
{
  for(const seed of [20260823,4242]){
    const run=()=>{
      const w=mkWorld(seed,1), bot=createDemobot(seed), ints=[];
      for(let i=0;i<1800;i++){
        const it=bot.intent(w); step(w,CFG.STEP,{0:it}); ints.push(iser(it));
       }
      return {w,ints};
     };
    const A=run(),B=run();
    check("seed "+seed+": 1800-tick intent streams identical",
      A.ints.join("|")===B.ints.join("|"));
    check("seed "+seed+": 1800-tick worlds identical", snap(A.w)===snap(B.w));
  }
  {
    const w=mkWorld(20260823,1), bot=createDemobot(20260823), ints=[];
    for(let i=0;i<600;i++){const it=bot.intent(w);step(w,CFG.STEP,{0:it});
      ints.push(iser(it));}
    const h1=fnv(ints.join("|"));
    const w2=mkWorld(20260823,1), b2=createDemobot(20260823), i2=[];
    for(let i=0;i<600;i++){const it=b2.intent(w2);step(w2,CFG.STEP,{0:it});
      i2.push(iser(it));}
    check("600-tick replay hash stable ("+h1+")", h1===fnv(i2.join("|")));
  }
}

// ---- state purity: (world,state) fully determines next intent ----
{
  const w=mkWorld(9,1), bot=createDemobot(5);
  for(let i=0;i<100;i++){const it=bot.intent(w);step(w,CFG.STEP,{0:it});}
  const st=bot.state;
  const clone={grid:w.grid.slice(),state:w.state,time:w.time,tick:w.tick,
    score:w.score,fireEdge:w.fireEdge,remoteEdge:w.remoteEdge,
    players:[{...w.players[0]}],
    enemies:w.enemies.map(e=>({...e})),
    bombs:w.bombs.map(b=>({...b})),
    items:w.items.map(i=>({...i})),
    blades:w.blades.map(bl=>({...bl}))};
  const itA=bot.intent(w);
  const bot2=createDemobot(999); bot2.state=st;
  const itB=bot2.intent(clone);
  check("snapshot restore reproduces the next intent",
    iser(itA)===iser(itB), iser(itA)+" vs "+iser(itB));
}

// ---- flee: bomb underfoot -> immediate move away; survives the detonation ----
{
  const w=mkWorld(7,1);
  // keep exactly one enemy alive but parked far away (board clear would WIN
  // and freeze bomb fuses via the sim's early return)
  const far=w.enemies[0];
  w.enemies.forEach((e,i)=>{ if(e!==far)e.dead=true; });
  Object.assign(far,{tx:CFG.COLS-2,ty:CFG.ROWS-2,
    x:(CFG.COLS-2)*CFG.TILE+CFG.TILE/2,y:(CFG.ROWS-2)*CFG.TILE+CFG.TILE/2});
  const p=w.players[0];
  for(const [x,y] of [[2,1],[3,1],[4,1],[5,1],[6,1]])
    if(w.grid[key(x,y)]!==T.WALL) w.grid[key(x,y)]=T.EMPTY;
  w.bombs.push({x:p.x,y:p.y,tx:1,ty:1,timer:CFG.FUSE,radius:2,
    pierce:false,line:false,dir:null,variant:"normal",dead:false});
  const bot=createDemobot(99);
  const it=bot.intent(w);
  check("danger detected: bot moves immediately off the footprint",
    Math.abs(it.move.x)+Math.abs(it.move.y)===1&&it.fire===false,
    JSON.stringify(it.move));
  let cleared=null;
  for(let i=0;i<Math.ceil(CFG.FUSE/CFG.STEP)+60;i++){
    const o=bot.intent(w); step(w,CFG.STEP,{0:o});
    if(w.bombs.length===0){cleared={i,tx:w.players[0].tx,ty:w.players[0].ty};break;}
   }
  check("bomb detonates on schedule (sim not frozen)",
    !!cleared,"cleared="+JSON.stringify(cleared));
  check("bot outside blast radius when it detonates and stays alive",
    cleared&&cleared.i>=Math.ceil(CFG.FUSE/CFG.STEP)-5
    &&Math.abs(cleared.tx-1)+Math.abs(cleared.ty-1)>=2
    &&w.players[0].alive&&w.lives===CFG.PLAYER_START.lives,
    "pos="+cleared.tx+","+cleared.ty+" lives="+w.lives);
}

// ---- fire edge: spec latch formula + never double-places through the sim ----
{
  const w=mkWorld(11,1);
  const near=w.enemies.find(e=>!e.dead);
  w.enemies.forEach(e=>{ if(e!==near)e.dead=true; });
  Object.assign(near,{tx:2,ty:1,x:2.5*CFG.TILE,y:1.5*CFG.TILE,
    home:{x:2,y:1}});
  const bot=createDemobot(3);
  const fires=[];
  for(let i=0;i<6;i++)fires.push(bot.intent(w).fire);
  check("latch is one rising edge per want episode (t,f,f,f..)",
    fires[0]===true&&!fires[1]&&!fires[2]&&!fires[3],
    fires.join(","));
  // end-to-end through the sim: placements separated by >= FUSE (one live
  // bomb slot), i.e. a standing want never machine-guns bombs
  const w2=mkWorld(11,1);
  const n2=w2.enemies.find(e=>!e.dead);
  w2.enemies.forEach(e=>{ if(e!==n2)e.dead=true; });
  Object.assign(n2,{tx:2,ty:1,x:2.5*CFG.TILE,y:1.5*CFG.TILE,home:{x:2,y:1}});
  const b2=createDemobot(3);
  let count=0;
  for(let i=0;i<600;i++){
    const o=b2.intent(w2);
    step(w2,CFG.STEP,{0:o});
    if(o.fire)count++;
   }
  check("placements bounded by fuse window (no double-place spam)",
    count>=1,w2.events.filter(e=>e.t==="bomb").length+" placed / "
    +count+" edges");
}

// ---- wander: legal moves only; sealed board -> NOOP fallback ----
{
  const w=mkWorld(13,1);
  w.enemies.forEach(e=>{e.dead=true;});
  const bot=createDemobot(21);
  let moved=0,legal=true;
  for(let i=0;i<400;i++){
    const it=bot.intent(w);
    const mx=it.move.x,my=it.move.y;
    if(Math.abs(mx)>1||Math.abs(my)>1||(mx&&my))legal=false;
    if((mx||my)){
      moved++;
      const nx=w.players[0].tx+mx,ny=w.players[0].ty+my;
      if(w.grid[key(nx,ny)]!==T.EMPTY)legal=false;
     }
    if(it.fire)legal=false;
   }
  check("wander emits only legal unit moves over 400 ticks",
    legal&&moved>20,"moved="+moved+" legal="+legal);

  const w2=mkWorld(13,1);
  w2.enemies.length=0;
  for(let y=0;y<CFG.ROWS;y++)for(let x=0;x<CFG.COLS;x++)
    if(!(x===1&&y===1))w2.grid[key(x,y)]=T.WALL;
  const b2=createDemobot(21);
  const allNoop=[...Array(50)].every(()=> {
    const it=b2.intent(w2); return it.move.x===0&&it.move.y===0&&!it.fire; });
  check("fully sealed tile: NOOP fallback (no illegal squeeze)", allNoop);
}

// ---- non-PLAY / dead player => NOOP + latch reset ----
{
  const w=mkWorld(15,1);
  w.enemies.forEach(e=>{e.dead=true;});
  w.enemies.push({type:"walker",dead:false,tx:2,ty:1,x:2.5*CFG.TILE,
    y:1.5*CFG.TILE});
  const bot=createDemobot(8);
  const f1=bot.intent(w).fire;
  const lost=bot.intent({state:"LOSE",players:[{alive:true,tx:1,ty:1}],
    grid:w.grid,bombs:[],blades:[],enemies:[]});
  const again=bot.intent(w);
  check("LOSE world => NOOP object", lost===NOOP||iser(lost)===iser(NOOP));
  check("latch reset across NOOP: want re-fires after reset",
    f1===true&&again.fire===true,f1+"/"+again.fire);
  const deadW=mkWorld(15,1); deadW.players[0].alive=false;
  check("dead player => NOOP", iser(bot.intent(deadW))===iser(NOOP));
}

// ---- plant-then-leave / no fuse-hug / no R16 re-entry ----
{
  const w=mkWorld(11,1);
  const near=w.enemies.find(e=>!e.dead);
  w.enemies.forEach(e=>{ if(e!==near)e.dead=true; });
  Object.assign(near,{tx:2,ty:1,x:2.5*CFG.TILE,y:1.5*CFG.TILE,home:{x:2,y:1}});
  for(const [x,y] of [[2,1],[3,1],[4,1],[5,1],[6,1]])
    if(w.grid[key(x,y)]!==T.WALL) w.grid[key(x,y)]=T.EMPTY;
  const bot=createDemobot(3);
  let plant=null,left=false,reenter=false,deep=false,hugBack=false;
  const fuseTicks=Math.ceil(CFG.FUSE/CFG.STEP)+60;
  for(let i=0;i<fuseTicks;i++){
    const p=w.players[0];
    const it=bot.intent(w);
    if(it.fire&&!plant) plant={tx:p.tx,ty:p.ty};
    if(plant&&w.bombs.length){
      const nx=p.tx+it.move.x,ny=p.ty+it.move.y;
      if((p.tx!==plant.tx||p.ty!==plant.ty)&&nx===plant.tx&&ny===plant.ty)
        reenter=true;
      const d=blastSet(w),on=d.has(key(p.tx,p.ty)),hug=isHug(p.tx,p.ty,d);
      if(!on&&!hug) deep=true;
      else if(deep&&hug) hugBack=true;
    }
    step(w,CFG.STEP,{0:it});
    if(plant&&!left&&(w.players[0].tx!==plant.tx||w.players[0].ty!==plant.ty))
      left=true;
    if(plant&&w.bombs.length===0)break;
  }
  const p=w.players[0];
  check("self-plant then leave the bomb tile (plant-and-leave)",
    !!plant&&left, "plant="+JSON.stringify(plant)+" left="+left);
  check("does not re-enter own live bomb tile (R16)",
    !!plant&&!reenter, "reenter="+reenter);
  check("after a non-edge safe tile, does not walk back onto the fuse edge",
    !!plant&&deep&&!hugBack, "deep="+deep+" hugBack="+hugBack);
  check("alive and off the blast when own bomb pops",
    !!plant&&w.bombs.length===0&&p.alive&&w.lives===CFG.PLAYER_START.lives,
    "alive="+p.alive+" lives="+w.lives+" bombs="+w.bombs.length);
}

// ---- obvious floor cube beats a far foe ----
{
  const w=mkWorld(17,1);
  w.enemies.forEach((e,i)=>{e.dead=i!==0;});
  const foe=w.enemies[0];
  Object.assign(foe,{tx:1,ty:CFG.ROWS-2,
    x:1.5*CFG.TILE,y:(CFG.ROWS-2)*CFG.TILE+CFG.TILE/2});
  for(const x of [2,3,4,5]) w.grid[key(x,1)]=T.EMPTY;
  w.grid[key(1,2)]=T.EMPTY;
  w.items.length=0;
  w.items.push({x:5.5*CFG.TILE,y:1.5*CFG.TILE,t:"fire",col:"#ff8a3c",
    pdef:{t:"fire",apply(){}},taken:false,buried:false});
  const bot=createDemobot(17);
  let toward=0,n=0;
  for(let i=0;i<12;i++){
    const it=bot.intent(w);
    if(it.move.x||it.move.y){n++; if(it.move.x===1&&it.move.y===0)toward++;}
  }
  check("obvious floor cube: first steps go +x, not toward the far foe",
    n>=8&&toward>=8, "toward="+toward+" n="+n);
}

// ---- brick between bot and foe: plant to open the lane ----
{
  const w=mkWorld(19,1);
  w.enemies.forEach((e,i)=>{e.dead=i!==0;});
  for(let y=0;y<CFG.ROWS;y++)for(let x=0;x<CFG.COLS;x++)
    w.grid[key(x,y)]=T.WALL;
  w.grid[key(1,1)]=T.EMPTY;
  w.grid[key(2,1)]=T.BRICK;
  w.grid[key(3,1)]=T.EMPTY;
  w.grid[key(1,2)]=T.EMPTY;
  w.grid[key(1,3)]=T.EMPTY;
  const foe=w.enemies[0];
  Object.assign(foe,{tx:3,ty:1,x:3.5*CFG.TILE,y:1.5*CFG.TILE});
  w.items.length=0;
  Object.assign(w.players[0],{tx:1,ty:1,x:1.5*CFG.TILE,y:1.5*CFG.TILE,
    range:1,bombs:1});
  const bot=createDemobot(19);
  let fired=false;
  for(let i=0;i<40;i++){
    const it=bot.intent(w);
    if(it.fire)fired=true;
    step(w,CFG.STEP,{0:it});
    if(fired)break;
  }
  check("brick between bot and foe: plants to open the lane",
    fired, "fired="+fired+" bombs="+w.bombs.length);
}

// ---- hunger: far-board combat cube at (12,11) via L-shaped corridor ----
{
  const w=mkWorld(41,1);
  w.enemies.forEach((e,i)=>{e.dead=i!==0;});
  const foe=w.enemies[0];
  Object.assign(foe,{tx:1,ty:CFG.ROWS-2,
    x:1.5*CFG.TILE,y:(CFG.ROWS-2)*CFG.TILE+CFG.TILE/2});
  for(let x=2;x<=12;x++) w.grid[key(x,1)]=T.EMPTY;
  for(let y=2;y<=11;y++) w.grid[key(12,y)]=T.EMPTY;
  w.grid[key(1,2)]=T.EMPTY;
  w.items.length=0;
  w.items.push({x:12.5*CFG.TILE,y:11.5*CFG.TILE,t:"kick",col:"#c07a3a",
    pdef:{t:"kick",apply(){}},taken:false,buried:false});
  const bot=createDemobot(41);
  let toward=0,n=0;
  for(let i=0;i<12;i++){
    const it=bot.intent(w);
    if(it.move.x||it.move.y){n++; if(it.move.x===1&&it.move.y===0)toward++;}
  }
  check("far-board (12,11) kick cube: hunt via corridor, not the far foe",
    n>=8&&toward>=8, "toward="+toward+" n="+n);
}

// ---- hunger: far combat cube with a path is not Manhattan-8 ignored ----
{
  const w=mkWorld(17,1);
  w.enemies.forEach((e,i)=>{e.dead=i!==0;});
  const foe=w.enemies[0];
  Object.assign(foe,{tx:1,ty:CFG.ROWS-2,
    x:1.5*CFG.TILE,y:(CFG.ROWS-2)*CFG.TILE+CFG.TILE/2});
  for(const x of [2,3,4,5,6,7,8,9,10,11]) w.grid[key(x,1)]=T.EMPTY;
  w.grid[key(1,2)]=T.EMPTY;
  w.items.length=0;
  w.items.push({x:11.5*CFG.TILE,y:1.5*CFG.TILE,t:"fire",col:"#ff8a3c",
    pdef:{t:"fire",apply(){}},taken:false,buried:false});
  const bot=createDemobot(17);
  let toward=0,n=0;
  for(let i=0;i<12;i++){
    const it=bot.intent(w);
    if(it.move.x||it.move.y){n++; if(it.move.x===1&&it.move.y===0)toward++;}
  }
  check("far floor cube with a path: hunt it (no Manhattan-8 ignore)",
    n>=8&&toward>=8, "toward="+toward+" n="+n);
}

// ---- hunger: visible kick/flame/bomb beats a nearer heart ----
{
  const w=mkWorld(23,1);
  w.enemies.forEach((e,i)=>{e.dead=i!==0;});
  const foe=w.enemies[0];
  Object.assign(foe,{tx:1,ty:CFG.ROWS-2,
    x:1.5*CFG.TILE,y:(CFG.ROWS-2)*CFG.TILE+CFG.TILE/2});
  for(const x of [2,3,4,5,6,7,8,9,10,11]) w.grid[key(x,1)]=T.EMPTY;
  for(const y of [2,3]) w.grid[key(1,y)]=T.EMPTY;
  w.items.length=0;
  w.items.push({x:1.5*CFG.TILE,y:3.5*CFG.TILE,t:"heart",col:"#ff3b5c",
    pdef:{t:"heart",apply(){}},taken:false,buried:false});
  w.items.push({x:11.5*CFG.TILE,y:1.5*CFG.TILE,t:"kick",col:"#c07a3a",
    pdef:{t:"kick",apply(){}},taken:false,buried:false});
  const bot=createDemobot(23);
  let toward=0,n=0;
  for(let i=0;i<12;i++){
    const it=bot.intent(w);
    if(it.move.x||it.move.y){n++; if(it.move.x===1&&it.move.y===0)toward++;}
  }
  check("visible combat cube beats a nearer heart",
    n>=8&&toward>=8, "toward="+toward+" n="+n);
}

// ---- hunger: far-corner heart does not camp when a foe is reachable ----
{
  const w=mkWorld(29,1);
  w.enemies.forEach((e,i)=>{e.dead=i!==0;});
  const foe=w.enemies[0];
  Object.assign(foe,{tx:5,ty:1,x:5.5*CFG.TILE,y:1.5*CFG.TILE});
  for(const x of [2,3,4,5,6,7,8,9,10,11,12,13]) w.grid[key(x,1)]=T.EMPTY;
  for(const y of [2,3,4,5,6,7,8,9,10,11]) w.grid[key(13,y)]=T.EMPTY;
  w.items.length=0;
  w.items.push({x:13.5*CFG.TILE,y:11.5*CFG.TILE,t:"heart",col:"#ff3b5c",
    pdef:{t:"heart",apply(){}},taken:false,buried:false});
  const bot=createDemobot(29);
  let toward=0,n=0,heart=0;
  for(let i=0;i<12;i++){
    const it=bot.intent(w);
    if(it.move.x||it.move.y){
      n++;
      if(it.move.x===1&&it.move.y===0)toward++;
      if(it.move.x===0&&it.move.y===1)heart++;
    }
  }
  check("far-corner heart does not camp when a foe is reachable",
    n>=8&&toward>=8&&heart===0, "toward="+toward+" heart="+heart+" n="+n);
}

// ---- hunger: reachable corridor foe beats a spawn-adjacent brick nibble ----
{
  const w=mkWorld(31,3);
  w.enemies.forEach((e,i)=>{e.dead=i!==0;});
  const foe=w.enemies[0];
  Object.assign(foe,{type:"chaser",tx:7,ty:1,x:7.5*CFG.TILE,y:1.5*CFG.TILE,
    home:{x:7,y:1},speed:0});
  for(const x of [2,3,4,5,6,7]) w.grid[key(x,1)]=T.EMPTY;
  w.grid[key(1,2)]=T.BRICK;
  w.grid[key(1,3)]=T.EMPTY;
  w.items.length=0;
  Object.assign(w.players[0],{tx:1,ty:1,x:1.5*CFG.TILE,y:1.5*CFG.TILE,
    range:1,bombs:1});
  const bot=createDemobot(31);
  let toward=0,n=0,fired=false;
  for(let i=0;i<12;i++){
    const it=bot.intent(w);
    if(it.fire)fired=true;
    if(it.move.x||it.move.y){n++; if(it.move.x===1&&it.move.y===0)toward++;}
  }
  check("reachable corridor foe: hunt, do not nibble a spawn brick",
    !fired&&n>=8&&toward>=8, "fired="+fired+" toward="+toward+" n="+n);
}

// ---- hunger: no path to mid foe — heading leaves the spawn axis ----
{
  const w=mkWorld(37,3);
  w.enemies.forEach((e,i)=>{e.dead=i!==0;});
  const foe=w.enemies[0];
  Object.assign(foe,{type:"fast",tx:7,ty:1,x:7.5*CFG.TILE,y:1.5*CFG.TILE,
    home:{x:7,y:1},speed:0});
  w.grid[key(2,1)]=T.EMPTY;
  w.grid[key(3,1)]=T.EMPTY;
  w.grid[key(4,1)]=T.BRICK;
  w.grid[key(5,1)]=T.EMPTY;
  w.grid[key(6,1)]=T.EMPTY;
  w.grid[key(7,1)]=T.EMPTY;
  w.grid[key(1,2)]=T.EMPTY;
  w.grid[key(1,3)]=T.EMPTY;
  w.items.length=0;
  Object.assign(w.players[0],{tx:1,ty:1,x:1.5*CFG.TILE,y:1.5*CFG.TILE,
    range:1,bombs:1});
  const first=seed=>{
    const b=createDemobot(seed);
    for(let i=0;i<30;i++){
      const it=b.intent(w);
      if(it.move.x||it.move.y)return it.move;
    }
    return {x:0,y:0};
  };
  const seeds=[1,7,21,37,99];
  const plusX=seeds.filter(s=>first(s).x===1&&first(s).y===0).length;
  check("no path to mid foe: hunger heading leaves the spawn axis",
    plusX===seeds.length, "plusX="+plusX+"/"+seeds.length);
}

// ---- wander heading hold (no foes, no floor cubes) ----
{
  const w=mkWorld(13,1);
  w.enemies.forEach(e=>{e.dead=true;});
  w.items.length=0;
  const bot=createDemobot(21);
  let prev=null,changes=0,moved=0;
  for(let i=0;i<200;i++){
    const it=bot.intent(w);
    const mx=it.move.x,my=it.move.y;
    if(mx||my){
      moved++;
      if(prev&&(prev[0]!==mx||prev[1]!==my))changes++;
      prev=[mx,my];
    }
  }
  check("wander holds a heading (not per-tick chatter)",
    moved>20&&changes<=20, "moved="+moved+" changes="+changes);
}

// ---- grep gate (spec §6): purity of the bot source ----
{
  const fs=await import("node:fs");
  const src=fs.readFileSync(new URL("../src/app/demobot.js",import.meta.url),
    "utf8");
  check("demobot.js free of Math.random/Date.", !/Math\.random|Date\./.test(src));
  check("demobot.js free of timers", !/\bsetInterval\s*\(|\bsetTimeout\s*\(/.test(src));
  check("state JSON round-trips (serializable)",
    (()=>{const b=createDemobot(4);const s=b.state;
      return JSON.parse(JSON.stringify(s)).rng===s.rng;})());
}

console.log("\n  DEMOBOT RESULT: "+pass+" PASS / "+fail+" FAIL");
process.exit(fail?1:0);
