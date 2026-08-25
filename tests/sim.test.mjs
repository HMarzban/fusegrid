import {step, createWorld, newIntent, loadLevel} from "../src/core/sim.js";
import {spawnEnemy} from "../src/core/entities.js";
import {CFG,T,key} from "../src/core/config.js";
import {tileOf} from "../src/core/board.js";
import {Input} from "../src/input.js";

let pass=0, fail=0;
function check(name, cond, detail){ cond?pass++:fail++;
  console.log((cond?"  PASS ":"  FAIL ")+name+(detail!==undefined?" -> "+detail:"")); }

// ---- determinism: two fresh worlds + identical input => identical outcome ----
/* runSteps(seed, level, frames, inputFn) — inputFn(world, i, fireEdge) returns
   either a full inputs map ({0:intent}) or a bare intent for pid 0.
   fireEdge.prev mirrors pid-0's previous tick's post-step fire state, so
   generators can emit proper press edges (fire = !fireEdge.prev). */
function runSteps(seed, level, frames, inputFn){
  const w=createWorld(seed, level);
  loadLevel(w, level, false);
  w.state="PLAY";
  const inps={0:newIntent()};
  const fireEdge={prev:false};
  for(let i=0;i<frames;i++){
    const gen=inputFn(w, i, fireEdge);
    if(gen){
      if(gen[0]) inps[0]=gen[0];                 // full inputs map
      else { for(const k in gen) inps[0][k]=gen[k]; } // bare intent for pid 0
      if(inps[0].firePrev===undefined) inps[0].firePrev=inps[0].fire;
    }
    step(w, CFG.STEP, inps);
    inps[0].firePrev=inps[0].fire;
    fireEdge.prev=inps[0].fire;
  }
  return w;
}

// 1c) harness fireEdge actually tracks pid-0 fire across ticks
{
  let sawTrue=false;
  runSteps(12345, 1, 10, (w,i,fe)=>{
    sawTrue=sawTrue||fe.prev===true;
    const it=newIntent(); it.fire=(i<2);
    return {0:it};
  });
  check("runSteps fireEdge.prev mirrors prior-tick fire", sawTrue);
}

// 1b) the harness must actually deliver generated inputs
{
  const w=runSteps(12345, 1, 30, ()=>({0:{move:{x:1,y:0},fire:false,firePrev:false,shift:false,remote:false,kick:false}}));
  const w2=createWorld(12345,1); loadLevel(w2,1,false); w2.state="PLAY";
  const zero={0:newIntent()};
  for(let i=0;i<30;i++){ step(w2, CFG.STEP, zero); zero[0].firePrev=zero[0].fire; }
  check("harness feeds rightward input (x moved)", w.players[0].x>w2.players[0].x,
    w.players[0].x+" vs "+w2.players[0].x);
}

// 1) no-input determinism
const a=runSteps(12345, 1, 60, ()=>({0:{move:{x:0,y:0},fire:false,firePrev:false,shift:false,remote:false,kick:false}}));
const b=runSteps(12345, 1, 60, ()=>({0:{move:{x:0,y:0},fire:false,firePrev:false,shift:false,remote:false,kick:false}}));
check("deterministic no-input sim (score matches)", a.score===b.score, a.score+" vs "+b.score);
check("deterministic no-input sim (enemy count matches)", a.enemies.length===b.enemies.length, a.enemies.length+" vs "+b.enemies.length);

// 2) movement: hold RIGHT -> player x increases
{
  const w=createWorld(1,1); loadLevel(w,1,false); w.state="PLAY";
  const start=w.players[0].x;
  for(let i=0;i<30;i++) step(w,CFG.STEP,{0:{move:{x:1,y:0},fire:false,firePrev:false,shift:false,remote:false,kick:false}});
  check("player moves right", w.players[0].x>start+5, start.toFixed(1)+" -> "+w.players[0].x.toFixed(1));
}

