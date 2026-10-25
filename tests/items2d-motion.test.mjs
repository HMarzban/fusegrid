/* CLASSIC 2D pickups (idle hover, shadow, glint, spawn pop) and collect bursts, 2026-10-25. */
import test from "node:test";
import assert from "node:assert/strict";
import { CFG } from "../src/core/config.js";
import { POWER } from "../src/core/entities.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { createRenderer } from "../src/render/renderer.js";
import { drawItems, drawItemBody, popK, POP_T } from "../src/render/itemdraw.js";
import { ITEM_FAMILY, ITEM_RING } from "../src/render/icons.js";
import { drawBursts, setFxOpts, initFx } from "../src/render/fx.js";
import { fxOf } from "../src/render/entityfx.js";
import { COLLECT, COLLECT_T } from "../src/render/motion.js";

const fmt = (v) => (typeof v === "number" ? v.toFixed(3) : typeof v === "string" ? v : v && typeof v === "object" ? "{o}" : String(v));
function rec() {
  const log = [], o = { _log: log };
  const c = new Proxy(o, {
    get(t, k) { if (k in t) return t[k]; if (k === "canvas") return { width: 600, height: 520 }; return (...a) => { log.push(k + "(" + a.map(fmt).join(",") + ")"); return k.startsWith("create") ? { addColorStop() {} } : undefined; }; },
    set(t, k, v) { log.push(k + "=" + fmt(v)); t[k] = v; return true; },
  });
  return c;
}
const world = () => { const w = createWorld(4242, 1); loadLevel(w, 1); w.state = "PLAY"; return w; };
const logOf = (fn) => { const c = rec(); fn(c); return c._log; };
const count = (log, re) => log.filter((l) => re.test(l)).length;
const IDS = POWER.map((p) => p.t);
const mkItem = (t, x = 100, y = 100) => ({ x, y, t, col: POWER.find((p) => p.t === t).col, taken: false, buried: false });

