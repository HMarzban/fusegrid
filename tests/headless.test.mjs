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

console.log(fail? "HEADLESS FAIL":"HEADLESS OK");
process.exit(fail?1:0);
