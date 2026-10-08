import {readFileSync} from "node:fs";
import {Input} from "../src/input.js";
import {hasTouch, PadMapper, mountTouch} from "../src/touch.js";
import {stampBombIcon} from "../src/render/sprites.js";

let pass=0, fail=0;
function check(name, cond, detail){ cond?pass++:fail++;
  console.log((cond?"  PASS ":"  FAIL ")+name+(detail!==undefined?" -> "+detail:"")); }

// 128px square pad at screen origin-ish; helper rects mirror getBoundingClientRect
const R={left:100,top:100,width:128,height:128};
const RB={left:400,top:100,width:72,height:72,kind:"bomb"};

// ---- §1 detection truth table ----
check("hasTouch(undefined) false", hasTouch(undefined)===false);
check("hasTouch({}) false (desktop)", hasTouch({})===false);
check("hasTouch({ontouchstart:null}) true", hasTouch({ontouchstart:null})===true);

// ---- §2/§6 zone math: edge/corner/dead-center ----
{
  const inp=new Input(null);
  const m=new PadMapper(inp);
  m.down(1,164,104,R);                       // top edge center
  check("zone top edge -> up held",
    inp.input.up===true&&inp.input.down===false&&inp.input.left===false&&inp.input.right===false);
  m.up(1);
  m.down(2,224,164,R);                       // right edge center
  check("zone right edge -> right held",
    inp.input.right===true&&inp.input.left===false&&inp.input.up===false);
  m.up(2);
  m.down(3,102,164,R);                       // left edge center
  check("zone left edge -> left held", inp.input.left===true&&inp.input.right===false);
  m.up(3);
  m.down(4,164,224,R);                       // bottom edge center
  check("zone bottom edge -> down held", inp.input.down===true&&inp.input.up===false);
  m.up(4);
  m.down(5,196,110,R);                       // NE corner -> resolves to nearest axis
  check("corner resolves to one axis (cross quadrants)",
    (inp.input.up===true&&inp.input.right===false)||(inp.input.right===true&&inp.input.up===false));
  m.up(5);
  m.down(6,164,164,R);                       // exact dead center
  check("dead center -> no axis",
    !inp.input.up&&!inp.input.down&&!inp.input.left&&!inp.input.right);
  m.up(6);
  m.down(7,170,166,R);                       // inside 20% center dead zone
  check("inner ring inside dead zone -> no axis",
    !inp.input.up&&!inp.input.down&&!inp.input.left&&!inp.input.right);
  m.up(7);
}

// ---- §6 slide WITHOUT lift re-zones ----
{
  const inp=new Input(null); const m=new PadMapper(inp);
  m.down(3,164,220,R);                       // bottom
  check("slide start: down held", inp.input.down===true);
  m.move(3,106,164,R);                       // slide to left edge, same pid
  check("slide up->left flips axes without lift",
    inp.input.left===true&&inp.input.down===false);
  m.move(3,222,160,R);                       // slide across to right
  check("slide continues re-zoning", inp.input.right===true&&inp.input.left===false);
  m.up(3);
  check("release clears axes",
    !inp.input.right&&!inp.input.left&&!inp.input.up&&!inp.input.down);
}

// ---- §4 multitouch: dpad hold WHILE bomb taps ----
{
  const inp=new Input(null); const m=new PadMapper(inp);
  m.down(7,220,164,R);                       // dpad pid=7 holds RIGHT
  check("dpad holds right", inp.input.right===true);
  m.down(9,436,136,RB);                      // bomb pid=9 presses
  check("simultaneous: right held AND fire true",
    inp.input.right===true&&inp._intent.fire===true);
  m.up(9);                                   // bomb release
  check("bomb release: fire false, right STILL held",
    inp._intent.fire===false&&inp.input.right===true);
  m.up(7);
  check("dpad release clears axes",
    !inp.input.right&&inp._intent.fire===false);
}

