#!/usr/bin/env node
/* PIXEL board render (dev-only, zero deps). Builds a REAL world with the
   sim's own createWorld/loadLevel, optionally stages entities, draws it with
   src/render/pixel/world.js drawPixelWorld through the Node RGBA shim, and
   writes PNGs: the native 300x260 board (labelled "do not judge") and the
   same board at k 2.77 (laptop) and k 3.77 (phone) via U2 sharp-bilinear,
   with the k printed on the image. The game state is never stepped.

   node tools/pixel/board.mjs [--room 1..8] [--seed 4242] [--stage all|none|
     items,bombs,blast,foes,ghost,shots,pose] [--t 0.5] [--k 2.77,3.77]
     [--sheet mako=path/to/mako.mjs ...] [--out DIR] [--name board]
   --sheet swaps one art group for a scratch module exporting SHEET (or
   default), so an artist previews uncommitted cells on a live board.
   Output defaults to .superpowers/sdd/2026-10-10-pixel/out/. */
import {writeFileSync, mkdirSync} from "node:fs";
import {resolve, dirname, join} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {CFG, T, BIOMES, key} from "../../src/core/config.js";
import {createWorld, loadLevel} from "../../src/core/world.js";
import {POWER, FOES, spawnEnemy} from "../../src/core/entities.js";
import {createAtlas} from "../../src/render/pixel/atlas.js";
import {createView, drawPixelWorld} from "../../src/render/pixel/world.js";
import {createOneShots, OS} from "../../src/render/pixel/oneshot.js";
import {ART} from "../../src/render/pixel/art/index.js";
import {createRGBA, surfRGBA, sharpBilinear, label, png, blank, paste} from "./rgba.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export function parseArgs(argv) {
  const a = {room: 1, seed: 4242, stage: "all", t: 0.5, k: [2.77, 3.77], sheets: {}, out: join(ROOT, ".superpowers/sdd/2026-10-10-pixel/out"), name: null};
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i + 1];
    if (argv[i] === "--room") { a.room = +v; i++; } else if (argv[i] === "--seed") { a.seed = +v; i++; }
    else if (argv[i] === "--stage") { a.stage = v; i++; } else if (argv[i] === "--t") { a.t = +v; i++; }
    else if (argv[i] === "--k") { a.k = v.split(",").map(Number); i++; } else if (argv[i] === "--out") { a.out = resolve(v); i++; }
    else if (argv[i] === "--name") { a.name = v; i++; } else if (argv[i] === "--sheet") { const [g, p] = v.split("="); a.sheets[g] = resolve(p); i++; }
  }
  return a;
}
export async function loadArt(sheets) {
  const art = {...ART};
  for (const [g, p] of Object.entries(sheets || {})) { const m = await import(pathToFileURL(p).href); art[g] = m.SHEET || m.default; }
  return art;
}
const free = (w) => { const out = []; for (let y = 1; y < CFG.ROWS - 1; y++) for (let x = 1; x < CFG.COLS - 1; x++) if (w.grid[key(x, y)] !== T.WALL && (x > 2 || y > 2)) out.push([x, y]); return out; };
const ctr = (v) => (v + 0.5) * CFG.TILE;

/* Stage a world for a picture. Mutates only this throwaway world. */
export function stageWorld(w, stage, V) {
  const on = (s) => stage === "all" || stage.split(",").includes(s);
  w.state = "PLAY";
  const cells = free(w);
  let ci = 0;
  const take = () => { const c = cells[(ci++ * 11) % cells.length]; w.grid[key(c[0], c[1])] = T.EMPTY; return c; };
  if (on("items")) POWER.forEach((p, i) => { const [x, y] = take(); w.items.push({x: ctr(x), y: ctr(y), t: p.t, col: p.col, taken: false, buried: false}); });
  if (on("bombs")) ["normal", "line", "power", "pierce", "normal"].forEach((v, i) => { const [x, y] = take(); w.bombs.push({x: ctr(x), y: ctr(y), tx: x, ty: y, timer: w.fuse * (1 - [0.1, 0.4, 0.7, 0.95, 0.5][i]), radius: 2, variant: v, dead: false, slide: i === 4 ? {x: 1, y: 0} : null}); });
  if (on("blast")) {
    const [cx, cy] = take(), tiles = [{tx: cx, ty: cy}];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let i = 1; i <= 3; i++) { const tx = cx + dx * i, ty = cy + dy * i; if (w.grid[key(tx, ty)] === T.WALL) break; tiles.push({tx, ty}); if (w.grid[key(tx, ty)] === T.BRICK) break; }
    w.blades.push({x: ctr(cx), y: ctr(cy), tiles, t: 0.08, ttl: CFG.BLADE_TTL, variant: "normal"});
  }
  if (on("foes")) FOES.forEach((f, i) => { const [x, y] = take(); const e = spawnEnemy(f.t, x, y, w.level, null); e.invuln = false; e.dir = [{x: 0, y: 1}, {x: 1, y: 0}, {x: 0, y: -1}, {x: -1, y: 0}][i % 4]; w.enemies.push(e); });
  if (on("pose")) { const p = w.players[0]; p.shield = true; p.passing = true; p.kick = true; }
  if (on("ghost")) { const [x, y] = take(); V.ghost = {x: ctr(x), y: ctr(y), fx: 1, fy: 0}; }
  if (on("shots")) { const s = V.shots; const a = take(), b = take(), c = take(); s.push(OS.STUN, ctr(a[0]), ctr(a[1]), V.t - 0.05, "walker"); s.push(OS.REVEAL, ctr(b[0]), ctr(b[1]), V.t - 0.05); s.push(OS.CORPSE, ctr(c[0]), ctr(c[1]), V.t - 0.1); }
  w.players[0].iFrames = 0;
  return w;
}
export function renderBoard(atlas, w, V) {
  const img = createRGBA(300, 260, "#101018");
  drawPixelWorld(img.getContext(), w, V);
  return img;
}
export function framed(img, k, title) {
  const big = sharpBilinear(img, k), head = 34, out = blank(big.width, big.height + head, "#0b0e16");
  label(out, 8, 8, 3, title, [255, 220, 120]);
  paste(out, big, 0, head);
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const a = parseArgs(process.argv.slice(2));
  const art = await loadArt(a.sheets);
  const atlas = createAtlas(surfRGBA, art);
  const V = createView(atlas);
  V.shots = createOneShots();
  V.t = a.t;
  const w = createWorld(a.seed, a.room);
  loadLevel(w, a.room);
  stageWorld(w, a.stage, V);
  const img = renderBoard(atlas, w, V);
  mkdirSync(a.out, {recursive: true});
  const base = a.name || "board-r" + a.room + "-" + BIOMES[(a.room - 1) % 8].name.toLowerCase();
  const nat = blank(300, 290, "#0b0e16");
  label(nat, 4, 4, 2, "NATIVE 1X - DO NOT JUDGE", [255, 120, 120]);
  paste(nat, img, 0, 30);
  writeFileSync(join(a.out, base + "-native.png"), png(nat));
  for (const k of a.k) writeFileSync(join(a.out, base + "-k" + String(k).replace(".", "") + ".png"), png(framed(img, k, "K " + k + "  ROOM " + a.room + " " + BIOMES[(a.room - 1) % 8].name + "  PENDING " + atlas.bakeAll().size)));
  console.log("wrote", base, "draws", V.draws, "pending", atlas.pending.size, "->", a.out);
}
