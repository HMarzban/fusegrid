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
import {sfxOf} from "../../audio/item.js";
import {buildScene, disposeGroup, RIM_W, RIM_LIP} from "./scene.js";
import {applyBright} from "./lights.js";
import {createRig, applyOrbit, CAM_FOV} from "./camrig.js";
import {introCam} from "./flythrough.js";
import {createParticles} from "./particles.js";
import {buildAtlas} from "./textures.js";
import {stageGlow, stageBack, hudPlate3} from "../frame.js";
import {drawHudChips, drawAbilityBar, drawOverlay, overlayBox, drawCoach, drawCoach2} from "../scenes.js";
import {onEvent, updateFx, getShake, getFlash, getFx, feedFx, drawFxOverlay, drawPickupFx, syncFx, initFx} from "../fx.js";

const W=CFG.COLS*CFG.TILE, H=CFG.ROWS*CFG.TILE;
const RIM_OX=W/2+RIM_W-2, RIM_OZ=H/2+RIM_W-2;     // the rim's outer reach (scene.js buildRim)
const noop=()=>{};
export const DPR_MAX=3;                     // RESOLUTION FULL (opt-in); default min(dpr,2)
/* GRAPHICS 2026-10-10: the probe and three get ONE attribute object. The
   probe used to pass none, which fixed the context to the browser default
   before three asked; ATTR0 is exactly that default, so AUTO is today. */
export const ATTR0=Object.freeze({alpha:true,antialias:true,stencil:false,depth:true,
  premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:"default",
  failIfMajorPerformanceCaveat:false});
export const NET_MS=500, DEAD_MS=3000;
const STILL=Object.freeze({x:0,y:0});
const clock=()=>typeof performance!=="undefined"&&performance.now?performance.now():0;
/* Board px (bx,by) at world height h -> overlay px through the LIVE camera,
   re-read every frame (the wheel dolly and shake move it). Pure over the
   camera; refreshes matrixWorld itself, since stub mode never runs
   gl.render, unless held (the pickup labels refresh once per frame and then
   project every box through the held matrix). */
