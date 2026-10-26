#!/usr/bin/env node
/* #28 baseline: the static tile checks (featchecks.mjs, V13-V27) over today's
   gen-3 boards, n seeds x rooms 1-8 x CORE / PLUS / MAX, each heat with its
   own FEAT_PROFILE row. Rule rooms 1 BOOSTER, 2 ICE PATCH, 3 CONVEYOR,
   5 TRAP get every check; the art-only rooms 4 / 6 / 7 / 8 get the layer
   checks only (V13 V14 V21 V22 V23), the rest read n/a. A cell is the number
   of boards failing that check; V19 also sums no-escape spots by cause.
     node tools/balance/featreport.mjs [--n 1000] [--out file.json]
   Seeds: fmix(s * 7919 + 13), the tools/levels/fairsweep.mjs sequence. */
import { writeFileSync } from "node:fs";
import { createWorld, loadLevel } from "../../src/core/sim.js";
import { genBoard2 } from "../../src/core/board2.js";
import { biomeOf } from "../../src/core/config.js";
import { FEAT_PROFILE, HOME } from "../../src/core/feat.js";
import { featChecks, tableChecks, FEAT_RULES, TILE_NAME } from "./featchecks.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const NS = +arg("--n", 1000), OUT = arg("--out", null), H = ["CORE", "PLUS", "MAX"];
const RULE_ROOMS = [1, 2, 3, 5], ART_ROOMS = [4, 6, 7, 8], LAYER = ["V13", "V14", "V21", "V22", "V23"];
const fmix = (h) => { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
const t0 = performance.now(), cell = {};
const get = (lv, h) => (cell[lv + ":" + h] ||= { boards: 0, fails: Object.fromEntries(FEAT_RULES.map((r) => [r, 0])), spots: 0, time: 0, cap: 0, trapExact: 0, cause: {}, why: {}, v14: {} });
for (let s = 0; s < NS; s++) {
  const seed = fmix(s * 7919 + 13);
  for (let lv = 1; lv <= 8; lv++) {
    const ws = [0, 1, 2].map((h) => { const w = createWorld(seed, lv); w.gen = 3; w.heat = h; loadLevel(w, lv, false); return w; });
    const featByHeat = ws.map((w) => w.feat || null), pairByHeat = ws.map((w) => w.featPair || null);
    for (let h = 0; h < 3; h++) {
      const w = ws[h], re = genBoard2(seed, lv, h, { feat: true });
      const only = ART_ROOMS.includes(lv) ? LAYER : undefined;
      const f = featChecks({ ...w, featByHeat, pairByHeat, rebuild: { feat: re.feat, featPair: re.featPair } }, FEAT_PROFILE[h], { only });
      const c = get(lv, h);
      c.boards++;
      for (const r of f) {
        c.fails[r.id]++;
        const why = r.id + " " + r.why.replace(/\d+(\.\d+)?/g, "#");
        c.why[why] = (c.why[why] || 0) + 1;
        if (r.id === "V14") for (const k of Object.keys(r.causes)) c.v14[k] = (c.v14[k] || 0) + 1;
        if (r.id === "V19") { c.spots += r.spots; c.time += r.time; c.cap += r.cap; c.trapExact += r.trapExact || 0; for (const [k, v] of Object.entries(r.cause)) c.cause[k] = (c.cause[k] || 0) + v; }
      }
    }
  }
}
const ms = performance.now() - t0, pct = (v, n) => (v ? v + " (" + (100 * v / n).toFixed(1) + "%)" : "0");
const name = (lv) => lv + " " + TILE_NAME[HOME[biomeOf(lv).name]];
const lines = [`# Tile static checks baseline: ${NS} seeds x 3 heats, gen 3 (${(ms / 1000).toFixed(1)} s)`, "", "Cells: boards failing / " + NS + ". V23 counts tile drops (gate < 1 %, not 0).", ""];
const table = (rooms, rules, title) => {
  lines.push("## " + title, "", "| room · tile | heat | " + rules.join(" | ") + " |", "|---|---|" + rules.map(() => "---").join("|") + "|");
  for (const lv of rooms) for (let h = 0; h < 3; h++) { const c = get(lv, h); lines.push(`| ${name(lv)} | ${H[h]} | ` + rules.map((r) => pct(c.fails[r], c.boards)).join(" | ") + " |"); }
  lines.push("");
};
table(RULE_ROOMS, FEAT_RULES, "Rule rooms (every check)");
table(ART_ROOMS, LAYER, "Art-only rooms (layer checks; V15-V20, V24-V27 n/a)");
lines.push("## V19 no-escape spots", "", "Sums over boards of distinct cells per board. time = no exit in any number of moves (12); cap = an exit in time exists but only past the V2 4-step budget. Causes overlap (one cell can count under two), so they may sum past spots. trap exact = trap-blast spots in the as-loaded brick state alone (arms stop at bricks).", "", "| room · tile | heat | boards | spots | time | cap | causes | trap exact |", "|---|---|---|---|---|---|---|---|");
for (const lv of RULE_ROOMS) for (let h = 0; h < 3; h++) { const c = get(lv, h), b = c.fails.V19; lines.push(`| ${name(lv)} | ${H[h]} | ${b} | ${c.spots} | ${c.time} | ${c.cap} | ${Object.entries(c.cause).map(([k, v]) => k + " " + v).join(", ") || "-"} | ${lv === 5 ? c.trapExact : "-"} |`); }
const V14K = ["spawn", "door", "foe", "sentry", "floor", "buried"];
lines.push("", "## V14 breaches (boards with each breach; one board can carry several)", "", "| room · tile | heat | " + V14K.join(" | ") + " |", "|---|---|" + V14K.map(() => "---").join("|") + "|");
for (const lv of [...RULE_ROOMS, ...ART_ROOMS]) for (let h = 0; h < 3; h++) { const c = get(lv, h); lines.push(`| ${name(lv)} | ${H[h]} | ` + V14K.map((k) => c.v14[k] || 0).join(" | ") + " |"); }
lines.push("", "## First-failure reasons (top 4 per cell)", "");
for (const lv of [...RULE_ROOMS, ...ART_ROOMS]) for (let h = 0; h < 3; h++) {
  const top = Object.entries(get(lv, h).why).sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (top.length) lines.push(`- ${name(lv)} ${H[h]}: ` + top.map(([k, v]) => `${k} ×${v}`).join("; "));
}
const tc = tableChecks();
lines.push("", "Table-level V16 (speeds never drop with heat): " + (tc.length ? tc.map((t) => t.why).join("; ") : "pass"));
console.log(lines.join("\n"));
if (OUT) writeFileSync(OUT, JSON.stringify({ n: NS, seeds: "fmix(s*7919+13)", ms: Math.round(ms), cells: cell, table: tc }, null, 1));
