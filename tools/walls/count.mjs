#!/usr/bin/env node
/* Detail pass (throwaway): shape counts per piece, so the vector fallback
   stays at dozens of stamps per tile. */
import {BIOMES} from "../../src/core/config.js";
import {wallShapes} from "../../src/render/wallart.js";
const codes = [0, 1, 2, 3, 4, 5, 7, 9];
for (const b of BIOMES) console.log(b.name.padEnd(8), "2D", codes.map((c) => wallShapes(b, c).length).join(","), "| PX", codes.map((c) => wallShapes(b, c, true).length).join(","));
