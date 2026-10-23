#!/usr/bin/env node
/* Detail pass (throwaway): manifest.json for the isolated wall tiles.
   node tools/walls/manifest.mjs <wallsDir> */
import {readdirSync, writeFileSync, existsSync} from "node:fs";
import {join} from "node:path";
const D = process.argv[2];
const WORLD = {jungle: "JUNGLE temple stone", ice: "ICE glacier block", factory: "FACTORY plate steel", water: "WATER pier stone", arena: "ARENA colosseum stone", sand: "SAND sandstone", void: "VOID obsidian monolith", crown: "CROWN royal masonry"};
const PIECE = {
  jungle: {base: "carved groove, grain, coursed face with moss tufts", v1: "root wrap (lit tube)", v2: "fret band carved in the face", acc: "root-bound, one per room", border: "plain rampart border"},
  ice: {base: "frost-rimmed cap, refraction streaks, lower-right facet", v1: "carved runes", v2: "icicles", acc: "frozen fringe, one per room", border: "plain rampart border"},
  factory: {base: "brushed steel, four lit bolts", v1: "weld seam", v2: "bolted strap", acc: "pipe run, one per room", border: "plain rampart border"},
  water: {base: "porous pier stone, wet film, damp below the tide line", v1: "barnacles", v2: "algae drips", acc: "mooring cleat, one per room", border: "plain rampart border"},
  arena: {base: "claw-chisel tooling, ashlar courses", v1: "tally marks (raised relief)", v2: "carved column", acc: "laurel, one per room", border: "plain rampart border"},
  sand: {base: "sandstone strata, fine sand grain", v1: "sand drift", v2: "beam ends", acc: "step relief, one per room", border: "plain rampart border"},
  void: {base: "polished obsidian sheen, crystal glint", v1: "crystal inlay", v2: "faceted cap with gem", acc: "rune slit, one per room", border: "plain rampart border"},
  crown: {base: "gilt frame with sheen around an inset stone panel", v1: "gilt corners", v2: "gilt studs", acc: "keystone, one per room", border: "plain rampart border"},
};
const LOOK = {"2d": "CLASSIC 2D (the real 40 px bake, NEAREST to 192)", px: "PIXEL (the 20x20 slot cell via cellRGBA, NEAREST to 192)", "3d": "REAL 3D (one block: game material, frozen lights, rig-C angle, 256 px)"};
const files = [];
for (const look of ["2d", "px", "3d"]) {
  const dir = join(D, look);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".png")).sort()) {
    const [w, piece, state] = f.replace(".png", "").split("-");
    const cap = state === "today" ? `${WORLD[w]}: today's live wall (main afb983f, one image for every wall in the room)` : `${WORLD[w]}: ${piece} - ${PIECE[w][piece]}`;
    files.push({file: "walls/" + look + "/" + f, set: "walls", look, world: w, piece: state === "today" ? "wall" : piece, state, caption: cap + " · " + LOOK[look]});
  }
}
writeFileSync(join(D, "manifest.json"), JSON.stringify({set: "walls", date: "2026-10-23", note: "today = live main; new = detail pass over the wall prototype (worktree branch, never merged). Tiles alone: no board, no neighbours, no HUD.", files}, null, 1));
console.log(files.length, "files");
