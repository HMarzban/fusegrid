/* Taste-call contact sheet at TRUE SIZE (not a deliverable):
   node variants.mjs <out.png> <json rows>, rows = [[label, biome, spec], ...].
   Each row: CORE PLUS MAX at 40 px on the floor checker (belt / stream as a
   3-run), then the same in grayscale, then x4 of the PLUS bake. NEAREST x2. */
import {writeFileSync} from "node:fs";
import {withPage, b64png} from "./harness.mjs";
const [out, rowsJ] = process.argv.slice(2);
await withPage(async (P) => {
  const d = await P.ev(`Promise.all([import('/src/render/featdraw.js'),import('/src/core/config.js')]).then(([F,C])=>{
    const T=${rowsJ},cv=document.createElement('canvas');cv.width=6*124+168;cv.height=T.length*168+4;const g=cv.getContext('2d');g.fillStyle='#0b0f1a';g.fillRect(0,0,cv.width,cv.height);
    const gray=(x,y,w,h)=>{const im=g.getImageData(x,y,w,h),a=im.data;for(let i=0;i<a.length;i+=4){const v=0.2126*a[i]+0.7152*a[i+1]+0.0722*a[i+2];a[i]=a[i+1]=a[i+2]=v;}g.putImageData(im,x,y);};
    T.forEach(([lab,bn,s],r)=>{const b=C.BIOMES.find(x=>x.name===bn);for(let h=0;h<3;h++){const sp={...s,h};
      const k=document.createElement('canvas');k.width=k.height=80;const kg=k.getContext('2d');kg.scale(2,2);F.paintCell(kg,b,sp);
      for(const gy of [0,1]){const bx=(gy*3+h)*124+4,oy=r*168+24;for(let y=0;y<3;y++)for(let x=0;x<3;x++){g.fillStyle=(x+y)&1?b.floor1:b.floor0;g.fillRect(bx+x*40,oy+y*40,40,40);}
        g.drawImage(k,bx+40,oy+40,40,40);if(s.kind==='BELT'||s.kind==='STREAM'){g.drawImage(k,bx,oy+40,40,40);g.drawImage(k,bx+80,oy+40,40,40);}
        if(gy)gray(bx,oy,120,120);}
      if(h===1){const K=document.createElement('canvas');K.width=K.height=160;const Kg=K.getContext('2d');Kg.scale(4,4);F.paintCell(Kg,b,sp);g.drawImage(K,6*124+4,r*168+4,160,160);}}
      g.fillStyle='#e0e6f0';g.font='12px monospace';g.fillText(lab,6,r*168+16);});
    const big=document.createElement('canvas');big.width=cv.width*2;big.height=cv.height*2;const bg=big.getContext('2d');bg.imageSmoothingEnabled=false;bg.drawImage(cv,0,0,big.width,big.height);
    return big.toDataURL('image/png');})`);
  writeFileSync(out, b64png(d));
  console.log("ok", P.errors);
});
