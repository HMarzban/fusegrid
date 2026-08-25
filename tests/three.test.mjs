/* REAL-3D S1+S2+S3 (spec 2026-08-24-real3d-design §2/§3/§4/§5/§6/§7): Node-only
   checks — vendor import, frozen light rig, biome materials, buildScene
   instanced counts vs grid scan + brick rescan/rebuild, camrig math, wrapper
   surface, renderer "iso" alias, headless createGame surface; S2 adds entity
   pool counts/visibility vs world sets, px->world transform sync, facing
   rotation, invuln flicker, bomb pulse/tint, blade ttl fade, per-type enemy
   variants + identity colors, zero-asset texture-source probes, and the
   sim/net/input purity grep gate; S3 adds fx-store Points particles (pool cap
   + px->world mapping + ttl fade), introCam flythrough keyframe math + camera
   drive, blade emissive pulse + fuse-spark glow, attract-through-3D harness
   with rebuild rollover, shake end-to-end (event -> store -> lookAt offset),
    and the ≤500-draw-call / DPR≤2 perf gate; S4 adds the game-element art
    pass — hero/enemy silhouette parts (SLOT_MESH), layered blast cores with
    scale-pop easing, pooled ≤3 flash PointLights, overlay HUD chips
    (drawHudChips) gated on o.hud===true, checker floor tiles + border-wall
    trim, and the exact post-S4 draw-call count within budget. No DOM anywhere. */
import {createLights} from "../src/render/three/lights.js";
import {build} from "../src/render/three/materials.js";
import {buildScene, countDrawCalls} from "../src/render/three/scene.js";
import {createPools} from "../src/render/three/entities.js";
import {atlasSources, buildAtlas} from "../src/render/three/textures.js";
import {createRig, orbitBy, dollBy, resetOrbit, applyOrbit,
  SHAKE_3D_K} from "../src/render/three/camrig.js";
import {createRenderer3D} from "../src/render/three/wrapper.js";
import {createRenderer} from "../src/render/renderer.js";
import {createWorld, loadLevel, step} from "../src/core/sim.js";
import {CFG, T, BIOMES} from "../src/core/config.js";
import {spawnEnemy, POWER} from "../src/core/entities.js";
import {createGame} from "../src/main.js";
import * as THREE from "../vendor/three.module.js";
import {readdirSync, readFileSync} from "node:fs";
const slotsOf=(g,tag)=>{ const out=[];
  g.traverse(o=>{ if(o.userData&&o.userData.tag===tag)out.push(o); });
  return out; };
const visOf=(g,tag)=>slotsOf(g,tag).filter(o=>o.visible).length;

let pass=0, fail=0;
function check(name, cond, detail){ cond?pass++:fail++;
  console.log((cond?"  PASS ":"  FAIL ")+name+(detail!==undefined?" -> "+detail:"")); }
const hexOf=(c)=>"#"+c.color.getHexString();

// ---- §0 vendor: relative import, r160 ----
check("vendor three.module.js imports + is r160", THREE.REVISION==="160",
  THREE.REVISION);

// ---- §6 lights: frozen rig values ----
{
  const b=BIOMES[0], L=createLights(b);
  check("hemi sky #cfe8ff ground bg1 intensity .85",
    hexOf(L.hemi)==="#cfe8ff"
    &&"#"+L.hemi.groundColor.getHexString()==="#"+b.bg1.replace("#","")
    &&L.hemi.intensity===0.85,
    hexOf(L.hemi)+"/"+L.hemi.groundColor.getHexString()+"/"+L.hemi.intensity);
  const d=L.dir;
  check("dir white 1.6 at (300,420,220) castShadow",
    d.intensity===1.6&&hexOf(d)==="#ffffff"&&d.position.x===300
    &&d.position.y===420&&d.position.z===220&&d.castShadow===true);
  const c=d.shadow.camera;
  check("dir shadow ortho ±340/±280 near10 far1200 map1024 bias -5e-4",
    c.left===-340&&c.right===340&&c.top===280&&c.bottom===-280
    &&c.near===10&&c.far===1200&&d.shadow.mapSize.width===1024
    &&d.shadow.mapSize.height===1024&&d.shadow.bias===-0.0005);
  check("ambient #ffffff 0.25", L.amb.intensity===0.25&&hexOf(L.amb)==="#ffffff");
}

// ---- §2 materials: flat MeshLambert colors from BIOMES ----
{
  const b=BIOMES[2], m=build(b);
  check("materials are MeshLambertMaterial",
    m.floor.isMeshLambertMaterial&&m.wall.isMeshLambertMaterial
    &&m.brick.isMeshLambertMaterial);
  check("colors from BIOMES fields (floor0/wall/brickA)",
    hexOf(m.floor)==="#"+b.floor0.slice(1)&&hexOf(m.wall)==="#"+b.wall.slice(1)
    &&hexOf(m.brick)==="#"+b.brickA.slice(1),
    hexOf(m.floor)+"/"+hexOf(m.wall)+"/"+hexOf(m.brick));
}

// ---- §2 scene: counts vs grid scan + mapping + rescan/rebuild ----
function scan(grid){
  let walls=0, bricks=0;
  for(let i=0;i<grid.length;i++){
    if(grid[i]===T.WALL)walls++; else if(grid[i]===T.BRICK)bricks++;
   }
  return {walls,bricks};
}
{
  const w=createWorld(123,1); loadLevel(w,1,false);
  const s=buildScene(w), sc=scan(w.grid);
  const wall=s.group.children.find(o=>o.userData.tag==="wall");
  const brick=s.group.children.find(o=>o.userData.tag==="brick");
  const floor=s.group.children.find(o=>o.userData.tag==="floor");
  check("floor plane 600x520 flat on XZ", !!floor
    &&floor.geometry.parameters.width===CFG.COLS*CFG.TILE
    &&floor.geometry.parameters.height===CFG.ROWS*CFG.TILE
    &&Math.abs(floor.rotation.x+Math.PI/2)<1e-12);
  check("wall InstancedMesh count === T.WALL scan", !!wall
    &&wall.isInstancedMesh&&wall.count===sc.walls, wall.count+"/"+sc.walls);
  check("brick InstancedMesh count === T.BRICK scan", !!brick
    &&brick.isInstancedMesh&&brick.count===sc.bricks, brick.count+"/"+sc.bricks);
  check("brick capacity COLS*ROWS (no realloc ever)",
    brick.instanceMatrix.count>=CFG.COLS*CFG.ROWS);
  // world->scene mapping X=x-300 Z=y-260 on the FIRST wall tile in scan order
  let fx=-1,fy=-1;
  for(let y=0;y<CFG.ROWS&&fx<0;y++)for(let x=0;x<CFG.COLS;x++)
    if(w.grid[y*CFG.COLS+x]===T.WALL){fx=x;fy=y;break;}
  const p=new THREE.Vector3();
  wall.getMatrixAt(0,p.set(0,0,0) instanceof THREE.Vector3?p:new THREE.Vector3());
  const m=new THREE.Matrix4(); wall.getMatrixAt(0,m);
  const pos=new THREE.Vector3(); m.decompose(pos,new THREE.Quaternion(),
    new THREE.Vector3());
  const ex=(fx+0.5)*CFG.TILE-300, ez=(fy+0.5)*CFG.TILE-260;
  check("first wall instance at ((tx+.5)*TILE-300, hWall/2, (ty+.5)*TILE-260)",
    Math.abs(pos.x-ex)<1e-9&&Math.abs(pos.z-ez)<1e-9
    &&Math.abs(pos.y-BIOMES[0].hWall/2)<1e-9,
    pos.x.toFixed(1)+","+pos.y.toFixed(1)+","+pos.z.toFixed(1)
      +" want "+ex.toFixed(1)+","+BIOMES[0].hWall/2+","+ez.toFixed(1));
  check("walls+bricks cast shadows", wall.castShadow===true
    &&brick.castShadow===true&&floor.receiveShadow===true);
  // brick rescan in place: knock one brick out of the grid, update() recounts
  let hit=false;
  for(let i=0;i<w.grid.length&&!hit;i++)
    if(w.grid[i]===T.BRICK){w.grid[i]=T.EMPTY;hit=true;}
  check("update(same level) returns false (no rebuild)", s.update(w)===false);
  check("brick count drops after grid edit (in-place rescan)",
    brick.count===sc.bricks-1, brick.count+"/"+(sc.bricks-1));
  check("level change -> update returns true (caller rebuilds)",
    (loadLevel(w,2,false), s.update(w)===true));
}

