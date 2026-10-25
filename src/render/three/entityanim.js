/* REAL 3D foe and pickup motion math (2026-10-25, entities round): pure and THREE-free, a function of (entity, t, dt) over the shared spec in ../motion.js, so the
   transforms entities.js writes are Node-testable and identical frame to frame. Foe state lives in a WeakMap keyed by the enemy OBJECT (never a slot index: slots
   are compaction indices), phases come from e.home (phaseOf), item phases from the grid position. t is the 3D PAUSE-frozen clock (wrapper.js swaps pzT into
   world.time around the update), so every pose here freezes in PAUSE; dt is the clock delta clamped to 0.05 s and is 0 when the clock did not advance, which
   also freezes the smoothed facing. Nothing here is random (hashed phases only) and nothing reads world.time. */
import {foeM, phaseOf, bobAt, breatheAt, blinkAt, spawnK, deathK, leanAt, itemIdle, MOTION} from "../motion.js";
import {CFG} from "../../core/config.js";

const TAU=Math.PI*2;
/* the rig sees a vertical move at cos(52.2 deg) of its length: bob amplitudes from the px spec are lifted to read the same as in 2D */
export const VZ=1.6;
export const YAW_W=14;                 // facing turns at about this rate (1/s) instead of snapping
export const MOVE_V=6;                 // px/s above which a foe counts as walking
export const LEAN_K=0.07;              // rad of hunter tilt per px of leanAt
export const HOVER_K=2.2;              // item hover: itemIdle's +-2 px lifted to the 3D body scale
export const RING_OP=0.66;             // the item ring material's fixed opacity; per-instance brightness rides instanceColor
export const IT_BASE={cap:0.66,vit:0.62,utl:0.64,bls:0.66};   // hover height, in tiles
const RING_BASE={cap:[0.3,0.08],vit:[0.26,0.08],utl:[0.34,0.06],bls:[0.3,0.18]};   // [mid, amp] of the ring pulse (2.6 rad/s, per-instance phase)
export const RING_LIFT=0.16;

export const faceYaw=(e)=>e.type==="stationary"?0:Math.atan2(e.dir?e.dir.x:0,e.dir?e.dir.y:1);   // a bunker has no travel: its lens always faces the rig
export function turn(cur,tgt,dt){
  let d=(tgt-cur)%TAU;
  if(d>Math.PI)d-=TAU; else if(d<-Math.PI)d+=TAU;
  return cur+d*Math.min(1,YAW_W*dt);
}

export function makeFoe(){
  return {seen:0,type:"",x:0,y:0,yaw:0,mv:0,ph:0,by:0,sc:1,pit:0,rol:0,eyeY:1,glow:0,stomp:0,ringR:0,ringA:0,t0:0};
}
/* advance one foe's pose to clock t. pl: the live player (lean target) or null. Writes S.by (y bob), S.sc (breathe x spawn pop), S.yaw, S.pit / S.rol (sway
   + hunter lean, in the slot's own frame), S.eyeY (blink: the face plane's y scale), S.glow (hunter), S.stomp (walker feet), S.ringR / S.ringA (spawn ring). */
export function stepFoe(S,e,t,dt,pl){
  const type=e.type, m=foeM(type);
  if(!S.seen||S.type!==type){ const keep=S.seen; S.seen=1; S.type=type; S.ph=phaseOf(type,e.home); if(!keep){ S.x=e.x; S.y=e.y; S.yaw=faceYaw(e); S.mv=0; } }
  if(dt>0.004){
    const d=Math.hypot(e.x-S.x,e.y-S.y);
    S.mv+=((d/dt>MOVE_V?1:0)-S.mv)*Math.min(1,dt*10);
    S.x=e.x; S.y=e.y;
    S.yaw=turn(S.yaw,faceYaw(e),dt);
  }
  const ph=S.ph, w=ph*TAU;
  S.by=(bobAt(type,ph,t,true)*S.mv+bobAt(type,ph,t,false)*(1-S.mv))*VZ;
  const p=e.invuln?1-(e.invulnT||0)/MOTION.SPAWN_T:1, sk=spawnK(p,t);
  S.sc=breatheAt(type,ph,t)*sk.s;
  if(sk.ring&&p>=0){ S.ringR=sk.ring.r; S.ringA=sk.ring.a*0.9; }   // only while the pop runs (<= 0.25 s), then nothing: the spawn ring never outshouts a pickup ring
  else { S.ringR=0; S.ringA=0; }
  S.eyeY=1-0.92*blinkAt(type,ph,t);
  S.stomp=Math.sin(12*t+w)*S.mv;
  let pit=0, rol=0;
  if(type==="boomerang"){ pit=m.sway*Math.sin(4*t+w); rol=m.sway*Math.cos(4*t+w); }
  else if(type==="rocket"){ pit=m.sway*Math.sin(19*t+w); rol=m.sway*Math.sin(23*t+w*2); }
  else if(type==="shade"){ rol=m.sway*Math.sin(2.4*t+w); pit=m.sway*0.6*Math.cos(1.9*t+w); }
  else if(type==="knight"){ rol=m.sway*Math.sin(2.6*t+w); }
  else if(type==="fast"){ pit=0.1*S.mv; }
  else if(type==="burrow"){ pit=0.04*S.mv*Math.sin(9*t+w); }
  const g=pl?leanAt(type,e.hunt,pl.x-e.x,pl.y-e.y,CFG.TILE):null;
  if(g){
    const sy=Math.sin(S.yaw), cy=Math.cos(S.yaw);
    pit+=(g.ox*sy+g.oy*cy)*LEAN_K; rol-=(g.ox*cy-g.oy*sy)*LEAN_K;
    S.glow=g.glow;
  } else S.glow=0;
  S.pit=pit; S.rol=rol;
  return S;
}

/* a dying foe (entityfx ghost): squash wide and low, then shrink; null when finished. flashK 0..1 is REDUCE FLASH: the one white frame becomes a tint */
export function ghostPose(P,g,flashK){
  const k=deathK(g.age); if(!k)return null;
  P.sx=k.sx; P.sy=k.sy; P.flash=k.flash?0.2+0.8*flashK:0;
  return P;
}

/* a pickup's pose for instance i of its kind. born: the clock time it was first seen (-Infinity = present at room start, no pop) */
export function itemPose(P,fam,kind,it,t,born){
  const T=CFG.TILE, ph=(it.x*0.7+it.y*1.3)/T, id=itemIdle(fam,ph,t), age=t-born;
  const pop=age<MOTION.POP_T?spawnK(age/MOTION.SPAWN_T,t):null;
  P.hy=T*(IT_BASE[fam]||0.66)+id.dy*HOVER_K;
  P.ry=0.22*Math.sin(1.7*t+ph);   // a gentle sway, never a spin: the badge glyph stays readable
  P.rz=id.rot*1.6;
  P.sc=id.sc*(pop?pop.s:1);
  P.glint=id.glint==null?-1:id.glint;
  const [mid,amp]=RING_BASE[fam]||RING_BASE.cap;
  P.ringK=Math.min(1,(mid+amp*Math.sin(2.6*t+ph*1.7)+RING_LIFT)/RING_OP);
  P.ringS=pop?pop.s:1;
  P.shadow=id.shadow*(pop?Math.min(1,pop.s):1);
  return P;
}
