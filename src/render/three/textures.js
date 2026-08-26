/* Zero-asset texture pipeline (real3d spec §5 + elements-redesign 2026-08-25
   §3): guarded canvas use. Character/bomb sources stay 64x64 captures of the
   EXISTING sprites.js art fns; item pickups, enemy eye strips, the player
   visor band and the blast flame ramp are direct canvas painters per §3.
   Every CanvasTexture gets NearestFilter + sRGB and a `_shared` flag so
   disposeGroup never frees it mid-flight. Headless (no DOM, no injected
   factory) => null => materials/entities keep flat color fallbacks. Tests
   inject a stub factory to probe sources without constructing canvases. */
import * as THREE from "../../../vendor/three.module.js";
import {CFG, biomeOf, BIOMES} from "../../core/config.js";
import {POWER} from "../../core/entities.js";
import {captureSprite, drawPlayerBody, drawEnemyBody, drawBombBody,
  bakeAtlas, bakedTile} from "../sprites.js";
import {ENEMY_TYPES, ENEMY_COLORS} from "./entities.js";

const S=64, K=S/(CFG.TILE*2.05);

function src(mk,paint){
  return captureSprite(S,S,(c)=>{
    c.save(); c.translate(S/2,S/2+S*0.03); c.scale(K,K); paint(c);
    c.restore();
   },mk);
}

/* ---- §3 glyph painters: bold stroked POWER icons on transparent 64x64, no
   backing plate. Each paints in local coords around (32,32). ---- */
function glyphBase(c,col){
  c.lineWidth=6; c.lineJoin="round"; c.lineCap="round";
  c.strokeStyle=col;
}
/* small white glint cross for the inner-highlight pass */
function spark(c,x,y){
  c.strokeStyle="#ffffff"; c.lineWidth=2.5; c.beginPath();
  c.moveTo(x-5,y); c.lineTo(x+5,y); c.moveTo(x,y-5); c.lineTo(x,y+5);
  c.stroke();
}
const GLYPH={
  fire(c,col){
    c.fillStyle=col; c.beginPath();
    c.moveTo(32,7); c.bezierCurveTo(44,19,51,30,47,43);
    c.bezierCurveTo(44,53,38,57,32,57);
    c.bezierCurveTo(26,57,20,53,17,43);
    c.bezierCurveTo(13,30,22,21,26,12);
    c.closePath(); c.fill();
    c.strokeStyle="#ffffff"; c.lineWidth=3; c.beginPath();
    c.moveTo(32,26); c.quadraticCurveTo(39,36,32,48); c.stroke();
    spark(c,45,15);
   },
  bomb(c,col){
    c.fillStyle=col; c.beginPath(); c.arc(31,39,15,0,Math.PI*2); c.fill();
    c.strokeStyle=col; c.lineWidth=5; c.beginPath();
    c.moveTo(39,27); c.quadraticCurveTo(45,14,55,11); c.stroke();
    c.strokeStyle="#ffffff"; c.lineWidth=3; c.beginPath();
    c.moveTo(28,33); c.lineTo(34,40); c.lineTo(29,40); c.lineTo(35,48);
    c.stroke();
   },
  speed(c,col){
    c.fillStyle=col; c.beginPath();
    c.moveTo(37,6); c.lineTo(17,36); c.lineTo(30,36); c.lineTo(26,58);
    c.lineTo(47,26); c.lineTo(33,26); c.closePath(); c.fill();
    c.strokeStyle="#ffffff"; c.lineWidth=2.5; c.beginPath();
    c.moveTo(33,12); c.lineTo(24,28); c.stroke();
    spark(c,44,44);
   },
  heart(c,col){
    c.fillStyle=col; c.beginPath();
    c.moveTo(32,56); c.bezierCurveTo(8,38,12,16,32,26);
    c.bezierCurveTo(52,16,56,38,32,56);
    c.closePath(); c.fill();
    c.strokeStyle="#ffffff"; c.lineWidth=2.5; c.beginPath();
    c.arc(25,26,4,0,Math.PI*2); c.stroke();
    spark(c,42,22);
   },
  shield(c,col){
    c.fillStyle=col; c.beginPath();
    c.moveTo(32,7); c.lineTo(53,15); c.lineTo(53,33);
    c.bezierCurveTo(53,47,43,54,32,58);
    c.bezierCurveTo(21,54,11,47,11,33);
    c.lineTo(11,15); c.closePath(); c.fill();
    c.strokeStyle="#ffffff"; c.lineWidth=3; c.beginPath();
    c.moveTo(32,18); c.lineTo(32,46); c.moveTo(20,30); c.lineTo(44,30);
    c.stroke();
    spark(c,45,45);
   },
  kick(c,col){
    c.beginPath(); c.moveTo(23,8); c.lineTo(23,36); c.lineTo(45,45);
    c.lineTo(45,54); c.lineTo(15,54); c.lineTo(15,8); c.closePath();
    c.strokeStyle=col; c.lineWidth=6; c.stroke();
    c.strokeStyle="#ffffff"; c.lineWidth=3; c.beginPath();
    c.moveTo(19,49); c.lineTo(41,49); c.stroke();
    c.fillStyle=col; c.beginPath(); c.arc(29,20,3,0,Math.PI*2); c.fill();
   },
  throw(c,col){
    c.strokeStyle=col; c.lineWidth=6; c.beginPath();
    c.arc(32,44,18,Math.PI,Math.PI*2); c.stroke();
    c.fillStyle=col; c.beginPath(); c.arc(50,44,6,0,Math.PI*2); c.fill();
    c.strokeStyle="#ffffff"; c.lineWidth=2.5; c.beginPath();
    c.moveTo(10,52); c.lineTo(20,44); c.stroke();
   },
  pass(c,col){
    c.strokeStyle=col; c.lineWidth=6; c.beginPath();
    c.moveTo(26,15); c.lineTo(11,32); c.lineTo(26,49); c.stroke();
    c.beginPath(); c.moveTo(38,15); c.lineTo(53,32); c.lineTo(38,49);
    c.stroke();
    c.strokeStyle="#ffffff"; c.lineWidth=2.5; c.beginPath();
    c.moveTo(32,24); c.lineTo(32,40); c.stroke();
    c.fillStyle=col; c.beginPath(); c.arc(32,32,3.5,0,Math.PI*2); c.fill();
   },
  line(c,col){
    c.strokeStyle=col; c.lineWidth=6;
    for(const y of [16,32,48]){ c.beginPath();
      c.moveTo(13,y); c.lineTo(51,y); c.stroke(); }
    c.fillStyle=col; c.fillRect(29,29,6,6);
    c.strokeStyle="#ffffff"; c.lineWidth=2.5; c.beginPath();
    c.moveTo(13,10); c.lineTo(51,10); c.stroke();
   },
  power(c,col){
    c.fillStyle=col; c.beginPath();
    c.moveTo(32,6); c.lineTo(38,26); c.lineTo(58,32); c.lineTo(38,38);
    c.lineTo(32,58); c.lineTo(26,38); c.lineTo(6,32); c.lineTo(26,26);
    c.closePath(); c.fill();
    c.strokeStyle="#ffffff"; c.lineWidth=2.5; c.beginPath();
    c.arc(32,32,6,0,Math.PI*2); c.stroke();
    spark(c,48,16);
   },
  pierce(c,col){
    c.fillStyle=col; c.beginPath();
    c.moveTo(10,20); c.lineTo(10,44); c.lineTo(54,32); c.closePath();
    c.fill();
    c.strokeStyle=col; c.lineWidth=4; c.beginPath();
    c.moveTo(8,14); c.lineTo(20,14); c.moveTo(8,50); c.lineTo(20,50);
    c.stroke();
    c.strokeStyle="#ffffff"; c.lineWidth=2.5; c.beginPath();
    c.moveTo(44,32); c.lineTo(52,32); c.stroke();
    spark(c,30,11);
   },
  remote(c,col){
    c.strokeStyle=col; c.lineWidth=5; c.beginPath();
    c.moveTo(32,56); c.lineTo(32,20); c.stroke();
    c.lineWidth=4;
    c.beginPath(); c.arc(32,18,9,-Math.PI*0.8,-Math.PI*0.2); c.stroke();
    c.beginPath(); c.arc(32,18,16,-Math.PI*0.75,-Math.PI*0.25); c.stroke();
    c.fillStyle="#ffffff"; c.beginPath(); c.arc(32,18,3,0,Math.PI*2);
    c.fill();
   }
};
function paintGlyph(c,pd){
  glyphBase(c,pd.col);
  (GLYPH[pd.t]||GLYPH.power)(c,pd.col);
}

