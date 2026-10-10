import {startServer, startChrome, cdp, openPage} from "../../../../tools/pixel/shot.mjs";
import {rmSync} from "node:fs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const render = process.argv[2] || "px";
const srv = await startServer(); const chr = await startChrome(false);
try {
  const c = await cdp(chr.ws);
  const P = await openPage(c, {w: 1366, h: 768, dpr: 1, mobile: false}, "http://127.0.0.1:" + srv.port + "/index.html?render=" + render + "&debug=1");
  for (const t of [300, 1200, 2500]) { await sleep(t); await P.shot("zoom/title-" + render + "-" + t + ".png"); console.log(t, await P.ev("JSON.stringify({s:window.__GAME__.state(),stage:window.__GAME__.app.introStage,ready:window.__GAME__.app.boardReady,t:window.__GAME__.app.subT})")); }
  console.log(P.errors); c.close();
} finally { chr.proc.kill("SIGKILL"); try { rmSync(chr.dir, {recursive: true, force: true}); } catch {} srv.proc.kill("SIGTERM"); }
