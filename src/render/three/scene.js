/* buildScene (real3d spec §2) — pure world->THREE mapping, Node-testable:
   only THREE objects + world reads; no DOM/canvas/time. World->scene coords
   X=x-300, Y=up, Z=y-260 (board centered on origin). Static-once: floor plane,
   lights, biome materials. WALL and BRICK: fixed-capacity InstancedMeshes
   rescanned in place by update() — never add/remove meshes. Walls follow the
   grid too: SHRINK seals rings mid-room and a new board may reuse a room
   number (fix 2026-10-21). Rebuild rule: update() returns true when
   world.level changed => caller discards group and calls buildScene again. */
import * as THREE from "../../../vendor/three.module.js";
import {CFG,T,biomeOf} from "../../core/config.js";
import {build as buildMaterials} from "./materials.js";
import {createLights} from "./lights.js";
import {createPools} from "./entities.js";
import {live} from "./upload.js";
import {buildFeat} from "./featmesh.js";
import {wallCodes} from "../wallvar.js";
import {RIM_TEX, nearX, NEAR_Z} from "./rimart.js";
import {createAmbient} from "./ambientfx.js";
import {rimFX, floorFX, featAO, createAO} from "./wellfx.js";

const W=CFG.COLS*CFG.TILE, D=CFG.ROWS*CFG.TILE;
const MAT=new THREE.Matrix4();
/* Cabinet rim (2026-09-04 cam-light-frame): the border used to be four
   wallHi rails at one height, and the N/S pair spanned W+TILE, so they
   crossed the E/W pair and stuck out past every corner. One extruded ring
   with a hole cannot overlap itself — there are no corner pieces — and it
   costs 1 draw call instead of 4. Solid from the floor to LIP above the wall
   top so the arena sits in a well rather than under a floating rail; tinted
   DOWN toward bg1 so the frame recedes and the bevel carries the highlight.
   Bevel is inset so total reach stays exactly RIM_W. */
export const RIM_W=36, RIM_LIP=6, RIM_BEV=2, RIM_IN=4;
/* Near-wall cutaway (ruling 2026-10-09): at rig C the ICE border row nearest
   the camera (hWall 36) left a row-11 actor 58-85% of its screen area (MAKO
   75%) and clipped eye planes. The near row ROWS-1, corners included, tops
   out at min(hWall, NEAR_H) by per-instance Y-scale in the same InstancedMesh:
   no new draw call, and both corner tiles drop with it (one height). 22 is the
   tallest height where MAKO keeps 100% and every foe keeps its eyes and
   >=90% of its screen area at its WORST bob/spin phase at rig C (23: walker
   89, shade 88; FAR at 22: walker 89). stationary's flat base sits against
   row 12 and only climbs 80->88% from 24 down to 18, so it cannot bind. 22 is
   still above every hBrick (max 20), so WALL out-tops BRICK; only
   ICE/WATER/VOID/CROWN change. The rim's near lip keeps hWall+LIP: rays
   from row 11 pass >=27 units over it (ICE), and no sweep ray hit it. */
export const NEAR_H=22;

/* frame A: the rim's own UVs. Top caps (and bevels) read the ring picture by
   world (x, z); side faces read the strip under it by (x or z, height). One
   geometry, one material, so the rim is still one draw. */
function rimUV(geo,biome){
  const {rx,rz,S,strip}=RIM_TEX, P=geo.attributes.position, N=geo.attributes.normal,
    Wc=rx*2*S, Hc=(rz*2+strip)*S, uv=new Float32Array(P.count*2);
  for(let i=0;i<P.count;i++){
    const x=P.getX(i), y=P.getY(i), z=P.getZ(i);
    let px, py;
    if(Math.abs(N.getY(i))>0.3){ px=(x+rx)*S; py=(z+rz)*S; }
    else{
      const ns=Math.abs(N.getZ(i))>Math.abs(N.getX(i));
      px=(ns?(x+rx)/(rx*2):(z+rz)/(rz*2))*Wc;
      py=(rz*2+Math.max(0,Math.min(strip,strip-y)))*S;
     }
    uv[i*2]=Math.max(0.0005,Math.min(0.9995,px/Wc));
    uv[i*2+1]=1-Math.max(0.0005,Math.min(0.9995,py/Hc));
   }
  geo.setAttribute("uv",new THREE.BufferAttribute(uv,2));
}

