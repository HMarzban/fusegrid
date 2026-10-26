#!/usr/bin/env node
/* #28 TRAP lane: the static checks (featchecks.mjs) on room 5 only, with an
   optional 3-tier knob table (as tilesweep --prof). Offline, never in src/.
     node tools/balance/trapstatic.mjs [--n 1000] [--prof knobs.json]
   Seeds: fmix(s * 7919 + 13), as featreport.mjs. */
import { readFileSync } from "node:fs";
import { createWorld, loadLevel } from "../../src/core/sim.js";
import { genBoard2 } from "../../src/core/board2.js";
import { featChecks } from "./featchecks.mjs";
import { mergeProf } from "./tilerun.mjs";
import { FEAT_PROFILE } from "../../src/core/feat.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const NS = +arg("--n", 1000), pf = arg("--prof", null), LV = +arg("--room", 5);
const P = pf ? mergeProf(JSON.parse(readFileSync(pf, "utf8"))) : FEAT_PROFILE;
const fmix = (h) => { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
const H = ["CORE", "PLUS", "MAX"], cell = [0, 1, 2].map(() => ({ fails: {}, spots: 0, time: 0, cap: 0, exact: 0, cause: {}, traps: 0, drop: 0 }));
for (let s = 0; s < NS; s++) {
  const seed = fmix(s * 7919 + 13);
  const ws = [0, 1, 2].map((h) => { const w = createWorld(seed, LV); w.gen = 3; w.heat = h; loadLevel(w, LV, false); return w; });
  const featByHeat = ws.map((w) => w.feat || null), pairByHeat = ws.map((w) => w.featPair || null);
  for (let h = 0; h < 3; h++) {
    const w = ws[h], re = genBoard2(seed, LV, h, { feat: true }), c = cell[h];
    if (!w.feat) c.drop++; else c.traps += w.feat.reduce((a, v) => a + (v === 7), 0);
    for (const r of featChecks({ ...w, featByHeat, pairByHeat, rebuild: { feat: re.feat, featPair: re.featPair } }, P[h], {})) {
      c.fails[r.id] = (c.fails[r.id] || 0) + 1;
      if (r.id === "V19") { c.spots += r.spots; c.time += r.time; c.cap += r.cap; c.exact += r.trapExact || 0; for (const [k, v] of Object.entries(r.cause)) c.cause[k] = (c.cause[k] || 0) + v; }
    }
  }
}
console.log(`room ${LV}, n ${NS}${pf ? ", prof " + pf : ""}`);
for (let h = 0; h < 3; h++) { const c = cell[h]; console.log(`${H[h]}: traps/board ${(c.traps / (NS - c.drop)).toFixed(2)} drops ${c.drop} | fails ${JSON.stringify(c.fails)} | V19 spots ${c.spots} (time ${c.time}, cap ${c.cap}) causes ${JSON.stringify(c.cause)} exact ${c.exact}`); }
