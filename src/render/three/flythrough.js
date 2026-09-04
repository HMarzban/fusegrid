/* Intro cinematic camera (real3d spec §3 S3) — pure introCam(subT) keyframes
   driving the orbit rig while INTRO plays in kind "3d" (the 2D canvas flyover
   stays gated to non-3d kinds in main). Beats mirror introPhase (app/intro):
   zoom 1.55 hold -> drift 1.18 -> settle 1.00, camY lower-third -> center.
   Mapping: dist = BASE_DIST / zoom pins both zoom endpoints; target-z rides
   the camY drift; elevation lifts to the rig default; azimuth swings out-
   and-back mid-flyover for the cinematic arc. Segment ends snap exactly so the
   final frame equals createRig() defaults — seamless gameplay handoff, target
   y included (it used to pop 0 -> -25 on the last frame).
   Node-testable pure math; no DOM/time. */
import {CFG} from "../../core/config.js";
import {introPhase,INTRO_DUR} from "../../app/intro.js";

export const BASE_DIST=870;
export const SETTLE_EL=0.54, TARGET_Y=-48;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const seg=(t,a,b)=>clamp((t-a)/(b-a),0,1);
const easeInOutCubic=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const easeOutCubic=t=>1-Math.pow(1-t,3);

export function introCam(subT){
  const s=clamp(subT,0,INTRO_DUR);
  const ph=introPhase(s);
  const k=easeInOutCubic(seg(s,1.40,4.20));
  let az=0;
  if(k>0&&k<1)az+=0.38*Math.sin(Math.PI*k);
  const e=easeOutCubic(seg(s,1.40,INTRO_DUR));
  const el=e>=1?SETTLE_EL:0.62+(SETTLE_EL-0.62)*e;   // camera LIFTS into place
  return {az,el,dist:BASE_DIST/ph.zoom,
    target:[0,TARGET_Y,(ph.camY-0.5)*CFG.ROWS*CFG.TILE]};
}
