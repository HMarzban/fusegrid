import {startServer, startChrome, cdp, openPage} from "../../../../tools/pixel/shot.mjs";
import {rmSync} from "node:fs";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";
const OUT = dirname(fileURLToPath(import.meta.url)), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startServer(), chr = await startChrome(false);
try {
  const c = await cdp(chr.ws);
  for (const [cam, wheel] of [[1, 0], [2, 0], [0, -1], [0, 1]]) {
    const P = await openPage(c, {w: 1280, h: 800, dpr: 1, mobile: false}, "http://127.0.0.1:" + srv.port + "/index.html?render=3d&play=1&debug=1");
    await P.ev(`try{localStorage.clear();localStorage.setItem('nb.coach.v1','1');localStorage.setItem('nb.coach.v2',JSON.stringify({k:1,t:1,r:1,p:1,l:1,w:1,i:1,s:1}));localStorage.setItem('nb.settings.v1',JSON.stringify({cam:${cam}}));}catch(e){}`);
    await P.S("Page.reload", {}); await sleep(500);
    for (let i = 0; i < 100; i++) { await sleep(100); if (await P.ev("!!(window.__GAME__&&document.readyState==='complete'&&window.__GAME__.G.state==='PLAY')").catch(() => false)) break; }
    await sleep(800);
    if (wheel) for (let i = 0; i < 8; i++) { await P.S("Input.dispatchMouseEvent", {type: "mouseWheel", x: 640, y: 400, deltaX: 0, deltaY: wheel * 300}); await sleep(60); }
    await sleep(400);
    await P.ev(`import('/src/core/entities.js').then(E=>{const G=window.__GAME__.G,p=G.players[0];p.iFrames=999;for(const [k,tx,ty] of [['fire',p.x,p.y],['kick',(11.5)*40,(10.5)*40],['pierce',(2.5)*40,(1.5)*40]]){const d=E.POWER.find(q=>q.t===k);G.items.push({x:tx,y:ty,t:k,col:d.col,pdef:d,taken:false,buried:false});}
      for(const [x,y] of [[11.5,10.5],[2.5,1.5]]){p.x=x*40;p.y=y*40;window.__GAME__.step(1);} p.x=1.5*40;p.y=1.5*40;})`);
    await sleep(250);
    const tag = "3d-cam" + cam + (wheel ? (wheel < 0 ? "-dollyin" : "-dollyout") : "");
    await P.shot(join(OUT, tag + ".png"));
    console.log(tag, await P.ev("import('/src/render/fx.js').then(m=>m.getLabels().map(l=>l.s+'@'+l.tx+','+l.ty))"), Math.round(await P.ev("window.__GAME__.renderer._dbg&&window.__GAME__.renderer._dbg.camera?window.__GAME__.renderer._dbg.camera.position.length():0")), P.errors);
    await P.S("Page.close", {}).catch(() => {});
  }
} finally { chr.proc.kill("SIGKILL"); try { rmSync(chr.dir, {recursive: true, force: true}); } catch {} srv.proc.kill("SIGTERM"); }
