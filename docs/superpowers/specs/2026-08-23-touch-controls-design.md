# TOUCH CONTROLS DESIGN — rollblock (2026-08-23)

Goal: mobile play via zero-dep DOM overlays reusing Input's intent pipeline.
Scope v1: move + bomb only, GAME screen only, touch devices only.

## §1 Detection
Single mechanism: `'ontouchstart' in window` (src/touch.js `hasTouch()`).
Justification: pointer events fire for mice/trackpads too (desktop false
positives); `maxTouchPoints` is missing on some older Android/iOS WebViews.
`ontouchstart` exists exactly when the browser implements touch input — one
expression, no UA sniffing. Evaluated once at mount; desktop builds nothing.

## §2 Layout & marks
- Container `#touchpad`, absolute inset 0 of `#stage` (#stage is already
  position:relative, index.html:22). Container pointer-events:none; children auto.
- LEFT: 4-zone D-pad (NOT 8-way): one square element; hit zone derived from
  clientX/Y within getBoundingClientRect (cross quadrants + 20% center dead
  zone). 4-way matches the grid game and Input's axis model; 8-way adds
  accidental diagonals for zero player value.
- RIGHT: circular BOMB button Ø~72px, ≥16px from edges.
- Throw/remote/kick NOT on touch in v1: all three are power-up-gated
  (hint copy index.html:56-58), so buttons would be dead most of a run;
  the core loop is fully covered by move+bomb. Revisit if power-up uptime rises.
- Fixed px sizing — buttons overlay the scaled canvas independently of fit();
  safe area: `bottom:calc(12px + env(safe-area-inset-bottom))`.

## §3 Routing mechanism (pinned)
Reuse ONLY the existing pipeline. Chosen: small public API on Input +
existing `setIntent`. REJECTED: direct `_intent` mutation from main.js
(bypasses tested path) and synthetic PointerEvents on canvas (couples to C1).
- src/input.js ADDS one method delegating to the exact handlers tests already
  exercise (sim.test.mjs:203-206):
      padFire(down){ down ? this._onFireDown({}) : this._onFireUp({}); }
- Movement: touch layer calls `input.setIntent({move:{x,y}})` — public today;
  sim.test.mjs:207-212 proves it writes held axes consumed by `intent()`.
- Bomb press → `input.padFire(true)`; release → `input.padFire(false)`;
  lands in `_intent.fire`, same fire-edge/advance() latch as keys+canvas tap.

## §4 Multi-touch contract
Naive single-pointer dies: left thumb holds RIGHT while right thumb taps BOMB.
Contract — per control element, never global:
- Each control tracks ONE active `pid`. pointerdown claims pid (second finger
  on same control ignored); pointerup/pointercancel/lostpointercapture with
  matching pid releases and clears its axes/fire. `setPointerCapture(pid)`
  guarantees release delivery even if the finger slides off the button.
- D-pad handles pointermove for its captured pid: zone re-evaluated under the
  finger (slide UP→LEFT without lifting works). BOMB ignores moves (binary).
- Both controls use CSS `touch-action:none` plus `preventDefault()` on down →
  no scroll/pinch/double-tap-zoom ghosts. Canvas keeps its existing
  touch-action:none (index.html:25). We add NO listeners to canvas.

## §5 Integration edits (enumerated per file)
1. NEW src/touch.js (~70 lines, Node-clean):
   - `export function hasTouch(w)` — pure predicate over `{navigator,...}`-ish.
   - `export class PadMapper` — headless core: `down(pid,x,y,rect)`,
     `move(pid,x,y,rect)`, `up(pid)`; mutates input ONLY via setIntent/padFire;
     pure zone math ⇒ fully unit-testable with zero DOM.
   - `export function mountTouch(input, stage)` — DOM build/wiring guarded by
     `typeof document`; returns `{update(inGame), unmount()}`; no-op stub when
     headless.
2. src/input.js: add `padFire(down)` per §3. No changes to _attach or ordering.
3. src/main.js: after `new Input(...)`:
       const touch=mountTouch(input,document&&document.getElementById("stage"));
   In `loop(t)` before branching: `touch.update(app.screen===SCREEN.GAME);`
   update() shows/hides the container (display toggle w/ cheap guard) and on
   hide clears all held axes + `_intent.fire` (screen exit mid-hold unsticks).
4. index.html: static `#touchpad` skeleton (`hidden`: dpad + bomb divs,
   aria-labels) + CSS block: absolute corners, translucent panels reusing
   --panel/--line, border-radius, `touch-action:none`, `-webkit-user-select:none`.
5. NEW tests/touch.test.mjs — same pass/fail console harness as sim.test.mjs.

## §6 Tests: automated vs manual
AUTOMATED (node --test, no DOM):
- hasTouch truth table (absent flag / present flag).
- PadMapper zone map: edge/corner/center-dead samples → expected held axes.
- Slide up→left with same pid flips axes without lift.
- Multitouch: dpad pid=7 holds right WHILE bomb pid=9 presses → fire true only
  during press; bomb release keeps right held.
- Stale release: up(wrongPid) no-op; up after hide zeroes everything.
- padFire routes through _onFireDown/_onFireUp (fire toggles true/false).
MANUAL-ONLY: real-device latency/feel, notch safe-area, iOS Safari ghost-click
audit, visual polish, fit() interplay at odd aspect ratios.

## §7 Acceptance checklist
[ ] 1. Desktop (no touch): zero DOM added, zero listeners, page unchanged.
[ ] 2. Touch device: controls visible ONLY in GAME; hidden in BOOT/INTRO/MENU/subs.
[ ] 3. Move thumb + bomb thumb simultaneously (independent pointerIds) works.
[ ] 4. Finger slides between D-pad zones without lift; any-release clears axes.
[ ] 5. Menu tap-nav unaffected — C1 swallow guarantee intact (no new canvas
       listeners added anywhere; grep-verifiable).
[ ] 6. No scroll/zoom/select ghosts during play (touch-action + preventDefault).
[ ] 7. npm test green incl. touch.test.mjs; src/touch.js imports clean in Node.
[ ] 8. Sim untouched: src/core/** diff empty; all intents flow through Input.