// ---- §4 second finger on SAME control ignored ----
{
  const inp=new Input(null); const m=new PadMapper(inp);
  m.down(1,220,164,R);                       // pid1 claims dpad (right)
  const ok=m.down(2,106,164,R);              // pid2 rejected
  check("second dpad finger rejected", ok===false);
  check("claim kept: right unchanged", inp.input.right===true&&inp.input.left===false);
  m.up(2);                                   // stale pid no-op
  check("stale dpad up no-op", inp.input.right===true);
  m.up(1);
  check("owner release clears", !inp.input.right);
  m.down(11,436,136,RB);
  check("second bomb finger rejected", m.down(12,430,140,RB)===false);
  check("bomb claim kept (fire still true)", inp._intent.fire===true);
  m.up(12);
  check("stale bomb up no-op (fire stays)", inp._intent.fire===true);
  m.up(11);
  check("bomb owner release clears fire", inp._intent.fire===false);
}

// ---- §6 stale release + bomb ignores move ----
{
  const inp=new Input(null); const m=new PadMapper(inp);
  m.down(7,220,164,R); m.down(9,436,136,RB);
  check("wrong-pid up is no-op", m.up(999)===false);
  check("state survives wrong-pid up",
    inp.input.right===true&&inp._intent.fire===true);
  m.move(9,420,120,RB);                      // bomb ignores moves (binary)
  check("bomb move ignored (no axis change)",
    inp.input.right===true&&!inp.input.left&&!inp.input.up);
  m.clear();
  check("clear zeroes fire", inp._intent.fire===false);
  check("clear zeroes all axes",
    !inp.input.right&&!inp.input.left&&!inp.input.up&&!inp.input.down);
  check("post-clear ups are stale no-ops",
    m.up(7)===false&&m.up(9)===false);
}

// ---- §3 padFire routes through the tested fire-latch path ----
{
  const k=new Input(null); k._onKey({code:"Space",preventDefault(){}});
  const p=new Input(null); p.padFire(true);
  check("padFire(true) latches fire like keyboard Space",
    p._intent.fire===k._intent.fire&&p._intent.fire===true);
  k._onKeyUp({code:"Space"}); p.padFire(false);  check("padFire(false) clears fire like keyup",
    p._intent.fire===k._intent.fire&&p._intent.fire===false);
  const q=new Input(null);
  q._onFireDown({}); const a=q._intent.fire;
  q._onFireUp({});   const b=q._intent.fire;
  q.padFire(true);   const c=q._intent.fire;
  q.padFire(false);  const d=q._intent.fire;
  check("padFire ≡ _onFireDown/_onFireUp",
    a===c&&b===d&&a===true&&b===false);
}

// ---- §3 routing purity: input mutated ONLY via setIntent/padFire ----
{
  const inp=new Input(null);
  let si=0, pf=0;
  const si0=inp.setIntent.bind(inp), pf0=inp.padFire.bind(inp);
  inp.setIntent=(o)=>{ si++; return si0(o); };
  inp.padFire=(dn)=>{ pf++; return pf0(dn); };
  const m=new PadMapper(inp);
  m.down(1,220,164,R); m.move(1,106,164,R);
  m.down(2,436,136,RB); m.up(1); m.up(2);
  check("pad mutates input only via setIntent/padFire",
    si===3&&pf===2, "setIntent="+si+" padFire="+pf);
}

// ---- §5 headless stub: Node-safe, no-op surface ----
{
  const inp=new Input(null);
  const t=mountTouch(inp,null);
  check("mountTouch headless stub shape",
    typeof t.update==="function"&&typeof t.unmount==="function");
  let threw=false;
  try{ t.update(true); t.update(false); t.unmount(); }catch(e){ threw=true; }
  check("stub update/unmount are silent no-ops", threw===false);
  check("stub never touches input", !inp._intent.fire&&
    !inp.input.up&&!inp.input.down&&!inp.input.left&&!inp.input.right);
}

{
  const html=readFileSync(new URL("../index.html", import.meta.url),"utf8");
  check("#tbomb hosts a bomb canvas",
    /id="tbomb"[^>]*>[\s\S]*id="tbomb-icon"/.test(html));
  const fills=[];
  const c={
    fillStyle:"", strokeStyle:"", lineWidth:1, lineJoin:"", lineCap:"",
    save(){}, restore(){}, beginPath(){}, closePath(){}, fill(){ fills.push(c.fillStyle); },
    stroke(){}, moveTo(){}, lineTo(){}, quadraticCurveTo(){}, arc(){},
  };
  stampBombIcon(c);
  check("stampBombIcon uses HUD BOMB color",
    fills.indexOf("#ff5d73")>=0, fills.join(","));
}

