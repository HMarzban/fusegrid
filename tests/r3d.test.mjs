import {CFG, T, key, BIOMES} from "../src/core/config.js";
import {PROJ, project} from "../src/render/r3d/camera.js";
import {buildPainters, byDepth, shade, draw3dBackground,
  TIERS, diamondTransform, heightFor}
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
  check("195 floor painters (tier FLOOR)",
    cnt(TIERS.FLOOR)===195&&cnt(TIERS.FLOOR)===CFG.COLS*CFG.ROWS, cnt(0)+"");
  { // kind-aware tier-BLOCK: walls and bricks asserted separately (swap-invisible
    // in a combined total), each against a single-kind grid scan
    const onlyWalls={...w.grid}, onlyBricks={...w.grid};
    for(const k in onlyWalls) if(onlyWalls[k]===T.BRICK)onlyWalls[k]=T.EMPTY;
    for(const k in onlyBricks) if(onlyBricks[k]===T.WALL)onlyBricks[k]=T.EMPTY;
    const cw=buildPainters({...w,grid:onlyWalls})
      .filter(p=>p.tier===TIERS.BLOCK).length;
    const cb=buildPainters({...w,grid:onlyBricks})
      .filter(p=>p.tier===TIERS.BLOCK).length;
    check("every wall painter (tier BLOCK, walls-only grid)",cw===walls,
      cw+" vs "+walls);
    check("every brick painter (tier BLOCK, bricks-only grid)",cb===bricks,
      cb+" vs "+bricks);
  }
  check("every blade tile painter (tier BLADE)",
    cnt(TIERS.BLADE)===bladeTiles, cnt(TIERS.BLADE)+" vs "+bladeTiles);
  check("live items+bombs+enemies+player+fx painters (tier ENTITY)",
    cnt(TIERS.ENTITY)===liveIt+w.bombs.length+liveEn+1+getFx().length,
    cnt(TIERS.ENTITY)+" vs "+(liveIt+w.bombs.length+liveEn+1+getFx().length));
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
  check("live item present (d3 tENTITY)",has(3,TIERS.ENTITY,ps));
  check("taken item excluded (d6.5)",!has(6.5,TIERS.ENTITY,ps));
  check("enemy present (d7 tENTITY)",has(7,TIERS.ENTITY,ps));
  check("bomb present (d8.5 tENTITY)",has(8.5,TIERS.ENTITY,ps));
  check("both blade tiles present (d5,d6 tBLADE)",
    has(5,TIERS.BLADE,ps)&&has(6,TIERS.BLADE,ps));
  getFx().push({x:600,y:200,t:0,life:1,color:"#fff",size:4});
  ps=buildPainters(w);
  check("fx particle painter present (d20 tENTITY)",has(20,TIERS.ENTITY,ps));
  w.players[0].alive=false; ps=buildPainters(w);
  check("dead player excluded (d4.5)",!has(4.5,TIERS.ENTITY,ps));
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
    w.grid[key(5,5)]=T.WALL;              // depth 10 tier BLOCK
    w.grid[key(7,7)]=T.WALL;              // depth 14 tier BLOCK
    w.enemies.push({x:120,y:120,dead:false,r:10,color:"#fff",type:"walker",
      home:{x:3,y:3},speed:1.5});          // depth 6 tier ENTITY
    w.enemies.push({x:200,y:200,dead:false,r:10,color:"#fff",type:"walker",
      home:{x:5,y:5},speed:1.5});          // depth 10 == wall depth
    const s=[...buildPainters(w)].sort(byDepth);
    const idx=(depth,tier)=>s.findIndex(p=>p.depth===depth&&p.tier===tier);
    check("front wall (d14) sorts after back entity (d6)",
      idx(6,TIERS.ENTITY)<idx(14,TIERS.BLOCK),
      idx(6,TIERS.ENTITY)+" < "+idx(14,TIERS.BLOCK));
    check("behind-wall entity at EQUAL depth sorts before wall (occluded)",
      idx(10,TIERS.ENTITY)<idx(10,TIERS.BLOCK),
      idx(10,TIERS.ENTITY)+" < "+idx(10,TIERS.BLOCK));
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
  const bp=buildPainters(w).find(p=>p.tier===TIERS.BLADE);
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

