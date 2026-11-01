/* The CLASSIC 2D colour-vision recipe (#33), one walk for both sides, with no imports so the page can load it: gates.mjs rasterizes it in Chrome (cvs = a real 160 px
   canvas) and cvdstamp.mjs records it in Node (cvs = a call log), so the stamp always covers exactly the calls the Chrome measure paints. mods = {F: featdraw, FL:
   floorart, SP: sprites, C: config}; ENT = CVD_ENT. */
export function cvdRecipe({F, FL, SP, C}, ENT, cvs) {
  const out = [], refs = {};
  for (const [id, bn, s] of ENT) {
    const b = C.BIOMES.find((x) => x.name === bn), V = [...Array(FL.FLOOR_V).keys()];
    refs[bn] = refs[bn] || {
      floor: [0, 1].flatMap((p) => V.map((v) => cvs((g) => FL.paintFloor(g, b, p, v)))),
      wall: [0, 1].flatMap((p) => [0, 1, 2, 3].map((c) => cvs((g) => { FL.paintFloor(g, b, p, 0); SP.paintWall(g, b, c, 0, 0); }))),
      brick: [0, 1].map((p) => cvs((g) => { FL.paintFloor(g, b, p, 0); SP.paintBrick(g, b); })),
      brickHex: [b.brickA, b.brickB],
    };
    out.push({id, bn, heats: [0, 1, 2].map((h) => cvs((g) => F.paintCell(g, b, {...s, h}))), ref: bn});
  }
  return {out, refs};
}
