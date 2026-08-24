import {createAudio, MUSIC_PATTERN} from "../src/audio.js";

let pass=0, fail=0;
function check(name, cond, detail){ cond?pass++:fail++;
  console.log((cond?"  PASS ":"  FAIL ")+name+(detail!==undefined?" -> "+detail:"")); }
const near=(a,b,eps)=>Math.abs(a-b)<=(eps==null?1e-9:eps);

// ---- fake AudioContext: records oscillator starts + gain automation ----
function mkAC(){
  const ac={currentTime:0,state:"running",destination:{name:"dest"},
    starts:[],stops:[],
    resume(){ ac.state="running"; },
    createOscillator(){
      const o={type:"",frequency:{value:0},_g:null,
        connect(g){o._g=g;},
        start(t){ac.starts.push({t,f:o.frequency.value,type:o.type,g:o._g});},
        stop(t){ac.stops.push(t);}};
      return o; },
    createGain(){
      const g={_dst:null,
        gain:{value:0,_l:[],
          setValueAtTime(v,t){this._l.push(["set",v,t]);this.value=v;},
          exponentialRampToValueAtTime(v,t){this._l.push(["ramp",v,t]);this.value=v;},
          cancelScheduledValues(){this._l.push(["cancel"]);}},
        connect(dst){g._dst=dst;return dst;}};
      return g; }};
  return ac;
}
function installAC(ac){
  class FakeAC{ constructor(){ return ac; } }
  globalThis.window={AudioContext:FakeAC};
}

// ---- headless first: window undefined -> every new API is a safe no-op ----
{
  const a=createAudio();
  let threw=false;
  try{
    check("headless: unlock() returns false", a.unlock()===false);
    check("headless: unlocked() false", a.unlocked()===false);
    a.duck(true); a.duck(false); a.pump();
    a.play("uiMove");
  }catch(e){ threw=true; console.log(e.message); }
  check("headless: unlock/duck/pump/play never throw", !threw);
}

// ---- MUSIC_PATTERN: pure frozen data (spec §3 table) ----
{
  check("pattern frozen (root + tracks)", Object.isFrozen(MUSIC_PATTERN)
    &&Object.isFrozen(MUSIC_PATTERN.bass)&&Object.isFrozen(MUSIC_PATTERN.lead)
    &&Object.isFrozen(MUSIC_PATTERN.hat));
  check("STEP=0.15 LEN=64 (100BPM eighths, 8 bars)",
    MUSIC_PATTERN.STEP===0.15&&MUSIC_PATTERN.LEN===64);
  const fin=a=>a.every(n=>["s","f","d","v"].every(k=>typeof n[k]==="number"
    &&Number.isFinite(n[k]))&&typeof n.t==="string");
  check("all entries finite {s,f,d,t,v}", fin(MUSIC_PATTERN.bass)
    &&fin(MUSIC_PATTERN.lead)&&fin(MUSIC_PATTERN.hat));
  check("bass 8 bars x 4 notes = 32", MUSIC_PATTERN.bass.length===32,
    MUSIC_PATTERN.bass.length);
  check("lead doubled to octave-up bars 5-8 (30 entries)",
    MUSIC_PATTERN.lead.length===30,MUSIC_PATTERN.lead.length);
  check("hats on odd steps only", MUSIC_PATTERN.hat.length===32
    &&MUSIC_PATTERN.hat.every(n=>n.s%2===1));
  const bassByS=new Map(MUSIC_PATTERN.bass.map(n=>[n.s,n]));
  check("A-A-F-G roots (A1=55 F1=43.65 G1=49)",
    bassByS.get(0).f===55&&bassByS.get(2).f===55&&bassByS.get(4).f===82.4
    &&bassByS.get(16).f===43.65&&bassByS.get(24).f===49);
  const leadLo=new Map(MUSIC_PATTERN.lead.filter(n=>n.s<32).map(n=>[n.s,n]));
  const octOk=MUSIC_PATTERN.lead.filter(n=>n.s>=32)
    .every(n=>leadLo.has(n.s-32)&&near(n.f,leadLo.get(n.s-32).f*2));
  check("bars 5-8 lead is bars 1-4 up one octave", octOk);
  const durs=[MUSIC_PATTERN.bass,MUSIC_PATTERN.lead,MUSIC_PATTERN.hat]
    .every(a=>a.every(n=>n.d>0&&n.d<=MUSIC_PATTERN.STEP*8));
  check("durations positive, within pattern span", durs);
}

