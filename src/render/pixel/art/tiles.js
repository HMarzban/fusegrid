/* PIXEL art: one tile template per class, baked per biome from BIOMES slots.
   Cells are palette-slot string grids (format: ../grid.js and ../palette.js
   headers). An absent cell falls back to the generated placeholder
   (../fallback.js) and stays PENDING on the manifest until it is drawn here. */
export const SHEET = Object.freeze({
  id: "tiles",
  pal: Object.freeze({a: "tile.floor0", A: "tile.floor0.light", z: "tile.floor0.shadow", c: "tile.floor1", C: "tile.floor1.light", y: "tile.floor1.shadow", w: "tile.wall", W: "tile.wall.shadow", X: "tile.wall.outline", h: "tile.wallHi", b: "tile.brickA", B: "tile.brickB", m: "tile.brickB.shadow", i: "tile.brickHi", d: "tile.bg1"}),
  cells: Object.freeze({}),
});