// 3) border clamp: hold RIGHT + UP for many frames => stays inside board
{
  const w=createWorld(1,1); loadLevel(w,1,false); w.state="PLAY";
  for(let i=0;i<300;i++) step(w,CFG.STEP,{0:{move:{x:1,y:-1},fire:false,firePrev:false,shift:false,remote:false,kick:false}});
  const p=w.players[0];
  const xt=tileOf(p.x), yt=tileOf(p.y);
  check("player clamped inside border", xt>=1 && xt<=CFG.COLS-2 && yt>=1 && yt<=CFG.ROWS-2, "tile "+xt+","+yt);
}

// 4) blast kills an adjacent enemy
{
  const w=createWorld(1,1); loadLevel(w,1,false); w.state="PLAY";
  const p=w.players[0];
  const enemy=w.enemies[0];
  enemy.invuln=false; enemy.invulnT=0; enemy.speed=0;
  enemy.x=p.x+CFG.TILE; enemy.y=p.y;
  p.bombs=2;
  w.bombs.push({x:p.x,y:p.y,tx:tileOf(p.x),ty:tileOf(p.y),timer:0.01,radius:1,pierce:false,line:false,dir:null,variant:"normal",dead:false});
  for(let i=0;i<180;i++) step(w,CFG.STEP,{0:{move:{x:0,y:0},fire:false,firePrev:false,shift:false,remote:false,kick:false}});
  check("blast kills adjacent enemy", enemy.dead===true, "enemy.dead="+enemy.dead);
}

// 5) power-up pickup applies (+bomb)
{
  const w=createWorld(1,1); loadLevel(w,1,false); w.state="PLAY";
  const p=w.players[0];
  if(w.items.length){
    const it=w.items[0]; it.pdef={t:"bomb",apply:(ww,pl)=>pl.bombs++};
    it.x=p.x; it.y=p.y;
    const before=p.bombs;
    step(w,CFG.STEP,{0:{move:{x:0,y:0},fire:false,firePrev:false,shift:false,remote:false,kick:false}});
    check("power-up walk-over +1 bomb", p.bombs===before+1, before+" -> "+p.bombs);
  } else check("power-up walk-over +1 bomb", false, "no items");
}

// 6) board clear -> WIN state; fire edge advances with carry
{
  const w=createWorld(1,1); loadLevel(w,1,false);
  w.enemies.forEach(e=>e.dead=true);
  w.state="PLAY";
  const level0=w.level;
  // fewer than WIN_DELAY
  for(let i=0;i<50;i++) step(w,CFG.STEP,{0:{move:{x:0,y:0},fire:false,firePrev:false,switch:false,shift:false,remote:false,kick:false}});
  check("not advanced before WIN_DELAY", w.state==="PLAY" && w.level===level0, "level "+w.level);
  for(let i=0;i<150;i++) step(w,CFG.STEP,{0:{move:{x:0,y:0},fire:false,firePrev:false,shift:false,remote:false,kick:false}});
  check("board clear enters WIN state", w.state==="WIN");
  check("win event emitted", w.events.some(e=>e.t==="win"));
  // fire edge advances with carry
  const fire={0:{...newIntent(),fire:true,firePrev:false}};
  step(w, CFG.STEP, fire);
  check("fire edge advances level with carry", w.state==="PLAY" && w.level===2 && w.score>0);
}

// 7) line bomb pierces bricks (enemy beyond bricks gets killed; normal bomb wouldn't)
{
  const w=createWorld(1,1); loadLevel(w,1,false); w.state="PLAY";
  const p=w.players[0];
  w.enemies.length=0;
  // place 3 bricks to the right of player at row 1
  for(let i=1;i<=5;i++){ w.grid[1*CFG.COLS+1+i]=1; }
  const enemy={type:"walker",x:6*CFG.TILE+CFG.TILE/2,y:1*CFG.TILE+CFG.TILE/2,tx:6,ty:1,dir:{x:1,y:0},speed:0,r:13,color:"#fff",dead:false,invuln:false,invulnT:0,cd:999,home:{x:6,y:1},pass:false};
  w.enemies.push(enemy);
  p.bombKind="line"; p.face={x:1,y:0};
  w.bombs.push({x:p.x,y:p.y,tx:tileOf(p.x),ty:tileOf(p.y),timer:0.01,radius:5,pierce:false,line:true,dir:{x:1,y:0},variant:"line",dead:false});
  for(let i=0;i<180;i++) step(w,CFG.STEP,{0:{move:{x:0,y:0},fire:false,firePrev:false,shift:false,remote:false,kick:false}});
  check("line bomb pierces bricks", enemy.dead===true, "enemy.dead="+enemy.dead);
}

