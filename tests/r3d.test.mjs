import {CFG, T, key} from "../src/core/config.js";
import {PROJ, project} from "../src/render/r3d/camera.js";
import {buildPainters, byDepth, shade, draw3dBackground}
  from "../src/render/r3d/scene3d.js";
import {createWorld, loadLevel} from "../src/core/sim.js";
import {initFx, getFx} from "../src/render/fx.js";
import {createRenderer} from "../src/render/renderer.js";

let pass=0, fail=0;
function check(name, cond, detail){ cond?pass++:fail++;
  console.log((cond?"  PASS ":"  FAIL ")+name+(detail!==undefined?" -> "+detail:"")); }

// 1) known tile corner maps to known screen point
{
  const p=project(0,0);
  check("project(0,0) -> {sx:284, sy:48}", p.sx===284 && p.sy===48,
    JSON.stringify(p));
}

// 2) drawn board bbox centered by OFF_X/OFF_Y:
//    sx offsets in [-260,300], sy offsets in [0,280]; PAD margins all round
{
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(let gx=0;gx<=CFG.COLS;gx++)for(let gy=0;gy<=CFG.ROWS;gy++){
    const {sx,sy}=project(gx,gy);
    if(sx<minX)minX=sx; if(sx>maxX)maxX=sx;
    if(sy<minY)minY=sy; if(sy>maxY)maxY=sy;
  }
  const sxLo=minX-PROJ.OFF_X, sxHi=maxX-PROJ.OFF_X;
  const syLo=minY-PROJ.OFF_Y, syHi=maxY-PROJ.OFF_Y;
  check("bbox sx extents == [-260,+300]",
    sxLo===-260 && sxHi===300, sxLo+".."+sxHi);
  check("bbox sy extents == [0,+280]",
    syLo===0 && syHi===280, syLo+".."+syHi);
  check("left margin == PAD", minX===PROJ.PAD, minX+"");
  check("right margin == PAD", PROJ.canvasW-maxX===PROJ.PAD, (PROJ.canvasW-maxX)+"");
  check("bottom margin == PAD", PROJ.canvasH-maxY===PROJ.PAD, (PROJ.canvasH-maxY)+"");
  check("top wall top == PAD", minY-PROJ.WALL_H===PROJ.PAD, (minY-PROJ.WALL_H)+"");
}

// 3) sy is monotonic in gx+gy (diagonal scan over all tile corners)
{
  let mono=true, prev=-Infinity;
  for(let s=0;s<=CFG.COLS+CFG.ROWS;s++)
    for(let gx=Math.max(0,s-CFG.ROWS);gx<=Math.min(CFG.COLS,s);gx++){
      const sy=project(gx,s-gx).sy;
      if(sy<prev) mono=false;
      prev=sy;
    }
  check("sy monotonic in gx+gy", mono, "max sy "+prev);
}

// 4) margin equations: top wall never clipped, bottom margin exactly PAD
{
  const halfH=(CFG.COLS+CFG.ROWS)*PROJ.TILE_H/2;
  check("OFF_Y >= WALL_H (top not clipped)", PROJ.OFF_Y>=PROJ.WALL_H,
    PROJ.OFF_Y+">="+PROJ.WALL_H);
  check("canvasH - ((COLS+ROWS)*TILE_H/2 + OFF_Y) == PAD",
    PROJ.canvasH-(halfH+PROJ.OFF_Y)===PROJ.PAD,
    (PROJ.canvasH-(halfH+PROJ.OFF_Y))+" vs "+PROJ.PAD);
}

