/* Input T2: per-source fire / remote holders, the pad writer, key binds.
   Everything goes through the public handlers; the sim checks run the real step(). */
import {step, createWorld, loadLevel} from "../src/core/sim.js";
import {CFG} from "../src/core/config.js";
import {Input} from "../src/input.js";

let pass=0, fail=0;
function check(name, cond, detail){ cond?pass++:fail++;
  console.log((cond?"  PASS ":"  FAIL ")+name+(detail!==undefined?" -> "+detail:"")); }

const ev=(code,o)=>({code,key:"",repeat:false,preventDefault(){this.pd=true;},...o});
const dn=(inp,code,o)=>{const e=ev(code,o);inp._onKey(e);return e;};
const up=(inp,code)=>inp._onKeyUp(ev(code));
const KB={BOMB:"Space",THROW:"KeyE",REMOTE:"KeyQ",PAUSE:"KeyP",MOVE:["KeyW","KeyD","KeyS","KeyA"]};
const NONE={up:false,down:false,left:false,right:false};
const dir=(k)=>({...NONE,[k]:true});
const YES={canThrow:()=>true};
/* one tick as main.js runs it: intent, step, advance */
const tick=(w,inp)=>{step(w,CFG.STEP,{0:inp.intent()});inp.advance();};
const live=(w)=>w.bombs.filter((b)=>!b.dead);
const stage=(power)=>{const inp=new Input(null),w=createWorld(4242,1);loadLevel(w,1,false);w.state="PLAY";const p=w.players[0];
  p.bombs=3;p.throw=!!power;p.face={x:1,y:0};inp.gate={canThrow:()=>!!p.throw};return {inp,w,p};};
/* the tick pattern a script produces, as a string of 0/1 */
const fires=(inp,n)=>{let s="";for(let k=0;k<n;k++){s+=inp.intent().fire?"1":"0";inp.advance();}return s;};

// ---- defaults ----
{
  const inp=new Input(null);
  for(const [c,ax] of [["KeyW","up"],["KeyS","down"],["KeyA","left"],["KeyD","right"],
    ["ArrowUp","up"],["ArrowDown","down"],["ArrowLeft","left"],["ArrowRight","right"]]){
    dn(inp,c); const on=inp.input[ax]; up(inp,c);
    check("default key table: "+c+" holds "+ax+" and releases",on===true&&inp.input[ax]===false);
  }
  for(const c of ["Space","KeyJ","KeyX"]){
    dn(inp,c); const on=inp._intent.fire; up(inp,c);
    check("default key table: "+c+" holds fire and releases",on===true&&inp._intent.fire===false);
  }
  for(const c of ["ShiftLeft","ShiftRight"]){
    dn(inp,c); const on=inp._intent.shift; up(inp,c);
    check("default key table: "+c+" holds shift",on===true&&inp._intent.shift===false);
  }
  dn(inp,"KeyQ"); const q=inp._intent.remote; dn(inp,"Space"); up(inp,"Space");
  check("default key table: Q holds remote, Space keyup still clears it",q===true&&inp._intent.remote===false);
  up(inp,"KeyQ");
  let pz=0,ui=[]; inp.onPause=()=>pz++; inp.onUiKey=(c)=>ui.push(c);
  dn(inp,"KeyP"); dn(inp,"Escape");
  check("default key table: P and Escape pause, then reach the shell",pz===2&&ui.join()==="KeyP,Escape",pz+"/"+ui);
  const shape=Object.keys(inp._intent).join();
  check("the wire shape is exactly today's five fields",shape==="move,fire,firePrev,shift,remote",shape);
}
{
  const seven=["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyJ","KeyX"];
  const others=["KeyW","KeyA","KeyS","KeyD","KeyE","KeyQ","KeyP","KeyK","Slash","Tab"];
  const never=new Input(null), same=new Input(null); same.setKeyBinds(KB);
  for(const [name,inp] of [["never called",never],["called with defaults",same]]){
    const a=seven.every((c)=>{const e=dn(inp,c);up(inp,c);return e.pd===true;});
    const b=others.every((c)=>{const e=dn(inp,c);up(inp,c);return !e.pd;});
    check("preventDefault is exactly today's seven, binds "+name,a&&b);
  }
  const bare=new Input(null); bare.setKeyBinds(KB);
  let threw=false; try{bare._onKey({code:"KeyQ"});bare._onKeyUp({code:"KeyQ"});}catch(_){threw=true;}
  check("a default-bound key never needs e.preventDefault (sim.test stub)",!threw);
}

