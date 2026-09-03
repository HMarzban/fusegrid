import { clampPace, paceMul, paceToken, PACE_MUL } from "../src/core/pace.js";
import { loadPace, savePace, PACE_KEY } from "../src/app/pacestore.js";
import { createWorld, loadLevel, step } from "../src/core/sim.js";
import { CFG, T, key } from "../src/core/config.js";

let pass=0,fail=0;
function check(n,c,d){c?pass++:fail++;console.log((c?"  PASS ":"  FAIL ")+n+(d!==undefined?" -> "+d:""));}

check("clampPace clamps -2..2 to -1..1", clampPace(-2)===-1&&clampPace(2)===1&&clampPace(0)===0);
check("paceMul NORM is 1", paceMul(0)===1);
check("PACE_MUL length 3", PACE_MUL.length===3);
check("paceToken EASY", paceToken(-1)==="EASY");

{
  const st={m:new Map(),getItem(k){return this.m.get(k)||null},setItem(k,v){this.m.set(k,String(v));}};
  savePace(1,st);
  check("save/load pace", loadPace(st)===1&&st.getItem(PACE_KEY)==="1");
}

{
  const mk=()=>{
    const w=createWorld(1,1); loadLevel(w,1,false); w.state="PLAY";
    const p=w.players[0];
    Object.assign(p,{tx:1,ty:1,x:1.5*CFG.TILE,y:1.5*CFG.TILE});
    w.grid[key(2,1)]=T.EMPTY; w.grid[key(3,1)]=T.EMPTY;
    return w;
  };
  const wH=mk(); wH.pace=1;
  step(wH,CFG.STEP,{0:{move:{x:1,y:0},fire:false,firePrev:false,shift:false,remote:false,kick:false}});
  const wN=mk(); wN.pace=0;
  step(wN,CFG.STEP,{0:{move:{x:1,y:0},fire:false,firePrev:false,shift:false,remote:false,kick:false}});
  check("HARD pace moves farther than NORM", wH.players[0].x>wN.players[0].x,
    wH.players[0].x+"/"+wN.players[0].x);
}

console.log("\n  PACE RESULT: "+pass+" PASS / "+fail+" FAIL");
process.exit(fail?1:0);
