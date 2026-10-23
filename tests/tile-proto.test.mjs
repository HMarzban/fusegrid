/* TILE PROTO (2026-10-21, throwaway branch): wave-1 floor tiles. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { CFG } from "../src/core/config.js";
import { createWorld, loadLevel, step } from "../src/core/sim.js";
import { genBoard2 } from "../src/core/board2.js";
import { createDemobot } from "../src/app/demobot.js";
import { buildScene, countDrawCalls } from "../src/render/three/scene.js";

const mk = (gen, seed, room, heat) => { const w = createWorld(seed, room); w.gen = gen; w.heat = heat; loadLevel(w, room, false); w.state = "PLAY"; return w; };

test("gen 1 and non-tile gen-2 rooms carry no feat layer", () => {
  for (let room = 1; room <= 8; room++) assert.equal(mk(1, 77, room, 0).feat ?? null, null);
  for (const room of [4, 6, 7, 8]) assert.equal(mk(2, 77, room, 2).feat, null);
});
test("the layer is heat-invariant and home-biome only (V13, V21)", () => {
  const want = { 1: [6], 2: [5], 3: [1, 2, 3, 4], 5: [7] };
  for (const room of [1, 2, 3, 5]) for (let s = 0; s < 40; s++) {
    const b = [0, 1, 2].map((h) => genBoard2(1000 + s, room, h));
    const hx = b.map((x) => (x.feat ? Buffer.from(x.feat).toString("hex") : "-"));
    assert.equal(hx[0], hx[1]); assert.equal(hx[1], hx[2]);
    if (b[0].feat) for (const v of b[0].feat) if (v) assert.ok(want[room].includes(v), `room ${room} code ${v}`);
  }
});
test("tile rooms replay deterministically", () => {
  for (const room of [1, 2, 3, 5]) {
    const run = () => { const w = mk(2, 4242, room, 2), bot = createDemobot(9); for (let i = 0; i < 1800; i++) { step(w, CFG.STEP, { 0: bot.intent(w) }); w.events.length = 0; } return JSON.stringify([w.players[0].x, w.players[0].y, w.enemies.map((e) => [e.x, e.y]), w.score, Array.from(w.featS)]); };
    assert.equal(run(), run());
  }
});
test("no Math.random / Date in src/core", () => {
  for (const f of readdirSync(new URL("../src/core/", import.meta.url))) {
    const s = readFileSync(new URL("../src/core/" + f, import.meta.url), "utf8");
    assert.ok(!/Math\.random\(|Date\.now\(|new Date\(/.test(s), f);
  }
});
test("REAL 3D: a tile room adds exactly ONE draw (141 -> 142 in the fat-world formula); no feat = no mesh", () => {
  for (const room of [1, 2, 3, 5]) {
    const w = mk(2, 93, room, 0), w0 = mk(2, 93, room, 0);
    w0.feat = null;
    assert.ok(w.feat, "room " + room + " has tiles");
    assert.equal(countDrawCalls(buildScene(w, null).group) - countDrawCalls(buildScene(w0, null).group), 1, "room " + room);
  }
  const w1 = createWorld(93, 1); loadLevel(w1, 1, false);
  let feats = 0; buildScene(w1, null).group.traverse((o) => { if (o.userData.tag === "feat") feats++; });
  assert.equal(feats, 0);
});
test("tile art pass: every PIXEL tile cell is palette slots only and valid (8 tiles x 3 heats)", async () => {
  const { featPxCell } = await import("../src/render/featpx.js");
  const { validateCell } = await import("../src/render/pixel/grid.js");
  const K = [["JUNGLE", { kind: "BLOOM" }], ["ICE", { kind: "GLIDE", gx: 1, gy: 2 }], ["FACTORY", { kind: "BELT", dir: 1, exit: true }], ["WATER", { kind: "STREAM", dir: 2 }],
    ["ARENA", { kind: "PLATE" }], ["SAND", { kind: "QUICK" }], ["VOID", { kind: "PORTAL", pair: 2 }], ["CROWN", { kind: "GATE", lit: 3 }]];
  for (const [b, s] of K) for (let h = 0; h < 3; h++) {
    const c = featPxCell(b, { ...s, h });
    assert.deepEqual(validateCell(c, c.pal), [], b + " " + h);
    for (const v of Object.values(c.pal)) assert.ok(/^tile\./.test(v), v);
  }
});