// ---- rebinding ----
{
  const inp=new Input(null); inp.setKeyBinds({...KB,BOMB:"KeyZ"});
  dn(inp,"Space"); const s=inp._intent.fire; up(inp,"Space");
  dn(inp,"KeyJ"); const j=inp._intent.fire; up(inp,"KeyJ");
  dn(inp,"KeyX"); const x=inp._intent.fire; up(inp,"KeyX");
  dn(inp,"KeyZ"); const z=inp._intent.fire; up(inp,"KeyZ");
  check("setKeyBinds moves BOMB to KeyZ: Space no longer fires, J/X alias dropped",!s&&!j&&!x&&z&&!inp._intent.fire);
  check("J / X no longer preventDefault once their alias is gone",!dn(inp,"KeyJ").pd&&!dn(inp,"KeyX").pd);
  check("Space and ARROWS keep their preventDefault after a rebind",dn(inp,"Space").pd===true&&dn(inp,"ArrowLeft").pd===true);
  check("a non-default bound key gets preventDefault",dn(inp,"KeyZ").pd===true);
  check("a browser chord on a bound key is left to the browser",!dn(inp,"KeyZ",{metaKey:true}).pd&&!dn(inp,"KeyZ",{ctrlKey:true}).pd);
}
{
  const inp=new Input(null); inp.setKeyBinds({...KB,REMOTE:"Slash",BOMB:"Space"});
  check("Slash bound gets preventDefault (quick-find keys)",dn(inp,"Slash").pd===true);
  dn(inp,"KeyJ"); const j=inp._intent.fire; up(inp,"KeyJ");
  check("J still plants while BOMB is SPACE and J is free",j===true);
}
{
  const inp=new Input(null); inp.setKeyBinds({...KB,REMOTE:"KeyX"});
  dn(inp,"KeyX"); const x=inp._intent; const r=x.remote,f=x.fire; up(inp,"KeyX");
  dn(inp,"KeyJ"); const j=inp._intent.fire; up(inp,"KeyJ");
  check("X captured elsewhere stops planting, J alias stays",r===true&&f===false&&j===true);
}
{
  const inp=new Input(null); inp.setKeyBinds({...KB,MOVE:["KeyI","KeyL","KeyK","KeyJ"]});
  dn(inp,"KeyI"); check("rebound MOVE up drives intent().move",inp.intent().move.y===-1); up(inp,"KeyI");
  dn(inp,"KeyL"); check("MOVE index 1 is RIGHT",inp.intent().move.x===1); up(inp,"KeyL");
  dn(inp,"KeyK"); check("MOVE index 2 is DOWN",inp.intent().move.y===1); up(inp,"KeyK");
  dn(inp,"KeyJ"); check("MOVE index 3 is LEFT, and J is a move key, not a bomb",inp.intent().move.x===-1&&!inp._intent.fire); up(inp,"KeyJ");
  check("rebound MOVE releases",inp.intent().move.x===0&&inp.intent().move.y===0);
  dn(inp,"KeyW"); check("the old MOVE key does nothing",inp.intent().move.y===0); up(inp,"KeyW");
  dn(inp,"ArrowUp"); check("ARROWS always drive intent().move",inp.intent().move.y===-1); up(inp,"ArrowUp");
}
{
  const inp=new Input(null); let pz=0; inp.onPause=()=>pz++; inp.setKeyBinds({...KB,PAUSE:"KeyO"});
  dn(inp,"KeyP"); const a=pz; dn(inp,"KeyO"); const b=pz; dn(inp,"Escape");
  check("rebound PAUSE: old key dead, new key and Escape pause",a===0&&b===1&&pz===2,a+"/"+b+"/"+pz);
}
{
  const inp=new Input(null);
  dn(inp,"KeyW"); dn(inp,"Space"); dn(inp,"KeyQ");
  inp.setKeyBinds({...KB,BOMB:"KeyZ",REMOTE:"KeyV",MOVE:["KeyI","KeyL","KeyK","KeyO"]});
  check("a key held across a rebind cannot stick",!inp.input.up&&!inp._intent.fire&&!inp._intent.remote);
  inp.setKeyBinds(null);
  dn(inp,"KeyW"); check("setKeyBinds(null) restores the default table",inp.input.up===true); up(inp,"KeyW");
}

// ---- solo THROW key ----
{
  const {inp,w}=stage(false);
  dn(inp,"KeyE"); tick(w,inp); tick(w,inp);
  check("solo THROW key without the power fires nothing and plants no bomb",live(w).length===0&&!inp._intent.fire&&!inp._intent.shift);
}
{
  const inp=new Input(null); dn(inp,"KeyE");
  check("solo THROW key with no gate set is inert",!inp._intent.fire&&!inp._intent.shift);
}
{
  const {inp,w,p}=stage(true);
  dn(inp,"KeyE");
  const it=inp.intent(); const one=it.fire&&it.shift;
  step(w,CFG.STEP,{0:it}); inp.advance();
  check("solo THROW with the power gives one shift+fire tick",one&&!inp._intent.fire&&!inp._intent.shift);
  check("solo THROW lands ahead, exactly once",live(w).length===1&&Math.abs(live(w)[0].x-p.x)>20);
  tick(w,inp); tick(w,inp);
  check("solo THROW does not repeat",live(w).length===1);
}
{
  const {inp,w,p}=stage(true);
  inp.gate=null; dn(inp,"ShiftLeft"); dn(inp,"Space"); tick(w,inp);
  check("SHIFT+Space still throws (no gate involved)",live(w).length===1&&Math.abs(live(w)[0].x-p.x)>20);
  up(inp,"Space"); up(inp,"ShiftLeft");
}
{
  const {inp,w,p}=stage(true); inp.setKeyBinds({...KB,BOMB:"KeyZ"});
  dn(inp,"ShiftLeft"); dn(inp,"KeyZ"); tick(w,inp);
  check("SHIFT + the current BOMB key throws after a rebind",live(w).length===1&&Math.abs(live(w)[0].x-p.x)>20);
}
{
  const {inp,w}=stage(false);
  inp.gate=null; dn(inp,"ShiftLeft"); dn(inp,"Space"); tick(w,inp);
  check("SHIFT+BOMB without the power still plants at the feet (baseline)",live(w).length===1);
}
{
  const {inp,w,p}=stage(true);
  dn(inp,"Space"); tick(w,inp); tick(w,inp);
  dn(inp,"KeyE"); tick(w,inp); tick(w,inp); tick(w,inp);
  const b=live(w);
  check("SPACE held then E rolls like the pad: plant, then one throw",b.length===2&&b.filter((x)=>Math.abs(x.x-p.x)>20).length===1,b.length);
  up(inp,"Space"); tick(w,inp); tick(w,inp);
  check("Space keyup after the roll plants nothing more",live(w).length===2&&!inp._intent.fire);
}
{
  const {inp,w}=stage(true);
  dn(inp,"Space"); tick(w,inp); dn(inp,"KeyE"); tick(w,inp); up(inp,"Space"); tick(w,inp);
  check("Space released right after E: the throw survives",live(w).length===2,live(w).length);
}

