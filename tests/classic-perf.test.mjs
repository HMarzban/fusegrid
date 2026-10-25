import { createRenderer, NET_MS, SNAP_MS } from "../src/render/renderer.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { initFx, getFx, getShake, getFlash } from "../src/render/fx.js";
import { classicHash } from "./lib/classichash.mjs";
import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}

const fmt = (v) => (typeof v === "number" ? v.toFixed(3) : typeof v === "string" ? v : v && v.tag ? v.tag : v && typeof v === "object" ? "{o}" : String(v));
function rig() {
  const log = [];
  let M = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const rec = (tag, extra = {}) => new Proxy(extra, {
    get(o, k) {
      if (k in o) return o[k];
      if (k === "canvas") return { width: 600, height: 520 };
      return (...a) => { log.push(tag + k + "(" + a.map(fmt).join(",") + ")"); return k.startsWith("create") ? rec("g.", {}) : undefined; };
    },
    set(o, k, v) { log.push(tag + k + "=" + fmt(v)); o[k] = v; return true; },
  });
  const ctx = rec("c.", { getTransform: () => ({ ...M }) });
  const canvas = { tag: "#c", width: 600, height: 520, getContext: () => ctx };
  const snap = { tag: "snap", width: 0, height: 0, getContext: () => rec("s.", {}) };
  const clk = { t: 1000 };
  return { log, ctx, canvas, snap, clk, setM: (m) => { M = m; }, mk: () => snap };
}
const world = (lvl = 1) => { const w = createWorld(4242, lvl); loadLevel(w, lvl); w.state = "PLAY"; return w; };
const after = (log, from, mark) => { const i = log.indexOf(mark, from); return i < 0 ? null : log.slice(i + 1); };

{
  const h = await classicHash((p) => import(pathToFileURL(join(ROOT, p)).href));
  check("CLASSIC 2D call-log hash unchanged (unarmed renderer)", h === "e32e7a18:65648", h);
}

{
  const R = rig(), r = createRenderer(R.canvas, { kind: "2d", mk: R.mk, now: () => R.clk.t });
  const w = world();
  initFx();
  for (let i = 0; i < 3; i++) r.render(w, 1 / 60);
  check("unarmed: every frame rasters the board", r._dbg.rasters === 3 && r._dbg.blits === 0 && r._dbg.armed === false);
  check("unarmed: the gradient is rebuilt every frame (byte-identical call log)", R.log.filter((l) => l.startsWith("c.createLinearGradient")).length === 3);
  check("the GRAPHICS contract is non-enumerable", Object.keys(r).sort().join() === "canvas,consumeEvents,ctx,getShake,render" && typeof r.setPerf === "function");
}

