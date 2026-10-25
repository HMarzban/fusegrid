/* manifest.json for the floor set: every exported PNG with a one-line caption. */
import {writeFileSync, existsSync} from "node:fs";
import {OUT, TILES, HEAT} from "./harness.mjs";
import {ANIM} from "./anim.mjs";
const R3 = "round3/floor/";
const NAME = {booster: "BOOSTER", "ice-patch": "ICE PATCH", conveyor: "CONVEYOR", stream: "STREAM", trap: "TRAP", quicksand: "QUICKSAND", portal: "PORTAL", gate: "GATE"};
const HW = ["CORE (easy): soft keyline, 1 mark, round tips", "PLUS (normal): dashed edge, 2 marks, square tips", "MAX (hard): hazard band, 3 marks, sharp tips"];
const MAT = {booster: "solid leaves with one midrib on a plain moss bed (veins and flecks gone)", "ice-patch": "polished ice, inner-light band, one glint, streaks cut in; MAX wears frost teeth",
  conveyor: "rubber belt between riveted rails; PIXEL CORE chevron filled solid, MAX stub gone", stream: "channel with tapered flow ripples (no caustic web); CORE arrow lifted one step",
  trap: "metal plate, bolt heads, inward chevrons cut in; reach ticks cross the rim; CORE lifted one step", quicksand: "settled sand, diamond dimple, spiral arms CONVERGING on it (count = heat)",
  portal: "carved frame, nested-square glow core, pair pips 1/2/3 in the top-left bracket", gate: "iron portcullis in a stone kerb; timer = whole kerb sides (gilt lit / dark unlit)"};
const FX = {booster: "CORE leaves breathe", "ice-patch": "board-space specular sweep", conveyor: "belt band scrolls", stream: "bed scrolls at float speed + soft shimmer", trap: "MAX band value pulse", quicksand: "dark spiral drift running inward", portal: "core breathes toward wallHi, pair pips count up", gate: "lit kerb strokes glow"};
const LOOK = {"2d": "CLASSIC 2D, the game's painter (src/render/featdraw.js) at 192x192", px: "PIXEL, palette-slot cell (src/render/featpx.js) 20x20 NEAREST x9 = 180 px centred in 192, clear bg", "3d": "REAL 3D, one tile: a stand-alone plane with featmesh's material, 64-px atlas cell and filtering, frozen lights, rig-C camera at its real dist 1503 / el 0.66 with the lens narrowed to one tile, 256x256 on #0b0f1a"};
const files = [];
for (const [w, p] of TILES) {
  for (const look of ["2d", "px", "3d"]) HEAT.forEach((h, i) => {
    const f = `${R3}${look}/${w}-${p}-${h}.png`;
    if (existsSync(OUT + `${look}/${w}-${p}-${h}.png`)) files.push({file: f, set: "floor", look, world: w, piece: p, state: h, caption: `${NAME[p]} (${w.toUpperCase()}) · ${LOOK[look].split(",")[0]} · ${HW[i]} · NEW: ${MAT[p]}`});
  });
  HEAT.forEach((h, i) => {
    const f = `${R3}3d-anim/${w}-${p}-${h}.png`, k = TILES.find((t) => t[1] === p)[3].kind, [t0, dt] = ANIM[k];
    if (existsSync(OUT + `3d-anim/${w}-${p}-${h}.png`)) files.push({file: f, set: "floor", look: "3d-anim", world: w, piece: p, state: h, frames: 6, times: [0, 1, 2, 3, 4, 5].map((j) => +(t0 + j * dt).toFixed(2)), caption: `${NAME[p]} (${w.toUpperCase()}) · REAL 3D effect strip, 6 frames of the PLAY clock (s) · ${HW[i].split(":")[0]} · ${FX[p]}`});
  });
  HEAT.forEach((h, i) => {
    const f = `${R3}2d/${w}-${p}-${h}-before.png`;
    if (existsSync(OUT + `2d/${w}-${p}-${h}-before.png`)) files.push({file: f, set: "floor", look: "2d", world: w, piece: p, state: h, before: true, caption: `${NAME[p]} (${w.toUpperCase()}) · CLASSIC 2D · ${HW[i].split(":")[0]} · BEFORE: the wave-1 prototype tile (flat bed + marks), what we have today`});
  });
}
files.push({file: R3 + "qa-in-game-2d.png", set: "floor", look: "2d", caption: "QA: a real gen-2 FACTORY room (room 3, MAX) in the live CLASSIC 2D renderer with the round-3 CONVEYOR art; foes frozen"});
files.push({file: R3 + "qa-in-game-3d.png", set: "floor", look: "3d", caption: "QA: the same room in live REAL 3D (rig C) with the round-3 shader effects; the tile layer is +1 draw, asserted by tests/tile-proto.test.mjs"});
writeFileSync(OUT + "manifest.json", JSON.stringify({set: "floor", date: "2026-10-23", round: 3, looks: {...LOOK, "3d-anim": "REAL 3D, the same one-tile scene through the real featmesh layer, 6 frames of the PLAY clock side by side (1536x256)"}, note: "Round 3 (maturity pass + REAL 3D effects). Paths are relative to .superpowers/sdd/2026-10-23-tile-art/ (same convention as walls/manifest.json). REAL 3D stills now go through the real buildFeat layer (its shader effects included); PORTAL stills show pair 1, its strips pair 3. CLASSIC 2D is the painter re-rendered as vectors at 192 (sub-unit texture is softer at the in-game 80-px bake; qa-in-game-2d.png is the true-size reference). Tiles exported ALONE (no board, no neighbours). STREAM, QUICKSAND, PORTAL and GATE have no 'before' (no prototype existed; only concept drawings). The *-before.png files are copied unchanged from floor/2d/.", files}, null, 1));
console.log(files.length, "entries");
