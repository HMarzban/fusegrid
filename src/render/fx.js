import {CFG} from "../core/config.js";
import {POWER} from "../core/entities.js";
import {drawIcon} from "./icons.js";

/* FX layer: particles, screen shake, confetti. Renderer-local; built from
   world.events. All particle storage lives in this module singleton, so the
   renderer never mutates simulation-shaped state and headless worlds carry no
   fx baggage.
   SINGLE-RENDERER ASSUMPTION: one live renderer owns the singleton at a time.
   Sequential re-create is safe — initFx() fully resets state and syncFx()
   retags by world identity, both idempotent — so the main.js per-kind
   renderer cache and any rebuild are fine. Two renderers stepping
   SIMULTANEOUSLY would interleave particles/shake in one store; no such
   caller exists and none should be added without refactoring storage out. */
const fx={shakeT:0,shakeX:0,shakeY:0,flashT:0,parts:[],
  cmbN:0,cmbT:0,calS:"",calT:0,nmT:0,nmCd:0,lbl:[],pv:null,bk:null,pu:{b:0,r:0,l:0},ab:null,gone:[]};
let tag=null, tagRng=null;
/* Settings damping (nb.settings.v1). Applied INSIDE the two getters so both
   render paths and both call sites are covered without touching either draw
   site. NOT reset by initFx(): these are user preference, and every renderer
   construction calls initFx() — a RENDER toggle would otherwise drop them. */
let flashK=1, shakeK=1;
const k01=(v,d)=>(typeof v==="number"&&isFinite(v)?Math.max(0,Math.min(1,v)):d);
export function setFxOpts(o){
  if(o){ if(o.flashK!=null)flashK=k01(o.flashK,flashK);
    if(o.shakeK!=null)shakeK=k01(o.shakeK,shakeK); }
  return {flashK,shakeK};
}
export function getFxOpts(){ return {flashK,shakeK}; }

export function initFx(){
  fx.shakeT=0; fx.shakeX=0; fx.shakeY=0; fx.flashT=0; fx.parts=[];
  clearR2();
}
function clearR2(){
  fx.cmbN=0; fx.cmbT=0; fx.calS=""; fx.calT=0; fx.nmT=0; fx.nmCd=0;
  fx.lbl=[]; fx.pv=null; fx.bk=null; fx.pu={b:0,r:0,l:0}; fx.ab=null; fx.gone=[];
}
export function getShake(){ return {x:fx.shakeX*shakeK, y:fx.shakeY*shakeK}; }
export function getFlash(){ return fx.flashT*flashK; }
export function getFx(){ return fx.parts; }

/* R2 detectors — PURE, exported, pinned (tests/fx.test.mjs). Both read the
   drained batch and read-only world state; neither touches the fx singleton,
   so feedFx below is the only stateful piece of R2.
   comboOf's boom gate is the discriminator for "from one detonation chain":
   detonate() is synchronous and recursive (sim.js:353-379), so one chain lands
   entirely inside one world.events batch as [kills...][boom] groups. A
   boom-FREE batch is blade attrition — updateBombs re-runs applyBlastHits for
   every live blade each tick (sim.js:257-259) — and scores nothing. */
export function comboOf(events){
  if(!events||!events.length) return 0;
  let boom=false, n=0;
  for(let i=0;i<events.length;i++){
    const e=events[i]; if(!e) continue;
    if(e.t==="boom") boom=true; else if(e.t==="kill") n++;
  }
  return boom?n:0;
}
export function comboLabel(n){
  const k=n|0;
  if(k<2) return "";
  if(k===2) return "DOUBLE";
  if(k===3) return "TRIPLE";
  if(k===4) return "QUAD";
  return "CHAIN ×"+k;
}
/* Close-call envelope, measured against the REAL hit test: applyBlastHits hits
   via aabb(w.grid,t.tx,t.ty,p.x,p.y,CFG.TILE*0.3) (sim.js:339-349), so the hit
   envelope reaches CFG.TILE*0.3 past the tile rect. "Own tile is not a blast
   tile" is therefore NOT "survived" — the inner bound is that call's own
   geometry. The outer bound is a design pick: an aligned adjacent tile is
   exactly 40px and a half-tile-diagonal offset is 44.7px and does not count,
   so the flash means "the arm stopped one tile short of you". */
