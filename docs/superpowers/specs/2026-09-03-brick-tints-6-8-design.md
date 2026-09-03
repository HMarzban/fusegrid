# Brick tints rooms 6–8 (2026-09-03)

SAND / VOID / CROWN palettes already define `brickA` / `brickB` / `brickHi` in
`BIOMES`. 2D atlas + real 3D texture path used them; legacy iso (`r3d/scene3d.js`)
still shaded only `brickB`.

## Fix

- Iso block painter: top `brickA`, left `shade(brickB)`, right `shade(brickHi)`.
- Real 3D unchanged (atlas brick tile per biome).
- No draw-call budget change.

## Tests

- `headless.test.mjs` rooms 6–8 palette names pin stays.
- New pin: SAND/VOID/CROWN `brickA` hexes differ pairwise.
