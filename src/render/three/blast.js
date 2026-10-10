/* Blasts v3 (2026-10-10, "the REAL 3D blast must look 3D"): two instanced
   draws, whatever the blast count. Draw 1 is the danger plate — one additive
   rounded tile per deadly tile, flat on the floor: the tile-accurate truth the
   2D square tells, solid until the blast is nearly gone. Draw 2 is the fire —
   lumpy fireballs (two per arm tile, a bigger burst plus a rising crown on the
   bomb tile, a tapered pair on each arm end) through ONE ShaderMaterial.
   View-space fresnel puts a white-hot core in front of an orange shell that
   falls to deep red at the silhouette, so a ball reads round from any rig with
   no light at all (VOID stays dark, the blast does not). Per-instance aLife
   [age, seed] cools the heat (slowly through the first third, white-hot like
   the 2D cream square, then fast) and burns the balls away with noise past 55%, so
   blasts of different ages never share one opacity. Height is held so a far
   end cap at rig C stays within a third of a tile of its own footprint
   (tests/three.test.mjs). Lifecycle math is pure and exported. */
import * as THREE from "../../../vendor/three.module.js";
import { CFG } from "../../core/config.js";

const T = CFG.TILE,
  W2 = (CFG.COLS * T) / 2,
  D2 = (CFG.ROWS * T) / 2;
export const PLATE_Y = 1;
export const BURN_AT = 0.55;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutBack = (k) => 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);

/* blastLife(age): s = fire scale (pops 0.45 -> 1.08 by 10% with a back
   overshoot, settles to 1 by 25%, holds, shrinks to 0.4 from BURN_AT),
   rise = upward drift in tiles, plate = danger-plate brightness (solid to
   50%, never under 0.25 while the blast lives), burn = the shader's discard
   threshold (0 until BURN_AT, 1 at the end). */
export function blastLife(a) {
  a = clamp01(a);
  let s;
  if (a < 0.1) s = 0.45 + 0.63 * easeOutBack(a / 0.1);
  else if (a < 0.25) s = 1.08 - 0.08 * ((a - 0.1) / 0.15);
  else if (a < BURN_AT) s = 1;
  else s = 1 - 0.6 * Math.pow((a - BURN_AT) / (1 - BURN_AT), 1.4);
  const plate = a < 0.5 ? 1 : 1 - 0.75 * Math.pow((a - 0.5) / 0.5, 1.5);
  const burn = a < BURN_AT ? 0 : Math.pow((a - BURN_AT) / (1 - BURN_AT), 1.2);
  return { s, rise: 0.3 * a * a, plate, burn };
}

const P_W = new THREE.Color("#fff3b0"),
  P_A = new THREE.Color("#ffb347"),
  P_R = new THREE.Color("#ff5d73");
/* plate ramp = the 2D fill ramp (cream -> amber -> rose), x brightness */
export function plateColor(a, out) {
  a = clamp01(a);
  if (a < 0.35) out.copy(P_W).lerp(P_A, a / 0.35);
  else out.copy(P_A).lerp(P_R, clamp01((a - 0.35) / 0.45));
  return out.multiplyScalar(blastLife(a).plate);
}

/* fireballs per tile, in tiles: [u along the arm (away from the bomb),
   w lateral, y centre, radius xz, radius y]. Ends taper inside the tile. */
export const PUFF = Object.freeze({
  centre: [[0, 0, 0.36, 0.5, 0.46], [0, 0, 0.7, 0.3, 0.3]],
  arm: [[-0.2, 0.05, 0.3, 0.31, 0.33], [0.21, -0.06, 0.33, 0.28, 0.3]],
  end: [[-0.2, 0.04, 0.26, 0.29, 0.29], [0.1, -0.04, 0.19, 0.25, 0.22]],
});
export const PUFFS_PER_TILE = 2;
export const CROWN_RISE = 1.8; // the bomb tile's crown climbs faster than the arms
/* where one fireball sits at life L, in tiles: [u, w, y, rxz, ry] */
export function puffAt(q, L, crown) {
  return [q[0], q[1], q[2] * L.s + L.rise * (crown ? CROWN_RISE : 1), q[3] * L.s, q[4] * L.s];
}

const FIRE_V = `attribute vec2 aLife;
varying vec2 vLife; varying float vF; varying vec3 vP; varying float vUp;
void main(){
  vLife=aLife; vP=position;
  vec4 p=vec4(position,1.0); vec3 n=normal;
#ifdef USE_INSTANCING
  p=instanceMatrix*p; n=mat3(instanceMatrix)*n;
#endif
  vec4 mv=modelViewMatrix*p;
  vF=max(0.0,dot(normalize(normalMatrix*n),normalize(-mv.xyz)));
  vUp=normalize(n).y;
  gl_Position=projectionMatrix*mv;
}`;
const FIRE_F = `uniform vec3 uHot; uniform vec3 uMid; uniform vec3 uRim; uniform vec3 uDeep; uniform vec3 uSmoke;
uniform float uBurn;
varying vec2 vLife; varying float vF; varying vec3 vP; varying float vUp;
float h3(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
float vn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
void main(){
  float a=vLife.x;
  float n=vn(vP*3.2+vLife.y*17.0)*0.65+vn(vP*7.1+vLife.y*5.0)*0.35;
  float burn=a<uBurn?0.0:pow((a-uBurn)/(1.0-uBurn),1.2);
  if(n<burn*1.08-0.02)discard;
  float cool=a<0.3?0.35*a:0.105+1.25*(a-0.3);
  float heat=clamp(pow(vF,1.6)*1.05+0.18*vUp+0.05-cool+0.5*(n-0.5),0.0,1.0);
  vec3 c=heat<0.35?mix(uDeep,uRim,heat/0.35):heat<0.75?mix(uRim,uMid,(heat-0.35)/0.4):mix(uMid,uHot,(heat-0.75)/0.25);
  c=mix(c,uSmoke,smoothstep(0.55,1.0,a)*(1.0-vF)*0.55);
  gl_FragColor=vec4(c,1.0);
#include <colorspace_fragment>
}`;