const HIT_D=CFG.TILE*0.5+CFG.TILE*0.3, NEAR_D=CFG.TILE*1.10;
export function nearMissOf(world, events){
  if(!world) return false;
  const p=world.players&&world.players[0];
  if(!p||!p.alive||p.iFrames>0) return false;
  const ev=events!==undefined?events:world.events;
  if(ev&&ev.length) for(let i=0;i<ev.length;i++)
    if(ev[i]&&ev[i].t==="hurt") return false;
  const bs=world.blades;
  if(!bs||!bs.length) return false;
  let dmin=Infinity;
  for(const bl of bs){
    if(!bl||!bl.tiles) continue;
    for(const t of bl.tiles){
      const d=Math.max(Math.abs(p.x-(t.tx+0.5)*CFG.TILE),
                       Math.abs(p.y-(t.ty+0.5)*CFG.TILE));
      if(d<dmin) dmin=d;
    }
  }
  return dmin>HIT_D&&dmin<=NEAR_D;
}

/* R2 feed. Called from consumeEvents in BOTH renderers, between syncFx and the
   world.events wipe, so it reads the same batch main.js reads non-destructively
   for the ghost coach — same frame, zero main.js diff, 2D+3D parity for free.
   PLAY-ONLY, and it owns the decay of every timer below. render() runs on
   PAUSE/WIN/LOSE frames too (main.js:649), so an ungated feed would close a
   group on a paused clock and paint the callout on top of the PAUSED list.
   This is main.js:547's `if(world.state==="PLAY") coachT+=dt` applied to the
   fx layer. updateFx is deliberately NOT the owner: shake, flash and confetti
   must keep running through WIN. */
export function feedFx(world, dt){
  if(!world||world.state!=="PLAY") return;
  const d=dt||CFG.STEP, ev=world.events||[];
  const n=comboOf(ev);
  if(n>0){ fx.cmbN+=n; fx.cmbT=CFG.BLADE_TTL; }
  if(fx.cmbT>0&&(fx.cmbT-=d)<=0){
    if(fx.cmbN>=2){ fx.calS=comboLabel(fx.cmbN); fx.calT=0.90; }
    fx.cmbN=0; fx.cmbT=0;
  }
  fx.calT=Math.max(0,fx.calT-d);
  fx.nmT=Math.max(0,fx.nmT-d);
  fx.nmCd=Math.max(0,fx.nmCd-d);
  /* Evaluated only on frames whose batch carries a boom — "the frame the blast
     was born" — which reuses the read comboOf already did and removes a
     freshness constant. REDUCE FLASH (flashK<1) suppresses the flash ENTIRELY
     at feed time, so nmT is never even set: main.js:189 only damps flx to 0.25,
     and for a brand-new light source that is not good enough. */
  if(flashK>=1&&fx.nmCd<=0&&hasBoom(ev)&&nearMissOf(world,ev)){
    fx.nmT=0.18; fx.nmCd=0.60;
  }
  feedPickup(world, ev, d);
}
function hasBoom(ev){
  for(let i=0;i<ev.length;i++) if(ev[i]&&ev[i].t==="boom") return true;
  return false;
}
export function getCallout(){ return fx.calT>0?fx.calS:""; }
export function getNearMiss(){ return fx.nmT; }

/* Wipes particles whenever the world identity (seed:level) changes — replaces
   the old loadLevel `w.particles=[]` wipe now that storage lives here. R2's
   timers go with them, WITHOUT emitting the open group: feedFx also runs for
   the attract demo world, so an open combo would otherwise leak across the
   attract <-> live boundary or a room change.
   world.rng's OBJECT IDENTITY is folded in alongside the seed:level string so
   a SAME-LEVEL restart also retags. loadLevel (world.js:74) reassigns
   `w.rng = createRng(...)` to a brand-new object on every call — the only
   `.rng =` assignment anywhere in src/ — even when seed and level are
   unchanged, which is exactly the startGame() (sim.js:107-111) and
   pause-RESTART (main.js) case: same seed, same level, string tag alone never
   changes. Without this, a room-1 death/restart left a frozen callout and
   stale particles painting over the new run's first frames. */
