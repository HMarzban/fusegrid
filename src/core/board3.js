/* Gen 3 (every ordinary run and the DAILY since v198): the gen-2 board plus the
   world.feat tile layer, gated by the static tile checks. board2.js holds the seam and
   this module registers genBoard3 on import (src/main.js in the browser, a plain import
   in Node tests and tools), so the bare sim still imports without the checks. */
import { CFG, T, key, biomeOf } from "./config.js";
import { FEAT_PROFILE, HOME } from "./feat.js";
import { placeFeat } from "./featplace.js";
import { featChecks, gateSplit, gateSpot } from "./featchecks.js";
import { validateBoard, TRIES } from "./fair.js";
import { genBoard2, layout2, gateOpts, setGen3 } from "./board2.js";

const N = CFG.COLS * CFG.ROWS;

/* gen 3: the gen-2 board of every heat plus the world.feat tile
   layer, placed on the layout (so heat never moves a tile). The tiles it
   forces open are the only grid change (bar the TRAP re-roll below); a salt is
   kept only when all three heats still pass the gate, else the plain gen-2
   board ships. */
/* #28: BOOSTER spot gate. Candidates come in placement order; each one is kept
   only if, with it and every booster kept so far forced open, V18 and V19
   find no spot on the grid of ALL three heats (so every heat keeps the same
   layer, R5 / V21); stops at `want`, fails below BLOOM_PLACE.min. near (#18):
   only bombs in line with the candidate can change the answer, since no relay
   reaches another booster (BLOOM_PLACE.gap 3 > fwd / side 2); a test proves the
   layers equal the full scan. */
export const BLOOM_GATE = { on: true, only: ["V18", "V19"], min: 3, near: true };
function bloomGate(base, level, lay) {
  return (cand, want, sp) => {
    const used = [], uk = [];
    for (const [x, y] of cand) {
      if (used.length >= want) break;
      if (sp(used, x, y)) continue;
      const ks = [...uk, key(x, y)], f = new Uint8Array(N);
      for (const k of ks) f[k] = 6;
      let ok = true;
      for (let h = 0; h < 3 && ok; h++) {
        const g = base[h].grid.slice();
        for (const k of ks) g[k] = T.EMPTY;
        ok = !featChecks({ grid: g, feat: f, level, heat: h, items: [], enemies: [] }, FEAT_PROFILE[h], { only: BLOOM_GATE.only, near: BLOOM_GATE.near ? [key(x, y)] : null, firstSpot: true }).length;
      }
      if (ok) { used.push([x, y]); uk.push(key(x, y)); }
    }
    return used.length >= BLOOM_GATE.min ? uk : null;
  };
}
/* PORTAL (V35): `cells` is the portals kept so far plus the new pair, twins in
   pairs; only a bomb in line with a portal or a walk away from one can change the
   answer, so `near` skips the rest */
function portalGate(base, level) {
  return (cells) => {
    const ks = cells.map(([x, y]) => key(x, y)), f = new Uint8Array(N), pr = new Uint8Array(N);
    ks.forEach((k, i) => { f[k] = 13; pr[k] = 1 + (i >> 1); });
    for (let h = 2; h >= 0; h--) {
      const g = base[h].grid.slice();
      for (const k of ks) g[k] = T.EMPTY;
      if (featChecks({ grid: g, feat: f, featPair: pr, level, heat: h, items: [], enemies: [] }, FEAT_PROFILE[h], { only: ["V35"], near: ks, firstSpot: true }).length) return false;
    }
    return true;
  };
}
/* wave 2 / 3 placement gates: a biome's function checks candidates against the
   grids of all three heats, the same contract as bloomGate's closure. */
function tileGate(base, level, lay) {
  if (lay.biome === "CROWN") return gatePlace(base, level);
  if (lay.biome === "SAND") return quickGate(base, level);
  if (lay.biome === "WATER") return streamGate(base, level);
  if (lay.biome === "VOID") return portalGate(base, level);
  return null;
}
/* V32 + V33: a gate stays only if, with every kept gate shut for good, the map
   keeps its pieces and no heat gains a no-escape spot. A candidate that fails
   alone fails in any company, so a re-shuffle never pays for it twice. */
