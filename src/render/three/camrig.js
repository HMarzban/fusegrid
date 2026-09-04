/* Camera rig (real3d spec §4) — render-side closure state {az,el,dist,target},
   NEVER in world/snapshot. Pure spherical math + DOM mount mirroring
   mountCameraCtl: RIGHT-drag orbits, wheel/pinch dollies, all gated by
   getActive() (main wires it to GAME + kind==="3d"). cameraCtl.js stays
   untouched for 2D/iso. */
import {clamp} from "../../core/config.js";

export const EL_MIN=0.18, EL_MAX=1.05, DIST_MIN=560, DIST_MAX=1400;  // el = POLAR from +Y: 0.62 rad = 54.5 deg above horizon
export const SHAKE_3D_K=0.09;      // world-units per shake px
/* fixed full-board rig: az=0 axis-aligned, el 54.5° readable 3/4.
   The board is 15 wide by 13 deep, so X binds the fit at EVERY elevation and
   the fitting distance only moves 900..970 across 66°..48° — the 3/4 read is
   nearly free. el 0.419 (66°) was a ceiling security-cam: cube sides showed
   at 0.45 of top depth. 0.62 lifts that to 0.71 and still clears the tallest
   walls (ICE 36). dist 960 / target y -44 centre every biome's board + rim
   inside |ndc|<=0.92 (worst ICE 0.913, ~26px CSS margin at 600 wide). */
const DEF={az:0,el:0.62,dist:960,target:[0,-44,0]};
export const DRAG_K=0.005;         // rad per drag px
export const WHEEL_DOLLY_K=0.6;    // world-units per wheel deltaY tick

export function createRig(){
  return {az:DEF.az,el:DEF.el,dist:DEF.dist,target:DEF.target.slice()};
}
export function orbitBy(st,dAz,dEl){
  st.az+=dAz;
  st.el=clamp(st.el+dEl,EL_MIN,EL_MAX);
  return st;
}
export function dollBy(st,d){
  st.dist=clamp(st.dist+d,DIST_MIN,DIST_MAX);
  return st;
}
export function resetOrbit(st){
  st.az=DEF.az; st.el=DEF.el; st.dist=DEF.dist;
  return st;
}
/* position = target + spherical(az,el,dist); lookAt(target + shake*K). */
export function applyOrbit(camera,st,shake){
  const se=Math.sin(st.el), ce=Math.cos(st.el);
  camera.position.set(
    st.target[0]+st.dist*se*Math.sin(st.az),
    st.target[1]+st.dist*ce,
    st.target[2]+st.dist*se*Math.cos(st.az));
  camera.lookAt(
    st.target[0]+shake.x*SHAKE_3D_K,
    st.target[1],
    st.target[2]+shake.y*SHAKE_3D_K);
  return camera;
}

/* DOM wiring: same discipline as cameraCtl.mountCameraCtl — client px divided
   by canvas CSS scale, pinch = dolly with fire-latch cancel, contextmenu
   swallowed while mounted. TWO gates (camera-research spec §4): right-drag
   orbit needs getActive() (main wires GAME+3d+?orbit=1); wheel/pinch dolly
   rides getDolly() when given (GAME+3d, always-on within clamps) and falls
   back to getActive() otherwise. */
export function mountOrbitCtl({canvas,getActive,getDolly,input,camrig}){
  const canOrbit=getActive||(()=>false);
  const canDolly=getDolly||canOrbit;
  if(!canvas)return {detach(){}};
  const w=typeof window!=="undefined"?window:null;
  const ptOf=(e)=>{
    const r=canvas.getBoundingClientRect();
    const k=canvas.width/(r.width||canvas.width);
    return {x:(e.clientX-r.left)/k,y:(e.clientY-r.top)/k};
   };
  let drag=null;
  const pts=new Map();
  let pinch=null;
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const onDown=(e)=>{
    if(!(canOrbit()||canDolly()))return;
    if(e.pointerId!=null){
      pts.set(e.pointerId,ptOf(e));
      if(pts.size===2){            // pinch start: kill pending fire latch
        if(input)input._intent.fire=false;
        const v=[...pts.values()];
        pinch={d0:dist(v[0],v[1])||1};
       }
     }
    if(e.button===2&&canOrbit())drag=ptOf(e);
   };
  const onMove=(e)=>{
    if(!(canOrbit()||canDolly()))return;
    if(pts.has(e.pointerId))pts.set(e.pointerId,ptOf(e));
    if(pinch&&pts.size>=2){        // spread ratio r -> dist/r
      const v=[...pts.values()];
      const d1=dist(v[0],v[1])||1;
      dollBy(camrig,camrig.dist*(pinch.d0/d1-1));
      return;
     }
    if(drag){
      const p=ptOf(e);
      orbitBy(camrig,(p.x-drag.x)*DRAG_K,(p.y-drag.y)*DRAG_K);
      drag=p;
     }
   };
  const endPt=(e)=>{
    pts.delete(e.pointerId);
    if(pts.size<2)pinch=null;
    if(e.button===2||e.type==="pointercancel")drag=null;
   };
  const onWheel=(e)=>{
    if(!canDolly())return;
    e.preventDefault();
    dollBy(camrig,e.deltaY*WHEEL_DOLLY_K);
   };
  const onCtx=(e)=>{ e.preventDefault(); };   // right-drag owns button 2
  canvas.addEventListener("pointerdown",onDown);
  canvas.addEventListener("wheel",onWheel,{passive:false});
  canvas.addEventListener("contextmenu",onCtx);
  const winL=w?[["pointermove",onMove],["pointerup",endPt],
    ["pointercancel",endPt]]:[];
  winL.forEach(([t,f])=>w.addEventListener(t,f));
  return {detach(){
    canvas.removeEventListener("pointerdown",onDown);
    canvas.removeEventListener("wheel",onWheel);
    canvas.removeEventListener("contextmenu",onCtx);
    winL.forEach(([t,f])=>w&&w.removeEventListener(t,f));
   }};
}
