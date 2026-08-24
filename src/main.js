/* BROWSER ENTRY — wires input → deterministic sim → renderer.
   Only module that runs the RAF loop. Also owns the app SHELL
   (BOOT→INTRO→MENU⇄subs→GAME, src/app/menuapp.js): the sim steps ONLY while
   the shell is in GAME; other screens render the frozen arena behind menu
   chrome (src/render/menudraw.js). The sim never sees any of this. */
import {CFG} from "./core/config.js";
import {createWorld, loadLevel, step} from "./core/sim.js";
import {createRenderer} from "./render/renderer.js";
import {drawLogo} from "./render/scenes.js";
import {PROJ} from "./render/r3d/camera.js";
import * as menudraw from "./render/menudraw.js";
import {SCREEN, ITEMS, createMenuApp} from "./app/menuapp.js";
import {createDemobot} from "./app/demobot.js";
import {introPhase, INTRO_DUR} from "./app/intro.js";
import {loadScores, recordScore, saveScores} from "./app/highscores.js";

const SCREEN_NAME=["BOOT","INTRO","MENU","LEVEL","HOWTO","SCORES","GAME",
  "ATTRACT"];

/* ATTRACT demo harness constants (spec §1): fixed seed, levels cycle 1..3,
   20s sim-time cap per cycle before rollover. */
const DEMO_SEED=20260823, DEMO_CAP=20;
import {Input} from "./input.js";
import {mountTouch} from "./touch.js";
import {createLockstep} from "./net/lockstep.js";
import {LocalTransport} from "./net/transport.js";

