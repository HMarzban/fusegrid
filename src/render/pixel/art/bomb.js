/* PIXEL art: the bomb, its swell, fuse, spark, variant marks and roll.
   Cells are palette-slot string grids (format: ../grid.js and ../palette.js
   headers). An absent cell falls back to the generated placeholder
   (../fallback.js) and stays PENDING on the manifest until it is drawn here. */
export const SHEET = Object.freeze({
  id: "bomb",
  pal: Object.freeze({k: "bomb", K: "bomb.light", o: "stroke", f: "fuse", F: "fuse.shadow", s: "spark", S: "sparkB", w: "spec", p: "pow.pierce", P: "pow.pierce.light"}),
  cells: Object.freeze({}),
});
