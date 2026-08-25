/* Entity pools (real3d spec §2 + §3 S4 art pass): fixed-capacity,
   visibility-toggled meshes. update(world) writes transforms in array order
   from live entries; unused slots visible=false. No per-frame allocation:
   geometries/materials are module-cached and swapped BY REFERENCE, matrices
   reuse scratch objects, blade instances live in fixed InstancedMeshes
   (count-culled), flash lights are a fixed 3-light pool. Identity colors come
   from the sim's spawnEnemy table (single source of truth, biome-independent);
   atlas maps merge only when they are real THREE.Textures, so headless keeps
   flat Lambert fallbacks. S4 silhouettes: every slot carries its art children
   (SLOT_MESH meshes/slot); enemy detail geometry swaps per type exactly like
   the base mesh. Idle bob/spin are render-side only (never touch sim state). */
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
/* S4 art pass: mesh counts per pool slot (base + silhouette children) and
   the blast point-light pool size — feed the draw-call budget formula. */
export const SLOT_MESH={player:7,enemy:3,bomb:5,item:1};
export const FLASH_CAP=3;

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

/* S4 enemy detail silhouettes: exactly 2 child meshes per slot, per-type
   geometry/material/transform caches swapped BY REFERENCE on type change.
   Local frame: +Z is the facing direction (slot rotation.y = atan2(dir)). */
