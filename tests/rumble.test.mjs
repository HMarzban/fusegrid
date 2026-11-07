import test from "node:test";
import assert from "node:assert/strict";
import { LIMITS, PATTERNS, SCALE, chainSteps, createRumble, padInfo, routesOf, scaleMag, stepsAt } from "../src/app/rumble.js";
import { createDemobot } from "../src/app/demobot.js";
import { CFG } from "../src/core/config.js";
import { createWorld, loadLevel, step } from "../src/core/sim.js";

const actuator = (calls, o = {}) => ({
  ...(o.effects === undefined ? {} : { effects: o.effects }),
  ...(o.type === undefined ? {} : { type: o.type }),
  playEffect: (type, p) => { if (o.throws) throw new Error("x"); calls.push({ type, p }); return o.reject ? Promise.reject(new Error("x")) : Promise.resolve("complete"); },
  reset: () => { calls.push({ type: "reset" }); if (o.throws) throw new Error("y"); return o.reject ? Promise.reject(new Error("y")) : Promise.resolve("complete"); },
});
const rig = (o = {}) => {
  const calls = [];
  const pad = o.pad !== undefined ? o.pad : { vibrationActuator: actuator(calls, o) };
  const opts = { level: o.level ?? 3, playing: o.playing ?? true, st: o.st ?? "PLAY", pad };
  const r = createRumble({ level: () => opts.level, gamepad: () => opts.pad, playing: () => opts.playing, state: () => opts.st });
  return { r, calls, opts };
};
const P = { x: 100, y: 100 };
const HIGH = 3, MEDIUM = 2, LOW = 1;
const FRAME = 1000 / 60;
/* A late frame shortens its step (absolute deadlines): the call is never longer than authored and never shorter by more than the frame that was late. */
const near = (got, want) => got.length === want.length && got.every((d, i) => d <= want[i] + 1e-9 && d > want[i] - FRAME - 1e-9);
const plays = (calls) => calls.filter((c) => c.type !== "reset");
/* Runs the rAF from t for ms; returns the end time. */
const run = (r, t, ms) => { const e = t + ms; for (let x = t; x <= e; x += FRAME) r.tick(x); return e; };
const NAMES = ["lose", "hurt", "win", "shield", "close", "near", "plant", "test", "launch", "enter", "hello", "deny", "confirm", "back", "move"];
const CHAINS = [2, 3, 4, 5, 6].flatMap((n) => [false, true].map((far) => chainSteps(n, far)));
const sets = () => [...NAMES.flatMap((n) => [LOW, MEDIUM, HIGH].map((v) => stepsAt(n, v))), ...CHAINS];
const lenOf = (st) => st.reduce((a, x) => a + (x.gap || x.ms), 0);
const pulses = (st) => { const out = []; let run = 0; for (const x of st) { if (x.gap) { if (run) out.push(run); run = 0; } else run += x.ms; } if (run) out.push(run); return out; };

