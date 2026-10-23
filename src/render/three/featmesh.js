/* THROWAWAY PROTOTYPE (2026-10-21 tile round; round-3 effects 2026-10-23):
   REAL 3D floor-feature layer as ONE InstancedMesh (one draw) over the
   checker. The CLASSIC 2D painter bakes every cell this room can show into
   a 512^2 atlas (8x8 cells of 64 px); per-instance aCell picks the cell,
   aScr = (scroll dir in uv, exit flag) scrolls the belt / stream bed in the
   shader (only the band |across| < band scrolls, so rails, rivets and banks
   stay put as in 2D; the belt exit cap never scrolls). aFx = (kind, heat,
   param, seed) drives the per-kind effects below, all on uTime = world.featT,
   the PLAY-only clock, so PAUSE freezes every one of them (lead ruling 9):
     relief   every tile: 2 extra taps of the atlas read luminance as height,
              lit by the frozen key from the top-left (-u,+v), +-16% value
     ICE      a slow board-space specular sweep toward wallHi (12.5 s)
     BLOOM    CORE only: the leaves breathe (bounded +-3.5% scale, no wind-up)
     TRAP     MAX only: the hazard band pulses in value (x0.8..1, 2.6 s)
     STREAM   bed scrolls at the float speed + a soft low-frequency shimmer
     QUICK    a dark spiral drift running INWARD to the dimple (#000 only)
     PORTAL   core breathes toward wallHi (never past it: VOID dim rule;
              relief may only darken there) and the pair pips count up 1..n
     GATE     lit kerb strokes glow (a small emissive halo, wallHi)
   No new hex: every tint is wallHi (uHi) or black. Still one draw: the
   effects cost ALU + 2 texture taps per fragment of this mesh only. Bloom /
   plate / gate state cells are swapped in update(). Built only when
   world.feat is set, so gen 1 and non-tile rooms stay at 141. */
import * as THREE from "../../../vendor/three.module.js";
import {CFG} from "../../core/config.js";
import {FEAT_PROFILE} from "../../core/feat.js";
import {cellSpec, specKey, paintCell, tierOf} from "../featdraw.js";