// ---- unlock/lazy graph + pump lookahead scheduling ----
{
  const ac=mkAC(); installAC(ac);
  const a=createAudio();
  check("pre-unlock: unlocked() false", a.unlocked()===false);
  check("unlock() true", a.unlock()===true);
  check("unlock idempotent", a.unlock()===true&&a.unlocked()===true);

  a.pump();
  check("lookahead: first pump schedules only the 0.05s anchor step",
    ac.starts.length>0&&ac.starts.every(s=>near(s.t,0.05,1e-9)),
    JSON.stringify(ac.starts.slice(0,3)));
  const noteGains=new Set(ac.starts.map(s=>s.g));
  check("per-note gain nodes are distinct", noteGains.size===ac.starts.length);
  const mg=[...noteGains][0]._dst;
  check("note gains route through ONE music gain -> destination",
    mg&&mg!==ac.destination&&mg._dst===ac.destination);

  ac.currentTime=0.11; a.pump();
  check("frame pump advances lookahead monotonically",
    ac.starts.every((s,i)=>i===0||s.t>=ac.starts[i-1].t)
    &&ac.starts.some(s=>near(s.t,0.20,1e-9)));

  // drive 21s in 0.1s pumps => >LEN*STEP (9.6s) covered twice: seamless wrap
  const before=ac.starts.length;
  for(let i=0;i<210;i++){ ac.currentTime+=0.1; a.pump(); }
  check("long drive keeps start times monotonic",
    ac.starts.slice(before).every((s,i,arr)=>i===0
      ||s.t>=arr[i-1].t));
  const t0=ac.starts[0].t,S=MUSIC_PATTERN.STEP;
  const buckets=new Map();
  for(const s of ac.starts){
    const k=Math.round((s.t-t0)/S);
    if(!buckets.has(k))buckets.set(k,[]);
    buckets.get(k).push(s.type+":"+s.f.toFixed(1));
   }
  const sig=k=>{ const arr=(buckets.get(k)||[]).sort(); return arr.join("|"); };
  let wrap=true,probe=0;
  for(let k=0;k<64;k++){
    if(buckets.has(k)&&buckets.has(k+64)){ probe++;
      if(sig(k)!==sig(k+64)){wrap=false;break;} }
   }
  check("seamless wrap: step k+N === step k (pitch/type identical)", wrap&&probe>60,
    "compared "+probe+" steps");

  // note envelope: v -> 0.0001 ramp over d, stop at t+d+0.03
  const bg=MUSIC_PATTERN.bass[0];
  const st=ac.starts.find(s=>near(s.f,bg.f,0.001)&&s.type===bg.t);
  const gl=st.g.gain._l;
  const setE=gl.find(e=>e[0]==="set"), rampE=gl.filter(e=>e[0]==="ramp").pop();
  const stopIdx=ac.stops.findIndex(()=>true);
  check("note envelope v->0.0001 over d; stop at t+d+0.03",
    near(setE[1],bg.v)&&near(rampE[1],0.0001)
    &&near(rampE[2]-st.t,bg.d,1e-9)
    &&ac.stops.some(tp=>near(tp,st.t+bg.d+0.03,1e-9)));
}

