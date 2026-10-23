/* "What we have": the wave-1 prototype painter (tools/tileart/featdraw_before.js,
   a byte copy of e3be7c3's featdraw.js) rendered alone at 192x192, clear bg. */
import {writeFileSync} from "node:fs";
import {withPage, b64png, OUT, TILES} from "./harness.mjs";
const T = TILES.filter((t) => ["BLOOM", "GLIDE", "BELT", "PLATE"].includes(t[3].kind));
await withPage(async (P) => {
  const res = await P.ev(`Promise.all([import('/tools/tileart/featdraw_before.js'),import('/src/core/config.js')]).then(([F,C])=>{const out={};
    for(const [w,p,bn,s] of ${JSON.stringify(T)})for(let h=0;h<3;h++){const cv=document.createElement('canvas');cv.width=cv.height=192;const g=cv.getContext('2d');g.scale(4.8,4.8);
      F.paintCell(g,C.BIOMES.find(b=>b.name===bn),{...s,h});out[w+'-'+p+'-'+['core','plus','max'][h]+'-before']=cv.toDataURL('image/png');}
    return out;})`);
  for (const [k, v] of Object.entries(res)) writeFileSync(OUT + "2d/" + k + ".png", b64png(v));
  console.log(Object.keys(res).length, "files", P.errors);
});