function gatePlace(base, level) {
  const bad = new Set();
  return ([x, y], used) => {
    const c = key(x, y), ks = [...used.map(([a, b]) => key(a, b)), c];
    if (bad.has(c)) return false;
    const ok = !gateSplit(base[0].grid, ks) && [0, 1, 2].every((h) => !gateSpot({ grid: base[h].grid, level, heat: h }, FEAT_PROFILE[h], ks, c));
    if (!ok && !used.length) bad.add(c);
    return ok;
  };
}
/* QUICKSAND: the finished set, on every heat's grid with its tiles forced open */
function quickGate(base, level) {
  return (ks) => {
    const f = new Uint8Array(N);
    for (const k of ks) f[k] = 12;
    return [0, 1, 2].every((h) => {
      const g = base[h].grid.slice();
      for (const k of ks) g[k] = T.EMPTY;
      return !featChecks({ grid: g, feat: f, level, heat: h, items: [], enemies: [] }, FEAT_PROFILE[h], { only: ["V30", "V31"] }).length;
    });
  };
}
/* STREAM: a run is kept only if, with it and the runs kept so far forced open, the
   float and the wade add no spot at any heat (V18, V19) */
function streamGate(base, level) {
  return (kept, ks, code) => {
    const f = kept.slice(), all = [];
    for (const k of ks) f[k] = code;
    for (let k = 0; k < N; k++) if (f[k]) all.push(k);
    for (let h = 2; h >= 0; h--) {
      const g = base[h].grid.slice();
      for (const k of all) g[k] = T.EMPTY;
      const b = { grid: g, feat: f, level, heat: h, items: [], enemies: [] }, P = FEAT_PROFILE[h];
      if (featChecks(b, P, { only: ["V29"], around: all, aroundR: 0, firstSpot: true }).length) return false;
      if (featChecks(b, P, { only: ["V18", "V19"], around: all, aroundR: P.stream.wade < 1 ? undefined : 0, firstSpot: true }).length) return false;
    }
    return true;
  };
}
function place3(base, seed, level, heat) {
  const L = base[heat].layout, lay = layout2(seed, level, L.tries[0]);
  const gate = BLOOM_GATE.on && lay.biome === "JUNGLE" ? bloomGate(base, level, lay) : tileGate(base, level, lay);
  for (let pa = 0; pa < 4; pa++) {
    const pf = placeFeat(lay.m, seed, level, lay.biome, pa, gate, lay.tpl);
    if (gate && pf && !pf.feat) continue;
    if (!pf || !pf.feat) break;
    const open = base.map((b) => { const g = b.grid.slice(); for (const k of pf.force) g[k] = T.EMPTY; return g; });
    if ([0, 1, 2].every((h) => !base[h].layout.fallback && !validateBoard(open[h], level, h, gateOpts(lay, ...base[h].layout.tries, pf.force)).length))
      return { grid: open[heat], feat: pf.feat, featPair: pf.pair || null, layout: { ...L, featKind: pf.kind, ignore: pf.force } };
  }
  return null;
}
/* #22: TRAP spots hang on the layout's walls, so no salt can help a layout
   without 3 SHRINK-safe spots (V20 + V26). Only here does gen 3 leave the gen-2
   layout: it walks the same layout attempts through the same gates at all three
   heats. A seed that runs out keeps its gen-2 board with no tiles (V23). */
export function genBoard3(seed, level, heat = 0) {
  const base = [0, 1, 2].map((h) => genBoard2(seed, level, h));
  if (base[heat].layout.fallback) return base[heat];
  const placed = place3(base, seed, level, heat);
  if (placed) return placed;
  if (HOME[biomeOf(level).name] !== "PLATE") return base[heat];
  for (let a = base[heat].layout.tries[0] + 1; a < TRIES; a++) {
    const next = [0, 1, 2].map((h) => genBoard2(seed, level, h, { from: a }));
    if (next.some((b) => b.layout.fallback)) continue;
    const at = next[heat].layout.tries[0];
    if (next.some((b) => b.layout.tries[0] !== at)) continue;
    const r = place3(next, seed, level, heat);
    if (r) return r;
    a = at;
  }
  return base[heat];
}
setGen3(genBoard3);
