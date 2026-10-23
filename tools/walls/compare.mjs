#!/usr/bin/env node
/* Detail pass (throwaway): readability gate against the wall prototype.
   node tools/walls/measure.mjs --json | tail -1 > new.json, the same from
   the prototype tree > proto.json, then node compare.mjs proto.json new.json.
   Every pair (look x brick/floor x true/protan/deutan/tritan, min over the
   four pillar pieces): FAIL if a pair under 20 drops below the prototype;
   pairs at or above 20 are listed when they drop, for the record. */
import {readFileSync} from "node:fs";
const A = JSON.parse(readFileSync(process.argv[2], "utf8")), B = JSON.parse(readFileSync(process.argv[3], "utf8"));
const SIM = ["true", "protan", "deutan", "tritan"];
let fail = 0, soft = 0;
const rows = [];
for (const w of Object.keys(A)) for (const look of ["c2d", "px"]) for (const pair of ["newVsBrick", "newVsFloor"]) SIM.forEach((sim, k) => {
  const a = A[w][look][pair][k], b = B[w][look][pair][k], d = b - a;
  if (d < -0.05) { if (a < 20) { fail++; rows.push(`FAIL ${w} ${look} ${pair} ${sim} ${a.toFixed(1)} -> ${b.toFixed(1)}`); } else { soft++; rows.push(`drop ${w} ${look} ${pair} ${sim} ${a.toFixed(1)} -> ${b.toFixed(1)}`); } }
  else if (a < 20) rows.push(`ok   ${w} ${look} ${pair} ${sim} ${a.toFixed(1)} -> ${b.toFixed(1)}`);
});
console.log(rows.join("\n"));
console.log(`gate: ${fail} under-20 drops (must be 0), ${soft} drops on pairs >= 20`);
process.exit(fail ? 1 : 0);
