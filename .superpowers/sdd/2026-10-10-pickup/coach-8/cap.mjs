import {startServer, startChrome, cdp, openPage} from "../../../../tools/pixel/shot.mjs";
import {writeFileSync, rmSync} from "node:fs";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";
const OUT = dirname(fileURLToPath(import.meta.url)), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEWS = [["desk", 1280, 800, 1, false], ["phone", 390, 844, 3, true]];
const RENDERS = (process.argv[2] || "2d,3d,px").split(",");
const GRAB = (kinds) => `import('/src/core/entities.js').then((E)=>{const G=window.__GAME__.G,p=G.players[0];let i=0;for(const k of ${JSON.stringify(kinds)}){const d=E.POWER.find((q)=>q.t===k);E.applyPower(G,d,p.x+(i?40:40),p.y+(i?40:0));i++;}return {lay:document.body.getAttribute('data-lay'),st:window.__GAME__.state()};})`;
const report = [];
const srv = await startServer();
let chr = null;
try {
  chr = await startChrome(false);
  const c = await cdp(chr.ws);
  for (const rk of RENDERS) for (const [vn, w, h, dpr, mobile] of VIEWS) {
    const url = "http://127.0.0.1:" + srv.port + "/index.html?" + (rk === "2d" ? "" : "render=" + rk + "&") + "debug=1";
    const P = await openPage(c, {w, h, dpr, mobile}, url);
    await P.ev("localStorage.setItem('nb.coach.v1','1'),true");
    await P.S("Page.reload", {});
    for (let i = 0; i < 100; i++) { await sleep(100); if (await P.ev("!!(window.__GAME__&&document.readyState==='complete')").catch(() => false)) break; }
    await P.key("Enter"); await sleep(5200);
    for (const [scene, kinds] of [["throw", ["throw", "fire"]], ["pierce", ["pierce"]]]) {
      await P.ev("window.__GAME__.begin()"); await sleep(1200);
      await P.ev("localStorage.removeItem('nb.coach.v2'),true"); const r = await P.ev(GRAB(kinds)); await sleep(420);
      const tag = rk + "-" + vn + "-" + scene;
      await P.shot(join(OUT, tag + ".png"));
      const v2 = await P.ev("localStorage.getItem('nb.coach.v2')");
      report.push({tag, ...r, v2, errors: P.errors.slice()});
      console.log(JSON.stringify({tag, ...r, v2, err: P.errors.length}));
      await sleep(3200);
    }
  }
} finally {
  if (chr) { chr.proc.kill("SIGKILL"); try { rmSync(chr.dir, {recursive: true, force: true}); } catch {} }
  srv.proc.kill("SIGTERM");
}
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 1));
