import {CFG} from "../core/config.js";
import {sfxOf} from "../audio/item.js";
import {
  bakeAtlas, drawGrid, drawBiomeBackground, drawBricks,
  drawItems, drawEnemies, drawPlayer, drawPlayerBody, drawBombs, drawBlades, drawGhost
} from "./sprites.js";
import {onEvent, updateFx, drawFx, drawFxOverlay, drawPickupFx, feedFx, getShake, getFlash, getFx, initFx, syncFx} from "./fx.js";
import {drawOverlay, overlayBox, drawHudChips, drawAbilityBar, drawCoach, drawCoach2} from "./scenes.js";
import {draw3dBackground, buildPainters, byDepth} from "./r3d/scene3d.js";
import {PROJ, project} from "./r3d/camera.js";
import {wellBoard, hudPlate, stageGlow} from "./frame.js";
import {drawDepth} from "./depth2d.js";

const isoProj=(bx,by,h)=>{ const q=project(bx/CFG.TILE,by/CFG.TILE); return {x:q.sx,y:q.sy-(h||0)}; };

export const NET_MS=500, SNAP_MS=12;
const STILL=Object.freeze({x:0,y:0});
const clock=()=>typeof performance!=="undefined"&&performance.now?performance.now():0;
function defaultMk(w, h){
  if(typeof document!=="undefined"&&document&&document.createElement){ const c=document.createElement("canvas"); c.width=w; c.height=h; return c; }
  if(typeof OffscreenCanvas!=="undefined") return new OffscreenCanvas(w,h);
  return null;
}
const eqM=(a,b)=>!!a&&!!b&&a.a===b.a&&a.b===b.b&&a.c===b.c&&a.d===b.d&&a.e===b.e&&a.f===b.f;

/* Renderer: owns a 2D context + view. Reads world, never mutates sim state.
   consumeEvents(world,dt) flushes world.events into fx/audio, returns this so
   callers can chain. render(world) paints one frame. */