test("every pattern, computed from the table: within 500 ms and 3 pulses, gaps at least 80, a pulse at most 300", () => {
  for (const st of sets()) {
    assert.ok(lenOf(st) <= 500 && lenOf(st) > 0, JSON.stringify(st));
    assert.ok(pulses(st).length <= 3 && pulses(st).length >= 1, JSON.stringify(st));
    assert.ok(pulses(st).every((m) => m <= 300), JSON.stringify(st));
    assert.ok(st.every((x) => !x.gap || x.gap >= 80), JSON.stringify(st));
    assert.ok(st[0].gap === undefined && st.at(-1).gap === undefined, "starts and ends on a step");
    assert.ok(st.filter((x) => !x.gap).every((x) => x.ms >= 60), "a motor cannot start inside a shorter step");
  }
  assert.deepEqual(NAMES.map((n) => lenOf(PATTERNS[n].steps)), [500, 300, 500, 220, 230, 80, 60, 160, 250, 90, 120, 200, 70, 70, 60]);
});
test("LOW keeps two pulses at most; only the win needed thinning", () => {
  for (const n of NAMES) assert.ok(pulses(stepsAt(n, LOW)).length <= LIMITS.perSec[LOW], n);
  assert.deepEqual(pulses(stepsAt("win", LOW)), [90, 160]);
  assert.deepEqual(pulses(stepsAt("win", MEDIUM)), [90, 90, 160]);
  assert.deepEqual(pulses(stepsAt("lose", LOW)), [300, 120]);
});
test("above 0.7 only for hurt, lose and close", () => {
  for (const [n, pat] of Object.entries(PATTERNS)) {
    if (n === "hurt" || n === "lose" || n === "close") continue;
    for (const x of pat.steps) assert.ok(!x.ms || Math.max(x.weak, x.strong) <= LIMITS.peak, n);
  }
  for (const st of CHAINS) for (const x of st) assert.ok(!x.ms || Math.max(x.weak, x.strong) <= LIMITS.peak);
});
const close = (a, b) => Math.abs(a - b) < 1e-9;
test("level scale, floor and knee: unchanged from 0.5 up, below it spread over 0.35..0.5, LOW capped at its old top 0.40, levels never merge, a silent motor stays silent", () => {
  assert.deepEqual([...SCALE], [0, 0.4, 0.75, 1]);
  assert.equal(LIMITS.knee, 0.5);
  const old = (m, v) => Math.min(1, Math.max(0.35, m * SCALE[v]));
  for (const st of sets()) for (const x of st) {
    if (x.gap) continue;
    for (const m of [x.weak, x.strong]) {
      if (!(m > 0)) { assert.equal(scaleMag(m, HIGH), 0); continue; }
      const [l, md, h] = [LOW, MEDIUM, HIGH].map((v) => scaleMag(m, v));
      assert.ok(l >= 0.35 && h <= 1 && l < md && md < h, m + ": " + [l, md, h]);
      assert.ok(l <= SCALE[LOW], "LOW " + m + " " + l);
      for (const v of [LOW, MEDIUM, HIGH]) if (m * SCALE[v] >= 0.5) assert.equal(scaleMag(m, v), old(m, v), "from the knee up nothing moved");
    }
  }
  assert.equal(scaleMag(1, MEDIUM), 0.75);
  assert.equal(scaleMag(1, HIGH), 1);
  assert.equal(scaleMag(0.5, HIGH), 0.5);
  assert.ok(scaleMag(1, LOW) === 0.4 && close(scaleMag(0.4, LOW), 0.398) && close(scaleMag(0.4, HIGH), 0.47) && close(scaleMag(0.4, MEDIUM), 0.44) && close(scaleMag(1e-9, HIGH), 0.35));
  assert.ok(Math.abs(scaleMag(0.4999999, HIGH) - 0.5) < 1e-6, "no step at the knee");
});
test("the steps: one call a step, a step running into another covers the late rAF, one before a gap or the end is exact, none over 334 ms", () => {
  for (const [t, name] of [["lose", "lose"], ["hurt", "hurt"], ["win", "win"], ["bomb", "plant"]]) {
    const { r, calls } = rig();
    r.feed([{ t }], 0, P, 3);
    run(r, 0, 800);
    const st = PATTERNS[name].steps, want = st.flatMap((x, i) => (x.gap ? [] : [x.ms + (st[i + 1] && !st[i + 1].gap ? LIMITS.over : 0)]));
    assert.ok(near(plays(calls).map((c) => c.p.duration), want), name + " " + plays(calls).map((c) => c.p.duration));
    assert.ok(plays(calls).every((c) => c.p.duration <= LIMITS.callMs && c.p.startDelay === 0));
  }
});
test("a gap issues nothing, and the next step waits it out, measured from the frames", () => {
  const { r, calls } = rig();
  const at = [];
  const o = calls.push.bind(calls);
  let now = 0;
  calls.push = (c) => { at.push(now); return o(c); };
  r.feed([{ t: "lose" }], 0, P, 0);
  for (now = 0; now < 800; now += FRAME) r.tick(now);
  assert.equal(at.length, 2);
  assert.ok(at[1] - at[0] >= 300 + 80, String(at));
});
test("each trigger plays its pattern; a boom needs a player", () => {
  for (const [ev, k] of [[{ t: "hurt" }, "hurt"], [{ t: "lose" }, "lose"], [{ t: "win" }, "win"], [{ t: "bomb", x: 900, y: 900 }, "plant"], [{ t: "boom", x: 180, y: 100 }, "near"], [{ t: "boom", x: 100, y: 100 }, "close"]]) {
    const { r, calls } = rig();
    r.feed([ev], 0, P);
    assert.equal(calls.length, 1, k);
    assert.equal(calls[0].type, "dual-rumble");
    const x = PATTERNS[k].steps[0];
    assert.deepEqual([calls[0].p.strongMagnitude, calls[0].p.weakMagnitude], [scaleMag(x.strong, HIGH), scaleMag(x.weak, HIGH)], k);
  }
  const { r, calls } = rig();
  r.feed([{ t: "boom", x: 100, y: 100 }], 0, null);
  assert.equal(calls.length, 0);
});
test("no buzz for what sound and art carry", () => {
  const { r, calls } = rig();
  r.feed(["kill", "pickup", "power", "kick", "brick", "reveal", "warp", "plate", "bloom", "remote", "fuse"].map((t) => ({ t, x: 100, y: 100 })), 0, P);
  assert.equal(calls.length, 0);
});
test("boom distance: silent past 3 tiles, near to 3, close to 1", () => {
  const T = CFG.TILE;
  const one = (dx) => { const { r, calls } = rig(); r.feed([{ t: "boom", x: 100 + dx, y: 100 }], 0, P); return calls[0]; };
  assert.equal(one(3 * T + 1), undefined);
  assert.equal(one(3 * T).p.duration, 80);
  assert.equal(one(T + 1).p.duration, 80);
  assert.equal(one(T).p.duration, 110 + LIMITS.over);
});
test("hurt and SHIELD are told apart by the lives", () => {
  const shield = rig(), hurt = rig();
  shield.r.feed([], 0, P, 3);
  shield.r.feed([{ t: "hurt" }], 16, P, 3);
  run(shield.r, 16, 600);
  assert.ok(near(plays(shield.calls).map((c) => c.p.duration), [70, 70]));
  assert.ok(plays(shield.calls).every((c) => c.p.strongMagnitude === 0));
  hurt.r.feed([], 0, P, 3);
  hurt.r.feed([{ t: "hurt" }], 16, P, 2);
  run(hurt.r, 16, 600);
  assert.ok(near(plays(hurt.calls).map((c) => c.p.duration), [180 + LIMITS.over, 120]), String(plays(hurt.calls).map((c) => c.p.duration)));
  assert.equal(hurt.calls[0].p.strongMagnitude, 1);
  const gated = rig({ playing: false });
  gated.r.feed([], 0, P, 3);
  gated.r.feed([], 8, P, 2);
  gated.opts.playing = true;
  gated.r.feed([{ t: "hurt" }], 16, P, 2);
  assert.equal(gated.calls[0].p.duration, 70, "lives seen behind a gate still count: the new life count is the baseline");
});
test("priority: the higher replaces at once, the same or lower is dropped and never queued", () => {
  const up = rig();
  up.r.feed([{ t: "bomb" }], 0, P, 3);
  up.r.feed([{ t: "lose" }], 10, P, 0);
  assert.equal(plays(up.calls).length, 2, "lose over a plant, at once");
  const down = rig();
  down.r.feed([{ t: "lose" }], 0, P, 0);
  down.r.feed([{ t: "hurt" }], 10, P, 0);
  down.r.feed([{ t: "bomb" }], 20, P, 0);
  assert.equal(plays(down.calls).length, 1);
  run(down.r, 20, 1500);
  assert.equal(plays(down.calls).length, 2, "the rest of the lose, nothing queued");
  const same = rig();
  same.r.feed([{ t: "hurt" }], 0, P, 2);
  same.r.feed([{ t: "hurt" }], 10, P, 1);
  assert.equal(plays(same.calls).length, 1);
  run(same.r, 10, 300);
  assert.equal(plays(same.calls).length, 2);
});
test("strongest wins in a feed, and a win now outranks close", () => {
  for (const [evs, k] of [
    [[{ t: "bomb" }, { t: "hurt" }, { t: "lose" }], "lose"],
    [[{ t: "boom", x: 100, y: 100 }, { t: "hurt" }, { t: "bomb" }], "hurt"],
    [[{ t: "bomb" }, { t: "boom", x: 180, y: 100 }], "near"],
    [[{ t: "win" }, { t: "boom", x: 100, y: 100 }], "win"],
  ]) {
    const { r, calls } = rig();
    r.feed(evs, 0, P);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].p.weakMagnitude, scaleMag(PATTERNS[k].steps[0].weak, HIGH), k);
  }
});
test("chain: booms in one feed or within 250 ms build it, anywhere on the board; past 3 tiles is x 0.7", () => {
  const FARX = 100 + 8 * CFG.TILE;
  const a = rig();
  a.r.feed([{ t: "boom", x: 100, y: 100 }, { t: "boom", x: 100, y: 100 }], 0, P);
  run(a.r, 0, 700);
  assert.ok(near(plays(a.calls).map((c) => c.p.duration), [70 + 34, 70 + 34, 120]), String(plays(a.calls).map((c) => c.p.duration)));
  assert.equal(a.calls[0].p.weakMagnitude, 0.6);
  const f = rig();
  f.r.feed([{ t: "boom", x: FARX, y: 100 }], 0, P);
  assert.equal(plays(f.calls).length, 0, "one far boom says nothing");
  f.r.feed([{ t: "boom", x: FARX, y: 100 }], 200, P);
  assert.ok(Math.abs(f.calls[0].p.weakMagnitude - scaleMag(0.6 * 0.7, HIGH)) < 1e-9, "two far booms in the window do");
  const late = rig();
  late.r.feed([{ t: "boom", x: FARX, y: 100 }], 0, P);
  late.r.feed([{ t: "boom", x: FARX, y: 100 }], 251, P);
  assert.equal(plays(late.calls).length, 0, "outside the window it starts over");
  const up = rig();
  up.r.feed([{ t: "boom", x: 180, y: 100 }], 0, P);
  up.r.feed([{ t: "boom", x: 180, y: 100 }], 40, P);
  assert.equal(up.calls[1].p.duration, 70 + 34, "a chain replaces the near tick at once");
});
test("chain build-up: a later boom raises n and rebuilds the rest from the current step, and n reads in the length", () => {
  const lens = [2, 3, 4].map((n) => {
    const { r, calls } = rig();
    r.feed(Array.from({ length: n }, () => ({ t: "boom", x: 100, y: 100 })), 0, P);
    run(r, 0, 900);
    return plays(calls).length;
  });
  assert.deepEqual(lens, [3, 4, 5]);
  assert.deepEqual([2, 3, 4].map((n) => lenOf(chainSteps(n))), [260, 410, 480]);
  const { r, calls } = rig();
  r.feed([{ t: "boom", x: 100, y: 100 }, { t: "boom", x: 100, y: 100 }], 0, P);
  let t = run(r, 0, 80);
  const was = plays(calls).length;
  r.feed([{ t: "boom", x: 100, y: 100 }], t, P);
  assert.equal(plays(calls).length, was, "the running step is not replaced");
  run(r, t, 900);
  assert.equal(plays(calls).length, 4, "and one more hit plays");
});
test("chain merge in the gap: a boom while the motor rests still adds a hit", () => {
  const { r, calls } = rig();
  const BOOM = { t: "boom", x: 100, y: 100 };
  r.feed([BOOM, BOOM], 0, P);
  let t = run(r, 0, 90);
  r.feed([BOOM], t, P);
  t = run(r, t, 170);
  assert.equal(plays(calls).length, 3, "three hits played, the tail waits behind its gap");
  r.feed([BOOM], t, P);
  run(r, t, 900);
  assert.ok(near(plays(calls).map((c) => c.p.duration), [104, 104, 70, 104, 120]), "then the new hit runs into the tail " + plays(calls).map((c) => c.p.duration));
});
test("sweep: booms landing anywhere while a chain's motor runs keep one pattern inside every limit", () => {
  let seed = 7;
  const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let round = 0; round < 400; round++) {
    const { r, calls } = rig();
    const on = [];
    const o = calls.push.bind(calls);
    let t = 0;
    calls.push = (c) => { if (c.type !== "reset") { if (on.length) on.at(-1).b = Math.min(on.at(-1).b, t); on.push({ a: t, b: t + c.p.duration }); } return o(c); };
    r.feed([{ t: "boom", x: 100, y: 100 }, { t: "boom", x: 100, y: 100 }], 0, P);
    r.tick(0);
    let last = 0;
    for (t = FRAME; t < 900; t += FRAME) {
      /* The motor is on and within the window: a merge, never a fresh pattern. */
      if (t < on.at(-1).b - FRAME && t - last <= LIMITS.chainWin && rnd() < 0.12) { r.feed(Array.from({ length: 1 + (rnd() * 2 | 0) }, () => ({ t: "boom", x: 100, y: 100 })), t, P); last = t; }
      r.tick(t);
    }
    assert.ok(on.every((e) => e.b - e.a <= LIMITS.callMs), "call length");
    const runs = [];
    for (const e of on) { const q = runs.at(-1); if (q && e.a <= q.b + 0.001) q.b = Math.max(q.b, e.b); else runs.push({ ...e }); }
    const SLACK = 6 * FRAME; // late frames stretch a step; that is what the rAF gives, and it cannot be proved away
    assert.ok(runs.length <= LIMITS.pulses, "pulses " + JSON.stringify(runs));
    assert.ok(runs.every((q) => q.b - q.a <= LIMITS.pulseMs + SLACK), "pulse " + JSON.stringify(runs));
    assert.ok(runs.at(-1).b - runs[0].a <= LIMITS.patMs + SLACK, "length " + JSON.stringify(runs));
    for (let i = 1; i < runs.length; i++) assert.ok(runs[i].a - runs[i - 1].b >= LIMITS.gap - LIMITS.over - 0.01, "gap " + JSON.stringify(runs));
  }
});
test("repetition: on-time at most 50 % in any 1 s and at most 4 pulses a second (2 at LOW), hurt and lose excepted", () => {
  for (const level of [LOW, MEDIUM, HIGH]) {
    let seed = 11 + level;
    const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    const { r, calls } = rig({ level });
    const on = [];
    const o = calls.push.bind(calls);
    let t = 0;
    calls.push = (c) => { if (c.type !== "reset") { if (on.length) on.at(-1).b = Math.min(on.at(-1).b, t); on.push({ a: t, b: t + c.p.duration }); } return o(c); };
    const END = 30000, EV = [[{ t: "bomb" }], [{ t: "boom", x: 180, y: 100 }], [{ t: "boom", x: 100, y: 100 }], [{ t: "win" }], [{ t: "boom", x: 100, y: 100 }, { t: "boom", x: 100, y: 100 }, { t: "boom", x: 100, y: 100 }], [{ t: "hurt" }]];
    let lives = 3;
    for (; t < END; t += FRAME) {
      if (rnd() < 0.2) r.feed(EV[rnd() * EV.length | 0], t, P, lives);
      else r.feed([], t, P, lives);
      r.tick(t);
    }
    const runs = [];
    for (const e of on) { const q = runs.at(-1); if (q && e.a <= q.b + FRAME) q.b = Math.max(q.b, e.b); else runs.push({ ...e }); }
    for (let w = 0; w < END - 1000; w += 50) {
      const sum = runs.reduce((a, q) => a + Math.max(0, Math.min(q.b, w + 1000) - Math.max(q.a, w)), 0);
      assert.ok(sum <= 500, "level " + level + " window " + w + " on " + sum);
      assert.ok(runs.filter((q) => q.a >= w && q.a < w + 1000).length <= LIMITS.perSec[level], "level " + level + " window " + w);
    }
    const hurt = rig({ level });
    hurt.r.feed([], 0, P, 3);
    for (let i = 0, l = 3; i < 4; i++) { hurt.r.feed([{ t: "hurt" }], i * 310, P, --l + 10); hurt.r.tick(i * 310); }
    assert.ok(plays(hurt.calls).length >= 2);
  }
  const ex = rig({ level: LOW });
  ex.r.feed([], 0, P, 9);
  ex.r.feed([{ t: "lose" }], 1, P, 8);
  run(ex.r, 1, 490);
  run(ex.r, 491, 300);
  ex.r.feed([{ t: "hurt" }], 800, P, 7);
  assert.equal(ex.calls.at(-1).p.duration, 180 + 34, "a hurt may break the limit");
});
test("the near and plant budget: 900 ms in a rolling 10 s, and it recovers", () => {
  const { r, calls } = rig();
  let t = 0;
  for (; t < 9000; t += 400) { r.feed([{ t: "bomb" }], t, P, 3); run(r, t, 100); }
  assert.equal(plays(calls).length, 15, "15 x 60 ms is the 900");
  r.feed([{ t: "boom", x: 180, y: 100 }], t + 200, P, 3);
  assert.equal(plays(calls).length, 15, "a near tick is over it too");
  r.feed([{ t: "hurt" }], t + 300, P, 2);
  assert.equal(plays(calls).length, 16, "a hit is not on this budget");
  run(r, t + 300, 400);
  const n = plays(calls).length;
  r.feed([{ t: "bomb" }], 12000, P, 2);
  assert.equal(plays(calls).length, n + 1, "and it recovers");
});
test("LOW drops plant, near and the menu ticks, and keeps the rest", () => {
  const { r, calls, opts } = rig({ level: LOW });
  r.feed([{ t: "bomb" }], 0, P, 3);
  r.feed([{ t: "boom", x: 180, y: 100 }], 2000, P, 3);
  assert.equal(r.menu("move", 4000), false);
  assert.equal(r.menu("confirm", 6000), false);
  assert.equal(calls.length, 0);
  r.feed([{ t: "boom", x: 100, y: 100 }], 8000, P, 3);
  assert.equal(calls.length, 1, "close stays");
  assert.ok(close(calls[0].p.strongMagnitude, scaleMag(0.9, LOW)) && close(calls[0].p.weakMagnitude, scaleMag(0.6, LOW)) && calls[0].p.strongMagnitude <= 0.4);
  run(r, 8000, 400);
  opts.level = MEDIUM;
  assert.equal(r.menu("move", 10000), true);
});
test("OFF means zero calls, on every route and every path, with a counting fake", () => {
  let n = 0;
  const pad = { vibrationActuator: { effects: ["dual-rumble", "trigger-rumble"], playEffect: () => { n++; return Promise.resolve(); }, reset: () => { n++; return Promise.resolve(); } }, hapticActuators: [{ pulse: () => { n++; return Promise.resolve(true); } }] };
  const { r } = rig({ pad, level: 0 });
  assert.equal(r.test(0), false);
  assert.equal(r.menu("confirm", 0), false);
  assert.equal(r.menu("move", 0), false);
  for (let t = 0; t < 3000; t += FRAME) {
    r.feed([{ t: "hurt" }, { t: "lose" }, { t: "win" }, { t: "bomb" }, { t: "boom", x: 100, y: 100 }, { t: "boom", x: 100, y: 100 }], t, P, 3);
    r.tick(t);
  }
  assert.equal(n, 0);
});
test("entering OFF cancels the pending steps and resets once", () => {
  const { r, calls, opts } = rig();
  r.feed([{ t: "lose" }], 0, P, 0);
  opts.level = 0;
  r.tick(10);
  assert.equal(calls.filter((c) => c.type === "reset").length, 1);
  const n = calls.length;
  run(r, 10, 1500);
  assert.equal(calls.length, n);
});
test("PAUSE, hiding, leaving GAME and the pad going all end a pattern within one tick; nothing resumes", () => {
  for (const cut of [(o) => { o.st = "PAUSE"; }, (o) => { o.playing = false; }]) {
    const { r, calls, opts } = rig({ st: "LOSE" });
    r.feed([{ t: "lose" }], 0, P, 0);
    cut(opts);
    r.tick(FRAME);
    assert.equal(calls.at(-1).type, "reset");
    const n = calls.length;
    opts.st = "PLAY"; opts.playing = true;
    run(r, FRAME, 1500);
    assert.equal(calls.length, n, "nothing resumes");
  }
  const { r, calls, opts } = rig();
  r.feed([{ t: "lose" }], 0, P, 0);
  opts.pad = null;
  r.tick(FRAME);
  opts.pad = { vibrationActuator: actuator(calls) };
  run(r, FRAME, 1500);
  assert.equal(plays(calls).length, 1, "a pad gone ends it");
  const plain = rig();
  plain.r.feed([{ t: "bomb" }], 0, P, 3);
  plain.opts.st = "PAUSE";
  plain.r.tick(FRAME);
  assert.equal(plain.calls.at(-1).type, "reset", "even the last running step");
});
test("win and lose keep stepping past PLAY and stop when the state returns to PLAY", () => {
  const { r, calls, opts } = rig({ st: "WIN" });
  r.feed([{ t: "win" }], 0, P, 3);
  let t = run(r, 0, 200);
  assert.equal(plays(calls).length, 2);
  opts.st = "PLAY";
  r.tick(t + FRAME);
  assert.equal(calls.at(-1).type, "reset");
  run(r, t + FRAME, 800);
  assert.equal(plays(calls).length, 2);
  const whole = rig({ st: "LOSE" });
  whole.r.feed([{ t: "lose" }], 0, P, 0);
  run(whole.r, 0, 800);
  assert.equal(plays(whole.calls).length, 2);
});
test("the state gate at the feed: PAUSE and a non-playing shell are silent; a feed that flipped the state still plays", () => {
  const off = rig({ playing: false });
  off.r.feed([{ t: "lose" }], 0, P);
  assert.equal(off.calls.length, 0);
  const pz = rig({ st: "PAUSE" });
  pz.r.feed([{ t: "hurt" }, { t: "lose" }], 0, P);
  assert.equal(pz.calls.length, 0);
  for (const [st, t] of [["WIN", "win"], ["LOSE", "lose"]]) {
    const { r, calls } = rig({ st });
    r.feed([{ t }], 0, P);
    assert.equal(calls.length, 1, st);
    run(r, 0, 800);
    const n = calls.length;
    r.feed([{ t: "boom", x: 100, y: 100 }, { t: "bomb" }, { t: "hurt" }], 5000, P);
    assert.equal(calls.length, n, st + " with no flip in the feed is not PLAY");
  }
});
test("the test pulse plays at the selected level, past the shell and state gates", () => {
  for (const [level, m] of [[LOW, 0.4], [MEDIUM, 0.7 * 0.75], [HIGH, 0.7]]) {
    const { r, calls } = rig({ level, playing: false, st: "PAUSE" });
    assert.equal(r.test(0), true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].p.duration, 160);
    assert.ok(Math.abs(calls[0].p.strongMagnitude - m) < 1e-9 && Math.abs(calls[0].p.weakMagnitude - m) < 1e-9, String(level));
  }
});
test("menu ticks: single short steps on any screen, under the test pulse", () => {
  const { r, calls } = rig({ playing: false, st: "PLAY", level: MEDIUM });
  assert.equal(r.menu("move", 0), true);
  assert.equal(calls[0].p.duration, 60);
  assert.equal(r.menu("move", 30), false, "the running one is not cut");
  assert.equal(r.menu("confirm", 30), true, "a confirm outranks a move");
  assert.equal(r.test(40), true);
  assert.equal(r.menu("confirm", 60), false, "a test pulse is never cut by a tick");
  assert.equal(r.menu("confirm", 400), true);
  assert.equal(calls.at(-1).p.duration, 70);
});
test("the demobot's trace on a stub: the motor is on at most 8 % of PLAY", () => {
  const out = [];
  for (const [seed, room] of [[11, 1], [22, 2], [33, 3], [44, 4], [55, 5]]) {
    const calls = [];
    let w = createWorld(seed, 1), t = 0, play = 0;
    w.heat = 0; w.pact = 0;
    loadLevel(w, room, false);
    w.state = "PLAY";
    const bot = createDemobot(seed);
    const on = [];
    const pad = { vibrationActuator: { playEffect: (_, p) => { if (on.length) on.at(-1).b = Math.min(on.at(-1).b, t); on.push({ a: t, b: t + p.duration }); calls.push(p); return Promise.resolve(); }, reset: () => Promise.resolve() } };
    const r = createRumble({ level: () => HIGH, gamepad: () => pad, playing: () => true, state: () => w.state });
    while (play < 120000) {
      w.events.length = 0;
      step(w, CFG.STEP, { 0: bot.intent(w) });
      t += CFG.STEP * 1000; play += CFG.STEP * 1000;
      r.feed(w.events, t, w.players[0], w.lives);
      r.tick(t);
      if (w.state !== "PLAY") { for (let x = 0; x < 60; x++) { t += FRAME; r.tick(t); } loadLevel(w, room, false); w.state = "PLAY"; w.lives = 3; }
    }
    const ms = on.reduce((a, e) => a + e.b - e.a, 0);
    out.push(ms / t);
    assert.ok(calls.length > 0);
  }
  const worst = Math.max(...out);
  console.log("  demobot motor-on share per seed: " + out.map((x) => (x * 100).toFixed(1) + "%").join(" "));
  assert.ok(worst <= 0.08, "worst " + worst);
});
test("dual-rumble comes first, also when trigger-rumble and hapticActuators exist", () => {
  const calls = [], pulses = [];
  const pad = { vibrationActuator: actuator(calls, { effects: ["trigger-rumble", "dual-rumble"] }), hapticActuators: [{ pulse: (v, d) => { pulses.push([v, d]); return Promise.resolve(true); } }] };
  const { r } = rig({ pad });
  r.feed([{ t: "hurt" }], 0, P);
  assert.deepEqual(calls.map((c) => c.type), ["dual-rumble"]);
  assert.equal(pulses.length, 0);
});
test("trigger-rumble only when dual-rumble is unavailable, driving the triggers", () => {
  const calls = [];
  const { r } = rig({ pad: { vibrationActuator: actuator(calls, { effects: ["trigger-rumble"] }) } });
  assert.equal(r.supported(), true);
  r.feed([{ t: "hurt" }], 0, P);
  assert.equal(calls[0].type, "trigger-rumble");
  assert.deepEqual([calls[0].p.duration, calls[0].p.leftTrigger, calls[0].p.rightTrigger], [180 + LIMITS.over, 1, 1]);
});
test("the older .type is read when effects is absent", () => {
  const calls = [];
  const dual = rig({ pad: { vibrationActuator: actuator(calls, { type: "dual-rumble" }) } });
  dual.r.feed([{ t: "win" }], 0, P);
  assert.equal(calls.at(-1).type, "dual-rumble");
  const trig = rig({ pad: { vibrationActuator: actuator(calls, { type: "trigger-rumble" }) } });
  trig.r.feed([{ t: "win" }], 0, P);
  assert.equal(calls.at(-1).type, "trigger-rumble");
  assert.equal(calls.length, 2);
  assert.equal(rig({ pad: { vibrationActuator: actuator([], { type: "vibration" }) } }).r.supported(), false);
});
test("hapticActuators[0].pulse is the last path: the stronger motor's value, the row's ms", () => {
  const pulses = [];
  const pad = { vibrationActuator: null, hapticActuators: [{ pulse: (v, d) => { pulses.push([v, d]); return Promise.resolve(true); } }, { pulse: () => { throw new Error("only [0]"); } }] };
  const { r } = rig({ pad });
  assert.equal(r.supported(), true);
  r.feed([{ t: "hurt" }], 0, P);
  r.tick(180);
  assert.deepEqual(pulses, [[1, 180 + LIMITS.over], [0.5, 120]]);
  r.tick(300);
  r.stop();
  assert.equal(pulses.at(-1)[0], 0, "its only stop is a zero pulse");
  const also = rig({ pad: { vibrationActuator: actuator([], { effects: [] }), hapticActuators: pad.hapticActuators } });
  also.r.feed([{ t: "hurt" }], 0, P);
  assert.deepEqual(pulses.at(-1), [1, 180 + LIMITS.over], "an actuator with no usable effect falls to the pulse");
});
test("honest supported(): nothing to buzz reads false and is inert", () => {
  for (const pad of [null, {}, { vibrationActuator: null }, { vibrationActuator: {} }, { vibrationActuator: actuator([], { effects: [] }) }, { vibrationActuator: actuator([], { effects: ["other"] }) }, { hapticActuators: [] }, { hapticActuators: [{}] }]) {
    const { r, calls } = rig({ pad });
    assert.equal(r.supported(), false, JSON.stringify(pad));
    r.feed([{ t: "hurt" }], 0, P);
    assert.equal(r.test(), false);
    r.stop();
    assert.equal(calls.length, 0);
  }
  assert.equal(rig().r.supported(), true);
  const boom = createRumble({ level: () => HIGH, gamepad: () => { throw new Error("x"); }, playing: () => true, state: () => "PLAY" });
  assert.equal(boom.supported(), false);
  boom.feed([{ t: "hurt" }], 0, P);
  boom.stop();
});
test("a hostile actuator: throwing getters never escape", () => {
  const pad = { get vibrationActuator() { throw new Error("x"); }, get hapticActuators() { throw new Error("y"); } };
  assert.deepEqual(routesOf(pad), []);
  assert.equal(padInfo(pad).route, null);
  const v = { vibrationActuator: { playEffect: () => Promise.resolve(), get effects() { throw new Error("z"); } } };
  assert.equal(routesOf(v)[0].kind, "dual-rumble");
  assert.equal(padInfo(v).effects, null);
});
test("the gamepad is re-read on every call and every stop", () => {
  const seen = [];
  let n = 0;
  const live = () => { const id = ++n; return { vibrationActuator: { playEffect: () => { seen.push("play" + id); return Promise.resolve(); }, reset: () => { seen.push("reset" + id); return Promise.resolve(); } } }; };
  const r = createRumble({ level: () => HIGH, gamepad: live, playing: () => true, state: () => "PLAY" });
  r.feed([{ t: "bomb" }], 0, P);
  r.tick(100);
  r.feed([{ t: "bomb" }], 600, P);
  r.stop();
  const ids = seen.map((x) => +x.replace(/\D/g, ""));
  assert.deepEqual(seen.map((x) => x.replace(/\d/g, "")), ["play", "play", "reset"]);
  assert.ok(ids[0] < ids[1] && ids[1] < ids[2]);
});
test("a pad gone between plays is a no-op, and a new one plays", () => {
  const calls = [];
  let pad = null;
  const r = createRumble({ level: () => HIGH, gamepad: () => pad, playing: () => true, state: () => "PLAY" });
  r.feed([{ t: "hurt" }], 0, P);
  pad = { vibrationActuator: actuator(calls) };
  r.feed([{ t: "hurt" }], 1, P);
  assert.equal(calls.length, 1, "a buzz nothing played holds nothing up");
});
test("stop cancels through reset", () => {
  const { r, calls } = rig();
  r.stop();
  assert.deepEqual(calls.map((c) => c.type), ["reset"]);
});
test("feed does not mutate the events array or the player", () => {
  const { r } = rig();
  const ev = [{ t: "hurt", x: 1, y: 2 }, { t: "boom", x: 5, y: 5 }];
  const snap = JSON.stringify(ev);
  Object.freeze(ev);
  ev.forEach(Object.freeze);
  r.feed(ev, 0, Object.freeze({ x: 1, y: 1 }));
  assert.equal(JSON.stringify(ev), snap);
});
test("a rejected promise is swallowed on every path", async () => {
  const seen = [];
  const onRej = (e) => seen.push(e);
  process.on("unhandledRejection", onRej);
  const { r } = rig({ reject: true });
  r.feed([{ t: "hurt" }], 0, P);
  r.test();
  r.stop();
  const h = createRumble({ level: () => HIGH, gamepad: () => ({ hapticActuators: [{ pulse: () => Promise.reject(new Error("x")) }] }), playing: () => true, state: () => "PLAY" });
  h.feed([{ t: "hurt" }], 0, P);
  h.test();
  h.stop();
  await new Promise((f) => setTimeout(f, 5));
  process.off("unhandledRejection", onRej);
  assert.equal(seen.length, 0);
});
test("a throw never escapes, and falls to the next path in the same play", () => {
  const th = rig({ throws: true });
  th.r.feed([{ t: "hurt" }], 0, P);
  th.r.test();
  th.r.stop();
  const calls = [], pulses = [];
  const pad = { vibrationActuator: { effects: ["dual-rumble", "trigger-rumble"], playEffect: (type, p) => { if (type === "dual-rumble") throw new Error("x"); calls.push({ type, p }); return Promise.resolve(); } }, hapticActuators: [{ pulse: (v, d) => { pulses.push([v, d]); } }] };
  const { r } = rig({ pad });
  r.feed([{ t: "hurt" }], 0, P);
  assert.deepEqual(calls.map((c) => c.type), ["trigger-rumble"]);
  assert.equal(pulses.length, 0);
  const pad2 = { vibrationActuator: { playEffect: () => { throw new Error("x"); } }, hapticActuators: [{ pulse: (v, d) => { pulses.push([v, d]); } }] };
  rig({ pad: pad2 }).r.feed([{ t: "hurt" }], 0, P);
  assert.deepEqual(pulses, [[1, 180 + LIMITS.over]]);
});
test("padInfo reports what the pad offers", () => {
  assert.deepEqual(padInfo(null), { id: null, mapping: null, actuator: null, playEffect: false, effects: null, hapticActuators: 0, route: null });
  const a = padInfo({ id: "Pad 1", mapping: "standard", vibrationActuator: { type: "dual-rumble", effects: ["dual-rumble", "trigger-rumble"], playEffect() {} }, hapticActuators: [{ pulse() {} }, { pulse() {} }] });
  assert.deepEqual(a, { id: "Pad 1", mapping: "standard", actuator: "dual-rumble", playEffect: true, effects: ["dual-rumble", "trigger-rumble"], hapticActuators: 2, route: "dual-rumble" });
  const old = padInfo({ id: "Old", mapping: "", vibrationActuator: { type: "dual-rumble", playEffect() {} } });
  assert.deepEqual([old.actuator, old.effects, old.route], ["dual-rumble", null, "dual-rumble"], "effects is null when the browser does not offer it");
});

