/* Camera rig (real3d spec §4) — render-side closure state {az,el,dist,target},
   NEVER in world/snapshot. Pure spherical math + DOM mount mirroring
   mountCameraCtl: RIGHT-drag orbits, wheel/pinch dollies, all gated by
   getActive() (main wires it to GAME + kind==="3d"). cameraCtl.js stays
   untouched for 2D/iso. */
import {clamp} from "../../core/config.js";

export const EL_MIN=0.18, EL_MAX=1.05, DIST_MIN=560, DIST_MAX=1400;  // el = POLAR from +Y: 0.54 rad = 59.1 deg above horizon
export const SHAKE_3D_K=0.09;      // world-units per shake px
/* fixed full-board rig: az=0 axis-aligned, el 59.1° readable 3/4.
   X binds the fit at EVERY elevation — always the NEAR ICE wall-top corner,
   because near corners project widest — so horizontal fill pins at 96% and
   the vertical axis carries all the slack. That makes vertical fill
   MONOTONICALLY DECREASING in el: tilting away from vertical foreshortens the
   depth axis faster than it grows the near edge. A higher camera therefore
   fills more frame AND hides less behind walls; the only thing el buys is the
   3/4 read, measured here as side:top = tan(el).
   0.62 (0.714) framed the board into 38.9% of the canvas with ~103px of dead
   bg1 above and below. 0.54 (0.599) takes 50.9% and cuts ICE occlusion
   0.64 -> 0.54 tile, while staying 35% clear of the 0.419 ceiling security-cam
   that scored 0.445. The fit basis is the PLAYFIELD, not the decorative bezel:
   dist 870 / target y -48 put the worst board corner at |ndc| 0.9449 with the
   board centred to 0.0005, and let the cabinet bezel bleed 2.4% past the two
   bottom corners the way a real well runs off the screen. */
const DEF={az:0,el:0.54,dist:870,target:[0,-48,0]};
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
