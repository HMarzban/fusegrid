/* MENU DRAWING LAYER — all menu/intro pixels as pure functions over a
   normalized layout valid at both 600x520 (2D) and 608x352 (3D). Reads only
   its args; never touches world/app state. Palette locked (spec §0/§2):
   accent #37f0d0, text #dfe7f5, muted #7385ad, veils rgba(7,10,18,a).
   Easing helpers duplicated from the intro beat table (spec §3) — this file
   must not import from src/app. */
const ACCENT="#37f0d0", TEXT="#dfe7f5", MUTED="#7385ad";
const MONO="ui-monospace,monospace";
const easeOutCubic=t=>1-Math.pow(1-t,3);
const easeInCubic=t=>t*t*t;
const easeInOutCubic=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const easeOutBack=t=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);};
const clamp01=t=>Math.max(0,Math.min(1,t));
const seg=(t,a,b)=>clamp01((t-a)/(b-a));
const lerpEnd=(a,b,k)=>b+(a-b)*(1-k);
const DUR=5.0;                                  // intro total (matches app/intro)
const monoW=(txt,size)=>txt.length*size*0.6;    // monospace advance estimate
const font=(size,weight)=>(weight||"")+" "+size+"px "+MONO;

export function layout(W,H){
  return Object.freeze({
    cx:W/2,
    top:H*0.16,
    logoCy:H*0.27,
    logoScale:Math.max(0.72,Math.min(1.0,(H/520)*1.0)),
    itemsY:H*0.50,
    itemH:Math.max(24,Math.min(34,Math.round(H*0.075))),
    footY:H-20,
    chipW:44,
    chipGap:14,
    tableY:H*0.42,
    rowH:H*0.055,
  });
}

/* INTRO chrome over the live flyover: veil, logo reveal/exit, tagline, skip.
   logoP contract: 0..1 reveal (fade + slide 14px down), >1 exit
   ((p-1)*20px up, alpha 1-(p-1)) — beats identical to app/intro. */
export function drawIntroChrome(c,t,W,H){
  const L=layout(W,H);
  const s=clamp01(t/DUR)*DUR;
  const veil=s<2.80?lerpEnd(0.55,0.18,easeInOutCubic(seg(s,1.40,2.80)))
    :s<4.20?0.18
    :lerpEnd(0.18,0.62,easeOutCubic(seg(s,4.20,5.00)));
  c.fillStyle="rgba(7,10,18,"+veil+")";
  c.fillRect(0,0,W,H);
  const logoP=s<1.40?easeOutCubic(seg(s,0,0.90)):1+easeInCubic(seg(s,1.40,1.90));
  const reveal=Math.min(1,logoP), exit=Math.max(0,logoP-1);
  const a=reveal*(1-exit);
  if(a>0.01){
    const slide=14*(1-reveal)-20*exit;
    c.save();
    c.textAlign="center"; c.textBaseline="middle"; c.lineJoin="round";
    // NEO: whole-word fade + slide (easeOutCubic)
    c.save();
    c.translate(L.cx,L.logoCy-30+slide);
    c.scale(L.logoScale,L.logoScale);
    c.globalAlpha*=a;
    c.font=font(34,"900"); c.lineWidth=34*0.14; c.strokeStyle="#3a2a00";
    c.strokeText("NEO",0,0); c.fillStyle="#ffd447"; c.fillText("NEO",0,0);
    c.restore();
    // BOMBERMAN: per-letter stagger 60ms LTR, scale 0.92->1 easeOutBack
    const word="BOMBERMAN", size=46, adv=size*0.6*L.logoScale;
    const x0=L.cx-(word.length*adv)/2+adv/2;
    for(let i=0;i<word.length;i++){
      const lt=t-i*0.06;
      const ka=easeOutCubic(seg(lt,0,0.50));
      if(ka<=0)continue;
      const ks=0.92+0.08*easeOutBack(seg(lt,0,0.45));
      c.save();
      c.translate(x0+i*adv,L.logoCy+18+slide);
      c.scale(L.logoScale*ks,L.logoScale*ks);
      c.globalAlpha*=a*ka;
      c.font=font(size,"900"); c.lineWidth=size*0.14; c.strokeStyle="#3a0014";
      c.textAlign="center";
      c.strokeText(word[i],0,0); c.fillStyle="#ff5d73"; c.fillText(word[i],0,0);
      c.restore();
    }
    c.restore();
  }
  // tagline: PRESS ENTER at footY, fade-in x 1Hz blink (render-time only)
  const tagP=easeOutCubic(seg(s,4.20,5.00));
  if(tagP>0){
    const blink=0.55+0.45*Math.sin(2*Math.PI*t);
    c.globalAlpha=tagP*Math.max(0,blink);
    c.fillStyle=ACCENT; c.font=font(13,"900");
    c.textAlign="center"; c.textBaseline="middle";
    c.fillText("PRESS ENTER",L.cx,L.footY);
    c.globalAlpha=1;
  }
  // skip hint: bottom-right, appears from t=0.6
  const ha=easeOutCubic(seg(t,0.60,0.90));
  if(ha>0){
    c.globalAlpha=ha;
    c.fillStyle=MUTED; c.font=font(10);
    c.textAlign="right"; c.textBaseline="middle";
    c.fillText("ANY KEY TO SKIP",W-14,H-12);
    c.globalAlpha=1;
  }
}