/* Absolute deadlines: a late frame shortens its step, it does not push the rest of the pattern back. */
const spans = (calls, stamp) => calls.map((c, i) => ({ a: stamp[i], b: stamp[i] + c.p.duration }));
const merged = (iv) => { const out = []; for (const e of iv) { const q = out.at(-1); if (q && e.a <= q.b + 0.001) q.b = Math.max(q.b, e.b); else out.push({ ...e }); } return out; };
const stamped = (rg) => { const at = []; const o = rg.calls.push.bind(rg.calls); let now = 0; rg.calls.push = (c) => { if (c.type !== "reset") at.push(now); return o(c); }; return { at, set: (t) => { now = t; } }; };
test("a jittered frame clock: no pattern over 500 ms and no pulse over 300 ms, chains included", () => {
  let seed = 3;
  const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const BOOM = { t: "boom", x: 100, y: 100 };
  const cases = [["lose", [{ t: "lose" }]], ["hurt", [{ t: "hurt" }]], ["win", [{ t: "win" }]], ["close", [BOOM]], ["chain2", [BOOM, BOOM]], ["chain3", [BOOM, BOOM, BOOM]], ["chain4", [BOOM, BOOM, BOOM, BOOM]], ["chain6", Array(6).fill(BOOM)]];
  for (const jit of [0, 1]) for (const level of [LOW, MEDIUM, HIGH]) for (const [nm, ev] of cases) for (let round = 0; round < 60; round++) {
    const rg = rig({ level }), st = stamped(rg);
    st.set(0); rg.r.feed(ev, 0, P, 3);
    for (let t = 0; t < 900;) { t += jit ? 8 + rnd() * 32 : FRAME; st.set(t); rg.r.tick(t); }
    const runs = merged(spans(plays(rg.calls), st.at));
    const tag = nm + " L" + level + " " + JSON.stringify(runs);
    assert.ok(!runs.length || runs.at(-1).b - runs[0].a <= LIMITS.patMs + 1e-6, "pattern " + tag);
    assert.ok(runs.every((q) => q.b - q.a <= LIMITS.pulseMs + 1e-6), "pulse " + tag);
    if (!jit) assert.ok(runs.length <= LIMITS.pulses, "pulses " + tag);
  }
});
test("an overdue step is skipped, not bunched with the next", () => {
  const rg = rig(), st = stamped(rg);
  st.set(0); rg.r.feed([{ t: "win" }], 0, P, 3); // 90, gap 80, 90, gap 80, 160
  st.set(400); rg.r.tick(400); // 0..90 / 170..260 are over; 340..500 still runs
  assert.equal(plays(rg.calls).length, 2);
  assert.ok(Math.abs(plays(rg.calls)[1].p.duration - 100) < 1e-6, String(plays(rg.calls)[1].p.duration));
});
test("a test pulse is the player's own: past the on-time budget, 250 ms apart, the last of a quick run trails at its level", () => {
  const rg = rig({ level: LOW, playing: false, st: "PAUSE" });
  assert.equal(rg.r.test(0), true);
  rg.opts.level = MEDIUM; assert.equal(rg.r.test(100), false);
  rg.opts.level = HIGH; assert.equal(rg.r.test(200), false);
  rg.r.tick(240); assert.equal(rg.calls.length, 1, "nothing before the 250 ms");
  rg.r.tick(250);
  assert.equal(rg.calls.length, 2);
  assert.ok(Math.abs(rg.calls[1].p.strongMagnitude - 0.7) < 1e-9, "HIGH, not the level it arrived at");
  rg.r.tick(300); rg.r.tick(900);
  assert.equal(rg.calls.length, 2, "one trailing pulse, once");
  const q = rig({ level: HIGH });
  for (let t = 0; t <= 1500; t += 250) assert.equal(q.r.test(t), true, "pulse at " + t);
  assert.equal(q.calls.length, 7, "the budget never drops a test pulse");
  rg.opts.level = 0; rg.r.test(2000); rg.r.tick(2300);
  assert.equal(rg.calls.length, 2, "OFF gives zero");
  const o = rig({ level: HIGH }); o.r.test(0); o.r.test(100); o.opts.level = 0; o.r.tick(260);
  assert.equal(o.calls.length, 1, "OFF before the trail cancels it");
});