// 8) enemy contact damage
{
  const w=createWorld(999,1); loadLevel(w,1,false); w.state="PLAY";
  const e=w.enemies[0];
  e.invuln=false; e.invulnT=0; e.type="stationary"; e.speed=0;
  e.home={x:1,y:1};
  e.x=w.players[0].x; e.y=w.players[0].y; e.r=20;
  w.players[0].iFrames=0; w.players[0].shield=false;
  const livesBefore=w.lives;
  const zero={0:newIntent()};
  step(w, CFG.STEP, zero);
  check("enemy contact decrements lives", w.lives===livesBefore-1, w.lives+" vs "+livesBefore);
  // shield consumes instead
  const w2=createWorld(999,1); loadLevel(w2,1,false); w2.state="PLAY";
  const e2=w2.enemies[0];
  e2.invuln=false; e2.invulnT=0; e2.type="stationary"; e2.speed=0;
  e2.home={x:1,y:1};
  e2.x=w2.players[0].x; e2.y=w2.players[0].y; e2.r=20;
  w2.players[0].iFrames=0; w2.players[0].shield=true;
  const l2=w2.lives;
  step(w2, CFG.STEP, zero);
  check("contact with shield consumes shield, keeps life",
    w2.lives===l2 && w2.players[0].shield===false);
  // lives exhausted -> LOSE state + lose event
  const w3=createWorld(999,1); loadLevel(w3,1,false); w3.state="PLAY";
  const e3=w3.enemies[0];
  e3.invuln=false; e3.invulnT=0; e3.type="stationary"; e3.speed=0;
  e3.home={x:1,y:1}; e3.x=1.5*CFG.TILE; e3.y=1.5*CFG.TILE; e3.r=20;
  w3.players[0].shield=false; w3.players[0].iFrames=0;
  let guard=0;
  while(w3.lives>0 && guard++<5000){
    w3.players[0].x=w3.players[0].y=1.5*CFG.TILE;
    step(w3, CFG.STEP, zero);
   }
  check("lives exhausted enters LOSE", w3.state==="LOSE");
  check("lose event emitted", w3.events.some(ev=>ev.t==="lose"));
}

// 5b) chain reaction coverage
function injectBomb(w,tx,ty,timer,radius){
  w.bombs.push({x:tx*CFG.TILE+20,y:ty*CFG.TILE+20,tx,ty,timer,radius:radius||1,
    pierce:false,line:false,dir:null,variant:"normal",dead:false});
}
{
  // distance-2 bomb in open line DOES chain
  const w=createWorld(5,1); loadLevel(w,1,false); w.state="PLAY";
  w.enemies=[]; w.blades=[]; w.bombs=[];
  injectBomb(w,4,6,0,2);            // pops immediately, radius 2 reaches col 6
  injectBomb(w,6,6,99,1);           // distance 2, long fuse
  step(w, CFG.STEP, {0:newIntent()});
  check("distance-2 bomb chained", w.bombs.every(b=>b.dead));
}
{
  // wall between bombs blocks the chain
  const w=createWorld(5,1); loadLevel(w,1,false); w.state="PLAY";
  w.enemies=[]; w.blades=[]; w.bombs=[];
  w.grid[key(5,6)]=T.WALL;
  injectBomb(w,4,6,0,2); injectBomb(w,6,6,99,1); // radius-2 footprint would reach col 6 if not wall-blocked
  step(w, CFG.STEP, {0:newIntent()});
  check("wall blocks chain", w.bombs.some(b=>!b.dead && b.tx===6));
}

