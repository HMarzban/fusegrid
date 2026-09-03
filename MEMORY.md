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

## 2026-09-03 — Docs inherit Heat / Pact / rooms / attract
- AGENTS/README now match CORE/PLUS/MAX, attract CORE+pact=0, `isFinale` overlay, `boomOf`, `pactstore.js`, `scoreEntry`/`noteWorldEdge`, and the parked list.

## 2026-09-03 — Headed QA pass (rooms + persist)
- L6/L7 overlay advances (same `isFinale` as sim); LEVEL SELECT 1–8 after CLEAR; rooms 6–8 looks/themes/booms; #gl 1200×1040 at dpr=2; attract CORE/pact=0; MAX persist writes heat `t`.

## 2026-09-03 — Attract demobot hunger pass
- Same intent FSM: combat cubes (FLAME/BOMB/KICK) hunt beyond Manhattan 8; reachable foes beat spawn-brick nibble; hunger wander aims at a blocked mid-board foe. Soft hearts stay capped. Headed 20s re-watch still useful.

## 2026-09-02 — Attract demobot plays like a casual
- Intent FSM + sticky heading in `src/app/demobot.js`: plant-then-leave (R16), no fuse-hug, floor cubes before far foes, brick plants only if useful+escape. Attract still CORE/pact=0. Headed 20s watch still needed.

## 2026-09-02 — SAND / VOID / CROWN boom tints
- Rooms 6–8 boom now uses `boomOf` (`src/audio/boom.js`): sand dry kick 69, void swallowed kick 40, crown metallic kick 82. Ice/water/arena numbers unchanged; menu/intro/jungle/factory stay default. Music STEP/bass untouched.

## 2026-09-02 — Thermo-nuclear judo (eight blockers)
- One `isFinale`/`ROOM_LOCK`/`ROOM_MAX` (L6/L7 overlay no longer says CLEAR). `scoreEntry` + boolean `noteWorldEdge`. Pact persist left core. Heat/pact tables + `applyPact`. Track tables peeled. Tests split under 1k.

## 2026-09-02 — SAND / VOID / CROWN chiptune themes
- Rooms 6–8 cue sand / void / crown. Distinct STEP and bass roots. Boom SFX stay on the five-theme tints.

## 2026-09-02 — Headed cam/light QA rooms 1–8
- REAL 3D and CLASSIC 2D: frozen rig {az:0,el:0.419,dist:1000} and frozen lights hold. #gl is 1200×1040 at dpr=2. VOID is dark on purpose. No per-biome retune.

## 2026-09-02 — SAND / VOID / CROWN for rooms 6–8
- Appended three palettes. Rooms 1–5 unchanged. Music still wraps jungle→arena. Draw-call 186 stays.

## 2026-09-02 — Score × heat at persist
- Board stores CORE ×1 / PLUS ×2 / MAX ×3 via `heatScore`. Live `world.score` and HUD stay raw. M-quit / Menu / finale now write heat `t` so MAX cannot land as CORE.

## 2026-09-02 — Extra rooms 6–8 after first CLEAR
- Same unlock as Pact. Rooms 6–8 reuse biomes (wrap) and add fast/chaser/rocket on top of the room-5 roster. L5 still finales; L6–7 advance; L8 finales.

## 2026-09-02 — Pact afterburner (LAST / BARE / THIN / SHRINK)
- After first room-5 CLEAR, LEVEL SELECT `1–4` toggles spice that Heat does not set. Attract and locked START stay pact 0. CORE with no toggles stays v6.

## 2026-09-02 — Leftover closeout (shake pins + attract CORE)
- three.test now pins live SHAKE_3D_K 0.09 and boom shake +0.22. Attract demo stays CORE even if shell heat is MAX. 3D bomb pulse pin uses world.fuse.

## 2026-09-02 — Heat grades CORE / PLUS / MAX
- LEVEL SELECT gained a second chip rail. CORE is today’s v6 path bit-identical. PLUS/MAX introduce the next foe sooner and tighten fuse / floor cubes / chase. Attract stays CORE. Scores tag `t` and fold the mark into LEVEL. Audio wrapper now forwards `move(dir,axis)` so ↑/↓ actually change heat in the browser. Audio wrapper now forwards `move(dir,axis)` so ↑/↓ actually change heat in the browser.

