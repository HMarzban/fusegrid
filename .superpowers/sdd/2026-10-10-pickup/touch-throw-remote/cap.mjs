import {startServer, startChrome, cdp, openPage} from "../../../../tools/pixel/shot.mjs";
import {writeFileSync, rmSync} from "node:fs";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";
const OUT = dirname(fileURLToPath(import.meta.url)), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEWS = [["desk", 1280, 800, 1, false], ["phone", 390, 844, 3, true], ["short", 375, 548, 2, true], ["land", 844, 390, 3, true]];
const RENDERS = (process.argv[2] || "2d,3d,px").split(",");
const RECT = `(()=>{const q=(id)=>{const e=document.getElementById(id);if(!e)return null;const r=e.getBoundingClientRect();return {hidden:e.hidden||e.offsetParent===null,r:[Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)]};};
 return {lay:document.body.getAttribute('data-lay'),state:window.__GAME__.state(),c:q('c'),tpad:q('tpad'),tbomb:q('tbomb'),tpause:q('tpause'),tthrow:q('tthrow'),tremote:q('tremote')};})()`;
const report = [];
const srv = await startServer();
let chr = null;
try {
  chr = await startChrome(false);
  const c = await cdp(chr.ws);
  for (const rk of RENDERS) for (const [vn, w, h, dpr, mobile] of VIEWS) {
    if (vn === "short" && rk !== "2d" && rk !== "px") continue;
    const a = {w, h, dpr, mobile};
    const url = "http://127.0.0.1:" + srv.port + "/index.html?" + (rk === "2d" ? "" : "render=" + rk + "&") + "debug=1";
    const P = await openPage(c, a, url);
    const tag = rk + "-" + vn;
    await P.key("Enter"); await sleep(5200);
    await P.ev("window.__GAME__.begin()"); await sleep(1000);
    const r0 = await P.ev(RECT);
    await P.ev("(()=>{const p=window.__GAME__.G.players[0];p.throw=true;p.remote=true;p.face={x:1,y:0};})()"); await sleep(400);
    const r1 = await P.ev(RECT);
    const row = {tag, before: r0, after: r1, errors: P.errors};
    if (mobile && r1.tthrow && !r1.tthrow.hidden) {
      const tap = async (rr) => { const x = (rr[0] + rr[2]) / 2, y = (rr[1] + rr[3]) / 2;
        await P.S("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [{x, y, id: 1}]}); await sleep(60);
        await P.S("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []}); await sleep(120); };
      await tap(r1.tthrow.r);
      row.throw = await P.ev("(()=>{const G=window.__GAME__.G,p=G.players[0];return G.bombs.filter(b=>!b.dead).map(b=>Math.round(b.x-p.x));})()");
      await sleep(250); await P.shot(join(OUT, tag + "-thrown.png"));
      await tap(r1.tremote.r);
      row.remote = await P.ev("window.__GAME__.G.bombs.filter(b=>!b.dead).length");
      await sleep(600);
    }
    await P.ev("(()=>{const p=window.__GAME__.G.players[0];p.throw=true;p.remote=true;})()"); await sleep(300);
    await P.shot(join(OUT, tag + ".png"));
    row.final = await P.ev(RECT);
    report.push(row);
    console.log(JSON.stringify({tag, lay: r1.lay, thr: r1.tthrow, rem: r1.tremote, bomb: r1.tbomb, pad: r1.tpad, c: r1.c, pre: [r0.tthrow && r0.tthrow.hidden, r0.tremote && r0.tremote.hidden], throw: row.throw, remote: row.remote, err: P.errors.length}));
  }
} finally {
  if (chr) { chr.proc.kill("SIGKILL"); try { rmSync(chr.dir, {recursive: true, force: true}); } catch {} }
  srv.proc.kill("SIGTERM");
}
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 1));
