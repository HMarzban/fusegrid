/* Review sheets at TRUE SIZE (not deliverables): node review.mjs <outPrefix> [mod]
   <prefix>-2d-{a,b}.png: per tile row, CLASSIC 2D = the 80-px bake drawn at
   40 on the biome floor checker (as in game; belt / stream as a 3-run),
   CORE PLUS MAX in colour then in grayscale. <prefix>-px-{a,b}.png: PIXEL
   at k 3 (NEAREST) colour + grayscale, plus k 4. Rows a = tiles 1-4,
   b = 5-8. Each sheet is shown NEAREST x2 so every true-size px is visible. */
import {writeFileSync} from "node:fs";
import {withPage, b64png, TILES} from "./harness.mjs";
const out = process.argv[2], mod = process.argv[3] || "/src/render/featdraw.js";
await withPage(async (P) => {
  const d = await P.ev(`Promise.all([import('${mod}'),import('/src/core/config.js'),import('/src/render/featpx.js'),import('/src/render/pixel/grid.js')]).then(([F,C,X,G])=>{
    const T=${JSON.stringify(TILES)},res={};
    const gray=(g,x,y,w,h)=>{const im=g.getImageData(x,y,w,h),a=im.data;for(let i=0;i<a.length;i+=4){const v=0.2126*a[i]+0.7152*a[i+1]+0.0722*a[i+2];a[i]=a[i+1]=a[i+2]=v;}g.putImageData(im,x,y);};
    const x2=(cv)=>{const big=document.createElement('canvas');big.width=cv.width*2;big.height=cv.height*2;const bg=big.getContext('2d');bg.imageSmoothingEnabled=false;bg.drawImage(cv,0,0,big.width,big.height);return big.toDataURL('image/png');};
    for(const [half,rows] of [['a',T.slice(0,4)],['b',T.slice(4)]]){
      const cv=document.createElement('canvas');cv.width=6*124+4;cv.height=rows.length*124+4;const g=cv.getContext('2d');g.fillStyle='#0b0f1a';g.fillRect(0,0,cv.width,cv.height);
      const pv=document.createElement('canvas');pv.width=6*64+3*84+8;pv.height=rows.length*90+4;const q=pv.getContext('2d');q.fillStyle='#0b0f1a';q.fillRect(0,0,pv.width,pv.height);q.imageSmoothingEnabled=false;
      rows.forEach(([w,p,bn,s],r)=>{const b=C.BIOMES.find(x=>x.name===bn);for(let h=0;h<3;h++){const sp={...s,h};
        const k=document.createElement('canvas');k.width=k.height=80;const kg=k.getContext('2d');kg.scale(2,2);F.paintCell(kg,b,sp);
        for(const gy of [0,1]){const bx=(gy*3+h)*124+4,oy=r*124+4;for(let y=0;y<3;y++)for(let x=0;x<3;x++){g.fillStyle=(x+y)&1?b.floor1:b.floor0;g.fillRect(bx+x*40,oy+y*40,40,40);}
          g.drawImage(k,bx+40,oy+40,40,40);if(s.kind==='BELT'||s.kind==='STREAM'){g.drawImage(k,bx,oy+40,40,40);g.drawImage(k,bx+80,oy+40,40,40);}else{g.drawImage(k,bx,oy,40,40);}
          if(gy)gray(g,bx,oy,120,120);}
        const c=X.featPxCell(bn,{...sp,exit:false}),rgba=G.cellRGBA(c,c.pal,{biome:b});
        const pc=document.createElement('canvas');pc.width=pc.height=20;pc.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba),20,20),0,0);
        for(const gy of [0,1]){const bx=(gy*3+h)*64+4,oy=r*90+15;q.drawImage(pc,bx,oy,60,60);if(gy)gray(q,bx,oy,60,60);}
        q.drawImage(pc,6*64+8+h*84,r*90+5,80,80);
      }});
      res['2d-'+half]=x2(cv);res['px-'+half]=x2(pv);
    }
    return res;})`);
  for (const [k, v] of Object.entries(d)) writeFileSync(out + "-" + k + ".png", b64png(v));
  console.log("ok", P.errors);
});
