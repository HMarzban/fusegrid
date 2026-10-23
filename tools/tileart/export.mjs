/* "What we show": CLASSIC 2D (the game's painter at 192x192, clear bg) and
   REAL 3D (ONE tile: a 40x40 plane at floor +0.7 like featmesh, the same
   MeshLambertMaterial over a 64-px CanvasTexture cell painted by the same
   painter = the in-game atlas cell resolution, LinearFilter, no mipmaps,
   sRGB; the frozen createLights recipe; NoToneMapping; CAM_FOV 24 at the
   rig-C polar el 0.66, az 0, dollied in to frame one tile; bg #0b0f1a;
   256x256). PIXEL is pxexport.mjs (Node only). */
import {writeFileSync} from "node:fs";
import {withPage, b64png, OUT, TILES} from "./harness.mjs";
await withPage(async (P) => {
  const res = await P.ev(`Promise.all([import('/src/render/featdraw.js'),import('/src/core/config.js'),import('/vendor/three.module.js'),import('/src/render/three/lights.js'),import('/src/render/three/camrig.js')]).then(([F,C,THREE,LG,CR])=>{
    const out={},H=['core','plus','max'];
    const gl=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:false});gl.setPixelRatio(1);gl.setSize(256,256);
    gl.toneMapping=THREE.NoToneMapping;gl.outputColorSpace=THREE.SRGBColorSpace;gl.setClearColor('#0b0f1a',1);
    const cam=new THREE.PerspectiveCamera(CR.CAM_FOV,1,1,4000),el=0.66,dist=122;
    cam.position.set(0,dist*Math.cos(el),dist*Math.sin(el));cam.lookAt(0,0,0);
    let draws=0;
    for(const [w,p,bn,s] of ${JSON.stringify(TILES)})for(let h=0;h<3;h++){
      const b=C.BIOMES.find(x=>x.name===bn),sp={...s,h};
      const cv=document.createElement('canvas');cv.width=cv.height=192;const g=cv.getContext('2d');g.scale(4.8,4.8);F.paintCell(g,b,sp);
      out['2d/'+w+'-'+p+'-'+H[h]]=cv.toDataURL('image/png');
      const at=document.createElement('canvas');at.width=at.height=64;const ag=at.getContext('2d');ag.scale(1.6,1.6);F.paintCell(ag,b,sp);
      const tex=new THREE.CanvasTexture(at);tex.colorSpace=THREE.SRGBColorSpace;tex.generateMipmaps=false;tex.minFilter=THREE.LinearFilter;tex.magFilter=THREE.LinearFilter;
      const geo=new THREE.PlaneGeometry(40,40);geo.rotateX(-Math.PI/2);
      const mat=new THREE.MeshLambertMaterial({color:'#ffffff',map:tex});
      const mesh=new THREE.Mesh(geo,mat);mesh.position.y=0.7;mesh.receiveShadow=true;
      const scene=new THREE.Scene(),L=LG.createLights(b);scene.add(L.hemi,L.dir,L.fill,L.amb,mesh);
      gl.info.reset();gl.render(scene,cam);draws=gl.info.render.calls;
      out['3d/'+w+'-'+p+'-'+H[h]]=gl.domElement.toDataURL('image/png');
      geo.dispose();mat.dispose();tex.dispose();
    }
    out.draws=draws;return out;})`);
  console.log("3D draw calls per isolated tile scene:", res.draws);
  delete res.draws;
  for (const [k, v] of Object.entries(res)) writeFileSync(OUT + k + ".png", b64png(v));
  console.log(Object.keys(res).length, "files", P.errors);
});
