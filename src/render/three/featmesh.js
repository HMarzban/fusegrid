/* THROWAWAY PROTOTYPE (2026-10-21 tile round): REAL 3D floor-feature layer
   as ONE InstancedMesh (one draw) over the checker. The CLASSIC 2D painter
   bakes every cell this room can show into a 512^2 atlas (8x8 cells of 64
   px); per-instance aCell picks the cell, aScr = (belt dir in uv, exit
   flag) scrolls the belt bed in the shader at the true belt speed (uT, fed
   from world.featT, so PAUSE freezes it); the exit tile's downstream cap
   never scrolls. Bloom / plate state cells are swapped in update(). Built
   only when world.feat is set, so gen 1 and non-tile rooms stay at 141. */
import * as THREE from "../../../vendor/three.module.js";
import {CFG, biomeOf} from "../../core/config.js";
import {FEAT_PROFILE} from "../../core/feat.js";
import {cellSpec, specKey, paintCell, tierOf} from "../featdraw.js";

const W = CFG.COLS * CFG.TILE, D = CFG.ROWS * CFG.TILE, N = 8, PX = 64, E = 0.5 / PX;
const MAT = new THREE.Matrix4();
const PM = [0.85, 1, 1.15];
function variants(w, x, y) {
  const s = cellSpec(w, x, y);
  if (s.kind === "BELT") { s.phase = 0; return [s]; }
  if (s.kind === "GLIDE") return [s];
  if (s.kind === "BLOOM") return [0, 1, 2].map((st) => ({...s, state: st}));
  return [{...s, state: 0}, ...[1, 2, 3, 4].map((l) => ({...s, state: 1, lit: l})), {...s, state: 2, lit: 0}];
}
export function buildFeat(world, biome) {
  const f = world.feat, C = CFG.COLS, tiles = [];
  for (let k = 0; k < f.length; k++) if (f[k]) tiles.push(k);
  const cells = new Map(), list = [];
  const cellOf = (s) => { const kk = specKey({...s, phase: s.kind === "BELT" ? 0 : s.phase}); if (!cells.has(kk)) { cells.set(kk, list.length); list.push(s); } return cells.get(kk); };
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
  geo.setAttribute("aCell", aCell); geo.setAttribute("aScr", aScr);
  const mat = new THREE.MeshLambertMaterial({color: "#ffffff", map: tex});
  const uT = {value: 0};
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uT;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec2 aCell;\nattribute vec3 aScr;\nvarying vec2 vCell;\nvarying vec3 vScr;\nvarying vec2 vL;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvCell=aCell;vScr=aScr;vL=uv;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uT;\nvarying vec2 vCell;\nvarying vec3 vScr;\nvarying vec2 vL;")
      .replace("#include <map_fragment>", `#ifdef USE_MAP
  vec2 l=vL;
  float along=dot(l-0.5,vScr.xy)+0.5;
  if(!(vScr.z>0.5&&along>0.875)) l=fract(l-vScr.xy*uT);
  l=l*(1.0-2.0*${E.toFixed(6)})+${E.toFixed(6)};
  vec4 sampledDiffuseColor=texture2D(map,vCell+l/${N.toFixed(1)});
  diffuseColor*=sampledDiffuseColor;
#endif`);
  };
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, tiles.length));
  const setCell = (i, ci) => { aCell.setXY(i, (ci % N) / N, 1 - (((ci / N) | 0) + 1) / N); };
  const last = new Int16Array(tiles.length).fill(-1);
  tiles.forEach((k, i) => {
    const x = k % C, y = (k / C) | 0, s = cellSpec(world, x, y);
    MAT.makeTranslation((x + 0.5) * CFG.TILE - W / 2, 0.7, (y + 0.5) * CFG.TILE - D / 2);
    mesh.setMatrixAt(i, MAT);
    if (s.kind === "BELT") { const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][s.dir]; aScr.setXYZ(i, dx, -dy, s.exit ? 1 : 0); }
    const ci = cellOf(s); setCell(i, ci); last[i] = ci;
  });
  mesh.count = tiles.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false; mesh.receiveShadow = true;
  mesh.userData.tag = "feat";
  return {mesh, update(w) {
    if (!w.feat) return;
    const h = tierOf(w);
    uT.value = (w.featT || 0) * FEAT_PROFILE[h].belt.v * PM[Math.max(-1, Math.min(1, w.pace | 0)) + 1];
    let dirty = false;
    tiles.forEach((k, i) => {
      const v = w.feat[k];
      if (v !== 6 && v !== 7) return;
      const ci = cellOf(cellSpec(w, k % C, (k / C) | 0));
      if (ci !== last[i]) { last[i] = ci; setCell(i, ci); dirty = true; }
    });
    if (dirty) aCell.needsUpdate = true;
  }};
}