test("pickups are deterministic, hover within +-2 px, the disc is never scaled in steady state", () => {
  for (const t of IDS) {
    const w = { time: 1.234, items: [mkItem(t)], grid: {} };
    const a = logOf((c) => drawItems(c, w)), b = logOf((c) => drawItems(c, { ...w, items: [mkItem(t)], grid: {} }));
    assert.deepEqual(a, b, t);
    assert.equal(count(a, /^scale\(/), 0, t + " steady state has no scale call");
    assert.ok(a.some((l) => l === "arc(0.000,0.000," + (CFG.TILE * 0.34).toFixed(3) + ",0.000,7.000)"), t + " keeps the base disc");
    for (let k = 0; k < 200; k++) {
      const l = logOf((c) => drawItemBody(c, { time: k * 0.05 }, mkItem(t)));
      const tr = l.find((x) => /^translate\(0\.000,/.test(x)), dy = +tr.slice(tr.indexOf(",") + 1, -1);
      assert.ok(Math.abs(dy) <= 2 + 1e-9, t + " hover " + dy);
    }
  }
});
test("the ground shadow tightens at the apex: contact ellipses are narrower when the item hovers high", () => {
  const rx = (time) => { const l = logOf((c) => drawItems(c, { time, items: [mkItem("fire")], grid: {} })); return +l.find((x) => x.startsWith("ellipse(")).split(",")[2]; };
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < 130; k++) { const v = rx(k * 0.02); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  assert.ok(lo < hi * 0.85, lo + " vs " + hi);
});
test("PAUSE: the same world at two different real times renders the same frame (clock is world.time only)", () => {
  const w = { time: 3.3, items: IDS.map((t, i) => mkItem(t, 60 + i * 40, 100)), grid: {} };
  assert.deepEqual(logOf((c) => drawItems(c, w)), logOf((c) => drawItems(c, w)));
});
test("spawn pop: floor items never pop, a pickup revealed later pops 0.6 -> 1.1 -> 1 with no alpha strobe", () => {
  assert.equal(popK(-1), 1); assert.equal(popK(POP_T), 1); assert.equal(popK(5), 1);
  assert.ok(Math.abs(popK(0) - 0.6) < 1e-9);
  let mx = 0, prev = popK(0); for (let a = 0; a < POP_T; a += 0.005) { const v = popK(a); mx = Math.max(mx, v); assert.ok(v >= 0.6 && v <= 1.1 + 1e-9); assert.ok(Math.abs(v - prev) < 0.06, "smooth"); prev = v; }
  assert.ok(mx > 1.09);
  const w = { time: 1, items: [mkItem("heart", 60, 60), { ...mkItem("kick", 140, 60), buried: true }], grid: {} };
  const first = logOf((c) => drawItems(c, w));
  assert.equal(count(first, /^scale\(/), 0, "floor pickup does not pop on the first frame");
  w.items[1].buried = false; w.time = 1.1;
  const l = logOf((c) => drawItems(c, w));
  assert.equal(count(l, /^scale\(/), 1, "the revealed pickup pops");
  const sc = +l.find((x) => x.startsWith("scale(")).slice(6).split(",")[0]; assert.ok(Math.abs(sc - 0.6) < 1e-6, String(sc));
  w.time = 1.1 + POP_T + 0.01; assert.equal(count(logOf((c) => drawItems(c, w)), /^scale\(/), 0, "settled");
  w.grid = {}; w.items[1].buried = false;
  assert.equal(count(logOf((c) => drawItems(c, w)), /^scale\(/), 0, "a new grid reseeds: nothing pops at a room start");
});
test("the glint sweep draws a clipped band, and REDUCE FLASH removes it", () => {
  const find = () => { for (let t = 0; t < 3; t += 0.02) { const l = logOf((c) => drawItemBody(c, { time: t }, mkItem("shield"))); if (l.includes("clip()")) return { t, l }; } return null; };
  const hit = find(); assert.ok(hit, "a glint appears within one 2.8 s cycle");
  assert.ok(hit.l.some((l) => l.startsWith("globalAlpha=0.")), "band alpha");
  setFxOpts({ flashK: 0 });
  try { assert.equal(logOf((c) => drawItemBody(c, { time: hit.t }, mkItem("shield"))).includes("clip()"), false); } finally { setFxOpts({ flashK: 1 }); }
});
test("the four family chromes are distinct in ink pattern (rings / dashes / spokes) and frozen", () => {
  const sig = (f) => { const r = ITEM_RING[f]; return [r.rings.length, r.dash || 0, r.ticks || 0].join("/"); };
  const fams = ["cap", "vit", "utl", "bls"], s = fams.map(sig);
  assert.equal(new Set(s).size, 4, s.join(" "));
  assert.ok(Object.isFrozen(ITEM_RING) && fams.every((f) => Object.isFrozen(ITEM_RING[f])));
  assert.deepEqual(IDS.map((t) => ITEM_FAMILY[t]).filter((f) => !ITEM_RING[f]), []);
  assert.ok(ITEM_RING.cap.rings.length === 1 && ITEM_RING.vit.rings.length === 2 && ITEM_RING.utl.dash === 6 && ITEM_RING.bls.ticks === 8);
});
test("collect bursts: per-kind styles, bounded fills, finish, no plus shape for the heart, and PAUSE freezes them", () => {
  for (const kind of IDS) {
    const st = COLLECT[kind].style;
    for (const age of [0.02, 0.1, 0.2, 0.35, 0.49]) {
      const l = logOf((c) => drawBursts(c, [{ kind, x: 200, y: 200, col: "#ff8a3c", age }]));
      assert.ok(count(l, /^(fill|stroke)\(/) <= (age > 0.17 ? 6 : 14), kind + " " + age + " fills " + count(l, /^(fill|stroke)\(/));
      assert.equal(count(l, /gradient|shadowBlur/i), 0);
      if (age > 0.17 && st === "ring") assert.equal(count(l, /^stroke\(/), 2, kind + " ring");
      if (age > 0.17 && st === "rise") assert.ok(count(l, /^closePath\(/) === COLLECT[kind].n, "heart diamonds only");
    }
    assert.deepEqual(logOf((c) => drawBursts(c, [{ kind, x: 1, y: 2, col: "#fff", age: COLLECT_T }])), [], kind + " finished");
  }
  const a = { kind: "fire", x: 50, y: 60, col: "#ff8a3c", age: 0.2 };
  assert.deepEqual(logOf((c) => drawBursts(c, [a])), logOf((c) => drawBursts(c, [{ ...a }])));
  assert.notDeepEqual(logOf((c) => drawBursts(c, [a])), logOf((c) => drawBursts(c, [{ ...a, age: 0.3 }])));
  assert.ok(logOf((c) => drawBursts(c, [1, 2, 3, 4].map((i) => ({ ...a, x: i })))).filter((l) => l.startsWith("fill(")).length <= 16, "at most the two newest bursts");
});
test("renderer: a power event feeds the 2D burst; the burst plays on the PAUSE-frozen clock", () => {
  const cv = { width: 600, height: 520, getContext: () => rec() };
  const r = createRenderer(cv, { kind: "2d" });
  const w = world(); initFx();
  const draw = () => { r.ctx._log.length = 0; r.render(w, 1 / 60); return r.ctx._log.slice(); };
  w.time = 5; draw();
  const base = draw();
  w.events.push({ t: "power", x: 120, y: 120, col: "#3db4ff", kind: "speed" });
  w.time = 5.1; const withB = draw();
  assert.notDeepEqual(withB.length, base.length);
  assert.equal(fxOf(w, "2d").bursts(5.1).length, 1);
  assert.equal(count(withB, /^arc\(/) > count(base, /^arc\(/), true);
  w.state = "PAUSE"; w.time = 5.2; const p1 = draw(); w.time = 9.9; const p2 = draw();
  assert.deepEqual(p1, p2, "PAUSE: bursts, hover and glint are frozen");
  assert.equal(fxOf(w, "2d").bursts(5.2).length, 1, "the burst did not age while paused");
  w.state = "PLAY"; w.time = 5.1 + COLLECT_T + 0.05; draw();
  assert.equal(fxOf(w, "2d").bursts(w.time).length, 0, "expired");
});
