import {SCREEN,ITEMS,IDLE_T,createMenuApp} from "../src/app/menuapp.js";
import {Input} from "../src/input.js";
import {createAudio} from "../src/audio.js";

let pass=0, fail=0;
function check(name, cond, detail){ cond?pass++:fail++;
  console.log((cond?"  PASS ":"  FAIL ")+name+(detail!==undefined?" -> "+detail:"")); }

// update() input contract: {input:{up,down,left,right}, confirmHeld:boolean}
function mkInput(held,confirmHeld){
  return {input:{up:!!(held&&held.up),down:!!(held&&held.down),
    left:!!(held&&held.left),right:!!(held&&held.right)},confirmHeld:!!confirmHeld};
}
function frames(app,n,dt,held,confirmHeld){
  const inp=mkInput(held,confirmHeld);
  for(let i=0;i<n;i++)app.update(dt,inp);
}
const DT=1/60;

// ---- surface & frozen enums ----
check("SCREEN frozen with BOOT..GAME", Object.isFrozen(SCREEN)
  &&SCREEN.BOOT===0&&SCREEN.INTRO===1&&SCREEN.MENU===2&&SCREEN.LEVEL===3
  &&SCREEN.HOWTO===4&&SCREEN.SCORES===5&&SCREEN.GAME===6, JSON.stringify(SCREEN));
check("ITEMS frozen, 6 entries", Object.isFrozen(ITEMS)&&ITEMS.length===6
  &&ITEMS[0]==="START GAME"&&ITEMS[5]==="HIGH SCORES", JSON.stringify(ITEMS));
{
  const a=createMenuApp();
  const surf=["screen","cursor","level","sound","render3d","subT","repT","repDir",
    "prevConfirm","update","key","confirm","back","skip","move","startRun",
    "noteWorldEdge","quitToMenu","toMenu"];
  check("surface complete (spec §7 + quitToMenu/toMenu)",
    surf.every(k=>k in a), surf.filter(k=>!(k in a)).join(","));
  check("fn-typed members", ["update","key","confirm","back","skip","move",
    "startRun","noteWorldEdge","quitToMenu","toMenu"].every(k=>typeof a[k]==="function"));
}

// ---- boot state ----
{
  const a=createMenuApp();
  check("boots into INTRO (BOOT folded)", a.screen===SCREEN.INTRO, a.screen);
  check("defaults: level 1, sound on, 2d, not inGame",
    a.level===1&&a.sound===true&&a.render3d===false&&a.inGame===false);
}
{
  const a=createMenuApp({autoplay:true});
  check("autoplay boots straight into GAME+inGame",
    a.screen===SCREEN.GAME&&a.inGame===true);
}
{
  const a=createMenuApp({level:9,sound:false,render3d:true});
  check("opts: level clamped 1..5, sound/render3d honored",
    a.level===5&&a.sound===false&&a.render3d===true);
}

// ---- intro skip paths ----
{
  const a=createMenuApp(); a.skip();
  check("skip(): INTRO->MENU", a.screen===SCREEN.MENU);
  check("skip() outside INTRO is no-op", a.skip()===false&&a.screen===SCREEN.MENU);
}
{
  const a=createMenuApp(); a.key("Enter");
  check("Enter in INTRO skips", a.screen===SCREEN.MENU);
}
{
  const a=createMenuApp(); a.key("Escape");
  check("Escape in INTRO skips", a.screen===SCREEN.MENU);
  const b=createMenuApp(); b.key("Backspace");
  check("Backspace in INTRO skips", b.screen===SCREEN.MENU);
}
{
  const a=createMenuApp(); frames(a,3,DT,null,true);
  check("confirmHeld rising edge in INTRO skips", a.screen===SCREEN.MENU);
}
{
  const codes=["ArrowUp","KeyW","ArrowDown","KeyS","ArrowLeft","KeyA",
    "ArrowRight","KeyD"];
  const results=codes.map(c=>{ const a=createMenuApp(); a.key(c); return a.screen; });
  check("all 8 direction codes skip INTRO (§4/§9.2 any-key)",
    results.every(s=>s===SCREEN.MENU), JSON.stringify(results));
}

