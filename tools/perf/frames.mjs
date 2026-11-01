#!/usr/bin/env node
/* Real-GPU frame times (#34, dev-only, zero deps: Node's global WebSocket speaks
   CDP). Starts its own `PORT=0 node serve.js` and a HEADED Chrome for Testing
   (ANGLE on Metal, fresh --user-data-dir, so no stale service worker), brings
   the window to the front and records with the native rAF. No shim, no virtual
   time. It refuses to report if the page is hidden, the rAF clock is not at the
   display rate, or WebGL / 2D canvas are not GPU backed.

   node tools/perf/frames.mjs [flags]       about 5 min for the default matrix
                                            (100 s per look; sweep 1 min per look);
                                            it takes the owner's focus meanwhile
     --looks 2d,px,3d    looks to run (default all three)
     --only smoke|desk|phone|rate|sweep|flush|hitch   one block (default desk,phone,rate)
       smoke     5 s check of the clock, the GPU and the staging; prints and stops
       desk      MENU, busy gen-2 room, fat world, worst gen-3 room, PAUSE
       sweep     the desk rooms alone, every world at gen 2 and gen 3
       phone     393x852 @3 mobile emulation of the same scenes (M5 GPU, not a phone)
       rate      the busy room at FRAME RATE 30 / 60 / MAX
       hitch     each first (room, lock-on, blast, kill) alone on a fresh page, with
                 the longest frame, the 3D program count, and a second pass under
                 the CPU profiler naming the top self-time functions
       flush     render + a GPU readback, at the real backing size, every gen-3 room,
                 gen-2 room 8 and the fat world: the GPU cost the 60 Hz clock hides.
                 Vsync off is no use for this: the rAF outruns the fixed step, so
                 most frames skip the raster and the governor sees false jank.
     --rooms 3,8         rooms for the busy scene (default 8 for gen 2)
     --tile N            room for the gen-3 scene (default 8)
     --secs N            seconds per window (default 6, sweep 3)
     --fps 0|1|2         FRAME RATE for desk / phone: 30 / 60 (AUTO, default) / MAX
     --at X,Y            window position, to pick a display (the rAF period is
                         measured, never assumed)
     --throttle N        CDP CPU throttle on the page for phone (a JS-only proxy: the
                         GPU stays an M5, so it is no phone number)
     --out DIR           JSON + table (default .superpowers/sdd/perf, git-ignored)
     --keep              keep the Chrome profile dir
   Binary: $CHROME if set, else the newest ms-playwright chromium-<N>.

   Each window is one awaited in-page promise, with no CDP traffic inside it:
     interval  plain rAF timestamp deltas; dropped = missed vsyncs at the measured
               display period (saturates at the period: it cannot show headroom)
     work      time inside the game's own rAF callback, through a pass-through
               wrapper that changes no timing; drawn = frames over WORK_MIN, so the
               gate's skipped frames do not flatter the median. JS only: canvas
               raster and GPU time are not in it (see --only flush)
     loaf      long-animation-frame entries (>= 50 ms) with their top script
     cpu       SystemInfo.getProcessInfo deltas per process type, ms per wall s
   The staged foes are pinned so the lock-on chevrons really show; the report
   carries the locks, blast share, foes and pickups read back in the window.
   Every child is stopped by PID, also on a crash or Ctrl-C. */
import {spawn} from "node:child_process";
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, existsSync} from "node:fs";
import {tmpdir, loadavg, cpus} from "node:os";
import {resolve, dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {startServer, stop, stopChrome, cdp, PW_DIR} from "../pixel/shot.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const WORK_MIN = 0.1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (v) => +v.toFixed(2);

/* nearest-rank; a is sorted ascending */
export const pct = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.max(0, Math.ceil((p / 100) * a.length) - 1))] : 0);
const spread = (v) => { const s = v.slice().sort((x, y) => x - y); return {n: s.length, min: round(s.length ? s[0] : 0), med: round(pct(s, 50)), p95: round(pct(s, 95)), p99: round(pct(s, 99)), max: round(s.length ? s[s.length - 1] : 0)}; };
/* the vsync period from a blank page's intervals */
export const periodOf = (iv) => pct(iv.slice().sort((x, y) => x - y), 50);
/* an interval covers round(iv/period) vsyncs; every one past the first was missed */
export function dropped(iv, period) {
  let d = 0;
  if (period > 0) for (const v of iv) d += Math.max(0, Math.round(v / period) - 1);
  return d;
}
export function summarize(iv, wk, period) {
  const drawn = wk.filter((v) => v >= WORK_MIN), sum = wk.reduce((a, b) => a + b, 0);
  return {interval: spread(iv), dropped: dropped(iv, period), work: spread(drawn), workMean: round(iv.length ? sum / iv.length : 0), drawnFrames: drawn.length};
}

