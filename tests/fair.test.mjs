/* #11: the board fairness validator (src/core/fair.js). Every rule has a
   hand-made passing grid and a failing one; the gen-1 diagnostic pins today's
   measured rates as GOLDEN numbers (report-only: they fail only if gen 1
   changes, never as a gate on gen 1). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { CFG, T, key, EW_WALL_H_MAX } from "../src/core/config.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { genBoard } from "../src/core/board.js";
import { FOES, spawnEnemy } from "../src/core/entities.js";
import { RULES, HUNT, PASSER, validateBoard, walk, openLane, sealed, stampStart, placeFoes, freeTiles } from "../src/core/fair.js";
import { NEAR_H } from "../src/render/three/scene.js";

const C = CFG.COLS;
export const fmix = (h) => { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
const BASE = [
  "###############",
  "#....bbbbb....#",
  "#.#.#b#b#b#.#.#",
  "#..bbbbbbbbb..#",
  "#.#b#b#b#b#b#.#",
  "#bb.........bb#",
  "#b#.#.#.#.#.#b#",
  "#bb.........bb#",
  "#.#b#b#b#b#b#.#",
  "#..bbbbbbbbb..#",
  "#.#.#b#b#b#.#.#",
  "#....bbbbb....#",
  "###############",
];
const grid = (rows) => Int8Array.from(rows.join(""), (c) => (c === "#" ? T.WALL : c === "b" ? T.BRICK : T.EMPTY));
const edit = (pairs, rows = BASE) => { const g = grid(rows); for (const [x, y, v] of pairs) g[key(x, y)] = v; return g; };
const OPT = { sym: "h", flip: 2 };
const fails = (g, lv, h, o = OPT) => validateBoard(g, lv, h, o);

test("the base fixture passes every rule in rooms 1 / 2 / 5 / 8 at every heat", () => {
  for (const lv of [1, 2, 5, 8]) for (const h of [0, 1, 2]) assert.deepEqual(fails(grid(BASE), lv, h), [], `room ${lv} heat ${h}`);
});
test("pure and deterministic: same input, same output; the grid is never written", () => {
  const g = edit([[3, 3, T.EMPTY], [3, 5, T.WALL]]), copy = g.slice();
  const a = validateBoard(g, 8, 2, { ...OPT, foes: [{ type: "fast", tx: 3, ty: 5 }] }), b = validateBoard(g, 8, 2, { ...OPT, foes: [{ type: "fast", tx: 3, ty: 5 }] });
  assert.deepEqual(a, b);
  assert.deepEqual(Array.from(g), Array.from(copy));
  assert.ok(a.every((r) => RULES.includes(r)));
  assert.deepEqual(a, RULES.filter((r) => a.includes(r)), "RULES order");
});
test("no Math.random / Date anywhere in src/core (grep)", () => {
  for (const f of readdirSync(new URL("../src/core/", import.meta.url))) {
    const s = readFileSync(new URL("../src/core/" + f, import.meta.url), "utf8");
    assert.ok(!/Math\.random\(|Date\.now\(|new Date\(/.test(s), f);
  }
});
test("V1 reach: a tile walled off fails", () => {
  assert.ok(fails(edit([[12, 11, T.WALL], [13, 10, T.WALL]]), 1, 0).includes("V1"));
});
test("V2 safe first bomb: no EMPTY escape outside the blast within 4 steps fails", () => {
  const g = edit([[1, 2, T.BRICK], [1, 3, T.BRICK], [1, 4, T.BRICK], [2, 3, T.BRICK], [3, 2, T.BRICK]]);
  assert.ok(fails(g, 1, 0, {}).includes("V2"));
  assert.ok(!fails(grid(BASE), 1, 0, {}).includes("V2"));
});
test("V3 room fit: a board too full of bricks to hold the roster plus floor items fails", () => {
  const rows = BASE.map((r, y) => (y >= 5 ? r.replace(/\./g, "b") : r));
  assert.ok(fails(grid(rows), 8, 0).includes("V3"));
});
test("V4 foe distance: >= 10 walking steps (hunters and brick-passers >= 12), bricks passable; no route passes", () => {
  const b = walk(grid(BASE));
  const at = (d) => { for (let i = 0; i < b.length; i++) if (b[i] === d && grid(BASE)[i] === T.EMPTY) return { tx: i % C, ty: (i / C) | 0 }; };
  const g = grid(BASE);
  assert.ok(fails(g, 3, 0, { foes: [{ type: "walker", ...at(9) }] }).includes("V4"));
  assert.deepEqual(fails(g, 3, 0, { foes: [{ type: "walker", ...at(10) }] }), []);
  assert.ok(fails(g, 3, 0, { foes: [{ type: "chaser", ...at(11) }] }).includes("V4"));
  assert.ok(fails(g, 3, 0, { foes: [{ type: "shade", ...at(11) }] }).includes("V4"));
  assert.deepEqual(fails(g, 3, 0, { foes: [{ type: "knight", ...at(12) }, { type: "shade", ...at(12) }, { type: "burrow", ...at(10) }] }), []);
  const walled = edit([[12, 11, T.WALL], [13, 10, T.WALL]]);
  assert.ok(!fails(walled, 3, 0, { foes: [{ type: "fast", tx: 13, ty: 11 }] }).includes("V4"), "a tile with no route passes");
});
test("HUNT and PASSER match the sim's own e.hunt and e.pass flags for every foe type; BURROW is not a brick-passer", () => {
  for (const f of FOES) assert.equal(HUNT.includes(f.type), spawnEnemy(f.type, 3, 3, 1, null).hunt, f.type);
  for (const f of FOES) assert.equal(PASSER.includes(f.type), spawnEnemy(f.type, 3, 3, 1, null).pass, f.type);
  assert.equal(spawnEnemy("burrow", 3, 3, 1, null).pass, false);
});
test("V5 bricks: 40-90 and >= 3 per buried item", () => {
  const full = grid(BASE.map((r) => r.replace(/\./g, "b"))), g = stampStart(full.slice());
  assert.ok(fails(g, 1, 0).includes("V5"), "over 90");
  const thin = grid(BASE.map((r, y) => (y >= 3 && y <= 9 ? r.replace(/b/g, ".") : r)));
  assert.ok(fails(thin, 1, 0).includes("V5"), "under 40");
});
test("V6 room 1 guarantees FLAME and BOMB", () => {
  const g = grid(BASE), it = (t) => ({ t, buried: true });
  assert.ok(fails(g, 1, 0, { items: [it("fire"), it("speed")] }).includes("V6"));
  assert.deepEqual(fails(g, 1, 0, { items: [it("fire"), it("bomb")] }), []);
  assert.deepEqual(fails(g, 2, 0, { items: [it("speed")] }), [], "rooms 2+ do not need them");
});
test("V7 SHRINK: a wall line that splits the board once ring 2 closes fails", () => {
  const g = edit([[6, 3, T.WALL], [6, 5, T.WALL], [6, 7, T.WALL], [6, 9, T.WALL]]);
  assert.ok(fails(g, 1, 0, {}).includes("V7"));
  assert.ok(!fails(g, 1, 0, {}).includes("V1"), "connected before the shrink");
});
test("V8 dead ends: a corridor deeper than 3 fails; more than 4 dead ends fail", () => {
  assert.ok(fails(edit([[12, 11, T.WALL], [12, 9, T.WALL]]), 1, 0, {}).includes("V8"));
  assert.ok(!fails(edit([[12, 11, T.WALL]]), 1, 0, {}).includes("V8"), "one shallow dead end passes");
  const five = edit([[12, 11, T.WALL], [2, 11, T.WALL], [12, 1, T.WALL], [10, 11, T.WALL], [4, 11, T.WALL], [10, 1, T.WALL]]);
  assert.ok(fails(five, 1, 0, {}).includes("V8"));
});
test("V9 wall slots: a WALL on (odd, odd) fails", () => {
  assert.ok(fails(edit([[3, 5, T.WALL]]), 1, 0, {}).includes("V9"));
  assert.ok(!fails(edit([[4, 5, T.WALL]]), 1, 0, {}).includes("V9"), "(even, odd) is a lane slot");
});
test("V10 tall E-W walls: an (odd, even) wall in a > 22 biome fails unless that biome is capped", () => {
  const g = edit([[5, 6, T.WALL]]);
  assert.ok(fails(g, 2, 0, {}).includes("V10"), "ICE 36");
  assert.ok(!fails(g, 2, 0, { capped: ["ICE"] }).includes("V10"));
  assert.ok(fails(g, 8, 0, {}).includes("V10"), "CROWN 24");
  assert.ok(!fails(g, 8, 0, { capped: ["CROWN"] }).includes("V10"));
  assert.ok(!fails(g, 1, 0, {}).includes("V10"), "JUNGLE 22 is legal at full height");
  assert.ok(!fails(edit([[6, 5, T.WALL]]), 2, 0, {}).includes("V10"), "N-S joins are never V10");
});
test("EW_WALL_H_MAX === NEAR_H (core may not import render; this test ties them)", () => {
  assert.equal(EW_WALL_H_MAX, NEAR_H);
  assert.equal(EW_WALL_H_MAX, 22);
});
test("V11 re-roll budget: attempts past 8 fail; a fallback must be the fair one (sealed), never the raw gen-1 board", () => {
  const g = grid(BASE);
  assert.ok(fails(g, 1, 0, { tries: [8, 0] }).includes("V11"));
  assert.ok(fails(g, 1, 0, { tries: [0, 8] }).includes("V11"));
  assert.deepEqual(fails(g, 1, 0, { tries: [7, 7] }), []);
  let raw = null;
  for (let s = 1; !raw; s++) { const r = genBoard(s, 1, 0.32); if (!sealed(r)) raw = r; }
  assert.ok(validateBoard(raw, 1, 0, { fallback: true }).includes("V11"));
  assert.ok(!validateBoard(stampStart(raw.slice()), 1, 0, { fallback: true }).includes("V11"));
});
test("V12 finale mirroring: an off-orbit fill tile fails; CROWN's throne must sit opposite the spawn", () => {
  assert.ok(fails(edit([[5, 7, T.BRICK]]), 5, 0).includes("V12"));
  assert.ok(!fails(edit([[5, 7, T.BRICK], [9, 7, T.BRICK]]), 5, 0).includes("V12"));
  assert.ok(!fails(edit([[5, 7, T.BRICK]]), 4, 0).includes("V12"), "rooms that are not a finale are free");
  assert.ok(fails(grid(BASE), 8, 0, { sym: "h", flip: 0 }).includes("V12"));
  assert.ok(fails(grid(BASE), 8, 0, { sym: "h", flip: 1 }).includes("V12"));
  assert.ok(!fails(grid(BASE), 8, 0, { sym: "h", flip: 3 }).includes("V12"));
  assert.ok(!fails(edit([[5, 7, T.BRICK]]), 5, 0, { sym: "h", ignore: [key(5, 7)] }).includes("V12"), "a gen-3 forced tile is ignored");
});
test("SEAL: an EMPTY pocket exit fails; a door or ruined pillar must be BRICK", () => {
  assert.ok(fails(edit([[3, 3, T.EMPTY]]), 1, 0).includes("SEAL"));
  assert.ok(fails(edit([[5, 1, T.EMPTY]]), 1, 0).includes("SEAL"));
  assert.ok(fails(edit([[2, 2, T.EMPTY]]), 1, 0).includes("SEAL"), "a ruined pillar in the pocket");
  assert.ok(fails(edit([[4, 2, T.EMPTY]]), 1, 0).includes("SEAL"), "a ruined pillar beside the pocket");
  assert.ok(!fails(edit([[4, 2, T.BRICK]]), 1, 0).includes("SEAL"));
  assert.ok(fails(edit([[2, 1, T.BRICK]]), 1, 0).includes("SEAL"), "the pocket itself is EMPTY");
});
test("placeFoes: roster order, first unused tile at the walking floor, picks first then the rest", () => {
  const g = grid(BASE), d = walk(g), free = freeTiles(g), roster = ["walker", "fast", "knight", "stationary"];
  const { pick, rest } = placeFoes(free, roster, d);
  assert.equal(pick.length, roster.length);
  assert.equal(pick.length + rest.length, free.length);
  pick.forEach(([t, [x, y]]) => assert.ok(d[key(x, y)] >= (HUNT.includes(t) || PASSER.includes(t) ? 12 : 10), t));
  assert.deepEqual(placeFoes(free, roster, d, () => true).pick, [], "a blocked tile is never picked");
});

/* gen-1 diagnostic (report-only GOLDEN numbers; gen 1 must stay byte-identical).
   Seeds fmix(s*7919+13); CI sample 200 seeds x 8 rooms x 3 heats. The full
   1000-seed sweep (tools/levels/fairsweep.mjs) reproduces the issue's
   16.9 / 13.3 / 10.0 % exactly and measures 368 / 48 000 hunter starts under
   8 EMPTY steps (the issue's 371 used a definition not on record). */
