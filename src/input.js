/* INPUT LAYER — the only module that talks to the DOM. Maps key/pointer events
   into a clean `input` object and produces per-tick `intents` for the sim.
   The simulation never sees the DOM; it only receives intent structs. */
export class Input {
  constructor(el){
    this._intent={move:{x:0,y:0}, fire:false, firePrev:false,
      shift:false, remote:false, kick:false};
    this.el=el;
    this._onKey=this._onKey.bind(this);
    this._onKeyUp=this._onKeyUp.bind(this);
    this._onFire=this._onFire.bind(this);
    this._onBlur=this._onBlur.bind(this);
    this._attach();
    }
 _attach(){
    if(typeof window==="undefined")return;
    window.addEventListener("keydown",this._onKey);
    window.addEventListener("keyup",this._onKeyUp);
    window.addEventListener("blur",this._onBlur);
    if(document)document.addEventListener("visibilitychange",this._onBlur);
    if(this.el){
      this.el.addEventListener("pointerdown",this._onFire);
      this.el.addEventListener("pointerup",this._onFire);
       }
    }
 _onKey(e){
    const i=this._intent;
    switch(e.code){
      case "KeyW":case "ArrowUp":this.input.up=true;break;
      case "KeyS":case "ArrowDown":this.input.down=true;break;
      case "KeyA":case "ArrowLeft":this.input.left=true;break;
      case "KeyD":case "ArrowRight":this.input.right=true;break;
      case "Space":case "KeyJ":case "KeyX":i.fire=true;break;
      case "ShiftLeft":case "ShiftRight":i.shift=true;break;
      case "KeyQ":i.remote=true;break;
      case "KeyK":i.kick=true;break;
      case "KeyP":case "Escape":this.onPause&&this.onPause();return;
      }
     /* keep the held-state on the intent so the movement axes stay stable
        between ticks; movement axes are recomputed from held keys each tick */
    if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyJ","KeyX"].indexOf(e.code)>=0 && e.code !== "KeyP" && e.code !== "Escape")e.preventDefault();
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
      case "KeyK":i.kick=false;break;
      }
    }
 _onFire(e){ this._intent.fire=true; }
 _onBlur(){
    this.input.up=this.input.down=this.input.left=this.input.right=false;
    this._intent.fire=false;this._intent.shift=false;this._intent.remote=false;
    this._intent.firePrev=false;
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
 /* Advance the fire-edge latch after a tick. */
 advance(){ this._intent.firePrev=this._intent.fire; }
 /* Set intent fields programmatically (tests / external control). */
 setIntent(o){
    for(const k in o){
      if(k==="move"||k==="up"||k==="down"||k==="left"||k==="right"){
        // movement: set held axes; the next intent() picks them up
        if(k==="move"){this._held.left=!!o.move.x*-1; this._held.right=!!o.move.x; this._held.up=!!o.move.y*-1; this._held.down=!!o.move.y;}
        else this._held[k]=!!o[k];
         } else this._intent[k]=o[k];
      }
     }
}