export function parseArgs(argv) {
  const a = {looks: ["2d", "px", "3d"], only: ["desk", "phone", "rate"], rooms: [8], tile: 8, secs: 6, fps: 1, throttle: 1, at: "40,40", out: join(ROOT, ".superpowers/sdd/perf"), keep: false};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === "--looks") { if (!/^(2d|px|3d)(,(2d|px|3d))*$/.test(v || "")) throw new Error("--looks wants 2d,px,3d, got " + v); a.looks = v.split(","); i++; }
    else if (k === "--only") { if (!/^(smoke|desk|phone|rate|sweep|flush|hitch)$/.test(v || "")) throw new Error("--only wants smoke|desk|phone|rate|sweep|flush|hitch, got " + v); a.only = [v]; i++; }
    else if (k === "--rooms") { if (!/^[1-8](,[1-8])*$/.test(v || "")) throw new Error("--rooms wants a list of 1..8, got " + v); a.rooms = v.split(",").map(Number); i++; }
    else if (k === "--tile") { if (!/^[1-8]$/.test(v || "")) throw new Error("--tile wants 1..8, got " + v); a.tile = +v; i++; }
    else if (k === "--secs") { if (!/^\d+(\.\d+)?$/.test(v || "")) throw new Error("--secs wants a number, got " + v); a.secs = +v; i++; }
    else if (k === "--fps") { if (!/^[012]$/.test(v || "")) throw new Error("--fps wants 0|1|2, got " + v); a.fps = +v; i++; }
    else if (k === "--at") { if (!/^-?\d+,-?\d+$/.test(v || "")) throw new Error("--at wants X,Y, got " + v); a.at = v; i++; }
    else if (k === "--throttle") { if (!/^\d+$/.test(v || "")) throw new Error("--throttle wants a rate, got " + v); a.throttle = Math.max(1, +v); i++; }
    else if (k === "--out") { if (!v) throw new Error("--out wants a dir"); a.out = resolve(v); i++; }
    else if (k === "--keep") a.keep = true;
    else throw new Error("unknown flag " + k + " (see the header of tools/perf/frames.mjs)");
  }
  return a;
}

/* $CHROME wins as given; else the newest headed chromium-<N> holding a binary */
export function findHeaded(env = process.env, base = PW_DIR) {
  if (env.CHROME) return env.CHROME;
  let ds = [];
  try { ds = readdirSync(base); } catch { return null; }
  for (const [d] of ds.map((x) => /^chromium-(\d+)$/.exec(x)).filter(Boolean).sort((p, q) => q[1] - p[1])) {
    const f = join(base, d, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
    if (existsSync(f)) return f;
  }
  return null;
}

const live = new Set(), dirs = new Set();
process.on("exit", () => {
  for (const c of live) try { c.kill("SIGKILL"); } catch {}
  for (const d of dirs) try { rmSync(d, {recursive: true, force: true}); } catch {}
});
async function startHeaded(bin, at) {
  const dir = mkdtempSync(join(tmpdir(), "fg-perf-"));
  dirs.add(dir);
  const p = spawn(bin, ["--remote-debugging-port=0", "--user-data-dir=" + dir, "--no-first-run", "--no-default-browser-check", "--mute-audio",
    "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--window-position=" + at, "--window-size=1450,900",
    "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "--disable-background-timer-throttling",
    "about:blank"], {stdio: ["ignore", "ignore", "pipe"]});
  live.add(p);
  p.once("exit", () => live.delete(p));
  const ws = await new Promise((ok, no) => {
    const t = setTimeout(() => no(new Error("chrome start timeout")), 20000);
    let buf = "";
    p.on("error", (e) => { clearTimeout(t); no(e); });
    p.stderr.on("data", (b) => { buf += b; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) { clearTimeout(t); ok(m[1]); } });
    p.on("exit", (c) => { clearTimeout(t); no(new Error("chrome exited " + c + " " + buf.slice(-400))); });
  });
  return {proc: p, ws, dir};
}

/* installed before any page script. A pass-through: native rAF underneath, the
   callback only timed. Stage and recorder use the native rAF, so neither counts
   as work. */
const REC = `(()=>{const nr=window.requestAnimationFrame.bind(window);const R=window.__rec={work:0,nr,loaf:[]};
window.requestAnimationFrame=(f)=>nr((t)=>{const a=performance.now();try{f(t);}finally{R.work+=performance.now()-a;}});
try{new PerformanceObserver((l)=>{for(const e of l.getEntries()){const s=(e.scripts||[]).slice().sort((x,y)=>y.duration-x.duration)[0];R.loaf.push({ms:Math.round(e.duration),block:Math.round(e.blockingDuration||0),top:s?(String(s.sourceURL).split('/').slice(-2).join('/')+' '+(s.sourceFunctionName||s.invoker||'')).trim():''});}}).observe({type:'long-animation-frame'});}catch(e){R.noLoaf=true;}
R.record=(ms)=>new Promise((done)=>{const iv=[],wk=[];let prev=null,start=null;R.loaf.length=0;const tick=(t)=>{if(prev!==null){iv.push(t-prev);wk.push(R.work);}R.work=0;prev=t;if(start===null)start=t;if(t-start>=ms){done({iv,wk,loaf:R.loaf.slice(),hidden:document.visibilityState!=='visible',focus:document.hasFocus()});return;}nr(tick);};nr(tick);});})();`;

