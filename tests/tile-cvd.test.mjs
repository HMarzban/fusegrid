/* Colour-vision gate for the floor tiles (#33): under protan / deutan / tritan (Machado 2009, full severity) every tile at CORE / PLUS / MAX stays apart from the
   base floor, the WALL cell and the BRICK cell at the 40 px view, and its three heats stay apart from each other. PIXEL is measured here, pure Node. CLASSIC 2D is held
   through the stamped Chrome golden (bottom of this file). REAL 3D runs only in tools/tileart/gates.mjs cvd / all. Pins: tools/tileart/gatefns.mjs. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BIOMES } from "../src/core/config.js";
import { simCVD, simRGB, dE, cvdSep, cvdFails, cvdHeatPin, CVD_KINDS, CVD_PIN } from "../tools/tileart/gatefns.mjs";
import { pxSets, CVD_ENT, RULED } from "../tools/tileart/cvdsets.mjs";
import { cvdStamp } from "../tools/tileart/cvdstamp.mjs";

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

/* CLASSIC 2D has no rasterizer under Node (paths, clips, gradients, strokes; Skia's antialiasing is the thing measured), so the Chrome measure is committed: while the stamp
   matches, cvdgold.json IS a measure of today's painter calls and palette, and it must clear today's pins. It does not prove another Chrome rasterizes the same pixels. */
const GOLD = JSON.parse(readFileSync(new URL("../tools/tileart/cvdgold.json", import.meta.url)));
const REMEASURE = "painter, palette or measuring code changed, re-measure in Chrome: node tools/tileart/gates.mjs cvd --golden";

test("CLASSIC golden: the committed Chrome measure is of today's painter call stream", () => {
  assert.equal(cvdStamp(), GOLD.stamp, REMEASURE);
  assert.deepEqual(Object.keys(GOLD.sets).sort(), CVD_ENT.map(([id]) => id).sort());
});

test("CLASSIC golden: every tile x heat clears CVD_PIN and its waiver under all three simulations", () => {
  const fails = Object.entries(GOLD.sets).flatMap(([id, r]) => cvdFails(id, r, { bed: true, look: "CLASSIC" }));
  assert.deepEqual(fails, []);
  for (const k of CVD_KINDS) assert.ok(GOLD.sets.booster.rows.some((r) => r.cvd === k), k);
});

test("CLASSIC golden bites: a lowered number fails, the gate-open waiver covers CLASSIC only and only down to its pin", () => {
  const r = structuredClone(GOLD.sets.trap), hit = r.rows.find((x) => x.cvd === "deutan");
  hit.brickE = CVD_PIN.brickE - 0.1;
  assert.ok(cvdFails("trap", r, { bed: true, look: "CLASSIC" }).some((m) => / brickE /.test(m)));
  const g = GOLD.sets["gate-open"];
  assert.ok(cvdFails("gate-open", g, { look: "PIXEL" }).some((m) => / heat /.test(m)));
  const low = structuredClone(g); low.heat.find((x) => x.cvd === "tritan").d = cvdHeatPin("CLASSIC", "gate-open") - 0.1;
  assert.ok(cvdFails("gate-open", low, { look: "CLASSIC" }).some((m) => / heat /.test(m)));
});

test("the stamp bites: a biome hex, an edit inside a Path2D and a gradient stop each move it", () => {
  const ENT = CVD_ENT.slice(0, 1), base = cvdStamp({ ENT });
  assert.equal(cvdStamp({ ENT }), base);
  assert.notEqual(cvdStamp({ ENT, C: { BIOMES: BIOMES.map((b) => ({ ...b, floor1: "#010203" })) } }), base);
  const stampOf = (w, stop) => cvdStamp({ ENT, F: { paintCell(g) { const p = new Path2D(); p.rect(0, 0, w, 4); g.fill(p, "evenodd"); g.createLinearGradient(0, 0, 1, 1).addColorStop(stop, "#000"); } } });
  assert.notEqual(stampOf(4, 0), stampOf(5, 0));
  assert.notEqual(stampOf(4, 0), stampOf(4, 0.5));
});
