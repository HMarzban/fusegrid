import { createGate, createGovernor, limitHint, divisor, snapHz, HZ_SNAP } from "../src/app/perf.js";

let pass = 0, fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
/* vsync timestamps: t_k = k*per + noise, so consecutive intervals vary by up to
   2*amp while the clock never drifts (the shape a real display produces). */
function sim(hz, cap, secs, amp = 0.5, gate = createGate()) {
  const per = 1000 / hz, n = Math.round(secs * hz), runs = [];
  for (let k = 0; k < n; k++) runs.push(gate.tick(1000 + k * per + (rnd() * 2 - 1) * amp, cap));
  return { runs, gate, count: runs.filter(Boolean).length };
}

// ---- 1. divisor table (§3) ----
{
  const T = { 60: [60, 30], 90: [90, 30], 120: [60, 30], 144: [72, 36], 165: [82.5, 33], 240: [60, 30], 30: [30, 30],
    75: [75, 37.5], 100: [100, 33.333333333333336], 48: [48, 48], 50: [50, 50] };
  let bad = [];
  for (const hz of Object.keys(T).map(Number)) {
    const [a, b] = T[hz];
    if (hz / divisor(hz, 60) !== a) bad.push(hz + "@60=" + hz / divisor(hz, 60));
    if (hz / divisor(hz, 30) !== b) bad.push(hz + "@30=" + hz / divisor(hz, 30));
    if (divisor(hz, Infinity) !== 1) bad.push(hz + "@MAX");
  }
  check("divisor table: every display x cap 60 / 30 / MAX lands the nearest clean step at or above the cap", bad.length === 0, bad.join(" "));
  check("divisor is 1 without an estimate", divisor(0, 60) === 1 && divisor(NaN, 30) === 1);
  check("snapHz snaps within 4% and refuses the rest",
    snapHz(1000 / 119) === 120 && snapHz(1000 / 143) === 144 && snapHz(2) === 0 && snapHz(1000 / 110) === 0 && snapHz(0) === 0);
  check("snap list is the spec's twelve rates plus 180 and 200 (close-out review)", HZ_SNAP.join() === "30,48,50,60,72,75,90,100,120,144,165,180,200,240");
  for (const hz of [180, 200]) for (const cap of [60, 30]) {
    const g = createGate(); let t = 0, n = 0;
    for (let i = 0; i < 120; i++) { t += 1000 / hz; if (g.tick(t, cap)) n++; }
    const after = n; // 120 vsyncs; the first 8 warm up ungated
    check(hz + " Hz panel honours FRAME RATE " + cap + " (it never snapped, so the gate ran every vsync)", g.hz === hz && after < 120 && Math.abs(after - (8 + 112 / divisor(hz, cap))) <= 2, after + " of 120, hz " + g.hz);
  }
}

// ---- 2. measured run counts over 10 s ----
{
  const want = [[120, 60, 600], [120, 30, 300], [144, 60, 720], [144, 30, 360], [60, 60, 600], [60, 30, 300],
    [30, 60, 300], [30, 30, 300], [90, 60, 900], [240, 60, 600], [165, 60, 825], [120, Infinity, 1200]];
  for (const [hz, cap, n] of want) {
    const { count } = sim(hz, cap, 10, hz > 144 ? 0.2 : 0.5);
    check(hz + " Hz cap " + cap + ": " + n + " +-8 runs in 10 s (warm-up included; +-1 ms jitter, +-0.4 ms past 144 Hz)", Math.abs(count - n) <= 8, count);
  }
}

// ---- 3. 120 Hz +-1 ms jitter: exactly every 2nd callback after warm-up ----
{
  const { runs } = sim(120, 60, 10, 0.5);
  let ok = true, first = -1;
  for (let i = 16; i < runs.length; i++) {
    if (runs[i] && first < 0) first = i;
    if (first >= 0 && runs[i] !== ((i - first) % 2 === 0)) { ok = false; break; }
  }
  check("120 Hz +-1 ms jitter runs exactly every 2nd callback over 10 s", ok && first >= 0);
  const r30 = sim(120, 30, 10, 0.5).runs;
  let ok30 = true, f30 = -1;
  for (let i = 16; i < r30.length; i++) {
    if (r30[i] && f30 < 0) f30 = i;
    if (f30 >= 0 && r30[i] !== ((i - f30) % 4 === 0)) { ok30 = false; break; }
  }
  check("120 Hz idle tier runs exactly every 4th callback (30 fps)", ok30 && f30 >= 0);
  const r60 = sim(60, 60, 10, 0.5);
  check("60 Hz at cap 60 runs every callback (today's cadence, d=1)", r60.count === r60.runs.length && r60.gate.d === 1);
}

// ---- 4. warm-up and the MessageChannel shim ----
{
  const g = createGate();
  const w = [];
  for (let k = 0; k < 8; k++) w.push(g.tick(k * 1000 / 120, 60));
  check("warm-up: the first 8 callbacks run (no estimate yet, divisor 1)", w.every(Boolean), w.join());
  const s = createGate();
  let all = true;
  for (let k = 0; k < 500; k++) if (!s.tick(k * 2, 60)) all = false;
  check("an unsnappable 2 ms shim interval runs every callback", all && s.d === 1 && s.hz === 0);
  const s4 = createGate();
  let all4 = true;
  for (let k = 0; k < 500; k++) if (!s4.tick(k * 4, 30)) all4 = false;
  check("an unsnappable 4 ms shim interval runs every callback at cap 30 too", all4);
}

