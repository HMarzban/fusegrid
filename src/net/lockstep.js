/* LOCKSTEP V1 — deterministic fixed-delay input lockstep over any transport.
   Every peer runs the SAME sim from the same seed; a tick T executes only when
   EVERY live peer's intent for T is buffered, so state is a pure function of
   (seed, ordered input stream) — identical on all peers by construction.
   Outbound: transport.send(msg). Inbound: handleMessage(msg) (also auto-wired
   via transport.on when the transport supports emission).
   Policy tiers: malformed traffic is dropped silently + counted; SEQUENCE and
   roster violations (bad_seq / unknown_pid / bad_host / bad_tick) halt the
   session fail-closed and surface as ls.error. */
import {MSG, MAX_PLAYERS, DELAY, makeInput, validateInput, validateWelcome}
  from "./protocol.js";
import {loadLevel, step} from "../core/sim.js";
import {hurtPlayer} from "../core/entities.js";

export const HOST_PID=0;
const RPC_KINDS=[MSG.PAUSE,MSG.RESUME,MSG.RESTART,MSG.MENU];
const neutralIntent=Object.freeze({move:{x:0,y:0},fire:false,shift:false,
  remote:false,kick:false});
const normIntent=(i)=>({move:{x:i&&i.move?i.move.x:0,y:i&&i.move?i.move.y:0},
  fire:!!(i&&i.fire), shift:!!(i&&i.shift), remote:!!(i&&i.remote),
  kick:!!(i&&i.kick)});

