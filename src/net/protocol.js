/* PROTOCOL — message shapes for future authoritative multiplayer.
   Phase-1: JSON. Same typed shapes upgrade to binary later.
   The sim NEVER imports this; only net/transport + net/lockstep + server do. */
export const MSG={
  JOIN:   "join",     // {type,pid,name?,seed?}
  INPUT:  "input",    // {type,seq,pid,tick,move:{x,y},fire,shift,remote,kick}
  SNAPSHOT:"snapshot",// {type,tick,seed,level,state,players[],bombs[],enemies[],tiles?}
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
   Lockstep v1 adds `tick`: the buffer tick this intent applies at.
   `kick` is a reserved wire slot, always false: KICK is passive and no intent
   carries it, but the shape and validateInput's boolean gate stay. */
export function makeInput(seq, pid, input, tick){
  const m={type:MSG.INPUT, seq, pid,
    move:{x:input.move?input.move.x:0, y:input.move?input.move.y:0},
    fire:!!input.fire, shift:!!input.shift, remote:!!input.remote, kick:false};
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

const fnv=a=>{
  let h=0x811c9dc5;
  if(a)for(let i=0;i<a.length;i++){h^=a[i];h=Math.imul(h,16777619);}
  return h>>>0;
};
/* The floor-tile state of a gen-3 world, sparse so every list stays well under
   capsOk's 64 (a board holds <=16 tiles) and no typed array reaches the wire:
   layer / pair / grid as hashes, live cells as [k,featM,featS] (a CORE GATE's
   featS can run with featM 0, so either counts as live), QUICKSAND as
   [k,st,t,n], then the per-entity tile fields, in entity order. */
function tileDump(w){
  const cells=[];
  for(let k=0;k<w.feat.length;k++)
    if(w.featM[k]||w.featS[k])cells.push([k,w.featM[k],w.featS[k]]);
  return {
    t:w.featT, n:w.featN|0, tier:w.featTier!=null?w.featTier:w.heat,
    feat:fnv(w.feat), pair:fnv(w.featPair), grid:fnv(w.grid), cells,
    pend:w.featPend.map(q=>({...q})),
    quick:w.quick&&w.quick.grid===w.grid?w.quick.list.map(q=>[q.k,q.st,q.t,q.n]):[],
    players:w.players.map(p=>[p.gl?{...p.gl}:null,p.glBuf?{...p.glBuf}:null,p.warpK,p.beltT]),
    foes:w.enemies.map(e=>[e.warpK,e.warpHold,e.warpFrom,e.plateK,e.beltT]),
    bombs:w.bombs.map(b=>[!!b.carry,b.slide?{...b.slide}:null,b.prog,b.warpK]),
  };
}

/* Authoritative snapshot the server sends to every client. Intentionally
   compact: positions + flags only. The client re-derives visuals (fx/particles).
   `tiles` exists only on a world with a floor-tile layer; gen 1 / 2 keep the old shape. */
export function makeSnapshot(world, seed, level){
  return {
    ...(world.feat?{tiles:tileDump(world)}:null),
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