// 9b) input layer headless checks
{
  const inp=new Input(null);
  inp._onFireDown({});
  check("pointerdown sets fire", inp._intent.fire===true);
  inp._onFireUp({});
  check("pointerup clears fire", inp._intent.fire===false);
  inp.setIntent({move:{x:1,y:0}});
  check("setIntent x:+1 -> right held, left clear",
    inp.input.right===true && inp.input.left===false);
  inp.setIntent({move:{x:0,y:-1}});
  check("setIntent y:-1 -> up held, down clear",
    inp.input.up===true && inp.input.down===false);
  inp._onFireDown({});
  inp._onFireUp({}); // pointercancel/pointerleave route to the same handler
  check("simulated pointercancel clears fire (touch latch)", inp._intent.fire===false);
}

// 9c) input layer: releasing Q clears the remote latch (no stuck hold)
{
  const inp=new Input(null);
  inp._onKey({code:"KeyQ"});
  check("keydown KeyQ sets remote", inp._intent.remote===true);
  inp._onKeyUp({code:"KeyQ"});
  check("keyup KeyQ clears remote", inp._intent.remote===false);
}

// 9d) sim layer: remote detonates on press EDGE only (not every held tick)
{
  const w=createWorld(7,1); loadLevel(w,1,false); w.state="PLAY";
  w.enemies=[]; w.blades=[]; w.bombs=[];
  w.players[0].remote=true;
  const hold={0:{...newIntent(),remote:true}};
  injectBomb(w,4,6,99,1);
  step(w, CFG.STEP, hold);
  check("remote press detonates live bomb", w.bombs.length===0,
    "boms left "+w.bombs.length);
  injectBomb(w,4,6,99,1);
  step(w, CFG.STEP, hold);            // still held -> edge must be latched
  check("remote held latches (bomb survives)", w.bombs.length===1 && !w.bombs[0].dead,
    "bombs "+w.bombs.length+(w.bombs[0]?(" dead="+w.bombs[0].dead):""));
  step(w, CFG.STEP, {0:newIntent()}); // release
  step(w, CFG.STEP, hold);            // re-press
  check("remote re-press detonates again", w.bombs.length===0,
    "boms left "+w.bombs.length);
}

// ==================== RULES OVERHAUL: bombs are tile-solid ====================
/* Fresh PLAY world with a quiet board (no enemies/bombs/blades) for rule tests. */
function rulesWorld(seed){
  const w=createWorld(seed||1,1); loadLevel(w,1,false); w.state="PLAY";
  w.enemies.length=0; w.bombs.length=0; w.blades.length=0;
  return w;
}

// R1) player walks off own bomb tile, reverse re-entry is blocked
{
  const w=rulesWorld();
  const p=w.players[0];
  p.x=p.y=1.5*CFG.TILE; p.tx=1; p.ty=1;
  injectBomb(w,1,1,99,1);
  const right={0:{...newIntent(),move:{x:1,y:0}}};
  for(let i=0;i<40;i++) step(w,CFG.STEP,right);
  check("R1a player walks OFF own bomb tile", tileOf(p.x)>1,
    "tile "+tileOf(p.x));
  p.x=4.5*CFG.TILE; p.tx=4; p.ty=1;
  const back={0:{...newIntent(),move:{x:-1,y:0}}};
  let entered=false;
  for(let i=0;i<120;i++){ step(w,CFG.STEP,back); if(tileOf(p.x)<=1)entered=true; }
  check("R1b re-entry onto bomb tile blocked", !entered && tileOf(p.x)>=2,
    "final tile "+tileOf(p.x)+" entered="+entered);
}