/* the pale worlds sit lower still: the rim must stay quieter than walls and tiles */
const RIM_TINT={ICE:0.04,SAND:0.14,ARENA:0.26,FACTORY:0.26,WATER:0.22,JUNGLE:0.2,CROWN:0.2,VOID:0.1};
/* value lift on the painted rim (colour multiplies the map): ICE's wall slot is a dark steel blue and read as a black frame round a pale room */
const RIM_LIFT={ICE:1.55,SAND:1.12};
/* gentle gloss per world (specular grey, shininess): the polished worlds catch
   the key on the bevel; stone / timber / sand stay matte. VOID is capped so
   nothing on it reads above wallHi. */
const RIM_GLOSS={ICE:[0.22,60],CROWN:[0.16,40],FACTORY:[0.14,34],WATER:[0.14,46],VOID:[0.06,50]};
function buildRim(biome,atlas){
  const oX=W/2+RIM_W-RIM_BEV, oZ=D/2+RIM_W-RIM_BEV;
  const iX=W/2-RIM_IN+RIM_BEV, iZ=D/2-RIM_IN+RIM_BEV;
  const shape=new THREE.Shape();
  /* frame round: shape y = -world z, so the NEAR edge is y = -oZ. From
     z = NEAR_Z the outer E / W edge leans in to nearX so the rim stays inside
     the canvas at the near corners (tests: reach, symmetry, hole unchanged) */
  const nX=nearX(biome.hWall)-RIM_BEV;
  shape.moveTo(-nX,-oZ); shape.lineTo(nX,-oZ); shape.lineTo(oX,-NEAR_Z);
  shape.lineTo(oX,oZ); shape.lineTo(-oX,oZ); shape.lineTo(-oX,-NEAR_Z); shape.closePath();
  const hole=new THREE.Path();          // reverse winding => real hole
  hole.moveTo(-iX,-iZ); hole.lineTo(-iX,iZ); hole.lineTo(iX,iZ);
  hole.lineTo(iX,-iZ); hole.closePath();
  shape.holes.push(hole);
  const geo=new THREE.ExtrudeGeometry(shape,{
    depth:biome.hWall+RIM_LIP-RIM_BEV,bevelEnabled:true,
    bevelThickness:RIM_BEV,bevelSize:RIM_BEV,bevelSegments:1,curveSegments:1});
  geo.rotateX(-Math.PI/2);              // extrude runs +Z -> lay it flat
  const col=new THREE.Color(biome.wall).lerp(new THREE.Color(biome.bg1),0.35);
  const gl=RIM_GLOSS[biome.name];
  const mat=gl?new THREE.MeshPhongMaterial({color:col,specular:new THREE.Color(gl[0],gl[0],gl[0]),shininess:gl[1]}):new THREE.MeshLambertMaterial({color:col});
  if(atlas&&atlas.rim){ rimUV(geo,biome); mat.color.set("#ffffff").lerp(new THREE.Color(biome.bg1),RIM_TINT[biome.name]||0.2).multiplyScalar(RIM_LIFT[biome.name]||1); mat.map=atlas.rim; }
  const rim=new THREE.Mesh(geo,rimFX(mat,biome.hWall,!!(atlas&&atlas.rim),biome.name));
  rim.castShadow=false; rim.receiveShadow=true;
  rim.userData.tag="trim";
  return rim;
}

function disposeGroup(group){
  const mats=new Set();
  if(group.userData.ao)group.userData.ao.dispose();
  group.traverse(o=>{
    if(o.geometry&&!o.geometry._shared)o.geometry.dispose();
    const m=o.material;
    if(m)(Array.isArray(m)?m:[m]).forEach(x=>{ if(!x._shared)mats.add(x); });
   });
  mats.forEach(m=>{ if(m.map&&!m.map._shared)m.map.dispose(); m.dispose(); });
}