// ---- mute: single source of truth gates pump AND gain ----
{
  const ac=mkAC(); installAC(ac);
  const a=createAudio(); a.unlock();
  for(let i=0;i<10;i++){ ac.currentTime+=0.1; a.pump(); }
  const nBefore=ac.starts.length;
  check("toggle() -> false (muted)", a.toggle()===false);
  const gL=ac.starts.length; ac.starts.length=0;   // isolate
  const musRamps=[];
  // grab music gain via a fresh emitted note chain is gone (muted) — use duck probe:
  // instead inspect via unlock-built node captured earlier trick: pump a silent frame
  a.pump();
  ac.currentTime+=0.5; a.pump();
  check("muted: pump emits NOTHING", ac.starts.length===0,
    String(ac.starts.length)+" was "+gL);
  a.toggle();                                       // unmute
  ac.currentTime+=0.2; a.pump();
  check("unmute resumes scheduling", ac.starts.length>0);
  check("start budget conserved across mute window (no burst catch-up)",
    Math.abs(ac.starts.length-(nBefore-gL))<25,
    ac.starts.length+" vs "+(nBefore-gL));
}

// ---- duck endpoints: 0.5->0.16 @0.35s in, 0.16->0.5 @0.6s out ----
{
  const ac=mkAC(); installAC(ac);
  const a=createAudio(); a.unlock();
  ac.currentTime=3.0;
  // reach into graph via a scheduled note's gain chain (musicGain is _dst)
  a.pump();
  const mg=ac.starts.length?ac.starts[0].g._dst:null;
  check("musicGain captured from note chain", !!mg);
  const lastRamp=()=>{ const l=mg.gain._l; for(let i=l.length-1;i>=0;i--)
    if(l[i][0]==="ramp")return l[i]; return null; };
  const setCnt=()=>mg.gain._l.filter(e=>e[0]==="set").length;
  a.duck(true);
  let r=lastRamp();
  check("duck-in targets 0.16 over 0.35s", near(r[1],0.16)&&near(r[2]-ac.currentTime,0.35),
    JSON.stringify(r));
  const setsAfterFirst=setCnt();
  a.duck(true);
  check("duck idempotent (no duplicate automation)",
    setCnt()===setsAfterFirst&&lastRamp()[1]===r[1]);
  ac.currentTime=4.0; a.duck(false);
  r=lastRamp();
  check("duck-out restores 0.5 over 0.6s", near(r[1],0.5)&&near(r[2]-ac.currentTime,0.6),
    JSON.stringify(r));

  // mute ramp overrides duck state instantly; unmute returns to BASE not duck
  a.duck(true);
  a.toggle();
  r=lastRamp();
  check("mute silences loop instantly (0.0001)", near(r[1],0.0001)&&near(r[2]-ac.currentTime,0.01,0.02),
    JSON.stringify(r));
  a.toggle();
  r=lastRamp();
  check("unmute restores base 0.5 (self-heals over duck)", near(r[1],0.5),
    JSON.stringify(r));
}

// ---- SFX path bypasses musicGain (duck never touches beeps) ----
{
  const ac=mkAC(); installAC(ac);
  const a=createAudio(); a.unlock(); a.duck(true);
  const nStarts=ac.starts.length;
  a.pump();
  const noteDst=ac.starts.length?ac.starts[0].g._dst:null;
  ac.starts.length=0;
  a.play("uiMove");                    // immediate beep, no setTimeout
  check("sfx beep still scheduled while ducked",
    ac.starts.length===1&&ac.starts[0].g._dst===ac.destination,
    String(ac.starts.length));
  check("sfx routes direct-to-destination, music via musicGain",
    noteDst&&noteDst!==ac.destination);
  check("mute kills jingle but pump-gate unaffected", (()=>{
    a.toggle();
    const before=ac.starts.length;
    a.play("uiSel");                   // muted -> silent
    ac.currentTime+=0.2; a.pump();     // muted -> no notes
    return ac.starts.length===before;
   })());
}

// ---- grep gate: no wall-clock/random in scheduling code (spec §6) ----
{
  const fs=await import("node:fs");
  const src=fs.readFileSync(new URL("../src/audio.js",import.meta.url),"utf8");
  check("audio.js free of Math.random/Date.", !/Math\.random|Date\./.test(src));
  check("audio.js free of setInterval calls", !/\bsetInterval\s*\(/.test(src));
}

console.log("\n  MUSIC RESULT: "+pass+" PASS / "+fail+" FAIL");
process.exit(fail?1:0);