// 12) menudraw.layout(): normalized fields sane for BOTH canvas sizes
{
  const {layout}=await import("../src/render/menudraw.js");
  for(const [W,H] of [[600,520],[608,352]]){
    const L=layout(W,H);
    check(`layout(${W},${H}) returns frozen object`, !!L&&Object.isFrozen(L));
    check(`layout(${W},${H}) all 11 numeric fields present`,
      ["cx","top","logoCy","logoScale","itemsY","itemH","footY",
       "chipW","chipGap","tableY","rowH"].every(k=>typeof L[k]==="number"),
      Object.keys(L).join(","));
    check(`layout(${W},${H}) cx==W/2 and top in (0,H*0.17)`,
      L.cx===W/2&&L.top>0&&L.top<H*0.17, L.cx+","+L.top);
    check(`layout(${W},${H}) logoCy in (0,H/2)`,
      L.logoCy>0&&L.logoCy<H*0.5, L.logoCy+"");
    check(`layout(${W},${H}) logoScale clamped [0.72,1.0]`,
      L.logoScale>=0.72&&L.logoScale<=1.0, L.logoScale+"");
    check(`layout(${W},${H}) itemsY within [0.45H,0.55H]; itemH int clamp [24,34]`,
      L.itemsY>=H*0.45&&L.itemsY<=H*0.55
        &&Number.isInteger(L.itemH)&&L.itemH>=24&&L.itemH<=34,
      L.itemsY+","+L.itemH);
    check(`layout(${W},${H}) footY==H-20; chipW 44; chipGap 14`,
      L.footY===H-20&&L.chipW===44&&L.chipGap===14,
      L.footY+","+L.chipW+","+L.chipGap);
    check(`layout(${W},${H}) tableY above itemsY; rowH>0`,
      L.tableY>0&&L.tableY<L.itemsY&&L.rowH>0, L.tableY+","+L.rowH);
  }
  check("logoScale clamps to 0.72 for short canvas", layout(400,200).logoScale===0.72,
    layout(400,200).logoScale+"");
}

// 13) menu/intro draw fns: Proxy-stub-canvas smoke at BOTH sizes (no throw)
{
  const md=await import("../src/render/menudraw.js");
  const {DEFAULT_SCORES}=await import("../src/app/highscores.js");
  initFx();
  const stub=new Proxy(function(){},{
    get:(t,p)=>(p===Symbol.toPrimitive?()=>"":stub),
    apply:()=>stub,set:()=>true});
  for(const [W,H] of [[600,520],[608,352]]){
    const L=md.layout(W,H);
    let ok=true;
    try{
      md.drawIntroChrome(stub,0.30,W,H);   // logo reveal beat
      md.drawIntroChrome(stub,2.00,W,H);   // mid-flyover
      md.drawIntroChrome(stub,4.60,W,H);   // settle/tagline beat
      md.drawMenu(stub,{cursor:2,enterT:0.50,
        items:["START GAME","LEVEL SELECT","RENDER 3D","SOUND OFF",
               "HOW TO PLAY","HIGH SCORES"]},L,0.50);
      md.drawLevelSelect(stub,3,L,0.40);
      md.drawHowTo(stub,L,0.40);
      md.drawScores(stub,DEFAULT_SCORES,L,0.40);
      md.drawDim(stub,0.62,W,H);
      md.drawFade(stub,0.50,W,H);
    }catch(e){ ok=false; console.log(W+"x"+H+" smoke:",e.message); }
    check(`all menu draw fns no-throw on stub ctx at ${W}x${H}`,ok);
  }
}

