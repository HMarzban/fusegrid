# Design — Pseudo-3D Dimetric Renderer (rollblock)

**Date:** 2026-08-16 (revised 2026-08-17 after 3-reviewer Santa review)
**Status:** Revised — pending re-review
**Decisions locked:** Option (b) pseudo-3D dimetric. Zero runtime dependencies (no
engine, no build). No change to `src/core/` or `src/net/`.

> Revision note: the first draft shipped a mutable 5-field camera, a
> `setView`/`getView`/`dispose` surface, and parallax. A 3-reviewer independent
> review (see `reviews/`) found these speculative for a fixed-tilt v1, plus
> buildability gaps (no-op ctx throws, no canvas sizing/centering, ambiguous
> `project()` domain, no `scene3d.js` signature, vacuous test guards, and a
> flat-color-vs-baked-atlas contradiction). This revision cuts the dead surface
> and pins the concrete interfaces.

## 1. Goal

Make the arena read as 3D — a tilted dimetric camera, extruded blocks with soft
shadows — while **gameplay, the simulation, and the netcode stay identical**.
This is a renderer-presentation change, not a gameplay change.

Non-goals (out of scope for v1): free-orbit/zoom/pan camera, 3D physics, 3D
meshes, any third-party dependency, any change to input intent or the sim,
parallax, per-biome height maps. (See §7 deferred.)

## 2. Guiding principle

The deterministic, serializable `world` is the sim's source of truth. **3D is a
view, not state.** Therefore:

- No camera, perspective, depth, shadow, or projection value lives in `world`
  (it would break `makeSnapshot`/`applySnapshot` and determinism).
- 3D math is confined to `src/render/`. It may be freely non-deterministic
  because the renderer never feeds the sim.
- **v1 has no mutable camera at all.** The dimetric tilt is a set of frozen
  projection constants. There is no camera input stream, no `setView`, no
  orbit. (A moving camera is a v2/option-(c) feature.)

## 3. Current baseline (what we keep)

- `createRenderer(canvas, {audio, hud})` returns
  `{canvas, ctx, render, consumeEvents, getShake}` (`renderer.js:48`).
- `render(world, dt)`: `consumeEvents` → `getShake` → background → grid → bricks
  → items → bombs → blades → enemies → players → fx → overlay/hud
  (`renderer.js:29-47`).
- 2D geometry constants: `CFG.COLS=15, ROWS=13, TILE=40`,
  key `y*COLS+x` (`config.js:1-2,19`).
- Biome palettes are **hex strings** (`config.js:13-16`) — the 3D path needs a
  hex→rgb shade helper to darken side faces.
- The 2D path bakes square tiles into an atlas (`sprites.js:20-50`). A dimetric
  top face is a diamond, so v1 draws **flat-color quads** (not the baked
  square) — see §4.4.
- `fx.js` is a **module-level singleton** (`fx.js:6`), not a per-renderer
  closure. The 3D projection is deliberately a per-renderer constant (a
  deliberate improvement over that precedent, not a copy of it).

## 4. Architecture

### 4.1 Renderer adapter

Generalize `createRenderer` with an optional `kind`:

```
createRenderer(canvas, opts = { kind: "2d", audio, hud })
```

- `kind === "2d"` → the existing 2D render path, **unchanged**.
- `kind === "3d"` → the new dimetric path.
- **Both return the identical surface** `{canvas, ctx, render, consumeEvents,
  getShake}`. No `setView`/`getView`/`dispose` — there is no mutable view to
  set or dispose in v1.
- `kind` is chosen in `main.js` from the `?render=3d` query flag only (matching
  the existing `?play=1` regex style at `main.js:75`). Default is `"2d"`.

### 4.2 Projection (frozen constants, no mutable camera)

A fixed **2:1 dimetric** transform, computed only in the renderer. All
parameters are module constants derived from `CFG` — there is no per-frame
mutable camera state.

```
TILE_W = CFG.TILE        // 40  (diamond width in screen x)
TILE_H = CFG.TILE / 2    // 20  (diamond height in screen y)

project(gx, gy):
  sx = (gx - gy) * (TILE_W / 2) + OFF_X
  sy = (gx + gy) * (TILE_H / 2) + OFF_Y
```

