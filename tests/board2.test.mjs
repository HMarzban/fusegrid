/* #12: the gen-2 generator (src/core/board2.js). Templates byte for byte from
   the appendix (THRONE / COURT = the appendix + TPL_EDITS), the CI structural sample through the #11 validator, the forced
   fair fallback, golden grids per layout, the brick budget, world.gen through
   every room / run transition, and gen 1 byte-identical. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CFG, T, key, isFinale, BIOMES, EW_CAPPED, EW_WALL_H_MAX } from "../src/core/config.js";
import { createWorld, loadLevel, step } from "../src/core/sim.js";
import { genBoard } from "../src/core/board.js";
import { heatProfile, heatRoster } from "../src/core/heat.js";
import { createRng } from "../src/core/rng.js";
import { hurtPlayer } from "../src/core/entities.js";
import { TPL, TPL_EDITS, genBoard2, layout2, fill2, fallback2 } from "../src/core/board2.js";
import { validateBoard, walk, sealed, stampStart, placeFoes, freeTiles, foeMin, TRIES } from "../src/core/fair.js";
import { DEMO_SEED, newDemoWorld } from "../src/app/attract.js";
import { SHOW_SEED, createShow } from "../src/app/intro.js";
import { createGame } from "../src/main.js";
import { ITEMS, SCREEN } from "../src/app/menuapp.js";

const C = CFG.COLS, R = CFG.ROWS;
const fmix = (h) => { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
const fnv = (a) => { let h = 0x811c9dc5; for (const v of a) { h ^= v & 255; h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, "0"); };
const SEEDS = Array.from({ length: 200 }, (_, s) => fmix(s * 7919 + 13));
const ROOM = { JUNGLE: 1, ICE: 2, FACTORY: 3, WATER: 4, ARENA: 5, SAND: 6, VOID: 7, CROWN: 8 };
const mk = (seed, lv, h, gen = 2) => { const w = createWorld(seed, lv); w.gen = gen; w.heat = h; loadLevel(w, lv, false); return w; };
const full = (w) => ({ capped: EW_CAPPED, sym: w.layout.sym, flip: w.layout.flip, tries: w.layout.tries, fallback: w.layout.fallback, foes: w.enemies, items: w.items });

test("templates: 12 are the appendix grids byte for byte, THRONE / COURT are the appendix plus the pinned N-S edits (V10 probe); 15x13, legend chars only, closed border", () => {
  const md = readFileSync(new URL("../docs/superpowers/specs/2026-10-20-level-variety-layouts.md", import.meta.url), "utf8");
  const re = /#### (\w+) · (\w+) \(room (\d)\)\n\nTemplate symmetry: `(\w+)`[^\n]*?Interior E-W lane walls \(odd x, even y\): ([^\n]*)\n\n```\n  x  012345678901234\n((?:y +\d+ [^\n]+\n){13})```/g;
  const doc = [...md.matchAll(re)];
  assert.equal(doc.length, 14);
  assert.equal(Object.values(TPL).flat().length, 14);
  assert.deepEqual(Object.fromEntries(Object.entries(TPL).map(([b, ts]) => [b, ts.length])), { JUNGLE: 1, ICE: 1, FACTORY: 1, WATER: 3, ARENA: 3, SAND: 1, VOID: 1, CROWN: 3 });
  assert.deepEqual(Object.keys(TPL_EDITS), ["CROWN/throne", "CROWN/court"]);
  const lanesOf = (rows) => { const o = []; for (let y = 2; y < R - 1; y += 2) for (let x = 1; x < C - 1; x += 2) if (rows[y][x] === "#" || rows[y][x] === "x") o.push(`(${x},${y})`); return o.length ? o.join(" ") + "." : "none."; };
  let same = 0;
  for (const m of doc) {
    const [, biome, name, room, sym, ew, body] = m, k = biome + "/" + name.toLowerCase(), rows = body.trim().split("\n").map((r) => r.replace(/^y +\d+ /, ""));
    const t = TPL[biome].find((q) => q.n === name.toLowerCase());
    assert.ok(t, k);
    assert.equal(ROOM[biome], +room);
    assert.equal(t.sym, sym);
    assert.equal(lanesOf(rows), ew.split(". ")[0].replace(/\.$/, "") + ".", k + " appendix E-W lane list");
    const want = rows.map((r) => r.split(""));
    for (const [x, y, from, to] of TPL_EDITS[k] || []) { assert.equal(want[y][x], from, k + " edit source"); want[y][x] = to; }
    const ours = t.t.trim().split("\n");
    assert.equal(ours.join("\n"), want.map((r) => r.join("")).join("\n"), k + " byte for byte");
    if (!TPL_EDITS[k]) same++;
    if (BIOMES[ROOM[biome] - 1].hWall > EW_WALL_H_MAX) assert.equal(lanesOf(ours), "none.", k + ": no E-W lane wall in a tall biome (V10)");
    assert.equal(ours.length, R);
    for (const [y, r] of ours.entries()) {
      assert.equal(r.length, C);
      assert.ok(/^[#xo.b?s]+$/.test(r), "legend chars only");
      for (let x = 0; x < C; x++) if (x === 0 || y === 0 || x === C - 1 || y === R - 1) assert.equal(r[x], "#");
      for (let x = 1; x < C - 1; x++) if (x % 2 && y % 2) assert.notEqual(r[x], "#", "V9 in the template");
      if (isFinale(ROOM[biome])) for (let x = 0; x < C; x++) assert.equal(r[x], r[C - 1 - x], k + " finale templates are h-symmetric (V12)");
    }
  }
  assert.equal(same, 12);
});

test("CI sample (200 seeds x 8 rooms x 3 heats): every board passes validateBoard; 0 fallbacks / rosters cut / leaks / (odd,odd) walls / heat-dependent walls; foes >= 10, hunters >= 12", () => {
  let fallbacks = 0, cut = 0, leaks = 0, odd = 0, heatWalls = 0, minF = 99, minH = 99;
  for (const seed of SEEDS) for (let lv = 1; lv <= 8; lv++) {
    let walls = null;
    for (let h = 0; h < 3; h++) {
      const w = mk(seed, lv, h), tag = `seed ${seed} room ${lv} heat ${h}`;
      assert.deepEqual(validateBoard(w.grid, lv, h, full(w)), [], tag);
      assert.equal(w.feat ?? null, null, "gen 2 never carries a tile");
      if (w.layout.fallback) fallbacks++;
      if (w.enemies.length < heatRoster(lv, h).length) cut++;
      if (!sealed(w.grid)) leaks++;
      for (let y = 1; y < R - 1; y += 2) for (let x = 1; x < C - 1; x += 2) if (w.grid[key(x, y)] === T.WALL) odd++;
      const wl = Array.from(w.grid, (v) => +(v === T.WALL)).join("");
      if (walls === null) walls = wl; else if (wl !== walls) heatWalls++;
      const d = walk(w.grid);
      for (const e of w.enemies) { const v = d[key(e.tx, e.ty)]; if (v < 0) continue; if (foeMin(e.type) === 12) minH = Math.min(minH, v); else minF = Math.min(minF, v); }
    }
  }
  console.log(`gen-2 CI sample: fallbacks ${fallbacks}, cut ${cut}, leaks ${leaks}, odd walls ${odd}, heat walls ${heatWalls}, minima ${minF} / ${minH}`);
  assert.deepEqual([fallbacks, cut, leaks, odd, heatWalls], [0, 0, 0, 0, 0]);
  assert.ok(minF >= 10 && minH >= 12);
  assert.deepEqual([minF, minH], [10, 12], "the floor binds exactly (prototype minima)");
});

test("brick budget: the gen-1 count for the same seed / room / heat minus 17 (JUNGLE 6), capped by the fill room; finales within one mirror orbit", () => {
  for (const seed of SEEDS.slice(0, 60)) for (let lv = 1; lv <= 8; lv++) for (let h = 0; h < 3; h++) {
    const b2 = genBoard2(seed, lv, h), [a, m] = b2.layout.tries, f = fill2(layout2(seed, lv, a), seed, lv, h, m);
    let v1 = 0, n = 0;
    for (const v of genBoard(seed, lv, heatProfile(h).carve)) if (v === T.BRICK) v1++;
    for (const v of b2.grid) if (v === T.BRICK) n++;
    assert.equal(f.target, v1 - (lv === 1 ? 6 : 17));
    assert.deepEqual(Array.from(f.grid), Array.from(b2.grid));
    const want = Math.min(f.target, f.cap);
    if (isFinale(lv)) assert.ok(n <= want && n >= want - 3, `room ${lv}: ${n} vs ${want}`);
    else assert.equal(n, want, `room ${lv}`);
  }
});

test("the layout is keyed (seed, room, attempt): heat never reaches it; the fill changes bricks only", () => {
  for (const seed of SEEDS.slice(0, 20)) for (let lv = 1; lv <= 8; lv++) {
    const L = layout2(seed, lv, 0);
    assert.deepEqual(L, layout2(seed, lv, 0));
    for (let h = 0; h < 3; h++) {
      const g = fill2(L, seed, lv, h, 0).grid;
      for (let i = 0; i < g.length; i++) assert.equal(g[i] === T.WALL, L.m[i] === 0);
    }
    if (L.biome === "CROWN") assert.ok(L.flip === 2 || L.flip === 3, "CROWN flips V or 180 only");
  }
});

test("the fair fallback (forced): the gen-1 grid plus the seal; it passes the validator and gen-2 foe placement seats every roster", () => {
  let n = 0;
  for (const seed of SEEDS.slice(0, 40)) for (let lv = 1; lv <= 8; lv++) for (let h = 0; h < 3; h++) {
    const b = genBoard2(seed, lv, h, { layouts: 0 });
    assert.equal(b.layout.fallback, true);
    assert.deepEqual(Array.from(b.grid), Array.from(stampStart(genBoard(seed, lv, heatProfile(h).carve))));
    assert.deepEqual(Array.from(b.grid), Array.from(fallback2(seed, lv, h)));
    assert.ok(sealed(b.grid));
    const free = freeTiles(b.grid), rng = createRng(seed ^ lv);
    for (let i = free.length - 1; i > 0; i--) { const j = rng.int(0, i); [free[i], free[j]] = [free[j], free[i]]; }
    const roster = heatRoster(lv, h), d = walk(b.grid), { pick } = placeFoes(free, roster, d);
    assert.equal(pick.length, roster.length, "no roster cut on the fallback");
    const foes = pick.map(([type, [tx, ty]]) => ({ type, tx, ty }));
    assert.deepEqual(validateBoard(b.grid, lv, h, { capped: EW_CAPPED, fallback: true, tries: [0, 0], foes }), [], `seed ${seed} room ${lv} heat ${h}`);
    n++;
  }
  assert.equal(n, 960);
  const f = genBoard2(SEEDS[0], 3, 0, { fills: 0 });
  assert.equal(f.layout.fallback, true, "no fill attempt left -> fallback, never a full 8 x 8");
  assert.equal(TRIES, 8);
});

test("golden grids: one fixed seed per layout (the first fmix seed that deals it at CORE)", () => {
  const G = { "JUNGLE/clearing": [2512092562, "b51169d9"], "ICE/lanes": [2512092562, "a95272c8"], "FACTORY/conveyor": [2512092562, "064938b7"],
    "WATER/islands": [2062676342, "b17e73ce"], "WATER/river": [3821583642, "7b5f1db1"], "WATER/atoll": [2512092562, "f122824e"],
    "ARENA/ring": [2512092562, "7f951a89"], "ARENA/pit": [1841444569, "3b4c68f0"], "ARENA/gauntlet": [2140575931, "f82c9f2f"],
    "SAND/ruins": [2512092562, "f94c0058"], "VOID/drift": [2512092562, "66022b7b"],
    "CROWN/throne": [2193589889, "a3aa2a39"], "CROWN/court": [3821583642, "a2c332a2"], "CROWN/vault": [2512092562, "f4f9c4fa"] };
  assert.equal(Object.keys(G).length, 14);
  for (const [k, [seed, h]] of Object.entries(G)) {
    const [b, n] = k.split("/"), r = genBoard2(seed, ROOM[b], 0);
    assert.equal(r.layout.tpl, n, k);
    assert.equal(r.layout.name, b + " · " + n.toUpperCase());
    assert.equal(fnv(r.grid), h, k);
  }
});

test("world.gen survives WIN -> next room, a lost life, GAME OVER and RESTART; gen 1 resets nothing", () => {
  const w = mk(SEEDS[3], 1, 1);
  w.state = "PLAY";
  const g1 = w.grid;
  hurtPlayer(w, () => {});
  assert.equal(w.gen, 2); assert.equal(w.grid, g1, "a lost life keeps the board");
  w.state = "WIN"; w.fireEdge = false;
  step(w, CFG.STEP, [{ fire: true }]);
  assert.equal(w.level, 2); assert.equal(w.gen, 2); assert.ok(w.layout && !w.layout.fallback && w.layout.name.startsWith("ICE"));
  w.state = "LOSE"; w.fireEdge = false;
  step(w, CFG.STEP, [{ fire: true }]);
  assert.equal(w.level, 1); assert.equal(w.gen, 2); assert.ok(w.layout.name.startsWith("JUNGLE"));
  loadLevel(w, 1, false);
  assert.equal(w.gen, 2, "PAUSE RESTART reloads room 1 on the same gen");
  const g = mk(SEEDS[3], 4, 0, 1);
  assert.equal(g.gen, 1); assert.equal(g.layout, null);
});

test("ATTRACT (DEMO_SEED) and the intro show (SHOW_SEED) stay gen 1; ordinary runs and the DAILY deal gen 2 (#13)", () => {
  const d = newDemoWorld(2), s = createShow().world;
  assert.equal(d.seed, DEMO_SEED); assert.equal(d.gen, 1); assert.equal(d.layout, null);
  assert.equal(s.seed, SHOW_SEED); assert.equal(s.gen, 1); assert.equal(s.layout, null);
  const g = createGame(null, { seed: 4242 });
  g.app.cabinetSeen = true; g.app.skip();
  g.app.cursor = ITEMS.indexOf("PLAY"); g.app.confirm();
  assert.equal(g.app.screen, SCREEN.GAME);
  assert.equal(g.world.gen, 2); assert.ok(g.world.layout && g.world.layout.name);
  assert.deepEqual(validateBoard(g.world.grid, g.world.level, g.world.heat, full(g.world)), []);
  const h = createGame(null, { seed: 4242 });
  h.app.cabinetSeen = true; h.app.skip();
  h.app.cursor = ITEMS.indexOf("DAILY"); h.app.confirm();
  assert.equal(h.app.screen, SCREEN.GAME);
  assert.equal(h.world.gen, 2); assert.ok(h.world.layout && h.world.layout.name);
  g.stop(); h.stop();
});

test("gen 1 is byte-identical: worlds (grid, foes, items, pact 0-15) hash as before #11 / #12", () => {
  let acc = "";
  const f = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); };
  for (let s = 0; s < 100; s++) for (let lv = 1; lv <= 8; lv++) for (let h = 0; h < 3; h++) {
    const w = createWorld(fmix(s * 7919 + 13), lv); w.heat = h; w.pact = s % 16; loadLevel(w, lv, false);
    acc = f(acc + Array.from(w.grid).join("") + JSON.stringify(w.enemies.map((e) => [e.type, e.tx, e.ty, e.cd])) + JSON.stringify(w.items.map((i) => [i.t, i.x, i.y, i.buried])) + (w.feat ?? "-") + (w.layout ?? "-") + w.gen);
  }
  assert.equal(acc, "90952829", "measured on 8fbc08d, before this change");
});
