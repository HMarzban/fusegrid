# Design — Pseudo-3D Dimetric Renderer (rollblock)

**Date:** 2026-08-16 (revised 2026-08-17, round 2 after 3-reviewer Santa review)
**Status:** Revised (round 2) — pending re-review
**Decisions locked:** Option (b) pseudo-3D dimetric. Zero runtime dependencies (no
engine, no build). No change to `src/core/` or `src/net/`. v1 is a **fixed**
dimetric tilt — no moving camera, no camera input stream.

> Revision history: round 1 cut the speculative mutable camera / `setView` /
> parallax and added concrete interfaces. Round 2 (this revision) fixes the
> cold-execution gaps the second review round found: the floor/background were
> never drawn, the `byDepth` comparator and its tie-break were undefined,
> `WALL_H`/`PAD` were used but never declared, the board bbox and `canvasW`
> were wrong, §4.5 contradicted the existing `fit()`/resize handler, and §3
> contradicted §4.4 on where `PROJ` lives. All are resolved below.

## 1. Goal

Make the arena read as 3D — a tilted dimetric camera, a ground plane, extruded
blocks with soft shadows — while **gameplay, the simulation, and the netcode
stay identical**. This is a renderer-presentation change, not a gameplay change.

Non-goals (out of scope for v1): moving camera (orbit/zoom/pan), 3D physics,
3D meshes, any third-party dependency, any change to input intent or the sim,
parallax, per-biome height maps. (See §7 deferred.)

## 2. Guiding principle

The deterministic, serializable `world` is the sim's source of truth. **3D is a
view, not state.** Therefore:

- No camera, perspective, depth, shadow, or projection value lives in `world`
  (it would break `makeSnapshot`/`applySnapshot` and determinism).
- 3D math is confined to `src/render/`. It may be freely non-deterministic
  because the renderer never feeds the sim.
- **v1 has no mutable camera at all.** The dimetric tilt is a set of **frozen
  module-level constants** (see §4.4). There is no per-frame mutable state, no
  camera input stream, no `setView`, no orbit.

## 3. Current baseline (what we keep)

- `createRenderer(canvas, {audio, hud})` returns
  `{canvas, ctx, render, consumeEvents, getShake}` (`renderer.js:48`).
- `render(world, dt)`: `consumeEvents` → `getShake` → `drawBiomeBackground` →
  `drawGrid` → bricks → items → bombs → blades → enemies → players → fx →
  overlay/hud (`renderer.js:29-47`).
- 2D geometry constants: `CFG.COLS=15, ROWS=13, TILE=40`, key `y*COLS+x`
  (`config.js:1-2,19`).
- Biome palettes are **hex strings** (`config.js:13-16`) — the 3D path needs a
  hex→rgb shade helper to darken side faces.
- The 2D path bakes square tiles into an atlas (`sprites.js:20-50`). A dimetric
  top face is a diamond, so v1 draws **flat-color quads** (not the baked
  square) — see §4.3.
- `fx.js` is a **module-level singleton** (`fx.js:6`). The 3D projection is
  likewise a **module-level frozen constant** exported by `camera.js`
  (consistent with that precedent, not a per-renderer closure).

## 4. Architecture

### 4.1 Renderer adapter

Generalize `createRenderer` with an optional `kind`:

```
createRenderer(canvas, opts = { kind: "2d", audio, hud })
```

- `kind === "2d"` → the existing 2D render path, **unchanged**.
- `kind === "3d"` → the new dimetric path.
- **Both return the identical surface** `{canvas, ctx, render, consumeEvents,
  getShake}`. No `setView`/`getView`/`dispose` — there is no mutable view in v1.
- `kind` is chosen in `main.js` from the `?render=3d` query flag only (matching
  the existing `?play=1` regex style at `main.js:75`). Default is `"2d"`.
- `bakeAtlas()` (`renderer.js:13`) is gated on `kind === "2d"` — the 3D
  flat-quad path never uses the baked square atlas.

### 4.2 Projection (frozen module constants)

A fixed **2:1 dimetric** transform, computed only in the renderer. All
parameters are **frozen module-level constants** in `camera.js` derived from
`CFG` — there is no per-frame mutable state.

```
TILE_W = CFG.TILE         // 40  (diamond width in screen x)
TILE_H = CFG.TILE / 2     // 20  (diamond height in screen y)

project(gx, gy):
  sx = (gx - gy) * (TILE_W / 2) + OFF_X
  sy = (gx + gy) * (TILE_H / 2) + OFF_Y
```