// 14) textured tops: diamondTransform matrix (spec §2 worked vector),
//     exact corner mapping, parallelogram closure over tiles x heights
{
  const up=(p,h)=>({sx:p.sx,sy:p.sy-h});
  const tN=up(project(5,5),24),tE=up(project(6,5),24),
        tW=up(project(5,6),24),tS=up(project(6,6),24);
  check("worked-example top corners tN/tE/tW/tS",
    tN.sx===284&&tN.sy===124&&tE.sx===304&&tE.sy===134&&
    tW.sx===264&&tW.sy===134&&tS.sx===284&&tS.sy===144,
    JSON.stringify([tN,tE,tW,tS]));
  const m=diamondTransform(tN,tE,tW);
  check("diamondTransform -> {a:.5,b:.25,c:-.5,d:.25,e:284,f:124}",
    m.a===0.5&&m.b===0.25&&m.c===-0.5&&m.d===0.25&&m.e===284&&m.f===124,
    JSON.stringify(m));
  const ap=(mm,u,v)=>({sx:mm.a*u+mm.c*v+mm.e,sy:mm.b*u+mm.d*v+mm.f});
  const cN=ap(m,0,0),cE=ap(m,CFG.TILE,0),cW=ap(m,0,CFG.TILE),
        cS=ap(m,CFG.TILE,CFG.TILE);
  check("source corners land exactly on tN/tE/tW/tS",
    cN.sx===tN.sx&&cN.sy===tN.sy&&cE.sx===tE.sx&&cE.sy===tE.sy&&
    cW.sx===tW.sx&&cW.sy===tW.sy&&cS.sx===tS.sx&&cS.sy===tS.sy);
  let closure=true;
  for(const h of [heightFor(1,true),heightFor(1,false)])
    for(const [tx,ty] of [[0,0],[1,1],[2,3],[5,5],[7,2],[3,7],
        [14,12],[6,6],[2,9],[9,2],[13,1],[1,13]]){
      const n=up(project(tx,ty),h),e=up(project(tx+1,ty),h),
            w2=up(project(tx,ty+1),h),s2=up(project(tx+1,ty+1),h);
      if(e.sx+w2.sx-s2.sx!==n.sx||e.sy+w2.sy-s2.sy!==n.sy)closure=false;
    }
  check("parallelogram closure tS===tE+tW-tN (12 tiles x 2 heights)",closure);
}

// 15) per-biome heights: consumption, ??-fallback, PROJ/freeze invariants
{
  check("heightFor JUNGLE 24/14",
    heightFor(1,true)===24&&heightFor(1,false)===14,
    heightFor(1,true)+"/"+heightFor(1,false));
  check("heightFor ICE 30/18",
    heightFor(2,true)===30&&heightFor(2,false)===18,
    heightFor(2,true)+"/"+heightFor(2,false));
  check("heightFor FACTORY 18/10",
    heightFor(3,true)===18&&heightFor(3,false)===10,
    heightFor(3,true)+"/"+heightFor(3,false));
  check("heightFor ARENA 26/15",
    heightFor(4,true)===26&&heightFor(4,false)===15,
    heightFor(4,true)+"/"+heightFor(4,false));
  const b=BIOMES[0],sw=b.hWall,sb=b.hBrick;
  delete b.hWall; delete b.hBrick;
  const fb=heightFor(1,true)===PROJ.WALL_H&&heightFor(1,false)===PROJ.BRICK_H;
  b.hWall=sw; b.hBrick=sb;
  check("field-less biome falls back to PROJ.WALL_H/BRICK_H",fb);
  check("fallback restore",heightFor(1,true)===24&&heightFor(1,false)===14);
  const snap='{"TILE_W":40,"TILE_H":20,"WALL_H":24,"BRICK_H":14,'+
    '"PAD":24,"OFF_X":284,"OFF_Y":48,"canvasW":608,"canvasH":352}';
  check("camera.PROJ byte-snapshot unchanged (spec §4: camera untouched)",
    JSON.stringify(PROJ)===snap, JSON.stringify(PROJ));
  check("PROJ and BIOMES frozen",
    Object.isFrozen(PROJ)&&Object.isFrozen(BIOMES));
}

