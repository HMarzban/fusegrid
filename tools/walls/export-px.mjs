#!/usr/bin/env node
/* Detail pass 2026-10-23 (throwaway): PIXEL wall cells alone, from the
   game's own cell data through cellRGBA (transparent "."), NEAREST to 192.
   new = this worktree's ART.walls; today = main's composed wallTop+wallFace
   (atlas.js composeFace at faceRows(hWall)), imported from a git archive of
   afb983f passed as argv[3]. argv[2] = out dir (…/walls). */
import {mkdirSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {png, createRGBA} from "../pixel/rgba.mjs";
const OUT = process.argv[2], MAIN = process.argv[3];
const imp = (root, p) => import(pathToFileURL(join(root, p)).href);
const HERE = new URL("../../", import.meta.url).pathname;
const N = 192;
function up(cell, pal, ctx, cellRGBA) {
  const d = cellRGBA(cell, pal, ctx), o = createRGBA(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const sx = Math.floor((x * cell.w) / N), sy = Math.floor((y * cell.h) / N), i = (sy * cell.w + sx) * 4, j = (y * N + x) * 4; for (let k = 0; k < 4; k++) o.data[j + k] = d[i + k]; }
  return o;
}
mkdirSync(join(OUT, "px"), {recursive: true});
const files = [];
{ const {BIOMES} = await imp(HERE, "src/core/config.js"), {ART} = await imp(HERE, "src/render/pixel/art/index.js"), {cellRGBA} = await imp(HERE, "src/render/pixel/grid.js");
  for (const b of BIOMES) for (const [n, c] of [["base", "base"], ["v1", "v1"], ["v2", "v2"], ["acc", "acc"], ["border", "h"]]) {
    const f = "px/" + b.name.toLowerCase() + "-" + n + "-new.png";
    writeFileSync(join(OUT, f), png(up(ART.walls.cells[b.name + "." + c], ART.walls.pal, {biome: b}, cellRGBA))); files.push(f);
  } }
if (MAIN) {
  const {BIOMES} = await imp(MAIN, "src/core/config.js"), {ART} = await imp(MAIN, "src/render/pixel/art/index.js"), {cellRGBA} = await imp(MAIN, "src/render/pixel/grid.js"), {faceRows} = await imp(MAIN, "src/render/pixel/atlas.js");
  const T = ART.tiles, top = T.cells.wallTop, face = T.cells.wallFace;
  for (const b of BIOMES) {
    const fh = faceRows(b.hWall), rows = top.rows.slice(0, top.h - fh).concat(face.rows.slice(0, fh));
    while (rows.length < top.h) rows.push(rows[rows.length - 1]);
    const cell = {...top, rows, pal: {...(top.pal || {}), ...(face.pal || {})}}, f = "px/" + b.name.toLowerCase() + "-wall-today.png";
    writeFileSync(join(OUT, f), png(up(cell, T.pal, {biome: b}, cellRGBA))); files.push(f);
  }
}
console.log(JSON.stringify(files));
