# Mini-Spec — Renderer V2 Polish (textured tops · soft shadows · biome heights)

**Date:** 2026-08-23 · **Branch:** campaigns/touch-render-net · **Status:** ready for cold execution
**Builds on:** `2026-08-16-dimetric-3d-renderer-design.md` (v1; implements its §7 deferred items 1–3).

## 1. Scope & rulings

- **Binding ruling:** moving camera/orbit DEFERRED (arrow-key conflict, input-stream cost). This campaign ships ONLY the three visual upgrades below.
- Render-only: **no sim/net/world/protocol changes.** `camera.js`/`PROJ` stay byte-identical (PROJ constants remain the defaults).
- 2D path frozen byte-for-byte: all upgrades are `kind==="3d"`-only. Shadows do NOT apply subtly in 2D (**decision: NO**).
- Zero-dep; performance budget: total painter count ≤2× v1 baseline.
- Intro flyover (`main.js` wraps `renderer.render` in an outer `introPhase` transform) and MENU backdrop compose OUTSIDE painter-local transforms — unaffected; verified by smoke test.

## 2. Textured top faces (always-affine; exact math)

**Decision: ALWAYS-AFFINE** whenever baked tiles exist; flat-quads remain only as the headless fallback (`!BAKED.ready`). Hybrid per-tile flag rejected (branching for marginal gain). Smoothing artifacts handled locally: toggle `imageSmoothingEnabled=true` INSIDE the painter's `save/restore` (renderer sets it false once at creation, `renderer.js:26`; 2D ctx untouched).

Source textures = the existing per-biome standalone tile canvases `BAKED.wall[bi]` / `BAKED.brick[bi]` (`CFG.TILE`×`CFG.TILE`, `sprites.js:34-47`) — full-canvas sources, so no atlas seam-bleed. Their rounded-rect transparent corners let the tier-0 floor (all 195 always painted) show through — reads as a beveled top.

Exact transform. For tile `(x,y)`, extrusion `h`: `N=project(x,y)`, `E=project(x+1,y)`, `S=project(x+1,y+1)`, `W=project(x,y+1)`; tops `tP={sx:P.sx, sy:P.sy-h}`. The diamond IS a parallelogram: `tS = tE+tW-tN` (diagonals bisect). Map source pixel space `(u,v)∈[0,TILE]²` with corners `(0,0)→tN, (TILE,0)→tE, (0,TILE)→tW, (TILE,TILE)→tS`:

```
diamondTransform(tN,tE,tW) -> {a,b,c,d,e,f}:      // exported, pure
  a=(tE.sx-tN.sx)/TILE  b=(tE.sy-tN.sy)/TILE
  c=(tW.sx-tN.sx)/TILE  d=(tW.sy-tN.sy)/TILE   e=tN.sx  f=tN.sy
paint: c.save(); if(c.transform) c.transform(a,b,c,d,e,f);
       c.drawImage(SRC,0,0); c.restore();
```

Worked example (test vector), tile (5,5), h=24: `tN(284,124) tE(304,134) tS(284,144) tW(264,134)` → `{a:.5, b:.25, c:-.5, d:.25, e:284, f:124}`; check `(TILE,TILE)→(.5·40-.5·40+284, .25·40+.25·40+124)=(284,144)=tS` ✓.

## 3. Soft shadows

- **Shape: pre-rendered soft disc**, not per-frame gradients. Lazy module-level offscreen 64×64 canvas: `createRadialGradient(32,32,4, 32,32,32)`, stops `rgba(0,0,0,.5)→rgba(0,0,0,0)`; built on first `buildPainters` when `canMakeCanvas()`. Painted as axis-aligned ellipses via `drawImage(sprite, cx-rx, cy-ry, 2rx, 2ry)` — cheap, no transform stack.
- **Blocks:** ellipse inscribed in footprint bbox — center `((N.sx+S.sx)/2,(N.sy+S.sy)/2)`, `rx=PROJ.TILE_W*0.44`, `ry=PROJ.TILE_H*0.44`, `globalAlpha 0.22`.
- **Entities/items/bombs:** ellipse at the billboard anchor `q=project(gx,gy)`; `rx = entityR*0.95` (player `CFG.TILE*0.36*0.95≈13.7`; items/bombs `CFG.TILE*0.30*0.95`), `ry=rx*0.5` (matches 2:1 dimetric squash), `globalAlpha 0.26`.
- **Blades/fx: NO shadow** (transient; they ride the top tier anyway).
- **Tier rule (pinned):** renumber tiers via exported `TIERS={FLOOR:0, SHADOW:1, ENTITY:2, BLOCK:3, BLADE:4}` — v1 relative order preserved (comparator `byDepth` untouched; floats unnecessary). Every shadow paints after ALL floors and before ANY entity/block/blade ⇒ **no shadow ever darkens a wall/brick face or entity sprite — correct by construction**, independent of depth. `shadow.depth` = caster depth exactly (intra-band order irrelevant). Accepted stylization: a near-ground shadow never overlaps a far block's top (same divergence class as v1's fx/blade note).
- Sprite-internal contact ellipses (`sprites.js:249,283`) STAY (shared with frozen 2D); mild stacking accepted — the two globalAlphas are the tuning knobs.

