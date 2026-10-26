/* REAL 3D ground depth (depth round 2026-10-25, lane B): everything that
   darkens the floor, in the checker and tile materials' own shaders, so no
   mesh, no draw call and no light is added.
     createAO   a two-channel 8 px/tile bake: R = contact AO of the WALL mask
                (border + interior blocks, rebuilt when the wall set changes),
                G = brick AO (a soft ring plus a darker strip under each front
                face, rebuilt when the brick mask changes, fed from
                entities.update via feedContact). Linear-filtered.
     CONTACT    a 32-slot uniform of soft ground shadows (x, z, radius,
                strength) under pickups, bombs, foes and MAKO, written once a
                frame by feedContact; the shader reads it, nothing is drawn.
     shadowLift the key light's shadow term, lifted through the RECEIVING
                material: indirect light is scaled by mix(k, 1, shadow), so a
                shadowed floor reads darker without touching the light recipe.
     floorFX    checker material: variant pick from a 2x2 slab atlas by cell
                hash, a per-world gain and checker contrast (the dark rooms),
                then AO, contact shadows and the shadow lift.
   Light stays the frozen key at upper left: shadows fall right and away. */
import * as THREE from "../../../vendor/three.module.js";
import {CFG, T as TT, BIOMES} from "../../core/config.js";

const W = CFG.COLS * CFG.TILE, D = CFG.ROWS * CFG.TILE, T = CFG.TILE, C = CFG.COLS, R = CFG.ROWS;
const f = (v) => (+v).toFixed(3);
const K = 8, AW = C * K, AH = R * K, q = T / K;

/* per-world floor lift: gain on the whole slab, contrast between the two
   parities (the checker). Slots only; VOID stays dark, CROWN and SAND are the
   two rooms the critique found near-monochrome. */
export const FLOOR_FX = Object.freeze({
  JUNGLE: {g: 1.0, c: 0.05}, ICE: {g: 1.0, c: 0.04}, FACTORY: {g: 1.12, c: 0.07}, WATER: {g: 1.2, c: 0.07},
  ARENA: {g: 1.3, c: 0.08}, SAND: {g: 0.96, c: 0.1}, VOID: {g: 1.0, c: 0.07}, CROWN: {g: 1.6, c: 0.14},
});
export const SHADOW_LIFT = 0.7;

const biomeOf = (a) => (typeof a === "number" ? BIOMES.find((b) => b.hWall === a) || BIOMES[0] : a || BIOMES[0]);

