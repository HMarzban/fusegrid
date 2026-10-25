/* Direction D contact sheet: node tools/tileart/sheetd.mjs <out.png> [kinds,comma] [scale=3]. Rows = kind (BELT/STREAM also at dir 1..3), columns = CORE PLUS MAX; runs shown as a 3-piece with the plain floor either side. */
import {writeFileSync} from "node:fs";
import {withPage, b64png} from "./harness.mjs";
const out = process.argv[2], want = (process.argv[3] || "BELT,GLIDE,PLATE,PORTAL,GATE,BLOOM,STREAM,QUICK").split(","), Z = +(process.argv[4] || 3);
const BIO = {BELT: "FACTORY", GLIDE: "ICE", PLATE: "ARENA", PORTAL: "VOID", GATE: "CROWN", BLOOM: "JUNGLE", STREAM: "WATER", QUICK: "SAND"};
await withPage(async (P) => {
  const url = await P.ev(`(async()=>{
    const [F,C]=await Promise.all([import('/src/render/featdraw.js'),import('/src/core/config.js')]);
    const want=${JSON.stringify(want)},BIO=${JSON.stringify(BIO)},Z=${Z},T=40*Z,rows=[];
    for(const k of want){const runs=(k==='BELT'||k==='STREAM');
      if(runs)for(let d=0;d<4;d++)rows.push({k,dir:d,run:true});
      else if(k==='GLIDE'){rows.push({k,run:true,dir:0});rows.push({k,single:true,dir:0});}
      else{rows.push({k,dir:0});if(k==='PLATE')rows.push({k,dir:0,state:1,lit:2});if(k==='GATE'){rows.push({k,dir:0,lit:2});rows.push({k,dir:0,lit:4});}if(k==='PORTAL')rows.push({k,dir:0,pair:3});if(k==='BLOOM')rows.push({k,dir:0,state:1});}}
    const cv=document.createElement('canvas');cv.width=3*(5*T+10)+20;const RH=(r)=>(r.run&&(r.dir||0)%2===1)?3*T+6:T+6;cv.height=rows.reduce((a,r)=>a+RH(r),6);let yy=6;const g=cv.getContext('2d');g.fillStyle='#0b0f1a';g.fillRect(0,0,cv.width,cv.height);
    const cell=(b,spec,x,y)=>{const t=document.createElement('canvas');t.width=t.height=T;const c=t.getContext('2d');c.scale(Z,Z);F.paintCell(c,b,spec);g.drawImage(t,x,y);};
    const floor=(b,par,x,y)=>{g.save();g.translate(x,y);g.scale(Z,Z);g.fillStyle=par?b.floor1:b.floor0;g.fillRect(0,0,40,40);g.restore();};
    rows.forEach((r,ri)=>{const b=C.BIOMES.find(x=>x.name===BIO[r.k]);const y=yy;yy+=RH(r);
      for(let h=0;h<3;h++){let x=10+h*(5*T+10);
        const base={kind:r.k,h,dir:r.dir||0,pair:r.pair||1,lit:r.lit||0,state:r.state||0,gx:1,gy:1,phase:0};
        if(r.run){const horiz=(r.dir||0)%2===0,sp=(i)=>({...base,par:(i+1)&1,outer:horiz?(i===0?['N','S','W']:i===2?['N','S','E']:['N','S']):(i===0?['E','W','N']:i===2?['E','W','S']:['E','W'])});
          if(horiz){floor(b,1,x,y);for(let i=0;i<3;i++)cell(b,sp(i),x+(i+1)*T,y);floor(b,0,x+4*T,y);}
          else{for(let i=0;i<3;i++)cell(b,sp(i),x+T,y+T*i);} }
        else if(r.single)cell(b,{...base,outer:['N','E','S','W'],par:0},x+T,y);
        else cell(b,{...base,outer:['N','E','S','W'],par:0},x+T,y);}});
    return cv.toDataURL('image/png');})()`);
  writeFileSync(out, b64png(url)); console.log("wrote", out, P.errors);
});
