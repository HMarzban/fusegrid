/* Direction D pixel gates (2026-10-25). Real painters rendered at 4x (160 px) in headless Chrome; the checks are pure functions over RGBA arrays (exported, Node-testable).
   node tools/tileart/gates.mjs <built|living|all> */
import {withPage} from "./harness.mjs";
const L = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
/* lit-only pass: white strips must sit NW of black strips (key light top-left) */
export function litSkew(a, S) {
  let w = 0, wx = 0, bk = 0, bx = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] < 8) continue;
    const p = (i / 4) | 0, x = p % S, y = (p / S) | 0, v = a[i] > 128 ? 1 : 0, al = a[i + 3] / 255;
    if (v) { w += al; wx += al * (x + y); } else { bk += al; bx += al * (x + y); }
  }
  return {white: w, black: bk, dSkew: bk && w ? bx / bk - wx / w : 0};
}
/* mean abs RGB difference between two edge columns/rows of 160 px tiles */
export function seam(a, b, S, axis) {
  let d = 0;
  for (let t = 0; t < S; t++) for (let c = 0; c < 3; c++) {
    const ia = axis === "x" ? (t * S + S - 1) * 4 + c : ((S - 1) * S + t) * 4 + c, ib = axis === "x" ? (t * S) * 4 + c : t * 4 + c;
    d += Math.abs(a[ia] - b[ib]);
  }
  return d / (S * 3);
}
const PAGE = `(async()=>{
  const [F,C]=await Promise.all([import('/src/render/featdraw.js'),import('/src/core/config.js')]);
  const S=160,bio=n=>C.BIOMES.find(x=>x.name===n);
  const px=(b,spec,pass)=>{const cv=document.createElement('canvas');cv.width=cv.height=S;const g=cv.getContext('2d');g.scale(4,4);
    if(pass==='lit'){const P=F.PAINTERS[spec.kind];P.lit(g,F.kOf(b,spec));}else F.paintCell(g,b,spec);return Array.from(g.getImageData(0,0,S,S).data);};
  const out={lit:[],seam:[]};
  for(let h=0;h<3;h++)for(let dir=0;dir<4;dir++){const sp={kind:'BELT',h,dir,outer:['N','S','E','W'].filter(s=>false),pair:1};
    out.lit.push({h,dir,a:px(bio('FACTORY'),{kind:'BELT',h,dir,outer:['N','S'],phase:0},'lit')});}
  for(let h=0;h<3;h++){
    const mid=(k,b,o)=>px(bio(b),{kind:k,h,outer:['N','S'],dir:0,phase:0,gx:1,gy:0,par:1,...o});
    out.seam.push({kind:'BELT',h,axis:'x',a:mid('BELT','FACTORY',{}),b:mid('BELT','FACTORY',{par:0})});
    out.seam.push({kind:'GLIDE',h,axis:'x',a:mid('GLIDE','ICE',{}),b:mid('GLIDE','ICE',{par:0})});
    out.seam.push({kind:'GLIDE',h,axis:'y',a:px(bio('ICE'),{kind:'GLIDE',h,outer:['E','W'],gx:2,gy:1,par:1}),b:px(bio('ICE'),{kind:'GLIDE',h,outer:['E','W'],gx:2,gy:2,par:0})});
  }
  out.str=[];out.sseam=[];out.mouth=[];
  const HW=[12.5,11.5,9.5];
  for(let h=0;h<3;h++){for(let dir=0;dir<4;dir++){const horiz=dir%2===0;out.str.push({h,dir,a:px(bio('WATER'),{kind:'STREAM',h,dir,outer:horiz?['N','S']:['E','W'],phase:0,par:1})});}
    const m=(o)=>px(bio('WATER'),{kind:'STREAM',h,dir:0,outer:['N','S'],phase:0,par:1,...o});
    out.sseam.push({h,axis:'x',a:m({}),b:m({})});
    out.sseam.push({h,axis:'y',a:px(bio('WATER'),{kind:'STREAM',h,dir:1,outer:['E','W'],phase:0,par:1}),b:px(bio('WATER'),{kind:'STREAM',h,dir:1,outer:['E','W'],phase:0,par:1})});
    out.mouth.push({h,end:m({outer:['N','S','W']}),mid:m({}),endE:m({outer:['N','S','E']})});}
  out.hw=HW;
  return out;})()`;
/* channel light: the sunk channel's NW inner band must be darker than its SE inner band (mean L over 3-unit bands) */
export function channelLight(a, S, hw, dir) {
  const U = S / 40, band = (lo, hi) => { let t = 0, n = 0; for (let y = 0; y < S; y++) for (let x = 8 * U; x < 32 * U; x++) { const u = dir % 2 === 0 ? y : x, v = dir % 2 === 0 ? x : y; if (u >= lo * U && u < hi * U && v >= 8 * U && v < 32 * U) { const i = (y * S + x) * 4; t += L(a[i], a[i + 1], a[i + 2]); n++; } } return t / n; };
  return band(20 + hw - 3, 20 + hw) - band(20 - hw, 20 - hw + 3);
}
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? "PASS " : "FAIL ") + m); };
const which = process.argv[2] || "built";
await withPage(async (P) => {
  const r = await P.ev(PAGE);
  for (const t of r.lit) { const s = litSkew(t.a, 160); ok(s.dSkew > 2, `BELT lit pass keeps the key top-left h${t.h} dir${t.dir} (skew ${s.dSkew.toFixed(1)})`); }
  for (const t of r.seam) { const d = seam(t.a, t.b, 160, t.axis); ok(d <= 6, `${t.kind} h${t.h} seam ${t.axis} (${d.toFixed(2)} <= 6)`); }
  for (const t of r.str) { const d = channelLight(t.a, 160, r.hw[t.h], t.dir); ok(d > 0, `STREAM light stays top-left h${t.h} dir${t.dir} (SE band - NW band = ${d.toFixed(1)} > 0)`); }
  for (const t of r.sseam) { const d = seam(t.a, t.b, 160, t.axis); ok(d <= 6, `STREAM h${t.h} seam ${t.axis} (${d.toFixed(2)} <= 6)`); }
  for (const t of r.mouth) { const e = seam(t.end, t.mid, 160, "x"), m = seam(t.mid, t.endE, 160, "x"); ok(e <= 6 && m <= 6, `STREAM h${t.h} run ends meet the middle (${e.toFixed(2)}, ${m.toFixed(2)} <= 6)`); }
});
if (fails.length) { console.log(fails.length + " FAILED"); process.exit(1); }
console.log("all gates pass (" + which + ")");
