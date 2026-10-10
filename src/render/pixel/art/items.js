/* PIXEL art: the 12 pickups and their chrome (well, family rings).
   Cells are palette-slot string grids (format: ../grid.js and ../palette.js
   headers). An absent cell falls back to the generated placeholder
   (../fallback.js) and stays PENDING on the manifest until it is drawn here. */
export const SHEET = Object.freeze({
  id: "items",
  pal: Object.freeze({d: "well", r: "body", R: "body.light", s: "body.shadow", o: "body.outline", e: "eye", k: "ink", w: "spec"}),
  cells: Object.freeze({}),
});
