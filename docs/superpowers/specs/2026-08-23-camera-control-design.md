# Design — User Camera Control v1 (PAN + ZOOM)
**Date:** 2026-08-23 · Status: cold-executable. Precedent: intro flyover outer
ctx transform (main.js:357-368, `introPhase` zoom/camX/camY); PROJ frozen
(r3d/camera.js); renderer.render stays pure. Sim/world/netcode untouched.

## 1. Scope + rulings (binding)
- PAN + ZOOM only. NO orbit/rotation (per-angle reprojection → v2; dimetric §7 warning stands: mouse-only stream, arrows stay movement).
- Same outer-transform pattern as the flyover but persistent + user-driven; applied BY THE CALLER in main.js `loop()` around `renderer.render` — never inside the renderer.
- Active ONLY while `app.screen===SCREEN.GAME`; menu/intro/attract keep authored framing. Identical math for kind "2d" and "3d".
- State = main.js closure `const cam={x:0,y:0,zoom:1}` (render-side only; NEVER in world/snapshot/intent).
- Clamps: zoom∈[0.6,2.5]; pan bounded so the board bbox always INTERSECTS the viewport; zoom anchored at cursor.

## 2. Input map (exact)
- **RIGHT-drag = pan** (button 2). Chosen over left (left-tap IS fire: `input.js:64` `_onFireDown` latches on ANY pointerdown) and over middle (autoscroll hijack on Win/Linux) and hold-Space (Space=fire, direct conflict). Requires `src/input.js`: `_onFireDown`/`_onFireUp` return early when `e.button!==0` (undefined→primary; `padFire({})` unaffected). Canvas `contextmenu` preventDefault'd while mounted.
- **WHEEL = zoom**: canvas wheel listener, preventDefault, `z1=clamp(z*Math.exp(-e.deltaY*0.0015))`.
- **PINCH = zoom (touch)**: two simultaneous canvas pointers; `z1=clamp(z0*dist/dist0)` anchored at midpoint. PadMapper untouched — pad/bomb live on `#touchpad` children, never canvas. On 2nd finger down: cancel pending fire latch (`input._intent.fire=false`, mirrors the C1 swallow pattern) so pinch-start never drops a bomb; lifting below 2 pointers ends the gesture.
- **KeyR = reset** (double-click rejected: two fire taps = two bombs). Handled in main.js `onUiKey` wrapper BEFORE `app.key`, gated to GAME; also `resetCam()` in `onStart`.
- Ordering: Input's listeners register first (constructor) and now ignore button≠0; camera listener added later, acts only when `getActive()` true; main's C1 swallow (:183) early-returns in GAME — no interplay. Outside GAME camera is fully inert.
- Drag coordinates: client px ÷ `(rect.width/canvas.width)` (fit() CSS-scale correction, touch.js `snap` style).

## 3. Camera math (pinned)
Transform (cx=cw/2, cy=chh/2): `c.translate(cx+cam.x,cy+cam.y); c.scale(z,z); c.translate(-cx,-cy)` ⇒ screen = c + pan + z·(world−c).
- `boardBBox(kind)` → `[bx0,bx1,by0,by1]`: "2d" `[0,600,0,520]` (COLS·TILE×ROWS·TILE); "3d" `[24,584,24,328]` (sx=OFF_X±[260,300]=284∓…, sy=PAD..280+OFF_Y).
- Cursor-anchored zoom: `d=s−c; pan1=d−(z1/z0)(d−pan0)` (keeps world point under cursor fixed). At clamp edges anchoring drifts — accepted.
- clampPan per axis: `min=−c−z·(b1−c)`, `max=(dim−c)−z·(b0−c)`; clamp into [min,max]; if min>max (degenerate) → 0.
- Shake composes INSIDE render (unchanged); overlay/hud draw inside render so they ride the transform — same accepted quirk as the flyover.

## 4. Integration edits (per file)
1. `src/input.js` — button guard in `_onFireDown`/`_onFireUp` only (2 lines).
2. `src/render/cameraCtl.js` NEW — exports `MIN_Z=0.6, MAX_Z=2.5, boardBBox(kind), clampPan(cam,axis…), zoomAt(cam,z1,sx,sy,cw,ch,kind)` (pure, Node-testable) + `mountCameraCtl({canvas,input,getActive,cam})` → `{detach}`: canvas pointerdown(button2→start drag / track pinch pids)+wheel+contextmenu, window pointermove/pointerup/pointercancel; document/window guarded like touch.js (headless/desktop without canvas → no-op stub).
3. `src/main.js` — import cameraCtl; `cam` closure; mount after `mountTouch` (only `if(canvas)`); KeyR branch in onUiKey wrapper; `resetCam()` in onStart; GAME branch of loop adds the §3 transform inside the existing save/restore (INTRO branch untouched); expose `get cam(){return cam;}` on the returned object + in `__GAME__`.
4. `tests/camera.test.mjs` NEW — pure-math suite (below).
5. `tests/headless.test.mjs` — integration block using `mkCanvas()` + stubbed `globalThis.window`.
6. Append dated MEMORY.md entry (standing rule).

## 5. Testable behaviors + manual list
Headless: (a) `zoomAt` invariance: world point under cursor pre/post equal (mid-range); (b) zoom clamps to [0.6,2.5]; (c) clampPan keeps bbox∩viewport≠∅ at extremes, BOTH kinds' bboxes; (d) degenerate range → pan 0; (e) `_onFireDown({button:2})` leaves fire=false, `{button:0}` latches, `padFire` intact; (f) inert outside GAME: MENU-frame wheel/drag events leave cam frozen; (g) GAME frame emits translate(cx+x,cy+y)+scale(z) per recording-proxy ctx, absent in MENU frames; (h) KeyR + onStart restore {0,0,1}; pinch 2nd-finger cancels fire latch.
Manual (browser/device): right-drag feel + no contextmenu; trackpad wheel; iOS Safari pinch; fit()-scaled drag accuracy; `?render=3d` parity; RENDER-toggle mid-run keeps framing; `?net=local` sanity.

## 6. Acceptance checklist
1. Full battery green incl. new `tests/camera.test.mjs` (node --test).
2. Right-button never touches the fire latch (check e).
3. Wheel zoom clamped, cursor-anchored (checks a+b).
4. Pan clamp holds both bboxes in-viewport (checks c+d).
5. Camera inert outside GAME; menus/attract byte-identical output (check f).
6. GAME-only outer transform matches cam values (check g); renderer.js diff = 0.
7. Reset paths live: KeyR, onStart, pinch fire-cancel (check h).
8. 2D/3D identical behavior through one shared cam (same checks run with kind toggled).

## 7. Out of scope
Orbit/rotation + reprojection; camera state in protocol/netcode; inertia/easing; zoom LOD; double-click reset; per-screen saved framings; DPR handling; option (c) full 3D.
