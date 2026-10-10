/* PIXEL art: one tile template per class, baked per biome from BIOMES slots.
   Cells are palette-slot string grids (format: ../grid.js and ../palette.js
   headers). An absent cell falls back to the generated placeholder
   (../fallback.js) and stays PENDING on the manifest until it is drawn here.
   Direction A (G0 2026-10-10): flat floors; WALL = a wallHi cap band (8 rows,
   1-px wallHi.light bevel) over the wall base, a dark wall.shadow face and two
   rivets on the face strip; BRICK = two courses plus a short one, two mortar
   runs and staggered joints in brickB, a brickA.light edge on top and both
   sides, a short brickB face. Faces are strips cut to the ENV-2 rows by the
   atlas. Crumble is rubble chunks pushed to the corners and margins (the
   blade covers the middle); slam is an impact flash over the finished wall.
   Floor motifs are blank by ruling R-G0-6 (flat floors, frozen). */
const A = "art-tiles";
const c = (rows) => ({w: rows[0].length, h: rows.length, author: A, rows});
const R = (row, n) => Array(n).fill(row);
const E = "....................", BLANK = c(R(E, 20));

export const SHEET = Object.freeze({
  id: "tiles",
  pal: Object.freeze({a: "tile.floor0", c: "tile.floor1", H: "tile.wallHi.light", h: "tile.wallHi", w: "tile.wall", W: "tile.wall.shadow", b: "tile.brickA", B: "tile.brickB", j: "tile.brickA.light", m: "tile.brickB.shadow"}),
  cells: Object.freeze({
    floor0: c(R("aaaaaaaaaaaaaaaaaaaa", 20)),
    floor1: c(R("cccccccccccccccccccc", 20)),
    wallTop: c(["HHHHHHHHHHHHHHHHHHHH", ...R("hhhhhhhhhhhhhhhhhhhh", 7), ...R("wwwwwwwwwwwwwwwwwwww", 12)]),
    wallFace: c(["WWWWWWWWWWWWWWWWWWWW", "WWWhWWWWWWWWWWWWhWWW", "WWWwWWWWWWWWWWWWwWWW", ...R("WWWWWWWWWWWWWWWWWWWW", 7)]),
    brickTop: c([
      "jjjjjjjjjjjjjjjjjjjj", ...R("jbbbbbbbbbBbbbbbbbbj", 5),
      "jBBBBBBBBBBBBBBBBBBj", ...R("jbbbbBbbbbbbbbBbbbbj", 5),
      "jBBBBBBBBBBBBBBBBBBj", ...R("jbbbbbbbbbBbbbbbbbbj", 7),
    ]),
    brickFace: c([...R("jjbBBBBBBBBBBBBBBbjj", 10)]),
    crumble0: c([
      "jjjjjjjBjjjjjjjjjjjj",
      "jbbbbbbBbbBbbbbbbbbj",
      "jbbbbbbbBbBbbbbbbbbj",
      "jbbbbbbbBbBbbbbBbbbj",
      "jbbbbbbbbBBbbbbBbbbj",
      "jbbbbbbbbBBbbbBbbbbj",
      "jBBBBBBBBBBBBBBBBBBj",
      "jbbbbBbbbbBbbbBbbbbj",
      "jbbbbBbbbbbBbbBbbbbj",
      "jbbBbBbbbbbBbbBbbbbj",
      "jbBbbBbbbbbbBbBbbbbj",
      "jbbbbBbbbbbbBbBbbbbj",
      "jBBBBBBBBBBBBBBBBBBj",
      "jbbbbbbbbbBBbbbbbbbj",
      "jbbbbbbbbbBbBbbbbbbj",
      "jbbbbbbbbbBbBbbbbbbj",
      "jbbbbbbbbbBbbbbbbbbj",
      "jbbbbbbbbbBbbbbbbbbj",
      "jbbbbbbbbbBbbbbbbbbj",
      "jbbbbbbbbbBbbbbbbbbj",
    ]),
    crumble1: c([
      "jjjjjjjj..jjjjjjjjj.",
      "jbbbbbbBm.jbbbbbbbBm",
      "jbbbbbbBm.bbbbbbbbBm",
      "jbbbbbBBm..bbbbbbBBm",
      ".BBBBBBm...BBBBBBBm.",
      "..mmmmm.....mmmmmm..",
      "jjjj..jjjjjjjj..jjj.",
      "jbbBm.jbbbbbbBm.jbBm",
      "bbbBm.bbbbbbbBm.bbBm",
      "bbBBm..bbbbbBBm.bBBm",
      ".BBm...BBBBBBm..BBm.",
      "..m.....mmmmm...mm..",
      "jjjjjjj..jjjjjjjjj..",
      "jbbbbbBm.jbbbbbbbBm.",
      "jbbbbbBm.bbbbbbbbBm.",
      "jbbbbBBm..bbbbbbBBm.",
      "jbbbbBBm..bbbbbbBBm.",
      ".BBBBBm...BBBBBBBm..",
      "..mmmm.....mmmmmm...",
      "....................",
    ]),
    crumble2: c([
      "jjjB............jjB.",
      "jbbBm...........bbBm",
      ".BBm..jB.........Bm.",
      "..m...Bm.........m..",
      "................jB..",
      ".jB.............Bm..",
      ".Bm.................",
      "....................",
      "jB................jB",
      "Bm................Bm",
      "....................",
      ".jB..............jB.",
      ".Bm..............Bm.",
      "....................",
      "jjB.............jjjB",
      "bbBm............bbBm",
      ".Bm..............BBm",
      "..m...............m.",
      "....................",
      "....................",
    ]),
    crumble3: c([
      "jB................jB",
      "Bm................Bm",
      "....................",
      "..j..............j..",
      "..m..............m..",
      "....................",
      "....................",
      "....................",
      "j..................j",
      "m..................m",
      "....................",
      "....................",
      "....................",
      ".jB..............jB.",
      ".Bm..............Bm.",
      "....................",
      "B..................B",
      "m..................m",
      "....................",
      "....................",
    ]),
    slam0: c([
      "HHHHHHHHHHHHHHHHHHHH", "HHHHHHHHHHHHHHHHHHHH", ...R(E, 12), ".HH..............HH.",
      "HHHH............HHHH", "HHhHH..........HHhHH", ".HHHHH........HHHHH.",
      "HHhhHH........HHhhHH", "HHHHHHH......HHHHHHH",
    ]),
    slam1: c([
      ...R(E, 11), ".H................H.", "HHH..............HHH", "HhH..............HhH",
      ".H..HH........HH..H.", "...HhHH......HHhH...", "HH..HH........HH..HH",
      "HhH..............HhH", ".H................H.", E,
    ]),
    slam2: c([
      ...R(E, 12), "H..................H", E, "..h..............h..",
      E, "h..................h", E, "..H..............H..", E,
    ]),
    "motif.JUNGLE.0": BLANK, "motif.JUNGLE.1": BLANK, "motif.ICE.0": BLANK, "motif.ICE.1": BLANK,
    "motif.FACTORY.0": BLANK, "motif.FACTORY.1": BLANK, "motif.WATER.0": BLANK, "motif.WATER.1": BLANK,
    "motif.ARENA.0": BLANK, "motif.ARENA.1": BLANK, "motif.SAND.0": BLANK, "motif.SAND.1": BLANK,
    "motif.VOID.0": BLANK, "motif.VOID.1": BLANK, "motif.CROWN.0": BLANK, "motif.CROWN.1": BLANK,
  }),
});