// ---- holders: no source cancels another ----
{
  const inp=new Input(null);
  dn(inp,"Space"); inp.gpFire(true); inp.advance(); inp.gpFire(false); inp.advance();
  check("pad fire does not cancel a held Space",inp._intent.fire===true);
  up(inp,"Space"); check("Space keyup with no pad clears it",inp._intent.fire===false);
  inp.gpFire(true); inp.advance(); dn(inp,"Space"); up(inp,"Space");
  check("Space keyup does not cancel pad fire",inp._intent.fire===true);
  inp.gpFire(false); check("pad release after a tick clears",inp._intent.fire===false);
}
{
  const inp=new Input(null);
  inp._onFireDown({}); inp.gpFire(true); inp.advance(); inp.gpFire(false);
  check("pad release never cancels a held pointer",inp._intent.fire===true);
  inp._onFireUp({}); check("pointer release clears",inp._intent.fire===false);
  inp.gpFire(true); inp.advance(); inp._onFireDown({}); inp._onFireUp({});
  check("pointer release never cancels a pad hold",inp._intent.fire===true);
  inp.gpFire(false); check("pad release then clears",inp._intent.fire===false);
}
{
  const inp=new Input(null);
  inp.gpRemote(true); inp.advance(); dn(inp,"Space"); up(inp,"Space");
  check("pad remote survives Space keyup",inp._intent.remote===true);
  inp.gpRemote(false); check("pad remote release clears",inp._intent.remote===false);
  dn(inp,"KeyQ"); inp.gpRemote(true); inp.advance(); inp.gpRemote(false);
  check("pad remote release never cancels a held remote key",inp._intent.remote===true);
  up(inp,"KeyQ"); check("remote key release clears",inp._intent.remote===false);
}

// ---- sub-tick taps, one logical press ----
{
  const inp=new Input(null);
  inp.gpFire(true); inp.gpFire(false);
  check("a pad tap shorter than one tick still yields exactly one fire tick",fires(inp,4)==="1000",inp._intent.fire);
}
{
  const inp=new Input(null);
  inp.gpFire(true); inp.gpFire(false); inp.gpFire(true); inp.gpFire(false);
  check("a second tap before that tick merges",fires(inp,4)==="1000");
}
{
  const inp=new Input(null);
  inp.gpFire(true); inp.gpFire(false); inp.gpFire(true);
  check("tap then re-press before the tick is a hold",fires(inp,3)==="111");
  inp.gpFire(false); check("the hold's release is not deferred after a tick",inp._intent.fire===false);
}
{
  const inp=new Input(null); let s="";
  inp.gpRemote(true); inp.gpRemote(false);
  for(let k=0;k<3;k++){s+=inp.intent().remote?"1":"0";inp.advance();}
  check("a pad remote tap shorter than one tick yields exactly one remote tick",s==="100",s);
}
{
  const inp=new Input(null);
  inp.gpMove(dir("up")); inp.gpMove(NONE);
  check("a D-PAD tap shorter than one tick gives one tick of move",inp.intent().move.y===-1);
  inp.advance();
  check("and only one",inp.intent().move.y===0);
}
{
  const inp=new Input(null);
  inp.gpMove(dir("up"),true); inp.gpMove(NONE,true);
  check("a menu-layer stick tap leaves no latch for the first tick of a run",inp.intent().move.y===0&&inp.axes.up===false);
}
{
  const inp=new Input(null);
  inp.gpMove(dir("up")); inp.gpMove(NONE);
  check("a pending tap never reaches the menu view",inp.axes.up===false);
  inp.gpMove(dir("left"),true);
  check("a menu-layer call drops a pending tap",inp.intent().move.x===-1&&inp.intent().move.y===0);
}
{
  const {inp,w}=stage(false);
  const n=()=>w.events.filter((e)=>e.t==="bomb").length;
  inp.gpFire(true); for(let k=0;k<600;k++){inp.gpFire(true);tick(w,inp);}
  check("F1: a button held for 600 polls plants one bomb",n()===1,n());
}
{
  const {inp,w}=stage(false);
  inp.gpFire(true); inp.gpFire(false); tick(w,inp);
  check("F5: sub-tick tap plants through the real sim",live(w).length===1); tick(w,inp);
  check("F5: and nothing is latched behind it",!inp._intent.fire&&live(w).length===1);
}