export function syncFx(world){
  const t=world ? world.seed+":"+world.level : null;
  const r=world ? world.rng : null;
  if(t!==tag||r!==tagRng){ tag=t; tagRng=r; fx.parts=[]; clearR2(); }
}

export function onEvent(world, ev, time){
  switch(ev.t){
    case "bomb":  addParticles(ev.x, ev.y, 4, "#ffcf5a"); break;
    case "boom":  addParticles(ev.x, ev.y, 20, "#fff8d8");
                   fx.shakeT=Math.min(0.7,fx.shakeT+0.22); fx.flashT=1; break;
    case "kill":  addParticles(ev.x, ev.y, 22, ev.color||"#8affc1");
                   fx.shakeT=Math.min(0.7,fx.shakeT+0.08); break;
    case "power": addParticles(ev.x, ev.y, 16, ev.col||"#37f0d0");
                   addParticles(ev.x, ev.y, 6, "#fff8d8");
                   addStreaks(ev.x, ev.y, 6, ev.col||"#37f0d0"); break;
    case "brick": addParticles(ev.x, ev.y, 6, "#c9793f"); break;
    case "hurt":  addParticles(ev.x, ev.y, 6, "#ff5d73");
                   addParticles(ev.x, ev.y, 4, "#ff8a9a");
                   fx.shakeT=Math.max(fx.shakeT,0.15); break;
    case "kick":  addParticles(ev.x, ev.y, 8, "#c4a070");
                   addStreaks(ev.x, ev.y, 4, "#e8d4a8"); break;
    case "throw": addParticles(ev.x, ev.y, 3, "#ffe28a");
                   addParticles(ev.x, ev.y, 2, "#fff8d8"); break;
    case "remote":addParticles(ev.x, ev.y, 7, "#7fe0ff"); break;
    case "lose":  addConfetti(50,["#ff5d73","#ff3b5c","#c23058","#ff8a9a"]);
                   fx.shakeT=Math.min(0.7,fx.shakeT+0.28); break;
    case "win":   addConfetti(60); fx.shakeT=Math.max(fx.shakeT,0.15); break;
  }
}
function addParticles(x, y, n, color){
  for(let i=0;i<n;i++){
    const a=Math.random()*6.283, s=Math.random()*3+1;
    fx.parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,t:0,life:0.4+Math.random()*0.35,color,size:Math.random()*3+1});
  }
}
function addStreaks(x, y, n, color){
  for(let i=0;i<n;i++){
    const a=Math.random()*6.283, s=2.2+Math.random()*1.6;
    fx.parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,t:0,life:0.16+Math.random()*0.08,color,size:1.2,streak:true});
  }
}
function addConfetti(n, cols){
  const pal=cols||["#ffd447","#ff5d73","#37f0d0","#7fe0ff"];
  for(let i=0;i<n;i++){
    fx.parts.push({
      x:Math.random()*CFG.COLS*CFG.TILE, y:-10,
      vx:(Math.random()-0.5)*1.5, vy:1+Math.random()*2, t:0,
      life:2+Math.random(), color:pal[(Math.random()*pal.length)|0],
      size:3+Math.random()*3, confetti:true
    });
  }
}
export function updateFx(dt){
  fx.shakeT=Math.max(0,fx.shakeT-dt);
  fx.flashT=Math.max(0,fx.flashT-dt*3.5);
  fx.shakeX=(Math.random()-0.5)*fx.shakeT*18;
  fx.shakeY=(Math.random()-0.5)*fx.shakeT*18;
  for(const p of fx.parts){
    p.x+=(p.vx||0); p.y+=(p.vy||0);
    if(p.confetti) p.vy+=0.05;
    else { p.vx*=0.92; p.vy*=0.92; }
    p.t+=dt;
  }
  fx.parts=fx.parts.filter(p=>p.t<p.life && p.y<CFG.ROWS*CFG.TILE+30);
}
export function drawFx(c){
  const ps=getFx();
  for(const p of ps){
    c.globalAlpha=Math.max(0,1-p.t/p.life);
    c.fillStyle=p.color;
    if(p.confetti){
      c.save(); c.translate(p.x,p.y); c.rotate(p.y*0.1);
      c.fillRect(-p.size/2,-p.size/2,p.size,p.size*1.4);
      c.restore();
    } else if(p.streak){
      c.save(); c.translate(p.x,p.y); c.rotate(Math.atan2(p.vy,p.vx));
      c.fillRect(0,-p.size/2,p.size*5,p.size);
      c.restore();
    } else {
      c.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
    }
  }
  c.globalAlpha=1;
}

