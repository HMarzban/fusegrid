# Walls prototype: build notes (2026-10-21, throwaway)

This prototype is local only: it was never merged and never pushed.
- **Branch:** `worktree-agent-a531a182f96a26f7e`.
- **Worktree:** `/Users/macbook/workspace/rollblock/.claude/worktrees/agent-a531a182f96a26f7e`.
- **Commits:** `d099dd4` and on.
- **Base:** `afb983f` (v184). Main's `src/` was checked byte-identical to that base before the "before" captures.

It follows `03-rulings.md`:
- direction **B · LIVING WORLD without cracks**;
- REAL 3D walls brightened by a white per-instance colour;
- the CROWN gilt frame;
- a plain rampart border;
- SHRINK walls drawn as the base block.

## What was built

### `src/render/wallvar.js`: the code picker, render side only

**The hash.** It is the tech plan's `wallHash(seed, level, x, y)` (murmur `fmix32`). It never touches `world.rng`, and there is no sim change.

**The codes:**

| code | piece |
|---|---|
| 0 | base |
| 1 | v1 |
| 2 | v2 |
| 3 | accent (exactly one per room: the pillar with the lowest hash) |
| 4 | border H |
| 5 / 6 | border V, left / right |
| 7 / 8 | corner, top-left / top-right |
| 9 / 10 | corner, bottom-left / bottom-right |

The border takes **no variants**; per the ruling it is a plain rampart.

**Distribution.** Measured over 400 seeds × 8 rooms (`tools/walls/check.mjs`):
- pillars: base 53.3%, v1 22.1%, v2 21.0%, accent 3.6%;
- exactly one accent in every one of the 3,200 rooms.

**Deviation from the tech prototype (fixing two bugs the reviewer flagged):**
- **Snapshot instead of recompute.** The wall mask is snapshotted the first time a `world.grid` object is seen, and is never recomputed for that grid. The tech prototype recomputed on `shrinkGen`, so a SHRINK wall could become a pillar or steal the accent. Now SHRINK walls read 0, the base block, and pillars keep their code. Both are checked.
- **WeakMap memo.** The memo is a `WeakMap` keyed by grid, not a single slot. Without that, the show, demo and game worlds thrash one cache.

### `src/render/wallart.js`: one shape list per (biome, code)

Every piece is authored once, in wall SLOTS only:
- `wall`, `wall.outline`, `wall.shadow`, `wall.light`;
- `wallHi`, `wallHi.light`, `wallHi.shadow`.

Each look resolves those slots its own way:
- **CLASSIC:** black or white over the base, the sprites.js idiom.
- **PIXEL:** `pxRamp`, plus the family remaps from 01-art.md.

**Grammar.** This is grammar G from 01-art.md:
- a chamfered monolith (square corners, while bricks keep their round ones);
- an edge ring (SAND `wall.outline`, VOID `wallHi.shadow`);
- a face band `faceRows(hWall)*2` tall;
- a 36×16 cap with a bevel.

