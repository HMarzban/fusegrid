# Menu & Intro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the cinematic intro + six-item keyboard menu shell (app-level state machine outside the sim), with high-score persistence, per the approved minimal-modern design.

**Architecture:** New `src/app/` layer owns BOOT→INTRO→MENU⇄subs→GAME; `main.js` branches its loop on app screen (sim steps only in GAME); `src/render/menudraw.js` draws every screen as pure functions over a normalized layout valid in both 600×520 and 608×352.

**Tech Stack:** Zero-dependency ES modules, Node v26 (`node --test`), Canvas-2D, WebAudio oscillator beeps.

**Spec:** `docs/superpowers/specs/2026-08-23-menu-intro-design.md` — §0 locked decisions, §1 flow/transitions, §2 layouts, §3 motion/easing, §4 input map, §5 audio cues, §6 persistence schema, §7 file layout & integration edits, §8 testing matrix, §9 acceptance criteria. The spec travels with this plan; implementers read both.

## Global Constraints

- Zero new dependencies; no external fonts/images; system `ui-monospace` stack only.
- No DOM access at module top level of any new file (all of `src/app/**` must import clean under Node).
- Nothing app-level (`screen`, `cursor`, toggles, intro t) may enter `world`, `step()`, or protocol; `git diff src/core/` at merge = empty or boot-"MENU"-assignment removals only.
- Palette locked: accent `#37f0d0`, text `#dfe7f5`, muted `#7385ad`, veils `rgba(7,10,18,α)`; NO scanlines/CRT effects.
- Intro total 5.0 s (accept 4–6); skippable by any key/click with ≤250 ms fade.
- Existing flags keep working: `?play=1` boots straight to GAME; `?debug=1` exposes `__GAME__.app`; `?render=3d` drives both intro flyover and menu backdrop.
- All suites stay green: sim 29, r3d 32+, serve, headless, determinism, net — plus new menu/highscores/intro suites.

---

### Task 1: High scores module (pure persistence)

**Files:**
- Create: `src/app/highscores.js`
- Test: `tests/highscores.test.mjs`

**Interfaces (Produces):**
```js
export const HS_KEY="nb.highscores.v1";
export const DEFAULT_SCORES=[{s,l,d}×10]           // frozen at module load, d:"2026-08-23"
export function loadScores(store)                  // any failure → DEFAULT_SCORES copy; never throws
export function recordScore(list,entry)            // NEW array; sort s desc → l desc → d asc; slice(0,10)
export function qualifies(score,list)              // score>last.s || list.length<10
export function saveScores(list,store)             // best-effort; try/catch swallow
```
Store shape: `{getItem(k),setItem(k,v)}`; default store = guarded `window.localStorage` inside try/catch (private-mode Safari throws on access).

- [ ] **Step 1:** Write failing `tests/highscores.test.mjs`: Map-backed fake store; cases — defaults when empty; corrupt JSON / JSON array-of-garbage / non-array → defaults; recordScore sort+trim+tie-break order (equal s → higher l first → older d first); immutability (input list unchanged); qualifies boundary (score===last.s → false); save/load round-trip through Map store.
- [ ] **Step 2:** Run — RED (`ERR_MODULE_NOT_FOUND`). `node --test tests/highscores.test.mjs`
- [ ] **Step 3:** Implement per spec §6 verbatim (schema, DEFAULT_SCORES values, date via `new Date().toISOString().slice(0,10)` only at call sites).
- [ ] **Step 4:** GREEN + full battery: `npm test && node --test tests/highscores.test.mjs`
- [ ] **Step 5:** Commit `feat(app): high-score store — pure, corrupt-safe, injected storage`

### Task 2: Intro timeline model

**Files:**
- Create: `src/app/intro.js`
- Test: `tests/intro.test.mjs`

**Interfaces (Consumes/Produces):**
```js
export const INTRO_DUR=5.0;
export function introPhase(t) -> {zoom,camX,camY,veil,logoP,tagP,done}   // pure; t seconds clamped past DUR
export function createIntro() -> {t:0, update(dt), skip()}               // skip() ⇒ done
```
All easing math lives here using the spec §3 helpers (`easeOutCubic/easeInCubic/easeInOutCubic/easeOutBack/clamp01/seg`) — copy those definitions into this file. Beat table: logo reveal seg(0,0.90) (fade/slide easeOutCubic, letter-scale easeOutBack), hold to 1.40, flyover seg(1.40,4.20): zoom 1.55→1.18 + drift lower-third→center easeInOutCubic, veil 0.55→0.18; settle seg(4.20,5.00): zoom→1.00 easeOutCubic, veil→0.62, tagline in. Logo exit upward+fade seg(1.40,1.90) easeInCubic (drives drawIntroChrome via logoP).

