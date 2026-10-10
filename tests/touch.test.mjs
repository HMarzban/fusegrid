import {readFileSync} from "node:fs";
import {Input} from "../src/input.js";
import {hasTouch, PadMapper, mountTouch} from "../src/touch.js";
import {stampBombIcon} from "../src/render/sprites.js";
import {FIT_RES, fitBox, PORT_GAME, PORT_GEO, portraitGeo} from "../src/app/fit.js";

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

// ---- THROW / REMOTE: one-tick intents, never latches, no claims ----
{
  const RT={left:300,top:40,width:52,height:52,kind:"throw"}, RR={...RT,left:360,kind:"remote"};
  const inp=new Input(null); const m=new PadMapper(inp);
  check("THROW tap: this tick carries shift + fire (the keyboard's Shift+Space)",
    m.down(5,320,60,RT)===true&&inp._intent.fire===true&&inp._intent.shift===true);
  inp.advance();
  check("THROW lives one tick: advance() clears fire and shift, nothing latched",
    inp._intent.fire===false&&inp._intent.shift===false&&inp._intent.firePrev===true);
  check("THROW holds no claim: a release (or a stale up) is a no-op",
    m.up(5)===false&&m.padPid===null&&m.bombPid===null);
  check("a second THROW tap is a fresh edge", m.down(6,320,60,RT)===true&&inp._intent.fire===true);
  inp.advance(); inp.advance();
  check("REMOTE tap: this tick carries remote alone (the keyboard's Q)",
    m.down(7,380,60,RR)===true&&inp._intent.remote===true&&inp._intent.fire===false&&inp._intent.shift===false);
  inp.advance();
  check("REMOTE lives one tick, then clears", inp._intent.remote===false&&m.up(7)===false);
  m.down(8,436,136,RB);
  check("bomb held + THROW: no-op (a held fire has no edge to throw on), bomb keeps its hold",
    m.down(9,320,60,RT)===false&&inp._intent.shift===false&&inp._intent.fire===true);
  inp.advance();
  check("...and the hold survives the tick", inp._intent.fire===true);
  m.up(8);
  check("bomb release still clears fire", inp._intent.fire===false);
}
{
  const inp=new Input(null); const m=new PadMapper(inp);
  m.down(1,320,60,{left:300,top:40,width:52,height:52,kind:"throw"});
  m.down(2,436,136,RB);
  inp.advance();
  check("THROW then bomb down in the same tick: one throw tick, shift clears, the bomb stays held until its up",
    inp._intent.fire===true&&inp._intent.shift===false);
  m.up(2);
  check("...bomb up releases it", inp._intent.fire===false);
  const k=new Input(null); k._onKey({code:"ShiftLeft",preventDefault(){}}); k.pulseThrow(); k.advance();
  check("a keyboard Shift held through a THROW tap is left held", k._intent.shift===true&&k._intent.fire===false);
  const q=new Input(null); q._onKey({code:"KeyQ",preventDefault(){}});
  check("REMOTE while Q is held: no-op, Q keeps its latch", q.pulseRemote()===false&&(q.advance(),q._intent.remote===true));
  const b=new Input(null); b.pulseThrow(); b.pulseRemote(); b._onBlur();
  check("blur drops a pending THROW / REMOTE tick", !b._intent.fire&&!b._intent.shift&&!b._intent.remote);
  const e=new Input(null); e.pulse(); e.advance();
  check("Input.pulse() (WIN/LOSE Enter) is unchanged: one fire tick, shift untouched", e._intent.fire===false&&e._intent.shift===false&&e._intent.firePrev===true);
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
    const rule=(html.match(/\n\s*#tpause\{[^}]*\}/)||[""])[0].trim();
    const gap=+((rule.match(/bottom:calc\(100% \+ (\d+)px\)/)||[])[1]);
    const wrapP=(html.match(/body\[data-lay=p\] #wrap\{[^}]*padding:var\(--st,(\d+)px\)/)||[])[1];
    check("#tpause's base rule sits above the stage (never over the"
      +" right-aligned HUD score) and the portrait top pad leaves it room",
      /^#tpause\{/.test(rule)&&!/[{;\s]top:/.test(rule)&&gap>=0&&+wrapP>=44+gap
        &&PORT_GEO.top>=44+gap,
      rule+" wrapTop="+wrapP+" geoTop="+PORT_GEO.top);
  }
  {
    const leak=["tpad","tbomb","tpause","tthrow","tremote"].filter((id)=>{
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
{
  const els=new Map(), hs=new Map();
  const mk=(id)=>{ const e={id,hidden:false,style:{},children:[],textContent:"",
    setAttribute(){}, appendChild(c){ e.children.push(c); },
    querySelector(sel){ return sel[0]==="#"?(els.get(sel.slice(1))||null):(e.children.find((c)=>c.id==="_"+sel)||null); },
    addEventListener(t,f){ hs.set(e.id+":"+t,f); }, removeEventListener(t){ hs.delete(e.id+":"+t); },
    setPointerCapture(){},
    getBoundingClientRect(){ return {left:0,top:0,width:52,height:52}; },
    getContext(){ return null; }};
    els.set(id,e); return e; };
  const box=mk("touchpad"), stage=mk("stage"), thr=mk("tthrow"), rem=mk("tremote");
  mk("tpad"); mk("tbomb"); mk("tpause");
  const noop=()=>{};
  globalThis.window={ontouchstart:null,addEventListener:noop,removeEventListener:noop};
  globalThis.document={addEventListener:noop,removeEventListener:noop,
    getElementById:(id)=>els.get(id)||null, createElement:(tag)=>mk("_"+tag)};
  try{
    const inp=new Input(null);
    const t=mountTouch(inp,stage);
    const lb=(el)=>(el.children.find((c)=>c.id==="_span")||{}).textContent;
    check("THROW / REMOTE start hidden and carry their POWER[].name labels",
      thr.hidden===true&&rem.hidden===true&&lb(thr)==="THROW"&&lb(rem)==="REMOTE",[thr.hidden,rem.hidden,lb(thr),lb(rem)].join());
    const p={throw:false,remote:false};
    t.update(true,true,p);
    check("GAME + PLAY without the powers: both stay hidden",thr.hidden&&rem.hidden);
    p.throw=true; t.update(true,true,p);
    check("THROW shows once the player holds THROW (REMOTE stays hidden)",!thr.hidden&&rem.hidden);
    p.remote=true; t.update(true,true,p);
    check("both show while both are held",!thr.hidden&&!rem.hidden);
    t.update(true,false,p);
    check("PAUSE / WIN / LOSE hide both",thr.hidden&&rem.hidden);
    t.update(true,true,p); t.update(false,false,p);
    check("leaving GAME hides both",thr.hidden&&rem.hidden);
    t.update(true,true,p); p.throw=false; p.remote=false; t.update(true,true,p);
    check("a hit that strips the powers hides both",thr.hidden&&rem.hidden);
    t.update(true,true,null);
    check("no player (the two-arg update) shows neither",thr.hidden&&rem.hidden);
    p.throw=true; p.remote=true; t.update(true,true,p);
    hs.get("tthrow:pointerdown")({pointerId:4,clientX:20,clientY:20,preventDefault(){}});
    check("a pointerdown on THROW sends one shift+fire tick",inp._intent.fire&&inp._intent.shift);
    inp.advance();
    hs.get("tremote:pointerdown")({pointerId:5,clientX:20,clientY:20,preventDefault(){}});
    check("...cleared next tick; a pointerdown on REMOTE sends remote",!inp._intent.shift&&inp._intent.remote);
    inp.advance(); t.unmount();
    check("unmount hides both and unbinds their listeners",thr.hidden&&rem.hidden&&!hs.has("tthrow:pointerdown")&&!hs.has("tremote:pointerdown"));
   }finally{ delete globalThis.window; delete globalThis.document; }
}
{
  const html=readFileSync(new URL("../index.html", import.meta.url),"utf8");
  check("#touchpad hosts #tthrow / #tremote buttons, hidden at load, labelled THROW / REMOTE",
    ["throw","remote"].every((k)=>new RegExp('<div id="t'+k+'" role="button" aria-label="'+k[0].toUpperCase()+k.slice(1)+'" hidden><canvas[^>]*></canvas><span>'+k.toUpperCase()+'</span></div>').test(html)));
}

// ---- D5: pad + bomb + pill sit off the board on every touch layout ----
{
  const html=readFileSync(new URL("../index.html", import.meta.url),"utf8");
  const num=(re,s)=>+((s.match(re)||[])[1]);
  const base=(id)=>(html.match(new RegExp("\\n\\s*#"+id+"\\{[^}]*\\}"))||[""])[0];
  const lay=(l,id)=>(html.match(new RegExp("body\\[data-lay="+l+"\\] #"+id+"\\{[^}]*\\}"))||[""])[0];
  const padW=num(/width:(\d+)px/,base("tpad")), bombW=num(/width:(\d+)px/,base("tbomb")),
    pillW=num(/width:(\d+)px/,base("tpause")), pillG=num(/bottom:calc\(100% \+ (\d+)px\)/,base("tpause"));
  const lPadG=num(/right:calc\(100% \+ (\d+)px\)/,lay("l","tpad")), lPadB=num(/bottom:(\d+)/,lay("l","tpad")),
    lBombG=num(/left:calc\(100% \+ (\d+)px\)/,lay("l","tbomb")), lBombB=num(/bottom:(\d+)px/,lay("l","tbomb")),
    lPillG=num(/left:calc\(100% \+ (\d+)px\)/,lay("l","tpause")), lPillT=num(/top:(\d+)/,lay("l","tpause"));
  const pRules=lay("p","wrap")+lay("p","tpad")+lay("p","tbomb");
  const actW=num(/width:(\d+)px/,base("tthrow")), lThrG=num(/left:calc\(100% \+ (\d+)px\)/,lay("l","tthrow")),
    lThrB=num(/bottom:(\d+)px/,lay("l","tthrow")), lRemG=num(/left:calc\(100% \+ (\d+)px\)/,lay("l","tremote")),
    lRemB=num(/bottom:(\d+)px/,lay("l","tremote"));
  const parsed=[padW,bombW,pillW,pillG,lPadG,lPadB,lBombG,lBombB,lPillG,lPillT,actW,lThrG,lThrB,lRemG,lRemB];
  const bad=[];
  const probe=(W,H)=>{
    const {lay:l,s}=fitBox(W,H,true,600,520), sw=600*s, sh=520*s;
    let ok;
    if(l==="l"){
      const gut=(W-sw)/2;
      ok=gut>=lPadG+padW&&gut>=lBombG+bombW&&gut>=lPillG+pillW
        &&sh>=lPillT+pillW+lBombB+bombW&&(H+sh)/2-lPadB-padW>=0
        &&gut>=lRemG+actW&&lRemG>=lThrG+actW+8&&lThrB===lRemB&&lThrB>=lBombB+bombW+8
        &&sh-lPillT-pillW-8>=lThrB+actW&&base("tthrow").includes("width:"+actW+"px")&&base("tremote").includes("width:"+actW+"px");
    }else ok=[false,true].every((game)=>{
      const g=portraitGeo(W,H,600,520,game), below=H-g.top-sh, G=PORT_GEO;
      return g.top>=pillW+pillG&&g.padTop>=G.gap&&g.bombTop>=G.gap
        &&below>=g.padTop+g.pad&&below>=g.bombTop+g.bomb
        &&g.pad>=G.pad[0]&&g.pad<=(game?PORT_GAME.pad:G.pad[1])&&g.bomb>=bombW
        &&sw>=G.side[0]+g.pad+G.side[1]+g.bomb;
    });
    if(!ok&&bad.length<4) bad.push(W+"x"+H+" "+l+" stage "+sw.toFixed(1)+"x"+sh.toFixed(1));
  };
  for(let W=560;W<=1400;W+=2) for(let H=280;H<W&&H<=1000;H+=2) probe(W,H);
  for(let W=320;W<=1000;W+=2) for(let H=Math.max(W,480);H<=1400;H+=2) probe(W,H);
  for(const [W,H] of [[812,375],[667,375],[568,320],[915,412],[932,430],[320,568],[375,667],[390,844],[430,932],[1180,820],[1024,768],[768,1024]]) probe(W,H);
  check("pad, bomb, pill and THROW / REMOTE never sit on the board (or each other): side gutters in touch"
    +" landscape, below/above the stage in touch portrait, MENU and GAME geometry (env() insets are 0,"
    +" no viewport-fit=cover)",
    parsed.every(Number.isFinite)&&/left:auto/.test(lay("l","tpad"))&&PORT_GEO.top+PORT_GEO.bot===FIT_RES.p[1]
      &&/padding:var\(--st,/.test(pRules)&&/top:calc\(100% \+ var\(--tpt,/.test(lay("p","tpad"))
      &&/width:var\(--tp,/.test(lay("p","tpad"))&&/top:calc\(100% \+ var\(--tbt,/.test(lay("p","tbomb"))
      &&/width:var\(--tb,/.test(lay("p","tbomb"))&&new RegExp("left:"+PORT_GEO.side[0]+"px").test(lay("p","tpad"))
      &&new RegExp("right:"+PORT_GEO.side[1]+"px").test(lay("p","tbomb"))&&bad.length===0,
    bad.join(" | ")||parsed.join()+" "+lay("l","tpad"));
  check("portrait THROW / REMOTE read their slots from actGeo's vars (--ta, --tthr/--ttht, --trem/--tret)",
    /top:calc\(100% \+ var\(--ttht,/.test(lay("p","tthrow"))&&/right:var\(--tthr,/.test(lay("p","tthrow"))&&/width:var\(--ta,/.test(lay("p","tthrow"))
      &&/top:calc\(100% \+ var\(--tret,/.test(lay("p","tremote"))&&/right:var\(--trem,/.test(lay("p","tremote"))&&/height:var\(--ta,/.test(lay("p","tremote")),
    lay("p","tthrow")+lay("p","tremote"));
  const rules=["p","l"].flatMap((l)=>["wrap","tpad","tbomb","tpause","tthrow","tremote"].map((id)=>lay(l,id))).join("");
  check("the layout rules carry no display: (the [hidden] guard stays the only one)",
    !/display:/.test(rules),rules);
  check("the layout keys off body[data-lay] written by fit(), not a media query",
    !/@media \(max-height/.test(html),(html.match(/@media[^{]*/)||["none"])[0]);
  check("the GAME lift glides #wrap's padding-top by --sd (JS-written, 0s default) under body[data-lay=p] alone",
    /transition:padding-top var\(--sd,0s\)/.test(lay("p","wrap"))
      &&!["tpad","tbomb","tpause"].some((id)=>/transition/.test(lay("p",id)))
      &&!["wrap","tpad","tbomb","tpause"].some((id)=>/transition/.test(lay("l",id)))&&!/data-game|\[data-scr/.test(html),lay("p","wrap"));
  const bodyRule=(html.match(/html,body\{[^}]*\}/)||[""])[0];
  check("body spans the viewport so its overflow:hidden clip holds the side gutters",
    !/overflow:hidden/.test(bodyRule)||/[{;\s]width:100%/.test(bodyRule),bodyRule);
}

console.log("\n  TOUCH RESULT: "+pass+" PASS / "+fail+" FAIL");
process.exit(fail?1:0);
