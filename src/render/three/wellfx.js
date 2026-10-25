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

/* lit-lip gain per world, slots only: the pale rims (SAND, ICE) sit near the
   frozen light's ceiling, so their lip needs more push than the dark ones */
export const LIP_GAIN = Object.freeze({SAND: 1.9, ICE: 1.8, ARENA: 1.15, WATER: 1.15});
/* painted = frame A's own strip is on the rim: it already carries a lit and a
   shaded band, a ledge and corner bosses, so this side only lifts the lip a
   little, keeps a mild ledge and draws no caps (no double brightening) */
export function rimFX(mat, hWall, painted = false, name = "") {
  const g = LIP_GAIN[name] || 1, LG = (painted ? 0.55 : 1) * g, SG = painted ? 0.5 : 1, LEDGE = painted ? 0.82 : 0.64, CAPS = painted ? 0 : 1;
  const oX = W / 2 + RIM_W - RIM_BEV, oZ = D / 2 + RIM_W - RIM_BEV, iX = W / 2 - RIM_IN + RIM_BEV, iZ = D / 2 - RIM_IN + RIM_BEV, top = hWall + RIM_LIP;
  const c = `#define OX ${f(oX)}\n#define OZ ${f(oZ)}\n#define IX ${f(iX)}\n#define IZ ${f(iZ)}\n#define TOPH ${f(top)}\n#define LG ${f(LG)}\n#define SG ${f(SG)}\n#define LEDGE ${f(LEDGE)}\n#define CAPS ${CAPS}\n`;
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = VS(sh.vertexShader);
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n" + c + "varying vec3 vWq;\nvarying float vTop;")
      .replace("#include <map_fragment>", `#include <map_fragment>
{
 float ax=abs(vWq.x), az=abs(vWq.z), k=1.0;
 if(vTop>0.5){
  float eo=min(OX-ax,OZ-az), ei=min(ax-IX,az-IZ);
  k*=mix(LEDGE,1.0,smoothstep(0.0,12.0,ei));
  float lip=1.0-smoothstep(1.5,5.5,eo);
  bool xe=(OX-ax)<(OZ-az);
  float lit=xe?step(vWq.x,0.0):step(vWq.z,0.0);
  k*=1.0+lip*mix(-0.4*SG,0.5*LG,lit);
  float cx=ax-IX-5.0, cz=az-IZ-5.0, mx=OX-5.0-ax, mz=OZ-5.0-az;
  if(CAPS>0 && min(min(cx,cz),min(mx,mz))>0.0){
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
  mat.customProgramCacheKey = () => "wellrim" + f(hWall) + f(LG) + CAPS;
  return mat;
}

export {createAO, floorFX, featAO} from "./groundfx.js";
