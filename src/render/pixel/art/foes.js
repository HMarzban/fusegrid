/* PIXEL art: the foe cast, rooms 1-8 (cells keyed <type>.<cell>).
   Cells are palette-slot string grids (format: ../grid.js and ../palette.js
   headers). An absent cell falls back to the generated placeholder
   (../fallback.js) and stays PENDING on the manifest until it is drawn here. */
export const SHEET = Object.freeze({
  id: "foes",
  pal: Object.freeze({o: "body.outline", s: "body.shadow", b: "body.base", l: "body.light", e: "eye", E: "eye.shadow", k: "ink", w: "spec"}),
  cells: Object.freeze({}),
});
