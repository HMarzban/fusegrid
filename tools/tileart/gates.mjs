/* Direction D pixel gates (2026-10-25). Real painters rendered at 4x (160 px) in headless Chrome; the checks are pure functions over RGBA arrays (exported, Node-testable).
   node tools/tileart/gates.mjs <built|living|read|cvd|all>; cvd = the colour-vision gate (#33): CLASSIC 2D in Chrome here, PIXEL in pure Node (also tests/tile-cvd.test.mjs) */
import {readFileSync, existsSync} from "node:fs";
import {withPage, TILES} from "./harness.mjs";
import {unpng} from "../pixel/rgba.mjs";
import {litSkew, seam, channelLight, figure, heatSep, slotOnly, maxLum, lum, dE, rgbOf, edgeEnergy, cvdSep, CVD_PIN, CVD_WAIVE} from "./gatefns.mjs";
import {CVD_ENT, RULED, pxSets} from "./cvdsets.mjs";
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
/* the readability set: every tile x heat (plus the worst states) in the D painter and the round-3 painter, same specs, 160 px */
const EXTRA = [["arena", "trap-wind", "ARENA", {kind: "PLATE", state: 1, lit: 4}], ["crown", "gate-shut", "CROWN", {kind: "GATE", lit: 4}], ["jungle", "booster-flare", "JUNGLE", {kind: "BLOOM", state: 1}], ["void", "portal-3", "VOID", {kind: "PORTAL", pair: 3}]];
const ENT = [...TILES.map(([w, p, bn, s]) => [w, p, bn, s.kind === "BELT" ? {...s, exit: true} : s]), ...EXTRA].map(([w, p, bn, s]) => [w, p, bn, s.kind === "BELT" ? s : {outer: ["N", "E", "S", "W"], ...s}]);
const PAGE2 = `(async()=>{
  const [F,R3,C]=await Promise.all([import('/src/render/featdraw.js'),import('/tools/tileart/featdraw_r3.js'),import('/src/core/config.js')]);
  const S=160,out=[];
  const px=(M,b,sp)=>{const cv=document.createElement('canvas');cv.width=cv.height=S;const g=cv.getContext('2d');g.scale(4,4);M.paintCell(g,b,sp);return Array.from(g.getImageData(0,0,S,S).data);};
  for(const [w,p,bn,s] of ${JSON.stringify(ENT)}){const b=C.BIOMES.find(x=>x.name===bn);
    out.push({id:w+'-'+p,bn,heats:[0,1,2].map(h=>({d:px(F,b,{...s,h}),r:px(R3,b,{...s,h})}))});}
  return out;})()`;
