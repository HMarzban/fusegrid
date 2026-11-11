#!/usr/bin/env node
/* Deterministic captures of the LIVE game's screens for the UI upgrade page tasks (dev only, zero deps, never imported by src/, not in the precache).
   Every page task proves its layout on these: tools/ui/gates.mjs measures them, tools/ui/compare.mjs puts each beside its approved mock frame.

   node tools/ui/shots.mjs [flags]
     --screens a,b    screens to capture (default all): title, menu, level, options (alias settings), graphics, controls, controlsnone, controlspad, controlscapture, guide, howto, items,
                      enemies, floor, scores, stats, statsreset (STATS armed), medals, scoresfull / statsfull (a seeded cabinet,
                      __GAME__.seedRecords()), statspage2 (STATS' second page on a paged phone), scoresidle (RECORDS through the real lazy.idle() load: no want()), pause, pausetags (PAUSE with the run's rules seeded: the tag row), win, win2 (a paged run end's second
                      page), lose, loseshort (a saved best: the shortfall), losedaily (today's DAILY), lose2,
                      play, hud; optionskeys / graphicskeys / guidekeys (SETTINGS, GRAPHICS, GUIDE reached by real key presses, so a phone capture
                      shows the keyboard focus); captured in that canonical order
                      whatever the order given (win at --world 5 or 8 is the finale)
     --look 2d,px,3d  art styles (default 2d); one page load per look and world
     --world 1,2,8    worlds, levels 1..8 (default 1): app.level before the title (6..8 also open rooms 6-8, app.pactUnlocked, as after a first CLEAR);
                      a run screen plays that level
     --seed N         world.seed (uint32) before each run screen's room load, as tools/pixel/shot.mjs --seed; menus are not seeded by it
     --t125           window.__GAME__.ui.textScale(1.25) before the first frame, in every look (R14: the kit's text scale, never a player setting)
     --phone          393x852 at dpr 3, mobile + touch emulation (the title press is a tap and the rest goes through __GAME__.app, so the hints stay
                      on touch); --size still wins
     --size WxH       viewport in CSS px (default 1366x768); not in the file names, so give each size its own --out
     --dpr N          device pixel ratio (default 2, phone 3: the mock frames' metrics, and the 2x capture the squint gates assume)
     --out DIR        output dir (default tools/ui/out, git-ignored)
     --notext         also capture every screen with all canvas text hidden (<name>.notext.png, 2 frames after its capture, for gates.mjs's text and
                      info gates); taken by itself whenever the page's probe records a text colour
     --gpu            ANGLE on Metal instead of SwiftShader (byte-identical PNGs are claimed for SwiftShader CLASSIC only)
   Per capture: <screen>.<look>.w<n>[.t125][.phone].png and a .json dump beside it: the flags, what the page reads back (state, screen, level,
   seed, gen, look, data-lay, text scale, dpr, and swRegistrations: the page's REAL service worker registrations, read through the getter INIT
   hides, any is an error), the CSS content boxes of #c / #sh / #px / #gl / #hud (border and padding taken off: #c has a 1 px border; the raw rect is
   `outer`), and window.__GAME__.ui.snap() (src/render/kit/probe.js: the page's own rects, text boxes and squint pairs, empty until a page records
   them; shots.mjs is what switches the probe on, __GAME__.ui.on(true), cleared before every capture). Before the first capture every intended
   capture's .png, .json and .notext.png are deleted, so an earlier run's files can never stand in for one this run failed to take.
   And <out>/shots.json, the manifest, written BEFORE the first capture and again at the end: `runs`, every run into this dir, the latest last, each
   with its flags, `intended` (every capture name it means to take), `captures` (the ones it took cleanly), `failed` (name -> why: a screen not
   reached, or a page exception, console error or warning or log error while the capture was being reached, settled or taken: every entry
   shot.mjs's openPage collects from Runtime.exceptionThrown, the console and the log), `errors`, `warnings`, `pageErrors` and `done` (true only when the run completed). gates.mjs judges
   the latest run alone. One gated run per --out dir.
   How each screen is reached (tools/ui/lib/screens.mjs): boot index.html?render=<look>&debug=1, step 1.2 s, the title press (desktop a real Enter
   key, phone a real tap: the gesture that unlocks audio and starts the 4.4 s show), 5.2 s of show, MENU. Menu pages: back to MENU with
   __GAME__.reset(), the row picked by LABEL (app.cursor / optRow / guideRow), then confirm (desktop a real Enter, phone app.confirm()), then
   the recipe's key or keys, in order (RECORDS opens on SCORES; E steps one tab: STATS, then MEDALS). Run screens, each on a run of its own started from MENU PLAY on cleared storage: play after 0.9 s, pause through window.__pause,
   lose by a bomb on the last life, win by clearing the foes (the room's own 1.6 s all-clear). Before each capture the probe is cleared and the
   screen's settle time is stepped; a screen whose __GAME__.state() is not the one expected is an error and gets no PNG; a page exception (the
   rAF shim rethrows a callback's throw from a timer, so the frames still step) is an error for the capture it falls in, and outside any capture
   (boot, the title, the show) an error for the run.

   Everything tools/pixel/shot.mjs guarantees (its startServer / startChrome / openPage / stopChrome are reused): its own PORT=0 node serve.js, the
   newest installed chrome-headless-shell ($CHROME overrides) with a fresh --user-data-dir, the page's rAF held and stepped in exact 1000/60 ms
   frames, Math.random seeded, every child stopped by PID, also on a crash or Ctrl-C, and the profile deleted after Chrome exits. On top, every
   document starts with an empty localStorage (the analytics card pre-answered NO so it never covers a capture; ?debug=1 sends nothing either way)
   and no navigator.serviceWorker, so no worker registers. Same flags, same CLASSIC PNGs, byte for byte. Exit 1 on any run error: a screen not
   reached, a page exception or console error or warning, a service worker registration. */
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findChrome, PW_DIR, startServer, startChrome, stopChrome, stop, cdp, openPage, loadExpr } from "../pixel/shot.mjs";
import { SCREENS, ORDER, LOOKS, canon, capName } from "./lib/screens.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ONE = (k, v, ok, what) => { if (v == null || !ok.test(v)) throw new Error(k + " wants " + what + ", got " + (v == null ? "nothing" : JSON.stringify(v))); return +v; };
const list = (k, v, ok, what) => { if (!v) throw new Error(k + " wants " + what); const a = v.split(","); for (const x of a) if (!ok(x)) throw new Error(k + " wants " + what + ", got " + JSON.stringify(x)); return [...new Set(a)]; };