// ---- menu cursor: wrap both directions ----
{
  const a=createMenuApp(); a.screen=SCREEN.MENU;
  a.move(-1); check("cursor wraps UP past top", a.cursor===ITEMS.length-1, a.cursor);
  a.move(1); check("cursor wraps back to 0", a.cursor===0);
  a.move(1); a.move(1);
  check("cursor advances down", a.cursor===2, a.cursor);
}
{
  const a=createMenuApp(); a.screen=SCREEN.MENU; a.key("ArrowUp");
  check("ArrowUp tap = cursor-1", a.cursor===ITEMS.length-1, a.cursor);
  const b=createMenuApp(); b.screen=SCREEN.MENU; b.key("KeyS");
  check("KeyS tap = cursor+1", b.cursor===1, b.cursor);
}

// ---- confirm dispatch per item ----
{
  let started=null;
  const a=createMenuApp({onStart:x=>{started=x;}}); a.screen=SCREEN.MENU;
  a.confirm();
  check("START GAME -> onStart({level}) + GAME + inGame",
    a.screen===SCREEN.GAME&&a.inGame===true&&started&&started.level===1
      &&typeof started.level==="number");
}
{
  const a=createMenuApp(); a.screen=SCREEN.MENU; a.cursor=1; a.confirm();
  check("LEVEL SELECT -> LEVEL screen", a.screen===SCREEN.LEVEL);
  const b=createMenuApp(); b.screen=SCREEN.MENU; b.cursor=4; b.confirm();
  check("HOW TO PLAY -> HOWTO", b.screen===SCREEN.HOWTO);
  const c=createMenuApp(); c.screen=SCREEN.MENU; c.cursor=5; c.confirm();
  check("HIGH SCORES -> SCORES", c.screen===SCREEN.SCORES);
}
{
  const a=createMenuApp(); a.screen=SCREEN.MENU; a.cursor=2;
  a.confirm(); check("RENDER toggles 2d->3d, stays MENU",
    a.render3d===true&&a.screen===SCREEN.MENU);
  a.confirm(); check("RENDER toggles back", a.render3d===false);
  const b=createMenuApp(); b.screen=SCREEN.MENU; b.cursor=3;
  b.confirm(); check("SOUND toggles flag, stays MENU",
    b.sound===false&&b.screen===SCREEN.MENU);
}
{
  let toggles=0;
  const fake={toggle(){toggles++;return false;}};
  const a=createMenuApp({audio:fake}); a.screen=SCREEN.MENU; a.cursor=3;
  a.confirm();
  check("SOUND with audio: flag synced to toggle() return",
    toggles===1&&a.sound===false);
}
{
  const a=createMenuApp(); a.screen=SCREEN.GAME;
  check("confirm() in GAME is no-op",
    a.confirm()===false&&a.screen===SCREEN.GAME);
}

// ---- confirm rising-edge discipline (held != double) ----
{
  let n=0;
  const a=createMenuApp({onStart:()=>{n++;}}); a.screen=SCREEN.MENU;
  frames(a,10,DT,null,true);
  check("holding confirm 10 frames starts exactly once", n===1, n);
}
{
  let n=0;
  const a=createMenuApp({onStart:()=>{n++;}});
  frames(a,2,DT,null,true);        // skip intro via held confirm
  frames(a,10,DT,null,true);       // keep holding through MENU
  check("Space held through skip does NOT auto-start", n===0&&a.screen===SCREEN.MENU,
    `n=${n} screen=${a.screen}`);
  a.update(DT,mkInput(null,false)); a.update(DT,mkInput(null,true));
  check("release+re-press confirms normally", n===1&&a.screen===SCREEN.GAME);
}

