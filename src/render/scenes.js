import {CFG} from "../core/config.js";

/* Scene UI: menu logo, HUD, and the CLEARED / GAME OVER / PAUSED overlays.
   Pure draw; reads world + (optionally) DOM for HUD. */
export function drawLogo(c, time, cx=CFG.COLS*CFG.TILE/2,
  cy=CFG.ROWS*CFG.TILE/2){
  c.save();
  c.textAlign="center"; c.textBaseline="middle";
  const x=cx, y=cy-34;
  function text(txt,yy,size,fill,outline){
    c.font="900 "+size+"px ui-monospace,monospace";
    c.lineWidth=size*0.14; c.strokeStyle=outline||"#0a0d14"; c.lineJoin="round";
    c.strokeText(txt,x,yy); c.fillStyle=fill; c.fillText(txt,x,yy);
   }
  text("NEO", y-30, 34, "#ffd447", "#3a2a00");
  text("BOMBERMAN", y+18, 46, "#ff5d73", "#3a0014");
  c.restore();
}
export function drawOverlay(c, world, w=CFG.COLS*CFG.TILE,
  h=CFG.ROWS*CFG.TILE, cx=w/2, cy=h/2){
  c.fillStyle="rgba(6,10,20,0.80)";
  c.fillRect(0,0,w,h);
  c.textAlign="center"; c.textBaseline="middle";
  c.lineWidth=5; c.strokeStyle="#0a0d14"; c.lineJoin="round";
  function head(txt,col){ c.font="900 40px ui-monospace,monospace";
    c.strokeText(txt,cx,cy-16); c.fillStyle=col; c.fillText(txt,cx,cy-16); }
  function sub(txt,col){ c.font="15px ui-monospace,monospace"; c.fillStyle=col||"#c3d2ee";
    c.fillText(txt,cx,cy+20); }
  if(world.state==="MENU"){
    drawLogo(c, world.time, cx, cy);
    sub("Press FIRE / SPACE to start","#9fb3d8");
    c.font="11px ui-monospace,monospace"; c.fillStyle="#6f7fa0";
    c.fillText("clear every enemy to advance · collect power-ups",cx,cy+44);
    } else if(world.state==="WIN"){
    head("LEVEL "+world.level+" CLEARED","#37f0d0");
    sub("Score "+world.score+" · advancing…","#9fb3d8");
    } else if(world.state==="LOSE"){
    head("GAME OVER","#ff5d73");
    sub("Score "+world.score+" · press FIRE to retry","#9fb3d8");
    } else if(world.state==="PAUSE"){
    head("PAUSED","#ffd447");
    sub("press P to resume","#9fb3d8");
    }
}
export function updateHud(hud, world){
  const p=world.players[0];
  const set=(id,v)=>{ if(hud&&hud[id]) hud[id].textContent=v; };
  set("score",world.score); set("level",world.level); set("lives",world.lives);
  set("enemies",world.enemies.length);
  if(p){ set("bombs",p.bombs); set("range",p.range); }
}
export function makeHud(dom){
  return {
    score:dom&&dom.getElementById?dom.getElementById("score"):null,
    level:dom&&dom.getElementById?dom.getElementById("level"):null,
    lives:dom&&dom.getElementById?dom.getElementById("lives"):null,
    enemies:dom&&dom.getElementById?dom.getElementById("enemies"):null,
    bombs:dom&&dom.getElementById?dom.getElementById("bombs"):null,
    range:dom&&dom.getElementById?dom.getElementById("range"):null,
  };
}
