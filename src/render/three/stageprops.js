/* STAGE SET for REAL 3D (mockup C): the diorama outside the cabinet rim. Two draw calls
   per room, built with the scene (a room change rebuilds it with the rest of the group):
   1 ground plane (the stagepaint.js ground painted top-down into one CanvasTexture,
   unlit Basic so the painted hex lands as authored) + 1 fused prop mesh (vertex colours,
   Lambert, DoubleSide, never casts). Nothing sits inside |x|<=345 / |z|<=305, and props
   shrink toward the camera so the near side never hides the board. No Math.random: a
   seeded hash, so a room always builds the same set. Colours are BIOMES slots or mixes. */
import * as THREE from "../../../vendor/three.module.js";
import { CFG } from "../../core/config.js";
import { paintSet, mix } from "../stagepaint.js";

const BW = CFG.COLS * CFG.TILE, BD = CFG.ROWS * CFG.TILE;
export const STAGE_SPAN = 1500, STAGE_TEX = 1280, STAGE_Y = -1.5;
const HX = BW / 2 + 48, HZ = BD / 2 + 48;
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function unit() {
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), cyl = new THREE.CylinderGeometry(1, 1, 1, 10).translate(0, 0.5, 0), cone = new THREE.ConeGeometry(1, 1, 10).translate(0, 0.5, 0),
    tap = new THREE.CylinderGeometry(0.6, 1, 1, 10).translate(0, 0.5, 0), sph = new THREE.IcosahedronGeometry(1, 1), oct = new THREE.OctahedronGeometry(1, 0), quad = new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0);
  return { box, cyl, cone, tap, sph, oct, quad };
}
function fuser(U) {
  const pos = [], nor = [], col = [], M = new THREE.Matrix4(), NM = new THREE.Matrix3(), V = new THREE.Vector3(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), C = new THREE.Color(), cache = new Map();
  const ni = (g) => { let n = cache.get(g); if (!n) { n = g.index ? g.toNonIndexed() : g; cache.set(g, n); } return n; };
  const add = (g, hex, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => {
    const G = ni(g), P = G.attributes.position, Nn = G.attributes.normal;
    E.set(rx, ry, rz); Q.setFromEuler(E); M.compose(V.set(x, y, z), Q, S.set(sx, sy, sz)); NM.getNormalMatrix(M); C.set(hex);
    for (let i = 0; i < P.count; i++) {
      V.fromBufferAttribute(P, i).applyMatrix4(M); pos.push(V.x, V.y, V.z);
      V.fromBufferAttribute(Nn, i).applyMatrix3(NM).normalize(); nor.push(V.x, V.y, V.z); col.push(C.r, C.g, C.b);
    }
  };
  return {
    box: (h, x, y, z, w, hh, d, ry) => add(U.box, h, x, y, z, w, hh, d, ry), cyl: (h, x, y, z, r, hh) => add(U.cyl, h, x, y, z, r, hh, r), tap: (h, x, y, z, r, hh) => add(U.tap, h, x, y, z, r, hh, r),
    cone: (h, x, y, z, r, hh) => add(U.cone, h, x, y, z, r, hh, r), sph: (h, x, y, z, rx, ry, rz) => add(U.sph, h, x, y, z, rx, ry, rz), oct: (h, x, y, z, rx, ry, rz, a) => add(U.oct, h, x, y, z, rx, ry, rz, a),
    flag: (h, x, y, z, w, hh, ry) => add(U.quad, h, x, y, z, w, hh, 1, ry), pipe: (h, x, y, z, r, len, ry) => add(U.cyl, h, x, y, z, r, len, r, ry, 0, Math.PI / 2),
    geo() { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); return g; },
  };
}
/* point on the ring d units outside the rim, perimeter fraction t; h = height weight (far 1, side .55, near .14) */
function ringPt(t, d) {
  const P = 4 * (HX + HZ); let s = (((t % 1) + 1) % 1) * P;
  if (s < 2 * HX) return [-HX + s, -HZ - d, 0.8];
  s -= 2 * HX; if (s < 2 * HZ) return [HX + d, -HZ + s, 0.55];
  s -= 2 * HZ; if (s < 2 * HX) return [HX - s, HZ + d, 0.14];
  s -= 2 * HX; return [-HX - d, HZ - s, 0.55];
}
function each(rn, n, d0, d1, fn) { for (let i = 0; i < n; i++) { const u = (i + rn() * 0.8) / n, t = u < 0.42 ? (u / 0.42) * 0.265 : 0.265 + ((u - 0.42) / 0.58) * 0.735; const [x, z, h] = ringPt(t, d0 + Math.pow(rn(), 1.9) * (d1 - d0)); fn(x, z, h, rn, i); } }
const J = (c, rn, a = 0.14) => mix(c, rn() < 0.5 ? "#000000" : "#ffffff", rn() * a);

