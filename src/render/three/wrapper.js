/* createRenderer3D (real3d spec §1/§7) — WebGL bottom layer under the classic
   2D overlay. Surface contract mirrors createRenderer exactly:
   {canvas:#gl, overlay:#c, ctx:overlay 2D ctx, render(world,dt,o),
    consumeEvents(world,dt), getShake} — same call shapes the main loop uses.
   Headless/no-WebGL => stub mode: THREE Scene still assembled and updated
   (Node-testable), only the GL draw is skipped; ctx falls back to a noop 2D
   object so main's shell path never throws. fx stays the single singleton
   store (see fx.js header): events drained here exactly like the 2D path. */
import * as THREE from "../../../vendor/three.module.js";
import {CFG, ROOM_MAX, isFinale} from "../../core/config.js";
import {biomeOf} from "../../core/config.js";
import {sfxOf} from "../../audio/item.js";
import {buildScene, disposeGroup, rimTwin} from "./scene.js";
import {createPins} from "./progpin.js";
import {applyBright} from "./lights.js";
import {createRig, applyOrbit, CAM_FOV} from "./camrig.js";
import {introCam} from "./flythrough.js";
import {createParticles} from "./particles.js";
import {ambientClock} from "../ambient.js";
import {buildSpriteAtlas, buildWorldAtlas, spriteSteps, worldSteps, wrapTex} from "./textures.js";
import {stageGlow, stageBack} from "../frame.js";
import {drawOverlay, overlayBox, drawCoach, drawCoach2, boardTip} from "../scenes.js";
import {onEvent, updateFx, getFxOpts, getShake, getFlash, getFx, feedFx, drawFxOverlay, drawPickupFx, syncFx, initFx} from "../fx.js";

const W=CFG.COLS*CFG.TILE, H=CFG.ROWS*CFG.TILE;
/* the board's view-offset shift in the canvas (rig and lens untouched): 0 since the HUD left the board (UI upgrade Task 8.2, fix round 1); it was
   16 while the HUD plate took the top 40 */
export const VIEW_DY=0;
const noop=()=>{};
export const WORLDS_KEPT=2;
export const DPR_MAX=3;                     // RESOLUTION FULL (opt-in); default min(dpr,2)
/* GRAPHICS 2026-10-10: the probe and three get ONE attribute object. The
   probe used to pass none, which fixed the context to the browser default
   before three asked; ATTR0 is exactly that default, so AUTO is today. */
export const ATTR0=Object.freeze({alpha:true,antialias:true,stencil:false,depth:true,
  premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:"default",
  failIfMajorPerformanceCaveat:false});
export const NET_MS=500, DEAD_MS=3000;
/* v202 staged build: compile buckets (a fixed count, so the build total is
   known up front), the KHR poll and its cap (past it the warm frame links) */
