#!/usr/bin/env node
/* Headless capture of the LIVE game (dev-only, zero deps: Node's global
   WebSocket speaks CDP). Starts its own `PORT=0 node serve.js` and a
   chrome-headless-shell with a FRESH --user-data-dir (no stale service
   worker), installs a MessageChannel rAF shim, boots
   index.html?render=<kind>&debug=1, drives the shell through window.__GAME__
   and writes PNGs plus a JSON report (console errors, exceptions, px stats).
   Both children are stopped by PID, never by pattern.

   node tools/pixel/shot.mjs [--render px|2d|3d] [--dpr 1] [--size 1366x768]
     [--mobile] [--rooms 1,7,8] [--out DIR] [--name tag] [--keep]
   Presets: --preset laptop (1366x768@1), mac (1440x900@2),
     phone (393x852@3 mobile), phoneL (852x393@3 mobile).
   $CHROME overrides the browser binary. */
import {spawn} from "node:child_process";
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from "node:fs";
import {tmpdir, homedir} from "node:os";
import {resolve, dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {unpng} from "./rgba.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CHROME = process.env.CHROME || join(homedir(), "Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell");
const PRESET = {laptop: [1366, 768, 1, false], mac: [1440, 900, 2, false], phone: [393, 852, 3, true], phoneL: [852, 393, 3, true]};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const RAF_SHIM = `(()=>{const ch=new MessageChannel();let q=[],last=0;ch.port1.onmessage=()=>{const t=performance.now();if(t-last<15){setTimeout(()=>ch.port2.postMessage(0),15-(t-last));return;}last=t;const c=q;q=[];for(const f of c)try{f(t);}catch(e){setTimeout(()=>{throw e;});}if(q.length)ch.port2.postMessage(0);};window.requestAnimationFrame=(f)=>{q.push(f);if(q.length===1)ch.port2.postMessage(0);return q.length;};window.cancelAnimationFrame=()=>{};})();`;

export function parseArgs(argv) {
  const a = {render: "px", w: 1366, h: 768, dpr: 1, mobile: false, rooms: [1, 7, 8], out: join(ROOT, ".superpowers/sdd/2026-10-10-pixel/out/shots"), name: null, keep: false};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === "--render") { a.render = v; i++; } else if (k === "--dpr") { a.dpr = +v; i++; }
    else if (k === "--size") { [a.w, a.h] = v.split("x").map(Number); i++; } else if (k === "--mobile") a.mobile = true;
    else if (k === "--rooms") { a.rooms = v.split(",").map(Number); i++; } else if (k === "--out") { a.out = resolve(v); i++; }
    else if (k === "--name") { a.name = v; i++; } else if (k === "--keep") a.keep = true;
    else if (k === "--preset") { const p = PRESET[v]; if (p) [a.w, a.h, a.dpr, a.mobile] = p; a.preset = v; i++; }
  }
  return a;
}

export function startServer() {
  return new Promise((ok, no) => {
    const p = spawn(process.execPath, ["serve.js"], {cwd: ROOT, env: {...process.env, PORT: "0"}, stdio: ["ignore", "pipe", "pipe"]});
    const t = setTimeout(() => no(new Error("server start timeout")), 8000);
    p.stdout.on("data", (b) => { const m = /127\.0\.0\.1:(\d+)/.exec(String(b)); if (m) { clearTimeout(t); ok({proc: p, port: +m[1]}); } });
    p.on("exit", (c) => no(new Error("server exited " + c)));
  });
}
export function startChrome() {
  const dir = mkdtempSync(join(tmpdir(), "fg-px-"));
  return new Promise((ok, no) => {
    const p = spawn(CHROME, ["--headless", "--remote-debugging-port=0", "--user-data-dir=" + dir, "--no-first-run", "--no-default-browser-check",
      "--hide-scrollbars", "--mute-audio", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
    const t = setTimeout(() => no(new Error("chrome start timeout")), 15000);
    let buf = "";
    p.stderr.on("data", (b) => { buf += b; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) { clearTimeout(t); ok({proc: p, ws: m[1], dir}); } });
    p.on("exit", (c) => no(new Error("chrome exited " + c + " " + buf.slice(-400))));
  });
}
export async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let id = 0;
  const wait = new Map(), subs = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && wait.has(d.id)) { const [ok, no] = wait.get(d.id); wait.delete(d.id); d.error ? no(new Error(JSON.stringify(d.error))) : ok(d.result); }
    else if (d.method) for (const f of subs) f(d);
  };
  const send = (method, params = {}, sessionId) => new Promise((ok, no) => { const i = ++id; wait.set(i, [ok, no]); ws.send(JSON.stringify({id: i, method, params, sessionId})); });
  return {send, on: (f) => subs.push(f), close: () => ws.close()};
}

