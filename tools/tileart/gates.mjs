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
    if(pass==='lit'){const P=F.BUILT_FOR_TESTS[spec.kind];P.lit(g,F.kOf(b,spec));}else F.paintCell(g,b,spec);return Array.from(g.getImageData(0,0,S,S).data);};
  const out={lit:[],seam:[]};
  for(let h=0;h<3;h++)for(let dir=0;dir<4;dir++){const sp={kind:'BELT',h,dir,outer:['N','S','E','W'].filter(s=>false),pair:1};
    out.lit.push({h,dir,a:px(bio('FACTORY'),{kind:'BELT',h,dir,outer:['N','S'],phase:0},'lit')});}
  for(let h=0;h<3;h++){
    const mid=(k,b,o)=>px(bio(b),{kind:k,h,outer:['N','S'],dir:0,phase:0,gx:1,gy:0,par:1,...o});
    out.seam.push({kind:'BELT',h,axis:'x',a:mid('BELT','FACTORY',{}),b:mid('BELT','FACTORY',{par:0})});
    out.seam.push({kind:'GLIDE',h,axis:'x',a:mid('GLIDE','ICE',{}),b:mid('GLIDE','ICE',{par:0})});
    out.seam.push({kind:'GLIDE',h,axis:'y',a:px(bio('ICE'),{kind:'GLIDE',h,outer:['E','W'],gx:2,gy:1,par:1}),b:px(bio('ICE'),{kind:'GLIDE',h,outer:['E','W'],gx:2,gy:2,par:0})});
  }
  return out;})()`;
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? "PASS " : "FAIL ") + m); };
const which = process.argv[2] || "built";
await withPage(async (P) => {
  const r = await P.ev(PAGE);
  for (const t of r.lit) { const s = litSkew(t.a, 160); ok(s.dSkew > 2, `BELT lit pass keeps the key top-left h${t.h} dir${t.dir} (skew ${s.dSkew.toFixed(1)})`); }
  for (const t of r.seam) { const d = seam(t.a, t.b, 160, t.axis); ok(d <= 6, `${t.kind} h${t.h} seam ${t.axis} (${d.toFixed(2)} <= 6)`); }
});
if (fails.length) { console.log(fails.length + " FAILED"); process.exit(1); }
console.log("all gates pass (" + which + ")");
