#!/usr/bin/env node
/* Headless capture of the LIVE game (dev-only, zero deps: Node's global
   WebSocket speaks CDP). Starts its own `PORT=0 node serve.js` and a
   chrome-headless-shell with a FRESH --user-data-dir (no stale service
   worker), installs a MessageChannel rAF shim, boots
   index.html?render=<kind>&debug=1, drives the shell through window.__GAME__
   and writes PNGs plus a JSON report (console errors, exceptions, px stats,
   and per shot the seed / heat / pace / gen the world read back plus a wall
   and brick hash of the board).

   node tools/pixel/shot.mjs [flags]
     --render px|2d|3d   look to boot (default px)
     --preset NAME       laptop (1366x768@1), mac (1440x900@2),
                         phone (393x852@3 mobile), phoneL (852x393@3 mobile)
     --size WxH          viewport (default 1366x768)
     --dpr N             device pixel ratio (default 1)
     --mobile            mobile + touch emulation
     --rooms 1,7,8       rooms to capture, 1..8 (default 1,7,8); room 1 is
                         reloaded like the others, so it honours the flags
     --seed N            world.seed (uint32) before every room load
     --heat 0|1|2        world.heat (CORE / PLUS / MAX) before every room load
     --pace -1|0|1       world.pace (EASY / NORM / HARD) before every room load
     --gen N             world.gen (1 today's boards, 2 bold mazes, 3 + floor
                         tiles) before every room load; a page whose world
                         has no gen field warns in the report and ignores it
     --pause             also capture a PAUSE still per room (roomN-pause)
     --out DIR           output dir (default .superpowers/sdd/2026-10-10-pixel/
                         out/shots, git-ignored)
     --name TAG          file prefix (default <render>-<preset|WxH>-d<dpr>)
     --keep              keep the Chrome profile dir
     --gpu               ANGLE on Metal instead of swiftshader, so the perf
                         section can judge the absolute 4 ms budget; the
                         default swiftshader run is relative only
   Browser: $CHROME if set, else the newest installed
   ~/Library/Caches/ms-playwright/chromium_headless_shell-<N>/chrome-headless-shell-<platform>/chrome-headless-shell.
   Exits non-zero, before spawning anything, when no binary exists.

   Time is virtual: the page's rAF is held and the script steps it in exact
   1000/60 ms frames, and Math.random is seeded, so the same flags give the
   same frames (byte-identical CLASSIC PNGs). The px PERF pages stay real time.
   Every child is stopped by PID, never by pattern (also on a crash or
   Ctrl-C, through an exit hook); Chrome's exit is awaited before its fg-px-*
   profile is deleted. */
