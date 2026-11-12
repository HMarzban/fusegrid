import { createJob, fillOf, BANDS, PHASES, CANCELLED, prefetch } from "../src/app/jobs.js";

let pass = 0,
  fail = 0;
function check(name, cond, detail) {
  cond ? pass++ : fail++;
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail !== undefined ? " -> " + detail : ""));
}
/* fake clock + fake MessageChannel: a post queues; run() delivers the queue */
function fakes() {
  const F = { t: 0, q: [], posts: 0 };
  F.now = () => F.t;
  F.channel = () => {
    const ch = { port1: { onmessage: null, close() { ch.closed = true; } }, port2: { postMessage() { F.posts++; F.q.push(() => ch.port1.onmessage && ch.port1.onmessage({})); } } };
    return ch;
  };
  F.run = async () => { while (F.q.length) F.q.shift()(); await Promise.resolve(); await Promise.resolve(); };
  return F;
}
const settled = (p) => { const s = { v: "pending" }; p.then(() => { s.v = "ok"; }, (e) => { s.v = e; }); return s; };
const micro = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };

{
  const F = fakes();
  const j = createJob({ now: F.now, channel: F.channel, look: "px" });
  const a = settled(j.step());
  await micro();
  check("step() resolves at once inside the slice budget (no yield)", a.v === "ok" && F.posts === 0);
  F.t = 9;
  const b = settled(j.step());
  await micro();
  check("past the 8 ms budget step() yields through the channel and waits", b.v === "pending" && F.posts === 1);
  await F.run();
  check("the channel message resolves it and starts a new slice", b.v === "ok");
  const c = settled(j.step());
  await micro();
  check("a fresh slice resolves at once again", c.v === "ok" && F.posts === 1);
}
{
  const F = fakes();
  const j = createJob({ now: F.now, channel: F.channel });
  j.cancel();
  const a = settled(j.step());
  await micro();
  check("cancel rejects the next step with {cancelled:true}", a.v === CANCELLED && a.v.cancelled === true && j.cancelled);
  const F2 = fakes();
  const j2 = createJob({ now: F2.now, channel: F2.channel });
  F2.t = 20;
  const b = settled(j2.step());
  j2.cancel();
  await F2.run();
  check("cancel during a yield rejects the waiting step", b.v && b.v.cancelled === true);
}
{
  const F = fakes();
  let open = false;
  const j = createJob({ now: F.now, channel: F.channel, gate: () => open });
  const a = settled(j.step());
  await F.run();
  check("a closed gate (GAME + PLAY / INTRO show) parks: no step resolves, nothing is posted", a.v === "pending" && F.posts === 0 && j.parked);
  j.wake();
  await F.run();
  check("wake() with the gate still closed keeps it parked", a.v === "pending");
  open = true;
  j.wake();
  await F.run();
  check("the next idle state resumes it (wake → one yield → resolve)", a.v === "ok" && F.posts === 1);
  F.t = 50;
  const b = settled(j.step());
  open = false;
  await F.run();
  check("a gate that closes during a yield parks the step again", b.v === "pending");
  j.cancel();
  await micro();
  check("cancel rejects a parked step", b.v && b.v.cancelled === true);
}
{
  const seen = [];
  const j = createJob({ look: "3d", report: (s) => seen.push(s) });
  j.report("build", 5, 3);
  check("report never says done > total", seen[0].done === 3 && seen[0].total === 3);
  j.report("shaders", -2, 4);
  check("report never says done < 0", seen[1].done === 0);
  j.report("warm", 0, 0);
  check("no total = indeterminate (no count, fill holds)", seen[2].ind === true && seen[2].total === null && seen[2].f >= seen[1].f);
}
{
  for (const look of Object.keys(BANDS)) {
    const b = BANDS[look], ps = Object.keys(b);
    const sum = ps.reduce((s, p) => s + b[p].w, 0);
    check(look + ": phase bands sum to 1", Math.abs(sum - 1) < 1e-9, sum);
    check(look + ": bands follow PHASES order and tile [0,1] with no gap", ps.every((p, i) => PHASES.indexOf(p) > (i ? PHASES.indexOf(ps[i - 1]) : -1) && Math.abs(b[p].at - (i ? b[ps[i - 1]].at + b[ps[i - 1]].w : 0)) < 1e-9));
    const seen = [];
    const j = createJob({ look, report: (s) => seen.push(s.f) });
    for (const p of ps) for (let d = 0; d <= 4; d++) j.report(p, d, 4);
    j.report(ps[0], 0, 4); // a late, earlier phase never pulls the bar back
    check(look + ": fill is monotonic and ends at 1", seen.every((f, i) => !i || f >= seen[i - 1]) && Math.abs(seen[seen.length - 1] - 1) < 1e-9, seen.join());
  }
  check("fillOf: an unknown phase has no fill", fillOf("px", "shaders", 1, 1) === null);
}

{
  const asked = [], read = [];
  const get = (u) => { asked.push(u); if (u.endsWith("bad.js")) return Promise.resolve({ ok: false }); if (u.endsWith("throw.js")) throw new Error("net"); return Promise.resolve({ ok: true, arrayBuffer: () => { read.push(u); return Promise.resolve(new ArrayBuffer(1)); } }); };
  const n = await prefetch(["a.js", "bad.js", "throw.js", "b.js"], get);
  check("prefetch: every file asked once, each good body read to its end (the cache entry completes)", asked.join() === "a.js,bad.js,throw.js,b.js" && read.join() === "a.js,b.js");
  check("prefetch: a miss or a throw is not an error (the import reports it); resolves with the files that came in", n === 2);
  check("prefetch: nothing to fetch resolves 0", (await prefetch([], get)) === 0 && (await prefetch(null, get)) === 0);
}

console.log(`\nJOBS ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
