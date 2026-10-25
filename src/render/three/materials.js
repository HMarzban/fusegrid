/* Biome materials (real3d spec §2/§5). Flat MeshLambert colors from BIOMES
   fields so headless tests need no canvas; `atlas` (browser-only CanvasTexture
   set from textures.js, S2+) merges maps when supplied. */
import * as THREE from "../../../vendor/three.module.js";
import {WV_N} from "../wallvar.js";

/* wall round prototype: aWv picks the column of the wall strip (one cell per
   wall code); box tops read the strip's top row, sides its face-band row */
export function wallVS(v){
  return v.replace("#include <common>","#include <common>\nattribute float aWv;\nvarying vec2 vWs;\nvarying vec2 vWu;")
    .replace("#include <uv_vertex>","#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv.x=(clamp(vMapUv.x,0.0125,0.9875)+aWv)/"+WV_N+".0;\nvMapUv.y=(clamp(vMapUv.y,0.0125,0.9875)+step(0.5,abs(normal.y)))*0.5;\n#endif\n#ifdef USE_BUMPMAP\nvBumpMapUv=vMapUv;\n#endif\nvWs=vec2(uv.y,1.0-step(0.5,abs(normal.y)));\nvWu=uv;");
}
/* round 3 (REAL 3D walls): the surface strip's relief bends the normal
   (three's own bumpMap path), its gloss gives a Blinn highlight from the
   SAME frozen lights inside the Lambert direct term (no new light, no tone
   change), and the side faces darken softly toward the floor (contact AO,
   bottom 35%). All static: the camera is fixed, so nothing shimmers or
   flashes, and PAUSE freezes it with the board. */
export function wallFS(f,fx=WALL_FX){
  const n=(v)=>(+v).toFixed(3);
  return f.replace("#include <common>","#include <common>\nvarying vec2 vWs;\nvarying vec2 vWu;\nfloat wGl=0.0, wSh=4.0;")
    .replace("#include <lights_lambert_pars_fragment>",THREE.ShaderChunk.lights_lambert_pars_fragment.replace(
      "reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );",
      "reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n\tvec3 wH = normalize( directLight.direction + geometryViewDir );\n\treflectedLight.directDiffuse += irradiance * mix( vec3( 1.0 ), material.diffuseColor, 0.5 ) * wGl * pow( saturate( dot( geometryNormal, wH ) ), wSh );"))
    .replace("#include <map_fragment>","#include <map_fragment>\ndiffuseColor.rgb*=mix(1.0,mix("+n(1-fx.ao)+",1.0,smoothstep(0.0,0.35,vWs.x)),vWs.y);\n{ vec2 we=min(vWu,1.0-vWu); float wbev=(1.0-vWs.y)*(1.0-smoothstep(0.0,0.07,min(we.x,we.y))); diffuseColor.rgb*=1.0+wbev*0.15+vWs.y*smoothstep(0.8,1.0,vWs.x)*0.1; }\n#ifdef USE_BUMPMAP\n{ vec4 wS=texture2D(bumpMap,vBumpMapUv); wGl=wS.g*"+n(fx.gloss)+"; wSh=2.0+wS.b*18.0; }\n#endif");
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

/* BRICK (depth round, lane B): the ONE brick material. The old instance colour
   (bA / bB / bH by a position test) multiplied an already coloured tile and
   made the tops flicker in brightness block to block; it is dropped here and
   a subtle hash of the instance cell (+-3.5 %) replaces it. The face is mixed
   toward the world's own shadow slots (mix of bg1 and brickB) by BRICK_M, the
   top by half that so its highlight survives; sides darken toward the floor
   (contact AO) and lift a hair at the lip, tops carry a bevel highlight, the
   tile's own luminance is the bump, and a Blinn gloss rides the key. */
/* measured on the albedo today's pipeline renders (tile x instance colour,
   avg L*): side face 8-12 L* down, m = mix toward the shadow slot, g = what
   m alone cannot reach (tools/ lstar probe, lane B notes) */
export const BRICK_FX = {JUNGLE:{m:0.55,g:0.99},ICE:{m:0.45,g:1.0},FACTORY:{m:0.45,g:0.64},WATER:{m:0.45,g:0.61},ARENA:{m:0.45,g:0.64},SAND:{m:0.45,g:0.54},VOID:{m:0.45,g:0.28},CROWN:{m:0.45,g:0.80}};
function brickFX(mat, biome){
  const tgt=new THREE.Color(biome.bg1).lerp(new THREE.Color(biome.brickB),0.5), fx=BRICK_FX[biome.name]||{m:0.45,g:0.7};
  mat.onBeforeCompile=(sh)=>{
    sh.uniforms.uTgt={value:tgt}; sh.uniforms.uM={value:fx.m}; sh.uniforms.uG={value:fx.g};
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nvarying vec2 vBu;\nvarying float vBt;\nvarying float vBh;")
      .replace("#include <uv_vertex>","#include <uv_vertex>\nvBu=uv; vBt=step(0.5,normal.y);\n#ifdef USE_INSTANCING\nvBh=fract(sin(dot(vec2(instanceMatrix[3].x,instanceMatrix[3].z),vec2(12.9898,78.233)))*43758.5453);\n#else\nvBh=0.5;\n#endif");
    sh.fragmentShader=glossLambert(sh.fragmentShader.replace("#include <common>","#include <common>\nuniform vec3 uTgt;\nuniform float uM;\nuniform float uG;\nvarying vec2 vBu;\nvarying float vBt;\nvarying float vBh;"))
      .replace("#include <color_fragment>","")
      .replace("#include <map_fragment>",`#include <map_fragment>
{ diffuseColor.rgb=mix(diffuseColor.rgb,uTgt,mix(uM,uM*0.6,vBt))*mix(uG,pow(uG,0.55),vBt);
 diffuseColor.rgb*=1.0+(vBh-0.5)*0.07;
 float be=min(min(vBu.x,1.0-vBu.x),min(vBu.y,1.0-vBu.y));
 diffuseColor.rgb*=1.0+vBt*(1.0-smoothstep(0.0,0.08,be))*0.14;
 diffuseColor.rgb*=mix(mix(0.6,1.0,smoothstep(0.0,0.4,vBu.y))*(1.0+0.08*smoothstep(0.85,1.0,vBu.y)),1.0,vBt);
 wGl=mix(0.1,0.34,vBt); wSh=mix(4.0,14.0,vBt); }`);
  };
  mat.customProgramCacheKey=()=>"brickfx"+biome.name;
  return mat;
}
/* the Blinn gloss riding the Lambert direct term, shared with the wall */
function glossLambert(f){
  return f.replace("#include <common>","#include <common>\nfloat wGl=0.0, wSh=4.0;")
    .replace("#include <lights_lambert_pars_fragment>",THREE.ShaderChunk.lights_lambert_pars_fragment.replace(
      "reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );",
      "reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n\tvec3 wH = normalize( directLight.direction + geometryViewDir );\n\treflectedLight.directDiffuse += irradiance * mix( vec3( 1.0 ), material.diffuseColor, 0.5 ) * wGl * pow( saturate( dot( geometryNormal, wH ) ), wSh );"));
}

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
    if(atlas.brick){ brick.map=atlas.brick; brick.bumpMap=atlas.brick; brick.bumpScale=1.1; brickFX(brick,biome); }
    if(atlas.floor)floor.map=atlas.floor;
   }
  return {floor,wall,brick};
}
