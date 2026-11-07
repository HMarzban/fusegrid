/* INPUT LAYER — the only module that talks to the DOM. Maps key/pointer events
   into a clean `input` object and produces per-tick `intents` for the sim.
   The simulation never sees the DOM; it only receives intent structs. */
const DEF_KEYS={BOMB:"Space",THROW:"KeyE",REMOTE:"KeyQ",PAUSE:"KeyP",MOVE:["KeyW","KeyD","KeyS","KeyA"]};
const MOVE_AX=["up","right","down","left"];
const ARROWS=[["ArrowUp","up"],["ArrowRight","right"],["ArrowDown","down"],["ArrowLeft","left"]];
const SOFT=["KeyJ","KeyX"];
const axesOff=()=>({up:false,down:false,left:false,right:false});
const holders=()=>({key:false,pad:false});
const pairOff=()=>({fire:false,remote:false});
export class Input {
  constructor(el){
    this._intent={move:{x:0,y:0}, fire:false, firePrev:false,
      shift:false, remote:false};
    this.onUiKey=null;
    /* guard(e) true = capture owns this key; gate.canThrow() = THROW may fire. */
    this.guard=null;
    this.gate=null;
    this._hold={fire:holders(),remote:holders()};
    this._padReset();
    this._binds(DEF_KEYS);
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
 /* Key tables for the binds. Default binds prevent today's seven codes; a
    non-default bind adds its code, except on a browser chord (Cmd+P stays print). */
 _binds(kb){
    const k=this._kb={...DEF_KEYS,...kb};
    this._axis=new Map(ARROWS);
    k.MOVE.forEach((c,n)=>this._axis.set(c,MOVE_AX[n]));
    const used=[...k.MOVE,k.BOMB,k.THROW,k.REMOTE,k.PAUSE];
    this._alias=new Set(k.BOMB==="Space"?SOFT.filter((c)=>!used.includes(c)):[]);
    this._pd=new Set(["Space",...ARROWS.map((a)=>a[0]),...this._alias]);
    const D=DEF_KEYS;
    this._pdBound=new Set([...k.MOVE.filter((c,n)=>c!==D.MOVE[n]),
      ...["BOMB","THROW","REMOTE","PAUSE"].filter((a)=>k[a]!==D[a]).map((a)=>k[a])]);
    }
 /** Apply a key bind table (Controls.key); null = the default table. Held keys are let go. */
 setKeyBinds(kb){
    this._binds(kb);
    const h=this.input; h.up=h.down=h.left=h.right=false;
    this._latch("fire","key",false);
    this._latch("remote","key",false);
    }
 /* The one writer of fire / remote held state. Keys and the pointer share the
    `key` holder, so with no pad a release of either cancels both, as ever; only
    the pad holds apart. _intent stays THE latch: a false there with a holder
    still set means main.js or the camera swallowed the press, so the holders
    die with it and no later release can resurrect it. */
 _swallowed(f){ if(!this._intent[f]){const h=this._hold[f];h.key=h.pad=false;} }
 _latch(f,src,down){
    const i=this._intent,h=this._hold[f];
    this._swallowed(f);
    h[src]=down;
    const pu=f==="fire"?this._pulse&&(src==="pad"||this._keep):this._pRemote&&src==="pad";
    i[f]=h.key||h.pad||!!pu;
    }
 /* A solo THROW press. The sim throws only on a rising fire, so a fire this tick
    or the last one gets a one-tick gap first (the thumb roll). Fire held by
    another source stays a no-op. The hold is dropped, so it is spent until pressed again. */
 _throw(src){
    const g=this.gate,i=this._intent,h=this._hold.fire;
    if(!g||!g.canThrow()||this._roll)return false;
    if(i.fire&&(this._pulse||!h[src]||(h.key&&h.pad)))return false;
    if(i.fire||i.firePrev){
      this._roll=src;
      if(i.fire&&i.firePrev)this._latch("fire",src,false);
      return true;
      }
    this.pulseThrow();this._keep=true;return true;
    }
 _onKey(e){
    const c=e.code,k=this._kb;
    if(this._pd.has(c)||(this._pdBound.has(c)&&!e.metaKey&&!e.ctrlKey&&!e.altKey))e.preventDefault();
    if(this.guard&&this.guard(e))return;
    if(e.repeat)return;   // OS auto-repeat: one logical press per physical press
    /* Pause BEFORE the shell sees the key: P / Escape pause the screen they
       were pressed on, never a run the same key just booted from INTRO or
       ATTRACT. */
    const pz=c===k.PAUSE||c==="Escape";
    if(pz&&this.onPause)this.onPause();
    if(this.onUiKey)this.onUiKey(c);
    if(pz)return;
    const ax=this._axis.get(c);
    if(ax)this.input[ax]=true;
    else if(c===k.BOMB||this._alias.has(c))this._latch("fire","key",true);
    else if(c==="ShiftLeft"||c==="ShiftRight")this._intent.shift=true;
    else if(c===k.REMOTE)this._latch("remote","key",true);
    else if(c===k.THROW)this._throw("key");
     }
 _onKeyUp(e){
    const c=e.code,k=this._kb,ax=this._axis.get(c);
    if(ax)this.input[ax]=false;
    else if(c===k.BOMB||this._alias.has(c)){this._latch("fire","key",false);this._latch("remote","key",false);}
    else if(c==="ShiftLeft"||c==="ShiftRight")this._intent.shift=false;
    else if(c===k.REMOTE)this._latch("remote","key",false);
    }
 /* Camera §2: non-primary buttons never touch the fire latch (undefined ->
    primary so padFire({})/keyboard stay intact). */
 _onFireDown(e){ if(e&&e.button!==undefined&&e.button!==0)return;
   if(!this._keep)this._pulse=false; this._latch("fire","key",true); }
 _onFireUp(e){ if(e&&e.button!==undefined&&e.button!==0)return;
   this._latch("fire","key",false); }
 /* Virtual-pad fire routing: delegates to the SAME latch handlers the canvas
    tap uses, so pad bombs ride the existing fire-edge/advance() path. */
 padFire(down){ down?this._onFireDown({}):this._onFireUp({}); }
 _padReset(){
    this._pad=axesOff();this._tap=null;
    this._padDn=pairOff();this._fresh=pairOff();this._rel=pairOff();
    this._roll=null;this._keep=false;this._after=false;this._gap=false;
    }
 /* Pad button edges; a repeat of the same level is ignored, so a press spent by
    a roll or a swallow stays spent until seen released. A release before any
    tick ran waits for advance(): a tap shorter than a tick still fires once. */
 _padEdge(f,down){
    down=!!down;
    if(down===this._padDn[f])return;
    this._padDn[f]=down;
    if(down){
      if(f==="fire"){if(!this._keep)this._pulse=false;} else this._pRemote=false;
      this._rel[f]=false;this._fresh[f]=true;this._latch(f,"pad",true);
      }
    else if(this._fresh[f])this._rel[f]=true;
    else this._latch(f,"pad",false);
    }
 /** Pad BOMB level. */
 gpFire(down){ this._padEdge("fire",down); }
 /** Pad REMOTE level. */
 gpRemote(down){ this._padEdge("remote",down); }
 /** Pad THROW press, gated; returns whether a throw is on its way. */
 gpThrow(){ return this._throw("pad"); }
 /** Pad held axes, never _held. menu = true on the menu layer, where no tick
     would spend a tap: it leaves no latch for the first tick of a run. */
 gpMove(d,menu){
    const p=this._pad;
    let rise=false;
    for(const a of MOVE_AX){ const on=!!d[a]; if(on&&!p[a])rise=true; p[a]=on; }
    if(menu)this._tap=null; else if(rise)this._tap={...p};
    }
 /** Merged held axes for menus: per axis the key / touch value wins, else the pad's. */
 get axes(){
    const h=this.input,p=this._pad,v=h.up||h.down,s=h.left||h.right;
    return {up:v?h.up:p.up,down:v?h.down:p.down,left:s?h.left:p.left,right:s?h.right:p.right};
    }
 _onBlur(){
    this.input.up=this.input.down=this.input.left=this.input.right=false;
    this._intent.fire=false;this._intent.shift=false;this._intent.remote=false;
    this._intent.firePrev=false;this._pulse=false;this._pShift=false;this._pRemote=false;
    const f=this._hold.fire,r=this._hold.remote;
    f.key=f.pad=r.key=r.pad=false;
    this._padReset();
     }
 get input(){ // held-axis state (live)
    if(!this._held)this._held={up:false,down:false,left:false,right:false};
    return this._held;
    }
 /* Build THIS tick's intent (movement recomputed from held axes; fire etc.
    live on the intent, and firePrev is updated by `advance`). */
 intent(){
    /* Keys / touch beat the pad whole, so a pad can never make a diagonal. */
    const k=this.input,p=this._pad;
    const h=k.up||k.down||k.left||k.right?k:p.up||p.down||p.left||p.right?p:this._tap||k;
    const i=this._intent;
    let mx=0,my=0;
    if(h.up)my=-1; else if(h.down)my=1;
    if(h.left)mx=-1; else if(h.right)mx=1;
    i.move.x=mx; i.move.y=my;
    this._gapIn();
    return i;
     }
 /* The sim's fireEdge is still up the tick after a THROW pulse, so a fire raised
    then would be no edge: it sits low for this tick, as in the thumb roll. Taken
    here, not on the press, so a swallow of _intent.fire before the tick still wins. */
 _gapIn(){ if(this._after&&this._intent.fire){this._intent.fire=false;this._gap=true;} }
 /* Advance the fire-edge latch after a tick. A pulse() fire lives for exactly
    one tick, so step() sees one edge and nothing stays latched behind it. */
 advance(){ this._gapIn();
   const i=this._intent,h=this._hold.fire,up=this._gap,thrown=this._pulse&&this._keep&&i.fire;
   i.firePrev=i.fire;
   if(this._pulse){this._pulse=false;i.fire=false;this._keep=false;}
   if(this._pShift){this._pShift=false;this._intent.shift=false;}
   if(this._pRemote){this._pRemote=false;this._intent.remote=false;}
   this._tap=null;
   this._gap=false;this._after=!!thrown;
   /* A hold pressed under the pulse, or waiting out the gap, goes high now; a pending tap's release waits for that tick. */
   const wait=(up||thrown)&&(h.key||h.pad);
   if(wait)i.fire=true;
   for(const f of ["fire","remote"]) if(this._fresh[f]&&!(wait&&f==="fire")){this._fresh[f]=false;
     if(this._rel[f]){this._rel[f]=false;this._latch(f,"pad",false);}}
   if(this._roll)this._rollTick(); }
 /* One step of a pending throw: keep fire down for a whole tick, then the edge. */
 _rollTick(){
    const i=this._intent,r=this._roll;
    if(i.firePrev){
      if(i.fire&&this._hold.fire[r])this._latch("fire",r,false);
      if(i.fire)this._roll=null;
      return;
      }
    this._roll=null;
    if(this.gate&&this.gate.canThrow()&&this.pulseThrow())this._keep=true;
    }
 /* One fire edge with no key held behind it (Enter on WIN / LOSE). A fire
    already held keeps its own latch and release. */
 pulse(){ if(this._intent.fire)return; this._swallowed("fire"); this._intent.fire=true; this._pulse=true; }
 /* Touch THROW / REMOTE buttons: the keyboard's Shift+Space and Q as one-tick
    intents on the same advance(), never latches. A fire already held (bomb
    button, Space) makes THROW a no-op, as Shift pressed mid-hold is on keys. */
 pulseThrow(){ if(this._intent.fire)return false;
   if(!this._intent.shift){this._intent.shift=true;this._pShift=true;}
   this.pulse(); return true; }
 pulseRemote(){ if(this._intent.remote)return false;
   this._swallowed("remote"); this._intent.remote=true; this._pRemote=true; return true; }
 /* Set intent fields programmatically (tests / external control). */
 setIntent(o){
    for(const k in o){
      if(k==="move"||k==="up"||k==="down"||k==="left"||k==="right"){
        // movement: set held axes; the next intent() picks them up
        const h=this.input;
        if(k==="move"){h.left=o.move.x<0; h.right=o.move.x>0;
          h.up=o.move.y<0; h.down=o.move.y>0;}
        else h[k]=!!o[k];
         } else { if(k==="fire"||k==="remote")this._swallowed(k); this._intent[k]=o[k]; }
      }
     }
}