// ---- thumb roll ----
{
  const {inp,w,p}=stage(true);
  inp.gpFire(true); tick(w,inp); tick(w,inp);
  const before=live(w).length;
  const r=inp.gpThrow();
  const gap=inp.intent().fire; tick(w,inp);
  const edge=inp.intent(); const hit=edge.fire&&edge.shift; tick(w,inp);
  const b=live(w);
  check("thumb roll BOMB held then THROW: gpThrow reports it fired",r===true);
  check("fire drops for one advance, then one throw edge",before===1&&gap===false&&hit===true,gap+"/"+hit);
  check("one throw lands ahead",b.length===2&&b.filter((x)=>Math.abs(x.x-p.x)>20).length===1);
  inp.gpFire(true); tick(w,inp); tick(w,inp);
  check("BOMB is swallowed until released",live(w).length===2&&!inp._intent.fire);
  inp.gpFire(false); tick(w,inp); inp.gpFire(true); tick(w,inp);
  check("a fresh press after release plants",live(w).filter((x)=>Math.abs(x.x-p.x)<=20).length>=1&&inp._intent.fire===true);
}
{
  const {inp,w,p}=stage(true);
  inp.gpFire(true); inp.gpThrow(); tick(w,inp); tick(w,inp); tick(w,inp); tick(w,inp);
  const b=live(w);
  check("same-poll BOMB + THROW: bomb first, then the throw",
    b.length===2&&Math.abs(b[0].x-p.x)<=20&&Math.abs(b[1].x-p.x)>20,b.length);
}
{
  const {inp,w}=stage(true);
  inp.gpFire(true); tick(w,inp); w.players[0].throw=false;
  inp.gpThrow(); tick(w,inp); tick(w,inp);
  check("gpThrow with the power gone does nothing and plants nothing",live(w).length===1,live(w).length);
}
{
  const {inp,w,p}=stage(true);
  inp.gpFire(true); tick(w,inp); inp.gpThrow(); p.throw=false; tick(w,inp); tick(w,inp); tick(w,inp);
  check("power lost mid-roll: the pending throw never plants at the feet",live(w).length===1,live(w).length);
}
{
  const {inp,w}=stage(true);
  dn(inp,"Space"); tick(w,inp);
  const r=inp.gpThrow();
  check("key-held fire makes gpThrow a no-op",r===false&&inp._intent.fire===true&&!inp._intent.shift);
  tick(w,inp); tick(w,inp);
  check("and nothing more is planted",live(w).length===1);
}
{
  const {inp,w}=stage(true);
  inp._onFireDown({}); tick(w,inp);
  check("pointer-held fire makes gpThrow a no-op",inp.gpThrow()===false&&inp._intent.fire===true);
}
{
  const {inp,w}=stage(false);
  check("gpThrow without the power returns false, fires nothing",inp.gpThrow()===false&&!inp._intent.fire&&!inp._intent.shift); tick(w,inp);
  check("and plants nothing",live(w).length===0);
  const n=new Input(null);
  check("gpThrow with no gate returns false",n.gpThrow()===false&&!n._intent.fire);
}
{
  const {inp,w,p}=stage(true);
  check("gpThrow alone fires",inp.gpThrow()===true);
  const it=inp.intent(); const on=it.fire&&it.shift; step(w,CFG.STEP,{0:it}); inp.advance();
  check("gpThrow alone: one shift+fire tick lands ahead",on&&live(w).length===1&&Math.abs(live(w)[0].x-p.x)>20&&!inp._intent.fire&&!inp._intent.shift);
}
{
  const {inp,w,p}=stage(true);
  dn(inp,"Space"); tick(w,inp); up(inp,"Space");
  inp.gpThrow(); tick(w,inp); tick(w,inp); tick(w,inp);
  const b=live(w);
  check("THROW right after a fire tick still gets its edge",b.length===2&&b.filter((x)=>Math.abs(x.x-p.x)>20).length===1,b.length);
}