import {spawn} from "node:child_process";
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, existsSync} from "node:fs";
import {tmpdir, homedir} from "node:os";
import {resolve, dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {unpng} from "./rgba.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const PW_DIR = join(homedir(), "Library/Caches/ms-playwright");
const PRESET = {laptop: [1366, 768, 1, false], mac: [1440, 900, 2, false], phone: [393, 852, 3, true], phoneL: [852, 393, 3, true]};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* p, or false after ms; the timer never holds the process open */
const within = (p, ms) => new Promise((r) => { const t = setTimeout(() => r(false), ms); t.unref(); p.then(() => { clearTimeout(t); r(true); }, () => { clearTimeout(t); r(true); }); });

/* $CHROME wins as given (the caller checks it exists); else the newest
   chromium_headless_shell-<N> (numeric order) that holds a binary. */
export function findChrome(env = process.env, base = PW_DIR) {
  if (env.CHROME) return env.CHROME;
  let ds = [];
  try { ds = readdirSync(base); } catch { return null; }
  const vs = ds.map((d) => /^chromium_headless_shell-(\d+)$/.exec(d)).filter(Boolean).sort((a, b) => b[1] - a[1]);
  for (const [d] of vs) {
    let sub = [];
    try { sub = readdirSync(join(base, d)).filter((s) => s.startsWith("chrome-headless-shell-")).sort(); } catch { continue; }
    for (const s of sub) { const f = join(base, d, s, "chrome-headless-shell"); if (existsSync(f)) return f; }
  }
  return null;
}

/* every child and profile dir from spawn on, so a crash, a timeout or a
   signal still stops them by PID */
const live = new Set(), dirs = new Set();
let hooked = false;
function track(p) {
  live.add(p);
  p.once("exit", () => live.delete(p));
  p.once("error", () => live.delete(p));
  if (!hooked) {
    hooked = true;
    process.on("exit", () => {
      for (const c of live) try { c.kill("SIGKILL"); } catch {}
      for (const d of dirs) try { rmSync(d, {recursive: true, force: true}); } catch {}
    });
  }
  return p;
}
const gone = (p) => p.exitCode !== null || p.signalCode !== null || !p.pid;
export async function stop(p, sig = "SIGTERM", ms = 5000) {
  if (!p || gone(p)) return;
  const done = new Promise((r) => p.once("exit", r));
  try { p.kill(sig); } catch {}
  if (await within(done, ms)) return;
  try { p.kill("SIGKILL"); } catch {}
  await within(done, 2000);
}

export const RAF_SHIM = `(()=>{const ch=new MessageChannel();let q=[],last=0,vt=0,hold=!!window.__vtHold;const fire=(t)=>{const c=q;q=[];for(const f of c)try{f(t);}catch(e){setTimeout(()=>{throw e;});}};ch.port1.onmessage=()=>{if(hold)return;const t=performance.now();if(t-last<15){setTimeout(()=>ch.port2.postMessage(0),15-(t-last));return;}last=t;fire(t);if(q.length)ch.port2.postMessage(0);};window.requestAnimationFrame=(f)=>{q.push(f);if(q.length===1&&!hold)ch.port2.postMessage(0);return q.length;};window.cancelAnimationFrame=()=>{};window.__vt=async(n)=>{hold=true;for(let i=0;i<n;i++){vt+=1000/60;fire(vt);await new Promise((r)=>{const m=new MessageChannel();m.port1.onmessage=r;m.port2.postMessage(0);});}return vt;};})();`;
const VT_INIT = `window.__vtHold=true;(()=>{let s=0x9e3779b9;Math.random=()=>{s=(s+0x6d2b79f5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};})();`;

const ONE = (k, v, ok, what) => { if (v == null || !ok.test(v)) throw new Error(k + " wants " + what + ", got " + (v == null ? "nothing" : JSON.stringify(v))); return +v; };
export function parseArgs(argv) {
  const a = {render: "px", w: 1366, h: 768, dpr: 1, mobile: false, rooms: [1, 7, 8], out: join(ROOT, ".superpowers/sdd/2026-10-10-pixel/out/shots"), name: null, keep: false, gpu: false, seed: null, heat: null, pace: null, gen: null, pause: false};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === "--render") { if (!["px", "2d", "3d"].includes(v)) throw new Error("--render wants px|2d|3d, got " + v); a.render = v; i++; }
    else if (k === "--dpr") { a.dpr = ONE(k, v, /^\d+(\.\d+)?$/, "a number"); i++; }
    else if (k === "--size") { if (!/^\d+x\d+$/.test(v || "")) throw new Error("--size wants WxH, got " + v); [a.w, a.h] = v.split("x").map(Number); i++; }
    else if (k === "--mobile") a.mobile = true;
    else if (k === "--rooms") { if (!/^[1-8](,[1-8])*$/.test(v || "")) throw new Error("--rooms wants a list of 1..8, got " + v); a.rooms = v.split(",").map(Number); i++; }
    else if (k === "--out") { if (!v) throw new Error("--out wants a dir"); a.out = resolve(v); i++; }
    else if (k === "--name") { if (!v) throw new Error("--name wants a tag"); a.name = v; i++; }
    else if (k === "--keep") a.keep = true; else if (k === "--gpu") a.gpu = true; else if (k === "--pause") a.pause = true;
    else if (k === "--preset") { const p = PRESET[v]; if (!p) throw new Error("--preset wants " + Object.keys(PRESET).join("|") + ", got " + v); [a.w, a.h, a.dpr, a.mobile] = p; a.preset = v; i++; }
    else if (k === "--seed") { a.seed = ONE(k, v, /^\d{1,10}$/, "a uint32"); if (a.seed > 4294967295) throw new Error("--seed wants a uint32, got " + v); i++; }
    else if (k === "--heat") { a.heat = ONE(k, v, /^[012]$/, "0|1|2"); i++; }
    else if (k === "--pace") { a.pace = ONE(k, v, /^(-1|0|1)$/, "-1|0|1"); i++; }
    else if (k === "--gen") { a.gen = ONE(k, v, /^[1-9]$/, "a generation 1..9"); i++; }
    else throw new Error("unknown flag " + k + " (see the header of tools/pixel/shot.mjs)");
  }
  return a;
}

