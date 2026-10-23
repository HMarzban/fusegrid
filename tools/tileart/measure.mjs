/* Readability numbers for notes.md. Per tile x heat, rendered at 4x (160 px):
   cov   = marks-only pass (o.m: bed, texture, light and band base off) alpha
           coverage, worst case (belt exit cap on)
   covT  = full-render pixels within dE76 10 of a mark tone (mk / full)
   bed   = mean colour of the non-mark pixels in the centre 8..32 box; dE vs floor0 / brickB / wall
   dL    = mean L* of the opaque mark px (o.m alpha > 0.85) in the centre box - bed L* (abs); tex = bed L* spread (p95-p5)
   cvd   = min over protan/deutan/tritan of dE(mark, bed) (audit matrices)
   Same labOf / dE as tests/items-art.test.mjs. Prints JSON. */
import {writeFileSync} from "node:fs";
import {withPage, TILES} from "./harness.mjs";
const mod = process.argv[2] || "/src/render/featdraw.js", out = process.argv[3], LIT = +(process.argv[4] || 0);
const T = TILES.map(([w, p, bn, s]) => [w, p, bn, s.kind === "BELT" ? {...s, exit: true} : s.kind === "GATE" && LIT ? {...s, lit: LIT} : s]);
await withPage(async (P) => {
  const res = await P.ev(`Promise.all([import('${mod}'),import('/src/core/config.js')]).then(([F,C])=>{
    const rgb=(h)=>{const n=parseInt(h.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]};
    const lab=([r,g,b])=>{[r,g,b]=[r,g,b].map(v=>v/255);const f=v=>v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);r=f(r);g=f(g);b=f(b);const X=(r*0.4124+g*0.3576+b*0.1805)/0.95047,Y=r*0.2126+g*0.7152+b*0.0722,Z=(r*0.0193+g*0.1192+b*0.9505)/1.08883;const k=t=>t>0.008856?Math.cbrt(t):7.787*t+16/116;return[116*k(Y)-16,500*(k(X)-k(Y)),200*(k(Y)-k(Z))]};
    const dE=(a,b)=>{const A=lab(a),B=lab(b);return Math.hypot(A[0]-B[0],A[1]-B[1],A[2]-B[2])};
    const M={protan:[[0.11238,0.88762,0],[0.11238,0.88762,0],[0.00401,-0.00401,1]],deutan:[[0.29275,0.70725,0],[0.29275,0.70725,0],[-0.02234,0.02234,1]],tritan:[[1,0.14461,-0.14461],[0,0.85659,0.14341],[0,0.85659,0.14341]]};
    const lin=v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4},gam=v=>255*(v<=0.0031308?12.92*v:1.055*Math.max(0,v)**(1/2.4)-0.055);
    const sim=(c,m)=>{const l=c.map(lin);return m.map(r=>Math.max(0,Math.min(255,gam(r[0]*l[0]+r[1]*l[1]+r[2]*l[2]))))};
    const S=160,res=[];
    for(const [w,p,bn,s] of ${JSON.stringify(T)})for(let h=0;h<3;h++){
      const b=C.BIOMES.find(x=>x.name===bn),t=F.tones(b,h),sp={...s,h};
      const cv=document.createElement('canvas');cv.width=cv.height=S;const g=cv.getContext('2d');g.scale(4,4);F.paintCell(g,b,sp,{m:true});
      const a=g.getImageData(0,0,S,S).data;let on=0;for(let i=3;i<a.length;i+=4)on+=a[i]/255;
      const cf=document.createElement('canvas');cf.width=cf.height=S;const gf=cf.getContext('2d');gf.scale(4,4);F.paintCell(gf,b,sp);
      const d=gf.getImageData(0,0,S,S).data,mks=[t.mk,t.full].map(rgb);let mt=0,bed=[0,0,0],nb=0,mc=[0,0,0],nm=0;const Ls=[];
      for(let i=0;i<d.length;i+=4){const c=[d[i],d[i+1],d[i+2]],mark=a[i+3]>128;if(mks.some(m=>dE(c,m)<10))mt++;const px=(i/4)%S,py=((i/4)/S)|0;if(a[i+3]>217&&px>=32&&px<128&&py>=32&&py<128){mc[0]+=c[0];mc[1]+=c[1];mc[2]+=c[2];nm++;}if(!mark&&px>=32&&px<128&&py>=32&&py<128){bed[0]+=c[0];bed[1]+=c[1];bed[2]+=c[2];nb++;Ls.push(lab(c)[0]);}}
      bed=bed.map(v=>v/nb);Ls.sort((x,y)=>x-y);const mk=nm?mc.map(v=>v/nm):rgb(t.mk);
      const r1=v=>Math.round(v*10)/10;
      res.push({tile:w+'-'+p,heat:['core','plus','max'][h],cov:r1(100*on/(S*S)),covT:r1(100*mt/(S*S)),
        bed:'#'+bed.map(v=>Math.round(v).toString(16).padStart(2,'0')).join(''),
        dEfloor0:r1(dE(bed,rgb(b.floor0))),dEbrickB:r1(dE(bed,rgb(b.brickB))),dEwall:r1(dE(bed,rgb(b.wall))),
        dL:r1(Math.abs(lab(mk)[0]-lab(bed)[0])),tex:r1(Ls[Math.floor(Ls.length*0.95)]-Ls[Math.floor(Ls.length*0.05)]),
        cvd:r1(Math.min(...Object.values(M).map(m=>dE(sim(mk,m),sim(bed,m)))))});
    }
    return res;})`);
  const txt = JSON.stringify(res, null, 0).replace(/},{/g, "},\n{");
  if (out) writeFileSync(out, txt);
  console.log(txt);
});