// ---- a plant right after a throw (F1, F5) ----
const pat=(w,inp,n)=>{let s="";for(let k=0;k<n;k++){const i=inp.intent();s+=i.fire?(i.shift?"T":"F"):"0";step(w,CFG.STEP,{0:i});inp.advance();}return s;};
const atFeet=(w,p)=>live(w).filter((b)=>Math.abs(b.x-p.x)<=20).length;
{
  const {inp,w,p}=stage(true);
  inp.gpThrow(); tick(w,inp); inp.gpFire(true);
  const s=pat(w,inp,4);
  check("THROW, tick, BOMB held: fire low one advance, then the plant",s==="0FFF"&&atFeet(w,p)===1&&live(w).length===2,s);
  inp.gpFire(false); check("and the release clears it",inp._intent.fire===false);
}
{
  const {inp,w,p}=stage(true);
  inp.gpThrow(); tick(w,inp); inp.gpFire(true); inp.gpFire(false);
  const s=pat(w,inp,4);
  check("THROW, tick, a sub-tick BOMB tap: one late fire tick, one plant",s==="0F00"&&atFeet(w,p)===1&&live(w).length===2,s);
}
{
  const {inp,w,p}=stage(true);
  inp.gpThrow(); inp.gpFire(true);
  const s=pat(w,inp,5);
  check("THROW then BOMB before the throw's tick: throw, gap, plant",s==="T0FFF"&&atFeet(w,p)===1&&live(w).length===2,s);
}
{
  const {inp,w,p}=stage(true);
  inp.gpThrow(); inp.gpFire(true); inp.gpFire(false);
  const s=pat(w,inp,5);
  check("THROW then a sub-tick BOMB tap before the throw's tick: throw, gap, one plant",s==="T0F00"&&atFeet(w,p)===1&&live(w).length===2,s);
}
{
  const {inp,w,p}=stage(true);
  dn(inp,"KeyE"); tick(w,inp); dn(inp,"Space");
  const s=pat(w,inp,4);
  check("solo E, tick, Space held: fire low one advance, then the plant",s==="0FFF"&&atFeet(w,p)===1&&live(w).length===2,s);
  up(inp,"Space"); check("and Space's release clears it",inp._intent.fire===false);
}
{
  const {inp,w,p}=stage(true);
  dn(inp,"KeyE"); dn(inp,"Space");
  const s=pat(w,inp,4);
  check("solo E then Space before the tick: throw, gap, plant",s==="T0FF"&&atFeet(w,p)===1&&live(w).length===2,s);
}
{
  const {inp,w,p}=stage(true);
  inp.gpThrow(); tick(w,inp); tick(w,inp); inp.gpFire(true);
  const s=pat(w,inp,2);
  check("a BOMB one tick later needs no gap",s==="FF"&&atFeet(w,p)===1,s);
}
{
  const {inp,w}=stage(true);
  inp.gpThrow(); tick(w,inp); inp.gpFire(true); inp.intent(); inp.advance(); inp.advance();
  inp.gpFire(false); inp.gpFire(true);
  check("the gap leaves the hold's own release and press alone",inp._intent.fire===true);
}
{
  const {inp,w}=stage(true);
  inp.gpThrow(); tick(w,inp); inp.gpFire(true); inp._intent.fire=false;
  const s=pat(w,inp,3);
  check("a main.js swallow inside the gap's window stays swallowed",s==="000",s);
}
{
  const {inp,w}=stage(true);
  inp.gpThrow(); tick(w,inp); inp.gpFire(true); inp._onBlur();
  const s=pat(w,inp,3);
  check("blur inside the gap's window leaves nothing behind",s==="000",s);
}
{
  const {inp,w}=stage(true);
  const n=()=>w.events.filter((e)=>e.t==="bomb").length;
  inp.gpThrow(); tick(w,inp); inp.gpFire(true);
  for(let k=0;k<600;k++){inp.gpFire(true);tick(w,inp);}
  check("a plant after a throw held for 600 polls plants one bomb: throw + plant, 2 in all",n()===2,n());
}
{
  const {inp,w,p}=stage(true);
  p.bombs=4;
  inp.gpThrow(); tick(w,inp); inp.gpFire(true); tick(w,inp); tick(w,inp); inp.gpFire(false); tick(w,inp);
  inp.gpThrow();
  const s=pat(w,inp,2);
  check("a throw after that gap still throws",s==="T0",s);
}
{
  const inp=new Input(null);
  inp.pulseThrow(); inp.advance(); dn(inp,"Space");
  check("no pad, bare pulseThrow: Space right after stays high, as v200",inp.intent().fire===true&&inp._intent.firePrev===true);
  up(inp,"Space"); inp.advance();
  inp.pulse(); dn(inp,"Space"); inp.advance();
  check("no pad, pulse: the pulse still ends on its tick, as v200",inp._intent.fire===false);
}

// ---- main.js swallow ----
{
  const inp=new Input(null);
  inp._onFireDown({button:0}); inp._intent.fire=false;
  check("main-style input._intent.fire=false swallow still clears a pointer-held fire",inp._intent.fire===false);
  inp.intent(); inp.advance();
  check("the swallow survives a tick",inp._intent.fire===false);
  inp.gpFire(true); inp.advance(); inp.gpFire(false);
  check("a pad press and release cannot resurrect a swallowed pointer",inp._intent.fire===false);
  inp._onFireUp({button:0});
  check("the pointer's own release stays quiet",inp._intent.fire===false);
}
{
  const inp=new Input(null);
  inp._onFireDown({button:0}); inp._intent.fire=false;
  dn(inp,"Space"); up(inp,"Space");
  check("a key press and release cannot resurrect a swallowed pointer",inp._intent.fire===false);
  inp._onFireDown({button:0}); inp._intent.fire=false;
  inp._onFireDown({button:0});
  check("a new pointer press after a swallow latches again",inp._intent.fire===true);
  inp._onFireUp({button:0}); check("and releases",inp._intent.fire===false);
}
{
  const inp=new Input(null);
  inp.gpFire(true); inp.advance(); inp._intent.fire=false;
  inp.gpFire(true); inp.advance();
  check("a swallowed pad hold stays swallowed while still down",inp._intent.fire===false);
  inp.gpFire(false); inp.gpFire(true);
  check("release and press again latches",inp._intent.fire===true);
}
{
  const inp=new Input(null);
  inp._onFireDown({}); inp.pulse(); inp._intent.fire=false;
  inp.pulse(); inp.gpRemote(true); inp.advance(); inp.gpRemote(false);
  check("pulse after a swallow is one tick",inp._intent.fire===false&&inp._intent.remote===false);
}

{
  const inp=new Input(null);
  inp._onFireDown({}); inp._intent.fire=false; inp.pulse(); dn(inp,"Space"); up(inp,"Space");
  check("a stale pointer holder cannot keep fire up through a pulse and a keyup",inp._intent.fire===false);
  inp.advance(); inp._onFireDown({}); inp._intent.fire=false; inp.setIntent({fire:true}); up(inp,"Space");
  check("nor through setIntent and a keyup",inp._intent.fire===false);
  inp.gpRemote(true); inp.advance(); inp._intent.remote=false; inp.pulseRemote(); up(inp,"KeyQ");
  check("a stale pad remote holder cannot keep remote up through pulseRemote and a keyup",inp._intent.remote===false);
}

