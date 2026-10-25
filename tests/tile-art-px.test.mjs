/* TILE ART direction D, PIXEL wiring (2026-10-25): the floor tiles draw in the px look through atlas.feat, and a world without feat is untouched. */
import test from "node:test";
import assert from "node:assert/strict";
import { CFG, BIOMES, T } from "../src/core/config.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { cellSpec } from "../src/render/featdraw.js";
import { featPxCell } from "../src/render/featpx.js";
import { validateCell } from "../src/render/pixel/grid.js";
import { createAtlas } from "../src/render/pixel/atlas.js";
import { createView, drawPixelWorld } from "../src/render/pixel/world.js";
import { createRGBA, surfRGBA } from "../tools/pixel/rgba.mjs";

const atlas = createAtlas(surfRGBA);
const C = CFG.COLS, R = CFG.ROWS;
const room = (L, gen = 2) => { const w = createWorld(1, L); w.gen = gen; loadLevel(w, L); w.state = "PLAY"; return w; };
const draw = (w) => { const img = createRGBA(300, 260), c = img.getContext(); c.imageSmoothingEnabled = false; const V = createView(atlas); V.t = 0.5; const n = drawPixelWorld(c, w, V); return { img, n }; };
const patch = (img, x, y) => { const o = []; for (let j = 0; j < 20; j++) for (let i = 0; i < 20; i++) { const k = ((y * 20 + j) * img.width + x * 20 + i) * 4; o.push(img.data[k], img.data[k + 1], img.data[k + 2], img.data[k + 3]); } return o; };
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

test("every kind, heat and state bakes a valid opaque 20x20 cell for its own biome", () => {
  const PAIR = { GLIDE: "ICE", BELT: "FACTORY", PLATE: "ARENA", PORTAL: "VOID", GATE: "CROWN", BLOOM: "JUNGLE", STREAM: "WATER", QUICK: "SAND" };
  for (const [kind, bn] of Object.entries(PAIR)) {
    const bi = BIOMES.findIndex((b) => b.name === bn);
    for (let h = 0; h < 3; h++) for (const state of [0, 1, 2]) for (const dir of [0, 1, 2, 3]) {
      const s = { kind, h, dir, state, lit: state + 1, pair: 2, outer: ["N", "E", "S", "W"] };
      const cell = featPxCell(BIOMES[bi], s);
      assert.deepEqual(validateCell(cell, cell.pal), [], kind + h + state + dir);
      const f = atlas.feat(bi, s);
      assert.equal(f.w, 20); assert.equal(f.h, 20);
      for (let i = 3; i < f.im.data.length; i += 4) assert.equal(f.im.data[i], 255, kind + " has a transparent px");
    }
  }
});

test("the baked frame is cached by what the cell shows, not by phase or gx", () => {
  const s = { kind: "BELT", h: 1, dir: 0, outer: ["N", "S"], phase: 3, gx: 1 };
  assert.equal(atlas.feat(2, s), atlas.feat(2, { ...s, phase: 29, gx: 9, par: 1 }));
  assert.notEqual(atlas.feat(2, s), atlas.feat(2, { ...s, dir: 1 }));
  assert.notEqual(atlas.feat(2, s), atlas.feat(2, { ...s, h: 2 }));
});

test("rooms 1, 2, 3 and 5 of a gen-2 board paint the tile cell where world.feat is set", () => {
  for (const L of [1, 2, 3, 5]) {
    const w = room(L), bi = L - 1, cells = [];
    w.items.length = 0; w.enemies.length = 0; w.bombs.length = 0; w.players[0].alive = false;
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (w.feat && w.feat[y * C + x] && w.grid[y * C + x] === T.EMPTY) cells.push([x, y]);
    assert.ok(cells.length > 0, "room " + L + " has tiles");
    const { img } = draw(w), bare = room(L); bare.feat = null; bare.items.length = 0; bare.enemies.length = 0; bare.bombs.length = 0; bare.players[0].alive = false;
    const base = draw(bare).img;
    for (const [x, y] of cells) {
      const f = atlas.feat(bi, cellSpec(w, x, y));
      assert.ok(same(patch(img, x, y), Array.from(f.im.data)), "room " + L + " cell " + x + "," + y + " is the baked frame");
      assert.ok(!same(patch(img, x, y), patch(base, x, y)), "room " + L + " cell " + x + "," + y + " differs from the plain floor");
    }
  }
});

test("a world without feat, or with an all-zero feat, draws byte-identically to the plain board", () => {
  for (const L of [1, 4, 8]) {
    const a = room(L, 1), b = room(L, 1);
    assert.ok(!a.feat);
    b.feat = new Uint8Array(C * R);
    const A = draw(a), B = draw(b);
    assert.equal(A.n, B.n);
    assert.ok(same(Array.from(A.img.data), Array.from(B.img.data)));
  }
});

test("a feature tile replaces the floor blit (and its motif) and adds no draw call", () => {
  const w = room(1), bare = room(1); bare.feat = null;
  assert.ok(draw(w).n <= draw(bare).n);
});
