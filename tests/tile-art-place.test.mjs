/* TILE ART PLACEMENT (2026-10-25): STREAM / QUICK / PORTAL / GATE are placed by the gen-2 generator for their look only; the sim ignores codes 8..14. */
import test from "node:test";
import assert from "node:assert/strict";
import { CFG, key, T } from "../src/core/config.js";
import { createWorld, loadLevel, step } from "../src/core/sim.js";
import { genBoard2, playFails, dists2, FEAT } from "../src/core/board2.js";
import { heatRoster } from "../src/core/heat.js";
import { HOME } from "../src/core/feat.js";
import { createDemobot } from "../src/app/demobot.js";

const C = CFG.COLS, R = CFG.ROWS;
const ROOMS = { 4: "STREAM", 6: "QUICK", 7: "PORTAL", 8: "GATE" };
const CODES = { STREAM: [8, 9, 10, 11], QUICK: [12], PORTAL: [13], GATE: [14] };
const cellsOf = (f) => { const o = []; for (let i = 0; i < f.length; i++) if (f[i]) o.push([i % C, (i / C) | 0, f[i]]); return o; };
const manh = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const mk = (seed, room, heat) => { const w = createWorld(seed, room); w.gen = 2; w.heat = heat; loadLevel(w, room, false); w.state = "PLAY"; return w; };

