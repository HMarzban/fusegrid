/* CLASSIC 2D foes (bob, blink, hunter lean + glow, spawn pop, death ghosts, per-foe life), 2026-10-25. */
import test from "node:test";
import assert from "node:assert/strict";
import { CFG } from "../src/core/config.js";
import { FOES, spawnEnemy } from "../src/core/entities.js";
import { createWorld, loadLevel } from "../src/core/sim.js";
import { createRenderer } from "../src/render/renderer.js";
import { drawEnemies, drawEnemyBody } from "../src/render/sprites.js";
import { FOE_RAD } from "../src/render/enemybody.js";
import { setFxOpts, initFx } from "../src/render/fx.js";
import { fxOf } from "../src/render/entityfx.js";
import { MOTION, FOE_M, phaseOf, blinkAt } from "../src/render/motion.js";

const TYPES = FOES.map((f) => f.t);
const fmt = (v) => (typeof v === "number" ? v.toFixed(3) : typeof v === "string" ? v : v && typeof v === "object" ? "{o}" : String(v));
function rec() {
  const log = [], o = { _log: log };
  return new Proxy(o, {
    get(t, k) { if (k in t) return t[k]; if (k === "canvas") return { width: 600, height: 520 }; return (...a) => { log.push(k + "(" + a.map(fmt).join(",") + ")"); return k.startsWith("create") ? { addColorStop() {} } : undefined; }; },
    set(t, k, v) { log.push(k + "=" + fmt(v)); t[k] = v; return true; },
  });
}
/* extent recorder with a real transform stack: every painted point mapped to the page, so squash, lean and rotation count */
function tracker() {
  let M = [1, 0, 0, 1, 0, 0]; const st = [], b = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, bad: 0 };
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const at = (x, y) => { if (typeof x !== "number" || typeof y !== "number" || !isFinite(x + y)) { b.bad++; return; } const X = M[0] * x + M[2] * y + M[4], Y = M[1] * x + M[3] * y + M[5]; b.x0 = Math.min(b.x0, X); b.x1 = Math.max(b.x1, X); b.y0 = Math.min(b.y0, Y); b.y1 = Math.max(b.y1, Y); };
  const box = (x, y, rx, ry) => { for (const sx of [-1, 1]) for (const sy of [-1, 1]) at(x + sx * rx, y + sy * ry); };
  const c = { _b: b, save() { st.push(M); }, restore() { M = st.pop(); }, translate(x, y) { M = mul(M, [1, 0, 0, 1, x, y]); }, scale(x, y) { if (!isFinite(x + y)) b.bad++; M = mul(M, [x, 0, 0, y, 0, 0]); },
    rotate(a) { M = mul(M, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]); }, beginPath() {}, closePath() {}, fill() {}, stroke() {},
    moveTo: at, lineTo: at, quadraticCurveTo(a, b2, x, y) { at(a, b2); at(x, y); }, arcTo(a, b2, x, y) { at(a, b2); at(x, y); },
    arc(x, y, r) { box(x, y, r, r); }, ellipse(x, y, rx, ry) { box(x, y, rx, ry); }, fillRect(x, y, w, h) { at(x, y); at(x + w, y + h); } };
  return c;
}
const mk = (type, o = {}) => { const e = spawnEnemy(type, 1, 1, 1, null, { invulnT: 0 }); e.x = 100; e.y = 100; e.invuln = false; e.invulnT = 0; e.dir = { x: 1, y: 0 }; return Object.assign(e, o); };
const W = (e, time, pl = { x: 600, y: 100 }) => ({ time, enemies: [e], players: [{ x: pl.x, y: pl.y, alive: true }], events: [], level: 1 });
const logOf = (fn) => { const c = rec(); fn(c); return c._log; };
const count = (log, re) => log.filter((l) => re.test(l)).length;

