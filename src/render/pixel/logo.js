/* LOGO B, PIXEL (appendix 8.7, R21): palette slots, art/logo.js grids, the 24 cap sampled from the vector glyphs; draw2d.js places it (R20 scaling). */
import {GL, layout as vl, inGlyph, bez} from "../logo/glyphs.js";
import {WORLDS} from "../logo/worlds.js";
import {registerLogo, paintPlate, mk, fresh} from "../logo/draw2d.js";
import {BIOMES} from "../../core/config.js";
import {resolveSlot} from "./palette.js";
import {G12, BOMB, BPAL, SPARK5, SPAL, CORONET} from "./art/logo.js";

const g24={},[BA,BB,BH,WH,WL]=["brickA","brickB","brickHi","wallHi","wall"].map((s)=>"tile."+s),Q4=[[0,0],[1,0],[0,1],[1,1]],N4=[[1,0],[-1,0],[0,1],[0,-1]],{round:R,floor:FL,ceil:CE,max:MX,min:MN}=Math;
const glyph=(A,c)=>(A<24?G12[c]:g24[c]||(g24[c]=[...Array(24)].map((_,j)=>[...Array(R(GL[c].w*24))].map((_,i)=>(inGlyph(c,(i+.5)/24,(j+.5)/24)?"#":".")).join(""))));
function lay(A,st){
  const g=A<24?2:3,cell=A<24?11:18,et=MX(CE(.4*A),7),es=CE(.2*A),lt=[],V=vl(st?"stack":"line");
  const put=(w,x,y,word)=>{for(const ch of w){const rows=glyph(A,ch),r=rows[A-1];lt.push({ch,x,y,word,rows,i:lt.length,w:rows[0].length,b:y+A,a:x+r.indexOf("#"),z:x+r.lastIndexOf("#")});x+=rows[0].length+g;}return x-g;};
  const yb=st?et+A+R(.3*A):et,bx=put(st?"GRID":"FUSE",es,yb,+st)+g+1,b=yb+A,cq=V.cord.map(([x,y])=>[bx+cell/2+(x-V.bomb.x)*A,b-(V.bomb.y+V.bomb.d/2-y)*A]);
  let W=st?MX(bx+cell,CE(cq[3][0])+3)+es:put("GRID",bx+cell+g-1,et,1)+es,t=.5;
  if(st){for(let k=0;k<40;k++)t+=((bez(cq,t)[1]-et-A/2)/A)*.4;put("FUSE",R(bez(cq,t)[0]-2-g-[..."FUSE"].reduce((a,c)=>a+glyph(A,c)[0].length+g,-g)),et,0);}
  const e=bez(cq,1);
  return{lt,cq,cell,W,H:b+CE(.36*A),bomb:[bx,b-cell+1],cs:[bx+(A<24?8:12.5),b-cell+1.5],tip:[R(e[0]),R(e[1])-1]};
}
function motif(M,L,wn,tok,A,isF){
  const w={[wn]:1},q=A>12?4:3,f=(ch)=>L.find((l)=>l.ch===ch),F=f("F"),U=f("U"),D=f("D"),I=f("I"),leaf=(x,y,k)=>Q4.forEach(([dx,dy])=>M(x+dx+(k?dy:1-dy),y+dy,BA));
  if(w.JUNGLE){
    if(tok)return leaf(F.x-1,F.y-1,0);
    for(let i=0;i<8;i++){M(F.x-1+i,F.y+17-((i/3)|0),BB);M(F.x-2,F.y+9+i,BB);if(i<6)M(D.x+D.w-1+MN(2,i),D.y+2+i,BB);}
    for(let x=F.x+6;x<=U.x+9;x++)M(x,F.b+1,BB);
    for(const[dx,dy]of[[10,1],[11,2],[10,3],[9,2]])M(U.x+dx,U.b+dy,BB);
    leaf(F.x-3,F.y+10,1);leaf(F.x-3,F.y+15,0);leaf(U.x+11,U.b+1,1);leaf(D.x+D.w,D.y+8,0);
  }
  if(w.ICE){
    for(const l of L)if((tok?"FG":"FUEGRID").includes(l.ch))[...l.rows[0]].forEach((c,i)=>{if(c==="#")for(let d=2;d<5;d++)if(d<q||(d===q&&(i+l.i)%4===1))M(l.x+i,l.y-d,BA);});
    if(!tok)for(const[ch,k]of[["E",.55],["G",.4],["D",.35]]){const l=f(ch),x=l.x+R(k*l.w);for(let j=0;j<7;j++)M(x+(j>3),l.b+(j%4),WH);}
  }
  for(const l of L){
    const m=R((l.a+l.z)/2);
    if(w.FACTORY&&l.z-l.a>=(A>12?7:4)&&!(tok&&!"UD".includes(l.ch)))for(const x of tok?[m]:[l.a+2,l.z-2])M(x,l.b+1,WH);
    if(w.ARENA&&(!tok||"FD".includes(l.ch)))Q4.forEach(([dx,dy],i)=>M(m-1+dx,l.b+dy,i%3?WL:WH));
    if(w.WATER&&(tok?"UD":"UERD").includes(l.ch))for(let j=0;j<6;j++)M((l.ch==="R"?l.x+1:m-1)+(j&1),l.b+(j>>1),j===2?BH:BA);
  }
  if(w.SAND){
    let s=7;
    for(const l of L)l.rows.forEach((row,j)=>[...row].forEach((c,i)=>{const x=l.x+i,y=l.y+j;if(c==="#"&&N4.every(([dx,dy])=>isF(x+dx,y+dy))&&(s=(s*1664525+1013904223)>>>0)/4294967296<.04)M(x,y,(l.word?"sparkB":"spark")+".shadow");}));
    if(!tok)for(const l of L)if("UER".includes(l.ch))for(let i=0;i<6;i++)for(let h=i<3?1:i<5?2:3,j=0;j<h;j++)M(l.x-6+i,l.b-1-j,j===h-1?BH:BA);
  }
  if(w.CROWN&&!tok)CORONET.forEach((r,j)=>[...r].forEach((c,i)=>{if(c>".")M(I.x+R((I.w-7)/2)+i,I.y-6+j,c==="h"?BH:BB);}));
}
export function _bake(A,st,wn,ti,X=lay(A,st)){
  const{W,H}=X,N=W*H,face=new Int8Array(N).fill(-1),sol=new Uint8Array(N),ext=new Uint8Array(N),col=Array(N).fill(null),mot=new Map(),cord=new Map();
  const id=(x,y)=>(x<0||y<0||x>=W||y>=H?-1:y*W+x),isF=(x,y)=>face[id(x,y)]>=0,S=(k,s)=>{if(k>=0)col[k]=s;},nb=(k,d)=>id((k%W)+d[0],((k/W)|0)+d[1]);
  const each=(rows,x0,y0,f)=>rows.forEach((r,j)=>[...r].forEach((c,i)=>f(c,id(x0+i,y0+j))));
  const dil=(m)=>m.map((_,k)=>+[...Q4,[-1,-1],[-1,0],[0,-1],[1,-1],[-1,1]].some((d)=>m[nb(k,d)])),ero=(m)=>dil(m.map((v)=>1-v)).map((v)=>1-v);
  const ring=(set,m)=>{for(const k of m.keys())for(const d of N4){const q=nb(k,d);if(q>=0&&!m.has(q)&&set(q))S(q,"stroke");}for(const[k,s]of m)S(k,s);};
  for(const l of X.lt)each(l.rows,l.x,l.y,(c,k)=>{if(c==="#"){face[k]=l.word;sol[k]=1;}});
  const bc=BOMB[X.cell];
  each(bc,...X.bomb,(c,k)=>{if(c>"."&&c!=="o")sol[k]=1;});
  for(let k=0;k<N;k++)for(let d=1;d<=(A>12?3:2)&&!sol[k];d++)if(sol[k-d*W]){ext[k]=1;break;}
  let ink=dil(sol.map((v,k)=>v|ext[k]));
  if(A>12)ink=ero(dil(ink));
  if(wn==="VOID"){const r1=dil(ero(dil(dil(ink)))),r2=dil(r1);for(let k=0;k<N;k++){if(ti==="title"&&r2[k])S(k,BB);if(r1[k])S(k,BA);}}
  for(let k=0;k<N;k++){
    if(ink[k])S(k,"stroke");
    if(ext[k])S(k,wn!=="CROWN"?WORLDS[wn].px:sol[k-W]?"stroke":!ext[k+W]&&!sol[k+W]?BH:BB);
    if(face[k]<0)continue;
    const x=k%W,y=(k/W)|0,b=ti==="menu"?"eye":face[k]?"sparkB":"spark",dn=!isF(x,y+1),rt=!isF(x+1,y),up=!isF(x,y-1);
    S(k,b+(A>12?((up||!isF(x-1,y))&&!(dn||rt)?".light":dn||rt||((!isF(x,y+2)||!isF(x+2,y))&&(x+y)%2)?".shadow":""):dn?".shadow":up?".light":""));
  }
  motif((x,y,s)=>{const k=id(x,y);if(k>=0)mot.set(k,s);},X.lt,wn,ti!=="title",A,isF);
  ring((q)=>wn!=="SAND"&&(face[q]>=0||!col[q]),mot);
  each(bc,...X.bomb,(c,k)=>{if(c>".")S(k,BPAL[c]);});
  for(let i=0,sl=0,pv=X.cs;i<=400;i++){
    const p=i<40?X.cs.map((v,a)=>v+((X.cq[0][a]-v)*i)/40):bez(X.cq,(i-40)/360);
    sl+=Math.hypot(p[0]-pv[0],p[1]-pv[1]);pv=p;
    for(const d of Q4){const k=id(FL(p[0]-.5)+d[0],FL(p[1]-.5)+d[1]);if(k>=0&&!cord.has(k))cord.set(k,(sl/2)&1?"fuse.shadow":"fuse");}
  }
  ring(()=>1,cord);
  return col;
}
function world(x,G){
  paintPlate(x,G);
  const B=G.pb,M=B.M,W=B.X.W,a=mk(W*M,B.X.H*M),ax=fresh(a),col=_bake(B.A,B.st,G.w.name,B.ti,B.X);
  for(let k=0,n;k<col.length;k+=n){for(n=1;(k+n)%W&&col[k+n]===col[k];n++);if(col[k]){ax.fillStyle=B.hex(col[k]);ax.fillRect((k%W)*M,((k/W)|0)*M,n*M,M);}}
  x.setTransform(1,0,0,1,0,0);x.imageSmoothingEnabled=true;
  x.drawImage(a,G.dxL+B.ox*G.dprL,G.dyL+B.oy*G.dprL,W*B.u*G.dprL,B.X.H*B.u*G.dprL);
  a.width=a.height=0;
}
const spark=(x,G)=>{const B=G.pb,m=B.Ms;for(let f=0;f<3;f++)SPARK5[f&1].forEach((r,j)=>[...r].forEach((c,i)=>{if(c>"."){x.fillStyle=B.hex(f>1?"blast2":i===2&&j===2?"blast1":SPAL[c]);x.fillRect((5*f+i)*m,j*m,m,m);}}));};
export function pxLook(G){
  const A=G.place==="title"?24:12,st=G.build==="stack",X=lay(A,st),E=G.env,k=G.capL,pl=G.P.layers.find((l)=>l.id==="plate"),Rm=pl?{w:pl.box.w/G.k,h:pl.box.h/G.k}:{w:G.room.w,h:1e9},u=MN(k/A,Rm.w/X.W,Rm.h/X.H),biome=BIOMES[G.w.level-1],hex=(s)=>resolveSlot(s,{biome});
  const ox=(E.w*k-X.W*u)/2,oy=(E.h*k-X.H*u)/2,Ms=MX(1,CE(u*G.dprL));
  G.pb={A,st,X,u,ox,oy,Ms,M:MN(8,Ms),hex,ti:A>12?"title":"menu"};
  Object.assign(G,{grow:{w:X.W*u,h:X.H*u},fw:world,fs:spark,noRun:true,cell:5*Ms,sw:15*Ms,half:2.5*u,tip:{x:E.l+(ox+(X.tip[0]+.5)*u)/k,y:E.t+(oy+(X.tip[1]+.5)*u)/k},face:[A>12?"spark":"eye",A>12?"sparkB":"eye"].map(hex)});
}
registerLogo("px",pxLook);
