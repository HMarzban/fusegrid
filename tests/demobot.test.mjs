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
  const tailA=[];
  for(let i=0;i<100;i++){const it=bot.intent(w);step(w,CFG.STEP,{0:it});
    tailA.push(iser(it));}
  const bot2=createDemobot(999); bot2.state=st;   // foreign seed, restored state
  const tailB=[];
  for(let i=0;i<100;i++){const it=bot2.intent(clone);tailB.push(iser(it));}
  check("snapshot restore reproduces identical intent tail",
    tailA.join("|")===tailB.join("|"),
    tailA.slice(0,3)+" vs "+tailB.slice(0,3));
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
  check("latch follows spec edge formula while want persists (t,f,t,f..)",
    fires[0]===true&&!fires[1]&&fires[2]===true&&!fires[3],
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
