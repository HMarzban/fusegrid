/* PIXEL art: reveal, sparkle, glint and the shared foe kill puff.
   Cells are palette-slot string grids (format: ../grid.js and ../palette.js
   headers). An absent cell falls back to the generated placeholder
   (../fallback.js) and stays PENDING on the manifest until it is drawn here. */
export const SHEET = Object.freeze({
  id: "fx",
  pal: Object.freeze({w: "spec", 1: "blast1", 2: "blast2", b: "body", B: "body.light", s: "body.shadow"}),
  cells: Object.freeze({}),
});