**Damage replaced by built detail** (this is the ruling's list, plus three more that the reviewer flagged):

| World | From 01-art.md | Now |
|---|---|---|
| JUNGLE v1 | root crack | **root wrap**: a smooth Catmull-Rom tube with a lit core, wrapping the cap and down the side |
| JUNGLE accent | root-bound | kept, also redrawn as lit tubes |
| ICE v1 | frost cracks | **carved runes** (two pale runes on the face) |
| ICE accent | "frost scratches" | **straight carved lines** |
| FACTORY v2 | dent | **bolted strap** |
| ARENA v2 | chipped | **carved column** |
| ARENA accent | laurel | kept, now detached leaves, so it never reads as an arrow |
| SAND v2 | erosion pits | **beam ends** (three even, built sockets) |
| VOID v1 | crystal seam | **inlaid crystal line** (straight, no branching) |
| VOID v2 | fractured cap | **faceted cap plus a gem inlay** |
| CROWN v2 | worn gilt | **gilt studs** (square) |

Everything else follows the 01-art.md table.

**ARENA PIXEL protan fix.** The PIXEL cap runs full width. The ARENA marks are a raised relief:
- in CLASSIC, `wallHi.light` with a `wall.shadow` lip;
- in PIXEL, `wall.light`, through a per-look slot `"a|b"`.

The measurement drove this: dark carvings dropped protan below the gate.

### CLASSIC 2D (`sprites.js`)

- **One painter.** `paintWall(c, b, code, px, py)` is used by both the bake and the vector fallback.
- **Bake.** `BAKED.wallV[bi]` holds 11 canvases per biome. `BAKED.wall[bi]` is now the new base block, so iso also shows it.
- **Drawing.** `drawGrid` makes one `drawImage` per wall, as today.

### REAL 3D (`three/`)

**The strip.**
- `textures.js` builds `wallStrip` (440×80) from the 2D bake.
- **Top row:** each code's cap region (rows 0..faceY), stretched over the box top. V and top-corner pieces use the whole cell.
- **Bottom row:** the face band (faceY..38) for the box sides. V and top-corner pieces use the base block's band.
- So the 2D fake bevel is no longer painted onto a real box.

**The shader.**
- `materials.js` adds an `onBeforeCompile` vertex patch.
- `aWv` picks the column; `step(0.5, abs(normal.y))` picks top or side.
- The cache key is `customProgramCacheKey "wallv11"`.

**The scene.**
- `scene.js` writes `aWv` per instance (capacity 195, ranged upload).
- **The instance colour is white.** This removes the double multiply.
- **Stale-variant guard:** `wDiff` is forced on a new `world.grid` or a new `seed`. This is checked: a new seed at the same level refreshes `aWv`.

**Unchanged:**
- the near-wall cutaway (the near row is border or corner only: codes 4, 9, 10);
- the rim, the lights and the camera;
- the brick double multiply (out of scope).

### PIXEL

- **Generator.** `tools/walls/genpx.mjs` turns the shape lists into palette-SLOT string grids in `src/render/pixel/art/walls.js`. That is 64 cells: 8 per biome, with vr / ctr / cbr mirrored at bake.
  - It uses the concept sampler.
  - A 2D-only highlight (`npx`) is skipped in PIXEL, so the roots do not dot.
- **Atlas.** `atlas.js` pre-composes each wall over floor0 / floor1, so the chamfer corners show the board. That is still one `drawImage` per wall.
- **Manifest and fallback.** `manifest.js` has gained the 64 `walls/*` keys. `fallback.js` has a `walls` branch.

## Numbers

### PIXEL bytes (the cap is ignored in this throwaway)

| | bytes |
|---|---|
| px tree before | 124,157 |
| px tree after | **142,904** (139.6 KB; +18,747) |
| of which `art/walls.js` | 17,640 |
| cap (122 KB) | 124,928 |
| **over the cap by** | **17,976** |

Not counted in the px tree: `wallart.js` (14.8 KB) and `wallvar.js` (2.9 KB). They sit on the boot graph.

### REAL 3D draws

These are real `--gpu` frames, rooms 1–8, before and after.

| | before | after |
|---|---|---|
| scene `countDrawCalls` | **141** | **141** |
| GL calls per frame | 29 / 35 / 37 / 37 / 45 / 53 / 55 / 65 | identical |
| triangles | 4,062 … 7,187 | identical |

### CLASSIC 2D per-frame cost

The run was headless Chrome with a Metal GPU, at 1366×768, dpr 2, seed 4242, in rooms 1, 5 and 8. Each sample is 100 `drawGrid` calls into a 600×520 canvas plus a `getImageData` flush, with the median of 21 taken.

| | `drawGrid` |
|---|---|
| main | 0.203–0.206 ms |
| prototype | 0.212–0.213 ms |
| difference | **+0.008 ms (about 4%)** |

- **Where the time goes.** The `drawImage` count is the same as before. The difference is the WeakMap lookup and the typed-array read.
- **Full render.** `render ×10` stayed 0.12–0.14 ms on both, because render-on-change skips the still board.
- **Bake.** Painting 88 wall canvases took **31 ms** on the laptop, including a forced readback per canvas. That is over the tech plan's 8 ms phone gate.
  - The fallback is a lazy per-biome bake: 11 canvases, about 4 ms.

### Readability

Run `node tools/walls/measure.mjs`. It gives tile-mean ΔE as true / protan / deutan / tritan, compared against the live v184 tile.

**Under-14 pairs: every drop is ≤ 0.5.**

| World | Look | Pair (sim) | Today → prototype |
|---|---|---|---|
| WATER | 2D | wall vs brick (protan) | 6.9 → 6.4 |
| WATER | 2D | wall vs brick (deutan) | 2.1 → 1.7 |
| ARENA | 2D | wall vs brick (protan) | 10.3 → 9.9 |
| ARENA | PX | wall vs brick (protan) | 6.5 → **6.4** (01-art.md's open item, now within tolerance) |
| VOID | 2D | wall vs brick (tritan) | 2.2 → 1.7 |
| JUNGLE | PX | wall vs brick (deutan) | 12.8 → 12.5 |

**Rises:**

| World | Look | Pair (sim) | Today → prototype |
|---|---|---|---|
| CROWN | 2D | wall vs brick (tritan) | 14.6 → 17.1 |
| CROWN | PX | wall vs brick (tritan) | 19.0 → 25.5 |
| VOID | PX | wall vs brick (tritan) | 5.0 → 7.3 |
| WATER | PX | wall vs brick (deutan) | 5.2 → 8.9 |

**Pairs that clear 14 still clear 14.**
- The lowest are PX ICE wall vs floor, protan 14.2, and PX SAND, tritan 14.9.

**VOID PIXEL cap share** is 54–60%, against the ≥ 35% gate.

## Staging (the close-ups)

`closeup-families.png` crops come from **real frames** in each look: seed 4242, rooms 1–8.

**The forced codes.** The pillar codes are forced by a debug override, `setWallOverride` in `wallvar.js`, by column:

| column | code |
|---|---|
| x = 2 | base |
| x = 4 | v1 |
| x = 6 | v2 |
| x = 8 | accent |

The override is followed by a new grid object (`G.grid = G.grid.slice()`), so 2D, PIXEL and 3D all refresh.

**The tiles shown:**
- pillars on row y = 2;
- border H at (6, 12);
- border V at (0, 5);
- corner at (0, 12), the bottom-left.

The top row is avoided because the HUD covers it.

**3D crop boxes** are projected through the live camera. They are a little loose.

**The before/after boards are not staged.** They are the plain hash pick: the same seed and room on main and on the prototype, with foes frozen (`speed = 0`) and SHRINK held off.

## Captures

All captures are in this folder:
- `ba-<look>-room<n>-before.png` and `-after.png`: 900 px wide, cropped to the `#c` board box, at 1366×768 dpr 2. The `--gpu` (ANGLE Metal) headless shell 1248 was used for all three looks.
- `sheet-2d.png` (0.93 MB), `sheet-px.png` (1.04 MB) and `sheet-3d.png` (1.05 MB): 8 rooms, BEFORE above AFTER.
- `phone-2d-room1.png` and `phone-2d-room7.png`: CLASSIC 2D after, phone preset 393×852 dpr 3.
- `closeup-families.png`.

**Drivers.** These are throwaway scratchpad scripts: `cap.mjs`, `compose.mjs` and `perf.mjs`. They import the `tools/pixel/shot.mjs` helpers.

## `node --test` in the worktree: 55 / 59 pass

The baseline was 59 / 59. **All four failures are expected re-pins:**

| Test | Failure | Re-pin |
|---|---|---|
| `classic-perf` and `pixel-render` | CLASSIC call-log hash `97480c1c:22630` → **`186c1c19:27916`** | Base code 0 is now a redesigned block, so the tech plan's insert-only diff proof **no longer applies**. The re-pin needs a ruling plus visual review, not a subsequence proof. |
| `pixel-render` | px JS ≤ 122 KB | 139.6 KB; needs #15 or a cap ruling |
| `pwa` | `PRECACHE` lacks three new files | add `wallvar.js`, `wallart.js` and `pixel/art/walls.js` |
| `three.test` | "refreshed walls keep the per-instance checker colours" | the instance colour is now white, by ruling |

**Unexpected failures: none.**

These pass unchanged:
- `gfx-identity`, `pixel-art` (manifest, slots, fallback) and `pixel-parity`;
- `items-art`, `pixel-mako`, `keys`, `headless` and `r3d`;
- the 3D 141 pins.

## Known nits and open items

- **Bottom-corner dog-ear.** The bottom corner pieces show a small notch at the top right, where the column's playfield shadow ends. It reads fine on the board but odd in isolation.
- **3D top of the roots.** The JUNGLE root wrap crosses the cap/face line, so in 3D its path breaks at the box edge.
- **ARENA relief is subtle.** In CLASSIC the ARENA relief marks are the quietest family; the CVD gate traded that.
- **VOID 2D cap reads grey-violet,** which is per spec.
- **No PIXEL cap fix in this build.** It needs #15 (the lazy tree) or a cap ruling.
- **Housekeeping.**
  - Every server and browser this round started was stopped by PID.
  - Two perf runs hung. They were killed by PID and replaced by `perf.mjs`.
  - Those two runs leaked their temp profiles: `$TMPDIR/fg-px-HyQM60` and `fg-px-CemHQ5`. The sandbox denied the `rm`, so delete them by hand.
