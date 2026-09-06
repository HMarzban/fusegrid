/* Zero-asset texture pipeline (real3d spec §5 + elements-redesign 2026-08-25
   §3): guarded canvas use. Character/bomb sources stay 64x64 captures of the
   EXISTING sprites.js art fns; item pickups reuse paintItemFace (drawIcon),
   enemy eye strips, the player face plate and the blast flame ramp stay
   direct canvas painters per §3.
   Every CanvasTexture gets NearestFilter + sRGB and a `_shared` flag so
   disposeGroup never frees it mid-flight. Headless (no DOM, no injected
   factory) => null => materials/entities keep flat color fallbacks. Tests
   inject a stub factory to probe sources without constructing canvases. */
import * as THREE from "../../../vendor/three.module.js";
import {CFG, biomeOf, BIOMES} from "../../core/config.js";
import {POWER} from "../../core/entities.js";
import {captureSprite, drawPlayerBody, drawEnemyBody, drawBombBody,
  bakeAtlas, bakedTile, paintItemFace, PLAYER_SUIT} from "../sprites.js";
import {dk} from "../icons.js";
import {ENEMY_TYPES, ENEMY_COLORS} from "./entities.js";

const S=64, K=S/(CFG.TILE*2.05);

function src(mk,paint){
  return captureSprite(S,S,(c)=>{
    c.save(); c.translate(S/2,S/2+S*0.03); c.scale(K,K); paint(c);
    c.restore();
   },mk);
}

/* Face-plane paints: the same socket / iris / specular / brow build the 2D
   bodies use, so a foe reads as one character in CLASSIC 2D and REAL 3D.
   Contrast still has to carry from the rig on a 64×32 strip. */
function paintEyes(c,t){
  c.fillStyle="#101521";
  c.fillRect(3,7,58,19);
  /* walker carries ONE big eye in 2D (enemybody.js), so it does here too;
     the single socket scales up to keep the same visual weight. */
  const a=t==="walker"?[32]:t==="fast"||t==="burrow"?[20,44]
    :t==="rocket"?[18,46]:[22,42];
  const k=t==="walker"?1.3:1;
  const col=t==="fast"?"#ffd447":t==="burrow"?"#c48a3a":t==="rocket"?"#ffde7a":
    t==="knight"?"#d4b05a":t==="chaser"?"#66c8ff":t==="shade"?"#6b7cff":
    t==="boomerang"?"#ff9dd6":"#8affc1";
  c.fillStyle="#05070c";
  for(const ex of a){ c.beginPath(); c.arc(ex,17,8*k,0,Math.PI*2); c.fill(); }
  c.fillStyle=col;
  for(const ex of a){ c.beginPath(); c.arc(ex,17,5.6*k,0,Math.PI*2); c.fill(); }
  c.fillStyle="#05070c";
  for(const ex of a){ c.beginPath(); c.arc(ex,17.6,2.3*k,0,Math.PI*2); c.fill(); }
  c.fillStyle="#ffffff";
  for(const ex of a){ c.beginPath();
    c.arc(ex-2.4*k,14.6,1.8*k,0,Math.PI*2); c.fill(); }
  c.fillStyle="#05070c";
  c.fillRect(3,7,58,4);
}

/* ---- stationary visor SLIT (identity §2: NOT eyes — the square reads via
   a dark seam with a faint magenta rim glow) ---- */
function paintSlit(c){
  c.globalAlpha=0.55; c.strokeStyle="#c58aff"; c.lineWidth=3;
  c.strokeRect(3,8,58,16);
  c.globalAlpha=1; c.fillStyle="#150a1c"; c.fillRect(6,11,52,10);
  c.globalAlpha=0.35; c.fillStyle="#c58aff"; c.fillRect(9,14,46,4);
  c.globalAlpha=1;
}

/* ---- §2.7 MAKO face: the 2D face beats, so both renderers show the ONE
   character — a body-coloured ground so the plate reads as the front of the
   head, two bulging cream eyes with ink pupils and a fixed upper-left
   specular, and a grin with two BLUNT teeth (never fangs). 128x128 rather
   than the old visor's 128x32 strip: this is a face, not a slit, and the
   plate's UVs are refitted to its own bounds in entities.js so the square
   actually lands. NearestFilter + sRGB + _shared as before. ---- */
