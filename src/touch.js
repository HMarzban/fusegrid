import {paintBombPad} from "./render/sprites.js";
import {drawIcon} from "./render/icons.js";
import {POWER} from "./core/entities.js";
/* TOUCH CONTROLS — virtual pad over the existing Input pipeline (spec §1-§4).
   PadMapper is the headless core: pure zone math, mutates input ONLY via
   setIntent/padFire, Node-testable with zero DOM. DOM mounting lives behind a
   document guard; desktop builds nothing. NO canvas listeners anywhere — the
   menu-shell pointer swallow stays intact. */
const DEAD=0.2;   // 20% center dead zone (§2)

export function hasTouch(w){ return !!w&&("ontouchstart" in w); }

/* 4-way cross quadrants from clientX/Y inside the element rect */
function zoneOf(x,y,r){
  const fx=(x-r.left)/r.width-.5, fy=(y-r.top)/r.height-.5;
  if(Math.abs(fx)<DEAD/2&&Math.abs(fy)<DEAD/2)return null;
  return Math.abs(fx)>Math.abs(fy)?{x:fx>0?1:-1,y:0}:{x:0,y:fy>0?1:-1};
}

/* Per-control single-pointer claims (§4): pad and bomb each track ONE pid;
   a second finger on the same control is ignored, moves re-zone the pad only. */
export class PadMapper{
  constructor(input){
    this.input=input;
    this.padPid=null; this.bombPid=null;
   }
  down(pid,x,y,rect){
    /* THROW / REMOTE are taps, not holds: no claim, one-tick intents */
    if(rect&&rect.kind==="throw")return this.input.pulseThrow();
    if(rect&&rect.kind==="remote")return this.input.pulseRemote();
    if(rect&&rect.kind==="bomb"){
      if(this.bombPid!==null&&this.bombPid!==pid)return false;
      this.bombPid=pid; this.input.padFire(true); return true;
     }
    if(this.padPid!==null&&this.padPid!==pid)return false;
    this.padPid=pid;
    const z=zoneOf(x,y,rect);
    this.input.setIntent({move:z||{x:0,y:0}});
    return true;
   }
  move(pid,x,y,rect){
    if(pid!==this.padPid)return false;   // bomb is binary; stale pids ignored
    const z=zoneOf(x,y,rect);
    this.input.setIntent({move:z||{x:0,y:0}});
    return true;
   }
  up(pid){
    if(pid===this.padPid){ this.padPid=null;
      this.input.setIntent({move:{x:0,y:0}}); return true; }
    if(pid===this.bombPid){ this.bombPid=null;
      this.input.padFire(false); return true; }
    return false;                        // stale release: no-op
   }
  clear(){                               // screen exit mid-hold unsticks all
    this.padPid=null; this.bombPid=null;
    this.input.setIntent({move:{x:0,y:0}});
    this.input.padFire(false);
   }
}

/* DOM build/wiring. Returns {update(inGame),unmount()}; headless/desktop get a
   no-op stub (zero DOM added, zero listeners — acceptance #1). */
