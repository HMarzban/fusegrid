// Audio layer — WebAudio oscillator SFX + chiptune loop. Graceful: no-op if
// unavailable. createAudio() returns { play(name), toggle(), unlock(), duck(on),
// pump(), unlocked() } plus the pure frozen MUSIC_PATTERN / MUSIC_PATTERN_B /
// MUSIC_SECTIONS exports.
//
// MUSIC ENGINE (spec §3): oscillator-only; graph per note is
// osc→noteGain→musicGain→destination while SFX beeps stay direct-to-destination
// so ducking never touches them. Scheduling is frame-driven lookahead on the
// WebAudio clock ONLY — main calls pump() once per RAF; there is deliberately
// NO setInterval/setTimeout/Date anywhere in note scheduling.

/* Pure pattern data: 8 bars @100BPM eighths = 64 steps (A-A-F-G x2), lead
   octave-up bars 5-8, offbeat hats. Sparse [step,freqHz,durSteps] lists over
   absolute steps 0..63 mapped to {s,f,d,t,v}; pump looks each up by stepIdx. */
export const MUSIC_PATTERN=(()=>{const S=.15,L=64,bass=[],lead=[],hat=[];
 const roots=[[55,82.4],[55,82.4],[43.65,65.4],[49,73.42],
              [55,82.4],[55,82.4],[43.65,65.4],[49,73.42]];
 roots.forEach(([r,q],b)=>{const o=b*8;bass.push([o,r,2],[o+2,r,2],[o+4,q,2],[o+6,r,2]);});
 const ph=[[[0,220],[2,261.6],[3,293.7],[4,329.6],[6,293.7]],[[0,261.6],[1,392],[3,329.6]],
   [[0,246.9],[2,293.7],[3,349.2],[5,329.6]],[[0,220],[2,196],[4,246.9]]];
 ph.forEach((bar,i)=>bar.forEach(([s,f])=>{lead.push([i*8+s,f,2]);
   lead.push([32+i*8+s,f*2,2]);}));
 for(let i=1;i<L;i+=2)hat.push([i,4800,1]);
 const E=(a,t,v)=>a.map(([s,f,d])=>({s,f,d:d*S,t,v}));
 return Object.freeze({STEP:S,LEN:L,bass:Object.freeze(E(bass,"square",.10)),
   lead:Object.freeze(E(lead,"square",.07)),hat:Object.freeze(E(hat,"triangle",.02))});})();

/* B SECTION (design-dept long-session fatigue fix): D–C–Bb–G descent under a
   higher lead contour. Identical rhythm skeleton, instrument mix and step
   count as A so the two interleave as one seamless loop: pump cycles
   A→A→B→B (MUSIC_SECTIONS) before wrapping, instead of A forever. */
export const MUSIC_PATTERN_B=(()=>{const S=.15,L=64,bass=[],lead=[],hat=[];
 const roots=[[73.42,110],[65.4,98],[58.27,87.31],[49,73.42],
              [73.42,110],[65.4,98],[58.27,87.31],[49,73.42]];
 roots.forEach(([r,q],b)=>{const o=b*8;bass.push([o,r,2],[o+2,r,2],[o+4,q,2],[o+6,r,2]);});
 const ph=[[[0,293.7],[2,349.2],[4,440],[6,349.2]],
   [[0,329.6],[2,392],[3,523.2],[5,392]],
   [[0,349.2],[2,466.2],[3,440],[5,349.2]],
   [[0,293.7],[2,246.9],[4,196]]];
 ph.forEach((bar,i)=>bar.forEach(([s,f])=>{lead.push([i*8+s,f,2]);
   lead.push([32+i*8+s,f*2,2]);}));
 for(let i=1;i<L;i+=2)hat.push([i,4800,1]);
 const E=(a,t,v)=>a.map(([s,f,d])=>({s,f,d:d*S,t,v}));
 return Object.freeze({STEP:S,LEN:L,bass:Object.freeze(E(bass,"square",.10)),
   lead:Object.freeze(E(lead,"square",.07)),hat:Object.freeze(E(hat,"triangle",.02))});})();
/* Macro-loop section order: two passes of A then two of B per full cycle. */
export const MUSIC_SECTIONS=Object.freeze(["A","A","B","B"]);
const MUS_LEN=MUSIC_PATTERN.LEN,MUS_SEC_N=MUSIC_SECTIONS.length;
const MUS_BASE=0.5,MUS_DUCK=0.16,LOOKAHEAD=0.12,MUS_FLOOR=0.0001;