const SETS = [
  (F, B, rn) => each(rn, 26, 30, 520, (x, z, h, r, i) => {
    if (h < 0.3 || r() < 0.3) { F.sph(J(mix(B.floor1, B.brickB, 0.35), r), x, 4, z, 18 + r() * 22, 8, 12 + r() * 14); F.sph(J(mix(B.wall, B.bg1, 0.6), r), x + 20, 3, z + 8, 12, 6, 9); return; }
    const s = 0.8 + r() * 0.7; F.tap(mix(B.wall, B.bg1, 0.72), x, 0, z, 14 * s, 150 * s * h);
    for (let j = 0; j < 3; j++) F.sph(J(mix(j % 2 ? B.floor0 : B.floor1, B.brickB, 0.28), r), x + (r() - 0.5) * 50 * s, (120 + j * 16) * s * h, z + (r() - 0.5) * 50 * s, (70 + r() * 30) * s, (40 + r() * 14) * s * h, (70 + r() * 30) * s);
    F.pipe(mix(B.wall, B.bg1, 0.62), x + 30 * s, 6, z + 6, 7 * s, 70 * s, r() * 3);
  }),
  (F, B, rn) => each(rn, 30, 30, 520, (x, z, h, r) => {
    if (r() < 0.38) { F.sph(mix(B.brickA, B.brickB, r() * 0.4), x, 0, z, 40 + r() * 60, (12 + r() * 14) * (0.4 + h), 30 + r() * 40); return; }
    if (r() < 0.55) { const s = 0.7 + r() * 0.8; for (let j = 0; j < 3; j++) F.cone(mix(B.wall, B.sky, 0.2 + j * 0.05), x, 22 * s * h + j * 36 * s * h, z, (46 - j * 12) * s, 62 * s * h); F.cyl(mix(B.wall, B.bg1, 0.4), x, 0, z, 6, 26 * s * h); F.cone(B.brickA, x, 108 * s * h, z, 12 * s, 20 * s * h); return; }
    for (let j = 0; j < 4; j++) F.oct(j % 2 ? mix(B.brickHi, B.sky, 0.4) : mix(B.floor1, B.wall, 0.4), x + (j - 1.5) * 22, (24 + r() * 50) * h, z + (r() - 0.5) * 30, 10 + r() * 7, (34 + r() * 60) * h, 10 + r() * 7, r() * 3);
  }),
  (F, B, rn) => each(rn, 24, 30, 520, (x, z, h, r) => {
    const t = r();
    if (t < 0.3) { const s = 0.8 + r() * 0.5; F.cyl(mix(B.wall, B.floor0, 0.4), x, 0, z, 24 * s, 230 * s * h); F.cyl(B.brickA, x, 168 * s * h, z, 24.6 * s, 18 * s * h); F.cyl(B.bg1, x, 186 * s * h, z, 24.7 * s, 18 * s * h); F.cyl(mix(B.wall, B.floor0, 0.4), x, 208 * s * h, z, 26 * s, 8 * s * h); }
    else if (t < 0.55) { const L = 90 + r() * 120; F.pipe(mix(B.wall, B.floor0, 0.5), x, 26 * (0.3 + h), z, 9, L, r() < 0.5 ? 0 : 1.57); F.pipe(B.brickB, x, 26 * (0.3 + h), z, 10, 14, 0); }
    else if (t < 0.8) { const w = 28 + r() * 24, hh = (26 + r() * 26) * (0.3 + h); F.box(J(r() < 0.5 ? B.brickB : B.wall, r), x, 0, z, w, hh, w, r() * 3); F.box(B.bg1, x, hh - 1, z, w + 1.5, 3, w + 1.5, 0); }
    else { F.cyl(mix(B.wall, B.floor0, 0.3), x, 0, z, 36, 52 * (0.3 + h)); F.cyl(mix(B.bg1, B.floor1, 0.5), x, 52 * (0.3 + h), z, 30, 4); }
  }),
  (F, B, rn) => each(rn, 26, 40, 520, (x, z, h, r) => {
    const t = r();
    if (t < 0.45) { const hh = (50 + r() * 60) * (0.3 + h); F.cyl(mix(B.wall, B.bg1, 0.5), x, 0, z, 8, hh); F.cyl(mix(B.brickB, B.bg1, 0.3), x, hh * 0.42, z, 8.8, 7); F.box(mix(B.wall, B.bg1, 0.3), x, hh, z, 20, 5, 20, 0); }
    else if (t < 0.7) { F.sph(B.brickA, x, 10, z, 12, 12, 12); F.cyl(B.brickHi, x, 8, z, 12.5, 4); }
    else { const s = 20 + r() * 40; F.sph(J(mix(B.wall, B.bg1, 0.4), r), x, 0, z, s, s * 0.5 * (0.4 + h), s * 0.8); F.sph(mix(B.brickB, B.bg1, 0.3), x + s * 0.5, 0, z + 6, s * 0.3, s * 0.18, s * 0.3); }
  }),
  (F, B, rn) => each(rn, 24, 40, 520, (x, z, h, r, i) => {
    const t = r();
    if (t < 0.5) { const hh = (92 + r() * 40) * (0.25 + h); F.cyl(mix(B.wall, B.bg1, 0.4), x, 0, z, 3.4, hh); F.box(B.wallHi, x, hh, z, 30, 5, 5, 0); F.flag(i % 2 ? B.brickA : B.brickB, x, hh - 5, z + 0.5, 24, hh * 0.55, 0); F.flag(i % 2 ? B.brickB : B.brickA, x, hh - 5, z - 0.5, 24, hh * 0.55, 0); }
    else if (t < 0.75) { const w = 30 + r() * 20; F.box(J(B.wall, r), x, 0, z, w, 70 * (0.3 + h), w * 0.8, r() * 0.6); F.box(B.wallHi, x, 70 * (0.3 + h), z, w + 4, 6, w * 0.8 + 4, 0); }
    else F.sph(J(mix(B.wall, B.floor0, 0.5), r), x, 0, z, 50 + r() * 60, 10 + r() * 14, 40 + r() * 40);
  }),
  (F, B, rn) => each(rn, 24, 30, 520, (x, z, h, r) => {
    const t = r();
    if (t < 0.5) { const s = 60 + r() * 120; F.sph(J(r() < 0.5 ? B.floor0 : B.floor1, r), x, 0, z, s, (28 + r() * 36) * (0.35 + h), s * 0.7); }
    else if (t < 0.75) { const s = 0.7 + r(); F.sph(J(mix(B.wall, B.floor1, 0.4), r), x, 0, z, 26 * s, 20 * s * (0.4 + h), 22 * s); F.sph(mix(B.wallHi, B.floor0, 0.4), x - 7 * s, 10 * s, z - 6 * s, 12 * s, 6 * s, 10 * s); }
    else { const hh = (60 + r() * 70) * (0.3 + h); F.cyl(mix(B.wallHi, B.floor0, 0.4), x, 0, z, 13, hh); F.cyl(mix(B.wallHi, B.floor0, 0.3), x, hh, z, 15, 6); F.box(J(mix(B.wallHi, B.floor0, 0.4), r), x + 28, 0, z + 6, 24, 12, 20, r()); }
  }),
  (F, B, rn) => each(rn, 28, 30, 600, (x, z, h, r) => {
    const s = 0.6 + r() * 1.1, c = mix(B.wall, B.wallHi, 0.15 + r() * 0.22), hy = (70 + r() * 210) * (0.2 + h);
    if (r() < 0.65) F.oct(c, x, hy, z, 16 * s, 46 * s * (0.4 + h), 16 * s, r() * 3);
    else { F.tap(mix(B.wall, B.bg1, 0.3), x, hy - 20, z, 40 * s, 20 * s); F.cone(mix(B.wall, B.bg1, 0.2), x, hy - 70 * s, z, 40 * s, 52 * s); F.oct(mix(B.brickB, B.wallHi, 0.25), x, hy + 18, z, 8 * s, 18 * s, 8 * s, 0); }
  }),
  (F, B, rn) => each(rn, 20, 40, 480, (x, z, h, r, i) => {
    const t = r(), g = mix(B.wallHi, B.brickB, 0.45);
    if (t < 0.62 && h > 0.3) { const hh = 150 * (0.2 + h); F.box(mix(B.brickB, B.bg1, 0.3), x, 0, z, 46, 10, 46, 0); F.cyl(J(g, r, 0.06), x, 10, z, 17, hh); F.box(g, x, hh + 10, z, 46, 12, 46, 0); F.box(mix(B.brickB, B.bg1, 0.2), x, hh + 22, z, 40, 6, 40, 0); }
    else if (t < 0.82) { F.cyl(mix(B.brickB, B.bg1, 0.3), x, 0, z, 12, 38 * (0.3 + h)); F.cyl(g, x, 38 * (0.3 + h), z, 18, 8); F.sph(B.brickA, x, 52 * (0.3 + h), z, 12, 12, 12); }
    else { const hh = 120 * (0.25 + h); F.cyl(mix(B.wall, B.bg1, 0.4), x, 0, z, 3, hh); F.flag(i % 2 ? B.brickB : B.floor0, x, hh, z, 26, hh * 0.7, 0); F.flag(i % 2 ? B.brickB : B.floor0, x, hh, z + 0.6, 26, hh * 0.7, 3.14); }
  }),
];

