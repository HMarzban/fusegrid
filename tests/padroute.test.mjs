import {readFileSync} from "node:fs";
/* T7: the pad router, on the real Input and the real poller over a fake getGamepads.
   The shell is a fake whose onPause mutates the world as main.js does, so the layer really flips. */
import {Input} from "../src/input.js";
import {createPad} from "../src/app/gamepad.js";
import {createPadRouter,layerOf} from "../src/app/padroute.js";
import {SCREEN as REAL,createMenuApp} from "../src/app/menuapp.js";
import {DEF_CONTROLS,DEF_PAD} from "../src/app/controls.js";
import {step,createWorld,loadLevel} from "../src/core/sim.js";
import {CFG} from "../src/core/config.js";

let pass=0, fail=0;
function check(name, cond, detail){ cond?pass++:fail++;
  console.log((cond?"  PASS ":"  FAIL ")+name+(detail!==undefined?" -> "+detail:"")); }

const SCREEN={...REAL,CONTROLS:16};
const S=0,E=1,W=2,N=3,SHL=4,SHR=5,SELECT=8,START=9,DU=12,DD=13;
const rawPad=()=>({connected:true,mapping:"standard",axes:[0,0,0,0],
  buttons:Array.from({length:16},()=>({pressed:false,value:0}))});
const fakePage=(cap)=>{const log=[];return {log,capturing:!!cap,taken:false,
  feedBtn(id,t){log.push(id);return this.capturing||this.taken;}};};

/* A settled rig: the pad was already seen, unless first is set. */
function rig(o={}){
  const raw={list:o.first?[null]:[rawPad()]};
  const pad=createPad({getGamepads:()=>raw.list});
  const input=new Input(null);
  const world={state:o.state||"PLAY"};
  const app={screen:o.screen===undefined?SCREEN.GAME:o.screen,pauseView:o.view||0};
  const ui=[];let pauses=0;
  const binds=o.binds||DEF_CONTROLS;
  const onPause=()=>{pauses++;if(app.screen!==SCREEN.GAME)return;
    if(app.pauseView){app.pauseView--;return;}
    if(world.state==="PLAY")world.state="PAUSE";else if(world.state==="PAUSE")world.state="PLAY";};
  const onUiKey=o.onUiKey?(c)=>{ui.push(c);o.onUiKey(c,app,world);}:(c)=>ui.push(c);
  const r=createPadRouter({input,app,SCREEN,binds:()=>binds,world:()=>world,onPause,onUiKey,page:o.page||null});
  let t=0;
  const run=()=>r.route(pad.poll(t+=16),t);
  if(!o.first)run();
  const p=()=>raw.list[0];
  return {raw,pad,input,world,app,ui,r,run,binds,get pauses(){return pauses;},
    dn:(...b)=>{for(const i of b)p().buttons[i]={pressed:true,value:1};return run();},
    up:(...b)=>{for(const i of b)p().buttons[i]={pressed:false,value:0};return run();},
    stick:(x,y)=>{p().axes[0]=x;p().axes[1]=y;return run();}};
}
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const moved=(inp)=>{const m=inp.intent().move;return m.x||m.y;};
const fires=(inp,n)=>{let s="";for(let k=0;k<n;k++){s+=inp.intent().fire?"1":"0";inp.advance();}return s;};

// ---- layerOf ----
{
  const w=(state)=>({state});
  check("layerOf: GAME + PLAY + no inline page is play",layerOf({screen:REAL.GAME,pauseView:0},w("PLAY"))==="play");
  check("layerOf: the backdrop PLAY on MENU is menu",layerOf({screen:REAL.MENU,pauseView:0},w("PLAY"))==="menu");
  check("layerOf: ATTRACT's PLAY is menu",layerOf({screen:REAL.ATTRACT,pauseView:0},w("PLAY"))==="menu");
  check("layerOf: PAUSE, WIN, LOSE are menu",["PAUSE","WIN","LOSE"].every((s)=>layerOf({screen:REAL.GAME,pauseView:0},w(s))==="menu"));
  check("layerOf: an inline page is menu",layerOf({screen:REAL.GAME,pauseView:1},w("PLAY"))==="menu");
}

