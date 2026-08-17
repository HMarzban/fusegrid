# Design — Pseudo-3D Dimetric Renderer (rollblock)

**Date:** 2026-08-16 (revised 2026-08-17, round 3 after 3-reviewer Santa review)
**Status:** Revised (round 3) — ready for cold execution (pending final confirmation review)
**Decisions locked:** Option (b) pseudo-3D dimetric. Zero runtime dependencies (no
engine, no build). No change to `src/core/` or `src/net/`. v1 is a **fixed**
dimetric tilt — no moving camera, no camera input stream.

> Revision history:
> - Round 1 cut the speculative mutable camera / `setView` / parallax and added
>   concrete interfaces.
> - Round 2 fixed: floor/background never drawn, `byDepth` comparator + tie-break
>   undefined, `WALL_H`/`PAD` used but not declared, board bbox + `canvasW` wrong,
>   §4.5 contradicted `fit()`/resize, §3 contradicted §4.4 on where `PROJ` lives.
> - Round 3 (this revision) fixed the remaining cold-execution gaps: the 3D path
>   omitted `consumeEvents` (would leak `world.events`, kill audio + fx); items and
>   blades were absent from the painter list (invisible power-ups/explosions); the
>   per-entity sprite interface was unspecified; the 3D canvas background was
>   unspecified; the DPR block contradicted the 2D path; `canvasH`'s top/bottom
>   margin math was ambiguous; `camera.js`'s export shape contradicted §4.5; the
>   overlay mechanism was unspecified; the headless stub was a fragile method list;
>   `FLOOR_H` was dead; `WALL_H`/`BRICK_H` were "e.g."; top-face colors were
>   ambiguous; `byDepth` had no home; shadows were under-specified. All resolved
>   below.

## 1. Goal

Make the arena read as 3D — a tilted dimetric camera, a ground plane, extruded
blocks with soft depth — while **gameplay, the simulation, and the netcode stay
identical**. This is a renderer-presentation change, not a gameplay change.

