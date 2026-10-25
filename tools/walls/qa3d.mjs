#!/usr/bin/env node
/* Round 3 (throwaway): REAL 3D in-game QA board from rig3d.mjs frames (the
   composited page at 1366x768 dpr 2, rig C, STANDARD dist 1503). Crops the
   board box of rooms 1..8 for one candidate, halves it and tiles 4x2.
   node tools/walls/qa3d.mjs <rig3dDir> <cand> <out.png> */
import {readFileSync, writeFileSync} from "node:fs";
import {unpng, png, blank, paste, label, bilinear} from "../pixel/rgba.mjs";
const [dir, k, out] = process.argv.slice(2);
const X = 560, Y = 220, W = 1640, H = 1060, S = 0.5, cw = W * S, ch = H * S, G = 12;
const sheet = blank(4 * cw + 5 * G, 2 * ch + 3 * G + 30, "#05070d");
label(sheet, G, 8, 2, `REAL 3D IN-GAME QA - ROUND 3 WALLS (${k}) - RIG C STANDARD - ROOMS 1-8 (SEED 4242, PILLAR CODES BY COLUMN, FOES FROZEN)`, [255, 220, 120]);
for (let r = 1; r <= 8; r++) {
  const im = unpng(readFileSync(`${dir}/${k}-room${r}.png`)), cut = blank(W, H, "#000");
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = ((Y + y) * im.width + X + x) * 4, d = (y * W + x) * 4; for (let q = 0; q < 4; q++) cut.data[d + q] = im.data[s + q]; }
  paste(sheet, bilinear(cut, cw, ch), G + ((r - 1) % 4) * (cw + G), 30 + Math.floor((r - 1) / 4) * (ch + G), 1);
}
writeFileSync(out, png(sheet));
console.log("wrote", out);
