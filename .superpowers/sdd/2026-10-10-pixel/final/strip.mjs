/* node strip.mjs out.png scale cols "label|file|x,y,w,h" ... -> labelled grid of
   nearest-neighbour enlarged crops (zero deps; composited in headless chrome). */
import {startChrome, cdp, openPage} from "../../../../tools/pixel/shot.mjs";
import {readFileSync, writeFileSync, rmSync} from "node:fs";
const [out, scale, cols, ...specs] = process.argv.slice(2);
const L = specs.map((s) => { const [n, f, r] = s.split("|"); return [n, readFileSync(f).toString("base64"), r.split(",").map(Number)]; });
const chr = await startChrome(false);
try {
  const c = await cdp(chr.ws);
  const S = await openPage(c, {w: 400, h: 300, dpr: 1, mobile: false}, "about:blank");
  const b64 = await S.ev(`(async()=>{const L=${JSON.stringify(L)},k=${+scale},cols=${+cols};const ims=await Promise.all(L.map(([n,b,r])=>new Promise(ok=>{const i=new Image();i.onload=()=>ok([n,i,r]);i.src='data:image/png;base64,'+b;})));
   const cw=Math.max(...ims.map(q=>q[2][2]*k))+8,ch=Math.max(...ims.map(q=>q[2][3]*k))+26,rows=Math.ceil(ims.length/cols),cv=document.createElement('canvas');cv.width=cols*cw;cv.height=rows*ch;const x=cv.getContext('2d');x.fillStyle='#101014';x.fillRect(0,0,cv.width,cv.height);x.imageSmoothingEnabled=false;
   ims.forEach(([n,i,r],j)=>{const cx=(j%cols)*cw,cy=Math.floor(j/cols)*ch;x.drawImage(i,r[0],r[1],r[2],r[3],cx+4,cy+22,r[2]*k,r[3]*k);x.fillStyle='#ffd447';x.font='bold 14px monospace';x.fillText(n,cx+6,cy+16);});
   return cv.toDataURL('image/png').split(',')[1];})()`);
  writeFileSync(out, Buffer.from(b64, "base64"));
  c.close();
} finally { chr.proc.kill("SIGKILL"); try { rmSync(chr.dir, {recursive: true, force: true}); } catch {} }
