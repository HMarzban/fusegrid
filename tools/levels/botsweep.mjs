#!/usr/bin/env node
/* #12 demobot sweep (offline): rooms 1-8 x CORE / MAX x N held-out seeds, the
   real step(), a 120 s cap per run, gen 1 vs gen 2. Per cell: runs hit in the
   first 5 s (gate: gen 2 <= gen 1 in EVERY cell), runs hit in the first 15 s,
   lose % and win % (reported, not gated). One child process per cell.
     node tools/levels/botsweep.mjs [--n 300] [--out tools/levels/out/botsweep.json]
   Held-out seeds: fmix(s * 7919 + 13) for s in [100000, 100000 + n), never the
   CI sample or the 1000-seed fairness sweep. */
import { fork } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const N = +arg("--n", 300), OUT = arg("--out", "tools/levels/out/botsweep.json"), CAP = 120;
const fmix = (h) => { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; return (h ^ (h >>> 16)) >>> 0; };

async function cell(gen, room, heat, n) {
  const { CFG } = await import("../../src/core/config.js");
  const { createWorld, loadLevel, step } = await import("../../src/core/sim.js");
  const { createDemobot } = await import("../../src/app/demobot.js");
  const r = { gen, room, heat, n, hit5: 0, hit15: 0, lose: 0, win: 0, winT: 0 };
  for (let s = 0; s < n; s++) {
    const seed = fmix((100000 + s) * 7919 + 13), w = createWorld(seed, room);
    w.gen = gen; w.heat = heat; loadLevel(w, room, false); w.state = "PLAY";
    const bot = createDemobot(seed);
    let hit = -1;
    for (let i = 0; i < CAP / CFG.STEP && w.state === "PLAY"; i++) {
      step(w, CFG.STEP, { 0: bot.intent(w) });
      if (hit < 0 && w.events.some((e) => e.t === "hurt")) hit = i * CFG.STEP;
      w.events.length = 0;
    }
    if (hit >= 0 && hit < 5) r.hit5++;
    if (hit >= 0 && hit < 15) r.hit15++;
    if (w.state === "LOSE") r.lose++;
    if (w.state === "WIN") { r.win++; r.winT += w.time; }
  }
  return r;
}

if (process.argv[2] === "--cell") {
  const [gen, room, heat, n] = process.argv.slice(3).map(Number);
  process.send(await cell(gen, room, heat, n));
  process.exit(0);
}
const jobs = [];
for (const gen of [1, 2]) for (let room = 1; room <= 8; room++) for (const heat of [0, 2]) jobs.push([gen, room, heat]);
const res = [], self = fileURLToPath(import.meta.url), t0 = Date.now();
await new Promise((done) => {
  let next = 0, live = 0;
  const go = () => {
    if (next >= jobs.length) { if (!live) done(); return; }
    const j = jobs[next++], c = fork(self, ["--cell", ...j, N].map(String));
    live++;
    c.on("message", (m) => res.push(m));
    c.on("exit", () => { live--; go(); });
  };
  for (let i = 0; i < Math.max(1, Math.min(jobs.length, cpus().length - 2)); i++) go();
});
const at = (g, r, h) => res.find((x) => x.gen === g && x.room === r && x.heat === h);
const rows = [];
let gate = true, t1 = [0, 0], t2 = [0, 0];
for (let room = 1; room <= 8; room++) for (const heat of [0, 2]) {
  const a = at(1, room, heat), b = at(2, room, heat), ok = b.hit5 <= a.hit5;
  gate &&= ok;
  t1[0] += a.hit5; t2[0] += b.hit5; t1[1] += a.lose; t2[1] += b.lose;
  rows.push({ room, heat: heat ? "MAX" : "CORE", hit5: [a.hit5, b.hit5], ok, hit15: [a.hit15, b.hit15], losePct: [+(100 * a.lose / N).toFixed(1), +(100 * b.lose / N).toFixed(1)], winPct: [+(100 * a.win / N).toFixed(1), +(100 * b.win / N).toFixed(1)], winS: [a.win ? +(a.winT / a.win).toFixed(1) : null, b.win ? +(b.winT / b.win).toFixed(1) : null] });
}
const report = { n: N, capS: CAP, seeds: "fmix((100000+s)*7919+13)", rows, pooled: { hit5: [t1[0], t2[0]], losePct: [+(100 * t1[1] / (16 * N)).toFixed(1), +(100 * t2[1] / (16 * N)).toFixed(1)] }, gate, ms: Date.now() - t0 };
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 1));
console.log("room heat | hit<5s gen1 gen2 | hit<15s gen1 gen2 | lose% gen1 gen2 | win% gen1 gen2 | win s gen1 gen2");
for (const r of rows) console.log(`${r.room} ${r.heat.padEnd(4)} | ${String(r.hit5[0]).padStart(3)} ${String(r.hit5[1]).padStart(3)} ${r.ok ? "ok" : "OVER"} | ${r.hit15.join(" ")} | ${r.losePct.join(" ")} | ${r.winPct.join(" ")} | ${r.winS.join(" ")}`);
console.log(`pooled hit<5s ${t1[0]} -> ${t2[0]}; lose% ${report.pooled.losePct.join(" -> ")}; gate ${gate ? "PASS" : "FAIL"}; ${report.ms} ms -> ${OUT}`);
process.exit(gate ? 0 : 1);