// ---- LEVEL select: clamp no-wrap, keys, repeat ----
{
  const a=createMenuApp(); a.screen=SCREEN.LEVEL; a.level=1;
  a.move(-1); check("slot clamps at 1 (no wrap)", a.level===1);
  a.level=5; a.move(1); check("slot clamps at 5 (no wrap)", a.level===5);
  a.move(-1); check("slot steps down from 5", a.level===4);
}
{
  const a=createMenuApp(); a.screen=SCREEN.LEVEL;
  a.key("ArrowRight"); a.key("KeyD");
  check("Right/D taps move slot to 3", a.level===3, a.level);
  a.key("ArrowLeft");
  check("Left tap moves slot to 2", a.level===2);
}
{
  const started=[];
  const a=createMenuApp({onStart:x=>started.push(x)}); a.screen=SCREEN.LEVEL; a.level=4;
  a.confirm();
  check("LEVEL confirm starts at chosen level",
    a.screen===SCREEN.GAME&&started.length===1&&started[0].level===4);
}
{
  const a=createMenuApp({onStart:()=>{}}); a.screen=SCREEN.LEVEL; a.level=2; a.confirm();
  a.toMenu(); a.screen=SCREEN.MENU; a.cursor=0; a.confirm();
  check("chosen level persists as Start Game default",
    a.level===2, a.level);
}

// ---- back-stack MENU <-> subscreens ----
{
  const a=createMenuApp(); a.screen=SCREEN.HOWTO;
  a.back(); check("back(): HOWTO->MENU", a.screen===SCREEN.MENU);
  check("back() at MENU root is no-op", a.back()===false&&a.screen===SCREEN.MENU);
}
{
  const a=createMenuApp(); a.screen=SCREEN.MENU; a.cursor=1; a.confirm();
  a.key("Escape");
  check("Esc pops LEVEL->MENU", a.screen===SCREEN.MENU);
  a.confirm();
  check("re-enter LEVEL after pop", a.screen===SCREEN.LEVEL);
  a.key("Backspace");
  check("Backspace pops too", a.screen===SCREEN.MENU);
}
{
  const a=createMenuApp(); a.screen=SCREEN.SCORES;
  a.confirm(); check("Enter/confirm in SCORES = back", a.screen===SCREEN.MENU);
  const b=createMenuApp(); b.screen=SCREEN.HOWTO;
  b.confirm(); check("Enter/confirm in HOWTO = back", b.screen===SCREEN.MENU);
}