{
  const R = rig(), r = createRenderer(R.canvas, { kind: "2d", mk: R.mk, now: () => R.clk.t });
  const w = world();
  initFx();
  r.setPerf({ epoch: 1 });
  const o = { hud: true, time: { on: false } };
  const fr = (ww = w) => { R.clk.t += 16; r.render(ww, 1 / 60, o); };
  r.render(w, 1 / 60, o);
  check("a changed raster copies no snapshot", r._dbg.snaps === 0 && r._dbg.rasters === 1 && !R.log.some((l) => l.startsWith("s.drawImage")));
  R.clk.t += 16;
  r.render(w, 1 / 60, o);
  check("the first still raster copies nothing (a 120 Hz frame between two 60 Hz steps)", r._dbg.snaps === 0 && r._dbg.rasters === 2 && !R.log.some((l) => l.startsWith("s.drawImage")));
  let n = R.log.length;
  R.clk.t += 16;
  r.render(w, 1 / 60, o);
  const A = after(R.log, n, "s.drawImage(#c,0.000,0.000)");
  check("the second still raster in a row takes the snapshot right after the board", !!A && R.log.slice(n).includes("s.globalCompositeOperation=copy") && r._dbg.snaps === 1 && r._dbg.rasters === 3);
  n = R.log.length;
  R.clk.t += 16;
  r.render(w, 1 / 60, o);
  const seg = R.log.slice(n);
  const head = ["c.save()", "c.setTransform(1.000,0.000,0.000,1.000,0.000,0.000)", "c.globalCompositeOperation=copy", "c.drawImage(snap,0.000,0.000)", "c.restore()"];
  check("a frozen frame blits the snapshot at the identity transform", JSON.stringify(seg.slice(0, 5)) === JSON.stringify(head), seg.slice(0, 5).join(" "));
  check("a frozen frame redraws exactly the overlay layers of a repaint frame", JSON.stringify(seg.slice(5)) === JSON.stringify(A), seg.length - 5 + " vs " + (A && A.length));
  check("a frozen frame paints no board", !seg.some((l) => l.startsWith("c.createLinearGradient")) && r._dbg.blits === 1 && r._dbg.rasters === 3 && r._dbg.snaps === 1);
  w.time += 1 / 60;
  fr();
  check("world.time re-rasters without a copy", r._dbg.rasters === 4 && r._dbg.snaps === 1);
  check("armed rasters reuse the cached gradient per (ctx, level)", R.log.filter((l) => l.startsWith("c.createLinearGradient")).length === 1);
  for (let i = 0; i < 3; i++) fr();
  check("the board stills again: a plain raster, a snap raster, then a blit", r._dbg.rasters === 6 && r._dbg.snaps === 2 && r._dbg.blits === 2);
  R.setM({ a: 1.2, b: 0, c: 0, d: 1.2, e: -30, f: -20 });
  fr();
  check("an outer transform change (INTRO zoom / camera) re-rasters", r._dbg.rasters === 7 && r._dbg.snaps === 3);
  fr();
  check("the same transform blits again", r._dbg.blits === 3);
  R.clk.t += NET_MS;
  fr();
  check("the 500 ms net re-rasters", NET_MS === 500 && r._dbg.rasters === 8 && r._dbg.snaps === 4);
  r.invalidate();
  fr();
  check("invalidate() forces the next raster", r._dbg.rasters === 9 && r._dbg.snaps === 5);
  w.events.push({ t: "bomb", x: 300, y: 260 });
  fr();
  check("events drain and re-raster; live particles keep rastering", w.events.length === 0 && r._dbg.rasters === 10 && getFx().length > 0);
  const s0 = r._dbg.snaps;
  let k = 0;
  while (getFx().length && k < 200) { fr(); k++; }
  check("live particles never copy the board", r._dbg.snaps === s0 && k > 0);
  const n2 = r._dbg.rasters;
  const b0 = r._dbg.blits;
  for (let i = 0; i < 3; i++) fr();
  check("after the last particle a plain raster, a snap raster, then the skip resumes", r._dbg.rasters === n2 + 2 && r._dbg.snaps === s0 + 1 && r._dbg.blits === b0 + 1 && r._dbg.rasters >= 10 + k);
  const w2 = world(2);
  fr(w2);
  check("a new level re-rasters and builds its own gradient", r._dbg.rasters === n2 + 3 && R.log.filter((l) => l.startsWith("c.createLinearGradient")).length === 2);
}

{
  const R = rig(), r = createRenderer(R.canvas, { kind: "2d", mk: R.mk, now: () => R.clk.t });
  const w = world();
  initFx();
  r.setPerf({ epoch: 1 });
  const o = { hud: true, time: { on: false } };
  const N = 30;
  for (let i = 0; i < N; i++) { w.time += 1 / 60; R.clk.t += 16; r.render(w, 1 / 60, o); }
  check("PLAY (world.time advancing): N rasters, zero snapshot copies", r._dbg.rasters === N && r._dbg.snaps === 0 && r._dbg.blits === 0 && !R.log.some((l) => l.startsWith("s.drawImage")), r._dbg.rasters + "/" + r._dbg.snaps);
  const M = 10;
  for (let i = 0; i < M; i++) { R.clk.t += 16; r.render(w, 1 / 60, o); }
  check("a frozen board: one plain raster, one snap, then blits", r._dbg.snaps === 1 && r._dbg.rasters === N + 2 && r._dbg.blits === M - 2, r._dbg.snaps + "/" + r._dbg.rasters + "/" + r._dbg.blits);
}