// 5) painter list completeness vs filtered world sets (real loaded world)
initFx();
{
  const w=createWorld(7,1); loadLevel(w,1,false);
  w.bombs.push({x:140,y:200,timer:CFG.FUSE,variant:"normal"});
  w.blades.push({ttl:CFG.BLADE_TTL,t:0.05,
    tiles:[{tx:1,ty:1},{tx:2,ty:1},{tx:1,ty:2}]});
  getFx().push({x:320,y:240,t:0.1,life:1,color:"#ffffff",size:4},
               {x:480,y:160,t:0.2,life:1,color:"#f0f",size:3});
  let walls=0,bricks=0;
  for(let y=0;y<CFG.ROWS;y++)for(let x=0;x<CFG.COLS;x++){
    const t=w.grid[key(x,y)];
    if(t===T.WALL)walls++; else if(t===T.BRICK)bricks++;
  }
  const liveIt=w.items.filter(i=>!i.taken).length;
  const liveEn=w.enemies.filter(e=>!e.dead).length;
  const bladeTiles=w.blades.reduce((n,bl)=>n+bl.tiles.length,0);
  const ps=buildPainters(w);
  const cnt=t=>ps.filter(p=>p.tier===t).length;
  check("195 floor painters (tier 0)",
    cnt(0)===195&&cnt(0)===CFG.COLS*CFG.ROWS, cnt(0)+"");
  { // kind-aware tier-2: walls and bricks asserted separately (swap-invisible
    // in a combined total), each against a single-kind grid scan
    const onlyWalls={...w.grid}, onlyBricks={...w.grid};
    for(const k in onlyWalls) if(onlyWalls[k]===T.BRICK)onlyWalls[k]=T.EMPTY;
    for(const k in onlyBricks) if(onlyBricks[k]===T.WALL)onlyBricks[k]=T.EMPTY;
    const cw=buildPainters({...w,grid:onlyWalls}).filter(p=>p.tier===2).length;
    const cb=buildPainters({...w,grid:onlyBricks}).filter(p=>p.tier===2).length;
    check("every wall painter (tier 2, walls-only grid)",cw===walls,cw+" vs "+walls);
    check("every brick painter (tier 2, bricks-only grid)",cb===bricks,cb+" vs "+bricks);
  }
  check("every blade tile painter (tier 3)",
    cnt(3)===bladeTiles, cnt(3)+" vs "+bladeTiles);
  check("live items+bombs+enemies+player+fx painters (tier 1)",
    cnt(1)===liveIt+w.bombs.length+liveEn+1+getFx().length,
    cnt(1)+" vs "+(liveIt+w.bombs.length+liveEn+1+getFx().length));
}

// 6) liveness exclusions + per-kind presence (synthetic world)
{
  initFx();
  const w={seed:1,level:1,time:0,
    grid:new Array(CFG.COLS*CFG.ROWS).fill(T.EMPTY),
    players:[{x:100,y:80,alive:true,face:{x:0,y:0},iFrames:0}],
    enemies:[{x:120,y:160,dead:false,r:10,color:"#fff",type:"walker",
      home:{x:3,y:4},speed:1.5}],
    bombs:[{x:140,y:200,timer:CFG.FUSE,variant:"normal"}],
    blades:[{ttl:CFG.BLADE_TTL,t:0.1,tiles:[{tx:2,ty:3},{tx:3,ty:3}]}],
    items:[{x:60,y:60,t:"fire",col:"#ff5d73",taken:false},
           {x:200,y:60,t:"heart",col:"#ff5d73",taken:true}]};
  let ps=buildPainters(w);
  const has=(depth,tier,list)=>list.some(p=>p.depth===depth&&p.tier===tier);
  check("live item present (d3 t1)",has(3,1,ps));
  check("taken item excluded (d6.5)",!has(6.5,1,ps));
  check("enemy present (d7 t1)",has(7,1,ps));
  check("bomb present (d8.5 t1)",has(8.5,1,ps));
  check("both blade tiles present (d5,d6 t3)",has(5,3,ps)&&has(6,3,ps));
  getFx().push({x:600,y:200,t:0,life:1,color:"#fff",size:4});
  ps=buildPainters(w);
  check("fx particle painter present (d20 t1)",has(20,1,ps));
  w.players[0].alive=false; ps=buildPainters(w);
  check("dead player excluded (d4.5)",!has(4.5,1,ps));
}

// 7) sort semantics: (depth,tier), occlusion at equal depth
{
  initFx();
  const mk=()=>({seed:1,level:1,time:0,
    grid:new Array(CFG.COLS*CFG.ROWS).fill(T.EMPTY),
    players:[],enemies:[],bombs:[],blades:[],items:[]});
  {
    const w=mk();
    const ps=buildPainters(w);
    const seq=a=>a.map(p=>p.depth+"."+p.tier);
    const s1=[...ps].sort(byDepth);
    const s2=[...ps].reverse().sort(byDepth);
    check("(depth,tier) sort independent of input order",
      JSON.stringify(seq(s1))===JSON.stringify(seq(s2)));
    let mono=true;
    for(let i=1;i<s1.length;i++){
      const a=s1[i-1],b=s1[i];
      if(b.depth<a.depth||(b.depth===a.depth&&b.tier<a.tier))mono=false;
    }
    check("sorted list non-decreasing in (depth,tier)",mono);
  }
  {
    const w=mk();
    w.grid[key(5,5)]=T.WALL;              // depth 10 tier 2
    w.grid[key(7,7)]=T.WALL;              // depth 14 tier 2
    w.enemies.push({x:120,y:120,dead:false,r:10,color:"#fff",type:"walker",
      home:{x:3,y:3},speed:1.5});          // depth 6 tier 1
    w.enemies.push({x:200,y:200,dead:false,r:10,color:"#fff",type:"walker",
      home:{x:5,y:5},speed:1.5});          // depth 10 == wall depth
    const s=[...buildPainters(w)].sort(byDepth);
    const idx=(depth,tier)=>s.findIndex(p=>p.depth===depth&&p.tier===tier);
    check("front wall (d14) sorts after back entity (d6)",
      idx(6,1)<idx(14,2), idx(6,1)+" < "+idx(14,2));
    check("behind-wall entity at EQUAL depth sorts before wall (occluded)",
      idx(10,1)<idx(10,2), idx(10,1)+" < "+idx(10,2));
  }
}

