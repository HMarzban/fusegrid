/* before -> after table from two measure / pxexport JSON dumps:
   node compare.mjs <before.json> <after.json> [md] */
import {readFileSync} from "node:fs";
const [bf, af, md] = process.argv.slice(2), B = JSON.parse(readFileSync(bf, "utf8")), A = JSON.parse(readFileSync(af, "utf8"));
const K = ["cov", "dL", "cvd", "tex", "dEbrickB", "nearBrickPct"].filter((k) => k in A[0]);
if (md) console.log("| tile | heat | " + K.join(" | ") + " |\n|---|---|" + K.map(() => "---").join("|") + "|");
A.forEach((r, i) => { const b = B[i] || {};
  console.log(md ? `| ${r.tile} | ${r.heat} | ` + K.map((k) => `${b[k]} → ${r[k]}`).join(" | ") + " |" : r.tile.padEnd(17) + r.heat.padEnd(5) + K.map((k) => ` ${k} ${b[k]}->${r[k]}`).join(""));
});
