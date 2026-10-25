/* REAL 3D pickup collect bursts (entities round 2026-10-25): every live burst from entityfx (fxOf(world,"3d").bursts(t)) is drawn as soft additive sprites
   through ONE THREE.Points (+1 draw call). The per-kind style, count, radius and hashed placement come from collectParticle in ../motion.js (the same numbers
   CLASSIC and PIXEL read); this file only maps the spec's px offsets onto the board: fan and pop spray over the floor plane rising a little, a ring lies
   flat and widens, a trail streaks backwards, hearts rise. Preallocated attribute arrays, ranged upload, never lit, depthWrite false, never casts. */
import * as THREE from "../../../vendor/three.module.js";
import {CFG} from "../../core/config.js";
import {collectParticle, collectM, COLLECT_T} from "../motion.js";
import {live} from "./upload.js";
import {CAM_FOV} from "./camrig.js";

const W2=CFG.COLS*CFG.TILE/2, D2=CFG.ROWS*CFG.TILE/2, H=CFG.ROWS*CFG.TILE;
export const BURST_CAP=24*14;
const SHAPE={dot:0,diamond:1,ring:3,streak:4};
const H0=18, GAIN=1.5;
const VS=`attribute vec4 aCol;
attribute vec2 aSS;
uniform float uK;
varying vec4 vC;
varying float vS;
void main(){
  vec4 mv=modelViewMatrix*vec4(position,1.0);
  vC=aCol; vS=aSS.y;
  gl_PointSize=max(2.0,aSS.x*uK/-mv.z);
  gl_Position=projectionMatrix*mv;
}`;
const FS=`varying vec4 vC;
varying float vS;
void main(){
  vec2 p=gl_PointCoord*2.0-1.0;
  float a;
  if(vS<0.5) a=1.0-smoothstep(0.25,1.0,length(p));
  else if(vS<1.5) a=1.0-smoothstep(0.45,0.85,abs(p.x)+abs(p.y));
  else if(vS<3.5){ float r=length(vec2(p.x,p.y/0.79)); a=smoothstep(0.62,0.76,r)*(1.0-smoothstep(0.86,1.0,r)); }
  else a=(1.0-smoothstep(0.04,0.2,abs(p.y)))*(1.0-smoothstep(0.4,1.0,abs(p.x)));
  if(a<0.004) discard;
  gl_FragColor=vec4(vC.rgb,vC.a*a);
  #include <colorspace_fragment>
}`;
const _w=new THREE.Color("#ffffff");
const CCACHE=new Map();
const colOf=(hex)=>{ let c=CCACHE.get(hex); if(!c){ c=new THREE.Color(hex||"#ffffff").lerp(_w,0.3); if(CCACHE.size<64)CCACHE.set(hex,c); } return c; };

export function createBurstFx(){
  const pos=new Float32Array(BURST_CAP*3), col=new Float32Array(BURST_CAP*4), ss=new Float32Array(BURST_CAP*2);
  const geo=new THREE.BufferGeometry();
  const aP=new THREE.BufferAttribute(pos,3), aC=new THREE.BufferAttribute(col,4), aS=new THREE.BufferAttribute(ss,2);
  for(const a of [aP,aC,aS])a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("position",aP); geo.setAttribute("aCol",aC); geo.setAttribute("aSS",aS);
  geo.setDrawRange(0,0);
  const uK={value:1};
  const mat=new THREE.ShaderMaterial({uniforms:{uK},vertexShader:VS,fragmentShader:FS,transparent:true,depthWrite:false,depthTest:true,
    blending:THREE.AdditiveBlending,toneMapped:false});
  const points=new THREE.Points(geo,mat);
  points.frustumCulled=false; points.castShadow=false; points.receiveShadow=false;
  points.userData.tag="burst";
  let shown=0;
  /* bursts: fxOf(...).bursts(t) [{kind,x,y,col,age}]; dpr: the GL pixel ratio (point size); partK: EFFECTS LOW (< 1) draws every other spark */
  function update(bursts,dpr,partK){
    uK.value=H*(dpr||1)/(2*Math.tan(CAM_FOV*Math.PI/360));
    let n=0;
    for(let b=0;b<bursts.length&&n<BURST_CAP;b++){
      const B=bursts[b], m=collectM(B.kind), c=colOf(B.col), step=partK<1&&m.n>1?2:1;
      for(let i=0;i<m.n&&n<BURST_CAP;i+=step){
        const q=collectParticle(B.kind,i,B.age); if(!q)continue;
        const o=n*3, u=B.age/COLLECT_T;
        let y=H0+22*u, x=q.x, z=q.y, sh=0, d=Math.max(7,q.s*4.4);
        if(q.ring){ y=5; x=0; z=0; sh=3; d=q.s*2.8; }
        else if(m.style==="rise"){ y=H0-q.y*1.2; z=0; sh=1; d=Math.max(8,q.s*5); }
        else if(m.style==="trail"){ y=H0+4; sh=4; d=Math.max(12,(q.streak||3)*4+8); }
        pos[o]=B.x-W2+x; pos[o+1]=y; pos[o+2]=B.y-D2+z;
        col[n*4]=c.r; col[n*4+1]=c.g; col[n*4+2]=c.b; col[n*4+3]=Math.min(0.9,q.a*GAIN);
        ss[n*2]=d; ss[n*2+1]=sh;
        n++;
      }
    }
    if(n!==shown||n>0){
      geo.setDrawRange(0,n);
      live(aP,n); live(aC,n); live(aS,n);
      shown=n;
    }
    points.visible=n>0;
    return n;
  }
  function dispose(){ geo.dispose(); mat.dispose(); }
  return {points,update,dispose,get count(){return shown;}};
}
export {SHAPE};
