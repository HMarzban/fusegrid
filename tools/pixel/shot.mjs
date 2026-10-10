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
  const shot = async (file) => { const r = await S("Page.captureScreenshot", {format: "png"}); writeFileSync(file, Buffer.from(r.data, "base64")); return file; };
  const key = async (code, k) => { for (const type of ["keyDown", "keyUp"]) await S("Input.dispatchKeyEvent", {type, code, key: k || code, windowsVirtualKeyCode: code === "Enter" ? 13 : code === "Space" ? 32 : 0}); };
  return {S, ev, shot, key, errors};
}

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
    await P.ev("window.__pause&&window.__pause()"); await sleep(300); await snap("pause");
    await P.ev("window.__resume&&window.__resume();window.__GAME__.G.state='WIN'"); await sleep(300); await snap("win");
    report.errors = P.errors;
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
  console.log(JSON.stringify({tag: r.tag, errors: r.errors, stats: r.stats.map((s) => ({n: s.n, state: s.state, level: s.level, kind: s.kind, pxBuf: s.pxBuf, stat: s.stat, pending: s.pending, bakeMs: s.bakeMs && +s.bakeMs.toFixed(1)}))}, null, 1));
}
