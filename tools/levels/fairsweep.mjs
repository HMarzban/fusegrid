#!/usr/bin/env node
/* #11 / #12 offline sweep: 1000 seeds x rooms 1-8 x CORE / PLUS / MAX through
   validateBoard (src/core/fair.js), gen 1 (the report-only diagnostic) and
   gen 2 (the gate). Writes the per-rule failure table, gen-2 fallbacks /
   rosters cut / pocket leaks / foe minima / brick means, gen-1 open lanes and
   hunters under 8 EMPTY steps, and the variety gate (distinct wall layouts per
   1000 seeds per room against the HoE H4 floors; exit 1 if any room is under).
     node tools/levels/fairsweep.mjs [--n 1000] [--out tools/levels/out/fairsweep.json]
   Seeds: fmix(s * 7919 + 13); the CI sample (tests/fair.test.mjs,
   tests/board2.test.mjs) is the first 200 of the same sequence. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { T, key, EW_CAPPED } from "../../src/core/config.js";
import { createWorld, loadLevel } from "../../src/core/sim.js";
import { heatRoster } from "../../src/core/heat.js";
import { RULES, validateBoard, walk, openLane, sealed, foeMin } from "../../src/core/fair.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const N = +arg("--n", 1000), OUT = arg("--out", "tools/levels/out/fairsweep.json");
const FLOOR = [200, 60, 60, 500, 80, 900, 900, 250];
const fmix = (h) => { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
const t0 = Date.now(), H = ["CORE", "PLUS", "MAX"];
const table = { 1: {}, 2: {} }, lanes = [0, 0, 0], g2 = { boards: 0, pass: 0, fallbacks: 0, cut: 0, leaks: 0, oddWalls: 0, heatWalls: 0, minFoe: 99, minHunt: 99 };
let hunters = 0, hNear = 0;
const bricks = {}, variety = Array.from({ length: 8 }, () => new Set()), tpl = {};
for (const gen of [1, 2]) for (const h of [0, 1, 2]) for (let lv = 1; lv <= 8; lv++) table[gen][lv + ":" + H[h]] = Object.fromEntries(RULES.map((r) => [r, 0]));
for (let s = 0; s < N; s++) {
  const seed = fmix(s * 7919 + 13);
  for (let lv = 1; lv <= 8; lv++) {
    let walls = null;
    for (let h = 0; h < 3; h++) {
      const w1 = createWorld(seed, lv); w1.heat = h; loadLevel(w1, lv, false);
      for (const r of validateBoard(w1.grid, lv, h, { foes: w1.enemies, items: w1.items })) table[1][lv + ":" + H[h]][r]++;
      if (openLane(w1.grid)) lanes[h]++;
      const e = walk(w1.grid, false);
      for (const en of w1.enemies) if (en.hunt) { hunters++; const v = e[key(en.tx, en.ty)]; if (v >= 0 && v < 8) hNear++; }
      const w = createWorld(seed, lv); w.gen = 2; w.heat = h; loadLevel(w, lv, false);
      const L = w.layout, f = validateBoard(w.grid, lv, h, { capped: EW_CAPPED, sym: L.sym, flip: L.flip, tries: L.tries, fallback: L.fallback, foes: w.enemies, items: w.items });
      for (const r of f) table[2][lv + ":" + H[h]][r]++;
      g2.boards++; if (!f.length) g2.pass++;
      if (L.fallback) g2.fallbacks++;
      if (w.enemies.length < heatRoster(lv, h).length) g2.cut++;
      if (!sealed(w.grid)) g2.leaks++;
      for (let y = 1; y < 12; y += 2) for (let x = 1; x < 14; x += 2) if (w.grid[key(x, y)] === T.WALL) g2.oddWalls++;
      const wl = Array.from(w.grid, (v) => +(v === T.WALL)).join("");
      if (walls === null) walls = wl; else if (wl !== walls) g2.heatWalls++;
      if (h === 0) { variety[lv - 1].add(wl); tpl[L.name] = (tpl[L.name] || 0) + 1; }
      const d = walk(w.grid);
      for (const en of w.enemies) { const v = d[key(en.tx, en.ty)]; if (v < 0) continue; if (foeMin(en.type) === 12) g2.minHunt = Math.min(g2.minHunt, v); else g2.minFoe = Math.min(g2.minFoe, v); }
      let nb = 0, n1 = 0;
      for (const v of w.grid) if (v === T.BRICK) nb++;
      for (const v of w1.grid) if (v === T.BRICK) n1++;
      const b = (bricks[lv + ":" + H[h]] ||= [0, 0]); b[0] += n1; b[1] += nb;
    }
  }
}
const vary = variety.map((v, i) => ({ room: i + 1, distinct: v.size, floor: FLOOR[i], ok: v.size >= FLOOR[i] }));
const report = {
  n: N, seeds: "fmix(s*7919+13)", ms: Date.now() - t0,
  gen1: { openLanePct: lanes.map((v) => +(100 * v / (8 * N)).toFixed(1)), huntersUnder8: [hNear, hunters], fails: table[1] },
  gen2: { ...g2, fails: table[2], templates: tpl },
  bricksMean: Object.fromEntries(Object.entries(bricks).map(([k, [a, b]]) => [k, [+(a / N).toFixed(1), +(b / N).toFixed(1)]])),
  variety: vary,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 1));
const sum = (gen) => { const o = Object.fromEntries(RULES.map((r) => [r, 0])); for (const c of Object.values(table[gen])) for (const r of RULES) o[r] += c[r]; return o; };
console.log(`per-rule failures over ${8 * 3 * N} boards`);
console.log("rule  " + RULES.map((r) => r.padStart(6)).join(""));
for (const gen of [1, 2]) console.log(`gen ${gen} ` + RULES.map((r) => String(sum(gen)[r]).padStart(6)).join(""));
console.log(`gen 1: open 5-step lanes ${report.gen1.openLanePct.join(" / ")} %; hunters under 8 EMPTY steps ${hNear} / ${hunters}`);
console.log(`gen 2: ${g2.pass} / ${g2.boards} pass; fallbacks ${g2.fallbacks}, cut ${g2.cut}, leaks ${g2.leaks}, odd walls ${g2.oddWalls}, heat walls ${g2.heatWalls}, minima ${g2.minFoe} / ${g2.minHunt}`);
console.log("bricks gen1 -> gen2 " + Object.entries(report.bricksMean).map(([k, v]) => `${k} ${v[0]}->${v[1]}`).join(", "));
console.log("variety " + vary.map((v) => `${v.room}:${v.distinct}/${v.floor}${v.ok ? "" : " UNDER"}`).join(" "));
console.log(`${report.ms} ms -> ${OUT}`);
process.exit(vary.every((v) => v.ok) && g2.pass === g2.boards ? 0 : 1);