export function parseArgs(argv) {
  const a = { screens: ORDER.slice(), looks: ["2d"], worlds: [1], seed: null, t125: false, phone: false, w: 1366, h: 768, dpr: null, out: join(ROOT, "tools/ui/out"), notext: false, gpu: false };
  let sized = false;
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === "--screens") { const s = list(k, v, (x) => canon(x), "screen names (" + ORDER.join(" ") + ")").map(canon); a.screens = ORDER.filter((n) => s.includes(n)); i++; }
    else if (k === "--look") { a.looks = list(k, v, (x) => LOOKS.includes(x), "a list of 2d|px|3d"); i++; }
    else if (k === "--world") { if (!/^[1-8](,[1-8])*$/.test(v || "")) throw new Error("--world wants a list of 1..8, got " + v); a.worlds = [...new Set(v.split(",").map(Number))]; i++; }
    else if (k === "--seed") { a.seed = ONE(k, v, /^\d{1,10}$/, "a uint32"); if (a.seed > 4294967295) throw new Error("--seed wants a uint32, got " + v); i++; }
    else if (k === "--t125") a.t125 = true;
    else if (k === "--phone") a.phone = true;
    else if (k === "--size") { if (!/^\d+x\d+$/.test(v || "")) throw new Error("--size wants WxH, got " + v); [a.w, a.h] = v.split("x").map(Number); sized = true; i++; }
    else if (k === "--dpr") { a.dpr = ONE(k, v, /^\d+(\.\d+)?$/, "a number"); if (!(a.dpr > 0)) throw new Error("--dpr wants a number > 0, got " + v); i++; }
    else if (k === "--out") { if (!v) throw new Error("--out wants a dir"); a.out = resolve(v); i++; }
    else if (k === "--notext") a.notext = true;
    else if (k === "--gpu") a.gpu = true;
    else throw new Error("unknown flag " + k + " (see the header of tools/ui/shots.mjs)");
  }
  if (a.phone && !sized) [a.w, a.h] = [393, 852];
  if (a.dpr == null) a.dpr = a.phone ? 3 : 2;
  return a;
}