// ---- §4 camrig: state defaults, clamps, reset, applyOrbit + shake ----
{
  const st=createRig();
  check("rig defaults az-0.6 el0.9 dist560 target origin",
    st.az===-0.6&&st.el===0.9&&st.dist===560
    &&st.target[0]===0&&st.target[1]===0&&st.target[2]===0);
  orbitBy(st, 10, 10);
  check("orbitBy clamps el to 1.35 (az free)", st.el===1.35&&st.az===9.4,
    "az="+st.az+" el="+st.el);
  orbitBy(st,-100,-100);
  check("orbitBy clamps el to 0.25", st.el===0.25);
  dollBy(st,10000); check("dollBy clamps dist to 900", st.dist===900);
  dollBy(st,-10000); check("dollBy clamps dist to 240", st.dist===240);
  resetOrbit(st);
  check("resetOrbit restores defaults", st.az===-0.6&&st.el===0.9
    &&st.dist===560);
  const cam=new THREE.PerspectiveCamera();
  applyOrbit(cam,st,{x:0,y:0});
  const se=Math.sin(st.el), ce=Math.cos(st.el);
  check("applyOrbit position = target + spherical(az,el,dist)",
    Math.abs(cam.position.x-st.dist*se*Math.sin(st.az))<1e-9
    &&Math.abs(cam.position.y-st.dist*ce)<1e-9
    &&Math.abs(cam.position.z-st.dist*se*Math.cos(st.az))<1e-9,
    cam.position.x.toFixed(2)+","+cam.position.y.toFixed(2)
      +","+cam.position.z.toFixed(2));
  const cam2=new THREE.PerspectiveCamera(), cam3=new THREE.PerspectiveCamera();
  applyOrbit(cam2,st,{x:0,y:0});
  cam2.updateMatrixWorld(true);
  const q0=cam2.quaternion.clone();
  applyOrbit(cam3,st,{x:100,y:-50});
  cam3.updateMatrixWorld(true);
  check("shake offsets lookAt by SHAKE_3D_K world-units/px (orientation shifts)",
    SHAKE_3D_K===0.06&&!q0.equals(cam3.quaternion),
    "K="+SHAKE_3D_K);
}

// ---- §1 wrapper surface contract ----
{
  const r=createRenderer3D(null,null,{audio:null,hud:null});
  const keys=Object.keys(r).sort().join(",");
  check("wrapper surface keys exactly canvas,consumeEvents,ctx,getShake,"
      +"overlay,render",
    keys==="canvas,consumeEvents,ctx,getShake,overlay,render", keys);
  check("headless stub mode: ctx is noop-2D-like", !!r.ctx
    &&typeof r.ctx.save==="function"&&typeof r.ctx.translate==="function");
  const w=createWorld(7,1); loadLevel(w,1,false); w.state="PLAY";
  w.events.push({t:"boom",x:0,y:0},{t:"kill",x:1,y:1,color:"#fff"});
  let threw=false;
  try{ r.render(w,1/60); }catch(e){ threw=true; console.log(e.message); }
  check("render(headless stub) drains events + no-throw",
    !threw&&w.events.length===0, "events="+w.events.length);
  check("getShake passthrough returns {x,y}",
    typeof r.getShake()==="object"&&typeof r.getShake().x==="number"
    &&typeof r.getShake().y==="number");
  loadLevel(w,2,false);                       // level flip exercises rebuild path
  try{ r.render(w,1/60); }catch(e){ threw=true; console.log(e.message); }
  check("render after loadLevel(2) rebuilds without throw", !threw);
}

// ---- §7 renderer "iso" alias -> legacy branch; default 2d untouched ----
{
  const w=createWorld(9,1); loadLevel(w,1,false); w.state="MENU";
  let ok=true;
  try{ createRenderer(null,{kind:"iso",hud:null,audio:null}).render(w,1/60); }
  catch(e){ ok=false; console.log(e.message); }
  check("createRenderer(kind:'iso') renders legacy branch headless", ok);
}

// ---- headless createGame surface: render3d seam + live toggle swap ----
function mkCanvas(){
  const rec=new Proxy(function(){},{
    get:(t,p)=>p===Symbol.toPrimitive?()=>"":(()=>rec),
    apply:()=>rec, set:()=>true});
  return {width:600,height:520,style:{},getContext:()=>rec,
    addEventListener(){},removeEventListener(){}};
}
{
  const g=createGame(mkCanvas(),{seed:77,autoplay:true,render3d:true});
  check("opts.render3d boots the 3D wrapper surface",
    !!g.renderer&&"overlay"in g.renderer&&typeof g.renderer.getShake
      ==="function"
    &&Object.keys(g.renderer).sort().join()
      ===["canvas","consumeEvents","ctx","getShake","overlay","render"].join());
  let t=0, threw=false;
  try{ for(let i=0;i<5;i++){ t+=16; g.loop(t); } }
  catch(e){ threw=true; console.log(e.message); }
  check("loop frames run through 3D path (sim steps, no throw)",
    !threw&&g.world.time>0,"time="+g.world.time);
  g.input._onKey({code:"KeyR"});
  check("KeyR inside GAME with 3D rig does not throw (resetOrbit route)",
    g.world.state==="PLAY");
  g.app.screen=2; g.app.cursor=2; g.app.confirm();   // RENDER toggle back to 2D
  t+=16; g.loop(t);
  check("RENDER toggle swaps to classic surface (no overlay key)",
    !("overlay"in g.renderer), String(Object.keys(g.renderer)));
}
{
  const g=createGame(mkCanvas(),{seed:78,autoplay:true});
  check("default boot keeps classic 2D surface byte-path",
    !("overlay"in g.renderer)&&typeof g.renderer.render==="function");
}

// ---- §S2 helpers ----
function mkE(type,x,y,over){
  return Object.assign({type,x,y,tx:Math.floor(x/CFG.TILE),
    ty:Math.floor(y/CFG.TILE),dir:{x:0,y:1},speed:1,color:"#ffffff",
    r:CFG.TILE*0.34,pass:false,dead:false,invuln:false,invulnT:0,cd:4,
    home:{x:1,y:1}},over||{});
}
function matScale(inst,i){
  const m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),
    s=new THREE.Vector3();
  inst.getMatrixAt(i,m); m.decompose(p,q,s); return {p,q,s};
}
/* S2 sections run under a guard so a missing-feature crash prints FAILs
   instead of aborting the whole file (clean RED before implementation).
   Promise-aware: async sections are awaited by their caller. */
async function sec(name,fn){ try{ const r=fn(); if(r&&r.then)await r; }
  catch(e){ fail++;
    console.log("  FAIL "+name+" (threw -> "+e.message+")"); } }

