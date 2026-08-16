/* PROTOCOL — message shapes for future authoritative multiplayer.
   Phase-1: JSON. Same typed shapes upgrade to binary later.
   The sim NEVER imports this; only net/transport + net/client + server do. */
export const MSG={
  JOIN:   "join",     // {type,pid,name?,seed?}
  INPUT:  "input",    // {type,seq,pid,move:{x,y},fire,shift,remote,kick}
  SNAPSHOT:"snapshot",// {type,tick,seed,level,state,players[],bombs[],enemies[]}
  EVENT:  "event",    // {type,e:{t,x,y,color?}} (cosmetic fx)
  LEAVE:  "leave",    // {type,pid}
};

/* A per-player input. This is exactly what a client SENDS the server:
   intent only (move vector + edges), never coordinates the server decides. */
export function makeInput(seq, pid, input){
  return {type:MSG.INPUT, seq, pid,
    move:{x:input.move?input.move.x:0, y:input.move?input.move.y:0},
    fire:!!input.fire, shift:!!input.shift, remote:!!input.remote, kick:!!input.kick};
}

/* Authoritative snapshot the server sends to every client. Intentionally
   compact: positions + flags only. The client re-derives visuals (fx/particles). */
export function makeSnapshot(world, seed, level){
  return {
    type:MSG.SNAPSHOT,
    tick:world.tick, seed, level, state:world.state,
    players: world.players.map(p=>({
      pid:p.pid, x:Math.round(p.x), y:Math.round(p.y),
      face:{x:p.face.x,y:p.face.y}, bombKind:p.bombKind,
      bombs:p.bombs, range:p.range, shield:!!p.shield, iFrames:p.iFrames,
     })),
    bombs: world.bombs.map(b=>({tx:b.tx,ty:b.ty,timer:b.timer,radius:b.radius,
      variant:b.variant, dir:b.dir, pierce:!!b.pierce, line:!!b.line})),
    enemies: world.enemies.map(e=>({x:Math.round(e.x),y:Math.round(e.y),
      type:e.type, color:e.color, dead:!!e.dead})),
    score:world.score, lives:world.lives,
   };
}

/* Apply an authoritative snapshot into a client world (reconciliation).
   Overwrites positions/flags; keeps transient server-owned state. */
export function applySnapshot(world, snap){
  world.tick=snap.tick; world.state=snap.state;
  world.score=snap.score; world.lives=snap.lives;
  for(const sp of snap.players){
    const p=world.players[sp.pid];
    if(!p)continue;
    p.x=sp.x; p.y=sp.y; p.face=sp.face; p.bombKind=sp.bombKind;
    p.bombs=sp.bombs; p.range=sp.range; p.shield=sp.shield; p.iFrames=sp.iFrames;
   }
   // enemies reconciled by position/type (server is source of truth)
  world.enemies = snap.enemies
    .filter(se=>!se.dead)
    .map(se=>({x:se.x,y:se.y,tx:Math.floor(se.x/40),ty:Math.floor(se.y/40),
      dir:{x:1,y:0},type:se.type,color:se.color,r:14,dead:false,
      invuln:false,invulnT:0,cd:999,home:{x:0,y:0},speed:1,pass:false}));
  world.bombs    = snap.bombs.slice();
}

/* Encode/decode (JSON for phase 1). Swap to binary later without touching shapes. */
export function encode(msg){ return JSON.stringify(msg); }
export function decode(str){ return JSON.parse(str); }
