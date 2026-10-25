/* ATTRACT is a PLAY world the shell draws with {hud:false, amb:true}: it gets the ambient layer, menus and the title ({hud:false}) still get none */
import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { createRenderer } from "../src/render/renderer.js";
import { setFxOpts, initFx } from "../src/render/fx.js";
import { readFileSync } from "node:fs";

const rec = () => {
  const log = [];
  const mk = (tag) => new Proxy({}, {
    get: (o, k) => (typeof k === "symbol" ? undefined : k in o ? o[k] : k === "canvas" ? { width: 600, height: 520 } : (...a) => { log.push(tag + k + "(" + a.map((v) => (typeof v === "number" ? v.toFixed(3) : v)).join(",") + ")"); return String(k).startsWith("create") ? mk("g.") : undefined; }),
    set: (o, k, v) => { log.push(tag + k + "=" + (typeof v === "number" ? v.toFixed(3) : v)); o[k] = v; return true; },
  });
  return { ctx: mk(""), log };
};
const frame = (k, o, st = "PLAY", lvl = 3) => {
  setFxOpts({ partK: k }); initFx();
  const r = rec(), rd = createRenderer({ width: 600, height: 520, getContext: () => r.ctx }, { kind: "2d" });
  const w = createWorld(4242, lvl); loadLevel(w, lvl); w.state = st; w.time = 5;
  rd.render(w, 1 / 60, o); rd.render(w, 1 / 60, o);
  const n = r.log.length; rd.render(w, 1 / 60, o);
  return r.log.slice(n);
};
test("an ATTRACT frame ({hud:false, amb:true}) carries ambient, a menu frame ({hud:false}) does not", () => {
  assert.notDeepEqual(frame(1, { hud: false, amb: true }), frame(0, { hud: false, amb: true }));
  assert.deepEqual(frame(1, { hud: false }), frame(0, { hud: false }));
  setFxOpts({ partK: 1 });
});
test("an ATTRACT frame draws no HUD chips", () => {
  const a = frame(1, { hud: false, amb: true }), g = frame(1, { hud: true });
  assert.ok(g.length > a.length);
  setFxOpts({ partK: 1 });
});
test("main.js hands amb:true to the ATTRACT frame only", () => {
  const src = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  assert.equal((src.match(/amb: true/g) || []).length, 1);
  assert.match(src, /attract\s*\n?\s*\? \{ hud: false, amb: true \}/);
});
