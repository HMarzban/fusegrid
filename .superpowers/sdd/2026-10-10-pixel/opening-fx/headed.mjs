#!/usr/bin/env node
// opening-fx headed parity driver (scratch). Per preset x render (2d|px):
// title, show pop f0/f1/f2 (manual virtual-clock frames), show at peak zoom,
// MENU, GAME (+ portrait lift), WIN cheer, PAUSE, LOSE, plus layout / hit
// metrics; px also gets flushed perf at z 1 / 1.8 (intro peak) / 2.5 (pinch).
import {mkdirSync, writeFileSync, rmSync} from "node:fs";
import {join, resolve, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {startServer, startChrome, cdp} from "../../../../tools/pixel/shot.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
mkdirSync(OUT, {recursive: true});
const PRESET = {laptop: [1366, 768, 1, false], mac: [1440, 900, 2, false], phone: [393, 852, 3, true], phoneL: [852, 393, 3, true]};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = process.argv.slice(2);
const presets = (args.find((a) => a.startsWith("--presets=")) || "--presets=laptop,mac,phone,phoneL").split("=")[1].split(",");
const renders = (args.find((a) => a.startsWith("--renders=")) || "--renders=2d,px").split("=")[1].split(",");
const gpu = args.includes("--gpu");

const SHIM = `(()=>{const ch=new MessageChannel();let q=[],last=0;window.__manual=false;
ch.port1.onmessage=()=>{if(window.__manual)return;const t=performance.now();if(t-last<15){setTimeout(()=>ch.port2.postMessage(0),15-(t-last));return;}last=t;const c=q;q=[];for(const f of c)try{f(t);}catch(e){setTimeout(()=>{throw e;});}if(q.length)ch.port2.postMessage(0);};
window.requestAnimationFrame=(f)=>{q.push(f);if(q.length===1&&!window.__manual)ch.port2.postMessage(0);return q.length;};window.cancelAnimationFrame=()=>{};
window.__vt=0;window.__hold=()=>{window.__manual=true;window.__vt=performance.now();};
window.__frame=(ms)=>{window.__vt+=ms;const c=q;q=[];for(const f of c)f(window.__vt);};
window.__go=()=>{window.__manual=false;last=0;ch.port2.postMessage(0);};})();`;

const LAYOUT = `(()=>{const r=(id)=>{const e=document.getElementById(id);if(!e||e.hidden)return null;const b=e.getBoundingClientRect();return [b.left,b.top,b.width,b.height].map(v=>+v.toFixed(3));};
const c=document.getElementById('c').getBoundingClientRect(),cx=c.left+c.width/2,cy=c.top+c.height/2,at=(x,y)=>{const e=document.elementFromPoint(x,y);return e?(e.id||e.tagName):null;};
const tp=document.getElementById('tpause'),tb=document.getElementById('tbomb'),pp=tp&&!document.getElementById('touchpad').hidden?tp.getBoundingClientRect():null,bb=tb&&!document.getElementById('touchpad').hidden?tb.getBoundingClientRect():null;
const px=document.getElementById('px'),d=devicePixelRatio,cs=px?getComputedStyle(px):null,bx=cs?parseFloat(cs.borderLeftWidth)||0:0,by=cs?parseFloat(cs.borderTopWidth)||0:0,pr=px&&!px.hidden?px.getBoundingClientRect():null;
const org=pr?[(pr.left+bx)*d,(pr.top+by)*d]:null;
return {lay:document.body.getAttribute('data-lay'),dpr:d,c:r('c'),px:r('px'),gl:r('gl'),center:at(cx,cy),corner:at(c.left+4,c.top+4),pause:pp?at(pp.left+pp.width/2,pp.top+pp.height/2):null,bomb:bb?at(bb.left+bb.width/2,bb.top+bb.height/2):null,
pxOrg:org&&org.map(v=>+v.toFixed(3)),pxOrgOnDevice:org?Math.abs(org[0]-Math.round(org[0]))<0.02&&Math.abs(org[1]-Math.round(org[1]))<0.02:null,pxOffC:pr?[+((pr.left-c.left)*d).toFixed(2),+((pr.top-c.top)*d).toFixed(2)]:null,data:px?[px.dataset.bw,px.dataset.bh]:null,buf:px?[px.width,px.height]:null};})()`;

const STAT = `(()=>{const g=window.__GAME__,r=g.renderer,d=r&&r._dbg;return {state:g.state(),stage:g.app.introStage,subT:+(g.app.subT||0).toFixed(3),level:g.G.level,pop:d&&d.view?d.view.pop:null,M:d&&d.stat?d.stat.M:null,z:d&&d.stat?+d.stat.z.toFixed(3):null,k:d&&d.stat?+d.stat.k.toFixed(3):null,ms:d&&d.stat?+d.stat.ms.toFixed(2):null,draws:d&&d.stat?d.stat.draws:null,bakeMs:d?d.bakeMs:null,pending:d&&d.atlas&&d.atlas.pending?d.atlas.pending.size:null,shots:d&&d.view&&d.view.shots?d.view.shots.pool.filter(o=>o.k).map(o=>o.k):null};})()`;

const PERF = (z) => `(()=>{const g=window.__GAME__,r=g.renderer,G=g.G,px=document.getElementById('px'),x=px.getContext('2d'),o=r.ctx;
const run=()=>{o.save();o.setTransform(${z},0,0,${z},300*(1-${z}),260*(1-${z}));r.render(G,0,{hud:false});o.restore();};
const ms=[];for(let i=0;i<30;i++){const t=performance.now();run();x.getImageData(0,0,1,1);ms.push(performance.now()-t);}ms.sort((a,b)=>a-b);
const tn=[];for(let j=0;j<9;j++){const t=performance.now();for(let i=0;i<10;i++)run();x.getImageData(0,0,1,1);tn.push((performance.now()-t)/10);}tn.sort((a,b)=>a-b);
const s=r._dbg.stat;return {z:${z},median:+ms[15].toFixed(2),p90:+ms[27].toFixed(2),x10:+tn[4].toFixed(2),cpuMs:+s.ms.toFixed(2),M:s.M,k:+s.k.toFixed(3),hi:[r._dbg.hi.width,r._dbg.hi.height],draws:s.draws,foes:G.enemies.length};})()`;
const FAT = `Promise.all([import('/src/core/entities.js'),import('/src/core/config.js')]).then(([E,C])=>{const G=window.__GAME__.G;G.state='PLAY';let i=0;for(const f of E.FOES)for(let y=1;y<12&&i<99;y++)for(let x=3;x<14;x++)if(G.grid[C.key(x,y)]===C.T.EMPTY&&(x*3+y*5+i)%9===0){G.enemies.push(E.spawnEnemy(f.t,x,y,G.level,null));i++;y=99;break;}return G.enemies.length;})`;

async function page(c, P, url) {
  const [w, h, dpr, mobile] = P;
  const {targetId} = await c.send("Target.createTarget", {url: "about:blank"});
  const {sessionId} = await c.send("Target.attachToTarget", {targetId, flatten: true});
  const S = (m, p) => c.send(m, p, sessionId), errors = [];
  c.on((d) => {
    if (d.sessionId !== sessionId) return;
    if (d.method === "Runtime.exceptionThrown") errors.push("exception: " + (d.params.exceptionDetails.exception && d.params.exceptionDetails.exception.description || d.params.exceptionDetails.text));
    if (d.method === "Runtime.consoleAPICalled" && (d.params.type === "error" || d.params.type === "warning")) errors.push(d.params.type + ": " + d.params.args.map((x) => x.value || x.description).join(" "));
  });
  await S("Page.enable"); await S("Runtime.enable");
  await S("Emulation.setDeviceMetricsOverride", {width: w, height: h, deviceScaleFactor: dpr, mobile});
  if (mobile) await S("Emulation.setTouchEmulationEnabled", {enabled: true, maxTouchPoints: 5});
  await S("Page.addScriptToEvaluateOnNewDocument", {source: SHIM});
  await S("Page.navigate", {url});
  const ev = async (e) => { const r = await S("Runtime.evaluate", {expression: e, awaitPromise: true, returnByValue: true}); if (r.exceptionDetails) throw new Error(e.slice(0, 80) + ": " + JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
  for (let i = 0; i < 100; i++) { await sleep(100); if (await ev("!!(window.__GAME__&&document.readyState==='complete')").catch(() => false)) break; }
  const shot = async (f) => { const r = await S("Page.captureScreenshot", {format: "png"}); writeFileSync(f, Buffer.from(r.data, "base64")); return f; };
  const key = async (code) => { for (const type of ["keyDown", "keyUp"]) await S("Input.dispatchKeyEvent", {type, code, key: code === "Enter" ? "Enter" : code, windowsVirtualKeyCode: code === "Enter" ? 13 : code === "KeyP" ? 80 : 0}); };
  return {ev, shot, key, errors};
}

const report = [];
const srv = await startServer();
let chr = null;
try {
  chr = await startChrome(gpu);
  const c = await cdp(chr.ws);
  for (const pn of presets) for (const rk of renders) {
    const P = PRESET[pn], tag = rk + "-" + pn, R = {tag, steps: []};
    const g = await page(c, P, "http://127.0.0.1:" + srv.port + "/index.html?render=" + rk + "&debug=1");
    const snap = async (n, extra) => { await sleep(extra == null ? 250 : extra); const f = await g.shot(join(OUT, tag + "-" + n + ".png")); R.steps.push({n, file: f, stat: await g.ev(STAT), lay: await g.ev(LAYOUT)}); };
    await snap("title");
    await g.key("Enter");
    for (let i = 0; i < 40 && (await g.ev("window.__GAME__.app.introStage")) !== 1; i++) await sleep(25);
    await g.ev("window.__hold()");
    const want = [[0.001, 0.34, "pop-f0"], [0.34, 0.67, "pop-f1"], [0.67, 0.999, "pop-f2"], [0.999, 9, "pop-idle"]];
    let wi = 0;
    for (let i = 0; i < 400 && wi < want.length; i++) {
      await g.ev("window.__frame(4)");
      const st = await g.ev(STAT), p = rk === "px" ? st.pop : await g.ev("(()=>{const t=window.__GAME__.app.subT;return t<0.548?0:1})()");
      if (rk !== "px") { if (st.subT >= 0.6) { await g.shot(join(OUT, tag + "-pop.png")); wi = want.length; } continue; }
      if (p != null && p >= want[wi][0] && p < want[wi][1]) { const f = await g.shot(join(OUT, tag + "-" + want[wi][2] + ".png")); R.steps.push({n: want[wi][2], file: f, stat: st}); wi++; }
      else if (p != null && wi < want.length - 1 && p >= want[wi][1]) { R.steps.push({n: want[wi][2] + "-MISSED", stat: st}); wi++; }
    }
    for (let i = 0; i < 400 && (await g.ev("window.__GAME__.app.subT")) < 1.1; i++) await g.ev("window.__frame(8)");
    await g.ev("window.__frame(8)");
    R.steps.push({n: "peak-zoom", file: await g.shot(join(OUT, tag + "-show-zoom.png")), stat: await g.ev(STAT)});
    await g.ev("window.__go()");
    for (let i = 0; i < 80 && (await g.ev("window.__GAME__.state()")) !== "MENU"; i++) await sleep(100);
    await snap("menu", 600);
    await g.ev("window.__GAME__.begin()");
    await snap("game", 900);
    await g.ev("window.__GAME__.clearAllEnemies()");
    for (let i = 0; i < 40 && (await g.ev("window.__GAME__.G.state")) !== "WIN"; i++) await sleep(50);
    await snap("win", 120);
    await g.key("Enter");
    for (let i = 0; i < 40 && (await g.ev("window.__GAME__.G.state")) !== "PLAY"; i++) await sleep(50);
    await sleep(300);
    await g.ev(`(()=>{const G=window.__GAME__.G,p=G.players[0];p.iFrames=0;G.bombs.push({x:p.x+80,y:p.y,tx:Math.floor((p.x+80)/40),ty:Math.floor(p.y/40),timer:0.02,radius:1,variant:'normal',dead:false});})()`);
    await sleep(60);
    await g.key("KeyP");
    await snap("pause", 300);
    await sleep(400);
    await snap("pause2", 0);
    await g.key("KeyP");
    await sleep(200);
    await g.ev(`(()=>{const G=window.__GAME__.G,p=G.players[0];G.lives=1;p.iFrames=0;p.shield=false;G.bombs.push({x:p.x,y:p.y,tx:Math.floor(p.x/40),ty:Math.floor(p.y/40),timer:0.05,radius:1,variant:'normal',dead:false});})()`);
    for (let i = 0; i < 40 && (await g.ev("window.__GAME__.G.state")) !== "LOSE"; i++) await sleep(25);
    await snap("lose", 200);
    if (rk === "px") {
      await g.ev("window.__GAME__.G.state='PLAY';window.__GAME__.G.lives=3;window.__GAME__.G.players[0].alive=true");
      R.foes = await g.ev(FAT);
      await sleep(200);
      await g.ev("window.__hold()");
      R.perf = [];
      for (const z of [1, 1.8, 2.5]) R.perf.push(await g.ev(PERF(z)));
      await g.ev("window.__go()");
    }
    R.errors = g.errors;
    report.push(R);
    console.log(JSON.stringify({tag, errors: R.errors, perf: R.perf, steps: R.steps.map((s) => ({n: s.n, st: s.stat && [s.stat.state, s.stat.stage, s.stat.subT, s.stat.pop, s.stat.M, s.stat.z, s.stat.shots && s.stat.shots.join("")], lay: s.lay && {lay: s.lay.lay, c: s.lay.c, px: s.lay.px, center: s.lay.center, pause: s.lay.pause, bomb: s.lay.bomb, org: s.lay.pxOrgOnDevice, off: s.lay.pxOffC}}))}));
  }
  c.close();
} finally {
  if (chr) { chr.proc.kill("SIGKILL"); try { rmSync(chr.dir, {recursive: true, force: true}); } catch {} }
  srv.proc.kill("SIGTERM");
}
writeFileSync(join(OUT, "report" + (gpu ? "-gpu" : "") + ".json"), JSON.stringify(report, null, 1));