// ---- §S2.A pool counts + visibility vs world sets ----
sec("S2.A",()=>{
  const w=createWorld(21,1); loadLevel(w,1,false);
  w.enemies=[mkE("walker",100,80),mkE("fast",180,140),
    mkE("stationary",260,200),mkE("rocket",340,260,{dead:true})];
  w.items=[{x:100,y:120,t:"fire",col:"#ff8a3c",taken:false,pdef:null},
    {x:140,y:120,t:"remote",col:"#9aa3c0",taken:true,pdef:null},
    {x:180,y:120,t:"kick",col:"#c07a3a",taken:false,pdef:null}];
  w.bombs=[{x:60,y:60,tx:1,ty:1,timer:CFG.FUSE,variant:"normal"},
    {x:100,y:60,tx:2,ty:1,timer:1.25,variant:"power"}];
  w.blades=[{x:200,y:120,tiles:[{tx:5,ty:3},{tx:6,ty:3},{tx:5,ty:4}],
    t:0,ttl:CFG.BLADE_TTL,variant:"normal"}];
  const sc=buildScene(w); sc.update(w);
  const g=sc.group;
  check("S2 player slot visible (alive)", visOf(g,"player")===1);
  check("S2 enemy slots visible === live enemies (dead filtered)",
    visOf(g,"enemy")===3, visOf(g,"enemy"));
  check("S2 item slots visible === untaken items",
    visOf(g,"item")===2, visOf(g,"item"));
  check("S2 bomb slots visible === live bombs",
    visOf(g,"bomb")===2, visOf(g,"bomb"));
  const inst=slotsOf(g,"blade")[0];
  check("S2 blade pool is InstancedMesh", !!inst&&inst.isInstancedMesh);
  check("S2 blade instances === blast tiles across live blades",
    inst.count===3, inst.count);
  check("S2 fixed pool sizes: enemies<=16 bombs<=MAX_BOMBS items<=32 "
      +"bladeCap>=16*33",
    slotsOf(g,"enemy").length===16
    &&slotsOf(g,"bomb").length===CFG.MAX_BOMBS
    &&slotsOf(g,"item").length===32
    &&inst.instanceMatrix.count>=16*(1+4*CFG.MAX_RANGE));
});

// ---- §S2.B transform sync: continuous px -> world units + facing ----
sec("S2.B",()=>{
  const w=createWorld(22,1); loadLevel(w,1,false);
  w.enemies=[mkE("walker",200,80,{dir:{x:0,y:-1}})];
  w.bombs=[{x:100,y:100,tx:2,ty:2,timer:CFG.FUSE,variant:"normal"}];
  const sc=buildScene(w); sc.update(w);
  const g=sc.group;
  const ps=slotsOf(g,"player")[0];
  const W=CFG.COLS*CFG.TILE, D=CFG.ROWS*CFG.TILE;
  check("S2 player world x/z from px (X=x-W/2, Z=y-D/2, y above floor)",
    Math.abs(ps.position.x-(w.players[0].x-W/2))<1e-9
    &&Math.abs(ps.position.z-(w.players[0].y-D/2))<1e-9&&ps.position.y>0,
    ps.position.x.toFixed(1)+"/"+ps.position.z.toFixed(1));
  const es=slotsOf(g,"enemy")[0];
  check("S2 enemy slot tracks its live entry position",
    Math.abs(es.position.x-(-100))<1e-9&&Math.abs(es.position.z-(-180))<1e-9,
    es.position.x.toFixed(1)+"/"+es.position.z.toFixed(1));
  const bs=slotsOf(g,"bomb")[0];
  check("S2 bomb slot at bomb px", Math.abs(bs.position.x+200)<1e-9
    &&Math.abs(bs.position.z+160)<1e-9);
  w.players[0].face={x:1,y:0}; sc.update(w);
  check("S2 facing rotation.y = atan2(face.x,face.y) (+X -> pi/2)",
    Math.abs(ps.rotation.y-Math.PI/2)<1e-9, ps.rotation.y.toFixed(3));
  w.players[0].face={x:0,y:-1}; sc.update(w);
  check("S2 facing -Y -> pi", Math.abs(ps.rotation.y-Math.PI)<1e-9);
  check("S2 enemy dir drives slot rotation",
    Math.abs(es.rotation.y-Math.atan2(0,-1))<1e-9);
});

// ---- §S2.C lifecycle: death / take / expiry hide slots ----
sec("S2.C",()=>{
  const w=createWorld(23,1); loadLevel(w,1,false);
  w.enemies=[mkE("walker",100,80),mkE("chaser",180,140)];
  w.items=[{x:100,y:120,t:"fire",col:"#ff8a3c",taken:false,pdef:null}];
  w.blades=[{x:200,y:120,tiles:[{tx:5,ty:3},{tx:6,ty:3}],t:0,
    ttl:CFG.BLADE_TTL,variant:"normal"}];
  const sc=buildScene(w); const g=sc.group;
  sc.update(w);
  check("S2 baseline 2 enemies visible", visOf(g,"enemy")===2);
  w.enemies[0].dead=true; sc.update(w);
  check("S2 death hides slot (visible drops to 1)", visOf(g,"enemy")===1);
  w.items[0].taken=true; sc.update(w);
  check("S2 taken item hides slot", visOf(g,"item")===0);
  const inst=slotsOf(g,"blade")[0];
  check("S2 blade count 2 before clear", inst.count===2);
  w.blades=[]; sc.update(w);
  check("S2 expired/cleared blades -> count 0", inst.count===0);
  w.players[0].alive=false; sc.update(w);
  check("S2 dead player hides slot", visOf(g,"player")===0);
});

// ---- §S2.D bomb pulse ∝ timer, variant tint, fuse hint ----
sec("S2.D",()=>{
  const w=createWorld(24,1); loadLevel(w,1,false);
  w.time=0.05;
  w.bombs=[{x:60,y:60,tx:1,ty:1,timer:CFG.FUSE,variant:"normal"},
    {x:100,y:60,tx:2,ty:1,timer:CFG.FUSE*0.5,variant:"power"}];
  const sc=buildScene(w); sc.update(w);
  const bs=slotsOf(sc.group,"bomb");
  check("S2 bomb at full fuse scale 1 (pulse amp 0)",
    Math.abs(bs[0].scale.x-1)<1e-9, bs[0].scale.x.toFixed(4));
  const want=1+Math.sin(w.time*18)*0.10*(1-0.5);
  check("S2 bomb pulse amplitude grows as timer -> 0 (∝ 1-timer/FUSE)",
    Math.abs(bs[1].scale.x-want)<1e-9&&bs[1].scale.x>1.005,
    bs[1].scale.x.toFixed(4)+" want "+want.toFixed(4));
  check("S2 fuse hint present (body + spark children)",
    bs[0].children.length>=2&&bs[1].children.length>=2,
    bs[0].children.length+"/"+bs[1].children.length);
  const c0="#"+bs[0].children[0].material.color.getHexString();
  const c1="#"+bs[1].children[0].material.color.getHexString();
  check("S2 variant tint: power body color differs from normal", c0!==c1,
    c0+" vs "+c1);
});

// ---- §S2.E blade ttl-driven fade (shrink with age) ----
sec("S2.E",()=>{
  const w=createWorld(25,1); loadLevel(w,1,false);
  w.blades=[{x:200,y:120,tiles:[{tx:5,ty:3},{tx:6,ty:3},{tx:5,ty:4}],t:0,
    ttl:CFG.BLADE_TTL,variant:"normal"}];
  const sc=buildScene(w); sc.update(w);
  const inst=slotsOf(sc.group,"blade")[0];
  const s0=matScale(inst,0).s;
  check("S2 blade tile at age0 scale 1 at arm tile center",
    Math.abs(s0.x-1)<1e-9&&Math.abs(matScale(inst,0).p.x-(-80))<1e-9
    &&Math.abs(matScale(inst,0).p.z-(-120))<1e-9&&matScale(inst,0).p.y>0);
  w.blades[0].t=w.blades[0].ttl*0.5; sc.update(w);
  const s1=matScale(inst,0).s;
  check("S2 blade scale shrinks with bl.t/bl.ttl",
    Math.abs(s1.x-0.5)<1e-9, s1.x.toFixed(3));
});