const PV=new THREE.Vector3();
export function projBoard(camera,bx,by,h=0,held){
  if(!held)camera.updateMatrixWorld();
  PV.set(bx-W/2,h,by-H/2).project(camera);
  return {x:(PV.x+1)*W/2,y:(1-PV.y)*H/2};
}

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
  const rig=opts.rig||createRig();
  const proj=(bx,by,h)=>projBoard(camera,bx,by,h,1);
  const K0=opts.perf||null, now=opts.now||clock;
  const ATTR={...ATTR0,antialias:!K0||K0.aa!==false};
  let shadow=K0&&K0.shadow||"soft", armed=false, inv=true, lost=false, lostAt=0;
  let glRenders=0, shadowUpdates=0, shadowNeed=true, lastRaster=-Infinity, pzT=null, lastW=null, lastG=null, wasP=false;

  /* GL init guarded three ways: absent canvas (headless), context probe that
     is not a real object (recording-proxy test stubs return functions), and
     constructor throw (no WebGL) all degrade to stub mode. */
  let gl=null, dprUsed=1;
  try{
    if(glCanvas&&typeof glCanvas.getContext==="function"){
      const probe=glCanvas.getContext("webgl2",ATTR);
      if(probe&&typeof probe==="object"){
        gl=opts.makeGL?opts.makeGL(glCanvas,ATTR):new THREE.WebGLRenderer({canvas:glCanvas,...ATTR});
        const dpr=(typeof devicePixelRatio!=="undefined"?devicePixelRatio:1)||1;
        dprUsed=K0&&K0.dpr3d>0?Math.min(K0.dpr3d,DPR_MAX):Math.min(dpr,2);
        gl.setPixelRatio(dprUsed);                // spec §9.9: DPR <= 2 unless FULL
        gl.setSize(W,H,false);                      // logical box; CSS scales
        setShadow();                                // spec §6: SOFT = PCFSoft
        /* NO tone mapping (2026-09-04 brightness pass). CLASSIC 2D blits the
           authored BIOMES hex literally, so REAL 3D has to as well or the two
           renderers disagree about one palette. ACES at exposure 1 also mapped
           linear 0.02 -> 0.007, capped white at 0.763, and its input matrix
           annihilated low channels — JUNGLE floor0 came out with NO red at
           all. That was the "murky, no punch" complaint. */
        gl.toneMapping=THREE.NoToneMapping;
       }
     }
   }catch(e){ gl=null; }

  const scene3=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(CAM_FOV,W/H,1,3000);
  /* S3: fx-store particles ride the scene ROOT (not sc.group) so level
     rebuilds never orphan live bursts; syncFx wipes them on world change. */
  const fxp=createParticles();
  scene3.add(fxp.points);
  /* zero-asset atlas (§5): lazy per world.level; reused across rebuilds
     until the level changes (old maps dispose on replace). Headless =>
     null => color fallbacks downstream. */
  let atlas=null, atlasLvl, atlasReady=false;
  function getAtlas(world){
    const lvl=world&&world.level;
    if(atlasReady&&atlasLvl===lvl)return atlas;
    let next=null;
    try{ next=buildAtlas(undefined,lvl); }catch(e){ next=null; }
    if(atlas&&atlas!==next)
      for(const k in atlas){ const tx=atlas[k]; if(tx&&tx.dispose)tx.dispose(); }
    atlas=next; atlasLvl=lvl; atlasReady=true;
    return atlas;
   }
  function setShadow(){
    if(!gl)return;
    gl.shadowMap.enabled=shadow!=="off";
    gl.shadowMap.type=shadow==="sharp"?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;
   }
  let sc=null, brightK=1;
  function rebuild(world){
    if(sc){ scene3.remove(sc.group); disposeGroup(sc.group); }
    sc=buildScene(world,getAtlas(world),brightK);
    setShadow(); shadowNeed=inv=true;
    const biome=biomeOf(world.level);
    scene3.background=gl?null:new THREE.Color(biome.bg1);
    stageBack(glCanvas,world.level); stageGlow(overlayCanvas,world.level);
    /* No distance fog. On the rig of the 2026-09-04 pass the far board
       corners sat at d 963, and Fog(bg1,700,1600) was replacing 43% of them
       with the darkest colour in the biome — 89% out at the DIST_MAX dolly
       clamp. They now sit at 1689.9 (2700.4 at DIST_MAX), so fog would only
       bite harder. A board that must stay legible at every zoom cannot have
       fog over it. */
    scene3.fog=null;
    scene3.add(sc.group);
   }

  function consumeEvents(world, dt, playSfx=true){
    syncFx(world);
    feedFx(world, dt||CFG.STEP);
    for(let i=0;i<world.events.length;i++){
      onEvent(world, world.events[i], world.time);
      if(audio&&playSfx!==false) audio.play(sfxOf(world.events[i]));
    }
    world.events.length=0;
    if(world.state!=="PAUSE")updateFx(dt||CFG.STEP);
  }

  /* Render-on-change (armed by setPerf only): the board signature, the
     caster subset that re-renders the shadow map, and the 500 ms net
     (a lost context honours it too, so a frozen board does no scene work). */
  const sig=new Array(18).fill(undefined), cas=new Array(6).fill(undefined);
  function d(a,i,v){ if(a[i]===v)return 0; a[i]=v; return 1; }

  function render(world, dt, o){
    if(!world)return;
    const paused=world.state==="PAUSE", ev=world.events.length>0;
    if(world!==lastW||world.grid!==lastG){ if(wasP)initFx(); lastW=world; lastG=world.grid; }
    wasP=paused;
    if(!paused)pzT=null; else if(pzT==null)pzT=world.time;
    consumeEvents(world, dt, !(o&&o.sfx===false));
    const bk=o&&typeof o.bright==="number"&&isFinite(o.bright)?o.bright:brightK;
    const pop=o&&o.pop!=null?o.pop:1, sh=paused?STILL:getShake();
    const tB=paused?pzT:world.time, g=o&&o.ghost;
    const busy=!paused&&(getFx().length>0||sh.x!==0||sh.y!==0);
    const rt=rig.target, chg=d(sig,0,world)+d(sig,1,tB)+d(sig,2,world.state)+d(sig,3,world.level)+d(sig,4,world.grid)
      +d(sig,5,ev)+d(sig,6,busy)+d(sig,7,pop)+d(sig,8,g?g.x:null)+d(sig,9,g?g.y:null)+d(sig,10,rig.az)+d(sig,11,rig.el)
      +d(sig,12,rig.dist)+d(sig,13,rt[0])+d(sig,14,rt[1])+d(sig,15,rt[2])+d(sig,16,bk)+d(sig,17,dprUsed);
    const tNow=now();
    const draw=!armed||inv||chg>0||busy||ev||(o&&o.intro!=null)||tNow-lastRaster>=NET_MS;
    if(draw){
      const bChanged=bk!==brightK;
      brightK=bk;
      /* PAUSE (R16, all three looks): the board holds the time it first saw. */
      const t0=world.time; if(paused)world.time=pzT;
      try{
        if(!sc||sc.update(world))rebuild(world);   // brick rescan / level rebuild
        else if(bChanged&&sc.lights)applyBright(sc.lights,brightK);
      }finally{ world.time=t0; }
      if(sc)sc.pools.ghost(g);
      /* Opening: o.pop scales the player slot group (MAKO's pop-in; hidden at
         0, never a zero matrix), 1 outside INTRO. No mesh is added. */
      if(sc){ if(pop<=0)sc.pools.player.visible=false; sc.pools.player.scale.setScalar(pop>0?pop:1); }
      /* S3: INTRO in kind 3d hands the camera to the opening keyframes
         (o.intro = {stage,t,pressT} from main; logo/prompt stay on the 2D
         overlay); every other screen keeps the orbit rig. Shake rides both. */
      if(o&&o.intro!=null)applyOrbit(camera,introCam(o.intro.stage,o.intro.t,rig.dist,o.intro.pressT),sh);
      else applyOrbit(camera,rig,sh);    // shake = camera-target offset
      if(d(cas,0,world)+d(cas,1,tB)+d(cas,2,world.level)+d(cas,3,world.grid)+d(cas,4,sc?sc.brickV:0)+d(cas,5,pop))shadowNeed=true;
     }
    /* Warm pass, once per scene: draw it with every pooled mesh shown (an
       empty instanced pool at one instance) and throw that frame away — the
       real render below overwrites it in the same task. The GPU then builds
       MAKO's (hidden on the title), the bomb's and the blast's pipelines
       here, not on the show's pop and reveal frames. Lights keep their state
       so no program is compiled for a light count the game never uses. */
    const live=gl&&!lost;
    if(live&&draw&&sc&&!sc.warm){ sc.warm=true; shadowNeed=true; if(armed)gl.shadowMap.needsUpdate=true; const undo=[];
      sc.group.traverse(m=>{ if(!m.visible&&!m.isLight){ undo.push([m,"visible",false]); m.visible=true; }
        if(m.isInstancedMesh&&m.count===0){ undo.push([m,"count",0]); m.count=1; } });
      gl.render(scene3,camera); for(const [m,k,v] of undo)m[k]=v; }
    if(draw)fxp.update(getFx());
    if(live&&draw){
      const wantW=Math.floor(W*dprUsed), wantH=Math.floor(H*dprUsed);
      if(gl.domElement.width!==wantW||gl.domElement.height!==wantH){
        gl.setSize(W,H,false);
        camera.aspect=W/H; camera.updateProjectionMatrix();
       }
      if(armed){ gl.shadowMap.needsUpdate=shadowNeed; if(shadowNeed&&gl.shadowMap.enabled)shadowUpdates++; }
      gl.render(scene3,camera);
      glRenders++; lastRaster=tNow; inv=false; shadowNeed=false;
     }
    else if(armed&&draw&&!live){ lastRaster=tNow; inv=false; }
    /* S4+S5: WIN/LOSE/PAUSE overlays ride the classic 2D layer exactly like
       kind 2d — drawOverlay's defaults already match this canvas' space
       (600x520, centered); the overlay is cleared first so nothing smears.
       MENU stays out: shell screens own their canvases via menudraw. Chips
       remain opt-in ({hud:true}) and draw after the veil (2D parity). */
    const ov=world.state==="WIN"||world.state==="LOSE"
      ||world.state==="PAUSE";
    ovCtx.clearRect(0,0,W,H);
    const fl=paused?0:getFlash();
    if(fl>0){
      ovCtx.globalAlpha=fl*0.28;
      ovCtx.fillStyle="#ffe8a8";
      ovCtx.fillRect(0,0,W,H);
      ovCtx.globalAlpha=1;
    }
    if(ov||(o&&o.hud===true)){
      if(ov){ const B=overlayBox("3d");
        drawOverlay(ovCtx,world,B.w,B.h,B.cx,B.cy,o&&o.pause,o&&o.time,o&&o.run,o&&o.toast); }
      if(o&&o.hud===true){ const q=biomeOf(world.level),t=q.hWall+RIM_LIP,a=projBoard(camera,W/2-RIM_OX,H/2-RIM_OZ,t),b=projBoard(camera,W/2+RIM_OX,H/2-RIM_OZ,t);
        hudPlate3(ovCtx,world.level,a,b); }
      if(o&&o.hud===true)drawHudChips(ovCtx,world,o&&o.time);
      if(o&&o.hud===true)drawAbilityBar(ovCtx,world);
      if(o&&o.hud===true&&world.state==="PLAY")drawFxOverlay(ovCtx);
      if(o&&o.hud===true&&world.state==="PLAY"){camera.updateMatrixWorld();drawPickupFx(ovCtx,{coach:o.coach2,proj});}
      if(o&&o.hud===true)drawCoach(ovCtx,(o&&o.coach)||0);
      if(o&&o.hud===true)drawCoach2(ovCtx,(o&&o.coach2&&o.coach2.a)||0,(o&&o.coach2&&o.coach2.s)||"");
     }
   }

  /* GRAPHICS knobs (K from app/gfx.js resolve): DPR live in place, the
     shadow tier by one material recompile behind the warm pass. The first
     call arms render-on-change and the caster-only shadow pass. */
  function setPerf(K){
    if(!K)return;
    armed=true; inv=true;
    if(gl)gl.shadowMap.autoUpdate=false;
    const d=K.dpr3d>0?Math.min(K.dpr3d,DPR_MAX):dprUsed;
    if(gl&&d!==dprUsed){ dprUsed=d; gl.setPixelRatio(d); }
    const sv=K.shadow==="off"||K.shadow==="sharp"?K.shadow:"soft";
    if(sv!==shadow){ shadow=sv; setShadow(); shadowNeed=true;
      if(sc){ sc.group.traverse(m=>{ const ms=m.material; if(ms)(Array.isArray(ms)?ms:[ms]).forEach(x=>{ x.needsUpdate=true; }); });
        sc.warm=false; } }
   }
  function onLost(){ lost=true; lostAt=now(); }
  function onRestored(){ lost=false; inv=shadowNeed=true; if(sc)sc.warm=false;
    if(atlas)for(const k in atlas){ const tx=atlas[k]; if(tx&&tx.isTexture)tx.needsUpdate=true; } }
  const hasEv=!!(gl&&glCanvas.addEventListener);
  if(hasEv){ glCanvas.addEventListener("webglcontextlost",onLost,false);
    glCanvas.addEventListener("webglcontextrestored",onRestored,false); }
  function dispose(){
    if(hasEv){ glCanvas.removeEventListener("webglcontextlost",onLost,false);
      glCanvas.removeEventListener("webglcontextrestored",onRestored,false); }
    if(sc){ scene3.remove(sc.group); disposeGroup(sc.group); sc=null; }
    if(atlas)for(const k in atlas){ const tx=atlas[k]; if(tx&&tx.dispose)tx.dispose(); }
    atlas=null; atlasReady=false;
    const pm=fxp.points.material; if(pm.map)pm.map.dispose();
    fxp.points.geometry.dispose(); pm.dispose();
    if(gl){ const g0=gl; gl=null; g0.dispose(); if(!lost)try{ g0.forceContextLoss(); }catch(e){} }  // a lost context has no WEBGL_lose_context: three would only warn
   }

  const surface={canvas:glCanvas,overlay:overlayCanvas,ctx:ovCtx,render,
    consumeEvents,getShake};
  /* Non-enumerable (Object.keys surface contract unchanged): the GRAPHICS
     contract, then the test/perf seam — scene root for the §8 draw-call
     traverse, camera for shake/flythrough math, particles pool, effective
     DPR, GL render / shadow-map update counters and the context attributes. */
  Object.defineProperties(surface,{
    setPerf:{enumerable:false,value:setPerf},
    invalidate:{enumerable:false,value:(re)=>{ inv=true; if(re)pzT=null; }},
    dispose:{enumerable:false,value:dispose},
    liveAA:{enumerable:false,get:()=>gl?ATTR.antialias:null},
    dead:{enumerable:false,get:()=>lost&&now()-lostAt>=DEAD_MS},
    _dbg:{enumerable:false,value:{
      get scene(){return scene3;},get camera(){return camera;},
      get particles(){return fxp;},get dpr(){return dprUsed;},
      get glRenders(){return glRenders;},get shadowUpdates(){return shadowUpdates;},
      get attr(){return ATTR;},get armed(){return armed;},get shadow(){return shadow;},
      get gl(){return gl;}}}});
  return surface;
}
