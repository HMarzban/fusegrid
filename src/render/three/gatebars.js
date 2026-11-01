/* GATE bars (#26), REAL 3D: one InstancedMesh, one draw, only in a gate room. The
   painter's slits read top-down, so the bars stand in those same slits and rise
   with featM's closing steps to min(hWall, NEAR_H) (ruling 2026-10-09: nothing
   taller beside a row-11 actor), casting a real shadow. While a gate is passable
   the heat tell stands on its two jambs: 1 / 2 / 3 raised posts, the same spots as
   the painter's. A ring-dead gate has no bars, the wall mesh owns it. */
import * as THREE from "../../../vendor/three.module.js";
import {CFG} from "../../core/config.js";
import {F, featTier} from "../../core/feat.js";
import {gateBar, GATE_SHUT} from "../../core/tilegate.js";
import {GEO} from "../featart/geo.js";
import {live} from "./upload.js";

const TL = CFG.TILE, C = CFG.COLS, W = C * TL, D = CFG.ROWS * TL, S = TL / 40, POST_H = 9;
const MAT = new THREE.Matrix4();
export const hasGates = (world) => !!world.feat && world.feat.includes(F.GATE);
export function createGateBars(world, biome, nearH) {
  const G = GEO.GATE, h = featTier(world), cap = Math.min(biome.hWall, nearH), nb = G.n[h], pitch = (G.x1 - G.x0 - G.bw) / (nb - 1), posts = G.post[h];
  const tiles = [];
  world.feat.forEach((v, k) => { if (v === F.GATE) tiles.push(k); });
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({color: "#ffffff"}), tiles.length * (nb + posts.length * 2));
  const cBar = new THREE.Color(biome.wall).lerp(new THREE.Color(biome.wallHi), 0.7), cPost = new THREE.Color(biome.wallHi);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.tag = "gatebars";
  const last = new Int8Array(tiles.length).fill(-1);
  const put = (i, k, px, py, sx, sy, sz, col) => {
    MAT.makeScale(sx * S, sy, sz * S).setPosition((k % C) * TL + px * S - W / 2, sy / 2, ((k / C) | 0) * TL + py * S - D / 2);
    mesh.setMatrixAt(i, MAT);
    mesh.setColorAt(i, col);
  };
  return {mesh, update(w) {
    let diff = false;
    tiles.forEach((k, i) => { const l = gateBar(w, k) ? w.featM[k] : -2; if (l !== last[i]) { last[i] = l; diff = true; } });
    if (!diff) return false;
    let n = 0;
    tiles.forEach((k, i) => {
      const l = last[i];
      if (l < 0) return;
      if (l > 0) for (let b = 0; b < nb; b++) put(n++, k, G.x0 + b * pitch + G.bw / 2, (G.y0 + G.y1) / 2, G.bw, cap * l / GATE_SHUT, G.y1 - G.y0, cBar);
      if (l < GATE_SHUT) for (const p of posts) for (const px of [3.6, 36.4]) put(n++, k, px, p, 3.4, POST_H, 4.4, cPost);
    });
    mesh.count = n;
    live(mesh.instanceMatrix, n);
    if (mesh.instanceColor) live(mesh.instanceColor, n);
    mesh.boundingSphere = null;
    return true;
  }};
}