/* ---- §3 eye strips (enemy-identity 2026-08-25: BOLDENED — bigger sclerae
   with dark outline, fatter pupils, heavier brows; the big tilted face
   planes need the extra contrast to read from the 66° rig) ---- */
function paintEyes(c,t){
  const idx=Math.max(0,ENEMY_TYPES.indexOf(t));
  const dx=(idx%3-1)*3, dy=(idx<3?-1:1)*1.5, slope=(idx-2.5)*0.05;
  c.fillStyle="#f4f7ff";
  for(const ex of [19,45]){ c.beginPath();
    c.ellipse(ex+dx*0.4,16,11.5,9,0,0,Math.PI*2); c.fill(); }
  c.strokeStyle="#101521"; c.lineWidth=2.5;
  for(const ex of [19,45]){ c.beginPath();
    c.ellipse(ex+dx*0.4,16,11.5,9,0,0,Math.PI*2); c.stroke(); }
  c.fillStyle="#101521";
  for(const ex of [19,45]){ c.beginPath();
    c.arc(ex+dx,16+dy,5.2,0,Math.PI*2); c.fill(); }
  c.strokeStyle="#101521"; c.lineWidth=4.5; c.lineCap="round";
  for(const ex of [19,45]){ c.beginPath();
    c.moveTo(ex-12,6-slope*11); c.lineTo(ex+12,6+slope*11); c.stroke(); }
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

/* ---- §3 visor band: navy strip with two cyan glints ---- */
function paintVisor(c){
  c.fillStyle="#0b1020"; c.fillRect(0,6,128,20);
  c.fillStyle="#59f7ff";
  for(const gx of [26,78]){
    c.beginPath(); c.moveTo(gx+10,9); c.lineTo(gx+18,9);
    c.lineTo(gx+10,23); c.lineTo(gx+2,23); c.closePath(); c.fill();
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
   visor, fire, wall?, brick?} with canvas|null per key; wall/brick ride the
   existing bakedTile atlas when the browser has baked it (biome keyed by
   `level`). */
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
    o["item_"+pd.t]=captureSprite(S,S,(c)=>paintGlyph(c,pd),mk);
  for(const t of ENEMY_TYPES)
    o["eye_"+t]=captureSprite(64,32,(c)=>t==="stationary"?paintSlit(c):
      paintEyes(c,t),mk);
  o.visor=captureSprite(128,32,paintVisor,mk);
  o.fire=captureSprite(S,S,paintFire,mk);
  if(typeof document!=="undefined"){
    try{
      bakeAtlas();
      const bi=BIOMES.indexOf(biomeOf(level));
      o.wall=bakedTile(bi,"wall");
      o.brick=bakedTile(bi,"brick");
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