// ---- cursor repeat timing (synthetic dt) ----
{
  const a=createMenuApp(); a.screen=SCREEN.MENU;
  frames(a,1,DT,{up:true});            // tap frame
  frames(a,3,DT,null);                 // release
  check("single tap = exactly 1 move", a.cursor===ITEMS.length-1, a.cursor);
}
{
  const a=createMenuApp(); a.screen=SCREEN.MENU; const c0=a.cursor;
  frames(a,20,DT,{up:true});
  check("hold 333ms: no repeat yet (still 1 move)", a.cursor===(c0+ITEMS.length-1)%ITEMS.length
    &&a.cursor===ITEMS.length-1, a.cursor-c0);
}
{
  const a=createMenuApp(); a.screen=SCREEN.MENU; const c0=a.cursor;
  frames(a,23,DT,{up:true});           // 383ms
  check("first repeat landed by 383ms (2 moves total)",
    Math.abs(a.cursor-c0)===2 || Math.abs(a.cursor-c0)===(ITEMS.length-2),
    "delta="+(((a.cursor-c0)%ITEMS.length+ITEMS.length)%ITEMS.length));
}
{
  const a=createMenuApp(); a.screen=SCREEN.MENU;
  const orig=a.move.bind(a); let moves=0;
  a.move=d=>{ if(orig(d))moves++; return true; };
  frames(a,60,DT,{down:true});         // 1s hold
  check("1s hold: 6..8 moves (350ms first, ~110ms cadence)",
    moves>=6&&moves<=8, moves);
}
{
  const a=createMenuApp(); a.screen=SCREEN.MENU; a.cursor=0;
  frames(a,30,DT,{down:true});         // tap + >=1 repeat
  const afterDown=a.cursor;
  a.update(DT,mkInput({down:false}));
  a.update(DT,mkInput({up:true}));
  check("direction switch re-taps immediately",
    a.cursor===(afterDown+ITEMS.length-1)%ITEMS.length, a.cursor);
}
{
  const a=createMenuApp(); a.screen=SCREEN.MENU; a.cursor=0;
  frames(a,10,DT,{down:true}); a.update(DT,mkInput());   // release
  const mid=a.cursor;
  frames(a,25,DT,{down:true});         // fresh hold 25 frames = 417ms
  const delta=((a.cursor-mid)%ITEMS.length+ITEMS.length)%ITEMS.length;
  check("release resets timer: fresh press = tap + 1 repeat max",
    delta>=1&&delta<=2, delta);
}
{
  const a=createMenuApp(); a.screen=SCREEN.LEVEL; a.level=1;
  frames(a,60,DT,{right:true});
  check("LEVEL hold-right clamps at 5", a.level===5, a.level);
}

// ---- key() tap + update() axis dedupe (wired-together contract) ----
{
  const a=createMenuApp(); a.screen=SCREEN.MENU; a.cursor=0;
  a.key("ArrowUp");
  frames(a,3,DT,{up:true});
  check("key() tap + held axis same frame = 1 move", a.cursor===ITEMS.length-1, a.cursor);
  a.update(DT,mkInput());
  a.key("ArrowUp");
  frames(a,3,DT,{up:true});
  check("second tap not swallowed (flags are per-press)",
    a.cursor===ITEMS.length-2, a.cursor);
}

// ---- GAME isolation ----
{
  const a=createMenuApp({autoplay:true});
  frames(a,5,DT,{up:true,down:true,left:true,right:true},true);
  check("GAME: update ignores axes+confirm (no cursor drift)",
    a.screen===SCREEN.GAME&&a.cursor===0);
  check("GAME: move()/confirm() no-ops",
    a.move(1)===false&&a.confirm()===false);
  check("GAME: Escape not handled by machine (onPause path)",
    a.key("Escape")===false);
  check("GAME: arrows inert via key()", a.key("ArrowUp")===false);
}

// ---- M-quit gating ----
{
  const a=createMenuApp({autoplay:true});
  check("quitToMenu('PLAY') rejected", a.quitToMenu("PLAY")===false
    &&a.screen===SCREEN.GAME);
  check("quitToMenu('PAUSE') accepted", a.quitToMenu("PAUSE")===true
    &&a.screen===SCREEN.MENU&&a.inGame===false);
}
{
  const a=createMenuApp();
  check("key('KeyM') outside GAME no-op", a.key("KeyM")===false
    &&a.screen===SCREEN.INTRO);
}
{
  const a=createMenuApp({autoplay:true});
  a.noteWorldEdge("PAUSE","PAUSE",null);
  check("key('KeyM') quits when world noted PAUSE",
    a.key("KeyM")===true&&a.screen===SCREEN.MENU);
}
{
  const a=createMenuApp({autoplay:true});
  a.noteWorldEdge("PLAY","PLAY",null);
  a.key("KeyM");
  check("key('KeyM') blocked while world PLAY", a.screen===SCREEN.GAME);
}

// ---- toMenu ----
{
  const a=createMenuApp({autoplay:true});
  check("toMenu() from GAME returns true", a.toMenu()===true
    &&a.screen===SCREEN.MENU&&a.inGame===false);
  check("toMenu() at MENU returns false", a.toMenu()===false);
}