/* the proof that this is the display's clock on a real GPU */
const PROBE = `(()=>{const c=document.createElement('canvas'),g=c.getContext('webgl2'),e=g&&g.getExtension('WEBGL_debug_renderer_info');return {renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):null,visible:document.visibilityState,focus:document.hasFocus(),inner:[innerWidth,innerHeight],dpr:devicePixelRatio,lay:document.body&&document.body.getAttribute('data-lay')};})()`;

/* Page-side stage: window.__stage = {set(spec), read()}, driven by its own native
   rAF. Foes are pinned, bombs and pickups refilled, never time or RNG of the sim. */
const STAGE = `Promise.all(['/src/core/entities.js','/src/core/config.js','/src/core/sim.js','/src/render/lockon.js','/src/core/board3.js'].map((u)=>import(u))).then(([E,C,S,L])=>{
const g=window.__GAME__,G=g.G,{T,key}=C,TL=C.CFG.TILE,COLS=C.CFG.COLS,ROWS=C.CFG.ROWS;
const at=(x,y)=>G.grid[key(x,y)],cen=(v)=>(v+0.5)*TL;
let on=null,seed=1,nextBomb=0,marks=null,hub=null,lanes=[],free=[],opts={};
const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
const openRun=(x,y,d)=>{let n=0;for(let i=1;i<=3;i++){const X=x+d[0]*i,Y=y+d[1]*i;if(X<1||Y<1||X>=COLS-1||Y>=ROWS-1||at(X,Y)===T.WALL)break;n++;}return n;};
const park=(p,x,y)=>{p.x=cen(x);p.y=cen(y);p.tx=x;p.ty=y;};
const pinPlayer=()=>{const p=G.players[0];p.alive=true;p.iFrames=1e6;p.shield=false;if(hub)park(p,hub.x,hub.y);G.lives=9;if(G.state==='LOSE'||G.state==='WIN')G.state='PLAY';};
const inLane=(x,y)=>x===hub.x||y===hub.y;
function buildFree(){free=[];for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(at(x,y)===T.EMPTY&&!inLane(x,y))free.push([x,y]);}
function hunter(type,l){const e=E.spawnEnemy(type,hub.x+l.d[0]*l.n,hub.y+l.d[1]*l.n,G.level,null,{invulnT:0});e.invuln=false;e.lane=l;return e;}
function pinHunter(e){const l=e.lane,x=hub.x+l.d[0]*l.n,y=hub.y+l.d[1]*l.n;e.x=cen(x);e.y=cen(y);e.tx=x;e.ty=y;e.dir={x:-l.d[0],y:-l.d[1]};e.cd=1e3;}
const ITEMS=['fire','bomb','speed','shield','kick','heart'];
function roomItem(t){const f=free[Math.floor(rnd()*free.length)]||[hub.x+1,hub.y+1];return {x:cen(f[0]),y:cen(f[1]),tx:f[0],ty:f[1],t,col:(E.POWER.find((q)=>q.t===t)||{}).col||'#fff',taken:false,pdef:E.POWER.find((q)=>q.t===t)||null};}
function busy(spec){
  opts={...spec};
  G.seed=spec.seed>>>0;G.heat=2;G.pace=0;if('gen' in G)G.gen=spec.gen;S.loadLevel(G,spec.room,true);G.state='PLAY';
  let best=null,bs=-1;
  for(let y=2;y<ROWS-2;y++)for(let x=2;x<COLS-2;x++){if(at(x,y)===T.WALL)continue;const r=DIRS.map((d)=>openRun(x,y,d)),s=r.filter((v)=>v>=2).length*10-Math.abs(x-7)-Math.abs(y-6);if(s>bs){bs=s;best={x,y,r};}}
  hub={x:best.x,y:best.y};lanes=[];
  DIRS.forEach((d,i)=>{const n=best.r[i];if(n<2)return;for(let k=0;k<=n;k++)G.grid[key(hub.x+d[0]*k,hub.y+d[1]*k)]=T.EMPTY;lanes.push({d,n:Math.min(n,2+(i%2))});});
  G.grid[key(hub.x,hub.y)]=T.EMPTY;
  buildFree();
  G.bombs=[];G.items=[];G.enemies=[];
  const H=['fast','chaser','knight','fast'];
  if(!opts.noLock)lanes.forEach((l,i)=>G.enemies.push(hunter(H[i%4],l)));
  for(const t of ['walker','boomerang','rocket','stationary','shade','burrow']){if(G.enemies.length>=9)break;const f=free[Math.floor(rnd()*free.length)];if(f){const e=E.spawnEnemy(t,f[0],f[1],G.level,null,{invulnT:0});e.invuln=false;G.enemies.push(e);}}
  for(const t of ITEMS)G.items.push(roomItem(t));
  nextBomb=0;marks={locks:[],blast:0,frames:0,foes:0,items:0};
  on=(t)=>{
    G.enemies=G.enemies.filter((e)=>e.lane||!e.dead);
    for(let i=0;i<G.enemies.length;i++){const e=G.enemies[i];if(!e.lane)continue;if(e.dead){G.enemies[i]=hunter(e.type,e.lane);}pinHunter(G.enemies[i]);}
    while(G.enemies.length<9&&free.length){const f=free[Math.floor(rnd()*free.length)],e=E.spawnEnemy(['walker','boomerang','rocket','shade','burrow'][Math.floor(rnd()*5)],f[0],f[1],G.level,null,{invulnT:0});e.invuln=false;G.enemies.push(e);}
    G.items=G.items.filter((q)=>!q.taken);while(G.items.length<6)G.items.push(roomItem(ITEMS[Math.floor(rnd()*6)]));
    if(!opts.noBomb&&t>=nextBomb&&free.length){nextBomb=t+400;buildFree();const f=free[Math.floor(rnd()*free.length)];if(f&&!G.bombs.some((b)=>b.tx===f[0]&&b.ty===f[1]))G.bombs.push({x:cen(f[0]),y:cen(f[1]),tx:f[0],ty:f[1],timer:0.02,radius:2,variant:'normal',dead:false});}
    if(marks){marks.frames++;marks.locks.push(G.enemies.filter((e)=>L.lockOn(G,e)).length);if(G.blades.length)marks.blast++;marks.foes+=G.enemies.length;marks.items+=G.items.length;}
  };
}
function fat(){
  G.seed=77;if('gen' in G)G.gen=1;G.heat=0;G.pace=0;S.loadLevel(G,1,true);G.state='PLAY';hub=null;
  const types=['walker','chaser','fast','stationary','boomerang','rocket'];
  free=[];for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(at(x,y)===T.EMPTY&&(x>2||y>2))free.push([x,y]);
  const mk=(t)=>{const f=free[Math.floor(rnd()*free.length)],e=E.spawnEnemy(t,f[0],f[1],G.level,null,{invulnT:0});e.invuln=false;return e;};
  G.enemies=[];for(let i=0;i<16;i++)G.enemies.push(mk(types[i%6]));
  const item=(i)=>({x:60+i*15,y:120,t:'fire',col:'#ff8a3c',taken:false,pdef:null});
  G.items=[];for(let i=0;i<32;i++)G.items.push(item(i));
  const nb=Math.min(C.CFG.MAX_BOMBS,8);G.bombs=[];for(let i=0;i<nb;i++)G.bombs.push({x:60+i*40,y:160,tx:i,ty:2,timer:C.CFG.FUSE,radius:1,variant:'normal',dead:false});
  G.blades=[{x:200,y:120,tiles:[{tx:5,ty:3}],t:0,ttl:C.CFG.BLADE_TTL}];
  marks={locks:[],blast:0,frames:0,foes:0,items:0};
  on=()=>{
    G.enemies=G.enemies.map((e,i)=>e.dead?mk(types[i%6]):e);while(G.enemies.length<16)G.enemies.push(mk(types[G.enemies.length%6]));
    for(let i=0;i<32;i++)if(!G.items[i]||G.items[i].taken)G.items[i]=item(i);
    for(const b of G.bombs)b.timer=C.CFG.FUSE;
    if(G.blades[0])G.blades[0].t=0;
    if(marks){marks.frames++;marks.locks.push(G.enemies.filter((e)=>L.lockOn(G,e)).length);if(G.blades.length)marks.blast++;marks.foes+=G.enemies.length;marks.items+=G.items.length;}
  };
}
const tick=(t)=>{window.__rec.nr(tick);if(!on||G.state==='PAUSE')return;pinPlayer();on(t);};
window.__rec.nr(tick);
const bombAt=(x,y)=>G.bombs.push({x:cen(x),y:cen(y),tx:x,ty:y,timer:0.02,radius:2,variant:'normal',dead:false});
const H4=['fast','chaser','knight','fast'];
window.__stage={busy,fat,stop(){on=null;},
lock(){opts.noLock=false;const k=G.enemies.filter((e)=>e.lane).length;if(!k){G.enemies=G.enemies.slice(0,Math.max(0,9-lanes.length));lanes.forEach((l,i)=>G.enemies.push(hunter(H4[i%4],l)));}},
plant(){buildFree();const near=(f)=>G.enemies.some((e)=>!e.dead&&Math.abs(e.tx-f[0])+Math.abs(e.ty-f[1])<5);const f=free.find((q)=>!near(q))||free[0];bombAt(f[0],f[1]);return f;},
kill(){const e=G.enemies.find((q)=>!q.lane&&!q.dead&&q.type!=='stationary')||G.enemies.find((q)=>!q.lane&&!q.dead);if(e)bombAt(e.tx,e.ty);return !!e;},reset(){if(marks){marks.locks=[];marks.blast=0;marks.frames=0;marks.foes=0;marks.items=0;}},
read(){if(!marks||!marks.frames)return null;const l=marks.locks.slice().sort((a,b)=>a-b),n=marks.frames;return {lockMin:l[0],lockMax:l[l.length-1],lockMed:l[l.length>>1],blastShare:+(marks.blast/n).toFixed(2),foes:+(marks.foes/n).toFixed(1),items:+(marks.items/n).toFixed(1)};}};
return true;})`;

