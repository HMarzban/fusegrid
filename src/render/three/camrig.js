/* Camera rig (real3d spec §4) — render-side closure state {az,el,dist,target},
   NEVER in world/snapshot. Pure spherical math + DOM mount mirroring
   mountCameraCtl: RIGHT-drag orbits, wheel/pinch dollies, all gated by
   getActive() (main wires it to GAME + kind==="3d"). cameraCtl.js stays
   untouched for 2D/iso. */
import {clamp} from "../../core/config.js";
import * as THREE from "../../../vendor/three.module.js";

export const EL_MIN=0.25, EL_MAX=1.35, DIST_MIN=240, DIST_MAX=900;
export const SHAKE_3D_K=0.06;      // world-units per shake px
const DEF={az:-0.6,el:0.9,dist:560};
export const DRAG_K=0.005;         // rad per drag px
export const WHEEL_DOLLY_K=0.6;    // world-units per wheel deltaY tick

export function createRig(){
  return {az:DEF.az,el:DEF.el,dist:DEF.dist,target:[0,0,0]};
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

/* DOM wiring: same discipline as cameraCtl.mountCameraCtl — inert unless
   getActive(), client px divided by canvas CSS scale, pinch = dolly with
   fire-latch cancel, contextmenu swallowed while mounted. */
export function mountOrbitCtl({canvas,getActive,camrig,input}){
  const active=getActive||(()=>false);
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
    if(!active())return;
    if(e.pointerId!=null){
      pts.set(e.pointerId,ptOf(e));
      if(pts.size===2){            // pinch start: kill pending fire latch
        if(input)input._intent.fire=false;
        const v=[...pts.values()];
        pinch={d0:dist(v[0],v[1])||1};
       }
     }
    if(e.button===2)drag=ptOf(e);
   };
  const onMove=(e)=>{
    if(!active())return;
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
    if(!active())return;
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
