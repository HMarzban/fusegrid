import {startServer, startChrome, cdp, openPage} from "../../../../tools/pixel/shot.mjs";
import {writeFileSync, readFileSync, rmSync} from "node:fs";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEW = {desk: {w: 1280, h: 800, dpr: 1, mobile: false}, phone: {w: 390, h: 844, dpr: 3, mobile: true}, land: {w: 844, h: 390, dpr: 3, mobile: true}};
const only = process.argv[2] || "";
const RUNS = [];
for (const r of ["2d", "3d", "px"]) for (const v of ["desk", "phone", "land"]) RUNS.push([r, v]);

const HELP = `window.__V=(async()=>{const E=await import('/src/core/entities.js'),C=await import('/src/core/config.js'),FX=await import('/src/render/fx.js');
const g=()=>window.__GAME__.G,P=()=>g().players[0];
window.__txt=[];const ft=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(s,x,y,m){if(this.canvas&&this.canvas.id==='c')window.__txt.push(String(s));return ft.call(this,s,x,y,m);};
const r=window.__GAME__.renderer,ro=r.render.bind(r);r.render=(w,dt,o)=>{window.__O=o;return ro(w,dt,o);};
const V={E,C,FX,
 tp(){const G=g(),p=P();let best=null;for(let y=3;y<10;y++)for(let x=3;x<12;x++){if(G.grid[C.key(x,y)]!==C.T.EMPTY)continue;const d=Math.abs(x-7)+Math.abs(y-6);if(!best||d<best[2])best=[x,y,d];}
   p.x=(best[0]+.5)*40;p.y=(best[1]+.5)*40;p.iFrames=999;for(const e of G.enemies){const dx=e.x-p.x,dy=e.y-p.y;if(dx*dx+dy*dy<160*160){e.x=1.5*40;e.y=11.5*40;}}return best;},
 give(...ks){const p=P();for(const k of ks){const d=E.POWER.find(q=>q.t===k);g().items.push({x:p.x,y:p.y,t:k,col:d.col,pdef:d,taken:false,buried:false});}},
 lbl(){return FX.getLabels().map(l=>l.s+(l.m?' '+l.m:'')+(l.sub?' ['+l.sub+']':'')+(l.sup?' (sup)':'')+'@'+l.t.toFixed(2));},
 c2(){const o=window.__O;return o&&o.coach2?{a:+(o.coach2.a||0).toFixed(2),s:o.coach2.s,k:o.coach2.k}:null;},
 txt(){const s=[...new Set(window.__txt)];window.__txt=[];return s;},
 bar(){return FX.abilityList(P());}};
return V;})()`;
const ev = (P, s) => P.ev(`window.__V.then(V=>(${s}))`);

