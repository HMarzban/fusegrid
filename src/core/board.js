import {CFG,T,key,clamp} from "./config.js";
import {createRng} from "./rng.js";
const dirs4=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
export function tileOf(px){return Math.floor(px/CFG.TILE);}
export function isWall(g,x,y){const v=g[key(x,y)];return v===undefined?T.WALL:v===T.WALL;}
export function isBrick(g,x,y){return g[key(x,y)]===T.BRICK;}
export function solidAt(g,px,py){
  const tx=tileOf(px),ty=tileOf(py),v=g[key(tx,ty)];
  return v===T.WALL||v===T.BRICK;
}
export function genBoard(seed,level){
  const rng=createRng((seed^(level*2654435761))>>>0);
  const C=CFG.COLS,R=CFG.ROWS,grid=new Int8Array(C*R);
  for(let y=0;y<R;y++)for(let x=0;x<C;x++){
    const border=(x===0||y===0||x===C-1||y===R-1);
    grid[key(x,y)] = border?T.WALL : (x%2===1&&y%2===1?T.BRICK:T.EMPTY);
  }
  [[1,1],[C-2,1],[1,R-2],[C-2,R-2],[1,3],[3,1],[1,R-3],[C-2,R-3]].forEach(([x,y])=>{
    if(x<1||y<1||x>=C-1||y>=R-1)return;
    grid[key(x,y)]=T.EMPTY;
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{
      const a=x+dx,b=y+dy;
      if(a>0&&b>0&&a<C-1&&b<R-1)grid[key(a,b)]=T.EMPTY;
    });
  });
  for(let y=2;y<R-2;y++)for(let x=2;x<C-2;x++)
    if(grid[key(x,y)]===T.BRICK && rng.next()<0.32) grid[key(x,y)]=T.EMPTY;
  return grid;
}
export function bfsNext(g,sx,sy,tx,ty,passBrick){
  if(sx===tx&&sy===ty)return null;
  const C=CFG.COLS,R=CFG.ROWS,prev=new Map(),seen=new Set(),q=[[sx,sy]];
  seen.add(key(sx,sy));
  while(q.length){
    const [x,y]=q.shift();
    for(const d of dirs4){
      const nx=x+d.x,ny=y+d.y,k=key(nx,ny);
      if(nx<0||ny<0||nx>=C||ny>=R)continue;
      const val=g[k];
      if(val===T.WALL)continue;
      if(val===T.BRICK&&!passBrick)continue;
      if(seen.has(k))continue;
      seen.add(k);prev.set(k,key(x,y));
      if(nx===tx&&ny===ty){
        let cur=k;
        while(prev.get(cur)!==key(sx,sy))cur=prev.get(cur);
        return {x:cur%C,y:Math.floor(cur/C)};
        }
      q.push([nx,ny]);
    }
  }
  return null;
}
export function aabb(g,tx,ty,px,py,rad){
   const hx=CFG.TILE/2;
   return Math.abs(px-(tx*CFG.TILE+hx))<rad+hx && Math.abs(py-(ty*CFG.TILE+hx))<rad+hx;
    }
   // circle-vs-solid (WALL or BRICK). Used by normal movement.
 export function circleHitsSolid(g,px,py,rad){
   const tx0=tileOf(px-rad),tx1=tileOf(px+rad),ty0=tileOf(py-rad),ty1=tileOf(py+rad);
   for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++)
     if(solidAt(g,tx*CFG.TILE+CFG.TILE/2,ty*CFG.TILE+CFG.TILE/2))return true;
   return false;
  }
   // circle-vs-wall/border only. Used by brick-penetrators so they NEVER leave the board.
 export function wallHits(g,px,py,rad){
   const tx0=tileOf(px-rad),tx1=tileOf(px+rad),ty0=tileOf(py-rad),ty1=tileOf(py+rad);
   for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++)
     if(isWall(g,tx,ty))return true;
   return false;
  }
   // Sub-stepped move. `check` decides collision; flips e.dir once per axis on contact.
   // Returns {bouncedX, bouncedY}. passBrick => wall-only check (brick penetrator).
 export function moveEntity(e,g,dx,dy,passBrick){
   const check=passBrick?function(px,py,r){return wallHits(g,px,py,r);}
                          :function(px,py,r){return circleHitsSolid(g,px,py,r);};
   const step=CFG.TILE*0.25;
   let n=1;
   const dist2=dx*dx+dy*dy, cell=step*step;
   while(n*n*cell<dist2)n++;
   let bx=false,by=false;
   for(let i=0;i<n;i++){
     const nx=e.x+dx/n;
     if(check(nx,e.y,e.r*0.9)){ if(!bx){bx=true; if(e.dir)e.dir.x=-e.dir.x;} }
     else e.x=nx;
     const ny=e.y+dy/n;
     if(check(e.x,ny,e.r*0.9)){ if(!by){by=true; if(e.dir)e.dir.y=-e.dir.y;} }
     else e.y=ny;
    }
   e.tx=tileOf(e.x); e.ty=tileOf(e.y);
   return {bouncedX:bx,bouncedY:by};
  }