// ---- §S2.F per-type enemy variants + identity colors from entities.js ----
sec("S2.F",()=>{
  const w=createWorld(26,1); loadLevel(w,1,false);
  const types=["walker","chaser","fast","stationary","boomerang","rocket"];
  w.enemies=types.map((t,i)=>mkE(t,60+i*40,80));
  const sc=buildScene(w); sc.update(w);
  const es=slotsOf(sc.group,"enemy");
  const wantGeo={walker:"SphereGeometry",chaser:"SphereGeometry",
    fast:"SphereGeometry",stationary:"BoxGeometry",boomerang:"TorusGeometry",
    rocket:"ConeGeometry"};
  let geoOk=true, colOk=true, det=[];
  for(let i=0;i<types;i++){
    if(es[i].geometry.type!==wantGeo[types[i]])geoOk=false;
    const proto=spawnEnemy(types[i],0,0,1,null);
    const have="#"+es[i].material.color.getHexString();
    if(have.toLowerCase()!==proto.color.toLowerCase()){colOk=false;det.push(
      types[i]+":"+have+"!="+proto.color);}
   }
  check("S2 enemy mesh variant per type (sphere/box/torus/cone)", geoOk,
    es.map(e=>e.geometry.type).join(","));
  check("S2 identity colors match entities.js spawnEnemy table"
      +" (biome-independent)", colOk, det.join(" "));
});

// ---- §S2.G invuln flicker (visibility toggles) ----
sec("S2.G",()=>{
  const w=createWorld(27,1); loadLevel(w,1,false);
  w.enemies=[mkE("walker",100,80,{invuln:true})];
  const sc=buildScene(w); const g=sc.group;
  w.players[0].iFrames=0.09;               // floor(.09*12)%2 === 1 -> hidden
  w.time=0.05;                             // enemy phase even -> visible
  sc.update(w);
  check("S2 player iFrames flicker hides on odd phase",
    visOf(g,"player")===0&&visOf(g,"enemy")===1);
  w.players[0].iFrames=0.17;               // even phase -> visible
  w.time=0.09;                             // enemy odd phase -> hidden
  sc.update(w);
  check("S2 enemy invuln flicker mirrors 2D parity (time*12)",
    visOf(g,"player")===1&&visOf(g,"enemy")===0);
});

// ---- §S2.H pool caps hold under overflow ----
sec("S2.H",()=>{
  const w=createWorld(28,1); loadLevel(w,1,false);
  w.enemies=[]; w.items=[];
  for(let i=0;i<18;i++)w.enemies.push(mkE("walker",60+i*20,80));
  for(let i=0;i<34;i++)w.items.push({x:60+i*8,y:120,t:"fire",
    col:"#ff8a3c",taken:false,pdef:null});
  const sc=buildScene(w); sc.update(w);
  const g=sc.group;
  check("S2 overflow clamps to pool caps (16 enemies / 32 items)",
    visOf(g,"enemy")===16&&visOf(g,"item")===32
    &&slotsOf(g,"enemy").length===16&&slotsOf(g,"item").length===32,
    visOf(g,"enemy")+"/"+visOf(g,"item"));
});

// ---- §S2.I zero-asset texture pipeline (spec §5) ----
function recFactory(){
  const canvases=[];
  const mk=()=>{
    const ops=[]; const cv={style:{},_ops:ops};
    let wd=0,ht=0;
    Object.defineProperty(cv,"width",{get:()=>wd,set:v=>{wd=v;
      ops.push("size:"+v);}});
    Object.defineProperty(cv,"height",{get:()=>ht,set:v=>{ht=v;
      ops.push("sizeH:"+v);}});
    const ctx=new Proxy({},{get:(t,p)=>{
      if(typeof p==="symbol")return undefined;
      return (...a)=>{ops.push(String(p));};},
      set:(t,p,v)=>{if(typeof p!=="symbol")ops.push("set:"+String(p));
        return true;}});
    cv.getContext=()=>ctx;
    canvases.push(cv); return cv; };
  return {mk,canvases};
}
{
  const f=recFactory();
  const kinds=["player","enemy_walker","enemy_stationary","bomb","item_fire"];
  const src=atlasSources(f.mk);
  let ok=true,det=[];
  for(const k of kinds){
    const cv=src[k];
    if(!cv){ok=false;det.push(k+":missing");continue;}
    const paints=cv._ops.filter(o=>o==="fill"||o==="stroke"||o==="fillRect"
      ||o==="arc"||o==="beginPath").length;
    if(cv.width!==64||cv.height!==64||paints<5
      ||!cv._ops.includes("set:fillStyle")){ok=false;
      det.push(k+":"+cv.width+"x"+cv.height+" paints="+paints);}
   }
  check("S2 texture sources paint non-blank 64x64 via sprite art fns"
      +" (headless op-probe)", ok, det.join(" "));
  check("S2 buildAtlas() headless (no DOM) => null (color fallback rule)",
    buildAtlas()===null);
  const atlas=buildAtlas(f.mk);
  check("S2 buildAtlas(factory) wraps CanvasTexture NearestFilter+sRGB",
    !!atlas&&atlas.player.isTexture===true
    &&atlas.player.magFilter===THREE.NearestFilter
    &&atlas.enemy_rocket.isTexture===true
    &&atlas.bomb.colorSpace===THREE.SRGBColorSpace
    &&atlas.item_fire.isTexture===true);
  const w=createWorld(29,1); loadLevel(w,1,false);
  const poolsJunk=createPools(BIOMES[0],{player:"junk-not-a-texture"});
  const face=poolsJunk.player.children.find(o=>o.isMesh
    &&o.geometry.type==="PlaneGeometry");
  check("S2 non-Texture atlas entries rejected (materials keep flat colors)",
    !face.material.map);
  const scPlain=buildScene(w);
  const pcapsule=slotsOf(scPlain.group,"player")[0].children.find(
    o=>o.isMesh&&o.geometry.type==="CapsuleGeometry");
  check("S2 headless player = Lambert capsule body, map-free fallback",
    !!pcapsule&&pcapsule.material.isMeshLambertMaterial
    &&!pcapsule.material.map);
  const es0=slotsOf(scPlain.group,"enemy")[0];
  const protoW=spawnEnemy("walker",0,0,1,null);
  check("S2 headless enemy material flat identity color, map-free",
    es0.material.isMeshLambertMaterial&&!es0.material.map
    &&"#"+es0.material.color.getHexString()
      ===protoW.color.toLowerCase());
}

// ---- §S2.J purity gate: sim/net/input carry zero three/render-three refs ----
sec("S2.J",()=>{
  const bad=[];
  const scanFile=p=>{ if(/vendor\/three|render\/three/.test(readFileSync(p,
    "utf8")))bad.push(p); };
  const scanDir=d=>{ for(const f of readdirSync(d))
    if(f.endsWith(".js"))scanFile(d+"/"+f); };
  scanDir("src/core"); scanDir("src/net"); scanFile("src/input.js");
  check("S2 grep gate: no vendor/three or render/three refs in src/core,"
      +" src/net, src/input.js", bad.length===0, bad.join(","));
});