const srv = await startServer();
const chr = await startChrome(false);
const report = [];
const shots = [];
try {
  const c = await cdp(chr.ws);
  for (const [render, v] of RUNS) {
    const tag = render + "-" + v;
    if (only && !tag.includes(only)) continue;
    const a = VIEW[v];
    const url = "http://127.0.0.1:" + srv.port + "/index.html?render=" + render + "&play=1&debug=1";
    const P = await openPage(c, a, url);
    await P.ev(`try{localStorage.clear();localStorage.setItem('nb.coach.v1','1');}catch(e){}`);
    await P.S("Page.reload", {});
    await sleep(500);
    for (let i = 0; i < 100; i++) { await sleep(100); if (await P.ev("!!(window.__GAME__&&document.readyState==='complete'&&window.__GAME__.G.state==='PLAY')").catch(() => false)) break; }
    await sleep(1200);
    await P.ev(HELP);
    const row = {tag, steps: {}};
    const snap = async (n, extra) => {
      const f = join(OUT, tag + "-" + n + ".png");
      await P.shot(f);
      const cr = v === "phone" ? await P.ev(`(()=>{const d=devicePixelRatio,c=document.getElementById('c').getBoundingClientRect();let b=c.bottom;for(const id of ['tthrow','tremote','tbomb']){const e=document.getElementById(id);if(e&&!e.hidden&&e.offsetParent){const r=e.getBoundingClientRect();if(r.bottom>b&&r.top<c.bottom+120)b=r.bottom;}}return [0,Math.max(0,(c.top-8)*d),innerWidth*d,(b-c.top+16)*d];})()`) : null;
      shots.push([tag + " " + n, f, cr]);
      row.steps[n] = {lbl: await ev(P, "V.lbl()"), c2: await ev(P, "V.c2()"), bar: await ev(P, "V.bar()"), txt: await ev(P, "V.txt()"), ...(extra || {})};
    };
    row.tp = await ev(P, "V.tp()");
    await ev(P, "V.give('kick')"); await sleep(350);
    await snap("first-kick");
    await sleep(3200);
    await ev(P, "V.txt()");
    await ev(P, "V.tp(),V.give('fire','bomb','speed')"); await sleep(300);
    await snap("multi3");
    await sleep(1100);
    await ev(P, "(P=>{P.range=7;})(window.__GAME__.G.players[0])");
    await ev(P, "V.give('power')"); await sleep(1000);
    await ev(P, "V.give('fire','line')"); await sleep(300);
    await snap("max-swap");
    await sleep(1100);
    for (const k of ["shield", "throw", "pass", "pierce", "remote", "speed"]) { await ev(P, `V.give('${k}')`); await sleep(120); }
    await sleep(3400);
    const firstSeen = await P.ev("localStorage.getItem('nb.coach.v2')");
    await snap("bar", {store: firstSeen});
    if (a.mobile) {
      const rect = await P.ev(`(()=>{const q=(id)=>{const e=document.getElementById(id);const r=e.getBoundingClientRect();return {h:e.hidden,r:[r.left,r.top,r.right,r.bottom]};};return {thr:q('tthrow'),rem:q('tremote'),bomb:q('tbomb')};})()`);
      const tap = async (rr) => { const x = (rr[0] + rr[2]) / 2, y = (rr[1] + rr[3]) / 2;
        await P.S("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [{x, y, id: 1}]}); await sleep(60);
        await P.S("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []}); await sleep(120); };
      const b0 = await P.ev("window.__GAME__.G.bombs.length");
      await P.ev("(()=>{const p=window.__GAME__.G.players[0];p.face={x:0,y:1};})()");
      if (!rect.thr.h) await tap(rect.thr.r);
      const thrown = await P.ev("(()=>{const G=window.__GAME__.G,p=G.players[0];return G.bombs.filter(b=>!b.dead).map(b=>[Math.round(b.x-p.x),Math.round(b.y-p.y)]);})()");
      await sleep(150);
      await snap("touch-thrown", {rect, b0, thrown});
      if (!rect.rem.h) await tap(rect.rem.r);
      await sleep(120);
      row.touch = {rect, b0, thrown, after: await P.ev("window.__GAME__.G.bombs.filter(b=>!b.dead).length")};
      await sleep(1500);
    }
    await ev(P, "V.give('kick')"); await sleep(200);
    await P.ev("import('/src/core/entities.js').then(E=>{const G=window.__GAME__.G;G.lives=Math.max(G.lives,3);E.hurtPlayer(G);})");
    await sleep(250);
    await snap("hit-fade");
    await sleep(1200);
    await ev(P, "V.tp(),V.give('kick')"); await sleep(300);
    await snap("repeat-kick");
    await sleep(1200);
    await ev(P, "V.give('heart')"); await sleep(250);
    await P.ev("window.__pause&&window.__pause()"); await sleep(1500);
    await snap("pause-label");
    await P.ev("window.__resume?window.__resume():window.__pause()"); await sleep(1200);
    await ev(P, "V.FX.setFxOpts({flashK:0.25,shakeK:1})");
    await ev(P, "V.tp(),V.give('bomb')");
    const ys = [];
    for (let i = 0; i < 6; i++) { await sleep(120); ys.push(await ev(P, "(()=>{const l=V.FX.getLabels()[0];if(!l)return null;const b=V.FX.labelBox(l,null,true,null,0,0),m=V.FX.labelBox(l,null,false,null,0,0);return [l.t.toFixed(2),b.y,m.y];})()")); }
    await snap("reduce-flash", {ys});
    await ev(P, "V.FX.setFxOpts({flashK:1,shakeK:1})");
    row.state = await P.ev("window.__GAME__.state()");
    row.errors = P.errors;
    report.push(row);
    console.log(tag, JSON.stringify(row).slice(0, 1500));
    await P.S("Page.close", {}).catch(() => {});
  }
  for (const n of ["3d-cam1", "3d-cam2", "3d-cam0-dollyin", "3d-cam0-dollyout"]) { try { readFileSync(join(OUT, n + ".png")); shots.push([n + " labels", join(OUT, n + ".png"), null]); } catch {} }
  const files = shots.map(([n, f, cr]) => [n, readFileSync(f).toString("base64"), cr]);
  const S = await openPage(c, {w: 400, h: 300, dpr: 1, mobile: false}, "about:blank");
  const sheet = await S.ev(`(async()=>{const L=${JSON.stringify(files)};const ims=await Promise.all(L.map(([n,b,cr])=>new Promise(ok=>{const i=new Image();i.onload=()=>ok([n,i,cr||[0,0,i.width,i.height]]);i.src='data:image/png;base64,'+b;})));
   const CW=480,CH=340,cols=8,rows=Math.ceil(ims.length/cols),cv=document.createElement('canvas');cv.width=cols*CW;cv.height=rows*(CH+22);const x=cv.getContext('2d');x.fillStyle='#111';x.fillRect(0,0,cv.width,cv.height);
   ims.forEach(([n,i,r],k)=>{const cx=(k%cols)*CW,cy=Math.floor(k/cols)*(CH+22),s=Math.min((CW-6)/r[2],CH/r[3]),w=r[2]*s,h=r[3]*s;x.drawImage(i,r[0],r[1],r[2],r[3],cx+(CW-w)/2,cy+22,w,h);x.fillStyle='#fff';x.font='bold 15px monospace';x.fillText(n,cx+6,cy+16);});
   return cv.toDataURL('image/png').split(',')[1];})()`);
  writeFileSync(join(OUT, "contact.png"), Buffer.from(sheet, "base64"));
  c.close();
} finally {
  chr.proc.kill("SIGKILL");
  try { rmSync(chr.dir, {recursive: true, force: true}); } catch {}
  srv.proc.kill("SIGTERM");
}
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 1));