/* every document: an empty store with the analytics card answered NO, no service worker, and canvas text that __uiNoText hides */
export const INIT = `(()=>{const sw=Object.getOwnPropertyDescriptor(Navigator.prototype,'serviceWorker');window.__uiSW=sw&&sw.get?()=>sw.get.call(navigator):null;
try{Object.defineProperty(Navigator.prototype,'serviceWorker',{get(){return undefined;},configurable:true});}catch(e){try{Object.defineProperty(navigator,'serviceWorker',{value:undefined});}catch(e2){}}
try{localStorage.clear();sessionStorage.clear();localStorage.setItem('nb.analytics.v1','0');}catch(e){}
for(const C of [window.CanvasRenderingContext2D,window.OffscreenCanvasRenderingContext2D])if(C)for(const m of ['fillText','strokeText']){const f=C.prototype[m];C.prototype[m]=function(){if(window.__uiNoText)return;return f.apply(this,arguments);};}})();`;
const READ = `(async()=>{const g=window.__GAME__,G=g.G,a=g.app,r=g.renderer,d=r&&r._dbg,gl=document.getElementById('gl'),real=window.__uiSW&&window.__uiSW();
 const rc=(id)=>{const e=document.getElementById(id);if(!e)return null;const b=e.getBoundingClientRect(),cs=getComputedStyle(e),f=(k)=>parseFloat(cs[k])||0,l=f('borderLeftWidth')+f('paddingLeft'),t=f('borderTopWidth')+f('paddingTop'),r=f('borderRightWidth')+f('paddingRight'),u=f('borderBottomWidth')+f('paddingBottom');
  return {x:b.left+l,y:b.top+t,w:Math.max(0,b.width-l-r),h:Math.max(0,b.height-t-u),outer:[b.left,b.top,b.width,b.height],hidden:!!e.hidden||cs.display==='none'||cs.visibility==='hidden',bw:e.width,bh:e.height};};
 return {read:{state:g.state(),screen:a.screen,level:a.level,pactUnlocked:a.pactUnlocked,worldLevel:G.level,seed:G.seed,gen:G.gen,look:d&&d.atlas?'px':(gl&&!gl.hidden?'3d':'2d'),
  lay:document.body.getAttribute('data-lay'),textScale:g.ui?g.ui.textScale():null,dpr:devicePixelRatio,inner:[innerWidth,innerHeight],lastDev:a.lastDev,swRegistrations:real?(await real.getRegistrations()).length:null},
  canvases:{c:rc('c'),sh:rc('sh'),px:rc('px'),gl:rc('gl'),hud:rc('hud')}};})()`;
const UIRESET = "(()=>{const u=window.__GAME__.ui;if(u){u.on(false);u.on(true);}return !!u;})()";
const NOTEXT = (on) => `(window.__uiNoText=${on},import('/src/render/kit/cache.js').then((m)=>{m.invalidate('notext');return true;}))`;
/* the hud screen: every power held (THROW and REMOTE among them), the player made safe and set on the room's first floor tile, so coach v2's
   tile tip opens once the ghost coach's 3 s are up (shots.mjs steps the screen's settle, 3.6 s) */