export function startServer() {
  return new Promise((ok, no) => {
    const p = track(spawn(process.execPath, ["serve.js"], {cwd: ROOT, env: {...process.env, PORT: "0"}, stdio: ["ignore", "pipe", "pipe"]}));
    const t = setTimeout(() => { no(new Error("server start timeout")); stop(p); }, 8000);
    p.on("error", (e) => { clearTimeout(t); no(e); });
    p.stdout.on("data", (b) => { const m = /127\.0\.0\.1:(\d+)/.exec(String(b)); if (m) { clearTimeout(t); ok({proc: p, port: +m[1]}); } });
    p.on("exit", (c) => { clearTimeout(t); no(new Error("server exited " + c)); });
  });
}
export async function startChrome(gpu = false, bin = findChrome()) {
  if (!bin || !existsSync(bin)) throw new Error(bin ? "no browser at CHROME=" + bin : "no chrome-headless-shell: set CHROME or install one under " + PW_DIR + "/chromium_headless_shell-<N>");
  const dir = mkdtempSync(join(tmpdir(), "fg-px-"));
  dirs.add(dir);
  const p = track(spawn(bin, ["--headless", "--remote-debugging-port=0", "--user-data-dir=" + dir, "--no-first-run", "--no-default-browser-check",
    "--hide-scrollbars", "--mute-audio", ...(gpu ? ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]), "about:blank"], {stdio: ["ignore", "ignore", "pipe"]}));
  try {
    const ws = await new Promise((ok, no) => {
      const t = setTimeout(() => no(new Error("chrome start timeout")), 15000);
      let buf = "";
      p.on("error", (e) => { clearTimeout(t); no(e); });
      p.stderr.on("data", (b) => { buf += b; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) { clearTimeout(t); ok(m[1]); } });
      p.on("exit", (c) => { clearTimeout(t); no(new Error("chrome exited " + c + " " + buf.slice(-400))); });
    });
    return {proc: p, ws, dir};
  } catch (e) { await stopChrome({proc: p, dir}, null); throw e; }
}
/* graceful close (CDP Browser.close), then SIGTERM / SIGKILL, and only after
   the browser has exited is its profile deleted */
export async function stopChrome(chr, c, keep = false) {
  if (!chr) return;
  if (c) { try { await within(c.send("Browser.close"), 2000); } catch {} try { c.close(); } catch {} }
  await within(new Promise((r) => (gone(chr.proc) ? r() : chr.proc.once("exit", r))), 3000);
  await stop(chr.proc, "SIGTERM", 5000);
  if (!keep) { try { rmSync(chr.dir, {recursive: true, force: true, maxRetries: 5, retryDelay: 200}); } catch {} dirs.delete(chr.dir); }
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
  ws.onclose = () => { for (const [, no] of wait.values()) no(new Error("CDP socket closed")); wait.clear(); };
  const send = (method, params = {}, sessionId) => new Promise((ok, no) => { const i = ++id; wait.set(i, [ok, no]); ws.send(JSON.stringify({id: i, method, params, sessionId})); });
  return {send, on: (f) => subs.push(f), close: () => ws.close()};
}

