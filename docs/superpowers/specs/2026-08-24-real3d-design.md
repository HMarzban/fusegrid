# Real-3D Renderer Design (vendored Three.js r160) — 2026-08-24

Path A approved (MEMORY 2026-08-24): vendored `vendor/three.module.js` (r160,
416 exports, MIT header, Node-importable) imported by RELATIVE path; zero-dep
package.json unchanged; sim/protocol untouched. Dimetric (`src/render/r3d/`)
demotes to legacy `?render=iso` (kept, unmaintained); 2D stays classic default.

## §1 Architecture

New module graph (all under `src/render/three/`; relative import
`../../vendor/three.module.js`):

```
main.js ─┬─ kind "2d"  → createRenderer (unchanged, canvas#c opaque)
         ├─ kind "iso" → createRenderer(kind:"iso") legacy r3d path
         └─ kind "3d"  → createRenderer3D(glCanvas, overlayCanvas)
                          wrapper.js ── scene.js (buildScene/update)
                          ├─ entities.js (pools)   ├─ materials.js
                          ├─ lights.js             ├─ camrig.js
                          ├─ textures.js (browser) └─ flythrough.js (S3)
```

DUAL-CANVAS: `#stage` stacks `<canvas id="gl">` (WebGL, bottom) under the
existing `<canvas id="c">` (transparent 2D overlay, top). The overlay keeps the
classic coordinate space (CFG.COLS*TILE × CFG.ROWS*TILE = 600×520) so
menudraw/scenes/fades/HUD draw UNMODIFIED. In 3D kind, `#c` ctx is recreated
`alpha:true`; menus/shell paint there; the 3D scene shows through. `#gl` sizes
to the same 600×520 logical box × devicePixelRatio (clamped ≤2).

Surface contract (wrapper returns): `{canvas:#gl, overlay:#c, ctx:overlayCtx,
render(world,dt,o), consumeEvents(world,dt), getShake}` — same call shapes the
main loop already uses (`renderer.render(attract&&demo?demo.world:world,…)`,
`consumeEvents` drains `world.events` via fx.onEvent + audio, `getShake`
passthrough). Shake = camera-target offset in 3D (§4). Kind strings: menu toggle
flips `app.render3d` ⇄ REAL 3D ↔ CLASSIC 2D only; `?render=iso` forces legacy
`curKind` `"iso"` (tri-state in main).

## §2 buildScene (pure, Node-testable)

`buildScene(world)` → `{group, level, update(world)}` in `scene.js`. Uses only
THREE objects + world reads (verified Node-safe); NO DOM/canvas/time inside;
textures injected, never required.
- **Rebuild rule**: `update` compares `world.level` to `level`; change ⇒ caller
  discards group, calls `buildScene` again (loadLevel / WIN advance).
- **Static-once**: floor plane 600×520 (XZ, centered), permanent-WALL
  InstancedMesh (one matrix per `T.WALL` tile at build), lights, biome
  materials. World→scene mapping: `X = x−300, Y = up, Z = y−260`.
- **Bricks**: one InstancedMesh, capacity COLS*ROWS; every `update` rescans
  grid, writes matrices for `T.BRICK`, sets `.count`, `instanceMatrix.needsUpdate`.
  No mesh add/remove ever.
- **Pools** (`entities.js`): fixed-capacity, visibility-toggled — player(1),
  enemies(≤16), bombs(≤CFG.MAX_BOMBS), blades(≤16), items(≤32); transforms
  written in array order from live entries; unused slots `visible=false`.
  Blades/explosions = emissive boxes scaled by `bl.t/bl.ttl` + Points particles.
- Materials default to flat MeshLambert colors from BIOMES/palette fields ⇒
  tests need no canvas. `materials.build(biome, atlas?)` merges CanvasTexture
  maps when `atlas` supplied (browser only).

## §3 Stages (each shippable: tests green + commit + MEMORY entry)

**S1 skeleton** — files: `vendor/three.module.js` (own commit), `src/render/three/
{scene,materials,lights,camrig,wrapper}.js`, `index.html` (+`#gl`), `src/main.js`
(tri-state), `renderer.js` (`"iso"` alias → legacy branch; `"3d"` never reaches
it). Tests `tests/rthree.test.mjs`: floor+walls instanced counts vs grid scan; light
rig frozen values; camrig math (az/el/dist clamps, reset); wrapper surface keys;
battery green; 2D byte-path untouched. Accept: `?render=3d` lit arena w/ shadows;
orbit/dolly/R work; `?render=iso` identical to today.

**S2 entities** — files: `three/entities.js`, `three/textures.js`, `sprites.js`
(additive capture helper only). Tests: per-entity mesh presence/position vs world
(player/enemy/bomb/item/blade), bomb pulse scale ∝ timer, death ⇒ slot invisible,
brick count drops after simulated detonation, texture path skipped headless
(color fallback asserted).

**S3 FX + cinematics** — files: `three/flythrough.js`, fx hooks in wrapper. Tests:
explosion particle spawn counts vs blade.tiles, emissive scale curve, shake offset
math (px→world k), `introCam(subT)` keyframes monotonic + endpoints match
introPhase zoom start/end. Accept: INTRO renders cinematic flythrough in 3D (2D
flyover transform gated to non-3d kinds); ATTRACT demo world renders through the
3D path with HUD suppressed (`o.hud===false` honored).

