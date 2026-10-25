#!/usr/bin/env node
/* Detail pass (throwaway): in-game CLASSIC 2D QA board. Boots the live game
   (render=2d, debug=1) from this worktree in a fresh --gpu headless shell,
   starts a run, loads rooms 1..8 (foes frozen, seed fixed), reads the #c
   backing (the real 600x520 game raster) and tiles the eight rooms 4x2.
   Server and Chrome stopped by PID, profile deleted.
   node tools/walls/qa2d.mjs <out.png> */
import {writeFileSync, rmSync} from "node:fs";
import {startServer, startChrome, cdp, openPage} from "../pixel/shot.mjs";
import {unpng, png, blank, paste, label, bilinear} from "../pixel/rgba.mjs";
const OUT = process.argv[2], PX = process.argv.includes("--px"), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = await startServer();
let chr = null;
try {
  chr = await startChrome(true);
  const c = await cdp(chr.ws);
  const P = await openPage(c, {w: 1366, h: 768, dpr: 2, mobile: false}, "http://127.0.0.1:" + srv.port + "/index.html?render=" + (PX ? "px" : "2d") + "&debug=1");
  await P.key("Enter"); await sleep(5200);
  await P.ev("window.__GAME__.begin()"); await sleep(800);
  const sheet = blank(4 * 600 + 5 * 12, 2 * 520 + 3 * 12 + 30, "#05070d");
  label(sheet, 12, 8, 2, (PX ? "PIXEL" : "CLASSIC 2D") + " IN-GAME QA - ROUND 3 WALLS - ROOMS 1-8 (SEED 4242, FOES FROZEN)", [255, 220, 120]);
  for (let r = 1; r <= 8; r++) {
    await P.ev(`import('/src/core/sim.js').then(m=>{const G=window.__GAME__.G;G.seed=4242;m.loadLevel(G,${r},true);G.state='PLAY';for(const e of G.enemies)e.speed=0;})`);
    await sleep(700);
    /* PIXEL: the composited page (the board is #px under #c), cropped to #c's box and scaled to 600 wide */
    let im;
    if (PX) { const r = await P.ev("(()=>{const b=document.getElementById('c').getBoundingClientRect();return [b.left,b.top,b.width,b.height].map(v=>v*devicePixelRatio)})()"); const full = unpng(await P.shot()); const cut = blank(Math.round(r[2]), Math.round(r[3]), "#000"); for (let y = 0; y < cut.height; y++) for (let x = 0; x < cut.width; x++) { const s = ((Math.round(r[1]) + y) * full.width + Math.round(r[0]) + x) * 4, d = (y * cut.width + x) * 4; for (let q = 0; q < 4; q++) cut.data[d + q] = full.data[s + q]; } im = bilinear(cut, 600, 520); }
    else im = unpng(Buffer.from((await P.ev("document.getElementById('c').toDataURL('image/png')")).split(",")[1], "base64"));
    paste(sheet, im, 12 + ((r - 1) % 4) * 612, 30 + Math.floor((r - 1) / 4) * 532);
  }
  if (P.errors.length) console.error("page errors:", P.errors.join(" | "));
  c.close();
  writeFileSync(OUT, png(sheet));
  console.log("wrote", OUT);
} finally {
  if (chr) { chr.proc.kill("SIGTERM"); await sleep(400); try { rmSync(chr.dir, {recursive: true, force: true}); } catch (_) {} }
  srv.proc.kill("SIGTERM");
}