/* CLASSIC 2D colour-vision inputs: the same CVD_ENT tiles x heat, the base floor (2 parities x FLOOR_V), the interior wall codes 0..3 and the brick over both floors */
const PAGE3 = `(async()=>{
  const [F,FL,SP,C]=await Promise.all([import('/src/render/featdraw.js'),import('/src/render/floorart.js'),import('/src/render/sprites.js'),import('/src/core/config.js')]);
  const S=160,out=[],refs={};
  const cvs=(fn)=>{const cv=document.createElement('canvas');cv.width=cv.height=S;const g=cv.getContext('2d');g.scale(4,4);fn(g);return Array.from(g.getImageData(0,0,S,S).data);};
  for(const [id,bn,s] of ${JSON.stringify(CVD_ENT)}){const b=C.BIOMES.find(x=>x.name===bn),V=[...Array(FL.FLOOR_V).keys()];
    refs[bn]=refs[bn]||{floor:[0,1].flatMap(p=>V.map(v=>cvs(g=>FL.paintFloor(g,b,p,v)))),wall:[0,1].flatMap(p=>[0,1,2,3].map(c=>cvs(g=>{FL.paintFloor(g,b,p,0);SP.paintWall(g,b,c,0,0);}))),
      brick:[0,1].map(p=>cvs(g=>{FL.paintFloor(g,b,p,0);SP.paintBrick(g,b);})),brickHex:[b.brickA,b.brickB]};
    out.push({id,bn,heats:[0,1,2].map(h=>cvs(g=>F.paintCell(g,b,{...s,h}))),ref:bn});}
  return {out,refs};})()`;
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); console.log((c ? "PASS " : "FAIL ") + m); };
const which = process.argv[2] || "built";
await withPage(async (P) => {
  const r = await P.ev(PAGE);
  if (which === "all" || which === "built" || which === "living") {
  for (const t of r.lit) { const s = litSkew(t.a, 160); ok(s.dSkew > 2, `BELT lit pass keeps the key top-left h${t.h} dir${t.dir} (skew ${s.dSkew.toFixed(1)})`); }
  for (const t of r.seam) { const d = seam(t.a, t.b, 160, t.axis); ok(d <= 6, `${t.kind} h${t.h} seam ${t.axis} (${d.toFixed(2)} <= 6)`); }
  for (const t of r.str) { const d = channelLight(t.a, 160, r.hw[t.h], t.dir); ok(d > 0, `STREAM light stays top-left h${t.h} dir${t.dir} (SE band - NW band = ${d.toFixed(1)} > 0)`); }
  for (const t of r.sseam) { const d = seam(t.a, t.b, 160, t.axis, 20 - r.hw[t.h], 20 + r.hw[t.h]); ok(d <= 6, `STREAM h${t.h} seam ${t.axis} (${d.toFixed(2)} <= 6)`); }
  for (const t of r.mouth) { const e = seam(t.end, t.mid, 160, "x", 20 - r.hw[t.h], 20 + r.hw[t.h]), m = seam(t.mid, t.endE, 160, "x", 20 - r.hw[t.h], 20 + r.hw[t.h]); ok(e <= 6 && m <= 6, `STREAM h${t.h} run ends meet the middle (${e.toFixed(2)}, ${m.toFixed(2)} <= 6)`); }
  }
  if (which === "all" || which === "read") {
    const R = await P.ev(PAGE2), BIO = await P.ev(`import('/src/core/config.js').then(C=>C.BIOMES)`);
    const rows = [];
    for (const e of R) {
      const b = BIO.find((x) => x.name === e.bn), V = [b.bg0, b.bg1, b.floor0, b.floor1, b.wall, b.wallHi].map(rgbOf).concat([[0, 0, 0], [255, 255, 255]]);
      const D = e.heats.map((x) => figure(x.d)), Rr = e.heats.map((x) => figure(x.r));
      e.heats.forEach((x, h) => {
        const tag = `${e.id} h${h}`;
        const ee = edgeEnergy(e.heats[h].d, 160), er = edgeEnergy(e.heats[h].r, 160);
        ok(ee <= er * 1.6, `${tag} busyness ${ee.toFixed(2)} <= 1.6 x round3 ${er.toFixed(2)}`);
        const bd = [b.brickA, b.brickB].map((c) => dE(D[h].bed, rgbOf(c)));
        ok(Math.min(...bd) >= 14, `${tag} bed vs BRICK dE ${Math.min(...bd).toFixed(1)} >= 14`);
        rows.push({tag, busy: +ee.toFixed(2), r3busy: +er.toFixed(2), cov: +D[h].cov.toFixed(1), r3cov: +Rr[h].cov.toFixed(1), dL: +D[h].dL.toFixed(1), cvd: +D[h].cvd.toFixed(1), dEwall: +dE(D[h].bed, rgbOf(b.wall)).toFixed(1), dEbrickB: +bd[1].toFixed(1)});
      });
      for (const [a, c] of [[0, 1], [1, 2], [0, 2]]) {
        const d = heatSep(e.heats[a].d, e.heats[c].d, 160), r = heatSep(e.heats[a].r, e.heats[c].r, 160);
        ok(d >= 4, `${e.id} heat ${a}-${c} separation ${d.toFixed(1)} >= 4 (round3 ${r.toFixed(1)})`);
      }
      e.heats.forEach((x, h) => { const w = slotOnly(x.d, V); ok(w <= 8, `${e.id} h${h} colours inside the slot hull (worst dE ${w.toFixed(1)} <= 8)`); });
      if (e.bn === "VOID") e.heats.forEach((x, h) => { const m = maxLum(x.d), cap = lum(...rgbOf(b.wallHi)); ok(m <= cap + 1.5, `${e.id} h${h} VOID dim rule: max luma ${m.toFixed(1)} <= wallHi ${cap.toFixed(1)}`); });
    }
    console.log(JSON.stringify(rows).replace(/},{/g, "},\n{"));
  }
  if (which === "all" || which === "cvd") {
    const {out, refs} = await P.ev(PAGE3), U = (L) => L.map((a) => Uint8ClampedArray.from(a)), R = {};
    for (const [bn, f] of Object.entries(refs)) R[bn] = {floor: U(f.floor), wall: U(f.wall), brick: U(f.brick), brickHex: f.brickHex};
    cvdGate("CLASSIC", out.map((e) => ({id: e.id, bn: e.bn, heats: U(e.heats), ...R[e.ref]})), true);
  }
});
/* colour-vision gate: per tile (rules first), the worst simulated value of each pin over protan / deutan / tritan x CORE / PLUS / MAX */
function cvdGate(look, sets, bed) {
  const H = ["CORE", "PLUS", "MAX"], keys = ["floorL", "floorE", "wallL", "wallE", "brickL", "brickE", "bedBrick"];
  for (const s of [...sets].sort((a, b) => RULED.has(b.id) - RULED.has(a.id))) {
    const r = cvdSep(s, 160, ["none", "protan", "deutan", "tritan"]), sim = r.rows.filter((x) => x.cvd !== "none"), tag = `${look} ${s.bn} ${s.id}${RULED.has(s.id) ? " (rules)" : ""}`;
    for (const k of keys) {
      const w = sim.reduce((a, x) => (x[k] < a[k] ? x : a)), n = r.rows.find((x) => x.cvd === "none" && x.h === w.h)[k], msg = `${tag} CVD ${k} ${w[k].toFixed(1)} (${H[w.h]} ${w.cvd}; normal ${n.toFixed(1)})`;
      if (k === "bedBrick" && !bed) console.log("INFO " + msg + " (not gated in this look)"); else ok(w[k] >= CVD_PIN[k], msg + " >= " + CVD_PIN[k]);
    }
    const hw = r.heat.filter((x) => x.cvd !== "none").reduce((a, x) => (x.d < a.d ? x : a));
    const wv = CVD_WAIVE[`${look} ${s.id} heat`], hp = wv ? wv.pin : CVD_PIN.heat, hm = `${tag} CVD heat separation ${hw.d.toFixed(2)} (${H[hw.a]}-${H[hw.c]} ${hw.cvd}) >= ${hp}`;
    ok(hw.d >= hp, hm + (wv ? ` WAIVED from ${CVD_PIN.heat} (normal vision ${wv.normal}; ${wv.issue})` : ""));
  }
}
if (which === "all" || which === "cvd") cvdGate("PIXEL", pxSets(), false);
/* REAL 3D stills (node tools/tileart/export.mjs first, TILEART_OUT=<dir>): the lit, relief-shaded PORTAL never passes wallHi's luma */
const dir3 = process.argv[3];
if (dir3) for (const h of ["core", "plus", "max"]) { const f = dir3 + "/3d/void-portal-" + h + ".png"; if (!existsSync(f)) continue; const m = maxLum(unpng(readFileSync(f)).data), cap = lum(...rgbOf("#8a70b0")); ok(m <= cap + 1.5, `REAL 3D PORTAL ${h} max luma ${m.toFixed(1)} <= wallHi ${cap.toFixed(1)}`); }
if (fails.length) { console.log(fails.length + " FAILED"); process.exit(1); }
console.log("all gates pass (" + which + ")");
