# CONTROLS feature: gamepad play, rebinding, the CONTROLS page, device-following hints (plan)

Owner, 2026-11-02, verbatim: "alright, it is good time to create this feature, let's create a branch and focus on this feature, we will push and relase this on friday, so this branch will remain on local. run team of agents and game designer in order to right things done properly."

Branch `feature/controls`, local only. Ships as shell **v201** on Friday 2026-11-06. The owner pushes and tags; nothing in this plan pushes.
Record (wins over the notes): `docs/superpowers/specs/2026-11-02-controls-menu-design.md`. Notes: `.superpowers/sdd/notes/v200-controls-design/` (git-ignored). Mock to port: `ui/mock/{page,page2,art,proto}.js`.
Plan only: no `src/` or `tests/` file is changed by writing this document.

## Lead rulings (2026-11-02; these close every open question below and in the acceptance doc)

- **Plan Q1 / acceptance Q7, touch:** the defaults stand. Chips grow to 44 CSS px, tiles wrap 3 + 2 when narrow, and `pauseView 3` is read-only on touch if it does not fit. A touch-only player can reach the page.
- **Plan Q2 / acceptance Q6, T14 is IN.** A pad-only player reaches LEVEL MODES, STATS T / C, WIN/LOSE C / B and the NEW VERSION card. It stays last so it can be cut only if the owner says so.
- **Plan Q3, pad name:** neutral `CONTROLLER 1 · STANDARD`. The device id is never printed or stored. Owner may overrule.
- **Plan Q4:** do not raise the `main.js` pin. Move code to a seam instead.
- **Acceptance Q1:** stick release = `max(0.02, deadzone - 0.05)`.
- **Q2:** a held key beats the pad on a mixed axis. **Q3:** same-poll order is bomb first. **Q4:** a SPACE to E roll works like SOUTH to WEST on the pad. **Q5:** a held menu stick repeats through `_repeat`, as held keys do.
- **Q8:** RESET is two presses. **Q9:** `core/feat.js:58` becomes `PRESS THE OTHER WAY`; any pin on it moves with it, and this is copy only, not sim.
- **Q10:** the wake press acts on the title, show and ATTRACT, and is swallowed everywhere else, so reconnecting never resumes a run.
- **Q11, consent:** with no answer yet, the OPTIONS ANALYTICS row does nothing on a pad and says `ANSWER THE CARD WITH Y OR N`. A pad can never turn analytics on from an unanswered state; a stray button must not consent. Once answered, the row toggles as today.
- **Acceptance D1:** replay equality is pinned for the defined script, and the four listed key / pad differences are accepted and disclosed.

## Open questions (answer before the task that needs them; each has a default the plan assumes)

1. **Layouts the design does not cover (blocks T4 and T9).** Direction D exists only at 600x520 keyboard. Touch, the narrow shell box (< 560 wide) and `pauseView 3` on `#c` have no drawing. Numbers: a chip is 36 tall = about 23 CSS px at the 0.63 touch-portrait PAUSE scale, against the 44 CSS project floor (`ACT_GEO.min`); a tile is 84 = about 53 CSS and passes. **Default:** one geometry in `controlsgeo.js`, chip height `max(36, ceil(44 / scale))` on a touch layout, plate inside the `pageBox` touch band (8..512); in a box under 560 wide the five tiles wrap 3 + 2. T4 measures and reports whether it fits at 393x852, 852x393 and PAUSE-on-`#c` 0.63; if it does not, fallback is a read-only CONTROLS in PAUSE on touch (taps off the plate back out). The owner may veto.
2. **Pad routes on other screens (T14, droppable).** LEVEL MODES, STATS T / C, WIN/LOSE C / B, the NEW VERSION card, the load-failure card. A MODES cursor redraws LEVEL SELECT, which the brief excludes. **Default:** out of the shippable set; T14 is last, independent, and dropping it changes nothing else. Disclosed in the release note if dropped (pad-only players lose MODES, STATS copy, WIN/LOSE copy; they can still play, pause, change PACE with the shoulders, and leave pages).
3. **Pad name.** Default: neutral `CONTROLLER 1 · STANDARD` (non-standard: `CONTROLLER 1 · BUTTONS 0-N`). The device id is never printed or stored. Owner may choose to print it.
4. **`main.js` budget.** It is 770 lines against a pin of 799 (`tests/headless.test.mjs:1298`): 29 free. T11 spends at most 24 (ledger in T11). If it cannot, ask for a ruling; the plan does not raise the pin silently.
5. **Departure from the mock (not a question).** `proto.js` arms capture on a timer only. The ruling is "after every input is released, then 200 ms", so `capture.js` adds the release check. Recorded here as deliberate.

## Global Constraints

- Zero npm deps, no build step, Node v26, `node --test tests/<file>`. No DOM in `src/core`. **`step()`, `sim.js`, `world.js` and the wire shape `{move, fire, firePrev, shift, remote}` are untouched.** The reserved `kick` slot stays false. No new sim field; `tests/determinism.test.mjs` and every replay hash stay as they are.
- Positional button names only, in identifiers, copy, tests and docs: SOUTH EAST WEST NORTH, L SHOULDER, R SHOULDER, L TRIGGER, R TRIGGER, SELECT, START, D-PAD, L-STICK, R-STICK. Ids in code: `S E W N SHL SHR TRL TRR SELECT START dU dD dL dR`. No controller maker's name and not the private reference game's name, anywhere (code, tests, docs, commit messages).
- **Clocks.** Every timer in the new modules takes the frame time `t` (rAF ms) or an injected `now`, never `performance.now()`/`Date`: the 200 ms capture arm, the 0.75 s hint dwell, the 0.5 s card guard. `keys.test`'s virtual clock must be able to drive all of them.
- **The backdrop world sits in `"PLAY"` behind every menu** (`main.js:93`). Every "world is PLAY" gate must also test `app.screen === SCREEN.GAME`: the PLAY pad layer, `canThrow`, rumble, and above all the disconnect auto-pause (route it through `onPause`, which has the GAME guard, and only when `world.state === "PLAY"`).
- Scope: gamepad play, keyboard + pad rebinding, the CONTROLS page in the tile style, hints following the last-used device. **PAUSE, OPTIONS and every other menu keep today's look**; only their hint text and the OPTIONS row count change.
- Defaults are byte-identical where the design says nothing: with default binds and no pad, every pinned frame and string is unchanged except the named pins below.
- Every task that adds a `src/**/*.js` file adds it to `src/pwa/shell.js` (`tests/pwa.test.mjs` demands it), alphabetical. Every task that changes the static boot graph runs `node tests/loadbar.test.mjs --write` and commits `index.html`. T0 pre-creates the stubs, so later tasks edit those files and never `shell.js`.
- Render stays pure and draws from state it is handed. `menudraw.js` imports nothing from `src/app/` (hints reach it through the render-side `hintcopy.js` setter, the `setFxOpts` precedent).
- Weight: art is imported statically (`padart.js`, `controlsdraw.js`; the lazy alternative splits hit geometry from painting and risks a blank first frame). There is no boot byte cap, only the file-count pin `data-files`; each task reports its raw-byte delta. PIXEL's px cap (192 KB) and the three-look lazy trees are not touched.
- No comments unless the file already uses explanatory block comments. Compact style like the neighbours. Public methods get a one-line doc.
- Agents never commit and never touch the CLASSIC hash pins; the lead commits by exact path (messages end with the attribution lines in force). Housekeeping (servers, headless browsers, scratch) after every wave.