Non-goals (out of scope for v1): moving camera (orbit/zoom/pan), 3D physics,
3D meshes, any third-party dependency, any change to input intent or the sim,
parallax, per-biome height maps, separate shadow quads. (See §7 deferred.)

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
- **The 2D and 3D paths share the same `render()` prologue and epilogue** (the
  `consumeEvents`/shake setup and the `drawOverlay`/`updateHud` teardown); only
  the middle draw differs. See §4.4.

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
- **Extrusion convention (pinned):** a block's **ground footprint** is the tile
  diamond at `project(x,y)..project(x+1,y+1)`. Its **top face** is the same
  diamond shifted **up** by `H` (each corner's `sy -= H`). Two side faces
  (front-left, front-right) connect the top face's front edges down to the
  footprint's front edges. The block therefore occupies screen
  `sy ∈ [footprintS_y - H, footprintS_y]` — **the top face is the highest
  point, the footprint is the lowest**. (Standard "blocks sit on the ground"
  isometric look; this is what makes the §4.5 top/bottom margins differ.)
- **Painter entries (complete list — every drawable in the world):**
  - **Floor tile `(x,y)`:** `depth = x+y`, `tier = 0`, `draw` = flat diamond
    filled with the biome floor color (checkerboard `floor0`/`floor1`). No
    extrusion. This is the ground plane.
  - **Wall `(x,y)`:** `depth = x+y`, `tier = 2`, `draw` = three quads — top face
    `= b.wall`, front-left `= shade(b.wall, 0.7)`, front-right `= shade(b.wall,
    0.85)`. Extrusion `WALL_H = 24`.
  - **Brick `(x,y)`:** `depth = x+y`, `tier = 2`, `draw` = three quads — top face
    `= b.brickB`, front-left `= shade(b.brickB, 0.7)`, front-right `=
    shade(b.brickB, 0.85)`. Extrusion `BRICK_H = 14`.
  - **Item (power-up) at `(it.x,it.y)`:** `depth = (it.x+it.y)/TILE`, `tier = 1`,
    billboard: `ctx.save(); ctx.translate(projSx, projSy); drawItemBody(ctx,
    world, it); ctx.restore()` where `(projSx,projSy) = project(it.x/TILE,
    it.y/TILE)`.
  - **Bomb at `(bm.x,bm.y)`:** `depth = (bm.x+bm.y)/TILE`, `tier = 1`, billboard
    via `drawBombBody`.
  - **Blade tile `t` (of blade `bl`) at grid `(t.tx,t.ty)`:** `depth = t.tx+t.ty`,
    `tier = 1`, billboard via `drawBladeBody` at `project(t.tx+0.5, t.ty+0.5)`
    (the tile center). A blade with N tiles contributes N painters.
  - **Enemy at `(e.x,e.y)`:** `depth = (e.x+e.y)/TILE`, `tier = 1`, billboard via
    `drawEnemyBody`.
  - **Player at `(p.x,p.y)`:** `depth = (p.x+p.y)/TILE`, `tier = 1`, billboard via
    `drawPlayerBody`.
  - **fx particle at `(p.x,p.y)`:** `depth = (p.x+p.y)/TILE`, `tier = 1`, `draw`
    = a projected quad/circle of the particle's `color`/`size`, alpha
    `max(0,1-p.t/p.life)`, at `project(p.x/TILE, p.y/TILE)`. (Drawn inline — no
    body extraction; the 2D `drawFx` is left untouched.)
- **Per-entity sprite interface (pinned).** The 2D draw fns in `sprites.js`
  (`drawItems:182`, `drawEnemies:194`, `drawPlayer:235`, `drawBombs:266`,
  `drawBlades:293`) each loop the array and do `c.save(); c.translate(x,y);
  <body>; c.restore()`. **Extract the `<body>`** (the relative-coordinate
  drawing, which already assumes the origin is the entity center) into a
  per-entity function: `drawItemBody(c, world, it)`, `drawEnemyBody(c, world,
  e)`, `drawPlayerBody(c, world, p)`, `drawBombBody(c, world, bm)`,
  `drawBladeBody(c, world, bl, t)`. The 2D fns become thin wrappers (loop +
  `translate` + body) — a **behavior-preserving refactor** (identical 2D
  output). The 3D path calls the body inside `ctx.translate(projSx, projSy)` so
  the same art renders as a billboard. **Billboard anchor = center** (the 2D
  art is centered at origin).
- **Sort comparator (pinned):**
  ```
  byDepth(a, b) = (a.depth - b.depth) || (a.tier - b.tier)
  ```
  Draw back-to-front (ascending). **Tier breaks equal-depth ties as
  floor(0) < entity(1) < block(2).** This is what makes a wall occlude an
  entity resting in the tile directly behind it: that entity's depth equals the
  wall's back-corner depth, and the wall (tier 2) sorts after the entity
  (tier 1), so the wall draws on top.
- **No separate shadows in v1.** The extruded side faces already convey block
  height, and the entity/player sprites draw their own ground-shadow ellipse
  (e.g. `sprites.js:243`). A separate shadow quad is deferred (§7).
- **Top face = flat-color quads.** v1 does **not** reuse the baked square atlas
  for top faces (a square can't be a diamond without a stated transform). It
  fills the diamond + side quads with flat biome colors. (An atlas-textured top
  face is deferred polish — §7.)

### 4.4 Exported interfaces (concrete, all constants defined)

`src/render/r3d/camera.js`:
```
project(gx, gy) -> { sx, sy }          // pure; uses PROJ
PROJ = {                                // frozen module-level constant
  TILE_W: 40, TILE_H: 20,               // = CFG.TILE, CFG.TILE/2
  WALL_H: 24, BRICK_H: 14,              // extrusion heights (pinned)
  PAD: 24,                              // canvas padding (pinned)
  OFF_X: 284, OFF_Y: 48,                // centering offsets (see §4.5)
  canvasW: 608, canvasH: 352,           // backing-store size (see §4.5)
}                                       // no boardW/boardH/FLOOR_H (no consumer)
```

`src/render/r3d/scene3d.js`:
```
buildPainters(world) -> [ { depth, tier, draw(ctx) } ]   // complete list, unsorted
byDepth(a, b) -> number                                  // the §4.3 comparator
shade(rgbHex, factor) -> "rgb(r,g,b)"                    // darkens a #rrggbb string
draw3dBackground(c, world)                               // biome gradient over canvasW×canvasH
```

`renderer.js` 3D path — **shares the 2D prologue/epilogue**, branches only in the
middle:
```
function render(world, dt){
  if(!world) return;
  consumeEvents(world, dt);          // SAME for both kinds: flushes world.events,
                                     // drives fx particles + audio + shake. Without
                                     // this the 3D path leaks world.events and loses
                                     // all audio/fx feedback.
  const shake = getShake();
  ctx.save();
  if(ctx.translate) ctx.translate(Math.round(shake.x), Math.round(shake.y));
  if(kind === "3d"){
    draw3dBackground(ctx, world);
    const ps = buildPainters(world);
    ps.sort(byDepth);
    for(const p of ps) p.draw(ctx);
  } else {
    /* existing 2D draw, unchanged (renderer.js:35-43) */
  }
  ctx.restore();
  if(world.state !== "PLAY")
    drawOverlay(ctx, world,
      kind==="3d" ? PROJ.canvasW : CFG.COLS*CFG.TILE,
      kind==="3d" ? PROJ.canvasH : CFG.ROWS*CFG.TILE,
      kind==="3d" ? 304 : CFG.COLS*CFG.TILE/2,
      kind==="3d" ? 188 : CFG.ROWS*CFG.TILE/2);
  updateHud(hud, world);
}
```
The 3D overlay center `(304, 188) = project(COLS/2, ROWS/2)` (the board center).

### 4.5 Canvas sizing + centering (3D mode)

All derived from `PROJ`. `main.js` imports **`PROJ`** (reads `PROJ.canvasW` /
`PROJ.canvasH`) — it does **not** import `TILE_W`/`TILE_H` (those are internal to
`project`).

```
canvasW = (COLS + ROWS) * (TILE_W / 2) + 2*PAD            // 560 + 48 = 608
OFF_X   = PAD + ROWS * (TILE_W / 2)                        // 24 + 260 = 284
OFF_Y   = PAD + WALL_H                                     // 24 + 24 = 48
canvasH = (COLS + ROWS) * (TILE_H / 2) + OFF_Y + PAD       // 280 + 48 + 24 = 352
```

**Why the top and bottom margins differ (pinned, per the §4.3 convention):**
- **Top** needs `PAD + WALL_H`: the back wall (grid `(0,0)`) top face pokes **up**
  by `WALL_H` above the board's north corner (`sy = OFF_Y`), reaching
  `sy = OFF_Y - WALL_H = PAD`. So `OFF_Y = PAD + WALL_H` gives exactly a `PAD`
  margin at the top.
- **Bottom** needs only `PAD`: the board's lowest point is the front tile's
  **footprint** south corner at `sy = (COLS+ROWS)*TILE_H/2 + OFF_Y = 280 + OFF_Y`.
  Blocks extend **up** from their footprint (never below it), so no extra
  `WALL_H` is needed at the bottom. `canvasH = 280 + OFF_Y + PAD = 352` gives
  exactly a `PAD` margin at the bottom.

**Backing store (matches the 2D path — no DPR):**
```
canvas.width  = canvasW     // logical size, exactly like main.js:17-18 for 2D
canvas.height = canvasH
```
No `devicePixelRatio` scaling and no `ctx.scale` — identical to the existing 2D
path (`main.js:17-18`), which sets the logical size and lets `fit()` CSS-scale.
(A DPR block would diverge from 2D and risk double-scaling with `fit()`;
rejected.)

**`fit()` remains the CSS-scale authority** (`main.js:19-27`): it sets
`canvas.style.width = canvas.width * s` to fit the viewport. `project()`
coordinates live in the `canvasW × canvasH` logical space; `fit()` scales the
whole canvas to the viewport. No double-scaling.

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
   2D or 3D path (shared `consumeEvents`/shake prologue + `drawOverlay`/
   `updateHud` epilogue, per §4.4), and gate `bakeAtlas()` on `kind === "2d"`.
   Surface unchanged. No behavior change to 2D. *Guard: 16 tests (no-regression).*
2. **Projection + unit test.** New `src/render/r3d/camera.js` with `project`
   and `PROJ` (all constants pinned per §4.4/§4.5). **Add `tests/r3d.test.mjs`**
   (matching the existing `check()` harness style in `tests/sim.test.mjs:5-7`):
   - a known tile corner maps to a known `{sx,sy}`;
   - `OFF_X`/`OFF_Y` center the drawn board bbox `sx∈[-260,300], sy∈[0,280]`
     (left/right/bottom margins = `PAD`, top wall top = `PAD`);
   - `sy` is monotonic in `gx+gy`;
   - `OFF_Y >= WALL_H` (top wall not clipped) **and**
     `canvasH - ((COLS+ROWS)*TILE_H/2 + OFF_Y) == PAD` (bottom margin).
     *Guard: the new test.*
3. **Per-entity sprite bodies (behavior-preserving refactor).** In `sprites.js`,
   extract `drawItemBody`/`drawEnemyBody`/`drawPlayerBody`/`drawBombBody`/
   `drawBladeBody` from the existing loop bodies; rewrite the 2D fns as thin
   wrappers (loop + `translate` + body). 2D output is byte-identical. *Guard: 16
   tests + the step-7 smoke test (2D render unchanged).*
4. **Painter list + unit test.** New `src/render/r3d/scene3d.js` with
   `buildPainters`, `byDepth`, `shade`, `draw3dBackground`. **Extend
   `tests/r3d.test.mjs`**:
   - the painter list contains **every floor tile**, every wall, every brick,
     every item, every bomb, every blade tile, every enemy, the player, and every
     fx particle (assert the counts match the world);
   - it sorts correctly by `(depth, tier)`;
   - a front wall sorts after a back entity (different depths);
   - a **behind-wall entity at equal depth** sorts *before* the wall (occluded);
   - `shade("#ffffff", 0.7)` returns a darker `rgb(...)`. *Guard: the new test.*
5. **Canvas sizing + 3D wiring.** In `main.js`, parse `?render=3d` (regex,
   `main.js:75` style); when 3D, set `canvas.width = PROJ.canvasW`,
   `canvas.height = PROJ.canvasH` (no DPR — §4.5), keep `fit()` as the CSS
   authority, and pass `kind:"3d"` to `createRenderer`. Import `PROJ` from
   `camera.js` (read `PROJ.canvasW`/`PROJ.canvasH`). *Guard: 16 tests (input
   untouched).*
6. **Overlay/HUD + visual tuning.** Parameterize `drawOverlay(c, world, w, h,
   cx, cy)` and `drawLogo(c, time, cx, cy)` in `scenes.js` with defaults equal
   to the current 2D values (`w=COLS*TILE, h=ROWS*TILE, cx=w/2, cy=h/2`), so the
   2D call `drawOverlay(c, world)` is unchanged; the 3D path passes
   `(PROJ.canvasW, PROJ.canvasH, 304, 188)`. (`updateHud` is DOM-based —
   `scenes.js:44-59` — and needs no change.) Tune the extrusion heights, shade
   factors, and billboard scale per biome. *Guard: 16 tests.*
7. **Headless render smoke test.** Extend `tests/r3d.test.mjs`: build a world,
   and — because `createRenderer` takes a **canvas** (`renderer.js:12`), not a
   ctx — pass a **fake canvas whose `getContext("2d")` returns a universal Proxy
   stub** (below). Call `render` for both `kind:"2d"` and `kind:"3d"`, assert no
   throw. Append a dated `MEMORY.md` entry. *Guard: the new test.*

> **Universal no-op ctx stub** (robust to any method the 2D/3D path calls):
> ```
> const stub = new Proxy(function(){}, {
>   get:   (t, p) => (p === Symbol.toPrimitive ? () => "" : stub),
>   apply: () => stub,
>   set:   () => true,
> });
> ```
> Every property read returns `stub` (so `ctx.createLinearGradient(...)` →
> `stub`, and `.addColorStop(...)` on it is a no-op), every call returns `stub`,
> every set is a no-op. This sidesteps the existing 2D fallback-ctx bug (a bare
> `{}` at `renderer.js:14-15` throws at the unguarded `ctx.save()` at
> `renderer.js:33`). Optionally also guard `ctx.save/restore` in the 2D path so
> the bare-`{}` fallback stops throwing — a latent-bug fix, kept separate from
> the 3D work.

## 7. Deferred / out of scope (v2 / option c)

- **Separate block/entity shadow quads** (v1 conveys height via extruded side
  faces + the sprites' own ground-shadow ellipses).
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
| 3D occlusion wrong (entity drawn over tall block) | Single depth-sorted list (§4.3) with the pinned `(depth, tier)` comparator; behind-wall case covered by the step-4 test. |
| No ground plane (floating blocks) | Floor tiles are `tier 0` painters in the list (§4.3); step-4 test asserts floor presence. |
| Items / blades / fx invisible in 3D | Complete painter list (§4.3) includes items, bombs, blade tiles, enemies, player, fx; step-4 test asserts the counts match the world. |
| 3D path leaks `world.events` / loses audio + fx | Shared `consumeEvents` prologue in `render()` for both kinds (§4.4). |
| Player snaps to tile centers / self-occludes | Continuous `px/TILE` depth key + billboard at `project(px/TILE, py/TILE)` (§4.2/§4.3), not tile-quantized. |
| Board clipped / off-center on real devices | Canvas sized + centered to the drawn bbox (§4.5); `OFF_Y` reserves `WALL_H` at top, bottom needs only `PAD`; step-2 test asserts both margins. |
| 3D canvas overflows mobile viewport | `fit()` stays the CSS-scale authority (§4.5); §4.5 only sets the logical backing store (no DPR). |
| Mobile perf | 195-cell arena is trivial; constant face count = (walls+bricks)*3 quads + floor diamonds + billboards. |
| Existing 2D path regresses | `kind` defaults to `"2d"`; 2D code path unchanged; both paths coexist; step-7 smoke test covers both. |
| No-op ctx throws (latent bug) | Step 7 uses the universal Proxy stub (§6); optionally guard `ctx.save/restore` in the 2D path. |

## 9. Resolved defaults (no longer open)

- **Camera control:** fixed dimetric tilt, no input stream, v1. (Moving camera
  deferred — §7.)
- **Extrusion convention:** blocks sit on the ground; top face shifted up by
  `H`, footprint is the ground (§4.3). This is why the top margin is
  `PAD+WALL_H` and the bottom is `PAD` (§4.5).
- **Per-tile height:** one pinned constant per type (`WALL_H=24 > BRICK_H=14`).
  (Per-biome height map deferred — §7.)
- **Top face:** flat-color quads — wall `b.wall`, brick `b.brickB` — via
  `shade()`. (Atlas-textured top deferred — §7.)
- **Shadows:** none in v1 (side faces + sprite ellipses convey height).
  (Separate shadow quads deferred — §7.)
- **Render flag:** `?render=3d` only.