let CUR = null;
export function createAO(arg) {
  const biome = biomeOf(arg), hWall = biome.hWall, s0 = 0.28 + 0.14 * Math.min(1, hWall / 32);
  const data = new Uint8Array(AW * AH * 2).fill(255);
  const tex = new THREE.DataTexture(data, AW, AH, THREE.RGFormat, THREE.UnsignedByteType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
  const bmask = new Uint8Array(C * R), seen = {n: 0};
  const each = (mask, ch, occOf) => {
    for (let j = 0; j < AH; j++) for (let i = 0; i < AW; i++) {
      const ux = (i + 0.5) * q, uz = (j + 0.5) * q, cx0 = Math.floor(ux / T), cy0 = Math.floor(uz / T);
      let acc = 1;
      for (let cy = Math.max(0, cy0 - 2); cy <= Math.min(R - 1, cy0 + 2); cy++) for (let cx = Math.max(0, cx0 - 2); cx <= Math.min(C - 1, cx0 + 2); cx++) {
        if (!mask[cy * C + cx]) continue;
        const dx = Math.max(Math.abs(ux - (cx + 0.5) * T) - T / 2, 0), dz = Math.max(Math.abs(uz - (cy + 0.5) * T) - T / 2, 0);
        acc *= 1 - occOf(dx, dz, ux - (cx + 0.5) * T, uz - (cy + 1) * T, cy);
      }
      data[(j * AW + i) * 2 + ch] = Math.round(255 * acc);
    }
    tex.needsUpdate = true;
  };
  const ao = {tex, biome, bake(wMask) {
    each(wMask, 0, (dx, dz, ox, oz, cy) => s0 * (cy === R - 1 ? 0.6 : 1) * Math.exp(-Math.hypot(dx, dz) / 13));
  }, bakeBricks(grid) {
    let diff = !seen.n; seen.n = 1;
    for (let k = 0; k < C * R; k++) { const b = grid[k] === TT.BRICK ? 1 : 0; if (bmask[k] !== b) { bmask[k] = b; diff = true; } }
    if (!diff) return;
    each(bmask, 1, (dx, dz, ox, oz) => {
      const d = Math.hypot(dx, dz), strip = oz > 0 && oz < 12 && Math.abs(ox) < T / 2 + 3 ? 0.24 * (1 - oz / 12) : 0;
      return Math.min(0.5, 0.16 * Math.exp(-d / 9) + strip);
    });
  }, dispose() { if (CUR === ao) CUR = null; tex.dispose(); }};
  CUR = ao;
  return ao;
}

/* ---- contact shadows ---- */
const CS_N = 32;
export const CONTACT = {v: {value: new Float32Array(CS_N * 4)}, n: {value: 0}};
export function feedContact(world) {
  if (!world) return;
  const a = CONTACT.v.value; let n = 0;
  const put = (x, y, r, s) => { if (n >= CS_N) return; const o = n++ * 4; a[o] = x - W / 2 + 3; a[o + 1] = y - D / 2 - 2; a[o + 2] = r; a[o + 3] = s; };
  for (const p of world.players || []) if (p && p.alive !== false) put(p.x, p.y, 21, 0.42);
  for (const e of world.enemies || []) if (e && !e.dead) put(e.x, e.y, (e.r || 14) * 1.5, e.type === "shade" ? 0.18 : 0.4);
  for (const b of world.bombs || []) if (b && !b.dead) put(b.x, b.y, 20, 0.42);
  for (const it of world.items || []) if (it && !it.taken && !it.buried) put(it.x, it.y, 19, 0.3);
  CONTACT.n.value = n;
  if (CUR && world.grid) CUR.bakeBricks(world.grid);
}

/* ---- hunter lock-on lanes (issue #32): up to LN_N lanes of floor chevrons, written once a frame by entities.update from lockon.js lockOn + the
   motion.js lockK ramp, read by the same floor / tile shaders as CONTACT, so nothing is drawn. Per lane three vec4: [x0, z0, dx, dz] (foe centre, unit
   lane), [len, k, 0, 0] (reach in world units, ramp 0..1), [r, g, b, 0] (the foe's light colour x k). Chevrons every half tile from 0.6 tile out to
   len, a dark under-stroke in the diffuse and the light stroke as emissive, so they read in VOID too; static, never pulsing. */
export const LN_N = 4;
export const LANES = {v: {value: new Float32Array(LN_N * 12)}, n: {value: 0}};
const LANE = (xz) => `
for(int i=0;i<${LN_N};i++){ if(float(i)>=wellLnN)break; vec4 la=wellLn[i*3]; vec4 lb=wellLn[i*3+1]; vec4 lc=wellLn[i*3+2];
 vec2 lr=${xz}-la.xy; float lu=dot(lr,la.zw), lv=abs(dot(lr,vec2(-la.w,la.z)));
 if(lu<${f(0.38 * T)}||lu>lb.x+${f(0.12 * T)}||lv>${f(0.3 * T)})continue;
 float ls=mod(lu-${f(0.35 * T)},${f(0.5 * T)})-${f(0.25 * T)}, ld=abs(ls-${f(0.1 * T)}+1.06*lv)*0.686, lw=step(lv,${f(0.19 * T)});
 float lf=1.0-0.07*floor((lu-${f(0.35 * T)})/${f(0.5 * T)});
 diffuseColor.rgb*=1.0-0.55*lb.y*lw*(1.0-smoothstep(${f(0.07 * T)},${f(0.1 * T)},ld));
 totalEmissiveRadiance+=lc.rgb*lw*lf*(1.0-smoothstep(${f(0.035 * T)},${f(0.055 * T)},ld));
}`;
const LUNI = "\nuniform vec4 wellLn[" + LN_N * 3 + "];\nuniform float wellLnN;";

/* ---- shader pieces ---- */
const SHADOW_RE = /directLight\.color \*= (\( directLight\.visible && receiveShadow \) \? getShadow\( directionalShadowMap\[ i \][^;]*;)/;
export function shadowLift(sh) {
  const chunk = THREE.ShaderChunk.lights_fragment_begin.replace(SHADOW_RE, "wS = $1\n\t\tdirectLight.color *= wS;");
  sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nfloat wS=1.0;")
    .replace("#include <lights_fragment_begin>", chunk)
    .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\nreflectedLight.indirectDiffuse*=mix(" + f(SHADOW_LIFT) + ",1.0,wS);");
}
const GROUND = (uv, xz) => `
{
 vec2 ao2=texture2D(wellAO,${uv}).rg;
 float occ=ao2.r*ao2.g;
 for(int i=0;i<${CS_N};i++){ if(float(i)>=wellCSn)break; vec4 c=wellCS[i]; vec2 d=(${xz}-c.xy)/vec2(c.z*1.12,c.z*0.86);
  occ*=1.0-c.w*(1.0-smoothstep(0.1,1.0,length(d))); }
 diffuseColor.rgb*=occ;
}`;
const UNI = "\nuniform sampler2D wellAO;\nuniform vec4 wellCS[" + CS_N + "];\nuniform float wellCSn;" + LUNI;
const AOUV = `(vWq.xz+vec2(${f(W / 2)},${f(D / 2)}))/vec2(${f(W)},${f(D)})`;

export function floorFX(mat, ao) {
  const fx = FLOOR_FX[ao.biome.name] || {g: 1, c: 0.05};
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.wellAO = {value: ao.tex}; sh.uniforms.wellCS = CONTACT.v; sh.uniforms.wellCSn = CONTACT.n; sh.uniforms.wellLn = LANES.v; sh.uniforms.wellLnN = LANES.n;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWq;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n#ifdef USE_INSTANCING\nvWq=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;\n#else\nvWq=(modelMatrix*vec4(transformed,1.0)).xyz;\n#endif");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWq;" + UNI);
    /* the 2x2 slab atlas: variant by cell hash; no atlas = the plain colour */
    sh.fragmentShader = sh.fragmentShader.replace("#include <map_fragment>", `
#ifdef USE_MAP
 vec2 cc=floor((vWq.xz+vec2(${f(W / 2)},${f(D / 2)}))/${f(T)});
 float hv=fract(sin(dot(cc,vec2(12.9898,78.233)))*43758.5453);
 float vi=floor(hv*4.0);
 vec2 vo=vec2(mod(vi,2.0),floor(vi/2.0));
 diffuseColor*=texture2D(map,(clamp(vMapUv,0.006,0.994)+vo)*0.5);
#endif
 diffuseColor.rgb*=${f(fx.g)}*(1.0+${f(fx.c)}*(1.0-2.0*mod(floor((vWq.x+${f(W / 2)})/${f(T)})+floor((vWq.z+${f(D / 2)})/${f(T)}),2.0)));
` + GROUND(AOUV, "vWq.xz")).replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>" + LANE("vWq.xz"));
    shadowLift(sh);
  };
  mat.customProgramCacheKey = () => "groundfx" + ao.biome.name;
  return mat;
}

/* the same ground terms on the tile mesh: chained after featmesh's own
   onBeforeCompile, reading its vW world-xz varying */
export function featAO(mat, ao) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    sh.uniforms.wellAO = {value: ao.tex}; sh.uniforms.wellCS = CONTACT.v; sh.uniforms.wellCSn = CONTACT.n; sh.uniforms.wellLn = LANES.v; sh.uniforms.wellLnN = LANES.n;
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>" + UNI)
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>" + GROUND(`(vW+vec2(${f(W / 2)},${f(D / 2)}))/vec2(${f(W)},${f(D)})`, "vW") + LANE("vW"));
    shadowLift(sh);
  };
  return mat;
}
