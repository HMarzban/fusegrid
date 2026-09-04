/* Frozen lighting rig (real3d spec §6, retuned 2026-09-04 cam-light-frame).
   Three-point collapsed to two directionals: a warm key that owns the only
   shadow map, a cool fill parked opposite-and-behind so it doubles as the
   back light that lifts pieces off the background, plus hemisphere + a low
   ambient floor. The old single 1.6 key against 0.25 ambient read binary —
   lit faces blew out, shadowed faces crushed. PCFSoftShadowMap ignores
   shadow.radius, so softness has to come from the key:fill ratio (now
   2.3:1), not from blur. Values are spec-pinned, never tuned at runtime and
   never per-biome — only the hemisphere tints follow sky/bg1.
   Lifted 2026-09-04 framing+brightness: the whole recipe scales x1.2 with the
   key:fill ratio held at exactly 2.3333, because dropping ACES tone mapping
   removed the mid-tone boost it had been supplying. Up-facing irradiance goes
   1.6748 -> 2.1537 lit and 0.9157 -> 1.2429 shadowed; peak reflected for a 1.0
   albedo is 0.6855 linear, so nothing clips off the rig alone. Darkness is an
   albedo property, so VOID stays the darkest room under one global recipe.
   Pure THREE objects — Node-safe, no DOM. */
import * as THREE from "../../../vendor/three.module.js";

export function createLights(biome){
  const hemi=new THREE.HemisphereLight(biome.sky||"#cfe8ff",biome.bg1,0.72);
  const dir=new THREE.DirectionalLight("#fff4e2",1.26);
  dir.position.set(-240,560,320);
  dir.castShadow=true;
  dir.shadow.mapSize.set(1024,1024);
  const c=dir.shadow.camera;
  c.left=-420; c.right=420; c.top=380; c.bottom=-380;
  c.near=10; c.far=1400;
  c.updateProjectionMatrix();
  dir.shadow.bias=-0.0004;
  dir.shadow.normalBias=0.02;
  const fill=new THREE.DirectionalLight("#bcd4ff",0.54);
  fill.position.set(300,260,-220);
  fill.castShadow=false;
  const amb=new THREE.AmbientLight("#ffffff",0.30);
  return {hemi,dir,fill,amb};
}