test("gen-1 diagnostic: open 5-step lanes, hunters under 8 walking steps, validator failures", () => {
  const lanes = [0, 0, 0], f = {};
  let hunters = 0, near = 0;
  for (let s = 0; s < 200; s++) for (let lv = 1; lv <= 8; lv++) for (let h = 0; h < 3; h++) {
    const w = createWorld(fmix(s * 7919 + 13), lv); w.heat = h; loadLevel(w, lv, false);
    if (openLane(w.grid)) lanes[h]++;
    const e = walk(w.grid, false);
    for (const en of w.enemies) if (en.hunt) { hunters++; const v = e[key(en.tx, en.ty)]; if (v >= 0 && v < 8) near++; }
    for (const r of validateBoard(w.grid, lv, h, { foes: w.enemies, items: w.items })) f[r] = (f[r] || 0) + 1;
  }
  console.log(`gen-1 open lanes ${lanes.map((v) => (v / 16).toFixed(1) + "%").join(" / ")}; hunters < 8 steps ${near} / ${hunters}; fails ${JSON.stringify(f)}`);
  assert.deepEqual(lanes, [267, 222, 175]);
  assert.deepEqual([near, hunters], [66, 9600]);
  assert.deepEqual(f, { V4: 4372, SEAL: 1294, V3: 7 });
});
