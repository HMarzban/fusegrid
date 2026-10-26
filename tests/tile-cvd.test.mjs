/* Colour-vision gate for the floor tiles (#33): under protan / deutan / tritan (Machado 2009, full severity) every tile at CORE / PLUS / MAX stays apart from the
   base floor, the WALL cell and the BRICK cell at the 40 px view, and its three heats stay apart from each other. Pure Node over the PIXEL cells; the CLASSIC 2D twin
   needs Chrome and runs in tools/tileart/gates.mjs cvd / all. Pins: tools/tileart/gatefns.mjs CVD_PIN. */
import test from "node:test";
import assert from "node:assert/strict";
import { simCVD, simRGB, dE, cvdSep, cvdFails, CVD_KINDS, CVD_PIN } from "../tools/tileart/gatefns.mjs";
import { pxSets, CVD_ENT, RULED } from "../tools/tileart/cvdsets.mjs";

test("simCVD: greys stay grey, alpha is kept, red / green collapse for protan and deutan only", () => {
  const a = new Uint8ClampedArray([0, 0, 0, 255, 40, 40, 40, 7, 128, 128, 128, 0, 255, 255, 255, 255]);
  for (const k of CVD_KINDS) assert.deepEqual(Array.from(simCVD(a, k)), Array.from(a), k);
  const n = dE([255, 0, 0], [0, 160, 0]);
  for (const k of ["protan", "deutan"]) assert.ok(dE(simRGB([255, 0, 0], k), simRGB([0, 160, 0], k)) < n / 4, k);
  assert.ok(dE(simRGB([255, 0, 0], "tritan"), simRGB([0, 160, 0], "tritan")) > n * 0.8);
});

test("the gate covers all eight tiles, the four ruled ones included", () => {
  const kinds = new Set(CVD_ENT.map(([, , s]) => s.kind));
  assert.deepEqual([...kinds].sort(), ["BELT", "BLOOM", "GATE", "GLIDE", "PLATE", "PORTAL", "QUICK", "STREAM"]);
  for (const id of ["booster", "ice-patch", "conveyor", "trap"]) assert.ok(RULED.has(id), id);
});

test("the gate bites: a 'tile' that is the base floor fails the floor and heat pins", () => {
  const s = pxSets()[0], f = cvdFails("probe", cvdSep({ ...s, heats: [s.floor[0], s.floor[0], s.floor[0]] }, s.S));
  assert.ok(f.some((m) => / floorL 0\.0 /.test(m)) && f.some((m) => / floorE 0\.0 /.test(m)) && f.some((m) => / heat /.test(m)), f.join("\n"));
});

test("PIXEL: every tile x heat clears CVD_PIN against floor, wall and brick, and its heats stay apart, under all three simulations", () => {
  const sets = pxSets(), fails = [];
  for (const s of [...sets].sort((a, b) => b.ruled - a.ruled)) fails.push(...cvdFails(s.id, cvdSep(s, s.S)));
  assert.deepEqual(fails, []);
  assert.equal(CVD_PIN.heat, 4);
});