## 4. Per-biome height variance

- **Config shape:** extend each `BIOMES` literal (`config.js:17-20`) with frozen-number fields: `hWall`/`hBrick` (absolute px). Values: JUNGLE `24/14` (= v1 defaults), ICE `30/18` (spires), FACTORY `18/10` (slabs), ARENA `26/15`. Array-level freeze mechanism unchanged; sim never reads these fields.
- **Consumption:** `scene3d.js` only — `heightFor(level,isWall){ const b=biomeOf(level); return isWall?(b.hWall??PROJ.WALL_H):(b.hBrick??PROJ.BRICK_H); }` (exported; `??` guards hypothetical field-less biomes).
- **camera.js consumption: NONE.** `PROJ`/`OFF_Y` still derive from `WALL_H=24`. Tallest biome (ICE 30) pokes 6px past the reserved top band: minimum top margin becomes `PAD-6=18px > 0` — no clip, documented, accepted (bumping `OFF_Y` would move canvas/overlay layout; rejected per binding ruling).

## 5. Integration edits (enumerated)

1. `src/render/r3d/scene3d.js` — export `TIERS`; export `diamondTransform(tN,tE,tW)`, `heightFor(level,isWall)`; `blockPainter` gains textured-top branch (SRC param; `null` → today's flat fills); `shadowPainter(cx,cy,rx,ry,alpha)`; `buildPainters` inserts shadow entries and renumbers tiers (entity 2, block 3, blade 4).
2. `src/render/renderer.js:16` — `if(kind==="2d") bakeAtlas();` → unconditional `bakeAtlas();` (idempotent via `BAKED.ready`; 3D now needs tiles). `:19-25` fallback noop ctx gains `transform:noop`.
3. `src/core/config.js:17-20` — four BIOMES literals gain `hWall`,`hBrick`.
4. `src/render/r3d/camera.js`, `sprites.js`, `menudraw.js`, `intro.js`, `main.js` — **NO CHANGE.**
5. `tests/r3d.test.mjs` — see §6.

## 6. Tests (extend `tests/r3d.test.mjs`; visuals are manual)

Headless-assertable:
- Retier existing checks 5–7 mechanically (`cnt(1)`→`TIERS.ENTITY`, `cnt(2)`→`TIERS.BLOCK`, `cnt(3)`→`TIERS.BLADE`).
- **#14 transform matrices:** `diamondTransform` on the §2 worked example returns `{.5,.25,-.5,.25,284,124}`; applying to the four source corners lands exactly on `tN/tE/tW/tS`; parallelogram closure `tS===tE+tW-tN` sampled over 12 tiles × both heights.
- **#15 height consumption:** `heightFor(1,true)===24 && (1,false)===14`; ICE `30/18`; synthetic biome missing fields falls back to `PROJ.WALL_H/BRICK_H`; `JSON.stringify(PROJ)` snapshot unchanged + `Object.isFrozen(PROJ)&&Object.isFrozen(BIOMES)`.
- **#16 shadow tier presence/order:** sorted painters satisfy `lastShadowIdx < firstEntityIdx < firstBlockIdx < firstBladeIdx` (loaded world + bomb/blade/fx); shadow count `=== walls+bricks+liveEnemies+bombs+liveItems+players`; synthetic blades/fx-only world yields zero shadows.
- **#17 budget:** total painters ≤ 2× the v1 formula count for the same world.
Manual (`npm start`, `?render=3d`): readable tops without artifacts; shadows under all standers/blocks; distinct silhouettes per biome via LEVEL SELECT; intro flyover + MENU backdrop correct; 2D (no flag) visually unchanged.

## 7. Acceptance checklist

1. Wall/brick tops sample `BAKED.*` via `ctx.transform` affine; corners provably land on `tN/tE/tS/tW` (#14).
2. Always-affine shipped; flat quads only when `!BAKED.ready`; smoothing toggled per-call inside save/restore; 2D smoothing/state untouched.
3. One pre-rendered gradient disc reused; shadow painters ≤ block+billboard count; total ≤2× v1 (#17).
4. Shadow band strictly between floor and entity/block/blade tiers — no face darkened (#16 ordering proof).
5. `BIOMES` carry `hWall/hBrick`; `heightFor` `??`-falls back to PROJ; `camera.js` byte-unchanged; frozen invariants hold (#15).
6. Three visibly distinct height profiles across JUNGLE/ICE/FACTORY (manual smoke).
7. 2D path zero-diff (2D branch + sprites untouched); all suites green; only mechanical tier renumber in r3d tests.
8. Intro flyover, MENU backdrop, dual-kind smoke (#11) green; executor appends dated `MEMORY.md` entry.

## 8. Out of scope

Moving/orbiting/zooming camera + any camera input stream; `setView/dispose`; sim/net/protocol/world changes; any 2D-path visual change (incl. removing sprite-internal shadow ellipses); DPR/backing-store changes; parallax; mipmapped or repacked atlas; dynamic light/shade direction; option (c) mesh 3D; any third-party dependency.
