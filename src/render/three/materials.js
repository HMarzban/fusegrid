/* Biome materials (real3d spec §2/§5). Flat MeshLambert colors from BIOMES
   fields so headless tests need no canvas; `atlas` (browser-only CanvasTexture
   set from textures.js, S2+) merges maps when supplied. */
import * as THREE from "../../../vendor/three.module.js";
import {WV_N} from "../wallvar.js";

/* wall round prototype: aWv picks the column of the wall strip (one cell per
   wall code); box tops read the strip's top row, sides its face-band row */
export function wallVS(v){
  return v.replace("#include <common>","#include <common>\nattribute float aWv;\nvarying vec2 vWs;")
    .replace("#include <uv_vertex>","#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv.x=(clamp(vMapUv.x,0.0125,0.9875)+aWv)/"+WV_N+".0;\nvMapUv.y=(clamp(vMapUv.y,0.0125,0.9875)+step(0.5,abs(normal.y)))*0.5;\n#endif\n#ifdef USE_BUMPMAP\nvBumpMapUv=vMapUv;\n#endif\nvWs=vec2(uv.y,1.0-step(0.5,abs(normal.y)));");
}
/* round 3 (REAL 3D walls): the surface strip's relief bends the normal
   (three's own bumpMap path), its gloss gives a Blinn highlight from the
   SAME frozen lights inside the Lambert direct term (no new light, no tone
   change), and the side faces darken softly toward the floor (contact AO,
   bottom 35%). All static: the camera is fixed, so nothing shimmers or
   flashes, and PAUSE freezes it with the board. */
export function wallFS(f,fx=WALL_FX){
  const n=(v)=>(+v).toFixed(3);
  return f.replace("#include <common>","#include <common>\nvarying vec2 vWs;\nfloat wGl=0.0, wSh=4.0;")
    .replace("#include <lights_lambert_pars_fragment>",THREE.ShaderChunk.lights_lambert_pars_fragment.replace(
      "reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );",
      "reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n\tvec3 wH = normalize( directLight.direction + geometryViewDir );\n\treflectedLight.directDiffuse += irradiance * mix( vec3( 1.0 ), material.diffuseColor, 0.5 ) * wGl * pow( saturate( dot( geometryNormal, wH ) ), wSh );"))
    .replace("#include <map_fragment>","#include <map_fragment>\ndiffuseColor.rgb*=mix(1.0,mix("+n(1-fx.ao)+",1.0,smoothstep(0.0,0.35,vWs.x)),vWs.y);\n#ifdef USE_BUMPMAP\n{ vec4 wS=texture2D(bumpMap,vBumpMapUv); wGl=wS.g*"+n(fx.gloss)+"; wSh=2.0+wS.b*18.0; }\n#endif");
}

/* one global wall response for every world: bump = relief depth, gloss =
   highlight strength (the strip's G scales it per texel), ao = how much the
   side face darkens at the floor. Mutable only so the round-3 contact
   sheets can compare candidates in the real renderer (tools/walls/rig3d).
   Picked C (bump 3): bump 6 made the walls change ~40% more between two
   frames a 4-unit dolly apart (tools/walls/shimmer.mjs), i.e. crawl; at 3
   the flicker share stays at the flat strip's */
export const WALL_FX={bump:3,gloss:0.6,ao:0.2};
const fxKey=()=>[WALL_FX.bump,WALL_FX.gloss,WALL_FX.ao].join("_");

export function build(biome, atlas){
  const floor=new THREE.MeshLambertMaterial({color:biome.floor0});
  const wall=new THREE.MeshLambertMaterial({color:biome.wall});
  const brick=new THREE.MeshLambertMaterial({color:biome.brickA});
  if(atlas){
    if(atlas.wallStrip){ wall.map=atlas.wallStrip;
      const fx={...WALL_FX}, k=fxKey();
      if(atlas.wallSurf&&(fx.bump>0||fx.gloss>0)){ wall.bumpMap=atlas.wallSurf; wall.bumpScale=fx.bump; }
      wall.onBeforeCompile=(sh)=>{ sh.vertexShader=wallVS(sh.vertexShader); sh.fragmentShader=wallFS(sh.fragmentShader,fx); };
      wall.customProgramCacheKey=()=>"wallv"+WV_N+(wall.bumpMap?"s":"")+k; }
    else if(atlas.wall)wall.map=atlas.wall;
    if(atlas.brick)brick.map=atlas.brick;
    if(atlas.floor)floor.map=atlas.floor;
   }
  return {floor,wall,brick};
}
