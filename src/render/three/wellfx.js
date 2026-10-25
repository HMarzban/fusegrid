/* Frame B, RECESSED WELL, REAL 3D (mockup 2026-10-25): depth by shader on the
   two materials that already exist, so no mesh, no draw call and no light is
   added (fat-world stays 141). The camera is fixed and the terms are static,
   so nothing shimmers and PAUSE freezes them with the board.
     rimFX   the cabinet rim: a lit outer lip (far/left lit, near/right
             shaded), a darker inner ledge dropping into the well, a capped
             square at each corner, side faces darkening toward the floor.
     floorFX the checker: ambient occlusion along the inner playfield edge
             (concave corners multiply), lighter on the near side because that
             wall is cut to NEAR_H.
   World position comes from the instance matrix, never the scene graph. */
import {CFG} from "../../core/config.js";
import {RIM_W, RIM_IN, RIM_BEV, RIM_LIP} from "./scene.js";

const W = CFG.COLS * CFG.TILE, D = CFG.ROWS * CFG.TILE, T = CFG.TILE;
const f = (v) => (+v).toFixed(2);
const VS = (v) => v.replace("#include <common>", "#include <common>\nvarying vec3 vWq;\nvarying float vTop;")
  .replace("#include <begin_vertex>", "#include <begin_vertex>\n#ifdef USE_INSTANCING\nvWq=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;\n#else\nvWq=(modelMatrix*vec4(transformed,1.0)).xyz;\n#endif\nvTop=step(0.5,normal.y);");

export function rimFX(mat, hWall) {
  const oX = W / 2 + RIM_W - RIM_BEV, oZ = D / 2 + RIM_W - RIM_BEV, iX = W / 2 - RIM_IN + RIM_BEV, iZ = D / 2 - RIM_IN + RIM_BEV, top = hWall + RIM_LIP;
  const c = `#define OX ${f(oX)}\n#define OZ ${f(oZ)}\n#define IX ${f(iX)}\n#define IZ ${f(iZ)}\n#define TOPH ${f(top)}\n`;
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = VS(sh.vertexShader);
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n" + c + "varying vec3 vWq;\nvarying float vTop;")
      .replace("#include <map_fragment>", `#include <map_fragment>
{
 float ax=abs(vWq.x), az=abs(vWq.z), k=1.0;
 if(vTop>0.5){
  float eo=min(OX-ax,OZ-az), ei=min(ax-IX,az-IZ);
  k*=mix(0.64,1.0,smoothstep(0.0,12.0,ei));
  float lip=1.0-smoothstep(1.5,5.5,eo);
  bool xe=(OX-ax)<(OZ-az);
  float lit=xe?step(vWq.x,0.0):step(vWq.z,0.0);
  k*=1.0+lip*mix(-0.4,0.5,lit);
  float cx=ax-IX-5.0, cz=az-IZ-5.0, mx=OX-5.0-ax, mz=OZ-5.0-az;
  if(min(min(cx,cz),min(mx,mz))>0.0){
   float de=min(min(cx,cz),min(mx,mz));
   k*=1.08;
   k*=mix(0.78,1.0,smoothstep(0.0,2.0,de));
   float rv=length(vec2(ax-(IX+OX)*0.5,az-(IZ+OZ)*0.5));
   k*=mix(0.62,1.0,smoothstep(2.5,4.5,rv));
  }
 } else {
  k*=mix(0.5,1.0,smoothstep(0.0,TOPH,vWq.y));
 }
 diffuseColor.rgb*=k;
}`);
  };
  mat.customProgramCacheKey = () => "wellrim" + f(hWall);
  return mat;
}

export function floorFX(mat) {
  const ix = W / 2 - T, iz = D / 2 - T;
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = VS(sh.vertexShader);
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWq;\nvarying float vTop;")
      .replace("#include <map_fragment>", `#include <map_fragment>
{
 float dx=max(${f(ix)}-abs(vWq.x),0.0), dz=max(${f(iz)}-abs(vWq.z),0.0);
 float ox=exp(-dx/16.0)*0.42, oz=exp(-dz/16.0)*mix(0.42,0.26,step(0.0,vWq.z));
 diffuseColor.rgb*=(1.0-ox)*(1.0-oz);
}`);
  };
  mat.customProgramCacheKey = () => "wellfloor";
  return mat;
}