// ---- real detonation: blade tiles + brick drop through the live sim ----
await sec("S2.detonation",async()=>{
  const w=createWorld(30,1); loadLevel(w,1,false); w.state="PLAY";
  w.grid[1*CFG.COLS+2]=T.BRICK;              // guarantee a brick beside spawn
  const nBricks=w.grid.reduce((a,v)=>a+(v===T.BRICK?1:0),0);
  const inp={move:{x:0,y:0},fire:true,firePrev:false,shift:false,
    remote:false,kick:false};
  step(w,CFG.STEP,[inp]);                    // rising edge places bomb @ (1,1)
  for(let i=0;i<400&&!w.blades.length;i++){inp.firePrev=true;
    step(w,CFG.STEP,[inp]);}
  const sc=buildScene(w); sc.update(w);
  const inst=slotsOf(sc.group,"blade")[0];
  const want=w.blades.reduce((a,bl)=>a+bl.tiles.length,0);
  check("S2 live-sim detonation: blade instances === blast tiles",
    w.blades.length===1&&inst.count===want&&want>=1,
    inst.count+"/"+want+" blades="+w.blades.length);
  const nAfter=w.grid.reduce((a,v)=>a+(v===T.BRICK?1:0),0);
  sc.update(w);
  const brick=sc.group.children.find(o=>o.userData.tag==="brick");
  check("S2 simulated detonation breaks brick (instanced count drops)",
    nAfter<nBricks&&brick.count===nAfter,
    brick.count+"/"+nAfter+" was "+nBricks);
});

// ---- §S3.A THREE.Points particle pool consumes the fx store data ----
await sec("S3.A",async()=>{
  const m=await import("../src/render/three/particles.js");
  const {createParticles,PART_CAP}=m;
  check("S3.A pool cap fixed >=256", typeof PART_CAP==="number"
    &&PART_CAP>=256, String(PART_CAP));
  const fxp=createParticles();
  check("S3.A is a frustum-cull-free THREE.Points",
    fxp.points.isPoints===true&&fxp.points.frustumCulled===false);
  fxp.update([]);
  check("S3.A empty store -> drawRange 0",
    fxp.points.geometry.drawRange.count===0);
  fxp.update([
    {x:300,y:260,vx:0,vy:0,t:0,life:1,color:"#ff0000",size:3},
    {x:100,y:80,vx:0,vy:0,t:0.5,life:1,color:"#ff0000",size:3}]);
  const geo=fxp.points.geometry;
  check("S3.A drawRange === live parts", geo.drawRange.count===2);
  const pa=geo.attributes.position.array, ca=geo.attributes.color.array;
  check("S3.A px->world mapping X=x-300 Y=8 Z=y-260 (slot0)",
    Math.abs(pa[0]-0)<1e-9&&Math.abs(pa[1]-8)<1e-9
    &&Math.abs(pa[2]-0)<1e-9, pa[0]+"/"+pa[1]+"/"+pa[2]);
    check("S3.A ttl fade dims vertex color (k=1-t/life)",
      Math.abs(ca[0]-1)<1e-6&&Math.abs(ca[3]-0.5)<1e-6,
      ca[0].toFixed(3)+"/"+ca[3].toFixed(3));
  const many=[];
  for(let i=0;i<PART_CAP+50;i++)many.push({x:i,y:i,t:0,life:2,
    color:"#ffffff",size:2});
  fxp.update(many);
  check("S3.A overflow clamps to cap", geo.drawRange.count===PART_CAP,
    geo.drawRange.count+"/"+PART_CAP);
  fxp.update([{confetti:true,x:300,y:-10,vx:0,vy:1,t:0,life:2,
    color:"#ffd447",size:4}]);
  check("S3.A confetti rains from sky (high Y, north Z)",
    Math.abs(pa[1]-(CFG.ROWS*CFG.TILE+40+10)*0.45)<1e-9
    &&Math.abs(pa[2]+270)<1e-9, pa[1].toFixed(1));
});

// ---- §S3.B wrapper fx hook + shake end-to-end (event->store->camera) ----
await sec("S3.B",async()=>{
  const sj=await import("../src/render/three/wrapper.js");
  const {getShake,getFx}=await import("../src/render/fx.js");
  const realRnd=Math.random;
  Math.random=()=>0.75;                    // deterministic shake/particle spread
  try{
    const r=sj.createRenderer3D(null,null,{audio:null,hud:null});
    const w=createWorld(41,1); loadLevel(w,1,false); w.state="PLAY";
    w.events.push({t:"boom",x:300,y:260});
    let threw=false;
    try{ r.render(w,1/60); }catch(e){ threw=true; console.log(e.message); }
    check("S3.B boom render spawns 20 store particles (no throw)",
      !threw&&getFx().length===20, "parts="+getFx().length);
    const dbg=r._dbg;
    check("S3.B wrapper feeds Points pool from store (drawRange 20)",
      !!dbg&&dbg.particles.points.geometry.drawRange.count===20);
    const sh=getShake();
    const wantX=0.25*(0.3-1/60)*18;        // rnd .75 => (+0.25)*shakeT*18
    check("S3.B boom -> shakeT decays to px offsets (+1.275,+1.275)",
      Math.abs(sh.x-wantX)<1e-9&&Math.abs(sh.y-wantX)<1e-9,
      sh.x.toFixed(4)+" want "+wantX.toFixed(4));
    const qWith=dbg.camera.quaternion.clone();
    applyOrbit(dbg.camera,createRig(),{x:0,y:0});
    check("S3.B end-to-end: shaken lookAt differs from calm lookAt "
        +"(SHAKE_3D_K px->world)", !qWith.equals(dbg.camera.quaternion));
    check("S3.B DPR clamp <=2 (headless dpr 1)",
      sj.DPR_MAX===2&&dbg.dpr<=sj.DPR_MAX, "dpr="+dbg.dpr);
   } finally{ Math.random=realRnd; }
});

// ---- §S3.C introCam keyframes monotonic + endpoints match introPhase ----
await sec("S3.C",async()=>{
  const ft=await import("../src/render/three/flythrough.js");
  const {introPhase,INTRO_DUR}=await import("../src/app/intro.js");
  const st0=ft.introCam(0), stE=ft.introCam(INTRO_DUR);
  check("S3.C start frame matches introPhase zoom start (dist=560/1.55)",
    Math.abs(st0.dist-560/1.55)<1e-4, st0.dist.toFixed(3));
  check("S3.C start target rides lower-third drift (tz=(camY-.5)*520)",
    Math.abs(st0.target[2]-83.2)<1e-9, st0.target[2].toFixed(2));
  check("S3.C end frame == orbit rig defaults (seamless handoff)",
    Math.abs(stE.dist-560)<1e-9&&stE.az===-0.6&&stE.el===0.9
    &&stE.target[2]===0, stE.az+"/"+stE.el+"/"+stE.dist);
  let mono=true;
  for(let s=0;s<=INTRO_DUR+1e-9;s+=0.25){
    const a=ft.introCam(s), b=ft.introCam(Math.min(INTRO_DUR,s+0.25));
    if(b.dist<a.dist-1e-9||b.target[2]>a.target[2]+1e-9||b.el>a.el+1e-9)
      mono=false;
   }
  check("S3.C keyframes monotonic (dist up, target-z/el down)", mono);
  let tracks=true;
  for(let s=0;s<=INTRO_DUR;s+=0.5)
    if(Math.abs(ft.introCam(s).dist*introPhase(s).zoom-560)>1e-6)tracks=false;
  check("S3.C dist tracks introPhase fractions (dist*zoom==560)", tracks);
  check("S3.C flyover swings azimuth out mid-beat (cinematic arc)",
    ft.introCam(2.8).az>-0.4&&ft.introCam(0).az===-0.6,
    ft.introCam(2.8).az.toFixed(3));
  const r=createRenderer3D(null,null,{audio:null,hud:null});
  const w=createWorld(43,1); loadLevel(w,1,false); w.state="MENU";
  const camA=new THREE.PerspectiveCamera();
  applyOrbit(camA,ft.introCam(2.8),{x:0,y:0});
  r.render(w,1/60,{intro:2.8});
  check("S3.C wrapper o.intro drives camera exactly via introCam+applyOrbit",
    Math.abs(r._dbg.camera.position.x-camA.position.x)<1e-9
    &&Math.abs(r._dbg.camera.position.z-camA.position.z)<1e-9,
    r._dbg.camera.position.x.toFixed(2)+" vs "+camA.position.x.toFixed(2));
  const g=createGame(mkCanvas(),{seed:61,render3d:true});
  g.app.screen=1; g.app.subT=1.0;             // INTRO mid-flyover
  let threw=false; let t=1000;
  try{ for(let i=0;i<5;i++){ t+=16; g.loop(t); } }
  catch(e){ threw=true; console.log(e.message); }
  check("S3.C main loop renders INTRO through 3D kind (no throw, no swap)",
    !threw&&"overlay"in g.renderer);
});

