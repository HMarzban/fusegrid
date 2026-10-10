import {startServer, startChrome, cdp, openPage} from "../../../../tools/pixel/shot.mjs";
import {rmSync} from "node:fs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEW = {desk: {w: 1280, h: 800, dpr: 1, mobile: false}, phone: {w: 390, h: 844, dpr: 1, mobile: true}};
const srv = await startServer(), chr = await startChrome(false);
try {
  const c = await cdp(chr.ws);
  for (const [r, v] of [["2d", "desk"], ["3d", "phone"], ["px", "desk"]]) {
    const P = await openPage(c, VIEW[v], "http://127.0.0.1:" + srv.port + "/index.html?render=" + r + "&play=1&debug=1");
    await P.ev(`try{localStorage.clear();localStorage.setItem('nb.coach.v1','1');}catch(e){}`);
    await P.S("Page.reload", {}); await sleep(500);
    for (let i = 0; i < 100; i++) { await sleep(100); if (await P.ev("!!(window.__GAME__&&document.readyState==='complete'&&window.__GAME__.G.state==='PLAY')").catch(() => false)) break; }
    await sleep(800);
    await P.ev(`(async()=>{const E=await import('/src/core/entities.js'),FX=await import('/src/render/fx.js');const r=window.__GAME__.renderer,ro=r.render.bind(r);r.render=(w,dt,o)=>{window.__O=o;return ro(w,dt,o);};
      window.__give=(k)=>{const G=window.__GAME__.G,p=G.players[0];p.iFrames=999;G.enemies.forEach(e=>{e.x=12.5*40;e.y=11.5*40;});const d=E.POWER.find(q=>q.t===k);G.items.push({x:p.x,y:p.y,t:k,col:d.col,pdef:d,taken:false,buried:false});};
      window.__st=()=>({c2:window.__O&&window.__O.coach2&&window.__O.coach2.s,st:window.__GAME__.G.state,lbl:FX.getLabels().map(l=>l.s+(l.sup?'(sup)':''))});})()`);
    const out = [];
    for (const k of ["fire", "bomb", "speed", "heart", "kick", "throw", "remote", "pass", "line", "power", "pierce", "shield"]) {
      await P.ev(`window.__give('${k}')`); await sleep(250);
      const a = await P.ev("window.__st()");
      await sleep(3300);
      await P.ev(`window.__give('${k}')`); await sleep(250);
      const b = await P.ev("window.__st()");
      out.push([k, a.st, a.c2 || "-", a.lbl.join("/"), "| repeat:", b.c2 || "-", b.lbl.join("/")]);
      await sleep(900);
    }
    console.log(r, v); for (const o of out) console.log("  ", o.join(" "));
    console.log("  store", await P.ev("localStorage.getItem('nb.coach.v2')"), P.errors);
    await P.S("Page.close", {}).catch(() => {});
  }
} finally { chr.proc.kill("SIGKILL"); try { rmSync(chr.dir, {recursive: true, force: true}); } catch {} srv.proc.kill("SIGTERM"); }
