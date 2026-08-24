import {CFG} from "../core/config.js";
import {
  bakeAtlas, drawGrid, drawBiomeBackground, drawBricks,
  drawItems, drawEnemies, drawPlayer, drawBombs, drawBlades
} from "./sprites.js";
import {onEvent, updateFx, drawFx, getShake, initFx, syncFx} from "./fx.js";
import {drawOverlay, updateHud, makeHud} from "./scenes.js";
import {draw3dBackground, buildPainters, byDepth} from "./r3d/scene3d.js";
import {PROJ} from "./r3d/camera.js";

/* Renderer: owns a 2D context + view. Reads world, never mutates sim state.
   consumeEvents(world,dt) flushes world.events into fx/audio, returns this so
   callers can chain. render(world) paints one frame. */
export function createRenderer(canvas, opts={}){
  const kind = opts.kind==="3d" ? "3d" : "2d";
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
  const hud = opts.hud || makeHud(typeof document!=="undefined"?document:null);
  const audio = opts.audio || null;
  initFx();

  function consumeEvents(world, dt, playSfx=true){
    syncFx(world);
    for(let i=0;i<world.events.length;i++){
      onEvent(world, world.events[i], world.time);
      if(audio&&playSfx!==false) audio.play(world.events[i].t);
    }
    world.events.length=0;
    updateFx(dt||CFG.STEP);
  }
  /* render(world,dt,o): additive opts — o.hud===false skips HUD DOM writes
     (attract demo must not touch the score readout), o.sfx===false gates
     audio.play only. Defaults (o undefined) are byte-identical. */
  function render(world, dt, o){
    if(!world) return;
    consumeEvents(world, dt, !(o&&o.sfx===false));
    const shake=getShake();
    ctx.save();
    if(ctx.translate) ctx.translate(Math.round(shake.x),Math.round(shake.y));
    if(kind === "3d"){
      draw3dBackground(ctx, world);
      const ps=buildPainters(world);
      ps.sort(byDepth);
      for(const p of ps) p.draw(ctx);
    } else {
      drawBiomeBackground(ctx, world);
      drawGrid(ctx, world);
      drawBricks(ctx, world);
      drawItems(ctx, world);
      drawBombs(ctx, world);
      drawBlades(ctx, world);
      drawEnemies(ctx, world);
      drawPlayer(ctx, world);
      drawFx(ctx);
    }
    ctx.restore();
    if(world.state!=="PLAY"){
      if(kind === "3d") drawOverlay(ctx, world, PROJ.canvasW, PROJ.canvasH, 304, 188);
      else drawOverlay(ctx, world);
    }
    if(!(o&&o.hud===false)) updateHud(hud, world);
  }
  return {canvas, ctx, render, consumeEvents, getShake};
}