// ---- PLAY layer ----
{
  const x=rig();x.dn(S);const on=x.input._intent.fire;
  x.input.advance();x.up(S);
  check("PLAY: SOUTH sets fire, release clears it",on===true&&x.input._intent.fire===false);
  check("PLAY: SOUTH never reaches the shell",x.ui.length===0);
}
{
  const x=rig();x.input.gate={canThrow:()=>false};
  const w=createWorld(4242,1);loadLevel(w,1,false);w.state="PLAY";x.world.state="PLAY";
  w.players[0].throw=false;
  x.dn(W);let any=false;
  for(let k=0;k<6;k++){const i=x.input.intent();any=any||i.fire||i.shift;step(w,CFG.STEP,{0:i});x.input.advance();}
  check("PLAY: WEST with no throw power does nothing and plants nothing",!any&&w.bombs.filter((b)=>!b.dead).length===0);
}
{
  const x=rig();x.input.gate={canThrow:()=>true};
  x.dn(W);const i=x.input.intent();
  check("PLAY: WEST with the power throws (one shift + fire tick)",i.fire===true&&i.shift===true);
  x.input.advance();
  check("PLAY: the throw lasts one tick",x.input.intent().fire===false&&x.input.intent().shift===false);
}
{
  const x=rig();x.input.gate={canThrow:()=>true};
  x.dn(S);x.input.advance();x.input.advance();
  x.dn(W);
  let seq="";
  for(let k=0;k<4;k++){const i=x.input.intent();seq+=i.fire?(i.shift?"T":"F"):"0";x.input.advance();x.run();}
  check("PLAY: thumb roll SOUTH to WEST: fire drops, then one throw edge",seq==="0T00",seq);
  x.up(W);x.run();
  check("PLAY: thumb roll: SOUTH is spent until released",x.input.intent().fire===false);
  x.up(S);x.dn(S);
  check("PLAY: thumb roll: a new SOUTH plants again",x.input.intent().fire===true);
}
{
  const x=rig();x.input.gate={canThrow:()=>true};
  x.dn(S,W);
  const a=x.input.intent();const first=a.fire&&!a.shift;
  x.input.advance();x.run();
  let throws=0;for(let k=0;k<4;k++){const i=x.input.intent();if(i.fire&&i.shift)throws++;x.input.advance();x.run();}
  check("PLAY: same-poll SOUTH + WEST: bomb first, then one throw",first&&throws===1,throws);
}
{
  const binds={...DEF_CONTROLS,pad:{BOMB:"N",THROW:"W",REMOTE:"E",PAUSE:"SELECT"}};
  const x=rig({binds});x.input.gate={canThrow:()=>true};
  x.dn(W,N);
  const a=x.input.intent();
  check("PLAY: bomb goes first whatever the button order",a.fire===true&&a.shift===false);
}
{
  const x=rig();x.input.setIntent({});x.input._latch("fire","key",true);x.input.gate={canThrow:()=>true};
  x.input.advance();x.dn(W);
  const i=x.input.intent();
  check("PLAY: WEST with fire held by a key stays a no-op",i.fire===true&&i.shift===false);
}
{
  const x=rig();x.dn(E);
  check("PLAY: EAST is REMOTE, never Escape",x.input._intent.remote===true&&x.ui.length===0&&x.pauses===0);
  x.input.advance();x.up(E);
  check("PLAY: EAST release clears REMOTE",x.input._intent.remote===false);
}
{
  const x=rig();x.input.gate={canThrow:()=>true};
  x.input._latch("remote","key",true);x.dn(E);x.input.advance();x.up(E);
  check("PLAY: pad release leaves a key-held REMOTE",x.input._intent.remote===true);
}
{
  const x=rig();x.dn(START);
  check("PLAY: START pauses",x.world.state==="PAUSE"&&x.pauses===1);
  x.up(START);
  check("PLAY: START release does not toggle",x.world.state==="PAUSE"&&x.pauses===1);
  const y=rig();y.dn(SELECT);
  check("PLAY: the bound SELECT pauses",y.world.state==="PAUSE");
  const z=rig({binds:{...DEF_CONTROLS,pad:{...DEF_PAD,PAUSE:"N"}}});
  z.dn(SELECT);const sel=z.world.state;z.up(SELECT);z.dn(N);
  check("PLAY: PAUSE follows its bind",sel==="PLAY"&&z.world.state==="PAUSE");
  const q=rig();q.dn(START,SELECT);
  check("PLAY: START + SELECT in one poll pause once",q.pauses===1);
  const v=rig();v.dn(S,START);
  check("PLAY: SOUTH + START in one poll: paused, no plant",v.pauses===1&&v.input._intent.fire===false);
}
{
  const x=rig();x.dn(DU);
  check("PLAY: D-PAD moves through gpMove",x.input.intent().move.y===-1);
  x.up(DU);x.input.advance();
  check("PLAY: D-PAD release stops",!moved(x.input));
  x.stick(0.26,0);
  check("PLAY: stick past 0.25 moves",x.input.intent().move.x===1);
  x.stick(0.1,0);
  check("PLAY: stick back stops",(x.input.advance(),!moved(x.input)));
  check("PLAY: no direction reaches the shell",x.ui.length===0);
}

// ---- the menu layer ----
{
  const x=rig({screen:SCREEN.MENU});x.dn(S);
  check("backdrop PLAY on MENU: SOUTH is Enter, never fire",eq(x.ui,["Enter"])&&x.input._intent.fire===false);
  x.up(S);x.dn(START);
  check("MENU: START is Enter too, one each",eq(x.ui,["Enter","Enter"])&&x.input._intent.fire===false);
  const y=rig({screen:SCREEN.MENU});y.dn(S,START);
  check("MENU: SOUTH + START in one poll confirm once",eq(y.ui,["Enter"]));
  const z=rig({screen:SCREEN.MENU});z.dn(E);
  check("backdrop PLAY on MENU: EAST is Escape, never REMOTE",eq(z.ui,["Escape"])&&z.input._intent.remote===false);
  const w=rig({screen:SCREEN.MENU});w.dn(W,N);
  check("MENU: WEST and NORTH do nothing",w.ui.length===0&&w.input._intent.fire===false);
  const k=rig({screen:SCREEN.MENU});k.input.gate={canThrow:()=>true};k.dn(W);
  check("backdrop PLAY on MENU: WEST never throws",k.input._intent.fire===false);
  const h=rig({screen:SCREEN.MENU});h.dn(S);h.input.advance();
  let ticks=0;for(let i=0;i<30;i++){h.run();if(h.input.intent().fire)ticks++;h.input.advance();}
  check("MENU: a held SOUTH confirms once",eq(h.ui,["Enter"])&&ticks===0);
}
{
  const app=createMenuApp({autoplay:false});app.skip();
  const world={state:"PLAY"},input=new Input(null);
  const raw={list:[rawPad()]},pad=createPad({getGamepads:()=>raw.list});
  const r=createPadRouter({input,app,SCREEN:REAL,binds:()=>DEF_CONTROLS,world:()=>world,onPause(){},onUiKey:(c)=>app.key(c),page:null});
  let t=0;const run=()=>r.route(pad.poll(t+=16),t);run();
  const tap=(i)=>{raw.list[0].buttons[i]={pressed:true,value:1};run();raw.list[0].buttons[i]={pressed:false,value:0};run();};
  tap(E);
  check("MENU (real shell): EAST on root MENU does nothing",app.screen===REAL.MENU);
  app.cursor=1;tap(S);
  check("MENU (real shell): SOUTH opens LEVEL SELECT",app.screen===REAL.LEVEL);
  tap(E);
  check("MENU (real shell): EAST on a page backs out",app.screen===REAL.MENU);
}
{
  const x=rig({state:"PAUSE"});x.dn(S);
  check("PAUSE list: SOUTH confirms",eq(x.ui,["Enter"])&&x.pauses===0&&x.world.state==="PAUSE");
  const y=rig({state:"PAUSE"});y.dn(E);
  check("PAUSE list: EAST resumes",y.pauses===1&&y.world.state==="PLAY"&&y.ui.length===0);
  const z=rig({state:"PAUSE"});z.dn(START);
  check("PAUSE list: START resumes",z.pauses===1&&z.world.state==="PLAY"&&z.ui.length===0);
  const q=rig({state:"PAUSE"});q.dn(SELECT);
  check("PAUSE list: the bound PAUSE resumes, as the key does",q.pauses===1&&q.world.state==="PLAY");
  const b=rig({state:"PAUSE",binds:{...DEF_CONTROLS,pad:{BOMB:"E",THROW:"W",REMOTE:"N",PAUSE:"S"}}});b.dn(S);
  check("PAUSE list: a SOUTH rebound as PAUSE confirms, nothing more",eq(b.ui,["Enter"])&&b.pauses===0);
  for(const v of [1,2,3]){
    const u=rig({state:"PAUSE",view:v});u.dn(E);
    check("PAUSE view "+v+": EAST steps back, never to play",u.app.pauseView===v-1&&u.world.state==="PAUSE"&&u.pauses===1);
  }
  const o=rig({state:"PAUSE",view:1});o.dn(S);
  check("PAUSE view 1: SOUTH is Enter",eq(o.ui,["Enter"]));
}
{
  for(const st of ["WIN","LOSE"]){
    const x=rig({state:st});x.dn(S);
    check(st+": SOUTH = Enter once",eq(x.ui,["Enter"])&&x.input._intent.fire===false);
    x.run();x.run();
    check(st+": held SOUTH stays one Enter",x.ui.length===1);
    const y=rig({state:st});y.dn(START);
    check(st+": START = Enter, no pause",eq(y.ui,["Enter"])&&y.pauses===0);
    const z=rig({state:st});z.dn(E);
    check(st+": EAST nothing",z.ui.length===0&&z.pauses===0&&z.input._intent.remote===false);
  }
}
{
  const binds={...DEF_CONTROLS,pad:{BOMB:"E",THROW:"W",REMOTE:"S",PAUSE:"SELECT"}};
  const x=rig({screen:SCREEN.LEVEL,binds});x.dn(E);
  check("rebinding BOMB to EAST leaves menu EAST = back",eq(x.ui,["Escape"])&&x.input._intent.fire===false);
  const y=rig({screen:SCREEN.LEVEL,binds});y.dn(S);
  check("rebinding BOMB to EAST leaves menu SOUTH = confirm",eq(y.ui,["Enter"]));
  const z=rig({binds});z.dn(E);
  check("rebinding BOMB to EAST plants with EAST in play",z.input._intent.fire===true&&z.ui.length===0);
}

