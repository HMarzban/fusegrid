import {createGame} from "../src/main.js";
import {createRenderer} from "../src/render/renderer.js";
import {createWorld, loadLevel} from "../src/core/sim.js";

let pass=0, fail=0;
function check(name, cond, detail){ cond?pass++:fail++;
  console.log((cond?"  PASS ":"  FAIL ")+name+(detail!==undefined?" -> "+detail:"")); }

let ok=true;
try{ createGame(null,{}); }catch(e){ ok=false; console.log(e.message); }
check("createGame(null) imports+runs headless", ok);

ok=true;
try{
  const r=createRenderer(null,{hud:null,audio:null});
  const w=createWorld(7,1); loadLevel(w,1,false); w.state="MENU";
  r.render(w, 1/60);
}catch(e){ ok=false; console.log(e.message); }
check("null-canvas renderer render() does not throw", ok);

console.log(fail? "HEADLESS FAIL":"HEADLESS OK");
process.exit(fail?1:0);