export const COMPILE_K=6, SPLIT=8, KHR_POLL=10, KHR_MAX=2000;
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
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
  let glRenders=0, shadowUpdates=0, shadowNeed=true, lastRaster=-Infinity, pzT=null, pzL=0, skew=0, wT=0, lastW=null, lastG=null, wasP=false, cov=false;

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
        /* v202: the info-log reads are a sync wait per program on first use;
           diagnostics only when the page asked for them (?debug=1) */
        if(gl.debug)gl.debug.checkShaderErrors=opts.debug===true;
       }
     }
   }catch(e){ gl=null; }

  const scene3=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(CAM_FOV,W/H,1,3000);
  camera.setViewOffset(W,H,0,-VIEW_DY,W,H);
  /* S3: fx-store particles ride the scene ROOT (not sc.group) so level
     rebuilds never orphan live bursts; syncFx wipes them on world change. */
  const fxp=createParticles();
  scene3.add(fxp.points);
  /* zero-asset atlas (§5). Sprites are one set for the renderer's life. World
     textures are lazy per biome, and WORLDS_KEPT bounds them: the room in play
     and the one prepared on its WIN overlay (the rim alone is 7 MB). Headless
     => null => color fallbacks downstream. */
  let sprites=null, spritesReady=false, atlas=null, atlasLvl, atlasReady=false;
  const worlds=new Map(), texOf=(a)=>{ const out=[]; for(const k in a||{})if(a[k]&&a[k].isTexture)out.push(a[k]); return out; };
  function worldAtlas(lvl){
    const key=biomeOf(lvl).name;
    let w=worlds.get(key);
    if(w===undefined){ try{ w=(opts.buildWorld||buildWorldAtlas)(undefined,lvl); }catch(e){ w=null; } }
    worlds.delete(key); worlds.set(key,w);
    return w;
   }
  function trimWorlds(keep){
    for(const k of worlds.keys()){
      if(worlds.size<=WORLDS_KEPT)break;
      if(k===keep||(atlasReady&&k===biomeOf(atlasLvl).name))continue;
      for(const tx of texOf(worlds.get(k)))tx.dispose();
      worlds.delete(k);
     }
   }
  function getAtlas(world){
    const lvl=world&&world.level;
    if(atlasReady&&atlasLvl===lvl)return atlas;
    if(!spritesReady){ try{ sprites=(opts.buildSprites||buildSpriteAtlas)(); }catch(e){ sprites=null; } spritesReady=true; }
    const w=worldAtlas(lvl);
    atlas=sprites||w?{...sprites,...w}:null; atlasLvl=lvl; atlasReady=true;
    trimWorlds(biomeOf(lvl).name);
    return atlas;
   }
  /* The next room's textures, painted and uploaded on the WIN overlay (nothing
     moves there, and it is the one quiet moment a next room is known), so its
     first frame only binds them. Once per room; never on a finale or at the end. */
  let preparedFor=null;
  function prepareNext(world){
    const lvl=world.level, key=lvl+":"+world.seed;
    if(preparedFor===key)return;
    preparedFor=key;
    if(lvl>=ROOM_MAX||isFinale(lvl))return;
    const w=worldAtlas(lvl+1);
    trimWorlds(biomeOf(lvl+1).name);
    if(gl&&gl.initTexture)for(const tx of texOf(w))gl.initTexture(tx);
   }
  function setShadow(){
    if(!gl)return;
    gl.shadowMap.enabled=shadow!=="off";
    gl.shadowMap.type=shadow==="sharp"?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;
   }
  let sc=null, brightK=1, twinDone=false, repin=false, active=false, disposed=false, path=null;
  const pins=createPins();
  const pinNow=()=>{ const l=gl&&gl.info&&gl.info.programs; if(l)pins.scan(l); };
  const unpin=()=>{ const l=gl&&gl.info&&gl.info.programs; if(l)pins.release(l); };
  const aclock=ambientClock();
  /* the shared side of a scene: the stage's CSS background and glow (#gl,
     #c), only once activated (v202 swap on ready) */
  function stage(){ if(sc){ stageBack(glCanvas,sc.level); stageGlow(overlayCanvas,sc.level); } }
  function rebuild(world){
    if(sc){ scene3.remove(sc.group); disposeGroup(sc.group); }
    if(repin){ repin=false; unpin(); }
    sc=buildScene(world,getAtlas(world),brightK);
    setShadow(); shadowNeed=inv=true;
    const biome=biomeOf(world.level);
    scene3.background=gl?null:new THREE.Color(biome.bg1);
    if(active)stage();
    /* No distance fog. On the rig of the 2026-09-04 pass the far board
       corners sat at d 963, and Fog(bg1,700,1600) was replacing 43% of them
       with the darkest colour in the biome — 89% out at the DIST_MAX dolly
       clamp. They now sit at 1689.9 (2700.4 at DIST_MAX), so fog would only
       bite harder. A board that must stay legible at every zoom cannot have
       fog over it. */
    scene3.fog=null;
    scene3.add(sc.group);
   }

  /* the warm scene: every pooled mesh shown (an empty instanced pool at one
     instance), lights untouched; returns the undo list */
  function showAll(){ const undo=[];
    sc.group.traverse(m=>{ if(!m.visible&&!m.isLight){ undo.push([m,"visible",false]); m.visible=true; }
      if(m.isInstancedMesh&&m.count===0){ undo.push([m,"count",0]); m.count=1; } });
    return undo; }
  function addTwin(){ const twin=twinDone?null:rimTwin(sc.rim,sc.biome); twinDone=true;
    if(twin)sc.group.add(twin); return twin; }
  /* pinNow() first: the twin's program lives only through its material */
  function dropTwin(twin){ if(!twin)return; pinNow(); if(twin.parent)twin.parent.remove(twin); twin.material.dispose(); }

  /* Shared side effects, once, at the swap (v202): the stage background and
     glow, one overlay clear. render() calls it itself when nobody did. */
  function activate(){
    if(active||disposed)return;
    active=true; stage(); ovCtx.clearRect(0,0,W,H);
   }

  /* v202 staged build (swap on ready). job = {world, report(phase,done,total),
     step()}; step() resolves when the slice may go on and rejects with
     {cancelled:true} when the job is dropped (rcache then disposes). Heavy
     work only, on this renderer's own canvas, nothing shared: no fx store,
     no events, no #c. Phases: build (paint one texture per unit, upload one
     per unit, the scene, COMPILE_K compile buckets), shaders (unique
     programs ready: KHR polled, else one warm draw per bucket), warm (the
     one full warm frame: shadow depth programs, binds). A renderer already
     on screen only compiles: a draw there would be seen. */
  async function prepare(job){
    try{ await stagedBuild(job); }
    catch(e){ if(e&&e.stale)return; throw e; }
   }
  async function stagedBuild(job){
    const world=job&&job.world;
    if(!world||disposed)return;
    const live0=active, sc0=sc;
    const rep=(p,d,t)=>{ if(job.report)job.report(p,d,t); };
    const step=async()=>{ await job.step(); if(disposed)throw {cancelled:true};
      if(active!==live0||(live0&&sc!==sc0))throw {stale:true}; };
    const lvl=world.level, key=biomeOf(lvl).name, units=[], ups=[];
    let so=null, wPart=false, undo=[], twin=null, au, nu;
    try{
      if(!spritesReady){
        if(opts.buildSprites){ units.push(()=>{ try{ sprites=opts.buildSprites(); }catch(e){ sprites=null; } spritesReady=true; });
          ups.push(()=>texOf(sprites)); }
        else { let bad=false; so={}; sprites=so;
          const st=spriteSteps();
          st.forEach(([k,f],i)=>{ units.push(()=>{ if(!bad)try{ const tx=wrapTex(k,f()); if(tx)so[k]=tx; }catch(e){ bad=true; }
            if(i===st.length-1){ if(bad)for(const tx of texOf(so))tx.dispose();
              sprites=!bad&&texOf(so).length?so:null; spritesReady=true; so=null; } });
            ups.push(()=>sprites&&sprites[k]?[sprites[k]]:[]); }); }
       }
      if(!worlds.has(key)&&!live0){
        if(opts.buildWorld){ units.push(()=>{ let w; try{ w=opts.buildWorld(undefined,lvl); }catch(e){ w=null; } worlds.set(key,w); });
          ups.push(()=>texOf(worlds.get(key))); }
        else { const cv={}, wo={}; let bad=false; wPart=true; worlds.set(key,wo);
          /* a throw keeps the steps painted before it, as worldSources does */
          for(const [k,f] of worldSteps(undefined,lvl)){
            units.push(()=>{ if(!bad)try{ const c=f(cv); if(k){ cv[k]=c; const tx=wrapTex(k,c); if(tx)wo[k]=tx; } }catch(e){ bad=true; } });
            if(k)ups.push(()=>{ const w=worlds.get(key); return w&&w[k]?[w[k]]:[]; }); }
          units.push(()=>{ if(!texOf(wo).length)worlds.set(key,null); wPart=false; }); }
       }
      if(gl&&gl.initTexture)for(const u of ups)units.push(()=>{ if(gl&&!lost)for(const tx of u())gl.initTexture(tx); });
      units.push(()=>{ if(!live0&&(!sc||sc.update(world)))rebuild(world); else getAtlas(world); });
      const total=units.length+COMPILE_K;
      let done=0;
      rep("build",0,total);
      for(const u of units){ u(); rep("build",++done,total); await step(); }
      const canC=!!(gl&&!lost&&gl.compile&&gl.properties&&sc), draws=canC&&!live0&&!sc.warm;
      let buckets=[];
      /* a renderer on screen keeps its scene as drawn: no warm overrides, and
         the rim twin compiles detached (compile needs no parent) */
      if(canC){ applyOrbit(camera,rig,STILL);
        if(live0){ twin=twinDone?null:rimTwin(sc.rim,sc.biome); twinDone=true; buckets=bucketsOf(twin); }
        else { undo=showAll(); twin=addTwin(); buckets=bucketsOf(); } }
      const progs=[], all=new Set();
      for(let b=0;b<COMPILE_K;b++){
        const ps=new Set();
        if(canC)for(const n of buckets[b])for(const m of gl.compile(n,camera,scene3)){
          const p=gl.properties.get(m).currentProgram; if(p){ ps.add(p); all.add(p); } }
        progs.push(ps); rep("build",++done,total); await step();
       }
      if(canC)pinNow();
      const n=all.size, khr=canC&&!!(gl.extensions&&gl.extensions.has&&gl.extensions.has("KHR_parallel_shader_compile"));
      path=!canC?"none":khr?"khr":draws?"sliced":"issued";
      rep("shaders",0,n);
      if(khr){ const t0=now(); let k=0;
        for(;;){ let r=0; for(const p of all)if(p.isReady())r++;
          if(r>k){ k=r; rep("shaders",r,n); }
          if(r>=n||now()-t0>KHR_MAX)break;
          await wait(KHR_POLL); await step(); }
        if(k<n)rep("shaders",n,n); }
      else if(path==="sliced"){
        /* no KHR: a link waits on its first use, so draw one bucket per slice
           (the others hidden, lights kept), shadow map held */
        au=gl.shadowMap.autoUpdate; nu=gl.shadowMap.needsUpdate;
        gl.shadowMap.autoUpdate=false; gl.shadowMap.needsUpdate=false;
        const seen=new Set();
        for(let b=0;b<COMPILE_K;b++){ if(!buckets[b].length)continue;
          const vis=[];
          buckets.forEach((bk,j)=>{ if(j!==b)for(const x of bk){ vis.push([x,x.visible]); x.visible=false; } });
          try{ gl.render(scene3,camera); }finally{ for(const [x,v] of vis)x.visible=v; }
          for(const p of progs[b])seen.add(p);
          rep("shaders",seen.size,n); await step(); }
        gl.shadowMap.autoUpdate=au; gl.shadowMap.needsUpdate=nu; au=undefined;
        if(seen.size<n)rep("shaders",n,n); }
      else if(n)rep("shaders",n,n);
      /* the one warm frame: everything shown, the shadow pass on (its depth
         programs are made inside it), then thrown away by the first real
         frame. Never on a canvas already on screen. */
      if(draws){
        rep("warm",0,1);
        sc.warm=true; if(armed)gl.shadowMap.needsUpdate=true;
        gl.render(scene3,camera);
        pinNow();
       }
      rep("warm",1,1);
      inv=true; shadowNeed=true;
     }finally{
      if(au!==undefined&&gl){ gl.shadowMap.autoUpdate=au; gl.shadowMap.needsUpdate=nu; }
      for(const [m,k,v] of undo)m[k]=v;
      if(twin){ if(gl)dropTwin(twin); else{ if(twin.parent)twin.parent.remove(twin); twin.material.dispose(); } }
      /* a dropped job leaves no half atlas behind for a later sync build */
      if(so){ for(const tx of texOf(so))tx.dispose(); if(sprites===so)sprites=null; }
      if(wPart){ for(const tx of texOf(worlds.get(key)))tx.dispose(); worlds.delete(key); }
     }
   }
  /* the compile units: every subtree without a light (lights keep their
     state through compile's targetScene), split down to its children when
     it holds more than SPLIT meshes, dealt into COMPILE_K buckets in order */
  function bucketsOf(extra){
    const out=[];
    const split=(n)=>{ if(n.isLight)return; let l=0, k=0;
      n.traverse(o=>{ if(o.isLight)l++; if(o.material)k++; });
      if(!k)return;
      if(!l&&(k<=SPLIT||!n.children.length))out.push(n);
      else{ if(n.material&&!l)out.push(n); else for(const c of n.children)split(c); } };
    for(const c of scene3.children)split(c);
    if(extra)out.push(extra);
    const B=[]; for(let b=0;b<COMPILE_K;b++)B.push([]);
    out.forEach((n,i)=>B[Math.floor(i*COMPILE_K/out.length)].push(n));
    return B;
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
    if(!active)activate();
    const paused=world.state==="PAUSE", ev=world.events.length>0;
    if(world!==lastW||world.time<wT-1e-9){ skew=0; pzT=null; }
    wT=world.time;
    if(world!==lastW||world.grid!==lastG){ if(wasP)initFx(); lastW=world; lastG=world.grid; }
    wasP=paused;
    /* The renderer clock is world.time minus every second spent in PAUSE
       (the sim keeps ticking it there): frozen while paused, and on resume it
       picks up exactly where it stopped, so a death, burst or spawn that was
       mid-flight plays out its REST instead of finding it long over. */
    if(paused){ if(pzT==null)pzT=world.time-skew; pzL=world.time; }
    else if(pzT!=null){ skew+=pzL-(pzT+skew); pzT=null; }
    const tc=paused?pzT:world.time-skew;
    consumeEvents(world, dt, !(o&&o.sfx===false));
    const ambOn=!!(o&&(o.hud===true||o.amb===true)); if(ambOn)aclock.tick(world,dt||0);
    /* o.covered (R4): the menu canvas hides the board; no scene update, no
       gl.render, no shadow pass, no overlay (no #c clear: the caller paints
       its menu opaque every covered frame or on its own canvas). A covered
       WIN still prepares the next room; the next uncovered frame draws, with
       the pools' kill / pickup edges rebased so nothing from under the cover
       replays */
    if(o&&o.covered){ if(world.state==="WIN"&&gl&&!lost)prepareNext(world); inv=cov=true; return; }
    const bk=o&&typeof o.bright==="number"&&isFinite(o.bright)?o.bright:brightK;
    const pop=o&&o.pop!=null?o.pop:1, sh=paused?STILL:getShake();
    const tB=tc, g=o&&o.ghost;
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
      const t0=world.time; world.time=tc;
      try{
        if(cov){ cov=false; if(sc)sc.pools.rebase(); }
        if(!sc||sc.update(world))rebuild(world);   // brick rescan / level rebuild
        else if(bChanged&&sc.lights)applyBright(sc.lights,brightK);
      }finally{ world.time=t0; }
      if(sc)sc.pools.ghost(g);
      if(sc&&sc.amb)sc.amb.update(aclock.t,ambOn,getFxOpts().partK,dprUsed);
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
    if(live&&draw&&sc&&!sc.warm){ sc.warm=true; shadowNeed=true; if(armed)gl.shadowMap.needsUpdate=true;
      const undo=showAll(), twin=addTwin();
      gl.render(scene3,camera); for(const [m,k,v] of undo)m[k]=v;
      pinNow();
      dropTwin(twin); }
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
      pinNow();
      if(world.state==="WIN")prepareNext(world);
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
      if(ov&&!(o&&o.over)){ const B=overlayBox("3d"); // over: a phone's, drawn by the shell on #sh
        drawOverlay(ovCtx,world,B.w,B.h,B.cx,B.cy,o&&o.pause,o&&o.time,o&&o.run,o&&o.toast); }
      if(o&&o.hud===true&&world.state==="PLAY")drawFxOverlay(ovCtx);
      if(o&&o.hud===true&&world.state==="PLAY"){camera.updateMatrixWorld();drawPickupFx(ovCtx,{coach:o.coach2,proj});}
      if(o&&o.hud===true)drawCoach(ovCtx,(o&&o.coach)||0);
      if(o&&o.hud===true)drawCoach2(ovCtx,boardTip(o&&o.coach2),(o&&o.coach2&&o.coach2.s)||"");
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
    if(sv!==shadow){ shadow=sv; setShadow(); shadowNeed=true; repin=true; twinDone=false;
      if(sc){ sc.group.traverse(m=>{ const ms=m.material; if(ms)(Array.isArray(ms)?ms:[ms]).forEach(x=>{ x.needsUpdate=true; }); });
        sc.warm=false; } }
   }
  function allTex(){ const out=texOf(sprites); for(const w of worlds.values())out.push(...texOf(w)); return out; }
  function onLost(){ lost=true; lostAt=now(); }
  function onRestored(){ lost=false; inv=shadowNeed=true; twinDone=false; pins.forget(); if(sc)sc.warm=false;
    for(const tx of allTex())tx.needsUpdate=true; }
  const hasEv=!!(gl&&glCanvas.addEventListener);
  if(hasEv){ glCanvas.addEventListener("webglcontextlost",onLost,false);
    glCanvas.addEventListener("webglcontextrestored",onRestored,false); }
  function dispose(){
    disposed=true;
    if(hasEv){ glCanvas.removeEventListener("webglcontextlost",onLost,false);
      glCanvas.removeEventListener("webglcontextrestored",onRestored,false); }
    if(sc){ scene3.remove(sc.group); disposeGroup(sc.group); sc=null; }
    for(const tx of allTex())tx.dispose();
    sprites=null; spritesReady=false; worlds.clear(); atlas=null; atlasReady=false;
    const pm=fxp.points.material; if(pm.map)pm.map.dispose();
    fxp.points.geometry.dispose(); pm.dispose();
    unpin();
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
    proj:{enumerable:false,value:proj},
    prepare:{enumerable:false,value:prepare},
    activate:{enumerable:false,value:activate},
    invalidate:{enumerable:false,value:(re)=>{ inv=true; if(re)pzT=null; }},
    dispose:{enumerable:false,value:dispose},
    liveAA:{enumerable:false,get:()=>gl?ATTR.antialias:null},
    dead:{enumerable:false,get:()=>lost&&now()-lostAt>=DEAD_MS},
    _dbg:{enumerable:false,value:{
      get scene(){return scene3;},get camera(){return camera;},
      get particles(){return fxp;},get dpr(){return dprUsed;},
      get glRenders(){return glRenders;},get shadowUpdates(){return shadowUpdates;},
      get attr(){return ATTR;},get armed(){return armed;},get shadow(){return shadow;},
      get gl(){return gl;},get active(){return active;},get path(){return path;}}}});
  return surface;
}
