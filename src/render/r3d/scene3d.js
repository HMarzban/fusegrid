import {CFG, T, key, biomeOf, BIOMES} from "../../core/config.js";
import {PROJ, project} from "./camera.js";
import {drawItemBody, drawEnemyBody, drawPlayerBody, drawBombBody,
  drawBladeBody, bakedTile, canMakeCanvas} from "../sprites.js";
import {getFx} from "../fx.js";

/* Painter list (spec §4.3): ONE depth-sorted draw list of floor + shadows +
   blocks + entities + fx together, so a tall block occludes an entity behind
   it and everything sits on a ground plane. depth = continuous gx+gy
   (entities use px/TILE so they never snap to tile centers); tiers via TIERS
   break equal-depth ties: floor(0) < shadow(1) < entity/fx(2) < block(3) <
   blade(4). Shadows carry their CASTER's depth exactly: at every depth slot
   the shadow paints after that slot's floor plane and before its entities/
   blocks/blade tops, so a shadow never lifts off its caster's ground cell;
   fringes of strictly-behind (lower-depth) geometry may catch a shadow edge
   — same accepted-stylization class as v1's fx/blade notes (global banding
   would require either an inconsistent comparator or dropping depth-primary
   occlusion). Textured tops (spec §2): when the biome tile is baked, the top
   face is the standalone BAKED canvas mapped through the affine
   diamondTransform(...) with smoothing re-enabled inside save/restore; flat
   quads remain only as the headless fallback (!BAKED.ready). Soft shadows:
   one lazy 64x64 radial disc reused by every shadowPainter as an axis-
   aligned ellipse drawImage. Biome heights (spec §4): BIOMES hWall/hBrick
   via heightFor (?? PROJ).
   Extrusion convention: top face = footprint diamond shifted up by H
   (each corner sy -= H); visible south faces are front-left [top(W),top(S),S,W]
   and front-right [top(E),top(S),S,E].
   All five sprite bodies are translate-free relative art; billboardPainter
   pre-translates to the projected point and calls the body inside
   save/restore (blade tiles anchor at their center: tx+.5, ty+.5). */

export const TIERS=Object.freeze({FLOOR:0,SHADOW:1,ENTITY:2,BLOCK:3,BLADE:4});

export function byDepth(a,b){ return (a.depth-b.depth)||(a.tier-b.tier); }

/* Affine map of source pixel space (u,v) of a CFG.TILE-square onto the
   extruded top-face parallelogram with corners (0,0)->tN, (TILE,0)->tE,
   (0,TILE)->tW ((TILE,TILE)->tS follows from parallelogram closure). Pure. */
export function diamondTransform(tN,tE,tW){
  return {a:(tE.sx-tN.sx)/CFG.TILE, b:(tE.sy-tN.sy)/CFG.TILE,
    c:(tW.sx-tN.sx)/CFG.TILE, d:(tW.sy-tN.sy)/CFG.TILE,
    e:tN.sx, f:tN.sy};
}

/* Per-biome extrusion height (spec §4); ?? guards field-less biomes. */
export function heightFor(level,isWall){
  const b=biomeOf(level);
  return isWall?(b.hWall??PROJ.WALL_H):(b.hBrick??PROJ.BRICK_H);
}

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
function blockPainter(c,x,y,h,topCol,leftCol,rightCol,src){
  const N=project(x,y),E=project(x+1,y),S=project(x+1,y+1),W=project(x,y+1);
  const tN=up(N,h),tE=up(E,h),tS=up(S,h),tW=up(W,h);
  if(src&&c.transform){
    c.save();
    if(c.imageSmoothingEnabled!==undefined)c.imageSmoothingEnabled=true;
    const m=diamondTransform(tN,tE,tW);
    c.transform(m.a,m.b,m.c,m.d,m.e,m.f);
    c.drawImage(src,0,0);
    c.restore();
  }else{
    quad(c,tN,tE,tS,tW); c.fillStyle=topCol; c.fill();
  }
  quad(c,tW,tS,S,W); c.fillStyle=leftCol; c.fill();
  quad(c,tE,tS,S,E); c.fillStyle=rightCol; c.fill();
}
function billboardPainter(c,gx,gy,world,body,...rest){
  const q=project(gx,gy);
  c.save(); c.translate(q.sx,q.sy); body(c,world,...rest); c.restore();
}

/* One lazy soft disc (spec §3): 64x64 radial gradient, built on first use
   when canvases are available; null headless — shadow painters skip. */
let SHADOW_DISC;
function shadowDisc(){
  if(SHADOW_DISC===undefined){
    SHADOW_DISC=null;
    if(canMakeCanvas()){
      const el=document.createElement("canvas");
      el.width=64; el.height=64;
      const cc=el.getContext("2d");
      const g=cc.createRadialGradient(32,32,4,32,32,32);
      g.addColorStop(0,"rgba(0,0,0,.5)"); g.addColorStop(1,"rgba(0,0,0,0)");
      cc.fillStyle=g; cc.fillRect(0,0,64,64);
      SHADOW_DISC=el;
    }
  }
  return SHADOW_DISC;
}
function shadowPainter(c,cx,cy,rx,ry,alpha){
  const d=shadowDisc();
  if(!d)return;
  c.save(); c.globalAlpha=alpha;
  c.drawImage(d,cx-rx,cy-ry,rx*2,ry*2);
  c.restore();
}

