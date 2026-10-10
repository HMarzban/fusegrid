#!/usr/bin/env node
/* PIXEL art sheet bake (dev-only, zero deps, node:zlib PNG). Renders the
   cells of one art group (committed, or a scratch module via --sheet) to a
   labelled contact sheet: every manifest cell of the group, drawn art or
   generated placeholder (labelled PH), on the chosen biome's floor.
   Zoom rows (x1..x8) are for drawing and are labelled "do not judge"; the
   in-game rows are sharp-bilinear at k 2.77 (laptop) and 3.77 (phone), the
   only sizes a taste call may be made at (owner ruling U1).

   node tools/pixel/bake.mjs --group mako|foes|tiles|bomb|blast|items|fx
     [--sheet path/to/scratch.mjs] [--cells a,b,c] [--scale 6] [--k 2.77,3.77]
     [--biome VOID] [--body #hex] [--fin #hex] [--out DIR]
   Contextual slots: mako uses PLAYER_HULL + --fin; foes use each type's spawn
   hex; items each POWER colour; --body overrides. Output defaults to
   .superpowers/sdd/2026-10-10-pixel/out/bake-<group>.png. */
import {writeFileSync, mkdirSync} from "node:fs";
import {resolve, dirname, join} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {BIOMES} from "../../src/core/config.js";
import {FOES, POWER} from "../../src/core/entities.js";
import {HEX} from "../../src/render/pixel/palette.js";
import {cellRGBA, validateCell} from "../../src/render/pixel/grid.js";
import {fallbackCell} from "../../src/render/pixel/fallback.js";
import {MANIFEST} from "../../src/render/pixel/manifest.js";
import {ART} from "../../src/render/pixel/art/index.js";
import {blank, paste, label, png, sharpBilinear} from "./rgba.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const a = {group: "mako", sheet: null, cells: null, scale: 6, k: [2.77, 3.77], biome: "JUNGLE", body: null, fin: null, out: join(ROOT, ".superpowers/sdd/2026-10-10-pixel/out")};
const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) {
  const k = av[i], v = av[i + 1];
  if (k === "--group") a.group = v; else if (k === "--sheet") a.sheet = resolve(v); else if (k === "--cells") a.cells = v.split(",");
  else if (k === "--scale") a.scale = +v; else if (k === "--k") a.k = v.split(",").map(Number); else if (k === "--biome") a.biome = v.toUpperCase();
  else if (k === "--body") a.body = v; else if (k === "--fin") a.fin = v; else if (k === "--out") a.out = resolve(v); else continue;
  i++;
}
const sheet = a.sheet ? (await import(pathToFileURL(a.sheet).href)).SHEET : ART[a.group];
const biome = BIOMES.find((b) => b.name === a.biome) || BIOMES[0];
const names = a.cells || MANIFEST.filter((k) => k.startsWith(a.group + "/")).map((k) => k.slice(a.group.length + 1));
const ctxOf = (n) => {
  const c = {biome, fin: a.fin || HEX.fin, body: a.body || HEX.hull};
  if (a.group === "foes") { const f = FOES.find((x) => x.t === n.split(".")[0]); if (f && !a.body) c.body = f.col; }
  if (a.group === "items") { const p = POWER.find((x) => x.t === n); if (p && !a.body) c.body = p.col; }
  if (a.group === "fx" && !a.body) c.body = HEX.spark;
  return c;
};
const errs = [];
const tiles = names.map((n) => {
  const own = sheet && sheet.cells && sheet.cells[n];
  const cell = own ? {...own, pal: {...(sheet.pal || {}), ...(own.pal || {})}} : fallbackCell(a.group, n);
  for (const e of validateCell(cell, cell.pal)) errs.push(n + ": " + e);
  return {n, ph: !own, img: {width: cell.w, height: cell.h, data: cellRGBA(cell, cell.pal, ctxOf(n))}};
});
const floor = (w, h) => { const im = blank(w, h, biome.floor0); for (let y = 0; y < h; y += 20) for (let x = 0; x < w; x += 20) if (((x + y) / 20) & 1) paste(im, blank(20, 20, biome.floor1), x, y); return im; };
function row(scaleFn, title, warn) {
  const cellW = Math.max(...tiles.map((t) => scaleFn(t.img).width)), cellH = Math.max(...tiles.map((t) => scaleFn(t.img).height));
  const colW = Math.max(cellW, 120) + 12, perRow = Math.max(1, Math.floor(1800 / colW)), rows = Math.ceil(tiles.length / perRow);
  const out = blank(colW * perRow + 12, rows * (cellH + 26) + 30, "#0b0e16");
  label(out, 8, 6, 3, title, warn ? [255, 120, 120] : [255, 220, 120]);
  tiles.forEach((t, i) => {
    const x = 8 + (i % perRow) * colW, y = 28 + Math.floor(i / perRow) * (cellH + 26);
    const bg = scaleFn(floor(Math.ceil(t.img.width / 20) * 20, Math.ceil(t.img.height / 20) * 20)), im = scaleFn(t.img);
    paste(out, bg, x, y); paste(out, im, x, y);
    label(out, x, y + cellH + 6, 2, (t.ph ? "PH " : "") + t.n, t.ph ? [150, 160, 180] : [230, 240, 255]);
  });
  return out;
}
const parts = [row((im) => sharpBilinear(im, a.scale), "X" + a.scale + " ZOOM - DO NOT JUDGE  " + a.group.toUpperCase() + " ON " + biome.name, true)];
for (const k of a.k) parts.push(row((im) => sharpBilinear(im, k), "IN-GAME K " + k + "  " + a.group.toUpperCase() + " ON " + biome.name));
const W = Math.max(...parts.map((p) => p.width)), H = parts.reduce((s, p) => s + p.height, 0);
const out = blank(W, H, "#0b0e16");
let y = 0;
for (const p of parts) { paste(out, p, 0, y); y += p.height; }
mkdirSync(a.out, {recursive: true});
const file = join(a.out, "bake-" + a.group + (a.sheet ? "-scratch" : "") + "-" + biome.name.toLowerCase() + ".png");
writeFileSync(file, png(out));
console.log("wrote", file, "cells", tiles.length, "placeholders", tiles.filter((t) => t.ph).length, errs.length ? "ERRORS:\n  " + errs.join("\n  ") : "valid");
if (errs.length) process.exitCode = 1;

