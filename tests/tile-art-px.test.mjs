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
const room = (L, gen = 3) => { const w = createWorld(1, L); w.gen = gen; loadLevel(w, L); w.state = "PLAY"; return w; };
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
  const s = { kind: "BELT", h: 1, dir: 0, outer: ["N", "S"], phase: 4, gx: 1 };
  assert.equal(atlas.feat(2, s), atlas.feat(2, { ...s, phase: 5, gx: 9, par: 1 }));
  assert.notEqual(atlas.feat(2, s), atlas.feat(2, { ...s, phase: 6 }));
  assert.notEqual(atlas.feat(2, s), atlas.feat(2, { ...s, dir: 1 }));
  assert.notEqual(atlas.feat(2, s), atlas.feat(2, { ...s, h: 2 }));
});

test("rooms 1, 2, 3 and 5 of a gen-3 board paint the tile cell where world.feat is set", () => {
  for (const L of [1, 2, 3, 5]) {
    const w = room(L), bi = L - 1, cells = [];
    w.items.length = 0; w.enemies.length = 0; w.bombs.length = 0; w.players[0].alive = false;
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (w.feat && w.feat[y * C + x] && w.grid[y * C + x] === T.EMPTY) cells.push([x, y]);
    assert.ok(cells.length > 0, "room " + L + " has tiles");
    const { img } = draw(w), bare = room(L); bare.feat = null; bare.items.length = 0; bare.enemies.length = 0; bare.bombs.length = 0; bare.players[0].alive = false;
    const base = draw(bare).img;
    for (const [x, y] of cells) {
      if (x === 1 || y === 1 || x === C - 2 || y === R - 2) continue; /* frame B: the well shadow shades the cells beside the border */
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

import { floorPxCell, brickPal } from "../src/render/featpxcells.js";
import { pxRamp, rgbOf } from "../src/render/pixel/palette.js";
import { FLOOR_V } from "../src/render/floorart.js";
const lstar = (h) => { const l = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }, [r, g, b] = rgbOf(h).map(l), Y = 0.2126 * r + 0.7152 * g + 0.0722 * b; return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y; };
const slotHex = (b, s) => { const [f, st] = s.slice(5).split("."); return pxRamp(b[f])[st || "base"]; };

test("floor cells: per biome, 2 parities x FLOOR_V variants differ, each a lit-top-left / AO-bottom-right slab", () => {
  for (const b of BIOMES) for (const par of [0, 1]) {
    const seen = new Set();
    for (let v = 0; v < FLOOR_V; v++) {
      const c = floorPxCell(b.name, par, v);
      assert.deepEqual(validateCell(c, c.pal), [], b.name);
      seen.add(c.rows.join());
      assert.equal(c.rows[0][5], par ? "P" : "L", "lit top edge");
      assert.equal(c.rows[5][0], par ? "P" : "L", "lit left edge");
      assert.equal(c.rows[19][5], par ? "N" : "J", "AO bottom edge");
      assert.equal(c.rows[5][19], par ? "N" : "J", "AO right edge");
    }
    assert.equal(seen.size, FLOOR_V, b.name + " variants differ");
  }
});

test("cast shadow: a wall or brick shades the cell below and to its right by one solid step, brick deeper, never dither", () => {
  const f = (n, w, nw) => floorPxCell("JUNGLE", 0, 0, n, w, nw).rows;
  const plain = f(0, 0, 0), wallN = f(1, 0, 0), brickN = f(2, 0, 0), wallW = f(0, 1, 0), brickW = f(0, 2, 0), diag = f(0, 0, 1);
  assert.equal(wallN[0], "I".repeat(20)); assert.equal(wallN[1], "J".repeat(20)); assert.equal(wallN[2], "J".repeat(20)); assert.equal(wallN[3], plain[3]);
  assert.equal(brickN[1], "I".repeat(20)); assert.equal(brickN[3], "J".repeat(20)); assert.equal(brickN[4], plain[4]);
  assert.ok(wallW.every((r, y) => r[0] === "I" && r[1] === "J" && r[2] === "J" && r[3] === plain[y][3]));
  assert.ok(brickW.every((r) => r[0] === "I" && r[1] === "J") && brickW.every((r, y) => r[2] === plain[y][2]));
  assert.deepEqual([diag[0].slice(0, 2), diag[1].slice(0, 2)], ["IJ", "JJ"]);
  assert.equal(f(1, 1, 1).join(), floorPxCell("JUNGLE", 0, 0, 1, 1, 0).rows.join());
});

test("brick face drops 13-20 L* in every biome and keeps its hue family", () => {
  for (const b of BIOMES) {
    const P = brickPal(b.name), d = lstar(slotHex(b, P.b)) - lstar(b.brickA);
    assert.ok(d <= -13 && d >= -20, b.name + " " + d.toFixed(1));
    assert.ok(lstar(slotHex(b, P.B)) < lstar(slotHex(b, P.b)), b.name + " mortar darker than the face");
  }
});

test("contact shadows: every live pickup, bomb, foe and MAKO gets one 0.32-alpha blit; none when the board is empty", () => {
  const w = room(1); w.players[0].alive = true;
  const total = () => { const c = createRGBA(300, 260).getContext(); c.imageSmoothingEnabled = false; drawPixelWorld(c, w, createView(atlas)); return c.calls.filter((q) => q[0] === "drawImage" && q[4] === 0.32).length; };
  w.items.length = 0; w.enemies.length = 0; w.bombs.length = 0;
  assert.equal(total(), 1);
  w.items.push({ x: 100, y: 100, t: "fire", col: "#ff6b3d", taken: false, buried: false });
  w.bombs.push({ x: 140, y: 100, tx: 3, ty: 2, timer: 1, radius: 2, variant: "normal", dead: false });
  w.items.push({ x: 180, y: 100, t: "fire", col: "#ff6b3d", taken: true, buried: false });
  assert.equal(total(), 3);
});

test("CONVEYOR and STREAM animate on the PLAY clock: phase steps change the frame, a frozen clock does not", () => {
  const belt = (phase) => atlas.feat(2, { kind: "BELT", h: 1, dir: 0, outer: ["N", "S"], phase });
  assert.notEqual(belt(0), belt(2)); assert.equal(belt(0), belt(0)); assert.equal(belt(0), belt(10));
  const st = (ft) => atlas.feat(3, { kind: "STREAM", h: 1, dir: 0, outer: ["N", "S"] }, ft);
  assert.notEqual(st(0), st(0.2)); assert.equal(st(0.1), st(0.1)); assert.equal(st(0), st(2));
});