// ---- noteWorldEdge: records exactly once on PLAY|WIN->LOSE ----
{
  const snap={s:1234,l:3,d:"2026-08-23"};
  const a=createMenuApp({autoplay:true});
  const e=a.noteWorldEdge("PLAY","LOSE",snap);
  check("PLAY->LOSE returns entry copy",
    e&&e.s===1234&&e.l===3&&e.d==="2026-08-23"&&e!==snap);
  check("WIN->LOSE also records",
    a.noteWorldEdge("WIN","LOSE",snap).s===1234);
  check("LOSE->LOSE (stay dead) -> null", a.noteWorldEdge("LOSE","LOSE",snap)===null);
  check("PLAY->WIN -> null (run continues, no record)",
    a.noteWorldEdge("PLAY","WIN",snap)===null);
  check("PAUSE->LOSE -> null", a.noteWorldEdge("PAUSE","LOSE",snap)===null);
  check("missing snapshot -> null", a.noteWorldEdge("PLAY","LOSE",null)===null);
}
{
  const snap={s:77,l:1,d:"2026-08-23"};
  const a=createMenuApp({autoplay:true});
  const seq=[["PLAY","PLAY"],["PLAY","LOSE"],["LOSE","LOSE"],["LOSE","LOSE"]];
  const got=seq.map(([p,c])=>a.noteWorldEdge(p,c,snap)).filter(Boolean);
  check("frame-polled sequence records EXACTLY once", got.length===1&&got[0].s===77,
    got.length);
}
{
  const a=createMenuApp({autoplay:true});
  a.noteWorldEdge("PLAY","PAUSE",null);
  check("noteWorldEdge latches worldState for key-M path",
    a.worldState==="PAUSE", a.worldState);
}
{
  const a=createMenuApp({autoplay:true});
  a.noteWorldEdge("PLAY","PLAY",null);
  a.noteWorldEdge("PLAY","LOSE",{s:500,l:2,d:"2026-08-23"});
  a.noteWorldEdge("LOSE","LOSE",{s:500,l:2,d:"2026-08-23"});
  check("worldState tracks latest", a.worldState==="LOSE", a.worldState);
}

// ---- repeat/timer state resets on transitions ----
{
  const a=createMenuApp(); a.screen=SCREEN.MENU; a.cursor=1; a.confirm();
  check("push resets subT/repeat", a.subT===0&&a.repT===0&&a.repDir===0, a.subT);
  frames(a,4,DT); check("update advances subT", a.subT>0, a.subT.toFixed(3));
}

// ---- input side-channel: onUiKey fires BEFORE the game switch ----
{
  const inp=new Input(null);
  const seen=[];
  inp.onUiKey=c=>seen.push(c);
  const pd=()=>{};
  inp._onKey({code:"KeyQ",preventDefault:pd});
  inp._onKey({code:"Space",preventDefault:pd});
  check("onUiKey receives every keydown code, in order",
    seen.join()==="KeyQ,Space", seen.join());
  check("game switch still ran after side-channel (remote+fire latched)",
    inp._intent.remote===true&&inp._intent.fire===true);
}
{
  const inp=new Input(null);
  const pd=()=>{};
  inp._onKey({code:"ArrowUp",preventDefault:pd});
  inp._onKey({code:"KeyP",preventDefault:pd});
  check("unset onUiKey: zero behavior change (axes + onPause intact)",
    inp.input.up===true);
}
{
  const inp=new Input(null);
  let n=0; inp.onUiKey=()=>n++;
  inp._onKeyUp({code:"Space"});
  check("keyup does NOT hit onUiKey (keydown-only channel)", n===0);
}

