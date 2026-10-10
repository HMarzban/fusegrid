/* PIXEL final QA (plan G3): PIXEL vs CLASSIC 2D vs REAL 3D at laptop and
   phone. One fresh chrome profile per (render, view). Writes shots/*.png,
   report.json; sheet.mjs builds contact.png. Dev-only. */
import {startServer, startChrome, cdp, openPage} from "../../../../tools/pixel/shot.mjs";
import {mkdirSync, writeFileSync, rmSync} from "node:fs";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "shots");
mkdirSync(OUT, {recursive: true});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEW = {lap: {w: 1366, h: 768, dpr: 1, mobile: false}, phone: {w: 390, h: 844, dpr: 3, mobile: true}};
const only = process.argv[2] || "";
const RUNS = [];
for (const v of ["lap", "phone"]) for (const r of ["px", "2d", "3d"]) RUNS.push([r, v]);

const RECT = `(()=>{const d=devicePixelRatio,c=document.getElementById('c').getBoundingClientRect();return [Math.max(0,c.left*d),Math.max(0,c.top*d),c.width*d,c.height*d];})()`;
const ST = `(()=>{const g=window.__GAME__,r=g.renderer,d=r&&r._dbg,px=document.getElementById('px'),gl=document.getElementById('gl');
 return {state:g.state(),level:g.G.level,kind:d&&d.atlas?'px':(gl&&!gl.hidden?'3d':'2d'),gfx:g.app.gfx?{fps:g.app.gfx.fps,kind:g.app.gfx.kind,limit:g.app.gfx.limit,gov:g.app.gfx.gov}:null,
 k:px&&!px.hidden?+(px.getBoundingClientRect().width*devicePixelRatio/300).toFixed(3):null};})()`;
const FAT = `Promise.all([import('/src/core/entities.js'),import('/src/core/config.js')]).then(([E,C])=>{const G=window.__GAME__.G;G.state='PLAY';let i=0;for(const f of E.FOES)for(let y=1;y<12&&i<99;y++)for(let x=3;x<14;x++)if(G.grid[C.key(x,y)]===C.T.EMPTY&&(x*3+y*5+i)%9===0){G.enemies.push(E.spawnEnemy(f.t,x,y,G.level,null));i++;y=99;break;}return G.enemies.map(e=>e.type);})`;
const ITEMS = `Promise.all([import('/src/core/entities.js'),import('/src/core/config.js')]).then(([E,C])=>{const G=window.__GAME__.G,p=G.players[0];p.iFrames=999;const out=[];let i=0;
 for(let y=1;y<12;y++)for(let x=1;x<14;x++){if(i>=E.POWER.length)break;if(G.grid[C.key(x,y)]!==C.T.EMPTY||(Math.abs(x*40+20-p.x)<60&&Math.abs(y*40+20-p.y)<60))continue;if((x+y)%2)continue;const d=E.POWER[i++];G.items.push({x:(x+.5)*40,y:(y+.5)*40,t:d.t,col:d.col,pdef:d,taken:false,buried:false});out.push(d.t);}
 G.enemies.forEach(e=>e.dead=true);return out;})`;
const GIVE = (ks) => `import('/src/core/entities.js').then(E=>{const G=window.__GAME__.G,p=G.players[0];p.iFrames=999;for(const k of ${JSON.stringify(ks)}){const d=E.POWER.find(q=>q.t===k);G.items.push({x:p.x,y:p.y,t:k,col:d.col,pdef:d,taken:false,buried:false});}})`;
const LOAD = (r) => `import('/src/core/sim.js').then(m=>{const G=window.__GAME__.G;m.loadLevel(G,${r},true);G.state='PLAY';G.players[0].iFrames=999;})`;
/* A ghost on THIS run's room-1 key: start tile then walk right 3 tiles over 2 s, loop-hold. */
const GHOST = `Promise.all([import('/src/app/ghost.js'),import('/src/core/sim.js')]).then(([Gh,S])=>{const G=window.__GAME__.G;S.loadLevel(G,1,true);G.state='PLAY';const p=G.players[0];const k=Gh.ghostKey(G);
 const b=(n)=>Math.round(n).toString(36).toUpperCase().padStart(2,'0');let s='';for(let i=0;i<300;i++){const x=p.x+Math.min(i,40)*3,y=p.y+Math.max(0,Math.min(i-40,40))*3;s+=b(x/2)+b(y/2)+(i<40?'7':'5');}
 const v=Gh.loadGhost();v.g[k]={d:300,s};Gh.saveGhost(v);S.loadLevel(G,1,true);G.state='PLAY';G.players[0].iFrames=999;return k;})`;

