/* Biome materials (real3d spec §2/§5). Flat MeshLambert colors from BIOMES
   fields so headless tests need no canvas; `atlas` (browser-only CanvasTexture
   set from textures.js, S2+) merges maps when supplied. */
import * as THREE from "../../../vendor/three.module.js";
import {WV_N} from "../wallvar.js";

/* wall round prototype: aWv picks the column of the wall strip (one cell per
   wall code); box tops read the strip's top row, sides its face-band row */
export function wallVS(v){
  return v.replace("#include <common>","#include <common>\nattribute float aWv;")
    .replace("#include <uv_vertex>","#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv.x=(clamp(vMapUv.x,0.0125,0.9875)+aWv)/"+WV_N+".0;\nvMapUv.y=(clamp(vMapUv.y,0.0125,0.9875)+step(0.5,abs(normal.y)))*0.5;\n#endif");
}

export function build(biome, atlas){
  const floor=new THREE.MeshLambertMaterial({color:biome.floor0});
  const wall=new THREE.MeshLambertMaterial({color:biome.wall});
  const brick=new THREE.MeshLambertMaterial({color:biome.brickA});
  if(atlas){
    if(atlas.wallStrip){ wall.map=atlas.wallStrip;
      wall.onBeforeCompile=(sh)=>{ sh.vertexShader=wallVS(sh.vertexShader); };
      wall.customProgramCacheKey=()=>"wallv"+WV_N; }
    else if(atlas.wall)wall.map=atlas.wall;
    if(atlas.brick)brick.map=atlas.brick;
    if(atlas.floor)floor.map=atlas.floor;
   }
  return {floor,wall,brick};
}