## Review Focus

1. The shared-latch rewrite in `input.js` (T2): a pad must never cancel a held key or pointer, and `main.js:440/464` (`input._intent.fire = false`) must still swallow.
2. Gates: GAME screen AND PLAY state for pad play, THROW gated on `players[0].throw` (`sim.js:174-185` plants a bomb at the feet otherwise).
3. Capture runs first in every path (Input guard, `updVisible`, `#ana`), and ESC in capture never reaches `onPause`/`pauseBack`.
4. Hardcoded routes that would mishandle `pauseView 3` / CONTROLS (T6, T9, T11): `main.js:449`, `shellview.js:146`, `SHELL_ON` (`shellview.js:47`), the page tap list `main.js:471`, the cue wrapper `main.js:340-349`, `menuapp.back()` and `pauseBack()`.
5. Pad press starts the show on an un-gestured context, silently (T11).
6. "Hints never lie": every prompt composes from live binds and the last-used device (T10/T12), and default output is unchanged.
7. Pin discipline (list at the end).

## Pins that move (all intentional; each task names its own)

reset.test KEEP 3 -> 4 (lines 41-44, 77-78, 88) · menuapp.test OPT_ROWS literal (85-89), optRow literals 9/10 and wrap checks (623-630, 1370-1415, 1459-1467) · menudraw.test OPT_N 11 -> 12 (967), pitch 28/37 -> 27/34-or-37 and note line (615-629, 933-936, 1608), `ENTER SELECT` -> `ENTER CONFIRM`, OPTIONS pane `ALL TEN` -> `ALL TWELVE` (932; 979 reads the GRAPHICS pane, check), title string · coach.test 5 literals `Shift+Space tosses a bomb` -> `E tosses a bomb` (286, 556, 577, 809 + the REMOTE ones unchanged) · loadbar.test `data-files` 102 -> measured, per task · pwa.test CACHE/REV v200 -> v201 · headless sitemap lastmod >= 2026-11-06 · keys.test gains the pad matrix. **CLASSIC `9fb48f0a:72431`, `7e57d1aa:71503` and the PIXEL pin must not move**; T12 runs `classic-perf`, `pixel-render`, `gfx-identity` and, if a hash moves, stops: "re-pin by ruling, diff proven to be copy only" needs the lead.

## Lanes (disjoint files, safe in parallel)

- Wave 0: T0 alone.
- Wave 1, all parallel: T1 (`controls.js`) · T2 (`input.js`) · T3 (`gamepad.js`) · T4 (`controlsgeo/padart/controlsdraw`) · T8 (`rumble.js`). T5 starts after T1.
- Wave 2, parallel: T5 (`capture.js`, `controlspage.js`) after T1 · T6 (`menuapp.js`) after T1+T5 interfaces · T7 (`padroute.js`) after T2+T3.
- Wave 3, sequential on `menudraw.js`: T9 then T10. T11 (wire) after T2 T3 T5 T6 T7 T8.
- Wave 4: T12 after T10+T11 · T13 after T9 (parallel with T12) · T14 after T11 (droppable) · T15 last.

---

