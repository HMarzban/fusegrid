import {CFG} from "../src/core/config.js";
import {PROJ, project} from "../src/render/r3d/camera.js";

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

console.log("\n  R3D RESULT: "+pass+" PASS / "+fail+" FAIL");
process.exit(fail?1:0);
