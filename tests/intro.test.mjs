/* OPENING (spec 2026-10-09-opening-design §3/§7/§11): the title + show beat
   table, MAKO's pop, and the throwaway show world whose boom reveals MENU. */
import {SHOW_STEP,SHOW_DUR,SHOW_PLANT,SKIP_GUARD,SHOW_SCRIPT,introPhase,popOf,createShow,stepShow} from "../src/app/intro.js";
import {MUSIC_TRACKS} from "../src/audio/tracks.js";
import {CFG} from "../src/core/config.js";
import {SCREEN,createMenuApp} from "../src/app/menuapp.js";
import {createRenderer} from "../src/render/renderer.js";

let pass=0, fail=0;
function check(name, cond, detail){ cond?pass++:fail++;
  console.log((cond?"  PASS ":"  FAIL ")+name+(detail!==undefined?" -> "+detail:"")); }
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

// ---- the show grid IS the menu track's grid ----
check("SHOW_STEP === MUSIC_TRACKS.menu.A.STEP", SHOW_STEP===MUSIC_TRACKS.menu.A.STEP, SHOW_STEP);
check("SHOW_DUR === 32*SHOW_STEP (two bars, 4.384 s)", SHOW_DUR===32*SHOW_STEP&&Math.abs(SHOW_DUR-4.384)<1e-9, SHOW_DUR);
check("SHOW_PLANT === SHOW_DUR - CFG.FUSE (derived, never authored)", SHOW_PLANT===SHOW_DUR-CFG.FUSE, SHOW_PLANT);
check("SKIP_GUARD === 0.20", SKIP_GUARD===0.2);
check("SHOW_SCRIPT is frozen", Object.isFrozen(SHOW_SCRIPT)&&SHOW_SCRIPT.every(Object.isFrozen));

// ---- title drift: zoom >= 1, pan inside the no-gap clamp, for 120 s ----
{
  let ok=true, minZ=9;
  for(let t=0;t<=120;t+=1/30){
    const p=introPhase(0,t), lo=0.5/p.zoom;
    minZ=Math.min(minZ,p.zoom);
    if(p.zoom<1||p.camX<lo-1e-12||p.camX>1-lo+1e-12||p.camY<lo-1e-12||p.camY>1-lo+1e-12||p.veil!==0.45)ok=false;
  }
  check("title drift keeps zoom >= 1 and the pan inside [0.5/z, 1-0.5/z] over 120 s, veil 0.45", ok, "min zoom "+minZ);
}
{
  let ok=true;
  for(let t=0;t<=SHOW_DUR+0.5;t+=1/60){
    const p=introPhase(1,t,2.3), lo=0.5/p.zoom;
    if(p.zoom<1||p.camX<lo-1e-12||p.camX>1-lo+1e-12||p.camY<lo-1e-12||p.camY>1-lo+1e-12)ok=false;
  }
  check("show keeps zoom >= 1 and the pan inside the no-gap clamp", ok);
}
{
  let ok=true;
  for(const pT of [0,0.25,1.9,7.7,99.1]) if(!same(introPhase(1,0,pT),introPhase(0,pT)))ok=false;
  check("press continuity: introPhase(1,0,pT) deep-equals introPhase(0,pT)", ok);
}
{
  const e=introPhase(1,SHOW_DUR,3.1), f=introPhase(1,SHOW_DUR+2,3.1);
  check("introPhase(1,SHOW_DUR) is MENU's frame exactly (zoom 1, cam 0.5/0.5)",
    e.zoom===1&&e.camX===0.5&&e.camY===0.5&&same(e,f), JSON.stringify(e));
  const c=introPhase(1,12*SHOW_STEP,0);
  check("show holds the zoom-1.8 close-up on MAKO's spawn corner (clamped)",
    Math.abs(c.zoom-1.8)<1e-9&&Math.abs(c.camX-0.5/1.8)<1e-9&&Math.abs(c.camY-0.5/1.8)<1e-9,
    c.zoom+"/"+c.camX.toFixed(4)+"/"+c.camY.toFixed(4));
  check("show veil 0.45 -> 0.12 by 8S", introPhase(1,0).veil===0.45&&Math.abs(introPhase(1,8*SHOW_STEP).veil-0.12)<1e-12);
  let worst=0;
  for(let t=0;t<SHOW_DUR+0.1;t+=1/60){
    const a=introPhase(1,t,1), b=introPhase(1,t+1/60,1);
    worst=Math.max(worst,Math.abs(b.zoom-a.zoom),Math.abs(b.camX-a.camX),Math.abs(b.camY-a.camY));
  }
  check("dense scan: no zoom/pan jump > 0.04 per 60 fps frame", worst<0.04, worst.toFixed(4));
}