// ---- §PAUSE pill: the touch-only pause affordance, inside #touchpad ----
{
  const html=readFileSync(new URL("../index.html", import.meta.url),"utf8");
  check("#touchpad hosts a #tpause pill with a button role",
    /id="tpause"[\s\S]{0,80}?aria-label="Pause"/.test(html)
    &&/id="tpause"[\s\S]{0,80}?role="button"/.test(html),
    (html.match(/<div id="tpause"[^>]*>/)||[])[0]);
  check("#tpause is a 44px round pill drawn from bars, never a canvas",
    /#tpause\{[^}]*width:44px[^}]*height:44px/.test(html)
    &&/border-radius:50%/.test((html.match(/#tpause\{[^}]*\}/)||[""])[0])
    &&/#tpause::before/.test(html)&&/#tpause::after/.test(html),
    (html.match(/#tpause\{[^}]*\}/)||[])[0]);
  {
    const rule=(html.match(/#tpause\{[^}]*\}/)||[""])[0];
    const gap=+((rule.match(/bottom:calc\(100% \+ (\d+)px\)/)||[])[1]);
    const main=readFileSync(new URL("../src/main.js", import.meta.url),"utf8");
    const spare=+((main.match(/innerHeight - (\d+)/)||[])[1]);
    check("#tpause sits above the stage, never over the right-aligned HUD"
      +" score, and fit() leaves it room on screen",
      !/[{;\s]top:/.test(rule)&&gap>=0&&spare/2>=44+gap,
      rule+" spare="+spare);
  }
  {
    const leak=["tpad","tbomb","tpause"].filter((id)=>{
      const rule=(html.match(new RegExp("#"+id+"\\{[^}]*\\}"))||[""])[0];
      return /display:(?!none)/.test(rule)
        &&!new RegExp("#"+id+"\\[hidden\\]\\{display:none\\}").test(html); });
    check("a touch control with an author display rule still hides on"
      +" [hidden] (the UA rule loses to #id{display:flex})",
      leak.length===0,leak.join()||"none");
  }
  check("the toolbar and the keyboard legend are gone from index.html",
    !/id="controls"/.test(html)&&!/class="hint"/.test(html)
    &&!/btnPause|btnSound|btnRestart|btnMenu/.test(html),
    (html.match(/id="controls"[^>]*/)||["clean"])[0]);
}
{
  const inp=new Input(null);
  const t=mountTouch(inp,null);
  let threw=false;
  try{ t.update(true,true); t.update(true,false); t.update(false,false); }
  catch(e){ threw=true; }
  check("headless stub takes the two-arg update silently",threw===false);
}
{
  const els=new Map();
  const mk=(id)=>{ const e={id,hidden:false,style:{},children:[],
    setAttribute(){}, appendChild(c){ e.children.push(c); },
    querySelector(sel){ return sel[0]==="#"?(els.get(sel.slice(1))||null):null; },
    addEventListener(){}, removeEventListener(){},
    getBoundingClientRect(){ return {left:0,top:0,width:44,height:44}; },
    getContext(){ return null; }};
    els.set(id,e); return e; };
  const box=mk("touchpad"), pad=mk("tpad"), bomb=mk("tbomb"),
    pill=mk("tpause"), stage=mk("stage");
  box.children.push(pad,bomb,pill);
  const noop=()=>{};
  globalThis.window={ontouchstart:null,addEventListener:noop,removeEventListener:noop};
  globalThis.document={addEventListener:noop,removeEventListener:noop,
    getElementById:(id)=>els.get(id)||null,
    createElement:(tag)=>mk("_"+tag)};
  try{
    const inp=new Input(null);
    const t=mountTouch(inp,stage);
    check("mount normalises to hidden-box / visible-children",
      box.hidden===true&&pad.hidden===false&&bomb.hidden===false
      &&pill.hidden===false,
      [box.hidden,pad.hidden,bomb.hidden,pill.hidden].join());
    t.update(false,false);
    check("outside GAME the whole pad box hides",box.hidden===true);
    t.update(true,true);
    check("GAME + PLAY shows box, pad, bomb and pill",
      box.hidden===false&&pad.hidden===false&&bomb.hidden===false
      &&pill.hidden===false,
      [box.hidden,pad.hidden,bomb.hidden,pill.hidden].join());
    inp.setIntent({move:{x:1,y:0}}); inp.padFire(true);
    t.update(true,false);
    check("GAME + PAUSE hides the 128px pad and the 72px bomb, keeps the pill"
      +" (they sit in the same corners as the pause rows)",
      box.hidden===false&&pad.hidden===true&&bomb.hidden===true
      &&pill.hidden===false,
      [box.hidden,pad.hidden,bomb.hidden,pill.hidden].join());
    check("hiding the pad clears every held intent",
      !inp.input.up&&!inp.input.down&&!inp.input.left&&!inp.input.right
      &&!inp._intent.fire);
    t.update(true,true);
    check("resuming brings the pad and bomb back",
      pad.hidden===false&&bomb.hidden===false);
   }finally{ delete globalThis.window; delete globalThis.document; }
}

// ---- D5: a short landscape stage is too narrow for pad+bomb ----
{
  const html=readFileSync(new URL("../index.html", import.meta.url),"utf8");
  const main=readFileSync(new URL("../src/main.js", import.meta.url),"utf8");
  const num=(re,s)=>+((s.match(re)||[])[1]);
  const spareW=num(/innerWidth - (\d+)/,main), spareH=num(/innerHeight - (\d+)/,main);
  const base=(id)=>(html.match(new RegExp("#"+id+"\\{[^}]*\\}"))||[""])[0];
  const padW=num(/width:(\d+)px/,base("tpad")), padL=num(/left:calc\((\d+)px/,base("tpad"));
  const bombW=num(/width:(\d+)px/,base("tbomb")), bombR=num(/right:calc\((\d+)px/,base("tbomb"));
  const mq=html.match(/@media \(max-height:(\d+)px\) and \(min-aspect-ratio:(\d+)\/(\d+)\)\{([^@]*?\})\s*\}/)||[];
  const inner=mq[4]||"";
  const padG=num(/#tpad\{[^}]*right:calc\(100% \+ (\d+)px\)/,inner);
  const bombG=num(/#tbomb\{[^}]*left:calc\(100% \+ (\d+)px\)/,inner);
  const hits=(W,H)=>mq.length>0&&H<=+mq[1]&&W*+mq[3]>=H*+mq[2];
  const bad=[];
  const probe=(W,H)=>{
    const s=Math.max(0.3,Math.min((W-spareW)/600,(H-spareH)/520,1.8));
    const sw=600*s, sh=520*s, gut=(W-sw)/2;
    const ok=hits(W,H)
      ?gut-padG-padW>=0&&gut-bombG-bombW>=0&&(H+sh)/2-12-padW>=0
      :padL+padW+bombW+bombR<=sw;
    if(!ok&&bad.length<4) bad.push(W+"x"+H+(hits(W,H)?" gutter "+gut.toFixed(1):" stage "+sw.toFixed(1)));
  };
  for(let W=560;W<=1400;W+=2) for(let H=280;H<=1000;H+=2) probe(W,H);
  for(const [W,H] of [[812,375],[667,375],[568,320],[915,412],[932,430],[320,568],[375,667],[390,844],[430,932]]) probe(W,H);
  check("pad and bomb never overlap or sit on the board in short landscape:"
    +" they move to the side gutters (env() insets are 0, no viewport-fit=cover)",
    mq.length>0&&padG>=0&&bombG>=0&&bad.length===0,
    bad.join(" | ")||"812x375 stage "+(600*(375-spareH)/520).toFixed(1));
  check("the gutter rules carry no display: (the [hidden] guard stays the only one)",
    !/display:/.test(inner),inner);
  const bodyRule=(html.match(/html,body\{[^}]*\}/)||[""])[0];
  check("body spans the viewport so its overflow:hidden clip holds the side gutters",
    !/overflow:hidden/.test(bodyRule)||/[{;\s]width:100%/.test(bodyRule),bodyRule);
}

console.log("\n  TOUCH RESULT: "+pass+" PASS / "+fail+" FAIL");
process.exit(fail?1:0);
