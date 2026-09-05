/* Frozen lighting rig (real3d spec §6, retuned 2026-09-04 cam-light-frame).
   Three-point collapsed to two directionals: a warm key that owns the only
   shadow map, a cool fill parked opposite-and-behind so it doubles as the
   back light that lifts pieces off the background, plus hemisphere + a low
   ambient floor. The old single 1.6 key against 0.25 ambient read binary —
   lit faces blew out, shadowed faces crushed. PCFSoftShadowMap ignores
   shadow.radius, so softness has to come from the key:fill ratio (now
   2.3:1), not from blur. Values are spec-pinned and never per-biome — only
   the hemisphere tints follow sky/bg1. The one runtime knob is a uniform
   BRIGHTNESS multiplier (nb.settings.v1 bri/100, LIGHT_BASE below); k=1 is a
   no-op and key:fill holds at every k.
   Lifted 2026-09-04 framing+brightness: the whole recipe scales x1.2 with the
   key:fill ratio held at exactly 2.3333, because dropping ACES tone mapping
   removed the mid-tone boost it had been supplying. Up-facing irradiance goes
   1.6748 -> 2.1537 lit and 0.9157 -> 1.2429 shadowed; peak reflected for a 1.0
   albedo is 0.6855 linear, so nothing clips off the rig alone. Darkness is an
   albedo property, so VOID stays the darkest room under one global recipe.
   Pure THREE objects — Node-safe, no DOM. */
import * as THREE from "../../../vendor/three.module.js";

/* The frozen recipe as data, so the live BRIGHTNESS path and the rebuild path
   read ONE table. A uniform multiplier cannot move key:fill (2.3333), which
   is the whole softness budget under PCFSoftShadowMap. */
export const LIGHT_BASE=Object.freeze({hemi:0.72,key:1.26,fill:0.54,amb:0.30});
const briK=(k)=>(typeof k==="number"&&isFinite(k)&&k>0?k:1);

export function createLights(biome,k){
  const m=briK(k);
  const hemi=new THREE.HemisphereLight(biome.sky||"#cfe8ff",biome.bg1,LIGHT_BASE.hemi*m);
  const dir=new THREE.DirectionalLight("#fff4e2",LIGHT_BASE.key*m);
  dir.position.set(-240,560,320);
  dir.castShadow=true;
  dir.shadow.mapSize.set(1024,1024);
  const c=dir.shadow.camera;
  c.left=-420; c.right=420; c.top=380; c.bottom=-380;
  c.near=10; c.far=1400;
  c.updateProjectionMatrix();
  dir.shadow.bias=-0.0004;
  dir.shadow.normalBias=0.02;
  const fill=new THREE.DirectionalLight("#bcd4ff",LIGHT_BASE.fill*m);
  fill.position.set(300,260,-220);
  fill.castShadow=false;
  const amb=new THREE.AmbientLight("#ffffff",LIGHT_BASE.amb*m);
  return {hemi,dir,fill,amb};
}

/* Live rescale for the OPTIONS BRIGHTNESS row: always from LIGHT_BASE, never
   from the current intensity, so repeated applies never compound. */
export function applyBright(L,k){
  const m=briK(k);
  if(!L)return L;
  L.hemi.intensity=LIGHT_BASE.hemi*m;
  L.dir.intensity=LIGHT_BASE.key*m;
  L.fill.intensity=LIGHT_BASE.fill*m;
  L.amb.intensity=LIGHT_BASE.amb*m;
  return L;
}
