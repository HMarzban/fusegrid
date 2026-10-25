/* AMBIENT MOTION: the shared, deterministic particle spec. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BIOMES } from "../src/core/config.js";
import { AMB, AREA, biomeSpecs, particleAt, ambientColor, ambientCount, ambientClock } from "../src/render/ambient.js";
import { rgb } from "../src/render/featart/kit.js";

const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
test("every biome has ambient specs and they stay decoration (alpha, size, count caps)", () => {
  for (const b of BIOMES) {
    const specs = biomeSpecs(b.name); assert.ok(specs.length >= 1, b.name);
    for (const s of specs) {
      assert.ok(s.alpha <= 0.34, b.name + " alpha");
      if (["dot", "diamond", "flake"].includes(s.shape)) assert.ok(s.size <= 3, b.name + " small size");
      else assert.ok(s.alpha <= 0.26, b.name + " big shapes stay fainter");
      assert.ok(s.life >= 2.4, "nothing cycles faster than 2.4 s (no flashing)");
      assert.ok(s.n <= 16, "count cap");
    }
  }
  assert.equal(Object.keys(AMB).length, 8);
});
test("particleAt is deterministic, stays on the board interior and moves smoothly", () => {
  for (const b of BIOMES) biomeSpecs(b.name).forEach((spec, g) => {
    for (let i = 0; i < spec.n; i++) {
      let prev = null;
      for (let f = 0; f < 600; f++) {
        const t = 3.7 + f / 60, p = particleAt(spec, g, i, t), q = particleAt(spec, g, i, t);
        assert.deepEqual(p, q);
        if (!p) { prev = null; continue; }
        assert.ok(p.x >= AREA.x0 && p.x <= AREA.x1 && p.y >= AREA.y0 && p.y <= AREA.y1, b.name + " inside");
        assert.ok(p.a >= 0 && p.a <= 1 && p.s > 0);
        if (prev && prev.a > 0.1 && p.a > 0.1) assert.ok(Math.hypot(p.x - prev.x, p.y - prev.y) < 3.5, `${b.name} g${g} i${i} jumps at t=${t}`);
        prev = p;
      }
    }
  });
});
test("colours are slot mixes; VOID never passes wallHi", () => {
  for (const b of BIOMES) for (const s of biomeSpecs(b.name)) {
    const c = ambientColor(b, s); assert.match(c, /^#[0-9a-f]{6}$/);
    if (b.name === "VOID") assert.ok(lum(rgb(c)) <= lum(rgb(b.wallHi)) + 0.5, c);
  }
});
test("the PLAY-only clock advances in PLAY and freezes in PAUSE, WIN, LOSE and MENU; one long frame is capped", () => {
  const c = ambientClock();
  c.tick({ state: "PLAY" }, 0.016); const t1 = c.t; assert.ok(t1 > 0);
  for (const st of ["PAUSE", "WIN", "LOSE", "MENU"]) { c.tick({ state: st }, 0.5); assert.equal(c.t, t1, st); }
  c.tick({ state: "PLAY" }, 5); assert.ok(c.t - t1 <= 0.1 + 1e-9);
});
test("density: EFFECTS LOW halves the count, 0 turns it off", () => {
  const s = AMB.JUNGLE[0];
  assert.equal(ambientCount(s, 1), s.n); assert.equal(ambientCount(s, 0.5), Math.round(s.n / 2)); assert.equal(ambientCount(s, 0), 0);
});
test("no Math.random / Date in the ambient module", () => {
  assert.ok(!/Math\.random\(|Date\.now\(|new Date\(/.test(readFileSync(new URL("../src/render/ambient.js", import.meta.url), "utf8")));
});