**S4 game-element art pass** — files: `sprites.js` (silhouette/bomb/icon art),
`three/textures.js`, overlay HUD icons. Mostly manual; node checks assert
material.map presence + icon draw calls on recording ctx. Accept: characters
read as characters (visor+limbs silhouette), bomb has fuse+highlight, explosion
has core flash→smoke ring drama, bomb/remote/kick icons legible on overlay.

## §4 Camera rig (camrig.js)

State `{az,el,dist,target:[0,0,0]}` — render-side closure like `cam`, NEVER in
world. Defaults az=−0.6rad, el=0.9rad, dist=560; clamps el∈[0.25,1.35],
dist∈[240,900]. Pure fns: `orbitBy(st,dAz,dEl)`, `dollBy(st,d)`, `resetOrbit(st)`,
`applyOrbit(camera,st,shake)` (position = target + spherical(az,el,dist),
lookAt(target + shakeOffset)), `SHAKE_3D_K=0.06` world-units/px. Mount mirrors
`mountCameraCtl`: RIGHT-drag rotates (button 2, contextmenu swallowed), wheel =
dolly (`preventDefault`), pinch = dolly, gated `getActive()` (GAME only);
left-drag/fire stays Input-owned. Main's KeyR also calls `resetOrbit` in 3D.
`cameraCtl.js` untouched (2D/iso keep it).

## §5 Texture pipeline (zero image assets)

`textures.js`: guarded `typeof document!=="undefined"`; for each type draws an
offscreen 64×64 via existing `drawPlayerBody/drawEnemyBody/drawBombBody/
drawItemBody/drawIcon` (sprites.js, extended additively in S4) → `CanvasTexture`
(NearestFilter, sRGB). Atlas `{player,enemy_<type>,bomb,item_<pdef>,wall,brick}`
→ `materials.build(biome,atlas)`. Headless ⇒ atlas=null ⇒ color fallbacks; tests
never construct canvas. No fetch, no assets dir.

## §6 Lighting rig (frozen in lights.js)

HemisphereLight(`#cfe8ff`, biome.bg1, 0.85); DirectionalLight(`#ffffff`, 1.6)
pos(300,420,220)→target(0,0,0), castShadow, mapSize 1024², ortho ±340/±280,
near 10 far 1200, bias −0.0005; AmbientLight(`#ffffff`, 0.25). Renderer:
shadowMap enabled + PCFSoftShadowMap; floor receives, walls/bricks/entities
cast+receive. No fog, no tone mapping (defaults).

## §7 Integration edits per file

- `index.html`: add `<canvas id="gl">` inside `#stage` before `#c`; CSS stacks
  both absolute inset:0 within `#stage{position:relative}` (already), `#gl`
  `[hidden]{display:none}` toggled by main; touchpad z-index above both.
- `src/main.js`: parse `?render=(3d|iso)`; `curKind` tri-state; acquire/create
  overlay alpha ctx for 3d; `rcache["3d"]=createRenderer3D(...)`; gate the 2D
  INTRO-flyover + `camTransform` blocks to non-3d kinds (flythrough/orbit own
  the 3D camera); KeyR → also resetOrbit; drawShell/`c.save()` path operates
  on overlayCtx (same 2D API — no other edits).
- `src/render/renderer.js`: one-line kind alias `"iso"`→legacy branch.
- `package.json`: NO dep added (relative import). Executing sessions append the
  per-stage MEMORY.md entry (standing rule); AGENTS.md architecture note in S1.

## §8 Test matrix

Node (`node --test`, no DOM): scene counts/transforms, brick rescan diff, pool
visibility vs world, materials color fallback, camrig math, flythrough keyframes,
shake math, wrapper surface shape; full battery green per stage.
Manual browser (`npm start`): S1 lit shadows/orbit/R/iso-parity; S2 pickup+
detonation visuals, texture crispness; S3 intro/attract cinematics, mid-mobile
60fps spot-check, DPR scaling; S4 art readability, HUD icons, biomes+enemies
eyeballed. Perf gate: ≤500 draw calls (expect <20), instanced blocks mandatory.

## §9 Acceptance checklist

1. Vendor file committed alone; header/license intact; no npm changes.
2. `buildScene`/`update` run headless; zero DOM refs in `three/{scene,entities,
   materials,camrig,lights,flythrough}.js`. 3. Default boot byte-equivalent
   2D; battery green every stage.
4. `?render=iso` reproduces current dimetric exactly.
5. Menu RENDER toggles REAL 3D ↔ CLASSIC 2D live (renderer cache swap works).
6. Dual-canvas overlays (menus/HUD/fades) transparent over 3D; touchpad clicks.
7. Orbit right-drag+wheel+R GAME-only; menu/intro framing untouched.
8. Bricks/walls instanced; brick break updates in place (no realloc).
9. One directional shadow light; ≤500 draw calls; DPR ≤2.
10. Shake/intro/attract behave in 3D; events drained once per frame.
11. Sim/net/input/core diffs = 0 all stages. 12. Per stage: tests+commit+MEMORY.

## §10 Out of scope

Physics engine (sim stays authoritative/integer-deterministic), postprocessing,
skinned animation, GLTF/model assets, WebGPU, audio-reactive visuals, networked
camera state (cameras stay local render-side), lockstep/snapshot shape changes.