// ---- 5. stall reset, poke, idle <-> active ----
{
  const { gate } = sim(120, 60, 2, 0);
  const per = 1000 / 120;
  let t = 1000 + Math.round(2 * 120) * per;
  check("steady 120 Hz estimates 120 with divisor 2", gate.hz === 120 && gate.d === 2, gate.hz + "/" + gate.d);
  const stall = gate.tick(t + 400, 60);
  check("an interval over 250 ms resets the estimate and that callback runs", stall === true && gate.hz === 0 && gate.d === 1);
  t += 400;
  const after = [];
  for (let k = 1; k <= 7; k++) after.push(gate.tick(t + k * per, 60));
  check("after a stall the window refills: callbacks run until 8 samples exist", after.every(Boolean), after.join());
  const g = sim(120, 60, 2, 0).gate;
  let t0 = 1000 + Math.round(2 * 120) * per, i = 0;
  while (g.tick(t0 + i * per, 60) === false || i === 0) i++;
  i++;
  const skipped = g.tick(t0 + i * per, 60);
  i++;
  g.poke();
  const poked = g.tick(t0 + i * per, 60);
  i++;
  const next = g.tick(t0 + i * per, 60);
  i++;
  const next2 = g.tick(t0 + i * per, 60);
  check("poke: the next callback runs, then the cadence restarts from it", skipped === false && poked === true && next === false && next2 === true,
    [skipped, poked, next, next2].join());
  const h = sim(120, 30, 2, 0).gate;
  let t1 = 1000 + 240 * per, j = 0, seen = [];
  for (; j < 6; j++) seen.push(h.tick(t1 + j * per, 30));
  const sw = h.tick(t1 + j * per, 60);
  check("idle -> active (cap change) runs the next callback like a poke", sw === true, seen.join() + " | " + sw);
  const r = createGate();
  for (let k = 0; k < 40; k++) r.tick(k * per, 60);
  r.reset();
  check("reset() drops the estimate", r.hz === 0 && r.d === 1 && r.tick(9999, 60) === true);
}

// ---- 6. governor ----
{
  const F = 1000 / 60;
  const feed = (g, secs, iv, work, cap = F) => { for (let k = 0; k < Math.round(secs * 1000 / iv); k++) g.feed(iv, work, cap); };
  const g = createGovernor();
  feed(g, 20, F, 2);
  check("a healthy 60 fps with short work holds the top rung", g.step === 0 && g.level(2) === 2);
  feed(g, 2.05, F, 14);
  check("p90 work over 75% of the cap interval steps down one rung after one 2 s window", g.step === 1 && g.level(2) === 1.75, g.step);
  feed(g, 1.5, F, 14);
  check("rate limit: no second step inside the next 2 s", g.step === 1);
  feed(g, 20, F, 14);
  check("ladder floor: 2 -> 1.75 -> 1.5 -> 1.25 -> 1, never below 1", g.level(2) === 1 && g.step === 4);
  const h = createGovernor();
  const jank = () => { for (let k = 0; k < 130; k++) h.feed(k % 8 === 0 ? 40 : F, 2, F); };
  jank();
  check("10% or more jank intervals step down even with short work", h.step === 1, h.step);
  const u = createGovernor();
  feed(u, 2.05, F, 14);
  feed(u, 8, F, 2);
  check("hysteresis: 8 s clean is not enough to step up", u.step === 1);
  feed(u, 2.2, F, 2);
  check("10 s with zero jank and p90 under 40% steps back up", u.step === 0, u.step);
  const m = createGovernor();
  feed(m, 2.05, F, 14);
  feed(m, 8, F, 2);
  feed(m, 2.05, F, 9);
  feed(m, 8, F, 2);
  check("a mid-load window (40-75%) holds and restarts the clean count", m.step === 1);
  const lp = createGovernor();
  feed(lp, 60, 1000 / 30, 3, 1000 / 30);
  feed(lp, 60, 1000 / 30, 3, F);
  check("Low Power: a steady 33 ms with short work never steps down", lp.step === 0);
  const t = createGovernor();
  feed(t, 30, F, 14);
  check("a lower top filters the ladder: 1.5 -> 1.25 -> 1", t.level(1.5) === 1 && createGovernor().level(1.5) === 1.5);
  check("top 1 has one rung", createGovernor().level(1) === 1 && t.level(1) === 1);
  const r = createGovernor();
  feed(r, 1.9, F, 14);
  r.reset();
  feed(r, 0.5, F, 14);
  check("reset() drops the window (a hidden-tab return never steps on stale samples)", r.step === 0);
  const s = createGovernor();
  s.feed(400, 2, F); s.feed(-1, 2, F); s.feed(NaN, 2, F);
  check("stall and junk intervals are ignored", s.step === 0);
}

// ---- 7. limitHint ----
{
  const iv = (ms, n = 60) => Array.from({ length: n }, () => ms);
  check("30 Hz Low Power at cap 60 is limited", limitHint(iv(1000 / 30), 60) === true);
  check("30 Hz at cap 30 is not limited", limitHint(iv(1000 / 30), 30) === false);
  check("MAX is never on", limitHint(iv(1000 / 30), Infinity) === false && limitHint(iv(100), Infinity) === false);
  check("a healthy 60 / 120 Hz is not limited", limitHint(iv(1000 / 60), 60) === false && limitHint(iv(1000 / 120), 60) === false);
  const j = iv(1000 / 30); j[5] = 80;
  check("a window with jank is not a limit (that is load, not the OS)", limitHint(j, 60) === false);
  check("too few samples or junk is false", limitHint([], 60) === false && limitHint(null, 60) === false && limitHint(iv(33, 4), 60) === false);
}

console.log("\n  PERF RESULT: " + pass + " PASS / " + fail + " FAIL");
process.exit(fail ? 1 : 0);