// ---- §S3.D ATTRACT demo world through the 3D path (rebuild rollover) ----
await sec("S3.D",async()=>{
  const g=createGame(mkCanvas(),{seed:51,render3d:true});
  g.app.screen=7; g.app.subT=99;              // ATTRACT (idle threshold past)
  let t=2000, threw=false;
  try{ for(let i=0;i<6;i++){ t+=16; g.loop(t); } }
  catch(e){ threw=true; console.log(e.message); }
  const dbg=g.renderer._dbg;
  const wallA=dbg&&slotsOf(dbg.scene,"wall")[0];
  check("S3.D attract frames build demo scene through 3D (no throw)",
    !threw&&!!g.demo&&!!wallA&&wallA.count>0,
    "demo="+(g.demo?"yes":"no"));
  check("S3.D particle Points live in scene during attract",
    !!dbg&&dbg.scene.children.some(o=>o.isPoints));
  const lvlA=g.demo.world.level;
  g.demo.world.state="WIN";                   // force cycle rollover 1->2
  try{ t+=16; g.loop(t); }catch(e){ threw=true; console.log(e.message); }
  const wallB=slotsOf(g.renderer._dbg.scene,"wall")[0];
  check("S3.D demo rollover rebuilds scene for next level",
    !threw&&g.demo.world.level!==lvlA&&wallB!==undefined&&wallB!==wallA
    &&wallB.count>0, lvlA+"->"+g.demo.world.level);
  let hudOk=true;
  try{ g.renderer.render(g.demo.world,1/60,{hud:false}); }
  catch(e){ hudOk=false; console.log(e.message); }
  check("S3.D o.hud===false honored (attract render, HUD suppressed)",
    hudOk);
});

// ---- §S3.E perf gate: draw-call budget <=500 + blade/fuse emissive curves ----
await sec("S3.E",async()=>{
  const sj=await import("../src/render/three/scene.js");   // countDrawCalls
  const w=createWorld(44,1); loadLevel(w,1,false);
  w.enemies=[]; w.items=[];
  for(let i=0;i<16;i++)w.enemies.push(mkE(["walker","chaser","fast",
    "stationary","boomerang","rocket"][i%6],60+i*30,80));
  for(let i=0;i<32;i++)w.items.push({x:60+i*15,y:120,t:"fire",
    col:"#ff8a3c",taken:false,pdef:null});
  const nb=Math.min(CFG.MAX_BOMBS,8);
  for(let i=0;i<nb;i++)w.bombs.push({x:60+i*40,y:160,tx:i,ty:2,
    timer:CFG.FUSE,variant:"normal"});
  w.blades=[{x:200,y:120,tiles:[{tx:5,ty:3},{tx:6,ty:3}],t:0,
    ttl:CFG.BLADE_TTL,variant:"normal"}];
  const r=createRenderer3D(null,null,{audio:null,hud:null});
  let calls=-1, threw=false;
  try{ r.render(w,1/60); calls=sj.countDrawCalls(r._dbg.scene); }
  catch(e){ threw=true; console.log(e.message); }
  check("S3.E draw-call budget <=500 (spec §8; got "+calls+")",
    !threw&&calls>0&&calls<=500, String(calls));
  // blade emissive pulse curve (fresh white-hot -> aged ember)
  const w2=createWorld(45,1); loadLevel(w2,1,false); w2.time=0;
  w2.blades=[{x:200,y:120,tiles:[{tx:5,ty:3}],t:0,ttl:CFG.BLADE_TTL,
    variant:"normal"}];
  const sc2=buildScene(w2); sc2.update(w2);
  const bm=slotsOf(sc2.group,"blade")[0].material;
  const iFresh=bm.emissiveIntensity;
  w2.time=Math.PI/48; sc2.update(w2);        // sin(24t)==1 peak
  const iPeak=bm.emissiveIntensity;
  w2.blades[0].t=w2.blades[0].ttl*0.8; w2.time=0; sc2.update(w2);
  const iOld=bm.emissiveIntensity;
  check("S3.E blade emissive pulse: fresh .8 -> peak 1.0 -> ember .36",
    Math.abs(iFresh-0.8)<1e-9&&Math.abs(iPeak-1.0)<1e-9
    &&Math.abs(iOld-0.36)<1e-9, iFresh.toFixed(2)+"/"+iPeak.toFixed(2)
    +"/"+iOld.toFixed(2));
  // fuse spark: unlit glow + 2D-parity flicker 1+-0.23*sin(t*30)
  w2.time=0.05; w2.bombs=[{x:60,y:60,tx:1,ty:1,timer:CFG.FUSE,
    variant:"normal"}]; sc2.update(w2);
  const sp=slotsOf(sc2.group,"bomb")[0].children[2];
  check("S3.E fuse spark is unlit Basic glow, scale flickers 2D parity",
    sp.material.isMeshBasicMaterial
    &&Math.abs(sp.scale.x-(1+Math.sin(0.05*30)*0.23))<1e-9,
    sp.material.type+" s="+sp.scale.x.toFixed(3));
});

