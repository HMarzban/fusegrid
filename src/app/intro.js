export const INTRO_DUR=5.0;

const easeOutCubic=t=>1-Math.pow(1-t,3);
const easeInCubic=t=>t*t*t;
const easeInOutCubic=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const easeOutBack=t=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);};
const clamp01=t=>Math.max(0,Math.min(1,t));
const seg=(t,a,b)=>clamp01((t-a)/(b-a));
const lerpEnd=(a,b,k)=>b+(a-b)*(1-k);

// Beats: logo reveal seg(0,.90) -> hold -> flyover seg(1.40,4.20)
// (zoom 1.55→1.18, drift lower-third→center, veil 0.55→0.18 by midpoint)
// -> settle seg(4.20,5.00) (zoom→1.00, veil→0.62, tagline in).
// logoP: 0..1 reveal, 1 held, 1..2 exit (draw-side splits at >1).
export function introPhase(t){
  const s=clamp01(t/INTRO_DUR)*INTRO_DUR;
  const zoom=s<1.40?1.55
    :s<4.20?lerpEnd(1.55,1.18,easeInOutCubic(seg(s,1.40,4.20)))
    :lerpEnd(1.18,1.00,easeOutCubic(seg(s,4.20,5.00)));
  const veil=s<2.80?lerpEnd(0.55,0.18,easeInOutCubic(seg(s,1.40,2.80)))
    :s<4.20?0.18
    :lerpEnd(0.18,0.62,easeOutCubic(seg(s,4.20,5.00)));
  const camX=0.5;
  const camY=s<1.40?0.66
    :s<4.20?lerpEnd(0.66,0.50,easeInOutCubic(seg(s,1.40,4.20)))
    :0.50;
  const logoP=s<1.40?easeOutCubic(seg(s,0,0.90)):1+easeInCubic(seg(s,1.40,1.90));
  const tagP=easeOutCubic(seg(s,4.20,5.00));
  return {zoom,camX,camY,veil,logoP,tagP,done:s>=INTRO_DUR};
}

export function createIntro(){
  return {
    t:0,
    update(dt){ this.t=Math.min(INTRO_DUR,this.t+Math.max(0,dt)); },
    skip(){ this.t=INTRO_DUR; },
  };
}