// ---- axes ----
{
  const inp=new Input(null);
  inp.gpMove(dir("up")); dn(inp,"KeyA"); inp.gpMove({...NONE,up:true,right:true});
  const a=inp.axes;
  check("axes: key left beats pad right on that axis, pad up still passes",a.left===true&&a.right===false&&a.up===true,JSON.stringify(a));
  const m=inp.intent().move;
  check("a held key beats the pad on a mixed axis: a pad never makes a diagonal (Q2, F4)",m.x===-1&&m.y===0,JSON.stringify(m));
  up(inp,"KeyA"); inp.gpMove(dir("up"));
  check("pad direction returns as the key lifts",inp.intent().move.y===-1&&inp.intent().move.x===0);
}
{
  const inp=new Input(null);
  inp.gpMove(dir("left"));
  check("pad axes never touch the held axes",inp.input.left===false&&inp.axes.left===true);
  check("pad left drives intent().move",inp.intent().move.x===-1);
  inp.gpMove(NONE); inp.advance();
  check("pad release stops it",inp.intent().move.x===0&&inp.axes.left===false);
  dn(inp,"KeyW"); inp.gpMove(dir("down"));
  check("a key beats the pad on one axis",inp.axes.up===true&&inp.axes.down===false&&inp.intent().move.y===-1);
  up(inp,"KeyW");
  let two=0;
  for(let k=0,s=7;k<10000;k++){s=(s*1103515245+12345)&0x7fffffff;const ax=["up","down","left","right"][s>>16&3],on=s>>20&1;
    inp.gpMove(on?dir(ax):NONE);const m=inp.intent().move;if(m.x&&m.y)two++;inp.advance();}
  check("F4 fuzz: 10k 4-way pad states never make a diagonal",two===0,two);
  inp.gpMove(NONE); inp.advance();
  dn(inp,"KeyW"); dn(inp,"KeyA");
  const m=inp.intent().move;
  check("keyboard diagonals are unchanged",m.x===-1&&m.y===-1);
  up(inp,"KeyW"); up(inp,"KeyA");
}

// ---- blur ----
{
  const inp=new Input(null);
  inp.gate=YES; inp.gpMove(dir("up")); inp.gpFire(true); inp.gpRemote(true); inp.gpThrow(); dn(inp,"KeyA");
  inp._onBlur();
  const it=inp.intent();
  check("blur clears pad state",!it.fire&&!it.remote&&!it.shift&&it.move.x===0&&it.move.y===0&&inp.axes.up===false);
  inp.advance(); inp.advance();
  check("blur leaves no deferred release or throw behind",!inp._intent.fire&&!inp._intent.shift&&!inp._intent.remote);
  inp.gpFire(true); check("a press after blur latches again",inp._intent.fire===true);
  inp.advance(); inp.gpFire(false); inp.gpMove(dir("up")); inp.gpMove(NONE); inp._onBlur();
  check("blur drops a pending tap",inp.intent().move.y===0);
}

// ---- guard ----
{
  const inp=new Input(null); let pz=0,ui=0,seen=[];
  inp.onPause=()=>pz++; inp.onUiKey=()=>ui++;
  inp.guard=(e)=>{seen.push(e.code);return true;};
  for(const c of ["Escape","KeyP","Space","KeyW","KeyQ","ShiftLeft"])dn(inp,c);
  check("guard=true: onPause and onUiKey never run",pz===0&&ui===0,pz+"/"+ui);
  check("guard=true: no held key set",!inp.input.up&&!inp._intent.fire&&!inp._intent.remote&&!inp._intent.shift);
  check("guard sees the codes in order",seen.join()==="Escape,KeyP,Space,KeyW,KeyQ,ShiftLeft");
  inp.gate=YES; dn(inp,"KeyE"); check("guard=true: solo THROW never runs",!inp._intent.fire);
  inp.guard=()=>false; dn(inp,"KeyW");
  check("guard=false: keys flow",inp.input.up===true&&ui===1);
  inp.guard=()=>true; up(inp,"KeyW");
  check("keyup always runs, so a key held into capture cannot stick",inp.input.up===false);
  inp.guard=null; dn(inp,"Space");
  check("guard=null: keys flow",inp._intent.fire===true);
  const e=ev("Space"); const g2=new Input(null); g2.guard=()=>true; g2._onKey(e);
  check("guard=true still stops Space scrolling the page",e.pd===true);
}

// ---- existing touch path ----
{
  const inp=new Input(null);
  inp.padFire(true); check("existing virtual-pad padFire latches",inp._intent.fire===true&&inp._pulse===false);
  inp.padFire(false); check("existing virtual-pad padFire releases at once",inp._intent.fire===false);
  inp.padFire(true); inp.intent(); inp.advance(); check("held through a tick",inp._intent.fire===true&&inp._intent.firePrev===true);
  inp.padFire(false); inp.advance(); check("firePrev follows",inp._intent.firePrev===false);
  inp._onFireDown({button:2}); check("non-primary button ignored",inp._intent.fire===false);
  const p=new Input(null);
  check("pulseThrow stays ungated",p.pulseThrow()===true&&p._intent.fire&&p._intent.shift);
  p.advance(); check("pulseThrow one tick",!p._intent.fire&&!p._intent.shift);
  p._onFireDown({}); check("pulseThrow with fire held is a no-op",p.pulseThrow()===false); p._onFireUp({});
  check("pulseRemote one tick",p.pulseRemote()===true&&p._intent.remote===true); p.advance();
  check("pulseRemote clears",p._intent.remote===false);
  p.pulse(); dn(p,"Space"); up(p,"Space");
  check("Space keyup during a pulse clears it, as today",p._intent.fire===false); p.advance();
  p.setIntent({fire:true}); up(p,"Space"); check("setIntent fire then keyup clears, as today",p._intent.fire===false);
  p.setIntent({move:{x:1,y:0}}); check("setIntent writes held axes",p.input.right===true&&p.intent().move.x===1);
}

