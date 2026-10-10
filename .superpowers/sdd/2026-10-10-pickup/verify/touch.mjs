import {startServer, startChrome, cdp, openPage} from "../../../../tools/pixel/shot.mjs";
import {rmSync} from "node:fs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEW = {phone: {w: 390, h: 844, dpr: 3, mobile: true}, land: {w: 844, h: 390, dpr: 3, mobile: true}};
const srv = await startServer(), chr = await startChrome(false);
try {
  const c = await cdp(chr.ws);
  for (const r of (process.argv[2]||"2d,3d,px").split(",")) for (const v of (process.argv[3]||"phone,land").split(",")) {
    const P = await openPage(c, VIEW[v], "http://127.0.0.1:" + srv.port + "/index.html?render=" + r + "&play=1&debug=1");
    await P.ev(`try{localStorage.clear();localStorage.setItem('nb.coach.v1','1');}catch(e){}`);
    await P.S("Page.reload", {}); await sleep(500);
    for (let i = 0; i < 100; i++) { await sleep(100); if (await P.ev("!!(window.__GAME__&&document.readyState==='complete'&&window.__GAME__.G.state==='PLAY')").catch(() => false)) break; }
    await sleep(1000);
    const setup = await P.ev(`import('/src/core/config.js').then(C=>{const G=window.__GAME__.G,p=G.players[0];window.__ev=[];const r=window.__GAME__.renderer,ro=r.render.bind(r);r.render=(w,dt,o)=>{for(const e of w.events)if(e&&/throw|bomb|remote|boom/.test(e.t))window.__ev.push(e.t);return ro(w,dt,o);};
      for(let y=1;y<12;y++)for(let x=1;x<14;x++){if(G.grid[C.key(x,y)]!==C.T.EMPTY)continue;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){if(G.grid[C.key(x+2*dx,y+2*dy)]===C.T.EMPTY&&G.grid[C.key(x+dx,y+dy)]===C.T.EMPTY){p.x=(x+.5)*40;p.y=(y+.5)*40;p.face={x:dx,y:dy};p.dir={x:dx,y:dy};p.iFrames=999;p.throw=true;p.remote=true;G.enemies.forEach(e=>e.dead=true);return [x,y,dx,dy];}}}})`);
    await sleep(300);
    const rect = await P.ev(`(()=>{const q=(id)=>{const e=document.getElementById(id);const r=e.getBoundingClientRect();return {h:e.hidden,r:[r.left,r.top,r.right,r.bottom]};};return {thr:q('tthrow'),rem:q('tremote')};})()`);
    const tap = async (rr) => { const x = (rr[0] + rr[2]) / 2, y = (rr[1] + rr[3]) / 2;
      await P.S("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [{x, y, id: 1}]}); await sleep(60);
      await P.S("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []}); await sleep(150); };
    await tap(rect.thr.r);
    const thrown = await P.ev("(()=>{const G=window.__GAME__.G,p=G.players[0];return {b:G.bombs.filter(b=>!b.dead).map(b=>[Math.round((b.x-p.x)/40*10)/10,Math.round((b.y-p.y)/40*10)/10]),ev:window.__ev.slice(),fire:window.__GAME__.input._intent.fire,shift:window.__GAME__.input._intent.shift};})()");
    await tap(rect.rem.r); await sleep(200);
    const after = await P.ev("({live:window.__GAME__.G.bombs.filter(b=>!b.dead).length,ev:window.__ev.slice(),remote:window.__GAME__.input._intent.remote,c2:localStorage.getItem('nb.coach.v2')})");
    console.log(r, v, JSON.stringify({setup, thrown, after, err: P.errors}));
    await P.S("Page.close", {}).catch(() => {});
  }
} finally { chr.proc.kill("SIGKILL"); try { rmSync(chr.dir, {recursive: true, force: true}); } catch {} srv.proc.kill("SIGTERM"); }
