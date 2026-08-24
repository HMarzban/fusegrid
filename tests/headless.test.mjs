import {createGame} from "../src/main.js";
import {createRenderer} from "../src/render/renderer.js";
import {createWorld, loadLevel} from "../src/core/sim.js";
import {SCREEN, IDLE_T} from "../src/app/menuapp.js";
import {CFG} from "../src/core/config.js";
import {loadScores} from "../src/app/highscores.js";

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
  check("P1 jingle deferred while audio locked (stub cannot unlock)",
    plays.length===0,JSON.stringify(plays));
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

// P1: uiJingle gated on audio unlock — a suspended ctx freezes currentTime,
// so boot-time scheduling replays all 5 oscillators as one chord-blob on the
// first gesture. Jingle must ride the unlock handler instead.
{
  const plays=[];
  const audio={play:n=>plays.push(n),toggle:()=>false,_u:false,
    unlock(){this._u=true;return true;},unlocked(){return !!this._u;}};
  const L={};
  globalThis.window={addEventListener:(ty,fn)=>{(L[ty]=L[ty]||[]).push(fn);}};
  try{
    createGame(null,{seed:14,audio});
    check("P1 locked ctx: nothing scheduled before first gesture",
      plays.length===0,JSON.stringify(plays));
    // neutral gesture key (F15): Input also listens on window and must not
    // produce any ui* cue here — isolates the jingle assertion
    L.keydown.forEach(f=>f({code:"F15"}));
    check("P1 first gesture -> exactly one uiJingle after unlock",
      plays.join()==="uiJingle",JSON.stringify(plays));
    L.pointerdown.forEach(f=>f({}));
    L.keydown.forEach(f=>f({code:"F16"}));
    check("P1 second listener/gesture never replays the jingle",
      plays.length===1,JSON.stringify(plays));
   }finally{ delete globalThis.window; }
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

// ---- ATTRACT MODE (spec §1/§4/§5/§6): idle entry, demo harness, exit ----
{
  const g=createGame(null,{seed:21});
  g.app.skip();                          // INTRO -> MENU
  let t=1000;
  for(let i=0;i<590;i++){ t+=16; g.loop(t); }        // ~9.4s idle
  check("attract: below IDLE_T stays MENU, no demo, sim untouched",
    g.app.screen===SCREEN.MENU&&g.demo===null&&g.world.time===0,
    g.app.screen+"/"+String(g.demo));
  for(let i=0;i<50;i++){ t+=16; g.loop(t); }         // crosses 10s
  check("attract: >=IDLE_T enters ATTRACT with seeded level-1 demo",
    g.app.screen===SCREEN.ATTRACT&&!!g.demo
    &&g.demo.world.seed===20260823&&g.demo.world.level===1
    &&g.demo.world.state==="PLAY",
    g.app.screen+"/"+(g.demo&&g.demo.world.level));
  for(let i=0;i<60;i++){ t+=16; g.loop(t); }
  check("attract: demo world steps through the fixed-step accumulator",
    !!g.demo&&g.demo.world.time>0,String(g.demo&&g.demo.world.time));
  check("attract: live game world still frozen while demo runs",
    g.world.time===0&&g.world.tick===0);
  // rollover via the 20s cap: force t to the edge, one big frame rolls it
  const edge=20-CFG.STEP/2;
  g.demo.t=edge; t+=250; g.loop(t);      // dt capped at 0.25 -> >=1 demo step
  check("attract: cap rollover 1 -> 2 (fresh world, PLAY)",
    g.demo.world.level===2&&g.demo.world.state==="PLAY"&&g.demo.t<1,
    "lvl="+g.demo.world.level+" t="+g.demo.t.toFixed(3));
  g.demo.t=edge; t+=250; g.loop(t);
  check("attract: rollover 2 -> 3", g.demo.world.level===3);
  g.demo.t=edge; t+=250; g.loop(t);
  check("attract: rollover 3 -> 1 (cycle wraps)", g.demo.world.level===1);
  // exit paths: key exits instantly, demo discarded on next frame, cursor kept
  g.app.cursor=4;
  const r=g.app.key("Escape");
  check("attract: any key exits instantly to MENU", r===true
    &&g.app.screen===SCREEN.MENU);
  t+=16; g.loop(t);
  check("attract: demo discarded after exit", g.demo===null);
  check("attract: cursor preserved across round-trip", g.app.cursor===4);
}

// ---- P2: ATTRACT->MENU gets the 0.25s veil (demo board vs live backdrop
//        would otherwise hard-cut). Mirrors the INTRO->MENU skip-fade check. ----
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
  const g=createGame(fake,{seed:41});
  g.app.skip();
  g.app.enterAttract();
  let t=1000;
  g.loop(t); t+=64; g.loop(t);           // demo live before exit
  check("P2 probe: attract active pre-exit",
    g.app.screen===SCREEN.ATTRACT&&!!g.demo,String(g.app.screen));
  sets.length=0;
  g.app.key("Escape");                   // exitAttract -> MENU, subT reset
  const alphas=[];
  for(let i=1;i<=20;i++){ t+=16; g.loop(t);
    alphas.push(...sets.filter(s=>String(s).slice(0,13)==="rgba(7,10,18,")
      .map(s=>parseFloat(String(s).slice(13))));
    sets.length=0;
   }
  check("P2 post-attract MENU: fade veil k>0.9 in first frames",
    alphas.some(a=>a>0.9),"max "+Math.max.apply(null,[0].concat(alphas)));
  check("P2 veil settles to plain 0.62 dim after 0.25s",
    alphas.slice(-6).every(a=>a<=0.73),
    "tail "+alphas.slice(-4).map(a=>a.toFixed(2)).join(","));
}

