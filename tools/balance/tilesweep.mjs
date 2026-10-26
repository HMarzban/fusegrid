#!/usr/bin/env node
/* #25 FLOOR-TILE BALANCE SWEEP (offline; never in npm test, never imported
   by src/). Measures a tile room under four arms on the SAME gen-3 world
   (tilerun.mjs): A0 tiles off, A1 the dial, A2 CORE knobs at every heat, A3
   MAX knobs at every heat. Judge: the tile-aware fork (demobot-tiles.mjs).
   The real step() at CFG.STEP, a 120 s cap per room, pact 0, held-out seeds
   seedOf(s) = fmix((300000+s)*104723 + 0x7a11) (botsweep and the fairness
   sweep use other streams). Paired bootstrap 95% CIs (stats.mjs, 2000
   resamples), unresolved results printed as unresolved.

   RUN (from the repo root):
     node tools/balance/tilesweep.mjs --plan pilot              # 200 seeds, s 0..199
     node tools/balance/tilesweep.mjs --plan main --n 3000 --from 10000
     node tools/balance/tilesweep.mjs --plan pace|controls|run|pin|all
     node tools/balance/tilesweep.mjs --rooms 5 --heats 0,2 --arms A0,A1 \
       --prof knobs.json --name trap-near4 --n 400
   knobs.json: a 3-tier table of partial FEAT_PROFILE overrides, CORE / PLUS /
   MAX, e.g. [{}, {"plate":{"near":4}}, {"plate":{"near":4,"wind":1.2}}]; it is
   set as w.featProf after loadLevel (placement and spawns keep the stock
   profile, so A0 is the same for every table). --a23 0,1,2 picks the heats
   that get the A2 / A3 arms (default 1 = PLUS). --workers N (default cpus-2).
   Plans: pilot = tile rooms 1 BOOSTER / 2 ICE PATCH / 3 CONVEYOR / 5 TRAP x
   CORE / PLUS / MAX x A0, A1 (+ A2, A3 at --a23), NORM; main = the same at
   --n; pace = EASY on rooms 1, 3, 5 and HARD on room 2, A0 / A1; controls =
   rooms 4, 6, 7, 8 (art-only tiles) A0 / A1, checked byte for byte; run =
   rooms 1 -> 5 with progress kept; pin = the fork vs the stock bot tick by
   tick (gen-3 A0 and gen 1, rooms 1-8 x 3 heats); all = pilot + pace +
   controls + run.
   OUTPUT (git-ignored tools/balance/out/): <name>.jsonl (one row per run,
   sorted by cell then seed; rows hold no clock, so the same seeds give the
   same file), <name>.cpu.json (wall and CPU time), <name>.md (the summary).
   TIME (M-series, 16 workers): pilot about 2-3 min wall; main at n 3000
   about 15x the pilot. A run row costs 10-40 ms (the no-escape probe
   dominates). Workers are child processes, stopped by PID at the end or on
   SIGINT / SIGTERM. */
import { fork } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const list = (s) => String(s).split(",").filter(Boolean).map((x) => (/^-?\d+$/.test(x) ? +x : x));
const TILE_ROOMS = [1, 2, 3, 5], CTRL_ROOMS = [4, 6, 7, 8];

/* ---------------- worker ---------------- */
if (argv[0] === "--worker") {
  const { runRoom, runLevel, pinRun } = await import("./tilerun.mjs");
  process.on("message", (m) => {
    if (m === "exit") { process.exit(0); }
    const c0 = process.cpuUsage(), rows = [];
    for (let s = m.s0; s < m.s1; s++) rows.push(m.cell.pin ? pinRun(m.cell, s) : m.cell.run ? runLevel(m.cell, s) : runRoom(m.cell, s));
    const u = process.cpuUsage(c0);
    process.send({ id: m.id, rows, cpu: (u.user + u.system) / 1e6 });
  });
  process.send({ ready: 1 });
} else await main();

