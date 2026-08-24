/* REAL-3D S1 (spec 2026-08-24-real3d-design §2/§4/§6/§7): Node-only checks —
   vendor import, frozen light rig, biome materials, buildScene instanced
   counts vs grid scan + brick rescan/rebuild, camrig math, wrapper surface,
   renderer "iso" alias, headless createGame surface. No DOM anywhere. */
import {createLights} from "../src/render/three/lights.js";
import {build} from "../src/render/three/materials.js";
import {buildScene} from "../src/render/three/scene.js";
import {createRig, orbitBy, dollBy, resetOrbit, applyOrbit,
  SHAKE_3D_K} from "../src/render/three/camrig.js";
import {createRenderer3D} from "../src/render/three/wrapper.js";
import {createRenderer} from "../src/render/renderer.js";
import {createWorld, loadLevel} from "../src/core/sim.js";
import {CFG, T, BIOMES} from "../src/core/config.js";
import {createGame} from "../src/main.js";
import * as THREE from "../vendor/three.module.js";

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

console.log(fail? "THREE FAIL":"THREE OK");
process.exit(fail?1:0);
