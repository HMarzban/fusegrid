import {CFG, T, key, biomeOf} from "../../core/config.js";
import {PROJ, project} from "./camera.js";
import {drawItemBody, drawEnemyBody, drawPlayerBody, drawBombBody,
  drawBladeBody} from "../sprites.js";
import {getFx} from "../fx.js";

/* Painter list (spec §4.3): ONE depth-sorted draw list of floor + blocks +
   entities + fx together, so a tall block occludes an entity behind it and
   everything sits on a ground plane. depth = continuous gx+gy (entities use
   px/TILE so they never snap to tile centers); tier breaks equal-depth ties:
   floor(0) < entity/fx(1) < block(2) < blade(3).
   Extrusion convention: top face = footprint diamond shifted up by H
   (each corner sy -= H); visible south faces are front-left [top(W),top(S),S,W]
   and front-right [top(E),top(S),S,E].
   NOTE: blades do NOT pre-translate to the projected point — drawBladeBody
   self-translates to absolute coords inside its own save/restore; the other
   four bodies are relative art and DO get ctx.translate(projSx,projSy). */

export function byDepth(a,b){ return (a.depth-b.depth)||(a.tier-b.tier); }

/* shade("#rrggbb", f) -> "rgb(r,g,b)", each channel Math.round(v*f). */
export function shade(rgbHex,factor){
  const n=parseInt(rgbHex.slice(1),16);
  return "rgb("+Math.round((n>>16&255)*factor)+","+
    Math.round((n>>8&255)*factor)+","+Math.round((n&255)*factor)+")";
}

/* Biome gradient over the full 3D backing store. */
export function draw3dBackground(c,world){
  const b=biomeOf(world.level);
  const g=c.createLinearGradient(0,0,0,PROJ.canvasH);
  g.addColorStop(0,b.bg0); g.addColorStop(1,b.bg1);
  c.fillStyle=g; c.fillRect(0,0,PROJ.canvasW,PROJ.canvasH);
}

function quad(c,p0,p1,p2,p3){
  c.beginPath(); c.moveTo(p0.sx,p0.sy);
  c.lineTo(p1.sx,p1.sy); c.lineTo(p2.sx,p2.sy); c.lineTo(p3.sx,p3.sy);
  c.closePath();
}
const up=(p,h)=>({sx:p.sx,sy:p.sy-h});

function floorPainter(c,x,y,col){
  quad(c,project(x,y),project(x+1,y),project(x+1,y+1),project(x,y+1));
  c.fillStyle=col; c.fill();
}
function blockPainter(c,x,y,h,topCol,leftCol,rightCol){
  const N=project(x,y),E=project(x+1,y),S=project(x+1,y+1),W=project(x,y+1);
  const tN=up(N,h),tE=up(E,h),tS=up(S,h),tW=up(W,h);
  quad(c,tN,tE,tS,tW); c.fillStyle=topCol; c.fill();
  quad(c,tW,tS,S,W); c.fillStyle=leftCol; c.fill();
  quad(c,tE,tS,S,E); c.fillStyle=rightCol; c.fill();
}
function billboardPainter(c,gx,gy,world,body,bodyArg){
  const q=project(gx,gy);
  c.save(); c.translate(q.sx,q.sy); body(c,world,bodyArg); c.restore();
}

/* Complete painter list for the world, UNSORTED — the caller sorts with
   byDepth and runs each entry's draw(ctx) back-to-front. Live drawables
   only: skips taken items / dead enemies / non-alive players. fx particles
   come from the fx-module accessor (module-singleton storage). */
export function buildPainters(world){
  const ps=[];
  const b=biomeOf(world.level);
  for(let y=0;y<CFG.ROWS;y++)for(let x=0;x<CFG.COLS;x++)
    ps.push({depth:x+y,tier:0,
      draw:c=>floorPainter(c,x,y,((x+y)&1)?b.floor1:b.floor0)});
  for(let y=0;y<CFG.ROWS;y++)for(let x=0;x<CFG.COLS;x++){
    const t=world.grid[key(x,y)];
    if(t===T.WALL)
      ps.push({depth:x+y,tier:2,draw:c=>blockPainter(c,x,y,PROJ.WALL_H,
        b.wall,shade(b.wall,0.7),shade(b.wall,0.85))});
    else if(t===T.BRICK)
      ps.push({depth:x+y,tier:2,draw:c=>blockPainter(c,x,y,PROJ.BRICK_H,
        b.brickB,shade(b.brickB,0.7),shade(b.brickB,0.85))});
  }
  for(const it of world.items){ if(it.taken)continue;
    ps.push({depth:(it.x+it.y)/CFG.TILE,tier:1,
      draw:c=>billboardPainter(c,it.x/CFG.TILE,it.y/CFG.TILE,world,
        drawItemBody,it)});}
  for(const bm of world.bombs)
    ps.push({depth:(bm.x+bm.y)/CFG.TILE,tier:1,
      draw:c=>billboardPainter(c,bm.x/CFG.TILE,bm.y/CFG.TILE,world,
        drawBombBody,bm)});
  for(const bl of world.blades)for(const t of bl.tiles)
    ps.push({depth:t.tx+t.ty,tier:3,
      draw:c=>drawBladeBody(c,world,bl,t)});   // self-translating body
  for(const e of world.enemies){ if(e.dead)continue;
    ps.push({depth:(e.x+e.y)/CFG.TILE,tier:1,
      draw:c=>billboardPainter(c,e.x/CFG.TILE,e.y/CFG.TILE,world,
        drawEnemyBody,e)});}
  for(const p of world.players){ if(p.alive===false)continue;
    ps.push({depth:(p.x+p.y)/CFG.TILE,tier:1,
      draw:c=>billboardPainter(c,p.x/CFG.TILE,p.y/CFG.TILE,world,
        drawPlayerBody,p)});}
  for(const p of getFx()){
    const q=project(p.x/CFG.TILE,p.y/CFG.TILE);
    ps.push({depth:(p.x+p.y)/CFG.TILE,tier:1,draw:c=>{
      c.save(); c.globalAlpha=Math.max(0,1-p.t/p.life); c.fillStyle=p.color;
      c.fillRect(q.sx-p.size/2,q.sy-p.size/2,p.size,p.size); c.restore();}});
  }
  return ps;
}
