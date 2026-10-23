/* Review-only contact sheet of exported PNGs: node contact.mjs <look> <out.png> [suffix] */
import {readFileSync, writeFileSync} from "node:fs";
import {unpng, blank, paste, png} from "../pixel/rgba.mjs";
import {OUT, TILES, HEAT} from "./harness.mjs";
const [look, out, suf = ""] = process.argv.slice(2), S = look === "3d" ? 256 : 192;
const T = suf ? TILES.filter((t) => ["BLOOM", "GLIDE", "BELT", "PLATE"].includes(t[3].kind)) : TILES;
const img = blank(3 * (S + 8), T.length * (S + 8), "#202a3c");
T.forEach(([w, p], r) => HEAT.forEach((h, c) => paste(img, unpng(readFileSync(OUT + look + "/" + w + "-" + p + "-" + h + suf + ".png")), c * (S + 8), r * (S + 8))));
writeFileSync(out, png(img));
