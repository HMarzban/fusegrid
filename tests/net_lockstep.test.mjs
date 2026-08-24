/* NET LOCKSTEP V1 — validation gates (§4) + THE two-world proof (§5).
   sameWorld is replicated (not imported) from determinism.test.mjs because
   that file is a script with top-level process.exit — importing it would
   abort this suite and double-run the determinism checks. */
import {step, createWorld, loadLevel, newIntent} from "../src/core/sim.js";
import {CFG} from "../src/core/config.js";
import {
  MSG, MAX_PLAYERS, DELAY, makeInput, makeWelcome, makeRpc, makeError,
  validateInput, validateWelcome, isKnownType, encode, decode,
} from "../src/net/protocol.js";
import {LocalTransport} from "../src/net/transport.js";
import {createLockstep, HOST_PID} from "../src/net/lockstep.js";

let pass=0, fail=0;
const check=(n,c,d)=>{c?pass++:fail++;
  console.log((c?"  PASS ":"  FAIL ")+n+(d!==undefined?" -> "+d:""));};

// ---- §4 constants + message shapes ----
check("MAX_PLAYERS=4, DELAY=2, HOST_PID=0",
  MAX_PLAYERS===4&&DELAY===2&&HOST_PID===0,
  MAX_PLAYERS+","+DELAY+","+HOST_PID);
check("new MSG kinds registered",
  MSG.WELCOME==="welcome"&&MSG.PAUSE==="pause"&&MSG.RESUME==="resume"&&
  MSG.RESTART==="restart"&&MSG.MENU==="menu"&&MSG.ERROR==="error");
check("INPUT carries seq+tick",
  (()=>{const m=makeInput(7,1,{move:{x:0,y:1},fire:true},123);
    return m.seq===7&&m.pid===1&&m.tick===123&&m.move.y===1&&m.fire===true;})());
check("welcome/rpc/error round-trip through encode/decode",
  (()=>{const w=decode(encode(makeWelcome(1,20260823,5))),
      r=decode(encode(makeRpc(MSG.PAUSE,0,42))),
      e=decode(encode(makeError("bad_seq","seq 9"))),
      m2=decode(encode(makeWelcome(0,7,1,[{pid:0},{pid:1}])));
    return w.type==="welcome"&&w.seed===20260823&&r.type==="pause"&&r.tick===42&&
      e.type==="error"&&e.reason==="bad_seq"&&m2.players.length===2;})());
check("isKnownType rejects unknown, accepts known",
  isKnownType({type:"input"})&&!isKnownType({type:"zap"})&&!isKnownType({}));

const VI=(over,last,now)=>validateInput(Object.assign(
  makeInput(last+1,1,{move:{x:1,y:0},fire:false},now+1),over),last,now);

// ---- §4 validateInput fail-closed gates ----
{
  const ok=VI({},3,100);
  check("valid input accepted (seq=last+1, tick in window)", ok.ok===true, JSON.stringify(ok));
  const bad=(n,over)=>check(n, VI(over,3,100).ok===false &&
    VI(over,3,100).reason==="invalid");
  bad("non-finite seq rejected", {seq:NaN});
  bad("non-finite tick rejected", {tick:Infinity});
  bad("non-finite move.x rejected", {move:{x:NaN,y:0}});
  bad("pid above range rejected", {pid:MAX_PLAYERS});
  bad("negative pid rejected", {pid:-1});
  bad("non-integer pid rejected", {pid:1.5});
  bad("dx=2 rejected", {move:{x:2,y:0}});
  bad("dy=-2 rejected", {move:{x:0,y:-2}});
  bad("non-strict fire rejected", {fire:1});
  bad("non-strict shift rejected", {shift:"yes"});
  bad("non-strict remote rejected", {remote:null});
  bad("non-strict kick rejected", {kick:{}});
  bad("tick below window rejected", {tick:99});
  bad("tick above now+DELAY rejected", {tick:103});
  check("first-ever seq must be 0", VI({seq:5},-1,0).ok===false);
  check("dup classified (silent-drop class)", VI({seq:3},3,100).ok===false&&
    VI({seq:3},3,100).reason==="dup");
  check("gap classified (bad_seq class)", VI({seq:9},3,100).ok===false&&
    VI({seq:9},3,100).reason==="gap");
}

// ---- §4 validateWelcome fail-closed gates ----
{
  check("valid welcome accepted",
    validateWelcome(makeWelcome(1,2147483647,0)).ok===true);
  check("seed u31 upper bound enforced",
    validateWelcome(makeWelcome(0,2147483648,0)).ok===false);
  check("negative seed rejected",
    validateWelcome(makeWelcome(0,-1,0)).ok===false);
  check("float seed rejected",
    validateWelcome(makeWelcome(0,1.5,0)).ok===false);
  check("bad pid rejected", validateWelcome(makeWelcome(9,7,0)).ok===false);
  check("non-finite tick rejected",
    validateWelcome({type:"welcome",pid:0,seed:7,tick:NaN}).ok===false);
  check("oversized players roster rejected",
    validateWelcome(makeWelcome(0,7,0,
      Array.from({length:MAX_PLAYERS+1},(_,i)=>({pid:i})))).ok===false);
  check("wrong type rejected", validateWelcome({type:"input"}).ok===false);
}