/* a.vt holds the page's rAF from the first script (see the header):
   adv(ms) then steps round(ms*60/1000) frames instead of sleeping */
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
  await S("Page.addScriptToEvaluateOnNewDocument", {source: (a.vt ? VT_INIT : "") + RAF_SHIM});
  await S("Page.navigate", {url});
  const ev = async (expr) => { const r = await S("Runtime.evaluate", {expression: expr, awaitPromise: true, returnByValue: true}); if (r.exceptionDetails) throw new Error(expr.slice(0, 80) + ": " + JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
  for (let i = 0; i < 100; i++) { await sleep(100); if (await ev("!!(window.__GAME__&&document.readyState==='complete')").catch(() => false)) break; }
  const shot = async (file) => { const r = await S("Page.captureScreenshot", {format: "png"}); const b = Buffer.from(r.data, "base64"); if (file) writeFileSync(file, b); return file || b; };
  const key = async (code, k) => { for (const type of ["keyDown", "keyUp"]) await S("Input.dispatchKeyEvent", {type, code, key: k || code, windowsVirtualKeyCode: code === "Enter" ? 13 : code === "Space" ? 32 : 0}); };
  const adv = (ms) => (a.vt ? ev("window.__vt(" + Math.max(1, Math.round((ms * 60) / 1000)) + ")") : sleep(ms));
  return {S, ev, shot, key, adv, errors};
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
   times only command recording). x10 renders ten times per readback, so one
   GPU sync is spread over ten frames: the throughput figure the budget is
   judged on. Run LAST: repeated readbacks can demote a canvas to software. */
const PERF = `(()=>{const g=window.__GAME__,r=g.renderer,G=g.G,px=document.getElementById('px'),cv=px&&!px.hidden?px:document.getElementById('c'),x=cv.getContext('2d');const ms=[];
 for(let i=0;i<40;i++){const t=performance.now();r.render(G,0,{hud:true});x.getImageData(0,0,1,1);ms.push(performance.now()-t);}ms.sort((a,b)=>a-b);
 const tn=[];for(let j=0;j<9;j++){const t=performance.now();for(let i=0;i<10;i++)r.render(G,0,{hud:true});x.getImageData(0,0,1,1);tn.push((performance.now()-t)/10);}tn.sort((a,b)=>a-b);
 return {canvas:cv.id,median:+ms[20].toFixed(2),p90:+ms[36].toFixed(2),max:+ms[39].toFixed(2),x10:+tn[4].toFixed(2),enemies:G.enemies.length,M:r._dbg&&r._dbg.stat?r._dbg.stat.M:null};})()`;
const FAT = `Promise.all([import('/src/core/entities.js'),import('/src/core/config.js')]).then(([E,C])=>{const G=window.__GAME__.G;G.state='PLAY';let i=0;for(const f of E.FOES)for(let y=1;y<12&&i<99;y++)for(let x=3;x<14;x++)if(G.grid[C.key(x,y)]===C.T.EMPTY&&(x*3+y*5+i)%9===0){G.enemies.push(E.spawnEnemy(f.t,x,y,G.level,null));i++;y=99;break;}})`;
/* board: FNV-1a of the WALL (2) / BRICK (1) cell indices plus their counts,
   so "same walls, other bricks" is two numbers in the report */
const STAT = `(()=>{const g=window.__GAME__,r=g.renderer,d=r&&r._dbg,G=g.G;const px=document.getElementById('px'),gl=document.getElementById('gl');
 const hb=(v)=>{let h=2166136261,n=0;const a=G.grid||[];for(let i=0;i<a.length;i++)if(a[i]===v){n++;h=Math.imul(h^i,16777619)>>>0;}return {n,h:h.toString(16)};};
 return {state:g.state(),level:G.level,seed:G.seed,heat:G.heat,pace:G.pace,gen:G.gen,walls:hb(2),bricks:hb(1),kind:d&&d.atlas?'px':(gl&&!gl.hidden?'3d':'2d'),pxHidden:px?px.hidden:null,glHidden:gl?gl.hidden:null,
 pxCss:px?[px.clientWidth,px.clientHeight]:null,pxBuf:px?[px.width,px.height]:null,stat:d&&d.stat?{...d.stat}:null,bakeMs:d&&d.bakeMs,
 pending:d&&d.atlas?d.atlas.pending.size:null,dpr:devicePixelRatio,lay:document.body.getAttribute('data-lay'),boardReady:g.app.boardReady};})()`;
/* set the flagged world fields, then reload room r with progress kept */
export function loadExpr(a, r) {
  const set = [a.seed != null ? "G.seed=" + a.seed + ">>>0;" : "", a.heat != null ? "G.heat=" + a.heat + ";" : "", a.pace != null ? "G.pace=" + a.pace + ";" : "",
    a.gen != null ? "if('gen' in G)G.gen=" + a.gen + ";else w.push('--gen " + a.gen + " ignored: this world has no gen field');" : ""].join("");
  return `import('/src/core/sim.js').then(m=>{const G=window.__GAME__.G,w=[];${set}m.loadLevel(G,${r},true);G.state='PLAY';return w;})`;
}

export async function run(a) {
  const bin = findChrome();
  if (!bin) throw new Error("no chrome-headless-shell: set CHROME or install one under " + PW_DIR + "/chromium_headless_shell-<N>");
  if (!existsSync(bin)) throw new Error("no browser at CHROME=" + bin);
  mkdirSync(a.out, {recursive: true});
  const tag = a.name || [a.render, a.preset || a.w + "x" + a.h, "d" + a.dpr].join("-");
  const board = {seed: a.seed, heat: a.heat, pace: a.pace, gen: a.gen};
  const report = {tag, render: a.render, size: [a.w, a.h], dpr: a.dpr, mobile: a.mobile, board, chrome: bin, shots: [], stats: [], errors: [], warnings: []};
  let srv = null, chr = null, c = null;
  try {
    srv = await startServer();
    console.error("shot: serve.js pid " + srv.proc.pid + " port " + srv.port);
    chr = await startChrome(a.gpu, bin);
    console.error("shot: chrome pid " + chr.proc.pid + " profile " + chr.dir);
    c = await cdp(chr.ws);
    const url = "http://127.0.0.1:" + srv.port + "/index.html?render=" + a.render + "&debug=1";
    const P = await openPage(c, {...a, vt: true}, url);
    /* px and three load async: give them real time (frames still stepped) until the look is live */
    const ready = async () => { for (let i = 0; i < 150; i++) { const s = await P.ev(STAT); if (s.boardReady !== false && (a.render === "2d" || s.kind === a.render)) return; await P.adv(50); await sleep(100); } report.warnings.push("look " + a.render + " never went live"); };
    const snap = async (n) => { await P.adv(350); await sleep(60); report.shots.push(await P.shot(join(a.out, tag + "-" + n + ".png"))); report.stats.push({n, ...(await P.ev(STAT))}); };
    const load = async (r) => { report.warnings.push(...(await P.ev(loadExpr(a, r)))); };
    const flagged = a.seed != null || a.heat != null || a.pace != null || a.gen != null;
    await ready();
    await snap("title");
    await P.key("Enter"); await P.adv(5200); await snap("menu");
    await P.ev("window.__GAME__.begin()"); if (flagged) await load(1);
    await ready(); await P.adv(900); await snap("game");
    await P.ev("window.__GAME__.setKeys({move:{x:1,y:0}})"); await P.adv(500); await P.ev("window.__GAME__.setKeys({move:{x:0,y:0},fire:true})"); await P.adv(80); await P.ev("window.__GAME__.setKeys({fire:false})"); await P.adv(400); await snap("bomb");
    for (const r of a.rooms) {
      await load(r); await P.adv(700); await snap("room" + r);
      if (a.pause) { await P.ev("window.__pause&&window.__pause()"); await P.adv(300); await snap("room" + r + "-pause"); await P.ev("window.__resume&&window.__resume()"); }
    }
    if (a.render === "px") {
      await P.ev(FAT); await P.adv(300);
      const geo = await P.ev(GEO);
      await P.ev("document.getElementById('c').style.visibility='hidden'"); await P.adv(120); await sleep(60);
      const png = await P.shot(null);
      await P.ev("document.getElementById('c').style.visibility=''");
      writeFileSync(join(a.out, tag + "-d5.png"), png);
      report.d5 = {geo, ...d5Scan(unpng(png), geo)};
      report.bakeMs = await P.ev("window.__GAME__.renderer._dbg.bakeMs");
      for (const [n, z, sx, sy] of [["zoom25", 2.5, 600, 520], ["zoom06", 0.6, 300, 260]]) { await P.ev(`import('/src/render/cameraCtl.js').then(m=>{const c=window.__GAME__.cam;m.resetCamera(c);m.zoomAt(c,${z},${sx},${sy},600,520,'2d');})`); await snap(n); }
      await P.ev("import('/src/render/cameraCtl.js').then(m=>m.resetCamera(window.__GAME__.cam))");
    }
    await P.ev("window.__GAME__.G.state='PLAY';window.__pause&&window.__pause()"); await P.adv(300); await snap("pause");
    await P.ev("window.__resume&&window.__resume()"); await P.adv(100);
    await P.ev(`(()=>{const G=window.__GAME__.G,p=G.players[0];G.lives=1;p.iFrames=0;p.shield=false;G.bombs.push({x:p.x,y:p.y,tx:Math.floor(p.x/40),ty:Math.floor(p.y/40),timer:0.05,radius:1,variant:'normal',dead:false});})()`);
    for (let i = 0; i < 30 && (await P.ev("window.__GAME__.G.state")) !== "LOSE"; i++) await P.adv(50);
    await snap("lose");
    await P.ev("window.__GAME__.G.state='WIN'"); await P.adv(300); await snap("win");
    if (a.render === "px") {
      const fresh = async (u) => { const R = await openPage(c, {...a, vt: false}, u); await R.key("Enter"); await sleep(5200); await R.ev("window.__GAME__.begin()"); await sleep(600); await R.ev(FAT); await sleep(300); return R; };
      const R = await fresh(url), Q = await fresh(url.replace("render=px", "render=2d"));
      const px = await R.ev(PERF), classic = await Q.ev(PERF);
      if (px.enemies !== classic.enemies) report.errors.push("perf worlds differ: px " + px.enemies + " foes vs CLASSIC " + classic.enemies);
      report.errors.push(...R.errors);
      report.perf = {flushed: true, px, classic, gpu: a.gpu, note: "render + getImageData(0,0,1,1) per sample; x10 = ten renders per readback, ms per render; " + (a.gpu ? "Metal GPU: absolute, judge the 4 ms budget on x10" : "swiftshader harness, relative only")};
      report.errors.push(...Q.errors);
    }
    report.errors.push(...P.errors);
  } finally {
    await stopChrome(chr, c, a.keep);
    if (srv) await stop(srv.proc);
  }
  writeFileSync(join(a.out, tag + ".json"), JSON.stringify(report, null, 1));
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const s of ["SIGINT", "SIGTERM", "SIGHUP"]) process.once(s, () => process.exit(130));
  try {
    const r = await run(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify({tag: r.tag, board: r.board, errors: r.errors, warnings: r.warnings, d5: r.d5, perf: r.perf, stats: r.stats.map((s) => ({n: s.n, state: s.state, level: s.level, seed: s.seed, heat: s.heat, pace: s.pace, gen: s.gen, walls: s.walls, bricks: s.bricks, kind: s.kind, pxBuf: s.pxBuf, stat: s.stat, pending: s.pending, bakeMs: s.bakeMs && +s.bakeMs.toFixed(1)}))}, null, 1));
  } catch (e) {
    console.error("shot: " + (e && e.message || e));
    process.exitCode = 1;
  }
}
