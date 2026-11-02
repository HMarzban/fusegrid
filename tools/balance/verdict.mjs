#!/usr/bin/env node
/* The short form of a tilesweep row file: one line per tile x heat against #30's targets.
     node tools/balance/verdict.mjs out/sweep.jsonl
   Δ lose: A1 - A0 in points, paired by seed, bootstrap 95% CI. band: CORE upper <= +2,
   PLUS within -2..+5, MAX +3..+10 ("pass" = the whole CI inside, "unres" = it straddles an
   edge). near: near misses per run, A1 / A0 - 1, MAX wants >= +20%. clear: median clear
   time of wins, A1 / A0 - 1. hit5: runs hit in the first 5 s, A0 / A1 with the ceiling
   A0 + 2 sqrt(A0). noEsc: tile-forced episodes, tile rooms %: the seeds that kept tiles.
   use, per run: warps / foe warps / gate crossings / mounds grown / mounds broken, then s
   with a growth waiting to retry and s with a gate shut. kills per run A0→A1, and the
   share of hits that are foe contact. Never imported by src/. */
import { readFileSync } from "node:fs";
import { compare, armStats, inBand } from "./summary.mjs";

const HEAT = ["CORE", "PLUS", "MAX"], TILE = { 1: "BOOSTER", 2: "ICE PATCH", 3: "CONVEYOR", 4: "STREAM", 5: "TRAP", 6: "QUICKSAND", 7: "PORTAL", 8: "GATE" };
const BAND = [[-Infinity, 2], [-2, 5], [3, 10]];
const rows = readFileSync(process.argv[2], "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.room != null);
const f = (x, d = 1) => (x === x ? (x >= 0 ? "+" : "") + x.toFixed(d) : "-"), n1 = (x) => (x === x ? x.toFixed(1) : "-");
const per = (rs, k) => rs.reduce((a, r) => a + (r[k] || 0), 0) / rs.length;
console.log("| tile | heat | lose A0→A1 | Δ lose [CI] | band | clear s A0→A1 (Δ% [CI]; wins) | timeout A0→A1 | near Δ% [CI] | hit5 A0/A1 (cap) | noEsc (→hit) | tile rooms % | use w/fw/g/mg/mb | held s/shut s | kills A0→A1 | contact % A1 |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const room of [...new Set(rows.map((r) => r.room))].sort((a, b) => a - b))
  for (const heat of [0, 1, 2]) {
    const cell = rows.filter((r) => r.room === room && r.heat === heat), A = cell.filter((r) => r.arm === "A0"), B = new Map(cell.filter((r) => r.arm === "A1").map((r) => [r.s, r]));
    if (!A.length || !B.size) continue;
    const a = A.filter((r) => B.has(r.s)), b = a.map((r) => B.get(r.s)), sa = armStats(a), sb = armStats(b), c = compare(a, b);
    const d = { mean: 100 * c.dLose.mean, lo: 100 * c.dLose.lo, hi: 100 * c.dLose.hi }, ct = c.clear;
    const cap = sa.hit5 + 2 * Math.sqrt(sa.hit5);
    console.log(`| ${room} ${TILE[room] || ""} | ${HEAT[heat]} | ${n1(100 * sa.lose)}→${n1(100 * sb.lose)} | ${f(d.mean)} [${f(d.lo)}, ${f(d.hi)}] | ${inBand(d, ...BAND[heat]).slice(0, 5)} | ${n1(ct.a)}→${n1(ct.b)} (${f(100 * ct.ratio)}${ct.lo === ct.lo ? ` [${f(100 * ct.lo)}, ${f(100 * ct.hi)}]` : ""}; ${ct.winsA}/${ct.winsB}) | ${n1(100 * sa.to)}→${n1(100 * sb.to)} | ${f(100 * c.nearRatio.mean)} [${f(100 * c.nearRatio.lo)}, ${f(100 * c.nearRatio.hi)}] | ${sa.hit5}/${sb.hit5} (${n1(cap)}) ${sb.hit5 <= cap ? "ok" : "OVER"} | ${sb.noEsc} (${sb.noEscHit}) | ${n1((100 * sb.rules) / b.length)} | ${per(b, "warps").toFixed(1)}/${per(b, "foeWarps").toFixed(1)}/${per(b, "gateX").toFixed(1)}/${per(b, "grown").toFixed(1)}/${per(b, "mounds").toFixed(1)} | ${per(b, "heldT").toFixed(1)}/${per(b, "shutT").toFixed(1)} | ${per(a, "kills").toFixed(2)}→${per(b, "kills").toFixed(2)} | ${n1((100 * per(b, "hContact")) / per(b, "hits"))} |`);
  }