const READ = `(()=>{const g=window.__GAME__,a=g.app,i=a.gfx||{},r=g.renderer,d=r&&r._dbg;const three=d&&d.gl;return {state:g.state(),level:g.G.level,gen:g.G.gen,biome:null,fps:i.fps,hz:i.hz,d:i.d,kind:i.kind,dpr3d:i.dpr3d,dprPx:i.dprPx,gov:i.gov,limit:i.limit,calls:three&&three.info?three.info.render.calls:null,tris:three&&three.info?three.info.render.triangles:null,glCanvas:three&&three.domElement?[three.domElement.width,three.domElement.height]:null,feat:g.G.feat?g.G.feat.filter((v)=>v>0).length:0,lay:document.body.getAttribute('data-lay'),inner:[innerWidth,innerHeight],dpr:devicePixelRatio};})()`;
const SCENE_CALLS = `import('/src/render/three/scene.js').then((m)=>{const d=window.__GAME__.renderer._dbg;return d&&d.scene?m.countDrawCalls(d.scene):null;})`;

/* render + sync at the real backing size, with a foe nudged so the raster and the
   3D shadow map cannot be skipped. 3D: readPixels every frame. 2D / PIXEL: ten
   renders per getImageData, because repeated readbacks can demote a canvas to
   software (the x10 of tools/pixel/shot.mjs). Includes the JS of render(). */