// ---- MAKO pop ----
check("popOf is 0 before 4S", popOf(0)===0&&popOf(4*SHOW_STEP-1e-6)===0);
check("popOf is exactly 1 from 4S+0.25 on", popOf(4*SHOW_STEP+0.25)===1&&popOf(9)===1);
{
  let mx=0; for(let t=4*SHOW_STEP;t<4*SHOW_STEP+0.25;t+=0.002)mx=Math.max(mx,popOf(t));
  check("popOf overshoots ~1.1 (easeOutBack)", mx>1.05&&mx<1.15, mx.toFixed(3));
}

// ---- the show world ----
function runShow(){
  const s=createShow(), app={showBoom:false}, ev=[];
  const N=Math.round((SHOW_DUR+0.2)/CFG.STEP);
  for(let i=0;i<N;i++){
    stepShow(s,CFG.STEP*(1+1e-9),app,1);
    for(const e of s.world.events)ev.push({t:s.n*CFG.STEP,e:e.t,x:e.x,y:e.y});
    s.world.events.length=0;
    if(!s.blast&&s.world.blades.length){ const tl=s.world.blades[0].tiles; s.blast=tl.length; s.arms=new Set(tl.map(t=>t.tx+","+t.ty)); }
  }
  return {s,ev,app};
}
{
  const {s,ev,app}=runShow();
  const bombs=ev.filter(x=>x.e==="bomb"), booms=ev.filter(x=>x.e==="boom");
  check("exactly one bomb, at SHOW_PLANT +- CFG.STEP", bombs.length===1&&Math.abs(bombs[0].t-SHOW_PLANT)<=CFG.STEP+1e-9,
    bombs.map(x=>x.t.toFixed(4)).join());
  check("the show bomb is planted on (3,1) as a PIERCE bomb", same(bombs.map(x=>[x.x,x.y]),[[140,60]])&&s.world.players[0].bombKind==="pierce",
    JSON.stringify(bombs.map(x=>[x.x,x.y])));
  check("the reveal blast is a 13-tile T that breaks 7 bricks (the climax, not a 3-tile corner)",
    s.blast===13&&ev.filter(x=>x.e==="brick").length===7, s.blast+" tiles / "+ev.filter(x=>x.e==="brick").length+" bricks");
  const p=s.world.players[0];
  check("MAKO ends on (1,2), off every arm of the blast", p.tx===1&&p.ty===2&&!s.arms.has(p.tx+","+p.ty), p.tx+","+p.ty);
  check("its boom lands within CFG.STEP of SHOW_DUR", booms.length===1&&Math.abs(booms[0].t-SHOW_DUR)<=CFG.STEP+1e-9,
    booms.map(x=>x.t.toFixed(4)).join());
  check("stepShow flags the boom on the app", app.showBoom===true);
  check("MAKO alive, state PLAY", s.world.players[0].alive!==false&&s.world.state==="PLAY", s.world.state);
  check("no kill / hurt / win event", !ev.some(x=>x.e==="kill"||x.e==="hurt"||x.e==="win"), ev.map(x=>x.e).join());
  check("every enemy held at speed 0", s.world.enemies.length>0&&s.world.enemies.every(e=>e.speed===0));
  check("MAKO never blinks in the show (no spawn iFrames)", createShow().world.players[0].iFrames===0);
  check("CORE room 1: heat 0, pact 0, pace 0", s.world.level===1&&(s.world.heat|0)===0&&(s.world.pact|0)===0&&(s.world.pace|0)===0);
  const b=runShow();
  check("deterministic across two runs", same(b.ev,ev)&&b.s.world.players[0].x===s.world.players[0].x
    &&b.s.world.players[0].y===s.world.players[0].y);
}
{
  const s=createShow(), app={showBoom:false};
  stepShow(s,1,app,0);
  check("stepShow does nothing on the title (mode 0)", s.n===0&&s.world.time===0);
  stepShow(s,0.25,app,1);
  check("stepShow catches up a whole 0.25 s frame (main's dt clamp): no show time dropped",
    s.n===Math.floor(0.25/CFG.STEP+1e-9)&&s.acc<CFG.STEP, s.n);
  const t=createShow(); stepShow(t,5,app,1);
  check("stepShow still caps a runaway frame (no spiral)", t.n<=Math.ceil(0.25/CFG.STEP)+2&&t.acc===0, t.n);
}

