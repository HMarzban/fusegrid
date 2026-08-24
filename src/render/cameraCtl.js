/* USER CAMERA CONTROL — pure pan/zoom/clamp math + DOM mount (spec §1-§4).
   State is a plain {x,y,zoom} owned by main.js as a render-side closure; it
   NEVER enters world/snapshot/intent. All math is Node-testable and shared by
   kind "2d" and "3d" (only boardBBox differs). screen = c + pan + z*(world-c).
   DOM mounting is guarded like touch.js: no canvas/window -> silent no-op. */
export const MIN_Z=0.6, MAX_Z=2.5, WHEEL_K=0.0015;

/* §3 board bbox per renderer kind: [bx0,bx1,by0,by1]. 2d = COLS*TILE x
   ROWS*TILE; 3d = projected extent (sx=OFF_X±300/260, sy=PAD..280+OFF_Y). */
export function boardBBox(kind){
  return kind==="3d"?[24,584,24,328]:[0,600,0,520];
}

/* §3 single-axis intersect rule: keep [b0,b1] overlapping the viewport.
   min=-c-z*(b1-c), max=(dim-c)-z*(b0-c); empty interval (degenerate) -> 0. */
export function clampAxis(p,z,c,dim,b0,b1){
  const lo=-c-z*(b1-c), hi=(dim-c)-z*(b0-c);
  return lo>hi?0:p<lo?lo:p>hi?hi:p;
}

/* Clamp both axes of cam against the current viewport + board bbox. */
export function applyClamp(cam,cw,ch,kind){
  const b=boardBBox(kind);
  cam.x=clampAxis(cam.x,cam.zoom,cw/2,cw,b[0],b[1]);
  cam.y=clampAxis(cam.y,cam.zoom,ch/2,ch,b[2],b[3]);
  return cam;
}

/* Panned translate in canvas-space pixels (caller clamps afterwards). */
export function panBy(cam,dx,dy){ cam.x+=dx; cam.y+=dy; return cam; }

/* §3 cursor anchor: d=s-c; pan1=d-(z1/z0)(d-pan0) keeps the world point under
   the cursor fixed mid-range (accepted drift at clamp edges). Sets zoom=z1. */
export function zoomAnchor(cam,z1,sx,sy,cw,ch){
  const dx=sx-cw/2, dy=sy-ch/2;
  cam.x=dx-(z1/cam.zoom)*(dx-cam.x);
  cam.y=dy-(z1/cam.zoom)*(dy-cam.y);
  cam.zoom=z1;
  return cam;
}

/* Spec §4 entry point: clamp z1 into [MIN_Z,MAX_Z], anchor at cursor, then
   clamp pan so the board never leaves the viewport. */
export function zoomAt(cam,z1,sx,sy,cw,ch,kind){
  zoomAnchor(cam,z1<MIN_Z?MIN_Z:z1>MAX_Z?MAX_Z:z1,sx,sy,cw,ch);
  return applyClamp(cam,cw,ch,kind);
}
export const wheelZoom=(cam,deltaY,sx,sy,cw,ch,kind)=>
  zoomAt(cam,cam.zoom*Math.exp(-deltaY*WHEEL_K),sx,sy,cw,ch,kind);
export const pinchZoom=(cam,z0,ratio,sx,sy,cw,ch,kind)=>
  zoomAt(cam,z0*ratio,sx,sy,cw,ch,kind);

/* §3 outer transform around renderer.render (GAME branch of main loop only):
   translate(cx+x,cy+y) -> scale(z) -> translate(-c). */
export function transform(c,W,H,cam){
  c.translate(W/2+cam.x,H/2+cam.y);
  c.scale(cam.zoom,cam.zoom);
  c.translate(-W/2,-H/2);
}

export function createCamera(){ return {x:0,y:0,zoom:1}; }
export function resetCamera(cam){ cam.x=0; cam.y=0; cam.zoom=1; return cam; }

/* DOM wiring (§2 input map): RIGHT-drag pan, wheel zoom (preventDefault),
   two-pointer pinch zoom w/ fire-latch cancel, contextmenu swallowed while
   mounted. Drag/pinch coordinates are client px divided by the CSS scale so
   fit()-scaled canvases pan 1:1 in canvas space. Every handler is inert
   unless getActive() (main gates it to GAME). */
export function mountCameraCtl({canvas,input,getActive,cam,
    getKind=()=>"2d"}){
  const active=getActive||(()=>false);
  if(!canvas)return {detach(){}};
  const w=typeof window!=="undefined"?window:null;
  cam=cam||createCamera();
  const ptOf=(e)=>{
    const r=canvas.getBoundingClientRect();
    const k=canvas.width/(r.width||canvas.width);
    return {x:(e.clientX-r.left)/k,y:(e.clientY-r.top)/k};
   };
  let drag=null;                    // last canvas-space pt of a right-drag
  const pts=new Map();              // pointerId -> canvas pt (pinch tracking)
  let pinch=null;                   // {d0,z0} frozen at 2nd finger down
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const onDown=(e)=>{
    if(!active())return;
    if(e.pointerId!=null){
      pts.set(e.pointerId,ptOf(e));
      if(pts.size===2){             // pinch start: kill pending fire latch
        if(input)input._intent.fire=false;
        const v=[...pts.values()];
        pinch={d0:dist(v[0],v[1])||1,z0:cam.zoom};
       }
     }
    if(e.button===2)drag=ptOf(e);
   };
  const onMove=(e)=>{
    if(pts.has(e.pointerId))pts.set(e.pointerId,ptOf(e));
    if(pinch&&pts.size>=2){
      const v=[...pts.values()];
      const mx=(v[0].x+v[1].x)/2, my=(v[0].y+v[1].y)/2;
      pinchZoom(cam,pinch.z0,dist(v[0],v[1])/pinch.d0,mx,my,
        canvas.width,canvas.height,getKind());
      return;
     }
    if(drag){
      const p=ptOf(e);
      panBy(cam,p.x-drag.x,p.y-drag.y);
      drag=p;
      applyClamp(cam,canvas.width,canvas.height,getKind());
     }
   };
  const endPt=(e)=>{
    pts.delete(e.pointerId);
    if(pts.size<2)pinch=null;
    if(e.button===2||e.type==="pointercancel")drag=null;
   };
  const onWheel=(e)=>{
    if(!active())return;
    e.preventDefault();
    const p=ptOf(e);
    wheelZoom(cam,e.deltaY,p.x,p.y,canvas.width,canvas.height,getKind());
   };
  const onCtx=(e)=>{ e.preventDefault(); };   // right-drag owns button 2
  canvas.addEventListener("pointerdown",onDown);
  canvas.addEventListener("wheel",onWheel,{passive:false});
  canvas.addEventListener("contextmenu",onCtx);
  const winL=w?[["pointermove",onMove],["pointerup",endPt],
    ["pointercancel",endPt]]:[];
  winL.forEach(([t,f])=>w.addEventListener(t,f));
  return {detach(){
    canvas.removeEventListener("pointerdown",onDown);
    canvas.removeEventListener("wheel",onWheel);
    canvas.removeEventListener("contextmenu",onCtx);
    winL.forEach(([t,f])=>w&&w.removeEventListener(t,f));
   }};
 }
