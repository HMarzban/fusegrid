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
  wall.material.color.set("#ffffff");
  const wA=new THREE.Color(biome.wall),
    wH=new THREE.Color(biome.wall).lerp(new THREE.Color(biome.wallHi),0.32);
  let wi=0;
  for(let y=0;y<CFG.ROWS;y++)for(let x=0;x<CFG.COLS;x++)
    if(world.grid[y*CFG.COLS+x]===T.WALL){
      MAT.makeTranslation((x+0.5)*CFG.TILE-W/2,biome.hWall/2,
        (y+0.5)*CFG.TILE-D/2);
      wall.setMatrixAt(wi,MAT);
      wall.setColorAt(wi++,(x+y)&1?wH:wA);
     }
  wall.count=nWalls;
  wall.instanceMatrix.needsUpdate=true;
  if(wall.instanceColor)wall.instanceColor.needsUpdate=true;
  wall.castShadow=true; wall.receiveShadow=true;
  wall.userData.tag="wall";
  group.add(wall);

  // bricks: capacity COLS*ROWS forever; every update rescans the grid
  const brickGeo=new THREE.BoxGeometry(CFG.TILE,biome.hBrick,CFG.TILE);
  const brick=new THREE.InstancedMesh(brickGeo,mats.brick,
    CFG.COLS*CFG.ROWS);
  brick.material.color.set("#ffffff");
  brick.castShadow=true; brick.receiveShadow=true;
  brick.userData.tag="brick";
  group.add(brick);
  const bA=new THREE.Color(biome.brickA), bB=new THREE.Color(biome.brickB),
    bH=new THREE.Color(biome.brickHi);

  // S4 checker tint: instanced quads hovering just above the base plane,
  // per-instance colors alternate biome.floor0/floor1 (zero-asset polish;
  // atlas.floor map, when present, multiplies on top)
  const chkGeo=new THREE.PlaneGeometry(CFG.TILE,CFG.TILE);
  chkGeo.rotateX(-Math.PI/2);
  const checker=new THREE.InstancedMesh(chkGeo,
    new THREE.MeshLambertMaterial({color:"#ffffff"}),CFG.COLS*CFG.ROWS);
  if(atlas&&atlas.floor)checker.material.map=atlas.floor;
  {
    const cA=new THREE.Color(biome.floor0), cB=new THREE.Color(biome.floor1);
    let ci=0;
    for(let y=0;y<CFG.ROWS;y++)for(let x=0;x<CFG.COLS;x++){
      MAT.makeTranslation((x+0.5)*CFG.TILE-W/2,0.4,(y+0.5)*CFG.TILE-D/2);
      checker.setMatrixAt(ci,MAT);
      checker.setColorAt(ci++,(x+y)&1?cB:cA);
     }
    checker.instanceMatrix.needsUpdate=true;
    if(checker.instanceColor)checker.instanceColor.needsUpdate=true;
   }
  checker.receiveShadow=true; checker.userData.tag="checker";
  group.add(checker);

  // S4 border trim: wall-top rails framing the arena in biome.wallHi
  {
    const trimMat=new THREE.MeshLambertMaterial({color:biome.wallHi});
    const rail=(w,d,x,z)=>{
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,6,d),trimMat);
      m.position.set(x,biome.hWall+3,z);
      m.castShadow=false; m.receiveShadow=true;
      m.userData.tag="trim";
      group.add(m);
     };
    rail(W+CFG.TILE,10,0,(D-CFG.TILE)/2);
    rail(W+CFG.TILE,10,0,-(D-CFG.TILE)/2);
    rail(10,D-CFG.TILE,(W-CFG.TILE)/2,0);
    rail(10,D-CFG.TILE,-(W-CFG.TILE)/2,0);
   }

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
          brick.setMatrixAt(n,MAT);
          brick.setColorAt(n++,((x*3+y*5)%7)===0?bH:((x+y)&1?bB:bA));
         }
      brick.count=n;
      brick.instanceMatrix.needsUpdate=true;
      if(brick.instanceColor)brick.instanceColor.needsUpdate=true;
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
