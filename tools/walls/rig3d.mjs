#!/usr/bin/env node
/* Round 3 (throwaway): REAL 3D wall candidates in the REAL game at rig C
   play distance. Boots ?render=3d&debug=1 in a fresh --gpu headless shell
   (1366x768, dpr 2), starts a run, forces pillar codes by column (x 2 base,
   4 v1, 6 v2, 8 acc; wallvar's staging override), freezes foes, and for each
   candidate (WALL_FX values set on the live materials module, rebuilt on the
   next room) captures rooms 1..8 with Page.captureScreenshot (the composited
   page: #gl under #c). Writes <out>/<cand>-room<n>.png. Server and Chrome
   stopped by PID, profile deleted.
   node tools/walls/rig3d.mjs <outDir> [A,B,C] [--dpr 2] */
import {writeFileSync, rmSync, mkdirSync} from "node:fs";
import {join} from "node:path";
import {startServer, startChrome, cdp, openPage} from "../pixel/shot.mjs";
const a = process.argv.slice(2), OUT = a[0], sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CANDS = {A: {bump: 0, gloss: 0, ao: 0}, B: {bump: 3, gloss: 0, ao: 0.2}, C: {bump: 3, gloss: 0.6, ao: 0.2}, D: {bump: 6, gloss: 0.9, ao: 0.25}, E: {bump: 3, gloss: 0.85, ao: 0.22}};
const pick = (a[1] && !a[1].startsWith("--") ? a[1] : "A,B,C").split(","), DPR = a.includes("--dpr") ? +a[a.indexOf("--dpr") + 1] : 2;
const rooms = a.includes("--rooms") ? a[a.indexOf("--rooms") + 1].split(",").map(Number) : [1, 2, 3, 4, 5, 6, 7, 8];
mkdirSync(OUT, {recursive: true});
const srv = await startServer();
let chr = null;
try {
  chr = await startChrome(true);
  const c = await cdp(chr.ws);
  const P = await openPage(c, {w: 1366, h: 768, dpr: DPR, mobile: false}, "http://127.0.0.1:" + srv.port + "/index.html?render=3d&debug=1");
  await P.key("Enter"); await sleep(5200);
  await P.ev("window.__GAME__.begin()"); await sleep(1500);
  await P.ev("import('/src/render/wallvar.js').then(m=>m.setWallOverride((x,y,k)=>k>3?k:x===2?0:x===4?1:x===6?2:x===8?3:k))");
  for (const k of pick) {
    await P.ev(`import('/src/render/three/materials.js').then(m=>Object.assign(m.WALL_FX,${JSON.stringify(CANDS[k])}))`);
    for (const r of rooms) {
      /* hop through another room first so the scene (and its wall material) rebuilds */
      for (const lv of [r === 1 ? 2 : 1, r]) {
        await P.ev(`import('/src/core/sim.js').then(m=>{const G=window.__GAME__.G;G.seed=4242;m.loadLevel(G,${lv},true);G.state='PLAY';for(const e of G.enemies)e.speed=0;})`);
        await sleep(lv === r ? 2600 : 600);
      }
      await P.shot(join(OUT, `${k}-room${r}.png`));
      /* --shimmer: one 4-tick wheel dolly (~4 units of 1503) and a second
         frame; shimmer.mjs compares how much the walls change */
      if (a.includes("--shimmer")) { await P.S("Input.dispatchMouseEvent", {type: "mouseWheel", x: 683, y: 384, deltaX: 0, deltaY: 4}); await sleep(900); await P.shot(join(OUT, `${k}-room${r}-w.png`)); }
    }
  }
  if (P.errors.length) console.error("page errors:", P.errors.slice(0, 5).join(" | "));
  c.close();
  console.log("wrote", pick.length * rooms.length, "frames to", OUT);
} finally {
  if (chr) { chr.proc.kill("SIGTERM"); await sleep(400); try { rmSync(chr.dir, {recursive: true, force: true}); } catch (_) {} }
  srv.proc.kill("SIGTERM");
}
