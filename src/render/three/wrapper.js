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
import {introCam} from "./flythrough.js";
import {createParticles} from "./particles.js";
import {buildAtlas} from "./textures.js";
import {drawHudChips, drawOverlay, updateHud} from "../scenes.js";
import {onEvent, updateFx, getShake, getFx, syncFx} from "../fx.js";

const W=CFG.COLS*CFG.TILE, H=CFG.ROWS*CFG.TILE;
const noop=()=>{};
export const DPR_MAX=2;                     // spec §9.9

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
  const hud=opts.hud||null;

  /* GL init guarded three ways: absent canvas (headless), context probe that
     is not a real object (recording-proxy test stubs return functions), and
     constructor throw (no WebGL) all degrade to stub mode. */
  let gl=null, dprUsed=1;
  try{
    if(glCanvas&&typeof glCanvas.getContext==="function"){
      const probe=glCanvas.getContext("webgl2");
      if(probe&&typeof probe==="object"){
        gl=new THREE.WebGLRenderer({canvas:glCanvas,alpha:true,antialias:true});
        const dpr=(typeof devicePixelRatio!=="undefined"?devicePixelRatio:1)||1;
        dprUsed=Math.min(dpr,DPR_MAX);
        gl.setPixelRatio(dprUsed);                // spec §9.9: DPR <= 2
        gl.setSize(W,H,false);                      // logical box; CSS scales
        gl.shadowMap.enabled=true;
        gl.shadowMap.type=THREE.PCFSoftShadowMap;   // spec §6
       }
     }
   }catch(e){ gl=null; }

  const scene3=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(45,W/H,1,2500);
  const rig=createRig();
  /* S3: fx-store particles ride the scene ROOT (not sc.group) so level
     rebuilds never orphan live bursts; syncFx wipes them on world change. */
  const fxp=createParticles();
  scene3.add(fxp.points);
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
    /* S3: INTRO in kind 3d hands the camera to the flythrough keyframes
       (o.intro = app.subT from main; logo/tagline stay on the 2D overlay);
       every other screen keeps the orbit rig + shake. */
    if(o&&o.intro!=null)applyOrbit(camera,introCam(o.intro),{x:0,y:0});
    else applyOrbit(camera,rig,getShake());    // shake = camera-target offset
    fxp.update(getFx());
    if(gl)gl.render(scene3,camera);
    /* S4+S5: WIN/LOSE/PAUSE overlays ride the classic 2D layer exactly like
       kind 2d — drawOverlay's defaults already match this canvas' space
       (600x520, centered); the overlay is cleared first so nothing smears.
       MENU stays out: shell screens own their canvases via menudraw. Chips
       remain opt-in ({hud:true}) and draw after the veil (2D parity). */
    const ov=world.state==="WIN"||world.state==="LOSE"
      ||world.state==="PAUSE";
    if(ov||(o&&o.hud===true)){
      ovCtx.clearRect(0,0,W,H);
      if(ov)drawOverlay(ovCtx,world);
      if(o&&o.hud===true)drawHudChips(ovCtx,world);
     }
    /* S5: DOM #hud ids route like the 2D path — {hud:false} suppresses
       (attract demo), every other frame writes score/level/lives/etc. */
    if(!(o&&o.hud===false))updateHud(hud,world);
   }

  const surface={canvas:glCanvas,overlay:overlayCanvas,ctx:ovCtx,render,
    consumeEvents,getShake};
  /* Test/perf seam (non-enumerable: Object.keys surface contract unchanged):
     scene root for the §8 draw-call traverse, camera for shake/flythrough
     math checks, particles pool + effective DPR for the DPR<=2 gate. */
  Object.defineProperty(surface,"_dbg",{enumerable:false,value:{
    get scene(){return scene3;},get camera(){return camera;},
    get particles(){return fxp;},get dpr(){return dprUsed;}}});
  return surface;
}