export function createRenderer(canvas, opts={}){
  /* real3d §7: "iso" aliases into the legacy branch (dimetric kept as
     ?render=iso legacy path). Real kind "3d" never reaches this factory —
     main routes it to render/three/wrapper.js createRenderer3D. */
  const kind = opts.kind==="3d"||opts.kind==="iso" ? "3d" : "2d";
  bakeAtlas(); // idempotent (BAKED.ready); textured 3D tops need sources too
  const noop=()=>{};
  const ctx = canvas && canvas.getContext ? canvas.getContext("2d",{alpha:false})
    : {save:noop,restore:noop,translate:noop,rotate:noop,scale:noop,
       fillRect:noop,strokeRect:noop,clearRect:noop,beginPath:noop,closePath:noop,
        moveTo:noop,lineTo:noop,arc:noop,arcTo:noop,bezierCurveTo:noop,
        quadraticCurveTo:noop,fill:noop,stroke:noop,ellipse:noop,transform:noop,
       createLinearGradient:()=>({addColorStop:noop}),
       createRadialGradient:()=>({addColorStop:noop}),
       drawImage:noop,fillText:noop,strokeText:noop,setTransform:noop};
  if(ctx.imageSmoothingEnabled!==undefined) ctx.imageSmoothingEnabled=false;
  const audio = opts.audio || null;
  initFx();
  /* GRAPHICS 2026-10-10. Render-on-change is armed by setPerf only, so a
     renderer nobody tunes is byte-identical to before: when the board
     signature holds, the snapshot taken after the board's restore() is
     blitted at the identity transform and only the overlay layers redraw.
     The copy is lazy: only a raster of a board still for SNAP_MS takes it,
     longer than any gap between two 60 Hz steps at FRAME RATE MAX on a
     120-240 Hz screen, so PLAY copies nothing and freezing costs one or
     two extra rasters.
     PAUSE (R16, all three looks) holds the board at the time it first saw:
     no fx step, no shake, no flash wash. */
  const mk=opts.mk||defaultMk, now=opts.now||clock;
  let armed=false, inv=true, snap=null, sctx=null, snapOK=false, snapM=null, lastRaster=-Infinity;
  let pzT=null, lastW=null, lastG=null, wasP=false, stillT0=-1, rasters=0, blits=0, snaps=0;
  const sig=new Array(12).fill(undefined);
  const d=(i,v)=>{ if(sig[i]===v)return 0; sig[i]=v; return 1; };

  function consumeEvents(world, dt, playSfx=true){
    syncFx(world);
    feedFx(world, dt||CFG.STEP);
    for(let i=0;i<world.events.length;i++){
      onEvent(world, world.events[i], world.time);
      if(audio&&playSfx!==false) audio.play(sfxOf(world.events[i]));
    }
    world.events.length=0;
    if(world.state!=="PAUSE") updateFx(dt||CFG.STEP);
  }
  /* render(world,dt,o): additive opts — o.hud===true opts into the overlay
     chips/coach (GAME only), o.sfx===false gates audio.play only. Defaults
     (o undefined) are byte-identical. */
  function render(world, dt, o){
    if(!world) return;
    const paused=world.state==="PAUSE", ev=world.events.length>0;
    if(world!==lastW||world.grid!==lastG){ if(wasP) initFx(); lastW=world; lastG=world.grid; }
    wasP=paused;
    if(!paused) pzT=null; else if(pzT==null) pzT=world.time;
    consumeEvents(world, dt, !(o&&o.sfx===false));
    if(kind==="2d") stageGlow(canvas, world.level);
    const shake=paused?STILL:getShake();
    const g=o&&o.ghost, busy=!paused&&(getFx().length>0||shake.x!==0||shake.y!==0);
    const chg=d(0,world)+d(1,paused?pzT:world.time)+d(2,world.state)+d(3,world.level)+d(4,world.grid)+d(5,ev)+d(6,busy)
      +d(7,o&&o.pop)+d(8,g?g.x:null)+d(9,g?g.y:null)+d(10,canvas&&canvas.width)+d(11,canvas&&canvas.height);
    const still=armed&&!chg&&!busy&&!ev, m0=still&&ctx.getTransform?ctx.getTransform():null, tNow=still?now():0;
    if(still&&stillT0<0) stillT0=tNow; else if(!still) stillT0=-1;
    if(still&&snapOK&&!inv&&tNow-lastRaster<NET_MS&&eqM(m0,snapM)){
      ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalCompositeOperation="copy";
      ctx.drawImage(snap,0,0); ctx.restore(); blits++;
    } else { board(world, o, shake, paused); rasters++;
      if(m0&&tNow-stillT0>=SNAP_MS&&canvas&&takeSnap()){ snaps++; snapM=m0; lastRaster=tNow; inv=false; } else snapOK=false; }
    overlay(world, o, paused?0:getFlash());
  }
  function board(world, o, shake, paused){
    const t0=world.time;
    if(paused) world.time=pzT;
    try{ boardAt(world, o, shake); }finally{ world.time=t0; }
  }
  function boardAt(world, o, shake){
    ctx.save();
    if(ctx.translate) ctx.translate(Math.round(shake.x),Math.round(shake.y));
    if(kind === "3d"){
      draw3dBackground(ctx, world);
      const ps=buildPainters(world);
      ps.sort(byDepth);
      for(const p of ps) p.draw(ctx);
    } else {
      drawBiomeBackground(ctx, world, armed);
      drawGrid(ctx, world);
      drawDepth(ctx, world);
      wellBoard(ctx, world.level);
      drawBricks(ctx, world);
      drawItems(ctx, world);
      drawBombs(ctx, world);
      drawBlades(ctx, world);
      if(o&&o.ghost) drawGhost(ctx, world, o.ghost);
      drawEnemies(ctx, world);
      /* Opening: o.pop scales players[0] about its centre (MAKO's pop-in),
         skipped at 0; absent outside INTRO, which means 1. */
      const p0=world.players[0];
      if(!(o&&o.pop!=null)) drawPlayer(ctx, world);
      else if(o.pop>0&&p0&&p0.alive!==false){
        ctx.save(); ctx.translate(p0.x,p0.y); ctx.scale(o.pop,o.pop);
        drawPlayerBody(ctx, world, p0); ctx.restore();
      }
      drawFx(ctx);
    }
    ctx.restore();
  }
  function takeSnap(){
    const w=canvas.width, h=canvas.height;
    if(!snap){ snap=mk(w,h); sctx=snap&&snap.getContext?snap.getContext("2d"):null; }
    if(!sctx||!(w>0&&h>0)) return snapOK=false;
    if(snap.width!==w) snap.width=w;
    if(snap.height!==h) snap.height=h;
    sctx.globalCompositeOperation="copy";
    sctx.drawImage(canvas,0,0);
    return snapOK=true;
  }
  function overlay(world, o, fl){
    if(fl>0){
      ctx.globalAlpha=fl*0.28;
      ctx.fillStyle="#ffe8a8";
      ctx.fillRect(0,0,CFG.COLS*CFG.TILE,CFG.ROWS*CFG.TILE);
      ctx.globalAlpha=1;
    }
    if(world.state!=="PLAY"){
      const B=overlayBox(kind==="3d"?"iso":"2d");
      drawOverlay(ctx, world, B.w, B.h, B.cx, B.cy, o&&o.pause, o&&o.time, o&&o.run, o&&o.toast);
      if(world.state==="WIN"||world.state==="LOSE") drawFx(ctx);
    }
    /* S4: overlay HUD chips — explicit opt-in only ({hud:true} during GAME),
       drawn after restore so they never shake with the camera. */
    if(o&&o.hud===true&&kind==="2d") hudPlate(ctx, false, world.level);
    if(o&&o.hud===true) drawHudChips(ctx, world, o&&o.time);
    if(o&&o.hud===true&&kind==="2d") drawAbilityBar(ctx, world);
    if(o&&o.hud===true&&world.state==="PLAY") drawFxOverlay(ctx);
    if(o&&o.hud===true&&world.state==="PLAY") drawPickupFx(ctx, kind==="3d"?{coach:o.coach2,proj:isoProj,bw:PROJ.canvasW}:{coach:o.coach2});
    /* ghost coach (plan 4): same opt-in gate as the HUD chips; o.coach is
       the fade alpha precomputed in main.js from coachOpen(...) + COACH_DUR
       + world.state==="PLAY" (0 when closed), never re-derived here. */
    if(o&&o.hud===true) drawCoach(ctx, (o&&o.coach)||0);
    if(o&&o.hud===true) drawCoach2(ctx, (o&&o.coach2&&o.coach2.a)||0, (o&&o.coach2&&o.coach2.s)||"");
  }
  const surface={canvas, ctx, render, consumeEvents, getShake};
  Object.defineProperties(surface,{
    setPerf:{enumerable:false,value:(K)=>{ if(K){ armed=true; inv=true; } }},
    invalidate:{enumerable:false,value:(re)=>{ inv=true; if(re) pzT=null; }},
    _dbg:{enumerable:false,value:{get armed(){return armed;},get rasters(){return rasters;},get blits(){return blits;},get snaps(){return snaps;},get snap(){return snap;}}}});
  return surface;
}
