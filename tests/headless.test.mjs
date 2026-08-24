import {createGame} from "../src/main.js";
import {createRenderer} from "../src/render/renderer.js";
import {createWorld, loadLevel} from "../src/core/sim.js";
import {SCREEN} from "../src/app/menuapp.js";

let pass=0, fail=0;
function check(name, cond, detail){ cond?pass++:fail++;
  console.log((cond?"  PASS ":"  FAIL ")+name+(detail!==undefined?" -> "+detail:"")); }

let ok=true;
try{ createGame(null,{}); }catch(e){ ok=false; console.log(e.message); }
check("createGame(null) imports+runs headless", ok);

ok=true;
try{
  const r=createRenderer(null,{hud:null,audio:null});
  const w=createWorld(7,1); loadLevel(w,1,false); w.state="MENU";
  r.render(w, 1/60);
}catch(e){ ok=false; console.log(e.message); }
check("null-canvas renderer render() does not throw", ok);

// ---- menu shell integration (plan Task 6) ----
{
  const g=createGame(null,{seed:42});
  check("createGame exposes .app", !!g.app&&typeof g.app.update==="function");
  check("boots into INTRO screen", g.app.screen===SCREEN.INTRO, g.app&&g.app.screen);
  check("boot world frozen as PLAY backdrop (never MENU)",
    g.world.state==="PLAY"&&g.world.level===1,
    g.world.state+","+g.world.level);
  g.app.skip();
  check("app.skip() reaches MENU", g.app.screen===SCREEN.MENU, g.app.screen);
}
{
  const g=createGame(null,{seed:42});
  g.app.skip();
  g.app.level=3;
  g.app.confirm();                       // cursor at 0 = START GAME
  check("confirm START GAME -> world PLAY + app GAME + inGame",
    g.world.state==="PLAY"&&g.app.screen===SCREEN.GAME&&g.app.inGame===true,
    g.world.state+"/"+g.app.screen);
  check("onStart applied level + reset score",
    g.world.level===3&&g.world.score===0, g.world.level+","+g.world.score);
}
{
  const g=createGame(null,{autoplay:true});
  check("autoplay (?play=1 equivalent) boots straight into GAME/PLAY",
    g.app.screen===SCREEN.GAME&&g.world.state==="PLAY",
    g.app.screen+"/"+g.world.state);
}
{
  const m=createGame(null,{seed:9});
  m.loop(0); m.loop(200);
  check("loop in MENU never steps the sim", m.world.time===0, "time "+m.world.time);
  const g=createGame(null,{seed:9,autoplay:true});
  g.loop(0); g.loop(200);
  check("loop in GAME steps the sim", g.world.time>0, "time "+g.world.time);
}

// ---- fix round 1: MENU logo (spec §2) + 0.25s intro-skip fade ramp ----
{
  const texts=[], sets=[];
  const rec=new Proxy(function(){},{
    get:(t,p)=>{
      if(p===Symbol.toPrimitive)return()=>"" ;
      return (...a)=>{ if(p==="fillText")texts.push(String(a[0])); return rec; };
     },
    apply:()=>rec,
    set:(t,p,v)=>{ if(p==="fillStyle")sets.push(String(v)); return true; }
   });
  const fake={getContext:()=>rec,addEventListener(){},style:{}};
  const g=createGame(fake,{seed:5});
  g.app.skip();                          // INTRO -> MENU
  for(let i=1;i<=20;i++)g.loop(i*16);    // ~0.32s of MENU frames
  check("MENU draws NEO wordmark (drawLogo reused per spec §2)",
    texts.indexOf("NEO")>=0,
    texts.filter(t=>t==="NEO"||t==="BOMBERMAN").join(","));
  const alphas=sets.filter(s=>s.slice(0,13)==="rgba(7,10,18,")
    .map(s=>parseFloat(s.slice(13)));
  check("skip fade ramps past menu veil in first frames (alpha>0.9)",
    alphas.some(a=>a>0.9), "max "+Math.max.apply(null,[0].concat(alphas)));
  check("fade settled after 0.25s (back to 0.62 veil)",
    alphas.slice(-6).every(a=>a<=0.73),
    "tail "+alphas.slice(-4).map(a=>a.toFixed(2)).join(","));
}

// ---- fix round 2: INTRO auto-advances to MENU at INTRO_DUR (no key) ----
{
  const g=createGame(null,{seed:3});
  let t=0;
  for(let i=0;i<330;i++){ t+=16; g.loop(t); }   // ~5.28s, zero input
  check("intro auto-advances to MENU at INTRO_DUR without any key",
    g.app.screen===SCREEN.MENU, "screen "+g.app.screen);
}

// ---- FINAL FIX WAVE: C1 pointer single-fire / I1 cue sheet / I2 gated pause ----
function mkCanvas(){
  const L={};
  const rec=new Proxy(function(){},{
    get:(t,p)=>{
      if(p===Symbol.toPrimitive)return()=>"" ;
      return ()=>rec;
     },
    apply:()=>rec,
    set:()=>true
   });
  return {getContext:()=>rec,style:{},
    addEventListener(ty,fn){(L[ty]=L[ty]||[]).push(fn);},
    fire(ty,ev){(L[ty]=L[ty]||[]).forEach(fn=>fn(ev||{}));}};
}

