import {INTRO_DUR,introPhase,createIntro} from "../src/app/intro.js";

let pass=0, fail=0;
function check(name, cond, detail){ cond?pass++:fail++;
  console.log((cond?"  PASS ":"  FAIL ")+name+(detail!==undefined?" -> "+detail:"")); }
const near=(a,b,e=1e-9)=>Math.abs(a-b)<=e;

// ---- duration constant ----
check("INTRO_DUR === 5.0", INTRO_DUR===5.0, INTRO_DUR);
check("INTRO_DUR within 4–6 s bound", INTRO_DUR>=4&&INTRO_DUR<=6);

// ---- veil endpoints ----
check("veil(0) === 0.55", introPhase(0).veil===0.55, introPhase(0).veil);
{
  const v=introPhase(2.8).veil;
  check("veil mid-flyover (~2.8s) in 0.18 band", v>=0.17&&v<=0.19, v);
}
check("veil(4.2) === 0.18", near(introPhase(4.2).veil,0.18), introPhase(4.2).veil);
check("veil settles to 0.62", near(introPhase(5.0).veil,0.62)&&near(introPhase(7).veil,0.62),
  introPhase(5).veil);
{
  let mono=true;
  for(let t=1.4;t<=4.15;t+=0.05)
    if(introPhase(t+0.05).veil>introPhase(t).veil+1e-9)mono=false;
  check("veil monotone decreasing through flyover", mono);
}

// ---- zoom: monotone, single minimum, ends exactly 1.00 ----
{
  const N=500;
  const zs=[];
  for(let i=0;i<=N;i++)zs.push(introPhase(INTRO_DUR*i/N).zoom);
  check("zoom starts 1.55", zs[0]===1.55, zs[0]);
  let minI=0,minV=Infinity;
  for(let i=0;i<zs.length;i++)if(zs[i]<minV){minV=zs[i];minI=i;}
  let down=true;
  for(let i=1;i<zs.length;i++)if(zs[i]>zs[i-1]+1e-12)down=false;
  check("zoom weakly monotone decreasing (single minimum = endpoint)", down,
    `minI=${minI}/${N} min=${minV}`);
  check("flyover lands on 1.18 before settle takes over",
    Math.abs(introPhase(4.19).zoom-1.18)<1e-3&&introPhase(4.2).zoom===1.18,
    `${introPhase(4.19).zoom},${introPhase(4.2).zoom}`);
}
check("zoom ends EXACTLY 1.00", introPhase(5.0).zoom===1&&introPhase(99).zoom===1,
  introPhase(5.0).zoom);
check("zoom static pre-flyover", introPhase(0).zoom===1.55&&introPhase(1.39).zoom===1.55);

// ---- logo / tagline progress ----
{
  const p0=introPhase(0),p09=introPhase(0.9),p14=introPhase(1.4),
    p19=introPhase(1.9),p3=introPhase(3.0);
  check("logoP reveals 0→1 by 0.90s",
    p0.logoP===0&&near(p09.logoP,1,1e-9), `${p0.logoP}..${p09.logoP}`);
  check("logoP exits 1→2 across 1.40–1.90s then holds",
    p14.logoP===1&&near(p19.logoP,2,1e-9)&&p3.logoP===2,
    `${p14.logoP},${p19.logoP},${p3.logoP}`);
}
{
  check("tagP hidden until settle, fully in at DUR",
    introPhase(4.19).tagP===0&&near(introPhase(5).tagP,1,1e-9),
    `${introPhase(4.19).tagP},${introPhase(5).tagP}`);
}

// ---- camera drift lower-third → center ----
{
  const a=introPhase(1.4),b=introPhase(4.2),c=introPhase(5);
  check("cam drifts from lower-third to center",
    near(a.camY,0.66)&&near(b.camY,0.50)&&c.camY===0.5&&a.camX===0.5&&c.camX===0.5,
    `(${a.camX},${a.camY})→(${b.camX},${b.camY})`);
}

// ---- done flag & clamping ----
check("done false below DUR, true at/after DUR",
  introPhase(0).done===false&&introPhase(4.999).done===false
    &&introPhase(5.0).done===true&&introPhase(6).done===true);

// ---- continuity: no jumps >0.05 in zoom/veil across beat boundaries ----
{
  const bounds=[0,0.9,1.4,1.9,2.8,4.2,5.0];
  const eps=1e-3;
  let worstZ=0,worstV=0,worstL=0,worstC=0;
  for(const b of bounds){
    for(const t of [Math.max(0,b-eps),b]){
      const a=introPhase(t),n=introPhase(Math.min(INTRO_DUR,t+eps));
      worstZ=Math.max(worstZ,Math.abs(n.zoom-a.zoom));
      worstV=Math.max(worstV,Math.abs(n.veil-a.veil));
      worstL=Math.max(worstL,Math.abs(n.logoP-a.logoP));
      worstC=Math.max(worstC,Math.abs(n.camY-a.camY));
    }
  }
  check("continuity: zoom/veil/logo/cam jumps ≤0.05 at all beat edges",
    worstZ<=0.05&&worstV<=0.05&&worstL<=0.05&&worstC<=0.05,
    `z=${worstZ.toExponential(1)} v=${worstV.toExponential(1)} l=${worstL.toExponential(1)} c=${worstC.toExponential(1)}`);
}

// ---- dense-scan global continuity (no hidden spikes anywhere) ----
{
  let ok=true,dz=0;
  for(let t=0;t<INTRO_DUR;t+=0.02){
    dz=introPhase(t+0.02).zoom-introPhase(t).zoom;
    if(Math.abs(dz)>0.05)ok=false;
  }
  check("dense scan: no zoom spikes anywhere in timeline", ok, dz);
}

// ---- createIntro wrapper ----
{
  const it=createIntro();
  check("createIntro starts at t=0", it.t===0);
  it.update(0.5);it.update(0.25);
  check("update(dt) advances t", near(it.t,0.75), it.t);
  check("not done mid-timeline", introPhase(it.t).done===false);
  it.update(-10);
  check("negative dt ignored", near(it.t,0.75), it.t);
  it.update(100);
  check("update clamps at DUR", it.t===5.0, it.t);
}
{
  const it=createIntro();
  it.update(1.234);
  it.skip();
  check("skip() sets done immediately",
    it.t>=INTRO_DUR&&introPhase(it.t).done===true&&introPhase(it.t).veil===0.62,
    `t=${it.t}`);
}

console.log("\n  INTRO RESULT: "+pass+" PASS / "+fail+" FAIL");
process.exit(fail?1:0);
