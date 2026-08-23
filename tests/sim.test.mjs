import {step, createWorld, newIntent, loadLevel} from "../src/core/sim.js";
import {CFG,T,key} from "../src/core/config.js";
import {tileOf} from "../src/core/board.js";
import {Input} from "../src/input.js";

let pass=0, fail=0;
function check(name, cond, detail){ cond?pass++:fail++;
  console.log((cond?"  PASS ":"  FAIL ")+name+(detail!==undefined?" -> "+detail:"")); }

// ---- determinism: two fresh worlds + identical input => identical outcome ----
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
  }
  return w;
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

// 6) auto-advance: clear all enemies -> level increments after WIN_DELAY
{
  const w=createWorld(1,1); loadLevel(w,1,false);
  w.enemies.forEach(e=>e.dead=true);
  w.state="PLAY";
  const level0=w.level;
  // fewer than WIN_DELAY
  for(let i=0;i<50;i++) step(w,CFG.STEP,{0:{move:{x:0,y:0},fire:false,firePrev:false,switch:false,shift:false,remote:false,kick:false}});
  check("not advanced before WIN_DELAY", w.state==="PLAY" && w.level===level0, "level "+w.level);
  for(let i=0;i<150;i++) step(w,CFG.STEP,{0:{move:{x:0,y:0},fire:false,firePrev:false,shift:false,remote:false,kick:false}});
  check("auto-advanced to next level", w.level===level0+1, "level "+level0+" -> "+w.level);
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
    inp._held.right===true && inp._held.left===false);
  inp.setIntent({move:{x:0,y:-1}});
  check("setIntent y:-1 -> up held, down clear",
    inp._held.up===true && inp._held.down===false);
}

console.log("\n  SIM RESULT: "+pass+" PASS / "+fail+" FAIL");
process.exit(fail?1:0);
