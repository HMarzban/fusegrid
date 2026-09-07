import {CFG} from "../core/config.js";

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
  cmbN:0,cmbT:0,calS:"",calT:0,nmT:0,nmCd:0};
let tag=null;
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
   attract <-> live boundary or a room change. */
export function syncFx(world){
  const t=world ? world.seed+":"+world.level : null;
  if(t!==tag){ tag=t; fx.parts=[]; clearR2(); }
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
