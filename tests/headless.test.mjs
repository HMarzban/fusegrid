import {existsSync, readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {createGame} from "../src/main.js";
import {createRenderer} from "../src/render/renderer.js";
import {createWorld, loadLevel} from "../src/core/sim.js";
import {SCREEN, IDLE_T} from "../src/app/menuapp.js";
import {CFG, BIOMES, biomeOf} from "../src/core/config.js";
import {PROJ} from "../src/render/r3d/camera.js";
import {loadScores} from "../src/app/highscores.js";
import {loadStats} from "../src/app/stats.js";
import {copyPayload} from "../src/render/scenes.js";

const ROOT=dirname(fileURLToPath(import.meta.url))+"/..";

let pass=0, fail=0;
function check(name, cond, detail){ cond?pass++:fail++;
  console.log((cond?"  PASS ":"  FAIL ")+name+(detail!==undefined?" -> "+detail:"")); }

let ok=true;
try{ createGame(null,{}); }catch(e){ ok=false; console.log(e.message); }
check("createGame(null) imports+runs headless", ok);

ok=true;
try{
  const r=createRenderer(null,{hud:null,audio:null});
  const w=createWorld(7,1); loadLevel(w,1,false); w.state="MENU";
  r.render(w, 1/60);
}catch(e){ ok=false; console.log(e.message); }
check("null-canvas renderer render() does not throw", ok);

// ---- menu shell integration (plan Task 6) ----
{
  const g=createGame(null,{seed:42});
  check("createGame exposes .app", !!g.app&&typeof g.app.update==="function");
  check("boots into INTRO screen", g.app.screen===SCREEN.INTRO, g.app&&g.app.screen);
  check("boot world frozen as PLAY backdrop (never MENU)",
    g.world.state==="PLAY"&&g.world.level===1,
    g.world.state+","+g.world.level);
}

// ---- plan 7 (first-visit play now): headless boot check ----
// A fresh cabinet (no nb.cabinet.v1, no pact unlock — the only real defaults
// under Node, where defaultStore() finds no window.localStorage) skips
// straight into a CORE room-1 GAME on the very first INTRO gesture. Every
// OTHER block below only wants a known MENU to test something unrelated, so
// it stamps g.app.cabinetSeen=true right after construction to keep
// exercising the returning-player path unchanged.
{
  const g=createGame(null,{seed:42});
  check("boots unseen: no cabinet flag, no pact unlock",
    g.app.cabinetSeen===false&&g.app.pactUnlocked===false);
  g.app.skip();
  check("unseen cabinet: app.skip() boots straight to CORE GAME",
    g.app.screen===SCREEN.GAME&&g.world.state==="PLAY"&&g.world.level===1
    &&(g.world.heat|0)===0&&(g.world.pact|0)===0,
    g.app.screen+"/"+g.world.level+"/"+g.world.heat+"/"+g.world.pact);
  check("unseen cabinet: the first INTRO gesture marks it seen",
    g.app.cabinetSeen===true);
}
{
  const g=createGame(null,{seed:43});
  g.app.cabinetSeen=true;                // simulate a returning player
  g.app.skip();
  check("seen cabinet: app.skip() still reaches MENU",
    g.app.screen===SCREEN.MENU, g.app.screen);
}
{
  const g=createGame(null,{seed:42});
  g.app.cabinetSeen=true;
  g.app.skip();
  g.app.level=3;
  g.app.confirm();                       // cursor at 0 = PLAY
  check("confirm PLAY -> world PLAY + app GAME + inGame",
    g.world.state==="PLAY"&&g.app.screen===SCREEN.GAME&&g.app.inGame===true,
    g.world.state+"/"+g.app.screen);
  check("onStart applied level + reset score",
    g.world.level===3&&g.world.score===0, g.world.level+","+g.world.score);
}
{
  const g=createGame(null,{autoplay:true});
  check("autoplay (?play=1 equivalent) boots straight into GAME/PLAY",
    g.app.screen===SCREEN.GAME&&g.world.state==="PLAY",
    g.app.screen+"/"+g.world.state);
}
{
  // MINOR 3: ?play=1/autoplay bypasses bootFromIntro (whose own markCabinet
  // never fires), so main.js must mark the cabinet seen itself or a shared
  // ?play=1 link never persists nb.cabinet.v1 and the next, non-autoplay
  // visit gets boot-from-intro'd again.
  const mem={};
  globalThis.window={addEventListener:()=>{},
    localStorage:{getItem:(k)=>(k in mem?mem[k]:null),
      setItem:(k,v)=>{mem[k]=String(v);}}};
  try{
    createGame(null,{autoplay:true});
    check("autoplay marks the cabinet seen (nb.cabinet.v1)",
      mem["nb.cabinet.v1"]==="1", JSON.stringify(mem));
  }finally{ delete globalThis.window; }
}
{
  const m=createGame(null,{seed:9});
  m.loop(0); m.loop(200);
  check("loop in MENU never steps the sim", m.world.time===0, "time "+m.world.time);
  const g=createGame(null,{seed:9,autoplay:true});
  g.loop(0); g.loop(200);
  check("loop in GAME steps the sim", g.world.time>0, "time "+g.world.time);
}

// ---- fix round 1: MENU logo (spec §2) + 0.25s intro-skip fade ramp ----
{
  const texts=[], sets=[];
  const rec=new Proxy(function(){},{
    get:(t,p)=>{
      if(p===Symbol.toPrimitive)return()=>"" ;
      return (...a)=>{ if(p==="fillText")texts.push(String(a[0])); return rec; };
     },
    apply:()=>rec,
    set:(t,p,v)=>{ if(p==="fillStyle")sets.push(String(v)); return true; }
   });
  const fake={getContext:()=>rec,addEventListener(){},style:{}};
  const g=createGame(fake,{seed:5});
  g.app.cabinetSeen=true;                // seen cabinet: skip lands on MENU
  g.app.skip();                          // INTRO -> MENU
  for(let i=1;i<=20;i++)g.loop(i*16);    // ~0.32s of MENU frames
  check("MENU draws FUSE wordmark (drawLogo reused per spec §2)",
    texts.indexOf("FUSE")>=0,
    texts.filter(t=>t==="FUSE"||t==="GRID").join(","));
  const alphas=sets.filter(s=>s.slice(0,13)==="rgba(7,10,18,")
    .map(s=>parseFloat(s.slice(13)));
  check("skip fade ramps past menu veil in first frames (alpha>0.9)",
    alphas.some(a=>a>0.9), "max "+Math.max.apply(null,[0].concat(alphas)));
  check("fade settled after 0.25s (back to 0.62 veil)",
    alphas.slice(-6).every(a=>a<=0.73),
    "tail "+alphas.slice(-4).map(a=>a.toFixed(2)).join(","));
}

// ---- fix round 2: INTRO auto-advances at INTRO_DUR (no key) ----
// plan 7: the ~5s auto-skip is also an INTRO gesture, so an unseen cabinet
// rides it straight into CORE GAME; a seen cabinet still lands on MENU.
{
  const g=createGame(null,{seed:3});
  let t=0;
  for(let i=0;i<330;i++){ t+=16; g.loop(t); }   // ~5.28s, zero input
  check("unseen cabinet: intro auto-advance boots straight to CORE GAME",
    g.app.screen===SCREEN.GAME&&g.world.state==="PLAY"&&g.world.level===1,
    "screen "+g.app.screen);
}
{
  const g=createGame(null,{seed:3});
  g.app.cabinetSeen=true;                       // seen cabinet
  let t=0;
  for(let i=0;i<330;i++){ t+=16; g.loop(t); }   // ~5.28s, zero input
  check("seen cabinet: intro auto-advances to MENU at INTRO_DUR without any key",
    g.app.screen===SCREEN.MENU, "screen "+g.app.screen);
}

// ---- FINAL FIX WAVE: C1 pointer single-fire / I1 cue sheet / I2 gated pause ----
function mkCanvas(){
  const L={};
  const rec=new Proxy(function(){},{
    get:(t,p)=>{
      if(p===Symbol.toPrimitive)return()=>"" ;
      return ()=>rec;
     },
    apply:()=>rec,
    set:()=>true
   });
  return {getContext:()=>rec,style:{},width:600,height:520,
    getBoundingClientRect:()=>({left:0,top:0,width:600,height:520}),
    addEventListener(ty,fn){(L[ty]=L[ty]||[]).push(fn);},
    fire(ty,ev){(L[ty]=L[ty]||[]).forEach(fn=>fn(ev||{}));}};
}

// C1: non-GAME pointerdown routes skip/confirm ONLY (game fire latch suppressed)
{
  const cv=mkCanvas();
  const g=createGame(cv,{seed:11});
  g.app.cabinetSeen=true;                       // seen cabinet: click -> MENU
  cv.fire("pointerdown");                       // INTRO click -> skip only
  check("C1 intro click skips to MENU, no fire latch",
    g.app.screen===SCREEN.MENU&&g.input._intent.fire===false,
    g.app.screen+"/fire="+g.input._intent.fire);
  for(let i=1;i<=10;i++)g.loop(i*16);
  check("C1 click-skip does not auto-start a run",
    g.app.screen===SCREEN.MENU&&g.world.time===0, g.app.screen);
  g.app.cursor=3; cv.fire("pointerdown");       // OPTIONS
  check("C1 OPTIONS click pushes SETTINGS once",
    g.app.screen===SCREEN.SETTINGS&&g.app.optRow===0,String(g.app.screen));
  for(let i=11;i<=20;i++)g.loop(i*16);
  check("C1 push is not re-fired by rising edge next frame",
    g.app.screen===SCREEN.SETTINGS&&g.app.optRow===0);
  g.app.optRow=3; g.app.confirm();              // RENDER row
  check("C1 RENDER row toggles exactly once",
    g.app.render3d===true&&g.app.settings.r3d===1,
    "render3d="+g.app.render3d);
  g.app.key("Escape");
  g.app.cursor=4; cv.fire("pointerdown");       // GUIDE
  check("C1 subscreen click lands once", g.app.screen===SCREEN.GUIDE);
  for(let i=21;i<=30;i++)g.loop(i*16);
  check("C1 subscreen does not bounce back", g.app.screen===SCREEN.GUIDE);
}

// S2 REVIEW FIX: SETTINGS tap-to-row pointer glue had zero behavioral
// coverage (only source-regex checks existed). Drive the REAL handler —
// a fake canvas with getBoundingClientRect, a captured pointerdown listener,
// synthetic clientX/clientY — through settingsHit()'s row math (row center
// y = y0+i*rowH+rowH/2 at the 600x520 layout: rowH=30, y0=121.2).
{
  const cv=mkCamCanvas(600,520);
  const g=createGame(cv.el,{seed:71});
  g.app.cabinetSeen=true;                       // seen cabinet: skip -> MENU
  g.app.skip();
  g.app.cursor=3;                               // OPTIONS
  cv.fire("pointerdown",{clientX:1,clientY:1}); // MENU tap: off SETTINGS, coords unused
  check("tap glue: OPTIONS push lands on SETTINGS row 0",
    g.app.screen===SCREEN.SETTINGS&&g.app.optRow===0,
    g.app.screen+"/"+g.app.optRow);
  cv.fire("pointerdown",{clientX:300,clientY:136});   // row 0 MUSIC band
  check("tap glue: row 0 tap sets optRow and cycles MUSIC",
    g.app.optRow===0&&g.app.settings.mus===0,
    "optRow="+g.app.optRow+" mus="+g.app.settings.mus);
  cv.fire("pointerdown",{clientX:300,clientY:316});   // row 6 SCREEN SHAKE band
  check("tap glue: row 6 tap sets optRow and toggles the knob",
    g.app.optRow===6&&g.app.settings.shk===0,
    "optRow="+g.app.optRow+" shk="+g.app.settings.shk);
  cv.fire("pointerdown",{clientX:10,clientY:200});    // outside the plate (x<ix)
  check("tap glue: tap outside the plate backs out to MENU",
    g.app.screen===SCREEN.MENU,String(g.app.screen));
}
// same glue, PAUSE-OPTIONS surface (S3): pauseView 1 shares settingsHit/menuLayout
{
  const cv=mkCamCanvas(600,520);
  const g=createGame(cv.el,{autoplay:true,seed:72});
  g.input.onPause(); g.loop(16);
  g.app.pauseCursor=2; g.app.confirm();          // OPTIONS row -> pauseView 1
  check("PAUSE tap glue setup: pauseView 1 at row 0",
    g.app.pauseView===1&&g.app.optRow===0,
    g.app.pauseView+"/"+g.app.optRow);
  cv.fire("pointerdown",{clientX:300,clientY:316});   // row 6 SCREEN SHAKE band
  check("PAUSE tap glue: row 6 tap toggles the same knob code",
    g.app.optRow===6&&g.app.settings.shk===0,
    "optRow="+g.app.optRow+" shk="+g.app.settings.shk);
  cv.fire("pointerdown",{clientX:10,clientY:200});    // outside the plate
  check("PAUSE tap glue: tap outside the plate backs to the LIST, not play",
    g.app.pauseView===0&&g.world.state==="PAUSE",
    g.app.pauseView+"/"+g.world.state);
}
// D1: a SCALED canvas (CSS 300x260 over a 600x520 buffer, k=2) — client px
// map to buffer px by MULTIPLYING by k; the 1:1 rects above masked an inverse.
{
  const cv=mkCamCanvas(600,520);
  cv.el.getBoundingClientRect=()=>({left:0,top:0,width:300,height:260});
  const g=createGame(cv.el,{autoplay:true,seed:73});
  g.input.onPause(); g.loop(16);
  cv.fire("pointerdown",{clientX:150,clientY:141});   // OPTIONS row (buf 300,282)
  check("D1 scaled tap: pause OPTIONS row opens the inline page",
    g.app.pauseCursor===2&&g.app.pauseView===1,
    g.app.pauseCursor+"/"+g.app.pauseView);
  cv.fire("pointerdown",{clientX:150,clientY:158});   // row 6 (buf 300,316)
  check("D1 scaled tap: pause OPTIONS row 6 toggles SCREEN SHAKE",
    g.app.pauseView===1&&g.app.optRow===6&&g.app.settings.shk===0,
    g.app.pauseView+"/"+g.app.optRow+"/"+g.app.settings.shk);
  const cs=mkCamCanvas(600,520);
  cs.el.getBoundingClientRect=()=>({left:0,top:0,width:300,height:260});
  const h=createGame(cs.el,{seed:74});
  h.app.cabinetSeen=true; h.app.skip(); h.app.cursor=3;
  cs.fire("pointerdown",{clientX:1,clientY:1});
  cs.fire("pointerdown",{clientX:150,clientY:158});   // row 6 (buf 300,316)
  check("D1 scaled tap: SETTINGS row 6 toggles SCREEN SHAKE",
    h.app.screen===SCREEN.SETTINGS&&h.app.optRow===6&&h.app.settings.shk===0,
    h.app.screen+"/"+h.app.optRow+"/"+h.app.settings.shk);
}
// D2: MENU taps land on the TAPPED row, not the cursor. Same scaled canvas;
// the STATS row is located by the label drawMenu actually paints (fillText).
{
  const cv=mkCamCanvas(600,520);
  cv.el.getBoundingClientRect=()=>({left:0,top:0,width:300,height:260});
  const g=createGame(cv.el,{seed:75});
  g.app.cabinetSeen=true; g.app.skip();
  for(let i=1;i<=40;i++)g.loop(i*16);            // settle the row entrance
  const at=cv.calls.filter(c=>c[0]==="fillText"&&c[1][0]==="STATS").pop();
  check("D2 setup: MENU painted a STATS label at cursor 0",
    !!at&&g.app.screen===SCREEN.MENU&&g.app.cursor===0,String(at&&at[1]));
  cv.fire("pointerdown",{clientX:at[1][1]/2,clientY:at[1][2]/2});
  check("D2 MENU tap on the STATS row opens STATS, not a PLAY run",
    g.app.screen===SCREEN.STATS&&g.app.cursor===6,
    g.app.screen+"/"+g.app.cursor);
}

// I1: ui* cue sheet live from the app layer (main.js wrappers)
{
  const plays=[];
  const audio={play:n=>plays.push(n),toggle:()=>false};
  const g=createGame(null,{seed:12,audio});
  check("P1 jingle deferred while audio locked (stub cannot unlock)",
    plays.length===0,JSON.stringify(plays));
  plays.length=0;
  g.app.screen=SCREEN.MENU;
  g.app.move(1);
  check("I1 cursor move -> uiMove",
    plays.join()==="uiMove",JSON.stringify(plays));
  plays.length=0;
  g.app.cursor=0; g.app.confirm();              // PLAY
  check("I1 confirm PLAY -> uiSel + run starts",
    plays.join()==="uiSel"&&g.app.screen===SCREEN.GAME,JSON.stringify(plays));
}
{
  const plays=[];
  const audio={play:n=>plays.push(n),toggle:()=>false};
  const g=createGame(null,{seed:13,audio});
  g.app.screen=SCREEN.MENU; g.app.cursor=3; plays.length=0;
  g.app.confirm();                              // OPTIONS push
  check("I1 OPTIONS confirm -> uiSel + SETTINGS",
    plays.join()==="uiSel"&&g.app.screen===SCREEN.SETTINGS,
    JSON.stringify(plays));
  g.app.optRow=6; plays.length=0;
  g.app.confirm();                              // SCREEN SHAKE knob
  check("I1 SETTINGS knob confirm -> uiTog (never uiSel)",
    plays.join()==="uiTog"&&g.app.settings.shk===0,JSON.stringify(plays));
  g.app.key("Escape");
  g.app.cursor=4; plays.length=0;
  g.app.confirm();                              // push GUIDE
  g.app.key("Escape");                          // back
  check("I1 GUIDE enter->uiSel then Esc back->uiBack",
    plays.join()==="uiSel,uiBack",JSON.stringify(plays));
  g.app.screen=SCREEN.STATS; plays.length=0;
  g.input.onUiKey("KeyT");
  check("R6 KeyT reaches app.key on STATS, opens TROPHIES and plays no cue",
    g.app.screen===SCREEN.TROPHIES&&plays.length===0,g.app.screen+"/"+JSON.stringify(plays));
  g.app.confirm();
  check("R6 confirm on TROPHIES backs to STATS with ONE uiBack, never uiSel",
    g.app.screen===SCREEN.STATS&&plays.join()==="uiBack",JSON.stringify(plays));
}
{
  const noop=()=>{};
  const mem={"nb.medals.v1":"129"};
  globalThis.window={addEventListener:noop,removeEventListener:noop,
    localStorage:{getItem:(k)=>(k in mem?mem[k]:null),
      setItem:(k,v)=>{mem[k]=String(v);}}};
  try{
    const cv=mkCamCanvas(600,520);
    const g=createGame(cv.el,{seed:15});
    g.app.screen=SCREEN.MENU; g.app.cursor=6;
    g.app.confirm();                              // STATS row -> onStats
    check("R6 STATS confirm wires the stored medals into app.stats.trophies",
      g.app.screen===SCREEN.STATS&&(g.app.stats.trophies||[]).length===8,
      g.app.screen+"/"+JSON.stringify(g.app.stats&&g.app.stats.trophies));
    g.input.onUiKey("KeyT");
    cv.calls.length=0;
    g.loop(16); g.loop(32);
    const texts=cv.calls.filter(c=>c[0]==="fillText").map(c=>String(c[1][0]));
    check("R6 MEDALS page draws the stored medals end to end (onStats + shellview route)",
      g.app.screen===SCREEN.TROPHIES&&texts.includes("2/8")&&texts.includes("FLAWLESS")
        &&texts.includes("IRON CROWN"),texts.join("|"));
  }finally{ delete globalThis.window; }
}
{
  const plays=[];
  const audio={play:n=>plays.push(n),toggle:()=>false};
  const g=createGame(null,{seed:14,audio});
  g.app.screen=SCREEN.LEVEL; g.app.level=1; g.app.heat=0;
  g.app.key("ArrowUp");
  check("I1 LEVEL ArrowUp through wrapper heats PLUS, room stays 1",
    g.app.heat===1&&g.app.level===1, "heat="+g.app.heat+" lv="+g.app.level);
  plays.length=0;
  g.app.move(-1,1);
  check("I1 wrapped move(-1,1) heats MAX and cues uiMove",
    g.app.heat===2&&plays.join()==="uiMove",
    "heat="+g.app.heat+" plays="+plays.join());
}

// P1: uiJingle gated on audio unlock — a suspended ctx freezes currentTime,
// so boot-time scheduling replays all 5 oscillators as one chord-blob on the
// first gesture. Jingle must ride the unlock handler instead.
{
  const plays=[];
  const audio={play:n=>plays.push(n),toggle:()=>false,_u:false,
    unlock(){this._u=true;return true;},unlocked(){return !!this._u;}};
  const L={};
  globalThis.window={addEventListener:(ty,fn)=>{(L[ty]=L[ty]||[]).push(fn);}};
  try{
    createGame(null,{seed:14,audio});
    check("P1 locked ctx: nothing scheduled before first gesture",
      plays.length===0,JSON.stringify(plays));
    // neutral gesture key (F15): Input also listens on window and must not
    // produce any ui* cue here — isolates the jingle assertion
    L.keydown.forEach(f=>f({code:"F15"}));
    check("P1 first gesture -> exactly one uiJingle after unlock",
      plays.join()==="uiJingle",JSON.stringify(plays));
    L.pointerdown.forEach(f=>f({}));
    L.keydown.forEach(f=>f({code:"F16"}));
    check("P1 second listener/gesture never replays the jingle",
      plays.length===1,JSON.stringify(plays));
   }finally{ delete globalThis.window; }
}

// I2: pause exists only inside GAME
{
  const g=createGame(null,{autoplay:true});
  g.input.onPause();
  check("I2 onPause pauses inside GAME", g.world.state==="PAUSE");
  g.input.onPause();
  check("I2 onPause resumes inside GAME", g.world.state==="PLAY");
}
{
  const g=createGame(null,{});
  check("I2 boot backdrop is PLAY", g.world.state==="PLAY");
  g.input.onPause();
  check("I2 onPause outside GAME leaves world untouched",
    g.world.state==="PLAY"&&g.app.screen===SCREEN.INTRO);
  g.app.cabinetSeen=true;                // seen cabinet: skip lands on MENU
  g.app.skip();
  g.input._onKey({code:"KeyP"});
  check("I2 KeyP at MENU routes to app only (world stays PLAY)",
    g.world.state==="PLAY"&&g.app.screen===SCREEN.MENU);
  g.input._onKey({code:"Escape"});
  check("I2 Esc at MENU routes to app only (root back no-op)",
    g.world.state==="PLAY"&&g.app.screen===SCREEN.MENU);
}

// ---- R11: pause reaches every state a player can be in (spec §4.3).
// onPause is src/main.js:346-358; KeyP/Escape route through input.js:48.
// Already pinned above and NOT repeated here: PLAY <-> PAUSE inside GAME,
// onPause outside GAME leaving the world untouched, KeyP at MENU. ----
{
  const fakeTexts = () => {
    const texts = [];
    const noop = () => {};
    const rc = { fillText: (s) => texts.push(String(s)),
      strokeText: (s) => texts.push(String(s)) };
    for (const n of ["save","restore","translate","rotate","scale","beginPath",
      "closePath","moveTo","lineTo","arc","arcTo","bezierCurveTo",
      "quadraticCurveTo","ellipse","fill","stroke","fillRect","strokeRect",
      "clearRect","setTransform","transform","drawImage"]) rc[n]=noop;
    rc.createLinearGradient=()=>({addColorStop:noop});
    rc.createRadialGradient=()=>({addColorStop:noop});
    return { canvas:{getContext:()=>rc,addEventListener(){},style:{}}, texts };
  };

  // 1 + 2: WIN and LOSE are INERT, and that is a decision, not an absence.
  // The WIN overlay is not time-pressured and already owns SPACE; a pause on a
  // stopped clock is a no-op. main.js's onPause has no WIN or LOSE branch.
  for (const st of ["WIN", "LOSE"]) {
    const g = createGame(null, { autoplay: true, seed: 11 });
    g.world.state = st;
    g.input.onPause();
    check("R11 onPause is inert on " + st + " — world stays " + st,
      g.world.state === st, g.world.state);
  }

  // 3: the inline OPTIONS page backs to the pause LIST, never to play.
  {
    const g = createGame(null, { autoplay: true, seed: 12 });
    g.input.onPause();
    g.app.pauseView = 1;
    g.input.onPause();
    check("R11 onPause on the inline OPTIONS page backs to the list, world stays PAUSE",
      g.app.pauseView === 0 && g.world.state === "PAUSE",
      g.app.pauseView + "/" + g.world.state);
  }

  // 4: the room-load frame. WIN + one fire edge runs loadLevel(level+1,true)
  // and returns to PLAY inside step(); pause must work on that same frame.
  {
    const g = createGame(null, { autoplay: true, seed: 13 });
    let t = 0;
    g.loop((t += 16));
    const lv = g.world.level;
    g.world.state = "WIN";
    // 34ms (>2*CFG.STEP*1000) so the release frame and the press frame each
    // independently cross the fixed-step accumulator's CFG.STEP threshold —
    // main.js's loop() computes dt=(t-last)/1000, and two back-to-back 16ms
    // frames can land the release and the press inside the SAME step() call
    // (or skip a step's worth of accumulator entirely), which would collapse
    // the release-then-press edge main.js:53-65 needs into one observation.
    g.input._onKeyUp({ code: "Space" });
    g.loop((t += 34));
    g.input._onKey({ code: "Space", preventDefault() {} });
    g.loop((t += 34));
    check("R11 WIN + fire edge advances a room and returns to PLAY",
      g.world.level === lv + 1 && g.world.state === "PLAY",
      g.world.level + "/" + g.world.state);
    g.input.onPause();
    check("R11 onPause on the room-load frame pauses — no blocked window between rooms",
      g.world.state === "PAUSE", g.world.state);
  }

  // 5: the new-run frame. LOSE + one fire edge runs startGame (room 1, score 0).
  {
    const g = createGame(null, { autoplay: true, seed: 14 });
    let t = 0;
    g.loop((t += 16));
    g.world.state = "LOSE";
    // same 34ms reasoning as pin 4 above.
    g.input._onKeyUp({ code: "Space" });
    g.loop((t += 34));
    g.input._onKey({ code: "Space", preventDefault() {} });
    g.loop((t += 34));
    check("R11 LOSE + fire edge starts a fresh run at room 1, PLAY",
      g.world.level === 1 && g.world.state === "PLAY",
      g.world.level + "/" + g.world.state);
    g.input.onPause();
    check("R11 onPause on the new-run frame pauses — same for the LOSE path",
      g.world.state === "PAUSE", g.world.state);
  }

  // 6: ATTRACT is deliberately excluded — it is a demo, not a run.
  {
    const g = createGame(null, { seed: 15 });
    g.app.cabinetSeen = true;
    g.app.skip();
    g.app.enterAttract();
    let t = 1000;
    g.loop(t);
    g.loop((t += 64));
    g.input.onPause();
    check("R11 onPause is a no-op on ATTRACT — no PAUSE state, demo keeps running",
      g.world.state === "PLAY" && g.app.screen === SCREEN.ATTRACT && !!g.demo,
      g.world.state + "/" + g.app.screen);
  }

  // 7: PAUSE must not burn the coach window. coachT is main's PLAY-only clock
  // (main.js:577); this is commit 33668f7's fix, and R11 is where it gets a pin.
  {
    const { canvas, texts } = fakeTexts();
    const g = createGame(canvas, { autoplay: true, seed: 16 });
    let t = 0;
    g.loop((t += 16));
    texts.length = 0;
    g.loop((t += 16));
    check("R11 the ghost coach is up on a fresh run", texts.includes("SPACE"),
      texts.join("|"));
    g.input.onPause();
    for (let i = 0; i < 300; i++) g.loop((t += 16)); // ~4.8s paused, past COACH_DUR 3
    g.input.onPause();
    texts.length = 0;
    g.loop((t += 16));
    check("R11 PAUSE does not advance coachT, so the coach window survives the pause",
      texts.includes("SPACE"), texts.join("|"));
  }
}

// ---- ?net=local dual-peer lockstep harness (netcode v1 dev aid) ----
{
  const g=createGame(null,{autoplay:true,netLocal:true});
  check("net=local builds dual-peer lockstep harness",
    !!g.net&&!!g.net.lsA&&!!g.net.lsB&&!!g.net.wB, String(!!g.net));
  let t=0; for(let i=0;i<80;i++){ t+=16; g.loop(t); }
  const a=g.world.tick,b=g.net.wB.tick;
  check("net=local drives both worlds in lockstep (equal ticks+score)",
    a>0&&a===b&&g.world.score===g.net.wB.score,a+"/"+b);
}
{
  const g=createGame(null,{autoplay:true});
  check("flag off: no net harness (default path untouched)",
    !g.net);
}

// ---- ATTRACT MODE (spec §1/§4/§5/§6): idle entry, demo harness, exit ----
{
  const g=createGame(null,{seed:21});
  g.app.cabinetSeen=true;                // seen cabinet: skip lands on MENU
  g.app.skip();                          // INTRO -> MENU
  let t=1000;
  for(let i=0;i<590;i++){ t+=16; g.loop(t); }        // ~9.4s idle
  check("attract: below IDLE_T stays MENU, no demo, sim untouched",
    g.app.screen===SCREEN.MENU&&g.demo===null&&g.world.time===0,
    g.app.screen+"/"+String(g.demo));
  for(let i=0;i<50;i++){ t+=16; g.loop(t); }         // crosses 10s
  check("attract: >=IDLE_T enters ATTRACT with seeded level-1 demo",
    g.app.screen===SCREEN.ATTRACT&&!!g.demo
    &&g.demo.world.seed===20260823&&g.demo.world.level===1
    &&g.demo.world.state==="PLAY",
    g.app.screen+"/"+(g.demo&&g.demo.world.level));
  for(let i=0;i<60;i++){ t+=16; g.loop(t); }
  check("attract: demo world steps through the fixed-step accumulator",
    !!g.demo&&g.demo.world.time>0,String(g.demo&&g.demo.world.time));
  check("attract: live game world still frozen while demo runs",
    g.world.time===0&&g.world.tick===0);
  // rollover via the 20s cap: force t to the edge, one big frame rolls it
  const edge=20-CFG.STEP/2;
  g.demo.t=edge; t+=250; g.loop(t);      // dt capped at 0.25 -> >=1 demo step
  check("attract: cap rollover 1 -> 2 (fresh world, PLAY)",
    g.demo.world.level===2&&g.demo.world.state==="PLAY"&&g.demo.t<1,
    "lvl="+g.demo.world.level+" t="+g.demo.t.toFixed(3));
  g.demo.t=edge; t+=250; g.loop(t);
  check("attract: rollover 2 -> 3", g.demo.world.level===3);
  g.demo.t=edge; t+=250; g.loop(t);
  check("attract: rollover 3 -> 1 (cycle wraps)", g.demo.world.level===1);
  // exit paths: Escape exits instantly, demo discarded on next frame, cursor kept
  g.app.cursor=4;
  const esc=g.app.key("Escape");
  check("attract: Escape exits to MENU", esc===true && g.app.screen===SCREEN.MENU);
  t+=16; g.loop(t);
  check("attract: demo discarded after exit", g.demo===null);
  for(let i=0;i<640;i++){ t+=16; g.loop(t); }
  check("attract: re-entered after Escape", g.app.screen===SCREEN.ATTRACT);
  const play=g.app.key("Enter");
  check("attract: Enter starts a CORE run",
    play && g.app.screen===SCREEN.GAME
    && g.world.level===1 && (g.world.heat|0)===0 && (g.world.pact|0)===0
    && g.world.state==="PLAY" && g.app.cursor===4);
}

{
  const g=createGame(null,{seed:21});
  g.app.cabinetSeen=true;                // seen cabinet: skip lands on MENU
  g.app.skip();
  g.app.heat=2;
  let t=1000;
  for(let i=0;i<640;i++){ t+=16; g.loop(t); }
  check("attract: demo stays CORE even if shell heat is MAX",
    g.app.heat===2&&g.demo&&g.demo.world.heat===0&&g.demo.world.fuse===CFG.FUSE
    &&(g.demo.world.pact|0)===0,
    "app="+g.app.heat+" demo="+(g.demo&&g.demo.world.heat)+" fuse="+(g.demo&&g.demo.world.fuse));
  const edge=20-CFG.STEP/2;
  g.demo.t=edge; t+=250; g.loop(t);
  check("attract: rollover demo stays CORE",
    g.demo.world.heat===0&&g.demo.world.fuse===CFG.FUSE,
    "heat="+g.demo.world.heat+" fuse="+g.demo.world.fuse);
}

// ---- P2: ATTRACT->MENU gets the 0.25s veil (demo board vs live backdrop
//        would otherwise hard-cut). Mirrors the INTRO->MENU skip-fade check. ----
{
  const texts=[], sets=[];
  const rec=new Proxy(function(){},{
    get:(t,p)=>{
      if(p===Symbol.toPrimitive)return()=>"" ;
      return (...a)=>{ if(p==="fillText")texts.push(String(a[0])); return rec; };
     },
    apply:()=>rec,
    set:(t,p,v)=>{ if(p==="fillStyle")sets.push(String(v)); return true; }
   });
  const fake={getContext:()=>rec,addEventListener(){},style:{}};
  const g=createGame(fake,{seed:41});
  g.app.cabinetSeen=true;                // seen cabinet: skip lands on MENU
  g.app.skip();
  g.app.enterAttract();
  let t=1000;
  g.loop(t); t+=64; g.loop(t);           // demo live before exit
  check("P2 probe: attract active pre-exit",
    g.app.screen===SCREEN.ATTRACT&&!!g.demo,String(g.app.screen));
  sets.length=0;
  g.app.key("Escape");                   // exitAttract -> MENU, subT reset
  const alphas=[];
  for(let i=1;i<=20;i++){ t+=16; g.loop(t);
    alphas.push(...sets.filter(s=>String(s).slice(0,13)==="rgba(7,10,18,")
      .map(s=>parseFloat(String(s).slice(13))));
    sets.length=0;
   }
  check("P2 post-attract MENU: fade veil k>0.9 in first frames",
    alphas.some(a=>a>0.9),"max "+Math.max.apply(null,[0].concat(alphas)));
  check("P2 veil settles to plain 0.62 dim after 0.25s",
    alphas.slice(-6).every(a=>a<=0.73),
    "tail "+alphas.slice(-4).map(a=>a.toFixed(2)).join(","));
}

// ---- score isolation (spec §6): long attract incl. deaths never records ----
{
  const baseline=JSON.stringify(loadScores());
  const g=createGame(null,{seed:23});
  g.app.cabinetSeen=true;                // seen cabinet: skip lands on MENU
  g.app.skip(); g.app.cursor=2;
  g.app.enterAttract();                  // direct entry for a deterministic run
  const levels=new Set();
  let t=2000;
  for(let i=0;i<400;i++){                // ~100s wall => >=40s sim => >=2 caps
    t+=250; g.loop(t);
    if(g.demo){
      levels.add(g.demo.world.level);
      g.demo.world.score=(g.demo.world.score+7919)%100000;   // poison
     }
   }
  check("isolation: scores byte-equal baseline after poisoned long attract",
    JSON.stringify(loadScores())===baseline,
    JSON.stringify(loadScores()).slice(0,60));
  check("isolation: cycles visited roll through 1,2,3",
    levels.has(1)&&levels.has(2)&&levels.has(3),[...levels].join(","));
  check("isolation: live world pristine (time/tick/score zero)",
    g.world.time===0&&g.world.tick===0&&g.world.score===0);
}

// ---- renderer opts (spec §5.5): hud:false + sfx gate, defaults identical ----
{
  const plays=[];
  const r=createRenderer(null,{audio:{play:n=>plays.push(n)}});
  const w=createWorld(5,1); loadLevel(w,1,false); w.state="PLAY";
  w.events.push({t:"boom",x:0,y:0});
  r.render(w,1/60);
  check("renderer defaults: sfx played + fx consumed",
    plays.join()==="boom"&&w.events.length===0,plays.join());
  plays.length=0;
  w.events.push({t:"kill",x:0,y:0,color:"#fff"});
  r.render(w,1/60,{hud:false});
  check("opts.hud=false still consumes fx",w.events.length===0,
    String(w.events.length));
  check("opts default sfx stays on under hud:false",
    plays.join()==="kill",plays.join());
  plays.length=0;
  w.events.push({t:"hurt",x:0,y:0});
  r.render(w,1/60,{hud:false,sfx:false});
  check("opts.sfx=false gates audio.play only (fx intact)",
    plays.length===0&&w.events.length===0);
}

{
  const src=readFileSync(join(ROOT,"src/main.js"),"utf8");
  check("main.js passes {hud:false} on every non-GAME render, closing the"
    +" undefined gap that wrote the frozen backdrop's zeros",
    /:\s*\{\s*hud:\s*false\s*\}/.test(src)&&!/:\s*undefined;/.test(src),
    (src.match(/let ro =[\s\S]{0,600}?renderer\.render/)||[])[0]);
  check("toolbar.js is gone and main.js no longer imports it",
    !/toolbar\.js|mountToolbar|setBtn/.test(src));
}

// F3 toolbar GAME-gates and the toolbar Menu-button wave are gone with
// toolbar.js: every wave they exercised (Pause/Restart/Menu GAME-gating,
// score-recorded quit) is now asserted through the P1 pause-list pins below.

// ---- P4: demobot imports pruned (tileOf/solidAt unused; bfsNext lives) ----
{
  const fs=await import("node:fs");
  const src=fs.readFileSync(new URL("../src/app/demobot.js",
    import.meta.url),"utf8");
  check("demobot: no dead tileOf/solidAt refs, bfsNext kept",
    !/\btileOf\b/.test(src)&&!/\bsolidAt\b/.test(src)&&/\bbfsNext\b/.test(src));
}

// ---- Area 4: distinct opts.canvasEl breaks the C1 swallow silently ----
// Input listens on opts.canvasEl but main's anti-double-fire pointerdown
// swallow registers on the render canvas; a mismatch must warn (dev-facing).
{
  const warns=[];
  const ow=console.warn; console.warn=(...a)=>warns.push(a.join(" "));
  try{
    createGame(mkCanvas(),{seed:51,canvasEl:mkCanvas()});
    check("canvasEl seam: distinct element warns exactly once",
      warns.length===1,JSON.stringify(warns));
    warns.length=0;
    const cv=mkCanvas();
    createGame(cv,{seed:52,canvasEl:cv});
    check("canvasEl seam: identical element stays silent",warns.length===0,
      JSON.stringify(warns));
    createGame(mkCanvas(),{seed:53});
    check("canvasEl seam: absent canvasEl stays silent",warns.length===0,
      JSON.stringify(warns));
   }finally{ console.warn=ow; }
}

// ---- CAMERA CONTROL (spec §5 f/g/h): GAME-only pan/zoom/reset ----
// Canvas stub with REAL width/height + arg-capturing ctx so the outer
// transform triple is observable per frame.
function mkCamCanvas(w,h){
  const L={}, calls=[];
  const ctx=new Proxy(function(){},{
    get:(t,p)=>{
      if(p===Symbol.toPrimitive)return()=>"" ;
      return (...a)=>{ calls.push([p,a]); return ctx; };
     },
    apply:()=>ctx,
    set:()=>true
   });
  const el={width:w,height:h,style:{},getContext:()=>ctx,
    getBoundingClientRect:()=>({left:0,top:0,width:w,height:h}),
    addEventListener(ty,fn){(L[ty]=L[ty]||[]).push(fn);},
    removeEventListener(ty,fn){const a=L[ty]||[];const i=a.indexOf(fn);
      if(i>=0)a.splice(i,1);},
    fire(ty,ev){(L[ty]=L[ty]||[]).slice().forEach(fn=>fn(ev||{}));}};
  return {el,L,calls,fire:(ty,ev)=>el.fire(ty,ev)};
}
const camTriple=(calls,cam,cw,ch)=>calls.some((c,i,a)=>
  c[0]==="translate"&&c[1][0]===cw/2+cam.x&&c[1][1]===ch/2+cam.y
  &&a[i+1]&&a[i+1][0]==="scale"&&a[i+1][1][0]===cam.zoom
  &&a[i+2]&&a[i+2][0]==="translate"&&a[i+2][1][0]===-cw/2);
{
  const win={innerWidth:2000,innerHeight:1200,hs:{},
    addEventListener(t,f){(win.hs[t]=win.hs[t]||[]).push(f);},
    removeEventListener(t,f){const a=win.hs[t]||[];const i=a.indexOf(f);
      if(i>=0)a.splice(i,1);}};
  globalThis.window=win;
  const wfire=(t,ev)=>(win.hs[t]||[]).forEach(f=>f(ev||{}));
  try{
    const cv=mkCamCanvas(600,520);
    const g=createGame(cv.el,{seed:61});
    check("cam exposed on game object at identity",
      !!g.cam&&g.cam.x===0&&g.cam.y===0&&g.cam.zoom===1,String(JSON.stringify(g.cam)));
    // (f) inert outside GAME: MENU-frame wheel/right-drag leave cam frozen
    g.app.cabinetSeen=true;                // seen cabinet: skip lands on MENU
    g.app.skip();                          // INTRO -> MENU
    g.loop(0);
    cv.fire("wheel",{deltaY:-240,clientX:450,clientY:260,preventDefault(){}});
    wfire("pointermove",{pointerId:9,button:0,clientX:400,clientY:250});
    wfire("pointerup",{pointerId:9,button:2});
    check("(f) MENU wheel+drag leave cam frozen {0,0,1}",
      g.cam.x===0&&g.cam.y===0&&g.cam.zoom===1,String(JSON.stringify(g.cam)));
    cv.calls.length=0;
    let t=16; g.loop(t);
    check("(f) MENU frame carries no camera transform",
      !camTriple(cv.calls,g.cam,600,520));
    // enter GAME via PLAY confirm (cursor 0)
    g.app.confirm();
    t+=16; g.loop(t);
    // (g) right-drag pans by canvas-space delta (rect scale 1 here)
    cv.el.fire("pointerdown",{pointerId:1,button:2,clientX:300,clientY:260});
    wfire("pointermove",{pointerId:1,buttons:2,clientX:347.5,clientY:222});
    wfire("pointerup",{pointerId:1,button:2,clientX:347.5,clientY:222});
    check("(g) right-drag pans cam exactly", g.cam.x===47.5&&g.cam.y===-38,
      String(JSON.stringify(g.cam)));
    check("(g) right-button never latched fire", g.input._intent.fire===false);
    cv.calls.length=0;
    t+=16; g.loop(t);
    check("(g) GAME frame emits translate(cx+x,cy+y)->scale(z)->translate(-cx,-cy)",
      camTriple(cv.calls,g.cam,600,520),
      "cam="+JSON.stringify(g.cam));
    // (h) KeyR reset through the real Input->onUiKey route
    g.input._onKey({code:"KeyR"});
    check("(h) KeyR in GAME restores identity",
      g.cam.x===0&&g.cam.y===0&&g.cam.zoom===1,String(JSON.stringify(g.cam)));
    // wheel zoom: clamped + cursor-anchored (world x under cursor fixed)
    cv.fire("wheel",{deltaY:-20000,clientX:450,clientY:130,preventDefault(){}});
    check("(h) huge wheel-in clamps to MAX_Z", g.cam.zoom===2.5,String(g.cam.zoom));
    g.input._onKey({code:"KeyR"});
    const wxPre=(450-300-g.cam.x)/g.cam.zoom+300;
    cv.fire("wheel",{deltaY:-120,clientX:450,clientY:130,preventDefault(){}});
    const wxPost=(450-300-g.cam.x)/g.cam.zoom+300;
    check("(h) wheel zoom cursor-anchored", Math.abs(wxPost-wxPre)<1e-9,
      wxPre.toFixed(6)+"->"+wxPost.toFixed(6));
    check("(h) moderate wheel-in lands on exp(+0.18)", Math.abs(g.cam.zoom-Math.exp(0.18))<1e-9);
    // pinch: 1st finger latches fire (Input), 2nd cancels it and zooms.
    // KeyR first so the pinch math is exact from identity zoom.
    g.input._onKey({code:"KeyR"});
    cv.el.fire("pointerdown",{pointerId:10,clientX:200,clientY:200});
    check("(h) pinch 1st finger latches fire (pre-existing path)",
      g.input._intent.fire===true);
    cv.el.fire("pointerdown",{pointerId:11,clientX:280,clientY:200});
    check("(h) pinch 2nd finger cancels pending fire latch",
      g.input._intent.fire===false);
    wfire("pointermove",{pointerId:11,clientX:360,clientY:200});
    check("(h) pinch spread ratio 2 -> zoom exactly 2 anchored at mid",
      g.cam.zoom===2&&g.cam.x===20&&g.cam.y===60,String(JSON.stringify(g.cam)));
    wfire("pointerup",{pointerId:10,button:0});
    wfire("pointerup",{pointerId:11,button:0});
    // GAME -> MENU via the KeyM pause-quit side channel; cam must not leak
    // into menu framing, then onStart resets for the fresh run
    g.world.state="PAUSE";
    t+=16; g.loop(t);                    // GAME frame latches app.worldState
    g.input._onKey({code:"KeyM"});
    check("KeyM quit lands MENU with demo-free backdrop",
      g.app.screen===SCREEN.MENU,String(g.app.screen));
    cv.calls.length=0;
    t+=16; g.loop(t);
    check("(f) post-quit MENU frame still transform-free",
      !camTriple(cv.calls,g.cam,600,520));
    g.app.confirm();                       // PLAY -> onStart resetCam
    check("(h) onStart (fresh run) resets cam to identity",
      g.app.screen===SCREEN.GAME&&g.cam.x===0&&g.cam.y===0&&g.cam.zoom===1,
      String(JSON.stringify(g.cam)));
   }finally{ delete globalThis.window; }
}

// (i) regression: overlay #c context must be claimed alpha:true BEFORE any
// renderer — the classic 2D renderer requests {alpha:false}, and canvas
// contexts are first-call-wins; an alpha:false claim makes the 3D overlay
// composite opaque black over #gl (black-screen bug).
{
  const calls=[];
  const fakeCtx={save(){},restore(){},translate(){},scale(){}};
  const fakeCanvas={getContext(type,attrs){calls.push([type,attrs]);return fakeCtx;},
    addEventListener(){},removeEventListener(){}};
  const g=createGame(fakeCanvas,{});
  const first2d=calls.find(c=>c[0]==="2d");
  check("(i) overlay ctx claimed alpha:true before renderers",
    !!first2d&&first2d[1]&&first2d[1].alpha===true,
    JSON.stringify(first2d));
  check("(i) live __GAME__.renderer follows kind swap (stale-copy guard)",
    typeof g.renderer==="object"&&g.renderer!==null);
 }

{
  const main=readFileSync(join(ROOT,"src/main.js"),"utf8");
  check("main.js does not statically import three wrapper",
    !/from\s+["']\.\/render\/three\/wrapper\.js["']/.test(main));
  check("main.js does not stomp #gl drawing buffer (Retina viewport)",
    !/glCanvas\.width\s*=/.test(main));
  const indexHtml=readFileSync(join(ROOT,"index.html"),"utf8");
  check("index.html links a relative favicon (GitHub project Pages)",
    /rel=["']icon["']/.test(indexHtml)&&/href=["']favicon\.svg["']/.test(indexHtml));
  check("index.html has no root-absolute asset hrefs",
    !/href=["']\//.test(indexHtml));
  check("GitHub Pages skips Jekyll (.nojekyll)",
    existsSync(join(ROOT,".nojekyll")));
  check("index.html has a meta description",
    /name=["']description["']/.test(indexHtml)
    &&/content=["'][^"']{40,}["']/.test(indexHtml));
  check("index.html has Open Graph + Twitter large card",
    /property=["']og:image["']/.test(indexHtml)
    &&/property=["']og:title["']/.test(indexHtml)
    &&/name=["']twitter:card["']/.test(indexHtml)
    &&/summary_large_image/.test(indexHtml));
  check("og:image is the public Pages URL",
    /og:image["']\s+content=["']https:\/\/hmarzban\.github\.io\/fusegrid\/og\.png["']/.test(indexHtml));
  check("canonical is the public Pages URL",
    /rel=["']canonical["']/.test(indexHtml)
    &&/href=["']https:\/\/hmarzban\.github\.io\/fusegrid\/["']/.test(indexHtml));
  check("title sells play-in-browser arcade",
    /<title>FUSE\/GRID — play the bomb-grid arcade in the browser<\/title>/.test(indexHtml));
  check("meta description names 3D and the browser",
    /name=["']description["'][^>]+3D/.test(indexHtml)
    &&/name=["']description["'][^>]+browser/.test(indexHtml));
  check("og:locale is en_US",
    /property=["']og:locale["']/.test(indexHtml)&&/en_US/.test(indexHtml));
  const ld=JSON.parse((indexHtml.match(/<script type="application\/ld\+json">\s*([^<]+)/)||[])[1]||"null");
  const ldType=ld&&ld["@type"];
  check("JSON-LD is a free VideoGame",
    ld
    &&(ldType==="VideoGame"||(Array.isArray(ldType)&&ldType.includes("VideoGame")))
    &&ld.isAccessibleForFree===true
    &&ld.offers&&String(ld.offers.price)==="0",
    JSON.stringify(ldType));
  check("sr-only H1 names the arcade",
    /<h1 class="sr-only">[^<]*arcade[^<]*<\/h1>/.test(indexHtml));
  check("social preview PNG exists", existsSync(join(ROOT,"og.png")));
  check("robots.txt and sitemap.xml exist",
    existsSync(join(ROOT,"robots.txt"))&&existsSync(join(ROOT,"sitemap.xml")));
  const pagesYml=readFileSync(join(ROOT,".github/workflows/pages.yml"),"utf8");
  check("Pages workflow stages og.png and robots.txt",
    /og\.png/.test(pagesYml)&&/robots\.txt/.test(pagesYml));
  check("rooms 1-5 stay JUNGLE ICE FACTORY WATER ARENA",
    BIOMES.slice(0,5).map(b=>b.name).join()==="JUNGLE,ICE,FACTORY,WATER,ARENA"
    &&biomeOf(1).name!==biomeOf(5).name
    &&biomeOf(1).brickA==="#42f024"&&biomeOf(2).hWall===36,
    BIOMES.slice(0,5).map(b=>b.name).join());
  check("rooms 6-8 brickA differ pairwise",
    biomeOf(6).brickA!==biomeOf(7).brickA
    &&biomeOf(7).brickA!==biomeOf(8).brickA
    &&biomeOf(6).brickA!==biomeOf(8).brickA);
  check("rooms 6-8 unique palettes SAND VOID CROWN",
    BIOMES.length===8
    &&biomeOf(6).name==="SAND"&&biomeOf(7).name==="VOID"&&biomeOf(8).name==="CROWN"
    &&biomeOf(6).name!==biomeOf(1).name
    &&biomeOf(6).hWall<=36&&biomeOf(7).hWall<=36&&biomeOf(8).hWall<=36,
    BIOMES.map(b=>b.name).join());
}

// ---- main.js split: the browser entry stays lean and import-clean, and the
// seams it used to inline (flags / attract / net pair / shell chrome /
// debug hook) are importable modules of their own. ----
{
  const L=readFileSync(join(ROOT,"src/main.js"),"utf8").split("\n");
  // plan 7: +2 lines (cabinetseen.js import + cabinetSeen/markCabinet opts)
  // for the first-visit-play wiring main.js alone can hold (app-layer persist).
  // final fix wave: +16 lines (coachT accumulator + reset, world.fireEdge
  // reset-run guard, autoplay markCabinet call, KeyC ATTRACT fallthrough,
  // hoisted drawShell getters) — bumped 622->640.
  // S1 settings-store wave: +11 lines (settings.js + fx.js imports, the
  // settings/applySettings closure boot-applies every knob, camPreset
  // re-applied after every resetOrbit, o.bright threaded into render opts)
  // — bumped 640->655.
  // S2 options-screen wave: +24 lines (menudraw settingsHit/layout import,
  // onSettings persist+apply wiring, the live-settings re-seed, the SETTINGS
  // tap router in canvas pointerdown) — bumped 655->679.
  // S3.1 pause-list wave: +64 lines (overlayBox/pauseHit import, onPauseCmd
  // handler, pauseView-aware onPause, the unconditional GAME app.update call,
  // pause render opts, the GAME-branch pointerdown router) — bumped 679->743.
  // closing fix wave: main.js untouched this wave, still measured (L.length,
  // this check's own convention) at 701; pin tightened 743->706 (measured
  // +5) so the gate keeps biting instead of trailing 42 lines of slack.
  // R7 stopwatch wave: +25 lines (times.js import; roomT/bestPrev
  // declarations + comment beside coachT; onStart and RESTART resets; the
  // WIN-edge record/reset block; the roomT accumulate line; ro.time in the
  // GAME ro literal) — bumped 706->731.
  // R7 MODES wave: +2 lines (timeAttack seed + onTimeAttack persist beside
  // pace/onPaceChange) — bumped 731->733.
  // R1 run-summary wave: +22 lines (bests.js import; isFinale on the CFG
  // import; the run-state declarations plus startRunState/endRun; startRunState
  // in onStart and pause RESTART; endRun in persistScore; the split edge block;
  // the feedTally line; ro.run) — bumped 733->755.
  // R1 fix wave (review Minor-3, owner ruling 2026-09-07): +5 lines
  // (runFromStart comment/declaration; startRunState/endRun/ro.run gain the
  // flag) — bumped 755->760. NOTE for R5/R3/R8/R10 implementers: this shifts
  // every downstream cap in the INDEX's line-budget row (main.js:715) by +5;
  // that row itself is intentionally NOT edited here (out of this fix wave's
  // authorized scope) — read this file's measured length, not the INDEX's
  // stale numbers, when bumping your own plan's cap.
  // R5 stats wave: +16 lines (stats.js import; session_start at boot; the
  // copyText helper replacing the inline clipboard pair; KeyC-on-STATS;
  // onStats; the STATS audio exclusion; the room_enter/room_clear/death/
  // run_end/score_set/plaque_unlock edges) — bumped 760->776.
  // R3 daily wave: +13 lines (daily.js import; the local todayStr beside the
  // UTC dateStr; dailyDate/dailyRec; app.dailyTag at boot; o.dailySeed; the
  // seed and daily stamp in onStart; the nb.daily.v1 write in endRun; ro.run's
  // three daily fields) — measured 774->787, against the wave's 788 cap.
  // R3 fix wave (review Minor-1/Minor-4, owner ruling 2026-09-07): net -1
  // line (bootSeed hoisted out of createWorld's call and remembered; onStart's
  // seed write is a ternary against it; endRun's record+tag write moved into
  // daily.js's finishDaily, one shared "today" param for both halves) —
  // measured 787->786.
  // R8 challenge-code wave: +11 lines (code.js import; the ?code= decode
  // comment + const chal + if(chal) boot branch; the KeyB copy block) —
  // measured 786->797, against the wave's 798 cap (11 lines of headroom left
  // for R10's 808).
  // R10 coach-v2 wave: +10 lines (three names on the coach.js import; the
  // coach2 state and its comment; the coach2Tick latch line; v1's coach_shown
  // and coach_dismissed emits; ro.coach2) — measured 797->807, against the
  // wave's 808 cap. The v2 transition itself lives in src/app/coach.js
  // precisely so this gate keeps biting.
  // R12 days-played wave: +0 lines (ld: todayStr() rides inside the three
  // existing room_enter literals) — measured 804, against the 808 cap.
  // R6 medals wave: +2 lines (medals.js import; the endRun settleMedals line;
  // isRunEnd, trophies, ro.run.md and the TROPHIES cue exclusion ride
  // existing lines) — measured 806, against the 808 cap.
  // R9a ghost wave: +3 lines (ghost.js import; const ghost; the ghostTick line
  // between the PLAY-only clock and the step loop, wave-3 spec §5.3/§8);
  // ro.ghost rides the time: line — measured 809, cap 808->812 (the wave's one raise).
  // R9b 3D ghost: +0 lines (the 3D path reads the same ro.ghost through
  // wrapper.js's pools.ghost) — measured 809, against the 812 cap.
  // Reset wave: +3 lines (reset.js import; the onReset opt; the onUiKey
  // disarm line; the KeyR-not-on-STATS gate rides the existing intercept,
  // wave-3 spec §7.3/§8) — measured 812, against the 812 cap.
  // D2 MENU tap wave: +0 lines (MENU rides the SETTINGS tap branch; menuHit
  // and ITEMS ride existing import lines) — measured 812, against the 812 cap.
  // C1 camera wave: +0 lines (the zoom reset rides the RESTART and the
  // (WIN|LOSE)->PLAY reset lines) — measured 812, against the 812 cap.
  // C2 fit wave: -17 lines (the fit block moved to src/app/fit.js mountFit)
  // — measured 795, cap 812->799 (T1's STATS tap branch is the planned +4).
  // T1 STATS tap wave: +4 lines (the STATS branch of the canvas pointerdown
  // chain; statsHit rides the menudraw import line) — measured 799, against
  // the 799 cap.
  // W2 first-frame zoom wave: net -1 line (+1 post-step-loop dist reset;
  // -2 as resetOrbit takes the preset dist) — measured 798, against the 799 cap.
  check("main.js stays a lean browser entry (<=799 lines)",
    L.length<=799,String(L.length));
  const lastImp=L.reduce((a,l,i)=>/^import[\s{]/.test(l)?i:a,-1);
  const firstDecl=L.findIndex(l=>/^(export\s|const\s|let\s|var\s|function\s|class\s)/.test(l));
  check("main.js keeps every import at the top (no mid-file import sprawl)",
    firstDecl<0||lastImp<firstDecl,
    "lastImport@"+(lastImp+1)+" firstDecl@"+(firstDecl+1));
}

// URL/opts flag parsing is pure over a search string (no location needed)
{
  const {readFlags}=await import("../src/app/flags.js");
  check("flags: ?render=3d selects the real-3D path",
    readFlags("?render=3d").urlKind==="3d");
  check("flags: ?render=iso pins the legacy dimetric path",
    readFlags("?render=iso").urlKind==="iso");
  check("flags: an unknown render value is ignored",
    readFlags("?render=4d").urlKind===null,
    String(readFlags("?render=4d").urlKind));
  check("flags: ?play=1 and opts.autoplay both autoplay, default off",
    readFlags("?play=1").autoplay===true
    &&readFlags("",{autoplay:true}).autoplay===true
    &&readFlags("").autoplay===false);
  check("flags: ?net=local arms the two-peer harness, default off",
    readFlags("?a=1&net=local").netLocal===true
    &&readFlags("").netLocal===false);
  check("flags: opts.orbit overrides the URL (explicit false wins)",
    readFlags("?orbit=1",{orbit:false}).orbit===false
    &&readFlags("?orbit=1").orbit===true
    &&readFlags("").orbit===false);
  check("flags: ?debug=1 or opts.debug opens the window hook",
    readFlags("?debug=1").debug===true
    &&readFlags("",{debug:true}).debug===true
    &&readFlags("").debug===false);
}

// ATTRACT demo harness as a module: CORE seed, pact-free, 20s cap rollover
{
  const {createDemo,stepDemo,DEMO_SEED,DEMO_CAP}=
    await import("../src/app/attract.js");
  check("attract: harness pinned to CORE seed 20260823 and a 20s cap",
    DEMO_SEED===20260823&&DEMO_CAP===20,DEMO_SEED+"/"+DEMO_CAP);
  const d=createDemo();
  check("attract: a fresh demo is a CORE pact-free level-1 PLAY world",
    d.cycle===1&&d.world.level===1&&d.world.state==="PLAY"
    &&d.world.heat===0&&(d.world.pact|0)===0&&d.world.seed===DEMO_SEED,
    d.world.level+"/"+d.world.state+"/"+d.world.heat);
  stepDemo(d,1/60);
  check("attract: stepDemo advances the demo world",d.world.time>0,
    String(d.world.time));
  d.t=DEMO_CAP-CFG.STEP/2;
  stepDemo(d,0.25);
  check("attract: the 20s cap rolls 1 -> 2 into a fresh CORE world",
    d.cycle===2&&d.world.level===2&&d.world.state==="PLAY"
    &&d.t<1&&d.world.heat===0,
    "cycle="+d.cycle+" lvl="+d.world.level+" t="+d.t.toFixed(3));
}

// ?net=local two-peer harness as a module (single-player proof, not netplay)
{
  const {createLocalPair}=await import("../src/net/localpair.js");
  const w=createWorld(1234,1); loadLevel(w,1,false); w.state="PLAY";
  const stub={intent:()=>({move:{x:0,y:0},fire:false,shift:false,
    remote:false,kick:false}),advance(){}};
  const pair=createLocalPair(w,stub);
  check("localpair: mirror peer B mirrors A's seed on level 1 PLAY",
    pair.wB.seed===w.seed&&pair.wB.level===1&&pair.wB.state==="PLAY",
    pair.wB.seed+"/"+pair.wB.level);
  for(let i=0;i<40;i++)pair.drive();
  check("localpair: drive() keeps both peers on the same tick",
    w.tick>0&&w.tick===pair.wB.tick,w.tick+"/"+pair.wB.tick);
}

// shell chrome view: the canvas/kind fallback box the shell draws into
{
  const {dims,kindSize}=await import("../src/render/shellview.js");
  check("shellview: a null canvas falls back to the classic logical box",
    dims(null,"2d").cw===CFG.COLS*CFG.TILE
    &&dims(null,"2d").ch===CFG.ROWS*CFG.TILE,
    dims(null,"2d").cw+"x"+dims(null,"2d").ch);
  check("shellview: kind iso falls back to the projected box",
    dims(null,"iso").cw===PROJ.canvasW&&dims(null,"iso").ch===PROJ.canvasH);
  check("shellview: a real canvas always wins over the fallback",
    dims({width:640,height:480},"iso").cw===640
    &&dims({width:640,height:480},"iso").ch===480);
  check("shellview: kindSize drives sizeCanvases per kind",
    kindSize("3d").w===CFG.COLS*CFG.TILE&&kindSize("3d").h===CFG.ROWS*CFG.TILE
    &&kindSize("iso").w===PROJ.canvasW&&kindSize("iso").h===PROJ.canvasH);
}

// debug hook: DOM-only seam that must stay silent under Node
{
  const {mountDebugHook}=await import("../src/app/debughook.js");
  check("debug hook: module exports a mount function",
    typeof mountDebugHook==="function");
  const noop=()=>{};
  const win={addEventListener:noop,removeEventListener:noop};
  globalThis.window=win;
  try{
    const g=createGame(null,{seed:71,debug:true});
    check("debug hook: opts.debug exposes __GAME__ over the live world",
      !!win.__GAME__&&win.__GAME__.G===g.world
      &&typeof win.__pause==="function"&&typeof win.__resume==="function");
    check("debug hook: state() names the shell screen outside GAME",
      win.__GAME__.state()==="INTRO",String(win.__GAME__.state()));
    win.__GAME__.begin();
    check("debug hook: begin() starts a run, state() then reports the world",
      win.__GAME__.state()==="PLAY",String(win.__GAME__.state()));
    // Nit-5 (review 2026-09-07): SCREEN.STATS was appended without extending
    // SCREEN_NAME; the hardened lookup must still name it, never undefined.
    g.app.screen=SCREEN.STATS;
    check("debug hook: state() names STATS explicitly, never undefined (Nit-5)",
      win.__GAME__.state()==="STATS",String(win.__GAME__.state()));
    // hardened fallback: a screen index past the end of SCREEN_NAME (a stand-in
    // for a future appended SCREEN the array has not caught up with yet) must
    // still name something, never undefined.
    g.app.screen=SCREEN.TROPHIES;
    check("debug hook: state() names TROPHIES (R6)",
      win.__GAME__.state()==="TROPHIES",String(win.__GAME__.state()));
    g.app.screen=99;
    check("debug hook: state() falls back to the raw index, never undefined, past the end of SCREEN_NAME (Nit-5)",
      win.__GAME__.state()==="99",String(win.__GAME__.state()));
   }finally{ delete globalThis.window; }
  const clean={addEventListener:noop,removeEventListener:noop};
  globalThis.window=clean;
  try{
    createGame(null,{seed:72});
    check("debug hook: without the flag window stays clean",
      !clean.__GAME__&&!clean.__pause);
   }finally{ delete globalThis.window; }
}

// KeyC: copy the run stamp only on WIN/LOSE inside GAME (real Input->onUiKey route)
{
  const calls=[];
  navigator.clipboard={writeText:(t)=>{calls.push(t);return Promise.resolve();}};
  try{
    const g=createGame(null,{seed:5,autoplay:true});
    g.world.state="WIN"; g.world.level=1; g.world.heat=0; g.world.score=0;
    g.input._onKey({code:"KeyC"});
    check("KeyC on WIN copies runStamp + play URL",
      calls.length===1&&calls[0]===copyPayload(g.world),JSON.stringify(calls));
    g.world.state="PLAY";
    g.input._onKey({code:"KeyC"});
    check("KeyC during PLAY copies nothing", calls.length===1);
    g.world.state="LOSE";
    g.input._onKey({code:"KeyC"});
    check("KeyC on LOSE copies runStamp + play URL",
      calls.length===2&&calls[1]===copyPayload(g.world));
    g.app.screen=SCREEN.MENU;
    g.world.state="WIN";
    g.input._onKey({code:"KeyC"});
    check("KeyC outside GAME is a no-op", calls.length===2);
   }finally{ delete navigator.clipboard; }
}

// MINOR 4: KeyC's GAME-only early return must not swallow ATTRACT's
// key-to-play path (any non-Escape/Backspace key on ATTRACT starts a run).
{
  const g=createGame(null,{seed:12});
  g.app.screen=SCREEN.ATTRACT;
  g.input._onKey({code:"KeyC"});
  check("KeyC on ATTRACT falls through to app.key and starts a CORE run",
    g.app.screen===SCREEN.GAME&&g.world.state==="PLAY"&&(g.world.heat|0)===0,
    g.app.screen+"/"+g.world.state);
}

// Reset my cabinet (wave-3 §7.3/§7.5): R reaches app.key on STATS only, a
// second R clears every CLEAR key and reloads once; any other key disarms.
{
  const {CLEAR_KEYS,KEEP_KEYS}=await import("../src/app/reset.js");
  const noop=()=>{};
  const mem={}, copies=[];
  let reloads=0;
  const fill=()=>{ for(const k of [...CLEAR_KEYS,...KEEP_KEYS]) mem[k]=k===KEEP_KEYS[1]?"2":"{}"; };
  globalThis.window={addEventListener:noop,removeEventListener:noop,
    localStorage:{getItem:(k)=>(k in mem?mem[k]:null),
      setItem:(k,v)=>{mem[k]=String(v);},removeItem:(k)=>{delete mem[k];}}};
  navigator.clipboard={writeText:(t)=>{copies.push(t);return Promise.resolve();}};
  try{
    const g=createGame(null,{seed:21});
    globalThis.location={search:"",reload:()=>{reloads++;}};
    const stats=()=>{ g.app.cabinetSeen=true; g.app.screen=SCREEN.MENU; g.app.cursor=6; g.app.confirm(); };
    const kept=()=>[...CLEAR_KEYS,...KEEP_KEYS].every((k)=>k in mem);
    fill(); stats();
    g.input._onKey({code:"KeyR"});
    check("Reset: R on STATS arms and clears nothing",
      g.app.screen===SCREEN.STATS&&g.app.resetArm===true&&kept()&&reloads===0,
      g.app.screen+"/"+g.app.resetArm+"/"+reloads);
    g.input._onKey({code:"KeyC"});
    check("Reset: C on an armed STATS disarms and still copies the stats",
      g.app.resetArm===false&&copies.length===1&&kept(),copies.length+"/"+g.app.resetArm);
    g.input._onKey({code:"KeyR"});
    check("Reset: R + C + R clears nothing and leaves the arm up again",
      g.app.resetArm===true&&kept()&&reloads===0,Object.keys(mem).join(","));
    g.input._onKey({code:"KeyM"});
    g.input._onKey({code:"KeyR"});
    check("Reset: R + M + R clears nothing (M is swallowed before app.key)",
      g.app.resetArm===true&&kept()&&reloads===0&&g.app.screen===SCREEN.STATS);
    g.input._onKey({code:"ArrowDown",preventDefault:noop});
    g.input._onKey({code:"KeyR"});
    check("Reset: an arrow key cancels, so the next R only arms",
      g.app.resetArm===true&&kept()&&reloads===0);
    g.input._onKey({code:"KeyR"});
    check("Reset: STATS + R + R clears every CLEAR key",
      CLEAR_KEYS.every((k)=>!(k in mem)),Object.keys(mem).join(","));
    check("Reset: STATS + R + R keeps both KEEP keys and reloads once",
      KEEP_KEYS.every((k)=>k in mem)&&reloads===1&&g.app.resetArm===false,
      Object.keys(mem).join(",")+"/"+reloads);
    fill(); stats();
    g.input._onKey({code:"KeyR"});
    g.input._onKey({code:"Escape"});
    check("Reset: Escape on an armed STATS backs out disarmed, nothing cleared",
      g.app.screen===SCREEN.MENU&&g.app.resetArm===false&&kept()&&reloads===1);
    const a=createGame(null,{seed:22,autoplay:true});
    a.cam.x=40; a.cam.zoom=2;
    a.input._onKey({code:"KeyR"});
    a.input._onKey({code:"KeyR"});
    check("Reset: R in GAME still resets the camera and never arms or clears",
      a.cam.x===0&&a.cam.zoom===1&&a.app.resetArm===false&&kept()&&reloads===1,
      JSON.stringify(a.cam)+"/"+a.app.resetArm);
    const t=createGame(null,{seed:23});
    t.app.screen=SCREEN.ATTRACT;
    t.input._onKey({code:"KeyR"});
    check("Reset: R on ATTRACT stays swallowed (screen stays ATTRACT)",
      t.app.screen===SCREEN.ATTRACT&&t.app.resetArm===false&&kept(),String(t.app.screen));
  }finally{ delete globalThis.window; delete globalThis.location; delete navigator.clipboard; }
}

// T1 (camera spec §4): MEDALS and Reset by TAP on STATS, through the REAL
// pointer path on a scaled canvas (CSS 300x260 over a 600x520 buffer, k=2).
// Buffer zone centres at 600x520: T MEDALS (183,478), R RESET (354,478),
// armed R AGAIN (159,478); (300,300) is off every label.
{
  const {CLEAR_KEYS,KEEP_KEYS}=await import("../src/app/reset.js");
  const noop=()=>{};
  const mem={};
  let reloads=0;
  const fill=()=>{ for(const k of [...CLEAR_KEYS,...KEEP_KEYS]) mem[k]="{}"; };
  const kept=()=>[...CLEAR_KEYS,...KEEP_KEYS].every((k)=>k in mem);
  globalThis.window={addEventListener:noop,removeEventListener:noop,
    localStorage:{getItem:(k)=>(k in mem?mem[k]:null),
      setItem:(k,v)=>{mem[k]=String(v);},removeItem:(k)=>{delete mem[k];}}};
  try{
    const cv=mkCamCanvas(600,520);
    cv.el.getBoundingClientRect=()=>({left:0,top:0,width:300,height:260});
    const g=createGame(cv.el,{seed:76});
    globalThis.location={search:"",reload:()=>{reloads++;}};
    const tap=(x,y)=>cv.fire("pointerdown",{clientX:x/2,clientY:y/2});
    const stats=()=>{ g.app.cabinetSeen=true; g.app.screen=SCREEN.MENU; g.app.cursor=6; g.app.confirm(); };
    fill(); stats();
    tap(183,478);
    check("T1 tap: the T MEDALS label on STATS opens the MEDALS page",
      g.app.screen===SCREEN.TROPHIES,String(g.app.screen));
    tap(300,300);
    check("T1 tap: a tap on MEDALS backs out to STATS",g.app.screen===SCREEN.STATS,String(g.app.screen));
    tap(354,478);
    check("T1 tap: the R RESET label arms and clears nothing",
      g.app.screen===SCREEN.STATS&&g.app.resetArm===true&&kept()&&reloads===0,
      g.app.screen+"/"+g.app.resetArm+"/"+reloads);
    tap(354,478);
    check("T1 tap: a second tap where RESET was lands off R AGAIN — disarmed, still STATS, nothing cleared",
      g.app.screen===SCREEN.STATS&&g.app.resetArm===false&&kept()&&reloads===0,
      g.app.screen+"/"+g.app.resetArm+"/"+reloads);
    tap(354,478); tap(300,300);
    check("T1 tap: RESET then an off-label tap disarms and stays on STATS",
      g.app.screen===SCREEN.STATS&&g.app.resetArm===false&&kept()&&reloads===0,
      g.app.screen+"/"+g.app.resetArm);
    tap(354,478); tap(159,478);
    check("T1 tap: RESET then R AGAIN clears every CLEAR key",
      CLEAR_KEYS.every((k)=>!(k in mem)),Object.keys(mem).join(","));
    check("T1 tap: RESET then R AGAIN keeps both KEEP keys and reloads once",
      KEEP_KEYS.every((k)=>k in mem)&&reloads===1&&g.app.resetArm===false,
      Object.keys(mem).join(",")+"/"+reloads);
    fill(); stats();
    tap(300,300);
    check("T1 tap: an idle off-label tap on STATS backs out to MENU",
      g.app.screen===SCREEN.MENU&&kept()&&reloads===1,String(g.app.screen));
  }finally{ delete globalThis.window; delete globalThis.location; }
}

// ---- P1 PAUSE list: every row's wave, and the score semantics they inherit ----
{
  const noop=()=>{};
  const mem={};
  globalThis.window={addEventListener:noop,removeEventListener:noop,
    localStorage:{getItem:(k)=>(k in mem?mem[k]:null),
      setItem:(k,v)=>{mem[k]=String(v);}}};
  try{
    {
      const g=createGame(null,{autoplay:true});
      g.input.onPause();
      check("P1 P pauses inside GAME and resets the list",
        g.world.state==="PAUSE"&&g.app.pauseCursor===0&&g.app.pauseView===0,
        g.world.state+"/"+g.app.pauseCursor+"/"+g.app.pauseView);
      check("P1 the shell stays GAME through PAUSE (music/HUD/touch gates)",
        g.app.screen===SCREEN.GAME,String(g.app.screen));
      g.loop(16);
      g.app.confirm();                        // row 0 RESUME
      check("P1 RESUME returns to PLAY",g.world.state==="PLAY",g.world.state);
    }
    {
      delete mem["nb.highscores.v1"];
      const g=createGame(null,{autoplay:true});
      g.world.score=1500; g.world.level=3;
      g.input.onPause(); g.loop(16);
      g.app.pauseCursor=1; g.app.confirm();   // RESTART
      check("P1 RESTART reloads L1 at PLAY with the score zeroed",
        g.world.level===1&&g.world.state==="PLAY"&&g.world.score===0,
        g.world.level+"/"+g.world.state+"/"+g.world.score);
      check("P1 RESTART BANKS the run first (the toolbar button lost it)",
        loadScores().some(r=>r.s===1500),
        JSON.stringify(loadScores().slice(0,3)));
    }
    {
      delete mem["nb.highscores.v1"];
      const g=createGame(null,{autoplay:true});
      g.world.score=1234;
      g.input.onPause(); g.loop(16);
      g.app.pauseCursor=3; g.app.confirm();   // QUIT TO MENU
      check("P1 QUIT lands on MENU with no PAUSE ghost",
        g.app.screen===SCREEN.MENU&&g.world.state==="PLAY",
        g.app.screen+"/"+g.world.state);
      check("P1 QUIT records the score exactly like KeyM",
        loadScores().some(r=>r.s===1234&&r.l===1),
        JSON.stringify(loadScores().slice(0,3)));
      delete mem["nb.highscores.v1"];
      const gMax=createGame(null,{autoplay:true});
      gMax.world.score=1234; gMax.world.heat=2;
      gMax.input.onPause(); gMax.loop(16);
      gMax.app.pauseCursor=3; gMax.app.confirm();
      check("P1 QUIT MAX persist stores s*3 and t=2",
        loadScores().some(r=>r.s===3702&&r.t===2&&r.l===1),
        JSON.stringify(loadScores().slice(0,3)));
    }
    {
      const g=createGame(null,{autoplay:true});
      g.input.onPause(); g.loop(16);
      g.app.pauseCursor=2; g.app.confirm();   // OPTIONS
      check("P1 OPTIONS opens inline — pauseView 1, shell still GAME",
        g.app.pauseView===1&&g.app.screen===SCREEN.GAME
        &&g.world.state==="PAUSE",
        g.app.pauseView+"/"+g.app.screen+"/"+g.world.state);
      g.app.optRow=6; g.app.confirm();
      check("P1 the paused page drives the SAME knob code",
        g.app.settings.shk===0,String(g.app.settings.shk));
      g.input.onPause();
      check("P1 P on the paused page returns to the LIST, never to play",
        g.app.pauseView===0&&g.world.state==="PAUSE",
        g.app.pauseView+"/"+g.world.state);
      g.input.onPause();
      check("P1 P on the list resumes",g.world.state==="PLAY",g.world.state);
    }
    {
      const g=createGame(null,{autoplay:true});
      g.input.onPause(); g.loop(16);
      g.input._onKey({code:"ArrowDown",preventDefault(){}});
      check("P1 ArrowDown taps down the pause list",g.app.pauseCursor===1,
        String(g.app.pauseCursor));
      g.app.pauseCursor=0;
      g.input._onKey({code:"ArrowUp",preventDefault(){}});
      check("P1 ArrowUp wraps to the last row",g.app.pauseCursor===3,
        String(g.app.pauseCursor));
      g.app.pauseView=1;
      g.input.onUiKey("KeyM");
      check("P1 KeyM quits from the OPTIONS view too",
        g.app.screen===SCREEN.MENU,String(g.app.screen));
    }
    {
      const g=createGame(null,{autoplay:true});
      g.input._onKey({code:"Space",preventDefault(){}});
      let t=0; g.loop(t); t+=20; g.loop(t);
      g.input.onPause();
      t+=20; g.loop(t);
      check("P1 a held fire across the PLAY->PAUSE edge does not confirm a row"
        +" (app.update runs every GAME frame, so prevConfirm never resets)",
        g.world.state==="PAUSE",g.world.state);
    }
   }finally{ delete globalThis.window; }
}

// ---- R12: DAYS PLAYED counts at room_enter, never from ATTRACT ----
{
  const noop=()=>{};
  const mem={"nb.cabinet.v1":"1"};
  globalThis.window={addEventListener:noop,removeEventListener:noop,
    localStorage:{getItem:(k)=>(k in mem?mem[k]:null),
      setItem:(k,v)=>{mem[k]=String(v);}}};
  const a=()=>loadStats().a;
  try{
    const g=createGame(null,{seed:21});
    check("R12 the pre-seeded cabinet boots seen, and the store is live",
      g.app.cabinetSeen===true&&a().sessions===1,JSON.stringify(a()));
    g.app.skip();
    let t=1000, i=0;
    while(g.app.screen!==SCREEN.ATTRACT&&i++<IDLE_T*70){ t+=16; g.loop(t); }
    check("R12 INTRO -> MENU -> idle lands on ATTRACT",g.app.screen===SCREEN.ATTRACT,String(g.app.screen));
    let held=true;
    for(let f=0;f<600;f++){ t+=16; g.loop(t); if(g.app.screen!==SCREEN.ATTRACT) held=false; }
    check("R12 600 ATTRACT frames count no day",
      held&&!!g.demo&&g.demo.world.time>0&&a().days===0&&a().day==="",JSON.stringify(a()));
    g.app.key("Enter");
    const p2=(n)=>(n<10?"0"+n:""+n), d0=new Date();
    const local=d0.getFullYear()+"-"+p2(d0.getMonth()+1)+"-"+p2(d0.getDate());
    check("R12 one PLAY run counts day 1 on the local date",
      g.app.screen===SCREEN.GAME&&a().days===1&&a().day===local,JSON.stringify(a())+"/"+local);
    const retry=()=>{ t+=16; g.loop(t); g.world.state="LOSE"; t+=16; g.loop(t);
      g.world.state="PLAY"; t+=16; g.loop(t); };
    retry();
    check("R12 a LOSE->PLAY retry on the same date stays at 1",a().days===1,JSON.stringify(a()));
    const old=()=>{ const v=JSON.parse(mem["nb.stats.v1"]); v.a.day="2000-01-01"; mem["nb.stats.v1"]=JSON.stringify(v); };
    old(); retry();
    check("R12 the LOSE->PLAY retry edge carries ld",a().days===2,JSON.stringify(a()));
    old(); g.input.onPause(); t+=16; g.loop(t); g.app.pauseCursor=1; g.app.confirm();
    check("R12 the pause RESTART edge carries ld",
      a().days===3&&g.world.state==="PLAY",JSON.stringify(a())+"/"+g.world.state);
  }finally{ delete globalThis.window; }
}

// ---- R6: medals settle only at a run end, never from ATTRACT, LOSE or a quit ----
{
  const noop=()=>{};
  const mem={"nb.cabinet.v1":"1","nb.pact.v1":"1"};
  const ls={getItem:(k)=>(k in mem?mem[k]:null),setItem:(k,v)=>{mem[k]=String(v);}};
  globalThis.window={addEventListener:noop,removeEventListener:noop,innerWidth:2000,innerHeight:1200,localStorage:ls};
  const K="nb.medals.v1";
  try{
    {
      const g=createGame(null,{seed:23});
      g.app.skip();
      let t=1000, i=0;
      while(g.app.screen!==SCREEN.ATTRACT&&i++<IDLE_T*70){ t+=16; g.loop(t); }
      let held=g.app.screen===SCREEN.ATTRACT;
      for(let f=0;f<600;f++){ t+=16; g.loop(t); if(g.app.screen!==SCREEN.ATTRACT) held=false; }
      check("R6 600 ATTRACT frames leave nb.medals.v1 absent",held&&!(K in mem),String(mem[K]));
    }
    {
      const g=createGame(null,{seed:24});
      g.app.skip(); g.app.startRun();
      let t=1000; t+=16; g.loop(t); g.world.state="LOSE"; t+=16; g.loop(t); t+=16; g.loop(t);
      check("R6 a staged LOSE writes nothing to nb.medals.v1",
        g.world.state==="LOSE"&&!(K in mem),g.world.state+"/"+mem[K]);
    }
    const stage68=(g,t,hurt)=>{
      g.app.skip(); g.app.level=6; g.app.heat=2; g.app.pact=0; g.app.pace=0; g.app.startRun();
      for(let lv=6;lv<=8;lv++){
        t+=16; g.loop(t);
        if(lv===6&&hurt){ g.world.lives-=1; t+=16; g.loop(t); }
        g.world.enemies.length=0;
        let n=0; while(g.world.state!=="WIN"&&n++<400){ t+=16; g.loop(t); }
        if(lv<8){ t+=16; g.loop(t); loadLevel(g.world,lv+1,true); g.world.state="PLAY"; t+=16; g.loop(t); }
      }
      t+=16; g.loop(t);
      return t;
    };
    {
      const g=createGame(null,{seed:25});
      g.app.skip(); g.app.level=6; g.app.heat=2; g.app.startRun();
      let t=1000; t+=16; g.loop(t);
      g.input.onPause(); t+=16; g.loop(t);
      g.app.pauseCursor=3; g.app.confirm();
      check("R6 a pause QUIT during a staged 6->8 run writes nothing",
        g.app.screen===SCREEN.MENU&&!(K in mem),g.app.screen+"/"+mem[K]);
    }
    {
      const cv=mkCamCanvas(600,520);
      const g=createGame(cv.el,{seed:26});
      check("R6 the pre-seeded pact unlock opens a room-6 start",g.app.pactUnlocked===true);
      stage68(g,1000,true);
      const fill=cv.calls.filter(c=>c[0]==="fillText").map(c=>String(c[1][0]));
      check("R6 the staged 6->8 run is a finale WIN at L8, MAX, pact 0, NORM",
        g.world.state==="WIN"&&g.world.level===8&&g.world.heat===2&&g.world.pact===0&&g.world.pace===0,
        g.world.state+"/"+g.world.level+"/"+g.world.heat);
      check("R6 a 6->8 MAX finale WIN with one life lost writes exactly IRON CROWN (bit 128)",
        mem[K]==="128",String(mem[K]));
      check("R6 the overlay announces MEDAL · IRON CROWN",
        fill.includes("MEDAL · IRON CROWN"),fill.filter(s=>/MEDAL|ROOMS/.test(s)).slice(-4).join("|"));
    }
  }finally{ delete globalThis.window; }
}

// ---- R9a: the ghost records only GAME clears, races a retry, and its tick
// sits BEFORE the step loop (pin 6b: a sim-internal room start records from
// roomT ~dt, never against the previous room's clock) ----
{
  const {ghostKey,decodeGhost,GHOST_KEY}=await import("../src/app/ghost.js");
  const {readdirSync}=await import("node:fs");
  const noop=()=>{};
  const mem={"nb.cabinet.v1":"1"};
  const ls={getItem:(k)=>(k in mem?mem[k]:null),setItem:(k,v)=>{mem[k]=String(v);}};
  globalThis.window={addEventListener:noop,removeEventListener:noop,localStorage:ls};
  const G=()=>JSON.parse(mem[GHOST_KEY]).g;
  try{
    {
      const g=createGame(null,{seed:31});
      g.app.skip();
      let t=1000, i=0;
      while(g.app.screen!==SCREEN.ATTRACT&&i++<IDLE_T*70){ t+=16; g.loop(t); }
      let held=g.app.screen===SCREEN.ATTRACT;
      for(let f=0;f<600;f++){ t+=16; g.loop(t); if(g.app.screen!==SCREEN.ATTRACT) held=false; }
      check("R9a 600 ATTRACT frames leave nb.ghost.v1 absent",held&&!(GHOST_KEY in mem),String(mem[GHOST_KEY]));
    }
    {
      const g=createGame(null,{seed:32});
      const seen=[];
      const r=g.renderer, rr=r.render;
      r.render=(w,dt,o)=>{ seen.push(o&&o.ghost); return rr(w,dt,o); };
      g.app.skip(); g.app.startRun();
      let t=1000;
      const X=(k)=>60+4*k, p=()=>g.world.players[0];
      const frames=(n)=>{ for(let f=0;f<n;f++){ t+=16; g.loop(t); } };
      const winOut=()=>{ g.world.enemies.length=0; let n=0;
        while(g.world.state!=="WIN"&&n++<400){ t+=16; g.loop(t); } t+=16; g.loop(t); };
      const fireUntil=(st)=>{ g.input.setIntent({fire:true}); let n=0;
        while(g.world.state===st&&n++<20){ t+=16; g.loop(t); } g.input.setIntent({fire:false}); };
      /* tag the player's x on every frame of the new room, so a sample names
         the frame it was taken on: sample 0 must be X(1), the first frame
         after the sim-internal reload (roomT one dt, <= 1/30). */
      const tagged=(n)=>{ for(let k=1;k<=n;k++){ p().x=X(k); t+=16; g.loop(t); } };
      frames(120); winOut();
      const k1=ghostKey(g.world);
      check("R9a a staged GAME room clear writes exactly one entry under the run's tuple",
        GHOST_KEY in mem&&JSON.stringify(Object.keys(G()))===JSON.stringify([k1])&&k1===(32+":1:0:0:1"),
        JSON.stringify(Object.keys(G())));
      const d1=G()[k1].d;
      g.world.state="LOSE"; frames(3);
      fireUntil("LOSE");
      const mark=seen.length;
      tagged(20);
      check("R9a the sim's LOSE->retry reloads room 1 in PLAY",g.world.state==="PLAY"&&g.world.level===1);
      check("R9a a LOSE->retry of room 1 races the stored ghost on its first PLAY frames",
        seen.slice(mark,mark+3).length===3&&seen.slice(mark,mark+3).every((x)=>x&&typeof x.x==="number"),
        JSON.stringify(seen.slice(mark,mark+3)));
      winOut();
      const e1=G()[k1], s1=decodeGhost(e1.s);
      check("R9a 6b the faster retry clear replaced the slower one",e1.d<d1,e1.d+"<"+d1);
      check("R9a 6b retry: s.length/5 === d + 1",e1.s.length/5===e1.d+1,e1.s.length/5+"/"+e1.d);
      check("R9a 6b retry: the first sample is the first PLAY frame's (roomT <= 1/30)",s1[0].x===X(1),s1[0].x);
      check("R9a 6b retry: sample 1 is not the spawn point",s1[1].x!==60,s1[1].x);
      fireUntil("WIN");
      check("R9a WIN -> next room is the sim's own reload",g.world.level===2&&g.world.state==="PLAY");
      tagged(20); winOut();
      const e2=G()[ghostKey(g.world)], s2=e2?decodeGhost(e2.s):[];
      check("R9a 6b next room: s.length/5 === d + 1",!!e2&&e2.s.length/5===e2.d+1,e2&&(e2.s.length/5+"/"+e2.d));
      check("R9a 6b next room: first sample at roomT <= 1/30, sample 1 off spawn",
        s2.length>1&&s2[0].x===X(1)&&s2[1].x!==60,s2.slice(0,2).map((s)=>s.x).join());
    }
    const core=(d)=>readdirSync(join(ROOT,d),{withFileTypes:true}).flatMap((e)=>
      e.isDirectory()?core(join(d,e.name)):e.name.endsWith(".js")?[join(d,e.name)]:[]);
    check("R9a src/core never imports src/app/ghost.js",
      core("src/core").every((f)=>!/ghost\.js/.test(readFileSync(join(ROOT,f),"utf8"))));
  }finally{ delete globalThis.window; }
}

console.log(fail? "HEADLESS FAIL":"HEADLESS OK");
process.exit(fail?1:0);
