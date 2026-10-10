import {startServer, startChrome, cdp, openPage} from "../../../../tools/pixel/shot.mjs";
import {writeFileSync, readFileSync, rmSync} from "node:fs";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEW = {desk: {w: 1280, h: 800, dpr: 1, mobile: false}, phone: {w: 390, h: 844, dpr: 3, mobile: true}};
const only = process.argv[2] || "", SUB = process.argv[3] === "sub";
const RUNS = [];
for (const v of ["desk", "phone"]) {
  RUNS.push(["2d", v, 0], ["px", v, 0], ["iso", v, 0]);
  for (const cam of [0, 1, 2]) RUNS.push(["3d", v, cam]);
}
const EV = (k, tx, ty) => `(()=>{const G=window.__GAME__.G,p=G.players[0],c=(t)=>(t+0.5)*40;p.bombKind='${k}';G.events.push({t:'power',x:c(${tx}),y:c(${ty}),col:'#fff',kind:'${k}'});})()`;
const A = `(()=>{const G=window.__GAME__.G,p=G.players[0];p.range=2;p.bombKind='line';p.iFrames=9;})()`;
const A2 = `(()=>{const G=window.__GAME__.G,p=G.players[0],c=(t)=>(t+0.5)*40;p.range=3;p.bombKind='power';p.kick=true;
 G.events.push({t:'power',x:c(7),y:c(6),col:'#ff8a3c',kind:'fire'},{t:'power',x:c(8),y:c(6),col:'#c07a3a',kind:'kick'},{t:'power',x:c(3),y:c(9),col:'#ff4d5e',kind:'power'});})()`;
const B = `(()=>{const G=window.__GAME__.G,p=G.players[0],c=(t)=>(t+0.5)*40;p.bombs=8;p.speed=6;G.lives++;p.iFrames=9;
 G.events.push({t:'power',x:c(5),y:c(1),col:'#ff5d73',kind:'bomb'},{t:'power',x:c(13),y:c(11),col:'#3db4ff',kind:'speed'},{t:'power',x:c(1),y:c(11),col:'#ff3b5c',kind:'heart'});})()`;
const FRZ=`import('/src/render/fx.js').then(m=>{clearInterval(window.__frz);window.__frz=setInterval(()=>{for(const l of m.getLabels())l.t=0.3;},4);})`;
const NL=`import('/src/render/fx.js').then(m=>m.getLabels().map(l=>l.s+(l.m?' '+l.m:'')+'@'+l.t.toFixed(2)).join('|'))`;
const srv = await startServer();
const chr = await startChrome(false);
const report = [];
try {
  const c = await cdp(chr.ws);
  for (const [render, v, cam] of RUNS) {
    const tag = render + (render === "3d" ? "-cam" + cam : "") + "-" + v;
    if (only && !tag.includes(only)) continue;
    const a = VIEW[v];
    const pre = `try{localStorage.setItem('nb.settings.v1',JSON.stringify({cam:${cam}}));localStorage.setItem('nb.coach.v1','1');localStorage.setItem('nb.coach.v2',JSON.stringify({k:1,t:1,r:1,p:1,l:1,w:1,i:1,s:1}));}catch(e){}`;
    const url = "http://127.0.0.1:" + srv.port + "/index.html?render=" + render + "&play=1&debug=1";
    const P = await openPage(c, a, url);
    await P.ev(pre);
    await P.S("Page.reload", {});
    await sleep(500);
    for (let i = 0; i < 100; i++) { await sleep(100); if (await P.ev("!!(window.__GAME__&&document.readyState==='complete'&&window.__GAME__.G.state==='PLAY')").catch(() => false)) break; }
    await sleep(1500);
    if (SUB) {
      const NS = `import('/src/render/fx.js').then(m=>m.getLabels().map(l=>l.s+(l.sub?' ['+l.sub+']':'')+'#'+l.st).join('|'))`;
      await P.ev(`window.__GAME__.G.players[0].iFrames=99`);
      await P.ev(EV("line", 7, 7)); await sleep(90); await P.ev(EV("power", 8, 7)); await sleep(60); await P.ev(FRZ); await sleep(400);
      await P.shot(join(OUT, tag + "-sub-a.png")); const sa = await P.ev(NS);
      await P.ev("clearInterval(window.__frz)"); await sleep(1200);
      await P.ev(EV("pierce", 4, 1)); await sleep(90); await P.ev(EV("line", 5, 1)); await sleep(60); await P.ev(FRZ); await sleep(400);
      await P.shot(join(OUT, tag + "-sub-b.png")); const sb = await P.ev(NS);
      await P.ev("clearInterval(window.__frz)");
      report.push({tag: tag + "-sub", sa, sb, errors: P.errors});
      console.log(tag, "sub", sa, "/", sb, P.errors.length ? P.errors : "");
      continue;
    }
    await P.ev(A); await sleep(150);
    await P.ev(A2); await sleep(120); await P.ev(FRZ); await sleep(400);
    await P.shot(join(OUT, tag + "-a.png"));
    const la = await P.ev(NL);
    await sleep(1200);
    await P.ev("clearInterval(window.__frz)");
    await P.ev(B); await P.ev(FRZ); await P.ev("window.__pz=setInterval(()=>{const p=window.__GAME__.G.players[0];p.bombs=p.bombs===8?7:8;},120)"); await sleep(400); await P.shot(join(OUT, tag + "-pulse.png")); await P.ev("clearInterval(window.__pz);window.__GAME__.G.players[0].bombs=8"); await sleep(400);
    await P.shot(join(OUT, tag + "-b.png"));
    const lb = await P.ev(NL);
    const st = await P.ev(`(()=>{const g=window.__GAME__;return {state:g.G.state,lay:document.body.getAttribute('data-lay'),kind:g.renderer._dbg&&g.renderer._dbg.atlas?'px':(g.renderer._dbg&&g.renderer._dbg.camera?'3d':'2d'),dist:g.renderer._dbg&&g.renderer._dbg.camera?Math.round(g.renderer._dbg.camera.position.length()):null};})()`);
    report.push({tag, ...st, la, lb, errors: P.errors});
    console.log(tag, JSON.stringify(st), la, "/", lb, P.errors.length ? P.errors : "");
  }
  c.close();
} finally {
  chr.proc.kill("SIGKILL");
  try { rmSync(chr.dir, {recursive: true, force: true}); } catch {}
  srv.proc.kill("SIGTERM");
}
let old = [];
try { old = JSON.parse(readFileSync(join(OUT, "report.json"), "utf8")); } catch {}
const tags = new Set(report.map((r) => r.tag));
writeFileSync(join(OUT, "report.json"), JSON.stringify(old.filter((r) => !tags.has(r.tag)).concat(report), null, 1));
