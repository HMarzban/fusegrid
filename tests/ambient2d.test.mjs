/* AMBIENT MOTION, CLASSIC 2D painter: cost, freeze, density and the gates that keep menus untouched */
import test from "node:test";
import assert from "node:assert/strict";
import { BIOMES } from "../src/core/config.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { createAmbient2d } from "../src/render/ambient2d.js";
import { biomeSpecs, ambientCount } from "../src/render/ambient.js";
import { createRenderer } from "../src/render/renderer.js";
import { setFxOpts, initFx } from "../src/render/fx.js";

const rec = () => {
  const log = [];
  const mk = (tag) => new Proxy({}, {
    get: (o, k) => (typeof k === "symbol" ? undefined : k in o ? o[k] : k === "canvas" ? { width: 600, height: 520 } : (...a) => { log.push(tag + k + "(" + a.map((v) => (typeof v === "number" ? v.toFixed(3) : v)).join(",") + ")"); return String(k).startsWith("create") ? mk("g.") : undefined; }),
    set: (o, k, v) => { log.push(tag + k + "=" + (typeof v === "number" ? v.toFixed(3) : v)); o[k] = v; return true; },
  });
  return { ctx: mk(""), log };
};
const world = (lvl, state = "PLAY") => { const w = createWorld(4242, lvl); loadLevel(w, lvl); w.state = state; return w; };
const paintOf = (w, t, layers = ["under", "over"]) => { const a = createAmbient2d(), r = rec(); a.tick(w, t); for (const l of layers) a.draw(r.ctx, w, l); return r.log; };
const fills = (log) => log.filter((l) => l.startsWith("fill(") || l.startsWith("stroke(")).length;

test("at most 40 fills or strokes a frame in every world, no gradient, no shadowBlur", () => {
  setFxOpts({ partK: 1 });
  for (const b of BIOMES) {
    const w = world(BIOMES.indexOf(b) + 1);
    for (const t of [2, 9.3, 31]) {
      const log = paintOf(w, t);
      assert.ok(fills(log) <= 40, b.name + " " + fills(log));
      assert.ok(!log.some((l) => /Gradient|shadowBlur/.test(l)), b.name);
    }
  }
});
test("each world draws something at some time in each layer it specs", () => {
  for (const b of BIOMES) {
    const w = world(BIOMES.indexOf(b) + 1), specs = biomeSpecs(b.name);
    for (const layer of ["under", "over"]) {
      if (!specs.some((s) => s.layer === layer)) continue;
      let any = false;
      for (let t = 3; t < 40 && !any; t += 1.7) any = fills(paintOf(w, t, [layer])) > 0;
      assert.ok(any, b.name + " " + layer);
    }
  }
});
test("PAUSE, WIN and LOSE freeze the clock: the frames repeat exactly", () => {
  for (const st of ["PAUSE", "WIN", "LOSE"]) {
    const w = world(3), a = createAmbient2d();
    a.tick(w, 4);
    w.state = st;
    const r1 = rec(); a.draw(r1.ctx, w, "under"); a.draw(r1.ctx, w, "over");
    const t0 = a.clock.t;
    a.tick(w, 0.1); a.tick(w, 0.1);
    const r2 = rec(); a.draw(r2.ctx, w, "under"); a.draw(r2.ctx, w, "over");
    assert.equal(a.clock.t, t0);
    assert.deepEqual(r1.log, r2.log, st);
  }
  const w = world(3), a = createAmbient2d(); a.tick(w, 0.1); assert.ok(a.clock.t > 0);
});
test("EFFECTS LOW halves the particles, and nothing draws at density 0", () => {
  const w = world(2);
  setFxOpts({ partK: 1 }); const full = fills(paintOf(w, 14));
  setFxOpts({ partK: 0.5 }); const half = fills(paintOf(w, 14));
  setFxOpts({ partK: 0 }); const none = fills(paintOf(w, 14));
  setFxOpts({ partK: 1 });
  assert.ok(half < full && half > 0, full + " vs " + half);
  assert.equal(none, 0);
  const s = biomeSpecs("ICE")[0];
  assert.equal(ambientCount(s, 0.5), Math.round(s.n * 0.5));
});
test("prefers-reduced-motion draws nothing", () => {
  const had = Object.getOwnPropertyDescriptor(globalThis, "matchMedia");
  globalThis.matchMedia = () => ({ matches: true });
  try { assert.equal(paintOf(world(2), 14).length, 0); } finally { if (had) Object.defineProperty(globalThis, "matchMedia", had); else delete globalThis.matchMedia; }
});
test("a wall tile never carries an under-layer particle", () => {
  const w = world(3);
  for (let i = 0; i < w.grid.length; i++) w.grid[i] = 2;
  assert.equal(fills(paintOf(w, 14, ["under"])), 0);
});
test("the renderer draws ambient only on the GAME frame (o.hud): menus, title and show stay untouched", () => {
  const frame = (k, o, st = "PLAY") => {
    setFxOpts({ partK: k }); initFx();
    const r = rec(), rd = createRenderer({ width: 600, height: 520, getContext: () => r.ctx }, { kind: "2d" });
    const w = world(3, st); w.time = 5;
    rd.render(w, 1 / 60, o); rd.render(w, 1 / 60, o);
    const n = r.log.length; rd.render(w, 1 / 60, o);
    return r.log.slice(n);
  };
  assert.deepEqual(frame(1, undefined), frame(0, undefined), "no ambient without hud");
  assert.deepEqual(frame(1, { hud: false }), frame(0, { hud: false }), "no ambient with hud false");
  assert.notDeepEqual(frame(1, { hud: true }), frame(0, { hud: true }), "GAME frame carries it");
  const p1 = frame(1, { hud: true }, "PAUSE"), p2 = frame(1, { hud: true }, "PAUSE");
  assert.deepEqual(p1, p2, "PAUSE frames repeat");
  setFxOpts({ partK: 1 });
});