// ---- transport dropped-counter ----
{
  const t=new LocalTransport();
  t.send({type:"input"});                    // queued, not dropped
  t.close();
  t.send({type:"input"}); t.send({type:"input"});
  check("LocalTransport.dropped counts send-after-close",
    t.dropped===2, String(t.dropped));
}

// ---- §5 two-world proof harness ----
function sameWorld(x,y){                    // replica of determinism comparator
  if(x.grid.length!==y.grid.length)return false;
  for(let i=0;i<x.grid.length;i++) if(x.grid[i]!==y.grid[i])return false;
  if(x.rng.state!==y.rng.state)return false;
  if(x.state!==y.state)return false;
  const p0=x.players[0], p1=y.players[0];
  if(p0.x!==p1.x||p0.y!==p1.y)return false;
  if(p0.tx!==p1.tx||p0.ty!==p1.ty||p0.bombs!==p1.bombs||p0.range!==p1.range
    ||p0.iFrames!==p1.iFrames||p0.shield!==p1.shield||p0.bombKind!==p1.bombKind
    ||p0.passing!==p1.passing||p0.kick!==p1.kick||p0.throw!==p1.throw
    ||p0.remote!==p1.remote)return false;
  if(x.enemies.length!==y.enemies.length)return false;
  for(let i=0;i<x.enemies.length;i++){
    const a=x.enemies[i], b=y.enemies[i];
    if(a.x!==b.x||a.y!==b.y||a.tx!==b.tx||a.ty!==b.ty)return false;
    if(a.dir.x!==b.dir.x||a.dir.y!==b.dir.y)return false;
    if(a.type!==b.type||a.dead!==b.dead)return false;
    if(a.home.x!==b.home.x||a.home.y!==b.home.y)return false;
    if(a.cd!==b.cd||a.invulnT!==b.invulnT||a.speed!==b.speed||a.pass!==b.pass)return false;
  }
  if(x.bombs.length!==y.bombs.length)return false;
  for(let i=0;i<x.bombs.length;i++){
    const a=x.bombs[i], b=y.bombs[i];
    if(a.x!==b.x||a.y!==b.y||a.timer!==b.timer||a.tx!==b.tx||a.ty!==b.ty
      ||a.radius!==b.radius||a.variant!==b.variant||a.dead!==b.dead)return false;
  }
  if(x.items.length!==y.items.length)return false;
  for(let i=0;i<x.items.length;i++){
    const a=x.items[i], b=y.items[i];
    if(a.x!==b.x||a.y!==b.y||a.taken!==b.taken)return false;
  }
  return x.score===y.score && x.lives===y.lives && x.tick===y.tick
    && x.winTimer===y.winTimer
    && x.blades.length===y.blades.length
    && x.blades.every((bl,i)=>bl.t===y.blades[i].t&&bl.ttl===y.blades[i].ttl
      &&bl.variant===y.blades[i].variant);
}
function script(i){
  const m=[{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}][i%4];
  return {move:m, fire:(i%23===0), shift:(i%31===0),
    remote:false, kick:(i%17===0)};
}
function script2(i){
  const m=[{x:0,y:-1},{x:-1,y:0},{x:0,y:1},{x:1,y:0}][i%4];
  return {move:m, fire:(i%19===0), shift:(i%41===0),
    remote:(i%97===0), kick:false};
}
function makeHarness(seed){
  const mk=()=>{const w=createWorld(seed,1); loadLevel(w,1,false);
    w.state="PLAY"; return w;};
  const h={seed, wA:mk(), wB:mk(), q:[], f:0, delays:{AB:0,BA:0}, hold:null};
  h.tA={send(m){h.q.push({to:"B",due:h.hold!=null?Infinity:h.f+h.delays.AB,m});}};
  h.tB={send(m){h.q.push({to:"A",due:h.hold!=null?Infinity:h.f+h.delays.BA,m});}};
  h.lsA=createLockstep({selfPid:0,world:h.wA,transport:h.tA,dt:CFG.STEP,
    players:[0,1]});
  h.lsB=createLockstep({selfPid:1,world:h.wB,transport:h.tB,dt:CFG.STEP,
    players:[0,1]});
  h.releaseHold=()=>{ if(h.hold==null)return;
    for(const e of h.q) if(e.due===Infinity) e.due=h.f+h.hold;
    h.hold=null; };
  h.pump=()=>{
    for(;;){
      let bi=-1,bd=Infinity;
      for(let i=0;i<h.q.length;i++)
        if(h.q[i].due<h.f+1e-9&&h.q[i].due<bd){bd=h.q[i].due;bi=i;}
      if(bi<0)break;
      const [e]=h.q.splice(bi,1);
      (e.to==="A"?h.lsA:h.lsB).handleMessage(e.m);
    }
  };
  const intentFor=(ls)=>ls===h.lsA?script(h.f):script2(h.f);
  // meta-pacer: advance whichever world trails so cursors stay within one
  // tick despite asymmetric transport delay; stalls absorb the difference
  // instead of skewing the measured endpoint.
  h.frame=()=>{
    h.f++;
    const first=h.wA.tick<=h.wB.tick?h.lsA:h.lsB;
    const second=first===h.lsA?h.lsB:h.lsA;
    first.pushIntent(intentFor(first));
    h.pump();
    first.tick();
    second.pushIntent(intentFor(second));
    h.pump();
    return second.tick();
   };
  h.drain=(target)=>{
    for(let g=0;g<target*4&&(h.wA.tick<target||h.wB.tick<target);g++)
      h.frame();
   };
  // measurement barrier: deliver everything in flight, then quiet-drain
  // (no new intents) until neither world can advance. Both peers then sit
  // on the same max fully-buffered tick — a sound comparison point.
  h.flushPipe=()=>{ for(const e of h.q)e.due=h.f; };
  h.settle=()=>{
    h.flushPipe();
    for(let idle=0;idle<=DELAY+8;){
      const a=h.wA.tick,b=h.wB.tick;
      h.pump(); h.lsA.tick(); h.lsB.tick();
      if(h.wA.tick===a&&h.wB.tick===b)idle++; else idle=0;
    }
   };
  return h;
}
const N=650;

