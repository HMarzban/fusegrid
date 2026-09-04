# Pickup 3D faces (2026-09-04)

Leftover from the 2026-09-03 cabinet pass: REAL 3D in-arena items are still
**cube + ring**. 2D / ITEMS / HUD already share `drawIcon`. 3D faces still
used a parallel `GLYPH` table, so a spinning cube did not read as FLAME /
BOMB / KICK.

Public name Fusegrid / FUSE/GRID. Never Bomberman on any surface.

## Approaches

1. **`drawIcon` on the existing cube (pick).** One 64² navy face per
   `POWER.t`: fill `#0b1020`, translate(32,32), scale 2.35, call `drawIcon`.
   Atlas key stays `item_<t>`. Same Lambert cube + additive ring. Slot stays
   2 meshes. Fat-world draw calls stay **186**.

2. **Twelve unique mesh stacks.** Torch / boot / star as real geometry.
   Readable, but +1–3 meshes per slot blows the child-index ABI and the 186
   pin.

3. **Billboard decal child.** Extra plane on the cube. +32 draws on a fat
   world (218). Same ABI break.

**Pick 1.** Canvas atlas, no new meshes, no per-biome camera. Frozen rig
`{az:0, el:0.419, dist:1000}`. Kind `"2d"` must not import three —
`paintItemFace` lives in `sprites.js` next to `drawIcon`.

## Rule

- `POWER[].t` / `name` / `apply` / `permanent` unchanged.
- `SLOT_MESH.item === 2`. Do not flex `three.test.mjs` child-index contracts.
- Headless (no atlas) stays POWER-bright Lambert + ring (never a dark plate
  material).
- Textured path: white Lambert × `item_<t>` (navy + cabinet glyph on all six
  faces). Ring still `pdef.col`.
- Delete the `GLYPH` table in `textures.js`. One silhouette source.
- Bob / spin / ring pulse stay render-side only.

## Tests

`tests/three.test.mjs` + `tests/pickups.test.mjs`:

- Each of the 12 `item_*` atlas sources covers that kind's `drawIcon` path
  commands (quad / bezier / arc / fillRect / arcTo counts).
- 12 face signatures are pairwise distinct.
- Fat-world draw calls === 186. `SLOT_MESH.item === 2`.

## Out of scope

Collect burst FX, grab SFX retune, enemy art, mid-run heat, Sudden Death,
internet play, extra item types, applyPower changes.