const VIS = "(p=>{p.iFrames=0;})(window.__GAME__.G.players[0])";
const report = [];
const srv = await startServer();
try {
  for (const [render, v] of RUNS) {
    const tag = render + "-" + v;
    if (only && !tag.includes(only)) continue;
    const chr = await startChrome(!!process.env.GPU);
    const row = {tag, steps: [], errors: []};
    try {
      const c = await cdp(chr.ws);
      const a = VIEW[v];
      const url = "http://127.0.0.1:" + srv.port + "/index.html?render=" + render + "&debug=1";
      const P = await openPage(c, a, url);
      const snap = async (n, full) => {
        await sleep(250);
        const f = join(OUT, tag + "-" + n + ".png");
        await P.shot(f);
        const st = await P.ev(ST).catch((e) => ({err: String(e)}));
        row.steps.push({n, f, crop: full ? null : await P.ev(RECT), ...st});
      };
      await sleep(600);
      await snap("title", v === "phone");
      await P.key("Enter");
      await sleep(500); await snap("show1");
      await sleep(700); await snap("show2");
      await sleep(800); await snap("show3");
      await sleep(3000); await snap("menu", v === "phone");
      const k = async (code, n = 1) => { for (let i = 0; i < n; i++) { await P.key(code, code === "Escape" ? "Escape" : undefined); await sleep(160); } };
      await k("ArrowDown", 4); await k("Enter"); await snap("guide");
      await k("Enter"); await sleep(300); await snap("howto");
      await k("Escape"); await k("ArrowDown"); await k("Enter"); await sleep(300); await snap("items");
      await k("Escape"); await k("ArrowDown"); await k("Enter"); await sleep(300); await snap("enemies");
      await k("Escape"); await k("Escape");
      row.backAtMenu = await P.ev("window.__GAME__.state()");
      await P.ev("(a=>{a.toMenu();a.cursor=0;})(window.__GAME__.app)"); await sleep(200);
      await k("ArrowDown", 3); await k("Enter"); await sleep(200); await snap("options");
      await k("ArrowDown", 8); await k("Enter"); await sleep(300); await snap("graphics");
      await P.ev("window.__GAME__.app.toMenu()"); await sleep(200);
      await P.ev("window.__GAME__.begin()"); await sleep(1200);
      await P.ev("window.__GAME__.G.players[0].iFrames=999");
      await snap("game", v === "phone");
      for (let r = 1; r <= 8; r++) { await P.ev(LOAD(r)); await sleep(900); await P.ev(VIS); await snap("room" + r); }
      await P.ev(LOAD(1)); await sleep(400);
      row.fat = await P.ev(FAT); await sleep(500); await P.ev(VIS); await snap("fat");
      await P.ev(LOAD(1)); await sleep(400);
      row.items = await P.ev(ITEMS); await sleep(500); await snap("pickups");
      await P.ev(LOAD(1)); await sleep(400);
      await P.ev(GIVE(["kick"])); await sleep(350); await snap("label");
      await P.ev(GIVE(["fire", "bomb", "shield", "throw", "remote", "speed"])); await sleep(400); await snap("bar");
      row.ghostKey = await P.ev(GHOST); await sleep(1500);
      row.ghostOn = await P.ev("(()=>{try{return Object.keys(JSON.parse(localStorage.getItem('nb.ghost.v1')).g)}catch(e){return String(e)}})()");
      await snap("ghost");
      /* perf: GRAPHICS AUTO default, count renders over 3 s of PLAY */
      row.perf = await P.ev(`new Promise(ok=>{const r=window.__GAME__.renderer,o=r.render.bind(r);let n=0,ms=[];r.render=(w,dt,x)=>{const t=performance.now();const q=o(w,dt,x);ms.push(performance.now()-t);n++;return q;};setTimeout(()=>{r.render=o;ms.sort((a,b)=>a-b);ok({fps:+(n/3).toFixed(1),med:+(ms[ms.length>>1]||0).toFixed(2),p90:+(ms[Math.floor(ms.length*.9)]||0).toFixed(2),gfx:window.__GAME__.app.gfx&&{...window.__GAME__.app.gfx},settings:localStorage.getItem('nb.settings.v1')});},3000);})`);
      await P.ev("window.__pause&&window.__pause()"); await sleep(400); await snap("pause");
      await P.ev("window.__resume&&window.__resume()"); await sleep(150);
      await P.ev(`(()=>{const G=window.__GAME__.G,p=G.players[0];G.lives=1;p.iFrames=0;p.shield=false;G.bombs.push({x:p.x,y:p.y,tx:Math.floor(p.x/40),ty:Math.floor(p.y/40),timer:0.05,radius:1,variant:'normal',dead:false});})()`);
      for (let i = 0; i < 40 && (await P.ev("window.__GAME__.G.state")) !== "LOSE"; i++) await sleep(50);
      await sleep(600); await snap("lose");
      await P.ev(LOAD(5)); await sleep(300);
      await P.ev("window.__GAME__.G.state='WIN'"); await sleep(700); await snap("win");
      row.errors.push(...P.errors);
      c.close();
    } catch (e) {
      row.errors.push("harness: " + (e && e.stack || e));
    } finally {
      chr.proc.kill("SIGKILL");
      try { rmSync(chr.dir, {recursive: true, force: true}); } catch {}
    }
    report.push(row);
    console.log(tag, JSON.stringify({errors: row.errors, perf: row.perf, fat: row.fat, items: row.items, ghost: row.ghostOn, back: row.backAtMenu, st: row.steps.map((s) => s.n + ":" + s.state + ":" + s.level + ":" + s.kind + (s.k ? ":k" + s.k : ""))}));
  }
} finally {
  srv.proc.kill("SIGTERM");
}
writeFileSync(join(dirname(OUT), "report" + (only ? "-" + only : "") + ".json"), JSON.stringify(report, null, 1));
