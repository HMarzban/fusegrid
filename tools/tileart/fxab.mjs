/* 3D effect taste call (not a deliverable): node fxab.mjs <out.png>
   Rows: QUICKSAND MAX and PORTAL PLUS (pair 3) at effect gain 1 and 1.6 (QUICKSAND rows: the old 0.26 and the picked 0.4),
   6 PLAY-clock frames each, through the real buildFeat layer at rig C,
   shown at TRUE in-game tile size (~40 px; the 256 frame holds 60 units)
   then NEAREST x3; last row: the downstream END tile of a stream run
   (W/E lips) full size, to check the scroll drags no lip. */
import {writeFileSync} from "node:fs";
import {withPage, b64png} from "./harness.mjs";
const out = process.argv[2];
await withPage(async (P) => {
  const d = await P.ev(`Promise.all([import('/src/core/config.js'),import('/vendor/three.module.js'),import('/src/render/three/lights.js'),import('/src/render/three/featmesh.js')]).then(([C,THREE,LG,FM])=>{
    const gl=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});gl.setPixelRatio(1);gl.setSize(256,256);gl.toneMapping=THREE.NoToneMapping;gl.outputColorSpace=THREE.SRGBColorSpace;gl.setClearColor('#0b0f1a',1);
    const dist=1503,el=0.66,cam=new THREE.PerspectiveCamera(2*Math.atan(30/dist)*180/Math.PI,1,10,4000);cam.position.set(0,dist*Math.cos(el),dist*Math.sin(el));cam.lookAt(0,0,0);
    const n=C.CFG.COLS*C.CFG.ROWS,Z=new THREE.Matrix4().makeScale(0,0,0);
    const frames=(bn,code,h,k,xs,show,ts,setup,dx=0)=>{const b=C.BIOMES.find(x=>x.name===bn),W={feat:new Uint8Array(n),featM:new Uint8Array(n),featS:new Float32Array(n),featPair:new Uint8Array(n),featT:0,heat:h,featTier:h,pace:0,level:1};
      for(const x of xs)W.feat[C.key(x,6)]=code;if(setup)setup(W);const L=FM.buildFeat(W,b);L.fxK.value=k;xs.forEach((x,i)=>{if(i!==show)L.mesh.setMatrixAt(i,Z);});
      L.mesh.position.x=dx;const s=new THREE.Scene(),Li=LG.createLights(b);s.add(Li.hemi,Li.dir,Li.fill,Li.amb,L.mesh);
      return ts.map(t=>{W.featT=t;L.update(W);gl.render(s,cam);const c=document.createElement('canvas');c.width=c.height=256;c.getContext('2d').drawImage(gl.domElement,0,0);return c;});};
    const T=[0,1,2,3,4,5],sheet=document.createElement('canvas');sheet.width=6*64+8;sheet.height=4*64+8;const g=sheet.getContext('2d');g.fillStyle='#0b0f1a';g.fillRect(0,0,sheet.width,sheet.height);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
    const rows=[['SAND',12,2,0.65,null],['SAND',12,2,1,null],['VOID',13,1,1,W=>{W.featPair[C.key(7,6)]=3;}],['VOID',13,1,1.6,W=>{W.featPair[C.key(7,6)]=3;}]];
    rows.forEach(([bn,code,h,k,su],r)=>frames(bn,code,h,k,[7],0,T.map(i=>0.5+i*0.6),su).forEach((c,i)=>g.drawImage(c,64,64,128,128,4+i*64,4+r*64,60,60)));
    const big=document.createElement('canvas');big.width=sheet.width*3;big.height=sheet.height*3+256;const bg=big.getContext('2d');bg.fillStyle='#0b0f1a';bg.fillRect(0,0,big.width,big.height);bg.imageSmoothingEnabled=false;bg.drawImage(sheet,0,0,big.width,sheet.height*3);
    frames('WATER',8,1,1,[6,7,8],2,[0.5,0.8,1.1,1.4,1.7,2.0],null,-40).forEach((c,i)=>bg.drawImage(c,i*200,sheet.height*3,256,256));
    return big.toDataURL('image/png');})`);
  writeFileSync(out, b64png(d));
  console.log("ok", P.errors);
});