const HUD_RUN = `(()=>{const G=window.__GAME__.G,p=G.players[0];Object.assign(p,{shield:true,kick:true,throw:true,remote:true,bombKind:'line',iFrames:99});const f=G.feat||{};let k=null;for(const q in f)if(f[q]){k=+q;break;}if(k!=null){p.tx=k%15;p.ty=Math.floor(k/15);p.x=(p.tx+0.5)*40;p.y=(p.ty+0.5)*40;}return k;})()`;
const LOSE = `(()=>{const G=window.__GAME__.G,p=G.players[0];G.lives=1;p.iFrames=0;p.shield=false;G.bombs.push({x:p.x,y:p.y,tx:Math.floor(p.x/40),ty:Math.floor(p.y/40),timer:0.05,radius:1,variant:'normal',dead:false});return true;})()`;
const TWIN_MS = 1000 / 30;
/* a standard-mapping controller in slot 0 (headless Chrome has none), no button down, for the CONTROLS frames that need one; false takes it away */
const PAD = (on) => `(()=>{const b=()=>({pressed:false,touched:false,value:0}),p={id:'shots controller',index:0,connected:true,mapping:'standard',timestamp:0,axes:[0,0,0,0],buttons:Array.from({length:17},b),vibrationActuator:null};
 Object.defineProperty(navigator,'getGamepads',{value:${on} ? (()=>[p,null,null,null]) : (()=>[null,null,null,null]),configurable:true,writable:true});return true;})()`;
/* the run's ledger: a capture that fails is named in failed and errors; a page error is charged to the capture whose window it falls in (from the
   start of reaching that screen to the end of its capture) or, outside every window, to the run */
export function ledger(rep, gid, errs) {
  let used = 0;
  const fail = (base, why) => { rep.failed[base] = rep.failed[base] ? rep.failed[base] + "; " + why : why; rep.errors.push(base + ": " + why); };
  return {
    fail,
    flush(where) { for (const e of errs.slice(used)) rep.errors.push(gid + ": page error " + where + ": " + e); used = errs.length; },
    close(base) {
      const e = errs.slice(used);
      used = errs.length;
      if (e.length) fail(base, "page error while the capture was reached, settled or taken: " + e[0] + (e.length > 1 ? " (+" + (e.length - 1) + " more)" : ""));
      else if (!rep.failed[base]) rep.captures.push(base);
    },
  };
}
const RUN0 = "(async()=>{try{localStorage.clear();localStorage.setItem('nb.analytics.v1','0');}catch(e){}await import('/src/core/board3.js');window.__GAME__.reset();return true;})()";