/* MAIN MENU over the dimmed frozen arena. ui={cursor,items,enterT}; item
   entries may carry a value token ("RENDER 3D"/"SOUND OFF") drawn in accent. */
export function drawMenu(c,ui,L,t){
  const cur=(ui&&ui.cursor)|0;
  const items=(ui&&ui.items)||[];
  const et=(ui&&typeof ui.enterT==="number")?ui.enterT:t;
  const size=13;
  let maxW=0;
  for(const it of items){
    const str=String(it), sp=str.indexOf(" ");
    maxW=Math.max(maxW,monoW(sp>0?str.slice(0,sp):str,size)
      +(sp>0?monoW(str.slice(sp),size):0));
  }
  c.textAlign="left"; c.textBaseline="middle";
  for(let i=0;i<items.length;i++){
    const str=String(items[i]);
    const sp=str.indexOf(" ");
    const hasVal=sp>0&&(str.slice(0,sp)==="RENDER"||str.slice(0,sp)==="SOUND");
    const label=hasVal?str.slice(0,sp):str;
    const val=hasVal?str.slice(sp):"";
    const k=easeOutCubic(clamp01((et-i*0.03)/0.22));
    const y=L.itemsY+i*L.itemH+8*(1-k);
    const sel=i===cur;
    const w=monoW(label,size)+monoW(val,size);
    const x=L.cx-w/2;
    c.globalAlpha=k;
    c.font=font(size);
    c.fillStyle=sel?TEXT:MUTED;
    c.fillText(label,x,y);
    if(val){
      c.fillStyle=ACCENT;
      c.fillText(val,x+monoW(label,size),y);
    }
    c.globalAlpha=1;
    if(sel){
      c.fillStyle=ACCENT; c.font=font(10,"900");
      c.fillText("▸",L.cx-maxW/2-14,y);
    }
  }
  c.fillStyle=MUTED; c.font=font(11);
  c.textAlign="center";
  c.fillText("↑↓ MOVE · ENTER SELECT",L.cx,L.footY);
}

/* LEVEL SELECT: five chips 44x34 gap 14 centered at itemsY; sel in 1..5. */
export function drawLevelSelect(c,sel,L,t){
  c.fillStyle=TEXT; c.font=font(20,"900");
  c.textAlign="center"; c.textBaseline="middle";
  c.fillText("SELECT LEVEL",L.cx,L.top);
  const total=5*L.chipW+4*L.chipGap;
  const sx=L.cx-total/2, cy=L.itemsY-17;
  for(let i=0;i<5;i++){
    const x=sx+i*(L.chipW+L.chipGap), on=i+1===sel;
    c.strokeStyle=on?ACCENT:"#26324a";
    c.lineWidth=1;
    c.strokeRect(x,cy,L.chipW,34);
    c.fillStyle=on?ACCENT:TEXT;
    c.font=font(15,"900");
    c.fillText(String(i+1),x+L.chipW/2,cy+17);
  }
  c.fillStyle=MUTED; c.font=font(13);
  c.fillText("ENTER START · ←/→ CHOOSE · ESC BACK",L.cx,L.footY);
}