export function buildStage(biome, idx) {
  const group = new THREE.Group(); group.userData.tag = "stage";
  const rn = rng(0x57a6e + idx * 104729), k = STAGE_TEX / STAGE_SPAN;
  let map = null;
  if (typeof document !== "undefined" && document.createElement) {
    try {
      const cv = document.createElement("canvas"); cv.width = cv.height = STAGE_TEX;
      const g = cv.getContext("2d"), w = BW * k, h = BD * k;
      paintSet(g, STAGE_TEX, STAGE_TEX, biome, { x: (STAGE_TEX - w) / 2, y: (STAGE_TEX - h) / 2, w, h }, k, { idx: idx % 8, flat: true, fade: true });
      map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
      map.minFilter = THREE.LinearMipmapLinearFilter; map.magFilter = THREE.LinearFilter;
    } catch (e) { map = null; }
  }
  const gGeo = new THREE.PlaneGeometry(STAGE_SPAN, STAGE_SPAN); gGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(gGeo, new THREE.MeshBasicMaterial(map ? { map } : { color: mix(biome.bg1, biome.floor0, 0.3) }));
  ground.position.y = STAGE_Y; ground.userData.tag = "stage-ground"; ground.renderOrder = -1;
  group.add(ground);
  const U = unit(), F = fuser(U);
  SETS[idx % 8](F, biome, rn);
  const geo = F.geo();
  for (const k2 in U) U[k2].dispose();
  const props = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  props.castShadow = false; props.receiveShadow = false; props.userData.tag = "stage-props";
  group.add(props);
  return group;
}
