#!/usr/bin/env node
/* ICE PATCH MAX fragility (#20, #30): what does the +3 .. +10 result rest on?
   Drives tilesweep.mjs for room 2 at MAX, one child at a time, then reads the rows:
   - boost: A1 at glide.boost 1.35 .. 1.7 through --prof (A0 never moves with a
     knob table, so one A0 pairs them all), with static V19 per knob;
   - the speed cap: which share of the ice ticks has speed x boost past MAX_SPEED,
     and the boost the player really gets there;
   - player: FG_BOTBRAKE at once / late:N / never (knows the coast) / naive
     (never, and flees as if it could stop anywhere), against A0 and against the
     at-once row on the same seeds;
   - blocks: the shipped ×1.5 per 2000-seed block (a heterogeneity Q).
     node tools/balance/icefrag.mjs --n 12000 --from 740000 --workers 4 --budget 1200
     node tools/balance/icefrag.mjs --n 12000 --from 740000 --read      (rows already on disk)
   ×1.0 and ×1.25 keep MAX's coast and brake: coast alone, and they sit under V16.
   --budget S starts no new sweep after S seconds; a cell not reached prints as
   not measured. Output: tools/balance/out/ice-*.jsonl and a printed report.
   Shipped knobs stay as they are; this proposes only. Never imported by src/. */
