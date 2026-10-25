/* ENTITY MOTION: the shared, deterministic timing spec for foes and pickups. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FOES, POWER } from "../src/core/entities.js";
import { ITEM_FAMILY } from "../src/render/icons.js";
import { MOTION, FOE_M, foeM, phaseOf, bobAt, breatheAt, blinkAt, spawnK, deathK, hitK, leanAt, itemIdle, COLLECT, COLLECT_T, collectParticle } from "../src/render/motion.js";

test("every foe type and every pickup kind has a motion entry, and the tables are frozen", () => {
  for (const f of FOES) assert.ok(FOE_M[f.t], f.t);
  for (const p of POWER) assert.ok(COLLECT[p.t], p.t);
  assert.ok(Object.isFrozen(FOE_M) && Object.isFrozen(COLLECT) && Object.isFrozen(MOTION) && Object.isFrozen(FOE_M.walker));
  assert.equal(foeM("nope"), FOE_M.walker);
});
test("foe idle, bob, breathe and blink are deterministic, bounded and the blink is short and rare", () => {
  for (const f of FOES) {
    const ph = phaseOf(f.t, { x: 140, y: 60 }); assert.equal(ph, phaseOf(f.t, { x: 140, y: 60 })); assert.ok(ph >= 0 && ph < 1);
    const m = FOE_M[f.t]; let closed = 0, n = 0;
    for (let t = 0; t < 40; t += 1 / 60) {
      assert.ok(Math.abs(bobAt(f.t, ph, t, true)) <= m.bobA + 1e-9 && Math.abs(bobAt(f.t, ph, t, false)) <= m.idleA + 1e-9);
      assert.ok(Math.abs(breatheAt(f.t, ph, t) - 1) <= m.breathe + 1e-9);
      const b = blinkAt(f.t, ph, t); assert.ok(b >= 0 && b <= 1); n++; if (b > 0) closed++;
    }
    if (m.blinkEvery) assert.ok(closed / n < 0.06 && closed > 0, f.t + " blinks rarely"); else assert.equal(closed, 0);
  }
});
test("spawn pops then settles; death squashes, flashes one frame, finishes; hit is brief", () => {
  const a = spawnK(0, 0), b = spawnK(0.2 / MOTION.SPAWN_T, 0), c = spawnK(1, 5);
  assert.ok(a.s < 0.6 && a.a < 0.5 && a.ring); assert.ok(b.s > 0.9 && b.s <= 1.1);
  assert.deepEqual([c.s, c.a, c.ring], [1, 1, null]);
  for (let p = 0; p < 1; p += 0.01) { const k = spawnK(p, 3); assert.ok(k.s > 0 && k.s <= 1.11 && k.a > 0 && k.a <= 1); }
  let flashes = 0; for (let age = 0; age < MOTION.DEATH_T; age += 1 / 60) { const k = deathK(age); assert.ok(k.sx > 0 && k.sy > 0 && k.a >= 0 && k.a <= 1); flashes += k.flash; }
  assert.ok(flashes <= 3 && flashes >= 1); assert.equal(deathK(MOTION.DEATH_T), null); assert.equal(deathK(-1), null);
  assert.ok(hitK(0.06).sx > 1 && hitK(0.06).sy < 1); assert.equal(hitK(MOTION.HIT_T), null);
});
test("hunter lean only when hunting and within 3 tiles", () => {
  assert.equal(leanAt("walker", false, 20, 0, 40), null); assert.equal(leanAt("walker", true, 200, 0, 40), null); assert.equal(leanAt("stationary", true, 20, 0, 40), null);
  const k = leanAt("chaser", true, 40, 0, 40); assert.ok(k.ox > 0 && k.glow > 0 && k.glow < 1);
});
test("item idle: hover bounded, glint rare and slow, shadow tightens at the apex", () => {
  let glints = 0, n = 0;
  for (const fam of ["cap", "vit", "utl", "bls"]) for (let t = 0; t < 30; t += 1 / 60) {
    const k = itemIdle(fam, 0.7, t); assert.ok(Math.abs(k.dy) <= MOTION.HOVER_A + 1e-9 && k.shadow >= 0.72 && k.shadow <= 1); n++; if (k.glint !== null) { glints++; assert.ok(k.glint >= 0 && k.glint < 1); }
  }
  assert.ok(glints / n < 0.3 && glints > 0); assert.ok(MOTION.GLINT_EVERY >= 2.4);
  assert.ok(Object.keys(ITEM_FAMILY).length >= 12);
});
test("collect bursts: bounded particles per kind, deterministic, finish after COLLECT_T", () => {
  for (const [kind, m] of Object.entries(COLLECT)) {
    assert.ok(m.n >= 1 && m.n <= 14 && m.r <= 34, kind);
    for (let i = 0; i < m.n; i++) { for (let age = 0; age < COLLECT_T; age += 0.05) { const p = collectParticle(kind, i, age), q = collectParticle(kind, i, age); assert.deepEqual(p, q); assert.ok(p.a >= 0 && p.a <= 1 && Math.hypot(p.x, p.y) <= m.r * 1.3 + 8, kind); } assert.equal(collectParticle(kind, i, COLLECT_T), null); }
    assert.equal(collectParticle(kind, m.n, 0.1), null);
  }
});
test("no Math.random / Date / world.time in motion.js", () => {
  const s = readFileSync(new URL("../src/render/motion.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/Math\.random\(|Date\.now\(|new Date\(|world\.time/.test(s));
});