// ---- the swallow rule ----
{
  const x=rig({screen:SCREEN.MENU,onUiKey:(c,app)=>{if(c==="Enter")app.screen=SCREEN.GAME;}});
  x.dn(S);x.input.advance();x.run();x.run();
  check("a SOUTH that starts a run plants no bomb",x.input._intent.fire===false&&x.ui.length===1);
  x.up(S);x.input.advance();
  x.dn(S);
  check("a new SOUTH in the run plants",x.input._intent.fire===true);
}
{
  const x=rig();x.dn(S);
  x.world.state="PAUSE";x.run();
  check("a SOUTH held when the layer flips to PAUSE is not a confirm",x.ui.length===0);
  x.input.advance();x.run();
  check("the flip drops the fire latch",x.input._intent.fire===false);
  x.world.state="PLAY";x.run();x.run();
  check("a SOUTH held when the layer flips back is ignored until released",x.input._intent.fire===false);
  x.up(S);x.input.advance();x.dn(S);
  check("released and pressed again it plants",x.input._intent.fire===true);
}
{
  const x=rig({state:"PAUSE",onUiKey:(c,app,w)=>{if(c==="Enter")w.state="PLAY";}});
  x.dn(S);x.run();x.run();
  check("a SOUTH that confirms RESUME plants nothing",x.world.state==="PLAY"&&x.input._intent.fire===false);
}
{
  const x=rig({onUiKey:()=>{}});
  x.dn(START);const st=x.world.state;x.run();x.run();
  check("a START that pauses does not resume itself",st==="PAUSE"&&x.world.state==="PAUSE"&&x.pauses===1);
}
{
  const x=rig();x.dn(E);
  x.world.state="PAUSE";x.input.advance();x.run();
  check("the flip drops the REMOTE latch",x.input._intent.remote===false);
}
{
  const x=rig();x.dn(DU);x.world.state="PAUSE";x.run();x.run();
  check("a direction held into PAUSE sends no tap",x.ui.length===0);
  x.input.advance();
  check("a direction held into PAUSE leaves no held axis",!x.input.axes.up);
  x.up(DU);x.dn(DD);
  check("after a release the direction walks",eq(x.ui,["ArrowDown"])&&x.input.axes.down===true);
}
{
  const x=rig({state:"PAUSE"});x.dn(DU);
  x.world.state="PLAY";x.run();
  check("a direction held on resume walks, as a held key does",x.input.intent().move.y===-1);
}

{
  const x=rig({binds:{...DEF_CONTROLS,pad:{BOMB:"N",THROW:"W",REMOTE:"E",PAUSE:"S"}}});
  x.dn(S);x.run();x.run();
  check("a SOUTH rebound as PAUSE does not also confirm RESUME",x.world.state==="PAUSE"&&x.ui.length===0&&x.pauses===1);
}
{
  const x=rig({screen:SCREEN.MENU,onUiKey:(c,app)=>{if(c==="Enter")app.screen=SCREEN.GAME;}});
  x.dn(DD);x.dn(S);x.run();
  check("a D-PAD held on MENU when SOUTH starts the run walks, as a held key does",x.input.intent().move.y===1&&x.input._intent.fire===false);
}

