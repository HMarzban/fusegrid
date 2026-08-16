// Audio layer — WebAudio oscillator SFX. Graceful: no-op if unavailable.
// createAudio() returns { prime(), play(name), toggle(), isMuted() }.
export function createAudio(){
  let ctx=null, muted=false, ok=true;
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
  return {
    prime(){ ensure(); },
    play(name){
      switch(name){
        case "bomb":  beep(220,0.12,"sawtooth",0.10); break;
        case "boom":  beep(90,0.28,"sawtooth",0.22); beep(60,0.35,"square",0.18); break;
        case "power": beep(660,0.10,"square",0.12); setTimeout(()=>beep(880,0.12,"square",0.12),90); break;
        case "kill":  beep(150,0.16,"triangle",0.16); break;
        case "hurt":  beep(150,0.25,"sawtooth",0.20); break;
        case "win":   [523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,0.18,"square",0.14),i*110)); break;
        case "lose":  [400,300,200].forEach((f,i)=>setTimeout(()=>beep(f,0.25,"sawtooth",0.16),i*150)); break;
      }
    },
    toggle(){ muted=!muted; return !muted; },
    isMuted(){ return muted; },
  };
}