const DARK=sharedMat(new THREE.MeshLambertMaterial({color:"#0a0f1a"}));
const ID={}; for(const t of ENEMY_TYPES)ID[t]=MATE["e_"+t];
const GD={}, MD={}, GT={}, GR={};
{
  let r,K;
  K="e_walker"; r=PROTO.walker.r;
  GD[K]=[sharedGeo(new THREE.BoxGeometry(r*0.34,r*0.22,r*0.40)),
    sharedGeo(new THREE.BoxGeometry(r*0.34,r*0.22,r*0.40))];
  MD[K]=[DARK,DARK];
  GT[K]=[[-r*0.45,-r*0.85,0],[r*0.45,-r*0.85,0]]; GR[K]=[[0,0,0],[0,0,0]];
  K="e_chaser"; r=PROTO.chaser.r;
  const nose=sharedGeo(new THREE.ConeGeometry(r*0.42,r*0.75,8));
  nose.rotateX(Math.PI/2);
  GD[K]=[nose,sharedGeo(new THREE.BoxGeometry(r*0.18,r*0.55,r*0.55))];
  MD[K]=[ID.chaser,DARK];
  GT[K]=[[0,-r*0.15,r*1.0],[0,r*0.35,-r*0.75]]; GR[K]=[[0,0,0],[0,0,0]];
  K="e_fast"; r=PROTO.fast.r;
  GD[K]=[sharedGeo(new THREE.BoxGeometry(r*0.7,r*0.16,r*0.6)),
    sharedGeo(new THREE.BoxGeometry(r*0.7,r*0.16,r*0.6))];
  const trailA=sharedMat(new THREE.MeshBasicMaterial({color:"#ffd447",
    transparent:true,opacity:0.45,depthWrite:false}));
  const trailB=sharedMat(new THREE.MeshBasicMaterial({color:"#ffd447",
    transparent:true,opacity:0.25,depthWrite:false}));
  MD[K]=[trailA,trailB];
  GT[K]=[[0,-r*0.1,-r*1.35],[0,-r*0.1,-r*1.85]]; GR[K]=[[0,0,0],[0,0,0]];
  K="e_stationary"; r=PROTO.stationary.r;
  GD[K]=[sharedGeo(new THREE.CylinderGeometry(r*0.16,r*0.22,r*0.85,
      10)),sharedGeo(new THREE.SphereGeometry(r*0.34,10,8))];
  const barrel=sharedMat(new THREE.MeshLambertMaterial({color:"#150a1c"}));
  MD[K]=[barrel,ID.stationary];
  GT[K]=[[0,r*1.47,0],[0,r*1.05,r*0.55]]; GR[K]=[[0,0,0],[0,0,0]];
  K="e_boomerang"; r=PROTO.boomerang.r;
  const wing=sharedGeo(new THREE.BoxGeometry(r*1.5,r*0.22,r*0.22));
  GD[K]=[wing,wing];
  MD[K]=[ID.boomerang,ID.boomerang];
  GT[K]=[[0,0,0],[0,0,0]]; GR[K]=[[0,0,0],[0,0,0]];
  K="e_rocket"; r=PROTO.rocket.r;
  const fin=sharedGeo(new THREE.BoxGeometry(r*0.08,r*0.7,r*0.55));
  GD[K]=[fin,fin];
  const finMat=sharedMat(new THREE.MeshLambertMaterial({color:"#3a1c10"}));
  MD[K]=[finMat,finMat];
  GT[K]=[[0,0,-r*0.55],[0,0,-r*0.55]]; GR[K]=[[0,0,Math.PI/4],
    [0,0,-Math.PI/4]];
}
/* idle bob per type [amp, freq] — render-side breathing only */
const BOB={"e_walker":[1.8,12],"e_chaser":[1.2,9],"e_fast":[1.0,16],
  "e_stationary":[1.5,3],"e_boomerang":[2.0,10],"e_rocket":[1.4,7]};

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

  /* S4 player: bomberman-hero silhouette — capsule torso, white helmet-head
     sphere, face-texture visor plate (atlas.player), antenna rod+ball, two
     boots. Slot group carries the ground origin; children stack upward. */
  const player=new THREE.Group(); player.userData.tag="player";
  const capMat=sharedMat(new THREE.MeshLambertMaterial({color:"#37f0d0"}));
  const T4=CFG.TILE*0.01;
  const body=new THREE.Mesh(sharedGeo(new THREE.CapsuleGeometry(
    CFG.TILE*0.24,CFG.TILE*0.30,4,12)),capMat);
  body.position.y=CFG.TILE*0.24;
  body.castShadow=true; body.receiveShadow=true;
  const headMat=sharedMat(new THREE.MeshLambertMaterial({color:"#f4f7ff"}));
  const head=new THREE.Mesh(sharedGeo(new THREE.SphereGeometry(
    CFG.TILE*0.28,16,12)),headMat);
  head.position.y=CFG.TILE*0.60;
  head.castShadow=true;
  const faceMat=new THREE.MeshBasicMaterial({transparent:true});
  if(atlas&&atlas.player instanceof THREE.Texture){
    faceMat.map=atlas.player; faceMat.color.set("#ffffff");
   } else faceMat.color.set("#0b1020");
  const visor=new THREE.Mesh(sharedGeo(new THREE.PlaneGeometry(
    CFG.TILE*0.50,CFG.TILE*0.26)),faceMat);
  visor.position.set(0,CFG.TILE*0.62,CFG.TILE*0.245);
  const rodMat=sharedMat(new THREE.MeshLambertMaterial({color:"#0b1020"}));
  const rod=new THREE.Mesh(sharedGeo(new THREE.CylinderGeometry(T4*0.9,
    T4*0.9,CFG.TILE*0.16,6)),rodMat);
  rod.position.y=CFG.TILE*0.94;
  const ballMat=sharedMat(new THREE.MeshBasicMaterial({color:"#ff5d73"}));
  const ball=new THREE.Mesh(sharedGeo(new THREE.SphereGeometry(T4*0.62,8,6)),
    ballMat);
  ball.position.y=CFG.TILE*1.04;
  const footGeo=sharedGeo(new THREE.BoxGeometry(CFG.TILE*0.22,CFG.TILE*0.10,
    CFG.TILE*0.26));
  const bootMat=sharedMat(new THREE.MeshLambertMaterial({color:"#0d3f78"}));
  const footL=new THREE.Mesh(footGeo,bootMat);
  footL.position.set(-CFG.TILE*0.15,CFG.TILE*0.05,0);
  const footR=new THREE.Mesh(footGeo,bootMat);
  footR.position.set(CFG.TILE*0.15,CFG.TILE*0.05,0);
  footL.castShadow=footR.castShadow=true;
  player.add(body,head,visor,rod,ball,footL,footR);

  const enemies=[], bombs=[], items=[];
  for(let i=0;i<POOL_CAPS.enemies;i++){
    const s=new THREE.Mesh(GEO.e_walker,MATE.e_walker);
    s.userData.tag="enemy"; s.userData.k="e_walker";
    s.castShadow=true; s.receiveShadow=true; s.visible=false;
    for(let j=0;j<2;j++){
      const d=new THREE.Mesh(GD.e_walker[j],MD.e_walker[j]);
      d.position.set(...GT.e_walker[j]); d.rotation.set(...GR.e_walker[j]);
      d.castShadow=true; s.add(d);
     }
    enemies.push(s); group.add(s);
   }
  /* S4 bombs: classic black sphere + white specular blob + metal cap under
     the fuse (children[0] body / [2] spark contract kept for prior tests). */
  const bombBodyGeo=sharedGeo(new THREE.SphereGeometry(CFG.TILE*0.30,14,10));
  const fuseGeo=sharedGeo(new THREE.BoxGeometry(3.4,7,3.4));
  const sparkGeo=sharedGeo(new THREE.SphereGeometry(2.7,8,6));
  const hiGeo=sharedGeo(new THREE.SphereGeometry(CFG.TILE*0.09,8,6));
  const capGeo=sharedGeo(new THREE.CylinderGeometry(CFG.TILE*0.07,
    CFG.TILE*0.09,CFG.TILE*0.10,10));
  const fuseMat=sharedMat(new THREE.MeshLambertMaterial({color:"#3a2c1a"}));
  const hiMat=sharedMat(new THREE.MeshBasicMaterial({color:"#ffffff",
    transparent:true,opacity:0.55,depthWrite:false}));
  const capMatB=sharedMat(new THREE.MeshLambertMaterial({color:"#9aa3c0"}));
  for(let i=0;i<POOL_CAPS.bombs;i++){
    const s=new THREE.Group(); s.userData.tag="bomb";
    const b=new THREE.Mesh(bombBodyGeo,BOMBM.b_normal);
    b.castShadow=true; b.position.y=CFG.TILE*0.32;
    const f=new THREE.Mesh(fuseGeo,fuseMat); f.position.y=CFG.TILE*0.69;
    const sp=new THREE.Mesh(sparkGeo,SPARK_A); sp.position.y=CFG.TILE*0.80;
    const hi=new THREE.Mesh(hiGeo,hiMat);
    hi.position.set(-CFG.TILE*0.10,CFG.TILE*0.44,CFG.TILE*0.16);
    const cap=new THREE.Mesh(capGeo,capMatB); cap.position.y=CFG.TILE*0.63;
    s.add(b,f,sp,hi,cap); s.visible=false;
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
  /* S4 blasts: TWO layered instanced meshes — outer amber box keeps the
     exact prior ttl-shrink contract; inner white-hot core pops at spawn
     (overshoot easing settles by 20% ttl). */
  const bladeGeo=sharedGeo(new THREE.BoxGeometry(CFG.TILE*0.95,10,
    CFG.TILE*0.95));
  const bladeMat=new THREE.MeshLambertMaterial({color:"#101010",
    emissive:new THREE.Color("#ffcf5a").lerp(
      new THREE.Color(biome.brickHi||"#ffcf5a"),0.45)});
  const blades=new THREE.InstancedMesh(bladeGeo,bladeMat,POOL_CAPS.blades);
  blades.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  blades.frustumCulled=false;                 // count varies per frame
  blades.castShadow=false; blades.receiveShadow=false;
  blades.count=0; blades.userData.tag="blade";
  group.add(blades);
  const coreGeo=new THREE.BoxGeometry(CFG.TILE*0.52,12,CFG.TILE*0.52);
  const coreMat=new THREE.MeshBasicMaterial({color:"#fff8d8",transparent:true,
    opacity:0.95,depthWrite:false,blending:THREE.AdditiveBlending});
  const cores=new THREE.InstancedMesh(coreGeo,coreMat,POOL_CAPS.blades);
  cores.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cores.frustumCulled=false;
  cores.castShadow=false; cores.receiveShadow=false;
  cores.count=0; cores.userData.tag="blade";
  group.add(cores);
  /* S4 flash pool: <=3 concurrent point lights riding the freshest blast
     centers; intensity tracks per-blade freshness, spares stay dark. */
  const flashes=[];
  for(let i=0;i<FLASH_CAP;i++){
    const L=new THREE.PointLight("#ffd447",0,CFG.TILE*3.6,2);
    L.userData.tag="flash";
    flashes.push(L); group.add(L);
   }
  group.add(player);

  function update(world){
    const t=world.time||0;
    const p=world.players&&world.players[0];
    if(p&&p.alive!==false&&!(p.iFrames>0&&(Math.floor(p.iFrames*12)%2)===1)){
      player.visible=true;
      const moving=!!(p.face&&(p.face.x||p.face.y))&&!(p.iFrames>0);
      player.position.set(p.x-W2,CFG.TILE*0.05+
        (moving?Math.sin(p.walk*18)*1.8:Math.sin(t*4)*1.0),p.y-D2);
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
        s.material=MATE[kk];
        const d=s.children;
        for(let j=0;j<2;j++){ d[j].geometry=GD[kk][j];
          d[j].material=MD[kk][j];
          d[j].position.set(GT[kk][j][0],GT[kk][j][1],GT[kk][j][2]);
          d[j].rotation.set(GR[kk][j][0],GR[kk][j][1],GR[kk][j][2]); }
       }
      const bb=BOB[kk];
      s.position.set(e.x-W2,EH[kk]+bb[0]*
        Math.sin(t*bb[1]+(e.home?e.home.x*0.7:0)),e.y-D2);
      s.rotation.y=Math.atan2(e.dir?e.dir.x:0,e.dir?e.dir.y:1);
      if(kk==="e_boomerang"){ s.children[0].rotation.y=t*10;
        s.children[1].rotation.y=Math.PI/2+t*10; }
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
      const pop=1+0.6*Math.max(0,1-bl.t/((bl.ttl||1)*0.15));
      for(let j=0;j<tls.length&&n<POOL_CAPS.blades;j++){
        const tl=tls[j];
        _p.set(tl.tx*CFG.TILE+CFG.TILE/2-W2,5,
          tl.ty*CFG.TILE+CFG.TILE/2-D2);
        _s.setScalar(sc);
        _m.compose(_p,_q,_s);
        blades.setMatrixAt(n,_m);
        _s.setScalar(sc*0.55*pop);
        _m.compose(_p,_q,_s);
        cores.setMatrixAt(n,_m);
        n++;
       }
     }
    blades.count=n;
    blades.instanceMatrix.needsUpdate=true;
    cores.count=n;
    cores.instanceMatrix.needsUpdate=true;
    /* S3 emissive pulse: white-hot when fresh -> amber -> ember, flickering
       on world.time (mirrors drawBladeBody's age phases); idle ember off. */
    const phase=maxSc>0.7?1:maxSc>0.3?0.7:0.45;
    bladeMat.emissiveIntensity=n>0?phase*(0.8+0.2*Math.sin(t*24)):0.3;
    /* S4 flash lights: ride the first FLASH_CAP blasts, brightness =
       remaining life; overflow blasts share nothing (pool capped). */
    for(let i=0;i<FLASH_CAP;i++){
      const L=flashes[i], bl=bls[i];
      if(bl&&bl.tiles&&bl.tiles.length){
        L.intensity=2.4*Math.max(0,Math.min(1,1-bl.t/(bl.ttl||1)));
        L.position.set(bl.x-W2,26,bl.y-D2);
       } else L.intensity=0;
     }
    }

  update({players:[],enemies:[],bombs:[],items:[],blades:[],time:0});
  return {group,player,enemies,bombs,items,blades,cores,flashes,update};
}