// ---- baseline: N>=600 ticks, full-field equality ----
{
  const h=makeHarness(20260823);
  let stalls=0;
  for(let i=0;i<N;i++){ const r=h.frame(); if(r.stalled)stalls++; }
  check("baseline "+N+"-tick run: zero stalls, both advance",
    stalls===0&&h.wA.tick===N&&h.wB.tick===N, h.wA.tick+"/"+h.wB.tick+"/"+stalls);
  check("baseline: sameWorld full-field equality", sameWorld(h.wA,h.wB));
  check("lockstep stepped real sim time on both worlds",
    Math.abs(h.wA.time-N*CFG.STEP)<1e-9&&Math.abs(h.wB.time-N*CFG.STEP)<1e-9,
    h.wA.time+","+h.wB.time);
}

// ---- (a) 3-tick artificial lag one direction -> stall then convergence ----
{
  const h=makeHarness(777);
  h.delays.AB=3;                             // A->B always 3 frames late
  let earlyStalls=0;
  for(let i=0;i<8;i++){ const r=h.frame(); if(r.stalled)earlyStalls++; }
  check("(a) lag starves B past the DELAY lookahead (observed stalls)",
    earlyStalls>0, String(earlyStalls));
  h.drain(N); h.settle();
  check("(a) convergence resumes: equal ticks + full equality",
    !h.lsA.halted&&!h.lsB.halted&&h.wA.tick===h.wB.tick&&sameWorld(h.wA,h.wB),
    h.wA.tick+"/"+h.wB.tick);
}

// ---- (a2) 40-frame blackout -> stallEvent after 30 consecutive ----
{
  const h=makeHarness(424242);
  for(let i=0;i<50;i++)h.frame();
  h.hold=0;                                  // blackhole EVERYTHING until release
  let saw30=false;
  for(let i=0;i<45;i++){ h.frame(); if(h.lsB.stallEvents>0)saw30=true; }
  check("(a2) stallEvent fires after 30 consecutive stalled frames", saw30,
    "events="+h.lsB.stallEvents+" count="+h.lsB.stallCount);
  h.releaseHold();
  let post=0;
  for(let i=0;i<N;i++){ const r=h.frame(); if(!r.stalled)post++; }
  h.settle();
  check("(a2) recovery after blackout: equality restored",
    h.wA.tick===h.wB.tick&&h.wA.tick>N*0.9&&sameWorld(h.wA,h.wB),
    h.wA.tick+"/"+h.wB.tick);
}

// ---- (b) duplicate seq dropped silently, equality holds ----
{
  const h=makeHarness(31337);
  for(let i=0;i<60;i++)h.frame();
  const last=h.lsB.lastSeq.get(0);
  const dupMsg={type:"input",seq:last,pid:0,tick:h.lsB.nextExec+1,
    move:{x:1,y:0},fire:false,shift:false,remote:false,kick:false};
  const before=h.lsB.errors?h.lsB.errors.length:0;
  h.lsB.handleMessage(dupMsg); h.lsB.handleMessage(dupMsg);
  for(let i=0;i<N;i++)h.frame(); h.settle();
  const errs=h.lsB.errors||[];
  check("(b) duplicate seq silently dropped (no error/halt)",
    errs.length===before&&!h.lsB.halted, JSON.stringify(errs));
  check("(b) equality holds after duplicates", sameWorld(h.wA,h.wB));
}

