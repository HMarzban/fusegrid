/* Entity pools (real3d spec §2): fixed-capacity, visibility-toggled meshes.
   update(world) writes transforms in array order from live entries; unused
   slots visible=false. No per-frame allocation: geometries/materials are
   module-cached and swapped BY REFERENCE, matrices reuse scratch objects,
   blade instances live in one fixed InstancedMesh (count-culled).
   Identity colors come from the sim's spawnEnemy table (single source of
   truth, biome-independent); atlas maps merge only when they are real
   THREE.Textures, so headless keeps flat Lambert fallbacks. */
import * as THREE from "../../../vendor/three.module.js";
import {CFG} from "../../core/config.js";
import {spawnEnemy} from "../../core/entities.js";

const W2=CFG.COLS*CFG.TILE/2, D2=CFG.ROWS*CFG.TILE/2;
export const ENEMY_TYPES=["walker","chaser","fast","stationary",
  "boomerang","rocket"];
const PROTO={};
for(const t of ENEMY_TYPES)PROTO[t]=spawnEnemy(t,0,0,1,null);
export const ENEMY_COLORS={};
for(const t of ENEMY_TYPES)ENEMY_COLORS[t]=PROTO[t].color;

export const POOL_CAPS={player:1,enemies:16,bombs:CFG.MAX_BOMBS,items:32,
  blades:16*(1+4*CFG.MAX_RANGE)};

const _m=new THREE.Matrix4(), _p=new THREE.Vector3(),
  _q=new THREE.Quaternion(), _s=new THREE.Vector3();

/* per-type geometry + material caches (shared across pool slots & rebuilds:
   flagged _shared so disposeGroup never frees them mid-flight) */
const GEO={}, MATE={}, EH={};
function sharedGeo(g){ g._shared=true; return g; }
function sharedMat(m){ m._shared=true; return m; }
for(const t of ENEMY_TYPES){
  const r=PROTO[t].r; let g,h=r;
  if(t==="stationary"){ g=new THREE.BoxGeometry(r*2.3,r*2.3,r*2.3); h=r*1.15; }
  else if(t==="rocket"){ g=new THREE.ConeGeometry(r*0.95,r*2.6,12);
    g.rotateX(Math.PI/2); h=r*0.95; }
  else if(t==="boomerang"){ g=new THREE.TorusGeometry(r*0.72,r*0.26,8,22,
    4.6); h=r*0.98; }
  else g=new THREE.SphereGeometry(r,16,12);
  GEO["e_"+t]=sharedGeo(g); EH["e_"+t]=h;
  MATE["e_"+t]=sharedMat(new THREE.MeshLambertMaterial({color:PROTO[t].color}));
}

const BOMB_COL={normal:"#15181f",power:"#5a1626",pierce:"#34346a",
  line:"#1b2430"};
const BOMBM={}; for(const k in BOMB_COL)
  BOMBM["b_"+k]=sharedMat(new THREE.MeshLambertMaterial({color:BOMB_COL[k]}));
/* S3: fuse spark is an unlit Basic glow (2D parity: flat fill, no lighting)
   that flickers scale exactly like drawBombBody's r*0.13+sin(t*30)*0.03. */
const SPARK_A=sharedMat(new THREE.MeshBasicMaterial({color:"#ff5d73"}));
const SPARK_B=sharedMat(new THREE.MeshBasicMaterial({color:"#ffd447"}));