- `gx, gy` are **continuous** grid coordinates. For tiles they are integers;
  for entities/bombs/items they are `px / CFG.TILE`, `py / CFG.TILE` (the sim
  stores pixel floats — `sim.js:84-85`, `world.js:79`). This is what keeps the
  player from snapping to tile centers.
- `OFF_X`/`OFF_Y` are the **centering offset** so the projected board's
  bounding box is framed on the canvas (see §4.5). The board's projected
  bounding box for `COLS=15, ROWS=13` is `sx ∈ [-240, +280]`,
  `sy ∈ [0, +260]` before extrusion.

### 4.3 Depth sort + faux extrusion

- **Painter's algorithm.** Build **one** sorted draw list of
  `{depth, draw(ctx)}` entries — blocks and entities together, not separate
  layers — so a tall block occludes an entity behind it. (The current 2D layer
  order at `renderer.js:37-42` draws all bricks before all entities, which
  cannot produce correct occlusion.)
- **Depth key.** `depth = gx + gy` (continuous). **Tie-break:** an entity sorts
  *after* the tile it stands on (entity depth uses its continuous `gx+gy`; the
  tile it occupies uses its back-corner `gx+gy`), so a player is never drawn
  over the floor tile beneath it.
- **Extrusion.** A wall/brick tile draws three quads: a top face (full biome
  color) and two side faces (front-left, front-right) shaded by fixed factors
  (e.g. `*0.7`, `*0.85`) via the hex→rgb shade helper. Height per tile type:
  wall > brick > floor (one constant per type — no per-biome height map in v1).
