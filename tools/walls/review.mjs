#!/usr/bin/env node
/* Detail pass (throwaway): a review sheet of the exported tiles for the art
   lead (not the owner page): per world, today then base v1 v2 acc border in
   each look, at a fixed cell size. node tools/walls/review.mjs <wallsDir> <out.png> [cell] */
import {readFileSync, writeFileSync, existsSync} from "node:fs";
import {join} from "node:path";
import {unpng, png, blank, paste, bilinear, label} from "../pixel/rgba.mjs";
import {BIOMES} from "../../src/core/config.js";
const D = process.argv[2], OUT = process.argv[3], C = +(process.argv[4] || 96);
const W = (process.env.W || "jungle,ice,factory,water,arena,sand,void,crown").split(","), P = ["wall-today", "base-new", "v1-new", "v2-new", "acc-new", "border-new"], L = (process.env.L || "2d,px,3d").split(",");
const G = 6, colW = C + G, grpW = colW * P.length + 18;
const out = blank(90 + grpW * L.length, 30 + W.length * (C + G), "#05070d");
L.forEach((l, k) => label(out, 90 + k * grpW, 8, 2, l.toUpperCase() + ": TODAY | BASE V1 V2 ACC BORDER", [255, 220, 120]));
W.forEach((w, r) => {
  label(out, 6, 30 + r * (C + G) + C / 2 - 6, 2, w.toUpperCase());
  L.forEach((l, k) => P.forEach((p, i) => {
    const f = join(D, l, w + "-" + p + ".png");
    if (!existsSync(f)) return;
    const im = unpng(readFileSync(f)), sc = im.width === C ? im : bilinear(im, C, C);
    const x = 90 + k * grpW + i * colW + (i ? 10 : 0), y = 30 + r * (C + G);
    paste(out, blank(C, C, BIOMES.find((b) => b.name.toLowerCase() === w).floor0), x, y); paste(out, sc, x, y);
  }));
});
writeFileSync(OUT, png(out));
console.log("wrote", OUT, out.width + "x" + out.height);
