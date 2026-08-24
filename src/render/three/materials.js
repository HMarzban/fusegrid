/* Biome materials (real3d spec §2/§5). Flat MeshLambert colors from BIOMES
   fields so headless tests need no canvas; `atlas` (browser-only CanvasTexture
   set from textures.js, S2+) merges maps when supplied. */
import * as THREE from "../../../vendor/three.module.js";

export function build(biome, atlas){
  const floor=new THREE.MeshLambertMaterial({color:biome.floor0});
  const wall=new THREE.MeshLambertMaterial({color:biome.wall});
  const brick=new THREE.MeshLambertMaterial({color:biome.brickA});
  if(atlas){
    if(atlas.wall)wall.map=atlas.wall;
    if(atlas.brick)brick.map=atlas.brick;
    if(atlas.floor)floor.map=atlas.floor;
   }
  return {floor,wall,brick};
}
