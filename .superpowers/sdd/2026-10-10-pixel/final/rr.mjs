import {startServer, startChrome, cdp, openPage} from "../../../../tools/pixel/shot.mjs";
import {mkdirSync, writeFileSync, rmSync} from "node:fs";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "rr");
mkdirSync(OUT, {recursive: true});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ST = `(()=>{const g=window.__GAME__,a=g.app,r=g.renderer,px=document.getElementById('px'),gl=document.getElementById('gl');
 return {screen:a.screen,optRow:a.optRow,render3d:a.render3d,pixel:a.pixel,r3d:a.settings.r3d,px:a.settings.px,
 kind:r&&r._dbg&&r._dbg.atlas?'px':(gl&&!gl.hidden?'3d':'2d'),pxHidden:px.hidden,glHidden:gl.hidden,blob:localStorage.getItem('nb.settings.v1')};})()`;
const log = [];
const srv = await startServer();
let chr = null;
try {
  chr = await startChrome(false);
  const c = await cdp(chr.ws);
  const a = {w: 1366, h: 768, dpr: 1, mobile: false};
  const url = "http://127.0.0.1:" + srv.port + "/index.html?debug=1";
  let P = await openPage(c, a, url);
  const step = async (n, shot) => { await sleep(300); const s = await P.ev(ST); log.push({n, ...s}); if (shot) await P.shot(join(OUT, n + ".png")); return s; };
  const k = async (code, n = 1) => { for (let i = 0; i < n; i++) { await P.key(code); await sleep(120); } };
  await step("boot-fresh");
  await k("Enter"); await sleep(600); await k("Enter"); await sleep(600);
  await step("menu");
  await k("ArrowDown", 3); await k("Enter"); await k("ArrowDown", 3);
  await step("options-2d", true);
  await k("Enter"); await step("options-px", true);
  await k("Enter"); await sleep(1500); await step("options-3d", true);
  await k("Enter"); await step("options-wrap-2d");
  await k("ArrowRight", 4); await sleep(1000); await step("right-x4-clamp-3d");
  await k("ArrowLeft"); await step("left-px", true);
  await k("ArrowDown"); await k("Enter"); await step("camera-locked-px");
  await P.S("Page.reload", {});
  for (let i = 0; i < 80; i++) { await sleep(100); if (await P.ev("!!(window.__GAME__&&document.readyState==='complete')").catch(() => false)) break; }
  await sleep(500);
  await step("reload-px");
  await k("Enter"); await sleep(600); await k("Enter"); await sleep(600);
  await P.ev("window.__GAME__.begin()"); await sleep(900); await step("game-px", true);
  await P.ev("window.__GAME__.app.toMenu()"); await sleep(300);
  await k("ArrowDown", 3); await k("Enter"); await k("ArrowDown", 3); await k("ArrowRight"); await sleep(1500);
  await step("options-to-3d");
  await P.S("Page.reload", {});
  for (let i = 0; i < 80; i++) { await sleep(100); if (await P.ev("!!(window.__GAME__&&document.readyState==='complete')").catch(() => false)) break; }
  await sleep(1500);
  await step("reload-3d");
  await k("Enter"); await sleep(600); await k("Enter"); await sleep(600);
  await P.ev("window.__GAME__.begin()"); await sleep(1500); await step("game-3d", true);
  await P.ev("window.__GAME__.app.toMenu()"); await sleep(300);
  await k("ArrowDown", 3); await k("Enter"); await k("ArrowDown", 3); await k("ArrowLeft", 2); await sleep(500);
  await step("options-back-2d");
  await P.S("Page.reload", {});
  for (let i = 0; i < 80; i++) { await sleep(100); if (await P.ev("!!(window.__GAME__&&document.readyState==='complete')").catch(() => false)) break; }
  await sleep(500);
  await step("reload-2d");
  await k("Enter"); await sleep(600); await k("Enter"); await sleep(600);
  await P.ev("window.__GAME__.begin()"); await sleep(900); await step("game-2d", true);
  const Q = await openPage(c, a, url.replace("debug=1", "render=px&debug=1"));
  await sleep(500); log.push({n: "url-px-over-2d-blob", ...(await Q.ev(ST))});
  log.push({errors: [...P.errors, ...Q.errors]});
  c.close();
} finally {
  if (chr) { chr.proc.kill("SIGKILL"); try { rmSync(chr.dir, {recursive: true, force: true}); } catch {} }
  srv.proc.kill("SIGTERM");
}
writeFileSync(join(OUT, "live.json"), JSON.stringify(log, null, 1));
for (const l of log) console.log(JSON.stringify(l));
