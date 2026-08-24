/* PROTOCOL — message shapes for future authoritative multiplayer.
   Phase-1: JSON. Same typed shapes upgrade to binary later.
   The sim NEVER imports this; only net/transport + net/lockstep + server do. */
export const MSG={
  JOIN:   "join",     // {type,pid,name?,seed?}
  INPUT:  "input",    // {type,seq,pid,tick,move:{x,y},fire,shift,remote,kick}
  SNAPSHOT:"snapshot",// {type,tick,seed,level,state,players[],bombs[],enemies[]}
  EVENT:  "event",    // {type,e:{t,x,y,color?}} (cosmetic fx)
  LEAVE:  "leave",    // {type,pid,tick}
  WELCOME:"welcome",  // {type,pid,seed,tick,players?}
  PAUSE:  "pause",    // host RPC {type,pid,tick}
  RESUME: "resume",   // host RPC {type,pid,tick}
  RESTART:"restart",  // host RPC {type,pid,tick}
  MENU:   "menu",     // host RPC {type,pid,tick}
  ERROR:  "error",    // {type,reason,detail?} — protocol violation report
};
export const MAX_PLAYERS=4;
export const DELAY=2;                 // lockstep lookahead window (ticks)
export const SEED_MAX=0x7FFFFFFF;     // u31 seed range

const KNOWN_TYPES=new Set(Object.values(MSG));
export function isKnownType(msg){
  return !!msg&&typeof msg.type==="string"&&KNOWN_TYPES.has(msg.type);
}

/* A per-player input. This is exactly what a client SENDS the server:
   intent only (move vector + edges), never coordinates the server decides.
   Lockstep v1 adds `tick`: the buffer tick this intent applies at. */
export function makeInput(seq, pid, input, tick){
  const m={type:MSG.INPUT, seq, pid,
    move:{x:input.move?input.move.x:0, y:input.move?input.move.y:0},
    fire:!!input.fire, shift:!!input.shift, remote:!!input.remote, kick:!!input.kick};
  if(tick!==undefined)m.tick=tick;
  return m;
}

/* Lockstep session open: seed + roster so every peer derives the same world. */
export function makeWelcome(pid, seed, tick, players){
  const w={type:MSG.WELCOME, pid, seed, tick};
  if(players)w.players=players.map(p=>({pid:p.pid}));
  return w;
}

/* Host-only control RPC; `type` is one of MSG.PAUSE/RESUME/RESTART/MENU. */
export function makeRpc(type, pid, tick){
  return {type, pid, tick};
}

/* Protocol-violation report. `reason` is pinned to ERROR_CODES; anything else
   coerces to "bad_shape" so the wire only ever carries known codes. */
export const ERROR_CODES=Object.freeze(new Set(
  ["bad_seq","bad_seed","bad_shape","unknown_pid"]));
export function makeError(reason, detail){
  if(!ERROR_CODES.has(reason))reason="bad_shape";
  const e={type:MSG.ERROR, reason};
  if(detail!==undefined)e.detail=detail;
  return e;
}

const isInt=v=>typeof v==="number"&&Number.isInteger(v);
const inDirSet=v=>v===-1||v===0||v===1;

/* Fail-closed input gate (§4). Structural faults -> {ok:false,reason:"invalid"}.
   Sequence classes let the caller pick drop-vs-halt:
     seq === lastSeq   -> "dup"   (already have it; silent drop)
     seq <  lastSeq    -> "stale" (old news; silent drop)
     seq >  lastSeq+1  -> "gap"   (desync risk; caller emits bad_seq + halt)
   Default tick window is [nowTick, nowTick+DELAY]; callers that BUFFER ahead
   (lockstep catch-up) pass windowLen=Infinity to enforce only tick>=nowTick. */
export function validateInput(msg, lastSeq, nowTick, windowLen){
  const wl=windowLen===undefined?DELAY:windowLen;
  if(!msg||msg.type!==MSG.INPUT)return{ok:false,reason:"invalid"};
  if(!isInt(msg.seq)||msg.seq<0)return{ok:false,reason:"invalid"};
  if(!isInt(msg.pid)||msg.pid<0||msg.pid>=MAX_PLAYERS)
    return{ok:false,reason:"invalid"};
  if(!isInt(msg.tick)||!Number.isFinite(msg.tick))
    return{ok:false,reason:"invalid"};
  if(msg.tick<nowTick||msg.tick>nowTick+wl)return{ok:false,reason:"invalid"};
  if(!msg.move||!isInt(msg.move.x)||!inDirSet(msg.move.x)
    ||!isInt(msg.move.y)||!inDirSet(msg.move.y))
    return{ok:false,reason:"invalid"};
  for(const k of ["fire","shift","remote","kick"])
    if(typeof msg[k]!=="boolean")return{ok:false,reason:"invalid"};
  if(lastSeq!=null){
    if(msg.seq===lastSeq)return{ok:false,reason:"dup"};
    if(msg.seq<lastSeq)return{ok:false,reason:"stale"};
    if(msg.seq>lastSeq+1)return{ok:false,reason:"gap"};
  }
  return{ok:true};
}

/* Fail-closed welcome gate: pid range, u31 seed, finite tick, roster cap. */
export function validateWelcome(msg){
  if(!msg||msg.type!==MSG.WELCOME)return{ok:false,reason:"invalid"};
  if(!isInt(msg.pid)||msg.pid<0||msg.pid>=MAX_PLAYERS)
    return{ok:false,reason:"invalid"};
  if(!isInt(msg.seed)||msg.seed<0||msg.seed>SEED_MAX)
    return{ok:false,reason:"invalid"};
  if(!isInt(msg.tick)||msg.tick<0)return{ok:false,reason:"invalid"};
  if(msg.players!==undefined){
    if(!Array.isArray(msg.players)||msg.players.length>MAX_PLAYERS)
      return{ok:false,reason:"invalid"};
    for(const p of msg.players)
      if(!p||!isInt(p.pid)||p.pid<0||p.pid>=MAX_PLAYERS)
        return{ok:false,reason:"invalid"};
  }
  return{ok:true};
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

/* @deprecated Lockstep-incompatible. Snapshot reconciliation fabricates enemy
   dynamics and cannot reproduce a peer's exact state; lockstep v1 (net/lockstep)
   never calls it. Kept only for the legacy authoritative-server path. */
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

/* Encode/decode (JSON for phase 1). Swap to binary later without touching shapes.
   decode is fail-closed: undecodable input -> null (drop + count upstream), never throw. */
export function encode(msg){ return JSON.stringify(msg); }
export function decode(str){
  try{ return JSON.parse(str); }catch{ return null; }
}

/* §4.3 array caps: any array-bearing payload passes length<=64 before the
   receive boundary delivers it (deep, bounded). Oversize -> caller drops. */
export function capsOk(v, depth){
  if(depth===undefined)depth=0;
  if(depth>8)return false;
  if(Array.isArray(v))
    return v.length<=64&&v.every(m=>capsOk(m,depth+1));
  if(v&&typeof v==="object")
    return Object.values(v).every(m=>capsOk(m,depth+1));
  return true;
}