/* R2 overlay. Deliberately NOT folded into drawFx, which renderer.js calls
   TWICE in a WIN/LOSE frame (:66 and :79) and which the 3D path never calls at
   all (wrapper feeds getFx() to three particles instead). Drawn in overlay/HUD
   space — the same space drawHudChips and drawCoach use — so CLASSIC 2D and
   REAL 3D are identical.
   The close-call is a 6px inner border, not the existing full-screen flashT
   wash: a new light source over the whole board is exactly the over-juicing
   report §4 R2 names as the risk. The callout is a static label that fades —
   no blink, no scale-pop, no colour cycling — which is why it needs no REDUCE
   FLASH gate of its own; there is nothing to flash. */
export function drawFxOverlay(c){
  const BW=CFG.COLS*CFG.TILE, BH=CFG.ROWS*CFG.TILE;
  if(fx.nmT>0){
    c.save();
    c.globalAlpha=0.22*(fx.nmT/0.18);
    c.fillStyle="#fff8d8";
    c.fillRect(0,0,BW,6); c.fillRect(0,BH-6,BW,6);
    c.fillRect(0,6,6,BH-12); c.fillRect(BW-6,6,6,BH-12);
    c.globalAlpha=1;
    c.restore();
  }
  if(fx.calT>0&&fx.calS){
    c.save();
    c.globalAlpha=Math.min(1,fx.calT/0.35);
    c.textAlign="center"; c.textBaseline="middle";
    c.font="900 26px ui-monospace,monospace";
    c.lineWidth=5; c.lineJoin="round"; c.strokeStyle="#0a0d14";
    c.strokeText(fx.calS,BW/2,96);
    c.fillStyle="#ffd447";
    c.fillText(fx.calS,BW/2,96);
    c.globalAlpha=1;
    c.restore();
  }
}

/* Pickup feedback (owner ruling 2026-10-10, research A + B). One floating
   label per `power` event, built in feedFx from the drained batch, so it runs
   on the same PLAY-only clock (PAUSE freezes it) and dies with clearR2 on a
   world change. The text is the value AFTER the pickup, never "+1": applyPower
   has already run by the time the batch reaches the renderer. Names come from
   POWER[].name — no second copy. The pulse is a 600 ms outline fade on the
   FLAME / BOMB chip or the heart row when that number changes; the first feed
   after a wipe only seeds the baseline, so a room change never pulses.
   drawPickupFx paints in overlay space through an optional proj(bx,by,h)
   (REAL 3D passes the live camera projection, CLASSIC 2D and PIXEL pass
   nothing: overlay space is board space there) and paints nothing at all
   while no label or pulse is live, so every idle call log is unchanged. */
