import {step, createWorld, newIntent, loadLevel} from "../src/core/sim.js";
import {spawnEnemy} from "../src/core/entities.js";
import {CFG,T,key} from "../src/core/config.js";
import {tileOf,bfsNext} from "../src/core/board.js";
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

// ==================== RULES OVERHAUL: real sliding kick ====================
const KICK_LANE=7; // hand-cleared corridor row used by the kick tests
function kickWorld(seed){
  const w=rulesWorld(seed);
  // cols 2..13 open: (13,7) is genBoard BRICK (odd/odd, uncarved) and must be
  // cleared so the corridor truly reaches the col-14 border wall
  for(let x=2;x<=13;x++) w.grid[key(x,KICK_LANE)]=T.EMPTY;
  // parked far guard enemy: keeps the board "live" so the all-clear WIN
  // timer can't freeze the sim mid-slide (see demobot.test same trick)
  const far=spawnEnemy("stationary",1,11,1,w.rng);
  far.invuln=false; far.invulnT=0;
  w.enemies.push(far);
  return w;
}
function kickSetup(seed,kickPower){
  const w=kickWorld(seed||11);
  const p=w.players[0];
  p.kick=!!kickPower;
  p.x=3.5*CFG.TILE; p.y=(KICK_LANE+.5)*CFG.TILE; p.tx=3; p.ty=KICK_LANE;
  injectBomb(w,4,KICK_LANE,99,1);
  return w;
}

// R5) kick launches the bomb; it slides and halts before obstacles
{
  // a) slides across open tiles, halts against the border wall (col 14)
  const w=kickSetup(11,true);
  const b=w.bombs[0], p=w.players[0];
  const hold={0:{...newIntent(),move:{x:1,y:0},kick:true}};
  let maxTx=4;
  for(let i=0;i<400;i++){ step(w,CFG.STEP,hold); if(b.tx>maxTx)maxTx=b.tx; }
  check("R5a kick slides bomb >=3 tiles", maxTx>=8, "maxTx="+maxTx);
  check("R5a slider halts before border wall",
    !b.dead&&b.tx===13&&!b.slide&&Math.abs(b.x-(13.5*CFG.TILE))<1,
    "tx="+b.tx+" x="+b.x.toFixed(1)+" slide="+JSON.stringify(b.slide));

  // b) stops before another bomb, chain intact, fuse kept ticking
  const w2=kickWorld(12);
  const p2=w2.players[0]; p2.kick=true;
  p2.x=3.5*CFG.TILE; p2.y=(KICK_LANE+.5)*CFG.TILE; p2.tx=3; p2.ty=KICK_LANE;
  injectBomb(w2,4,KICK_LANE,99,1);
  injectBomb(w2,9,KICK_LANE,99,1);
  const hold2={0:{...newIntent(),move:{x:1,y:0},kick:true}};
  for(let i=0;i<400;i++) step(w2,CFG.STEP,hold2);
  const s=w2.bombs.find(bb=>bb.tx===4||bb.prog!==undefined);
  check("R5b slider stops before another bomb",
    w2.bombs.some(bb=>bb.tx===8&&!bb.slide)&&w2.bombs.length===2,
    JSON.stringify(w2.bombs.map(bb=>({tx:bb.tx,slide:!!bb.slide}))));
  // fuse intact -> detonates on timer and chains the parked bomb
  const sl=w2.bombs.find(bb=>bb.tx===8);
  if(sl)sl.timer=0.01;
  for(let i=0;i<10;i++) step(w2,CFG.STEP,{0:newIntent()});
  check("R5b slider detonates + chains parked bomb", w2.bombs.length===0,
    "bombs left "+w2.bombs.length);

  // c) stops before an enemy tile; enemy untouched by the stop itself
  const w3=kickWorld(13);
  const en=spawnEnemy("walker",9,KICK_LANE,1,w3.rng);
  en.invuln=false; en.invulnT=0; en.cd=99999; en.speed=0; en.home={x:9,y:KICK_LANE};
  w3.enemies.push(en);
  const p3=w3.players[0]; p3.kick=true;
  p3.x=3.5*CFG.TILE; p3.y=(KICK_LANE+.5)*CFG.TILE; p3.tx=3; p3.ty=KICK_LANE;
  injectBomb(w3,4,KICK_LANE,99,1);
  const hold3={0:{...newIntent(),move:{x:1,y:0},kick:true}};
  for(let i=0;i<400;i++) step(w3,CFG.STEP,hold3);
  check("R5c slider stops before enemy tile",
    w3.bombs.some(bb=>bb.tx===8&&!bb.slide)&&en.tx===9&&!en.dead,
    "bomb "+w3.bombs.map(bb=>bb.tx)+" enemy "+en.tx);

  // d) fuse ticks during the slide
  const w4=kickSetup(14,true);
  const b4=w4.bombs[0]; const t0=b4.timer;
  const hold4={0:{...newIntent(),move:{x:1,y:0},kick:true}};
  for(let i=0;i<20;i++) step(w4,CFG.STEP,hold4);
  check("R5d fuse ticks while sliding",
    b4.timer<t0&&b4.timer>0&&!b4.dead, t0.toFixed(2)+" -> "+b4.timer.toFixed(2));
}