// ---- directions in menus ----
{
  const x=rig({screen:SCREEN.MENU});x.stick(0.6,0);
  check("stick edge sends one arrow tap and sets held",eq(x.ui,["ArrowRight"])&&x.input.axes.right===true);
  x.run();x.run();
  check("a held stick stays one tap",x.ui.length===1);
  const y=rig({screen:SCREEN.MENU});y.stick(0.49,0);
  check("below max(dead,0.5) sends none",y.ui.length===0&&y.input.axes.right===false);
  const z=rig({screen:SCREEN.MENU});z.dn(DD);
  check("D-PAD on MENU taps once and holds",eq(z.ui,["ArrowDown"])&&z.input.axes.down===true);
  z.up(DD);
  check("D-PAD release drops the held axis",z.input.axes.down===false&&z.ui.length===1);
  const q=rig({screen:SCREEN.MENU});q.dn(DD);q.up(DD);q.input.advance();
  check("a menu tap leaves no latch for the first tick of a run",!moved(q.input));
}

// ---- INTRO and ATTRACT ----
{
  for(const [nm,scr] of [["INTRO",SCREEN.INTRO],["ATTRACT",SCREEN.ATTRACT]]){
    const x=rig({screen:scr});const e=x.stick(0.9,0);
    check(nm+" ignores the stick",x.ui.length===0&&x.input.axes.right===false&&e.edge===false);
    for(const [b,nb] of [[S,"SOUTH"],[START,"START"],[DU,"D-PAD"],[N,"NORTH"]]){
      const y=rig({screen:scr});const r=y.dn(b);
      check(nm+" honours "+nb,eq(y.ui,["Enter"])&&r.edge===true&&y.input._intent.fire===false);
    }
    const m=rig({screen:scr});m.dn(S,W);
    check(nm+": two buttons in one poll act once",m.ui.length===1);
  }
  const x=rig({screen:SCREEN.ATTRACT});x.dn(E);
  check("ATTRACT: EAST leaves through Escape",eq(x.ui,["Escape"]));
  const y=rig({screen:SCREEN.INTRO});y.dn(E);
  check("INTRO: EAST counts as any button",eq(y.ui,["Enter"]));
  const z=rig({screen:SCREEN.ATTRACT,onUiKey:(c,app)=>{app.screen=SCREEN.GAME;}});
  z.dn(DU);z.run();
  check("the D-PAD that leaves ATTRACT does not walk the run",!moved(z.input));
  const u=rig({screen:SCREEN.INTRO});u.stick(0.9,0);u.app.screen=SCREEN.MENU;u.run();u.run();
  check("a stick pushed through the show does not walk MENU",u.ui.length===0&&u.input.axes.right===false);
  u.stick(0,0);u.stick(0.9,0);
  check("released and pushed again it walks",eq(u.ui,["ArrowRight"]));
}

// ---- capture and the CONTROLS page ----
{
  const page=fakePage(true);
  const x=rig({screen:SCREEN.CONTROLS,page});
  x.dn(E);x.up(E);x.dn(START);
  check("capture routes buttons to the page and START goes there too",eq(page.log,["E","START"])&&x.ui.length===0&&x.pauses===0);
  x.up(START);x.dn(DU);
  check("capture: the D-PAD sends no arrow and no held axis",eq(page.log,["E","START","dU"])&&x.ui.length===0&&x.input.axes.up===false);
  const r=x.stick(0.9,0);
  check("capture: the stick walks nothing",x.ui.length===0&&x.input.axes.right===false&&r.edge===false);
}
{
  const page=fakePage(true);
  const x=rig({state:"PAUSE",view:3,page});x.dn(E);
  check("capture in PAUSE view 3: EAST goes to the page, no step back",eq(page.log,["E"])&&x.pauses===0&&x.app.pauseView===3);
}
{
  const page=fakePage(true);
  const x=rig({screen:SCREEN.CONTROLS,page});x.dn(DU);
  page.capturing=false;x.run();x.run();
  check("a direction held through a capture stays spent",x.ui.length===0&&x.input.axes.up===false);
}
{
  const page=fakePage(false);
  const x=rig({screen:SCREEN.CONTROLS,page});x.dn(S);
  check("CONTROLS: the page sees the press, then Enter",eq(page.log,["S"])&&eq(x.ui,["Enter"]));
  const q=fakePage(false);q.taken=true;
  const y=rig({screen:SCREEN.CONTROLS,page:q});y.dn(S);
  check("CONTROLS: a press the page took goes no further",eq(y.ui,[]));
  const m=fakePage(false);const z=rig({page:m});z.dn(S);
  check("the page sees nothing outside CONTROLS",m.log.length===0);
  const w=fakePage(false);const v=rig({state:"PAUSE",view:3,page:w});v.dn(S);
  check("PAUSE view 3 counts as CONTROLS",eq(w.log,["S"])&&eq(v.ui,["Enter"]));
  const a=rig({screen:SCREEN.CONTROLS,page:null});a.dn(S);
  check("no page object is inert, no crash",eq(a.ui,["Enter"]));
}

// ---- shoulders ----
{
  const x=rig({screen:SCREEN.LEVEL});x.dn(SHL);x.up(SHL);x.dn(SHR);
  check("shoulders send bracket codes on LEVEL",eq(x.ui,["BracketLeft","BracketRight"]));
  const y=rig({screen:SCREEN.SCORES});y.dn(SHL);y.up(SHL);y.dn(SHR);
  check("shoulders walk the SCORES tabs through the arrow tap path",eq(y.ui,["ArrowLeft","ArrowRight"]));
  const z=rig({screen:SCREEN.CONTROLS});z.dn(SHL);z.up(SHL);z.dn(SHR);
  check("shoulders send bracket codes on CONTROLS",eq(z.ui,["BracketLeft","BracketRight"]));
  const v=rig({state:"PAUSE",view:3});v.dn(SHL);
  check("shoulders send bracket codes on PAUSE view 3",eq(v.ui,["BracketLeft"]));
  const shp={...DEF_CONTROLS,pad:{...DEF_PAD,PAUSE:"SHL"}};
  const sv=rig({state:"PAUSE",view:3,binds:shp});sv.dn(SHL);
  check("a shoulder bound as PAUSE changes tab on PAUSE view 3, never leaves it",eq(sv.ui,["BracketLeft"])&&sv.pauses===0&&sv.app.pauseView===3);
  const s0=rig({state:"PAUSE",binds:shp});s0.dn(SHL);
  check("the same shoulder on the PAUSE list still resumes",s0.pauses===1&&s0.ui.length===0);
  const s1=rig({state:"PAUSE",view:1,binds:shp});s1.dn(SHL);
  check("and still steps back from OPTIONS",s1.pauses===1&&s1.app.pauseView===0);
  const m=rig({screen:SCREEN.MENU});m.dn(SHL,SHR);
  check("shoulders do nothing on MENU",m.ui.length===0);
  const p=rig({state:"PAUSE"});p.dn(SHR);
  check("shoulders do nothing on the PAUSE list",p.ui.length===0&&p.pauses===0);
}

