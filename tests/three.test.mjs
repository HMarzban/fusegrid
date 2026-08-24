/* REAL-3D S1+S2 (spec 2026-08-24-real3d-design §2/§4/§5/§6/§7): Node-only
   checks — vendor import, frozen light rig, biome materials, buildScene
   instanced counts vs grid scan + brick rescan/rebuild, camrig math, wrapper
   surface, renderer "iso" alias, headless createGame surface; S2 adds entity
   pool counts/visibility vs world sets, px->world transform sync, facing
   rotation, invuln flicker, bomb pulse/tint, blade ttl fade, per-type enemy
   variants + identity colors, zero-asset texture-source probes, and the
   sim/net/input purity grep gate. No DOM anywhere. */
import {createLights} from "../src/render/three/lights.js";
import {build} from "../src/render/three/materials.js";
import {buildScene} from "../src/render/three/scene.js";
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

console.log(fail? "THREE FAIL":"THREE OK");
process.exit(fail?1:0);
