/* TILE ART direction D (2026-10-25): painter contract, colours, geometry. */
import test from "node:test";
import assert from "node:assert/strict";
import { CFG, key } from "../src/core/config.js";
import { cellSpec, specKey, mix as fdMix } from "../src/render/featdraw.js";
import { mix, hsh } from "../src/render/featart/kit.js";

const world = (cells) => { const n = CFG.COLS * CFG.ROWS, w = { feat: new Uint8Array(n), featM: new Uint8Array(n), featS: new Float32Array(n), featPair: new Uint8Array(n), featT: 0, heat: 1, pace: 0, level: 3 }; for (const [x, y, v] of cells) w.feat[key(x, y)] = v; return w; };

test("cellSpec gives nb and par for a belt chain", () => {
  const w = world([[5, 5, 1], [6, 5, 1], [7, 5, 1]]);
  assert.deepEqual(cellSpec(w, 6, 5).nb, { N: false, E: true, S: false, W: true });
  assert.deepEqual(cellSpec(w, 5, 5).nb, { N: false, E: true, S: false, W: false });
  assert.deepEqual(cellSpec(w, 7, 5).nb, { N: false, E: false, S: false, W: true });
  assert.equal(cellSpec(w, 6, 5).par, 1);
  assert.equal(cellSpec(w, 5, 5).par, 0);
});
test("specKey differs when par differs", () => {
  const w = world([[5, 5, 6], [6, 5, 6]]);
  assert.notEqual(specKey(cellSpec(w, 5, 5)), specKey(cellSpec(w, 6, 5)));
});
test("kit.mix matches the round-3 mix; hsh is deterministic in [0,1)", () => {
  assert.equal(mix("#ffffff", "#000000", 0.5), "#808080");
  assert.equal(mix("#d4a030", "#062416", 0.37), fdMix("#d4a030", "#062416", 0.37));
  assert.equal(hsh(3, 4, 5), hsh(3, 4, 5));
  for (let i = 0; i < 50; i++) { const v = hsh(i, 7, 9); assert.ok(v >= 0 && v < 1); }
});