// ---- I3: OS key-repeat filter (repeats never re-dispatch UI or game logic) ----
{
  const inp=new Input(null);
  const seen=[]; inp.onUiKey=c=>seen.push(c);
  const pd=()=>{};
  inp._onKey({code:"ArrowDown",repeat:true,preventDefault:pd});
  check("I3 repeat keydown: onUiKey NOT dispatched", seen.length===0,
    JSON.stringify(seen));
  check("I3 repeat keydown does not latch axis", inp.input.down===false);
  inp._onKey({code:"ArrowDown",preventDefault:pd});
  check("I3 first press dispatches once + latches axis",
    seen.join()==="ArrowDown"&&inp.input.down===true);
  inp._onKey({code:"ArrowDown",repeat:true,preventDefault:pd});
  check("I3 held-key repeat does not re-dispatch", seen.length===1,
    JSON.stringify(seen));
  inp._onKeyUp({code:"ArrowDown"});
  check("I3 keyup clears axis normally", inp.input.down===false);
}
{
  const inp=new Input(null);
  const pd=()=>{};
  inp._onKey({code:"Space",repeat:true,preventDefault:pd});
  check("I3 fire repeat cannot CREATE fire latch", inp._intent.fire===false);
  inp._onKey({code:"Space",preventDefault:pd});
  inp._onKey({code:"Space",repeat:true,preventDefault:pd});
  check("I3 held fire stays latched through repeats", inp._intent.fire===true);
}

// ---- audio cue sheet (§5): jingle scheduling + muted guard ----
{
  const a=createAudio();
  const realST=globalThis.setTimeout;
  const calls=[]; const ids=[];
  globalThis.setTimeout=(fn,ms)=>{ calls.push(ms); ids.push(realST(()=>{},1e9)); return ids[ids.length-1]; };
  try{
    a.play("uiJingle");
    check("uiJingle unmuted: arpeggio 0/120/240/360ms + closer 480ms",
      calls.length===5&&calls[0]===0&&calls[1]===120&&calls[2]===240
        &&calls[3]===360&&calls[4]===480, JSON.stringify(calls));
    calls.length=0;
    a.toggle();                       // -> muted
    a.play("uiJingle");
    check("uiJingle muted: ZERO timers scheduled", calls.length===0);
    a.toggle();                       // -> unmuted
    calls.length=0;
    a.play("uiSel");
    check("uiSel schedules one 70ms follow-up",
      calls.length===1&&calls[0]===70, JSON.stringify(calls));
    calls.length=0;
    ["uiMove","uiBack","uiTog","uiDenied"].forEach(n=>a.play(n));
    check("simple cues are immediate beeps (no timers)", calls.length===0,
      JSON.stringify(calls));
  }finally{
    globalThis.setTimeout=realST;
    ids.forEach(id=>clearTimeout(id));
  }
}
{
  let ok=true;
  try{
    const a=createAudio();
    ["uiJingle","uiMove","uiSel","uiBack","uiTog","uiDenied"].forEach(n=>a.play(n));
  }catch(e){ ok=false; }
  check("all six cues headless no-throw (createAudio importable/instantiable)", ok);
}