// ---- wake press, loss, a second pad ----
{
  const x=rig({state:"PAUSE",first:true});
  x.raw.list=[rawPad()];x.raw.list[0].buttons[S]={pressed:true,value:1};
  const r=x.run();
  check("wake press in PAUSE is swallowed, never resumes",x.ui.length===0&&x.pauses===0&&x.world.state==="PAUSE");
  check("wake press still reports an edge",r.edge===true);
  const y=rig({state:"PAUSE",first:true});
  y.raw.list=[rawPad()];y.raw.list[0].buttons[E]={pressed:true,value:1};y.run();
  check("wake EAST does not resume",y.pauses===0&&y.world.state==="PAUSE");
  y.raw.list[0].buttons[E]={pressed:false,value:0};y.run();y.dn(E);
  check("the next EAST acts",y.pauses===1&&y.world.state==="PLAY");
  const z=rig({screen:SCREEN.MENU,first:true});
  z.raw.list=[rawPad()];z.raw.list[0].buttons[S]={pressed:true,value:1};z.run();
  check("wake press on MENU is swallowed",z.ui.length===0);
  const p=rig({first:true});
  p.raw.list=[rawPad()];p.raw.list[0].buttons[S]={pressed:true,value:1};p.run();
  check("wake press in PLAY plants nothing",p.input._intent.fire===false);
  const d=rig({state:"PAUSE",first:true});
  d.raw.list=[rawPad()];d.raw.list[0].buttons[DD]={pressed:true,value:1};d.run();d.run();
  check("wake D-PAD walks nothing until released",d.ui.length===0&&d.input.axes.down===false);
  for(const [nm,scr] of [["title",SCREEN.INTRO],["ATTRACT",SCREEN.ATTRACT]]){
    const q=rig({screen:scr,first:true});
    q.raw.list=[rawPad()];q.raw.list[0].buttons[S]={pressed:true,value:1};q.run();
    check("wake press acts on the "+nm,eq(q.ui,["Enter"]));
  }
}
{
  const back=(o)=>{const x=rig(o);const raw=x.raw.list[0];x.raw.list=[null];x.run();x.raw.list=[raw];x.run();return x;};
  const x=back({state:"PAUSE"});
  x.dn(START);
  check("a pad that returns with nothing held: its first press still never resumes",x.pauses===0&&x.world.state==="PAUSE");
  x.up(START);x.dn(START);
  check("the press after the wake press acts",x.pauses===1&&x.world.state==="PLAY");
  const m=back({screen:SCREEN.MENU});const r=m.dn(S);
  check("a returned pad's first press on MENU is swallowed and still an edge",m.ui.length===0&&r.edge===true);
  const t=back({screen:SCREEN.ATTRACT});t.dn(S);
  check("a returned pad's first press acts on ATTRACT",eq(t.ui,["Enter"]));
  t.app.screen=SCREEN.MENU;t.up(S);t.dn(S);
  check("that press was the wake press: the next one acts",eq(t.ui,["Enter","Enter"]));
}
{
  const x=rig();x.dn(S,E,DU);x.input.advance();
  x.raw.list=[null];x.run();x.input.advance();x.run();
  check("a lost pad clears fire, remote and held axes",x.input._intent.fire===false&&x.input._intent.remote===false&&!moved(x.input));
  check("the router adds no pause on loss",x.pauses===0);
}
{
  const x=rig();x.input._latch("fire","key",true);x.dn(S);x.input.advance();
  x.raw.list=[null];x.run();
  check("a lost pad leaves a key-held fire",x.input._intent.fire===true);
}
{
  const x=rig();x.dn(S);x.input.advance();
  const other=rawPad();x.raw.list=[x.raw.list[0],other];x.run();
  check("an idle second pad changes nothing",x.input._intent.fire===true);
  other.buttons[N]={pressed:true,value:1};x.run();x.input.advance();x.run();
  check("a second pad's press clears the old pad's latches",x.input._intent.fire===false);
}
{
  const x=rig();x.dn(S);x.input.advance();
  const other=rawPad();other.buttons[S]={pressed:true,value:1};
  x.raw.list=[x.raw.list[0],other];x.run();
  check("a claim on the same button is a new press: release before press",x.input._intent.fire===true&&x.input._fresh.fire===true);
}
{
  const input=new Input(null),world={state:"PLAY"},app={screen:SCREEN.GAME,pauseView:0};
  const raw=[rawPad(),rawPad()],pad=createPad({getGamepads:()=>raw});let t=0;
  const r=createPadRouter({input,app,SCREEN,binds:()=>DEF_CONTROLS,world:()=>world,onPause(){},onUiKey(){},page:null});
  raw[1].axes[0]=0.9;
  const e=r.route(pad.poll(t+=16),t);
  check("two pads, no press: a stuck stick never drives",!moved(input)&&e.edge===false);
}
{
  const input=new Input(null),world={state:"PLAY"},app={screen:SCREEN.GAME,pauseView:0};
  const calls=[];for(const m of ["gpFire","gpRemote","gpMove","gpThrow"])input[m]=()=>{calls.push(m);return false;};
  const pad=createPad({getGamepads:()=>[]});let t=0;
  const r=createPadRouter({input,app,SCREEN,binds:()=>DEF_CONTROLS,world:()=>world,onPause(){},onUiKey(){},page:null});
  for(let i=0;i<5;i++)r.route(pad.poll(t+=16),t);
  check("no pad connected: Input is never touched",calls.length===0);
}

