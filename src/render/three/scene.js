/* buildScene (real3d spec §2) — pure world->THREE mapping, Node-testable:
   only THREE objects + world reads; no DOM/canvas/time. World->scene coords
   X=x-300, Y=up, Z=y-260 (board centered on origin). Static-once: floor plane,
   permanent WALL InstancedMesh, lights, biome materials. Bricks: fixed-capacity
   InstancedMesh rescanned in place by update() — never add/remove meshes.
   Rebuild rule: update() returns true when world.level changed => caller
   discards group and calls buildScene again. */
import * as THREE from "../../../vendor/three.module.js";
import {CFG,T,biomeOf} from "../../core/config.js";
import {build as buildMaterials} from "./materials.js";
import {createLights} from "./lights.js";
import {createPools} from "./entities.js";

const W=CFG.COLS*CFG.TILE, D=CFG.ROWS*CFG.TILE;
const MAT=new THREE.Matrix4();

function disposeGroup(group){
  const mats=new Set();
  group.traverse(o=>{
    if(o.geometry&&!o.geometry._shared)o.geometry.dispose();
    const m=o.material;
    if(m)(Array.isArray(m)?m:[m]).forEach(x=>{ if(!x._shared)mats.add(x); });
   });
  mats.forEach(m=>{ if(m.map&&!m.map._shared)m.map.dispose(); m.dispose(); });
}

export function buildScene(world, atlas){
  const biome=biomeOf(world.level);
  const mats=buildMaterials(biome,atlas);
  const group=new THREE.Group();

  const floor=new THREE.Mesh(new THREE.PlaneGeometry(W,D),mats.floor);
  floor.rotation.x=-Math.PI/2;
  floor.receiveShadow=true;
  floor.userData.tag="floor";
  group.add(floor);

  // static walls: one matrix per T.WALL tile, built once per level
  let nWalls=0;
  for(let i=0;i<world.grid.length;i++)if(world.grid[i]===T.WALL)nWalls++;
  const wallGeo=new THREE.BoxGeometry(CFG.TILE,biome.hWall,CFG.TILE);
  const wall=new THREE.InstancedMesh(wallGeo,mats.wall,nWalls);
  let wi=0;
  for(let y=0;y<CFG.ROWS;y++)for(let x=0;x<CFG.COLS;x++)
    if(world.grid[y*CFG.COLS+x]===T.WALL){
      MAT.makeTranslation((x+0.5)*CFG.TILE-W/2,biome.hWall/2,
        (y+0.5)*CFG.TILE-D/2);
      wall.setMatrixAt(wi++,MAT);
     }
  wall.count=nWalls;
  wall.castShadow=true; wall.receiveShadow=true;
  wall.userData.tag="wall";
  group.add(wall);

  // bricks: capacity COLS*ROWS forever; every update rescans the grid
  const brickGeo=new THREE.BoxGeometry(CFG.TILE,biome.hBrick,CFG.TILE);
  const brick=new THREE.InstancedMesh(brickGeo,mats.brick,
    CFG.COLS*CFG.ROWS);
  brick.castShadow=true; brick.receiveShadow=true;
  brick.userData.tag="brick";
  group.add(brick);

  const lights=createLights(biome);
  group.add(lights.hemi,lights.dir,lights.amb);
  lights.dir.target.position.set(0,0,0);
  group.add(lights.dir.target);

  // entity pools (S2): fixed slots, visibility-toggled, synced every update
  const pools=createPools(biome,atlas);
  group.add(pools.group);

  const scene={group,level:world.level,brick,pools,
    update(world){
      let n=0;
      for(let y=0;y<CFG.ROWS;y++)for(let x=0;x<CFG.COLS;x++)
        if(world.grid[y*CFG.COLS+x]===T.BRICK){
          MAT.makeTranslation((x+0.5)*CFG.TILE-W/2,biome.hBrick/2,
            (y+0.5)*CFG.TILE-D/2);
          brick.setMatrixAt(n++,MAT);
         }
      brick.count=n;
      brick.instanceMatrix.needsUpdate=true;
      pools.update(world);
      return world.level!==scene.level;
     }};
  scene.update(world);          // initial brick fill
  return scene;
}

export {disposeGroup};

/* GL draw-call estimate for the §8 perf gate: every mesh/points/line/sprite
   is one call (InstancedMesh included via isMesh); groups/lights are free. */
export function countDrawCalls(root){
  let n=0;
  root.traverse(o=>{ if(o.isMesh||o.isPoints||o.isLine||o.isSprite)n++; });
  return n;
}