- `gx, gy` are **continuous** grid coordinates.
  - **A tile at grid `(x,y)` is the diamond** with corners
    `project(x,y)`, `project(x+1,y)`, `project(x+1,y+1)`, `project(x,y+1)`.
  - **Entities / bombs / items** use `gx = px / CFG.TILE`, `gy = py / CFG.TILE`
    (the sim stores pixel floats — `sim.js:84-85`, `world.js:79`). This keeps
    the player from snapping to tile centers.
- **Drawn board bounding box** (full tile corners, grid extent `(0,0)` to
  `(COLS,ROWS)` = `(15,13)`):
  - `sx ∈ [ -ROWS*TILE_W/2,  COLS*TILE_W/2 ] = [-260, +300]`  (width 560)
  - `sy ∈ [ 0,  (COLS+ROWS)*TILE_H/2 ] = [0, +280]`           (height 280)

### 4.3 Depth sort + faux extrusion

- **Painter's algorithm.** Build **one** sorted draw list of
  `{depth, tier, draw(ctx)}` entries — **floor + blocks + entities + fx**
  together, not separate layers — so a tall block occludes an entity behind it
  and everything sits on a ground plane. (The 2D layer order at
  `renderer.js:37-42` draws all bricks before all entities, which cannot
  produce correct occlusion.)
- **Painter entries:**
  - **Floor tile `(x,y)`:** `depth = x+y`, `tier = 0`, `draw` = flat diamond
    filled with the biome floor color (checkerboard `floor0`/`floor1`). No
    extrusion. This is the ground plane.
  - **Block (wall/brick) `(x,y)`:** `depth = x+y` (back-corner), `tier = 2`,
    `draw` = three quads — top face (full biome color) + two side faces
    (front-left, front-right) shaded by `shade(color, 0.7)` / `shade(color,
    0.85)`. Extrusion height per type: `WALL_H` > `BRICK_H` > `FLOOR_H(=0)`.
  - **Entity (player/bomb/enemy) at `(px,py)`:** `depth = (px+py)/TILE`,
    `tier = 1`, `draw` = a flat **billboard** standing at
    `project(px/TILE, py/TILE)`: `ctx.save(); ctx.translate(projSx, projSy);
    <draw sprite centered, standing up, height ≈ its 2D size>; ctx.restore()`.
  - **fx particle at `(x,y)`:** `depth = (x+y)/TILE`, `tier = 1`, `draw` = the
    projected particle (so explosions/pickups keep feedback in 3D).
- **Sort comparator (pinned):**
  ```
  byDepth(a, b) = (a.depth - b.depth) || (a.tier - b.tier)
  ```
  Draw back-to-front (ascending). **Tier breaks equal-depth ties as
  floor(0) < entity(1) < block(2).** This is what makes a wall occlude an
  entity resting in the tile directly behind it: that entity's depth equals the
  wall's back-corner depth, and the wall (tier 2) sorts after the entity
  (tier 1), so the wall draws on top.
- **Shadows.** A single translucent offset quad beneath each elevated block /
  entity conveys height without real lighting.
