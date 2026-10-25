// PIXEL foe surface detail: CHASER, BURROW, BOOMERANG, ROCKET and FAST were thin next to
// WALKER / SENTRY / KNIGHT / SHADE. An interior tone edge is two opaque non-outline
// neighbours that differ in palette slot; the floors below are set under the shipped
// art and above the old art. Eye chars (e/E) must survive, because blinkOf and shine
// read them; the foot line (last opaque row) must not move; spec (w) is knight's alone.
import test from "node:test";
import assert from "node:assert/strict";
import { SHEET } from "../src/render/pixel/art/foes.js";
import { validateCell } from "../src/render/pixel/grid.js";
import { blinkOf } from "../src/render/pixel/foegen.js";

const cell = (n) => ({ ...SHEET.cells[n], pal: SHEET.pal });
const edges = (c) => {
  let n = 0;
  const at = (x, y) => (c.rows[y] && c.rows[y][x]) || ".";
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const a = at(x, y);
    if (a === "." || a === "o") continue;
    for (const [dx, dy] of [[1, 0], [0, 1]]) { const b = at(x + dx, y + dy); if (b !== "." && b !== "o" && b !== a) n++; }
  }
  return n;
};
const foot = (c) => { let b = c.rows.length - 1; while (b > 0 && !/[^.]/.test(c.rows[b])) b--; return b; };

const FLOOR = {
  "chaser.front0": 66, "chaser.back0": 70, "chaser.side0": 60,
  "burrow.front0": 46, "burrow.back0": 38, "burrow.side0": 44,
  "boomerang.spin0": 74,
  "rocket.up0": 58, "rocket.down0": 58, "rocket.side0": 34,
  "fast.front0": 38, "fast.back0": 34, "fast.side0": 21,
};
const FOOT = {
  "chaser.front0": 17, "chaser.back0": 17, "chaser.side0": 17, "burrow.front0": 17, "burrow.back0": 16, "burrow.side0": 17,
  "boomerang.spin0": 18, "rocket.up0": 17, "rocket.down0": 17, "rocket.side0": 15, "fast.front0": 13, "fast.back0": 13, "fast.side0": 13,
};
const EYED = ["chaser.front0", "chaser.front1", "chaser.side0", "chaser.side1", "burrow.front0", "burrow.front1", "burrow.side0", "burrow.side1",
  "boomerang.spin0", "boomerang.spin1", "rocket.up0", "rocket.up1", "rocket.down0", "rocket.side0", "rocket.side1", "fast.front0", "fast.front1", "fast.side0", "fast.side1"];

test("the five foes keep every cell valid and spec-free", () => {
  for (const n of Object.keys(SHEET.cells).filter((k) => /^(chaser|burrow|boomerang|rocket|fast)\./.test(k))) {
    const c = cell(n);
    assert.deepEqual(validateCell(c, SHEET.pal), [], n);
    assert.equal(c.w, 20, n + " width");
    assert.ok(!c.rows.some((r) => r.includes("w")), n + " uses spec");
  }
});

test("interior tone edges clear the detail floor", () => {
  for (const [n, min] of Object.entries(FLOOR)) assert.ok(edges(cell(n)) >= min, n + " " + edges(cell(n)) + " < " + min);
});

test("the foot line did not move", () => {
  for (const [n, f] of Object.entries(FOOT)) assert.equal(foot(cell(n)), f, n);
});

test("eyes stay on e/E so shine and the blink twin still work", () => {
  for (const n of EYED) { const c = cell(n); assert.ok(c.rows.some((r) => /[eE]/.test(r)), n + " lost its eye"); assert.ok(blinkOf(c, "k"), n + " has no blink twin"); }
  for (const n of ["chaser.stunned", "burrow.stunned", "boomerang.stunned", "rocket.stunned"]) assert.ok(!cell(n).rows.some((r) => /[eE]/.test(r)), n + " should not show an eye");
});
