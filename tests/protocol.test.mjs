import {step, createWorld, loadLevel} from "../src/core/sim.js";
import {
  MSG, makeInput, makeSnapshot, encode, decode,
  makeError, ERROR_CODES, capsOk, isKnownType
} from "../src/net/protocol.js";
import * as proto from "../src/net/protocol.js";
import {LocalTransport, WebSocketTransport} from "../src/net/transport.js";

let pass=0, fail=0;
function check(name, cond, detail){ cond?pass++:fail++;
  console.log((cond?"  PASS ":"  FAIL ")+name+(detail!==undefined?" -> "+detail:""));
}

// 1) protocol encode/decode round-trip
{
  const snap={type:MSG.SNAPSHOT,tick:1,seed:7,level:1,state:"PLAY",
    players:[],bombs:[],enemies:[],score:0,lives:3};
  const rt=decode(encode(snap));
  check("encode/decode round-trip (snapshot)", rt.type===MSG.SNAPSHOT && rt.tick===1 && rt.seed===7);
}

// 2) makeInput carries intent only (no server-authoritative coords)
{
  const msg=makeInput(42,0,{move:{x:1,y:-1},fire:true,shift:false,remote:false,kick:false});
  check("makeInput carries intent", msg.type===MSG.INPUT && msg.seq===42 &&
    msg.move.x===1 && msg.move.y===-1 && msg.fire===true && msg.remote===false);
}

// 3) makeSnapshot stays compact; applySnapshot is gone (lockstep-only net)
{
  const seed=99;
  const server=createWorld(seed,1); loadLevel(server,1,false); server.state="PLAY";
  for(let i=0;i<100;i++) step(server, 1/60, {0:{move:{x:1,y:0},fire:true,firePrev:(i%3===0),shift:false,remote:false,kick:false}});
  const snap=makeSnapshot(server, seed, 1);
  check("makeSnapshot carries tick/score/lives/players",
    snap.type===MSG.SNAPSHOT&&snap.tick===server.tick
    &&snap.score===server.score&&snap.lives===server.lives
    &&snap.players.length===server.players.length);
  check("applySnapshot is not on the protocol surface",
    proto.applySnapshot===undefined, typeof proto.applySnapshot);
}

// 4) determinism across an independent replay (the netcode linchpin)
{
  const seed=31337;
  const w1=createWorld(seed,1); loadLevel(w1,1,false); w1.state="PLAY";
  const w2=createWorld(seed,1); loadLevel(w2,1,false); w2.state="PLAY";
  // fresh intent objects per step: step() writes back firePrev, so sharing
  // one array across worlds would feed w2 mutated edges (latent harness bug)
  const gen=i=>({move:{x:(i%5===0)?1:0,y:(i%7===0)?-1:0},fire:(i%10===0),
    firePrev:(i%10===1),shift:false,remote:false,kick:false});
  for(let i=0;i<120;i++) step(w1,1/60,{0:gen(i)});
  for(let i=0;i<120;i++) step(w2,1/60,{0:gen(i)});
  check("deterministic replay matches after 120 divergent-input ticks",
    w1.score===w2.score && Math.round(w1.players[0].x)===Math.round(w2.players[0].x),
    "score "+w1.score+"/"+w2.score+"/ x "+w1.players[0].x+"/"+w2.players[0].x);
}

// 5) LocalTransport routes messages through the interface
{
  const got=[];
  const t=new LocalTransport(null);
  const off=t.on(MSG.INPUT, m=>got.push(m));
  t.send(makeInput(1,0,{move:{x:1,y:0},fire:false,shift:false,remote:false,kick:false}));
  off();
  // LocalTransport with no server queues; with a server fires synchronously.
  const t2=new LocalTransport((msg,transport)=>transport._emit(MSG.INPUT, msg));
  const got2=[];
  const off2=t2.on(MSG.INPUT, m=>got2.push(m));
  t2.send(makeInput(2,0,{move:{x:0,y:1},fire:true,shift:false,remote:false,kick:false}));
  off2();
  check("LocalTransport queues without server", t._queue.length===1, "queue len "+t._queue.length);
  check("LocalTransport routes with server", got2.length===1 && got2[0].seq===2, "routed "+got2.length);
}

// 6) F4: fail-closed decode boundary (never throws)
{
  check("decode never throws on garbage input",
    decode("{not json")==null && decode("")==null && decode(undefined)==null);
}

// 7) F3: pinned ERROR codes
{
  check("ERROR_CODES pinned to exactly four codes", ERROR_CODES.size===4 &&
    ["bad_seq","bad_seed","bad_shape","unknown_pid"].every(c=>ERROR_CODES.has(c)));
  check("makeError coerces unpinned reasons to bad_shape",
    makeError("bad_host",1).reason==="bad_shape"&&
    makeError("bad_tick").reason==="bad_shape"&&
    makeError("bad_seq","x").reason==="bad_seq"&&
    makeError("unknown_pid",3).reason==="unknown_pid");
}

// 8) F4: §4.3 array-cap <=64
{
  check("capsOk enforces §4.3 array-cap 64",
    capsOk({a:new Array(64).fill(0)})===true&&
    capsOk({a:new Array(65).fill(0)})===false&&
    capsOk({a:[{b:new Array(65)}]})===false&&
    capsOk({x:1,y:"s"})===true);
}

// 9) F4: WebSocketTransport receive boundary (v2 seam, guarded)
{
  const t=new WebSocketTransport("ws://localhost/test");
  const got=[];
  t.on(MSG.INPUT, m=>got.push(m));
  t._onmessage({data:"{oops"});
  t._onmessage({data:null});
  t._onmessage({data:encode({type:"zap"})});
  check("ws boundary: undecodable/unknown frames dropped+counted, no throw",
    t.dropped===3&&got.length===0, String(t.dropped));
  t._onmessage({data:encode(makeInput(1,0,
    {move:{x:1,y:0},fire:true,shift:false,remote:false,kick:false},9))});
  check("ws boundary: valid frame routed to subscribers",
    got.length===1&&got[0].seq===1&&got[0].tick===9);
  t._onmessage({data:encode({type:"snapshot",players:Array.from({length:65})})});
  check("ws boundary: >64-element array rejected per §4.3",
    t.dropped===4&&got.length===1);
  t._validate=()=>false;
  t._onmessage({data:encode(makeInput(2,0,
    {move:{x:0,y:1},fire:false,shift:false,remote:false,kick:false},10))});
  check("ws boundary: validation hook can reject pre-delivery (v2)",
    t.dropped===5&&got.length===1);
}

console.log("\n  NET/PROTOCOL RESULT: "+pass+" PASS / "+fail+" FAIL");
process.exit(fail?1:0);