export function buildScene(world, atlas, bright){
  const biome=biomeOf(world.level);
  const mats=buildMaterials(biome,atlas);
  const group=new THREE.Group();

  const floor=new THREE.Mesh(new THREE.PlaneGeometry(W,D),mats.floor);
  floor.rotation.x=-Math.PI/2;
  floor.receiveShadow=true;
  floor.userData.tag="floor";
  group.add(floor);

  // walls: capacity COLS*ROWS forever; one matrix per T.WALL tile, refilled
  // by update() whenever the wall set changes (SHRINK, a new board)
  const wallGeo=new THREE.BoxGeometry(CFG.TILE,biome.hWall,CFG.TILE);
  const wall=new THREE.InstancedMesh(wallGeo,mats.wall,CFG.COLS*CFG.ROWS);
  wall.material.color.set("#ffffff");
  const aWv=new THREE.InstancedBufferAttribute(new Float32Array(CFG.COLS*CFG.ROWS),1);
  wallGeo.setAttribute("aWv",aWv);
  const wA=new THREE.Color("#ffffff");
  const hN=Math.min(biome.hWall,NEAR_H);
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
  const ao=createAO(biome.hWall);
  const chkGeo=new THREE.PlaneGeometry(CFG.TILE,CFG.TILE);
  chkGeo.rotateX(-Math.PI/2);
  const checker=new THREE.InstancedMesh(chkGeo,
    floorFX(new THREE.MeshLambertMaterial({color:"#ffffff"}),ao),CFG.COLS*CFG.ROWS);
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
  const feat=world.feat?buildFeat(world,biome):null;
  if(feat){ featAO(feat.mesh.material,ao); group.add(feat.mesh); }

  group.add(buildRim(biome,atlas));

  const lights=createLights(biome,bright);
  group.add(lights.hemi,lights.dir,lights.fill,lights.amb);
  lights.dir.target.position.set(0,0,0);
  group.add(lights.dir.target);

  // entity pools (S2): fixed slots, visibility-toggled, synced every update
  const pools=createPools(biome,atlas);
  group.add(pools.group);
  const amb=createAmbient(biome);
  group.add(amb.points);

  const mask=new Uint8Array(CFG.COLS*CFG.ROWS),
    wMask=new Uint8Array(CFG.COLS*CFG.ROWS);
  let fresh=true, lastG=null, lastS=-1;
  group.userData.ao=ao;
  const scene={group,amb,level:world.level,featRef:world.feat||null,brick,pools,lights,brickV:0,
    update(world){
      let diff=fresh, wDiff=fresh||world.grid!==lastG||(world.seed>>>0)!==lastS;
      lastG=world.grid; lastS=world.seed>>>0;
      for(let i=0;i<mask.length;i++){ const t=world.grid[i],
        b=t===T.BRICK?1:0, v=t===T.WALL?1:0;
        if(mask[i]!==b){ mask[i]=b; diff=true; }
        if(wMask[i]!==v){ wMask[i]=v; wDiff=true; } }
      if(wDiff){
        let n=0; const WC=wallCodes(world);
        for(let y=0;y<CFG.ROWS;y++)for(let x=0;x<CFG.COLS;x++)
          if(wMask[y*CFG.COLS+x]){
            aWv.array[n]=WC[y*CFG.COLS+x];
            const h=y===CFG.ROWS-1?hN:biome.hWall;
            MAT.makeScale(1,h/biome.hWall,1).setPosition((x+0.5)*CFG.TILE-W/2,
              h/2,(y+0.5)*CFG.TILE-D/2);
            wall.setMatrixAt(n,MAT);
            wall.setColorAt(n++,wA);
           }
        wall.count=n;
        live(wall.instanceMatrix,n);
        live(wall.instanceColor,n);
        live(aWv,n);
        wall.boundingSphere=null;
        ao.bake(wMask);
        if(!diff)scene.brickV++;      // shadow map re-renders for EMPTY->WALL
       }
      if(diff){
        let n=0;
        for(let y=0;y<CFG.ROWS;y++)for(let x=0;x<CFG.COLS;x++)
          if(mask[y*CFG.COLS+x]){
            MAT.makeTranslation((x+0.5)*CFG.TILE-W/2,biome.hBrick/2,
              (y+0.5)*CFG.TILE-D/2);
            brick.setMatrixAt(n,MAT);
            brick.setColorAt(n++,((x*3+y*5)%7)===0?bH:((x+y)&1?bB:bA));
           }
        brick.count=n;
        live(brick.instanceMatrix,n);
        live(brick.instanceColor,n);
        fresh=false; scene.brickV++;
       }
      pools.update(world);
      if(feat)feat.update(world);
      return world.level!==scene.level||(world.feat||null)!==scene.featRef;
     }};
  scene.update(world);          // initial wall + brick fill
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