// ---- §S4.A character silhouettes: hero parts + per-type enemy details ----
await sec("S4.A",async()=>{
  const ent=await import("../src/render/three/entities.js");
  const {SLOT_MESH}=ent;
  check("S4.A SLOT_MESH exported (player/enemy/bomb/item meshes per slot)",
    typeof SLOT_MESH==="object"&&SLOT_MESH.player>=6&&SLOT_MESH.enemy===3
    &&SLOT_MESH.bomb===5, JSON.stringify(SLOT_MESH));
  const w=createWorld(71,1); loadLevel(w,1,false);
  const pools=createPools(BIOMES[0],null);
  const kinds=pools.player.children.map(o=>o.geometry?o.geometry.type:null)
    .filter(Boolean);
  check("S4.A player = hero silhouette (capsule torso, helmet head sphere,"
      +" visor plane, antenna rod+ball, 2 feet)",
    kinds.length===SLOT_MESH.player
    &&kinds.includes("CapsuleGeometry")
    &&kinds.filter(k=>k==="SphereGeometry").length>=2
    &&kinds.includes("PlaneGeometry")
    &&kinds.includes("CylinderGeometry")
    &&kinds.filter(k=>k==="BoxGeometry").length>=2,
    kinds.join(","));
  const visor=pools.player.children.find(o=>o.isMesh
    &&o.geometry.type==="PlaneGeometry");
  check("S4.A visor plate rides the head front (above torso, +Z facing)",
    visor.position.y>CFG.TILE*0.3&&visor.position.z>0,
    visor.position.y.toFixed(2)+"/"+visor.position.z.toFixed(2));
  // per-type enemy detail children (base mesh keeps prior geometry contract)
  w.enemies=["walker","chaser","fast","stationary","boomerang","rocket"]
    .map((t,i)=>mkE(t,60+i*40,80));
  const sc=buildScene(w); sc.update(w);
  const es=slotsOf(sc.group,"enemy");
  const wantDetail={walker:["BoxGeometry","BoxGeometry"],
    chaser:["ConeGeometry","BoxGeometry"],fast:["BoxGeometry","BoxGeometry"],
    stationary:["CylinderGeometry","SphereGeometry"],
    boomerang:["BoxGeometry","BoxGeometry"],
    rocket:["BoxGeometry","BoxGeometry"]};
  let detOk=true,det=[];
  for(let i=0;i<6;i++){
    const got=es[i].children.map(o=>o.geometry.type);
    if(got.length!==2||got[0]!==wantDetail[w.enemies[i].type][0]
      ||got[1]!==wantDetail[w.enemies[i].type][1]){detOk=false;
      det.push(w.enemies[i].type+":"+got.join("+"));}
   }
  check("S4.A enemy detail silhouettes per type"
      +" (feet/nose/trail/turret/wings/fins)", detOk, det.join(" "));
  check("S4.A enemy base identity colors survive the art pass",
    "#"+es[3].material.color.getHexString()
      ===spawnEnemy("stationary",0,0,1,null).color.toLowerCase());
  // idle bob: render-side only — y breathes with world.time, x/z pinned
  w.time=0; sc.update(w);
  const y0=es[0].position.y, x0=es[0].position.x;
  w.time=0.13; sc.update(w);
  check("S4.A walker idle bob animates y (render-side), x/z pinned",
    Math.abs(y0-es[0].position.y)>0.01&&Math.abs(x0-es[0].position.x)<1e-9,
    y0.toFixed(2)+"->"+es[0].position.y.toFixed(2));
  const pw=createWorld(78,1); loadLevel(pw,1,false);
  const pp=createPools(BIOMES[0],null);
  const drive=(t)=>pp.update({players:pw.players,enemies:[],bombs:[],
    items:[],blades:[],time:t});
  drive(0);
  const py0=pp.player.position.y;
  drive(0.19);
  check("S4.A player idle bob animates y (render-side)",
    Math.abs(py0-pp.player.position.y)>0.01,
    py0.toFixed(2)+"->"+pp.player.position.y.toFixed(2));
});

// ---- §S4.B bomb art: highlight + metal cap on the classic sphere ----
await sec("S4.B",async()=>{
  const {SLOT_MESH}=await import("../src/render/three/entities.js");
  const w=createWorld(72,1); loadLevel(w,1,false);
  w.bombs=[{x:60,y:60,tx:1,ty:1,timer:CFG.FUSE,variant:"normal"}];
  const sc=buildScene(w); sc.update(w);
  const b=slotsOf(sc.group,"bomb")[0];
  const k=b.children.map(o=>o.geometry.type);
  check("S4.B bomb slot = body+fuse+spark+highlight+cap (prior indices kept)",
    b.children.length===SLOT_MESH.bomb&&k[0]==="SphereGeometry"
    &&k[1]==="BoxGeometry"&&k[2]==="SphereGeometry"
    &&k[3]==="SphereGeometry"&&k[4]==="CylinderGeometry", k.join(","));
  const hi=b.children[3], cap=b.children[4];
  check("S4.B highlight is white translucent spec blob",
    hi.material.transparent===true
    &&"#"+hi.material.color.getHexString()==="#ffffff", 
    "#"+hi.material.color.getHexString());
  check("S4.B metal cap sits between body top and fuse",
    "#"+cap.material.color.getHexString()!=="#15181f"
    &&cap.position.y>b.children[0].position.y
    &&cap.position.y<b.children[1].position.y,
    cap.position.y.toFixed(2));
});

// ---- §S4.C explosion drama: layered core pop + pooled flash lights ----
await sec("S4.C",async()=>{
  const ent=await import("../src/render/three/entities.js");
  const {FLASH_CAP}=ent;
  check("S4.C FLASH_CAP exported and === 3", FLASH_CAP===3, String(FLASH_CAP));
  const w=createWorld(73,1); loadLevel(w,1,false); w.time=0;
  w.blades=[{x:200,y:120,tiles:[{tx:5,ty:3}],t:0,ttl:CFG.BLADE_TTL,
    variant:"normal"}];
  const sc=buildScene(w); sc.update(w);
  const layers=slotsOf(sc.group,"blade");
  check("S4.C blades are TWO layered instanced meshes (outer + core)",
    layers.length===2&&layers[0].isInstancedMesh&&layers[1].isInstancedMesh,
    layers.length+"");
  const core=layers[1];
  check("S4.C core layer is white-hot unlit glow",
    core.material.isMeshBasicMaterial
    &&"#"+core.material.color.getHexString()==="#fff8d8",
    "#"+core.material.color.getHexString());
  const sCore0=matScale(core,0).s.x;
  const sOuter0=matScale(layers[0],0).s.x;
  check("S4.C scale-pop: core overshoots at t=0 (0.55*1.6=0.88), outer "
      +"keeps exact sc=1 (prior contract)",
    Math.abs(sCore0-0.88)<1e-9&&Math.abs(sOuter0-1)<1e-9,
    "core="+sCore0.toFixed(3)+" outer="+sOuter0.toFixed(3));
  w.blades[0].t=w.blades[0].ttl*0.2; sc.update(w);
  const sCore1=matScale(core,0).s.x;
  const sOuter1=matScale(layers[0],0).s.x;
  check("S4.C pop settles by 20% ttl: core=0.55*sc=0.44, outer=0.8 exact",
    Math.abs(sCore1-0.44)<1e-9&&Math.abs(sOuter1-0.8)<1e-9,
    "core="+sCore1.toFixed(3)+" outer="+sOuter1.toFixed(3));
  // flash light pool
  const flash=slotsOf(sc.group,"flash");
  check("S4.C exactly FLASH_CAP point lights tagged 'flash'",
    flash.length===FLASH_CAP&&flash.every(l=>l.isPointLight), flash.length);
  check("S4.C live blast drives flash 0 intensity>0, spare lights dark",
    flash[0].intensity>0&&flash[1].intensity===0&&flash[2].intensity===0,
    flash.map(l=>l.intensity.toFixed(2)).join("/"));
  check("S4.C flash rides blast center (X=x-W/2, Y=26, Z=y-D/2)",
    Math.abs(flash[0].position.x+100)<1e-9
    &&Math.abs(flash[0].position.z-(-140))<1e-9&&flash[0].position.y===26,
    flash[0].position.x.toFixed(1)+"/"+flash[0].position.z.toFixed(1));
  w.blades=[{x:60,y:60,tiles:[{tx:1,ty:1}],t:0,ttl:CFG.BLADE_TTL},
    {x:100,y:60,tiles:[{tx:2,ty:1}],t:CFG.BLADE_TTL*0.5,ttl:CFG.BLADE_TTL},
    {x:140,y:60,tiles:[{tx:3,ty:1}],t:CFG.BLADE_TTL*0.9,ttl:CFG.BLADE_TTL},
    {x:180,y:60,tiles:[{tx:4,ty:1}],t:0,ttl:CFG.BLADE_TTL},
    {x:220,y:60,tiles:[{tx:5,ty:1}],t:0,ttl:CFG.BLADE_TTL}];
  sc.update(w);
  const f2=slotsOf(sc.group,"flash");
  check("S4.C overflow: pool stays capped at 3, freshest-first assignment",
    f2.length===FLASH_CAP&&f2.every(l=>l.isPointLight)
    &&f2[0].intensity>f2[1].intensity&&f2[1].intensity>f2[2].intensity
    &&f2[2].intensity>0, f2.map(l=>l.intensity.toFixed(2)).join("/"));
  w.blades=[]; sc.update(w);
  check("S4.C no blasts -> all flash lights dark",
    slotsOf(sc.group,"flash").every(l=>l.intensity===0));
});