export async function openPage(c, a, url) {
  const {targetId} = await c.send("Target.createTarget", {url: "about:blank"});
  const {sessionId} = await c.send("Target.attachToTarget", {targetId, flatten: true});
  const S = (m, p) => c.send(m, p, sessionId);
  const errors = [];
  c.on((d) => {
    if (d.sessionId !== sessionId) return;
    if (d.method === "Runtime.exceptionThrown") errors.push("exception: " + (d.params.exceptionDetails.exception && d.params.exceptionDetails.exception.description || d.params.exceptionDetails.text));
    if (d.method === "Runtime.consoleAPICalled" && (d.params.type === "error" || d.params.type === "warning")) errors.push(d.params.type + ": " + d.params.args.map((x) => x.value || x.description).join(" "));
    if (d.method === "Log.entryAdded" && d.params.entry.level === "error") errors.push("log: " + d.params.entry.text + " " + (d.params.entry.url || ""));
  });
  await S("Page.enable"); await S("Runtime.enable"); await S("Log.enable");
  await S("Emulation.setDeviceMetricsOverride", {width: a.w, height: a.h, deviceScaleFactor: a.dpr, mobile: a.mobile});
  if (a.mobile) await S("Emulation.setTouchEmulationEnabled", {enabled: true, maxTouchPoints: 5});
  await S("Page.addScriptToEvaluateOnNewDocument", {source: RAF_SHIM});
  await S("Page.navigate", {url});
  const ev = async (expr) => { const r = await S("Runtime.evaluate", {expression: expr, awaitPromise: true, returnByValue: true}); if (r.exceptionDetails) throw new Error(expr.slice(0, 80) + ": " + JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
  for (let i = 0; i < 100; i++) { await sleep(100); if (await ev("!!(window.__GAME__&&document.readyState==='complete')").catch(() => false)) break; }
  const shot = async (file) => { const r = await S("Page.captureScreenshot", {format: "png"}); const b = Buffer.from(r.data, "base64"); if (file) writeFileSync(file, b); return file || b; };
  const key = async (code, k) => { for (const type of ["keyDown", "keyUp"]) await S("Input.dispatchKeyEvent", {type, code, key: k || code, windowsVirtualKeyCode: code === "Enter" ? 13 : code === "Space" ? 32 : 0}); };
  return {S, ev, shot, key, errors};
}

/* D5 (plan §3.2, policy c) from the COMPOSITED page, not #px's backing
   store: #c is hidden for one Page.captureScreenshot, the PNG is decoded in
   Node, and device columns / rows of the #px content box are walked on the
   art grid (origin, kx = box w / 300 and ky = box h / 260 from the live rect). For every art-px edge whose two
   art px differ, count the device px between the two art-px centres whose
   colour is neither plateau (tolerance 3/channel). Pass: <= 1 per edge.
   GEO also reports whether rect x dpr equals the backing (no second resample). */
const GEO = `(()=>{const c=document.getElementById('px');if(!c||c.hidden)return null;const r=c.getBoundingClientRect(),cs=getComputedStyle(c),bx=parseFloat(cs.borderLeftWidth)||0,by=parseFloat(cs.borderTopWidth)||0,d=devicePixelRatio;
 const box=[(r.width-2*bx)*d,(r.height-2*by)*d],org=[(r.left+bx)*d,(r.top+by)*d];
 return {dpr:d,box,org,backing:[c.width,c.height],data:[c.dataset.bw,c.dataset.bh],boxIsBacking:Math.abs(box[0]-c.width)<0.02&&Math.abs(box[1]-c.height)<0.02,originOnDevicePx:Math.abs(org[0]-Math.round(org[0]))<0.02&&Math.abs(org[1]-Math.round(org[1]))<0.02};})()`;
export function d5Scan(img, geo, cols = [30.5, 110.5, 190.5], rows = [30.5, 130.5]) {
  const k = geo.box[0] / 300, ky = geo.box[1] / 260, ox = Math.round(geo.org[0]), oy = Math.round(geo.org[1]), D = img.data, W = img.width;
  const px = (x, y) => { const i = (Math.max(0, Math.min(img.height - 1, y)) * W + Math.max(0, Math.min(W - 1, x))) * 4; return [D[i], D[i + 1], D[i + 2]]; };
  const eq = (a, b) => Math.abs(a[0] - b[0]) <= 3 && Math.abs(a[1] - b[1]) <= 3 && Math.abs(a[2] - b[2]) <= 3;
  let worst = 0, edges = 0;
  const hist = [0, 0, 0, 0];
  const walk = (at, n, k) => {
    for (let j = 1; j < n; j++) {
      const a = Math.floor((j - 0.5) * k), b = Math.floor((j + 0.5) * k), A = at(a), B = at(b);
      if (eq(A, B)) continue;
      edges++;
      let m = 0;
      for (let q = a + 1; q < b; q++) { const P = at(q); if (!eq(P, A) && !eq(P, B)) m++; }
      worst = Math.max(worst, m); hist[Math.min(3, m)]++;
    }
  };
  for (const cx of cols) { const x = ox + Math.floor(cx * k); walk((y) => px(x, oy + y), 260, ky); }
  for (const ry of rows) { const y = oy + Math.floor(ry * ky); walk((x) => px(ox + x, y), 300, k); }
  return {k: +k.toFixed(3), ky: +ky.toFixed(3), edges, worstSoftEdgePx: worst, hist, pass: worst <= 1};
}
/* Perf with a forced flush: render, then getImageData(0,0,1,1) on the target
   canvas, so the drawImage raster is inside the timed span (stat.ms alone
   times only command recording). Run LAST: repeated readbacks can demote a
   canvas to software. */
const PERF = `(()=>{const g=window.__GAME__,r=g.renderer,G=g.G,px=document.getElementById('px'),cv=px&&!px.hidden?px:document.getElementById('c'),x=cv.getContext('2d');const ms=[];
 for(let i=0;i<40;i++){const t=performance.now();r.render(G,0,{hud:true});x.getImageData(0,0,1,1);ms.push(performance.now()-t);}ms.sort((a,b)=>a-b);
 return {canvas:cv.id,median:+ms[20].toFixed(2),p90:+ms[36].toFixed(2),max:+ms[39].toFixed(2),enemies:G.enemies.length,M:r._dbg&&r._dbg.stat?r._dbg.stat.M:null};})()`;
const FAT = `Promise.all([import('/src/core/entities.js'),import('/src/core/config.js')]).then(([E,C])=>{const G=window.__GAME__.G;G.state='PLAY';let i=0;for(const f of E.FOES)for(let y=1;y<12&&i<99;y++)for(let x=3;x<14;x++)if(G.grid[C.key(x,y)]===C.T.EMPTY&&(x*3+y*5+i)%9===0){G.enemies.push(E.spawnEnemy(f.t,x,y,G.level,null));i++;y=99;break;}})`;
const STAT = `(()=>{const g=window.__GAME__,r=g.renderer,d=r&&r._dbg;const px=document.getElementById('px'),gl=document.getElementById('gl');
 return {state:g.state(),level:g.G.level,kind:d&&d.atlas?'px':(gl&&!gl.hidden?'3d':'2d'),pxHidden:px?px.hidden:null,glHidden:gl?gl.hidden:null,
 pxCss:px?[px.clientWidth,px.clientHeight]:null,pxBuf:px?[px.width,px.height]:null,stat:d&&d.stat?{...d.stat}:null,bakeMs:d&&d.bakeMs,
 pending:d&&d.atlas?d.atlas.pending.size:null,dpr:devicePixelRatio,lay:document.body.getAttribute('data-lay')};})()`;

export async function run(a) {
  mkdirSync(a.out, {recursive: true});
  const tag = a.name || [a.render, a.preset || a.w + "x" + a.h, "d" + a.dpr].join("-");
  const srv = await startServer();
  let chr = null;
  const report = {tag, render: a.render, size: [a.w, a.h], dpr: a.dpr, mobile: a.mobile, shots: [], stats: [], errors: []};
  try {
    chr = await startChrome();
    const c = await cdp(chr.ws);
    const url = "http://127.0.0.1:" + srv.port + "/index.html?render=" + a.render + "&debug=1";
    const P = await openPage(c, a, url);
    const snap = async (n) => { await sleep(350); report.shots.push(await P.shot(join(a.out, tag + "-" + n + ".png"))); report.stats.push({n, ...(await P.ev(STAT))}); };
    await snap("title");
    await P.key("Enter"); await sleep(5200); await snap("menu");
    await P.ev("window.__GAME__.begin()"); await sleep(900); await snap("game");
    await P.ev("window.__GAME__.setKeys({move:{x:1,y:0}})"); await sleep(500); await P.ev("window.__GAME__.setKeys({move:{x:0,y:0},fire:true})"); await sleep(80); await P.ev("window.__GAME__.setKeys({fire:false})"); await sleep(400); await snap("bomb");
    for (const r of a.rooms) { if (r === 1) continue; await P.ev(`import('/src/core/sim.js').then(m=>{m.loadLevel(window.__GAME__.G,${r},true);window.__GAME__.G.state='PLAY';})`); await sleep(700); await snap("room" + r); }
    if (a.render === "px") {
      await P.ev(FAT); await sleep(300);
      const geo = await P.ev(GEO);
      await P.ev("document.getElementById('c').style.visibility='hidden'"); await sleep(120);
      const png = await P.shot(null);
      await P.ev("document.getElementById('c').style.visibility=''");
      writeFileSync(join(a.out, tag + "-d5.png"), png);
      report.d5 = {geo, ...d5Scan(unpng(png), geo)};
      report.bakeMs = await P.ev("window.__GAME__.renderer._dbg.bakeMs");
      for (const [n, z, sx, sy] of [["zoom25", 2.5, 600, 520], ["zoom06", 0.6, 300, 260]]) { await P.ev(`import('/src/render/cameraCtl.js').then(m=>{const c=window.__GAME__.cam;m.resetCamera(c);m.zoomAt(c,${z},${sx},${sy},600,520,'2d');})`); await snap(n); }
      await P.ev("import('/src/render/cameraCtl.js').then(m=>m.resetCamera(window.__GAME__.cam))");
    }
    await P.ev(`(()=>{const G=window.__GAME__.G,p=G.players[0];G.lives=1;p.iFrames=0;p.shield=false;G.bombs.push({x:p.x,y:p.y,tx:Math.floor(p.x/40),ty:Math.floor(p.y/40),timer:0.05,radius:1,variant:'normal',dead:false});})()`);
    for (let i = 0; i < 30 && (await P.ev("window.__GAME__.G.state")) !== "LOSE"; i++) await sleep(50);
    await snap("lose");
    await P.ev("window.__pause&&window.__pause()"); await sleep(300); await snap("pause");
    await P.ev("window.__resume&&window.__resume();window.__GAME__.G.state='WIN'"); await sleep(300); await snap("win");
    if (a.render === "px") {
      await P.ev("window.__GAME__.begin()"); await sleep(600); await P.ev(FAT); await sleep(300);
      const px = await P.ev(PERF);
      const Q = await openPage(c, a, url.replace("render=px", "render=2d"));
      await Q.key("Enter"); await sleep(5200); await Q.ev("window.__GAME__.begin()"); await sleep(600); await Q.ev(FAT); await sleep(300);
      report.perf = {flushed: true, px, classic: await Q.ev(PERF), note: "render + getImageData(0,0,1,1) per sample; swiftshader harness, relative only"};
      report.errors.push(...Q.errors);
    }
    report.errors.push(...P.errors);
    c.close();
  } finally {
    if (chr) { chr.proc.kill("SIGKILL"); if (!a.keep) try { rmSync(chr.dir, {recursive: true, force: true}); } catch {} }
    srv.proc.kill("SIGTERM");
  }
  writeFileSync(join(a.out, tag + ".json"), JSON.stringify(report, null, 1));
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await run(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify({tag: r.tag, errors: r.errors, d5: r.d5, perf: r.perf, stats: r.stats.map((s) => ({n: s.n, state: s.state, level: s.level, kind: s.kind, pxBuf: s.pxBuf, stat: s.stat, pending: s.pending, bakeMs: s.bakeMs && +s.bakeMs.toFixed(1)}))}, null, 1));
}