// 8) shade(): channel-wise Math.round(v*factor), darker output
{
  const s=shade("#ffffff",0.7);
  const m=s.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
  const exp=Math.round(255*0.7);
  check('shade("#ffffff",0.7) -> darker "rgb(r,g,b)"',
    !!m&&+m[1]===exp&&+m[2]===exp&&+m[3]===exp&&+m[1]<255, s);
  check('shade("#ff8000",0.5) -> "rgb('+Math.round(255*0.5)+','+
    Math.round(128*0.5)+',0)"',
    shade("#ff8000",0.5)==="rgb("+Math.round(255*0.5)+","+
    Math.round(128*0.5)+",0)", shade("#ff8000",0.5));
}

// 9) draw3dBackground + every painter draw no-throw on universal stub ctx
{
  initFx();
  const stub=new Proxy(function(){},{
    get:(t,p)=>(p===Symbol.toPrimitive?()=>"":stub),
    apply:()=>stub,set:()=>true});
  const w=createWorld(7,1); loadLevel(w,1,false);
  getFx().push({x:320,y:240,t:0.1,life:1,color:"#fff",size:4});
  let ok=true;
  try{
    draw3dBackground(stub,w);
    for(const p of buildPainters(w).sort(byDepth)) p.draw(stub);
  }catch(e){ ok=false; console.log(e.message); }
  check("draw3dBackground + every painter draw no-throw on stub ctx",ok);
}

// 10) blade billboards: painter pre-translates to the projected tile center
//     project(2.5,2.5) = {sx:(2.5-2.5)*20+284=284, sy:(2.5+2.5)*10+48=98}
{
  initFx();
  const w={seed:1,level:1,time:0,
    grid:new Array(CFG.COLS*CFG.ROWS).fill(T.EMPTY),
    players:[],enemies:[],bombs:[],items:[],
    blades:[{ttl:CFG.BLADE_TTL,t:0.1,tiles:[{tx:2,ty:2}]}]};
  const bp=buildPainters(w).find(p=>p.tier===3);
  const calls=[];
  const spy=new Proxy(function(){},{
    get:(t,p)=>{
      if(p===Symbol.toPrimitive)return()=>"" ;
      if(p==="translate")return(...a)=>calls.push(a);
      return spy;
    },
    apply:()=>spy,set:()=>true});
  let ok=true;
  try{ bp.draw(spy); }catch(e){ ok=false; console.log(e.message); }
  const q=project(2.5,2.5);
  const hits=calls.filter(a=>a[0]===q.sx&&a[1]===q.sy).length;
  check("blade painter billboards at project(tx+.5,ty+.5) (exactly once)",
    ok&&hits===1&&calls.length===1,
    "translate calls "+JSON.stringify(calls)+" want exactly 1 at ("+q.sx+","+q.sy+")");
}

// 11) headless render smoke (spec §6 step 7): full createRenderer pipeline,
//     both kinds, non-PLAY state (loadLevel leaves state="MENU") so the
//     drawOverlay/drawLogo parameter path is exercised; assert no throw.
{
  initFx();
  const stub=new Proxy(function(){},{
    get:(t,p)=>(p===Symbol.toPrimitive?()=>"":stub),
    apply:()=>stub,set:()=>true});
  const fakeCanvas={getContext:()=>stub};
  const w=createWorld(7,1); loadLevel(w,1,false);
  let ok2=true, ok3=true;
  try{ createRenderer(fakeCanvas,{kind:"2d"}).render(w); }
  catch(e){ ok2=false; console.log("2d smoke:",e.message); }
  try{ createRenderer(fakeCanvas,{kind:"3d"}).render(w); }
  catch(e){ ok3=false; console.log("3d smoke:",e.message); }
  check('createRenderer(fake,{kind:"2d"}).render(MENU world) no-throw',ok2);
  check('createRenderer(fake,{kind:"3d"}).render(MENU world) no-throw',ok3);
}

console.log("\n  R3D RESULT: "+pass+" PASS / "+fail+" FAIL");
process.exit(fail?1:0);
