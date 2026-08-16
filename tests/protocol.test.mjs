import {step, createWorld, loadLevel} from "../src/core/sim.js";
import {
  MSG, makeInput, makeSnapshot, applySnapshot, encode, decode
} from "../src/net/protocol.js";
import {LocalTransport} from "../src/net/transport.js";

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

// 3) server-authoritative snapshot + client reconciliation
//    server runs authoritative sim; client gets a snapshot and reconciles.
{
  const seed=99;
  const server=createWorld(seed,1); loadLevel(server,1,false); server.state="PLAY";
  // server simulates 100 ticks
  for(let i=0;i<100;i++) step(server, 1/60, {0:{move:{x:1,y:0},fire:true,firePrev:(i%3===0),shift:false,remote:false,kick:false}});
  const snap=makeSnapshot(server, seed, 1);

  const client=createWorld(seed,1); loadLevel(client,1,false); client.state="PLAY";
  applySnapshot(client, snap);
  check("snapshot reconciles player position",
    Math.round(client.players[0].x)===snap.players[0].x &&
    Math.round(client.players[0].y)===snap.players[0].y,
    "client x,y = "+client.players[0].x+","+client.players[0].y+" == "+snap.players[0].x+"," +snap.players[0].y);
  check("snapshot reconciles score/lives",
    client.score===snap.score && client.lives===snap.lives,
    "score "+client.score+"/"+snap.score+" lives "+client.lives+"/"+snap.lives);
}

// 4) determinism across an independent replay (the netcode linchpin)
{
  const seed=31337;
  const w1=createWorld(seed,1); loadLevel(w1,1,false); w1.state="PLAY";
  const w2=createWorld(seed,1); loadLevel(w2,1,false); w2.state="PLAY";
  const inputs=[];
  for(let i=0;i<120;i++){
    const it={move:{x:(i%5===0)?1:0,y:(i%7===0)?-1:0},fire:(i%10===0),firePrev:(i%10===1),
      shift:false,remote:false,kick:false};
    inputs.push(it); step(w1,1/60,{0:it});
   } for(let i=0;i<120;i++) step(w2,1/60,{0:inputs[i]});
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

console.log("\n  NET/PROTOCOL RESULT: "+pass+" PASS / "+fail+" FAIL");
process.exit(fail?1:0);