async function group(c, port, a, look, world, rep) {
  const ctx = { look, world, t125: a.t125, phone: a.phone }, gid = capName({ screen: "-", ...ctx }).slice(2), warn = (s) => rep.warnings.push(gid + ": " + s);
  const url = "http://127.0.0.1:" + port + "/index.html?render=" + look + "&debug=1";
  const P = await openPage(c, { w: a.w, h: a.h, dpr: a.dpr, mobile: a.phone, vt: true, init: INIT }, url), L = ledger(rep, gid, P.errors);
  const ev = P.ev, poll = async (expr, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(expr).catch(() => false)) return true; await sleep(50); } return false; };
  const key = (code, k) => P.key(code, k);
  const confirm = () => (a.phone ? ev("(window.__GAME__.app.confirm(),true)") : key("Enter"));
  /* rows: the list the field indexes, an expression over the menu module m and the app a: m.ITEMS, m.GUIDE_ROWS, and a.optRows() for optRow (the
     rows on screen, v202 Task 2.4: an OPT_ROWS index is wrong outside REAL 3D) */
  const pick = (field, rows, labels) => ev(`import('/src/app/menuapp.js').then((m)=>{const a=window.__GAME__.app,L=${JSON.stringify(labels)},i=(${rows}).findIndex((x)=>L.includes(x));if(i<0)return false;a.${field}=i;return true;})`);
  const press = async () => {
    if (!a.phone) return key("Enter");
    const r = await ev("(()=>{const b=document.getElementById('c').getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2];})()");
    for (const type of ["touchStart", "touchEnd"]) await P.S("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: r[0], y: r[1] }] });
  };
  const shoot = async (screen, settle) => {
    await ev(UIRESET);
    await P.adv(settle);
    const base = capName({ screen, ...ctx }), R = await ev(READ), want = SCREENS[screen].state;
    if (R.read.state !== want) { L.fail(base, "expected " + want + ", got " + R.read.state + " (no capture)"); return L.close(base); }
    await P.shot(join(a.out, base + ".png"));
    const ui = await ev("window.__GAME__.ui?window.__GAME__.ui.snap():null");
    let notext = null;
    if (a.notext || (ui && ui.texts.some((t) => t.col != null))) { // 2 frames: an idle screen renders every 2nd rAF at 60 Hz (idle cap 30, never lower)
      await ev(NOTEXT(true)); await P.adv(TWIN_MS);
      await P.shot(join(a.out, (notext = base + ".notext.png")));
      await ev(NOTEXT(false)); await P.adv(TWIN_MS);
    }
    if (!ui) warn("window.__GAME__.ui is missing: no probe dump");
    if (R.read.swRegistrations) L.fail(base, R.read.swRegistrations + " service worker registration(s) on the page");
    else if (R.read.swRegistrations == null) warn("the real service worker state could not be read");
    writeFileSync(join(a.out, base + ".json"), JSON.stringify({ screen, file: base + ".png", notext, flags: { ...ctx, seed: a.seed, size: [a.w, a.h], dpr: a.dpr }, read: R.read, canvases: R.canvases, ui }, null, 1));
    await sleep(60); // a throw the rAF shim rethrows from a timer reaches us as Runtime.exceptionThrown a moment later
    L.close(base);
  };
  try {
    if (a.t125) await ev("window.__GAME__.ui&&window.__GAME__.ui.textScale(1.25)"); // the rAF is still held: no frame has run in any look
    await ev(`(()=>{const a=window.__GAME__.app;if(${world}>5)a.pactUnlocked=true;a.level=${world};return true;})()`);
    if (look !== "2d") { // px and three load async: give them real time (frames still stepped) until the look is live, as shot.mjs
      let live = false;
      for (let i = 0; i < 150 && !live; i++) { const s = await ev(READ); live = s.read.look === look && (await ev("window.__GAME__.app.boardReady")) !== false; if (!live) { await P.adv(50); await sleep(100); } }
      if (!live) warn("look " + look + " never went live");
    }
    const want = a.screens;
    L.flush("at boot");
    if (want.includes("title")) await shoot("title", SCREENS.title.settle); else await P.adv(SCREENS.title.settle);
    if (!want.some((s) => s !== "title")) return;
    const showing = "(()=>{const a=window.__GAME__.app;return a.screen!==1||a.introStage===1||!!a._showPending;})()";
    await press();
    if (!(await poll(showing, 2000))) { await press(); if (!(await poll(showing, 1500))) { warn("the title press never started the show (audio locked?): app.beginShow()"); await ev("window.__GAME__.app.beginShow()"); } }
    await P.adv(5200);
    if ((await ev("window.__GAME__.state()")) !== "MENU") { warn("the show did not land on MENU: app.skip()"); await ev("window.__GAME__.app.skip()"); await P.adv(100); }
    for (const s of want) {
      const R = SCREENS[s];
      if (s === "title") continue;
      await sleep(60);
      L.flush("outside a capture (the title press, the show, or between captures)");
      if (s === "menu") { await shoot(s, R.settle); continue; }
      const base = capName({ screen: s, ...ctx });
      if (R.run) {
        await ev(RUN0);
        for (const [k, v] of Object.entries(R.store || {})) await ev(`(localStorage.setItem(${JSON.stringify(k)},${JSON.stringify(v)}),true)`);
        const row = R.daily ? "DAILY" : "PLAY";
        if (R.from1) await ev("(window.__GAME__.app.level=1,true)"); // the run starts at level 1 whatever --world (the room the run ends on)
        if (!(await pick("cursor", "m.ITEMS", [row]))) { L.fail(base, "no " + row + " row on MENU"); L.close(base); continue; }
        await confirm();
        if (!(await poll("window.__GAME__.app.screen===6&&window.__GAME__.G.state==='PLAY'", 5000))) { L.fail(base, "the run did not start"); L.close(base); continue; }
        if (R.from1) { // a from-start run: clear every room below --world through the debug hook, NEXT LEVEL (Enter at the run end) between them
          let ok = true;
          for (let lv = await ev("window.__GAME__.G.level"); ok && lv < world; lv = await ev("window.__GAME__.G.level")) {
            await P.adv(300); await ev("window.__GAME__.clearAllEnemies()");
            for (let i = 0; i < 80 && (await ev("window.__GAME__.G.state")) !== "WIN"; i++) await P.adv(50);
            await P.adv(400); await ev("(window.__GAME__.input.onUiKey('Enter'),true)");
            for (let i = 0; i < 80 && !(await ev(`window.__GAME__.G.state==='PLAY'&&window.__GAME__.G.level===${lv + 1}`)); i++) await P.adv(50);
            if ((await ev("window.__GAME__.G.level")) !== lv + 1) { L.fail(base, "level " + lv + " never went on to " + (lv + 1)); ok = false; }
          }
          if (!ok) { L.close(base); continue; }
        }
        if (a.seed != null) for (const w of await ev(loadExpr({ seed: a.seed, heat: null, pace: null, gen: null }, world))) warn(w);
        if (R.run === "pause") {
          await P.adv(600);
          if (R.tags) await ev("(Object.assign(window.__GAME__.G,{heat:2,pace:1,pact:15}),window.__GAME__.app.timeAttack=true,true)"); // the tag row: every rule on, for the capture only
          await ev("window.__pause&&window.__pause()");
        }
        if (s === "hud" && (await ev(HUD_RUN)) == null) warn("the room has no floor tile: no tile tip");
        if (R.run === "lose" || R.run === "win") {
          await P.adv(300);
          await ev(R.run === "lose" ? LOSE : "window.__GAME__.clearAllEnemies()");
          const end = R.run === "lose" ? "LOSE" : "WIN";
          for (let i = 0; i < 80 && (await ev("window.__GAME__.G.state")) !== end; i++) await P.adv(50);
          for (const k of [].concat(R.key || [])) { await P.adv(100); await ev(`(window.__GAME__.input.onUiKey(${JSON.stringify(k)}),true)`); } // a run end's keys (a paged end's ▼)
        }
        await shoot(s, R.settle);
        continue;
      }
      await ev("(window.__GAME__.reset(),true)");
      if (R.seed === "records" && !(await ev("!!(window.__GAME__.seedRecords&&window.__GAME__.seedRecords())"))) warn("no __GAME__.seedRecords: " + s + " shows a fresh profile");
      let ok = true;
      for (const [field, rows, labels] of [["cursor", "m.ITEMS", R.menu], ["optRow", "a.optRows()", R.opt], ["guideRow", "m.GUIDE_ROWS", R.guide]]) {
        if (!labels || !ok) continue;
        if (!(await pick(field, rows, labels))) { L.fail(base, "no " + labels.join(" / ") + " row"); ok = false; continue; }
        await confirm(); await P.adv(50);
      }
      if (!ok) { L.close(base); continue; }
      for (const k of [].concat(R.key || [])) { if (a.phone && !R.real) await ev(`(window.__GAME__.app.key(${JSON.stringify(k)}),true)`); else await key(k, k.replace(/^Key/, "").toLowerCase()); await P.adv(50); } // a key or a list, pressed in order
      if (R.wait === "controls" && !(await poll("!!window.__GAME__.app.controls&&!window.__GAME__.app.controls.loading", 10000))) warn("the CONTROLS page never loaded");
      if (R.wait === "records" && !(await poll("import('/src/render/pages/lazy.js').then((m)=>(m.want('records').catch(()=>{}),!!m.get('records')))", 10000))) warn("the RECORDS page never loaded");
      if (R.wait === "records-idle" && !(await poll("import('/src/render/pages/lazy.js').then((m)=>!!m.get('records'))", 10000))) { L.fail(base, "the RECORDS page never loaded through lazy.idle()"); L.close(base); continue; } // never want(): the page's own idle load
      if (R.pad) { await ev(PAD(true)); await P.adv(100); }
      for (const st of [].concat(R.ctl || [])) { await ev(`(window.__GAME__.app.controls.${st},true)`); await P.adv(50); } // the page's own reducer calls, by name
      await shoot(s, R.settle || 600);
      if (R.pad) { await ev(PAD(false)); await P.adv(100); }
    }
  } finally {
    L.flush("after the last capture");
    rep.pageErrors.push(...P.errors.map((e) => gid + ": " + e));
    await P.S("Page.close").catch(() => {});
  }
}

