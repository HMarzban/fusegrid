#!/usr/bin/env node
/* Round 3 (throwaway): a still frame cannot show crawl, so this compares two
   frames of the SAME room a 4-unit wheel dolly apart (rig3d.mjs --shimmer)
   over the board box: mean |dRGB| and the share of pixels that change by
   more than 48 (a flicker-size step). A candidate whose numbers stay at the
   flat-strip baseline (A) adds no shimmer at play distance.
   node tools/walls/shimmer.mjs <dir> A,D 1,2,3 [x y w h] */
import {readFileSync} from "node:fs";
import {unpng} from "../pixel/rgba.mjs";
const [dir, cs, rs, ...box] = process.argv.slice(2);
const [X, Y, W, H] = box.length ? box.map(Number) : [820, 380, 1100, 780];
for (const r of rs.split(",")) {
  const row = [];
  for (const k of cs.split(",")) {
    const a = unpng(readFileSync(`${dir}/${k}-room${r}.png`)), b = unpng(readFileSync(`${dir}/${k}-room${r}-w.png`));
    let s = 0, big = 0, n = 0;
    for (let y = Y; y < Y + H; y++) for (let x = X; x < X + W; x++) { const i = (y * a.width + x) * 4; let d = 0; for (let q = 0; q < 3; q++) d += Math.abs(a.data[i + q] - b.data[i + q]); s += d / 3; if (d / 3 > 48) big++; n++; }
    row.push(`${k} mean ${(s / n).toFixed(2)} flick ${((big / n) * 100).toFixed(2)}%`);
  }
  console.log("room " + r + ": " + row.join(" | "));
}
