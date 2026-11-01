/* GATE (#26): the rule at every heat, the deferral, SHRINK, placement and V32 / V33, and the three looks' wall passes. */
import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, loadLevel, step } from "../src/core/sim.js";
import { CFG, T, key } from "../src/core/config.js";
import { F, FEAT_PROFILE } from "../src/core/feat.js";
import { genBoard2 } from "../src/core/board2.js";
import { featChecks, gateSplit, gateSpot } from "../src/core/featchecks.js";
import { gateBar, gateBusy, GATE_DEAD, GATE_SHUT } from "../src/core/tilegate.js";
import { PACT } from "../src/core/pact.js";
import { spawnEnemy } from "../src/core/entities.js";
import { cellSpec } from "../src/render/featdraw.js";
import { trackGrid, createView } from "../src/render/pixel/world.js";
import { featPxCell } from "../src/render/featpx.js";
import { BIOMES } from "../src/core/config.js";
import { countDrawCalls, buildScene } from "../src/render/three/scene.js";
import { createRenderer3D } from "../src/render/three/wrapper.js";
import { createDemobot } from "../src/app/demobot.js";

const TL = CFG.TILE, C = CFG.COLS;
const fmix = (h) => { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
function room(heat, seed = 4242, pact = 0) {
  const w = createWorld(seed, 8);
  w.gen = 3; w.heat = heat; w.pact = pact;
  loadLevel(w, 8, false);
  /* one parked foe keeps the room from being won */
  w.state = "PLAY"; w.enemies = [spawnEnemy("stationary", 13.5 * TL, 11.5 * TL, 8, w.rng)]; w.items = [];
  w.players[0].iFrames = 1e9;
  return w;
}
const gatesOf = (w) => [...w.feat.keys()].filter((k) => w.feat[k] === F.GATE);
const run = (w, t) => { for (let i = Math.round(t / CFG.STEP); i > 0; i--) { step(w, CFG.STEP, { 0: { move: { x: 0, y: 0 } } }); w.events.length = 0; } };
const to = (w, t) => run(w, t - w.featT);
const put = (e, k) => { e.x = ((k % C) + 0.5) * TL; e.y = (((k / C) | 0) + 0.5) * TL; e.tx = k % C; e.ty = (k / C) | 0; };

for (const [h, open, warn, shut] of [[1, 6, 1, 3], [2, 4, 0.75, 4]]) test(`${["", "PLUS", "MAX"][h]}: every gate runs one room clock, ${open} open with a passable ${warn} s warning, ${shut} shut`, () => {
  const w = room(h), gs = gatesOf(w);
  assert.ok(gs.length >= 2);
  to(w, open - warn - 0.1);
  for (const k of gs) { assert.equal(w.featM[k], 0); assert.equal(w.grid[k], T.EMPTY); }
  to(w, open - warn + 0.05);
  for (const k of gs) { assert.ok(w.featM[k] >= 1 && w.featM[k] <= 3, "warning"); assert.equal(w.grid[k], T.EMPTY, "warning stays passable"); }
  to(w, open - 0.45);
  for (const k of gs) assert.equal(w.featM[k], 3, "the last step holds >= 0.5 s");
  to(w, open + 0.05);
  for (const k of gs) { assert.equal(w.featM[k], GATE_SHUT); assert.equal(w.grid[k], T.WALL); }
  to(w, open + shut - 0.05);
  for (const k of gs) assert.equal(w.grid[k], T.WALL);
  to(w, open + shut + 0.05);
  for (const k of gs) { assert.equal(w.featM[k], 0); assert.equal(w.grid[k], T.EMPTY); }
});

test("CORE: only your crossing arms it; it shuts 3 s after you leave, for 3 s, then waits for the next crossing", () => {
  const w = room(0), k = gatesOf(w)[0], p = w.players[0];
  run(w, 8);
  assert.equal(w.grid[k], T.EMPTY, "idle: no clock");
  const foe = spawnEnemy("stationary", 0, 0, 8, w.rng);
  put(foe, k); w.enemies.push(foe);
  run(w, 1); w.enemies.pop();
  run(w, 5);
  assert.equal(w.grid[k], T.EMPTY, "a foe never triggers it");
  put(p, k);
  run(w, 2);
  assert.equal(w.grid[k], T.EMPTY, "standing on it holds the timer");
  put(p, key(1, 1));
  run(w, 2.4);
  assert.equal(w.featM[k], 0);
  run(w, 0.3);
  assert.equal(w.featM[k], 3, "warning, 0.5 s before the shut");
  assert.equal(w.grid[k], T.EMPTY);
  run(w, 0.4);
  assert.equal(w.grid[k], T.WALL);
  run(w, 2.8);
  assert.equal(w.grid[k], T.WALL);
  run(w, 0.3);
  assert.equal(w.grid[k], T.EMPTY, "reopens");
  assert.equal(w.featM[k], 0);
  run(w, 8);
  assert.equal(w.grid[k], T.EMPTY, "stays open until crossed again");
});

test("occupied: a shut waits, lands the moment the tile clears, and skips with under 0.5 s left", () => {
  const w = room(1), k = gatesOf(w)[0], other = gatesOf(w)[1], b = { x: 0, y: 0, tx: 0, ty: 0, timer: 1e6, radius: 1, dead: false, variant: "normal" };
  put(b, k); w.bombs.push(b);
  to(w, 6.5);
  assert.equal(w.grid[other], T.WALL, "the others shut on time");
  assert.equal(w.grid[k], T.EMPTY); assert.equal(w.featM[k], 3);
  w.bombs.length = 0;
  run(w, CFG.STEP);
  assert.equal(w.grid[k], T.WALL, "shuts the moment it clears");
  assert.equal(w.featM[k], GATE_SHUT);
  to(w, 9.1);
  assert.equal(w.grid[k], T.EMPTY);
  w.bombs.push(b);
  to(w, 15 + 2.7);
  w.bombs.length = 0;
  run(w, CFG.STEP * 2);
  assert.equal(w.grid[k], T.EMPTY, "0.3 s left: this shut is skipped");
  assert.equal(w.featM[k], 0);
});

test("anything overlapping counts: a player's edge, a foe, a blade, an item", () => {
  const w = room(1), k = gatesOf(w)[0], x = k % C, y = (k / C) | 0, p = w.players[0];
  put(p, key(1, 1));
  assert.equal(gateBusy(w, x, y), false);
  p.x = (x - 0.5) * TL + 12; p.y = (y + 0.5) * TL;
  assert.equal(gateBusy(w, x, y), p.r > TL / 2 - 12, "the footprint decides");
  p.x = x * TL - p.r + 1;
  assert.equal(gateBusy(w, x, y), true, "a player with an edge over the tile");
  put(p, key(1, 1));
  w.blades.push({ tiles: [{ tx: x, ty: y }], t: 0, ttl: 9 });
  assert.equal(gateBusy(w, x, y), true);
  w.blades.length = 0;
  w.items.push({ tx: x, ty: y, x: (x + 0.5) * TL, y: (y + 0.5) * TL });
  assert.equal(gateBusy(w, x, y), true);
});

test("a shut gate stops walkers and blasts like any WALL (cover), and the tile hides nothing when it opens", () => {
  const w = room(2), k = gatesOf(w)[0];
  to(w, 4.1);
  assert.equal(w.grid[k], T.WALL);
  assert.equal(gateBar(w, k), true, "drawn by its bars, not a wall pass");
});

test("SHRINK: a gate on a ring tile is dead, never reopens, never erases the ring; a live one still runs", () => {
  const w = room(1, 4242, PACT.SHRINK), gs = gatesOf(w), rimOf = (k) => { const x = k % C, y = (k / C) | 0; return Math.min(x, C - 1 - x, y, 12 - y); };
  const top = Math.max(...gs.map(rimOf)), inner = gs.find((k) => rimOf(k) === top), outer = gs.find((k) => rimOf(k) < top);
  w.shrinkT = 1e9;
  to(w, 6.1);
  if (outer !== undefined) {
    assert.equal(w.grid[outer], T.WALL);
    w.shrinkGen = rimOf(outer);
    w.grid[outer] = T.WALL;
    run(w, CFG.STEP);
    assert.equal(w.featM[outer], GATE_DEAD);
    assert.equal(gateBar(w, outer), false, "a real wall again");
    to(w, 30);
    assert.equal(w.grid[outer], T.WALL, "a ring outlives the clock");
  }
  assert.ok(w.featM[inner] !== GATE_DEAD);
});

test("placement: 150 seeds, the same layer at every heat, >= 2 gates, V32 and V33 at 0 and a load under the bar", () => {
  let three = 0, fails = [];
  const t0 = performance.now();
  for (let s = 0; s < 150; s++) {
    const seed = fmix(s * 7919 + 13), ws = [0, 1, 2].map((h) => genBoard2(seed, 8, h, { feat: true }));
    assert.ok(ws[0].feat, "seed " + s + " keeps its gates");
    for (const b of ws) assert.deepEqual([...b.feat], [...ws[0].feat]);
    const n = ws[0].feat.filter((v) => v === F.GATE).length;
    assert.ok(n >= 2 && n <= 3);
    if (n === 3) three++;
    ws.forEach((b, h) => fails.push(...featChecks({ grid: b.grid, feat: b.feat, level: 8, heat: h, gen: 3, items: [], enemies: [] }, FEAT_PROFILE[h], { only: ["V32", "V33"] })));
  }
  assert.deepEqual(fails, []);
  assert.ok(three > 100, "three gates on most boards: " + three);
  assert.ok((performance.now() - t0) / (150 * 3) < 50, "a room load adds under 50 ms");
});

test("V32 / V33 bite: a gate on the only bridge splits the map; shut gates that fence a dead end leave a spot", () => {
  const mk = () => { const g = new Int8Array(C * 13).fill(T.WALL); for (let y = 1; y < 12; y++) for (let x = 1; x < C - 1; x++) g[key(x, y)] = T.EMPTY; return g; };
  const g = mk();
  for (let y = 1; y < 12; y++) if (y !== 6) g[key(7, y)] = T.WALL;
  assert.equal(gateSplit(g, [key(7, 6)]), -1, "a bridge");
  assert.equal(gateSplit(mk(), [key(7, 6)]), 0, "an open field");
  const d = new Int8Array(C * 13).fill(T.WALL);
  for (let x = 1; x < 12; x++) d[key(x, 1)] = T.EMPTY;
  for (let y = 1; y < 12; y++) d[key(11, y)] = T.EMPTY;
  for (let y = 1; y < 12; y++) d[key(13, y)] = T.EMPTY;
  d[key(12, 11)] = T.EMPTY;
  d[key(9, 2)] = T.EMPTY; d[key(9, 3)] = T.EMPTY;
  const spot = gateSpot({ grid: d, level: 8, heat: 2 }, FEAT_PROFILE[2], [key(9, 2)]);
  assert.ok(spot, "the side pocket behind the gate was the only hide");
});

test("the looks: a shut gate is drawn by its bars and a ring-dead one by the wall pass; no SLAM for a bar, one for a ring", () => {
  const w = room(1), k = gatesOf(w)[0], x = k % C, y = (k / C) | 0;
  assert.equal(cellSpec(w, x, y).lit, 0);
  to(w, 6.1);
  assert.equal(cellSpec(w, x, y).lit, GATE_SHUT);
  const V = createView({}), shots = [];
  V.shots = { push: (...a) => shots.push(a), pool: [] };
  const w2 = room(1);
  trackGrid(V, w2);
  to(w2, 6.1);
  trackGrid(V, w2);
  assert.equal(shots.length, 0, "a bar closing is no SHRINK slam");
  const q = gatesOf(w2)[0];
  w2.featM[q] = GATE_DEAD; w2.grid[q] = T.EMPTY;
  trackGrid(V, w2);
  w2.grid[q] = T.WALL;
  trackGrid(V, w2);
  assert.equal(shots.length, 1, "a ring on a dead gate slams");
});

test("the heat tell: the open PIXEL cell carries 1 / 2 / 3 posts a jamb, the shut cell none", () => {
  const b = BIOMES.find((v) => v.name === "CROWN");
  const posts = (rows) => rows.filter((r) => r[2] === "X").length;
  [1, 2, 3].forEach((n, h) => assert.equal(posts(featPxCell(b, { kind: "GATE", h, lit: 0, outer: ["N", "E", "S", "W"] }).rows), n));
  [0, 1, 2].forEach((h) => assert.equal(posts(featPxCell(b, { kind: "GATE", h, lit: 4, outer: ["N", "E", "S", "W"] }).rows), 0));
});

test("REAL 3D: one more draw in a gate room, gate tiles never in the wall mesh until a ring kills them; bars stay at or under NEAR_H", async () => {
  const w = room(1), gs = gatesOf(w);
  w.feat = Uint8Array.from(w.feat);
  const sc = buildScene(w, null, 1), noGate = room(1);
  noGate.feat = noGate.feat.map((v) => (v === F.GATE ? 0 : v));
  const base = countDrawCalls(buildScene(noGate, null, 1).group);
  assert.equal(countDrawCalls(sc.group) - base, 1, "one InstancedMesh");
  const wall = sc.group.children.find((o) => o.userData.tag === "wall"), bars = sc.group.children.find((o) => o.userData.tag === "gatebars");
  const w0 = wall.count, v0 = sc.brickV;
  to(w, 6.1);
  sc.update(w);
  assert.equal(wall.count, w0, "a shut gate is not a wall");
  assert.ok(sc.brickV > v0, "the shadow map re-renders");
  let top = 0;
  for (let i = 0; i < bars.count; i++) { const a = bars.instanceMatrix.array, sy = a[i * 16 + 5], py = a[i * 16 + 13]; top = Math.max(top, py + sy / 2); }
  assert.ok(top <= 22 + 1e-6 && top > 9, "bars up: top " + top);
  w.featM[gs[0]] = GATE_DEAD;
  sc.update(w);
  assert.equal(wall.count, w0 + 1, "a ring-dead gate joins the wall mesh");
});

test("REAL 3D fat-world in a gate room: 158 draws (156 + the tile mesh + the bars), 159 racing a ghost, inside the 160 lane", () => {
  const fat = () => {
    const w = room(1);
    w.enemies = []; w.items = [];
    for (let i = 0; i < 16; i++) { const e = spawnEnemy("walker", 60 + i * 30, 80, 8, w.rng); w.enemies.push(e); }
    for (let i = 0; i < 32; i++) w.items.push({ x: 60 + i * 15, y: 120, t: "fire", col: "#ff8a3c", taken: false, pdef: null });
    for (let i = 0; i < Math.min(CFG.MAX_BOMBS, 8); i++) w.bombs.push({ x: 60 + i * 40, y: 160, tx: i, ty: 2, timer: CFG.FUSE, variant: "normal" });
    w.blades = [{ x: 200, y: 120, tiles: [{ tx: 5, ty: 3 }], t: 0, ttl: CFG.BLADE_TTL }];
    return w;
  };
  const r = createRenderer3D(null, null, { audio: null, hud: null });
  r.render(fat(), 1 / 60);
  assert.equal(countDrawCalls(r._dbg.scene), 158);
  const r2 = createRenderer3D(null, null, { audio: null, hud: null });
  r2.render(fat(), 1 / 60, { ghost: { x: 100, y: 100, fx: 1, fy: 0, t: 0 } });
  assert.equal(countDrawCalls(r2._dbg.scene), 159);
});

test("never crushes: over real bot runs at every heat no walker sits in a shut bar (the collision radius) and no bomb on one", () => {
  let shutTicks = 0;
  for (const heat of [0, 1, 2]) for (const seed of [11, 4242, 90210]) {
    const w = createWorld(seed, 8), bot = createDemobot(seed);
    w.gen = 3; w.heat = heat; loadLevel(w, 8, false); w.state = "PLAY";
    const gs = gatesOf(w);
    for (let i = 0; i < 3600 && w.state === "PLAY"; i++) {
      step(w, CFG.STEP, { 0: bot.intent(w) }); w.events.length = 0;
      for (const k of gs) {
        if (w.featM[k] !== GATE_SHUT) { if (w.featM[k] !== GATE_DEAD) assert.equal(w.grid[k], T.EMPTY); continue; }
        shutTicks++;
        assert.equal(w.grid[k], T.WALL);
        const x = k % C, y = (k / C) | 0, deep = (e) => { const dx = e.x - Math.max(x * TL, Math.min(e.x, (x + 1) * TL)), dy = e.y - Math.max(y * TL, Math.min(e.y, (y + 1) * TL)), r = e.r * 0.9; return dx * dx + dy * dy < r * r * 0.99; };
        for (const e of [...w.players, ...w.enemies]) if (!e.dead && e.alive !== false) assert.equal(deep(e), false, `${e.type || "player"} in a bar: seed ${seed} heat ${heat} tick ${i}`);
        for (const b of w.bombs) assert.ok(b.dead || b.tx !== x || b.ty !== y, "a bomb in a bar");
      }
    }
  }
  assert.ok(shutTicks > 500, "the gates did shut: " + shutTicks);
});

test("gen 1 and gen 2 carry no gate state", () => {
  for (const gen of [1, 2]) {
    const w = createWorld(7, 8); w.gen = gen; w.heat = 2; loadLevel(w, 8, false);
    assert.ok(!w.feat);
    assert.equal(gateBar(w, key(3, 3)), false);
  }
});

test("under SHRINK a shut gate never closes the only way out: V33 checks every ring", () => {
  for (const seed of [5464155, 5432479]) for (const heat of [0, 1, 2]) {
    const w = createWorld(seed, 8);
    w.gen = 3; w.heat = heat; loadLevel(w, 8, false);
    assert.ok(w.feat, "the board keeps its gates");
    const gs = [];
    for (let k = 0; k < w.feat.length; k++) if (w.feat[k] === F.GATE) gs.push(k);
    assert.equal(gateSpot({ grid: w.grid, level: 8, heat }, FEAT_PROFILE[heat], gs), null, "seed " + seed + " heat " + heat);
  }
});