const PDEF={};
for(const d of POWER) PDEF[d.t]=d;
const BKIND={line:1,power:1,pierce:1};
export const LBL=Object.freeze({life:0.9,rise:22,riseT:0.6,fade:0.35,merge:0.25,near:1.5,max:3,step:20,top:46,pulse:0.6,lift:0,subH:16,subY:17,subDn:25});
export function pickupLabel(kind, p, prev){
  const d=PDEF[kind];
  if(!d) return null;
  const q=p||{}, cap=(v,m)=>(v>=m?[d.name,"MAX"]:[d.name+" "+(v|0),""]);
  let s=d.name, m="", sub="";
  if(kind==="fire") [s,m]=cap(q.range|0,CFG.MAX_RANGE);
  else if(kind==="bomb") [s,m]=cap(q.bombs|0,CFG.MAX_BOMBS);
  else if(kind==="speed") [s,m]=(q.speed||0)>=CFG.MAX_SPEED?[d.name,"MAX"]:[d.name+" UP",""];
  else if(kind==="heart") s="+1 LIFE";
  else if(BKIND[kind]){
    s=d.name+" BOMB";
    if(BKIND[prev]&&prev!==kind) sub="replaces "+PDEF[prev].name;
  }
  return {k:kind,s,m,sub,col:d.col};
}
export const labelText=(l)=>(l.m?l.s+" "+l.m:l.s);
function addLabel(e, L){
  const tx=Math.floor(e.x/CFG.TILE), ty=Math.floor(e.y/CFG.TILE);
  const o=fx.lbl.find((l)=>l.k===L.k);
  if(o){ Object.assign(o,L); o.tx=tx; o.ty=ty; o.t=0; o.sup=false; return; }
  let st=0, sb=false;
  for(const l of fx.lbl)
    if(l.t<LBL.merge&&Math.hypot(l.tx-tx,l.ty-ty)<=LBL.near){ st=Math.max(st,l.st+1); sb=sb||!!l.sub; }
  fx.lbl.push(Object.assign({tx,ty,t:0,st,sb,sup:false},L));
  while(fx.lbl.length>LBL.max){
    let i=0;
    for(let j=1;j<fx.lbl.length;j++) if(fx.lbl[j].t>fx.lbl[i].t) i=j;
    fx.lbl.splice(i,1);
  }
}
function feedPickup(world, ev, d){
  const p=world.players&&world.players[0];
  if(fx.lbl.length){ let j=0; for(const l of fx.lbl){ l.t+=d; if(l.t<LBL.life) fx.lbl[j++]=l; } fx.lbl.length=j; }
  let prev=fx.bk;
  for(let i=0;i<ev.length;i++){
    const e=ev[i];
    if(!e||e.t!=="power") continue;
    const L=pickupLabel(e.kind,p,prev);
    if(!L) continue;
    addLabel(e,L);
    if(BKIND[e.kind]) prev=e.kind;
  }
  fx.bk=p?p.bombKind||"normal":null;
  const u=fx.pu;
  u.b=Math.max(0,u.b-d); u.r=Math.max(0,u.r-d); u.l=Math.max(0,u.l-d);
  const b=p?p.bombs|0:0, r=p?p.range|0:0, lv=world.lives|0, v=fx.pv;
  if(!v){ fx.pv={b,r,l:lv}; feedStrip(p, d); return; }
  if(b!==v.b) u.b=LBL.pulse;
  if(r!==v.r) u.r=LBL.pulse;
  if(lv!==v.l) u.l=LBL.pulse;
  v.b=b; v.r=r; v.l=lv;
  feedStrip(p, d);
}
/* Ability bar strip (research D). The bar itself paints straight from player
   state (drawAbilityBar, scenes.js); the only state it needs is which chips a
   hit (or a spent SHIELD) just took away, so they can dim and fade over
   LBL.pulse instead of vanishing. Tracked here on the same PLAY-only clock
   and wiped with clearR2, so a room change or a new run never fades a chip:
   the first feed after a wipe only seeds the baseline. A bomb-kind swap is a
   replacement, not a loss — the label already says "replaces X". */
