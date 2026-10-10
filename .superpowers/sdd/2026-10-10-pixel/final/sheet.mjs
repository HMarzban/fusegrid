/* Contact sheets from report.json: rows = scenes, cols = PIXEL / CLASSIC 2D /
   REAL 3D x laptop / phone. contact.png = everything; contact-<part>.png =
   readable slices. Composited in headless chrome (zero deps). */
import {startChrome, cdp, openPage} from "../../../../tools/pixel/shot.mjs";
import {readFileSync, writeFileSync, rmSync} from "node:fs";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const rep = JSON.parse(readFileSync(join(DIR, "report.json"), "utf8"));
const COLS = ["px-lap", "2d-lap", "3d-lap", "px-phone", "2d-phone", "3d-phone"];
const NAME = {px: "PIXEL", "2d": "CLASSIC 2D", "3d": "REAL 3D", lap: "laptop k2.77", phone: "phone 390x844@3"};
const by = {};
for (const r of rep) for (const s of r.steps) (by[s.n] ||= {})[r.tag] = s;
const PARTS = {
  opening: ["title", "show1", "show2", "show3", "menu"],
  shell: ["guide", "howto", "items", "enemies", "options", "graphics"],
  rooms: ["room1", "room2", "room3", "room4", "room5", "room6", "room7", "room8"],
  play: ["game", "fat", "pickups", "label", "bar", "ghost", "pause", "lose", "win"],
};
const ALL = Object.values(PARTS).flat();
async function build(S, rows, file, CW, CH) {
  const cells = [];
  for (const n of rows) for (const t of COLS) { const s = by[n] && by[n][t]; cells.push(s ? [n, t, readFileSync(s.f).toString("base64"), s.crop] : [n, t, null, null]); }
  const b64 = await S.ev(`(async()=>{const L=${JSON.stringify(cells)},NAME=${JSON.stringify(NAME)},COLS=${JSON.stringify(COLS)},rows=${JSON.stringify(rows)};
   const ims=await Promise.all(L.map(([n,t,b,cr])=>b?new Promise(ok=>{const i=new Image();i.onload=()=>ok([n,t,i,cr||[0,0,i.width,i.height]]);i.src='data:image/png;base64,'+b;}):[n,t,null,null]));
   const CW=${CW},CH=${CH},LH=22,TOP=34,LW=110,cv=document.createElement('canvas');cv.width=LW+COLS.length*CW;cv.height=TOP+rows.length*(CH+LH);const x=cv.getContext('2d');x.fillStyle='#101014';x.fillRect(0,0,cv.width,cv.height);
   x.font='bold 16px monospace';x.fillStyle='#ffd447';COLS.forEach((t,c)=>{const [r,v]=t.split('-');x.fillText(NAME[r]+' / '+NAME[v],LW+c*CW+6,22);});
   ims.forEach(([n,t,i,r],k)=>{const c=k%COLS.length,rw=Math.floor(k/COLS.length),cx=LW+c*CW,cy=TOP+rw*(CH+LH);if(c===0){x.fillStyle='#fff';x.font='bold 16px monospace';x.fillText(n,8,cy+LH+CH/2);}
    x.fillStyle='#9aa';x.font='12px monospace';x.fillText(n+' '+t,cx+6,cy+15);if(!i){x.fillStyle='#f44';x.fillText('MISSING',cx+20,cy+60);return;}
    const s=Math.min((CW-6)/r[2],CH/r[3]),w=r[2]*s,h=r[3]*s;x.imageSmoothingQuality='high';x.drawImage(i,r[0],r[1],r[2],r[3],cx+(CW-w)/2,cy+LH,w,h);});
   return cv.toDataURL('image/png').split(',')[1];})()`);
  writeFileSync(join(DIR, file), Buffer.from(b64, "base64"));
}
const chr = await startChrome(false);
try {
  const c = await cdp(chr.ws);
  const S = await openPage(c, {w: 400, h: 300, dpr: 1, mobile: false}, "about:blank");
  await build(S, ALL, "contact.png", 340, 300);
  for (const [p, rows] of Object.entries(PARTS)) await build(S, rows, "contact-" + p + ".png", 520, 460);
  c.close();
} finally {
  chr.proc.kill("SIGKILL");
  try { rmSync(chr.dir, {recursive: true, force: true}); } catch {}
}
