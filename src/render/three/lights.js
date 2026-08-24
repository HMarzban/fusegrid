/* Frozen lighting rig (real3d spec §6). One directional shadow light +
   hemisphere fill + low ambient; values are spec-pinned, never tuned at
   runtime. Pure THREE objects — Node-safe, no DOM. */
import * as THREE from "../../../vendor/three.module.js";

export function createLights(biome){
  const hemi=new THREE.HemisphereLight("#cfe8ff",biome.bg1,0.85);
  const dir=new THREE.DirectionalLight("#ffffff",1.6);
  dir.position.set(300,420,220);
  dir.castShadow=true;
  dir.shadow.mapSize.set(1024,1024);
  const c=dir.shadow.camera;
  c.left=-340; c.right=340; c.top=280; c.bottom=-280;
  c.near=10; c.far=1200;
  c.updateProjectionMatrix();
  dir.shadow.bias=-0.0005;
  const amb=new THREE.AmbientLight("#ffffff",0.25);
  return {hemi,dir,amb};
}
