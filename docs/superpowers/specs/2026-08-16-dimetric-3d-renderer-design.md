# Design — Pseudo-3D Dimetric Renderer (rollblock)

**Date:** 2026-08-16
**Status:** Proposed (pending user review)
**Decisions locked:** Option (b) pseudo-3D dimetric. Zero runtime dependencies (no
engine, no build). No change to `src/core/` or `src/net/`.

## 1. Goal

Make the arena read as 3D — a tilted camera, extruded blocks with soft shadows,
gentle parallax — while **gameplay, the simulation, and the netcode stay
identical**. This is a renderer-presentation change, not a gameplay change.

Non-goals (explicitly out of scope): free-orbit 3D camera, 3D physics/collision,
3D meshes, any third-party dependency, any change to input intent or the sim.
(Option (c) "full 3D arena" is deferred — see §7.)

## 2. Guiding principle

The deterministic, serializable `world` is the sim's source of truth. **3D is a
view, not state.** Therefore:

- No camera, perspective, depth, shadow, or parallax value lives in `world`
  (it would break `makeSnapshot`/`applySnapshot` and determinism).
- 3D math is confined to `src/render/`. It may be freely non-deterministic
  because the renderer never feeds the sim.
- The camera is a **render-only input stream**: read in `main.js`, pushed into
  the renderer, and **never passed to `step()`**.

## 3. Current baseline (what we keep)

- `createRenderer(canvas, {audio, hud})` returns
  `{canvas, ctx, render, consumeEvents, getShake}` (`src/render/renderer.js:48`).
- `render(world, dt)`: `consumeEvents` → `getShake` → background → grid → bricks
  → items → bombs → blades → enemies → players → fx → overlay/hud
  (`renderer.js:29-47`).
- 2D geometry constants: `CFG.COLS=15, ROWS=13, TILE=40`,
  key `y*COLS+x` (`src/core/config.js:1-2,19`).
- Biome palettes supply the brick/wall/floor colors we will shade for 3D
  (`config.js:12-17`).
- The `fx.js` "renderer-local, build from `world.events`, never mutate the sim"
  pattern is the precedent for how the camera module should behave.

## 4. Architecture

### 4.1 Renderer adapter

Generalize `createRenderer` with an optional `kind`:

```
createRenderer(canvas, opts = { kind: "2d", audio, hud })
```

- `kind === "2d"` → the existing 2D render path, **unchanged**.
- `kind === "3d"` → the new dimetric path.
- Both return the **identical** surface `{canvas, ctx, render, consumeEvents,
  getShake, setView?, dispose?}`. `setView`/`dispose` are no-ops for `kind:"2d"`.

The `kind` is chosen in `main.js`, defaulting to `"2d"`, overridable by an
`opts.render` param and a `?render=3d` query flag. This keeps the existing
single-player/2D behavior the default and zero-risk.

### 4.2 Camera view (renderer-local)

A small plain object owned by the renderer (never `world`), modeled on the
`fx.js` closure:

```
view = { yaw, pitch, zoom, targetX, targetY }  // pitch ~30° dimetric default
```

- Created inside the 3D renderer closure at construction.
- Exposed via `setView(partial)` and `getView()` on the returned surface.
- `main.js` may drive it from an **optional** second input stream (mouse drag /
  arrow-key orbit / wheel zoom). When no camera input is wired, the view is a
  fixed dimetric tilt and the game is fully playable hands-off.
- **Invariants:** `setView`/`getView` touch only renderer state. No camera value
  is stored in `world`, emitted in a snapshot, or read by `step()`.

### 4.3 Projection

A fixed **2:1 dimetric** transform, computed only in the renderer:

```
sx = (gx - gy) * (TILE_W / 2) * zoom
sy = (gx + gy) * (TILE_H / 2) * zoom
```

`tiles` → screen. `TILE_W`/`TILE_H` derive from `CFG.TILE` (e.g. `TILE_W=TILE`,
`TILE_H=TILE/2`). No matrix library, no float math shared with the sim. The
camera `pitch`/`yaw` adjust `TILE_W`/`TILE_H` (and an offset) so a "camera"
reads as a tilt/orbit without ever touching tile coordinates.

### 4.4 Depth sort + faux extrusion

- **Painter's algorithm.** Render back-to-front by screen `sy` (then `sx`), or
  equivalently by `gx+gy` then `gx-gy`, so nearer blocks occlude farther ones.
  Bricks, walls, items, bombs, blades, enemies, and players are all **one
  sorted draw list** of (depth, painter) entries, not separate layers — this is
  what makes tall blocks occlude entities correctly.