test("FOE_RAD is spawnEnemy's radius for every foe", () => {
  for (const t of TYPES) assert.ok(Math.abs(CFG.TILE * FOE_RAD[t] - mk(t).r) < 1e-9, t);
});
test("every foe, every state, any time: finite, inside its box, deterministic, no Math.random, no gradients", () => {
  const real = Math.random; Math.random = () => { throw new Error("Math.random in render"); };
  try {
    for (const t of TYPES) for (const mode of ["walk", "hunt", "spawn"]) {
      let big = 0;
      for (let k = 0; k < 140; k++) {
        const time = 3 + k * 0.037, e = mk(t, mode === "spawn" ? { invuln: true, invulnT: 1.2 - (k % 30) * 0.04 } : {});
        const tr = tracker(), w = W(e, time, { x: 100 + (mode === "hunt" ? 60 : 600), y: 100 });
        drawEnemies(tr, w);
        const b = tr._b; assert.equal(b.bad, 0, t + " " + mode + " non-finite");
        big = Math.max(big, 100 - b.x0, b.x1 - 100, 100 - b.y0, b.y1 - 100);
        const a = logOf((c) => drawEnemies(c, W(mk(t, mode === "spawn" ? { invuln: true, invulnT: 1.2 - (k % 30) * 0.04 } : {}), time, { x: 100 + (mode === "hunt" ? 60 : 600), y: 100 })));
        if (k % 10 === 0) { const a2 = logOf((c) => drawEnemies(c, W(mk(t, mode === "spawn" ? { invuln: true, invulnT: 1.2 - (k % 30) * 0.04 } : {}), time, { x: 100 + (mode === "hunt" ? 60 : 600), y: 100 }))); assert.deepEqual(a, a2, t + " deterministic"); assert.equal(count(a, /gradient|shadowBlur/i), 0); }
      }
      assert.ok(big <= (mode === "spawn" ? 28 : mk(t).r * 1.4 + 5), t + " " + mode + " reach " + big.toFixed(1));
    }
  } finally { Math.random = real; }
});
test("the walk bob, the feet and the lean share ONE phase (motion.js)", () => {
  const e = mk("walker"), ph = phaseOf("walker", e.home), m = FOE_M.walker;
  for (const time of [0.2, 0.31, 0.77, 1.4]) {
    const l = logOf((c) => drawEnemies(c, W(e, time))), tr = l.filter((x) => /^translate\(/.test(x));
    const dy = +tr[1].slice(tr[1].indexOf(",") + 1, -1) - e.r * 0.86, sin = Math.sin(m.bobW * time + ph * 6.283);
    assert.ok(Math.abs(dy - m.bobA * sin) < 0.02, "bob " + dy + " vs " + m.bobA * sin);
    const dx = +tr[1].slice(10, tr[1].indexOf(",")); assert.ok(Math.abs(dx - -sin) < 0.02, "lean 1 px on contact " + dx);
  }
});
test("PAUSE: the same frame at two different world times is identical (blinks, lean, spawn, flick, death all on the frozen clock)", () => {
  const cv = { width: 600, height: 520, getContext: () => rec() }, r = createRenderer(cv, { kind: "2d" });
  const w = createWorld(4242, 3); loadLevel(w, 3); w.state = "PLAY"; initFx();
  w.enemies.forEach((e, i) => { if (i % 2) { e.invuln = true; e.invulnT = 0.7; } });
  const p = w.players[0]; if (w.enemies[0]) { w.enemies[0].x = p.x + 60; w.enemies[0].y = p.y; w.enemies[0].hunt = true; w.enemies[0].invuln = false; }
  fxOf(w, "2d").feed([{ t: "kill", type: "knight", x: 200, y: 200, color: "#d4b05a" }], 5.02);
  w.time = 5; r.render(w, 1 / 60); w.time = 5.05; r.render(w, 1 / 60);
  w.state = "PAUSE";
  const draw = () => { r.ctx._log.length = 0; r.render(w, 1 / 60); return r.ctx._log.slice(); };
  w.time = 5.06; const a = draw(); w.time = 9.5; const b = draw(); w.time = 40; const c2 = draw();
  assert.deepEqual(a, b); assert.deepEqual(a, c2); assert.ok(a.length > 200);
});
test("blink: eyes squash to a slot on the live path, never in the static pose (3D atlas, ENEMIES page, tests)", () => {
  const e = mk("chaser"), ph = phaseOf("chaser", e.home);
  let tb = -1, to = -1;
  for (let k = 0; k < 4000 && (tb < 0 || to < 0); k++) { const t = k * 0.01, b = blinkAt("chaser", ph, t); if (b > 0.95 && tb < 0) tb = t; if (b === 0 && to < 0 && k > 3) to = t; }
  assert.ok(tb >= 0 && to >= 0, "a blink is scheduled");
  const open = logOf((c) => drawEnemies(c, W(e, to))), shut = logOf((c) => drawEnemies(c, W(e, tb)));
  assert.ok(count(shut, /^ellipse\(/) > count(open, /^ellipse\(/) + 0, "closed eye is drawn flat");
  assert.ok(count(shut, /^arc\(.*,7\.000\)$/) < count(open, /^arc\(.*,7\.000\)$/), "no iris, pupil or shine while shut");
  const still = TYPES.map((t) => { const d = { type: t, color: "#fff", r: 14, home: { x: 1, y: 1 }, invuln: false, dir: { x: 0, y: 1 }, speed: 0 }; return [0.3, tb, 1.9, 7.7].map((tm) => logOf((c) => drawEnemyBody(c, { time: tm }, d))); });
  for (const sets of still.filter((_, i) => !["walker", "stationary", "boomerang", "rocket", "burrow", "shade"].includes(TYPES[i]))) assert.deepEqual(sets[0], sets[1], "time-free static pose");
  for (const t of TYPES) for (const tm of [tb, 0.3, 1.9]) assert.equal(count(logOf((c) => drawEnemyBody(c, { time: tm }, { type: t, color: "#8affc1", r: 14, home: { x: 1, y: 1 }, invuln: false, dir: { x: 0, y: 1 } })), /^ellipse\(.*0\.0(0|1)\d\d,0\.000,/), 0, "no squashed eye w/o X");
});
test("hunters: leaning + glow + brow furrow only while a hunter is within 3 tiles; a flick when the range is entered", () => {
  for (const t of ["chaser", "fast", "knight"]) {
    const far = logOf((c) => drawEnemies(c, W(mk(t), 2, { x: 600, y: 100 }))), near = logOf((c) => drawEnemies(c, W(mk(t), 2, { x: 160, y: 100 })));
    assert.notDeepEqual(far, near, t); assert.ok(count(near, /^globalAlpha=0\.[1-9]/) > count(far, /^globalAlpha=0\.[1-9]/), t + " halo");
  }
  for (const t of ["walker", "stationary", "boomerang", "rocket", "burrow", "shade"]) {
    const e = () => mk(t, { hunt: false }); assert.deepEqual(logOf((c) => drawEnemies(c, W(e(), 2, { x: 600, y: 100 }))).length, logOf((c) => drawEnemies(c, W(e(), 2, { x: 160, y: 100 }))).length, t);
  }
  const e = mk("chaser"), furrow = (time, px) => { const tr = tracker(); drawEnemies(tr, W(e, time, { x: px, y: 100 })); return tr._b.y1; };
  furrow(1, 600); const flick = logOf((c) => drawEnemies(c, W(e, 1.1, { x: 150, y: 100 }))); const settled = logOf((c) => drawEnemies(c, W(e, 1.1 + 0.4, { x: 150, y: 100 })));
  assert.notDeepEqual(flick, settled, "the flick settles");
});
test("sentry: shell, vents and lens breathe on one clock; the lens core sweeps", () => {
  const at = (t) => logOf((c) => drawEnemies(c, W(mk("stationary", { speed: 0 }), t)));
  const up = Math.PI / 6, dn = (3 * Math.PI) / 2 / 3;
  const a = at(up), b = at(dn), arcs = (l) => l.filter((x) => /^arc\(/.test(x));
  assert.notDeepEqual(arcs(a), arcs(b), "vent arcs move with the shell");
  const core = (t) => at(t).filter((x) => /^ellipse\(/.test(x) || /^arc\(/.test(x));
  assert.notDeepEqual(core(0.4), core(1.9));
});
test("rocket: the flame is two smooth alpha layers (no binary colour step) and the body vibrates", () => {
  const l = (t) => logOf((c) => drawEnemies(c, W(mk("rocket"), t)));
  const alphas = []; for (let k = 0; k < 90; k++) { const x = l(2 + k / 60).filter((s) => /^globalAlpha=0\.\d+$/.test(s)).map((s) => +s.slice(12)); alphas.push(x); }
  const flame = alphas.map((a) => a[a.length - 1]); let mx = 0; for (let i = 1; i < flame.length; i++) mx = Math.max(mx, Math.abs(flame[i] - flame[i - 1]));
  assert.ok(mx < 0.25, "frame-to-frame alpha step " + mx);
  assert.equal(count(l(2), /fillStyle=#(ff7a3a|ffb347|ffde7a|fff3b0)/), 4, "only the existing flame hexes");
});
test("boomerang tilt eases toward travel instead of snapping when dir flips", () => {
  const e = mk("boomerang", { dir: { x: 1, y: 0 } }), w = W(e, 1);
  const ox = (t) => { w.time = t; const tr = logOf((c) => drawEnemies(c, w)).filter((x) => /^translate\(/.test(x)); return +tr[1].slice(10, tr[1].indexOf(",")); };
  ox(1); const before = ox(1.05); e.dir = { x: -1, y: 0 }; const xs = []; for (let k = 1; k <= 24; k++) xs.push(ox(1.05 + k / 60));
  assert.ok(before > 1.2, "leans toward travel " + before);
  assert.ok(Math.abs(xs[0] - before) < 1.6 * 0.4, "first frame after the flip has not snapped " + xs[0]);
  assert.ok(xs[23] < -1.2, "and arrives " + xs[23]);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] <= xs[i - 1] + 1e-9, "monotone");
});
test("shade: hem wave and knight plume sway are live-only", () => {
  for (const t of ["shade", "knight"]) {
    const live = (tm) => logOf((c) => drawEnemies(c, W(mk(t), tm)));
    assert.notDeepEqual(live(1).filter((x) => /^(moveTo|lineTo|quadraticCurveTo)/.test(x)), live(2.2).filter((x) => /^(moveTo|lineTo|quadraticCurveTo)/.test(x)), t);
    const still = (tm) => logOf((c) => drawEnemyBody(c, { time: tm }, { type: t, color: "#fff", r: 14, home: { x: 1, y: 1 }, invuln: false, dir: { x: 0, y: 1 } })).filter((x) => /^(moveTo|lineTo|quadraticCurveTo)/.test(x));
    assert.deepEqual(still(1), still(2.2), t + " static contour");
  }
});
test("spawn: pops 0.4 -> ~1.1 -> 1 with a floor ring, no 12 Hz alpha strobe, and longer heat invuln still pops once", () => {
  for (const total of [1.2, 1.4, 1.6]) {
    const e = mk("walker", { invuln: true, invulnT: total }); let prev = null, mxa = 0, minSc = 9, maxSc = 0, rings = 0;
    for (let k = 0; k <= Math.round(total * 60) + 4; k++) {
      e.invulnT = Math.max(0, total - k / 60); e.invuln = e.invulnT > 0; const w = W(e, 4 + k / 60);
      const l = logOf((c) => drawEnemies(c, w)), sc = l.find((x) => /^scale\(/.test(x));
      if (sc) { const v = +sc.slice(6).split(",")[0]; minSc = Math.min(minSc, v); maxSc = Math.max(maxSc, v); }
      const ti = l.findIndex((x) => /^translate\(0\.000,-/.test(x));
      if (l.slice(0, ti).some((x) => /^lineWidth=2/.test(x))) rings++;
      const first = +l.slice(ti).find((x) => /^globalAlpha=/.test(x)).slice(12);
      if (prev != null) mxa = Math.max(mxa, Math.abs(first - prev)); prev = first;
    }
    assert.ok(minSc < 0.55 && maxSc > 1.05 && maxSc < 1.2, total + " scale " + minSc + ".." + maxSc);
    assert.ok(mxa < 0.2, total + " alpha step " + mxa); assert.ok(rings > 3 && rings < 30, "ring " + rings);
  }
});
test("death: a kill event becomes a ghost that squashes wide and low, flashes white once (tint under REDUCE FLASH), then is gone at 0.35 s", () => {
  const w = W(mk("walker"), 5); w.enemies[0].dead = true;
  fxOf(w, "2d").feed([{ t: "kill", type: "walker", x: 100, y: 100, color: "#8affc1" }], 5);
  const at = (age) => { w.time = 5 + age; return logOf((c) => drawEnemies(c, w)); };
  const w0 = (age) => { const tr = tracker(); w.time = 5 + age; drawEnemies(tr, w); return tr._b; };
  const a0 = at(0), a1 = at(0.1);
  assert.ok(count(a0, /^fillStyle=#ffffff$/) > count(a1, /^fillStyle=#ffffff$/), "one white frame");
  setFxOpts({ flashK: 0 });
  try { assert.ok(count(at(0), /^fillStyle=#ffffff$/) < count(a0, /^fillStyle=#ffffff$/), "REDUCE FLASH: a tint, not white"); } finally { setFxOpts({ flashK: 1 }); }
  const b1 = w0(0.1), b2 = w0(0.25); assert.ok((b1.x1 - b1.x0) / (b1.y1 - b1.y0) > 1.2, "wide and low"); assert.ok(b2.x1 - b2.x0 < b1.x1 - b1.x0, "shrinks away");
  assert.equal(count(at(MOTION.DEATH_T + 0.01), /^fill\(/), 0, "finished: nothing is drawn");
});