// ---- a skipped show: the walk goes on behind MENU, the fire never does ----
for(const [skipAt,wantBomb] of [[0.3,false],[1.0,false],[2.0,true],[2.2,true]]){
  const s=createShow(), app={showBoom:false}, ev=[];
  for(let i=0;i<Math.round(8/CFG.STEP);i++){
    stepShow(s,CFG.STEP*(1+1e-9),app,s.n*CFG.STEP<skipAt?1:2);
    for(const e of s.world.events)ev.push(e.t); s.world.events.length=0;
  }
  const bombs=ev.filter(e=>e==="bomb").length;
  check("skip at "+skipAt+" s: "+(wantBomb?"the planted bomb still blows":"zero bombs, ever")
    +"; MAKO alive, PLAY, no hurt/kill",
    bombs===(wantBomb?1:0)&&s.world.players[0].alive!==false&&s.world.state==="PLAY"&&!ev.includes("hurt")&&!ev.includes("kill"),
    ev.join());
}

// ---- hitch pin: MENU opens one frame after the boom, never before ----
{
  const app=createMenuApp({cabinetSeen:true}), s=createShow();
  app.beginShow();
  const dts=[0.25,0.25,0.25]; let f=0, boomF=-1, menuF=-1, boomT=-1;
  while(f<2000&&menuF<0){
    const dt=f<dts.length?dts[f]:1/60;
    app.update(dt,null);
    if(app.screen===SCREEN.MENU){menuF=f;break;}
    stepShow(s,dt,app,app.screen!==SCREEN.INTRO?2:app.introStage);
    if(boomF<0&&s.world.events.some(e=>e.t==="boom")){boomF=f; boomT=app.subT;}
    s.world.events.length=0;
    f++;
  }
  check("hitch: the boom still lands within one frame of SHOW_DUR of subT (no show time dropped)",
    boomF>0&&Math.abs(boomT-SHOW_DUR)<=1/60+CFG.STEP, "boom frame "+boomF+" subT "+boomT.toFixed(4));
  check("hitch: MENU opens exactly one frame after the boom, with fromShow", menuF===boomF+1&&app.fromShow===true&&app.cursor===0,
    boomF+" -> "+menuF);
}

// ---- CLASSIC 2D draws MAKO at o.pop: hidden at 0, scaled about players[0] after ----
{
  const at=(pop)=>{
    const ops=[], ctx=new Proxy({},{get:(t,p)=>typeof p==="symbol"?undefined:p in t?t[p]:(...a)=>{
      ops.push([p,a]); return /Gradient$/.test(p)?{addColorStop(){}}:p==="measureText"?{width:0}:undefined; },
      set:(t,p,v)=>{ t[p]=v; return true; }});
    const w=createShow().world, p=w.players[0];
    createRenderer({width:600,height:520,getContext:()=>ctx},{kind:"2d"}).render(w,1/60,{pop,hud:false});
    const i=ops.findIndex((o)=>o[0]==="translate"&&o[1][0]===p.x&&o[1][1]===p.y);
    return {i, next:i>=0?ops[i+1]:null};
  };
  check("pop 0: MAKO is not drawn (no translate to players[0]); no pop draws him", at(0).i<0&&at(undefined).i>=0);
  const h=at(0.5);
  check("pop 0.5: MAKO is scaled by pop about players[0]", h.i>=0&&same(h.next,["scale",[0.5,0.5]]), JSON.stringify(h.next));
}

console.log("\n  INTRO RESULT: "+pass+" PASS / "+fail+" FAIL");
process.exit(fail?1:0);