## 2026-09-02 — ENEMIES field-guide menu
- MENU gained ENEMIES (SCREEN.ENEMIES=9, after ITEMS): live 2D bodies + name/help/rooms for all 6 FOES. ITEMS stays the cube catalog. HOW TO points at both pages.

## 2026-09-02 — Layered production SFX
- Game cues are stacks now (pitch envelope + noise + filter), not one beep. Kill rises, hurt falls; boom tints with the biome track; unbury `reveal` finally plays. UI timer ABI (jingle 0/120/240/360/480, sel 70ms) unchanged.

## 2026-09-02 — Per-biome chiptune tracks
- Music is a track table now: intro bed, menu AABB identity, and one theme per biome (tempo + roots + voicing). GAME/ATTRACT follow the room; other shell screens stay on menu. Default pump without setTrack is still AABB.

## 2026-09-02 — Menu shell fit + selection
- Padded inset on every overlay; selected row is a rail + drawn caret, not a flush bar. HIGH SCORES derives row pitch from the inner body so all 10 runs and ESC BACK stay inside the plate at 520 and 352.

## 2026-09-02 — Arcade cabinet menu chrome
- Shared plate / kicker / icon-well chrome on MENU, LEVEL, HOW TO, ITEMS, SCORES. ITEMS is now a two-column card catalog (teal keep-rail on permanent pickups). Layout ABI unchanged.

## 2026-09-02 — ITEMS menu + walkable pickups
- MENU has ITEMS (SCREEN.ITEMS=8): icon + name + help for all 12 powers. Brick pickups stay buried until the brick breaks; loadLevel also drops floor cubes on EMPTY tiles so you can walk them up. Re-entry/apply behavior of each power is unchanged.

## 2026-09-02 — Plant-and-leave in 1-tile corridors
- Off-center plant was a soft-lock: bomb zone rejected recentering and the pillar AABB ate the held axis. On-tile bombs now skip solidity; `moveEntity` lane-slides toward tile center so hold-escape works (R16/b/c). Re-entry after leaving the tile is still blocked.

## 2026-09-02 — Feel + pillars + biome atlas + finale
- Tracks A/B/C landed: stacked boom shake/flash + kick/throw/remote SFX; interior WALL pillars, floor pickups, staged roster, L5 FIRE → menu; per-level 3D atlas/fog and 2D teal hero / CLEAR copy. Replay baseline v6. Attract bot now stays out of a live blast pocket. `three.test` still pins shake 0.06/0.3 (live 0.09/0.22); file edits were gated.

## 2026-09-02 — Menu SOURCE + share-card review
- MENU has SOURCE (opens github.com/HMarzban/fusegrid); toolbar Source link; footer shows the repo path. Share preview fails on the no-slash Pages 301 (no OG tags); share `…/fusegrid/` with the trailing slash.

## 2026-09-01 — SEO + social preview
- Pages now has title/description/canonical, Open Graph + Twitter large card, og.png 1200x630, apple-touch-icon, robots.txt, sitemap. Repo README shows the same card.

## 2026-09-01 — 3D camera frames the full board
- Default rig dist 800→1000. sizeCanvases no longer assigns #gl width/height (Retina 2× buffer was cropped to the bottom-left quarter). START resets the 3D rig; wrapper re-syncs setSize when the buffer drifts.

## 2026-09-01 — GitHub Pages + public basics + DIRS4
- Static Pages deploy (relative favicon, .nojekyll, Actions workflow). MIT LICENSE, README play link, FUSE/GRID spec copy. Enemies wander DIRS4 (COULD 6); replay baseline v5. Local ancestor branches deleted after push.

## 2026-09-01 — Public rename to Fusegrid
- GitHub is https://github.com/HMarzban/fusegrid (public). In-game wordmark is FUSE/GRID; title, README, package name, and serve log match. Local folder stays rollblock.