// ---- (c) seq gap -> bad_seq error + deterministic halt ----
{
  const h=makeHarness(9);
  for(let i=0;i<60;i++)h.frame();
  const gap={type:"input",seq:200,pid:0,tick:h.lsB.nextExec+1,
    move:{x:1,y:0},fire:false,shift:false,remote:false,kick:false};
  h.lsB.handleMessage(gap);
  check("(c) gap produces bad_seq error + halt",
    h.lsB.halted===true&&h.lsB.error&&h.lsB.error.reason==="bad_seq",
    JSON.stringify(h.lsB.error));
  const tk=h.wB.tick, tm=h.wB.time;
  for(let i=0;i<30;i++)h.frame();
  check("(c) halt is deterministic: world frozen",
    h.wB.tick===tk&&h.wB.time===tm, h.wB.tick+"/"+h.wA.tick);
}

// ---- (d) LEAVE mid-run -> agreement post-leave + unknown_pid guard ----
{
  const h=makeHarness(555);
  for(let i=0;i<80;i++)h.frame();
  const leaveTick=h.lsB.nextExec+DELAY;
  h.lsB.leave();
  for(let i=0;i<N;i++)h.frame(); h.settle();
  const evA=h.wA.events.filter(e=>e.t==="leave"),
        evB=h.wB.events.filter(e=>e.t==="leave");
  check("(d) leave events recorded on both worlds at same tick",
    evA.length===1&&evB.length===1&&evA[0].pid===1&&evB[0].pid===1,
    JSON.stringify(evA)+"|"+JSON.stringify(evB));
  check("(d) both worlds agree post-leave (full equality)",
    h.wA.tick===h.wB.tick&&sameWorld(h.wA,h.wB), h.wA.tick+"/"+h.wB.tick);
  check("(d) death path applied (lives decremented identically)",
    h.wA.lives===h.wB.lives&&h.wA.lives===2, h.wA.lives+"/"+h.wB.lives);
  const ghost={type:"input",seq:9999,pid:1,tick:h.lsA.nextExec+1,
    move:{x:0,y:0},fire:false,shift:false,remote:false,kick:false};
  h.lsA.handleMessage(ghost);
  check("(d) input from departed pid -> unknown_pid error + halt",
    h.lsA.halted===true&&h.lsA.error&&h.lsA.error.reason==="unknown_pid",
    JSON.stringify(h.lsA.error));
}

// ---- (e) PAUSE/RESUME host RPC round-trip at aligned ticks ----
{
  const h=makeHarness(888);
  for(let i=0;i<40;i++)h.frame();
  const flips=[];
  const watch=(w,tag)=>{
    let prev=w.state;
    return ()=>{ if(w.state!==prev){flips.push({tag,state:w.state,tick:w.tick});prev=w.state;} };
   };
  const wa=watch(h.wA,"A"), wb=watch(h.wB,"B");
  h.lsA.rpc(MSG.PAUSE);
  for(let i=0;i<10;i++){h.frame();wa();wb();}
  check("(e) both worlds paused", h.wA.state==="PAUSE"&&h.wB.state==="PAUSE",
    h.wA.state+"/"+h.wB.state);
  h.lsA.rpc(MSG.RESUME);
  for(let i=0;i<10;i++){h.frame();wa();wb();}
  check("(e) both worlds resumed", h.wA.state==="PLAY"&&h.wB.state==="PLAY");
  const pa=flips.find(f=>f.tag==="A"&&f.state==="PAUSE"),
        pb=flips.find(f=>f.tag==="B"&&f.state==="PAUSE"),
        ra=flips.find(f=>f.tag==="A"&&f.state==="PLAY"),
        rb=flips.find(f=>f.tag==="B"&&f.state==="PLAY");
  check("(e) RPCs applied at identical buffer ticks",
    pa&&pb&&pa.tick===pb.tick&&ra&&rb&&ra.tick===rb.tick,
    JSON.stringify(flips));
  for(let i=0;i<50;i++)h.frame(); h.settle();
  check("(e) equality after pause/resume round-trip",
    sameWorld(h.wA,h.wB)&&h.wA.tick===h.wB.tick);
  const rogue=h.lsB.rpc(MSG.PAUSE);
  check("(e) non-host rpc() refused", rogue===false&&!h.lsB.halted);
}

console.log(fail? "NET_LOCKSTEP FAIL":"NET_LOCKSTEP OK");
process.exit(fail?1:0);
