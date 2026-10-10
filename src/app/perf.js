export const HZ_SNAP=Object.freeze([30,48,50,60,72,75,90,100,120,144,165,240]);
export const IV_STALL=250, IV_WIN=100, GOV_WIN=2000, GOV_UP=10000;
const median=(a)=>{ const n=a.length; if(!n) return 0; const s=a.slice().sort((x,y)=>x-y), m=n>>1; return n&1?s[m]:(s[m-1]+s[m])/2; };
const p90=(a)=>{ if(!a.length) return 0; const s=a.slice().sort((x,y)=>x-y); return s[Math.min(s.length-1,Math.floor(s.length*0.9))]; };
export function snapHz(ms){
  if(!(ms>0)) return 0;
  const h=1000/ms; let best=0, e=Infinity;
  for(const c of HZ_SNAP){ const d=Math.abs(h-c)/c; if(d<=0.04&&d<e){ e=d; best=c; } }
  return best;
}
export function divisor(hz,cap){ return !(hz>0)||!(cap>0)||cap===Infinity?1:Math.max(1,Math.floor(hz/cap+0.05)); }

export function createGate(){
  let tPrev=null, win=[], acc=0, hz=0, d=1, cap0=null, pk=false;
  const reset=()=>{ tPrev=null; win=[]; acc=0; hz=0; d=1; pk=false; };
  return {
    tick(t,cap){
      if(cap!==cap0){ if(cap0!==null) pk=true; cap0=cap; }
      if(tPrev===null||!(t>=tPrev)){ tPrev=t; acc=0; pk=false; return true; }
      const iv=t-tPrev; tPrev=t;
      if(iv>IV_STALL){ win=[]; acc=0; hz=0; d=1; pk=false; return true; }
      if(iv<IV_WIN){ win.push(iv); if(win.length>32) win.shift(); }
      hz=win.length>=8?snapHz(median(win)):0;
      d=divisor(hz,cap);
      if(d===1){ acc=0; pk=false; return true; }
      if(pk){ pk=false; acc=0; return true; }
      const per=1000/hz;
      acc+=iv;
      if(acc+per/2>=d*per){ acc=Math.max(-per/2,Math.min(per,acc-d*per)); return true; }
      return false;
    },
    poke(){ pk=true; },
    reset,
    get hz(){ return hz; },
    get d(){ return d; },
  };
}

export function createGovernor(){
  const LADDER=[1.75,1.5,1.25,1];
  let down=0, top0=2, ivs=[], works=[], winT=0, clean=0, steps=0;
  const clear=()=>{ ivs=[]; works=[]; winT=0; };
  const ladder=(top)=>[top].concat(LADDER.filter((v)=>v<top));
  return {
    feed(iv,work,capMs){
      if(!(iv>0)||iv>IV_STALL) return;
      ivs.push(iv); works.push(work>0?work:0); winT+=iv;
      if(winT<GOV_WIN) return;
      const n=ivs.length, m=median(ivs), jank=ivs.filter((v)=>v>1.5*m).length, w9=p90(works), cm=capMs>0?capMs:1000/60;
      clear();
      if(jank*10>=n||w9>0.75*cm){ if(down<ladder(top0).length-1){ down++; steps++; } clean=0; return; }
      if(jank===0&&w9<0.4*cm){ if(++clean>=GOV_UP/GOV_WIN&&down>0){ down--; steps++; clean=0; } }
      else clean=0;
    },
    level(top){ top0=top>0?top:1; const l=ladder(top0); down=Math.min(down,l.length-1); return l[down]; },
    reset(){ clear(); clean=0; },
    get step(){ return down; },
    get steps(){ return steps; },
  };
}

export function limitHint(ints,capFps){
  if(!(capFps>0)||capFps===Infinity||!ints||ints.length<8) return false;
  const m=median(ints);
  if(m<1.4*1000/Math.min(capFps,60)) return false;
  for(const v of ints) if(v>1.5*m) return false;
  return true;
}