/* every capture name these flags mean to take */
export const intended = (a) => a.looks.flatMap((look) => a.worlds.flatMap((world) => a.screens.map((screen) => capName({ screen, look, world, t125: a.t125, phone: a.phone }))));
/* the manifest after this run: the dir's earlier runs, then this one (gates.mjs judges the latest alone) */
export function manifest(prev, rep) {
  const runs = prev && typeof prev === "object" && Array.isArray(prev.runs) ? prev.runs : [];
  return { runs: [...runs, rep] };
}

export async function run(a) {
  const bin = findChrome();
  if (!bin) throw new Error("no chrome-headless-shell: set CHROME or install one under " + PW_DIR + "/chromium_headless_shell-<N>");
  mkdirSync(a.out, { recursive: true });
  const rep = { out: a.out, flags: { screens: a.screens, looks: a.looks, worlds: a.worlds, seed: a.seed, t125: a.t125, phone: a.phone, size: [a.w, a.h], dpr: a.dpr, notext: a.notext, gpu: a.gpu }, chrome: bin,
    done: false, intended: intended(a), captures: [], failed: {}, errors: [], warnings: [], pageErrors: [] };
  const mf = join(a.out, "shots.json"), prev = existsSync(mf) ? (() => { try { return JSON.parse(readFileSync(mf, "utf8")); } catch { return null; } })() : null;
  const save = () => writeFileSync(mf, JSON.stringify(manifest(prev, rep), null, 1));
  for (const n of rep.intended) for (const ext of [".png", ".json", ".notext.png"]) rmSync(join(a.out, n + ext), { force: true }); // no earlier file can stand in
  save(); // before the first capture: a crash still leaves what was meant
  let srv = null, chr = null, c = null;
  try {
    srv = await startServer();
    console.error("shots: serve.js pid " + srv.proc.pid + " port " + srv.port);
    chr = await startChrome(a.gpu, bin);
    console.error("shots: chrome pid " + chr.proc.pid + " profile " + chr.dir);
    c = await cdp(chr.ws);
    for (const look of a.looks) for (const world of a.worlds) await group(c, srv.port, a, look, world, rep);
    rep.done = true; // completed: never set when a step threw
  } finally {
    await stopChrome(chr, c);
    if (srv) await stop(srv.proc);
    save();
  }
  return rep;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const s of ["SIGINT", "SIGTERM", "SIGHUP"]) process.once(s, () => process.exit(130)); // shot.mjs's exit hook then stops every child by PID
  try {
    const r = await run(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify({ out: r.out, captures: r.captures.length, failed: r.failed, errors: r.errors, warnings: r.warnings, pageErrors: r.pageErrors.length }, null, 1));
    if (r.errors.length) process.exitCode = 1;
  } catch (e) {
    console.error("shots: " + ((e && e.message) || e));
    process.exitCode = 1;
  }
}