// 16) shadow tier: per-depth-slot ordering + one-shadow-per-caster counts.
//     Spec §3's GLOBAL chain (lastShadowIdx < firstEntityIdx < firstBlockIdx)
//     is unsatisfiable together with its own other pins ("comparator byDepth
//     untouched" + "shadow.depth = caster depth exactly"): v1 occlusion
//     REQUIRES entities/blocks interleaved by depth across slots (pinned by
//     check 7 — the depth-0 border wall sorts before any player entity). The
//     construction-correct invariant pinned here: at EVERY depth slot the
//     shadow paints after that slot's floor plane and before that slot's
//     entity/block/blade geometry.
{
  initFx();
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
  const aliveP=w.players.filter(p=>p.alive!==false).length;
  const s=[...buildPainters(w)].sort(byDepth);
  const slots=new Map();
  s.forEach((p,i)=>{
    let m=slots.get(p.depth);
    if(!m){m={};slots.set(p.depth,m);}
    (m[p.tier]||(m[p.tier]=[])).push(i);
  });
  let band=true,bad="";
  for(const [d,m] of slots){
    if(!m[TIERS.SHADOW])continue;
    const fMax=Math.max(...(m[TIERS.FLOOR]||[-1]));
    const sMin=Math.min(...m[TIERS.SHADOW]);
    const uMin=Math.min(...[].concat(m[TIERS.ENTITY]||[],m[TIERS.BLOCK]||[],
      m[TIERS.BLADE]||[]));
    if(!(fMax<sMin&&sMin<uMin)){band=false;bad="depth "+d+": "+
      fMax+"<"+sMin+"<"+uMin;}
  }
  check("every shadow sorts floor<shadow<upper within its depth slot",
    band,bad);
  const sh=s.filter(p=>p.tier===TIERS.SHADOW).length;
  const want=walls+bricks+liveEn+w.bombs.length+liveIt+aliveP;
  check("one shadow per caster (walls+bricks+enemies+bombs+items+players)",
    sh===want, sh+" vs "+want);
}
{
  initFx();
  const w={seed:1,level:1,time:0,
    grid:new Array(CFG.COLS*CFG.ROWS).fill(T.EMPTY),
    players:[],enemies:[],bombs:[],items:[],
    blades:[{ttl:CFG.BLADE_TTL,t:0.1,tiles:[{tx:2,ty:2}]}]};
  getFx().push({x:300,y:200,t:0,life:1,color:"#fff",size:4});
  check("blades/fx-only world casts zero shadows",
    buildPainters(w).every(p=>p.tier!==TIERS.SHADOW));
}

// 17) painter budget: total <= 2x the v1 formula count for the same world
{
  initFx();
  const w=createWorld(7,1); loadLevel(w,1,false);
  w.bombs.push({x:140,y:200,timer:CFG.FUSE,variant:"normal"});
  w.blades.push({ttl:CFG.BLADE_TTL,t:0.05,
    tiles:[{tx:1,ty:1},{tx:2,ty:1},{tx:1,ty:2}]});
  getFx().push({x:320,y:240,t:0.1,life:1,color:"#ffffff",size:4});
  let blocks=0;
  for(let y=0;y<CFG.ROWS;y++)for(let x=0;x<CFG.COLS;x++){
    const t=w.grid[key(x,y)];
    if(t===T.WALL||t===T.BRICK)blocks++;
  }
  const liveIt=w.items.filter(i=>!i.taken).length;
  const liveEn=w.enemies.filter(e=>!e.dead).length;
  const aliveP=w.players.filter(p=>p.alive!==false).length;
  const bladeTiles=w.blades.reduce((n,bl)=>n+bl.tiles.length,0);
  const v1=CFG.COLS*CFG.ROWS+blocks+liveIt+w.bombs.length+liveEn+
    aliveP+getFx().length+bladeTiles;
  const total=buildPainters(w).length;
  check("total painters <= 2x v1 count",total<=2*v1,total+" <= "+2*v1);
}

console.log("\n  R3D RESULT: "+pass+" PASS / "+fail+" FAIL");
process.exit(fail?1:0);