const AB=["shield","kick","throw","pass","bk","remote","speed"];
export const abilityOrd=(k)=>AB.indexOf(BKIND[k]?"bk":k);
export function abilityList(p){
  const q=p||{}, o=[];
  if(q.shield) o.push("shield");
  if(q.kick) o.push("kick");
  if(q.throw) o.push("throw");
  if(q.passing) o.push("pass");
  if(BKIND[q.bombKind]) o.push(q.bombKind);
  if(q.remote) o.push("remote");
  if((q.speed||0)>=CFG.PLAYER_START.speed+CFG.SPEED_UP/2) o.push("speed");
  return o;
}
export function abilityText(k, p){
  const d=PDEF[k];
  if(!d) return ["","",""];
  if(k!=="speed") return [d.name,"",d.col];
  const v=(p&&p.speed)||0;
  return v>=CFG.MAX_SPEED?["SPD","MAX",d.col]:["SPD "+Math.round((v-CFG.PLAYER_START.speed)/CFG.SPEED_UP),"",d.col];
}
function feedStrip(p, d){
  const cur=abilityList(p), was=fx.ab, g=fx.gone;
  let j=0;
  for(const e of g){ e.t-=d; if(e.t>0&&!cur.includes(e.k)&&!(BKIND[e.k]&&cur.some((c)=>BKIND[c]))) g[j++]=e; }
  g.length=j;
  if(was) for(const k of was){
    if(cur.includes(k)||BKIND[k]&&cur.some((c)=>BKIND[c])) continue;
    const o=g.find((e)=>e.k===k);
    if(o) o.t=LBL.pulse; else g.push({k,t:LBL.pulse});
  }
  fx.ab=cur;
}
export function getStrip(){ return fx.gone; }
export function getLabels(){ return fx.lbl; }
export function getPulse(){ return {b:fx.pu.b,r:fx.pu.r,l:fx.pu.l}; }
const CHAR=10.8, BW0=CFG.COLS*CFG.TILE;
const ease=(t)=>1-Math.pow(1-Math.min(1,Math.max(0,t)),3);
/* PURE layout over one label: x is the left edge of icon+word, y the text
   middle, a the alpha. The y46 test uses the FULL rise, so a label never
   flips sides mid-animation; below the tile it drifts DOWN, away from the
   tile. The rise scales with the projected tile height (k, 1 in board space)
   so a far 3D row is not left a row and a half behind. x centres on the
   mid of the near and far edge, which is the tile centre in every look. An
   above-side label that meets the combo callout hops over it while that
   stays clear of y46, else (and for a below-side one) it drops under it.
   cal is the live combo callout {s,w} or null, cw the live coach v2 panel
   width (0 when shut), l.tw a measured word width, bw the overlay width (608
   on the iso canvas; the callout centres on it, the coach panel on 300). A
   label is 20 px tall, 36 with its "replaces X" sub-line (dn is how far it
   reaches below its text middle): a stacked label above the tile adds its
   OWN sub height, one below adds the sub of the label it stacks on (l.sb).
   Callout and coach panel are one obstacle list: an above-side label hops
   over every band it meets while that stays clear of y46, else it drops
   under them. drawPickupFx latches any overlap it still finds (an iso
   diagonal, two rise phases) into l.st, so a label only ever steps further
   from its tile and never snaps back. Known per-look difference: a row-1
   pickup drops below its tile in CLASSIC 2D and PIXEL, but REAL 3D's far rim
   projects its top clear of y46, so there it stays above. */