// ---- score isolation (spec §6): long attract incl. deaths never records ----
{
  const baseline=JSON.stringify(loadScores());
  const g=createGame(null,{seed:23});
  g.app.skip(); g.app.cursor=2;
  g.app.enterAttract();                  // direct entry for a deterministic run
  const levels=new Set();
  let t=2000;
  for(let i=0;i<400;i++){                // ~100s wall => >=40s sim => >=2 caps
    t+=250; g.loop(t);
    if(g.demo){
      levels.add(g.demo.world.level);
      g.demo.world.score=(g.demo.world.score+7919)%100000;   // poison
     }
   }
  check("isolation: scores byte-equal baseline after poisoned long attract",
    JSON.stringify(loadScores())===baseline,
    JSON.stringify(loadScores()).slice(0,60));
  check("isolation: cycles visited roll through 1,2,3",
    levels.has(1)&&levels.has(2)&&levels.has(3),[...levels].join(","));
  check("isolation: live world pristine (time/tick/score zero)",
    g.world.time===0&&g.world.tick===0&&g.world.score===0);
}

// ---- renderer opts (spec §5.5): hud:false + sfx gate, defaults identical ----
{
  const sent={score:{textContent:"-"},level:{textContent:"-"},
    lives:{textContent:"-"},enemies:{textContent:"-"},
    bombs:{textContent:"-"},range:{textContent:"-"}};
  const plays=[];
  const r=createRenderer(null,{hud:sent,audio:{play:n=>plays.push(n)}});
  const w=createWorld(5,1); loadLevel(w,1,false); w.state="PLAY";
  w.events.push({t:"boom",x:0,y:0});
  r.render(w,1/60);
  check("renderer defaults: HUD written + sfx played + fx consumed",
    sent.score.textContent!=="-"&&plays.join()==="boom"&&w.events.length===0,
    sent.score.textContent+"/"+plays.join());
  sent.score.textContent="-"; sent.lives.textContent="-"; plays.length=0;
  w.events.push({t:"kill",x:0,y:0,color:"#fff"});
  r.render(w,1/60,{hud:false});
  check("opts.hud=false skips HUD writes but keeps fx",
    sent.score.textContent==="-"&&sent.lives.textContent==="-"
      &&w.events.length===0,
    sent.score.textContent+"/"+sent.lives.textContent);
  check("opts default sfx stays on under hud:false",
    plays.join()==="kill",plays.join());
  plays.length=0;
  w.events.push({t:"hurt",x:0,y:0});
  r.render(w,1/60,{hud:false,sfx:false});
  check("opts.sfx=false gates audio.play only (fx intact)",
    plays.length===0&&w.events.length===0);
}

