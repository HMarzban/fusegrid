import {startServer, startChrome, cdp, openPage} from "../../../../tools/pixel/shot.mjs";
import {writeFileSync, rmSync} from "node:fs";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";
const OUT = dirname(fileURLToPath(import.meta.url)), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEW = {desk: {w: 1280, h: 800, dpr: 1, mobile: false}, phone: {w: 390, h: 844, dpr: 3, mobile: true}, land: {w: 844, h: 390, dpr: 3, mobile: true}};
const only = process.argv[2] || "";
const RUNS = [];
for (const v of ["desk", "phone", "land"]) { RUNS.push(["2d", v, 0], ["px", v, 0]); for (const cam of [0, 1, 2]) RUNS.push(["3d", v, cam]); }
const ALL = `(()=>{const G=window.__GAME__.G,p=G.players[0];Object.assign(p,{shield:true,kick:true,throw:true,passing:true,bombKind:'pierce',remote:true,speed:6,iFrames:999,x:5.5*40,y:11.5*40});})()`;
const HOLD = `(()=>{clearInterval(window.__hold);window.__hold=setInterval(()=>{const p=window.__GAME__.G.players[0];p.iFrames=999;p.x=5.5*40;p.y=11.5*40;},4);})()`;
const STRIP = `(()=>{const p=window.__GAME__.G.players[0];p.kick=false;p.shield=false;p.bombKind='normal';})()`;
const FRZ = `import('/src/render/fx.js').then(m=>{clearInterval(window.__frz);window.__frz=setInterval(()=>{for(const e of m.getStrip())e.t=0.3;},4);return m.getStrip().map(e=>e.k).join();})`;
const NONE = `(()=>{clearInterval(window.__frz);const p=window.__GAME__.G.players[0];Object.assign(p,{shield:false,kick:false,throw:false,passing:false,bombKind:'normal',remote:false,speed:3.4});})()`;
const GEO = `(()=>{const c=document.getElementById('c'),r=c.getBoundingClientRect(),q=(id)=>{const e=document.getElementById(id);if(!e||e.hidden||getComputedStyle(e).display==='none')return null;const b=e.getBoundingClientRect();return [b.left,b.top,b.right,b.bottom].map(Math.round);};
 const k=r.width/600;return {lay:document.body.getAttribute('data-lay'),stage:[r.left,r.top,r.right,r.bottom].map(Math.round),k:+k.toFixed(3),barCss:[r.left+16*k,r.top+486*k,r.left+584*k,r.top+514*k].map(Math.round),tpad:q('tpad'),tbomb:q('tbomb'),tthrow:q('tthrow'),tremote:q('tremote'),tpause:q('tpause')};})()`;
const srv = await startServer();
const chr = await startChrome(false);
const report = [];
try {
  const c = await cdp(chr.ws);
  for (const [render, v, cam] of RUNS) {
    const tag = render + (render === "3d" ? "-cam" + cam : "") + "-" + v;
    if (only && !tag.includes(only)) continue;
    const pre = `try{localStorage.setItem('nb.settings.v1',JSON.stringify({cam:${cam}}));localStorage.setItem('nb.coach.v1','1');localStorage.setItem('nb.coach.v2',JSON.stringify({k:1,t:1,r:1,p:1,l:1,w:1,i:1,s:1}));}catch(e){}`;
    const P = await openPage(c, VIEW[v], "http://127.0.0.1:" + srv.port + "/index.html?render=" + render + "&play=1&debug=1");
    await P.ev(pre); await P.S("Page.reload", {}); await sleep(500);
    for (let i = 0; i < 100; i++) { await sleep(100); if (await P.ev("!!(window.__GAME__&&document.readyState==='complete'&&window.__GAME__.G.state==='PLAY')").catch(() => false)) break; }
    await sleep(1500);
    await P.ev(NONE); await sleep(300); await P.shot(join(OUT, tag + "-idle.png"));
    await P.ev(ALL); await P.ev(HOLD); await sleep(400); await P.shot(join(OUT, tag + "-all.png"));
    const geo = await P.ev(GEO);
    await P.ev(STRIP); await sleep(120); const g = await P.ev(FRZ); await sleep(300); await P.shot(join(OUT, tag + "-fade.png"));
    await P.ev("clearInterval(window.__frz);clearInterval(window.__hold)");
    report.push({tag, geo, strip: g, errors: P.errors.slice()});
    console.log(tag, JSON.stringify(geo), g, P.errors.length ? P.errors : "");
  }
} finally {
  chr.proc.kill("SIGKILL"); try { rmSync(chr.dir, {recursive: true, force: true}); } catch {}
  srv.proc.kill("SIGTERM");
}
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 1));
