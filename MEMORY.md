# MEMORY.md

Episodic log — dated, append-only notes of what a session/agent did, decided,
or left for the next person. Newest first. One or two lines per entry.

This file is auto-loaded by opencode (see `instructions` in `opencode.json`)
and is a standing instruction target: `AGENTS.md` requires every session to
append an entry when it makes a non-trivial change.

## Format

```
## YYYY-MM-DD — <one-line subject>
- what changed / decided, and why (or: what was left open for later).
```

## Log

## 2026-08-23 — Renderer v2 polish shipped: textured diamond tops + shadow tier + biome heights
- scene3d: TIERS renumber (F0/S1/E2/B3/L4), diamondTransform (spec §2 vector
  pinned), heightFor (BIOMES hWall/hBrick ?? PROJ; J24/14 I30/18 F18/10 A26/15),
  blockPainter affine-textured tops w/ per-call smoothing, lazy 64px radial
  shadow disc (blocks .22 bbox-inscribed, entities .26 rx*0.5 squash); renderer
  bakeAtlas unconditional + noop ctx transform; sprites additive bakedTile()
  accessor only (2D draw fns untouched); camera.js byte-frozen. RED→GREEN r3d
  67/0, full battery green. DEVIATION (documented in test #16): spec §3's
  GLOBAL shadow-band chain is unsatisfiable with "byDepth untouched" +
  "shadow.depth=caster depth" + v1 depth-interleaved occlusion (depth-0 border
  wall vs spawn entity) → shadows ride caster depth slot (floor<shadow<upper
  per slot pinned instead); far-behind fringes = accepted stylization.

## 2026-08-23 — Touch controls independent review (fd18448): Approved, spec ✅ §1-§7
- Verified vs spec+report+diff: routing purity grep-clean (setIntent/padFire
  only; input.js strictly +3, keyboard byte-identical), pid bookkeeping sound
  (up/cancel/lostpointercapture idempotent), C1 intact (main.js:135 swallow is
  pre-existing), GAME-gate survives M-quit/LOSE/WIN both ways, [hidden] not
  overridden by author CSS, scope = 5 files no core/net/ui. Re-ran touch 39/0 +
  full battery green. Minors: capture-fail stuck-axis on ancient WebViews,
  same-pid dual-claim API edge, move-through-dead-center untested. Cannot
  verify: real-device manual list (latency/safe-area/ghost-click/fit).

## 2026-08-23 — Touch controls shipped (fd18448): virtual pad via Input pipeline
- src/touch.js (hasTouch/PadMapper/mountTouch; per-control pid claim, 4-way
  cross zones w/ 20% dead center, setIntent/padFire-only routing, zero canvas
  listeners), input.padFire, main.js touch.update(GAME gate), index.html
  #touchpad skeleton+CSS. RED→GREEN: touch 39/0; full battery green (sim 29,
  menuapp 93, r3d 51…). Left open: real-device manual smoke (latency/safe-area/
  iOS ghost-click) per spec §6 MANUAL list.

## 2026-08-23 — Menu/intro FINAL FIX WAVE (C1/I1/I2/I3) — all four fixed, 9/9 green
- One commit: pointer single-fire (non-GAME pointerdown swallows Input's fire
  latch; _attach now registers el listeners headless so C1 is testable), cue
  sheet live via main.js app-method wrappers (move/back/confirm/tog + boot
  jingle), onPause gated to GAME (ghost pause dead), keydown repeats filtered
  before dispatch. menuapp 93/0, headless +15 checks; core/net/ui untouched.

## 2026-08-23 — Menu/intro FINAL whole-feature gate: NOT-READY (C1/I1/I2/I3)
- Proven at HEAD: pointer confirm double-fires (direct call + fire-latch rising
  edge) → intro click-skip auto-starts run, RENDER/SOUND clicks net no-op,
  subscreens bounce; ui* cue sheet has ZERO callers (jingle never fires, §0.4);
  Esc/P/btnPause outside GAME flip hidden world→PAUSE (ghost overlay behind
  menus); OS key-repeat unfiltered breaks AC6 cadence in browsers. AC table
  11✓/2✗; six deferred minors re-triaged DEFER. Fix list + repro recipe in
  session log; core/ still untouched, suites 9/9 green.

