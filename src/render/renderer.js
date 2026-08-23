import {CFG} from "../core/config.js";
import {
  bakeAtlas, drawGrid, drawBiomeBackground, drawBricks,
  drawItems, drawEnemies, drawPlayer, drawBombs, drawBlades
} from "./sprites.js";
import {onEvent, updateFx, drawFx, getShake, initFx, syncFx} from "./fx.js";
import {drawOverlay, updateHud, makeHud} from "./scenes.js";
import {draw3dBackground, buildPainters, byDepth} from "./r3d/scene3d.js";

/* Renderer: owns a 2D context + view. Reads world, never mutates sim state.
   consumeEvents(world,dt) flushes world.events into fx/audio, returns this so
   callers can chain. render(world) paints one frame. */
export function createRenderer(canvas, opts={}){
  const kind = opts.kind || "2d";
  if(kind === "2d") bakeAtlas();
  const noop=()=>{};
  const ctx = canvas && canvas.getContext ? canvas.getContext("2d",{alpha:false})
    : {save:noop,restore:noop,translate:noop,rotate:noop,scale:noop,
       fillRect:noop,strokeRect:noop,clearRect:noop,beginPath:noop,closePath:noop,
       moveTo:noop,lineTo:noop,arc:noop,arcTo:noop,bezierCurveTo:noop,
       quadraticCurveTo:noop,fill:noop,stroke:noop,ellipse:noop,
       createLinearGradient:()=>({addColorStop:noop}),
       createRadialGradient:()=>({addColorStop:noop}),
       drawImage:noop,fillText:noop,strokeText:noop,setTransform:noop};
  if(ctx.imageSmoothingEnabled!==undefined) ctx.imageSmoothingEnabled=false;
  const hud = opts.hud || makeHud(typeof document!=="undefined"?document:null);
  const audio = opts.audio || null;
  initFx();

  function consumeEvents(world, dt){
    syncFx(world);
    for(let i=0;i<world.events.length;i++){
      onEvent(world, world.events[i], world.time);
      if(audio) audio.play(world.events[i].t);
    }
    world.events.length=0;
    updateFx(dt||CFG.STEP);
  }
  function render(world, dt){
    if(!world) return;
    consumeEvents(world, dt);
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
    if(world.state!=="PLAY") drawOverlay(ctx, world);
    updateHud(hud, world);
  }
  return {canvas, ctx, render, consumeEvents, getShake};
}