- **Top face = flat-color quads.** v1 does **not** reuse the baked square atlas
  for top faces (a square can't be a diamond without a stated transform). It
  fills the diamond + side quads with flat biome colors. (An atlas-textured top
  face is deferred polish — §7.)

### 4.4 Exported interfaces (concrete, all constants defined)

`src/render/r3d/camera.js`:
```
project(gx, gy) -> { sx, sy }          // pure; uses PROJ
PROJ = {                                // frozen module-level constant
  TILE_W, TILE_H,                       // = CFG.TILE, CFG.TILE/2
  WALL_H, BRICK_H, FLOOR_H,             // extrusion heights (e.g. 24, 14, 0)
  PAD,                                  // canvas padding (e.g. 24)
  OFF_X, OFF_Y,                         // centering offsets (see §4.5)
  canvasW, canvasH,                     // backing-store size (see §4.5)
}                                       // no boardW/boardH (no consumer)
```

`src/render/r3d/scene3d.js`:
```
buildPainters(world) -> [ { depth, tier, draw(ctx) } ]   // floor+blocks+entities+fx, unsorted
shade(rgbHex, factor) -> "rgb(r,g,b)"                    // darkens a #rrggbb string
```

`renderer.js` 3D path:
```
const ps = buildPainters(world);
ps.sort(byDepth);
for (const p of ps) p.draw(ctx);
// then drawOverlay(ctx, world) + updateHud(hud, world) as in the 2D path
```

### 4.5 Canvas sizing + centering (3D mode)

All derived from `PROJ` (one source of truth; `main.js` imports `TILE_W`/
`TILE_H`/`canvasW`/`canvasH` from `camera.js`, not re-derived from `CFG`):

```
canvasW = (COLS + ROWS) * (TILE_W / 2) + 2*PAD          // 560 + 48 = 608
canvasH = (COLS + ROWS) * (TILE_H / 2) + WALL_H + 2*PAD // 280 + 24 + 48 = 352
OFF_X   = PAD + ROWS * (TILE_W / 2)                     // 24 + 260 = 284
OFF_Y   = PAD + WALL_H                                  // 24 + 24 = 48
```

`OFF_Y` reserves `WALL_H` **above** the board top so the topmost wall (grid
`(0,0)`, base `sy=0`) extrudes to `y = OFF_Y - WALL_H = PAD` — never clipped.
Verified: left/right/bottom margins all equal `PAD`; top wall top = `PAD`.

**Backing store + DPR:**
```
dpr = Math.min(window.devicePixelRatio || 1, 2)
canvas.width  = canvasW * dpr
canvas.height = canvasH * dpr
ctx.scale(dpr, dpr)
```

**`fit()` remains the CSS-scale authority** (`main.js:19-27`): it sets
`canvas.style.width = canvas.width * s` to fit the viewport. §4.5 only sets the
backing store + `ctx.scale(dpr,dpr)`. There is **no double-scaling**: `fit()`
scales the (already DPR-scaled) backing store down to the viewport, and
`project()` coordinates live in the `canvasW × canvasH` logical space that
`ctx.scale` maps to device pixels.

## 5. Determinism guardrails (non-negotiable)

1. **Zero sim math.** No new floating-point work in `src/core/`. The existing
   `Math.ceil(Math.hypot(...))` sub-step in `board.js:78` stays exactly as-is.
2. **No projection/camera value in `world`.** Never stored in `world`, never in
   a snapshot, never an argument to `step()`. (Structurally enforced:
   `makeSnapshot` serializes an explicit field list — `protocol.js:22-37` — so
   a renderer constant can't leak.)
3. **Existing tests stay green.** No change to `tests/sim.test.mjs` or
   `tests/protocol.test.mjs`. (Note: those 16 tests guard sim/protocol
   determinism; they do **not** import the renderer, so they are a no-regression
   guard, not a 2D-render coverage guard. The 2D/3D render paths are covered by
   the new `tests/r3d.test.mjs`.)
4. **v1 has no mutable renderer camera state** to leak across worlds.

## 6. Migration sequence (each step keeps the 16 tests green)

1. **Stabilize the `Renderer` interface.** In `renderer.js`, make
   `createRenderer` accept `opts.kind` (default `"2d"`), branch `render` to the
   2D or 3D path, and gate `bakeAtlas()` on `kind === "2d"`. Surface unchanged.
   No behavior change to 2D. *Guard: 16 tests (no-regression).*
2. **Projection + unit test.** New `src/render/r3d/camera.js` with `project`
   and `PROJ` (all constants defined per §4.4/§4.5). **Add `tests/r3d.test.mjs`**
   (matching the existing `check()` harness style in `tests/sim.test.mjs:5-7`):
   - a known tile corner maps to a known `{sx,sy}`;
   - `OFF_X`/`OFF_Y` center the drawn board bbox `sx∈[-260,300], sy∈[0,280]`
     (left/right/bottom margins = `PAD`, top wall top = `PAD`);
   - `sy` is monotonic in `gx+gy`;
   - `OFF_Y >= WALL_H` (top wall not clipped). *Guard: the new test.*
3. **Painter list + unit test.** New `src/render/r3d/scene3d.js` with
   `buildPainters` and `shade`. **Extend `tests/r3d.test.mjs`**:
   - the painter list contains **every floor tile**, every wall/brick, every
     entity, and every fx particle;
   - it sorts correctly by `(depth, tier)`;
   - a front wall sorts after a back entity (different depths);
   - a **behind-wall entity at equal depth** sorts *before* the wall (occluded);
   - `shade("#ffffff", 0.7)` returns a darker `rgb(...)`. *Guard: the new test.*
4. **Canvas sizing + 3D wiring.** In `main.js`, parse `?render=3d` (regex,
   `main.js:75` style); when 3D, set the backing store per §4.5
   (`canvas.width/height = canvasW/canvasH * dpr`, `ctx.scale(dpr,dpr)`), keep
   `fit()` as the CSS authority, and pass `kind:"3d"` to `createRenderer`.
   Import `canvasW`/`canvasH`/`TILE_W`/`TILE_H` from `camera.js`. *Guard: 16
   tests (input untouched).*
5. **Overlay/HUD + visual tuning.** Adapt `drawOverlay` (`scenes.js:18-43`,
   currently hard-coded to `COLS*TILE × ROWS*TILE`) to the 3D canvas size.
   (`updateHud` is DOM-based — `scenes.js:44-59` — and needs no change.) Tune
   the extrusion heights, shade factors, and shadow per biome. *Guard: 16
   tests.*
6. **Headless render smoke test.** Extend `tests/r3d.test.mjs`: build a world,
   and — because `createRenderer` takes a **canvas** (`renderer.js:12`), not a
   ctx — pass a **fake canvas whose `getContext("2d")` returns a Proxy stub**
   (no-op methods for save/restore/translate/scale/fillRect/drawImage/beginPath/
   arc/fill/fillText/createLinearGradient, etc.). Call `render` for both
   `kind:"2d"` and `kind:"3d"`, assert no throw. Append a dated `MEMORY.md`
   entry. *Guard: the new test.*

> Note on the no-op ctx: the existing 2D fallback ctx is a bare `{}`
> (`renderer.js:14-15`) which **throws** at the unguarded `ctx.save()`
> (`renderer.js:33`). Step 6's Proxy stub sidesteps this for the test.
> Optionally also guard `ctx.save/restore` in the 2D path so the bare-`{}`
> fallback stops throwing — a latent-bug fix, kept separate from the 3D work.

## 7. Deferred / out of scope (v2 / option c)

- **Moving camera** (orbit/zoom/pan) + its input stream + `setView`/`dispose`.
  Revisit only with option (c) full 3D. Note: arrow-key orbit would conflict
  with movement (`input.js:29-32`) — a mouse-only stream is required.
- **Parallax** (inert without a moving camera).
- **Atlas-textured top faces** (diamond via affine transform) for richer detail.
- **Per-biome height maps** (v1 uses one height per tile type).
- **Option (c) full 3D arena** (orbiting camera, 3D meshes, 3rd-person): forces
  a 3D simulation + protocol changes; a 2–4 month swing.
- Any third-party engine (Three.js/Babylon/WebGPU): rejected per the locked
  zero-dependency decision.

## 8. Risk register

| Risk | Mitigation |
|---|---|
| Projection value leaks into `world`/snapshot | Guardrail §5; `makeSnapshot`'s explicit field list (`protocol.js:22-37`) makes a leak structurally impossible. |
| 3D occlusion wrong (entity drawn over tall block) | Single depth-sorted list (§4.3) with the pinned `(depth, tier)` comparator; behind-wall case covered by the step-3 test. |
| No ground plane (floating blocks) | Floor tiles are `tier 0` painters in the list (§4.3); step-3 test asserts floor presence. |
| Player snaps to tile centers / self-occludes | Continuous `px/TILE` depth key (§4.2), not tile-quantized. |
| Board clipped / off-center on real devices | Canvas sized + centered to the drawn bbox (§4.5); `OFF_Y` reserves `WALL_H` at top; step-2 test asserts centering + top fit. |
| 3D canvas overflows mobile viewport | `fit()` stays the CSS-scale authority (§4.5); §4.5 only sets the backing store. |
| Mobile perf | 195-cell arena is trivial; constant face count = (walls+bricks)*3 quads + floor diamonds + billboards + 1 shadow each; DPR capped at 2. |
| Existing 2D path regresses | `kind` defaults to `"2d"`; 2D code path unchanged; both paths coexist; step-6 smoke test covers both. |
| No-op ctx throws (latent bug) | Step 6 uses a full Proxy stub; optionally guard `ctx.save/restore` in the 2D path. |

## 9. Resolved defaults (no longer open)

- **Camera control:** fixed dimetric tilt, no input stream, v1. (Moving camera
  deferred — §7.)
- **Per-tile height:** one constant per type (`WALL_H` > `BRICK_H` > `FLOOR_H`).
  (Per-biome height map deferred — §7.)
- **Top face:** flat-color quads via `shade()`. (Atlas-textured top deferred —
  §7.)
- **Render flag:** `?render=3d` only.