/* HOW TO PLAY: control rows mirroring the page .hint, power-gate asterisks. */
export function drawHowTo(c,L,t){
  c.fillStyle=TEXT; c.font=font(20,"900");
  c.textAlign="left"; c.textBaseline="middle";
  c.fillText("HOW TO PLAY",L.cx-210,L.top);
  const rows=["WASD / Arrows  move","Space  bomb","Shift + Space  throw *",
    "Q  remote *","K + move  kick *","P  pause"];
  const x=L.cx-210;
  let y=L.itemsY-10;
  const lh=L.itemH*0.8;
  c.font=font(12);
  c.fillStyle=TEXT;
  for(const r of rows){ c.fillText(r,x,y); y+=lh; }
  y+=lh*0.4;
  c.fillStyle=MUTED; c.font=font(11);
  c.fillText("*needs its power-up",x,y);
  y+=lh*0.9;
  c.globalAlpha=0.75;
  c.fillStyle=ACCENT; c.font=font(12);
  c.fillText("clear every enemy to advance · collect power-ups",x,y);
  c.globalAlpha=1;
  c.fillStyle=MUTED; c.font=font(11);
  c.textAlign="center";
  c.fillText("ESC / ENTER BACK",L.cx,L.footY);
}

/* HIGH SCORES: table RANK SCORE LEVEL DATE centered at tableY. */
export function drawScores(c,scores,L,t){
  c.fillStyle=TEXT; c.font=font(20,"900");
  c.textAlign="center"; c.textBaseline="middle";
  c.fillText("HIGH SCORES",L.cx,L.top);
  const list=Array.isArray(scores)?scores:[];
  const u=13*0.6;
  const cw=[5*u,8*u,6*u,11*u];
  const gap=u;
  const total=cw.reduce((a,b)=>a+b,0)+gap*3;
  const x0=L.cx-total/2;
  const xs=[x0];
  for(let i=0;i<3;i++)xs.push(xs[i]+cw[i]+gap);
  c.font=font(11);
  c.fillStyle=MUTED;
  c.textAlign="left";
  c.fillText("RANK",xs[0],L.tableY);
  c.fillText("LEVEL",xs[2],L.tableY);
  c.fillText("DATE",xs[3],L.tableY);
  c.textAlign="right";
  c.fillText("SCORE",xs[1]+cw[1],L.tableY);
  for(let i=0;i<list.length&&i<10;i++){
    const r=list[i], y=L.tableY+(i+1)*L.rowH;
    c.font=font(13);
    c.fillStyle=TEXT;
    c.textAlign="left";
    c.fillText(String(i+1),xs[0],y);
    c.fillText(String(r.l),xs[2],y);
    c.fillText(String(r.d),xs[3],y);
    c.textAlign="right";
    c.fillStyle=i===0?ACCENT:TEXT;
    c.fillText(String(r.s),xs[1]+cw[1],y);
  }
  c.font=font(11);
  c.fillStyle=MUTED;
  c.textAlign="center";
  c.fillText("ESC BACK",L.cx,L.footY);
}

/* ATTRACT hint: 1Hz-blink footer over the live demo (spec §5.6). */
export function drawAttractHint(c,L,t){
  if((t%1)>=0.6)return;
  c.fillStyle=MUTED; c.font=font(11,"900");
  c.textAlign="center"; c.textBaseline="middle";
  c.fillText("DEMO — PRESS ANY KEY",L.cx,L.footY);
}

/* Full-canvas veil washes. */
export function drawDim(c,alpha,W,H){
  c.fillStyle="rgba(7,10,18,"+Math.max(0,Math.min(1,alpha))+")";
  c.fillRect(0,0,W,H);
}
export function drawFade(c,k,W,H){
  c.fillStyle="rgba(7,10,18,"+Math.max(0,Math.min(1,k))+")";
  c.fillRect(0,0,W,H);
}
