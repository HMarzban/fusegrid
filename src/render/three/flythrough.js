/* Opening camera (opening spec §7) — pure introCam(stage,t,base,pressT) driving
   the orbit rig while INTRO plays in kind "3d". Title (stage 0): a wide,
   slightly lower pose (el 0.80, dist base*1.12) with a slow azimuth drift.
   Show (stage 1): from the title pose at pressT (no pop at the press) to a
   close-up by 8S framed on MAKO's whole walk (spawn, plant (3,1), hide
   (1,2)) from inside the corner, at one fixed dist for every preset, so the
   frame is board rather than void past the rim (eye-check 2026-10-09: the
   spawn-tile aim at el 0.80 was half void, MAKO walking off-centre). Hold,
   then pull back so it lands EXACTLY on rig C at the selected CAMERA preset
   (base) at SHOW_DUR and holds there until the boom flips MENU — no pop on
   the INTRO->MENU frame. base is the preset dist (BASE_DIST when absent).
   Node-testable pure math. */
import {CFG} from "../../core/config.js";
import {SHOW_STEP,SHOW_DUR} from "../../app/intro.js";

export const BASE_DIST=1503;
export const SETTLE_EL=0.66, TARGET_Y=-17;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const seg=(t,a,b)=>clamp((t-a)/(b-a),0,1);
const easeInOutCubic=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const title=(t,base)=>({az:0.10*Math.sin(2*Math.PI*t/(32*SHOW_STEP)),el:0.80,dist:base*1.12,target:[0,TARGET_Y,0]});
const W2=CFG.COLS*CFG.TILE/2, D2=CFG.ROWS*CFG.TILE/2;

export function introCam(stage,t,base=BASE_DIST,pressT=0){
  if(stage!==1)return title(t,base);
  const s=Math.max(0,t);
  if(s>=SHOW_DUR)return {az:0,el:SETTLE_EL,dist:base,target:[0,TARGET_Y,0]};
  const a=title(pressT,base);
  const c={az:-0.1,el:0.55,dist:BASE_DIST*0.40,target:[2.75*CFG.TILE-W2,0,2.75*CFG.TILE-D2]};
  const e={az:0,el:SETTLE_EL,dist:base,target:[0,TARGET_Y,0]};
  const k1=easeInOutCubic(seg(s,0,8*SHOW_STEP)), k2=easeInOutCubic(seg(s,16*SHOW_STEP,SHOW_DUR));
  const f=(x,y,z)=>{const m=x+(y-x)*k1; return k2>0?z+(m-z)*(1-k2):m;};
  return {az:f(a.az,c.az,e.az),el:f(a.el,c.el,e.el),dist:f(a.dist,c.dist,e.dist),
    target:[0,1,2].map(i=>f(a.target[i],c.target[i],e.target[i]))};
}