export function createPools(biome, atlas){
  const group=new THREE.Group();

  /* player: capsule body + face plate textured from sprites art (§5);
     slot group carries the height so tests read a lifted origin */
  const player=new THREE.Group(); player.userData.tag="player";
  const capMat=sharedMat(new THREE.MeshLambertMaterial({color:"#37f0d0"}));
  const body=new THREE.Mesh(sharedGeo(new THREE.CapsuleGeometry(
    CFG.TILE*0.27,CFG.TILE*0.45,4,12)),capMat);
  body.castShadow=true; body.receiveShadow=true;
  const faceMat=new THREE.MeshBasicMaterial({transparent:true});
  if(atlas&&atlas.player instanceof THREE.Texture){
    faceMat.map=atlas.player; faceMat.color.set("#ffffff");
   } else faceMat.color.set("#f4f7ff");
  const face=new THREE.Mesh(sharedGeo(new THREE.PlaneGeometry(
    CFG.TILE*0.66,CFG.TILE*0.5)),faceMat);
  face.position.set(0,CFG.TILE*0.11,CFG.TILE*0.30);
  player.add(body,face);

  const enemies=[], bombs=[], items=[];
  for(let i=0;i<POOL_CAPS.enemies;i++){
    const s=new THREE.Mesh(GEO.e_walker,MATE.e_walker);
    s.userData.tag="enemy"; s.userData.k="e_walker";
    s.castShadow=true; s.receiveShadow=true; s.visible=false;
    enemies.push(s); group.add(s);
   }
  const bombBodyGeo=sharedGeo(new THREE.SphereGeometry(CFG.TILE*0.30,14,10));
  const fuseGeo=sharedGeo(new THREE.BoxGeometry(3.4,7,3.4));
  const sparkGeo=sharedGeo(new THREE.SphereGeometry(2.7,8,6));
  const fuseMat=sharedMat(new THREE.MeshLambertMaterial({color:"#3a2c1a"}));
  for(let i=0;i<POOL_CAPS.bombs;i++){
    const s=new THREE.Group(); s.userData.tag="bomb";
    const b=new THREE.Mesh(bombBodyGeo,BOMBM.b_normal);
    b.castShadow=true; b.position.y=CFG.TILE*0.32;
    const f=new THREE.Mesh(fuseGeo,fuseMat); f.position.y=CFG.TILE*0.69;
    const sp=new THREE.Mesh(sparkGeo,SPARK_A); sp.position.y=CFG.TILE*0.80;
    s.add(b,f,sp); s.visible=false;
    bombs.push(s); group.add(s);
   }
  const iconGeo=sharedGeo(new THREE.PlaneGeometry(CFG.TILE*0.62,
    CFG.TILE*0.62));
  const itemMats={};
  function matForItem(t,col){
    let m=itemMats[t];
    if(!m){ m=sharedMat(new THREE.MeshLambertMaterial({side:THREE.DoubleSide}));
      if(atlas&&atlas["item_"+t] instanceof THREE.Texture){ m.map=
        atlas["item_"+t]; m.color.set("#ffffff"); }
      else m.color.set(col||"#ffffff");
      itemMats[t]=m; }
    return m;
   }
  for(let i=0;i<POOL_CAPS.items;i++){
    const s=new THREE.Group(); s.userData.tag="item";
    const q=new THREE.Mesh(iconGeo,matForItem("fire","#ff8a3c"));
    q.castShadow=true;
    s.add(q); s.visible=false;
    items.push(s); group.add(s);
   }
  const bladeGeo=sharedGeo(new THREE.BoxGeometry(CFG.TILE*0.95,10,
    CFG.TILE*0.95));
  const bladeMat=sharedMat(new THREE.MeshLambertMaterial({color:"#101010",
    emissive:new THREE.Color("#ffcf5a")}));
  const blades=new THREE.InstancedMesh(bladeGeo,bladeMat,POOL_CAPS.blades);
  blades.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  blades.frustumCulled=false;                 // count varies per frame
  blades.castShadow=false; blades.receiveShadow=false;
  blades.count=0; blades.userData.tag="blade";
  group.add(blades);
  group.add(player);

  function update(world){
    const t=world.time||0;
    const p=world.players&&world.players[0];
    if(p&&p.alive!==false&&!(p.iFrames>0&&(Math.floor(p.iFrames*12)%2)===1)){
      player.visible=true;
      player.position.set(p.x-W2,CFG.TILE*0.51,p.y-D2);
      player.rotation.y=Math.atan2(p.face?p.face.x:0,p.face?p.face.y:1);
      capMat.color.set(p.color||"#37f0d0");
     } else player.visible=false;

    let ei=0;
    const ens=world.enemies||[];
    for(let i=0;i<ens.length&&ei<POOL_CAPS.enemies;i++){
      const e=ens[i]; if(e.dead)continue;
      const s=enemies[ei++];
      s.visible=!((e.invuln)&&(Math.floor(t*12)%2)===1);
      const kk=GEO["e_"+e.type]?"e_"+e.type:"e_walker";
      if(s.userData.k!==kk){ s.userData.k=kk; s.geometry=GEO[kk];
        s.material=MATE[kk]; }
      s.position.set(e.x-W2,EH[kk],e.y-D2);
      s.rotation.y=Math.atan2(e.dir?e.dir.x:0,e.dir?e.dir.y:1);
     }
    for(;ei<POOL_CAPS.enemies;ei++)enemies[ei].visible=false;

    let bi=0;
    const bs=world.bombs||[];
    for(let i=0;i<bs.length&&bi<POOL_CAPS.bombs;i++){
      const b=bs[i]; const s=bombs[bi++];
      s.visible=true;
      s.position.set(b.x-W2,1,b.y-D2);
      const fuse=1-Math.max(0,b.timer)/CFG.FUSE;
      s.scale.setScalar(1+Math.sin(t*18)*0.10*fuse);
      const vk=BOMBM["b_"+b.variant]?"b_"+b.variant:"b_normal";
      if(s.userData.v!==vk){ s.userData.v=vk; s.children[0].material=
        BOMBM[vk]; }
      s.children[2].material=(Math.floor(t*14)%2)?SPARK_B:SPARK_A;
      s.children[2].scale.setScalar(1+Math.sin(t*30)*0.23);
     }
    for(;bi<POOL_CAPS.bombs;bi++)bombs[bi].visible=false;

    let ii=0;
    const its=world.items||[];
    for(let i=0;i<its.length&&ii<POOL_CAPS.items;i++){
      const it=its[i]; if(it.taken)continue;
      const s=items[ii++];
      s.visible=true;
      s.position.set(it.x-W2,CFG.TILE*0.62,it.y-D2);
      s.rotation.y=t*3+ii*0.9;
      const pm=matForItem(it.t,it.col);
      if(s.children[0].material!==pm)s.children[0].material=pm;
     }
    for(;ii<POOL_CAPS.items;ii++)items[ii].visible=false;

    let n=0, maxSc=0;
    const bls=world.blades||[];
    for(let i=0;i<bls.length;i++){
      const bl=bls[i], tls=bl.tiles; if(!tls)continue;
      const sc=Math.max(0.001,1-bl.t/(bl.ttl||1));
      if(sc>maxSc)maxSc=sc;
      for(let j=0;j<tls.length&&n<POOL_CAPS.blades;j++){
        const tl=tls[j];
        _p.set(tl.tx*CFG.TILE+CFG.TILE/2-W2,5,
          tl.ty*CFG.TILE+CFG.TILE/2-D2);
        _s.setScalar(sc);
        _m.compose(_p,_q,_s);
        blades.setMatrixAt(n++,_m);
       }
     }
    blades.count=n;
    blades.instanceMatrix.needsUpdate=true;
    /* S3 emissive pulse: white-hot when fresh -> amber -> ember, flickering
       on world.time (mirrors drawBladeBody's age phases); idle ember off. */
    const phase=maxSc>0.7?1:maxSc>0.3?0.7:0.45;
    bladeMat.emissiveIntensity=n>0?phase*(0.8+0.2*Math.sin(t*24)):0.3;
   }

  update({players:[],enemies:[],bombs:[],items:[],blades:[],time:0});
  return {group,player,enemies,bombs,items,blades,update};
}
