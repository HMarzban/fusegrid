import {startServer, startChrome, cdp, openPage} from "../../../../tools/pixel/shot.mjs";
import {rmSync} from "node:fs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startServer(), chr = await startChrome(false);
const boot = async (c, r, set, v1) => {
  const P = await openPage(c, {w: 1280, h: 800, dpr: 1, mobile: false}, "http://127.0.0.1:" + srv.port + "/index.html?render=" + r + "&play=1&debug=1");
  await P.ev(`try{localStorage.clear();${v1 ? "localStorage.setItem('nb.coach.v1','1');" : ""}${set ? `localStorage.setItem('nb.settings.v1',JSON.stringify(${JSON.stringify(set)}));` : ""}}catch(e){}`);
  await P.S("Page.reload", {}); await sleep(500);
  for (let i = 0; i < 100; i++) { await sleep(100); if (await P.ev("!!(window.__GAME__&&document.readyState==='complete'&&window.__GAME__.G.state==='PLAY')").catch(() => false)) break; }
  await sleep(600);
  await P.ev(`(async()=>{const E=await import('/src/core/entities.js');window.__rec=[];const ft=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(s,x,y,m){if(this.canvas&&this.canvas.id==='c')window.__rec.push([String(s),Math.round(y),+this.globalAlpha.toFixed(2),performance.now()|0]);return ft.call(this,s,x,y,m);};
    const r=window.__GAME__.renderer,ro=r.render.bind(r);r.render=(w,dt,o)=>{window.__O=o;return ro(w,dt,o);};
    window.__give=(k)=>{const G=window.__GAME__.G,p=G.players[0];p.iFrames=999;const d=E.POWER.find(q=>q.t===k);G.items.push({x:p.x,y:p.y,t:k,col:d.col,pdef:d,taken:false,buried:false});};})()`);
  return P;
};
try {
  const c = await cdp(chr.ws);
  for (const r of ["2d", "3d", "px"]) for (const set of [{flx: 1}, {shk: 0}, null]) {
    const P = await boot(c, r, set, true);
    await P.ev("window.__rec.length=0;window.__give('bomb')"); await sleep(1300);
    const rows = await P.ev("window.__rec.filter(x=>x[0]==='BOMB 2')");
    const ys = [...new Set(rows.map((x) => x[1]))], al = rows.map((x) => x[2]);
    console.log(r, JSON.stringify(set), "frames", rows.length, "y range", Math.min(...ys), Math.max(...ys), "alpha first/last", al[0], al[al.length - 1]);
    await P.S("Page.close", {}).catch(() => {});
  }
  for (const r of ["2d", "3d"]) {
    const P = await boot(c, r, null, false);
    const v1 = async () => (await P.ev("window.__O&&window.__O.coach"));
    const a0 = await v1();
    await P.ev("window.__give('kick')"); await sleep(250);
    const s1 = await P.ev("({v1:window.__O.coach,c2:window.__O.coach2&&window.__O.coach2.s})");
    let s2 = null, t = 0;
    for (; t < 80; t++) { await sleep(100); s2 = await P.ev("({v1:window.__O.coach,c2:window.__O.coach2&&window.__O.coach2.s,st:window.__GAME__.G.state})"); if (s2.c2) break; }
    console.log(r, "empty store: v1 at start", a0, "after kick", JSON.stringify(s1), "tip opened after", t * 100, "ms", JSON.stringify(s2));
    await P.S("Page.close", {}).catch(() => {});
  }
} finally { chr.proc.kill("SIGKILL"); try { rmSync(chr.dir, {recursive: true, force: true}); } catch {} srv.proc.kill("SIGTERM"); }
