/* REAL 3D ambient motion (2026-10-25): the room's motes, glints, steam and
   ripples as ONE THREE.Points (+1 draw call), driven by the shared spec in
   ../ambient.js (particleAt is a pure function of the PLAY-only clock). One
   custom material draws every shape as a soft sprite in code; position, colour
   +alpha, size and shape ride per-vertex attributes in preallocated arrays with
   a ranged upload. Board px map to the scene exactly as scene.js does (centre
   at the origin, X = x - 300, Z = y - 260, y up); motes float 6-40 units above
   the floor, puffs rise, ripples and streaks lie flat. Never lit, never fogged,
   depthWrite false, never casts or receives a shadow. */
import * as THREE from "../../../vendor/three.module.js";
import {CFG, biomeOf} from "../../core/config.js";
import {biomeSpecs, particleAt, ambientColor, ambientCount, reduceMotion} from "../ambient.js";
import {hsh} from "../featart/kit.js";
import {live} from "./upload.js";
import {CAM_FOV} from "./camrig.js";

const W2=CFG.COLS*CFG.TILE/2, D2=CFG.ROWS*CFG.TILE/2, H=CFG.ROWS*CFG.TILE;
const SHAPE={dot:0,diamond:1,puff:2,ring:3,streak:4,flake:5};
const GAIN=1.9;                 // small sprites are tiny at rig C: lift the spec alpha a little

const VS=`attribute vec4 aCol;
attribute vec2 aSS;
uniform float uK;
varying vec4 vC;
varying float vS;
void main(){
  vec4 mv=modelViewMatrix*vec4(position,1.0);
  vC=aCol; vS=aSS.y;
  gl_PointSize=max(1.5,aSS.x*uK/-mv.z);
  gl_Position=projectionMatrix*mv;
}`;
const FS=`varying vec4 vC;
varying float vS;
void main(){
  vec2 p=gl_PointCoord*2.0-1.0;
  float a;
  if(vS<0.5) a=1.0-smoothstep(0.3,1.0,length(p));
  else if(vS<1.5) a=1.0-smoothstep(0.5,0.85,abs(p.x)+abs(p.y));
  else if(vS<2.5) a=exp(-dot(p,p)*3.4)*(1.0-smoothstep(0.7,1.0,length(p)));
  else if(vS<3.5){ float r=length(vec2(p.x,p.y/0.79)); a=smoothstep(0.66,0.8,r)*(1.0-smoothstep(0.88,1.0,r)); }
  else if(vS<4.5) a=(1.0-smoothstep(0.03,0.17,abs(p.y)))*(1.0-smoothstep(0.5,1.0,abs(p.x)));
  else { vec2 q=mat2(0.88,-0.48,0.48,0.88)*p; a=1.0-smoothstep(0.5,0.64,max(abs(q.x),abs(q.y))); }
  if(a<0.004) discard;
  gl_FragColor=vec4(vC.rgb,vC.a*a);
  #include <colorspace_fragment>
}`;

export function createAmbient(biome){
  const specs=biomeSpecs(biome.name), cols=specs.map(s=>new THREE.Color(ambientColor(biome,s)));
  const cap=Math.max(1,specs.reduce((n,s)=>n+s.n,0));
  const pos=new Float32Array(cap*3), col=new Float32Array(cap*4), ss=new Float32Array(cap*2);
  const geo=new THREE.BufferGeometry();
  const aP=new THREE.BufferAttribute(pos,3), aC=new THREE.BufferAttribute(col,4), aS=new THREE.BufferAttribute(ss,2);
  for(const a of [aP,aC,aS])a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("position",aP); geo.setAttribute("aCol",aC); geo.setAttribute("aSS",aS);
  geo.setDrawRange(0,0);
  const uK={value:1};
  const mat=new THREE.ShaderMaterial({uniforms:{uK},vertexShader:VS,fragmentShader:FS,transparent:true,depthWrite:false,depthTest:true,toneMapped:false});
  const points=new THREE.Points(geo,mat);
  points.frustumCulled=false; points.castShadow=false; points.receiveShadow=false;
  points.userData.tag="ambient";
  let shown=0;
  /* t: the PLAY-only ambient clock; show: false = nothing (menus, intro);
     k: density (EFFECTS LOW 0.5); dpr: the GL pixel ratio, for the point size */
  function update(t,show,k,dpr){
    uK.value=H*(dpr||1)/(2*Math.tan(CAM_FOV*Math.PI/360));
    let n=0;
    if(show&&!reduceMotion())
      for(let g=0;g<specs.length;g++){
        const sp=specs[g], c=cols[g], m=ambientCount(sp,k), sh=SHAPE[sp.shape]||0;
        for(let i=0;i<m&&n<cap;i++){
          const q=particleAt(sp,g,i,t);
          if(!q)continue;
          const hz=hsh(i,g*131+7,9), o=n*3;
          let y=8+30*hz, d=Math.max(7.5,q.s*4.2);
          if(sh===2){ y=6+38*q.p; d=q.s*3.2; }
          else if(sh===3){ y=1.5; d=q.s*2.6; }
          else if(sh===4){ y=10+10*hz; d=q.s*2.2; }
          else if(sh===5){ y=Math.max(8,40-32*q.p); }
          else if(sp.dy<0) y=8+26*q.p;
          pos[o]=q.x-W2; pos[o+1]=y; pos[o+2]=q.y-D2;
          col[n*4]=c.r; col[n*4+1]=c.g; col[n*4+2]=c.b; col[n*4+3]=Math.min(0.62,sp.alpha*q.a*GAIN);
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
  return {points,update,get count(){return shown;}};
}
