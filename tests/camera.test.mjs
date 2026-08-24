import {Input} from "../src/input.js";
import {MIN_Z,MAX_Z,WHEEL_K,boardBBox,clampAxis,applyClamp,panBy,
  zoomAnchor,zoomAt,wheelZoom,pinchZoom,transform,createCamera,resetCamera,
  mountCameraCtl} from "../src/render/cameraCtl.js";

let pass=0, fail=0;
function check(name, cond, detail){ cond?pass++:fail++;
  console.log((cond?"  PASS ":"  FAIL ")+name+(detail!==undefined?" -> "+detail:"")); }
const eps=(a,b,q=1e-9)=>Math.abs(a-b)<=q;

// ---- §4 pinned constants ----
check("MIN_Z/MAX_Z pinned", MIN_Z===0.6&&MAX_Z===2.5, MIN_Z+"/"+MAX_Z);
check("wheel mapping k=0.0015", WHEEL_K===0.0015);

// ---- §3 boardBBox (both kinds, acceptance #8) ----
{
  const b2=boardBBox("2d"), b3=boardBBox("3d");
  check("boardBBox 2d = [0,600,0,520]",
    b2[0]===0&&b2[1]===600&&b2[2]===0&&b2[3]===520, JSON.stringify(b2));
  check("boardBBox 3d = [24,584,24,328]",
    b3[0]===24&&b3[1]===584&&b3[2]===24&&b3[3]===328, JSON.stringify(b3));
}

// ---- §3 clampAxis intersect rule + degenerate -> 0 ----
{
  const lo=-300-1*(600-300), hi=(600-300)-1*(0-300);      // z=1 2d x-axis
  check("clampAxis keeps in-range pan untouched",
    clampAxis(123,1,300,600,0,600)===123);
  check("clampAxis clamps to min at -inf", clampAxis(-9999,1,300,600,0,600)===lo,
    "lo="+lo);
  check("clampAxis clamps to max at +inf", clampAxis(9999,1,300,600,0,600)===hi,
    "hi="+hi);
  // degenerate: z*(b0-b1)>dim -> empty interval -> 0
  check("clampAxis degenerate range resets to 0",
    clampAxis(50,1,300,600,1000,300)===0);
}

// ---- §5(c) applyClamp keeps bbox INTERSECTING viewport at extremes ----
{
  const dims={"2d":[600,520],"3d":[608,352]};
  let ok=true, det="";
  for(const kind of ["2d","3d"]){
    const [cw,ch]=dims[kind], b=boardBBox(kind);
    for(const [zx,zy] of [[MIN_Z,1],[1,MAX_Z],[MAX_Z,MAX_Z]]){
      const cam={x:1e5,y:-1e5,zoom:1};
      cam.zoom=zx; if(zy!==1){ /* per-axis zoom not supported; use uniform */ }
      cam.zoom=Math.max(zx,zy);
      applyClamp(cam,cw,ch,kind);
      // visible world span on each axis: w=(s-c-pan)/z+c for s in {0,dim}
      const vx0=(0-cw/2-cam.x)/cam.zoom+cw/2, vx1=(cw-cw/2-cam.x)/cam.zoom+cw/2;
      const vy0=(0-ch/2-cam.y)/cam.zoom+ch/2, vy1=(ch-ch/2-cam.y)/cam.zoom+ch/2;
      if(!(vx0<=b[1]&&vx1>=b[0]&&vy0<=b[3]&&vy1>=b[2])){ ok=false;
        det=kind+" z"+cam.zoom+" x["+vx0.toFixed(1)+","+vx1.toFixed(1)+"]"; }
     }
   }
  check("(c) extreme pans keep board bbox intersecting viewport (2d+3d)",ok,det);
}
{
  const cam=createCamera();
  applyClamp(cam,600,520,"2d");
  check("identity cam survives clamp unchanged",
    cam.x===0&&cam.y===0&&cam.zoom===1);
}

// ---- §5(a) cursor-anchored zoom: world point under cursor stationary ----
{
  const cw=600,ch=520,sx=430,sy=180;
  const cam=createCamera();
  const wx=(cam)=>((sx-cw/2)-cam.x)/cam.zoom+cw/2;
  const wy=(cam)=>((sy-ch/2)-cam.y)/cam.zoom+ch/2;
  const bx=wx(cam), by=wy(cam);
  zoomAt(cam,1.4,sx,sy,cw,ch,"2d");
  check("(a) zoomAt anchors cursor point (x)", eps(wx(cam),bx),
    bx.toFixed(4)+"->"+wx(cam).toFixed(4));
  check("(a) zoomAt anchors cursor point (y)", eps(wy(cam),by),
    by.toFixed(4)+"->"+wy(cam).toFixed(4));
  // mid-range repeat from the new state (compounding)
  const bx2=wx(cam), by2=wy(cam);
  zoomAt(cam,0.8,sx,sy,cw,ch,"2d");
  check("(a) anchor holds across compound zoom", eps(wx(cam),bx2)&&eps(wy(cam),by2));
}

// ---- §5(b) zoom clamps to [0.6,2.5] ----
{
  const cam=createCamera();
  zoomAt(cam,99,300,260,600,520,"2d");
  check("(b) zoomAt clamps high to MAX_Z", cam.zoom===MAX_Z,String(cam.zoom));
  zoomAt(cam,0.0001,300,260,600,520,"2d");
  check("(b) zoomAt clamps low to MIN_Z", cam.zoom===MIN_Z,String(cam.zoom));
}