// ---- clear(): blur and a hidden tab ----
{
  const x=rig();x.dn(S,DU);x.input.advance();
  x.input._onBlur();x.r.clear();
  check("clear: latches are off",x.input._intent.fire===false&&!moved(x.input));
  x.run();x.run();x.input.advance();
  check("clear: a button held across the gap is no press",x.input._intent.fire===false);
  check("clear: a D-PAD held across the gap does not walk",!moved(x.input));
  x.up(S,DU);x.dn(S);
  check("clear: seen released, it works again",x.input._intent.fire===true);
}
{
  const x=rig();x.dn(S);x.input.advance();x.input._onBlur();x.run();x.run();
  check("Input's own blur alone never resurrects a fire",x.input._intent.fire===false);
}
{
  const x=rig({screen:SCREEN.MENU});x.r.clear();
  x.raw.list[0].buttons[S]={pressed:true,value:1};const r=x.run();
  check("clear: a press first seen on return is not a press",x.ui.length===0&&r.edge===false);
  x.up(S);x.dn(S);
  check("clear: after its release the next press acts",eq(x.ui,["Enter"]));
}

{
  const x=rig({screen:SCREEN.INTRO,first:true});x.run();x.r.clear();x.run();
  const pad=rawPad();pad.buttons[S]={pressed:true,value:1};x.raw.list=[pad];const r=x.run();
  check("clear before first sight: the title takes the first press (E2, Q10, S1)",eq(x.ui,["Enter"])&&r.edge===true,x.ui.join());
}
{
  const x=rig({screen:SCREEN.INTRO});x.r.clear();x.raw.list=[null];x.run();
  const pad=rawPad();pad.buttons[S]={pressed:true,value:1};x.raw.list=[pad];x.run();
  check("clear, then the pad lost while away: the title still takes the first press",eq(x.ui,["Enter"]),x.ui.join());
}
{
  const x=rig({screen:SCREEN.MENU,first:true});x.run();x.r.clear();x.run();
  const pad=rawPad();pad.buttons[S]={pressed:true,value:1};x.raw.list=[pad];x.run();
  check("clear before first sight on MENU: found still swallows the press",x.ui.length===0);
  x.up(S);x.dn(S);
  check("and the next press acts",eq(x.ui,["Enter"]));
}
{
  const x=rig({first:true});x.run();x.r.clear();x.run();
  const pad=rawPad();pad.buttons[S]={pressed:true,value:1};x.raw.list=[pad];x.run();
  check("clear before first sight in PLAY: found still swallows the press",x.input._intent.fire===false);
}

// ---- two pads, the active one unplugged ----
{
  const a=rawPad(),b=rawPad();b.axes[0]=0.9;
  const x=rig();x.raw.list=[a,b];x.run();x.input.gate={canThrow:()=>true};
  a.buttons[S]={pressed:true,value:1};x.run();x.input.advance();
  check("two pads: A plants with SOUTH",x.input._intent.fire===true&&!moved(x.input));
  x.raw.list=[null,b];x.run();x.input.advance();
  check("E1: A unplugged: fire is let go on that poll",x.input._intent.fire===false);
  check("E1: and B's stuck stick does not walk",!moved(x.input));
  x.run();x.input.advance();
  check("E4: B adopted: its stuck stick still does not walk",!moved(x.input)&&x.input._intent.fire===false);
  b.buttons[S]={pressed:true,value:1};x.run();x.input.advance();
  check("E2: B's wake press is swallowed",x.input._intent.fire===false&&!moved(x.input));
  b.buttons[S]={pressed:false,value:0};x.run();b.axes[0]=0;x.run();x.run();
  b.buttons[S]={pressed:true,value:1};x.run();
  check("B's next SOUTH plants once the stick was seen clear",x.input._intent.fire===true);
  x.input.advance();b.axes[0]=0.9;x.run();
  check("and B's stick walks again",moved(x.input)===1);
}

// ---- a stick pushed in capture gets a word (B9) ----
{
  const page=fakePage(true);
  const x=rig({screen:SCREEN.CONTROLS,page});
  x.stick(0.9,0);
  check("capture: a stick rise feeds its id once",eq(page.log,["LS"]),page.log.join());
  x.stick(0.9,0);
  check("capture: a held stick feeds nothing more",eq(page.log,["LS"]));
  x.stick(0,0);x.stick(0,0.9);
  check("capture: a new push feeds again",eq(page.log,["LS","LS"]));
}
{
  const page=fakePage(true);
  const x=rig({screen:SCREEN.CONTROLS,page,binds:{...DEF_CONTROLS,stick:"R"}});
  x.pad.setStick("R");x.raw.list[0].axes[2]=0.9;x.run();
  check("capture: the bound stick names itself, RS read from the binds",eq(page.log,["RS"]),page.log.join());
}
{
  const page=fakePage(true);
  const x=rig({screen:SCREEN.CONTROLS,page});
  x.dn(DU);
  check("capture: the D-PAD feeds its own id, never a stick id",eq(page.log,["dU"]),page.log.join());
}
{
  const page=fakePage(false);
  const x=rig({screen:SCREEN.CONTROLS,page});
  x.stick(0.9,0);
  check("no capture: the stick feeds nothing to the page",page.log.length===0&&eq(x.ui,["ArrowRight"]));
}
{
  const page=fakePage(true);
  const x=rig({screen:SCREEN.CONTROLS,page});
  x.raw.list[0].axes[0]=0.9;x.r.clear();x.run();
  check("capture: a stick held across a gap is no push",page.log.length===0);
}