## 2026-08-23 — Menu shell fix round 2 (4aeaa3b): intro natural end
- main loop now auto-calls app.skip() (machine's own transition) when
  screen===INTRO && subT>=INTRO_DUR — spec §1 t≥DUR + §9.1; fade path shared
  with user skip. Headless 14→15 (330 frames no-key → MENU). All green.

## 2026-08-23 — Menu T5/T6 fix round 1 (2062af8): MENU logo + skip fade
- F1: drawShell MENU branch now translates/scales to L.logoCy/L.logoScale and
  reuses scenes.drawLogo(c,world.time,0,0). F2: drawFade wired — extra veil
  k=1-subT/0.25 over first 0.25s of MENU entry (covers skip + natural end).
  Headless 11→14 via recording-proxy canvas (fillText/fillStyle spy). All green.

## 2026-08-23 — Menu/intro T5+T6 independent review (954208e..319f217)
- T6 Approved/spec✅ (all sub-edits verified, core diff=0, battery green; KeyM-wrapper +
  PLAY-repoint + last==null fix judged sound). T5 Needs-fixes/spec❌: MENU screen never
  draws the §2 logo (drawShell MENU branch = dim+items only); minors: drawFade unwired
  (no skip fade), push/pop+toggle-flash absent, veil ramp [1.40,2.80] vs spec-text
  [1.40,4.20] (pre-existing T2, byte-consistent dup).

## 2026-08-23 — Menu/intro T5+T6 executed (menudraw layer + main.js shell; f0c34b6..319f217)
- `f0c34b6`: src/render/menudraw.js (layout frozen, 8 draw fns, local easing dup,
  mono-advance estimate) + r3d layout/smoke checks both sizes (51/0). `319f217`:
  main.js shell wiring — app/onStart, PLAY-frozen backdrop, INTRO flyover
  transform (introPhase fractions), per-kind renderer cache + live toggle resize,
  onUiKey M-quit persist, frame-latched noteWorldEdge LOSE record, __GAME__
  app/state/begin re-point; headless 2→11. Fixed latent `if(!last)` t=0 bug.
  Left: manual browser smoke (visuals/audio/skip/3d flyover).

## 2026-08-23 — Action fixes: remote edge-latch, button blur, hint copy (18c2412..3c68ac2)
- Q/remote was latching (no KeyQ keyup) and level-triggered in sim; fixed with
  world.remoteEdge beside fireEdge (same alive-gated discipline, not reset in
  loadLevel — matches fireEdge). RED 27/2→GREEN 29/0; all suites green.
  btnPause/Sound/Restart blur after click; hint marks throw/remote/kick as
  power-gated. Left: manual smoke (button focus+Space, Q feel); ui/ untracked.

## 2026-08-23 — Debt sweep executed (6 parked findings, 852a9c9..c30f377)
- One commit per area: sameWorld full-field comparator; input pointercancel/
  pointerleave + strict document guard + public-getter tests; serve.js root→404
  (GET / still serves index) + single normalize; renderer strict kind + BIOMES-
  length bake + spec fx.js:73 ref; r3d split wall/brick tier-2 counts + blade
  translate exactly-once; runSteps fireEdge functional. All suites green.
  Report: task-report-debt-sweep.md. Left: touch-device manual smoke.

## 2026-08-23 — T21+T22 executed (dual-kind render smoke + P5 dead-code sweep; P4/P5 shipped)
- `289ba27`: r3d #11 renders MENU world via createRenderer kind:"2d"+"3d" on Proxy-stub
  canvas (spec §6 step 7), 31/31. Sweep commit: deleted POWER_BY_TYPE, audio.prime/isMuted,
  transport MSG re-export+import, world.lastBlades, unused imports (sim isBrick/solidAt;
  enemies key/clamp/aabb/DIRS4-import; board clamp), main.js dup imports; biomeIndex
  %4→%BIOMES.length; __GAME__ gated behind opts.debug||?debug=1 (browser_integration passes
  {debug:true}). All suites green; kept net/, rng accessors, BIOMES[].name, dual paint path.
  Left open: manual npm-start browser smoke (sound toggle/?debug=1); ui/bookshelf untouched.

## 2026-08-23 — T19+T20 executed (?render=3d wiring + parameterized overlays; blade billboard pre-work)
- `7b602a0`: main.js ?render=3d → PROJ backing store + kind:"3d"; renderer 3D
  branch live. Controller pre-work done RED→GREEN: drawBladeBody now
  translate-free (translate in 2D wrapper), scene3d blades billboard at
  project(tx+.5,ty+.5) — new r3d check #10 proves (284,98). `2b75e97`:
  drawOverlay/drawLogo parameterized (2D-preserving defaults), 3D epilogue
  centers overlay at (304,188). All suites green per commit. Left: step-7
  dual-kind smoke test; browser visual check. Report: task-report-t19-t20.md

## 2026-08-23 — T18 executed (scene3d painter list + shade/background + step-4 tests)
- `994923d`: buildPainters/byDepth/shade/draw3dBackground per §4.3/§4.4; blade painter
  calls drawBladeBody with NO pre-translate (self-translating body) — but body still
  lands at flat 2D coords, so projected-position mismatch deferred to steps 5–7.
  r3d suite 28/28 (counts, liveness exclusions, equal-depth occlusion, shade), full
  suite green. Report: task-report-t18.md

## 2026-08-23 — T17 independent diff review: PASS with one forward-compat flag
- Verified exhaustively (normalized line-multiset + per-body extraction vs 0f028d7):
  bodies verbatim moves, only wrapper scaffolding added; exports/scope/tests clean.
  Flag for steps 4–5: drawBladeBody self-translates to absolute tile coords (not
  translate-free like the other four) — scene3d must not pre-translate or blades
  render far off-position; step-7 no-throw smoke would NOT catch it.

## 2026-08-23 — T17 executed (draw*Body extraction; 2D wrappers behavior-preserving)
- `150661d`: five exported body fns in sprites.js (verbatim line moves, ws-insensitive
  diff verified); drawPlayer loops world.players internally (skip alive===false, §4.3
  round-5), renderer call site collapsed to one call; enemy bob + per-blade alpha=1 stay
  in wrappers. Suite green. Note: alive-filter edge (undefined) now draws — unreachable
  with sim's boolean alive. Report: task-report-t17.md

## 2026-08-23 — T15+T16 executed (renderer kind adapter; dimetric camera PROJ + tests)
- `5dc4871`: createRenderer takes opts.kind (default "2d", bakeAtlas gated), shared
  prologue/epilogue per §4.4, empty 3D stub; 2D default unchanged. `0f028d7`:
  src/render/r3d/camera.js (project + frozen PROJ derived from §4.5 formulas) and
  tests/r3d.test.mjs (10 checks: corner map, bbox/margins, monotonic sy, margin eqs).
  RED→GREEN observed; full suite 6/6 files green. Report: task-report-t15-t16.md

## 2026-08-23 — T9 fix-round-1 re-review: F1/F2 ADDRESSED, deviation upheld
- Independently reproduced RED at e84d3b9 (3 seeds unequal, DIRS8 mutated) and GREEN
  post-fix; probe counted 5–8 real AI-decision executions/seed in 1800 ticks. Residuals
  flagged non-blocking: sameWorld still omits player tx/ty/bombs/iFrames/shield, enemy
  cd/invulnT/speed, w.winTimer; harness self-proof label satisfied by bounce flips too.

## 2026-08-23 — T9 fix round 1: deepened harness caught shared-DIRS corruption
- `e.dir` aliasing frozen DIRS4/DIRS8 literals fixed by copying candidates on assignment (`e56eadf`, enemies.js:46).
  Correction: replay/outcome validity begins at e56eadf (contamination altered outcomes even in pristine runs); rng-draw-sequence stability from e84d3b9.

## 2026-08-23 — T9–T13 adversarial review (determinism purge)
- Verified: substitutions semantics-exact (21k-case fuzz, 0 diffs), purity gate clean (broad grep), commit scopes exact. Found: replay harness fires ZERO enemy-AI decisions in 300 ticks (cd init ≥4s) so T13's branch is unexercised; sameWorld omits player pos/bomb timers/item taken. Fix when touching harness next.

## 2026-08-23 — Determinism baseline v2
- Purged transcendentals from sim (squared distances, integer substeps, render-only bob),
  deduped enemy candidate dirs. Replay/outcome validity begins at e56eadf or later; rng-draw-sequence stability from e84d3b9.

## 2026-08-23 — T8 executed (balance tunables hoisted into frozen CFG; pure rename)
- `4329aec`: 12 new CFG keys (CONTACT_R…ENEMY_INVULN_T) replace scattered literals across
  sim/world/entities/enemies — values verbatim, killEnemy ternary left structural. All
  suites green. Note: `tests/determinism.test.mjs` from the plan doesn't exist; replay
  checks live in sim/protocol tests. Report: task-report-t8.md

## 2026-08-23 — T6+T7 executed (input latch/axes fixed; WIN state + win/lose events live)
- `4caea59`: pointer down/up split (_onFireDown/_onFireUp) + setIntent sign fix (routed
  through `input` getter — brief's literal `_held.` crashes fresh headless Input).
  `32e90de`: board clear → WIN+win event, fire edge advances with carry; hurtPlayer emits
  lose. Suite 22/22 sim, all green; browser smoke of overlays left to user.
  Report: .superpowers/sdd/2026-08-23-master-plan/task-report-t6-t7.md

## 2026-08-23 — T4+T5 executed (contact damage via hurtPlayer; chain by blast coverage)
- `041cdec`: checkContact now calls hurtPlayer (shield→hurt event, else life loss); `aad680b`:
  detonate() chains any bomb on a blast-covered tile (was Manhattan-1). Suite 14/14 sim green.
- Two brief-test drifts fixed minimally, documented: T4 needed e.home={x:1,y:1} (stationary
  branch teleports y to home each tick); T5 bomb-A radius 1→2 (radius-1 footprint can't reach
  distance 2 — wall case was vacuous). Auto-advance stayed green; no superseded markers.
  Report: .superpowers/sdd/2026-08-23-master-plan/task-report-t4-t5.md

## 2026-08-23 — T3 executed (serve.js hardened: traversal/400/ACAO/stream/loopback)
- `4893b30`: path.relative containment (kills string-prefix sibling leak — proven 200 TOPSECRET
  pre-fix via raw socket), decode-before-join → 400 on bad %, ACAO:* deleted, stream error→404,
  binds 127.0.0.1 + prints server.address().port for PORT=0. tests/serve.test.mjs: traversal
  checks MUST use raw sockets — fetch/curl collapse ../ AND %2e%2e client-side. Stream-error
  handler untested (race-prone); browser smoke left to user. Report:
  .superpowers/sdd/2026-08-23-master-plan/task-report-t3.md

## 2026-08-23 — T1+T2 executed (replay harness feeds inputs; headless import fixes)
- T1 `e12fbff`: runSteps now applies inputFn output (full map or bare intent); new
  check 1b proves rightward input moves x (was 60 vs 60 vacuous). T2 `84bfc3e`:
  main.js debug globals guarded by `typeof window` (`__GAME__` name kept), renderer
  null-canvas fallback is a real noop ctx — brief's list missed arcTo/bezierCurveTo/
  quadraticCurveTo, added them. Full suite 3/3 green. Report:
  .superpowers/sdd/2026-08-23-master-plan/task-report-t1-t2.md

## 2026-08-23 — Master plan finalized (planning team: architect + test strategist + design calls)
- Wrote docs/superpowers/plans/2026-08-23-master-plan.md: P0 harness/env fixes →
  P1 gameplay bugs → P2 determinism purge (ONE baseline-v2 bump) → P3 fx out of world →
  P4 dimetric renderer (spec steps 1–7) → P5 cleanup. Design calls locked: WIN-state
  routing for level clear (fanfare/confetti wired), audio.prime deleted not wired,
  debug globals gated behind ?debug=1, all balance tunables hoisted to CFG.
- Spec §5.1 (hypot stays) and step-4 fx source amended BY the plan tasks before P4 runs.

## 2026-08-23 — Five-agent codebase review (arch/code-quality/dead-code/tests/security)
- Ran 5 parallel review agents. Verified live bugs: enemy contact damage never calls
  `hurtPlayer` (enemies.js:75 only emits an event); determinism test harness discards its
  generated inputs (sim.test.mjs:17-18, replay tests are vacuous); pointer `pointerup`
  latches fire=true; chain detonation only chains distance-1 bombs (sim.js:170).
- serve.js prefix-match traversal gap (`startsWith(ROOT)` without sep) + `ACAO:*`.
- Open decisions left: wire-vs-delete fx "win" branch & audio.prime; gate debug globals;
  snapshot completeness vs lockstep-only netcode (applySnapshot fabricates enemy dynamics).

## 2026-08-16 — Initialized opencode for rollblock
- Added `opencode.json` (schema + `instructions` + `permission`) and `AGENTS.md`
   (architecture, commands, conventions).
- Established this episodic-memory convention; agents must append here after
  any non-trivial change.

## 2026-08-16 — git baseline commit
- `git init` + `.gitignore` (ignores `.DS_Store`, `node_modules/`, the two
  unreferenced ~5.6MB `Gemini_Generated_Image_*.jpeg` moodboard assets, logs/.env).
- Committed baseline `d3975af`: full deterministic single-player sim + procedural
  render + netcode seam, 16/16 tests passing. Not yet a remote/VCS-tracked branch.

## 2026-08-16 — 2D→3D direction-set (research team, 4 agents)
- Ran a parallel research team (engine landscape / determinism-netcode / architecture-preserving migration / scope-perf-assets). Consensus: "need a heavy engine" is the wrong instinct — the decoupled deterministic `src/core` makes 3D a *renderer* change; a heavy engine (Three/Babylon/WebGPU) buys zero determinism value and breaks the zero-dep + no-build invariants.
- DECISION (user): (1) keep zero-dependency — no Three.js, no build; (2) target option (b) **pseudo-3D dimetric** — tilt camera ~30°, extrude bricks/walls to depth-sorted blocks on Canvas-2D. Touches NO sim/protocol code; all 16 tests stay green. Deferred: option (c) full 3D arena (forces sim+protocol changes; big swing).
- Determinism rule locked: all spatial/visual math stays in the renderer; sim collision/kill/fuse stay keyed to fixed integers; camera is a render-only input stream, never fed to `step()`. Silent-killer noted: any sim float feeding a branch/count (e.g. `board.js:78` `Math.ceil(Math.hypot(...))`) is the ULP desync risk.
- Next: design the dimetric renderer (renderer adapter + camera view + depth-sort + faux extrude/shadow). Implementation gate held pending design approval.