// R2) same rule on a hand-carved lane: walk off right, blocked coming back left
{
  const w=rulesWorld(9);
  const p=w.players[0];
  for(let x=4;x<=8;x++) w.grid[key(x,7)]=T.EMPTY;
  p.x=4.5*CFG.TILE; p.y=7.5*CFG.TILE; p.tx=4; p.ty=7;
  injectBomb(w,6,7,99,1);
  const go={0:{...newIntent(),move:{x:1,y:0}}};
  for(let i=0;i<50;i++) step(w,CFG.STEP,go);
  check("R2a walked off bomb tile to its right", tileOf(p.x)===5,
    "tile "+tileOf(p.x));
  p.x=8.5*CFG.TILE; p.tx=8;
  const ret={0:{...newIntent(),move:{x:-1,y:0}}};
  let hit=false;
  for(let i=0;i<160;i++){ step(w,CFG.STEP,ret); if(tileOf(p.x)<=6)hit=true; }
  check("R2b return into bomb tile blocked", !hit && tileOf(p.x)>=7,
    "final tile "+tileOf(p.x)+" hit="+hit);
}

// R3) standing on own bomb at placement: no push-out; open direction exits
{
  const w=rulesWorld();
  const p=w.players[0];
  w.grid[key(3,3)]=T.EMPTY;
  p.x=3.5*CFG.TILE; p.y=3.5*CFG.TILE; p.tx=3; p.ty=3;
  injectBomb(w,3,3,99,1);
  const zero={0:newIntent()};
  for(let i=0;i<20;i++) step(w,CFG.STEP,zero);
  check("R3a standing on own bomb: no push-out",
    tileOf(p.x)===3&&tileOf(p.y)===3, tileOf(p.x)+","+tileOf(p.y));
  const down={0:{...newIntent(),move:{x:0,y:1}}};
  for(let i=0;i<40;i++) step(w,CFG.STEP,down);
  check("R3b open direction exits cleanly",
    tileOf(p.x)===3&&tileOf(p.y)>3, tileOf(p.x)+","+tileOf(p.y));
}

// R4) non-pass enemy blocked by bomb tile; pass enemies phase through
{
  const w=rulesWorld(9);
  for(let x=3;x<=9;x++) w.grid[key(x,7)]=T.EMPTY;
  const wk=spawnEnemy("walker",3,7,1,w.rng);
  wk.invuln=false; wk.invulnT=0; wk.cd=99999; wk.dir={x:1,y:0}; wk.home={x:3,y:7};
  w.enemies.push(wk);
  injectBomb(w,5,7,99,1);
  let crossed=false;
  for(let i=0;i<150;i++){ step(w,CFG.STEP,{0:newIntent()}); if(wk.tx>=5)crossed=true; }
  check("R4a walker cannot enter bomb tile", !crossed && wk.tx<5,
    "tx="+wk.tx+" crossed="+crossed);

  const boom=spawnEnemy("boomerang",3,7,1,w.rng);
  boom.invuln=false; boom.invulnT=0; boom.cd=99999; boom.dir={x:1,y:0}; boom.home={x:3,y:7};
  const w2=rulesWorld(9);
  for(let x=3;x<=10;x++) w2.grid[key(x,7)]=T.EMPTY;
  w2.enemies.push(boom);
  injectBomb(w2,6,7,99,1);
  let reached=false;
  for(let i=0;i<200;i++){ step(w2,CFG.STEP,{0:newIntent()}); if(boom.tx>=8)reached=true; }
  check("R4b boomerang (pass) phases through bombs", reached, "tx="+boom.tx);

  const rkt=spawnEnemy("rocket",3,7,1,w.rng);
  rkt.invuln=false; rkt.invulnT=0; rkt.cd=99999; rkt.dir={x:1,y:0}; rkt.home={x:3,y:7};
  const w3=rulesWorld(9);
  for(let x=3;x<=10;x++) w3.grid[key(x,7)]=T.EMPTY;
  w3.enemies.push(rkt);
  injectBomb(w3,6,7,99,1);
  let reached3=false;
  for(let i=0;i<320;i++){ step(w3,CFG.STEP,{0:newIntent()}); if(rkt.tx>=8)reached3=true; }
  check("R4c rocket (pass) phases through bombs", reached3, "tx="+rkt.tx);
}

console.log("\n  SIM RESULT: "+pass+" PASS / "+fail+" FAIL");
process.exit(fail?1:0);