## 2026-09-01 — Leftovers + five-biome looks
- COULD 7: survive no longer wipes bombs/blades. 2D boot no longer statically imports Three (loadRenderer3D + opts.createRenderer3D). applySnapshot removed. Favicon.svg. Five biomes JUNGLE/ICE/FACTORY/WATER/ARENA (no L5 wrap). Iso stays museum via ?render=iso.

## 2026-09-01 — Headed play-verify + Restart label
- Closed the 3D follow-up: S2 iFrames guard so live-sim detonation measures blades (three.test THREE OK); headed 3D HUD/orbit/overlay/RENDER toggle/own-bomb hurt all checked. Restart-from-PAUSE now resets the Pause label (F3 assert). Battery 15/15. Still no commit.

## 2026-09-01 — Production hardening campaign (prod/hardening)
- HoE staff review locked findings, then a file-owned fleet: sim rules v4 (center-tile blast, no abort-on-death chain, checkContact alive, place via world.fireEdge, throw refuses enemy tile), 3D shared rig + DOM HUD + overlay clear, applySnapshot pid quarantine, AGENTS.md truth, camera spec amended to polar el 0.419 / dist 800. Replay baseline **v4**. Not internet MP; serve.js stays loopback. `ui/bookshelf/` quarantined (not this game). Left: headed play-verify of toggle/HUD/orbit.

## 2026-08-26 — Enemy identity 3D shipped (b4f2c8a RED + eeb38d6 GREEN)
- Spec 2026-08-25-enemy-identity §2/§4/§5/§6 executed: rocket upright 3-sided pyramid (no pre-rot) + pad + flame swap @10Hz; boomerang FLAT C-torus arc 4.7 + hub/bead + slot yaw override (t*10)%2π; trio Phong60 w/ baked scales (chaser tall+crest/snout, fast low+MERGED fins(72idx)+trail .30) + walker feet stomp; stationary #2a1030 shell + core cube + slit-plane z r*1.16 + breathe; big tilted face planes via new GF/EYR tables; boldened eyes + slit painter. GD/EH/EYT/GF/EYR exported (§6 probes required). Δdraws=0 → 186 ≤500 across 6-type mix. Battery 15/15, three.test 189/0. Interpretations in task-report-enemy-id.md (walker-only stomp; core fully enclosed at literal sizes). Left: §7 browser screenshot smoke.

