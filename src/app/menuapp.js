// APP SHELL STATE MACHINE — pure logic, no canvas/DOM. Owns BOOT->INTRO->MENU
// <-> subscreens -> GAME routing outside the sim (spec §1). The sim's world is
// untouched; nothing here is ever read by step().
//
// update(dt, input) input contract: { input:{up,down,left,right},  // held axes,
//   live via Input's public getter; confirmHeld:boolean }           // held fire
// Confirm/repeat edges are computed here: rising-edge only, repeats 350ms then
// 110ms. key(code) is the discrete side-channel (Enter/Esc/Backspace/M +
// arrows/WASD as taps); taps are handed to update() via a per-frame consume map
// so wiring BOTH channels never double-moves.
export const SCREEN=Object.freeze({BOOT:0,INTRO:1,MENU:2,LEVEL:3,HOWTO:4,
  SCORES:5,GAME:6,ATTRACT:7});
export const ITEMS=Object.freeze(["START GAME","LEVEL SELECT","RENDER","SOUND",
  "HOW TO PLAY","HIGH SCORES"]);
const REP_FIRST=0.35, REP_NEXT=0.11;
export const IDLE_T=10;   // MENU idle seconds before ATTRACT takes over

export function createMenuApp(opts={}){
  const o=opts||{};
  const audio=o.audio||null;
  const onStart=o.onStart||null;
  const app={
    screen:o.autoplay?SCREEN.GAME:SCREEN.INTRO,
    cursor:0,
    level:Math.min(5,Math.max(1,(o.level|0)||1)),
    sound:o.sound!==false,
    render3d:!!o.render3d,
    inGame:!!o.autoplay,
    subT:0,
    repT:0,
    repDir:0,
    prevConfirm:false,
    idleT:0,
    togT:-1,     // MENU toggle-flash timestamp (§3): subT at last RENDER/SOUND
                 // flip, -1 sentinel otherwise; cleared wherever subT resets
    worldState:null,
    _taps:{},
    /* Advance the shell by dt seconds. Reads held axes + confirmHeld only. */
    update(dt,input){
      const d=Math.max(0,dt||0);
      const ch=!!(input&&input.confirmHeld);
      const rising=ch&&!this.prevConfirm;
      this.prevConfirm=ch;
      this.subT+=d;
      if(this.screen===SCREEN.GAME){ this.repT=0;this.repDir=0;this._hot=false;this._taps={};return; }
      if(this.screen===SCREEN.ATTRACT)return;   // subT already advanced -> hint blink
      const ax=(input&&input.input)||{};
      let dir=0;
      if(this.screen===SCREEN.MENU)dir=ax.up?-1:ax.down?1:0;
      else if(this.screen===SCREEN.LEVEL)dir=ax.left?-1:ax.right?1:0;
      if(dir){
        if(this.repDir!==dir){
          this.repDir=dir; this.repT=0; this._hot=false;
          if(!this._taps[dir])this.move(dir);
        }else{
          this.repT+=d;
          let g=0;
          while(g++<64){
            const thr=this._hot?REP_NEXT:REP_FIRST;
            if(this.repT<thr)break;
            this.move(dir); this.repT-=thr; this._hot=true;
          }
        }
      }else{ this.repDir=0; this.repT=0; this._hot=false; }
      if(rising)this.confirm();
      this._taps={};
      if(this.screen===SCREEN.MENU){
        this.idleT+=d;
        if(this.idleT>=IDLE_T)this.enterAttract();
       }else this.idleT=0;
     },
    /* Discrete key tap (Enter/Esc/Backspace/M + arrows-as-tap fallback). */
    key(code){
      if(this.screen===SCREEN.ATTRACT)return this.exitAttract();
      this.idleT=0;
      switch(code){
        case "Enter": case "NumpadEnter": return this.confirm();
        case "Escape": case "Backspace":
          if(this.screen===SCREEN.INTRO)return this.skip();
          if(this.screen===SCREEN.GAME)return false;
          return this.back();
        case "KeyM": return this.quitToMenu(this.worldState);
        case "ArrowUp": case "KeyW": return this._tapMove(-1,false);
        case "ArrowDown": case "KeyS": return this._tapMove(1,false);
        case "ArrowLeft": case "KeyA": return this._tapMove(-1,true);
        case "ArrowRight": case "KeyD": return this._tapMove(1,true);
       }
      return false;
     },
    _tapMove(dir,lat){
      this.idleT=0;
      if(this.screen===SCREEN.INTRO)return this.skip();
      const ok=lat?this.screen===SCREEN.LEVEL:this.screen===SCREEN.MENU;
      if(ok&&this.move(dir)){ this._taps[dir]=true; return true; }
      return false;
     },
    confirm(){
      if(this.screen===SCREEN.ATTRACT)return this.exitAttract();
      this.idleT=0;
      switch(this.screen){
        case SCREEN.INTRO: return this.skip();
        case SCREEN.MENU:{
          const item=this.cursor;
          if(item===0)return this.startRun();
          if(item===1)return this._push(SCREEN.LEVEL);
          if(item===2){
            this.render3d=!this.render3d; this.togT=this.subT; return true; }
          if(item===3){
            if(audio)this.sound=!!audio.toggle(); else this.sound=!this.sound;
            this.togT=this.subT;
            return true;
           }
          if(item===4)return this._push(SCREEN.HOWTO);
          if(item===5)return this._push(SCREEN.SCORES);
          return false;
         }
        case SCREEN.LEVEL: return this.startRun();
        case SCREEN.HOWTO: case SCREEN.SCORES: return this.back();
       }
      return false;
     },
    back(){
      if(this.screen===SCREEN.LEVEL||this.screen===SCREEN.HOWTO
        ||this.screen===SCREEN.SCORES)return this._push(SCREEN.MENU);
      return false;
     },
    skip(){ return this.screen===SCREEN.INTRO?this._push(SCREEN.MENU):false; },
    move(dir){
      this.idleT=0;
      if(this.screen===SCREEN.MENU){
        this.cursor=(this.cursor+dir+ITEMS.length)%ITEMS.length;
        return true;
       }
      if(this.screen===SCREEN.LEVEL){
        const nl=Math.min(5,Math.max(1,this.level+dir));
        if(nl===this.level)return false;
        this.level=nl; return true;
       }
      return false;
     },
    /* Start a run at app.level; main's onStart does loadLevel/score/state. */
    startRun(){
      const args={level:this.level};
      this.screen=SCREEN.GAME; this.inGame=true;
      this.subT=0; this.repT=0; this.repDir=0; this._hot=false; this._taps={};
      this.togT=-1;
      this.idleT=0;
      if(onStart)onStart(args);
      return args;
     },
    /* ATTRACT (spec §1): idle demo takeover. The machine never creates the
       demo world — main owns that harness; entry/exit only flip state here. */
    enterAttract(){
      this.screen=SCREEN.ATTRACT;
      this.subT=0; this.repT=0; this.repDir=0; this._hot=false; this._taps={};
      this.togT=-1;
      return true;
     },
    exitAttract(){
      if(this.screen!==SCREEN.ATTRACT)return false;
      this.idleT=0;
      this._push(SCREEN.MENU);
      return true;
     },
    /* M-quit: valid ONLY while in GAME with world paused (state passed in). */
    quitToMenu(worldState){
      if(this.screen!==SCREEN.GAME||worldState!=="PAUSE")return false;
      this._toMenuInner();
      return true;
     },
    /* Debug/reset hook target: force back to MENU from anywhere. */
    toMenu(){ const was=this.screen!==SCREEN.MENU; this._toMenuInner(); return was; },
    _toMenuInner(){
      this.screen=SCREEN.MENU; this.inGame=false;
      this.subT=0; this.repT=0; this.repDir=0; this._hot=false; this._taps={};
      this.togT=-1;
      this.idleT=0;
     },
    _push(s){
      this.screen=s; this.subT=0; this.repT=0; this.repDir=0; this._hot=false; this._taps={};
      this.togT=-1;
      return true;
     },
    /* §1 score edge, frame-polled: caller latches prevSt each frame and passes
       a {s,l,d} world snapshot; returns the entry to persist or null (pure).
       Also latches worldState so key("KeyM") can gate on PAUSE. */
    noteWorldEdge(prevSt,st,scores){
      this.worldState=st||null;
      if((prevSt==="PLAY"||prevSt==="WIN")&&st==="LOSE"&&scores)
        return {s:scores.s,l:scores.l,d:scores.d};
      return null;
     },
  };
  return app;
}