export function mountTouch(input,stage){
  const w=typeof window!=="undefined"?window:null;
  if(!w||typeof document==="undefined"||!stage||!hasTouch(w))
    return {update(){},unmount(){}};
  let box=document.getElementById("touchpad");
  if(!box){   // static skeleton missing: build it so any host page works
    box=document.createElement("div"); box.id="touchpad"; box.hidden=true;
    const d=document.createElement("div"); d.id="tpad";
    d.setAttribute("role","group"); d.setAttribute("aria-label","Move pad");
    const b=document.createElement("div"); b.id="tbomb";
    b.setAttribute("role","button"); b.setAttribute("aria-label","Bomb");
    box.appendChild(d); box.appendChild(b); stage.appendChild(box);
   }
  const padEl=box.querySelector("#tpad"), bombEl=box.querySelector("#tbomb");
  paintBombPad(bombEl);
  let pauseEl=box.querySelector("#tpause");
  if(!pauseEl){   // static skeleton missing the pill: build it
    pauseEl=document.createElement("div"); pauseEl.id="tpause";
    pauseEl.setAttribute("role","button");
    pauseEl.setAttribute("aria-label","Pause");
    box.appendChild(pauseEl);
   }
  /* THROW / REMOTE: icon + POWER[].name, built if the skeleton lacks them */
  const act=["throw","remote"].map((k)=>{
    let el=box.querySelector("#t"+k);
    const pw=POWER.find((q)=>q.t===k);
    if(!el){ el=document.createElement("div"); el.id="t"+k;
      el.setAttribute("role","button");
      el.setAttribute("aria-label",pw.name[0]+pw.name.slice(1).toLowerCase());
      box.insertBefore?box.insertBefore(el,pauseEl):box.appendChild(el); }
    paintActPad(el,k,pw);
    el.hidden=true; return el; });
  const map=new PadMapper(input);
  const snap=(el)=>{ const r=el.getBoundingClientRect();
    return {left:r.left,top:r.top,width:r.width,height:r.height}; };
  const bind=(el,kind)=>{
    const h={
      down:(e)=>{ e.preventDefault();
        try{ el.setPointerCapture(e.pointerId); }catch(_){}
        map.down(e.pointerId,e.clientX,e.clientY,{...snap(el),kind}); },
      move:(e)=>{ map.move(e.pointerId,e.clientX,e.clientY,snap(el)); },
      up:(e)=>{ map.up(e.pointerId); }     // idempotent for stale/duplicate
     };
    el.addEventListener("pointerdown",h.down);
    el.addEventListener("pointermove",h.move);
    el.addEventListener("pointerup",h.up);
    el.addEventListener("pointercancel",h.up);
    el.addEventListener("lostpointercapture",h.up);
    return ()=>{ el.removeEventListener("pointerdown",h.down);
      el.removeEventListener("pointermove",h.move);
      el.removeEventListener("pointerup",h.up);
      el.removeEventListener("pointercancel",h.up);
      el.removeEventListener("lostpointercapture",h.up); };
   };
  const unbindPad=bind(padEl,"pad"), unbindBomb=bind(bombEl,"bomb"),
    unbindAct=[bind(act[0],"throw"),bind(act[1],"remote")];
  /* The pill is not a PadMapper control — it has no zones and no claim, it
     just calls the same onPause the P key does. */
  const onPauseTap=(e)=>{ if(e&&e.preventDefault)e.preventDefault();
    if(input.onPause)input.onPause(); };
  pauseEl.addEventListener("pointerdown",onPauseTap);
  const unbindPause=()=>pauseEl.removeEventListener("pointerdown",onPauseTap);
  box.hidden=true; padEl.hidden=false; bombEl.hidden=false;
  pauseEl.hidden=false;
  let shown=false, played=false, has=[false,false];
  return {
    /* Visible ONLY in GAME; INSIDE game the move pad and the bomb button
       additionally hide whenever the world is not PLAYing, because a 128px pad
       and a 72px button sit in the same corners as the pause rows and would
       swallow taps aimed at them. The pill stays — it is how a touch player
       resumes. Hiding either clears held state. THROW / REMOTE show only
       while PLAYing AND the player (p) holds that power. */
    update(inGame, playing, p){
      const ig=!!inGame, pl=playing===undefined?ig:!!playing;
      if(ig!==shown){ shown=ig; box.hidden=!ig; if(!ig)map.clear(); }
      if(pl!==played){
        played=pl; padEl.hidden=!pl; bombEl.hidden=!pl;
        if(!pl)map.clear();
       }
      const h=[pl&&!!(p&&p.throw),pl&&!!(p&&p.remote)];
      for(let i=0;i<2;i++)if(h[i]!==has[i]){ has[i]=h[i]; act[i].hidden=!h[i]; }
     },
    unmount(){ unbindPad(); unbindBomb(); unbindPause(); unbindAct.forEach((f)=>f());
      has=[false,false]; act.forEach((el)=>{ el.hidden=true; });
      shown=false; played=false; box.hidden=true; map.clear(); }
   };
 }
function paintActPad(el,k,pw){
  let cv=el.querySelector("canvas"), lb=el.querySelector("span");
  if(!cv&&typeof document!=="undefined"){ cv=document.createElement("canvas");
    cv.setAttribute("aria-hidden","true"); el.appendChild(cv); }
  if(!lb&&typeof document!=="undefined"){ lb=document.createElement("span"); el.appendChild(lb); }
  if(lb)lb.textContent=pw.name;
  const ctx=cv&&cv.getContext&&cv.getContext("2d");
  if(!ctx)return false;
  cv.width=48; cv.height=48;
  ctx.clearRect(0,0,48,48); ctx.save(); ctx.translate(24,25); ctx.scale(1.6,1.6);
  drawIcon(ctx,k,pw.col,0); ctx.restore();
  return true;
}