- [ ] **Step 1:** Failing `tests/intro.test.mjs`: veil endpoints (t=0→0.55, mid-flyover≈0.18 band, settle→0.62); zoom monotone single-minimum ending exactly 1.00; `done` false below DUR true at/after; `skip()` sets done immediately; duration constant ===5.0 (assert bounds 4≤d≤6); continuity: |phase(t+ε)-phase(t)| small across beat boundaries (no jumps >0.05 in zoom/veil).
- [ ] **Step 2:** RED. **Step 3:** Implement per beats above. **Step 4:** GREEN + battery. **Step 5:** Commit `feat(app): intro timeline model — pure phase math, skippable`

### Task 3: App state machine (`menuapp.js`)

**Files:**
- Create: `src/app/menuapp.js`
- Test: `tests/menuapp.test.mjs`

**Interfaces:** exact export block from spec §7 (`SCREEN` frozen enum, `ITEMS` frozen list, `createMenuApp(opts)` returning `{screen,cursor,level,sound,render3d,subT,repT,repDir,prevConfirm,update(dt,input),key(code),confirm(),back(),skip(),move(dir),startRun(),noteWorldEdge(prevSt,st,scores)}`). Behavior per spec §1 transition table + §4 input map: cursor wrap (mod ITEMS.length), LEVEL slots 1–5 clamp-no-wrap, confirm rising-edge only (`prevConfirm` vs held fire/Enter), repeat timing first-350ms-then-110ms reading `input.input.{up,down,left,right}`, M-quit valid ONLY in GAME&&world PAUSE (caller passes world state via noteWorldEdge/update contract — machine tracks `inGame` set by startRun), render/sound toggles flip flags without leaving MENU, `key()` handles Enter/Esc/Backspace/arrows-as-tap, subscreen Esc→MENU, startRun builds `{level}` and calls `opts.onStart`.

- [ ] **Step 1:** Failing `tests/menuapp.test.mjs` covering spec §8 row 1 exhaustively: transitions incl. skip paths; cursor wrap both directions; slot clamp at 1 and 5; held-confirm ≠ double-start (advance update() with confirm held across frames); back-stack MENU⇄LEVEL; repeat-rate synthetic-dt test (tap=1 move; hold: move at 350ms, then each 110ms); toggle flips; M ignored unless paused-in-game; noteWorldEdge records exactly once on PLAY→LOSE edge and not on WIN.
- [ ] **Step 2:** RED. **Step 3:** Implement (~180 lines, pure — no canvas/DOM). **Step 4:** GREEN + battery. **Step 5:** Commit `feat(app): menu shell state machine — screens, cursor, repeats, edges`

### Task 4: Input side-channel + audio cues

**Files:**
- Modify: `src/input.js` (add `this.onUiKey=null;` field; `_onKey` first line: `if(this.onUiKey)this.onUiKey(e.code);`)
- Modify: `src/audio.js` (six `play()` cases per spec §5 table: uiJingle/uiMove/uiSel/uiBack/uiTog/uiDenied — jingle guards scheduling behind muted check)
- Test: extend `tests/menuapp.test.mjs` (or sim.test.mjs input block)

**Interfaces:** `Input.prototype.onUiKey` settable; game intent behavior byte-identical when unset.

- [ ] **Step 1:** Failing headless checks: `onUiKey` receives codes before switch (spy collects "KeyQ","Space"); unset ⇒ zero change (existing suite green proves).
- [ ] **Step 2:** RED. **Step 3:** Implement both files. Audio cases are data-only (headless `createAudio` needs window… guard: existing `beep` uses window.AudioContext inside ensure() try/catch — verify createAudio() importable under Node today; if it throws on import, wrap play() body in typeof-window guard consistent with current file style).
- [ ] **Step 4:** GREEN + battery. **Step 5:** Commit `feat(input,audio): UI key side-channel + menu cue sheet`

### Task 5: Menu drawing layer (`menudraw.js`)

**Files:**
- Create: `src/render/menudraw.js`
- Test: extend `tests/r3d.test.mjs` (draw-smoke section)

**Interfaces:** exact exports per spec §7 (`layout(W,H)` frozen; `drawIntroChrome(c,t,W,H)`; `drawMenu(c,ui,L,t)`; `drawLevelSelect(c,sel,L,t)`; `drawHowTo(c,L,t)`; `drawScores(c,scores,L,t)`; `drawDim(c,alpha,W,H)`; `drawFade(c,k,W,H)`). Layout formula + all screen specs verbatim from §2; motion curves imported/duplicated from intro easing table (§3); blink α=`0.55+0.45*Math.sin(2π*t)`.