// ---- with no pad, keys and the pointer share one latch (lead ruling) ----
{
  const inp=new Input(null);
  dn(inp,"Space"); inp._onFireDown({}); inp._onFireUp({});
  check("pointer release still cancels a held Space",inp._intent.fire===false);
  up(inp,"Space"); inp._onFireDown({}); dn(inp,"Space"); up(inp,"Space");
  check("Space keyup still cancels a held pointer",inp._intent.fire===false);
  inp._onFireUp({}); dn(inp,"Space"); inp._onFireUp({}); inp._onFireDown({});
  check("so a tap with Space held makes a new fire, as today",inp._intent.fire===true);
  inp._onFireUp({}); dn(inp,"KeyJ"); dn(inp,"Space"); up(inp,"KeyJ");
  check("one fire key up clears a second held one, as today",inp._intent.fire===false);
}
/* Input as of shell v200, verbatim: the reference for every no-pad sequence. */
class OldInput {
  constructor(el){
    this._intent={move:{x:0,y:0}, fire:false, firePrev:false,
      shift:false, remote:false};
    this.onUiKey=null;
    this.el=el;
    this._onKey=this._onKey.bind(this);
    this._onKeyUp=this._onKeyUp.bind(this);
    this._onFireDown=this._onFireDown.bind(this);
    this._onFireUp=this._onFireUp.bind(this);
    this._onBlur=this._onBlur.bind(this);
    this._attach();
    }
 _attach(){
    if(typeof window!=="undefined"){
      window.addEventListener("keydown",this._onKey);
      window.addEventListener("keyup",this._onKeyUp);
      window.addEventListener("blur",this._onBlur);
      if(typeof document!=="undefined" && document)
        document.addEventListener("visibilitychange",this._onBlur);
     }
    // element listeners need no window: headless tests exercise the SAME
    // registration order as the browser (Input's fire latch before main.js)
    if(this.el){
      this.el.addEventListener("pointerdown",this._onFireDown);
      this.el.addEventListener("pointerup",this._onFireUp);
      this.el.addEventListener("pointercancel",this._onFireUp);
      this.el.addEventListener("pointerleave",this._onFireUp);
       }
     }
 _onKey(e){
    const i=this._intent;
    if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyJ","KeyX"].indexOf(e.code)>=0)e.preventDefault();
    if(e.repeat)return;   // OS auto-repeat: one logical press per physical press
    /* Pause BEFORE the shell sees the key: P / Escape pause the screen they
       were pressed on, never a run the same key just booted from INTRO or
       ATTRACT. */
    const pz=e.code==="KeyP"||e.code==="Escape";
    if(pz&&this.onPause)this.onPause();
    if(this.onUiKey)this.onUiKey(e.code);
    if(pz)return;
    switch(e.code){
      case "KeyW":case "ArrowUp":this.input.up=true;break;
      case "KeyS":case "ArrowDown":this.input.down=true;break;
      case "KeyA":case "ArrowLeft":this.input.left=true;break;
      case "KeyD":case "ArrowRight":this.input.right=true;break;
      case "Space":case "KeyJ":case "KeyX":i.fire=true;break;
      case "ShiftLeft":case "ShiftRight":i.shift=true;break;
      case "KeyQ":i.remote=true;break;
      }
     }
 _onKeyUp(e){
    const i=this._intent;
    switch(e.code){
      case "KeyW":case "ArrowUp":this.input.up=false;break;
      case "KeyS":case "ArrowDown":this.input.down=false;break;
      case "KeyA":case "ArrowLeft":this.input.left=false;break;
      case "KeyD":case "ArrowRight":this.input.right=false;break;
      case "Space":case "KeyJ":case "KeyX":i.fire=false;i.remote=false;break;
      case "ShiftLeft":case "ShiftRight":i.shift=false;break;
      case "KeyQ":i.remote=false;break;
      }
    }
 /* Camera §2: non-primary buttons never touch the fire latch (undefined ->
    primary so padFire({})/keyboard stay intact). */
 _onFireDown(e){ if(e&&e.button!==undefined&&e.button!==0)return;
   this._intent.fire=true; this._pulse=false; }
 _onFireUp(e){ if(e&&e.button!==undefined&&e.button!==0)return;
   this._intent.fire=false; }
 /* Virtual-pad fire routing: delegates to the SAME latch handlers the canvas
    tap uses, so pad bombs ride the existing fire-edge/advance() path. */
 padFire(down){ down?this._onFireDown({}):this._onFireUp({}); }
 _onBlur(){
    this.input.up=this.input.down=this.input.left=this.input.right=false;
    this._intent.fire=false;this._intent.shift=false;this._intent.remote=false;
    this._intent.firePrev=false;this._pulse=false;this._pShift=false;this._pRemote=false;
     }
 get input(){ // held-axis state (live)
    if(!this._held)this._held={up:false,down:false,left:false,right:false};
    return this._held;
    }
 /* Build THIS tick's intent (movement recomputed from held axes; fire etc.
    live on the intent, and firePrev is updated by `advance`). */
 intent(){
    const h=this.input;
    const i=this._intent;
    let mx=0,my=0;
    if(h.up)my=-1; else if(h.down)my=1;
    if(h.left)mx=-1; else if(h.right)mx=1;
    i.move.x=mx; i.move.y=my;
    return i;
     }
 /* Advance the fire-edge latch after a tick. A pulse() fire lives for exactly
    one tick, so step() sees one edge and nothing stays latched behind it. */
 advance(){ this._intent.firePrev=this._intent.fire;
   if(this._pulse){this._pulse=false;this._intent.fire=false;}
   if(this._pShift){this._pShift=false;this._intent.shift=false;}
   if(this._pRemote){this._pRemote=false;this._intent.remote=false;} }
 /* One fire edge with no key held behind it (Enter on WIN / LOSE). A fire
    already held keeps its own latch and release. */
 pulse(){ if(this._intent.fire)return; this._intent.fire=true; this._pulse=true; }
 /* Touch THROW / REMOTE buttons: the keyboard's Shift+Space and Q as one-tick
    intents on the same advance(), never latches. A fire already held (bomb
    button, Space) makes THROW a no-op, as Shift pressed mid-hold is on keys. */
 pulseThrow(){ if(this._intent.fire)return false;
   if(!this._intent.shift){this._intent.shift=true;this._pShift=true;}
   this.pulse(); return true; }
 pulseRemote(){ if(this._intent.remote)return false;
   this._intent.remote=true; this._pRemote=true; return true; }
 /* Set intent fields programmatically (tests / external control). */
 setIntent(o){
    for(const k in o){
      if(k==="move"||k==="up"||k==="down"||k==="left"||k==="right"){
        // movement: set held axes; the next intent() picks them up
        const h=this.input;
        if(k==="move"){h.left=o.move.x<0; h.right=o.move.x>0;
          h.up=o.move.y<0; h.down=o.move.y>0;}
        else h[k]=!!o[k];
         } else this._intent[k]=o[k];
      }
     }
}
{
  const KEYS=["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowLeft","ArrowRight","ArrowDown","Space","KeyJ","KeyX","ShiftLeft","ShiftRight","KeyQ","KeyP","Escape","KeyE","KeyK","Slash"];
  const run=(mode,seed,n)=>{
    let s=seed; const r=(m)=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return (s>>>8)%m;};
    const a=new OldInput(null),b=new Input(null),la=[],lb=[];
    a.onUiKey=(c)=>la.push(c);b.onUiKey=(c)=>lb.push(c);a.onPause=()=>la.push("P");b.onPause=()=>lb.push("P");
    if(mode==="defaults")b.setKeyBinds(KB);
    for(let k=0;k<n;k++){
      const c=KEYS[r(KEYS.length)],pd=[0,0],op=r(16),x=r(3)-1,rep=r(8)===0;
      const e=(j)=>({code:c,key:"",repeat:rep,preventDefault(){pd[j]++;}});
      for(const [i,j] of [[a,0],[b,1]]) switch(op){
        case 0:case 1:i._onKey(e(j));break;
        case 2:case 3:i._onKeyUp(e(j));break;
        case 4:i.intent();break;
        case 5:i.intent();i.advance();break;
        case 6:i.pulse();break;
        case 7:case 8:i._onFireDown({});break;
        case 9:i._onFireUp({});break;
        case 10:i.pulseThrow();break;
        case 11:i.pulseRemote();break;
        case 12:i._intent.fire=false;break;
        case 13:if(x===0&&rep)i._onBlur();break;
        case 14:if(rep)i.setIntent({fire:x>0});else i.setIntent({move:{x,y:0}});break;
        case 15:i.padFire(x>=0);break;
      }
      const v=(i,j)=>JSON.stringify([i._intent,i.input,!!i._pulse,!!i._pShift,!!i._pRemote,pd[j]]);
      if(v(a,0)!==v(b,1)||la.join()!==lb.join())return "op "+op+" "+c+" at "+k+": "+v(a,0)+" vs "+v(b,1);
    }
    return null;
  };
  for(const mode of ["never bound","defaults"]){
    let bad=0,first=null;
    for(let t=1;t<=500;t++){const d=run(mode,t*7919,400);if(d){bad++;first=first||d;}}
    check("old vs new, no pad, keys and pointer mixed, swallows included, binds "+mode+": 0 divergences in 500 runs x 400 ops",bad===0,bad?bad+" "+first:undefined);
  }
}

// ---- the local default table cannot drift from the model ----
{
  const c=await import("../src/app/controls.js");
  if(c.DEF_KEY&&c.softAliases){
    check("Input's default table equals DEF_KEY",JSON.stringify(c.DEF_KEY)===JSON.stringify(KB),JSON.stringify(c.DEF_KEY));
    const cases=[{},{BOMB:"KeyZ"},{REMOTE:"KeyX"},{THROW:"KeyJ"},{PAUSE:"KeyJ",REMOTE:"KeyX"},{MOVE:["KeyI","KeyL","KeyK","KeyJ"]}];
    for(const o of cases){
      const kb={...KB,...o}, inp=new Input(null); inp.setKeyBinds(kb);
      const al=[...c.softAliases({...c.DEF_CONTROLS,key:kb})].sort().join();
      const mine=[...inp._alias].sort().join();
      check("alias rule matches controls.softAliases for "+JSON.stringify(o),al===mine,al+" vs "+mine);
    }
  } else console.log("  SKIP T1 parity: controls.js not ready");
}

console.log("\n  INPUT-PAD RESULT: "+pass+" PASS / "+fail+" FAIL");
process.exit(fail?1:0);
