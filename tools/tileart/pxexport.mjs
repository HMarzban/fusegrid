/* PIXEL export (Node, no browser): featPxCell -> cellRGBA (palette slots via
   pxRamp) -> NEAREST x9 (180 px) centred on a clear 192 canvas. Also writes
   a review sheet when given a path, and prints cell validity + coverage
   (mark-slot "M" px + edge-strip mark px, of 400). */
import {writeFileSync} from "node:fs";
import {BIOMES} from "../../src/core/config.js";
import {featPxCell} from "../../src/render/featpx.js";
import {cellRGBA, validateCell} from "../../src/render/pixel/grid.js";
import {surfRGBA, blank, paste, png} from "../pixel/rgba.mjs";
import {OUT, TILES, HEAT} from "./harness.mjs";
const sheet = process.argv[2], rep = [];
const S = sheet ? blank(3 * 200, TILES.length * 200, "#0b0f1a") : null;
TILES.forEach(([w, p, bn, sp], r) => HEAT.forEach((hn, h) => {
  const b = BIOMES.find((x) => x.name === bn), c = featPxCell(bn, {...sp, h, exit: false});
  const errs = validateCell(c, c.pal);
  const img = surfRGBA(20, 20, cellRGBA(c, c.pal, {biome: b}));
  const big = blank(192, 192); paste(big, img, 6, 6, 9);
  writeFileSync(OUT + "px/" + w + "-" + p + "-" + hn + ".png", png(big));
  if (S) paste(S, img, h * 200 + 6, r * 200 + 6, 9);
  const marks = c.rows.join("").split("").filter((ch) => ch === "M" || ch === "Q" || ch === "F").length;
  rep.push({tile: w + "-" + p, heat: hn, errs: errs.length ? errs : 0, markPx: marks, cov: +(marks / 4).toFixed(1)});
}));
if (S) writeFileSync(sheet, png(S));
console.log(JSON.stringify(rep).replace(/},{/g, "},\n{"));
