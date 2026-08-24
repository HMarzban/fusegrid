/* Zero-asset texture pipeline (real3d spec §5): guarded canvas use — each
   atlas source is an offscreen 64x64 capture of the EXISTING sprites.js art
   fns (drawPlayerBody/drawEnemyBody/drawBombBody/drawItemBody), turned into a
   CanvasTexture with NearestFilter + sRGB. Headless (no DOM, no injected
   factory) => null => materials/entities keep flat color fallbacks. Tests
   inject a stub factory to probe sources without constructing canvases. */
import * as THREE from "../../../vendor/three.module.js";
import {CFG, biomeOf, BIOMES} from "../../core/config.js";
import {POWER} from "../../core/entities.js";
import {captureSprite, drawPlayerBody, drawEnemyBody, drawBombBody,
  drawItemBody, bakeAtlas, bakedTile} from "../sprites.js";
import {ENEMY_TYPES, ENEMY_COLORS} from "./entities.js";

const S=64, K=S/(CFG.TILE*2.05);

function src(mk,paint){
  return captureSprite(S,S,(c)=>{
    c.save(); c.translate(S/2,S/2+S*0.03); c.scale(K,K); paint(c);
    c.restore();
   },mk);
}

/* Returns {player, enemy_<type>..., bomb, item_<pdef>..., wall?, brick?} with
   canvas|null per key; wall/brick ride the existing bakedTile atlas when the
   browser has baked it (biome keyed by `level`). */
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
    o["item_"+pd.t]=src(mk,(c)=>drawItemBody(c,fake,{t:pd.t,col:pd.col}));
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

/* CanvasTexture atlas or null (headless / nothing painted). */
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
    atlas[k]=tx; n++;
   }
  return n?atlas:null;
}