function plan(name, a23, prof, profName) {
  const cells = [], add = (c) => cells.push({ pace: 0, prof, profName, ...c });
  const ab = (rooms, heats, pace, arms) => { for (const room of rooms) for (const heat of heats) for (const arm of arms) add({ room, heat, pace, arm }); };
  if (name === "pilot" || name === "main" || name === "all") {
    ab(TILE_ROOMS, [0, 1, 2], 0, ["A0", "A1"]);
    ab(TILE_ROOMS, a23, 0, ["A2", "A3"]);
  }
  if (name === "pace" || name === "all") { ab([1, 3, 5], [0, 1, 2], -1, ["A0", "A1"]); ab([2], [0, 1, 2], 1, ["A0", "A1"]); }
  if (name === "controls" || name === "all") ab(CTRL_ROOMS, [0, 1, 2], 0, ["A0", "A1"]);
  if (name === "run" || name === "all") for (const heat of [0, 1, 2]) for (const arm of ["A0", "A1"]) add({ run: 1, heat, arm });
  if (name === "pin") for (const gen of [3, 1]) for (let room = 1; room <= 8; room++) for (const heat of [0, 1, 2]) cells.push({ pin: 1, gen, room, heat });
  return cells;
}

async function main() {
  const name = arg("--plan", null), custom = argv.includes("--rooms");
  if (!name && !custom) { console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]); process.exit(2); }
  const n = +arg("--n", 200), from = +arg("--from", name === "main" ? 10000 : 0);
  const a23 = list(arg("--a23", "1"));
  const profFile = arg("--prof", null), prof = profFile ? JSON.parse(readFileSync(profFile, "utf8")) : undefined;
  const profName = arg("--name", profFile ? profFile.replace(/^.*\//, "").replace(/\.json$/, "") : "");
  let cells;
  if (custom) {
    cells = [];
    for (const room of list(arg("--rooms"))) for (const heat of list(arg("--heats", "0,1,2"))) for (const arm of list(arg("--arms", "A0,A1")))
      cells.push({ room, heat, pace: +arg("--pace", 0), arm, prof, profName });
  } else cells = plan(name, a23, prof, profName);
  const out = arg("--out", join(HERE, "out", (profName || name || "custom") + (from ? "-" + from : "")));
  const W = Math.max(1, Math.min(+arg("--workers", cpus().length - 2), 64));
  const CH = 25, jobs = [];
  for (const cell of cells) for (let s = from; s < from + n; s += CH) jobs.push({ id: jobs.length, cell, s0: s, s1: Math.min(from + n, s + CH) });
  console.log(`tilesweep: ${cells.length} cells x ${n} seeds (s ${from}..${from + n - 1}) = ${cells.length * n} runs, ${jobs.length} jobs, ${W} workers`);
  const t0 = Date.now(), res = [], kids = new Set();
  let cpu = 0, done = 0;
  const stop = () => { for (const k of kids) { try { process.kill(k.pid, "SIGTERM"); } catch {} } };
  process.on("SIGINT", () => { stop(); process.exit(130); });
  process.on("SIGTERM", () => { stop(); process.exit(143); });
  await new Promise((resolve, reject) => {
    let next = 0, live = 0;
    for (let i = 0; i < Math.min(W, jobs.length); i++) {
      const k = fork(fileURLToPath(import.meta.url), ["--worker"], { stdio: ["ignore", "inherit", "inherit", "ipc"] });
      kids.add(k); live++;
      const feed = () => { if (next < jobs.length) k.send(jobs[next++]); else k.send("exit"); };
      k.on("message", (m) => {
        if (m.ready) return feed();
        res.push(m); cpu += m.cpu; done++;
        if (done % Math.max(1, Math.round(jobs.length / 10)) === 0) process.stdout.write(`  ${done}/${jobs.length} jobs, ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
        feed();
      });
      k.on("exit", (code) => { kids.delete(k); live--; if (code) { stop(); reject(new Error("worker " + k.pid + " exit " + code)); } else if (!live) resolve(); });
    }
  });
  const wall = (Date.now() - t0) / 1000;
  const rows = res.sort((a, b) => a.id - b.id).flatMap((m) => m.rows);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out + ".jsonl", rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  const meta = { plan: name || "custom", prof: prof || null, profName, n, from, cells: cells.length, runs: rows.length, workers: W, wallS: +wall.toFixed(1), cpuMin: +(cpu / 60).toFixed(2) };
  writeFileSync(out + ".cpu.json", JSON.stringify(meta, null, 1) + "\n");
  const { summary } = await import("./summary.mjs");
  const md = summary(rows, meta);
  writeFileSync(out + ".md", md);
  console.log(md);
  console.log(`-> ${out}.jsonl / .md / .cpu.json  (wall ${wall.toFixed(1)} s, cpu ${(cpu / 60).toFixed(2)} min)`);
}