// R6) without the kick power nothing launches
{
  const w=kickSetup(15,false);
  const b=w.bombs[0];
  const hold={0:{...newIntent(),move:{x:1,y:0},kick:true}};
  for(let i=0;i<120;i++) step(w,CFG.STEP,hold);
  check("R6 no kick power => bomb never launches",
    b.tx===4&&b.ty===KICK_LANE&&!b.slide, "tx="+b.tx+" slide="+JSON.stringify(b.slide));
}

// R7) kick no longer breaks bricks (old power removed)
{
  const w=rulesWorld(16);
  const p=w.players[0];
  p.kick=true;
  p.x=2.5*CFG.TILE; p.y=1.5*CFG.TILE; p.tx=2; p.ty=1;
  w.grid[key(3,1)]=T.BRICK;
  const hold={0:{...newIntent(),move:{x:1,y:0},kick:true}};
  for(let i=0;i<40;i++) step(w,CFG.STEP,hold);
  check("R7 kick leaves bricks intact (brick-break kick removed)",
    w.grid[key(3,1)]===T.BRICK, "grid="+w.grid[key(3,1)]);
}

// ==================== RULES OVERHAUL: chaser BFS routes around bombs ====================
{
  // fully open room rows 4..8 x cols 3..11: the bomb parked mid-lane at
  // (7,6) between chaser (4,6) and player (10,6) is the ONLY obstacle, so
  // any progress past column 7 must come from routing around its tile
  const w=rulesWorld(21);
  for(let y=4;y<=8;y++)for(let x=3;x<=11;x++) w.grid[key(x,y)]=T.EMPTY;
  const ch=spawnEnemy("chaser",4,6,1,w.rng);
  ch.invuln=false; ch.invulnT=0; ch.cd=0.001; ch.dir={x:1,y:0};
  w.enemies.push(ch);
  injectBomb(w,7,6,99,1);
  const p=w.players[0];
  p.x=10.5*CFG.TILE; p.y=6.5*CFG.TILE; p.tx=10; p.ty=6; p.iFrames=99999;
  let onBomb=false, past=false;
  for(let i=0;i<480;i++){
    ch.cd=Math.min(ch.cd,0.02); // test-side: force BFS re-decision every tick
    step(w,CFG.STEP,{0:newIntent()});
    if(ch.tx===7&&ch.ty===6)onBomb=true;
    if(ch.tx>=9&&ch.ty===6)past=true;
   }
  check("R8a chaser never enters bomb tile", !onBomb,
    "final "+ch.tx+","+ch.ty+" dir "+JSON.stringify(ch.dir));
  check("R8b chaser BFS detours around bomb", past,
    "final "+ch.tx+","+ch.ty+" dir "+JSON.stringify(ch.dir));
}

// R9) board-level BFS unit: from the tile beside the bomb, the route must
// not step INTO the blocked bomb tile when a detour exists
{
  const w=rulesWorld(21);
  for(let y=4;y<=8;y++)for(let x=3;x<=11;x++) w.grid[key(x,y)]=T.EMPTY;
  const blocked=new Set([key(7,6)]);
  const n=bfsNext(w.grid,6,6,10,6,false,blocked);
  check("R9 bfsNext(blocked) detours off bomb tile",
    n!==null && !(n.x===7&&n.y===6),
    n?("next "+n.x+","+n.y):"null");
}

console.log("\n  SIM RESULT: "+pass+" PASS / "+fail+" FAIL");
process.exit(fail?1:0);
