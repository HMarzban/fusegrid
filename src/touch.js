import {paintBombPad} from "./render/sprites.js";
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
  const unbindPad=bind(padEl,"pad"), unbindBomb=bind(bombEl,"bomb");
  let shown=false;
  return {
    update(inGame){          // visible ONLY in GAME; hide clears held state
      if(inGame===shown)return;
      shown=inGame; box.hidden=!inGame;
      if(!inGame)map.clear();
     },
    unmount(){ unbindPad(); unbindBomb(); shown=false; box.hidden=true;
      map.clear(); }
   };
 }