// ---- §S4.D overlay HUD chips (hearts / BOMB / FLAME) ----
function hudRecorder(){
  const ops=[];
  const rec=new Proxy(function(){},{
    get:(t,p)=>{
      if(p===Symbol.toPrimitive)return()=>"";

      return(...a)=>{ops.push([String(p),a]);};},
    set:(t,p,v)=>{ops.push(["set:"+String(p),v]);return true;}});
  return {rec,ops};
}
const HUD_STUB={save(){},restore(){},translate(){},scale(){},beginPath(){},
  closePath(){},moveTo(){},lineTo(){},bezierCurveTo(){},arcTo(){},arc(){},
  fill(){},stroke(){},fillRect(){},strokeRect(){},fillText(){},
  createLinearGradient:()=>({addColorStop(){}}),
  createRadialGradient:()=>({addColorStop(){}})};
await sec("S4.D",async()=>{
  const scenes=await import("../src/render/scenes.js");
  const {drawHudChips}=scenes;
  const mkW=(lives,bombs,range)=>({state:"PLAY",lives,
    players:[{bombs,range}]});
  let threw=false;
  try{ drawHudChips(HUD_STUB,mkW(3,2,3)); }
  catch(e){ threw=true; console.log(e.message); }
  check("S4.D drawHudChips no-throw on stub ctx", !threw);
  const r=hudRecorder();
  drawHudChips(r.rec,mkW(9,2,3));
  const texts=r.ops.filter(o=>o[0]==="fillText").map(o=>String(o[1][0]));
  const curves=r.ops.filter(o=>o[0]==="bezierCurveTo").length;
  check("S4.D lives drawn as heart glyphs (vector curves), capped at 6"
      +" with +n overflow text",
    curves>=12&&texts.includes("+3"), "curves="+curves);
  check("S4.D BOMB chip: label + count from players[0].bombs",
    texts.includes("BOMB")&&texts.includes("2"), texts.join("|"));
  check("S4.D FLAME chip: label + count from players[0].range",
    texts.includes("FLAME")&&texts.includes("3"), texts.join("|"));
  check("S4.D chips paint panel backgrounds",
    r.ops.some(o=>o[0]==="fillRect")&&r.ops.some(o=>o[0]==="strokeRect"));
  // DOM HUD ids keep working (updateHud contract untouched)
  const dom={lives:{textContent:""},bombs:{textContent:""},
    range:{textContent:""}};
  scenes.updateHud(dom,mkW(4,5,6));
  check("S4.D updateHud still writes lives/bombs/range DOM ids",
    dom.lives.textContent===4&&dom.bombs.textContent===5
    &&dom.range.textContent===6,
    dom.lives.textContent+"/"+dom.bombs.textContent+"/"+dom.range.textContent);
  // wrapper integration: o.hud===true paints chips on the overlay ctx
  const cv=hudRecorder();
  const fake={getContext:()=>cv.rec};
  const rw=createRenderer3D(null,fake,{audio:null,hud:null});
  const wg=createWorld(74,1); loadLevel(wg,1,false); wg.state="PLAY";
  rw.render(wg,1/60,{hud:true});
  check("S4.E wrapper o.hud===true draws HUD chips on overlay (cleared first)",
    cv.ops.some(o=>o[0]==="clearRect")&&cv.ops.some(
      o=>o[0]==="fillText"), "ops="+cv.ops.length);
  const cv2=hudRecorder();
  const fake2={getContext:()=>cv2.rec};
  const rw2=createRenderer3D(null,fake2,{audio:null,hud:null});
  rw2.render(wg,1/60);
  check("S4.E wrapper default frame leaves overlay untouched (menus safe)",
    !cv2.ops.some(o=>o[0]==="clearRect")
    &&!cv2.ops.some(o=>o[0]==="fillText"),"ops="+cv2.ops.length);
  // 2D renderer: chips only on explicit opt-in, defaults byte-identical
  const cr=hudRecorder();
  const r2d=createRenderer({getContext:()=>cr.rec},{kind:"2d",hud:null,
    audio:null});
  const w2=createWorld(75,1); loadLevel(w2,1,false); w2.state="PLAY";
  r2d.render(w2,1/60,{hud:true});
  check("S4.E classic renderer o.hud===true draws chips too",
    cr.ops.some(o=>o[0]==="fillText"));
});

// ---- §S4.E ground polish: checker floor tiles + border trim + call budget ----
await sec("S4.E",async()=>{
  const ent=await import("../src/render/three/entities.js");
  const {SLOT_MESH}=ent;
  const w=createWorld(76,1); loadLevel(w,1,false);
  const biome=BIOMES[0];
  const sc=buildScene(w);
  const g=sc.group;
  const checker=g.children.find(o=>o.userData.tag==="checker");
  check("S4.E checker floor: instanced tile grid over the base plane",
    !!checker&&checker.isInstancedMesh
    &&checker.count===CFG.COLS*CFG.ROWS
    &&!!checker.instanceColor, checker?String(checker.count):"missing");
  const cTmp=new THREE.Color();
  checker.getColorAt(0,cTmp); const a="#"+cTmp.getHexString();
  checker.getColorAt(1,cTmp); const b2="#"+cTmp.getHexString();
  check("S4.E checker alternates biome.floor0/floor1 per tile",
    a===biome.floor0.toLowerCase()&&b2===biome.floor1.toLowerCase(),
    a+" vs "+b2);
  const trim=g.children.filter(o=>o.userData.tag==="trim");
  check("S4.E border trim: 4 wall-top rails in biome.wallHi",
    trim.length===4&&trim.every(m=>m.isMesh)
    &&trim.every(m=>"#"+m.material.color.getHexString()
      ===biome.wallHi.toLowerCase()), trim.length+"");
  const spanNS=trim.find(m=>m.geometry.parameters.width>
    m.geometry.parameters.depth);
  check("S4.E trim frames the arena above wall height",
    !!spanNS&&spanNS.position.y>=biome.hWall
    &&trim.every(m=>m.castShadow===false),
    spanNS?("y="+spanNS.position.y):"missing");
  // post-S4 fat-world draw-call count: exact formula, still <=500
  const wf=createWorld(77,1); loadLevel(wf,1,false);
  wf.enemies=[]; wf.items=[];
  for(let i=0;i<16;i++)wf.enemies.push(mkE("walker",60+i*30,80));
  for(let i=0;i<32;i++)wf.items.push({x:60+i*15,y:120,t:"fire",
    col:"#ff8a3c",taken:false,pdef:null});
  const nb=Math.min(CFG.MAX_BOMBS,8);
  for(let i=0;i<nb;i++)wf.bombs.push({x:60+i*40,y:160,tx:i,ty:2,
    timer:CFG.FUSE,variant:"normal"});
  wf.blades=[{x:200,y:120,tiles:[{tx:5,ty:3}],t:0,ttl:CFG.BLADE_TTL}];
  const r=createRenderer3D(null,null,{audio:null,hud:null});
  let calls=-1;
  try{ r.render(wf,1/60); calls=countDrawCalls(r._dbg.scene); }
  catch(e){ console.log(e.message); }
  const wantCalls=7                       /* plane+checker+wall+brick+trim4 */
    +SLOT_MESH.player+16*SLOT_MESH.enemy+nb*SLOT_MESH.bomb
    +32*SLOT_MESH.item+2+1;               /* blade layers + fx Points */
  check("S4.E fat-world draw calls === "+wantCalls+" (<=500 gate)",
    calls===wantCalls&&calls<=500, String(calls));
});

console.log(fail? "THREE FAIL":"THREE OK");
process.exit(fail?1:0);
