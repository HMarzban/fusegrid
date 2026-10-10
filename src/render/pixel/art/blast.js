/* PIXEL art: the blast pieces (CELL), CROSS / STRAIGHT / END x grow / full / thin.
   Cells are palette-slot string grids (format: ../grid.js and ../palette.js
   headers). An absent cell falls back to the generated placeholder
   (../fallback.js) and stays PENDING on the manifest until it is drawn here. */
export const SHEET = Object.freeze({
  id: "blast",
  pal: Object.freeze({0: "blast0", 1: "blast1", 2: "blast2", 3: "blast3", o: "stroke"}),
  cells: Object.freeze({}),
});
