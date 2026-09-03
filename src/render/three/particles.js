/* THREE.Points particle pool (real3d spec §3 S3) — consumes the SAME fx-store
   data the 2D renderer draws (fx.getFx(): {x,y,vx,vy,t,life,color,size,
   confetti?} in board px). Fixed capacity, count-culled via setDrawRange,
   oldest-first under overflow, zero per-frame allocation. px->world mapping
   X=x-W/2 Z=y-D/2; ground bursts hover at Y=8, confetti rains from the sky
   (height falls as its px-y advances). Additive blending + ttl-dimmed vertex
   colors give the alpha fade without depth-sorting. Node-testable: THREE
   objects + plain data only. Soft 16² disc map is optional (browser
   canvas); headless keeps an unmapped PointsMaterial. */
import * as THREE from "../../../vendor/three.module.js";
import {CFG} from "../../core/config.js";

export const PART_CAP=384;
const W2=CFG.COLS*CFG.TILE/2, D2=CFG.ROWS*CFG.TILE/2;
const _c=new THREE.Color();

function discMap(){
  try{
    if(typeof document==="undefined"||!document.createElement)return null;
    const c=document.createElement("canvas"); c.width=c.height=16;
    const x=c.getContext("2d"); if(!x)return null;
    const g=x.createRadialGradient(8,8,0.8,8,8,8);
    g.addColorStop(0,"rgba(255,255,255,1)");
    g.addColorStop(0.5,"rgba(255,255,255,0.7)");
    g.addColorStop(1,"rgba(255,255,255,0)");
    x.fillStyle=g; x.beginPath(); x.arc(8,8,8,0,Math.PI*2); x.fill();
    const tx=new THREE.CanvasTexture(c); tx._shared=true; return tx;
  }catch(_){ return null; }
}

export function createParticles(){
  const geo=new THREE.BufferGeometry();
  const pos=new Float32Array(PART_CAP*3);
  const col=new Float32Array(PART_CAP*3);
  geo.setAttribute("position",new THREE.BufferAttribute(pos,3));
  geo.setAttribute("color",new THREE.BufferAttribute(col,3));
  geo.setDrawRange(0,0);
  const mat=new THREE.PointsMaterial({size:10,sizeAttenuation:true,
    vertexColors:true,transparent:true,depthWrite:false,
    blending:THREE.AdditiveBlending});
  const disc=discMap(); if(disc)mat.map=disc;
  const points=new THREE.Points(geo,mat);
  points.frustumCulled=false;
  points.userData.tag="particles";
  function update(parts){
    const n=Math.min(parts.length,PART_CAP);
    for(let i=0;i<n;i++){
      const p=parts[i];
      const gy=p.confetti?(CFG.ROWS*CFG.TILE+40-p.y)*0.45:8;
      pos[i*3]=p.x-W2; pos[i*3+1]=gy; pos[i*3+2]=p.y-D2;
      const k=Math.max(0,1-p.t/(p.life||1));
      _c.set(p.color||"#ffffff");
      col[i*3]=_c.r*k; col[i*3+1]=_c.g*k; col[i*3+2]=_c.b*k;
     }
    geo.setDrawRange(0,n);
    geo.attributes.position.needsUpdate=true;
    geo.attributes.color.needsUpdate=true;
   }
  return {points,update,cap:PART_CAP};
}