/* unit fireball: icosahedron detail 2, radius wobbled by a direction hash so
   the duplicated seam vertices of the non-indexed mesh move together. */
function fireball() {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const w = Math.sin(v.x * 5.1 + 1.7) * Math.sin(v.y * 4.3 + 3.4) * Math.sin(v.z * 4.7 - 1.7);
    v.multiplyScalar(1 + 0.16 * w);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
/* danger plate: a 0.94-tile square with a bright rim band baked in vertex
   colour, so the deadly tile's edge reads even where the fire covers it. */
function plateGeo() {
  const g = new THREE.PlaneGeometry(0.94, 0.94, 6, 6);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const m = Math.max(Math.abs(p.getX(i)), Math.abs(p.getZ(i))) / 0.47;
    const k = 0.62 + 0.38 * (1 - m * m) + (m > 0.97 ? 0.25 : 0);
    col.push(k, k, k);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return g;
}
let GEO = null;
function geos() {
  if (!GEO) {
    GEO = { plate: plateGeo(), ball: fireball() };
    GEO.plate._shared = GEO.ball._shared = true;
  }
  return GEO;
}
export const FIRE_COLORS = Object.freeze({ hot: "#fff4c8", mid: "#ffc23a", rim: "#ff5a14", deep: "#c42a0e", smoke: "#4a1610" });

export function createBlast(cap) {
  const G = geos();
  const plates = new THREE.InstancedMesh(G.plate, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), cap);
  plates.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  plates.frustumCulled = false;
  plates.castShadow = plates.receiveShadow = false;
  plates.count = 0;
  plates.setColorAt(0, P_W); // instanceColor from the build: the first boom compiles no new program
  plates.userData.tag = "blade";
  const u = {};
  for (const k of ["hot", "mid", "rim", "deep", "smoke"])
    u["u" + k[0].toUpperCase() + k.slice(1)] = { value: new THREE.Color(FIRE_COLORS[k]) };
  u.uBurn = { value: BURN_AT };
  const fcap = cap * PUFFS_PER_TILE;
  /* the ball geometry is shared across rebuilds, so the per-pool aLife lives
     on a thin wrapper that reuses every shared buffer. */
  const geo = new THREE.BufferGeometry();
  for (const k in G.ball.attributes) geo.setAttribute(k, G.ball.attributes[k]);
  const life = new THREE.InstancedBufferAttribute(new Float32Array(fcap * 2), 2);
  life.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("aLife", life);
  const fire = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
    uniforms: u, vertexShader: FIRE_V, fragmentShader: FIRE_F }), fcap);
  fire.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fire.frustumCulled = false;
  fire.castShadow = fire.receiveShadow = false;
  fire.count = 0;
  fire.userData.tag = "blade";
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(),
    _s = new THREE.Vector3(), _c = new THREE.Color();

  function update(bls) {
    let n = 0, fn = 0;
    for (let i = 0; i < bls.length; i++) {
      const bl = bls[i], tls = bl.tiles;
      if (!tls) continue;
      const age = clamp01(bl.t / (bl.ttl || 1)), L = blastLife(age);
      plateColor(age, _c);
      const cx = Math.floor(bl.x / T), cy = Math.floor(bl.y / T);
      for (let j = 0; j < tls.length && n < cap; j++) {
        const tl = tls[j], X = tl.tx * T + T / 2 - W2, Z = tl.ty * T + T / 2 - D2;
        _m.compose(_p.set(X, PLATE_Y, Z), _q, _s.set(T, 1, T));
        plates.setMatrixAt(n, _m);
        plates.setColorAt(n++, _c);
        /* arm axis and end-cap test straight off the tile list: computeBlast
           pushes each arm outward in order, so an end is the last of its run */
        const dx = Math.sign(tl.tx - cx), dz = Math.sign(tl.ty - cy),
          d = Math.abs(tl.tx - cx) + Math.abs(tl.ty - cy), nx = tls[j + 1];
        const end = d > 0 && (!nx || Math.sign(nx.tx - cx) !== dx || Math.sign(nx.ty - cy) !== dz
          || Math.abs(nx.tx - cx) + Math.abs(nx.ty - cy) !== d + 1);
        const set = d === 0 ? PUFF.centre : end ? PUFF.end : PUFF.arm,
          flip = (tl.tx + tl.ty) & 1 ? 1 : -1, seed = ((tl.tx * 7 + tl.ty * 13 + i * 5) % 17) / 17;
        for (let k = 0; k < set.length && fn < fcap; k++) {
          const b = puffAt(set[k], L, d === 0 && k === 1), w = b[1] * flip;
          _p.set(X + (dx * b[0] - dz * w) * T, b[2] * T, Z + (dz * b[0] + dx * w) * T);
          _m.compose(_p, _q, _s.set(b[3] * T, b[4] * T, b[3] * T));
          fire.setMatrixAt(fn, _m);
          life.setXY(fn++, age, seed + k * 0.37);
        }
      }
    }
    plates.count = n;
    plates.instanceMatrix.needsUpdate = true;
    if (plates.instanceColor) plates.instanceColor.needsUpdate = true;
    fire.count = fn;
    fire.instanceMatrix.needsUpdate = true;
    life.needsUpdate = true;
    return n;
  }
  return { plates, fire, update };
}