// ---- wheel/pinch mappings ----
{
  const cam=createCamera();
  wheelZoom(cam,-100,300,260,600,520,"2d");
  check("wheel deltaY=-100 -> z*exp(+0.15)",
    eps(cam.zoom,Math.exp(0.15)),String(cam.zoom));
  const z0=cam.zoom;
  wheelZoom(cam,+100,300,260,600,520,"2d");
  check("wheel deltaY=+100 shrinks symmetrically", eps(cam.zoom,z0/Math.exp(0.15)));
  wheelZoom(cam,-20000,300,260,600,520,"2d");
  check("huge wheel-in clamps to MAX_Z", cam.zoom===MAX_Z);
  wheelZoom(cam,+20000,300,260,600,520,"2d");
  check("huge wheel-out clamps to MIN_Z", cam.zoom===MIN_Z);
}
{
  const cam=createCamera();
  pinchZoom(cam,1,80/80,240,200,600,520,"2d");        // no movement yet
  check("pinch ratio 1 keeps zoom", cam.zoom===1);
  pinchZoom(cam,1,160/80,280,200,600,520,"2d");
  check("pinch ratio 2 doubles zoom (clamped path live)", cam.zoom===2,
    String(cam.zoom));
  pinchZoom(cam,1,999,0,0,600,520,"2d");
  check("pinch huge ratio clamps to MAX_Z", cam.zoom===MAX_Z);
  pinchZoom(cam,1,0.001,0,0,600,520,"2d");
  check("pinch tiny ratio clamps to MIN_Z", cam.zoom===MIN_Z);
}

// ---- panBy / create / reset ----
{
  const cam=createCamera();
  panBy(cam,10,-4); panBy(cam,2.5,0.5);
  check("panBy accumulates", cam.x===12.5&&cam.y===-3.5,JSON.stringify(cam));
  resetCamera(cam);
  check("resetCamera restores identity", cam.x===0&&cam.y===0&&cam.zoom===1);
  check("createCamera starts identity",(()=>{const c=createCamera();
    return c.x===0&&c.y===0&&c.zoom===1;})());
}

// ---- §3 transform order smoke via spy ctx ----
{
  const calls=[];
  const spy=new Proxy(function(){},{
    get:(t,p)=>p===Symbol.toPrimitive?()=>"":(...a)=>{calls.push([p,a]);return spy;},
    apply:()=>spy, set:()=>true });
  transform(spy,600,520,{x:37,y:-11,zoom:1.7});
  const want=[["translate",[337,249]],["scale",[1.7,1.7]],["translate",[-300,-260]]];
  const got=calls.slice(0,3).map(c=>[c[0],c[1]]);
  check("transform emits translate(cx+x,cy+y)->scale(z)->translate(-cx,-cy)",
    JSON.stringify(got)===JSON.stringify(want),JSON.stringify(got));
}

// ---- §2(e) right-button never touches the fire latch ----
{
  const inp=new Input(null);
  inp._onFireDown({button:2});
  check("(e) _onFireDown({button:2}) leaves fire=false", inp._intent.fire===false);
  inp._onFireUp({button:2});
  check("(e) _onFireUp({button:2}) is a no-op", inp._intent.fire===false);
  inp._onFireDown({button:0});
  check("(e) _onFireDown({button:0}) latches fire", inp._intent.fire===true);
  inp._onFireUp({button:0});
  check("(e) _onFireUp({button:0}) clears fire", inp._intent.fire===false);
  inp.padFire(true);
  check("(e) padFire({}) unaffected by guard", inp._intent.fire===true);
  inp.padFire(false);
  inp._onFireDown(undefined);
  check("(e) missing event still latches (defensive)", inp._intent.fire===true);
}

// ---- §4 mountCameraCtl DOM guard: headless-clean stubs ----
{
  const inp=new Input(null);            // built BEFORE window exists:
  let threw=false, r=null;              // its window listeners stay unregistered
  try{ r=mountCameraCtl({}); r.detach(); }catch(e){ threw=true; }
  check("mountCameraCtl headless no-op stub + detach", !threw&&typeof r.detach==="function");
  const types=[];
  const el={width:600,height:520,
    addEventListener(t){types.push(t);},removeEventListener(){},
    getContext:()=>null,getBoundingClientRect:()=>({left:0,top:0,width:600,height:520})};
  const wl=[];
  globalThis.window={addEventListener(t,f){wl.push([t,f]);},removeEventListener(){}};
  try{
    const m=mountCameraCtl({canvas:el,input:inp,cam:createCamera(),
      getActive:()=>true});
    check("mount registers canvas pointerdown/wheel/contextmenu",
      types.indexOf("pointerdown")>=0&&types.indexOf("wheel")>=0
      &&types.indexOf("contextmenu")>=0,types.join(","));
    check("mount registers window move/up/cancel",
      wl.map(w=>w[0]).join()==="pointermove,pointerup,pointercancel",
      wl.map(w=>w[0]).join());
    m.detach();
    check("detach callable without throw", true);
   }finally{ delete globalThis.window; }
}

console.log("\n  CAMERA RESULT: "+pass+" PASS / "+fail+" FAIL");
process.exit(fail?1:0);