const FLUSH = `(()=>{const g=window.__GAME__,r=g.renderer,G=g.G,d=r._dbg,three=d&&d.gl,px=document.getElementById('px'),cv=px&&!px.hidden?px:document.getElementById('c');
const nudge=(i)=>{const e=G.enemies[0];if(e)e.x+=i%2?1:-1;r.invalidate&&r.invalidate();};const out=[];
if(three){const c=three.getContext(),b=new Uint8Array(4);for(let i=0;i<40;i++){const t=performance.now();nudge(i);r.render(G,1/60,{hud:true});c.readPixels(0,0,1,1,c.RGBA,c.UNSIGNED_BYTE,b);out.push(performance.now()-t);}}
else{const x=cv.getContext('2d');for(let j=0;j<9;j++){const t=performance.now();for(let i=0;i<10;i++){nudge(i);r.render(G,1/60,{hud:true});}x.getImageData(0,0,1,1);out.push((performance.now()-t)/10);}}
out.sort((a,b)=>a-b);const q=(p)=>+out[Math.min(out.length-1,Math.ceil(p*out.length)-1)].toFixed(2);const el=three?three.domElement:cv;return {mode:three?'readPixels x1':'getImageData x10',canvas:el.id,size:el.width+'x'+el.height,med:q(.5),p95:q(.95),max:q(1)};})()`;