- [ ] **Step 1:** Failing layout checks for BOTH 600×520 and 608×352: all fields present, integers where specified, in-range (top<H*0.17, itemsY within [H*0.45,H*0.55], footY=H-20, logoScale clamped [0.72,1.0]).
- [ ] **Step 2:** RED. **Step 3:** Implement all eight functions (~220 lines, pure draw, textAlign center default, panel washes rgba(7,10,18,α)).
- [ ] **Step 4:** Proxy-stub-canvas smoke: every draw fn executes no-throw for kind-2d AND kind-3d sizes (pattern from r3d step-7). GREEN + battery.
- [ ] **Step 5:** Commit `feat(render): menu/intro drawing layer — normalized layout, minimal-modern chrome`

### Task 6: Shell integration (`main.js`)

**Files:**
- Modify: `src/main.js` per spec §7 edit-list item 1 (enumerated sub-edits)
- Test: extend `tests/headless.test.mjs`

**Sub-edits (all required):**
1. Flags once; `const app=createMenuApp({level:1,sound:true,render3d:is3d,audio,onStart});` onStart does `loadLevel(world,args.level,false); world.score=0; world.state="PLAY"; app.inGame=true;`
2. Remove `world.state="MENU"` assignments (boot line ~13 and reset()); `reset()` debug hook → `app.toMenu()` equivalent (`app.screen=MENU;app.inGame=false` via exported mutator or re-create pattern — choose smallest).
3. Loop: `if(app.screen===SCREEN.GAME){ fixed-step sim exactly as today } else { app.update(dt,input); }`; render path: `ctx.save(); if INTRO apply introPhase transform (translate center, scale zoom, translate -camX,-camY); renderer.render(world,dt); ctx.restore();` then per-screen `menudraw.draw<X>` calls; GAME keeps existing overlay/hud epilogue.
4. Renderer cache `{2d,r3d}` lazily built per kind; toggle switches cached instance + resizes canvas W/H (600×520 vs PROJ.canvasW/H) before next render.
5. `onPause(code)`: PAUSE+KeyM → `recordScore` wiring (`noteWorldEdge` + `saveScores(recordScore(loadScores(store),{s:world.score,l:world.level,d}),store)` when s>0) then app→MENU; else existing toggle.
6. Score-record edge polled each frame in GAME: `app.noteWorldEdge(prevSt,world.state,scores)` with prevSt latched in main; LOSE insert + persist.
7. `__GAME__`: add `app`; `state()` returns `app.screenName()` outside GAME else `world.state`; `begin()`→startRun. Keep gating (`opts.debug||?debug=1`).
8. Input routing: set `input.onUiKey=(code)=>app.key(code)` always (machine self-disables in GAME except M/pause paths per §4 table); pointerdown already flows to fire intent — add canvas pointerdown listener branch: non-GAME ⇒ `app.skip()/confirm()` per state.

- [ ] **Step 1:** Failing headless checks in headless.test.mjs: `createGame(null,{})` boots with `app.screen===SCREEN.INTRO`; advancing app past intro (skip()) reaches MENU; `onStart` fires → world.state PLAY + screen GAME; `?play=1` equivalent (`opts.autoplay`) lands straight in GAME. (Expose `app` on the returned createGame surface for assertions.)
- [ ] **Step 2:** RED. **Step 3:** Implement all sub-edits. Careful: renderer.render drains events — during MENU the frozen world must still render each frame (keeps fx stable) but consumeEvents on a never-stepped world is harmless (events array only fills from step()). **Step 4:** GREEN + FULL battery (all seven test files). **Step 5:** Commit `feat(app): wire menu shell into main loop — intro flyover, live render toggle, scores, M-quit`

### Task 7: Acceptance sweep + memory

**Files:**
- Modify: `MEMORY.md`, plan checklist only

- [ ] **Step 1:** Verify spec §9 criteria 1–15: automated ones via battery; grep purity check `grep -rn "screen\.\|cursor\|app\." src/core/ src/net/` returns nothing new; `git diff main...HEAD -- src/core/ src/net/` shows no logic deltas.
- [ ] **Step 2:** Manual-only items compiled into user checklist (visuals, audio timbre, skip feel, ?render=3d flyover framing).
- [ ] **Step 3:** Append dated MEMORY.md entry; commit `docs(memory): menu/intro shipped`

---

## Self-Review

- **Spec coverage:** §1→T3/T6 · §2→T5 · §3→T2/T5 · §4→T3/T4/T6 · §5→T4 · §6→T1 · §7→T4/T5/T6 · §8 rows→T1–T6 tests · §9→T7. Gaps: none found.
- **Placeholders:** none — all logic pinned in-plan or verbatim-pinned in traveling spec (coordinate tables intentionally live in spec §2, single source).
- **Type consistency:** `introPhase` fields consumed by T5 chrome and T6 transform match T2 production; `SCREEN.GAME` referenced consistently; `noteWorldEdge(prevSt,st,scores)` signature identical T3/T6.
