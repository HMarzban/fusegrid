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
const fx={shakeT:0,shakeX:0,shakeY:0,flashT:0,parts:[]};
let tag=null;

export function initFx(){
  fx.shakeT=0; fx.shakeX=0; fx.shakeY=0; fx.flashT=0; fx.parts=[];
}
export function getShake(){ return {x:fx.shakeX, y:fx.shakeY}; }
export function getFlash(){ return fx.flashT; }
export function getFx(){ return fx.parts; }

/* Wipes particles whenever the world identity (seed:level) changes — replaces
   the old loadLevel `w.particles=[]` wipe now that storage lives here. */
export function syncFx(world){
  const t=world ? world.seed+":"+world.level : null;
  if(t!==tag){ tag=t; fx.parts=[]; }
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