/* Menu feels (menu-haptics spec.md + lead rulings 2026-11-03). */
const MENU = ["move", "confirm", "enter", "back", "launch", "deny", "hello"];
const onOf = (st) => st.filter((x) => !x.gap);
test("menu feels, from the table: a menu flag on exactly seven, each under every gameplay pattern and the test pulse, at most 250 ms and 2 pulses, weak going in, strong only for back", () => {
  assert.deepEqual(Object.keys(PATTERNS).filter((n) => PATTERNS[n].menu).sort(), [...MENU].sort());
  assert.deepEqual(MENU.map((n) => PATTERNS[n].p), [9, 8.5, 8, 8.8, 7.8, 8.2, 8.1]);
  const top = Math.max(...Object.keys(PATTERNS).filter((n) => !PATTERNS[n].menu).map((n) => PATTERNS[n].p));
  assert.equal(top, PATTERNS.test.p);
  for (const n of MENU) {
    const pat = PATTERNS[n];
    assert.ok(pat.p > top && pat.noLow, n);
    assert.ok(lenOf(pat.steps) <= 250 && pulses(pat.steps).length <= 2, n);
    assert.ok(onOf(pat.steps).every((x) => (n === "back" ? x.weak === 0 && x.strong > 0 : x.strong === 0 && x.weak > 0)), n);
    assert.equal(!!pat.exempt, n === "launch" || n === "hello", n + ": only launch and hello skip the caps");
  }
});
test("every menu name at OFF / LOW / MEDIUM / HIGH: call counts and post-scale magnitudes, off PLAY", () => {
  /* [weak, strong] per motor step at MEDIUM and HIGH, re-derived from scaleMag: x = m * SCALE, x >= .5 ? x : .35 + .3x. */
  const WANT = {
    move: [[[0.44, 0]], [[0.47, 0]]], confirm: [[[0.47375, 0]], [[0.55, 0]]], enter: [[[0.485, 0]], [[0.6, 0]]], back: [[[0, 0.4175]], [[0, 0.44]]],
    launch: [[[0.4625, 0], [0.525, 0]], [[0.5, 0], [0.7, 0]]], deny: [[[0.4625, 0], [0.4625, 0]], [[0.5, 0], [0.5, 0]]], hello: [[[0.485, 0]], [[0.6, 0]]],
  };
  for (const n of MENU) for (const level of [0, LOW, MEDIUM, HIGH]) {
    const rg = rig({ level, playing: false, st: "PAUSE" });
    const got = rg.r.menu(n, 0);
    run(rg.r, 0, 600);
    const tag = n + " L" + level;
    if (level < MEDIUM) { assert.equal(got, false, tag); assert.equal(rg.calls.length, 0, tag + ": zero calls, resets included"); continue; }
    assert.equal(got, true, tag);
    const ps = plays(rg.calls), st = onOf(PATTERNS[n].steps), want = WANT[n][level - MEDIUM];
    assert.equal(ps.length, st.length, tag);
    assert.equal(rg.calls.length, ps.length, tag + ": no reset");
    ps.forEach((c, i) => {
      assert.ok(close(c.p.weakMagnitude, want[i][0]) && close(c.p.strongMagnitude, want[i][1]), tag + " " + i + " " + JSON.stringify(c.p));
      assert.ok(close(c.p.weakMagnitude, scaleMag(st[i].weak, level)) && close(c.p.strongMagnitude, scaleMag(st[i].strong, level)), tag);
    });
    assert.ok(near(ps.map((c) => c.p.duration), st.map((x) => x.ms)), tag + " " + ps.map((c) => c.p.duration));
  }
});
test("menu(): an unknown or gameplay name is false and calls nothing", () => {
  const { r, calls } = rig({ playing: false, st: "PAUSE" });
  for (const n of ["foo", "hurt", "lose", "plant", "test", "chain", "toString", "__proto__", undefined, ""]) assert.equal(r.menu(n, 0), false, String(n));
  assert.equal(calls.length, 0);
});
test("launch: 60 ms, an 80 ms gap, then 110 ms, stepped by tick() on any screen; deny likewise", () => {
  for (const [playing, stt] of [[false, "PLAY"], [true, "PAUSE"], [true, "WIN"], [true, "PLAY"]]) for (const [n, at2, d] of [["launch", 140, [60, 110]], ["deny", 140, [60, 60]]]) {
    const rg = rig({ playing, st: stt }), st = stamped(rg);
    st.set(0); assert.equal(rg.r.menu(n, 0), true);
    for (let t = FRAME; t < 700; t += FRAME) { st.set(t); rg.r.tick(t); }
    const ps = plays(rg.calls), tag = n + " " + playing + " " + stt + " " + st.at;
    assert.equal(rg.calls.length, 2, tag + ": two pulses, no reset");
    assert.ok(st.at[0] === 0 && st.at[1] >= at2 && st.at[1] < at2 + FRAME, tag);
    assert.ok(near(ps.map((c) => c.p.duration), d), tag + " " + ps.map((c) => c.p.duration));
    assert.ok(ps.every((c) => c.p.strongMagnitude === 0), tag);
  }
});
test("launch and deny under a jittered frame clock: at most one late frame (40 ms) over authored, never more than 2 pulses", () => {
  let seed = 5;
  const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (const n of ["launch", "deny"]) for (const level of [MEDIUM, HIGH]) for (let round = 0; round < 80; round++) {
    const rg = rig({ level, playing: false, st: "PAUSE" }), st = stamped(rg);
    st.set(0); rg.r.menu(n, 0);
    for (let t = 0; t < 600;) { t += 8 + rnd() * 32; st.set(t); rg.r.tick(t); }
    const runs = merged(spans(plays(rg.calls), st.at)), tag = n + " L" + level + " " + JSON.stringify(runs);
    assert.ok(runs.length >= 1 && runs.length <= 2, tag);
    assert.ok(runs.at(-1).b - runs[0].a <= lenOf(PATTERNS[n].steps) + 40 + 1e-6, tag); // a menu step plays late rather than vanish
    assert.ok(runs.every((q) => q.b - q.a <= 110 + 1e-6), tag);
  }
});
test("gameplay preempts launch at once and its second beat never plays; a lower menu feel cannot cut it", () => {
  for (const ev of [[{ t: "bomb" }], [{ t: "hurt" }], [{ t: "boom", x: 180, y: 100 }]]) for (const at of [20, 90]) {
    const { r, calls } = rig();
    r.menu("launch", 0);
    r.tick(FRAME);
    assert.equal(r.menu("enter", 10), false);
    assert.equal(r.menu("deny", 10), false);
    r.feed(ev, at, P, 3);
    assert.equal(plays(calls).length, 2, ev[0].t + " at " + at + ", in the beat or the gap");
    run(r, at, 800);
    assert.ok(plays(calls).length <= 3 && plays(calls).slice(1).every((c) => c.p.weakMagnitude !== scaleMag(0.7, HIGH)), "the 110 ms beat is gone " + JSON.stringify(plays(calls)));
  }
  const up = rig({ playing: false });
  assert.equal(up.r.menu("enter", 0), true);
  assert.equal(up.r.menu("launch", 20), true, "launch outranks a running enter");
});
test("the menu session cap: 900 ms in a rolling 10 s drops cursor ticks; page feels always play but count; a test pulse does not count; launch and hello sit outside it; it recovers", () => {
  const { r, calls } = rig({ playing: false, st: "PAUSE" });
  for (let i = 0; i < 15; i++) assert.equal(r.menu("move", 500 + i * 500), true, "move " + i);
  assert.equal(r.menu("move", 8000), false, "15 x 60 = 900; a 16th makes 960");
  assert.equal(r.test(8100), true);
  assert.equal(r.menu("confirm", 8300), false, "the test pulse took none of it, but the cap is full");
  assert.equal(r.menu("enter", 8500), true, "a page feel is never dropped by the cap");
  assert.equal(r.menu("back", 8700), true);
  run(r, 8700, 100);
  assert.equal(r.menu("deny", 9000), true);
  run(r, 9000, 300);
  assert.equal(r.menu("launch", 9400), true, "launch is outside the cap");
  run(r, 9400, 300);
  assert.equal(r.menu("hello", 9800), true, "hello too");
  const n = plays(calls).length;
  assert.equal(r.menu("move", 10400), false, "enter, back and deny counted: 840 + 280 still over 900");
  assert.equal(r.menu("move", 18800), true, "the window has moved past them");
  assert.equal(plays(calls).length, n + 1);
});
test("page feels skip the per-second limits after a fast scroll; move keeps them", () => {
  const { r } = rig({ level: MEDIUM, playing: false });
  for (const t of [0, 100, 200, 300]) assert.equal(r.menu("move", t), true, "move " + t);
  assert.equal(r.menu("move", 400), false, "a 5th pulse in 1 s");
  assert.equal(r.menu("enter", 420), true, "the press after a fast scroll still buzzes");
  assert.equal(r.menu("back", 520), true);
});
test("a late frame plays launch's second pulse late and whole, where a gameplay step would be skipped", () => {
  const { r, calls } = rig({ playing: false });
  assert.equal(r.menu("launch", 0), true);
  r.tick(420);
  const p = plays(calls);
  assert.equal(p.length, 2, "the second pulse still plays after a 420 ms frame");
  assert.equal(p[1].p.duration, 110);
});
test("menu feels and gameplay keep separate budgets", () => {
  const { r, calls } = rig();
  for (let t = 0; t < 6000; t += 400) { r.feed([{ t: "bomb" }], t, P, 3); run(r, t, 100); }
  assert.equal(plays(calls).length, 15, "the plant budget is spent");
  assert.equal(r.menu("enter", 6200), true, "a menu feel is not on it");
  const m = rig({ playing: false });
  for (let i = 0; i < 6; i++) m.r.menu("enter", i * 500);
  m.opts.playing = true;
  m.r.feed([{ t: "bomb" }], 3200, P, 3);
  assert.equal(plays(m.calls).length, 7, "and the menu cap is not on a plant");
});
test("launch and hello skip the per-second limits; move keeps them", () => {
  const { r } = rig({ level: MEDIUM, playing: false });
  for (const t of [0, 100, 200, 300]) assert.equal(r.menu("move", t), true, "move " + t);
  assert.equal(r.menu("move", 400), false, "a 5th pulse in 1 s");
  assert.equal(r.menu("launch", 450), true);
  run(r, 450, 300);
  assert.equal(r.menu("hello", 760), true);
  assert.equal(r.menu("move", 900), false);
});
test("menu() has no repeat notion: a call on a running tick is dropped, never queued; spaced calls are fresh presses until a limit says no", () => {
  const { r, calls } = rig({ playing: false });
  assert.equal(r.menu("move", 0), true);
  assert.equal(r.menu("move", 30), false);
  run(r, 30, 60);
  assert.equal(calls.length, 1, "nothing queued from the dropped call");
  for (const t of [100, 200, 300]) assert.equal(r.menu("move", t), true);
  assert.equal(r.menu("move", 400), false);
  run(r, 400, 500);
  assert.equal(calls.length, 4, "and nothing trails out of the limit either");
  assert.equal(r.menu("move", 1001), true);
});
test("MEDIUM and HIGH menu feels differ on every step (the old floor clamp made back and MEDIUM move identical)", () => {
  for (const n of MENU) for (const x of onOf(PATTERNS[n].steps)) for (const m of [x.weak, x.strong]) if (m > 0) assert.ok(scaleMag(m, HIGH) - scaleMag(m, MEDIUM) >= 0.02, n + " " + m);
  const md = rig({ level: MEDIUM, playing: false }), hi = rig({ level: HIGH, playing: false });
  md.r.menu("move", 0); hi.r.menu("move", 0);
  assert.ok(close(md.calls[0].p.weakMagnitude, 0.44) && close(hi.calls[0].p.weakMagnitude, 0.47));
});
test("a running menu feel: OFF and a lost pad cut it; PAUSE, a closed shell and a return to PLAY never do", () => {
  const off = rig();
  off.r.menu("launch", 0);
  off.opts.level = 0;
  off.r.tick(FRAME);
  assert.deepEqual(off.calls.map((c) => c.type), ["dual-rumble", "reset"]);
  run(off.r, FRAME, 600);
  off.opts.level = HIGH;
  run(off.r, 600, 300);
  assert.equal(off.calls.length, 2, "nothing resumes");
  const gone = rig();
  gone.r.menu("deny", 0);
  gone.opts.pad = null;
  gone.r.tick(FRAME);
  gone.opts.pad = { vibrationActuator: actuator(gone.calls) };
  run(gone.r, FRAME, 600);
  assert.equal(plays(gone.calls).length, 1);
  for (const flip of [(o) => { o.st = "PAUSE"; }, (o) => { o.playing = false; }, (o) => { o.st = "PLAY"; }]) {
    const rg = rig({ st: "WIN" });
    rg.r.menu("launch", 0);
    flip(rg.opts);
    run(rg.r, 0, 600);
    assert.equal(rg.calls.length, 2, "both beats, no reset");
  }
});
test("PAUSE entry: stop() then a menu feel in the same frame plays, and PAUSE ticks never halt it", () => {
  for (const n of ["enter", "deny", "launch"]) {
    const { r, calls, opts } = rig();
    r.feed([{ t: "hurt" }], 400, P, 3);
    r.tick(400);
    opts.st = "PAUSE";
    r.stop();
    const was = calls.length;
    assert.equal(calls.at(-1).type, "reset");
    assert.equal(r.menu(n, 410), true, n);
    if (n === "launch") opts.st = "PLAY"; // PAUSE RESTART: the run starts mid-feel
    run(r, 410, 600);
    const after = calls.slice(was);
    assert.equal(after.length, onOf(PATTERNS[n].steps).length, n + " " + JSON.stringify(after.map((c) => c.type)));
    assert.ok(after.every((c) => c.type === "dual-rumble"), n + ": never halted");
  }
});
test("page feels skip the pulse count and the menu cap but never the on-time ceiling: mashed enter / back stays near 50 %, a scroll then an enter still plays", () => {
  const rg = rig({ playing: false }), st = stamped(rg);
  let ok = 0;
  for (let t = 0; t <= 2000; t += 100) { st.set(t); if (rg.r.menu((t / 100) % 2 ? "back" : "enter", t)) ok++; for (let f = t; f < t + 100; f += FRAME) { st.set(f); rg.r.tick(f); } }
  const runs = merged(spans(plays(rg.calls), st.at));
  for (let w = 0; w <= 1100; w += 10) {
    const sum = runs.reduce((a, q) => a + Math.max(0, Math.min(q.b, w + 1000) - Math.max(q.a, w)), 0);
    assert.ok(sum <= LIMITS.onMs, "window " + w + " on " + sum);
  }
  assert.ok(ok >= 8 && ok < 21, "some pages play, the ceiling drops the rest: " + ok);
  const sc = rig({ playing: false });
  for (const t of [0, 100, 200, 300]) assert.equal(sc.r.menu("move", t), true);
  assert.equal(sc.r.menu("move", 380), false, "a 5th tick in 1 s is over the pulse count");
  assert.equal(sc.r.menu("enter", 400), true, "the enter is not");
});
test("a late menu step: launch whose first tick is 420 ms late plays its second pulse whole; at 600 ms the feel is dropped", () => {
  for (const [at, n, d] of [[420, 2, 110], [500, 2, 110], [501, 1], [600, 1]]) {
    const { r, calls } = rig({ playing: false });
    r.menu("launch", 0);
    r.tick(at);
    run(r, at, 400);
    assert.equal(plays(calls).length, n, "first tick at " + at);
    if (d) assert.equal(plays(calls)[1].p.duration, d);
  }
});
test("gameplay magnitudes after scaling, typed in: [weak, strong] per motor step at LOW / MEDIUM / HIGH", () => {
  const WANT = {
    plant: [[[0.4, 0]], [[0.45125, 0]], [[0.485, 0]]],
    near: [[[0.4, 0]], [[0.47375, 0]], [[0.55, 0]]],
    close: [[[0.4, 0.4], [0, 0.4]], [[0.485, 0.675], [0, 0.45125]], [[0.6, 0.9], [0, 0.485]]],
    win: [[[0.4, 0], [0.4, 0], [0.4, 0.398]], [[0.4625, 0], [0.525, 0], [0.525, 0.44]], [[0.5, 0], [0.7, 0], [0.7, 0.47]]],
    shield: [[[0.4, 0], [0.4, 0]], [[0.525, 0], [0.525, 0]], [[0.7, 0], [0.7, 0]]],
    hurt: [[[0.398, 0.4], [0, 0.4]], [[0.44, 0.75], [0, 0.4625]], [[0.47, 1], [0, 0.5]]],
    lose: [[[0.4, 0.4], [0, 0.4]], [[0.4625, 0.75], [0, 0.485]], [[0.5, 1], [0, 0.6]]],
    test: [[[0.4, 0.4]], [[0.525, 0.525]], [[0.7, 0.7]]],
  };
  for (const [n, byLv] of Object.entries(WANT)) [LOW, MEDIUM, HIGH].forEach((v, k) => {
    const got = onOf(PATTERNS[n].steps).map((x) => [scaleMag(x.weak, v), scaleMag(x.strong, v)]);
    assert.equal(got.length, byLv[k].length, n);
    got.forEach((g, i) => assert.ok(close(g[0], byLv[k][i][0]) && close(g[1], byLv[k][i][1]), n + " L" + v + " step " + i + " " + g));
  });
});