// ---- edge ----
{
  const x=rig({screen:SCREEN.MENU});
  check("edge: an idle poll is false",x.run().edge===false);
  check("edge: a button press is true",x.dn(N).edge===true);
  check("edge: holding it is false",x.run().edge===false);
  check("edge: its release is false",x.up(N).edge===false);
  check("edge: stick noise is false",x.stick(0.4,0).edge===false);
  check("edge: a stick past 0.5 is true",x.stick(0.6,0).edge===true);
  const y=rig();
  check("edge: PLAY stick noise is false",y.stick(0.3,0).edge===false);
  check("edge: a PLAY stick past 0.5 is true",y.stick(0.7,0).edge===true);
  check("edge: a PLAY D-PAD press is true",rig().dn(DU).edge===true);
}

// ---- no pad route to what must stay unreachable ----
{
  const sent=new Set();
  for(const scr of Object.values(SCREEN)){
    for(const st of ["PLAY","PAUSE","WIN","LOSE"]) for(let b=0;b<16;b++){
      const x=rig({screen:scr,state:st});x.dn(b);x.ui.forEach((c)=>sent.add(c));
    }
  }
  const allowed=new Set(["Enter","Escape","BracketLeft","BracketRight","ArrowUp","ArrowRight","ArrowDown","ArrowLeft","KeyC","KeyB","KeyT"]);
  check("no pad route to the wipe, the camera or the consent card: only the fixed codes",[...sent].every((c)=>allowed.has(c)),[...sent].join(","));
}