const PROGRAMS = `(()=>{const d=window.__GAME__.renderer._dbg,t=d&&d.gl;return t&&t.info&&t.info.programs?t.info.programs.length:null;})()`;
/* self time per function from a CDP profile, biggest first */
export function topSelf(profile, n = 8) {
  const byId = new Map(profile.nodes.map((x) => [x.id, x])), ms = new Map();
  profile.samples.forEach((id, i) => {
    const f = byId.get(id).callFrame, k = (f.functionName || "(anon)") + " " + String(f.url).split("/").slice(-1)[0];
    ms.set(k, (ms.get(k) || 0) + (profile.timeDeltas[i] || 0) / 1000);
  });
  return [...ms].filter(([k]) => !/^\((idle|root|program)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => k.trim() + " " + v.toFixed(1));
}

const settingsSeed = (o) => `try{localStorage.setItem('nb.settings.v1',JSON.stringify(${JSON.stringify(o)}));}catch(e){}`;

export async function run(a) {
  const bin = findHeaded();
  if (!bin || !existsSync(bin)) throw new Error(bin ? "no browser at CHROME=" + bin : "no headed Chromium: set CHROME or install chromium-<N> under " + PW_DIR);
  mkdirSync(a.out, {recursive: true});
  const report = {when: new Date().toISOString(), cpu: cpus()[0].model, load0: loadavg(), env: {}, windows: [], errors: []};
  let srv = null, chr = null, c = null, sid = null, seedId = null;
  const S = (m, p) => c.send(m, p, sid);
  const ev = async (expr) => { const r = await S("Runtime.evaluate", {expression: expr, awaitPromise: true, returnByValue: true}); if (r.exceptionDetails) throw new Error(expr.slice(0, 80) + ": " + JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
  const cpuNow = async () => { const r = await c.send("SystemInfo.getProcessInfo"); const o = {}; for (const p of r.processInfo) o[p.type] = (o[p.type] || 0) + p.cpuTime; return o; };
  const key = async (code, k) => { for (const type of ["keyDown", "keyUp"]) await S("Input.dispatchKeyEvent", {type, code, key: k || code, windowsVirtualKeyCode: code === "Enter" ? 13 : 0}); };
  let period = 0, lastLoaf = [];
  const record = async (label, look, cfg, ms) => {
    await S("Page.bringToFront");
    const m0 = (await S("Performance.getMetrics")).metrics, c0 = await cpuNow(), t0 = performance.now();
    await ev("window.__stage&&window.__stage.reset()");
    const r = await ev(`window.__rec.record(${ms})`);
    const wall = (performance.now() - t0) / 1000, c1 = await cpuNow(), m1 = (await S("Performance.getMetrics")).metrics;
    const met = (l, n) => (l.find((x) => x.name === n) || {}).value || 0;
    const cpu = {};
    for (const k of Object.keys(c1)) cpu[k] = Math.round(((c1[k] - (c0[k] || 0)) * 1000) / wall);
    const w = {label, look, ...cfg, ...summarize(r.iv, r.wk, period), hidden: r.hidden, focus: r.focus, loaf: r.loaf.slice(0, 6), loafN: r.loaf.length,
      cpuMsPerS: cpu, taskMsPerS: Math.round(((met(m1, "TaskDuration") - met(m0, "TaskDuration")) * 1000) / wall), scriptMsPerS: Math.round(((met(m1, "ScriptDuration") - met(m0, "ScriptDuration")) * 1000) / wall),
      read: await ev(READ), stage: await ev("window.__stage?window.__stage.read():null")};
    if (look === "3d" && w.read.state !== "INTRO") w.read.sceneCalls = await ev(SCENE_CALLS).catch(() => null);
    report.windows.push(w);
    const x = w.interval, y = w.work, s = w.stage ? " locks " + w.stage.lockMin + ".." + w.stage.lockMax + " blast " + w.stage.blastShare : "";
    console.error(`${look} ${label}: iv ${x.med}/${x.p95}/${x.p99}/${x.max} drop ${w.dropped}/${x.n} work ${y.med}/${y.p95}/${y.max} fps ${w.read.fps} hz ${w.read.hz}${s}${w.hidden ? " HIDDEN" : ""}`);
    if (r.hidden) report.errors.push(label + ": page hidden during the window");
    return w;
  };
  /* a fresh page on this look with these settings, walked to MENU the real way */
  const open = async (look, cfg) => {
    if (seedId) await S("Page.removeScriptToEvaluateOnNewDocument", {identifier: seedId});
    seedId = (await S("Page.addScriptToEvaluateOnNewDocument", {source: settingsSeed({fps: cfg.fps == null ? 1 : cfg.fps, res: 1, shd: 2, aa: 1, fxq: 1, dmo: 1, ...(look === "3d" ? {r3d: 1} : look === "px" ? {px: 1} : {})})})).identifier;
    if (cfg.phone) { await S("Emulation.setDeviceMetricsOverride", {width: 393, height: 852, deviceScaleFactor: 3, mobile: true}); await S("Emulation.setTouchEmulationEnabled", {enabled: true, maxTouchPoints: 5}); }
    else { await S("Emulation.clearDeviceMetricsOverride"); await S("Emulation.setTouchEmulationEnabled", {enabled: false}); }
    await S("Page.navigate", {url: "http://127.0.0.1:" + srv.port + "/index.html?render=" + look + "&debug=1"});
    for (let i = 0; i < 100; i++) { await sleep(100); if (await ev("!!(window.__GAME__&&document.readyState==='complete'&&window.__GAME__.app.boardReady!==false)").catch(() => false)) break; }
    await S("Page.bringToFront");
    await sleep(400); await key("Enter"); await sleep(700); await key("Enter");
    for (let i = 0; i < 80; i++) { await sleep(100); if ((await ev("window.__GAME__.state()")) === "MENU") break; }
    await ev(STAGE);
  };
  const toRun = async () => { await ev("window.__GAME__.begin()"); await sleep(300); };
  /* stage, and the warmup: its longest interval is the room-load hitch */
  const staged = async (expr, look, cfg, warmMs = 1500) => {
    const w = ev(`window.__rec.record(${warmMs})`);
    await sleep(30);
    await ev(expr);
    const r = await w;
    lastLoaf = r.loaf;
    return r.iv.length ? Math.round(Math.max(...r.iv)) : 0;
  };
  const busy = (room, gen) => `window.__stage.busy({room:${room},gen:${gen},seed:${4242 + room}})`;
  const scene = async (look, cfg, secs, rooms, tile) => {
    const ms = secs * 1000;
    await record("MENU", look, cfg, ms);
    report.windows.push({label: "first room after MENU", look, ...cfg, firstRoomHitch: await staged("window.__GAME__.begin()", look, cfg, 1000)});
    await sleep(300);
    for (const r of rooms) {
      const hitch = await staged(busy(r, 2), look, cfg);
      const w = await record("busy gen-2 room " + r, look, cfg, ms); w.loadHitch = hitch;
    }
    if (tile) {
      const hitch = await staged(busy(tile, 3), look, cfg);
      const w = await record("tile gen-3 room " + tile, look, cfg, ms); w.loadHitch = hitch;
    }
    const hf = await staged("window.__stage.fat()", look, cfg);
    const f = await record("fat world", look, cfg, ms); f.loadHitch = hf;
    await ev("window.__pause()"); await sleep(600);
    await record("PAUSE", look, cfg, ms);
    await ev("window.__resume()");
  };
  try {
    srv = await startServer();
    console.error("perf: serve.js pid " + srv.proc.pid + " port " + srv.port);
    chr = await startHeaded(bin, a.at);
    console.error("perf: chrome pid " + chr.proc.pid + " profile " + chr.dir);
    c = await cdp(chr.ws);
    const {targetId} = await c.send("Target.createTarget", {url: "about:blank"});
    ({sessionId: sid} = await c.send("Target.attachToTarget", {targetId, flatten: true}));
    await S("Page.enable"); await S("Runtime.enable"); await S("Performance.enable");
    c.on((d) => { if (d.sessionId === sid && d.method === "Runtime.exceptionThrown") report.errors.push("exception: " + (d.params.exceptionDetails.exception && d.params.exceptionDetails.exception.description || d.params.exceptionDetails.text)); });
    await S("Page.addScriptToEvaluateOnNewDocument", {source: REC});
    await S("Page.bringToFront");
    await ev(REC);
    await sleep(800);
    const ver = await c.send("Browser.getVersion"), gi = await c.send("SystemInfo.getInfo");
    const blank = await ev("window.__rec.record(2000)");
    const probe = await ev(PROBE);
    period = periodOf(blank.iv);
    report.env = {product: ver.product, machine: gi.modelName, gpu: (gi.gpu.devices[0] || {}).deviceString, webgl: probe.renderer, feature: {canvas2d: gi.gpu.featureStatus["2d_canvas"], webgl: gi.gpu.featureStatus.webgl, raster: gi.gpu.featureStatus.rasterization}, visible: probe.visible, focus: probe.focus, inner: probe.inner, dpr: probe.dpr, periodMs: round(period), hz: round(1000 / period)};
    console.error("perf: env " + JSON.stringify(report.env));
    const bad = [];
    if (probe.visible !== "visible") bad.push("page not visible");
    if (!/metal/i.test(probe.renderer || "") || /swiftshader/i.test(probe.renderer || "")) bad.push("WebGL is not Metal: " + probe.renderer);
    if (!/enabled/.test(report.env.feature.canvas2d || "")) bad.push("2D canvas not accelerated: " + report.env.feature.canvas2d);
    if (!(period > 4 && period < 34)) bad.push("rAF period " + round(period) + " ms is not a display clock");
    if (bad.length) { report.errors.push(...bad); throw new Error("no real-GPU foreground clock: " + bad.join("; ")); }
    const blk = a.only[0];
    for (const look of a.looks) {
      if (blk === "smoke") {
        await open(look, {});
        await toRun();
        await staged(busy(a.rooms[0], 2), look, {});
        await record("smoke busy gen-2 room " + a.rooms[0], look, {}, 2000);
        writeFileSync(join(a.out, "smoke-" + look + ".png"), Buffer.from((await S("Page.captureScreenshot", {format: "png"})).data, "base64"));
      }
      if (a.only.includes("desk")) { await open(look, {fps: a.fps}); await scene(look, {view: "desk"}, a.secs, a.rooms, a.tile); }
      if (blk === "sweep") {
        await open(look, {}); await toRun();
        for (const gen of [2, 3]) for (let r = 1; r <= 8; r++) { const h = await staged(busy(r, gen), look, {}, 800); const w = await record("sweep gen-" + gen + " room " + r, look, {view: "sweep"}, (a.secs === 6 ? 3 : a.secs) * 1000); w.loadHitch = h; }
      }
      if (a.only.includes("phone")) { await open(look, {phone: true, fps: a.fps}); await S("Emulation.setCPUThrottlingRate", {rate: a.throttle}); await scene(look, {view: "phone", throttle: a.throttle}, Math.min(a.secs, 5), a.rooms, a.tile); await S("Emulation.setCPUThrottlingRate", {rate: 1}); }
      if (a.only.includes("rate")) for (const [fps, n] of [[0, "30"], [1, "60"], [2, "MAX"]]) {
        await open(look, {fps}); await toRun();
        await staged(busy(a.rooms[0], 2), look, {});
        await record("FRAME RATE " + n + " busy room " + a.rooms[0], look, {view: "rate", fps: n}, Math.min(a.secs, 5) * 1000);
      }
      if (blk === "hitch") for (const prof of [false, true]) {
        await open(look, {}); await toRun();
        if (prof) { await S("Profiler.enable"); await S("Profiler.setSamplingInterval", {interval: 100}); }
        const room = a.rooms[0], ST = "window.__stage.";
        const steps = [["room, no bomb, no lock", ST + `busy({room:${room},gen:2,seed:${4242 + room},noBomb:true,noLock:true})`], ["first lock-on", ST + "lock()"], ["first blast", ST + "plant()"], ["second blast", ST + "plant()"], ["first kill", ST + "kill()"], ["second kill", ST + "kill()"], ["third blast", ST + "plant()"], ["room again, no bomb, no lock", ST + `busy({room:${room},gen:2,seed:${4243 + room},noBomb:true,noLock:true})`], ["other biome, no bomb, no lock", ST + `busy({room:${room === 1 ? 2 : 1},gen:2,seed:${4244 + room},noBomb:true,noLock:true})`]];
        for (const [label, expr] of steps) {
          await sleep(700);
          const p0 = await ev(PROGRAMS);
          if (prof) await S("Profiler.start");
          const hitch = await staged(expr, look, {}, 1200);
          const top = prof ? topSelf((await S("Profiler.stop")).profile) : null;
          const p1 = await ev(PROGRAMS);
          report.windows.push({label, look, view: prof ? "hitch-profiled" : "hitch", hitch, programs: [p0, p1], loaf: lastLoaf.slice(0, 3), top});
          console.error(`${look} ${prof ? "prof " : ""}${label}: longest ${hitch} ms, programs ${p0} -> ${p1}, loaf ${JSON.stringify(lastLoaf.slice(0, 2))}${top ? "\n   " + top.join(" | ") : ""}`);
        }
        if (prof) await S("Profiler.disable");
      }
      if (blk === "flush") for (const phone of [false, true]) {
        const view = phone ? "phone" : "desk", cfg = {view: "flush-" + view};
        await open(look, {phone}); await toRun();
        const sample = async (label, expr) => {
          await staged(expr, look, cfg, 900);
          const f = await ev(FLUSH);
          report.windows.push({label, look, ...cfg, flush: f, read: await ev(READ)});
          console.error(`${look} ${view} flush ${label}: med ${f.med} p95 ${f.p95} max ${f.max} ms/frame (${f.mode}, ${f.canvas} ${f.size})`);
        };
        await sample("gen-2 room 8", busy(8, 2));
        for (let r = 1; r <= 8; r++) await sample("gen-3 room " + r, busy(r, 3));
        await sample("fat world", "window.__stage.fat()");
      }
    }
    report.load1 = loadavg();
  } finally {
    await stopChrome(chr, c, a.keep);
    if (chr) dirs.delete(chr.dir);
    if (srv) await stop(srv.proc);
  }
  const f = join(a.out, "frames-" + a.only[0] + "-" + a.looks.join("") + "-" + Math.round(report.env.hz) + "hz-fps" + a.fps + (a.throttle > 1 ? "-x" + a.throttle : "") + ".json");
  writeFileSync(f, JSON.stringify(report, null, 1));
  console.error("perf: wrote " + f);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const s of ["SIGINT", "SIGTERM", "SIGHUP"]) process.once(s, () => process.exit(130));
  try {
    const r = await run(parseArgs(process.argv.slice(2)));
    if (r.errors.length) { console.error("perf: errors " + JSON.stringify(r.errors)); process.exitCode = 1; }
  } catch (e) {
    console.error("perf: " + (e && e.message || e));
    process.exitCode = 1;
  }
}