- **Extrusion.** A wall/brick tile draws three quads: top face (full color), and
  two side faces (left/right) shaded by fixed factors (e.g. `*0.7`, `*0.85`)
  from the biome palette in `config.js`. Height per tile type: wall > brick >
  floor.
- **Shadows.** A soft drop shadow (translucent offset quad beneath each elevated
  block / entity) conveys height without real lighting.
- **Entities** (player, bombs, enemies) project to their tile's screen point and
  draw as flat billboards, sorted with the blocks so a tall block in front
  occludes them.
- **Parallax.** The floor grid and a faint far backdrop shift slightly with the
  camera offset — cheap pseudo-depth.

## 5. Determinism guardrails (non-negotiable)

1. **Zero sim math.** No new floating-point work in `src/core/`. The existing
   `Math.ceil(Math.hypot(...))` sub-step count in `board.js` is a *sim branch*
   and stays exactly as-is (we do not touch core).
2. **Camera is render-only.** Never stored in `world`, never in a snapshot,
   never an argument to `step()`.
3. **Existing tests stay green.** No change to `tests/sim.test.mjs` or
   `tests/protocol.test.mjs`. The sim/protocol are untouched by a renderer-only
   change.
4. **The new camera view object is renderer-local and disposable** — it does not
   survive or leak across worlds.

## 6. Migration sequence (each step keeps the 16 tests green)

1. **Stabilize the `Renderer` interface.** In `renderer.js`, make
   `createRenderer` accept `opts.kind`, default `"2d"`, and return the
   `setView`/`getView`/`dispose` surface (no-ops for 2D). No behavior change.
   *Guard: neither test imports the renderer.*
2. **Add the renderer-owned camera view.** New `src/render/r3d/camera.js`:
   `createView()`, dimetric default, `apply(view, partial)`, and a pure
   `project(view, gx, gy)` → `{sx, sy}`. No DOM. *Guard: sim/protocol tests.*
3. **New dimetric scene.** New `src/render/r3d/scene3d.js`: builds the depth-
   sorted painter list from `world` (blocks + entities), with extrude + shadow
   helpers. Pure functions where possible so they are unit-testable.
   *Guard: sim/protocol tests unchanged.*
4. **Wire the 3D path.** In `renderer.js`, when `kind==="3d"`, `render` calls
   the 3D scene; `main.js` chooses `kind` from `opts.render` / `?render=3d` and
   (optionally) feeds a camera input stream to `renderer.setView`.
   *Guard: protocol determinism test still passes (input untouched).*
5. **Faux 3D polish.** Apply extrude/shadow/parallax over the existing baked
   atlas; tune height/shade factors per biome. Purely cosmetic.
   *Guard: unchanged.*
6. **Headless renderer smoke test + MEMORY.md entry.** New
   `tests/render.test.mjs`: build a world, call `render` on a no-op ctx for both
   `kind:"2d"` and `kind:"3d"`, assert no throw and that no camera value reaches
   the world. Append a dated `MEMORY.md` entry (AGENTS standing rule).

## 7. Deferred / out of scope

- **Option (c) full 3D arena** (orbiting camera, 3D meshes, 3rd-person): forces
   a 3D simulation and protocol changes and is a 2–4 month swing. Revisit after
   (b) ships.
- A true 3D physics/collision model: out of scope; collision stays the sim's 2D
   `aabb` on the grid.
- Any third-party engine (Three.js/Babylon/WebGPU): rejected per the locked
   zero-dependency decision; a heavy engine adds no determinism value here.

## 8. Risk register

| Risk | Mitigation |
|---|---|
| Camera value leaks into `world`/snapshot | Guardrail §5; smoke test asserts no leak (§6 step 6). |
| Extrusion/shadow adds float branches that look deterministic but aren't | All such math is renderer-only; sim branches untouched. |
| 3D occlusion wrong (entities drawn over tall blocks) | Single depth-sorted draw list (§4.4), not separate layers. |
| Mobile perf | 195-cell arena is trivial; extruded blocks add a constant face count. Cap DPR at 2, keep shadow a single translucent quad. |
| Existing 2D path regresses | `kind` defaults to `"2d"`; 2D code path is unchanged; both render paths coexist. |

## 9. Open questions for user

- Camera control: fixed tilt, or optional drag/arrow orbit + wheel zoom? (Default
  spec says optional, hands-off-fixed when unwired.)
- Per-tile height profile (wall/brick/floor) — keep a single height per type, or
  a small height map per biome? (Default: one height per type.)
  These do not block implementation; defaults are stated above.