{
  const R = rig(), r = createRenderer(R.canvas, { kind: "2d", mk: R.mk, now: () => R.clk.t });
  const w = world();
  initFx();
  r.setPerf({ epoch: 1 });
  const o = { hud: true, time: { on: false } };
  const N = 40;
  for (let i = 0; i < N; i++) { if (i % 2 === 0) w.time += 1 / 60; R.clk.t += 1000 / 120; r.render(w, 1 / 120, o); }
  check("FRAME RATE MAX at 120 Hz (a 60 Hz step every other frame): N rasters, zero copies, zero blits", r._dbg.rasters === N && r._dbg.snaps === 0 && r._dbg.blits === 0 && !R.log.some((l) => l.startsWith("s.drawImage")), r._dbg.rasters + "/" + r._dbg.snaps + "/" + r._dbg.blits);
  const M = 10;
  for (let i = 0; i < M; i++) { R.clk.t += 1000 / 120; r.render(w, 1 / 120, o); }
  check("then frozen: a raster under SNAP_MS, one snap raster, then blits", SNAP_MS === 12 && r._dbg.snaps === 1 && r._dbg.rasters === N + 2 && r._dbg.blits === M - 2, r._dbg.snaps + "/" + r._dbg.rasters + "/" + r._dbg.blits);
}

for (const HZ of [144, 165, 240]) {
  const R = rig(), r = createRenderer(R.canvas, { kind: "2d", mk: R.mk, now: () => R.clk.t });
  const w = world();
  initFx();
  r.setPerf({ epoch: 1 });
  const o = { hud: true, time: { on: false } };
  let acc = 0;
  for (let i = 0; i < HZ; i++) { acc += 1 / HZ; while (acc >= 1 / 60 - 1e-9) { w.time += 1 / 60; acc -= 1 / 60; } R.clk.t += 1000 / HZ; r.render(w, 1 / HZ, o); }
  check("FRAME RATE MAX at " + HZ + " Hz (60 Hz accumulator): every frame rasters, zero copies, zero blits", r._dbg.rasters === HZ && r._dbg.snaps === 0 && r._dbg.blits === 0, r._dbg.rasters + "/" + r._dbg.snaps + "/" + r._dbg.blits);
}

{
  const R = rig(), r = createRenderer(R.canvas, { kind: "2d", mk: () => null, now: () => R.clk.t });
  const w = world();
  r.setPerf({ epoch: 1 });
  for (let i = 0; i < 3; i++) r.render(w, 1 / 60);
  check("no offscreen canvas: armed but never skips", r._dbg.rasters === 3 && r._dbg.blits === 0);
}

{
  const R = rig(), r = createRenderer(R.canvas, { kind: "2d", mk: R.mk, now: () => R.clk.t });
  const w = world();
  initFx();
  w.events.push({ t: "boom", x: 300, y: 260 });
  w.time += 1 / 60;
  r.render(w, 1 / 60);
  w.state = "PAUSE";
  const real = Math.random;
  Math.random = () => 0.9;
  try {
    w.time += 1 / 60;
    let n = R.log.length;
    r.render(w, 1 / 60);
    const p0 = getFx().map((p) => p.x + "," + p.y).join();
    const f1 = R.log.slice(n);
    w.time += 5;
    n = R.log.length;
    r.render(w, 1 / 60);
    const f2 = R.log.slice(n);
    check("PAUSE: particles hold still", getFx().length > 0 && getFx().map((p) => p.x + "," + p.y).join() === p0);
    check("PAUSE: the board draws at the clamped time (identical call logs while world.time runs)", JSON.stringify(f1) === JSON.stringify(f2), f1.length + "/" + f2.length);
    check("PAUSE: no shake term", f1.includes("c.translate(0.000,0.000)") && getShake().x !== 0);
    check("PAUSE: no flash wash", getFlash() > 0 && !f1.some((l) => l === "c.fillStyle=#ffe8a8"));
    check("PAUSE: world.time is restored after the board", w.time > 5);
    r.invalidate();
    n = R.log.length;
    r.render(w, 1 / 60);
    const f3 = R.log.slice(n);
    check("a plain invalidate (tab return) keeps the PAUSE latch", JSON.stringify(f3) === JSON.stringify(f1));
    r.invalidate(true);
    n = R.log.length;
    r.render(w, 1 / 60);
    const f4 = R.log.slice(n);
    w.time += 5;
    n = R.log.length;
    r.render(w, 1 / 60);
    const f5 = R.log.slice(n);
    check("invalidate(true) (cache hit) re-latches PAUSE at the current time", JSON.stringify(f4) !== JSON.stringify(f1) && JSON.stringify(f5) === JSON.stringify(f4));
    const w2 = world();
    w2.events.length = 0;
    r.render(w2, 1 / 60);
    check("a new world straight out of PAUSE drops the held shake and flash", getFlash() === 0 && getShake().x === 0 && getFx().length === 0);
  } finally { Math.random = real; }
}

console.log(fail ? "CLASSIC PERF FAIL" : "CLASSIC PERF OK", pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
