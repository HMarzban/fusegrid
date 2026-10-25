/* "What we show": CLASSIC 2D (the game's painter at 192x192, clear bg) and
   REAL 3D through the REAL layer: buildFeat (src/render/three/featmesh.js:
   its atlas, its shader effects, its one InstancedMesh) on a stand-in world
   whose only feature is the exported tile at the board centre (belt and
   stream as a 3-run, the two neighbours scaled to 0 so the tile stands
   alone); the frozen createLights recipe; NoToneMapping; the rig-C camera at
   its real dist 1503, el 0.66, az 0, with the lens narrowed to frame one
   tile (an exact enlargement of the in-game view); bg #0b0f1a; 256x256.
   3d-anim/: a 6-frame strip (1536x256) of the PLAY-clock effects per tile
   and heat, frame times in manifest.json. PIXEL is pxexport.mjs (Node). */
import {writeFileSync, mkdirSync} from "node:fs";
import {withPage, b64png, OUT, TILES} from "./harness.mjs";
import {ANIM} from "./anim.mjs";
const STILL = {GLIDE: 5.6};
mkdirSync(OUT + "3d-anim", {recursive: true});
await withPage(async (P) => {
  const res = await P.ev(`Promise.all([import('/src/render/featdraw.js'),import('/src/core/config.js'),import('/vendor/three.module.js'),import('/src/render/three/lights.js'),import('/src/render/three/featmesh.js')]).then(([F,C,THREE,LG,FM])=>{
    const out={},H=['core','plus','max'],ANIM=${JSON.stringify(ANIM)},STILL=${JSON.stringify(STILL)};
    const gl=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:false});gl.setPixelRatio(1);gl.setSize(256,256);
    gl.toneMapping=THREE.NoToneMapping;gl.outputColorSpace=THREE.SRGBColorSpace;gl.setClearColor('#0b0f1a',1);
    const el=0.66,dist=1503,cam=new THREE.PerspectiveCamera(2*Math.atan(30/dist)*180/Math.PI,1,10,4000);
    cam.position.set(0,dist*Math.cos(el),dist*Math.sin(el));cam.lookAt(0,0,0);
    const CODE={BELT:1,GLIDE:5,BLOOM:6,PLATE:7,STREAM:8,QUICK:12,PORTAL:13,GATE:14},CO=C.CFG.COLS,RO=C.CFG.ROWS;
    const draws=new Set(),Z=new THREE.Matrix4().makeScale(0,0,0);
    for(const [w,p,bn,s] of ${JSON.stringify(TILES)})for(let h=0;h<3;h++){
      const b=C.BIOMES.find(x=>x.name===bn),sp={...s,h};
      const cv=document.createElement('canvas');cv.width=cv.height=192;const g=cv.getContext('2d');g.scale(4.8,4.8);F.paintCell(g,b,sp);
      out['2d/'+w+'-'+p+'-'+H[h]]=cv.toDataURL('image/png');
      for(const anim of [false,true]){
        const n=CO*RO,W={feat:new Uint8Array(n),featM:new Uint8Array(n),featS:new Float32Array(n),featPair:new Uint8Array(n),featT:0,heat:h,featTier:h,pace:0,level:1};
        const run=s.kind==='BELT'||s.kind==='STREAM',ck=C.key(7,6);
        for(const x of run?[6,7,8]:[7])W.feat[C.key(x,6)]=CODE[s.kind];
        if(s.kind==='GATE')W.featM[ck]=s.lit||0;
        if(s.kind==='PORTAL')W.featPair[ck]=anim?3:1;
        const L=FM.buildFeat(W,b);if(run){L.mesh.setMatrixAt(0,Z);L.mesh.setMatrixAt(2,Z);}
        const scene=new THREE.Scene(),Li=LG.createLights(b);scene.add(Li.hemi,Li.dir,Li.fill,Li.amb,L.mesh);
        const [t0,dt]=ANIM[s.kind],ts=anim?[0,1,2,3,4,5].map(i=>t0+i*dt):[STILL[s.kind]!=null?STILL[s.kind]:1];
        const strip=document.createElement('canvas');strip.width=256*ts.length;strip.height=256;const sg=strip.getContext('2d');
        ts.forEach((t,i)=>{W.featT=t;L.update(W);gl.info.reset();gl.render(scene,cam);draws.add(gl.info.render.calls);sg.drawImage(gl.domElement,i*256,0);});
        out[(anim?'3d-anim/':'3d/')+w+'-'+p+'-'+H[h]]=strip.toDataURL('image/png');
        L.mesh.geometry.dispose();L.mesh.material.map.dispose();L.mesh.material.dispose();
      }
    }
    out.draws=[...draws].join(',');return out;})`);
  console.log("3D draw calls per isolated tile scene:", res.draws);
  delete res.draws;
  for (const [k, v] of Object.entries(res)) writeFileSync(OUT + k + ".png", b64png(v));
  console.log(Object.keys(res).length, "files", P.errors);
});