test("one table maps each biome to its tile", () => {
  assert.deepEqual([HOME.WATER, HOME.SAND, HOME.VOID, HOME.CROWN], ["STREAM", "QUICK", "PORTAL", "GATE"]);
});
test("200 seeds per room: tiles placed, same at every heat, never near spawn or a door, on floor, board still fair", () => {
  for (const room of [4, 6, 7, 8]) for (let s = 0; s < 200; s++) {
    const seed = 9000 + s, B = [0, 1, 2].map((h) => genBoard2(seed, room, h)), tag = `room ${room} seed ${seed}`;
    for (const b of B) assert.ok(b.feat && !b.layout.fallback, tag);
    const hx = B.map((b) => Buffer.from(b.feat).toString("hex") + "|" + (b.featPair ? Buffer.from(b.featPair).toString("hex") : "-"));
    assert.equal(hx[0], hx[1], tag); assert.equal(hx[1], hx[2], tag);
    for (let h = 0; h < 3; h++) assert.deepEqual(playFails(B[h].grid, room, h), [], tag + " heat " + h);
    const { b: walk } = dists2(B[2].grid);
    for (const [x, y, v] of cellsOf(B[0].feat)) {
      assert.ok(CODES[ROOMS[room]].includes(v), tag + " code " + v);
      assert.ok(walk[key(x, y)] > 4, tag + " near spawn");
      assert.ok(!(x === 5 && y === 1) && !(x === 1 && y === 5), tag + " on a door");
      for (const b of B) assert.equal(b.grid[key(x, y)], T.EMPTY, tag + " not on floor");
    }
  }
});
test("STREAM: 1-2 straight runs of 3-6, one direction each", () => {
  for (let s = 0; s < 200; s++) {
    const f = genBoard2(100 + s, 4, 0).feat, seen = new Set();
    let runs = 0;
    for (const [x, y, v] of cellsOf(f)) {
      if (seen.has(key(x, y))) continue;
      const [dx, dy] = v === 8 || v === 10 ? [1, 0] : [0, 1], cells = [];
      let px = x, py = y;
      while (f[key(px - dx, py - dy)] === v) { px -= dx; py -= dy; }
      while (f[key(px, py)] === v) { cells.push([px, py]); seen.add(key(px, py)); px += dx; py += dy; }
      assert.ok(cells.length >= 3 && cells.length <= 6, "len " + cells.length);
      for (const [a, b] of cells) for (const [ex, ey] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const q = f[key(a + ex, b + ey)]; if (q && !cells.some(([cx, cy]) => cx === a + ex && cy === b + ey)) assert.fail("runs touch"); }
      runs++;
    }
    assert.ok(runs >= 1 && runs <= 2, "runs " + runs);
  }
});
test("QUICK 3-5 spaced singles; GATE 2-3 corridor singles, lit 0; PORTAL pairs share an id 1/2 and sit far apart", () => {
  for (let s = 0; s < 200; s++) {
    const q = cellsOf(genBoard2(300 + s, 6, 1).feat);
    assert.ok(q.length >= 3 && q.length <= 5);
    for (let i = 0; i < q.length; i++) for (let j = i + 1; j < q.length; j++) assert.ok(manh(q[i], q[j]) >= 4);
    const w8 = mk(300 + s, 8, 1), g = cellsOf(w8.feat);
    assert.ok(g.length >= 2 && g.length <= 3);
    assert.ok(w8.featM.every((v) => v === 0));
    for (const [x, y] of g) { const o = (a, b) => w8.grid[key(a, b)] !== T.WALL; assert.ok((o(x - 1, y) && o(x + 1, y) && !o(x, y - 1) && !o(x, y + 1)) || (o(x, y - 1) && o(x, y + 1) && !o(x - 1, y) && !o(x + 1, y)), "corridor"); }
    const b7 = genBoard2(300 + s, 7, 2), p = cellsOf(b7.feat), ids = {};
    assert.ok(b7.featPair);
    for (const [x, y] of p) (ids[b7.featPair[key(x, y)]] ||= []).push([x, y]);
    const keys = Object.keys(ids).map(Number);
    assert.ok(keys.length >= 1 && keys.length <= 2 && keys.every((k) => k === 1 || k === 2));
    for (const k of keys) { assert.equal(ids[k].length, 2); assert.ok(manh(ids[k][0], ids[k][1]) >= 8); }
    for (let i = 0; i < b7.featPair.length; i++) if (b7.featPair[i]) assert.equal(b7.feat[i], 13);
  }
});
test("foes never start on an art tile and the roster is whole", () => {
  for (const room of [4, 6, 7, 8]) for (let s = 0; s < 40; s++) {
    const w = mk(7000 + s, room, s % 3);
    assert.equal(w.enemies.length, heatRoster(room, s % 3).length, `room ${room} seed ${s}`);
    for (const e of w.enemies) assert.equal(w.feat[key(e.tx, e.ty)], 0, `room ${room} seed ${s}`);
  }
});
test("the art layer is ignored by step(): a replay is identical with and without it", () => {
  for (const room of [4, 6, 7, 8]) for (const seed of [4242, 77]) {
    const a = mk(seed, room, 2), b = mk(seed, room, 2);
    assert.ok(a.feat);
    b.feat = null; b.featPair = null;
    const ba = createDemobot(9), bb = createDemobot(9), snap = (w) => JSON.stringify([w.state, w.players[0].x, w.players[0].y, w.players[0].alive, w.enemies.map((e) => [e.type, e.x, e.y, e.dead]), w.bombs.map((q) => [q.tx, q.ty]), w.items.length, w.score, Array.from(w.grid), w.events.length]);
    for (let i = 0; i < 1500; i++) {
      step(a, CFG.STEP, { 0: ba.intent(a) }); step(b, CFG.STEP, { 0: bb.intent(b) });
      if (i % 50 === 0) assert.equal(snap(a), snap(b), `room ${room} seed ${seed} step ${i}`);
      a.events.length = 0; b.events.length = 0;
    }
    assert.equal(snap(a), snap(b), `room ${room} seed ${seed} end`);
  }
});
test("gen 1 and FEAT off place nothing in these rooms", () => {
  for (const room of [4, 6, 7, 8]) { const w = createWorld(55, room); loadLevel(w, room, false); assert.equal(w.feat ?? null, null); }
  FEAT.on = false;
  try { for (const room of [4, 6, 7, 8]) assert.equal(genBoard2(55, room, 0).feat, null); } finally { FEAT.on = true; }
});