// C1: non-GAME pointerdown routes skip/confirm ONLY (game fire latch suppressed)
{
  const cv=mkCanvas();
  const g=createGame(cv,{seed:11});
  cv.fire("pointerdown");                       // INTRO click -> skip only
  check("C1 intro click skips to MENU, no fire latch",
    g.app.screen===SCREEN.MENU&&g.input._intent.fire===false,
    g.app.screen+"/fire="+g.input._intent.fire);
  for(let i=1;i<=10;i++)g.loop(i*16);
  check("C1 click-skip does not auto-start a run",
    g.app.screen===SCREEN.MENU&&g.world.time===0, g.app.screen);
  g.app.cursor=2; cv.fire("pointerdown");       // RENDER toggle
  check("C1 RENDER click toggles exactly once",
    g.app.render3d===true&&g.app.screen===SCREEN.MENU,
    "render3d="+g.app.render3d);
  for(let i=11;i<=20;i++)g.loop(i*16);
  check("C1 toggle is not re-fired by rising edge next frame",
    g.app.render3d===true&&g.app.screen===SCREEN.MENU);
  g.app.cursor=4; cv.fire("pointerdown");       // HOW TO PLAY
  check("C1 subscreen click lands once", g.app.screen===SCREEN.HOWTO);
  for(let i=21;i<=30;i++)g.loop(i*16);
  check("C1 subscreen does not bounce back", g.app.screen===SCREEN.HOWTO);
}

// I1: ui* cue sheet live from the app layer (main.js wrappers)
{
  const plays=[];
  const audio={play:n=>plays.push(n),toggle:()=>false};
  const g=createGame(null,{seed:12,audio});
  check("I1 uiJingle fires exactly once at intro start",
    plays.length===1&&plays[0]==="uiJingle",JSON.stringify(plays));
  plays.length=0;
  g.app.screen=SCREEN.MENU;
  g.app.move(1);
  check("I1 cursor move -> uiMove",
    plays.join()==="uiMove",JSON.stringify(plays));
  plays.length=0;
  g.app.cursor=0; g.app.confirm();              // START GAME
  check("I1 confirm START -> uiSel + run starts",
    plays.join()==="uiSel"&&g.app.screen===SCREEN.GAME,JSON.stringify(plays));
}
{
  const plays=[];
  const audio={play:n=>plays.push(n),toggle:()=>false};
  const g=createGame(null,{seed:13,audio});
  g.app.screen=SCREEN.MENU; g.app.cursor=2; plays.length=0;
  g.app.confirm();                              // RENDER toggle
  check("I1 RENDER confirm -> uiTog (never uiSel)",
    plays.join()==="uiTog",JSON.stringify(plays));
  g.app.cursor=3; plays.length=0;
  g.app.confirm();                              // SOUND toggle
  check("I1 SOUND confirm -> uiTog", plays.join()==="uiTog",
    JSON.stringify(plays));
  g.app.cursor=4; plays.length=0;
  g.app.confirm();                              // push HOWTO
  g.app.key("Escape");                          // back
  check("I1 HOWTO enter->uiSel then Esc back->uiBack",
    plays.join()==="uiSel,uiBack",JSON.stringify(plays));
}

// I2: pause exists only inside GAME
{
  const g=createGame(null,{autoplay:true});
  g.input.onPause();
  check("I2 onPause pauses inside GAME", g.world.state==="PAUSE");
  g.input.onPause();
  check("I2 onPause resumes inside GAME", g.world.state==="PLAY");
}
{
  const g=createGame(null,{});
  check("I2 boot backdrop is PLAY", g.world.state==="PLAY");
  g.input.onPause();
  check("I2 onPause outside GAME leaves world untouched",
    g.world.state==="PLAY"&&g.app.screen===SCREEN.INTRO);
  g.app.skip();
  g.input._onKey({code:"KeyP"});
  check("I2 KeyP at MENU routes to app only (world stays PLAY)",
    g.world.state==="PLAY"&&g.app.screen===SCREEN.MENU);
  g.input._onKey({code:"Escape"});
  check("I2 Esc at MENU routes to app only (root back no-op)",
    g.world.state==="PLAY"&&g.app.screen===SCREEN.MENU);
}

// ---- ?net=local dual-peer lockstep harness (netcode v1 dev aid) ----
{
  const g=createGame(null,{autoplay:true,netLocal:true});
  check("net=local builds dual-peer lockstep harness",
    !!g.net&&!!g.net.lsA&&!!g.net.lsB&&!!g.net.wB, String(!!g.net));
  let t=0; for(let i=0;i<80;i++){ t+=16; g.loop(t); }
  const a=g.world.tick,b=g.net.wB.tick;
  check("net=local drives both worlds in lockstep (equal ticks+score)",
    a>0&&a===b&&g.world.score===g.net.wB.score,a+"/"+b);
}
{
  const g=createGame(null,{autoplay:true});
  check("flag off: no net harness (default path untouched)",
    !g.net);
}

console.log(fail? "HEADLESS FAIL":"HEADLESS OK");
process.exit(fail?1:0);