const W = CFG.COLS * CFG.TILE, D = CFG.ROWS * CFG.TILE, N = 8, PX = 64, E = 0.5 / PX;
const MAT = new THREE.Matrix4();
const PM = [0.85, 1, 1.15], FLOAT = [0.8, 1, 1.2];
const KIND = {BELT: 0, GLIDE: 1, BLOOM: 2, PLATE: 3, STREAM: 4, QUICK: 5, PORTAL: 6, GATE: 7};
function variants(w, x, y) {
  const s = cellSpec(w, x, y);
  if (s.kind === "BELT" || s.kind === "STREAM") { s.phase = 0; return [s]; }
  if (s.kind === "BLOOM") return [0, 1, 2].map((st) => ({...s, state: st}));
  if (s.kind === "PLATE") return [{...s, state: 0}, ...[1, 2, 3, 4].map((l) => ({...s, state: 1, lit: l})), {...s, state: 2, lit: 0}];
  if (s.kind === "GATE") return [0, 1, 2, 3, 4].map((l) => ({...s, lit: l}));
  return [s];
}
const FRAG = `vec3 fxGlow=vec3(0.0);
#ifdef USE_MAP
  vec2 l=vL,c0=vL-0.5;
  float kd=floor(vFx.x+0.5),hh=floor(vFx.y+0.5),pr=floor(vFx.z+0.5),r=length(c0);
  if(kd==2.0&&hh<0.5){float bw=smoothstep(0.42,0.28,r);l=0.5+c0*(1.0-0.035*bw*sin(uTime*1.3+vFx.w*6.2832));}
  float along=dot(l-0.5,vScr.xy)+0.5;
  float across=abs(dot(l-0.5,vec2(-vScr.y,vScr.x)));
  if(kd==0.0&&!(vScr.z>0.5&&along>0.875)&&across<uBand) l=fract(l-vScr.xy*uT);
  if(kd==4.0&&across<0.375) l=fract(l-vScr.xy*uSt);
  l=l*(1.0-2.0*E_)+E_;
  vec4 sampledDiffuseColor=texture2D(map,vCell+l/8.0);
  const vec3 LUM=vec3(0.2126,0.7152,0.0722);
  float h0=dot(sampledDiffuseColor.rgb,LUM);
  float hx=dot(texture2D(map,vCell+min(l+vec2(1.0/64.0,0.0),1.0-E_)/8.0).rgb,LUM);
  float hy=dot(texture2D(map,vCell+min(l+vec2(0.0,1.0/64.0),1.0-E_)/8.0).rgb,LUM);
  float rel=clamp(((hx-h0)-(hy-h0))*1.6,-0.16,0.16);
  if(kd==6.0) rel=min(rel,0.0);
  vec3 col=sampledDiffuseColor.rgb*(1.0+rel);
  vec2 q=vec2(vL.x,1.0-vL.y)*40.0;
  if(kd==1.0){
    float ph=fract((vW.x+vW.y)*0.004-uTime*0.08);
    col=mix(col,uHi,0.2*exp(-pow((ph-0.5)*9.0,2.0)));
  } else if(kd==3.0&&hh>1.5){
    float e=min(min(vL.x,1.0-vL.x),min(vL.y,1.0-vL.y));
    col*=1.0-0.2*(0.5+0.5*sin(uTime*2.4))*step(e,0.125);
  } else if(kd==4.0){
    float s=sin(vW.x*0.09+uTime*1.1)*sin(vW.y*0.11-uTime*0.8+vW.x*0.05);
    col=mix(col,uHi,0.08*s*s*step(abs(dot(c0,vec2(-vScr.y,vScr.x))),0.375));
  } else if(kd==5.0){
    float sp=0.5+0.5*sin(-(hh+1.0)*atan(c0.y,c0.x)+26.0*r+uTime*1.8);
    col*=1.0-min(0.6,0.4*uFxK)*sp*smoothstep(0.37,0.2,r)*smoothstep(0.03,0.09,r);
  } else if(kd==6.0){
    float bx=max(abs(c0.x),abs(c0.y));
    col=mix(col,uHi,min(1.0,0.45*uFxK)*(0.5+0.5*sin(uTime*1.7+vFx.w*6.2832))*smoothstep(0.24,0.06,bx));
    float on=floor(mod(uTime*1.2+vFx.w*3.0,pr+1.0));
    for(int i=0;i<3;i++){
      if(float(i)>=pr) break;
      vec2 p=q-vec2(i==1?10.7:6.9,i==2?10.7:6.9);
      if(p.x>=0.0&&p.y>=0.0&&p.x<=2.8&&p.y<=2.8) col*=float(i)<on?1.0:0.4;
    }
  } else if(kd==7.0){
    for(int i=0;i<4;i++){
      if(float(i)>=pr) break;
      vec4 b=i==0?vec4(10.0,7.1,20.0,1.3):i==1?vec4(31.6,10.0,1.3,20.0):i==2?vec4(10.0,31.6,20.0,1.3):vec4(7.1,10.0,1.3,20.0);
      vec2 d=max(max(b.xy-q,q-(b.xy+b.zw)),0.0);
      fxGlow+=uHi*(0.2+0.06*sin(uTime*2.0))*exp(-dot(d,d)*0.8);
    }
  }
  diffuseColor.rgb*=col;
  diffuseColor.a*=sampledDiffuseColor.a;
#endif`;
export function buildFeat(world, biome) {
  const f = world.feat, C = CFG.COLS, tiles = [];
  for (let k = 0; k < f.length; k++) if (f[k]) tiles.push(k);
  const cells = new Map(), list = [];
  const cellOf = (s) => { const kk = specKey({...s, phase: s.kind === "BELT" || s.kind === "STREAM" ? 0 : s.phase}); if (!cells.has(kk)) { cells.set(kk, list.length); list.push(s); } return cells.get(kk); };
  for (const k of tiles) for (const s of variants(world, k % C, (k / C) | 0)) cellOf(s);
  let tex;
  if (typeof document !== "undefined" && document.createElement) {
    const cv = document.createElement("canvas"); cv.width = cv.height = N * PX;
    const g = cv.getContext("2d");
    list.slice(0, N * N).forEach((s, i) => { g.save(); g.translate((i % N) * PX, ((i / N) | 0) * PX); g.scale(PX / CFG.TILE, PX / CFG.TILE); paintCell(g, biome, s); g.restore(); });
    tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
  } else {
    tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); tex.needsUpdate = true;
  }
  const geo = new THREE.PlaneGeometry(CFG.TILE, CFG.TILE); geo.rotateX(-Math.PI / 2);
  const aCell = new THREE.InstancedBufferAttribute(new Float32Array(tiles.length * 2), 2);
  const aScr = new THREE.InstancedBufferAttribute(new Float32Array(tiles.length * 3), 3);
  const aFx = new THREE.InstancedBufferAttribute(new Float32Array(tiles.length * 4), 4);
  geo.setAttribute("aCell", aCell); geo.setAttribute("aScr", aScr); geo.setAttribute("aFx", aFx);
  const mat = new THREE.MeshLambertMaterial({color: "#ffffff", map: tex});
  const h0 = tierOf(world), uT = {value: 0}, uSt = {value: 0}, uTime = {value: 0}, uBand = {value: [0.2, 0.35, 0.3][h0]}, uHi = {value: new THREE.Color(biome.wallHi)}, uFxK = {value: 1};
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {uT, uSt, uTime, uBand, uHi, uFxK});
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec2 aCell;\nattribute vec3 aScr;\nattribute vec4 aFx;\nvarying vec2 vCell;\nvarying vec3 vScr;\nvarying vec4 vFx;\nvarying vec2 vL;\nvarying vec2 vW;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvCell=aCell;vScr=aScr;vFx=aFx;vL=uv;vW=(modelMatrix*instanceMatrix*vec4(position,1.0)).xz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>\nuniform float uT;\nuniform float uSt;\nuniform float uTime;\nuniform float uBand;\nuniform vec3 uHi;\nuniform float uFxK;\nvarying vec2 vCell;\nvarying vec3 vScr;\nvarying vec4 vFx;\nvarying vec2 vL;\nvarying vec2 vW;\n#define E_ ${E.toFixed(6)}`)
      .replace("#include <map_fragment>", FRAG)
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance+=fxGlow;");
  };
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, tiles.length));
  const setCell = (i, ci) => { aCell.setXY(i, (ci % N) / N, 1 - (((ci / N) | 0) + 1) / N); };
  const param = (s) => (s.kind === "PORTAL" ? s.pair || 1 : s.kind === "GATE" ? s.lit || 0 : 0);
  const last = new Int16Array(tiles.length).fill(-1);
  tiles.forEach((k, i) => {
    const x = k % C, y = (k / C) | 0, s = cellSpec(world, x, y);
    MAT.makeTranslation((x + 0.5) * CFG.TILE - W / 2, 0.7, (y + 0.5) * CFG.TILE - D / 2);
    mesh.setMatrixAt(i, MAT);
    if (s.kind === "BELT" || s.kind === "STREAM") { const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][s.dir]; aScr.setXYZ(i, dx, -dy, s.exit ? 1 : 0); }
    aFx.setXYZW(i, KIND[s.kind], s.h, param(s), ((k * 0.6180339) % 1));
    const ci = cellOf(s); setCell(i, ci); last[i] = ci;
  });
  mesh.count = tiles.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false; mesh.receiveShadow = true;
  mesh.userData.tag = "feat";
  return {mesh, fxK: uFxK, update(w) {
    if (!w.feat) return;
    const h = tierOf(w), t = w.featT || 0, pm = PM[Math.max(-1, Math.min(1, w.pace | 0)) + 1];
    uT.value = t * FEAT_PROFILE[h].belt.v * pm; uSt.value = t * FLOAT[h] * pm; uTime.value = t;
    let dirty = false, fx = false;
    tiles.forEach((k, i) => {
      const v = w.feat[k];
      if (v !== 6 && v !== 7 && v !== 14) return;
      const s = cellSpec(w, k % C, (k / C) | 0), ci = cellOf(s);
      if (ci !== last[i]) { last[i] = ci; setCell(i, ci); dirty = true; }
      if (v === 14 && aFx.getZ(i) !== param(s)) { aFx.setZ(i, param(s)); fx = true; }
    });
    if (dirty) aCell.needsUpdate = true;
    if (fx) aFx.needsUpdate = true;
  }};
}