import { spawnSync } from "node:child_process";
import "../../src/core/board3.js";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pairedCI } from "./stats.mjs";
import { CFG, key } from "../../src/core/config.js";
import { tileOf } from "../../src/core/board.js";
import { step } from "../../src/core/sim.js";
import { FEAT_PROFILE } from "../../src/core/feat.js";
import { featChecks } from "../../src/core/featchecks.js";
import { createTileBot } from "./demobot-tiles.mjs";
import { makeWorld, runRoom, STEPS } from "./tilerun.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, "out"), argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const n = +arg("--n", 12000), from = +arg("--from", 740000), W = arg("--workers", "4"), read = argv.includes("--read"), budget = +arg("--budget", 1200), t0 = Date.now();
const BOOSTS = [1, 1.25, 1.35, 1.4, 1.45, 1.46, 1.47, 1.48, 1.5, 1.55, 1.6, 1.7], KINDS = ["", "late:3", "late:6", "late:12", "late:30", "0", "naive"], SPEEDS = [4.2, 5, 5.8], nS = Math.min(n, 6000);
/* priority order: the shipped arm and the brake first, so a budget cut costs the far knobs */
const ORDER = ["ice-a0", "ice-b1.5", "ice-p0", "ice-pnaive", "ice-plate12", "ice-plate30", "ice-plate6", "ice-plate3", "ice-b1.47", "ice-b1.48", "ice-b1.46", "ice-b1.4", "ice-b1.6", "ice-b1.45", "ice-b1.55", "ice-b1.7", "ice-b1.35", "ice-b1", "ice-b1.25", "ice-turn2", ...SPEEDS.flatMap((v) => [`ice-s${v}-a0`, `ice-s${v}-a1`])];
mkdirSync(OUT, { recursive: true });
const profFile = (name, g) => { const f = join(OUT, name + ".prof.json"); writeFileSync(f, JSON.stringify([{}, {}, { glide: g }])); return f; };
const cellArgs = (name) => {
  if (name === "ice-a0") return { args: ["--arms", "A0"], env: {} };
  if (name === "ice-turn2") return { args: ["--arms", "A1", "--prof", profFile(name, { turn: 0.2 })], env: {} };
  if (name.startsWith("ice-b")) return { args: ["--arms", "A1", "--prof", profFile(name, { boost: +name.slice(5) })], env: {} };
  if (name.startsWith("ice-s")) { const [, v, arm] = name.match(/^ice-s([\d.]+)-a(\d)$/); return { n: nS, args: ["--arms", "A" + arm, "--speed", v], env: {} }; }
  const k = name.slice(5);
  return { args: ["--arms", "A1"], env: { FG_BOTBRAKE: k.startsWith("late") ? "late:" + k.slice(4) : k } };
};
for (const name of ORDER) {
  if (read) break;
  if ((Date.now() - t0) / 1000 > budget) { console.error(`budget: ${name} not measured`); continue; }
  const c = cellArgs(name), t1 = Date.now();
  const r = spawnSync(process.execPath, [join(HERE, "tilesweep.mjs"), "--rooms", "2", "--heats", "2", "--n", String(c.n || n), "--from", String(from), "--workers", W, "--name", name, "--out", join(OUT, name), ...c.args], { env: { ...process.env, ...c.env }, stdio: ["ignore", "ignore", "inherit"] });
  if (r.status) throw new Error(name + " exit " + r.status);
  console.error(`${name}: ${((Date.now() - t1) / 1000).toFixed(0)} s, total ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
const has = (name) => existsSync(join(OUT, name + ".jsonl"));
const rows = (name) => readFileSync(join(OUT, name + ".jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).sort((a, b) => a.s - b.s);
const lose = (r) => (r.st === "LOSE" ? 1 : 0), pc = (x) => (100 * x).toFixed(1);
const ci = (c) => `${c.mean >= 0 ? "+" : ""}${pc(c.mean)} [${pc(c.lo)}, ${pc(c.hi)}]`;
const verdict = (c) => (100 * c.lo >= 3 && 100 * c.hi <= 10 ? "holds" : 100 * c.hi < 3 || 100 * c.lo > 10 ? "misses" : "straddles");
const S = (rs, f) => rs.reduce((x, y) => x + y[f], 0);
const share = (rs, st) => pc(rs.filter((x) => x.st === st).length / rs.length);

const A0 = rows("ice-a0");
const L = [`# ICE PATCH MAX fragility, room 2, s ${from}.., n ${n}, NORM pace`, "", `A0: lose ${share(A0, "LOSE")} %, win ${share(A0, "WIN")} %, hit<5 s ${S(A0, "hit5")}, hit<15 s ${S(A0, "hit15")}. The gate of record pools the hit<5 s ceiling over the tile rooms (summary.mjs); this table shows the paired Δ for this one cell. The live no-escape probe is not printed: it assumes the profile's brake gets pressed, so it cannot see a player who never brakes. The static no-brake line below is that number.`, ""];
const row = (label, r, extra = "", a0 = A0) => {
  const c = pairedCI(a0.map(lose), r.map(lose)), h15 = pairedCI(a0.map((x) => x.hit15), r.map((x) => x.hit15));
  return `| ${label} | ${ci(c)} | ${verdict(c)} | ${share(r, "LOSE")} | ${share(r, "WIN")} | ${share(r, "TIMEOUT")} | ${S(r, "hit5")} (${ci(pairedCI(a0.map((x) => x.hit5), r.map((x) => x.hit5)))}) | ${ci(h15)} ${h15.hi <= 0.05 ? "ok" : "OVER"} | ${(S(r, "hits") / r.length).toFixed(2)} |${extra}`;
};
const HEAD = "| lose % | win % | timeout % | hit<5 s runs (Δ pp vs A0) | Δ hit<15 s pp | hits/run |", RULE = "|---|---|---|---|---|---|";

/* static V19: boards x knob, plus the rule with no brake */
const SEEDS = 1000;
function v19(glide) {
  const P = { ...FEAT_PROFILE[2], glide: { ...FEAT_PROFILE[2].glide, ...glide } };
  let boards = 0, spots = 0, coast = 0;
  for (let s = from; s < from + SEEDS; s++) {
    const { w } = makeWorld({ room: 2, heat: 2, arm: "A1" }, s);
    const f = featChecks(w, P, { only: ["V19"] })[0];
    if (f) { boards++; spots += f.spots; coast += f.cause.coast || 0; }
  }
  return `${boards} / ${spots}${coast ? ` (coast ${coast})` : ""}`;
}
L.push(`## Boost (speed cap ${CFG.MAX_SPEED}; start speed ${CFG.PLAYER_START.speed}, one SPEED pickup +${CFG.SPEED_UP})`, "", `| boost | Δ lose pp [CI] | +3..+10 ${HEAD} static V19 boards / spots (${SEEDS} seeds) |`, `|---|---|---${RULE}---|`);
for (const b of BOOSTS) {
  const name = "ice-b" + b;
  L.push(has(name) ? row("×" + b, rows(name), ` ${v19({ boost: b })} |`) : `| ×${b} | not measured |`);
}
L.push("", `Static V19 at ×1.5 with no brake in the rule: ${v19({ stop: undefined })} (boards / spots). The player crosses a tile in ceil(${(1 / (CFG.PLAYER_START.speed * CFG.STEP)).toFixed(2)} / boost) ticks at the start speed: 13 below ×1.4706, 12 from there.`);
if (has("ice-turn2")) L.push("", `| knob | Δ lose pp [CI] | +3..+10 ${HEAD}`, `|---|---|---${RULE}`, row("×1.5, turn 0.2", rows("ice-turn2")));
L.push("", `## A carried SPEED pickup (×1.5, n ${nS}, each against its own A0 at that start speed)`, "", `| start speed (real boost) | Δ lose pp [CI] | +3..+10 ${HEAD}`, `|---|---|---${RULE}`);
for (const v of SPEEDS) {
  const name = `ice-s${v}-a`, lb = `${v} (×${(Math.min(v * 1.5, CFG.MAX_SPEED) / v).toFixed(2)})`;
  L.push(has(name + "1") && has(name + "0") ? row(lb, rows(name + "1"), "", rows(name + "0")) : `| ${lb} | not measured |`);
}

/* the speed cap: where does the boost clip, on the ticks that are on ice */
function capTally(b, m = 400) {
  const by = new Map();
  let ticks = 0, ice = 0, eff = 0, runsUp = 0;
  for (let s = from; s < from + m; s++) {
    const c = { room: 2, heat: 2, arm: "A1", prof: [{}, {}, { glide: { boost: b } }] }, { w, seed } = makeWorld(c, s), bot = createTileBot(seed);
    let up = false;
    for (let i = 0; i < STEPS && w.state === "PLAY"; i++) {
      step(w, CFG.STEP, { 0: bot.intent(w) });
      w.events.length = 0;
      const p = w.players[0];
      ticks++;
      if (p.speed > CFG.PLAYER_START.speed) up = true;
      if (w.feat[key(tileOf(p.x), tileOf(p.y))] === 5) { ice++; by.set(p.speed, (by.get(p.speed) || 0) + 1); eff += Math.min(p.speed * b, CFG.MAX_SPEED) / p.speed; }
    }
    if (up) runsUp++;
  }
  const clip = [...by].filter(([v]) => v * b > CFG.MAX_SPEED).reduce((a, [, x]) => a + x, 0);
  return `| ×${b} | ${pc(ice / ticks)} | ${pc(runsUp / m)} | ${[...by].sort((x, y) => x[0] - y[0]).map(([v, x]) => v.toFixed(1) + ": " + pc(x / ice)).join(", ")} | ${pc(clip / ice)} | ×${(eff / ice).toFixed(3)} |`;
}
L.push("", "## The speed cap (400 seeds, fresh start at room 2)", "", "| boost | ticks on ice % | runs with a SPEED pickup % | ice ticks by speed % | ice ticks clipped % | mean real boost on ice |", "|---|---|---|---|---|---|", ...[1.5, 1.6, 1.7].map((b) => capTally(b)));

/* the player */
const label = { "": "at once (shipped fork)", 0: "never, knows the coast", naive: "never, has not learned it" };
const once = rows("ice-b1.5");
L.push("", "## The player (×1.5)", "", `| brake | Δ lose pp [CI] | +3..+10 ${HEAD} vs at once, Δ lose pp |`, `|---|---|---${RULE}---|`);
for (const k of KINDS) {
  const name = k ? "ice-p" + k.replace(":", "") : "ice-b1.5";
  if (!has(name)) { L.push(`| ${label[k] || k} | not measured |`); continue; }
  const r = rows(name), vs = k ? ci(pairedCI(once.map(lose), r.map(lose))) : "-";
  L.push(row(label[k] || k.slice(5) + " ticks late (" + (+k.slice(5) / 60).toFixed(2) + " s)", r, ` ${vs} |`));
}

/* blocks at the shipped knobs */
const BL = 2000, blocks = [];
L.push("", `## Seed blocks (×1.5, ${BL} seeds each)`, "", "| block | Δ lose pp [CI] |", "|---|---|");
let sw = 0, swx = 0;
for (let i = 0; i < Math.floor(n / BL); i++) {
  const a = A0.slice(i * BL, (i + 1) * BL).map(lose), b = once.slice(i * BL, (i + 1) * BL).map(lose), c = pairedCI(a, b);
  let v = 0;
  for (let j = 0; j < a.length; j++) v += (b[j] - a[j] - c.mean) ** 2;
  const se2 = v / (a.length - 1) / a.length;
  blocks.push({ m: c.mean, w: 1 / se2 });
  sw += 1 / se2; swx += c.mean / se2;
  L.push(`| ${from + i * BL} | ${ci(c)} |`);
}
const mean = swx / sw, Q = blocks.reduce((q, x) => q + x.w * (x.m - mean) ** 2, 0);
L.push("", `Pooled ${pc(mean)} pp; heterogeneity Q = ${Q.toFixed(1)} on ${blocks.length - 1} df (Q near df = the spread is what sampling alone gives).`);

/* the knob table must not change the shipped arm: stock A1 == prof {boost 1.5}, row for row */
let same = 0;
for (let i = 0; i < 200; i++) { const a = runRoom({ room: 2, heat: 2, arm: "A1" }, from + i); if (a.st === once[i].st && a.t === once[i].t) same++; }
L.push("", `Pin: stock A1 vs the ×1.5 knob table, ${same} / 200 rows equal.`, "", `Wall ${((Date.now() - t0) / 1000).toFixed(0)} s.`);
const text = L.join("\n");
writeFileSync(join(OUT, "ice-report.md"), text + "\n");
console.log(text);
