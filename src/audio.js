// Audio layer — WebAudio oscillator SFX. Graceful: no-op if unavailable.
// createAudio() returns { play(name), toggle() }.
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
    toggle(){ muted=!muted; return !muted; },
  };
}
