/* manifest.json for the floor set: every exported PNG with a one-line caption. */
import {writeFileSync, existsSync} from "node:fs";
import {OUT, TILES, HEAT} from "./harness.mjs";
const NAME = {booster: "BOOSTER", "ice-patch": "ICE PATCH", conveyor: "CONVEYOR", stream: "STREAM", trap: "TRAP", quicksand: "QUICKSAND", portal: "PORTAL", gate: "GATE"};
const HW = ["CORE (easy): soft keyline, 1 mark, round tips", "PLUS (normal): dashed edge, 2 marks, square tips", "MAX (hard): hazard band, 3 marks, sharp tips"];
const MAT = {booster: "living leaf inlay, mark-tone midribs, moss bed with veins", "ice-patch": "polished ice, inner-light band, hairline scratches, frost rim, streaks cut in",
  conveyor: "rubber belt with tread between riveted steel rails", stream: "water channel, shallow banks, deep centre, angular caustic web",
  trap: "engraved brushed plate, square bolt heads, chevrons cut in", quicksand: "rippled sand, grain, slow funnel pull, dark ripple marks",
  portal: "carved stone frame, deep core glowing in nested squares", gate: "iron portcullis grate sunk in a stone kerb (open state)"};
const LOOK = {"2d": "CLASSIC 2D, the game's painter (src/render/featdraw.js) at 192x192", px: "PIXEL, palette-slot cell (src/render/featpx.js) 20x20 NEAREST x9 = 180 px centred in 192, clear bg", "3d": "REAL 3D, one tile, game material + frozen lights + rig-C angle (FOV 24, el 0.66), 64-px atlas cell, 256x256 on #0b0f1a"};
const files = [];
for (const [w, p] of TILES) {
  for (const look of ["2d", "px", "3d"]) HEAT.forEach((h, i) => {
    const f = `floor/${look}/${w}-${p}-${h}.png`;
    if (existsSync(OUT + `${look}/${w}-${p}-${h}.png`)) files.push({file: f, set: "floor", look, world: w, piece: p, state: h, caption: `${NAME[p]} (${w.toUpperCase()}) · ${LOOK[look].split(",")[0]} · ${HW[i]} · NEW: ${MAT[p]}`});
  });
  HEAT.forEach((h, i) => {
    const f = `floor/2d/${w}-${p}-${h}-before.png`;
    if (existsSync(OUT + `2d/${w}-${p}-${h}-before.png`)) files.push({file: f, set: "floor", look: "2d", world: w, piece: p, state: h, before: true, caption: `${NAME[p]} (${w.toUpperCase()}) · CLASSIC 2D · ${HW[i].split(":")[0]} · BEFORE: the wave-1 prototype tile (flat bed + marks), what we have today`});
  });
}
files.push({file: "floor/qa-in-game-2d.png", set: "floor", look: "2d", caption: "QA: a real gen-2 FACTORY room (room 3, MAX) in the live CLASSIC 2D renderer with the new CONVEYOR art; foes frozen"});
files.push({file: "floor/qa-in-game-3d.png", set: "floor", look: "3d", caption: "QA: the same room in live REAL 3D (rig C, 142 draws with the tile layer)"});
writeFileSync(OUT + "manifest.json", JSON.stringify({set: "floor", date: "2026-10-23", looks: LOOK, note: "Tiles exported ALONE (no board, no neighbours). STREAM, QUICKSAND, PORTAL and GATE have no 'before' (no prototype existed; only concept drawings).", files}, null, 1));
console.log(files.length, "entries");
