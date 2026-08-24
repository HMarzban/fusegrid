/* createRenderer3D (real3d spec §1/§7) — WebGL bottom layer under the classic
   2D overlay. Surface contract mirrors createRenderer exactly:
   {canvas:#gl, overlay:#c, ctx:overlay 2D ctx, render(world,dt,o),
    consumeEvents(world,dt), getShake} — same call shapes the main loop uses.
   Headless/no-WebGL => stub mode: THREE Scene still assembled and updated
   (Node-testable), only the GL draw is skipped; ctx falls back to a noop 2D
   object so main's shell path never throws. fx stays the single singleton
   store (see fx.js header): events drained here exactly like the 2D path. */
import * as THREE from "../../../vendor/three.module.js";
import {CFG} from "../../core/config.js";
import {biomeOf} from "../../core/config.js";
import {buildScene, disposeGroup} from "./scene.js";
import {createRig, applyOrbit} from "./camrig.js";
import {buildAtlas} from "./textures.js";
import {onEvent, updateFx, getShake, syncFx} from "../fx.js";

const W=CFG.COLS*CFG.TILE, H=CFG.ROWS*CFG.TILE;
const noop=()=>{};

function makeOverlayCtx(canvas){
  if(canvas&&canvas.getContext)
    return canvas.getContext("2d",{alpha:true});
  return {save:noop,restore:noop,translate:noop,rotate:noop,scale:noop,
    fillRect:noop,strokeRect:noop,clearRect:noop,beginPath:noop,closePath:noop,
    moveTo:noop,lineTo:noop,arc:noop,arcTo:noop,bezierCurveTo:noop,
    quadraticCurveTo:noop,fill:noop,stroke:noop,ellipse:noop,transform:noop,
    createLinearGradient:()=>({addColorStop:noop}),
    createRadialGradient:()=>({addColorStop:noop}),
    drawImage:noop,fillText:noop,strokeText:noop,setTransform:noop};
}

export function createRenderer3D(glCanvas, overlayCanvas, opts={}){
  const ovCtx=makeOverlayCtx(overlayCanvas);
  const audio=opts.audio||null;

  /* GL init guarded three ways: absent canvas (headless), context probe that
     is not a real object (recording-proxy test stubs return functions), and
     constructor throw (no WebGL) all degrade to stub mode. */
  let gl=null;
  try{
    if(glCanvas&&typeof glCanvas.getContext==="function"){
      const probe=glCanvas.getContext("webgl2");
      if(probe&&typeof probe==="object"){
        gl=new THREE.WebGLRenderer({canvas:glCanvas,alpha:true,antialias:true});
        const dpr=(typeof devicePixelRatio!=="undefined"?devicePixelRatio:1)||1;
        gl.setPixelRatio(Math.min(dpr,2));          // spec §9.9: DPR <= 2
        gl.setSize(W,H,false);                      // logical box; CSS scales
        gl.shadowMap.enabled=true;
        gl.shadowMap.type=THREE.PCFSoftShadowMap;   // spec §6
       }
     }
   }catch(e){ gl=null; }

  const scene3=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(45,W/H,1,2500);
  const rig=createRig();
  /* zero-asset atlas (§5): built once lazily; null headless => color
     fallbacks everywhere downstream */
  let atlas, atlasTried=false;
  function getAtlas(){
    if(!atlasTried){ atlasTried=true;
      try{ atlas=buildAtlas(); }catch(e){ atlas=null; } }
    return atlas;
   }
  let sc=null;
  function rebuild(world){
    if(sc){ scene3.remove(sc.group); disposeGroup(sc.group); }
    sc=buildScene(world,getAtlas());
    scene3.background=new THREE.Color(biomeOf(world.level).bg1);
    scene3.add(sc.group);
   }

  function consumeEvents(world, dt, playSfx=true){
    syncFx(world);
    for(let i=0;i<world.events.length;i++){
      onEvent(world, world.events[i], world.time);
      if(audio&&playSfx!==false) audio.play(world.events[i].t);
    }
    world.events.length=0;
    updateFx(dt||CFG.STEP);
  }

  function render(world, dt, o){
    if(!world)return;
    consumeEvents(world, dt, !(o&&o.sfx===false));
    if(!sc||sc.update(world))rebuild(world);   // brick rescan / level rebuild
    applyOrbit(camera,rig,getShake());         // shake = camera-target offset
    if(gl)gl.render(scene3,camera);
   }

  return {canvas:glCanvas,overlay:overlayCanvas,ctx:ovCtx,render,
    consumeEvents,getShake};
}