export function createLockstep(opts){
  const selfPid=opts.selfPid;
  const world=opts.world;
  const transport=opts.transport;
  const dt=opts.dt!=null?opts.dt:1/60;
  const roster=Object.freeze(
    (opts.players||[selfPid]).slice().sort((a,b)=>a-b));
  const ls={
    selfPid, world, transport, dt, roster,
    nextExec:0,                        // next buffer tick to execute
    mySeq:-1,
    lastSeq:new Map(),                 // remote pid -> last accepted seq
    buffer:new Map(),                  // tick -> Map(pid -> intent)
    rpcs:[],                           // {tick,kind,pid} canonical-sorted at apply
    rpcKeys:new Set(),                 // dedupe loopback echoes
    deaths:[],                         // {tick,pid} leave deaths, pid-sorted
    leftPids:new Set(),
    pendingSelf:null,
    stalled:false, stallCount:0, stallEvents:0,
    halted:false, error:null, errors:[],
    invalidDrops:0,
   };
  // warmup: ticks < DELAY run neutral for every roster pid so both peers
  // start executing from tick 0 without waiting on future-tagged inputs.
  for(let t=0;t<DELAY;t++){
    const b=new Map();
    for(const p of roster)b.set(p,{...neutralIntent,move:{x:0,y:0}});
    ls.buffer.set(t,b);
  }
  if(transport&&typeof transport.on==="function")
    for(const ty of ["input","leave",...RPC_KINDS,"welcome","error"])
      transport.on(ty,(m)=>ls.handleMessage(m));

  const fail=(reason,detail)=>{
    ls.halted=true;
    ls.error={reason,detail};
    ls.errors.push(ls.error);
    transport.send({type:MSG.ERROR,from:selfPid,reason,
      detail:detail==null?null:detail});
   };

  ls.pushIntent=(intent)=>{
    if(ls.halted||ls.leftPids.has(selfPid))return false;
    const it=normIntent(intent);
    ls.pendingSelf=it;
    const tick=ls.nextExec+DELAY;
    const seq=++ls.mySeq;
    let b=ls.buffer.get(tick);
    if(!b){b=new Map();ls.buffer.set(tick,b);}
    b.set(selfPid,it);
    transport.send(makeInput(seq,selfPid,it,tick));
    return true;
   };

  ls.rpc=(kind)=>{
    if(selfPid!==HOST_PID)return false;
    if(ls.halted||ls.leftPids.has(selfPid))return false;
    if(!RPC_KINDS.includes(kind))return false;
    applyRpcLocal(kind,ls.nextExec+DELAY,selfPid);
    transport.send({type:kind,pid:selfPid,tick:ls.nextExec+DELAY});
    return true;
   };

  ls.leave=()=>{
    if(ls.leftPids.has(selfPid)||ls.halted)return false;
    const tick=ls.nextExec+DELAY;
    ls.leftPids.add(selfPid);
    scheduleDeath(tick,selfPid);
    transport.send({type:MSG.LEAVE,pid:selfPid,tick});
    return true;
   };

  function scheduleDeath(tick,pid){
    if(!ls.deaths.some(d=>d.tick===tick&&d.pid===pid))ls.deaths.push({tick,pid});
  }
  function applyRpcLocal(kind,tick,pid){
    const k2=kind+"@"+tick+"#"+pid;
    if(ls.rpcKeys.has(k2))return;
    ls.rpcKeys.add(k2);
    ls.rpcs.push({tick,kind,pid});
  }

  ls.handleMessage=(msg)=>{
    if(!msg||typeof msg!=="object")return;             // unknown/garbage: drop
    switch(msg.type){
      case MSG.INPUT: onInput(msg); break;
      case MSG.LEAVE: onLeave(msg); break;
      case MSG.WELCOME: {
        const v=validateWelcome(msg);
        if(v.ok)break;                                 // roster is frozen in v1
        ls.invalidDrops++; break;                      // fail-closed, silent
       }
      case MSG.ERROR: ls.errors.push(msg); break;
      default:
        if(RPC_KINDS.includes(msg.type)){ onRpc(msg); break; }
        ls.invalidDrops++;                             // unknown type: silent drop
    }
   };

  function onInput(m){
    if(ls.halted)return;
    if(ls.leftPids.has(m.pid)){ fail("unknown_pid",m.pid); return; }
    const last=ls.lastSeq.has(m.pid)?ls.lastSeq.get(m.pid):null;
    // forward-unbounded window: in-order catch-up backlogs must buffer, and a
    // receiver can never be past a tick whose input is still undelivered (it
    // stalls instead), so tick>=nextExec is the only time-rule we need here.
    const v=validateInput(m,last,ls.nextExec,Infinity);
    if(!v.ok){
      if(v.reason==="gap"){ fail("bad_seq",m.seq); }
      else { ls.invalidDrops++; }                      // dup/stale/malformed
      return;
     }
    ls.lastSeq.set(m.pid,m.seq);
    let b=ls.buffer.get(m.tick);
    if(!b){b=new Map();ls.buffer.set(m.tick,b);}
    b.set(m.pid,normIntent(m));
   }

  function onLeave(m){
    if(ls.halted)return;
    const p=m.pid;
    if(typeof p!=="number"||!Number.isInteger(p)||p<0||p>=MAX_PLAYERS
      ||p===selfPid){ ls.invalidDrops++; return; }
    if(typeof m.tick!=="number"||!Number.isInteger(m.tick)
      ||m.tick<ls.nextExec){ fail("bad_tick",m.tick); return; }
    if(ls.leftPids.has(p))return;
    ls.leftPids.add(p);
    scheduleDeath(m.tick,p);
   }

  function onRpc(m){
    if(ls.halted)return;
    if(m.pid!==HOST_PID){ fail("bad_host",m.pid); return; }
    if(typeof m.tick!=="number"||!Number.isInteger(m.tick)
      ||m.tick<ls.nextExec){ fail("bad_tick",m.tick); return; }
    applyRpcLocal(m.type,m.tick,m.pid);
   }

  function alivePids(){
    return roster.filter(p=>!ls.leftPids.has(p));
  }

  ls.tick=()=>{
    if(ls.halted)return{executed:false,stalled:false};
    const T=ls.nextExec;
    const live=alivePids();
    const b=ls.buffer.get(T);
    const ready=b&&live.every(p=>b.has(p));
    if(!ready){
      ls.stalled=true;
      if(++ls.stallCount===30)ls.stallEvents++;   // once per stall episode
      return{executed:false,stalled:true};        // no world/time advance
     }
    ls.stalled=false; ls.stallCount=0;
    // 1) leave deaths due this tick (pid-ascending, deterministic)
    const due=ls.deaths.filter(d=>d.tick===T).sort((x,y)=>x.pid-y.pid);
    ls.deaths=ls.deaths.filter(d=>d.tick!==T);
    for(const d of due){
      ls.world.events.push({t:"leave",pid:d.pid});
      hurtPlayer(ls.world,(e)=>ls.world.events.push(e));  // existing sim path
    }
    // 2) host RPCs due this tick (kind-ascending, deterministic)
    const rs=ls.rpcs.filter(r=>r.tick===T).sort((x,y)=>x.kind<y.kind?-1:1);
    ls.rpcs=ls.rpcs.filter(r=>r.tick!==T);
    for(const r of rs){
      if(r.kind===MSG.PAUSE)ls.world.state="PAUSE";
      else if(r.kind===MSG.RESUME)ls.world.state="PLAY";
      else if(r.kind===MSG.MENU)ls.world.state="MENU";
      else if(r.kind===MSG.RESTART){
        loadLevel(ls.world,1,false); ls.world.score=0; ls.world.state="PLAY";
      }
    }
    // 3) consume intents in ascending pid order, advance exactly one tick
    const inputs={};
    for(const p of live)inputs[p]=b.get(p);
    step(ls.world,dt,inputs);
    ls.nextExec=T+1;
    if(ls.buffer.size>64)
      for(const k of ls.buffer.keys()) if(k<ls.nextExec)ls.buffer.delete(k);
    return{executed:true,stalled:false};
   };

  return ls;
}
