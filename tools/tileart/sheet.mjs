/* Review sheet (not a deliverable): every tile x heat at 192 (export size)
   and at 80 / 40 (the in-game 2D bake and its on-screen size), on the
   biome's floor checker with a wall + brick neighbour for the lane check. */
import {writeFileSync} from "node:fs";
import {withPage, b64png, TILES} from "./harness.mjs";
const out = process.argv[2];
await withPage(async (P) => {
  const d = await P.ev(`Promise.all([import('/src/render/featdraw.js'),import('/src/core/config.js'),import('/src/render/sprites.js')]).then(([F,C,S])=>{
    const T=${JSON.stringify(TILES)},cv=document.createElement('canvas');cv.width=3*200+3*92+40;cv.height=T.length*200+10;const g=cv.getContext('2d');g.fillStyle='#0b0f1a';g.fillRect(0,0,cv.width,cv.height);
    T.forEach(([w,p,bn,s],r)=>{const b=C.BIOMES.find(x=>x.name===bn);for(let h=0;h<3;h++){g.save();g.translate(h*200,r*200);g.scale(4.8,4.8);F.paintCell(g,b,{...s,h});g.restore();
      g.save();g.translate(600+h*92,r*200);for(let y=0;y<3;y++)for(let x=0;x<2;x++){g.fillStyle=(x+y)&1?b.floor1:b.floor0;g.fillRect(x*40,y*40,40,40);}
      g.fillStyle=b.wall;g.fillRect(0,80,40,40);g.fillStyle=b.wallHi;g.fillRect(3,83,34,16);g.fillStyle=b.brickB;g.fillRect(41,81,38,38);g.fillStyle=b.brickA;g.fillRect(42,82,36,18);
      const k=document.createElement('canvas');k.width=k.height=80;const kg=k.getContext('2d');kg.scale(2,2);F.paintCell(kg,b,{...s,h});g.drawImage(k,0,0,80,80);g.drawImage(k,40,40,40,40);g.restore();}});
    return cv.toDataURL('image/png');})`);
  writeFileSync(out, b64png(d));
  console.log("ok", P.errors);
});