// ---- ATTRACT (spec §1): idle bookkeeping, entry/exit, guards ----
{
  check("SCREEN.ATTRACT appended =7, still frozen",
    Object.isFrozen(SCREEN)&&SCREEN.ATTRACT===7, JSON.stringify(SCREEN));
  check("indices stable", SCREEN.BOOT===0&&SCREEN.INTRO===1&&SCREEN.MENU===2
    &&SCREEN.LEVEL===3&&SCREEN.HOWTO===4&&SCREEN.SCORES===5&&SCREEN.GAME===6);
  check("IDLE_T exported =10", IDLE_T===10);
}
{
  const a=createMenuApp(); a.screen=SCREEN.MENU; a.cursor=3;
  frames(a,594,DT);                       // 9.90s of empty updates
  check("9.9s idle stays MENU (below threshold)",
    a.screen===SCREEN.MENU&&a.idleT<IDLE_T,a.idleT.toFixed(2));
  frames(a,12,DT);                        // +0.20s -> crosses 10s mid-window
  check(">=10s idle enters ATTRACT; cursor preserved; timers reset",
    a.screen===SCREEN.ATTRACT&&a.cursor===3&&a.subT<=12*DT&&a.repT===0
      &&a.repDir===0,a.cursor+"/"+a.subT.toFixed(3));
  frames(a,120,DT,{down:true});           // held axes in ATTRACT
  check("axes ignored in ATTRACT: no exit, no cursor drift",
    a.screen===SCREEN.ATTRACT&&a.cursor===3);
  check("subT still advances in ATTRACT (hint blink)", a.subT>0,
    a.subT.toFixed(2));
  const b=createMenuApp();
  check("exitAttract() outside ATTRACT is false no-op",
    b.exitAttract()===false&&b.screen===SCREEN.INTRO);
  check("key(any code incl KeyM) exits to MENU + resets idle",
    a.key("KeyM")===true&&a.screen===SCREEN.MENU&&a.idleT===0);
  check("cursor survived the attract round-trip", a.cursor===3);
  a.key("Escape");                        // at MENU now: plain back no-op
  check("post-exit Escape at MENU does not bounce", a.screen===SCREEN.MENU);
  frames(a,601,DT);                       // idle again -> re-enter
  check("idle re-entry after exit works", a.screen===SCREEN.ATTRACT);
  check("confirm() exits ATTRACT (pointer path calls confirm today)",
    a.confirm()===true&&a.screen===SCREEN.MENU);
}
{
  const a=createMenuApp(); a.screen=SCREEN.LEVEL; a.level=1;
  frames(a,700,DT);                       // 11.7s parked outside MENU
  check("idleT reset outside MENU blocks entry from LEVEL",
    a.screen===SCREEN.LEVEL,a.screen);
}
{
  const a=createMenuApp({autoplay:true});
  frames(a,700,DT,{up:true},true);
  check("GAME branch never accumulates idle nor enters ATTRACT",
    a.screen===SCREEN.GAME&&a.idleT===0);
}

// ---- togT flip timestamp (toggle-flash §3): set on RENDER/SOUND flip only ----
{
  const a=createMenuApp(); a.screen=SCREEN.MENU;
  check("togT exposed, sentinel -1 before any flip", a.togT===-1,a.togT);
  frames(a,10,DT);                        // subT = 10/60
  const tAt=a.subT;
  a.cursor=2; a.confirm();                // RENDER flip
  check("RENDER flip stamps togT=subT and flips render3d",
    a.togT===tAt&&a.render3d===true,a.togT+" vs "+tAt);
  const tHold=a.togT;
  frames(a,7,DT);
  a.move(1);
  check("frames+move (non-toggle menu actions) leave togT untouched",
    a.togT===tHold&&a.screen===SCREEN.MENU,a.togT);
}
{
  const a=createMenuApp({autoplay:true}); // boots straight into GAME
  a.screen=SCREEN.MENU; a.inGame=false;
  frames(a,20,DT);
  a.cursor=3; a.confirm();                // SOUND flip
  const tSnd=a.togT;
  check("SOUND flip stamps togT=subT", tSnd===a.subT,tSnd+"/"+a.subT);
  a.move(1); a.move(-1);
  check("move() leaves togT untouched", a.togT===tSnd);
  frames(a,5,DT);
  a.cursor=2; a.confirm();
  check("second flip re-stamps togT to the new subT",
    a.togT===a.subT&&a.togT>tSnd,a.togT+"/"+tSnd);
  a.cursor=4; a.confirm();                // push HOWTO (subT reset site)
  check("screen transition clears togT sentinel (stale-flash guard)",
    a.screen===SCREEN.HOWTO&&a.togT===-1,a.togT);
}

console.log("\n  MENUAPP RESULT: "+pass+" PASS / "+fail+" FAIL");
process.exit(fail?1:0);