export function createGame(canvas, opts={}){
  // flags parsed ONCE (?render=3d selects the dimetric path; ?play=1 skips the
  // shell straight into GAME)
  const is3d=typeof location!=="undefined"&&/[?&]render=3d/.test(location.search||"");
  const autoplay=(typeof location!=="undefined"
    &&/[?&]play=1/.test(location.search||""))||opts.autoplay===true;
  // ?net=local dev aid: run the world through a two-peer lockstep harness
  // (flag off = byte-identical default path below)
  const netLocal=(typeof location!=="undefined"
    &&/[?&]net=local/.test(location.search||""))||opts.netLocal===true;
  const dateStr=()=>new Date().toISOString().slice(0,10);

  // frozen backdrop world: created exactly as today but NEVER forced to
  // "MENU" — it simply is not stepped until a run starts (spec §7 edit 1)
  const world=createWorld(opts.seed!=null?opts.seed:((Math.random()*1e9)>>>0), 1);
  loadLevel(world,1,false);
  world.state="PLAY";

  let fit=null;
  if(canvas){
    canvas.width=is3d?PROJ.canvasW:CFG.COLS*CFG.TILE;
    canvas.height=is3d?PROJ.canvasH:CFG.ROWS*CFG.TILE;
    fit=()=>{
      if(typeof window==="undefined")return;
      const maxW=window.innerWidth-40, maxH=window.innerHeight-180;
      const s=Math.max(0.3, Math.min(maxW/canvas.width, maxH/canvas.height, 1.8));
      canvas.style.width=(canvas.width*s)+"px";
      canvas.style.height=(canvas.height*s)+"px";
       };
    fit();
    if(typeof window!=="undefined")window.addEventListener("resize", fit);
    }

  const input=new Input(opts.canvasEl||canvas);
  /* C1 seam guard: the anti-double-fire pointerdown swallow below registers
     on the RENDER canvas while Input's fire latch listens on opts.canvasEl.
     When they differ, taps on canvasEl latch fire with no swallow to eat
     them — confirms double-fire silently. Warn so hosts notice. */
  if(opts.canvasEl&&opts.canvasEl!==canvas)
    console.warn("[rollblock] opts.canvasEl differs from the render canvas:"
      +" menu pointer confirms will double-fire (C1 swallow is bound to the"
      +" render canvas only). Pass the same element to both.");
  /* virtual pad: #stage children (never canvas listeners — C1 swallow intact);
     desktop/headless builds nothing, update() is a silent no-op there */
  const touch=mountTouch(input,(typeof document!=="undefined"&&document)?
    document.getElementById("stage"):null);
  let prevSt=null;

  /* ?net=local harness: world A stays the live game world; a mirror peer B
     (same seed) runs the same lockstep protocol over crossed LocalTransports.
     B is driven by a deterministic script so both peers keep stepping. */
  let net=null;
  if(netLocal){
    const wB=createWorld(world.seed,1);
    loadLevel(wB,1,false); wB.state="PLAY";
    let lsA=null,lsB=null;
    const tA=new LocalTransport((m)=>{ if(lsB)lsB.handleMessage(m); });
    const tB=new LocalTransport((m)=>{ if(lsA)lsA.handleMessage(m); });
    lsA=createLockstep({selfPid:0,world,transport:tA,dt:CFG.STEP,
      players:[0,1]});
    lsB=createLockstep({selfPid:1,world:wB,transport:tB,dt:CFG.STEP,
      players:[0,1]});
    let bf=0;
    net={lsA,lsB,wB,
      drive(){
        lsA.pushIntent(input.intent());
        input.advance();
        const m=[{x:0,y:-1},{x:-1,y:0},{x:0,y:1},{x:1,y:0}][bf%4];
        lsB.pushIntent({move:m,fire:(bf%19===0),shift:(bf%41===0),
          remote:(bf%97===0),kick:false});
        bf++;
        lsA.tick(); lsB.tick();
       }};
   }

  function setBtn(id,txt){
    if(typeof document==="undefined")return;
    const el=document.getElementById(id); if(el)el.textContent=txt;
    }

  /* run handoff (menu START / LEVEL select): fresh board, score reset */
  const onStart=(args)=>{
    loadLevel(world,args.level,false);
    world.score=0;
    world.state="PLAY";
    app.inGame=true;
    prevSt="PLAY";
    setBtn("btnPause","Pause");
    };

  const audio=opts.audio||null;
  /* P1 (§0.4): the boot jingle must never schedule against a suspended ctx —
     currentTime is frozen there, so all 5 oscillators land on one timestamp
     and replay as a chord-blob on the first gesture. Fire immediately only if
     already unlocked; otherwise defer to the unlock handler below. */
  let fireJingle=()=>{};
  const app=createMenuApp({level:1,sound:true,render3d:is3d,
    audio,autoplay,onStart});  /* §5 cue sheet — wired HERE in the app layer, never in render/sim. Wrappers
     shadow the machine methods so every successful transition plays exactly
     one cue; RENDER/SOUND confirms get uiTog instead of uiSel, and subscreen
     confirm (= back()) is cued once by the back wrapper alone. */
  if(audio){
    const m0=app.move.bind(app), b0=app.back.bind(app),
      c0=app.confirm.bind(app);
    app.move=(d)=>{ const r=m0(d); if(r)audio.play("uiMove"); return r; };
    app.back=()=>{ const r=b0(); if(r)audio.play("uiBack"); return r; };
    app.confirm=()=>{
      const sB=app.screen, cB=app.cursor, r=c0();
      if(!r)return r;
      if(sB===SCREEN.MENU&&(cB===2||cB===3))audio.play("uiTog");
      else if(sB!==SCREEN.HOWTO&&sB!==SCREEN.SCORES)audio.play("uiSel");
      return r;
     };
    fireJingle=()=>{
      if(autoplay||fireJingle._done)return;
      fireJingle._done=true;
      audio.play("uiJingle");
     };
    if(audio.unlocked&&audio.unlocked())fireJingle();
   }
  if(autoplay)app.startRun();

  /* app.update() contract adapter over the live Input (held axes + fire) */
  const shellInput={
    get input(){return input.input;},
    get confirmHeld(){return input._intent.fire;}
   };
  /* high-score persist through the guarded default store (§6) */
  const persistScore=()=>{
    if(!(world.score>0))return;
    saveScores(recordScore(loadScores(),
      {s:world.score,l:world.level,d:dateStr()}));
   };
  /* UI key side-channel: ALWAYS routed to the shell; M-in-PAUSE records the
     score then quits to MENU (spec §4 table). Machine self-gates elsewhere. */
  input.onUiKey=(code)=>{
    if(code==="KeyM"){
      if(app.screen===SCREEN.GAME&&app.worldState==="PAUSE"){
        persistScore();
        app.quitToMenu("PAUSE");
        if(world.state==="PAUSE")world.state="PLAY";   // drop PAUSE overlay
        setBtn("btnPause","Pause");
        prevSt=null;
       }
      return;
     }
    app.key(code);
   };

  const onPause=()=>{
    if(app.screen!==SCREEN.GAME)return;   // I2: pause exists only inside GAME;
     // outside it the world is a frozen backdrop and PAUSE would ghost-render
    if(world.state==="PLAY"){ world.state="PAUSE"; setBtn("btnPause","Resume"); }
    else if(world.state==="PAUSE"){ world.state="PLAY"; setBtn("btnPause","Pause"); }
    };
  input.onPause=onPause;

  /* pointer outside GAME = skip (INTRO) / confirm (menus) / exit ATTRACT.
     C1 single-fire: Input's fire latch listens on the SAME event (registered
     first, in the constructor), so swallow it here — otherwise the latched
     intent.fire re-enters as a rising-edge confirm on the next frame
     (auto-start after skip, toggles bouncing back, subscreens bouncing). */
  if(canvas){
    canvas.addEventListener("pointerdown",()=>{
      if(app.screen===SCREEN.GAME)return;
      input._intent.fire=false;
      if(app.screen===SCREEN.ATTRACT){app.exitAttract();return;}
      if(app.screen===SCREEN.INTRO)app.skip(); else app.confirm();
     });
   }
  /* pad taps bubble to #stage: exit ATTRACT too (spec §4 exit triggers).
     Toolbar buttons are NOT inside #stage — they unlock but never exit. */
  {
    const stageEl=(typeof document!=="undefined"&&document)?
      document.getElementById("stage"):null;
    if(stageEl)stageEl.addEventListener("pointerdown",()=>{
      if(app.screen===SCREEN.ATTRACT)app.exitAttract();
     });
   }

  /* music unlock (spec §4): first gesture anywhere unlocks the loop.
     Window-level {once:true} catches canvas AND #stage pad taps; a toolbar
     button press also unlocks without exiting attract. */
  if(typeof window!=="undefined"&&audio){
    const unlockOnce=()=>{ audio.unlock(); fireJingle(); };  // P1: deferred jingle
    window.addEventListener("keydown",unlockOnce,{once:true});
    window.addEventListener("pointerdown",unlockOnce,{once:true});
   }

  /* ATTRACT demo harness (spec §1): main owns the demo world; the shell
     machine only flips state. Same fixed-step accumulator discipline as the
     GAME branch; cycle rollover on LOSE/WIN or 20s sim-time cap. */
  let demo=null;
  const newDemoWorld=(lvl)=>{
    const w=createWorld(DEMO_SEED,lvl);
    loadLevel(w,lvl,false);            // loadLevel sets MENU...
    w.state="PLAY";                    // ...so force PLAY explicitly
    return w;
   };
  const rollDemo=()=>{
    demo.cycle=(demo.cycle%3)+1;
    demo.world=newDemoWorld(demo.cycle);
    demo.t=0;
   };
  function stepDemo(dt){
    demo.acc+=dt;
    let n=0;
    while(demo.acc>=CFG.STEP){
      const it=demo.bot.intent(demo.world);
      step(demo.world,CFG.STEP,{0:it});
      demo.t+=CFG.STEP; demo.acc-=CFG.STEP; n++;
      if(demo.world.state==="LOSE"||demo.world.state==="WIN"
        ||demo.t>=DEMO_CAP)rollDemo();
      if(n>6){demo.acc=0;break;}       // same anti-spiral cap as GAME
     }
   }

  /* renderer cache per kind, lazily built; both share the canvas
     (bakeAtlas idempotent). Toggle resizes W/H before the next render. */
  const rcache={};
  let curKind=is3d;
  function getRenderer(kind){
    if(canvas){
      canvas.width=kind==="3d"?PROJ.canvasW:CFG.COLS*CFG.TILE;
      canvas.height=kind==="3d"?PROJ.canvasH:CFG.ROWS*CFG.TILE;
      if(fit)fit();
     }
    if(!rcache[kind]){
      try{ rcache[kind]=createRenderer(canvas,{kind,
        audio:opts.audio||null,hud:opts.hud||null}); }
      catch(e){ console.warn("renderer init failed", e);
        rcache[kind]={ctx:{save(){},restore(){},translate(){},scale(){}},
          render(){},consumeEvents(){}}; }
     }
    return rcache[kind];
   }
  let renderer=getRenderer(is3d?"3d":"2d");

  /* per-screen menu chrome over the frozen arena */
  function drawShell(c){
    const s=app.screen;
    if(s===SCREEN.BOOT||s===SCREEN.GAME)return;   // GAME keeps its own overlays
    const cw=canvas?canvas.width:(curKind?PROJ.canvasW:CFG.COLS*CFG.TILE);
    const chh=canvas?canvas.height:(curKind?PROJ.canvasH:CFG.ROWS*CFG.TILE);
    if(s===SCREEN.INTRO)
      return menudraw.drawIntroChrome(c,app.subT,cw,chh);
    if(s===SCREEN.ATTRACT){
      // no dim: the demo IS the show; only the blinking footer hint
      const L=menudraw.layout(cw,chh);
      menudraw.drawAttractHint(c,L,cw,chh,app.subT);
      return;
     }
    if(s===SCREEN.MENU){
      const L=menudraw.layout(cw,chh);
      menudraw.drawDim(c,0.62,cw,chh);
      // 0.25s INTRO→MENU fade-out (skip + natural end): extra veil k ramps
      // 1→0 over the first 0.25s of MENU entry (spec §1)
      if(app.subT<0.25)menudraw.drawFade(c,1-app.subT/0.25,cw,chh);
      // logo per spec §2: reuse drawLogo at logoScale via ctx.scale
      c.save();
      c.translate(L.cx,L.logoCy);
      c.scale(L.logoScale,L.logoScale);
      drawLogo(c,world.time,0,0);
      c.restore();
      menudraw.drawMenu(c,{cursor:app.cursor,enterT:app.subT,togT:app.togT,
        items:[ITEMS[0],ITEMS[1],
          "RENDER "+(app.render3d?"3D":"2D"),
          "SOUND "+(app.sound?"ON":"OFF"),
          ITEMS[4],ITEMS[5]]},L,app.subT);
      return;
     }
    const L=menudraw.layout(cw,chh);
    if(s===SCREEN.LEVEL){
      menudraw.drawDim(c,0.72,cw,chh);
      menudraw.drawLevelSelect(c,app.level,L,app.subT);
     }
    else if(s===SCREEN.HOWTO){
      menudraw.drawDim(c,0.72,cw,chh);
      menudraw.drawHowTo(c,L,app.subT);
     }
    else if(s===SCREEN.SCORES){
      menudraw.drawDim(c,0.72,cw,chh);
      menudraw.drawScores(c,loadScores(),L,app.subT);
     }
   }

  let last=null, acc=0, running=true;
  function loop(t){
    if(last==null)last=t;
    let dt=(t-last)/1000; last=t; dt=Math.min(dt,0.25);
    if(app.render3d!==curKind){ curKind=app.render3d;
      renderer=getRenderer(curKind?"3d":"2d"); }
    touch.update(app.screen===SCREEN.GAME);   // pad lives only inside GAME
    // §4 ducking: frame-polled, idempotent, self-heals across transitions
    if(audio){
      audio.duck(app.screen===SCREEN.GAME&&audio.unlocked());
      audio.pump();
     }
    if(app.screen===SCREEN.GAME){
      // §1 score-record edge, frame-polled (main latches prev world state)
      const entry=app.noteWorldEdge(prevSt,world.state,
        {s:world.score,l:world.level,d:dateStr()});
      prevSt=world.state;
      if(entry)saveScores(recordScore(loadScores(),entry));
      acc+=dt;
      let steps=0;
      while(acc>=CFG.STEP){
        if(net)net.drive();
        else{
          const it=input.intent();
          step(world, CFG.STEP, {0:it});
          input.advance();
         }
        acc-=CFG.STEP; steps++;
        if(steps>6){ acc=0; break; }    // hard cap (anti spiral-of-death)
         }
     }else{
      app.update(dt,shellInput);
      // §1: INTRO→MENU at t>=INTRO_DUR — same skip() path as a user keypress,
      // so the 0.25s MENU-entry fade fires identically
      if(app.screen===SCREEN.INTRO&&app.subT>=INTRO_DUR)app.skip();
      acc=0;
     }
    // ATTRACT: re-read the screen AFTER app.update — the machine may have
    // entered/exited mid-frame; create/step or discard the demo accordingly
    const attract=app.screen===SCREEN.ATTRACT;
    if(attract){
      if(!demo)demo={world:newDemoWorld(1),bot:createDemobot(DEMO_SEED),
        cycle:1,t:0,acc:0};
      stepDemo(dt);
     }else if(demo)demo=null;
    // render: INTRO flyover transform wraps the ARENA draw only (zoom>=1 so
    // no edge gaps); camX/camY are canvas fractions. ATTRACT renders the DEMO
    // world with HUD suppressed; every other screen renders the frozen live
    // world exactly as before.
    const c=renderer.ctx||
      {save(){},restore(){},translate(){},scale(){}};
    c.save();
    if(app.screen===SCREEN.INTRO){
      const ph=introPhase(app.subT);
      const cw=canvas?canvas.width:(curKind?PROJ.canvasW:CFG.COLS*CFG.TILE);
      const chh=canvas?canvas.height:(curKind?PROJ.canvasH:CFG.ROWS*CFG.TILE);
      c.translate(cw/2,chh/2);
      c.scale(ph.zoom,ph.zoom);
      c.translate(-ph.camX*cw,-ph.camY*chh);
     }
    renderer.render(attract&&demo?demo.world:world, dt,
      attract?{hud:false}:undefined);
    c.restore();
    drawShell(c);
    if(running && typeof requestAnimationFrame!=="undefined")
      requestAnimationFrame(loop);
    }

   // UI buttons
  if(typeof document!=="undefined" && document.getElementById){
    const bp=document.getElementById("btnPause");
    // F3 GAME-gate: toolbar must be inert over ATTRACT/MENU (demo world is
    // live there); blur after each click so Space never re-triggers focus
    if(bp)bp.onclick=(e)=>{ if(app.screen!==SCREEN.GAME)return;
      onPause(); e&&e.currentTarget&&e.currentTarget.blur(); };
    const bs=document.getElementById("btnSound");
    if(bs)bs.onclick=(e)=>{ const on=(opts.audio && opts.audio.toggle && opts.audio.toggle());
      app.sound=!!on;
      bs.textContent="Sound: "+(on?"On":"Off");
      if(audio)audio.play("uiTog");   // §5 tog cue on the button toggle too
      e&&e.currentTarget&&e.currentTarget.blur(); };
    const br=document.getElementById("btnRestart");
    if(br)br.onclick=(e)=>{ if(app.screen!==SCREEN.GAME)return;
      loadLevel(world,1,false); world.state="PLAY";
      e&&e.currentTarget&&e.currentTarget.blur(); };
    }

   // debug/test hook (browser only; opt-in via opts.debug or ?debug=1)
  if(typeof window!=="undefined" &&
     (opts.debug===true || (typeof location!=="undefined"
       &&/[?&]debug=1/.test(location.search||"")))){
    window.__GAME__={
      G:world, renderer, input, app, net,
      step:(n=1)=>{ for(let i=0;i<n;i++){const it=input.intent(); step(world,CFG.STEP,{0:it}); input.advance();} renderer.render(world,CFG.STEP*n); },
      state:()=>app.screen===SCREEN.GAME?world.state:SCREEN_NAME[app.screen],
      reset:()=>{ app.toMenu(); },
      begin:()=>{ app.startRun(); },
      setKeys:(o)=>input.setIntent(o),
      clearAllEnemies:()=>{ world.enemies.forEach(e=>{e.dead=true;}); return world.enemies.length; },
      advance:()=>{ loadLevel(world,world.level+1,true); world.state="PLAY"; },
      canvas,
    };
    window.__pause=onPause;
    window.__resume=()=>{ if(world.state==="PAUSE") world.state="PLAY"; };
  }

   // boot
  if(typeof requestAnimationFrame!=="undefined") requestAnimationFrame(loop);
   return {world, input, renderer, app, net, loop,
    get demo(){return demo;},          // read-only for tests (spec §5.4)
    stop(){ running=false; },
    start(){ running=true; if(typeof requestAnimationFrame!=="undefined") requestAnimationFrame(loop); },
    setBtn};
}