- **Top face = flat-color quads.** v1 does **not** reuse the baked square
  atlas for top faces (a square can't be a diamond without a stated transform).
  It fills the diamond + side quads with flat biome colors. (An
  atlas-textured top face is deferred polish — §7.)
- **Entities** (player, bombs, enemies) draw as flat **billboards** standing at
  their projected floor point: `ctx.save(); ctx.translate(projSx, projSy);
  <draw sprite centered, standing up>; ctx.restore()`. They are sorted into the
  same painter list by their continuous depth.
- **Shadows.** A single translucent offset quad beneath each elevated block /
  entity conveys height without real lighting.
- **`world.fx` particles** (explosions, pickups — `renderer.js:43`) are included
  in the painter list so 3D mode keeps particle feedback.

### 4.4 Exported interfaces (concrete)

`src/render/r3d/camera.js`:
```
project(gx, gy) -> { sx, sy }        // pure; uses module constants
PROJ = { TILE_W, TILE_H, OFF_X, OFF_Y, boardW, boardH }   // frozen
```

`src/render/r3d/scene3d.js`:
```
buildPainters(world) -> [ { depth, draw(ctx) } ]   // blocks + entities + fx, unsorted
shade(hex, factor) -> "rgb(r,g,b)"                 // hex->rgb darken helper
```

`renderer.js` 3D path: `const ps = buildPainters(world); ps.sort(byDepth);
for (const p of ps) p.draw(ctx);` then overlay/hud.

### 4.5 Canvas sizing + centering (3D mode)

`main.js` sizes the canvas to the **projected** board, not the 2D board:

```
canvasW = COLS * TILE_W                      // 600
canvasH = (COLS + ROWS) * (TILE_H/2) + WALL_H + 2*PAD   // ~340
OFF_X   = canvasW/2 - ((COLS-1) - (ROWS-1)) * (TILE_W/4)   // centers sx bbox
OFF_Y   = PAD
```

DPR: `canvas.width = canvasW * min(devicePixelRatio, 2)`,
`ctx.scale(dpr, dpr)`, CSS size = `canvasW` px. (This makes the risk-register
"Cap DPR at 2" a real step, not a claim.)

## 5. Determinism guardrails (non-negotiable)

1. **Zero sim math.** No new floating-point work in `src/core/`. The existing
   `Math.ceil(Math.hypot(...))` sub-step in `board.js:78` stays exactly as-is.
2. **No camera/projection value in `world`.** Never stored in `world`, never in
   a snapshot, never an argument to `step()`. (Structurally enforced:
   `makeSnapshot` serializes an explicit field list — `protocol.js:22-37` — so
   a renderer constant can't leak.)
3. **Existing tests stay green.** No change to `tests/sim.test.mjs` or
   `tests/protocol.test.mjs`.
4. **v1 has no mutable renderer camera state** to leak across worlds.

## 6. Migration sequence (each step keeps the 16 tests green)

1. **Stabilize the `Renderer` interface.** In `renderer.js`, make
   `createRenderer` accept `opts.kind`, default `"2d"`, and branch `render` to
   the 2D or 3D path. Surface unchanged. No behavior change to 2D.
   *Guard: 16 tests (they don't import the renderer — no-regression guard).*
2. **Projection + unit test.** New `src/render/r3d/camera.js` with `project`
   and `PROJ`. **Add `tests/r3d.test.mjs`** (matching the existing `check()`
   harness style in `tests/sim.test.mjs:5-7`): assert a known tile maps to a
   known `{sx,sy}`, assert `OFF_X`/`OFF_Y` center the board bbox, assert `sy`
   is monotonic in `gx+gy`. *Guard: the new test.*
3. **Painter list + unit test.** New `src/render/r3d/scene3d.js` with
   `buildPainters` and `shade`. **Extend `tests/r3d.test.mjs`**: assert the
   painter list contains every wall/brick/entity/fx particle, assert it is
   sortable by depth, assert a front wall sorts after a back entity, assert
   `shade("#ffffff", 0.7)` darkens correctly. *Guard: the new test.*
4. **Canvas sizing + 3D wiring.** In `main.js`, parse `?render=3d` (regex,
   `main.js:75` style); when 3D, size the canvas per §4.5 (incl. DPR cap) and
   pass `kind:"3d"` to `createRenderer`. *Guard: 16 tests (input untouched).*
5. **Overlay/HUD + visual tuning.** Adapt `drawOverlay`/`updateHud`
   (`scenes.js:18-43`, currently hard-coded to `COLS*TILE x ROWS*TILE`) to the
   3D canvas size. Tune the extrusion heights, shade factors, and shadow per
   biome. *Guard: 16 tests.*
6. **Headless render smoke test.** Extend `tests/r3d.test.mjs`: build a world,
   call `render` on a **Proxy stub ctx** (no-op methods for
   save/restore/translate/fillRect/drawImage/beginPath/arc/fill/fillText/
   createLinearGradient, etc.) for both `kind:"2d"` and `kind:"3d"`, assert no
   throw, and assert no projection/camera key appears on `world` (whitelist the
   renderer-owned `world.events`/`world.fx` keys so the assertion doesn't
   false-positive). Append a dated `MEMORY.md` entry. *Guard: the new test.*

> Note on the no-op ctx: the existing 2D fallback ctx is a bare `{}`
> (`renderer.js:14-15`) which **throws** at the unguarded `ctx.save()`
> (`renderer.js:33`). Step 6's stub must be a full method-stub (Proxy), and the
> smoke test asserts no-throw for **both** kinds against that stub. (Optionally
> also guard `ctx.save/restore` in the 2D path so the bare-`{}` fallback stops
> throwing — a latent-bug fix, kept separate from the 3D work.)

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
| Projection/camera value leaks into `world`/snapshot | Guardrail §5; `makeSnapshot`'s explicit field list (`protocol.js:22-37`) makes a leak structurally impossible; step-6 smoke test asserts it. |
| 3D occlusion wrong (entity drawn over tall block) | Single depth-sorted draw list (§4.3) with the entity-after-its-tile tie-break. |
| Player snaps to tile centers / self-occludes | Continuous `px/TILE` depth key (§4.2), not tile-quantized. |
| Board clipped / off-center on real devices | Canvas sized + centered to the projected bbox (§4.5); step-2 test asserts centering. |
| Mobile perf | 195-cell arena is trivial; constant face count = (walls+bricks)*3 quads + billboards + 1 shadow each; DPR capped at 2 (§4.5). |
| Existing 2D path regresses | `kind` defaults to `"2d"`; 2D code path unchanged; both paths coexist. |
| No-op ctx throws (latent bug) | Step 6 uses a full Proxy stub; optionally guard `ctx.save/restore` in the 2D path. |

## 9. Resolved defaults (no longer open)

- **Camera control:** fixed dimetric tilt, no input stream, v1. (Moving camera
  deferred — §7.)
- **Per-tile height:** one constant per type (wall > brick > floor). (Per-biome
  height map deferred — §7.)
- **Top face:** flat-color quads. (Atlas-textured top deferred — §7.)
- **Render flag:** `?render=3d` only.
