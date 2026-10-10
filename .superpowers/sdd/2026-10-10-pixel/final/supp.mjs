/* G3 supplement: (a) MAKO materialize, show pop-in (0.548-0.798 s after the
   press) sampled tight + respawn MAT (3 x 110 ms) in PIXEL; (b) the full foe
   roster on SAND / VOID / CROWN in all three looks at laptop k2.77. GPU=1 for
   Metal. Writes supp/*.png + supp.json. */
import {startServer, startChrome, cdp, openPage} from "../../../../tools/pixel/shot.mjs";
import {mkdirSync, writeFileSync, rmSync} from "node:fs";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "supp");
mkdirSync(OUT, {recursive: true});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const A = {w: 1366, h: 768, dpr: 1, mobile: false};
const FAT = `Promise.all([import('/src/core/entities.js'),import('/src/core/config.js'),import('/src/core/sim.js')]).then(([E,C,S])=>{const G=window.__GAME__.G;S.loadLevel(G,LV,true);G.state='PLAY';G.enemies.length=0;const p=G.players[0];p.iFrames=0;
 const spots=[];for(let y=1;y<12;y++)for(let x=1;x<14;x++){const k=C.key(x,y);if(x+y<4)continue;spots.push([x,y,G.grid[k]===C.T.EMPTY]);}
 const free=spots.filter(s=>s[2]);let i=0;for(const f of E.FOES){const s=free[(i*7+3)%free.length];i++;const e=E.spawnEnemy(f.t,s[0],s[1],G.level,null);e.speed=0;e.spd=0;G.enemies.push(e);}
 return G.enemies.map(e=>e.type+'@'+Math.floor(e.x/40)+','+Math.floor(e.y/40));})`;
const out = {};
const srv = await startServer();
try {
  for (const render of ["px", "2d", "3d"]) {
    const chr = await startChrome(!!process.env.GPU);
    try {
      const c = await cdp(chr.ws);
      const url = "http://127.0.0.1:" + srv.port + "/index.html?render=" + render + "&debug=1";
      const P = await openPage(c, A, url);
      const row = out[render] = {pop: [], mat: [], fat: {}, errors: P.errors};
      await sleep(800);
      if (render === "px") {
        await P.key("Enter");
        const t0 = Date.now();
        while (Date.now() - t0 < 1100) { const t = await P.ev("window.__GAME__.app.subT"); const f = join(OUT, "pop-" + t.toFixed(3) + ".png"); await P.shot(f); row.pop.push([t, f]); }
        await sleep(4000);
      } else { await P.key("Enter"); await sleep(5200); }
      await P.ev("window.__GAME__.begin()"); await sleep(1200);
      if (render === "px") {
        await P.ev(`import('/src/core/entities.js').then(E=>{const G=window.__GAME__.G,p=G.players[0];G.lives=3;p.iFrames=0;p.shield=false;p.x=7.5*40;p.y=5.5*40;E.hurtPlayer(G);})`);
        for (const d of [10, 90, 110, 110, 400]) { await sleep(d); const f = join(OUT, "mat-" + row.mat.length + ".png"); await P.shot(f); row.mat.push([d, f, await P.ev("(p=>[p.x,p.y,p.iFrames])(window.__GAME__.G.players[0])")]); }
      }
      for (const lv of [6, 7, 8]) { row.fat[lv] = await P.ev(FAT.replace("LV", lv)); await sleep(500); await P.ev("window.__GAME__.G.players[0].iFrames=0"); await sleep(150); await P.shot(join(OUT, render + "-fat" + lv + ".png")); }
      c.close();
    } finally { chr.proc.kill("SIGKILL"); try { rmSync(chr.dir, {recursive: true, force: true}); } catch {} }
  }
} finally { srv.proc.kill("SIGTERM"); }
writeFileSync(join(OUT, "supp.json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, (k, v) => (k === "pop" ? v.map((x) => x[0]) : v)));