## T0: scaffold, store key, KEEP list
Lane: alone. Files: create stubs `src/app/{controls,gamepad,padroute,capture,controlspage,controlswire,hints,rumble}.js`, `src/render/{controlsgeo,padart,controlsdraw,hintcopy}.js` (one-line header comment, empty `export {}` except `controls.js`); edit `src/app/reset.js`, `src/pwa/shell.js`, `tests/reset.test.mjs`.
Produces: `export const CONTROLS_KEY = "nb.controls.v1"` in `controls.js`; `KEEP_KEYS = [SETTINGS_KEY, PACE_KEY, ANALYTICS_KEY, CONTROLS_KEY]` (a hand preference, like settings; a STATS wipe must not take a player's hands).
Failing test (edit `reset.test.mjs` first): KEEP is exactly the four keys; `clearCabinet` leaves 5 entries (4 + `other.app`); line-88 case size 5; "every nb.* literal in src/ is classified" passes with the new literal. Fails until the key exists.
Implement, then verify: `node --test tests/reset.test.mjs tests/pwa.test.mjs tests/pixel-lazy.test.mjs tests/loadbar.test.mjs` (stubs are not imported, so the boot graph is unchanged; no re-pin).
Commit: the 12 new stubs, `src/app/reset.js`, `src/pwa/shell.js`, `tests/reset.test.mjs`.

## T1: the model, the store, the rules (pure)
Lane: parallel with T2, T3, T4, T8. Files: `src/app/controls.js`, `tests/controls.test.mjs`.
Consumes: `defaultStore` (`store.js`). Produces (exact):
```
ACTIONS = ["BOMB","THROW","REMOTE","PAUSE"]; MOVE_ORDER = ["UP","RIGHT","DOWN","LEFT"]
DEF_KEY = {BOMB:"Space",THROW:"KeyE",REMOTE:"KeyQ",PAUSE:"KeyP",MOVE:["KeyW","KeyD","KeyS","KeyA"]}
DEF_PAD = {BOMB:"S",THROW:"W",REMOTE:"E",PAUSE:"SELECT"}
DEF_CONTROLS = {key:DEF_KEY, pad:DEF_PAD, stick:"L"|"R", dead:25, rumble:0}   (all frozen deep)
PAD_IDX = {0:"S",1:"E",2:"W",3:"N",4:"SHL",5:"SHR",6:"TRL",7:"TRR",8:"SELECT",9:"START",12:"dU",13:"dD",14:"dL",15:"dR"}
BTN = {id:{g,v,w,s}}   // glyph kind, glyph value, word ("L SHOULDER"), short ("L SHLDR")
clampControls(raw): Controls            // a bad / duplicate device block resets THAT device only (gfx.js idiom); dead snapped to 5..60 step 5
loadControls(store?): Controls ; saveControls(c, store?): void   // JSON {v:1,...}; guarded like pacestore.js
refuseKey(code): string     // "" = bindable, else the exact refusal copy (below)
refuseBtn(id): string       // START, dU dD dL dR, anything off PAD_IDX -> "D-PAD ALWAYS MOVES · PICK ANOTHER" / "START IS PAUSE · PICK ANOTHER"
bindKey(c, action, code): {c, kind:"same"|"set"|"swap"|"move", other:string|null, line:string}
bindMoveSet(c, codes[4]): {c, moved:string[], line:string}      // an action key inside the new set takes a freed old MOVE key
bindBtn(c, action, id): {c, kind, other, line}
resetDevice(c, "key"|"pad"): Controls     // pad reset also restores dead 25, rumble 0, stick "L"
keyName(code, key?): string; moveLabel(move): string            // WASD reads as WASD; key = printed char wins (layout honesty)
softAliases(c): ["KeyJ","KeyX"] | []      // only while BOMB === "Space" and J / X are bound to nothing else
boundKeys(c): Set<string>                 // feeds Input's preventDefault list
```
Refusal copy (port `proto.js REFUSE`): ESC, ENTER, NUMPAD ENTER, BACKSPACE, ARROWS, TAB, F-keys, every modifier/lock key (`unlock.js MODS` + `ContextMenu`), M R T C B U Y N, 1-5 and NUMPAD 1-5, `[ ]` each with its why-line. `KeyE` is bindable; `KeyK` is bindable (ordinary key).
Failing tests (name -> assertion): `defaults are exactly the record's table`; `refuses each listed key with a non-empty line, allows KeyE/KeyK/Period`; `swap within one device, line = "EAST WAS REMOTE · REMOTE NOW SOUTH"`; `a key held by MOVE swaps with that MOVE direction`; `same bind = NO CHANGE`; `keys and pad never conflict`; `bindMoveSet 4 unique keys, duplicates refused`; `clampControls resets only the bad device`; `dead snaps 7 -> 5 and 99 -> 60`; `save/load round-trips; absent/garbage loads DEF_CONTROLS`; `J/X aliases vanish once BOMB is rebound or X is captured elsewhere`; `reset pad restores dead, rumble, stick`; `no maker names in controls.js` (regex over the file, as `banned-name.test`).
Verify: `node --test tests/controls.test.mjs tests/reset.test.mjs`. Commit: both paths.

## T2: Input, per-source latches, pad writer, binds
Lane: parallel (only `input.js` + its test). Files: `src/input.js`, new `tests/input-pad.test.mjs`; run (do not edit unless a literal truly moves) `tests/{keys,touch,camera}.test.mjs`.
Consumes: key bind object (T1 `Controls.key`). Produces on `Input`:
```
setKeyBinds(kb /*Controls.key*/): void   // _onKey/_onKeyUp read it; defaults when never called = today's table
guard: (e) => boolean | null             // true = swallow the key (capture): Input returns before onPause/onUiKey
gate: { canThrow: () => boolean } | null // main sets it: GAME screen AND PLAY AND players[0].throw
gpMove(d:{up,down,left,right}): void     // pad held axes; never touches _held
gpFire(down:boolean): void ; gpRemote(down:boolean): void
gpThrow(): boolean                       // gated; thumb roll handled; returns whether it fired
get axes(): {up,down,left,right}         // merged view: per axis the key/touch value wins, else the pad's
```
Design: `_intent.fire` stays THE latch (main.js writes `input._intent.fire = false` directly at `:440` and `:464` and must keep swallowing). Fire and remote gain holder bits `_hold = {key, ptr, pad}`; `_intent.fire = key || ptr || pad`; the key handlers set `key`, `_onFireDown/Up` set `ptr`, `gpFire` sets `pad`. `intent()` merges `axes` into `move`. A pad rising edge sets `_padFresh`; its release is deferred until one `advance()` ran (a tap shorter than a tick still fires once; same for remote). Space keyup keeps clearing the KEY remote only. Solo THROW key (`binds.THROW`, default E): `if (gate && gate.canThrow()) pulseThrow()`; SHIFT + BOMB still works unchanged (unadvertised). Thumb roll: `gpThrow` with only the pad holding BOMB drops the pad hold, runs `pulseThrow`, and swallows pad BOMB until released; a key-held fire keeps the existing no-op. `_onBlur` clears pad axes, holds, deferred releases. `_onKey` calls `guard` first.
Failing tests: `default key table is unchanged (WASD, ARROWS, Space/J/X, Shift, Q, P, Escape)`; `setKeyBinds moves BOMB to KeyZ: Space no longer fires, J/X alias dropped`; `rebound MOVE keys drive intent().move; ARROWS always do`; `solo THROW key without the power fires nothing and plants no bomb`; `solo THROW with the power gives one shift+fire tick`; `SHIFT+Space still throws`; `pad fire does not cancel a held Space, and Space keyup does not cancel pad fire`; `pad remote survives Space keyup`; `a pad tap shorter than one tick still yields exactly one fire tick`; `thumb roll BOMB held then THROW: one throw, BOMB swallowed until release`; `key-held fire makes gpThrow a no-op`; `main-style input._intent.fire=false swallow still clears a pointer-held fire`; `axes: key left beats pad right on that axis, pad up still passes`; `blur clears pad state`; `guard=true: onPause and onUiKey never run, no held key set`; `existing virtual-pad padFire path is byte-identical`.
Verify: `node --test tests/input-pad.test.mjs tests/keys.test.mjs tests/touch.test.mjs tests/camera.test.mjs tests/determinism.test.mjs`. Commit: `src/input.js`, `tests/input-pad.test.mjs`.

## T3: the poller and the stick (pure over an injected `getGamepads`)
Lane: parallel. Files: `src/app/gamepad.js`, `tests/gamepad.test.mjs`.
Produces:
```
createPad({getGamepads:()=>ArrayLike<Gamepad|null>|null, dead?:number, stick?:"L"|"R"}) => {
  poll(t:number): PadSnap, setDead(d), setStick(s), snap(): PadSnap }
PadSnap = {connected, found, lost, count, mapping:"standard"|"other", name,
  down:Set<id>, press:id[], release:id[],       // PAD_IDX ids, triggers via value (press >= 0.50, release <= 0.35)
  dir:{up,down,left,right},                      // PLAY layer: D-PAD wins over the stick; radial deadzone
  menuDir:{up,down,left,right},                  // same stick read at max(dead, 0.50)
  mag:number, anyDown:boolean }
resolveStick(prev:{ax,sx,sy,on}, x, y, dead): {ax,sx,sy,on,dir}   // pure
padName(snap): string                                              // neutral name only
```
Rules: radial deadzone (engage at `dead`, release at `dead - 0.05`); 4-way by dominant axis, switch only when the other axis exceeds 1.25 x the held one; first engage takes the larger axis, tie to vertical; sign flip on the same axis is immediate; full speed past the deadzone. D-PAD: newest press wins, release falls back to the one still held; diagonals are 4-way. Several pads: the last to press is active; a stuck axis alone never claims. A button already down when a pad first appears counts as a press (browsers reveal a pad on its first press). `getGamepads` throwing or returning null = no pad. `found`/`lost` are one-poll edges. Non-standard mapping: same indices, stick only when the pad has no D-PAD indices. Index 16 and stick clicks are never read.
Failing tests: `deadzone 0.25: 0.24 reads nothing, 0.26 engages, releases at 0.20`; `dominant axis: 1.2x holds, 1.3x flips; tie goes vertical`; `sign flip on one axis is immediate`; `menuDir uses max(dead, 0.5): drift 0.4 never moves a menu`; `dead 0.60 menuDir threshold is 0.60`; `trigger press at 0.5, release at 0.35, none between`; `D-PAD wins over the stick`; `two D-PAD buttons: newest wins, release falls back`; `first sight with a button down reports a press`; `two pads: last to press wins, stuck axis never claims`; `found/lost edges once`; `null getGamepads and a throwing getGamepads are inert`; `non-standard pad keeps indices and reports mapping "other"`; `name never contains the device id`.
Verify: `node --test tests/gamepad.test.mjs`. Commit: both paths.

## T4: the page's pure geometry and paint (port of the mock)
Lane: parallel (new render files only). Files: `src/render/controlsgeo.js`, `src/render/padart.js`, `src/render/controlsdraw.js`, `tests/controlsdraw.test.mjs`.
Consumes: `menudraw.js` kit exports (`ACCENT TEXT MUTED DANGER font sans plate head paintRow lockGlyph`; export any not yet exported, the one edit allowed in `menudraw.js`, additive only), the view state below. Port, do not redesign: `art.js` -> `padart.js` (`drawPad2`, `drawKeys2`, `glyph`, `spark`, `PARTS/FACE/LEAD/KB_ROWS`; rename ids `LB RB LT RT` -> `SHL SHR TRL TRR`), `page2.js` -> `controlsdraw.js` (`ring`, `drawTile`, `drawChip`, `drawPrompts`, `pillTabs`, `drawCapture2`), `page.js` copy tables (`rowsOf`, `statusOf`, `RULE`, `padStates`, `keyStates`, `stickView`) -> split: copy/rows into `controlsgeo.js` as pure data functions so the page reducer (T5) and the painter share them.
Produces:
```
controlsgeo: G2 (plate x20 y73 w560 h419 r22; tiles 96x84 y300 gap 8; chips y396 h36 gap 8), tileGeom(i,g?), chipGeom(i,g?), geomOf(i,g?),
  geoFor(L, touch, narrow): G, hitPage(view, x, y, G): {tab}|{row}|{pane:[x,y]}|{off:1}|{}, rowsOf(view): Row[], statusOf(view,row): string, promptsOf(view,row,words): Prompt[]
controlsdraw: drawControls(c, L, view, ui:{touch, narrow, words, t}): void   // plate, title, pill tabs, diagram, 8 tiles/chips, status line, prompts, capture plate
View = {tab:"key"|"pad", device:"key"|"pad"|"touch", row:0..7, pad:{state:"ready"|"none"|"lost"|"nonstd", name}, key:Controls.key, binds:Controls.pad,
        stick, dead, rumble:0|1, stickVal:[x,y], armed:bool, swap:{row,part?}|null, status:string, capture:Capture|null, echo:id|null}
```
Departures to apply (a11y record rulings): inside a selected tile/band text is `#dfe7f5`, never muted; binding chip outline `#7385ad` not `#2a3550`; a fixed row shows a padlock + `FIXED`, not dimmed; every state carries a shape and a word (selected ring+fuse, listening open bracket, conflict triangle `!` + `ALSO <ACTION>`/`SWAPPED`, fixed padlock, changed-from-default dot + `CHANGED`); under `ui.noMotion`/static the pulse is a static outline; the listening state never animates. Keyboard walk: `<- ->` within tiles or chips, `up/down` jump between them. Layout per Question 1 (touch chip floor, narrow wrap). Pad names from `view.pad.name` only.
Failing tests: `hit geometry equals paint geometry: every tile/chip centre hits its row at 600x520, touch, narrow`; `tab hits split at the pill midpoint`; `off the plate is {off:1}; on the plate off the rows is {}`; `touch chip height >= 44 CSS at scales 0.63/0.73/0.9 and tiles >= 44`; `rowsOf(key) = 8 rows with CONFIRM/BACK fixed and RESET KEYS; rowsOf(pad) has DEADZONE/RUMBLE/RESET PAD; nonstd reads BUTTON n`; `statusOf copy table matches the record (default, no pad, locked, reset idle/armed/done/nothing, pad lost/back, swap)`; `drawControls runs on a recording ctx in every state without throwing and paints no text under 10px mono / 13px sans`; `contrast: #dfe7f5 on the selected band >= 4.5 and chip outline #7385ad >= 3.0 (computed)`; `no 'LB','RB','LT','RT' ids and no maker names in the three files`; `plate fits inside pageBox band at 600x520 and 608x352 guard`.
Report in the handoff: raw bytes added (expect ~28-34 KB) and the three-viewport fit result for Question 1. These files are not imported yet (no boot-graph change). Verify: `node --test tests/controlsdraw.test.mjs tests/menudraw.test.mjs`. Commit: the 3 new files, the test, and `src/render/menudraw.js` only if exports were added.

## T5: capture and the page reducer (pure)
Lane: after T1; parallel with T6/T7. Files: `src/app/capture.js`, `src/app/controlspage.js`, `tests/capture.test.mjs`, `tests/controlspage.test.mjs`.
Produces:
```
createCapture(): { open(spec:{action,dev,step?}, t:number), tick(t:number, anyDown:boolean): void,
  feed(kind:"key"|"btn", id:string, t:number): CapResult, cancel(): void, view(): Capture|null, armed(t): boolean }
CapResult = {kind:"ignored"|"refused"|"cancel"|"commit"|"step", line?:string, value?:any}
createControlsPage({get:()=>Controls, set:(c:Controls)=>void, padView:()=>{state,name}, say:(s:string)=>void}) => {
  view(t): View, open(dev:"key"|"pad"|"touch"): void, walk(dir:-1|1, axis:0|1): boolean, tab(id): boolean,
  confirm(t): boolean, adjust(dir): boolean, back(): "page"|"cap"|"disarm", cancel(): boolean,
  feedKey(code,key,t): boolean, feedBtn(id,t): boolean, tick(t, anyDown), capturing:boolean }
```
Rules (record + game-design §4): no timeout, no countdown, listening state static. Arms only after every key/button is released AND 200 ms (a double tap cannot bind; a tremor bounce before arm resets the clock). Cancel: ESC, pad START, tap off the plate, pad lost during pad capture (`CANCELLED · NOTHING CHANGED`); pressing the current bind keeps it (`NO CHANGE`). Pad capture ignores sticks and D-PAD (never binds); START never binds. MOVE capture on keys walks UP RIGHT DOWN LEFT, commits only after step 4, cancel reverts all four, ARROWS stay on. Conflict = swap within one device, one status line naming both, displaced row reads SWAPPED (6 s or next press, by `t`). RESET rows: two-press arm, any other input disarms (STATS `R` model); `RESET PAD` also restores deadzone/rumble/stick. DEADZONE: Enter/SOUTH steps +5 and wraps 60 -> 5; `<- ->` adjusts +-5 clamped. RUMBLE toggles; with no actuator the row reads `—` and does nothing. MOVE on pad: Enter flips L-STICK / R-STICK. A locked row: Enter says why, no capture. A no-pad pad tab is not rebindable. `say()` gets one polite sentence per page open, row move, capture start/result, conflict (a11y R7.2 strings).
Failing tests (capture): `does not arm while a key is still down`; `arms 200 ms after the last release, not before (injected t)`; `a bounce before 200 ms restarts the clock`; `ESC cancels and writes nothing`; `no timeout: still listening after 10 minutes of ticks`; `refused key keeps the plate open with its line`; `pressing the current bind = NO CHANGE`; `MOVE 4 steps commits once; ESC at step 3 reverts`; `duplicate in the MOVE set refused`; `pad capture ignores stick and D-PAD, START cancels`. (page): `walk: left/right inside tiles, up/down jumps tile<->chip`; `swap sets swap row and status line`; `reset arms then resets, any other input disarms`; `deadzone wraps`; `rumble row inert without actuator`; `tab switch keeps row clamped`; `pad lost mid-capture cancels`; `set() is called exactly once per commit with the saved Controls`; `view() has the mock's S shape`.
Verify: `node --test tests/capture.test.mjs tests/controlspage.test.mjs`. Commit: the four paths.

## T6: the shell machine learns CONTROLS
Lane: after T1+T5 interfaces (against their signatures). Files: `src/app/menuapp.js`, `tests/menuapp.test.mjs`, `tests/keys.test.mjs` (literals only here; the pad matrix is T11).
Consumes: `createControlsPage` via `opts.controls` (a page object; absent = inert, so Node tests that omit it stay green). Produces:
```
SCREEN.CONTROLS = 16                       // appended
OPT_ROWS = [..., "GRAPHICS","CONTROLS","RESET DEFAULTS"]   // 12; GRAPHICS stays index 9, CONTROLS 10, RESET 11
app.pauseView 3 (inline), app.ctlTab, app.capturing:boolean (page.capturing), app.padNote:string, app.wake():void  // idleT=0, parked=false
```
Edits (each by name): `confirm()` SETTINGS door -> `_ctlOpen()`; `back()` CONTROLS -> SETTINGS with `optRow = OPT_ROWS.indexOf("CONTROLS")`; `pauseBack()` gets its own branch (3 -> 1, `optRow` on the CONTROLS door, never 3 -> 2; today's `pauseView--` would land on GRAPHICS); `confirmPause()`, `move()` and `update()` lateral branch route CONTROLS / view 3 to the page (`left/right` = tabs and tile walk, held repeat via `_repeat`); `key()`: the hard-coded `KeyW/KeyA/KeyS/KeyD` taps (`:257-268`) read `page` binds (`app.moveKeys`, default WASD) + ARROWS always; while `capturing`, `key()` returns false for everything (capture owns the key); `_push`/`_toMenuInner`/`startRun` clear `capturing`; `optCycle` CONTROLS row opens. HIGH SCORES and LEVEL taps unchanged.
Failing tests: `OPT_ROWS frozen, twelve rows, CONTROLS between GRAPHICS and RESET DEFAULTS`; `door Enter opens SCREEN.CONTROLS, Esc/Backspace return to OPTIONS on the door row`; `optMove wraps 11 -> 0 and 0 -> 11`; `CONTROLS in PAUSE is pauseView 3: Esc steps 3 -> 1 on the door, never 3 -> 2, never to play`; `pause view 3 left/right switch tab`; `keys while capturing never reach confirm/back/move`; `SCREEN.CONTROLS is 16 and no value shifted`; `rebound MOVE keys navigate menus, ARROWS always do`; `wake() clears idleT and parked`; `app without opts.controls keeps today's behaviour`.
Pins touched here: menuapp.test OPT_ROWS literal, wrap 10 -> 11 (`:623-630`), `RESET DEFAULTS` index uses `OPT_ROWS.indexOf` where it is a literal 10, `:1370-1415`, `:1459-1467` (GRAPHICS door stays 9).
Verify: `node --test tests/menuapp.test.mjs tests/keys.test.mjs tests/determinism.test.mjs`. Commit: the three paths.

## T7: the router, pad -> Input / shell
Lane: after T2+T3; parallel with T6. Files: `src/app/padroute.js`, `tests/padroute.test.mjs`.
Produces:
```
createPadRouter({input, app, SCREEN, binds:()=>Controls, world:()=>World, onPause:()=>void, onUiKey:(code)=>void, page}) => { route(snap:PadSnap, t:number): {edge:boolean} }
layerOf(app, world): "play"|"menu"      // play = app.screen===GAME && world.state==="PLAY" && !app.pauseView
```
Rules (game-design §1b, §2). PLAY layer (rebindable): BOMB -> `gpFire`; THROW -> `gpThrow()` (gated by `input.gate`); REMOTE -> `gpRemote`; PAUSE (START always, plus the bound alias, default SELECT) -> `onPause()`; D-PAD / stick -> `gpMove(dir)`. MENU layer (fixed, never rebindable): SOUTH or START -> `onUiKey("Enter")` and never the fire latch (no double confirm; on WIN/LOSE it reaches `pulse()` via `endkeys.js`); EAST -> `onUiKey("Escape")` outside GAME; in PAUSE EAST and START call `onPause`; EAST on WIN/LOSE does nothing; shoulders -> `onUiKey("BracketLeft"/"BracketRight")` (HIGH SCORES tabs via `app.move`, LEVEL PACE), `<-/->` tabs on CONTROLS; direction edges send the arrow tap (`onUiKey("ArrowUp"...)`) AND set the held axes (`menuDir`), stick edges suppressed on INTRO and ATTRACT; capture active -> every button goes to `page.feedBtn` (START cancels). Swallow rule: a button pressed in one layer does nothing in another until released; held across blur/tab return = no press until seen released. ATTRACT: SOUTH/START/D-PAD = a run, EAST leaves it. Returns `edge` for the wake/poke.
Failing tests: `PLAY: SOUTH sets fire, release clears it`; `PLAY: WEST with no throw power does nothing and plants nothing`; `PLAY: WEST with the power throws; thumb roll (SOUTH held) throws once`; `PLAY: EAST remote; START pauses; the bound SELECT pauses`; `backdrop PLAY on MENU: SOUTH is Enter, never fire`; `MENU: EAST on root MENU does nothing, on a page backs out`; `PAUSE list: SOUTH confirms, EAST and START resume, view 1/2/3: EAST steps back`; `WIN/LOSE: SOUTH = Enter once, EAST nothing`; `a SOUTH held when the layer flips is ignored until released`; `rebinding BOMB to EAST leaves menu EAST = back`; `stick edge sends one arrow tap and sets held; below max(dead,0.5) sends none`; `INTRO/ATTRACT ignore the stick, honour SOUTH/START/D-PAD`; `capture routes buttons to the page and START cancels`; `shoulders send bracket codes on LEVEL/SCORES`.
Verify: `node --test tests/padroute.test.mjs`. Commit: both paths.

## T8: rumble (one-way, from the event drain)
Lane: parallel. Files: `src/app/rumble.js`, `tests/rumble.test.mjs`.
Produces: `createRumble({enabled:()=>boolean, actuator:()=>({playEffect(type,params):Promise}|null), playing:()=>boolean}) => {feed(events:Array, t:number, player:{x,y}|null): void, stop(): void, supported(): boolean}`. Table (starting values, owner may veto, default OFF): `hurt` strong 180 ms; `lose` strong 300 ms; `win` weak 120 ms; `boom` weak 90 ms within 3 tiles of the player; at most one effect per 100 ms (by `t`); never in ATTRACT/the show (`playing()` false); PAUSE and a hidden page call `stop()`. No actuator = `supported()` false and the page row reads `—`. Reads events only; never mutates the world; `feed` is called BEFORE the renderer drains `world.events`.
Failing tests: `off by default feeds nothing`; `hurt/lose/win/boom effects with the table's magnitudes and durations (fake actuator)`; `boom beyond 3 tiles is silent`; `one effect per 100 ms`; `no actuator: supported false, feed is inert`; `playing() false mutes`; `stop cancels`; `feed does not mutate the events array`; `a rejected playEffect is swallowed`.
Verify: `node --test tests/rumble.test.mjs`. Commit: both paths.

## T9: OPTIONS gets twelve rows; shellview routes CONTROLS
Lane: sequential on `menudraw.js` (T9 before T10); after T4+T6. Files: `src/render/menudraw.js`, `src/render/shellview.js`, `tests/menudraw.test.mjs`, `tests/shellview*.test.mjs` if one pins routes (grep first).
Edits: `OPT_N` 12 (pinned equal to `OPT_ROWS.length`), `OPT_LABEL`/`OPT_3D` gain CONTROLS; `rowsGeom(L, n, note, touch, tp)` gains a keyboard-pitch argument; `settingsGeom`: keyboard pitch **27**, note line removed (324 of 330.8 body), touch pitch **37 where twelve rows fit the `pageBox` band, else 34** (measure; the shell box keeps 37); the OPTIONS note line `MOVE WASD/ARROWS · …` is deleted (it would lie after a rebind; HOW TO keeps the long form). `settingsRows(..., ctlDoor)` door value = last-used device `KEYBOARD ›` / `CONTROLLER ›` (touch reads `CONTROLLER ›`). `GRAPHICS` geometry keeps 28 / 41. Pane text `ENTER OPENS ALL TEN ROWS` -> `... ALL TWELVE ROWS` (and check `:979`). `shellview.js`: `SHELL_ON` gains `SCREEN.CONTROLS`; `shellBody` draws `drawControls` for `s === SCREEN.CONTROLS`; the PAUSE branch at `:146` gets `pauseView === 3` BEFORE the OPTIONS fallthrough (it draws OPTIONS for any `>= 1` today) and measures against `overlayBox`; `drawSettings` gets the new `ui` fields. MENU OPTIONS preview pane adds `CONTROLS · CONTROLLER READY` / `CONTROLS · KEYS + CONTROLLER`, from a getter `info.pad` (render never reads storage).
Failing tests (edit first): OPT_N is 12; pitches 27 keyboard and 34-or-37 touch with `f = 1` at 600x520 and plate inside its band at every size the old test covered; `settingsHit` row 11 and the below-rows -2; the note line is not drawn; door value follows the device; `shellview routes SCREEN.CONTROLS and pauseView 3 to drawControls, never to drawSettings`; `isShellScreen(SCREEN.CONTROLS)`; wide/narrow geometry loop (`:1608`) includes CONTROLS.
Boot graph: `shellview` now statically reaches `controlsdraw/padart/controlsgeo`: run `node tests/loadbar.test.mjs --write`; report the new `data-files` and raw-byte delta. Verify: `node --test tests/menudraw.test.mjs tests/menuapp.test.mjs tests/loadbar.test.mjs tests/pixel-lazy.test.mjs tests/classic-perf.test.mjs`. Commit: `menudraw.js`, `shellview.js`, tests, `index.html`.

## T10: hint words (render side) and the device tracker
Lane: sequential after T9 on `menudraw.js`; the `hints.js` half is parallel earlier. Files: `src/app/hints.js`, `src/render/hintcopy.js`, `src/render/menudraw.js`, `tests/hints.test.mjs`, `tests/menudraw.test.mjs`.
Produces:
```
hints.js: createHintDev({lay:()=>"d"|"p"|"l", dwell:0.75}) => {note(src:"key"|"pad"|"touch", t), device(t):"key"|"pad"|"touch"}
          wordsOf(dev, c:Controls): {dev, ok, back, tab, pause, bomb, throw, remote, move, tapPage:boolean}   // "ENTER"/"ESC" vs "SOUTH"/"EAST", live binds
hintcopy.js (render): setHints(w|null), hints(): Words, tapMode(touch:boolean): boolean   // module state like fx.js setFxOpts; default = keyboard words
```
Rules: the device flips only on a real press (non-modifier keydown, pad button, D-PAD, stick past 0.50, touch tap) never on mouse move, wheel or stick noise; 0.75 s dwell after a flip (by `t`); the swap redraws words with no reflow. Boot: keys, or touch per `data-lay`. CONTROLS always shows both devices. On a touch layout geometry stays on `data-lay`; text follows the device, so `tapMode(touch) = touch && words.dev !== "pad"`. `menudraw.js`: every foot/hint string that names a key is built from `hints()` with the keyboard default producing today's exact bytes (sites: MENU foot `:814`, OPTIONS/GRAPHICS `FOOT_KEYS :1821`, LEVEL `:1218`, HOW TO `:1288`, ITEMS `:1332`, ENEMIES/FLOOR/SCORES `:1370 :1474 :1595`, GUIDE `:1532`, STATS `:1649`, MEDALS `:1790`). Word changes (record): `ENTER SELECT` -> `ENTER CONFIRM` in MENU and PAUSE cues. Title `PRESS ANY KEY` -> `PRESS ANY KEY OR BUTTON`, always (a browser hides a pad until its first press); touch string unchanged. HOW TO row labels come from live binds (`HOW_ROWS :1229`). GUIDE door sub reads `2 RULES · 6 KEYS` / `... 6 CONTROLS`. Fix the live bug found in passing: the GUIDE preview draws a `K` cap (`:1517`) although `KeyK` is unbound; it draws the THROW key.
Failing tests: `dwell: a flip inside 0.75 s of the last one is held back`; `modifier keys, mouse move and wheel never flip`; `stick below 0.5 never flips`; `wordsOf pad = SOUTH/EAST; key = ENTER/ESC; follows a rebound BACK`; `default hints reproduce every pre-change foot string byte for byte (table of 14)`; `MENU foot reads ENTER CONFIRM`; `pad words on a touch layout use the pad column, geometry unchanged`; `title reads PRESS ANY KEY OR BUTTON on keyboard layouts`; `GUIDE preview draws the THROW key, no K`; `menudraw still imports nothing from src/app`.
Pins touched: menudraw.test `ENTER SELECT`, title literal, HOW TO rows if literal. Verify: `node --test tests/hints.test.mjs tests/menudraw.test.mjs tests/classic-perf.test.mjs tests/pixel-render.test.mjs tests/gfx-identity.test.mjs`. Commit: the five paths.

## T11: the seam, `controlswire.js`, and main/frameloop/unlock
Lane: after T2 T3 T5 T6 T7 T8 (and T10 for `hints`). Files: `src/app/controlswire.js`, `src/main.js`, `src/app/frameloop.js`, `src/app/unlock.js`, `src/app/update.js`, `src/app/analytics.js`, `src/app/debughook.js`, `tests/controlswire.test.mjs`, `tests/unlock.test.mjs`, `tests/keys.test.mjs`, `tests/headless.test.mjs` (comment only; the 799 pin stays), `index.html` + `tests/loadbar.test.mjs --write`.
Produces: `mountControls({win, doc, input, app, SCREEN, world, onPause, getGamepads, store, now}) => {poll(t):boolean, afterStep(events, player), blurAll(), capturing(), dispose()}`. `getGamepads` defaults to `navigator.getGamepads` bound when present, and is injectable as `createGame(canvas, {getGamepads})` (`opts`, like `opts.audio`). It owns: the poller + router + page + capture + hint device + rumble wiring; the capture-phase window `keydown` that feeds the page and swallows the key; the `input.guard` (Node has no `stopImmediatePropagation`, the stub events carry only `{code,key,repeat,preventDefault}`); `input.gate.canThrow = () => app.screen === GAME && world.state === "PLAY" && !!(world.players[0] && world.players[0].throw)`; pad poll on EVERY rAF above the frame gate (`frameloop.js` `cb`: `env.pre(t)` before `gate.tick`; a pad edge also calls `gate.poke()`, because the idle floor of 20 fps can miss a tap) and an edge calls `app.wake()`; `blur`/`visibilitychange` clear pad latches (no pause added, key parity); rumble `stop()` on PAUSE/hidden; `afterStep` runs BEFORE `renderer.render()` drains `world.events` (placed beside `feedTally`).
Capture first, everywhere: `Input.guard`; `updVisible` and `cardVisible` (`analytics.js:52`) return false while `app.capturing`, so `#upd` (U) and `#ana` (Y/N) stand down; ESC in capture ends capture and never reaches `onPause`/`pauseBack`.
Pad starts the title: `armUnlock(target, audio, onReady, skip)` keeps its signature and gains a returned `pad()` entry (or an exported `padPress`): on a rising pad button it calls `audio.unlock()` in the poll callback; if the ctx runs, the normal `onReady` (sting + music); if it does not run after 250 ms, `onReady` fires anyway, ONE press not the keyboard's two, and `unlocked()` already gates the sting, so the show plays silent; later pad presses re-call `unlock()` and a later key or tap still joins the music. MENU foot shows `NO SOUND YET · PRESS A KEY OR TAP` only while the pad is last used, SOUND is on and the ctx is not running (note flows through `app.padNote`-style getter, not a new SCREEN).
Disconnect: only when the pad was last used AND `app.screen === GAME` AND `world.state === "PLAY"`: call `onPause()` (it has the GAME guard) and set `app.padNote = "CONTROLLER LOST"` (PAUSE kicker; `ro.pause` gets `note: app.padNote` inside the existing render-opts literal, 0 added lines); keys last-used: no pause, the note waits for the next menu/PAUSE; reconnect: `CONTROLLER BACK`, never auto-resume. A pad first seen: one-time chip `CONTROLLER READY` at the next non-PLAY moment (the PAUSE kicker in GAME), never on INTRO, ATTRACT or during capture.
Other hardcoded routes fixed here, each by name: `main.js:449` (`settingsHit` for any non-2 view) gets `pauseView === 3 -> controlsHit`; `main.js:471` page tap list gets `SCREEN.CONTROLS` and its `hitPage`; the cue wrapper `main.js:340-349` plays `uiSel` for a tab/row confirm on CONTROLS and `uiTog` for DEADZONE/RUMBLE (not `uiSel` for a capture commit, which plays `uiTog`); `shellInput.input` reads `input.axes` (the merged keys+touch+pad view) so the pad gets menu repeat; the touch pad is not hidden mid-PLAY by a pad press.
`main.js` ledger (cap 24 net, pin 799, now 770): import 1 · `const ctl = mountControls({...})` 3 · `canvasEl`/`frames` env `pre: ctl.poll` 1 · `shellInput` merged getter 0 (edit in place) · `ctl.afterStep(world.events, world.players[0])` 1 · `onDown` CONTROLS branch + view-3 hit 5 · onUiKey capture/guard delegate 2 · cue wrapper 3 · `onPause` note 0 · debug hook 1 · autoplay/INTRO no change 0 = 17, margin 7. Any logic beyond a call belongs in `controlswire.js`, never `main.js`.
Failing tests: unlock — `a pad press unlocks and starts the show when the ctx runs`; `a pad press with a ctx that never runs starts the show silently after 250 ms, one press`; `a later key or tap still joins the music`; `Escape and modifiers still do not count`; `the keyboard's two-press hatch is unchanged`. keys.test (fake `getGamepads`, virtual clock): the full pad matrix in every shell/world state (`INTRO title/show, MENU, every page, LEVEL, SCORES, GAME PLAY/PAUSE/WIN/LOSE, ATTRACT`); `a pad alone leaves the title`; `pad movement and bomb move the hero and plant`; `WEST without the power plants nothing`; `a pad press zeroes idleT and parked and never lets MENU drop into ATTRACT`; `pad menu repeat 350 ms then 110 ms`; `ESC in capture never pauses or backs out`; `U and Y/N do nothing during capture`; `disconnect pauses only when pad last used and in GAME PLAY; never from MENU's backdrop`; `reconnect never resumes`; `rebind BOMB to a pad button then plant with it; menu SOUTH still confirms`; `keyboard rebind of MOVE navigates menus and plays`; `blur clears pad latches`. controlswire — `no actuator: rumble row inert`; `hint device flips on a pad press, not on a mouse move`. headless — main.js length <= 799 (assert measured <= 794). Boot graph changes: `node tests/loadbar.test.mjs --write`.
Verify: `node --test tests/unlock.test.mjs tests/keys.test.mjs tests/controlswire.test.mjs tests/headless.test.mjs tests/loadbar.test.mjs tests/pwa.test.mjs tests/determinism.test.mjs tests/classic-perf.test.mjs`. Commit: the listed paths.

## T12: every prompt composes from live binds
Lane: after T10+T11; parallel with T13. Files: `src/core/entities.js`, `src/app/coach.js`, `src/render/scenes.js`, `src/render/menudraw.js` (HOW TO / ITEMS help), `src/app/menuapp.js` only if a string lives there, `tests/coach.test.mjs`, `tests/menudraw.test.mjs`, `tests/hints.test.mjs`.
Edits: `POWER[throw].help` default becomes `"E tosses a bomb"` (the default keyboard, one source; `core` stays pure and DOM-free; REMOTE keeps `"Q detonates your bombs"`); a pure `helpOf(power, words)` in `hints.js` replaces the leading key token with the live word using the same leading-token rule `coach.js` `KEY_HINT` already uses for touch (`the WEST button`, `the E key`), so the coach tip, the floating pickup sub-line, ITEMS, HOW TO, the ghost coach WASD+SPACE pill, the PAUSE cue (`scenes.js overlayCue`: `START · EAST RESUME · ↑↓ MOVE · SOUTH CONFIRM` on a pad) and the WIN/LOSE cue (`SOUTH · next room`, no copy hints on a pad) all read the same table. Touch copy is unchanged. `overlayCue(world, touch, words?)` keeps its 2-arg default.
Failing tests: `coachTip("throw") = "THROW · E tosses a bomb"` and the REMOTE tip unchanged; pad variant `THROW · WEST tosses a bomb`; rebound BOMB changes the ghost-coach pill; `overlayCue keyboard default is byte-identical except ENTER CONFIRM`; `pad cue`; `ITEMS help for THROW follows the bind`; `core/entities.js still has no src/app import`.
Pins touched: coach.test literals at `:286 :556 :577 :809` and any item-help literal. **Hash check (stop-the-line):** run `classic-perf`, `pixel-render`, `gfx-identity` before and after; the PAUSE/HUD copy may land in a pinned frame. Expectation: unchanged. If one moves, stop and report which hash and the diff; "re-pin by ruling, diff proven to be copy only" is the lead's call.
Verify: `node --test tests/coach.test.mjs tests/coach-tiles.test.mjs tests/menudraw.test.mjs tests/hints.test.mjs tests/classic-perf.test.mjs tests/pixel-render.test.mjs tests/gfx-identity.test.mjs tests/items-art.test.mjs`. Commit: the listed paths.

## T13: accessibility, live region, colour gate
Lane: after T9; parallel with T12. Files: `index.html`, `src/app/controlswire.js` (the `say` sink), `tests/controlsa11y.test.mjs`.
Edits: one `.sr-only` `aria-live="polite"` div, written only on CONTROLS (page open, row move, capture start, capture result, conflict), never during PLAY; reuse the on-screen strings. A small Node check over the kit hexes with `simRGB` (`tools/tileart/gatefns.mjs`): solid accent vs danger chip Lab dE >= 30 (measured 34.4 deutan), `#dfe7f5` on every band >= 4.5, chip outline `#7385ad` >= 3, danger-chip ink `#0a0e18` on `#ff5d73` >= 6; `tests/hidden-css.test.mjs` stays green. Do not add the highlight to `cvdsets.mjs`.
Failing tests: `the live region exists once, polite, sr-only`; `say is silent in PLAY`; `colour gate as above`; `every state has a shape and a word (table)`.
Verify: `node --test tests/controlsa11y.test.mjs tests/hidden-css.test.mjs tests/headless.test.mjs`. Commit: the three paths (+ `index.html` re-pin if the loader file count moved).

## T14: pad routes on other screens (DROPPABLE; Question 2)
Lane: after T11, independent; dropping it changes nothing else. Files: `src/app/padroute.js`, `src/app/menuapp.js` (modes cursor), `src/render/menudraw.js` (a ring on the focused chip only once used on a pad), `tests/padroute.test.mjs`, `tests/keys.test.mjs`.
Scope if kept: LEVEL MODES (`TRL/TRR` walk a shell-only cursor, NORTH toggles through the same key path); STATS NORTH = MEDALS, WEST = copy; WIN/LOSE WEST/NORTH copy with the same toast; NEW VERSION card modal (`SOUTH` RELOAD, `EAST` LATER, only a press begun >= 0.5 s after it shows); load-failure card (`SOUTH` RETRY, `EAST` USE CLASSIC 2D). No pad route to the consent card (a stray button must not consent), the STATS wipe, or the camera reset, on purpose.
Tests: one per route, plus `the consent card ignores every pad button` and `a mash within 0.5 s never reloads`. Verify: `node --test tests/padroute.test.mjs tests/keys.test.mjs tests/menuapp.test.mjs`. Commit: the five paths.

## T15: release as shell v201, docs, close-out (last)
Lane: alone, after everything above is green. Files: `src/pwa/shell.js` (`CACHE_NAME = "fusegrid-shell-v201"`, list complete), `sw.js` (REV), `sitemap.xml`, `CHANGELOG.md`, `AGENTS.md`, `docs/architecture.md`, `MEMORY.md`, `docs/diary.md`, `docs/README.md`, a new dated addendum `docs/superpowers/specs/2026-11-06-controls-built.md`, `README.md` (key table), `index.html` (`data-files` final), tests whose literals say v200.
Docs: dated `docs/superpowers/` records are never rewritten; the 2026-11-02 record keeps its "design only" status line, and the addendum says built, with what differed (Question 1 outcome, pad name, T14 kept or dropped, the capture-arm departure). Index the addendum in `docs/README.md`. AGENTS.md: the `src/main.js` seam list (`controlswire.js`, `gamepad.js`, `padroute.js`, `capture.js`, `controlspage.js`, `hints.js`, `rumble.js`, `controls.js`), `SCREEN.CONTROLS = 16`, `pauseView 3`, `OPT_ROWS` twelve rows and pitch 27/34-37, KEEP four keys, the moved pins listed above, the new `main.js` measured length, the hint model and `hintcopy.js`, the pad-start rule, "the sim never sees a pad", keyboard THROW = E, no maker names. MEMORY.md: one dated entry. CHANGELOG: a v201 entry dated **2026-11-06**; `sitemap.xml` `lastmod` must be >= that date (`headless.test` pins it). Disclose, as the record does: keyboard diagonals stay about 1.41x while a pad is 4-way; a pad has no route to the STATS wipe, camera reset or consent card; no real pad or human has tried any number.
Human gate (not automatable, listed in the release note): headed Chrome, real pad, with `--autoplay-policy=document-user-activation-required`: a pad press leaves the title and starts the show (Chrome/Firefox/Safari differ; Safari reported no activation); deadzone 25 %, 1.25x hysteresis and the rumble table feel; unplug mid-run auto-pauses and never resumes; a 393x852 phone with a Bluetooth pad. Clean the service worker and caches first (an unbumped worker serves old bytes).
Verify: `npm test`, then `node --test tests/pwa.test.mjs tests/headless.test.mjs tests/reset.test.mjs tests/loadbar.test.mjs`. Commit: exact paths above. The owner pushes and tags.
