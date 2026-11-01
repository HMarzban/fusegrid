#!/usr/bin/env node
/* ICE PATCH MAX fragility (#30): what does the +3 .. +10 result rest on? Drives
   tilesweep.mjs for room 2 at MAX, one child at a time, then reads the rows:
   - boost: A1 at glide.boost 1.30 .. 1.70 through --prof (A0 never moves with a
     knob table, so one A0 pairs them all);
   - blocks: the shipped ×1.5 per 1000-seed block, with the spread sampling alone
     would give (a heterogeneity Q against df = blocks - 1);
   - player: FG_BOTBRAKE at once / late:N / never (knows the coast) / naive
     (never, and flees as if it could stop anywhere).
     node tools/balance/icefrag.mjs --n 12000 --from 600000 --workers 8
     node tools/balance/icefrag.mjs --n 12000 --from 600000 --read      (rows already on disk)
   Output: tools/balance/out/ice-*.jsonl and a printed report. Shipped knobs stay
   as they are; this proposes only. Never imported by src/. */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pairedCI } from "./stats.mjs";
import { CFG } from "../../src/core/config.js";

const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, "out"), argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const n = +arg("--n", 12000), from = +arg("--from", 600000), W = arg("--workers", "8"), read = argv.includes("--read");
const BOOSTS = [1.3, 1.35, 1.4, 1.45, 1.5, 1.55, 1.6, 1.7], KINDS = ["", "late:6", "late:12", "late:18", "late:30", "0", "naive"];
const nP = Math.min(n, +arg("--nplayer", 6000));
mkdirSync(OUT, { recursive: true });
function sweep(name, args, env, nn = n) {
  if (read) return;
  const r = spawnSync(process.execPath, [join(HERE, "tilesweep.mjs"), "--rooms", "2", "--heats", "2", "--n", String(nn), "--from", String(from), "--workers", W, "--name", name, "--out", join(OUT, name), ...args], { env: { ...process.env, ...env }, stdio: ["ignore", "ignore", "inherit"] });
  if (r.status) throw new Error(name + " exit " + r.status);
}
const rows = (name) => readFileSync(join(OUT, name + ".jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).sort((a, b) => a.s - b.s);
const lose = (r) => (r.st === "LOSE" ? 1 : 0), pc = (x) => (100 * x).toFixed(1);
const ci = (c) => `${c.mean >= 0 ? "+" : ""}${pc(c.mean)} [${pc(c.lo)}, ${pc(c.hi)}]`;

sweep("ice-a0", ["--arms", "A0"], {});
const A0 = rows("ice-a0"), sub = (a, m) => a.slice(0, m);
const L = [`# ICE PATCH MAX fragility, room 2, s ${from}.., NORM pace`, "", `## Boost (n ${n}, shipped ×1.5; speed cap ${CFG.MAX_SPEED}: start speed ${CFG.PLAYER_START.speed} reaches the cap only at speed x boost >= ${CFG.MAX_SPEED})`, "", "| boost | Δ lose pp [CI] | +3..+10 | win % | hit<5 s runs A0 / A1 |", "|---|---|---|---|---|"];
const verdict = (c) => (100 * c.lo >= 3 && 100 * c.hi <= 10 ? "holds" : 100 * c.hi < 3 || 100 * c.lo > 10 ? "misses" : "straddles");
for (const b of BOOSTS) {
  const name = "ice-b" + b, file = join(OUT, name + ".prof.json");
  if (!read) writeFileSync(file, JSON.stringify([{}, {}, { glide: { boost: b } }]));
  sweep(name, ["--arms", "A1", "--prof", file], {});
  const r = rows(name), c = pairedCI(A0.map(lose), r.map(lose));
  L.push(`| ×${b} | ${ci(c)} | ${verdict(c)} | ${pc(r.filter((x) => x.st === "WIN").length / r.length)} | ${A0.reduce((a, x) => a + x.hit5, 0)} / ${r.reduce((a, x) => a + x.hit5, 0)} |`);
}
/* blocks at the shipped knobs */
const R15 = rows("ice-b1.5");
L.push("", "## Seed blocks (×1.5, 1000 seeds each)", "", "| block | Δ lose pp [CI] |", "|---|---|");
let sw = 0, swx = 0;
const blocks = [];
for (let i = 0; i < Math.floor(n / 1000); i++) {
  const a = A0.slice(i * 1000, (i + 1) * 1000).map(lose), b = R15.slice(i * 1000, (i + 1) * 1000).map(lose), c = pairedCI(a, b);
  let v = 0;
  for (let j = 0; j < a.length; j++) v += (b[j] - a[j] - c.mean) ** 2;
  const se2 = v / (a.length - 1) / a.length;
  blocks.push({ m: c.mean, w: 1 / se2 });
  sw += 1 / se2; swx += c.mean / se2;
  L.push(`| ${from + i * 1000} | ${ci(c)} |`);
}
const mean = swx / sw, Q = blocks.reduce((q, x) => q + x.w * (x.m - mean) ** 2, 0);
L.push("", `Pooled ${pc(mean)} pp; heterogeneity Q = ${Q.toFixed(1)} on ${blocks.length - 1} df (Q near df = the spread is what sampling alone gives); block means ${pc(Math.min(...blocks.map((x) => x.m)))} .. ${pc(Math.max(...blocks.map((x) => x.m)))}.`);
/* the player */
L.push("", `## The player (n ${nP}, ×1.5)`, "", "| brake | Δ lose pp [CI] | +3..+10 | lose % | win % | timeout % | hit<5 s A0 / A1 | hit<15 s A0 / A1 | hits/run |", "|---|---|---|---|---|---|---|---|---|");
const label = { "": "at once (shipped fork)", 0: "never, knows the coast", naive: "never, has not learned it" };
for (const k of KINDS) {
  const name = "ice-p" + (k || "once").replace(":", "");
  sweep(name, ["--arms", "A1"], k ? { FG_BOTBRAKE: k } : {}, nP);
  const r = rows(name), a = sub(A0, r.length), c = pairedCI(a.map(lose), r.map(lose)), S = (rs, f) => rs.reduce((x, y) => x + y[f], 0);
  L.push(`| ${label[k] || k.replace("late:", "") + " ticks late (" + (+k.slice(5) / 60).toFixed(2) + " s)"} | ${ci(c)} | ${verdict(c)} | ${pc(r.filter((x) => x.st === "LOSE").length / r.length)} | ${pc(r.filter((x) => x.st === "WIN").length / r.length)} | ${pc(r.filter((x) => x.st === "TIMEOUT").length / r.length)} | ${S(a, "hit5")} / ${S(r, "hit5")} | ${S(a, "hit15")} / ${S(r, "hit15")} | ${(S(r, "hits") / r.length).toFixed(2)} |`);
}
const text = L.join("\n");
writeFileSync(join(OUT, "ice-report.md"), text + "\n");
console.log(text);
