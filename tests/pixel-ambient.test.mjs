/* PIXEL ambient motion (2026-10-25): stepped art-px marks from src/render/ambient.js specs, armed only by the GAME frame. */
import test from "node:test";
import assert from "node:assert/strict";
import { BIOMES } from "../src/core/config.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { createAtlas } from "../src/render/pixel/atlas.js";
import { createView, drawPixelWorld } from "../src/render/pixel/world.js";
import { armAmbient, AMB_HZ } from "../src/render/pixel/ambient.js";
import { setFxOpts } from "../src/render/fx.js";
import { lumOf } from "../src/render/pixel/palette.js";
import { createRGBA, surfRGBA } from "../tools/pixel/rgba.mjs";

const atlas = createAtlas(surfRGBA);
const room = (L) => { const w = createWorld(7, L); w.gen = 2; loadLevel(w, L); w.state = "PLAY"; return w; };
const draw = (w, amb) => { const V = createView(atlas); V.amb = amb; const img = createRGBA(300, 260), c = img.getContext(); drawPixelWorld(c, w, V); return { data: Array.from(img.data), calls: c.calls.filter((q) => q[0] === "fillRect") }; };
const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++; return n; };

test("unarmed frames (menus, no ambient) draw exactly the plain board", () => {
  for (const L of [1, 4, 7]) { const w = room(L), a = draw(w, undefined), b = draw(w, null); assert.deepEqual(a.data, b.data); assert.equal(a.calls.length, b.calls.length); }
});

test("armed: every room gets a few sparse marks, all whole art px, none in the HUD ring", () => {
  for (let L = 1; L <= 8; L++) {
    const w = room(L), base = draw(w, null), on = draw(w, 4.7), n = diff(on.data, base.data);
    assert.ok(n >= 6 && n <= 120, "room " + L + " " + n);
    const fr = on.calls.slice(base.calls.length);
    assert.ok(fr.length > 0 && fr.every((q) => q.slice(1).every(Number.isInteger) && q[2] >= 18 && q[2] <= 244), "room " + L);
  }
});

test("stepped: time inside one step gives the same picture, a later step moves something", () => {
  const w = room(3), t = 5, same = draw(w, t + 0.4 / AMB_HZ);
  assert.deepEqual(draw(w, t).data, same.data);
  let moved = false;
  for (let k = 1; k < 24 && !moved; k++) moved = diff(draw(w, t).data, draw(w, t + k / AMB_HZ).data) > 0;
  assert.ok(moved);
});

test("EFFECTS LOW thins the count; every colour is a ramp step of its biome and VOID never passes wallHi", () => {
  const w = room(7);
  setFxOpts({ partK: 1 }); const full = draw(w, 6.1).calls.length;
  setFxOpts({ partK: 0.5 }); const low = draw(w, 6.1).calls.length;
  setFxOpts({ partK: 1 });
  assert.ok(low < full, low + " < " + full);
  const c = createRGBA(300, 260).getContext(), seen = new Set(), V = createView(atlas);
  let cur = "";
  Object.defineProperty(c, "fillStyle", { get: () => cur, set: (v) => { cur = v; seen.add(v); } });
  V.amb = 6.1; drawPixelWorld(c, w, V);
  assert.ok(seen.size > 0);
  for (const v of seen) { assert.match(v, /^#[0-9a-f]{6}$/i); assert.ok(lumOf(v) <= lumOf(BIOMES[6].wallHi) + 1e-9, v); }
});

test("armAmbient: GAME frames only, clock frozen in PAUSE/WIN/LOSE and under reduced motion", () => {
  const V = createView(atlas), w = room(1);
  armAmbient(V, w, { hud: false }, 0.05); assert.equal(V.amb, null);
  armAmbient(V, w, undefined, 0.05); assert.equal(V.amb, null);
  armAmbient(V, w, { hud: true }, 0.05); armAmbient(V, w, { hud: true }, 0.05); const t = V.amb;
  assert.ok(t > 0.09 && t < 0.11, t);
  for (const st of ["PAUSE", "WIN", "LOSE"]) { w.state = st; armAmbient(V, w, { hud: true }, 0.05); assert.equal(V.amb, t, st); }
  w.state = "PLAY";
  globalThis.matchMedia = () => ({ matches: true });
  try { armAmbient(V, w, { hud: true }, 0.05); assert.equal(V.amb, null); } finally { delete globalThis.matchMedia; }
});