// ---- T14: the routes on other screens ----
const TRL=6,TRR=7;
function real(screen,o={}){
  const app=createMenuApp({autoplay:false});app.skip();app.screen=screen;app.pactUnlocked=o.unlocked!==false;
  const world={state:"PLAY"},input=new Input(null),ui=[];
  const raw={list:[rawPad()]},pad=createPad({getGamepads:()=>raw.list});
  const r=createPadRouter({input,app,SCREEN:REAL,binds:()=>DEF_CONTROLS,world:()=>world,onPause(){},onUiKey:(c)=>{ui.push(c);app.key(c);},page:null});
  let t=0;const run=(dt=16)=>r.route(pad.poll(t+=dt),t);run();
  const p=()=>raw.list[0];
  return {app,ui,input,run,dn:(...b)=>{for(const i of b)p().buttons[i]={pressed:true,value:1};return run();},
    up:(...b)=>{for(const i of b)p().buttons[i]={pressed:false,value:0};return run();},
    tap(b){this.dn(b);this.up(b);},stick:(x,y)=>{p().axes[0]=x;p().axes[1]=y;return run();}};
}
{
  const x=real(REAL.LEVEL);
  check("LEVEL: no cursor until a pad uses it",x.app.modeCur===-1);
  x.tap(TRR);check("LEVEL: R TRIGGER puts the cursor on the first chip",x.app.modeCur===0&&x.ui.length===0);
  x.tap(TRR);x.tap(TRR);check("LEVEL: R TRIGGER walks",x.app.modeCur===2);
  x.tap(TRL);check("LEVEL: L TRIGGER walks back",x.app.modeCur===1);
  x.tap(N);check("LEVEL: NORTH toggles through the Digit path",eq(x.ui,["Digit2"])&&x.app.pact!==0);
  const p1=x.app.pact;x.tap(N);check("LEVEL: NORTH again toggles it off",eq(x.ui,["Digit2","Digit2"])&&x.app.pact!==p1&&x.app.pact===0);
  for(let i=0;i<9;i++)x.tap(TRR);check("LEVEL: the cursor clamps on TIME",x.app.modeCur===4);
  const t0=x.app.timeAttack;x.tap(N);check("LEVEL: NORTH on the fifth chip toggles TIME",x.ui.at(-1)==="Digit5"&&x.app.timeAttack===!t0);
  for(let i=0;i<9;i++)x.tap(TRL);check("LEVEL: the cursor clamps on the first chip",x.app.modeCur===0);
  const y=real(REAL.LEVEL);y.tap(TRL);check("LEVEL: a first L TRIGGER lands on the last chip",y.app.modeCur===4);
  const z=real(REAL.LEVEL);z.tap(N);check("LEVEL: NORTH with no cursor only shows it, nothing toggles",z.app.modeCur===0&&z.ui.length===0&&z.app.pact===0);
  const l=real(REAL.LEVEL,{unlocked:false});l.tap(TRR);l.tap(TRL);l.tap(N);
  check("LEVEL: before the first CLEAR the triggers and NORTH are inert",l.app.modeCur===-1&&l.ui.length===0);
  check("LEVEL: the walk never touches the room, heat or pace",x.app.level===1&&x.app.pace===0);
}
{
  const x=real(REAL.STATS);x.tap(W);
  check("STATS: WEST sends C",eq(x.ui,["KeyC"])&&x.app.screen===REAL.STATS);
  x.tap(N);check("STATS: NORTH sends T and opens MEDALS",x.ui.at(-1)==="KeyT"&&x.app.screen===REAL.TROPHIES);
  const y=real(REAL.STATS);for(const b of [S,E,W,N,SHL,SHR,TRL,TRR,SELECT,START]){y.app.screen=REAL.STATS;y.tap(b);}
  check("STATS: no button ever sends R",!y.ui.includes("KeyR")&&!y.app.resetArm,y.ui.join());
  const t=real(REAL.TROPHIES);t.tap(N);t.tap(W);check("MEDALS: NORTH and WEST are inert",t.ui.length===0);
}
for(const st of ["WIN","LOSE"]){
  const x=rig({state:st});x.dn(W);
  check(st+": WEST sends C",eq(x.ui,["KeyC"]));
  x.up(W);x.dn(N);check(st+": NORTH sends B",eq(x.ui,["KeyC","KeyB"]));
  x.up(N);x.dn(E);check(st+": EAST still nothing",x.ui.length===2);
}
{
  const x=rig({state:"PAUSE"});x.dn(W);x.up(W);x.dn(N);
  check("PAUSE: WEST and NORTH send nothing",x.ui.length===0);
  const y=rig();y.input.gate={canThrow:()=>false};y.dn(N);
  check("PLAY: NORTH never copies",y.ui.length===0);
}
/* a card: modal, guarded by the router's own clock */
function carded(screen,o={}){
  const x=real(screen,o),log=[],c={on:false,seen:[],live(pad){this.seen.push(pad);return this.on;},press(id){log.push(id);}};
  x.app.padCards=[c];
  return {...x,tap(b){x.dn(b);x.up(b);},c,log};
}
{
  const x=carded(REAL.MENU);x.tap(S);
  check("no card: SOUTH is Enter as before",x.log.length===0&&x.ui[0]==="Enter");
  const y=carded(REAL.MENU);y.c.on=true;y.run();
  y.tap(S);y.tap(S);y.tap(E);
  check("a mash within 0.5 s never reaches the card",y.log.length===0);
  check("a mash within 0.5 s reaches nothing behind",y.ui.length===0&&y.app.screen===REAL.MENU);
  y.run(600);y.dn(S);
  check("past 0.5 s SOUTH reaches the card once",eq(y.log,["S"])&&y.ui.length===0);
  y.up(S);y.dn(E);y.up(E);
  check("past 0.5 s EAST reaches the card",eq(y.log,["S","E"])&&y.ui.length===0);
  const c0=y.app.cursor;y.dn(DD);y.up(DD);y.dn(W);y.up(W);y.dn(N);y.up(N);y.dn(START);y.up(START);y.dn(SHL);y.up(SHL);
  check("only SOUTH and EAST act, and nothing else reaches the shell",y.log.length===2&&y.ui.length===0&&y.app.cursor===c0,y.ui.join());
  const h=carded(REAL.MENU);h.c.on=true;h.stick(0,0.9);
  check("a stick held under a card moves nothing",eq(h.input.axes,{up:false,down:false,left:false,right:false})&&h.ui.length===0,JSON.stringify(h.input.axes));
  h.c.on=false;h.run();
  check("the same held stick stays spent when the card goes",h.ui.length===0&&!h.input.axes.down);
  h.stick(0,0);h.stick(0,0.9);
  check("released and pushed again it walks",h.ui.at(-1)==="ArrowDown");
  const s=carded(REAL.MENU);s.c.on=true;s.run();s.run(600);s.dn(E,S);
  check("EAST + SOUTH in one poll take the safe way out",eq(s.log,["E"]));
  const r=carded(REAL.MENU);r.c.on=true;r.run();r.run(600);r.c.on=false;r.run();r.c.on=true;r.run();r.dn(S);
  check("the guard restarts when the card comes back",r.log.length===0);
}
{
  const x=rig();const seen=[];x.app.padCards=[{live(){return true;},press(id){seen.push(id);}}];x.run();
  x.dn(S);
  check("PLAY: a load card never takes the bomb button",x.input._intent.fire===true&&seen.length===0);
  const c=fakePage(true);const y=rig({screen:SCREEN.CONTROLS,page:c});const s2=[];
  y.app.padCards=[{live(){return true;},press(id){s2.push(id);}}];y.run();y.run();y.dn(S);
  check("a capture runs first: the card gets nothing",s2.length===0&&c.log.includes("S"));
}
{
  const src=readFileSync(new URL("../src/app/padroute.js",import.meta.url),"utf8");
  check("the consent card has no pad route, ever",!/KeyY|KeyN|analytics|#ana/i.test(src));
  check("the router has no route to the wipe",!/KeyR/.test(src));
}

// ---- the SENSITIVITY row: the stick is under test, the D-PAD walks ----
{
  const bench=()=>{const x=rig({screen:SCREEN.CONTROLS,state:"PLAY"});x.app.onControls=()=>true;x.app.controls={stickBench:true};return x;};
  const x=bench();
  x.stick(0.9,0);
  check("the stick neither taps nor holds there",x.ui.length===0&&x.input.axes.right===false);
  x.stick(0,0.9);
  check("nor walks",x.ui.length===0&&x.input.axes.down===false);
  x.stick(0,0);
  x.dn(DD);
  check("the D-PAD walks",eq(x.ui,["ArrowDown"])&&x.input.axes.down===true);
  x.up(DD);
  const y=bench();
  y.dn(14);
  check("the D-PAD adjusts",eq(y.ui,["ArrowLeft"])&&y.input.axes.left===true);
  y.up(14);
  y.stick(0.9,0);
  check("a stick pushed while the D-PAD rests still does nothing",eq(y.ui,["ArrowLeft"])&&y.input.axes.right===false);
  y.dn(DD);
  check("a D-PAD press beats the pushed stick",eq(y.ui,["ArrowLeft","ArrowDown"])&&y.input.axes.down===true&&y.input.axes.right===false);
  const z=bench();
  z.dn(SHR);
  check("a shoulder still changes tab",eq(z.ui,["BracketRight"]));
  const w=bench();
  w.stick(0,0.9);
  w.app.controls.stickBench=false;
  w.run();
  check("a stick held through the bench stays quiet after it, until it returns to centre",eq(w.ui,[])&&w.input.axes.down===false);
  w.stick(0,0);w.stick(0,0.9);
  check("then a fresh push walks",eq(w.ui,["ArrowDown"])&&w.input.axes.down===true);
  for(const [nm,key,btn] of [["down",DD,"ArrowDown"],["up",DU,"ArrowUp"]]){
    const e=bench();
    e.stick(0.9,0);
    e.dn(key);
    e.app.controls.stickBench=false; // the cursor left the row
    e.up(key);
    check("exit by D-PAD "+nm+" with the stick held: its release is no push",eq(e.ui,[btn])&&e.input.axes.right===false,JSON.stringify(e.ui));
    e.stick(0,0);e.stick(0.9,0);
    check("exit by D-PAD "+nm+": centre, then a push walks again",eq(e.ui,[btn,"ArrowRight"]),JSON.stringify(e.ui));
  }
  const o=bench();o.app.controls.stickBench=false;
  o.stick(0.9,0);
  check("any other row: the stick walks and adjusts as ever",eq(o.ui,["ArrowRight"])&&o.input.axes.right===true);
}

console.log("\n  PADROUTE RESULT: "+pass+" PASS / "+fail+" FAIL");
process.exit(fail?1:0);
