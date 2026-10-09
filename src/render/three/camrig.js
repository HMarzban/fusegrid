/* Camera rig (real3d spec §4) — render-side closure state {az,el,dist,target},
   NEVER in world/snapshot. Pure spherical math + DOM mount mirroring
   mountCameraCtl: RIGHT-drag orbits, wheel/pinch dollies, all gated by
   getActive() (main wires it to GAME + kind==="3d"). cameraCtl.js stays
   untouched for 2D/iso. */
import {clamp} from "../../core/config.js";

export const EL_MIN=0.18, EL_MAX=1.05, DIST_MIN=892, DIST_MAX=2529;  // el = POLAR from +Y: 0.66 rad = 52.2 deg above horizon
export const SHAKE_3D_K=0.09;      // world-units per shake px
export const CAM_FOV=24;           // vertical, degrees; wrapper + tests read it
/* fixed full-board rig (camera spec 2026-10-08, the user's pick C): az=0
   axis-aligned, el 52.2° above the horizon, a 24° lens from dist 1503.
   X binds the fit at EVERY elevation — always the NEAR ICE wall-top corner,
   because near corners project widest — so horizontal fill pins near 94% and
   the vertical axis carries all the slack. At ONE lens, vertical fill is
   MONOTONICALLY DECREASING in el: tilting away from vertical foreshortens the
   depth axis faster than it grows the near edge. Across lenses it is not:
   el .54 at FOV 45 / dist 870 took 50.9% of the canvas, el .66 at FOV 24
   takes 54.2%, because the narrow lens widens the near edge less (keystone
   far/near 0.722 -> 0.807). The lens is what bought the fill.
   It also fixed the third complaint, "too top-down" and "skewed", which were
   one defect: at FOV 45 the viewing angle changed across the board, and the
   near row's side:top was 0.339 — more top-down than the rejected el 0.419
   security cam (0.445) — with blocks splaying outward. At FOV 24 the rows
   read 0.970 / 0.794 / 0.617 far to near. The fit basis is the PLAYFIELD,
   not the decorative bezel: dist 1503 / target y -17 put the worst board
   corner at |ndc| 0.9397 with the board centred to 0.0005, and let the
   cabinet bezel (|ndc| 1.0746) bleed about 7.5% past the two bottom corners
   the way a real well runs off the screen. */
const DEF={az:0,el:0.66,dist:1503,target:[0,-17,0]};
export const DRAG_K=0.005;         // rad per drag px
export const WHEEL_DOLLY_K=1.04;   // world-units per wheel deltaY tick: 0.6 x 1503/870, same fraction of the default dist

/* CAMERA presets are persisted starting DOLLY positions, not new rigs: el, az
   and target never move. dist is already a live player axis (wheel/pinch runs
   unguarded in GAME+3d within DIST_MIN/DIST_MAX), so a preset is that same
   axis made discoverable. Measured against the §4b projection at RIM_W 36 /
   RIM_LIP 6: bezel 1.0746 / 0.9495 / 0.8568 against the 1.10 gate, worst
   playfield corner 0.9397 / 0.8323 / 0.7524. No preset dollies IN: the bezel
   limit is 1473.54 (1474 scores 1.0996, 1470 scores 1.1031); FAR stops at
   1827 because 1905 drops the corner to 0.7180. DIST_MIN/DIST_MAX keep the
   old clamp extremes: 892 scores worst 1.7709, 2529 scores 0.5255. */
export const CAM_PRESET=Object.freeze([1503,1671,1827]);
export const CAM_NAME=Object.freeze(["STANDARD","WIDE","FAR"]);
export function camPreset(i){
  const n=typeof i==="number"&&isFinite(i)?i|0:0;
  return CAM_PRESET[n<0?0:n>2?2:n];
}

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
export function resetOrbit(st,dist=DEF.dist){
  st.az=DEF.az; st.el=DEF.el; st.dist=dist;
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