export function createAudio(){
  let ctx=null, muted=false, ok=true;
  let musicGain=null, nextT=0, stepN=0, ducked=false;
  function ensure(){
    if(!ctx){
      try{
        const AC=window.AudioContext||window.webkitAudioContext;
        ctx=AC?new AC():null;
      }catch(e){ ok=false; }
    }
    return ctx && ok;
  }
  function beep(freq, dur, type, vol){
    if(muted || !ensure()) return;
    const c=ctx;
    try{
      if(c.state==="suspended") c.resume();
      const o=c.createOscillator(), g=c.createGain();
      o.type=type||"square"; o.frequency.value=freq;
      g.gain.value=0.0001;
      o.connect(g); g.connect(c.destination);
      const t=c.currentTime; o.start(t);
      g.gain.exponentialRampToValueAtTime(vol||0.12, t+0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
      o.stop(t+dur+0.02);
    }catch(e){}
  }
  /* ---- music engine (spec §3/§4) ---- */
  function rampMusicGain(v,dur){
    try{
      const g=musicGain.gain,t=ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(MUS_FLOOR,g.value),t);
      g.exponentialRampToValueAtTime(v,t+dur);
     }catch(e){}
   }
  function note(n,t){
    try{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type=n.t; o.frequency.value=n.f;
      o.connect(g); g.connect(musicGain);
      g.gain.setValueAtTime(n.v,t);
      g.gain.exponentialRampToValueAtTime(MUS_FLOOR,t+n.d);
      o.start(t); o.stop(t+n.d+0.03);
     }catch(e){}
   }
  function emitStep(P,s,t){
    for(const n of P.bass)if(n.s===s)note(n,t);
    for(const n of P.lead)if(n.s===s)note(n,t);
    for(const n of P.hat)if(n.s===s)note(n,t);
   }
  function unlock(){
    if(!ensure())return false;
    try{
      if(ctx.state==="suspended")ctx.resume();
      if(!musicGain){
        musicGain=ctx.createGain();
        musicGain.gain.value=muted?MUS_FLOOR:MUS_BASE;
        musicGain.connect(ctx.destination);
       }
      nextT=ctx.currentTime+0.05;
      return true;
     }catch(e){ return false; }
   }
  function unlocked(){ return !!ctx&&!!musicGain; }
  function duck(on){
    on=!!on;
    if(!musicGain||on===ducked)return;
    ducked=on;
    rampMusicGain(on?MUS_DUCK:MUS_BASE,on?0.35:0.6);
   }
  function pump(){
    if(!ctx||!musicGain||muted)return;
    try{
      /* catch-up clamp: RAF pauses on hidden tabs while ctx.currentTime keeps
         running; without this, resume schedules every missed step at past
         timestamps as one burst glitch */
      if(nextT<ctx.currentTime)nextT=ctx.currentTime+0.05;
      const horizon=ctx.currentTime+LOOKAHEAD;
      while(nextT<=horizon){
        const P=MUSIC_SECTIONS[Math.floor(stepN/MUS_LEN)%MUS_SEC_N]==="A"
          ?MUSIC_PATTERN:MUSIC_PATTERN_B;
        emitStep(P,stepN%MUS_LEN,nextT);
        nextT+=P.STEP;
        stepN++;
       }
      }catch(e){}
    }
  return {
    play(name){
      switch(name){
        case "bomb":  beep(220,0.12,"sawtooth",0.10); break;
        case "boom":  beep(90,0.28,"sawtooth",0.22); beep(60,0.35,"square",0.18); break;
        case "power": beep(660,0.10,"square",0.12); setTimeout(()=>beep(880,0.12,"square",0.12),90); break;
        case "kill":  beep(150,0.16,"triangle",0.16); break;
        case "hurt":  beep(150,0.25,"sawtooth",0.20); break;
        case "win":   [523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,0.18,"square",0.14),i*110)); break;
        case "lose":  [400,300,200].forEach((f,i)=>setTimeout(()=>beep(f,0.25,"sawtooth",0.16),i*150)); break;
        case "uiJingle":
          if(!muted){
            [392,523,659,784].forEach((f,i)=>setTimeout(()=>beep(f,0.16,"square",0.11),i*120));
            setTimeout(()=>beep(1046,0.30,"triangle",0.10),480);
          }
          break;
        case "uiMove":   beep(520,0.05,"square",0.06); break;
        case "uiSel":    beep(880,0.08,"square",0.10); setTimeout(()=>beep(1318,0.10,"square",0.09),70); break;
        case "uiBack":   beep(300,0.08,"triangle",0.08); break;
        case "uiTog":    beep(700,0.06,"square",0.08); break;
        case "uiDenied": beep(180,0.09,"square",0.07); break;
      }
    },
    toggle(){
      muted=!muted;
      /* duck-aware restore (F2): unmute while ducked must return to MUS_DUCK,
         else main's frame-polled duck(true) idempotently no-ops until the
         screen flips and music blasts at full volume inside GAME */
      if(musicGain)rampMusicGain(muted?MUS_FLOOR:(ducked?MUS_DUCK:MUS_BASE),
        muted?0.01:0.6);
      return !muted;
     },
    unlock,unlocked,duck,pump,
  };
}