/* Shadow entry: rides its caster's depth slot (see header note). */
const shadowEntry=(depth,cx,cy,rx,ry,alpha)=>({depth,tier:TIERS.SHADOW,
  draw:c=>shadowPainter(c,cx,cy,rx,ry,alpha)});
const blockShadow=(ps,x,y)=>{
  const N=project(x,y),S=project(x+1,y+1);
  ps.push(shadowEntry(x+y,(N.sx+S.sx)/2,(N.sy+S.sy)/2,
    PROJ.TILE_W*0.44,PROJ.TILE_H*0.44,0.22));
};
const entShadow=(ps,gx,gy,r)=>{
  const q=project(gx,gy),rx=r*0.95;
  ps.push(shadowEntry((gx+gy)*CFG.TILE,q.sx,q.sy,rx,rx*0.5,0.26));
};

/* Complete painter list for the world, UNSORTED — the caller sorts with
   byDepth and runs each entry's draw(ctx) back-to-front. Live drawables
   only: skips taken items / dead enemies / non-alive players. fx particles
   come from the fx-module accessor (module-singleton storage). Blades and
   fx cast no shadow (transient). */
export function buildPainters(world){
  const ps=[];
  const b=biomeOf(world.level);
  const bi=(Math.max(1,world.level)-1)%BIOMES.length;
  const wSrc=bakedTile(bi,"wall"), kSrc=bakedTile(bi,"brick");
  for(let y=0;y<CFG.ROWS;y++)for(let x=0;x<CFG.COLS;x++)
    ps.push({depth:x+y,tier:TIERS.FLOOR,
      draw:c=>floorPainter(c,x,y,((x+y)&1)?b.floor1:b.floor0)});
  for(let y=0;y<CFG.ROWS;y++)for(let x=0;x<CFG.COLS;x++){
    const t=world.grid[key(x,y)];
    if(t===T.WALL){
      blockShadow(ps,x,y);
      ps.push({depth:x+y,tier:TIERS.BLOCK,draw:c=>blockPainter(c,x,y,
        heightFor(world.level,true),
        b.wall,shade(b.wall,0.7),shade(b.wall,0.85),wSrc)});
    }else if(t===T.BRICK){
      blockShadow(ps,x,y);
      ps.push({depth:x+y,tier:TIERS.BLOCK,draw:c=>blockPainter(c,x,y,
        heightFor(world.level,false),
        b.brickB,shade(b.brickB,0.7),shade(b.brickB,0.85),kSrc)});
    }
  }
  for(const it of world.items){ if(it.taken)continue;
    entShadow(ps,it.x/CFG.TILE,it.y/CFG.TILE,CFG.TILE*0.30);
    ps.push({depth:(it.x+it.y)/CFG.TILE,tier:TIERS.ENTITY,
      draw:c=>billboardPainter(c,it.x/CFG.TILE,it.y/CFG.TILE,world,
        drawItemBody,it)});}
  for(const bm of world.bombs){
    entShadow(ps,bm.x/CFG.TILE,bm.y/CFG.TILE,CFG.TILE*0.30);
    ps.push({depth:(bm.x+bm.y)/CFG.TILE,tier:TIERS.ENTITY,
      draw:c=>billboardPainter(c,bm.x/CFG.TILE,bm.y/CFG.TILE,world,
        drawBombBody,bm)});}
  for(const bl of world.blades)for(const t of bl.tiles)
    ps.push({depth:t.tx+t.ty,tier:TIERS.BLADE,
      draw:c=>billboardPainter(c,t.tx+0.5,t.ty+0.5,world,drawBladeBody,bl,t)});
  for(const e of world.enemies){ if(e.dead)continue;
    entShadow(ps,e.x/CFG.TILE,e.y/CFG.TILE,e.r);
    ps.push({depth:(e.x+e.y)/CFG.TILE,tier:TIERS.ENTITY,
      draw:c=>billboardPainter(c,e.x/CFG.TILE,e.y/CFG.TILE,world,
        drawEnemyBody,e)});}
  for(const p of world.players){ if(p.alive===false)continue;
    entShadow(ps,p.x/CFG.TILE,p.y/CFG.TILE,CFG.TILE*0.36);
    ps.push({depth:(p.x+p.y)/CFG.TILE,tier:TIERS.ENTITY,
      draw:c=>billboardPainter(c,p.x/CFG.TILE,p.y/CFG.TILE,world,
        drawPlayerBody,p)});}
  for(const p of getFx()){
    const q=project(p.x/CFG.TILE,p.y/CFG.TILE);
    ps.push({depth:(p.x+p.y)/CFG.TILE,tier:TIERS.ENTITY,draw:c=>{
      c.save(); c.globalAlpha=Math.max(0,1-p.t/p.life); c.fillStyle=p.color;
      c.fillRect(q.sx-p.size/2,q.sy-p.size/2,p.size,p.size); c.restore();}});
  }
  return ps;
}
