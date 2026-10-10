/* PIXEL art: MAKO, the reef critter (12 cycle cells, 13 one-shots, 3 state overlays).
   Cells are palette-slot string grids (format: ../grid.js and ../palette.js
   headers). An absent cell falls back to the generated placeholder
   (../fallback.js) and stays PENDING on the manifest until it is drawn here. */
export const SHEET = Object.freeze({
  id: "mako",
  pal: Object.freeze({o: "body.outline", s: "body.shadow", b: "body.base", l: "body.light", f: "fin", F: "fin.light", g: "fin.shadow", t: "feet", T: "feet.light", e: "eye", E: "eye.shadow", k: "ink", w: "spec", r: "shieldc", p: "passc"}),
  cells: Object.freeze({}),
});
