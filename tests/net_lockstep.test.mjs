/* NET LOCKSTEP V1 — validation gates (§4) + THE two-world proof (§5).
   sameWorld is replicated (not imported) from determinism.test.mjs because
   that file is a script with top-level process.exit — importing it would
   abort this suite and double-run the determinism checks. */
import {
  MSG, MAX_PLAYERS, DELAY, makeInput, makeWelcome, makeRpc, makeError,
  validateInput, validateWelcome, isKnownType, encode, decode,
} from "../src/net/protocol.js";
import {LocalTransport} from "../src/net/transport.js";
import {HOST_PID} from "../src/net/lockstep.js";

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

console.log(fail? "NET_LOCKSTEP FAIL":"NET_LOCKSTEP OK");
process.exit(fail?1:0);