function paintFace(c){
  c.fillStyle=PLAYER_SUIT; c.fillRect(0,0,128,128);
  /* grin first, eyes over it — a wide eye may overlap the mouth without
     leaving a hole in the lid, same order as drawPlayerBody */
  c.fillStyle="#12121e";
  c.beginPath();
  c.moveTo(30,86); c.quadraticCurveTo(64,101,98,86);
  c.quadraticCurveTo(64,124,30,86); c.closePath(); c.fill();
  c.fillStyle="#ffffff";
  for(const s of [-1,1]){
    c.beginPath();
    c.moveTo(64+s*3,90); c.lineTo(64+s*15,88);
    c.lineTo(64+s*16,100); c.lineTo(64+s*4,102); c.closePath(); c.fill();
   }
  for(const s of [-1,1]){
    const ex=64+s*25;
    c.fillStyle=dk(PLAYER_SUIT,0.46);
    c.beginPath(); c.ellipse(ex,44,27,26,0,0,Math.PI*2); c.fill();
    c.fillStyle="#f2e6d2";
    c.beginPath(); c.ellipse(ex+s*4,39,21,20,0,0,Math.PI*2); c.fill();
    c.fillStyle="#12121e";
    c.beginPath(); c.ellipse(ex+s*4,41,11,11,0,0,Math.PI*2); c.fill();
    c.fillStyle="#ffffff";
    c.beginPath(); c.ellipse(ex+s*4-6,33,5,5,0,0,Math.PI*2); c.fill();
   }
}

/* ---- §3 blast ramp: vertical fire gradient, alpha fades at the top edge ---- */
function paintFire(c){
  const g=c.createLinearGradient(0,64,0,0);
  g.addColorStop(0,"#fff3b0"); g.addColorStop(0.55,"#ffb347");
  g.addColorStop(1,"rgba(255,93,46,0)");
  c.fillStyle=g; c.fillRect(0,0,64,64);
}

/* Returns {player, enemy_<type>..., bomb, item_<pdef>..., eye_<type>...,
   face, fire, wall?, brick?, floor?} with canvas|null per key; wall/brick/
   floor ride the existing bakedTile atlas when the browser has baked it
   (biome keyed by `level`). */
export function atlasSources(mk, level=1){
  const o={};
  const fake={time:0};
  o.player=src(mk,(c)=>drawPlayerBody(c,fake,{face:{x:0,y:0},iFrames:0,
    walk:0,shield:false,kick:false,passing:false}));
  for(const t of ENEMY_TYPES)
    o["enemy_"+t]=src(mk,(c)=>drawEnemyBody(c,fake,{type:t,r:14,
      color:ENEMY_COLORS[t],invuln:false,home:{x:1,y:1}}));
  o.bomb=src(mk,(c)=>drawBombBody(c,fake,{timer:CFG.FUSE,variant:"normal"}));
  for(const pd of POWER)
    o["item_"+pd.t]=captureSprite(S,S,(c)=>paintItemFace(c,pd.t,pd.col),mk);
  for(const t of ENEMY_TYPES)
    o["eye_"+t]=captureSprite(64,32,(c)=>t==="stationary"?paintSlit(c):
      paintEyes(c,t),mk);
  o.face=captureSprite(128,128,paintFace,mk);
  o.fire=captureSprite(S,S,paintFire,mk);
  if(typeof document!=="undefined"){
    try{
      bakeAtlas();
      const bi=BIOMES.indexOf(biomeOf(level));
      o.wall=bakedTile(bi,"wall");
      o.brick=bakedTile(bi,"brick");
      o.floor=bakedTile(bi,"floorA");
     }catch(_){ /* stay asset-free */ }
   }
  return o;
}

/* CanvasTexture atlas or null (headless / nothing painted). Textures are
   flagged _shared: pooled entity materials may be disposed on level rebuilds
   but the shared atlas must survive them. */
export function buildAtlas(mk, level=1){
  let s;
  try{ s=atlasSources(mk,level); }catch(_){ return null; }
  if(!s)return null;
  const atlas={}; let n=0;
  for(const k in s){
    const cv=s[k]; if(!cv)continue;
    let tx;
    try{ tx=new THREE.CanvasTexture(cv); }catch(_){ continue; }
    tx.magFilter=THREE.NearestFilter; tx.minFilter=THREE.NearestFilter;
    tx.generateMipmaps=false; tx.colorSpace=THREE.SRGBColorSpace;
    tx._shared=true;
    atlas[k]=tx; n++;
   }
  return n?atlas:null;
}