export function labelBox(l, proj, still, cal, bw, cw){
  const T=CFG.TILE, cx=(l.tx+0.5)*T, BW=bw||BW0;
  const top=proj?proj(cx,l.ty*T,LBL.lift):{x:cx,y:l.ty*T};
  const bot=proj?proj(cx,(l.ty+1)*T,0):{x:cx,y:(l.ty+1)*T};
  const R=LBL.rise*Math.min(1,Math.max(0.5,(bot.y-top.y)/T));
  const dn=l.sub?LBL.subDn:9, st=l.st*LBL.step, exA=l.st>0&&l.sub?LBL.subH:0;
  const below=top.y-12-(still?0:R)-st-exA-9<LBL.top;
  const off=(still?0:R*ease(l.t/LBL.riseT))+st+(below?(l.st>0&&l.sb?LBL.subH:0):exA);
  const w=18+(l.tw>0?l.tw:labelText(l).length*CHAR);
  let y=below?bot.y+12+off:top.y-12-off;
  const x=Math.round(Math.min(BW-4-w,Math.max(4,(top.x+bot.x)/2-w/2)));
  const ob=[];
  if(cal&&cal.s){ const k=(cal.w>0?cal.w:cal.s.length*15.6)+8; ob.push([96,BW/2-k/2,BW/2+k/2]); }
  if(cw>0) ob.push([130,BW0/2-cw/2,BW0/2+cw/2]);
  if(ob.length){
    const hit=(v)=>ob.find((q)=>v-11<q[0]+13&&v+dn+2>q[0]-13&&x<q[2]&&x+w>q[1]);
    let q=hit(y);
    if(q){
      let ya=y;
      for(let i=0;i<3&&!below&&(q=hit(ya));i++) ya=q[0]-13-4-dn-st;
      if(!below&&!hit(ya)&&ya-9>=LBL.top) y=ya;
      else for(let i=0;i<3&&(q=hit(y));i++) y=q[0]+13+4+9+st;
    }
  }
  const rem=LBL.life-l.t;
  return {x,y:Math.round(y),w,dn,a:rem<LBL.fade?Math.max(0,rem/LBL.fade):1,below};
}
const PULSE_BOX={b:[140,10,76,30],r:[224,10,82,30]};
export function coachKind(c2){ return c2&&c2.a>0&&c2.k||null; }
const mw=(c,s)=>{ const m=c.measureText?c.measureText(s):null; return m&&m.width>0?m.width:0; };
export function drawPickupFx(c, o){
  const u=fx.pu;
  if(!fx.lbl.length&&!(u.b>0||u.r>0||u.l>0)) return;
  const ico=o&&o.ico, proj=o&&o.proj, bw=o&&o.bw, ck=coachKind(o&&o.coach);
  const cw=o&&o.coach&&o.coach.a>0&&o.coach.s?String(o.coach.s).length*7.2+24:0;
  c.save();
  if(u.b>0||u.r>0||u.l>0){
    for(const k of ["b","r","l"]){
      if(!(u[k]>0)) continue;
      let bx;
      if(k==="l"){ const n=Math.min(6,fx.pv?fx.pv.l:0); if(!n) continue;
        let hw=(n-1)*19+22;
        if(fx.pv.l>6){ c.font="900 12px ui-monospace,monospace"; const s="+"+(fx.pv.l-6); hw=Math.min(126,125+(mw(c,s)||s.length*7.2)); }
        bx=[5,13,hw,24]; }
      else bx=PULSE_BOX[k];
      c.globalAlpha=u[k]/LBL.pulse;
      c.lineWidth=4; c.strokeStyle="#0a0d14";
      c.strokeRect(bx[0]-2,bx[1]-2,bx[2]+4,bx[3]+4);
      c.lineWidth=2; c.strokeStyle=k==="b"?"#ff5d73":k==="r"?"#ff8a3c":"#ff3b5c";
      c.strokeRect(bx[0]-2,bx[1]-2,bx[2]+4,bx[3]+4);
    }
    c.globalAlpha=1;
  }
  const still=flashK<1||shakeK<=0;
  let cal=null;
  if(fx.calT>0&&fx.calS){ c.font="900 26px ui-monospace,monospace"; cal={s:fx.calS,w:mw(c,fx.calS)}; }
  c.textBaseline="middle"; c.lineJoin="round";
  const put=[];
  for(const l of fx.lbl){
    if(ck&&l.k===ck) l.sup=true;
    if(l.sup) continue;
    c.font="900 18px ui-monospace,monospace"; l.tw=mw(c,labelText(l));
    let b=labelBox(l,proj,still,cal,bw,cw);
    if(!(b.a>0)) continue;
    for(let i=0;i<LBL.max&&put.some((q)=>b.y-10<q.y+q.dn+1&&q.y-10<b.y+b.dn+1&&b.x<q.x+q.w&&b.x+b.w>q.x);i++){
      l.st++; b=labelBox(l,proj,still,cal,bw,cw);
    }
    put.push(b);
    c.globalAlpha=b.a*0.9; c.fillStyle="#3b4868"; c.strokeStyle="#0a0d14"; c.lineWidth=2;
    c.beginPath(); c.arc(b.x+7,b.y,10,0,Math.PI*2); c.fill(); c.stroke();
    c.globalAlpha=b.a;
    if(ico) ico(c,l.k,l.col,b.x+7,b.y);
    else { c.save(); c.translate(b.x+7,b.y); c.scale(14/24,14/24); drawIcon(c,l.k,l.col,0); c.restore(); }
    c.textAlign="left"; c.font="900 18px ui-monospace,monospace";
    c.lineWidth=4; c.strokeStyle="#0a0d14";
    c.strokeText(l.s,b.x+18,b.y); c.fillStyle="#eef3ff"; c.fillText(l.s,b.x+18,b.y);
    if(l.m){ const mx=b.x+18+(mw(c,l.s+" ")||(l.s.length+1)*CHAR);
      c.strokeText(l.m,mx,b.y); c.fillStyle="#9fb3d8"; c.fillText(l.m,mx,b.y); }
    if(l.sub){ c.textAlign="center"; c.font="900 13px ui-monospace,monospace"; c.lineWidth=3;
      c.strokeText(l.sub,b.x+b.w/2,b.y+LBL.subY); c.fillStyle="#9fb3d8"; c.fillText(l.sub,b.x+b.w/2,b.y+LBL.subY); }
  }
  c.globalAlpha=1;
  c.restore();
}