## 2026-08-26 — Enemy-identity 3D spec written (docs/superpowers/specs/2026-08-25-enemy-identity.md, read-only session)
- Root insight: 2D view is TOP-DOWN ⇒ sprite = from-above footprint; spec mandates footprint-first redesign (rocket = upright 3-sided pyramid nose-up — old cone's rotateX(π/2) was the side-lying bug; boomerang = FLAT C-torus + white hub, spin yaw t*10 overrides facing). Blob trio: Phong gloss + big tilted face plane + per-type baked scale (chaser tall+crest, fast low+fins/trail); stationary keeps square + slit. Children contract (length===3, eyes last) preserved via geometry merge trick; Δdraws=0 (186≤500). Scope when implemented: entities.js/textures.js/three.test.mjs only.

## 2026-08-26 — RULES OVERHAUL complete: bombs tile-solid, sliding kick, chaser BFS routes bombs — DETERMINISM BASELINE v3
- Canon per spec 2026-08-25-rules-audit §3 MUSTs: bombs are tile-solid for player+non-pass enemies with own-tile walk-off/no-re-entry exemption (board.js bombsBlock); kick = real slider replacing brick-break (launchSlider/advanceSlider, KICK_SPEED=4.5, halts on WALL/BRICK/bomb/enemy, fuse ticks mid-slide, chain intact); bfsNext(blocked) + chaser/fast route around live bomb tiles (pass types exempt) + corner-escape rescan when a bomb zone bounces a lane-transition step (pixel-vs-tile deadlock). RED→GREEN R1–R9 in sim.test.mjs (R8b/R9 discriminated pre-fix HEAD; R8b needed the escape-rescan beyond naive BFS gating). Battery 15/15. REPLAY BASELINE v3: validity begins at 59e06c0 — rng draw sequence may shift (escape rescan consumes extra draws on bomb-zone bounces).
- Commits d12b0bc + 8ff0476 (prior session, legs 1–2), 59e06c0 (leg 3 this session), memory commit follows. SHOULD 5 / COULD 6–7 skipped by scope; report .superpowers/sdd/2026-08-25-polish/task-report-rules.md.

## 2026-08-25 — 3D ELEMENTS REDESIGN shipped (d1bb0cb): pickups, glossy bombs, silhouettes, flame crosses
- Spec 2026-08-25-elements-redesign §2–§5 executed RED→GREEN (24 fails→173 checks OK): items = capsule-box pickups w/ all-face glyph textures + additive POWER rings; bomb = Phong #15181f shininess110 sphere (highlight child deleted) + variant base TORUS hues (normal hidden, body never recolored); enemies get eye strips children[2] + chaser visor wedge/fast swept fins/rocket ID tip; player = bomberman stack (sphere body+π/2 dome+open visor band+antenna); blasts = crossedQuads(8v/12idx) Basic additive fire-ramp (emissive purged); 4 new texture painters ×12/×6/visor/fire, atlas `_shared=true`. Fat-world formula 138→186 ≤500. Scope=3 files only; battery 15/15. Interpretations in task-report-elements.md (rocket=[fin,ID-tipCone], item slot origin at floor). Left: manual browser smoke of §6 acceptance 1–7.

## 2026-08-25 — Camera overhaul + toolbar Menu button (5de5b0d..24c1295)
- Fixed full-board rig DEF={az0,el1.152,dist700}, DIST band 500–880, flythrough re-keyed (BASE 700, az 0, el 1.28→1.152 snap); free-orbit demoted behind ?orbit=1 via NEW mountOrbitCtl getDolly gate (wheel/pinch stay always-on, right-drag opt-in), g.rig getter added; btnMenu after Restart = GAME-gated KeyM-quit clone (persist-if->0, quitToMenu("PAUSE"), label reset, blur). RED 20 fails → GREEN, battery 15/15, core/net untouched. Left: manual browser smoke of §5 checklist. Report: .superpowers/sdd/2026-08-25-polish/task-report-cam-menu.md

## 2026-08-24 — 3D overlay fix (83561ff): WIN/LOSE/PAUSE now paint the 2D layer in kind 3d
- wrapper.js render tail: state-gated drawOverlay(ovCtx,world) (defaults already 600×520 classic space) + updateHud(hud,world) routed like kind 2d ({hud:false} suppresses); chips stay opt-in and draw after the veil; MENU excluded (shell owns menus). RED→GREEN: new S5.overlay section in three.test.mjs (8 checks), battery 15/15.

## 2026-08-24 — REAL-3D S4 art pass shipped (bc2d554..550991d): hero/enemy silhouettes, layered blasts + flash pool, HUD chips, checker+trim
- User critique "elements not game-like" fixed: player = 7-mesh hero (capsule/helmet-sphere/atlas-textured visor/antenna/boots), enemies keep S2.F base-geometry contract + 2 ref-swapped detail children per type (feet/nose/trail/turret/wings/fins) w/ per-type bob, boomerang wing pinwheel; bombs gain highlight blob + metal cap (children[0]/[2] indices preserved); blades = outer(exact prior ttl contract, biome.brickHi-tinted emissive)+white-hot additive core w/ spawn overshoot pop 0.88→0.55sc; FLASH_CAP=3 pooled PointLights ride blast centers; drawHudChips (hearts ≤6 + "+n", BOMB/FLAME icon chips, menudraw palette) opt-in ONLY via main's GAME-screen {hud:true} — wrapper clears overlay first, menus byte-untouched; scene adds checker InstancedMesh (instanceColor floor0/floor1) over kept plane + 4 wallHi trim rails. RED raced clean (102 prior green), GREEN 136 checks incl. exact 138-call fat-world budget ≤500; battery 15/15; core/net/input diff=0. Test-side fixes: recorder gradient chain, HUD_STUB quadraticCurveTo, compose/decompose scale tol 1e-6. Left: browser smoke (art feel, DPR crispness); 3D PAUSE/WIN overlay still absent (pre-existing). Report: .superpowers/sdd/2026-08-24-real3d/task-report-S4.md

## 2026-08-24 — REAL-3D S3 shipped (1119bc7): fx particles, intro flythrough, attract-3D, perf gate
- three/particles.js PART_CAP=384 Points pool consumes getFx() store (drawRange-culled, additive ttl-dim vertex colors, confetti sky-rain rule), hooked at wrapper scene ROOT so rebuilds never orphan bursts; entities.js blades got emissive pulse curve (.8→1.0→.36 off freshest sc) + spark now Basic glow w/ exact 2D flicker parity 1±.23sin(30t); three/flythrough.js pure introCam(subT) dist=560/zoom endpoints snap to rig defaults, main passes {intro:subT} only for INTRO∧3d; shake proven end-to-end deterministically (Math.random stub .75 → ±1.275px → quaternion shift); scene.countDrawCalls + non-enumerable wrapper._dbg keep surface keys frozen — fat world = 79 calls ≤500, DPR_MAX=2. RED raced process.exit until top-level await sec(); test-side bugs (stride-3 color index, root-vs-traverse find, confetti Z=−270) fixed on GREEN pass. 102 checks, battery 15/15, core/net/input diff=0. Left: browser smoke (flythrough feel, DPR, mobile fps). Report: .superpowers/sdd/2026-08-24-real3d/task-report-S3.md

## 2026-08-24 — REAL-3D S2 shipped (0fc3a05): entity/item/bomb/blade pools + zero-asset textures
- three/entities.js createPools: visibility-toggled fixed slots player1/enemies16/bombs8/items32 + blades ONE InstancedMesh cap528 (16×33 tiles; deviation from 16-groups documented — arms-only parity w/ 2D drawBlades, ttl scale fade); per-type geos (sphere/box/torus/cone tip+Z), identity colors imported from core spawnEnemy table (no core edit); bomb pulse/tint/spark-parity mirror drawBombBody exactly; update() zero-alloc (scratch mats, ref-swap, `_shared` flag exempts pooled resources from disposeGroup). three/textures.js atlasSources/buildAtlas: 64² captures of existing sprites fns via new captureSprite helper (sprites otherwise untouched), NearestFilter+sRGB, headless⇒null⇒flat Lambert fallbacks. wrapper lazy getAtlas→buildScene(world,atlas). RED(module-missing)→GREEN 74/74 checks (was 36) incl. live-sim detonation count-vs-blast + fs grep gate core/net/input three-free; mutation spot-check bites. Battery 15/15 files. Left: browser smoke (pickup/detonation/texture crispness). Report: .superpowers/sdd/2026-08-24-real3d/task-report-S2.md

## 2026-08-24 — REAL-3D S1 skeleton shipped (1b53a41..aabd953): vendored three + dual-canvas tri-state
- src/render/three/{scene,materials,lights,camrig,wrapper}: buildScene instanced walls/bricks (X=x−300/Z=y−260, in-place rescan, level-rebuild flag), frozen §6 light rig, orbit/dolly/reset + GAME-gated mount, createRenderer3D {canvas,overlay,ctx,render,consumeEvents,getShake} with headless stub mode; main.js tri-state 2d/3d/iso (?render=3d|iso), RENDER toggle REAL 3D⇄CLASSIC 2D, #gl under #c, flyover+camTransform gated to non-3d, KeyR resets orbit; renderer.js "iso" alias. Drive-by fix: g.renderer now a live getter (was boot-time stale copy). RED→GREEN 36 checks (tests/three.test.mjs), battery 15/15 green, sim/net/input/core diff=0. Left: manual browser smoke (shadows/orbit/iso-parity/DPR). Report: .superpowers/sdd/2026-08-24-real3d/task-report-S1.md

## 2026-08-24 — Camera control shipped (bccb0b4..3cbdcef): GAME-only pan/zoom/reset
- cameraCtl.js pure math (anchor pan1=d−(z1/z0)(d−pan0), clampAxis degenerate→0, wheel exp(−ΔY·.0015), pinch ratio, transform triple); input.js button≠0 fire-guard; main.js cam closure + mountCameraCtl (GAME-gated, getKind follows RENDER toggle), KeyR/onStart reset, outer transform in GAME branch only — renderer/core/net diff 0. Battery 14/14 files, camera 37/0, headless +12 checks (f/g/h incl. exact drag deltas + MENU-frame triple-absence). Left: manual browser/device smokes per spec §5. Report: task-report-CAM.md.

## 2026-08-24 — V1.1 polish pack (82a0f00..1f465aa): music B-section, __audio gate, toggle-flash, canvasEl warn, serve test fixes
- Music loop now AABB (MUSIC_PATTERN_B D–C–Bb–G + MUSIC_SECTIONS, pump selects per stepN — tests derive t0 from first start since unlock anchor may clamp once); menuapp togT stamp (-1 sentinel, cleared at every subT reset) drives drawMenu's 120ms accent glow on the selected value row; distinct opts.canvasEl now console.warns once (C1 swallow stays render-canvas-bound by design); serve.test dropped decoy dir + awaits child exit before rmSync; fx.js header documents single-renderer singleton. RED→GREEN areas 1/3/4; battery 13/13 green. Left: manual ?debug=1/__audio, flash-feel, A/B listen smokes. Report: .superpowers/sdd/2026-08-23-campaigns/task-report-POLISH.md

## 2026-08-24 — Micro-polish: unlock-gated jingle, attract-exit fade pinned, dead imports
- P1: boot uiJingle now defers to first gesture via fireJingle latch on unlockOnce (suspended ctx froze all 5 oscillators into a chord-blob); I1 test re-pointed to deferral + new window-stub block proves once-only post-unlock firing; drive-by: main.js debug hook `location` guard aligned with file's own typeof pattern (latent headless crash). P2: ATTRACT→MENU veil already rode _push(MENU) subT reset — probe+regression test pinned (k≈0.94 frame-1, settles ≤0.73), zero prod change. P4: demobot tileOf/solidAt imports removed (bfsNext kept) + fs grep gate. Headless 59→66 checks; battery 13 files green.

## 2026-08-24 — Music+attract fix round F1-F3 (ea3b42d): clamp, duck-aware unmute, GAME-gated toolbar
- audio.js pump catch-up clamp (hidden-tab gap → ONE step @now+0.05, was 61-step burst) + toggle() restores ducked?MUS_DUCK:MUS_BASE (old "unmute→0.5" test superseded); main.js btnPause/btnRestart onclick early-return unless GAME (restart was wiping live backdrop during ATTRACT; in-GAME behavior byte-identical). RED→GREEN: music 39/0, headless +6 checks, battery 13 files green. Report: task-report-D.md fix section (.superpowers gitignored, on disk).

## 2026-08-23 — Music + attract mode shipped (34b3ca8..598c903): chiptune loop, demobot, idle demo
- audio.js: MUSIC_PATTERN (entries carry `s` — spec snippet dropped it; also fixed its paren typo), frame-pumped lookahead on ctx.currentTime only, duck 0.5↔0.16 @.35/.6s, toggle=single mute gate; demobot.js per §2 (flee BFS must walk THROUGH danger tiles or corner bots freeze; state setter added for purity test); menuapp ATTRACT=7 + IDLE_T=10 + guards; main demo harness seed 20260823 cycles 1..3 cap 20s, {hud:false}, window-once unlock, #stage exits but toolbar doesn't; EXTRA idleT resets in startRun/_toMenuInner else stale ≥10s idle instantly re-enters ATTRACT after M-quit. Music 37/0, demobot 21/0, menuapp 108/0, headless +16, battery 13 files green. Report: .superpowers/sdd/2026-08-23-campaigns/task-report-D.md. Left: manual browser/device smoke (§6 MANUAL list).

## 2026-08-23 — Netcode fix round F1-F4 (76bfd8a): seq-first, neutral LEAVE, pinned codes, fail-closed decode
- F1: onInput classifies dup/stale/gap BEFORE tick floor; fresh seq consumes ledger slot even when payload dropped (below-floor drop no longer freezes lastSeq → recovery traffic can't fabricate bad_seq halts). F2: LEAVE is neutral — hurtPlayer removed, survivor keeps lives/score. F3: ERROR_CODES pinned {bad_seq,bad_seed,bad_shape,unknown_pid}, makeError coerces, bad_host/bad_tick folded to bad_shape, WELCOME invalid → bad_seed+close. F4: decode never throws (null), capsOk §4.3 ≤64 deep cap, WebSocketTransport._onmessage guarded boundary + _validate hook (v2). Spec A1-A3 (+§2.3 corrected to neutral). RED→GREEN: net_lockstep 59/0, protocol 15/0, full battery 11/11.

## 2026-08-23 — Netcode lockstep v1 shipped (d3e1bcc..1d2f325): gates, two-world proof, ?net=local
- protocol.js WELCOME/PAUSE/RESUME/RESTART/MENU/ERROR + validateInput/validateWelcome fail-closed
  gates (seq dup/stale/gap classes, u31 seed, DELAY=2 window; windowLen=Infinity buffer mode for
  catch-up); new net/lockstep.js (stall/no-advance, stallEvent@30, pid-ascending consume, LEAVE→
  hurtPlayer+leave event+unknown_pid halt, host RPCs at tick alignment); LocalTransport.dropped;
  main.js ?net=local dual-peer harness (flag-off byte-identical). Proof: sameWorld replica +
  meta-paced settle barrier, 52 checks incl. lag/blackout/dup/gap/leave/pause cases. ⚠️ Spec file
  2026-08-23-netcode-lockstep-design.md MISSING from repo despite f5d4269 message claiming it —
  implemented from task brief; report: .superpowers/sdd/2026-08-23-campaigns/task-report-C.md.

## 2026-08-23 — Renderer v2 independent review (fd18448..ea6b250): Approved, §3 deviation ACCEPTED
- Independently reconstructed depth-0 counterexample (board.js:15 border wall
  @(0,0)=BLOCK@d0 vs player shadow @d≈2.x ⇒ global lastShadow<firstBlock chain
  impossible under depth-primary byDepth; shadow-special comparator proven
  non-transitive via 3-cycle block<d22/entity>d25/shadow) → per-slot invariant
  is the correct spec reading; §3/§6 need one-line amendment. Hand-recomputed
  diamondTransform {a:.5,b:.25,c:-.5,d:.25,284,124} ✓; tiers/literals/camera-
  frozen/bakeAtlas-guard/additive-sprites all verified; battery re-run green.
  Flagged: spec §5.4 "sprites.js NO CHANGE" self-contradicts §2 (BAKED not
  exported — accessor unavoidable); BIOMES elements shallow-frozen only.

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
## 2026-08-23 — Campaigns trio shipped on campaigns/touch-render-net
- A touch pad (fd18448, multitouch move+bomb via Input pipeline, 39 checks) · B renderer v2 (ea6b250, affine diamond tops + caster-slot shadows after spec-chain proven unsatisfiable, biome heights, 67 r3d) · C lockstep v1 (d3e1bcc..35b8572, seq-first windows, neutral LEAVE, pinned codes, fail-closed decode, two-world proof 59 checks; ?net=local). Specs committed incl restored netcode doc.
## 2026-08-24 — ENGINE DECISION REVERSAL: Path A vendored Three.js approved by user
- User judged dimetric 'not really 3D' and game elements 'not game-like'; explicitly approved vendored three.module.js (no npm, no build, MIT) + keep 2D fallback. Sim/protocol/tests untouched by design. Dimetric demotes to ?render=iso legacy. Branch campaign/real3d. This supersedes the 2026-08-16 zero-dep-renderer lock for the RENDER LAYER ONLY — sim purity invariants unchanged.
## 2026-08-25 — Black-screen 3D toggle bug root-caused + fixed (56c6db5)
- #c 2D context first-call-wins: boot 2D renderer claimed {alpha:false}; 3D overlay then inherited the OPAQUE context → clearRect composited black over #gl (toggle-path black screen; boot ?render=3d unaffected). Fix: main pre-claims #c ctx {alpha:true} before any renderer + regression tests (getContext order, live __GAME__.renderer — was a stale boot copy, now a getter). Repro'd+verified via Playwright (headed Chrome DPR2, WebKit DPR2): toggle→3D green, toggle-back→2D green.
