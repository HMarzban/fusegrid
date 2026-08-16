/* BROWSER ENTRY — wires input → deterministic sim → renderer.
   Only module that runs the RAF loop. The sim (step) and renderer never
   import this. */
import {CFG} from "./core/config.js";
import {createWorld, loadLevel} from "./core/sim.js";
import {step} from "./core/sim.js";
import {createRenderer} from "./render/renderer.js";
import {Input} from "./input.js";

export function createGame(canvas, opts={}){
  const world=createWorld(opts.seed!=null?opts.seed:((Math.random()*1e9)>>>0), 1);
  loadLevel(world,1,false);
  world.state="MENU";

   // size the canvas to the board in device pixels; scale via CSS to fit
  if(canvas){
    canvas.width=CFG.COLS*CFG.TILE;
    canvas.height=CFG.ROWS*CFG.TILE;
    const fit=()=>{
      if(typeof window==="undefined")return;
      const maxW=window.innerWidth-40, maxH=window.innerHeight-180;
      const s=Math.max(0.3, Math.min(maxW/canvas.width, maxH/canvas.height, 1.8));
      canvas.style.width=(canvas.width*s)+"px";
      canvas.style.height=(canvas.height*s)+"px";
       };
    fit();
    window.addEventListener("resize", fit);
    }

  const input=new Input(opts.canvasEl||canvas);
  const onPause=()=>{
    if(world.state==="PLAY"){ world.state="PAUSE"; setBtn("btnPause","Resume"); }
    else if(world.state==="PAUSE"){ world.state="PLAY"; setBtn("btnPause","Pause"); }
    };
  input.onPause=onPause;

   // renderer uses the real canvas; fall back to a no-op renderer on failure
  let renderer;
  try{ renderer=createRenderer(canvas,{audio:opts.audio||null, hud:opts.hud||null}); }
  catch(e){ console.warn("renderer init failed", e); renderer={render(){},consumeEvents(){}}; }

  let last=0, acc=0, running=true;
  function loop(t){
    if(!last)last=t;
    let dt=(t-last)/1000; last=t; dt=Math.min(dt,0.25);
    acc+=dt;
    let steps=0;
    while(acc>=CFG.STEP){
      const it=input.intent();
      step(world, CFG.STEP, {0:it});
      input.advance();
      acc-=CFG.STEP; steps++;
      if(steps>6){ acc=0; break; }    // hard cap (anti spiral-of-death)
       }
    renderer.render(world, dt);
    if(running) requestAnimationFrame(loop);
    }
  function setBtn(id,txt){
    if(typeof document==="undefined")return;
    const el=document.getElementById(id); if(el)el.textContent=txt;
    }

   // UI buttons
  if(typeof document!=="undefined" && document.getElementById){
    const bp=document.getElementById("btnPause");
    if(bp)bp.onclick=onPause;
    const bs=document.getElementById("btnSound");
    if(bs)bs.onclick=()=>{ const on=(opts.audio && opts.audio.toggle && opts.audio.toggle());
      bs.textContent="Sound: "+(on?"On":"Off"); };
    const br=document.getElementById("btnRestart");
    if(br)br.onclick=()=>{ loadLevel(world,1,false); world.state="PLAY"; };
    }

   // auto-start from ?play=1
  if(typeof location!=="undefined" && /[?&]play=1/.test(location.search||"")){
    world.state="PLAY";
    }

   // debug/test hook
  window.__GAME__={
    G:world, renderer, input,
    step:(n=1)=>{ for(let i=0;i<n;i++){const it=input.intent(); step(world,CFG.STEP,{0:it}); input.advance();} renderer.render(world,CFG.STEP*n); },
    state:()=>world.state,
    reset:()=>{ loadLevel(world,1,false); world.state="MENU"; },
    begin:()=>{ if(world.state==="MENU") world.state="PLAY"; },
    setKeys:(o)=>input.setIntent(o),
    clearAllEnemies:()=>{ world.enemies.forEach(e=>{e.dead=true;}); return world.enemies.length; },
    advance:()=>{ loadLevel(world,world.level+1,true); world.state="PLAY"; },
    canvas,
    };
  window.__pause=onPause;
  window.__resume=()=>{ if(world.state==="PAUSE") world.state="PLAY"; };

   // boot
  if(typeof requestAnimationFrame!=="undefined") requestAnimationFrame(loop);
  return {world, input, renderer, loop,
    stop(){ running=false; },
    start(){ running=true; if(typeof requestAnimationFrame!=="undefined") requestAnimationFrame(loop); },
    setBtn};
}