// ---- fix round F3: toolbar GAME-gates (btnPause/btnRestart inert outside GAME) ----
{
  const stubs={btnPause:{textContent:"Pause"},
    btnSound:{textContent:"Sound: On"},btnRestart:{textContent:"Restart"}};
  globalThis.document={getElementById:(id)=>stubs[id]||null};
  try{
    const ev={currentTarget:{blur(){}}};
    // outside GAME (ATTRACT): clicks must not touch live world or flip labels
    const g=createGame(null,{seed:31});
    g.app.skip();
    g.app.enterAttract();
    let t=3000; g.loop(t); t+=250; g.loop(t);  // frame 1 creates demo (dt=0), frame 2 steps it
    check("F3 probe: attract active with demo running",
      g.app.screen===SCREEN.ATTRACT&&!!g.demo,String(g.app.screen));
    const w=g.world;
    w.score=7777; w.enemies=[];          // poison markers a stray loadLevel would wipe
    const tick0=w.tick;
    stubs.btnPause.onclick(ev);
    stubs.btnRestart.onclick(ev);
    check("F3 attract: btnPause+btnRestart leave live world untouched",
      w.score===7777&&w.enemies.length===0&&w.tick===tick0
      &&w.state==="PLAY",
      w.score+"/"+w.enemies.length+"/"+w.tick+"/"+w.state);
    check("F3 attract: no PAUSE/label flip over the demo",
      stubs.btnPause.textContent==="Pause",stubs.btnPause.textContent);
    check("F3 attract: demo world keeps stepping untouched",
      !!g.demo&&g.demo.world.time>0,String(g.demo&&g.demo.world.time));
    // inside GAME: byte-identical behavior preserved
    const g2=createGame(null,{autoplay:true});
    stubs.btnPause.onclick(ev);
    check("F3 GAME: btnPause still pauses + flips label to Resume",
      g2.world.state==="PAUSE"&&stubs.btnPause.textContent==="Resume",
      g2.world.state+"/"+stubs.btnPause.textContent);
    stubs.btnPause.onclick(ev);
    g2.world.level=2;
    stubs.btnRestart.onclick(ev);
    check("F3 GAME: btnRestart still reloads level 1 fresh PLAY",
      g2.world.level===1&&g2.world.state==="PLAY",g2.world.level+"/"+g2.world.state);
   }finally{ delete globalThis.document; }
}

// ---- P4: demobot imports pruned (tileOf/solidAt unused; bfsNext lives) ----
{
  const fs=await import("node:fs");
  const src=fs.readFileSync(new URL("../src/app/demobot.js",
    import.meta.url),"utf8");
  check("demobot: no dead tileOf/solidAt refs, bfsNext kept",
    !/\btileOf\b/.test(src)&&!/\bsolidAt\b/.test(src)&&/\bbfsNext\b/.test(src));
}

// ---- Area 4: distinct opts.canvasEl breaks the C1 swallow silently ----
// Input listens on opts.canvasEl but main's anti-double-fire pointerdown
// swallow registers on the render canvas; a mismatch must warn (dev-facing).
{
  const warns=[];
  const ow=console.warn; console.warn=(...a)=>warns.push(a.join(" "));
  try{
    createGame(mkCanvas(),{seed:51,canvasEl:mkCanvas()});
    check("canvasEl seam: distinct element warns exactly once",
      warns.length===1,JSON.stringify(warns));
    warns.length=0;
    const cv=mkCanvas();
    createGame(cv,{seed:52,canvasEl:cv});
    check("canvasEl seam: identical element stays silent",warns.length===0,
      JSON.stringify(warns));
    createGame(mkCanvas(),{seed:53});
    check("canvasEl seam: absent canvasEl stays silent",warns.length===0,
      JSON.stringify(warns));
   }finally{ console.warn=ow; }
}

console.log(fail? "HEADLESS FAIL":"HEADLESS OK");
process.exit(fail?1:0);
